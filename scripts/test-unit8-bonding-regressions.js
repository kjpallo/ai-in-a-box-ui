const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const {
  UNIT8_BONDING_METADATA,
  UNIT8_BONDING_PACKET,
  UNIT8_BONDING_FACTS,
  UNIT8_BONDING_VOCABULARY,
  tryUnit8BondingKnowledge
} = require('../lib/knowledge/chemistry/bonding/unit8BondingKnowledge');

const DIRECT_CASES = [
  {
    prompt: 'Why do elements form compounds?',
    includes: [/more stable/i, /valence electrons/i]
  },
  {
    prompt: 'What is the octet rule?',
    includes: [/gain, lose, or share electrons/i, /8 electrons/i, /Hydrogen and helium/i]
  },
  {
    prompt: 'What does a chemical formula tell you?',
    includes: [/what elements are present/i, /how many atoms/i, /H2O/i, /NH3/i]
  },
  {
    prompt: 'How do you write an ionic formula?',
    includes: [/ions with charges/i, /total charge zero/i, /crisscross/i, /reduce or simplify/i]
  },
  {
    prompt: 'What is the polyatomic ion rule?',
    includes: [/Keep a polyatomic ion together/i, /parentheses/i, /do not change anything inside/i]
  },
  {
    prompt: 'What is aluminum carbonate formula?',
    includes: [/aluminum carbonate -> Al2\(CO3\)3/i]
  },
  {
    prompt: 'What is Fe2O3 called?',
    includes: [/Fe2O3 is iron\(III\) oxide/i]
  },
  {
    prompt: 'What is CO2 called in covalent naming?',
    includes: [/CO2 is carbon dioxide/i]
  },
  {
    prompt: 'What is the formula for trisulfur dinitride?',
    includes: [/trisulfur dinitride -> S3N2/i]
  },
  {
    prompt: 'What does tetra mean in covalent naming?',
    includes: [/tetra = 4/i]
  },
  {
    prompt: 'What is the difference between ionic and covalent bonds?',
    includes: [/Ionic bonds form when electrons are transferred/i, /Covalent bonds form when nonmetal atoms share electrons/i]
  },
  {
    prompt: 'How does O2 form a double bond?',
    includes: [/O2 forms a covalent double bond/i, /sharing 4 electrons/i]
  }
];

const UNIT6_MATTER_BOUNDARY_CASES = [
  {
    prompt: 'what is a compound',
    includes: [/fixed proportion/i]
  },
  {
    prompt: 'what is the difference between an element and a compound',
    includes: [/one type of atom/i, /fixed proportion/i]
  },
  {
    prompt: 'element vs compound',
    includes: [/one type of atom/i, /two or more different elements/i]
  },
  {
    prompt: 'compound definition',
    includes: [/fixed proportion/i]
  }
];

