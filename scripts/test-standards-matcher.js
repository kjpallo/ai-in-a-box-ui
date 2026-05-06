const assert = require('node:assert/strict');
const { matchQuestionToStandards } = require('../lib/standards/standardsMatcher');

const samples = [
  {
    question: 'What is density?',
    expectedConfidence: 'medium',
    expectedConcepts: ['density-formula'],
    rejectedPrimaryStandards: ['9-12.PS1.A.1']
  },
  {
    question: 'How do I calculate density from mass and volume?',
    expectedConfidence: 'medium',
    expectedConcepts: ['density-formula'],
    rejectedPrimaryStandards: ['9-12.PS1.A.1']
  },
  {
    question: 'Who was Mendeleev?',
    expectedConfidence: 'medium',
    expectedConcepts: ['dmitri-mendeleev'],
    rejectedPrimaryStandards: ['9-12.PS1.A.1']
  },
  {
    question: 'What was Sputnik 1?',
    expectedConfidence: 'medium',
    expectedConcepts: ['sputnik-1-launch'],
    rejectedPrimaryStandards: ['9-12.ESS1.B.1']
  },
  {
    question: "What is Newton's second law?",
    expectedConfidence: 'strong',
    expectedStandards: ['9-12.PS2.A.1']
  },
  {
    question: 'How does the internet work?',
    expectedConfidence: 'none',
    expectedStandards: []
  },
  {
    question: 'What is a random unrelated question?',
    expectedConfidence: 'none',
    expectedStandards: []
  }
];

let passed = 0;

for (const sample of samples) {
  const result = matchQuestionToStandards(sample.question, {
    includeInactiveStandards: Boolean(sample.includeInactiveStandards)
  });
  const standardIds = result.standards.map((standard) => standard.standardId);

  assert.equal(
    result.confidence,
    sample.expectedConfidence,
    `${sample.question} expected confidence ${sample.expectedConfidence} but got ${result.confidence}`
  );

  for (const expectedStandard of sample.expectedStandards || []) {
    assert.ok(
      standardIds.includes(expectedStandard) || allStandardIds(result).includes(expectedStandard),
      `${sample.question} expected standard ${expectedStandard} but got ${allStandardIds(result).join(', ') || 'none'}`
    );
  }

  for (const expectedConcept of sample.expectedConcepts || []) {
    assert.ok(
      result.matchedConcepts.some((concept) => concept.id === expectedConcept),
      `${sample.question} expected concept ${expectedConcept}`
    );
  }

  for (const rejectedStandard of sample.rejectedPrimaryStandards || []) {
    assert.equal(
      standardIds.includes(rejectedStandard),
      false,
      `${sample.question} should not primary-match ${rejectedStandard}`
    );
  }

  passed += 1;
  printResult(result);
}

const legacyResult = matchQuestionToStandards('How does the internet work?', { useSamplePack: true });
assert.ok(
  legacyResult.standards.some((standard) => standard.standardId === 'CS.INTERNET'),
  'legacy sample pack fallback should still be available when requested'
);

console.log(`\nStandards matcher samples: ${passed}/${samples.length} passed`);

function printResult(result) {
  const concepts = result.matchedConcepts
    .map((concept) => `${concept.title} (${concept.id}, score ${concept.score})`)
    .join('; ') || 'none';

  const standards = result.standards
    .map((standard) => `${standard.standardId} - ${standard.label}`)
    .join('; ') || 'none';

  const units = result.units.join(', ') || 'none';

  console.log('\nQuestion:', result.question);
  console.log('Confidence:', result.confidence);
  console.log('Concepts:', concepts);
  console.log('Standards:', standards);
  console.log('Units:', units);
}

function allStandardIds(result) {
  return [...(result.standards || []), ...(result.possibleStandards || [])]
    .map((standard) => standard.standardId);
}
