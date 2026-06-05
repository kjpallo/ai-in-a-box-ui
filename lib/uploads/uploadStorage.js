const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { detectUploadFileType, supportedExtensions } = require('./detectUploadFileType');
const { extractTextFromFile } = require('./extractTextFromFile');
const { makeSourceManifestFromExtraction } = require('./sourceManifest');
const { planTeacherContentImport } = require('./planTeacherContentImport');
const {
  firstNonEmptyString,
  makeHttpError
} = require('../server/routeResponse');

const DEFAULT_UPLOAD_LIMIT_BYTES = 15 * 1024 * 1024;

async function storeAndExtractUpload(upload, options = {}) {
  const originalFileName = sanitizeOriginalFileName(upload.originalFileName);
  if (!originalFileName) {
    return {
      success: false,
      errors: ['Uploaded file must include a filename.']
    };
  }

  const detection = detectUploadFileType(originalFileName, { buffer: upload.buffer });
  if (!detection.supported) {
    return {
      success: false,
      errors: detection.errors || [`Unsupported upload file type. Supported types: ${supportedExtensions().join(', ')}.`]
    };
  }

  const uploadId = makeUploadId();
  const incomingDir = getUploadIncomingDir(options);
  const extractedDir = getUploadExtractedDir(options);
  fs.mkdirSync(incomingDir, { recursive: true });
  fs.mkdirSync(extractedDir, { recursive: true });

  const storedFileName = `${uploadId}${detection.extension}`;
  const extractionJsonFileName = `${uploadId}_extraction.json`;
  const storedFilePath = path.join(incomingDir, storedFileName);
  const extractionJsonPath = path.join(extractedDir, extractionJsonFileName);

  fs.writeFileSync(storedFilePath, upload.buffer);

  const extraction = await extractTextFromFile(storedFilePath);
  const extractionWithOriginalSource = {
    ...extraction,
    sections: Array.isArray(extraction.sections)
      ? extraction.sections.map((section) => ({
          ...section,
          sourceFile: firstNonEmptyString(originalFileName, section && section.sourceFile)
        }))
      : [],
    pages: Array.isArray(extraction.pages)
      ? extraction.pages.map((page) => ({
          ...page,
          sourceFile: firstNonEmptyString(originalFileName, page && page.sourceFile)
        }))
      : [],
    metadata: {
      ...(extraction.metadata || {}),
      originalFileName
    }
  };
  const extractionWarnings = [
    ...(detection.warnings || []),
    ...(extraction.warnings || [])
  ];
  const autoImportPlan = planTeacherContentImport({
    extraction: extractionWithOriginalSource,
    fileSizeBytes: upload.buffer.length,
    settings: options,
    memory: options.systemMemory
  });
  const sourceManifest = makeSourceManifestFromExtraction(extractionWithOriginalSource);
  const extractionWithUploadMetadata = {
    ...extractionWithOriginalSource,
    upload: {
      uploadId,
      originalFileName,
      storedFileName,
      extractionJsonFileName
    },
    sourceManifest,
    importPlan: autoImportPlan,
    warnings: extractionWarnings
  };
  fs.writeFileSync(extractionJsonPath, `${JSON.stringify(extractionWithUploadMetadata, null, 2)}\n`);

  const response = {
    success: extraction.success === true,
    data: {
      uploadId,
      originalFileName,
      storedFileName,
      extractionJsonFileName,
      fileType: detection.type,
      characterCount: extractionWithOriginalSource.text.length,
      pageCount: Number(extractionWithOriginalSource.metadata && extractionWithOriginalSource.metadata.pageCount || 0),
      sectionsCount: extractionWithOriginalSource.sections.length,
      tablesCount: extractionWithOriginalSource.tables.length,
      sourceManifest,
      warnings: extractionWarnings,
      errors: extraction.errors || [],
      extraction: makeExtractionSummary(extractionWithUploadMetadata),
      autoImportPlan
    },
    warnings: [...extractionWarnings, ...(autoImportPlan.warnings || [])],
    errors: extraction.errors || []
  };

  if (!response.success) {
    return {
      success: false,
      errors: response.errors,
      warnings: response.warnings,
      data: response.data
    };
  }

  return response;
}

function getUploadIncomingDir(options = {}) {
  return options.uploadIncomingDir
    || path.join(__dirname, '..', '..', 'knowledge', 'uploads', 'incoming');
}

function getUploadExtractedDir(options = {}) {
  return options.uploadExtractedDir
    || path.join(__dirname, '..', '..', 'knowledge', 'uploads', 'extracted');
}

