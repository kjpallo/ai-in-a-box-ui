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
  const sourceChunks = normalizeSourceChunks(options.sourceChunks, extraction);
  const processedChunks = normalizeProcessedChunks(options.processedChunks, sourceChunks);
  const failedBatches = normalizeFailedBatches(options.failedBatches || pack && pack.metadata && pack.metadata.importCoverage && pack.metadata.importCoverage.failedBatches);
  const itemCounts = buildItemCounts(pack);
  const chunkItemCounts = buildChunkItemCounts(sourceChunks, pack);
  const chunksWithDraftItems = sourceChunks.filter((chunk) => chunkItemCounts[chunk.id] > 0);
  const chunksWithNoExtractedKnowledge = sourceChunks.filter((chunk) => {
    if (processedChunks.length && !processedChunks.some((processed) => processed.id === chunk.id)) return false;
    return chunkItemCounts[chunk.id] === 0;
  });
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
    failedBatches
  });

  return {
    totalPages,
    totalChunks: sourceChunks.length,
    processedPages: processedChunks.length ? totalPages : 0,
    processedChunks: processedChunks.length,
    pagesWithDraftItems: inferPagesWithDraftItems(chunksWithDraftItems),
    chunksWithDraftItems: chunksWithDraftItems.length,
    chunksWithNoExtractedKnowledge: chunksWithNoExtractedKnowledge.length,
    noKnowledgeChunks: chunksWithNoExtractedKnowledge.map((chunk) => chunk.label),
    sectionsDetected,
    sourceSignals,
    itemCounts,
    failedBatches,
    warnings
  };
}

function normalizeStoredCoverageReport(stored, pack) {
  const itemCounts = {
    ...buildItemCounts(pack),
    ...(stored && stored.itemCounts || {})
  };
  return {
    totalPages: Number(stored.totalPages || 0),
    totalChunks: Number(stored.totalChunks || 0),
    processedPages: Number(stored.processedPages || 0),
    processedChunks: Number(stored.processedChunks || 0),
    pagesWithDraftItems: Number(stored.pagesWithDraftItems || 0),
    chunksWithDraftItems: Number(stored.chunksWithDraftItems || 0),
    chunksWithNoExtractedKnowledge: Number(stored.chunksWithNoExtractedKnowledge || 0),
    noKnowledgeChunks: Array.isArray(stored.noKnowledgeChunks) ? stored.noKnowledgeChunks : [],
    sectionsDetected: Array.isArray(stored.sectionsDetected) ? stored.sectionsDetected : [],
    sourceSignals: stored && stored.sourceSignals && typeof stored.sourceSignals === 'object' && !Array.isArray(stored.sourceSignals)
      ? stored.sourceSignals
      : {},
    itemCounts,
    failedBatches: Array.isArray(stored.failedBatches) ? stored.failedBatches : [],
    warnings: Array.isArray(stored.warnings) ? stored.warnings : []
  };
}

function normalizeSourceChunks(sourceChunks, extraction) {
  if (Array.isArray(sourceChunks) && sourceChunks.length > 0) {
    return sourceChunks.map((chunk, index) => ({
      id: chunk.id || `chunk-${chunk.index || index + 1}`,
      index: Number(chunk.index || index + 1),
      label: chunk.label || chunk.sourceLocation || `Chunk ${index + 1}`,
      page: inferPageNumber(chunk.pageNumber || chunk.page, chunk.label || chunk.sourceLocation),
      text: String(chunk.text || ''),
      characterCount: String(chunk.text || '').length,
      sourceFile: firstNonEmptyString(
        chunk.sourceFile,
        extraction && extraction.upload && extraction.upload.originalFileName,
        extraction && extraction.fileName
      )
    }));
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

function normalizeProcessedChunks(processedChunks, sourceChunks) {
  if (Array.isArray(processedChunks) && processedChunks.length > 0) {
    return processedChunks.map((chunk, index) => ({
      id: chunk.id || `chunk-${chunk.index || index + 1}`,
      label: chunk.label || `Chunk ${chunk.index || index + 1}`,
      page: inferPageNumber(chunk.page, chunk.label)
    }));
  }
  return sourceChunks.slice();
}

function buildItemCounts(pack) {
  const counts = {};
  COUNTED_SECTIONS.forEach((sectionName) => {
    counts[sectionName] = Array.isArray(pack && pack[sectionName]) ? pack[sectionName].length : 0;
  });
  return counts;
}

function buildChunkItemCounts(sourceChunks, pack) {
  const counts = {};
  sourceChunks.forEach((chunk) => {
    counts[chunk.id] = 0;
  });

  SOURCE_TRACKED_SECTIONS.forEach((sectionName) => {
    const items = Array.isArray(pack && pack[sectionName]) ? pack[sectionName] : [];
    items.forEach((item) => {
      const matchedChunk = findItemChunk(item, sourceChunks);
      if (matchedChunk) counts[matchedChunk.id] += 1;
    });
  });

  return counts;
}

function findItemChunk(item, sourceChunks) {
  if (!item || typeof item !== 'object') return null;
  if (sourceChunks.length === 1) return sourceChunks[0];

  const sourceLocation = String(item.sourceLocation || '').toLowerCase();
  if (sourceLocation) {
    const byLocation = sourceChunks.find((chunk) => {
      return sourceLocation.includes(String(chunk.label || '').toLowerCase())
        || String(chunk.label || '').toLowerCase().includes(sourceLocation);
    });
    if (byLocation) return byLocation;
  }

  const snippet = normalizeSnippet(item.sourceTextSnippet || item.sourceSnippet);
  if (snippet) {
    return sourceChunks.find((chunk) => normalizeSnippet(chunk.text).includes(snippet)) || null;
  }

  return null;
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
  const totalChunks = details.sourceChunks.length;
  const noKnowledgeChunks = details.chunksWithNoExtractedKnowledge.length;

  if ((totalChunks >= 4 || totalCharacters >= 2500) && totalItems <= Math.max(2, Math.floor(totalChunks / 2))) {
    warnings.push('Draft appears incomplete for the amount of extracted text.');
  }

  if (totalChunks >= 3 && noKnowledgeChunks / totalChunks >= 0.5) {
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

function inferPagesWithDraftItems(chunks) {
  const pages = Array.from(new Set(
    chunks.map((chunk) => chunk.page).filter((page) => Number.isFinite(page) && page > 0)
  ));
  return pages.length;
}

function inferPageNumber(value, label) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const match = String(label || '').match(/\b(?:p\.?|page)\s*(\d+)\b/i);
  return match ? Number(match[1]) : 0;
}

function normalizeSnippet(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function firstNonEmptyString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) || '';
}

module.exports = {
  COUNTED_SECTIONS,
  buildImportCoverageReport,
  makeSourceChunks
};
