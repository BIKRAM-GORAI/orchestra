import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import app, { previewApp } from '../index.js';
import { config } from '../config/env.js';
import { createProject, applyProjectChanges, getProject, getProjectFiles, getProjectFile, getProjectFileContent, getRevisionDiff, restoreRevision } from '../services/projectService.js';
import { prepareImport, readZip, importProject } from '../services/importService.js';
import { validateWebsite } from '../services/validationService.js';
import { normalizeFilePath, FILE_LIMITS } from '../services/filePaths.js';
import { Orchestrator, extractHtmlFromCodingResult } from '../orchestrator/orchestrator.js';
import { AgentRegistry } from '../agents/agentRegistry.js';
import { closeMongo } from '../db/mongo.js';
import { spawn } from 'node:child_process';
import { projectFileSession } from '../services/agentFileSession.js';

after(async () => { await closeMongo(); });

const html = '<!DOCTYPE html><html><head><link rel="stylesheet" href="css/main.css"></head><body><a href="pages/about.html">About</a><script type="module" src="js/app.js"></script></body></html>';
const source = () => [
  { path: 'index.html', content: html },
  { path: 'css/main.css', content: 'body { color: navy; }' },
  { path: 'js/app.js', content: 'import { label } from "./shared.js"; window.testLabel = label;' },
  { path: 'js/shared.js', content: String.raw`export const label = "first\nsecond";` },
  { path: 'pages/about.html', content: '<!DOCTYPE html><html><body>About</body></html>' },
];

// Small stored-ZIP fixture builder: no filesystem or external zip executable.
function zipFixture(files) {
  let offset = 0;
  const local = [], central = [];
  for (const file of files) {
    const name = Buffer.from(file.path);
    const data = Buffer.from(file.data || '');
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(file.declaredSize ?? data.length, 22); header.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(0x0314, 4); directory.writeUInt16LE(20, 6); directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(file.declaredSize ?? data.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(file.symlink ? 0xa1ff0000 : 0, 38); directory.writeUInt32LE(offset, 42);
    local.push(header, name, data); central.push(directory, name); offset += header.length + name.length + data.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(Buffer.concat(central).length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

test('multi-file storage preserves paths, bytes, revisions, renames and rollback', async () => {
  const project = await createProject({ name: 'Nested site' });
  const binary = Buffer.from([0, 255, 17, 128, 43]);
  const saved = await applyProjectChanges(project.id, [...source(), { path: 'assets/logo.png', data: binary }, { path: 'admin/index.html', content: '<html>Admin</html>' }], { expectedRevision: 0 });
  assert.equal(saved.revision, 1);
  assert.deepEqual((await getProjectFile(project.id, 'assets/logo.png')).data, binary);
  assert.equal(await getProjectFileContent(project.id, 'index.html'), html);
  assert.equal(await getProjectFileContent(project.id, 'admin/index.html'), '<html>Admin</html>');
  assert.equal(await getProjectFileContent(project.id, 'js/shared.js'), source()[3].content);
  const revision2 = await applyProjectChanges(project.id, [
    { action: 'rename', path: 'admin/index.html', to: 'staff/index.html' },
    { action: 'update', path: 'css/main.css', content: 'body { color: green; }' },
    { action: 'delete', path: 'assets/logo.png' },
  ], { expectedRevision: 1, note: 'Requested changes' });
  assert.equal(revision2.revision, 2);
  assert.equal(await getProjectFile(project.id, 'admin/index.html'), null);
  assert.ok((await getRevisionDiff(project.id, 2)).changes.find(c => c.path === 'css/main.css').patch.includes('+body { color: green; }'));
  await restoreRevision(project.id, 1, 2);
  assert.deepEqual((await getProjectFile(project.id, 'assets/logo.png')).data, binary);
  assert.equal(await getProjectFile(project.id, 'staff/index.html'), null);
  assert.equal((await getProject(project.id)).revision, 3);
});

test('changes are atomic, reject unsafe/colliding paths, and detect competing writers', async () => {
  const project = await createProject({ name: 'Atomic project' });
  await applyProjectChanges(project.id, [{ path: 'index.html', content: '<html>Original</html>' }]);
  for (const p of ['../escape.txt', '/absolute.js', 'D:\\file.js', 'a/../../x', 'a//b', '__proto__', '.orchestra/blob', 'project.json', 'CON.txt']) assert.throws(() => normalizeFilePath(p));
  await assert.rejects(applyProjectChanges(project.id, [{ path: 'index.html', content: 'bad' }, { path: '../escape.txt', content: 'escape' }], { expectedRevision: 1 }));
  assert.equal(await getProjectFileContent(project.id, 'index.html'), '<html>Original</html>');
  await assert.rejects(applyProjectChanges(project.id, [{ path: 'A.js', content: '' }, { path: 'a.js', content: '' }]), /Duplicate|conflicting/);
  await assert.rejects(applyProjectChanges(project.id, [{ path: 'css', content: '' }, { path: 'css/main.css', content: '' }]), /directory conflict/);
  const attempts = await Promise.allSettled(['one', 'two'].map(content => applyProjectChanges(project.id, [{ path: 'index.html', content }], { expectedRevision: 1 })));
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(attempts.find(r => r.status === 'rejected').reason.status, 409);
  await assert.rejects(getProjectFileContent('../', 'package.json'), /Invalid project/);
});

test('independent processes cannot overwrite the same expected revision', async () => {
  const project = await createProject({ name: 'Cross-process writers' });
  const code = `import {applyProjectChanges} from './src/server/services/projectService.js'; import {closeMongo} from './src/server/db/mongo.js'; try {await applyProjectChanges(${JSON.stringify(project.id)}, [{path:'index.html',content:'<html>writer</html>'}], {expectedRevision:0}); console.log('saved');} catch(err) {console.log(err.status);} finally {await closeMongo();}`;
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], { env: process.env });
    let output = '';
    child.stdout.on('data', bytes => { output += bytes; });
    child.stderr.on('data', bytes => { output += bytes; });
    child.on('error', reject);
    child.on('exit', code => code ? reject(new Error(output)) : resolve(output.trim()));
  });
  const results = await Promise.all([run(), run()]);
  assert.equal(results.filter(r => r === 'saved').length, 1, results.join('\n'));
  assert.equal(results.filter(r => r === '409').length, 1, results.join('\n'));
  assert.equal((await getProject(project.id)).revision, 1);
});

