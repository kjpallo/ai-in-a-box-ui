const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');
const {
  ALL_UNIT1_SCIENTIFIC_METHOD_FACTS,
  UNIT1_SCIENTIFIC_METHOD_PACKET,
  tryUnit1ScientificMethodKnowledge
} = require('../lib/knowledge/science/unit1/unit1ScientificMethodKnowledge');

const UNIT1_VARIABLES_TUTOR_ID = 'unit1.scientific_method.variables.identification';

const DIRECT_CASES = [
  {
    name: 'science-definition',
    prompt: 'what is science',
    includes: [/science/i, /natural world/i, /observation|evidence|investigation/i]
  },
  {
    name: 'scientific-method-definition',
    prompt: 'what is the scientific method',
    includes: [/scientific method/i, /ask questions/i, /test ideas/i, /collect data/i, /conclusions?/i]
  },
  {
    name: 'scientific-method-steps',
    prompt: 'what are the steps of the scientific method',
    includes: [/ask a question/i, /background research/i, /hypothesis/i, /experiment/i, /analyze data/i, /conclusion/i]
  },
  {
    name: 'scientific-question',
    prompt: 'what is a scientific question',
    includes: [/scientific question/i, /testable/i, /evidence/i]
  },
  {
    name: 'background-research',
    prompt: 'what is background research',
    includes: [/background research/i, /before the experiment/i, /hypothesis/i]
  },
  {
    name: 'hypothesis-definition',
    prompt: 'what is a hypothesis',
    includes: [/hypothesis/i, /testable/i, /prediction|possible answer/i]
  },
  {
    name: 'hypothesis-format',
    prompt: 'what is the hypothesis format',
    includes: [/if/i, /independent variable/i, /then/i, /dependent variable/i, /because/i]
  },
  {
    name: 'procedure-definition',
    prompt: 'what is a procedure',
    includes: [/procedure/i, /step-by-step|step by step/i, /experiment/i]
  },
  {
    name: 'data-definition',
    prompt: 'what is data',
    includes: [/data/i, /observations?|measurements?/i, /investigation/i]
  },
  {
    name: 'evidence-definition',
    prompt: 'what is evidence',
    includes: [/evidence/i, /data|observations/i, /support/i, /claim|conclusion/i]
  },
  {
    name: 'analysis-definition',
    prompt: 'what is analysis',
    includes: [/analysis/i, /examining data/i, /patterns|relationships|meaning/i]
  },
  {
    name: 'conclusion-definition',
    prompt: 'what is a conclusion',
    includes: [/conclusion/i, /data show/i, /support/i, /hypothesis/i]
  },
  {
    name: 'conclusion-not-proven',
    prompt: 'why should a conclusion not say proven',
    includes: [/conclusion/i, /proven|disproven/i, /support|do not support/i, /hypothesis/i]
  },
  {
    name: 'independent-variable',
    prompt: 'what is an independent variable',
    includes: [/independent variable/i, /changes? on purpose|changed on purpose/i]
  },
  {
    name: 'dependent-variable',
    prompt: 'what is a dependent variable',
    includes: [/dependent variable/i, /measures?|observes?/i, /result|response/i]
  },
  {
    name: 'constant',
    prompt: 'what is a constant',
    includes: [/constant/i, /kept the same/i, /experiment/i]
  },
  {
    name: 'controlled-variable',
    prompt: 'what is a controlled variable',
    includes: [/controlled variable/i, /kept the same/i, /fair/i]
  },
  {
    name: 'control-group',
    prompt: 'what is a control group',
    includes: [/control group/i, /normal|comparison/i, /does not receive|without/i, /tested change/i]
  },
  {
    name: 'experimental-group',
    prompt: 'what is an experimental group',
    includes: [/experimental group/i, /receives/i, /tested change|independent variable/i]
  },
  {
    name: 'fair-test',
    prompt: 'what is a fair test',
    includes: [/fair test/i, /one independent variable/i, /constant/i]
  },
  {
    name: 'why-one-independent-variable',
    prompt: 'why should an experiment have only one independent variable',
    includes: [/one independent variable/i, /caused the results|what caused/i]
  },
  {
    name: 'iv-dv-difference',
    prompt: 'what is the difference between independent and dependent variables',
    includes: [/independent variable/i, /changed on purpose/i, /dependent variable/i, /measured|response/i]
  },
  {
    name: 'control-group-constants-difference',
    prompt: 'what is the difference between a control group and constants',
    includes: [/control group/i, /comparison group/i, /constants?|controlled variables?/i, /kept the same/i]
  },
  {
    name: 'observation-definition',
    prompt: 'what is an observation',
    includes: [/observation/i, /senses|tools/i]
  },
  {
    name: 'inference-definition',
    prompt: 'what is an inference',
    includes: [/inference/i, /logical explanation|explanation/i, /observations/i, /prior knowledge/i]
  },
  {
    name: 'observation-inference-difference',
    prompt: 'what is the difference between observation and inference',
    includes: [/observation/i, /notice directly|senses|tools/i, /inference/i, /think it means|prior knowledge/i]
  },
  {
    name: 'qualitative-data',
    prompt: 'what is qualitative data',
    includes: [/qualitative data/i, /descriptive/i, /color|smell|texture|appearance/i]
  },
  {
    name: 'quantitative-data',
    prompt: 'what is quantitative data',
    includes: [/quantitative data/i, /numerical|numbers/i, /measurements?|counts/i]
  },
  {
    name: 'qual-quant-difference',
    prompt: 'what is the difference between qualitative and quantitative data',
    includes: [/qualitative/i, /qualities|describe/i, /quantitative/i, /numbers|measurements|counts/i]
  },
  {
    name: 'scientific-law',
    prompt: 'what is a scientific law',
    includes: [/scientific law/i, /pattern/i, /nature/i]
  },
  {
    name: 'scientific-theory',
    prompt: 'what is a scientific theory',
    includes: [/scientific theory/i, /well-supported|supported/i, /explanation/i]
  },
  {
    name: 'law-theory-difference',
    prompt: 'what is the difference between a law and a theory',
    includes: [/law/i, /describes what happens|pattern/i, /theory/i, /explains why|why/i]
  }
];

