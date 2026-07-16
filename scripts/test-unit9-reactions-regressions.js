const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const {
  UNIT9_REACTIONS_METADATA,
  UNIT9_REACTIONS_PACKET,
  UNIT9_REACTIONS_FACTS,
  UNIT9_REACTIONS_VOCABULARY,
  UNIT9_REACTIONS_EXAMPLES,
  tryUnit9ReactionsKnowledge
} = require('../lib/knowledge/chemistry/reactions/unit9ReactionsKnowledge');

const DIRECT_CASES = [
  { prompt: 'Define reactant and product.', includes: [/Reactants are the starting substances/i, /Products are the substances made/i] },
  { prompt: 'Define coefficient and subscript.', includes: [/coefficient is placed in front/i, /subscript is part of a formula/i] },
  { prompt: 'Why can coefficients change but subscripts cannot?', includes: [/change coefficients/i, /cannot change subscripts/i, /change the substance/i] },
  { prompt: 'What does (aq) mean?', includes: [/Aqueous/i, /dissolved in water/i] },
  { prompt: 'How does conservation of mass apply to a chemical reaction?', includes: [/matter is not created or destroyed/i, /total mass of reactants equals/i] },
  { prompt: 'What is evidence of chemical change?', includes: [/color change/i, /gas production/i, /precipitate/i] },
  { prompt: 'Define synthesis, decomposition, combustion, single replacement, and double replacement.', includes: [/synthesis reaction combines/i, /decomposition reaction breaks/i, /combustion reaction/i, /single replacement/i, /double replacement/i] },
  { prompt: 'Define precipitate.', includes: [/solid that forms/i, /solutions/i] },
  { prompt: 'Explain reaction rate.', includes: [/how fast reactants change into products/i] },
  { prompt: 'How do temperature, concentration, surface area, catalyst, and pressure affect reaction rate?', includes: [/Temperature, concentration, surface area, and catalysts/i, /Pressure affects rate for gases/i] },
  { prompt: 'Define exergonic vs exothermic.', includes: [/Exergonic means/i, /releases energy overall/i, /Exothermic means/i, /releases heat/i] },
  { prompt: 'Define endergonic vs endothermic.', includes: [/Endergonic means/i, /absorbs energy overall/i, /Endothermic means/i, /absorbs heat/i] },
  { prompt: 'What happens to the surroundings during an exothermic process?', includes: [/exothermic process/i, /releases thermal energy to the surroundings/i], excludes: [/\breaction\b/i, /usually become warmer/i] },
  { prompt: 'What happens to the surroundings during an endothermic process?', includes: [/endothermic process/i, /absorbs thermal energy from the surroundings/i], excludes: [/\breaction\b/i, /usually become cooler/i] },
  { prompt: 'What happens to the surroundings during an exothermic reaction?', includes: [/release(?:s)? thermal energy to the surroundings/i, /surroundings gain thermal energy/i, /usually become warmer/i] },
  { prompt: 'What happens to the surroundings during an endothermic reaction?', includes: [/absorb(?:s)? thermal energy from the surroundings/i, /surroundings lose thermal energy/i, /usually become cooler/i] },
  { prompt: 'Heat flows from the reacting chemicals into the surrounding air. Classify the reaction and explain what happens to the air.', includes: [/exothermic reaction/i, /air gains thermal energy/i, /usually becomes warmer/i] },
  { prompt: 'Define acid.', includes: [/produces hydrogen ions/i, /pH below 7/i] },
  { prompt: 'Define base.', includes: [/produces hydroxide ions/i, /pH above 7/i] },
  { prompt: 'Define electrolyte.', includes: [/conducts electricity/i, /dissolved in water/i] },
  { prompt: 'What does pH measure?', includes: [/hydrogen ion concentration/i, /acidic/i, /basic/i] },
  { prompt: 'Low pH means what?', includes: [/acidic/i, /high hydrogen ion concentration/i] },
  { prompt: 'High pH means what?', includes: [/basic/i, /high hydroxide ion concentration/i] },
  { prompt: 'What are the products of neutralization?', includes: [/salt and water/i] },
  { prompt: 'Explain litmus paper red blue meaning.', includes: [/blue litmus paper red/i, /red litmus paper blue/i] },
  { prompt: 'Define nuclear chemistry.', includes: [/changes in the nucleus/i] },
  { prompt: 'Define radioactivity, radiation, and radioactive decay.', includes: [/unstable nuclei releasing radiation/i, /energy or particles released/i, /unstable nucleus changes/i] },
  { prompt: 'In radioactive decay, define alpha, beta, and gamma radiation.', includes: [/2 protons and 2 neutrons/i, /beta particle/i, /electromagnetic energy/i] },
  { prompt: 'Compare fission and fusion.', includes: [/Fusion combines lighter atoms/i, /stars/i, /Fission splits a larger atom/i, /nuclear power plants/i] },
  { prompt: 'Explain medical reactor weapons uses of nuclear chemistry.', includes: [/medical imaging/i, /nuclear reactors/i, /historical and social-impact topic/i] }
];

