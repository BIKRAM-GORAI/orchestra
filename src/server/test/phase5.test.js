import assert from 'node:assert';
import test from 'node:test';
import app from '../index.js';
import { createProject, saveProjectHtml, getProjectHtml } from '../services/projectService.js';

test('Phase 5: Multi-Project Isolated Previews & REST Endpoints', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(() => {
    server.close();
  });

  // Create Project A
  const projA = await createProject({ name: 'Project Alpha', prompt: 'Goal Alpha' });
  const htmlA = '<!DOCTYPE html><html><body><h1>Project Alpha Website</h1></body></html>';
  await saveProjectHtml(projA.id, htmlA, 'Initial Alpha');

  // Create Project B
  const projB = await createProject({ name: 'Project Beta', prompt: 'Goal Beta' });
  const htmlB = '<!DOCTYPE html><html><body><h1>Project Beta Website</h1></body></html>';
  await saveProjectHtml(projB.id, htmlB, 'Initial Beta');

  // Verify Project A preview endpoint
  const resA = await fetch(`${baseUrl}/api/projects/${projA.id}/preview`);
  assert.strictEqual(resA.status, 200);
  const textA = await resA.text();
  assert.strictEqual(textA, htmlA);

  // Verify Project B preview endpoint
  const resB = await fetch(`${baseUrl}/api/projects/${projB.id}/preview`);
  assert.strictEqual(resB.status, 200);
  const textB = await resB.text();
  assert.strictEqual(textB, htmlB);

  // Verify isolation: A does not equal B
  assert.notStrictEqual(textA, textB);

  // Verify /api/projects returns both projects
  const listRes = await fetch(`${baseUrl}/api/projects`);
  assert.strictEqual(listRes.status, 200);
  const listData = await listRes.json();
  const foundA = listData.projects.find(p => p.id === projA.id);
  const foundB = listData.projects.find(p => p.id === projB.id);
  assert.ok(foundA, 'Project Alpha found in list');
  assert.ok(foundB, 'Project Beta found in list');
  assert.strictEqual(foundA.name, 'Project Alpha');
  assert.strictEqual(foundB.name, 'Project Beta');
});

test('Phase 5: Orchestration SSE Event Stream Endpoint', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(() => {
    server.close();
  });

  const controller = new AbortController();
  const res = await fetch(`${baseUrl}/api/orchestrate/events`, {
    signal: controller.signal,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-type'), 'text/event-stream');

  controller.abort();
  try {
    const reader = res.body?.getReader();
    await reader?.cancel();
  } catch (_) {}
});
