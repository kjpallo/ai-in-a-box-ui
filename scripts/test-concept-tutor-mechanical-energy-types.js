const assert = require('node:assert/strict');

const {
  buildMechanicalEnergyTypesConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const KINETIC_FINAL = /This describes kinetic energy because kinetic energy is the energy of motion\./i;
const GPE_FINAL = /This describes gravitational potential energy because it is stored energy due to height or position\./i;
const ELASTIC_FINAL = /This describes elastic potential energy because it is stored energy in something stretched or compressed\./i;

const MECHANICAL_ENERGY_TYPE_CASES = [
  {
    prompt: 'Is a moving car kinetic, gravitational potential, or elastic potential energy?',
    choice: '1',
    finalAnswer: KINETIC_FINAL
  },
  {
    prompt: 'Is a rolling ball kinetic, gravitational potential, or elastic potential energy?',
    choice: '1',
    finalAnswer: KINETIC_FINAL
  },
  {
    prompt: 'Is a book on a shelf kinetic, gravitational potential, or elastic potential energy?',
    choice: '2',
    finalAnswer: GPE_FINAL
  },
  {
    prompt: 'Is a ball held above the ground kinetic, gravitational potential, or elastic potential energy?',
    choice: '2',
    finalAnswer: GPE_FINAL
  },
  {
    prompt: 'Is a stretched rubber band kinetic, gravitational potential, or elastic potential energy?',
    choice: '3',
    finalAnswer: ELASTIC_FINAL
  },
  {
    prompt: 'Is a compressed spring kinetic, gravitational potential, or elastic potential energy?',
    choice: '3',
    finalAnswer: ELASTIC_FINAL
  },
  {
    prompt: 'Which is kinetic: moving car, book on a shelf, or stretched rubber band?',
    choice: '1',
    finalAnswer: KINETIC_FINAL
  },
  {
    prompt: 'Which is gravitational potential: moving car, book on a shelf, or stretched rubber band?',
    choice: '2',
    finalAnswer: GPE_FINAL
  },
  {
    prompt: 'Which is elastic potential: moving car, book on a shelf, or stretched rubber band?',
    choice: '3',
    finalAnswer: ELASTIC_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is kinetic energy?',
    includes: /kinetic energy|energy of motion/i
  },
  {
    prompt: 'Define kinetic energy.',
    includes: /kinetic energy|energy of motion/i
  },
  {
    prompt: 'What is gravitational potential energy?',
    includes: /gravitational potential energy|height|position/i
  },
  {
    prompt: 'Define gravitational potential energy.',
    includes: /gravitational potential energy|height|position/i
  },
  {
    prompt: 'What is elastic potential energy?',
    includes: /elastic potential energy|stretched|compressed/i
  },
  {
    prompt: 'Define elastic potential energy.',
    includes: /elastic potential energy|stretched|compressed/i
  },
  {
    prompt: 'What is mechanical energy?',
    includes: /mechanical energy|motion|position|kinetic|potential/i
  },
  {
    prompt: 'Define mechanical energy.',
    includes: /mechanical energy|motion|position|kinetic|potential/i
  },
  {
    prompt: 'Explain the difference between kinetic energy and potential energy.',
    includes: /kinetic energy|motion|potential energy|stored/i
  },
  {
    prompt: 'Explain the difference between kinetic, gravitational potential, and elastic potential energy.',
    includes: /kinetic|gravitational potential|elastic potential/i
  },
  {
    prompt: 'Is kinetic energy mechanical energy?',
    includes: /yes|kinetic energy|form of mechanical energy|motion/i
  },
  {
    prompt: 'Is mechanical kinetic energy a real thing?',
    includes: /mechanical kinetic energy|kinetic energy|not a separate|form of mechanical energy/i
  }
];

const BROAD_ENERGY_TYPE_CASES_TO_PRESERVE = [
  'What are the different types of energy?',
  'List the types of energy.',
  'Explain chemical, thermal, electrical, radiant, sound, and mechanical energy.',
  'Is a battery chemical, electrical, thermal, radiant, sound, kinetic, or potential energy?',
  'Is a light bulb electrical, radiant, or thermal energy?'
];

const FORMULA_CASES_TO_PRESERVE = [
  {
    prompt: 'Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.',
    expectsFormulaRoute: true
  },
  {
    prompt: 'Find kinetic energy for a 4 kg object moving 5 m/s.',
    expectsFormulaRoute: true
  },
  {
    prompt: 'Calculate gravitational potential energy if mass is 2 kg, gravity is 9.8 m/s^2, and height is 3 m.',
    expectsFormulaRoute: true
  },
  {
    prompt: 'Find potential energy if mass is 5 kg and height is 10 m.',
    expectsFormulaRoute: true
  },
  {
    prompt: 'Calculate elastic potential energy if spring constant is 20 N/m and stretch is 0.5 m.',
    expectsFormulaRoute: false
  },
  {
    prompt: 'Calculate work if force is 10 N and distance is 3 m.',
    expectsFormulaRoute: true
  },
  {
    prompt: 'Calculate power if work is 100 J and time is 5 s.',
    expectsFormulaRoute: true
  }
];

const EXISTING_CONCEPT_TUTOR_CASES = [
  {
    prompt: 'Is melting ice endothermic or exothermic?',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification'
  },
  {
    prompt: 'Is heat from the Sun conduction, convection, or radiation?',
    expectedTutorId: 'energy.transfer.conduction-convection-radiation'
  },
  {
    prompt: 'Is ice melting a physical or chemical change?',
    expectedTutorId: 'matter.physical-chemical-change.identification'
  },
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
    buildMechanicalEnergyTypesConceptTutorPattern('Is a moving car kinetic, gravitational potential, or elastic potential energy?'),
    'supported mechanical-energy type prompts should build the Concept Tutor pattern'
  );
  assert.equal(
    buildMechanicalEnergyTypesConceptTutorPattern('What is kinetic energy?'),
    null,
    'definition prompts should not build the mechanical-energy type Concept Tutor pattern'
  );
  assert.equal(
    buildMechanicalEnergyTypesConceptTutorPattern('Explain the difference between kinetic, gravitational potential, and elastic potential energy.'),
    null,
    'broad difference prompts should not build the mechanical-energy type Concept Tutor pattern'
  );
  assert.equal(
    buildMechanicalEnergyTypesConceptTutorPattern('What are the different types of energy?'),
    null,
    'broad energy-type prompts should not build the mechanical-energy type Concept Tutor pattern'
  );
  assert.equal(
    buildMechanicalEnergyTypesConceptTutorPattern('Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.'),
    null,
    'formula prompts should not build the mechanical-energy type Concept Tutor pattern'
  );
  assert.equal(
    buildMechanicalEnergyTypesConceptTutorPattern('Is melting ice endothermic or exothermic?'),
    null,
    'endothermic/exothermic prompts should not build the mechanical-energy type Concept Tutor pattern'
  );
  assert.equal(
    buildMechanicalEnergyTypesConceptTutorPattern('Is heat from the Sun conduction, convection, or radiation?'),
    null,
    'energy-transfer prompts should not build the mechanical-energy type Concept Tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedMechanicalEnergyPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertWrongChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertBroadEnergyTypePromptsBypassConceptTutor({ request, classSessionId });
  await assertFormulaPromptsKeepFormulaRouteOrBypassConceptTutor({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor mechanical energy types: kinetic/GPE/elastic starts narrowly and preserves direct/broad/formula/existing concept routes');
}

async function assertSupportedMechanicalEnergyPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of MECHANICAL_ENERGY_TYPE_CASES) {
    const studentHubId = `mechanical-energy-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'energy.mechanical-types.kinetic-gpe-elastic.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /What kind of mechanical energy is being described\?/i);
    assert.match(start.body.response, /1\. Kinetic energy: energy of motion\./i);
    assert.match(start.body.response, /2\. Gravitational potential energy: stored energy because of height or position\./i);
    assert.match(start.body.response, /3\. Elastic potential energy: stored energy in something stretched or compressed\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, KINETIC_FINAL);
    assert.doesNotMatch(start.body.response, GPE_FINAL);
    assert.doesNotMatch(start.body.response, ELASTIC_FINAL);

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
  const studentHubId = 'mechanical-energy-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is a moving car kinetic, gravitational potential, or elastic potential energy?'
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
  assert.doesNotMatch(wrong.body.response, KINETIC_FINAL);
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
    assert.notEqual(response.body.tutor?.id, 'energy.mechanical-types.kinetic-gpe-elastic.identification');
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertBroadEnergyTypePromptsBypassConceptTutor({ request, classSessionId }) {
  for (const prompt of BROAD_ENERGY_TYPE_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `broad-energy-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${prompt} should stay direct or non-concept route`);
    assert.notEqual(response.body.tutor?.id, 'energy.mechanical-types.kinetic-gpe-elastic.identification');
  }
}

async function assertFormulaPromptsKeepFormulaRouteOrBypassConceptTutor({ request, classSessionId }) {
  for (const testCase of FORMULA_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `formula-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.tutor?.id, 'energy.mechanical-types.kinetic-gpe-elastic.identification');
    if (testCase.expectsFormulaRoute) {
      assert.match(response.body.routeType, /formula/i, `${testCase.prompt} should keep Formula Tutor or formula route`);
    } else {
      assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should not become the mechanical-energy Concept Tutor`);
    }
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
