const {
  makeSourceManifestFromExtraction,
  normalizeSourceManifest,
  summarizeManifestCoverage
} = require('./sourceManifest');

const COUNTED_SECTIONS = [
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap',
  'smokeTests'
];

const SOURCE_TRACKED_SECTIONS = [
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank'
];

function buildImportCoverageReport(options = {}) {
  const extraction = options.extraction || null;
  const pack = options.pack || null;
  if (!extraction && pack && pack.metadata && pack.metadata.importCoverage) {
    return normalizeStoredCoverageReport(pack.metadata.importCoverage, pack);
  }

  const storedCoverage = pack && pack.metadata && pack.metadata.importCoverage;
  const sourceChunks = normalizeSourceChunks(options.sourceChunks, extraction);
  const sourceManifest = resolveSourceManifest({
    explicitManifest: options.sourceManifest,
    extraction,
    pack,
    storedCoverage,
    sourceChunks
  });
  const processedChunks = normalizeProcessedChunks(options.processedChunks, sourceChunks, sourceManifest);
  const failedBatches = normalizeFailedBatches(options.failedBatches || storedCoverage && storedCoverage.failedBatches);
  const itemCounts = buildItemCounts(pack);

  const draftedChunkIndexes = detectDraftedChunkIndexes({ pack, sourceManifest, sourceChunks });
  const failedChunkIndexes = detectFailedChunkIndexes({ failedBatches, processedChunks, sourceManifest, sourceChunks });
  const processedChunkIndexes = new Set(processedChunks.map((chunk) => Number(chunk.sourceChunkIndex || chunk.index || 0)).filter((value) => Number.isFinite(value) && value > 0));

  const finalizedManifest = sourceManifest.map((entry) => {
    const chunkIndex = Number(entry.chunkIndex || 0);
    let status = String(entry.status || 'queued');

    if (failedChunkIndexes.has(chunkIndex)) {
      status = 'failed_after_retries';
    } else if (draftedChunkIndexes.has(chunkIndex)) {
      status = 'drafted';
    } else if (processedChunkIndexes.has(chunkIndex)) {
      if (status === 'skipped_empty') {
        status = 'skipped_empty';
      } else if (status === 'needs_review') {
        status = 'needs_review';
      } else {
        status = 'no_items_found';
      }
    } else if (status === 'processing') {
      status = 'queued';
    }

    return {
      chunkId: entry.chunkId,
      sourceFile: entry.sourceFile,
      sourceLocation: entry.sourceLocation,
      chunkIndex: entry.chunkIndex,
      charCount: entry.charCount,
      status
    };
  });

  const coverageSummary = summarizeManifestCoverage(finalizedManifest);
  const chunksWithDraftItems = finalizedManifest.filter((entry) => entry.status === 'drafted');
  const chunksWithNoExtractedKnowledge = finalizedManifest.filter((entry) => entry.status === 'no_items_found');
  const queuedChunks = finalizedManifest.filter((entry) => entry.status === 'queued' || entry.status === 'processing');

  const sectionsDetected = detectSections(sourceChunks);
  const sourceSignals = detectSourceSignals(sourceChunks);
  const totalPages = Number(extraction && extraction.metadata && extraction.metadata.pageCount || 0);
  const warnings = buildCoverageWarnings({
    extraction,
    itemCounts,
    sectionsDetected,
    sourceSignals,
    sourceChunks,
    chunksWithNoExtractedKnowledge,
    failedBatches,
    queuedChunks,
    coverageSummary
  });

  return {
    totalPages,
    totalChunks: coverageSummary.totalChunks,
    processedPages: inferProcessedPages(processedChunks, sourceChunks, totalPages),
    processedChunks: coverageSummary.totalChunks - coverageSummary.queuedChunks,
    pagesWithDraftItems: inferPagesWithDraftItems(chunksWithDraftItems, sourceChunks),
    chunksWithDraftItems: coverageSummary.draftedChunks,
    chunksWithNoExtractedKnowledge: coverageSummary.noItemsFoundChunks,
    noKnowledgeChunks: chunksWithNoExtractedKnowledge.map((chunk) => chunk.sourceLocation),
    sectionsDetected,
    sourceSignals,
    itemCounts,
    failedBatches,
    sourceManifest: finalizedManifest,
    coverageSummary,
    queuedChunks: coverageSummary.queuedChunks,
    allChunksTerminal: coverageSummary.allChunksTerminal,
    importComplete: coverageSummary.allChunksTerminal,
    warnings
  };
}

