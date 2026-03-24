import { protectPDF } from './encrypt.js';

// --- DOM elements ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const passwordSection = document.getElementById('password-section');
const passwordInput = document.getElementById('password-input');
const togglePasswordBtn = document.getElementById('toggle-password');
const passwordStrength = document.getElementById('password-strength');
const actionSection = document.getElementById('action-section');
const protectBtn = document.getElementById('protect-btn');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const downloadSection = document.getElementById('download-section');
const downloadBtn = document.getElementById('download-btn');
const successText = document.getElementById('success-text');
const resetBtn = document.getElementById('reset-btn');
const errorMessage = document.getElementById('error-message');

// --- State ---
const MAX_FILES = 5;
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
let selectedFiles = [];
let encryptedResults = []; // {name, blob} for each protected file

// --- File upload ---
const browseBtn = document.getElementById('browse-btn');

// Prevent browser from opening files dropped anywhere on the page
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// Click anywhere in the drop zone OR the browse button to open file picker
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
  if (e.target === dropZone) {
    dropZone.classList.remove('drag-over');
  }
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
    if (selectedFiles.length >= MAX_FILES) {
      showError(`Maximum ${MAX_FILES} files allowed.`);
      break;
    }
    if (!file.type && !file.name.toLowerCase().endsWith('.pdf')) {
      showError(`"${file.name}" is not a PDF file.`);
      continue;
    }
    if (file.type && file.type !== 'application/pdf') {
      showError(`"${file.name}" is not a PDF file.`);
      continue;
    }
    if (file.size > MAX_SIZE) {
      showError(`"${file.name}" exceeds the 50MB size limit.`);
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
  fileList.innerHTML = selectedFiles.map((file, i) => `
    <div class="file-item" data-index="${i}">
      <div class="file-info">
        <span class="file-icon">PDF</span>
        <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <span class="file-size">${formatSize(file.size)}</span>
      </div>
      <button class="file-remove" data-index="${i}" aria-label="Remove file">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
  `).join('');

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
  protectBtn.disabled = !hasFiles || !hasPassword;

  hideError();
}

// --- Protect action ---
protectBtn.addEventListener('click', async () => {
  hideError();
  const password = passwordInput.value;

  // Show progress
  actionSection.hidden = true;
  passwordSection.hidden = true;
  progressSection.hidden = false;
  downloadSection.hidden = true;
  progressBar.style.width = '0%';

  // Disable file removal during processing
  dropZone.style.pointerEvents = 'none';

  encryptedResults = [];
  let errors = 0;

  for (const file of selectedFiles) {
    progressText.textContent = `Encrypting ${file.name}...`;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);
      const encrypted = await protectPDF(pdfBytes, password);

      const protectedName = file.name.replace(/\.pdf$/i, '_protected.pdf');
      encryptedResults.push({
        name: protectedName,
        blob: new Blob([encrypted], { type: 'application/pdf' }),
      });
    } catch (err) {
      console.error(`Error encrypting ${file.name}:`, err);
      errors++;
    }

    const progress = ((encryptedResults.length + errors) / selectedFiles.length) * 100;
    progressBar.style.width = `${progress}%`;
  }

  if (encryptedResults.length === 0) {
    showError('Failed to encrypt any files. They may be corrupted or already encrypted.');
    progressSection.hidden = true;
    actionSection.hidden = false;
    passwordSection.hidden = false;
    dropZone.style.pointerEvents = '';
    return;
  }

  progressSection.hidden = true;
  downloadSection.hidden = false;

  // Update download button text
  if (encryptedResults.length === 1) {
    downloadBtn.textContent = `Download ${encryptedResults[0].name}`;
  } else {
    downloadBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 14v2a2 2 0 002 2h10a2 2 0 002-2v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Download All (${encryptedResults.length} PDFs)
    `;
  }

  if (errors > 0) {
    successText.textContent = `${encryptedResults.length} of ${selectedFiles.length} PDFs protected (${errors} failed)`;
  } else {
    successText.textContent = selectedFiles.length === 1
      ? 'PDF protected!'
      : `All ${encryptedResults.length} PDFs protected!`;
  }
});

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

  // Download each PDF individually
  for (const result of encryptedResults) {
    triggerDownload(result.blob, result.name);
  }
});

// --- Reset ---
resetBtn.addEventListener('click', () => {
  selectedFiles = [];
  encryptedResults = [];
  passwordInput.value = '';
  passwordStrength.innerHTML = '';
  renderFileList();
  downloadSection.hidden = true;
  progressSection.hidden = true;
  dropZone.style.pointerEvents = '';
  updateUI();
});

// --- Helpers ---
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
