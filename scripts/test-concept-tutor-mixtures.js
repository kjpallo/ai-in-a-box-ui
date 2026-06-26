const assert = require('node:assert/strict');

const {
  buildMixtureConceptTutorPattern,
  MIXTURE_CLASSIFICATION_TRIGGER_WORDS
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

async function main() {
  assert.deepEqual(
    MIXTURE_CLASSIFICATION_TRIGGER_WORDS,
    [
      'homogeneous',
      'homogenous',
      'homo',
      'heterogeneous',
      'heterogenous',
      'hetrogeneous',
      'hetrogenous',
      'hetero',
      'retro mixture'
    ],
    'trigger list should document the supported mixture classification terms'
  );

  assert.ok(
    buildMixtureConceptTutorPattern('Is slime homo or hetero?'),
    'unknown examples that clearly ask for homo/hetero classification should still get the tutor'
  );
  assert.equal(
    buildMixtureConceptTutorPattern('What does homogeneous mean?'),
    null,
    'pure definition questions should not build the classification tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertStartsConceptTutor({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'salt-water',
    message: 'Is salt water homogeneous or heterogeneous?',
    expectedOriginalQuestion: 'Is salt water homogeneous or heterogeneous?'
  });

  await assertStartsConceptTutor({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'cereal',
    message: 'Is cereal in milk homo or hetero?'
  });

  await assertStartsConceptTutor({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'typo-hetero',
    message: 'Is trail mix hetrogenous?'
  });

  await assertStartsConceptTutor({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'typo-homo',
    message: 'Is Kool Aid homogenous?'
  });

  await assertStartsConceptTutor({
    request,
    studentSessions,
    classSessionId,
    studentHubId: 'retro',
    message: 'Is this a retro mixture: cereal and milk?'
  });

  await assertDirectAnswer({
    request,
    classSessionId,
    studentHubId: 'definition-homogeneous',
    message: 'What does homogeneous mean?',
    includes: /same throughout|evenly|uniform/i
  });

  await assertDirectAnswer({
    request,
    classSessionId,
    studentHubId: 'definition-heterogeneous',
    message: 'Define heterogeneous.',
    includes: /different parts|uneven|visible|separate/i
  });

  await assertDirectAnswer({
    request,
    classSessionId,
    studentHubId: 'difference',
    message: 'What is the difference between homogeneous and heterogeneous?',
    includes: /homogeneous/i
  });

  await assertDirectAnswer({
    request,
    classSessionId,
    studentHubId: 'explain',
    message: 'Explain homogeneous and heterogeneous mixtures.',
    includes: /homogeneous/i
  });

  const wrongStart = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'wrong-then-correct',
    message: 'Is salt water homogeneous or heterogeneous?'
  });
  assert.equal(wrongStart.statusCode, 200);
  assert.equal(wrongStart.body.routeType, 'concept_tutor');
  assert.equal(wrongStart.body.tutor.originalQuestion, 'Is salt water homogeneous or heterogeneous?');
  assert.equal(wrongStart.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
  assert.equal(wrongStart.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
  assert.doesNotMatch(wrongStart.body.response, /Salt water is a homogeneous mixture/i, 'start response should hide final answer');

  const wrong = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'wrong-then-correct',
    message: '2'
  });
  assert.equal(wrong.statusCode, 200);
  assert.equal(wrong.body.routeType, 'concept_tutor');
  assert.equal(wrong.body.tutor.active, true);
  assert.equal(wrong.body.tutor.currentStepIndex, 0, 'wrong choice should not advance');
  assert.match(wrong.body.response, /Not quite/i);
  assert.doesNotMatch(wrong.body.response, /Salt water is a homogeneous mixture/i, 'wrong response should not reveal final answer');

  const correct = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'wrong-then-correct',
    message: '1'
  });
  assert.equal(correct.statusCode, 200);
  assert.equal(correct.body.routeType, 'concept_tutor');
  assert.equal(correct.body.tutor.completed, true);
  assert.equal(correct.body.tutor.active, false);
  assert.equal(correct.body.tutor.originalQuestion, 'Is salt water homogeneous or heterogeneous?');
  assert.match(correct.body.response, /Salt water is a homogeneous mixture because it is the same throughout\./i);
  assert.equal(
    correct.body.tutor.finalAnswer,
    'Salt water is a homogeneous mixture because it is the same throughout.'
  );
  assert.equal(studentSessions[classSessionId].anonymousHubs['wrong-then-correct'].currentTutorProblem, null);

  const unknownStart = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'unknown',
    message: 'Is slime homo or hetero?'
  });
  assert.equal(unknownStart.statusCode, 200);
  assert.equal(unknownStart.body.routeType, 'concept_tutor');
  const unknownComplete = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'unknown',
    message: '2'
  });
  assert.equal(unknownComplete.statusCode, 200);
  assert.equal(unknownComplete.body.routeType, 'concept_tutor');
  assert.match(unknownComplete.body.response, /Slime is a heterogeneous mixture because you can see different parts\./i);

  const formulaStart = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'formula-priority',
    message: 'What is the force if mass is 10 kg and acceleration is 3 m/s²?'
  });
  assert.equal(formulaStart.statusCode, 200);
  assert.equal(formulaStart.body.routeType, 'formula_tutor', 'Formula Tutor should keep priority for formula questions');

  console.log('PASS concept tutor mixtures: mixture classification starts narrowly, retries safely, completes, and preserves direct/formula routes');
}

async function assertStartsConceptTutor({
  request,
  studentSessions,
  classSessionId,
  studentHubId,
  message,
  expectedOriginalQuestion = message
}) {
  const response = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message
  });

  assert.equal(response.statusCode, 200, `${message} should return 200`);
  assert.equal(response.body.routeType, 'concept_tutor', `${message} should start Concept Tutor`);
  assert.equal(response.body.tutor.active, true, `${message} should have active tutor metadata`);
  assert.equal(response.body.tutor.tutorType, 'concept_tutor');
  assert.equal(response.body.tutor.originalQuestion, expectedOriginalQuestion);
  assert.match(response.body.response, /Is it the same throughout, or can you see different parts\?/i);
  assert.match(response.body.response, /1\. Same throughout/i);
  assert.match(response.body.response, /2\. Different parts/i);
  assert.equal(response.body.tutor.finalAnswer, undefined, `${message} should not expose final answer before completion`);
  assert.ok(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem);
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
