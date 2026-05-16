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
const {
  buildImportEstimate,
  generateDraftKnowledgePack
} = require('../lib/uploads/generateDraftKnowledgePack');
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

  app.post('/uploads/upload-and-prepare', async (req, res) => {
    try {
      const upload = await readSingleMultipartUpload(req, {
        maxBytes: Number(options.maxUploadBytes || DEFAULT_UPLOAD_LIMIT_BYTES)
      });
      const knowledgeName = getKnowledgeNameFromFields(upload.fields);
      if (!knowledgeName) {
        return res.status(400).json(makeRouteErrorPayload('Knowledge name is required.'));
      }

      const extractionResult = await storeAndExtractUpload(upload, options);
      if (!extractionResult.success) {
        return res.status(400).json({
          ok: false,
          error: firstError(extractionResult.errors, 'Extraction failed.'),
          details: joinMessages(extractionResult.errors),
          ...extractionResult,
          data: {
            upload: extractionResult.data || null,
            extraction: extractionResult.data || null
          }
        });
      }

      const uploadData = extractionResult.data || {};
      const extractionTimeline = buildExtractionTimeline(uploadData);
      const extractionJsonPath = getExtractionJsonPathForUpload(uploadData.uploadId, options);
      const extraction = readJsonFile(extractionJsonPath, 'extraction JSON').value || null;
      const importEstimate = buildImportEstimate(extraction, {
        ...options,
        maxBatchCharacters: positiveNumberOrUndefined(upload.fields && upload.fields.maxBatchCharacters) || options.maxBatchCharacters,
        retryMaxBatchCharacters: positiveNumberOrUndefined(upload.fields && upload.fields.retryMaxBatchCharacters) || options.retryMaxBatchCharacters
      });

      return res.json({
        success: true,
        data: {
          upload: uploadData,
          extraction: uploadData,
          importEstimate,
          requiresPreview: true,
          nextStep: 'run_preview',
          message: 'Upload extracted. Review the import estimate, then run preview before full import.',
          timeline: [
            ...extractionTimeline,
            makeTimelineEvent('import_estimate_ready', 'Import estimate ready', importEstimate)
          ]
        },
        errors: [],
        warnings: extractionResult.warnings || []
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json(makeRouteErrorPayload(error instanceof Error ? error.message : String(error)));
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
      pageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
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
  const extraction = readJsonFile(extractionJsonPath, 'extraction JSON').value || null;
  const generationOptions = {
    ...options,
    maxBatchCharacters: positiveNumberOrUndefined(body.maxBatchCharacters) || options.maxBatchCharacters,
    retryMaxBatchCharacters: positiveNumberOrUndefined(body.retryMaxBatchCharacters) || options.retryMaxBatchCharacters,
    previewMaxPages: positiveNumberOrUndefined(body.previewMaxPages) || options.previewMaxPages
  };
  const importEstimate = buildImportEstimate(extraction, generationOptions);
  const importMode = String(body.importMode || body.mode || '').trim().toLowerCase();
  const previewOnly = importMode === 'preview' || body.preview === true;
  const fullImportRequested = importMode === 'full' || body.fullImport === true;
  const selectedImportRequested = importMode === 'selected' || importMode === 'range' || body.selectedImport === true;
  const confirmedFullImport = body.confirmFullImportText === 'CONFIRM'
    || body.fullImportConfirmation === 'CONFIRM'
    || body.confirmationText === 'CONFIRM'
    || (body.confirmFullImport === true && !importEstimate.isLarge)
    || (body.confirmedFullImport === true && !importEstimate.isLarge);

  if (!previewOnly && !fullImportRequested && !selectedImportRequested) {
    return {
      success: false,
      statusCode: 409,
      errors: ['Run preview first, import a selected page range, or request a confirmed full import.'],
      warnings: [],
      importEstimate,
      timeline: [makeTimelineEvent('import_estimate_ready', 'Import estimate ready', importEstimate)]
    };
  }

  if (fullImportRequested && importEstimate.hardStop) {
    return {
      success: false,
      statusCode: 413,
      errors: [importEstimate.hardStopMessage || 'This upload is large. Run preview first or lower batch size.'],
      warnings: importEstimate.hardStopReasons || [],
      importEstimate,
      timeline: [makeTimelineEvent('import_estimate_ready', 'Import estimate ready', importEstimate)]
    };
  }

  if (fullImportRequested && importEstimate.fullImportRequiresConfirmation && importEstimate.isLarge && !confirmedFullImport) {
    return {
      success: false,
      statusCode: 409,
      errors: ['Whole-packet full import requires typing CONFIRM. For large packets, import one section at a time to avoid overloading local Gemma.'],
      warnings: importEstimate.largeReasons || [],
      importEstimate,
      timeline: [makeTimelineEvent('import_estimate_ready', 'Import estimate ready', importEstimate)]
    };
  }

  const importSelection = selectedImportRequested ? makeRouteImportSelection(body) : null;
  const selectionLabel = selectedImportRequested ? makeRouteImportSelectionLabel(importSelection) : '';
  const packName = nonEmptyString(body.packName) ? body.packName.trim() : undefined;

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
    packName: selectedImportRequested && packName ? `${packName} ${selectionLabel}` : packName,
    modelClient: options.modelClient || options.draftModelClient,
    rawModelResponsesDir: options.rawModelResponsesDir,
    maxBatchCharacters: generationOptions.maxBatchCharacters,
    retryMaxBatchCharacters: generationOptions.retryMaxBatchCharacters,
    previewMaxPages: generationOptions.previewMaxPages,
    previewOnly,
    importMode: selectedImportRequested ? 'selected' : importMode,
    importSelection
  });

  if (!generation.success) {
    const teacherFriendlyError = firstError(generation.errors, 'Review draft preparation failed.');
    const technicalErrors = (generation.errors || []).slice(1);
    return {
      success: false,
      errors: generation.errors || ['Review draft preparation failed.'],
      teacherFriendlyError,
      technicalErrors,
      warnings: generation.warnings || [],
      importEstimate,
      selectedImportEstimate: generation.selectedImportEstimate,
      importSelection: generation.importSelection || importSelection,
      rawModelResponsePath: generation.rawModelResponsePath,
      timeline: generation.timeline || [],
      coverageReport: generation.coverageReport,
      failedBatches: generation.failedBatches || []
    };
  }

  if (previewOnly) {
    return {
      success: true,
      data: {
        preview: true,
        message: 'Preview draft prepared. Review the sample before running full import.',
        importEstimate,
        importSelection: generation.importSelection,
        selectedImportEstimate: generation.selectedImportEstimate,
        previewReport: makePreviewReportSummary(generation.previewReport),
        timeline: generation.timeline || [],
        coverageReport: generation.coverageReport
      },
      errors: [],
      warnings: generation.warnings || []
    };
  }

  const draftReport = getDraftPackReport(generation.packId, {
    ...options,
    extraction
  });
  const sourceMatch = draftReport.sourceMatch || makePrepareReviewSourceMatch(extraction, draftReport.draftPack);
  return {
    success: true,
    data: {
      packId: generation.packId,
      title: generation.title || draftReport.draftPack?.title || generation.packId,
      message: 'Review draft prepared.',
      sourceMatch,
      draftReport,
      importEstimate,
      selectedImport: selectedImportRequested,
      importSelection: generation.importSelection,
      selectedImportEstimate: generation.selectedImportEstimate,
      timeline: generation.timeline || [],
      dashboard: getTeacherContentDashboard(options),
      drafts: listDraftPacksForReview(options).draftPacks
    },
    errors: [],
    warnings: generation.warnings || []
  };
}

function buildExtractionTimeline(uploadData = {}) {
  const fileName = firstNonEmptyString(uploadData.originalFileName, uploadData.extraction && uploadData.extraction.fileName);
  return [
    {
      type: 'upload_received',
      message: 'Upload received',
      at: new Date().toISOString(),
      details: {
        fileName,
        uploadId: uploadData.uploadId || ''
      }
    },
    {
      type: 'extraction_complete',
      message: 'Extraction complete',
      at: new Date().toISOString(),
      details: {
        characterCount: Number(uploadData.characterCount || 0),
        pageCount: Number(uploadData.extraction && uploadData.extraction.pageCount || 0),
        chunkCount: Number(uploadData.sectionsCount || 0)
      }
    }
  ];
}

function makeTimelineEvent(type, message, details = {}) {
  return {
    type,
    message,
    at: new Date().toISOString(),
    details
  };
}

function makePreviewReportSummary(previewReport = {}) {
  const pack = previewReport.pack || {};
  return {
    title: pack.title || '',
    sourceFiles: Array.isArray(pack.sourceFiles) ? pack.sourceFiles.map((source) => source.fileName).filter(Boolean) : [],
    processedPageCount: Number(previewReport.processedPageCount || 0),
    processedCharacterCount: Number(previewReport.processedCharacterCount || 0),
    processedChunkCount: Number(previewReport.processedChunkCount || 0),
    itemCounts: {
      vocabulary: Array.isArray(pack.vocabulary) ? pack.vocabulary.length : 0,
      concepts: Array.isArray(pack.concepts) ? pack.concepts.length : 0,
      referenceFormulas: Array.isArray(pack.referenceFormulas) ? pack.referenceFormulas.length : 0,
      problemBank: Array.isArray(pack.problemBank) ? pack.problemBank.length : 0,
      standardsMap: Array.isArray(pack.standardsMap) ? pack.standardsMap.length : 0,
      smokeTests: Array.isArray(pack.smokeTests) ? pack.smokeTests.length : 0
    },
    coverageReport: previewReport.coverageReport
  };
}

function makeRouteImportSelection(body = {}) {
  const selection = body.importSelection && typeof body.importSelection === 'object' ? body.importSelection : {};
  const pageRange = firstNonEmptyString(body.pageRange, selection.pageRange, selection.pages);
  const rangeMatch = String(pageRange || '').match(/(\d+)\s*(?:-|–|to)\s*(\d+)/i)
    || String(pageRange || '').match(/^\s*(\d+)\s*$/);
  return {
    pageStart: positiveNumberOrUndefined(body.pageStart)
      || positiveNumberOrUndefined(body.importPageStart)
      || positiveNumberOrUndefined(selection.pageStart)
      || positiveNumberOrUndefined(selection.startPage)
      || positiveNumberOrUndefined(rangeMatch && rangeMatch[1]),
    pageEnd: positiveNumberOrUndefined(body.pageEnd)
      || positiveNumberOrUndefined(body.importPageEnd)
      || positiveNumberOrUndefined(selection.pageEnd)
      || positiveNumberOrUndefined(selection.endPage)
      || positiveNumberOrUndefined(rangeMatch && (rangeMatch[2] || rangeMatch[1])),
    chunkStart: positiveNumberOrUndefined(body.chunkStart)
      || positiveNumberOrUndefined(body.importChunkStart)
      || positiveNumberOrUndefined(selection.chunkStart)
      || positiveNumberOrUndefined(selection.startChunk),
    chunkEnd: positiveNumberOrUndefined(body.chunkEnd)
      || positiveNumberOrUndefined(body.importChunkEnd)
      || positiveNumberOrUndefined(selection.chunkEnd)
      || positiveNumberOrUndefined(selection.endChunk)
  };
}

function makeRouteImportSelectionLabel(selection = {}) {
  if (selection.pageStart) {
    const end = selection.pageEnd || selection.pageStart;
    return `Pages ${selection.pageStart}-${end}`;
  }
  if (selection.chunkStart) {
    const end = selection.chunkEnd || selection.chunkStart;
    return `Chunks ${selection.chunkStart}-${end}`;
  }
  return 'Selected Range';
}

function makePrepareReviewSourceMatch(extraction, draftPack) {
  const originalFileName = firstNonEmptyString(extraction && extraction.upload && extraction.upload.originalFileName, extraction && extraction.fileName);
  const sourceFiles = [];
  return {
    uploadedFileName: originalFileName,
    draftPackId: draftPack && draftPack.packId || '',
    draftTitle: draftPack && draftPack.title || '',
    draftSourceFiles: sourceFiles,
    extractionCharacterCount: extraction ? String(extraction.text || '').length : 0,
    pageCount: extraction && extraction.metadata ? Number(extraction.metadata.pageCount || 0) : 0,
    chunkCount: extraction && Array.isArray(extraction.sections) ? extraction.sections.length : 0,
    status: 'unknown',
    warning: ''
  };
}

function combineImportTimelines(...timelines) {
  const entries = timelines.flatMap((timeline) => Array.isArray(timeline) ? timeline : []);
  const merged = [];
  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const key = `${entry.type || 'activity'}:${entry.message || ''}`;
    const existingIndex = merged.findIndex((candidate) => `${candidate.type || 'activity'}:${candidate.message || ''}` === key);
    if (existingIndex < 0) {
      merged.push(entry);
      return;
    }
    merged[existingIndex] = preferTimelineEntry(merged[existingIndex], entry);
  });
  return merged;
}

