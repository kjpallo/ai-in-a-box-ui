'use strict';

const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const FORMULA_CASES = [
  {
    name: 'reported-traveling-distance-time',
    prompt: 'what is the speed of a car that is traveling 8 m in 30 seconds?',
    requestedUnit: 'm/s',
    finalUnit: 'm/s'
  },
  {
    name: 'si-distance-time',
    prompt: 'what is the speed of a car that travelled 20 m in 5 sec',
    requestedUnit: 'm/s',
    finalUnit: 'm/s'
  },
  {
    name: 'traveled-miles-minutes',
    prompt: 'what is the speed of a truck that traveled 5 miles in 4 minutes',
    requestedUnit: 'mi/min',
    finalUnit: 'mile/min'
  },
  {
    name: 'covered-miles-minutes-punctuation',
    prompt: 'what is the speed of a truck that covered 5 miles in 4 minutes?',
    requestedUnit: 'mi/min',
    finalUnit: 'mile/min'
  },
  {
    name: 'travels-miles-minutes',
    prompt: 'what is the speed of a truck that travels 5 miles in 4 minutes',
    requestedUnit: 'mi/min',
    finalUnit: 'mile/min'
  },
  {
    name: 'minutes-abbreviation',
    prompt: 'what is the speed of a truck that covered 5 miles in 4 min',
    requestedUnit: 'mi/min',
    finalUnit: 'mile/min'
  },
  {
    name: 'singular-mile-minute',
    prompt: 'what is the speed of a truck that traveled 1 mile in 1 minute',
    requestedUnit: 'mi/min',
    finalUnit: 'mile/min'
  },
  {
    name: 'original-minets-and-object-noun',
    prompt: 'what is the speed of a track that covered 5 miles in 4 minets',
    requestedUnit: 'mi/min',
    finalUnit: 'mile/min'
  }
];

const DEFINITION_CASES = [
  'what is speed?',
  'define speed',
  'what does speed mean'
];

async function main() {
  const harness = createStudentRouteHarness({
    studentGuidedFormulaTutoringEnabled: true
  });
  const create = await harness.request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);

  for (const testCase of FORMULA_CASES) {
    assertCanonicalFormulaRoute(harness, testCase);

    const response = await harness.request('POST', '/api/student/message', {
      sessionId: create.body.sessionId,
      studentHubId: `speed-formula-${testCase.name}`,
      message: testCase.prompt
    });

    assert.equal(response.statusCode, 200, testCase.name);
    assert.equal(
      response.body.routeType,
      'formula_tutor',
      `${testCase.name} should enter Formula Tutor through /api/student/message`
    );
    assert.equal(response.body.confidence, 'strong');
    assert.equal(response.body.tutor?.active, true);
    assert.equal(response.body.tutor?.formulaId, 'speed_distance_time');
    assert.equal(response.body.tutor?.originalQuestion, testCase.prompt);
    assert.doesNotMatch(response.body.response, /\bDefinition\b|Speed tells how fast/i);
  }

  for (const [index, prompt] of DEFINITION_CASES.entries()) {
    const response = await harness.request('POST', '/api/student/message', {
      sessionId: create.body.sessionId,
      studentHubId: `speed-definition-${index}`,
      message: prompt
    });

    assert.equal(response.statusCode, 200, prompt);
    assert.equal(response.body.routeType, 'definition', `${prompt} should remain a definition`);
    assert.equal(response.body.tutor, undefined, `${prompt} should not start a tutor`);
    assert.match(response.body.response, /speed/i);
  }

  await assertUnsupportedUnitDoesNotFallBackToDefinition(harness, create.body.sessionId);

  console.log(
    'PASS speed formula routing regressions: supported distance/time wording enters Formula Tutor and conceptual speed questions remain definitions'
  );
}

function assertCanonicalFormulaRoute(harness, testCase) {
  const routed = harness.questionAnswer.routeMessage(testCase.prompt);

  assert.equal(routed.questionContract.taskType, 'calculation', testCase.name);
  assert.equal(routed.questionContract.targetConcept, 'speed', testCase.name);
  assert.deepEqual(routed.questionContract.requestedUnits, [testCase.requestedUnit], testCase.name);
  assert.ok(
    routed.questionContract.numericalGivens.some((given) => given.role === 'distance'),
    `${testCase.name} should extract distance`
  );
  assert.ok(
    routed.questionContract.numericalGivens.some((given) => given.role === 'time'),
    `${testCase.name} should extract time`
  );
  assert.equal(routed.answerValidation.valid, true, testCase.name);
  assert.equal(routed.questionRoute.type, 'science_formula', testCase.name);
  assert.equal(routed.questionRoute.formulaWork?.formulaId, 'speed_distance_time', testCase.name);
  assert.equal(routed.questionRoute.formulaWork?.solveFor, 'speed', testCase.name);
  assert.equal(routed.questionRoute.formulaWork?.finalAnswer?.unit, testCase.finalUnit, testCase.name);
}

async function assertUnsupportedUnitDoesNotFallBackToDefinition(harness, sessionId) {
  const prompt = 'what is the speed of a truck that traveled 5 miles in 4 blargs';
  const routed = harness.questionAnswer.routeMessage(prompt);

  assert.equal(routed.questionContract.taskType, 'calculation');
  assert.equal(routed.questionRoute.type, 'no_match');
  assert.equal(routed.answerValidation.reason, 'calculation_answer_is_definition');

  const response = await harness.request('POST', '/api/student/message', {
    sessionId,
    studentHubId: 'speed-unsupported-unit-boundary',
    message: prompt
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.routeType, 'no_match');
  assert.doesNotMatch(response.body.response, /Speed tells how fast/i);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
