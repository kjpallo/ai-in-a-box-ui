const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const { DEFAULT_DRAFT_PACKS_DIR } = require('../knowledge/loadDraftKnowledgePacks');
const { SAFE_PACK_ID_PATTERN } = require('../knowledge/packSchema');
const { validateKnowledgePack } = require('../knowledge/validateKnowledgePack');
const { validateStandardsBank } = require('../standards/validateStandardsBank');
const { buildImportCoverageReport } = require('./buildImportCoverageReport');
const { buildKnowledgePackPrompt } = require('./buildKnowledgePackPrompt');

const DEFAULT_MODEL = 'gemma4:e2b';
const DEFAULT_OLLAMA_URL = 'http://localhost:11434/api/generate';
const DEFAULT_OLLAMA_TIMEOUT_MS = 300000;
const DEFAULT_OLLAMA_KEEP_ALIVE = '10m';
const DEFAULT_MODEL_SEED = 42;
const DEFAULT_MODEL_TEMPERATURE = 0;
const DEFAULT_MODEL_TOP_P = 1;
const DEFAULT_MODEL_TOP_K = 40;
const PROMPT_VERSION = 'teacher-content-draft-v2';
const DEFAULT_RAW_MODEL_RESPONSES_DIR = path.join(__dirname, '..', '..', 'tmp', 'model-responses');
const KNOWLEDGE_PACK_FILE_NAME = 'knowledge_pack.json';
const DEFAULT_SCHEMA_VERSION = '1.0.0';
const DEFAULT_DRAFT_VERSION = '0.1.0-draft';
const DEFAULT_BATCH_MAX_CHARACTERS = 2500;
const DEFAULT_RETRY_BATCH_MAX_CHARACTERS = 1250;
const DEFAULT_BATCH_MAX_CHUNKS = 4;
const DEFAULT_PREVIEW_MAX_PAGES = 1;
const DEFAULT_PREVIEW_MAX_CHARACTERS = 1000;
const DEFAULT_FULL_REQUIRES_CONFIRMATION = true;
const DEFAULT_LARGE_IMPORT_CHARACTERS = 12000;
const DEFAULT_LARGE_IMPORT_PAGES = 10;
const DEFAULT_LARGE_IMPORT_BATCHES = 6;
const DEFAULT_HARD_STOP_CHARACTERS = 60000;
const DEFAULT_HARD_STOP_PAGES = 60;
const DEFAULT_HARD_STOP_BATCHES = 24;
const GENERATED_ITEM_SECTIONS = [
  'sourceFiles',
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap',
  'smokeTests'
];

