import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';

/**
 * Encrypt a single PDF with a password (client-side).
 */
export async function protectPDF(pdfBytes, password) {
  try {
    return await encryptPDF(pdfBytes, password);
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('encrypt') || msg.includes('password')) {
      throw new Error('This PDF may already be password-protected.');
    }
    if (msg.includes('Invalid') || msg.includes('parse') || msg.includes('PDF')) {
      throw new Error('This file appears to be corrupted or is not a valid PDF.');
    }
    throw new Error(`PDF encryption failed: ${msg || 'Unknown error'}`);
  }
}

/**
 * Encrypt a Word document with a password (server-side via API).
 */
export async function protectDOCX(file, password) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', password);

  let response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    response = await fetch('/api/encrypt-docx', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Server timed out. The file may be too large — try again.');
    }
    if (!navigator.onLine) {
      throw new Error('No internet connection. Check your network and try again.');
    }
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Encryption failed' }));
    throw new Error(error.error || 'Encryption failed');
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