const GROUNDED_EXAMPLES = [
  { prompt: 'Balance H2 + O2 -> H2O.', includes: [/2H2 \+ O2 -> 2H2O/i] },
  { prompt: 'Balance Al + O2 -> Al2O3.', includes: [/4Al \+ 3O2 -> 2Al2O3/i] },
  { prompt: 'How many oxygen atoms are in 2Ca(NO3)2?', includes: [/12 oxygen atoms/i] },
  { prompt: 'Zn + 2HCl -> ZnCl2 + H2, 65 g + 72 g -> 135 g + ? g', includes: [/2 g/i] },
  { prompt: 'Balance and classify LiCl + Br2 -> LiBr + Cl2.', includes: [/2LiCl \+ Br2 -> 2LiBr \+ Cl2/i, /single replacement/i] },
  { prompt: 'Classify 2KClO3 -> 2KCl + 3O2.', includes: [/decomposition/i] },
  { prompt: 'Classify 2N2 + 5O2 -> 2N2O5.', includes: [/synthesis/i] },
  { prompt: 'Complete and balance C3H8 + O2 -> ?', includes: [/C3H8 \+ 5O2 -> 3CO2 \+ 4H2O/i, /combustion/i] },
  { prompt: '3Ca(OH)2 + 2H3PO4 -> Ca3(PO4)2 + 6H2O classify this.', includes: [/double replacement/i, /neutralization/i] },
  { prompt: 'What does a catalyst do?', includes: [/speeds up/i, /lowering activation energy/i, /not changed/i] },
  { prompt: 'Which rate factor only applies to gases in the notes?', includes: [/Pressure/i, /gases/i] },
  { prompt: 'In radioactive decay, what type of radiation releases electromagnetic energy?', includes: [/Gamma radiation/i, /electromagnetic energy/i] },
  { prompt: 'What is alpha radiation?', includes: [/2 protons and 2 neutrons/i] },
  { prompt: 'Nuclear fusion vs fission?', includes: [/Fusion combines lighter atoms/i, /Fission splits a larger atom/i] }
];

const BOUNDARY_CASES = [
  {
    prompt: 'What is aluminum carbonate formula?',
    expectedTool: /unit8_bonding_knowledge/i,
    blockedTool: /unit9_reactions_knowledge/i,
    includes: [/Al2\(CO3\)3/i]
  },
  {
    prompt: 'What is atomic number?',
    expectedTool: /unit7_atomic_structure_knowledge/i,
    blockedTool: /unit9_reactions_knowledge/i,
    includes: [/number of protons/i]
  },
  {
    prompt: 'What is a compound?',
    expectedTool: /unit6_matter_knowledge/i,
    blockedTool: /unit9_reactions_knowledge/i,
    includes: [/fixed proportion/i]
  },
  {
    prompt: 'What type of energy is stored in food?',
    expectedTool: /unit3_energy_knowledge/i,
    blockedTool: /unit9_reactions_knowledge/i,
    includes: [/chemical energy/i]
  },
  {
    prompt: 'what does conservation of mass mean',
    expectedTool: /unit6_matter_knowledge/i,
    blockedTool: /unit9_reactions_knowledge/i,
    includes: [/conservation of mass|conservation of matter/i, /not created/i, /not destroyed/i]
  },
  {
    prompt: 'why is the mass of rust equal to iron plus oxygen before the reaction in a closed system',
    expectedTool: /unit6_matter_knowledge/i,
    blockedTool: /unit9_reactions_knowledge/i,
    includes: [/rust/i, /iron/i, /oxygen/i, /closed system/i, /conservation|conserved/i]
  },
  {
    prompt: 'what is heat of fusion',
    expectedTool: /unit6_matter_knowledge/i,
    blockedTool: /unit9_reactions_knowledge/i,
    includes: [/heat of fusion/i, /solid/i, /liquid/i]
  },
  {
    prompt: 'What type of EM radiation is used for cooking, Doppler radar, GPS, and mobile phone signals?',
    expectedTool: /unit5_waves_knowledge/i,
    blockedTool: /unit9_reactions_knowledge/i,
    includes: [/microwave/i]
  },
  {
    prompt: 'What are gamma rays used for?',
    expectedTool: /unit5_waves_knowledge/i,
    blockedTool: /unit9_reactions_knowledge/i,
    includes: [/cancer cells|sterilize|tracers/i, /dangerous|damage/i]
  }
];

