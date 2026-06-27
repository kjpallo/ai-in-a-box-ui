const assert = require('node:assert/strict');

const {
  buildReferencePointConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const FINAL_ANSWER = /A reference point is the place or object used for comparison when describing an object's position or motion\./i;

const SUPPORTED_REFERENCE_POINT_PROMPTS = [
  'What do you compare an object\'s position to?',
  'What do you compare motion to?',
  'What point or object do you compare position to?',
  'When describing motion, what do you use for comparison?',
  'What is used to tell if something has changed position?',
  'Which choice is used to compare an object\'s position?'
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is a reference point?',
    includes: /reference point|place|object|changed position|comparison/i
  },
  {
    prompt: 'Define reference point.',
    includes: /reference point|place|object|changed position|comparison/i
  },
  {
    prompt: 'Explain reference point.',
    includes: /reference point|place|object|changed position|comparison/i
  },
  {
    prompt: 'Why are reference points important?',
    includes: /reference point|position|motion|compare|comparison/i
  },
  {
    prompt: 'Give an example of a reference point.',
    includes: /reference point|example|position|motion|compare|comparison/i
  }
];

const NOT_REFERENCE_POINT_CONCEPT_TUTOR_CASES = [
  'What is net force?',
  'What is Newton\'s first law?',
  'What is inertia?',
  'What is speed?',
  'What is velocity?',
  'Calculate speed if distance is 20 m and time is 5 s.',
  'A 4 kg object accelerates at 3 m/s^2. What force is needed?',
  'Is salt water homogeneous or heterogeneous?',
  'Is water an element compound or mixture?',
  'Are the forces balanced or unbalanced if 5 N pushes right and 5 N pushes left?'
];

async function main() {
  assert.ok(
    buildReferencePointConceptTutorPattern('What do you compare an object\'s position to?'),
    'supported comparison prompts should build the reference point concept tutor pattern'
  );
  assert.equal(
    buildReferencePointConceptTutorPattern('What is a reference point?'),
    null,
    'direct definition questions should not build the reference point concept tutor pattern'
  );
  assert.equal(
    buildReferencePointConceptTutorPattern('Calculate speed if distance is 20 m and time is 5 s.'),
    null,
    'formula questions should not build the reference point concept tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertWrongNumberedChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertUnrelatedPromptsDoNotBecomeReferencePointTutor({ request, classSessionId });

  console.log('PASS concept tutor reference point: live comparison prompts are controlled and direct/formula/existing routes are preserved');
}

async function assertSupportedPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const prompt of SUPPORTED_REFERENCE_POINT_PROMPTS) {
    const studentHubId = `reference-point-${slug(prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'motion-force.reference-point.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /What do you compare an object's position or motion to\?/i);
    assert.match(start.body.response, /1\. A reference point/i);
    assert.match(start.body.response, /2\. A force/i);
    assert.match(start.body.response, /3\. A mixture/i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, FINAL_ANSWER, 'start response should hide final answer');

    const complete = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: '1'
    });
    assert.equal(complete.statusCode, 200);
    assert.equal(complete.body.routeType, 'concept_tutor');
    assert.equal(complete.body.tutor.completed, true);
    assert.equal(complete.body.tutor.active, false);
    assert.match(complete.body.response, FINAL_ANSWER);
    assert.match(complete.body.tutor.finalAnswer, FINAL_ANSWER);
    assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
  }
}

async function assertWrongNumberedChoiceRetries({ request, classSessionId }) {
  const studentHubId = 'reference-point-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'What do you compare motion to?'
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');

  const wrong = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '2'
  });
  assert.equal(wrong.statusCode, 200);
  assert.equal(wrong.body.routeType, 'concept_tutor');
  assert.equal(wrong.body.tutor.active, true);
  assert.equal(wrong.body.tutor.currentStepIndex, 0);
  assert.match(wrong.body.response, /Not quite/i);
  assert.doesNotMatch(wrong.body.response, FINAL_ANSWER);

  const correct = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '1'
  });
  assert.equal(correct.statusCode, 200);
  assert.equal(correct.body.routeType, 'concept_tutor');
  assert.equal(correct.body.tutor.completed, true);
  assert.match(correct.body.response, FINAL_ANSWER);
}

async function assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId }) {
  for (const testCase of DIRECT_ANSWER_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should stay a direct answer`);
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertUnrelatedPromptsDoNotBecomeReferencePointTutor({ request, classSessionId }) {
  for (const prompt of NOT_REFERENCE_POINT_CONCEPT_TUTOR_CASES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `not-reference-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(
      response.body.tutor?.id,
      'motion-force.reference-point.identification',
      `${prompt} should not start the reference point Concept Tutor`
    );
  }
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