function main() {
  assert.equal(UNIT8_BONDING_METADATA.unit, 8);
  assert.match(
    UNIT8_BONDING_METADATA.sourceUnitNumberBasis,
    /source filename "8 Packet - Bonding Honors - Filled\.pdf"/,
    'Unit 8 number basis should be documented from the source filename'
  );
  assertUnit8PacketShape();

  for (const testCase of DIRECT_CASES) {
    const direct = tryUnit8BondingKnowledge(testCase.prompt);
    assert.ok(direct, `${testCase.prompt} should match direct Unit 8 bonding knowledge`);
    assert.deepEqual(direct.toolsUsed, ['unit8_bonding_knowledge']);
    assert.equal(direct.aiAllowed, false);
    for (const pattern of testCase.includes) {
      assert.match(direct.directAnswer, pattern, `${testCase.prompt} direct matcher should include ${pattern}`);
    }

    const route = routeStudentQuestion(testCase.prompt);
    assert.notEqual(route.type, 'no_match', `${testCase.prompt} should not be No Match`);
    assert.match(
      route.public?.toolsUsed?.join(' ') || route.toolsUsed?.join(' ') || '',
      /unit8_bonding_knowledge/i,
      `${testCase.prompt} should route through Unit 8 bonding knowledge`
    );
    for (const pattern of testCase.includes) {
      assert.match(route.directAnswer, pattern, `${testCase.prompt} route should include ${pattern}`);
    }
  }

  for (const testCase of UNIT6_MATTER_BOUNDARY_CASES) {
    const direct = tryUnit8BondingKnowledge(testCase.prompt);
    assert.equal(direct, null, `${testCase.prompt} should not be claimed by Unit 8 bonding`);

    const route = routeStudentQuestion(testCase.prompt);
    const tools = route.public?.toolsUsed?.join(' ') || route.toolsUsed?.join(' ') || '';
    assert.doesNotMatch(tools, /unit8_bonding_knowledge/i, `${testCase.prompt} should not route through Unit 8 bonding`);
    assert.match(tools, /unit6_matter_knowledge/i, `${testCase.prompt} should route through Unit 6 matter knowledge`);
    for (const pattern of testCase.includes) {
      assert.match(route.directAnswer, pattern, `${testCase.prompt} route should include ${pattern}`);
    }
  }

  const unit7Route = routeStudentQuestion('What is atomic number?');
  assert.match(
    unit7Route.public?.toolsUsed?.join(' ') || unit7Route.toolsUsed?.join(' ') || '',
    /unit7_atomic_structure_knowledge/i,
    'Atomic-structure questions should still route to Unit 7 before Bonding'
  );

  const h2oRoute = routeStudentQuestion('What is H2O?');
  assert.equal(h2oRoute.type, 'chemistry_formula', 'Plain formula lookups should still use the existing chemistry formula route');
  assert.doesNotMatch(
    h2oRoute.public?.toolsUsed?.join(' ') || h2oRoute.toolsUsed?.join(' ') || '',
    /unit8_bonding_knowledge/i,
    'Plain H2O lookup should not be claimed by Unit 8 bonding'
  );

  console.log(`PASS Unit 8 Bonding regressions: ${DIRECT_CASES.length} source-grounded representative prompts; ${UNIT6_MATTER_BOUNDARY_CASES.length} Unit 6 boundary prompts`);
}

function assertUnit8PacketShape() {
  assert.equal(UNIT8_BONDING_PACKET.packetId, 'unit8-bonding');
  assert.equal(UNIT8_BONDING_PACKET.unit, 8);
  assert.equal(UNIT8_BONDING_PACKET.title, 'Bonding');
  assert.equal(UNIT8_BONDING_PACKET.metadata.sourceBacked, true);
  assert.ok(Array.isArray(UNIT8_BONDING_PACKET.sourceFiles), 'Unit 8 packet should expose source files');
  assert.ok(UNIT8_BONDING_PACKET.sourceFiles.includes('8 Packet - Bonding Honors - Filled.pdf'));
  assert.ok(Array.isArray(UNIT8_BONDING_PACKET.vocabulary), 'Unit 8 packet should expose vocabulary');
  assert.ok(Array.isArray(UNIT8_BONDING_PACKET.concepts), 'Unit 8 packet should expose concepts');
  assert.ok(Array.isArray(UNIT8_BONDING_PACKET.canonicalFacts), 'Unit 8 packet should expose canonical facts');
  assert.ok(Array.isArray(UNIT8_BONDING_PACKET.comparisons), 'Unit 8 packet should expose comparisons');
  assert.ok(Array.isArray(UNIT8_BONDING_PACKET.relationships), 'Unit 8 packet should expose relationships');
  assert.ok(Array.isArray(UNIT8_BONDING_PACKET.referenceFormulas), 'Unit 8 packet should expose formula/rule metadata');
  assert.ok(Array.isArray(UNIT8_BONDING_PACKET.examples), 'Unit 8 packet should expose examples');
  assert.ok(Array.isArray(UNIT8_BONDING_PACKET.smokeTests), 'Unit 8 packet should expose smoke tests');
  assert.equal(UNIT8_BONDING_PACKET.legacyExports.facts, 'UNIT8_BONDING_FACTS');
  assert.equal(UNIT8_BONDING_PACKET.legacyExports.matcher, 'tryUnit8BondingKnowledge');
  assert.equal(UNIT8_BONDING_PACKET.counts.canonicalFacts, UNIT8_BONDING_FACTS.length);
  assert.equal(UNIT8_BONDING_PACKET.counts.vocabulary, UNIT8_BONDING_VOCABULARY.length);
  assert.ok(UNIT8_BONDING_PACKET.counts.comparisons >= 5);
  assert.ok(UNIT8_BONDING_PACKET.counts.relationships >= 8);
  assert.ok(UNIT8_BONDING_PACKET.counts.referenceFormulas >= 4);
}

main();
