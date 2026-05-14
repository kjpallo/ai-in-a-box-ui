const fs = require('node:fs');
const path = require('node:path');

const { DEFAULT_DRAFT_PACKS_DIR } = require('./loadDraftKnowledgePacks');
const { resolveDraftPackPath } = require('./promoteDraftKnowledgePack');
const { REVIEW_STATUSES, SOURCE_TRACKING_FIELDS } = require('./packSchema');
const { validateKnowledgePack } = require('./validateKnowledgePack');

const REVIEWABLE_SECTIONS = [
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap',
  'smokeTests'
];

const SAFE_EDIT_FIELDS = {
  vocabulary: new Set(['studentDefinition', 'teacherDefinition', 'misconception']),
  concepts: new Set(['studentExplanation', 'keyIdeas']),
  referenceFormulas: new Set(['equation']),
  problemBank: new Set(['expectedAnswer']),
  standardsMap: new Set(['standardId']),
  smokeTests: new Set(['expectedAnswer'])
};

function loadDraftKnowledgePackForReview(draftPackInput, options = {}) {
  const draftPacksDir = options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR;
  const warnings = [];

  if (!draftPackInput || typeof draftPackInput !== 'string') {
    return blocked({ errors: ['A draft pack path or packId is required.'], warnings });
  }

  const resolvedDraft = resolveDraftPackPath(draftPackInput, draftPacksDir);
  if (!resolvedDraft.success) {
    return blocked({ errors: resolvedDraft.errors, warnings });
  }

  const draftPackPath = resolvedDraft.draftPackPath;
  const readResult = readJsonFile(draftPackPath);
  if (!readResult.success) {
    return blocked({ draftPackPath, errors: readResult.errors, warnings });
  }

  const validation = validateKnowledgePack(readResult.value, options.validationOptions || {});
  warnings.push(...validation.warnings);
  if (!validation.valid) {
    return blocked({
      draftPackPath,
      packId: readResult.value && readResult.value.packId,
      errors: validation.errors,
      warnings,
      validationPassed: false
    });
  }

  return {
    success: true,
    draftPackPath,
    packId: readResult.value.packId,
    pack: readResult.value,
    warnings,
    errors: [],
    validationPassed: true
  };
}

function listReviewableDraftItems(draftPackInput, options = {}) {
  const loadResult = loadDraftKnowledgePackForReview(draftPackInput, options);
  if (!loadResult.success) return loadResult;

  const statusFilter = options.status;
  if (statusFilter && !REVIEW_STATUSES.includes(statusFilter)) {
    return blocked({
      draftPackPath: loadResult.draftPackPath,
      packId: loadResult.packId,
      warnings: loadResult.warnings,
      errors: [`reviewStatus must be one of: ${REVIEW_STATUSES.join(', ')}`]
    });
  }

  const items = [];
  REVIEWABLE_SECTIONS.forEach((sectionName) => {
    const sectionItems = loadResult.pack[sectionName];
    if (!Array.isArray(sectionItems)) return;

    sectionItems.forEach((item, index) => {
      if (statusFilter && item.reviewStatus !== statusFilter) return;
      items.push(makeReviewItem(sectionName, index, item));
    });
  });

  return {
    success: true,
    draftPackPath: loadResult.draftPackPath,
    packId: loadResult.packId,
    items,
    warnings: loadResult.warnings,
    errors: []
  };
}

function updateDraftItemReviewStatus(draftPackInput, sectionName, index, reviewStatus, options = {}) {
  const prepared = prepareDraftItemChange(draftPackInput, sectionName, index, options);
  if (!prepared.success) return prepared;

  if (!REVIEW_STATUSES.includes(reviewStatus)) {
    return blocked({
      draftPackPath: prepared.draftPackPath,
      packId: prepared.packId,
      warnings: prepared.warnings,
      errors: [`reviewStatus must be one of: ${REVIEW_STATUSES.join(', ')}`]
    });
  }

  const before = prepared.item.reviewStatus;
  prepared.item.reviewStatus = reviewStatus;

  return saveReviewedDraftPack(prepared, {
    action: 'updateStatus',
    section: sectionName,
    index,
    before,
    after: reviewStatus,
    changedField: 'reviewStatus'
  });
}

function editDraftItemField(draftPackInput, sectionName, index, fieldName, value, options = {}) {
  const prepared = prepareDraftItemChange(draftPackInput, sectionName, index, options);
  if (!prepared.success) return prepared;

  const allowedFields = SAFE_EDIT_FIELDS[sectionName];
  if (!allowedFields || !allowedFields.has(fieldName)) {
    return blocked({
      draftPackPath: prepared.draftPackPath,
      packId: prepared.packId,
      warnings: prepared.warnings,
      errors: [`Field ${sectionName}.${fieldName} is not editable through draft review.`]
    });
  }

  const before = cloneValue(prepared.item[fieldName]);
  prepared.item[fieldName] = normalizeEditedValue(sectionName, fieldName, value);

  if (sectionName === 'referenceFormulas') {
    prepared.item.solverStatus = 'reference_only';
  }

  return saveReviewedDraftPack(prepared, {
    action: 'editField',
    section: sectionName,
    index,
    before,
    after: prepared.item[fieldName],
    changedField: fieldName
  });
}

