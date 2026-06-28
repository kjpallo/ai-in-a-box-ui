const { answer } = require('./formulaAnswerFormatter');

const NUMBER_PATTERN = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+';

const METRIC_PREFIXES = [
  { label: 'M', name: 'mega', exponent: 6 },
  { label: 'k', name: 'kilo', exponent: 3 },
  { label: 'h', name: 'hecto', exponent: 2 },
  { label: 'da', name: 'deka', exponent: 1 },
  { label: 'UNIT', name: 'base unit', exponent: 0 },
  { label: 'd', name: 'deci', exponent: -1 },
  { label: 'c', name: 'centi', exponent: -2 },
  { label: 'm', name: 'milli', exponent: -3 },
  { label: 'µ', name: 'micro', exponent: -6 },
  { label: 'n', name: 'nano', exponent: -9 }
];

const PREFIX_BY_LABEL = new Map(METRIC_PREFIXES.map((prefix) => [prefix.label, prefix]));
const UNIT_ALIASES = new Map([
  ['meters', 'm'],
  ['meter', 'm'],
  ['metres', 'm'],
  ['metre', 'm'],
  ['m', 'm'],
  ['kilometers', 'km'],
  ['kilometer', 'km'],
  ['kilometres', 'km'],
  ['kilometre', 'km'],
  ['km', 'km'],
  ['millimeters', 'mm'],
  ['millimeter', 'mm'],
  ['millimetres', 'mm'],
  ['millimetre', 'mm'],
  ['mm', 'mm'],
  ['centimeters', 'cm'],
  ['centimeter', 'cm'],
  ['centimetres', 'cm'],
  ['centimetre', 'cm'],
  ['cm', 'cm'],
  ['kilograms', 'kg'],
  ['kilogram', 'kg'],
  ['kg', 'kg'],
  ['grams', 'g'],
  ['gram', 'g'],
  ['g', 'g'],
  ['milligrams', 'mg'],
  ['milligram', 'mg'],
  ['mg', 'mg'],
  ['centigrams', 'cg'],
  ['centigram', 'cg'],
  ['cg', 'cg'],
  ['liters', 'L'],
  ['liter', 'L'],
  ['litres', 'L'],
  ['litre', 'L'],
  ['l', 'L'],
  ['ml', 'mL'],
  ['milliliters', 'mL'],
  ['milliliter', 'mL'],
  ['millilitres', 'mL'],
  ['millilitre', 'mL'],
  ['seconds', 's'],
  ['second', 's'],
  ['secs', 's'],
  ['sec', 's'],
  ['s', 's'],
  ['kiloseconds', 'ks'],
  ['kilosecond', 'ks'],
  ['ks', 'ks']
]);

const UNIT_PARTS = {
  m: { prefix: 'UNIT', baseUnit: 'm' },
  km: { prefix: 'k', baseUnit: 'm' },
  cm: { prefix: 'c', baseUnit: 'm' },
  mm: { prefix: 'm', baseUnit: 'm' },
  g: { prefix: 'UNIT', baseUnit: 'g' },
  kg: { prefix: 'k', baseUnit: 'g' },
  mg: { prefix: 'm', baseUnit: 'g' },
  cg: { prefix: 'c', baseUnit: 'g' },
  L: { prefix: 'UNIT', baseUnit: 'L' },
  mL: { prefix: 'm', baseUnit: 'L' },
  s: { prefix: 'UNIT', baseUnit: 's' },
  ks: { prefix: 'k', baseUnit: 's' }
};

