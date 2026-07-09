const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');
const {
  ALL_UNIT1_SAFETY_EQUIPMENT_FACTS,
  UNIT1_SAFETY_EQUIPMENT_PACKET,
  tryUnit1SafetyEquipmentKnowledge
} = require('../lib/knowledge/science/unit1/unit1SafetyEquipmentKnowledge');

const DIRECT_CASES = [
  {
    name: 'safety-goggles-purpose',
    prompt: 'what are safety goggles for',
    includes: [/goggles/i, /protect/i, /eyes/i, /chemicals|fire|glassware|splash|break/i]
  },
  {
    name: 'when-wear-goggles',
    prompt: 'when should I wear goggles in a lab',
    includes: [/goggles/i, /chemicals|fire|glassware|splash|break/i]
  },
  {
    name: 'lab-apron-purpose',
    prompt: 'what is a lab apron for',
    includes: [/apron/i, /protect/i, /clothes|clothing/i, /skin/i]
  },
  {
    name: 'manual-aprons-during-lab',
    prompt: 'Why do we wear aprons during a lab?',
    includes: [/apron/i, /protect/i, /skin/i, /clothes|clothing/i, /spills|splashes/i]
  },
  {
    name: 'heat-resistant-gloves',
    prompt: 'what are heat resistant gloves for',
    includes: [/gloves/i, /protect/i, /hands/i, /hot/i]
  },
  {
    name: 'read-lab-before-starting',
    prompt: 'why should I read the lab before starting',
    includes: [/read/i, /steps/i, /materials/i, /safety rules/i]
  },
  {
    name: 'neat-lab-table',
    prompt: 'why should I keep my lab table neat',
    includes: [/neat|organized/i, /prevent|avoid/i, /spills/i, /broken equipment|accidents/i]
  },
  {
    name: 'lab-emergency',
    prompt: 'what should I do in an emergency in lab',
    includes: [/tell|ask/i, /teacher/i, /immediately|right away/i]
  },
  {
    name: 'chemical-spill',
    prompt: 'what should I do if I spill a chemical',
    includes: [/tell/i, /teacher/i, /cleanup|directions/i]
  },
  {
    name: 'pass-fire-extinguisher',
    prompt: 'what does PASS stand for',
    includes: [/Pull/i, /Aim/i, /Squeeze/i, /Sweep/i]
  },
  {
    name: 'fire-blanket',
    prompt: 'what is a fire blanket used for',
    includes: [/fire blanket/i, /smother|flames/i, /clothing|person/i]
  },
  {
    name: 'waft-why',
    prompt: 'why do you waft chemicals',
    includes: [/waft/i, /fumes|vapor/i, /nose/i, /inhale/i]
  },
  {
    name: 'waft-definition',
    prompt: 'what does waft mean',
    includes: [/waft/i, /fumes/i, /nose/i, /smelling directly|directly/i]
  },
  {
    name: 'never-taste-chemicals',
    prompt: 'why should you never taste chemicals',
    includes: [/chemicals/i, /poisonous|irritating|unsafe/i]
  },
  {
    name: 'hot-glass-dangerous',
    prompt: 'why is hot glass dangerous',
    includes: [/hot glass/i, /looks like cold|look like cold|cold glass/i, /safety equipment|carefully/i]
  },
  {
    name: 'broken-glass-disposal',
    prompt: 'where does broken glass go',
    includes: [/broken glass/i, /teacher/i, /bare hands/i, /cleanup|method|directions/i],
    excludes: [/insulator/i, /electrons/i]
  },
  {
    name: 'manual-break-glass-lab',
    prompt: 'What should I do if I break glass in the lab?',
    includes: [/teacher/i, /broken glass|glass/i, /bare hands/i, /cleanup|method|directions/i],
    excludes: [/insulator/i, /electrons/i]
  },
  {
    name: 'beaker-use',
    prompt: 'what is a beaker used for',
    includes: [/beaker/i, /holding/i, /mixing/i, /heating|roughly measuring/i]
  },
  {
    name: 'graduated-cylinder-use',
    prompt: 'what is a graduated cylinder used for',
    includes: [/graduated cylinder/i, /measure/i, /liquid volume|volume/i, /precis/i]
  },
  {
    name: 'erlenmeyer-flask-use',
    prompt: 'what is an erlenmeyer flask used for',
    includes: [/Erlenmeyer flask/i, /hold/i, /mix/i, /heat/i]
  },
  {
    name: 'test-tube-holder-use',
    prompt: 'what is a test tube holder used for',
    includes: [/test tube holder/i, /holds?/i, /test tube/i, /heating/i]
  },
  {
    name: 'hot-plate-use',
    prompt: 'what is a hot plate used for',
    includes: [/hot plate/i, /electricity|electric/i, /heat/i]
  },
  {
    name: 'bunsen-burner-use',
    prompt: 'what is a bunsen burner used for',
    includes: [/Bunsen burner/i, /gas flame|flame/i, /heat/i]
  },
  {
    name: 'digital-scale-use',
    prompt: 'what is a digital scale used for',
    includes: [/digital scale/i, /mass/i, /grams/i]
  },
  {
    name: 'meter-stick-use',
    prompt: 'what is a meter stick used for',
    includes: [/meter stick/i, /length|distance/i]
  },
  {
    name: 'thermometer-use',
    prompt: 'what is a thermometer used for',
    includes: [/thermometer/i, /temperature/i]
  },
  {
    name: 'funnel-use',
    prompt: 'what is a funnel used for',
    includes: [/funnel/i, /pour|transfer/i, /liquids?|powders?/i, /spilling|without spilling|smaller openings/i]
  },
  {
    name: 'manual-funel-science-class',
    prompt: 'What is a funel used for in science class?',
    includes: [/funnel/i, /pour|transfer/i, /liquids?|powders?/i, /without spilling|spilling/i],
    excludes: [/periodic table/i, /\bindium\b/i]
  },
  {
    name: 'beaker-tongs-use',
    prompt: 'what are beaker tongs used for',
    includes: [/beaker tongs/i, /hold|move|carry/i, /hot beaker/i]
  },
  {
    name: 'pipette-use',
    prompt: 'what is a pipette used for',
    includes: [/pipette/i, /small/i, /precise/i, /liquid/i]
  },
  {
    name: 'dropper-use',
    prompt: 'what is a dropper used for',
    includes: [/dropper/i, /liquids/i, /drop by drop/i]
  },
  {
    name: 'mortar-pestle-use',
    prompt: 'what is a mortar and pestle used for',
    includes: [/mortar and pestle/i, /grind/i, /solids/i, /powder/i]
  },
  {
    name: 'watch-glass-use',
    prompt: 'what is a watch glass used for',
    includes: [/watch glass/i, /cover/i, /beaker|small samples/i]
  },
  {
    name: 'typo-gogles',
    prompt: 'what are gogles for',
    includes: [/goggles/i, /protect/i, /eyes/i]
  },
  {
    name: 'typo-bunson-burner',
    prompt: 'what is a bunson burner',
    includes: [/Bunsen burner/i, /gas flame|flame/i, /heat/i]
  },
  {
    name: 'typo-graduated-cylender',
    prompt: 'what is a graduated cylender used for',
    includes: [/graduated cylinder/i, /measure/i, /volume/i]
  },
  {
    name: 'typo-waff',
    prompt: 'what does waff mean in science',
    includes: [/waft/i, /fumes/i, /nose/i]
  },
  {
    name: 'typo-hot-glas',
    prompt: 'what should I do with hot glas',
    includes: [/hot glass/i, /cold glass|looks/i, /carefully|safety equipment/i]
  }
];

