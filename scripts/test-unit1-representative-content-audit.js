const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const UNIT1_VARIABLES_TUTOR_ID = 'unit1.scientific_method.variables.identification';
const UNIT1_GRAPH_AXIS_TUTOR_ID = 'unit1.graphing.axes.identification';

const DIRECT_CATEGORIES = [
  {
    name: 'safety/equipment Direct Answers',
    cases: [
      {
        name: 'goggles-purpose',
        prompt: 'What are goggles used for?',
        includes: [/goggles/i, /protect/i, /eyes/i]
      },
      {
        name: 'graduated-cylinder-use',
        prompt: 'What is a graduated cylinder used for?',
        includes: [/graduated cylinder/i, /measure/i, /liquid volume|volume/i]
      },
      {
        name: 'waft-how',
        prompt: 'How do you waft?',
        includes: [/waft/i, /fumes|vapors?/i, /nose/i]
      }
    ]
  },
  {
    name: 'measurement/data-quality Direct Answers',
    cases: [
      {
        name: 'accuracy',
        prompt: 'What is accuracy?',
        includes: [/accuracy/i, /accepted|true|correct/i]
      },
      {
        name: 'precision',
        prompt: 'What is precision?',
        includes: [/precision/i, /repeated|consistent/i]
      },
      {
        name: 'meniscus',
        prompt: 'What is the meniscus?',
        includes: [/meniscus/i, /curve/i, /liquid/i]
      }
    ]
  },
  {
    name: 'scientific method Direct Answers',
    cases: [
      {
        name: 'scientific-method',
        prompt: 'What is the scientific method?',
        includes: [/scientific method/i, /ask questions/i, /test ideas/i, /collect data/i, /draw conclusions/i]
      },
      {
        name: 'hypothesis',
        prompt: 'What is a hypothesis?',
        includes: [/hypothesis/i, /testable prediction|possible answer/i]
      },
      {
        name: 'conclusion',
        prompt: 'What is a conclusion?',
        includes: [/conclusion/i, /data show/i, /support/i, /hypothesis/i]
      }
    ]
  },
  {
    name: 'variables/groups Direct Answers',
    cases: [
      {
        name: 'independent-variable',
        prompt: 'What is an independent variable?',
        includes: [/independent variable/i, /changes on purpose/i]
      },
      {
        name: 'dependent-variable',
        prompt: 'What is a dependent variable?',
        includes: [/dependent variable/i, /measures|observes/i, /result/i]
      },
      {
        name: 'control-group',
        prompt: 'What is a control group?',
        includes: [/control group/i, /normal|comparison/i, /tested change/i]
      }
    ]
  },
  {
    name: 'observation/data/law Direct Answers',
    cases: [
      {
        name: 'qualitative-data',
        prompt: 'What is qualitative data?',
        includes: [/qualitative data/i, /descriptive/i]
      },
      {
        name: 'quantitative-data',
        prompt: 'What is quantitative data?',
        includes: [/quantitative data/i, /numerical|numbers/i]
      },
      {
        name: 'law-vs-theory',
        prompt: 'What is the difference between a law and a theory?',
        includes: [/law/i, /describes what happens/i, /theory/i, /explains why/i]
      }
    ]
  },
  {
    name: 'graphing basics Direct Answers',
    cases: [
      {
        name: 'graph',
        prompt: 'What is a graph?',
        includes: [/graph/i, /visual/i, /data/i]
      },
      {
        name: 'x-axis-placement',
        prompt: 'What goes on the x-axis?',
        includes: [/independent variable/i, /x-axis|x axis/i]
      },
      {
        name: 'y-axis-placement',
        prompt: 'What goes on the y-axis?',
        includes: [/dependent variable/i, /y-axis|y axis/i]
      }
    ]
  },
  {
    name: 'graph types/data-analysis Direct Answers',
    cases: [
      {
        name: 'line-graph',
        prompt: 'What is a line graph used for?',
        includes: [/line graph/i, /change over time|continuous/i]
      },
      {
        name: 'trend',
        prompt: 'What is a trend?',
        includes: [/trend/i, /general pattern|direction/i, /data/i]
      },
      {
        name: 'cer',
        prompt: 'What is CER?',
        includes: [/claim-evidence-reasoning|CER/i, /claim/i, /evidence/i, /reasoning/i]
      }
    ]
  }
];

const CONVERSION_FORMULA_CASES = [
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
    name: 'temperature-conversion',
    prompt: 'Convert 23 C to F.',
    formulaId: 'unit1_temperature_conversion',
    visualType: 'temperature_conversion',
    includes: [/73\.4\s*°?F/i]
  }
];

const NOTATION_FORMULA_CASES = [
  {
    name: 'large-number-scientific-notation',
    prompt: 'Write 354,000,000 in scientific notation.',
    formulaId: 'unit1_scientific_notation',
    visualType: 'scientific_notation_decimal_move',
    includes: [/3\.54\s*×?\s*10\^8/i]
  },
  {
    name: 'small-number-scientific-notation',
    prompt: 'Write 0.000096 in scientific notation.',
    formulaId: 'unit1_scientific_notation',
    visualType: 'scientific_notation_decimal_move',
    includes: [/9\.6\s*×?\s*10\^-5/i]
  },
  {
    name: 'standard-notation',
    prompt: 'Write 2.76 x 10-3 in standard notation.',
    formulaId: 'unit1_standard_notation',
    visualType: 'scientific_notation_decimal_move',
    includes: [/0\.00276/i]
  }
];

