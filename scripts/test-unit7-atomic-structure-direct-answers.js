const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');
const {
  UNIT7_ATOMIC_STRUCTURE_METADATA,
  UNIT7_ATOMIC_STRUCTURE_PACKET,
  UNIT7_FACTS
} = require('../lib/knowledge/chemistry/atomicStructure/unit7AtomicStructureKnowledge');

const DIRECT_CASES = [
  // Atomic structure
  { prompt: 'What is an atom?', includes: [/smallest particle/i, /element/i, /properties/i] },
  { prompt: 'What is an element?', includes: [/simplest form of matter/i, /one type of atom/i] },
  { prompt: 'What is the nucleus?', includes: [/dense/i, /positive/i, /protons/i, /neutrons/i] },
  { prompt: 'Where are eletrons in an atom?', includes: [/electron cloud/i, /outside|around/i, /nucleus/i] },

  // Subatomic particles
  { prompt: 'What charge is a protone?', includes: [/proton/i, /positive/i, /nucleus/i] },
  { prompt: 'What charge is a neutron?', includes: [/neutron/i, /neutral/i, /nucleus/i] },
  { prompt: 'What charge is an electron?', includes: [/electron/i, /negative/i, /electron cloud/i] },
  { prompt: 'What are valence electrons?', includes: [/outermost|outer/i, /energy level/i, /bond/i] },
  { prompt: 'What are quarks?', includes: [/quarks/i, /protons/i, /neutrons/i] },

  // Atomic theory/history
  { prompt: 'What did Democritus do with atoms?', includes: [/Democritus/i, /atom/i, /indivisible/i] },
  { prompt: 'What was Dalton atomic model?', includes: [/Dalton/i, /solid spheres/i, /atomic theory/i] },
  { prompt: 'What did ruther ford do?', includes: [/Rutherford/i, /gold foil/i, /nucleus/i] },
  { prompt: 'What is the plum pudding model?', includes: [/Thomson/i, /plum pudding/i, /electrons/i] },
  { prompt: 'Who organized the modern periodic table by atomic number?', includes: [/Moseley/i, /atomic number/i, /modern periodic table/i] },

  // Atomic number / mass number / isotopes
  { prompt: 'What is atomic number?', includes: [/number of protons/i, /identifies/i, /element/i] },
  { prompt: 'What is mass number?', includes: [/protons/i, /neutrons/i, /nucleus/i] },
  { prompt: 'What are isotopes?', includes: [/same element/i, /same number of protons/i, /different numbers of neutrons/i] },
  { prompt: 'What is isotope notation?', includes: [/hyphen notation/i, /nuclear notation/i, /mass number/i] },
  { prompt: 'What is average atomic mass?', includes: [/weighted average/i, /isotopes/i, /most common isotope/i] },

  // Periodic table
  { prompt: 'What is the periodic table?', includes: [/organizes/i, /atomic number/i, /chemical properties/i] },
  { prompt: 'What are groups on the periodic table?', includes: [/vertical columns/i, /valence electrons/i, /similar chemical properties/i] },
  { prompt: 'What are periods on the periodic table?', includes: [/horizontal rows/i, /energy levels/i] },
  { prompt: 'What are the group names on the periodic table?', includes: [/alkali metals/i, /alkaline earth metals/i, /transition metals/i, /halogens/i, /noble gases/i] },
  { prompt: 'Why is hydrogen not an alkali metal?', includes: [/Hydrogen/i, /nonmetal/i, /Group 1/i, /1 valence electron/i] },
  { prompt: 'How many valence electrons does helium have as a noble gas?', includes: [/Helium/i, /noble gas/i, /2 valence electrons/i] },

  // Classification
  { prompt: 'What are metals?', includes: [/shiny/i, /malleable/i, /ductile/i, /good conductors/i] },
  { prompt: 'What are nonmetals?', includes: [/poor conductors/i, /right of the metalloids/i, /hydrogen/i] },
  { prompt: 'What are metaloids?', includes: [/Metalloids/i, /stair-step/i, /semiconductors/i] },
  { prompt: 'Is Te a metalloid?', includes: [/Tellurium/i, /metalloid/i] },
  { prompt: 'Are Al and Na metals?', includes: [/Sodium|Aluminum|metals/i] },
  { prompt: 'Are Ar H and F nonmetals?', includes: [/Argon|hydrogen|fluorine/i, /nonmetals/i] },

  // Bohr models
  { prompt: 'How do you set up a Bohr model?', includes: [/atomic number/i, /protons/i, /neutrons/i, /electrons/i, /energy levels/i] },
  { prompt: 'How many electrons can the first second third and fourth shells hold?', includes: [/2/i, /8/i, /18/i] },
  { prompt: 'What do you do if mass number is missing in a Bohr model?', includes: [/round/i, /average atomic mass/i, /most common isotope/i] },
  { prompt: 'What is the difference between Bohr and electron cloud?', includes: [/fixed/i, /energy levels|orbits/i, /regions of space/i] }
];