function normalizeStoredCoverageReport(stored, pack) {
  const sourceManifest = normalizeSourceManifest(stored && stored.sourceManifest, null);
  const coverageSummary = stored && stored.coverageSummary && typeof stored.coverageSummary === 'object'
    ? {
        totalChunks: Number(stored.coverageSummary.totalChunks || sourceManifest.length || 0),
        queuedChunks: Number(stored.coverageSummary.queuedChunks || 0),
        draftedChunks: Number(stored.coverageSummary.draftedChunks || 0),
        skippedEmptyChunks: Number(stored.coverageSummary.skippedEmptyChunks || 0),
        noItemsFoundChunks: Number(stored.coverageSummary.noItemsFoundChunks || 0),
        needsReviewChunks: Number(stored.coverageSummary.needsReviewChunks || 0),
        failedChunks: Number(stored.coverageSummary.failedChunks || 0),
        totalSourceChars: Number(stored.coverageSummary.totalSourceChars || sourceManifest.reduce((sum, entry) => sum + Number(entry.charCount || 0), 0)),
        completedChunks: Number(stored.coverageSummary.completedChunks || 0),
        allChunksTerminal: stored.coverageSummary.allChunksTerminal === true
      }
    : inferCoverageSummaryFromStored(stored, sourceManifest);

  const itemCounts = {
    ...buildItemCounts(pack),
    ...(stored && stored.itemCounts || {})
  };

  return {
    totalPages: Number(stored.totalPages || 0),
    totalChunks: Number(stored.totalChunks || coverageSummary.totalChunks || 0),
    processedPages: Number(stored.processedPages || 0),
    processedChunks: Number(stored.processedChunks || (coverageSummary.totalChunks - coverageSummary.queuedChunks)),
    pagesWithDraftItems: Number(stored.pagesWithDraftItems || 0),
    chunksWithDraftItems: Number(stored.chunksWithDraftItems || coverageSummary.draftedChunks || 0),
    chunksWithNoExtractedKnowledge: Number(stored.chunksWithNoExtractedKnowledge || coverageSummary.noItemsFoundChunks || 0),
    noKnowledgeChunks: Array.isArray(stored.noKnowledgeChunks) ? stored.noKnowledgeChunks : [],
    sectionsDetected: Array.isArray(stored.sectionsDetected) ? stored.sectionsDetected : [],
    sourceSignals: stored && stored.sourceSignals && typeof stored.sourceSignals === 'object' && !Array.isArray(stored.sourceSignals)
      ? stored.sourceSignals
      : {},
    itemCounts,
    failedBatches: Array.isArray(stored.failedBatches) ? stored.failedBatches : [],
    sourceManifest,
    coverageSummary,
    queuedChunks: Number(stored.queuedChunks || coverageSummary.queuedChunks || 0),
    allChunksTerminal: stored.allChunksTerminal === true || coverageSummary.allChunksTerminal === true,
    importComplete: stored.importComplete === true || coverageSummary.allChunksTerminal === true,
    warnings: Array.isArray(stored.warnings) ? stored.warnings : []
  };
}

function inferCoverageSummaryFromStored(stored, sourceManifest) {
  const manifestSummary = summarizeManifestCoverage(sourceManifest);
  const totalChunks = Number(stored && stored.totalChunks || manifestSummary.totalChunks || 0);
  const draftedChunks = Number(stored && stored.chunksWithDraftItems || manifestSummary.draftedChunks || 0);
  const noItemsFoundChunks = Number(stored && stored.chunksWithNoExtractedKnowledge || manifestSummary.noItemsFoundChunks || 0);
  const failedChunks = Array.isArray(stored && stored.failedBatches) ? stored.failedBatches.length : manifestSummary.failedChunks;
  const terminalCount = draftedChunks + noItemsFoundChunks + failedChunks + manifestSummary.skippedEmptyChunks + manifestSummary.needsReviewChunks;
  const queuedChunks = Math.max(0, totalChunks - terminalCount);

  return {
    totalChunks,
    queuedChunks,
    draftedChunks,
    skippedEmptyChunks: manifestSummary.skippedEmptyChunks,
    noItemsFoundChunks,
    needsReviewChunks: manifestSummary.needsReviewChunks,
    failedChunks,
    totalSourceChars: manifestSummary.totalSourceChars,
    completedChunks: terminalCount,
    allChunksTerminal: totalChunks > 0 && queuedChunks === 0
  };
}

