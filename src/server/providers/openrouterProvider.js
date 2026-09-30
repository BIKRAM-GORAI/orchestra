import { BaseProvider } from './baseProvider.js';
import { config } from '../config/env.js';

/**
 * OpenRouter Provider Adapter
 * 
 * Target Endpoint: https://openrouter.ai/api/v1/chat/completions
 * Supports free and paid models (e.g. Qwen: Qwen 3.8 27B free, DeepSeek, Claude, etc.)
 */
export class OpenRouterProvider extends BaseProvider {
  constructor(apiKey = config.openrouterApiKey) {
    super('openrouter');
    this.apiKey = apiKey || config.openrouterApiKey;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Execute chat completion via OpenRouter API
   */
  async generate({
    model = 'qwen/qwen-2.5-72b-instruct:free',
    messages = [],
    parameters = {},
    signal,
    onChunk,
  }) {
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
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
      'Accept': isStream ? 'text/event-stream' : 'application/json',
      'HTTP-Referer': 'https://agent-orchestra.local',
      'X-Title': 'Agent Orchestra Multi-Agent Studio',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

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

      const error = new Error(`OpenRouter API Error (${response.status} ${response.statusText}): ${errorBody}`);
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
            } catch (_) {
              // Ignore partial JSON chunk
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
