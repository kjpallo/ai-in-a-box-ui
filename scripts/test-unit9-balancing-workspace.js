const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  AMMONIA_BALANCING_ACTIVITY,
  hasApprovedEquation,
  tryAmmoniaBalancingActivity
} = require('../lib/tutor/activities/ammoniaBalancingActivity');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const PROJECT_ROOT = path.join(__dirname, '..');
const ACTIVITY_ID = AMMONIA_BALANCING_ACTIVITY.id;
const ACTION_PREFIX = 'balance_activity:';

async function main() {
  assertTrustedDefinition();
  assertNarrowDirectRouting();
  assertStudentUiContract();
  const studentUiHooks = getStudentUiTestHooks();

  const harness = createStudentRouteHarness();
  const created = await harness.request('POST', '/api/profile/create-student-session');
  assert.equal(created.statusCode, 201);
  const sessionId = created.body.sessionId;

  await assertPublicStarts(harness, sessionId);
  await assertBoundaries(harness, sessionId);
  await assertElementTableAndValidation(harness, sessionId);
  await assertBalancingUiTranscriptFlow(harness, sessionId, studentUiHooks);
  await assertTranscriptSafety(harness, sessionId);
  await assertCoefficientChecksAndCompletion(harness, sessionId);
  await assertBalancedNotSimplifiedReductionAndReset(harness, sessionId, studentUiHooks);
  await assertPostCompletionBalancingCommandSafety(harness, sessionId);
  await assertUnit1BalanceVocabularyPreserved(harness, sessionId);

  console.log('PASS Unit 9 balancing workspace: trusted bounded route, accessible UI contract, validated activity state, coefficient checks, and reset');
}

