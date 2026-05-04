const assert = require('node:assert/strict');
const { matchQuestionToStandards } = require('../lib/standards/standardsMatcher');

const samples = [
  {
    question: 'What is density?',
    expectedConfidence: 'strong',
    expectedStandards: ['PS.MATTER.DENSITY']
  },
  {
    question: 'How do I calculate density from mass and volume?',
    expectedConfidence: 'strong',
    expectedStandards: ['PS.MATTER.DENSITY']
  },
  {
    question: 'Who was Mendeleev?',
    expectedConfidence: 'strong',
    expectedStandards: ['CHEM.PERIODIC_TABLE']
  },
  {
    question: 'What was Sputnik 1?',
    expectedConfidence: 'strong',
    expectedStandards: ['SCI_HISTORY.SPACE_RACE']
  },
  {
    question: "What is Newton's second law?",
    expectedConfidence: 'medium',
    expectedStandards: ['PS.FORCES.NEWTONS_LAWS']
  },
  {
    question: 'How does the internet work?',
    expectedConfidence: 'medium',
    expectedStandards: ['CS.INTERNET']
  },
  {
    question: 'What is a random unrelated question?',
    expectedConfidence: 'none',
    expectedStandards: []
  }
];

let passed = 0;

for (const sample of samples) {
  const result = matchQuestionToStandards(sample.question);
  const standardIds = result.standards.map((standard) => standard.standardId);

  assert.equal(
    result.confidence,
    sample.expectedConfidence,
    `${sample.question} expected confidence ${sample.expectedConfidence} but got ${result.confidence}`
  );

  for (const expectedStandard of sample.expectedStandards) {
    assert.ok(
      standardIds.includes(expectedStandard),
      `${sample.question} expected standard ${expectedStandard} but got ${standardIds.join(', ') || 'none'}`
    );
  }

  passed += 1;
  printResult(result);
}

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
