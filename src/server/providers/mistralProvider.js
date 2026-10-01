import { BaseProvider } from './baseProvider.js';
import { config } from '../config/env.js';

/**
 * Mistral AI Provider Adapter
 * 
 * Target Endpoint: https://api.mistral.ai/v1/chat/completions
 * Model: codestral-latest (256k context, 16k output tokens, fast coding inference)
 */
export class MistralProvider extends BaseProvider {
  constructor(apiKey = config.mistralApiKey) {
    super('mistral');
    this.apiKey = apiKey || config.mistralApiKey;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Execute chat completion via Mistral AI API
   */
  async generate({
    model = 'codestral-latest',
    messages = [],
    parameters = {},
    signal,
    onChunk,
  }) {
    if (!this.apiKey) {
      const err = new Error('MISTRAL_API_KEY is missing. Please set it in .env.');
      err.status = 401;
      throw err;
    }

    const endpoint = 'https://api.mistral.ai/v1/chat/completions';
    const isStream = parameters.stream !== false;

    const requestBody = {
      model,
      messages,
      max_tokens: parameters.max_tokens ?? 16384,
      temperature: parameters.temperature ?? 0.7,
      stream: isStream,
    };

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

      const error = new Error(`Mistral AI API Error (${response.status} ${response.statusText}): ${errorBody}`);
      error.status = response.status;
      error.responseBody = errorBody;
      throw error;
    }

    if (!isStream) {
      const data = await response.json();
      const choice = data.choices?.[0];
      const text = choice?.message?.content || '';
      return {
        text,
        reasoningText: '',
        model: data.model || model,
        usage: data.usage || null,
        finishReason: choice?.finish_reason || 'stop',
      };
    }

    // Handle Streaming Response
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let accumulatedText = '';
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
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

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
                if (delta) {
                  accumulatedText += delta;
                  if (onChunk) {
                    onChunk({
                      delta,
                      accumulatedText,
                      reasoningDelta: '',
                      reasoningAccumulated: '',
                      model: modelName,
                    });
                  }
                }
              }
            } catch (_) {
              // Ignore incomplete JSON line fragments
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      text: accumulatedText.trim(),
      reasoningText: '',
      model: modelName,
      usage,
      finishReason: finishReason || 'stop',
    };
  }
}
