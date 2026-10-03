import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../');

dotenv.config({ path: path.join(rootDir, '.env') });

const dataDir = path.resolve(process.env.ORCHESTRA_DATA_DIR || rootDir);

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || (process.env.RENDER ? '0.0.0.0' : 'localhost'),
  nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  mistralApiKey: process.env.MISTRAL_API_KEY || '',
  isProduction: process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER),
  rootDir,
  mongoUri: process.env.ORCHESTRA_STORAGE === 'filesystem' ? '' : (process.env.MONGO_URI || process.env.MONGODB_URI || ''),
  mongoDbName: process.env.MONGO_DB_NAME || process.env.MONGODB_DB_NAME || '',
  projectsDir: path.join(dataDir, 'projects'),
  workspaceDir: path.join(dataDir, 'workspace'),
  workspaceIndexHtml: path.join(dataDir, 'workspace', 'index.html'),
  previewPort: parseInt(process.env.PREVIEW_PORT || String(Number(process.env.PORT || 3000) + 1), 10),
  previewOrigin: process.env.PREVIEW_ORIGIN || '',
};

export function validateConfig() {
  const warnings = [];
  if (!config.nvidiaApiKey) {
    warnings.push('NVIDIA_API_KEY is not set in environment or .env. Model Gateway calls will fail until it is provided.');
  }
  return {
    isValid: true,
    warnings,
  };
}
