const fs = require('node:fs');

const {
  ARRAY_FIELDS,
  CONFIDENCE_VALUES,
  REQUIRED_TOP_LEVEL_FIELDS,
  REVIEW_STATUSES,
  SAFE_PACK_ID_PATTERN,
  SOURCE_TRACKING_FIELDS
} = require('./packSchema');
const {
  validateStandardsMetadata,
  validateStandardsMetadataReferences
} = require('./standardsMetadata');

function validateKnowledgePack(pack, options = {}) {
  const errors = [];
  const warnings = [];
  const allowedBuiltInSolvers = new Set(options.allowedBuiltInSolvers || []);
  const approvedStandardIds = buildApprovedStandardIdSet(options.standardsBank);

  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    return {
      valid: false,
      errors: ['Knowledge pack must be a JSON object.'],
      warnings
    };
  }

  REQUIRED_TOP_LEVEL_FIELDS.forEach((field) => {
    if (!(field in pack)) {
      errors.push(`Missing required top-level field: ${field}`);
    }
  });

  if (typeof pack.packId !== 'string' || !pack.packId.trim()) {
    errors.push('packId must be a non-empty string.');
  } else if (!SAFE_PACK_ID_PATTERN.test(pack.packId)) {
    errors.push('packId must be safe for filenames: lowercase letters, numbers, underscores, and hyphens only.');
  }

  ['title', 'version', 'subject', 'gradeLevel'].forEach((field) => {
    if (field in pack && !isNonEmptyString(pack[field])) {
      errors.push(`${field} must be a non-empty string.`);
    }
  });

  ARRAY_FIELDS.forEach((field) => {
    if (field in pack && !Array.isArray(pack[field])) {
      errors.push(`${field} must be an array.`);
    }
  });

  if ('metadata' in pack && (!pack.metadata || typeof pack.metadata !== 'object' || Array.isArray(pack.metadata))) {
    errors.push('metadata must be an object.');
  }

  validateSourceFiles(pack.sourceFiles, errors);
  validateVocabulary(pack.vocabulary, errors, warnings);
  validateConcepts(pack.concepts, errors, warnings);
  validateReferenceFormulas(pack.referenceFormulas, errors, warnings, allowedBuiltInSolvers);
  validateProblemBank(pack.problemBank, errors, warnings);
  validateStandardsMap(pack.standardsMap, errors, warnings);
  validateSmokeTests(pack.smokeTests, errors, warnings);
  validateStandardReferences(pack, approvedStandardIds, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateKnowledgePackFile(filePath, options = {}) {
  let parsed;

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {
      valid: false,
      errors: [`Could not read or parse JSON file: ${error.message}`],
      warnings: []
    };
  }

  return validateKnowledgePack(parsed, options);
}

