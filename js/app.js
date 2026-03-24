import { protectPDF, protectDOCX } from './encrypt.js';

// --- DOM elements ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const passwordSection = document.getElementById('password-section');
const passwordInput = document.getElementById('password-input');
const togglePasswordBtn = document.getElementById('toggle-password');
const copyPasswordBtn = document.getElementById('copy-password');
const generatePasswordBtn = document.getElementById('generate-password');
const passwordStrength = document.getElementById('password-strength');
const actionSection = document.getElementById('action-section');
const protectBtn = document.getElementById('protect-btn');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const downloadSection = document.getElementById('download-section');
const downloadBtn = document.getElementById('download-btn');
const successText = document.getElementById('success-text');
const resultsList = document.getElementById('results-list');
const resetBtn = document.getElementById('reset-btn');
const errorMessage = document.getElementById('error-message');

// --- State ---
const MAX_SIZE_PDF = 50 * 1024 * 1024;
const MAX_SIZE_DOCX = 4.5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
let selectedFiles = [];
let encryptedResults = [];
let fileResults = []; // per-file tracking: {name, success, error}
let isProcessing = false;

// --- Helpers ---
function getExtension(filename) {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

function isPDF(file) {
  return getExtension(file.name) === '.pdf';
}

function isDOCX(file) {
  return getExtension(file.name) === '.docx';
}

function isAllowedFile(file) {
  return ALLOWED_EXTENSIONS.includes(getExtension(file.name));
}

function getMaxSize(file) {
  return isDOCX(file) ? MAX_SIZE_DOCX : MAX_SIZE_PDF;
}

function getFileTypeLabel(file) {
  return isPDF(file) ? 'PDF' : 'DOCX';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.hidden = false;
}

function hideError() {
  errorMessage.hidden = true;
}

// --- File upload ---
const browseBtn = document.getElementById('browse-btn');

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

dropZone.addEventListener('click', (e) => {
  if (e.target !== browseBtn) fileInput.click();
});
browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.target === dropZone) dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';
});

function handleFiles(fileListInput) {
  const newFiles = Array.from(fileListInput);

  for (const file of newFiles) {
    if (!isAllowedFile(file)) {
      showError(`"${file.name}" is not a supported file type. Use PDF or DOCX.`);
      continue;
    }
    const maxSize = getMaxSize(file);
    if (file.size > maxSize) {
      const limitLabel = isDOCX(file) ? '4.5MB' : '50MB';
      showError(`"${file.name}" exceeds the ${limitLabel} size limit.`);
      continue;
    }
    if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      continue;
    }
    selectedFiles.push(file);
  }

  renderFileList();
  updateUI();
}

function renderFileList() {
  if (selectedFiles.length === 0) {
    fileList.hidden = true;
    return;
  }

  fileList.hidden = false;
  fileList.innerHTML = selectedFiles.map((file, i) => {
    const typeLabel = getFileTypeLabel(file);
    const iconClass = isDOCX(file) ? 'file-icon docx' : 'file-icon';
    return `
      <div class="file-item" data-index="${i}">
        <div class="file-info">
          <span class="${iconClass}">${typeLabel}</span>
          <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span class="file-size">${formatSize(file.size)}</span>
        </div>
        <button class="file-remove" data-index="${i}" aria-label="Remove file">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
    `;
  }).join('');

  fileList.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      selectedFiles.splice(index, 1);
      renderFileList();
      updateUI();
    });
  });
}

// --- Password ---
togglePasswordBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
});

passwordInput.addEventListener('input', () => {
  updateStrength();
  copyPasswordBtn.hidden = passwordInput.value.length === 0;
  updateUI();
});

// Enter key triggers encryption
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !protectBtn.disabled && !isProcessing) {
    protectBtn.click();
  }
});

// Copy password
copyPasswordBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  try {
    await navigator.clipboard.writeText(passwordInput.value);
    copyPasswordBtn.classList.add('copied');
    setTimeout(() => copyPasswordBtn.classList.remove('copied'), 1500);
  } catch {
    // Fallback for older browsers
    passwordInput.select();
    document.execCommand('copy');
  }
});

// Generate password
generatePasswordBtn.addEventListener('click', () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const array = new Uint32Array(14);
  crypto.getRandomValues(array);
  const password = Array.from(array, (n) => chars[n % chars.length]).join('');
  passwordInput.value = password;
  passwordInput.type = 'text'; // show it so user can see what was generated
  copyPasswordBtn.hidden = false;
  updateStrength();
  updateUI();
});

