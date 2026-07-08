const assert = require('node:assert/strict');
const path = require('node:path');

const { tryScienceFormula } = require('../lib/formulas/scienceFormulaTools');
const knowledgePath = path.join(__dirname, '..', 'lib', 'knowledge', 'physics', 'motion-force');
const motionForce = require(knowledgePath);
const { tryMotionForceKnowledge } = require('../lib/knowledge/physics/motion-force/motionForceKnowledge');
const {
  buildAccelerationConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');

const {
  vocabulary,
  formulas,
  concepts,
  graphPatterns,
  problemBank,
  smokeTests,
  MOTION_FORCE_PACKET
} = motionForce;

function assertArray(name, value) {
  assert.ok(Array.isArray(value), `${name} should export an array`);
  assert.ok(value.length > 0, `${name} should not be empty`);
}

function assertNonEmptyString(value, message) {
  assert.equal(typeof value, 'string', message);
  assert.ok(value.trim().length > 0, message);
}

function assertStringArray(value, message) {
  assert.ok(Array.isArray(value), message);
  assert.ok(value.length > 0, message);
  value.forEach((item) => assertNonEmptyString(item, message));
}

function assertNoDuplicates(items, getValue, label) {
  const seen = new Set();
  items.forEach((item) => {
    const value = getValue(item);
    const normalized = String(value).trim().toLowerCase();
    assert.ok(!seen.has(normalized), `Duplicate ${label}: ${value}`);
    seen.add(normalized);
  });
}

assertArray('vocabulary', vocabulary);
assertArray('formulas', formulas);
assertArray('concepts', concepts);
assertArray('graphPatterns', graphPatterns);
assertArray('problemBank', problemBank);
assertArray('smokeTests', smokeTests);
assertMotionForcePacketShape();

vocabulary.forEach((entry) => {
  assertNonEmptyString(entry.id, 'Vocab entries need an id');
  assertNonEmptyString(entry.term, `Vocab entry ${entry.id} needs a term`);
  assertNonEmptyString(entry.definition, `Vocab entry ${entry.id} needs a student-friendly definition`);
  assert.ok(
    entry.definition.length <= 240,
    `Vocab definition should stay classroom-friendly and short: ${entry.term}`
  );
});

formulas.forEach((entry) => {
  assertNonEmptyString(entry.id, 'Formula entries need an id');
  assertNonEmptyString(entry.name, `Formula ${entry.id} needs a name`);
  assertNonEmptyString(entry.equation, `Formula ${entry.name} needs an equation`);
  assertStringArray(entry.solveFor, `Formula ${entry.name} needs solveFor values`);
  assertStringArray(entry.triggerPhrases, `Formula ${entry.name} needs trigger phrases`);
});

concepts.forEach((entry) => {
  assertNonEmptyString(entry.id, 'Concept entries need an id');
  assertNonEmptyString(entry.concept, `Concept ${entry.id} needs a concept label`);
  assertNonEmptyString(entry.learningTarget, `Concept ${entry.id} needs a learning target`);
  assertNonEmptyString(entry.studentFriendlyRule, `Concept ${entry.id} needs a student-friendly rule`);
});

graphPatterns.forEach((entry) => {
  assertNonEmptyString(entry.id, 'Graph pattern entries need an id');
  assertNonEmptyString(entry.graphType, `Graph pattern ${entry.id} needs a graph type`);
  assertNonEmptyString(entry.visualPattern, `Graph pattern ${entry.id} needs a visual pattern`);
  assertNonEmptyString(entry.meaning, `Graph pattern ${entry.id} needs a meaning`);
  assertNonEmptyString(entry.responseRule, `Graph pattern ${entry.id} needs a response rule`);
});

problemBank.forEach((entry) => {
  assertNonEmptyString(entry.id, 'Problem bank rows need an id');
  assertNonEmptyString(entry.question, `Problem ${entry.id} needs a question`);
  assertNonEmptyString(entry.expectedAnswer, `Problem ${entry.id} needs an expected answer`);
  assertNonEmptyString(entry.skill, `Problem ${entry.id} needs a skill`);
  assertNonEmptyString(entry.answerType, `Problem ${entry.id} needs an answer type`);
});

smokeTests.forEach((entry) => {
  assertNonEmptyString(entry.id, 'Smoke tests need an id');
  assertNonEmptyString(entry.query, `Smoke test ${entry.id} needs a query`);
  assertNonEmptyString(entry.expectedRoute, `Smoke test ${entry.id} needs an expected route`);
  assertNonEmptyString(entry.expectedTool, `Smoke test ${entry.id} needs an expected tool`);
  assertNonEmptyString(entry.expectedCoreAnswer, `Smoke test ${entry.id} needs an expected core answer`);
});

assertNoDuplicates(vocabulary, (entry) => entry.id, 'vocab id');
assertNoDuplicates(vocabulary, (entry) => entry.term, 'vocab term');
assertNoDuplicates(formulas, (entry) => entry.name, 'formula name');

assertVocabDefinition('force', /push or pull one object exerts on another/i);
assertVocabDefinition('balanced_forces', /equal in size and opposite in direction/i);
assertVocabDefinition('unbalanced_forces', /net force is not 0/i);
assertVocabDefinition('friction', /resists motion/i);
assertVocabDefinition('air_resistance', /speed, shape\/frontal area\/surface area/i);
assertVocabDefinition('free_fall', /constant acceleration/i);
assertVocabDefinition('normal_force', /support force/i);
assertVocabDefinition('terminal_velocity', /net force and acceleration are 0/i);
assertVocabDefinition('momentum', /Mass in motion/i);
assertVocabDefinition('weight', /force of gravity/i);
assertRepresentativeMotionForceBehavior();

console.log('Motion and Force knowledge validation passed.');
console.log(`Validated ${vocabulary.length} vocab entries, ${formulas.length} formulas, ${concepts.length} concepts, ${graphPatterns.length} graph patterns, ${problemBank.length} problems, and ${smokeTests.length} smoke tests.`);

function assertVocabDefinition(id, pattern) {
  const entry = vocabulary.find((item) => item.id === id);
  assert.ok(entry, `Missing vocab entry ${id}`);
  assert.match(entry.definition, pattern, `Vocab entry ${id} should include Concept 3 source-of-truth wording`);
}

function assertMotionForcePacketShape() {
  assert.ok(MOTION_FORCE_PACKET, 'MOTION_FORCE_PACKET should be exported');
  assert.equal(MOTION_FORCE_PACKET.packetId, 'motion-force');
  assert.equal(MOTION_FORCE_PACKET.title, 'Motion and Force');
  assert.equal(MOTION_FORCE_PACKET.unitTitle, 'Motion and Force');
  assert.equal(MOTION_FORCE_PACKET.subject, 'science');
  assert.equal(MOTION_FORCE_PACKET.vocabulary, vocabulary);
  assert.equal(MOTION_FORCE_PACKET.formulas, formulas);
  assert.equal(MOTION_FORCE_PACKET.concepts, concepts);
  assert.equal(MOTION_FORCE_PACKET.graphPatterns, graphPatterns);
  assert.equal(MOTION_FORCE_PACKET.problemBank, problemBank);
  assert.equal(MOTION_FORCE_PACKET.smokeTests, smokeTests);
  assert.equal(MOTION_FORCE_PACKET.smokePrompts, smokeTests);
  assert.equal(MOTION_FORCE_PACKET.counts.vocabulary, vocabulary.length);
  assert.equal(MOTION_FORCE_PACKET.counts.formulas, formulas.length);
  assert.equal(MOTION_FORCE_PACKET.counts.concepts, concepts.length);
  assert.equal(MOTION_FORCE_PACKET.counts.smokePrompts, smokeTests.length);
  assert.equal(
    MOTION_FORCE_PACKET.counts.examples,
    vocabulary.reduce((total, entry) => total + (Array.isArray(entry.examples) ? entry.examples.length : 0), 0)
  );
  assert.ok(Array.isArray(MOTION_FORCE_PACKET.formulaTutorHooks), 'Motion/Force packet should expose formula route hooks');
  assert.ok(
    MOTION_FORCE_PACKET.formulaTutorHooks.some((hook) => hook.module === 'lib/formulas/force.js' && hook.exports.includes('tryForce')),
    'Motion/Force packet should map to existing force formula routes'
  );
  assert.ok(Array.isArray(MOTION_FORCE_PACKET.conceptTutorHooks), 'Motion/Force packet should expose Concept Tutor hooks');
  assert.ok(
    MOTION_FORCE_PACKET.conceptTutorHooks.some((hook) => hook.id === 'motion-force.acceleration.identification'),
    'Motion/Force packet should map to existing acceleration Concept Tutor hook'
  );
  assert.equal(MOTION_FORCE_PACKET.legacyExports.vocabulary, 'vocabulary');
  assert.equal(MOTION_FORCE_PACKET.legacyExports.formulas, 'formulas');
  assert.equal(MOTION_FORCE_PACKET.legacyExports.concepts, 'concepts');
  assert.equal(MOTION_FORCE_PACKET.legacyExports.smokeTests, 'smokeTests');
  assert.equal(MOTION_FORCE_PACKET.legacyExports.matcher, 'tryMotionForceKnowledge');
  assert.equal(MOTION_FORCE_PACKET.directKnowledgeMatcher, 'tryMotionForceKnowledge');
  assert.ok(MOTION_FORCE_PACKET.metadata.generatedFromExistingMotionForceDataOnly);
  assert.equal(MOTION_FORCE_PACKET.metadata.missing.canonicalFacts, 'not exposed as a separate canonical-fact collection');
}

function assertRepresentativeMotionForceBehavior() {
  const direct = tryMotionForceKnowledge('what is friction');
  assert.equal(direct.type, 'definition', 'Representative direct Force/Motion prompt should still answer directly');
  assert.match(direct.directAnswer, /Friction is a force that resists motion/i);

  const formula = tryScienceFormula('force for 12 kg accelerating at 4 m/s2');
  assert.equal(formula.formulaWork.formulaId, 'force_mass_acceleration');
  assert.match(formula.answer, /F = 48 N/i);

  const conceptTutor = buildAccelerationConceptTutorPattern('Is a car speeding up acceleration?');
  assert.equal(conceptTutor.id, 'motion-force.acceleration.identification');
  assert.equal(conceptTutor.steps[0].correctAnswer, 'speeding up');
}
