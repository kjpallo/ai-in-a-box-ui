const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  answerFormulaTutorStep,
  buildFormulaTutorMetadata,
  startFormulaTutor
} = require('../lib/tutor/formulaTutor');
const {
  tryAmmoniaBalancingActivity
} = require('../lib/tutor/activities/ammoniaBalancingActivity');
const { tryMathOnly } = require('../lib/router/mathCalculator');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const projectRoot = path.join(__dirname, '..');
const studentUiSource = fs.readFileSync(path.join(projectRoot, 'public', 'student', 'student-ui.js'), 'utf8');
const renderHooks = loadStudentUiHooks();

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

async function main() {
  assert.equal(typeof renderHooks.renderTutorSessionStep, 'function');
  assert.equal(typeof renderHooks.shouldProtectTutorCalculator, 'function');

  await testReportedDistanceFlow();
  await testRepresentativeFormulaFamilies();
  await testMetricTargetMarkerServerValidation();
  await testBalancingReductionProjection();
  await testSafeAuthoredGuidance();
  await testOrdinaryResponsesRemainUnchanged();
  testKnowledgeGraphProjectionAndGuidance();
  testStructuralVisualMetadataProjection();
  testMissingPresentationFieldFallback();
  testTutorCalculatorProtection();

  console.log('formula tutor answer integrity: earned activity/visual projections, safe guidance, UI, calculator, and cross-family coverage passed');
}

async function testReportedDistanceFlow() {
  const harness = await createHarnessSession();
  const studentHubId = 'formula-tutor-answer-integrity-distance';
  const question = 'Timmy is walking at 5 m/s for two hours. How far did he travel?';

  const start = await send(harness, studentHubId, question);
  assert.equal(start.body.routeType, 'formula_tutor');
  assert.equal(start.body.tutor.currentStep.id, 'identify_solve_target');
  assert.equal(start.body.tutor.solveFor, '', 'The solve target must stay private until that checkpoint is earned.');
  assert.equal(start.body.tutor.formula, '', 'The formula must stay private until the formula checkpoint is earned.');
  assert.doesNotMatch(start.body.response, /7200/, 'The first response must not reveal the future conversion result.');
  assertKnownValueAbsent(start.body.tutor, '7200');
  assertActiveMetadataIsProjected(start.body.tutor);

  const solveTarget = await send(harness, studentHubId, '2');
  assert.equal(solveTarget.body.tutor.solveFor, 'distance', 'The correctly selected solve target should be released.');
  assert.equal(solveTarget.body.tutor.formula, '', 'The formula should remain private while it is the active checkpoint.');

  const formula = await send(harness, studentHubId, '1');
  assert.equal(formula.body.tutor.formula, 'distance = speed × time', 'The correctly selected formula should be released.');
  assert.equal(formula.body.tutor.currentStep.id, 'identify_time');
  assert.equal(formula.body.tutor.currentStep.displayEquation, 'distance = 5 × {{blank}}');
  assertKnownValueAbsent(formula.body.tutor, '7200');

  const time = await send(harness, studentHubId, '2 hours');
  assert.equal(time.body.tutor.currentStep.id, 'convert_time');
  assert.doesNotMatch(time.body.response, /7200/, 'Earning the given time must not release the unsolved conversion result.');
  assert.deepEqual(
    time.body.tutor.knownValues,
    [{ label: 'time', symbol: 't', display: '2 hours' }],
    'Only the time value actually earned at the prior checkpoint should be known.'
  );
  assertKnownValueAbsent(time.body.tutor, '7200');
  assertActiveMetadataIsProjected(time.body.tutor);

  const wrongConversion = await send(harness, studentHubId, '1');
  assert.equal(wrongConversion.body.tutor.currentStep.id, 'convert_time');
  assert.doesNotMatch(wrongConversion.body.response, /7200/);
  assert.doesNotMatch(wrongConversion.body.tutor.currentHint, /7200/);
  assert.equal(wrongConversion.body.tutor.work.calculatorCheck, null);
  assert.equal(wrongConversion.body.tutor.work.latestStudentReply, '1', 'The student submission may remain visible as their own work.');

  const conversion = await send(harness, studentHubId, '7200');
  assert.equal(conversion.body.tutor.currentStep.id, 'identify_speed');
  assert.equal(conversion.body.tutor.currentStep.displayEquation, 'distance = {{blank}} × 7200');
  assertKnownValuePresent(conversion.body.tutor, '7200', 'The correctly completed conversion should be available later.');
  assertKnownValueAbsent(conversion.body.tutor, '5 m/s', 'The active speed value must not be copied into known-value metadata.');

  const wrongSpeed = await send(harness, studentHubId, '36000');
  assert.equal(wrongSpeed.body.tutor.currentStep.id, 'identify_speed');
  assert.equal(wrongSpeed.body.tutor.currentStep.displayEquation, 'distance = {{blank}} × 7200');
  assert.doesNotMatch(wrongSpeed.body.response, /speed\s*(?:=|is)\s*5\b/i);
  assert.doesNotMatch(wrongSpeed.body.tutor.currentHint, /\b5\s*m\/s\b/i);
  assertKnownValueAbsent(wrongSpeed.body.tutor, '5 m/s');
  assert.equal(wrongSpeed.body.tutor.work.latestStudentReply, '36000');
  assertActiveMetadataIsProjected(wrongSpeed.body.tutor);

  const wrongSpeedHtml = renderHooks.renderTutorSessionStep({
    id: 'answer-integrity-wrong-speed',
    tutor: wrongSpeed.body.tutor,
    response: wrongSpeed.body.response,
    message: '36000',
    tutorSubmittedMessage: '36000'
  }, {
    isLatestActiveStep: true,
    stepIndex: 4,
    previousTurn: {
      id: 'answer-integrity-conversion',
      tutor: conversion.body.tutor,
      response: conversion.body.response,
      message: '7200',
      tutorSubmittedMessage: '7200'
    }
  });
  assert.match(wrongSpeedHtml, /Student answer[\s\S]*36000/, 'The student’s own wrong submission should remain visible.');
  assert.match(wrongSpeedHtml, /Not quite yet/, 'The wrong submission must not be presented as correct.');
  assert.match(
    wrongSpeedHtml,
    /aria-label="Equation: distance = blank × 7200"/,
    'Accessibility text must preserve the active blank instead of exposing the requested speed.'
  );
  assert.doesNotMatch(wrongSpeedHtml, /speed \(v\): 5 m\/s/, 'Hidden and visible known-value UI must omit the active answer.');

  const speed = await send(harness, studentHubId, '5');
  assert.equal(speed.body.tutor.currentStep.id, 'calculate');
  assert.equal(speed.body.tutor.currentStep.displayEquation, 'distance = 5 × 7200 = {{blank}}');
  assert.equal(speed.body.tutor.work.substitution, 'distance = 5 × 7200');
  assert.equal(speed.body.tutor.work.calculatorCheck, null);
  assert.equal(speed.body.tutor.work.finalAnswer, '');
  assertKnownValuePresent(speed.body.tutor, '5 m/s', 'The correctly submitted speed should be released for later work.');
  assert.doesNotMatch(speed.body.response, /36000/, 'The final result must remain private before final completion.');

  const wrongFinal = await send(harness, studentHubId, '1');
  assert.equal(wrongFinal.body.tutor.currentStep.id, 'calculate');
  assert.doesNotMatch(wrongFinal.body.response, /36000/);
  assert.doesNotMatch(wrongFinal.body.tutor.currentHint, /36000/);
  assert.equal(wrongFinal.body.tutor.work.calculatorCheck, null);
  assert.equal(wrongFinal.body.tutor.work.finalAnswer, '');
  assert.equal(wrongFinal.body.tutor.work.answer, '');

  const wrongFinalHtml = renderHooks.renderTutorSessionStep({
    id: 'answer-integrity-wrong-final',
    tutor: wrongFinal.body.tutor,
    response: wrongFinal.body.response,
    message: '1',
    tutorSubmittedMessage: '1'
  }, {
    isLatestActiveStep: true,
    stepIndex: 5,
    previousTurn: {
      id: 'answer-integrity-speed',
      tutor: speed.body.tutor,
      response: speed.body.response,
      message: '5',
      tutorSubmittedMessage: '5'
    }
  });
  assert.match(wrongFinalHtml, /distance = 5 × 7200 = <span class="student-tutor-equation-blank"/);
  assert.match(wrongFinalHtml, /aria-label="Equation: distance = 5 × 7200 = blank"/);
  assert.doesNotMatch(wrongFinalHtml, /36000/, 'Visible, hidden, and accessibility HTML must not expose the final result.');

  const privateProblem = getPrivateTutorProblem(harness, studentHubId);
  assert.equal(
    privateProblem.steps[privateProblem.currentStepIndex].expectedValue,
    36000,
    'Expected-answer validation should remain in private server state.'
  );
  assert.equal(Object.hasOwn(wrongFinal.body.tutor.currentStep, 'expectedValue'), false);
  assert.equal(Object.hasOwn(wrongFinal.body.tutor.work.currentStep, 'expectedValue'), false);

  const completed = await send(harness, studentHubId, '36000');
  assert.equal(completed.body.tutor.completed, true);
  assert.equal(completed.body.tutor.active, false);
  assert.match(completed.body.response, /distance = 36000 m/i);
  assert.equal(completed.body.tutor.work.finalAnswer, 'distance = 36000 m');
  assert.equal(completed.body.tutor.work.calculatorCheck.display, '5 × 7200 = 36000');
}

