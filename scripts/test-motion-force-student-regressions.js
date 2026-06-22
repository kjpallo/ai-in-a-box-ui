const assert = require('node:assert/strict');

const { findRelevantKnowledge, loadTeacherKnowledge } = require('../lib/knowledge/teacherKnowledge');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const {
  createStudentRouteHarness,
  teacherFactsFile
} = require('./test-helpers/studentRouteHarness');

const teacherKnowledge = loadTeacherKnowledge(teacherFactsFile);

const PJ_QUESTION = 'PJ likes to ride his bike around the block. If he rides out of his house west, the sidewalk circles his block, and brings him back to his doorstep 0.35 miles later. Find his distance and displacement.';
const MALI_QUESTION = 'Mali loves to make herself dizzy. She spins around in place 7 times before falling down right where she was standing. Find her distance and displacement.';
const KAI_QUESTION = 'Kai swims for the school swim team. He specializes in a backstroke event where he has to swim the 50-m length of the pool three times. Find his distance and displacement.';
const VELOCITY_QUESTION = 'Challenge: A car travels 240 miles south in 3 hours. Find the velocity of the car in mi/hr and m/s.';
const CAR_AD_ACCELERATION_QUESTION = 'A car advertisement claims that a certain car can accelerate from rest to 70 km/hr in 7 seconds (hint: convert to hours first!!) Find the car\u2019s acceleration.';
const CART_FINAL_SPEED_QUESTION = 'A cart rolling down an incline for 5.0 seconds has an acceleration of 4.0 m/s2. If the cart has an initial speed of 2.0 m/s, what is its final speed?';
const TRUCK_MASS_QUESTION = 'If a truck has 40,500 kg*m/s of momentum and is moving with a velocity of 90 m/s, what is the truck\u2019s mass?';
const SUITCASE_WEIGHT_QUESTION = 'Find the weight of a suitcase that has a mass of 42 kg.';

const tests = [
  testKnowledgePromptsAnswerDirectly,
  testPjBlockDistanceDisplacement,
  testMaliSpinDistanceDisplacement,
  testKaiPoolDistanceDisplacement,
  testVelocityInMilesPerHourAndMetersPerSecond,
  testAccelerationWithSecondsConvertedToHours,
  testFinalSpeedFormulaTutor,
  testMomentumMassFormulaTutor,
  testWeightFormulaTutor,
  testGuidedFormulaTutorOffAnswersDirectly
];

run();

async function run() {
  const results = [];

  for (const test of tests) {
    try {
      await test();
      results.push({ name: test.name, passed: true });
      console.log(`PASS ${test.name}`);
    } catch (error) {
      results.push({ name: test.name, passed: false, error });
      console.error(`FAIL ${test.name}`);
      console.error(`  ${error.stack || error.message}`);
    }
  }

  const passed = results.filter((result) => result.passed).length;
  const failed = results.filter((result) => !result.passed);

  console.log('');
  console.log(`Motion/force student regressions: ${passed} passed, ${failed.length} failed.`);

  if (failed.length > 0) {
    console.log('Failing checks:');
    failed.forEach((result) => console.log(`- ${result.name}: ${result.error.message}`));
    process.exitCode = 1;
  }
}