function assertTrustedDefinition() {
  assert.ok(Object.isFrozen(AMMONIA_BALANCING_ACTIVITY));
  assert.ok(Object.isFrozen(AMMONIA_BALANCING_ACTIVITY.reactants));
  assert.ok(Object.isFrozen(AMMONIA_BALANCING_ACTIVITY.reactants[0].atomMap));
  assert.equal(AMMONIA_BALANCING_ACTIVITY.id, 'unit9.balance-ammonia');
  assert.equal(AMMONIA_BALANCING_ACTIVITY.version, '1.0.0');
  assert.deepEqual(AMMONIA_BALANCING_ACTIVITY.validElements, ['N', 'H']);
  assert.deepEqual(AMMONIA_BALANCING_ACTIVITY.coefficientOptions, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(AMMONIA_BALANCING_ACTIVITY.initialCoefficients, { nitrogen: 1, hydrogen: 1, ammonia: 1 });
  assert.deepEqual(AMMONIA_BALANCING_ACTIVITY.simplestCoefficients, { nitrogen: 1, hydrogen: 3, ammonia: 2 });
  assert.deepEqual(AMMONIA_BALANCING_ACTIVITY.coefficientReduction, {
    factor: 2,
    originalCoefficients: { nitrogen: 2, hydrogen: 6, ammonia: 4 },
    reducedCoefficients: { nitrogen: 1, hydrogen: 3, ammonia: 2 }
  });
  assert.ok(Object.isFrozen(AMMONIA_BALANCING_ACTIVITY.coefficientReduction));
  assert.equal(AMMONIA_BALANCING_ACTIVITY.finalConventionalEquation, 'N2 + 3H2 → 2NH3');
  assert.equal(AMMONIA_BALANCING_ACTIVITY.provenance.kind, 'user_approved_trusted_fact');
  assert.deepEqual(AMMONIA_BALANCING_ACTIVITY.reactants.map((item) => item.atomMap), [{ N: 2 }, { H: 2 }]);
  assert.deepEqual(AMMONIA_BALANCING_ACTIVITY.products.map((item) => item.atomMap), [{ N: 1, H: 3 }]);
}

function assertNarrowDirectRouting() {
  const supported = [
    'Balance this equation: __ N2 + __ H2 → __ NH3',
    'Balance N2 + H2 -> NH3.',
    'What coefficients balance N2 + H2 → NH3?',
    '  BALANCE   n2 + h2  -> nh3!!! '
  ];
  for (const prompt of supported) {
    assert.equal(hasApprovedEquation(prompt), true, `${prompt} normalized equation`);
    const result = tryAmmoniaBalancingActivity(prompt);
    assert.ok(result, `${prompt} should build the trusted activity`);
    assert.equal(result.formulaWork.activityId, ACTIVITY_ID);
    const route = routeStudentQuestion(prompt);
    assert.equal(route.type, 'chemical_equation_balancing');
    assert.equal(route.public.formulaWork.activityId, ACTIVITY_ID);
    assert.equal(route.public.formulaWork.activityVersion, '1.0.0');
  }

  assert.equal(tryAmmoniaBalancingActivity('N2 + H2 → NH3'), null, 'same equation without intent must not start');
  assert.notEqual(routeStudentQuestion('N2 + H2 → NH3').type, 'chemical_equation_balancing');
  assert.equal(tryAmmoniaBalancingActivity('Classify N2 + H2 -> NH3.'), null, 'classification must not start activity');
  assert.notEqual(routeStudentQuestion('Classify N2 + H2 -> NH3.').type, 'chemical_equation_balancing');

  const unsupported = routeStudentQuestion('Balance Fe + O2 -> Fe2O3.');
  assert.equal(unsupported.type, 'no_match');
  assert.match(unsupported.directAnswer, /do not have a trusted balancing activity/i);
  const malformed = routeStudentQuestion('Balance N2 + H2 -> NH2.');
  assert.equal(malformed.type, 'no_match');
  assert.match(malformed.directAnswer, /trusted balancing activity|check the equation/i);

  for (const prompt of [
    'Balance N2 + H2 = NH3.',
    'Balance N2 + H2 => NH3.',
    'Balance N2 + H2',
    'Balance Fe + O2 -> Fe2O3.'
  ]) {
    const blocked = routeStudentQuestion(prompt);
    assert.equal(blocked.type, 'no_match', `${prompt} should fail at the balancing boundary`);
    assert.match(blocked.directAnswer, /trusted balancing activity|check the equation/i);
    assert.doesNotMatch(blocked.directAnswer, /hydrogen gas|diatomic|\bcoefficient(?:s)?\s*(?:are|=)\s*\d/i);
    assert.deepEqual(blocked.toolsUsed, ['unit9_balancing_boundary']);
  }

  const existingTrusted = routeStudentQuestion('Balance H2 + O2 -> H2O.');
  assert.match(existingTrusted.directAnswer, /2H2 \+ O2 -> 2H2O/i, 'existing approved Unit 9 example stays intact');

  for (const prompt of ['What does a digital scale measure?', 'What does a balance measure?']) {
    assert.notEqual(routeStudentQuestion(prompt).type, 'no_match', `${prompt} should remain outside the chemistry boundary`);
  }
  assert.notDeepEqual(
    routeStudentQuestion('Balance X + Y = Z.').toolsUsed,
    ['unit9_balancing_boundary'],
    'single-letter algebra must remain outside the chemistry-balancing boundary'
  );
  assert.notEqual(routeStudentQuestion('Classify N2 + H2 -> NH3.').type, 'no_match');
}

async function assertPublicStarts(harness, sessionId) {
  const prompts = [
    'Balance this equation: __ N2 + __ H2 → __ NH3',
    'Balance N2 + H2 -> NH3.',
    'What coefficients balance N2 + H2 → NH3?',
    ' balance   N2+ H2 ->NH3!!! '
  ];
  for (const [index, prompt] of prompts.entries()) {
    const response = await send(harness, sessionId, `start-${index}`, prompt);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'formula_tutor');
    assert.equal(response.body.tutor.formulaId, ACTIVITY_ID);
    assert.equal(response.body.tutor.activity.id, ACTIVITY_ID);
    assert.equal(response.body.tutor.activity.version, '1.0.0');
    assert.equal(response.body.tutor.activity.phase, 'element_table');
    assert.equal(response.body.tutor.visualMetadata.visualType, 'chemical_equation_balancing');
    assert.deepEqual(response.body.tutor.visualMetadata.coefficientOptions, [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(response.body.tutor.visualMetadata.coefficients, { nitrogen: 1, hydrogen: 1, ammonia: 1 });
  }
}

async function assertBoundaries(harness, sessionId) {
  const noIntent = await send(harness, sessionId, 'boundary-no-intent', 'N2 + H2 → NH3');
  assert.notEqual(noIntent.body.routeType, 'formula_tutor');

  const unsupported = await send(harness, sessionId, 'boundary-unsupported', 'Balance Fe + O2 -> Fe2O3.');
  assert.equal(unsupported.body.routeType, 'no_match');
  assert.match(unsupported.body.response, /do not have a trusted balancing activity/i);

  const malformed = await send(harness, sessionId, 'boundary-malformed', 'Balance N2 + H2 -> NH2.');
  assert.equal(malformed.body.routeType, 'no_match');
  assert.doesNotMatch(malformed.body.response, /=\s*2\b/, 'malformed equation must not fall into arithmetic');

  for (const [index, prompt] of [
    'Balance N2 + H2 = NH3.',
    'Balance N2 + H2 => NH3.',
    'Balance N2 + H2',
    'Balance Fe + O2 -> Fe2O3.'
  ].entries()) {
    const blocked = await send(harness, sessionId, `boundary-safe-${index}`, prompt);
    assert.equal(blocked.body.routeType, 'no_match');
    assert.match(blocked.body.response, /trusted balancing activity|check the equation/i);
    assert.doesNotMatch(blocked.body.response, /hydrogen gas|diatomic|\bcoefficient(?:s)?\s*(?:are|=)\s*\d/i);
  }

  const classification = await send(harness, sessionId, 'boundary-classify', 'Classify N2 + H2 -> NH3.');
  assert.notEqual(classification.body.routeType, 'formula_tutor');
}

async function assertElementTableAndValidation(harness, sessionId) {
  const hubId = 'element-table';
  let response = await start(harness, sessionId, hubId);
  assert.deepEqual(response.body.tutor.activity.placements, { reactants: [], products: [] });

  for (const tampered of [
    { side: 'reactants', element: 'N', compoundId: 'ammonia' },
    { side: 'products', element: 'N', compoundId: 'nitrogen' },
    { side: 'products', element: 'H', compoundId: 'hydrogen' }
  ]) {
    const rejected = await action(harness, sessionId, hubId, 'place_element', tampered);
    assert.match(rejected.body.response, /does not belong on the (?:REACTANTS|PRODUCTS) side/i);
    assert.deepEqual(rejected.body.tutor.activity.placements, { reactants: [], products: [] });
    assert.equal(rejected.body.tutor.activity.tableComplete, false);
    assert.equal(rejected.body.tutor.activity.phase, 'element_table');
    assert.equal(
      harness.studentSessions[sessionId].anonymousHubs[hubId].messages.at(-1).message,
      'Used the balancing workspace controls'
    );
  }

  response = await action(harness, sessionId, hubId, 'place_element', {
    side: 'reactants', element: 'N', compoundId: 'nitrogen'
  });
  assert.deepEqual(response.body.tutor.activity.placements.reactants.map((item) => item.element), ['N']);

  const duplicate = await action(harness, sessionId, hubId, 'place_element', {
    side: 'reactants', element: 'N', compoundId: 'nitrogen'
  });
  assert.match(duplicate.body.response, /already in REACTANTS/i);
  assert.deepEqual(duplicate.body.tutor.activity.placements.reactants.map((item) => item.element), ['N']);

  const wrongSide = await action(harness, sessionId, hubId, 'place_element', {
    side: 'left', element: 'H', compoundId: 'hydrogen'
  });
  assert.match(wrongSide.body.response, /side is not recognized/i);
  assert.deepEqual(wrongSide.body.tutor.activity.placements.reactants.map((item) => item.element), ['N']);

  const unknownElement = await action(harness, sessionId, hubId, 'place_element', {
    side: 'reactants', element: 'O', compoundId: 'hydrogen'
  });
  assert.match(unknownElement.body.response, /not part of this trusted activity/i);

  const unknownCompound = await action(harness, sessionId, hubId, 'place_element', {
    side: 'reactants', element: 'H', compoundId: 'browser-supplied-compound'
  });
  assert.match(unknownCompound.body.response, /compound ID is not recognized/i);

  const unknownActivity = await send(harness, sessionId, hubId, activityMessage('place_element', {
    activityId: 'unknown', side: 'reactants', element: 'H', compoundId: 'hydrogen'
  }, false));
  assert.match(unknownActivity.body.response, /activity ID is not recognized/i);

  const malformed = await send(harness, sessionId, hubId, `${ACTION_PREFIX}{bad json`);
  assert.match(malformed.body.response, /malformed/i);

  const browserFormula = await send(harness, sessionId, hubId, activityMessage('check_balance', {
    atomMap: { N: 999 }, formulaParts: ['browser supplied']
  }));
  assert.match(browserFormula.body.response, /malformed/i, 'browser formula structures and atom maps are rejected');

  await action(harness, sessionId, hubId, 'place_element', { side: 'reactants', element: 'H', compoundId: 'hydrogen' });
  await action(harness, sessionId, hubId, 'place_element', { side: 'products', element: 'N', compoundId: 'ammonia' });
  response = await action(harness, sessionId, hubId, 'place_element', { side: 'products', element: 'H', compoundId: 'ammonia' });
  assert.equal(response.body.tutor.activity.tableComplete, true);
  assert.equal(response.body.tutor.activity.phase, 'coefficients');

  const locked = await action(harness, sessionId, hubId, 'remove_element', { side: 'reactants', element: 'N' });
  assert.match(locked.body.response, /table is locked/i);
  assert.equal(locked.body.tutor.activity.tableComplete, true);
}

async function assertBalancingUiTranscriptFlow(harness, sessionId, studentUiHooks) {
  const resolveLabel = studentUiHooks.resolveConfirmedBalancingTranscriptLabel;
  assert.equal(typeof resolveLabel, 'function');

  const hubId = 'ui-transcript-flow';
  await start(harness, sessionId, hubId);

  const rejectedClick = await action(harness, sessionId, hubId, 'place_element', {
    side: 'reactants', element: 'N', compoundId: 'ammonia'
  });
  assert.match(rejectedClick.body.response, /does not belong on the REACTANTS side/i);
  assert.equal(resolveLabel(rejectedClick.body), 'Used the balancing workspace controls');
  assert.deepEqual(rejectedClick.body.tutor.activity.placements, { reactants: [], products: [] });

  const validClick = await action(harness, sessionId, hubId, 'place_element', {
    side: 'reactants', element: 'N', compoundId: 'nitrogen'
  });
  assert.equal(resolveLabel(validClick.body), 'Placed nitrogen under REACTANTS');
  assert.deepEqual(validClick.body.tutor.activity.placements.reactants.map((item) => item.element), ['N']);

  const rejectedDrag = await action(harness, sessionId, hubId, 'place_element', {
    side: 'products', element: 'H', compoundId: 'hydrogen'
  });
  assert.match(rejectedDrag.body.response, /does not belong on the PRODUCTS side/i);
  assert.equal(resolveLabel(rejectedDrag.body), 'Used the balancing workspace controls');
  assert.deepEqual(rejectedDrag.body.tutor.activity.placements, {
    reactants: [{ element: 'N', sourceCompoundId: 'nitrogen' }],
    products: []
  });

  const validDrag = await action(harness, sessionId, hubId, 'place_element', {
    side: 'reactants', element: 'H', compoundId: 'hydrogen'
  });
  assert.equal(resolveLabel(validDrag.body), 'Placed hydrogen under REACTANTS');
  assert.deepEqual(validDrag.body.tutor.activity.placements.reactants.map((item) => item.element), ['N', 'H']);

  const laterValid = await action(harness, sessionId, hubId, 'place_element', {
    side: 'products', element: 'N', compoundId: 'ammonia'
  });
  assert.equal(resolveLabel(laterValid.body), 'Placed nitrogen under PRODUCTS');

  assert.equal(
    resolveLabel({
      tutor: {
        activity: { id: ACTIVITY_ID },
        latestStudentReply: `${ACTION_PREFIX}{"type":"place_element"}`
      }
    }),
    'Used the balancing workspace controls'
  );
  assert.equal(
    resolveLabel({ tutor: { activity: { id: ACTIVITY_ID }, latestStudentReply: 'place_element' } }),
    'Used the balancing workspace controls'
  );
  assert.equal(resolveLabel({ tutor: { latestStudentReply: 'Placed nitrogen under REACTANTS' } }), 'Used the balancing workspace controls');

  assert.equal(resolveLabel(validClick.body), 'Placed nitrogen under REACTANTS');
  assert.equal(resolveLabel(rejectedDrag.body), 'Used the balancing workspace controls');
}

async function assertTranscriptSafety(harness, sessionId) {
  const hubId = 'transcript-safety';
  await start(harness, sessionId, hubId);
  const command = activityMessage('place_element', {
    side: 'reactants', element: 'N', compoundId: 'nitrogen'
  });
  const response = await send(harness, sessionId, hubId, command);
  assert.equal(response.body.tutor.latestStudentReply, 'Placed nitrogen under REACTANTS');
  assert.equal(response.body.tutor.work.latestStudentReply, 'Placed nitrogen under REACTANTS');

  await action(harness, sessionId, hubId, 'remove_element', { side: 'reactants', element: 'N' });
  await action(harness, sessionId, hubId, 'place_element', { side: 'reactants', element: 'N', compoundId: 'nitrogen' });
  await action(harness, sessionId, hubId, 'place_element', { side: 'reactants', element: 'H', compoundId: 'hydrogen' });
  await action(harness, sessionId, hubId, 'place_element', { side: 'products', element: 'N', compoundId: 'ammonia' });
  await action(harness, sessionId, hubId, 'place_element', { side: 'products', element: 'H', compoundId: 'ammonia' });
  await action(harness, sessionId, hubId, 'set_coefficient', { compoundId: 'hydrogen', value: 3 });
  await action(harness, sessionId, hubId, 'check_balance');
  await action(harness, sessionId, hubId, 'reset');
  await action(harness, sessionId, hubId, 'set_coefficient', { compoundId: 'nitrogen', value: 2 });
  await action(harness, sessionId, hubId, 'set_coefficient', { compoundId: 'hydrogen', value: 6 });
  await action(harness, sessionId, hubId, 'set_coefficient', { compoundId: 'ammonia', value: 4 });
  await action(harness, sessionId, hubId, 'check_balance');
  await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'nitrogen', divisor: 2 });
  await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'hydrogen', divisor: 2 });
  await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'ammonia', divisor: 2 });

  const ordinaryHubId = 'ordinary-transcript';
  const ordinaryQuestion = 'What does mass measure?';
  await send(harness, sessionId, ordinaryHubId, ordinaryQuestion);

  const hubMessages = harness.studentSessions[sessionId].anonymousHubs[hubId].messages;
  const sessionTranscript = harness.studentSessions[sessionId].messages;
  for (const transcript of [hubMessages, sessionTranscript]) {
    const transcriptJson = JSON.stringify(transcript);
    assert.doesNotMatch(transcriptJson, /balance_activity:|place_element|remove_element|set_coefficient|check_balance|reduce_coefficient|unit9\.balance-ammonia/);
  }
  const loggedControlMessages = harness.studentInteractionLog
    .filter((entry) => entry.debug?.studentHubId === hubId)
    .map((entry) => ({
      studentQuestion: entry.studentQuestion,
      question: entry.question,
      message: entry.message
    }));
  assert.doesNotMatch(
    JSON.stringify(loggedControlMessages),
    /balance_activity:|place_element|remove_element|set_coefficient|check_balance|reduce_coefficient|unit9\.balance-ammonia/
  );
  assert.ok(hubMessages.some((entry) => entry.message === 'Placed nitrogen under REACTANTS'));
  assert.ok(hubMessages.some((entry) => entry.message === 'Changed the H2 coefficient to 3'));
  assert.ok(hubMessages.some((entry) => entry.message === 'Checked the equation balance'));
  assert.ok(hubMessages.some((entry) => entry.message === 'Reset the coefficients'));
  assert.ok(hubMessages.some((entry) => entry.message === 'Reduced the N2 coefficient by 2'));
  assert.ok(hubMessages.some((entry) => entry.message === 'Reduced the H2 coefficient by 2'));
  assert.ok(hubMessages.some((entry) => entry.message === 'Reduced the NH3 coefficient by 2'));
  assert.equal(
    harness.studentSessions[sessionId].anonymousHubs[ordinaryHubId].messages[0].message,
    ordinaryQuestion,
    'ordinary typed student questions should remain unchanged in their own session transcript'
  );

  const teacher = await harness.request('GET', '/api/profile/live-student-activity');
  assert.equal(teacher.statusCode, 200);
  const teacherSession = teacher.body.sessions.find((item) => item.classSessionId === sessionId);
  const teacherHub = teacherSession.anonymousHubs.find((item) => item.studentHubId === hubId);
  const ordinaryHub = teacherSession.anonymousHubs.find((item) => item.studentHubId === ordinaryHubId);
  assert.ok(teacherHub);
  assert.ok(ordinaryHub);
  assert.doesNotMatch(
    JSON.stringify(teacherHub.recentMessages),
    /balance_activity:|\"activityId\"|place_element|remove_element|set_coefficient|check_balance|reduce_coefficient|unit9\.balance-ammonia/
  );
  assert.ok(teacherHub.recentMessages.some((entry) => entry.message === 'Reduced the NH3 coefficient by 2'));
  assert.equal(ordinaryHub.recentMessages[0].message, ordinaryQuestion);
  assert.equal(
    teacherHub.recentMessages.some((entry) => entry.message === ordinaryQuestion),
    false,
    'teacher recent chats must remain isolated by anonymous student hub'
  );
}

