const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');
const { projectRoot } = require('./test-helpers/fileSystem');
const {
  ALL_UNIT1_CONVERSIONS_NOTATION_FACTS,
  UNIT1_CONVERSIONS_NOTATION_PACKET,
  tryUnit1ConversionsNotationKnowledge
} = require('../lib/knowledge/science/unit1/unit1ConversionsNotationKnowledge');

const unit1ConversionsSource = fs.readFileSync(path.join(projectRoot, 'lib', 'formulas', 'unit1Conversions.js'), 'utf8');

const DIRECT_CASES = [
  {
    name: 'dimensional-analysis-definition',
    prompt: 'what is dimensional analysis',
    includes: [/dimensional analysis/i, /converting|convert/i, /different units/i, /without changing their value/i]
  },
  {
    name: 'conversion-factor-definition',
    prompt: 'what is a conversion factor',
    includes: [/conversion factor/i, /ratio/i, /equivalent values/i, /change units/i]
  },
  {
    name: 'conversion-factor-equals-one',
    prompt: 'why does a conversion factor equal 1',
    includes: [/equal amounts/i, /changes? the unit/i, /not the value|without changing/i]
  },
  {
    name: 'picket-fence-method',
    prompt: 'what is the picket fence method',
    includes: [/picket fence/i, /dimensional analysis/i, /units cancel/i]
  },
  {
    name: 'how-use-dimensional-analysis',
    prompt: 'how do you use dimensional analysis',
    includes: [/given number/i, /conversion factors/i, /cancel/i, /multiply and divide/i]
  },
  {
    name: 'why-units-cancel',
    prompt: 'why do units cancel in dimensional analysis',
    includes: [/matching units/i, /opposite sides/i, /cancel/i, /desired unit/i]
  },
  {
    name: 'metric-prefix-definition',
    prompt: 'what is a metric prefix',
    includes: [/metric prefix/i, /base unit/i, /power.of.ten|power-of-ten/i]
  },
  {
    name: 'common-prefixes',
    prompt: 'what are common metric prefixes',
    includes: [/mega/i, /kilo/i, /centi/i, /milli/i, /micro/i, /nano/i]
  },
  {
    name: 'kilo-meaning',
    prompt: 'what does kilo mean',
    includes: [/kilo/i, /1,?000|1000/i, /base units/i]
  },
  {
    name: 'centi-meaning',
    prompt: 'what does centi mean',
    includes: [/centi/i, /hundredth/i, /base unit/i]
  },
  {
    name: 'milli-meaning',
    prompt: 'what does milli mean',
    includes: [/milli/i, /thousandth/i, /base unit/i]
  },
  {
    name: 'scientific-notation-definition',
    prompt: 'what is scientific notation',
    includes: [/scientific notation/i, /large|small/i, /1 to less than 10/i, /power of 10/i]
  },
  {
    name: 'why-scientific-notation',
    prompt: 'why do scientists use scientific notation',
    includes: [/large|small/i, /easier/i, /write|read|calculate/i]
  },
  {
    name: 'standard-notation-definition',
    prompt: 'what is standard notation',
    includes: [/standard notation/i, /ordinary decimal|decimal form/i]
  },
  {
    name: 'large-number-to-scientific',
    prompt: 'how do you convert a large number to scientific notation',
    includes: [/move the decimal/i, /one digit/i, /positive power/i]
  },
  {
    name: 'small-decimal-to-scientific',
    prompt: 'how do you convert a small decimal to scientific notation',
    includes: [/move the decimal/i, /one nonzero digit/i, /negative power/i]
  },
  {
    name: 'scientific-to-standard',
    prompt: 'how do you convert scientific notation to standard notation',
    includes: [/move the decimal/i, /right/i, /positive exponent/i, /left/i, /negative exponent/i]
  },
  {
    name: 'kelvin-from-celsius-formula',
    prompt: 'what is the formula for kelvin from celsius',
    includes: [/K\s*=\s*°?C\s*\+\s*273/i]
  },
  {
    name: 'celsius-from-fahrenheit-formula',
    prompt: 'what is the formula for celsius from fahrenheit',
    includes: [/°?C\s*=\s*5\/9/i, /°?F\s*-\s*32/i]
  },
  {
    name: 'fahrenheit-from-celsius-formula',
    prompt: 'what is the formula for fahrenheit from celsius',
    includes: [/°?F\s*=/i, /°?C\s*×\s*9\/5|°?C\s*x\s*9\/5/i, /\+\s*32/i]
  },
  {
    name: 'common-conversion-factors',
    prompt: 'what are common conversion factors',
    includes: [/24 hours\s*=\s*1 day/i, /12 inches\s*=\s*1 foot/i, /1 inch\s*=\s*2\.54 cm/i, /1000 g\s*=\s*1 kg/i]
  },
  {
    name: 'typo-dimensional-analysis',
    prompt: 'what is dimentional analysis',
    includes: [/dimensional analysis/i, /different units/i]
  },
  {
    name: 'typo-conversion-factor',
    prompt: 'what is a conversion facter',
    includes: [/conversion factor/i, /ratio/i]
  },
  {
    name: 'typo-picket-fence',
    prompt: 'what is picket fense',
    includes: [/picket fence/i, /units cancel/i]
  },
  {
    name: 'typo-scientific-notation',
    prompt: 'what is scintific notation',
    includes: [/scientific notation/i, /power of 10/i]
  },
  {
    name: 'typo-standard-notation',
    prompt: 'what is standard notaton',
    includes: [/standard notation/i, /decimal/i]
  },
  {
    name: 'typo-mili',
    prompt: 'what does mili mean',
    includes: [/milli/i, /thousandth/i]
  },
  {
    name: 'typo-farenheit-celcius',
    prompt: 'what is the farenheit from celcius formula',
    includes: [/°?F\s*=/i, /°?C/i, /\+\s*32/i]
  }
];

