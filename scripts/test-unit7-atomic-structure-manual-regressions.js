const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');
const {
  UNIT7_COMPARISON_PAIRS,
  UNIT7_SOURCE_REFERENCES
} = require('../lib/knowledge/chemistry/atomicStructure/unit7AtomicStructureSourcePack');

const DIRECT_CASES = [
  {
    prompt: 'What is the charge and location of a proton, neutron, and electron?',
    includes: [/proton.*positive.*nucleus/is, /neutron.*neutral.*nucleus/is, /electron.*negative.*electron cloud.*outside the nucleus/is]
  },
  {
    prompt: 'An ion has 17 protons, 18 electrons, and 18 neutrons. What is its element, charge, and mass number?',
    includes: [/Element: Chlorine \(Cl\)/i, /Charge: -1/i, /Mass number: 35/i],
    excludesFormulaTutor: true
  },
  {
    prompt: 'An ion has 12 protons, 10 electrons, and 12 neutrons. Identify the element, charge, and mass number.',
    includes: [/Element: Magnesium \(Mg\)/i, /Charge: \+2/i, /Mass number: 24/i],
    excludesFormulaTutor: true
  },
  {
    prompt: 'An atom has 8 protons, 8 electrons, and 8 neutrons. What is its element, charge, and mass number?',
    includes: [/Element: Oxygen \(O\)/i, /Charge: 0|neutral/i, /Mass number: 16/i],
    excludesFormulaTutor: true
  },
  {
    prompt: 'What is the difference between an isotope and an ion?',
    includes: [/isotope.*same element.*different number of neutrons/is, /ion.*unequal proton and electron counts.*gained or lost/is]
  },
  {
    prompt: 'How many valence electrons does oxygen have?',
    includes: [/Oxygen.*Group 16.*6 valence electrons/i]
  },
  { prompt: 'How many valence electrons does carbon have?', includes: [/Carbon.*Group 14.*4 valence electrons/i] },
  { prompt: 'How many valence electrons does neon have?', includes: [/Neon.*Group 18.*8 valence electrons/i] },
  { prompt: 'How many valence electrons does silicon have?', includes: [/Silicon.*Group 14.*4 valence electrons/i] },
  { prompt: 'How many valence electrons does phosphorus have?', includes: [/Phosphorus.*Group 15.*5 valence electrons/i] },
  { prompt: 'How many valence electrons does an oxygen atom have?', includes: [/Oxygen.*Group 16.*6 valence electrons/i] },
  { prompt: 'How many valence electrons does O have?', includes: [/Oxygen.*Group 16.*6 valence electrons/i] },
  { prompt: 'How many valence electrons does C have?', includes: [/Carbon.*Group 14.*4 valence electrons/i] },
  { prompt: 'How many valence electrons does Si have?', includes: [/Silicon.*Group 14.*4 valence electrons/i] },
  { prompt: 'How many valence electrons does P have?', includes: [/Phosphorus.*Group 15.*5 valence electrons/i] },
  { prompt: 'How many valence electrons does Na have?', includes: [/Sodium.*Group 1.*1 valence electron/i] },
  { prompt: 'How many valence electrons does Cl have?', includes: [/Chlorine.*Group 17.*7 valence electrons/i] },
  { prompt: 'How many valence electrons does Ne have?', includes: [/Neon.*noble gas.*Group 18.*8 valence electrons/i] },
  { prompt: 'How many valence electrons are in a neutral chlorine atom?', includes: [/Chlorine.*Group 17.*7 valence electrons/i] },
  {
    prompt: 'How many electrons does oxygen have?',
    includes: [/Oxygen \(O\).*8 electrons/is]
  },
  {
    prompt: "What is oxygen's atomic number?",
    includes: [/Oxygen \(O\) has atomic number 8/i],
    routeType: 'periodic_table'
  },
  { prompt: 'What charge is a proton?', includes: [/proton.*positive.*nucleus/i] },
  { prompt: 'What is an isotope?', includes: [/same element.*different numbers of neutrons/i] },
  { prompt: 'What is an ion?', includes: [/ion.*charge.*gained or lost electrons/i] }
];

