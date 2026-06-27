const assert = require('node:assert/strict');

const {
  buildEnergyTransferConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const CONDUCTION_FINAL = /This describes conduction because thermal energy is transferred by direct contact or touching\./i;
const CONVECTION_FINAL = /This describes convection because thermal energy is transferred by movement or circulation of a liquid or gas\./i;
const RADIATION_FINAL = /This describes radiation because thermal energy is transferred by waves through space without direct contact\./i;

const SUPPORTED_ENERGY_TRANSFER_CASES = [
  {
    prompt: 'Is heat moving through a metal spoon conduction, convection, or radiation?',
    choice: '1',
    finalAnswer: CONDUCTION_FINAL
  },
  {
    prompt: 'Is touching a hot pan conduction, convection, or radiation?',
    choice: '1',
    finalAnswer: CONDUCTION_FINAL
  },
  {
    prompt: 'Is ice melting in your hand conduction, convection, or radiation?',
    choice: '1',
    finalAnswer: CONDUCTION_FINAL
  },
  {
    prompt: 'Is warm air rising conduction, convection, or radiation?',
    choice: '2',
    finalAnswer: CONVECTION_FINAL
  },
  {
    prompt: 'Is boiling water circulating conduction, convection, or radiation?',
    choice: '2',
    finalAnswer: CONVECTION_FINAL
  },
  {
    prompt: 'Is a convection current conduction, convection, or radiation?',
    choice: '2',
    finalAnswer: CONVECTION_FINAL
  },
  {
    prompt: 'Is heat from the Sun conduction, convection, or radiation?',
    choice: '3',
    finalAnswer: RADIATION_FINAL
  },
  {
    prompt: 'Is feeling heat from a fire without touching it conduction, convection, or radiation?',
    choice: '3',
    finalAnswer: RADIATION_FINAL
  },
  {
    prompt: 'Is heat from a lamp conduction, convection, or radiation?',
    choice: '3',
    finalAnswer: RADIATION_FINAL
  },
  {
    prompt: 'Which is conduction: touching a hot pan, warm air rising, or sunlight warming your face?',
    choice: '1',
    finalAnswer: CONDUCTION_FINAL
  },
  {
    prompt: 'Which is convection: touching a hot pan, warm air rising, or sunlight warming your face?',
    choice: '2',
    finalAnswer: CONVECTION_FINAL
  },
  {
    prompt: 'Which is radiation: touching a hot pan, warm air rising, or sunlight warming your face?',
    choice: '3',
    finalAnswer: RADIATION_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is conduction?',
    includes: /heat transfer|direct contact|touching/i
  },
  {
    prompt: 'Define conduction.',
    includes: /heat transfer|direct contact|touching/i
  },
  {
    prompt: 'What is convection?',
    includes: /heat transfer|movement|liquids?|gases?/i
  },
  {
    prompt: 'Define convection.',
    includes: /heat transfer|movement|liquids?|gases?/i
  },
  {
    prompt: 'What is radiation?',
    includes: /heat transfer|electromagnetic waves|space/i
  },
  {
    prompt: 'Define radiation.',
    includes: /heat transfer|electromagnetic waves|space/i
  },
  {
    prompt: 'Explain the difference between conduction, convection, and radiation.',
    includes: /conduction|convection|radiation|direct contact|movement|electromagnetic waves/i
  },
  {
    prompt: 'How are conduction, convection, and radiation different?',
    includes: /conduction|convection|radiation|direct contact|movement|electromagnetic waves/i
  },
  {
    prompt: 'What is thermal energy?',
    includes: /total|kinetic|potential|particles/i
  },
  {
    prompt: 'What is heat transfer?',
    includes: /transfer of energy|temperature difference|higher temperature|lower temperature/i
  },
  {
    prompt: 'Give examples of conduction, convection, and radiation.',
    includes: /conduction|convection|radiation|direct contact|movement|electromagnetic waves/i
  }
];

const FORMULA_CASES_TO_PRESERVE = [
  'Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.',
  'Calculate potential energy if mass is 5 kg and height is 10 m.',
  'Calculate work if force is 20 N and distance is 3 m.',
  'Calculate power if work is 100 J and time is 5 s.',
  'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.'
];

const WAVE_CASES_TO_PRESERVE = [
  {
    prompt: 'Is light mechanical or electromagnetic?',
    expectedTutorId: 'waves.mechanical-electromagnetic.identification'
  },
  {
    prompt: 'Is a radio wave mechanical or electromagnetic?',
    expectedTutorId: 'waves.mechanical-electromagnetic.identification'
  },
  {
    prompt: 'Is a microwave mechanical or electromagnetic?',
    expectedTutorId: 'waves.mechanical-electromagnetic.identification'
  },
  {
    prompt: 'Is a sound wave transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  },
  {
    prompt: 'Is a wave moving up and down transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  },
  {
    prompt: 'Is a wave on a rope transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  }
];

const WAVE_DIRECT_CASES_TO_PRESERVE = [
  {
    prompt: 'What type of wave is light?',
    includes: /electromagnetic|empty space|transverse/i
  },
  {
    prompt: 'What type of wave is a radio wave?',
    includes: /electromagnetic|empty space/i
  },
  {
    prompt: 'What is an electromagnetic wave?',
    includes: /electric|magnetic|vacuum|medium/i
  },
  {
    prompt: 'What is a transverse wave?',
    includes: /transverse|perpendicular|right angles/i
  },
  {
    prompt: 'What is a longitudinal wave?',
    includes: /longitudinal|parallel|compressional/i
  }
];

async function main() {
  assert.ok(
    buildEnergyTransferConceptTutorPattern('Is touching a hot pan conduction, convection, or radiation?'),
    'supported energy transfer prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildEnergyTransferConceptTutorPattern('What is conduction?'),
    null,
    'definition prompts should not build the energy transfer concept tutor pattern'
  );
  assert.equal(
    buildEnergyTransferConceptTutorPattern('Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.'),
    null,
    'formula prompts should not build the energy transfer concept tutor pattern'
  );
  assert.equal(
    buildEnergyTransferConceptTutorPattern('Is light mechanical or electromagnetic?'),
    null,
    'Unit 5 wave classification prompts should not build the energy transfer concept tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedEnergyTransferPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertInvalidChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertFormulaPromptsKeepFormulaTutor({ request, classSessionId });
  await assertUnit5WaveConceptTutorsPreserved({ request, classSessionId });
  await assertUnit5DirectWaveAnswersPreserved({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor energy transfer: conduction/convection/radiation starts narrowly and preserves direct/formula/wave/existing concept routes');
}

async function assertSupportedEnergyTransferPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_ENERGY_TRANSFER_CASES) {
    const studentHubId = `energy-transfer-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'energy.transfer.conduction-convection-radiation');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /How is thermal energy being transferred\?/i);
    assert.match(start.body.response, /1\. By direct contact or touching\./i);
    assert.match(start.body.response, /2\. By movement or circulation of a liquid or gas\./i);
    assert.match(start.body.response, /3\. By waves through space, with no direct contact needed\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, CONDUCTION_FINAL, 'start response should hide conduction final answer');
    assert.doesNotMatch(start.body.response, CONVECTION_FINAL, 'start response should hide convection final answer');
    assert.doesNotMatch(start.body.response, RADIATION_FINAL, 'start response should hide radiation final answer');

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
  const studentHubId = 'energy-transfer-invalid-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is touching a hot pan conduction, convection, or radiation?'
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
  assert.doesNotMatch(invalid.body.response, CONDUCTION_FINAL);
  assert.doesNotMatch(invalid.body.response, CONVECTION_FINAL);
  assert.doesNotMatch(invalid.body.response, RADIATION_FINAL);
}

async function assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId }) {
  for (const testCase of DIRECT_ANSWER_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should stay direct`);
    assert.notEqual(response.body.tutor?.id, 'energy.transfer.conduction-convection-radiation');
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertFormulaPromptsKeepFormulaTutor({ request, classSessionId }) {
  for (const prompt of FORMULA_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `formula-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'formula_tutor', `${prompt} should keep Formula Tutor priority`);
    assert.notEqual(response.body.tutor?.id, 'energy.transfer.conduction-convection-radiation');
  }
}

async function assertUnit5WaveConceptTutorsPreserved({ request, classSessionId }) {
  for (const testCase of WAVE_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `wave-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${testCase.prompt} should stay a Unit 5 Concept Tutor`);
    assert.equal(response.body.tutor.id, testCase.expectedTutorId);
  }
}

async function assertUnit5DirectWaveAnswersPreserved({ request, classSessionId }) {
  for (const testCase of WAVE_DIRECT_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `wave-direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.tutor?.id, 'energy.transfer.conduction-convection-radiation');
    assert.match(response.body.response, testCase.includes);
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
