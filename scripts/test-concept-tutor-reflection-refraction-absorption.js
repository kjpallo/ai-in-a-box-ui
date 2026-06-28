const assert = require('node:assert/strict');

const {
  buildReflectionRefractionAbsorptionConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const REFLECTION_FINAL = /This describes reflection because the wave or light bounces off a surface\./i;
const REFRACTION_FINAL = /This describes refraction because the wave or light bends when it enters a new material\./i;
const ABSORPTION_FINAL = /This describes absorption because the material takes in the wave or light energy\./i;

const SUPPORTED_WAVE_BEHAVIOR_CASES = [
  {
    prompt: 'Is light bouncing off a mirror reflection, refraction, or absorption?',
    choice: '1',
    finalAnswer: REFLECTION_FINAL
  },
  {
    prompt: 'Is an echo reflection, refraction, or absorption?',
    choice: '1',
    finalAnswer: REFLECTION_FINAL
  },
  {
    prompt: 'Is a straw looking bent in water reflection, refraction, or absorption?',
    choice: '2',
    finalAnswer: REFRACTION_FINAL
  },
  {
    prompt: 'Is light bending through glass reflection, refraction, or absorption?',
    choice: '2',
    finalAnswer: REFRACTION_FINAL
  },
  {
    prompt: 'Is a black shirt getting warm in sunlight reflection, refraction, or absorption?',
    choice: '3',
    finalAnswer: ABSORPTION_FINAL
  },
  {
    prompt: 'Is dark material taking in light reflection, refraction, or absorption?',
    choice: '3',
    finalAnswer: ABSORPTION_FINAL
  },
  {
    prompt: 'Which is reflection: mirror, bent straw in water, or black shirt warming?',
    choice: '1',
    finalAnswer: REFLECTION_FINAL
  },
  {
    prompt: 'Which is refraction: mirror, bent straw in water, or black shirt warming?',
    choice: '2',
    finalAnswer: REFRACTION_FINAL
  },
  {
    prompt: 'Which is absorption: mirror, bent straw in water, or black shirt warming?',
    choice: '3',
    finalAnswer: ABSORPTION_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is reflection?',
    includes: /reflection|bounces?|off/i
  },
  {
    prompt: 'Define reflection.',
    includes: /reflection|bounces?|off/i
  },
  {
    prompt: 'What is refraction?',
    includes: /refraction|changes speed|bends?/i
  },
  {
    prompt: 'Define refraction.',
    includes: /refraction|changes speed|bends?/i
  },
  {
    prompt: 'What is absorption?',
    includes: /absorption|energy|material|thermal/i
  },
  {
    prompt: 'Define absorption.',
    includes: /absorption|energy|material|thermal/i
  },
  {
    prompt: 'Explain the difference between reflection, refraction, and absorption.',
    includes: /reflection|refraction|absorption|bounce|bend|energy/i
  },
  {
    prompt: 'What is a wave?',
    includes: /disturbance|transfers energy|matter|space/i
  },
  {
    prompt: 'What is light?',
    includes: /electromagnetic|visible|energy|wave/i
  }
];

const WAVE_CONCEPT_TUTOR_CASES_TO_PRESERVE = [
  {
    prompt: 'Is light mechanical or electromagnetic?',
    expectedTutorId: 'waves.mechanical-electromagnetic.identification'
  },
  {
    prompt: 'Is a sound wave transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  },
  {
    prompt: 'Is a wave on a rope transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  }
];

const ENERGY_TRANSFER_CASES_TO_PRESERVE = [
  {
    prompt: 'Is heat from the Sun conduction, convection, or radiation?',
    expectedTutorId: 'energy.transfer.conduction-convection-radiation'
  },
  {
    prompt: 'Is heat from a lamp conduction, convection, or radiation?',
    expectedTutorId: 'energy.transfer.conduction-convection-radiation'
  }
];

const FORMULA_CASES_TO_PRESERVE = [
  'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.',
  'Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.',
  'Calculate density if mass is 10 g and volume is 5 mL.'
];

async function main() {
  assert.ok(
    buildReflectionRefractionAbsorptionConceptTutorPattern('Is light bouncing off a mirror reflection, refraction, or absorption?'),
    'supported reflection/refraction/absorption prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildReflectionRefractionAbsorptionConceptTutorPattern('What is reflection?'),
    null,
    'definition prompts should not build the reflection/refraction/absorption concept tutor pattern'
  );
  assert.equal(
    buildReflectionRefractionAbsorptionConceptTutorPattern('Explain the difference between reflection, refraction, and absorption.'),
    null,
    'broad difference prompts should not build the reflection/refraction/absorption concept tutor pattern'
  );
  assert.equal(
    buildReflectionRefractionAbsorptionConceptTutorPattern('Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.'),
    null,
    'formula prompts should not build the reflection/refraction/absorption concept tutor pattern'
  );
  assert.equal(
    buildReflectionRefractionAbsorptionConceptTutorPattern('Is light mechanical or electromagnetic?'),
    null,
    'Unit 5 wave classification prompts should not build this concept tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedWaveBehaviorPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertWrongChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertExistingWaveConceptTutorsStillStart({ request, classSessionId });
  await assertEnergyTransferConceptTutorStillStarts({ request, classSessionId });
  await assertFormulaPromptsKeepFormulaTutor({ request, classSessionId });

  console.log('PASS concept tutor reflection/refraction/absorption: wave behavior starts narrowly and preserves direct/formula/wave/energy routes');
}

async function assertSupportedWaveBehaviorPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_WAVE_BEHAVIOR_CASES) {
    const studentHubId = `waves-rra-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'waves.reflection-refraction-absorption.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /What happens to the wave or light\?/i);
    assert.match(start.body.response, /1\. It bounces off a surface\./i);
    assert.match(start.body.response, /2\. It bends as it enters a new material\./i);
    assert.match(start.body.response, /3\. It is taken in by the material\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, REFLECTION_FINAL, 'start response should hide reflection final answer');
    assert.doesNotMatch(start.body.response, REFRACTION_FINAL, 'start response should hide refraction final answer');
    assert.doesNotMatch(start.body.response, ABSORPTION_FINAL, 'start response should hide absorption final answer');

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

async function assertWrongChoiceRetries({ request, classSessionId }) {
  const studentHubId = 'waves-rra-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is light bouncing off a mirror reflection, refraction, or absorption?'
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
  assert.match(wrong.body.response, /Not quite|not the best fit/i);
  assert.doesNotMatch(wrong.body.response, REFLECTION_FINAL);
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
    assert.notEqual(response.body.tutor?.id, 'waves.reflection-refraction-absorption.identification');
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertExistingWaveConceptTutorsStillStart({ request, classSessionId }) {
  for (const testCase of WAVE_CONCEPT_TUTOR_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `wave-existing-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${testCase.prompt} should still start Concept Tutor`);
    assert.equal(response.body.tutor.id, testCase.expectedTutorId);
  }
}

async function assertEnergyTransferConceptTutorStillStarts({ request, classSessionId }) {
  for (const testCase of ENERGY_TRANSFER_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `energy-existing-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${testCase.prompt} should still start Concept Tutor`);
    assert.equal(response.body.tutor.id, testCase.expectedTutorId);
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
    assert.notEqual(response.body.tutor?.id, 'waves.reflection-refraction-absorption.identification');
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
