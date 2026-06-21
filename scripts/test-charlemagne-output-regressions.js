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
  testFinalSpeedCartUsesAccelerationFormulaTutor,
  testAirResistanceUsesDragFact,
  testLawOfUniversalGravitationUsesLocalFact,
  testConcept3ForceExactPrompts,
  testConcept3FrictionExactPrompts,
  testMotionForceSummaryAndExplainDirectAnswers,
  testKnowledgeConceptPromptsAnswerDirectly,
  testConcept3NewtonExamplesAndMomentumRelationship,
  testLawOfConservationOfMomentumBeatsGenericMomentum,
  testGenericMomentumStillWorks,
  testKaiPoolAcceptsBareOpposite,
  testKaiPoolDisplacementSideAnswerGetsHelpfulHint,
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

function testFinalSpeedCartUsesAccelerationFormulaTutor() {
  const route = routeWithTeacherKnowledge(cartFinalSpeedQuestion());
  assert.equal(route.type, 'science_formula');
  assert.equal(route.formulaWork?.formulaId, 'acceleration_velocity_time');
  assert.equal(route.formulaWork?.solveFor, 'final velocity');
  assert.equal(route.formulaWork?.formula, 'vf = vi + a × t');
  assert.match(route.directAnswer, /vf = 22 m\/s/i);
  assert.doesNotMatch(route.directAnswer, /speed = distance \/ time/i);

  const tutor = startTutorAtStep(cartFinalSpeedQuestion(), 'calculate', {
    identify_solve_target: 'final velocity',
    choose_formula: 'vf = vi + a × t',
    identify_initial_velocity: '2.0 m/s',
    identify_acceleration: '4.0 m/s²',
    identify_time: '5.0 s'
  });
  const step = currentStep(tutor);
  assert.match(step.prompt, /vf = 2 \+ 4 × 5/i);

  const result = answerFormulaTutorStep(tutor, '22 m/s');
  assertAccepted(result, 'Cart final-speed tutor should accept 22 m/s');
  assert.match(result.response, /final velocity = 22 m\/s/i);
}

function testAirResistanceUsesDragFact() {
  const route = routeWithTeacherKnowledge('Air resistance');
  assert.notEqual(route.type, 'no_match');
  assert.match(route.directAnswer, /Air resistance is drag/i);
  assert.match(route.directAnswer, /resists motion through air/i);
  assert.match(route.directAnswer, /opposite the object/i);
  assert.doesNotMatch(route.directAnswer, /electrons|ohms|wire diameter|wire length/i);
}

function testLawOfUniversalGravitationUsesLocalFact() {
  const route = routeWithTeacherKnowledge('Law of Universal Gravitation');
  assert.notEqual(route.type, 'no_match');
  assert.match(route.directAnswer, /any two masses attract each other/i);
  assert.match(route.directAnswer, /More mass means more gravity/i);
  assert.match(route.directAnswer, /less distance means stronger gravitational attraction/i);
}

function testConcept3ForceExactPrompts() {
  const force = routeWithTeacherKnowledge('what is a force?');
  assert.equal(force.type, 'definition');
  assert.match(force.directAnswer, /push or pull one object exerts on another/i);
  assert.match(force.directAnswer, /measured in newtons/i);
  assert.match(force.directAnswer, /change an object’s motion/i);

  const netForce = routeWithTeacherKnowledge('what is net force');
  assert.equal(netForce.type, 'definition');
  assert.match(netForce.directAnswer, /combined\/overall force/i);

  const balanced = routeWithTeacherKnowledge('what is a balanced force?');
  assert.equal(balanced.type, 'definition');
  assert.match(balanced.directAnswer, /equal in size and opposite in direction/i);
  assert.match(balanced.directAnswer, /net force is 0/i);

  const unbalancedTypo = routeWithTeacherKnowledge('what is an undlanced force');
  assert.equal(unbalancedTypo.type, 'definition');
  assert.match(unbalancedTypo.directAnswer, /Unbalanced forces do not cancel/i);
  assert.match(unbalancedTypo.directAnswer, /Net force is not 0/i);

  const changesMotion = routeWithTeacherKnowledge('What kinds of forces change an object’s motion?');
  assert.equal(changesMotion.type, 'science_concept');
  assert.match(changesMotion.directAnswer, /Unbalanced or net forces change motion/i);
  assert.doesNotMatch(changesMotion.directAnswer, /Air resistance is/i);
}

