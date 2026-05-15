const fs = require('node:fs');
const path = require('node:path');

const { buildKnowledgePackIndex } = require('../knowledge/buildKnowledgePackIndex');
const { loadApprovedKnowledgePacks } = require('../knowledge/loadApprovedKnowledgePacks');
const { DEFAULT_DRAFT_PACKS_DIR } = require('../knowledge/loadDraftKnowledgePacks');
const {
  PROMOTABLE_SECTIONS,
  resolveDraftPackPath,
  validatePromotionReadiness
} = require('../knowledge/promoteDraftKnowledgePack');
const { REVIEWABLE_SECTIONS, SAFE_EDIT_FIELDS } = require('../knowledge/reviewDraftKnowledgePack');
const { REVIEW_STATUSES } = require('../knowledge/packSchema');
const { validateKnowledgePack } = require('../knowledge/validateKnowledgePack');

const COUNTED_SECTIONS = [
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap',
  'smokeTests'
];

function buildImportPipelineReport(options = {}) {
  const extraction = loadExtraction(options);
  const draftResult = loadDraftPack(options);
  const pack = draftResult.pack;
  const validation = pack
    ? validateKnowledgePack(pack, { standardsBank: options.standardsBank })
    : { valid: false, errors: draftResult.errors, warnings: [] };
  const pendingReview = buildPendingReview(pack);
  const promotionReadiness = buildPromotionReadiness(pack, validation);
  const indexPreview = buildIndexPreview(pack, options);

  return {
    success: Boolean(pack),
    warnings: [
      ...draftResult.warnings,
      ...validation.warnings
    ],
    errors: draftResult.errors,
    sourceExtraction: buildSourceExtractionSummary(extraction),
    draftPack: buildDraftPackSummary(pack, validation),
    pendingReview,
    promotionReadiness,
    standardsSummary: buildStandardsSummary(pack, options.standardsBank),
    selectedStandardsBank: buildSelectedStandardsBankSummary(options.standardsBankSummary || options.standardsBank),
    indexPreview
  };
}

function loadExtraction(options) {
  if (options.extraction) return options.extraction;
  if (options.extractionResult) return options.extractionResult;
  if (!options.extractionJsonPath) return null;

  try {
    return JSON.parse(fs.readFileSync(path.resolve(options.extractionJsonPath), 'utf8'));
  } catch (error) {
    return {
      success: false,
      fileName: '',
      metadata: {},
      warnings: [],
      errors: [`Could not read or parse extraction JSON: ${error.message}`]
    };
  }
}

function loadDraftPack(options) {
  const warnings = [];
  const errors = [];

  if (options.pack) {
    return {
      pack: options.pack,
      draftPackPath: options.draftPackPath,
      warnings,
      errors
    };
  }

  const draftPackInput = options.draftPackInput || options.draftPackPath || options.packId;
  if (!draftPackInput || typeof draftPackInput !== 'string') {
    return {
      pack: null,
      draftPackPath: undefined,
      warnings,
      errors: ['A draft pack object, path, or packId is required.']
    };
  }

  const resolvedDraft = resolveDraftPackPath(
    draftPackInput,
    options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR
  );
  if (!resolvedDraft.success) {
    return {
      pack: null,
      draftPackPath: undefined,
      warnings,
      errors: resolvedDraft.errors
    };
  }

  try {
    return {
      pack: JSON.parse(fs.readFileSync(resolvedDraft.draftPackPath, 'utf8')),
      draftPackPath: resolvedDraft.draftPackPath,
      warnings,
      errors
    };
  } catch (error) {
    return {
      pack: null,
      draftPackPath: resolvedDraft.draftPackPath,
      warnings,
      errors: [`Could not read or parse draft knowledge pack: ${error.message}`]
    };
  }
}

function buildSourceExtractionSummary(extraction) {
  if (!extraction) {
    return {
      success: false,
      fileName: '',
      fileType: '',
      characterCount: 0,
      warnings: [],
      errors: []
    };
  }

  return {
    success: extraction.success === true,
    fileName: extraction.fileName || '',
    fileType: firstNonEmptyString(
      extraction.extension && String(extraction.extension).replace(/^\./, ''),
      extraction.metadata && extraction.metadata.detectedType,
      extraction.mimeGuess
    ),
    characterCount: Number(
      extraction.metadata && Number.isFinite(Number(extraction.metadata.characterCount))
        ? extraction.metadata.characterCount
        : String(extraction.text || '').length
    ),
    warnings: extraction.warnings || [],
    errors: extraction.errors || []
  };
}