async function testRepresentativeFormulaFamilies() {
  await assertFamilyFlow({
    studentHubId: 'formula-tutor-answer-integrity-force',
    question: 'A 3 kg cart accelerates at 2 m/s^2. What force is needed?',
    answersBeforeFinal: ['force', '1', '3 kg', '2 m/s2'],
    formulaId: 'force_mass_acceleration',
    finalValue: 6,
    finalDisplay: /force = 6 N/i
  });

  await assertFamilyFlow({
    studentHubId: 'formula-tutor-answer-integrity-electricity',
    question: 'A circuit has a current of 2 A and a resistance of 6 ohms. What is the voltage?',
    answersBeforeFinal: ['voltage', '1', '2 A', '6 ohms'],
    formulaId: 'voltage_current_resistance',
    finalValue: 12,
    finalDisplay: /voltage = 12 V/i
  });
}

async function assertFamilyFlow({
  studentHubId,
  question,
  answersBeforeFinal,
  formulaId,
  finalValue,
  finalDisplay
}) {
  const harness = await createHarnessSession();
  let response = await send(harness, studentHubId, question);
  assert.equal(response.body.tutor.formulaId, formulaId);

  for (const answer of answersBeforeFinal) {
    response = await send(harness, studentHubId, answer);
  }

  assert.equal(response.body.tutor.currentStep.type, 'calculation');
  assert.equal(response.body.tutor.work.finalAnswer, '');
  assert.equal(response.body.tutor.work.calculatorCheck, null);
  assertActiveMetadataIsProjected(response.body.tutor);

  const wrong = await send(harness, studentHubId, '999999');
  assert.equal(wrong.body.tutor.currentStep.type, 'calculation');
  assert.equal(wrong.body.tutor.work.finalAnswer, '');
  assert.equal(wrong.body.tutor.work.calculatorCheck, null);
  assert.doesNotMatch(wrong.body.response, new RegExp(`(?:answer|result|=|is)\\s*${finalValue}\\b`, 'i'));

  const completed = await send(harness, studentHubId, String(finalValue));
  assert.equal(completed.body.tutor.completed, true);
  assert.match(completed.body.response, finalDisplay);
}