async function main() {
  assert.equal(UNIT7_ATOMIC_STRUCTURE_METADATA.unit, 7);
  assert.equal(UNIT7_ATOMIC_STRUCTURE_METADATA.unitTitle, 'Atomic Structure');
  assert.ok(UNIT7_FACTS.length >= 30, 'Unit 7 knowledge pack should expose organized metadata-backed facts');
  assertUnit7PacketShape();

  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of DIRECT_CASES) {
    const route = routeStudentQuestion(testCase.prompt);
    assert.notEqual(route.type, 'no_match', `${testCase.prompt} should not be No Match`);
    if (!testCase.allowsPeriodicTable) {
      assert.match(
        route.public?.toolsUsed?.join(' ') || route.toolsUsed?.join(' ') || '',
        /unit7_atomic_structure_knowledge|local_periodic_table|science_formula_rules/i,
        `${testCase.prompt} should use local Unit 7/periodic data`
      );
    }

    const response = await request('POST', '/api/student/message', {
      sessionId,
      studentHubId: `unit7-direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });

    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should be a direct answer`);
    assert.notEqual(response.body.routeType, 'formula_tutor', `${testCase.prompt} should not start Formula Tutor`);
    assert.notEqual(response.body.routeType, 'no_match', `${testCase.prompt} should not be No Match`);
    for (const pattern of testCase.includes) {
      assert.match(response.body.response, pattern, `${testCase.prompt} should include ${pattern}`);
    }
  }

  console.log(`PASS Unit 7 Atomic Structure direct answers: ${DIRECT_CASES.length} source-backed representative prompts`);
}

function assertUnit7PacketShape() {
  assert.equal(UNIT7_ATOMIC_STRUCTURE_PACKET.packetId, 'unit7-atomic-structure');
  assert.equal(UNIT7_ATOMIC_STRUCTURE_PACKET.unit, 7);
  assert.equal(UNIT7_ATOMIC_STRUCTURE_PACKET.title, 'Atomic Structure');
  assert.ok(Array.isArray(UNIT7_ATOMIC_STRUCTURE_PACKET.sourceFiles), 'Unit 7 packet should expose source files');
  assert.ok(Array.isArray(UNIT7_ATOMIC_STRUCTURE_PACKET.vocabulary), 'Unit 7 packet should expose vocabulary');
  assert.ok(Array.isArray(UNIT7_ATOMIC_STRUCTURE_PACKET.concepts), 'Unit 7 packet should expose concept groups');
  assert.ok(Array.isArray(UNIT7_ATOMIC_STRUCTURE_PACKET.canonicalFacts), 'Unit 7 packet should expose canonical facts');
  assert.ok(Array.isArray(UNIT7_ATOMIC_STRUCTURE_PACKET.comparisons), 'Unit 7 packet should expose comparisons');
  assert.ok(Array.isArray(UNIT7_ATOMIC_STRUCTURE_PACKET.relationships), 'Unit 7 packet should expose relationships');
  assert.ok(Array.isArray(UNIT7_ATOMIC_STRUCTURE_PACKET.referenceFormulas), 'Unit 7 packet should expose formulas/rules');
  assert.equal(UNIT7_ATOMIC_STRUCTURE_PACKET.legacyExports.facts, 'UNIT7_FACTS');
  assert.equal(UNIT7_ATOMIC_STRUCTURE_PACKET.legacyExports.matcher, 'tryUnit7AtomicStructureKnowledge');
  assert.equal(UNIT7_ATOMIC_STRUCTURE_PACKET.counts.canonicalFacts, UNIT7_FACTS.length);
  assert.ok(UNIT7_ATOMIC_STRUCTURE_PACKET.counts.comparisons >= 20);
  assert.ok(UNIT7_ATOMIC_STRUCTURE_PACKET.counts.relationships >= 14);
  assert.ok(UNIT7_ATOMIC_STRUCTURE_PACKET.metadata.sourceBacked);
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