function buildDraftPackSummary(pack, validation) {
  if (!pack) {
    return {
      packId: '',
      title: '',
      subject: '',
      gradeLevel: '',
      version: '',
      validationPassed: false,
      itemCounts: emptySectionCounts(),
      reviewCounts: emptyReviewCounts(),
      reviewCountsBySection: emptyReviewCountsBySection()
    };
  }

  const reviewCountsBySection = buildReviewCountsBySection(pack);

  return {
    packId: pack.packId || '',
    title: pack.title || '',
    subject: pack.subject || '',
    gradeLevel: pack.gradeLevel || '',
    version: pack.version || '',
    validationPassed: validation.valid === true,
    itemCounts: buildItemCounts(pack),
    reviewCounts: sumReviewCounts(reviewCountsBySection),
    reviewCountsBySection
  };
}

function buildPendingReview(pack) {
  const grouped = emptySectionGroups();
  if (!pack) {
    return {
      totalPending: 0,
      items: grouped
    };
  }

  REVIEWABLE_SECTIONS.forEach((sectionName) => {
    const items = Array.isArray(pack[sectionName]) ? pack[sectionName] : [];
    items.forEach((item, index) => {
      if (!item || item.reviewStatus !== 'pending') return;
      grouped[sectionName].push(makePendingItem(sectionName, index, item));
    });
  });

  return {
    totalPending: Object.values(grouped).reduce((sum, items) => sum + items.length, 0),
    items: grouped
  };
}

function buildPromotionReadiness(pack, validation) {
  if (!pack) {
    return {
      ready: false,
      blockedReasons: ['draft pack could not be loaded']
    };
  }

  const blockedReasons = [];
  if (!validation.valid) {
    blockedReasons.push('validation failed');
  }

  const pendingCount = countReviewStatus(pack, 'pending', PROMOTABLE_SECTIONS);
  if (pendingCount > 0) {
    blockedReasons.push('pending items remain');
  }

  const rejectedCount = countReviewStatus(pack, 'rejected', PROMOTABLE_SECTIONS);
  if (rejectedCount > 0) {
    blockedReasons.push('rejected items remain');
  }

  const formulaSolverProblems = findFormulaSolverProblems(pack);
  if (formulaSolverProblems.length > 0) {
    blockedReasons.push('formula solverStatus is not reference_only');
  }

  validatePromotionReadiness(pack).forEach((reason) => {
    if (!blockedReasons.includes(reason)) blockedReasons.push(reason);
  });

  return {
    ready: blockedReasons.length === 0,
    blockedReasons
  };
}

function buildStandardsSummary(pack, standardsBank) {
  const standardIds = collectStandardIds(pack);
  const knownStandardIds = buildKnownStandardIds(standardsBank);
  const standardsById = buildStandardsById(standardsBank);
  const standardsMapById = buildStandardsMapById(pack);
  const standardsMapIds = new Set(
    Array.isArray(pack && pack.standardsMap)
      ? pack.standardsMap.map((item) => item && item.standardId).filter(isNonEmptyString)
      : []
  );
  const missing = standardIds.filter((standardId) => !standardsMapIds.has(standardId));
  const unknown = knownStandardIds
    ? standardIds.filter((standardId) => !knownStandardIds.has(standardId))
    : [];

  return {
    standardsMapCount: Array.isArray(pack && pack.standardsMap) ? pack.standardsMap.length : 0,
    standardIds,
    missing,
    unknown,
    standardsBankLoaded: Boolean(knownStandardIds),
    standards: standardIds.map((standardId) => makeStandardSummaryItem(
      standardId,
      standardsMapById.get(standardId),
      standardsById.get(standardId)
    ))
  };
}

function buildSelectedStandardsBankSummary(standardsBank) {
  if (!standardsBank || !standardsBank.standardsBankId) return null;
  return {
    standardsBankId: standardsBank.standardsBankId || '',
    title: standardsBank.title || '',
    subject: standardsBank.subject || '',
    gradeLevel: standardsBank.gradeLevel || '',
    jurisdiction: standardsBank.jurisdiction || '',
    version: standardsBank.version || '',
    standardsCount: Array.isArray(standardsBank.standards)
      ? standardsBank.standards.length
      : Number(standardsBank.standardsCount || 0),
    validationPassed: standardsBank.validationPassed === false ? false : true,
    warnings: Array.isArray(standardsBank.warnings) ? standardsBank.warnings : [],
    errors: Array.isArray(standardsBank.errors) ? standardsBank.errors : []
  };
}

