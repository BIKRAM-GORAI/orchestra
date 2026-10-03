import express from 'express';
import { config, validateConfig } from '../config/env.js';
import { MODEL_REGISTRY, MODEL_POLICIES } from '../config/models.js';
import { modelGateway } from '../gateway/modelGateway.js';
import { agentRegistry } from '../agents/agentRegistry.js';
import { orchestrator } from '../orchestrator/orchestrator.js';
import { createProject, getProject } from '../services/projectService.js';
import { budgetService, BUDGET_TIERS } from '../services/budgetService.js';
import { projectsRouter } from './projects.js';
import { projectError } from '../services/filePaths.js';
import { validateDocumentPath } from '../services/documentSession.js';

export const router = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
router.use('/projects', projectsRouter);

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(),
  env: { hasNvidiaKey: Boolean(config.nvidiaApiKey), hasGeminiKey: Boolean(config.geminiApiKey), hasOpenRouterKey: Boolean(config.openrouterApiKey), defaultModel: MODEL_POLICIES.default.primary, port: config.port }, warnings: validateConfig().warnings }));
router.get('/models', (req, res) => res.json({ models: Object.values(MODEL_REGISTRY).map(({ endpoint, defaultParameters, ...model }) => model), policy: MODEL_POLICIES.default }));
router.get('/agents', (req, res) => res.json({ agents: agentRegistry.toJSON() }));
router.post('/agents/create', (req, res, next) => {
  try { res.json({ status: 'success', agent: agentRegistry.createAgentInstance(req.body).toJSON() }); } catch (err) { next(projectError(err.message)); }
});
router.put('/agents/:id/config', (req, res, next) => {
  try { res.json({ status: 'success', agent: agentRegistry.updateAgentConfig(req.params.id, req.body).toJSON() }); } catch (err) { next(projectError(err.message)); }
});
router.post('/agents/:id/model', (req, res, next) => {
  try { res.json({ status: 'success', agent: agentRegistry.updateAgentModel(req.params.id, req.body.modelId).toJSON() }); } catch (err) { next(projectError(err.message)); }
});
router.get('/budget/status', (req, res) => res.json({ currentBudget: budgetService.getBudget(), projectSpend: budgetService.getProjectSpend(req.query.projectId), tiers: BUDGET_TIERS, models: Object.values(MODEL_REGISTRY) }));
router.post('/budget/allocate', (req, res, next) => {
  try {
    const amount = req.body.budget ?? BUDGET_TIERS[String(req.body.tier || '').toUpperCase()]?.maxBudget;
    if (!Number.isFinite(amount) || amount < 0) throw projectError('Budget must be a non-negative number');
    const result = budgetService.allocateBudget(amount, agentRegistry);
    orchestrator.emitPipelineEvent('BUDGET_ALLOCATED', result);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
});

router.get('/orchestrate/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = type => ev => {
    if (req.query.projectId && ev.projectId !== req.query.projectId) return;
    if (!res.destroyed && !res.writableEnded) {
      try {
        res.write(`event: ${type}\ndata: ${JSON.stringify(ev)}\n\n`);
      } catch (_) {
        // Socket closed or resetting
      }
    }
  };

  const onAgentState = send('agentState');
  const onPipeline = send('pipeline');
  orchestrator.on('agentState', onAgentState);
  orchestrator.on('pipeline', onPipeline);

  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded) {
      try {
        res.write(': heartbeat\n\n');
      } catch (_) {
        clearInterval(heartbeat);
      }
    } else {
      clearInterval(heartbeat);
    }
  }, 15000);
  heartbeat.unref();

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    clearInterval(heartbeat);
    orchestrator.off('agentState', onAgentState);
    orchestrator.off('pipeline', onPipeline);
  };

  res.on('close', cleanup);
  res.on('finish', cleanup);
  res.on('error', cleanup);
  req.on('error', cleanup);
});

for (const kind of ['spec', 'build', 'feedback', 'task']) {
  router.post(`/orchestrate/${kind}`, asyncRoute(async (req, res) => {
    const text = kind === 'feedback' ? req.body.feedback : req.body.prompt;
    if (typeof text !== 'string' || !text.trim() || text.length > 20000) throw projectError('Provide a non-empty request of up to 20,000 characters');
    if (kind === 'task') {
      if (req.body.taskType !== undefined && !['auto', 'website', 'document'].includes(req.body.taskType)) throw projectError('taskType must be auto, website, or document');
      if (req.body.outputPath !== undefined) validateDocumentPath(req.body.outputPath);
    }
    if (req.body.budget !== undefined) {
      if (!Number.isFinite(req.body.budget) || req.body.budget < 0) throw projectError('Invalid budget');
      budgetService.allocateBudget(req.body.budget, agentRegistry);
    }
    let projectId = req.body.projectId;
    if (!projectId) {
      if (kind === 'feedback') throw projectError('Select a project to edit');
      projectId = (await createProject({ name: req.body.projectName || text.slice(0, 60), prompt: text })).id;
    } else if (!await getProject(projectId)) throw projectError('Project not found', 404);
    const budget = budgetService.getBudget();
    const spent = budgetService.getProjectSpend(projectId);
    if (budget > 0 && spent >= budget) return res.status(402).json({ status: 'budget_exhausted', error: 'Project budget reached. Increase it to continue.', budget, spent });
    const runId = typeof req.body.runId === 'string' && /^[\w-]{1,80}$/.test(req.body.runId) ? req.body.runId : undefined;
    const args = { projectId, prompt: text, feedback: text, runId, taskType: req.body.taskType, outputPath: req.body.outputPath };
    const result = await (kind === 'task' ? orchestrator.executeTask(args) : kind === 'feedback' ? orchestrator.applyFeedback(args) : kind === 'spec' ? orchestrator.executeSpecificationPipeline(args) : orchestrator.buildFullProject(args));
    // File contents are available from file APIs; do not duplicate every binary in JSON.
    const { files, project, rawOutput, ...data } = result;
    res.json({ status: 'success', projectId, data });
  }));
}

router.post('/gateway/test', asyncRoute(async (req, res) => {
  const result = await modelGateway.generate({ modelId: req.body.modelId || 'kimi-k3', messages: [{ role: 'user', content: req.body.prompt || 'Confirm the gateway is working.' }], parameters: { stream: false } });
  res.json({ status: 'success', data: result });
}));
router.get('/gateway/test-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();
  const send = (event, data) => {
    if (!res.destroyed && !res.writableEnded) {
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) {}
    }
  };
  res.on('error', () => {});
  req.on('error', () => {});
  try {
    const result = await modelGateway.generate({ modelId: req.query.modelId || 'kimi-k3', messages: [{ role: 'user', content: req.query.prompt || 'Say hello.' }], onChunk: chunk => send('chunk', chunk), onStateChange: (state, details) => send('state', { state, details }) });
    send('completed', result);
  } catch (err) { send('error', { message: err.message }); }
  if (!res.destroyed && !res.writableEnded) {
    try { res.end(); } catch (_) {}
  }
});

router.get('/preview', (req, res) => {
  res.type('html').send('<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project preview</title></head><body style="font:16px system-ui;padding:48px;background:#f8fafc;color:#334155"><h2>Your project preview</h2><p>Create or import a website, then select it to preview its pages and assets.</p></body></html>');
});
