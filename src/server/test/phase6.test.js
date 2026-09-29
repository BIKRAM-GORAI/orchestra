import assert from 'node:assert';
import test from 'node:test';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import { AgentRegistry } from '../agents/agentRegistry.js';
import { createProject, getProject } from '../services/projectService.js';

test('Phase 6: QA Agent Audit - Passed Validation', async () => {
  const registry = new AgentRegistry();
  const orchestrator = new Orchestrator(registry);

  const project = await createProject({
    name: 'QA Audit Pass Project',
    prompt: 'Create clean sports page',
  });

  const mockGateway = {
    async generate() {
      return {
        text: JSON.stringify({
          agent: 'qa',
          status: 'completed',
          result: 'passed',
          summary: {
            score: 100,
            verdict: 'Complete and fully functional single-page implementation',
            verified_requirements: ['dark theme', 'interactive cart', 'responsive design'],
          },
          issues: [],
        }),
        reasoningText: 'Audited DOM and JavaScript elements',
        model: 'moonshotai/kimi-k3',
        durationMs: 8,
        attempts: 1,
      };
    },
  };

  const qaEvents = [];
  orchestrator.on('pipeline', (ev) => qaEvents.push(ev.stage));

  const report = await orchestrator.audit({
    projectId: project.id,
    userPrompt: 'Create clean sports page',
    unifiedSpec: { user_requirements: ['cart'] },
    htmlContent: '<!DOCTYPE html><html><body><div id="cart"></div></body></html>',
    gateway: mockGateway,
  });

  assert.strictEqual(report.agent, 'qa');
  assert.strictEqual(report.result, 'passed');
  assert.strictEqual(report.issues.length, 0);
  assert.ok(qaEvents.includes('QA_STARTED'));
  assert.ok(qaEvents.includes('QA_COMPLETED'));

  // Check saved in project.json
  const savedProject = await getProject(project.id);
  assert.ok(savedProject.qaReport, 'qaReport persisted in project.json');
  assert.strictEqual(savedProject.qaReport.result, 'passed');
});

test('Phase 6: QA Agent Audit - Issues Detected', async () => {
  const registry = new AgentRegistry();
  const orchestrator = new Orchestrator(registry);

  const project = await createProject({
    name: 'QA Audit Issues Project',
    prompt: 'Create page with missing features',
  });

  const mockGateway = {
    async generate() {
      return {
        text: JSON.stringify({
          agent: 'qa',
          status: 'completed',
          result: 'issues_found',
          summary: {
            score: 75,
            verdict: 'Minor functional gaps identified',
          },
          issues: [
            {
              severity: 'medium',
              category: 'functionality',
              description: 'Cart total does not update dynamically when item quantity changes',
              location: 'function updateCart()',
              recommendation: 'Recalculate subtotal inside updateCart and write to #cart-total DOM element',
            },
          ],
        }),
        reasoningText: 'Identified missing subtotal calculation',
        model: 'moonshotai/kimi-k3',
        durationMs: 9,
        attempts: 1,
      };
    },
  };

  const report = await orchestrator.audit({
    projectId: project.id,
    userPrompt: 'Create page with cart',
    unifiedSpec: { user_requirements: ['cart total'] },
    htmlContent: '<!DOCTYPE html><html><body><div id="cart"></div></body></html>',
    gateway: mockGateway,
  });

  assert.strictEqual(report.result, 'issues_found');
  assert.strictEqual(report.issues.length, 1);
  assert.strictEqual(report.issues[0].severity, 'medium');

  // Verify persistence in project.json
  const savedProject = await getProject(project.id);
  assert.strictEqual(savedProject.qaReport.issues.length, 1);
});
