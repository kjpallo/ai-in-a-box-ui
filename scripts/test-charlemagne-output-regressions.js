const assert = require('node:assert/strict');
const path = require('node:path');

const { findRelevantKnowledge, loadTeacherKnowledge } = require('../lib/knowledge/teacherKnowledge');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const {
  answerFormulaTutorStep,
  startFormulaTutor
} = require('../lib/tutor/formulaTutor');

const teacherFactsPath = path.join(__dirname, '..', 'knowledge', 'teacher_facts.json');
const teacherKnowledge = loadTeacherKnowledge(teacherFactsPath);

const tests = [
  testNicoleParserIncludesReturnLeg,
  testNicoleTutorAcceptsTotalDistance,
  ...buildMaliNaturalLanguageAcceptanceTests(),
  testCarAdAccelerationDisplayedRoundedAnswer,
  testVelocityOutputIncludesRequestedUnits,
  testInstantaneousSpeedTypoUsesLocalFact,
  testGraphMotionUsesLocalFact,
  testSlopeFragmentDoesNotRouteToNewtonsSecondLaw,
  testSlopeBlankFragmentDoesNotRouteToNewtonsSecondLaw
];

const results = [];

for (const test of tests) {
  try {
    test();
    results.push({ name: test.name, passed: true });
    console.log(`PASS ${test.name}`);
  } catch (error) {
    results.push({ name: test.name, passed: false, error });
    console.error(`FAIL ${test.name}`);
    console.error(`  ${error.message}`);
  }
}

const passed = results.filter((result) => result.passed);
const failed = results.filter((result) => !result.passed);

console.log('');
console.log(`Charlemagne output regression checks: ${passed.length} passed, ${failed.length} failed.`);

if (failed.length > 0) {
  console.log('Failing checks:');
  failed.forEach((result) => console.log(`- ${result.name}: ${result.error.message}`));
  process.exitCode = 1;
}

function testNicoleParserIncludesReturnLeg() {
  const route = routeStudentQuestion(nicoleQuestion());
  assert.equal(route.type, 'science_formula');

  const movements = route.formulaWork?.variables?.movements || [];
  assert.deepEqual(
    movements.map((move) => ({
      value: move.value,
      unit: move.unit,
      direction: move.direction
    })),
    [
      { value: 150, unit: 'ft', direction: 'north' },
      { value: 50, unit: 'ft', direction: 'south' }
    ],
    `Expected Nicole route to include 150 ft north and 50 ft south, got ${JSON.stringify(movements)}`
  );
  assert.match(route.directAnswer, /distance = 200 ft/i);
  assert.match(route.directAnswer, /displacement = 100 ft north/i);
  assert.doesNotMatch(route.directAnswer, /distance = 150 ft/i);
}

function testNicoleTutorAcceptsTotalDistance() {
  const tutor = startTutorAtStep(nicoleQuestion(), 'calculate_distance', {
    identify_solve_target: 'distance and displacement',
    choose_formula: 'distance = total path; displacement = start-to-finish change',
    identify_movement1: '150 ft north',
    identify_movement2: '50 ft south'
  });

  const step = currentStep(tutor);
  assert.equal(step.id, 'calculate_distance');
  assert.doesNotMatch(step.prompt, /distance = 150\b/i);

  const result = answerFormulaTutorStep(tutor, '200 ft');
  assertAccepted(result, 'Nicole tutor should accept 200 ft as the total distance');
}

function buildMaliNaturalLanguageAcceptanceTests() {
  return [
    'spin in place',
    'spun in place',
    'same place',
    'same spot',
    "didn't move",
    'did not move',
    'no movement',
    'no',
    'spain in place'
  ].map((answer) => {
    const test = function maliSpinInPlaceAcceptsNaturalLanguageAnswer() {
      const tutor = startTutorAtStep(maliQuestion(), 'identify_spin_in_place', {
        identify_solve_target: 'distance and displacement',
        choose_formula: 'distance = total path; displacement = start-to-finish change'
      });
      const result = answerFormulaTutorStep(tutor, answer);
      assertAccepted(result, `Mali spin-in-place step should accept "${answer}"`);
    };
    Object.defineProperty(test, 'name', {
      value: `testMaliSpinInPlaceAccepts_${slug(answer)}`
    });
    return test;
  });
}

