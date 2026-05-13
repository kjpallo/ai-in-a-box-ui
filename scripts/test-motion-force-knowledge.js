const assert = require('node:assert/strict');
const path = require('node:path');

const knowledgePath = path.join(__dirname, '..', 'lib', 'knowledge', 'physics', 'motion-force');
const motionForce = require(knowledgePath);

const {
  vocabulary,
  formulas,
  concepts,
  graphPatterns,
  problemBank,
  smokeTests
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

console.log('Motion and Force knowledge validation passed.');
console.log(`Validated ${vocabulary.length} vocab entries, ${formulas.length} formulas, ${concepts.length} concepts, ${graphPatterns.length} graph patterns, ${problemBank.length} problems, and ${smokeTests.length} smoke tests.`);
