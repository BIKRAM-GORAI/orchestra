process.env.TESTING_MONGODB = 'true';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  saveProjectHtml,
  getProjectHtml,
  getProject,
  saveAgentArtifact,
  getProjectFiles,
  getProjectFileContent,
  revertProjectHtml,
} from '../services/projectService.js';
import { getDb, closeMongo } from '../db/mongo.js';

test('Phase 8: MongoDB Project-Isolated Persistence & Versioning', async (t) => {
  const db = await getDb();
  if (!db) {
    console.warn('[TEST SKIPPED] MongoDB not configured. Skipping online persistence test.');
    return;
  }

  t.after(async () => {
    await closeMongo();
  });

  // 1. PROJECT CREATION & ISOLATION
  await t.test('1. Project Isolation: Project A and Project B have strictly isolated index.html files', async () => {
    const projA = await createProject({ name: 'Project Alpha', prompt: 'Build a fintech portal' });
    const projB = await createProject({ name: 'Project Beta', prompt: 'Build an ecommerce site' });

    assert.ok(projA.id);
    assert.ok(projB.id);
    assert.notEqual(projA.id, projB.id);

    const htmlA = '<!DOCTYPE html><html><body><h1>Fintech Portal Alpha</h1></body></html>';
    const htmlB = '<!DOCTYPE html><html><body><h1>Ecommerce Store Beta</h1></body></html>';

    // Save index.html for both projects
    await saveProjectHtml(projA.id, htmlA, 'Initial Fintech Generation');
    await saveProjectHtml(projB.id, htmlB, 'Initial Store Generation');

    // Retrieve both and verify complete isolation
    const fetchedA = await getProjectHtml(projA.id);
    const fetchedB = await getProjectHtml(projB.id);

    assert.equal(fetchedA, htmlA);
    assert.equal(fetchedB, htmlB);
    assert.notEqual(fetchedA, fetchedB);

    // Verify direct database query enforces projectId + filePath uniqueness
    const fileDocA = await db.collection('project_files').findOne({ projectId: projA.id, filePath: 'index.html' });
    const fileDocB = await db.collection('project_files').findOne({ projectId: projB.id, filePath: 'index.html' });

    assert.ok(fileDocA);
    assert.ok(fileDocB);
    assert.equal(fileDocA.projectId, projA.id);
    assert.equal(fileDocB.projectId, projB.id);
    assert.equal(fileDocA.version, 1);
    assert.equal(fileDocB.version, 1);
  });

  // 2. VERSIONING & PROGRESSIVE MODIFICATIONS
  await t.test('2. Versioning: Each modification increments version and records history', async () => {
    const proj = await createProject({ name: 'Versioned App', prompt: 'Create landing page' });
    const v1Content = '<!DOCTYPE html><html><body><h1>Version 1</h1></body></html>';
    const v2Content = '<!DOCTYPE html><html><body><h1>Version 2 - Updated Hero</h1></body></html>';
    const v3Content = '<!DOCTYPE html><html><body><h1>Version 3 - Added Pricing Table</h1></body></html>';

    // V1
    const p1 = await saveProjectHtml(proj.id, v1Content, 'Initial Build');
    assert.equal(p1.version, 1);

    // V2
    const p2 = await saveProjectHtml(proj.id, v2Content, 'Updated Hero section');
    assert.equal(p2.version, 2);

    // V3
    const p3 = await saveProjectHtml(proj.id, v3Content, 'Added Pricing Table');
    assert.equal(p3.version, 3);

    // Fetch latest
    const latestHtml = await getProjectHtml(proj.id);
    assert.equal(latestHtml, v3Content);

    // Check versions array in MongoDB
    const doc = await db.collection('project_files').findOne({ projectId: proj.id, filePath: 'index.html' });
    assert.equal(doc.version, 3);
    assert.equal(doc.versions.length, 3);
    assert.equal(doc.versions[0].version, 1);
    assert.equal(doc.versions[1].version, 2);
    assert.equal(doc.versions[2].version, 3);
  });

  // 3. CONCURRENCY & SAFE UPDATES
  await t.test('3. Safe Updates: Detects version conflict when expectedVersion does not match latest', async () => {
    const proj = await createProject({ name: 'Concurrency Test' });
    const baseHtml = '<!DOCTYPE html><html><body><h1>Base</h1></body></html>';
    const v2Html = '<!DOCTYPE html><html><body><h1>Version 2</h1></body></html>';
    await saveProjectHtml(proj.id, baseHtml); // Version 1

    // Update with correct expectedVersion: 1 -> produces Version 2
    await saveProjectHtml(proj.id, v2Html, 'Safe update', 1);

    // Attempting another update still expecting Version 1 must fail
    await assert.rejects(
      async () => {
        await saveProjectHtml(proj.id, '<!DOCTYPE html><html><body><h1>Stale Overwrite Attempt</h1></body></html>', 'Stale edit', 1);
      },
      /Concurrency conflict/
    );

    // Latest version must remain Version 2
    const current = await getProjectHtml(proj.id);
    assert.equal(current, v2Html);
  });

  // 4. SUB-AGENT ARTIFACT PERSISTENCE & MANAGER FLOW PRESERVATION
  await t.test('4. Sub-Agent Response Artifacts: Persists human-readable .md files scoped to project', async () => {
    const proj = await createProject({ name: 'Agent Artifacts Test' });

    // Simulate Sub-Agent completing task and returning direct response to Manager
    const directSpecialistResponse = {
      palette: ['#0F172A', '#38BDF8'],
      typography: 'Inter, sans-serif',
      layout: 'Grid-based single page',
    };

    // Sub-agent artifact persisted without altering direct response
    const artifact = await saveAgentArtifact({
      projectId: proj.id,
      agentId: 'frontend_architect',
      agentName: 'Nova (Frontend Architect)',
      task: 'Design single-file DOM hierarchy and style system',
      status: 'Completed',
      response: directSpecialistResponse,
    });

    assert.ok(artifact);
    assert.equal(artifact.projectId, proj.id);
    assert.equal(artifact.agentId, 'frontend_architect');
    assert.ok(artifact.path.includes('frontend_architect'));
    assert.ok(artifact.content.includes('# Sub-Agent Response'));
    assert.ok(artifact.content.includes('Nova (Frontend Architect)'));
    assert.ok(artifact.content.includes('#38BDF8'));

    // Check project file list returns both index.html and .md artifact
    await saveProjectHtml(proj.id, '<!DOCTYPE html><html><body><h1>App with Artifacts</h1></body></html>');
    const files = await getProjectFiles(proj.id);

    const hasHtml = files.some(f => f.name === 'index.html');
    const hasMd = files.some(f => f.extension === 'md' && f.path.includes('frontend_architect'));

    assert.ok(hasHtml, 'Files list must include index.html');
    assert.ok(hasMd, 'Files list must include sub-agent .md artifact');

    // Retrieve file content by path
    const mdContent = await getProjectFileContent(proj.id, artifact.path);
    assert.ok(mdContent.includes('# Sub-Agent Response'));
  });

  // 5. FUTURE REVERT CAPABILITY
  await t.test('5. Future Revert: Ability to rollback index.html to any previous version', async () => {
    const proj = await createProject({ name: 'Rollback Test' });
    const originalContent = '<!DOCTYPE html><html><body><h1>Original Clean Code</h1></body></html>';
    const buggyContent = '<!DOCTYPE html><html><body><h1>Unintended Breaking Change</h1></body></html>';

    await saveProjectHtml(proj.id, originalContent, 'Original clean build'); // v1
    await saveProjectHtml(proj.id, buggyContent, 'Buggy experimental change'); // v2

    assert.equal(await getProjectHtml(proj.id), buggyContent);

    // Revert to v1
    const revertedContent = await revertProjectHtml(proj.id, 1);
    assert.equal(revertedContent, originalContent);
    assert.equal(await getProjectHtml(proj.id), originalContent);
  });
});