function main() {
  assertUnit9PacketShape();
  assertNoStudentFacingHonorsNames();

  for (const testCase of [...DIRECT_CASES, ...GROUNDED_EXAMPLES]) {
    assertDirectAndRouted(testCase);
  }

  for (const testCase of BOUNDARY_CASES) {
    const direct = tryUnit9ReactionsKnowledge(testCase.prompt);
    assert.equal(direct, null, `${testCase.prompt} should not be claimed by Unit 9 Reactions`);

    const route = routeStudentQuestion(testCase.prompt);
    const tools = route.public?.toolsUsed?.join(' ') || route.toolsUsed?.join(' ') || '';
    assert.match(tools, testCase.expectedTool, `${testCase.prompt} should route to the expected owning unit`);
    assert.doesNotMatch(tools, testCase.blockedTool, `${testCase.prompt} should not route through Unit 9 Reactions`);
    for (const pattern of testCase.includes) {
      assert.match(route.directAnswer, pattern, `${testCase.prompt} route should include ${pattern}`);
    }
  }

  const fissionRoute = routeStudentQuestion('Classify nuclear fission and fusion as synthesis or decomposition.');
  assert.match(
    fissionRoute.public?.toolsUsed?.join(' ') || fissionRoute.toolsUsed?.join(' ') || '',
    /unit9_reactions_knowledge/i,
    'Nuclear fission/fusion prompts should stay in Unit 9 Reactions'
  );
  assert.match(fissionRoute.directAnswer, /Fusion combines lighter atoms/i);
  assert.doesNotMatch(fissionRoute.directAnswer, /synthesis reaction combines simpler substances/i);

  console.log(`PASS Unit 9 Reactions regressions: ${DIRECT_CASES.length} direct prompts; ${GROUNDED_EXAMPLES.length} grounded examples; ${BOUNDARY_CASES.length} boundary prompts`);
}

function assertDirectAndRouted(testCase) {
  const direct = tryUnit9ReactionsKnowledge(testCase.prompt);
  assert.ok(direct, `${testCase.prompt} should match direct Unit 9 Reactions knowledge`);
  assert.deepEqual(direct.toolsUsed, ['unit9_reactions_knowledge']);
  assert.equal(direct.aiAllowed, false);
  for (const pattern of testCase.includes) {
    assert.match(direct.directAnswer, pattern, `${testCase.prompt} direct matcher should include ${pattern}`);
  }
  for (const pattern of testCase.excludes || []) {
    assert.doesNotMatch(direct.directAnswer, pattern, `${testCase.prompt} direct matcher should not include ${pattern}`);
  }

  const route = routeStudentQuestion(testCase.prompt);
  assert.notEqual(route.type, 'no_match', `${testCase.prompt} should not be No Match`);
  assert.match(
    route.public?.toolsUsed?.join(' ') || route.toolsUsed?.join(' ') || '',
    /unit9_reactions_knowledge/i,
    `${testCase.prompt} should route through Unit 9 Reactions knowledge`
  );
  for (const pattern of testCase.includes) {
    assert.match(route.directAnswer, pattern, `${testCase.prompt} route should include ${pattern}`);
  }
  for (const pattern of testCase.excludes || []) {
    assert.doesNotMatch(route.directAnswer, pattern, `${testCase.prompt} route should not include ${pattern}`);
  }
}

