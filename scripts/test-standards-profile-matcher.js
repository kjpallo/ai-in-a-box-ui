const assert = require('node:assert/strict');
const { matchQuestionToStandards } = require('../lib/standards/standardsMatcher');

const options = { courseProfileId: 'physical_science' };

assertStrongPrimary(
  "What is Newton's second law?",
  '9-12.PS2.A.1',
  'core'
);

assertStrongPrimary(
  'How do I calculate wave speed from frequency and wavelength?',
  '9-12.PS4.A.1',
  'core'
);

assertStrongPrimary(
  'What does the periodic table tell us about reactivity?',
  '9-12.PS1.A.1',
  'core'
);

const densityDefinition = matchQuestionToStandards('What is density?', options);
assert.ok(
  densityDefinition.matchedConcepts.some((concept) => concept.id === 'density-formula'),
  'density definition should match the density concept/formula'
);
assertNoPrimary(densityDefinition, '9-12.PS1.A.1', 'bare density should not primary-match periodic table standard');

const densityCompare = matchQuestionToStandards('How can density help identify or compare substances?', options);
assert.ok(
  allStandardIds(densityCompare).includes('9-12.PS1.A.3'),
  'density as an identifying/comparison property may connect to 9-12.PS1.A.3'
);
assertNoPrimary(densityCompare, '9-12.PS1.A.1', 'density property context should not match PS1.A.1');
assert.equal(densityCompare.confidence, 'medium', 'density property context should remain medium without a primary standard');

const climateChange = matchQuestionToStandards('What is climate change?', options);
assertNoActivePrimary(climateChange, 'climate change should not primary-match core/supporting physical science');
assert.ok(
  (climateChange.possibleStandards || []).some((standard) => {
    return standard.domainCode === 'ESS' && ['available_off', 'out_of_course'].includes(standard.courseRelevance);
  }),
  'climate change may appear as earth/space science possible/off-course'
);

const bareEnergy = matchQuestionToStandards('What is energy?', options);
assert.notEqual(bareEnergy.confidence, 'strong', 'bare energy should not create strong standards confidence');
assert.ok(
  bareEnergy.standards.filter((standard) => standard.strandCode === 'PS3').length < 5,
  'bare energy should not primary-match all PS3 standards'
);

const currentMagnetic = matchQuestionToStandards('How does an electric current make a magnetic field?', options);
assert.equal(currentMagnetic.standards[0]?.standardId, '9-12.PS2.B.2', 'current/magnetic field should top-match PS2.B.2');
for (const rejectedId of ['9-12.PS2.A.2', '9-12.PS2.A.3', '9-12.PS2.B.1']) {
  assertNoPrimary(currentMagnetic, rejectedId, `current/magnetic field should not primary-match ${rejectedId}`);
}

const bareForce = matchQuestionToStandards('What is force?', options);
assert.notEqual(bareForce.confidence, 'strong', 'bare force should not create strong standards confidence');
assert.ok(
  bareForce.standards.filter((standard) => standard.strandCode === 'PS2').length < 2,
  'bare force should not primary-match multiple unrelated PS2 standards'
);

assertStrongPrimary('What is conservation of momentum?', '9-12.PS2.A.2', 'core');
assertStrongPrimary('How do mass and distance affect gravitational force?', '9-12.PS2.B.1', 'core');

assertStrongPrimary('What is chemical equilibrium?', '9-12.PS1.B.2', 'core');
assertNoPrimary(
  matchQuestionToStandards('What is chemical equilibrium?', options),
  '9-12.PS1.A.1',
  'equilibrium should not primary-match PS1.A.1'
);

assertStrongPrimary('What is radioactive decay?', '9-12.PS1.C.1', 'core');
assertNoPrimary(
  matchQuestionToStandards('What is radioactive decay?', options),
  '9-12.PS1.A.1',
  'radioactive decay should not primary-match PS1.A.1'
);

