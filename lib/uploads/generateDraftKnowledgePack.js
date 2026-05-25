const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const { DEFAULT_DRAFT_PACKS_DIR } = require('../knowledge/loadDraftKnowledgePacks');
const { SAFE_PACK_ID_PATTERN } = require('../knowledge/packSchema');
const { validateKnowledgePack } = require('../knowledge/validateKnowledgePack');
const { makeDefaultStandardsMetadata } = require('../knowledge/standardsMetadata');
const { validateStandardsBank } = require('../standards/validateStandardsBank');
const { buildImportCoverageReport, makeSourceChunks } = require('./buildImportCoverageReport');
const { buildKnowledgePackPrompt } = require('./buildKnowledgePackPrompt');
const { makeSourceManifestFromExtraction, normalizeSourceManifest } = require('./sourceManifest');

const DEFAULT_MODEL = 'gemma4:e2b';
const DEFAULT_OLLAMA_URL = 'http://localhost:11434/api/generate';
const DEFAULT_OLLAMA_TIMEOUT_MS = 300000;
const DEFAULT_OLLAMA_KEEP_ALIVE = '10m';
const DEFAULT_MODEL_SEED = 42;
const DEFAULT_MODEL_TEMPERATURE = 0;
const DEFAULT_MODEL_TOP_P = 1;
const DEFAULT_MODEL_TOP_K = 40;
const PROMPT_VERSION = 'teacher-content-draft-v3-compact';
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
const MODEL_GENERATION_TIMEOUT_CODE = 'MODEL_GENERATION_TIMEOUT';
const MODEL_GENERATION_TIMEOUT_MESSAGE = 'Local Gemma took too long while reading this batch.';
const SOURCE_GROUNDING_WARNING = 'Generated wording was not strongly supported by the extracted source text.';
const THIN_EXTRACTION_WARNING = 'Only limited text was extracted from this range. Review may need OCR later.';
const SOURCE_GROUNDING_SECTIONS = [
  'vocabulary',
  'concepts',
  'referenceFormulas'
];
const REJECTED_VOCAB_LABEL_KEYS = new Set([
  'core concept',
  'core concepts',
  'key concept',
  'key concepts',
  'concept check',
  'key idea',
  'key ideas',
  'important idea',
  'important ideas',
  'main idea',
  'main ideas',
  'vocabulary',
  'useful vocabulary',
  'useful vocab',
  'terms',
  'useful terms',
  'key term',
  'key terms',
  'concepts',
  'useful concept',
  'useful concepts',
  'review items',
  'review item',
  'misconception',
  'misconceptions',
  'common mistake',
  'common mistakes',
  'cause and effect',
  'timeline',
  'people events dates',
  'people event dates',
  'procedure',
  'procedures',
  'steps',
  'procedure steps',
  'process steps',
  'sequence process steps',
  'examples',
  'reference formula',
  'reference formulas',
  'reference-only formula',
  'reference-only formulas',
  'key formula',
  'key formulas',
  'formula',
  'formulas',
  'example',
  'review',
  'practice',
  'use',
  'se alignment'
]);
const FORMULA_LABEL_PATTERN = '(?:reference\\s+formula(?:s)?|reference(?:-|\\s+)only\\s+formula(?:s)?(?:\\s+on\\s+this\\s+deck)?|key\\s+formula(?:s)?|formula(?:s)?|reference\\s+idea)';
const VOCAB_SECTION_LABEL_PATTERN = '(?:vocabulary|useful\\s+vocab(?:ulary)?|terms?|useful\\s+terms?|key\\s+terms?)';
const CONCEPT_LABEL_PATTERN = '(?:core\\s+concepts?|key\\s+concepts?|concept\\s+check|key\\s+ideas?|important\\s+ideas?|main\\s+ideas?|useful\\s+concepts?|review\\s+items?|misconceptions?|common\\s+mistakes?|cause\\s+(?:and|&)\\s+effect|timeline|people\\s*(?:\\/|&|and)?\\s*events?\\s*(?:\\/|&|and)?\\s*dates?|procedure\\s*(?:\\/|&|and)?\\s*steps?|procedures?|steps?|process\\s*steps?|sequence\\s*(?:\\/|&|and)?\\s*process\\s*steps?)';
const FORMULA_VARIABLE_VOCAB_KEYS = new Set(['v', 'i', 'r', 'm', 't', 'f', 'd', 'h', 'g']);

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
            rawModelResponsePath: generationResult.rawModelResponsePath
          });
        }
      }
      return blocked({
        warnings,
        errors: generationResult.errors,
        modelCrash: generationResult.modelCrash === true,
        modelTimeout: generationResult.modelTimeout === true,
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
        packName: safeOptions.packName,
        importProfile: normalizeImportProfile(safeOptions.importProfile)
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

async function runAdaptiveImportLoop({
  batches,
  extraction,
  originalExtraction,
  standardsBank,
  packName,
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
  sourceChunks,
  outputDraftDir,
  force,
  timeline,
  warnings,
  recordProgress
}) {
  const generatedBatches = [];
  const failedBatches = [];
  const rawModelResponses = [];
  let sourceManifest = normalizeSourceManifest(originalExtraction && originalExtraction.sourceManifest, originalExtraction)
    .map((entry) => ({
      ...entry,
      status: String(entry.status || '') === 'processing' ? 'queued' : String(entry.status || 'queued')
    }));

  const basePack = normalizeDraftKnowledgePack({}, {
    extraction,
    packName,
    importScope
  });
  const safePackId = basePack.packId;
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

  for (const batch of batches) {
    const batchSource = summarizeBatchSource(batch);
    const chunkIndexes = chunkIndexesFromBatch(batch);
    const queuedChunkIndexes = chunkIndexes.filter((chunkIndex) => {
      const entry = sourceManifest.find((candidate) => Number(candidate && candidate.chunkIndex || 0) === Number(chunkIndex));
      return entry && String(entry.status || '') === 'queued';
    });
    if (queuedChunkIndexes.length === 0) {
      continue;
    }
    sourceManifest = markManifestChunkStatus(sourceManifest, queuedChunkIndexes, 'processing');
    const prompt = buildKnowledgePackPrompt({
      extraction: batch.extraction,
      standardsBank,
      packName,
      importProfile: normalizeImportProfile(options.importProfile),
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
      const batchFailures = generationResult.failedBatches || [makeFailedBatchWarning(batch, generationResult.errors)];
      failedBatches.push(...batchFailures);
      sourceManifest = markManifestChunkStatus(sourceManifest, queuedChunkIndexes, 'failed_after_retries');
      recordProgress('chunk_failed_continue', `Batch ${batch.batchIndex} failed after retries. Marked failed and continued.`, {
        batchIndex: batch.batchIndex,
        totalBatches: batches.length,
        chunkLabels: batch.chunks.map((chunk) => chunk.label),
        errors: generationResult.errors
      });
      continue;
    }

    const normalizedBatchPack = normalizeDraftKnowledgePack(generationResult.parsedModelResponse, {
      extraction: batches.length > 1 ? batch.extraction : extraction,
      packName,
      importProfile: normalizeImportProfile(options.importProfile),
      importScope
    });
    const coreKnowledgeItemCount = countCoreKnowledgeItems(normalizedBatchPack);
    sourceManifest = markManifestChunkStatus(sourceManifest, queuedChunkIndexes, coreKnowledgeItemCount > 0 ? 'drafted' : 'no_items_found');
    generatedBatches.push({
      batch,
      parsedModelResponse: generationResult.parsedModelResponse,
      pack: normalizedBatchPack
    });
    recordProgress('batch_received', `Received draft items from batch ${batch.batchIndex} of ${batches.length}${batchSource.messageSuffix}`, {
      batchIndex: batch.batchIndex,
      totalBatches: batches.length,
      pageRange: batchSource.pageRange,
      chunkRange: batchSource.chunkRange,
      chunkLabels: batchSource.chunkLabels,
      itemCounts: countGeneratedItems(normalizedBatchPack)
    });

    const progressPack = mergeGeneratedBatchPacks(generatedBatches, {
      extraction,
      packName,
      importScope,
      fallbackPack: basePack
    });
    const progressCoverage = buildImportCoverageReport({
      extraction: originalExtraction,
      pack: progressPack,
      sourceManifest,
      sourceChunks,
      processedChunks: processedChunksFromManifest(sourceManifest, sourceChunks),
      failedBatches
    });
    progressPack.metadata = {
      ...(progressPack.metadata || {}),
      importCoverage: progressCoverage,
      importScope: applyImportCompletionFromCoverage(importScope, progressCoverage),
      partialDraft: true
    };
    if (options.autoImportPlan && typeof options.autoImportPlan === 'object' && !Array.isArray(options.autoImportPlan)) {
      progressPack.metadata.autoImportPlan = options.autoImportPlan;
    }
    if (importSelection) progressPack.metadata.importSelection = importSelection;
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(progressPack, null, 2)}\n`);
    recordProgress('adaptive_progress_saved', `Saved progress after batch ${batch.batchIndex} of ${batches.length}.`, {
      batchIndex: batch.batchIndex,
      totalBatches: batches.length,
      outputPath
    });
  }

  const pack = mergeGeneratedBatchPacks(generatedBatches, {
    extraction,
    packName,
    importScope,
    fallbackPack: basePack
  });
  const coverageReport = buildImportCoverageReport({
    extraction: originalExtraction,
    pack,
    sourceManifest,
    sourceChunks,
    processedChunks: processedChunksFromManifest(sourceManifest, sourceChunks),
    failedBatches
  });
  const finalizedImportScope = applyImportCompletionFromCoverage(importScope, coverageReport);
  const sourceEvidenceReport = applySourceEvidenceValidation(pack, extraction);
  pack.metadata = {
    ...(pack.metadata || {}),
    importCoverage: coverageReport,
    importScope: finalizedImportScope,
    sourceEvidenceValidation: sourceEvidenceReport,
    partialDraft: coverageReport.coverageSummary.failedChunks > 0 || coverageReport.coverageSummary.noItemsFoundChunks > 0
  };
  if (options.autoImportPlan && typeof options.autoImportPlan === 'object' && !Array.isArray(options.autoImportPlan)) {
    pack.metadata.autoImportPlan = options.autoImportPlan;
  }
  if (importSelection) pack.metadata.importSelection = importSelection;
  warnings.push(...coverageReport.warnings);
  warnings.push(...sourceEvidenceReport.warnings);
  recordProgress('merge_complete', 'Merging batch results', {
    totalBatches: batches.length,
    itemCounts: countGeneratedItems(pack)
  });
  recordProgress('coverage_report_built', 'Building coverage report', {
    totalChunks: coverageReport.totalChunks,
    processedChunks: coverageReport.processedChunks,
    chunksWithDraftItems: coverageReport.chunksWithDraftItems,
    warnings: coverageReport.warnings || []
  });
  const draftSafetyErrors = validateDraftSafety(pack);
  if (!hasAnyReviewableGeneratedItems(pack)) {
    const invalidItems = Array.isArray(pack && pack.metadata && pack.metadata.invalidGeneratedItems)
      ? pack.metadata.invalidGeneratedItems
      : [];
    const errors = [
      'No usable draft items were created from this upload.',
      ...buildInvalidGeneratedItemTechnicalErrors(invalidItems)
    ];
    recordProgress('error', 'No usable draft items were created from this upload.', {
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
        normalizedDraftAttempt: pack,
        failedBatches,
        invalidItems,
        errors
      }, null, 2)),
      timeline,
      coverageReport,
      importSelection,
      importScope: finalizedImportScope,
      selectedImportEstimate,
      failedBatches
    });
  }
  const validation = validateKnowledgePack(pack, { standardsBank, standardsPaused: true });
  warnings.push(...validation.warnings);
  if (draftSafetyErrors.length > 0 || !validation.valid) {
    const validationErrors = [...draftSafetyErrors, ...validation.errors];
    return blocked({
      packId: pack && pack.packId,
      warnings,
      errors: validationErrors,
      validationPassed: false,
      rawModelResponsePath: writeRawResponse(options, JSON.stringify({
        rawModelResponses,
        normalizedDraftAttempt: pack,
        failedBatches,
        errors: validationErrors
      }, null, 2)),
      timeline,
      coverageReport,
      importSelection,
      importScope: finalizedImportScope,
      selectedImportEstimate,
      failedBatches
    });
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`);
  recordProgress('draft_ready', 'Draft ready for review', {
    packId: pack.packId,
    outputPath,
    itemCounts: countGeneratedItems(pack)
  });

  return {
    success: true,
    partialDraft: pack.metadata.partialDraft === true,
    packId: pack.packId,
    title: pack.title || pack.packId,
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
    errors: [],
    failedBatches
  };
}

function mergeGeneratedBatchPacks(generatedBatches, options = {}) {
  const safeGeneratedBatches = Array.isArray(generatedBatches) ? generatedBatches : [];
  if (!safeGeneratedBatches.length) {
    return cloneJson(options.fallbackPack) || normalizeDraftKnowledgePack({}, options);
  }
  if (safeGeneratedBatches.length === 1) return safeGeneratedBatches[0].pack;
  return mergeDraftKnowledgePacks(safeGeneratedBatches.map((entry) => entry.pack), options);
}

function chunkIndexesFromBatch(batch) {
  return Array.from(new Set((Array.isArray(batch && batch.chunks) ? batch.chunks : [])
    .map((chunk, index) => Number(chunk.sourceChunkIndex || chunk.chunkIndex || chunk.index || index + 1))
    .filter((value) => Number.isFinite(value) && value > 0)));
}

function markManifestChunkStatus(sourceManifest = [], chunkIndexes = [], nextStatus = 'queued') {
  const lookup = new Set(chunkIndexes.map(Number));
  return sourceManifest.map((entry) => {
    const chunkIndex = Number(entry && entry.chunkIndex || 0);
    if (!lookup.has(chunkIndex)) return entry;
    const current = String(entry.status || 'queued');
    if (current === 'skipped_empty' || current === 'needs_review') return entry;
    return {
      ...entry,
      status: nextStatus
    };
  });
}

function countCoreKnowledgeItems(pack = {}) {
  const vocabulary = Array.isArray(pack.vocabulary) ? pack.vocabulary.length : 0;
  const concepts = Array.isArray(pack.concepts) ? pack.concepts.length : 0;
  const referenceFormulas = Array.isArray(pack.referenceFormulas) ? pack.referenceFormulas.length : 0;
  return vocabulary + concepts + referenceFormulas;
}

function processedChunksFromManifest(sourceManifest = [], sourceChunks = []) {
  const chunkByIndex = new Map((Array.isArray(sourceChunks) ? sourceChunks : []).map((chunk) => [
    Number(chunk.sourceChunkIndex || chunk.chunkIndex || chunk.index || 0),
    chunk
  ]));
  return sourceManifest
    .filter((entry) => ['drafted', 'no_items_found', 'failed_after_retries'].includes(String(entry.status || '')))
    .map((entry) => {
      const chunkIndex = Number(entry.chunkIndex || 0);
      const sourceChunk = chunkByIndex.get(chunkIndex);
      return {
        id: entry.chunkId || `chunk-${chunkIndex}`,
        label: entry.sourceLocation || sourceChunk && sourceChunk.label || `Chunk ${chunkIndex}`,
        page: Number(sourceChunk && sourceChunk.page || sourceChunk && sourceChunk.pageNumber || 0),
        sourceChunkIndex: chunkIndex
      };
    });
}

function writePartialDraftFromSuccessfulBatches({
  generatedBatches,
  extraction,
  originalExtraction,
  packName,
  importScope,
  importSelection,
  importEstimate,
  selectedImportEstimate,
  inputSnapshot,
  sourceChunks,
  failedBatches,
  generationErrors,
  standardsBank,
  warnings,
  outputDraftDir,
  force,
  options,
  timeline,
  recordProgress
}) {
  const safeGeneratedBatches = Array.isArray(generatedBatches) ? generatedBatches : [];
  const safeFailedBatches = Array.isArray(failedBatches) ? failedBatches : [];
  const pack = safeGeneratedBatches.length === 1
    ? safeGeneratedBatches[0].pack
    : mergeDraftKnowledgePacks(safeGeneratedBatches.map((entry) => entry.pack), {
        extraction,
        packName,
        importScope
      });
  const itemCounts = countGeneratedItems(pack);
  const generatedItemTotal = Object.values(itemCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  if (generatedItemTotal <= 0) {
    recordProgress('partial_draft_empty', 'No usable draft items were produced before the failed batch.', {
      failedBatches: safeFailedBatches.length
    });
    return {
      success: false,
      hasGeneratedItems: false,
      errors: ['No usable draft items were produced before the failed batch.'],
      warnings,
      timeline,
      failedBatches: safeFailedBatches
    };
  }

  const processedChunks = safeGeneratedBatches.flatMap((entry) => entry.batch.chunks);
  const coverageReport = buildImportCoverageReport({
    extraction: originalExtraction || extraction,
    pack,
    sourceManifest: originalExtraction && originalExtraction.sourceManifest,
    sourceChunks,
    processedChunks,
    failedBatches: safeFailedBatches
  });
  const sourceEvidenceReport = applySourceEvidenceValidation(pack, extraction);
  pack.metadata = {
    ...(pack.metadata || {}),
    importCoverage: coverageReport,
    importScope: {
      ...(importScope || {}),
      rangeLimited: true,
      completePacketImported: false,
      warning: 'Some slides could not be analyzed. Review the extracted items below, then retry the failed slides later if needed.'
    },
    partialImport: {
      completePacketImported: false,
      note: 'Some slides could not be analyzed. Review the extracted items below, then retry the failed slides later if needed.',
      failedBatches: safeFailedBatches,
      failedPages: Array.from(new Set(safeFailedBatches.flatMap((batch) => Array.isArray(batch.pages) ? batch.pages : []))).sort((a, b) => a - b),
      processedPages: Array.from(new Set(processedChunks.map((chunk) => Number(chunk.pageNumber || chunk.page || 0)).filter((page) => Number.isFinite(page) && page > 0))).sort((a, b) => a - b)
    },
    partialDraft: true,
    failedBatches: safeFailedBatches,
    sourceEvidenceValidation: sourceEvidenceReport
  };
  if (options.autoImportPlan && typeof options.autoImportPlan === 'object' && !Array.isArray(options.autoImportPlan)) {
    pack.metadata.autoImportPlan = options.autoImportPlan;
  }
  if (importSelection) pack.metadata.importSelection = importSelection;

  warnings.push('Some slides could not be analyzed. Review the extracted items below, then retry the failed slides later if needed.');
  warnings.push(...coverageReport.warnings);
  warnings.push(...sourceEvidenceReport.warnings);
  recordProgress('partial_draft_ready', 'Partial review draft created from successful batches.', {
    packId: pack.packId,
    itemCounts,
    failedBatches: safeFailedBatches.length
  });

  const draftSafetyErrors = validateDraftSafety(pack);
  const validation = validateKnowledgePack(pack, { standardsBank, standardsPaused: true });
  warnings.push(...validation.warnings);
  if (draftSafetyErrors.length > 0 || !validation.valid) {
    const validationErrors = [...draftSafetyErrors, ...validation.errors];
    recordProgress('error', 'Partial draft had generated items, but validation found fields that need repair.', {
      errors: validationErrors,
      validationPassed: false
    });
    return {
      success: false,
      hasGeneratedItems: true,
      packId: pack && pack.packId,
      warnings,
      errors: validationErrors,
      validationPassed: false,
      rawModelResponsePath: writeRawResponse(options, JSON.stringify({
        normalizedPartialDraftAttempt: pack,
        failedBatches: safeFailedBatches,
        errors: validationErrors
      }, null, 2)),
      timeline,
      coverageReport,
      failedBatches: safeFailedBatches
    };
  }

  const safePackId = pack.packId;
  const outputDir = path.join(outputDraftDir, safePackId);
  const outputPath = path.join(outputDir, KNOWLEDGE_PACK_FILE_NAME);
  if (fs.existsSync(outputPath) && !force) {
    recordProgress('error', `Draft pack already exists at ${outputPath}.`, {
      packId: safePackId
    });
    return {
      success: false,
      hasGeneratedItems: true,
      packId: safePackId,
      outputPath,
      warnings,
      errors: [`Draft pack already exists at ${outputPath}. Pass force: true to overwrite.`],
      validationPassed: true,
      timeline,
      coverageReport,
      failedBatches: safeFailedBatches
    };
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`);
  recordProgress('draft_ready', 'Partial draft ready for review', {
    packId: safePackId,
    outputPath,
    itemCounts,
    failedBatches: safeFailedBatches.length
  });

  return {
    success: true,
    partialDraft: true,
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
    importScope: pack.metadata.importScope,
    selectedImportEstimate,
    timeline,
    outputPath,
    validationPassed: true,
    warnings,
    errors: [],
    failedBatches: safeFailedBatches
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

  const cleanedValidation = validateKnowledgePack(cleanedPack, { standardsBank, standardsPaused: true });
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
    sourceManifest: extraction && extraction.sourceManifest,
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
    rawModelResponse = await callModelClientWithTimeout(modelClient, {
      model,
      prompt,
      timeoutMs,
      keepAlive,
      options: makeDeterministicModelOptions(options)
    }, timeoutMs);
  } catch (error) {
    const modelTimeout = isModelTimeoutError(error);
    const errors = modelTimeout
      ? makeModelTimeoutBatchErrors(
        batch,
        batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches,
        [error.message],
        { model, previewMaxCharacters: previewMaxCharacters(options), previewOnly: options.previewOnly === true || options.importMode === 'preview' }
      )
      : makeModelBatchErrors(
        batch,
        batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches,
        [error.message],
        false,
        { model, previewMaxCharacters: previewMaxCharacters(options), previewOnly: options.previewOnly === true || options.importMode === 'preview' }
      );
    return {
      success: false,
      rawModelResponse,
      modelCrash: modelTimeout || isModelCrashError(error),
      modelTimeout,
      errors,
      failedBatches: [makeFailedBatchWarning(batch, errors)]
    };
  }

  let parsedResult = parseModelResponse(rawModelResponse);
  if (!parsedResult.success && retryInvalidJson) {
    let retryRawModelResponse;
    try {
      retryRawModelResponse = await callModelClientWithTimeout(modelClient, {
        model,
        prompt: buildJsonRepairPrompt(rawModelResponse),
        timeoutMs,
        keepAlive,
        options: makeDeterministicModelOptions(options)
      }, timeoutMs);
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
      ? 'Large upload detected. Charlemagne will use adaptive sequential chunking automatically.'
      : '',
    hardStopMessage: hardStopReasons.length
      ? 'Upload exceeds single-pass thresholds and must run through adaptive sequential chunking.'
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
        sourceChunkIndex: page.sourceChunkIndex || page.chunkIndex,
        chunkIndex: page.sourceChunkIndex || page.chunkIndex,
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
      sourceChunkIndex: page.sourceChunkIndex || page.chunkIndex,
      chunkIndex: page.sourceChunkIndex || page.chunkIndex,
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

function applyImportCompletionFromCoverage(importScope = {}, coverageReport = {}) {
  const scope = importScope && typeof importScope === 'object' ? { ...importScope } : {};
  if (scope.scope !== 'full_document') return scope;
  const complete = coverageReport && coverageReport.allChunksTerminal === true;
  if (complete) {
    scope.completePacketImported = true;
    scope.rangeLimited = false;
    return scope;
  }
  scope.completePacketImported = false;
  scope.rangeLimited = true;
  if (!nonEmptyString(scope.warning)) {
    scope.warning = 'This draft still has queued source chunks and is not fully complete yet.';
  }
  return scope;
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
    sourceChunkIndex: chunk.sourceChunkIndex || chunk.chunkIndex,
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
  const selectedText = selectedSections.map((section) => section.text).join('\n\n');
  return {
    ...extraction,
    text: selectedText,
    pages: importSelection.kind === 'pages' ? selectedSections : undefined,
    sections: selectedSections.map((section, index) => ({
      label: section.label || section.sourceLocation || `Chunk ${index + 1}`,
      sourceLocation: section.sourceLocation || section.label || `Chunk ${index + 1}`,
      pageNumber: section.pageNumber,
      sourceChunkIndex: section.sourceChunkIndex || section.chunkIndex || index + 1,
      chunkIndex: section.sourceChunkIndex || section.chunkIndex || index + 1,
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
      originalChunkCount: importSelection.originalChunkCount,
      characterCount: selectedText.length
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
    const sourceChunkIndex = positiveInteger(section.sourceChunkIndex || section.chunkIndex || sectionIndex + 1, sectionIndex + 1);
    const label = firstNonEmptyString(section.label, section.sourceLocation, `Chunk ${sectionIndex + 1}`);
    const text = String(section.text || '');
    if (text.length <= maxChunkCharacters) {
      chunks.push(makePromptChunk({
        section,
        label,
        text,
        chunkIndex: chunks.length + 1,
        sourceChunkIndex
      }));
      return;
    }

    splitLongText(text, maxChunkCharacters).forEach((part, partIndex) => {
      chunks.push(makePromptChunk({
        section,
        label: `${label} / Chunk ${partIndex + 1}`,
        text: part,
        chunkIndex: chunks.length + 1,
        sourceChunkIndex
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
    sourceChunkIndex: positiveInteger(section.sourceChunkIndex || section.chunkIndex || index + 1, index + 1),
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
        const defaultLabel = `Page ${pageNumber}`;
        return {
          sourceChunkIndex: positiveInteger(page.sourceChunkIndex || page.chunkIndex || index + 1, index + 1),
          label: firstNonEmptyString(page.label, page.sourceLocation, defaultLabel),
          sourceLocation: firstNonEmptyString(page.sourceLocation, page.label, defaultLabel),
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

function makePromptChunk({ section, label, text, chunkIndex, sourceChunkIndex }) {
  return {
    id: `chunk-${chunkIndex}`,
    index: chunkIndex,
    sourceChunkIndex: Number(sourceChunkIndex || chunkIndex),
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
      importProfile: normalizeImportProfile(options.importProfile),
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
      importProfile: normalizeImportProfile(options.importProfile),
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
    : mergeDraftKnowledgePacks(packs, {
      extraction: originalBatch.extraction,
      packName,
      importProfile: normalizeImportProfile(options.importProfile),
      importScope
    });

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
    invalidGeneratedItems: mergeInvalidGeneratedItems(
      packs.flatMap((pack) => (Array.isArray(pack && pack.metadata && pack.metadata.invalidGeneratedItems)
        ? pack.metadata.invalidGeneratedItems
        : [])),
      base.metadata && base.metadata.invalidGeneratedItems
    ),
    importWarnings: mergeImportWarnings(
      packs.flatMap((pack) => (Array.isArray(pack && pack.metadata && pack.metadata.importWarnings)
        ? pack.metadata.importWarnings
        : [])),
      base.metadata && base.metadata.importWarnings
    ),
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
  return normalizeFormulaEquation(item && item.equation) || normalizeKey(firstNonEmptyString(item.formulaId, item.title));
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
  const modelOptions = {
    temperature: numberOrDefault(options.temperature ?? process.env.IMPORT_MODEL_TEMPERATURE, DEFAULT_MODEL_TEMPERATURE),
    seed: positiveInteger(options.seed ?? process.env.IMPORT_MODEL_SEED, DEFAULT_MODEL_SEED),
    top_p: numberOrDefault(options.topP ?? options.top_p ?? process.env.IMPORT_MODEL_TOP_P, DEFAULT_MODEL_TOP_P),
    top_k: positiveInteger(options.topK ?? options.top_k ?? process.env.IMPORT_MODEL_TOP_K, DEFAULT_MODEL_TOP_K)
  };
  const numCtx = positiveIntegerOrUndefined(
    options.numCtx
    ?? options.num_ctx
    ?? process.env.OLLAMA_IMPORT_NUM_CTX
    ?? process.env.IMPORT_MODEL_NUM_CTX
  );
  const numPredict = positiveIntegerOrUndefined(
    options.numPredict
    ?? options.num_predict
    ?? process.env.OLLAMA_IMPORT_NUM_PREDICT
    ?? process.env.IMPORT_MODEL_NUM_PREDICT
  );
  if (numCtx) modelOptions.num_ctx = numCtx;
  if (numPredict) modelOptions.num_predict = numPredict;
  return modelOptions;
}

function resolveImportModel(options = {}) {
  return firstNonEmptyString(
    options.model,
    process.env.OLLAMA_IMPORT_MODEL,
    process.env.OLLAMA_MODEL,
    DEFAULT_MODEL
  );
}

function positiveIntegerOrUndefined(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
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
  return Boolean(result && !result.modelTimeout && (result.modelCrash || (result.errors || []).some((error) => isModelCrashMessage(error))));
}

function isModelCrashError(error) {
  return isModelCrashMessage(error && error.message);
}

function isModelTimeoutError(error) {
  return Boolean(error && (error.code === MODEL_GENERATION_TIMEOUT_CODE || isModelTimeoutMessage(error.message)));
}

function isModelCrashMessage(value) {
  const message = String(value || '').toLowerCase();
  return message.includes('ollama returned http 500')
    || message.includes('ggml_assert')
    || message.includes('signal arrived during cgo execution')
    || message.includes('llama runner process has terminated')
    || message.includes('model runner has unexpectedly stopped')
    || message.includes('resource limitations')
    || message.includes('internal error');
}

function isModelTimeoutMessage(value) {
  const message = String(value || '').toLowerCase();
  return message.includes('local gemma took too long while reading this batch')
    || message.includes('ollama request timed out')
    || message.includes('request timed out')
    || message.includes('timed out')
    || message.includes('timeout');
}

function makeModelBatchErrors(batch, totalBatches, underlyingErrors = [], afterRetry = false, context = {}) {
  const batchIndex = batch && batch.batchIndex || 1;
  const total = Number(totalBatches || batch && batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches || 1);
  const labels = Array.isArray(batch && batch.chunks) ? batch.chunks.map((chunk) => chunk.label).filter(Boolean) : [];
  const pageLabels = labels.length ? ` Affected source chunks/pages: ${labels.join(', ')}.` : '';
  const retryText = afterRetry
    ? 'Retry failed after a smaller batch.'
    : 'Retrying once with a smaller batch.';
  const original = underlyingErrors.map((error) => String(error || '').trim()).filter(Boolean).join('; ');
  const previewLimitText = context.previewOnly ? ` Current preview character limit: ${previewMaxCharacters({ previewMaxCharacters: context.previewMaxCharacters })}.` : '';
  const modelText = context.model ? ` Current model: ${context.model}.` : '';
  return [
    `Local Gemma crashed while reading batch ${batchIndex} of ${total}. ${retryText}${pageLabels}`,
    [modelText.trim(), previewLimitText.trim()].filter(Boolean).join(' '),
    original ? `Ollama detail for batch ${batchIndex}: ${original}` : ''
  ].filter(Boolean);
}

function makeModelTimeoutBatchErrors(batch, totalBatches, underlyingErrors = [], context = {}) {
  const batchIndex = batch && batch.batchIndex || 1;
  const total = Number(totalBatches || batch && batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches || 1);
  const labels = Array.isArray(batch && batch.chunks) ? batch.chunks.map((chunk) => chunk.label).filter(Boolean) : [];
  const pageLabels = labels.length ? ` Affected source chunks/pages: ${labels.join(', ')}.` : '';
  const original = underlyingErrors.map((error) => String(error || '').trim()).filter(Boolean).join('; ');
  const previewLimitText = context.previewOnly ? ` Current preview character limit: ${previewMaxCharacters({ previewMaxCharacters: context.previewMaxCharacters })}.` : '';
  const modelText = context.model ? ` Current model: ${context.model}.` : '';
  return [
    MODEL_GENERATION_TIMEOUT_MESSAGE,
    `Gemma timed out while reading batch ${batchIndex} of ${total}.${pageLabels}`,
    [modelText.trim(), previewLimitText.trim()].filter(Boolean).join(' '),
    original && original !== MODEL_GENERATION_TIMEOUT_MESSAGE ? `Ollama detail for batch ${batchIndex}: ${original}` : ''
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

function callModelClientWithTimeout(modelClient, request, timeoutMs) {
  const ms = Number(timeoutMs || 0);
  if (!Number.isFinite(ms) || ms <= 0) {
    return modelClient(request);
  }

  let timeoutId;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(MODEL_GENERATION_TIMEOUT_MESSAGE);
      error.code = MODEL_GENERATION_TIMEOUT_CODE;
      reject(error);
    }, ms);
  });

  return Promise.race([
    Promise.resolve().then(() => modelClient(request)),
    timeoutPromise
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
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
    'Convert the following attempted response into valid JSON.',
    'Return JSON only. Do not add new facts.',
    'Use only this top-level shape:',
    JSON.stringify({
      vocabulary: [],
      concepts: [],
      referenceFormulas: [],
      uncertainSections: []
    }),
    '',
    'Attempted response:',
    String(rawModelResponse || '')
  ].join('\n');
}

function normalizeDraftKnowledgePack(pack, options = {}) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return pack;

  const normalized = normalizeCompactModelOutput(pack);
  const unsupportedTopLevelArrays = collectUnsupportedTopLevelModelArrays(pack);
  const sourceDefaults = makeSourceDefaults(options.extraction);
  const importProfile = normalizeImportProfile(options.importProfile || sourceDefaults.importProfile);
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
  normalized.subject = sourceDefaults.subject || (importProfile === 'physical_science' ? 'Physical Science' : 'Teacher Uploaded Content');
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
    importProfile,
    importScope: options.importScope
  });
  if (unsupportedTopLevelArrays.length > 0) {
    normalized.metadata.invalidGeneratedItems = mergeInvalidGeneratedItems(
      normalized.metadata.invalidGeneratedItems,
      unsupportedTopLevelArrays
    );
  }

  normalized.sourceFiles = normalizeSourceFiles(normalized.sourceFiles, options.extraction, sourceDefaults);
  normalized.vocabulary = normalized.vocabulary.map((item, index) => normalizeVocabularyItem(item, sourceDefaults, index));
  normalized.concepts = normalized.concepts.map((item, index) => normalizeConceptItem(item, sourceDefaults, index));
  normalized.referenceFormulas = normalized.referenceFormulas.map((item, index) => normalizeReferenceFormula(item, sourceDefaults, index));
  addSourceDerivedVocabulary(normalized, options.extraction, sourceDefaults);
  addSourceDerivedConcepts(normalized, options.extraction, sourceDefaults);
  addSourceDerivedReferenceFormulas(normalized, options.extraction, sourceDefaults);
  recoverConceptExplanationsFromSource(normalized, options.extraction);
  recoverVocabularyDefinitionsFromSource(normalized, options.extraction);
  cleanupConceptTitles(normalized, options.extraction, importProfile);
  applyVocabularyQualityGates(normalized, options.extraction, importProfile);
  applyFormulaQualityGates(normalized, options.extraction, importProfile);
  normalized.problemBank = normalized.problemBank.map((item, index) => normalizeProblemItem(item, sourceDefaults, index));
  normalized.standardsMap = normalized.standardsMap.map((item, index) => normalizeStandardsMapItem(item, index));
  normalized.smokeTests = normalized.smokeTests.map((item, index) => normalizeSmokeTest(item, index));
  const salvageReport = salvageGeneratedItemSections(normalized, options.extraction);
  if (salvageReport.invalidItems.length > 0) {
    normalized.metadata.invalidGeneratedItems = mergeInvalidGeneratedItems(
      normalized.metadata.invalidGeneratedItems,
      salvageReport.invalidItems
    );
    normalized.metadata.importWarnings = mergeImportWarnings(
      normalized.metadata.importWarnings,
      salvageReport.importWarnings
    );
  }
  normalized.metadata.deduplication = dedupeDraftItems(normalized);
  normalized.metadata.importNormalization = buildImportNormalizationReport(normalized);

  return normalized;
}

function normalizeCompactModelOutput(pack = {}) {
  const normalized = { ...(pack || {}) };
  delete normalized.results;
  normalized.vocabulary = Array.isArray(normalized.vocabulary) ? normalized.vocabulary : [];
  normalized.concepts = Array.isArray(normalized.concepts) ? normalized.concepts : [];
  normalized.referenceFormulas = Array.isArray(normalized.referenceFormulas) ? normalized.referenceFormulas : [];
  normalized.problemBank = Array.isArray(normalized.problemBank) ? normalized.problemBank : [];
  normalized.standardsMap = Array.isArray(normalized.standardsMap) ? normalized.standardsMap : [];
  normalized.smokeTests = Array.isArray(normalized.smokeTests) ? normalized.smokeTests : [];
  normalized.sourceFiles = Array.isArray(normalized.sourceFiles) ? normalized.sourceFiles : [];

  const uncertainSections = Array.isArray(pack && pack.uncertainSections)
    ? pack.uncertainSections
      .map((entry) => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          return {
            sourceLocation: String(entry.sourceLocation || entry.location || '').trim(),
            note: String(entry.note || entry.reason || '').trim()
          };
        }
        const text = String(entry || '').trim();
        return text ? { sourceLocation: '', note: text } : null;
      })
      .filter((entry) => entry && (entry.sourceLocation || entry.note))
    : [];

  if (!normalized.metadata || typeof normalized.metadata !== 'object' || Array.isArray(normalized.metadata)) {
    normalized.metadata = {};
  }
  if (uncertainSections.length > 0) {
    normalized.metadata.importUncertainSections = uncertainSections;
  }

  delete normalized.uncertainSections;
  return normalized;
}

function collectUnsupportedTopLevelModelArrays(pack = {}) {
  const unsupported = [];
  if (Array.isArray(pack.results) && pack.results.length > 0) {
    unsupported.push({
      section: 'results',
      index: 0,
      reason: 'Ignored unsupported top-level model output array: results.',
      originalItem: {
        count: pack.results.length
      }
    });
  }
  return unsupported;
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
      normalized.label,
      normalized.name,
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
    standards: makeDefaultStandardsMetadata()
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
      toDisplayLabelFromId(normalized.conceptId),
      normalized.label,
      normalized.name,
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
  ['aliases', 'keyIdeas', 'examples', 'nonExamples', 'commonMisconceptions'].forEach((field) => {
    if (!Array.isArray(normalized[field])) normalized[field] = [];
  });
  normalized.standards = makeDefaultStandardsMetadata();
  return normalizeSourceTracking(normalizeReviewFields(normalized), sourceDefaults);
}

function normalizeReferenceFormula(item, sourceDefaults, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = normalizeSourceTracking(normalizeReviewFields({
    ...item,
    variables: Array.isArray(item.variables) ? item.variables : [],
    standards: makeDefaultStandardsMetadata(),
    solverStatus: 'reference_only'
  }), sourceDefaults);
  if (!nonEmptyString(normalized.equation)) {
    const recoveredEquation = deriveEquationText(normalized);
    if (recoveredEquation) {
      normalized.equation = recoveredEquation;
      normalized = addNormalizationNote(normalized, 'Recovered formula equation during import normalization.');
    }
  }
  if (!nonEmptyString(normalized.title) && nonEmptyString(normalized.equation)) {
    normalized.title = makeFormulaTitle(normalized.equation, index);
    normalized = addNormalizationNote(normalized, 'Generated formula title during import normalization.');
  } else if (!nonEmptyString(normalized.title)) {
    const recoveredTitle = deriveShortTitle([
      normalized.title,
      normalized.label,
      normalized.name,
      normalized.formulaName,
      toDisplayLabelFromId(normalized.formulaId),
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ]);
    if (recoveredTitle) {
      normalized.title = recoveredTitle;
      normalized = addNormalizationNote(normalized, 'Recovered formula title during import normalization.');
    }
  }
  if (!nonEmptyString(normalized.formulaId)) {
    normalized.formulaId = makeGeneratedItemId('formula', [
      normalized.title,
      normalized.equation,
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ], index, sourceDefaults);
    normalized = addNormalizationNote(normalized, 'Generated formula ID during import normalization.');
  }
  const repairedEquation = repairReferenceEquation(
    normalized.equation,
    [
      normalized.sourceTextSnippet,
      normalized.studentExplanation,
      normalized.notes,
      normalized.title
    ].filter(nonEmptyString).join(' ')
  );
  if (repairedEquation.changed) {
    normalized.equation = repairedEquation.equation;
    normalized = addNormalizationNote(normalized, repairedEquation.note || 'Repaired extracted formula text during import normalization.');
  }
  if (!nonEmptyString(normalized.title) || /reference formula$/iu.test(String(normalized.title || '').trim())) {
    normalized.title = makeFormulaTitle(normalized.equation, index);
  }
  if (looksExtractionDamagedFormula(normalized.equation)) {
    return addNormalizationNote(normalized, 'Formula text may be extraction-damaged; keep pending teacher review.');
  }
  return normalized;
}

function salvageGeneratedItemSections(pack, extraction) {
  const invalidItems = [];
  const importWarnings = [];
  const pushInvalid = (entry) => {
    invalidItems.push(entry);
    importWarnings.push(formatInvalidGeneratedItemWarning(entry));
  };

  const vocabulary = Array.isArray(pack && pack.vocabulary) ? pack.vocabulary : [];
  pack.vocabulary = vocabulary.filter((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      pushInvalid({
        section: 'vocabulary',
        index,
        reason: 'Entry was not a JSON object.',
        requiredField: 'term'
      });
      return false;
    }
    if (nonEmptyString(item.term)) return true;
    const recoveredTerm = deriveShortTitle([
      item.title,
      item.label,
      item.name,
      item.word,
      item.synonym,
      item.synonyms,
      item.alias,
      item.aliases
    ]);
    if (recoveredTerm) {
      item.term = recoveredTerm;
      Object.assign(item, addNormalizationNote(item, 'Recovered vocabulary term during item-level salvage.'));
    }
    if (!nonEmptyString(item.term)) {
      pushInvalid({
        section: 'vocabulary',
        index,
        reason: 'Missing required term and no usable title/label/name was available.',
        requiredField: 'term'
      });
      return false;
    }
    if (isVocabularySectionLabel(item.term)) {
      pushInvalid({
        section: 'vocabulary',
        index,
        reason: `Vocabulary term "${item.term}" matched a section label and was removed.`,
        requiredField: 'term'
      });
      return false;
    }
    if (!hasQuarantineMarker(item) && (isMissingDraftWordingValue(item.studentDefinition) || isMissingDraftWordingValue(item.teacherDefinition))) {
      const evidence = makeItemEvidenceText(item, extraction);
      const recoveredDefinition = recoverVocabularyDefinitionText(item, evidence, extraction);
      if (recoveredDefinition) {
        if (isMissingDraftWordingValue(item.studentDefinition)) item.studentDefinition = recoveredDefinition;
        if (isMissingDraftWordingValue(item.teacherDefinition)) item.teacherDefinition = recoveredDefinition;
        Object.assign(item, addNormalizationNote(item, 'Recovered vocabulary definition wording during item-level salvage.'));
      }
    }
    if (hasQuarantineMarker(item) || (!isMissingDraftWordingValue(item.studentDefinition) && !isMissingDraftWordingValue(item.teacherDefinition))) return true;
    pushInvalid({
      section: 'vocabulary',
      index,
      reason: 'Missing required studentDefinition/teacherDefinition and recovery failed.',
      requiredField: 'studentDefinition/teacherDefinition'
    });
    return false;
  });

  const concepts = Array.isArray(pack && pack.concepts) ? pack.concepts : [];
  pack.concepts = concepts.filter((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      pushInvalid({
        section: 'concepts',
        index,
        reason: 'Entry was not a JSON object.',
        requiredField: 'title'
      });
      return false;
    }
    if (nonEmptyString(item.title)) {
      const cleanedTitle = normalizeConceptHeading(item.title);
      if (cleanedTitle && cleanedTitle !== item.title) {
        item.title = cleanedTitle;
        Object.assign(item, addNormalizationNote(item, 'Normalized concept title wording during item-level salvage.'));
      }
    }
    if (!nonEmptyString(item.title)) {
      const recoveredTitle = deriveShortTitle([
        item.title,
        item.label,
        item.name,
        item.concept,
        item.claim,
        item.summary,
        item.explanation,
        item.studentExplanation,
        conceptIdTitleCandidate(item.conceptId)
      ]);
      if (recoveredTitle) {
        item.title = normalizeConceptHeading(recoveredTitle);
        Object.assign(item, addNormalizationNote(item, 'Recovered concept title during item-level salvage.'));
      }
    }
    if (!nonEmptyString(item.title)) {
      pushInvalid({
        section: 'concepts',
        index,
        reason: 'Missing required title and no usable concept wording was available.',
        requiredField: 'title'
      });
      return false;
    }
    const needsExplanationRecovery = isMissingDraftWordingValue(item.studentExplanation) || isLearningTargetSentence(item.studentExplanation);
    if (!hasQuarantineMarker(item) && needsExplanationRecovery) {
      const evidence = makeItemEvidenceText(item, extraction);
      const recovered = recoverConceptExplanationText(item, evidence);
      if (recovered) {
        item.studentExplanation = recovered;
        Object.assign(item, addNormalizationNote(item, 'Recovered concept explanation wording during item-level salvage.'));
      }
    }
    if (hasQuarantineMarker(item) || (!isMissingDraftWordingValue(item.studentExplanation) && !isLearningTargetSentence(item.studentExplanation))) return true;
    pushInvalid({
      section: 'concepts',
      index,
      reason: 'Missing usable studentExplanation and recovery failed.',
      requiredField: 'studentExplanation'
    });
    return false;
  });

  const formulas = Array.isArray(pack && pack.referenceFormulas) ? pack.referenceFormulas : [];
  pack.referenceFormulas = formulas.filter((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      pushInvalid({
        section: 'referenceFormulas',
        index,
        reason: 'Entry was not a JSON object.',
        requiredField: 'title/equation'
      });
      return false;
    }
    if (!nonEmptyString(item.equation)) {
      const recoveredEquation = deriveEquationText(item);
      if (recoveredEquation) {
        item.equation = recoveredEquation;
        Object.assign(item, addNormalizationNote(item, 'Recovered formula equation during item-level salvage.'));
      }
    }
    if (!nonEmptyString(item.title) && nonEmptyString(item.equation)) {
      item.title = makeFormulaTitle(item.equation, index);
      Object.assign(item, addNormalizationNote(item, 'Recovered formula title during item-level salvage.'));
    }
    if (!nonEmptyString(item.title)) {
      const recoveredTitle = deriveShortTitle([
        item.title,
        item.label,
        item.name,
        item.formulaName,
        toDisplayLabelFromId(item.formulaId),
        item.sourceTextSnippet,
        item.sourceSnippet
      ]);
      if (recoveredTitle) {
        item.title = recoveredTitle;
        Object.assign(item, addNormalizationNote(item, 'Recovered formula title during item-level salvage.'));
      }
    }
    if (nonEmptyString(item.title) && nonEmptyString(item.equation)) return true;
    pushInvalid({
      section: 'referenceFormulas',
      index,
      reason: 'Missing required title/equation and recovery failed.',
      requiredField: 'title/equation'
    });
    return false;
  });

  return {
    invalidItems,
    importWarnings
  };
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
    standards: makeDefaultStandardsMetadata()
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
    standards: makeDefaultStandardsMetadata(),
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
  return normalizeReviewFields({
    ...normalized,
    standards: makeDefaultStandardsMetadata()
  });
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

function preserveStricterReviewState(target, existing) {
  if (!target || !existing) return target;
  if (existing.reviewStatus === 'needs_review' || existing.confidence === 'low') {
    target.reviewStatus = 'needs_review';
    target.confidence = 'low';
  }
  if (Array.isArray(existing.normalizationNotes) && existing.normalizationNotes.length) {
    target.normalizationNotes = Array.from(new Set([
      ...(Array.isArray(target.normalizationNotes) ? target.normalizationNotes : []),
      ...existing.normalizationNotes
    ]));
  }
  if (nonEmptyString(existing.notes) && !String(target.notes || '').includes(existing.notes)) {
    target.notes = [target.notes, existing.notes].filter(nonEmptyString).join(' ');
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

function addSourceDerivedVocabulary(pack, extraction, sourceDefaults) {
  const candidates = extractVocabularyCandidates(extraction, sourceDefaults);
  if (!candidates.length) return;
  const existing = new Map((Array.isArray(pack.vocabulary) ? pack.vocabulary : [])
    .map((item, index) => [canonicalVocabularyKey(item && item.term), index])
    .filter(([key]) => key));
  candidates.forEach((candidate, index) => {
    const key = canonicalVocabularyKey(candidate.term);
    if (!key) return;
    const deterministicItem = normalizeVocabularyItem({
      vocabId: makeGeneratedItemId('vocab', [candidate.term], index, sourceDefaults),
      term: candidate.term,
      aliases: [],
      studentDefinition: candidate.definition,
      teacherDefinition: candidate.definition,
      misconception: '',
      exampleQuestion: '',
      exampleAnswer: '',
      reviewStatus: 'pending',
      confidence: candidate.confidence,
      sourceFile: candidate.sourceFile || sourceDefaults.sourceFile,
      sourceLocation: candidate.sourceLocation || sourceDefaults.sourceLocation,
      sourceTextSnippet: candidate.sourceTextSnippet,
      sourceParse: 'deterministic_vocabulary_section',
      normalizationNotes: ['Deterministically parsed from a Vocabulary Term: definition source line.']
    }, sourceDefaults, index);
    if (existing.has(key)) {
      const existingIndex = existing.get(key);
      pack.vocabulary[existingIndex] = preserveStricterReviewState(
        mergeVocabularyDuplicate(deterministicItem, pack.vocabulary[existingIndex]),
        pack.vocabulary[existingIndex]
      );
      existing.set(key, existingIndex);
      return;
    }
    existing.set(key, pack.vocabulary.length);
    pack.vocabulary.push(deterministicItem);
  });
}

function extractVocabularyCandidates(extraction, sourceDefaults) {
  const sections = makeFormulaSourceSections(extraction, sourceDefaults);
  const candidates = [];
  sections.forEach((section) => {
    let inVocabulary = false;
    splitSourceLines(section.text).forEach((line) => {
      const cleaned = cleanSourceLine(line);
      if (!cleaned) return;
      if (isVocabularySectionLabel(cleaned)) {
        inVocabulary = true;
        return;
      }
      const sectionLabel = detectSourceSectionLabel(cleaned);
      if (sectionLabel) {
        inVocabulary = sectionLabel === 'vocabulary';
        if (inVocabulary) {
          const afterLabel = stripLeadingSectionLabel(cleaned, VOCAB_SECTION_LABEL_PATTERN);
          const inline = parseVocabularyDefinitionLine(afterLabel);
          if (inline) pushVocabularyCandidate(candidates, inline, section, cleaned);
        }
        return;
      }
      if (!inVocabulary) return;
      const parsed = parseVocabularyDefinitionLine(cleaned);
      if (parsed) pushVocabularyCandidate(candidates, parsed, section, cleaned);
    });
  });
  return mergeVocabularyCandidates(candidates);
}

function pushVocabularyCandidate(candidates, parsed, section, sourceLine) {
  const term = normalizeVocabularyTermFromSource(parsed.term);
  const definition = normalizeRecoveredDefinitionText(parsed.definition, term);
  if (!term || !definition) return;
  if (isVocabularySectionLabel(term)) return;
  if (isFormulaVariableVocabularyTerm(term)) return;
  if (looksFormulaLikeVocabularyLine(term, definition)) return;
  candidates.push({
    term,
    definition,
    confidence: 'high',
    sourceFile: section.sourceFile,
    sourceLocation: section.sourceLocation,
    sourceTextSnippet: sourceLine.slice(0, 240)
  });
}

function splitSourceLines(text) {
  return String(text || '')
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanSourceLine(line) {
  return String(line || '')
    .normalize('NFKC')
    .replace(/[•●▪]/gu, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSourceSectionLabel(line) {
  const cleaned = cleanSourceLine(line).replace(/^[*\-\d.)\s]+/u, '').trim();
  if (!cleaned) return '';
  const bareLabel = normalizeItemKey(cleaned.replace(/[:\-]\s*.*$/u, ''));
  if (new RegExp(`^${VOCAB_SECTION_LABEL_PATTERN}\\b`, 'iu').test(cleaned)) return 'vocabulary';
  if (new RegExp(`^${CONCEPT_LABEL_PATTERN}\\b`, 'iu').test(cleaned)) return 'concept';
  if (new RegExp(`^${FORMULA_LABEL_PATTERN}\\b`, 'iu').test(cleaned)) return 'formula';
  if (/^(?:examples?|practice|review)\b/iu.test(cleaned)) return 'other';
  if (REJECTED_VOCAB_LABEL_KEYS.has(bareLabel)) return 'other';
  return '';
}

function stripLeadingSectionLabel(line, labelPattern) {
  return cleanSourceLine(line)
    .replace(new RegExp(`^${labelPattern}\\s*[:\\-]?\\s*`, 'iu'), '')
    .trim();
}

function parseVocabularyDefinitionLine(line) {
  const match = String(line || '').match(/^[*\-\d.)\s]*([^:]{1,80})\s*:\s*(.{4,260})$/u);
  if (!match) return null;
  return {
    term: match[1],
    definition: match[2]
  };
}

function normalizeVocabularyTermFromSource(value) {
  const term = String(value || '')
    .replace(/^[*\-\d.)\s]+/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;:,]+$/u, '')
    .trim();
  if (!term || term.length > 80) return '';
  if (term.split(/\s+/).length > 6) return '';
  if (/[=]/u.test(term)) return '';
  return term;
}

function mergeVocabularyCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  candidates.forEach((candidate) => {
    const key = canonicalVocabularyKey(candidate.term);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(candidate);
  });
  return unique;
}

function addSourceDerivedReferenceFormulas(pack, extraction, sourceDefaults) {
  const candidates = extractFormulaCandidates(extraction, sourceDefaults);
  if (!candidates.length) return;
  const existing = new Map((Array.isArray(pack.referenceFormulas) ? pack.referenceFormulas : [])
    .map((item, index) => [normalizeFormulaEquation(item && item.equation), index])
    .filter(([key]) => key));
  candidates.forEach((candidate, index) => {
    const equationKey = normalizeFormulaEquation(candidate.equation);
    if (!equationKey) return;
    const deterministicItem = normalizeReferenceFormula({
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
      sourceTextSnippet: candidate.sourceTextSnippet,
      sourceParse: candidate.sourceParse || 'deterministic_formula_line',
      normalizationNotes: ['Deterministically parsed from a labeled source formula line.']
    }, sourceDefaults);
    if (existing.has(equationKey)) {
      const existingIndex = existing.get(equationKey);
      pack.referenceFormulas[existingIndex] = preserveStricterReviewState(
        mergeSourceEvidence(deterministicItem, pack.referenceFormulas[existingIndex]),
        pack.referenceFormulas[existingIndex]
      );
      existing.set(equationKey, existingIndex);
      return;
    }
    existing.set(equationKey, pack.referenceFormulas.length);
    pack.referenceFormulas.push(deterministicItem);
  });
}

function addSourceDerivedConcepts(pack, extraction, sourceDefaults) {
  const candidates = extractConceptCandidates(extraction, sourceDefaults);
  if (!candidates.length) return;
  const existing = new Map((Array.isArray(pack.concepts) ? pack.concepts : [])
    .map((item, index) => [normalizeItemKey(item && item.title), index])
    .filter(([key]) => key));
  candidates.forEach((candidate, index) => {
    const key = normalizeItemKey(candidate.title);
    if (!key) return;
    const deterministicItem = normalizeConceptItem({
      conceptId: makeGeneratedItemId('concept', [candidate.title], index, sourceDefaults),
      title: candidate.title,
      aliases: [],
      studentExplanation: candidate.studentExplanation,
      keyIdeas: [],
      examples: [],
      nonExamples: [],
      commonMisconceptions: [],
      reviewStatus: 'pending',
      confidence: candidate.confidence,
      sourceFile: candidate.sourceFile || sourceDefaults.sourceFile,
      sourceLocation: candidate.sourceLocation || sourceDefaults.sourceLocation,
      sourceTextSnippet: candidate.sourceTextSnippet,
      sourceParse: candidate.sourceParse || 'deterministic_concept_section',
      normalizationNotes: ['Deterministically parsed from a labeled concept source section.']
    }, sourceDefaults);
    if (existing.has(key)) {
      const existingIndex = existing.get(key);
      pack.concepts[existingIndex] = preserveStricterReviewState(
        mergeSourceEvidence(deterministicItem, pack.concepts[existingIndex]),
        pack.concepts[existingIndex]
      );
      existing.set(key, existingIndex);
      return;
    }
    existing.set(key, pack.concepts.length);
    pack.concepts.push(deterministicItem);
  });
}

function extractConceptCandidates(extraction, sourceDefaults) {
  const sections = makeFormulaSourceSections(extraction, sourceDefaults);
  const candidates = [];
  sections.forEach((section) => {
    const lines = splitSourceLines(section.text).map(cleanSourceLine).filter(Boolean);
    lines.forEach((line, lineIndex) => {
      const marker = matchConceptSectionLabel(line);
      if (!marker) return;
      const inlineTitle = stripLeadingSectionLabel(line, CONCEPT_LABEL_PATTERN);
      const nextLine = lines[lineIndex + 1] || '';
      const title = normalizeConceptHeading(inlineTitle || nextLine || marker.label);
      const explanation = extractConceptExplanationFromLines(lines, lineIndex, title, inlineTitle);
      if (!title || !explanation) return;
      candidates.push({
        title,
        studentExplanation: explanation,
        confidence: 'medium',
        sourceFile: section.sourceFile,
        sourceLocation: section.sourceLocation,
        sourceTextSnippet: [line, explanation].filter(Boolean).join(' ').slice(0, 240),
        sourceParse: 'deterministic_concept_section'
      });
    });
    extractStructuredSectionConceptCandidates(lines, section).forEach((candidate) => candidates.push(candidate));
  });
  extractDensityBuoyancyCandidates(sections).forEach((candidate) => candidates.push(candidate));
  return mergeConceptCandidates(candidates);
}

function matchConceptSectionLabel(line) {
  const match = cleanSourceLine(line).match(new RegExp(`^(${CONCEPT_LABEL_PATTERN})\\b`, 'iu'));
  if (!match) return null;
  return {
    label: String(match[1] || '').trim(),
    key: normalizeItemKey(match[1] || '')
  };
}

function extractStructuredSectionConceptCandidates(lines, section) {
  const candidates = [];
  let activeConceptSection = '';
  lines.forEach((line) => {
    const conceptLabel = matchConceptSectionLabel(line);
    if (conceptLabel) {
      activeConceptSection = conceptLabel.key;
      const inline = stripLeadingSectionLabel(line, CONCEPT_LABEL_PATTERN);
      const inlineCandidate = makeStructuredConceptCandidate(inline, activeConceptSection, section, line);
      if (inlineCandidate) candidates.push(inlineCandidate);
      return;
    }
    const sectionType = detectSourceSectionLabel(line);
    if (sectionType && sectionType !== 'concept') {
      activeConceptSection = '';
      return;
    }
    if (!activeConceptSection) return;
    const candidate = makeStructuredConceptCandidate(line, activeConceptSection, section, line);
    if (candidate) candidates.push(candidate);
  });
  return candidates;
}

function makeStructuredConceptCandidate(value, sectionLabelKey, section, sourceLine) {
  const explanation = normalizeStructuredConceptExplanation(value);
  if (!explanation) return null;
  const title = deriveStructuredConceptTitle(explanation, sectionLabelKey);
  if (!title) return null;
  if (isVocabularySectionLabel(title)) return null;
  return {
    title,
    studentExplanation: explanation,
    confidence: 'medium',
    sourceFile: section.sourceFile,
    sourceLocation: section.sourceLocation,
    sourceTextSnippet: String(sourceLine || explanation).slice(0, 240),
    sourceParse: 'deterministic_structured_concept_section'
  };
}

function normalizeStructuredConceptExplanation(value) {
  const stripped = String(value || '')
    .replace(/^[*\-\d.)\s]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  const cleaned = cleanConceptSourceSentence(stripped);
  if (!cleaned) return '';
  if (isVocabularySectionLabel(cleaned)) return '';
  if (looksSlideHeaderLine(cleaned) || isPageHeaderText(cleaned)) return '';
  if (cleaned.length < 20) return '';
  if (!/[A-Za-z]/u.test(cleaned)) return '';
  return cleaned;
}

function deriveStructuredConceptTitle(explanation, sectionLabelKey = '') {
  const raw = String(explanation || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const timelineMatch = raw.match(/^(\d{3,4})\s*[:\-]\s*(.+)$/u);
  if (timelineMatch) {
    const summary = summarizeConceptTitleText(timelineMatch[2], 6);
    const title = `${timelineMatch[1]} ${summary}`.trim();
    return normalizeConceptHeading(title);
  }
  let summarySeed = raw.replace(/\b(?:because|therefore|thus|which led to|led to|leading to|resulting in)\b[\s\S]*$/iu, '').trim();
  if (!summarySeed || summarySeed.split(/\s+/u).length < 2) summarySeed = raw;
  const summary = summarizeConceptTitleText(summarySeed, sectionLabelKey.includes('cause') ? 7 : 8);
  return normalizeConceptHeading(summary);
}

function summarizeConceptTitleText(value, maxWords = 8) {
  const plain = String(value || '')
    .replace(/^[*\-\d.)\s]+/u, '')
    .replace(/[.;:,]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  const words = plain.split(/\s+/u).filter(Boolean).slice(0, maxWords);
  return toTitleWords(words.join(' '));
}

function extractDensityBuoyancyCandidates(sections) {
  const candidates = [];
  const combined = sections.map((section) => String(section.text || '')).join(' ');
  const hasSink = /\b(?:greater|higher|more)\s+density\b[^.]{0,80}\bsink|denser than\b[^.]{0,80}\bsink/iu.test(combined);
  const hasFloat = /\b(?:lower|less)\s+density\b[^.]{0,80}\bfloat|less dense than\b[^.]{0,80}\bfloat/iu.test(combined);
  const hasDisplacementVolume = /\bwater displacement\b[^.]{0,120}\bvolume\b|\bdisplaced water\b[^.]{0,120}\bvolume\b/iu.test(combined);
  const hasBuoyantForce = /\bbuoyant force\b[^.]{0,120}\bdisplac(?:ed|ement)\b|\bfluid displaced\b/iu.test(combined);
  const anchor = sections.find((section) => /density|buoy|displacement|fluid/iu.test(String(section.text || ''))) || sections[0];
  if (!anchor) return candidates;
  if (hasSink) {
    candidates.push({
      title: 'Objects Denser Than the Fluid Sink',
      studentExplanation: 'Objects denser than the fluid usually sink.',
      confidence: 'medium',
      sourceFile: anchor.sourceFile,
      sourceLocation: anchor.sourceLocation,
      sourceTextSnippet: String(anchor.text || '').slice(0, 240)
    });
  }
  if (hasFloat) {
    candidates.push({
      title: 'Objects Less Dense Than the Fluid Float',
      studentExplanation: 'Objects less dense than the fluid usually float.',
      confidence: 'medium',
      sourceFile: anchor.sourceFile,
      sourceLocation: anchor.sourceLocation,
      sourceTextSnippet: String(anchor.text || '').slice(0, 240)
    });
  }
  if (hasDisplacementVolume) {
    candidates.push({
      title: 'Water Displacement and Volume',
      studentExplanation: 'Water displacement can be used to find an object’s volume.',
      confidence: 'medium',
      sourceFile: anchor.sourceFile,
      sourceLocation: anchor.sourceLocation,
      sourceTextSnippet: String(anchor.text || '').slice(0, 240)
    });
  }
  if (hasBuoyantForce) {
    candidates.push({
      title: 'Buoyant Force and Displaced Fluid',
      studentExplanation: 'Buoyant force is related to the amount of fluid displaced by an object.',
      confidence: 'medium',
      sourceFile: anchor.sourceFile,
      sourceLocation: anchor.sourceLocation,
      sourceTextSnippet: String(anchor.text || '').slice(0, 240)
    });
  }
  return candidates;
}

function normalizeConceptHeading(value) {
  const heading = String(value || '').replace(/\s+/g, ' ').trim();
  return cleanConceptTitle(heading);
}

function extractConceptExplanationFromLines(lines, headingIndex, headingTitle, inlineText = '') {
  const buffer = [];
  const inlineSentence = cleanConceptSourceSentence(inlineText);
  if (inlineSentence && !isLearningTargetSentence(inlineSentence)) {
    buffer.push(inlineSentence);
  }
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = String(lines[index] || '').trim();
    if (!line) continue;
    if (new RegExp(`^${CONCEPT_LABEL_PATTERN}\\b`, 'iu').test(line)) break;
    if (new RegExp(`^(?:${VOCAB_SECTION_LABEL_PATTERN}|${FORMULA_LABEL_PATTERN}|equation|examples?|practice|review)\\b`, 'iu').test(line) && buffer.length > 0) break;
    const cleaned = cleanConceptSourceSentence(line);
    if (!cleaned) continue;
    if (isLearningTargetSentence(cleaned) && buffer.length > 0) continue;
    buffer.push(cleaned);
    if (buffer.join(' ').length >= 220) break;
  }
  const text = buffer.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const sentence = (text.split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .find((part) => part && !looksSlideHeaderLine(part) && !isPageHeaderText(part) && !isLearningTargetSentence(part)) || text).trim();
  if (!sentence || normalizeItemKey(sentence) === normalizeItemKey(headingTitle)) return '';
  return sentence;
}

function cleanConceptSourceSentence(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || looksSlideHeaderLine(text) || isPageHeaderText(text)) return '';
  text = text.replace(new RegExp(`^${CONCEPT_LABEL_PATTERN}\\s*[:\\-]?\\s*`, 'iu'), '').trim();
  if (!text || looksSlideHeaderLine(text) || isPageHeaderText(text)) return '';
  return text;
}

function mergeConceptCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  candidates.forEach((candidate) => {
    const key = normalizeItemKey(candidate.title);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(candidate);
  });
  return unique;
}

function recoverConceptExplanationsFromSource(pack, extraction) {
  const concepts = Array.isArray(pack && pack.concepts) ? pack.concepts : [];
  concepts.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const current = String(item.studentExplanation || '').trim();
    const needsRecovery = !current || /draft wording not available/i.test(current) || isLearningTargetSentence(current);
    if (!needsRecovery) return;
    const evidence = makeItemEvidenceText(item, extraction);
    const recovered = recoverConceptExplanationText(item, evidence);
    if (!recovered) return;
    item.studentExplanation = recovered;
    if (!['pending', 'needs_review'].includes(item.reviewStatus)) item.reviewStatus = 'needs_review';
    if (!['high', 'medium', 'low'].includes(item.confidence)) item.confidence = 'low';
  });
}

function recoverVocabularyDefinitionsFromSource(pack, extraction) {
  const vocabulary = Array.isArray(pack && pack.vocabulary) ? pack.vocabulary : [];
  vocabulary.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    if (hasQuarantineMarker(item)) return;
    const missingStudent = isMissingDraftWordingValue(item.studentDefinition);
    const missingTeacher = isMissingDraftWordingValue(item.teacherDefinition);
    if (!missingStudent && !missingTeacher) return;
    const evidence = makeItemEvidenceText(item, extraction);
    const recovered = recoverVocabularyDefinitionText(item, evidence, extraction);
    if (!recovered) return;
    if (missingStudent) item.studentDefinition = recovered;
    if (missingTeacher) item.teacherDefinition = recovered;
    if (!['pending', 'needs_review'].includes(item.reviewStatus)) item.reviewStatus = 'needs_review';
    if (!['high', 'medium', 'low'].includes(item.confidence)) item.confidence = 'low';
  });
}

function cleanupConceptTitles(pack, extraction, importProfile = 'general') {
  const concepts = Array.isArray(pack && pack.concepts) ? pack.concepts : [];
  const invalidItems = [];
  const filtered = [];
  concepts.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const evidence = makeItemEvidenceText(item, extraction);
    let cleaned = cleanConceptTitle(firstNonEmptyString(item.title), {
      explanation: firstNonEmptyString(item.studentExplanation),
      evidence
    });
    if (importProfile === 'physical_science' && isInvalidPhysicalScienceConceptTitle(cleaned)) {
      cleaned = cleanConceptTitle(deriveShortTitle([item.studentExplanation, evidence]), {
        explanation: firstNonEmptyString(item.studentExplanation),
        evidence
      });
    }
    if (!cleaned || (importProfile === 'physical_science' && isInvalidPhysicalScienceConceptTitle(cleaned))) {
      invalidItems.push({
        section: 'concepts',
        index,
        reason: `Concept title "${firstNonEmptyString(item.title, '(missing)')}" was not a usable science concept title.`,
        requiredField: 'title'
      });
      return;
    }
    if (cleaned && cleaned !== item.title) {
      item.title = cleaned;
      if (!['pending', 'needs_review'].includes(item.reviewStatus)) item.reviewStatus = 'needs_review';
      if (!['high', 'medium', 'low'].includes(item.confidence)) item.confidence = 'low';
    }
    filtered.push(item);
  });
  pack.concepts = filtered;
  mergeQualityInvalidItemsIntoMetadata(pack, invalidItems);
}

function recoverConceptExplanationText(item, evidenceText) {
  const evidence = cleanConceptEvidenceText(evidenceText);
  if (!evidence) return '';
  const title = firstNonEmptyString(item && item.title, item && item.conceptId);
  const sentences = evidence
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20 && sentence.length <= 260)
    .filter((sentence) => !isLearningTargetSentence(sentence))
    .filter((sentence) => !looksSlideHeaderLine(sentence));
  if (/electric charge/i.test(title)) {
    const chargeSentence = sentences.find((sentence) => /like charges?.{0,60}repel|opposite charges?.{0,60}attract/iu.test(sentence));
    if (chargeSentence) return chargeSentence;
  }
  if (/ohm/i.test(title)) {
    const ohmSentence = sentences.find((sentence) => /voltage|current|resistance/iu.test(sentence));
    if (ohmSentence) return ohmSentence;
  }
  if (/series circuit/i.test(title)) {
    const seriesSentence = sentences.find((sentence) => /(one|single).{0,40}(path|loop)|opens?.{0,40}current|if .*open/iu.test(sentence));
    if (seriesSentence) return seriesSentence;
  }
  const withTitle = sentences.find((sentence) => phraseAppearsInText(title, sentence) && !looksHeadingOnlyEvidence(title, sentence));
  if (withTitle) return withTitle;
  const general = sentences.find((sentence) => !looksHeadingOnlyEvidence(title, sentence));
  return general || '';
}

function cleanConceptEvidenceText(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  text = text.replace(/\bLarger PDF:\s*Electricity and Magnetism\s+Page\s+\d+\s+of\s+\d+\b\.?/giu, ' ');
  text = text.replace(/\bCharlemagne text-based PDF import test\b\.?/giu, ' ');
  text = text.replace(/\b(?:Core Concept|Concept Check|Key Idea|Important Idea|Main Idea)\s*:\s*/giu, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function applyVocabularyQualityGates(pack, extraction, importProfile = 'general') {
  const blockedTerms = new Set([
    'more mass',
    'more speed',
    '0 n',
    'f ma',
    'x r',
    'm in 20 s',
    'mass per unit volume'
  ]);
  const evidenceText = normalizeItemKey(extraction && extraction.text || '');
  const filtered = [];
  const invalidItems = [];
  (Array.isArray(pack && pack.vocabulary) ? pack.vocabulary : []).forEach((item, index) => {
    const verdict = evaluateVocabularyCandidate(item, blockedTerms, evidenceText, extraction, importProfile);
    if (verdict.accepted) {
      filtered.push(item);
      return;
    }
    invalidItems.push({
      section: 'vocabulary',
      index,
      reason: verdict.reason,
      requiredField: 'term'
    });
  });
  pack.vocabulary = filtered;
  mergeQualityInvalidItemsIntoMetadata(pack, invalidItems);
}

function evaluateVocabularyCandidate(item, blockedTerms, extractionText, extraction, importProfile = 'general') {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { accepted: false, reason: 'Entry was not a JSON object.' };
  }
  const rawTerm = cleanScienceExtractionArtifactText(String(item.term || '').replace(/\s+/g, ' ').trim(), importProfile);
  const term = normalizeItemKey(rawTerm);
  if (!term) return { accepted: false, reason: 'Missing required term.' };
  if (isVocabularySectionLabel(rawTerm)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" matched a section label.` };
  }
  if (looksBrokenVocabularyFragment(rawTerm, term)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like a broken label fragment.` };
  }
  if (blockedTerms.has(term)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like a fragment/example, not a science term.` };
  }
  if (/^[0-9.+\-/% ]+[a-z°µΩ]+$/iu.test(rawTerm) || /[=]/u.test(rawTerm)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like a unit/equation fragment.` };
  }
  if (isFormulaVariableVocabularyTerm(rawTerm) && !hasExplicitStandaloneVocabularyDefinition(rawTerm, extraction)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like a formula variable, not a standalone vocabulary term.` };
  }
  if (/^(?:circuit|magnet)$/iu.test(rawTerm)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" was too broad without a more specific source term.` };
  }
  if (/^(?:charges|symbols|batteries)$/iu.test(rawTerm) && looksListFragmentEvidence(item.sourceTextSnippet, rawTerm)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like a list fragment, not a standalone term.` };
  }
  if (/^(?:charges|symbols|batteries)$/iu.test(rawTerm) && !phraseAppearsInText(rawTerm, extractionText)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" lacked clear standalone glossary context.` };
  }
  if (rawTerm.split(/\s+/).length > 5) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like sentence wording, not a term.` };
  }
  const studentDefinition = cleanScienceExtractionArtifactText(String(item.studentDefinition || '').trim(), importProfile);
  const teacherDefinition = cleanScienceExtractionArtifactText(String(item.teacherDefinition || '').trim(), importProfile);
  const usableStudent = !isMissingDraftWordingValue(studentDefinition);
  const usableTeacher = !isMissingDraftWordingValue(teacherDefinition);
  if (!usableStudent || !usableTeacher) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" was missing a usable definition.` };
  }
  item.term = rawTerm;
  item.studentDefinition = studentDefinition;
  item.teacherDefinition = teacherDefinition;
  return { accepted: true };
}