test('agent sessions rename binary assets and re-read renamed files across batches', async () => {
  const project = await createProject({ name: 'Agent renames' });
  const image = Buffer.from([0, 255, 128]);
  await applyProjectChanges(project.id, [...source(), { path: 'assets/old.png', data: image }]);
  const session = await projectFileSession(project.id);
  await session.readBatch(['assets/old.png', 'js/shared.js']);
  session.stage([{ action: 'rename', path: 'assets/old.png', to: 'assets/new.png' }, { action: 'rename', path: 'js/shared.js', to: 'js/labels.js' }]);
  assert.ok(session.tree().some(f => f.path === 'assets/new.png'));
  assert.equal((await session.readBatch(['js/labels.js']))[0].content, source()[3].content);
  await session.commit('Rename assets');
  assert.deepEqual((await getProjectFile(project.id, 'assets/new.png')).data, image);
  assert.equal(await getProjectFile(project.id, 'assets/old.png'), null);
});

test('filesystem symlinks are refused and legacy nested projects migrate with a baseline', async () => {
  if (config.mongoUri) return;
  const id = 'legacy-migration';
  const directory = path.join(config.projectsDir, id);
  await fs.mkdir(path.join(directory, 'css'), { recursive: true });
  await fs.writeFile(path.join(directory, 'project.json'), JSON.stringify({ id, name: 'Legacy', createdAt: new Date().toISOString(), version: 9, history: [] }));
  await fs.writeFile(path.join(directory, 'index.html'), '<html>Legacy</html>');
  await fs.writeFile(path.join(directory, 'css/main.css'), 'body { color: red; }');
  assert.ok((await getProjectFiles(id)).some(f => f.path === 'css/main.css'));
  await applyProjectChanges(id, [{ path: 'css/main.css', content: 'body { color: blue; }' }], { expectedRevision: 0 });
  await restoreRevision(id, 0, 1);
  assert.equal(await getProjectFileContent(id, 'css/main.css'), 'body { color: red; }');
  const linked = 'linked-project';
  await fs.symlink(directory, path.join(config.projectsDir, linked));
  await assert.rejects(getProject(linked), /Symbolic links/);
});

test('staged swaps, deleted destinations and reused names publish one coherent revision', async () => {
  const project = await createProject({ name: 'Compound edits' });
  await applyProjectChanges(project.id, [
    { path: 'index.html', content: '<html>Home</html>' },
    ...['a', 'b', 'c', 'd'].map(name => ({ path: `${name}.txt`, content: name })),
  ]);
  const session = await projectFileSession(project.id);
  await session.readBatch(['a.txt', 'b.txt', 'c.txt', 'd.txt']);
  session.stage([
    { action: 'rename', path: 'a.txt', to: 'temp.txt' },
    { action: 'rename', path: 'b.txt', to: 'a.txt' },
    { action: 'rename', path: 'temp.txt', to: 'b.txt' },
    { action: 'delete', path: 'c.txt' },
    { action: 'rename', path: 'd.txt', to: 'c.txt' },
    { action: 'update', path: 'c.txt', content: 'modified d' },
    { action: 'create', path: 'd.txt', content: 'replacement' },
  ]);
  await session.commit('Compound edits');
  assert.equal((await getProject(project.id)).revision, 2);
  assert.equal(await getProjectFileContent(project.id, 'a.txt'), 'b');
  assert.equal(await getProjectFileContent(project.id, 'b.txt'), 'a');
  assert.equal(await getProjectFileContent(project.id, 'c.txt'), 'modified d');
  assert.equal(await getProjectFileContent(project.id, 'd.txt'), 'replacement');
  assert.equal(await getProjectFile(project.id, 'temp.txt'), null);
  await restoreRevision(project.id, 1, 2);
  assert.equal(await getProjectFileContent(project.id, 'a.txt'), 'a');
  assert.equal(await getProjectFileContent(project.id, 'b.txt'), 'b');
});

