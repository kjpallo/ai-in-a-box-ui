const assert = require('node:assert/strict');
const path = require('node:path');

const { findRelevantKnowledge, loadTeacherKnowledge } = require('../lib/knowledge/teacherKnowledge');
const { detectAnswerRepresentationIntent } = require('../lib/router/answerIntent');
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
  testBasicAnswerRepresentationIntent,
  testLearningShapeIntentAndRoutes,
  testFrictionSubtypeAndListFormatting,
  testRollingFrictionFormulaFallback,
  testNewtonAndConservationLawLists,
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
  testExplicitFromRestAccelerationTeachesVelocityConversion,
  testVelocityOutputIncludesRequestedUnits,
  testForceMotionFoundationalCuePrompts,
  testRemainingForceMotionConceptPrompts,
  testPatch3ComposedForceMotionFormulaPrompts,
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

function testBasicAnswerRepresentationIntent() {
  assert.deepEqual(
    detectAnswerRepresentationIntent('list the types of friction'),
    { requestedRepresentation: 'numbered_list', requestedLearningShape: null, shouldAskRepresentationFollowup: false }
  );
  assert.deepEqual(
    detectAnswerRepresentationIntent('what is rolling friction'),
    { requestedRepresentation: 'paragraph', requestedLearningShape: null, shouldAskRepresentationFollowup: false }
  );
  assert.deepEqual(
    detectAnswerRepresentationIntent('how do I solve for rolling friction'),
    { requestedRepresentation: 'formula_steps', requestedLearningShape: null, shouldAskRepresentationFollowup: false }
  );
  assert.deepEqual(
    detectAnswerRepresentationIntent('balanced vs unbalanced force'),
    { requestedRepresentation: 'comparison', requestedLearningShape: 'compare_contrast', shouldAskRepresentationFollowup: false }
  );
  assert.deepEqual(
    detectAnswerRepresentationIntent('show me a diagram of rolling friction'),
    { requestedRepresentation: 'image_request', requestedLearningShape: null, shouldAskRepresentationFollowup: false }
  );
  assert.deepEqual(
    detectAnswerRepresentationIntent('Tell me about force'),
    { requestedRepresentation: 'default', requestedLearningShape: null, shouldAskRepresentationFollowup: true }
  );
}

