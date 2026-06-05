const fs = require('node:fs');
const path = require('node:path');

const {
  getDraftPackReport,
  getTeacherContentDashboard,
  listDraftPacksForReview
} = require('./teacherContentAdapter');
const {
  buildImportEstimate,
  generateDraftKnowledgePack,
  identifyTextBearingPages,
  isModelCrashMessage,
  isModelTimeoutMessage,
  isModelUnavailableMessage
} = require('./generateDraftKnowledgePack');
const { planTeacherContentImport } = require('./planTeacherContentImport');
const {
  getExtractionJsonPathForUpload,
  makeExtractionSummary
} = require('./uploadStorage');
const {
  firstError,
  firstNonEmptyString,
  getKnowledgeNameFromFields,
  joinMessages,
  nonEmptyString,
  positiveNumberOrUndefined,
  readJsonFile
} = require('../server/routeResponse');

const IMPORT_PROFILE_VALUES = new Set([
  'general',
  'physical_science',
  'biology',
  'chemistry',
  'earth_space_science',
  'math',
  'english_reading',
  'history_social_studies',
  'art',
  'computer_science',
  'robotics',
  'procedures_class_info'
]);
const DEFAULT_PREVIEW_SELECTED_GENERATION_TIMEOUT_MS = 120000;
const DEFAULT_FULL_GENERATION_TIMEOUT_MS = 300000;
const AUTO_ANALYZE_MAX_BATCH_CHARACTERS = 400;
const AUTO_ANALYZE_RETRY_MAX_BATCH_CHARACTERS = 200;
const AUTO_ANALYZE_TIMEOUT_MS = 120000;

