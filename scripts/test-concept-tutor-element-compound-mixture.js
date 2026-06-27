const assert = require('node:assert/strict');

const {
  buildElementCompoundMixtureConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

async function main() {
  assert.ok(
    buildElementCompoundMixtureConceptTutorPattern('Is gold an element, compound, or mixture?'),
    'known element classification questions should build the concept tutor pattern'
  );
  assert.ok(
    buildElementCompoundMixtureConceptTutorPattern('Is water an element compound or mixture?'),
    'known compound classification questions should build the concept tutor pattern'
  );
  assert.ok(
    buildElementCompoundMixtureConceptTutorPattern('Is salt water an element compound or mixture?'),
    'known mixture classification questions should build the concept tutor pattern'
  );
  assert.equal(
    buildElementCompoundMixtureConceptTutorPattern('What is an element?'),
    null,
    'pure element definition questions should not build the classification tutor pattern'
  );
  assert.equal(
    buildElementCompoundMixtureConceptTutorPattern('What is the difference between an element and a compound?'),
    null,
    'pure comparison questions should not build the classification tutor pattern'
  );
  assert.equal(
    buildElementCompoundMixtureConceptTutorPattern('Explain elements, compounds, and mixtures.'),
    null,
    'pure explanation questions should not build the classification tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertElementCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'gold',
    message: 'Is gold an element, compound, or mixture?',
    finalPattern: /Gold is an element because it is made of one kind of atom\./i
  });

  await assertElementCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'oxygen',
    message: 'Is oxygen an element compound or mixture?',
    finalPattern: /Oxygen is an element because it is made of one kind of atom\./i
  });

  await assertTwoStepCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'water',
    message: 'Is water an element compound or mixture?',
    firstChoice: '2',
    secondChoice: '1',
    originalQuestion: 'Is water an element compound or mixture?',
    finalAnswer: 'Water is a compound because hydrogen and oxygen are chemically joined into one substance.'
  });

  await assertTwoStepCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'carbon-dioxide-name',
    message: 'Is carbon dioxide an element compound or mixture?',
    firstChoice: '2',
    secondChoice: '1',
    finalAnswer: 'Carbon dioxide is a compound because carbon and oxygen are chemically joined into one substance.'
  });

  await assertTwoStepCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'carbon-dioxide-formula',
    message: 'Is CO2 an element compound or mixture?',
    firstChoice: '2',
    secondChoice: '1',
    finalAnswer: 'Carbon dioxide is a compound because carbon and oxygen are chemically joined into one substance.'
  });

  await assertTwoStepCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'carbon-monoxide-name',
    message: 'Is carbon monoxide an element compound or mixture?',
    firstChoice: '2',
    secondChoice: '1',
    finalAnswer: 'Carbon monoxide is a compound because carbon and oxygen are chemically joined into one substance.'
  });

  await assertTwoStepCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'carbon-monoxide-formula',
    message: 'Is CO an element compound or mixture?',
    firstChoice: '2',
    secondChoice: '1',
    finalAnswer: 'Carbon monoxide is a compound because carbon and oxygen are chemically joined into one substance.'
  });

  await assertTwoStepCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'baking-soda',
    message: 'Is baking soda an element compound or mixture?',
    firstChoice: '2',
    secondChoice: '1',
    finalAnswer: 'Baking soda is a compound because its atoms are chemically joined into one substance.'
  });

  await assertTwoStepCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'salt-water',
    message: 'Is salt water an element compound or mixture?',
    firstChoice: '2',
    secondChoice: '2',
    finalAnswer: 'Salt water is a mixture because salt and water are physically mixed together.'
  });

  await assertTwoStepCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'air',
    message: 'Is air an element compound or mixture?',
    firstChoice: '2',
    secondChoice: '2',
    finalAnswer: 'Air is a mixture because different gases are physically mixed together.'
  });

  await assertTwoStepCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'household-vinegar',
    message: 'Is household vinegar an element compound or mixture?',
    firstChoice: '2',
    secondChoice: '2',
    finalAnswer: 'Vinegar is a mixture because its ingredients are physically mixed together.'
  });

  await assertTwoStepCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'shampoo',
    message: 'Is shampoo an element compound or mixture?',
    firstChoice: '2',
    secondChoice: '2',
    finalAnswer: 'Shampoo is a mixture because its ingredients are physically mixed together.'
  });

  await assertTwoStepCompletes({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'laundry-detergent',
    message: 'Is laundry detergent an element compound or mixture?',
    firstChoice: '2',
    secondChoice: '2',
    finalAnswer: 'Laundry detergent is a mixture because its ingredients are physically mixed together.'
  });

  await assertUnknownClassificationCompletes({
    request,
    studentSessions,
    classSessionId
  });

  await assertWrongChoiceRetries({
    request,
    studentSessions,
    classSessionId
  });

  await assertHomogeneousHeterogeneousStillWorks({
    request,
    studentSessions,
    classSessionId
  });

  await assertDirectAnswer({
    request,
    classSessionId,
    studentHubId: 'definition-element',
    message: 'What is an element?',
    includes: /one type of atom|periodic table/i
  });

  await assertDirectAnswer({
    request,
    classSessionId,
    studentHubId: 'definition-compound',
    message: 'Define compound.',
    includes: /chemically combined|fixed proportion|two or more elements/i
  });

  await assertDirectAnswer({
    request,
    classSessionId,
    studentHubId: 'definition-mixture',
    message: 'What is a mixture?',
    includes: /physically combined|variable composition|not chemically bonded/i
  });

  await assertDirectAnswer({
    request,
    classSessionId,
    studentHubId: 'difference',
    message: 'What is the difference between an element and a compound?',
    includes: /element/i
  });

  await assertDirectAnswer({
    request,
    classSessionId,
    studentHubId: 'explain',
    message: 'Explain elements, compounds, and mixtures.',
    includes: /element|compound|mixture/i
  });

  const formulaStart = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'formula-priority',
    message: 'What is the force if mass is 10 kg and acceleration is 3 m/s²?'
  });
  assert.equal(formulaStart.statusCode, 200);
  assert.equal(formulaStart.body.routeType, 'formula_tutor', 'Formula Tutor should keep priority for formula questions');

  console.log('PASS concept tutor element/compound/mixture: starts narrowly, branches, completes, and preserves direct/formula routes');
}

