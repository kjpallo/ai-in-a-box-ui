const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const DIRECT_SMOKE = [
  { prompt: 'What is an atom?', includes: [/smallest particle/i, /element/i] },
  { prompt: 'What charge is a protone?', includes: [/positive/i, /nucleus/i] },
  { prompt: 'What did ruther ford do?', includes: [/gold foil/i, /nucleus/i] },
  { prompt: 'What is atomic number?', includes: [/number of protons/i, /identifies/i] },
  { prompt: 'What are isotopes?', includes: [/same element/i, /different numbers of neutrons/i] },
  { prompt: 'What is isotope notation?', includes: [/hyphen notation/i, /nuclear notation/i] },
  { prompt: 'What are groups on the periodic table?', includes: [/vertical columns/i, /valence electrons/i] },
  { prompt: 'What are halogens?', includes: [/Group 17|halogens/i, /reactive nonmetals|most reactive nonmetals/i] },
  { prompt: 'What are metaloids?', includes: [/stair-step/i, /semiconductors/i] },
  { prompt: 'How do you set up a Bohr model?', includes: [/protons/i, /neutrons/i, /electrons/i] }
];

const FORMULA_SMOKE = [
  { prompt: 'how many nuetrons in sodium 23', includes: [/Neutrons = 12/i] },
  { prompt: 'neutral atom atomic number 50 how many electrons', includes: [/Electrons = 50/i] },
  { prompt: 'carbon has 7 neutrons write isotope', includes: [/Carbon-13/i, /13C/i] }
];

const CONCEPT_SMOKE = [
  {
    prompt: 'Why do elements in the same group act similar?',
    choice: '3',
    final: /valence electrons.*similar properties|same group.*valence electrons/i
  },
  {
    prompt: 'Which model has electrons in fixed orbits?',
    choice: '1',
    final: /Bohr model.*fixed orbits|fixed.*energy levels/i
  },
  {
    prompt: 'Classify an element near the stair step that is a semiconductor.',
    choice: '3',
    final: /metalloid.*stair-step|semiconductor/i
  }
];

const CROSS_UNIT_BOUNDARIES = [
  { prompt: 'What is accuracy?', routeNot: 'formula_tutor', includes: /accuracy/i },
  { prompt: 'Calculate density if mass is 10 g and volume is 5 mL.', route: 'formula_tutor', includes: /density/i },
  { prompt: 'Is melting ice endothermic or exothermic?', route: 'concept_tutor', includes: /endothermic|exothermic/i },
  { prompt: 'Is salt water homogeneous or heterogeneous?', route: 'concept_tutor', includes: /homogeneous|heterogeneous/i }
];

async function main() {
  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of DIRECT_SMOKE) {
    const response = await ask(request, sessionId, `unit7-smoke-direct-${slug(testCase.prompt)}`, testCase.prompt);
    assert.notEqual(response.routeType, 'no_match', `${testCase.prompt} should not be No Match`);
    assert.notEqual(response.routeType, 'formula_tutor', `${testCase.prompt} should be direct, not Formula Tutor`);
    assert.notEqual(response.routeType, 'concept_tutor', `${testCase.prompt} should be direct, not Concept Tutor`);
    testCase.includes.forEach((pattern) => assert.match(response.response, pattern));
  }

  for (const testCase of FORMULA_SMOKE) {
    const response = await ask(request, sessionId, `unit7-smoke-formula-${slug(testCase.prompt)}`, testCase.prompt);
    assert.equal(response.routeType, 'formula_tutor', `${testCase.prompt} should start Formula Tutor`);
    assert.match(response.response, /Formula Tutor|Step 1/i);
    assert.ok(response.tutor?.formulaId);
  }

  for (const testCase of CONCEPT_SMOKE) {
    const studentHubId = `unit7-smoke-concept-${slug(testCase.prompt)}`;
    const start = await ask(request, sessionId, studentHubId, testCase.prompt);
    assert.equal(start.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.match(start.response, /Choose one:/i);
    const complete = await ask(request, sessionId, studentHubId, testCase.choice);
    assert.equal(complete.tutor?.completed, true);
    assert.match(complete.response, testCase.final);
  }

  for (const testCase of CROSS_UNIT_BOUNDARIES) {
    const response = await ask(request, sessionId, `unit7-smoke-boundary-${slug(testCase.prompt)}`, testCase.prompt);
    if (testCase.route) assert.equal(response.routeType, testCase.route, `${testCase.prompt} route`);
    if (testCase.routeNot) assert.notEqual(response.routeType, testCase.routeNot, `${testCase.prompt} route`);
    assert.match(response.response, testCase.includes);
  }

  console.log(`PASS Unit 7 Atomic Structure whole-unit smoke: direct, formula, Concept Tutor, and cross-unit boundaries`);
}

async function ask(request, sessionId, studentHubId, message) {
  const response = await request('POST', '/api/student/message', {
    sessionId,
    studentHubId,
    message
  });
  assert.equal(response.statusCode, 200, `${message} should return 200`);
  return response.body;
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