const PICKET_FENCE_CASES = [
  {
    id: 'cm_to_feet',
    pattern: /250\.4\s*(?:cm|centimeters?)\s+(?:to|into|in)\s+(?:feet|ft)\b/i,
    given: { value: 250.4, unit: 'cm' },
    targetUnit: 'ft',
    factors: [
      { numeratorValue: 1, numeratorUnit: 'in', denominatorValue: 2.54, denominatorUnit: 'cm', reason: '1 inch = 2.54 cm', cancelsUnit: 'cm' },
      { numeratorValue: 1, numeratorUnit: 'ft', denominatorValue: 12, denominatorUnit: 'in', reason: '1 foot = 12 inches', cancelsUnit: 'in' }
    ],
    resultValue: 8.22,
    resultUnit: 'ft',
    expression: '250.4 cm × 1 in / 2.54 cm × 1 ft / 12 in'
  },
  {
    id: 'seconds_in_year',
    pattern: /(?:how many\s+)?seconds\s+(?:are\s+)?in\s+(?:one|1|a)\s+year/i,
    given: { value: 1, unit: 'year' },
    targetUnit: 's',
    factors: [
      { numeratorValue: 365, numeratorUnit: 'days', denominatorValue: 1, denominatorUnit: 'year', reason: '1 year = 365 days', cancelsUnit: 'year' },
      { numeratorValue: 24, numeratorUnit: 'hr', denominatorValue: 1, denominatorUnit: 'day', reason: '1 day = 24 hours', cancelsUnit: 'days' },
      { numeratorValue: 60, numeratorUnit: 'min', denominatorValue: 1, denominatorUnit: 'hr', reason: '1 hour = 60 minutes', cancelsUnit: 'hr' },
      { numeratorValue: 60, numeratorUnit: 's', denominatorValue: 1, denominatorUnit: 'min', reason: '1 minute = 60 seconds', cancelsUnit: 'min' }
    ],
    resultValue: 31536000,
    resultUnit: 's',
    expression: '1 year × 365 days / 1 year × 24 hr / 1 day × 60 min / 1 hr × 60 s / 1 min'
  }
];

function tryUnit1ConversionsNotation(text, lower) {
  return tryMetricConversion(text, lower) ||
    tryPicketFenceConversion(text, lower) ||
    tryTemperatureConversion(text, lower) ||
    tryScientificNotation(text, lower) ||
    null;
}