async function testKnowledgePromptsAnswerDirectly() {
  const cases = [
    {
      name: 'reference-point-direct',
      prompt: 'what is Reference point',
      routeTypes: ['definition', 'science_concept'],
      includes: [
        /reference point/i,
        /place|object|compar/i,
        /changed position|position/i
      ]
    },
    {
      name: 'motion-described-measured-summary',
      prompt: 'Summarize the different ways that motion can be described and measured.',
      includes: [
        /reference point/i,
        /distance/i,
        /displacement/i,
        /speed/i,
        /velocity/i,
        /acceleration/i,
        /graph|graphs/i,
        /slope/i
      ]
    },
    {
      name: 'velocity-time-slope',
      prompt: 'velocity vs. time graph, the slope of the line equals the object\u2019s',
      includes: [/acceleration/i]
    },
    {
      name: 'distance-time-slope',
      prompt: 'On a distance vs. time graph, the slope of the line equals the object\u2019s',
      includes: [/speed/i]
    },
    {
      name: 'positive-acceleration-speed-time',
      prompt: 'Positive acceleration look like on a speed vs time graph',
      includes: [/upward|increasing/i]
    },
    {
      name: 'negative-acceleration-speed-time',
      prompt: 'Negative acceleration looks like what on a speed vs time graph',
      includes: [/downward|decreasing/i]
    },
    {
      name: 'friction-nospace-direct',
      prompt: 'what isFriction',
      includes: [/friction/i, /force/i, /resists motion|opposes motion/i],
      excludes: [/electricity|electric current|electrons/i]
    },
    {
      name: 'friction-factors-direct',
      prompt: 'what are the 3 factors friction depend on?',
      includes: [
        /roughness/i,
        /force pressing (?:the )?(?:surfaces )?together|normal force/i,
        /surface area|contact area/i
      ]
    },
    {
      name: 'balanced-unbalanced-force-direct',
      prompt: 'balanced vs unbalanced force',
      includes: [
        /balanced/i,
        /net force (?:is )?0|cancel/i,
        /unbalanced/i,
        /nonzero net force|net force is not 0|change motion/i
      ]
    },
    {
      name: 'momentum-newton-third-law-direct',
      prompt: 'how is momentum related to newton 3rd law',
      includes: [
        /equal and opposite/i,
        /collision|collisions/i,
        /momentum (?:is )?(?:transferred|conserved)|conserved/i
      ]
    },
    {
      name: 'inertia-direct',
      prompt: 'what is Inertia',
      routeTypes: ['definition', 'science_concept'],
      includes: [/resistance to (?:a )?change in motion/i, /mass|more mass/i]
    },
    {
      name: 'air-resistance-direct',
      prompt: 'what is air resistance',
      routeTypes: ['definition', 'science_concept'],
      includes: [/drag|air resistance/i, /resists motion|opposite (?:the )?(?:object'?s )?motion|acts opposite/i]
    },
    {
      name: 'electric-current-resistance-direct',
      prompt: 'what is the thing that slow electricity or curent',
      includes: [/resistance|electrical resistance/i, /current|slows|resists/i]
    }
  ];

  const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });

  for (const testCase of cases) {
    const route = routeWithTeacherKnowledge(testCase.prompt);
    assertDirectKnowledgeRoute(route, testCase);

    const student = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
    assert.equal(student.statusCode, 200, `${testCase.name} student route status`);
    assert.notEqual(student.body.routeType, 'formula_tutor', `${testCase.name} should not start Formula Tutor`);
    assert.notEqual(
      student.body.routeType,
      'motion_force_knowledge_tutor',
      `${testCase.name} should not start General Tutor`
    );
    assertAnswer(student.body.response, testCase);
    assert.equal(
      harness.studentSessions[harness.sessionId].anonymousHubs[testCase.name].currentTutorProblem,
      null,
      `${testCase.name} should not leave tutor state`
    );
  }
}

async function testPjBlockDistanceDisplacement() {
  await assertPjRejectsZeroAtFinishStep();

  for (const answer of ['1', 'same', 'same place', 'the same place', 'same place (he returns home)', 'back where he started', 'back home', 'doorstep']) {
    const latest = await completePjRun(answer);
    assert.equal(latest.body.tutor.completed, true, `PJ should complete after ${answer}`);
    assert.match(latest.body.response, /0\.35 miles/i);
    assert.match(latest.body.response, /0 miles/i);
    assert.equal(latest.body.tutor.work.finalAnswer, 'distance = 0.35 miles; displacement = 0 miles');
  }
}

