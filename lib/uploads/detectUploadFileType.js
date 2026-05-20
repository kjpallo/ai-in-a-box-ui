const path = require('node:path');
const fs = require('node:fs');

const FILE_TYPES = {
  '.txt': {
    extension: '.txt',
    type: 'txt',
    mimeGuess: 'text/plain'
  },
  '.csv': {
    extension: '.csv',
    type: 'csv',
    mimeGuess: 'text/csv'
  },
  '.json': {
    extension: '.json',
    type: 'json',
    mimeGuess: 'application/json'
  },
  '.docx': {
    extension: '.docx',
    type: 'docx',
    mimeGuess: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  '.xlsx': {
    extension: '.xlsx',
    type: 'xlsx',
    mimeGuess: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  },
  '.pptx': {
    extension: '.pptx',
    type: 'pptx',
    mimeGuess: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  },
  '.pdf': {
    extension: '.pdf',
    type: 'pdf',
    mimeGuess: 'application/pdf'
  }
};

function detectUploadFileType(filePath, options = {}) {
  const fileName = options.originalFileName || filePath || '';
  const extension = path.extname(fileName).toLowerCase();
  const signature = detectFileSignature(filePath, options);
  const detected = signature.type ? FILE_TYPES[signature.extension] : FILE_TYPES[extension];
  const warnings = [];

  if (signature.type && extension && extension !== signature.extension) {
    warnings.push(`Upload filename extension "${extension}" did not match the file contents. Treating it as ${signature.type.toUpperCase()} based on the file signature.`);
  }

  if ((signature.type || detected && detected.type) === 'pdf' && looksLikePowerPointPdfExport(fileName)) {
    warnings.push('This upload is being treated as a PDF because it is a PDF file. Upload the original .pptx if you want slide-based extraction.');
  }

  if (!detected) {
    const legacyPowerPointMessage = extension === '.ppt'
      ? 'Legacy .ppt uploads are not supported. Please save the presentation as .pptx or PDF and upload it again.'
      : null;
    return {
      supported: false,
      extension,
      type: 'unsupported',
      mimeGuess: 'application/octet-stream',
      warnings,
      errors: [legacyPowerPointMessage || `Unsupported upload file type "${extension || '(none)'}". Supported types: ${supportedExtensions().join(', ')}.`]
    };
  }

  return {
    supported: true,
    ...detected,
    detectedBySignature: Boolean(signature.type),
    filenameExtension: extension,
    warnings,
    errors: []
  };
}

function supportedExtensions() {
  return Object.keys(FILE_TYPES);
}

function detectFileSignature(filePath, options = {}) {
  const buffer = Buffer.isBuffer(options.buffer)
    ? options.buffer
    : readSignatureBuffer(filePath);
  if (!buffer || buffer.length < 4) return {};

  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { type: 'pdf', extension: '.pdf' };
  }

  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    const zipDirectoryText = buffer.toString('latin1');
    if (/ppt\/(?:presentation|slides\/slide\d+)\.xml/i.test(zipDirectoryText) || /ppt\/slides\//i.test(zipDirectoryText)) {
      return { type: 'pptx', extension: '.pptx' };
    }
    if (/word\/document\.xml/i.test(zipDirectoryText)) {
      return { type: 'docx', extension: '.docx' };
    }
    if (/xl\/workbook\.xml/i.test(zipDirectoryText)) {
      return { type: 'xlsx', extension: '.xlsx' };
    }
  }

  return {};
}

function readSignatureBuffer(filePath) {
  try {
    if (!filePath || typeof filePath !== 'string') return null;
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
    const fd = fs.openSync(resolved, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(fs.statSync(resolved).size, 65536));
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      fs.closeSync(fd);
    }
  } catch (_error) {
    return null;
  }
}

function looksLikePowerPointPdfExport(fileName) {
  const name = path.basename(String(fileName || '')).toLowerCase();
  return name.includes('.pptx.pdf') || name.includes('powerpoint') && name.endsWith('.pdf');
}

module.exports = {
  detectUploadFileType,
  supportedExtensions
};
