import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../');

dotenv.config({ path: path.join(rootDir, '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || 'localhost',
  nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  isProduction: process.env.NODE_ENV === 'production',
  rootDir,
  projectsDir: path.join(rootDir, 'projects'),
  workspaceDir: path.join(rootDir, 'workspace'),
  workspaceIndexHtml: path.join(rootDir, 'workspace', 'index.html'),
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
