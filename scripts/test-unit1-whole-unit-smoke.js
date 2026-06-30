const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const UNIT1_VARIABLES_TUTOR_ID = 'unit1.scientific_method.variables.identification';
const UNIT1_GRAPH_AXIS_TUTOR_ID = 'unit1.graphing.axes.identification';

const DIRECT_CASES = [
  {
    category: 'safety-equipment',
    name: 'goggles-purpose',
    prompt: 'What are goggles used for?',
    includes: [/goggles/i, /protect/i, /eyes/i]
  },
  {
    category: 'safety-equipment',
    name: 'pass',
    prompt: 'What does PASS stand for?',
    includes: [/Pull/i, /Aim/i, /Squeeze/i, /Sweep/i]
  },
  {
    category: 'safety-equipment',
    name: 'graduated-cylinder-use',
    prompt: 'What is a graduated cylinder used for?',
    includes: [/graduated cylinder/i, /measure/i, /liquid volume|volume/i]
  },
  {
    category: 'safety-equipment',
    name: 'beaker-use',
    prompt: 'What is a beaker used for?',
    includes: [/beaker/i, /holding/i, /mixing/i]
  },
  {
    category: 'safety-equipment',
    name: 'waft-how',
    prompt: 'How do you waft?',
    includes: [/waft/i, /fumes|vapors?/i, /nose/i]
  },
  {
    category: 'measurement',
    name: 'accuracy',
    prompt: 'What is accuracy?',
    includes: [/accuracy/i, /accepted|true|correct/i]
  },
  {
    category: 'measurement',
    name: 'precision',
    prompt: 'What is precision?',
    includes: [/precision/i, /repeated|consistent/i]
  },
  {
    category: 'measurement',
    name: 'si-system',
    prompt: 'What is the SI system?',
    includes: [/SI system/i, /measurement system/i]
  },
  {
    category: 'measurement',
    name: 'meniscus',
    prompt: 'What is the meniscus?',
    includes: [/meniscus/i, /curve/i, /liquid/i]
  },
  {
    category: 'measurement',
    name: 'number-and-unit',
    prompt: 'Why do measurements need a number and a unit?',
    includes: [/number/i, /unit/i, /quantity|measured|understandable/i]
  },
  {
    category: 'scientific-method',
    name: 'scientific-method',
    prompt: 'What is the scientific method?',
    includes: [/scientific method/i, /ask questions/i, /test ideas/i, /collect data/i, /draw conclusions/i]
  },
  {
    category: 'scientific-method',
    name: 'hypothesis',
    prompt: 'What is a hypothesis?',
    includes: [/hypothesis/i, /testable prediction|possible answer/i]
  },
  {
    category: 'scientific-method',
    name: 'independent-variable',
    prompt: 'What is an independent variable?',
    includes: [/independent variable/i, /changes on purpose/i]
  },
  {
    category: 'scientific-method',
    name: 'dependent-variable',
    prompt: 'What is a dependent variable?',
    includes: [/dependent variable/i, /measures|observes/i, /result/i]
  },
  {
    category: 'scientific-method',
    name: 'qualitative-data',
    prompt: 'What is qualitative data?',
    includes: [/qualitative data/i, /descriptive/i]
  },
  {
    category: 'scientific-method',
    name: 'quantitative-data',
    prompt: 'What is quantitative data?',
    includes: [/quantitative data/i, /numerical|numbers/i]
  },
  {
    category: 'scientific-method',
    name: 'law-vs-theory',
    prompt: 'What is the difference between a law and a theory?',
    includes: [/law/i, /describes what happens/i, /theory/i, /explains why/i]
  },
  {
    category: 'graphing-data',
    name: 'graph',
    prompt: 'What is a graph?',
    includes: [/graph/i, /visual/i, /data/i]
  },
  {
    category: 'graphing-data',
    name: 'x-axis-placement',
    prompt: 'What goes on the x-axis?',
    includes: [/independent variable/i, /x-axis|x axis/i]
  },
  {
    category: 'graphing-data',
    name: 'y-axis-placement',
    prompt: 'What goes on the y-axis?',
    includes: [/dependent variable/i, /y-axis|y axis/i]
  },
  {
    category: 'graphing-data',
    name: 'line-graph',
    prompt: 'What is a line graph used for?',
    includes: [/line graph/i, /change over time|continuous/i]
  },
  {
    category: 'graphing-data',
    name: 'trend',
    prompt: 'What is a trend?',
    includes: [/trend/i, /general pattern|direction/i, /data/i]
  },
  {
    category: 'graphing-data',
    name: 'cer',
    prompt: 'What is CER?',
    includes: [/claim-evidence-reasoning|CER/i, /claim/i, /evidence/i, /reasoning/i]
  }
];