async function testMetricTargetMarkerServerValidation() {
  const harness = await createHarnessSession();
  const studentHubId = 'formula-tutor-answer-integrity-metric-marker';
  await send(harness, studentHubId, 'Convert 48 km to meters.');
  const stair = await send(harness, studentHubId, '1');
  const visual = stair.body.tutor.visualMetadata;

  assert.equal(stair.body.tutor.currentStep.id, 'move_marker_to_target');
  assert.equal(visual.visualType, 'metric_stair_step');
  assert.equal(visual.startValue, 48);
  assert.equal(visual.startUnit, 'km');
  assert.equal(visual.targetUnit, 'm');
  for (const key of ['autoCompleteAnswer', 'resultValue', 'resultUnit', 'stepValues']) {
    assert.equal(Object.hasOwn(visual, key), false, `Active metric metadata should omit ${key}.`);
  }
  assert.doesNotMatch(JSON.stringify(stair.body.tutor), /48,?000/, 'Active Tutor state should omit the result.');

  const html = renderHooks.renderMetricStairStepVisual(visual, 'metric-integrity-active', {
    tutor: stair.body.tutor,
    work: stair.body.tutor.work
  });
  assert.doesNotMatch(
    html,
    /48,?000/,
    'The active metric result must not appear in visible text, hidden DOM, ARIA text, or data attributes.'
  );

  const targetIndex = visual.steps.findIndex((step) => step.label === visual.targetPrefix);
  const clientAction = renderHooks.getMetricStairStepCompletionAction(visual, targetIndex);
  assert.match(clientAction, /^formula_visual_action:/);
  assert.doesNotMatch(clientAction, /48,?000|autoCompleteAnswer|resultValue/);
  assert.deepEqual(
    JSON.parse(clientAction.slice('formula_visual_action:'.length)),
    { type: 'metric_marker_position', markerPrefix: 'UNIT' },
    'The browser should submit only the selected marker position.'
  );

  let privateProblem = getPrivateTutorProblem(harness, studentHubId);
  assert.equal(privateProblem.visualMetadata.resultValue, 48000);
  assert.equal(privateProblem.visualMetadata.autoCompleteAnswer, '48,000 m');
  assert.equal(privateProblem.steps[privateProblem.currentStepIndex].expected, '48,000 m');

  const wrong = await send(
    harness,
    studentHubId,
    'formula_visual_action:{"type":"metric_marker_position","markerPrefix":"h"}'
  );
  assert.equal(wrong.body.tutor.currentStep.id, 'move_marker_to_target');
  assert.equal(wrong.body.tutor.active, true);
  assert.equal(wrong.body.tutor.latestStudentReply, 'Moved the metric marker');
  assert.doesNotMatch(JSON.stringify(wrong.body.tutor), /48,?000/);
  privateProblem = getPrivateTutorProblem(harness, studentHubId);
  assert.equal(privateProblem.currentStepIndex, 1, 'Private server state should reject an incorrect marker.');

  const completed = await send(harness, studentHubId, clientAction);
  assert.equal(completed.body.tutor.completed, true);
  assert.equal(completed.body.tutor.active, false);
  assert.equal(completed.body.tutor.latestStudentReply, 'Moved the metric marker to the target unit');
  assert.equal(completed.body.tutor.visualMetadata.resultValue, 48000);
  assert.equal(completed.body.tutor.finalAnswer.value, 48000);
  assert.match(completed.body.response, /48 km\s*=\s*48,?000 m/i);
}

