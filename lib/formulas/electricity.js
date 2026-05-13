const {
  CURRENT_UNITS,
  POWER_UNITS,
  RESISTANCE_UNITS,
  VOLTAGE_UNITS,
  escapeRegex,
  findQuantity,
  parseQuantityNumber,
  unitEndBoundary
} = require('./formulaParser');
const { answer, cleanNumber } = require('./formulaAnswerFormatter');
const { buildFormulaWork } = require('./formulaWorkBuilder');

function tryElectricity(text, lower) {
  const ambiguousVoltageCurrent = ambiguousVoltageCurrentQuestion(text, lower);
  if (ambiguousVoltageCurrent) return ambiguousVoltageCurrent;

  if (asksForElectricalPower(lower)) {
    return tryElectricalPower(text, lower) ||
      tryOhmsLaw(text, lower);
  }

  return tryOhmsLaw(text, lower) ||
    tryElectricalPower(text, lower);
}

function cleanOhmsNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  if (Math.abs(value) > 0 && Math.abs(value) < 0.001) {
    return String(Number(value.toPrecision(4))).replace(/\.0+$/, '');
  }
  return cleanNumber(value);
}

function asksForElectricalPower(lower) {
  return /\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(?:electrical\s+)?(power|watts|watt|p)\b/.test(lower) ||
    /\bwhat\s+(?:electrical\s+)?power\b/.test(lower) ||
    /\bhow many watts\b/.test(lower) ||
    /\bp\s*=/.test(lower);
}

function ambiguousVoltageCurrentQuestion(text, lower) {
  if (asksForElectricalPower(lower)) return null;
  if (asksForOhmsTarget(lower, 'potential difference|voltage|volt|volts|v')) return null;
  if (asksForOhmsTarget(lower, 'current|amps|amp|amperes|ampere|amperage|i')) return null;
  if (asksForOhmsTarget(lower, 'electrical resistance|resistance|ohms|ohm|oms|r')) return null;
  if (/\bhow many (?:watts|volts|amps|ohms|oms)\b/.test(lower)) return null;

  const voltage = findQuantity(text, voltageLabels(), VOLTAGE_UNITS, null);
  const current = findQuantity(text, ['current', 'amps', 'amp', 'amperes', 'ampere', 'amperage', 'i'], CURRENT_UNITS, null);
  const resistance = findQuantity(text, ['electrical resistance', 'resistance', 'ohms', 'ohm', 'oms', 'r'], RESISTANCE_UNITS, null);
  const power = findQuantity(text, ['power', 'watts', 'watt', 'p'], POWER_UNITS, null);

  if (!voltage || !current || resistance || power) return null;

  return answer('Needs electrical formula clarification.', [
    'I see voltage and current. Are you trying to find resistance (R = V / I) or power (P = V × I)?'
  ]);
}