async function prepareReviewDraftFromUpload(uploadId, body = {}, options = {}) {
  if (nonEmptyString(options.rawModelResponsesDir)) {
    fs.mkdirSync(path.resolve(options.rawModelResponsesDir), { recursive: true });
  }
  const extractionJsonPath = getExtractionJsonPathForUpload(uploadId, options);
  if (!fs.existsSync(extractionJsonPath)) {
    return makePrepareReviewFailurePayload({
      success: false,
      statusCode: 404,
      errors: ['No extracted upload JSON was found for this uploadId. Extract text before preparing review.'],
      warnings: []
    }, { uploadId, body });
  }
  const extraction = readJsonFile(extractionJsonPath, 'extraction JSON').value || null;
  const generationOptions = {
    ...options,
    maxBatchCharacters: positiveNumberOrUndefined(body.maxBatchCharacters) || options.maxBatchCharacters,
    retryMaxBatchCharacters: positiveNumberOrUndefined(body.retryMaxBatchCharacters) || options.retryMaxBatchCharacters,
    maxBatchChunks: positiveNumberOrUndefined(body.maxBatchChunks) || options.maxBatchChunks,
    previewMaxPages: positiveNumberOrUndefined(body.previewMaxPages) || options.previewMaxPages,
    previewMaxCharacters: positiveNumberOrUndefined(body.previewMaxCharacters) || positiveNumberOrUndefined(body.maxPreviewChars) || options.previewMaxCharacters,
    previewMode: nonEmptyString(body.previewMode) ? body.previewMode.trim() : nonEmptyString(body.previewSize) ? body.previewSize.trim() : options.previewMode
  };
  const autoRecommendationAccepted = body.useAutoImportPlan === true || body.useRecommendedImportPlan === true;
  const effectiveGenerationOptions = autoRecommendationAccepted
    ? makeAutoAnalyzeGenerationOptions(generationOptions)
    : generationOptions;
  const importEstimate = buildImportEstimate(extraction, effectiveGenerationOptions);
  const autoImportPlan = extraction && extraction.importPlan
    ? extraction.importPlan
    : planTeacherContentImport({
      extraction,
      settings: effectiveGenerationOptions,
      memory: options.systemMemory
    });
  let importMode = String(body.importMode || body.mode || '').trim().toLowerCase();
  if (!importMode && autoRecommendationAccepted) {
    importMode = resolveAutoImportMode(autoImportPlan);
  }
  const previewOnly = importMode === 'preview' || body.preview === true;
  const fullImportRequested = importMode === 'full' || body.fullImport === true;
  const selectedImportRequested = importMode === 'selected' || importMode === 'range' || body.selectedImport === true;
  const confirmedFullImport = body.confirmFullImportText === 'CONFIRM'
    || body.fullImportConfirmation === 'CONFIRM'
    || body.confirmationText === 'CONFIRM'
    || (body.confirmFullImport === true && !importEstimate.isLarge)
    || (body.confirmedFullImport === true && !importEstimate.isLarge);

  if (!previewOnly && !fullImportRequested && !selectedImportRequested) {
    return makePrepareReviewFailurePayload({
      success: false,
      statusCode: 409,
      errors: ['Select Analyze Upload or choose a specific import action before preparing the review draft.'],
      warnings: [],
      importEstimate,
      autoImportPlan,
      timeline: [makeTimelineEvent('import_estimate_ready', 'Import estimate ready', importEstimate)]
    }, { uploadId, body, extraction, importSelection: null, importEstimate });
  }

  if (fullImportRequested && importEstimate.fullImportRequiresConfirmation && importEstimate.isLarge && !confirmedFullImport && !autoRecommendationAccepted) {
    return makePrepareReviewFailurePayload({
      success: false,
      statusCode: 409,
      errors: ['Whole-packet full import requires typing CONFIRM. For large packets, import one section at a time to avoid overloading local Gemma.'],
      warnings: importEstimate.largeReasons || [],
      importEstimate,
      autoImportPlan,
      timeline: [makeTimelineEvent('import_estimate_ready', 'Import estimate ready', importEstimate)]
    }, { uploadId, body, extraction, importSelection: null, importEstimate });
  }

  const routeImportSelection = makeRouteImportSelection(body);
  const autoImportSelection = autoRecommendationAccepted ? makeAutoImportSelection(autoImportPlan, importEstimate) : null;
  const importSelection = (selectedImportRequested || previewOnly)
    ? (hasUsableImportSelection(routeImportSelection) ? routeImportSelection : autoImportSelection)
    : null;
  if (previewOnly && !hasUsableImportSelection(importSelection)) {
    return makePrepareReviewFailurePayload({
      success: false,
      statusCode: 400,
      errors: ['Preview prepare requires selected pages or chunks. Send importSelection.pageStart/pageEnd or importSelection.chunkStart/chunkEnd.'],
      warnings: [],
      importEstimate,
      autoImportPlan,
      timeline: [makeTimelineEvent('full_import_estimate_ready', 'Full upload estimate ready', importEstimate)]
    }, { uploadId, body, extraction, importSelection, importEstimate });
  }
  if (selectedImportRequested && !hasUsableImportSelection(importSelection)) {
    return makePrepareReviewFailurePayload({
      success: false,
      statusCode: 400,
      errors: ['Selected import requires selected pages or chunks. Send importSelection.pageStart/pageEnd or importSelection.chunkStart/chunkEnd.'],
      warnings: [],
      importEstimate,
      autoImportPlan,
      timeline: [makeTimelineEvent('full_import_estimate_ready', 'Full upload estimate ready', importEstimate)]
    }, { uploadId, body, extraction, importSelection, importEstimate });
  }
  const selectionLabel = selectedImportRequested ? makeRouteImportSelectionLabel(importSelection) : '';
  const packName = getKnowledgeNameFromFields(body) || (nonEmptyString(body.packName) ? body.packName.trim() : undefined);
  const importIntent = nonEmptyString(body.importIntent)
    ? body.importIntent.trim()
    : nonEmptyString(body.selectedImportPreset)
      ? body.selectedImportPreset.trim()
      : '';
  const scopedPackName = makeScopedRoutePackName(packName, {
    previewOnly,
    selectedImportRequested,
    importIntent,
    selectionLabel,
    importEstimate
  });

  const generation = await generateDraftKnowledgePack({
    extractionJsonPath,
    outputDraftDir: options.draftPacksDir,
    draftPacksDir: options.draftPacksDir,
    standardsBank: options.standardsBank,
    standardsBankPath: sanitizeStandardsBankPath(body.standardsBankPath, options),
    model: nonEmptyString(body.model) ? body.model.trim() : undefined,
    timeoutMs: resolvePrepareReviewGenerationTimeoutMs({
      body,
      options,
      previewOnly,
      selectedImportRequested,
      fullImportRequested,
      autoRecommendationAccepted
    }),
    keepAlive: nonEmptyString(body.keepAlive) ? body.keepAlive.trim() : undefined,
    retryInvalidJson: body.retryInvalidJson === true,
    packName: scopedPackName,
    modelClient: options.modelClient || options.draftModelClient,
    rawModelResponsesDir: options.rawModelResponsesDir,
    maxBatchCharacters: effectiveGenerationOptions.maxBatchCharacters,
    retryMaxBatchCharacters: effectiveGenerationOptions.retryMaxBatchCharacters,
    previewMaxPages: generationOptions.previewMaxPages,
    previewMaxCharacters: generationOptions.previewMaxCharacters,
    previewMode: generationOptions.previewMode,
    maxBatchChunks: autoRecommendationAccepted || (previewOnly && String(generationOptions.previewMode || '').toLowerCase().includes('ultra')) ? 1 : effectiveGenerationOptions.maxBatchChunks,
    previewOnly,
    importMode: selectedImportRequested ? 'selected' : importMode,
    importProfile: normalizeImportProfile(body.importProfile),
    importIntent,
    importSelection,
    autoImportPlan,
    adaptiveImportLoop: autoRecommendationAccepted === true && !previewOnly && !selectedImportRequested
  });

  if (!generation.success) {
    const friendlyFailure = isTeacherContentAnalysisGenerationFailure(generation)
      ? makeTeacherContentAnalysisFailure(generation)
      : makeDefaultPrepareReviewFailure(generation, { previewOnly });
    return makePrepareReviewFailurePayload({
      success: false,
      errors: friendlyFailure.errors,
      teacherFriendlyError: friendlyFailure.teacherFriendlyError,
      technicalErrors: friendlyFailure.technicalErrors,
      warnings: generation.warnings || [],
      validationErrors: generation.validationErrors || [],
      invalidItems: generation.invalidItems || [],
      repairNeeded: generation.repairNeeded || generation.invalidItems || [],
      autoImportPlan,
      importEstimate,
      selectedImportEstimate: generation.selectedImportEstimate,
      importSelection: generation.importSelection || importSelection,
      rawModelResponsePath: generation.rawModelResponsePath,
      timeline: generation.timeline || [],
      coverageReport: generation.coverageReport,
      failedBatches: generation.failedBatches || [],
      modelTimeout: generation.modelTimeout === true,
      modelCrash: generation.modelCrash === true,
      modelUnavailable: generation.modelUnavailable === true
    }, { uploadId, body, extraction, importSelection, importEstimate });
  }

  if (previewOnly) {
    return {
      success: true,
      data: {
        preview: true,
        partialPreview: generation.partialPreview === true,
        validationPassed: generation.validationPassed === true,
        message: generation.previewReport && generation.previewReport.message
          ? generation.previewReport.message
          : generation.partialPreview
            ? 'Partial preview created. Some pages/chunks failed.'
            : 'Preview draft prepared. Review the sample before running full import.',
        importEstimate,
        autoImportPlan,
        importSelection: generation.importSelection,
        importScope: generation.importScope,
        selectedImportEstimate: generation.selectedImportEstimate,
        inputSnapshot: generation.inputSnapshot,
        previewReport: makePreviewReportSummary(generation.previewReport),
        timeline: generation.timeline || [],
        coverageReport: generation.coverageReport,
        coverageSummary: generation.coverageReport && generation.coverageReport.coverageSummary,
        failedBatches: generation.failedBatches || [],
        invalidItems: generation.invalidItems || [],
        repairNeeded: generation.repairNeeded || [],
        validationErrors: generation.validationErrors || generation.errors || [],
        errors: generation.errors || []
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
      message: generation.partialDraft === true
        ? 'Some slides could not be analyzed. Review the extracted items below, then retry the failed slides later if needed.'
        : 'Review draft prepared.',
      partialDraft: generation.partialDraft === true,
      failedBatches: generation.failedBatches || [],
      sourceMatch,
      draftReport,
      importEstimate,
      autoImportPlan,
      selectedImport: selectedImportRequested,
      importSelection: generation.importSelection,
      importScope: generation.importScope,
      selectedImportEstimate: generation.selectedImportEstimate,
      coverageReport: generation.coverageReport || draftReport.coverageReport || null,
      coverageSummary: generation.coverageReport && generation.coverageReport.coverageSummary
        || draftReport.coverageReport && draftReport.coverageReport.coverageSummary
        || null,
      sourceManifest: generation.coverageReport && Array.isArray(generation.coverageReport.sourceManifest)
        ? generation.coverageReport.sourceManifest
        : draftReport.coverageReport && Array.isArray(draftReport.coverageReport.sourceManifest)
          ? draftReport.coverageReport.sourceManifest
          : [],
      reviewState: generation.coverageReport && generation.coverageReport.allChunksTerminal === true
        ? (generation.partialDraft === true ? 'partial' : 'completed')
        : 'partial',
      timeline: generation.timeline || [],
      dashboard: getTeacherContentDashboard(options),
      drafts: listDraftPacksForReview(options).draftPacks
    },
    errors: [],
    warnings: generation.warnings || []
  };
}

function normalizeImportProfile(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (IMPORT_PROFILE_VALUES.has(raw)) return raw;
  return 'general';
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
    pack,
    partialPreview: previewReport.partialPreview === true,
    partialPreviewReason: previewReport.partialPreviewReason || '',
    validationPassed: previewReport.validationPassed === true,
    message: previewReport.message || '',
    model: previewReport.model || '',
    previewMode: previewReport.previewMode || '',
    maxPreviewChars: Number(previewReport.maxPreviewChars || 0),
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
    deduplication: previewReport.deduplication || pack.metadata && pack.metadata.deduplication || {},
    importNormalization: previewReport.importNormalization || pack.metadata && pack.metadata.importNormalization || {},
    inputSnapshot: previewReport.inputSnapshot || null,
    importScope: previewReport.importScope || pack.metadata && pack.metadata.importScope || null,
    coverageReport: previewReport.coverageReport,
    coverageSummary: previewReport.coverageReport && previewReport.coverageReport.coverageSummary,
    failedBatches: previewReport.failedBatches || [],
    invalidItems: previewReport.invalidItems || [],
    repairNeeded: previewReport.repairNeeded || [],
    validationErrors: previewReport.validationErrors || previewReport.errors || [],
    rawModelResponsePath: previewReport.rawModelResponsePath || '',
    warnings: previewReport.warnings || [],
    errors: previewReport.errors || []
  };
}

