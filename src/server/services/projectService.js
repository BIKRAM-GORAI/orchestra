import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createTwoFilesPatch } from 'diff';
import lockfile from 'proper-lockfile';
import { getDb } from '../db/mongo.js';
import { config } from '../config/env.js';
import { atomicWrite, storeBlob, readBlob } from './blobStore.js';
import { fileInfo, normalizeFilePath, projectDiskPath, projectError, validateProjectId, validateFileSet, shouldSkipUpload } from './filePaths.js';

const locks = new Map();
async function withProjectLock(id, task) {
  validateProjectId(id);
  const previous = locks.get(id) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    if (config.mongoUri) return task();
    const directory = await projectDiskPath(id, '.orchestra', { internal: true });
    await fs.mkdir(directory, { recursive: true });
    const release = await lockfile.lock(directory, { realpath: false, lockfilePath: path.join(directory, 'write.lock'), stale: 30000, retries: { retries: 20, minTimeout: 25, maxTimeout: 250 } });
    try { return await task(); } finally { await release(); }
  });
  locks.set(id, next);
  try { return await next; } finally { if (locks.get(id) === next) locks.delete(id); }
}

export function generateProjectId(name = 'project') {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30) || 'project';
  return `${slug}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

async function readLocalMeta(id) {
  try { return JSON.parse(await fs.readFile(await projectDiskPath(id, 'project.json', { internal: true }), 'utf8')); }
  catch (err) { if (err.code === 'ENOENT') return null; throw err; }
}

export async function getProject(id) {
  if (!id) return null;
  validateProjectId(id);
  const db = await getDb();
  const doc = db ? await db.collection('projects').findOne({ id }) : null;
  if (doc) { const { _id, ...meta } = doc; return meta; }
  return readLocalMeta(id);
}

// The metadata manifest is the commit point. Blobs/revision records are immutable
// and written first. Readers see the old or new manifest, never a half-written batch.
async function persistMeta(meta, previous = null) {
  const db = await getDb();
  if (db) {
    const existing = await db.collection('projects').findOne({ id: meta.id });
    if (existing) {
      const generation = previous?._generation;
      const filter = { id: meta.id, _generation: generation ?? { $exists: false } };
      const result = await db.collection('projects').replaceOne(filter, meta);
      if (result.matchedCount !== 1) throw projectError('Project changed during save. Reload and retry.', 409);
    } else {
      try { await db.collection('projects').insertOne({ ...meta }); }
      catch (err) { if (err.code === 11000) throw projectError('Project changed during save', 409); throw err; }
    }
    // Disk is a best-effort mirror when MongoDB is the authoritative store.
    try { await atomicWrite(await projectDiskPath(meta.id, 'project.json', { internal: true }), JSON.stringify(meta, null, 2)); }
    catch (err) { console.warn('[PROJECT MIRROR]', err.message); }
  } else {
    await atomicWrite(await projectDiskPath(meta.id, 'project.json', { internal: true }), JSON.stringify(meta, null, 2));
  }
}

export async function createProject({ name = 'New Project', prompt = '' } = {}) {
  if (typeof name !== 'string' || !name.trim() || typeof prompt !== 'string') throw projectError('Project name and prompt must be text');
  const now = new Date().toISOString();
  const meta = { id: generateProjectId(name), name: name.trim().slice(0, 150), prompt,
    createdAt: now, updatedAt: now, status: 'created', version: 0, revision: 0,
    schemaVersion: 2, _generation: 0, files: [], manifest: {}, artifacts: {}, history: [],
    entryPoint: 'index.html', projectType: 'static', managerPlan: null, specialistOutputs: {}, unifiedSpec: null, qaReport: null };
  await persistMeta(meta);
  return meta;
}

export async function updateProject(id, updates = {}) {
  return withProjectLock(id, async () => {
    const project = await getProject(id);
    if (!project) throw projectError('Project not found', 404);
    const { id: ignoredId, manifest, artifacts, history, revision, _generation, ...safeUpdates } = updates;
    const next = { ...project, ...safeUpdates, _generation: (project._generation || 0) + 1, updatedAt: new Date().toISOString() };
    await persistMeta(next, project);
    return next;
  });
}

export async function listProjects() {
  const db = await getDb();
  const projects = new Map();
  if (db) for (const { _id, ...doc } of await db.collection('projects').find({}).toArray()) projects.set(doc.id, doc);
  try {
    for (const entry of await fs.readdir(config.projectsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || projects.has(entry.name)) continue;
      try { const meta = await readLocalMeta(entry.name); if (meta) projects.set(meta.id, meta); } catch { /* Ignore non-project folders. */ }
    }
  } catch (err) { if (err.code !== 'ENOENT') throw err; }
  return [...projects.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function legacyFiles(id) {
  const files = new Map();
  const db = await getDb();
  if (db) {
    for (const file of await db.collection('project_files').find({ projectId: id }).toArray()) {
      const p = normalizeFilePath(file.filePath || file.filename);
      const data = Buffer.from(file.content || '', 'utf8');
      files.set(p, { ...fileInfo(p, data), data, size: data.length, version: file.version || 1 });
    }
  }
  async function walk(prefix = '') {
    let entries;
    try { entries = await fs.readdir(await projectDiskPath(id, prefix), { withFileTypes: true }); }
    catch (err) { if (err.code === 'ENOENT') return; throw err; }
    for (const entry of entries) {
      const p = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (shouldSkipUpload(p) || p === 'project.json' || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(p);
      else if (entry.isFile() && !files.has(p)) {
        normalizeFilePath(p);
        const data = await fs.readFile(await projectDiskPath(id, p));
        files.set(p, { ...fileInfo(p, data), data, size: data.length, version: 1 });
      }
    }
  }
  await walk();
  return [...files.values()];
}

export async function getProjectFiles(id) {
  const project = await getProject(id);
  if (!project) throw projectError('Project not found', 404);
  const files = project.manifest
    ? [...Object.values(project.manifest), ...Object.values(project.artifacts || {})]
    : await legacyFiles(id);
  return files.map(({ data, blob, ...info }) => info).sort((a, b) => a.path.localeCompare(b.path));
}

export async function getProjectFile(id, filePath, { revision = null } = {}) {
  const p = normalizeFilePath(filePath);
  const project = await getProject(id);
  if (!project) throw projectError('Project not found', 404);
  const snapshot = revision !== null ? await getRevision(id, revision) : null;
  const manifest = snapshot?.manifest || project.manifest;
  if (manifest) {
    const file = manifest[p] || (revision === null ? project.artifacts?.[p] : null);
    if (!file) return null;
    return { ...file, data: await readBlob(id, file.blob) };
  }
  return (await legacyFiles(id)).find(f => f.path === p) || null;
}

export async function getProjectFileContent(id, p) {
  const file = await getProjectFile(id, p);
  return file && !file.binary ? file.data.toString('utf8') : null;
}

export async function getProjectHtml(id) {
  if (!id) return null;
  const project = await getProject(id);
  return project ? getProjectFileContent(id, project.entryPoint || 'index.html') : null;
}

async function descriptor(id, p, data, version = 1, extra = {}) {
  return { ...fileInfo(p, data), ...extra, size: data.length, version, updatedAt: new Date().toISOString(), blob: await storeBlob(id, data) };
}

async function storeRevision(id, record) {
  const db = await getDb();
  if (db) await db.collection('project_revisions').insertOne({ projectId: id, ...record });
  else await atomicWrite(await projectDiskPath(id, `.orchestra/revisions/${record.id}.json`, { internal: true }), JSON.stringify(record));
}

export async function getRevision(id, number) {
  const project = await getProject(id);
  const n = Number(number);
  if (!Number.isInteger(n) || n < 0) throw projectError('Invalid revision');
  const item = project?.history?.find(h => h.revision === n);
  if (!item) throw projectError('Revision not found', 404);
  const db = await getDb();
  const record = db ? await db.collection('project_revisions').findOne({ projectId: id, id: item.id })
    : JSON.parse(await fs.readFile(await projectDiskPath(id, `.orchestra/revisions/${item.id}.json`, { internal: true }), 'utf8'));
  if (!record) throw projectError('Revision snapshot not found', 404);
  return record;
}

export async function applyProjectChanges(id, changes, { expectedRevision, note = 'Project updated', entryPoint, projectType, validate = null, source = 'user', task } = {}) {
  if (!Array.isArray(changes) || (!changes.length && !entryPoint) || changes.length > 500) throw projectError('Provide file changes or an entry point');
  return withProjectLock(id, async () => {
    const project = await getProject(id);
    if (!project) throw projectError('Project not found', 404);
    const currentRevision = project.revision || 0;
    if (expectedRevision !== undefined && expectedRevision !== currentRevision) throw projectError('Concurrency conflict: project revision changed. Reload and retry.', 409);
    const before = { ...(project.manifest || {}) };
    if (!project.manifest) {
      for (const file of await legacyFiles(id)) before[file.path] = await descriptor(id, file.path, file.data, file.version);
    }
    const next = { ...before };
    const staged = new Map();
    const touched = new Set();
    const summaries = [];
    for (const change of changes) {
      const p = normalizeFilePath(change.path);
      if (project.artifacts?.[p]) throw projectError(`Path belongs to an agent report: ${p}`);
      if (touched.has(p.toLowerCase())) throw projectError(`Duplicate change: ${p}`);
      touched.add(p.toLowerCase());
      const action = change.action || 'write';
      const existing = next[p];
      if (action === 'delete' || action === 'rename') {
        if (!existing) throw projectError(`File not found: ${p}`, 404);
        delete next[p];
        if (action === 'rename') {
          const to = normalizeFilePath(change.to);
          if (next[to] || touched.has(to.toLowerCase()) || project.artifacts?.[to]) throw projectError(`Rename destination already exists: ${to}`);
          touched.add(to.toLowerCase());
          next[to] = { ...existing, ...fileInfo(to), binary: existing.binary, version: existing.version + 1 };
          summaries.push({ action, path: p, to });
        } else summaries.push({ action, path: p });
      } else if (['create', 'update', 'write'].includes(action)) {
        if (action === 'create' && existing) throw projectError(`File already exists: ${p}`, 409);
        if (action === 'update' && !existing) throw projectError(`File not found: ${p}`, 404);
        if (!Buffer.isBuffer(change.data) && typeof change.content !== 'string') throw projectError(`Missing file content: ${p}`);
        const data = change.data || Buffer.from(change.content, 'utf8');
        staged.set(p, data);
        next[p] = { ...fileInfo(p, data), size: data.length, version: (existing?.version || 0) + 1, updatedAt: new Date().toISOString() };
        summaries.push({ action: existing ? 'update' : 'create', path: p });
      } else throw projectError(`Unknown file action: ${action}`);
    }
    validateFileSet([...Object.values(next), ...Object.values(project.artifacts || {})]);
    let nextEntry = entryPoint === undefined ? (project.entryPoint || 'index.html') : normalizeFilePath(entryPoint);
    if (entryPoint && !/\.html?$/i.test(entryPoint)) throw projectError('The static entry point must be an HTML file');
    const renamedEntry = summaries.find(c => c.action === 'rename' && c.path === nextEntry);
    if (renamedEntry) nextEntry = renamedEntry.to;
    if (!next[nextEntry]) {
      if (entryPoint !== undefined) throw projectError(`Entry point not found: ${nextEntry}`);
      nextEntry = Object.keys(next).find(p => p === 'index.html') || Object.keys(next).find(p => /\.html?$/i.test(p)) || null;
    }
    const loadCandidate = async () => Promise.all(Object.entries(next).map(async ([p, f]) => ({ ...f, data: staged.get(p) || await readBlob(id, f.blob) })));
    const validation = validate ? await validate(await loadCandidate(), nextEntry) : null;
    for (const [p, data] of staged) next[p] = await descriptor(id, p, data, next[p].version);
    const history = [...(project.history || []).filter(h => h.id)];
    // Preserve a baseline for old single-file projects on their first edit.
    if (!project.manifest && Object.keys(before).length) {
      const baseline = { id: randomUUID(), revision: 0, version: 0, note: 'Imported legacy baseline', timestamp: new Date().toISOString(), changes: [], manifest: before, entryPoint: project.entryPoint || 'index.html', parentId: null };
      await storeRevision(id, baseline);
      const { manifest, ...entry } = baseline;
      history.push(entry);
    }
    const revision = currentRevision + 1;
    const nextType = projectType || (project.projectType === 'source-only' ? 'source-only' : nextEntry ? 'static' : 'documents');
    const record = { id: randomUUID(), revision, version: revision, note: String(note).slice(0, 2000), timestamp: new Date().toISOString(), changes: summaries, manifest: next, entryPoint: nextEntry, projectType: nextType, parentId: history.at(-1)?.id || null, source, ...(task ? { task } : {}) };
    await storeRevision(id, record);
    const { manifest, ...historyEntry } = record;
    const updated = { ...project, schemaVersion: 2, manifest: next, entryPoint: nextEntry, projectType: record.projectType,
      files: [...Object.keys(next), ...Object.keys(project.artifacts || {})], revision, version: revision, history: [...history, historyEntry],
      status: source === 'import' ? 'imported' : 'generated', qaReport: source === 'document' ? project.qaReport : null, validation: source === 'document' ? project.validation : validation,
      ...(task !== undefined ? { lastTask: task ? { ...task, revision } : null } : {}), _generation: (project._generation || 0) + 1, updatedAt: record.timestamp };
    await persistMeta(updated, project);
    // Compatibility mirrors are never used by readers once the manifest exists.
    try {
      for (const c of summaries) if (c.action === 'delete' || c.action === 'rename') await fs.rm(await projectDiskPath(id, c.path), { force: true });
      for (const c of summaries) {
        const p = c.to || c.path;
        if (next[p]) await atomicWrite(await projectDiskPath(id, p), staged.get(p) || await readBlob(id, next[p].blob));
      }
    } catch (err) { console.warn('[PROJECT MIRROR]', err.message); }
    return { project: updated, revision, changes: summaries, validation };
  });
}

export async function saveProjectHtml(id, content, note = 'Initial Generation', expectedVersion = null) {
  const project = await getProject(id);
  if (expectedVersion !== null && project?.version !== expectedVersion) throw projectError('Concurrency conflict: file version changed', 409);
  const result = await applyProjectChanges(id, [{ path: 'index.html', content }], { expectedRevision: project?.revision || 0, note });
  // Legacy API compatibility only. Multi-file builds never depend on this mirror.
  await atomicWrite(config.workspaceIndexHtml, content);
  return result.project;
}

export async function saveProjectFile(id, { filePath, content = '', agentId = 'system', agentName = 'Specialist', type = 'markdown' }) {
  const p = normalizeFilePath(filePath);
  if (type !== 'markdown') return applyProjectChanges(id, [{ path: p, content }]);
  return withProjectLock(id, async () => {
    const project = await getProject(id);
    if (!project) throw projectError('Project not found', 404);
    if (project.manifest?.[p]) throw projectError(`Source file already occupies report path: ${p}`, 409);
    const file = await descriptor(id, p, Buffer.from(content), (project.artifacts?.[p]?.version || 0) + 1, { artifact: true, agentId, agentName });
    const artifacts = { ...project.artifacts, [p]: file };
    validateFileSet([...Object.values(project.manifest || {}), ...Object.values(artifacts)]);
    const next = { ...project, artifacts, _generation: (project._generation || 0) + 1 };
    await persistMeta(next, project);
    return file;
  });
}

export async function saveAgentArtifact({ projectId, agentId, agentName = agentId, task = '', response = '', filename } = {}) {
  if (!projectId || !agentId) return null;
  const p = `agents/${agentId}/${filename || `response-${randomUUID()}.md`}`;
  const content = `# Sub-Agent Response\n\n## Agent\n${agentName}\n\n## Task\n${task}\n\n## Response\n\n${typeof response === 'string' ? response : JSON.stringify(response, null, 2)}\n`;
  const file = await saveProjectFile(projectId, { filePath: p, content, agentId, agentName });
  return { ...file, projectId, content };
}

