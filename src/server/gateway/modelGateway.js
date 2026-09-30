import { getModelConfig, getModelPolicy } from '../config/models.js';
import { providerRegistry } from '../providers/providerRegistry.js';

/**
 * Model Gateway
 * 
 * Centralized inference hub responsible for:
 * - Model resolution
 * - Provider dispatch
 * - Streaming coordination
 * - Exponential backoff retry handling
 * - Timeout enforcement
 * - Fallback routing (architecture-ready)
 */
export class ModelGateway {
  constructor() {
    this.providerRegistry = providerRegistry;
  }

  /**
   * Helper sleep function for backoff
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Central generation method called by all Agents
   * 
   * @param {Object} options
   * @param {string} [options.modelId='kimi-k3'] - Registered model ID
   * @param {Array<{role: string, content: string}>} options.messages - Chat messages
   * @param {Object} [options.parameters={}] - Parameter overrides
   * @param {Function} [options.onChunk] - Stream callback
   * @param {Function} [options.onStateChange] - State change callback ('thinking', 'streaming', 'retrying', 'error')
   * @param {string} [options.policyName='default'] - Retry & fallback policy
   * @returns {Promise<{text: string, reasoningText: string, model: string, usage: Object, durationMs: number, attempts: number}>}
   */
  async generate({
    modelId = 'kimi-k3',
    fallbackModels = null,
    messages = [],
    parameters = {},
    onChunk = null,
    onStateChange = null,
    policyName = 'default',
  } = {}) {
    const policy = getModelPolicy(policyName);
    const fallbacks = Array.isArray(fallbackModels) && fallbackModels.length > 0
      ? fallbackModels
      : (policy.fallback || []);
    const modelsToTry = [modelId, ...fallbacks.filter(m => m !== modelId)];

    let lastError = null;
    const overallStartTime = Date.now();

    for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex++) {
      const currentModelId = modelsToTry[modelIndex];
      const modelConfig = getModelConfig(currentModelId);
      const provider = this.providerRegistry.get(modelConfig.provider);

      const mergedParams = {
        ...modelConfig.defaultParameters,
        ...parameters,
      };

      const maxAttempts = policy.retry.maxAttempts || 3;
      let attempt = 0;

      while (attempt < maxAttempts) {
        attempt++;
        const attemptStartTime = Date.now();

        // Setup timeout controller with streaming activity watchdog
        const timeoutMs = policy.retry.timeoutMs || 120000;
        const abortController = new AbortController();
        let timeoutId = setTimeout(() => {
          abortController.abort(new Error(`Model Gateway request timed out after ${timeoutMs}ms (no initial response)`));
        }, timeoutMs);

        try {
          if (attempt > 1) {
            console.log(`[MODEL GATEWAY] Retry attempt ${attempt}/${maxAttempts} for model ${currentModelId}...`);
            if (onStateChange) {
              onStateChange('retrying', {
                attempt,
                maxAttempts,
                model: currentModelId,
                lastError: lastError?.message,
              });
            }
          } else {
            console.log(`[MODEL GATEWAY] Calling model ${currentModelId} (${modelConfig.provider})...`);
            if (onStateChange) onStateChange('working', { model: currentModelId });
          }

          let chunkReceived = false;
          const wrappedOnChunk = chunk => {
            if (!chunkReceived) {
              chunkReceived = true;
              if (onStateChange) onStateChange('streaming', { model: currentModelId });
            }
            // Active stream watchdog: reset timeout so streaming continues uninterrupted
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              abortController.abort(new Error(`Model Gateway stream stalled (no chunks received for 60000ms)`));
            }, 60000);

            if (onChunk) onChunk(chunk);
          };

          const result = await provider.generate({
            model: modelConfig.model,
            messages,
            parameters: mergedParams,
            signal: abortController.signal,
            onChunk: wrappedOnChunk,
          });

          clearTimeout(timeoutId);

          const durationMs = Date.now() - attemptStartTime;
          console.log(`[MODEL GATEWAY] Completed in ${durationMs}ms (model: ${result.model}, attempts: ${attempt})`);

          return {
            ...result,
            durationMs,
            attempts: attempt,
            modelId: currentModelId,
            provider: modelConfig.provider,
            cost: modelConfig.costPerCall ?? 0,
            tier: modelConfig.tier,
          };
        } catch (error) {
          clearTimeout(timeoutId);
          lastError = error;

          const isRetryable = provider.isRetryableError(error);
          const isDailyQuotaExhausted = error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('Quota exceeded');

          console.warn(`[MODEL GATEWAY] Attempt ${attempt} failed: ${error.message} (Retryable: ${isRetryable})`);

          if (isDailyQuotaExhausted) {
            console.warn(`[MODEL GATEWAY] Daily quota limit exhausted for ${currentModelId}. Immediately switching to fallback model...`);
            break;
          }

          if (isRetryable && attempt < maxAttempts) {
            const delay = Math.min(
              policy.retry.initialDelayMs * Math.pow(policy.retry.backoffFactor, attempt - 1),
              policy.retry.maxDelayMs
            );
            console.log(`[MODEL GATEWAY] Waiting ${delay}ms before retry...`);
            await this.sleep(delay);
          } else {
            // Non-retryable or attempts exhausted for this model
            break;
          }
        }
      }

      // If we reach here for this model and have a fallback model, notify and log fallback
      if (modelIndex < modelsToTry.length - 1) {
        const nextModel = modelsToTry[modelIndex + 1];
        console.warn(`[MODEL GATEWAY] Model ${currentModelId} failed (${lastError?.message}). Switching to fallback ${nextModel}...`);
        if (onStateChange) {
          onStateChange('fallback', {
            from: currentModelId,
            to: nextModel,
            reason: lastError?.message || 'Upstream model failed',
          });
        }
      }
    }

    // All models and retries failed
    console.error(`[MODEL GATEWAY] All attempts failed:`, lastError);
    if (onStateChange) {
      onStateChange('error', { error: lastError?.message });
    }

    const enhancedError = new Error(`[MODEL GATEWAY FAILURE] ${lastError?.message || 'Unknown error'}`);
    enhancedError.originalError = lastError;
    enhancedError.totalDurationMs = Date.now() - overallStartTime;
    throw enhancedError;
  }
}

export const modelGateway = new ModelGateway();
