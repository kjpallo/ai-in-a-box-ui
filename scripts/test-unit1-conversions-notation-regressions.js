const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

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
    visual: { startUnit: 'km', targetUnit: 'm', resultUnit: 'm', resultValue: 48000, direction: 'right', places: 3 }
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

async function main() {
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
  }

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

  console.log('PASS Unit 1 conversions/notation regressions: direct answers, formula tutor coverage, visual metadata, and route boundaries');
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
  }
  if (testCase.visualType === 'picket_fence') {
    assert.equal(visual.given?.unit, testCase.visual.givenUnit, `${testCase.name} given unit`);
    assert.equal(visual.targetUnit, testCase.visual.targetUnit, `${testCase.name} targetUnit`);
    assert.equal(visual.arithmetic?.resultUnit, testCase.visual.resultUnit, `${testCase.name} resultUnit`);
    assertNearly(visual.arithmetic?.resultValue, testCase.visual.resultValue, `${testCase.name} resultValue`);
    assert.ok(Array.isArray(visual.conversionFactors) && visual.conversionFactors.length > 0, `${testCase.name} should include conversion factors`);
    assert.ok(Array.isArray(visual.cancellationSteps) && visual.cancellationSteps.length > 0, `${testCase.name} should include cancellation steps`);
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
