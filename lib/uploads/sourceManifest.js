const SOURCE_MANIFEST_STATUSES = [
  'queued',
  'processing',
  'drafted',
  'skipped_empty',
  'no_items_found',
  'needs_review',
  'failed_after_retries'
];

const TERMINAL_SOURCE_MANIFEST_STATUSES = [
  'drafted',
  'skipped_empty',
  'no_items_found',
  'needs_review',
  'failed_after_retries'
];

const DEFAULT_LOW_TEXT_CHARACTER_THRESHOLD = 20;

function makeSourceManifestFromExtraction(extraction, options = {}) {
  const sections = makeManifestSections(extraction);
  const threshold = positiveInteger(options.lowTextCharacterThreshold, DEFAULT_LOW_TEXT_CHARACTER_THRESHOLD);
  return sections.map((section, index) => makeManifestEntry(section, index + 1, extraction, threshold));
}

function normalizeSourceManifest(manifest, extraction, options = {}) {
  const threshold = positiveInteger(options.lowTextCharacterThreshold, DEFAULT_LOW_TEXT_CHARACTER_THRESHOLD);
  const fallbackManifest = makeSourceManifestFromExtraction(extraction, options);
  if (!Array.isArray(manifest) || manifest.length === 0) {
    return fallbackManifest;
  }

  return manifest.map((entry, index) => {
    const fallback = fallbackManifest[index] || makeManifestEntry({}, index + 1, extraction, threshold);
    const status = isValidManifestStatus(entry && entry.status) ? entry.status : fallback.status;
    return {
      chunkId: firstNonEmptyString(entry && entry.chunkId, fallback.chunkId),
      sourceFile: firstNonEmptyString(entry && entry.sourceFile, fallback.sourceFile),
      sourceLocation: firstNonEmptyString(entry && entry.sourceLocation, fallback.sourceLocation),
      chunkIndex: positiveInteger(entry && entry.chunkIndex, fallback.chunkIndex),
      charCount: nonNegativeInteger(entry && entry.charCount, fallback.charCount),
      status
    };
  });
}

function summarizeManifestCoverage(sourceManifest) {
  const summary = {
    totalChunks: 0,
    queuedChunks: 0,
    draftedChunks: 0,
    skippedEmptyChunks: 0,
    noItemsFoundChunks: 0,
    needsReviewChunks: 0,
    failedChunks: 0,
    totalSourceChars: 0,
    completedChunks: 0,
    allChunksTerminal: false
  };

  (Array.isArray(sourceManifest) ? sourceManifest : []).forEach((entry) => {
    summary.totalChunks += 1;
    summary.totalSourceChars += nonNegativeInteger(entry && entry.charCount, 0);
    const status = entry && entry.status;
    if (status === 'queued' || status === 'processing') summary.queuedChunks += 1;
    if (status === 'drafted') summary.draftedChunks += 1;
    if (status === 'skipped_empty') summary.skippedEmptyChunks += 1;
    if (status === 'no_items_found') summary.noItemsFoundChunks += 1;
    if (status === 'needs_review') summary.needsReviewChunks += 1;
    if (status === 'failed_after_retries') summary.failedChunks += 1;
    if (isTerminalManifestStatus(status)) summary.completedChunks += 1;
  });

  summary.allChunksTerminal = summary.totalChunks > 0 && summary.completedChunks === summary.totalChunks;
  return summary;
}

function isTerminalManifestStatus(status) {
  return TERMINAL_SOURCE_MANIFEST_STATUSES.includes(String(status || ''));
}

function isValidManifestStatus(status) {
  return SOURCE_MANIFEST_STATUSES.includes(String(status || ''));
}

function makeManifestSections(extractionInput = {}) {
  const extraction = extractionInput && typeof extractionInput === 'object' ? extractionInput : {};
  const pages = Array.isArray(extraction.pages)
    ? extraction.pages
    : Array.isArray(extraction.metadata && extraction.metadata.pages)
      ? extraction.metadata.pages
      : [];
  if (pages.length > 0) {
    return pages.map((page, index) => normalizeManifestSection(page, index));
  }

  if (Array.isArray(extraction.sections) && extraction.sections.length > 0) {
    return extraction.sections.map((section, index) => normalizeManifestSection(section, index));
  }

  if (typeof extraction.text === 'string') {
    return [{
      label: 'Full Text',
      sourceLocation: 'Full Text',
      text: extraction.text,
      sourceFile: extraction.fileName
    }];
  }

  return [];
}

function normalizeManifestSection(section, index) {
  const pageNumber = positiveInteger(
    section && (section.pageNumber || section.page || section.number || section.num),
    0
  );
  const sourceLocation = firstNonEmptyString(
    section && section.sourceLocation,
    section && section.label,
    pageNumber ? `Page ${pageNumber}` : `Chunk ${index + 1}`
  );
  return {
    sourceLocation,
    label: firstNonEmptyString(section && section.label, sourceLocation),
    sourceFile: firstNonEmptyString(section && section.sourceFile),
    pageNumber,
    text: String(section && (section.text || section.content) || '')
  };
}

function makeManifestEntry(section, chunkIndex, extraction, lowTextThreshold) {
  const charCount = String(section && section.text || '').length;
  return {
    chunkId: `chunk-${chunkIndex}`,
    sourceFile: firstNonEmptyString(
      section && section.sourceFile,
      extraction && extraction.upload && extraction.upload.originalFileName,
      extraction && extraction.fileName,
      extraction && extraction.upload && extraction.upload.storedFileName
    ),
    sourceLocation: firstNonEmptyString(
      section && section.sourceLocation,
      section && section.label,
      `Chunk ${chunkIndex}`
    ),
    chunkIndex,
    charCount,
    status: initialStatusForCharCount(charCount, lowTextThreshold)
  };
}

function initialStatusForCharCount(charCount, lowTextThreshold) {
  if (!Number.isFinite(charCount) || charCount <= 0) return 'skipped_empty';
  if (charCount < lowTextThreshold) return 'needs_review';
  return 'queued';
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function nonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function firstNonEmptyString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) || '';
}

module.exports = {
  DEFAULT_LOW_TEXT_CHARACTER_THRESHOLD,
  SOURCE_MANIFEST_STATUSES,
  TERMINAL_SOURCE_MANIFEST_STATUSES,
  isTerminalManifestStatus,
  makeSourceManifestFromExtraction,
  normalizeSourceManifest,
  summarizeManifestCoverage
};