async function testBalancingReductionProjection() {
  const question = 'Balance this equation: __ N2 + __ H2 → __ NH3';
  const questionRoute = tryAmmoniaBalancingActivity(question);
  let privateProblem = startFormulaTutor({ questionRoute, originalQuestion: question });
  assert.ok(privateProblem, 'The trusted balancing activity should create private Tutor state.');
  const performAction = (type, payload = {}) => {
    const result = answerFormulaTutorStep(
      privateProblem,
      `balance_activity:${JSON.stringify({
        type,
        activityId: 'unit9.balance-ammonia',
        ...payload
      })}`
    );
    privateProblem = result.currentTutorProblem || result.completedTutorProblem;
    return {
      body: {
        response: result.response,
        tutor: buildFormulaTutorMetadata(privateProblem, {
          completed: result.completed,
          latestStudentReply: ''
        })
      }
    };
  };
  let response;
  for (const placement of [
    { side: 'reactants', element: 'N', compoundId: 'nitrogen' },
    { side: 'reactants', element: 'H', compoundId: 'hydrogen' },
    { side: 'products', element: 'N', compoundId: 'ammonia' },
    { side: 'products', element: 'H', compoundId: 'ammonia' }
  ]) {
    response = performAction('place_element', placement);
  }
  for (const [compoundId, value] of [['nitrogen', 2], ['hydrogen', 6], ['ammonia', 4]]) {
    response = performAction('set_coefficient', { compoundId, value });
  }
  response = performAction('check_balance');

  assert.deepEqual(
    privateProblem.activityState.balancedNotSimplified.reducedCoefficients,
    [1, 3, 2],
    'Private balancing state should retain the trusted reduction vector for validation.'
  );
  assert.equal(
    Object.hasOwn(response.body.tutor.activity.balancedNotSimplified, 'reducedCoefficients'),
    false,
    'The active activity payload must not publish the full reduced vector.'
  );
  assert.equal(
    Object.hasOwn(response.body.tutor.visualMetadata.balancedNotSimplified, 'reducedCoefficients'),
    false,
    'The active visual payload must not publish the full reduced vector.'
  );
  for (const item of response.body.tutor.activity.reductionProgress.items) {
    assert.equal(
      Object.hasOwn(item, 'reducedCoefficient'),
      false,
      `${item.compoundId} must not expose its future reduced coefficient.`
    );
  }
  for (const item of response.body.tutor.visualMetadata.reductionProgress.items) {
    assert.equal(Object.hasOwn(item, 'reducedCoefficient'), false);
  }
  assert.equal(
    Object.hasOwn(response.body.tutor.activity.reductionProgress, 'reducedCoefficients'),
    false
  );

  const renderBalancing = renderHooks.renderChemicalEquationBalancingVisual;
  assert.equal(typeof renderBalancing, 'function');
  let html = renderBalancing(response.body.tutor.visualMetadata, 'answer-integrity-reduction');
  assert.match(html, /2 ÷ 2 = \?/);
  assert.match(html, /6 ÷ 2 = \?/);
  assert.match(html, /4 ÷ 2 = \?/);
  assert.doesNotMatch(html, /2 ÷ 2 = 1|6 ÷ 2 = 3|4 ÷ 2 = 2/);

  response = performAction('reduce_coefficient', {
    compoundId: 'nitrogen',
    divisor: 2
  });
  const [earned, ...future] = response.body.tutor.activity.reductionProgress.items;
  assert.equal(earned.reducedCoefficient, 1, 'The correctly reduced coefficient should be released.');
  for (const item of future) {
    assert.equal(
      Object.hasOwn(item, 'reducedCoefficient'),
      false,
      `${item.compoundId} should remain hidden until earned.`
    );
  }
  assert.equal(
    response.body.tutor.visualMetadata.reductionProgress.items[0].reducedCoefficient,
    1
  );
  for (const item of response.body.tutor.visualMetadata.reductionProgress.items.slice(1)) {
    assert.equal(Object.hasOwn(item, 'reducedCoefficient'), false);
  }
  assert.equal(
    Object.hasOwn(response.body.tutor.activity.reductionProgress, 'reducedCoefficients'),
    false
  );
  html = renderBalancing(response.body.tutor.visualMetadata, 'answer-integrity-reduction-partial');
  assert.match(html, /2 ÷ 2 = 1/);
  assert.match(html, /6 ÷ 2 = \?/);
  assert.match(html, /4 ÷ 2 = \?/);
  assert.doesNotMatch(html, /6 ÷ 2 = 3|4 ÷ 2 = 2/);
  assert.deepEqual(
    privateProblem.activityState.balancedNotSimplified.reducedCoefficients,
    [1, 3, 2],
    'Public projection must not mutate private validation data.'
  );

  performAction('reduce_coefficient', {
    compoundId: 'hydrogen',
    divisor: 2
  });
  const completed = performAction('reduce_coefficient', {
    compoundId: 'ammonia',
    divisor: 2
  });
  assert.equal(completed.body.tutor.completed, true);
  assert.deepEqual(
    completed.body.tutor.activity.reductionProgress.reducedCoefficients,
    [1, 3, 2],
    'The complete reduced vector may be released only after all reductions are complete.'
  );
  assert.deepEqual(
    completed.body.tutor.visualMetadata.reductionProgress.reducedCoefficients,
    [1, 3, 2]
  );
  assert.deepEqual(
    completed.body.tutor.activity.reductionProgress.items.map((item) => item.reducedCoefficient),
    [1, 3, 2]
  );
  assert.deepEqual(completed.body.tutor.activity.coefficients, {
    nitrogen: 1,
    hydrogen: 3,
    ammonia: 2
  });
}

async function testSafeAuthoredGuidance() {
  const harness = await createHarnessSession();
  const studentHubId = 'formula-tutor-answer-integrity-guidance';
  const question = 'Kai swims for the school swim team. He specializes in a backstroke event where he has to swim the 50-m length of the pool three times. Find his distance and displacement.';
  await send(harness, studentHubId, question);
  for (const answer of ['1', '1', '50 m', '3', '150', '2']) {
    await send(harness, studentHubId, answer);
  }
  const nudge = await send(harness, studentHubId, 'opposite side');
  assert.equal(nudge.body.tutor.currentStep.id, 'calculate_displacement');
  assert.match(
    nudge.body.response,
    /Yes, he is on the opposite side\. What distance is that from where he started\?/
  );
  assert.doesNotMatch(
    nudge.body.response,
    /\b50\b/,
    'The conceptual nudge should guide the reasoning without giving the numerical displacement.'
  );

  const safeHintProblem = buildSyntheticGuidanceProblem({
    hints: ['Use the two earned factors and check that the unit matches the prompt.']
  });
  const safeHint = answerFormulaTutorStep(safeHintProblem, 'hint');
  assert.match(safeHint.response, /Use the two earned factors and check that the unit matches the prompt/);

  const unsafeHintProblem = buildSyntheticGuidanceProblem({
    hints: ['The expected answer is 42 widgets.']
  });
  const unsafeHint = answerFormulaTutorStep(unsafeHintProblem, 'hint');
  assert.doesNotMatch(unsafeHint.response, /\b42\b/);
  assert.match(unsafeHint.response, /Look back at the original problem for the requested quantity and unit/);

  const unsafeNudgeProblem = buildSyntheticGuidanceProblem({
    hints: ['Use the two earned factors.'],
    conceptualNudges: [{
      answers: ['almost'],
      response: 'You are close. The answer is 42 widgets.'
    }]
  });
  const unsafeNudge = answerFormulaTutorStep(unsafeNudgeProblem, 'almost');
  assert.doesNotMatch(unsafeNudge.response, /\b42\b/);
  assert.match(unsafeNudge.response, /Use the two earned factors/);
}

