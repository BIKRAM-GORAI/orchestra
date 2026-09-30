import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';
import { getDb, isMongoConnected } from '../db/mongo.js';

/**
 * Project Service
 * 
 * Manages project-isolated file and artifact persistence.
 * Primary persistent storage is backed by MongoDB (`project_files`, `agent_artifacts`, `projects`),
 * ensuring complete project namespace isolation: `projectId + filePath` uniquely identifies files.
 * Provides local filesystem mirroring during local dev without relying on local disk after deployment.
 */

// Ensure projects root directory exists for local development mirroring
async function ensureProjectsDir() {
  try {
    await fs.mkdir(config.projectsDir, { recursive: true });
  } catch (_) {}
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

/**
 * Create a new isolated project namespace
 */
export async function createProject({ name = 'New Project', prompt = '' } = {}) {
  const id = generateProjectId(name);

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

  // 1. Persist to MongoDB (Primary online persistent storage)
  try {
    const db = await getDb();
    if (db) {
      await db.collection('projects').updateOne(
        { id },
        { $set: projectMeta },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn(`[PROJECT SERVICE] MongoDB createProject notice: ${err.message}`);
  }

  // 2. Mirror locally for local dev/test backwards compatibility
  try {
    await ensureProjectsDir();
    const projectDir = path.join(config.projectsDir, id);
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'project.json'),
      JSON.stringify(projectMeta, null, 2),
      'utf-8'
    );
  } catch (_) {}

  return projectMeta;
}

/**
 * Retrieve project metadata by projectId
 */
export async function getProject(projectId) {
  if (!projectId) return null;

  // 1. Try MongoDB
  try {
    const db = await getDb();
    if (db) {
      const doc = await db.collection('projects').findOne({ id: projectId });
      if (doc) {
        const { _id, ...meta } = doc;
        return meta;
      }
    }
  } catch (err) {
    console.warn(`[PROJECT SERVICE] MongoDB getProject notice: ${err.message}`);
  }

  // 2. Fallback to local disk (for tests or offline local development)
  const projectDir = path.join(config.projectsDir, projectId);
  try {
    const metaRaw = await fs.readFile(path.join(projectDir, 'project.json'), 'utf-8');
    return JSON.parse(metaRaw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Update project metadata by projectId
 */
export async function updateProject(projectId, updates = {}) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const updated = {
    ...project,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // 1. Update in MongoDB
  try {
    const db = await getDb();
    if (db) {
      await db.collection('projects').updateOne(
        { id: projectId },
        { $set: updated },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn(`[PROJECT SERVICE] MongoDB updateProject notice: ${err.message}`);
  }

  // 2. Mirror to local disk
  try {
    const projectDir = path.join(config.projectsDir, projectId);
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'project.json'),
      JSON.stringify(updated, null, 2),
      'utf-8'
    );
  } catch (_) {}

  return updated;
}

/**
 * Save project HTML (primarily index.html) with strict project isolation and version increment.
 * Ensures updates operate safely and stores historical version snapshots for future revert.
 */
export async function saveProjectHtml(projectId, htmlContent, changeNote = 'Initial Generation', expectedVersion = null) {
  if (!projectId) throw new Error('projectId is required to save index.html');
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  if (!htmlContent.includes('<html') && !htmlContent.toLowerCase().includes('<!doctype')) {
    htmlContent = `<!DOCTYPE html>\n<html>\n<body>\n${htmlContent}\n</body>\n</html>`;
  }

  const now = new Date();
  const filePath = 'index.html';
  let nextVersion = (project.version || 1) + 1;
  let fileSavedInDb = false;

  // 1. Persist to MongoDB `project_files` collection (Primary Source of Truth)
  try {
    const db = await getDb();
    if (db) {
      const filesCol = db.collection('project_files');
      const existingFile = await filesCol.findOne({ projectId, filePath });

      if (existingFile) {
        // Concurrency / Safe Update check: verify latest known version if expectedVersion provided
        if (expectedVersion !== null && existingFile.version !== expectedVersion) {
          throw new Error(`Concurrency conflict: expected version ${expectedVersion}, but found version ${existingFile.version}`);
        }

        nextVersion = (existingFile.version || 1) + 1;

        const newSnapshot = {
          version: nextVersion,
          content: htmlContent,
          changeNote,
          createdAt: now,
        };

        await filesCol.updateOne(
          { projectId, filePath },
          {
            $set: {
              content: htmlContent,
              version: nextVersion,
              changeNote,
              updatedAt: now,
            },
            $push: {
              versions: newSnapshot,
            },
          }
        );
      } else {
        // First creation of index.html for this project
        nextVersion = 1;
        await filesCol.insertOne({
          projectId,
          filePath,
          filename: 'index.html',
          content: htmlContent,
          version: 1,
          versions: [
            {
              version: 1,
              content: htmlContent,
              changeNote,
              createdAt: now,
            },
          ],
          changeNote,
          createdAt: now,
          updatedAt: now,
        });
      }
      fileSavedInDb = true;
    }
  } catch (err) {
    if (err.message.includes('Concurrency conflict')) {
      throw err;
    }
    console.error(`[PROJECT SERVICE] MongoDB saveProjectHtml error: ${err.message}`);
    // If mongo is strictly required, error handling ensures we don't silently pretend it succeeded
    if (config.mongoUri && !isMongoConnected()) {
      throw new Error(`Failed to persist index.html to MongoDB: ${err.message}`);
    }
  }

  // 2. Mirror locally for local dev/test environment
  try {
    const projectDir = path.join(config.projectsDir, projectId);
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'index.html'), htmlContent, 'utf-8');

    // Also mirror to active workspace
    await fs.mkdir(config.workspaceDir, { recursive: true });
    await fs.writeFile(config.workspaceIndexHtml, htmlContent, 'utf-8');
  } catch (_) {}

  // 3. Update project metadata and history
  const historyEntry = {
    version: nextVersion,
    timestamp: now.toISOString(),
    note: changeNote,
  };

  return await updateProject(projectId, {
    version: nextVersion,
    status: 'generated',
    history: [...(project.history || []), historyEntry],
  });
}

/**
 * Retrieve the current, latest index.html for a given project from MongoDB.
 */
export async function getProjectHtml(projectId) {
  if (!projectId) return null;

  // 1. Query MongoDB `project_files` with strict project isolation
  try {
    const db = await getDb();
    if (db) {
      const doc = await db.collection('project_files').findOne({ projectId, filePath: 'index.html' });
      if (doc && doc.content) {
        let content = doc.content;
        if (!content.includes('<html') && !content.toLowerCase().includes('<!doctype')) {
          content = `<!DOCTYPE html>\n<html>\n<body>\n${content}\n</body>\n</html>`;
        }
        return content;
      }
    }
  } catch (err) {
    console.warn(`[PROJECT SERVICE] MongoDB getProjectHtml notice: ${err.message}`);
  }

  // 2. Fallback to local disk
  const projectDir = path.join(config.projectsDir, projectId);
  try {
    return await fs.readFile(path.join(projectDir, 'index.html'), 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Revert index.html to a specific previous version (Supports future revert requirement)
 */
export async function revertProjectHtml(projectId, targetVersion) {
  if (!projectId) throw new Error('projectId is required');
  const db = await getDb();
  if (!db) throw new Error('MongoDB is required for version rollback');

  const fileDoc = await db.collection('project_files').findOne({ projectId, filePath: 'index.html' });
  if (!fileDoc) throw new Error(`index.html not found for project ${projectId}`);

  if (fileDoc.version === targetVersion) {
    return fileDoc.content; // Already at target version
  }

  // Find target version in historical snapshots
  const snapshot = (fileDoc.versions || []).find(v => v.version === targetVersion);
  if (!snapshot) {
    throw new Error(`Version ${targetVersion} not found in version history for project ${projectId}`);
  }

  // Apply revert as a new version increment while preserving history
  await saveProjectHtml(projectId, snapshot.content, `Reverted to version ${targetVersion}`);
  return snapshot.content;
}

/**
 * Save human-readable sub-agent response Markdown artifact into MongoDB.
 * Does not disrupt the direct Manager -> Sub-agent communication flow.
 */
export async function saveAgentArtifact({
  projectId,
  agentId,
  agentName = null,
  taskId = null,
  task = '',
  status = 'Completed',
  response = '',
  filename = null,
} = {}) {
  if (!projectId || !agentId) return null;

  try {
    const db = await getDb();
    if (!db) return null;

    const artifactsCol = db.collection('agent_artifacts');

    // Count existing artifacts for this agent to form response-001.md, response-002.md...
    const count = await artifactsCol.countDocuments({ projectId, agentId });
    const seq = String(count + 1).padStart(3, '0');
    const safeFilename = filename || `response-${seq}.md`;
    const artifactPath = `agents/${agentId}/${safeFilename}`;

    let responseText = '';
    if (typeof response === 'string') {
      responseText = response;
    } else if (response && typeof response === 'object') {
      responseText = JSON.stringify(response, null, 2);
    }

    const mdContent = `# Sub-Agent Response

## Agent
${agentName || agentId}

## Task
${task || 'Assigned task execution'}

## Status
${status}

## Response
\`\`\`json
${responseText}
\`\`\`

## Timestamp
${new Date().toISOString()}
`;

    const artifactDoc = {
      projectId,
      agentId,
      agentName: agentName || agentId,
      taskId: taskId || `task-${Date.now()}`,
      type: 'agent-response',
      path: artifactPath,
      filename: safeFilename,
      content: mdContent,
      createdAt: new Date(),
    };

    await artifactsCol.updateOne(
      { projectId, path: artifactPath },
      { $set: artifactDoc },
      { upsert: true }
    );

    // Update project file list if available
    try {
      const project = await getProject(projectId);
      if (project) {
        const currentFiles = project.files || ['index.html'];
        if (!currentFiles.includes(artifactPath)) {
          await updateProject(projectId, {
            files: [...currentFiles, artifactPath],
          });
        }
      }
    } catch (_) {}

    return artifactDoc;
  } catch (err) {
    console.error(`[PROJECT SERVICE] Failed to persist agent artifact for ${agentId}:`, err.message);
    return null;
  }
}

/**
 * Retrieve all agent artifacts for a project
 */
export async function getAgentArtifacts(projectId) {
  if (!projectId) return [];
  try {
    const db = await getDb();
    if (!db) return [];
    return await db.collection('agent_artifacts')
      .find({ projectId })
      .sort({ createdAt: -1 })
      .toArray();
  } catch (err) {
    console.warn(`[PROJECT SERVICE] Error getting agent artifacts: ${err.message}`);
    return [];
  }
}

/**
 * List all projects
 */
export async function listProjects() {
  const projectsMap = new Map();

  // 1. Load from MongoDB in a single query
  try {
    const db = await getDb();
    if (db) {
      const docs = await db.collection('projects').find({}).sort({ createdAt: -1 }).toArray();
      for (const doc of docs) {
        const { _id, ...meta } = doc;
        projectsMap.set(meta.id, meta);
      }
    }
  } catch (err) {
    console.warn(`[PROJECT SERVICE] MongoDB listProjects notice: ${err.message}`);
  }

  // 2. Merge local filesystem projects directly from disk (fast, no DB loops)
  try {
    await ensureProjectsDir();
    const entries = await fs.readdir(config.projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !projectsMap.has(entry.name)) {
        try {
          const metaRaw = await fs.readFile(path.join(config.projectsDir, entry.name, 'project.json'), 'utf-8');
          const proj = JSON.parse(metaRaw);
          if (proj && proj.id) {
            projectsMap.set(proj.id, proj);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  const projects = Array.from(projectsMap.values());
  return projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get all files belonging to a project (index.html + sub-agent response artifacts)
 */
export async function getProjectFiles(projectId) {
  if (!projectId) return [];
  const files = [];
  const seenPaths = new Set();

  // 1. Load index.html from MongoDB `project_files`
  try {
    const db = await getDb();
    if (db) {
      const htmlFile = await db.collection('project_files').findOne({ projectId, filePath: 'index.html' });
      if (htmlFile) {
        seenPaths.add('index.html');
        files.push({
          name: 'index.html',
          path: 'index.html',
          size: Buffer.byteLength(htmlFile.content || '', 'utf-8'),
          updatedAt: htmlFile.updatedAt ? new Date(htmlFile.updatedAt).toISOString() : new Date().toISOString(),
          extension: 'html',
          version: htmlFile.version || 1,
        });
      }

      // Load sub-agent response markdown artifacts
      const artifacts = await db.collection('agent_artifacts').find({ projectId }).sort({ createdAt: -1 }).toArray();
      for (const art of artifacts) {
        if (!seenPaths.has(art.path)) {
          seenPaths.add(art.path);
          files.push({
            name: art.filename,
            path: art.path,
            size: Buffer.byteLength(art.content || '', 'utf-8'),
            updatedAt: art.createdAt ? new Date(art.createdAt).toISOString() : new Date().toISOString(),
            extension: 'md',
            agentId: art.agentId,
          });
        }
      }
    }
  } catch (err) {
    console.warn(`[PROJECT SERVICE] MongoDB getProjectFiles notice: ${err.message}`);
  }

  // 2. Check local disk fallback if index.html wasn't found in DB
  if (!seenPaths.has('index.html')) {
    const projectDir = path.join(config.projectsDir, projectId);
    try {
      const entries = await fs.readdir(projectDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && !seenPaths.has(entry.name)) {
          seenPaths.add(entry.name);
          const stats = await fs.stat(path.join(projectDir, entry.name));
          files.push({
            name: entry.name,
            path: entry.name,
            size: stats.size,
            updatedAt: stats.mtime.toISOString(),
            extension: path.extname(entry.name).slice(1) || 'txt',
          });
        }
      }
    } catch (_) {}
  }

  return files;
}

/**
 * Get content of a specific file or artifact within a project
 */
export async function getProjectFileContent(projectId, filenameOrPath) {
  if (!projectId || !filenameOrPath) return null;

  // 1. Check MongoDB `project_files` (e.g. index.html)
  try {
    const db = await getDb();
    if (db) {
      const fileDoc = await db.collection('project_files').findOne({
        projectId,
        $or: [
          { filePath: filenameOrPath },
          { filename: filenameOrPath },
        ],
      });
      if (fileDoc && fileDoc.content !== undefined) {
        return fileDoc.content;
      }

      // Check MongoDB `agent_artifacts`
      const artifactDoc = await db.collection('agent_artifacts').findOne({
        projectId,
        $or: [
          { path: filenameOrPath },
          { filename: filenameOrPath },
        ],
      });
      if (artifactDoc && artifactDoc.content !== undefined) {
        return artifactDoc.content;
      }
    }
  } catch (err) {
    console.warn(`[PROJECT SERVICE] MongoDB getProjectFileContent notice: ${err.message}`);
  }

  // 2. Fallback to local disk
  const safeFilename = path.basename(filenameOrPath);
  const filePath = path.join(config.projectsDir, projectId, safeFilename);
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}
