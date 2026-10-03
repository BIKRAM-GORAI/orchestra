import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pptxgen = require('/tmp/omnirush/pptxgenjs/node_modules/pptxgenjs');
const JSZip = require('/tmp/omnirush/pptxgenjs/node_modules/jszip');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Agent Orchestra';
pptx.company = 'Agent Orchestra';
pptx.subject = 'Agent Orchestra product overview';
pptx.title = 'Agent Orchestra — From intent to shipped experiences';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-US',
};
pptx.defineSlideMaster({
  title: 'ORCHESTRA_MASTER',
  background: { color: '0B1020' },
  objects: [],
  slideNumber: { x: 12.65, y: 7.08, color: '64748B', fontFace: 'Aptos', fontSize: 8 },
});

const W = 13.333;
const H = 7.5;
const C = {
  bg: '0B1020',
  panel: '121A2C',
  panel2: '172239',
  line: '263653',
  text: 'F5F7FB',
  muted: '9BA7BD',
  cyan: '64E6D3',
  violet: '9B8CFF',
  coral: 'FF8C73',
  amber: 'FFC857',
  blue: '64B5FF',
  green: '80E0A3',
  red: 'FF6B7A',
  white: 'FFFFFF',
};

const S = pptx.ShapeType;

function addText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: opts.fontFace || 'Aptos',
    fontSize: opts.fontSize || 14,
    color: opts.color || C.text,
    bold: opts.bold || false,
    italic: opts.italic || false,
    margin: opts.margin ?? 0,
    breakLine: false,
    fit: 'shrink',
    valign: opts.valign || 'mid',
    align: opts.align || 'left',
    paraSpaceAfterPt: opts.paraSpaceAfterPt || 0,
    bullet: opts.bullet,
    charSpacing: opts.charSpacing,
    transparency: opts.transparency,
    isTextBox: true,
  });
}

function rect(slide, x, y, w, h, fill, radius = 0.12, line = fill, transparency = 0) {
  slide.addShape(radius ? S.roundRect : S.rect, {
    x, y, w, h,
    rectRadius: radius,
    fill: { color: fill, transparency },
    line: { color: line, transparency: line === fill ? 100 : 0, width: line === fill ? 0 : 1 },
  });
}

function line(slide, x1, y1, x2, y2, color = C.line, width = 1.2, dash = 'solid', endArrowType) {
  slide.addShape(S.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width, dash, beginArrowType: 'none', endArrowType },
  });
}

function circle(slide, x, y, d, fill, lineColor = fill, lineWidth = 0) {
  slide.addShape(S.ellipse, {
    x, y, w: d, h: d,
    fill: { color: fill },
    line: { color: lineColor, width: lineWidth, transparency: lineWidth ? 0 : 100 },
  });
}

function pill(slide, text, x, y, w, color, textColor = C.bg) {
  slide.addShape(S.roundRect, {
    x, y, w, h: 0.28,
    rectRadius: 0.14,
    fill: { color },
    line: { color, transparency: 100 },
  });
  addText(slide, text, x, y + 0.01, w, 0.22, { fontSize: 8, color: textColor, bold: true, align: 'center' });
}

function iconBadge(slide, label, x, y, color, size = 0.45) {
  circle(slide, x, y, size, color);
  addText(slide, label, x, y + 0.015, size, size - 0.03, { fontSize: size > 0.4 ? 12 : 9, color: C.bg, bold: true, align: 'center' });
}

function titleBlock(slide, kicker, title, subtitle) {
  addText(slide, kicker.toUpperCase(), 0.65, 0.43, 3.8, 0.23, { fontSize: 9, color: C.cyan, bold: true, charSpacing: 1.6 });
  addText(slide, title, 0.65, 0.77, 11.2, 0.62, { fontSize: 26, color: C.text, bold: true, fontFace: 'Aptos Display' });
  if (subtitle) addText(slide, subtitle, 0.67, 1.43, 10.8, 0.38, { fontSize: 11, color: C.muted });
  line(slide, 0.65, 1.98, 12.68, 1.98, C.line, 0.8);
}

