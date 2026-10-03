import EventEmitter from 'node:events';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { agentRegistry, AgentRegistry } from '../agents/agentRegistry.js';
import { BaseAgent } from '../agents/baseAgent.js';
import { getProject, getProjectFiles, updateProject, getProjectHtml, saveProjectFile } from '../services/projectService.js';
import { budgetService } from '../services/budgetService.js';
import { projectError } from '../services/filePaths.js';
import { projectFileSession, runFileAgent } from '../services/agentFileSession.js';
import { validateWebsite } from '../services/validationService.js';
import { DocumentAgent, TASK_ROUTER_PROMPT } from '../agents/definitions/documentAgent.js';
import { writeDocument } from '../services/documentSession.js';

// Compatibility utility for old provider responses. Parsed JSON is already decoded.
export function extractHtmlFromCodingResult(result, rawText = '') {
  const structured = result?.file?.content || result?.artifact?.content || result?.content || result?.html;
  let content = typeof structured === 'string' ? structured : '';
  if (!content && rawText) {
    try { return extractHtmlFromCodingResult(JSON.parse(rawText)); } catch { /* Fenced/raw HTML only. */ }
    content = rawText.match(/```html\s*([\s\S]*?)```/i)?.[1]?.trim() || '';
    if (!content && /^\s*<!doctype html/i.test(rawText)) content = rawText.trim();
  }
  if (content && !/^\s*<!doctype/i.test(content)) content = `<!DOCTYPE html>\n${content}`;
  return content;
}

export class Orchestrator extends EventEmitter {
  constructor(registry = agentRegistry) {
    super();
    this.registry = registry;
    this.context = new AsyncLocalStorage();
    this.running = new Set();
    this.setMaxListeners(100);
    registry.on('agentState', ev => this.emit('agentState', ev));
    registry.on('agentFallback', ev => this.emitPipelineEvent('AGENT_FALLBACK', ev));
  }

  get agents() { return this.context.getStore()?.registry || this.registry; }

  async withRun(projectId, task, { runId = randomUUID(), reuseContext = false } = {}) {
    if (reuseContext && this.context.getStore()?.projectId === projectId) return task();
    if (projectId && this.running.has(projectId)) throw projectError('This project already has an active agent run', 409);
    if (projectId) this.running.add(projectId);
    const registry = new AgentRegistry();
    registry.agents.clear();
    registry.aliasMap = new Map(this.registry.aliasMap);
    for (const source of this.registry.getAllStaff()) {
      const agent = new BaseAgent({ ...source.toJSON(), contractRole: source.contractRole, model: source.modelId, systemPrompt: source.systemPrompt, outputSchema: source.outputSchema, fallbackModels: source.fallbackModels });
      registry.registerAgent(agent);
    }
    registry.on('agentState', ev => this.emit('agentState', { ...ev, projectId, runId }));
    registry.on('agentFallback', ev => this.emitPipelineEvent('AGENT_FALLBACK', ev));
    try { return await this.context.run({ projectId, runId, registry }, task); }
    finally { this.running.delete(projectId); }
  }

  emitPipelineEvent(stage, data = {}) {
    const run = this.context.getStore();
    const event = { stage, timestamp: new Date().toISOString(), ...data, ...(run ? { projectId: run.projectId, runId: run.runId } : {}) };
    this.emit('pipeline', event);
    return event;
  }

  recordAgentExecution(projectId, agent, output) {
    const cost = output?.cost || 0;
    this.emitPipelineEvent('AGENT_COST_INCURRED', { projectId, agentId: agent.id, agentName: agent.name, modelUsed: output?.model || agent.modelId,
      cost, totalProjectSpend: budgetService.recordSpend(projectId, cost), budget: budgetService.getBudget() });
  }

  async saveReport(projectId, name, response, agentId = 'manager') {
    if (!projectId) return;
    await saveProjectFile(projectId, { filePath: `reports/${name}.md`, content: `# ${name.replaceAll('_', ' ')}\n\n\`\`\`json\n${JSON.stringify(response, null, 2)}\n\`\`\`\n`, agentId, type: 'markdown' });
  }

