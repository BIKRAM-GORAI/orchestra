import { test } from 'node:test';
import assert from 'node:assert';
import { budgetService, BUDGET_TIERS } from '../services/budgetService.js';
import { AgentRegistry } from '../agents/agentRegistry.js';
import { ModelGateway } from '../gateway/modelGateway.js';
import { BaseAgent } from '../agents/baseAgent.js';
import { MODEL_REGISTRY } from '../config/models.js';

test('Phase 10: Budget Allocation Engine & Model Fallback Routing', async (t) => {

  await t.test('1. Budget Allocation: Free Tier ($0.00) sets all agents to Codestral Latest free', () => {
    const registry = new AgentRegistry();
    const result = budgetService.allocateBudget(0.00, registry);

    assert.strictEqual(result.tier, 'free');
    assert.strictEqual(result.budget, 0.00);
    assert.strictEqual(result.estimatedCost, 0.00);

    const agents = registry.getAllAgents();
    for (const agent of agents) {
      assert.strictEqual(agent.modelId, 'codestral-latest', `Agent ${agent.id} should be allocated codestral-latest`);
      assert.ok(agent.fallbackModels.includes('kimi-k3'));
    }
  });

  await t.test('2. Budget Allocation: Balanced Tier ($0.25) optimizes Manager, Coder, and Specialists', () => {
    const registry = new AgentRegistry();
    const result = budgetService.allocateBudget(0.25, registry);

    assert.strictEqual(result.tier, 'balanced');
    assert.strictEqual(result.budget, 0.25);
    assert.ok(result.estimatedCost > 0 && result.estimatedCost <= 0.35);

    const manager = registry.getAgent('manager-1');
    const coder = registry.getAgent('coder-1');
    assert.ok(manager.modelId === 'gemini-3.5-flash-lite' || manager.modelId === 'kimi-k3');
    assert.ok(coder.modelId === 'kimi-k3' || coder.modelId === 'gemini-3.5-flash-lite');
  });

  await t.test('3. Budget Allocation: Premium Tier ($0.60) allocates high-speed Gemini and Kimi K3', () => {
    const registry = new AgentRegistry();
    const result = budgetService.allocateBudget(0.60, registry);

    assert.strictEqual(result.tier, 'premium');
    assert.strictEqual(result.budget, 0.60);

    const manager = registry.getAgent('manager-1');
    const coder = registry.getAgent('coder-1');
    assert.strictEqual(manager.modelId, 'gemini-3.5-flash-lite');
    assert.strictEqual(coder.modelId, 'gemini-3.5-flash-lite');
  });

  await t.test('4. Model Gateway Fallback Chain: Falls back to secondary model when primary fails', async () => {
    const gateway = new ModelGateway();

    // Mock provider registry with a failing primary provider and working fallback provider
    let primaryAttemptCount = 0;
    let fallbackAttemptCount = 0;

    const mockPrimaryProvider = {
      isRetryableError: () => false,
      generate: async () => {
        primaryAttemptCount++;
        throw new Error('Primary upstream provider 500 Outage');
      },
    };

    const mockFallbackProvider = {
      isRetryableError: () => false,
      generate: async ({ messages }) => {
        fallbackAttemptCount++;
        return {
          text: JSON.stringify({ message: 'Fallback succeeded successfully' }),
          reasoningText: 'Fallback reasoning',
          model: 'qwen/qwen-2.5-72b-instruct:free',
          usage: { promptTokens: 10, completionTokens: 20 },
        };
      },
    };

    // Temporarily register mocks
    gateway.providerRegistry = {
      get: (providerName) => {
        if (providerName === 'nvidia') return mockPrimaryProvider;
        if (providerName === 'openrouter') return mockFallbackProvider;
        return mockFallbackProvider;
      },
    };

    const fallbackEvents = [];
    const result = await gateway.generate({
      modelId: 'kimi-k3', // primary (nvidia -> fails)
      fallbackModels: ['qwen-3.8-27b'], // fallback (openrouter -> succeeds)
      messages: [{ role: 'user', content: 'test prompt' }],
      onStateChange: (state, details) => {
        if (state === 'fallback') fallbackEvents.push(details);
      },
    });

    assert.strictEqual(primaryAttemptCount, 1, 'Primary should have been attempted once');
    assert.strictEqual(fallbackAttemptCount, 1, 'Fallback should have executed');
    assert.strictEqual(fallbackEvents.length, 1, 'One fallback event should be emitted');
    assert.strictEqual(fallbackEvents[0].from, 'kimi-k3');
    assert.strictEqual(fallbackEvents[0].to, 'qwen-3.8-27b');
    assert.strictEqual(result.modelId, 'qwen-3.8-27b');
    assert.strictEqual(result.cost, 0.00);
  });

  await t.test('5. BaseAgent Fallback Event Emission & Output Tracking', async () => {
    const gateway = new ModelGateway();
    gateway.providerRegistry = {
      get: (providerName) => ({
        isRetryableError: () => false,
        generate: async () => ({
          text: 'agent response',
          reasoningText: '',
          model: 'qwen/qwen-2.5-72b-instruct:free',
        }),
      }),
    };

    const agent = new BaseAgent({
      id: 'designer-2',
      name: 'Pixel Two',
      model: 'qwen-3.8-27b',
      fallbackModels: ['kimi-k3', 'gemini-3.5-flash-lite'],
    });

    assert.deepStrictEqual(agent.fallbackModels, ['kimi-k3', 'gemini-3.5-flash-lite']);
    agent.setFallbackModels(['gemini-3.5-flash-lite']);
    assert.deepStrictEqual(agent.fallbackModels, ['gemini-3.5-flash-lite']);

    const output = await agent.execute({ input: 'generate design', gateway });
    assert.strictEqual(output.rawText, 'agent response');
    assert.strictEqual(output.cost, 0);

    const json = agent.toJSON();
    assert.strictEqual(json.id, 'designer-2');
    assert.strictEqual(json.primaryModel, 'qwen-3.8-27b');
    assert.deepStrictEqual(json.fallbackModels, ['gemini-3.5-flash-lite']);
  });

  await t.test('6. Dynamic Agent Spawning with Unique Sequential IDs', () => {
    const registry = new AgentRegistry();

    // Default starts with designer-1
    assert.ok(registry.getAgent('designer-1'));

    // Spawn second designer
    const designer2 = registry.createAgentInstance({ role: 'designer', model: 'qwen-3.8-27b' });
    assert.strictEqual(designer2.id, 'designer-2');

    // Spawn third designer
    const designer3 = registry.createAgentInstance({ role: 'designer', model: 'kimi-k3' });
    assert.strictEqual(designer3.id, 'designer-3');

    // Spawn second coder
    const coder2 = registry.createAgentInstance({ role: 'coder', model: 'gemini-3.5-flash-lite' });
    assert.strictEqual(coder2.id, 'coder-2');

    // Verify all can be retrieved
    assert.strictEqual(registry.getAgent('designer-2').id, 'designer-2');
    assert.strictEqual(registry.getAgent('designer-3').id, 'designer-3');
    assert.strictEqual(registry.getAgent('coder-2').id, 'coder-2');

    // Update config on dynamically created agent
    registry.updateAgentConfig('designer-2', {
      modelId: 'kimi-k3',
      fallbackModels: ['gemini-3.5-flash-lite', 'qwen-3.8-27b'],
    });
    assert.strictEqual(registry.getAgent('designer-2').modelId, 'kimi-k3');
    assert.deepStrictEqual(registry.getAgent('designer-2').fallbackModels, ['gemini-3.5-flash-lite', 'qwen-3.8-27b']);
  });

  await t.test('7. Project Spend Tracking in BudgetService', () => {
    budgetService.resetProjectSpend('test-project-10');
    assert.strictEqual(budgetService.getProjectSpend('test-project-10'), 0);

    budgetService.recordSpend('test-project-10', 0.10);
    assert.strictEqual(budgetService.getProjectSpend('test-project-10'), 0.10);

    budgetService.recordSpend('test-project-10', 0.05);
    assert.strictEqual(budgetService.getProjectSpend('test-project-10'), 0.15);

    budgetService.recordSpend('test-project-10', 0.00);
    assert.strictEqual(budgetService.getProjectSpend('test-project-10'), 0.15);
  });
});