function footer(slide, label = 'AGENT ORCHESTRA  /  PRODUCT OVERVIEW') {
  addText(slide, label, 0.65, 7.08, 6, 0.18, { fontSize: 7.5, color: '64748B', bold: true, charSpacing: 0.7 });
}

function card(slide, x, y, w, h, title, body, accent = C.cyan, options = {}) {
  rect(slide, x, y, w, h, options.fill || C.panel, 0.12, options.line || C.line);
  rect(slide, x, y, 0.06, h, accent, 0, accent);
  addText(slide, title, x + 0.23, y + 0.16, w - 0.42, 0.28, { fontSize: options.titleSize || 12, color: C.text, bold: true });
  if (body) addText(slide, body, x + 0.23, y + 0.54, w - 0.42, h - 0.68, { fontSize: options.bodySize || 9.5, color: C.muted, valign: 'top' });
}

function addSpeakerNotes(slide, notes) {
  if (typeof slide.addNotes === 'function') slide.addNotes(notes);
}

function baseSlide() {
  return pptx.addSlide('ORCHESTRA_MASTER');
}

// Slide 1 — cover
{
  const slide = baseSlide();
  slide.background = { color: C.bg };
  // Concentric orchestration rings.
  [1.2, 2.0, 2.8, 3.6].forEach((d, i) => {
    slide.addShape(S.ellipse, { x: 8.85 - d / 2, y: 3.65 - d / 2, w: d, h: d, fill: { color: C.bg, transparency: 100 }, line: { color: i % 2 ? C.violet : C.cyan, transparency: 54, width: 1 } });
  });
  const nodes = [
    [9.02, 2.04, C.cyan, 'M'], [10.65, 2.76, C.violet, 'D'], [11.42, 4.36, C.coral, 'C'],
    [10.02, 5.43, C.amber, 'Q'], [8.20, 5.20, C.blue, 'F'], [7.28, 3.63, C.green, 'A'],
  ];
  nodes.forEach(([x, y, color, label], i) => {
    line(slide, 8.85, 3.65, x + 0.1, y + 0.1, color, 0.9, 'dash');
    circle(slide, x, y, 0.42, color);
    addText(slide, label, x, y + 0.02, 0.42, 0.34, { fontSize: 11, color: C.bg, bold: true, align: 'center' });
  });
  rect(slide, 0.72, 0.72, 1.02, 0.34, C.cyan, 0.17);
  addText(slide, 'ORCHESTRA', 0.72, 0.78, 1.02, 0.18, { fontSize: 8, color: C.bg, bold: true, align: 'center', charSpacing: 1 });
  addText(slide, 'From intent\nto shipped\nexperiences.', 0.72, 1.55, 6.35, 1.85, { fontSize: 34, color: C.text, bold: true, fontFace: 'Aptos Display', valign: 'mid' });
  addText(slide, 'A project-scoped AI workspace for file analysis, Markdown deliverables, website generation, live preview, and human-in-the-loop editing.', 0.77, 3.72, 5.55, 0.85, { fontSize: 14, color: C.muted, valign: 'top' });
  pill(slide, '6 LOGICAL ROLES', 0.77, 5.05, 1.38, C.violet, C.white);
  pill(slide, 'ATOMIC REVISIONS', 2.30, 5.05, 1.54, C.coral, C.bg);
  pill(slide, 'LIVE PREVIEW', 3.99, 5.05, 1.26, C.amber, C.bg);
  addText(slide, 'Six agents. One shared context. Zero lost intent.', 0.77, 5.77, 5.4, 0.3, { fontSize: 11, color: C.cyan, bold: true });
  footer(slide, 'AGENT ORCHESTRA  /  SIX-SLIDE PRODUCT STORY');
  addSpeakerNotes(slide, 'Opening: Agent Orchestra turns a high-level request into either a grounded Markdown deliverable or a browser-ready website, while preserving project context and revision history.');
}