  async executeTask({ projectId, prompt, taskType = 'auto', outputPath, gateway, onChunk, runId } = {}) {
    if (!['auto', 'website', 'document'].includes(taskType)) throw projectError('taskType must be auto, website, or document');
    return this.withRun(projectId, async () => {
      try {
        const project = await getProject(projectId);
        if (!project) throw projectError('Project not found', 404);
        if (taskType === 'auto') {
          this.emitPipelineEvent('TASK_ROUTING_STARTED', { prompt });
          const manager = this.agents.getAgent('manager');
          const output = await manager.execute({ input: prompt, systemPrompt: TASK_ROUTER_PROMPT,
            outputSchema: { taskType: 'website | document', reason: 'Why this deliverable fits the request' },
            context: { project_type: project.projectType, last_task: project.lastTask?.taskType, files: (await getProjectFiles(projectId)).filter(f => !f.artifact).map(f => ({ path: f.path, binary: f.binary })) }, gateway, onChunk });
          this.recordAgentExecution(projectId, manager, output);
          if (!['website', 'document'].includes(output.result?.taskType)) throw projectError('The Manager could not classify this task. Choose Website or Markdown explicitly and retry.', 422);
          taskType = output.result.taskType;
        }
        this.emitPipelineEvent('TASK_ROUTED', { taskType, prompt });
        if (taskType === 'website') return { ...await this.buildFullProject({ projectId, prompt, gateway, onChunk, runId, reuseContext: true }), taskType };
        const model = this.agents.getAgent('coding_agent');
        const analyst = new DocumentAgent({ model: model.modelId, fallbackModels: model.fallbackModels });
        this.agents.registerAgent(analyst);
        this.emitPipelineEvent('DOCUMENT_STARTED', { prompt, agentId: analyst.id, agentName: analyst.name });
        const result = await writeDocument({ project, prompt, outputPath, agent: analyst, gateway,
          onExecution: output => this.recordAgentExecution(projectId, analyst, output),
          onReading: details => this.emitPipelineEvent('DOCUMENT_READING', details) });
        this.emitPipelineEvent('DOCUMENT_COMPLETED', result);
        return result;
      } catch (error) { this.emitPipelineEvent('TASK_FAILED', { error: error.message }); throw error; }
    }, { runId });
  }

  async plan(prompt, { projectId, gateway, onChunk } = {}) {
    const manager = this.agents.getAgent('manager');
    this.emitPipelineEvent('MANAGER_PLAN_STARTED', { prompt });
    const output = await manager.execute({ input: `Analyze the following user goal and provide a structured execution plan, extract explicit user requirements, and select required specialist agents:\n${prompt}`, gateway, onChunk });
    this.recordAgentExecution(projectId, manager, output);
    const plan = output.result;
    if (!plan || plan.parseError || !Array.isArray(plan.selected_agents) || plan.selected_agents.some(a => !['designer', 'frontend_architect', 'feature_architect'].includes(a))) throw projectError('Manager returned an invalid execution plan', 422);
    await this.saveReport(projectId, 'manager_plan', plan);
    this.emitPipelineEvent('MANAGER_PLAN_COMPLETED', { plan });
    return plan;
  }

  async runSpecialists(plan, userPrompt, { projectId, gateway, onChunk } = {}) {
    const selectedAgents = [...new Set(plan.selected_agents || ['designer', 'frontend_architect', 'feature_architect'])];
    this.emitPipelineEvent('SPECIALISTS_STARTED', { selectedAgents });
    const instructions = {
      designer: `Formulate the complete visual direction and UX design specification for: ${userPrompt}`,
      frontend_architect: `Design the technical architecture, file tree, entry points, shared CSS and JavaScript modules for: ${userPrompt}`,
      feature_architect: `Define the behavioral specifications and interaction flows for: ${userPrompt}`,
    };
    // allSettled keeps a failed run alive until its sibling tasks finish, so another
    // run cannot enter while old specialists are still saving artifacts.
    const results = await Promise.allSettled(selectedAgents.map(async id => {
      const agent = this.agents.getAgent(id);
      const output = await agent.execute({ input: instructions[id], context: { explicit_requirements: plan.explicit_requirements, project: plan.project }, gateway, onChunk });
      this.recordAgentExecution(projectId, agent, output);
      if (!output.result || output.result.parseError) throw projectError(`${agent.name} returned invalid JSON`, 422);
      await this.saveReport(projectId, id, output.result, id);
      this.emitPipelineEvent('INTERAGENT_COMMUNICATION', { fromAgent: agent.id, fromName: agent.name, toAgent: 'manager', toName: 'Manager', subject: 'Specification delivered', message: `${agent.name} completed the project specification.` });
      return [id, output.result];
    }));
    const failure = results.find(r => r.status === 'rejected');
    if (failure) throw failure.reason;
    const specialistOutputs = Object.fromEntries(results.map(r => r.value));
    this.emitPipelineEvent('SPECIALISTS_COMPLETED', { specialistOutputs });
    return specialistOutputs;
  }

