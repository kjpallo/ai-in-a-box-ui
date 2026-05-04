const assert = require('node:assert/strict');
const { buildStandardsLogMetadata } = require('../lib/standards/standardsLogMetadata');

const metadata = buildStandardsLogMetadata('What is density?');

assert.ok(Array.isArray(metadata.matchedConcepts), 'matchedConcepts should be an array');
assert.ok(Array.isArray(metadata.standards), 'standards should be an array');
assert.ok(Array.isArray(metadata.units), 'units should be an array');
assert.ok(metadata.standardsConfidence, 'standardsConfidence should exist');
assert.equal(metadata.confidence, undefined, 'standards metadata should not overwrite router confidence');

for (const concept of metadata.matchedConcepts) {
  assert.deepEqual(
    Object.keys(concept).sort(),
    ['id', 'score', 'title', 'type', 'unit'].sort(),
    'matchedConcepts should only contain compact fields'
  );
}

for (const standard of metadata.standards) {
  assert.deepEqual(
    Object.keys(standard).sort(),
    ['standardId', 'unit', 'label'].sort(),
    'standards should only contain compact fields'
  );
}

const failed = buildStandardsLogMetadata('What is density?', {
  matcher() {
    throw new Error('simulated matcher failure');
  }
});

assert.deepEqual(failed.matchedConcepts, [], 'failure should return empty matchedConcepts');
assert.deepEqual(failed.standards, [], 'failure should return empty standards');
assert.deepEqual(failed.units, [], 'failure should return empty units');
assert.equal(failed.standardsConfidence, 'none', 'failure should return none confidence');
assert.equal(failed.standardsError, 'simulated matcher failure', 'failure should include error message');

console.log('Standards log metadata shape checks passed');
console.log(JSON.stringify(metadata, null, 2));