function buildIndexPreview(pack, options) {
  if (options.index) return summarizeIndex(options.index);

  const approvedRecord = loadApprovedRecordForPack(pack, options);
  if (approvedRecord) {
    return summarizeIndex(buildKnowledgePackIndex([approvedRecord]));
  }

  if (pack) {
    return summarizeIndex(buildKnowledgePackIndex([{
      pack,
      packId: pack.packId,
      title: pack.title
    }]));
  }

  return summarizeIndex(buildKnowledgePackIndex([]));
}

function loadApprovedRecordForPack(pack, options) {
  if (options.approvedPack) {
    return {
      pack: options.approvedPack,
      packId: options.approvedPack.packId,
      title: options.approvedPack.title
    };
  }

  if (!options.approvedPacksDir || !pack || !pack.packId) return null;

  const loadResult = loadApprovedKnowledgePacks({
    approvedPacksDir: options.approvedPacksDir,
    validationOptions: { standardsBank: options.standardsBank }
  });

  return loadResult.packs.find((record) => record.packId === pack.packId) || null;
}

function summarizeIndex(index) {
  return {
    vocabularyKeys: Object.keys(index.vocabularyByTerm).sort(),
    conceptKeys: Object.keys(index.conceptsByTitle).sort(),
    problemQuestionKeys: Object.keys(index.problemBankByQuestion).sort(),
    standardIds: Object.keys(index.standardsMapByStandardId).sort()
  };
}

function buildItemCounts(pack) {
  const counts = {};
  COUNTED_SECTIONS.forEach((sectionName) => {
    counts[sectionName] = Array.isArray(pack[sectionName]) ? pack[sectionName].length : 0;
  });
  return counts;
}

function buildReviewCountsBySection(pack) {
  const counts = emptyReviewCountsBySection();
  COUNTED_SECTIONS.forEach((sectionName) => {
    const items = Array.isArray(pack[sectionName]) ? pack[sectionName] : [];
    items.forEach((item) => {
      if (!item || !REVIEW_STATUSES.includes(item.reviewStatus)) return;
      counts[sectionName][item.reviewStatus] += 1;
    });
  });
  return counts;
}

function sumReviewCounts(countsBySection) {
  const totals = emptyReviewCounts();
  Object.values(countsBySection).forEach((counts) => {
    REVIEW_STATUSES.forEach((status) => {
      totals[status] += counts[status];
    });
  });
  return totals;
}

function countReviewStatus(pack, reviewStatus, sections) {
  return sections.reduce((sum, sectionName) => {
    const items = Array.isArray(pack[sectionName]) ? pack[sectionName] : [];
    return sum + items.filter((item) => item && item.reviewStatus === reviewStatus).length;
  }, 0);
}

function findFormulaSolverProblems(pack) {
  const formulas = Array.isArray(pack.referenceFormulas) ? pack.referenceFormulas : [];
  return formulas.filter((item) => item && item.solverStatus !== 'reference_only');
}

function makePendingItem(sectionName, index, item) {
  return {
    section: sectionName,
    index,
    label: makeItemLabel(sectionName, item),
    reviewStatus: item.reviewStatus || '',
    confidence: item.confidence || '',
    sourceFile: item.sourceFile || '',
    sourceLocation: item.sourceLocation || '',
    sourceTextSnippet: item.sourceTextSnippet || '',
    editableFields: makeEditableFieldValues(sectionName, item)
  };
}

function makeEditableFieldValues(sectionName, item) {
  const allowedFields = SAFE_EDIT_FIELDS[sectionName];
  if (!allowedFields || !item || typeof item !== 'object') return {};

  const values = {};
  allowedFields.forEach((fieldName) => {
    values[fieldName] = item[fieldName];
  });
  return values;
}

function makeItemLabel(sectionName, item) {
  if (!item || typeof item !== 'object') return `${sectionName}[unknown]`;
  return firstNonEmptyString(
    item.term,
    item.title,
    item.question,
    item.equation,
    item.standardId,
    item.conceptId,
    item.formulaId,
    item.problemId,
    `${sectionName} item`
  );
}

