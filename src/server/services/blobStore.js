import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GridFSBucket } from 'mongodb';
import { getDb } from '../db/mongo.js';
import { projectDiskPath } from './filePaths.js';

export async function atomicWrite(filename, data) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, data);
    await fs.rename(temporary, filename);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

export async function storeBlob(projectId, data) {
  const db = await getDb();
  // Unique GridFS IDs prevent a losing concurrent uploader from deleting another
  // uploader's chunks. Filesystem blobs can safely deduplicate via atomic rename.
  const hash = db ? randomBytes(32).toString('hex') : createHash('sha256').update(data).digest('hex');
  if (db) {
    const id = `${projectId}:${hash}`;
    const bucket = new GridFSBucket(db, { bucketName: 'orchestra_blobs' });
    await pipeline(Readable.from([data]), bucket.openUploadStreamWithId(id, hash));
  } else {
    const destination = await projectDiskPath(projectId, `.orchestra/blobs/${hash}`, { internal: true });
    await atomicWrite(destination, data);
  }
  return hash;
}

export async function readBlob(projectId, hash) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid blob reference');
  const db = await getDb();
  if (db) {
    const stream = new GridFSBucket(db, { bucketName: 'orchestra_blobs' }).openDownloadStream(`${projectId}:${hash}`);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  return fs.readFile(await projectDiskPath(projectId, `.orchestra/blobs/${hash}`, { internal: true }));
}
