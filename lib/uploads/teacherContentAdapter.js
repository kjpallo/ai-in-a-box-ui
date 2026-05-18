const { buildKnowledgePackIndex } = require('../knowledge/buildKnowledgePackIndex');
const { mergeActivationIntoApprovedPackSummaries } = require('../knowledge/approvedPackActivationStore');
const { loadApprovedKnowledgePacks } = require('../knowledge/loadApprovedKnowledgePacks');
const { loadDraftKnowledgePacks } = require('../knowledge/loadDraftKnowledgePacks');
const { REVIEW_STATUSES } = require('../knowledge/packSchema');
const { buildImportPipelineReport, COUNTED_SECTIONS } = require('./buildImportPipelineReport');

const AVAILABLE_TABS = [
  'upload',
  'standards',
  'draftPack',
  'reviewDraft',
  'importReport',
  'approvedPacks'
];

function getTeacherContentDashboard(options = {}) {
  const draftResult = loadDrafts(options);
  const approvedResult = loadApproved(options);
  const draftSummaries = draftResult.packs.map(makeDraftPackSummary);

  return {
    draftPacks: draftResult.packs.length,
    approvedPacks: approvedResult.packs.length,
    invalidDraftPacks: draftResult.errors.length,
    invalidApprovedPacks: approvedResult.errors.length,
    totalPendingReviewItems: sumStatus(draftSummaries, 'pending'),
    totalApprovedReviewItems: sumStatus(draftSummaries, 'approved'),
    totalRejectedReviewItems: sumStatus(draftSummaries, 'rejected'),
    availableTabs: AVAILABLE_TABS.slice(),
    warnings: [
      ...collectWarnings(draftResult.packs),
      ...collectWarnings(approvedResult.packs),
      ...collectErrorWarnings(draftResult.errors),
      ...collectErrorWarnings(approvedResult.errors)
    ],
    errors: [
      ...prefixErrors('draft', draftResult.errors),
      ...prefixErrors('approved', approvedResult.errors)
    ]
  };
}

function listDraftPacksForReview(options = {}) {
  const draftResult = loadDrafts(options);

  return {
    draftPacks: draftResult.packs.map(makeDraftPackSummary),
    warnings: [
      ...collectWarnings(draftResult.packs),
      ...collectErrorWarnings(draftResult.errors)
    ],
    errors: prefixErrors('draft', draftResult.errors)
  };
}

function getDraftPackReport(packId, options = {}) {
  return buildImportPipelineReport({
    ...options,
    packId,
    draftPacksDir: options.draftPacksDir,
    approvedPacksDir: options.approvedPacksDir,
    standardsBank: options.standardsBank,
    standardsBankSummary: options.standardsBankSummary
  });
}

function listApprovedPacksSummary(options = {}) {
  const approvedResult = loadApproved(options);
  const index = buildKnowledgePackIndex(approvedResult.packs);
  const summaries = approvedResult.packs.map((record) => makeApprovedPackSummary(record));

  return {
    approvedPacks: mergeActivationIntoApprovedPackSummaries(summaries, options),
    indexedCounts: summarizeIndexCounts(index),
    searchableCounts: summarizeIndexCounts(index),
    warnings: [
      ...collectWarnings(approvedResult.packs),
      ...collectErrorWarnings(approvedResult.errors)
    ],
    errors: prefixErrors('approved', approvedResult.errors)
  };
}

function loadDrafts(options) {
  return loadDraftKnowledgePacks({
    draftPacksDir: options.draftPacksDir,
    includeExamples: options.includeExamples === true || options.includeFixtures === true,
    includeFixtures: options.includeFixtures === true,
    validationOptions: { standardsBank: options.standardsBank }
  });
}

function loadApproved(options) {
  return loadApprovedKnowledgePacks({
    approvedPacksDir: options.approvedPacksDir,
    includeExamples: options.includeExamples === true || options.includeFixtures === true,
    includeFixtures: options.includeFixtures === true,
    validationOptions: { standardsBank: options.standardsBank }
  });
}

function makeDraftPackSummary(record) {
  const itemCounts = buildItemCounts(record.pack);
  const reviewCounts = buildReviewCounts(record.pack);
  const importScope = summarizeImportScope(record.pack);

  return {
    packId: record.packId,
    title: record.title,
    subject: record.subject,
    gradeLevel: record.gradeLevel,
    version: record.version,
    itemCounts,
    reviewCounts,
    totalPending: reviewCounts.pending,
    totalApproved: reviewCounts.approved,
    totalRejected: reviewCounts.rejected,
    validationPassed: true,
    importScope,
    sampleOnly: importScope.sampleOnly === true,
    rangeLimited: importScope.rangeLimited === true,
    sourcePath: record.sourcePath
  };
}

function makeApprovedPackSummary(record) {
  const packIndex = buildKnowledgePackIndex([record]);
  const importScope = summarizeImportScope(record.pack);

  return {
    packId: record.packId,
    title: record.title,
    subject: record.subject,
    gradeLevel: record.gradeLevel,
    version: record.version,
    itemCounts: buildItemCounts(record.pack),
    sourceSummary: summarizePackSource(record.pack),
    importScope,
    sampleOnly: importScope.sampleOnly === true,
    rangeLimited: importScope.rangeLimited === true,
    status: 'Approved',
    validationStatus: 'Passed',
    sourcePath: record.sourcePath,
    indexedCounts: summarizeIndexCounts(packIndex),
    searchableCounts: summarizeIndexCounts(packIndex)
  };
}