async function assertElementCompletes({
  request,
  studentSessions,
  classSessionId,
  studentHubId,
  message,
  finalPattern
}) {
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');
  assert.equal(start.body.tutor.active, true);
  assert.equal(start.body.tutor.id, 'matter.element-compound-mixture');
  assert.equal(start.body.tutor.originalQuestion, message);
  assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
  assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
  assert.match(start.body.response, /Is it made of one kind of atom\?/i);
  assert.match(start.body.response, /1\. Yes/i);
  assert.match(start.body.response, /2\. No/i);
  assert.doesNotMatch(start.body.response, finalPattern, 'start response should hide final answer');

  const complete = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '1'
  });
  assert.equal(complete.statusCode, 200);
  assert.equal(complete.body.routeType, 'concept_tutor');
  assert.equal(complete.body.tutor.completed, true);
  assert.equal(complete.body.tutor.active, false);
  assert.equal(complete.body.tutor.originalQuestion, message);
  assert.match(complete.body.response, finalPattern);
  assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
}

async function assertTwoStepCompletes({
  request,
  studentSessions,
  classSessionId,
  studentHubId,
  message,
  firstChoice,
  secondChoice,
  originalQuestion = message,
  finalAnswer
}) {
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');
  assert.equal(start.body.tutor.active, true);
  assert.equal(start.body.tutor.id, 'matter.element-compound-mixture');
  assert.equal(start.body.tutor.originalQuestion, originalQuestion);
  assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
  assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
  assert.doesNotMatch(start.body.response, new RegExp(escapeRegExp(finalAnswer), 'i'), 'start response should hide final answer');

  const step2 = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: firstChoice
  });
  assert.equal(step2.statusCode, 200);
  assert.equal(step2.body.routeType, 'concept_tutor');
  assert.equal(step2.body.tutor.active, true);
  assert.equal(step2.body.tutor.currentStepIndex, 1);
  assert.equal(step2.body.tutor.originalQuestion, originalQuestion);
  assert.equal(step2.body.tutor.finalAnswer, undefined, 'intermediate tutor metadata should hide final answer');
  assert.equal(step2.body.tutor.work.finalAnswer, '', 'intermediate tutor work should hide final answer');
  assert.match(step2.body.response, /Are the parts chemically joined into a new substance, or physically mixed together\?/i);
  assert.match(step2.body.response, /1\. Chemically joined into a new substance/i);
  assert.match(step2.body.response, /2\. Physically mixed together/i);
  assert.doesNotMatch(step2.body.response, new RegExp(escapeRegExp(finalAnswer), 'i'), 'intermediate response should hide final answer');

  const complete = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: secondChoice
  });
  assert.equal(complete.statusCode, 200);
  assert.equal(complete.body.routeType, 'concept_tutor');
  assert.equal(complete.body.tutor.completed, true);
  assert.equal(complete.body.tutor.originalQuestion, originalQuestion);
  assert.equal(complete.body.tutor.finalAnswer, finalAnswer);
  assert.match(complete.body.response, new RegExp(escapeRegExp(finalAnswer), 'i'));
  assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
}

