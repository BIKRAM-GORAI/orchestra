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
  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash (Google AI)',
    provider: PROVIDERS.GEMINI,
    model: 'gemini-3.5-flash',
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
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite',
    defaultParameters: {
      max_tokens: 32768,
      temperature: 0.7,
      stream: true,
    },
    capabilities: ['chat', 'coding', 'streaming'],
  },
  'kimi-k3': {
    id: 'kimi-k3',
    name: 'Kimi K3 (NVIDIA NIM)',
    provider: PROVIDERS.NVIDIA,
    model: 'moonshotai/kimi-k3',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    defaultParameters: {
      max_tokens: 16384,
      temperature: 1,
      reasoning_effort: 'max',
      stream: true,
    },
    capabilities: ['chat', 'reasoning', 'coding', 'streaming'],
  },
};

/**
 * Model Routing & Fallback Policies
 * Primary: gemini-3.5-flash
 * Fallback: gemini-3.5-flash-lite
 */
export const MODEL_POLICIES = {
  default: {
    primary: 'gemini-3.5-flash',
    fallback: ['gemini-3.5-flash-lite'],
    retry: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffFactor: 2,
      maxDelayMs: 6000,
      timeoutMs: 120000,
    },
  },
};

export function getModelConfig(modelId = 'gemini-3.5-flash') {
  const model = MODEL_REGISTRY[modelId];
  if (!model) {
    throw new Error(`Unknown model ID: "${modelId}". Available models: ${Object.keys(MODEL_REGISTRY).join(', ')}`);
  }
  return model;
}

export function getModelPolicy(policyName = 'default') {
  return MODEL_POLICIES[policyName] || MODEL_POLICIES.default;
}
