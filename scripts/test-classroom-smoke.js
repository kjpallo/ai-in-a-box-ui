const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const NEW_PROBLEM_MESSAGE =
  'It looks like you are starting a new problem. I’ll start a new Guided Formula Tutor problem for this question.';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function createClassroom(options = {}) {
  const harness = createStudentRouteHarness(options);
  const create = await harness.request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201, 'classroom smoke should create a student session');

  return {
    ...harness,
    sessionId: create.body.sessionId
  };
}

async function send(classroom, studentHubId, message, extra = {}) {
  const response = await classroom.request('POST', '/api/student/message', {
    sessionId: classroom.sessionId,
    studentHubId,
    message,
    ...extra
  });
  assert.equal(response.statusCode, 200, `${studentHubId}: ${message}`);
  return response;
}

function currentTutorProblem(classroom, studentHubId) {
  return classroom.studentSessions[classroom.sessionId].anonymousHubs[studentHubId].currentTutorProblem;
}

function assertFormulaTutorStart(response, { name, formulaId, solveFor, formula, excludes = [] }) {
  assert.equal(response.body.routeType, 'formula_tutor', `${name} should start Guided Formula Tutor`);
  assert.equal(response.body.tutor.active, true, `${name} tutor should be active`);
  assert.equal(response.body.tutor.formulaId, formulaId, `${name} formula id`);
  assert.equal(response.body.tutor.solveFor, solveFor, `${name} solve target`);
  if (formula) assert.equal(response.body.tutor.formula, formula, `${name} formula`);
  for (const excluded of excludes) {
    assert.doesNotMatch(response.body.response, excluded, `${name} should avoid bad fallback`);
  }
}

function assertGeneralTutorStart(response, { name, tutorId }) {
  assert.equal(response.body.routeType, 'motion_force_knowledge_tutor', `${name} should start Guided General Tutor`);
  assert.equal(response.body.tutor.active, true, `${name} tutor should be active`);
  assert.equal(response.body.tutor.completed, false, `${name} tutor should not be complete on start`);
  assert.equal(response.body.tutor.tutorCategory, 'general', `${name} tutor category`);
  assert.equal(response.body.tutor.id, tutorId, `${name} tutor id`);
}

async function runGuidedFormulaSmoke({
  name,
  question,
  formulaId,
  solveFor,
  formula,
  steps,
  finalAnswer,
  finalMatch,
  startExcludes = []
}) {
  const classroom = await createClassroom({ studentGuidedFormulaTutoringEnabled: true });
  const studentHubId = `${name}-student`;
  const start = await send(classroom, studentHubId, question);

  assertFormulaTutorStart(start, { name, formulaId, solveFor, formula, excludes: startExcludes });
  assert.equal(start.body.tutor.originalQuestion, question, `${name} should keep the original question`);
  assert.equal(start.body.tutor.work.originalQuestion, question, `${name} work should keep the original question`);
  assert.ok(!start.body.tutor.finalAnswerDisplay, `${name} should not reveal the final answer on start`);

  let latest = start;
  for (const step of steps) {
    latest = await send(classroom, studentHubId, step.message);
    assert.equal(latest.body.routeType, 'formula_tutor', `${name} step ${step.message} should stay in tutor`);
    if (step.match) assert.match(latest.body.response, step.match, `${name} step ${step.message}`);
    if (step.noMatch) assert.doesNotMatch(latest.body.response, step.noMatch, `${name} step ${step.message}`);
    if (step.assert) step.assert(latest, classroom, studentHubId);
  }

  assert.equal(latest.body.tutor.completed, true, `${name} should complete`);
  assert.equal(latest.body.tutor.active, false, `${name} should no longer be active`);
  assert.equal(latest.body.tutor.finalAnswerDisplay, finalAnswer, `${name} final answer display`);
  assert.match(
    latest.body.tutor.work.finalAnswer,
    new RegExp(escapeRegExp(finalAnswer), 'i'),
    `${name} should expose the Formula Tutor fireworks final-answer signal`
  );
  if (finalMatch) assert.match(latest.body.response, finalMatch, `${name} final response`);
  assert.equal(currentTutorProblem(classroom, studentHubId), null, `${name} should clear tutor state`);

  return latest;
}