function looksBrokenVocabularyFragment(rawTerm, normalizedTerm) {
  if (!nonEmptyString(rawTerm)) return true;
  if (/^(?:use|se alignment|alignment|concepts?|vocabulary)$/iu.test(rawTerm)) return true;
  if (/^(?:useful|key|core|main|review)\s+(?:terms?|items?|concepts?|vocabulary)$/iu.test(rawTerm)) return true;
  if (/^se\s+\w+$/iu.test(rawTerm)) return true;
  if (normalizedTerm.length < 2) return true;
  return false;
}

function isFormulaVariableVocabularyTerm(value) {
  return FORMULA_VARIABLE_VOCAB_KEYS.has(normalizeItemKey(value));
}

function looksFormulaLikeVocabularyLine(term, definition) {
  const text = `${term} ${definition}`;
  return /[=≈]/u.test(text) || /\b(?:formula|equation|ohm'?s law)\b/iu.test(definition);
}

function hasExplicitStandaloneVocabularyDefinition(term, extraction) {
  const key = canonicalVocabularyKey(term);
  if (!key) return false;
  const sections = makeFormulaSourceSections(extraction, makeSourceDefaults(extraction));
  return sections.some((section) => {
    let inVocabulary = false;
    return splitSourceLines(section.text).some((line) => {
      const cleaned = cleanSourceLine(line);
      if (!cleaned) return false;
      const sectionLabel = detectSourceSectionLabel(cleaned);
      if (sectionLabel) {
        inVocabulary = sectionLabel === 'vocabulary';
        if (!inVocabulary) return false;
      }
      if (!inVocabulary) return false;
      const parsed = parseVocabularyDefinitionLine(stripLeadingSectionLabel(cleaned, VOCAB_SECTION_LABEL_PATTERN));
      if (!parsed) return false;
      if (canonicalVocabularyKey(parsed.term) !== key) return false;
      return !looksFormulaLikeVocabularyLine(parsed.term, parsed.definition);
    });
  });
}

function looksListFragmentEvidence(snippet, term) {
  const text = String(snippet || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  const listish = /,|\band\b|•|;/.test(text);
  const termPattern = new RegExp(`\\b${escapeRegExp(String(term || '').trim())}\\b`, 'iu');
  const definitionPattern = new RegExp(`\\b${escapeRegExp(String(term || '').trim())}\\b[^.!?]{0,50}\\b(?:is|are|means|refers to|defined as)\\b`, 'iu');
  return listish && termPattern.test(text) && !definitionPattern.test(text);
}

function applyFormulaQualityGates(pack, extraction, importProfile = 'general') {
  const formulas = Array.isArray(pack && pack.referenceFormulas) ? pack.referenceFormulas : [];
  const filtered = [];
  const invalidItems = [];
  const additional = [];
  formulas.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      invalidItems.push({
        section: 'referenceFormulas',
        index,
        reason: 'Entry was not a JSON object.',
        requiredField: 'title/equation'
      });
      return;
    }
    const repaired = repairReferenceEquation(item.equation, [
      item.sourceTextSnippet,
      item.studentExplanation,
      item.notes,
      extraction && extraction.text
    ].filter(nonEmptyString).join(' '), importProfile);
    if (repaired.invalidReason) {
      invalidItems.push({
        section: 'referenceFormulas',
        index,
        reason: repaired.invalidReason,
        requiredField: 'equation'
      });
      return;
    }
    item.equation = repaired.equation;
    if (repaired.changed) {
      Object.assign(item, addNormalizationNote(item, repaired.note || 'Repaired formula equation text during quality checks.'));
    }
    item.title = makeFormulaTitle(item.equation, index);
    filtered.push(item);
    extractCompanionOhmsLawEquations(item, extraction).forEach((equation) => {
      additional.push(normalizeReferenceFormula({
        ...item,
        formulaId: makeGeneratedItemId('formula', [equation], additional.length + index, {}),
        equation,
        title: makeFormulaTitle(equation, index + additional.length),
        reviewStatus: 'pending',
        confidence: 'medium'
      }, makeSourceDefaults(extraction)));
    });
  });
  const deduped = [];
  const dedupedIndices = new Map();
  filtered.forEach((item) => {
    const key = normalizeFormulaEquation(item && item.equation);
    if (!key) {
      deduped.push(item);
      return;
    }
    if (!dedupedIndices.has(key)) {
      dedupedIndices.set(key, deduped.length);
      deduped.push(item);
      return;
    }
    const existingIndex = dedupedIndices.get(key);
    deduped[existingIndex] = preserveStricterReviewState(
      mergeSourceEvidence(item, deduped[existingIndex]),
      deduped[existingIndex]
    );
  });
  const seen = new Set(deduped.map((item) => normalizeFormulaEquation(item && item.equation)).filter(Boolean));
  additional.forEach((item) => {
    const key = normalizeFormulaEquation(item.equation);
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });
  pack.referenceFormulas = deduped;
  mergeQualityInvalidItemsIntoMetadata(pack, invalidItems);
}

