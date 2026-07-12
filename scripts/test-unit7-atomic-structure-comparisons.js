const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');
const {
  UNIT7_COMPARISON_PAIRS,
  UNIT7_RELATIONSHIP_EDGES,
  UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK
} = require('../lib/knowledge/chemistry/atomicStructure/unit7AtomicStructureKnowledge');

const COMPARISON_CASES = [
  {
    prompt: 'Compare protons, neutrons, and electrons.',
    includes: [/protons/i, /positive/i, /neutrons/i, /neutral/i, /electrons/i, /negative/i]
  },
  {
    prompt: 'What is the difference between atomic number and mass number?',
    includes: [/atomic number/i, /number of protons/i, /identifies the element/i, /mass number/i, /protons plus neutrons/i]
  },
  {
    prompt: 'What is the difference between mass number and average atomic mass?',
    includes: [/mass number/i, /protons plus neutrons/i, /average atomic mass/i, /weighted average/i, /most common isotope/i]
  },
  {
    prompt: 'Compare Bohr model and electron cloud model.',
    includes: [/Bohr model/i, /fixed/i, /electron cloud model/i, /regions of space/i]
  },
  {
    prompt: 'Compare groups and periods.',
    includes: [/groups/i, /vertical columns/i, /valence electrons/i, /periods/i, /horizontal rows/i, /energy levels/i]
  },
  {
    prompt: 'Compare metals and nonmetals.',
    includes: [/metals/i, /shiny|malleable|good conductors/i, /nonmetals/i, /poor conductors/i]
  },
  {
    prompt: 'Compare metals, nonmetals, and metalloids.',
    includes: [/metals/i, /nonmetals/i, /metalloids/i, /stair-step|semiconductors/i]
  },
  {
    prompt: 'What is the difference between Mendeleev and Moseley?',
    includes: [/Mendeleev/i, /atomic mass/i, /predicted missing elements/i, /Moseley/i, /atomic number/i]
  },
  {
    prompt: 'What is the difference between hyphen isotope notation and nuclear notation?',
    includes: [/hyphen/i, /Carbon-13/i, /nuclear notation/i, /13C/i]
  },
  {
    prompt: 'Why is hydrogen not an alkali metal?',
    includes: [/Hydrogen/i, /Group 1/i, /1 valence electron/i, /nonmetal/i, /not classified as an alkali metal|not an alkali metal/i]
  },
  {
    prompt: 'Why is helium different from other noble gases?',
    includes: [/Helium/i, /noble gas/i, /2 valence electrons/i, /other noble gases/i, /8 valence electrons/i]
  },
  {
    prompt: 'How are isotopes of the same element the same and different?',
    includes: [/isotope/i, /same element/i, /same protons/i, /different.*neutrons/i, /different mass numbers/i]
  },
  {
    prompt: 'What is the difference between an isotope and an ion?',
    includes: [/isotope.*same element.*different number of neutrons/is, /ion.*unequal proton and electron counts.*gained or lost/is]
  },
  {
    prompt: 'Explain how an isotope differs from an ion.',
    includes: [/isotope.*same element.*different number of neutrons/is, /ion.*unequal proton and electron counts.*gained or lost/is]
  },
  {
    prompt: 'How does an ion differ from an isotope?',
    includes: [/isotope.*same element.*different number of neutrons/is, /ion.*unequal proton and electron counts.*gained or lost/is]
  }
];

const RELATIONSHIP_CASES = [
  {
    prompt: 'Which number tells the number of protons?',
    includes: [/Atomic number/i, /number of protons/i]
  },
  {
    prompt: 'Which one tells energy levels, group or period?',
    includes: [/Period/i, /energy levels/i]
  }
];