async function generateDraftKnowledgePack(options = {}) {
  const warnings = [];
  const errors = [];
  const extractionJsonPath = options.extractionJsonPath || options.input;
  const outputDraftDir = path.resolve(options.outputDraftDir || options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR);
  const model = options.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  const modelClient = options.modelClient || callOllamaGenerate;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_OLLAMA_TIMEOUT_MS);
  const keepAlive = options.keepAlive || DEFAULT_OLLAMA_KEEP_ALIVE;
  const retryInvalidJson = options.retryInvalidJson === true;
  const force = options.force === true;
  const timeline = [];
  const recordProgress = makeProgressRecorder(timeline, options.onProgress);

  if (!extractionJsonPath || typeof extractionJsonPath !== 'string') {
    return blocked({ warnings, errors: ['An extraction JSON path is required.'] });
  }

  const extractionResult = readJsonFile(path.resolve(extractionJsonPath), 'extraction JSON');
  if (!extractionResult.success) {
    return blocked({ warnings, errors: extractionResult.errors });
  }

  const originalExtraction = extractionResult.value;
  const previewOnly = options.previewOnly === true || options.importMode === 'preview';
  const previewSelectionRequested = previewOnly && isSelectedImportRequested(options);
  const selectedImport = !previewOnly && isSelectedImportRequested(options);
  const fullDocumentImport = !previewOnly && !selectedImport;
  const selectionResult = (selectedImport || previewSelectionRequested)
    ? makeSelectedExtraction(originalExtraction, options)
    : { success: true, extraction: originalExtraction, importSelection: null };
  if (!selectionResult.success) {
    return blocked({ warnings, errors: selectionResult.errors });
  }
  const selectedExtraction = selectionResult.extraction;
  const extraction = fullDocumentImport
    ? makeFullTextBearingExtraction(originalExtraction)
    : previewOnly && isUltraSafePreview(options)
    ? makeUltraSafePreviewExtraction(previewSelectionRequested ? selectedExtraction : makePreviewExtraction(originalExtraction, options), options)
    : previewOnly && !previewSelectionRequested ? makePreviewExtraction(originalExtraction, options) : selectedExtraction;
  const importSelection = previewOnly
    ? makePreviewImportSelection(extraction, originalExtraction, selectionResult.importSelection)
    : selectionResult.importSelection;
  const importScope = makeImportScope({
    originalExtraction,
    extraction,
    importSelection,
    previewOnly,
    selectedImport,
    options
  });
  const extractionValidationErrors = validateExtraction(extraction);
  if (extractionValidationErrors.length > 0) {
    return blocked({ warnings, errors: extractionValidationErrors });
  }
  recordProgress('upload_received', 'Upload received', {
    fileName: firstNonEmptyString(extraction.upload && extraction.upload.originalFileName, extraction.fileName),
    uploadId: extraction.upload && extraction.upload.uploadId
  });
  recordProgress('extraction_complete', 'Extraction complete', {
    characterCount: String(extraction.text || '').length,
    pageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
    chunkCount: Array.isArray(extraction.sections) ? extraction.sections.length : 0
  });
  if (previewOnly && extraction.metadata && extraction.metadata.ultraSafeNote) {
    warnings.push(extraction.metadata.ultraSafeNote);
    recordProgress('preview_ultra_safe_truncated', extraction.metadata.ultraSafeNote, {
      maxPreviewChars: previewMaxCharacters(options),
      pageCount: Number(extraction.metadata.pageCount || 0),
      chunkCount: Array.isArray(extraction.sections) ? extraction.sections.length : 0,
      characterCount: String(extraction.text || '').length
    });
  }
  if (importSelection) {
    recordProgress(
      'import_selection_ready',
      `${previewOnly ? 'Preview range' : 'Selected import range'} ready: ${importSelection.label}`,
      {
        importSelection,
        pageRange: importSelection.pageRangeLabel,
        chunkRange: importSelection.chunkRangeLabel,
        pageCount: importSelection.pageCount,
        chunkCount: importSelection.chunkCount,
        characterCount: importSelection.characterCount
      }
    );
  }
  if (previewOnly) {
    recordProgress('preview_mode_ready', `Preview mode: ${previewModeLabel(options)}`, {
      previewMode: previewModeLabel(options),
      maxPreviewChars: previewMaxCharacters(options),
      pageRange: importSelection && importSelection.pageRangeLabel,
      chunkRange: importSelection && importSelection.chunkRangeLabel
    });
  }

  const standardsResult = loadStandardsBank(options.standardsBankPath || options.standardsBank);
  warnings.push(...standardsResult.warnings);
  if (!standardsResult.success) {
    return blocked({ warnings, errors: standardsResult.errors });
  }

  const importEstimate = buildImportEstimate(originalExtraction, options);
  const selectedImportEstimate = importSelection ? buildImportEstimate(extraction, options) : null;
  recordProgress('full_import_estimate_ready', 'Full upload estimate ready', importEstimate);
  if (selectedImportEstimate) {
    recordProgress('preview_range_estimate_ready', previewOnly ? 'Preview range estimate ready' : 'Selected range estimate ready', selectedImportEstimate);
  }

  const batchPlan = buildExtractionBatches(extraction, options);
  const batches = batchPlan.batches;
  const promptSourceChunks = batchPlan.chunks;
  const generatedBatches = [];
  const rawModelResponses = [];
  const inputSnapshot = buildImportInputSnapshot({
    uploadId: originalExtraction && originalExtraction.upload && originalExtraction.upload.uploadId,
    importSelection,
    importScope,
    model,
    modelSettings: makeDeterministicModelOptions(options),
    sourceChunks: promptSourceChunks
  });
  recordProgress('wrapper_started', 'Building draft packet wrapper', {
    packName: sanitizePackName(options.packName),
    totalBatches: batches.length,
    inputSnapshot
  });

  for (const batch of batches) {
    const batchSource = summarizeBatchSource(batch);
    const prompt = buildKnowledgePackPrompt({
      extraction: batch.extraction,
      standardsBank: standardsResult.standardsBank,
      packName: options.packName,
      batchInfo: {
        batchIndex: batch.batchIndex,
        totalBatches: batches.length
      }
    });

    recordProgress('batch_sent', `Sending batch ${batch.batchIndex} of ${batches.length} to Gemma${batchSource.messageSuffix}`, {
      batchIndex: batch.batchIndex,
      totalBatches: batches.length,
      chunkCount: batch.chunks.length,
      characterCount: String(batch.extraction.text || '').length,
      pageRange: batchSource.pageRange,
      chunkRange: batchSource.chunkRange,
      chunkLabels: batchSource.chunkLabels
    });
    let generationResult = await generateBatchDraft({
      batch,
      model,
      prompt,
      modelClient,
      timeoutMs,
      keepAlive,
      retryInvalidJson,
      options
    });

    if (!generationResult.success && shouldRetryModelCrash(generationResult)) {
      const retryBatches = buildRetryBatchesForBatch(batch, {
        extraction,
        retryMaxCharacters: modelRetryMaxCharacters(options)
      });
      if (retryBatches.length > 0) {
        recordProgress('batch_retry', `Gemma crashed while reading batch ${batch.batchIndex} of ${batches.length}. Retrying with smaller chunks.`, {
          batchIndex: batch.batchIndex,
          totalBatches: batches.length,
          retryBatches: retryBatches.length,
          characterCount: String(batch.extraction.text || '').length,
          retryMaxCharacters: modelRetryMaxCharacters(options),
          pageRange: batchSource.pageRange,
          chunkRange: batchSource.chunkRange,
          chunkLabels: batch.chunks.map((chunk) => chunk.label)
        });
        generationResult = await retryBatchWithSmallerChunks({
          originalBatch: batch,
          retryBatches,
          totalBatches: batches.length,
          standardsBank: standardsResult.standardsBank,
          packName: options.packName,
          model,
          modelClient,
          timeoutMs,
          keepAlive,
          retryInvalidJson,
          options,
          importScope,
          recordProgress
        });
      }
    }

    rawModelResponses.push(...normalizeRawResponses(generationResult.rawModelResponse));

    if (!generationResult.success) {
      const coverageReport = buildImportCoverageReport({
        extraction,
        sourceChunks: promptSourceChunks,
        processedChunks: generatedBatches.flatMap((entry) => entry.batch.chunks),
        failedBatches: generationResult.failedBatches || [makeFailedBatchWarning(batch, generationResult.errors)]
      });
      warnings.push(...coverageReport.warnings);
      recordProgress('error', firstError(generationResult.errors, `Draft generation failed for batch ${batch.batchIndex}.`), {
        batchIndex: batch.batchIndex,
        totalBatches: batches.length,
        errors: generationResult.errors,
        chunkLabels: batch.chunks.map((chunk) => chunk.label)
      });
      if (previewOnly && generatedBatches.length > 0) {
        recordProgress('partial_preview_ready', 'Partial preview created. Some pages/chunks failed.', {
          processedBatches: generatedBatches.length,
          failedBatches: (generationResult.failedBatches || coverageReport.failedBatches || []).length,
          maxPreviewChars: previewMaxCharacters(options)
        });
        return makePreviewResult({
          partial: true,
          generatedBatches,
          extraction,
          importEstimate,
          selectedImportEstimate,
          inputSnapshot,
          importSelection,
          importScope,
          coverageReport,
          timeline,
          warnings,
          errors: generationResult.errors,
          failedBatches: generationResult.failedBatches || coverageReport.failedBatches,
          model,
          options
        });
      }
      return blocked({
        warnings,
        errors: generationResult.errors,
        rawModelResponsePath: generationResult.rawModelResponsePath,
        timeline,
        coverageReport,
        failedBatches: generationResult.failedBatches || coverageReport.failedBatches
      });
    }

    const normalizedBatchPack = normalizeDraftKnowledgePack(generationResult.parsedModelResponse, {
      extraction: batches.length > 1 ? batch.extraction : extraction,
      packName: options.packName,
      importScope
    });
    recordProgress('batch_received', `Received draft items from batch ${batch.batchIndex} of ${batches.length}${batchSource.messageSuffix}`, {
      batchIndex: batch.batchIndex,
      totalBatches: batches.length,
      pageRange: batchSource.pageRange,
      chunkRange: batchSource.chunkRange,
      chunkLabels: batchSource.chunkLabels,
      itemCounts: countGeneratedItems(normalizedBatchPack)
    });
    generatedBatches.push({
      batch,
      parsedModelResponse: generationResult.parsedModelResponse,
      pack: normalizedBatchPack
    });
  }

  const pack = generatedBatches.length === 1
    ? generatedBatches[0].pack
    : mergeDraftKnowledgePacks(generatedBatches.map((entry) => entry.pack), {
        extraction,
        packName: options.packName,
        importScope
      });
  recordProgress('merge_complete', 'Merging batch results', {
    totalBatches: batches.length,
    itemCounts: countGeneratedItems(pack)
  });
  const coverageReport = buildImportCoverageReport({
    extraction,
    pack,
    sourceChunks: promptSourceChunks,
    processedChunks: batches.flatMap((batch) => batch.chunks)
  });
  pack.metadata.importCoverage = coverageReport;
  pack.metadata.importScope = importScope;
  if (importSelection) {
    pack.metadata.importSelection = importSelection;
    pack.metadata.partialImport = {
      completePacketImported: false,
      note: 'This draft was generated from a selected page/chunk range, not the whole source packet.',
      importedPages: importSelection.pages,
      importedChunks: importSelection.chunks,
      originalPageCount: importSelection.originalPageCount,
      originalChunkCount: importSelection.originalChunkCount,
      originalCharacterCount: importSelection.originalCharacterCount
    };
  }
  warnings.push(...coverageReport.warnings);
  const draftSafetyErrors = validateDraftSafety(pack);
  recordProgress('validation_started', 'Running validation', {
    packId: pack && pack.packId,
    importNormalization: pack && pack.metadata && pack.metadata.importNormalization
  });
  const validation = validateKnowledgePack(pack, {
    standardsBank: standardsResult.standardsBank
  });
  warnings.push(...validation.warnings);
  const normalizationReport = pack && pack.metadata && pack.metadata.importNormalization;
  if (normalizationReport && normalizationReport.totalNormalized > 0) {
    recordProgress('normalization_complete', 'Gemma returned draft items. Charlemagne normalized IDs/titles and kept items pending review.', {
      ...normalizationReport,
      validationPassed: validation.valid && draftSafetyErrors.length === 0
    });
  }
  recordProgress('coverage_report_built', 'Building coverage report', {
    totalChunks: coverageReport.totalChunks,
    processedChunks: coverageReport.processedChunks,
    chunksWithDraftItems: coverageReport.chunksWithDraftItems,
    warnings: coverageReport.warnings || []
  });

  if (draftSafetyErrors.length > 0 || !validation.valid) {
    const validationErrors = [...draftSafetyErrors, ...validation.errors];
    if (previewOnly) {
      const salvage = makePreviewValidationSalvage({
        pack,
        validationErrors,
        validationWarnings: validation.warnings,
        standardsBank: standardsResult.standardsBank,
        extraction,
        sourceChunks: promptSourceChunks,
        processedChunks: batches.flatMap((batch) => batch.chunks),
        coverageReport
      });
      if (salvage.success) {
        const rawModelResponsePath = writeRawResponse(options, JSON.stringify({
          rawModelResponses,
          parsedModelResponse: generatedBatches.map((entry) => entry.parsedModelResponse),
          normalizedDraftAttempt: pack,
          cleanedPreviewPack: salvage.pack,
          invalidItems: salvage.invalidItems,
          errors: validationErrors
        }, null, 2));
        recordProgress('preview_validation_repair_needed', 'Validation found repair-needed preview items.', {
          errors: validationErrors,
          importNormalization: normalizationReport,
          validationPassed: false
        });
        recordProgress('preview_valid_items_kept', 'Valid preview items kept for review.', {
          itemCounts: countGeneratedItems(salvage.pack)
        });
        recordProgress('preview_invalid_items_quarantined', 'Invalid preview items quarantined for repair.', {
          invalidItemCount: salvage.invalidItems.length,
          errors: validationErrors
        });
        recordProgress('preview_final_draft_not_written', 'Preview salvage did not write a final draft pack.', {
          packId: salvage.pack && salvage.pack.packId,
          validationPassed: false
        });
        return makePreviewResult({
          partial: true,
          partialReason: 'validation',
          pack: salvage.pack,
          extraction,
          importEstimate,
          selectedImportEstimate,
          inputSnapshot,
          importScope,
          importSelection,
          coverageReport: salvage.coverageReport,
          timeline,
          warnings: Array.from(new Set([...(warnings || []), ...(salvage.warnings || [])])),
          errors: validationErrors,
          validationErrors,
          invalidItems: salvage.invalidItems,
          repairNeeded: salvage.repairNeeded,
          rawModelResponsePath,
          failedBatches: [],
          model,
          options
        });
      }
    }
    recordProgress('error', 'Gemma returned draft items, but validation found fields that need repair.', {
      errors: validationErrors,
      importNormalization: normalizationReport,
      validationPassed: false
    });
    return blocked({
      packId: pack && pack.packId,
      warnings,
      errors: validationErrors,
      validationPassed: false,
      rawModelResponsePath: writeRawResponse(options, JSON.stringify({
        rawModelResponses,
        parsedModelResponse: generatedBatches.map((entry) => entry.parsedModelResponse),
        normalizedDraftAttempt: pack,
        errors: validationErrors
      }, null, 2)),
      timeline
    });
  }

  const safePackId = pack.packId;
  if (previewOnly) {
    recordProgress('preview_ready', 'Preview draft ready', {
      packId: safePackId,
      itemCounts: countGeneratedItems(pack),
      importNormalization: pack.metadata.importNormalization,
      validationPassed: true
    });
    return makePreviewResult({
      partial: false,
      pack,
      extraction,
      importEstimate,
      selectedImportEstimate,
      inputSnapshot,
      importSelection,
      importScope,
      coverageReport,
      timeline,
      warnings,
      errors: [],
      failedBatches: [],
      model,
      options
    });
  }

  const outputDir = path.join(outputDraftDir, safePackId);
  const outputPath = path.join(outputDir, KNOWLEDGE_PACK_FILE_NAME);

  if (fs.existsSync(outputPath) && !force) {
    recordProgress('error', `Draft pack already exists at ${outputPath}.`, {
      packId: safePackId
    });
    return blocked({
      packId: safePackId,
      outputPath,
      warnings,
      errors: [`Draft pack already exists at ${outputPath}. Pass force: true to overwrite.`],
      validationPassed: true,
      timeline
    });
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`);
  recordProgress('draft_ready', 'Draft ready for review', {
    packId: safePackId,
    outputPath,
    itemCounts: countGeneratedItems(pack)
  });

  return {
    success: true,
    packId: safePackId,
    title: pack.title || safePackId,
    sourceFiles: normalizedSourceFileNames(pack),
    extractionCharacterCount: String(extraction.text || '').length,
    extractionChunkCount: Array.isArray(extraction.sections) ? extraction.sections.length : 0,
    extractionPageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
    fullImportEstimate: importEstimate,
    inputSnapshot,
    coverageReport,
    importSelection,
    importScope,
    selectedImportEstimate,
    timeline,
    outputPath,
    validationPassed: true,
    warnings,
    errors: []
  };
}

function makePreviewResult({
  partial,
  partialReason,
  pack,
  generatedBatches,
  extraction,
  importEstimate,
  selectedImportEstimate,
  inputSnapshot,
  importSelection,
  importScope,
  coverageReport,
  timeline,
  warnings,
  errors,
  validationErrors,
  invalidItems,
  repairNeeded,
  rawModelResponsePath,
  failedBatches,
  model,
  options
}) {
  const safeOptions = options || {};
  const safeGeneratedBatches = Array.isArray(generatedBatches) ? generatedBatches : [];
  const previewPack = pack || (safeGeneratedBatches.length === 1
    ? safeGeneratedBatches[0].pack
    : mergeDraftKnowledgePacks(safeGeneratedBatches.map((entry) => entry.pack), {
        extraction,
        packName: safeOptions.packName
      }));
  previewPack.metadata = {
    ...(previewPack.metadata || {}),
    importCoverage: coverageReport,
    importScope,
    partialPreview: partial === true,
    validationPassed: partial ? false : true
  };
  if (partialReason) previewPack.metadata.partialPreviewReason = partialReason;
  if (Array.isArray(invalidItems) && invalidItems.length) previewPack.metadata.invalidPreviewItemCount = invalidItems.length;
  if (importSelection) previewPack.metadata.importSelection = importSelection;
  const packId = previewPack.packId;
  const previewMessage = partialReason === 'validation'
    ? 'Partial preview created. Validation found repair-needed items; valid preview items were kept.'
    : partial
      ? 'Partial preview created. Some pages/chunks failed.'
      : 'Preview draft prepared. Review the sample before running full import.';
  return {
    success: true,
    preview: true,
    partialPreview: partial === true,
    validationPassed: partial ? false : true,
    packId,
    title: previewPack.title || packId,
    sourceFiles: normalizedSourceFileNames(previewPack),
    extractionCharacterCount: String(extraction.text || '').length,
    extractionChunkCount: Array.isArray(extraction.sections) ? extraction.sections.length : 0,
    extractionPageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
    fullImportEstimate: importEstimate,
    selectedImportEstimate,
    inputSnapshot,
    importScope,
    importSelection,
    previewReport: {
      pack: previewPack,
      partialPreview: partial === true,
      partialPreviewReason: partialReason || '',
      validationPassed: partial ? false : true,
      message: previewMessage,
      model,
      previewMode: previewModeLabel(safeOptions),
      maxPreviewChars: previewMaxCharacters(safeOptions),
      coverageReport,
      failedBatches: failedBatches || [],
      errors: errors || [],
      validationErrors: validationErrors || errors || [],
      invalidItems: invalidItems || [],
      repairNeeded: repairNeeded || invalidItems || [],
      rawModelResponsePath,
      warnings: warnings || [],
      inputSnapshot,
      importScope,
      deduplication: previewPack.metadata && previewPack.metadata.deduplication,
      importNormalization: previewPack.metadata && previewPack.metadata.importNormalization,
      processedPageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
      processedCharacterCount: String(extraction.text || '').length,
      processedChunkCount: Array.isArray(extraction.sections) ? extraction.sections.length : 0
    },
    coverageReport,
    importSelection,
    timeline,
    warnings: warnings || [],
    errors: errors || [],
    validationErrors: validationErrors || errors || [],
    invalidItems: invalidItems || [],
    repairNeeded: repairNeeded || invalidItems || [],
    rawModelResponsePath,
    failedBatches: failedBatches || []
  };
}

function makePreviewValidationSalvage({
  pack,
  validationErrors,
  validationWarnings,
  standardsBank,
  extraction,
  sourceChunks,
  processedChunks,
  coverageReport
}) {
  const errors = Array.isArray(validationErrors) ? validationErrors : [];
  const cleanedPack = cloneJson(pack);
  if (!cleanedPack || typeof cleanedPack !== 'object' || Array.isArray(cleanedPack)) {
    return {
      success: false,
      errors: ['Preview validation salvage requires a generated pack object.']
    };
  }

  const invalidItems = [];
  GENERATED_ITEM_SECTIONS.forEach((sectionName) => {
    const items = Array.isArray(cleanedPack[sectionName]) ? cleanedPack[sectionName] : [];
    const kept = [];
    items.forEach((item, index) => {
      const itemErrors = errors.filter((error) => validationErrorBelongsToItem(error, sectionName, index));
      if (itemErrors.length > 0) {
        invalidItems.push({
          section: sectionName,
          index,
          item,
          errors: itemErrors
        });
        return;
      }
      kept.push(item);
    });
    cleanedPack[sectionName] = kept;
  });

  cleanedPack.metadata = {
    ...(cleanedPack.metadata || {}),
    partialPreview: true,
    partialPreviewReason: 'validation',
    validationPassed: false,
    invalidPreviewItemCount: invalidItems.length,
    previewSalvage: {
      reason: 'validation_failed',
      invalidItemCount: invalidItems.length,
      originalValidationErrors: errors
    }
  };
  if (cleanedPack.metadata.importNormalization && typeof cleanedPack.metadata.importNormalization === 'object') {
    cleanedPack.metadata.importNormalization = {
      ...cleanedPack.metadata.importNormalization,
      droppedItems: Number(cleanedPack.metadata.importNormalization.droppedItems || 0) + invalidItems.length
    };
  }

  if (!hasUsefulPreviewItems(cleanedPack)) {
    return {
      success: false,
      errors: ['No usable preview items remained after validation repair filtering.'],
      invalidItems
    };
  }

  const cleanedValidation = validateKnowledgePack(cleanedPack, { standardsBank });
  if (!cleanedValidation.valid) {
    return {
      success: false,
      errors: cleanedValidation.errors,
      invalidItems
    };
  }

  const cleanedCoverageReport = buildImportCoverageReport({
    extraction,
    pack: cleanedPack,
    sourceChunks,
    processedChunks,
    failedBatches: coverageReport && coverageReport.failedBatches
  });
  cleanedPack.metadata.importCoverage = cleanedCoverageReport;

  return {
    success: true,
    pack: cleanedPack,
    coverageReport: cleanedCoverageReport,
    invalidItems,
    repairNeeded: invalidItems,
    warnings: Array.from(new Set([
      ...(Array.isArray(validationWarnings) ? validationWarnings : []),
      ...(cleanedValidation.warnings || []),
      'Preview validation found repair-needed items. Invalid preview items were quarantined and no final draft was written.'
    ]))
  };
}

function validationErrorBelongsToItem(error, sectionName, index) {
  const prefix = `${sectionName}[${index}]`;
  return String(error || '').startsWith(prefix);
}

function hasUsefulPreviewItems(pack) {
  return GENERATED_ITEM_SECTIONS
    .filter((sectionName) => sectionName !== 'sourceFiles')
    .some((sectionName) => {
      const items = Array.isArray(pack && pack[sectionName]) ? pack[sectionName] : [];
      return items.some((item) => item && typeof item === 'object' && !Array.isArray(item));
    });
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

async function generateBatchDraft({
  batch,
  model,
  prompt,
  modelClient,
  timeoutMs,
  keepAlive,
  retryInvalidJson,
  options
}) {
  let rawModelResponse;
  try {
    rawModelResponse = await modelClient({
      model,
      prompt,
      timeoutMs,
      keepAlive,
      options: makeDeterministicModelOptions(options)
    });
  } catch (error) {
    const errors = makeModelBatchErrors(
      batch,
      batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches,
      [error.message],
      false,
      { model, previewMaxCharacters: previewMaxCharacters(options), previewOnly: options.previewOnly === true || options.importMode === 'preview' }
    );
    return {
      success: false,
      rawModelResponse,
      modelCrash: isModelCrashError(error),
      errors,
      failedBatches: [makeFailedBatchWarning(batch, errors)]
    };
  }

  let parsedResult = parseModelResponse(rawModelResponse);
  if (!parsedResult.success && retryInvalidJson) {
    let retryRawModelResponse;
    try {
      retryRawModelResponse = await modelClient({
        model,
        prompt: buildJsonRepairPrompt(rawModelResponse),
        timeoutMs,
        keepAlive,
        options: makeDeterministicModelOptions(options)
      });
    } catch (error) {
      return {
        success: false,
        rawModelResponse,
        errors: [
          ...parsedResult.errors,
          `Ollama JSON repair retry failed for batch ${batch.batchIndex}: ${error.message}`
        ],
        rawModelResponsePath: writeRawResponse(options, rawModelResponse)
      };
    }

    const retryParsedResult = parseModelResponse(retryRawModelResponse);
    if (retryParsedResult.success) {
      parsedResult = retryParsedResult;
      rawModelResponse = retryRawModelResponse;
    } else {
      return {
        success: false,
        rawModelResponse: retryRawModelResponse,
        errors: [
          ...parsedResult.errors,
          `JSON repair retry also failed for batch ${batch.batchIndex}: ${retryParsedResult.errors.join('; ')}`
        ],
        rawModelResponsePath: writeRawResponse(options, retryRawModelResponse)
      };
    }
  }

  if (!parsedResult.success) {
    return {
      success: false,
      rawModelResponse,
      errors: parsedResult.errors,
      rawModelResponsePath: writeRawResponse(options, rawModelResponse)
    };
  }

  return {
    success: true,
    rawModelResponse,
    parsedModelResponse: parsedResult.value
  };
}

function buildExtractionBatches(extraction, options = {}) {
  const maxBatchCharacters = modelMaxCharacters(options);
  const maxBatchChunks = positiveInteger(options.maxBatchChunks, DEFAULT_BATCH_MAX_CHUNKS);
  const chunks = makePromptChunks(extraction, maxBatchCharacters);
  if (chunks.length <= 1) {
    return {
      chunks,
      batches: [{
        batchIndex: 1,
        chunks,
        extraction: makeBatchExtraction(extraction, chunks, 1, 1)
      }]
    };
  }

  const batches = [];
  let current = [];
  let currentCharacters = 0;

  chunks.forEach((chunk) => {
    const wouldExceedCharacters = current.length > 0 && currentCharacters + chunk.text.length > maxBatchCharacters;
    const wouldExceedChunks = current.length >= maxBatchChunks;
    if (wouldExceedCharacters || wouldExceedChunks) {
      batches.push(current);
      current = [];
      currentCharacters = 0;
    }
    current.push(chunk);
    currentCharacters += chunk.text.length;
  });

  if (current.length > 0) batches.push(current);

  return {
    chunks,
    batches: batches.map((batchChunks, index) => ({
      batchIndex: index + 1,
      chunks: batchChunks,
      extraction: makeBatchExtraction(extraction, batchChunks, index + 1, batches.length)
    }))
  };
}

function buildImportEstimate(extraction, options = {}) {
  const safeExtraction = extraction && typeof extraction === 'object' ? extraction : {};
  const batchPlan = buildExtractionBatches(safeExtraction, options);
  const fileName = firstNonEmptyString(
    safeExtraction.upload && safeExtraction.upload.originalFileName,
    safeExtraction.fileName,
    'Uploaded file'
  );
  const characterCount = String(safeExtraction.text || '').length;
  const pageCount = estimatePageCount(safeExtraction);
  const textBearingPageInfo = identifyTextBearingPages(safeExtraction);
  const chunkCount = batchPlan.chunks.length;
  const estimatedGemmaBatches = batchPlan.batches.length;
  const maxCharsPerBatch = modelMaxCharacters(options);
  const retryMaxCharsPerBatch = modelRetryMaxCharacters(options);
  const thresholds = importSafetyThresholds(options);
  const largeReasons = [];
  const hardStopReasons = [];

  if (characterCount > thresholds.largeCharacterCount) largeReasons.push(`character count exceeds ${thresholds.largeCharacterCount}`);
  if (pageCount > thresholds.largePageCount) largeReasons.push(`page count exceeds ${thresholds.largePageCount}`);
  if (estimatedGemmaBatches > thresholds.largeBatchCount) largeReasons.push(`estimated Gemma batches exceed ${thresholds.largeBatchCount}`);
  if (characterCount > thresholds.hardStopCharacterCount) hardStopReasons.push(`character count exceeds ${thresholds.hardStopCharacterCount}`);
  if (pageCount > thresholds.hardStopPageCount) hardStopReasons.push(`page count exceeds ${thresholds.hardStopPageCount}`);
  if (estimatedGemmaBatches > thresholds.hardStopBatchCount) hardStopReasons.push(`estimated Gemma batches exceed ${thresholds.hardStopBatchCount}`);

  return {
    fileName,
    characterCount,
    pageCount,
    textBearingPages: textBearingPageInfo.pages,
    firstTextPage: textBearingPageInfo.firstTextPage,
    pagesWithText: textBearingPageInfo.pages,
    chunkCount,
    estimatedGemmaBatches,
    maxCharsPerBatch,
    retryMaxCharsPerBatch,
    previewMaxPages: previewMaxPages(options),
    previewMaxCharacters: previewMaxCharacters(options),
    fullImportRequiresConfirmation: fullImportRequiresConfirmation(options),
    isLarge: largeReasons.length > 0,
    largeReasons,
    hardStop: hardStopReasons.length > 0,
    hardStopReasons,
    warning: largeReasons.length
      ? 'Local Gemma may be slow or memory-heavy for this upload. Run preview first before full import.'
      : '',
    hardStopMessage: hardStopReasons.length
      ? 'This upload is large. Run preview first or lower batch size.'
      : '',
    thresholds
  };
}

function makePreviewExtraction(extraction, options = {}) {
  const maxPages = previewMaxPages(options);
  const pageSections = makePageSections(extraction);
  if (pageSections.length > 0) {
    const pages = pageSections.slice(0, maxPages);
    return {
      ...extraction,
      text: pages.map((page) => page.text).join('\n\n'),
      pages,
      sections: pages.map((page) => ({
        label: page.label,
        sourceLocation: page.sourceLocation,
        pageNumber: page.pageNumber,
        text: page.text
      })),
      metadata: {
        ...(extraction.metadata || {}),
        pageCount: pages.length,
        preview: true,
        previewMaxPages: maxPages,
        originalPageCount: estimatePageCount(extraction),
        originalCharacterCount: String(extraction.text || '').length
      }
    };
  }

  const chunks = makePromptChunks(extraction, modelMaxCharacters(options)).slice(0, Math.max(1, maxPages));
  return {
    ...extraction,
    text: chunks.map((chunk) => chunk.text).join('\n\n'),
    sections: chunks.map((chunk) => ({
      label: chunk.label,
      sourceLocation: chunk.sourceLocation,
      pageNumber: chunk.pageNumber,
      text: chunk.text
    })),
    metadata: {
      ...(extraction.metadata || {}),
      pageCount: Math.min(estimatePageCount(extraction), maxPages),
      preview: true,
      previewMaxPages: maxPages,
      originalPageCount: estimatePageCount(extraction),
      originalCharacterCount: String(extraction.text || '').length
    }
  };
}

function makeFullTextBearingExtraction(extraction) {
  const pageSections = makePageSections(extraction);
  if (!pageSections.length) {
    return {
      ...extraction,
      metadata: {
        ...(extraction && extraction.metadata || {}),
        fullImport: true,
        originalPageCount: estimatePageCount(extraction),
        originalCharacterCount: String(extraction && extraction.text || '').length
      }
    };
  }

  const textBearingPages = pageSections.map((page) => page.pageNumber).filter(Boolean);
  return {
    ...extraction,
    text: pageSections.map((page) => page.text).join('\n\n'),
    pages: pageSections,
    sections: pageSections.map((page) => ({
      label: page.label,
      sourceLocation: page.sourceLocation,
      pageNumber: page.pageNumber,
      text: page.text
    })),
    metadata: {
      ...(extraction.metadata || {}),
      pageCount: pageSections.length,
      chunkCount: pageSections.length,
      fullImport: true,
      textBearingPages,
      originalPageCount: estimatePageCount(extraction),
      originalCharacterCount: String(extraction.text || '').length,
      originalChunkCount: makePromptSections(extraction).length
    }
  };
}

function makeUltraSafePreviewExtraction(extraction, options = {}) {
  const maxCharacters = previewMaxCharacters(options);
  const sections = makePromptSections(extraction);
  const firstSection = sections[0] || { label: 'Preview chunk', sourceLocation: 'Preview chunk', text: extraction && extraction.text || '' };
  const firstChunkText = splitLongText(String(firstSection.text || ''), maxCharacters)[0] || String(firstSection.text || '').slice(0, maxCharacters);
  const truncated = String(firstSection.text || '').length > firstChunkText.length;
  const safeSection = {
    label: firstSection.label || firstSection.sourceLocation || 'Preview chunk',
    sourceLocation: firstSection.sourceLocation || firstSection.label || 'Preview chunk',
    pageNumber: firstSection.pageNumber,
    chunkIndex: 1,
    text: firstChunkText
  };
  return {
    ...extraction,
    text: firstChunkText,
    pages: firstSection.pageNumber ? [safeSection] : undefined,
    sections: [safeSection],
    metadata: {
      ...(extraction.metadata || {}),
      pageCount: firstSection.pageNumber ? 1 : Number(extraction && extraction.metadata && extraction.metadata.pageCount || 1),
      chunkCount: 1,
      preview: true,
      previewMode: 'ultra-safe',
      previewMaxPages: 1,
      previewMaxCharacters: maxCharacters,
      ultraSafeTruncated: truncated,
      ultraSafeNote: truncated
        ? `Ultra-safe preview used the first safe chunk because the selected source page exceeded ${maxCharacters} characters.`
        : ''
    },
    warnings: [
      ...(Array.isArray(extraction && extraction.warnings) ? extraction.warnings : []),
      ...(truncated ? [`Ultra-safe preview used the first safe chunk because the selected source page exceeded ${maxCharacters} characters.`] : [])
    ]
  };
}

function makeImportScope({ originalExtraction, extraction, importSelection, previewOnly, selectedImport, options = {} }) {
  const originalPageInfo = identifyTextBearingPages(originalExtraction);
  const processedPageInfo = identifyTextBearingPages(extraction);
  const processedPages = importSelection && Array.isArray(importSelection.pages) && importSelection.pages.length
    ? importSelection.pages
    : processedPageInfo.pages;
  const processedChunks = Array.isArray(extraction && extraction.sections)
    ? extraction.sections.map((section, index) => Number(section.chunkIndex || section.index || index + 1)).filter((value) => Number.isFinite(value) && value > 0)
    : [];
  const pageRangeLabel = importSelection && importSelection.pageRangeLabel && !(processedPages.length === 1)
    ? importSelection.pageRangeLabel
    : formatDisplayPageRange(processedPages);
  const chunkRangeLabel = importSelection && importSelection.chunkRangeLabel
    ? importSelection.chunkRangeLabel
    : formatNumberRange(processedChunks);
  const importIntent = String(options.importIntent || options.selectedImportPreset || '').trim().toLowerCase();
  const sampleOnly = previewOnly || importIntent === 'preview_range' || importIntent === 'preview';
  const scope = previewOnly || sampleOnly
    ? 'preview_sample'
    : selectedImport
      ? 'selected_range'
      : 'full_document';
  const scopeLabel = scope === 'preview_sample'
    ? 'Preview Sample'
    : scope === 'selected_range'
      ? 'Selected Range'
      : 'Full Import';
  const rangeLabel = pageRangeLabel ? `Pages ${pageRangeLabel}` : chunkRangeLabel ? `Chunks ${chunkRangeLabel}` : '';

  return {
    scope,
    scopeLabel,
    sampleOnly,
    rangeLimited: scope !== 'full_document',
    completePacketImported: scope === 'full_document',
    pageRangeLabel,
    chunkRangeLabel,
    rangeLabel,
    pages: processedPages,
    chunks: processedChunks,
    textBearingPages: originalPageInfo.pages,
    firstTextPage: originalPageInfo.firstTextPage,
    originalPageCount: estimatePageCount(originalExtraction),
    processedPageCount: processedPages.length || Number(extraction && extraction.metadata && extraction.metadata.pageCount || 0),
    processedChunkCount: Array.isArray(extraction && extraction.sections) ? extraction.sections.length : 0,
    processedCharacterCount: String(extraction && extraction.text || '').length,
    warning: scope === 'preview_sample' && rangeLabel
      ? `This draft only covers ${rangeLabel}. Run Full Import to process the whole document.`
      : scope === 'selected_range' && rangeLabel
        ? `This draft covers only ${rangeLabel}. It does not mark the whole packet imported.`
        : ''
  };
}

function summarizeBatchSource(batch) {
  const chunks = Array.isArray(batch && batch.chunks) ? batch.chunks : [];
  const pages = chunks
    .map((chunk) => Number(chunk.pageNumber || chunk.page || 0))
    .filter((page) => Number.isFinite(page) && page > 0);
  const chunkIndexes = chunks
    .map((chunk) => Number(chunk.chunkIndex || chunk.index || 0))
    .filter((chunk) => Number.isFinite(chunk) && chunk > 0);
  const pageRange = formatNumberRange(pages);
  const chunkRange = formatNumberRange(chunkIndexes);
  const source = pageRange ? `Pages ${pageRange}` : chunkRange ? `Chunks ${chunkRange}` : '';
  return {
    pageRange,
    chunkRange,
    chunkLabels: chunks.map((chunk) => chunk.label).filter(Boolean),
    messageSuffix: source ? ` (${source})` : ''
  };
}

function isSelectedImportRequested(options = {}) {
  const mode = String(options.importMode || '').trim().toLowerCase();
  return mode === 'selected'
    || mode === 'range'
    || options.selectedImport === true
    || Boolean(options.importSelection)
    || Boolean(options.pageRange)
    || Boolean(options.pageStart)
    || Boolean(options.importPageStart)
    || Boolean(options.chunkStart)
    || Boolean(options.importChunkStart);
}

function makeSelectedExtraction(extraction, options = {}) {
  const requested = normalizeSelectionRequest(options);
  const pageSections = makePageSections(extraction);
  if (!pageSections.length && (requested.pageStart || requested.pageEnd) && estimatePageCount(extraction) > 0 && !String(extraction && extraction.text || '').trim()) {
    return {
      success: false,
      errors: ['No extractable text was found in this upload.']
    };
  }
  if (pageSections.length > 0 && (requested.pageStart || requested.pageEnd)) {
    const start = requested.pageStart || 1;
    const end = requested.pageEnd || start;
    const selectedPages = pageSections.filter((page) => page.pageNumber >= start && page.pageNumber <= end);
    if (!selectedPages.length) {
      const pageCount = estimatePageCount(extraction);
      const textBearingPageInfo = identifyTextBearingPages(extraction);
      if (!textBearingPageInfo.pages.length) {
        return {
          success: false,
          errors: ['No extractable text was found in this upload.']
        };
      }
      if (pageCount > 0 && start <= pageCount && end <= pageCount) {
        const firstTextPage = textBearingPageInfo.firstTextPage;
        const suffix = firstTextPage
          ? ` Try page ${firstTextPage}, the first page with extracted text.`
          : ' Try a page with text.';
        return {
          success: false,
          errors: [`No extracted text was found for selected pages ${start}-${end}. The selected page exists, but no extractable text was found there.${suffix}`]
        };
      }
      return {
        success: false,
        errors: [`No extracted text was found for selected pages ${start}-${end}. Try a page with text.`]
      };
    }
    return {
      success: true,
      extraction: makeRangeExtraction(extraction, selectedPages, makeImportSelection({
        extraction,
        selectedSections: selectedPages,
        kind: 'pages',
        start,
        end
      })),
      importSelection: makeImportSelection({
        extraction,
        selectedSections: selectedPages,
        kind: 'pages',
        start,
        end
      })
    };
  }

  const chunks = makePromptChunks(extraction, modelMaxCharacters(options));
  const start = requested.chunkStart || 1;
  const end = requested.chunkEnd || Math.min(chunks.length, start + Math.max(0, previewMaxPages(options) - 1));
  const selectedChunks = chunks.filter((chunk) => chunk.index >= start && chunk.index <= end);
  if (!selectedChunks.length) {
    return {
      success: false,
      errors: [`No extracted text was found for selected chunks ${start}-${end}. Try a chunk with text.`]
    };
  }
  const selectedSections = selectedChunks.map((chunk) => ({
    label: chunk.label,
    sourceLocation: chunk.sourceLocation,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text
  }));
  const importSelection = makeImportSelection({
    extraction,
    selectedSections,
    kind: 'chunks',
    start,
    end
  });
  return {
    success: true,
    extraction: makeRangeExtraction(extraction, selectedSections, importSelection),
    importSelection
  };
}

function normalizeSelectionRequest(options = {}) {
  const selection = options.importSelection && typeof options.importSelection === 'object'
    ? options.importSelection
    : {};
  const pageRange = firstNonEmptyString(options.pageRange, selection.pageRange, selection.pages);
  const rangeMatch = String(pageRange || '').match(/(\d+)\s*(?:-|–|to)\s*(\d+)/i)
    || String(pageRange || '').match(/^\s*(\d+)\s*$/);
  const pageStart = positiveInteger(
    options.pageStart || options.importPageStart || selection.pageStart || selection.startPage || (rangeMatch && rangeMatch[1]),
    0
  );
  const pageEnd = positiveInteger(
    options.pageEnd || options.importPageEnd || selection.pageEnd || selection.endPage || (rangeMatch && (rangeMatch[2] || rangeMatch[1])),
    0
  );
  const chunkStart = positiveInteger(options.chunkStart || options.importChunkStart || selection.chunkStart || selection.startChunk, 0);
  const chunkEnd = positiveInteger(options.chunkEnd || options.importChunkEnd || selection.chunkEnd || selection.endChunk, 0);
  return {
    pageStart,
    pageEnd: pageEnd || pageStart,
    chunkStart,
    chunkEnd: chunkEnd || chunkStart
  };
}

function makeRangeExtraction(extraction, selectedSections, importSelection) {
  return {
    ...extraction,
    text: selectedSections.map((section) => section.text).join('\n\n'),
    pages: importSelection.kind === 'pages' ? selectedSections : undefined,
    sections: selectedSections.map((section, index) => ({
      label: section.label || section.sourceLocation || `Chunk ${index + 1}`,
      sourceLocation: section.sourceLocation || section.label || `Chunk ${index + 1}`,
      pageNumber: section.pageNumber,
      chunkIndex: section.chunkIndex || index + 1,
      text: section.text
    })),
    metadata: {
      ...(extraction.metadata || {}),
      pageCount: importSelection.pageCount,
      chunkCount: importSelection.chunkCount,
      partialImport: true,
      importSelection,
      originalPageCount: importSelection.originalPageCount,
      originalCharacterCount: importSelection.originalCharacterCount,
      originalChunkCount: importSelection.originalChunkCount
    }
  };
}

function makePreviewImportSelection(extraction, originalExtraction, selectedImportSelection) {
  if (selectedImportSelection) {
    const pageLabel = selectedImportSelection.pageRangeLabel || formatNumberRange(selectedImportSelection.pages || []);
    const chunkLabel = selectedImportSelection.chunkRangeLabel || formatNumberRange(selectedImportSelection.chunks || []);
    return {
      ...selectedImportSelection,
      kind: 'preview',
      label: pageLabel ? `Preview pages ${pageLabel}` : `Preview chunks ${chunkLabel}`,
      completePacketImported: false
    };
  }
  const sections = makePromptSections(extraction);
  return makeImportSelection({
    extraction: originalExtraction,
    selectedSections: sections,
    kind: 'preview',
    start: 1,
    end: sections.length
  });
}

function makeImportSelection({ extraction, selectedSections, kind, start, end }) {
  const pages = Array.from(new Set(selectedSections
    .map((section) => Number(section.pageNumber || section.page || 0))
    .filter((page) => Number.isFinite(page) && page > 0))).sort((a, b) => a - b);
  const chunks = selectedSections.map((section, index) => Number(section.chunkIndex || section.index || index + 1));
  const characterCount = selectedSections.reduce((sum, section) => sum + String(section.text || '').length, 0);
  const pageRangeLabel = pages.length ? formatNumberRange(pages) : '';
  const chunkRangeLabel = chunks.length ? formatNumberRange(chunks) : '';
  const label = kind === 'pages' && pageRangeLabel
    ? `Pages ${pageRangeLabel}`
    : kind === 'preview' && pageRangeLabel
      ? `Preview pages ${pageRangeLabel}`
      : `Chunks ${chunkRangeLabel || `${start}-${end}`}`;
  return {
    kind,
    label,
    pages,
    chunks,
    pageRangeLabel,
    chunkRangeLabel,
    pageCount: pages.length || Number(extraction && extraction.metadata && extraction.metadata.pageCount || selectedSections.length || 0),
    chunkCount: selectedSections.length,
    characterCount,
    originalPageCount: estimatePageCount(extraction),
    originalChunkCount: makePromptChunks(extraction, DEFAULT_BATCH_MAX_CHARACTERS).length,
    originalCharacterCount: String(extraction && extraction.text || '').length,
    completePacketImported: false
  };
}

function formatNumberRange(values) {
  const unique = Array.from(new Set(values.map(Number).filter((value) => Number.isFinite(value)))).sort((a, b) => a - b);
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

function formatDisplayPageRange(values) {
  const unique = Array.from(new Set((Array.isArray(values) ? values : []).map(Number).filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
  if (unique.length === 1) return `${unique[0]}-${unique[0]}`;
  return formatNumberRange(unique);
}

function makePromptChunks(extraction, maxChunkCharacters) {
  const sections = makePromptSections(extraction);
  const chunks = [];

  sections.forEach((section, sectionIndex) => {
    const label = firstNonEmptyString(section.label, section.sourceLocation, `Chunk ${sectionIndex + 1}`);
    const text = String(section.text || '');
    if (text.length <= maxChunkCharacters) {
      chunks.push(makePromptChunk({
        section,
        label,
        text,
        chunkIndex: chunks.length + 1
      }));
      return;
    }

    splitLongText(text, maxChunkCharacters).forEach((part, partIndex) => {
      chunks.push(makePromptChunk({
        section,
        label: `${label} / Chunk ${partIndex + 1}`,
        text: part,
        chunkIndex: chunks.length + 1
      }));
    });
  });

  return chunks;
}

function makePromptSections(extraction) {
  const pageSections = makePageSections(extraction);
  if (pageSections.length > 0) return pageSections;
  const sections = Array.isArray(extraction.sections) && extraction.sections.length > 0
    ? extraction.sections
    : [{ label: 'Full Text', sourceLocation: 'Full Text', text: extraction.text || '' }];
  return sections.map((section, index) => ({
    ...section,
    label: firstNonEmptyString(section.label, section.sourceLocation, `Chunk ${index + 1}`),
    sourceLocation: firstNonEmptyString(section.sourceLocation, section.label, `Chunk ${index + 1}`)
  }));
}

function makePageSections(extraction) {
  const pages = Array.isArray(extraction && extraction.pages)
    ? extraction.pages
    : Array.isArray(extraction && extraction.metadata && extraction.metadata.pages)
      ? extraction.metadata.pages
      : [];
  if (pages.length > 0) {
    return pages
      .map((page, index) => {
        const pageNumber = Number(page.pageNumber || page.number || page.num || index + 1);
        const text = String(page.text || page.content || '');
        return {
          label: `Page ${pageNumber}`,
          sourceLocation: `Page ${pageNumber}`,
          pageNumber,
          text
        };
      })
      .filter((page) => page.text.trim().length > 0);
  }

  return splitTextByPageMarkers(extraction);
}

function identifyTextBearingPages(extraction) {
  const candidates = [];
  const addCandidate = (pageNumber, text) => {
    const parsed = Number(pageNumber);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    if (!String(text || '').trim()) return;
    candidates.push(Math.floor(parsed));
  };

  const pages = Array.isArray(extraction && extraction.pages)
    ? extraction.pages
    : Array.isArray(extraction && extraction.metadata && extraction.metadata.pages)
      ? extraction.metadata.pages
      : [];
  pages.forEach((page, index) => addCandidate(page.pageNumber || page.number || page.num || index + 1, page.text || page.content));

  const sections = Array.isArray(extraction && extraction.sections) ? extraction.sections : [];
  sections.forEach((section) => addCandidate(section.pageNumber || section.page || section.pageIndex, section.text || section.content));

  const pageSections = makePageSections(extraction);
  pageSections.forEach((page) => addCandidate(page.pageNumber, page.text));

  const unique = Array.from(new Set(candidates)).sort((a, b) => a - b);
  return {
    pages: unique,
    firstTextPage: unique[0] || null,
    pageCount: estimatePageCount(extraction)
  };
}

function splitTextByPageMarkers(extraction) {
  const text = String(extraction && extraction.text || '');
  const pageCount = Number(extraction && extraction.metadata && extraction.metadata.pageCount || 0);
  if (!text.trim() || pageCount < 2) return [];

  const pattern = /(?:^|\n)([^\n]{0,80}?\b(?:Page|Pg\.?|p\.)\s*(\d{1,4})\b[^\n]*|[^\n]{0,120}?\b(\d{1,4})\s*)\n/g;
  const markers = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const pageNumber = Number(match[2] || match[3]);
    if (!Number.isFinite(pageNumber) || pageNumber < 1 || pageNumber > pageCount) continue;
    if (markers.length && pageNumber <= markers[markers.length - 1].pageNumber) continue;
    const markerStart = match.index + (match[0].startsWith('\n') ? 1 : 0);
    const markerEnd = pattern.lastIndex;
    markers.push({ pageNumber, markerStart, markerEnd });
  }

  if (markers.length < Math.max(2, Math.floor(pageCount * 0.5))) return [];
  return markers.map((marker, index) => {
    const nextMarker = markers[index + 1];
    return {
      label: `Page ${marker.pageNumber}`,
      sourceLocation: `Page ${marker.pageNumber}`,
      pageNumber: marker.pageNumber,
      text: text.slice(marker.markerStart, nextMarker ? nextMarker.markerStart : text.length).trim()
    };
  }).filter((page) => page.text.length > 0);
}

function makePromptChunk({ section, label, text, chunkIndex }) {
  return {
    id: `chunk-${chunkIndex}`,
    index: chunkIndex,
    label,
    page: Number(section.pageNumber || 0),
    text,
    sourceLocation: label,
    pageNumber: section.pageNumber,
    chunkIndex,
    sourceFile: section.sourceFile,
    sourceSnippet: makeSourceTextSnippet(text)
  };
}

function splitLongText(text, maxLength) {
  const parts = [];
  let cursor = 0;
  while (cursor < text.length) {
    const nextHardLimit = Math.min(cursor + maxLength, text.length);
    let next = nextHardLimit;
    if (nextHardLimit < text.length) {
      const paragraphBreak = text.lastIndexOf('\n\n', nextHardLimit);
      const sentenceBreak = text.lastIndexOf('. ', nextHardLimit);
      const candidate = Math.max(paragraphBreak, sentenceBreak);
      if (candidate > cursor + Math.floor(maxLength * 0.5)) next = candidate + 1;
    }
    parts.push(text.slice(cursor, next).trim());
    cursor = next;
  }
  return parts.filter((part) => part.length > 0);
}

function makeBatchExtraction(extraction, chunks, batchIndex, totalBatches) {
  const batchSections = chunks.map((chunk) => ({
    label: chunk.label,
    sourceLocation: chunk.sourceLocation,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    sourceSnippet: chunk.sourceSnippet,
    text: chunk.text
  }));

  return {
    ...extraction,
    text: chunks.map((chunk) => `[${chunk.label}]\n${chunk.text}`).join('\n\n'),
    sections: batchSections,
    metadata: {
      ...(extraction.metadata || {}),
      importBatch: {
        batchIndex,
        totalBatches,
        chunkLabels: chunks.map((chunk) => chunk.label)
      }
    }
  };
}

async function retryBatchWithSmallerChunks({
  originalBatch,
  retryBatches,
  totalBatches,
  standardsBank,
  packName,
  model,
  modelClient,
  timeoutMs,
  keepAlive,
  retryInvalidJson,
  options,
  importScope,
  recordProgress
}) {
  const parsedModelResponses = [];
  const rawModelResponses = [];
  const packs = [];

  for (const retryBatch of retryBatches) {
    const prompt = buildKnowledgePackPrompt({
      extraction: retryBatch.extraction,
      standardsBank,
      packName,
      batchInfo: {
        batchIndex: originalBatch.batchIndex,
        totalBatches
      }
    });
    recordProgress('batch_retry_sent', `Retrying batch ${originalBatch.batchIndex} with smaller chunk ${retryBatch.retryIndex} of ${retryBatches.length}`, {
      batchIndex: originalBatch.batchIndex,
      totalBatches,
      retryIndex: retryBatch.retryIndex,
      retryTotal: retryBatches.length,
      characterCount: String(retryBatch.extraction.text || '').length,
      chunkCount: retryBatch.chunks.length,
      chunkLabels: retryBatch.chunks.map((chunk) => chunk.label)
    });

    const retryResult = await generateBatchDraft({
      batch: retryBatch,
      model,
      prompt,
      modelClient,
      timeoutMs,
      keepAlive,
      retryInvalidJson,
      options
    });
    rawModelResponses.push(...normalizeRawResponses(retryResult.rawModelResponse));
    if (!retryResult.success) {
      const failedBatch = makeFailedBatchWarning(retryBatch, retryResult.errors);
      return {
        ...retryResult,
        rawModelResponse: rawModelResponses,
        errors: makeModelBatchErrors(originalBatch, totalBatches, retryResult.errors, true, {
          model,
          previewMaxCharacters: previewMaxCharacters(options),
          previewOnly: options.previewOnly === true || options.importMode === 'preview'
        }),
        failedBatches: [failedBatch]
      };
    }

    parsedModelResponses.push(retryResult.parsedModelResponse);
    packs.push(normalizeDraftKnowledgePack(retryResult.parsedModelResponse, {
      extraction: retryBatch.extraction,
      packName,
      importScope
    }));
    recordProgress('batch_retry_received', `Received retry draft items for batch ${originalBatch.batchIndex}, smaller chunk ${retryBatch.retryIndex} of ${retryBatches.length}`, {
      batchIndex: originalBatch.batchIndex,
      totalBatches,
      retryIndex: retryBatch.retryIndex,
      retryTotal: retryBatches.length,
      itemCounts: countGeneratedItems(packs[packs.length - 1])
    });
  }

  const merged = packs.length === 1
    ? packs[0]
    : mergeDraftKnowledgePacks(packs, { extraction: originalBatch.extraction, packName, importScope });

  return {
    success: true,
    rawModelResponse: rawModelResponses,
    parsedModelResponse: merged,
    retrySucceeded: true,
    retryBatches
  };
}

function buildRetryBatchesForBatch(batch, options = {}) {
  const retryMaxCharacters = positiveInteger(options.retryMaxCharacters, DEFAULT_RETRY_BATCH_MAX_CHARACTERS);
  const retryChunks = [];
  batch.chunks.forEach((chunk) => {
    if (String(chunk.text || '').length <= retryMaxCharacters) {
      retryChunks.push(chunk);
      return;
    }
    splitLongText(chunk.text, retryMaxCharacters).forEach((part, partIndex) => {
      retryChunks.push({
        ...chunk,
        id: `retry-${chunk.id}-${partIndex + 1}`,
        label: `${chunk.label} / Retry Chunk ${partIndex + 1}`,
        sourceLocation: `${chunk.sourceLocation || chunk.label} / Retry Chunk ${partIndex + 1}`,
        text: part,
        sourceSnippet: makeSourceTextSnippet(part)
      });
    });
  });

  if (retryChunks.length === batch.chunks.length && retryChunks.every((chunk, index) => chunk === batch.chunks[index])) {
    return [];
  }

  const retryBatches = [];
  let current = [];
  let currentCharacters = 0;
  retryChunks.forEach((chunk) => {
    const chunkCharacters = String(chunk.text || '').length;
    if (current.length > 0 && currentCharacters + chunkCharacters > retryMaxCharacters) {
      retryBatches.push(current);
      current = [];
      currentCharacters = 0;
    }
    current.push(chunk);
    currentCharacters += chunkCharacters;
  });
  if (current.length > 0) retryBatches.push(current);

  return retryBatches.map((chunks, index) => ({
    ...batch,
    batchIndex: batch.batchIndex,
    retryIndex: index + 1,
    chunks,
    extraction: makeBatchExtraction(batch.extraction, chunks, batch.batchIndex, batch.extraction.metadata?.importBatch?.totalBatches || 1)
  }));
}

function mergeDraftKnowledgePacks(packs, options = {}) {
  const base = normalizeDraftKnowledgePack({ ...(packs[0] || {}) }, options);
  GENERATED_ITEM_SECTIONS.forEach((sectionName) => {
    base[sectionName] = [];
  });

  base.sourceFiles = mergeUniqueObjects(packs.flatMap((pack) => pack.sourceFiles || []), sourceFileKey);
  const vocabularyRaw = packs.flatMap((pack) => pack.vocabulary || []);
  const conceptsRaw = packs.flatMap((pack) => pack.concepts || []);
  const problemsRaw = packs.flatMap((pack) => pack.problemBank || []);
  base.vocabulary = mergeVocabularyItems(vocabularyRaw);
  base.concepts = mergeUniqueObjects(conceptsRaw, conceptKey);
  base.referenceFormulas = mergeUniqueObjects(packs.flatMap((pack) => pack.referenceFormulas || []), formulaKey);
  base.problemBank = mergeUniqueObjects(problemsRaw, problemKey);
  base.standardsMap = mergeUniqueObjects(packs.flatMap((pack) => pack.standardsMap || []), standardsMapKey);
  base.smokeTests = mergeUniqueObjects(packs.flatMap((pack) => pack.smokeTests || []), smokeTestKey);
  base.metadata = {
    ...(base.metadata || {}),
    importBatches: packs.length,
    importScope: options.importScope || base.metadata && base.metadata.importScope,
    deduplication: {
      vocabulary: makeDeduplicationStats(vocabularyRaw.length, base.vocabulary.length),
      concepts: makeDeduplicationStats(conceptsRaw.length, base.concepts.length),
      problemBank: makeDeduplicationStats(problemsRaw.length, base.problemBank.length)
    }
  };

  const packName = sanitizePackName(options.packName);
  if (packName) base.title = packName;
  return base;
}

function makeDeduplicationStats(raw, final) {
  return {
    raw,
    duplicatesRemoved: Math.max(0, raw - final),
    final
  };
}

function mergeUniqueObjects(items, makeKey) {
  const seen = new Map();
  const merged = [];
  items.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const key = makeKey(item);
    if (key && seen.has(key)) {
      mergeSourceEvidence(merged[seen.get(key)], item);
      return;
    }
    if (key) seen.set(key, merged.length);
    merged.push(item);
  });
  return merged;
}

function mergeVocabularyItems(items) {
  const seen = new Map();
  const merged = [];
  items.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const keys = vocabularyKeys(item);
    const existingIndex = keys.map((key) => seen.get(key)).find((index) => Number.isInteger(index));
    if (Number.isInteger(existingIndex)) {
      mergeVocabularyDuplicate(merged[existingIndex], item);
      vocabularyKeys(merged[existingIndex]).forEach((key) => seen.set(key, existingIndex));
      return;
    }
    const nextIndex = merged.length;
    keys.forEach((key) => seen.set(key, nextIndex));
    merged.push(item);
  });
  return merged;
}

function sourceFileKey(item) {
  return normalizeKey(item.fileName);
}

function vocabularyKey(item) {
  return canonicalVocabularyKey(item.term);
}

function conceptKey(item) {
  return normalizeItemKey(firstNonEmptyString(item.title, item.claim, item.conceptId));
}

function formulaKey(item) {
  return normalizeKey(firstNonEmptyString(item.formulaId, item.title, item.equation));
}

function problemKey(item) {
  return normalizeItemKey(firstNonEmptyString(item.question, item.problemId));
}

function standardsMapKey(item) {
  return normalizeKey(item.standardId);
}

function smokeTestKey(item) {
  return normalizeKey(item.question);
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeItemKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalVocabularyKey(value) {
  const normalized = normalizeItemKey(stripParentheticalAlias(String(value || '')));
  if (!normalized) return '';
  const parts = normalized.split(' ');
  parts[parts.length - 1] = singularizeSimpleWord(parts[parts.length - 1]);
  return parts.join(' ');
}

function vocabularyKeys(item) {
  const values = [
    item && item.term,
    ...(Array.isArray(item && item.aliases) ? item.aliases : [])
  ];
  return Array.from(new Set(values.map(canonicalVocabularyKey).filter(Boolean)));
}

function singularizeSimpleWord(word) {
  const value = String(word || '').trim();
  if (value.length <= 3) return value;
  if (/ies$/i.test(value) && value.length > 4) return `${value.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|sses)$/i.test(value) && value.length > 5) return value.slice(0, -2);
  if (/s$/i.test(value) && !/(ss|us|is)$/i.test(value)) return value.slice(0, -1);
  return value;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function modelMaxCharacters(options = {}) {
  if (options.previewOnly === true || options.importMode === 'preview') {
    return previewMaxCharacters(options);
  }
  return positiveInteger(options.maxBatchCharacters || process.env.IMPORT_MODEL_MAX_CHARS, DEFAULT_BATCH_MAX_CHARACTERS);
}