const NO_MATCH_CASES = [
  'How many valence electrons does uranium have?',
  'How many valence electrons does iron have?',
  'How many valence electrons does an oxygen molecule have?',
  'How many valence electrons does molecular oxygen have?',
  'How many valence electrons does the compound sodium chloride have?',
  'How many valence electrons are in a water molecule?',
  'How many valence electrons does oxygen gas O2 have?',
  'How many valence electrons are in H2O?',
  'How many valence electrons are in CO2?',
  'How many valence electrons are in NaCl?',
  'How many valence electrons are in O2?',
  'How many valence electrons are in h2o?',
  'How many valence electrons are in co2?',
  'How many valence electrons are in nacl?',
  'How many valence electrons are in o2?',
  'How many valence electrons does CO2 have?',
  'How many valence electrons does co2 have?',
  'How many valence electrons does NaCl have?',
  'How many valence electrons does nacl have?',
  'How many valence electrons does H2O have?',
  'How many valence electrons does h2o have?',
  'How many valence electrons does O2 have?',
  'How many valence electrons does o2 have?',
  'How many valence electrons are in the formula for oxygen?',
  'How many valence electrons are in the chemical formula for oxygen?',
  'What element, charge, and mass number does a compound with 6 protons, 6 electrons, and 6 neutrons have?',
  'What element, charge, and mass number does a molecule with 6 protons, 6 electrons, and 6 neutrons have?',
  'What element, charge, and mass number does a molecular substance with 6 protons, 6 electrons, and 6 neutrons have?',
  'What element, charge, and mass number does a formula with 6 protons, 6 electrons, and 6 neutrons have?',
  'What element, charge, and mass number does a chemical formula with 6 protons, 6 electrons, and 6 neutrons have?',
  'What element, charge, and mass number does a multi-atom particle with 6 protons, 6 electrons, and 6 neutrons have?',
  'How many valence electrons and protons does oxygen have?',
  'How many valence electrons does oxygen-18 have, and how many neutrons?',
  'How many valence electrons does oxygen have, and what period is it in?',
  'How many valence electrons does oxygen have, and what group is it in?',
  'How many valence electrons does oxygen have, and what charge does it have?'
];

const INVALID_MASS_NUMBER_CONTEXT_CASES = [
  'A molecule has 6 protons and 7 neutrons. What is its mass number?',
  'What is the mass number of a molecular species with 6 protons and 7 neutrons?',
  'A compound has 6 protons and 7 neutrons. What is its mass number?',
  'A formula has 6 protons and 7 neutrons. What is its mass number?',
  'A chemical formula has 6 protons and 7 neutrons. What is its mass number?',
  'A multi-atom particle has 6 protons and 7 neutrons. What is its mass number?'
];

const MIXED_ELEMENT_IDENTITY_CASES = [
  'How many valence electrons does oxygen have, and what element is it?',
  'Which element is this, and how many valence electrons does it have?',
  'How many valence electrons does O have, and identify the element.',
  'Give the element name and number of valence electrons for O.',
  'Give the element symbol and number of valence electrons for oxygen.',
  'Name the element and give the number of valence electrons for O.'
];

const BONDING_ACTION_CASES = [
  'How many valence electrons does oxygen gain to become stable?',
  'How many valence electrons does chlorine need to gain?',
  'How many valence electrons does sodium lose to become stable?'
];