function collectStandardIds(pack) {
  const standardIds = [];
  if (!pack) return standardIds;

  ['vocabulary', 'concepts', 'problemBank'].forEach((sectionName) => {
    const items = Array.isArray(pack[sectionName]) ? pack[sectionName] : [];
    items.forEach((item) => {
      if (!item || !Array.isArray(item.standards)) return;
      item.standards.forEach((standardId) => {
        if (isNonEmptyString(standardId) && !standardIds.includes(standardId)) {
          standardIds.push(standardId);
        }
      });
    });
  });

  if (Array.isArray(pack.standardsMap)) {
    pack.standardsMap.forEach((item) => {
      if (item && isNonEmptyString(item.standardId) && !standardIds.includes(item.standardId)) {
        standardIds.push(item.standardId);
      }
    });
  }

  return standardIds.sort();
}

function buildKnownStandardIds(standardsBank) {
  if (!standardsBank) return null;
  if (standardsBank instanceof Set) return standardsBank;
  if (Array.isArray(standardsBank)) return new Set(standardsBank.filter(isNonEmptyString));
  if (Array.isArray(standardsBank.standards)) {
    return new Set(
      standardsBank.standards
        .map((standard) => standard && standard.standardId)
        .filter(isNonEmptyString)
    );
  }
  return new Set();
}

function buildStandardsById(standardsBank) {
  const standardsById = new Map();
  if (!standardsBank || !Array.isArray(standardsBank.standards)) return standardsById;

  standardsBank.standards.forEach((standard) => {
    if (standard && isNonEmptyString(standard.standardId)) {
      standardsById.set(standard.standardId, standard);
    }
  });

  return standardsById;
}

function buildStandardsMapById(pack) {
  const standardsMapById = new Map();
  if (!Array.isArray(pack && pack.standardsMap)) return standardsMapById;

  pack.standardsMap.forEach((item) => {
    if (item && isNonEmptyString(item.standardId) && !standardsMapById.has(item.standardId)) {
      standardsMapById.set(item.standardId, item);
    }
  });

  return standardsMapById;
}

function makeStandardSummaryItem(standardId, mapItem, bankStandard) {
  return {
    standardId,
    code: firstNonEmptyString(bankStandard && bankStandard.code),
    title: firstNonEmptyString(mapItem && mapItem.title, bankStandard && bankStandard.title, bankStandard && bankStandard.code),
    description: firstNonEmptyString(
      mapItem && mapItem.description,
      bankStandard && bankStandard.studentFriendlyText,
      bankStandard && bankStandard.officialText
    ),
    officialText: firstNonEmptyString(bankStandard && bankStandard.officialText),
    studentFriendlyText: firstNonEmptyString(bankStandard && bankStandard.studentFriendlyText),
    strand: firstNonEmptyString(bankStandard && bankStandard.strand),
    topic: firstNonEmptyString(bankStandard && bankStandard.topic),
    keywords: Array.isArray(bankStandard && bankStandard.keywords) ? bankStandard.keywords.filter(isNonEmptyString) : [],
    bankMatch: Boolean(bankStandard),
    confidence: firstNonEmptyString(mapItem && mapItem.confidence, bankStandard && bankStandard.confidence),
    relatedVocabulary: Array.isArray(mapItem && mapItem.relatedVocabulary) ? mapItem.relatedVocabulary : [],
    relatedConcepts: Array.isArray(mapItem && mapItem.relatedConcepts) ? mapItem.relatedConcepts : [],
    reviewStatus: firstNonEmptyString(mapItem && mapItem.reviewStatus, bankStandard && bankStandard.reviewStatus),
    sourceFile: firstNonEmptyString(mapItem && mapItem.sourceFile, bankStandard && bankStandard.sourceFile),
    sourceLocation: firstNonEmptyString(mapItem && mapItem.sourceLocation, bankStandard && bankStandard.sourceLocation)
  };
}

function emptySectionCounts() {
  const counts = {};
  COUNTED_SECTIONS.forEach((sectionName) => {
    counts[sectionName] = 0;
  });
  return counts;
}

function emptyReviewCountsBySection() {
  const counts = {};
  COUNTED_SECTIONS.forEach((sectionName) => {
    counts[sectionName] = emptyReviewCounts();
  });
  return counts;
}

function emptyReviewCounts() {
  return {
    pending: 0,
    approved: 0,
    rejected: 0
  };
}

function emptySectionGroups() {
  const groups = {};
  REVIEWABLE_SECTIONS.forEach((sectionName) => {
    groups[sectionName] = [];
  });
  return groups;
}

function firstNonEmptyString(...values) {
  const match = values.find(isNonEmptyString);
  return match || '';
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = {
  COUNTED_SECTIONS,
  buildImportPipelineReport
};