function modelRetryMaxCharacters(options = {}) {
  const configured = positiveInteger(options.retryMaxBatchCharacters || options.retryMaxCharacters || process.env.IMPORT_MODEL_RETRY_MAX_CHARS, DEFAULT_RETRY_BATCH_MAX_CHARACTERS);
  return Math.min(configured, Math.max(1, Math.floor(modelMaxCharacters(options) / 2)));
}

function previewMaxPages(options = {}) {
  return positiveInteger(options.previewMaxPages || process.env.IMPORT_PREVIEW_MAX_PAGES, DEFAULT_PREVIEW_MAX_PAGES);
}

function previewMaxCharacters(options = {}) {
  return positiveInteger(options.previewMaxCharacters || process.env.IMPORT_PREVIEW_MAX_CHARS, DEFAULT_PREVIEW_MAX_CHARACTERS);
}

function isUltraSafePreview(options = {}) {
  const mode = String(options.previewMode || options.previewSize || '').trim().toLowerCase();
  return mode === 'ultra-safe' || mode === 'ultrasafe' || mode === 'ultra_safe';
}

function previewModeLabel(options = {}) {
  if (isUltraSafePreview(options)) return 'Ultra-safe';
  const mode = String(options.previewMode || options.previewSize || '').trim().toLowerCase();
  if (mode === 'custom') return 'Custom';
  return 'Normal';
}

