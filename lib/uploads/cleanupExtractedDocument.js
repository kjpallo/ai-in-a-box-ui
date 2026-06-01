const path = require('node:path');

const DEFAULT_MIN_REPEATED_BOUNDARY_OCCURRENCES = 3;
const MIN_HEADING_SECTIONS = 2;

function cleanupExtractedDocument(extracted = {}, options = {}) {
  const fileName = firstNonEmptyString(
    options.fileName,
    extracted.upload && extracted.upload.originalFileName,
    extracted.fileName
  );
  const fileType = String(options.fileType || extracted.type || '').toLowerCase();
  const sourceFile = firstNonEmptyString(fileName, extracted.fileName);
  const warnings = [];

  const normalizedSections = normalizeSections(extracted, sourceFile);
  const usesStructuredPages = normalizedSections.some((section) => Number(section.pageNumber || 0) > 0 || /^(?:page|slide)\s+\d+/i.test(String(section.label || '')));
  const prechunkedSections = usesStructuredPages
    ? normalizedSections
    : rechunkSections(normalizedSections, { sourceFile });
  const repeatedBoundaryLines = shouldDetectRepeatedBoundaryLines(fileType)
    ? detectRepeatedBoundaryLines(prechunkedSections)
    : new Set();
  const fileTitleKeys = buildFileTitleKeys(fileName);

  const cleanedSections = prechunkedSections.map((section) => {
    const cleanedText = cleanupSectionText(section.text, {
      section,
      totalSections: prechunkedSections.length,
      repeatedBoundaryLines,
      fileTitleKeys
    });
    return {
      ...section,
      text: cleanedText
    };
  });

  const structuredSections = usesStructuredPages
    ? cleanedSections
    : cleanedSections.filter((section) => section.text.trim().length > 0);

  const finalizedSections = structuredSections.map((section, index) => ({
    ...section,
    sourceFile: firstNonEmptyString(section.sourceFile, sourceFile),
    chunkIndex: index + 1,
    sourceChunkIndex: index + 1
  }));

  const pageMap = new Map(
    finalizedSections
      .filter((section) => Number(section.pageNumber || 0) > 0)
      .map((section) => [Number(section.pageNumber), section])
  );

  const pages = normalizePages(extracted, sourceFile).map((page, index) => {
    const matched = pageMap.get(Number(page.pageNumber || 0));
    return {
      ...page,
      text: matched ? matched.text : cleanupSectionText(page.text, {
        section: page,
        totalSections: pagesLength(extracted),
        repeatedBoundaryLines,
        fileTitleKeys
      }),
      chunkIndex: matched ? matched.chunkIndex : index + 1,
      sourceChunkIndex: matched ? matched.sourceChunkIndex : index + 1
    };
  });

  const text = finalizedSections
    .map((section) => String(section.text || '').trim())
    .filter(Boolean)
    .join('\n\n');

  if (text.length === 0 && String(extracted.text || '').trim().length > 0) {
    warnings.push('Extraction cleanup removed most text; review source formatting if output looks incomplete.');
  }

  return {
    text,
    sections: finalizedSections,
    pages,
    warnings,
    metadata: {
      cleanup: {
        fileType,
        structuredSections: usesStructuredPages,
        sectionCount: finalizedSections.length,
        pageCount: pages.length
      }
    }
  };
}

function pagesLength(extracted = {}) {
  if (Array.isArray(extracted.pages)) return extracted.pages.length;
  if (Array.isArray(extracted.metadata && extracted.metadata.pages)) return extracted.metadata.pages.length;
  return 0;
}

function shouldDetectRepeatedBoundaryLines(fileType) {
  return !['csv', 'json', 'xlsx'].includes(String(fileType || '').toLowerCase());
}

function normalizeSections(extracted = {}, sourceFile = '') {
  if (Array.isArray(extracted.sections) && extracted.sections.length > 0) {
    return extracted.sections.map((section, index) => normalizeSection(section, index, sourceFile));
  }
  if (Array.isArray(extracted.pages) && extracted.pages.length > 0) {
    return extracted.pages.map((page, index) => normalizeSection(page, index, sourceFile));
  }
  return [normalizeSection({
    label: 'Full Text',
    sourceLocation: 'Full Text',
    text: extracted.text || ''
  }, 0, sourceFile)];
}