const TYPO_CASES = [
  {
    name: 'typo-scientfic-method',
    prompt: 'what is the scientfic method',
    includes: [/scientific method/i, /test ideas|collect data/i]
  },
  {
    name: 'typo-hypotheis',
    prompt: 'what is a hypotheis',
    includes: [/hypothesis/i, /testable/i]
  },
  {
    name: 'typo-independant-variable',
    prompt: 'what is an independant variable',
    includes: [/independent variable/i, /changes? on purpose/i]
  },
  {
    name: 'typo-dependent-varible',
    prompt: 'what is a dependent varible',
    includes: [/dependent variable/i, /measures?|observes?/i]
  },
  {
    name: 'typo-controled-variable',
    prompt: 'what is a controled variable',
    includes: [/controlled variable/i, /kept the same/i]
  },
  {
    name: 'typo-experamental-group',
    prompt: 'what is an experamental group',
    includes: [/experimental group/i, /receives/i]
  },
  {
    name: 'typo-inferance',
    prompt: 'what is an inferance',
    includes: [/inference/i, /observations/i]
  },
  {
    name: 'typo-qualatative',
    prompt: 'what is qualatative data',
    includes: [/qualitative data/i, /descriptive/i]
  },
  {
    name: 'typo-quantative',
    prompt: 'what is quantative data',
    includes: [/quantitative data/i, /numerical|numbers/i]
  },
  {
    name: 'typo-conclushion',
    prompt: 'what is a conclushion',
    includes: [/conclusion/i, /data show/i, /hypothesis/i]
  },
  {
    name: 'law-vs-theory',
    prompt: 'law vs theory',
    includes: [/law/i, /describes/i, /theory/i, /explains/i]
  }
];