function makeRouteImportSelection(body = {}) {
  const selection = body.importSelection && typeof body.importSelection === 'object' ? body.importSelection : {};
  const selectedPages = Array.isArray(body.selectedPages) ? body.selectedPages : Array.isArray(selection.selectedPages) ? selection.selectedPages : [];
  const selectedChunks = Array.isArray(body.selectedChunks) ? body.selectedChunks : Array.isArray(selection.selectedChunks) ? selection.selectedChunks : [];
  const pageRange = firstNonEmptyString(body.pageRange, selection.pageRange, selection.pages);
  const rangeMatch = String(pageRange || '').match(/(\d+)\s*(?:-|–|to)\s*(\d+)/i)
    || String(pageRange || '').match(/^\s*(\d+)\s*$/);
  return {
    pageStart: positiveNumberOrUndefined(body.pageStart)
      || positiveNumberOrUndefined(body.importPageStart)
      || positiveNumberOrUndefined(selection.pageStart)
      || positiveNumberOrUndefined(selection.startPage)
      || positiveNumberOrUndefined(selectedPages[0])
      || positiveNumberOrUndefined(rangeMatch && rangeMatch[1]),
    pageEnd: positiveNumberOrUndefined(body.pageEnd)
      || positiveNumberOrUndefined(body.importPageEnd)
      || positiveNumberOrUndefined(selection.pageEnd)
      || positiveNumberOrUndefined(selection.endPage)
      || positiveNumberOrUndefined(selectedPages[selectedPages.length - 1])
      || positiveNumberOrUndefined(rangeMatch && (rangeMatch[2] || rangeMatch[1])),
    chunkStart: positiveNumberOrUndefined(body.chunkStart)
      || positiveNumberOrUndefined(body.importChunkStart)
      || positiveNumberOrUndefined(selection.chunkStart)
      || positiveNumberOrUndefined(selection.startChunk)
      || positiveNumberOrUndefined(selectedChunks[0]),
    chunkEnd: positiveNumberOrUndefined(body.chunkEnd)
      || positiveNumberOrUndefined(body.importChunkEnd)
      || positiveNumberOrUndefined(selection.chunkEnd)
      || positiveNumberOrUndefined(selection.endChunk)
      || positiveNumberOrUndefined(selectedChunks[selectedChunks.length - 1])
  };
}

