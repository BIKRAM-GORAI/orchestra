import path from 'node:path';
import { parse as parseHtml } from 'parse5';
import { parse as parseJavaScript } from 'acorn';

export function walkNodes(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (node.childNodes) for (const child of node.childNodes) walkNodes(child, visit);
  if (node.content) walkNodes(node.content, visit);
}

function walkAst(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(n => walkAst(n, visit));
    else if (value && typeof value === 'object') walkAst(value, visit);
  }
}

// Rewrite only actual URL syntax in preview responses, leaving stored source
// untouched. This supports imported sites with root-relative module/data URLs.
export function rewriteJavaScriptUrls(source, base) {
  const edits = new Map();
  try {
    const ast = parseJavaScript(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
    const add = node => {
      if (node?.type === 'Literal' && typeof node.value === 'string' && node.value.startsWith('/') && !node.value.startsWith('//')) {
        edits.set(node.start, { start: node.start, end: node.end, text: JSON.stringify(base + node.value.slice(1)) });
      }
    };
    walkAst(ast, node => {
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) add(node.source);
      if (node.type === 'CallExpression' && node.callee?.name === 'fetch') add(node.arguments[0]);
      if (node.type === 'NewExpression' && ['URL', 'Worker', 'SharedWorker'].includes(node.callee?.name)) add(node.arguments[0]);
    });
  } catch { return source; }
  for (const edit of [...edits.values()].sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  return source;
}

export function inspectFile(file) {
  const refs = [];
  const issues = [];
  if (file.binary) return { refs, issues };
  const text = file.content ?? file.data?.toString('utf8') ?? '';
  const addRef = value => { if (typeof value === 'string') refs.push(value); };
  const js = (source, module = true) => {
    try {
      const ast = parseJavaScript(source, { ecmaVersion: 'latest', sourceType: module ? 'module' : 'script', allowHashBang: true });
      walkAst(ast, node => {
        if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) addRef(node.source.value);
        if (node.type === 'ImportExpression' && node.source?.type === 'Literal') addRef(node.source.value);
        if (node.type === 'CallExpression' && node.callee?.name === 'fetch' && node.arguments?.[0]?.type === 'Literal') addRef(node.arguments[0].value);
      });
    } catch (err) { issues.push({ severity: 'high', category: 'javascript', location: file.path, description: `JavaScript syntax: ${err.message}` }); }
  };
  const css = source => {
    for (const match of source.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/g)) addRef(match[1] || match[2]);
  };
  if (/\.m?js$/i.test(file.path)) js(text);
  if (/\.css$/i.test(file.path)) css(text);
  if (/\.json$/i.test(file.path)) {
    try { JSON.parse(text); } catch (err) { issues.push({ severity: 'high', category: 'json', location: file.path, description: err.message }); }
  }
  if (/\.html?$/i.test(file.path)) {
    const document = parseHtml(text);
    const ids = new Set();
    walkNodes(document, node => {
      const attrs = Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
      if (attrs.id) {
        if (ids.has(attrs.id)) issues.push({ severity: 'medium', category: 'dom', location: file.path, description: `Duplicate id: ${attrs.id}` });
        ids.add(attrs.id);
      }
      for (const attr of ['src', 'href', 'poster']) if (attrs[attr]) addRef(attrs[attr]);
      if (attrs.srcset && !attrs.srcset.startsWith('data:')) attrs.srcset.split(',').forEach(part => addRef(part.trim().split(/\s+/)[0]));
      if (attrs.style) css(attrs.style);
      if (node.tagName === 'script' && !attrs.src && (!attrs.type || ['module', 'text/javascript', 'application/javascript'].includes(attrs.type))) {
        js((node.childNodes || []).map(n => n.value || '').join(''), attrs.type === 'module');
      }
      if (node.tagName === 'style') css((node.childNodes || []).map(n => n.value || '').join(''));
    });
  }
  return { refs, issues };
}

export function resolveReference(from, reference) {
  if (!reference || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(reference)) return null;
  // Bare JavaScript package imports need a bundler/import map; do not pretend
  // they are files. HTML/CSS relative references do not require a ./ prefix.
  if (/\.m?js$/i.test(from) && !/^[./]/.test(reference)) return null;
  try {
    const url = new URL(reference, `https://project.invalid/${from}`);
    return decodeURIComponent(url.pathname).replace(/^\//, '');
  } catch { return null; }
}

export function validateWebsite(files, entryPoint = 'index.html') {
  const paths = new Set(files.filter(f => !f.artifact).map(f => f.path));
  const issues = [];
  if (!entryPoint || !paths.has(entryPoint)) issues.push({ severity: 'high', category: 'entry', location: entryPoint || '(project)', description: 'No HTML entry page is available for static preview.' });
  for (const file of files.filter(f => !f.artifact)) {
    const inspected = inspectFile(file);
    issues.push(...inspected.issues);
    for (const ref of new Set(inspected.refs)) {
      const target = resolveReference(file.path, ref);
      if (target === null) continue;
      if (!paths.has(target) && !paths.has(path.posix.join(target, 'index.html'))) {
        issues.push({ severity: 'medium', category: 'reference', location: file.path, description: `Missing local resource: ${ref}`, target });
      }
    }
  }
  return { result: issues.length ? 'issues_found' : 'passed', issues, checkedFiles: files.length, checks: ['JavaScript syntax', 'JSON syntax', 'local resource references', 'duplicate HTML IDs', 'entry point'] };
}
