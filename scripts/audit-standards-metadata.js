const fs = require('node:fs');
const path = require('node:path');

const standardsPath = path.join(__dirname, '..', 'knowledge', 'standards', 'missouri_science_6_12_standards.json');
const strict = process.argv.includes('--strict');

const DISALLOWED_SINGLE_WORD_TRIGGERS = new Set([
  'force',
  'mass',
  'energy',
  'matter',
  'atom',
  'wave',
  'frequency',
  'cells',
  'ecosystem',
  'design',
  'engineering',
  'sun',
  'moon',
  'current',
  'gravity',
  'change'
]);

const ALLOWED_SINGLE_WORD_TRIGGERS = new Set([
  'dna',
  'inertia',
  'mendeleev',
  'photosynthesis',
  'sputnik'
]);

const ALLOWED_DOMAIN_LABELS = new Set([
  'chemistry',
  'physics',
  'biology',
  'earth science',
  'space science',
  'physical science',
  'life science',
  'engineering',
  'middle school',
  'high school'
]);

const PHYSICAL_SCIENCE_BROAD_TERMS = new Set([
  'change',
  'matter',
  'energy',
  'force',
  'mass',
  'wave',
  'design',
  'engineering',
  'current',
  'gravity'
]);

const warnings = [];
const errors = [];

let bank;
try {
  bank = JSON.parse(fs.readFileSync(standardsPath, 'utf8'));
} catch (error) {
  console.error(`Malformed standards file: ${error.message}`);
  process.exit(1);
}

if (!bank || !Array.isArray(bank.standards)) {
  console.error('Malformed standards file: expected a standards array');
  process.exit(1);
}

const standards = bank.standards;
const standardIds = new Set();
const keywordUsage = new Map();
const triggerUsage = new Map();

for (const standard of standards) {
  const id = standard.standardId || '(missing standardId)';

  if (!standard.standardId) {
    errors.push(`Missing required field standardId`);
  } else if (standardIds.has(standard.standardId)) {
    errors.push(`Duplicate standardId ${standard.standardId}`);
  } else {
    standardIds.add(standard.standardId);
  }

  for (const field of ['gradeBand', 'domainName', 'strandCode', 'strandTitle', 'conceptTitle', 'statement']) {
    if (!standard[field]) errors.push(`${id} missing required field ${field}`);
  }

  if (!Array.isArray(standard.keywords)) errors.push(`${id} missing required keywords array`);
  if (!Array.isArray(standard.questionTriggers)) errors.push(`${id} missing required questionTriggers array`);

  if (standard.standardId && standard.standardId.includes('ETS1.C')) {
    errors.push(`${standard.standardId} appears to invent ETS1.C`);
  }

  if (!Object.prototype.hasOwnProperty.call(standard, 'statementType')) {
    errors.push(`${id} missing statementType`);
  }
  if (!Object.prototype.hasOwnProperty.call(standard, 'officialStatementVerified')) {
    errors.push(`${id} missing officialStatementVerified`);
  }
  if (standard.officialStatementVerified !== false) {
    errors.push(`${id} has officialStatementVerified=${standard.officialStatementVerified}; leave false unless source-verified`);
  }

  const keywords = standard.keywords || [];
  const triggers = standard.questionTriggers || [];

  if (keywords.length > 15) {
    warnings.push({ type: 'Oversized keyword arrays', message: `${id} has ${keywords.length} keywords` });
  }
  if (triggers.length > 10) {
    warnings.push({ type: 'Oversized question trigger arrays', message: `${id} has ${triggers.length} questionTriggers` });
  }

  for (const trigger of triggers) {
    const normalized = normalize(trigger);
    if (!normalized) continue;
    addUsage(triggerUsage, normalized, id);
    if (
      !normalized.includes(' ') &&
      DISALLOWED_SINGLE_WORD_TRIGGERS.has(normalized) &&
      !ALLOWED_SINGLE_WORD_TRIGGERS.has(normalized)
    ) {
      warnings.push({ type: 'Single-word question triggers', message: `${id} uses broad trigger "${trigger}"` });
    }
  }

  for (const keyword of keywords) {
    const normalized = normalize(keyword);
    if (!normalized) continue;
    addUsage(keywordUsage, normalized, id);
  }

  if (isActivePhysicalScienceStandard(standard)) {
    for (const [field, values] of [['keyword', keywords], ['trigger', triggers]]) {
      for (const value of values) {
        const normalized = normalize(value);
        if (PHYSICAL_SCIENCE_BROAD_TERMS.has(normalized)) {
          warnings.push({
            type: 'Suspicious broad terms in active physical science',
            message: `${id} uses broad ${field} "${value}"`
          });
        }
      }
    }
  }
}

for (const [keyword, ids] of keywordUsage.entries()) {
  if (ids.size > 5 && !ALLOWED_DOMAIN_LABELS.has(keyword)) {
    warnings.push({
      type: 'Repeated keywords',
      message: `"${keyword}" appears in ${ids.size} standards: ${formatIds(ids)}`
    });
  }
}

for (const [trigger, ids] of triggerUsage.entries()) {
  if (ids.size > 2) {
    warnings.push({
      type: 'Repeated question triggers',
      message: `"${trigger}" appears in ${ids.size} standards: ${formatIds(ids)}`
    });
  }
}

printGroup('Errors', errors);
printWarningGroups(warnings);

if (errors.length > 0 || (strict && warnings.length > 0)) {
  if (strict && warnings.length > 0) {
    console.error(`\nStrict mode failed with ${warnings.length} metadata warning(s).`);
  }
  process.exit(1);
}

console.log(`\nStandards metadata audit completed: ${errors.length} error(s), ${warnings.length} warning(s).`);

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addUsage(map, value, id) {
  if (!map.has(value)) map.set(value, new Set());
  map.get(value).add(id);
}

function isActivePhysicalScienceStandard(standard) {
  return standard.gradeBand === '9-12' &&
    ['PS1', 'PS2', 'PS3', 'PS4', 'ETS1'].includes(standard.strandCode);
}

function formatIds(ids) {
  const values = [...ids].slice(0, 8);
  const suffix = ids.size > values.length ? ', ...' : '';
  return `${values.join(', ')}${suffix}`;
}

function printGroup(title, items) {
  console.log(`\n${title}`);
  if (items.length === 0) {
    console.log('  None');
    return;
  }
  for (const item of items) console.log(`  - ${item}`);
}

function printWarningGroups(items) {
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.type)) grouped.set(item.type, []);
    grouped.get(item.type).push(item.message);
  }

  console.log('\nWarnings');
  if (items.length === 0) {
    console.log('  None');
    return;
  }

  for (const [type, messages] of grouped.entries()) {
    console.log(`\n  ${type}`);
    for (const message of messages) console.log(`    - ${message}`);
  }
}
