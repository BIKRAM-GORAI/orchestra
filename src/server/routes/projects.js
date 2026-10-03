import express from 'express';
import multer from 'multer';
import { config } from '../config/env.js';
import { orchestrator } from '../orchestrator/orchestrator.js';
import { createProject, getProject, listProjects, getProjectFiles, getProjectFile, applyProjectChanges, getRevisionDiff, restoreRevision } from '../services/projectService.js';
import { importProject, readZip } from '../services/importService.js';
import { FILE_LIMITS, projectError } from '../services/filePaths.js';
import { validateWebsite } from '../services/validationService.js';

export const projectsRouter = express.Router();
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const upload = multer({
  preservePath: true,
  storage: {
    _handleFile(req, file, done) {
      const chunks = [];
      let size = 0;
      let finished = false;
      file.stream.on('data', chunk => {
        if (finished) return;
        size += chunk.length;
        req.uploadedBytes = (req.uploadedBytes || 0) + chunk.length;
        if (req.uploadedBytes > FILE_LIMITS.totalBytes) {
          finished = true; done(projectError('Upload exceeds 50 MB', 413));
        } else chunks.push(chunk);
      });
      file.stream.on('error', err => { if (!finished) { finished = true; done(err); } });
      file.stream.on('end', () => { if (!finished) { finished = true; done(null, { buffer: Buffer.concat(chunks), size }); } });
    },
    _removeFile(req, file, done) { delete file.buffer; done(null); },
  },
  limits: { files: FILE_LIMITS.count, fileSize: FILE_LIMITS.archiveBytes, fields: 8, fieldSize: 256 * 1024, parts: FILE_LIMITS.count + 8 },
}).array('files', FILE_LIMITS.count);

export function publicProject(project) {
  if (!project) return null;
  const { manifest, artifacts, _generation, ...meta } = project;
  return { ...meta, revision: project.revision || 0, fileCount: manifest ? Object.keys(manifest).length : (project.files || []).length };
}

export function previewUrl(req, project) {
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(req.hostname);
  const hostname = local ? `${project.id}.localhost` : (req.hostname.includes(':') ? `[${req.hostname}]` : req.hostname);
  const isCloudSinglePort = Boolean(process.env.RENDER || process.env.SINGLE_PORT === 'true');
  const origin = config.previewOrigin
    ? config.previewOrigin.replaceAll('{projectId}', project.id)
    : (isCloudSinglePort ? `${req.protocol}://${req.get('host')}` : `${req.protocol}://${hostname}:${config.previewPort}`);
  if (!isCloudSinglePort && new URL(origin).origin === `${req.protocol}://${req.get('host')}`) throw projectError('PREVIEW_ORIGIN must use a separate origin from the studio', 500);
  return `${origin.replace(/\/$/, '')}/p/${encodeURIComponent(project.id)}/${(project.entryPoint || 'index.html').split('/').map(encodeURIComponent).join('/')}`;
}

function requireRevision(req) {
  if (!Number.isInteger(req.body.expectedRevision) || req.body.expectedRevision < 0) throw projectError('expectedRevision is required');
  return req.body.expectedRevision;
}

function assertIdle(id) {
  if (orchestrator.running.has(id)) throw projectError('Wait for the active agent run before changing project files', 409);
}

async function handleImport(req, res) {
  if (!req.files?.length) throw projectError('Select a ZIP, folder, or files to upload');
  const archive = req.files.length === 1 && /\.zip$/i.test(req.files[0].originalname);
  let files;
  if (archive) files = await readZip(req.files[0].buffer);
  else {
    let paths;
    try { paths = req.body.paths ? JSON.parse(req.body.paths) : req.files.map(f => f.originalname); }
    catch { throw projectError('Invalid upload paths'); }
    if (!Array.isArray(paths) || paths.length !== req.files.length) throw projectError('Upload paths must match the selected files');
    files = req.files.map((file, index) => ({ path: paths[index], data: file.buffer }));
  }
  if (req.params.id) assertIdle(req.params.id);
  const result = await importProject({ files, name: req.body.name, projectId: req.params.id,
    expectedRevision: req.body.expectedRevision === undefined ? undefined : Number(req.body.expectedRevision),
    stripRoot: req.body.stripRoot === 'true' || (archive && req.body.stripRoot !== 'false'), entryPoint: req.body.entryPoint });
  res.status(201).json({ status: 'success', ...result, project: publicProject(result.project), projectId: result.project.id });
}

projectsRouter.get('/', asyncRoute(async (req, res) => res.json({ projects: (await listProjects()).map(publicProject) })));
projectsRouter.post('/', asyncRoute(async (req, res) => res.status(201).json({ project: publicProject(await createProject(req.body)) })));
projectsRouter.post('/import', upload, asyncRoute(handleImport));
projectsRouter.post('/:id/import', upload, asyncRoute(handleImport));
projectsRouter.get('/:id', asyncRoute(async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) throw projectError('Project not found', 404);
  res.json({ project: publicProject(project) });
}));
projectsRouter.get('/:id/preview-info', asyncRoute(async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) throw projectError('Project not found', 404);
  const supported = project.projectType !== 'source-only' && Boolean(project.entryPoint || !project.manifest);
  res.json({ url: supported ? previewUrl(req, project) : null, supported, entryPoint: project.entryPoint,
    message: supported ? '' : project.projectType === 'documents' ? 'Document workspace: open Markdown results in the IDE, or ask for a summary or explanation in Chat.' : 'Source imported. This project needs a build/runtime; static preview supports browser-ready HTML/CSS/JavaScript.' });
}));
projectsRouter.get('/:id/preview', asyncRoute(async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) throw projectError('Project not found', 404);
  res.redirect(previewUrl(req, project));
}));
projectsRouter.get('/:id/files', asyncRoute(async (req, res) => {
  const project = await getProject(req.params.id);
  res.json({ files: await getProjectFiles(req.params.id), revision: project.revision || 0, entryPoint: project.entryPoint, projectType: project.projectType || 'static' });
}));
projectsRouter.get('/:id/files/:filename(*)', asyncRoute(async (req, res) => {
  const file = await getProjectFile(req.params.id, req.params.filename);
  if (!file) throw projectError('File not found', 404);
  const { data, blob, ...meta } = file;
  if (req.query.download === 'true') {
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.type(file.mimeType).send(data);
  }
  res.json({ ...meta, filename: file.path, content: file.binary ? null : data.toString('utf8') });
}));
projectsRouter.post('/:id/changes', asyncRoute(async (req, res) => {
  assertIdle(req.params.id);
  const result = await applyProjectChanges(req.params.id, req.body.changes, { expectedRevision: requireRevision(req), note: req.body.note || 'Manual file edit', entryPoint: req.body.entryPoint, validate: (files, entry) => entry ? validateWebsite(files, entry) : null });
  res.json({ status: 'success', ...result, project: publicProject(result.project) });
}));
projectsRouter.get('/:id/revisions', asyncRoute(async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) throw projectError('Project not found', 404);
  res.json({ revision: project.revision || 0, revisions: (project.history || []).filter(h => h.id).reverse() });
}));
projectsRouter.get('/:id/revisions/:revision', asyncRoute(async (req, res) => res.json(await getRevisionDiff(req.params.id, req.params.revision))));
projectsRouter.post('/:id/revisions/:revision/restore', asyncRoute(async (req, res) => {
  assertIdle(req.params.id);
  const result = await restoreRevision(req.params.id, req.params.revision, requireRevision(req));
  res.json({ status: 'success', ...result, project: publicProject(result.project) });
}));
