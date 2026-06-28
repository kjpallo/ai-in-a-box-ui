const assert = require('node:assert/strict');

const {
  buildWavePropertiesConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const AMPLITUDE_FINAL = /This describes amplitude because amplitude is the height of a wave\./i;
const WAVELENGTH_FINAL = /This describes wavelength because wavelength is the distance from one crest to the next crest, or one trough to the next trough\./i;
const FREQUENCY_FINAL = /This describes frequency because frequency is the number of waves that pass a point each second\./i;

const SUPPORTED_WAVE_PROPERTY_CASES = [
  {
    prompt: 'Is the height of a wave amplitude, wavelength, or frequency?',
    choice: '1',
    finalAnswer: AMPLITUDE_FINAL
  },
  {
    prompt: 'Is the distance from crest to crest amplitude, wavelength, or frequency?',
    choice: '2',
    finalAnswer: WAVELENGTH_FINAL
  },
  {
    prompt: 'Is the distance from trough to trough amplitude, wavelength, or frequency?',
    choice: '2',
    finalAnswer: WAVELENGTH_FINAL
  },
  {
    prompt: 'Is the number of waves per second amplitude, wavelength, or frequency?',
    choice: '3',
    finalAnswer: FREQUENCY_FINAL
  },
  {
    prompt: 'Is cycles per second amplitude, wavelength, or frequency?',
    choice: '3',
    finalAnswer: FREQUENCY_FINAL
  },
  {
    prompt: 'Which is amplitude: wave height, crest-to-crest distance, or waves per second?',
    choice: '1',
    finalAnswer: AMPLITUDE_FINAL
  },
  {
    prompt: 'Which is wavelength: wave height, crest-to-crest distance, or waves per second?',
    choice: '2',
    finalAnswer: WAVELENGTH_FINAL
  },
  {
    prompt: 'Which is frequency: wave height, crest-to-crest distance, or waves per second?',
    choice: '3',
    finalAnswer: FREQUENCY_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is amplitude?',
    includes: /amplitude|height|wave|energy/i
  },
  {
    prompt: 'Define amplitude.',
    includes: /amplitude|height|wave|energy/i
  },
  {
    prompt: 'What is wavelength?',
    includes: /wavelength|crest|trough|distance/i
  },
  {
    prompt: 'Define wavelength.',
    includes: /wavelength|crest|trough|distance/i
  },
  {
    prompt: 'What is frequency?',
    includes: /frequency|waves|second|hertz|Hz/i
  },
  {
    prompt: 'Define frequency.',
    includes: /frequency|waves|second|hertz|Hz/i
  },
  {
    prompt: 'Explain the difference between amplitude, wavelength, and frequency.',
    includes: /amplitude|height|wavelength|crest|frequency|second/i
  }
];

const EXISTING_WAVE_CONCEPT_TUTOR_CASES = [
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
  },
  {
    prompt: 'Is light bouncing off a mirror reflection, refraction, or absorption?',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification'
  },
  {
    prompt: 'Is a straw looking bent in water reflection, refraction, or absorption?',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification'
  }
];

const FORMULA_CASES_TO_PRESERVE = [
  'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.',
  'Find frequency if wave speed is 10 m/s and wavelength is 2 m.',
  'Find wavelength if wave speed is 20 m/s and frequency is 5 Hz.'
];

async function main() {
  assert.ok(
    buildWavePropertiesConceptTutorPattern('Is the height of a wave amplitude, wavelength, or frequency?'),
    'supported wave-property prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildWavePropertiesConceptTutorPattern('What is amplitude?'),
    null,
    'definition prompts should not build the wave-properties concept tutor pattern'
  );
  assert.equal(
    buildWavePropertiesConceptTutorPattern('Explain the difference between amplitude, wavelength, and frequency.'),
    null,
    'broad difference prompts should not build the wave-properties concept tutor pattern'
  );
  assert.equal(
    buildWavePropertiesConceptTutorPattern('Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.'),
    null,
    'formula prompts should not build the wave-properties concept tutor pattern'
  );
  assert.equal(
    buildWavePropertiesConceptTutorPattern('Is light mechanical or electromagnetic?'),
    null,
    'other Unit 5 wave Concept Tutor prompts should not build this concept tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedWavePropertyPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertWrongChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertExistingWaveConceptTutorsStillStart({ request, classSessionId });
  await assertFormulaPromptsKeepFormulaTutor({ request, classSessionId });

  console.log('PASS concept tutor wave properties: amplitude/wavelength/frequency starts narrowly and preserves direct/formula/existing wave routes');
}

async function assertSupportedWavePropertyPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_WAVE_PROPERTY_CASES) {
    const studentHubId = `wave-properties-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'waves.properties.amplitude-wavelength-frequency');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /Which wave property is being described\?/i);
    assert.match(start.body.response, /1\. Amplitude: height of the wave\./i);
    assert.match(start.body.response, /2\. Wavelength: distance from crest to crest or trough to trough\./i);
    assert.match(start.body.response, /3\. Frequency: number of waves passing per second\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, AMPLITUDE_FINAL, 'start response should hide amplitude final answer');
    assert.doesNotMatch(start.body.response, WAVELENGTH_FINAL, 'start response should hide wavelength final answer');
    assert.doesNotMatch(start.body.response, FREQUENCY_FINAL, 'start response should hide frequency final answer');

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
  const studentHubId = 'wave-properties-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is the height of a wave amplitude, wavelength, or frequency?'
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
  assert.doesNotMatch(wrong.body.response, AMPLITUDE_FINAL);
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
    assert.notEqual(response.body.tutor?.id, 'waves.properties.amplitude-wavelength-frequency');
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertExistingWaveConceptTutorsStillStart({ request, classSessionId }) {
  for (const testCase of EXISTING_WAVE_CONCEPT_TUTOR_CASES) {
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

async function assertFormulaPromptsKeepFormulaTutor({ request, classSessionId }) {
  for (const prompt of FORMULA_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `formula-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'formula_tutor', `${prompt} should keep Formula Tutor priority`);
    assert.notEqual(response.body.tutor?.id, 'waves.properties.amplitude-wavelength-frequency');
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