async function assertCoefficientChecksAndCompletion(harness, sessionId) {
  const initialHub = 'coefficients-initial';
  await startAndCompleteTable(harness, sessionId, initialHub);
  let response = await action(harness, sessionId, initialHub, 'check_balance');
  assert.equal(response.body.tutor.activity.latestCheck.status, 'not_balanced');
  assert.deepEqual(response.body.tutor.activity.counts, {
    reactants: { N: 2, H: 2 },
    products: { N: 1, H: 3 }
  });
  assert.deepEqual(response.body.tutor.activity.coefficients, { nitrogen: 1, hydrogen: 1, ammonia: 1 });

  const reductionBeforeCheck = await action(harness, sessionId, initialHub, 'reduce_coefficient', {
    compoundId: 'nitrogen', divisor: 2
  });
  assert.match(reductionBeforeCheck.body.response, /reduction step is not active/i);
  assert.equal(reductionBeforeCheck.body.tutor.activity.reductionProgress, null);

  const invalid = await action(harness, sessionId, initialHub, 'set_coefficient', { compoundId: 'hydrogen', value: 9 });
  assert.match(invalid.body.response, /1 through 8/i);
  assert.equal(invalid.body.tutor.activity.coefficients.hydrogen, 1);

  const completeHub = 'coefficients-complete';
  await startAndCompleteTable(harness, sessionId, completeHub);
  await action(harness, sessionId, completeHub, 'set_coefficient', { compoundId: 'hydrogen', value: 3 });
  response = await action(harness, sessionId, completeHub, 'set_coefficient', { compoundId: 'ammonia', value: 2 });
  assert.deepEqual(response.body.tutor.activity.counts, {
    reactants: { N: 2, H: 6 },
    products: { N: 2, H: 6 }
  });
  response = await action(harness, sessionId, completeHub, 'check_balance');
  assert.equal(response.body.tutor.completed, true);
  assert.equal(response.body.tutor.activity.latestCheck.status, 'balanced_simplest');
  assert.match(response.body.response, /N = 2 on both sides/i);
  assert.match(response.body.response, /H = 6 on both sides/i);
  assert.match(response.body.response, /N2 \+ 3H2 → 2NH3/);
  assert.match(response.body.response, /coefficients changed; the subscripts did not/i);
  assert.equal(response.body.tutor.visualMetadata.finalConventionalEquation, 'N2 + 3H2 → 2NH3');
  assert.equal(response.body.tutor.work.finalAnswer, 'N2 + 3H2 → 2NH3');
  assert.equal(harness.studentSessions[sessionId].anonymousHubs[completeHub].currentTutorProblem, null);
}

