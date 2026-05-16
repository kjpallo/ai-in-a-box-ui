const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  getDraftPackReport,
  getTeacherContentDashboard,
  listApprovedPacksSummary,
  listDraftPacksForReview
} = require('../lib/uploads/teacherContentAdapter');
const { setApprovedPackActivation } = require('../lib/knowledge/approvedPackActivationStore');
const { promoteDraftKnowledgePack } = require('../lib/knowledge/promoteDraftKnowledgePack');
const {
  REVIEWABLE_SECTIONS,
  SAFE_EDIT_FIELDS,
  editDraftItemField,
  updateDraftItemReviewStatus
} = require('../lib/knowledge/reviewDraftKnowledgePack');
const { REVIEW_STATUSES } = require('../lib/knowledge/packSchema');
const { detectUploadFileType, supportedExtensions } = require('../lib/uploads/detectUploadFileType');
const { extractTextFromFile } = require('../lib/uploads/extractTextFromFile');
const { generateDraftKnowledgePack } = require('../lib/uploads/generateDraftKnowledgePack');
const {
  getStandardsBankDetails,
  listStandardsBanks,
  loadStandardsBankForReport
} = require('../lib/standards/standardsBankDiscovery');

const SAFE_PACK_ID_PATTERN = /^[a-z0-9_-]+$/;
const SAFE_UPLOAD_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/;
const DEFAULT_UPLOAD_LIMIT_BYTES = 15 * 1024 * 1024;

function createTeacherContentRoutes(options = {}) {
  const router = express.Router();
  registerTeacherContentRoutes(router, options);
  return router;
}