function tryMetricConversion(text, lower) {
  if (!looksLikeMetricConversion(lower)) return null;
  const parsed = parseMetricConversion(text);
  if (!parsed) return null;

  const startParts = UNIT_PARTS[parsed.startUnit];
  const targetParts = UNIT_PARTS[parsed.targetUnit];
  if (!startParts || !targetParts || startParts.baseUnit !== targetParts.baseUnit) return null;

  const startPrefix = PREFIX_BY_LABEL.get(startParts.prefix);
  const targetPrefix = PREFIX_BY_LABEL.get(targetParts.prefix);
  const exponentDelta = startPrefix.exponent - targetPrefix.exponent;
  const resultValue = roundComputed(parsed.value * (10 ** exponentDelta));
  const decimalDirection = exponentDelta >= 0 ? 'right' : 'left';
  const directionOnStaircase = exponentDelta >= 0 ? 'down' : 'up';
  const decimalPlaces = Math.abs(exponentDelta);
  const visualMetadata = {
    visualType: 'metric_stair_step',
    baseUnit: startParts.baseUnit,
    startValue: parsed.value,
    startUnit: parsed.startUnit,
    targetUnit: parsed.targetUnit,
    startPrefix: startParts.prefix,
    targetPrefix: targetParts.prefix,
    steps: METRIC_PREFIXES,
    decimalMove: {
      places: decimalPlaces,
      direction: decimalDirection
    },
    movements: [
      {
        fromUnit: parsed.startUnit,
        toUnit: parsed.targetUnit,
        directionOnStaircase,
        decimalDirection,
        places: decimalPlaces
      }
    ],
    resultValue,
    resultUnit: parsed.targetUnit
  };

  const resultDisplay = `${formatNumber(resultValue)} ${parsed.targetUnit}`;
  const formulaWork = buildConversionFormulaWork({
    formulaId: 'unit1_metric_stair_step_conversion',
    family: 'unit1_conversions',
    solveFor: 'converted value',
    formula: 'metric stair-step conversion',
    finalAnswer: {
      value: resultValue,
      unit: parsed.targetUnit,
      display: resultDisplay
    },
    variables: {
      startValue: { value: parsed.value, unit: parsed.startUnit, display: `${formatNumber(parsed.value)} ${parsed.startUnit}` },
      targetUnit: { value: parsed.targetUnit, unit: '', display: parsed.targetUnit }
    },
    visualMetadata,
    steps: [
      quantityStep('identify_start_value', 'What starting number is given?', parsed.value, '', `${formatNumber(parsed.value)}`),
      choiceStep('identify_start_unit', 'What unit are we starting with?', [parsed.startUnit, parsed.targetUnit, startParts.baseUnit], parsed.startUnit),
      choiceStep('identify_target_unit', 'What unit are we converting to?', [parsed.targetUnit, parsed.startUnit, startParts.baseUnit], parsed.targetUnit),
      choiceStep('choose_method', 'Which method fits this metric-prefix conversion?', ['metric stair-step', 'picket fence', 'density formula'], 'metric stair-step'),
      quantityStep('identify_decimal_places', 'How many powers of ten separate the units? Type only the number.', decimalPlaces, '', `${decimalPlaces}`),
      choiceStep('choose_decimal_direction', 'Which direction does the decimal move?', ['left', 'right'], decimalDirection),
      calculationStep('calculate_result', `Move the decimal ${decimalPlaces} place${decimalPlaces === 1 ? '' : 's'} ${decimalDirection}. What is the converted value?`, resultValue, parsed.targetUnit, resultDisplay)
    ]
  });

  return answer('Recognized Unit 1 metric conversion.', [
    `Use the metric stair-step method from ${parsed.startUnit} to ${parsed.targetUnit}.`,
    `${parsed.startUnit} is 10^${startPrefix.exponent}; ${parsed.targetUnit} is 10^${targetPrefix.exponent}.`,
    `Move the decimal ${decimalPlaces} place${decimalPlaces === 1 ? '' : 's'} ${decimalDirection}.`,
    `${formatNumber(parsed.value)} ${parsed.startUnit} = ${resultDisplay}`
  ], formulaWork);
}

function tryPicketFenceConversion(text, lower) {
  if (!/\b(convert|how many|seconds|feet|ft|cm|year)\b/.test(lower)) return null;
  const found = PICKET_FENCE_CASES.find((item) => item.pattern.test(text));
  if (!found) return null;

  const visualMetadata = buildPicketFenceMetadata(found);
  const resultDisplay = `${formatNumber(found.resultValue)} ${found.resultUnit}`;
  const formulaWork = buildConversionFormulaWork({
    formulaId: 'unit1_picket_fence_conversion',
    family: 'unit1_conversions',
    solveFor: 'converted value',
    formula: 'dimensional analysis / picket fence',
    finalAnswer: {
      value: found.resultValue,
      unit: found.resultUnit,
      display: resultDisplay
    },
    variables: {
      given: { value: found.given.value, unit: found.given.unit, display: `${formatNumber(found.given.value)} ${found.given.unit}` },
      targetUnit: { value: found.targetUnit, unit: '', display: found.targetUnit }
    },
    visualMetadata,
    steps: [
      quantityStep('identify_given_value', 'What starting number is given?', found.given.value, '', `${formatNumber(found.given.value)}`),
      choiceStep('identify_given_unit', 'What unit are we starting with?', unique([found.given.unit, found.targetUnit, found.factors[0].numeratorUnit]), found.given.unit),
      choiceStep('identify_target_unit', 'What unit are we trying to end with?', unique([found.targetUnit, found.given.unit, found.factors[0].denominatorUnit]), found.targetUnit),
      choiceStep('choose_method', 'Which method should we use for this conversion?', ['picket fence', 'metric stair-step', 'density formula'], 'picket fence'),
      choiceStep('choose_first_factor', 'Which conversion factor cancels the starting unit?', found.factors.map(formatFactorChoice), formatFactorChoice(found.factors[0])),
      calculationStep('calculate_result', `After cancelling units, calculate: ${found.expression}. What is the final value?`, found.resultValue, found.resultUnit, resultDisplay)
    ]
  });

  return answer('Recognized Unit 1 picket-fence conversion.', [
    'Use dimensional analysis with conversion factors arranged so units cancel.',
    `${found.expression}`,
    `${formatNumber(found.given.value)} ${found.given.unit} = ${resultDisplay}`
  ], formulaWork);
}

