const REVIEW_STATUSES = ['approved', 'pending', 'rejected'];
const CONFIDENCE_VALUES = ['high', 'medium', 'low'];

const REQUIRED_TOP_LEVEL_FIELDS = [
  'standardsBankId',
  'title',
  'version',
  'subject',
  'gradeLevel',
  'jurisdiction',
  'sourceFiles',
  'standards',
  'metadata'
];

const REQUIRED_STANDARD_STRING_FIELDS = [
  'standardId',
  'code',
  'title',
  'officialText'
];

const STANDARD_ARRAY_FIELDS = [
  'keywords',
  'questionTriggers',
  'prerequisiteStandards',
  'relatedStandards'
];

const SAFE_STANDARDS_BANK_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const SOURCE_TRACKING_FIELDS = [
  'sourceFile',
  'sourceLocation',
  'sourceTextSnippet'
];

module.exports = {
  CONFIDENCE_VALUES,
  REQUIRED_STANDARD_STRING_FIELDS,
  REQUIRED_TOP_LEVEL_FIELDS,
  REVIEW_STATUSES,
  SAFE_STANDARDS_BANK_ID_PATTERN,
  SOURCE_TRACKING_FIELDS,
  STANDARD_ARRAY_FIELDS
};
