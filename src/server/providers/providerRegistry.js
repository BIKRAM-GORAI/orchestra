import { PROVIDERS } from '../config/models.js';
import { NvidiaProvider } from './nvidiaProvider.js';
import { GeminiProvider } from './geminiProvider.js';
import { OpenRouterProvider } from './openrouterProvider.js';
import { MistralProvider } from './mistralProvider.js';

/**
 * Provider Registry
 * 
 * Factory and registry mapping provider IDs to provider instances.
 */
class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    // Register default providers
    this.register(PROVIDERS.NVIDIA, new NvidiaProvider());
    this.register(PROVIDERS.GEMINI, new GeminiProvider());
    this.register(PROVIDERS.OPENROUTER, new OpenRouterProvider());
    this.register(PROVIDERS.MISTRAL, new MistralProvider());
  }

  register(providerName, providerInstance) {
    this.providers.set(providerName, providerInstance);
  }

  get(providerName) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider "${providerName}" is not registered. Registered: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    return provider;
  }
}

export const providerRegistry = new ProviderRegistry();