async function testOrdinaryResponsesRemainUnchanged() {
  const harness = await createHarnessSession();
  const direct = await send(harness, 'answer-integrity-direct-response', 'What is gravity?');
  assert.notEqual(direct.body.routeType, 'formula_tutor');
  assert.equal(direct.body.tutor == null, true);
  assert.match(direct.body.response, /9\.8|gravity/i);

  const calculator = tryMathOnly('What is 2 + 3?');
  assert.equal(calculator.value, 5, 'The standalone calculator should remain unchanged outside Formula Tutor.');
  assert.match(calculator.answer, /2\s*\+\s*3\s*=\s*5/);
}

function testKnowledgeGraphProjectionAndGuidance() {
  const problem = buildSyntheticGraphProblem();
  const active = buildFormulaTutorMetadata(problem);
  assert.ok(active.graphTutorSupport, 'Safe graph structure should remain available before the solve-target checkpoint.');
  assert.equal(active.graphTutorSupport.aiAllowed, false);
  assert.equal(active.graphTutorSupport.source, 'approved_knowledge_graph');
  assert.ok(
    active.graphTutorSupport.connectedConcepts.some((concept) => concept.label === 'input'),
    'Safe conceptual graph labels should remain available.'
  );
  assert.ok(
    active.graphTutorSupport.graphPaths.some((path) =>
      path.nodes.includes('input') && path.nodes.includes('relationship')
    ),
    'Safe structural graph paths should remain available without the active target.'
  );
  assert.equal(active.solveFor, '', 'The active solve-target answer should remain owned by its checkpoint.');
  assert.doesNotMatch(
    JSON.stringify(active.graphTutorSupport),
    /"output"/i,
    'The active structural target should not be distinguished by graph metadata before it is earned.'
  );
  assert.doesNotMatch(JSON.stringify(active.graphTutorSupport), /\b42\b|forty-two/i);
  assert.doesNotMatch(JSON.stringify(active.graphTutorSupport), /The expected result is/i);
  assertNoPrivateAnswerKeys(active.graphTutorSupport);

  const hint = answerFormulaTutorStep(problem, 'hint');
  assert.match(hint.response, /Before solving the problem, make sure you know input/i);
  assert.doesNotMatch(hint.response, /\b42\b|forty-two/i);

  const targetEarned = answerFormulaTutorStep(problem, '1');
  const targetProblem = targetEarned.currentTutorProblem;
  const afterTarget = buildFormulaTutorMetadata(targetProblem);
  assert.equal(afterTarget.solveFor, 'output');
  assert.ok(afterTarget.graphTutorSupport, 'Graph metadata should remain available after the target is earned.');
  assert.doesNotMatch(
    JSON.stringify(afterTarget.graphTutorSupport),
    /\b42\b|forty-two/i,
    'The future numeric result should remain absent after the structural target is earned.'
  );

  const futureHint = answerFormulaTutorStep(targetProblem, 'hint');
  assert.match(futureHint.response, /Use the relationship structure and the earned input/i);
  assert.doesNotMatch(futureHint.response, /\b42\b|forty-two/i);

  const completedResult = answerFormulaTutorStep(targetProblem, '42');
  assert.equal(completedResult.completed, true);
  const completed = buildFormulaTutorMetadata(completedResult.completedTutorProblem, { completed: true });
  assert.ok(completed.graphTutorSupport, 'Completed graph metadata should remain available.');
  assert.match(
    JSON.stringify(completed.graphTutorSupport),
    /\b42\b/,
    'Answer-bearing graph metadata may be released only after the value is earned.'
  );
}