async function main() {
  const isotopeIonComparison = UNIT7_COMPARISON_PAIRS.find((pair) => pair.id === 'unit7.compare.isotope.ion');
  assert.ok(isotopeIonComparison, 'isotope/ion comparison should be registered in the Unit 7 source pack');
  assert.ok(
    isotopeIonComparison.sourceRefs.every((sourceRef) => UNIT7_SOURCE_REFERENCES.includes(sourceRef)),
    'isotope/ion comparison should use only registered Unit 7 source references'
  );

  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);

  for (const testCase of DIRECT_CASES) {
    const route = routeStudentQuestion(testCase.prompt);
    assert.notEqual(route.type, 'no_match', `${testCase.prompt} should route`);
    if (testCase.routeType) assert.equal(route.type, testCase.routeType, `${testCase.prompt} should preserve its route boundary`);
    if (testCase.excludesFormulaTutor) {
      assert.notEqual(route.type, 'science_formula', `${testCase.prompt} must preserve every requested target`);
      assert.equal(route.formulaWork, null, `${testCase.prompt} should use a compound direct answer`);
    }
    const response = await request('POST', '/api/student/message', {
      sessionId: create.body.sessionId,
      studentHubId: `unit7-manual-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'formula_tutor', `${testCase.prompt} should answer directly`);
    for (const pattern of testCase.includes) {
      assert.match(response.body.response, pattern, `${testCase.prompt} should include ${pattern}`);
    }
  }

  for (const prompt of BONDING_ACTION_CASES) {
    const route = routeStudentQuestion(prompt);
    assert.ok(route.toolsUsed.includes('unit8_bonding_knowledge'), `${prompt} should defer to trusted bonding knowledge`);
    assert.doesNotMatch(route.directAnswer, /\b(?:Oxygen|Chlorine|Sodium) is (?:a noble gas )?in Group \d+.*\b\d+ valence electrons?/i);
    const response = await request('POST', '/api/student/message', {
      sessionId: create.body.sessionId,
      studentHubId: `unit7-manual-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.doesNotMatch(response.body.response, /\b(?:Oxygen|Chlorine|Sodium) is (?:a noble gas )?in Group \d+.*\b\d+ valence electrons?/i);
    assert.match(response.body.response, /gain, lose, or share during bonding/i);
  }

  for (const prompt of NO_MATCH_CASES) {
    const route = routeStudentQuestion(prompt);
    assert.equal(route.type, 'no_match', `${prompt} should use the trusted no-match boundary`);
    const response = await request('POST', '/api/student/message', {
      sessionId: create.body.sessionId,
      studentHubId: `unit7-manual-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'no_match', `${prompt} should remain no-match end to end`);
    assert.match(response.body.response, /do not have a trusted local science fact/i);
  }

  for (const prompt of INVALID_MASS_NUMBER_CONTEXT_CASES) {
    const route = routeStudentQuestion(prompt);
    assert.equal(route.type, 'no_match', `${prompt} should reject the invalid atomic context`);
    assert.equal(route.formulaWork, null, `${prompt} must not include Formula Tutor work`);
    const response = await request('POST', '/api/student/message', {
      sessionId: create.body.sessionId,
      studentHubId: `unit7-manual-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'no_match', `${prompt} should remain trusted no-match end to end`);
    assert.notEqual(response.body.routeType, 'formula_tutor', `${prompt} must not start Formula Tutor`);
    assert.match(response.body.response, /do not have a trusted local science fact/i);
  }

  for (const prompt of MIXED_ELEMENT_IDENTITY_CASES) {
    const route = routeStudentQuestion(prompt);
    assert.equal(route.type, 'no_match', `${prompt} must not receive a partial element answer`);
    assert.equal(route.formulaWork, null, `${prompt} must not include Formula Tutor work`);
    assert.doesNotMatch(route.directAnswer, /\b\d+ valence electrons?\b|electrons = protons|electrons in a neutral atom/i);
    const response = await request('POST', '/api/student/message', {
      sessionId: create.body.sessionId,
      studentHubId: `unit7-manual-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'no_match', `${prompt} should remain no-match end to end`);
    assert.doesNotMatch(response.body.response, /\b\d+ valence electrons?\b|electrons = protons|electrons in a neutral atom/i);
  }

  const massOnlyPrompt = 'An atom has 6 protons and 7 neutrons. What is its mass number?';
  const massOnlyRoute = routeStudentQuestion(massOnlyPrompt);
  assert.equal(massOnlyRoute.type, 'science_formula', 'mass-number-only prompt should keep Formula Tutor eligibility');
  assert.equal(massOnlyRoute.formulaWork?.formulaId, 'unit7.mass_number.total');
  const massOnlyResponse = await request('POST', '/api/student/message', {
    sessionId: create.body.sessionId,
    studentHubId: 'unit7-manual-mass-only',
    message: massOnlyPrompt
  });
  assert.equal(massOnlyResponse.body.routeType, 'formula_tutor');

  const ionMassOnlyPrompt = 'An ion has 12 protons and 12 neutrons. What is its mass number?';
  const ionMassOnlyRoute = routeStudentQuestion(ionMassOnlyPrompt);
  assert.equal(ionMassOnlyRoute.type, 'science_formula', 'valid ion mass-number prompt should keep Formula Tutor eligibility');
  assert.equal(ionMassOnlyRoute.formulaWork?.formulaId, 'unit7.mass_number.total');
  const ionMassOnlyResponse = await request('POST', '/api/student/message', {
    sessionId: create.body.sessionId,
    studentHubId: 'unit7-manual-ion-mass-only',
    message: ionMassOnlyPrompt
  });
  assert.equal(ionMassOnlyResponse.body.routeType, 'formula_tutor');

  console.log(`PASS Unit 7 Atomic Structure manual regressions: ${DIRECT_CASES.length} direct prompts, ${NO_MATCH_CASES.length} unsupported boundaries, ${INVALID_MASS_NUMBER_CONTEXT_CASES.length} invalid mass-number contexts, ${MIXED_ELEMENT_IDENTITY_CASES.length} mixed identity boundaries, ${BONDING_ACTION_CASES.length} bonding-action boundaries, and 2 mass-number tutor boundaries`);
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