  async synthesize(userPrompt, plan, specialistOutputs, { projectId, gateway, onChunk } = {}) {
    const manager = this.agents.getAgent('manager');
    this.emitPipelineEvent('MANAGER_SYNTHESIS_STARTED');
    const output = await manager.execute({ input: 'You must now synthesize the specialist specifications into one cohesive Unified Implementation Specification, including file_plan and entry_point for a multi-file website.',
      context: { original_goal: userPrompt, manager_plan: plan, specialist_outputs: specialistOutputs },
      outputSchema: { agent: 'manager', status: 'completed', unified_specification: { project: {}, user_requirements: [], design_system: {}, technical_architecture: {}, features_and_behaviors: [], entry_point: 'index.html', file_plan: [{ path: 'index.html', purpose: 'Entry page', dependencies: [] }] } }, gateway, onChunk });
    this.recordAgentExecution(projectId, manager, output);
    if (!output.result || output.result.parseError) throw projectError('Manager synthesis returned invalid JSON', 422);
    const unifiedSpec = output.result.unified_specification || output.result;
    await this.saveReport(projectId, 'unified_implementation_spec', unifiedSpec);
    this.emitPipelineEvent('MANAGER_SYNTHESIS_COMPLETED', { unifiedSpec });
    return unifiedSpec;
  }

  async executeSpecificationPipeline({ projectId, prompt, gateway, onChunk, standalone = true, runId } = {}) {
    const execute = async () => {
      this.emitPipelineEvent('PIPELINE_STARTED', { projectId, prompt });
      const plan = await this.plan(prompt, { projectId, gateway, onChunk });
      const specialistOutputs = await this.runSpecialists(plan, prompt, { projectId, gateway, onChunk });
      const unifiedSpec = await this.synthesize(prompt, plan, specialistOutputs, { projectId, gateway, onChunk });
      if (projectId) await updateProject(projectId, { managerPlan: plan, specialistOutputs, unifiedSpec, status: 'specification_ready' });
      const result = { projectId, plan, specialistOutputs, unifiedSpec };
      this.emitPipelineEvent('SPECIFICATION_COMPLETED', result);
      if (standalone) this.emitPipelineEvent('PIPELINE_COMPLETED', { ...result, specificationOnly: true });
      return result;
    };
    return standalone ? this.withRun(projectId, execute, { runId }) : execute();
  }

  async implement({ projectId, userPrompt, unifiedSpec, existingHtml = null, changeNote = 'Website generated', gateway, onChunk } = {}) {
    const agent = this.agents.getAgent('coding_agent');
    this.emitPipelineEvent('CODING_AGENT_STARTED', { projectId, userPrompt });
    const session = await projectFileSession(projectId, { fallbackHtml: existingHtml, entryPoint: unifiedSpec?.entry_point || 'index.html' });
    const result = await runFileAgent(agent, session, { input: `${session.tree().length ? 'Modify the existing project according to the user request. MINIMAL CHANGE PRESERVATION RULE: preserve unrelated files and behavior.' : 'Generate the complete multi-file website.'}\n${userPrompt}`,
      context: { user_goal: userPrompt, unified_specification: unifiedSpec, existing_html: session.seed.find(f => f.path === 'index.html')?.content }, gateway, onChunk,
      onExecution: out => this.recordAgentExecution(projectId, agent, out) });
    const saved = await session.commit(changeNote);
    const htmlContent = saved.files.find(f => f.path === session.entryPoint)?.content || saved.files.find(f => f.path === session.entryPoint)?.data?.toString('utf8') || '';
    await this.saveReport(projectId, 'build_summary', { summary: result.summary, changes: saved.changes, validation: saved.validation }, agent.id);
    this.emitPipelineEvent('CODING_AGENT_COMPLETED', { projectId, revision: saved.revision, changes: saved.changes, contentLength: htmlContent.length, validation: saved.validation });
    return { ...saved, projectId, htmlContent, summary: result.summary, entryPoint: session.entryPoint };
  }

