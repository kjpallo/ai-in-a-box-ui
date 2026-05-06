const { matchQuestionToStandards } = require('./standardsMatcher');

const CONCEPT_KEYS = ['id', 'title', 'type', 'unit', 'score'];
const STANDARD_KEYS = [
  'standardId',
  'unit',
  'label',
  'score',
  'courseRelevance',
  'gradeBand',
  'domainCode',
  'strandCode',
  'strandTitle',
  'conceptTitle',
  'classroomArea',
  'reasonSummary'
];
const DEFAULT_COURSE_PROFILE_ID = 'physical_science';
const DEFAULT_STANDARDS_BANK_ID = 'missouri_science_6_12';
const MATCHER_VERSION = 'phase7d';
const CONFIDENCE_LEVELS = new Set(['strong', 'medium', 'weak', 'none']);

function buildStandardsLogMetadata(question, options = {}) {
  const matcher = options.matcher || matchQuestionToStandards;

  try {
    const result = matcher(question, options);
    const matchedConcepts = compactItems(result?.matchedConcepts, CONCEPT_KEYS);
    const primaryStandards = compactItems(result?.primaryStandards || result?.standards, STANDARD_KEYS);
    const possibleStandards = compactItems(result?.possibleStandards, STANDARD_KEYS);
    const standardsConfidence = primaryStandards.length
      ? deriveStandardsConfidence(primaryStandards, result?.standardsConfidence || result?.confidence)
      : 'none';
    const conceptConfidence = deriveConceptConfidence(
      matchedConcepts,
      result?.conceptConfidence || (!primaryStandards.length ? result?.confidence : '')
    );
    const possibleStandardsConfidence = possibleStandards.length
      ? deriveStandardsConfidence(possibleStandards, result?.possibleStandardsConfidence)
      : 'none';

    return {
      matchedConcepts,
      primaryStandards,
      possibleStandards,
      standards: primaryStandards,
      units: compactUnits([
        ...(Array.isArray(result?.units) ? result.units : []),
        ...primaryStandards.map((standard) => standard.unit),
        ...matchedConcepts.map((concept) => concept.unit)
      ]),
      conceptConfidence,
      standardsConfidence,
      possibleStandardsConfidence,
      courseProfileId: result?.courseProfileId || DEFAULT_COURSE_PROFILE_ID,
      standardsBankId: result?.standardsBankId || result?.bankId || DEFAULT_STANDARDS_BANK_ID,
      matcherVersion: MATCHER_VERSION
    };
  } catch (error) {
    return {
      matchedConcepts: [],
      primaryStandards: [],
      possibleStandards: [],
      standards: [],
      units: [],
      conceptConfidence: 'none',
      standardsConfidence: 'none',
      possibleStandardsConfidence: 'none',
      courseProfileId: DEFAULT_COURSE_PROFILE_ID,
      standardsBankId: DEFAULT_STANDARDS_BANK_ID,
      matcherVersion: MATCHER_VERSION,
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
  return [...new Set(units.map((unit) => String(unit || '').trim()).filter(Boolean))];
}

function deriveConceptConfidence(concepts, fallback) {
  const normalizedFallback = normalizeConfidence(fallback);
  if (normalizedFallback !== 'none') return normalizedFallback;

  const topScore = maxScore(concepts);
  if (topScore >= 18) return 'strong';
  if (topScore >= 7) return 'medium';
  if (topScore > 0) return 'weak';
  return 'none';
}

function deriveStandardsConfidence(standards, fallback) {
  const normalizedFallback = normalizeConfidence(fallback);
  if (normalizedFallback !== 'none') return normalizedFallback;

  const topScore = maxScore(standards);
  if (topScore >= 16) return 'strong';
  if (topScore >= 5) return 'medium';
  if (topScore > 0) return 'weak';
  return 'none';
}

function maxScore(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((max, item) => {
    const score = Number(item?.score);
    return Number.isFinite(score) && score > max ? score : max;
  }, 0);
}

function normalizeConfidence(value) {
  const confidence = String(value || '').toLowerCase().trim();
  return CONFIDENCE_LEVELS.has(confidence) ? confidence : 'none';
}

module.exports = {
  MATCHER_VERSION,
  buildStandardsLogMetadata
};