test('ZIP/folder import preserves structure and binary files and filters dependencies', async () => {
  const files = await readZip(zipFixture([
    { path: 'site/index.html', data: html },
    { path: 'site/css/main.css', data: 'body {}' },
    { path: 'site/assets/icon.png', data: Buffer.from([0, 255, 1]) },
    { path: 'site/node_modules/no.js', data: 'unused' },
  ]));
  const result = await importProject({ files, name: 'ZIP import', stripRoot: true });
  assert.equal(result.project.entryPoint, 'index.html');
  assert.deepEqual((await getProjectFile(result.project.id, 'assets/icon.png')).data, Buffer.from([0, 255, 1]));
  assert.equal((await getProjectFiles(result.project.id)).length, 3);
  await assert.rejects(readZip(zipFixture([{ path: '../outside.js', data: '' }])));
  await assert.rejects(readZip(zipFixture([{ path: 'link', data: 'elsewhere', symlink: true }])), /symbolic/);
  await assert.rejects(readZip(zipFixture([{ path: 'huge.js', declaredSize: FILE_LIMITS.fileBytes + 1 }])), /size|limit/);
  assert.throws(() => prepareImport([{ path: 'x.txt', data: Buffer.from('a') }, { path: 'x.txt', data: Buffer.from('b') }]), /Duplicate/);
  const framework = prepareImport([{ path: 'index.html', data: Buffer.from('<html></html>') }, { path: 'package.json', data: Buffer.from('{"dependencies":{"vite":"*"}}') }]);
  assert.equal(framework.projectType, 'source-only');
});

test('cross-file validator checks local references and JavaScript without corrupting escapes', () => {
  assert.equal(validateWebsite(source()).result, 'passed');
  const broken = validateWebsite([{ path: 'index.html', content: '<html><script src="missing.js"></script></html>' }, { path: 'app.js', content: 'const = ;' }]);
  assert.ok(broken.issues.some(i => i.category === 'reference'));
  assert.ok(broken.issues.some(i => i.category === 'javascript'));
  const original = String.raw`<!DOCTYPE html><html><body><script>const text = "a\nb";</script></body></html>`;
  assert.equal(extractHtmlFromCodingResult({ artifact: { content: original } }), original);
});

test('HTTP import, exact path reads, preview resources, revisions and API isolation', async t => {
  const server = app.listen(0, '127.0.0.1');
  const preview = previewApp.listen(0, '127.0.0.1');
  await Promise.all([new Promise(r => server.once('listening', r)), new Promise(r => preview.once('listening', r))]);
  t.after(() => { server.closeAllConnections(); server.close(); preview.closeAllConnections(); preview.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const previewBase = `http://127.0.0.1:${preview.address().port}`;
  const form = new FormData();
  form.append('name', 'HTTP upload');
  for (const file of source()) form.append('files', new Blob([file.content]), path.basename(file.path));
  form.append('paths', JSON.stringify(source().map(f => f.path)));
  const response = await fetch(`${base}/api/projects/import`, { method: 'POST', body: form });
  assert.equal(response.status, 201);
  const imported = await response.json();
  const id = imported.projectId;
  const file = await (await fetch(`${base}/api/projects/${id}/files/js/shared.js`)).json();
  assert.equal(file.content, source()[3].content);
  const page = await fetch(`${previewBase}/p/${id}/index.html`);
  assert.equal(page.status, 200);
  assert.ok(page.headers.get('content-security-policy').includes('sandbox'));
  const script = await fetch(`${previewBase}/p/${id}/js/app.js`);
  assert.ok(script.headers.get('content-type').includes('javascript'));
  assert.equal(await script.text(), source()[2].content);
  assert.equal((await fetch(`${previewBase}/p/${id}/missing.js`)).status, 404);
  assert.equal((await fetch(`${previewBase}/api/projects`)).status, 404);
  assert.equal((await fetch(`${base}/api/projects`, { headers: { Origin: 'null' } })).status, 403);
  const edited = await fetch(`${base}/api/projects/${id}/changes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: 1, changes: [{ action: 'update', path: 'css/main.css', content: 'body { color: green; }' }] }) });
  assert.equal(edited.status, 200);
  assert.equal((await (await fetch(`${base}/api/projects/${id}/revisions`)).json()).revisions.length, 2);
  const stale = await fetch(`${base}/api/projects/${id}/changes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: 1, changes: [{ path: 'index.html', content: '' }] }) });
  assert.equal(stale.status, 409);
});

