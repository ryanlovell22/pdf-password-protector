import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';

/**
 * Encrypt a single PDF with a password (client-side).
 */
export async function protectPDF(pdfBytes, password) {
  return await encryptPDF(pdfBytes, password);
}

/**
 * Encrypt a Word document with a password (server-side via API).
 */
export async function protectDOCX(file, password) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', password);

  const response = await fetch('/api/encrypt-docx', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Encryption failed' }));
    throw new Error(error.error || 'Encryption failed');
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