async function assertBalancedNotSimplifiedReductionAndReset(harness, sessionId, studentUiHooks) {
  const hubId = 'not-simplified';
  await startAndCompleteTable(harness, sessionId, hubId);
  await action(harness, sessionId, hubId, 'set_coefficient', { compoundId: 'nitrogen', value: 2 });
  await action(harness, sessionId, hubId, 'set_coefficient', { compoundId: 'hydrogen', value: 6 });
  let response = await action(harness, sessionId, hubId, 'set_coefficient', { compoundId: 'ammonia', value: 4 });
  assert.deepEqual(response.body.tutor.activity.counts, {
    reactants: { N: 4, H: 12 },
    products: { N: 4, H: 12 }
  });

  response = await action(harness, sessionId, hubId, 'check_balance');
  assert.equal(response.body.tutor.completed, false);
  assert.equal(response.body.tutor.active, true);
  assert.equal(response.body.tutor.activity.phase, 'reduction');
  assert.equal(response.body.tutor.activity.latestCheck.status, 'balanced_not_simplified');
  assert.deepEqual(response.body.tutor.activity.balancedNotSimplified, {
    factor: 2,
    selectedCoefficients: [2, 6, 4]
  });
  assert.deepEqual(
    harness.studentSessions[sessionId].anonymousHubs[hubId]
      .currentTutorProblem.activityState.balancedNotSimplified.reducedCoefficients,
    [1, 3, 2],
    'Private validation state should retain the trusted reduced vector.'
  );
  assert.match(response.body.response, /atom totals match.*equation is balanced/i);
  assert.match(response.body.response, /not in the smallest whole-number ratio/i);
  assert.match(response.body.response, /all three coefficients can be divided.*factor of 2/i);
  assert.equal(response.body.tutor.activity.completionEligible, false);
  assert.deepEqual(response.body.tutor.activity.reductionProgress, {
    factor: 2,
    items: [
      { compoundId: 'nitrogen', formula: 'N2', accessibleName: 'nitrogen gas', originalCoefficient: 2, divisor: 2, reduced: false },
      { compoundId: 'hydrogen', formula: 'H2', accessibleName: 'hydrogen gas', originalCoefficient: 6, divisor: 2, reduced: false },
      { compoundId: 'ammonia', formula: 'NH3', accessibleName: 'ammonia', originalCoefficient: 4, divisor: 2, reduced: false }
    ],
    completedCount: 0,
    totalCount: 3,
    complete: false
  });
  assert.ok(harness.studentSessions[sessionId].anonymousHubs[hubId].currentTutorProblem);

  const renderBalancing = studentUiHooks.renderChemicalEquationBalancingVisual;
  assert.equal(typeof renderBalancing, 'function');
  let rendered = renderBalancing(response.body.tutor.visualMetadata, 'reduction-test');
  assert.match(rendered, /Balanced, but not in the smallest whole-number ratio/);
  assert.match(rendered, /All three coefficients can be divided by the trusted common factor of 2/);
  assert.match(rendered, /data-balancing-reduce[^>]*data-compound-id="nitrogen"[^>]*aria-label="Reduce nitrogen gas coefficient: 2 divided by 2"[^>]*>[\s\S]*2 ÷ 2 = \?/);
  assert.match(rendered, /data-balancing-reduce[^>]*data-compound-id="hydrogen"[^>]*aria-label="Reduce hydrogen gas coefficient: 6 divided by 2"[^>]*>[\s\S]*6 ÷ 2 = \?/);
  assert.match(rendered, /data-balancing-reduce[^>]*data-compound-id="ammonia"[^>]*aria-label="Reduce ammonia coefficient: 4 divided by 2"[^>]*>[\s\S]*4 ÷ 2 = \?/);
  assert.doesNotMatch(rendered, /2 ÷ 2 = 1|6 ÷ 2 = 3|4 ÷ 2 = 2/);
  assert.match(rendered, /role="status" aria-live="polite" aria-atomic="true">0 of 3 coefficients reduced/);

  const wrongDivisor = await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'nitrogen', divisor: 3 });
  assert.match(wrongDivisor.body.response, /trusted common factor of 2/i);
  assert.equal(wrongDivisor.body.tutor.activity.reductionProgress.completedCount, 0);

  const wrongCoefficient = await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'browser-supplied', divisor: 2 });
  assert.match(wrongCoefficient.body.response, /not part of this trusted reduction/i);
  assert.equal(wrongCoefficient.body.tutor.activity.reductionProgress.completedCount, 0);

  const malformedDivisor = await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'nitrogen', divisor: '2' });
  assert.match(malformedDivisor.body.response, /malformed/i);
  assert.equal(malformedDivisor.body.tutor.activity.reductionProgress.completedCount, 0);

  const unsupportedValue = await action(harness, sessionId, hubId, 'reduce_coefficient', {
    compoundId: 'nitrogen', divisor: 2, reducedValue: 999
  });
  assert.match(unsupportedValue.body.response, /malformed/i);
  assert.equal(unsupportedValue.body.tutor.activity.reductionProgress.completedCount, 0);

  const blockedCoefficientChange = await action(harness, sessionId, hubId, 'set_coefficient', { compoundId: 'nitrogen', value: 1 });
  assert.match(blockedCoefficientChange.body.response, /finish the divide-by-2 reduction or reset/i);
  assert.deepEqual(blockedCoefficientChange.body.tutor.activity.coefficients, { nitrogen: 2, hydrogen: 6, ammonia: 4 });

  response = await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'nitrogen', divisor: 2 });
  assert.equal(response.body.tutor.completed, false);
  assert.equal(response.body.tutor.activity.reductionProgress.completedCount, 1);
  assert.match(response.body.response, /2 ÷ 2 = 1.*1 of 3.*not complete yet/i);
  rendered = renderBalancing(response.body.tutor.visualMetadata, 'reduction-test-partial');
  assert.match(rendered, /<del aria-label="original coefficient 2">2<\/del>/);
  assert.match(rendered, /<ins aria-label="replacement coefficient 1">1<\/ins>/);
  assert.match(rendered, /6 ÷ 2 = \?/);
  assert.match(rendered, /4 ÷ 2 = \?/);
  assert.doesNotMatch(rendered, /6 ÷ 2 = 3|4 ÷ 2 = 2/);

  const duplicate = await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'nitrogen', divisor: 2 });
  assert.match(duplicate.body.response, /already been reduced.*remaining coefficient/i);
  assert.equal(duplicate.body.tutor.activity.reductionProgress.completedCount, 1);

  response = await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'hydrogen', divisor: 2 });
  assert.equal(response.body.tutor.completed, false);
  assert.equal(response.body.tutor.active, true);
  assert.equal(response.body.tutor.activity.reductionProgress.completedCount, 2);
  assert.equal(response.body.tutor.activity.completionEligible, false);
  assert.match(response.body.response, /6 ÷ 2 = 3.*2 of 3.*not complete yet/i);

  response = await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'ammonia', divisor: 2 });
  assert.equal(response.body.tutor.completed, true);
  assert.equal(response.body.tutor.active, false);
  assert.equal(response.body.tutor.activity.phase, 'complete');
  assert.equal(response.body.tutor.activity.completionEligible, true);
  assert.equal(response.body.tutor.activity.reductionProgress.completedCount, 3);
  assert.equal(response.body.tutor.activity.reductionProgress.complete, true);
  assert.deepEqual(response.body.tutor.activity.reductionProgress.reducedCoefficients, [1, 3, 2]);
  assert.deepEqual(response.body.tutor.activity.coefficients, { nitrogen: 1, hydrogen: 3, ammonia: 2 });
  assert.match(response.body.response, /4 ÷ 2 = 2.*all 3 coefficients are reduced/i);
  assert.match(response.body.response, /N2 \+ 3H2 → 2NH3/);
  assert.equal(response.body.tutor.visualMetadata.finalConventionalEquation, 'N2 + 3H2 → 2NH3');
  assert.equal(response.body.tutor.work.finalAnswer, 'N2 + 3H2 → 2NH3');
  rendered = renderBalancing(response.body.tutor.visualMetadata, 'reduction-test-complete');
  const finalEquationMarkup = rendered.match(/<p class="balancing-final-equation">[\s\S]*?<\/p>/)?.[0] || '';
  assert.match(finalEquationMarkup, /N<sub>2<\/sub> \+ 3H<sub>2<\/sub> → 2NH<sub>3<\/sub>/);
  assert.doesNotMatch(finalEquationMarkup, />1N/);
  assert.equal(harness.studentSessions[sessionId].anonymousHubs[hubId].currentTutorProblem, null);

  const resetHubId = 'not-simplified-reset';
  await startAndCompleteTable(harness, sessionId, resetHubId);
  await action(harness, sessionId, resetHubId, 'set_coefficient', { compoundId: 'nitrogen', value: 2 });
  await action(harness, sessionId, resetHubId, 'set_coefficient', { compoundId: 'hydrogen', value: 6 });
  await action(harness, sessionId, resetHubId, 'set_coefficient', { compoundId: 'ammonia', value: 4 });
  await action(harness, sessionId, resetHubId, 'check_balance');
  await action(harness, sessionId, resetHubId, 'reduce_coefficient', { compoundId: 'nitrogen', divisor: 2 });
  response = await action(harness, sessionId, resetHubId, 'reset');
  assert.equal(response.body.tutor.activity.phase, 'coefficients');
  assert.equal(response.body.tutor.activity.tableComplete, true);
  assert.deepEqual(response.body.tutor.activity.coefficients, { nitrogen: 1, hydrogen: 1, ammonia: 1 });
  assert.equal(response.body.tutor.activity.latestCheck, null);
  assert.equal(response.body.tutor.activity.balancedNotSimplified, null);
  assert.equal(response.body.tutor.activity.reductionProgress, null);
  assert.equal(response.body.tutor.activity.completionEligible, false);
  assert.deepEqual(response.body.tutor.activity.placements, {
    reactants: [
      { element: 'N', sourceCompoundId: 'nitrogen' },
      { element: 'H', sourceCompoundId: 'hydrogen' }
    ],
    products: [
      { element: 'N', sourceCompoundId: 'ammonia' },
      { element: 'H', sourceCompoundId: 'ammonia' }
    ]
  });
}