function validateSourceFiles(sourceFiles, errors) {
  if (!Array.isArray(sourceFiles)) return;

  sourceFiles.forEach((sourceFile, index) => {
    const label = `sourceFiles[${index}]`;
    if (!sourceFile || typeof sourceFile !== 'object' || Array.isArray(sourceFile)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    requireString(sourceFile, 'fileName', `${label}.fileName`, errors);
    requireString(sourceFile, 'fileType', `${label}.fileType`, errors);
    validateReviewAndConfidence(sourceFile, label, errors);
  });
}

function validateVocabulary(vocabulary, errors, warnings) {
  if (!Array.isArray(vocabulary)) return;

  vocabulary.forEach((item, index) => {
    const label = `vocabulary[${index}]`;
    if (!isObject(item, label, errors)) return;

    requireString(item, 'term', `${label}.term`, errors);
    requireArray(item, 'aliases', `${label}.aliases`, errors);
    validateStandardsMetadata(item.standards, `${label}.standards`, errors);
    validateReviewAndConfidence(item, label, errors);
    validateSourceTracking(item, label, errors, warnings);
  });
}

function validateConcepts(concepts, errors, warnings) {
  if (!Array.isArray(concepts)) return;

  concepts.forEach((item, index) => {
    const label = `concepts[${index}]`;
    if (!isObject(item, label, errors)) return;

    requireString(item, 'conceptId', `${label}.conceptId`, errors);
    requireString(item, 'title', `${label}.title`, errors);
    ['aliases', 'keyIdeas', 'examples', 'nonExamples', 'commonMisconceptions'].forEach((field) => {
      requireArray(item, field, `${label}.${field}`, errors);
    });
    validateStandardsMetadata(item.standards, `${label}.standards`, errors);
    validateReviewAndConfidence(item, label, errors);
    validateSourceTracking(item, label, errors, warnings);
  });
}

function validateReferenceFormulas(referenceFormulas, errors, warnings, allowedBuiltInSolvers) {
  if (!Array.isArray(referenceFormulas)) return;

  referenceFormulas.forEach((item, index) => {
    const label = `referenceFormulas[${index}]`;
    if (!isObject(item, label, errors)) return;

    requireString(item, 'formulaId', `${label}.formulaId`, errors);
    requireString(item, 'title', `${label}.title`, errors);
    requireString(item, 'equation', `${label}.equation`, errors);
    requireArray(item, 'variables', `${label}.variables`, errors);
    validateStandardsMetadata(item.standards, `${label}.standards`, errors);
    validateReviewAndConfidence(item, label, errors);
    validateSourceTracking(item, label, errors, warnings);

    if (!isNonEmptyString(item.solverStatus)) {
      errors.push(`${label}.solverStatus must be "reference_only" for uploaded formulas.`);
    } else if (item.solverStatus !== 'reference_only' && !allowedBuiltInSolvers.has(item.solverStatus)) {
      errors.push(`${label}.solverStatus cannot claim solver support: ${item.solverStatus}`);
    }
  });
}

function validateProblemBank(problemBank, errors, warnings) {
  if (!Array.isArray(problemBank)) return;

  problemBank.forEach((item, index) => {
    const label = `problemBank[${index}]`;
    if (!isObject(item, label, errors)) return;

    requireString(item, 'problemId', `${label}.problemId`, errors);
    requireString(item, 'question', `${label}.question`, errors);
    requireString(item, 'expectedAnswer', `${label}.expectedAnswer`, errors);
    validateStandardsMetadata(item.standards, `${label}.standards`, errors);
    validateReviewAndConfidence(item, label, errors);
    validateSourceTracking(item, label, errors, warnings);
  });
}

function validateStandardsMap(standardsMap, errors, warnings) {
  if (!Array.isArray(standardsMap)) return;

  standardsMap.forEach((item, index) => {
    const label = `standardsMap[${index}]`;
    if (!isObject(item, label, errors)) return;

    requireString(item, 'standardId', `${label}.standardId`, errors);
    requireString(item, 'description', `${label}.description`, errors);
    validateStandardsMetadata(item.standards, `${label}.standards`, errors);
    if ('relatedVocabulary' in item) requireArray(item, 'relatedVocabulary', `${label}.relatedVocabulary`, errors);
    if ('relatedConcepts' in item) requireArray(item, 'relatedConcepts', `${label}.relatedConcepts`, errors);
    validateReviewAndConfidence(item, label, errors);
  });

  if (standardsMap.length === 0) {
    warnings.push('standardsMap is empty; approved packets should normally map content to standards.');
  }
}

function validateSmokeTests(smokeTests, errors, warnings) {
  if (!Array.isArray(smokeTests)) return;

  smokeTests.forEach((item, index) => {
    const label = `smokeTests[${index}]`;
    if (!isObject(item, label, errors)) return;

    requireString(item, 'question', `${label}.question`, errors);
    if (!isNonEmptyString(item.expectedAnswer) && !isNonEmptyString(item.expectedRoute)) {
      errors.push(`${label} must include expectedAnswer or expectedRoute.`);
    }
    validateStandardsMetadata(item.standards, `${label}.standards`, errors);
    validateReviewAndConfidence(item, label, errors);
  });

  if (smokeTests.length === 0) {
    warnings.push('smokeTests is empty; packets should include teacher-review checks before approval.');
  }
}

function validateStandardReferences(pack, approvedStandardIds, errors) {
  if (!approvedStandardIds) return;

  validateStandardItemReferences(pack.vocabulary, 'vocabulary', approvedStandardIds, errors);
  validateStandardItemReferences(pack.concepts, 'concepts', approvedStandardIds, errors);
  validateStandardItemReferences(pack.referenceFormulas, 'referenceFormulas', approvedStandardIds, errors);
  validateStandardItemReferences(pack.problemBank, 'problemBank', approvedStandardIds, errors);
  validateStandardItemReferences(pack.standardsMap, 'standardsMap', approvedStandardIds, errors);
  validateStandardItemReferences(pack.smokeTests, 'smokeTests', approvedStandardIds, errors);

  if (Array.isArray(pack.standardsMap)) {
    pack.standardsMap.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      if (isNonEmptyString(item.standardId) && !approvedStandardIds.has(item.standardId)) {
        errors.push(`standardsMap[${index}].standardId has unknown standard reference: ${item.standardId}`);
      }
    });
  }
}

function validateStandardItemReferences(items, fieldName, approvedStandardIds, errors) {
  if (!Array.isArray(items)) return;

  items.forEach((item, itemIndex) => {
    validateStandardsMetadataReferences(item, `${fieldName}[${itemIndex}]`, approvedStandardIds, errors);
  });
}

function buildApprovedStandardIdSet(standardsBank) {
  if (!standardsBank) return null;

  if (standardsBank instanceof Set) {
    return standardsBank;
  }

  if (Array.isArray(standardsBank)) {
    return new Set(standardsBank.filter(isNonEmptyString));
  }

  if (standardsBank && Array.isArray(standardsBank.standards)) {
    return new Set(
      standardsBank.standards
        .map((standard) => standard && standard.standardId)
        .filter(isNonEmptyString)
    );
  }

  return new Set();
}

function validateReviewAndConfidence(item, label, errors) {
  if (!REVIEW_STATUSES.includes(item.reviewStatus)) {
    errors.push(`${label}.reviewStatus must be one of: ${REVIEW_STATUSES.join(', ')}`);
  }

  if (!CONFIDENCE_VALUES.includes(item.confidence)) {
    errors.push(`${label}.confidence must be one of: ${CONFIDENCE_VALUES.join(', ')}`);
  }
}

function validateSourceTracking(item, label, errors, warnings) {
  const hasAnySourceTracking = SOURCE_TRACKING_FIELDS.some((field) => isNonEmptyString(item[field]));
  const needsSourceTracking = item.reviewStatus !== 'approved' || hasAnySourceTracking;

  if (!needsSourceTracking) {
    warnings.push(`${label} has no source tracking; approved manual entries may allow this, but uploaded content should include it.`);
    return;
  }

  SOURCE_TRACKING_FIELDS.forEach((field) => {
    if (!isNonEmptyString(item[field])) {
      errors.push(`${label}.${field} is required for uploaded or draft-style items.`);
    }
  });
}

function isObject(value, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return false;
  }
  return true;
}

function requireString(item, field, label, errors) {
  if (!isNonEmptyString(item[field])) {
    errors.push(`${label} must be a non-empty string.`);
  }
}

function requireArray(item, field, label, errors) {
  if (!Array.isArray(item[field])) {
    errors.push(`${label} must be an array.`);
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = {
  buildApprovedStandardIdSet,
  validateKnowledgePack,
  validateKnowledgePackFile
};