function testCarAdAccelerationDisplayedRoundedAnswer() {
  const question = 'A car advertisement claims that a certain car can accelerate from rest to 70 km/hr in 7 seconds (hint: convert to hours first!!) Find the car\u2019s acceleration.';
  const tutor = startTutorAtStep(question, 'calculate', {
    identify_solve_target: 'acceleration',
    choose_formula: 'a = (vf - vi) / t',
    identify_initial_velocity: '0 km/hr',
    identify_final_velocity: '70 km/hr',
    identify_time: '7 seconds',
    convert_time: '0.0019 hr'
  });

  const step = currentStep(tutor);
  assert.equal(step.id, 'calculate');
  assert.match(step.prompt, /0\.0019/);

  const displayedEquivalent = 70 / 0.0019;
  const result = answerFormulaTutorStep(tutor, `${displayedEquivalent} km/hr^2`);
  assertAccepted(
    result,
    `Tutor should accept ${displayedEquivalent} km/hr^2 because the substitution displays 0.0019 hr`
  );
}

function testVelocityOutputIncludesRequestedUnits() {
  const route = routeStudentQuestion('A car travels 240 miles south in 3 hours. Find the velocity of the car in mi/hr and m/s.');
  assert.equal(route.type, 'science_formula');
  assert.match(route.directAnswer, /velocity = distance \/ time/i);
  assert.match(route.directAnswer, /80 mi\/hr south/i);
  assert.match(route.directAnswer, /35\.(?:7|8)\d* m\/s south/i);
  assert.doesNotMatch(route.directAnswer, /\bspeed\s*=/i);

  const alternate = route.formulaWork?.finalAnswer?.alternates?.[0];
  assert.ok(alternate, 'Velocity formula work should carry the requested m/s alternate answer');
  assert.equal(alternate.unit, 'm/s');
  assert.match(alternate.display, /south/i);
}

function testInstantaneousSpeedTypoUsesLocalFact() {
  const route = routeWithTeacherKnowledge('what is instantaneous spreed');
  assert.notEqual(route.type, 'no_match');
  assert.match(route.directAnswer, /instantaneous speed/i);
  assert.equal(route.aiAllowed, false);
}

function testGraphMotionUsesLocalFact() {
  const route = routeWithTeacherKnowledge('how do you graph motion?');
  assert.notEqual(route.type, 'no_match');
  assert.match(route.directAnswer, /graph|position-time|distance-time|velocity-time|speed-time/i);
  assert.equal(route.aiAllowed, false);
}

function testSlopeFragmentDoesNotRouteToNewtonsSecondLaw() {
  assertSlopeRouteUsesMotionGraphMeaning('the slope of the line equals the object\u2019s');
}

function testSlopeBlankFragmentDoesNotRouteToNewtonsSecondLaw() {
  assertSlopeRouteUsesMotionGraphMeaning('the slope of the line equals the object\u2019s_?');
}

function assertSlopeRouteUsesMotionGraphMeaning(question) {
  const route = routeWithTeacherKnowledge(question);
  assert.doesNotMatch(route.directAnswer, /Newton'?s Second Law|Fnet\s*=/i);
  assert.match(route.directAnswer, /speed|velocity|acceleration|position-time|velocity-time|speed-time|which graph|clarif/i);
  assert.equal(route.aiAllowed, false);
}

function routeWithTeacherKnowledge(question) {
  return routeStudentQuestion(question, findRelevantKnowledge(question, teacherKnowledge, 8));
}

function startTutorAtStep(question, targetStepId, answersByStepId) {
  const route = routeStudentQuestion(question);
  assert.equal(route.type, 'science_formula');
  let tutor = startFormulaTutor({
    questionRoute: route,
    originalQuestion: question
  });
  assert.ok(tutor, `Expected tutor to start for question: ${question}`);

  while (currentStep(tutor)?.id !== targetStepId) {
    const step = currentStep(tutor);
    assert.ok(step, `Could not find target tutor step ${targetStepId}`);
    const answer = answersByStepId[step.id];
    assert.ok(answer, `Missing test harness answer for tutor step ${step.id}`);
    const result = answerFormulaTutorStep(tutor, answer);
    assertAccepted(result, `Harness answer "${answer}" should advance step ${step.id}`);
    tutor = result.currentTutorProblem;
    assert.ok(tutor, `Tutor ended before reaching ${targetStepId}`);
  }

  return tutor;
}

function assertAccepted(result, message) {
  assert.ok(result, message);
  assert.doesNotMatch(result.response || '', /not quite/i, message);
  assert.ok(
    result.completed || result.currentTutorProblem || result.completedTutorProblem,
    `${message}: tutor did not advance or complete`
  );
}

function currentStep(tutor) {
  return tutor?.steps?.[tutor.currentStepIndex] || null;
}

function nicoleQuestion() {
  return 'Nicole parks her car at Target and walks 150 ft north to get to the store. On her way back to her car, she walks 50 ft before pausing when she sees a sign for discounted iced coffee at Starbucks. Find her distance and displacement.';
}

function maliQuestion() {
  return 'Mali loves to make herself dizzy. She spins around in place 7 times before falling down right where she was standing. Find her distance and displacement.';
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