// ---------------- Ohm's Law: V = I × R ----------------
function tryOhmsLaw(text, lower) {
  if (!/\b(voltage|volt|volts|potential difference|battery|current|amp|amps|amperes|ampere|amperage|resistance|electrical resistance|ohm|ohms|oms|ohm's law)\b|\bv\s*=|\bi\s*=|\br\s*=/.test(lower)) return null;

  const voltage = findQuantity(text, voltageLabels(), VOLTAGE_UNITS, null);
  const current = findQuantity(text, ['current', 'amps', 'amp', 'amperes', 'ampere', 'amperage', 'i'], CURRENT_UNITS, null);
  const resistance = findQuantity(text, ['electrical resistance', 'resistance', 'ohms', 'ohm', 'oms', 'r'], RESISTANCE_UNITS, null);
  const target = ohmsTarget(lower, { voltage, current, resistance });
  const combinedVoltage = findCombinedVoltage(text, lower);
  const voltageForOhms = combinedVoltage ? combinedVoltage.quantity : voltage;

  if (target === 'voltage' && current && resistance) {
    const value = current.value * resistance.value;
    const formulaWork = buildVoltageFormulaWork(current.value, resistance.value, value);
    return answer('Recognized Ohm’s law problem: solving for voltage.', [
      'Use Ohm’s law: V = I × R.',
      `V = ${cleanOhmsNumber(current.value)} A × ${cleanOhmsNumber(resistance.value)} Ω`,
      `V = ${cleanOhmsNumber(value)} V`
    ], formulaWork);
  }

  if (target === 'current' && voltageForOhms && resistance && resistance.value !== 0) {
    const value = voltageForOhms.value / resistance.value;
    const formulaWork = buildOhmsFormulaWork({
      solveFor: 'current',
      voltageValue: voltageForOhms.value,
      currentValue: value,
      resistanceValue: resistance.value
    });
    return answer('Recognized Ohm’s law problem: solving for current.', [
      ...voltageCombinationLines(combinedVoltage),
      'Use Ohm’s law: I = V / R.',
      `I = ${cleanOhmsNumber(voltageForOhms.value)} V / ${cleanOhmsNumber(resistance.value)} Ω`,
      `I = ${cleanOhmsNumber(value)} A`
    ], combinedVoltage ? null : formulaWork);
  }

  if (target === 'resistance' && voltage && current && current.value !== 0) {
    const value = voltage.value / current.value;
    const formulaWork = buildOhmsFormulaWork({
      solveFor: 'resistance',
      voltageValue: voltage.value,
      currentValue: current.value,
      resistanceValue: value
    });
    return answer('Recognized Ohm’s law problem: solving for resistance.', [
      'Use Ohm’s law: R = V / I.',
      `R = ${cleanOhmsNumber(voltage.value)} V / ${cleanOhmsNumber(current.value)} A`,
      `R = ${cleanOhmsNumber(value)} Ω`
    ], formulaWork);
  }

  const rearranged = ohmsLawRearrangementAnswer(target, lower);
  if (rearranged) return rearranged;

  return null;
}

function buildOhmsFormulaWork({ solveFor, voltageValue, currentValue, resistanceValue }) {
  const voltageDisplay = `${cleanOhmsNumber(voltageValue)} V`;
  const currentDisplay = `${cleanOhmsNumber(currentValue)} A`;
  const resistanceDisplay = `${cleanOhmsNumber(resistanceValue)} Ω`;
  const finalByTarget = {
    voltage: { value: voltageValue, unit: 'V', display: voltageDisplay },
    current: { value: currentValue, unit: 'A', display: currentDisplay },
    resistance: { value: resistanceValue, unit: 'Ω', display: resistanceDisplay }
  };
  const formulaByTarget = {
    voltage: 'V = I × R',
    current: 'I = V / R',
    resistance: 'R = V / I'
  };

  return buildFormulaWork({
    formulaId: 'voltage_current_resistance',
    family: 'electricity',
    solveFor,
    formula: formulaByTarget[solveFor],
    finalAnswer: finalByTarget[solveFor],
    choices: ['voltage', 'current', 'resistance'],
    formulaDistractors: ['P = W / t', 'speed = distance / time'],
    variables: [
      { key: 'voltage', symbol: 'V', value: voltageValue, unit: 'V', display: voltageDisplay },
      { key: 'current', symbol: 'I', value: currentValue, unit: 'A', display: currentDisplay },
      { key: 'resistance', symbol: 'R', value: resistanceValue, unit: 'Ω', display: resistanceDisplay }
    ],
    calculation: {
      prompt: solveFor === 'voltage'
        ? `Now substitute: V = ${cleanOhmsNumber(currentValue)} × ${cleanOhmsNumber(resistanceValue)}. What is ${cleanOhmsNumber(currentValue)} × ${cleanOhmsNumber(resistanceValue)}?`
        : solveFor === 'current'
          ? `Now substitute: I = ${cleanOhmsNumber(voltageValue)} / ${cleanOhmsNumber(resistanceValue)}. What is ${cleanOhmsNumber(voltageValue)} / ${cleanOhmsNumber(resistanceValue)}?`
          : `Now substitute: R = ${cleanOhmsNumber(voltageValue)} / ${cleanOhmsNumber(currentValue)}. What is ${cleanOhmsNumber(voltageValue)} / ${cleanOhmsNumber(currentValue)}?`,
      expectedValue: finalByTarget[solveFor].value,
      hints: [solveFor === 'voltage' ? 'Multiply current by resistance.' : 'Divide the numerator by the denominator.']
    }
  });
}

function findCombinedVoltage(text, lower) {
  const voltageParts = findAllNumbersWithUnits(text, VOLTAGE_UNITS);
  if (voltageParts.length < 2) return null;

  const hasCombinationCue =
    /\b(?:two|2|three|3|multiple|several)\s+(?:batteries|battery|cells?|power\s+supplies|power\s+supply|power\s+sources?|voltage\s+sources?)\b/.test(lower) ||
    /\b(?:batteries|battery|cells?|power\s+supplies|power\s+supply|power\s+sources?|voltage\s+sources?)\b[\s\S]{0,80}\b(?:together|series|combined|total|add|added|sum)\b/.test(lower) ||
    /\b(?:total|combined)\s+voltage\b/.test(lower) ||
    /\badd\s+(?:the\s+)?voltages\b/.test(lower);

  if (!hasCombinationCue) return null;

  const total = voltageParts.reduce((sum, part) => sum + part.value, 0);

  return {
    parts: voltageParts,
    quantity: {
      value: total,
      unit: 'V',
      distanceUnit: null,
      perTimeUnit: null,
      start: voltageParts[0].start,
      end: voltageParts[voltageParts.length - 1].end
    }
  };
}

function voltageCombinationLines(combinedVoltage) {
  if (!combinedVoltage) return [];

  const parts = combinedVoltage.parts.map((part) => `${cleanNumber(part.value)} V`);

  return [
    'First find the total voltage.',
    `voltage = ${parts.join(' + ')}`,
    `voltage = ${cleanOhmsNumber(combinedVoltage.quantity.value)} V`
  ];
}

function buildVoltageFormulaWork(currentValue, resistanceValue, voltageValue) {
  const currentDisplay = `${cleanOhmsNumber(currentValue)} A`;
  const resistanceDisplay = `${cleanOhmsNumber(resistanceValue)} Ω`;
  const voltageDisplay = `${cleanOhmsNumber(voltageValue)} V`;

  return {
    formulaId: 'voltage_current_resistance',
    family: 'electricity',
    solveFor: 'voltage',
    formula: 'V = I × R',
    finalAnswer: {
      value: voltageValue,
      unit: 'V',
      display: voltageDisplay
    },
    variables: {
      current: {
        symbol: 'I',
        value: currentValue,
        unit: 'A',
        display: currentDisplay
      },
      resistance: {
        symbol: 'R',
        value: resistanceValue,
        unit: 'Ω',
        display: resistanceDisplay
      },
      voltage: {
        symbol: 'V',
        value: voltageValue,
        unit: 'V',
        display: voltageDisplay
      }
    },
    steps: [
      {
        id: 'identify_solve_target',
        type: 'multiple_choice',
        prompt: 'What variable are we solving for?',
        choices: [
          { number: 1, label: 'voltage', correct: true },
          { number: 2, label: 'current', correct: false },
          { number: 3, label: 'resistance', correct: false }
        ],
        expected: 'voltage',
        hints: ['The question asks for voltage.']
      },
      {
        id: 'choose_formula',
        type: 'multiple_choice',
        prompt: 'Which formula should we use?',
        choices: [
          { number: 1, label: 'V = I × R', correct: true },
          { number: 2, label: 'P = W / t', correct: false },
          { number: 3, label: 'speed = distance / time', correct: false }
        ],
        expected: 'V = I × R',
        hints: ['This problem gives current and resistance.']
      },
      {
        id: 'identify_current',
        type: 'quantity',
        prompt: 'What number should go in for current, I?',
        expectedValue: currentValue,
        expectedUnit: 'A',
        expectedDisplay: currentDisplay,
        hints: ['Look for the number with A or amps.']
      },
      {
        id: 'identify_resistance',
        type: 'quantity',
        prompt: 'What number should go in for resistance, R?',
        expectedValue: resistanceValue,
        expectedUnit: 'Ω',
        expectedDisplay: resistanceDisplay,
        hints: ['Look for the number with Ω or ohms.']
      },
      {
        id: 'calculate',
        type: 'calculation',
        prompt: `Now substitute: V = ${cleanOhmsNumber(currentValue)} × ${cleanOhmsNumber(resistanceValue)}. What is ${cleanOhmsNumber(currentValue)} × ${cleanOhmsNumber(resistanceValue)}?`,
        expectedValue: voltageValue,
        expectedUnit: 'V',
        expectedDisplay: voltageDisplay,
        hints: ['Multiply current by resistance.']
      }
    ]
  };
}

function ohmsTarget(lower, values) {
  if (asksForOhmsTarget(lower, 'potential difference|voltage|volt|volts|v') || /\bhow many volts\b/.test(lower)) return 'voltage';
  if (asksForOhmsTarget(lower, 'current|amps|amp|amperes|ampere|amperage|i') || /\bhow many amps\b/.test(lower)) return 'current';
  if (asksForOhmsTarget(lower, 'electrical resistance|resistance|ohms|ohm|oms|r') || /\bhow many (?:ohms|oms)\b/.test(lower)) return 'resistance';

  if (values.current && values.resistance && !values.voltage) return 'voltage';
  if (values.voltage && values.resistance && !values.current) return 'current';
  if (values.voltage && values.current && !values.resistance) return 'resistance';
  return null;
}

function asksForOhmsTarget(lower, targetPattern) {
  return new RegExp(`\\b(?:(?:what\\s+is|what's|what|find|calculate|solve for|determine)\\s+(?:the\\s+)?(?:formula\\s+for\\s+)?|what\\s+formula\\s+(?:do\\s+i\\s+use\\s+)?(?:for|to\\s+find|to\\s+solve\\s+for)\\s+(?:the\\s+)?|how\\s+(?:do|would|can)\\s+i\\s+(?:solve for|find|calculate)\\s+(?:the\\s+)?)(?:${targetPattern})\\b`).test(lower);
}

function voltageLabels() {
  return ['potential difference', 'voltage', 'volts', 'volt', 'battery', 'v'];
}

function ohmsLawRearrangementAnswer(target, lower) {
  if (!target || !hasOhmsFormulaIntent(lower)) return null;

  if (target === 'voltage') {
    return answer('Recognized Ohm’s law formula question: solving for voltage.', [
      'Voltage = current × resistance.',
      'V = I × R.'
    ]);
  }

  if (target === 'current') {
    return answer('Recognized Ohm’s law formula question: solving for current.', [
      'Current = voltage / resistance.',
      'I = V / R.'
    ]);
  }

  if (target === 'resistance') {
    return answer('Recognized Ohm’s law formula question: solving for resistance.', [
      'Resistance = voltage / current.',
      'R = V / I.',
      'Ohms are the unit for resistance.'
    ]);
  }

  return null;
}

function hasOhmsFormulaIntent(lower) {
  return /\b(formula|solve|solving|find|calculate|determine)\b/.test(lower) ||
    /\bhow\s+(?:do|would|can)\s+i\b/.test(lower);
}

// ---------------- Electrical Power: P = V × I ----------------
function tryElectricalPower(text, lower) {
  if (!/\b(power|watt|watts|voltage|volt|volts|current|amp|amps|amperes|ampere)\b|\bp\s*=|\bv\s*=|\bi\s*=/.test(lower)) return null;

  const power = findQuantity(text, ['power', 'watts', 'watt', 'p'], POWER_UNITS, null);
  const voltage = findQuantity(text, ['voltage', 'volts', 'volt', 'v'], VOLTAGE_UNITS, null);
  const current = findQuantity(text, ['current', 'amps', 'amp', 'amperes', 'ampere', 'i'], CURRENT_UNITS, null);
  const target = electricalPowerTarget(lower, { power, voltage, current });

  if (target === 'power' && voltage && current) {
    const value = voltage.value * current.value;
    return answer('Recognized electrical power problem: solving for power.', [
      'Use the electrical power formula: P = V × I.',
      `P = ${cleanNumber(voltage.value)} V × ${cleanNumber(current.value)} A`,
      `P = ${cleanNumber(value)} W`
    ]);
  }

  if (target === 'voltage' && power && current && current.value !== 0) {
    const value = power.value / current.value;
    return answer('Recognized electrical power problem: solving for voltage.', [
      'Use the electrical power formula: V = P / I.',
      `V = ${cleanNumber(power.value)} W / ${cleanNumber(current.value)} A`,
      `V = ${cleanNumber(value)} V`
    ]);
  }

  if (target === 'current' && power && voltage && voltage.value !== 0) {
    const value = power.value / voltage.value;
    return answer('Recognized electrical power problem: solving for current.', [
      'Use the electrical power formula: I = P / V.',
      `I = ${cleanNumber(power.value)} W / ${cleanNumber(voltage.value)} V`,
      `I = ${cleanNumber(value)} A`
    ]);
  }

  return null;
}

function electricalPowerTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(power|watts|watt|p)\b/.test(lower) || /\bhow many watts\b/.test(lower)) return 'power';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(voltage|volt|volts|v)\b/.test(lower) || /\bhow many volts\b/.test(lower)) return 'voltage';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(current|amps|amp|amperes|ampere|i)\b/.test(lower) || /\bhow many amps\b/.test(lower)) return 'current';

  if (values.voltage && values.current && !values.power) return 'power';
  if (values.power && values.current && !values.voltage) return 'voltage';
  if (values.power && values.voltage && !values.current) return 'current';
  return null;
}