function fullImportRequiresConfirmation(options = {}) {
  const value = options.fullImportRequiresConfirmation ?? process.env.IMPORT_FULL_REQUIRES_CONFIRMATION;
  if (value === undefined || value === null || value === '') return DEFAULT_FULL_REQUIRES_CONFIRMATION;
  return !['false', '0', 'no'].includes(String(value).trim().toLowerCase());
}

function makeDeterministicModelOptions(options = {}) {
  return {
    temperature: numberOrDefault(options.temperature ?? process.env.IMPORT_MODEL_TEMPERATURE, DEFAULT_MODEL_TEMPERATURE),
    seed: positiveInteger(options.seed ?? process.env.IMPORT_MODEL_SEED, DEFAULT_MODEL_SEED),
    top_p: numberOrDefault(options.topP ?? options.top_p ?? process.env.IMPORT_MODEL_TOP_P, DEFAULT_MODEL_TOP_P),
    top_k: positiveInteger(options.topK ?? options.top_k ?? process.env.IMPORT_MODEL_TOP_K, DEFAULT_MODEL_TOP_K)
  };
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildImportInputSnapshot({ uploadId, importSelection, importScope, model, modelSettings, sourceChunks }) {
  const chunks = (Array.isArray(sourceChunks) ? sourceChunks : []).map((chunk) => ({
    index: Number(chunk.index || chunk.chunkIndex || 0),
    label: String(chunk.label || chunk.sourceLocation || ''),
    pageNumber: Number(chunk.pageNumber || chunk.page || 0),
    hash: hashText(chunk.text || '')
  }));
  return {
    uploadId: String(uploadId || ''),
    promptVersion: PROMPT_VERSION,
    model,
    modelSettings,
    importSelection: importSelection || null,
    importScope: importScope || null,
    chunkTextHashes: chunks
  };
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function importSafetyThresholds(options = {}) {
  return {
    largeCharacterCount: positiveInteger(options.largeImportCharacterCount || process.env.IMPORT_LARGE_CHAR_LIMIT, DEFAULT_LARGE_IMPORT_CHARACTERS),
    largePageCount: positiveInteger(options.largeImportPageCount || process.env.IMPORT_LARGE_PAGE_LIMIT, DEFAULT_LARGE_IMPORT_PAGES),
    largeBatchCount: positiveInteger(options.largeImportBatchCount || process.env.IMPORT_LARGE_BATCH_LIMIT, DEFAULT_LARGE_IMPORT_BATCHES),
    hardStopCharacterCount: positiveInteger(options.hardStopCharacterCount || process.env.IMPORT_HARD_STOP_CHAR_LIMIT, DEFAULT_HARD_STOP_CHARACTERS),
    hardStopPageCount: positiveInteger(options.hardStopPageCount || process.env.IMPORT_HARD_STOP_PAGE_LIMIT, DEFAULT_HARD_STOP_PAGES),
    hardStopBatchCount: positiveInteger(options.hardStopBatchCount || process.env.IMPORT_HARD_STOP_BATCH_LIMIT, DEFAULT_HARD_STOP_BATCHES)
  };
}

function estimatePageCount(extraction) {
  const explicit = Number(extraction && extraction.metadata && extraction.metadata.pageCount || 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  const pages = Array.isArray(extraction && extraction.pages)
    ? extraction.pages
    : Array.isArray(extraction && extraction.metadata && extraction.metadata.pages)
      ? extraction.metadata.pages
      : [];
  return pages.length;
}

function shouldRetryModelCrash(result) {
  return Boolean(result && (result.modelCrash || (result.errors || []).some((error) => isModelCrashMessage(error))));
}

function isModelCrashError(error) {
  return isModelCrashMessage(error && error.message);
}

function isModelCrashMessage(value) {
  const message = String(value || '').toLowerCase();
  return message.includes('ollama returned http 500')
    || message.includes('model runner has unexpectedly stopped')
    || message.includes('resource limitations')
    || message.includes('internal error');
}

function makeModelBatchErrors(batch, totalBatches, underlyingErrors = [], afterRetry = false, context = {}) {
  const batchIndex = batch && batch.batchIndex || 1;
  const total = Number(totalBatches || batch && batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches || 1);
  const labels = Array.isArray(batch && batch.chunks) ? batch.chunks.map((chunk) => chunk.label).filter(Boolean) : [];
  const pageLabels = labels.length ? ` Affected source chunks/pages: ${labels.join(', ')}.` : '';
  const retryText = afterRetry
    ? ' It still failed after Charlemagne retried with smaller chunks.'
    : ' Charlemagne will retry with smaller chunks when possible; if this keeps happening, use a smaller batch size or a lighter local model.';
  const original = underlyingErrors.map((error) => String(error || '').trim()).filter(Boolean).join('; ');
  const previewLimitText = context.previewOnly ? ` Current preview character limit: ${previewMaxCharacters({ previewMaxCharacters: context.previewMaxCharacters })}.` : '';
  const modelText = context.model ? ` Current model: ${context.model}.` : '';
  return [
    `Local Gemma crashed. This is usually a model/runtime resource issue, not a PDF issue. Try ultra-safe preview, a smaller model, or a lower preview character limit.${modelText}${previewLimitText} Gemma crashed while reading batch ${batchIndex} of ${total}. The batch may be too large for the local model.${retryText}${pageLabels}`,
    original ? `Ollama detail for batch ${batchIndex}: ${original}` : ''
  ].filter(Boolean);
}

function makeFailedBatchWarning(batch, errors = []) {
  return {
    batchIndex: batch && batch.batchIndex || 1,
    retryIndex: batch && batch.retryIndex,
    chunkLabels: Array.isArray(batch && batch.chunks) ? batch.chunks.map((chunk) => chunk.label).filter(Boolean) : [],
    pages: Array.from(new Set((Array.isArray(batch && batch.chunks) ? batch.chunks : [])
      .map((chunk) => Number(chunk.pageNumber || chunk.page || 0))
      .filter((page) => Number.isFinite(page) && page > 0))),
    characterCount: String(batch && batch.extraction && batch.extraction.text || '').length,
    errors: Array.isArray(errors) ? errors : [String(errors || '')]
  };
}

function normalizeRawResponses(rawModelResponse) {
  if (rawModelResponse === undefined || rawModelResponse === null) return [];
  return Array.isArray(rawModelResponse) ? rawModelResponse : [rawModelResponse];
}

async function callOllamaGenerate({
  model,
  prompt,
  ollamaUrl = DEFAULT_OLLAMA_URL,
  timeoutMs = DEFAULT_OLLAMA_TIMEOUT_MS,
  keepAlive = DEFAULT_OLLAMA_KEEP_ALIVE,
  options = {}
}) {
  const url = new URL(ollamaUrl);
  if (!isLocalhost(url.hostname)) {
    throw new Error(`Refusing to call non-local Ollama host: ${url.hostname}`);
  }

  const responseText = await postJson(url, {
    model,
    prompt,
    stream: false,
    format: 'json',
    keep_alive: keepAlive,
    options: {
      ...makeDeterministicModelOptions(options),
      ...(options && typeof options === 'object' ? options : {})
    }
  }, { timeoutMs });
  const parsed = JSON.parse(responseText);
  if (typeof parsed.response !== 'string') {
    throw new Error('Ollama response did not include a response string.');
  }
  return parsed.response;
}

function postJson(url, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = Number(options.timeoutMs || DEFAULT_OLLAMA_TIMEOUT_MS);
    const body = JSON.stringify(payload);
    const request = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: timeoutMs
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Ollama returned HTTP ${response.statusCode}: ${data}`));
          return;
        }
        resolve(data);
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Ollama request timed out. This can happen when the model is cold-loading. Try again, warm the model with `ollama run gemma4:e2b`, or increase --timeout-ms.'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function parseModelResponse(rawModelResponse) {
  const raw = typeof rawModelResponse === 'string'
    ? rawModelResponse
    : rawModelResponse && typeof rawModelResponse.response === 'string'
      ? rawModelResponse.response
      : JSON.stringify(rawModelResponse);
  const cleanedResult = normalizeJsonResponse(raw || '');

  if (!cleanedResult.success) {
    return {
      success: false,
      errors: cleanedResult.errors.map((error) => `Model response was not valid JSON: ${error}`)
    };
  }

  try {
    return {
      success: true,
      value: JSON.parse(cleanedResult.value)
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Model response was not valid JSON: ${error.message}`]
    };
  }
}