const FORMULA_CASES = [
  {
    name: 'metric-stair-step',
    prompt: 'Convert 48 km to meters.',
    formulaId: 'unit1_metric_stair_step_conversion',
    visualType: 'metric_stair_step',
    includes: [/48,?000 m/i]
  },
  {
    name: 'picket-fence',
    prompt: 'Convert 250.4 cm to feet.',
    formulaId: 'unit1_picket_fence_conversion',
    visualType: 'picket_fence',
    includes: [/8\.22 ft/i]
  },
  {
    name: 'scientific-notation',
    prompt: 'Write 354,000,000 in scientific notation.',
    formulaId: 'unit1_scientific_notation',
    visualType: 'scientific_notation_decimal_move',
    includes: [/3\.54\s*×?\s*10\^8/i]
  },
  {
    name: 'temperature-conversion',
    prompt: 'Convert 23 C to F.',
    formulaId: 'unit1_temperature_conversion',
    visualType: 'temperature_conversion',
    includes: [/73\.4\s*°?F/i]
  }
];

const VARIABLE_TUTOR_CASES = [
  {
    prompt: 'In an experiment testing how sunlight affects plant growth, what is the independent variable?',
    choice: '1',
    includes: [/independent variable/i, /amount of sunlight/i, /changes on purpose/i]
  },
  {
    prompt: 'In an experiment testing which fertilizer makes plants grow taller, what is the dependent variable?',
    choice: '2',
    includes: [/dependent variable/i, /plant height or growth/i, /measures as the result/i]
  },
  {
    prompt: 'In an experiment testing how temperature affects dissolving, what is the independent variable?',
    choice: '1',
    includes: [/independent variable/i, /temperature/i, /changes on purpose/i]
  }
];

const GRAPH_AXIS_TUTOR_CASES = [
  {
    prompt: 'In a graph of sunlight vs plant growth, what goes on the x-axis?',
    choice: '1',
    includes: [/Amount of sunlight/i, /x-axis/i, /independent variable/i]
  },
  {
    prompt: 'In a graph of fertilizer type vs plant height, what goes on the y-axis?',
    choice: '2',
    includes: [/Plant height or growth/i, /y-axis/i, /dependent variable/i]
  },
  {
    prompt: 'In a graph of temperature vs dissolving rate, what goes on the y-axis?',
    choice: '2',
    includes: [/Dissolving rate/i, /y-axis/i, /dependent variable/i]
  }
];

const CROSS_UNIT_FORMULA_CASES = [
  'Calculate density if mass is 10 g and volume is 5 mL.',
  'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.'
];

const CROSS_UNIT_CONCEPT_CASES = [
  {
    prompt: 'Is melting ice endothermic or exothermic?',
    tutorId: 'energy.processes.endothermic-exothermic.identification'
  },
  {
    prompt: 'Is a circuit with one path series or parallel?',
    tutorId: 'electricity.circuits.series-parallel.identification'
  },
  {
    prompt: 'Is a car speeding up acceleration?',
    tutorId: 'motion-force.acceleration.identification'
  },
  {
    prompt: 'Is salt water homogeneous or heterogeneous?',
    tutorId: 'matter.mixtures.homogeneous-heterogeneous'
  }
];