const BOUNDARY_CASES = [
  {
    prompt: 'What is an isotope?',
    routeType: 'definition',
    includes: [/same element/i, /different numbers of neutrons/i]
  },
  {
    prompt: 'What is an ion?',
    routeType: 'definition',
    includes: [/charge/i, /gained or lost electrons/i]
  },
  {
    prompt: 'What is an isotope? I already know what an ion is.',
    routeType: 'definition',
    includes: [/same element/i, /different numbers of neutrons/i]
  },
  {
    prompt: 'Explain why different isotopes have different mass numbers.',
    includes: [/isotope/i, /different numbers of neutrons/i]
  },
  {
    prompt: 'Explain how electron charge differs from mass number.',
    includes: [/electron/i, /negative/i, /electron cloud/i, /mass number/i]
  },
  {
    prompt: 'How many electrons does oxygen have?',
    includes: [/Oxygen \(O\).*8 electrons/is]
  },
  {
    prompt: 'An ion has 17 protons, 18 electrons, and 18 neutrons. What is its element, charge, and mass number?',
    includes: [/Element: Chlorine \(Cl\)/i, /Charge: -1/i, /Mass number: 35/i]
  }
];

async function main() {
  assert.ok(UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK);
  assert.ok(UNIT7_COMPARISON_PAIRS.length >= 20, 'Unit 7 source pack should include broad comparison coverage');
  assert.ok(UNIT7_RELATIONSHIP_EDGES.length >= 14, 'Unit 7 source pack should include relationship edges');

  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of COMPARISON_CASES) {
    const route = routeStudentQuestion(testCase.prompt);
    assert.notEqual(route.type, 'no_match', `${testCase.prompt} should not be No Match`);
    assert.notEqual(route.type, 'science_formula', `${testCase.prompt} should not route to Formula Tutor`);

    const response = await request('POST', '/api/student/message', {
      sessionId,
      studentHubId: `unit7-comparison-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'no_match', `${testCase.prompt} should not be No Match`);
    assert.notEqual(response.body.routeType, 'formula_tutor', `${testCase.prompt} should not start Formula Tutor`);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should be a direct comparison unless it asks from clues`);
    for (const pattern of testCase.includes) {
      assert.match(response.body.response, pattern, `${testCase.prompt} should include ${pattern}`);
    }
  }

  for (const testCase of RELATIONSHIP_CASES) {
    const response = await request('POST', '/api/student/message', {
      sessionId,
      studentHubId: `unit7-relationship-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'no_match', `${testCase.prompt} should not be No Match`);
    assert.notEqual(response.body.routeType, 'formula_tutor', `${testCase.prompt} should not start Formula Tutor`);
    for (const pattern of testCase.includes) {
      assert.match(response.body.response, pattern, `${testCase.prompt} should include ${pattern}`);
    }
  }

  for (const testCase of BOUNDARY_CASES) {
    const route = routeStudentQuestion(testCase.prompt);
    assert.notEqual(route.notes, 'Answered Unit 7 Atomic Structure concept: unit7.compare.isotope.ion.', `${testCase.prompt} should not trigger the isotope/ion comparison`);
    if (testCase.routeType) assert.equal(route.type, testCase.routeType, `${testCase.prompt} should preserve its route type`);

    const response = await request('POST', '/api/student/message', {
      sessionId,
      studentHubId: `unit7-comparison-boundary-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    for (const pattern of testCase.includes) {
      assert.match(response.body.response, pattern, `${testCase.prompt} should include ${pattern}`);
    }
  }

  const conceptPrompt = 'Classify an element that is shiny, malleable, and a good conductor.';
  const conceptStart = await request('POST', '/api/student/message', {
    sessionId,
    studentHubId: 'unit7-comparison-concept-boundary',
    message: conceptPrompt
  });
  assert.equal(conceptStart.statusCode, 200);
  assert.equal(conceptStart.body.routeType, 'concept_tutor', 'clue/reasoning classification should still use Concept Tutor');

  console.log(`PASS Unit 7 Atomic Structure comparisons: ${COMPARISON_CASES.length} comparisons, ${RELATIONSHIP_CASES.length} relationships, ${BOUNDARY_CASES.length} immediate boundaries, and Concept Tutor boundaries`);
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