async function testMaliSpinDistanceDisplacement() {
  for (const answer of ['1', '1\\', '1.']) {
    const latest = await completeMaliRun(answer);
    assert.equal(latest.body.tutor.completed, true, `Mali should complete after ${answer}`);
    assert.match(latest.body.response, /Distance = 0/i);
    assert.match(latest.body.response, /Displacement = 0/i);
    assert.equal(latest.body.tutor.work.finalAnswer, 'distance = 0; displacement = 0');
  }
}

async function testKaiPoolDistanceDisplacement() {
  await assertKaiRetryPointsToChoice();

  for (const answer of ['2', 'opposite side', 'opposition side', 'different side']) {
    const latest = await completeKaiRun(answer);
    assert.equal(latest.body.tutor.completed, true, `Kai should complete after ${answer}`);
    assert.match(latest.body.response, /150 m/i);
    assert.match(latest.body.response, /50 m/i);
    assert.equal(latest.body.tutor.work.finalAnswer, 'distance = 150 m; displacement = 50 m');
  }
}

async function testVelocityInMilesPerHourAndMetersPerSecond() {
  for (const conversionAnswer of ['35.7', '35.76', '35.8', '35.7632']) {
    const name = `velocity-mihr-ms-${slug(conversionAnswer)}`;
    const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
    const start = await sendHarnessMessage(harness, name, VELOCITY_QUESTION);
    assertStartsFormulaTutor(start, name);

    await sendHarnessMessage(harness, name, '1');
    await sendHarnessMessage(harness, name, '1');
    await sendHarnessMessage(harness, name, '240 miles');
    await sendHarnessMessage(harness, name, '3 hours');

    const conversionPrompt = await sendHarnessMessage(harness, name, '80');
    assert.equal(conversionPrompt.body.tutor.stepId, 'convert_velocity_to_mps', `${name} should accept 80 mi/hr`);
    assert.doesNotMatch(
      conversionPrompt.body.tutor.work.calculatorCheck?.display || '',
      /80 \u00d7 0\.447 = 80/i,
      `${name} calculator check should not show the old bad conversion`
    );

    const final = await sendHarnessMessage(harness, name, conversionAnswer);
    assert.equal(final.body.tutor.completed, true, `${name} should complete after m/s conversion`);
    assert.match(final.body.response, /80 mi\/hr south/i);
    assert.match(final.body.response, /35\.76 m\/s south/i);
    assert.doesNotMatch(final.body.response, /write|type.*final sentence/i);
  }
}

async function testAccelerationWithSecondsConvertedToHours() {
  for (const [index, conversionAnswer] of ['2', '.001944', '0.001944', '0.0019', '7/3600'].entries()) {
    const final = await completeCarAdAccelerationAfterConversion(`car-ad-conversion-${index}`, conversionAnswer, '36000');
    assert.equal(final.body.tutor.completed, true, `car ad should solve after conversion answer ${conversionAnswer}`);
    assert.match(final.body.response, /km\/hr(?:\u00b2|\^2|2)/i);
  }

  for (const answer of ['36842', '36,842', '36000']) {
    const final = await completeCarAdAccelerationEarly(answer);
    assert.equal(final.body.tutor.completed, true, `car ad should accept ${answer}`);
    assert.match(final.body.response, /km\/hr(?:\u00b2|\^2|2)/i, `car ad final should use km/hr squared units for ${answer}`);
  }

  const rejected = await rejectCarAdAccelerationAtConversion('0.00277778');
  assert.equal(rejected.body.tutor.completed, false, 'car ad should not accept the time conversion as final acceleration');
  assert.equal(rejected.body.tutor.stepId, 'convert_time');
}

async function testFinalSpeedFormulaTutor() {
  const final = await completeFormulaRun({
    name: 'final-speed-cart',
    question: CART_FINAL_SPEED_QUESTION,
    steps: ['final velocity', '1', '2 m/s', '4 m/s2', '5 s', '22']
  });
  assert.match(final.body.response, /22 m\/s/i);
}