function normalizeJsonResponse(value) {
  const trimmed = stripJsonFence(String(value || '')).trim();
  if (trimmed.length === 0) {
    return {
      success: false,
      errors: ['Model response was empty and not valid JSON.']
    };
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return {
      success: true,
      value: trimmed
    };
  }

  const extracted = extractSingleJsonObject(trimmed);
  if (!extracted.success) {
    return extracted;
  }

  return {
    success: true,
    value: extracted.value
  };
}

function stripJsonFence(value) {
  const trimmed = String(value || '').trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function extractSingleJsonObject(value) {
  const matches = [];
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      if (depth === 0) startIndex = index;
      depth += 1;
      continue;
    }

    if (character === '}') {
      if (depth === 0) {
        return {
          success: false,
          errors: ['Model response included an unmatched closing brace and was not valid JSON.']
        };
      }

      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        matches.push(value.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  if (depth !== 0 || inString) {
    return {
      success: false,
      errors: ['Model response did not contain a complete JSON object.']
    };
  }

  if (matches.length !== 1) {
    return {
      success: false,
      errors: [`Model response must contain exactly one JSON object; found ${matches.length}.`]
    };
  }

  return {
    success: true,
    value: matches[0]
  };
}

function buildJsonRepairPrompt(rawModelResponse) {
  return [
    'Convert the following attempted response into valid JSON matching the required schema.',
    'Return JSON only. Do not add new facts.',
    '',
    'Attempted response:',
    String(rawModelResponse || '')
  ].join('\n');
}

function normalizeDraftKnowledgePack(pack, options = {}) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return pack;

  const normalized = { ...pack };
  const sourceDefaults = makeSourceDefaults(options.extraction);
  const packName = sanitizePackName(options.packName);
  const safePackId = makeDraftPackId({
    packName,
    extraction: options.extraction,
    fallbackPackId: normalized.packId
  });

  normalized.schemaVersion = DEFAULT_SCHEMA_VERSION;
  normalized.packId = safePackId;
  if (typeof normalized.version !== 'string' || normalized.version.trim().length === 0) {
    normalized.version = DEFAULT_DRAFT_VERSION;
  }

  if (packName) {
    normalized.title = packName;
  }
  if (!nonEmptyString(normalized.title)) normalized.title = titleFromPackId(safePackId);
  normalized.subject = sanitizeModelString(normalized.subject) || sourceDefaults.subject || 'Teacher Uploaded Content';
  normalized.gradeLevel = sanitizeModelString(normalized.gradeLevel) || sourceDefaults.gradeLevel || 'Teacher Review';
  normalized.status = 'draft';
  normalized.reviewStatus = 'pending';

  GENERATED_ITEM_SECTIONS.forEach((sectionName) => {
    if (!Array.isArray(normalized[sectionName])) {
      normalized[sectionName] = [];
    }
  });

  if (!normalized.metadata || typeof normalized.metadata !== 'object' || Array.isArray(normalized.metadata)) {
    normalized.metadata = {};
  }
  normalized.metadata = buildSafeDraftMetadata(normalized.metadata, {
    extraction: options.extraction,
    packName,
    packId: safePackId,
    sourceDefaults,
    importScope: options.importScope
  });

  normalized.sourceFiles = normalizeSourceFiles(normalized.sourceFiles, options.extraction, sourceDefaults);
  normalized.vocabulary = normalized.vocabulary.map((item, index) => normalizeVocabularyItem(item, sourceDefaults, index));
  normalized.concepts = normalized.concepts.map((item, index) => normalizeConceptItem(item, sourceDefaults, index));
  normalized.referenceFormulas = normalized.referenceFormulas.map((item) => normalizeReferenceFormula(item, sourceDefaults));
  addSourceDerivedReferenceFormulas(normalized, options.extraction, sourceDefaults);
  normalized.problemBank = normalized.problemBank.map((item, index) => normalizeProblemItem(item, sourceDefaults, index));
  normalized.standardsMap = normalized.standardsMap.map((item, index) => normalizeStandardsMapItem(item, index));
  normalized.smokeTests = normalized.smokeTests.map((item, index) => normalizeSmokeTest(item, index));
  normalized.metadata.deduplication = dedupeDraftItems(normalized);
  normalized.metadata.importNormalization = buildImportNormalizationReport(normalized);

  return normalized;
}

function normalizeSourceFiles(sourceFiles, extraction, sourceDefaults) {
  const normalized = sourceFiles.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return normalizeReviewFields({
      ...item,
      uploadId: sourceDefaults.uploadId,
      storedFileName: sourceDefaults.storedFileName,
      extractionJsonFileName: sourceDefaults.extractionJsonFileName,
      characterCount: sourceDefaults.characterCount,
      pageCount: sourceDefaults.pageCount,
      chunkCount: sourceDefaults.chunkCount,
      fileType: typeof item.fileType === 'string' && item.fileType.trim()
        ? item.fileType
        : sourceDefaults.fileType
    });
  });

  if (sourceDefaults.sourceFile && !normalized.some((item) => {
    return item && typeof item === 'object' && !Array.isArray(item) && item.fileName === sourceDefaults.sourceFile;
  })) {
    normalized.push({
      fileName: sourceDefaults.sourceFile,
      fileType: sourceDefaults.fileType,
      uploadId: sourceDefaults.uploadId,
      storedFileName: sourceDefaults.storedFileName,
      extractionJsonFileName: sourceDefaults.extractionJsonFileName,
      characterCount: sourceDefaults.characterCount,
      pageCount: sourceDefaults.pageCount,
      chunkCount: sourceDefaults.chunkCount,
      reviewStatus: 'pending',
      confidence: 'low',
      notes: 'Added from extraction metadata for draft traceability.'
    });
  }

  return normalized;
}