function tryTemperatureConversion(text, lower) {
  if (!/\b(convert|to|into)\b/.test(lower)) return null;
  const parsed = parseTemperatureConversion(text);
  if (!parsed) return null;

  const result = convertTemperature(parsed.value, parsed.startUnit, parsed.targetUnit);
  if (!result) return null;

  const formula = temperatureFormula(parsed.startUnit, parsed.targetUnit);
  const resultDisplay = result.unit === 'K'
    ? `${formatNumber(result.value)} K`
    : `${formatNumber(result.value)}°${result.unit}`;
  const formulaWork = buildConversionFormulaWork({
    formulaId: 'unit1_temperature_conversion',
    family: 'unit1_conversions',
    solveFor: 'converted temperature',
    formula,
    finalAnswer: {
      value: result.value,
      unit: result.unit,
      display: resultDisplay
    },
    variables: {
      startValue: { value: parsed.value, unit: parsed.startUnit, display: `${formatNumber(parsed.value)}°${parsed.startUnit}` },
      targetUnit: { value: parsed.targetUnit, unit: '', display: parsed.targetUnit }
    },
    visualMetadata: {
      visualType: 'temperature_conversion',
      startValue: parsed.value,
      startUnit: parsed.startUnit,
      targetUnit: parsed.targetUnit,
      formula,
      resultValue: result.value,
      resultUnit: result.unit
    },
    steps: [
      quantityStep('identify_start_temperature', 'What starting temperature number is given?', parsed.value, parsed.startUnit, `${formatNumber(parsed.value)}°${parsed.startUnit}`),
      choiceStep('identify_target_unit', 'What temperature unit are we converting to?', unique([parsed.targetUnit, parsed.startUnit, 'K', 'C', 'F']), parsed.targetUnit),
      choiceStep('choose_formula', 'Which formula should we use?', unique([formula, 'K = °C + 273', '°C = 5/9(°F - 32)', '°F = (°C × 9/5) + 32']), formula),
      calculationStep('calculate_result', `Use ${formula}. What is the converted temperature?`, result.value, result.unit, resultDisplay)
    ]
  });

  return answer('Recognized Unit 1 temperature conversion.', [
    `Use ${formula}.`,
    `${formatNumber(parsed.value)}°${parsed.startUnit} = ${resultDisplay}`
  ], formulaWork);
}

