const os = require('node:os');

const DEFAULT_MAX_CHARACTERS_PER_BATCH = 2500;
const DEFAULT_MAX_ESTIMATED_TOKENS_PER_BATCH = 900;
const DEFAULT_SMALL_SECTION_CHARACTERS = 1800;
const DEFAULT_LOW_MEMORY_MB = 1024;
const DEFAULT_VERY_LARGE_BATCH_LIMIT = 40;
const DEFAULT_TOKEN_CHARACTER_RATIO = 3;

function planTeacherContentImport(input = {}) {
  const extraction = normalizeExtraction(input);
  const settings = input.settings && typeof input.settings === 'object' ? input.settings : {};
  const memory = normalizeMemory(input.memory || input.systemMemory);
  const maxCharactersPerBatch = positiveInteger(
    input.maxCharactersPerBatch || settings.maxBatchCharacters || settings.importMaxCharactersPerBatch || process.env.IMPORT_MODEL_MAX_CHARS,
    DEFAULT_MAX_CHARACTERS_PER_BATCH
  );
  const maxEstimatedTokensPerBatch = positiveInteger(
    input.maxEstimatedTokensPerBatch || settings.maxEstimatedTokensPerBatch || settings.importMaxEstimatedTokensPerBatch,
    Math.max(1, Math.floor(maxCharactersPerBatch / DEFAULT_TOKEN_CHARACTER_RATIO))
  );
  const sections = normalizeSections(extraction);
  const textBearingSections = sections.filter((section) => section.text.trim().length > 0);
  const totalCharacters = textBearingSections.reduce((sum, section) => sum + section.text.length, 0);
  const largestSectionCharacterCount = textBearingSections.reduce((max, section) => Math.max(max, section.text.length), 0);
  const estimatedTokens = estimateTokens(totalCharacters);
  const warnings = [];
  const totalUnitCount = inferTotalUnitCount(extraction, sections);
  const textBearingUnitCount = countUniqueUnits(textBearingSections);
  const firstTextBearingUnit = firstUnit(textBearingSections);
  const imageOnlyDetected = detectImageOnlySections(extraction, totalUnitCount, textBearingUnitCount);
  const lowMemory = memory.availableMemoryMb > 0 && memory.availableMemoryMb < positiveInteger(settings.lowMemoryMb, DEFAULT_LOW_MEMORY_MB);
  const fileSizeBytes = positiveInteger(input.fileSizeBytes || input.fileSize || extraction.fileSizeBytes || extraction.rawFileSizeBytes, 0);
  const fileType = String(
    input.fileType
    || extraction.fileType
    || extraction.type
    || extraction.metadata.detectedType
    || extraction.metadata.fileType
    || ''
  ).toLowerCase();
  const originalFileName = String(
    input.originalFileName
    || extraction.originalFileName
    || extraction.fileName
    || extraction.upload.originalFileName
    || ''
  );
  const model = String(input.model || settings.model || settings.importModel || process.env.OLLAMA_MODEL || '');

  if (imageOnlyDetected) {
    warnings.push('Some pages/slides appear to contain images or media with little or no extracted text. OCR/vision is not part of this phase.');
  }

  if (!textBearingSections.length) {
    if (totalUnitCount > 0) {
      warnings.push('No text-bearing pages/slides/sheets were found. OCR/vision is not part of this phase.');
    }
    return makePlan({
      mode: 'manual_review_needed',
      recommendedImportScope: 'preview_sample',
      batchStrategy: 'manual',
      batches: [],
      limits: makeLimits(maxCharactersPerBatch, maxEstimatedTokensPerBatch, memory),
      warnings,
      reason: 'No extracted text-bearing sections were found, so a safe import scope cannot be selected automatically.',
      inspection: makeInspection({
        fileType,
        originalFileName,
        fileSizeBytes,
        totalUnitCount,
        textBearingUnitCount,
        firstTextBearingUnit,
        totalCharacters,
        largestSectionCharacterCount,
        estimatedTokens,
        model
      })
    });
  }

  const fullBatches = makeBatches(textBearingSections, maxCharactersPerBatch, maxEstimatedTokensPerBatch);
  const veryLarge = fullBatches.length > positiveInteger(settings.veryLargeBatchLimit, DEFAULT_VERY_LARGE_BATCH_LIMIT);

  if (lowMemory && fullBatches.length > 1) {
    warnings.push(`Available memory is low (${memory.availableMemoryMb} MB). Start with a preview or selected range before continuing.`);
    return makePlan({
      mode: 'auto_preview_only',
      recommendedImportScope: 'preview_sample',
      batchStrategy: 'preview_then_continue',
      batches: fullBatches.slice(0, 1),
      batchCount: 1,
      limits: makeLimits(maxCharactersPerBatch, maxEstimatedTokensPerBatch, memory),
      warnings,
      reason: 'The upload has extracted text, but local memory is low. The safest default is to generate a preview first, then continue with manual override if it looks good.',
      inspection: makeInspection({
        fileType,
        originalFileName,
        fileSizeBytes,
        totalUnitCount,
        textBearingUnitCount,
        firstTextBearingUnit,
        totalCharacters,
        largestSectionCharacterCount,
        estimatedTokens,
        model
      })
    });
  }

  if (veryLarge) {
    warnings.push('This upload is very large. The planner is not selecting every section automatically; use selected range or manual review to avoid overloading the local model.');
    return makePlan({
      mode: 'auto_selected_range',
      recommendedImportScope: 'selected_range',
      batchStrategy: 'preview_then_continue',
      batches: fullBatches.slice(0, Math.min(3, fullBatches.length)),
      batchCount: Math.min(3, fullBatches.length),
      limits: makeLimits(maxCharactersPerBatch, maxEstimatedTokensPerBatch, memory),
      warnings,
      reason: 'The upload exceeds the safe automatic full-document batch count. Review a selected range first, then continue intentionally.',
      inspection: makeInspection({
        fileType,
        originalFileName,
        fileSizeBytes,
        totalUnitCount,
        textBearingUnitCount,
        firstTextBearingUnit,
        totalCharacters,
        largestSectionCharacterCount,
        estimatedTokens,
        model
      })
    });
  }

  const singleSmallSection = textBearingSections.length === 1 && totalCharacters <= positiveInteger(settings.smallSectionCharacters, DEFAULT_SMALL_SECTION_CHARACTERS);
  return makePlan({
    mode: singleSmallSection || fullBatches.length === 1 ? 'auto_full' : 'auto_full',
    recommendedImportScope: 'full_document',
    batchStrategy: fullBatches.length === 1 ? 'single_batch' : 'sequential_batches',
    batches: fullBatches,
    limits: makeLimits(maxCharactersPerBatch, maxEstimatedTokensPerBatch, memory),
    warnings,
    reason: fullBatches.length === 1
      ? 'The extracted text fits safely in one local model batch, so full-document import is the safest default.'
      : `The extracted text can be safely split into ${fullBatches.length} sequential batches without dropping text-bearing sections.`,
    inspection: makeInspection({
      fileType,
      originalFileName,
      fileSizeBytes,
      totalUnitCount,
      textBearingUnitCount,
      firstTextBearingUnit,
      totalCharacters,
      largestSectionCharacterCount,
      estimatedTokens,
      model
    })
  });
}