function testLearningShapeIntentAndRoutes() {
  assert.notEqual(
    detectAnswerRepresentationIntent('quiz me').requestedInteractionMode,
    'interactive'
  );
  assert.notEqual(
    detectAnswerRepresentationIntent('practice this').requestedInteractionMode,
    'interactive'
  );
  assert.deepEqual(
    detectAnswerRepresentationIntent('make flashcards for types of friction'),
    { requestedRepresentation: 'numbered_list', requestedLearningShape: 'flashcards', shouldAskRepresentationFollowup: false }
  );
  assert.deepEqual(
    detectAnswerRepresentationIntent('start flashcards for types of friction'),
    { requestedRepresentation: 'numbered_list', requestedLearningShape: 'flashcards', shouldAskRepresentationFollowup: false, requestedInteractionMode: 'interactive' }
  );
  assert.equal(
    detectAnswerRepresentationIntent('one flashcard at a time for Newton\'s laws').requestedInteractionMode,
    'interactive'
  );
  assert.equal(
    detectAnswerRepresentationIntent('practice flashcards for Newtons laws').requestedInteractionMode,
    'interactive'
  );
  assert.deepEqual(
    detectAnswerRepresentationIntent('give me examples and non-examples of friction'),
    { requestedRepresentation: 'default', requestedLearningShape: 'examples_non_examples', shouldAskRepresentationFollowup: false }
  );
  assert.deepEqual(
    detectAnswerRepresentationIntent('common mistakes with distance and displacement'),
    { requestedRepresentation: 'default', requestedLearningShape: 'common_mistakes', shouldAskRepresentationFollowup: false }
  );

  const frictionCards = routeWithTeacherKnowledge('make flashcards for types of friction');
  assert.equal(frictionCards.type, 'science_concept');
  assert.equal(frictionCards.representationIntent.requestedLearningShape, 'flashcards');
  assert.match(frictionCards.directAnswer, /1\. Static Friction\n\s+Answer: Friction that keeps an object from starting to move\./i);
  assert.match(frictionCards.directAnswer, /2\. Sliding Friction/i);
  assert.match(frictionCards.directAnswer, /3\. Rolling Friction/i);

  const newtonCards = routeWithTeacherKnowledge('flashcards for Newton\'s laws');
  assert.equal(newtonCards.representationIntent.requestedLearningShape, 'flashcards');
  assert.match(newtonCards.directAnswer, /1\. First law \/ inertia/i);
  assert.match(newtonCards.directAnswer, /2\. Second law[\s\S]*F = m × a/i);
  assert.match(newtonCards.directAnswer, /3\. Third law[\s\S]*equal and opposite reaction force/i);
  assert.doesNotMatch(newtonCards.directAnswer, /Type show to see the answer/i);

  const frictionCardsStudy = routeWithTeacherKnowledge('study cards for motion graphs');
  assert.equal(frictionCardsStudy.representationIntent.requestedLearningShape, 'flashcards');
  assert.match(frictionCardsStudy.directAnswer, /Distance-time graph slope/i);
  assert.doesNotMatch(frictionCardsStudy.directAnswer, /Type show to see the answer/i);

  const frictionExamples = routeWithTeacherKnowledge('give me examples and non-examples of friction');
  assert.equal(frictionExamples.representationIntent.requestedLearningShape, 'examples_non_examples');
  assert.match(frictionExamples.directAnswer, /Examples:/i);
  assert.match(frictionExamples.directAnswer, /Static friction: a book staying still on a desk/i);
  assert.match(frictionExamples.directAnswer, /Non-examples:/i);
  assert.match(frictionExamples.directAnswer, /Gravity pulling downward is not friction/i);

  const distanceMistakes = routeWithTeacherKnowledge('common mistakes with distance and displacement');
  assert.equal(distanceMistakes.representationIntent.requestedLearningShape, 'common_mistakes');
  assert.match(distanceMistakes.directAnswer, /Do not use total path as displacement/i);
  assert.match(distanceMistakes.directAnswer, /Do not forget direction for displacement/i);

  const speedVelocity = routeWithTeacherKnowledge('compare speed and velocity');
  assert.equal(speedVelocity.representationIntent.requestedRepresentation, 'comparison');
  assert.equal(speedVelocity.representationIntent.requestedLearningShape, 'compare_contrast');
  assert.match(speedVelocity.directAnswer, /Speed: Speed tells how fast something moves\./i);
  assert.match(speedVelocity.directAnswer, /Velocity: Velocity is speed with direction\./i);

  const speedVelocityDifference = routeWithTeacherKnowledge('What is the difference between speed and velocity?');
  assert.match(speedVelocityDifference.directAnswer, /Speed: Speed tells how fast something moves\./i);
  assert.match(speedVelocityDifference.directAnswer, /Velocity[\s\S]*direction/i);

  const contactFieldForces = routeWithTeacherKnowledge('Compare and contrast contact vs field forces.');
  assert.equal(contactFieldForces.type, 'definition');
  assert.match(contactFieldForces.directAnswer, /Contact forces require touching/i);
  assert.match(contactFieldForces.directAnswer, /Field forces act at a distance without direct contact/i);
  assert.match(contactFieldForces.directAnswer, /friction, normal force, applied force, tension/i);
  assert.match(contactFieldForces.directAnswer, /gravity, magnetic force, electric force/i);

  const motionGraphs = routeWithTeacherKnowledge('flashcards for motion graphs');
  assert.equal(motionGraphs.representationIntent.requestedLearningShape, 'flashcards');
  assert.match(motionGraphs.directAnswer, /Distance-time graph slope/i);
  assert.match(motionGraphs.directAnswer, /Velocity-time or speed-time graph slope/i);

  const distanceDisplacementExamples = routeWithTeacherKnowledge('examples and non examples of distance and displacement');
  assert.equal(distanceDisplacementExamples.representationIntent.requestedLearningShape, 'examples_non_examples');
  assert.match(distanceDisplacementExamples.directAnswer, /Examples:/i);
  assert.match(distanceDisplacementExamples.directAnswer, /Non-examples:/i);
  assert.doesNotMatch(distanceDisplacementExamples.directAnswer, /not enough local/i);

  const unsupportedExamplePrompts = [
    ['give me an example of speed', 'class_fact'],
    ['example of kinetic energy', 'class_fact'],
    ['can you give an example of each', 'no_match']
  ];
  for (const [prompt, expectedType] of unsupportedExamplePrompts) {
    const route = routeWithTeacherKnowledge(prompt);
    assert.equal(route.type, expectedType, `${prompt} should fall through to existing trusted routing`);
    assert.doesNotMatch(route.directAnswer, /not enough local/i);
  }
}