const SCENARIO_CASES = [
  {
    name: 'sunlight-plant-growth-iv',
    prompt: 'In an experiment testing how sunlight affects plant growth, what is the independent variable?',
    choice: '1',
    includes: [/independent variable/i, /amount of sunlight/i]
  },
  {
    name: 'sunlight-plant-growth-dv',
    prompt: 'In an experiment testing how sunlight affects plant growth, what is the dependent variable?',
    choice: '2',
    includes: [/dependent variable/i, /plant growth/i]
  },
  {
    name: 'fertilizer-plant-height-iv',
    prompt: 'In an experiment testing which fertilizer makes plants grow taller, what is the independent variable?',
    choice: '1',
    includes: [/independent variable/i, /type of fertilizer/i]
  },
  {
    name: 'fertilizer-plant-height-dv',
    prompt: 'In an experiment testing which fertilizer makes plants grow taller, what is the dependent variable?',
    choice: '2',
    includes: [/dependent variable/i, /plant height|growth/i]
  },
  {
    name: 'temperature-dissolving-iv',
    prompt: 'In an experiment testing how temperature affects dissolving, what is the independent variable?',
    choice: '1',
    includes: [/independent variable/i, /temperature/i]
  },
  {
    name: 'temperature-dissolving-dv',
    prompt: 'In an experiment testing how temperature affects dissolving, what is the dependent variable?',
    choice: '2',
    includes: [/dependent variable/i, /dissolves|dissolving|how fast|how much/i]
  }
];

const UNIT1_BOUNDARY_CASES = [
  {
    prompt: 'What is accuracy?',
    includes: [/accuracy/i, /accepted|true|correct/i],
    excludes: [/independent variable/i, /scientific method is a process/i]
  },
  {
    prompt: 'What is precision?',
    includes: [/precision/i, /repeated measurements|consistent/i],
    excludes: [/independent variable/i]
  },
  {
    prompt: 'What is the SI system?',
    includes: [/SI system/i, /measurement system/i],
    excludes: [/scientific method/i]
  },
  {
    prompt: 'What is a beaker used for?',
    includes: [/beaker/i, /holding/i, /mixing/i],
    excludes: [/scientific method/i]
  },
  {
    prompt: 'What does PASS stand for?',
    includes: [/Pull/i, /Aim/i, /Squeeze/i, /Sweep/i],
    excludes: [/scientific method/i]
  },
  {
    prompt: 'What is dimensional analysis?',
    includes: [/dimensional analysis/i, /converting|convert/i],
    excludes: [/scientific method/i]
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
    includes: [/conservation of mass/i, /mass/i],
    excludes: [/scientific method/i, /independent variable/i]
  },
  {
    prompt: 'What is matter?',
    includes: [/matter/i, /mass/i, /space|volume/i],
    excludes: [/scientific method/i, /independent variable/i]
  }
];

async function main() {
  assertUnit1ScientificMethodPacketShape();

  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of DIRECT_CASES) {
    const response = await ask(request, sessionId, `unit1-scimethod-${slug(testCase.name)}`, testCase.prompt);
    assertDirectAnswer(response, testCase.name);
    assertAnswer(response.response, testCase);
  }

  for (const testCase of TYPO_CASES) {
    const response = await ask(request, sessionId, `unit1-scimethod-typo-${slug(testCase.name)}`, testCase.prompt);
    assertDirectAnswer(response, testCase.name);
    assertAnswer(response.response, testCase);
  }

  for (const testCase of SCENARIO_CASES) {
    const studentHubId = `unit1-scimethod-scenario-${slug(testCase.name)}`;
    const response = await ask(request, sessionId, studentHubId, testCase.prompt);
    assert.equal(response.routeType, 'concept_tutor', `${testCase.name} should now start the narrow Unit 1 variables Concept Tutor`);
    assert.equal(response.tutor?.id, UNIT1_VARIABLES_TUTOR_ID, `${testCase.name} tutor id`);
    assert.doesNotMatch(response.response, testCase.includes[0], `${testCase.name} should hide final answer until completion`);

    const completed = await ask(request, sessionId, studentHubId, testCase.choice);
    assert.equal(completed.routeType, 'concept_tutor', `${testCase.name} completion route`);
    assert.equal(completed.tutor?.id, UNIT1_VARIABLES_TUTOR_ID, `${testCase.name} completion tutor id`);
    assert.equal(completed.tutor?.completed, true, `${testCase.name} should complete after the correct number`);
    assertAnswer(completed.response, testCase);
  }

  for (const testCase of UNIT1_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-scimethod-unit1-boundary-${slug(testCase.prompt)}`, testCase.prompt);
    assertDirectAnswer(response, testCase.prompt);
    assertAnswer(response.response, testCase);
  }

  for (const prompt of FORMULA_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-scimethod-formula-${slug(prompt)}`, prompt);
    assert.match(response.routeType, /formula/i, `${prompt} should stay Formula Tutor or formula route`);
    assertNoScientificMethodAnswer(response, prompt);
  }

  for (const testCase of CONCEPT_TUTOR_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-scimethod-concept-${slug(testCase.prompt)}`, testCase.prompt);
    assert.equal(response.routeType, 'concept_tutor', `${testCase.prompt} should still start its existing Concept Tutor`);
    assert.equal(response.tutor?.id, testCase.tutorId, `${testCase.prompt} tutor id`);
  }

  for (const testCase of DIRECT_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-scimethod-direct-boundary-${slug(testCase.prompt)}`, testCase.prompt);
    assertDirectAnswer(response, testCase.prompt);
    assertAnswer(response.response, testCase);
  }

  console.log('PASS Unit 1 scientific method regressions: direct answers, typo handling, variable scenario tutor starts, and route boundaries');
}