function normalizeExtraction(input = {}) {
  const extraction = input.extraction && typeof input.extraction === 'object'
    ? input.extraction
    : input.metadata && typeof input.metadata === 'object'
      ? input.metadata
      : input;
  return {
    ...extraction,
    upload: extraction.upload && typeof extraction.upload === 'object' ? extraction.upload : {},
    metadata: extraction.metadata && typeof extraction.metadata === 'object' ? extraction.metadata : {},
    sections: Array.isArray(input.sections) ? input.sections : Array.isArray(extraction.sections) ? extraction.sections : [],
    pages: Array.isArray(input.pages) ? input.pages : Array.isArray(extraction.pages) ? extraction.pages : []
  };
}

function normalizeSections(extraction = {}) {
  const pages = Array.isArray(extraction.pages) && extraction.pages.length
    ? extraction.pages
    : Array.isArray(extraction.metadata.pages)
      ? extraction.metadata.pages
      : [];
  const source = pages.length ? pages : Array.isArray(extraction.sections) ? extraction.sections : [];
  const sections = source.map((section, index) => {
    const pageNumber = positiveInteger(section.pageNumber || section.page || section.number || section.num, index + 1);
    const label = firstNonEmptyString(section.label, section.sourceLocation, pageNumber ? `Page ${pageNumber}` : `Section ${index + 1}`);
    return {
      batchSourceIndex: index + 1,
      sourceLocation: firstNonEmptyString(section.sourceLocation, section.label, label),
      label,
      pageNumber,
      text: String(section.text || section.content || '')
    };
  });

  if (sections.length) return sections;

  const text = String(extraction.text || '');
  return text.trim()
    ? [{ batchSourceIndex: 1, sourceLocation: 'Full Text', label: 'Full Text', pageNumber: 1, text }]
    : [];
}

function makeBatches(sections, maxCharactersPerBatch, maxEstimatedTokensPerBatch) {
  const chunks = [];
  sections.forEach((section) => {
    splitLongText(section.text, maxCharactersPerBatch).forEach((text, chunkIndex) => {
      chunks.push({
        ...section,
        sourceLocation: chunkIndex > 0 ? `${section.sourceLocation} chunk ${chunkIndex + 1}` : section.sourceLocation,
        text
      });
    });
  });

  const batches = [];
  let current = [];
  let currentCharacters = 0;
  chunks.forEach((chunk) => {
    const chunkTokens = estimateTokens(chunk.text.length);
    const wouldExceedCharacters = current.length > 0 && currentCharacters + chunk.text.length > maxCharactersPerBatch;
    const wouldExceedTokens = current.length > 0 && estimateTokens(currentCharacters) + chunkTokens > maxEstimatedTokensPerBatch;
    if (wouldExceedCharacters || wouldExceedTokens) {
      batches.push(current);
      current = [];
      currentCharacters = 0;
    }
    current.push(chunk);
    currentCharacters += chunk.text.length;
  });
  if (current.length) batches.push(current);

  return batches.map((batch, index) => {
    const estimatedCharacters = batch.reduce((sum, section) => sum + section.text.length, 0);
    return {
      batchIndex: index + 1,
      sourceLocations: batch.map((section) => section.sourceLocation),
      pageNumbers: Array.from(new Set(batch.map((section) => section.pageNumber).filter(Boolean))).sort((a, b) => a - b),
      estimatedCharacters,
      estimatedTokens: estimateTokens(estimatedCharacters)
    };
  });
}