function normalizePages(extracted = {}, sourceFile = '') {
  const pages = Array.isArray(extracted.pages)
    ? extracted.pages
    : Array.isArray(extracted.metadata && extracted.metadata.pages)
      ? extracted.metadata.pages
      : [];
  return pages.map((page, index) => normalizeSection(page, index, sourceFile));
}

function normalizeSection(section, index, sourceFile) {
  const pageNumber = positiveInteger(
    section && (section.pageNumber || section.page || section.num || section.number),
    0
  );
  const label = firstNonEmptyString(
    section && section.label,
    section && section.sourceLocation,
    pageNumber ? `Page ${pageNumber}` : `Chunk ${index + 1}`
  );
  return {
    label,
    sourceLocation: firstNonEmptyString(section && section.sourceLocation, label),
    pageNumber,
    sourceFile: firstNonEmptyString(section && section.sourceFile, sourceFile),
    text: String(section && (section.text || section.content) || '')
  };
}

function detectRepeatedBoundaryLines(sections = []) {
  if (!Array.isArray(sections) || sections.length < DEFAULT_MIN_REPEATED_BOUNDARY_OCCURRENCES) {
    return new Set();
  }
  const counts = new Map();
  sections.forEach((section) => {
    const lines = splitMeaningfulLines(section.text);
    if (!lines.length) return;
    const boundaryLines = [
      ...lines.slice(0, 3),
      ...lines.slice(Math.max(3, lines.length - 2))
    ];
    const seenInSection = new Set();
    boundaryLines.forEach((line) => {
      const key = normalizeLineKey(line);
      if (!isBoundaryCandidateLine(line, key)) return;
      seenInSection.add(key);
    });
    seenInSection.forEach((key) => {
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  const repeated = new Set();
  counts.forEach((count, key) => {
    if (count >= DEFAULT_MIN_REPEATED_BOUNDARY_OCCURRENCES) {
      repeated.add(key);
    }
  });
  return repeated;
}

function isBoundaryCandidateLine(line, key) {
  if (!key) return false;
  const value = String(line || '').trim();
  if (!value) return false;
  if (value.length < 3 || value.length > 80) return false;
  if (looksStandalonePageNumber(value) || looksStandalonePageLabel(value)) return true;
  if (/[.!?]$/.test(value) && value.split(/\s+/).length > 6) return false;
  return true;
}

function cleanupSectionText(text, context = {}) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const kept = [];

  lines.forEach((rawLine) => {
    const line = String(rawLine || '').replace(/\s+/g, ' ').trim();
    if (!line) return;
    if (shouldDropLine(line, context)) return;
    kept.push(line);
  });

  const deduped = [];
  kept.forEach((line) => {
    if (!deduped.length) {
      deduped.push(line);
      return;
    }
    const previousKey = normalizeLineKey(deduped[deduped.length - 1]);
    const currentKey = normalizeLineKey(line);
    if (currentKey && currentKey === previousKey) return;
    deduped.push(line);
  });

  return deduped.join('\n').trim();
}

function shouldDropLine(line, context = {}) {
  const key = normalizeLineKey(line);
  if (!key) return true;
  if (looksStandalonePageLabel(line) || looksStandalonePageNumber(line)) return true;
  if (isSectionLabelRepeat(line, context.section)) return true;
  if (context.fileTitleKeys && context.fileTitleKeys.has(key) && Number(context.totalSections || 0) > 1) return true;
  if (context.repeatedBoundaryLines && context.repeatedBoundaryLines.has(key)) return true;
  if (looksShortOrphanFragment(line)) return true;
  return false;
}

function isSectionLabelRepeat(line, section = {}) {
  const lineKey = normalizeLineKey(line);
  const labelKey = normalizeLineKey(section && section.label);
  const locationKey = normalizeLineKey(section && section.sourceLocation);
  if (!lineKey) return false;
  if (labelKey && lineKey === labelKey) return true;
  if (locationKey && lineKey === locationKey) return true;
  return false;
}

function looksStandalonePageLabel(line) {
  return /^(?:page|pg\.?|p\.|slide)\s*#?\s*(?:\d{1,4}|[ivxlcdm]{1,8})$/i.test(String(line || '').trim());
}

function looksStandalonePageNumber(line) {
  return /^\d{1,4}$/.test(String(line || '').trim());
}

function looksShortOrphanFragment(line) {
  const value = String(line || '').trim();
  if (!value) return true;
  if (/^[\W_]+$/.test(value)) return true;
  if (value.length <= 2 && !/[A-Za-z]/.test(value)) return true;
  return false;
}

function rechunkSections(sections = [], options = {}) {
  if (!Array.isArray(sections) || sections.length !== 1) return sections;
  const only = sections[0];
  const text = String(only.text || '').trim();
  if (!text) return sections;

  const pageSections = splitSingleSectionByPageMarkers(text, options.sourceFile);
  if (pageSections.length >= MIN_HEADING_SECTIONS) return pageSections;

  const headingSections = splitSingleSectionByHeadings(text, options.sourceFile);
  if (headingSections.length >= MIN_HEADING_SECTIONS) return headingSections;

  return sections;
}

function splitSingleSectionByPageMarkers(text, sourceFile) {
  const lines = String(text || '').split('\n');
  const markers = [];
  lines.forEach((line, index) => {
    const match = String(line || '').trim().match(/^(?:page|pg\.?|p\.|slide)\s*#?\s*(\d{1,4})$/i);
    if (!match) return;
    markers.push({ index, pageNumber: Number(match[1]) });
  });
  if (markers.length < 2) return [];

  const sections = [];
  markers.forEach((marker, markerIndex) => {
    const next = markers[markerIndex + 1];
    const start = marker.index + 1;
    const end = next ? next.index : lines.length;
    const block = lines.slice(start, end).join('\n').trim();
    if (!block) return;
    sections.push({
      label: `Page ${marker.pageNumber}`,
      sourceLocation: `Page ${marker.pageNumber}`,
      pageNumber: marker.pageNumber,
      sourceFile: sourceFile || '',
      text: block
    });
  });
  return sections;
}

function splitSingleSectionByHeadings(text, sourceFile) {
  const lines = String(text || '').split('\n');
  const headingIndexes = [];
  lines.forEach((line, index) => {
    if (isLikelyHeading(line)) headingIndexes.push(index);
  });
  if (headingIndexes.length < MIN_HEADING_SECTIONS) return [];

  const sections = [];
  headingIndexes.forEach((headingIndex, index) => {
    const next = headingIndexes[index + 1];
    const heading = cleanHeadingLabel(lines[headingIndex]);
    const start = headingIndex + 1;
    const end = next || lines.length;
    const body = lines.slice(start, end).join('\n').trim();
    if (!body) return;
    sections.push({
      label: heading,
      sourceLocation: heading,
      pageNumber: 0,
      sourceFile: sourceFile || '',
      text: body
    });
  });
  return sections;
}

function isLikelyHeading(line) {
  const value = String(line || '').replace(/\s+/g, ' ').trim();
  if (!value) return false;
  if (value.length < 3 || value.length > 120) return false;
  const wordCount = value.split(/\s+/).length;
  if (wordCount > 14) return false;
  if (/^[A-Z0-9][A-Z0-9\s&/,'()\-]{2,}$/.test(value) && /[A-Z]/.test(value)) return true;
  if (/^(?:lesson|unit|chapter|section|worksheet|part|topic|objective|warm[- ]?up|do now|exit ticket|practice|review|lab|activity)\b/i.test(value)) return true;
  if (/^\d+(?:\.\d+){0,2}\s+[A-Za-z]/.test(value)) return true;
  if (/^[A-Za-z][A-Za-z0-9\s&/,'()\-]{2,80}:$/.test(value)) return true;
  return false;
}

function cleanHeadingLabel(line) {
  return String(line || '').replace(/\s+/g, ' ').replace(/:\s*$/, '').trim();
}

function buildFileTitleKeys(fileName) {
  const value = String(fileName || '').trim();
  if (!value) return new Set();
  const noExtension = value.replace(/\.[a-z0-9]{1,8}$/i, '');
  const normalized = noExtension.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const keys = [noExtension, normalized, path.basename(noExtension), path.basename(normalized)]
    .map((entry) => normalizeLineKey(entry))
    .filter(Boolean);
  return new Set(keys);
}

function splitMeaningfulLines(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeLineKey(line) {
  return String(line || '')
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function firstNonEmptyString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) || '';
}

module.exports = {
  cleanupExtractedDocument
};