async function testMomentumMassFormulaTutor() {
  const final = await completeFormulaRun({
    name: 'truck-momentum-mass',
    question: TRUCK_MASS_QUESTION,
    steps: ['2', '1', '40500 kg*m/s', '90 m/s', '450']
  });
  assert.match(final.body.response, /450 kg/i);
  assert.doesNotMatch(final.body.response, /periodic table|atomic mass|element/i);
}

async function testWeightFormulaTutor() {
  const final = await completeFormulaRun({
    name: 'suitcase-weight',
    question: SUITCASE_WEIGHT_QUESTION,
    steps: ['1', '1', '42 kg', '9.8 m/s\u00b2', '411.6']
  });
  assert.match(final.body.response, /411\.6 N/i);
}

async function testGuidedFormulaTutorOffAnswersDirectly() {
  const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: false });
  const cases = [
    {
      name: 'final-speed-guided-off',
      question: CART_FINAL_SPEED_QUESTION,
      expected: /vf = 22 m\/s|final (?:velocity|speed).*22 m\/s/i
    },
    {
      name: 'weight-guided-off',
      question: SUITCASE_WEIGHT_QUESTION,
      expected: /411\.6 N/i
    }
  ];

  for (const testCase of cases) {
    const direct = await sendHarnessMessage(harness, testCase.name, testCase.question);
    assert.notEqual(direct.body.routeType, 'formula_tutor', `${testCase.name} should not start Formula Tutor`);
    assert.match(direct.body.response, testCase.expected, `${testCase.name} should answer directly`);
    assert.equal(
      harness.studentSessions[harness.sessionId].anonymousHubs[testCase.name].currentTutorProblem,
      null,
      `${testCase.name} should not leave tutor state`
    );
  }
}

async function assertPjRejectsZeroAtFinishStep() {
  const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
  const name = 'pj-reject-zero';
  let latest = await startFormulaTutor(harness, name, PJ_QUESTION);

  for (const setupAnswer of ['1', '1', '0.35']) {
    latest = await sendHarnessMessage(harness, name, setupAnswer);
  }

  assert.equal(latest.body.tutor.stepId, 'identify_finish_location');
  assertFormulaTutorChoices(latest.body, {
    name,
    expectedChoices: [
      /1\. Same place \/ back where he started/i,
      /2\. Opposite side \/ away from where he started/i,
      /3\. 0\.35 miles north/i
    ]
  });

  const rejected = await sendHarnessMessage(harness, name, '0');
  assert.equal(rejected.body.tutor.completed, false, 'PJ finish-location step should reject 0');
  assert.equal(rejected.body.tutor.stepId, 'identify_finish_location');
}

async function completePjRun(answer) {
  const name = `pj-${slug(answer)}`;
  const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
  let latest = await startFormulaTutor(harness, name, PJ_QUESTION);

  for (const setupAnswer of ['1', '1', '0.35']) {
    latest = await sendHarnessMessage(harness, name, setupAnswer);
  }

  assert.equal(latest.body.tutor.stepId, 'identify_finish_location');
  assertFormulaTutorChoices(latest.body, {
    name,
    expectedChoices: [
      /1\. Same place \/ back where he started/i,
      /2\. Opposite side \/ away from where he started/i,
      /3\. 0\.35 miles north/i
    ]
  });

  latest = await sendHarnessMessage(harness, name, answer);
  assert.equal(latest.body.tutor.stepId, 'calculate_displacement', `PJ should accept ${answer}`);
  return sendHarnessMessage(harness, name, '1');
}

