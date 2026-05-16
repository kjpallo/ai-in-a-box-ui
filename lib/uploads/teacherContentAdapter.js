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
    validationOptions: { standardsBank: options.standardsBank }
  });
}

function loadApproved(options) {
  return loadApprovedKnowledgePacks({
    approvedPacksDir: options.approvedPacksDir,
    validationOptions: { standardsBank: options.standardsBank }
  });
}

function makeDraftPackSummary(record) {
  const itemCounts = buildItemCounts(record.pack);
  const reviewCounts = buildReviewCounts(record.pack);

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
    sourcePath: record.sourcePath
  };
}

function makeApprovedPackSummary(record) {
  const packIndex = buildKnowledgePackIndex([record]);

  return {
    packId: record.packId,
    title: record.title,
    subject: record.subject,
    gradeLevel: record.gradeLevel,
    version: record.version,
    itemCounts: buildItemCounts(record.pack),
    sourcePath: record.sourcePath,
    indexedCounts: summarizeIndexCounts(packIndex),
    searchableCounts: summarizeIndexCounts(packIndex)
  };
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
