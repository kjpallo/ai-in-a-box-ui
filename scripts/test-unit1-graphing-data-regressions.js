const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');
const {
  ALL_UNIT1_GRAPHING_DATA_FACTS,
  UNIT1_GRAPHING_DATA_PACKET,
  tryUnit1GraphingDataKnowledge
} = require('../lib/knowledge/science/unit1/unit1GraphingDataKnowledge');

const UNIT1_GRAPHING_AXIS_TUTOR_ID = 'unit1.graphing.axes.identification';

const DIRECT_CASES = [
  {
    name: 'graph-definition',
    prompt: 'what is a graph',
    includes: [/graph/i, /visual/i, /data/i]
  },
  {
    name: 'why-scientists-use-graphs',
    prompt: 'why do scientists use graphs',
    includes: [/graphs/i, /data/i, /read|compare|analyze/i, /patterns?|trends?/i]
  },
  {
    name: 'data-table',
    prompt: 'what is a data table',
    includes: [/data table/i, /rows/i, /columns/i]
  },
  {
    name: 'data-table-vs-graph',
    prompt: 'what is the difference between a data table and a graph',
    includes: [/data table/i, /exact values/i, /graph/i, /patterns?|trends?|comparisons/i]
  },
  {
    name: 'graph-title',
    prompt: 'what is a graph title',
    includes: [/graph title/i, /what the graph is about/i]
  },
  {
    name: 'good-graph-title',
    prompt: 'what should a good graph title include',
    includes: [/title/i, /both variables|relationship/i]
  },
  {
    name: 'axis',
    prompt: 'what is an axis',
    includes: [/axis/i, /reference line/i, /values|categories/i]
  },
  {
    name: 'axes',
    prompt: 'what are axes',
    includes: [/axes/i, /x-axis|x axis/i, /y-axis|y axis/i]
  },
  {
    name: 'x-axis',
    prompt: 'what is the x-axis',
    includes: [/x-axis|x axis/i, /horizontal/i, /independent variable/i]
  },
  {
    name: 'y-axis',
    prompt: 'what is the y-axis',
    includes: [/y-axis|y axis/i, /vertical/i, /dependent variable/i]
  },
  {
    name: 'x-axis-placement',
    prompt: 'what goes on the x-axis',
    includes: [/independent variable/i, /x-axis|x axis/i]
  },
  {
    name: 'y-axis-placement',
    prompt: 'what goes on the y-axis',
    includes: [/dependent variable/i, /y-axis|y axis/i]
  },
  {
    name: 'axis-labels',
    prompt: 'why do graph axes need labels',
    includes: [/axis labels/i, /variable/i]
  },
  {
    name: 'axis-units',
    prompt: 'why do graph axes need units',
    includes: [/units/i, /measurement scale/i]
  },
  {
    name: 'graph-scale',
    prompt: 'what is a graph scale',
    includes: [/graph scale/i, /numbers/i, /axis/i]
  },
  {
    name: 'graph-interval',
    prompt: 'what is an interval on a graph',
    includes: [/interval/i, /numbered mark/i, /axis/i]
  },
  {
    name: 'equal-intervals',
    prompt: 'why should graph intervals be equal',
    includes: [/equal/i, /accurate/i, /interpret/i]
  },
  {
    name: 'line-graph',
    prompt: 'what is a line graph used for',
    includes: [/line graph/i, /change over time|continuous relationship/i]
  },
  {
    name: 'when-line-graph',
    prompt: 'when should you use a line graph',
    includes: [/line graph/i, /continuous|change over time/i]
  },
  {
    name: 'bar-graph',
    prompt: 'what is a bar graph used for',
    includes: [/bar graph/i, /compare/i, /categories|groups/i]
  },
  {
    name: 'when-bar-graph',
    prompt: 'when should you use a bar graph',
    includes: [/bar graph/i, /separate categories|categories/i]
  },
  {
    name: 'pie-chart',
    prompt: 'what is a pie chart used for',
    includes: [/pie chart/i, /parts|percentages/i, /whole/i]
  },
  {
    name: 'scatter-plot',
    prompt: 'what is a scatter plot used for',
    includes: [/scatter plot/i, /relationship/i, /two numerical variables/i]
  },
  {
    name: 'best-fit-line',
    prompt: 'what is a best-fit line',
    includes: [/best-fit line|best fit line/i, /general trend/i, /data points/i]
  },
  {
    name: 'trend',
    prompt: 'what is a trend',
    includes: [/trend/i, /general pattern|direction/i, /data/i]
  },
  {
    name: 'pattern',
    prompt: 'what is a pattern in data',
    includes: [/pattern/i, /repeats|relationship/i, /data/i]
  },
  {
    name: 'relationship',
    prompt: 'what is a relationship between variables',
    includes: [/relationship/i, /one variable changes/i, /another variable changes/i]
  },
  {
    name: 'positive-relationship',
    prompt: 'what is a positive relationship',
    includes: [/positive relationship/i, /both variables increase/i]
  },
  {
    name: 'negative-relationship',
    prompt: 'what is a negative relationship',
    includes: [/negative relationship/i, /one variable increases/i, /other decreases/i]
  },
  {
    name: 'no-relationship',
    prompt: 'what is no relationship',
    includes: [/no relationship/i, /does not show.*clear pattern|no clear pattern/i]
  },
  {
    name: 'direct-relationship',
    prompt: 'what is a direct relationship',
    includes: [/direct relationship/i, /increase together|decrease together/i]
  },
  {
    name: 'inverse-relationship',
    prompt: 'what is an inverse relationship',
    includes: [/inverse relationship/i, /one variable increases/i, /other decreases/i]
  },
  {
    name: 'analyze-data',
    prompt: 'what does it mean to analyze data',
    includes: [/analyzing data/i, /patterns/i, /trends/i, /relationships/i]
  },
  {
    name: 'graphs-help-conclusions',
    prompt: 'how do graphs help with conclusions',
    includes: [/graphs/i, /support or do not support/i, /hypothesis/i]
  },
  {
    name: 'cer',
    prompt: 'what is claim evidence reasoning',
    includes: [/claim-evidence-reasoning|CER/i, /claim/i, /evidence/i, /reasoning/i]
  },
  {
    name: 'claim',
    prompt: 'what is a claim',
    includes: [/claim/i, /answer|statement/i, /support/i]
  },
  {
    name: 'evidence-cer',
    prompt: 'what is evidence in CER',
    includes: [/evidence/i, /data|observations/i, /support the claim/i]
  },
  {
    name: 'reasoning-cer',
    prompt: 'what is reasoning in CER',
    includes: [/reasoning/i, /why/i, /evidence supports the claim/i]
  }
];