function resolveSourceManifest({ explicitManifest, extraction, pack, storedCoverage, sourceChunks }) {
  if (Array.isArray(explicitManifest) && explicitManifest.length > 0) {
    return normalizeSourceManifest(explicitManifest, extraction);
  }
  if (storedCoverage && Array.isArray(storedCoverage.sourceManifest) && storedCoverage.sourceManifest.length > 0) {
    return normalizeSourceManifest(storedCoverage.sourceManifest, extraction);
  }
  if (Array.isArray(extraction && extraction.sourceManifest) && extraction.sourceManifest.length > 0) {
    return normalizeSourceManifest(extraction.sourceManifest, extraction);
  }
  if (Array.isArray(extraction && extraction.metadata && extraction.metadata.sourceManifest) && extraction.metadata.sourceManifest.length > 0) {
    return normalizeSourceManifest(extraction.metadata.sourceManifest, extraction);
  }
  if (extraction) {
    return normalizeSourceManifest(makeSourceManifestFromExtraction(extraction), extraction);
  }

  return sourceChunks.map((chunk, index) => ({
    chunkId: chunk.id || `chunk-${index + 1}`,
    sourceFile: chunk.sourceFile || '',
    sourceLocation: chunk.label || `Chunk ${index + 1}`,
    chunkIndex: Number(chunk.sourceChunkIndex || chunk.index || index + 1),
    charCount: Number(chunk.characterCount || String(chunk.text || '').length || 0),
    status: 'queued'
  }));
}

function normalizeSourceChunks(sourceChunks, extraction) {
  if (Array.isArray(sourceChunks) && sourceChunks.length > 0) {
    return sourceChunks.map((chunk, index) => {
      const sourceChunkIndex = positiveInteger(
        chunk.sourceChunkIndex || chunk.chunkIndex || chunk.index || inferChunkIndexFromLabel(chunk.label || chunk.sourceLocation),
        index + 1
      );
      return {
        id: chunk.id || `chunk-${sourceChunkIndex}`,
        index: Number(chunk.index || index + 1),
        sourceChunkIndex,
        label: chunk.label || chunk.sourceLocation || `Chunk ${sourceChunkIndex}`,
        page: inferPageNumber(chunk.pageNumber || chunk.page, chunk.label || chunk.sourceLocation),
        text: String(chunk.text || ''),
        characterCount: String(chunk.text || '').length,
        sourceFile: firstNonEmptyString(
          chunk.sourceFile,
          extraction && extraction.upload && extraction.upload.originalFileName,
          extraction && extraction.fileName
        )
      };
    });
  }
  return makeSourceChunks(extraction);
}

function makeSourceChunks(extraction) {
  if (!extraction || typeof extraction !== 'object') return [];
  const sections = Array.isArray(extraction.sections) ? extraction.sections : [];
  if (sections.length > 0) {
    return sections.map((section, index) => makeChunk(section, index, extraction));
  }

  const text = String(extraction.text || '');
  if (!text.trim()) return [];
  return [makeChunk({ label: 'Full Text', text }, 0, extraction)];
}

function makeChunk(section, index, extraction) {
  const label = firstNonEmptyString(
    section && section.sourceLocation,
    section && section.label,
    `Chunk ${index + 1}`
  );
  const text = String(section && section.text || '');
  return {
    id: `chunk-${index + 1}`,
    index: index + 1,
    sourceChunkIndex: index + 1,
    label,
    page: inferPageNumber(section && section.pageNumber, label),
    text,
    characterCount: text.length,
    sourceFile: firstNonEmptyString(
      extraction && extraction.upload && extraction.upload.originalFileName,
      extraction && extraction.fileName
    )
  };
}

