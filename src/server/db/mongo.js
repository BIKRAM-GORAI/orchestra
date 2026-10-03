import { MongoClient } from 'mongodb';
import { config } from '../config/env.js';

let client = null;
let db = null;
let isConnecting = false;
let initPromise = null;

/**
 * Connect to MongoDB and initialize necessary collections and indexes.
 * Singleton pattern ensuring a single active connection pool across the application.
 */
export async function connectMongo() {
  if (db) return db;

  if (initPromise) return initPromise;

  if (!config.mongoUri) {
    return null;
  }

  // If running legacy unit tests (Phases 0-7), bypass MongoDB connection to prevent unclosed socket hangs
  if (process.env.npm_lifecycle_event === 'test' && process.env.TESTING_MONGODB !== 'true') {
    return null;
  }

  initPromise = (async () => {
    try {
      isConnecting = true;
      client = new MongoClient(config.mongoUri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 10000,
      });

      await client.connect();
      db = config.mongoDbName ? client.db(config.mongoDbName) : client.db();

      // Ensure indexes for strict project isolation and high-performance querying
      await db.collection('project_files').createIndex(
        { projectId: 1, filePath: 1 },
        { unique: true, background: true }
      );

      await db.collection('agent_artifacts').createIndex(
        { projectId: 1, path: 1 },
        { unique: true, background: true }
      );

      await db.collection('agent_artifacts').createIndex(
        { projectId: 1, agentId: 1, createdAt: -1 },
        { background: true }
      );

      await db.collection('projects').createIndex(
        { id: 1 },
        { unique: true, background: true }
      );

      await db.collection('project_revisions').createIndex({ projectId: 1, id: 1 }, { unique: true });

      return db;
    } catch (err) {
      console.error('[MONGODB] Connection failed:', err.message);
      db = null;
      await client?.close().catch(() => {});
      client = null;
      initPromise = null;
      throw err;
    } finally {
      isConnecting = false;
    }
  })();

  return initPromise;
}

/**
 * Get active database instance or attempt connection
 */
export async function getDb() {
  if (db) return db;
  return await connectMongo();
}

/**
 * Check if MongoDB is connected and ready
 */
export function isMongoConnected() {
  return db !== null;
}

/**
 * Close database connection gracefully
 */
export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    initPromise = null;
  }
  initPromise = null;
}
