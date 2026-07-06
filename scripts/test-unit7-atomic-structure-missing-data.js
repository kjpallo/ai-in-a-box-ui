const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');
const {
  UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK
} = require('../lib/knowledge/chemistry/atomicStructure/unit7AtomicStructureKnowledge');

const DIRECT_CASES = [
  // Visual diagram support converted to text prompts
  { prompt: 'In an atom diagram, what are the green negative particles?', includes: [/electrons/i, /negative/i] },
  { prompt: 'What is the center of an atom diagram?', includes: [/nucleus/i, /center/i] },
  { prompt: 'What is the ring around the nucleus in an atom diagram?', includes: [/shell|energy level/i, /around the nucleus/i] },

  // Element tile interpretation
  { prompt: 'Which part of an element tile is the atomic number?', includes: [/atomic number/i, /protons/i] },
  { prompt: 'Which part of an element tile is the symbol?', includes: [/symbol/i, /one- or two-letter abbreviation/i] },
  { prompt: 'Which part of an element tile is the element name?', includes: [/element name/i, /written name/i] },
  { prompt: 'Which part of an element tile is the atomic mass?', includes: [/atomic mass/i, /decimal/i, /round/i] },
  { prompt: 'How many protons does nitrogen have from a tile?', includes: [/Nitrogen/i, /atomic number 7/i, /7 protons/i] },
  { prompt: 'How many protons does gold have from a tile?', includes: [/Gold/i, /atomic number 79/i, /79 protons/i] },
  { prompt: 'How many protons does beryllium have from a tile?', includes: [/Beryllium/i, /atomic number 4/i, /4 protons/i] },
  { prompt: 'How many protons does magnesium have from a tile?', includes: [/Magnesium/i, /atomic number 12/i, /12 protons/i] },
  { prompt: 'How many protons does sodium have from a tile?', includes: [/Sodium/i, /atomic number 11/i, /11 protons/i] },

  // Honors/open-response concept answers
  { prompt: 'What are three forces holding an atom together?', includes: [/positive nucleus/i, /negative electron cloud/i, /electron-electron repulsion/i, /proton-proton repulsion/i] },
  { prompt: 'Where are mass and volume in an atom?', includes: [/mass/i, /nucleus/i, /volume/i, /electron cloud/i] },
  { prompt: 'Why is the nucleus positive and the electron cloud negative?', includes: [/nucleus is positive/i, /protons/i, /electron cloud is negative/i, /electrons/i] },
  { prompt: 'Which particles are in the nucleus?', includes: [/Protons and neutrons/i, /nucleus/i] },
  { prompt: 'Why are electrons not counted in mass number?', includes: [/Electrons/i, /not counted/i, /mass number/i, /very small/i] },
  { prompt: 'What do quarks make up?', includes: [/Quarks/i, /protons/i, /neutrons/i] },
  { prompt: 'Why do valence electrons have the most energy?', includes: [/Valence electrons/i, /outermost energy level/i, /most energy/i] },

  // Periodic table clue coverage
  { prompt: 'What does a group tell on the periodic table?', includes: [/group/i, /valence electrons/i] },
  { prompt: 'What does a period tell on the periodic table?', includes: [/period/i, /energy levels/i] },
  { prompt: 'Why are group 1 alkali metals reactive except hydrogen?', includes: [/Group 1/i, /most reactive metals/i, /Hydrogen/i, /not.*alkali metal/i] },
  { prompt: 'Why are group 17 halogens important?', includes: [/Group 17/i, /most reactive nonmetals/i] },
  { prompt: 'Why are group 18 noble gases stable?', includes: [/Group 18/i, /stable|nonreactive/i] },
  { prompt: 'Why does helium have 2 valence electrons as a noble gas?', includes: [/Helium/i, /2 valence electrons/i, /noble gas/i] },
  { prompt: 'Where are metalloids and what do they do?', includes: [/stair-step/i, /semiconductors/i] },
  { prompt: 'Where are metals and what are their properties?', includes: [/left of the metalloids/i, /good conductors/i, /malleable/i, /ductile/i] },
  { prompt: 'Where are nonmetals and what are their properties?', includes: [/right of the metalloids/i, /hydrogen/i, /poor conductors/i, /dull brittle|gases/i] },

  // Atomic history timeline
  { prompt: 'What did Democritus say about atoms?', includes: [/Democritus/i, /atomos/i, /indivisible/i] },
  { prompt: 'What was Dalton atomic theory model?', includes: [/Dalton/i, /solid spheres/i, /atomic theory/i] },
  { prompt: 'What did Mendeleev do for the periodic table?', includes: [/Mendeleev/i, /atomic mass/i, /predicted missing elements/i] },
  { prompt: 'What did Thomson discover about atoms?', includes: [/Thomson/i, /electrons/i, /plum pudding/i, /divisible/i] },
  { prompt: 'What did Rutherford gold foil show?', includes: [/Rutherford/i, /gold foil/i, /nucleus/i] },
  { prompt: 'What did Moseley show about atomic number?', includes: [/Moseley/i, /atomic number/i, /protons/i, /modern periodic table/i] },
  { prompt: 'What did Bohr add to the atom model?', includes: [/Bohr/i, /fixed orbits|energy levels/i] },
  { prompt: 'What did Schrodinger and Heisenberg add?', includes: [/Schrodinger/i, /Heisenberg/i, /electron cloud/i, /not fixed/i] },
  { prompt: 'What did Chadwick discover?', includes: [/Chadwick/i, /neutron/i] }
];

