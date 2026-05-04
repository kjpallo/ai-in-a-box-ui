const { matchQuestionToStandards } = require('./standardsMatcher');

const CONCEPT_KEYS = ['id', 'title', 'type', 'unit', 'score'];
const STANDARD_KEYS = ['standardId', 'unit', 'label'];

function buildStandardsLogMetadata(question, options = {}) {
  const matcher = options.matcher || matchQuestionToStandards;

  try {
    const result = matcher(question);

    return {
      matchedConcepts: compactItems(result?.matchedConcepts, CONCEPT_KEYS),
      standards: compactItems(result?.standards, STANDARD_KEYS),
      units: compactUnits(result?.units),
      standardsConfidence: result?.confidence || 'none'
    };
  } catch (error) {
    return {
      matchedConcepts: [],
      standards: [],
      units: [],
      standardsConfidence: 'none',
      standardsError: error?.message || String(error || 'Unknown standards matching error')
    };
  }
}

function compactItems(items, keys) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const compact = {};

    for (const key of keys) {
      compact[key] = item?.[key];
    }

    return compact;
  });
}

function compactUnits(units) {
  if (!Array.isArray(units)) return [];
  return units.filter((unit) => unit);
}

module.exports = {
  buildStandardsLogMetadata
};