const TYPO_CASES = [
  {
    name: 'graf',
    prompt: 'what is a graf',
    includes: [/graph/i, /visual/i, /data/i]
  },
  {
    name: 'data-tabel',
    prompt: 'what is a data tabel',
    includes: [/data table/i, /rows/i, /columns/i]
  },
  {
    name: 'xaxis',
    prompt: 'what is the xaxis',
    includes: [/x-axis|x axis/i, /horizontal/i]
  },
  {
    name: 'yaxis',
    prompt: 'what is the yaxis',
    includes: [/y-axis|y axis/i, /vertical/i]
  },
  {
    name: 'intervel',
    prompt: 'what is an intervel on a graph',
    includes: [/interval/i, /numbered mark/i]
  },
  {
    name: 'trand',
    prompt: 'what is a trand',
    includes: [/trend/i, /general pattern|direction/i]
  },
  {
    name: 'positve',
    prompt: 'what is a positve relationship',
    includes: [/positive relationship/i, /both variables increase/i]
  },
  {
    name: 'negitive',
    prompt: 'what is a negitive relationship',
    includes: [/negative relationship/i, /one variable increases/i]
  },
  {
    name: 'best-fit-line',
    prompt: 'what is a best fit line',
    includes: [/best-fit line|best fit line/i, /general trend/i]
  },
  {
    name: 'clame-evidence-resonig',
    prompt: 'what is clame evidence resonig',
    includes: [/claim-evidence-reasoning|CER/i, /claim/i, /evidence/i, /reasoning/i]
  }
];

const SCENARIO_CASES = [
  {
    name: 'sunlight-x-axis',
    prompt: 'In a graph of sunlight vs plant growth, what goes on the x-axis?',
    choice: '1',
    includes: [/amount of sunlight/i, /x-axis|x axis/i, /independent variable/i]
  },
  {
    name: 'sunlight-y-axis',
    prompt: 'In a graph of sunlight vs plant growth, what goes on the y-axis?',
    choice: '2',
    includes: [/plant growth/i, /y-axis|y axis/i, /dependent variable/i]
  },
  {
    name: 'fertilizer-x-axis',
    prompt: 'In a graph of fertilizer type vs plant height, what goes on the x-axis?',
    choice: '1',
    includes: [/type of fertilizer/i, /x-axis|x axis/i, /independent variable/i]
  },
  {
    name: 'fertilizer-y-axis',
    prompt: 'In a graph of fertilizer type vs plant height, what goes on the y-axis?',
    choice: '2',
    includes: [/plant height|growth/i, /y-axis|y axis/i, /dependent variable/i]
  },
  {
    name: 'temperature-x-axis',
    prompt: 'In a graph of temperature vs dissolving rate, what goes on the x-axis?',
    choice: '1',
    includes: [/temperature/i, /x-axis|x axis/i, /independent variable/i]
  },
  {
    name: 'temperature-y-axis',
    prompt: 'In a graph of temperature vs dissolving rate, what goes on the y-axis?',
    choice: '2',
    includes: [/dissolving rate|how fast/i, /y-axis|y axis/i, /dependent variable/i]
  }
];

