const assert = require('node:assert/strict');

const {
  buildSpeedVelocityConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const SPEED_FINAL = /This describes speed because it tells how fast something moves without giving a direction\./i;
const VELOCITY_FINAL = /This describes velocity because it tells how fast something moves and includes direction\./i;

const SUPPORTED_IDENTIFICATION_CASES = [
  {
    prompt: 'Is 20 m/s speed or velocity?',
    choice: '1',
    finalPattern: SPEED_FINAL
  },
  {
    prompt: 'Is 20 m/s north speed or velocity?',
    choice: '2',
    finalPattern: VELOCITY_FINAL
  },
  {
    prompt: 'Is a car moving 50 km/h speed or velocity?',
    choice: '1',
    finalPattern: SPEED_FINAL
  },
  {
    prompt: 'Is a car moving 50 km/h east speed or velocity?',
    choice: '2',
    finalPattern: VELOCITY_FINAL
  },
  {
    prompt: 'Is "10 m/s to the left" speed or velocity?',
    choice: '2',
    finalPattern: VELOCITY_FINAL
  },
  {
    prompt: 'Is "10 m/s" speed or velocity?',
    choice: '1',
    finalPattern: SPEED_FINAL
  },
  {
    prompt: 'Which is velocity: 30 mph or 30 mph west?',
    choice: '2',
    finalPattern: VELOCITY_FINAL
  },
  {
    prompt: 'Which is speed: 30 mph or 30 mph west?',
    choice: '1',
    finalPattern: SPEED_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is speed?',
    includes: /Speed tells how fast|speed is/i
  },
  {
    prompt: 'Define speed.',
    includes: /Speed tells how fast|speed is/i
  },
  {
    prompt: 'What is velocity?',
    includes: /Velocity is speed|speed with direction/i
  },
  {
    prompt: 'Define velocity.',
    includes: /Velocity is speed|speed with direction/i
  },
  {
    prompt: 'Explain the difference between speed and velocity.',
    includes: /Speed:|Velocity:|direction/i
  },
  {
    prompt: 'How are speed and velocity different?',
    includes: /Speed:|Velocity:|direction/i
  }
];

const FORMULA_TUTOR_CASES_TO_PRESERVE = [
  'Calculate speed if distance is 20 m and time is 5 s.',
  'What is the speed if a car travels 100 meters in 10 seconds?',
  'A runner goes 40 m in 8 s. What is the speed?',
  'What is distance if speed is 5 m/s and time is 4 s?',
  'What is time if distance is 20 m and speed is 5 m/s?'
];

async function main() {
  assert.ok(
    buildSpeedVelocityConceptTutorPattern('Is 20 m/s north speed or velocity?'),
    'supported speed/velocity identification prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildSpeedVelocityConceptTutorPattern('What is velocity?'),
    null,
    'pure definition questions should not build the speed/velocity concept tutor pattern'
  );
  assert.equal(
    buildSpeedVelocityConceptTutorPattern('Calculate speed if distance is 20 m and time is 5 s.'),
    null,
    'speed/distance/time formula questions should not build the speed/velocity concept tutor pattern'
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
  await assertWrongNumberedChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertFormulaPromptsKeepFormulaTutor({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor speed velocity: live identification route is controlled, completes, and preserves direct/formula/existing concept routes');
}

async function assertSupportedIdentificationPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_IDENTIFICATION_CASES) {
    const studentHubId = `speed-velocity-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'motion-force.speed-velocity.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /Does the description include direction\?/i);
    assert.match(start.body.response, /1\. No, it only tells how fast something moves\./i);
    assert.match(start.body.response, /2\. Yes, it tells speed and direction\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, testCase.finalPattern, 'start response should hide final answer');

    const complete = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.choice
    });
    assert.equal(complete.statusCode, 200);
    assert.equal(complete.body.routeType, 'concept_tutor');
    assert.equal(complete.body.tutor.completed, true);
    assert.equal(complete.body.tutor.active, false);
    assert.match(complete.body.response, testCase.finalPattern);
    assert.match(complete.body.tutor.finalAnswer, testCase.finalPattern);
    assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
  }
}

async function assertWrongNumberedChoiceRetries({ request, classSessionId }) {
  const studentHubId = 'speed-velocity-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is 20 m/s north speed or velocity?'
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');

  const wrong = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '1'
  });
  assert.equal(wrong.statusCode, 200);
  assert.equal(wrong.body.routeType, 'concept_tutor');
  assert.equal(wrong.body.tutor.active, true);
  assert.equal(wrong.body.tutor.currentStepIndex, 0);
  assert.match(wrong.body.response, /Not quite/i);
  assert.doesNotMatch(wrong.body.response, VELOCITY_FINAL);

  const correct = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '2'
  });
  assert.equal(correct.statusCode, 200);
  assert.equal(correct.body.routeType, 'concept_tutor');
  assert.equal(correct.body.tutor.completed, true);
  assert.match(correct.body.response, VELOCITY_FINAL);
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
    assert.notEqual(response.body.tutor?.id, 'motion-force.speed-velocity.identification');
  }
}

async function assertExistingConceptTutorsStillStart({ request, classSessionId }) {
  const cases = [
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
