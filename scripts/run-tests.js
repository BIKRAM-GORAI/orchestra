import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Tests always use disposable disk storage. An online DB run is explicitly opt-in
// and receives a unique database name, never the application's configured DB.
const directory = await mkdtemp(path.join(tmpdir(), 'orchestra-tests-'));
const mongoUri = process.env.ORCHESTRA_TEST_MONGO_URI || '';
const env = { ...process.env, ORCHESTRA_DATA_DIR: directory, ORCHESTRA_STORAGE: mongoUri ? 'mongodb' : 'filesystem',
  MONGO_URI: mongoUri, MONGODB_URI: '', MONGO_DB_NAME: `orchestra_test_${Date.now()}`, TESTING_MONGODB: 'true', PREVIEW_ORIGIN: '' };
try {
  const requested = process.argv.slice(2);
  const files = requested.length ? requested : (await readdir('src/server/test')).filter(name => name.endsWith('.test.js')).map(name => `src/server/test/${name}`);
  const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...files], { env, stdio: 'inherit' });
  process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); });
} finally {
  await rm(directory, { recursive: true, force: true });
}