export async function getAgentArtifacts(id) {
  return (await getProjectFiles(id)).filter(f => f.artifact);
}

export async function getRevisionDiff(id, number) {
  const revision = await getRevision(id, number);
  const project = await getProject(id);
  const parent = project.history.find(h => h.id === revision.parentId);
  const before = parent ? (await getRevision(id, parent.revision)).manifest : {};
  const diffs = [];
  for (const change of revision.changes) {
    const a = before[change.path];
    const b = revision.manifest[change.to || change.path];
    const binary = Boolean(a?.binary || b?.binary);
    let patch = '';
    if (!binary && (a?.size || 0) + (b?.size || 0) <= 1024 * 1024) {
      patch = createTwoFilesPatch(change.path, change.to || change.path,
        a ? (await readBlob(id, a.blob)).toString('utf8') : '', b ? (await readBlob(id, b.blob)).toString('utf8') : '', '', '', { context: 3 });
    }
    diffs.push({ ...change, binary, patch: patch || 'Binary or large file: textual diff omitted.', beforeSize: a?.size || 0, afterSize: b?.size || 0 });
  }
  return { revision: revision.revision, note: revision.note, changes: diffs };
}

export async function restoreRevision(id, number, expectedRevision) {
  const target = await getRevision(id, number);
  const project = await getProject(id);
  const changes = [];
  for (const p of Object.keys(project.manifest || {})) if (!target.manifest[p]) changes.push({ action: 'delete', path: p });
  for (const [p, file] of Object.entries(target.manifest)) {
    if (project.manifest?.[p]?.blob !== file.blob) changes.push({ action: 'write', path: p, data: await readBlob(id, file.blob) });
  }
  if (!changes.length && project.entryPoint === target.entryPoint) throw projectError('Project already matches this revision');
  return applyProjectChanges(id, changes, { expectedRevision, entryPoint: target.entryPoint || undefined, projectType: target.projectType, note: `Restored revision ${number}`, source: 'restore', task: target.task || null });
}

export async function revertProjectHtml(id, number) {
  const project = await getProject(id);
  await restoreRevision(id, number, project.revision);
  return getProjectHtml(id);
}