function splitLongText(text, maxLength) {
  const value = String(text || '');
  if (value.length <= maxLength) return value.trim() ? [value.trim()] : [];
  const parts = [];
  let cursor = 0;
  while (cursor < value.length) {
    const limit = Math.min(cursor + maxLength, value.length);
    let next = limit;
    if (limit < value.length) {
      const paragraphBreak = value.lastIndexOf('\n\n', limit);
      const sentenceBreak = value.lastIndexOf('. ', limit);
      const candidate = Math.max(paragraphBreak, sentenceBreak);
      if (candidate > cursor + Math.floor(maxLength * 0.5)) next = candidate + 1;
    }
    const part = value.slice(cursor, next).trim();
    if (part) parts.push(part);
    cursor = next;
  }
  return parts;
}

function detectImageOnlySections(extraction, totalUnitCount, textBearingUnitCount) {
  const metadata = extraction.metadata || {};
  if (metadata.hasImagesOrMedia || metadata.hasImageOnlyPages || metadata.hasImageOnlySlides) return true;
  const imageOnlyPages = metadata.imageOnlyPages || metadata.imageOnlySlides || metadata.pagesWithoutText;
  if (Array.isArray(imageOnlyPages) && imageOnlyPages.length > 0) return true;
  return totalUnitCount > 0 && textBearingUnitCount < totalUnitCount;
}

function inferTotalUnitCount(extraction, sections) {
  const metadata = extraction.metadata || {};
  return positiveInteger(
    metadata.pageCount || metadata.slideCount || metadata.sheetCount || extraction.pageCount || extraction.slideCount || extraction.sheetCount,
    sections.length
  );
}

function countUniqueUnits(sections) {
  const units = Array.from(new Set(sections.map((section) => section.pageNumber).filter(Boolean)));
  return units.length || sections.length;
}

function firstUnit(sections) {
  const units = sections.map((section) => section.pageNumber).filter(Boolean).sort((a, b) => a - b);
  return units[0] || null;
}

function estimateTokens(characters) {
  return Math.ceil(Math.max(0, Number(characters || 0)) / DEFAULT_TOKEN_CHARACTER_RATIO);
}

function normalizeMemory(memory = {}) {
  const free = typeof memory.freemem === 'function' ? memory.freemem() : memory.freeMemoryBytes || memory.availableMemoryBytes || memory.free;
  const total = typeof memory.totalmem === 'function' ? memory.totalmem() : memory.totalMemoryBytes || memory.total;
  return {
    availableMemoryMb: bytesToMb(free || os.freemem()),
    totalMemoryMb: bytesToMb(total || os.totalmem())
  };
}

function makeLimits(maxCharactersPerBatch, maxEstimatedTokensPerBatch, memory) {
  return {
    maxCharactersPerBatch,
    maxEstimatedTokensPerBatch,
    availableMemoryMb: memory.availableMemoryMb,
    totalMemoryMb: memory.totalMemoryMb
  };
}

function makeInspection(values) {
  return {
    fileType: values.fileType,
    originalFileName: values.originalFileName,
    rawFileSizeBytes: values.fileSizeBytes,
    totalPageSlideSheetCount: values.totalUnitCount,
    textBearingPageSlideSheetCount: values.textBearingUnitCount,
    firstTextBearingPageSlideSheet: values.firstTextBearingUnit,
    totalExtractedCharacters: values.totalCharacters,
    largestSectionCharacterCount: values.largestSectionCharacterCount,
    estimatedTokenCount: values.estimatedTokens,
    configuredImportModel: values.model
  };
}

function makePlan(plan) {
  const batches = Array.isArray(plan.batches) ? plan.batches : [];
  return {
    mode: plan.mode,
    recommendedImportScope: plan.recommendedImportScope,
    batchStrategy: plan.batchStrategy,
    batchCount: Number.isFinite(plan.batchCount) ? plan.batchCount : batches.length,
    batches,
    limits: plan.limits,
    warnings: Array.isArray(plan.warnings) ? plan.warnings : [],
    reason: plan.reason,
    canOverride: true,
    inspection: plan.inspection
  };
}

function bytesToMb(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed / 1024 / 1024) : 0;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

module.exports = {
  planTeacherContentImport
};
