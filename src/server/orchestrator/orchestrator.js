import EventEmitter from 'events';
import { agentRegistry } from '../agents/agentRegistry.js';
import { getProject, updateProject, saveProjectHtml, getProjectHtml, saveAgentArtifact } from '../services/projectService.js';
import { budgetService } from '../services/budgetService.js';

/**
 * Helper to safely extract HTML content from various structured outputs
 */
export function extractHtmlFromCodingResult(result, rawText = '') {
  let content = '';

  if (result && typeof result === 'object') {
    content = result.file?.content || result.artifact?.content || result.content || result.html || '';
  }

  if (!content && typeof rawText === 'string') {
    // 1. Check for explicit html code fences: ```html ... ```
    const htmlFenceMatch = rawText.match(/```html\s*([\s\S]*?)(?:```|$)/i);
    if (htmlFenceMatch && htmlFenceMatch[1].trim().includes('<')) {
      content = htmlFenceMatch[1].trim();
    }

    // 2. Check for "content": "...<!DOCTYPE html>..." inside raw JSON string
    if (!content) {
      const contentJsonMatch = rawText.match(/"content"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|"\s*\}|$)/);
      if (contentJsonMatch && contentJsonMatch[1].includes('<')) {
        content = contentJsonMatch[1];
      }
    }

    // 3. Fallback: find <!DOCTYPE html> ... </html>
    if (!content) {
      const docIndex = rawText.indexOf('<!DOCTYPE html>');
      if (docIndex !== -1) {
        const lastHtmlClose = rawText.lastIndexOf('</html>');
        if (lastHtmlClose !== -1 && lastHtmlClose > docIndex) {
          content = rawText.slice(docIndex, lastHtmlClose + 7).trim();
        } else {
          content = rawText.slice(docIndex).trim();
        }
      }
    }

    // 4. Fallback: generic code fences that are NOT json fences
    if (!content) {
      const fenceMatch = rawText.match(/```(?!(?:json))\w*\s*([\s\S]*?)(?:```|$)/i);
      if (fenceMatch && fenceMatch[1].trim().includes('<')) {
        content = fenceMatch[1].trim();
      }
    }
  }

  // Unescape literal JSON escape sequences if extracted from raw JSON string
  if (content.includes('\\n') || content.includes('\\"')) {
    content = content
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  // Strip trailing JSON quotes/brackets if sliced from incomplete JSON
  content = content.replace(/["}\]\s]+$/, '').trim();

  // Ensure DOCTYPE is present
  if (content && !content.trim().toLowerCase().startsWith('<!doctype')) {
    content = `<!DOCTYPE html>\n${content.trim()}`;
  }

  // Ensure unclosed tags are gracefully closed if output was truncated
  if (content.includes('<body') && !content.includes('</body>')) {
    if (content.includes('<script') && !content.includes('</script>')) {
      content += '\n</script>';
    }
    content += '\n</body>';
  }
  if (content.includes('<html') && !content.includes('</html>')) {
    content += '\n</html>';
  }

  return content;
}

/**
 * Orchestrator Service
 * 
 * Coordinates the multi-agent execution pipeline:
 * 1. Manager Planning & Specialist Selection
 * 2. Concurrent Specialist Execution (Designer, Frontend Architect, Feature Architect)
 * 3. Manager Synthesis into Unified Implementation Specification
 * 4. (Phase 4: Coding Agent)
 * 5. (Phase 6: QA Audit)
 */
export class Orchestrator extends EventEmitter {
  constructor(registry = agentRegistry) {
    super();
    this.registry = registry;

    // Relay agent state and fallback events
    this.registry.on('agentState', (ev) => {
      this.emit('agentState', ev);
    });
    this.registry.on('agentFallback', (ev) => {
      this.emitPipelineEvent('AGENT_FALLBACK', ev);
    });
  }

  /**
   * Record spend and emit cost tracking events
   */
  recordAgentExecution(projectId, agent, output) {
    const cost = output?.cost ?? 0;
    const modelUsed = output?.model ?? agent.modelId;
    const totalSpend = budgetService.recordSpend(projectId, cost);
    this.emitPipelineEvent('AGENT_COST_INCURRED', {
      projectId,
      agentId: agent.id,
      agentName: agent.name,
      modelUsed,
      cost,
      totalProjectSpend: totalSpend,
      budget: budgetService.getBudget(),
    });
  }

  /**
   * Helper to emit structured pipeline events
   */
  emitPipelineEvent(stage, data = {}) {
    const event = {
      stage,
      timestamp: new Date().toISOString(),
      ...data,
    };
    this.emit('pipeline', event);
    return event;
  }

  /**
   * Stage 1: Manager Plan & Agent Selection
   */
  async plan(prompt, { projectId, gateway, onChunk } = {}) {
    const manager = this.registry.getAgent('manager');
    this.emitPipelineEvent('MANAGER_PLAN_STARTED', { prompt });

    const managerOutput = await manager.execute({
      input: `Analyze the following user goal and provide a structured execution plan, extract explicit user requirements, and select required specialist agents:\n\n"${prompt}"`,
      gateway,
      onChunk,
    });

    const plan = managerOutput.result;
    this.recordAgentExecution(projectId, manager, managerOutput);
    this.emitPipelineEvent('MANAGER_PLAN_COMPLETED', { plan });

    if (projectId) {
      saveAgentArtifact({
        projectId,
        agentId: 'manager',
        agentName: 'Atlas (Manager)',
        task: `Analyze user goal and produce plan for "${prompt}"`,
        status: 'Completed',
        response: plan,
      }).catch(err => console.warn('[ARTIFACT] Error saving manager plan artifact:', err.message));
    }

    return plan;
  }

  /**
   * Stage 2: Concurrent Specialist Execution
   * Runs Designer, Frontend Architect, and Feature Architect in parallel.
   * Direct response is returned directly to Manager, while simultaneously persisting .md artifact.
   */
  async runSpecialists(plan, userPrompt, { projectId, gateway, onChunk } = {}) {
    this.emitPipelineEvent('SPECIALISTS_STARTED', {
      selectedAgents: plan.selected_agents || ['designer', 'frontend_architect', 'feature_architect'],
    });

    const specialistsToRun = plan.selected_agents || ['designer', 'frontend_architect', 'feature_architect'];
    const tasks = [];

    // Designer task
    if (specialistsToRun.includes('designer')) {
      const designer = this.registry.getAgent('designer');
      tasks.push(
        designer.execute({
          input: `Formulate the complete visual direction and UX design specification for this project: "${userPrompt}"`,
          context: {
            explicit_requirements: plan.explicit_requirements,
            project: plan.project,
          },
          gateway,
          onChunk: onChunk ? (chunk) => onChunk({ agent: 'designer', chunk }) : null,
        }).then(out => {
          if (projectId) {
            saveAgentArtifact({
              projectId,
              agentId: 'designer',
              agentName: 'Pixel (UI/UX Designer)',
              task: `Visual direction and UX design specification for "${userPrompt}"`,
              status: 'Completed',
              response: out.result,
            }).catch(e => console.warn('[ARTIFACT] Error saving designer artifact:', e.message));
          }
          this.recordAgentExecution(projectId, designer, out);
          return { agent: 'designer', output: out.result };
        })
      );
    }

    // Frontend Architect task
    if (specialistsToRun.includes('frontend_architect')) {
      const frontendArchitect = this.registry.getAgent('frontend_architect');
      tasks.push(
        frontendArchitect.execute({
          input: `Design the technical architecture and structure for a single-file index.html web application for: "${userPrompt}"`,
          context: {
            explicit_requirements: plan.explicit_requirements,
            project: plan.project,
          },
          gateway,
          onChunk: onChunk ? (chunk) => onChunk({ agent: 'frontend_architect', chunk }) : null,
        }).then(out => {
          if (projectId) {
            saveAgentArtifact({
              projectId,
              agentId: 'frontend_architect',
              agentName: 'Nova (Frontend Architect)',
              task: `Single-file index.html technical architecture for "${userPrompt}"`,
              status: 'Completed',
              response: out.result,
            }).catch(e => console.warn('[ARTIFACT] Error saving frontend_architect artifact:', e.message));
          }
          this.recordAgentExecution(projectId, frontendArchitect, out);
          return { agent: 'frontend_architect', output: out.result };
        })
      );
    }

    // Feature Architect task
    if (specialistsToRun.includes('feature_architect')) {
      const featureArchitect = this.registry.getAgent('feature_architect');
      tasks.push(
        featureArchitect.execute({
          input: `Define the behavioral specifications and interaction flows for the features requested in: "${userPrompt}"`,
          context: {
            explicit_requirements: plan.explicit_requirements,
            project: plan.project,
          },
          gateway,
          onChunk: onChunk ? (chunk) => onChunk({ agent: 'feature_architect', chunk }) : null,
        }).then(out => {
          if (projectId) {
            saveAgentArtifact({
              projectId,
              agentId: 'feature_architect',
              agentName: 'Scout (Feature Architect)',
              task: `Feature behavior and interaction flow specification for "${userPrompt}"`,
              status: 'Completed',
              response: out.result,
            }).catch(e => console.warn('[ARTIFACT] Error saving feature_architect artifact:', e.message));
          }
          this.recordAgentExecution(projectId, featureArchitect, out);
          return { agent: 'feature_architect', output: out.result };
        })
      );
    }

    // Run all selected specialists in parallel
    const results = await Promise.all(tasks);
    const specialistOutputs = {};
    for (const res of results) {
      specialistOutputs[res.agent] = res.output;
    }

    this.emitPipelineEvent('SPECIALISTS_COMPLETED', { specialistOutputs });
    return specialistOutputs;
  }

  /**
   * Stage 3: Manager Synthesis
   * Synthesizes all specialist outputs into a single Unified Implementation Specification.
   */
  async synthesize(userPrompt, plan, specialistOutputs, { projectId, gateway, onChunk } = {}) {
    const manager = this.registry.getAgent('manager');
    this.emitPipelineEvent('MANAGER_SYNTHESIS_STARTED');

    const synthesisPrompt = `You must now synthesize the specialist specifications into one cohesive Unified Implementation Specification for the Coding Agent.
Preserve the specialist decisions, resolve any overlap, and ensure the Coding Agent has all required guidance.

Return a JSON object conforming to:
{
  "agent": "manager",
  "status": "completed",
  "unified_specification": {
    "project": {
      "name": "...",
      "summary": "..."
    },
    "user_requirements": [...],
    "design_system": { ... },
    "technical_architecture": { ... },
    "features_and_behaviors": [ ... ],
    "implementation_constraints": [
      "Strict single index.html file with embedded CSS and JS",
      "No external build dependencies",
      "Fully functional interactions and responsive layout"
    ]
  }
}`;

    const synthesisOutput = await manager.execute({
      input: synthesisPrompt,
      context: {
        original_goal: userPrompt,
        manager_plan: plan,
        specialist_outputs: specialistOutputs,
      },
      gateway,
      onChunk,
    });

    const unifiedSpec = synthesisOutput.result?.unified_specification || synthesisOutput.result;
    this.recordAgentExecution(projectId, manager, synthesisOutput);
    this.emitPipelineEvent('MANAGER_SYNTHESIS_COMPLETED', { unifiedSpec });

    if (projectId) {
      saveAgentArtifact({
        projectId,
        agentId: 'manager',
        agentName: 'Atlas (Manager)',
        task: 'Synthesize specialist specifications into Unified Implementation Specification',
        status: 'Completed',
        response: unifiedSpec,
      }).catch(e => console.warn('[ARTIFACT] Error saving manager synthesis artifact:', e.message));
    }

    return unifiedSpec;
  }

  /**
   * Execute Full Specification Pipeline (Phase 3)
   */
  async executeSpecificationPipeline({ projectId, prompt, gateway, onChunk } = {}) {
    this.emitPipelineEvent('PIPELINE_STARTED', { projectId, prompt });

    // Step 1: Manager Plan
    const plan = await this.plan(prompt, { projectId, gateway, onChunk });

    // Step 2: Parallel Specialists
    const specialistOutputs = await this.runSpecialists(plan, prompt, { projectId, gateway, onChunk });

    // Step 3: Manager Synthesis
    const unifiedSpec = await this.synthesize(prompt, plan, specialistOutputs, { projectId, gateway, onChunk });

    // Save to isolated project directory if projectId provided
    if (projectId) {
      await updateProject(projectId, {
        managerPlan: plan,
        specialistOutputs,
        unifiedSpec,
        status: 'specification_ready',
      });
    }

    this.emitPipelineEvent('PIPELINE_COMPLETED', {
      projectId,
      plan,
      specialistOutputs,
      unifiedSpec,
    });

    return {
      projectId,
      plan,
      specialistOutputs,
      unifiedSpec,
    };
  }

  /**
   * Stage 4: Coding Agent Implementation
   * Sole agent authorized to generate or edit index.html
   */
  async implement({
    projectId,
    userPrompt,
    unifiedSpec,
    existingHtml = null,
    changeNote = 'Initial Generation',
    gateway,
    onChunk,
  } = {}) {
    const codingAgent = this.registry.getAgent('coding_agent');
    this.emitPipelineEvent('CODING_AGENT_STARTED', { projectId, userPrompt });

    let codingInput = `Generate the complete, responsive, self-contained "index.html" based on the provided Unified Implementation Specification.`;
    if (existingHtml) {
      codingInput = `Modify the existing "index.html" according to the user request.
CRITICAL PRESERVATION RULE: Change ONLY what the user explicitly requested. Preserve all other HTML, CSS, JavaScript, functions, and layout intact.
User Modification Request:\n"${userPrompt}"`;
    }

    const codingOutput = await codingAgent.execute({
      input: codingInput,
      context: {
        user_goal: userPrompt,
        unified_specification: unifiedSpec,
        existing_html: existingHtml || undefined,
      },
      gateway,
      onChunk: onChunk ? (chunk) => onChunk({ agent: 'coding_agent', chunk }) : null,
    });

    const htmlContent = extractHtmlFromCodingResult(codingOutput.result, codingOutput.rawText);
    if (!htmlContent) {
      throw new Error('Coding Agent failed to produce valid HTML content');
    }

    this.recordAgentExecution(projectId, codingAgent, codingOutput);

    // Persist into isolated project directory and mirror to workspace
    if (projectId) {
      await saveProjectHtml(projectId, htmlContent, changeNote);
    }

    this.emitPipelineEvent('CODING_AGENT_COMPLETED', {
      projectId,
      contentLength: htmlContent.length,
      summary: codingOutput.result?.summary || {},
    });

    return {
      projectId,
      htmlContent,
      summary: codingOutput.result?.summary || {},
      rawOutput: codingOutput,
    };
  }

  /**
   * Stage 5: QA Agent Audit
   * Evaluates generated implementation against requirements and standards.
   */
  async audit({
    projectId,
    userPrompt,
    unifiedSpec,
    htmlContent,
    gateway,
    onChunk,
  } = {}) {
    const qaAgent = this.registry.getAgent('qa');
    this.emitPipelineEvent('QA_STARTED', { projectId });

    const auditInput = `Audit the generated single-file index.html website for semantic DOM integrity, JavaScript errors, broken handlers, responsive layout bugs, and compliance with the user requirements.
Return a structured audit report with status "passed" or "issues_found". Do NOT modify the code.`;

    const qaOutput = await qaAgent.execute({
      input: auditInput,
      context: {
        user_goal: userPrompt,
        unified_specification: unifiedSpec,
        html_to_inspect: htmlContent,
      },
      gateway,
      onChunk: onChunk ? (chunk) => onChunk({ agent: 'qa', chunk }) : null,
    });

    const report = qaOutput.result || {};
    this.recordAgentExecution(projectId, qaAgent, qaOutput);
    if (projectId) {
      await updateProject(projectId, { qaReport: report });
      saveAgentArtifact({
        projectId,
        agentId: 'qa',
        agentName: 'Query (QA Auditor)',
        task: `Audit generated index.html for "${userPrompt}"`,
        status: report.result || 'Completed',
        response: report,
      }).catch(e => console.warn('[ARTIFACT] Error saving qa artifact:', e.message));
    }

    this.emitPipelineEvent('QA_COMPLETED', {
      projectId,
      result: report.result || 'passed',
      issues: report.issues || [],
      summary: report.summary || {},
    });

    return report;
  }

  /**
   * Execute Full End-to-End Build Pipeline (Phase 4 / 6)
   * Manager Plan -> Parallel Specialists -> Manager Synthesis -> Coding Agent -> QA Agent -> Saved index.html
   */
  async buildFullProject({ projectId, prompt, gateway, onChunk } = {}) {
    try {
      // Run specification pipeline first
      const specResult = await this.executeSpecificationPipeline({
        projectId,
        prompt,
        gateway,
        onChunk,
      });

      // Implement via Coding Agent
      const implementResult = await this.implement({
        projectId: specResult.projectId,
        userPrompt: prompt,
        unifiedSpec: specResult.unifiedSpec,
        gateway,
        onChunk,
      });

      // Run QA Audit
      let qaReport = await this.audit({
        projectId: specResult.projectId,
        userPrompt: prompt,
        unifiedSpec: specResult.unifiedSpec,
        htmlContent: implementResult.htmlContent,
        gateway,
        onChunk,
      });

      let finalHtml = implementResult.htmlContent;
      let finalSummary = implementResult.summary;

      // Automated QA Auto-Repair Loop: If QA found defects, trigger Coding Agent to fix them
      if (qaReport.result === 'issues_found' && qaReport.issues?.length > 0) {
        this.emitPipelineEvent('QA_REPAIR_STARTED', {
          projectId: specResult.projectId,
          issueCount: qaReport.issues.length,
          verdict: qaReport.summary?.verdict || 'Issues detected during audit',
        });

        try {
          const issuesSummary = qaReport.issues
            .map((iss, i) => `${i + 1}. [${iss.severity?.toUpperCase() || 'DEFECT'}] ${iss.location || 'Code'}: ${iss.description}. Fix: ${iss.recommendation || 'Complete implementation'}`)
            .join('\n');

          const repairPrompt = `The QA Agent audited your previous code and detected the following ${qaReport.issues.length} defect(s):\n${issuesSummary}\n\nPlease repair all identified defects immediately and output the complete, valid, self-contained "index.html" with all missing tags, CSS styles, and JavaScript interactions fully resolved.`;

          const repairResult = await this.implement({
            projectId: specResult.projectId,
            userPrompt: repairPrompt,
            unifiedSpec: specResult.unifiedSpec,
            existingHtml: finalHtml,
            changeNote: `QA Automated Repair (${qaReport.issues.length} defect(s) fixed)`,
            gateway,
            onChunk,
          });

          finalHtml = repairResult.htmlContent;
          finalSummary = repairResult.summary;

          // Re-audit repaired code
          qaReport = await this.audit({
            projectId: specResult.projectId,
            userPrompt: prompt,
            unifiedSpec: specResult.unifiedSpec,
            htmlContent: finalHtml,
            gateway,
            onChunk,
          });

          this.emitPipelineEvent('QA_REPAIR_COMPLETED', {
            projectId: specResult.projectId,
            qaResult: qaReport.result,
            issues: qaReport.issues || [],
            summary: qaReport.summary || {},
          });
        } catch (repairErr) {
          console.warn(`[ORCHESTRATOR] QA auto-repair encountered an error:`, repairErr.message);
        }
      }

      return {
        projectId: specResult.projectId,
        plan: specResult.plan,
        specialistOutputs: specResult.specialistOutputs,
        unifiedSpec: specResult.unifiedSpec,
        htmlContent: finalHtml,
        summary: finalSummary,
        qaReport,
      };
    } catch (err) {
      this.emitPipelineEvent('PIPELINE_FAILED', {
        projectId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Stage 6: Human Feedback Modification (Phase 7)
   * Direct-to-Coder modification strictly adhering to the Minimal Change Preservation Rule.
   */
  async applyFeedback({
    projectId,
    feedback,
    gateway,
    onChunk,
  } = {}) {
    try {
      const project = await getProject(projectId);
      if (!project) throw new Error(`Project "${projectId}" not found`);

      const existingHtml = await getProjectHtml(projectId);
      if (!existingHtml) throw new Error(`Project "${projectId}" has no generated HTML to modify`);

      const codingAgent = this.registry.getAgent('coding_agent');
      this.emitPipelineEvent('FEEDBACK_STARTED', { projectId, feedback });

      const feedbackInput = `The user has provided human feedback requesting a modification:
"${feedback}"

CRITICAL MINIMAL CHANGE PRESERVATION RULE:
1. Treat the existing "index.html" as the absolute source of truth.
2. Modify ONLY what the user explicitly asked to change.
3. Preserve all unrelated HTML, CSS, JavaScript, functions, variables, IDs, classes, animations, and layout exactly intact.
4. Do NOT perform unrequested redesigns, refactors, or optimizations.
5. Return a complete, valid index.html containing the targeted modification.`;

      const codingOutput = await codingAgent.execute({
        input: feedbackInput,
        context: {
          operation: 'modify',
          scope: 'targeted_change',
          user_feedback: feedback,
          original_prompt: project.prompt,
          explicit_requirements: project.managerPlan?.explicit_requirements || [],
          existing_html: existingHtml,
        },
        gateway,
        onChunk: onChunk ? (chunk) => onChunk({ agent: 'coding_agent', chunk }) : null,
      });

      const modifiedHtml = extractHtmlFromCodingResult(codingOutput.result, codingOutput.rawText);
      if (!modifiedHtml) {
        throw new Error('Coding Agent failed to produce valid HTML for feedback modification');
      }

      const updatedProject = await saveProjectHtml(projectId, modifiedHtml, `Human Feedback: ${feedback}`);

      this.emitPipelineEvent('FEEDBACK_COMPLETED', {
        projectId,
        feedback,
        version: updatedProject.version,
        contentLength: modifiedHtml.length,
      });

      return {
        projectId,
        version: updatedProject.version,
        htmlContent: modifiedHtml,
        summary: codingOutput.result?.summary || {},
      };
    } catch (err) {
      this.emitPipelineEvent('FEEDBACK_FAILED', {
        projectId,
        error: err.message,
      });
      throw err;
    }
  }
}

export const orchestrator = new Orchestrator();