// Slide 2 — problem and promise
{
  const slide = baseSlide();
  titleBlock(slide, '01  /  WHY IT EXISTS', 'AI work breaks at the handoff.', 'The model can write. The workspace must preserve intent, evidence, files, and trust.');
  const items = [
    ['01', 'Prompt drift', 'Different agents receive different context. Decisions disappear between planning and implementation.', C.coral],
    ['02', 'File fragility', 'A generated answer overwrites source, loses binary assets, or leaves the project in a half-written state.', C.amber],
    ['03', 'No visible proof', 'Users cannot see what was read, what changed, what failed, or whether a preview is actually safe to open.', C.violet],
  ];
  items.forEach(([num, title, body, color], i) => {
    const y = 2.40 + i * 1.22;
    iconBadge(slide, num, 0.78, y + 0.08, color, 0.44);
    addText(slide, title, 1.42, y, 2.0, 0.3, { fontSize: 14, color: C.text, bold: true });
    addText(slide, body, 1.42, y + 0.35, 4.75, 0.54, { fontSize: 10, color: C.muted, valign: 'top' });
    if (i < items.length - 1) line(slide, 1.0, y + 0.98, 5.95, y + 0.98, C.line, 0.8, 'dash');
  });
  rect(slide, 7.05, 2.35, 5.56, 3.95, C.panel, 0.16, C.line);
  addText(slide, 'THE ORCHESTRA RESPONSE', 7.42, 2.68, 3.4, 0.23, { fontSize: 9, color: C.cyan, bold: true, charSpacing: 1.3 });
  addText(slide, 'A durable control plane\nfor creative work.', 7.42, 3.05, 4.6, 0.75, { fontSize: 23, color: C.text, bold: true, fontFace: 'Aptos Display' });
  const promises = [
    ['Grounded', 'Agents read project files before editing.'],
    ['Versioned', 'Every batch becomes an atomic revision.'],
    ['Observable', 'SSE streams states, costs, and findings.'],
    ['Reversible', 'History, diffs, restore, and source preservation.'],
  ];
  promises.forEach(([label, body], i) => {
    const y = 4.17 + i * 0.45;
    circle(slide, 7.45, y + 0.06, 0.12, i % 2 ? C.violet : C.cyan);
    addText(slide, label, 7.68, y, 1.05, 0.2, { fontSize: 10, color: C.text, bold: true });
    addText(slide, body, 8.78, y, 3.35, 0.2, { fontSize: 9, color: C.muted });
  });
  footer(slide);
  addSpeakerNotes(slide, 'Frame the problem as an engineering workflow problem rather than a model problem. Orchestra adds context, persistence, observability, and recovery around model calls.');
}

