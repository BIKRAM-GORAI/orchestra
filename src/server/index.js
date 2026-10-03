import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './config/env.js';
import { router as apiRouter } from './routes/api.js';
import { connectMongo } from './db/mongo.js';
import { previewApp, handlePreviewRequest } from './routes/preview.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const app = express();
app.set('trust proxy', true);

// Preview documents run on another origin (or an opaque sandbox origin).
// They must not be able to read or mutate the studio API.
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Cross-origin API access is not allowed' });
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api', apiRouter);

// Legacy workspace content is no longer executed on the studio origin.
app.use('/workspace', (req, res) => res.redirect('/api/preview?starter=true'));

// Preview route support for single-port deployments (Render)
app.get('/p/:id/*', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "sandbox allow-scripts allow-forms allow-modals allow-same-origin; object-src 'none'; base-uri 'self'");
  handlePreviewRequest(req, res, next);
});

// Serve client frontend statically
const clientDir = path.join(rootDir, 'src', 'client');
app.use(express.static(clientDir));

app.get('/home', (req, res) => {
  res.sendFile(path.join(clientDir, 'home.html'));
});

app.get('/simple', (req, res) => {
  res.sendFile(path.join(clientDir, 'simple.html'));
});

// Fallback to index.html for client SPA
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/workspace') || req.path.startsWith('/p/')) {
    return next();
  }
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  if (!err.status || err.status >= 500) console.error('[SERVER ERROR]', err);
  res.status(err.status || (err.name === 'MulterError' ? 413 : 500)).json({
    status: 'error',
    error: err.message || 'Internal Server Error',
  });
});

// Process-level resilience against unhandled rejections and socket aborts
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

export function startServer() {
  const validation = validateConfig();
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(w => console.warn(`[CONFIG WARNING] ${w}`));
  }

  const server = app.listen(config.port, config.host, () => {
    console.log(`[ORCHESTRA SERVER] Running at http://${config.host}:${config.port}`);
  });
  const previewServer = previewApp.listen(config.previewPort, config.host, () => {
    console.log(`[PREVIEW SERVER] Running at http://${config.host}:${config.previewPort}`);
  });
  previewServer.on('error', err => { console.error('[PREVIEW SERVER]', err.message); });
  server.on('close', () => { try { previewServer.close(); } catch (_) {} });
  server.on('error', err => { console.error('[SERVER ERROR]', err.message); });

  if (config.mongoUri) {
    connectMongo().then(() => {
      console.log('[MONGODB] Connected and online storage initialized');
    }).catch(err => {
      console.warn(`[MONGODB] Online storage initialization warning: ${err.message}`);
    });
  }

  return server;
}

// Start immediately if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}

export default app;
export { previewApp };
