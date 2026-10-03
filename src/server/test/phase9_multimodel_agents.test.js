import assert from 'node:assert';
import test from 'node:test';
import { OpenRouterProvider } from '../providers/openrouterProvider.js';
import { MistralProvider } from '../providers/mistralProvider.js';
import { providerRegistry } from '../providers/providerRegistry.js';
import { MODEL_REGISTRY, getModelConfig } from '../config/models.js';
import { AgentRegistry, agentRegistry } from '../agents/agentRegistry.js';

test('Phase 9: Multi-Model Tiers & Model Provider Contracts', async (t) => {
  // 1. Mistral Provider & Codestral Latest (Primary Free/Budget Tier)
  await t.test('1. Mistral Provider initialization & error classification', () => {
    const mistral = new MistralProvider('test-mistral-key');
    assert.strictEqual(mistral.name, 'mistral');
    assert.strictEqual(mistral.apiKey, 'test-mistral-key');

    // Verify ProviderRegistry contains mistral
    const registeredProvider = providerRegistry.get('mistral');
    assert.ok(registeredProvider instanceof MistralProvider);

    // Verify retry classification
    const rateLimitError = new Error('Rate limit');
    rateLimitError.status = 429;
    assert.strictEqual(mistral.isRetryableError(rateLimitError), true);

    const serverError = new Error('Server error');
    serverError.status = 500;
    assert.strictEqual(mistral.isRetryableError(serverError), true);

    const badRequestError = new Error('Bad request');
    badRequestError.status = 400;
    assert.strictEqual(mistral.isRetryableError(badRequestError), false);

    // Verify codestral-latest config
    const codestral = getModelConfig('codestral-latest');
    assert.ok(codestral, 'Codestral Latest model is registered');
    assert.strictEqual(codestral.provider, 'mistral');
    assert.strictEqual(codestral.costPerCall, 0.00);
    assert.strictEqual(codestral.speed, 'fast');
    assert.strictEqual(codestral.tier, 'budget');
  });

  // 2. OpenRouter Provider
  await t.test('2. OpenRouter Provider initialization & error classification', () => {
    const openrouter = new OpenRouterProvider('test-openrouter-key');
    assert.strictEqual(openrouter.name, 'openrouter');
    assert.strictEqual(openrouter.apiKey, 'test-openrouter-key');

    // Verify ProviderRegistry contains openrouter
    const registeredProvider = providerRegistry.get('openrouter');
    assert.ok(registeredProvider instanceof OpenRouterProvider);

    // Verify retry classification
    const rateLimitError = new Error('Rate limit');
    rateLimitError.status = 429;
    assert.strictEqual(openrouter.isRetryableError(rateLimitError), true);

    const serverError = new Error('Service Unavailable');
    serverError.status = 503;
    assert.strictEqual(openrouter.isRetryableError(serverError), true);

    const badRequestError = new Error('Invalid prompt');
    badRequestError.status = 400;
    assert.strictEqual(openrouter.isRetryableError(badRequestError), false);
  });

  // 2. 3-Tier Model Registry: OpenRouter (Budget), NVIDIA (Standard), Gemini (Premium)
  await t.test('2. 3-Tier Model Registry with pricing and speed metadata', () => {
    // OpenRouter (Free / Budget)
    const qwen = getModelConfig('qwen-3.8-27b');
    assert.ok(qwen, 'Qwen 3.8 27B model is registered');
    assert.strictEqual(qwen.provider, 'openrouter');
    assert.strictEqual(qwen.costPerCall, 0.00);
    assert.strictEqual(qwen.speed, 'slow');
    assert.strictEqual(qwen.tier, 'budget');

    // NVIDIA NIM (Standard)
    const kimi = getModelConfig('kimi-k3');
    assert.ok(kimi, 'Kimi K3 model is registered');
    assert.strictEqual(kimi.provider, 'nvidia');
    assert.strictEqual(kimi.costPerCall, 0.05);
    assert.strictEqual(kimi.speed, 'medium');
    assert.strictEqual(kimi.tier, 'standard');

    // Gemini Flash Lite (Premium / Fastest)
    const gemini = getModelConfig('gemini-3.5-flash-lite');
    assert.ok(gemini, 'Gemini 3.5 Flash Lite is registered');
    assert.strictEqual(gemini.provider, 'gemini');
    assert.strictEqual(gemini.costPerCall, 0.10);
    assert.strictEqual(gemini.speed, 'fastest');
    assert.strictEqual(gemini.tier, 'premium');
  });

  // 3. Unique Agent IDs & Dynamic Scaling (e.g. designer-1, designer-2)
  await t.test('3. Unique Agent IDs and dynamic collision-free instantiation', () => {
    const registry = new AgentRegistry();

    // Default agents must have unique sequential IDs
    const designer1 = registry.getAgent('designer-1');
    assert.ok(designer1, 'designer-1 exists');
    assert.strictEqual(designer1.id, 'designer-1');

    const coder1 = registry.getAgent('coder-1');
    assert.ok(coder1, 'coder-1 exists');
    assert.strictEqual(coder1.id, 'coder-1');

    // Backward-compatible alias resolution
    assert.strictEqual(registry.getAgent('designer'), designer1, 'Alias "designer" maps to designer-1');
    assert.strictEqual(registry.getAgent('coding_agent'), coder1, 'Alias "coding_agent" maps to coder-1');
    assert.strictEqual(registry.getAgent('qa').id, 'qa-1', 'Alias "qa" maps to qa-1');
    assert.strictEqual(registry.getAgent('frontend_architect').id, 'frontend-1', 'Alias "frontend_architect" maps to frontend-1');

    // Generate next unique sequential ID
    const nextDesignerId = registry.generateNextAgentId('designer');
    assert.strictEqual(nextDesignerId, 'designer-2');

    // Dynamically create a second designer (e.g., designer-2 for budget tier)
    const designer2 = registry.createAgentInstance({
      role: 'designer',
      model: 'qwen-3.8-27b',
    });

    assert.strictEqual(designer2.id, 'designer-2');
    assert.strictEqual(designer2.modelId, 'qwen-3.8-27b');
    assert.notStrictEqual(designer1.id, designer2.id);

    // Verify designer-2 is retrievable by its unique ID
    const fetchedDesigner2 = registry.getAgent('designer-2');
    assert.strictEqual(fetchedDesigner2.id, 'designer-2');

    // Next ID should now be designer-3
    assert.strictEqual(registry.generateNextAgentId('designer'), 'designer-3');
  });
});
