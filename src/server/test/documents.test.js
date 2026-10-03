import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../index.js';
import { createProject, getProject, getProjectFiles, getProjectFile, getProjectFileContent, applyProjectChanges, restoreRevision, updateProject } from '../services/projectService.js';
import { importProject } from '../services/importService.js';
import { extractDocumentText } from '../services/documentText.js';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import { AgentRegistry } from '../agents/agentRegistry.js';
import { modelGateway } from '../gateway/modelGateway.js';
import { closeMongo } from '../db/mongo.js';
import { samplePdf, sampleDocx, storedZip } from './fixtures/documentFixtures.js';

after(closeMongo);
const orchestrator = () => new Orchestrator(new AgentRegistry());
const response = result => ({ text: JSON.stringify(result), model: 'mock', cost: 0 });
const documentResult = (sourcePaths = []) => ({ status: 'completed', title: 'Project explanation', markdown: '# Project explanation\n\nThe requested explanation with key requirements and next steps.', sourcePaths });
const upload = files => importProject({ name: 'Source material', files: Object.entries(files).map(([path, data]) => ({ path, data: Buffer.from(data) })) });

test('PDF and DOCX readers extract actual document text while preserving original bytes', async () => {
  const pdf = samplePdf(), docx = sampleDocx();
  assert.match((await extractDocumentText({ path: 'report.pdf', data: pdf })).text, /revenue grew by 12 percent/);
  assert.match((await extractDocumentText({ path: 'plan.docx', data: docx })).text, /15 November/);
  assert.equal(pdf.toString('ascii', 0, 8), '%PDF-1.4');
  await assert.rejects(extractDocumentText({ path: 'broken.pdf', data: Buffer.from('not a PDF') }));
  await assert.rejects(extractDocumentText({ path: 'hidden-entry.docx', data: storedZip({ 'node_modules/hidden.xml': 'This entry must not bypass DOCX expansion validation.' }) }), /Reserved file path/);
});