function findAllNumbersWithUnits(text, unitDefs) {
  const unitPattern = unitDefs
    .flatMap((def) => [...def.names, def.canonical])
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join('|');

  const number = '-?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?(?:\\s*[x×]\\s*10\\s*\\^\\s*-?\\d+|e[+-]?\\d+)?';
  const regex = new RegExp(`(${number})\\s*-?\\s*(${unitPattern})${unitEndBoundary()}`, 'gi');
  const results = [];

  for (const match of text.matchAll(regex)) {
    const quantity = quantityFromRawUnit(match[1], match[2], unitDefs);
    quantity.start = match.index;
    quantity.end = match.index + match[0].length;
    results.push(quantity);
  }

  return results;
}

function quantityFromRawUnit(value, rawUnit, unitDefs) {
  const def = unitDefs.find((item) => item.names.some((name) => name.toLowerCase() === String(rawUnit).toLowerCase()) || item.canonical.toLowerCase() === String(rawUnit).toLowerCase());
  return {
    value: parseQuantityNumber(value),
    unit: def ? def.canonical : rawUnit,
    distanceUnit: def ? def.distanceUnit : null,
    perTimeUnit: def ? def.perTimeUnit : null,
    start: 0,
    end: 0
  };
}

module.exports = { tryElectricity };
