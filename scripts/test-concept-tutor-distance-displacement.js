const assert = require('node:assert/strict');

const {
  buildDistanceDisplacementConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const DISTANCE_FINAL = /This describes distance because it is the total path traveled, no matter what direction the object moved\./i;
const DISPLACEMENT_FINAL = /This describes displacement because it is the straight-line change from start to finish and includes direction\./i;

const SUPPORTED_IDENTIFICATION_CASES = [
  {
    prompt: 'Is walking 10 meters around a track distance or displacement?',
    choice: '1',
    finalPattern: DISTANCE_FINAL
  },
  {
    prompt: 'Is 10 meters north distance or displacement?',
    choice: '2',
    finalPattern: DISPLACEMENT_FINAL
  },
  {
    prompt: 'Is the total path traveled distance or displacement?',
    choice: '1',
    finalPattern: DISTANCE_FINAL
  },
  {
    prompt: 'Is the straight-line change from start to finish distance or displacement?',
    choice: '2',
    finalPattern: DISPLACEMENT_FINAL
  },
  {
    prompt: 'Which is displacement: 20 m walked total or 5 m east from the start?',
    choice: '2',
    finalPattern: DISPLACEMENT_FINAL
  },
  {
    prompt: 'Which is distance: 20 m walked total or 5 m east from the start?',
    choice: '1',
    finalPattern: DISTANCE_FINAL
  },
  {
    prompt: "Is a runner's total path around the field distance or displacement?",
    choice: '1',
    finalPattern: DISTANCE_FINAL
  },
  {
    prompt: 'Is how far an object is from where it started with direction distance or displacement?',
    choice: '2',
    finalPattern: DISPLACEMENT_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is distance?',
    includes: /Distance is|total path traveled/i
  },
  {
    prompt: 'Define distance.',
    includes: /Distance is|total path traveled/i
  },
  {
    prompt: 'What is displacement?',
    includes: /Displacement is|straight-line change/i
  },
  {
    prompt: 'Define displacement.',
    includes: /Displacement is|straight-line change/i
  },
  {
    prompt: 'Explain the difference between distance and displacement.',
    includes: /Distance is|Displacement is|straight-line change|total path/i
  },
  {
    prompt: 'How are distance and displacement different?',
    includes: /Distance is|Displacement is|straight-line change|total path/i
  }
];

const FORMULA_TUTOR_CASES_TO_PRESERVE = [
  'Calculate speed if distance is 20 m and time is 5 s.',
  'What is the speed if distance is 100 m and time is 10 s?',
  'What is distance if speed is 5 m/s and time is 4 s?',
  'What is time if distance is 20 m and speed is 5 m/s?',
  'A runner goes 40 m in 8 s. What is the speed?'
];

async function main() {
  assert.ok(
    buildDistanceDisplacementConceptTutorPattern('Is 10 meters north distance or displacement?'),
    'supported distance/displacement identification prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildDistanceDisplacementConceptTutorPattern('What is displacement?'),
    null,
    'pure definition questions should not build the distance/displacement concept tutor pattern'
  );
  assert.equal(
    buildDistanceDisplacementConceptTutorPattern('What is distance if speed is 5 m/s and time is 4 s?'),
    null,
    'speed/distance/time formula questions should not build the distance/displacement concept tutor pattern'
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

  console.log('PASS concept tutor distance displacement: live identification route is controlled, completes, and preserves direct/formula/existing concept routes');
}

async function assertSupportedIdentificationPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_IDENTIFICATION_CASES) {
    const studentHubId = `distance-displacement-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'motion-force.distance-displacement.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /Is it the total path traveled or the straight-line change from start to finish\?/i);
    assert.match(start.body.response, /1\. Total path traveled\./i);
    assert.match(start.body.response, /2\. Straight-line change from start to finish, with direction\./i);
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
  const studentHubId = 'distance-displacement-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is 10 meters north distance or displacement?'
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
  assert.doesNotMatch(wrong.body.response, DISPLACEMENT_FINAL);

  const correct = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '2'
  });
  assert.equal(correct.statusCode, 200);
  assert.equal(correct.body.routeType, 'concept_tutor');
  assert.equal(correct.body.tutor.completed, true);
  assert.match(correct.body.response, DISPLACEMENT_FINAL);
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
    assert.notEqual(response.body.tutor?.id, 'motion-force.distance-displacement.identification');
  }
}

async function assertExistingConceptTutorsStillStart({ request, classSessionId }) {
  const cases = [
    {
      prompt: 'Is 20 m/s north speed or velocity?',
      expectedTutorId: 'motion-force.speed-velocity.identification'
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
