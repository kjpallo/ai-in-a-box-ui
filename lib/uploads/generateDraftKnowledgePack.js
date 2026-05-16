const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

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
const DEFAULT_RAW_MODEL_RESPONSES_DIR = path.join(__dirname, '..', '..', 'tmp', 'model-responses');
const KNOWLEDGE_PACK_FILE_NAME = 'knowledge_pack.json';
const DEFAULT_SCHEMA_VERSION = '1.0.0';
const DEFAULT_DRAFT_VERSION = '0.1.0-draft';
const DEFAULT_BATCH_MAX_CHARACTERS = 2500;
const DEFAULT_RETRY_BATCH_MAX_CHARACTERS = 1250;
const DEFAULT_BATCH_MAX_CHUNKS = 4;
const DEFAULT_PREVIEW_MAX_PAGES = 3;
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
  const selectedImport = !previewOnly && isSelectedImportRequested(options);
  const selectionResult = selectedImport
    ? makeSelectedExtraction(originalExtraction, options)
    : { success: true, extraction: originalExtraction, importSelection: null };
  if (!selectionResult.success) {
    return blocked({ warnings, errors: selectionResult.errors });
  }
  const extraction = previewOnly ? makePreviewExtraction(originalExtraction, options) : selectionResult.extraction;
  const importSelection = previewOnly ? makePreviewImportSelection(extraction, originalExtraction) : selectionResult.importSelection;
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

  const standardsResult = loadStandardsBank(options.standardsBankPath || options.standardsBank);
  warnings.push(...standardsResult.warnings);
  if (!standardsResult.success) {
    return blocked({ warnings, errors: standardsResult.errors });
  }

  const importEstimate = buildImportEstimate(originalExtraction, options);
  const selectedImportEstimate = importSelection ? buildImportEstimate(extraction, options) : null;
  recordProgress('import_estimate_ready', 'Import estimate ready', importEstimate);

  const batchPlan = buildExtractionBatches(extraction, options);
  const batches = batchPlan.batches;
  const promptSourceChunks = batchPlan.chunks;
  const generatedBatches = [];
  const rawModelResponses = [];
  recordProgress('wrapper_started', 'Building draft packet wrapper', {
    packName: sanitizePackName(options.packName),
    totalBatches: batches.length
  });

  for (const batch of batches) {
    const prompt = buildKnowledgePackPrompt({
      extraction: batch.extraction,
      standardsBank: standardsResult.standardsBank,
      packName: options.packName,
      batchInfo: {
        batchIndex: batch.batchIndex,
        totalBatches: batches.length
      }
    });

    recordProgress('batch_sent', `Sending batch ${batch.batchIndex} of ${batches.length} to Gemma`, {
      batchIndex: batch.batchIndex,
      totalBatches: batches.length,
      chunkCount: batch.chunks.length,
      characterCount: String(batch.extraction.text || '').length
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
      packName: options.packName
    });
    recordProgress('batch_received', `Received draft items from batch ${batch.batchIndex} of ${batches.length}`, {
      batchIndex: batch.batchIndex,
      totalBatches: batches.length,
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
        packName: options.packName
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
    packId: pack && pack.packId
  });
  const validation = validateKnowledgePack(pack, {
    standardsBank: standardsResult.standardsBank
  });
  warnings.push(...validation.warnings);
  recordProgress('coverage_report_built', 'Building coverage report', {
    totalChunks: coverageReport.totalChunks,
    processedChunks: coverageReport.processedChunks,
    chunksWithDraftItems: coverageReport.chunksWithDraftItems,
    warnings: coverageReport.warnings || []
  });

  if (draftSafetyErrors.length > 0 || !validation.valid) {
    recordProgress('error', firstError([...draftSafetyErrors, ...validation.errors], 'Draft validation failed.'), {
      errors: [...draftSafetyErrors, ...validation.errors]
    });
    return blocked({
      packId: pack && pack.packId,
      warnings,
      errors: [...draftSafetyErrors, ...validation.errors],
      validationPassed: false,
      rawModelResponsePath: writeRawResponse(options, JSON.stringify({
        rawModelResponses,
        parsedModelResponse: generatedBatches.map((entry) => entry.parsedModelResponse),
        normalizedDraftAttempt: pack,
        errors: [...draftSafetyErrors, ...validation.errors]
      }, null, 2)),
      timeline
    });
  }

  const safePackId = pack.packId;
  if (previewOnly) {
    recordProgress('preview_ready', 'Preview draft ready', {
      packId: safePackId,
      itemCounts: countGeneratedItems(pack)
    });
    return {
      success: true,
      preview: true,
      packId: safePackId,
      title: pack.title || safePackId,
      sourceFiles: normalizedSourceFileNames(pack),
      extractionCharacterCount: String(extraction.text || '').length,
      extractionChunkCount: Array.isArray(extraction.sections) ? extraction.sections.length : 0,
      extractionPageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
      fullImportEstimate: importEstimate,
      selectedImportEstimate,
      importSelection,
      previewReport: {
        pack,
        coverageReport,
        processedPageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
        processedCharacterCount: String(extraction.text || '').length,
        processedChunkCount: Array.isArray(extraction.sections) ? extraction.sections.length : 0
      },
      coverageReport,
      importSelection,
      timeline,
      validationPassed: true,
      warnings,
      errors: []
    };
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
    coverageReport,
    importSelection,
    selectedImportEstimate,
    timeline,
    outputPath,
    validationPassed: true,
    warnings,
    errors: []
  };
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
    rawModelResponse = await modelClient({ model, prompt, timeoutMs, keepAlive });
  } catch (error) {
    const errors = makeModelBatchErrors(batch, batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches, [error.message]);
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
        keepAlive
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
    chunkCount,
    estimatedGemmaBatches,
    maxCharsPerBatch,
    retryMaxCharsPerBatch,
    previewMaxPages: previewMaxPages(options),
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
  if (pageSections.length > 0 && (requested.pageStart || requested.pageEnd)) {
    const start = requested.pageStart || 1;
    const end = requested.pageEnd || start;
    const selectedPages = pageSections.filter((page) => page.pageNumber >= start && page.pageNumber <= end);
    if (!selectedPages.length) {
      return {
        success: false,
        errors: [`No extracted text was found for selected pages ${start}-${end}. Choose a range that exists in this upload.`]
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
      errors: [`No extracted text was found for selected chunks ${start}-${end}. Choose a range that exists in this upload.`]
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

function makePreviewImportSelection(extraction, originalExtraction) {
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
        errors: makeModelBatchErrors(originalBatch, totalBatches, retryResult.errors, true),
        failedBatches: [failedBatch]
      };
    }

    parsedModelResponses.push(retryResult.parsedModelResponse);
    packs.push(normalizeDraftKnowledgePack(retryResult.parsedModelResponse, {
      extraction: retryBatch.extraction,
      packName
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
    : mergeDraftKnowledgePacks(packs, { extraction: originalBatch.extraction, packName });

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
  base.vocabulary = mergeUniqueObjects(packs.flatMap((pack) => pack.vocabulary || []), vocabularyKey);
  base.concepts = mergeUniqueObjects(packs.flatMap((pack) => pack.concepts || []), conceptKey);
  base.referenceFormulas = mergeUniqueObjects(packs.flatMap((pack) => pack.referenceFormulas || []), formulaKey);
  base.problemBank = mergeUniqueObjects(packs.flatMap((pack) => pack.problemBank || []), problemKey);
  base.standardsMap = mergeUniqueObjects(packs.flatMap((pack) => pack.standardsMap || []), standardsMapKey);
  base.smokeTests = mergeUniqueObjects(packs.flatMap((pack) => pack.smokeTests || []), smokeTestKey);
  base.metadata = {
    ...(base.metadata || {}),
    importBatches: packs.length
  };

  const packName = sanitizePackName(options.packName);
  if (packName) base.title = packName;
  return base;
}

function mergeUniqueObjects(items, makeKey) {
  const seen = new Set();
  const merged = [];
  items.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const key = makeKey(item);
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    merged.push(item);
  });
  return merged;
}

function sourceFileKey(item) {
  return normalizeKey(item.fileName);
}

function vocabularyKey(item) {
  return normalizeKey(item.term);
}

function conceptKey(item) {
  return normalizeKey(firstNonEmptyString(item.conceptId, item.title));
}

function formulaKey(item) {
  return normalizeKey(firstNonEmptyString(item.formulaId, item.title, item.equation));
}

function problemKey(item) {
  return normalizeKey(firstNonEmptyString(item.problemId, item.question));
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

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function modelMaxCharacters(options = {}) {
  return positiveInteger(options.maxBatchCharacters || process.env.IMPORT_MODEL_MAX_CHARS, DEFAULT_BATCH_MAX_CHARACTERS);
}

function modelRetryMaxCharacters(options = {}) {
  const configured = positiveInteger(options.retryMaxBatchCharacters || options.retryMaxCharacters || process.env.IMPORT_MODEL_RETRY_MAX_CHARS, DEFAULT_RETRY_BATCH_MAX_CHARACTERS);
  return Math.min(configured, Math.max(1, Math.floor(modelMaxCharacters(options) / 2)));
}

function previewMaxPages(options = {}) {
  return positiveInteger(options.previewMaxPages || process.env.IMPORT_PREVIEW_MAX_PAGES, DEFAULT_PREVIEW_MAX_PAGES);
}

function fullImportRequiresConfirmation(options = {}) {
  const value = options.fullImportRequiresConfirmation ?? process.env.IMPORT_FULL_REQUIRES_CONFIRMATION;
  if (value === undefined || value === null || value === '') return DEFAULT_FULL_REQUIRES_CONFIRMATION;
  return !['false', '0', 'no'].includes(String(value).trim().toLowerCase());
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

function makeModelBatchErrors(batch, totalBatches, underlyingErrors = [], afterRetry = false) {
  const batchIndex = batch && batch.batchIndex || 1;
  const total = Number(totalBatches || batch && batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches || 1);
  const labels = Array.isArray(batch && batch.chunks) ? batch.chunks.map((chunk) => chunk.label).filter(Boolean) : [];
  const pageLabels = labels.length ? ` Affected source chunks/pages: ${labels.join(', ')}.` : '';
  const retryText = afterRetry
    ? ' It still failed after Charlemagne retried with smaller chunks.'
    : ' Charlemagne will retry with smaller chunks when possible; if this keeps happening, use a smaller batch size or a lighter local model.';
  const original = underlyingErrors.map((error) => String(error || '').trim()).filter(Boolean).join('; ');
  return [
    `Gemma ran out of resources. Try preview mode, smaller batch size, or a smaller model. Gemma crashed while reading batch ${batchIndex} of ${total}. The batch may be too large for the local model.${retryText}${pageLabels}`,
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
  keepAlive = DEFAULT_OLLAMA_KEEP_ALIVE
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
    keep_alive: keepAlive
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
    sourceDefaults
  });

  normalized.sourceFiles = normalizeSourceFiles(normalized.sourceFiles, options.extraction, sourceDefaults);
  normalized.vocabulary = normalized.vocabulary.map((item) => normalizeVocabularyItem(item, sourceDefaults));
  normalized.concepts = normalized.concepts.map((item) => normalizeConceptItem(item, sourceDefaults));
  normalized.referenceFormulas = normalized.referenceFormulas.map((item) => normalizeReferenceFormula(item, sourceDefaults));
  normalized.problemBank = normalized.problemBank.map((item) => normalizeProblemItem(item, sourceDefaults));
  normalized.standardsMap = normalized.standardsMap.map(normalizeStandardsMapItem);
  normalized.smokeTests = normalized.smokeTests.map(normalizeSmokeTest);

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

function normalizeVocabularyItem(item, sourceDefaults) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return normalizeSourceTracking(normalizeReviewFields({
    ...item,
    aliases: Array.isArray(item.aliases) ? item.aliases : [],
    standards: Array.isArray(item.standards) ? item.standards : []
  }), sourceDefaults);
}

function normalizeConceptItem(item, sourceDefaults) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  const normalized = { ...item };
  ['aliases', 'keyIdeas', 'examples', 'nonExamples', 'commonMisconceptions', 'standards'].forEach((field) => {
    if (!Array.isArray(normalized[field])) normalized[field] = [];
  });
  return normalizeSourceTracking(normalizeReviewFields(normalized), sourceDefaults);
}

function normalizeReferenceFormula(item, sourceDefaults) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return normalizeSourceTracking(normalizeReviewFields({
    ...item,
    variables: Array.isArray(item.variables) ? item.variables : [],
    solverStatus: 'reference_only'
  }), sourceDefaults);
}

function normalizeProblemItem(item, sourceDefaults) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return normalizeSourceTracking(normalizeReviewFields({
    ...item,
    standards: Array.isArray(item.standards) ? item.standards : []
  }), sourceDefaults);
}

function normalizeStandardsMapItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return normalizeReviewFields({
    ...item,
    relatedVocabulary: Array.isArray(item.relatedVocabulary) ? item.relatedVocabulary : [],
    relatedConcepts: Array.isArray(item.relatedConcepts) ? item.relatedConcepts : []
  });
}

function normalizeSmokeTest(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return normalizeReviewFields(item);
}

function normalizeReviewFields(item) {
  return {
    ...item,
    reviewStatus: 'pending',
    confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'low'
  };
}

function normalizeSourceTracking(item, sourceDefaults) {
  return {
    ...item,
    sourceFile: nonEmptyString(item.sourceFile) ? item.sourceFile : sourceDefaults.sourceFile,
    sourceLocation: nonEmptyString(item.sourceLocation) ? item.sourceLocation : sourceDefaults.sourceLocation,
    sourceTextSnippet: nonEmptyString(item.sourceTextSnippet)
      ? item.sourceTextSnippet
      : nonEmptyString(item.sourceSnippet)
        ? item.sourceSnippet
        : sourceDefaults.sourceTextSnippet
  };
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

function buildSafeDraftMetadata(modelMetadata, { extraction, packName, packId, sourceDefaults }) {
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
    }
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
  makeSelectedExtraction,
  normalizeDraftKnowledgePack,
  parseModelResponse,
  validateDraftSafety
};
