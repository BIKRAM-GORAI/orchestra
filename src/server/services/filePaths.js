import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config/env.js';
import mime from 'mime-types';

export const FILE_LIMITS = { count: 500, fileBytes: 10 * 1024 * 1024, totalBytes: 50 * 1024 * 1024, archiveBytes: 25 * 1024 * 1024 };
const skipped = new Set(['node_modules', '.git', '.svn', '.orchestra', '__MACOSX', '.next', '.cache', 'coverage']);
const textExtensions = new Set(['html', 'htm', 'css', 'js', 'mjs', 'cjs', 'json', 'md', 'markdown', 'txt', 'svg', 'xml', 'csv', 'tsv', 'map', 'webmanifest', 'ts', 'tsx', 'jsx', 'yml', 'yaml', 'log', 'py', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'sql', 'sh', 'toml', 'ini', 'rst', 'tex']);

export function projectError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function validateProjectId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id)) {
    throw projectError('Invalid project ID');
  }
  return id;
}

export function normalizeFilePath(input) {
  if (typeof input !== 'string' || !input || input.length > 240 || /[\x00-\x1f<>:"|?*%]/.test(input)) {
    throw projectError('Invalid file path');
  }
  const value = input.replace(/\\/g, '/');
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || ['__proto__', 'constructor', 'prototype'].includes(p.toLowerCase()) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p))) {
    throw projectError(`Unsafe file path: ${input}`);
  }
  if (parts.some(p => skipped.has(p.toLowerCase())) || parts.some(p => /^\.env(?:\.|$)/i.test(p)) || value.toLowerCase() === 'project.json') {
    throw projectError(`Reserved file path: ${input}`);
  }
  return value;
}

export function shouldSkipUpload(input) {
  const parts = String(input).replace(/\\/g, '/').split('/');
  return parts.some(p => skipped.has(p.toLowerCase()) || /^\.env(?:\.|$)/i.test(p) || ['.DS_Store', 'Thumbs.db'].includes(p));
}

export function fileInfo(filePath, bytes) {
  const extension = path.posix.extname(filePath).slice(1).toLowerCase();
  let binary = !textExtensions.has(extension);
  if (!binary && bytes) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { binary = true; }
  }
  return { name: path.posix.basename(filePath), path: filePath, extension, binary, mimeType: mime.lookup(filePath) || 'application/octet-stream' };
}

// Reject symlinks in every component, including the project root. All disk reads
// and mirrors go through this function; a normalized string alone is insufficient.
export async function projectDiskPath(projectId, relativePath = '', { internal = false } = {}) {
  validateProjectId(projectId);
  if (relativePath && !internal) normalizeFilePath(relativePath);
  const root = path.resolve(config.projectsDir);
  const target = path.resolve(root, projectId, relativePath);
  if (!target.startsWith(root + path.sep)) throw projectError('Path escapes project root');
  let current = root;
  for (const part of ['', ...path.relative(root, target).split(path.sep)]) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw projectError('Symbolic links are not supported');
    } catch (err) { if (err.code !== 'ENOENT') throw err; }
  }
  return target;
}

export function validateFileSet(files) {
  if (files.length > FILE_LIMITS.count) throw projectError(`Maximum ${FILE_LIMITS.count} files per project`, 413);
  const paths = new Set();
  let total = 0;
  for (const file of files) {
    const p = normalizeFilePath(file.path).toLowerCase();
    if (paths.has(p)) throw projectError(`Duplicate or case-conflicting path: ${file.path}`);
    paths.add(p);
    const size = file.size ?? file.data?.length ?? Buffer.byteLength(file.content || '', 'utf8');
    if (size > FILE_LIMITS.fileBytes) throw projectError(`File exceeds 10 MB: ${file.path}`, 413);
    total += size;
  }
  for (const p of paths) {
    const parts = p.split('/');
    while (parts.length > 1) {
      parts.pop();
      if (paths.has(parts.join('/'))) throw projectError(`File/directory conflict: ${p}`);
    }
  }
  if (total > FILE_LIMITS.totalBytes) throw projectError('Project exceeds 50 MB', 413);
}