async function assertPostCompletionBalancingCommandSafety(harness, sessionId) {
  const hubId = 'post-completion-command-safety';
  await startAndCompleteTable(harness, sessionId, hubId);
  await action(harness, sessionId, hubId, 'set_coefficient', { compoundId: 'nitrogen', value: 2 });
  await action(harness, sessionId, hubId, 'set_coefficient', { compoundId: 'hydrogen', value: 6 });
  await action(harness, sessionId, hubId, 'set_coefficient', { compoundId: 'ammonia', value: 4 });
  await action(harness, sessionId, hubId, 'check_balance');
  await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'nitrogen', divisor: 2 });
  await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'hydrogen', divisor: 2 });
  const completed = await action(harness, sessionId, hubId, 'reduce_coefficient', { compoundId: 'ammonia', divisor: 2 });

  const hub = harness.studentSessions[sessionId].anonymousHubs[hubId];
  assert.equal(completed.body.tutor.completed, true);
  assert.equal(hub.currentTutorProblem, null, 'completed balancing activity should clear the tutor problem');
  const completedActivity = JSON.parse(JSON.stringify(completed.body.tutor.activity));
  const hubMessageStart = hub.messages.length;
  const sessionMessageStart = harness.studentSessions[sessionId].messages.length;
  const interactionLogStart = harness.studentInteractionLog.length;

  const postCompletionCommands = [
    activityMessage('reduce_coefficient', { compoundId: 'nitrogen', divisor: 2 }),
    activityMessage('reduce_coefficient', { compoundId: 'ammonia', divisor: 2 }),
    activityMessage('reduce_coefficient', { compoundId: 'hydrogen', divisor: 987654 }),
    activityMessage('reduce_coefficient', { compoundId: 987654321, divisor: 2 }),
    activityMessage('unknown_balancing_action', { compoundId: 'browser-supplied', divisor: 2 }),
    activityMessage('reduce_coefficient', {
      compoundId: 'nitrogen',
      divisor: 2,
      serializedPayload: { secretMarker: 'must-not-leak' }
    }),
    activityMessage('reduce_coefficient', {
      activityId: 'stale.activity.marker',
      compoundId: 'nitrogen',
      divisor: 2
    }, false)
  ];

  for (const command of postCompletionCommands) {
    const replay = await send(harness, sessionId, hubId, command);
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.body.routeType, 'tutor_control');
    assert.notEqual(replay.body.routeType, 'chemistry_formula');
    assert.match(replay.body.response, /balancing workspace is no longer active/i);
    assert.equal(replay.body.tutor, null);
    assert.equal(hub.currentTutorProblem, null, 'a stale balancing command must not recreate an activity');
  }

  assert.deepEqual(completed.body.tutor.activity, completedActivity, 'post-completion commands must not alter completed state');

  const hubEntries = hub.messages.slice(hubMessageStart);
  const sessionEntries = harness.studentSessions[sessionId].messages.slice(sessionMessageStart);
  const loggedEntries = harness.studentInteractionLog.slice(interactionLogStart);
  const teacher = await harness.request('GET', '/api/profile/live-student-activity');
  assert.equal(teacher.statusCode, 200);
  const teacherSession = teacher.body.sessions.find((item) => item.classSessionId === sessionId);
  const teacherHub = teacherSession.anonymousHubs.find((item) => item.studentHubId === hubId);
  const teacherEntries = teacherHub.recentMessages.slice(-postCompletionCommands.length);

  for (const entries of [hubEntries, sessionEntries, loggedEntries, teacherEntries]) {
    assert.equal(entries.length, postCompletionCommands.length);
    assert.doesNotMatch(
      JSON.stringify(entries),
      /balance_activity:|reduce_coefficient|unknown_balancing_action|unit9\.balance-ammonia|stale\.activity\.marker|browser-supplied|nitrogen|hydrogen|ammonia|987654|"activityId"|"compoundId"|"divisor"|serializedPayload|secretMarker|must-not-leak|chemistry_compounds/
    );
  }

  for (const entry of [...hubEntries, ...sessionEntries]) {
    assert.equal(entry.message, 'Used the balancing workspace controls');
    assert.equal(entry.routeType, 'tutor_control');
  }
  for (const entry of teacherEntries) {
    assert.equal(entry.message, 'Used the balancing workspace controls');
    assert.equal(entry.question, 'Used the balancing workspace controls');
    assert.equal(entry.routeType, 'tutor_control');
  }
  for (const entry of loggedEntries) {
    assert.equal(entry.message, 'Used the balancing workspace controls');
    assert.equal(entry.routeType, 'tutor_control');
    assert.deepEqual(entry.debug.route.toolsUsed, ['tutor_control']);
  }
}

