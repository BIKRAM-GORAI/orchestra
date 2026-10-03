import { Worker } from 'node:worker_threads';
import { projectError } from './filePaths.js';

export const MAX_DOCUMENT_CHARS = 2_000_000;

export async function extractDocumentText(file) {
  const extension = file.path.split('.').at(-1).toLowerCase();
  if (['pdf', 'docx'].includes(extension)) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../workers/documentTextWorker.js', import.meta.url), {
        workerData: { extension, data: file.data, maxChars: MAX_DOCUMENT_CHARS },
        resourceLimits: { maxOldGenerationSizeMb: 192 },
      });
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true; clearTimeout(timeout); void worker.terminate();
        if (error) reject(projectError(error)); else resolve(result);
      };
      const timeout = setTimeout(() => finish('Text extraction exceeded 30 seconds'), 30000);
      worker.once('message', result => finish(result.error, result));
      worker.once('error', error => finish(`Text extraction failed: ${error.message}`));
      worker.once('exit', code => { if (!settled) finish(`Text extractor exited before completing (${code})`); });
    });
  }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(file.data); }
  catch { throw projectError('Unsupported binary file. Text, code, CSV/JSON, text-based PDF and DOCX are readable.'); }
  if (/\x00/.test(text) || /^(image|audio|video)\//.test(file.mimeType || '') && extension !== 'svg') throw projectError('This file needs a format-specific reader or OCR; no text was extracted.');
  if (!text.trim()) throw projectError('This file contains no readable text.');
  return { text: text.slice(0, MAX_DOCUMENT_CHARS), truncated: text.length > MAX_DOCUMENT_CHARS };
}
