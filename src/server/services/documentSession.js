import { getProjectFiles, getProjectFile, applyProjectChanges } from './projectService.js';
import { normalizeFilePath, projectError } from './filePaths.js';
import { extractDocumentText } from './documentText.js';

const MAX_EXCERPT = 16000;
const MAX_ROUNDS = 12;

export function validateDocumentPath(value) {
  const path = normalizeFilePath(value);
  if (!/\.md$/i.test(path)) throw projectError('Document output must use a .md extension');
  return path;
}

function availablePath(files, title) {
  const stem = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'response';
  const paths = files.map(f => f.path.toLowerCase());
  // Avoid both overwrites and file/directory collisions, including imported files
  // that happen to occupy the normal "documents" folder name.
  for (let n = 1; n < 1000; n++) {
    const name = `${stem}${n === 1 ? '' : `-${n}`}.md`;
    const candidate = paths.includes('documents') ? name : `documents/${name}`;
    try { validateDocumentPath(candidate); } catch { continue; }
    if (!paths.some(p => p === candidate || p.startsWith(candidate + '/') || candidate.startsWith(p + '/'))) return candidate;
  }
  throw projectError('Choose an unused output path');
}

export async function createDocumentSession(project, prompt) {
  const allFiles = await getProjectFiles(project.id);
  const files = allFiles.filter(f => !f.artifact);
  const cache = new Map();
  const coverage = new Map();
  const snapshot = project.revision > 0 && project.history?.some(h => h.revision === project.revision) ? project.revision : null;
  const readBatch = async requests => {
    if (!Array.isArray(requests) || !requests.length || requests.length > 6) throw projectError('Request 1–6 file excerpts per turn');
    const excerpts = [];
    const pending = new Map();
    for (const request of requests) {
      const { path: input, offset = 0, limit = MAX_EXCERPT } = typeof request === 'string' ? { path: request } : request || {};
      const path = normalizeFilePath(input);
      if (!files.some(f => f.path === path)) throw projectError(`Source file not found: ${path}`);
      if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > MAX_EXCERPT) throw projectError('Invalid excerpt offset or limit (maximum 16000 characters)');
      if (!cache.has(path)) {
        if (cache.size >= 8) cache.delete(cache.keys().next().value);
        const file = await getProjectFile(project.id, path, { revision: snapshot });
        try { cache.set(path, await extractDocumentText(file)); }
        catch (error) { cache.set(path, { error: error.message }); }
      }
      const document = cache.get(path);
      if (document.error) {
        pending.set(path, { path, error: document.error, ranges: [] });
        excerpts.push({ path, error: document.error }); continue;
      }
      if (offset > document.text.length) throw projectError(`Offset exceeds extracted text length for ${path}`);
      const end = Math.min(offset + limit, document.text.length);
      const previous = pending.get(path) || coverage.get(path);
      const item = { path, totalChars: document.text.length, truncated: document.truncated, ranges: [...(previous?.ranges || []), [offset, end]] };
      pending.set(path, item);
      excerpts.push({ path, offset, nextOffset: end, totalChars: document.text.length, hasMore: end < document.text.length, truncated: document.truncated, content: document.text.slice(offset, end) });
    }
    for (const [path, item] of pending) coverage.set(path, item);
    return excerpts;
  };
  const sources = () => files.map(file => {
    const item = coverage.get(file.path);
    if (!item) return { path: file.path, status: 'unread' };
    if (item.error) return { path: file.path, status: 'unavailable', reason: item.error };
    let charsRead = 0, end = 0;
    for (const [a, b] of [...item.ranges].sort((a, b) => a[0] - b[0])) { charsRead += Math.max(0, b - Math.max(a, end)); end = Math.max(end, b); }
    return { path: file.path, status: charsRead === item.totalChars && !item.truncated ? 'read' : 'partial', charsRead, totalChars: item.totalChars, truncated: item.truncated };
  });
  const seedPaths = [...files].sort((a, b) => {
    const score = f => Number(prompt.toLowerCase().includes(f.path.toLowerCase())) * 10 + Number(!f.binary || /\.(pdf|docx)$/i.test(f.path));
    return score(b) - score(a);
  }).slice(0, 4).map(f => f.path);
  const seed = seedPaths.length ? await readBatch(seedPaths) : [];
  return { files, allFiles, seed, readBatch, sources };
}