function testConcept3FrictionExactPrompts() {
  const friction = routeWithTeacherKnowledge('what is Friction');
  assert.equal(friction.type, 'definition');
  assert.match(friction.directAnswer, /resists motion/i);
  assert.match(friction.directAnswer, /rub, slide, or roll/i);

  const frictionNoSpace = routeWithTeacherKnowledge('what isFriction');
  assert.equal(frictionNoSpace.type, 'definition');
  assert.doesNotMatch(frictionNoSpace.directAnswer, /electric charge|electrons/i);

  const factors = routeWithTeacherKnowledge('what are the 3 factors friction depend on?');
  assert.equal(factors.type, 'science_concept');
  assert.match(factors.directAnswer, /roughness of the surfaces/i);
  assert.match(factors.directAnswer, /force pressing the surfaces together/i);
  assert.match(factors.directAnswer, /surface area or contact area/i);

  const electricity = routeWithTeacherKnowledge('What is friction in electricity?');
  assert.equal(electricity.type, 'definition');
  assert.match(electricity.directAnswer, /Friction transfers electric charge/i);
}

function testMotionForceSummaryAndExplainDirectAnswers() {
  const summary = routeWithTeacherKnowledge('Summarize the different ways that motion can be described and measured.');
  assert.equal(summary.type, 'science_concept');
  assert.match(summary.directAnswer, /Motion can be described by comparing position to a reference point/i);
  assert.match(summary.directAnswer, /Distance tells the total path traveled/i);
  assert.match(summary.directAnswer, /slope on a velocity-time graph shows acceleration/i);
  assert.equal(summary.motionForceTutor, null, 'plain summary prompt should not start General Tutor by default');

  const acceleration = routeWithTeacherKnowledge('Explain the different changes in motion that could cause an object to accelerate.');
  assert.equal(acceleration.type, 'science_concept');
  assert.equal(
    acceleration.directAnswer,
    'An object accelerates when its velocity changes. That can happen when it speeds up, slows down, or changes direction.'
  );
  assert.equal(acceleration.motionForceTutor, null, 'plain explain prompt should not start General Tutor by default');
}

function testKnowledgeConceptPromptsAnswerDirectly() {
  const cases = [
    ['what is Reference point', /reference point is the place or object/i],
    ['Summarize the different ways that motion can be described and measured.', /Motion can be described by comparing position to a reference point/i],
    ['velocity vs. time graph, the slope of the line equals the object’s', /slope means acceleration/i],
    ['On a distance vs. time graph, the slope of the line equals the object’s', /slope means speed/i],
    ['Positive acceleration look like on a speed vs time graph', /upward or increasing line/i],
    ['Negative acceleration looks like what on a speed vs time graph', /downward or decreasing line/i],
    ['what isFriction', /Friction is a force that resists motion/i],
    ['what are the 3 factors friction depend on?', /roughness of the surfaces[\s\S]*force pressing[\s\S]*surface area or contact area/i],
    ['balanced vs unbalanced force', /Balanced forces cancel to net force 0[\s\S]*unbalanced forces.*change motion/i],
    ['how is momentum related to newton 3rd law', /equal and opposite[\s\S]*Momentum is conserved/i],
    ['what is Inertia', /Inertia is an object’s resistance to a change in motion/i],
    ['what is air resistance', /Air resistance is drag[\s\S]*resists motion through air/i],
    ['what is the thing that slow electricity or curent', /Electrical resistance[\s\S]*slows or resists electric current/i]
  ];

  for (const [question, expected] of cases) {
    const route = routeWithTeacherKnowledge(question);
    assert.notEqual(route.type, 'motion_force_knowledge_tutor', `${question} should answer directly`);
    assert.match(route.directAnswer, expected, `${question} should return the expected direct answer`);
    assert.doesNotMatch(route.directAnswer, /Let.?s figure it out|Type hint for help/i);
  }
}

