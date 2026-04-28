const assert = require('node:assert/strict');
const { routeStudentQuestion } = require('../lib/questionRouter');

const tests = [
  {
    name: 'math only',
    question: 'What is 8 times 12?',
    type: 'math_only',
    includes: ['96']
  },
  {
    name: 'chemistry formula',
    question: 'What is NaCl?',
    type: 'chemistry_formula',
    includes: ['sodium chloride']
  },
  {
    name: 'motion distance from speed and time',
    question: 'If I travel for five hours at a speed of 20 mph what is my distance?',
    type: 'science_formula',
    includes: ['distance = speed × time', '100 miles']
  },
  {
    name: 'acceleration from velocity change',
    question: 'A car goes from 10 m/s to 30 m/s in 5 seconds. What is acceleration?',
    type: 'science_formula',
    includes: ['a = (30 m/s - 10 m/s) / 5 s', '4 m/s²']
  },
  {
    name: 'force from mass and acceleration',
    question: 'What is force if mass is 10 kg and acceleration is 4 m/s^2?',
    type: 'science_formula',
    includes: ['F = m × a.', '40 N']
  }
];

let passed = 0;

for (const test of tests) {
  const route = routeStudentQuestion(test.question, []);
  const answerText = String(route.directAnswer || '');

  try {
    assert.equal(route.type, test.type);

    for (const expected of test.includes) {
      assert.ok(
        answerText.includes(expected),
        `Expected answer to include "${expected}" but got:\n${answerText}`
      );
    }

    passed += 1;
    console.log(`✅ ${test.name}`);
  } catch (error) {
    console.error(`❌ ${test.name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`\n${passed}/${tests.length} router tests passed.`);
process.exit(0);
