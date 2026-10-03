import express from 'express';
import { parse, serialize } from 'parse5';
import { getProject, getProjectFile } from '../services/projectService.js';
import { projectError } from '../services/filePaths.js';
import { walkNodes } from '../services/validationService.js';
import { rewriteJavaScriptUrls } from '../services/validationService.js';

export const previewApp = express();
previewApp.disable('x-powered-by');

// Separate server/origin, read-only routes, and a response-level sandbox also
// protect previews opened in a new tab. Local projects use distinct *.localhost
// hosts so localStorage and ES modules work without sharing the studio origin.
previewApp.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "sandbox allow-scripts allow-forms allow-modals allow-same-origin; object-src 'none'; base-uri 'self'");
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.sendStatus(405);
  next();
});

function rewriteRootUrls(content, file, base) {
  const rewrite = value => value.startsWith('/') && !value.startsWith('//') ? `${base}${value.slice(1)}` : value;
  const css = text => text.replace(/(url\(\s*['"]?)(\/(?!\/)[^'"\s)]+)/g, (_, start, url) => start + rewrite(url))
    .replace(/(@import\s+['"])(\/(?!\/)[^'"]+)/g, (_, start, url) => start + rewrite(url));
  if (/\.css$/i.test(file.path)) return css(content);
  if (/\.m?js$/i.test(file.path)) return rewriteJavaScriptUrls(content, base);
  if (!/\.html?$/i.test(file.path)) return content;
  const doc = parse(content);
  walkNodes(doc, node => {
    for (const attr of node.attrs || []) {
      if (['src', 'href', 'poster', 'action'].includes(attr.name)) attr.value = rewrite(attr.value);
      if (attr.name === 'style') attr.value = css(attr.value);
      if (attr.name === 'srcset' && !attr.value.startsWith('data:')) attr.value = attr.value.split(',').map(part => part.trim().replace(/^\S+/, rewrite)).join(', ');
    }
    if (node.tagName === 'style') for (const child of node.childNodes || []) if (child.value) child.value = css(child.value);
    if (node.tagName === 'script') for (const child of node.childNodes || []) if (child.value) child.value = rewriteJavaScriptUrls(child.value, base);
  });
  return serialize(doc);
}

export async function handlePreviewRequest(req, res, next) {
  try {
    const project = await getProject(req.params.id);
    if (!project) throw projectError('Project not found', 404);
    if (req.hostname.endsWith('.localhost') && req.hostname !== `${project.id}.localhost`) throw projectError('Project does not belong to this preview host', 404);
    if (project.projectType === 'source-only') throw projectError('This source project requires a build/runtime. Import a browser-ready static build to preview it.', 422);
    let requested = req.params[0] || project.entryPoint || 'index.html';
    if (requested.endsWith('/')) requested += 'index.html';
    let file = await getProjectFile(project.id, requested);
    if (!file && !requested.split('/').at(-1).includes('.')) {
      file = await getProjectFile(project.id, `${requested}/index.html`);
      if (file) return res.redirect(`${req.path}/`);
    }
    if (!file || file.artifact) throw projectError('Resource not found', 404);
    res.type(file.mimeType);
    const content = file.binary ? file.data : rewriteRootUrls(file.data.toString('utf8'), file, `/p/${encodeURIComponent(project.id)}/`);
    res.send(content);
  } catch (err) { next(err); }
}

previewApp.get('/p/:id/*', handlePreviewRequest);
previewApp.use((req, res) => res.status(404).type('text/plain').send('Preview resource not found'));
previewApp.use((err, req, res, next) => res.status(err.status || 500).type('text/plain').send(err.message));