const VARIABLE_CONCEPT_CASES = [
  {
    name: 'sunlight-plant-growth-iv',
    prompt: 'In an experiment testing how sunlight affects plant growth, what is the independent variable?',
    choice: '1',
    includes: [/independent variable/i, /amount of sunlight/i, /changes on purpose/i]
  },
  {
    name: 'fertilizer-plant-height-dv',
    prompt: 'In an experiment testing which fertilizer makes plants grow taller, what is the dependent variable?',
    choice: '2',
    includes: [/dependent variable/i, /plant height or growth/i, /measures as the result/i]
  },
  {
    name: 'temperature-dissolving-iv',
    prompt: 'In an experiment testing how temperature affects dissolving, what is the independent variable?',
    choice: '1',
    includes: [/independent variable/i, /temperature/i, /changes on purpose/i]
  }
];

const GRAPH_AXIS_CONCEPT_CASES = [
  {
    name: 'sunlight-plant-growth-x-axis',
    prompt: 'In a graph of sunlight vs plant growth, what goes on the x-axis?',
    choice: '1',
    includes: [/Amount of sunlight/i, /x-axis/i, /independent variable/i]
  },
  {
    name: 'fertilizer-plant-height-y-axis',
    prompt: 'In a graph of fertilizer type vs plant height, what goes on the y-axis?',
    choice: '2',
    includes: [/Plant height or growth/i, /y-axis/i, /dependent variable/i]
  },
  {
    name: 'temperature-dissolving-y-axis',
    prompt: 'In a graph of temperature vs dissolving rate, what goes on the y-axis?',
    choice: '2',
    includes: [/Dissolving rate/i, /y-axis/i, /dependent variable/i]
  }
];

const CROSS_UNIT_CASES = [
  {
    name: 'density-formula',
    prompt: 'Calculate density if mass is 10 g and volume is 5 mL.',
    expectedKind: 'formula',
    blockedFormulaIds: [
      'unit1_metric_stair_step_conversion',
      'unit1_picket_fence_conversion',
      'unit1_temperature_conversion',
      'unit1_scientific_notation',
      'unit1_standard_notation'
    ]
  },
  {
    name: 'wave-speed-formula',
    prompt: 'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.',
    expectedKind: 'formula',
    blockedFormulaIds: [
      'unit1_metric_stair_step_conversion',
      'unit1_picket_fence_conversion',
      'unit1_temperature_conversion',
      'unit1_scientific_notation',
      'unit1_standard_notation'
    ]
  },
  {
    name: 'endothermic-exothermic-concept',
    prompt: 'Is melting ice endothermic or exothermic?',
    expectedKind: 'concept',
    tutorId: 'energy.processes.endothermic-exothermic.identification'
  }
];

async function main() {
  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  const summaries = [];

  for (const category of DIRECT_CATEGORIES) {
    for (const testCase of category.cases) {
      const response = await ask(request, sessionId, `unit1-audit-direct-${slug(category.name)}-${slug(testCase.name)}`, testCase.prompt);
      assertDirectAnswer(response, testCase);
    }
    summaries.push(`${category.name}: ${category.cases.length}`);
  }

  for (const testCase of CONVERSION_FORMULA_CASES) {
    await assertFormulaCase({ request, sessionId, testCase });
  }
  summaries.push(`conversions Formula Tutor / visual metadata: ${CONVERSION_FORMULA_CASES.length}`);

  for (const testCase of NOTATION_FORMULA_CASES) {
    await assertFormulaCase({ request, sessionId, testCase });
  }
  summaries.push(`scientific notation Formula Tutor / visual metadata: ${NOTATION_FORMULA_CASES.length}`);

  for (const testCase of VARIABLE_CONCEPT_CASES) {
    await assertConceptTutorCase({
      request,
      studentSessions,
      sessionId,
      testCase,
      tutorId: UNIT1_VARIABLES_TUTOR_ID,
      hubPrefix: 'unit1-audit-variable'
    });
  }
  summaries.push(`variables Concept Tutor: ${VARIABLE_CONCEPT_CASES.length}`);

  for (const testCase of GRAPH_AXIS_CONCEPT_CASES) {
    await assertConceptTutorCase({
      request,
      studentSessions,
      sessionId,
      testCase,
      tutorId: UNIT1_GRAPH_AXIS_TUTOR_ID,
      hubPrefix: 'unit1-audit-graph-axis'
    });
  }
  summaries.push(`graphing axis Concept Tutor: ${GRAPH_AXIS_CONCEPT_CASES.length}`);

  for (const testCase of CROSS_UNIT_CASES) {
    await assertCrossUnitBoundary({ request, sessionId, testCase });
  }
  summaries.push(`cross-unit boundaries: ${CROSS_UNIT_CASES.length}`);

  console.log(`PASS Unit 1 representative content audit: ${summaries.join('; ')}`);
}

