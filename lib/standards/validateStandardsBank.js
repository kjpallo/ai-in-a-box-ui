const fs = require('node:fs');

const {
  CONFIDENCE_VALUES,
  REQUIRED_STANDARD_STRING_FIELDS,
  REQUIRED_TOP_LEVEL_FIELDS,
  REVIEW_STATUSES,
  SAFE_STANDARDS_BANK_ID_PATTERN,
  SOURCE_TRACKING_FIELDS,
  STANDARD_ARRAY_FIELDS
} = require('./standardsBankSchema');

function validateStandardsBank(bank) {
  const errors = [];
  const warnings = [];

  if (!bank || typeof bank !== 'object' || Array.isArray(bank)) {
    return {
      valid: false,
      errors: ['Standards bank must be a JSON object.'],
      warnings
    };
  }

  REQUIRED_TOP_LEVEL_FIELDS.forEach((field) => {
    if (!(field in bank)) {
      errors.push(`Missing required top-level field: ${field}`);
    }
  });

  if (typeof bank.standardsBankId !== 'string' || !bank.standardsBankId.trim()) {
    errors.push('standardsBankId must be a non-empty string.');
  } else if (!SAFE_STANDARDS_BANK_ID_PATTERN.test(bank.standardsBankId)) {
    errors.push('standardsBankId must be safe for filenames: lowercase letters, numbers, underscores, and hyphens only.');
  }

  ['title', 'version', 'subject', 'gradeLevel', 'jurisdiction'].forEach((field) => {
    if (field in bank && !isNonEmptyString(bank[field])) {
      errors.push(`${field} must be a non-empty string.`);
    }
  });

  if ('sourceFiles' in bank && !Array.isArray(bank.sourceFiles)) {
    errors.push('sourceFiles must be an array.');
  }

  if ('standards' in bank && !Array.isArray(bank.standards)) {
    errors.push('standards must be an array.');
  }

  if ('metadata' in bank && (!bank.metadata || typeof bank.metadata !== 'object' || Array.isArray(bank.metadata))) {
    errors.push('metadata must be an object.');
  }

  validateSourceFiles(bank.sourceFiles, errors);
  validateStandards(bank.standards, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateStandardsBankFile(filePath) {
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

  return validateStandardsBank(parsed);
}

function validateSourceFiles(sourceFiles, errors) {
  if (!Array.isArray(sourceFiles)) return;

  sourceFiles.forEach((sourceFile, index) => {
    const label = `sourceFiles[${index}]`;
    if (!isObject(sourceFile, label, errors)) return;

    requireString(sourceFile, 'fileName', `${label}.fileName`, errors);
    requireString(sourceFile, 'fileType', `${label}.fileType`, errors);
  });
}

function validateStandards(standards, errors, warnings) {
  if (!Array.isArray(standards)) return;

  const seenStandardIds = new Set();

  standards.forEach((standard, index) => {
    const label = `standards[${index}]`;
    if (!isObject(standard, label, errors)) return;

    REQUIRED_STANDARD_STRING_FIELDS.forEach((field) => {
      requireString(standard, field, `${label}.${field}`, errors);
    });

    if (isNonEmptyString(standard.standardId)) {
      if (seenStandardIds.has(standard.standardId)) {
        errors.push(`${label}.standardId must be unique within the standards bank: ${standard.standardId}`);
      }
      seenStandardIds.add(standard.standardId);
    }

    STANDARD_ARRAY_FIELDS.forEach((field) => {
      requireArray(standard, field, `${label}.${field}`, errors);
    });

    validateReviewAndConfidence(standard, label, errors);
    validateSourceTracking(standard, label, errors, warnings);
  });
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
    warnings.push(`${label} has no source tracking; approved manual entries may allow this, but uploaded or draft-style standards should include it.`);
    return;
  }

  SOURCE_TRACKING_FIELDS.forEach((field) => {
    if (!isNonEmptyString(item[field])) {
      errors.push(`${label}.${field} is required for uploaded or draft-style standards when possible.`);
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
  validateStandardsBank,
  validateStandardsBankFile
};