function registerTeacherContentRoutes(app, options = {}) {
  app.get('/dashboard', (_req, res) => {
    sendJson(res, () => getTeacherContentDashboard(options));
  });

  app.get('/drafts', (_req, res) => {
    sendJson(res, () => listDraftPacksForReview(options));
  });

  app.get('/standards-banks', (_req, res) => {
    sendJson(res, () => listStandardsBanks(options));
  });

  app.get('/standards-banks/:standardsBankId', (req, res) => {
    const standardsBankId = String(req.params && req.params.standardsBankId || '').trim();
    const result = getStandardsBankDetails(standardsBankId, options);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        errors: result.errors || ['Standards bank could not be loaded.'],
        warnings: result.warnings || []
      });
    }

    return res.json({
      success: true,
      data: result.standardsBank
    });
  });

  app.post('/uploads/extract', async (req, res) => {
    try {
      const upload = await readSingleMultipartUpload(req, {
        maxBytes: Number(options.maxUploadBytes || DEFAULT_UPLOAD_LIMIT_BYTES)
      });
      const result = await storeAndExtractUpload(upload, options);
      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  });

  app.post('/uploads/:uploadId/prepare-review', async (req, res) => {
    const uploadId = String(req.params && req.params.uploadId || '').trim();
    if (!isSafeUploadId(uploadId)) {
      return res.status(400).json({
        success: false,
        errors: ['uploadId must contain only lowercase letters, numbers, underscores, and hyphens.'],
        warnings: []
      });
    }

    try {
      const result = await prepareReviewDraftFromUpload(uploadId, req.body || {}, options);
      if (!result.success) {
        return res.status(result.statusCode || 400).json(stripStatusCode(result));
      }
      return res.json(result);
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.get('/drafts/:packId/report', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    try {
      const reportOptions = { ...options };
      const standardsBankId = String(req.query && req.query.standardsBankId || '').trim();
      if (standardsBankId) {
        const bankResult = loadStandardsBankForReport(standardsBankId, options);
        if (!bankResult.success) {
          return res.status(bankResult.statusCode || 400).json({
            success: false,
            errors: bankResult.errors || ['Standards bank could not be loaded.'],
            warnings: bankResult.warnings || []
          });
        }
        reportOptions.standardsBank = bankResult.standardsBank;
        reportOptions.standardsBankSummary = bankResult.summary;
      }

      const report = getDraftPackReport(packId, reportOptions);
      if (!report.success) {
        return res.status(404).json({
          success: false,
          errors: report.errors || ['Draft pack not found.']
        });
      }

      return res.json({
        success: true,
        data: report
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.patch('/drafts/:packId/items/:section/:index/status', (req, res) => {
    const validation = validateDraftItemRouteParams(req.params);
    if (!validation.success) {
      return res.status(400).json(validation);
    }

    const reviewStatus = req.body && req.body.reviewStatus;
    if (!REVIEW_STATUSES.includes(reviewStatus)) {
      return res.status(400).json({
        success: false,
        errors: [`reviewStatus must be one of: ${REVIEW_STATUSES.join(', ')}`]
      });
    }

    try {
      const update = updateDraftItemReviewStatus(
        validation.packId,
        validation.section,
        validation.index,
        reviewStatus,
        options
      );
      return sendDraftMutationResponse(res, update, validation.packId, options);
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.patch('/drafts/:packId/items/:section/:index', (req, res) => {
    const validation = validateDraftItemRouteParams(req.params);
    if (!validation.success) {
      return res.status(400).json(validation);
    }

    const field = String(req.body && req.body.field || '').trim();
    const allowedFields = SAFE_EDIT_FIELDS[validation.section] || new Set();
    if (!allowedFields.has(field)) {
      return res.status(400).json({
        success: false,
        errors: [`Field ${validation.section}.${field || '(empty)'} is not editable through draft review.`]
      });
    }

    try {
      const update = editDraftItemField(
        validation.packId,
        validation.section,
        validation.index,
        field,
        req.body && Object.prototype.hasOwnProperty.call(req.body, 'value') ? req.body.value : '',
        options
      );
      return sendDraftMutationResponse(res, update, validation.packId, options);
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.post('/drafts/:packId/promote', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    try {
      const promotion = promoteDraftKnowledgePack(packId, {
        ...options,
        force: req.body && req.body.force === true
      });

      if (!promotion.success) {
        const report = getDraftPackReport(packId, options);
        const missingDraft = (promotion.errors || []).some((error) => String(error).includes('No draft knowledge pack found'));
        return res.status(missingDraft ? 404 : 400).json({
          success: false,
          errors: promotion.errors || ['Draft promotion failed.'],
          warnings: promotion.warnings || [],
          promotionReadiness: report && report.promotionReadiness ? report.promotionReadiness : undefined
        });
      }

      const approvedSummary = listApprovedPacksSummary(options);
      const approved = approvedSummary.approvedPacks.find((pack) => pack.packId === promotion.packId) || null;

      return res.json({
        success: true,
        data: {
          packId: promotion.packId,
          message: 'Draft promoted to approved knowledge pack.',
          outputPath: promotion.outputPath,
          approved,
          dashboard: getTeacherContentDashboard(options),
          report: getDraftPackReport(packId, options),
          approvedSummary
        },
        warnings: promotion.warnings || [],
        errors: []
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.get('/approved', (_req, res) => {
    sendJson(res, () => listApprovedPacksSummary(options));
  });

  app.patch('/approved/:packId/activation', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    if (!req.body || typeof req.body.enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        errors: ['enabled must be a boolean.']
      });
    }

    try {
      const activation = setApprovedPackActivation(packId, req.body.enabled, options);
      const approvedSummary = listApprovedPacksSummary(options);
      const approved = approvedSummary.approvedPacks.find((pack) => pack.packId === packId) || null;

      return res.json({
        success: true,
        data: {
          packId,
          activationEnabled: activation.activationEnabled,
          activationStatus: activation.activationStatus,
          activationUpdatedAt: activation.activationUpdatedAt,
          message: 'Activation setting saved. This does not change student answers yet.',
          approved,
          approvedSummary
        },
        errors: [],
        warnings: []
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  });
}

async function storeAndExtractUpload(upload, options = {}) {
  const originalFileName = sanitizeOriginalFileName(upload.originalFileName);
  if (!originalFileName) {
    return {
      success: false,
      errors: ['Uploaded file must include a filename.']
    };
  }

  const detection = detectUploadFileType(originalFileName);
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
  const extractionWithUploadMetadata = {
    ...extraction,
    upload: {
      uploadId,
      originalFileName,
      storedFileName,
      extractionJsonFileName
    }
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
      characterCount: extraction.text.length,
      sectionsCount: extraction.sections.length,
      tablesCount: extraction.tables.length,
      warnings: extraction.warnings || [],
      errors: extraction.errors || [],
      extraction: makeExtractionSummary(extraction)
    },
    warnings: extraction.warnings || [],
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
    || path.join(__dirname, '..', 'knowledge', 'uploads', 'incoming');
}

function getUploadExtractedDir(options = {}) {
  return options.uploadExtractedDir
    || path.join(__dirname, '..', 'knowledge', 'uploads', 'extracted');
}

async function prepareReviewDraftFromUpload(uploadId, body = {}, options = {}) {
  const extractionJsonPath = getExtractionJsonPathForUpload(uploadId, options);
  if (!fs.existsSync(extractionJsonPath)) {
    return {
      success: false,
      statusCode: 404,
      errors: ['No extracted upload JSON was found for this uploadId. Extract text before preparing review.'],
      warnings: []
    };
  }

  const generation = await generateDraftKnowledgePack({
    extractionJsonPath,
    outputDraftDir: options.draftPacksDir,
    draftPacksDir: options.draftPacksDir,
    standardsBank: options.standardsBank,
    standardsBankPath: sanitizeStandardsBankPath(body.standardsBankPath, options),
    model: nonEmptyString(body.model) ? body.model.trim() : undefined,
    timeoutMs: positiveNumberOrUndefined(body.timeoutMs),
    keepAlive: nonEmptyString(body.keepAlive) ? body.keepAlive.trim() : undefined,
    retryInvalidJson: body.retryInvalidJson === true,
    packName: nonEmptyString(body.packName) ? body.packName.trim() : undefined,
    modelClient: options.modelClient || options.draftModelClient,
    rawModelResponsesDir: options.rawModelResponsesDir
  });

  if (!generation.success) {
    return {
      success: false,
      errors: generation.errors || ['Review draft preparation failed.'],
      warnings: generation.warnings || [],
      rawModelResponsePath: generation.rawModelResponsePath
    };
  }

  const draftReport = getDraftPackReport(generation.packId, options);
  return {
    success: true,
    data: {
      packId: generation.packId,
      message: 'Review draft prepared.',
      draftReport,
      dashboard: getTeacherContentDashboard(options),
      drafts: listDraftPacksForReview(options).draftPacks
    },
    errors: [],
    warnings: generation.warnings || []
  };
}

function getExtractionJsonPathForUpload(uploadId, options = {}) {
  const extractedDir = path.resolve(getUploadExtractedDir(options));
  const extractionJsonPath = path.resolve(extractedDir, `${uploadId}_extraction.json`);
  if (path.dirname(extractionJsonPath) !== extractedDir) {
    throw makeHttpError('uploadId resolved outside the extracted uploads directory.', 400);
  }
  return extractionJsonPath;
}

function sanitizeStandardsBankPath(standardsBankPath, options = {}) {
  if (!nonEmptyString(standardsBankPath)) return undefined;
  const resolved = path.resolve(standardsBankPath);
  const allowedRoot = path.resolve(options.standardsBanksDir || path.join(__dirname, '..', 'knowledge', 'standards-banks'));
  return isPathInside(resolved, allowedRoot) ? resolved : undefined;
}

function isPathInside(filePath, rootDir) {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath === '' || Boolean(relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function makeExtractionSummary(extraction) {
  return {
    success: extraction.success === true,
    fileName: extraction.fileName || '',
    extension: extraction.extension || '',
    mimeGuess: extraction.mimeGuess || '',
    detectedType: extraction.metadata?.detectedType || 'unsupported',
    characterCount: extraction.text.length,
    sectionsCount: extraction.sections.length,
    tablesCount: extraction.tables.length,
    warnings: extraction.warnings || [],
    errors: extraction.errors || []
  };
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
      if (filenameMatch && filenameMatch[1]) {
        files.push({
          originalFileName: filenameMatch[1],
          buffer: part.slice(headerEnd + 4),
          contentType: headers['content-type'] || 'application/octet-stream'
        });
      }
    }

    cursor = nextBoundary;
  }

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

function makeHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendJson(res, getData) {
  try {
    return res.json({
      success: true,
      data: getData()
    });
  } catch (error) {
    return sendRouteError(res, error);
  }
}

function sendRouteError(res, error) {
  return res.status(500).json({
    success: false,
    errors: [error instanceof Error ? error.message : String(error)]
  });
}

function isSafePackId(packId) {
  return SAFE_PACK_ID_PATTERN.test(packId);
}

function isSafeUploadId(uploadId) {
  return SAFE_UPLOAD_ID_PATTERN.test(uploadId);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveNumberOrUndefined(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function stripStatusCode(result) {
  const { statusCode, ...payload } = result;
  return payload;
}

function validateDraftItemRouteParams(params = {}) {
  const packId = String(params.packId || '').trim();
  if (!isSafePackId(packId)) {
    return {
      success: false,
      errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
    };
  }

  const section = String(params.section || '').trim();
  if (!REVIEWABLE_SECTIONS.includes(section)) {
    return {
      success: false,
      errors: [`section must be one of: ${REVIEWABLE_SECTIONS.join(', ')}`]
    };
  }

  const index = Number(params.index);
  if (!Number.isInteger(index) || index < 0 || String(params.index).trim() !== String(index)) {
    return {
      success: false,
      errors: [`index must be a non-negative integer for ${section}.`]
    };
  }

  return {
    success: true,
    packId,
    section,
    index,
    errors: []
  };
}

function sendDraftMutationResponse(res, update, packId, options) {
  if (!update.success) {
    const status = (update.errors || []).some((error) => String(error).includes('No draft knowledge pack found'))
      ? 404
      : 400;
    return res.status(status).json({
      success: false,
      errors: update.errors || ['Draft item update failed.'],
      warnings: update.warnings || []
    });
  }

  const report = getDraftPackReport(packId, options);
  return res.json({
    success: true,
    data: {
      update,
      report
    },
    errors: [],
    warnings: report.warnings || []
  });
}

module.exports = {
  createTeacherContentRoutes,
  getExtractionJsonPathForUpload,
  isSafePackId,
  isSafeUploadId,
  prepareReviewDraftFromUpload,
  registerTeacherContentRoutes,
  storeAndExtractUpload
};
