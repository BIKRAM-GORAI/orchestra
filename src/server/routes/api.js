import express from 'express';
import fs from 'fs/promises';
import { config, validateConfig } from '../config/env.js';
import { MODEL_REGISTRY, MODEL_POLICIES } from '../config/models.js';
import { modelGateway } from '../gateway/modelGateway.js';
import { agentRegistry } from '../agents/agentRegistry.js';
import { orchestrator } from '../orchestrator/orchestrator.js';
import { listProjects, getProject, getProjectHtml, createProject, getProjectFiles, getProjectFileContent } from '../services/projectService.js';
import { budgetService, BUDGET_TIERS } from '../services/budgetService.js';

export const router = express.Router();

// Health & Environment status
router.get('/health', (req, res) => {
  const { warnings } = validateConfig();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasNvidiaKey: Boolean(config.nvidiaApiKey),
      hasGeminiKey: Boolean(config.geminiApiKey),
      hasOpenRouterKey: Boolean(config.openrouterApiKey),
      defaultModel: 'gemini-3.5-flash',
      port: config.port,
    },
    warnings,
  });
});

// Models configuration endpoint
router.get('/models', (req, res) => {
  res.json({
    models: Object.values(MODEL_REGISTRY).map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      model: m.model,
      tier: m.tier,
      speed: m.speed,
      costPerCall: m.costPerCall,
      costDisplay: m.costDisplay,
      capabilities: m.capabilities,
    })),
    policy: MODEL_POLICIES.default,
  });
});

// Agents Registry endpoints
router.get('/agents', (req, res) => {
  res.json({
    agents: agentRegistry.toJSON(),
  });
});