async function completeMaliRun(answer) {
  const name = `mali-${slug(answer) || 'slash'}`;
  const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
  let latest = await startFormulaTutor(harness, name, MALI_QUESTION);

  for (const setupAnswer of ['1', '1']) {
    latest = await sendHarnessMessage(harness, name, setupAnswer);
  }

  assert.equal(latest.body.tutor.stepId, 'identify_spin_in_place');
  assertFormulaTutorChoices(latest.body, {
    name,
    expectedChoices: [
      /1\. She spun\/stayed in place/i,
      /2\. She moved to a different location/i,
      /3\. She traveled 7 meters/i
    ]
  });

  latest = await sendHarnessMessage(harness, name, answer);
  assert.equal(latest.body.tutor.stepId, 'calculate_distance', `Mali should accept ${answer}`);
  await sendHarnessMessage(harness, name, '0');
  return sendHarnessMessage(harness, name, '0');
}

async function completeKaiRun(answer) {
  const name = `kai-${slug(answer)}`;
  const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
  let latest = await startFormulaTutor(harness, name, KAI_QUESTION);

  for (const setupAnswer of ['1', '1', '50 m', '3', '150']) {
    latest = await sendHarnessMessage(harness, name, setupAnswer);
  }

  assert.equal(latest.body.tutor.stepId, 'identify_finish_side');
  assertFormulaTutorChoices(latest.body, {
    name,
    expectedChoices: [
      /1\. Back where he started/i,
      /2\. Opposite side of the pool/i,
      /3\. 150 m away from the start/i
    ]
  });

  latest = await sendHarnessMessage(harness, name, answer);
  assert.equal(latest.body.tutor.stepId, 'calculate_displacement', `Kai should accept ${answer}`);
  return sendHarnessMessage(harness, name, '1');
}

async function assertKaiRetryPointsToChoice() {
  const name = 'kai-retry-points-to-choice';
  const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
  let latest = await startFormulaTutor(harness, name, KAI_QUESTION);

  for (const setupAnswer of ['1', '1', '50 m', '3', '150']) {
    latest = await sendHarnessMessage(harness, name, setupAnswer);
  }

  assert.equal(latest.body.tutor.stepId, 'identify_finish_side');
  const retry = await sendHarnessMessage(harness, name, 'he is at the ending side after swimming');
  assert.equal(retry.body.tutor.stepId, 'identify_finish_side');
  assert.match(retry.body.response, /Choose 2, or click “2\. Opposite side of the pool\.”/i);
}

async function parkCarAdAccelerationAtConversion(name) {
  const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
  await startFormulaTutor(harness, name, CAR_AD_ACCELERATION_QUESTION);
  await sendHarnessMessage(harness, name, '1');
  await sendHarnessMessage(harness, name, '1');
  await sendHarnessMessage(harness, name, '0 km/hr');
  await sendHarnessMessage(harness, name, '70 km/hr');
  const conversionPrompt = await sendHarnessMessage(harness, name, '7');
  assert.equal(conversionPrompt.body.tutor.stepId, 'convert_time', `${name} should reach time conversion`);
  assert.match(conversionPrompt.body.response, /Which time value should we use before dividing\?/i);
  assert.match(conversionPrompt.body.response, /2\. 7 \/ 3600 hr ≈ 0\.001944 hr/i);
  return { harness, name };
}

async function completeCarAdAccelerationAfterConversion(name, conversionAnswer, finalAnswer) {
  const parked = await parkCarAdAccelerationAtConversion(name);
  const calculationPrompt = await sendHarnessMessage(parked.harness, parked.name, conversionAnswer);
  assert.equal(calculationPrompt.body.tutor.stepId, 'calculate', `${name} should reach final acceleration calculation`);
  return sendHarnessMessage(parked.harness, parked.name, finalAnswer);
}

async function completeCarAdAccelerationEarly(finalAnswer) {
  const name = `car-ad-early-${slug(finalAnswer)}`;
  const parked = await parkCarAdAccelerationAtConversion(name);
  return sendHarnessMessage(parked.harness, parked.name, finalAnswer);
}