const FORMULA_CASES = [
  {
    name: 'metric-km-to-m',
    prompt: 'Convert 48 km to meters.',
    formulaId: 'unit1_metric_stair_step_conversion',
    includes: [/48,?000 m/i],
    visualType: 'metric_stair_step',
    methodChoices: [/Stair-step conversion/i, /Picket fence|dimensional analysis/i],
    noDrawLanguage: true,
    visual: { startUnit: 'km', targetUnit: 'm', resultUnit: 'm', resultValue: 48000, direction: 'right', places: 3 }
  },
  {
    name: 'metric-km-to-cm',
    prompt: 'Convert 7.5 km to cm.',
    formulaId: 'unit1_metric_stair_step_conversion',
    includes: [/750,?000 cm/i],
    visualType: 'metric_stair_step',
    methodChoices: [/Stair-step conversion/i, /Picket fence|dimensional analysis/i],
    noDrawLanguage: true,
    visual: { startUnit: 'km', targetUnit: 'cm', resultUnit: 'cm', resultValue: 750000, direction: 'right', places: 5 }
  },
  {
    name: 'metric-ks-to-s',
    prompt: 'Convert 6.1 ks to seconds.',
    formulaId: 'unit1_metric_stair_step_conversion',
    includes: [/6,?100 s/i],
    visualType: 'metric_stair_step',
    visual: { startUnit: 'ks', targetUnit: 's', resultUnit: 's', resultValue: 6100, direction: 'right', places: 3 }
  },
  {
    name: 'metric-m-to-mm',
    prompt: 'Convert 65.4 m to millimeters.',
    formulaId: 'unit1_metric_stair_step_conversion',
    includes: [/65,?400 mm/i],
    visualType: 'metric_stair_step',
    visual: { startUnit: 'm', targetUnit: 'mm', resultUnit: 'mm', resultValue: 65400, direction: 'right', places: 3 }
  },
  {
    name: 'metric-mg-to-kg',
    prompt: 'Convert 45,456 mg to kilograms.',
    formulaId: 'unit1_metric_stair_step_conversion',
    includes: [/0\.045456 kg/i],
    visualType: 'metric_stair_step',
    visual: { startUnit: 'mg', targetUnit: 'kg', resultUnit: 'kg', resultValue: 0.045456, direction: 'left', places: 6 }
  },
  {
    name: 'metric-mg-to-cg',
    prompt: 'Convert 0.859 mg to cg.',
    formulaId: 'unit1_metric_stair_step_conversion',
    includes: [/0\.0859 cg/i],
    visualType: 'metric_stair_step',
    visual: { startUnit: 'mg', targetUnit: 'cg', resultUnit: 'cg', resultValue: 0.0859, direction: 'left', places: 1 }
  },
  {
    name: 'picket-cm-to-feet',
    prompt: 'Convert 250.4 cm to feet.',
    formulaId: 'unit1_picket_fence_conversion',
    includes: [/8\.22 ft/i],
    visualType: 'picket_fence',
    visual: { givenUnit: 'cm', targetUnit: 'ft', resultUnit: 'ft', resultValue: 8.22 }
  },
  {
    name: 'picket-seconds-in-year',
    prompt: 'How many seconds are in one year?',
    formulaId: 'unit1_picket_fence_conversion',
    includes: [/31,?536,?000 s/i],
    visualType: 'picket_fence',
    visual: { givenUnit: 'year', targetUnit: 's', resultUnit: 's', resultValue: 31536000 }
  },
  {
    name: 'temperature-c-to-f',
    prompt: 'Convert 23 C to F.',
    formulaId: 'unit1_temperature_conversion',
    includes: [/73\.4\s*°?F/i],
    visualType: 'temperature_conversion',
    visual: { resultUnit: 'F', resultValue: 73.4 }
  },
  {
    name: 'temperature-f-to-c',
    prompt: 'Convert 48 F to C.',
    formulaId: 'unit1_temperature_conversion',
    includes: [/8\.8|8\.9|8\.89/i],
    visualType: 'temperature_conversion',
    visual: { resultUnit: 'C', resultValue: 8.888888888889 }
  },
  {
    name: 'temperature-f-to-k',
    prompt: 'Convert 83 F to Kelvin.',
    formulaId: 'unit1_temperature_conversion',
    includes: [/301\.3/i],
    visualType: 'temperature_conversion',
    visual: { resultUnit: 'K', resultValue: 301.333333333 }
  },
  {
    name: 'scientific-large',
    prompt: 'Write 354,000,000 in scientific notation.',
    formulaId: 'unit1_scientific_notation',
    includes: [/3\.54\s*×?\s*10\^8/i],
    visualType: 'scientific_notation_decimal_move',
    visual: { exponent: 8, coefficient: 3.54, direction: 'left', places: 8 }
  },
  {
    name: 'scientific-small',
    prompt: 'Write 0.000096 in scientific notation.',
    formulaId: 'unit1_scientific_notation',
    includes: [/9\.6\s*×?\s*10\^-5/i],
    visualType: 'scientific_notation_decimal_move',
    visual: { exponent: -5, coefficient: 9.6, direction: 'right', places: 5 }
  },
  {
    name: 'standard-small',
    prompt: 'Write 2.76 x 10-3 in standard notation.',
    formulaId: 'unit1_standard_notation',
    includes: [/0\.00276/i],
    visualType: 'scientific_notation_decimal_move',
    visual: { exponent: -3, resultValue: 0.00276, direction: 'left', places: 3 }
  },
  {
    name: 'standard-large',
    prompt: 'Write 4.011 x 10^4 in standard notation.',
    formulaId: 'unit1_standard_notation',
    includes: [/40,?110/i],
    visualType: 'scientific_notation_decimal_move',
    visual: { exponent: 4, resultValue: 40110, direction: 'right', places: 4 }
  }
];

const FORMULA_BOUNDARY_CASES = [
  'Calculate density if mass is 10 g and volume is 5 mL.',
  'Calculate speed if distance is 20 m and time is 5 s.',
  'Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.',
  'Calculate voltage if current is 2 A and resistance is 3 ohms.',
  'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.'
];

const DIRECT_BOUNDARY_CASES = [
  { prompt: 'What is a beaker used for?', includes: [/beaker/i, /holding/i] },
  { prompt: 'What does PASS stand for?', includes: [/Pull/i, /Aim/i, /Squeeze/i, /Sweep/i] },
  { prompt: 'What is accuracy?', includes: [/accuracy/i, /accepted|true|correct/i] },
  { prompt: 'What is precision?', includes: [/precision/i, /repeated|consistent/i] },
  { prompt: 'What is the SI system?', includes: [/SI system/i, /measurement system/i] },
  { prompt: 'What is the meniscus?', includes: [/meniscus/i, /curve/i] },
  { prompt: 'What type of waves are used in night vision goggles and remote controls?', includes: [/infrared/i] },
  { prompt: 'What is conservation of mass?', includes: [/conservation of mass|conservation of matter/i, /not created|not destroyed/i] },
  { prompt: 'What is matter?', includes: [/mass/i, /space|volume/i] }
];

const CONCEPT_BOUNDARY_CASES = [
  { prompt: 'Is melting ice endothermic or exothermic?', tutorId: 'energy.processes.endothermic-exothermic.identification' },
  { prompt: 'Is a circuit with one path series or parallel?', tutorId: 'electricity.circuits.series-parallel.identification' }
];

const METRIC_QUESTION_FORM_CASES = [
  'if I have 3 km how many mm is that',
  'how many millimeters are in 3 kilometers?',
  '3 km is how many mm?',
  'I have 3 km. How many mm is that?'
];

const METRIC_CONTEXT_CASES = [
  { name: 'reported-conversation', previous: ['what is mass', 'how do I solve for mass', 'what is the speed of light'] },
  { name: 'after-mass', previous: ['what is mass'] },
  { name: 'after-mass-number-neutrons', previous: ['what is mass number?', 'how do you calculate neutrons?'] },
  { name: 'after-unrelated-science', previous: ['what is the speed of light'] }
];