function testStructuralVisualMetadataProjection() {
  const unknownVisual = {
    visualType: 'future_widget',
    caption: 'The expected result is 42 widgets.',
    harmlessLookingField: 42,
    resultValue: 42
  };
  const unknownProblem = buildSyntheticVisualProblem(unknownVisual);
  const activeUnknown = buildFormulaTutorMetadata(unknownProblem);
  assert.equal(activeUnknown.visualMetadata, null);
  assert.equal(activeUnknown.work.visualMetadata, null);

  const completedUnknown = buildFormulaTutorMetadata({
    ...unknownProblem,
    currentStepIndex: unknownProblem.steps.length,
    completedSteps: unknownProblem.steps.map((step) => step.id)
  }, { completed: true });
  assert.deepEqual(
    completedUnknown.visualMetadata,
    unknownVisual,
    'Completed visual metadata should retain its existing full representation.'
  );

  const metricProblem = buildSyntheticVisualProblem({
    visualType: 'metric_stair_step',
    baseUnit: 'm',
    startValue: 42,
    startUnit: 'km',
    targetUnit: 'm',
    startPrefix: 'k',
    targetPrefix: 'UNIT',
    steps: [
      { label: 'k', name: 'kilo', exponent: 3, hiddenAnswer: 42 },
      { label: 'UNIT', name: 'base unit', exponent: 0 }
    ],
    decimalMove: { places: 3, direction: 'right', hiddenAnswer: 42 },
    stepValues: [{ value: 42000, display: '42000 m' }],
    resultValue: 42,
    resultUnit: 'm',
    autoCompleteAnswer: '42 m',
    caption: 'The expected result is 42 widgets.',
    arbitraryUnknownKey: 42
  }, {
    steps: [{
      id: 'move_marker_to_target',
      type: 'calculation',
      prompt: 'Move the marker, then enter the value.',
      expectedValue: 42,
      expectedDisplay: '42 m'
    }],
    completedSteps: []
  });
  const metric = buildFormulaTutorMetadata(metricProblem).visualMetadata;
  assert.equal(metric.visualType, 'metric_stair_step');
  assert.equal(metric.startValue, 42, 'A structurally allowed given remains visible even when equal to an answer candidate.');
  assert.equal(metric.targetUnit, 'm');
  assert.deepEqual(metric.steps[0], { label: 'k', name: 'kilo', exponent: 3 });
  for (const key of ['stepValues', 'resultValue', 'resultUnit', 'autoCompleteAnswer', 'caption', 'arbitraryUnknownKey']) {
    assert.equal(Object.hasOwn(metric, key), false, `Active metric projection should omit ${key}.`);
  }
  assert.equal(Object.hasOwn(metric.decimalMove, 'hiddenAnswer'), false);

  const picketProblem = buildSyntheticVisualProblem({
    visualType: 'picket_fence',
    targetUnit: 's',
    given: { value: 2, unit: 'min', hiddenAnswer: 120 },
    cells: [
      {
        position: 0,
        numerator: '2 min',
        denominator: '',
        status: 'empty',
        numeratorSectionId: 'given_value'
      },
      {
        position: 1,
        numerator: '60 s',
        denominator: '1 min',
        status: 'empty',
        numeratorSectionId: 'factor_top',
        denominatorSectionId: 'factor_bottom',
        futureResult: 120
      }
    ],
    fillableSections: [
      {
        id: 'given_value',
        label: 'Given',
        value: '2 min',
        placeholder: 'given',
        unlockAfterStepIds: ['identify_given']
      },
      {
        id: 'factor_top',
        label: 'Top',
        value: '60 s',
        placeholder: 'top',
        unlockAfterStepIds: ['identify_top']
      },
      {
        id: 'factor_bottom',
        label: 'Bottom',
        value: '1 min',
        placeholder: 'bottom',
        unlockAfterStepIds: ['identify_bottom']
      },
      {
        id: 'final_answer',
        label: 'Answer',
        value: '120 s',
        placeholder: 'waiting',
        unlockAfterStepIds: ['calculate_result']
      }
    ],
    cancellationSteps: [{ unit: 'min', explanation: 'Future prose.' }],
    arithmetic: { resultValue: 120, resultUnit: 's' },
    unknownKey: '120 s'
  }, {
    steps: [
      { id: 'identify_given', type: 'quantity', prompt: 'Given?', expectedValue: 2 },
      { id: 'identify_top', type: 'quantity', prompt: 'Top?', expectedValue: 60 },
      { id: 'identify_bottom', type: 'quantity', prompt: 'Bottom?', expectedValue: 1 },
      { id: 'cancel_units', type: 'text', prompt: 'Cancel?', expected: 'min' },
      { id: 'calculate_result', type: 'calculation', prompt: 'Result?', expectedValue: 120 }
    ],
    currentStepIndex: 1,
    completedSteps: ['identify_given']
  });
  const picket = buildFormulaTutorMetadata(picketProblem).visualMetadata;
  assert.deepEqual(picket.given, { value: 2, unit: 'min' });
  assert.equal(picket.cells[0].numerator, '2 min');
  assert.equal(picket.cells[1].numerator, '');
  assert.equal(Object.hasOwn(picket.fillableSections[0], 'value'), true);
  assert.equal(Object.hasOwn(picket.fillableSections[1], 'value'), false);
  assert.equal(Object.hasOwn(picket.fillableSections[3], 'value'), false);
  assert.deepEqual(picket.cancellationSteps, []);
  assert.equal(Object.hasOwn(picket, 'arithmetic'), false);
  assert.equal(Object.hasOwn(picket, 'unknownKey'), false);

  const scientificSource = {
    visualType: 'scientific_notation_decimal_move',
    mode: 'to_standard',
    coefficient: 3,
    exponent: 4,
    decimalMove: { places: 4, direction: 'right', answerText: '30000' },
    resultValue: 30000,
    resultDisplay: '30000',
    caption: 'The expected result is 30000.'
  };
  const scientificSteps = [
    { id: 'identify_coefficient', type: 'quantity', prompt: 'Coefficient?', expectedValue: 3 },
    { id: 'identify_exponent', type: 'quantity', prompt: 'Exponent?', expectedValue: 4 },
    { id: 'choose_decimal_direction', type: 'multiple_choice', prompt: 'Direction?', expected: 'right' },
    { id: 'calculate_standard_number', type: 'calculation', prompt: 'Number?', expectedValue: 30000 }
  ];
  const coefficientEarned = buildFormulaTutorMetadata(buildSyntheticVisualProblem(scientificSource, {
    steps: scientificSteps,
    currentStepIndex: 1,
    completedSteps: ['identify_coefficient']
  })).visualMetadata;
  assert.equal(coefficientEarned.coefficient, 3);
  assert.equal(Object.hasOwn(coefficientEarned, 'exponent'), false);
  assert.equal(Object.hasOwn(coefficientEarned, 'decimalMove'), false);

  const exponentEarned = buildFormulaTutorMetadata(buildSyntheticVisualProblem(scientificSource, {
    steps: scientificSteps,
    currentStepIndex: 2,
    completedSteps: ['identify_coefficient', 'identify_exponent']
  })).visualMetadata;
  assert.equal(exponentEarned.exponent, 4);
  assert.equal(Object.hasOwn(exponentEarned, 'decimalMove'), false);

  const directionEarned = buildFormulaTutorMetadata(buildSyntheticVisualProblem(scientificSource, {
    steps: scientificSteps,
    currentStepIndex: 3,
    completedSteps: ['identify_coefficient', 'identify_exponent', 'choose_decimal_direction']
  })).visualMetadata;
  assert.deepEqual(directionEarned.decimalMove, { direction: 'right', places: 4 });
  assert.equal(Object.hasOwn(directionEarned, 'resultValue'), false);
  assert.equal(Object.hasOwn(directionEarned, 'resultDisplay'), false);
  assert.equal(Object.hasOwn(directionEarned, 'caption'), false);
}

