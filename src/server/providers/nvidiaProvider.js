import { BaseProvider } from './baseProvider.js';
import { config } from '../config/env.js';

/**
 * NVIDIA NIM Provider Adapter
 * 
 * Target Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 * Model: moonshotai/kimi-k3
 */
export class NvidiaProvider extends BaseProvider {
  constructor(apiKey = config.nvidiaApiKey) {
    super('nvidia');
    this.apiKey = apiKey || config.nvidiaApiKey;
  }

  /**
   * Set or update API key at runtime if needed
   */
  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Execute chat completion via NVIDIA NIM
   */
  async generate({
    model = 'moonshotai/kimi-k3',
    messages = [],
    parameters = {},
    signal,
    onChunk,
  }) {
    if (!this.apiKey) {
      const err = new Error('NVIDIA_API_KEY is missing. Please set it in .env.');
      err.status = 401;
      throw err;
    }

    const endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    const isStream = parameters.stream !== false;

    const requestBody = {
      model,
      messages,
      max_tokens: parameters.max_tokens ?? 16384,
      temperature: parameters.temperature ?? 1,
      stream: isStream,
    };

    if (parameters.reasoning_effort) {
      requestBody.reasoning_effort = parameters.reasoning_effort;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': isStream ? 'text/event-stream' : 'application/json',
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (_) {}
      
      const error = new Error(`NVIDIA NIM API Error (${response.status} ${response.statusText}): ${errorBody}`);
      error.status = response.status;
      error.responseBody = errorBody;
      throw error;
    }

    if (!isStream) {
      const data = await response.json();
      const choice = data.choices?.[0];
      const text = choice?.message?.content || '';
      const reasoningText = choice?.message?.reasoning_content || '';
      return {
        text,
        reasoningText,
        model: data.model || model,
        usage: data.usage || null,
        finishReason: choice?.finish_reason || 'stop',
      };
    }

    // Handle Streaming Response
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let accumulatedText = '';
    let reasoningAccumulated = '';
    let buffer = '';
    let finishReason = null;
    let modelName = model;
    let usage = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last incomplete fragment in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // Ignore empty lines and SSE comments

          if (trimmed === 'data: [DONE]') {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.model) modelName = parsed.model;
              if (parsed.usage) usage = parsed.usage;

              const choice = parsed.choices?.[0];
              if (choice) {
                if (choice.finish_reason) {
                  finishReason = choice.finish_reason;
                }

                const delta = choice.delta?.content || '';
                const reasoningDelta = choice.delta?.reasoning_content || choice.delta?.reasoning || '';

                if (delta) accumulatedText += delta;
                if (reasoningDelta) reasoningAccumulated += reasoningDelta;

                if (onChunk && (delta || reasoningDelta)) {
                  onChunk({
                    delta,
                    accumulatedText,
                    reasoningDelta,
                    reasoningAccumulated,
                    model: modelName,
                  });
                }
              }
            } catch (parseErr) {
              // Invalid JSON line fragment, ignore or buffer
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      text: accumulatedText.trim() || reasoningAccumulated.trim(),
      reasoningText: reasoningAccumulated,
      model: modelName,
      usage,
      finishReason: finishReason || 'stop',
    };
  }
}