function updateStrength() {
  const pw = passwordInput.value;
  let score = 0;
  if (pw.length >= 4) score++;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const colours = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];
  const widths = ['20%', '40%', '60%', '80%', '100%'];

  if (pw.length === 0) {
    passwordStrength.innerHTML = '';
  } else {
    const level = Math.min(score, 4);
    passwordStrength.innerHTML = `<div class="bar" style="width:${widths[level]};background:${colours[level]}"></div>`;
  }
}

// --- UI state ---
function updateUI() {
  const hasFiles = selectedFiles.length > 0;
  const hasPassword = passwordInput.value.length > 0;

  passwordSection.hidden = !hasFiles;
  actionSection.hidden = !hasFiles;
  protectBtn.disabled = !hasFiles || !hasPassword || isProcessing;

  hideError();
}

// --- Protect action ---
protectBtn.addEventListener('click', async () => {
  if (isProcessing) return; // double-click guard
  isProcessing = true;
  protectBtn.disabled = true;
  hideError();
  const password = passwordInput.value;

  actionSection.hidden = true;
  passwordSection.hidden = true;
  progressSection.hidden = false;
  downloadSection.hidden = true;
  progressBar.style.width = '0%';
  dropZone.style.pointerEvents = 'none';

  encryptedResults = [];
  fileResults = [];

  for (const file of selectedFiles) {
    progressText.textContent = `Encrypting ${file.name}...`;

    try {
      let encrypted;
      if (isPDF(file)) {
        const arrayBuffer = await file.arrayBuffer();
        encrypted = await protectPDF(new Uint8Array(arrayBuffer), password);
        const protectedName = file.name.replace(/\.pdf$/i, '_protected.pdf');
        encryptedResults.push({
          name: protectedName,
          blob: new Blob([encrypted], { type: 'application/pdf' }),
        });
        fileResults.push({ name: file.name, success: true });
      } else if (isDOCX(file)) {
        encrypted = await protectDOCX(file, password);
        const protectedName = file.name.replace(/\.docx$/i, '_protected.docx');
        encryptedResults.push({
          name: protectedName,
          blob: new Blob([encrypted], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        });
        fileResults.push({ name: file.name, success: true });
      }
    } catch (err) {
      console.error(`Error encrypting ${file.name}:`, err);
      fileResults.push({ name: file.name, success: false, error: err.message });
    }

    const progress = (fileResults.length / selectedFiles.length) * 100;
    progressBar.style.width = `${progress}%`;
  }

  isProcessing = false;

  if (encryptedResults.length === 0) {
    showError('Failed to encrypt any files. See details below.');
    progressSection.hidden = true;
    actionSection.hidden = false;
    passwordSection.hidden = false;
    dropZone.style.pointerEvents = '';
    protectBtn.disabled = false;
    renderResults();
    return;
  }

  progressSection.hidden = true;
  downloadSection.hidden = false;

  const failures = fileResults.filter(r => !r.success).length;
  if (failures > 0) {
    successText.textContent = `${encryptedResults.length} of ${selectedFiles.length} files protected`;
  } else {
    successText.textContent = selectedFiles.length === 1
      ? 'File protected!'
      : `All ${encryptedResults.length} files protected!`;
  }

  renderResults();

  // Auto-download all protected files
  for (const result of encryptedResults) {
    triggerDownload(result.blob, result.name);
  }

  // Update button for manual re-download
  if (encryptedResults.length === 1) {
    downloadBtn.textContent = 'Download again';
  } else {
    downloadBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 14v2a2 2 0 002 2h10a2 2 0 002-2v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Download again (${encryptedResults.length} files)
    `;
  }
});

// --- Results list ---
function renderResults() {
  if (fileResults.length === 0 || fileResults.every(r => r.success)) {
    resultsList.hidden = true;
    return;
  }

  resultsList.hidden = false;
  resultsList.innerHTML = fileResults.map(r => {
    if (r.success) {
      return `<div class="result-item success"><span class="result-icon">&#10003;</span><span class="result-name">${escapeHtml(r.name)}</span></div>`;
    }
    return `<div class="result-item failure"><span class="result-icon">&#10007;</span><span class="result-name">${escapeHtml(r.name)}</span><span class="result-error">${escapeHtml(r.error)}</span></div>`;
  }).join('');
}

// --- Download ---
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

downloadBtn.addEventListener('click', () => {
  if (encryptedResults.length === 0) return;
  for (const result of encryptedResults) {
    triggerDownload(result.blob, result.name);
  }
});

// --- Reset (sticky password) ---
resetBtn.addEventListener('click', () => {
  selectedFiles = [];
  encryptedResults = [];
  fileResults = [];
  // Password is intentionally NOT cleared — sticky between batches
  renderFileList();
  resultsList.hidden = true;
  downloadSection.hidden = true;
  progressSection.hidden = true;
  dropZone.style.pointerEvents = '';
  updateUI();
});