function normalizeProcessedChunks(processedChunks, sourceChunks, sourceManifest) {
  if (Array.isArray(processedChunks) && processedChunks.length > 0) {
    return processedChunks.map((chunk, index) => {
      const sourceChunkIndex = positiveInteger(
        chunk.sourceChunkIndex || chunk.chunkIndex || chunk.index || inferChunkIndexFromLabel(chunk.label || chunk.sourceLocation),
        index + 1
      );
      return {
        id: chunk.id || `chunk-${sourceChunkIndex}`,
        label: chunk.label || chunk.sourceLocation || `Chunk ${sourceChunkIndex}`,
        page: inferPageNumber(chunk.pageNumber || chunk.page, chunk.label || chunk.sourceLocation),
        sourceChunkIndex
      };
    });
  }

  const manifestProcessed = (Array.isArray(sourceManifest) ? sourceManifest : [])
    .filter((entry) => ['processing', 'drafted', 'no_items_found', 'failed_after_retries'].includes(entry.status))
    .map((entry) => ({
      id: entry.chunkId,
      label: entry.sourceLocation,
      page: inferPageNumber(0, entry.sourceLocation),
      sourceChunkIndex: Number(entry.chunkIndex || 0)
    }))
    .filter((entry) => entry.sourceChunkIndex > 0);

  if (manifestProcessed.length > 0) return manifestProcessed;

  return sourceChunks.map((chunk) => ({
    id: chunk.id,
    label: chunk.label,
    page: chunk.page,
    sourceChunkIndex: Number(chunk.sourceChunkIndex || chunk.index || 0)
  }));
}

function buildItemCounts(pack) {
  const counts = {};
  COUNTED_SECTIONS.forEach((sectionName) => {
    counts[sectionName] = Array.isArray(pack && pack[sectionName]) ? pack[sectionName].length : 0;
  });
  return counts;
}

function detectDraftedChunkIndexes({ pack, sourceManifest, sourceChunks }) {
  const drafted = new Set();
  SOURCE_TRACKED_SECTIONS.forEach((sectionName) => {
    const items = Array.isArray(pack && pack[sectionName]) ? pack[sectionName] : [];
    items.forEach((item) => {
      const chunkIndex = findItemChunkIndex(item, sourceManifest, sourceChunks);
      if (chunkIndex > 0) drafted.add(chunkIndex);
    });
  });
  return drafted;
}

function findItemChunkIndex(item, sourceManifest, sourceChunks) {
  if (!item || typeof item !== 'object') return 0;
  if (sourceManifest.length === 1) return Number(sourceManifest[0].chunkIndex || 1);

  const sourceLocation = String(item.sourceLocation || '').trim().toLowerCase();
  if (sourceLocation) {
    const byLocation = sourceManifest.find((entry) => {
      const entryLocation = String(entry.sourceLocation || '').trim().toLowerCase();
      return entryLocation && (sourceLocation.includes(entryLocation) || entryLocation.includes(sourceLocation));
    });
    if (byLocation) return Number(byLocation.chunkIndex || 0);
  }

  const explicitChunkIndex = inferChunkIndexFromLabel(item.sourceLocation);
  if (explicitChunkIndex > 0) return explicitChunkIndex;

  const snippet = normalizeSnippet(item.sourceTextSnippet || item.sourceSnippet);
  if (snippet) {
    const bySnippet = sourceChunks.find((chunk) => normalizeSnippet(chunk.text).includes(snippet));
    if (bySnippet) return Number(bySnippet.sourceChunkIndex || bySnippet.index || 0);
  }

  const sourcePage = inferPageNumber(0, item.sourceLocation);
  if (sourcePage > 0) {
    const byPage = sourceChunks.find((chunk) => Number(chunk.page || 0) === sourcePage);
    if (byPage) return Number(byPage.sourceChunkIndex || byPage.index || 0);
  }

  return 0;
}