function hasUsableImportSelection(selection = {}) {
  if (!selection || typeof selection !== 'object') return false;
  return Boolean(
    positiveNumberOrUndefined(selection.pageStart)
    || positiveNumberOrUndefined(selection.pageEnd)
    || positiveNumberOrUndefined(selection.chunkStart)
    || positiveNumberOrUndefined(selection.chunkEnd)
  );
}

function resolveAutoImportMode(autoImportPlan = {}) {
  if (autoImportPlan.mode === 'manual_review_needed') return '';
  return 'full';
}

function makeAutoImportSelection(autoImportPlan = {}, importEstimate = {}) {
  const firstBatch = Array.isArray(autoImportPlan.batches) ? autoImportPlan.batches[0] : null;
  const pageNumbers = Array.isArray(firstBatch && firstBatch.pageNumbers)
    ? firstBatch.pageNumbers.map(Number).filter((page) => Number.isFinite(page) && page > 0)
    : [];
  if (pageNumbers.length) {
    return {
      pageStart: Math.min(...pageNumbers),
      pageEnd: Math.max(...pageNumbers)
    };
  }
  const textPages = Array.isArray(importEstimate.textBearingPages)
    ? importEstimate.textBearingPages
    : Array.isArray(importEstimate.pagesWithText)
      ? importEstimate.pagesWithText
      : [];
  const firstTextPage = positiveNumberOrUndefined(importEstimate.firstTextPage)
    || positiveNumberOrUndefined(textPages[0]);
  if (firstTextPage) {
    return {
      pageStart: firstTextPage,
      pageEnd: firstTextPage
    };
  }
  return null;
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

function makeScopedRoutePackName(packName, details = {}) {
  if (nonEmptyString(packName)) return packName.trim();
  const baseName = 'Teacher Upload';
  const importIntent = String(details.importIntent || '').trim().toLowerCase();
  const scopeLabel = details.previewOnly || importIntent === 'preview_range' || importIntent === 'preview'
    ? 'Preview Sample'
    : details.selectedImportRequested
      ? 'Selected Range'
      : 'Full Import';
  const rangeLabel = details.selectedImportRequested || details.previewOnly
    ? details.selectionLabel
    : makeTextBearingRangeLabel(details.importEstimate);
  const suffix = rangeLabel ? ` ${rangeLabel}` : '';
  return `${scopeLabel}: ${baseName}${suffix}`;
}

function makeTextBearingRangeLabel(importEstimate = {}) {
  const pages = Array.isArray(importEstimate.textBearingPages)
    ? importEstimate.textBearingPages
    : Array.isArray(importEstimate.pagesWithText)
      ? importEstimate.pagesWithText
      : [];
  const range = pages.length === 1 ? `${Number(pages[0])}-${Number(pages[0])}` : formatNumberRange(pages);
  if (range) return `Pages ${range}`;
  if (importEstimate.pageCount) return `Pages 1-${importEstimate.pageCount}`;
  return '';
}

function formatNumberRange(values) {
  const unique = Array.from(new Set((Array.isArray(values) ? values : []).map(Number).filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
  if (!unique.length) return '';
  if (unique.length === 1) return String(unique[0]);
  const ranges = [];
  let start = unique[0];
  let previous = unique[0];
  for (let index = 1; index < unique.length; index += 1) {
    const value = unique[index];
    if (value === previous + 1) {
      previous = value;
      continue;
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    start = value;
    previous = value;
  }
  ranges.push(start === previous ? String(start) : `${start}-${previous}`);
  return ranges.join(', ');
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

function makePrepareReviewFailurePayload(result = {}, context = {}) {
  const errors = Array.isArray(result.errors) && result.errors.length ? result.errors : ['Review draft preparation failed.'];
  const extraction = context.extraction || null;
  const importSelection = context.importSelection || makeRouteImportSelection(context.body || {});
  const extractionCounts = makePrepareReviewExtractionCounts(extraction);
  const fileName = firstNonEmptyString(
    extraction && extraction.upload && extraction.upload.originalFileName,
    extraction && extraction.fileName,
    result.fileName
  );
  const sourceType = firstNonEmptyString(
    extraction && extraction.metadata && extraction.metadata.detectedType,
    extraction && extraction.extension,
    extraction && extraction.mimeGuess,
    result.sourceType
  );
  const teacherFriendlyError = firstNonEmptyString(result.teacherFriendlyError, firstError(errors, 'Review draft preparation failed.'));
  return {
    ...result,
    success: false,
    ok: false,
    error: teacherFriendlyError,
    message: teacherFriendlyError,
    details: joinMessages(errors),
    teacherFriendlyError,
    errors,
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    uploadId: context.uploadId || '',
    fileName,
    originalFileName: fileName,
    sourceType,
    upload: extraction && extraction.upload ? extraction.upload : null,
    importSelection,
    selectedRange: makeRouteImportSelectionLabel(importSelection),
    extractionCounts,
    extractionMetadata: extraction && extraction.metadata ? extraction.metadata : null,
    extractionSummary: {
      uploadId: context.uploadId || '',
      fileName,
      originalFileName: fileName,
      sourceType,
      metadata: extraction && extraction.metadata ? extraction.metadata : null,
      ...extractionCounts
    },
    extraction: extraction ? makeExtractionSummary(extraction) : null,
    importEstimate: result.importEstimate || context.importEstimate,
    autoImportPlan: result.autoImportPlan || context.autoImportPlan,
    validationErrors: result.validationErrors || [],
    invalidItems: result.invalidItems || [],
    repairNeeded: result.repairNeeded || [],
    failedBatches: result.failedBatches || [],
    coverageReport: result.coverageReport || null,
    sourceManifest: result.coverageReport && Array.isArray(result.coverageReport.sourceManifest)
      ? result.coverageReport.sourceManifest
      : [],
    reviewState: result.coverageReport && result.coverageReport.allChunksTerminal === true ? 'partial' : 'incomplete',
    coverageSummary: result.coverageReport && result.coverageReport.coverageSummary,
    rawModelResponsePath: result.rawModelResponsePath || ''
  };
}

function makePrepareReviewExtractionCounts(extraction) {
  if (!extraction) {
    return {
      characterCount: 0,
      pageCount: 0,
      chunkCount: 0,
      firstTextPage: null,
      textBearingPages: [],
      pagesWithText: []
    };
  }
  const textBearingPageInfo = identifyTextBearingPages(extraction);
  return {
    characterCount: Number(
      extraction.characterCount
      || extraction.metadata && extraction.metadata.characterCount
      || String(extraction.text || '').length
      || 0
    ),
    pageCount: Number(
      extraction.pageCount
      || extraction.metadata && extraction.metadata.pageCount
      || (Array.isArray(extraction.pages) ? extraction.pages.length : 0)
      || 0
    ),
    chunkCount: Number(
      extraction.chunkCount
      || extraction.sectionsCount
      || (Array.isArray(extraction.sections) ? extraction.sections.length : 0)
      || 0
    ),
    firstTextPage: textBearingPageInfo.firstTextPage,
    textBearingPages: textBearingPageInfo.pages,
    pagesWithText: textBearingPageInfo.pages
  };
}

function isNoUsablePreviewFailure(generation = {}) {
  if (Array.isArray(generation.errors) && generation.errors.some((error) => String(error || '').toLowerCase().includes('no usable preview items'))) {
    return true;
  }
  if (Array.isArray(generation.invalidItems) && generation.invalidItems.length > 0 && !generation.packId) {
    return true;
  }
  return Array.isArray(generation.errors)
    && generation.errors.length > 0
    && generation.errors.every((error) => /\[[0-9]+\]\./.test(String(error || '')));
}

function isModelCrashGenerationFailure(generation = {}) {
  return generation.modelCrash === true
    || (Array.isArray(generation.errors) && generation.errors.some((error) => isModelCrashMessage(error)))
    || (Array.isArray(generation.failedBatches) && generation.failedBatches.some((batch) => (
      Array.isArray(batch.errors) && batch.errors.some((error) => isModelCrashMessage(error))
    )));
}

function isModelUnavailableGenerationFailure(generation = {}) {
  return generation.modelUnavailable === true
    || (Array.isArray(generation.errors) && generation.errors.some((error) => isModelUnavailableMessage(error)))
    || (Array.isArray(generation.failedBatches) && generation.failedBatches.some((batch) => (
      Array.isArray(batch.errors) && batch.errors.some((error) => isModelUnavailableMessage(error))
    )));
}

function isModelTimeoutGenerationFailure(generation = {}) {
  return generation.modelTimeout === true
    || (Array.isArray(generation.errors) && generation.errors.some((error) => isModelTimeoutMessage(error)))
    || (Array.isArray(generation.failedBatches) && generation.failedBatches.some((batch) => (
      Array.isArray(batch.errors) && batch.errors.some((error) => isModelTimeoutMessage(error))
    )));
}

function isInvalidModelJsonGenerationFailure(generation = {}) {
  const details = [
    ...(Array.isArray(generation.errors) ? generation.errors : []),
    ...(Array.isArray(generation.failedBatches) ? generation.failedBatches.flatMap((batch) => (
      Array.isArray(batch && batch.errors) ? batch.errors : []
    )) : [])
  ].join(' ').toLowerCase();
  return details.includes('model response was not valid json')
    || details.includes('model response was empty and not valid json')
    || details.includes('response did not contain a complete json object');
}

function isTeacherContentAnalysisGenerationFailure(generation = {}) {
  return isModelUnavailableGenerationFailure(generation)
    || isModelTimeoutGenerationFailure(generation)
    || isModelCrashGenerationFailure(generation)
    || isInvalidModelJsonGenerationFailure(generation);
}

function makeTeacherContentAnalysisFailure(generation = {}) {
  const technicalErrors = uniqueMessages([
    ...(Array.isArray(generation.errors) ? generation.errors : []),
    ...(Array.isArray(generation.failedBatches) ? generation.failedBatches.flatMap((batch) => (
      Array.isArray(batch && batch.errors) ? batch.errors : []
    )) : [])
  ]);
  const teacherFriendlyError = 'Charlemagne had trouble analyzing this file.';
  const guidance = [
    'The file was uploaded, but review items could not be created yet.',
    'Try a smaller file, fewer pages, or text-only notes.',
    'You can retry analysis or remove this file from the queue.'
  ];
  if (isModelUnavailableGenerationFailure(generation)) {
    guidance.splice(1, 0, 'Check that Ollama is running, then retry analysis.');
  } else if (isModelTimeoutGenerationFailure(generation)) {
    guidance.splice(1, 0, 'The local model took too long on this file.');
  } else if (isModelCrashGenerationFailure(generation)) {
    guidance.splice(1, 0, 'The local model stopped while reading part of this file.');
  } else if (isInvalidModelJsonGenerationFailure(generation)) {
    guidance.splice(1, 0, 'The local model returned an answer Charlemagne could not turn into review items.');
  }
  return {
    teacherFriendlyError,
    errors: uniqueMessages([teacherFriendlyError, ...guidance]),
    technicalErrors
  };
}

function makeDefaultPrepareReviewFailure(generation = {}, context = {}) {
  const errors = Array.isArray(generation.errors) && generation.errors.length
    ? generation.errors
    : ['Review draft preparation failed.'];
  const teacherFriendlyError = context.previewOnly && isNoUsablePreviewFailure(generation)
    ? 'Gemma did not return any usable preview items from this range.'
    : firstError(errors, 'Review draft preparation failed.');
  return {
    teacherFriendlyError,
    errors,
    technicalErrors: errors.filter((error) => error !== teacherFriendlyError)
  };
}

function uniqueMessages(messages = []) {
  return Array.from(new Set((Array.isArray(messages) ? messages : [])
    .map((message) => String(message || '').trim())
    .filter(Boolean)));
}

function resolvePrepareReviewGenerationTimeoutMs({
  body = {},
  options = {},
  previewOnly = false,
  selectedImportRequested = false,
  autoRecommendationAccepted = false
} = {}) {
  const explicit = positiveNumberOrUndefined(body.timeoutMs);
  if (explicit) return explicit;
  if (autoRecommendationAccepted) {
    return positiveNumberOrUndefined(options.autoAnalyzeGenerationTimeoutMs)
      || positiveNumberOrUndefined(options.teacherContentAutoAnalyzeGenerationTimeoutMs)
      || AUTO_ANALYZE_TIMEOUT_MS;
  }
  if (previewOnly || selectedImportRequested) {
    return positiveNumberOrUndefined(options.previewGenerationTimeoutMs)
      || positiveNumberOrUndefined(options.teacherContentPreviewGenerationTimeoutMs)
      || positiveNumberOrUndefined(options.selectedGenerationTimeoutMs)
      || positiveNumberOrUndefined(options.teacherContentSelectedGenerationTimeoutMs)
      || DEFAULT_PREVIEW_SELECTED_GENERATION_TIMEOUT_MS;
  }
  return positiveNumberOrUndefined(options.fullGenerationTimeoutMs)
    || positiveNumberOrUndefined(options.teacherContentFullGenerationTimeoutMs)
    || positiveNumberOrUndefined(options.timeoutMs)
    || DEFAULT_FULL_GENERATION_TIMEOUT_MS;
}

function makeAutoAnalyzeGenerationOptions(options = {}) {
  const maxBatchCharacters = Math.min(
    positiveNumberOrUndefined(options.maxBatchCharacters) || AUTO_ANALYZE_MAX_BATCH_CHARACTERS,
    AUTO_ANALYZE_MAX_BATCH_CHARACTERS
  );
  const retryMaxBatchCharacters = Math.min(
    positiveNumberOrUndefined(options.retryMaxBatchCharacters) || Math.max(1, Math.floor(maxBatchCharacters / 2)),
    Math.max(1, Math.floor(maxBatchCharacters / 2)),
    AUTO_ANALYZE_RETRY_MAX_BATCH_CHARACTERS
  );
  return {
    ...options,
    maxBatchCharacters,
    retryMaxBatchCharacters,
    maxBatchChunks: 1,
    maxSectionsPerBatch: 1,
    autoAnalyzeUltraSafe: true
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

function sanitizeStandardsBankPath(standardsBankPath, options = {}) {
  if (!nonEmptyString(standardsBankPath)) return undefined;
  const resolved = path.resolve(standardsBankPath);
  const allowedRoot = path.resolve(options.standardsBanksDir || path.join(__dirname, '..', '..', 'knowledge', 'standards-banks'));
  return isPathInside(resolved, allowedRoot) ? resolved : undefined;
}

function isPathInside(filePath, rootDir) {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath === '' || Boolean(relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

module.exports = {
  buildExtractionTimeline,
  combineImportTimelines,
  makeAutoAnalyzeGenerationOptions,
  makeTimelineEvent,
  prepareReviewDraftFromUpload
};
