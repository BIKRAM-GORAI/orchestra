import assert from 'node:assert';
import test from 'node:test';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import { AgentRegistry } from '../agents/agentRegistry.js';
import { createProject, getProject } from '../services/projectService.js';

test('Phase 3: Manager Decomposition & Agent Selection', async () => {
  const registry = new AgentRegistry();
  const orchestrator = new Orchestrator(registry);

  const mockGateway = {
    async generate({ messages }) {
      return {
        text: JSON.stringify({
          agent: 'manager',
          status: 'completed',
          project: {
            name: 'Sports Ecommerce Website',
            type: 'single_page_web_application',
            summary: 'A dark modern sports store',
          },
          explicit_requirements: ['dark theme', 'product grid', 'cart modal'],
          selected_agents: ['designer', 'frontend_architect', 'feature_architect'],
          tasks: [
            { agent: 'designer', focus: 'dark athletic palette' },
            { agent: 'frontend_architect', focus: 'single index.html structure' },
            { agent: 'feature_architect', focus: 'cart & search behavior' },
          ],
        }),
        reasoningText: 'Plan formulated',
        model: 'moonshotai/kimi-k3',
        durationMs: 10,
        attempts: 1,
      };
    },
  };

  const plan = await orchestrator.plan('Build a modern sports ecommerce website with dark theme and cart', {
    gateway: mockGateway,
  });

  assert.strictEqual(plan.agent, 'manager');
  assert.strictEqual(plan.status, 'completed');
  assert.deepStrictEqual(plan.selected_agents, ['designer', 'frontend_architect', 'feature_architect']);
  assert.ok(plan.explicit_requirements.includes('dark theme'));
});

test('Phase 3: Parallel Specialists Execution', async () => {
  const registry = new AgentRegistry();
  const orchestrator = new Orchestrator(registry);

  const executionLog = [];
  const mockGateway = {
    async generate({ messages }) {
      const msgStr = JSON.stringify(messages);
      if (msgStr.includes('visual direction')) {
        executionLog.push('designer');
        return {
          text: JSON.stringify({
            agent: 'designer',
            status: 'completed',
            design: { theme: 'dark athletic', colors: { primary: '#6366f1', background: '#090a0f' } },
          }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 10,
          attempts: 1,
        };
      }
      if (msgStr.includes('technical architecture')) {
        executionLog.push('frontend_architect');
        return {
          text: JSON.stringify({
            agent: 'frontend_architect',
            status: 'completed',
            dom_structure: ['header#navbar', 'main#product-grid', 'aside#cart-modal'],
          }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 10,
          attempts: 1,
        };
      }
      if (msgStr.includes('behavioral specifications')) {
        executionLog.push('feature_architect');
        return {
          text: JSON.stringify({
            agent: 'feature_architect',
            status: 'completed',
            features: [{ name: 'cart_add', purpose: 'add item to cart', priority: 'required' }],
          }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 10,
          attempts: 1,
        };
      }
      throw new Error(`Unexpected message: ${msgStr}`);
    },
  };

  const plan = {
    explicit_requirements: ['dark theme', 'cart'],
    selected_agents: ['designer', 'frontend_architect', 'feature_architect'],
    project: { name: 'Sports Shop' },
  };

  const specialists = await orchestrator.runSpecialists(plan, 'Build sports shop', { gateway: mockGateway });

  assert.ok(specialists.designer, 'Designer output collected');
  assert.ok(specialists.frontend_architect, 'Frontend Architect output collected');
  assert.ok(specialists.feature_architect, 'Feature Architect output collected');
  assert.strictEqual(specialists.designer.design.theme, 'dark athletic');
  assert.strictEqual(executionLog.length, 3, 'All 3 specialists were executed');
});

test('Phase 3: Manager Synthesis & Project Isolation', async () => {
  const registry = new AgentRegistry();
  const orchestrator = new Orchestrator(registry);

  // Create isolated project
  const project = await createProject({
    name: 'Synthesis Test Project',
    prompt: 'Build test app',
  });

  const mockGateway = {
    async generate({ messages }) {
      const msgStr = JSON.stringify(messages);
      if (msgStr.includes('synthesize the specialist specifications')) {
        return {
          text: JSON.stringify({
            agent: 'manager',
            status: 'completed',
            unified_specification: {
              project: { name: 'Synthesis Test Project' },
              user_requirements: ['test requirement'],
              design_system: { primary_color: '#10b981' },
              technical_architecture: { dom: ['app-root'] },
              features_and_behaviors: [{ name: 'test_feat' }],
              implementation_constraints: ['Strict single index.html'],
            },
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
            project: { name: 'Synthesis Test' },
            explicit_requirements: ['test requirement'],
            selected_agents: ['designer', 'frontend_architect', 'feature_architect'],
          }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 5,
          attempts: 1,
        };
      }
      if (msgStr.includes('visual direction')) {
        return {
          text: JSON.stringify({ agent: 'designer', status: 'completed', design: { colors: { primary: '#10b981' } } }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 5,
          attempts: 1,
        };
      }
      if (msgStr.includes('technical architecture')) {
        return {
          text: JSON.stringify({ agent: 'frontend_architect', status: 'completed', dom_structure: ['app-root'] }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 5,
          attempts: 1,
        };
      }
      if (msgStr.includes('behavioral specifications')) {
        return {
          text: JSON.stringify({ agent: 'feature_architect', status: 'completed', features: [{ name: 'test_feat' }] }),
          reasoningText: '',
          model: 'moonshotai/kimi-k3',
          durationMs: 5,
          attempts: 1,
        };
      }
      throw new Error(`Unexpected message: ${msgStr}`);
    },
  };

  const pipelineEvents = [];
  orchestrator.on('pipeline', (ev) => pipelineEvents.push(ev.stage));

  const result = await orchestrator.executeSpecificationPipeline({
    projectId: project.id,
    prompt: 'Build test app',
    gateway: mockGateway,
  });

  assert.ok(result.unifiedSpec, 'Unified specification produced');
  assert.strictEqual(result.unifiedSpec.design_system.primary_color, '#10b981');
  assert.ok(pipelineEvents.includes('PIPELINE_STARTED'));
  assert.ok(pipelineEvents.includes('MANAGER_PLAN_COMPLETED'));
  assert.ok(pipelineEvents.includes('SPECIALISTS_COMPLETED'));
  assert.ok(pipelineEvents.includes('MANAGER_SYNTHESIS_COMPLETED'));
  assert.ok(pipelineEvents.includes('PIPELINE_COMPLETED'));

  // Verify persistence in isolated project directory
  const savedProject = await getProject(project.id);
  assert.strictEqual(savedProject.status, 'specification_ready');
  assert.ok(savedProject.managerPlan, 'Manager plan saved in project.json');
  assert.ok(savedProject.specialistOutputs.designer, 'Designer output saved in project.json');
  assert.ok(savedProject.unifiedSpec, 'Unified spec saved in project.json');
});
