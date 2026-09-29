import assert from 'node:assert';
import test from 'node:test';
import { BaseProvider } from '../providers/baseProvider.js';
import { NvidiaProvider } from '../providers/nvidiaProvider.js';
import { ModelGateway } from '../gateway/modelGateway.js';
import { config } from '../config/env.js';

test('Phase 1: BaseProvider and NvidiaProvider contract', () => {
  assert.throws(() => new BaseProvider('test'), /Cannot construct BaseProvider instances directly/);

  const provider = new NvidiaProvider('dummy-key');
  assert.strictEqual(provider.name, 'nvidia');
  assert.strictEqual(provider.isRetryableError({ status: 429 }), true);
  assert.strictEqual(provider.isRetryableError({ status: 503 }), true);
  assert.strictEqual(provider.isRetryableError({ status: 504 }), true);
  assert.strictEqual(provider.isRetryableError({ status: 400 }), false);
  assert.strictEqual(provider.isRetryableError({ status: 401 }), false);
});

test('Phase 1: Model Gateway Retry Mechanism on Transient Error', async () => {
  const gateway = new ModelGateway();

  // Create a mock provider that fails once with 429 then succeeds
  let callCount = 0;
  const mockProvider = {
    name: 'nvidia',
    isRetryableError: (err) => err.status === 429,
    async generate({ messages, parameters, onChunk }) {
      callCount++;
      if (callCount === 1) {
        const err = new Error('Rate limit exceeded');
        err.status = 429;
        throw err;
      }
      return {
        text: 'Retry success message',
        reasoningText: '',
        model: 'moonshotai/kimi-k3',
        usage: { total_tokens: 10 },
      };
    },
  };

  // Temporarily swap provider in gateway's registry
  const originalProvider = gateway.providerRegistry.get('nvidia');
  gateway.providerRegistry.register('nvidia', mockProvider);

  try {
    const states = [];
    const result = await gateway.generate({
      modelId: 'kimi-k3',
      messages: [{ role: 'user', content: 'Test retry' }],
      onStateChange: (st) => states.push(st),
    });

    assert.strictEqual(callCount, 2, 'Provider was called twice due to retry');
    assert.strictEqual(result.attempts, 2, 'Gateway recorded 2 attempts');
    assert.strictEqual(result.text, 'Retry success message');
    assert.ok(states.includes('retrying'), 'State machine emitted retrying state');
  } finally {
    gateway.providerRegistry.register('nvidia', originalProvider);
  }
});

test('Phase 1: Model Gateway Streaming Chunk Accumulation', async () => {
  const gateway = new ModelGateway();

  const mockProvider = {
    name: 'nvidia',
    isRetryableError: () => false,
    async generate({ messages, onChunk }) {
      if (onChunk) {
        onChunk({ delta: 'Hello ', accumulatedText: 'Hello ', reasoningDelta: '', reasoningAccumulated: '' });
        onChunk({ delta: 'World!', accumulatedText: 'Hello World!', reasoningDelta: '', reasoningAccumulated: '' });
      }
      return {
        text: 'Hello World!',
        reasoningText: '',
        model: 'moonshotai/kimi-k3',
        usage: { total_tokens: 2 },
      };
    },
  };

  const originalProvider = gateway.providerRegistry.get('nvidia');
  gateway.providerRegistry.register('nvidia', mockProvider);

  try {
    const chunks = [];
    const states = [];
    const result = await gateway.generate({
      modelId: 'kimi-k3',
      messages: [{ role: 'user', content: 'Test streaming' }],
      onStateChange: (st) => states.push(st),
      onChunk: (c) => chunks.push(c.delta),
    });

    assert.deepStrictEqual(chunks, ['Hello ', 'World!']);
    assert.strictEqual(result.text, 'Hello World!');
    assert.ok(states.includes('working') || states.includes('streaming'));
  } finally {
    gateway.providerRegistry.register('nvidia', originalProvider);
  }
});