export async function writeDocument({ project, prompt, agent, outputPath, gateway, onExecution, onReading }) {
  if (outputPath !== undefined) outputPath = validateDocumentPath(outputPath);
  const session = await createDocumentSession(project, prompt);
  if (outputPath && session.allFiles.some(f => f.path.toLowerCase() === outputPath.toLowerCase())) throw projectError('Output file already exists. Choose a new Markdown path to preserve the original.', 409);
  let excerpts = session.seed, notes = '', lastResult = '';
  for (let round = 0; round < MAX_ROUNDS; round++) {
    onReading?.({ round: round + 1, sources: session.sources() });
    const output = await agent.execute({ input: prompt, gateway, context: {
      file_tree: session.files.map(f => ({ path: f.path, size: f.size, binary: f.binary })),
      source_coverage: session.sources(), excerpts, notes, previous_result: lastResult, round: round + 1, remaining_turns: MAX_ROUNDS - round,
    } });
    onExecution?.(output);
    const result = output.result;
    if (!result || result.parseError) throw projectError('Document Analyst returned invalid JSON; no document was saved', 422);
    if (result.status === 'read_files') {
      if (result.notes !== undefined && (typeof result.notes !== 'string' || result.notes.length > 24000)) throw projectError('Document notes exceed the context limit', 422);
      notes = result.notes ?? notes;
      try { excerpts = await session.readBatch(result.readFiles); lastResult = 'Requested excerpts loaded.'; }
      catch (error) { excerpts = []; lastResult = error.message; }
      continue;
    }
    if (result.status !== 'completed' || typeof result.markdown !== 'string' || !result.markdown.trim() || Buffer.byteLength(result.markdown) > 2 * 1024 * 1024) throw projectError('Document Analyst must return a complete non-empty Markdown document (up to 2 MB)', 422);
    if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(result.markdown)) throw projectError('Expected a Markdown document, not a website', 422);
    const sources = session.sources();
    const readSources = sources.filter(s => ['read', 'partial'].includes(s.status));
    if (session.files.length && !readSources.length) throw projectError(`No readable source text was available. ${sources.find(s => s.reason)?.reason || 'Upload text, code, a text-based PDF, or DOCX.'}`, 422);
    if (!Array.isArray(result.sourcePaths) || result.sourcePaths.some(p => !readSources.some(s => s.path === p))) throw projectError('Document cites a source that was not read', 422);
    const warnings = sources.filter(s => s.status !== 'read').map(s => `${s.path}: ${s.reason || (s.status === 'partial' ? 'only part of the source text was inspected' : 'not inspected for this response')}`);
    const title = typeof result.title === 'string' && result.title.trim() ? result.title.trim().slice(0, 150) : 'Response';
    const path = outputPath === undefined ? availablePath(session.allFiles, title) : validateDocumentPath(outputPath);
    const coverage = sources.length ? sources.map(s => `- ${JSON.stringify(s.path)} — ${s.status}${s.charsRead !== undefined ? ` (${s.charsRead}/${s.totalChars} extracted characters${s.truncated ? '; extraction truncated' : ''})` : ''}${s.reason ? `: ${s.reason}` : ''}`).join('\n') : 'No project files were attached. This response uses the user request and general model knowledge.';
    const markdown = `${result.markdown.trim()}\n\n---\n\n## Source coverage\n\n${coverage}\n`;
    const document = { path, title, sources, warnings };
    const saved = await applyProjectChanges(project.id, [{ action: 'create', path, content: markdown }], {
      expectedRevision: project.revision || 0, source: 'document', note: `Document: ${title}`,
      task: { taskType: 'document', prompt, document },
    });
    return { taskType: 'document', projectId: project.id, revision: saved.revision, changes: saved.changes, document };
  }
  throw projectError('Document analysis exceeded the 12-turn limit; no document was saved', 422);
}