// Slide 3 — two paths
{
  const slide = baseSlide();
  titleBlock(slide, '02  /  TWO DELIVERABLES', 'One request. Two intelligent paths.', 'Auto routing chooses the smallest workflow that can satisfy the user without unnecessary source changes.');
  // Input node
  rect(slide, 0.75, 2.65, 2.15, 1.35, C.panel2, 0.14, C.cyan);
  iconBadge(slide, 'U', 0.98, 2.92, C.cyan, 0.42);
  addText(slide, 'USER REQUEST', 1.54, 2.85, 1.08, 0.2, { fontSize: 9, color: C.cyan, bold: true, charSpacing: 1 });
  addText(slide, '“Explain these files”\nor “Build this site”', 1.00, 3.28, 1.68, 0.45, { fontSize: 12, color: C.text, bold: true, align: 'center' });
  line(slide, 2.92, 3.32, 4.02, 3.32, C.cyan, 1.5, 'solid', 'triangle');
  circle(slide, 4.02, 2.91, 0.82, C.violet);
  addText(slide, 'AI', 4.02, 3.10, 0.82, 0.28, { fontSize: 16, color: C.white, bold: true, align: 'center' });
  addText(slide, 'MANAGER\nROUTER', 3.82, 3.86, 1.22, 0.42, { fontSize: 8.5, color: C.violet, bold: true, align: 'center' });
  // Branches
  line(slide, 4.84, 3.32, 5.62, 2.55, C.cyan, 1.4, 'solid', 'triangle');
  line(slide, 4.84, 3.32, 5.62, 4.55, C.coral, 1.4, 'solid', 'triangle');
  // Document path
  rect(slide, 5.68, 2.10, 3.02, 2.18, C.panel, 0.13, C.cyan);
  addText(slide, 'DOCUMENT ANALYST', 5.95, 2.34, 2.45, 0.22, { fontSize: 10, color: C.cyan, bold: true, charSpacing: 0.9 });
  addText(slide, 'Read → extract → write', 5.95, 2.75, 2.32, 0.28, { fontSize: 15, color: C.text, bold: true });
  addText(slide, 'Creates a new Markdown artifact\nwith authoritative source coverage.', 5.95, 3.23, 2.35, 0.52, { fontSize: 10, color: C.muted, valign: 'top' });
  pill(slide, 'READ-ONLY SOURCES', 5.95, 3.86, 1.42, C.cyan, C.bg);
  pill(slide, 'VERSIONED .MD', 7.48, 3.86, 1.05, C.violet, C.white);
  // Website path
  rect(slide, 5.68, 4.08, 6.10, 2.18, C.panel, 0.13, C.coral);
  addText(slide, 'WEBSITE OR APP', 5.95, 4.31, 2.45, 0.22, { fontSize: 10, color: C.coral, bold: true, charSpacing: 0.9 });
  addText(slide, 'Plan → specialize → code → audit', 5.95, 4.70, 4.55, 0.28, { fontSize: 15, color: C.text, bold: true });
  const mini = [['PLAN', C.violet], ['DESIGN', C.cyan], ['CODE', C.amber], ['QA', C.green]];
  mini.forEach(([t, col], i) => {
    const x = 5.96 + i * 1.19;
    rect(slide, x, 5.30, 0.98, 0.43, col, 0.08, col);
    addText(slide, t, x, 5.41, 0.98, 0.14, { fontSize: 8, color: C.bg, bold: true, align: 'center' });
    if (i < mini.length - 1) line(slide, x + 0.98, 5.52, x + 1.13, 5.52, C.muted, 1, 'solid', 'triangle');
  });
  addText(slide, 'Commits a complete file batch, validates references, then opens a sandboxed preview.', 5.95, 5.91, 5.15, 0.22, { fontSize: 9, color: C.muted });
  footer(slide);
  addSpeakerNotes(slide, 'This slide explains automatic routing. Document requests avoid website stages. Website requests use the multi-agent implementation pipeline. Explicit task modes can skip classification.');
}

