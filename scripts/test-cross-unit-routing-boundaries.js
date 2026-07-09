const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');

const BOUNDARY_GROUPS = [
  {
    name: 'Unit 7 atomic structure vs Unit 4 electricity/circuits',
    cases: [
      unit7('What is an electron in an atom?', [/electron/i, /negative/i, /electron cloud|nucleus/i]),
      unit7('Why are electrons negative?', [/electron/i, /negative/i]),
      unit7('How do protons, neutrons, and electrons compare?', [/protons/i, /neutrons/i, /electrons/i]),
      electricity('How do electrons flow in a battery circuit?', [/battery|circuit|charge|current/i]),
      electricity('Why does a battery have a positive and negative end?', [/battery/i, /voltage|terminals|charges/i]),
      electricity('What happens to electrons in a closed circuit?', [/closed circuit/i, /current|flow/i])
    ]
  },
  {
    name: 'Unit 6 matter/density vs Unit 1 measurement',
    cases: [
      formula('A rock has a mass of 20 g and volume of 5 mL. What is its density?', [/density/i, /4\s*g\/mL/i], ['unit1_measurement_knowledge']),
      unit6('Why does density help identify a substance?', [/density/i, /physical property|substance/i]),
      unit6('Is density a physical property of matter?', [/density/i, /physical property/i]),
      unit1('What tool measures mass?', [/scale|balance/i, /mass/i]),
      unit1('What unit do you use for volume?', [/liters?|milliliters?|mL/i]),
      unit1('How do you measure length in a lab?', [/ruler|meter stick/i, /length|distance/i])
    ]
  },
  {
    name: 'Unit 6 physical/chemical changes vs Unit 1 lab safety',
    cases: [
      unit6('Is broken glass evidence of a physical or chemical change?', [/broken glass|glass/i, /physical change/i]),
      unit1Safety('What should I do if I break glass in the lab?', [/teacher/i, /broken glass|glass/i, /bare hands/i])
    ]
  },
  {
    name: 'Unit 3 energy vs Unit 4 electrical energy/circuits',
    cases: [
      unit3('What energy transformation happens in a toaster?', [/electrical energy/i, /thermal energy/i]),
      unit3('What type of energy is stored in food?', [/chemical energy/i, /food|bonds/i]),
      unit3('How does energy change when a ball falls?', [/potential energy/i, /kinetic energy/i]),
      electricity('What happens in an electric circuit?', [/circuit/i, /current/i]),
      electricity('How does electrical energy move through a wire?', [/wire/i, /current|path|conductor/i]),
      electricity('What is current in a circuit?', [/current/i, /charge|electrons/i])
    ]
  },
  {
    name: 'Unit 5 waves vs Unit 7 atomic/radiant/electromagnetic wording',
    cases: [
      unit5('What happens when a wave reflects?', [/reflection|bounces/i]),
      unit5('How are wavelength and frequency related?', [/wavelength/i, /frequency/i]),
      unit5('Is light a wave?', [/light/i, /wave/i, /electromagnetic/i]),
      notAtomic('What is radiant energy?', ['unit3_energy_knowledge'], [/radiant energy/i, /electromagnetic waves/i]),
      notAtomic('What is light energy?', ['unit3_energy_knowledge'], [/light energy|radiant energy/i, /electromagnetic waves/i]),
      unit7('What particles are inside an atom?', [/protons/i, /neutrons/i, /electrons/i]),
      unit7('What is the charge of a proton?', [/proton/i, /positive/i]),
      unit7('How do you calculate neutrons?', [/mass number/i, /atomic number/i])
    ]
  }
];

function unit7(prompt, includes) {
  return routeCase(prompt, ['unit7_atomic_structure_knowledge'], ['electricity_magnetism_knowledge_pack', 'unit5_waves_knowledge'], includes);
}

function electricity(prompt, includes) {
  return routeCase(prompt, ['electricity_magnetism_knowledge_pack'], ['unit7_atomic_structure_knowledge', 'unit3_energy_knowledge'], includes);
}

function unit6(prompt, includes) {
  return routeCase(prompt, ['unit6_matter_knowledge'], ['unit1_measurement_knowledge'], includes);
}

function unit1(prompt, includes) {
  return routeCase(prompt, ['unit1_measurement_knowledge'], ['unit6_matter_knowledge', 'science_formula_rules'], includes);
}

function unit1Safety(prompt, includes) {
  return routeCase(prompt, ['unit1_safety_equipment_knowledge'], ['unit6_matter_knowledge'], includes);
}

function unit3(prompt, includes) {
  return routeCase(prompt, ['unit3_energy_knowledge'], ['electricity_magnetism_knowledge_pack', 'unit7_atomic_structure_knowledge'], includes);
}

function unit5(prompt, includes) {
  return routeCase(prompt, ['unit5_waves_knowledge'], ['unit7_atomic_structure_knowledge'], includes);
}

function formula(prompt, includes, forbiddenTools = []) {
  return routeCase(prompt, ['science_formula_rules'], forbiddenTools, includes, { expectedType: 'science_formula' });
}

function notAtomic(prompt, expectedTools, includes) {
  return routeCase(prompt, expectedTools, ['unit7_atomic_structure_knowledge'], includes);
}

function routeCase(prompt, expectedTools, forbiddenTools, includes, options = {}) {
  return {
    prompt,
    expectedTools,
    forbiddenTools,
    includes,
    expectedType: options.expectedType || null
  };
}

function main() {
  let total = 0;

  for (const group of BOUNDARY_GROUPS) {
    console.log('');
    console.log(`${group.name}:`);
    for (const testCase of group.cases) {
      assertRouteBoundary(testCase);
      total += 1;
      console.log(`  PASS ${testCase.prompt}`);
    }
  }

  console.log('');
  console.log(`PASS Cross-unit routing boundary regression: ${total} prompts across ${BOUNDARY_GROUPS.length} boundary groups`);
}

function assertRouteBoundary(testCase) {
  const route = routeStudentQuestion(testCase.prompt);
  const tools = routeTools(route);
  const detail = () => JSON.stringify({
    prompt: testCase.prompt,
    type: route.type,
    toolsUsed: tools,
    notes: route.notes,
    directAnswer: route.directAnswer
  }, null, 2);

  assert.notEqual(route.type, 'no_match', `${testCase.prompt} should route to trusted local handling\n${detail()}`);
  if (testCase.expectedType) {
    assert.equal(route.type, testCase.expectedType, `${testCase.prompt} should use route type ${testCase.expectedType}\n${detail()}`);
  }
  assert.ok(
    testCase.expectedTools.some((tool) => tools.includes(tool)),
    `${testCase.prompt} should use one of ${testCase.expectedTools.join(', ')}\n${detail()}`
  );
  for (const tool of testCase.forbiddenTools) {
    assert.ok(!tools.includes(tool), `${testCase.prompt} should not be stolen by ${tool}\n${detail()}`);
  }
  for (const pattern of testCase.includes) {
    assert.match(route.directAnswer || '', pattern, `${testCase.prompt} answer should include ${pattern}\n${detail()}`);
  }
}

function routeTools(route) {
  return [
    ...(route.toolsUsed || []),
    ...(route.public?.toolsUsed || [])
  ];
}

main();