async function assertUnit1BalanceVocabularyPreserved(harness, sessionId) {
  for (const prompt of ['What does a digital scale measure?', 'What does a balance measure?']) {
    const response = await send(harness, sessionId, `unit1-${slug(prompt)}`, prompt);
    assert.notEqual(response.body.routeType, 'formula_tutor');
    assert.match(response.body.response, /mass/i);
  }
}

function assertStudentUiContract() {
  const ui = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'student', 'student-ui.js'), 'utf8');
  const html = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'student.html'), 'utf8');
  assert.match(ui, /visual\.visualType === 'chemical_equation_balancing'/);
  assert.match(ui, /renderProtectedFormulaParts[\s\S]*<sub>/);
  assert.match(ui, /<select class="balancing-coefficient-select"[\s\S]*data-balancing-coefficient/);
  assert.match(ui, /options\.map\(\(value\).*<option/);
  assert.match(ui, /type="button" class="balancing-element-token" draggable="true"/);
  assert.match(ui, /data-balancing-destination/);
  assert.match(ui, /selectBalancingElement[\s\S]*Choose REACTANTS or PRODUCTS/);
  assert.match(ui, /application\/x-chemical-balancing-element/);
  assert.match(ui, /handleTimelineChange[\s\S]*updateBalancingCountsFromControls/);
  assert.match(ui, /function handleTimelineDrop\(event\)[\s\S]*sendBalancingAction\(balancingDestination, 'place_element',[\s\S]*function handleTimelineClick/);
  assert.match(ui, /function handleTimelineClick\(event\)[\s\S]*sendBalancingAction\(balancingDestination, 'place_element',[\s\S]*function handleTimelineChange/);
  assert.doesNotMatch(ui, /Placed \$\{payload\.element\}|Placed \$\{selectedBalancingElement\.element\}/);
  assert.match(ui, /function sendBalancingAction\(control, type, payload = \{\}\)[\s\S]*sendTutorCommand\(command, BALANCING_PENDING_TRANSCRIPT_LABEL, \{[\s\S]*resolveDisplayCommand: resolveConfirmedBalancingTranscriptLabel/);
  assert.match(ui, /function sendTutorCommand\(command, displayCommand = command, options = \{\}\)[\s\S]*addPendingTurn\(displayCommand\)[\s\S]*await sendStudentMessage\(command\)[\s\S]*options\.resolveDisplayCommand\(data\)[\s\S]*findTurn\(turnId\)[\s\S]*turn\.message = confirmedDisplayCommand[\s\S]*renderStudentMessageResult\(data, confirmedDisplayCommand/);
  assert.match(ui, /Check Balance/);
  assert.match(ui, /data-balancing-reset/);
  assert.match(ui, /data-balancing-reduce[^]*data-balancing-divisor/);
  assert.match(ui, /function renderBalancingReductionInteraction[\s\S]*trusted common factor[\s\S]*role="status" aria-live="polite"/);
  assert.match(ui, /function renderBalancingReductionControl[\s\S]*<del aria-label="original coefficient[\s\S]*<ins aria-label="replacement coefficient/);
  assert.match(ui, /function handleTimelineClick[\s\S]*'reduce_coefficient'[\s\S]*data-balancing-divisor/);
  assert.match(ui, /Matches.*Does not match/s);
  assert.match(ui, /role="status" aria-live="polite"/);
  assert.match(html, /\.balancing-coefficient-select:focus-visible/);
  assert.match(html, /\.balancing-reduction-control:focus-visible/);
  assert.match(html, /\.balancing-reduction-control[\s\S]*min-height:\s*44px/);
  assert.match(html, /\.balancing-element-table\.is-complete/);
}

function getStudentUiTestHooks() {
  const studentUi = fs.readFileSync(path.join(PROJECT_ROOT, 'public', 'student', 'student-ui.js'), 'utf8');
  const sandbox = {
    console,
    URLSearchParams,
    window: {
      __CHARLEMAGNE_ENABLE_STUDENT_UI_TEST_HOOKS__: true,
      location: { search: '' },
      localStorage: {
        getItem() { return 'unit9-test-hub'; },
        setItem() {}
      },
      setInterval() {},
      clearInterval() {}
    },
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById() { return null; }
    }
  };
  vm.runInNewContext(studentUi, sandbox, { filename: 'student-ui.js' });
  return sandbox.window.CharlemagneStudentUiTestHooks || {};
}

async function startAndCompleteTable(harness, sessionId, hubId) {
  await start(harness, sessionId, hubId);
  await action(harness, sessionId, hubId, 'place_element', { side: 'reactants', element: 'N', compoundId: 'nitrogen' });
  await action(harness, sessionId, hubId, 'place_element', { side: 'reactants', element: 'H', compoundId: 'hydrogen' });
  await action(harness, sessionId, hubId, 'place_element', { side: 'products', element: 'N', compoundId: 'ammonia' });
  return action(harness, sessionId, hubId, 'place_element', { side: 'products', element: 'H', compoundId: 'ammonia' });
}

function start(harness, sessionId, hubId) {
  return send(harness, sessionId, hubId, 'Balance N2 + H2 -> NH3.');
}

function action(harness, sessionId, hubId, type, payload = {}) {
  return send(harness, sessionId, hubId, activityMessage(type, payload));
}

function activityMessage(type, payload = {}, includeDefaultId = true) {
  const activityId = includeDefaultId ? ACTIVITY_ID : payload.activityId;
  return `${ACTION_PREFIX}${JSON.stringify({ type, activityId, ...payload })}`;
}

function send(harness, sessionId, studentHubId, message) {
  return harness.request('POST', '/api/student/message', { sessionId, studentHubId, message });
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