// Slide 4 — architecture
{
  const slide = baseSlide();
  titleBlock(slide, '03  /  ARCHITECTURE', 'The model is replaceable. The workspace is durable.', 'Agents own intent. The gateway owns inference. The project manifest owns truth.');
  const layers = [
    ['01', 'EXPERIENCE', 'Chat · IDE · Office · Preview · Activity', C.cyan],
    ['02', 'ORCHESTRATION', 'Manager · specialists · Coding Agent · QA Agent', C.violet],
    ['03', 'MODEL GATEWAY', 'Gemini · NVIDIA · Mistral · OpenRouter · retries', C.amber],
    ['04', 'PROJECT TRUTH', 'Manifest · immutable blobs · revisions · GridFS', C.coral],
  ];
  layers.forEach(([n, title, body, color], i) => {
    const y = 2.31 + i * 0.82;
    rect(slide, 0.78, y, 5.34, 0.61, C.panel, 0.10, C.line);
    circle(slide, 0.96, y + 0.13, 0.35, color);
    addText(slide, n, 0.96, y + 0.22, 0.35, 0.12, { fontSize: 7.5, color: C.bg, bold: true, align: 'center' });
    addText(slide, title, 1.50, y + 0.11, 1.52, 0.18, { fontSize: 9.5, color, bold: true, charSpacing: 0.7 });
    addText(slide, body, 3.04, y + 0.11, 2.80, 0.24, { fontSize: 9.4, color: C.text });
    if (i < layers.length - 1) line(slide, 3.35, y + 0.61, 3.35, y + 0.82, C.line, 1, 'dash', 'triangle');
  });
  // right-side principles
  rect(slide, 6.72, 2.30, 5.86, 3.98, C.panel2, 0.16, C.line);
  addText(slide, 'DESIGN PRINCIPLES', 7.10, 2.66, 2.4, 0.22, { fontSize: 9, color: C.cyan, bold: true, charSpacing: 1.3 });
  const principles = [
    ['Decoupled', 'Agents never call providers directly.'],
    ['Contextual', 'Existing files are read before mutation.'],
    ['Atomic', 'A batch publishes as one revision or nothing.'],
    ['Reversible', 'Restore creates a new revision; history survives.'],
    ['Sandboxed', 'Preview runs on a separate read-only origin.'],
  ];
  principles.forEach(([title, body], i) => {
    const y = 3.14 + i * 0.58;
    iconBadge(slide, String(i + 1), 7.12, y, i % 2 ? C.violet : C.cyan, 0.28);
    addText(slide, title, 7.58, y - 0.01, 1.12, 0.18, { fontSize: 10, color: C.text, bold: true });
    addText(slide, body, 8.72, y - 0.01, 3.25, 0.2, { fontSize: 9, color: C.muted });
  });
  addText(slide, '409 CONFLICTS  ·  SYMLINK GUARDS  ·  SIZE LIMITS  ·  SOURCE PRESERVATION', 0.80, 6.35, 11.5, 0.22, { fontSize: 8.5, color: C.green, bold: true, charSpacing: 0.55, align: 'center' });
  footer(slide);
  addSpeakerNotes(slide, 'Emphasize the separation of concerns. Models can change without rewriting agents or persistence. The manifest is authoritative and revisions are the recovery mechanism.');
}