const ATOMIC_STRUCTURE_BOUNDARY_CASES = [
  { prompt: 'What is mass number?', includes: [/protons/i, /neutrons/i] },
  { prompt: 'How do you calculate neutrons?', includes: [/mass number/i, /atomic number/i] }
];

async function main() {
  assertUnit1ConversionsNotationPacketShape();

  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of DIRECT_CASES) {
    const response = await ask(request, sessionId, `unit1-conversions-direct-${slug(testCase.name)}`, testCase.prompt);
    assertDirectAnswer(response, testCase.name);
    assertAnswer(response.response, testCase);
  }

  let formulaIndex = 0;
  for (const testCase of FORMULA_CASES) {
    const route = routeStudentQuestion(testCase.prompt);
    assert.equal(route.type, 'science_formula', `${testCase.name} should use science_formula route`);
    assert.equal(route.formulaWork?.formulaId, testCase.formulaId, `${testCase.name} formulaId`);
    assertAnswer(route.directAnswer, testCase);
    assertVisualMetadata(route.formulaWork?.visualMetadata, testCase);

    const response = await ask(request, sessionId, `unit1-conversions-formula-${++formulaIndex}-${slug(testCase.name)}`, testCase.prompt);
    assert.equal(response.routeType, 'formula_tutor', `${testCase.name} should start Formula Tutor`);
    assert.equal(response.tutor?.formulaId, testCase.formulaId, `${testCase.name} tutor formulaId`);
    assert.match(response.response, /Step 1 of/i, `${testCase.name} should show guided steps`);
    if (testCase.methodChoices) {
      assertCleanMetricMethodChoice(response, testCase);
    }
    if (testCase.noDrawLanguage) {
      assert.doesNotMatch(response.response, /\bdraw\b/i, `${testCase.name} should not ask the student to draw the picket fence`);
    }
  }

  await assertMetricMethodBranches(request, sessionId);
  await assertMixedUnitPicketFenceTypedFlow(request, sessionId);
  await assertMetricQuestionForms(request, sessionId);
  await assertMetricQuestionsOverrideConversationContext(request, sessionId);

  for (const prompt of FORMULA_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-conversions-formula-boundary-${slug(prompt)}`, prompt);
    assert.match(response.routeType, /formula/i, `${prompt} should stay Formula Tutor or formula route`);
    assert.notEqual(response.tutor?.formulaId, 'unit1_metric_stair_step_conversion', `${prompt} should not use Unit 1 conversion tutor`);
    assert.notEqual(response.tutor?.formulaId, 'unit1_picket_fence_conversion', `${prompt} should not use Unit 1 conversion tutor`);
  }

  for (const testCase of DIRECT_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-conversions-direct-boundary-${slug(testCase.prompt)}`, testCase.prompt);
    assert.notEqual(response.routeType, 'concept_tutor', `${testCase.prompt} should not become conversion Concept Tutor`);
    assertAnswer(response.response, testCase);
  }

  for (const testCase of CONCEPT_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `unit1-conversions-concept-boundary-${slug(testCase.prompt)}`, testCase.prompt);
    assert.equal(response.routeType, 'concept_tutor', `${testCase.prompt} should keep its existing Concept Tutor`);
    assert.equal(response.tutor?.id, testCase.tutorId, `${testCase.prompt} tutor id`);
  }

  for (const testCase of ATOMIC_STRUCTURE_BOUNDARY_CASES) {
    const route = routeStudentQuestion(testCase.prompt);
    assert.ok(route.toolsUsed.includes('unit7_atomic_structure_knowledge'), `${testCase.prompt} should retain Unit 7 atomic-structure routing`);
    assertAnswer(route.directAnswer, testCase);
  }

  console.log('PASS Unit 1 conversions/notation regressions: direct answers, formula tutor coverage, visual metadata, and route boundaries');
}

async function assertMetricQuestionForms(request, sessionId) {
  for (const [index, prompt] of METRIC_QUESTION_FORM_CASES.entries()) {
    await assertThreeKmToMillimetersFlow(request, sessionId, {
      studentHubId: `unit1-conversions-question-form-${index + 1}`,
      prompt,
      method: index % 2 === 0 ? 'stair_step' : 'picket_fence'
    });
  }
}

async function assertMetricQuestionsOverrideConversationContext(request, sessionId) {
  for (const [index, testCase] of METRIC_CONTEXT_CASES.entries()) {
    const studentHubId = `unit1-conversions-context-${testCase.name}`;
    for (const previousPrompt of testCase.previous) {
      const previous = await ask(request, sessionId, studentHubId, previousPrompt);
      assert.notEqual(previous.routeType, 'formula_tutor', `${previousPrompt} should establish context without starting the conversion tutor`);
    }
    await assertThreeKmToMillimetersFlow(request, sessionId, {
      studentHubId,
      prompt: METRIC_QUESTION_FORM_CASES[index % METRIC_QUESTION_FORM_CASES.length],
      method: index % 2 === 0 ? 'stair_step' : 'picket_fence'
    });
  }
}

async function assertThreeKmToMillimetersFlow(request, sessionId, { studentHubId, prompt, method }) {
  const route = routeStudentQuestion(prompt);
  assert.equal(route.type, 'science_formula', `${prompt} should use the existing science_formula route`);
  assert.equal(route.formulaWork?.formulaId, 'unit1_metric_stair_step_conversion', `${prompt} should use the existing Unit 1 metric conversion tutor`);
  assert.equal(route.formulaWork?.finalAnswer?.value, 3000000, `${prompt} should calculate 3,000,000`);
  assert.equal(route.formulaWork?.finalAnswer?.unit, 'mm', `${prompt} should retain millimeters as the target unit`);

  const start = await ask(request, sessionId, studentHubId, prompt);
  assert.equal(start.routeType, 'formula_tutor', `${prompt} should start Formula Tutor`);
  assert.equal(start.tutor?.formulaId, 'unit1_metric_stair_step_conversion', `${prompt} tutor formulaId`);
  assert.equal(start.tutor?.currentStep?.id, 'choose_method', `${prompt} should begin with method selection`);
  assert.equal(start.tutor?.work?.originalQuestion, prompt, `${prompt} should be retained as the original conversion question`);
  assertCleanMetricMethodChoice(start, { name: prompt });
  assert.doesNotMatch(start.response, /mass number|atomic number|neutrons?|atomic structure|I found something related/i, `${prompt} should not use atomic-structure or weak class-fact fallback`);

  if (method === 'stair_step') {
    const selected = await ask(request, sessionId, studentHubId, '1');
    assert.equal(selected.tutor?.work?.selectedMethod, 'stair_step', `${prompt} should continue through stair-step`);
    const complete = await ask(request, sessionId, studentHubId, '3,000,000 mm');
    assert.equal(complete.tutor?.completed, true, `${prompt} stair-step flow should complete`);
    assert.match(complete.response, /3 km\s*=\s*3,?000,?000 mm|3,?000,?000 mm/i, `${prompt} should finish at 3,000,000 mm`);
    return;
  }

  const selected = await ask(request, sessionId, studentHubId, '2');
  assert.equal(selected.tutor?.work?.selectedMethod, 'picket_fence', `${prompt} should continue through picket fence`);
  await ask(request, sessionId, studentHubId, '3');
  await ask(request, sessionId, studentHubId, '1000000');
  await ask(request, sessionId, studentHubId, '1');
  await ask(request, sessionId, studentHubId, 'km');
  const complete = await ask(request, sessionId, studentHubId, '3000000');
  assert.equal(complete.tutor?.completed, true, `${prompt} picket-fence flow should complete`);
  assert.match(complete.response, /3 km\s*=\s*3,?000,?000 mm|3,?000,?000 mm/i, `${prompt} should finish at 3,000,000 mm`);
}

