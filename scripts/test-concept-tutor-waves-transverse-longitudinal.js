const assert = require('node:assert/strict');

const {
  buildTransverseLongitudinalWavesConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const TRANSVERSE_FINAL = /This describes a transverse wave because the matter moves perpendicular to the direction the wave travels\./i;
const LONGITUDINAL_FINAL = /This describes a longitudinal wave because the matter moves back and forth parallel to the direction the wave travels\./i;

const SUPPORTED_IDENTIFICATION_CASES = [
  {
    prompt: 'Is a wave moving up and down transverse or longitudinal?',
    choice: '1',
    finalAnswer: TRANSVERSE_FINAL
  },
  {
    prompt: 'Is a wave moving side to side transverse or longitudinal?',
    choice: '1',
    finalAnswer: TRANSVERSE_FINAL
  },
  {
    prompt: 'Is a wave with matter moving perpendicular to the wave direction transverse or longitudinal?',
    choice: '1',
    finalAnswer: TRANSVERSE_FINAL
  },
  {
    prompt: 'Is a wave moving back and forth transverse or longitudinal?',
    choice: '2',
    finalAnswer: LONGITUDINAL_FINAL
  },
  {
    prompt: 'Is a wave with matter moving parallel to the wave direction transverse or longitudinal?',
    choice: '2',
    finalAnswer: LONGITUDINAL_FINAL
  },
  {
    prompt: 'Is a sound wave transverse or longitudinal?',
    choice: '2',
    finalAnswer: LONGITUDINAL_FINAL
  },
  {
    prompt: 'Is a wave on a rope transverse or longitudinal?',
    choice: '1',
    finalAnswer: TRANSVERSE_FINAL
  },
  {
    prompt: 'Which is longitudinal: matter moves back and forth or matter moves up and down?',
    choice: '2',
    finalAnswer: LONGITUDINAL_FINAL
  },
  {
    prompt: 'Which is transverse: matter moves up and down or matter moves back and forth?',
    choice: '1',
    finalAnswer: TRANSVERSE_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is a transverse wave?',
    includes: /transverse|perpendicular|right angles/i
  },
  {
    prompt: 'Define transverse wave.',
    includes: /transverse|perpendicular|right angles/i
  },
  {
    prompt: 'What is a longitudinal wave?',
    includes: /longitudinal|parallel|compressional/i
  },
  {
    prompt: 'Define longitudinal wave.',
    includes: /longitudinal|parallel|compressional/i
  },
  {
    prompt: 'Explain the difference between transverse and longitudinal waves.',
    includes: /transverse|longitudinal|perpendicular|parallel/i
  },
  {
    prompt: 'How are transverse and longitudinal waves different?',
    includes: /transverse|longitudinal|perpendicular|parallel/i
  },
  {
    prompt: 'What is a wave?',
    includes: /disturbance|transfers energy|matter|space/i
  }
];

const NON_TARGET_CASES_TO_PRESERVE = [
  'What is frequency?',
  'What is wavelength?',
  'What is amplitude?',
  'What is reflection?',
  'What is refraction?',
  'Is light mechanical or electromagnetic?',
  'Is sound mechanical or electromagnetic?'
];

async function main() {
  assert.ok(
    buildTransverseLongitudinalWavesConceptTutorPattern('Is a wave moving up and down transverse or longitudinal?'),
    'supported transverse/longitudinal identification prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildTransverseLongitudinalWavesConceptTutorPattern('What is a transverse wave?'),
    null,
    'pure transverse definition questions should not build the concept tutor pattern'
  );
  assert.equal(
    buildTransverseLongitudinalWavesConceptTutorPattern('Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.'),
    null,
    'wave formula questions should not build the transverse/longitudinal concept tutor pattern'
  );
  assert.equal(
    buildTransverseLongitudinalWavesConceptTutorPattern('Is sound mechanical or electromagnetic?'),
    null,
    'mechanical/electromagnetic classification should not build this concept tutor pattern'
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
  await assertFormulaPromptKeepsFormulaTutor({ request, classSessionId });
  await assertNonTargetWavePromptsBypassThisConceptTutor({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor waves transverse/longitudinal: live identification route is controlled, completes, and preserves direct/formula/existing concept routes');
}

async function assertSupportedIdentificationPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_IDENTIFICATION_CASES) {
    const studentHubId = `waves-tl-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'waves.transverse-longitudinal.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /How does the matter in the wave move compared with the direction the wave travels\?/i);
    assert.match(start.body.response, /1\. Up and down or side to side, perpendicular to the wave direction\./i);
    assert.match(start.body.response, /2\. Back and forth, parallel to the wave direction\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, TRANSVERSE_FINAL, 'start response should hide transverse final answer');
    assert.doesNotMatch(start.body.response, LONGITUDINAL_FINAL, 'start response should hide longitudinal final answer');

    const complete = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.choice
    });
    assert.equal(complete.statusCode, 200);
    assert.equal(complete.body.routeType, 'concept_tutor');
    assert.equal(complete.body.tutor.completed, true);
    assert.equal(complete.body.tutor.active, false);
    assert.match(complete.body.response, testCase.finalAnswer);
    assert.match(complete.body.tutor.finalAnswer, testCase.finalAnswer);
    assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
  }
}

async function assertInvalidChoiceRetries({ request, classSessionId }) {
  const studentHubId = 'waves-transverse-longitudinal-invalid-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is a wave moving up and down transverse or longitudinal?'
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');

  const invalid = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '3'
  });
  assert.equal(invalid.statusCode, 200);
  assert.equal(invalid.body.routeType, 'concept_tutor');
  assert.equal(invalid.body.tutor.active, true);
  assert.equal(invalid.body.tutor.currentStepIndex, 0);
  assert.match(invalid.body.response, /Please choose one of the listed options/i);
  assert.doesNotMatch(invalid.body.response, TRANSVERSE_FINAL);
  assert.doesNotMatch(invalid.body.response, LONGITUDINAL_FINAL);
}

async function assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId }) {
  for (const testCase of DIRECT_ANSWER_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.tutor?.id, 'waves.transverse-longitudinal.identification');
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should stay a direct answer`);
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertFormulaPromptKeepsFormulaTutor({ request, classSessionId }) {
  const prompt = 'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.';
  const response = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'formula-wave-speed',
    message: prompt
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.routeType, 'formula_tutor', `${prompt} should keep Formula Tutor priority`);
  assert.notEqual(response.body.tutor?.id, 'waves.transverse-longitudinal.identification');
}

async function assertNonTargetWavePromptsBypassThisConceptTutor({ request, classSessionId }) {
  for (const prompt of NON_TARGET_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `non-target-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.tutor?.id, 'waves.transverse-longitudinal.identification');
  }
}

async function assertExistingConceptTutorsStillStart({ request, classSessionId }) {
  const cases = [
    {
      prompt: 'Is a car speeding up acceleration?',
      expectedTutorId: 'motion-force.acceleration.identification'
    },
    {
      prompt: 'Is 20 m/s north speed or velocity?',
      expectedTutorId: 'motion-force.speed-velocity.identification'
    },
    {
      prompt: 'Is 10 meters north distance or displacement?',
      expectedTutorId: 'motion-force.distance-displacement.identification'
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
