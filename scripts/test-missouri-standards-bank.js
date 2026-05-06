const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const standardsPath = path.join(__dirname, '..', 'knowledge', 'standards', 'missouri_science_6_12_standards.json');
const profilesPath = path.join(__dirname, '..', 'knowledge', 'standards', 'course_profiles.json');

assert.ok(fs.existsSync(standardsPath), 'standards bank file should exist');
assert.ok(fs.existsSync(profilesPath), 'course profiles file should exist');

const bank = JSON.parse(fs.readFileSync(standardsPath, 'utf8'));
const profilesConfig = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));

assert.equal(bank.bankId, 'missouri_science_6_12');
assert.ok(Array.isArray(bank.standards), 'standards should be an array');
assert.ok(bank.standards.length > 0, 'standards should not be empty');

const standardIds = bank.standards.map((standard) => standard.standardId);
assert.equal(new Set(standardIds).size, standardIds.length, 'all standardIds should be unique');

for (const expectedId of [
  '9-12.PS1.A.1',
  '9-12.PS2.A.1',
  '9-12.PS3.A.1',
  '9-12.PS4.A.1',
  '9-12.LS1.A.1',
  '9-12.ESS1.A.1',
  '9-12.ETS1.A.1',
  '9-12.ETS1.B.2'
]) {
  assert.ok(standardIds.includes(expectedId), `expected ${expectedId} in standards bank`);
}

assert.equal(
  standardIds.some((standardId) => standardId.includes('ETS1.C')),
  false,
  'ETS1.C standards should not be invented'
);

const ps1a1 = bank.standards.find((standard) => standard.standardId === '9-12.PS1.A.1');
assert.ok(ps1a1, '9-12.PS1.A.1 should exist');
const ps1a1Metadata = normalizeMetadata([...(ps1a1.keywords || []), ...(ps1a1.questionTriggers || [])]);
for (const forbidden of [
  'density',
  'what is density',
  'calculate density',
  'fission',
  'fusion',
  'radioactive decay',
  'mole',
  'equilibrium',
  'reaction rate'
]) {
  assert.equal(
    ps1a1Metadata.includes(forbidden),
    false,
    `9-12.PS1.A.1 metadata should not include ${forbidden}`
  );
}

const bannedSingleWordTriggers = new Set([
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

for (const standard of bank.standards) {
  assert.ok(standard.standardId, `${standard.standardId || 'standard'} should have standardId`);
  assert.ok(standard.gradeBand, `${standard.standardId} should have gradeBand`);
  assert.ok(standard.domainName, `${standard.standardId} should have domainName`);
  assert.ok(standard.strandCode, `${standard.standardId} should have strandCode`);
  assert.ok(standard.strandTitle, `${standard.standardId} should have strandTitle`);
  assert.ok(standard.conceptTitle, `${standard.standardId} should have conceptTitle`);
  assert.ok(standard.statement, `${standard.standardId} should have statement`);
  assert.ok(
    standard.statementType,
    `${standard.standardId} should have statementType`
  );
  assert.ok(
    Object.prototype.hasOwnProperty.call(standard, 'officialStatementVerified'),
    `${standard.standardId} should have officialStatementVerified`
  );
  assert.equal(
    standard.officialStatementVerified,
    false,
    `${standard.standardId} should keep officialStatementVerified false unless source-verified`
  );
  assert.ok(Array.isArray(standard.keywords), `${standard.standardId} should have keywords array`);
  assert.ok(Array.isArray(standard.questionTriggers), `${standard.standardId} should have questionTriggers array`);

  if (standard.gradeBand === '9-12' && ['PS1', 'PS2', 'PS3', 'PS4', 'ETS1'].includes(standard.strandCode)) {
    for (const trigger of standard.questionTriggers) {
      const normalizedTrigger = String(trigger || '').toLowerCase();
      assert.equal(
        !normalizedTrigger.includes(' ') && bannedSingleWordTriggers.has(normalizedTrigger),
        false,
        `${standard.standardId} should not use banned single-word question trigger ${trigger}`
      );
    }
  }
}

assertMetadataIncludes(
  '9-12.PS2.B.2',
  ['current', 'magnetic field', 'electromagnetic induction'],
  '9-12.PS2.B.2 should include current/magnetic field/electromagnetic induction metadata'
);
assertMetadataIncludes(
  '9-12.PS4.A.1',
  ['frequency', 'wavelength', 'wave speed'],
  '9-12.PS4.A.1 should include frequency/wavelength/wave speed metadata'
);
assertMetadataIncludes(
  '9-12.ETS1.B.1',
  ['trade-offs', 'criteria', 'cost', 'safety', 'reliability', 'aesthetics'],
  '9-12.ETS1.B.1 should include trade-offs/criteria/cost/safety/reliability/aesthetics metadata'
);

const physicalScience = (profilesConfig.profiles || [])
  .find((profile) => profile.profileId === 'physical_science');

assert.ok(physicalScience, 'physical_science profile should exist');

for (const strandCode of ['PS1', 'PS2', 'PS3', 'PS4']) {
  assert.ok(
    hasFilter(physicalScience.activeCoreFilters, { gradeBand: '9-12', strandCode }),
    `physical_science core filters should include 9-12 ${strandCode}`
  );
}

assert.ok(
  hasFilter(physicalScience.activeSupportingFilters, { gradeBand: '9-12', strandCode: 'ETS1' }),
  'physical_science supporting filters should include 9-12 ETS1'
);

console.log(`Missouri standards bank checks passed (${bank.standards.length} standards)`);

function hasFilter(filters, expected) {
  return Array.isArray(filters) && filters.some((filter) => {
    return Object.entries(expected).every(([key, value]) => filter[key] === value);
  });
}

function normalizeMetadata(values) {
  return values.map((value) => String(value || '').toLowerCase());
}

function assertMetadataIncludes(standardId, expectedTerms, message) {
  const standard = bank.standards.find((item) => item.standardId === standardId);
  assert.ok(standard, `${standardId} should exist`);
  const metadata = normalizeMetadata([
    ...(standard.keywords || []),
    ...(standard.questionTriggers || []),
    ...(standard.relatedFormulas || [])
  ]).join(' | ');

  for (const term of expectedTerms) {
    assert.ok(metadata.includes(term), `${message}: missing ${term}`);
  }
}