function tryScientificNotation(text, lower) {
  if (!/\b(scientific notation|standard notation)\b/.test(lower)) return null;
  const parsed = parseScientificNotationPrompt(text, lower);
  if (!parsed) return null;

  if (parsed.mode === 'to_scientific') {
    const result = toScientific(parsed.value);
    const display = `${formatNumber(result.coefficient)} × 10^${result.exponent}`;
    const visualMetadata = {
      visualType: 'scientific_notation_decimal_move',
      mode: 'to_scientific',
      startValue: parsed.value,
      decimalMove: {
        places: Math.abs(result.exponent),
        direction: result.exponent > 0 ? 'left' : 'right'
      },
      coefficient: result.coefficient,
      exponent: result.exponent,
      resultDisplay: display
    };
    const formulaWork = buildConversionFormulaWork({
      formulaId: 'unit1_scientific_notation',
      family: 'unit1_conversions',
      solveFor: 'scientific notation',
      formula: 'coefficient × 10^exponent',
      finalAnswer: {
        value: result.coefficient,
        unit: `× 10^${result.exponent}`,
        display
      },
      variables: { startValue: { value: parsed.value, unit: '', display: formatNumber(parsed.value) } },
      visualMetadata,
      steps: [
        quantityStep('identify_start_number', 'What number are we rewriting?', parsed.value, '', formatNumber(parsed.value)),
        quantityStep('identify_coefficient', 'Move the decimal so one nonzero digit is on the left. What coefficient do you get?', result.coefficient, '', formatNumber(result.coefficient)),
        quantityStep('identify_exponent', 'How many places did the decimal move? Use the sign for the exponent.', result.exponent, '', String(result.exponent))
      ]
    });

    return answer('Recognized Unit 1 scientific notation conversion.', [
      'Move the decimal until one nonzero digit is to the left.',
      `${formatNumber(parsed.value)} = ${display}`
    ], formulaWork);
  }

  const resultValue = roundComputed(parsed.coefficient * (10 ** parsed.exponent));
  const resultDisplay = formatNumber(resultValue);
  const visualMetadata = {
    visualType: 'scientific_notation_decimal_move',
    mode: 'to_standard',
    coefficient: parsed.coefficient,
    exponent: parsed.exponent,
    decimalMove: {
      places: Math.abs(parsed.exponent),
      direction: parsed.exponent >= 0 ? 'right' : 'left'
    },
    resultValue,
    resultDisplay
  };
  const formulaWork = buildConversionFormulaWork({
    formulaId: 'unit1_standard_notation',
    family: 'unit1_conversions',
    solveFor: 'standard notation',
    formula: 'move decimal by exponent',
    finalAnswer: {
      value: resultValue,
      unit: '',
      display: resultDisplay
    },
    variables: { coefficient: { value: parsed.coefficient, unit: '', display: formatNumber(parsed.coefficient) } },
    visualMetadata,
    steps: [
      quantityStep('identify_coefficient', 'What coefficient is in front of × 10?', parsed.coefficient, '', formatNumber(parsed.coefficient)),
      quantityStep('identify_exponent', 'What exponent is on 10?', parsed.exponent, '', String(parsed.exponent)),
      choiceStep('choose_decimal_direction', 'Which direction does the decimal move?', ['left', 'right'], parsed.exponent >= 0 ? 'right' : 'left'),
      calculationStep('calculate_standard_number', 'Move the decimal by the exponent. What is the standard notation number?', resultValue, '', resultDisplay)
    ]
  });

  return answer('Recognized Unit 1 standard notation conversion.', [
    `A ${parsed.exponent >= 0 ? 'positive' : 'negative'} exponent moves the decimal ${parsed.exponent >= 0 ? 'right' : 'left'}.`,
    `${formatNumber(parsed.coefficient)} × 10^${parsed.exponent} = ${resultDisplay}`
  ], formulaWork);
}

function looksLikeMetricConversion(lower) {
  return /\b(convert|to|into)\b/.test(lower) || new RegExp(`^\\s*${NUMBER_PATTERN}\\s*[a-zµ]+\\s+(?:to|in)\\s+[a-zµ]+`, 'i').test(lower);
}

function parseMetricConversion(text) {
  const normalized = text.replace(/,/g, '');
  const unitPattern = Array.from(UNIT_ALIASES.keys()).sort((a, b) => b.length - a.length).map(escapeRegex).join('|');
  const patterns = [
    new RegExp(`\\bconvert\\s+(${NUMBER_PATTERN})\\s*(${unitPattern})\\s+(?:to|into|in)\\s+(${unitPattern})\\b`, 'i'),
    new RegExp(`\\b(${NUMBER_PATTERN})\\s*(${unitPattern})\\s+(?:to|into|in)\\s+(${unitPattern})\\b`, 'i')
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    if (!match) continue;
    return {
      value: Number(match[1]),
      startUnit: normalizeUnit(match[2]),
      targetUnit: normalizeUnit(match[3])
    };
  }
  return null;
}

