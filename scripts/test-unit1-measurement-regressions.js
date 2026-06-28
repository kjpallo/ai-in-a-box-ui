const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const DIRECT_CASES = [
  {
    name: 'measurement-definition',
    prompt: 'what is measurement',
    includes: [/measurement/i, /tools/i, /units/i, /length|mass|volume|time|temperature/i]
  },
  {
    name: 'accuracy-definition',
    prompt: 'what is accuracy',
    includes: [/accuracy/i, /close/i, /accepted|true|correct/i, /value/i]
  },
  {
    name: 'precision-definition',
    prompt: 'what is precision',
    includes: [/precision/i, /close/i, /repeated measurements|measurements/i, /consistent/i]
  },
  {
    name: 'accuracy-vs-precision',
    prompt: 'what is the difference between accuracy and precision',
    includes: [/accuracy/i, /correct|accepted/i, /precision/i, /close to each other|repeated measurements/i]
  },
  {
    name: 'precise-not-accurate',
    prompt: 'can measurements be precise but not accurate',
    includes: [/yes/i, /close to each other/i, /far from|not accurate|accepted value/i]
  },
  {
    name: 'accurate-not-precise',
    prompt: 'can measurements be accurate but not precise',
    includes: [/yes/i, /true value|accepted value/i, /spread out|not be close|not precise/i]
  },
  {
    name: 'accepted-value',
    prompt: 'what is an accepted value',
    includes: [/accepted value/i, /considered correct|correct/i, /comparison/i]
  },
  {
    name: 'experimental-result',
    prompt: 'what is an experimental result',
    includes: [/experimental result/i, /measured|found/i, /experiment/i]
  },
  {
    name: 'average-definition',
    prompt: 'what is an average',
    includes: [/average/i, /adding|add/i, /dividing|divide/i, /number of values/i]
  },
  {
    name: 'why-average',
    prompt: 'why do scientists calculate averages',
    includes: [/averages/i, /summarize/i, /repeated measurements/i, /random variation/i]
  },
  {
    name: 'repeat-trials',
    prompt: 'why do scientists repeat trials',
    includes: [/repeat|repeated/i, /trials/i, /reliable|reliability/i, /mistakes|random error/i]
  },
  {
    name: 'reliability-definition',
    prompt: 'what does reliability mean in science',
    includes: [/reliability/i, /consistent/i, /trusted/i, /repeated|data/i]
  },
  {
    name: 'standard-definition',
    prompt: 'what is a standard',
    includes: [/standard/i, /exact quantity/i, /comparison/i]
  },
  {
    name: 'si-system-definition',
    prompt: 'what is the SI system',
    includes: [/SI system/i, /measurement system/i, /scientists/i, /world/i]
  },
  {
    name: 'why-si-units',
    prompt: 'why do scientists use SI units',
    includes: [/SI units/i, /common|shared/i, /data/i, /compared|compare/i]
  },
  {
    name: 'length-definition',
    prompt: 'what is length',
    includes: [/length/i, /distance/i, /two points/i]
  },
  {
    name: 'length-unit',
    prompt: 'what unit is used for length',
    includes: [/meter/i, /\bm\b/i]
  },
  {
    name: 'length-tool',
    prompt: 'what tool measures length',
    includes: [/ruler|meter stick/i, /length|distance/i]
  },
  {
    name: 'mass-definition',
    prompt: 'what is mass',
    includes: [/mass/i, /amount of matter/i]
  },
  {
    name: 'mass-unit',
    prompt: 'what unit is used for mass',
    includes: [/kilogram/i, /\bkg\b/i, /grams/i]
  },
  {
    name: 'mass-tool',
    prompt: 'what tool measures mass',
    includes: [/digital scale|balance/i, /mass/i]
  },
  {
    name: 'volume-definition',
    prompt: 'what is volume',
    includes: [/volume/i, /space/i, /takes up/i]
  },
  {
    name: 'liquid-volume-unit',
    prompt: 'what unit is used for liquid volume',
    includes: [/liters?|milliliters?|\bmL\b|\bL\b/i]
  },
  {
    name: 'liquid-volume-tool',
    prompt: 'what tool measures liquid volume',
    includes: [/graduated cylinder/i, /liquid volume|volume/i, /precis/i]
  },
  {
    name: 'time-definition',
    prompt: 'what is time',
    includes: [/time/i, /interval/i, /events/i]
  },
  {
    name: 'time-unit',
    prompt: 'what unit is used for time',
    includes: [/second/i, /\bs\b/i]
  },
  {
    name: 'time-tool',
    prompt: 'what tool measures time',
    includes: [/stopwatch/i, /time/i]
  },
  {
    name: 'temperature-definition',
    prompt: 'what is temperature',
    includes: [/temperature/i, /hot|cold/i]
  },
  {
    name: 'temperature-unit',
    prompt: 'what unit is used for temperature in SI',
    includes: [/Kelvin/i]
  },
  {
    name: 'temperature-tool',
    prompt: 'what tool measures temperature',
    includes: [/thermometer/i, /temperature/i]
  },
  {
    name: 'meniscus-definition',
    prompt: 'what is the meniscus',
    includes: [/meniscus/i, /curve/i, /liquid/i]
  },
  {
    name: 'read-graduated-cylinder',
    prompt: 'how do you read a graduated cylinder',
    includes: [/bottom/i, /meniscus/i, /eye level/i]
  },
  {
    name: 'meniscus-eye-level',
    prompt: 'why read the meniscus at eye level',
    includes: [/eye level/i, /avoid|reduce|helps/i, /measurement error|error/i]
  },
  {
    name: 'graduated-cylinder-vs-beaker',
    prompt: 'why is a graduated cylinder better than a beaker for measuring volume',
    includes: [/graduated cylinder/i, /beaker/i, /volume/i, /precis/i]
  },
  {
    name: 'measurement-number-unit',
    prompt: 'what should a measurement include',
    includes: [/measurement/i, /number/i, /unit/i]
  },
  {
    name: 'units-important',
    prompt: 'why are units important',
    includes: [/units/i, /quantity/i, /measured/i, /understandable/i]
  },
  {
    name: 'typo-acuracy',
    prompt: 'what is acuracy',
    includes: [/accuracy/i, /close/i, /accepted|true|correct/i]
  },
  {
    name: 'typo-precison',
    prompt: 'what is precison',
    includes: [/precision/i, /close/i, /consistent|repeated/i]
  },
  {
    name: 'typo-meniscis',
    prompt: 'what is a meniscis',
    includes: [/meniscus/i, /curve/i, /liquid/i]
  },
  {
    name: 'typo-mesure-mass',
    prompt: 'what tool do I use to mesure mass',
    includes: [/digital scale|balance/i, /mass/i]
  },
  {
    name: 'typo-mesures-temperature',
    prompt: 'what tool mesures temperature',
    includes: [/thermometer/i, /temperature/i]
  },
  {
    name: 'typo-sciencetists-repeat-trials',
    prompt: 'why do sciencetists repeat trials',
    includes: [/scientists/i, /repeat|repeated/i, /trials/i, /reliable|reliability/i]
  }
];

