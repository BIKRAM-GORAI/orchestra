import { getProject, getProjectFile, getProjectFiles, applyProjectChanges } from './projectService.js';
import { fileInfo, normalizeFilePath, projectError, validateFileSet } from './filePaths.js';
import { inspectFile, resolveReference, validateWebsite } from './validationService.js';

const CONTEXT_LIMIT = 160000;
const MAX_ROUNDS = 12;

export async function projectFileSession(projectId, { fallbackHtml = null, entryPoint = 'index.html' } = {}) {
  const project = projectId ? await getProject(projectId) : null;
  if (projectId && !project) throw projectError('Project not found', 404);
  const files = projectId ? (await getProjectFiles(projectId)).filter(f => !f.artifact) : [];
  const originalPaths = new Set(files.map(f => f.path));
  const working = new Map(files.map(f => [f.path, { ...f, originalPath: f.path, changed: false }]));
  const readPaths = new Set();
  let stagedCount = 0;
  let currentEntry = project?.entryPoint || entryPoint;
  if (!projectId && fallbackHtml) working.set('index.html', { ...fileInfo('index.html'), content: fallbackHtml, size: Buffer.byteLength(fallbackHtml) });

  const read = async input => {
    const p = normalizeFilePath(input);
    const item = working.get(p);
    if (!item) throw projectError(`Source file not found: ${p}`);
    if (typeof item.content === 'string') return { ...item, data: Buffer.from(item.content) };
    const file = await getProjectFile(projectId, item.originalPath);
    if (!file || file.artifact) throw projectError(`Source file not found: ${p}`);
    return { ...file, ...fileInfo(p, file.data), content: file.binary ? null : file.data.toString('utf8') };
  };
  const tree = () => [...working.values()].map(f => ({ path: f.path, size: f.size, binary: f.binary }));
  const readBatch = async paths => {
    if (!Array.isArray(paths) || !paths.length || paths.length > 12) throw projectError('readFiles must contain 1–12 paths');
    const result = [];
    let size = 0;
    for (const input of new Set(paths)) {
      const file = await read(input);
      if (file.binary) result.push({ path: file.path, binary: true, size: file.size, message: 'Binary asset; preserve or rename/delete explicitly.' });
      else {
        size += file.content.length;
        if (size > CONTEXT_LIMIT) throw projectError('Requested files exceed context limit. Request fewer or smaller files.', 413);
        result.push({ path: file.path, content: file.content });
      }
    }
    // A failed oversized read must not authorize modifications to unread files.
    for (const file of result) readPaths.add(file.path);
    return result;
  };
  const seed = [];
  let seedSize = 0;
  if (working.has(currentEntry)) {
    const entry = await read(currentEntry);
    if (!entry.binary && entry.content.length <= CONTEXT_LIMIT / 2) {
      seed.push({ path: currentEntry, content: entry.content }); readPaths.add(currentEntry); seedSize += entry.content.length;
      const refs = inspectFile(entry).refs.map(r => resolveReference(currentEntry, r)).filter(p => working.has(p));
      for (const p of [...new Set(refs)].filter(p => p !== currentEntry).slice(0, 5)) {
        const f = await read(p);
        if (!f.binary && seedSize + f.content.length < CONTEXT_LIMIT) { seed.push({ path: p, content: f.content }); readPaths.add(p); seedSize += f.content.length; }
      }
    }
  }
  return { project, expectedRevision: project?.revision || 0, seed, tree, readBatch,
    get readPaths() { return [...readPaths]; },
    get entryPoint() { return currentEntry; },
    get changedCount() { return stagedCount; },
    stage(changes, newEntry) {
      if (!Array.isArray(changes) || (!changes.length && !newEntry)) throw projectError('Coding response contains no file changes');
      for (const change of changes) {
        const p = normalizeFilePath(change.path);
        const existing = working.get(p);
        const action = change.action || (existing ? 'update' : 'create');
        if (existing?.originalPath && !readPaths.has(p)) throw projectError(`Read ${p} before modifying it`);
        if (action === 'delete') {
          if (!existing) throw projectError(`Cannot delete missing file: ${p}`);
          working.delete(p);
        } else if (action === 'rename') {
          const to = normalizeFilePath(change.to);
          if (!existing || working.has(to)) throw projectError(`Invalid rename: ${p} → ${to}`);
          working.delete(p);
          working.set(to, { ...existing, ...fileInfo(to), binary: existing.binary });
          readPaths.add(to);
          if (currentEntry === p) currentEntry = to;
        } else if (['create', 'update', 'write'].includes(action)) {
          if (action === 'create' && existing) throw projectError(`File already exists: ${p}`);
          if (action === 'update' && !existing) throw projectError(`File not found: ${p}`);
          if (existing?.binary) throw projectError(`A text response cannot overwrite binary asset ${p}`);
          if (typeof change.content !== 'string') throw projectError(`Missing complete content for ${p}`);
          if (Buffer.byteLength(change.content) > 2 * 1024 * 1024) throw projectError('Generated text file exceeds 2 MB', 413);
          working.set(p, { ...fileInfo(p), originalPath: existing?.originalPath, changed: true, content: change.content, size: Buffer.byteLength(change.content) });
        } else throw projectError(`Unknown file action: ${action}`);
        stagedCount++;
      }
      validateFileSet([...working.values()]);
      if (newEntry) { currentEntry = normalizeFilePath(newEntry); stagedCount++; }
    },
    async candidate() { return Promise.all([...working.keys()].map(read)); },
    async commit(note) {
      const changes = [];
      const renamedSources = new Set();
      const renamedTargets = new Set();
      // Preserve simple renames in history. More involved batches (swaps,
      // replacing a deleted destination, or reusing the source path) are reduced
      // to a single write/delete per final path, all published in one revision.
      for (const [p, f] of working) {
        if (f.originalPath && f.originalPath !== p && !f.changed && !originalPaths.has(p) && !working.has(f.originalPath)) {
          changes.push({ action: 'rename', path: f.originalPath, to: p });
          renamedSources.add(f.originalPath); renamedTargets.add(p);
        }
      }
      for (const p of originalPaths) if (!working.has(p) && !renamedSources.has(p)) changes.push({ action: 'delete', path: p });
      for (const [p, f] of working) {
        if (renamedTargets.has(p) || (f.originalPath === p && !f.changed)) continue;
        changes.push({ action: originalPaths.has(p) ? 'update' : 'create', path: p, data: (await read(p)).data });
      }
      const candidates = await this.candidate();
      const validation = validateWebsite(candidates, currentEntry);
      if (!projectId) return { revision: 0, changes, validation, files: candidates };
      const result = await applyProjectChanges(projectId, changes, { expectedRevision: this.expectedRevision, entryPoint: working.has(currentEntry) ? currentEntry : undefined, note, source: 'agent', validate: validateWebsite });
      return { ...result, files: candidates };
    },
  };
}