async function rejectCarAdAccelerationAtConversion(answer) {
  const name = `car-ad-reject-${slug(answer)}`;
  const parked = await parkCarAdAccelerationAtConversion(name);
  return sendHarnessMessage(parked.harness, parked.name, answer);
}

async function completeFormulaRun({ name, question, steps }) {
  const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
  let latest = await startFormulaTutor(harness, name, question);

  for (const step of steps) {
    latest = await sendHarnessMessage(harness, name, step);
    assert.equal(latest.body.routeType, 'formula_tutor', `${name} should stay in Formula Tutor after ${step}`);
  }

  assert.equal(latest.body.tutor.completed, true, `${name} should complete`);
  return latest;
}

async function startFormulaTutor(harness, name, question) {
  const start = await sendHarnessMessage(harness, name, question);
  assertStartsFormulaTutor(start, name);
  return start;
}

function assertStartsFormulaTutor(response, name) {
  assert.equal(response.statusCode, 200, `${name} start status`);
  assert.equal(response.body.routeType, 'formula_tutor', `${name} should start Formula Tutor`);
  assert.equal(response.body.tutor?.active, true, `${name} tutor should be active`);
}

function assertFormulaTutorChoices(body, { name, expectedChoices }) {
  assert.match(body.response, /Choose one:/, `${name} should label the numbered choices`);
  assert.match(body.response, /Click a choice or type only the number\./, `${name} should invite numbered/clickable choices`);
  const choices = body.tutor?.currentStep?.choices || body.tutor?.work?.currentStep?.choices || [];
  assert.ok(Array.isArray(choices) && choices.length >= expectedChoices.length, `${name} metadata should expose choices`);
  const renderedChoices = choices.map((choice) => `${choice.number}. ${choice.label}`).join('\n');

  for (const expectedChoice of expectedChoices) {
    assert.match(body.response, expectedChoice, `${name} response should display ${expectedChoice}`);
    assert.match(renderedChoices, expectedChoice, `${name} metadata should include ${expectedChoice}`);
  }
}

function assertDirectKnowledgeRoute(route, testCase) {
  assert.notEqual(route.type, 'science_formula', `${testCase.name} should not route as formula work`);
  assert.notEqual(route.type, 'formula_tutor', `${testCase.name} should not route to Formula Tutor`);
  assert.notEqual(
    route.type,
    'motion_force_knowledge_tutor',
    `${testCase.name} should not route to Motion/Force Knowledge Tutor`
  );
  assert.ok(route.directAnswer, `${testCase.name} should have a direct answer`);
  if (testCase.routeTypes) {
    assert.ok(testCase.routeTypes.includes(route.type), `${testCase.name} should use one of ${testCase.routeTypes.join(', ')}`);
  }
  assertAnswer(route.directAnswer, testCase);
}

function assertAnswer(answer, testCase) {
  for (const expected of testCase.includes || []) {
    assert.match(answer, expected, `${testCase.name} should include ${expected}`);
  }
  for (const unexpected of testCase.excludes || []) {
    assert.doesNotMatch(answer, unexpected, `${testCase.name} should not include ${unexpected}`);
  }
  assert.doesNotMatch(answer, /Let.?s figure it out|Type hint for help/i, `${testCase.name} should not start a guided tutor`);
}

async function createHarnessSession(options) {
  const harness = createStudentRouteHarness(options);
  const create = await harness.request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201, 'student regression harness should create a session');
  return { ...harness, sessionId: create.body.sessionId };
}

async function sendHarnessMessage(harness, studentHubId, message) {
  const response = await harness.request('POST', '/api/student/message', {
    sessionId: harness.sessionId,
    studentHubId,
    message
  });
  assert.equal(response.statusCode, 200, `${studentHubId}: ${message}`);
  return response;
}

function routeWithTeacherKnowledge(question) {
  return routeStudentQuestion(question, findRelevantKnowledge(question, teacherKnowledge, 8));
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