function testMissingPresentationFieldFallback() {
  const tutor = buildFormulaTutorMetadata({
    tutorProblemId: 'optional-presentation-fallback',
    formulaId: 'future_optional_formula',
    family: 'future_family',
    solveFor: 'value',
    formula: 'value = given',
    originalQuestion: 'A safe optional-field fixture.',
    variables: {},
    finalAnswer: { value: 4, display: '4 units' },
    steps: [{
      id: 'enter_value',
      type: 'quantity',
      prompt: 'Enter the requested value.',
      expectedValue: 4,
      expectedDisplay: '4 units'
    }],
    currentStepIndex: 0,
    attempts: {},
    completedSteps: [],
    calculatorChecks: []
  });

  assert.equal(Object.hasOwn(tutor.currentStep, 'displayEquation'), false);
  const html = renderHooks.renderTutorSessionStep({
    id: 'optional-presentation-fallback',
    tutor,
    response: 'Enter the requested value.',
    message: '',
    tutorSubmittedMessage: ''
  }, {
    isLatestActiveStep: true,
    stepIndex: 0,
    previousTurn: null
  });
  assert.match(html, /Enter the requested value\./);
  assert.doesNotMatch(html, /student-tutor-equation/, 'A missing optional equation must fall back without hidden answer content.');
}

function testTutorCalculatorProtection() {
  assert.equal(
    renderHooks.shouldProtectTutorCalculator({
      active: true,
      completed: false,
      stopped: false,
      tutorCategory: 'formula',
      formulaId: 'future_formula'
    }, {
      currentStep: { type: 'calculation' }
    }),
    true,
    'An active Formula Tutor calculator must use private server checking.'
  );
  assert.equal(
    renderHooks.shouldProtectTutorCalculator({
      active: false,
      completed: true,
      tutorCategory: 'formula'
    }, {}),
    false,
    'The active Formula Tutor guard must not change calculators outside an active Tutor step.'
  );

  const calculationBody = sourceFunctionBody('calculateExpression', 'calculateSquareRoot');
  assert.ok(
    calculationBody.indexOf('submitActiveFormulaTutorCalculatorExpression') <
      calculationBody.indexOf('evaluateCalculatorExpression'),
    'The active Tutor guard must run before any browser-side evaluation.'
  );
  const protectedCalculatorBody = sourceFunctionBody(
    'submitActiveFormulaTutorCalculatorExpression',
    'shouldProtectTutorCalculator'
  );
  assert.doesNotMatch(
    protectedCalculatorBody,
    /expectedAnswer|expectedValue|expectedDisplay/,
    'The Formula Tutor calculator guard must not introduce a client-side expected-answer copy.'
  );
}

function assertActiveMetadataIsProjected(tutor) {
  assert.equal(tutor.active, true);
  assert.equal(Object.hasOwn(tutor, 'finalAnswer'), false);
  assert.equal(tutor.work.finalAnswer, '');
  assert.equal(tutor.work.answer, '');
  assertNoPrivateAnswerKeys(tutor.currentStep);
  assertNoPrivateAnswerKeys(tutor.work.currentStep);
  assertNoPrivateAnswerKeys(tutor.visualMetadata);
  assertNoPrivateAnswerKeys(tutor.work.visualMetadata);
}

function assertNoPrivateAnswerKeys(value, pathParts = []) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const pathLabel = [...pathParts, key].join('.');
    assert.doesNotMatch(
      key,
      /expected|accepted|correct(?:answer|response|value)?|autoCompleteAnswer|resultValue|resultDisplay/i,
      `Active student metadata contains private answer key ${pathLabel}`
    );
    assertNoPrivateAnswerKeys(child, [...pathParts, key]);
  }
}

function assertKnownValuePresent(tutor, displayPart, message) {
  const displays = (tutor.knownValues || []).map((value) => String(value.display || ''));
  assert.ok(displays.some((display) => display.includes(displayPart)), message || `Expected known value ${displayPart}`);
}

function assertKnownValueAbsent(tutor, displayPart, message) {
  const displays = (tutor.knownValues || []).map((value) => String(value.display || ''));
  assert.ok(displays.every((display) => !display.includes(displayPart)), message || `Unexpected known value ${displayPart}`);
  const workDisplays = (tutor.work?.knownValues || []).map((value) => String(value.display || ''));
  assert.ok(workDisplays.every((display) => !display.includes(displayPart)), message || `Unexpected work known value ${displayPart}`);
}