function detectFailedChunkIndexes({ failedBatches, processedChunks, sourceManifest, sourceChunks }) {
  const failed = new Set();

  const processedByLabel = new Map();
  processedChunks.forEach((chunk) => {
    processedByLabel.set(normalizeSnippet(chunk.label), Number(chunk.sourceChunkIndex || 0));
  });

  failedBatches.forEach((failedBatch) => {
    const labels = Array.isArray(failedBatch.chunkLabels) ? failedBatch.chunkLabels : [];
    labels.forEach((label) => {
      const normalizedLabel = normalizeSnippet(label);
      if (processedByLabel.has(normalizedLabel)) {
        const chunkIndex = Number(processedByLabel.get(normalizedLabel));
        if (chunkIndex > 0) failed.add(chunkIndex);
        return;
      }

      const byManifest = sourceManifest.find((entry) => {
        const normalizedEntry = normalizeSnippet(entry.sourceLocation);
        return normalizedEntry && (normalizedEntry.includes(normalizedLabel) || normalizedLabel.includes(normalizedEntry));
      });
      if (byManifest) failed.add(Number(byManifest.chunkIndex || 0));
    });

    const pages = Array.isArray(failedBatch.pages) ? failedBatch.pages : [];
    pages.forEach((page) => {
      sourceChunks
        .filter((chunk) => Number(chunk.page || 0) === Number(page))
        .forEach((chunk) => failed.add(Number(chunk.sourceChunkIndex || chunk.index || 0)));
    });
  });

  return new Set(Array.from(failed).filter((value) => Number.isFinite(value) && value > 0));
}

function detectSections(sourceChunks) {
  const detected = new Set();
  sourceChunks.forEach((chunk) => {
    const sample = `${chunk.label}\n${chunk.text.slice(0, 1200)}`.toLowerCase();
    if (/\b(vocabulary|key terms?|glossary)\b/.test(sample)) detected.add('vocabulary');
    if (hasDefinitionLikeText(sample)) detected.add('vocabulary');
    if (/\b(concepts?|big ideas?|essential ideas?)\b/.test(sample)) detected.add('concepts');
    if (/\b(formulas?|equations?|reference formulas?)\b/.test(sample) || hasEquationLikeText(sample)) detected.add('referenceFormulas');
    if (/\b(problem bank|practice problems?|questions?|exercises?)\b/.test(sample) || hasPracticeLikeText(sample)) detected.add('problemBank');
    if (/\b(standards?|learning standards?|objectives?)\b/.test(sample)) detected.add('standardsMap');
    if (/\b(smoke tests?|checks?|quick checks?)\b/.test(sample)) detected.add('smokeTests');
  });
  return Array.from(detected).sort();
}

function detectSourceSignals(sourceChunks) {
  const text = sourceChunks.map((chunk) => `${chunk.label}\n${chunk.text}`).join('\n\n');
  return {
    definitionLikeText: hasDefinitionLikeText(text),
    equationLikeText: hasEquationLikeText(text),
    practiceLikeText: hasPracticeLikeText(text)
  };
}

function buildCoverageWarnings(details) {
  const warnings = [];
  const totalItems = Object.values(details.itemCounts).reduce((sum, value) => sum + Number(value || 0), 0);
  const totalCharacters = String(details.extraction && details.extraction.text || '').length;
  const analyzedChunks = details.coverageSummary.totalChunks - details.coverageSummary.queuedChunks;
  const noKnowledgeChunks = details.chunksWithNoExtractedKnowledge.length;

  if ((analyzedChunks >= 4 || totalCharacters >= 2500) && totalItems <= Math.max(2, Math.floor(Math.max(analyzedChunks, 1) / 2))) {
    warnings.push('Draft appears incomplete for the amount of extracted text.');
  }

  if (analyzedChunks >= 3 && noKnowledgeChunks / Math.max(analyzedChunks, 1) >= 0.5) {
    warnings.push('Many chunks produced no items.');
  }

  if (details.itemCounts.vocabulary === 0 && (details.sectionsDetected.includes('vocabulary') || details.sourceSignals.definitionLikeText)) {
    warnings.push('No vocabulary was found even though the source appears to contain vocabulary sections.');
  }

  if (details.itemCounts.referenceFormulas === 0 && details.sourceSignals.equationLikeText) {
    warnings.push('Equation-like source text was found but no reference formulas were drafted.');
  }

  if (details.itemCounts.problemBank === 0 && details.sourceSignals.practiceLikeText) {
    warnings.push('Practice/example question text was found but no problem bank items were drafted.');
  } else if (details.sectionsDetected.includes('problemBank') && details.itemCounts.problemBank < 2) {
    warnings.push('Problem bank detected but few/no problems were drafted.');
  }

  if (details.queuedChunks.length > 0) {
    warnings.push('Some source chunks are still queued and were not drafted in this run.');
  }

  details.failedBatches.forEach((failedBatch) => {
    const labels = Array.isArray(failedBatch.chunkLabels) && failedBatch.chunkLabels.length
      ? ` (${failedBatch.chunkLabels.join(', ')})`
      : '';
    warnings.push(`Model draft failed for batch ${failedBatch.batchIndex}${labels}. Review draft was not completed for those source chunks/pages.`);
  });

  return warnings;
}