function assertUnit1ConversionsNotationPacketShape() {
  assert.ok(UNIT1_CONVERSIONS_NOTATION_PACKET, 'Unit 1 conversions/notation packet should be exported');
  assert.equal(UNIT1_CONVERSIONS_NOTATION_PACKET.packetId, 'unit1-conversions-notation');
  assert.equal(UNIT1_CONVERSIONS_NOTATION_PACKET.unit, 1);
  assert.equal(UNIT1_CONVERSIONS_NOTATION_PACKET.unitTitle, 'Science Practices');
  assert.equal(UNIT1_CONVERSIONS_NOTATION_PACKET.title, 'Conversions and Notation');
  assert.equal(UNIT1_CONVERSIONS_NOTATION_PACKET.subject, 'science');
  assert.equal(UNIT1_CONVERSIONS_NOTATION_PACKET.gradeLevel, '8th / physical science');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.sourceFiles), 'Unit 1 conversions/notation packet should expose source refs');
  assert.ok(UNIT1_CONVERSIONS_NOTATION_PACKET.sourceFiles.includes('unit1.corpus.0033'), 'Unit 1 conversions/notation packet should represent existing dimensional-analysis source refs');
  assert.ok(UNIT1_CONVERSIONS_NOTATION_PACKET.sourceFiles.includes('unit1.corpus.0068'), 'Unit 1 conversions/notation packet should represent existing notation source refs');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.topics), 'Unit 1 conversions/notation packet should expose topics');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.vocabulary), 'Unit 1 conversions/notation packet should expose vocabulary');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.concepts), 'Unit 1 conversions/notation packet should expose concept groups');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.canonicalFacts), 'Unit 1 conversions/notation packet should expose canonical facts');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.examples), 'Unit 1 conversions/notation packet should expose existing examples');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.relationships), 'Unit 1 conversions/notation packet should expose existing related-term edges');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.referenceFormulas), 'Unit 1 conversions/notation packet should expose existing formula lookups');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.conversionRules), 'Unit 1 conversions/notation packet should expose existing conversion rules');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.notationRules), 'Unit 1 conversions/notation packet should expose existing notation rules');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.formulaTutorHooks), 'Unit 1 conversions/notation packet should expose existing Formula Tutor route notes');
  assert.ok(Array.isArray(UNIT1_CONVERSIONS_NOTATION_PACKET.conceptTutorHooks), 'Unit 1 conversions/notation packet should expose Concept Tutor hooks');
  assert.ok(UNIT1_CONVERSIONS_NOTATION_PACKET.formulaTutorHooks.some((hook) => hook.formulaId === 'unit1_metric_stair_step_conversion'), 'Unit 1 conversions/notation packet should represent the existing metric conversion formula route');
  assert.ok(UNIT1_CONVERSIONS_NOTATION_PACKET.formulaTutorHooks.some((hook) => hook.formulaId === 'unit1_scientific_notation'), 'Unit 1 conversions/notation packet should represent the existing scientific notation formula route');
  assert.equal(UNIT1_CONVERSIONS_NOTATION_PACKET.legacyExports.facts, 'ALL_UNIT1_CONVERSIONS_NOTATION_FACTS');
  assert.equal(UNIT1_CONVERSIONS_NOTATION_PACKET.legacyExports.matcher, 'tryUnit1ConversionsNotationKnowledge');
  assert.equal(UNIT1_CONVERSIONS_NOTATION_PACKET.legacyExports.formulaMatcher, 'tryUnit1ConversionsNotation');
  assert.equal(UNIT1_CONVERSIONS_NOTATION_PACKET.counts.canonicalFacts, ALL_UNIT1_CONVERSIONS_NOTATION_FACTS.length);
  assert.ok(UNIT1_CONVERSIONS_NOTATION_PACKET.counts.relationships > 0, 'Unit 1 conversions/notation packet should count existing relationships');
  assert.ok(UNIT1_CONVERSIONS_NOTATION_PACKET.counts.examples > 0, 'Unit 1 conversions/notation packet should count existing examples');
  assert.ok(UNIT1_CONVERSIONS_NOTATION_PACKET.counts.referenceFormulas > 0, 'Unit 1 conversions/notation packet should count existing formula lookups');
  assert.ok(UNIT1_CONVERSIONS_NOTATION_PACKET.counts.conversionRules > 0, 'Unit 1 conversions/notation packet should count existing conversion rules');
  assert.ok(UNIT1_CONVERSIONS_NOTATION_PACKET.counts.notationRules > 0, 'Unit 1 conversions/notation packet should count existing notation rules');
  assert.ok(UNIT1_CONVERSIONS_NOTATION_PACKET.metadata.generatedFromExistingFactsOnly);

  const direct = tryUnit1ConversionsNotationKnowledge('what is dimensional analysis');
  assert.ok(direct, 'Existing Unit 1 conversions/notation matcher should still answer direct prompts');
  assert.equal(direct.directAnswer, 'Dimensional analysis is a method for converting numbers into different units without changing their value.');
}

function assertCleanMetricMethodChoice(response, testCase) {
  assert.match(response.response, /Stair-step conversion/i, `${testCase.name} should offer stair-step method`);
  assert.match(response.response, /Picket fence|dimensional analysis/i, `${testCase.name} should offer picket fence method`);
  assert.doesNotMatch(response.response, /Density formula/i, `${testCase.name} should not offer density formula`);
  assert.doesNotMatch(response.response, /Metric stair-step/i, `${testCase.name} should not render stair-step visual before method choice`);
  assert.doesNotMatch(response.response, /Picket fence method/i, `${testCase.name} should not render picket-fence visual before method choice`);
  assert.doesNotMatch(response.response, /Move decimal left|Move decimal right/i, `${testCase.name} should not render movement controls before method choice`);
  const choices = response.tutor?.currentStep?.choices || [];
  assert.equal(choices.length, 2, `${testCase.name} should expose exactly two method choices`);
  assert.deepEqual(
    choices.map((choice) => choice.label),
    ['Stair-step conversion', 'Picket fence / dimensional analysis'],
    `${testCase.name} method choices`
  );
}

