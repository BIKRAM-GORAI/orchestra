import assert from 'node:assert';
import test from 'node:test';
import app, { startServer } from '../index.js';
import { config } from '../config/env.js';
import { MODEL_REGISTRY } from '../config/models.js';
import { closeMongo } from '../db/mongo.js';

test('Phase 0: Environment & Model Configuration', () => {
  assert.ok(MODEL_REGISTRY['gemini-3.5-flash'], 'gemini-3.5-flash model is registered');
  assert.strictEqual(MODEL_REGISTRY['gemini-3.5-flash'].provider, 'gemini');
  assert.strictEqual(MODEL_REGISTRY['gemini-3.5-flash'].model, 'gemini-3.5-flash');

  assert.ok(MODEL_REGISTRY['kimi-k3'], 'kimi-k3 model is registered');
  assert.strictEqual(MODEL_REGISTRY['kimi-k3'].provider, 'nvidia');
  assert.strictEqual(MODEL_REGISTRY['kimi-k3'].model, 'moonshotai/kimi-k3');
  assert.strictEqual(MODEL_REGISTRY['kimi-k3'].defaultParameters.max_tokens, 16384);
  assert.strictEqual(MODEL_REGISTRY['kimi-k3'].defaultParameters.reasoning_effort, 'max');
});

test('Phase 0: HTTP Server Endpoints', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(async () => {
    server.close();
    await closeMongo();
  });

  // Health endpoint test
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.strictEqual(healthData.status, 'ok');

  // Models endpoint test
  const modelsRes = await fetch(`${baseUrl}/api/models`);
  assert.strictEqual(modelsRes.status, 200);
  const modelsData = await modelsRes.json();
  assert.ok(Array.isArray(modelsData.models));
  assert.strictEqual(modelsData.models[0].id, 'gemini-3.5-flash');

  // Preview endpoint test
  const previewRes = await fetch(`${baseUrl}/api/preview`);
  assert.strictEqual(previewRes.status, 200);
  const previewHtml = await previewRes.text();
  assert.ok(previewHtml.includes('<html') || previewHtml.includes('<!DOCTYPE html>'));

  // Client index.html serving test
  const clientRes = await fetch(`${baseUrl}/`);
  assert.strictEqual(clientRes.status, 200);
  const clientHtml = await clientRes.text();
  assert.ok(clientHtml.includes('Agent Orchestra'));
});