function assertUnit9PacketShape() {
  assert.equal(UNIT9_REACTIONS_METADATA.unit, 9);
  assert.equal(UNIT9_REACTIONS_METADATA.unitTitle, 'Unit 9 Reactions');
  assert.equal(UNIT9_REACTIONS_PACKET.packetId, 'unit9-reactions');
  assert.equal(UNIT9_REACTIONS_PACKET.unit, 9);
  assert.equal(UNIT9_REACTIONS_PACKET.unitTitle, 'Unit 9 Reactions');
  assert.equal(UNIT9_REACTIONS_PACKET.topic, 'Reactions');
  assert.equal(UNIT9_REACTIONS_PACKET.title, 'Unit 9 Reactions');
  assert.equal(UNIT9_REACTIONS_PACKET.metadata.sourceBacked, true);
  assert.ok(Array.isArray(UNIT9_REACTIONS_PACKET.sourceFiles), 'Unit 9 packet should expose source files');
  assert.ok(UNIT9_REACTIONS_PACKET.sourceFiles.includes('Grounded Reactions synthesis supplied by user for Patch 11'));
  assert.ok(UNIT9_REACTIONS_PACKET.sourceFiles.includes('Teacher-approved supplemental Unit 9 energy-response content'));
  assert.ok(Array.isArray(UNIT9_REACTIONS_PACKET.vocabulary), 'Unit 9 packet should expose vocabulary');
  assert.ok(Array.isArray(UNIT9_REACTIONS_PACKET.concepts), 'Unit 9 packet should expose concepts');
  assert.ok(Array.isArray(UNIT9_REACTIONS_PACKET.canonicalFacts), 'Unit 9 packet should expose canonical facts');
  assert.ok(Array.isArray(UNIT9_REACTIONS_PACKET.comparisons), 'Unit 9 packet should expose comparisons');
  assert.ok(Array.isArray(UNIT9_REACTIONS_PACKET.relationships), 'Unit 9 packet should expose relationships');
  assert.ok(Array.isArray(UNIT9_REACTIONS_PACKET.referenceFormulas), 'Unit 9 packet should expose formula/rule metadata');
  assert.ok(Array.isArray(UNIT9_REACTIONS_PACKET.examples), 'Unit 9 packet should expose examples');
  assert.ok(Array.isArray(UNIT9_REACTIONS_PACKET.smokeTests), 'Unit 9 packet should expose smoke tests');
  assert.equal(UNIT9_REACTIONS_PACKET.legacyExports.facts, 'UNIT9_REACTIONS_FACTS');
  assert.equal(UNIT9_REACTIONS_PACKET.legacyExports.matcher, 'tryUnit9ReactionsKnowledge');
  assert.equal(UNIT9_REACTIONS_PACKET.counts.canonicalFacts, UNIT9_REACTIONS_FACTS.length);
  assert.equal(UNIT9_REACTIONS_PACKET.counts.vocabulary, UNIT9_REACTIONS_VOCABULARY.length);
  assert.equal(UNIT9_REACTIONS_PACKET.counts.examples, UNIT9_REACTIONS_EXAMPLES.length);
  assert.ok(UNIT9_REACTIONS_PACKET.counts.comparisons >= 8);
  assert.ok(UNIT9_REACTIONS_PACKET.counts.relationships >= 10);
  assert.ok(UNIT9_REACTIONS_PACKET.counts.referenceFormulas >= 4);

  const exothermicSurroundings = UNIT9_REACTIONS_FACTS.find((entry) => entry.id === 'unit9.exothermic_surroundings');
  const endothermicSurroundings = UNIT9_REACTIONS_FACTS.find((entry) => entry.id === 'unit9.endothermic_surroundings');
  assert.deepEqual(exothermicSurroundings.sourceRefs, ['Teacher-approved supplemental Unit 9 energy-response content']);
  assert.deepEqual(endothermicSurroundings.sourceRefs, ['Teacher-approved supplemental Unit 9 energy-response content']);
  assert.deepEqual(
    tryUnit9ReactionsKnowledge('What happens to the surroundings during an exothermic reaction?').knowledgeRefs,
    ['Teacher-approved supplemental Unit 9 energy-response content']
  );
}

function assertNoStudentFacingHonorsNames() {
  const packetText = JSON.stringify({
    title: UNIT9_REACTIONS_PACKET.title,
    unitTitle: UNIT9_REACTIONS_PACKET.unitTitle,
    topic: UNIT9_REACTIONS_PACKET.topic,
    concepts: UNIT9_REACTIONS_PACKET.concepts,
    vocabulary: UNIT9_REACTIONS_PACKET.vocabulary,
    facts: UNIT9_REACTIONS_PACKET.canonicalFacts,
    examples: UNIT9_REACTIONS_PACKET.examples,
    smokeTests: UNIT9_REACTIONS_PACKET.smokeTests
  });
  assert.doesNotMatch(packetText, /Honors/i, 'Unit 9 student-facing packet content should not use Honors naming');
}

main();