// Dynamic agent creation endpoint
router.post('/agents/create', (req, res) => {
  const { role, model, id } = req.body;
  try {
    const newAgent = agentRegistry.createAgentInstance({ role, model, id });
    res.json({
      status: 'success',
      agent: newAgent.toJSON(),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update agent configuration (model and fallback chain)
router.put('/agents/:id/config', (req, res) => {
  const { modelId, fallbackModels } = req.body;
  try {
    const updated = agentRegistry.updateAgentConfig(req.params.id, { modelId, fallbackModels });
    res.json({
      status: 'success',
      agent: updated.toJSON(),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/agents/:id/model', (req, res) => {
  const { modelId } = req.body;
  try {
    const updated = agentRegistry.updateAgentModel(req.params.id, modelId);
    res.json({
      status: 'success',
      agent: updated.toJSON(),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Budget Status and Allocation endpoints
router.get('/budget/status', (req, res) => {
  const projectId = req.query.projectId;
  res.json({
    currentBudget: budgetService.getBudget(),
    projectSpend: projectId ? budgetService.getProjectSpend(projectId) : 0,
    tiers: BUDGET_TIERS,
    models: Object.values(MODEL_REGISTRY).map(m => ({
      id: m.id,
      name: m.name,
      tier: m.tier,
      speed: m.speed,
      costPerCall: m.costPerCall,
      costDisplay: m.costDisplay,
    })),
  });
});

router.post('/budget/allocate', (req, res) => {
  const { budget, tier } = req.body;
  let targetAmount = budget;
  if (targetAmount === undefined && tier) {
    targetAmount = BUDGET_TIERS[tier.toUpperCase()]?.maxBudget ?? 0.25;
  }
  const result = budgetService.allocateBudget(targetAmount, agentRegistry);
  orchestrator.emitPipelineEvent('BUDGET_ALLOCATED', result);
  res.json({
    status: 'success',
    ...result,
  });
});

// Real-time Orchestration Event Stream (SSE)
router.get('/orchestrate/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const onAgentState = (ev) => {
    res.write(`event: agentState\ndata: ${JSON.stringify(ev)}\n\n`);
  };

  const onPipelineEvent = (ev) => {
    res.write(`event: pipeline\ndata: ${JSON.stringify(ev)}\n\n`);
  };

  orchestrator.on('agentState', onAgentState);
  orchestrator.on('pipeline', onPipelineEvent);

  // Keep connection open with heartbeat
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);
  heartbeat.unref();

  req.on('close', () => {
    clearInterval(heartbeat);
    orchestrator.off('agentState', onAgentState);
    orchestrator.off('pipeline', onPipelineEvent);
  });
});

// Phase 3: Specification Pipeline Endpoint
router.post('/orchestrate/spec', async (req, res) => {
  const { prompt, projectId, projectName } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    let targetProjectId = projectId;
    if (!targetProjectId) {
      const newProj = await createProject({
        name: projectName || prompt.slice(0, 30),
        prompt,
      });
      targetProjectId = newProj.id;
    }

    const result = await orchestrator.executeSpecificationPipeline({
      projectId: targetProjectId,
      prompt,
    });

    res.json({
      status: 'success',
      projectId: targetProjectId,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

// Phase 4: Full End-to-End Build Pipeline (Spec + Coding Agent)
router.post('/orchestrate/build', async (req, res) => {
  const { prompt, projectId, projectName, budget } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  if (budget !== undefined) {
    budgetService.allocateBudget(budget, agentRegistry);
  }

  let targetProjectId = projectId;
  if (targetProjectId) {
    const currentBudget = budgetService.getBudget();
    const currentSpend = budgetService.getProjectSpend(targetProjectId);
    if (currentBudget > 0 && currentSpend >= currentBudget) {
      return res.status(402).json({
        status: 'budget_exhausted',
        error: 'Budget limit reached. Please increase your project budget to perform additional builds.',
        spent: currentSpend,
        budget: currentBudget,
      });
    }
  }

  try {
    let targetProjectId = projectId;
    if (!targetProjectId) {
      const newProj = await createProject({
        name: projectName || prompt.slice(0, 30),
        prompt,
      });
      targetProjectId = newProj.id;
    }

    const result = await orchestrator.buildFullProject({
      projectId: targetProjectId,
      prompt,
    });

    res.json({
      status: 'success',
      projectId: targetProjectId,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

// Phase 7: Human Feedback Endpoint (Direct-to-Coder with Minimal Change Preservation)
router.post('/orchestrate/feedback', async (req, res) => {
  const { projectId, feedback, budget } = req.body;
  if (!feedback) return res.status(400).json({ error: 'Feedback message is required' });

  if (budget !== undefined) {
    budgetService.allocateBudget(budget, agentRegistry);
  }

  try {
    let targetProjectId = projectId;
    if (!targetProjectId) {
      const projects = await listProjects();
      if (projects.length > 0) {
        targetProjectId = projects[0].id;
      } else {
        return res.status(400).json({ error: 'No active project found to modify' });
      }
    }

    const currentBudget = budgetService.getBudget();
    const currentSpend = budgetService.getProjectSpend(targetProjectId);
    if (currentBudget > 0 && currentSpend >= currentBudget) {
      return res.status(402).json({
        status: 'budget_exhausted',
        error: 'Budget limit reached. Please increase your project budget to apply further edits.',
        spent: currentSpend,
        budget: currentBudget,
      });
    }

    const result = await orchestrator.applyFeedback({
      projectId: targetProjectId,
      feedback,
    });

    res.json({
      status: 'success',
      projectId: targetProjectId,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});


// Gateway Test Endpoint (POST JSON)
router.post('/gateway/test', async (req, res) => {
  const { prompt = 'Hello! Confirm you are Kimi K3 running through the NVIDIA NIM gateway.', modelId = 'kimi-k3' } = req.body;
  try {
    const result = await modelGateway.generate({
      modelId,
      messages: [{ role: 'user', content: prompt }],
      parameters: { stream: false },
    });
    res.json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
      details: err.originalError?.message || null,
    });
  }
});

// Gateway Test Streaming Endpoint (SSE)
router.get('/gateway/test-stream', async (req, res) => {
  const prompt = req.query.prompt || 'Write a 2-sentence greeting confirming the Model Gateway streaming pipeline works.';
  const modelId = req.query.modelId || 'kimi-k3';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent('start', { modelId, prompt });

    const result = await modelGateway.generate({
      modelId,
      messages: [{ role: 'user', content: prompt }],
      onStateChange: (state, details) => {
        sendEvent('state', { state, details });
      },
      onChunk: (chunk) => {
        sendEvent('chunk', {
          delta: chunk.delta,
          accumulated: chunk.accumulatedText,
          reasoningDelta: chunk.reasoningDelta,
        });
      },
    });

    sendEvent('completed', {
      text: result.text,
      model: result.model,
      durationMs: result.durationMs,
      attempts: result.attempts,
    });
    res.end();
  } catch (err) {
    sendEvent('error', {
      message: err.message,
    });
    res.end();
  }
});

// Projects Management Endpoints
router.get('/projects', async (req, res) => {
  try {
    const projects = await listProjects();
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects', async (req, res) => {
  try {
    const { name, prompt } = req.body;
    const project = await createProject({ name, prompt });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/preview', async (req, res) => {
  try {
    if (req.query.starter !== 'true') {
      const projects = await listProjects();
      if (projects.length > 0) {
        const html = await getProjectHtml(projects[0].id);
        if (html) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(html);
        }
      }
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New Project Setup | Agent Orchestra</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #F8FAFC;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      color: #0F172A;
    }
    .starter-card {
      text-align: center;
      max-width: 520px;
      padding: 40px 32px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
    }
    .starter-badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #2563EB;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      padding: 4px 10px;
      border-radius: 6px;
      margin-bottom: 16px;
    }
    h2 {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0 0 10px 0;
      color: #0F172A;
    }
    p {
      font-size: 0.88rem;
      color: #64748B;
      line-height: 1.6;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="starter-card">
    <span class="starter-badge">BRAND NEW SETUP</span>
    <h2>Ready for Project Directives</h2>
    <p>Type your vision in the prompt dispatcher (e.g. <em>"Create a modern agency website for KARVAAN LABS..."</em>) and click <strong>Launch</strong> to assemble the specialist team and generate your application.</p>
  </div>
</body>
</html>`);
  } catch (err) {
    res.status(500).send(`<h3>Error reading preview: ${err.message}</h3>`);
  }
});

router.get('/projects/:id/preview', async (req, res) => {
  try {
    const html = await getProjectHtml(req.params.id);
    if (!html) return res.status(404).send('<h3>Project preview not found</h3>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`<h3>Error reading project: ${err.message}</h3>`);
  }
});

router.get('/projects/:id/files', async (req, res) => {
  try {
    const files = await getProjectFiles(req.params.id);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id/files/:filename(*)', async (req, res) => {
  try {
    const filename = req.params.filename || req.params[0];
    const content = await getProjectFileContent(req.params.id, filename);
    if (content === null) return res.status(404).json({ error: 'File not found' });
    res.json({ filename, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