function normalizeVocabularyItem(item, sourceDefaults, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = { ...item };
  const aliasResult = normalizeTermAliases({
    label: normalized.term,
    aliases: [normalized.alias, normalized.aliases, normalized.synonym, normalized.synonyms],
    sourceTextSnippet: normalized.sourceTextSnippet || normalized.sourceSnippet
  });
  if (aliasResult.label) normalized.term = aliasResult.label;
  normalized.aliases = aliasResult.aliases;
  if (!nonEmptyString(normalized.term)) {
    const derivedTerm = deriveShortTitle([
      normalized.synonym,
      normalized.synonyms,
      normalized.alias,
      normalized.aliases,
      normalized.word,
      normalized.title,
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ]);
    if (derivedTerm) {
      normalized.term = derivedTerm;
      normalized = addNormalizationNote(normalized, 'Generated vocabulary term during import normalization from model/source text.');
    }
  }
  if (!nonEmptyString(normalized.vocabId) && nonEmptyString(normalized.term)) {
    normalized.vocabId = makeGeneratedItemId('vocab', [normalized.term], index, sourceDefaults);
    normalized = addNormalizationNote(normalized, 'Generated vocabulary ID during import normalization.');
  }
  return normalizeSourceTracking(normalizeReviewFields({
    ...normalized,
    aliases: normalizeAliasList(normalized.aliases, normalized.term),
    standards: Array.isArray(normalized.standards) ? normalized.standards : []
  }), sourceDefaults);
}

function normalizeConceptItem(item, sourceDefaults, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = { ...item };
  const aliasResult = normalizeTermAliases({
    label: normalized.title,
    aliases: [normalized.alias, normalized.aliases],
    sourceTextSnippet: normalized.sourceTextSnippet || normalized.sourceSnippet
  });
  if (aliasResult.label) normalized.title = aliasResult.label;
  normalized.aliases = aliasResult.aliases;
  if (!nonEmptyString(normalized.title)) {
    const derivedTitle = deriveShortTitle([
      normalized.title,
      normalized.concept,
      normalized.claim,
      normalized.summary,
      normalized.explanation,
      normalized.studentExplanation,
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ]);
    if (derivedTitle) {
      normalized.title = derivedTitle;
      normalized = addNormalizationNote(normalized, 'Generated concept title during import normalization from model/source text.');
    }
  }
  if (!nonEmptyString(normalized.conceptId)) {
    normalized.conceptId = makeGeneratedItemId('concept', [
      normalized.title,
      normalized.concept,
      normalized.claim,
      normalized.summary,
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ], index, sourceDefaults);
    normalized = addNormalizationNote(normalized, 'Generated concept ID during import normalization.');
  }
  ['aliases', 'keyIdeas', 'examples', 'nonExamples', 'commonMisconceptions', 'standards'].forEach((field) => {
    if (!Array.isArray(normalized[field])) normalized[field] = [];
  });
  return normalizeSourceTracking(normalizeReviewFields(normalized), sourceDefaults);
}

function normalizeReferenceFormula(item, sourceDefaults) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  const normalized = normalizeSourceTracking(normalizeReviewFields({
    ...item,
    variables: Array.isArray(item.variables) ? item.variables : [],
    solverStatus: 'reference_only'
  }), sourceDefaults);
  if (looksExtractionDamagedFormula(normalized.equation)) {
    return addNormalizationNote(normalized, 'Formula text may be extraction-damaged; keep pending teacher review.');
  }
  return normalized;
}

function normalizeProblemItem(item, sourceDefaults, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = { ...item };
  if (!nonEmptyString(normalized.problemId) && nonEmptyString(normalized.question)) {
    normalized.problemId = makeGeneratedItemId('problem', [
      normalized.question,
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ], index, sourceDefaults);
    normalized = addNormalizationNote(normalized, 'Generated problem ID during import normalization.');
  }
  return normalizeSourceTracking(normalizeReviewFields({
    ...normalized,
    standards: Array.isArray(normalized.standards) ? normalized.standards : []
  }), sourceDefaults);
}

function normalizeStandardsMapItem(item, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = { ...item };
  if (!nonEmptyString(normalized.standardId)) {
    const standardId = firstNonEmptyString(normalized.standard, normalized.standardCode, normalized.id);
    if (standardId) {
      normalized.standardId = standardId;
      normalized = addNormalizationNote(normalized, 'Mapped standardsMap ID during import normalization.');
    } else if (nonEmptyString(normalized.description)) {
      normalized = addNormalizationNote(normalized, `Standards map entry ${index + 1} still needs a standard ID before approval.`);
    }
  }
  return normalizeReviewFields({
    ...normalized,
    relatedVocabulary: Array.isArray(normalized.relatedVocabulary) ? normalized.relatedVocabulary : [],
    relatedConcepts: Array.isArray(normalized.relatedConcepts) ? normalized.relatedConcepts : []
  });
}

function normalizeSmokeTest(item, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = { ...item };
  if (!nonEmptyString(normalized.smokeTestId) && nonEmptyString(normalized.question)) {
    normalized.smokeTestId = makeGeneratedItemId('smoke-test', [
      normalized.question,
      normalized.expectedAnswer,
      normalized.expectedRoute
    ], index, {});
    normalized = addNormalizationNote(normalized, 'Generated smoke test ID during import normalization.');
  }
  return normalizeReviewFields(normalized);
}

