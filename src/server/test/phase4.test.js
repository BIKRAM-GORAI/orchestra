import assert from 'node:assert';
import test from 'node:test';
import fs from 'fs/promises';
import path from 'path';
import { Orchestrator, extractHtmlFromCodingResult } from '../orchestrator/orchestrator.js';
import { AgentRegistry } from '../agents/agentRegistry.js';
import { createProject, getProjectHtml, getProject } from '../services/projectService.js';
import { config } from '../config/env.js';

test('Phase 4: HTML Extraction Utility Resilience', () => {
  // 1. Structured file.content
  const html1 = extractHtmlFromCodingResult({ file: { content: '<html><body>Test 1</body></html>' } });
  assert.ok(html1.includes('<!DOCTYPE html>'));
  assert.ok(html1.includes('Test 1'));

  // 2. Structured artifact.content
  const html2 = extractHtmlFromCodingResult({ artifact: { content: '<!DOCTYPE html><html><body>Test 2</body></html>' } });
  assert.strictEqual(html2, '<!DOCTYPE html><html><body>Test 2</body></html>');

  // 3. Raw text in markdown code fence
  const html3 = extractHtmlFromCodingResult(null, 'Here is the website:\n```html\n<!DOCTYPE html><html><body>Test 3</body></html>\n```');
  assert.ok(html3.includes('Test 3'));

  // 4. Raw text without fence
  const html4 = extractHtmlFromCodingResult(null, '<!DOCTYPE html><html><body>Test 4</body></html>');
  assert.ok(html4.includes('Test 4'));
});

test('Phase 4: Coding Agent Implementation & Project Persistence', async () => {
  const registry = new AgentRegistry();
  const orchestrator = new Orchestrator(registry);

  const project = await createProject({
    name: 'Coding Agent Test',
    prompt: 'Create a dark sports ecommerce page',
  });

  const generatedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sports Store</title>
  <style>
    body { background: #08090e; color: #fff; font-family: sans-serif; }
    .hero { padding: 40px; text-align: center; }
  </style>
</head>
<body>
  <div class="hero"><h1>Sports Gear Online</h1></div>
  <script>console.log('App ready');</script>
</body>
</html>`;

  const mockGateway = {
    async generate() {
      return {
        text: JSON.stringify({
          agent: 'coding_agent',
          status: 'completed',
          file: {
            path: 'index.html',
            content: generatedHtml,
          },
          summary: {
            key_features_implemented: ['Hero banner', 'Dark theme styling'],
          },
        }),
        reasoningText: 'Generated website index.html',
        model: 'moonshotai/kimi-k3',
        durationMs: 12,
        attempts: 1,
      };
    },
  };

  const codingEvents = [];
  orchestrator.on('pipeline', (ev) => codingEvents.push(ev.stage));

  const result = await orchestrator.implement({
    projectId: project.id,
    userPrompt: 'Create a dark sports ecommerce page',
    unifiedSpec: { project: { name: 'Sports Store' } },
    gateway: mockGateway,
  });

  assert.strictEqual(result.htmlContent, generatedHtml);
  assert.ok(codingEvents.includes('CODING_AGENT_STARTED'));
  assert.ok(codingEvents.includes('CODING_AGENT_COMPLETED'));

  // Verify persistence in isolated project folder
  const savedProjectHtml = await getProjectHtml(project.id);
  assert.strictEqual(savedProjectHtml, generatedHtml);

  // Multi-file builds commit an isolated project revision, not a global workspace.
  assert.strictEqual((await getProject(project.id)).revision, 1);
});

test('Phase 4: End-to-End Build Pipeline (Spec + Coding Agent)', async () => {
  const registry = new AgentRegistry();
  const orchestrator = new Orchestrator(registry);

  const project = await createProject({
    name: 'E2E Build Test',
    prompt: 'Build sports site',
  });

  const sampleHtml = `<!DOCTYPE html><html><body><h1>E2E Success</h1></body></html>`;

  const mockGateway = {
    async generate({ messages }) {
      const msgStr = JSON.stringify(messages);
      if (msgStr.includes('synthesize the specialist specifications')) {
        return {
          text: JSON.stringify({
            agent: 'manager',
            status: 'completed',
            unified_specification: { project: { name: 'E2E Build' }, user_requirements: ['sports'] },
          }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 5,
          attempts: 1,
        };
      }
      if (msgStr.includes('Analyze the following user goal')) {
        return {
          text: JSON.stringify({
            agent: 'manager',
            status: 'completed',
            project: { name: 'E2E Build' },
            explicit_requirements: ['sports'],
            selected_agents: ['designer'],
          }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 5,
          attempts: 1,
        };
      }
      if (msgStr.includes('visual direction')) {
        return {
          text: JSON.stringify({ agent: 'designer', status: 'completed', design: { colors: { primary: '#6366f1' } } }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 5,
          attempts: 1,
        };
      }
      if (msgStr.includes('Generate the complete')) {
        return {
          text: JSON.stringify({
            agent: 'coding_agent',
            status: 'completed',
            file: { path: 'index.html', content: sampleHtml },
          }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 10,
          attempts: 1,
        };
      }
      if (msgStr.includes('Audit the generated multi-file website')) {
        return {
          text: JSON.stringify({
            agent: 'qa',
            status: 'completed',
            result: 'passed',
            issues: [],
          }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 5,
          attempts: 1,
        };
      }
      throw new Error(`Unexpected message in E2E mock: ${msgStr}`);
    },
  };

  const result = await orchestrator.buildFullProject({
    projectId: project.id,
    prompt: 'Build sports site',
    gateway: mockGateway,
  });

  assert.strictEqual(result.htmlContent, sampleHtml);
  assert.ok(result.unifiedSpec);

  // Check isolated project has index.html saved
  const savedHtml = await getProjectHtml(project.id);
  assert.strictEqual(savedHtml, sampleHtml);
});
