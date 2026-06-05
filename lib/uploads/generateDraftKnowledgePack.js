const fs = require('node:fs');
const path = require('node:path');

const { DEFAULT_DRAFT_PACKS_DIR } = require('../knowledge/loadDraftKnowledgePacks');
const { validateKnowledgePack } = require('../knowledge/validateKnowledgePack');
const { buildImportCoverageReport, makeSourceChunks } = require('./buildImportCoverageReport');
const { buildKnowledgePackPrompt } = require('./buildKnowledgePackPrompt');
const { makeSourceManifestFromExtraction } = require('./sourceManifest');
const {
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
  KNOWLEDGE_PACK_FILE_NAME
} = require('./importConstants');
const {
  buildImportEstimate,
  buildExtractionBatches,
  identifyTextBearingPages,
  makeSelectedExtraction,
  makePreviewExtraction,
  makeFullTextBearingExtraction,
  makeUltraSafePreviewExtraction,
  makeImportScope,
  applyImportCompletionFromCoverage,
  summarizeBatchSource,
  isSelectedImportRequested,
  makePreviewImportSelection,
  buildRetryBatchesForBatch
} = require('./extractionBatching');
const {
  resolveImportModel,
  makeDeterministicModelOptions,
  buildImportInputSnapshot,
  modelRetryMaxCharacters,
  previewMaxCharacters,
  isUltraSafePreview,
  previewModeLabel
} = require('./importSafety');
const { parseModelResponse } = require('./modelResponseParser');
const {
  callOllamaGenerate,
  generateBatchDraft,
  retryBatchWithSmallerChunks,
  shouldRetryModelCrash,
  makeFailedBatchWarning,
  normalizeRawResponses,
  isModelCrashMessage,
  isModelTimeoutMessage,
  isModelUnavailableMessage
} = require('./modelGenerationClient');
const {
  normalizeDraftKnowledgePack,
  mergeDraftKnowledgePacks,
  normalizeImportProfile,
  countGeneratedItems,
  hasAnyReviewableGeneratedItems,
  buildInvalidGeneratedItemTechnicalErrors,
  makeProgressRecorder,
  firstError,
  normalizedSourceFileNames
} = require('./draftPackNormalizer');
const { applySourceEvidenceValidation } = require('./sourceEvidenceValidation');
const {
  makePreviewResult,
  validateDraftSafety,
  loadStandardsBank,
  validateExtraction,
  readJsonFile,
  writeRawResponse,
  blocked
} = require('./importResultBuilders');
const { runAdaptiveImportLoop, writePartialDraftFromSuccessfulBatches, makePreviewValidationSalvage } = require('./partialDraftWriter');
const { firstNonEmptyString, sanitizePackName } = require('./importTextUtils');