function dedupeDraftItems(pack) {
  const rules = {
    concepts: conceptKey,
    problemBank: problemKey
  };
  const stats = {};
  const rawVocabulary = Array.isArray(pack.vocabulary) ? pack.vocabulary : [];
  pack.vocabulary = mergeVocabularyItems(rawVocabulary);
  stats.vocabulary = {
    raw: rawVocabulary.length,
    duplicatesRemoved: rawVocabulary.length - pack.vocabulary.length,
    final: pack.vocabulary.length
  };
  Object.entries(rules).forEach(([sectionName, makeKey]) => {
    const rawItems = Array.isArray(pack[sectionName]) ? pack[sectionName] : [];
    const deduped = mergeUniqueObjects(rawItems, makeKey);
    pack[sectionName] = deduped;
    stats[sectionName] = {
      raw: rawItems.length,
      duplicatesRemoved: rawItems.length - deduped.length,
      final: deduped.length
    };
  });
  return stats;
}

function mergeSourceEvidence(target, duplicate) {
  if (!target || !duplicate) return target;
  const references = [
    ...(Array.isArray(target.sourceReferences) ? target.sourceReferences : [makeSourceReference(target)]),
    makeSourceReference(duplicate)
  ].filter((reference) => reference.sourceFile || reference.sourceLocation || reference.sourceTextSnippet);
  target.sourceReferences = mergeUniqueSourceReferences(references);
  if (!nonEmptyString(target.sourceTextSnippet) && nonEmptyString(duplicate.sourceTextSnippet)) {
    target.sourceTextSnippet = duplicate.sourceTextSnippet;
  }
  if (!nonEmptyString(target.sourceLocation) && nonEmptyString(duplicate.sourceLocation)) {
    target.sourceLocation = duplicate.sourceLocation;
  }
  return target;
}

function mergeVocabularyDuplicate(target, duplicate) {
  mergeSourceEvidence(target, duplicate);
  const aliases = [
    target.aliases,
    duplicate.aliases,
    target.term !== duplicate.term ? duplicate.term : ''
  ];
  target.aliases = normalizeAliasList(aliases, target.term);
  if (!nonEmptyString(target.studentDefinition) && nonEmptyString(duplicate.studentDefinition)) {
    target.studentDefinition = duplicate.studentDefinition;
  }
  if (!nonEmptyString(target.teacherDefinition) && nonEmptyString(duplicate.teacherDefinition)) {
    target.teacherDefinition = duplicate.teacherDefinition;
  }
  if (!nonEmptyString(target.exampleQuestion) && nonEmptyString(duplicate.exampleQuestion)) {
    target.exampleQuestion = duplicate.exampleQuestion;
  }
  if (!nonEmptyString(target.exampleAnswer) && nonEmptyString(duplicate.exampleAnswer)) {
    target.exampleAnswer = duplicate.exampleAnswer;
  }
  return target;
}

function makeSourceReference(item) {
  return {
    sourceFile: String(item && item.sourceFile || ''),
    sourceLocation: String(item && item.sourceLocation || ''),
    sourceTextSnippet: String(item && item.sourceTextSnippet || '')
  };
}

function mergeUniqueSourceReferences(references) {
  const seen = new Set();
  const unique = [];
  references.forEach((reference) => {
    const key = [
      normalizeKey(reference.sourceFile),
      normalizeKey(reference.sourceLocation),
      normalizeItemKey(reference.sourceTextSnippet)
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(reference);
  });
  return unique;
}

function normalizeTermAliases({ label, aliases, sourceTextSnippet }) {
  const extracted = extractParentheticalAliases(label);
  let cleanLabel = nonEmptyString(label) ? String(label).trim() : '';
  if (extracted.cleanLabel) cleanLabel = extracted.cleanLabel;
  const sourceAliases = extractSourceParentheticalAliases(cleanLabel, sourceTextSnippet);
  return {
    label: cleanLabel,
    aliases: normalizeAliasList([aliases, extracted.aliases, sourceAliases], cleanLabel)
  };
}

function normalizeAliasList(values, canonicalLabel = '') {
  const flattened = flattenAliasValues(values);
  const canonicalKey = normalizeItemKey(canonicalLabel);
  const seen = new Set();
  const aliases = [];
  flattened.forEach((value) => {
    const alias = String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
    if (!alias) return;
    const key = normalizeItemKey(alias);
    if (!key || key === canonicalKey || seen.has(key)) return;
    seen.add(key);
    aliases.push(alias.slice(0, 80));
  });
  return aliases;
}

function flattenAliasValues(values) {
  const output = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === 'object') return;
    if (nonEmptyString(value)) output.push(value);
  };
  visit(values);
  return output;
}

function extractParentheticalAliases(value) {
  const label = nonEmptyString(value) ? String(value).trim() : '';
  const match = label.match(/^(.+?)\s*\(([^()]{1,16})\)\s*$/u);
  if (!match || !looksLikeAlias(match[2])) {
    return { cleanLabel: label, aliases: [] };
  }
  return {
    cleanLabel: match[1].trim(),
    aliases: [match[2].trim()]
  };
}

function stripParentheticalAlias(value) {
  return extractParentheticalAliases(value).cleanLabel || String(value || '');
}

