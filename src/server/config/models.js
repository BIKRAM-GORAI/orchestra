/**
 * Model and Provider Configuration Registry
 * 
 * Separates logical models and providers from agents.
 * Future providers (Gemini, OpenRouter, Anthropic, Ollama) can be added here.
 */

export const PROVIDERS = {
  NVIDIA: 'nvidia',
  // Future providers
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  OLLAMA: 'ollama',
};

export const MODEL_REGISTRY = {
  // Legacy / Default key (Google Gemini - Fastest, Highest Dummy Price Tier)
  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash (Google AI)',
    provider: PROVIDERS.GEMINI,
    model: 'gemini-3.5-flash',
    tier: 'premium',
    speed: 'fastest',
    costPerCall: 0.10,
    costDisplay: '$0.10',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash',
    defaultParameters: {
      max_tokens: 32768,
      temperature: 0.7,
      stream: true,
    },
    capabilities: ['chat', 'reasoning', 'coding', 'streaming'],
  },
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite (Google AI)',
    provider: PROVIDERS.GEMINI,
    model: 'gemini-3.5-flash-lite',
    tier: 'premium',
    speed: 'fastest',
    costPerCall: 0.10,
    costDisplay: '$0.10',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite',
    defaultParameters: {
      max_tokens: 32768,
      temperature: 0.7,
      stream: true,
    },
    capabilities: ['chat', 'coding', 'streaming'],
  },
  // 2. NVIDIA NIM (Medium Speed, Standard Tier)
  'kimi-k3': {
    id: 'kimi-k3',
    name: 'Kimi K3 (NVIDIA NIM)',
    provider: PROVIDERS.NVIDIA,
    model: 'moonshotai/kimi-k3',
    tier: 'standard',
    speed: 'medium',
    costPerCall: 0.05,
    costDisplay: '$0.05',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    defaultParameters: {
      max_tokens: 16384,
      temperature: 1,
      reasoning_effort: 'max',
      stream: true,
    },
    capabilities: ['chat', 'reasoning', 'coding', 'streaming'],
  },
  // 1. OpenRouter (Slowest, Cheapest / Free Tier)
  'qwen-3.8-27b': {
    id: 'qwen-3.8-27b',
    name: 'Qwen 3.8 27B (OpenRouter Free)',
    provider: PROVIDERS.OPENROUTER,
    model: 'qwen/qwen-2.5-72b-instruct:free',
    tier: 'budget',
    speed: 'slow',
    costPerCall: 0.00,
    costDisplay: '$0.00 (Free)',
    defaultParameters: {
      max_tokens: 16384,
      temperature: 0.7,
      stream: true,
    },
    capabilities: ['chat', 'reasoning', 'coding', 'streaming'],
  },
};

/**
 * Model Routing & Fallback Policies
 * Primary: gemini-3.5-flash-lite (Fastest)
 * Fallback 1: kimi-k3 (NVIDIA NIM)
 * Fallback 2: qwen-3.8-27b (OpenRouter Free)
 */
export const MODEL_POLICIES = {
  default: {
    primary: 'gemini-3.5-flash-lite',
    fallback: ['kimi-k3', 'qwen-3.8-27b'],
    retry: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffFactor: 2,
      maxDelayMs: 6000,
      timeoutMs: 120000,
    },
  },
  budget: {
    primary: 'qwen-3.8-27b',
    fallback: ['kimi-k3', 'gemini-3.5-flash-lite'],
    retry: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffFactor: 2,
      maxDelayMs: 6000,
      timeoutMs: 120000,
    },
  },
  standard: {
    primary: 'kimi-k3',
    fallback: ['gemini-3.5-flash-lite', 'qwen-3.8-27b'],
    retry: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffFactor: 2,
      maxDelayMs: 6000,
      timeoutMs: 120000,
    },
  },
  premium: {
    primary: 'gemini-3.5-flash-lite',
    fallback: ['kimi-k3', 'qwen-3.8-27b'],
    retry: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffFactor: 2,
      maxDelayMs: 6000,
      timeoutMs: 120000,
    },
  },
};

export function getModelConfig(modelId = 'gemini-3.5-flash-lite') {
  // Normalize alias
  const normalizedId = modelId === 'gemini-3.5-flash' || modelId === 'gemini' ? 'gemini-3.5-flash-lite'
    : modelId === 'qwen' || modelId === 'qwen3.8' ? 'qwen-3.8-27b'
    : modelId;

  const model = MODEL_REGISTRY[normalizedId] || MODEL_REGISTRY[modelId];
  if (!model) {
    throw new Error(`Unknown model ID: "${modelId}". Available models: ${Object.keys(MODEL_REGISTRY).join(', ')}`);
  }
  return model;
}

export function getModelPolicy(policyName = 'default') {
  return MODEL_POLICIES[policyName] || MODEL_POLICIES.default;
}
