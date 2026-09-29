import express from 'express';
import fs from 'fs/promises';
import { config, validateConfig } from '../config/env.js';
import { MODEL_REGISTRY, MODEL_POLICIES } from '../config/models.js';
import { modelGateway } from '../gateway/modelGateway.js';
import { agentRegistry } from '../agents/agentRegistry.js';
import { orchestrator } from '../orchestrator/orchestrator.js';
import { listProjects, getProject, getProjectHtml, createProject } from '../services/projectService.js';

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
  const { projectId, feedback } = req.body;
  if (!feedback) return res.status(400).json({ error: 'Feedback message is required' });

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

// Live Preview content endpoint (defaults to workspace/index.html or active project)
router.get('/preview', async (req, res) => {
  try {
    const content = await fs.readFile(config.workspaceIndexHtml, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(content);
  } catch (error) {
    res.status(500).send(`<h3>Error reading preview file: ${error.message}</h3>`);
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

