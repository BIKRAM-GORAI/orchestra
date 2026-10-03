import { parentPort, workerData } from 'node:worker_threads';

try {
  const { extension, maxChars } = workerData;
  const data = Buffer.from(workerData.data);
  let text = '', truncated = false;
  if (extension === 'pdf') {
    const { getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(data), { isEvalSupported: false, maxImageSize: 0, useSystemFonts: true });
    try {
      const pages = Math.min(pdf.numPages, 200);
      truncated = pdf.numPages > pages;
      for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        text += `\n\n[Page ${pageNumber}]\n` + content.items.filter(item => typeof item.str === 'string').map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
        page.cleanup();
        if (text.length > maxChars) { truncated = true; break; }
      }
      // Page markers alone are not evidence from a scanned/image-only PDF.
      if (!text.replace(/\[Page \d+\]/g, '').trim()) throw new Error('No extractable text. This PDF may require OCR.');
    } finally { await pdf.destroy?.(); }
  } else {
    // Bound expanded DOCX entries before passing the archive to its XML reader.
    const { readZip } = await import('../services/importService.js');
    await readZip(data, { skipIgnored: false });
    const mammoth = await import('mammoth');
    const result = await mammoth.default.extractRawText({ buffer: data });
    text = result.value;
    truncated = text.length > maxChars;
    if (!text.trim()) throw new Error('No text could be extracted from this DOCX.');
  }
  parentPort.postMessage({ text: text.slice(0, maxChars), truncated });
} catch (error) { parentPort.postMessage({ error: error.message }); }
