import assert from 'node:assert';
import test from 'node:test';
import { GeminiProvider } from '../providers/geminiProvider.js';
import { ModelGateway } from '../gateway/modelGateway.js';

test('GeminiProvider: Contract and Retryable Error Classification', () => {
  const provider = new GeminiProvider('test-api-key');
  assert.strictEqual(provider.name, 'gemini');
  assert.strictEqual(provider.isRetryableError({ status: 429 }), true);
  assert.strictEqual(provider.isRetryableError({ status: 503 }), true);
  assert.strictEqual(provider.isRetryableError({ status: 504 }), true);
  assert.strictEqual(provider.isRetryableError({ status: 400 }), false);
  assert.strictEqual(provider.isRetryableError({ status: 403 }), false);
});

test('GeminiProvider: Request Payload Formatting', () => {
  const provider = new GeminiProvider('test-key');

  const messages = [
    { role: 'system', content: 'You are an expert designer.' },
    { role: 'user', content: 'Create a dark theme layout.' },
  ];

  const payload = provider.formatPayload(messages, { temperature: 0.7, max_tokens: 4096 });
  assert.strictEqual(payload.systemInstruction.parts[0].text, 'You are an expert designer.');
  assert.strictEqual(payload.contents.length, 1);
  assert.strictEqual(payload.contents[0].role, 'user');
  assert.strictEqual(payload.contents[0].parts[0].text, 'Create a dark theme layout.');
  assert.strictEqual(payload.generationConfig.temperature, 0.7);
  assert.strictEqual(payload.generationConfig.maxOutputTokens, 4096);
});

test('GeminiProvider: Gateway Integration with Mock Provider', async () => {
  const gateway = new ModelGateway();

  const mockGeminiProvider = {
    name: 'gemini',
    isRetryableError: (err) => err.status === 429 || err.status === 503,
    async generate({ model, messages, onChunk }) {
      if (onChunk) {
        onChunk({ delta: 'Gemini ' });
        onChunk({ delta: 'output text' });
      }
      return {
        text: 'Gemini output text',
        reasoningText: '',
        model: 'gemini-3.5-flash',
        usage: { total_tokens: 15 },
      };
    },
  };

  gateway.providerRegistry.register('gemini', mockGeminiProvider);

  const chunks = [];
  const result = await gateway.generate({
    modelId: 'gemini-3.5-flash',
    messages: [{ role: 'user', content: 'Test prompt' }],
    onChunk: (chunk) => chunks.push(chunk.delta),
  });

  assert.strictEqual(result.text, 'Gemini output text');
  assert.strictEqual(result.model, 'gemini-3.5-flash');
  assert.strictEqual(chunks.join(''), 'Gemini output text');
});
