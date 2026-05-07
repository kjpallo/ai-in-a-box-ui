const {
  CURRENT_UNITS,
  POWER_UNITS,
  RESISTANCE_UNITS,
  VOLTAGE_UNITS,
  escapeRegex,
  findQuantity,
  unitEndBoundary
} = require('./formulaParser');
const { answer, cleanNumber } = require('./formulaAnswerFormatter');

function tryElectricity(text, lower) {
  if (asksForElectricalPower(lower)) {
    return tryElectricalPower(text, lower) ||
      tryOhmsLaw(text, lower);
  }

  return tryOhmsLaw(text, lower) ||
    tryElectricalPower(text, lower);
}

function asksForElectricalPower(lower) {
  return /\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(?:electrical\s+)?(power|watts|watt|p)\b/.test(lower) ||
    /\bwhat\s+(?:electrical\s+)?power\b/.test(lower) ||
    /\bhow many watts\b/.test(lower) ||
    /\bp\s*=/.test(lower);
}

// ---------------- Ohm's Law: V = I × R ----------------
function tryOhmsLaw(text, lower) {
  if (!/\b(voltage|volt|volts|current|amp|amps|amperes|ampere|amperage|resistance|electrical resistance|ohm|ohms|oms|ohm's law)\b|\bv\s*=|\bi\s*=|\br\s*=/.test(lower)) return null;

  const voltage = findQuantity(text, ['voltage', 'volts', 'volt', 'v'], VOLTAGE_UNITS, null);
  const current = findQuantity(text, ['current', 'amps', 'amp', 'amperes', 'ampere', 'amperage', 'i'], CURRENT_UNITS, null);
  const resistance = findQuantity(text, ['electrical resistance', 'resistance', 'ohms', 'ohm', 'oms', 'r'], RESISTANCE_UNITS, null);
  const target = ohmsTarget(lower, { voltage, current, resistance });
  const combinedVoltage = findCombinedVoltage(text, lower);
  const voltageForOhms = combinedVoltage ? combinedVoltage.quantity : voltage;

  if (target === 'voltage' && current && resistance) {
    const value = current.value * resistance.value;
    return answer('Recognized Ohm’s law problem: solving for voltage.', [
      'Use Ohm’s law: V = I × R.',
      `V = ${cleanNumber(current.value)} A × ${cleanNumber(resistance.value)} Ω`,
      `V = ${cleanNumber(value)} V`
    ]);
  }

  if (target === 'current' && voltageForOhms && resistance && resistance.value !== 0) {
    const value = voltageForOhms.value / resistance.value;
    return answer('Recognized Ohm’s law problem: solving for current.', [
      ...voltageCombinationLines(combinedVoltage),
      'Use Ohm’s law: I = V / R.',
      `I = ${cleanNumber(voltageForOhms.value)} V / ${cleanNumber(resistance.value)} Ω`,
      `I = ${cleanNumber(value)} A`
    ]);
  }

  if (target === 'resistance' && voltage && current && current.value !== 0) {
    const value = voltage.value / current.value;
    return answer('Recognized Ohm’s law problem: solving for resistance.', [
      'Use Ohm’s law: R = V / I.',
      `R = ${cleanNumber(voltage.value)} V / ${cleanNumber(current.value)} A`,
      `R = ${cleanNumber(value)} Ω`
    ]);
  }

  const rearranged = ohmsLawRearrangementAnswer(target, lower);
  if (rearranged) return rearranged;

  return null;
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
    `voltage = ${cleanNumber(combinedVoltage.quantity.value)} V`
  ];
}

function ohmsTarget(lower, values) {
  if (asksForOhmsTarget(lower, 'voltage|volt|volts|v') || /\bhow many volts\b/.test(lower)) return 'voltage';
  if (asksForOhmsTarget(lower, 'current|amps|amp|amperes|ampere|amperage|i') || /\bhow many amps\b/.test(lower)) return 'current';
  if (asksForOhmsTarget(lower, 'electrical resistance|resistance|ohms|ohm|oms|r') || /\bhow many (?:ohms|oms)\b/.test(lower)) return 'resistance';

  if (values.current && values.resistance && !values.voltage) return 'voltage';
  if (values.voltage && values.resistance && !values.current) return 'current';
  if (values.voltage && values.current && !values.resistance) return 'resistance';
  return null;
}

function asksForOhmsTarget(lower, targetPattern) {
  return new RegExp(`\\b(?:(?:what\\s+is|what's|find|calculate|solve for|determine)\\s+(?:the\\s+)?(?:formula\\s+for\\s+)?|what\\s+formula\\s+(?:do\\s+i\\s+use\\s+)?(?:for|to\\s+find|to\\s+solve\\s+for)\\s+(?:the\\s+)?|how\\s+(?:do|would|can)\\s+i\\s+(?:solve for|find|calculate)\\s+(?:the\\s+)?)(?:${targetPattern})\\b`).test(lower);
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

  const regex = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})${unitEndBoundary()}`, 'gi');
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
    value: Number(value),
    unit: def ? def.canonical : rawUnit,
    distanceUnit: def ? def.distanceUnit : null,
    perTimeUnit: def ? def.perTimeUnit : null,
    start: 0,
    end: 0
  };
}

module.exports = { tryElectricity };