export async function runFileAgent(agent, session, { input, context = {}, gateway, onChunk, onExecution, mode = 'coding' }) {
  let fileContents = session.seed;
  let lastResponse = null;
  const summaries = [];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const output = await agent.execute({ input, context: { ...context, entry_point: session.entryPoint, file_tree: session.tree(), files: fileContents,
      already_read_paths: session.readPaths, previous_result: lastResponse, round: round + 1 }, gateway, onChunk });
    onExecution?.(output);
    const result = output.result;
    if (!result || typeof result !== 'object' || result.parseError) throw projectError(`${agent.name} returned invalid JSON; no source files were changed`, 422);
    if (result.status === 'read_files') {
      try { fileContents = await session.readBatch(result.readFiles); lastResponse = 'Requested files loaded. Return requested changes or request more files.'; }
      catch (err) { lastResponse = err.message; fileContents = []; }
      continue;
    }
    if (mode === 'qa') {
      if (!['passed', 'issues_found'].includes(result.result) || !Array.isArray(result.issues) || result.issues.some(i => !i || typeof i.description !== 'string')) throw projectError('QA returned an invalid audit report', 422);
      return result;
    }
    let changes = result.changes;
    if (!changes && (result.artifact?.content || result.file?.content)) {
      const artifact = result.artifact || result.file;
      changes = [{ action: session.tree().some(f => f.path === 'index.html') ? 'update' : 'create', path: 'index.html', content: artifact.content }];
    }
    if (changes?.length || result.entryPoint) {
      session.stage(changes || [], result.entryPoint);
      if (result.summary) summaries.push(result.summary);
    } else if (!session.changedCount) throw projectError('Coding Agent returned no changes', 422);
    if (result.done !== false) return { summary: summaries, output };
    fileContents = [];
    lastResponse = 'Batch staged in memory. Continue the remaining files from the plan. Request read_files to inspect staged content.';
  }
  throw projectError('Agent exceeded the 12-round file protocol limit; no source files were changed', 422);
}