async function assertMetricMethodBranches(request, sessionId) {
  const stairStart = await ask(request, sessionId, 'unit1-conversions-method-branch-stair-start', 'Convert 48 km to meters.');
  assertCleanMetricMethodChoice(stairStart, { name: 'metric-method-branch-stair' });
  const stair = await ask(request, sessionId, 'unit1-conversions-method-branch-stair-start', '1');
  assert.equal(stair.routeType, 'formula_tutor', 'stair-step method choice should stay in Formula Tutor');
  assert.equal(stair.tutor?.work?.selectedMethod, 'stair_step', 'stair-step method should be selected');
  assert.equal(stair.tutor?.totalSteps, 2, 'stair-step branch should have two total steps');
  assert.match(stair.response, /Step 2 of 2/i, 'stair-step branch should show Step 2 of 2');
  assert.match(stair.response, /Move the marker to the target unit/i, 'stair-step branch should tell students to move the marker');
  assert.doesNotMatch(stair.response, /What value and unit are we starting with|Which direction does the decimal move|How many metric steps|What is the final answer/i, 'stair-step branch should not ask extra text questions');
  assert.equal(stair.tutor?.work?.visualMetadata?.visualType, 'metric_stair_step', 'stair-step branch should show metric stair-step visual metadata');
  assert.notEqual(stair.tutor?.work?.visualMetadata?.visualType, 'picket_fence', 'stair-step branch should not show picket-fence visual metadata');
  assert.equal(stair.tutor?.work?.visualMetadata?.startUnit, 'km', 'stair-step branch should expose start unit');
  assert.equal(stair.tutor?.work?.visualMetadata?.targetUnit, 'm', 'stair-step branch should expose target unit');
  assertNearly(stair.tutor?.work?.visualMetadata?.resultValue, 48000, 'stair-step branch result value');
  assert.equal(stair.tutor?.work?.visualMetadata?.autoCompleteAnswer, '48,000 m', 'stair-step branch should expose auto-complete answer');
  assertMetricStepValueDisplays(stair.tutor?.work?.visualMetadata, ['48 km', '480 hm', '4,800 dam', '48,000 m']);
  assert.equal(stair.tutor?.work?.currentStep?.suppressFormulaDetails, true, 'stair-step visual step should suppress formula detail rows');
  assert.equal(stair.tutor?.work?.currentStep?.suppressKnownValues, true, 'stair-step visual step should suppress known values');
  assert.doesNotMatch(stair.response, /\bdraw\b/i, 'stair-step branch should not use draw language');
  const completedStair = await ask(request, sessionId, 'unit1-conversions-method-branch-stair-start', '48,000 m');
  assert.equal(completedStair.routeType, 'formula_tutor', 'stair-step completion should stay Formula Tutor');
  assert.equal(completedStair.tutor?.completed, true, 'stair-step final marker answer should complete the tutor');
  assert.equal(completedStair.tutor?.active, false, 'stair-step final marker answer should deactivate the tutor');
  assert.match(completedStair.response, /Correct/i, 'stair-step final marker answer should be marked correct');
  assert.match(completedStair.response, /48 km\s*=\s*48,?000 m/i, 'stair-step final marker answer should show clean equation final answer');

  const picketStart = await ask(request, sessionId, 'unit1-conversions-method-branch-picket-start', 'Convert 48 km to meters.');
  assertCleanMetricMethodChoice(picketStart, { name: 'metric-method-branch-picket' });
  const picket = await ask(request, sessionId, 'unit1-conversions-method-branch-picket-start', '2');
  assert.equal(picket.routeType, 'formula_tutor', 'picket-fence method choice should stay in Formula Tutor');
  assert.equal(picket.tutor?.work?.selectedMethod, 'picket_fence', 'picket-fence method should be selected');
  assert.equal(picket.tutor?.totalSteps, 6, 'picket-fence branch should have six total steps');
  assert.match(picket.response, /Step 2 of 6/i, 'picket-fence branch should show Step 2 of 6');
  assert.match(picket.response, /Type the given number/i, 'picket-fence branch should use a short fill-in prompt');
  assert.equal((picket.tutor?.currentStep?.choices || []).length, 0, 'picket-fence fill step should not use multiple-choice options');
  assert.equal(picket.tutor?.work?.currentStep?.suppressFormulaDetails, true, 'picket-fence fill step should suppress formula detail rows');
  assert.equal(picket.tutor?.work?.currentStep?.suppressKnownValues, true, 'picket-fence fill step should suppress known values');
  assert.equal(picket.tutor?.work?.visualMetadata?.visualType, 'picket_fence', 'picket-fence branch should show picket-fence visual metadata');
  assert.notEqual(picket.tutor?.work?.visualMetadata?.visualType, 'metric_stair_step', 'picket-fence branch should not show stair-step visual metadata');
  assertPicketFenceFillableSections(picket.tutor?.work?.visualMetadata, { name: 'metric-method-branch-picket' });
  assert.doesNotMatch(picket.response, /\bdraw\b/i, 'picket-fence branch should not use draw language');
  assert.doesNotMatch(picket.response, /Which conversion factor belongs|Choose one|1\.\s*1,?000 m/i, 'picket-fence branch should not show multiple-choice conversion-factor clutter');

  const given = await ask(request, sessionId, 'unit1-conversions-method-branch-picket-start', '48');
  assertCompletedStep(given, 'identify_given_quantity');
  assert.match(given.response, /Choose or type the top number for the conversion factor/i, 'picket-fence branch should ask for the factor top number');
  assert.equal((given.tutor?.currentStep?.choices || []).length, 0, 'factor top should be typed, not multiple choice');
  assert.deepEqual(
    (given.tutor?.currentStep?.answerChips || []).map((chip) => chip.value),
    ['1,000', '1'],
    'factor top should expose bounded answer chips'
  );

  const top = await ask(request, sessionId, 'unit1-conversions-method-branch-picket-start', '1000');
  assertCompletedStep(top, 'fill_conversion_factor_top');
  assert.match(top.response, /Choose or type the bottom number for the conversion factor/i, 'picket-fence branch should ask for the factor bottom number');
  assert.equal((top.tutor?.currentStep?.choices || []).length, 0, 'factor bottom should be typed, not multiple choice');
  assert.deepEqual(
    (top.tutor?.currentStep?.answerChips || []).map((chip) => chip.value),
    ['1,000', '1'],
    'factor bottom should expose bounded answer chips'
  );

  const bottom = await ask(request, sessionId, 'unit1-conversions-method-branch-picket-start', '1');
  assertCompletedStep(bottom, 'fill_conversion_factor_bottom');
  assert.match(bottom.response, /Click each km unit in the fence to cross it out/i, 'picket-fence branch should ask for click-first unit cancellation');
  assert.doesNotMatch(bottom.response, /Click a unit that cancels, or type one|Type km/i, 'picket-fence branch should not present cancellation as type-first');
  assert.equal((bottom.tutor?.currentStep?.choices || []).length, 0, 'cancellation should be typed, not multiple choice');

  const wrongCancellation = await ask(request, sessionId, 'unit1-conversions-method-branch-picket-start', '48000');
  assert.match(wrongCancellation.response, /First click each km unit in the fence to cross it out/i, 'wrong final-number answer during cancellation should redirect to clicking units');
  assert.doesNotMatch(wrongCancellation.response, /Not quite yet\. Type km/i, 'wrong cancellation feedback should not say Type km');

  const cancelled = await ask(request, sessionId, 'unit1-conversions-method-branch-picket-start', 'km');
  assertCompletedStep(cancelled, 'cancel_units');
  assert.match(cancelled.response, /Type the final number only\. Do not include the unit/i, 'picket-fence branch should ask for final number only');
  assert.equal((cancelled.tutor?.currentStep?.answerChips || []).length, 0, 'final number should not be exposed as a chip');

  const completedPicket = await ask(request, sessionId, 'unit1-conversions-method-branch-picket-start', '48000');
  assert.equal(completedPicket.tutor?.completed, true, 'picket-fence final answer should complete the tutor');
  assert.equal(completedPicket.tutor?.active, false, 'picket-fence final answer should deactivate the tutor');
  assert.match(completedPicket.response, /48 km\s*=\s*48,?000 m|48,?000 m/i, 'picket-fence final answer should show the final result');

  await assertMetricPicketFinalAnswerAccepted(request, sessionId, '48000 m');
  await assertMetricPicketFinalAnswerAccepted(request, sessionId, '48,000 m');
}

