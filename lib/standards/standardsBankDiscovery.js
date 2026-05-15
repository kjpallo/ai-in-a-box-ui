const fs = require('node:fs');
const path = require('node:path');

const { SAFE_STANDARDS_BANK_ID_PATTERN } = require('./standardsBankSchema');
const { validateStandardsBank } = require('./validateStandardsBank');

const DEFAULT_STANDARDS_BANKS_DIR = path.join(__dirname, '..', '..', 'knowledge', 'standards-banks');
const STANDARDS_BANK_FILE_NAME = 'standards_bank.json';
const MAX_DETAIL_STANDARDS = 500;

function listStandardsBanks(options = {}) {
  const standardsBanksDir = path.resolve(options.standardsBanksDir || DEFAULT_STANDARDS_BANKS_DIR);
  const files = findStandardsBankFiles(standardsBanksDir);

  return {
    standardsBanks: files
      .map((filePath) => loadStandardsBankRecord(filePath))
      .map((record) => makeStandardsBankSummary(record))
      .sort(compareStandardsBankSummaries),
    warnings: [],
    errors: []
  };
}

function getStandardsBankSummary(standardsBankId, options = {}) {
  const record = findStandardsBankRecord(standardsBankId, options);
  if (!record.success) return record;
  return {
    success: true,
    standardsBank: makeStandardsBankSummary(record)
  };
}

function getStandardsBankDetails(standardsBankId, options = {}) {
  const record = findStandardsBankRecord(standardsBankId, options);
  if (!record.success) return record;

  const standards = Array.isArray(record.bank && record.bank.standards)
    ? record.bank.standards.slice(0, options.maxStandards || MAX_DETAIL_STANDARDS).map(makeStandardDetail)
    : [];

  return {
    success: true,
    standardsBank: {
      ...makeStandardsBankSummary(record),
      standards,
      standardsReturned: standards.length,
      standardsTruncated: Array.isArray(record.bank && record.bank.standards)
        ? record.bank.standards.length > standards.length
        : false
    }
  };
}

function loadStandardsBankForReport(standardsBankId, options = {}) {
  const record = findStandardsBankRecord(standardsBankId, options);
  if (!record.success) return record;
  if (record.validation.valid !== true) {
    return {
      success: false,
      statusCode: 422,
      errors: [`Standards bank ${standardsBankId} did not pass validation.`],
      warnings: record.validation.warnings || [],
      standardsBank: null
    };
  }

  return {
    success: true,
    standardsBank: record.bank,
    summary: makeStandardsBankSummary(record)
  };
}

function isSafeStandardsBankId(standardsBankId) {
  return SAFE_STANDARDS_BANK_ID_PATTERN.test(String(standardsBankId || '').trim());
}

function findStandardsBankRecord(standardsBankId, options = {}) {
  const id = String(standardsBankId || '').trim();
  if (!isSafeStandardsBankId(id)) {
    return {
      success: false,
      statusCode: 400,
      errors: ['standardsBankId must contain only lowercase letters, numbers, underscores, and hyphens.'],
      warnings: []
    };
  }

  const standardsBanksDir = path.resolve(options.standardsBanksDir || DEFAULT_STANDARDS_BANKS_DIR);
  const records = findStandardsBankFiles(standardsBanksDir).map((filePath) => loadStandardsBankRecord(filePath));
  const record = records.find((item) => item.bank && item.bank.standardsBankId === id);

  if (!record) {
    return {
      success: false,
      statusCode: 404,
      errors: [`Standards bank not found: ${id}`],
      warnings: []
    };
  }

  return {
    success: true,
    ...record
  };
}

function findStandardsBankFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const results = [];
  fs.readdirSync(rootDir, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findStandardsBankFiles(entryPath));
    } else if (entry.isFile() && entry.name === STANDARDS_BANK_FILE_NAME) {
      results.push(entryPath);
    }
  });
  return results.sort();
}

function loadStandardsBankRecord(filePath) {
  let bank = null;
  let parseErrors = [];

  try {
    bank = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    parseErrors = [`Could not read or parse JSON file: ${error.message}`];
  }

  const validation = bank
    ? validateStandardsBank(bank)
    : { valid: false, errors: parseErrors, warnings: [] };

  return {
    bank,
    validation
  };
}

function makeStandardsBankSummary(record) {
  const bank = record.bank || {};
  const validation = record.validation || { valid: false, errors: [], warnings: [] };

  return {
    standardsBankId: typeof bank.standardsBankId === 'string' ? bank.standardsBankId : '',
    title: typeof bank.title === 'string' ? bank.title : '',
    subject: typeof bank.subject === 'string' ? bank.subject : '',
    gradeLevel: typeof bank.gradeLevel === 'string' ? bank.gradeLevel : '',
    jurisdiction: typeof bank.jurisdiction === 'string' ? bank.jurisdiction : '',
    version: typeof bank.version === 'string' ? bank.version : '',
    standardsCount: Array.isArray(bank.standards) ? bank.standards.length : 0,
    validationPassed: validation.valid === true,
    warnings: validation.warnings || [],
    errors: validation.errors || []
  };
}

function makeStandardDetail(standard) {
  return {
    standardId: stringField(standard, 'standardId'),
    code: stringField(standard, 'code'),
    title: stringField(standard, 'title'),
    officialText: stringField(standard, 'officialText'),
    studentFriendlyText: stringField(standard, 'studentFriendlyText'),
    strand: stringField(standard, 'strand'),
    topic: stringField(standard, 'topic'),
    keywords: Array.isArray(standard && standard.keywords) ? standard.keywords.filter(isNonEmptyString) : []
  };
}

function stringField(item, field) {
  return item && typeof item[field] === 'string' ? item[field] : '';
}

function compareStandardsBankSummaries(a, b) {
  return String(a.title || a.standardsBankId).localeCompare(String(b.title || b.standardsBankId));
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = {
  DEFAULT_STANDARDS_BANKS_DIR,
  getStandardsBankDetails,
  getStandardsBankSummary,
  isSafeStandardsBankId,
  listStandardsBanks,
  loadStandardsBankForReport
};