async function testDistanceTimeSlopeGeneralTutorCompletion() {
  const classroom = await createClassroom({ studentGuidedFormulaTutoringEnabled: true });
  const studentHubId = 'distance-time-slope-general';
  const question = 'On a distance vs. time graph, the slope of the line equals the object’s';

  const start = await send(classroom, studentHubId, question);
  assertGeneralTutorStart(start, { name: 'distance-time-slope', tutorId: 'distance_time_slope' });

  const final = await send(classroom, studentHubId, 'speed');
  assert.equal(final.body.routeType, 'motion_force_knowledge_tutor');
  assert.equal(final.body.tutor.completed, true, 'distance-time slope tutor should complete on speed');
  assert.equal(final.body.tutor.active, false);
  assert.equal(final.body.tutor.work.finalAnswer, final.body.tutor.finalAnswerDisplay);
  assert.match(final.body.tutor.work.finalAnswer, /speed/i);
  assert.equal(currentTutorProblem(classroom, studentHubId), null);

  const feedback = await send(classroom, studentHubId, 'no fireworks?');
  assert.equal(feedback.body.routeType, 'app_feedback');
  assert.notEqual(feedback.body.routeType, 'no_match');
  assert.match(feedback.body.response, /celebration once|answer still counted/i);
}

async function testVelocityTimeSlopeGeneralTutorCompletion() {
  const classroom = await createClassroom({ studentGuidedFormulaTutoringEnabled: true });
  const studentHubId = 'velocity-time-slope-general';
  const question = 'On a velocity vs. time graph, the slope of the line equals the object’s';

  const start = await send(classroom, studentHubId, question);
  assertGeneralTutorStart(start, { name: 'velocity-time-slope', tutorId: 'velocity_time_slope' });

  const final = await send(classroom, studentHubId, 'acceleration');
  assert.equal(final.body.routeType, 'motion_force_knowledge_tutor');
  assert.equal(final.body.tutor.completed, true, 'velocity-time slope tutor should complete on acceleration');
  assert.equal(final.body.tutor.active, false);
  assert.equal(final.body.tutor.work.finalAnswer, final.body.tutor.finalAnswerDisplay);
  assert.match(final.body.tutor.work.finalAnswer, /acceleration/i);
  assert.equal(currentTutorProblem(classroom, studentHubId), null);
}

async function testVelocityTimeSlopeWrongThenCorrect() {
  const classroom = await createClassroom({ studentGuidedFormulaTutoringEnabled: true });
  const studentHubId = 'velocity-time-slope-recovery';
  const question = 'On a velocity vs. time graph, the slope of the line equals the object’s';

  const start = await send(classroom, studentHubId, question);
  assertGeneralTutorStart(start, { name: 'velocity-time-slope-recovery', tutorId: 'velocity_time_slope' });

  const wrong = await send(classroom, studentHubId, 'speed');
  assert.equal(wrong.body.routeType, 'motion_force_knowledge_tutor');
  assert.equal(wrong.body.tutor.completed, false);
  assert.equal(wrong.body.tutor.active, true);
  assert.match(wrong.body.response, /Not quite/i);
  assert.equal(currentTutorProblem(classroom, studentHubId).id, 'velocity_time_slope');

  const final = await send(classroom, studentHubId, 'acceleration');
  assert.equal(final.body.tutor.completed, true);
  assert.match(final.body.response, /velocity-time graph, slope means acceleration/i);
  assert.equal(currentTutorProblem(classroom, studentHubId), null);
}