function summarizePackSource(pack) {
  const sourceNames = Array.from(new Set(
    (Array.isArray(pack && pack.sourceFiles) ? pack.sourceFiles : [])
      .map((sourceFile) => sourceFile && sourceFile.fileName)
      .filter(Boolean)
  ));
  const importScope = summarizeImportScope(pack);
  const scopeRange = importScope.rangeLabel || (importScope.pageRangeLabel ? `Pages ${importScope.pageRangeLabel}` : '');
  const importSelection = pack && pack.metadata && pack.metadata.importSelection || {};
  const range = scopeRange || importSelection.label || importSelection.pageRangeLabel || importSelection.pageRange || '';
  if (sourceNames.length && range) return `${sourceNames.join(', ')} - ${range}`;
  if (sourceNames.length) return sourceNames.join(', ');
  return range || '';
}

function summarizeImportScope(pack) {
  const metadata = pack && pack.metadata && typeof pack.metadata === 'object' && !Array.isArray(pack.metadata)
    ? pack.metadata
    : {};
  const scope = metadata.importScope && typeof metadata.importScope === 'object' && !Array.isArray(metadata.importScope)
    ? metadata.importScope
    : {};
  const selection = metadata.importSelection && typeof metadata.importSelection === 'object' && !Array.isArray(metadata.importSelection)
    ? metadata.importSelection
    : {};
  const fallbackPageRange = scope.pageRangeLabel || selection.pageRangeLabel || formatNumberRange(selection.pages || []);
  const fallbackChunkRange = scope.chunkRangeLabel || selection.chunkRangeLabel || formatNumberRange(selection.chunks || []);
  const scopeName = scope.scope || (selection.kind === 'preview' ? 'preview_sample' : selection.kind ? 'selected_range' : 'full_document');
  const scopeLabel = scope.scopeLabel || (scopeName === 'preview_sample' ? 'Preview Sample' : scopeName === 'selected_range' ? 'Selected Range' : 'Full Import');
  const rangeLabel = scope.rangeLabel || (fallbackPageRange ? `Pages ${fallbackPageRange}` : fallbackChunkRange ? `Chunks ${fallbackChunkRange}` : '');
  return {
    scope: scopeName,
    scopeLabel,
    sampleOnly: scope.sampleOnly === true || scopeName === 'preview_sample',
    rangeLimited: scope.rangeLimited === true || scopeName !== 'full_document',
    completePacketImported: scope.completePacketImported === true || scopeName === 'full_document',
    pageRangeLabel: fallbackPageRange,
    chunkRangeLabel: fallbackChunkRange,
    rangeLabel,
    warning: scope.warning || (scopeName === 'preview_sample' && rangeLabel
      ? `This draft only covers ${rangeLabel}. Run Full Import to process the whole document.`
      : scopeName === 'selected_range' && rangeLabel
        ? `This draft covers only ${rangeLabel}. It does not mark the whole packet imported.`
        : '')
  };
}

function formatNumberRange(values) {
  const unique = Array.from(new Set((Array.isArray(values) ? values : []).map(Number).filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
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

function buildItemCounts(pack) {
  const counts = {};
  COUNTED_SECTIONS.forEach((sectionName) => {
    counts[sectionName] = Array.isArray(pack && pack[sectionName]) ? pack[sectionName].length : 0;
  });
  return counts;
}

function buildReviewCounts(pack) {
  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0
  };

  COUNTED_SECTIONS.forEach((sectionName) => {
    const items = Array.isArray(pack && pack[sectionName]) ? pack[sectionName] : [];
    items.forEach((item) => {
      if (item && REVIEW_STATUSES.includes(item.reviewStatus)) {
        counts[item.reviewStatus] += 1;
      }
    });
  });

  return counts;
}

function summarizeIndexCounts(index) {
  return {
    vocabularyTerms: Object.keys(index.vocabularyByTerm).length,
    vocabularyAliases: Object.keys(index.vocabularyByAlias).length,
    concepts: Object.keys(index.conceptsByTitle).length,
    conceptAliases: Object.keys(index.conceptsByAlias).length,
    problemQuestions: Object.keys(index.problemBankByQuestion).length,
    standards: Object.keys(index.standardsMapByStandardId).length
  };
}

function sumStatus(summaries, status) {
  return summaries.reduce((sum, summary) => sum + summary.reviewCounts[status], 0);
}

function collectWarnings(records) {
  return records.flatMap((record) => record.warnings || []);
}

function collectErrorWarnings(errorRecords) {
  return errorRecords.flatMap((record) => record.warnings || []);
}

function prefixErrors(kind, errorRecords) {
  return errorRecords.map((record) => ({
    kind,
    sourcePath: record.sourcePath,
    packId: record.packId,
    title: record.title,
    errors: record.errors || [],
    warnings: record.warnings || []
  }));
}

module.exports = {
  AVAILABLE_TABS,
  getDraftPackReport,
  getTeacherContentDashboard,
  listApprovedPacksSummary,
  listDraftPacksForReview
};
