import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './config/env.js';
import { router as apiRouter } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api', apiRouter);

// Serve live preview workspace statically as well
app.use('/workspace', express.static(config.workspaceDir));

// Serve client frontend statically
const clientDir = path.join(rootDir, 'src', 'client');
app.use(express.static(clientDir));

// Fallback to index.html for client SPA
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/workspace')) {
    return next();
  }
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
});

export function startServer() {
  const validation = validateConfig();
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(w => console.warn(`[CONFIG WARNING] ${w}`));
  }

  const server = app.listen(config.port, config.host, () => {
    console.log(`[ORCHESTRA SERVER] Running at http://${config.host}:${config.port}`);
  });

  return server;
}

// Start immediately if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}

export default app;
