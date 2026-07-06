const assert = require('node:assert/strict');

const {
  buildUnit7AtomicStructureConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const CONCEPT_CASES = [
  {
    prompt: 'Why do elements in the same group act similar?',
    tutorId: 'unit7.periodic_table.clue.identification',
    clue: /Which periodic table idea does the clue point to\?/i,
    choice: '3',
    final: /same group.*valence electrons|valence electrons.*similar properties/i
  },
  {
    prompt: 'If elements are in the same period, what clue is that: group, period, valence electrons, or energy levels?',
    tutorId: 'unit7.periodic_table.clue.identification',
    clue: /Which periodic table idea/i,
    choice: '4',
    final: /period.*same number of electron shells|energy levels/i
  },
  {
    prompt: 'A clue says the proton count identifies the element. Is that group, period, or atomic number?',
    tutorId: 'unit7.periodic_table.clue.identification',
    clue: /Which periodic table idea/i,
    choice: '5',
    final: /atomic number.*proton count.*identifies/i
  },
  {
    prompt: 'Which model has electrons in fixed orbits?',
    tutorId: 'unit7.atomic_models.identification',
    clue: /Which atomic model matches the evidence\?/i,
    choice: '1',
    final: /Bohr model.*fixed orbits|fixed.*energy levels/i
  },
  {
    prompt: 'Which atomic model says electrons are in regions of space and not fixed paths?',
    tutorId: 'unit7.atomic_models.identification',
    clue: /Which atomic model matches the evidence\?/i,
    choice: '2',
    final: /electron cloud model.*regions of space/i
  },
  {
    prompt: 'Which clue shows isotopes: same protons and different neutrons?',
    tutorId: 'unit7.isotopes.sameness.identification',
    clue: /Which clue shows that atoms are isotopes\?/i,
    choice: '1',
    final: /isotopes.*same number of protons.*different numbers of neutrons/i
  },
  {
    prompt: 'Classify an element that is shiny, malleable, and a good conductor.',
    tutorId: 'unit7.element_classification.identification',
    clue: /Which element classification best matches the clue\?/i,
    choice: '1',
    final: /metal.*properties|metal side/i
  },
  {
    prompt: 'Classify an element that is a poor conductor and brittle.',
    tutorId: 'unit7.element_classification.identification',
    clue: /Which element classification best matches the clue\?/i,
    choice: '2',
    final: /nonmetal.*properties|nonmetal side/i
  },
  {
    prompt: 'Classify an element near the stair step that is a semiconductor.',
    tutorId: 'unit7.element_classification.identification',
    clue: /Which element classification best matches the clue\?/i,
    choice: '3',
    final: /metalloid.*stair-step|semiconductor/i
  }
];

const DIRECT_BOUNDARIES = [
  'What is an isotope?',
  'What is a Bohr model?',
  'What are metalloids?'
];

const FORMULA_BOUNDARIES = [
  'how many nuetrons in sodium 23',
  'neutral atom atomic number 50 how many electrons'
];

async function main() {
  assert.ok(
    buildUnit7AtomicStructureConceptTutorPattern('Why do elements in the same group act similar?'),
    'same-group reasoning should build Unit 7 Concept Tutor pattern'
  );
  assert.equal(
    buildUnit7AtomicStructureConceptTutorPattern('What is an isotope?'),
    null,
    'definition-only Unit 7 prompts should not build Concept Tutor patterns'
  );

  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of CONCEPT_CASES) {
    const studentHubId = `unit7-concept-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId,
      studentHubId,
      message: testCase.prompt
    });
    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, testCase.tutorId);
    assert.equal(start.body.tutor.active, true);
    assert.match(start.body.response, testCase.clue);
    assert.match(start.body.response, /Choose one:/i);
    assert.match(start.body.response, /1\.\s+/);
    assert.match(start.body.response, /2\.\s+/);

    const complete = await request('POST', '/api/student/message', {
      sessionId,
      studentHubId,
      message: testCase.choice
    });
    assert.equal(complete.statusCode, 200);
    assert.equal(complete.body.routeType, 'concept_tutor');
    assert.equal(complete.body.tutor.completed, true);
    assert.match(complete.body.response, testCase.final);
  }

  for (const prompt of DIRECT_BOUNDARIES) {
    const response = await request('POST', '/api/student/message', {
      sessionId,
      studentHubId: `unit7-concept-direct-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${prompt} should stay Direct Answer`);
    assert.notEqual(response.body.routeType, 'formula_tutor');
  }

  for (const prompt of FORMULA_BOUNDARIES) {
    const response = await request('POST', '/api/student/message', {
      sessionId,
      studentHubId: `unit7-concept-formula-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'formula_tutor', `${prompt} should stay Formula Tutor`);
  }

  console.log(`PASS Unit 7 Atomic Structure Concept Tutor: ${CONCEPT_CASES.length} reasoning/classification prompts and boundaries`);
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