async function assertUnknownClassificationCompletes({
  request,
  studentSessions,
  classSessionId
}) {
  const studentHubId = 'unknown-selected-choice';
  const message = 'Is modeling clay an element compound or mixture?';
  const finalAnswer = 'Modeling Clay is a mixture because the parts are physically mixed together.';

  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');
  assert.equal(start.body.tutor.active, true);
  assert.equal(start.body.tutor.originalQuestion, message);
  assert.equal(start.body.tutor.finalAnswer, undefined, 'unknown active tutor metadata should hide final answer');
  assert.doesNotMatch(start.body.response, new RegExp(escapeRegExp(finalAnswer), 'i'));

  const step2 = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '2'
  });
  assert.equal(step2.statusCode, 200);
  assert.equal(step2.body.routeType, 'concept_tutor');
  assert.equal(step2.body.tutor.active, true);
  assert.equal(step2.body.tutor.currentStepIndex, 1);
  assert.doesNotMatch(step2.body.response, new RegExp(escapeRegExp(finalAnswer), 'i'));

  const complete = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '2'
  });
  assert.equal(complete.statusCode, 200);
  assert.equal(complete.body.routeType, 'concept_tutor');
  assert.equal(complete.body.tutor.completed, true);
  assert.equal(complete.body.tutor.finalAnswer, finalAnswer);
  assert.match(complete.body.response, new RegExp(escapeRegExp(finalAnswer), 'i'));
  assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
}

async function assertWrongChoiceRetries({
  request,
  studentSessions,
  classSessionId
}) {
  const studentHubId = 'wrong-choice-retry';
  const message = 'Is water an element compound or mixture?';
  const finalAnswer = 'Water is a compound because hydrogen and oxygen are chemically joined into one substance.';

  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');
  assert.equal(start.body.tutor.currentStepIndex, 0);

  const wrong = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '1'
  });
  assert.equal(wrong.statusCode, 200);
  assert.equal(wrong.body.routeType, 'concept_tutor');
  assert.equal(wrong.body.tutor.active, true);
  assert.equal(wrong.body.tutor.currentStepIndex, 0, 'wrong numbered choice should not advance');
  assert.match(wrong.body.response, /Not quite/i);
  assert.equal(wrong.body.tutor.finalAnswer, undefined, 'wrong response should hide final answer');
  assert.doesNotMatch(wrong.body.response, new RegExp(escapeRegExp(finalAnswer), 'i'));
  assert.ok(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem);

  const step2 = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '2'
  });
  assert.equal(step2.statusCode, 200);
  assert.equal(step2.body.routeType, 'concept_tutor');
  assert.equal(step2.body.tutor.active, true);
  assert.equal(step2.body.tutor.currentStepIndex, 1);
}

async function assertHomogeneousHeterogeneousStillWorks({
  request,
  studentSessions,
  classSessionId
}) {
  const studentHubId = 'homogeneous-heterogeneous-still-works';
  const message = 'Is salt water homogeneous or heterogeneous?';
  const finalAnswer = 'Salt water is a homogeneous mixture because it is the same throughout.';

  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');
  assert.equal(start.body.tutor.id, 'matter.mixtures.homogeneous-heterogeneous');
  assert.equal(start.body.tutor.originalQuestion, message);
  assert.equal(start.body.tutor.finalAnswer, undefined, 'active mixture tutor metadata should hide final answer');
  assert.match(start.body.response, /Is it the same throughout, or can you see different parts\?/i);
  assert.doesNotMatch(start.body.response, new RegExp(escapeRegExp(finalAnswer), 'i'));

  const complete = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '1'
  });
  assert.equal(complete.statusCode, 200);
  assert.equal(complete.body.routeType, 'concept_tutor');
  assert.equal(complete.body.tutor.completed, true);
  assert.equal(complete.body.tutor.finalAnswer, finalAnswer);
  assert.match(complete.body.response, new RegExp(escapeRegExp(finalAnswer), 'i'));
  assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
}

async function assertDirectAnswer({
  request,
  classSessionId,
  studentHubId,
  message,
  includes
}) {
  const response = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message
  });

  assert.equal(response.statusCode, 200, `${message} should return 200`);
  assert.notEqual(response.body.routeType, 'concept_tutor', `${message} should not start classification tutor`);
  assert.match(response.body.response, includes, `${message} should keep direct answer behavior`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