const UNIT1_BOUNDARY_CASES = [
  {
    prompt: 'What is accuracy?',
    includes: [/accuracy/i, /accepted|true|correct/i]
  },
  {
    prompt: 'What is precision?',
    includes: [/precision/i, /consistent|repeated measurements/i]
  },
  {
    prompt: 'What is the SI system?',
    includes: [/SI system/i, /measurement system/i]
  },
  {
    prompt: 'What is a beaker used for?',
    includes: [/beaker/i, /holding/i, /mixing/i]
  },
  {
    prompt: 'What does PASS stand for?',
    includes: [/Pull/i, /Aim/i, /Squeeze/i, /Sweep/i]
  },
  {
    prompt: 'What is dimensional analysis?',
    includes: [/dimensional analysis/i, /converting|convert/i]
  },
  {
    prompt: 'What is the scientific method?',
    includes: [/scientific method/i, /ask questions/i, /test ideas/i]
  },
  {
    prompt: 'What is an independent variable?',
    includes: [/independent variable/i, /changes? on purpose/i]
  }
];

const FORMULA_BOUNDARY_CASES = [
  'Convert 48 km to meters.',
  'Write 354,000,000 in scientific notation.',
  'Calculate density if mass is 10 g and volume is 5 mL.',
  'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.'
];

const CONCEPT_TUTOR_BOUNDARY_CASES = [
  {
    prompt: 'In an experiment testing how sunlight affects plant growth, what is the independent variable?',
    tutorId: 'unit1.scientific_method.variables.identification'
  },
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
  }
];

const DIRECT_BOUNDARY_CASES = [
  {
    prompt: 'What is conservation of mass?',
    includes: [/conservation of mass/i, /mass/i]
  },
  {
    prompt: 'What is matter?',
    includes: [/matter/i, /mass/i, /space|volume/i]
  },
  {
    prompt: 'What type of waves are used in night vision goggles and remote controls?',
    includes: [/infrared/i, /night vision|remote controls/i]
  }
];

async function main() {
  assertUnit1GraphingDataPacketShape();

  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of DIRECT_CASES) {
    const response = await ask(request, sessionId, `unit1-graphing-direct-${slug(testCase.name)}`, testCase.prompt);
    assertDirectAnswer(response, testCase.name);
    assertAnswer(response.response, testCase);
  }

  for (const testCase of TYPO_CASES) {
    const response = await ask(request, sessionId, `unit1-graphing-typo-${slug(testCase.name)}`, testCase.prompt);
    assertDirectAnswer(response, testCase.name);
    assertAnswer(response.response, testCase);
  }

  for (const testCase of SCENARIO_CASES) {
    const studentHubId = `unit1-graphing-scenario-${slug(testCase.name)}`;
    const response = await ask(request, sessionId, studentHubId, testCase.prompt);
    assert.equal(response.routeType, 'concept_tutor', `${testCase.name} should now start the narrow Unit 1 graphing-axis Concept Tutor`);
    assert.equal(response.tutor?.id, UNIT1_GRAPHING_AXIS_TUTOR_ID, `${testCase.name} tutor id`);
    assert.doesNotMatch(response.response, /goes on the [xy]-axis because/i, `${testCase.name} should hide final answer until completion`);

    const completed = await ask(request, sessionId, studentHubId, testCase.choice);
    assert.equal(completed.routeType, 'concept_tutor', `${testCase.name} completion route`);
    assert.equal(completed.tutor?.id, UNIT1_GRAPHING_AXIS_TUTOR_ID, `${testCase.name} completion tutor id`);
    assert.equal(completed.tutor?.completed, true, `${testCase.name} should complete after the correct number`);
    assertAnswer(completed.response, testCase);
  }

  for (const testCase of UNIT1_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-graphing-boundary-${slug(testCase.prompt)}`, testCase.prompt);
    assertDirectAnswer(response, testCase.prompt);
    assertAnswer(response.response, testCase);
  }

  for (const prompt of FORMULA_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-graphing-formula-${slug(prompt)}`, prompt);
    assert.match(response.routeType, /formula/i, `${prompt} should stay Formula Tutor or formula route`);
    assert.notEqual(response.tutor?.id, 'unit1.scientific_method.variables.identification');
  }

  for (const testCase of CONCEPT_TUTOR_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-graphing-concept-${slug(testCase.prompt)}`, testCase.prompt);
    assert.equal(response.routeType, 'concept_tutor', `${testCase.prompt} should still start Concept Tutor`);
    assert.equal(response.tutor?.id, testCase.tutorId, `${testCase.prompt} tutor id`);
  }

  for (const testCase of DIRECT_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-graphing-direct-boundary-${slug(testCase.prompt)}`, testCase.prompt);
    assertDirectAnswer(response, testCase.prompt);
    assertAnswer(response.response, testCase);
  }

  console.log('PASS Unit 1 graphing/data regressions: direct answers, typo handling, graph-axis tutor starts, and route boundaries');
}

