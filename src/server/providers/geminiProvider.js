import { BaseProvider } from './baseProvider.js';
import { config } from '../config/env.js';

/**
 * Google Gemini Provider Adapter
 * 
 * Supports:
 * - gemini-3.5-flash
 * - gemini-3.5-flash-lite
 * - gemini-3-flash-preview
 * - gemini-2.5-flash
 */
export class GeminiProvider extends BaseProvider {
  constructor(apiKey = config.geminiApiKey) {
    super('gemini');
    this.apiKey = apiKey || config.geminiApiKey;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Format OpenAI/Standard chat messages into Google Gemini payload
   */
  formatPayload(messages = [], parameters = {}) {
    let systemInstruction = null;
    const contents = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = {
          parts: [{ text: msg.content }],
        };
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Ensure at least one user content exists
    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    const payload = {
      contents,
      generationConfig: {
        maxOutputTokens: parameters.max_tokens || 32768,
        temperature: parameters.temperature ?? 0.7,
      },
    };

    // Constrain Gemini to strictly valid JSON when schema or JSON output is requested
    const expectsJson = Boolean(
      parameters.responseMimeType === 'application/json' ||
      parameters.jsonMode ||
      parameters.outputSchema ||
      (systemInstruction && systemInstruction.parts?.some(p => p.text?.includes('valid JSON'))) ||
      messages.some(m => typeof m.content === 'string' && m.content.includes('valid JSON conforming'))
    );

    if (expectsJson) {
      payload.generationConfig.responseMimeType = 'application/json';
    }

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    return payload;
  }

  async generate({
    model = 'gemini-3.5-flash',
    messages = [],
    parameters = {},
    signal,
    onChunk,
  }) {
    if (!this.apiKey) {
      const err = new Error('GEMINI_API_KEY is missing. Please set it in .env.');
      err.status = 401;
      throw err;
    }

    // Clean model string (strip 'models/' prefix if present)
    const cleanModel = model.replace(/^models\//, '');
    const isStream = parameters.stream !== false;
    const payload = this.formatPayload(messages, parameters);

    // 1. Try Streaming Generation
    if (isStream) {
      try {
        const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
        
        const response = await fetch(streamUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        });

        if (response.ok) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let accumulatedText = '';
          let buffer = '';

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

                if (trimmed.startsWith('data: ')) {
                  try {
                    const json = JSON.parse(trimmed.slice(6));
                    const delta = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (delta) {
                      accumulatedText += delta;
                      if (onChunk) {
                        onChunk({
                          delta,
                          accumulatedText,
                          reasoningDelta: '',
                          reasoningAccumulated: '',
                          model: cleanModel,
                        });
                      }
                    }
                  } catch (_) {}
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          if (accumulatedText.trim().length > 0) {
            return {
              text: accumulatedText,
              reasoningText: '',
              model: cleanModel,
              usage: null,
              finishReason: 'stop',
            };
          }
        } else if (response.status !== 503) {
          const errorText = await response.text();
          const error = new Error(`Gemini API Error (${response.status}): ${errorText}`);
          error.status = response.status;
          throw error;
        }
      } catch (streamErr) {
        // If abort signal was triggered by caller, rethrow
        if (signal?.aborted) throw streamErr;
        // On connection reset or 503, fallback to standard generateContent
        console.warn(`[GEMINI PROVIDER] Stream interrupted (${streamErr.message}). Falling back to standard generation...`);
      }
    }

    // 2. Standard generateContent (or streaming fallback)
    const standardUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${this.apiKey}`;
    const standardRes = await fetch(standardUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!standardRes.ok) {
      const errorText = await standardRes.text();
      const error = new Error(`Gemini API Error (${standardRes.status}): ${errorText}`);
      error.status = standardRes.status;
      throw error;
    }

    const data = await standardRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // If stream callback was provided, emit the complete text as a single chunk
    if (onChunk && text) {
      onChunk({
        delta: text,
        accumulatedText: text,
        reasoningDelta: '',
        reasoningAccumulated: '',
        model: cleanModel,
      });
    }

    return {
      text,
      reasoningText: '',
      model: cleanModel,
      usage: data.usageMetadata || null,
      finishReason: data.candidates?.[0]?.finishReason || 'stop',
    };
  }
}