function repairReferenceEquation(value, contextText = '', importProfile = 'general') {
  let equation = String(value || '').replace(/\s+/g, ' ').trim();
  const context = String(contextText || '').replace(/\s+/g, ' ').trim();
  if (!equation) return { equation: '', invalidReason: 'Missing equation text.' };
  equation = equation.replace(/^the reference formula is\s+/iu, '');
  equation = equation.replace(/^formula\s*[:\-]\s*/iu, '');
  equation = equation.replace(/\.\s*it can also be written as[\s\S]*$/iu, '').trim();
  equation = equation.replace(/[,:;]+$/u, '').trim();
  equation = normalizeVisibleMultiplicationMarker(equation);
  equation = cleanScienceExtractionArtifactText(equation, importProfile);
  if (looksCodeLikeEquation(equation)) {
    return { equation, invalidReason: 'Code-like expression was not accepted as a reference formula.' };
  }
  if (looksExtractionDamagedFormula(equation)) {
    return {
      equation,
      changed: normalizeFormulaEquation(value) !== normalizeFormulaEquation(equation),
      note: 'Formula text may be extraction-damaged; keep pending teacher review.'
    };
  }
  if (/^v\s*=\s*i$/iu.test(equation)) {
    if (/\bi\s*(?:x|\*|×)\s*r\b/iu.test(context)) {
      return { equation: 'V = I × R', changed: true, note: 'Repaired Ohm’s Law voltage equation from nearby source wording.' };
    }
    return { equation, invalidReason: 'Incomplete equation "V = I" was not accepted as a general reference formula.' };
  }
  if (/^displacement\s*=\s*final$/iu.test(equation)) {
    return { equation, invalidReason: 'Incomplete equation "displacement = final" was not accepted.' };
  }
  if (isWorkedExampleEquation(equation)) {
    return { equation, invalidReason: 'Worked-example numeric equation was not accepted as a general reference formula.' };
  }
  if (!/[A-Za-zµΩ]\s*(?:=|≈)\s*(?:[A-Za-z0-9µΩ]|\()/u.test(equation)) {
    return { equation, invalidReason: 'Equation was not a clean symbolic relationship.' };
  }
  const normalizedKnownEquation = normalizeKnownReferenceEquation(equation);
  if (normalizedKnownEquation) {
    return {
      equation: normalizedKnownEquation,
      changed: normalizeFormulaEquation(value) !== normalizeFormulaEquation(normalizedKnownEquation),
      note: 'Normalized known reference equation to standard teacher-facing notation.'
    };
  }
  if (!/[+\-*/×÷^/]/u.test(equation) && !looksImplicitSymbolicProduct(equation)) {
    return { equation, invalidReason: 'Equation looked incomplete and was not accepted.' };
  }
  return { equation, changed: normalizeFormulaEquation(value) !== normalizeFormulaEquation(equation) };
}

function normalizeKnownReferenceEquation(equation) {
  const canonical = normalizeFormulaEquationForTitle(equation);
  if (matchesEquationFamily(canonical, ['w=f*d', 'w=fd'])) return 'W = F × d';
  if (matchesEquationFamily(canonical, ['wave speed=frequency*wavelength', 'v=f*lambda', 'v=f*λ'])) return 'v = f × λ';
  if (matchesEquationFamily(canonical, ['pe=mgh', 'pe=m*g*h'])) return 'PE = m g h';
  if (matchesEquationFamily(canonical, ['ke=1/2mv^2', 'ke=0.5mv^2', 'ke=mv^2/2'])) return 'KE = 1/2 m v^2';
  if (matchesEquationFamily(canonical, ['p=w/t', 'p=w÷t'])) return 'P = W / t';
  if (matchesEquationFamily(canonical, ['density=mass/volume', 'd=m/v'])) return 'D = m / V';
  if (matchesEquationFamily(canonical, ['speed=distance/time'])) return 'speed = distance / time';
  if (matchesEquationFamily(canonical, ['velocity=displacement/time'])) return 'velocity = displacement / time';
  if (matchesEquationFamily(canonical, ['a=(vf-vi)/t'])) return 'a = (vf - vi) / t';
  if (matchesEquationFamily(canonical, ['fnet=m*a'])) return 'Fnet = m × a';
  return '';
}

function isWorkedExampleEquation(equation) {
  const text = String(equation || '').replace(/\s+/g, ' ').trim();
  if (!text || !/[=≈]/u.test(text)) return false;
  const equationSeparators = (text.match(/[=≈]/gu) || []).length;
  if (equationSeparators >= 2 && /\d/u.test(text)) return true;
  if (/\b(?:\d+(?:\.\d+)?\s*)?[A-Za-zµΩ°%]+\s+in\s+\d+(?:\.\d+)?\s*[A-Za-zµΩ°%]+\s*(?:=|≈)\s*\d+/u.test(text)) return true;
  if (/^\s*\d/u.test(text)) return true;
  if (/\b\d+(?:\.\d+)?\s*(?:ohms?|amps?|ampere|volts?|newtons?|n|j|w|v|a|m\/s(?:\^2)?|m|s)\b/iu.test(text) && /\b=\s*\d/u.test(text)) {
    return true;
  }
  return false;
}

function looksCodeLikeEquation(equation) {
  const text = String(equation || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (/[{}[\];]/u.test(text)) return true;
  if (/=>|\b(?:const|let|var|function|return|class|import|export)\b/iu.test(text)) return true;
  if (/\b(?:console\.log|System\.out|printf|print\(|if\s*\(|for\s*\(|while\s*\()/iu.test(text)) return true;
  if (/^[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*new\s+[A-Za-z_$]/u.test(text)) return true;
  return false;
}

function extractCompanionOhmsLawEquations(item, extraction) {
  const evidence = [
    item && item.sourceTextSnippet,
    item && item.studentExplanation,
    extraction && extraction.text
  ].filter(nonEmptyString).join(' ');
  if (!/ohm|v\s*=\s*i|i\s*=\s*v\s*\/\s*r|r\s*=\s*v\s*\/\s*i/iu.test(evidence)) return [];
  const equations = [];
  if (/\bv\s*=\s*i\s*(?:x|\*|×)\s*r\b/iu.test(evidence) || /\bohm'?s law\b/iu.test(evidence)) equations.push('V = I × R');
  if (/\bi\s*=\s*v\s*\/\s*r\b/iu.test(evidence) || /\bohm'?s law\b/iu.test(evidence)) equations.push('I = V / R');
  if (/\br\s*=\s*v\s*\/\s*i\b/iu.test(evidence) || /\bohm'?s law\b/iu.test(evidence)) equations.push('R = V / I');
  return equations;
}

function mergeQualityInvalidItemsIntoMetadata(pack, invalidItems) {
  if (!Array.isArray(invalidItems) || !invalidItems.length) return;
  if (!pack.metadata || typeof pack.metadata !== 'object' || Array.isArray(pack.metadata)) pack.metadata = {};
  pack.metadata.invalidGeneratedItems = mergeInvalidGeneratedItems(pack.metadata.invalidGeneratedItems, invalidItems);
  pack.metadata.importWarnings = mergeImportWarnings(
    pack.metadata.importWarnings,
    invalidItems.map((entry) => formatInvalidGeneratedItemWarning(entry))
  );
}

function extractFormulaCandidates(extraction, sourceDefaults) {
  const sections = makeFormulaSourceSections(extraction, sourceDefaults);
  const candidates = [];
  sections.forEach((section) => {
    splitFormulaSearchText(section.text).forEach((line) => {
      splitLabeledFormulaLineCandidates(line).forEach((lineCandidate) => {
        extractEquationTextsFromLine(lineCandidate.searchLine).forEach((equation) => {
          candidates.push({
            equation,
            variables: extractFormulaVariables(equation, lineCandidate.searchLine),
            confidence: looksExtractionDamagedFormula(equation) || looksExtractionDamagedFormula(lineCandidate.searchLine) ? 'low' : 'medium',
            sourceFile: section.sourceFile,
            sourceLocation: section.sourceLocation,
            sourceTextSnippet: lineCandidate.sourceTextSnippet.slice(0, 240),
            sourceParse: lineCandidate.sourceParse
          });
        });
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

function isLabeledFormulaSourceLine(line) {
  return new RegExp(`^${FORMULA_LABEL_PATTERN}\\s*[:\\-]`, 'iu').test(String(line || '').trim());
}

function splitLabeledFormulaLineCandidates(line) {
  const cleaned = String(line || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const defaultCandidate = {
    searchLine: cleaned,
    sourceTextSnippet: cleaned,
    sourceParse: isLabeledFormulaSourceLine(cleaned) ? 'deterministic_labeled_formula_line' : 'deterministic_formula_line'
  };
  const labeledMatch = cleaned.match(new RegExp(`^(${FORMULA_LABEL_PATTERN})\\s*[:\\-]\\s*([\\s\\S]*)$`, 'iu'));
  if (!labeledMatch) return [defaultCandidate];
  const label = labeledMatch[1];
  const body = String(labeledMatch[2] || '').trim();
  if (!body || !/[=≈]/u.test(body) || !/[;,]/u.test(body)) return [defaultCandidate];
  const entries = body
    .split(/\s*[;,]\s*/u)
    .map((entry) => entry.trim())
    .filter((entry) => /[=≈]/u.test(entry));
  if (entries.length <= 1) return [defaultCandidate];
  return entries.map((entry) => ({
    searchLine: `${label}: ${entry}`,
    sourceTextSnippet: cleaned,
    sourceParse: 'deterministic_labeled_formula_line'
  }));
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
  const hasOperator = /[+\-*/×÷^·]| per /iu.test(equation);
  if (!hasOperator && !looksImplicitSymbolicProduct(equation)) return '';
  return equation.slice(0, 160);
}

function looksImplicitSymbolicProduct(equation) {
  const rightSide = String(equation || '').split(/=|≈/u)[1] || '';
  const tokens = rightSide.match(/[A-Za-zµΩ]\w{0,3}/gu) || [];
  return tokens.length >= 2;
}

function extractEquationTextsFromLine(line) {
  const normalized = String(line || '').replace(/\s+/g, ' ').trim();
  const equations = [];
  const primary = extractEquationText(normalized);
  if (primary) equations.push(primary);
  const explicitPatterns = [
    /\bW\s*=\s*F\s*(?:(?:x|\*|×|\s)*)d\b/giu,
    /\bPE\s*=\s*m\s*(?:(?:x|\*|×|\s)*)g\s*(?:(?:x|\*|×|\s)*)h\b/giu,
    /\bKE\s*=\s*(?:1\s*\/\s*2|0\.5)\s*m\s*v(?:\s*\^\s*2|²)\b/giu,
    /\bP\s*=\s*W\s*(?:\/|÷)\s*t\b/giu,
    /\bspeed\s*=\s*distance\s*(?:\/|÷)\s*time\b/giu,
    /\bvelocity\s*=\s*displacement\s*(?:\/|÷)\s*time\b/giu,
    /\ba\s*=\s*\(\s*vf\s*-\s*vi\s*\)\s*(?:\/|÷)\s*t\b/giu,
    /\bFnet\s*=\s*m\s*(?:x|\*|×)\s*a\b/giu,
    /\bF\s*=\s*m\s*(?:x|\*|×|\s)\s*a\b/giu,
    /\bFf\s*=\s*(?:mu|µ)\s*(?:x|\*|×)\s*Fn\b/giu,
    /\bD\s*=\s*m\s*(?:\/|÷)\s*V\b/giu,
    /\bV\s*=\s*I\s*(?:x|\*|×)\s*R\b/giu,
    /\bI\s*=\s*V\s*\/\s*R\b/giu,
    /\bR\s*=\s*V\s*\/\s*I\b/giu
  ];
  explicitPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      equations.push(match[0].replace(/\bx\b/giu, '×').replace(/\s+/g, ' ').trim());
    }
  });
  return Array.from(new Set(equations.map((entry) => entry.trim()).filter(Boolean)));
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

function normalizeVisibleMultiplicationMarker(value) {
  return String(value || '')
    .replace(/[·]/gu, '×')
    .replace(/([A-Za-zµΩ0-9)\]])\s*x\s*(?=[A-WYZa-wyzµΩ0-9(])/gu, '$1 × ');
}

function normalizeCanonicalMultiplicationMarker(value) {
  return String(value || '')
    .replace(/[×·]/gu, '*')
    .replace(/([A-Za-zµΩ0-9)\]])\s*x\s*(?=[A-WYZa-wyzµΩ0-9(])/gu, '$1*');
}

function normalizeFormulaEquation(value) {
  return normalizeCanonicalMultiplicationMarker(String(value || ''))
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

function normalizeFormulaEquationForTitle(value) {
  return normalizeCanonicalMultiplicationMarker(String(value || ''))
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/delta/gu, 'd')
    .replace(/velocity/gu, 'v')
    .replace(/distance/gu, 'd')
    .replace(/changein/gu, 'd')
    .replace(/_/g, '')
    .trim();
}

function matchesEquationFamily(canonical, variants) {
  const value = String(canonical || '');
  return variants.some((variant) => value === normalizeFormulaEquationForTitle(variant));
}

function makeFormulaTitle(equation, index) {
  const canonical = normalizeFormulaEquationForTitle(equation);
  if (matchesEquationFamily(canonical, ['w=f*d', 'w=fd'])) return 'Work Formula';
  if (matchesEquationFamily(canonical, ['ke=1/2mv^2', 'ke=0.5mv^2', 'ke=mv^2/2'])) return 'Kinetic Energy Formula';
  if (matchesEquationFamily(canonical, ['pe=mgh', 'pe=m*g*h'])) return 'Potential Energy Formula';
  if (matchesEquationFamily(canonical, ['p=w/t', 'p=w÷t'])) return 'Power Formula';
  if (matchesEquationFamily(canonical, ['speed=distance/time', 'v=d/t'])) return 'Speed Formula';
  if (matchesEquationFamily(canonical, ['acceleration=changeinvelocity/time', 'a=dv/t', 'a=delta v/t'])) return 'Acceleration Formula';
  if (matchesEquationFamily(canonical, ['fnet=m*a', 'f_net=m*a', 'f=ma', 'f=m*a'])) return 'Net Force Formula';
  if (matchesEquationFamily(canonical, ['d=m/v', 'density=m/v'])) return 'Density Formula';
  if (matchesEquationFamily(canonical, ['v=i*r', 'v=ir'])) return 'Ohm’s Law Voltage Formula';
  if (matchesEquationFamily(canonical, ['i=v/r'])) return 'Ohm’s Law Current Formula';
  if (matchesEquationFamily(canonical, ['r=v/i'])) return 'Ohm’s Law Resistance Formula';
  if (matchesEquationFamily(canonical, ['p=i*v', 'p=iv'])) return 'Electrical Power Formula';
  const leftSide = String(equation || '').split(/=|≈/u)[0].replace(/[^A-Za-z0-9µΩ ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return leftSide ? `${leftSide.slice(0, 48)} Formula` : `Reference Formula ${index + 1}`;
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
  const confidence = ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'low';
  return {
    ...item,
    reviewStatus: confidence === 'low' ? 'needs_review' : 'pending',
    confidence
  };
}

function normalizeSourceTracking(item, sourceDefaults) {
  const hadSourceEvidence = hasSourceEvidence(item);
  const sourceFile = normalizeItemSourceFile(item.sourceFile, sourceDefaults);
  const normalized = {
    ...item,
    sourceFile: sourceFile || sourceDefaults.sourceFile,
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
      reviewStatus: 'needs_review'
    }, 'Source evidence was filled from extraction defaults during import normalization; keep teacher review required.');
  }
  return normalized;
}

function normalizeItemSourceFile(sourceFile, sourceDefaults) {
  if (!nonEmptyString(sourceFile)) return '';
  const value = sourceFile.trim();
  const internalNames = [
    sourceDefaults && sourceDefaults.storedFileName,
    sourceDefaults && sourceDefaults.extractionJsonFileName
  ].filter(nonEmptyString).map(normalizeKey);
  if (sourceDefaults && nonEmptyString(sourceDefaults.sourceFile) && internalNames.includes(normalizeKey(value))) {
    return sourceDefaults.sourceFile;
  }
  return value;
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
    reviewStatus: 'needs_review',
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

function cleanConceptTitle(value, options = {}) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  text = stripLeadingSectionLabel(text, CONCEPT_LABEL_PATTERN);
  text = text.replace(/[.;:,]+$/u, '').trim();
  if (!text) return '';

  const normalized = normalizeItemKey(text);
  if (REJECTED_VOCAB_LABEL_KEYS.has(normalized)) return '';
  const preservedReadableTitles = {
    'energy changes in a falling object': 'Energy Changes in a Falling Object',
    'power and time': 'Power and Time',
    'distance is always positive': 'Distance Is Always Positive',
    'acceleration and changing velocity': 'Acceleration and Changing Velocity',
    'friction opposes motion': 'Friction Opposes Motion',
    'choosing the correct quantity': 'Choosing the Correct Quantity',
    'series circuits': 'Series Circuits',
    'electric charge interactions': 'Electric Charge Interactions',
    'ohm s law': 'Ohm’s Law'
  };
  if (preservedReadableTitles[normalized]) return preservedReadableTitles[normalized];
  if (matchesConceptTitlePattern(normalized, ['falling', 'object', 'change'])) return 'Energy Changes in a Falling Object';
  if (matchesConceptTitlePattern(normalized, ['doing', 'same', 'work'])) return 'Power and Time';
  if (matchesConceptTitlePattern(normalized, ['distance', 'alway', 'positive']) || matchesConceptTitlePattern(normalized, ['distance', 'always', 'positive'])) {
    return 'Distance Is Always Positive';
  }
  if (matchesConceptTitlePattern(normalized, ['acceleration', 'happen', 'speed']) || matchesConceptTitlePattern(normalized, ['acceleration', 'happens', 'speed'])) {
    return 'Acceleration and Changing Velocity';
  }
  if (matchesConceptTitlePattern(normalized, ['friction', 'usually', 'act'])) return 'Friction Opposes Motion';
  if (matchesConceptTitlePattern(normalized, ['student', 'should', 'choose'])) return 'Choosing the Correct Quantity';
  if (matchesConceptTitlePattern(normalized, ['sery', 'circuit']) || matchesConceptTitlePattern(normalized, ['series', 'circuit'])) return 'Series Circuits';
  if (isLearningTargetSentence(text)) {
    const recovered = recoverLearningTargetConceptTitle(text, options);
    return recovered || '';
  }
  if (/\benergy\b/iu.test(text) && /\btransf(?:er|orm)/iu.test(text)) return 'Energy Transfer and Transformation';
  if (/\bspeed\b/iu.test(text) && /\bvelocity\b/iu.test(text)) return 'Speed Versus Velocity';
  if (/\b(gravitational potential energy|potential energy)\b/iu.test(text) && /\b(height|higher|above the ground)\b/iu.test(text)) {
    return 'Height and Gravitational Potential Energy';
  }
  if (/\belectric charge\b/iu.test(text)) return 'Electric Charge Interactions';
  if (/\bresultant\b/iu.test(text) && /\bforce\b/iu.test(text)) return 'Resultant Force';
  if (/\baverage\b/iu.test(text) && /\bspeed\b/iu.test(text)) return 'Average Speed';
  if (/\bsink\b/iu.test(text) && /\bfloat\b/iu.test(text)) return 'Sink and Float Behavior';
  if (/\bdisplacement\b/iu.test(text) && /\bvolume\b/iu.test(text)) return 'Water Displacement and Volume';

  const tokens = contentTokens(text);
  const sentenceLike = looksSentenceLikeConceptTitle(text);
  if (sentenceLike && tokens.length >= 2) {
    if (tokens.includes('balanced') && tokens.includes('force')) return 'Balanced Forces';
    if (tokens.includes('motion') && tokens.includes('force')) return 'Motion and Forces';
    return toTitleWords(tokens.slice(0, 3).join(' '));
  }
  return toTitleWords(text.split(/\s+/).slice(0, 8).join(' '));
}

function looksSentenceLikeConceptTitle(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/[.!?;]/u.test(text)) return true;
  if (text.split(/\s+/).length > 6) return true;
  return /\b(is|are|can|should|must|has|have|do|does|did|change|changes|using|because|when|if|while|explain|describe)\b/iu.test(text);
}

function isLearningTargetSentence(value) {
  return /^\s*students?\s+(?:should|will|can|must)\s+(?:explain|describe|identify|analyze|model|compare)\b/iu.test(String(value || ''));
}

function recoverLearningTargetConceptTitle(value, options = {}) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const verbObject = text.match(/\b(?:explain|describe|identify|analyze|model|compare)\s+(.+?)(?:\s+(?:using|with|by|from|based on|in)\b|[.;]|$)/iu);
  const candidate = firstNonEmptyString(verbObject && verbObject[1], options.explanation, options.evidence);
  if (!candidate) return '';
  if (/\belectric charge\b/iu.test(candidate)) return 'Electric Charge Interactions';
  if (/\bohm'?s?\s+law\b|\bvoltage\b.*\bcurrent\b.*\bresistance\b|\bcurrent\b.*\bvoltage\b.*\bresistance\b/iu.test(candidate)) return 'Ohm’s Law';
  if (/\bseries circuit\b/iu.test(candidate)) return 'Series Circuits';
  if (/\bchoose\b.{0,40}\b(?:quantity|variable|formula)\b/iu.test(candidate)) return 'Choosing the Correct Quantity';
  if (/\baverage\b/iu.test(candidate) && /\bspeed\b/iu.test(candidate)) return 'Average Speed';
  if (/\bresultant\b/iu.test(candidate) && /\bforce\b/iu.test(candidate)) return 'Resultant Force';
  const tokens = contentTokens(candidate);
  if (tokens.length < 2) return '';
  return toTitleWords(tokens.slice(0, 4).join(' '));
}

function matchesConceptTitlePattern(normalizedTitle, requiredTokens) {
  const tokens = new Set(String(normalizedTitle || '').split(' ').filter(Boolean));
  return requiredTokens.every((token) => tokens.has(token));
}

function toTitleWords(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .slice(0, 80)
    .trim();
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

function toDisplayLabelFromId(value) {
  if (!nonEmptyString(value)) return '';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function conceptIdTitleCandidate(value) {
  if (!nonEmptyString(value)) return '';
  const normalized = String(value || '').trim().toLowerCase();
  if (/^concept(?:-page-\d+)?-\d{3,}$/u.test(normalized)) return '';
  return toDisplayLabelFromId(value);
}

function deriveEquationText(item = {}) {
  const direct = firstNonEmptyString(
    item.equation,
    item.formula,
    item.expression,
    item.formulaText,
    item.math,
    item.latex
  );
  if (direct) return direct;
  const snippet = firstNonEmptyString(item.sourceTextSnippet, item.sourceSnippet, item.studentExplanation, item.notes);
  if (!snippet) return '';
  const inline = snippet.match(/[A-Za-z][^=]{0,24}=\s*[A-Za-z0-9().+\-*/×÷^_ ]+/u);
  return inline ? inline[0].trim() : '';
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
  report.droppedItems = Array.isArray(pack && pack.metadata && pack.metadata.invalidGeneratedItems)
    ? pack.metadata.invalidGeneratedItems.length
    : 0;
  return report;
}

function mergeInvalidGeneratedItems(existing, additions) {
  const merged = [];
  [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(additions) ? additions : [])]
    .forEach((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      const normalized = {
        section: firstNonEmptyString(entry.section),
        index: Number.isFinite(Number(entry.index)) ? Number(entry.index) : -1,
        requiredField: firstNonEmptyString(entry.requiredField),
        reason: firstNonEmptyString(entry.reason)
      };
      if (!normalized.section || normalized.index < 0 || !normalized.reason) return;
      const key = `${normalized.section}:${normalized.index}:${normalized.reason}`;
      if (!merged.some((item) => `${item.section}:${item.index}:${item.reason}` === key)) {
        merged.push(normalized);
      }
    });
  return merged;
}

function mergeImportWarnings(existing, additions) {
  return Array.from(new Set([
    ...(Array.isArray(existing) ? existing.filter(nonEmptyString) : []),
    ...(Array.isArray(additions) ? additions.filter(nonEmptyString) : [])
  ]));
}

function formatInvalidGeneratedItemWarning(entry = {}) {
  const section = firstNonEmptyString(entry.section, 'unknown');
  const index = Number.isFinite(Number(entry.index)) ? Number(entry.index) : 0;
  const reason = firstNonEmptyString(entry.reason, 'Invalid generated item.');
  return `Removed invalid generated item ${section}[${index}]: ${reason}`;
}

function isMissingDraftWordingValue(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return !text || /draft wording not available/i.test(text) || /^missing$/i.test(text);
}

function hasQuarantineMarker(item) {
  const flags = [
    item && item.quarantineStatus,
    item && item.warningStatus,
    item && item.validationStatus,
    item && item.repairStatus
  ].filter(nonEmptyString).join(' ').toLowerCase();
  return /\bquarantine|quarantined\b/.test(flags);
}

function isVocabularySectionLabel(value) {
  return REJECTED_VOCAB_LABEL_KEYS.has(normalizeItemKey(value));
}

function recoverVocabularyDefinitionText(item, evidenceText, extraction) {
  const evidenceRaw = String(evidenceText || '');
  const evidence = evidenceRaw.replace(/\s+/g, ' ').trim();
  if (!evidence) return '';
  const term = firstNonEmptyString(item && item.term, item && item.title);
  if (!nonEmptyString(term)) return '';
  const lineDefinition = recoverTermColonDefinition(term, item, extraction, evidenceRaw);
  if (lineDefinition) return lineDefinition;
  const flexibleTerm = contentTokens(term).map(escapeRegExp).join('\\s+');
  if (!flexibleTerm) return '';
  const patterns = [
    new RegExp(`\\b${flexibleTerm}\\b[^.!?]{0,140}\\b(?:is|are|means|mean|refers to|defined as|called|represents)\\b[^.!?]{1,180}`, 'iu'),
    new RegExp(`\\b${flexibleTerm}\\b\\s*[:\\-]\\s*[^.!?]{4,180}`, 'iu')
  ];
  for (const pattern of patterns) {
    const match = evidence.match(pattern);
    if (!match || !match[0]) continue;
    const normalized = normalizeRecoveredDefinitionText(match[0], term);
    if (normalized) return normalized;
  }
  const sentence = evidence
    .split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .find((part) => phraseAppearsInText(term, part) && part.length >= 15 && !looksSlideHeaderLine(part));
  return normalizeRecoveredDefinitionText(sentence || '', term);
}

function recoverTermColonDefinition(term, item, extraction, evidenceText) {
  const termKey = canonicalVocabularyKey(term);
  if (!termKey) return '';
  const lines = [];
  const matchingSections = findMatchingExtractionSections(item, extraction);
  matchingSections.forEach((section) => {
    String(section && section.text || '')
      .split(/\n+/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => lines.push(line));
  });
  String(evidenceText || '')
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => lines.push(line));
  for (const line of lines) {
    if (!/:/.test(line)) continue;
    if (looksSlideHeaderLine(line)) continue;
    const match = line.match(/^[•*\-\d.)\s]*([^:]{1,80})\s*:\s*(.+)$/u);
    if (!match) continue;
    const labelKey = canonicalVocabularyKey(match[1]);
    if (!labelKey || labelKey !== termKey) continue;
    const definition = normalizeRecoveredDefinitionText(match[2], term);
    if (definition) return definition;
  }
  return '';
}

function normalizeRecoveredDefinitionText(value, term = '') {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  text = text.replace(/^[•*\-\d.)\s]+/u, '').trim();
  const termPattern = term ? new RegExp(`^${escapeRegExp(String(term).trim())}\\s*[:\\-]\\s*`, 'iu') : null;
  if (termPattern) text = text.replace(termPattern, '').trim();
  if (!text || looksSlideHeaderLine(text)) return '';
  const firstSentence = text.split(/(?<=[.!?])\s+/u).find((sentence) => {
    const clean = String(sentence || '').trim();
    return clean.length >= 12 && !looksSlideHeaderLine(clean);
  }) || text;
  const cleanSentence = firstSentence.replace(/[.;:,]+$/u, '').trim();
  if (!cleanSentence) return '';
  if (cleanSentence.length <= 220) return cleanSentence;
  return cleanSentence.slice(0, 220).replace(/\s+\S*$/u, '').replace(/[.;:,]+$/u, '').trim();
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
    importProfile: normalizeImportProfile(metadata.importProfile || extraction && extraction.importProfile),
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

function buildSafeDraftMetadata(modelMetadata, { extraction, packName, packId, sourceDefaults, importProfile, importScope }) {
  const uncertainSections = Array.isArray(modelMetadata && modelMetadata.importUncertainSections)
    ? modelMetadata.importUncertainSections
      .map((entry) => ({
        sourceLocation: String(entry && entry.sourceLocation || '').trim().slice(0, 240),
        note: String(entry && entry.note || '').trim().slice(0, 500)
      }))
      .filter((entry) => entry.sourceLocation || entry.note)
    : [];
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
      importProfile: normalizeImportProfile(importProfile || sourceDefaults.importProfile),
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
    importProfile: normalizeImportProfile(importProfile || sourceDefaults.importProfile),
    importScope: importScope || undefined,
    importUncertainSections: uncertainSections
  };
}

function normalizeImportProfile(value) {
  const raw = String(value || '').trim().toLowerCase();
  if ([
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
  ].includes(raw)) return raw;
  return 'general';
}

function cleanScienceExtractionArtifactText(value, importProfile = 'general') {
  let text = String(value || '');
  text = text.replace(/^\s*l\s+(?=[A-Za-z])/u, '');
  if (normalizeImportProfile(importProfile) !== 'physical_science') return text;
  return text
    .replace(/\bwavelengt\b/giu, 'wavelength')
    .replace(/\bfrequncy\b/giu, 'frequency')
    .replace(/\btemperture\b/giu, 'temperature')
    .replace(/\baccleration\b/giu, 'acceleration');
}

function isInvalidPhysicalScienceConceptTitle(value) {
  const title = normalizeItemKey(value);
  if (!title) return true;
  const blockedExact = new Set([
    'physical science slide',
    'good answer should',
    'key units',
    'machine have high',
    'more speed mean',
    'cold doe flow'
  ]);
  if (blockedExact.has(title)) return true;
  if (/^(?:page|slide|section|chapter)\b/iu.test(title)) return true;
  if (/^(?:key|good|more|cold|machine)\b/iu.test(title) && title.split(' ').length <= 4) return true;
  if (title.split(' ').length < 2) return true;
  return false;
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

function hasAnyReviewableGeneratedItems(pack) {
  const counts = countGeneratedItems(pack);
  return Object.values(counts).some((value) => Number(value || 0) > 0);
}

function buildInvalidGeneratedItemTechnicalErrors(invalidItems = []) {
  const details = [];
  (Array.isArray(invalidItems) ? invalidItems : []).forEach((entry) => {
    const section = firstNonEmptyString(entry && entry.section, 'unknown');
    const index = Number.isFinite(Number(entry && entry.index)) ? Number(entry.index) : -1;
    const reason = firstNonEmptyString(entry && entry.reason, 'Invalid generated item.');
    if (index >= 0) {
      details.push(`Removed ${section}[${index}] during draft salvage: ${reason}`);
    } else {
      details.push(`Removed ${section} item during draft salvage: ${reason}`);
    }
  });
  return details;
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

function applySourceEvidenceValidation(pack, extraction) {
  const report = {
    checkedItems: 0,
    supportedItems: 0,
    weakItems: 0,
    unsupportedItems: 0,
    thinExtractionItems: 0,
    warnings: []
  };

  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return report;

  SOURCE_GROUNDING_SECTIONS.forEach((sectionName) => {
    const items = Array.isArray(pack[sectionName]) ? pack[sectionName] : [];
    items.forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      report.checkedItems += 1;
      const result = validateItemSourceGrounding(sectionName, item, extraction);
      item.sourceGrounding = {
        status: result.status,
        termOrTitleFound: result.termOrTitleFound,
        explanationSupported: result.explanationSupported,
        evidenceStrength: result.evidenceStrength,
        reasons: result.reasons
      };
      if (result.thinExtraction) {
        report.thinExtractionItems += 1;
        addItemWarning(item, THIN_EXTRACTION_WARNING);
      }
      if (result.status === 'supported') {
        report.supportedItems += 1;
        item.warningStatus = item.warningStatus || '';
        return;
      }

      addItemWarning(item, SOURCE_GROUNDING_WARNING);
      item.warningStatus = firstNonEmptyString(item.warningStatus, 'source_evidence_weak');
      item.repairStatus = firstNonEmptyString(item.repairStatus, 'repair_needed');
      item.confidence = 'low';
      item.reviewStatus = 'needs_review';
      if (result.status === 'unsupported') {
        report.unsupportedItems += 1;
      } else {
        report.weakItems += 1;
      }
    });
  });

  if (report.weakItems > 0 || report.unsupportedItems > 0) {
    report.warnings.push(SOURCE_GROUNDING_WARNING);
  }
  if (report.thinExtractionItems > 0) {
    report.warnings.push(THIN_EXTRACTION_WARNING);
  }
  return report;
}

function validateItemSourceGrounding(sectionName, item, extraction) {
  if (sectionName === 'vocabulary') return validateVocabularyGrounding(item, extraction);
  if (sectionName === 'concepts') return validateConceptGrounding(item, extraction);
  if (sectionName === 'referenceFormulas') return validateFormulaGrounding(item, extraction);
  return makeGroundingResult('supported');
}

function validateVocabularyGrounding(item, extraction) {
  const evidence = makeItemEvidenceText(item, extraction);
  const term = firstNonEmptyString(item.term, item.title);
  const definition = [
    item.studentDefinition,
    item.teacherDefinition,
    item.misconception
  ].filter(nonEmptyString).join(' ');
  const termFound = phraseAppearsInText(term, evidence)
    || (Array.isArray(item.aliases) && item.aliases.some((alias) => phraseAppearsInText(alias, evidence)));
  const thinExtraction = isThinEvidence(evidence);
  const headingOnly = looksHeadingOnlyEvidence(term, evidence);
  const overlap = meaningfulOverlap(definition, evidence, [term, item.aliases]);
  const hasDefinitionPattern = termFound && hasDefinitionPatternNearTerm(term, evidence);

  if (!termFound) {
    return makeGroundingResult('unsupported', {
      termOrTitleFound: false,
      thinExtraction,
      reasons: ['Term was not found in the cited source evidence.']
    });
  }

  if (headingOnly) {
    return makeGroundingResult('unsupported', {
      termOrTitleFound: true,
      thinExtraction: true,
      reasons: ['Source evidence appears to be only a heading or term, not a definition.']
    });
  }

  if (hasDefinitionPattern && overlap.count >= 1) {
    return makeGroundingResult('supported', {
      termOrTitleFound: true,
      explanationSupported: true,
      thinExtraction,
      evidenceStrength: overlap.ratio
    });
  }

  if (overlap.count >= 2 && overlap.ratio >= 0.25) {
    return makeGroundingResult('supported', {
      termOrTitleFound: true,
      explanationSupported: true,
      thinExtraction,
      evidenceStrength: overlap.ratio
    });
  }

  if (hasDefinitionPattern || overlap.count >= 2) {
    return makeGroundingResult('weak', {
      termOrTitleFound: true,
      explanationSupported: false,
      thinExtraction,
      evidenceStrength: overlap.ratio,
      reasons: ['Definition wording only weakly overlaps the cited source evidence.']
    });
  }

  return makeGroundingResult('unsupported', {
    termOrTitleFound: true,
    explanationSupported: false,
    thinExtraction,
    evidenceStrength: overlap.ratio,
    reasons: ['Cited evidence did not include a nearby source-supported definition or explanation.']
  });
}

function validateConceptGrounding(item, extraction) {
  const evidence = makeItemEvidenceText(item, extraction);
  const title = firstNonEmptyString(item.title, item.conceptId);
  const explanation = [
    item.studentExplanation,
    Array.isArray(item.keyIdeas) ? item.keyIdeas.join(' ') : '',
    Array.isArray(item.examples) ? item.examples.join(' ') : ''
  ].filter(nonEmptyString).join(' ');
  const thinExtraction = isThinEvidence(evidence);
  const titleOverlap = meaningfulOverlap(title, evidence, []);
  const explanationOverlap = meaningfulOverlap(explanation, evidence, [item.aliases]);
  const titleFound = phraseAppearsInText(title, evidence) || titleOverlap.ratio >= 0.6 || titleOverlap.count >= Math.min(2, contentTokens(title).length);

  if (!titleFound) {
    return makeGroundingResult('unsupported', {
      termOrTitleFound: false,
      thinExtraction,
      reasons: ['Concept title was not found or strongly reflected in the cited source evidence.']
    });
  }

  if (looksHeadingOnlyEvidence(title, evidence)) {
    return makeGroundingResult('unsupported', {
      termOrTitleFound: true,
      thinExtraction: true,
      reasons: ['Source evidence appears to be only a heading or title, not an explanation.']
    });
  }

  if (explanationOverlap.count >= 2 && explanationOverlap.ratio >= 0.25) {
    return makeGroundingResult('supported', {
      termOrTitleFound: true,
      explanationSupported: true,
      thinExtraction,
      evidenceStrength: explanationOverlap.ratio
    });
  }

  if (explanationOverlap.count >= 1) {
    return makeGroundingResult('weak', {
      termOrTitleFound: true,
      explanationSupported: false,
      thinExtraction,
      evidenceStrength: explanationOverlap.ratio,
      reasons: ['Concept explanation only weakly overlaps the cited source evidence.']
    });
  }

  return makeGroundingResult('unsupported', {
    termOrTitleFound: true,
    explanationSupported: false,
    thinExtraction,
    reasons: ['Cited evidence did not include supporting source explanation for the concept.']
  });
}

function validateFormulaGrounding(item, extraction) {
  const evidence = makeItemEvidenceText(item, extraction);
  const equation = firstNonEmptyString(item.equation);
  const thinExtraction = isThinEvidence(evidence);
  const normalizedEquation = normalizeFormulaEquation(equation);
  const normalizedEvidence = normalizeFormulaEquation(evidence);
  const equationFound = Boolean(normalizedEquation && normalizedEvidence.includes(normalizedEquation));
  const tokenOverlap = meaningfulOverlap(equation, evidence, []);

  if (equationFound || tokenOverlap.count >= 2) {
    return makeGroundingResult('supported', {
      termOrTitleFound: true,
      explanationSupported: true,
      thinExtraction,
      evidenceStrength: equationFound ? 1 : tokenOverlap.ratio
    });
  }

  return makeGroundingResult('weak', {
    termOrTitleFound: false,
    explanationSupported: false,
    thinExtraction,
    reasons: ['Formula equation was not found in the cited source evidence.']
  });
}

function makeGroundingResult(status, details = {}) {
  return {
    status,
    termOrTitleFound: details.termOrTitleFound !== false,
    explanationSupported: details.explanationSupported === true || status === 'supported',
    evidenceStrength: Number(details.evidenceStrength || 0),
    thinExtraction: details.thinExtraction === true,
    reasons: Array.isArray(details.reasons) ? details.reasons : []
  };
}

function makeItemEvidenceText(item, extraction) {
  const matchingSections = findMatchingExtractionSections(item, extraction);
  const snippets = [
    item && item.sourceTextSnippet,
    item && item.sourceSnippet
  ].filter(nonEmptyString);
  const parts = [];
  if (Array.isArray(item && item.sourceReferences)) {
    item.sourceReferences.forEach((reference) => {
      if (reference && typeof reference === 'object' && nonEmptyString(reference.sourceTextSnippet)) snippets.push(reference.sourceTextSnippet);
    });
  }
  matchingSections.forEach((section) => parts.push(section.text));
  snippets.forEach((snippet) => {
    if (!matchingSections.length || sourceSnippetAppearsInExtraction(snippet, extraction)) {
      parts.push(snippet);
    }
  });
  return Array.from(new Set(parts.filter(nonEmptyString).map((part) => String(part).replace(/\s+/g, ' ').trim()))).join(' ');
}

function findMatchingExtractionSections(item, extraction) {
  const sections = makePromptSections(extraction || {});
  if (!sections.length || !item) return [];
  const sourceLocation = normalizeItemKey(item.sourceLocation);
  const sourceFile = normalizeKey(item.sourceFile);
  const page = inferPageFromLocation(item.sourceLocation);
  const pageRange = inferPageRangeFromLocation(item.sourceLocation);
  const matches = sections.filter((section) => {
    const sectionLocation = normalizeItemKey(firstNonEmptyString(section.sourceLocation, section.label));
    const sectionFile = normalizeKey(section.sourceFile);
    const sectionPage = Number(section.pageNumber || 0);
    return Boolean(
      sourceLocation === 'extracted text'
      || sourceLocation === 'full text'
      || (sourceLocation && sectionLocation && (sectionLocation === sourceLocation || sectionLocation.includes(sourceLocation) || sourceLocation.includes(sectionLocation)))
      || (page && sectionPage === page)
      || (pageRange && sectionPage >= pageRange.start && sectionPage <= pageRange.end)
      || (sourceFile && sectionFile && sectionFile === sourceFile)
    );
  });
  return matches.slice(0, 2);
}

function sourceSnippetAppearsInExtraction(snippet, extraction) {
  const snippetKey = normalizeItemKey(snippet).slice(0, 160);
  if (!snippetKey) return false;
  const extractionKey = normalizeItemKey(extraction && extraction.text || '');
  return extractionKey.includes(snippetKey) || contentTokens(snippet).filter((token) => new Set(contentTokens(extraction && extraction.text || '')).has(token)).length >= 4;
}

function inferPageRangeFromLocation(value) {
  const match = String(value || '').match(/\bpages?\s*(\d+)\s*(?:-|–|to)\s*(\d+)\b/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) return null;
  return { start, end };
}

function meaningfulOverlap(claimText, evidenceText, excludedValues = []) {
  const excluded = new Set(flattenAliasValues(excludedValues).flatMap(contentTokens));
  const claimTokens = Array.from(new Set(contentTokens(claimText).filter((token) => !excluded.has(token))));
  const evidenceTokens = new Set(contentTokens(evidenceText));
  const overlap = claimTokens.filter((token) => evidenceTokens.has(token));
  return {
    count: overlap.length,
    total: claimTokens.length,
    ratio: claimTokens.length ? overlap.length / claimTokens.length : 0,
    tokens: overlap
  };
}

function contentTokens(value) {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'be', 'by', 'can', 'do', 'does', 'did', 'for', 'from', 'how', 'if', 'in', 'into', 'is', 'it', 'not', 'of', 'or', 'that', 'the', 'this', 'to', 'with', 'when'
  ]);
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .map(singularizeSimpleWord)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function phraseAppearsInText(phrase, text) {
  const phraseTokens = contentTokens(phrase);
  if (!phraseTokens.length) return false;
  const textTokens = contentTokens(text);
  if (phraseTokens.length === 1) return textTokens.includes(phraseTokens[0]);
  const haystack = ` ${textTokens.join(' ')} `;
  return haystack.includes(` ${phraseTokens.join(' ')} `);
}

function hasDefinitionPatternNearTerm(term, evidence) {
  if (!nonEmptyString(term) || !nonEmptyString(evidence)) return false;
  const flexibleTerm = contentTokens(term).map(escapeRegExp).join('\\s+');
  if (!flexibleTerm) return false;
  const text = String(evidence || '').replace(/\s+/g, ' ');
  const patterns = [
    new RegExp(`\\b${flexibleTerm}\\b[^.!?]{0,80}\\b(?:is|are|means|mean|refers to|defined as|called|represents)\\b`, 'iu'),
    new RegExp(`\\b${flexibleTerm}\\b\\s*(?::|-|–)\\s*\\S.{3,120}`, 'iu'),
    new RegExp(`\\b(?:is|are|means|mean|refers to|defined as|called|represents)\\b[^.!?]{0,80}\\b${flexibleTerm}\\b`, 'iu')
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function looksSlideHeaderLine(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  return /^(?:slide|page|chapter|lesson|unit)\s*\d+\b/iu.test(text)
    || new RegExp(`^(?:${VOCAB_SECTION_LABEL_PATTERN}|${CONCEPT_LABEL_PATTERN}|${FORMULA_LABEL_PATTERN}|example|examples|practice|review)\\b`, 'iu').test(text);
}

function isPageHeaderText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (/^charlemagne text-based pdf import test$/iu.test(text)) return true;
  if (/^larger pdf:\s*electricity and magnetism\s+page\s+\d+\s+of\s+\d+/iu.test(text)) return true;
  if (/^page\s+\d+\s+of\s+\d+/iu.test(text)) return true;
  return false;
}

function looksHeadingOnlyEvidence(label, evidence) {
  if (!nonEmptyString(label) || !nonEmptyString(evidence)) return false;
  const text = String(evidence || '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!phraseAppearsInText(label, text)) return false;
  const tokens = contentTokens(text);
  const labelTokens = contentTokens(label);
  const hasSentencePunctuation = /[.!?;]/u.test(text);
  return text.length <= 90 && tokens.length <= labelTokens.length + 3 && !hasSentencePunctuation;
}

function isThinEvidence(evidence) {
  const text = String(evidence || '').replace(/\s+/g, ' ').trim();
  return text.length > 0 && text.length < 40;
}

function addItemWarning(item, warning) {
  if (!item || !warning) return;
  const warnings = Array.isArray(item.warnings) ? item.warnings.slice() : [];
  if (!warnings.includes(warning)) warnings.push(warning);
  item.warnings = warnings;
  if (!nonEmptyString(item.notes)) {
    item.notes = warning;
  } else if (!item.notes.includes(warning)) {
    item.notes = `${item.notes} ${warning}`;
  }
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
      if (item.reviewStatus === 'approved' || item.reviewStatus === 'rejected') {
        errors.push(`${sectionName}[${index}].reviewStatus must not be "approved" or "rejected" for generated drafts.`);
      } else if (!['pending', 'needs_review'].includes(item.reviewStatus)) {
        errors.push(`${sectionName}[${index}].reviewStatus must be "pending" or "needs_review" for generated drafts.`);
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
    validationErrors: result.validationErrors || [],
    invalidItems: result.invalidItems || [],
    repairNeeded: result.repairNeeded || [],
    importSelection: result.importSelection,
    importScope: result.importScope,
    selectedImportEstimate: result.selectedImportEstimate,
    failedBatches: result.failedBatches || [],
    modelCrash: result.modelCrash === true,
    modelTimeout: result.modelTimeout === true
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
  isModelTimeoutMessage
};