function testFrictionSubtypeAndListFormatting() {
  const rolling = routeWithTeacherKnowledge('what is rolling friction');
  assert.equal(rolling.type, 'definition');
  assert.match(rolling.directAnswer, /Rolling friction is friction that resists motion when an object rolls over a surface/i);
  assert.match(rolling.directAnswer, /wheel or ball rolling/i);
  assert.equal(rolling.representationIntent.requestedRepresentation, 'paragraph');

  const sliding = routeWithTeacherKnowledge('what is sliding friction');
  assert.equal(sliding.type, 'definition');
  assert.match(sliding.directAnswer, /Sliding friction is friction that resists motion when two surfaces slide past each other/i);

  const staticFriction = routeWithTeacherKnowledge('what is static friction');
  assert.equal(staticFriction.type, 'definition');
  assert.match(staticFriction.directAnswer, /Static friction is friction that prevents surfaces from starting to slide/i);

  for (const prompt of ['what are the types of friction', 'list the types of frictions', 'types of friction']) {
    const route = routeWithTeacherKnowledge(prompt);
    assert.equal(route.type, 'science_concept', `${prompt} should route to local friction type list`);
    assert.match(route.directAnswer, /^1\. Static friction — keeps objects from starting to slide\./);
    assert.match(route.directAnswer, /\n2\. Sliding friction — resists surfaces sliding past each other\./);
    assert.match(route.directAnswer, /\n3\. Rolling friction — resists rolling motion\./);
    assert.doesNotMatch(route.directAnswer, /Static friction, sliding friction, and rolling friction/);
    assert.equal(route.representationIntent.requestedRepresentation, 'numbered_list');
  }

  const diagramRequest = routeWithTeacherKnowledge('what is rolling friction diagram');
  assert.equal(diagramRequest.type, 'definition');
  assert.equal(diagramRequest.representationIntent.requestedRepresentation, 'image_request');
  assert.equal(diagramRequest.imageRequest.needsImageAsset, true);
  assert.equal(diagramRequest.imageRequest.imageQuery.source, 'local_classroom_assets');
}

function testRollingFrictionFormulaFallback() {
  const route = routeWithTeacherKnowledge('how do I solve for rolling friction');
  assert.equal(route.type, 'science_formula');
  assert.match(route.directAnswer, /Use the rolling-friction formula/i);
  assert.match(route.directAnswer, /F_rolling = μ_r × F_N/i);
  assert.match(route.directAnswer, /coefficient of rolling friction, μ_r/i);
  assert.match(route.directAnswer, /normal force, F_N/i);
  assert.doesNotMatch(route.directAnswer, /electric|electricity|charge|static electricity/i);
}

function testNewtonAndConservationLawLists() {
  for (const prompt of ['what are newtons 3 laws', 'can you list newtons laws?', 'list Newton\'s three laws', 'what are Newton\'s laws']) {
    const route = routeWithTeacherKnowledge(prompt);
    assert.equal(route.type, 'science_concept', `${prompt} should route to local Newton laws list`);
    assert.match(route.directAnswer, /^1\. First law \/ inertia — An object at rest stays at rest/i);
    assert.match(route.directAnswer, /\n2\. Second law — Force equals mass times acceleration, F = m × a\./);
    assert.match(route.directAnswer, /\n3\. Third law — For every action force, there is an equal and opposite reaction force\./);
    assert.equal(route.representationIntent.requestedRepresentation, 'numbered_list');
  }

  const conservation = routeWithTeacherKnowledge('can you list all the laws of conservation?');
  assert.equal(conservation.type, 'science_concept');
  assert.match(conservation.directAnswer, /strongest local fact for is conservation of momentum/i);
  assert.match(conservation.directAnswer, /1\. Conservation of momentum — total momentum stays the same in a closed system\./);
  assert.match(conservation.directAnswer, /2\. Conservation of energy — energy is not created or destroyed/i);
  assert.match(conservation.directAnswer, /3\. Conservation of mass\/matter — matter is not created or destroyed/i);
  assert.equal(conservation.representationIntent.requestedRepresentation, 'numbered_list');
}

