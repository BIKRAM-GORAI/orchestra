/**
 * Base Provider Interface
 * 
 * Standard contract for all inference providers (NVIDIA NIM, Gemini, OpenRouter, etc.).
 * Guarantees that the Model Gateway and Agents remain 100% provider-agnostic.
 */

export class BaseProvider {
  constructor(name) {
    if (new.target === BaseProvider) {
      throw new TypeError('Cannot construct BaseProvider instances directly');
    }
    this.name = name;
  }

  /**
   * Execute chat completion request.
   * 
   * @param {Object} params
   * @param {string} params.model - Specific provider model string
   * @param {Array<{role: string, content: string}>} params.messages - Chat messages
   * @param {Object} [params.parameters] - Inference hyperparameters (temp, max_tokens, reasoning_effort)
   * @param {AbortSignal} [params.signal] - Abort controller signal for timeouts
   * @param {Function} [params.onChunk] - Stream callback receiving { delta, accumulatedText, reasoningDelta, reasoningAccumulated }
   * @returns {Promise<{text: string, reasoningText: string, model: string, usage: Object}>}
   */
  async generate(params) {
    throw new Error(`generate() method not implemented on ${this.name} provider`);
  }

  /**
   * Determine if an error is transient and retryable (e.g. 429 rate limit, 502/503/504 server errors, network reset)
   * 
   * @param {Error} error
   * @returns {boolean}
   */
  isRetryableError(error) {
    if (error.name === 'AbortError') return false; // User/timeout abort
    if (error.status === 429) return true; // Rate limit
    if (error.status >= 500 && error.status <= 599) return true; // Server error
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') return true;
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('forcibly closed') || msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('network') || msg.includes('socket')) {
      return true;
    }
    return false;
  }
}