  async audit({ projectId, userPrompt, unifiedSpec, htmlContent, gateway, onChunk } = {}) {
    const agent = this.agents.getAgent('qa');
    this.emitPipelineEvent('QA_STARTED', { projectId });
    const session = await projectFileSession(projectId, { fallbackHtml: htmlContent });
    // For standalone audit calls the caller may supply an unsaved document.
    if (!session.tree().length && htmlContent) {
      session.stage([{ action: 'create', path: 'index.html', content: htmlContent }]);
      session.seed.push({ path: 'index.html', content: htmlContent });
    }
    const validation = validateWebsite(await session.candidate(), session.entryPoint);
    let report;
    try {
      report = await runFileAgent(agent, session, { mode: 'qa', input: `Audit the generated multi-file website for requirements compliance and cross-file correctness.\n${userPrompt}`,
        context: { user_goal: userPrompt, unified_specification: unifiedSpec, deterministic_validation: validation }, gateway, onChunk,
        onExecution: out => this.recordAgentExecution(projectId, agent, out) });
    } catch (err) {
      report = { agent: 'qa', status: 'failed', result: 'issues_found', summary: { verdict: `Audit could not complete: ${err.message}` }, issues: [{ severity: 'high', category: 'audit', location: 'QA response', description: err.message }] };
    }
    report.issues = [...report.issues, ...validation.issues];
    report.validation = validation;
    if (report.issues.length) report.result = 'issues_found';
    if (projectId) {
      await updateProject(projectId, { qaReport: report, validation });
      await this.saveReport(projectId, 'qa_audit_report', report, agent.id);
    }
    this.emitPipelineEvent('QA_COMPLETED', { projectId, ...report });
    return report;
  }

  async buildFullProject({ projectId, prompt, gateway, onChunk, runId, reuseContext = false } = {}) {
    // Existing applications always use the contextual edit flow, never a rebuild
    // from a short prompt that discards the uploaded implementation.
    const project = projectId ? await getProject(projectId) : null;
    if (project?.revision > 0 || (project && await getProjectHtml(projectId))) return this.applyFeedback({ projectId, feedback: prompt, gateway, onChunk, runId, reuseContext });
    return this.withRun(projectId, async () => {
      try {
        const spec = await this.executeSpecificationPipeline({ projectId, prompt, gateway, onChunk, standalone: false });
        let built = await this.implement({ projectId, userPrompt: prompt, unifiedSpec: spec.unifiedSpec, gateway, onChunk });
        let qaReport = await this.audit({ projectId, userPrompt: prompt, unifiedSpec: spec.unifiedSpec, htmlContent: built.htmlContent, gateway, onChunk });
        if (qaReport.status !== 'failed' && qaReport.result === 'issues_found' && qaReport.issues.length) {
          this.emitPipelineEvent('QA_REPAIR_STARTED', { issueCount: qaReport.issues.length });
          built = await this.implement({ projectId, userPrompt: `Repair only these QA defects: ${JSON.stringify(qaReport.issues)}`, unifiedSpec: spec.unifiedSpec, existingHtml: built.htmlContent, changeNote: 'QA repair', gateway, onChunk });
          qaReport = await this.audit({ projectId, userPrompt: prompt, unifiedSpec: spec.unifiedSpec, htmlContent: built.htmlContent, gateway, onChunk });
          this.emitPipelineEvent('QA_REPAIR_COMPLETED', { qaResult: qaReport.result, issues: qaReport.issues });
        }
        const result = { ...spec, ...built, qaReport };
        this.emitPipelineEvent('PIPELINE_COMPLETED', { projectId, revision: built.revision, changes: built.changes, qaReport });
        return result;
      } catch (err) { this.emitPipelineEvent('PIPELINE_FAILED', { projectId, error: err.message }); throw err; }
    }, { runId, reuseContext });
  }

  async applyFeedback({ projectId, feedback, gateway, onChunk, runId, reuseContext = false } = {}) {
    return this.withRun(projectId, async () => {
      try {
        const project = await getProject(projectId);
        if (!project) throw projectError('Project not found', 404);
        this.emitPipelineEvent('FEEDBACK_STARTED', { projectId, feedback });
        const built = await this.implement({ projectId, userPrompt: feedback, unifiedSpec: project.unifiedSpec, changeNote: `Human Feedback: ${feedback}`, gateway, onChunk });
        const qaReport = await this.audit({ projectId, userPrompt: `${project.prompt}\nRequested edit: ${feedback}`, unifiedSpec: project.unifiedSpec, htmlContent: built.htmlContent, gateway, onChunk });
        const result = { ...built, version: built.revision, qaReport };
        this.emitPipelineEvent('FEEDBACK_COMPLETED', { projectId, feedback, version: built.revision, revision: built.revision, changes: built.changes, qaReport });
        return result;
      } catch (err) { this.emitPipelineEvent('FEEDBACK_FAILED', { projectId, error: err.message }); throw err; }
    }, { runId, reuseContext });
  }
}

export const orchestrator = new Orchestrator();
