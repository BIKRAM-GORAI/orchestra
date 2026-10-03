import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';

const mongo = await MongoMemoryServer.create();
try {
  const child = spawn(process.execPath, ['scripts/run-tests.js', 'src/server/test/documents.test.js', 'src/server/test/multifile.test.js', 'src/server/test/phase8_mongodb_persistence.test.js'], {
    env: { ...process.env, ORCHESTRA_TEST_MONGO_URI: mongo.getUri() }, stdio: 'inherit',
  });
  process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); });
} finally { await mongo.stop(); }