// Slide 5 — workspace in motion
{
  const slide = baseSlide();
  titleBlock(slide, '04  /  EXPERIENCE', 'The workspace makes invisible work visible.', 'A live control room for prompts, agent states, source files, preview output, and evidence.');
  // UI storyboard panels
  const panels = [
    [0.78, 2.36, 2.28, 2.34, 'OFFICE', C.cyan],
    [3.20, 2.36, 2.28, 2.34, 'CHAT', C.violet],
    [5.62, 2.36, 2.28, 2.34, 'IDE', C.amber],
    [8.04, 2.36, 2.28, 2.34, 'PREVIEW', C.coral],
    [10.46, 2.36, 2.12, 2.34, 'ACTIVITY', C.green],
  ];
  panels.forEach(([x, y, w, h, label, color], i) => {
    rect(slide, x, y, w, h, C.panel, 0.13, C.line);
    rect(slide, x, y, w, 0.32, color, 0.13, color);
    addText(slide, label, x + 0.13, y + 0.09, w - 0.26, 0.12, { fontSize: 7.5, color: C.bg, bold: true, align: 'center', charSpacing: 0.8 });
    // miniature dashboard structures
    if (i === 0) {
      rect(slide, x + 0.17, y + 0.58, w - 0.34, 1.15, '1B2940', 0.08, C.line);
      [0, 1, 2, 3].forEach(k => { circle(slide, x + 0.34 + k * 0.39, y + 1.25 - (k % 2) * 0.2, 0.24, [C.cyan, C.violet, C.amber, C.green][k]); });
      line(slide, x + 0.31, y + 1.72, x + w - 0.31, y + 1.72, C.line, 1);
      addText(slide, 'agent states', x + 0.25, y + 1.91, w - 0.5, 0.18, { fontSize: 8.5, color: C.muted, align: 'center' });
    } else if (i === 1) {
      [0, 1, 2].forEach(k => { rect(slide, x + 0.20, y + 0.61 + k * 0.36, 1.45 + (k % 2) * 0.34, 0.18, k === 1 ? '2B3150' : '233148', 0.06, '2B3A59'); });
      circle(slide, x + 1.83, y + 0.61, 0.22, C.violet);
      addText(slide, 'route', x + 0.28, y + 1.89, w - 0.56, 0.18, { fontSize: 8.5, color: C.muted, align: 'center' });
    } else if (i === 2) {
      rect(slide, x + 0.18, y + 0.58, 0.52, 1.40, '1B2940', 0.06, C.line);
      [0, 1, 2, 3, 4].forEach(k => line(slide, x + 0.86, y + 0.66 + k * 0.23, x + 1.93 + (k % 2) * 0.18, y + 0.66 + k * 0.23, k === 2 ? C.amber : C.muted, 1));
      addText(slide, 'revision r04', x + 0.22, y + 1.99, w - 0.44, 0.16, { fontSize: 8.5, color: C.muted, align: 'center' });
    } else if (i === 3) {
      rect(slide, x + 0.16, y + 0.55, w - 0.32, 1.45, 'E6EDF5', 0.06, C.coral);
      rect(slide, x + 0.32, y + 0.76, 0.95, 0.18, C.coral, 0.05, C.coral);
      rect(slide, x + 0.32, y + 1.10, 1.50, 0.10, 'B9C6D9', 0.05, 'B9C6D9');
      rect(slide, x + 0.32, y + 1.37, 1.20, 0.10, 'B9C6D9', 0.05, 'B9C6D9');
      addText(slide, 'sandboxed', x + 0.25, y + 1.99, w - 0.5, 0.16, { fontSize: 8.5, color: C.muted, align: 'center' });
    } else {
      [0, 1, 2, 3].forEach(k => {
        circle(slide, x + 0.24, y + 0.63 + k * 0.33, 0.13, [C.green, C.cyan, C.violet, C.amber][k]);
        line(slide, x + 0.53, y + 0.70 + k * 0.33, x + 1.55 + (k % 2) * 0.22, y + 0.70 + k * 0.33, C.muted, 1);
      });
      addText(slide, 'events + costs', x + 0.18, y + 1.99, w - 0.36, 0.16, { fontSize: 8.5, color: C.muted, align: 'center' });
    }
  });
  // Pipeline strip
  addText(slide, 'LIVE PIPELINE', 0.78, 5.28, 1.2, 0.18, { fontSize: 8.5, color: C.cyan, bold: true, charSpacing: 1 });
  const stages = ['ROUTE', 'PLAN', 'SPECIALISTS', 'SYNTHESIZE', 'CODE', 'QA', 'PREVIEW'];
  stages.forEach((stage, i) => {
    const x = 2.18 + i * 1.48;
    circle(slide, x, 5.18, 0.28, i < 5 ? C.cyan : i === 5 ? C.amber : C.green);
    addText(slide, String(i + 1), x, 5.26, 0.28, 0.10, { fontSize: 7, color: C.bg, bold: true, align: 'center' });
    addText(slide, stage, x - 0.34, 5.60, 0.96, 0.18, { fontSize: 7, color: C.muted, bold: true, align: 'center' });
    if (i < stages.length - 1) line(slide, x + 0.30, 5.32, x + 1.32, 5.32, C.line, 1.2, 'solid', 'triangle');
  });
  addText(slide, 'Human feedback loops directly back to the Coding Agent while unrelated files remain preserved.', 0.80, 6.28, 11.65, 0.24, { fontSize: 10, color: C.text, bold: true, align: 'center' });
  footer(slide);
  addSpeakerNotes(slide, 'Walk left to right through the interface. The visual office is a state visualization, while Chat, IDE, Preview, and Activity are operational surfaces connected to the backend.');
}