function hasDefinitionLikeText(value) {
  const text = String(value || '');
  return /\b[\p{L}][\p{L}\p{N} /-]{1,60}\s+(?:is|are|means|refers to|is defined as|are defined as)\s+[\p{L}\p{N}]/iu.test(text)
    || /\b(?:defined as|definition:|means:)\b/i.test(text);
}

function hasEquationLikeText(value) {
  const text = String(value || '');
  return /\b[A-Za-zµΩ][A-Za-z0-9µΩ_./^() -]{0,32}\s*(?:=|≈)\s*[^.\n;]{1,120}/u.test(text)
    || /\b\d?\s*[A-Za-zµΩ°%][A-Za-z0-9µΩ°%./^ -]{0,24}\s*(?:=|≈)\s*\d?\s*[A-Za-zµΩ°%]/u.test(text);
}

function hasPracticeLikeText(value) {
  const text = String(value || '');
  return /\b(?:practice|example|worked example|exercise|question|problems?)\b[^.\n]{0,120}\?/iu.test(text)
    || /\b(?:answer|solution|expected answer)\s*[:=]/iu.test(text)
    || /\b(?:practice problems?|example problems?|worked examples?|exercises?)\b/iu.test(text);
}

function normalizeFailedBatches(failedBatches) {
  if (!Array.isArray(failedBatches)) return [];
  return failedBatches.map((failedBatch) => ({
    batchIndex: Number(failedBatch && failedBatch.batchIndex || 0),
    retryIndex: failedBatch && failedBatch.retryIndex ? Number(failedBatch.retryIndex) : undefined,
    chunkLabels: Array.isArray(failedBatch && failedBatch.chunkLabels) ? failedBatch.chunkLabels.filter(Boolean).map(String) : [],
    pages: Array.isArray(failedBatch && failedBatch.pages) ? failedBatch.pages.map(Number).filter((page) => Number.isFinite(page) && page > 0) : [],
    characterCount: Number(failedBatch && failedBatch.characterCount || 0),
    errors: Array.isArray(failedBatch && failedBatch.errors) ? failedBatch.errors.map(String) : []
  })).filter((failedBatch) => failedBatch.batchIndex > 0);
}

function inferProcessedPages(processedChunks, sourceChunks, fallbackPageCount) {
  const pages = new Set();
  processedChunks.forEach((chunk) => {
    const numericPage = Number(chunk.page || 0);
    if (Number.isFinite(numericPage) && numericPage > 0) {
      pages.add(numericPage);
      return;
    }
    const bySource = sourceChunks.find((sourceChunk) => Number(sourceChunk.sourceChunkIndex || sourceChunk.index || 0) === Number(chunk.sourceChunkIndex || 0));
    const sourcePage = Number(bySource && bySource.page || 0);
    if (Number.isFinite(sourcePage) && sourcePage > 0) pages.add(sourcePage);
  });
  if (pages.size > 0) return pages.size;
  return Number(fallbackPageCount || 0);
}

function inferPagesWithDraftItems(manifestEntries, sourceChunks) {
  const pages = new Set();
  manifestEntries.forEach((entry) => {
    const chunkIndex = Number(entry && entry.chunkIndex || 0);
    const sourceChunk = sourceChunks.find((chunk) => Number(chunk.sourceChunkIndex || chunk.index || 0) === chunkIndex);
    const numericPage = Number(sourceChunk && sourceChunk.page || 0);
    if (Number.isFinite(numericPage) && numericPage > 0) pages.add(numericPage);
  });
  return pages.size;
}

function inferPageNumber(value, label) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const match = String(label || '').match(/\b(?:p\.?|page|slide|sheet)\s*(\d+)\b/i);
  return match ? Number(match[1]) : 0;
}

function inferChunkIndexFromLabel(label) {
  const chunkMatch = String(label || '').match(/\bchunk\s*(\d+)\b/i);
  if (chunkMatch) return Number(chunkMatch[1]);
  return 0;
}

function normalizeSnippet(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function firstNonEmptyString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) || '';
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

module.exports = {
  COUNTED_SECTIONS,
  buildImportCoverageReport,
  makeSourceChunks
};