function buildSyntheticVisualProblem(visualMetadata, options = {}) {
  const steps = Array.isArray(options.steps) ? options.steps : [{
    id: 'derive_output',
    type: 'calculation',
    prompt: 'What output do you calculate?',
    expectedValue: 42,
    expectedDisplay: '42 widgets',
    displayEquation: 'output = input × factor = {{blank}}'
  }];
  return {
    tutorProblemId: 'synthetic-visual-integrity',
    formulaId: 'future_unlisted_formula',
    family: 'future_family',
    solveFor: 'future output',
    formula: 'future output = input × factor',
    originalQuestion: 'A synthetic projection fixture.',
    variables: {},
    visualMetadata,
    finalAnswer: { value: 42, unit: 'widgets', display: '42 widgets' },
    steps,
    currentStepIndex: Number.isInteger(options.currentStepIndex) ? options.currentStepIndex : 0,
    attempts: {},
    completedSteps: Array.isArray(options.completedSteps) ? options.completedSteps : [],
    calculatorChecks: []
  };
}

function buildSyntheticGuidanceProblem({ hints, conceptualNudges = [] }) {
  return {
    tutorProblemId: 'synthetic-guidance-integrity',
    formulaId: 'future_guidance_formula',
    family: 'future_family',
    solveFor: 'output',
    formula: 'output = earned factor × earned factor',
    originalQuestion: 'Use the factors you have already earned.',
    variables: {},
    visualMetadata: null,
    finalAnswer: { value: 42, unit: 'widgets', display: '42 widgets' },
    steps: [{
      id: 'enter_output',
      type: 'quantity',
      prompt: 'What output did you calculate?',
      expectedValue: 42,
      expectedUnit: 'widgets',
      expectedDisplay: '42 widgets',
      acceptedAnswers: ['42', '42 widgets'],
      hints,
      conceptualNudges
    }],
    currentStepIndex: 0,
    attempts: {},
    completedSteps: [],
    calculatorChecks: []
  };
}

function buildSyntheticGraphProblem() {
  return {
    tutorProblemId: 'synthetic-graph-integrity',
    formulaId: 'future_graph_relationship',
    family: 'future_graph_family',
    solveFor: 'output',
    formula: 'output = input × relationship factor',
    originalQuestion: 'Use the input and relationship to find the output.',
    variables: {},
    visualMetadata: null,
    finalAnswer: { value: 42, unit: 'widgets', display: 'output = 42 widgets' },
    graphTutorSupport: {
      aiAllowed: false,
      source: 'approved_knowledge_graph',
      connectedConcepts: [
        { id: 'future:input', type: 'concept', label: 'input' },
        { id: 'future:output', type: 'concept', label: 'output' },
        { id: 'future:unsafe-value', type: 'concept', label: '42 widgets' }
      ],
      prerequisiteConcepts: [
        { id: 'future:input', type: 'concept', label: 'input' }
      ],
      commonMisconceptions: [
        { concept: 'relationship', warning: 'Use the relationship structure and the earned input.' },
        { concept: 'output', warning: 'The expected result is 42 widgets.' }
      ],
      whyItMatters: [
        { concept: 'input', bridge: 'input connects to output through the relationship.' },
        { concept: 'output', bridge: 'output is 42 widgets.' }
      ],
      graphPaths: [
        { nodes: ['input', 'relationship', 'output'], edges: ['connects to', 'produces'] },
        { nodes: ['input', '42 widgets'], edges: ['reveals'] }
      ]
    },
    steps: [
      {
        id: 'identify_requested_quantity',
        type: 'multiple_choice',
        prompt: 'Which structural quantity are we finding?',
        expected: 'output',
        choices: [
          { number: 1, label: 'output', value: 'output', correct: true },
          { number: 2, label: 'input', value: 'input', correct: false }
        ],
        hints: ['Match the requested structural quantity to the graph.']
      },
      {
        id: 'calculate_future_value',
        type: 'calculation',
        prompt: 'What output value do you calculate?',
        expectedValue: 42,
        expectedUnit: 'widgets',
        expectedDisplay: '42 widgets',
        acceptedAnswers: ['42', '42 widgets'],
        hints: ['Use the relationship structure and the earned input.']
      }
    ],
    currentStepIndex: 0,
    attempts: {},
    completedSteps: [],
    calculatorChecks: []
  };
}

async function createHarnessSession(options = { studentGuidedFormulaTutoringEnabled: true }) {
  const harness = createStudentRouteHarness(options);
  const create = await harness.request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  return { ...harness, sessionId: create.body.sessionId };
}

async function send(harness, studentHubId, message) {
  const response = await harness.request('POST', '/api/student/message', {
    sessionId: harness.sessionId,
    studentHubId,
    message
  });
  assert.equal(response.statusCode, 200, `${studentHubId}: ${message}`);
  return response;
}

function getPrivateTutorProblem(harness, studentHubId) {
  return harness.studentSessions[harness.sessionId]?.anonymousHubs?.[studentHubId]?.currentTutorProblem || null;
}

function loadStudentUiHooks() {
  const timeline = {
    innerHTML: '',
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    contains() {
      return true;
    }
  };
  const sandbox = {
    console,
    URLSearchParams,
    window: {
      __CHARLEMAGNE_ENABLE_STUDENT_UI_TEST_HOOKS__: true,
      location: { search: '', pathname: '/' },
      CSS: {
        escape(value) {
          return String(value || '').replace(/["\\]/g, '\\$&');
        }
      },
      setInterval() {},
      clearInterval() {},
      setTimeout() {}
    },
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById(id) {
        return id === 'studentTimeline' ? timeline : null;
      }
    }
  };
  vm.runInNewContext(studentUiSource, sandbox, { filename: 'student-ui.js' });
  return sandbox.window.CharlemagneStudentUiTestHooks || {};
}

function sourceFunctionBody(startName, endName) {
  const start = studentUiSource.indexOf(`function ${startName}`);
  const end = studentUiSource.indexOf(`function ${endName}`, start + 1);
  assert.ok(start >= 0 && end > start, `Expected ${startName} before ${endName}`);
  return studentUiSource.slice(start, end);
}
