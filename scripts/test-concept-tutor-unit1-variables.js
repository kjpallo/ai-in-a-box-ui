const assert = require('node:assert/strict');

const {
  buildUnit1VariablesConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const TUTOR_ID = 'unit1.scientific_method.variables.identification';

const VARIABLE_SCENARIO_CASES = [
  {
    prompt: 'In an experiment testing how sunlight affects plant growth, what is the independent variable?',
    choice: '1',
    correctLabel: /Amount of sunlight/i,
    finalAnswer: /The independent variable is the amount of sunlight because it is what the scientist changes on purpose\./i
  },
  {
    prompt: 'In an experiment testing how sunlight affects plant growth, what is the dependent variable?',
    choice: '2',
    correctLabel: /Plant growth/i,
    finalAnswer: /The dependent variable is plant growth because it is what the scientist measures as the result\./i
  },
  {
    prompt: 'In an experiment testing which fertilizer makes plants grow taller, what is the independent variable?',
    choice: '1',
    correctLabel: /Type of fertilizer/i,
    finalAnswer: /The independent variable is the type of fertilizer because it is what the scientist changes on purpose\./i
  },
  {
    prompt: 'In an experiment testing which fertilizer makes plants grow taller, what is the dependent variable?',
    choice: '2',
    correctLabel: /Plant height or growth/i,
    finalAnswer: /The dependent variable is plant height or growth because it is what the scientist measures as the result\./i
  },
  {
    prompt: 'In an experiment testing how temperature affects dissolving, what is the independent variable?',
    choice: '1',
    correctLabel: /Temperature/i,
    finalAnswer: /The independent variable is temperature because it is what the scientist changes on purpose\./i
  },
  {
    prompt: 'In an experiment testing how temperature affects dissolving, what is the dependent variable?',
    choice: '2',
    correctLabel: /How fast or how much dissolves/i,
    finalAnswer: /The dependent variable is how fast or how much dissolves because it is what the scientist measures as the result\./i
  }
];

const DIRECT_ANSWER_BOUNDARIES = [
  {
    prompt: 'What is an independent variable?',
    includes: /independent variable|changes on purpose/i
  },
  {
    prompt: 'What is a dependent variable?',
    includes: /dependent variable|measures|result/i
  },
  {
    prompt: 'What is a constant?',
    includes: /constant|kept the same/i
  },
  {
    prompt: 'What is a control group?',
    includes: /control group|comparison|normal/i
  },
  {
    prompt: 'What is an experimental group?',
    includes: /experimental group|tested change|independent variable/i
  },
  {
    prompt: 'What is qualitative data?',
    includes: /qualitative data|descriptive/i
  },
  {
    prompt: 'What is the scientific method?',
    includes: /scientific method|ask questions|test ideas|collect data|draw conclusions/i
  }
];

const FORMULA_BOUNDARIES = [
  'Convert 48 km to meters.',
  'Write 354,000,000 in scientific notation.',
  'Calculate density if mass is 10 g and volume is 5 mL.',
  'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.'
];

const EXISTING_CONCEPT_TUTOR_BOUNDARIES = [
  {
    prompt: 'Is melting ice endothermic or exothermic?',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification'
  },
  {
    prompt: 'Is a circuit with one path series or parallel?',
    expectedTutorId: 'electricity.circuits.series-parallel.identification'
  },
  {
    prompt: 'Is a car speeding up acceleration?',
    expectedTutorId: 'motion-force.acceleration.identification'
  },
  {
    prompt: 'Is salt water homogeneous or heterogeneous?',
    expectedTutorId: 'matter.mixtures.homogeneous-heterogeneous'
  }
];

async function main() {
  assert.ok(
    buildUnit1VariablesConceptTutorPattern('In an experiment testing how sunlight affects plant growth, what is the independent variable?'),
    'supported source-aligned variable scenarios should build the Unit 1 variables Concept Tutor pattern'
  );
  assert.equal(
    buildUnit1VariablesConceptTutorPattern('What is an independent variable?'),
    null,
    'definition prompts should not build the Unit 1 variables Concept Tutor pattern'
  );
  assert.equal(
    buildUnit1VariablesConceptTutorPattern('Convert 48 km to meters.'),
    null,
    'formula prompts should not build the Unit 1 variables Concept Tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertVariableScenariosStartRetryAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertDefinitionsStayDirect({ request, classSessionId });
  await assertFormulaBoundariesStayFormula({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor Unit 1 variables: scenario prompts start narrowly, retry with numbered choices, and preserve direct/formula/existing concept routes');
}

async function assertVariableScenariosStartRetryAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of VARIABLE_SCENARIO_CASES) {
    const studentHubId = `unit1-variables-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, TUTOR_ID);
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /Topic: identifying variables/i);
    assert.match(start.body.response, /Choose one:/i);
    assert.match(start.body.response, /type only the number/i);
    assert.match(start.body.response, testCase.correctLabel);
    assert.doesNotMatch(start.body.response, testCase.finalAnswer);

    assertChoicesAreEvidenceBased(start.body.tutor.currentStep.choices);

    const wrongChoice = testCase.choice === '1' ? '2' : '1';
    const wrong = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: wrongChoice
    });
    assert.equal(wrong.statusCode, 200);
    assert.equal(wrong.body.routeType, 'concept_tutor');
    assert.equal(wrong.body.tutor.id, TUTOR_ID);
    assert.equal(wrong.body.tutor.active, true);
    assert.equal(wrong.body.tutor.currentStepIndex, 0);
    assert.match(wrong.body.response, /Not quite|not the best fit/i);
    assert.match(wrong.body.response, testCase.correctLabel);
    assert.match(wrong.body.response, /1\.\s+/);
    assert.match(wrong.body.response, /2\.\s+/);
    assert.match(wrong.body.response, /3\.\s+/);
    assert.match(wrong.body.response, /Try again/i);
    assert.doesNotMatch(wrong.body.response, testCase.finalAnswer);

    const complete = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.choice
    });
    assert.equal(complete.statusCode, 200);
    assert.equal(complete.body.routeType, 'concept_tutor');
    assert.equal(complete.body.tutor.id, TUTOR_ID);
    assert.equal(complete.body.tutor.completed, true);
    assert.equal(complete.body.tutor.active, false);
    assert.match(complete.body.response, testCase.finalAnswer);
    assert.match(complete.body.tutor.finalAnswer, testCase.finalAnswer);
    assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
  }
}

function assertChoicesAreEvidenceBased(choices) {
  assert.ok(Array.isArray(choices));
  assert.ok(choices.length >= 3);
  const labels = choices.map((choice) => String(choice.label || '')).join(' ');
  assert.doesNotMatch(
    labels,
    /\b1\.\s*Independent variable\b|\b2\.\s*Dependent variable\b|\b3\.\s*Constant\b/i,
    'choices should be experiment parts, not just variable labels'
  );
  assert.doesNotMatch(
    labels,
    /^Independent variable\s+Dependent variable\s+Constant$/i,
    'choices should be experiment parts, not only label words'
  );
}

async function assertDefinitionsStayDirect({ request, classSessionId }) {
  for (const testCase of DIRECT_ANSWER_BOUNDARIES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should stay Direct Answer`);
    assert.notEqual(response.body.routeType, 'formula_tutor', `${testCase.prompt} should not start Formula Tutor`);
    assert.notEqual(response.body.tutor?.id, TUTOR_ID);
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertFormulaBoundariesStayFormula({ request, classSessionId }) {
  for (const prompt of FORMULA_BOUNDARIES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `formula-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body.routeType, /formula/i, `${prompt} should keep Formula Tutor or formula route`);
    assert.notEqual(response.body.tutor?.id, TUTOR_ID);
  }
}

async function assertExistingConceptTutorsStillStart({ request, classSessionId }) {
  for (const testCase of EXISTING_CONCEPT_TUTOR_BOUNDARIES) {
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
    .slice(0, 56);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