async function testNewtonAndFollowUp() {
  const classroom = await createClassroom();
  const studentHubId = 'newton-wording';

  const newton = await send(
    classroom,
    studentHubId,
    'Why is Newton’s 1st Law also known as the Law of Inertia?'
  );
  assert.match(newton.body.response, /inertia/i, 'Newton answer should mention inertia');
  assert.match(newton.body.response, /resist.*changes? in motion|resistance.*changes? in motion/i);
  assert.doesNotMatch(
    newton.body.response,
    /^Newton.?s (1st|First) Law says objects keep doing what they are doing unless an unbalanced force acts on them\.?$/i,
    'Newton answer should not be only the generic First Law definition'
  );

  const point = await send(classroom, studentHubId, "What's the point?", {
    intent: 'why_this_matters'
  });
  assert.equal(point.body.routeType, 'why_this_matters_followup');
  assert.doesNotMatch(point.body.response, /What's the point\?/i);
  assert.match(point.body.response, /This matters because|helps explain|why objects/i);
}

async function testNetForceTutor() {
  await runGuidedFormulaSmoke({
    name: 'net-force-two-students',
    question:
      'Two students push on a box in the same direction and a third student pushes in the opposite direction. What is the net force on the box if each push with a force of 50 N?',
    formulaId: 'net_force',
    solveFor: 'net force',
    steps: [
      { message: '2', match: /How many students push in the opposite direction\?/i },
      { message: '1', match: /How much force does each student push with\?/i },
      { message: '50 N', match: /add same-direction pushes and subtract opposite-direction pushes/i },
      { message: '1', match: /total force from the same-direction pushes/i },
      { message: '100', match: /What is the net force\?/i },
      { message: '50', match: /direction of the two students/i }
    ],
    finalAnswer: '50 N in the direction of the two students',
    finalMatch: /50 N in the direction of the two students/i
  });
}

async function testMomentumTutor() {
  await runGuidedFormulaSmoke({
    name: 'momentum-car',
    question: 'What is the momentum of a car with a mass of 1,300 kg traveling at a speed of 28 m/s?',
    formulaId: 'momentum_mass_velocity',
    solveFor: 'momentum',
    formula: 'p = m × v',
    steps: [
      { message: 'momentum', match: /Which formula should we use\?/i },
      { message: '1', match: /mass/i },
      { message: '1300 kg', match: /velocity/i },
      { message: '28 m/s', match: /1300 × 28/i },
      { message: '36400', match: /36400 kg·m\/s/i }
    ],
    finalAnswer: '36400 kg·m/s',
    finalMatch: /36400 kg·m\/s/i
  });
}

async function testCartFinalSpeedRegression() {
  await runGuidedFormulaSmoke({
    name: 'cart-final-speed',
    question:
      'A cart rolling down an incline for 5.0 seconds has an acceleration of 4.0 m/s2. If the cart has an initial speed of 2.0 m/s, what is its final speed?',
    formulaId: 'acceleration_velocity_time',
    solveFor: 'final velocity',
    formula: 'vf = vi + a × t',
    startExcludes: [/Definition/i, /Speed tells how fast/i, /speed = distance/i],
    steps: [
      { message: 'final velocity', match: /Which formula should we use\?/i },
      { message: '1', match: /initial velocity/i },
      { message: '2 m/s', match: /acceleration/i },
      { message: '4 m/s2', match: /time/i },
      { message: '5 s', match: /vf = 2 \+ 4 × 5|2 \+ 4 × 5/i },
      { message: '22', match: /22 m\/s/i }
    ],
    finalAnswer: '22 m/s',
    finalMatch: /final velocity = 22 m\/s/i
  });
}

async function testHowFastDistanceTimeRegression() {
  await runGuidedFormulaSmoke({
    name: 'how-fast-distance-time',
    question: 'A supersonic jet flies 10 miles in 0.008 hours. How fast is the jet moving?',
    formulaId: 'speed_distance_time',
    solveFor: 'speed',
    formula: 'speed = distance / time',
    startExcludes: [/final velocity/i, /vf = vi/i, /Speed tells how fast/i],
    steps: [
      { message: 'speed', match: /Which formula should we use\?/i },
      { message: '1', match: /distance/i },
      { message: '10 miles', match: /time/i },
      { message: '0.008 hours', match: /10 \/ 0\.008/i },
      { message: '1250', match: /1250 miles per hour/i }
    ],
    finalAnswer: '1250 miles per hour',
    finalMatch: /speed = 1250 miles per hour/i
  });
}

async function testHelicopterAcceleration() {
  await runGuidedFormulaSmoke({
    name: 'helicopter-acceleration',
    question:
      'A helicopter’s speed increases from 25 m/s to 60 m/s in 5 seconds. What is the acceleration of this helicopter?',
    formulaId: 'acceleration_velocity_time',
    solveFor: 'acceleration',
    formula: 'a = (vf - vi) / t',
    steps: [
      { message: 'acceleration', match: /Which formula should we use\?/i },
      { message: '1', match: /initial velocity/i },
      { message: '25 m/s', match: /final velocity/i },
      { message: '60 m/s', match: /time/i },
      { message: '5 seconds', match: /\(60 - 25\) \/ 5/i },
      { message: '7', match: /7 m\/s²/i }
    ],
    finalAnswer: '7 m/s²',
    finalMatch: /acceleration = 7 m\/s²/i
  });
}

async function runOstrichTutor(timeAnswer, { checkWrongTime = false } = {}) {
  const classroom = await createClassroom({ studentGuidedFormulaTutoringEnabled: true });
  const studentHubId = `ostrich-${timeAnswer.replace(/\s+/g, '-')}`;
  const question =
    'An ostrich can run at a speed of 43 mi/hr. How much ground can an ostrich cover if it runs at this speed for 15 minutes?';

  const start = await send(classroom, studentHubId, question);
  assertFormulaTutorStart(start, {
    name: studentHubId,
    formulaId: 'speed_distance_time',
    solveFor: 'distance'
  });
  assert.deepEqual(
    start.body.tutor.knownValues.map((value) => value.display),
    ['15 minutes = 0.25 hours', '43 miles per hour']
  );

  await send(classroom, studentHubId, 'distance');
  await send(classroom, studentHubId, '1');

  if (checkWrongTime) {
    const wrongTime = await send(classroom, studentHubId, '43');
    assert.match(wrongTime.body.response, /Not quite yet/i);
    assert.match(wrongTime.body.response, /15 minutes/i);
    assert.match(wrongTime.body.response, /0\.25 hours/i);
    assert.equal(currentTutorProblem(classroom, studentHubId).steps[
      currentTutorProblem(classroom, studentHubId).currentStepIndex
    ].id, 'identify_time');
  }

  const originalTime = await send(classroom, studentHubId, timeAnswer);
  assert.match(originalTime.body.response, /Correct\. The time is 15 minutes/i);
  assert.match(originalTime.body.response, /convert 15 minutes to hours/i);
  assert.match(originalTime.body.response, /15 ÷ 60/i);

  await send(classroom, studentHubId, '0.25');
  await send(classroom, studentHubId, '43 mi/hr');
  const final = await send(classroom, studentHubId, '10.75');
  assert.equal(final.body.tutor.completed, true);
  assert.match(final.body.response, /distance = 10\.75 miles/i);
}

async function testOstrichDistanceWithUnitConversion() {
  await runOstrichTutor('15', { checkWrongTime: true });
  await runOstrichTutor('15 minutes');
  await runOstrichTutor('15 min');
}

async function testOstrichToJetInterruption() {
  const classroom = await createClassroom({ studentGuidedFormulaTutoringEnabled: true });
  const studentHubId = 'ostrich-to-jet';
  const ostrichQuestion =
    'An ostrich can run at a speed of 43 mi/hr. How much ground can an ostrich cover if it runs at this speed for 15 minutes?';
  const jetQuestion = 'A supersonic jet flies 10 miles in 0.008 hours. How fast is the jet moving?';

  await send(classroom, studentHubId, ostrichQuestion);
  await send(classroom, studentHubId, 'distance');
  await send(classroom, studentHubId, '1');
  assert.equal(currentTutorProblem(classroom, studentHubId).steps[
    currentTutorProblem(classroom, studentHubId).currentStepIndex
  ].id, 'identify_time');

  const restart = await send(classroom, studentHubId, jetQuestion);
  assertFormulaTutorStart(restart, {
    name: 'ostrich-to-jet',
    formulaId: 'speed_distance_time',
    solveFor: 'speed'
  });
  assert.match(restart.body.response, new RegExp(escapeRegExp(NEW_PROBLEM_MESSAGE), 'i'));
  assert.doesNotMatch(restart.body.response, /^Not quite yet\./i);
  assert.equal(currentTutorProblem(classroom, studentHubId).originalQuestion, jetQuestion);

  await send(classroom, studentHubId, 'speed');
  await send(classroom, studentHubId, '1');
  await send(classroom, studentHubId, '10 miles');
  await send(classroom, studentHubId, '0.008 hours');
  const final = await send(classroom, studentHubId, '1250');
  assert.equal(final.body.tutor.completed, true);
  assert.match(final.body.response, /1250 miles per hour/i);
}

async function testClozeCompletion() {
  const classroom = await createClassroom();
  const response = await send(classroom, 'cloze-position', 'Motion occurs anytime an object changes its');
  assert.equal(response.body.routeType, 'cloze_completion');
  assert.match(response.body.response, /position/i);
}

async function parkCarAdvertisementAtTimeStep(classroom, studentHubId) {
  const question =
    'A car advertisement claims that a certain car can accelerate from rest to 70 km/hr in 7 seconds (hint: convert to hours first!!) Find the car’s acceleration.';

  const start = await send(classroom, studentHubId, question);
  assertFormulaTutorStart(start, {
    name: studentHubId,
    formulaId: 'acceleration_velocity_time',
    solveFor: 'acceleration'
  });
  await send(classroom, studentHubId, 'acceleration');
  await send(classroom, studentHubId, '1');
  await send(classroom, studentHubId, '0 km/hr');
  await send(classroom, studentHubId, '70 km/hr');
  assert.equal(currentTutorProblem(classroom, studentHubId).steps[
    currentTutorProblem(classroom, studentHubId).currentStepIndex
  ].id, 'identify_time');

  return question;
}

async function testCarAdvertisementConversion() {
  const classroom = await createClassroom({ studentGuidedFormulaTutoringEnabled: true });
  const studentHubId = 'car-ad-conversion';

  await parkCarAdvertisementAtTimeStep(classroom, studentHubId);
  const originalTime = await send(classroom, studentHubId, '7');
  assert.match(originalTime.body.response, /Correct\. The time is 7 seconds/i);
  assert.match(originalTime.body.response, /convert 7 seconds to hours/i);
  assert.match(originalTime.body.response, /7 ÷ 3600/i);

  await send(classroom, studentHubId, '0.00194 hr');
  const final = await send(classroom, studentHubId, '36000');
  assert.equal(final.body.tutor.completed, true);
  assert.match(final.body.response, /acceleration = 36000 km\/hr²/i);
}

async function testCarAdToCyclistInterruption() {
  const classroom = await createClassroom({ studentGuidedFormulaTutoringEnabled: true });
  const studentHubId = 'car-ad-to-cyclist-smoke';
  const cyclistQuestion = 'A cyclist accelerates from 0 m/s to 8 m/s in 3 seconds. What is his acceleration?';

  await parkCarAdvertisementAtTimeStep(classroom, studentHubId);
  const restart = await send(classroom, studentHubId, cyclistQuestion);
  assertFormulaTutorStart(restart, {
    name: 'car-ad-to-cyclist',
    formulaId: 'acceleration_velocity_time',
    solveFor: 'acceleration'
  });
  assert.match(restart.body.response, new RegExp(escapeRegExp(NEW_PROBLEM_MESSAGE), 'i'));
  assert.doesNotMatch(restart.body.response, /^Not quite yet\./i);
  assert.equal(currentTutorProblem(classroom, studentHubId).originalQuestion, cyclistQuestion);
}

async function testCyclistRounding() {
  await runGuidedFormulaSmoke({
    name: 'cyclist-rounding',
    question: 'A cyclist accelerates from 0 m/s to 8 m/s in 3 seconds. What is his acceleration?',
    formulaId: 'acceleration_velocity_time',
    solveFor: 'acceleration',
    formula: 'a = (vf - vi) / t',
    steps: [
      { message: 'acceleration', match: /Which formula should we use\?/i },
      { message: '1', match: /initial velocity/i },
      { message: '0 m/s', match: /final velocity/i },
      { message: '8 m/s', match: /time/i },
      { message: '3 seconds', match: /\(8 - 0\) \/ 3/i },
      { message: '2.67', match: /Correct\./i }
    ],
    finalAnswer: '2.6667 m/s²',
    finalMatch: /acceleration = 2\.6667 m\/s²/i
  });
}

async function testRollerCoasterAcceleration() {
  await runGuidedFormulaSmoke({
    name: 'roller-coaster-acceleration',
    question:
      'A roller coaster car rapidly picks up speed as it rolls down a slope. As it starts down the slope, its speed is 4 m/s. 3 seconds later, at the bottom of the slope, its speed is 22 m/s. Find its acceleration.',
    formulaId: 'acceleration_velocity_time',
    solveFor: 'acceleration',
    formula: 'a = (vf - vi) / t',
    steps: [
      { message: 'acceleration', match: /Which formula should we use\?/i },
      { message: '1', match: /initial velocity/i },
      { message: '4 m/s', match: /final velocity/i },
      { message: '22 m/s', match: /time/i },
      { message: '3 seconds', match: /\(22 - 4\) \/ 3/i },
      { message: '6', match: /6 m\/s²/i }
    ],
    finalAnswer: '6 m/s²',
    finalMatch: /acceleration = 6 m\/s²/i
  });
}

async function testSkateboarderFinalSpeed() {
  const classroom = await createClassroom({ studentGuidedFormulaTutoringEnabled: true });
  const studentHubId = 'skateboarder-final-speed';
  const question =
    'A skateboarder has an acceleration of 1.5 m/s2. Starting from rest, if he accelerates for 2 s, what speed will he reach?';

  const start = await send(classroom, studentHubId, question);
  assertFormulaTutorStart(start, {
    name: 'skateboarder-final-speed',
    formulaId: 'acceleration_velocity_time',
    solveFor: 'final velocity',
    formula: 'vf = vi + a × t'
  });

  const wrongTarget = await send(classroom, studentHubId, '1');
  assert.match(wrongTarget.body.response, /Not quite yet/i);
  assert.match(wrongTarget.body.response, /solving for final velocity/i);
  assert.equal(currentTutorProblem(classroom, studentHubId).currentStepIndex, 0);

  await send(classroom, studentHubId, '2');
  await send(classroom, studentHubId, '1');
  await send(classroom, studentHubId, '0 m/s');
  await send(classroom, studentHubId, '1.5 m/s2');
  await send(classroom, studentHubId, '2 s');
  const final = await send(classroom, studentHubId, '3');
  assert.equal(final.body.tutor.completed, true);
  assert.equal(final.body.tutor.finalAnswerDisplay, '3 m/s');
  assert.match(final.body.response, /final velocity = 3 m\/s/i);
}

async function main() {
  await testNewtonAndFollowUp();
  await testDistanceTimeSlopeGeneralTutorCompletion();
  await testVelocityTimeSlopeGeneralTutorCompletion();
  await testVelocityTimeSlopeWrongThenCorrect();
  await testNetForceTutor();
  await testMomentumTutor();
  await testCartFinalSpeedRegression();
  await testHowFastDistanceTimeRegression();
  await testHelicopterAcceleration();
  await testOstrichDistanceWithUnitConversion();
  await testOstrichToJetInterruption();
  await testClozeCompletion();
  await testCarAdvertisementConversion();
  await testCarAdToCyclistInterruption();
  await testCyclistRounding();
  await testRollerCoasterAcceleration();
  await testSkateboarderFinalSpeed();

  console.log('✅ classroom smoke: pasted classroom questions and guided tutor behaviors pass');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