const densityCalculation = matchQuestionToStandards('How do I calculate density from mass and volume?', options);
assert.ok(
  densityCalculation.matchedConcepts.some((concept) => concept.id === 'density-formula'),
  'density calculation should match the density concept/formula'
);
assert.equal(densityCalculation.standards.length, 0, 'density calculation should not primary-match standards');
assertNoPrimary(
  densityCalculation,
  '9-12.PS2.A.1',
  'density calculation should not produce force/motion primary standards from mass alone'
);
assert.equal(
  (densityCalculation.possibleStandards || []).some((standard) => {
    return standard.standardId && standard.standardId.startsWith('9-12.PS2.');
  }),
  false,
  'density calculation should not produce possible PS2 force/motion standards from mass alone'
);

const sputnikHistory = matchQuestionToStandards('What was Sputnik 1?', options);
assert.equal(
  sputnikHistory.standards.some((standard) => standard.strandCode === 'ETS1'),
  false,
  'plain Sputnik history should not primary-match engineering'
);
assert.notEqual(sputnikHistory.confidence, 'strong', 'plain Sputnik history should not create strong standards confidence');

const sputnikEngineering = matchQuestionToStandards('How did engineers design Sputnik to survive orbit?', options);
assert.ok(
  sputnikEngineering.standards.some((standard) => {
    return standard.strandCode === 'ETS1' && standard.courseRelevance === 'supporting';
  }),
  'Sputnik engineering design context should include ETS1 supporting standards'
);

const bumper = matchQuestionToStandards('How do we design a safer bumper for a collision?', options);
const bumperIds = allStandardIds(bumper);
assert.equal(bumper.confidence, 'strong', 'bumper design should be a strong standards match');
assert.ok(
  bumperIds.includes('9-12.ETS1.B.1') || bumperIds.includes('9-12.PS2.A.3'),
  `bumper design should include 9-12.ETS1.B.1 or 9-12.PS2.A.3, got ${bumperIds.join(', ')}`
);
assert.ok(
  [...bumper.standards, ...bumper.possibleStandards].some((standard) => standard.classroomArea === 'Engineering'),
  'bumper design should include engineering as a reasonable match'
);

const dna = matchQuestionToStandards('What is DNA?', options);
assert.equal(
  dna.standards.some((standard) => standard.courseRelevance === 'core'),
  false,
  'DNA should not become a core physical science match by default'
);
assert.ok(
  (dna.possibleStandards || []).some((standard) => {
    return standard.domainCode === 'LS' && ['available_off', 'out_of_course'].includes(standard.courseRelevance);
  }),
  'DNA may appear as an inactive life science possible match'
);

const seasons = matchQuestionToStandards('What causes seasons?', options);
assert.equal(
  seasons.standards.some((standard) => standard.courseRelevance === 'core'),
  false,
  'seasons should not become a core physical science match by default'
);
assert.ok(
  (seasons.possibleStandards || []).some((standard) => {
    return standard.domainCode === 'ESS' && ['available_off', 'out_of_course'].includes(standard.courseRelevance);
  }),
  'seasons may appear as an inactive earth/space possible match'
);

console.log('Standards profile matcher checks passed');
console.log('Newton example:', JSON.stringify(matchQuestionToStandards("What is Newton's second law?", options).standards[0], null, 2));
console.log('DNA possible example:', JSON.stringify(dna.possibleStandards[0], null, 2));

function assertStrongPrimary(question, expectedStandardId, expectedRelevance) {
  const result = matchQuestionToStandards(question, options);
  const top = result.standards[0];

  assert.equal(result.confidence, 'strong', `${question} should be a strong match`);
  assert.ok(top, `${question} should return at least one primary standard`);
  assert.equal(top.standardId, expectedStandardId, `${question} should top-match ${expectedStandardId}`);
  assert.equal(top.courseRelevance, expectedRelevance, `${question} should match ${expectedRelevance}`);
}

function assertNoPrimary(result, rejectedStandardId, message) {
  assert.equal(
    result.standards.some((standard) => standard.standardId === rejectedStandardId),
    false,
    message
  );
}

function assertNoActivePrimary(result, message) {
  assert.equal(
    result.standards.some((standard) => {
      return ['core', 'supporting'].includes(standard.courseRelevance);
    }),
    false,
    message
  );
}

function allStandardIds(result) {
  return [...(result.standards || []), ...(result.possibleStandards || [])]
    .map((standard) => standard.standardId);
}
