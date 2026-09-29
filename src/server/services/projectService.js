import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';

/**
 * Project Service
 * 
 * Manages isolated multi-project directories under `projects/<projectId>/`.
 * Each project contains its own `index.html`, `project.json` (metadata, specifications,
 * QA reports, and human feedback history), ensuring zero leakage or cross-contamination.
 */

// Ensure projects root directory exists
async function ensureProjectsDir() {
  await fs.mkdir(config.projectsDir, { recursive: true });
}

export function generateProjectId(name = 'project') {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 30) || 'project';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${timestamp}-${randomSuffix}`;
}

export async function createProject({ name = 'New Project', prompt = '' } = {}) {
  await ensureProjectsDir();
  const id = generateProjectId(name);
  const projectDir = path.join(config.projectsDir, id);
  await fs.mkdir(projectDir, { recursive: true });

  const projectMeta = {
    id,
    name,
    prompt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'created',
    version: 1,
    files: ['index.html'],
    managerPlan: null,
    specialistOutputs: {},
    unifiedSpec: null,
    qaReport: null,
    history: [],
  };

  await fs.writeFile(
    path.join(projectDir, 'project.json'),
    JSON.stringify(projectMeta, null, 2),
    'utf-8'
  );

  return projectMeta;
}

export async function getProject(projectId) {
  const projectDir = path.join(config.projectsDir, projectId);
  try {
    const metaRaw = await fs.readFile(path.join(projectDir, 'project.json'), 'utf-8');
    const project = JSON.parse(metaRaw);
    return project;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function updateProject(projectId, updates = {}) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const updated = {
    ...project,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const projectDir = path.join(config.projectsDir, projectId);
  await fs.writeFile(
    path.join(projectDir, 'project.json'),
    JSON.stringify(updated, null, 2),
    'utf-8'
  );

  return updated;
}

export async function saveProjectHtml(projectId, htmlContent, changeNote = 'Initial Generation') {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const projectDir = path.join(config.projectsDir, projectId);
  const htmlPath = path.join(projectDir, 'index.html');
  await fs.writeFile(htmlPath, htmlContent, 'utf-8');

  // Also sync to workspace/index.html as active workspace preview
  await fs.mkdir(config.workspaceDir, { recursive: true });
  await fs.writeFile(config.workspaceIndexHtml, htmlContent, 'utf-8');

  // Update history in project.json
  const nextVersion = (project.version || 1) + 1;
  const historyEntry = {
    version: project.version || 1,
    timestamp: new Date().toISOString(),
    note: changeNote,
  };

  return await updateProject(projectId, {
    version: nextVersion,
    status: 'generated',
    history: [...(project.history || []), historyEntry],
  });
}

export async function getProjectHtml(projectId) {
  const projectDir = path.join(config.projectsDir, projectId);
  const htmlPath = path.join(projectDir, 'index.html');
  try {
    return await fs.readFile(htmlPath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function listProjects() {
  await ensureProjectsDir();
  const entries = await fs.readdir(config.projectsDir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const proj = await getProject(entry.name);
      if (proj) {
        projects.push(proj);
      }
    }
  }

  // Sort newest first
  return projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