// Slide 6 — proof and roadmap
{
  const slide = baseSlide();
  titleBlock(slide, '05  /  READINESS', 'Built, verified, and ready for its next frontier.', 'The core is working. The next gains come from operational hardening and runtime expansion.');
  // proof column
  rect(slide, 0.78, 2.35, 5.58, 3.76, C.panel, 0.14, C.line);
  addText(slide, 'WHAT IS READY', 1.15, 2.70, 2.0, 0.22, { fontSize: 9, color: C.green, bold: true, charSpacing: 1.2 });
  const ready = [
    ['55', 'automated checks passing'],
    ['12', 'bounded agent/file turns'],
    ['500', 'tracked files per project'],
    ['409', 'stale-write protection'],
  ];
  ready.forEach(([num, label], i) => {
    const x = 1.13 + (i % 2) * 2.47;
    const y = 3.20 + Math.floor(i / 2) * 1.18;
    addText(slide, num, x, y, 1.0, 0.47, { fontSize: 27, color: [C.cyan, C.violet, C.amber, C.coral][i], bold: true, fontFace: 'Aptos Display' });
    addText(slide, label, x, y + 0.56, 1.75, 0.33, { fontSize: 9.5, color: C.muted, valign: 'top' });
  });
  addText(slide, 'Verification is disposable and provider-mocked; live model acceptance remains the next confidence gate.', 1.15, 5.55, 4.68, 0.28, { fontSize: 9, color: C.muted, valign: 'top' });
  // roadmap column
  addText(slide, 'NEXT HORIZON', 7.02, 2.70, 2.0, 0.22, { fontSize: 9, color: C.coral, bold: true, charSpacing: 1.2 });
  const roadmap = [
    ['01', 'Live-provider acceptance', 'Real Gemini / NVIDIA / Mistral runs with quality and cost checks.', C.cyan],
    ['02', 'Operational hardening', 'Authentication, rate limits, durable spend tracking, blob cleanup.', C.violet],
    ['03', 'Runtime expansion', 'Framework builds, backend execution, OCR, and richer binary readers.', C.amber],
  ];
  roadmap.forEach(([num, title, body, color], i) => {
    const y = 3.18 + i * 0.92;
    circle(slide, 7.02, y, 0.37, color);
    addText(slide, num, 7.02, y + 0.11, 0.37, 0.10, { fontSize: 7, color: C.bg, bold: true, align: 'center' });
    addText(slide, title, 7.60, y - 0.01, 3.75, 0.22, { fontSize: 12, color: C.text, bold: true });
    addText(slide, body, 7.60, y + 0.31, 4.38, 0.32, { fontSize: 9.5, color: C.muted, valign: 'top' });
    if (i < roadmap.length - 1) line(slide, 7.20, y + 0.42, 7.20, y + 0.92, C.line, 1, 'dash');
  });
  rect(slide, 7.02, 6.10, 5.20, 0.48, C.cyan, 0.10, C.cyan);
  addText(slide, 'npm run dev   →   localhost:3000', 7.02, 6.24, 5.20, 0.16, { fontSize: 11, color: C.bg, bold: true, align: 'center', fontFace: 'JetBrains Mono' });
  footer(slide, 'AGENT ORCHESTRA  /  READY FOR THE NEXT ITERATION');
  addSpeakerNotes(slide, 'Close with a balanced message: core workflows and persistence are implemented and tested. Live provider acceptance, authentication, runtime execution, and OCR are the next product decisions.');
}

async function addTransitions(filename) {
  const zip = await JSZip.loadAsync(require('node:fs').readFileSync(filename));
  const transitionTypes = ['fade', 'push dir="l"', 'wipe dir="r"', 'push dir="u"', 'fade', 'push dir="l"'];
  for (let i = 1; i <= 6; i += 1) {
    const entry = zip.file(`ppt/slides/slide${i}.xml`);
    if (!entry) continue;
    let xml = await entry.async('string');
    const transition = transitionTypes[i - 1];
    const element = transition.startsWith('fade')
      ? '<p:transition spd="med" advClick="1"><p:fade/></p:transition>'
      : `<p:transition spd="med" advClick="1"><p:${transition}/></p:transition>`;
    if (!xml.includes('<p:transition')) xml = xml.replace('</p:sld>', `${element}</p:sld>`);
    zip.file(`ppt/slides/slide${i}.xml`, xml);
  }
  const output = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  require('node:fs').writeFileSync(filename, output);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'Agent-Orchestra-Overview.pptx');
await pptx.writeFile({ fileName: output });
await addTransitions(output);
console.log(`Created ${output}`);
