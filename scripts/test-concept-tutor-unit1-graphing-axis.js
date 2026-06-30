const assert = require('node:assert/strict');

const {
  buildUnit1GraphingAxisConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const TUTOR_ID = 'unit1.graphing.axes.identification';

const GRAPH_AXIS_CASES = [
  {
    prompt: 'In a graph of sunlight vs plant growth, what goes on the x-axis?',
    choice: '1',
    correctLabel: /Amount of sunlight/i,
    finalAnswer: /Amount of sunlight goes on the x-axis because it is the independent variable\./i
  },
  {
    prompt: 'In a graph of sunlight vs plant growth, what goes on the y-axis?',
    choice: '2',
    correctLabel: /Plant growth/i,
    finalAnswer: /Plant growth goes on the y-axis because it is the dependent variable\./i
  },
  {
    prompt: 'In a graph of fertilizer type vs plant height, what goes on the x-axis?',
    choice: '1',
    correctLabel: /Type of fertilizer/i,
    finalAnswer: /Type of fertilizer goes on the x-axis because it is the independent variable\./i
  },
  {
    prompt: 'In a graph of fertilizer type vs plant height, what goes on the y-axis?',
    choice: '2',
    correctLabel: /Plant height or growth/i,
    finalAnswer: /Plant height or growth goes on the y-axis because it is the dependent variable\./i
  },
  {
    prompt: 'In a graph of temperature vs dissolving rate, what goes on the x-axis?',
    choice: '1',
    correctLabel: /Temperature/i,
    finalAnswer: /Temperature goes on the x-axis because it is the independent variable\./i
  },
  {
    prompt: 'In a graph of temperature vs dissolving rate, what goes on the y-axis?',
    choice: '2',
    correctLabel: /Dissolving rate or how fast it dissolves/i,
    finalAnswer: /Dissolving rate, or how fast it dissolves, goes on the y-axis because it is the dependent variable\./i
  }
];

const GRAPH_DIRECT_ANSWER_BOUNDARIES = [
  {
    prompt: 'What is a graph?',
    includes: /graph|visual|data/i
  },
  {
    prompt: 'What is the x-axis?',
    includes: /x-axis|horizontal|independent variable/i
  },
  {
    prompt: 'What is the y-axis?',
    includes: /y-axis|vertical|dependent variable/i
  },
  {
    prompt: 'What goes on the x-axis?',
    includes: /independent variable|x-axis/i
  },
  {
    prompt: 'What goes on the y-axis?',
    includes: /dependent variable|y-axis/i
  },
  {
    prompt: 'What is a graph scale?',
    includes: /graph scale|numbers|axis/i
  },
  {
    prompt: 'What is a line graph used for?',
    includes: /line graph|change over time|continuous/i
  },
  {
    prompt: 'What is CER?',
    includes: /claim-evidence-reasoning|CER|claim|evidence|reasoning/i
  }
];

const UNIT1_VARIABLE_TUTOR_BOUNDARIES = [
  'In an experiment testing how sunlight affects plant growth, what is the independent variable?',
  'In an experiment testing how sunlight affects plant growth, what is the dependent variable?',
  'In an experiment testing which fertilizer makes plants grow taller, what is the independent variable?',
  'In an experiment testing how temperature affects dissolving, what is the dependent variable?'
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

const DIRECT_BOUNDARIES = [
  {
    prompt: 'What type of waves are used in night vision goggles and remote controls?',
    includes: /infrared|night vision|remote controls/i
  },
  {
    prompt: 'What is matter?',
    includes: /matter|mass|space|volume/i
  },
  {
    prompt: 'What is conservation of mass?',
    includes: /conservation of mass|mass/i
  }
];

async function main() {
  assert.ok(
    buildUnit1GraphingAxisConceptTutorPattern('In a graph of sunlight vs plant growth, what goes on the x-axis?'),
    'supported source-aligned graph-axis prompts should build the Unit 1 graphing-axis Concept Tutor pattern'
  );
  assert.equal(
    buildUnit1GraphingAxisConceptTutorPattern('What goes on the x-axis?'),
    null,
    'definition prompts should not build the Unit 1 graphing-axis Concept Tutor pattern'
  );
  assert.equal(
    buildUnit1GraphingAxisConceptTutorPattern('Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.'),
    null,
    'formula prompts should not build the Unit 1 graphing-axis Concept Tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertGraphAxisScenariosStartRetryAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertGraphDefinitionsStayDirect({ request, classSessionId });
  await assertUnit1VariablesTutorStillStarts({ request, classSessionId });
  await assertFormulaBoundariesStayFormula({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });
  await assertDirectBoundariesStayDirect({ request, classSessionId });

  console.log('PASS concept tutor Unit 1 graphing axis: graph-axis scenarios start narrowly, retry with numbered choices, and preserve direct/formula/existing routes');
}

async function assertGraphAxisScenariosStartRetryAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of GRAPH_AXIS_CASES) {
    const studentHubId = `unit1-graph-axis-${slug(testCase.prompt)}`;
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
    assert.match(start.body.response, /Topic: graph axis identification/i);
    assert.match(start.body.response, /Choose one:/i);
    assert.match(start.body.response, /type only the number/i);
    assert.match(start.body.response, testCase.correctLabel);
    assert.doesNotMatch(start.body.response, testCase.finalAnswer);

    assertChoicesAreScenarioParts(start.body.tutor.currentStep.choices);

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

function assertChoicesAreScenarioParts(choices) {
  assert.ok(Array.isArray(choices));
  assert.ok(choices.length >= 3);
  const labels = choices.map((choice) => String(choice.label || '')).join(' ');
  assert.doesNotMatch(
    labels,
    /^Independent variable\s+Dependent variable\s+Constant$/i,
    'choices should be graph/scenario parts, not only label words'
  );
  assert.doesNotMatch(
    labels,
    /\b1\.\s*Independent variable\b|\b2\.\s*Dependent variable\b|\b3\.\s*Constant\b/i,
    'choices should not be numbered variable labels'
  );
}

async function assertGraphDefinitionsStayDirect({ request, classSessionId }) {
  for (const testCase of GRAPH_DIRECT_ANSWER_BOUNDARIES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `graph-direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should stay Direct Answer`);
    assert.notEqual(response.body.routeType, 'formula_tutor', `${testCase.prompt} should not start Formula Tutor`);
    assert.notEqual(response.body.tutor?.id, TUTOR_ID);
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertUnit1VariablesTutorStillStarts({ request, classSessionId }) {
  for (const prompt of UNIT1_VARIABLE_TUTOR_BOUNDARIES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `unit1-variable-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${prompt} should still start Unit 1 variables Concept Tutor`);
    assert.equal(response.body.tutor.id, 'unit1.scientific_method.variables.identification');
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

async function assertDirectBoundariesStayDirect({ request, classSessionId }) {
  for (const testCase of DIRECT_BOUNDARIES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should stay direct`);
    assert.match(response.body.response, testCase.includes);
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