const CROSS_UNIT_DIRECT_CASES = [
  {
    name: 'conservation-of-mass',
    prompt: 'What is conservation of mass?',
    includes: [/conservation of mass|conservation of matter/i, /not created|not destroyed/i],
    excludes: [/x-axis|y-axis|graph title/i]
  },
  {
    name: 'infrared-waves',
    prompt: 'What type of waves are used in night vision goggles and remote controls?',
    includes: [/infrared/i],
    excludes: [/safety goggles/i, /protect your eyes/i]
  },
  {
    name: 'velocity-time-slope',
    prompt: "velocity vs. time graph, the slope of the line equals the object's what?",
    includes: [/velocity-time graph|velocity time graph/i, /slope means acceleration|slope equals acceleration|acceleration/i],
    excludes: [/x-axis|y-axis|independent variable|dependent variable/i]
  },
  {
    name: 'frequency-period-relationship',
    prompt: 'What is the relationship between frequency and period?',
    includes: [/inverse|reciprocal/i, /T\s*=\s*1\s*\/\s*f/i, /f\s*=\s*1\s*\/\s*T/i],
    excludes: [/positive relationship|negative relationship|direct relationship|inverse relationship means/i]
  }
];

async function main() {
  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of DIRECT_CASES) {
    const response = await ask(request, sessionId, `unit1-whole-direct-${testCase.category}-${slug(testCase.name)}`, testCase.prompt);
    assertDirectAnswer(response, testCase);
  }

  for (const testCase of FORMULA_CASES) {
    await assertFormulaTutor({ request, sessionId, testCase });
  }

  for (const testCase of VARIABLE_TUTOR_CASES) {
    await assertConceptTutorCompletes({
      request,
      studentSessions,
      sessionId,
      testCase,
      tutorId: UNIT1_VARIABLES_TUTOR_ID,
      hubPrefix: 'unit1-whole-variables'
    });
  }

  for (const testCase of GRAPH_AXIS_TUTOR_CASES) {
    await assertConceptTutorCompletes({
      request,
      studentSessions,
      sessionId,
      testCase,
      tutorId: UNIT1_GRAPH_AXIS_TUTOR_ID,
      hubPrefix: 'unit1-whole-graph-axis'
    });
  }

  for (const prompt of CROSS_UNIT_FORMULA_CASES) {
    const response = await ask(request, sessionId, `unit1-whole-cross-formula-${slug(prompt)}`, prompt);
    assert.match(response.routeType, /formula/i, `${prompt} should stay Formula Tutor or formula route`);
    assert.notEqual(response.routeType, 'concept_tutor', `${prompt} should not start Concept Tutor`);
  }

  for (const testCase of CROSS_UNIT_CONCEPT_CASES) {
    const response = await ask(request, sessionId, `unit1-whole-cross-concept-${slug(testCase.prompt)}`, testCase.prompt);
    assert.equal(response.routeType, 'concept_tutor', `${testCase.prompt} should stay Concept Tutor`);
    assert.equal(response.tutor?.id, testCase.tutorId, `${testCase.prompt} tutor id`);
    assert.notEqual(response.tutor?.id, UNIT1_VARIABLES_TUTOR_ID);
    assert.notEqual(response.tutor?.id, UNIT1_GRAPH_AXIS_TUTOR_ID);
  }

  for (const testCase of CROSS_UNIT_DIRECT_CASES) {
    const response = await ask(request, sessionId, `unit1-whole-cross-direct-${slug(testCase.name)}`, testCase.prompt);
    assert.notEqual(response.routeType, 'concept_tutor', `${testCase.name} should stay Direct Answer, not Concept Tutor`);
    assert.notEqual(response.routeType, 'formula_tutor', `${testCase.name} should stay Direct Answer, not Formula Tutor`);
    assertAnswer(response.response, testCase);
  }

  console.log('PASS Unit 1 whole-unit smoke: direct knowledge, formula visuals, Concept Tutors, and cross-unit boundaries');
}