const FORMULA_CASES = [
  { prompt: 'Potassium mass 39, 19 protons, how many neutrons?', includes: [/Neutrons = 20/i], formulaId: /unit7\.mass_number\.neutrons/i },
  { prompt: 'Phosphorus 15 protons, 16 neutrons, what is mass number?', includes: [/Mass number = 31/i], formulaId: /unit7\.mass_number\.total/i },
  { prompt: 'Mass number 11 and atomic number 5, how many neutrons?', includes: [/Neutrons = 6/i], formulaId: /unit7\.mass_number\.neutrons/i },
  { prompt: 'Sodium-23 with atomic number 11, how many neutrons?', includes: [/Neutrons = 12/i], formulaId: /unit7\.mass_number\.neutrons/i },
  { prompt: 'How many neutrons does Lithium-7 have?', includes: [/Neutrons = 4/i], formulaId: /unit7\.mass_number\.neutrons/i },
  { prompt: 'A nucleus with 3 protons has what atomic number?', includes: [/Atomic number = 3/i], formulaId: /unit7\.atomic_number\.from_protons/i },
  { prompt: 'An atom with 9 protons has what atomic number?', includes: [/Atomic number = 9/i], formulaId: /unit7\.atomic_number\.from_protons/i },
  { prompt: 'What is atomic number if oxygen has 8 protons?', includes: [/Atomic number = 8/i], formulaId: /unit7\.atomic_number\.from_protons/i },
  { prompt: 'If atomic number is 50, how many electrons in a neutral atom?', includes: [/Electrons = 50/i], formulaId: /unit7\.atomic_number\.neutral_electrons/i }
];

const CONCEPT_CASES = [
  {
    prompt: 'Which clue points to a group: same valence electrons or same energy levels?',
    choice: '3',
    final: /valence electrons|same group/i
  },
  {
    prompt: 'Classify an element that is shiny, malleable, and a good conductor.',
    choice: '1',
    final: /metal/i
  }
];

async function main() {
  assert.ok(UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK.visualDiagramFacts.length >= 3);
  assert.ok(UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK.elementTileFields.length >= 4);
  assert.ok(UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK.openResponseFacts.length >= 7);

  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of DIRECT_CASES) {
    const response = await ask(request, sessionId, `unit7-missing-direct-${slug(testCase.prompt)}`, testCase.prompt);
    assert.notEqual(response.routeType, 'no_match', `${testCase.prompt} should not be No Match`);
    assert.notEqual(response.routeType, 'formula_tutor', `${testCase.prompt} should be Direct Answer, not Formula Tutor`);
    assert.notEqual(response.routeType, 'concept_tutor', `${testCase.prompt} should be Direct Answer, not Concept Tutor`);
    for (const pattern of testCase.includes) {
      assert.match(response.response, pattern, `${testCase.prompt} should include ${pattern}`);
    }
  }

  for (const testCase of FORMULA_CASES) {
    const route = routeStudentQuestion(testCase.prompt);
    assert.equal(route.type, 'science_formula', `${testCase.prompt} should route as science formula`);
    assert.match(route.formulaWork?.formulaId || '', testCase.formulaId, `${testCase.prompt} formula id`);
    for (const pattern of testCase.includes) {
      assert.match(route.directAnswer, pattern, `${testCase.prompt} should include ${pattern}`);
    }

    const response = await ask(request, sessionId, `unit7-missing-formula-${slug(testCase.prompt)}`, testCase.prompt);
    assert.equal(response.routeType, 'formula_tutor', `${testCase.prompt} should start Formula Tutor`);
    assert.match(response.tutor?.formulaId || '', testCase.formulaId);
  }

  for (const testCase of CONCEPT_CASES) {
    const studentHubId = `unit7-missing-concept-${slug(testCase.prompt)}`;
    const start = await ask(request, sessionId, studentHubId, testCase.prompt);
    assert.equal(start.routeType, 'concept_tutor', `${testCase.prompt} should route to Concept Tutor`);
    const complete = await ask(request, sessionId, studentHubId, testCase.choice);
    assert.equal(complete.tutor?.completed, true);
    assert.match(complete.response, testCase.final);
  }

  const density = await ask(request, sessionId, 'unit7-missing-boundary-density', 'Calculate density if mass is 10 g and volume is 5 mL.');
  assert.equal(density.routeType, 'formula_tutor');
  assert.match(density.response, /density/i);

  console.log(`PASS Unit 7 Atomic Structure missing-data coverage: ${DIRECT_CASES.length} direct, ${FORMULA_CASES.length} formula, ${CONCEPT_CASES.length} Concept Tutor prompts`);
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
