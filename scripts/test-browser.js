import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { samplePdf, sampleDocx } from '../src/server/test/fixtures/documentFixtures.js';

const directory = await fs.mkdtemp(path.join(tmpdir(), 'orchestra-browser-'));
process.env.ORCHESTRA_DATA_DIR = path.join(directory, 'storage');
process.env.ORCHESTRA_STORAGE = 'filesystem';
process.env.PREVIEW_ORIGIN = '';
const { default: app, previewApp } = await import('../src/server/index.js');
const { config } = await import('../src/server/config/env.js');
const { modelGateway } = await import('../src/server/gateway/modelGateway.js');
// Exercise real HTTP/SSE orchestration without making paid provider calls.
let mode = 'edit';
const generate = modelGateway.generate;
modelGateway.generate = async ({ messages }) => {
  const system = messages[0].content;
  let result;
  if (system.includes('Task Router')) {
    result = { taskType: ['document', 'explain'].includes(mode) ? 'document' : 'website' };
  } else if (system.includes('Document Analyst')) {
    if (mode === 'document') {
      assert.match(messages.at(-1).content, /revenue grew by 12 percent/);
      assert.match(messages.at(-1).content, /15 November/);
      assert.match(messages.at(-1).content, /Engineering owns the launch/);
    }
    result = { status: 'completed', title: mode === 'document' ? 'Launch summary' : 'Learning explained',
      markdown: mode === 'document' ? '# Launch summary\n\nRevenue grew 12%. The deadline is 15 November. Engineering owns the launch.\n\n<script>window.__documentInjected = true</script>' : '# Learning explained\n\nAn accessible explanation with examples.',
      sourcePaths: mode === 'document' ? ['notes.txt', 'report.pdf', 'plan.docx'] : [] };
  } else if (system.includes('sole implementation owner')) {
    result = { status: 'changes', done: true, changes: mode === 'edit'
      ? [{ action: 'update', path: 'css/main.css', content: 'h1 { color: rgb(255, 128, 0); }' }]
      : [
        { action: 'create', path: 'index.html', content: '<!DOCTYPE html><html><head><link rel="stylesheet" href="css/main.css"></head><body><h1 id="heading">Generated site</h1><p id="stored"></p><script type="module" src="js/app.js"></script></body></html>' },
        { action: 'create', path: 'css/main.css', content: 'h1 { color: rgb(0, 128, 128); }' },
        { action: 'create', path: 'js/app.js', content: 'document.getElementById("stored").textContent = String(localStorage.getItem("site-test"));' },
      ] };
  } else if (system.includes('QA Agent')) {
    result = { result: mode === 'edit' ? 'issues_found' : 'passed', issues: mode === 'edit' ? [{ severity: 'low', category: 'testing', description: 'Fixture finding to verify honest UI reporting' }] : [] };
  } else if (messages.at(-1).content.includes('synthesize the specialist specifications')) {
    result = { unified_specification: { entry_point: 'index.html' } };
  } else result = { selected_agents: [], explicit_requirements: [] };
  return { text: JSON.stringify(result), model: 'browser-fixture', cost: 0 };
};
const server = app.listen(0, '127.0.0.1');
const preview = previewApp.listen(0, '127.0.0.1');
await Promise.all([new Promise(r => server.once('listening', r)), new Promise(r => preview.once('listening', r))]);
config.previewPort = preview.address().port;
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const site = path.join(directory, 'site');
  await fs.mkdir(path.join(site, 'css'), { recursive: true });
  await fs.mkdir(path.join(site, 'js'), { recursive: true });
  await fs.mkdir(path.join(site, 'pages'), { recursive: true });
  await fs.writeFile(path.join(site, 'index.html'), '<!DOCTYPE html><html><head><link rel="stylesheet" href="/css/main.css"></head><body><h1 id="heading">Imported site</h1><a href="pages/about.html">About</a><script type="module" src="js/app.js"></script></body></html>');
  await fs.writeFile(path.join(site, 'css/main.css'), 'h1 { color: rgb(0, 0, 128); }');
  await fs.writeFile(path.join(site, 'js/app.js'), 'import { text } from "/js/shared.js"; localStorage.setItem("site-test", text); document.getElementById("heading").textContent = localStorage.getItem("site-test");');
  await fs.writeFile(path.join(site, 'js/shared.js'), 'export const text = "Modules loaded";');
  await fs.writeFile(path.join(site, 'pages/about.html'), '<!DOCTYPE html><html><body><h1>Nested page</h1></body></html>');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.route('https://**/*', route => route.abort());
  await page.goto(base);
  await page.locator('#navIde').click();
  await page.locator('#importProjectBtn').click();
  await page.locator('#projectFolderInput').setInputFiles(site);
  await page.locator('#importProjectName').fill('Browser imported site');
  await page.locator('#submitProjectImport').click();
  await page.waitForFunction(() => !document.getElementById('projectImportDialog').open);
  await page.waitForFunction(() => document.getElementById('ideFileCount').textContent.includes('5 files'));
  const id = await page.locator('#headerProjectSelect').inputValue();
  assert.ok(id && id !== '__new__');
  const modules = await page.evaluate(async () => {
    const a = await import('/js/agent-state.js?v=4');
    const b = await import('/js/pixi-office.js?v=4');
    a.agentStateManager.setHiredAgents(['manager-1', 'coder-1']);
    a.agentStateManager.updateAgentModel('coder-1', 'kimi-k3');
    return Boolean(b.PixiOffice) && a.agentStateManager.getAgent('coder-1').model === 'kimi-k3';
  });
  assert.equal(modules, true);

  // A sibling imported file with the same name must not be confused with index.html.
  await page.locator('#ideFileList summary').filter({ hasText: /^css$/ }).click();
  await page.locator('[data-file="css/main.css"]').click();
  await page.locator('#editFileBtn').click();
  await page.locator('#projectFileEditor').fill('h1 { color: rgb(0, 128, 0); }');
  await page.locator('#saveFileBtn').click();
  await page.waitForFunction(() => document.getElementById('ideFileCount').textContent.includes('r2'));
  await page.locator('#navPreview').click();
  const frame = page.frameLocator('#previewIframe');
  await frame.locator('#heading').waitFor();
  await page.waitForFunction(() => document.getElementById('previewIframe').src.includes('/p/'));
  assert.equal(await frame.locator('#heading').textContent(), 'Modules loaded');
  assert.equal(await frame.locator('#heading').evaluate(el => getComputedStyle(el).color), 'rgb(0, 128, 0)');
  const isolation = await frame.locator('#heading').evaluate(() => {
    try { void parent.document.body; return false; } catch { return true; }
  });
  assert.equal(isolation, true);
  await frame.getByText('About', { exact: true }).click();
  await frame.getByRole('heading', { name: 'Nested page' }).waitFor();
  assert.equal(await frame.locator('h1').textContent(), 'Nested page');

  await page.locator('#navIde').click();
  await page.locator('#projectHistoryBtn').click();
  await page.locator('#revisionList button').filter({ hasText: /^r2 / }).click();
  await page.locator('#revisionDiff').filter({ hasText: '+h1 { color: rgb(0, 128, 0); }' }).waitFor();
  assert.ok((await page.locator('#revisionDiff').textContent()).includes('+h1 { color: rgb(0, 128, 0); }'));
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.revision-row').filter({ has: page.locator('button', { hasText: /^r1 / }) }).getByText('Restore', { exact: true }).click();
  await page.waitForFunction(() => !document.getElementById('projectHistoryDialog').open);
  await page.waitForFunction(() => document.getElementById('ideFileCount').textContent.includes('r3'));
  await page.locator('#navPreview').click();
  await frame.locator('#heading').waitFor();
  assert.equal(await frame.locator('#heading').evaluate(el => getComputedStyle(el).color), 'rgb(0, 0, 128)');

  await page.locator('#navChat').click();
  await page.locator('#chatPromptInput').fill('Make the existing heading orange');
  await page.locator('#chatSendInlineBtn').click();
  await page.waitForFunction(() => document.getElementById('workspaceNotice').textContent.includes('Revision 4 saved. QA: issues_found'));
  assert.equal(await page.locator('#headerProjectSelect').inputValue(), id);
  await page.locator('#navPreview').click();
  await frame.locator('#heading').filter({ hasText: 'Modules loaded' }).waitFor();
  await page.waitForFunction(() => !document.getElementById('headerProjectSelect').disabled);
  assert.equal(await frame.locator('#heading').evaluate(el => getComputedStyle(el).color), 'rgb(255, 128, 0)');

  await page.locator('#headerProjectSelect').selectOption('__new__');
  await page.locator('#refreshPreviewBtn').click();
  assert.ok((await page.locator('#previewIframe').getAttribute('src')).includes('/api/preview'));

  mode = 'generate';
  await page.locator('#navChat').click();
  await page.locator('#chatPromptInput').fill('Create a three-file website');
  await page.locator('#chatSendInlineBtn').click();
  await page.waitForFunction(() => document.getElementById('workspaceNotice').textContent.includes('Revision 1 saved. QA: passed'));
  const generatedId = await page.locator('#headerProjectSelect').inputValue();
  assert.notEqual(generatedId, id);
  await page.locator('#navPreview').click();
  await frame.locator('#heading').filter({ hasText: 'Generated site' }).waitFor();
  await frame.locator('#stored').filter({ hasText: 'null' }).waitFor();
  assert.equal(await frame.locator('#heading').evaluate(el => getComputedStyle(el).color), 'rgb(0, 128, 128)');

  mode = 'document';
  await page.locator('#navChat').click();
  await page.locator('#viewChat .task-upload-btn').click();
  await page.locator('#projectFilesInput').setInputFiles([
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Engineering owns the launch.') },
    { name: 'report.pdf', mimeType: 'application/pdf', buffer: samplePdf() },
    { name: 'plan.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: sampleDocx() },
  ]);
  await page.locator('#importProjectName').fill('Uploaded source material');
  await page.locator('#submitProjectImport').click();
  await page.waitForFunction(() => !document.getElementById('projectImportDialog').open && !document.getElementById('headerProjectSelect').disabled);
  const documentId = await page.locator('#headerProjectSelect').inputValue();
  assert.notEqual(documentId, generatedId);
  assert.equal(await page.locator('#chatTaskType').inputValue(), 'auto');
  await page.locator('#chatPromptInput').fill('Summarize the uploaded files and explain the launch requirements for a beginner');
  await page.locator('#chatSendInlineBtn').click();
  await page.waitForFunction(() => document.getElementById('ideActiveFilename').textContent === 'documents/launch-summary.md' && !document.getElementById('headerProjectSelect').disabled);
  assert.match(await page.locator('#ideFileContent').textContent(), /Revenue grew 12%/);
  assert.match(await page.locator('#ideFileContent').textContent(), /Source coverage/);
  assert.equal(await page.evaluate(() => window.__documentInjected), undefined);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadProjectFile').click();
  assert.equal((await downloadPromise).suggestedFilename(), 'launch-summary.md');
  const documentFiles = await (await page.request.get(`${base}/api/projects/${documentId}/files`)).json();
  assert.equal(documentFiles.entryPoint, null);
  assert.equal(documentFiles.files.length, 4);
  assert.ok(!documentFiles.files.some(file => file.path.endsWith('.html')));
  assert.deepEqual(await (await page.request.get(`${base}/api/projects/${documentId}/files/report.pdf?download=true`)).body(), samplePdf());
  await page.locator('#navChat').click();
  await page.locator('#chatMessagesStream .document-result').getByRole('button', { name: 'Open Markdown' }).click();
  assert.equal(await page.locator('#ideActiveFilename').textContent(), 'documents/launch-summary.md');

  mode = 'explain';
  await page.locator('#headerProjectSelect').selectOption('__new__');
  await page.locator('#navChat').click();
  await page.locator('#chatTaskType').selectOption('document');
  await page.locator('#chatPromptInput').fill('Explain reinforcement learning with examples');
  await page.locator('#chatSendInlineBtn').click();
  await page.waitForFunction(() => document.getElementById('ideActiveFilename').textContent === 'documents/learning-explained.md' && !document.getElementById('headerProjectSelect').disabled);
  assert.match(await page.locator('#ideFileContent').textContent(), /No project files were attached/);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('Browser checks passed: website import/edit/preview/revisions, automatic website and document routing over HTTP/SSE, PDF/DOCX/text analysis, Markdown open/download, source preservation, and explanations without uploads.');
} finally {
  modelGateway.generate = generate;
  await browser?.close();
  server.closeAllConnections(); preview.closeAllConnections();
  await Promise.all([new Promise(r => server.close(r)), new Promise(r => preview.close(r))]);
  await fs.rm(directory, { recursive: true, force: true });
}