function assertUnit1GraphingDataPacketShape() {
  assert.ok(UNIT1_GRAPHING_DATA_PACKET, 'Unit 1 graphing/data packet should be exported');
  assert.equal(UNIT1_GRAPHING_DATA_PACKET.packetId, 'unit1-graphing-data');
  assert.equal(UNIT1_GRAPHING_DATA_PACKET.unit, 1);
  assert.equal(UNIT1_GRAPHING_DATA_PACKET.unitTitle, 'Science Practices');
  assert.equal(UNIT1_GRAPHING_DATA_PACKET.title, 'Graphing and Data Analysis');
  assert.ok(Array.isArray(UNIT1_GRAPHING_DATA_PACKET.sourceFiles), 'Unit 1 graphing/data packet should expose source refs');
  assert.ok(Array.isArray(UNIT1_GRAPHING_DATA_PACKET.topics), 'Unit 1 graphing/data packet should expose topics');
  assert.ok(Array.isArray(UNIT1_GRAPHING_DATA_PACKET.vocabulary), 'Unit 1 graphing/data packet should expose vocabulary');
  assert.ok(Array.isArray(UNIT1_GRAPHING_DATA_PACKET.concepts), 'Unit 1 graphing/data packet should expose concept groups');
  assert.ok(Array.isArray(UNIT1_GRAPHING_DATA_PACKET.canonicalFacts), 'Unit 1 graphing/data packet should expose canonical facts');
  assert.ok(Array.isArray(UNIT1_GRAPHING_DATA_PACKET.examples), 'Unit 1 graphing/data packet should expose existing examples');
  assert.ok(Array.isArray(UNIT1_GRAPHING_DATA_PACKET.relationships), 'Unit 1 graphing/data packet should expose existing related-term edges');
  assert.equal(UNIT1_GRAPHING_DATA_PACKET.legacyExports.facts, 'ALL_UNIT1_GRAPHING_DATA_FACTS');
  assert.equal(UNIT1_GRAPHING_DATA_PACKET.legacyExports.matcher, 'tryUnit1GraphingDataKnowledge');
  assert.equal(UNIT1_GRAPHING_DATA_PACKET.counts.canonicalFacts, ALL_UNIT1_GRAPHING_DATA_FACTS.length);
  assert.ok(UNIT1_GRAPHING_DATA_PACKET.sourceFiles.includes('unit1.corpus.0153'), 'Unit 1 graphing/data packet should represent existing source refs');
  assert.ok(UNIT1_GRAPHING_DATA_PACKET.counts.relationships > 0, 'Unit 1 graphing/data packet should count existing relationships');
  assert.ok(UNIT1_GRAPHING_DATA_PACKET.metadata.generatedFromExistingFactsOnly);

  const directResult = tryUnit1GraphingDataKnowledge('what is a graph');
  assert.ok(directResult, 'Legacy Unit 1 graphing/data matcher should still return a direct result');
  assert.match(directResult.directAnswer, /visual/i);
  assert.match(directResult.directAnswer, /data/i);
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

function assertDirectAnswer(response, name) {
  assert.notEqual(response.routeType, 'concept_tutor', `${name} should stay Direct Answer, not Concept Tutor`);
  assert.notEqual(response.routeType, 'formula_tutor', `${name} should stay Direct Answer, not Formula Tutor`);
  assert.notEqual(response.routeType, 'motion_force_knowledge_tutor', `${name} should not start old broad General Tutor`);
  assert.match(response.routeType, /definition|science_concept|units_only|class_fact/i, `${name} should use a direct local route`);
}

function assertAnswer(answer, testCase) {
  const answerText = String(answer || '');
  assert.ok(answerText.trim(), `${testCase.name || testCase.prompt} should produce an answer`);
  for (const expected of testCase.includes || []) {
    assert.match(answerText, expected, `${testCase.name || testCase.prompt} should include ${expected} but got:\n${answerText}`);
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
