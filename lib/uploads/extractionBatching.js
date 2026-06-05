const { DEFAULT_BATCH_MAX_CHUNKS, DEFAULT_BATCH_MAX_CHARACTERS, DEFAULT_RETRY_BATCH_MAX_CHARACTERS } = require('./importConstants');
const { firstNonEmptyString, nonEmptyString } = require('./importTextUtils');
const { makeSourceTextSnippet } = require('./draftPackNormalizer');
const {
  positiveInteger,
  modelMaxCharacters,
  modelRetryMaxCharacters,
  previewMaxPages,
  previewMaxCharacters,
  fullImportRequiresConfirmation,
  importSafetyThresholds,
  estimatePageCount
} = require('./importSafety');

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


module.exports = {
  buildExtractionBatches,
  buildImportEstimate,
  makePreviewExtraction,
  makeFullTextBearingExtraction,
  makeUltraSafePreviewExtraction,
  makeImportScope,
  applyImportCompletionFromCoverage,
  summarizeBatchSource,
  isSelectedImportRequested,
  makeSelectedExtraction,
  normalizeSelectionRequest,
  makeRangeExtraction,
  makePreviewImportSelection,
  makeImportSelection,
  formatNumberRange,
  formatDisplayPageRange,
  makePromptChunks,
  makePromptSections,
  makePageSections,
  identifyTextBearingPages,
  splitTextByPageMarkers,
  makePromptChunk,
  splitLongText,
  makeBatchExtraction,
  buildRetryBatchesForBatch
};