function assertUnit1ScientificMethodPacketShape() {
  assert.equal(UNIT1_SCIENTIFIC_METHOD_PACKET.packetId, 'unit1-scientific-method');
  assert.equal(UNIT1_SCIENTIFIC_METHOD_PACKET.unit, 1);
  assert.equal(UNIT1_SCIENTIFIC_METHOD_PACKET.unitTitle, 'Science Practices');
  assert.equal(UNIT1_SCIENTIFIC_METHOD_PACKET.title, 'Scientific Method and Variables');
  assert.ok(Array.isArray(UNIT1_SCIENTIFIC_METHOD_PACKET.sourceFiles), 'Unit 1 scientific method packet should expose source refs');
  assert.ok(Array.isArray(UNIT1_SCIENTIFIC_METHOD_PACKET.vocabulary), 'Unit 1 scientific method packet should expose vocabulary');
  assert.ok(Array.isArray(UNIT1_SCIENTIFIC_METHOD_PACKET.concepts), 'Unit 1 scientific method packet should expose concept groups');
  assert.ok(Array.isArray(UNIT1_SCIENTIFIC_METHOD_PACKET.canonicalFacts), 'Unit 1 scientific method packet should expose canonical facts');
  assert.ok(Array.isArray(UNIT1_SCIENTIFIC_METHOD_PACKET.examples), 'Unit 1 scientific method packet should expose existing examples');
  assert.ok(Array.isArray(UNIT1_SCIENTIFIC_METHOD_PACKET.relationships), 'Unit 1 scientific method packet should expose existing related-term edges');
  assert.equal(UNIT1_SCIENTIFIC_METHOD_PACKET.legacyExports.facts, 'ALL_UNIT1_SCIENTIFIC_METHOD_FACTS');
  assert.equal(UNIT1_SCIENTIFIC_METHOD_PACKET.legacyExports.matcher, 'tryUnit1ScientificMethodKnowledge');
  assert.equal(UNIT1_SCIENTIFIC_METHOD_PACKET.counts.canonicalFacts, ALL_UNIT1_SCIENTIFIC_METHOD_FACTS.length);
  assert.ok(UNIT1_SCIENTIFIC_METHOD_PACKET.counts.conceptTutorHooks >= 5);
  assert.ok(UNIT1_SCIENTIFIC_METHOD_PACKET.metadata.generatedFromExistingFactsOnly);

  const directResult = tryUnit1ScientificMethodKnowledge('what is the scientific method');
  assert.ok(directResult, 'Legacy Unit 1 scientific method matcher should still return a direct result');
  assert.match(directResult.directAnswer, /ask questions/i);
  assert.match(directResult.directAnswer, /collect data/i);
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
  assert.match(response.routeType, /definition|science_concept|units_only/i, `${name} should use a direct local route`);
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

function assertNoScientificMethodAnswer(response, name) {
  const answerText = String(response.response || '');
  assert.doesNotMatch(answerText, /scientific method is a process/i, `${name} should not use Unit 1 scientific method definition`);
  assert.doesNotMatch(answerText, /independent variable is what the scientist changes/i, `${name} should not use Unit 1 variable definition`);
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