const CONCEPT_TUTOR_BOUNDARY_CASES = [
  {
    prompt: 'Is melting ice endothermic or exothermic?',
    tutorId: 'energy.processes.endothermic-exothermic.identification'
  },
  {
    prompt: 'Is a moving car kinetic, gravitational potential, or elastic potential energy?',
    tutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification'
  },
  {
    prompt: 'Is a circuit with one path series or parallel?',
    tutorId: 'electricity.circuits.series-parallel.identification'
  }
];

const FORMULA_BOUNDARY_CASES = [
  'Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.',
  'Calculate voltage if current is 2 A and resistance is 3 ohms.',
  'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.',
  'Calculate density if mass is 10 g and volume is 5 mL.',
  'Water waves are 0.075 m long. They pass a point at a rate of 21 waves every 3 seconds. What is speed and period?',
  'A graduated cylinder has 33.5 mL of water. A piece of metal is added and the new volume is 46.2 mL. The metal has a mass of 16.25 g. What is its density?'
];

const NON_UNIT1_BOUNDARY_CASES = [
  {
    name: 'infrared-night-vision-goggles',
    prompt: 'What type of waves are used in night vision goggles and remote controls?',
    includes: [/infrared/i],
    excludes: [/safety goggles/i, /protect your eyes/i]
  }
];
const REQUIRED_SAFETY_TERMS_AND_TOOLS = [
  'safety goggles',
  'lab apron',
  'heat-resistant gloves',
  'fire extinguisher',
  'fire blanket',
  'waft',
  'chemical spill or exposure',
  'broken glass',
  'graduated cylinder',
  'Erlenmeyer flask',
  'test tube holder',
  'hot plate',
  'Bunsen burner',
  'digital scale',
  'meter stick',
  'thermometer',
  'funnel',
  'beaker tongs',
  'pipette',
  'dropper',
  'mortar and pestle',
  'watch glass',
  'beaker'
];