async function generateDraftKnowledgePack(options = {}) {
  const warnings = [];
  const errors = [];
  const extractionJsonPath = options.extractionJsonPath || options.input;
  const outputDraftDir = path.resolve(options.outputDraftDir || options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR);
  const model = resolveImportModel(options);
  const modelClient = options.modelClient || callOllamaGenerate;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_OLLAMA_TIMEOUT_MS);
  const keepAlive = options.keepAlive || DEFAULT_OLLAMA_KEEP_ALIVE;
  const retryInvalidJson = options.retryInvalidJson === true;
  const force = options.force === true;
  const importProfile = normalizeImportProfile(options.importProfile);
  const timeline = [];
  const recordProgress = makeProgressRecorder(timeline, options.onProgress);

  if (!extractionJsonPath || typeof extractionJsonPath !== 'string') {
    return blocked({ warnings, errors: ['An extraction JSON path is required.'] });
  }

  const extractionResult = readJsonFile(path.resolve(extractionJsonPath), 'extraction JSON');
  if (!extractionResult.success) {
    return blocked({ warnings, errors: extractionResult.errors });
  }

  const extractionValue = extractionResult.value;
  const sourceManifest = Array.isArray(extractionValue && extractionValue.sourceManifest) && extractionValue.sourceManifest.length
    ? extractionValue.sourceManifest
    : makeSourceManifestFromExtraction(extractionValue);
  const originalExtraction = {
    ...(extractionValue || {}),
    sourceManifest
  };
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
  const adaptiveImportLoop = options.adaptiveImportLoop === true && !previewOnly && !selectedImport;
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
  const fullSourceChunks = makeSourceChunks(originalExtraction);
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
  if (adaptiveImportLoop) {
    return runAdaptiveImportLoop({
      batches,
      extraction,
      originalExtraction,
      standardsBank: standardsResult.standardsBank,
      packName: options.packName,
      model,
      modelClient,
      timeoutMs,
      keepAlive,
      retryInvalidJson,
      options,
      importScope,
      importSelection,
      importEstimate,
      selectedImportEstimate,
      inputSnapshot,
      sourceChunks: fullSourceChunks,
      outputDraftDir,
      force,
      timeline,
      warnings,
      recordProgress
    });
  }

  for (const batch of batches) {
    const batchSource = summarizeBatchSource(batch);
    const prompt = buildKnowledgePackPrompt({
      extraction: batch.extraction,
      standardsBank: standardsResult.standardsBank,
      packName: options.packName,
      importProfile,
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
        if (generationResult.success && generationResult.retrySucceeded) {
          recordProgress('batch_retry_recovered', 'Recovered with smaller batch.', {
            batchIndex: batch.batchIndex,
            totalBatches: batches.length,
            retryBatches: retryBatches.length,
            retryMaxCharacters: modelRetryMaxCharacters(options),
            pageRange: batchSource.pageRange,
            chunkRange: batchSource.chunkRange,
            chunkLabels: batch.chunks.map((chunk) => chunk.label)
          });
          warnings.push('Recovered with smaller batch.');
        }
      }
    }

    rawModelResponses.push(...normalizeRawResponses(generationResult.rawModelResponse));

    if (!generationResult.success) {
      const coverageReport = buildImportCoverageReport({
        extraction: originalExtraction,
        sourceManifest: originalExtraction.sourceManifest,
        sourceChunks: fullSourceChunks,
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
      if (previewOnly && generatedBatches.length > 0 && generationResult.modelTimeout !== true) {
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
      if (!previewOnly && generatedBatches.length > 0) {
        const partialDraft = writePartialDraftFromSuccessfulBatches({
          generatedBatches,
          extraction,
          originalExtraction,
          packName: options.packName,
          importScope,
          importSelection,
          importEstimate,
          selectedImportEstimate,
          inputSnapshot,
          sourceChunks: fullSourceChunks,
          failedBatches: generationResult.failedBatches || coverageReport.failedBatches,
          generationErrors: generationResult.errors,
          standardsBank: standardsResult.standardsBank,
          warnings,
          outputDraftDir,
          force,
          options,
          timeline,
          recordProgress
        });
        if (partialDraft.success) return partialDraft;
        if (partialDraft.hasGeneratedItems) {
          return blocked({
            ...partialDraft,
            modelCrash: generationResult.modelCrash === true,
            modelTimeout: generationResult.modelTimeout === true,
            modelUnavailable: generationResult.modelUnavailable === true,
            rawModelResponsePath: generationResult.rawModelResponsePath
          });
        }
      }
      return blocked({
        warnings,
        errors: generationResult.errors,
        modelCrash: generationResult.modelCrash === true,
        modelTimeout: generationResult.modelTimeout === true,
        modelUnavailable: generationResult.modelUnavailable === true,
        rawModelResponsePath: generationResult.rawModelResponsePath,
        timeline,
        coverageReport,
        importSelection,
        importScope,
        selectedImportEstimate,
        failedBatches: generationResult.failedBatches || coverageReport.failedBatches
      });
    }

    const normalizedBatchPack = normalizeDraftKnowledgePack(generationResult.parsedModelResponse, {
      extraction: batches.length > 1 ? batch.extraction : extraction,
      packName: options.packName,
      importProfile,
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
    extraction: originalExtraction,
    pack,
    sourceManifest: originalExtraction.sourceManifest,
    sourceChunks: fullSourceChunks,
    processedChunks: batches.flatMap((batch) => batch.chunks)
  });
  const finalizedImportScope = applyImportCompletionFromCoverage(importScope, coverageReport);
  const sourceEvidenceReport = applySourceEvidenceValidation(pack, extraction);
  pack.metadata.importCoverage = coverageReport;
  pack.metadata.importScope = finalizedImportScope;
  pack.metadata.sourceEvidenceValidation = sourceEvidenceReport;
  if (options.autoImportPlan && typeof options.autoImportPlan === 'object' && !Array.isArray(options.autoImportPlan)) {
    pack.metadata.autoImportPlan = options.autoImportPlan;
  }
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
  warnings.push(...sourceEvidenceReport.warnings);
  recordProgress('source_evidence_validated', 'Checking generated wording against source evidence', sourceEvidenceReport);
  const draftSafetyErrors = validateDraftSafety(pack);
  if (!hasAnyReviewableGeneratedItems(pack)) {
    const invalidItems = Array.isArray(pack && pack.metadata && pack.metadata.invalidGeneratedItems)
      ? pack.metadata.invalidGeneratedItems
      : [];
    const topLevelMessage = previewOnly
      ? 'No usable preview items were created from this range.'
      : 'No usable draft items were created from this upload.';
    const errors = [
      topLevelMessage,
      ...buildInvalidGeneratedItemTechnicalErrors(invalidItems)
    ];
    recordProgress('error', topLevelMessage, {
      invalidItemCount: invalidItems.length,
      invalidItems
    });
    return blocked({
      packId: pack && pack.packId,
      warnings,
      errors,
      validationErrors: errors,
      invalidItems,
      repairNeeded: invalidItems,
      validationPassed: false,
      rawModelResponsePath: writeRawResponse(options, JSON.stringify({
        rawModelResponses,
        parsedModelResponse: generatedBatches.map((entry) => entry.parsedModelResponse),
        normalizedDraftAttempt: pack,
        invalidItems,
        errors
      }, null, 2)),
      timeline
    });
  }
  recordProgress('validation_started', 'Running validation', {
    packId: pack && pack.packId,
    importNormalization: pack && pack.metadata && pack.metadata.importNormalization
  });
  const validation = validateKnowledgePack(pack, {
    standardsBank: standardsResult.standardsBank,
    standardsPaused: true
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
        extraction: originalExtraction,
        sourceChunks: fullSourceChunks,
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
          importScope: finalizedImportScope,
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
      importScope: finalizedImportScope,
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
    importScope: finalizedImportScope,
    selectedImportEstimate,
    timeline,
    outputPath,
    validationPassed: true,
    warnings,
    errors: []
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
  resolveImportModel,
  makeSelectedExtraction,
  normalizeDraftKnowledgePack,
  parseModelResponse,
  validateDraftSafety,
  isModelCrashMessage,
  isModelTimeoutMessage,
  isModelUnavailableMessage
};