function preferTimelineEntry(left, right) {
  return timelineDetailScore(right && right.details) >= timelineDetailScore(left && left.details) ? right : left;
}

function timelineDetailScore(details) {
  if (!details || typeof details !== 'object') return 0;
  return Number(details.pageCount || 0)
    + Number(details.chunkCount || 0)
    + (Number(details.characterCount || 0) / 100000);
}

function readJsonFile(filePath, label) {
  try {
    return {
      success: true,
      value: JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8')),
      errors: []
    };
  } catch (error) {
    return {
      success: false,
      value: null,
      errors: [`Could not read or parse ${label}: ${error.message}`]
    };
  }
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
    pageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
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

function makeHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function makeRouteErrorPayload(message, details) {
  const error = firstNonEmptyString(message, 'Teacher content request failed.');
  return {
    ok: false,
    success: false,
    error,
    details: firstNonEmptyString(details, error),
    errors: [error],
    warnings: []
  };
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

function firstNonEmptyString(...values) {
  return values.find(nonEmptyString) || '';
}

function getKnowledgeNameFromFields(fields = {}) {
  return firstNonEmptyString(
    fields.knowledgeName,
    fields.packName,
    fields.packTitle,
    fields.title,
    fields.name
  ).trim();
}

function firstError(errors, fallback) {
  return Array.isArray(errors) && errors.length > 0 ? String(errors[0]) : fallback;
}

function joinMessages(messages) {
  return Array.isArray(messages) ? messages.map(String).filter(Boolean).join('; ') : '';
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