async function main() {
  assertPacketShape();

  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of DIRECT_CASES) {
    const response = await ask(request, sessionId, `unit1-safety-${slug(testCase.name)}`, testCase.prompt);
    assert.notEqual(response.routeType, 'concept_tutor', `${testCase.name} should stay Direct Answer, not Concept Tutor`);
    assert.notEqual(response.routeType, 'formula_tutor', `${testCase.name} should stay Direct Answer, not Formula Tutor`);
    assert.notEqual(response.routeType, 'motion_force_knowledge_tutor', `${testCase.name} should not start old broad General Tutor`);
    assert.match(response.routeType, /definition|science_concept/i, `${testCase.name} should use a direct local route`);
    assertAnswer(response.response, testCase);
  }

  for (const testCase of CONCEPT_TUTOR_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-boundary-${slug(testCase.prompt)}`, testCase.prompt);
    assert.equal(response.routeType, 'concept_tutor', `${testCase.prompt} should still start its existing Concept Tutor`);
    assert.equal(response.tutor?.id, testCase.tutorId, `${testCase.prompt} tutor id`);
  }

  for (const prompt of FORMULA_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-formula-${slug(prompt)}`, prompt);
    assert.match(response.routeType, /formula/i, `${prompt} should stay Formula Tutor or formula route`);
  }

  for (const testCase of NON_UNIT1_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-non-unit1-${slug(testCase.name)}`, testCase.prompt);
    assert.notEqual(response.routeType, 'definition', `${testCase.name} should not use Unit 1 equipment definition routing`);
    assertAnswer(response.response, testCase);
    for (const unexpected of testCase.excludes || []) {
      assert.doesNotMatch(String(response.response || ''), unexpected, `${testCase.name} should not include ${unexpected}`);
    }
  }

  console.log('PASS Unit 1 safety/equipment regressions: direct answers, typo handling, and route boundaries');
}

function assertPacketShape() {
  assert.ok(UNIT1_SAFETY_EQUIPMENT_PACKET, 'Unit 1 safety/equipment packet should be exported');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.packetId, 'unit1-safety-equipment');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.unit, 1);
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.unitTitle, 'Science Practices');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.title, 'Lab Safety and Equipment');
  assert.ok(Array.isArray(UNIT1_SAFETY_EQUIPMENT_PACKET.sourceFiles), 'Unit 1 safety/equipment packet should expose source refs');
  assert.ok(Array.isArray(UNIT1_SAFETY_EQUIPMENT_PACKET.topics), 'Unit 1 safety/equipment packet should expose topics');
  assert.ok(Array.isArray(UNIT1_SAFETY_EQUIPMENT_PACKET.vocabulary), 'Unit 1 safety/equipment packet should expose vocabulary');
  assert.ok(Array.isArray(UNIT1_SAFETY_EQUIPMENT_PACKET.concepts), 'Unit 1 safety/equipment packet should expose concept groups');
  assert.ok(Array.isArray(UNIT1_SAFETY_EQUIPMENT_PACKET.canonicalFacts), 'Unit 1 safety/equipment packet should expose canonical facts');
  assert.ok(Array.isArray(UNIT1_SAFETY_EQUIPMENT_PACKET.examples), 'Unit 1 safety/equipment packet should expose existing examples');
  assert.ok(Array.isArray(UNIT1_SAFETY_EQUIPMENT_PACKET.relationships), 'Unit 1 safety/equipment packet should expose existing related-term edges');
  assert.ok(Array.isArray(UNIT1_SAFETY_EQUIPMENT_PACKET.safetyRules), 'Unit 1 safety/equipment packet should expose existing safety rules');
  assert.ok(Array.isArray(UNIT1_SAFETY_EQUIPMENT_PACKET.smokeTests), 'Unit 1 safety/equipment packet should expose smoke tests');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.legacyExports.facts, 'ALL_UNIT1_SAFETY_EQUIPMENT_FACTS');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.legacyExports.smokeTests, 'UNIT1_SAFETY_EQUIPMENT_PACKET.smokeTests');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.legacyExports.matcher, 'tryUnit1SafetyEquipmentKnowledge');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.canonicalFacts.length > 0, true, 'Unit 1 safety/equipment packet should include canonical facts');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.vocabulary.length > 0, true, 'Unit 1 safety/equipment packet should include vocabulary');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.relationships.length > 0, true, 'Unit 1 safety/equipment packet should include relationship edges');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.safetyRules.length > 0, true, 'Unit 1 safety/equipment packet should include safety rules');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.examples.length > 0, true, 'Unit 1 safety/equipment packet should include natural examples');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.smokeTests.length > 0, true, 'Unit 1 safety/equipment packet should include smoke tests');
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.counts.canonicalFacts, ALL_UNIT1_SAFETY_EQUIPMENT_FACTS.length);
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.counts.vocabulary, UNIT1_SAFETY_EQUIPMENT_PACKET.vocabulary.length);
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.counts.relationships, UNIT1_SAFETY_EQUIPMENT_PACKET.relationships.length);
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.counts.safetyRules, UNIT1_SAFETY_EQUIPMENT_PACKET.safetyRules.length);
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.counts.examples, UNIT1_SAFETY_EQUIPMENT_PACKET.examples.length);
  assert.equal(UNIT1_SAFETY_EQUIPMENT_PACKET.counts.smokeTests, UNIT1_SAFETY_EQUIPMENT_PACKET.smokeTests.length);
  assert.ok(UNIT1_SAFETY_EQUIPMENT_PACKET.sourceFiles.includes('unit1.corpus.0001'), 'Unit 1 safety/equipment packet should represent existing safety source refs');
  assert.ok(UNIT1_SAFETY_EQUIPMENT_PACKET.sourceFiles.includes('unit1.corpus.0012'), 'Unit 1 safety/equipment packet should represent existing equipment source refs');
  assert.ok(UNIT1_SAFETY_EQUIPMENT_PACKET.metadata.sourceBacked, 'Unit 1 safety/equipment packet should be marked source-backed');
  assert.ok(UNIT1_SAFETY_EQUIPMENT_PACKET.metadata.sourceReferences.length > 0, 'Unit 1 safety/equipment packet should expose source metadata refs');
  assert.ok(UNIT1_SAFETY_EQUIPMENT_PACKET.counts.relationships > 0, 'Unit 1 safety/equipment packet should count existing relationships');
  assert.ok(UNIT1_SAFETY_EQUIPMENT_PACKET.counts.safetyRules > 0, 'Unit 1 safety/equipment packet should count existing safety rules');
  assert.ok(UNIT1_SAFETY_EQUIPMENT_PACKET.metadata.generatedFromExistingFactsOnly);
  assertRequiredSafetyTermsAndTools();
  assertPacketSmokeTests();

  const direct = tryUnit1SafetyEquipmentKnowledge('what are safety goggles for');
  assert.ok(direct, 'Unit 1 safety/equipment matcher should still answer a direct safety prompt');
  assert.equal(direct.directAnswer, 'Safety goggles protect your eyes when using chemicals, fire, glassware, or anything that could splash or break.');
}

function assertRequiredSafetyTermsAndTools() {
  const packetTerms = new Set(UNIT1_SAFETY_EQUIPMENT_PACKET.vocabulary.map((entry) => normalizeTerm(entry.term)));
  for (const term of REQUIRED_SAFETY_TERMS_AND_TOOLS) {
    assert.ok(packetTerms.has(normalizeTerm(term)), `Unit 1 safety/equipment packet should include ${term}`);
  }
}

function assertPacketSmokeTests() {
  const factIds = new Set(UNIT1_SAFETY_EQUIPMENT_PACKET.canonicalFacts.map((fact) => fact.id));
  for (const smokeTest of UNIT1_SAFETY_EQUIPMENT_PACKET.smokeTests) {
    const factId = smokeTest.id.replace(/\.smoke$/, '');
    assert.ok(factIds.has(factId), `${smokeTest.id} should point to a canonical fact`);
    assert.ok(smokeTest.query, `${smokeTest.id} should include a query`);
    assert.equal(smokeTest.expectedRoute, 'direct_answer', `${smokeTest.id} should document direct-answer routing`);
    assert.equal(smokeTest.expectedTool, 'unit1_safety_equipment_knowledge', `${smokeTest.id} should document the Safety/Equipment tool`);
    assert.ok(smokeTest.expectedCoreAnswer, `${smokeTest.id} should include expected core answer text`);
    assert.ok(Array.isArray(smokeTest.sourceRefs) && smokeTest.sourceRefs.length > 0, `${smokeTest.id} should preserve source refs`);
  }
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

function assertAnswer(answer, testCase) {
  const answerText = String(answer || '');
  assert.ok(answerText.trim(), `${testCase.name} should produce an answer`);
  for (const expected of testCase.includes || []) {
    assert.match(answerText, expected, `${testCase.name} should include ${expected} but got:\n${answerText}`);
  }
  for (const unexpected of testCase.excludes || []) {
    assert.doesNotMatch(answerText, unexpected, `${testCase.name} should not include ${unexpected} but got:\n${answerText}`);
  }
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function normalizeTerm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[-‐‑‒–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