async function assertFormulaCase({ request, sessionId, testCase }) {
  const route = routeStudentQuestion(testCase.prompt);
  assert.equal(route.type, 'science_formula', `${testCase.name} should use science_formula route`);
  if (testCase.formulaId) {
    assert.equal(route.formulaWork?.formulaId, testCase.formulaId, `${testCase.name} formulaId`);
  }
  assert.equal(route.formulaWork?.visualMetadata?.visualType, testCase.visualType, `${testCase.name} route visual metadata`);
  assertAnswer(route.directAnswer, testCase);

  const response = await ask(request, sessionId, `unit1-audit-formula-${slug(testCase.name)}`, testCase.prompt);
  assert.notEqual(response.routeType, 'concept_tutor', `${testCase.name} should not start Concept Tutor`);
  assert.match(response.routeType, /formula/i, `${testCase.name} should start Formula Tutor or formula route`);
  if (testCase.formulaId) {
    assert.equal(response.tutor?.formulaId, testCase.formulaId, `${testCase.name} tutor formulaId`);
  }
  assert.equal(response.tutor?.work?.visualMetadata?.visualType, testCase.visualType, `${testCase.name} tutor visual metadata`);
}

async function assertConceptTutorCase({
  request,
  studentSessions,
  sessionId,
  testCase,
  tutorId,
  hubPrefix
}) {
  const studentHubId = `${hubPrefix}-${slug(testCase.name)}`;
  const start = await ask(request, sessionId, studentHubId, testCase.prompt);
  assert.equal(start.routeType, 'concept_tutor', `${testCase.name} should start Concept Tutor`);
  assert.equal(start.tutor?.id, tutorId, `${testCase.name} tutor id`);
  assert.equal(start.tutor?.active, true, `${testCase.name} should be active before completion`);
  assert.equal(start.tutor?.finalAnswer, undefined, `${testCase.name} should hide final answer before completion`);
  assert.equal(start.tutor?.work?.finalAnswer, '', `${testCase.name} should hide work final answer before completion`);
  assert.match(start.response, /Choose one:/i, `${testCase.name} should show choices`);
  assert.match(start.response, /type only the number/i, `${testCase.name} should request number-only reply`);
  assert.match(start.response, /1\.\s+/);
  assert.match(start.response, /2\.\s+/);

  const complete = await ask(request, sessionId, studentHubId, testCase.choice);
  assert.equal(complete.routeType, 'concept_tutor', `${testCase.name} completion should remain Concept Tutor`);
  assert.equal(complete.tutor?.id, tutorId, `${testCase.name} completion tutor id`);
  assert.equal(complete.tutor?.completed, true, `${testCase.name} should complete after correct number`);
  assert.equal(complete.tutor?.active, false, `${testCase.name} should become inactive after completion`);
  assertAnswer(complete.response, testCase);
  assert.equal(studentSessions[sessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
}

async function assertCrossUnitBoundary({ request, sessionId, testCase }) {
  const response = await ask(request, sessionId, `unit1-audit-cross-unit-${slug(testCase.name)}`, testCase.prompt);
  if (testCase.expectedKind === 'formula') {
    assert.notEqual(response.routeType, 'concept_tutor', `${testCase.name} should not start Concept Tutor`);
    assert.match(response.routeType, /formula/i, `${testCase.name} should stay Formula Tutor or formula route`);
    for (const formulaId of testCase.blockedFormulaIds || []) {
      assert.notEqual(response.tutor?.formulaId, formulaId, `${testCase.name} should not use Unit 1 formulaId ${formulaId}`);
    }
    return;
  }

  if (testCase.expectedKind === 'concept') {
    assert.equal(response.routeType, 'concept_tutor', `${testCase.name} should remain existing Concept Tutor`);
    assert.equal(response.tutor?.id, testCase.tutorId, `${testCase.name} tutor id`);
    assert.notEqual(response.tutor?.id, UNIT1_VARIABLES_TUTOR_ID, `${testCase.name} should not use Unit 1 variables tutor`);
    assert.notEqual(response.tutor?.id, UNIT1_GRAPH_AXIS_TUTOR_ID, `${testCase.name} should not use Unit 1 graphing-axis tutor`);
  }
}

function assertDirectAnswer(response, testCase) {
  assert.notEqual(response.routeType, 'concept_tutor', `${testCase.name} should stay Direct Answer`);
  assert.notEqual(response.routeType, 'formula_tutor', `${testCase.name} should not start Formula Tutor`);
  assert.notEqual(response.routeType, 'motion_force_knowledge_tutor', `${testCase.name} should not start old broad General Tutor`);
  assertAnswer(response.response, testCase);
}

function assertAnswer(answer, testCase) {
  const answerText = String(answer || '');
  assert.ok(answerText.trim(), `${testCase.name || testCase.prompt} should produce an answer`);
  for (const expected of testCase.includes || []) {
    assert.match(answerText, expected, `${testCase.name || testCase.prompt} should include ${expected} but got:\n${answerText}`);
  }
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