async function assertFormulaTutor({ request, sessionId, testCase }) {
  const route = routeStudentQuestion(testCase.prompt);
  assert.equal(route.type, 'science_formula', `${testCase.name} should use science_formula route`);
  assert.equal(route.formulaWork?.formulaId, testCase.formulaId, `${testCase.name} formulaId`);
  assert.equal(route.formulaWork?.visualMetadata?.visualType, testCase.visualType, `${testCase.name} visual metadata`);
  assertAnswer(route.directAnswer, testCase);

  const response = await ask(request, sessionId, `unit1-whole-formula-${slug(testCase.name)}`, testCase.prompt);
  assert.equal(response.routeType, 'formula_tutor', `${testCase.name} should start Formula Tutor`);
  assert.notEqual(response.routeType, 'concept_tutor', `${testCase.name} should not start Concept Tutor`);
  assert.equal(response.tutor?.formulaId, testCase.formulaId, `${testCase.name} tutor formulaId`);
  assert.equal(response.tutor?.work?.visualMetadata?.visualType, testCase.visualType, `${testCase.name} frontend-visible visual type`);
  assert.match(response.response, /Step 1 of/i, `${testCase.name} should show guided Formula Tutor steps`);
}

async function assertConceptTutorCompletes({
  request,
  studentSessions,
  sessionId,
  testCase,
  tutorId,
  hubPrefix
}) {
  const studentHubId = `${hubPrefix}-${slug(testCase.prompt)}`;
  const start = await ask(request, sessionId, studentHubId, testCase.prompt);
  assert.equal(start.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
  assert.equal(start.tutor?.id, tutorId, `${testCase.prompt} tutor id`);
  assert.equal(start.tutor?.active, true);
  assert.equal(start.tutor?.finalAnswer, undefined, `${testCase.prompt} should hide final answer metadata before completion`);
  assert.equal(start.tutor?.work?.finalAnswer, '', `${testCase.prompt} should hide final answer work before completion`);
  assert.match(start.response, /Choose one:/i);
  assert.match(start.response, /type only the number/i);
  assert.match(start.response, /1\.\s+/);
  assert.match(start.response, /2\.\s+/);
  assert.notEqual(start.response, start.tutor?.work?.finalAnswer);

  const complete = await ask(request, sessionId, studentHubId, testCase.choice);
  assert.equal(complete.routeType, 'concept_tutor');
  assert.equal(complete.tutor?.id, tutorId);
  assert.equal(complete.tutor?.completed, true);
  assert.equal(complete.tutor?.active, false);
  assertAnswer(complete.response, testCase);
  assert.equal(studentSessions[sessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
}

async function ask(request, sessionId, studentHubId, message) {
  const response = await request('POST', '/api/student/message', {
    sessionId,
    studentHubId,
    message
  });
  assert.equal(response.statusCode, 200, `${studentHubId}: ${message}`);
  return response.body;
}

function assertDirectAnswer(response, testCase) {
  assert.notEqual(response.routeType, 'concept_tutor', `${testCase.name} should stay Direct Answer, not Concept Tutor`);
  assert.notEqual(response.routeType, 'formula_tutor', `${testCase.name} should stay Direct Answer, not Formula Tutor`);
  assert.notEqual(response.routeType, 'motion_force_knowledge_tutor', `${testCase.name} should not start old broad General Tutor`);
  assertAnswer(response.response, testCase);
}

function assertAnswer(answer, testCase) {
  const answerText = String(answer || '');
  assert.ok(answerText.trim(), `${testCase.name || testCase.prompt} should produce an answer`);
  for (const expected of testCase.includes || []) {
    assert.match(answerText, expected, `${testCase.name || testCase.prompt} should include ${expected} but got:\n${answerText}`);
  }
  for (const unexpected of testCase.excludes || []) {
    assert.doesNotMatch(answerText, unexpected, `${testCase.name || testCase.prompt} should not include ${unexpected} but got:\n${answerText}`);
  }
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