async function assertMetricPicketFinalAnswerAccepted(request, sessionId, finalAnswer) {
  const studentHubId = `unit1-conversions-metric-picket-final-${finalAnswer.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const start = await ask(request, sessionId, studentHubId, 'Convert 48 km to meters.');
  const problemId = start.tutor?.tutorProblemId;
  assert.ok(problemId, `${finalAnswer} final-answer check should expose tutorProblemId`);
  await ask(request, sessionId, studentHubId, '2');
  await ask(request, sessionId, studentHubId, '48');
  await ask(request, sessionId, studentHubId, '1000');
  await ask(request, sessionId, studentHubId, '1');
  const readyForFinal = await ask(request, sessionId, studentHubId, 'km');
  assert.equal(readyForFinal.tutor?.tutorProblemId, problemId, `${finalAnswer} final-answer check should preserve tutorProblemId before final`);
  assert.equal(readyForFinal.tutor?.currentStep?.id, 'calculate_result', `${finalAnswer} final-answer check should reach final-number step`);
  assert.match(readyForFinal.response, /Type the final number only\. Do not include the unit/i, `${finalAnswer} final-answer prompt should still ask for number only`);

  const completed = await ask(request, sessionId, studentHubId, finalAnswer);
  assert.equal(completed.routeType, 'formula_tutor', `${finalAnswer} should stay Formula Tutor`);
  assert.equal(completed.tutor?.tutorProblemId, problemId, `${finalAnswer} should preserve tutorProblemId`);
  assert.equal(completed.tutor?.completed, true, `${finalAnswer} should complete the tutor`);
  assert.match(completed.response, /48,?000 m/i, `${finalAnswer} should produce final answer with unit`);
}

async function assertMixedUnitPicketFenceTypedFlow(request, sessionId) {
  assert.match(
    unit1ConversionsSource,
    /function picketFenceCancellationStep\(id, unit\)[\s\S]*Click each \$\{unit\} unit in the fence to cross it out[\s\S]*Keyboard fallback: type \$\{unit\}[\s\S]*compactTextStep/,
    'picket-fence cancellation steps should be click-first while preserving typed fallback'
  );
  const studentHubId = 'unit1-conversions-mixed-picket-typed';
  const start = await ask(request, sessionId, studentHubId, 'Convert 250.4 cm to feet.');
  assert.equal(start.routeType, 'formula_tutor', 'mixed-unit conversion should start Formula Tutor');
  assert.equal(start.tutor?.formulaId, 'unit1_picket_fence_conversion', 'mixed-unit conversion should use picket-fence formula id');
  assert.ok(start.tutor?.tutorProblemId, 'mixed-unit picket fence should expose tutorProblemId');
  assert.equal(start.tutor?.currentStep?.id, 'identify_given_quantity', 'mixed-unit picket fence should start with typed given number');
  assert.match(start.response, /Type the given number/i, 'mixed-unit picket fence should use a short typed prompt');
  assertNoMixedPicketClutter(start, 'mixed-unit start');
  assert.equal((start.tutor?.currentStep?.choices || []).length, 0, 'mixed-unit given number should not use multiple choice');
  assert.equal(start.tutor?.work?.currentStep?.suppressFormulaDetails, true, 'mixed-unit given step should suppress formula detail rows');
  assert.equal(start.tutor?.work?.currentStep?.suppressKnownValues, true, 'mixed-unit given step should suppress known values');
  assert.equal(start.tutor?.work?.visualMetadata?.visualType, 'picket_fence', 'mixed-unit conversion should expose picket-fence visual metadata');
  assert.equal(start.tutor?.work?.visualMetadata?.given?.unit, 'cm', 'mixed-unit visual should supply starting unit');
  assert.equal(start.tutor?.work?.visualMetadata?.targetUnit, 'ft', 'mixed-unit visual should supply target unit');
  assertPicketFenceFillableSections(start.tutor?.work?.visualMetadata, { name: 'mixed-unit-picket' });

  const problemId = start.tutor.tutorProblemId;
  const given = await ask(request, sessionId, studentHubId, '250.4');
  assertSameMixedPicketProblem(given, problemId, 'given number');
  assertCompletedStep(given, 'identify_given_quantity');
  assert.match(given.response, /Choose or type the top number for the conversion factor/i, 'mixed-unit picket should ask for first top number');
  assert.deepEqual(
    (given.tutor?.currentStep?.answerChips || []).map((chip) => chip.value),
    ['1', '2.54', '12'],
    'mixed-unit factor step should expose bounded conversion-factor number chips'
  );

  const firstTop = await ask(request, sessionId, studentHubId, '1');
  assertSameMixedPicketProblem(firstTop, problemId, 'first top number');
  assertCompletedStep(firstTop, 'fill_conversion_factor_0_top');
  assert.match(firstTop.response, /Choose or type the bottom number for the conversion factor/i, 'mixed-unit picket should ask for first bottom number');

  const firstBottom = await ask(request, sessionId, studentHubId, '2.54');
  assertSameMixedPicketProblem(firstBottom, problemId, 'first bottom number');
  assertCompletedStep(firstBottom, 'fill_conversion_factor_0_bottom');
  assert.match(firstBottom.response, /Choose or type the top number for the conversion factor/i, 'mixed-unit picket should ask for second top number');

  const secondTop = await ask(request, sessionId, studentHubId, '1');
  assertSameMixedPicketProblem(secondTop, problemId, 'second top number');
  assertCompletedStep(secondTop, 'fill_conversion_factor_1_top');
  assert.match(secondTop.response, /Choose or type the bottom number for the conversion factor/i, 'mixed-unit picket should ask for second bottom number');

  const secondBottom = await ask(request, sessionId, studentHubId, '12');
  assertSameMixedPicketProblem(secondBottom, problemId, 'second bottom number');
  assertCompletedStep(secondBottom, 'fill_conversion_factor_1_bottom');
  assert.equal(secondBottom.tutor?.currentStep?.id, 'cancel_units_cm', 'mixed-unit first cancellation step should target cm');
  assert.match(secondBottom.response, /Click each cm unit in the fence to cross it out/i, 'mixed-unit picket should use click-first cm cancellation wording');
  assert.doesNotMatch(secondBottom.response, /Click a unit that cancels, or type one|Type cm/i, 'mixed-unit cm cancellation should not be type-first');
  const visibleCancellationUnits = (secondBottom.tutor?.work?.visualMetadata?.cancellationSteps || [])
    .map((step) => String(step.unit || '').toLowerCase())
    .filter(Boolean);
  assert.ok(
    visibleCancellationUnits.includes('cm'),
    'mixed-unit visual should expose cm cancellation unit for click/tap fallback'
  );
  assert.ok(
    visibleCancellationUnits.includes('in'),
    'mixed-unit visual should expose in cancellation unit for click/tap fallback'
  );

  const cmCancelled = await ask(request, sessionId, studentHubId, 'cm');
  assertSameMixedPicketProblem(cmCancelled, problemId, 'typed cm cancellation fallback');
  assertCompletedStep(cmCancelled, 'cancel_units_cm');
  assert.equal(cmCancelled.tutor?.currentStep?.id, 'cancel_units_in', 'mixed-unit cm cancellation should advance to in cancellation step');
  assert.match(cmCancelled.response, /Click each in unit in the fence to cross it out/i, 'mixed-unit picket should use click-first in cancellation wording');
  assert.doesNotMatch(cmCancelled.response, /Click a unit that cancels, or type one|Type in/i, 'mixed-unit in cancellation should not be type-first');
  assert.doesNotMatch(cmCancelled.response, /Type the final number only\. Do not include the unit/i, 'mixed-unit cm cancellation should not skip in cancellation');

  const inCancelled = await ask(request, sessionId, studentHubId, 'in');
  assertSameMixedPicketProblem(inCancelled, problemId, 'typed in cancellation fallback');
  assertCompletedStep(inCancelled, 'cancel_units_in');
  assert.match(inCancelled.response, /Type the final number only\. Do not include the unit/i, 'mixed-unit picket should ask for final number only after both units cancel');
  assert.equal((inCancelled.tutor?.currentStep?.answerChips || []).length, 0, 'mixed-unit final number should not be exposed as a chip');

  const completed = await ask(request, sessionId, studentHubId, '8.22');
  assert.equal(completed.routeType, 'formula_tutor', 'mixed-unit final answer should stay Formula Tutor');
  assert.equal(completed.tutor?.tutorProblemId, problemId, 'mixed-unit final answer should preserve tutorProblemId');
  assert.equal(completed.tutor?.completed, true, 'mixed-unit final answer should complete tutor');
  assert.equal(completed.tutor?.active, false, 'mixed-unit final answer should deactivate tutor');
  assert.match(completed.response, /8\.22 ft/i, 'mixed-unit final answer should include final units');

  const fresh = await ask(request, sessionId, studentHubId, 'Convert 48 cm to meters.');
  assert.equal(fresh.routeType, 'formula_tutor', 'new full question after mixed-unit completion should start Formula Tutor');
  assert.notEqual(fresh.tutor?.tutorProblemId, problemId, 'new full conversion should get a separate tutorProblemId');

  await assertMixedUnitCancellationOrder(request, sessionId);
}

async function assertMixedUnitCancellationOrder(request, sessionId) {
  const studentHubId = 'unit1-conversions-mixed-picket-cancel-order';
  const start = await ask(request, sessionId, studentHubId, 'Convert 250.4 cm to feet.');
  const problemId = start.tutor?.tutorProblemId;
  assert.ok(problemId, 'mixed-unit cancellation order check should expose tutorProblemId');

  await ask(request, sessionId, studentHubId, '250.4');
  await ask(request, sessionId, studentHubId, '1');
  await ask(request, sessionId, studentHubId, '2.54');
  await ask(request, sessionId, studentHubId, '1');
  const readyToCancel = await ask(request, sessionId, studentHubId, '12');
  assertSameMixedPicketProblem(readyToCancel, problemId, 'ready-to-cancel step');
  assert.equal(readyToCancel.tutor?.currentStep?.id, 'cancel_units_cm', 'mixed-unit cancellation should start with cm');
  assert.ok(
    (readyToCancel.tutor?.work?.visualMetadata?.cancellationSteps || [])
      .some((step) => String(step.unit || '').toLowerCase() === 'in'),
    'in should be visible in visual metadata but should not be the first active cancellation step'
  );

  const wrongOrder = await ask(request, sessionId, studentHubId, 'in');
  assertSameMixedPicketProblem(wrongOrder, problemId, 'wrong-order in cancellation answer');
  assert.equal(wrongOrder.tutor?.currentStep?.id, 'cancel_units_cm', 'typing in before cm should stay on cm cancellation step');
  assert.doesNotMatch(wrongOrder.response, /Type the final number only/i, 'typing in before cm should not advance to final-number step');

  const cmCancelled = await ask(request, sessionId, studentHubId, 'cm');
  assertSameMixedPicketProblem(cmCancelled, problemId, 'cm cancellation answer');
  assertCompletedStep(cmCancelled, 'cancel_units_cm');
  assert.equal(cmCancelled.tutor?.currentStep?.id, 'cancel_units_in', 'cm cancellation should advance to in cancellation');

  const inCancelled = await ask(request, sessionId, studentHubId, 'in');
  assertSameMixedPicketProblem(inCancelled, problemId, 'in cancellation answer');
  assertCompletedStep(inCancelled, 'cancel_units_in');
  assert.equal(inCancelled.tutor?.currentStep?.id, 'calculate_result', 'in cancellation should advance to final-number step');
}

function assertNoMixedPicketClutter(response, label) {
  assert.doesNotMatch(response.response, /density formula/i, `${label} should not offer density formula`);
  assert.doesNotMatch(response.response, /metric stair-step/i, `${label} should not offer metric stair-step for mixed-unit picket fence`);
  assert.doesNotMatch(response.response, /\bdraw\b/i, `${label} should not use draw language`);
  assert.doesNotMatch(response.response, /Choose one:/i, `${label} should not use multiple-choice fill values`);
}

function assertSameMixedPicketProblem(response, problemId, label) {
  assert.equal(response.routeType, 'formula_tutor', `${label} should stay in Formula Tutor`);
  assert.equal(response.tutor?.tutorProblemId, problemId, `${label} should stay in same tutorProblemId`);
  assert.equal((response.tutor?.currentStep?.choices || []).length, 0, `${label} should not use multiple-choice fill values`);
  assertNoMixedPicketClutter(response, label);
}

function assertMetricStepValueDisplays(visual, expectedDisplays) {
  const displays = (visual?.stepValues || []).map((item) => item.display);
  for (const expected of expectedDisplays) {
    assert.ok(displays.includes(expected), `metric stair-step values should include ${expected}`);
  }
}

function assertCompletedStep(response, stepId) {
  const completedSteps = response.tutor?.work?.completedSteps || response.tutor?.completedSteps || [];
  assert.ok(completedSteps.includes(stepId), `completed steps should include ${stepId}`);
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

function assertDirectAnswer(response, name) {
  assert.notEqual(response.routeType, 'concept_tutor', `${name} should stay Direct Answer, not Concept Tutor`);
  assert.notEqual(response.routeType, 'formula_tutor', `${name} should stay Direct Answer, not Formula Tutor`);
  assert.match(response.routeType, /definition|science_concept/i, `${name} should use a direct local route`);
}

function assertAnswer(answer, testCase) {
  const answerText = String(answer || '');
  assert.ok(answerText.trim(), `${testCase.name || testCase.prompt} should produce an answer`);
  for (const expected of testCase.includes || []) {
    assert.match(answerText, expected, `${testCase.name || testCase.prompt} should include ${expected} but got:\n${answerText}`);
  }
}

function assertVisualMetadata(visual, testCase) {
  assert.ok(visual, `${testCase.name} should include visual metadata`);
  assert.equal(visual.visualType, testCase.visualType, `${testCase.name} visualType`);
  if (testCase.visualType === 'metric_stair_step') {
    assert.equal(visual.startUnit, testCase.visual.startUnit, `${testCase.name} startUnit`);
    assert.equal(visual.targetUnit, testCase.visual.targetUnit, `${testCase.name} targetUnit`);
    assert.equal(visual.resultUnit, testCase.visual.resultUnit, `${testCase.name} resultUnit`);
    assertNearly(visual.resultValue, testCase.visual.resultValue, `${testCase.name} resultValue`);
    assert.equal(visual.decimalMove?.direction, testCase.visual.direction, `${testCase.name} decimal direction`);
    assert.equal(visual.decimalMove?.places, testCase.visual.places, `${testCase.name} decimal places`);
    assert.ok(Array.isArray(visual.steps) && visual.steps.length >= 10, `${testCase.name} should include metric staircase steps`);
    assert.ok(Array.isArray(visual.stepValues) && visual.stepValues.length >= 10, `${testCase.name} should include live value displays for each metric step`);
    assert.ok(visual.stepValues.some((item) => item.unit === testCase.visual.startUnit), `${testCase.name} should include start unit value display`);
    assert.ok(visual.stepValues.some((item) => item.unit === testCase.visual.targetUnit), `${testCase.name} should include target unit value display`);
    assertMethodChoices(visual, testCase);
    assertPicketFenceFillableSections(visual.methodVisuals?.picketFence, testCase);
  }
  if (testCase.visualType === 'picket_fence') {
    assert.equal(visual.given?.unit, testCase.visual.givenUnit, `${testCase.name} given unit`);
    assert.equal(visual.targetUnit, testCase.visual.targetUnit, `${testCase.name} targetUnit`);
    assert.equal(visual.arithmetic?.resultUnit, testCase.visual.resultUnit, `${testCase.name} resultUnit`);
    assertNearly(visual.arithmetic?.resultValue, testCase.visual.resultValue, `${testCase.name} resultValue`);
    assert.ok(Array.isArray(visual.conversionFactors) && visual.conversionFactors.length > 0, `${testCase.name} should include conversion factors`);
    assert.ok(Array.isArray(visual.cancellationSteps) && visual.cancellationSteps.length > 0, `${testCase.name} should include cancellation steps`);
    assertPicketFenceFillableSections(visual, testCase);
  }
  if (testCase.visualType === 'temperature_conversion') {
    assert.equal(visual.resultUnit, testCase.visual.resultUnit, `${testCase.name} resultUnit`);
    assertNearly(visual.resultValue, testCase.visual.resultValue, `${testCase.name} resultValue`);
    assert.ok(visual.formula, `${testCase.name} should include formula`);
  }
  if (testCase.visualType === 'scientific_notation_decimal_move') {
    if (testCase.visual.exponent != null) assert.equal(visual.exponent, testCase.visual.exponent, `${testCase.name} exponent`);
    if (testCase.visual.coefficient != null) assertNearly(visual.coefficient, testCase.visual.coefficient, `${testCase.name} coefficient`);
    if (testCase.visual.resultValue != null) assertNearly(visual.resultValue, testCase.visual.resultValue, `${testCase.name} resultValue`);
    assert.equal(visual.decimalMove?.direction, testCase.visual.direction, `${testCase.name} decimal direction`);
    assert.equal(visual.decimalMove?.places, testCase.visual.places, `${testCase.name} decimal places`);
  }
}

function assertMethodChoices(visual, testCase) {
  if (!testCase.methodChoices) return;
  const methodLabels = (visual.methodChoices || []).map((choice) => choice.label || '').join(' ');
  for (const expected of testCase.methodChoices) {
    assert.match(methodLabels, expected, `${testCase.name} method choices should include ${expected}`);
  }
}

function assertPicketFenceFillableSections(visual, testCase) {
  assert.ok(visual, `${testCase.name} should include picket fence visual metadata`);
  assert.equal(visual.visualType, 'picket_fence', `${testCase.name} picket fence visual type`);
  const sectionIds = (visual.fillableSections || []).map((section) => section.id);
  for (const id of [
    'given_value',
    'conversion_factor_0_numerator',
    'conversion_factor_0_denominator',
    'canceled_units',
    'top_product',
    'bottom_product',
    'final_answer'
  ]) {
    assert.ok(sectionIds.includes(id), `${testCase.name} fillable sections should include ${id}`);
  }
}

function assertNearly(actual, expected, label) {
  assert.ok(Number.isFinite(Number(actual)), `${label} should be numeric, got ${actual}`);
  assert.ok(Math.abs(Number(actual) - Number(expected)) < 1e-6, `${label}: expected ${expected}, got ${actual}`);
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