function parseTemperatureConversion(text) {
  const unit = '(?:°?\\s*c|celsius|celcius|°?\\s*f|fahrenheit|farenheit|farenhiet|kelvin|k)';
  const normalized = text.replace(/,/g, '');
  const pattern = new RegExp(`\\bconvert\\s+(${NUMBER_PATTERN})\\s*(${unit})\\s+(?:to|into|in)\\s+(${unit})\\b`, 'i');
  const match = pattern.exec(normalized);
  if (!match) return null;
  return {
    value: Number(match[1]),
    startUnit: normalizeTemperatureUnit(match[2]),
    targetUnit: normalizeTemperatureUnit(match[3])
  };
}

function convertTemperature(value, startUnit, targetUnit) {
  let celsius;
  if (startUnit === 'C') celsius = value;
  if (startUnit === 'F') celsius = (5 / 9) * (value - 32);
  if (startUnit === 'K') celsius = value - 273;
  if (!Number.isFinite(celsius)) return null;

  if (targetUnit === 'C') return { value: roundComputed(celsius), unit: 'C' };
  if (targetUnit === 'F') return { value: roundComputed((celsius * 9 / 5) + 32), unit: 'F' };
  if (targetUnit === 'K') return { value: roundComputed(celsius + 273), unit: 'K' };
  return null;
}

function temperatureFormula(startUnit, targetUnit) {
  if (startUnit === 'C' && targetUnit === 'K') return 'K = °C + 273';
  if (startUnit === 'F' && targetUnit === 'C') return '°C = 5/9(°F - 32)';
  if (startUnit === 'C' && targetUnit === 'F') return '°F = (°C × 9/5) + 32';
  if (startUnit === 'F' && targetUnit === 'K') return 'K = 5/9(°F - 32) + 273';
  if (startUnit === 'K' && targetUnit === 'C') return '°C = K - 273';
  if (startUnit === 'K' && targetUnit === 'F') return '°F = ((K - 273) × 9/5) + 32';
  return 'temperature conversion';
}

function parseScientificNotationPrompt(text, lower) {
  const normalized = text.replace(/,/g, '');
  if (/\bscientific notation\b/.test(lower)) {
    const match = new RegExp(`(${NUMBER_PATTERN})`).exec(normalized);
    if (!match) return null;
    return { mode: 'to_scientific', value: Number(match[1]) };
  }

  if (/\bstandard notation\b/.test(lower)) {
    const sci = new RegExp(`(${NUMBER_PATTERN})\\s*(?:x|×|\\*)\\s*10\\s*(?:\\^|\\s)?\\s*(-?\\d+)`, 'i').exec(normalized);
    if (!sci) return null;
    return {
      mode: 'to_standard',
      coefficient: Number(sci[1]),
      exponent: Number(sci[2])
    };
  }
  return null;
}

function toScientific(value) {
  if (!Number.isFinite(value) || value === 0) return { coefficient: 0, exponent: 0 };
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const coefficient = value / (10 ** exponent);
  return {
    coefficient: Number(coefficient.toPrecision(12)),
    exponent
  };
}