function testMotionForceSummaryAndExplainDirectAnswers() {
  const summary = routeWithTeacherKnowledge('Summarize the different ways that motion can be described and measured.');
  assert.equal(summary.type, 'science_concept');
  assert.match(summary.directAnswer, /Motion (?:can be described|is described) by comparing (?:an object’s )?position to a reference point/i);
  assert.match(summary.directAnswer, /Distance (?:tells|is) the total path traveled/i);
  assert.match(summary.directAnswer, /slope on a (?:speed-time or )?velocity-time graph shows acceleration/i);
  assert.ok(summary.directAnswer, 'plain summary prompt should answer directly by default');

  const acceleration = routeWithTeacherKnowledge('Explain the different changes in motion that could cause an object to accelerate.');
  assert.ok(['science_concept', 'definition'].includes(acceleration.type));
  assert.equal(
    acceleration.directAnswer,
    'An object accelerates when its velocity changes. That can happen when it speeds up, slows down, or changes direction.'
  );
  assert.ok(acceleration.directAnswer, 'plain explain prompt should answer directly by default');
}

function testKnowledgeConceptPromptsAnswerDirectly() {
  const cases = [
    ['what is Reference point', /reference point is the place or object/i],
    ['Summarize the different ways that motion can be described and measured.', /Motion (?:can be described|is described) by comparing (?:an object’s )?position to a reference point/i],
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

function testExplicitFromRestAccelerationTeachesVelocityConversion() {
  const question = 'calculate acceleration from rest to 70 km/hr in 7 seconds';
  let tutor = startTutorAtStep(question, 'identify_final_velocity', {
    identify_solve_target: 'acceleration',
    choose_formula: 'a = (vf - vi) / t',
    identify_initial_velocity: '0'
  });

  const finalVelocity = answerFormulaTutorStep(tutor, '70');
  assertAccepted(finalVelocity, 'Tutor should accept the original 70 km/hr final velocity');
  assert.match(finalVelocity.response, /Correct\. The final velocity is 70 km\/hr/i);
  assert.match(finalVelocity.response, /Because time is in seconds and acceleration is in m\/s², we convert km\/hr to m\/s/i);
  assert.match(finalVelocity.response, /Convert 70 km\/hr to m\/s: 70 × 1000 ÷ 3600 = \?/i);

  tutor = finalVelocity.currentTutorProblem;
  assert.equal(currentStep(tutor).id, 'convert_final_velocity');
  const conversion = answerFormulaTutorStep(tutor, '19.4444');
  assertAccepted(conversion, 'Tutor should accept the converted final velocity');
  assert.match(conversion.response, /70 km\/hr × 1000 ÷ 3600 = 19\.4444 m\/s/i);

  tutor = conversion.currentTutorProblem;
  assert.equal(currentStep(tutor).id, 'identify_time');
  const time = answerFormulaTutorStep(tutor, '7');
  assertAccepted(time, 'Tutor should advance from the time step');
  assert.match(time.response, /a = \(19\.4444 - 0\) \/ 7/i);

  const result = answerFormulaTutorStep(time.currentTutorProblem, '2.78');
  assertAccepted(result, 'Tutor should finish with the SI acceleration answer');
  assert.match(result.response, /acceleration = about 2\.78 m\/s²/i);
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

function testForceMotionFoundationalCuePrompts() {
  assert.doesNotThrow(() => routeWithTeacherKnowledge('The relationship among mass, force, and acceleration is explained by ___'));
  const newtonSecondLaw = routeWithTeacherKnowledge('The relationship among mass, force, and acceleration is explained by ___');
  assert.notEqual(newtonSecondLaw.type, 'no_match');
  assert.match(newtonSecondLaw.directAnswer, /Newton’s Second Law|Newton's Second Law/i);

  const airResistance = routeWithTeacherKnowledge('The upward force on an object falling through the air is ____');
  assert.notEqual(airResistance.type, 'no_match');
  assert.match(airResistance.directAnswer, /air resistance/i);

  const acceleration = routeWithTeacherKnowledge('For any object, the greater the force that’s applied to it, the greater its ___');
  assert.notEqual(acceleration.type, 'no_match');
  assert.match(acceleration.directAnswer, /acceleration/i);

  const gravityFactors = routeWithTeacherKnowledge('The size of the gravitational force between two objects depends on their _____');
  assert.notEqual(gravityFactors.type, 'no_match');
  assert.match(gravityFactors.directAnswer, /masses and distance between them/i);

  const balancedForces = routeWithTeacherKnowledge('When two forces on the same object are equal and opposite, these forces are called ___ forces');
  assert.notEqual(balancedForces.type, 'no_match');
  assert.match(balancedForces.directAnswer, /balanced forces/i);

  const force = routeWithTeacherKnowledge('Push or pull one body exerts on another.');
  assert.notEqual(force.type, 'no_match');
  assert.match(force.directAnswer, /force/i);
  assert.match(force.directAnswer, /push or pull/i);
  assert.doesNotMatch(force.directAnswer, /voltage/i);

  const terminalVelocity = routeWithTeacherKnowledge('The highest velocity a falling object will reach.');
  assert.notEqual(terminalVelocity.type, 'no_match');
  assert.match(terminalVelocity.directAnswer, /terminal velocity/i);
  assert.doesNotMatch(terminalVelocity.directAnswer, /^Velocity is speed in a specific direction/i);

  const inertia = routeWithTeacherKnowledge('Tendency of an object to resist changes in motion.');
  assert.notEqual(inertia.type, 'no_match');
  assert.match(inertia.directAnswer, /inertia/i);

  const gravity = routeWithTeacherKnowledge('The attraction any two objects have on one another.');
  assert.notEqual(gravity.type, 'no_match');
  assert.match(gravity.directAnswer, /gravity/i);
  assert.doesNotMatch(gravity.directAnswer, /electric charges?/i);

  const formula = routeWithTeacherKnowledge('A 2 N and an 8 N force pull on an object to the right and a 4 N force pulls on the object to the left. If the object has a mass of .5 kg what is its acceleration?');
  assert.equal(formula.type, 'science_formula');
  assert.equal(formula.formulaWork?.formulaId, 'net_force_newton_second_law');
  assert.match(formula.directAnswer, /a = 6 N \/ 0\.5 kg/i);
  assert.match(formula.directAnswer, /12 m\/s² right/i);
}

function testRemainingForceMotionConceptPrompts() {
  const airResistance = routeWithTeacherKnowledge('Which of the following factors does not affect air resistance?');
  assert.equal(airResistance.type, 'science_concept');
  assert.match(airResistance.directAnswer, /speed/i);
  assert.match(airResistance.directAnswer, /shape|frontal area|surface area/i);
  assert.match(airResistance.directAnswer, /air or fluid conditions|density/i);
  assert.doesNotMatch(airResistance.directAnswer, /^Air resistance is drag, a force that resists motion through air/i);

  const freeFall = routeWithTeacherKnowledge('An object that is falling freely has a constant what?');
  assert.notEqual(freeFall.type, 'no_match');
  assert.match(freeFall.directAnswer, /acceleration/i);
  assert.match(freeFall.directAnswer, /gravity|9\.8 m\/s²/i);
  assert.doesNotMatch(freeFall.directAnswer, /^Velocity is speed/i);

  const firstLaw = routeWithTeacherKnowledge('An object will move at a constant velocity unless an unbalanced force acts upon it.');
  assert.equal(firstLaw.type, 'law_identification');
  assert.match(firstLaw.directAnswer, /Newton’s First Law|Newton's First Law/i);
  assert.match(firstLaw.directAnswer, /law of inertia/i);
  assert.doesNotMatch(firstLaw.directAnswer, /^Velocity is speed/i);

  const momentum = routeWithTeacherKnowledge("Related to the amount of force needed to change an object's motion.");
  assert.equal(momentum.type, 'definition');
  assert.match(momentum.directAnswer, /answer is momentum/i);
  assert.match(momentum.directAnswer, /tendency to resist changes in motion.*inertia/i);

  const inertia = routeWithTeacherKnowledge('Tendency of an object to resist changes in motion.');
  assert.notEqual(inertia.type, 'no_match');
  assert.match(inertia.directAnswer, /inertia/i);
  assert.doesNotMatch(inertia.directAnswer, /answer is momentum/i);

  const bowling = routeWithTeacherKnowledge('Why does it take more effort to make a bowling ball accelerate 25 m/s² than to make a tennis ball accelerate 25 m/s²? Make sure to include which law explains this.');
  assert.equal(bowling.type, 'law_identification');
  assert.match(bowling.directAnswer, /Newton’s Second Law|Newton's Second Law/i);
  assert.match(bowling.directAnswer, /more mass/i);
  assert.match(bowling.directAnswer, /more force/i);
  assert.doesNotMatch(bowling.directAnswer, /compound|chemistry|sodium chloride|NaCl/i);

  const trampoline = routeWithTeacherKnowledge('How does a trampoline work? Make sure to include which law explains this.');
  assert.equal(trampoline.type, 'law_identification');
  assert.match(trampoline.directAnswer, /Newton’s Third Law|Newton's Third Law/i);
  assert.match(trampoline.directAnswer, /pushes down/i);
  assert.match(trampoline.directAnswer, /pushes up/i);
  assert.doesNotMatch(trampoline.directAnswer, /swimmer|water backward/i);

  const chair = routeWithTeacherKnowledge('A man weighing 800 N is standing on a chair. In order to support the man, what force is the chair exerting?');
  assert.equal(chair.type, 'science_concept');
  assert.match(chair.directAnswer, /800 N upward/i);
  assert.match(chair.directAnswer, /normal force|support force/i);

  const friction = routeWithTeacherKnowledge('Explain the factors that affect the amount of friction and list the 3 types of friction.');
  assert.equal(friction.type, 'science_concept');
  assert.match(friction.directAnswer, /roughness or type of surface/i);
  assert.match(friction.directAnswer, /force pressing the surfaces together|normal force/i);
  assert.match(friction.directAnswer, /surface area/i);
  assert.match(friction.directAnswer, /Static friction/i);
  assert.match(friction.directAnswer, /Sliding friction/i);
  assert.match(friction.directAnswer, /Rolling friction/i);

  for (const prompt of [
    'Which law states, “To every action there is an equal but opposite reaction”?',
    'Which law states, “o every action there is an equal but opposite reaction”?'
  ]) {
    const thirdLaw = routeWithTeacherKnowledge(prompt);
    assert.equal(thirdLaw.type, 'law_identification');
    assert.match(thirdLaw.directAnswer, /Newton’s Third Law|Newton's Third Law/i);
  }
}

function testPatch3ComposedForceMotionFormulaPrompts() {
  const multiAxisNetForce = routeWithTeacherKnowledge('An object has 16 N of force being applied to the right, 16 N of force being applied to the left, and 4 N of force being applied downward. What is the net force on the object?');
  assert.equal(multiAxisNetForce.type, 'science_formula');
  assert.equal(multiAxisNetForce.formulaWork?.formulaId, 'net_force');
  assert.match(multiAxisNetForce.directAnswer, /16 N right and 16 N left cancel out/i);
  assert.match(multiAxisNetForce.directAnswer, /net force is 4 N downward/i);
  assert.doesNotMatch(multiAxisNetForce.directAnswer, /^Newton.?s Second Law/i);

  const multiAxisAcceleration = routeWithTeacherKnowledge('An object has 16 N of force being applied to the right, 16 N of force being applied to the left, and 4 N of force being applied downward. What is the acceleration of the object if it’s mass is 0.35 kg?');
  assert.equal(multiAxisAcceleration.type, 'science_formula');
  assert.equal(multiAxisAcceleration.formulaWork?.formulaId, 'net_force_newton_second_law');
  assert.ok(multiAxisAcceleration.formulaWork.steps.length > 0);
  assert.match(multiAxisAcceleration.directAnswer, /16 N right and 16 N left cancel out/i);
  assert.match(multiAxisAcceleration.directAnswer, /a = 4 N \/ 0\.35 kg/i);
  assert.match(multiAxisAcceleration.directAnswer, /11\.4\d* m\/s² downward/i);

  for (const mass of ['.5', '0.5', '0.50']) {
    const route = routeWithTeacherKnowledge(`A 2 N and an 8 N force pull on an object to the right and a 4 N force pulls on the object to the left. If the object has a mass of ${mass} kg what is its acceleration?`);
    assert.equal(route.type, 'science_formula');
    assert.equal(route.formulaWork?.formulaId, 'net_force_newton_second_law');
    assert.ok(route.formulaWork.steps.length > 0);
    assert.match(route.directAnswer, /a = 6 N \/ 0\.5 kg/i);
    assert.match(route.directAnswer, /12 m\/s² right/i);
  }

  const boulder = routeWithTeacherKnowledge('If a 53 kg boulder falls off a cliff, what is the force with which it will hit the ground?');
  assert.equal(boulder.type, 'science_formula');
  assert.equal(boulder.formulaWork?.formulaId, 'weight_mass_gravity');
  assert.ok(boulder.formulaWork.steps.length > 0);
  assert.match(boulder.directAnswer, /Fg = 53 kg × 9\.8 m\/s²/i);
  assert.match(boulder.directAnswer, /Fg = 519\.4 N downward/i);

  const runner = routeWithTeacherKnowledge('A runner has a speed of 25 m/s. They see the finish line and speed up to 30 m/s. This happens in 5 seconds. If the runner has a mass of 75 kg, with what force did the runner cross the finish line? Show all work to receive full credit.');
  assert.equal(runner.type, 'science_formula');
  assert.equal(runner.formulaWork?.formulaId, 'force_from_velocity_change');
  assert.ok(runner.formulaWork.steps.length > 0);
  assert.match(runner.directAnswer, /a = \(30 m\/s - 25 m\/s\) \/ 5 s/i);
  assert.match(runner.directAnswer, /F = 75 kg × 1 m\/s²/i);
  assert.match(runner.directAnswer, /F = 75 N/i);

  const truck = routeWithTeacherKnowledge('What is the mass of a truck that has a momentum of 10,000 kg*m/s and a velocity of 4 m/s North?');
  assert.equal(truck.type, 'science_formula');
  assert.equal(truck.formulaWork?.formulaId, 'momentum_mass_velocity');
  assert.ok(truck.formulaWork.steps.length > 0);
  assert.match(truck.directAnswer, /m = 10000 kg·m\/s \/ 4 m\/s/i);
  assert.match(truck.directAnswer, /m = 2500 kg/i);
  assert.doesNotMatch(truck.directAnswer, /^Momentum is/i);

  const collision = routeWithTeacherKnowledge('In a collision, a 25 kg ball moving at 3 m/s transfers all of its momentum to a 5 kg ball. What is the velocity of the 5 kg ball after the collision?');
  assert.equal(collision.type, 'science_formula');
  assert.equal(collision.formulaWork?.formulaId, 'momentum_transfer_velocity');
  assert.ok(collision.formulaWork.steps.length > 0);
  assert.match(collision.directAnswer, /p = 25 kg × 3 m\/s/i);
  assert.match(collision.directAnswer, /p = 75 kg·m\/s/i);
  assert.match(collision.directAnswer, /v = 75 kg·m\/s \/ 5 kg/i);
  assert.match(collision.directAnswer, /v = 15 m\/s forward/i);
  assert.doesNotMatch(collision.directAnswer, /^Momentum is/i);

  const bocce = routeWithTeacherKnowledge('You and your friends are playing Bocce ball on the beach. The small white ball is sitting in the sand and has a mass of 0.05 kg. You toss your 0.2 kg red ball and it rolls with a velocity of 3.9 m/s towards the white ball. They collide, and the red ball transfers all of its momentum to the white ball. Find the velocity of the white ball after the collision.');
  assert.equal(bocce.type, 'science_formula');
  assert.equal(bocce.formulaWork?.formulaId, 'momentum_transfer_velocity');
  assert.match(bocce.directAnswer, /p = 0\.2 kg × 3\.9 m\/s/i);
  assert.match(bocce.directAnswer, /p = 0\.78 kg·m\/s/i);
  assert.match(bocce.directAnswer, /v = 0\.78 kg·m\/s \/ 0\.05 kg/i);
  assert.match(bocce.directAnswer, /v = 15\.6 m\/s forward/i);
  assert.doesNotMatch(bocce.directAnswer, /^Momentum is/i);

  const bike = routeWithTeacherKnowledge('A man and his bike are 95 kg. His instantaneous speed at one point is 14m/s. The next time his speed is checked he is going 28m/s. If the second speed was taken 7 seconds later, what force must the man have given his bike to change the speed? What was the bicyclist\'s final momentum?');
  assert.equal(bike.type, 'science_formula');
  assert.equal(bike.formulaWork?.formulaId, 'force_and_final_momentum');
  assert.ok(bike.formulaWork.steps.length > 0);
  assert.match(bike.directAnswer, /a = \(28 m\/s - 14 m\/s\) \/ 7 s/i);
  assert.match(bike.directAnswer, /F = 190 N/i);
  assert.match(bike.directAnswer, /p = 95 kg × 28 m\/s/i);
  assert.match(bike.directAnswer, /p = 2660 kg·m\/s/i);
  assert.doesNotMatch(bike.directAnswer, /1330 kg·m\/s/i);
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