function getExtractionJsonPathForUpload(uploadId, options = {}) {
  const extractedDir = path.resolve(getUploadExtractedDir(options));
  const extractionJsonPath = path.resolve(extractedDir, `${uploadId}_extraction.json`);
  if (path.dirname(extractionJsonPath) !== extractedDir) {
    throw makeHttpError('uploadId resolved outside the extracted uploads directory.', 400);
  }
  return extractionJsonPath;
}

function makeExtractionSummary(extraction) {
  const sourceManifest = Array.isArray(extraction.sourceManifest)
    ? extraction.sourceManifest
    : Array.isArray(extraction.metadata && extraction.metadata.sourceManifest)
      ? extraction.metadata.sourceManifest
      : [];
  return {
    success: extraction.success === true,
    fileName: extraction.fileName || '',
    extension: extraction.extension || '',
    mimeGuess: extraction.mimeGuess || '',
    detectedType: extraction.metadata?.detectedType || 'unsupported',
    characterCount: extraction.text.length,
    pageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
    sectionsCount: extraction.sections.length,
    tablesCount: extraction.tables.length,
    sourceManifest,
    warnings: extraction.warnings || [],
    errors: extraction.errors || []
  };
}

function readSingleMultipartUpload(req, options = {}) {
  const maxBytes = Number(options.maxBytes || DEFAULT_UPLOAD_LIMIT_BYTES);
  const contentType = String(req.headers && (req.headers['content-type'] || req.headers['Content-Type']) || '');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    return Promise.reject(makeHttpError('Expected multipart/form-data upload with one source file.', 400));
  }

  const contentLength = Number(req.headers && (req.headers['content-length'] || req.headers['Content-Length']) || 0);
  if (contentLength > maxBytes) {
    return Promise.reject(makeHttpError(`Upload is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)} MB.`, 413));
  }

  return readRequestBuffer(req, maxBytes).then((body) => {
    const files = parseMultipartFiles(body, boundaryMatch[1] || boundaryMatch[2]);
    if (files.length !== 1) {
      if (files.length === 0) {
        throw makeHttpError('No file was received by the upload route.', 400);
      }
      throw makeHttpError('Upload must include exactly one source file.', 400);
    }
    if (!files[0].buffer.length) {
      throw makeHttpError('Uploaded source file is empty.', 400);
    }
    return files[0];
  });
}

function readRequestBuffer(req, maxBytes) {
  if (Buffer.isBuffer(req.rawBody)) {
    if (req.rawBody.length > maxBytes) {
      return Promise.reject(makeHttpError(`Upload is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)} MB.`, 413));
    }
    return Promise.resolve(req.rawBody);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(makeHttpError(`Upload is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)} MB.`, 413));
        req.destroy?.();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipartFiles(body, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const files = [];
  const fields = {};
  let cursor = body.indexOf(boundaryBuffer);

  while (cursor >= 0) {
    cursor += boundaryBuffer.length;
    if (body.slice(cursor, cursor + 2).toString('latin1') === '--') break;
    if (body.slice(cursor, cursor + 2).toString('latin1') === '\r\n') cursor += 2;

    const nextBoundary = body.indexOf(boundaryBuffer, cursor);
    if (nextBoundary < 0) break;

    let part = body.slice(cursor, nextBoundary);
    if (part.slice(-2).toString('latin1') === '\r\n') {
      part = part.slice(0, -2);
    }

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd >= 0) {
      const headers = parsePartHeaders(part.slice(0, headerEnd).toString('latin1'));
      const disposition = headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="([^"]*)"/i);
      const nameMatch = disposition.match(/name="([^"]*)"/i);
      if (filenameMatch && filenameMatch[1]) {
        files.push({
          originalFileName: filenameMatch[1],
          buffer: part.slice(headerEnd + 4),
          contentType: headers['content-type'] || 'application/octet-stream',
          fields
        });
      } else if (nameMatch && nameMatch[1]) {
        fields[nameMatch[1]] = part.slice(headerEnd + 4).toString('utf8');
      }
    }

    cursor = nextBoundary;
  }

  files.forEach((file) => {
    file.fields = fields;
  });
  return files;
}

function parsePartHeaders(headerText) {
  return String(headerText || '').split('\r\n').reduce((headers, line) => {
    const separator = line.indexOf(':');
    if (separator > 0) {
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
    return headers;
  }, {});
}

function makeUploadId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${crypto.randomBytes(12).toString('hex')}`;
}

function sanitizeOriginalFileName(fileName) {
  return path.basename(String(fileName || ''))
    .normalize('NFKC')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  DEFAULT_UPLOAD_LIMIT_BYTES,
  getExtractionJsonPathForUpload,
  getUploadExtractedDir,
  getUploadIncomingDir,
  makeExtractionSummary,
  readSingleMultipartUpload,
  storeAndExtractUpload
};
