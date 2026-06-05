const fs = require('node:fs');
const path = require('node:path');

const { validateKnowledgePack } = require('../knowledge/validateKnowledgePack');
const { buildImportCoverageReport } = require('./buildImportCoverageReport');
const { buildKnowledgePackPrompt } = require('./buildKnowledgePackPrompt');
const { normalizeSourceManifest } = require('./sourceManifest');
const { KNOWLEDGE_PACK_FILE_NAME, GENERATED_ITEM_SECTIONS } = require('./importConstants');
const {
  modelRetryMaxCharacters
} = require('./importSafety');
const {
  buildRetryBatchesForBatch,
  applyImportCompletionFromCoverage,
  summarizeBatchSource
} = require('./extractionBatching');
const {
  generateBatchDraft,
  retryBatchWithSmallerChunks,
  shouldRetryModelCrash,
  makeFailedBatchWarning,
  normalizeRawResponses
} = require('./modelGenerationClient');
const {
  normalizeDraftKnowledgePack,
  mergeDraftKnowledgePacks,
  normalizeImportProfile,
  countGeneratedItems,
  hasAnyReviewableGeneratedItems,
  buildInvalidGeneratedItemTechnicalErrors,
  normalizedSourceFileNames
} = require('./draftPackNormalizer');
const { applySourceEvidenceValidation } = require('./sourceEvidenceValidation');
const { validateDraftSafety, writeRawResponse, blocked } = require('./importResultBuilders');

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


module.exports = {
  runAdaptiveImportLoop,
  mergeGeneratedBatchPacks,
  chunkIndexesFromBatch,
  markManifestChunkStatus,
  countCoreKnowledgeItems,
  processedChunksFromManifest,
  writePartialDraftFromSuccessfulBatches,
  makePreviewValidationSalvage,
  validationErrorBelongsToItem,
  hasUsefulPreviewItems,
  cloneJson
};
