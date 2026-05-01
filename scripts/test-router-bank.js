const assert = require('node:assert/strict');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { routerTestBank } = require('../tests/routerTestBank');

const categoryCounts = new Map();
const categoryPassed = new Map();
let passed = 0;
let failed = 0;
const failures = [];

for (const test of routerTestBank) {
  categoryCounts.set(test.category, (categoryCounts.get(test.category) || 0) + 1);

  const route = routeStudentQuestion(test.question, test.matchedKnowledge || []);
  const answerText = String(route.directAnswer || '');

  try {
    assert.equal(route.type, test.type, `Expected route type ${test.type} but got ${route.type}`);
    assert.equal(route.aiAllowed, test.aiAllowed, `Expected aiAllowed ${test.aiAllowed} but got ${route.aiAllowed}`);

    for (const expected of test.includes || []) {
      assert.ok(
        answerText.includes(expected),
        `Expected answer to include "${expected}" but got:\n${answerText}`
      );
    }

    for (const unexpected of test.excludes || []) {
      assert.ok(
        !answerText.includes(unexpected),
        `Expected answer not to include "${unexpected}" but got:\n${answerText}`
      );
    }

    passed += 1;
    categoryPassed.set(test.category, (categoryPassed.get(test.category) || 0) + 1);
    console.log(`✅ [${test.category}] ${test.name}`);
  } catch (error) {
    failed += 1;
    failures.push({ test, route, answerText, message: error.message });
    console.error(`❌ [${test.category}] ${test.name}`);
    console.error(`Question: ${test.question}`);
    console.error(`Route: ${JSON.stringify(route.public, null, 2)}`);
    console.error(`Answer:\n${answerText}`);
    console.error(error.message);
  }
}

console.log('\nRouter test bank summary');
console.log('========================');
for (const [category, total] of [...categoryCounts.entries()].sort()) {
  const ok = categoryPassed.get(category) || 0;
  console.log(`${category}: ${ok}/${total} passed`);
}
console.log(`\nTotal: ${passed}/${routerTestBank.length} passed`);

if (failed > 0) {
  console.log('\nFirst failures to patch:');
  for (const failure of failures.slice(0, 10)) {
    console.log(`- [${failure.test.category}] ${failure.test.name}`);
    console.log(`  ${failure.message.split('\n')[0]}`);
  }
  process.exit(1);
}

process.exit(0);