function prepareDraftItemChange(draftPackInput, sectionName, index, options) {
  const loadResult = loadDraftKnowledgePackForReview(draftPackInput, options);
  if (!loadResult.success) return loadResult;

  const sectionError = validateSection(sectionName);
  if (sectionError) {
    return blocked({
      draftPackPath: loadResult.draftPackPath,
      packId: loadResult.packId,
      warnings: loadResult.warnings,
      errors: [sectionError]
    });
  }

  const parsedIndex = Number(index);
  if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
    return blocked({
      draftPackPath: loadResult.draftPackPath,
      packId: loadResult.packId,
      warnings: loadResult.warnings,
      errors: [`index must be a non-negative integer for ${sectionName}.`]
    });
  }

  const sectionItems = loadResult.pack[sectionName];
  if (!Array.isArray(sectionItems) || parsedIndex >= sectionItems.length) {
    return blocked({
      draftPackPath: loadResult.draftPackPath,
      packId: loadResult.packId,
      warnings: loadResult.warnings,
      errors: [`No item found at ${sectionName}[${parsedIndex}].`]
    });
  }

  return {
    success: true,
    draftPackPath: loadResult.draftPackPath,
    packId: loadResult.packId,
    pack: loadResult.pack,
    item: sectionItems[parsedIndex],
    warnings: loadResult.warnings,
    errors: []
  };
}

function saveReviewedDraftPack(prepared, change) {
  const sourceTrackingBefore = captureSourceTracking(prepared.item);
  const validation = validateKnowledgePack(prepared.pack);
  const warnings = [...prepared.warnings, ...validation.warnings];

  if (!sourceTrackingStillPresent(prepared.item, sourceTrackingBefore)) {
    return blocked({
      draftPackPath: prepared.draftPackPath,
      packId: prepared.packId,
      warnings,
      errors: ['Source tracking fields must be preserved.'],
      validationPassed: validation.valid
    });
  }

  if (!validation.valid) {
    return blocked({
      draftPackPath: prepared.draftPackPath,
      packId: prepared.packId,
      warnings,
      errors: validation.errors,
      validationPassed: false
    });
  }

  fs.writeFileSync(prepared.draftPackPath, `${JSON.stringify(prepared.pack, null, 2)}\n`);

  return {
    success: true,
    draftPackPath: prepared.draftPackPath,
    savedPath: prepared.draftPackPath,
    packId: prepared.packId,
    warnings,
    errors: [],
    validationPassed: true,
    ...change
  };
}

function makeReviewItem(sectionName, index, item) {
  return {
    section: sectionName,
    index,
    reviewStatus: item.reviewStatus,
    confidence: item.confidence,
    title: item.title,
    term: item.term,
    question: item.question,
    formula: item.equation,
    standardId: item.standardId,
    sourceFile: item.sourceFile,
    sourceLocation: item.sourceLocation,
    sourceTextSnippet: item.sourceTextSnippet
  };
}

function validateSection(sectionName) {
  if (!REVIEWABLE_SECTIONS.includes(sectionName)) {
    return `section must be one of: ${REVIEWABLE_SECTIONS.join(', ')}`;
  }
  return null;
}

function normalizeEditedValue(sectionName, fieldName, value) {
  if (sectionName === 'concepts' && fieldName === 'keyIdeas') {
    if (Array.isArray(value)) return value;
    return String(value)
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return String(value);
}

function captureSourceTracking(item) {
  const captured = {};
  SOURCE_TRACKING_FIELDS.forEach((field) => {
    if (field in item) captured[field] = item[field];
  });
  return captured;
}

function sourceTrackingStillPresent(item, before) {
  return Object.keys(before).every((field) => item[field] === before[field]);
}

function readJsonFile(filePath) {
  try {
    return {
      success: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8'))
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Could not read or parse draft knowledge pack: ${error.message}`]
    };
  }
}

function cloneValue(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.parse(JSON.stringify(value));
  }
  return value;
}

function blocked(result) {
  return {
    success: false,
    draftPackPath: result.draftPackPath,
    savedPath: undefined,
    packId: result.packId,
    validationPassed: result.validationPassed === true ? true : false,
    warnings: result.warnings || [],
    errors: result.errors || []
  };
}

module.exports = {
  REVIEWABLE_SECTIONS,
  SAFE_EDIT_FIELDS,
  editDraftItemField,
  listReviewableDraftItems,
  loadDraftKnowledgePackForReview,
  updateDraftItemReviewStatus
};