const FORMULA_BOUNDARY_CASES = [
  'Calculate density if mass is 10 g and volume is 5 mL.',
  'A graduated cylinder has 33.5 mL of water. A piece of metal is added and the new volume is 46.2 mL. The metal has a mass of 16.25 g. What is its density?',
  'Calculate speed if distance is 20 m and time is 5 s.'
];

const CHUNK3_BOUNDARY_CASES = [
  'Convert 48 km to meters.',
  'Convert 23 C to F.',
  'Write 354,000,000 in scientific notation.'
];

const SAFETY_BOUNDARY_CASES = [
  {
    prompt: 'What is a beaker used for?',
    includes: [/beaker/i, /holding/i, /mixing/i, /heating|roughly measuring/i]
  },
  {
    prompt: 'What is a Bunsen burner used for?',
    includes: [/Bunsen burner/i, /gas flame|flame/i, /heat/i]
  },
  {
    prompt: 'What does PASS stand for?',
    includes: [/Pull/i, /Aim/i, /Squeeze/i, /Sweep/i]
  }
];

const CONCEPT_TUTOR_BOUNDARY_CASES = [
  {
    prompt: 'Is melting ice endothermic or exothermic?',
    tutorId: 'energy.processes.endothermic-exothermic.identification'
  },
  {
    prompt: 'Is a circuit with one path series or parallel?',
    tutorId: 'electricity.circuits.series-parallel.identification'
  }
];

async function main() {
  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of DIRECT_CASES) {
    const response = await ask(request, sessionId, `unit1-measurement-${slug(testCase.name)}`, testCase.prompt);
    assertDirectAnswer(response, testCase.name);
    assertAnswer(response.response, testCase);
  }

  for (const prompt of FORMULA_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-measurement-formula-${slug(prompt)}`, prompt);
    assert.match(response.routeType, /formula/i, `${prompt} should stay Formula Tutor or formula route`);
    assertNoMeasurementAnswer(response, prompt);
  }

  for (const prompt of CHUNK3_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-measurement-chunk3-${slug(prompt)}`, prompt);
    assertNoMeasurementAnswer(response, prompt);
    assert.notEqual(response.routeType, 'concept_tutor', `${prompt} should not start Concept Tutor`);
  }

  for (const testCase of SAFETY_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-measurement-safety-${slug(testCase.prompt)}`, testCase.prompt);
    assertDirectAnswer(response, testCase.prompt);
    assertNoMeasurementAnswer(response, testCase.prompt);
    assertAnswer(response.response, testCase);
  }

  for (const testCase of CONCEPT_TUTOR_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-measurement-concept-${slug(testCase.prompt)}`, testCase.prompt);
    assert.equal(response.routeType, 'concept_tutor', `${testCase.prompt} should still start its existing Concept Tutor`);
    assert.equal(response.tutor?.id, testCase.tutorId, `${testCase.prompt} tutor id`);
  }

  console.log('PASS Unit 1 measurement regressions: direct answers, typo handling, and route boundaries');
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
}

function assertNoMeasurementAnswer(response, name) {
  const answerText = String(response.response || '');
  assert.doesNotMatch(answerText, /Measurement means using tools and units/i, `${name} should not use Unit 1 measurement definition`);
  assert.doesNotMatch(answerText, /The SI system is the measurement system/i, `${name} should not use Unit 1 SI definition`);
  assert.doesNotMatch(answerText, /The meniscus is the curve/i, `${name} should not use Unit 1 meniscus definition`);
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
