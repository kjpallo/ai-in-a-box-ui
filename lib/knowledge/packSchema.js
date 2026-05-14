const REVIEW_STATUSES = ['approved', 'pending', 'rejected'];
const CONFIDENCE_VALUES = ['high', 'medium', 'low'];

const REQUIRED_TOP_LEVEL_FIELDS = [
  'packId',
  'title',
  'version',
  'subject',
  'gradeLevel',
  'sourceFiles',
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap',
  'smokeTests',
  'metadata'
];

const ARRAY_FIELDS = [
  'sourceFiles',
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap',
  'smokeTests'
];

const SAFE_PACK_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const SOURCE_TRACKING_FIELDS = [
  'sourceFile',
  'sourceLocation',
  'sourceTextSnippet'
];

module.exports = {
  ARRAY_FIELDS,
  CONFIDENCE_VALUES,
  REQUIRED_TOP_LEVEL_FIELDS,
  REVIEW_STATUSES,
  SAFE_PACK_ID_PATTERN,
  SOURCE_TRACKING_FIELDS
};
