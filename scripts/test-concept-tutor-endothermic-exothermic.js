const assert = require('node:assert/strict');

const {
  buildEndothermicExothermicConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const ENDOTHERMIC_FINAL = /This describes an endothermic process because energy is absorbed from the surroundings\./i;
const EXOTHERMIC_FINAL = /This describes an exothermic process because energy is released to the surroundings\./i;

const SUPPORTED_ENDO_EXO_CASES = [
  {
    prompt: 'Is melting ice endothermic or exothermic?',
    choice: '1',
    finalAnswer: ENDOTHERMIC_FINAL
  },
  {
    prompt: 'Is evaporation endothermic or exothermic?',
    choice: '1',
    finalAnswer: ENDOTHERMIC_FINAL
  },
  {
    prompt: 'Is an instant cold pack endothermic or exothermic?',
    choice: '1',
    finalAnswer: ENDOTHERMIC_FINAL
  },
  {
    prompt: 'Is fire burning endothermic or exothermic?',
    choice: '2',
    finalAnswer: EXOTHERMIC_FINAL
  },
  {
    prompt: 'Is a hand warmer endothermic or exothermic?',
    choice: '2',
    finalAnswer: EXOTHERMIC_FINAL
  },
  {
    prompt: 'Is freezing water endothermic or exothermic?',
    choice: '2',
    finalAnswer: EXOTHERMIC_FINAL
  },
  {
    prompt: 'Which is endothermic: melting ice or fire burning?',
    choice: '1',
    finalAnswer: ENDOTHERMIC_FINAL
  },
  {
    prompt: 'Which is exothermic: melting ice or fire burning?',
    choice: '2',
    finalAnswer: EXOTHERMIC_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is endothermic?',
    includes: /endothermic|absorbed|surroundings/i
  },
  {
    prompt: 'Define endothermic.',
    includes: /endothermic|absorbed|surroundings/i
  },
  {
    prompt: 'What is exothermic?',
    includes: /exothermic|released|surroundings/i
  },
  {
    prompt: 'Define exothermic.',
    includes: /exothermic|released|surroundings/i
  },
  {
    prompt: 'Explain the difference between endothermic and exothermic.',
    includes: /endothermic|absorbs|exothermic|releases/i
  },
  {
    prompt: 'Give examples of endothermic and exothermic processes.',
    includes: /endothermic|melting|evaporation|cold pack|exothermic|burning|freezing|hand warmer/i
  }
];

const PHYSICAL_CHEMICAL_CASES_TO_PRESERVE = [
  'Is ice melting a physical or chemical change?',
  'Is water freezing a physical or chemical change?',
  'Is wood burning a physical or chemical change?',
  'Is baking a cake a physical or chemical change?'
];

const ENERGY_TRANSFER_CASES_TO_PRESERVE = [
  'Is heat from the Sun conduction, convection, or radiation?',
  'Is heat from a lamp conduction, convection, or radiation?',
  'Is boiling water heated by a stove conduction, convection, or radiation?'
];

const FORMULA_CASES_TO_PRESERVE = [
  'Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.',
  'Calculate thermal energy if mass is 2 kg, specific heat is 4 J/g°C, and temperature change is 5°C.',
  'Calculate power if work is 100 J and time is 5 s.',
  'Calculate work if force is 10 N and distance is 3 m.'
];

const EXISTING_CONCEPT_TUTOR_CASES = [
  {
    prompt: 'Is a circuit with a closed switch open or closed?',
    expectedTutorId: 'electricity.circuits.open-closed.identification'
  },
  {
    prompt: 'Is a circuit with one path series or parallel?',
    expectedTutorId: 'electricity.circuits.series-parallel.identification'
  },
  {
    prompt: 'Is the height of a wave amplitude, wavelength, or frequency?',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency'
  },
  {
    prompt: 'Is light bouncing off a mirror reflection, refraction, or absorption?',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification'
  },
  {
    prompt: 'Is vinegar acidic, basic, or neutral?',
    expectedTutorId: 'chemistry.acids-bases.identification'
  }
];

async function main() {
  assert.ok(
    buildEndothermicExothermicConceptTutorPattern('Is melting ice endothermic or exothermic?'),
    'supported endothermic/exothermic prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildEndothermicExothermicConceptTutorPattern('What is endothermic?'),
    null,
    'definition prompts should not build the endothermic/exothermic concept tutor pattern'
  );
  assert.equal(
    buildEndothermicExothermicConceptTutorPattern('Explain the difference between endothermic and exothermic.'),
    null,
    'broad difference prompts should not build the endothermic/exothermic concept tutor pattern'
  );
  assert.equal(
    buildEndothermicExothermicConceptTutorPattern('Is ice melting a physical or chemical change?'),
    null,
    'physical/chemical prompts should not build the endothermic/exothermic concept tutor pattern'
  );
  assert.equal(
    buildEndothermicExothermicConceptTutorPattern('Is heat from the Sun conduction, convection, or radiation?'),
    null,
    'energy transfer prompts should not build the endothermic/exothermic concept tutor pattern'
  );
  assert.equal(
    buildEndothermicExothermicConceptTutorPattern('Calculate power if work is 100 J and time is 5 s.'),
    null,
    'formula prompts should not build the endothermic/exothermic concept tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedEndothermicExothermicPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertWrongChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertPhysicalChemicalConceptTutorStillStarts({ request, classSessionId });
  await assertEnergyTransferConceptTutorStillStarts({ request, classSessionId });
  await assertFormulaPromptsKeepFormulaRoute({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor endothermic/exothermic: starts narrowly and preserves direct/physical-chemical/energy-transfer/formula/existing routes');
}

async function assertSupportedEndothermicExothermicPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_ENDO_EXO_CASES) {
    const studentHubId = `endo-exo-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'energy.processes.endothermic-exothermic.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /What happens to thermal energy\?/i);
    assert.match(start.body.response, /1\. Energy is absorbed from the surroundings\./i);
    assert.match(start.body.response, /2\. Energy is released to the surroundings\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, ENDOTHERMIC_FINAL, 'start response should hide endothermic final answer');
    assert.doesNotMatch(start.body.response, EXOTHERMIC_FINAL, 'start response should hide exothermic final answer');

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
  const studentHubId = 'endo-exo-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is melting ice endothermic or exothermic?'
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
  assert.doesNotMatch(wrong.body.response, ENDOTHERMIC_FINAL);
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
    assert.notEqual(response.body.tutor?.id, 'energy.processes.endothermic-exothermic.identification');
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertPhysicalChemicalConceptTutorStillStarts({ request, classSessionId }) {
  for (const prompt of PHYSICAL_CHEMICAL_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `physical-chemical-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${prompt} should still start physical/chemical Concept Tutor`);
    assert.equal(response.body.tutor.id, 'matter.physical-chemical-change.identification');
  }
}

async function assertEnergyTransferConceptTutorStillStarts({ request, classSessionId }) {
  for (const prompt of ENERGY_TRANSFER_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `energy-transfer-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${prompt} should still start energy-transfer Concept Tutor`);
    assert.equal(response.body.tutor.id, 'energy.transfer.conduction-convection-radiation');
  }
}

async function assertFormulaPromptsKeepFormulaRoute({ request, classSessionId }) {
  for (const prompt of FORMULA_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `formula-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body.routeType, /formula/i, `${prompt} should keep Formula Tutor or formula route`);
    assert.notEqual(response.body.tutor?.id, 'energy.processes.endothermic-exothermic.identification');
  }
}

async function assertExistingConceptTutorsStillStart({ request, classSessionId }) {
  for (const testCase of EXISTING_CONCEPT_TUTOR_CASES) {
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