function extractSourceParentheticalAliases(label, sourceTextSnippet) {
  if (!nonEmptyString(label) || !nonEmptyString(sourceTextSnippet)) return [];
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*\\(([^()]{1,16})\\)`, 'ig');
  const aliases = [];
  let match;
  while ((match = pattern.exec(sourceTextSnippet)) !== null) {
    if (looksLikeAlias(match[1])) aliases.push(match[1].trim());
  }
  return aliases;
}

function looksLikeAlias(value) {
  const alias = String(value || '').trim();
  if (!alias || /\s/.test(alias) || alias.length > 12) return false;
  return /^[A-Za-z0-9µΩ°%./^_-]+$/u.test(alias);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addSourceDerivedReferenceFormulas(pack, extraction, sourceDefaults) {
  const candidates = extractFormulaCandidates(extraction, sourceDefaults);
  if (!candidates.length) return;
  const existing = new Set((Array.isArray(pack.referenceFormulas) ? pack.referenceFormulas : [])
    .map((item) => normalizeFormulaEquation(item && item.equation))
    .filter(Boolean));
  candidates.forEach((candidate, index) => {
    const equationKey = normalizeFormulaEquation(candidate.equation);
    if (!equationKey || existing.has(equationKey)) return;
    existing.add(equationKey);
    pack.referenceFormulas.push(normalizeReferenceFormula({
      formulaId: makeGeneratedItemId('formula', [candidate.equation], index, sourceDefaults),
      title: makeFormulaTitle(candidate.equation, index),
      equation: candidate.equation,
      variables: candidate.variables,
      studentExplanation: 'Reference formula extracted from the uploaded source for teacher review.',
      solverStatus: 'reference_only',
      reviewStatus: 'pending',
      confidence: candidate.confidence,
      sourceFile: candidate.sourceFile || sourceDefaults.sourceFile,
      sourceLocation: candidate.sourceLocation || sourceDefaults.sourceLocation,
      sourceTextSnippet: candidate.sourceTextSnippet
    }, sourceDefaults));
  });
}

function extractFormulaCandidates(extraction, sourceDefaults) {
  const sections = makeFormulaSourceSections(extraction, sourceDefaults);
  const candidates = [];
  sections.forEach((section) => {
    splitFormulaSearchText(section.text).forEach((line) => {
      const equation = extractEquationText(line);
      if (!equation) return;
      candidates.push({
        equation,
        variables: extractFormulaVariables(equation, line),
        confidence: looksExtractionDamagedFormula(equation) || looksExtractionDamagedFormula(line) ? 'low' : 'medium',
        sourceFile: section.sourceFile,
        sourceLocation: section.sourceLocation,
        sourceTextSnippet: line.slice(0, 240)
      });
    });
  });
  return mergeFormulaCandidates(candidates);
}

function makeFormulaSourceSections(extraction, sourceDefaults) {
  const sections = Array.isArray(extraction && extraction.sections) && extraction.sections.length
    ? extraction.sections
    : Array.isArray(extraction && extraction.pages) && extraction.pages.length
      ? extraction.pages.map((page, index) => ({
          label: `Page ${Number(page.pageNumber || page.number || index + 1)}`,
          sourceLocation: `Page ${Number(page.pageNumber || page.number || index + 1)}`,
          text: page.text || page.content || ''
        }))
      : [{ label: sourceDefaults.sourceLocation, sourceLocation: sourceDefaults.sourceLocation, text: extraction && extraction.text || '' }];
  return sections.map((section, index) => ({
    sourceFile: firstNonEmptyString(section.sourceFile, sourceDefaults.sourceFile),
    sourceLocation: firstNonEmptyString(section.sourceLocation, section.label, `Chunk ${index + 1}`, sourceDefaults.sourceLocation),
    text: String(section.text || section.content || '')
  }));
}

function splitFormulaSearchText(text) {
  return String(text || '')
    .split(/\n+|(?<=\.)\s+(?=(?:formula|equation|[A-Z][A-Za-z0-9_]{0,8}\s*=|\d?\s*[A-Za-zµΩ°%]+\s*=))/iu)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 3 && line.length <= 500);
}

function extractEquationText(line) {
  const value = String(line || '').replace(/\s+/g, ' ').trim();
  if (!/[=≈]/u.test(value)) return '';
  let search = value.replace(/^[^:=≈]{0,80}:\s*(?=.*[=≈])/u, '');
  const formulaLead = search.match(/\b(?:formula|equation|relationship)\s*[:\-]?\s+([\s\S]+)$/iu);
  if (formulaLead) search = formulaLead[1].trim();
  const equationMatch = search.match(/(?:^|\b)([A-Za-zµΩ][A-Za-z0-9µΩ_./^() -]{0,32}\s*(?:=|≈)\s*[^.;\n]{1,140})/u)
    || search.match(/(\d?\s*[A-Za-zµΩ°%][A-Za-z0-9µΩ°%./^ -]{0,24}\s*(?:=|≈)\s*[^.;\n]{1,140})/u);
  if (!equationMatch) return '';
  let equation = equationMatch[1].trim();
  equation = equation.replace(/^(?:the\s+)?(?:formula|equation|relationship)\s+/iu, '');
  equation = equation.replace(/\s+\b(?:where|relates|when|if|because|for)\b[\s\S]*$/iu, '').trim();
  equation = equation.replace(/[,:]+$/u, '').trim();
  if (!/[A-Za-z0-9µΩ°%]\s*(?:=|≈)\s*[A-Za-z0-9µΩ°%]/u.test(equation)) return '';
  if (!/[+\-*/×÷^=≈·/]| per /iu.test(equation)) return '';
  return equation.slice(0, 160);
}

function extractFormulaVariables(equation, sourceLine) {
  const symbols = Array.from(new Set(String(equation || '').match(/\b[A-Za-zµΩ]\w{0,3}\b/gu) || []));
  const variables = [];
  symbols.forEach((symbol) => {
    const meaning = extractVariableMeaning(symbol, sourceLine);
    if (meaning) {
      variables.push({ symbol, meaning });
    }
  });
  return variables;
}

function extractVariableMeaning(symbol, sourceLine) {
  const escaped = escapeRegExp(symbol);
  const patterns = [
    new RegExp(`\\b${escaped}\\b\\s+(?:is|means|represents)\\s+([^,;.()]{1,60})`, 'iu'),
    new RegExp(`\\b${escaped}\\b\\s*=\\s*([^,;.()]{1,60})`, 'iu')
  ];
  for (const pattern of patterns) {
    const match = String(sourceLine || '').match(pattern);
    if (match && match[1]) return match[1].replace(/\band\s*$/iu, '').trim();
  }
  return '';
}

function mergeFormulaCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  candidates.forEach((candidate) => {
    const key = normalizeFormulaEquation(candidate.equation);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(candidate);
  });
  return unique;
}

function normalizeFormulaEquation(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '').replace(/[×·]/g, '*').trim();
}

function makeFormulaTitle(equation, index) {
  const leftSide = String(equation || '').split(/=|≈/u)[0].replace(/[^A-Za-z0-9µΩ ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return leftSide ? `${leftSide.slice(0, 48)} Reference Formula` : `Reference Formula ${index + 1}`;
}

function looksExtractionDamagedFormula(value) {
  const text = String(value || '');
  if (!text) return false;
  if (/[�□■�]/u.test(text)) return true;
  if (/[=≈]\s*(?:$|[=≈])/u.test(text)) return true;
  if (/(?:[_-]\s*){3,}/u.test(text)) return true;
  if (/[^\p{L}\p{N}\s=≈+\-*/×÷^().,;:µΩ°%·_/]/u.test(text)) return true;
  return false;
}

function normalizeReviewFields(item) {
  return {
    ...item,
    reviewStatus: 'pending',
    confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'low'
  };
}

function normalizeSourceTracking(item, sourceDefaults) {
  const hadSourceEvidence = hasSourceEvidence(item);
  const normalized = {
    ...item,
    sourceFile: nonEmptyString(item.sourceFile) ? item.sourceFile : sourceDefaults.sourceFile,
    sourceLocation: nonEmptyString(item.sourceLocation) ? item.sourceLocation : sourceDefaults.sourceLocation,
    sourceTextSnippet: nonEmptyString(item.sourceTextSnippet)
      ? item.sourceTextSnippet
      : nonEmptyString(item.sourceSnippet)
        ? item.sourceSnippet
        : sourceDefaults.sourceTextSnippet
  };
  if (!hadSourceEvidence) {
    return addNormalizationNote({
      ...normalized,
      confidence: 'low',
      reviewStatus: 'pending'
    }, 'Source evidence was filled from extraction defaults during import normalization; keep pending review.');
  }
  return normalized;
}

function hasSourceEvidence(item) {
  return Boolean(
    nonEmptyString(item && item.sourceFile)
    || nonEmptyString(item && item.sourceLocation)
    || nonEmptyString(item && item.sourceTextSnippet)
    || nonEmptyString(item && item.sourceSnippet)
  );
}

function addNormalizationNote(item, note) {
  const notes = Array.isArray(item.normalizationNotes)
    ? item.normalizationNotes.slice()
    : nonEmptyString(item.normalizationNote)
      ? [item.normalizationNote]
      : [];
  if (!notes.includes(note)) notes.push(note);
  const existing = nonEmptyString(item.notes) ? item.notes : '';
  return {
    ...item,
    reviewStatus: 'pending',
    confidence: 'low',
    notes: existing && !existing.includes(note) ? `${existing} ${note}` : existing || note,
    normalizationNotes: notes
  };
}

function deriveShortTitle(candidates) {
  const text = firstDerivedText(candidates);
  if (!text) return '';
  const firstSentence = text.split(/(?<=[.!?])\s+/u)[0] || text;
  return firstSentence
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(' ')
    .replace(/[.:;,]+$/u, '');
}

function firstDerivedText(candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const nested = firstDerivedText(candidate);
      if (nested) return nested;
      continue;
    }
    if (nonEmptyString(candidate)) return sanitizeModelString(candidate);
  }
  return '';
}

function makeGeneratedItemId(prefix, candidates, index = 0, sourceDefaults = {}) {
  const text = firstDerivedText(candidates);
  const slug = slugify(text);
  if (slug) return `${prefix}-${slug}`;
  const page = inferPageFromLocation(sourceDefaults.sourceLocation);
  return `${prefix}${page ? `-page-${page}` : ''}-${String(index + 1).padStart(3, '0')}`;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}

function inferPageFromLocation(value) {
  const match = String(value || '').match(/\bpage\s*(\d+)\b/i);
  return match ? Number(match[1]) : 0;
}

function buildImportNormalizationReport(pack) {
  const report = {
    conceptIdsGenerated: 0,
    conceptTitlesGenerated: 0,
    vocabularyIdsGenerated: 0,
    vocabularyTermsGenerated: 0,
    problemIdsGenerated: 0,
    smokeTestIdsGenerated: 0,
    standardsMapIdsMapped: 0,
    sourceEvidenceFilled: 0,
    reviewNeededItems: 0,
    droppedItems: 0,
    totalNormalized: 0,
    notes: []
  };
  [
    ['vocabulary', pack.vocabulary],
    ['concepts', pack.concepts],
    ['problemBank', pack.problemBank],
    ['standardsMap', pack.standardsMap],
    ['smokeTests', pack.smokeTests]
  ].forEach(([sectionName, items]) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      const notes = Array.isArray(item.normalizationNotes) ? item.normalizationNotes : [];
      if (notes.length > 0) report.reviewNeededItems += 1;
      notes.forEach((note) => {
        incrementNormalizationReport(report, sectionName, note);
      });
    });
  });
  report.totalNormalized = report.conceptIdsGenerated
    + report.conceptTitlesGenerated
    + report.vocabularyIdsGenerated
    + report.vocabularyTermsGenerated
    + report.problemIdsGenerated
    + report.smokeTestIdsGenerated
    + report.standardsMapIdsMapped
    + report.sourceEvidenceFilled;
  return report;
}

function incrementNormalizationReport(report, sectionName, note) {
  if (!report.notes.includes(note)) report.notes.push(note);
  if (sectionName === 'concepts' && note.includes('concept ID')) report.conceptIdsGenerated += 1;
  if (sectionName === 'concepts' && note.includes('concept title')) report.conceptTitlesGenerated += 1;
  if (sectionName === 'vocabulary' && note.includes('vocabulary ID')) report.vocabularyIdsGenerated += 1;
  if (sectionName === 'vocabulary' && note.includes('vocabulary term')) report.vocabularyTermsGenerated += 1;
  if (sectionName === 'problemBank' && note.includes('problem ID')) report.problemIdsGenerated += 1;
  if (sectionName === 'smokeTests' && note.includes('smoke test ID')) report.smokeTestIdsGenerated += 1;
  if (sectionName === 'standardsMap' && note.includes('standardsMap ID')) report.standardsMapIdsMapped += 1;
  if (note.includes('Source evidence was filled')) report.sourceEvidenceFilled += 1;
}

function makeSourceDefaults(extraction) {
  const metadata = extraction && extraction.metadata && typeof extraction.metadata === 'object'
    ? extraction.metadata
    : {};
  const upload = extraction && extraction.upload && typeof extraction.upload === 'object'
    ? extraction.upload
    : {};
  const sourceFile = firstNonEmptyString(
    upload.originalFileName,
    extraction && extraction.fileName,
    metadata.fileName,
    extraction && extraction.filePath ? path.basename(extraction.filePath) : ''
  );

  return {
    sourceFile,
    uploadId: firstNonEmptyString(upload.uploadId),
    storedFileName: firstNonEmptyString(upload.storedFileName),
    extractionJsonFileName: firstNonEmptyString(upload.extractionJsonFileName),
    fileType: firstNonEmptyString(
      extraction && extraction.extension ? String(extraction.extension).replace(/^\./, '') : '',
      extraction && extraction.mimeGuess,
      metadata.detectedType,
      'unknown'
    ),
    subject: firstNonEmptyString(metadata.subject, extraction && extraction.subject),
    gradeLevel: firstNonEmptyString(metadata.gradeLevel, extraction && extraction.gradeLevel),
    characterCount: String(extraction && extraction.text || '').length,
    pageCount: Number(metadata.pageCount || 0),
    chunkCount: Array.isArray(extraction && extraction.sections) ? extraction.sections.length : 0,
    sourceLocation: metadata.importSelection && metadata.importSelection.label
      ? metadata.importSelection.label
      : 'extracted text',
    sourceTextSnippet: makeSourceTextSnippet(extraction && extraction.text)
  };
}

function buildSafeDraftMetadata(modelMetadata, { extraction, packName, packId, sourceDefaults, importScope }) {
  return {
    modelMetadata: sanitizeModelMetadata(modelMetadata),
    createdBy: 'charlemagne-teacher-content-import',
    createdAt: firstNonEmptyString(modelMetadata && modelMetadata.createdAt, new Date().toISOString()),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    reviewStatus: 'pending',
    packName,
    packId,
    sourceUpload: {
      uploadId: sourceDefaults.uploadId,
      originalFileName: sourceDefaults.sourceFile,
      storedFileName: sourceDefaults.storedFileName,
      extractionJsonFileName: sourceDefaults.extractionJsonFileName,
      fileType: sourceDefaults.fileType,
      characterCount: sourceDefaults.characterCount,
      pageCount: sourceDefaults.pageCount,
      chunkCount: sourceDefaults.chunkCount
    },
    extraction: {
      characterCount: String(extraction && extraction.text || '').length,
      pageCount: sourceDefaults.pageCount,
      chunkCount: sourceDefaults.chunkCount
    },
    importScope: importScope || undefined
  };
}

function sanitizeModelMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const safe = {};
  ['notes', 'model', 'promptVersion', 'createdBy'].forEach((field) => {
    if (nonEmptyString(metadata[field])) safe[field] = metadata[field].trim().slice(0, 500);
  });
  return safe;
}

function makeDraftPackId({ packName, extraction, fallbackPackId }) {
  const upload = extraction && extraction.upload && typeof extraction.upload === 'object' ? extraction.upload : {};
  const base = slugify(packName || titleFromPackId(fallbackPackId) || 'teacher-upload');
  const suffix = slugify(firstNonEmptyString(upload.uploadId, extraction && extraction.uploadId));
  const candidate = suffix ? `draft-${base}-${suffix}` : (packName ? `draft-${base}` : fallbackPackId);
  const safeCandidate = slugify(candidate || `draft-${base}`);
  return safeCandidate || 'draft-teacher-upload';
}

function titleFromPackId(packId) {
  return String(packId || '')
    .replace(/^draft[-_]/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function slugify(value) {
  const slug = String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return SAFE_PACK_ID_PATTERN.test(slug) ? slug : '';
}

function sanitizeModelString(value) {
  return nonEmptyString(value) ? value.trim().slice(0, 120) : '';
}

function countGeneratedItems(pack) {
  const counts = {};
  GENERATED_ITEM_SECTIONS.forEach((sectionName) => {
    if (sectionName === 'sourceFiles') return;
    counts[sectionName] = Array.isArray(pack && pack[sectionName]) ? pack[sectionName].length : 0;
  });
  return counts;
}

function makeProgressRecorder(timeline, onProgress) {
  return (type, message, details = {}) => {
    const event = {
      type,
      message,
      at: new Date().toISOString(),
      details: sanitizeProgressDetails(details)
    };
    timeline.push(event);
    if (typeof onProgress === 'function') onProgress(event);
    return event;
  };
}

function sanitizeProgressDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
  const safe = {};
  Object.entries(details).forEach(([key, value]) => {
    if (value === undefined || typeof value === 'function') return;
    if (Array.isArray(value)) {
      safe[key] = value.map((item) => typeof item === 'string' ? item.slice(0, 500) : item);
      return;
    }
    if (value && typeof value === 'object') {
      safe[key] = sanitizeProgressDetails(value);
      return;
    }
    safe[key] = typeof value === 'string' ? value.slice(0, 500) : value;
  });
  return safe;
}

function firstError(errors, fallback) {
  return Array.isArray(errors) && errors.length ? String(errors[0]) : fallback;
}

function normalizedSourceFileNames(pack) {
  return Array.from(new Set(
    (Array.isArray(pack && pack.sourceFiles) ? pack.sourceFiles : [])
      .map((item) => item && item.fileName)
      .filter(nonEmptyString)
  ));
}

function makeSourceTextSnippet(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Extracted text was used for this draft item.';
  return normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;
}

function firstNonEmptyString(...values) {
  return values.find(nonEmptyString) || '';
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizePackName(value) {
  if (!nonEmptyString(value)) return '';
  return value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function validateDraftSafety(pack) {
  const errors = [];

  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    return ['Generated draft must be a JSON object.'];
  }

  if (typeof pack.packId === 'string' && !SAFE_PACK_ID_PATTERN.test(pack.packId)) {
    errors.push('Generated packId must be safe for filenames before writing a draft.');
  }

  GENERATED_ITEM_SECTIONS.forEach((sectionName) => {
    const items = pack[sectionName];
    if (!Array.isArray(items)) return;

    items.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      if (item.reviewStatus !== 'pending') {
        errors.push(`${sectionName}[${index}].reviewStatus must be "pending" for generated drafts.`);
      }
      if (sectionName === 'referenceFormulas' && item.solverStatus !== 'reference_only') {
        errors.push(`${sectionName}[${index}].solverStatus must be "reference_only" for uploaded formulas.`);
      }
    });
  });

  return errors;
}

function loadStandardsBank(standardsBankInput) {
  if (!standardsBankInput) {
    return {
      success: true,
      standardsBank: null,
      warnings: [],
      errors: []
    };
  }

  let standardsBank = standardsBankInput;
  if (typeof standardsBankInput === 'string') {
    const readResult = readJsonFile(path.resolve(standardsBankInput), 'standards bank');
    if (!readResult.success) return { ...readResult, standardsBank: null, warnings: [] };
    standardsBank = readResult.value;
  }

  if (!standardsBank || typeof standardsBank !== 'object' || Array.isArray(standardsBank)) {
    return {
      success: false,
      standardsBank: null,
      warnings: [],
      errors: ['standardsBank must be a standards bank object or a path to standards_bank.json.']
    };
  }

  const validation = validateStandardsBank(standardsBank);
  if (!validation.valid) {
    return {
      success: false,
      standardsBank: null,
      warnings: validation.warnings,
      errors: validation.errors.map((error) => `Standards bank validation failed: ${error}`)
    };
  }

  return {
    success: true,
    standardsBank,
    warnings: validation.warnings,
    errors: []
  };
}

function validateExtraction(extraction) {
  const errors = [];

  if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
    return ['Extraction JSON must be an object.'];
  }

  if (extraction.success !== true) {
    errors.push('Extraction JSON must have success: true before draft generation.');
  }

  if (typeof extraction.text !== 'string' || extraction.text.trim().length === 0) {
    errors.push('Extraction JSON must include non-empty text.');
  }

  if (typeof extraction.fileName !== 'string' || extraction.fileName.trim().length === 0) {
    errors.push('Extraction JSON must include fileName.');
  }

  return errors;
}

function readJsonFile(filePath, label) {
  try {
    return {
      success: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8'))
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Could not read or parse ${label}: ${error.message}`]
    };
  }
}

function writeRawResponse(options, rawModelResponse) {
  const outputPath = options.rawModelResponsePath
    ? path.resolve(options.rawModelResponsePath)
    : makeRawResponsePath(options.rawModelResponsesDir);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, String(rawModelResponse || ''), 'utf8');
  return outputPath;
}

function makeRawResponsePath(rawModelResponsesDir) {
  const outputDir = path.resolve(rawModelResponsesDir || DEFAULT_RAW_MODEL_RESPONSES_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = Math.random().toString(16).slice(2, 10);
  return path.join(outputDir, `model-response-${timestamp}-${suffix}.txt`);
}

function isLocalhost(hostname) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
}

function blocked(result) {
  return {
    success: false,
    packId: result.packId,
    outputPath: result.outputPath,
    validationPassed: result.validationPassed === true ? true : false,
    warnings: result.warnings || [],
    errors: result.errors || [],
    rawModelResponsePath: result.rawModelResponsePath,
    timeline: result.timeline || [],
    coverageReport: result.coverageReport,
    failedBatches: result.failedBatches || []
  };
}

module.exports = {
  DEFAULT_MODEL,
  DEFAULT_OLLAMA_KEEP_ALIVE,
  DEFAULT_OLLAMA_TIMEOUT_MS,
  DEFAULT_OLLAMA_URL,
  DEFAULT_BATCH_MAX_CHARACTERS,
  DEFAULT_RETRY_BATCH_MAX_CHARACTERS,
  DEFAULT_PREVIEW_MAX_PAGES,
  DEFAULT_PREVIEW_MAX_CHARACTERS,
  DEFAULT_FULL_REQUIRES_CONFIRMATION,
  DEFAULT_LARGE_IMPORT_CHARACTERS,
  DEFAULT_LARGE_IMPORT_PAGES,
  DEFAULT_LARGE_IMPORT_BATCHES,
  DEFAULT_HARD_STOP_CHARACTERS,
  DEFAULT_HARD_STOP_PAGES,
  DEFAULT_HARD_STOP_BATCHES,
  DEFAULT_RAW_MODEL_RESPONSES_DIR,
  buildImportEstimate,
  buildExtractionBatches,
  callOllamaGenerate,
  generateDraftKnowledgePack,
  identifyTextBearingPages,
  makeSelectedExtraction,
  normalizeDraftKnowledgePack,
  parseModelResponse,
  validateDraftSafety
};