test('multi-round generation commits all files together and completes after QA', async () => {
  const project = await createProject({ name: 'Generated multi-file site' });
  const orchestrator = new Orchestrator(new AgentRegistry());
  const stages = [];
  orchestrator.on('pipeline', event => stages.push(event.stage));
  let codingCalls = 0;
  const gateway = { async generate({ messages }) {
    const task = messages.at(-1).content;
    let result;
    if (messages[0].content.includes('sole implementation owner')) {
      codingCalls++;
      result = { status: 'changes', changes: source().slice(codingCalls === 1 ? 0 : 2, codingCalls === 1 ? 2 : undefined).map(f => ({ ...f, action: 'create' })), done: codingCalls === 2 };
    } else if (messages[0].content.includes('QA Agent')) result = { result: 'passed', issues: [], summary: { verdict: 'References inspected' } };
    else if (task.includes('synthesize the specialist specifications')) result = { unified_specification: { entry_point: 'index.html' } };
    else result = { selected_agents: [], project: { name: 'Test' }, explicit_requirements: [] };
    return { text: JSON.stringify(result), model: 'mock', cost: 0 };
  } };
  const result = await orchestrator.buildFullProject({ projectId: project.id, prompt: 'Create a website', gateway });
  assert.equal(codingCalls, 2);
  assert.equal(result.revision, 1);
  assert.equal((await getProjectFiles(project.id)).filter(f => !f.artifact).length, 5);
  assert.equal(stages.filter(s => s === 'PIPELINE_COMPLETED').length, 1);
  assert.ok(stages.indexOf('PIPELINE_COMPLETED') > stages.indexOf('QA_COMPLETED'));
});

test('uploaded projects are edited with requested file reads and unrelated bytes preserved', async () => {
  const imported = await importProject({ name: 'Edit imported files', files: [...source().map(f => ({ path: f.path, data: Buffer.from(f.content) })), { path: 'css/forms.css', data: Buffer.from('.form { color: red; }') }, { path: 'assets/logo.png', data: Buffer.from([0, 255, 33]) }] });
  const projectId = imported.project.id;
  const orchestrator = new Orchestrator(new AgentRegistry());
  let calls = 0;
  const gateway = { async generate({ messages }) {
    if (messages[0].content.includes('QA Agent')) return { text: JSON.stringify({ result: 'passed', issues: [] }), model: 'mock' };
    calls++;
    if (calls === 1) return { text: JSON.stringify({ status: 'read_files', readFiles: ['css/forms.css'], done: false }), model: 'mock' };
    assert.ok(messages.at(-1).content.includes('.form { color: red; }'));
    return { text: JSON.stringify({ status: 'changes', changes: [{ action: 'update', path: 'css/forms.css', content: '.form { color: green; }' }], done: true }), model: 'mock', cost: 0.05 };
  } };
  const result = await orchestrator.buildFullProject({ projectId, prompt: 'Make form text green', gateway });
  assert.equal(result.revision, 2);
  assert.equal(await getProjectFileContent(projectId, 'index.html'), html);
  assert.deepEqual((await getProjectFile(projectId, 'assets/logo.png')).data, Buffer.from([0, 255, 33]));
  assert.equal(await getProjectFileContent(projectId, 'css/forms.css'), '.form { color: green; }');
});

test('invalid model output cannot publish a partial batch; invalid QA never passes', async () => {
  const project = await createProject({ name: 'Invalid responses' });
  const orchestrator = new Orchestrator(new AgentRegistry());
  let calls = 0;
  const gateway = { async generate() { return { text: ++calls === 1 ? JSON.stringify({ changes: [{ action: 'create', path: 'index.html', content: '<html>partial</html>' }], done: false }) : '{broken', model: 'mock' }; } };
  await assert.rejects(orchestrator.implement({ projectId: project.id, userPrompt: 'test', gateway }), /invalid JSON/);
  assert.equal((await getProject(project.id)).revision, 0);
  assert.equal(await getProjectFile(project.id, 'index.html'), null);
  const report = await orchestrator.audit({ htmlContent: '<html>Test</html>', gateway: { generate: async () => ({ text: 'invalid', model: 'mock' }) } });
  assert.equal(report.result, 'issues_found');
  assert.equal(report.status, 'failed');
});
