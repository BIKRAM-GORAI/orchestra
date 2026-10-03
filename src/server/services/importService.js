import yauzl from 'yauzl';
import { FILE_LIMITS, normalizeFilePath, shouldSkipUpload, validateFileSet, projectError } from './filePaths.js';
import { applyProjectChanges, createProject, getProject } from './projectService.js';
import { validateWebsite } from './validationService.js';

export function readZip(buffer, { skipIgnored = true } = {}) {
  if (buffer.length > FILE_LIMITS.archiveBytes) throw projectError('ZIP exceeds 25 MB', 413);
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error) return reject(projectError(`Invalid ZIP: ${error.message}`));
      const files = [];
      let total = 0;
      let entries = 0;
      let settled = false;
      const fail = err => { if (!settled) { settled = true; zip.close(); reject(err.status ? err : projectError(`Invalid ZIP: ${err.message}`)); } };
      zip.on('error', fail);
      zip.on('end', () => { if (!settled) { settled = true; resolve(files); } });
      zip.on('entry', entry => {
        if (++entries > 5000) return fail(projectError('Archive has too many entries', 413));
        if (entry.generalPurposeBitFlag & 1) return fail(projectError('Encrypted ZIP archives are not supported'));
        const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
        if (mode === 0xa000) return fail(projectError('ZIP symbolic links are not supported'));
        if (entry.fileName.endsWith('/')) { zip.readEntry(); return; }
        if (skipIgnored && shouldSkipUpload(entry.fileName)) { zip.readEntry(); return; }
        let filePath;
        try { filePath = normalizeFilePath(entry.fileName); } catch (err) { return fail(err); }
        if (entry.uncompressedSize > FILE_LIMITS.fileBytes || total + entry.uncompressedSize > FILE_LIMITS.totalBytes || files.length >= FILE_LIMITS.count) {
          return fail(projectError('Archive exceeds project size/file limits', 413));
        }
        zip.openReadStream(entry, (err, stream) => {
          if (err) return fail(err);
          const chunks = [];
          let size = 0;
          stream.on('data', chunk => {
            size += chunk.length;
            if (size > FILE_LIMITS.fileBytes || total + size > FILE_LIMITS.totalBytes) {
              stream.destroy(); fail(projectError('Expanded archive exceeds size limit', 413));
            } else chunks.push(chunk);
          });
          stream.on('error', fail);
          stream.on('end', () => {
            if (settled) return;
            total += size;
            files.push({ path: filePath, data: Buffer.concat(chunks) });
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

export function prepareImport(files, { stripRoot = false } = {}) {
  const skipped = [];
  let accepted = files.filter(file => {
    if (shouldSkipUpload(file.path)) { skipped.push(file.path); return false; }
    return true;
  }).map(file => ({ path: normalizeFilePath(file.path), data: file.data }));
  if (!accepted.length) throw projectError('No usable files found in the upload');
  if (stripRoot && accepted.every(f => f.path.includes('/') && f.path.split('/')[0] === accepted[0].path.split('/')[0])) {
    accepted = accepted.map(f => ({ ...f, path: f.path.slice(f.path.indexOf('/') + 1) }));
  }
  validateFileSet(accepted);
  const htmlFiles = accepted.filter(f => /\.html?$/i.test(f.path));
  const entryPoint = htmlFiles.find(f => f.path === 'index.html')?.path || htmlFiles.find(f => f.path.endsWith('/index.html'))?.path || htmlFiles[0]?.path;
  let needsBuild = accepted.some(f => /\.(jsx|tsx)$/i.test(f.path));
  const packageFile = accepted.find(f => f.path === 'package.json');
  if (packageFile) {
    try {
      const pkg = JSON.parse(packageFile.data.toString('utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      needsBuild ||= ['react', 'next', 'vite', 'vue', 'svelte', 'webpack', '@angular/core'].some(name => name in deps);
    } catch { /* JSON validation is reported by the validator. */ }
  }
  return { files: accepted, skipped, entryPoint, projectType: needsBuild ? 'source-only' : entryPoint ? 'static' : 'documents' };
}

export async function importProject({ files, name, projectId, expectedRevision, stripRoot = false, entryPoint } = {}) {
  const prepared = prepareImport(files, { stripRoot });
  const project = projectId ? await getProject(projectId) : await createProject({ name: name || 'Imported files', prompt: 'Imported project' });
  if (!project) throw projectError('Project not found', 404);
  if (projectId && !Number.isInteger(expectedRevision)) throw projectError('expectedRevision is required when adding files');
  const result = await applyProjectChanges(project.id, prepared.files.map(f => ({ ...f, action: 'write' })), {
    expectedRevision: projectId ? expectedRevision : 0,
    entryPoint: entryPoint || (projectId ? undefined : prepared.entryPoint),
    projectType: prepared.projectType === 'source-only' || project.projectType === 'source-only' ? 'source-only' : undefined,
    note: projectId ? 'Uploaded project files' : 'Imported files', source: 'import',
    validate: (files, entry) => entry ? validateWebsite(files, entry) : null,
  });
  return { ...result, skipped: prepared.skipped, previewSupported: result.project.projectType === 'static' && Boolean(result.project.entryPoint) };
}