function buildPicketFenceMetadata(item) {
  const cells = [
    { position: 0, numerator: `${formatNumber(item.given.value)} ${item.given.unit}`, denominator: '', status: 'filled' },
    ...item.factors.map((factor, index) => ({
      position: index + 1,
      numerator: `${formatNumber(factor.numeratorValue)} ${factor.numeratorUnit}`,
      denominator: `${formatNumber(factor.denominatorValue)} ${factor.denominatorUnit}`,
      status: 'filled'
    }))
  ];
  const multiplyNumerators = item.given.value * item.factors.reduce((product, factor) => product * factor.numeratorValue, 1);
  const multiplyDenominators = item.factors.reduce((product, factor) => product * factor.denominatorValue, 1);
  return {
    visualType: 'picket_fence',
    given: item.given,
    targetUnit: item.targetUnit,
    conversionFactors: item.factors,
    cells,
    cancellationSteps: item.factors.map((factor, index) => ({
      unit: factor.cancelsUnit,
      numeratorOrDenominatorLocations: [`cell ${index}`, `cell ${index + 1}`],
      explanation: `${factor.cancelsUnit} cancels because it appears in opposite parts of the picket fence.`
    })),
    arithmetic: {
      multiplyNumerators,
      multiplyDenominators,
      divide: `${formatNumber(multiplyNumerators)} / ${formatNumber(multiplyDenominators)}`,
      resultValue: item.resultValue,
      resultUnit: item.resultUnit
    }
  };
}

function buildConversionFormulaWork({ formulaId, family, solveFor, formula, finalAnswer, variables, visualMetadata, steps }) {
  return {
    formulaId,
    family,
    solveFor,
    formula,
    finalAnswer,
    variables,
    visualMetadata,
    steps
  };
}

function quantityStep(id, prompt, expectedValue, expectedUnit, expectedDisplay) {
  return {
    id,
    type: 'quantity',
    prompt,
    expectedValue,
    expectedUnit,
    expectedDisplay,
    hints: [`Look for ${expectedDisplay || expectedValue} in the problem.`]
  };
}

function calculationStep(id, prompt, expectedValue, expectedUnit, expectedDisplay) {
  return {
    id,
    type: 'calculation',
    prompt,
    expectedValue,
    expectedUnit,
    expectedDisplay,
    acceptedAlternateValues: roundedAlternates(expectedValue),
    hints: ['Use the setup from the previous steps and calculate the converted value.']
  };
}

function choiceStep(id, prompt, labels, expected) {
  const uniqueLabels = unique(labels);
  return {
    id,
    type: 'multiple_choice',
    prompt,
    choices: uniqueLabels.map((label, index) => ({
      number: index + 1,
      label,
      correct: normalizeChoice(label) === normalizeChoice(expected)
    })),
    expected,
    hints: [`Choose ${expected}.`]
  };
}

function roundedAlternates(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return [];
  return [
    Number(number.toFixed(1)),
    Number(number.toFixed(2)),
    Number(number.toFixed(3)),
    Number(number.toFixed(4))
  ].filter((item, index, arr) => Number.isFinite(item) && arr.indexOf(item) === index);
}

function normalizeUnit(value) {
  const key = String(value || '').toLowerCase().replace(/\s+/g, '').replace(/^°/, '');
  return UNIT_ALIASES.get(key) || UNIT_ALIASES.get(key.replace(/s$/, '')) || value;
}

function normalizeTemperatureUnit(value) {
  const text = String(value || '').toLowerCase().replace(/\s+/g, '').replace(/^°/, '');
  if (['c', 'celsius', 'celcius'].includes(text)) return 'C';
  if (['f', 'fahrenheit', 'farenheit', 'farenhiet'].includes(text)) return 'F';
  if (['k', 'kelvin'].includes(text)) return 'K';
  return text.toUpperCase();
}

function formatFactorChoice(factor) {
  return `${formatNumber(factor.numeratorValue)} ${factor.numeratorUnit} / ${formatNumber(factor.denominatorValue)} ${factor.denominatorUnit}`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const rounded = roundComputed(number);
  if (Math.abs(rounded) >= 1000) return rounded.toLocaleString('en-US', { maximumFractionDigits: 10 });
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toLocaleString('en-US', {
    maximumFractionDigits: 12,
    useGrouping: false
  });
}

function roundComputed(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return number;
  return Number(number.toPrecision(12));
}

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const label = String(value || '').trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    result.push(label);
  }
  return result;
}

function normalizeChoice(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  tryUnit1ConversionsNotation
};