function testConcept3NewtonExamplesAndMomentumRelationship() {
  const firstLaw = routeWithTeacherKnowledge('Newton’s 1st Law of Motion can you give some examples please');
  assert.equal(firstLaw.type, 'science_concept');
  assert.match(firstLaw.directAnswer, /seatbelt/i);
  assert.match(firstLaw.directAnswer, /book stays still/i);

  const thirdLaw = routeWithTeacherKnowledge('give an example of newtons 3rd law');
  assert.equal(thirdLaw.type, 'science_concept');
  assert.match(thirdLaw.directAnswer, /trampoline/i);
  assert.match(thirdLaw.directAnswer, /paddle pushes water backward/i);

  const relationship = routeWithTeacherKnowledge('how is momentum related to newton 3rd law');
  assert.equal(relationship.type, 'science_concept');
  assert.match(relationship.directAnswer, /momentum is transferred/i);
  assert.match(relationship.directAnswer, /Momentum is conserved/i);
}

function testLawOfConservationOfMomentumBeatsGenericMomentum() {
  const route = routeWithTeacherKnowledge('Law of Conservation of Momentum');
  assert.notEqual(route.type, 'no_match');
  assert.match(route.directAnswer, /total momentum of a system stays the same/i);
  assert.match(route.directAnswer, /outside force acts/i);
  assert.match(route.directAnswer, /momentum before = momentum after/i);
  assert.doesNotMatch(route.directAnswer, /p = m × v/i);
}

function testGenericMomentumStillWorks() {
  const route = routeWithTeacherKnowledge('Momentum');
  assert.notEqual(route.type, 'no_match');
  assert.match(route.directAnswer, /Momentum describes how hard it is to stop/i);
  assert.match(route.directAnswer, /p = m × v/i);
}

function testKaiPoolAcceptsBareOpposite() {
  const tutor = startTutorAtStep(kaiQuestion(), 'identify_finish_side', {
    identify_solve_target: 'distance and displacement',
    choose_formula: 'distance = total path; displacement = start-to-finish change',
    identify_pool_length: '50 m',
    identify_length_count: '3',
    calculate_distance: '150 m'
  });

  const result = answerFormulaTutorStep(tutor, 'opposite');
  assertAccepted(result, 'Kai finish-side step should accept bare "opposite"');
  assert.match(result.response, /What is his displacement/i);
}

function testKaiPoolDisplacementSideAnswerGetsHelpfulHint() {
  const tutor = startTutorAtStep(kaiQuestion(), 'calculate_displacement', {
    identify_solve_target: 'distance and displacement',
    choose_formula: 'distance = total path; displacement = start-to-finish change',
    identify_pool_length: '50 m',
    identify_length_count: '3',
    calculate_distance: '150 m',
    identify_finish_side: 'opposite'
  });

  const hint = answerFormulaTutorStep(tutor, 'other side');
  assert.ok(hint.currentTutorProblem, 'Conceptual side answer should keep tutor on displacement step');
  assert.match(hint.response, /Yes, he is on the opposite side/i);
  assert.match(hint.response, /What distance is that from where he started/i);
  assert.equal(currentStep(hint.currentTutorProblem).id, 'calculate_displacement');

  const solved = answerFormulaTutorStep(hint.currentTutorProblem, '50 m');
  assertAccepted(solved, 'Kai displacement step should still require and accept 50 m');
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
  assert.match(step.prompt, /7\s*\/\s*3600/);
  assert.doesNotMatch(step.prompt, /0\.0019/);

  const result = answerFormulaTutorStep(tutor, '36000 km/hr^2');
  assertAccepted(
    result,
    'Tutor should accept 36000 km/hr^2 because the substitution uses the exact 7 / 3600 hr conversion'
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

function cartFinalSpeedQuestion() {
  return 'A cart rolling down an incline for 5.0 seconds has an acceleration of 4.0 m/s2. If the cart has an initial speed of 2.0 m/s, what is its final speed?';
}

function maliQuestion() {
  return 'Mali loves to make herself dizzy. She spins around in place 7 times before falling down right where she was standing. Find her distance and displacement.';
}

function kaiQuestion() {
  return 'Kai swims for the school swim team. He specializes in a backstroke event where he has to swim the 50-m length of the pool three times. Find his distance and displacement.';
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
