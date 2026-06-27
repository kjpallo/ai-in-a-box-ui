const assert = require('node:assert/strict');

const {
  buildAccelerationConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const ACCELERATION_FINAL = /This describes acceleration because acceleration means a change in velocity\. An object accelerates when it speeds up, slows down, or changes direction\./i;

const SUPPORTED_IDENTIFICATION_CASES = [
  {
    prompt: 'Is a car speeding up acceleration?',
    choice: '1'
  },
  {
    prompt: 'Is a bike slowing down acceleration?',
    choice: '2'
  },
  {
    prompt: 'Is a car turning a corner acceleration?',
    choice: '3'
  },
  {
    prompt: 'Is changing direction acceleration?',
    choice: '3'
  },
  {
    prompt: 'Is speeding up, slowing down, or changing direction acceleration?',
    choice: '1'
  },
  {
    prompt: 'Which is acceleration: speeding up, standing still, or staying the same speed?',
    choice: '1'
  },
  {
    prompt: 'Which is acceleration: slowing down, sitting still, or moving at constant speed?',
    choice: '2'
  },
  {
    prompt: 'Which is acceleration: changing direction, staying still, or moving at constant speed?',
    choice: '3'
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is acceleration?',
    includes: /change in velocity|speed up|slows? down|direction/i
  },
  {
    prompt: 'Define acceleration.',
    includes: /change in velocity|speed up|slows? down|direction/i
  },
  {
    prompt: 'Explain acceleration.',
    includes: /change in velocity|speed up|slows? down|direction/i
  },
  {
    prompt: 'What does acceleration mean?',
    includes: /change in velocity|speed up|slows? down|direction/i
  },
  {
    prompt: 'How is acceleration different from speed?',
    includes: /acceleration|speed|change/i
  }
];

const FORMULA_TUTOR_CASES_TO_PRESERVE = [
  'What is the acceleration of a 10 kg object with a 20 N force?',
  'A 2 N and an 8 N force pull right and a 4 N force pulls left. What is the acceleration of a 0.5 kg object?',
  'Calculate acceleration if final velocity is 20 m/s, initial velocity is 5 m/s, and time is 3 s.',
  'What is acceleration if velocity changes from 0 m/s to 10 m/s in 5 s?',
  'A car speeds up from 10 m/s to 30 m/s in 4 seconds. What is its acceleration?'
];

async function main() {
  assert.ok(
    buildAccelerationConceptTutorPattern('Is a car speeding up acceleration?'),
    'supported acceleration identification prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildAccelerationConceptTutorPattern('What is acceleration?'),
    null,
    'pure definition questions should not build the acceleration concept tutor pattern'
  );
  assert.equal(
    buildAccelerationConceptTutorPattern('A car speeds up from 10 m/s to 30 m/s in 4 seconds. What is its acceleration?'),
    null,
    'acceleration formula questions should not build the acceleration concept tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedIdentificationPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertInvalidChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertFormulaPromptsKeepFormulaTutor({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor acceleration: live identification route is controlled, completes, and preserves direct/formula/existing concept routes');
}

async function assertSupportedIdentificationPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_IDENTIFICATION_CASES) {
    const studentHubId = `acceleration-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'motion-force.acceleration.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /What kind of change in motion is happening\?/i);
    assert.match(start.body.response, /1\. Speeding up/i);
    assert.match(start.body.response, /2\. Slowing down/i);
    assert.match(start.body.response, /3\. Changing direction/i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, ACCELERATION_FINAL, 'start response should hide final answer');

    const complete = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.choice
    });
    assert.equal(complete.statusCode, 200);
    assert.equal(complete.body.routeType, 'concept_tutor');
    assert.equal(complete.body.tutor.completed, true);
    assert.equal(complete.body.tutor.active, false);
    assert.match(complete.body.response, ACCELERATION_FINAL);
    assert.match(complete.body.tutor.finalAnswer, ACCELERATION_FINAL);
    assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
  }
}

async function assertInvalidChoiceRetries({ request, classSessionId }) {
  const studentHubId = 'acceleration-invalid-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is a car speeding up acceleration?'
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');

  const invalid = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '4'
  });
  assert.equal(invalid.statusCode, 200);
  assert.equal(invalid.body.routeType, 'concept_tutor');
  assert.equal(invalid.body.tutor.active, true);
  assert.equal(invalid.body.tutor.currentStepIndex, 0);
  assert.match(invalid.body.response, /Please choose one of the listed options/i);
  assert.doesNotMatch(invalid.body.response, ACCELERATION_FINAL);
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

async function assertFormulaPromptsKeepFormulaTutor({ request, classSessionId }) {
  for (const prompt of FORMULA_TUTOR_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `formula-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'formula_tutor', `${prompt} should keep Formula Tutor priority`);
    assert.notEqual(response.body.tutor?.id, 'motion-force.acceleration.identification');
  }
}

async function assertExistingConceptTutorsStillStart({ request, classSessionId }) {
  const cases = [
    {
      prompt: 'Is 20 m/s north speed or velocity?',
      expectedTutorId: 'motion-force.speed-velocity.identification'
    },
    {
      prompt: 'Is 10 meters north distance or displacement?',
      expectedTutorId: 'motion-force.distance-displacement.identification'
    },
    {
      prompt: "Which Newton's law is shown when pushing a shopping cart harder makes it accelerate more?",
      expectedTutorId: 'motion-force.newtons-laws.identification'
    },
    {
      prompt: 'Are the forces balanced or unbalanced if 5 N pushes right and 5 N pushes left?',
      expectedTutorId: 'motion-force.balanced-unbalanced-forces.identification'
    },
    {
      prompt: 'What do you compare an object\'s position to?',
      expectedTutorId: 'motion-force.reference-point.identification'
    },
    {
      prompt: 'Is salt water homogeneous or heterogeneous?',
      expectedTutorId: 'matter.mixtures.homogeneous-heterogeneous'
    },
    {
      prompt: 'Is water an element compound or mixture?',
      expectedTutorId: 'matter.element-compound-mixture'
    }
  ];

  for (const testCase of cases) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `existing-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${testCase.prompt} should still start Concept Tutor`);
    assert.equal(response.body.tutor.id, testCase.expectedTutorId);
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
