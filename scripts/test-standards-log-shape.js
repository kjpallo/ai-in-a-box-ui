const assert = require('node:assert/strict');
const { buildStandardsLogMetadata } = require('../lib/standards/standardsLogMetadata');

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
].sort();

const densityDefinition = buildStandardsLogMetadata('What is density?');
assertHasConcept(densityDefinition, 'density-formula', 'density definition should match the density concept');
assert.deepEqual(densityDefinition.primaryStandards, [], 'density definition should not log a primary standard');
assert.deepEqual(densityDefinition.standards, [], 'legacy standards should mirror empty primaryStandards');
assert.ok(
  ['medium', 'strong'].includes(densityDefinition.conceptConfidence),
  'density definition should have concept confidence'
);
assert.equal(densityDefinition.standardsConfidence, 'none', 'concept-only density should not inflate standardsConfidence');

const densityContext = buildStandardsLogMetadata('How can density help identify or compare substances?');
assertHasConcept(densityContext, 'density-formula', 'density context should match the density concept');
if (densityContext.possibleStandards.length > 0) {
  assertHasStandard(
    densityContext.possibleStandards,
    '9-12.PS1.A.3',
    'density context possibleStandards should include 9-12.PS1.A.3 when possible standards are present'
  );
}
assert.notEqual(
  densityContext.standardsConfidence,
  'strong',
  'density context should not have strong standards confidence without strong primary evidence'
);

const sputnik = buildStandardsLogMetadata('What was Sputnik 1?');
if (sputnik.matchedConcepts.length > 0) {
  assertHasConcept(sputnik, 'sputnik-1-launch', 'Sputnik should match the Sputnik concept when concepts are present');
}
assert.deepEqual(sputnik.primaryStandards, [], 'Sputnik history should not log a physical science primary standard');
assert.deepEqual(sputnik.standards, [], 'Sputnik legacy standards should mirror empty primaryStandards');
assert.ok(
  ['none', 'weak', 'medium'].includes(sputnik.conceptConfidence),
  'Sputnik concept confidence should stay in conceptConfidence'
);
assert.equal(sputnik.standardsConfidence, 'none', 'Sputnik should not inflate standardsConfidence');

const newton = buildStandardsLogMetadata("What is Newton's second law?");
assertHasStandard(newton.primaryStandards, '9-12.PS2.A.1', "Newton's second law should have a primary standard");
assert.deepEqual(newton.standards, newton.primaryStandards, 'legacy standards should mirror primaryStandards');
assert.equal(newton.standardsConfidence, 'strong', "Newton's second law should have strong standards confidence");
assert.ok(
  ['none', 'weak', 'medium', 'strong'].includes(newton.conceptConfidence),
  'Newton concept confidence should be a valid confidence value'
);

const electricCurrent = buildStandardsLogMetadata('How does an electric current make a magnetic field?');
assertHasStandard(
  electricCurrent.primaryStandards,
  '9-12.PS2.B.2',
  'electric current and magnetic field should have a primary standard'
);
assert.equal(electricCurrent.standardsConfidence, 'strong', 'electric current should have strong standards confidence');

const failed = buildStandardsLogMetadata('What is density?', {
  matcher() {
    throw new Error('simulated matcher failure');
  }
});

assert.deepEqual(failed.matchedConcepts, [], 'failure should return empty matchedConcepts');
assert.deepEqual(failed.primaryStandards, [], 'failure should return empty primaryStandards');
assert.deepEqual(failed.possibleStandards, [], 'failure should return empty possibleStandards');
assert.deepEqual(failed.standards, [], 'failure should return empty standards');
assert.deepEqual(failed.units, [], 'failure should return empty units');
assert.equal(failed.conceptConfidence, 'none', 'failure should return none concept confidence');
assert.equal(failed.standardsConfidence, 'none', 'failure should return none standards confidence');
assert.equal(failed.possibleStandardsConfidence, 'none', 'failure should return none possible standards confidence');
assert.equal(failed.standardsError, 'simulated matcher failure', 'failure should include error message');

for (const metadata of [densityDefinition, densityContext, sputnik, newton, electricCurrent, failed]) {
  assert.ok(Array.isArray(metadata.matchedConcepts), 'matchedConcepts should be an array');
  assert.ok(Array.isArray(metadata.primaryStandards), 'primaryStandards should be an array');
  assert.ok(Array.isArray(metadata.possibleStandards), 'possibleStandards should be an array');
  assert.ok(Array.isArray(metadata.standards), 'standards should be an array');
  assert.ok(Array.isArray(metadata.units), 'units should be an array');
  assert.equal(metadata.confidence, undefined, 'standards metadata should not overwrite router confidence');
  assert.equal(metadata.courseProfileId || 'physical_science', 'physical_science');
  assert.equal(metadata.standardsBankId || 'missouri_science_6_12', 'missouri_science_6_12');
  assert.equal(metadata.matcherVersion, 'phase7d');

  for (const concept of metadata.matchedConcepts) {
    assert.deepEqual(
      Object.keys(concept).sort(),
      ['id', 'score', 'title', 'type', 'unit'].sort(),
      'matchedConcepts should only contain compact fields'
    );
  }

  for (const standard of [...metadata.primaryStandards, ...metadata.possibleStandards, ...metadata.standards]) {
    assert.deepEqual(
      Object.keys(standard).sort(),
      STANDARD_KEYS,
      'standards should only contain compact safe fields'
    );
  }
}

console.log('Standards log metadata shape checks passed');
console.log(JSON.stringify({ densityDefinition, sputnik, newton, electricCurrent }, null, 2));

function assertHasConcept(metadata, conceptId, message) {
  assert.ok(
    metadata.matchedConcepts.some((concept) => concept.id === conceptId),
    message
  );
}

function assertHasStandard(standards, standardId, message) {
  assert.ok(
    standards.some((standard) => standard.standardId === standardId),
    message
  );
}
