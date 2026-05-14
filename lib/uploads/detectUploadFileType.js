const path = require('node:path');

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
  '.pdf': {
    extension: '.pdf',
    type: 'pdf',
    mimeGuess: 'application/pdf'
  }
};

function detectUploadFileType(filePath) {
  const extension = path.extname(filePath || '').toLowerCase();
  const detected = FILE_TYPES[extension];

  if (!detected) {
    return {
      supported: false,
      extension,
      type: 'unsupported',
      mimeGuess: 'application/octet-stream',
      errors: [`Unsupported upload file type "${extension || '(none)'}". Supported types: ${supportedExtensions().join(', ')}.`]
    };
  }

  return {
    supported: true,
    ...detected,
    errors: []
  };
}

function supportedExtensions() {
  return Object.keys(FILE_TYPES);
}

module.exports = {
  detectUploadFileType,
  supportedExtensions
};