test('automatic explanation routing creates Markdown from uploaded source without invoking website agents', async () => {
  const imported = await upload({ 'brief.txt': 'Launch on 15 November.', 'data.csv': 'team,people\nengineering,6', 'src/example.py': 'print("hello")' });
  assert.equal(imported.project.projectType, 'documents');
  assert.equal(imported.project.entryPoint, null);
  assert.equal(imported.validation, null);
  const o = orchestrator(), events = [];
  o.on('pipeline', e => events.push(e));
  const gateway = { generate: async ({ messages }) => {
    const system = messages[0].content;
    if (system.includes('Task Router')) {
      assert.match(messages.at(-1).content, /Explain these files for a beginner/);
      assert.ok(!system.includes('MULTI-FILE static website'));
      return response({ taskType: 'document', reason: 'User wants an explanation' });
    }
    assert.match(system, /Document Analyst/);
    assert.match(messages.at(-1).content, /Launch on 15 November/);
    assert.match(messages.at(-1).content, /engineering,6/);
    assert.match(messages.at(-1).content, /example.py/);
    return response(documentResult(['brief.txt', 'data.csv', 'src/example.py']));
  } };
  const result = await o.executeTask({ projectId: imported.project.id, prompt: 'Explain these files for a beginner', gateway, runId: 'doc-run' });
  assert.equal(result.taskType, 'document');
  assert.equal(result.revision, 2);
  assert.equal(result.document.path, 'documents/project-explanation.md');
  assert.match(await getProjectFileContent(imported.project.id, result.document.path), /## Source coverage/);
  assert.equal(await getProjectFileContent(imported.project.id, 'brief.txt'), 'Launch on 15 November.');
  assert.equal(await getProjectFile(imported.project.id, 'index.html'), null);
  assert.equal((await getProject(imported.project.id)).lastTask.document.path, result.document.path);
  assert.ok(events.some(e => e.stage === 'DOCUMENT_COMPLETED' && e.runId === 'doc-run'));
  assert.ok(!events.some(e => ['CODING_AGENT_STARTED', 'QA_STARTED', 'PIPELINE_STARTED'].includes(e.stage)));
  await restoreRevision(imported.project.id, 1, 2);
  assert.equal(await getProjectFile(imported.project.id, result.document.path), null);
  assert.equal((await getProject(imported.project.id)).lastTask, null);
});

test('general explanations work without uploads and repeated requests never overwrite earlier outputs', async () => {
  const project = await createProject({ name: 'Explain concepts' });
  const o = orchestrator();
  const gateway = { generate: async ({ messages }) => { assert.match(messages[0].content, /Document Analyst/); return response(documentResult()); } };
  const first = await o.executeTask({ projectId: project.id, prompt: 'Explain reinforcement learning with examples', taskType: 'document', gateway });
  assert.equal(first.revision, 1);
  assert.match(await getProjectFileContent(project.id, first.document.path), /No project files were attached/);
  const second = await o.executeTask({ projectId: project.id, prompt: 'Explain it in more detail', taskType: 'document', gateway });
  assert.notEqual(second.document.path, first.document.path);
  assert.ok(await getProjectFile(project.id, first.document.path));
  assert.equal((await getProject(project.id)).entryPoint, null);
});

test('analysis of website code preserves all source bytes, entry point and website QA', async () => {
  const imported = await upload({ 'index.html': '<html><body>Hello</body></html>', 'assets/icon.png': Buffer.from([0, 255, 128]) });
  await updateProject(imported.project.id, { qaReport: { result: 'passed', issues: [] } });
  const result = await orchestrator().executeTask({ projectId: imported.project.id, prompt: 'Explain this website', taskType: 'document', gateway: { generate: async () => response(documentResult(['index.html'])) } });
  assert.deepEqual((await getProjectFile(imported.project.id, 'assets/icon.png')).data, Buffer.from([0, 255, 128]));
  assert.equal(await getProjectFileContent(imported.project.id, 'index.html'), '<html><body>Hello</body></html>');
  const saved = await getProject(imported.project.id);
  assert.equal(saved.entryPoint, 'index.html');
  assert.equal(saved.projectType, 'static');
  assert.equal(saved.qaReport.result, 'passed');
  assert.ok(result.document.warnings.some(w => w.includes('icon.png')));
});

test('the analyst can read subsequent excerpts with evidence notes and reports partial coverage honestly', async () => {
  const imported = await upload({ 'long.txt': 'a'.repeat(17000) + 'Critical deadline: Tuesday' + 'b'.repeat(20000) });
  let calls = 0;
  const result = await orchestrator().executeTask({ projectId: imported.project.id, prompt: 'Summarize the deadline', taskType: 'document', gateway: { generate: async ({ messages }) => {
    if (++calls === 1) return response({ status: 'read_files', notes: 'The first excerpt contains introductory material.', readFiles: [{ path: 'long.txt', offset: 16000, limit: 16000 }] });
    assert.match(messages.at(-1).content, /Critical deadline: Tuesday/);
    assert.match(messages.at(-1).content, /first excerpt contains/);
    return response(documentResult(['long.txt']));
  } } });
  assert.equal(result.document.sources[0].status, 'partial');
  assert.equal(result.document.sources[0].charsRead, 32000);
  assert.match(await getProjectFileContent(imported.project.id, result.document.path), /partial/);
});

test('invalid output, unread citations and unsupported binary-only sources do not publish a document', async () => {
  const imported = await upload(Object.fromEntries(['a', 'b', 'c', 'd', 'z'].map(name => [`${name}.txt`, name])));
  const id = imported.project.id, o = orchestrator();
  await assert.rejects(o.executeTask({ projectId: id, prompt: 'Summarize', taskType: 'document', gateway: { generate: async () => ({ text: '{broken' }) } }), /invalid JSON/);
  let turn = 0;
  await assert.rejects(o.executeTask({ projectId: id, prompt: 'Summarize', taskType: 'document', gateway: { generate: async () => response(++turn === 1
    ? { status: 'read_files', readFiles: ['z.txt', 'missing.txt'] }
    : documentResult(['z.txt'])) } }), /not read/);
  assert.equal((await getProject(id)).revision, 1);
  const binary = await upload({ 'picture.png': Buffer.from([0, 255, 0]) });
  await assert.rejects(o.executeTask({ projectId: binary.project.id, prompt: 'Explain the image', taskType: 'document', gateway: { generate: async () => response(documentResult()) } }), /No readable source/);
  assert.equal((await getProjectFiles(binary.project.id)).length, 1);
});

test('document paths and revision conflicts protect existing files', async () => {
  const imported = await upload({ 'original.md': '# Original document' });
  const id = imported.project.id, o = orchestrator();
  const gateway = { generate: async () => response(documentResult(['original.md'])) };
  for (const outputPath of ['../escape.md', 'result.html']) await assert.rejects(o.executeTask({ projectId: id, prompt: 'Explain', taskType: 'document', outputPath, gateway }));
  await assert.rejects(o.executeTask({ projectId: id, prompt: 'Explain', taskType: 'document', outputPath: 'original.md', gateway }), /already exists/);
  await assert.rejects(o.executeTask({ projectId: id, prompt: 'Explain', taskType: 'document', gateway: { generate: async () => {
    await applyProjectChanges(id, [{ path: 'other.txt', content: 'Concurrent edit' }], { expectedRevision: 1 });
    return response(documentResult(['original.md']));
  } } }), /Concurrency conflict/);
  assert.equal(await getProjectFileContent(id, 'original.md'), '# Original document');
  assert.ok(!o.running.has(id));
});

test('generic task API imports PDFs/DOCX and returns a downloadable Markdown result', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const form = new FormData();
  form.append('files', new Blob([samplePdf()]), 'report.pdf');
  form.append('files', new Blob([sampleDocx()]), 'plan.docx');
  const uploaded = await (await fetch(`${base}/api/projects/import`, { method: 'POST', body: form })).json();
  const original = modelGateway.generate;
  modelGateway.generate = async ({ messages }) => {
    assert.match(messages.at(-1).content, /revenue grew by 12 percent/);
    assert.match(messages.at(-1).content, /15 November/);
    return response(documentResult(['report.pdf', 'plan.docx']));
  };
  t.after(() => { modelGateway.generate = original; });
  const result = await fetch(`${base}/api/orchestrate/task`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: uploaded.projectId, prompt: 'Summarize the findings and deadlines', taskType: 'document', outputPath: 'summary.md', budget: 0 }) });
  assert.equal(result.status, 200, await result.clone().text());
  const data = await result.json();
  assert.equal(data.data.document.path, 'summary.md');
  const download = await fetch(`${base}/api/projects/${uploaded.projectId}/files/summary.md?download=true`);
  assert.match(download.headers.get('content-disposition'), /attachment/);
  assert.match(await download.text(), /Source coverage/);
  assert.equal((await (await fetch(`${base}/api/projects/${uploaded.projectId}/preview-info`)).json()).supported, false);
});
