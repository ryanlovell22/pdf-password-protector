import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';

/**
 * Encrypt a single PDF with a password.
 * @param {Uint8Array} pdfBytes - Raw PDF file bytes
 * @param {string} password - Password to apply
 * @returns {Promise<Uint8Array>} Encrypted PDF bytes
 */
export async function protectPDF(pdfBytes, password) {
  return await encryptPDF(pdfBytes, password);
}
