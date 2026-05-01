const {
  asksForAcceleration,
  findAccelerationQuantity,
  findAccelerationVelocityChange,
  hasVelocityChangeCue,
  tryAccelerationFromDistanceTimeRuns,
  tryAccelerationFromVelocity
} = require('./acceleration');
const { tryDensity } = require('./density');
const { tryForce, tryForceFromVelocityChange } = require('./force');
const { tryMotion } = require('./motion');

function tryScienceFormula(message) {
  const text = normalizeNumberWords(String(message || ''));
  const lower = text.toLowerCase();

  return tryAtomicNumber(text, lower) ||
    trySpecificHeat(text, lower) ||
    tryGravityConstant(text, lower) ||
    tryForceFromVelocityChange(text, lower, formulaContext()) ||
    tryAccelerationFromDistanceTimeRuns(text, lower, formulaContext()) ||
    tryAccelerationFromVelocity(text, lower, formulaContext()) ||
    tryWaves(text, lower) ||
    tryMomentum(text, lower) ||
    tryKineticEnergy(text, lower) ||
    tryDensity(text, lower, formulaContext()) ||
    tryOhmsLaw(text, lower) ||
    tryElectricalPower(text, lower) ||
    tryWorkPowerTime(text, lower) ||
    tryMotion(text, lower, formulaContext()) ||
    tryForce(text, lower, formulaContext()) ||
    tryPotentialEnergy(text, lower) ||
    tryWeight(text, lower) ||
    null;
}

// ---------------- Atomic number: atomic number = protons ----------------
function tryAtomicNumber(text, lower) {
  if (!/\b(atomic\s+number|protons?)\b/.test(lower)) return null;

  const protons = findParticleCount(text, ['proton', 'protons']);
  const atomicNumber = findAtomicNumberCount(text);
  const target = atomicNumberTarget(lower, { protons, atomicNumber });

  if (target === 'atomic number' && protons != null) {
    return answer('Recognized atomic number problem: solving from protons.', [
      'Use the atomic number rule: atomic number = number of protons.',
      `Atomic number = ${cleanNumber(protons)}`
    ]);
  }

  if (target === 'protons' && atomicNumber != null) {
    return answer('Recognized atomic number problem: solving for protons.', [
      'Use the atomic number rule: number of protons = atomic number.',
      `Protons = ${cleanNumber(atomicNumber)}`
    ]);
  }

  return null;
}

function atomicNumberTarget(lower, values) {
  if (questionTargetRegex('atomic\\s+number').test(lower)) return 'atomic number';
  if (questionTargetRegex('protons?|number\\s+of\\s+protons').test(lower) || /\bhow many protons\b/.test(lower)) return 'protons';

  if (values.protons != null && values.atomicNumber == null) return 'atomic number';
  if (values.atomicNumber != null && values.protons == null) return 'protons';
  return null;
}

function findParticleCount(text, labels) {
  const labelPattern = labels.map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const number = '(\\d+(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`\\b${number}\\s+(?:${labelPattern})\\b`, 'i'),
    new RegExp(`\\b(?:${labelPattern})\\s*(?:is|are|=|:|of)?\\s*${number}\\b`, 'i')
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return Number(match[1]);
  }

  return null;
}

function findAtomicNumberCount(text) {
  const number = '(\\d+(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`\\batomic\\s+number\\s*(?:is|=|:|of)?\\s*${number}\\b`, 'i'),
    new RegExp(`\\b${number}\\s+(?:is\\s+)?(?:the\\s+)?atomic\\s+number\\b`, 'i')
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return Number(match[1]);
  }

  return null;
}

// ---------------- Specific Heat: q = m × c × ΔT ----------------
function trySpecificHeat(text, lower) {
  if (!/\b(specific heat|heat energy|thermal energy|temperature|absorbed|released|heated|heats)\b|°\s*c|\bdegrees?\s+celsius\b/.test(lower)) return null;

  const mass = findQuantity(text, ['mass'], MASS_UNITS, null) || findNumberWithUnit(text, MASS_UNITS);
  const heatEnergy = findHeatEnergyQuantity(text);
  const specificHeat = findSpecificHeatQuantity(text);
  const temperatureChange = findTemperatureChange(text);
  const target = specificHeatTarget(lower, { heatEnergy, mass, specificHeat, temperatureChange });

  if (target === 'heat energy' && mass && specificHeat && temperatureChange) {
    const grams = massToGrams(mass);
    const value = grams * specificHeat.value * Math.abs(temperatureChange.delta);

    return answer('Recognized specific heat problem: solving for heat energy.', [
      'Use the specific heat formula: q = m × c × ΔT.',
      `ΔT = ${cleanNumber(temperatureChange.final)}°C - ${cleanNumber(temperatureChange.initial)}°C`,
      `ΔT = ${cleanNumber(Math.abs(temperatureChange.delta))}°C`,
      `q = ${cleanNumber(grams)} g × ${cleanNumber(specificHeat.value)} J/g°C × ${cleanNumber(Math.abs(temperatureChange.delta))}°C`,
      `q = ${cleanNumber(value)} J`
    ]);
  }

  if (target === 'mass' && heatEnergy && specificHeat && temperatureChange) {
    const delta = Math.abs(temperatureChange.delta);
    const divisor = specificHeat.value * delta;
    if (divisor === 0) return null;

    const value = heatEnergy.value / divisor;

    return answer('Recognized specific heat problem: solving for mass.', [
      'Use the specific heat formula: q = m × c × ΔT.',
      'Rearrange it: m = q / (c × ΔT).',
      `ΔT = ${cleanNumber(temperatureChange.final)}°C - ${cleanNumber(temperatureChange.initial)}°C`,
      `ΔT = ${cleanNumber(delta)}°C`,
      `m = ${cleanNumber(heatEnergy.value)} J / (${cleanNumber(specificHeat.value)} J/g°C × ${cleanNumber(delta)}°C)`,
      `m = ${cleanNumber(heatEnergy.value)} J / ${cleanNumber(divisor)} J/g`,
      `m = ${cleanNumber(value)} g`
    ]);
  }

  return null;
}

function specificHeatTarget(lower, values) {
  if (/\bhow much heat\b/.test(lower) || questionTargetRegex('heat energy|thermal energy|heat|q').test(lower)) return 'heat energy';
  if (questionTargetRegex('mass|m').test(lower)) return 'mass';

  if (values.mass && values.specificHeat && values.temperatureChange && !values.heatEnergy) return 'heat energy';
  if (values.heatEnergy && values.specificHeat && values.temperatureChange && !values.mass) return 'mass';
  return null;
}

function findHeatEnergyQuantity(text) {
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const unit = '(?:j|joules?|J)';
  const patterns = [
    new RegExp(`\\b(?:absorbs?|absorbed|gains?|gained|adds?|added|released?|loses?|lost)\\b[^.?!]{0,80}?${number}\\s*${unit}(?=$|[^A-Za-z0-9/²^])`, 'i'),
    new RegExp(`\\b(?:heat\\s+energy|thermal\\s+energy|heat|q)\\b\\s*(?:is|=|:|of)?\\s*${number}\\s*${unit}(?=$|[^A-Za-z0-9/²^])`, 'i'),
    new RegExp(`${number}\\s*${unit}(?=$|[^A-Za-z0-9/²^])[^.?!]{0,80}?\\b(?:heat\\s+energy|thermal\\s+energy|heat)\\b`, 'i')
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;

    return {
      value: Number(match[1]),
      unit: 'J',
      start: match.index + match[0].indexOf(match[1]),
      end: match.index + match[0].indexOf(match[1]) + match[1].length
    };
  }

  return null;
}

function findSpecificHeatQuantity(text) {
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const unitPattern = '(?:j\\s*\\/\\s*g\\s*°?\\s*c|j\\s*\\/\\s*g\\s*degrees?\\s*celsius|joules?\\s+per\\s+gram\\s+degree\\s+celsius)';
  const patterns = [
    new RegExp(`\\bspecific\\s+heat\\b[^.?!]{0,80}?${number}\\s*${unitPattern}`, 'i'),
    new RegExp(`${number}\\s*${unitPattern}[^.?!]{0,80}?\\bspecific\\s+heat\\b`, 'i')
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;

    return {
      value: Number(match[1]),
      unit: 'J/g°C',
      start: match.index + match[0].indexOf(match[1]),
      end: match.index + match[0].indexOf(match[1]) + match[1].length
    };
  }

  return null;
}

function findTemperatureChange(text) {
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const tempUnit = '(?:°\\s*c|degrees?\\s+celsius|celsius)';
  const fromTo = new RegExp(`\\bfrom\\s+${number}\\s*${tempUnit}\\s+to\\s+${number}\\s*${tempUnit}\\b`, 'i').exec(text);

  if (fromTo) {
    const initial = Number(fromTo[1]);
    const final = Number(fromTo[2]);
    return { initial, final, delta: final - initial };
  }

  const change = new RegExp(`\\b(?:change\\s+in\\s+temperature|temperature\\s+change|delta\\s*t|Δt)\\s*(?:is|=|:|of)?\\s*${number}\\s*${tempUnit}\\b`, 'i').exec(text);

  if (change) {
    const delta = Number(change[1]);
    return { initial: 0, final: delta, delta };
  }

  return null;
}

function asksForForce(lower) {
  return /\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(?:force|net force|f)\b/.test(lower) ||
    /\bwhat\s+force\b/.test(lower) ||
    /\bhow\s+much\s+force\b/.test(lower);
}

// ---------------- Gravity constant near Earth: g = 9.8 m/s² ----------------
function tryGravityConstant(text, lower) {
  const asksForGravityConstant =
    /\b(gravity near earth|gravity on earth|earth gravity|acceleration due to gravity)\b/.test(lower) ||
    /\bwhat(?:\s+is|'s)\s+(?:the\s+)?(?:value\s+of\s+)?g\b/.test(lower) ||
    /\bg\s+in\s+(?:the\s+)?weight\s+formula\b/.test(lower) ||
    /\bforce\s+of\s+gravity\b/.test(lower);

  if (!asksForGravityConstant) return null;

  // If a mass is provided, this is a weight calculation, not just a constant question.
  const mass = findQuantity(text, ['mass'], MASS_UNITS, null);
  if (mass) return null;

  return answer('Recognized gravity constant question.', [
    'Near Earth, gravity is about 9.8 m/s² downward.',
    'Use g = 9.8 m/s² in the weight formula Fg = m × g.'
  ]);
}

// ---------------- Weight: Fg = m × g ----------------
function tryWeight(text, lower) {
  if (!/\b(weight|force of gravity|weigh)\b/.test(lower)) return null;
  const mass = findQuantity(text, ['mass'], MASS_UNITS, null);
  if (!mass) return null;
  const gravity = findQuantity(text, ['gravity'], ACCEL_UNITS, null) || { value: 9.8 };
  const m = massToKg(mass);
  const value = m * gravity.value;
  return answer('Recognized weight problem.', [
    'Use the weight formula: Fg = m × g.',
    gravity.value === 9.8 ? 'For Earth, use g = 9.8 m/s².' : `g = ${cleanNumber(gravity.value)} m/s²`,
    `Fg = ${cleanNumber(m)} kg × ${cleanNumber(gravity.value)} m/s²`,
    `Fg = ${cleanNumber(value)} N`
  ]);
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


// ---------------- Momentum: p = m × v ----------------
function tryMomentum(text, lower) {
  if (!/\b(momentum|p\s*=)\b/.test(lower)) return null;
  const momentum = findQuantity(text, ['momentum'], MOMENTUM_UNITS, null);
  const mass = findQuantity(text, ['mass'], MASS_UNITS, null);
  const velocity = findQuantity(text, ['velocity', 'speed'], VELOCITY_UNITS, null);
  const target = targetFromQuestion(lower, ['momentum', 'mass', 'velocity'], { momentum, mass, velocity });

  if (target === 'momentum' && mass && velocity) {
    const m = massToKg(mass);
    const v = velocityToMS(velocity);
    if (v == null) return null;
    const value = m * v;
    return answer('Recognized momentum problem: solving for momentum.', [
      'Use the momentum formula: p = m × v.',
      `p = ${cleanNumber(m)} kg × ${cleanNumber(v)} m/s`,
      `p = ${cleanNumber(value)} kg·m/s`
    ]);
  }

  if (target === 'mass' && momentum && velocity) {
    const v = velocityToMS(velocity);
    if (v == null || v === 0) return null;
    const value = momentum.value / v;
    return answer('Recognized momentum problem: solving for mass.', [
      'Use the momentum formula: mass = momentum / velocity.',
      `m = ${cleanNumber(momentum.value)} kg·m/s / ${cleanNumber(v)} m/s`,
      `m = ${cleanNumber(value)} kg`
    ]);
  }

  if (target === 'velocity' && momentum && mass) {
    const m = massToKg(mass);
    if (m === 0) return null;
    const value = momentum.value / m;
    return answer('Recognized momentum problem: solving for velocity.', [
      'Use the momentum formula: velocity = momentum / mass.',
      `v = ${cleanNumber(momentum.value)} kg·m/s / ${cleanNumber(m)} kg`,
      `v = ${cleanNumber(value)} m/s`
    ]);
  }

  return null;
}


// ---------------- Ohm's Law: V = I × R ----------------
function tryOhmsLaw(text, lower) {
  if (!/\b(voltage|volt|volts|current|amp|amps|amperes|ampere|resistance|ohm|ohms|ohm's law)\b|\bv\s*=|\bi\s*=|\br\s*=/.test(lower)) return null;

  const voltage = findQuantity(text, ['voltage', 'volts', 'volt', 'v'], VOLTAGE_UNITS, null);
  const current = findQuantity(text, ['current', 'amps', 'amp', 'amperes', 'ampere', 'i'], CURRENT_UNITS, null);
  const resistance = findQuantity(text, ['resistance', 'ohms', 'ohm', 'r'], RESISTANCE_UNITS, null);
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
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(voltage|volt|volts|v)\b/.test(lower) || /\bhow many volts\b/.test(lower)) return 'voltage';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(current|amps|amp|amperes|ampere|i)\b/.test(lower) || /\bhow many amps\b/.test(lower)) return 'current';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(resistance|ohms|ohm|r)\b/.test(lower) || /\bhow many ohms\b/.test(lower)) return 'resistance';

  if (values.current && values.resistance && !values.voltage) return 'voltage';
  if (values.voltage && values.resistance && !values.current) return 'current';
  if (values.voltage && values.current && !values.resistance) return 'resistance';
  return null;
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

// ---------------- Work, Power, Time: P = W / t ----------------
function tryWorkPowerTime(text, lower) {
  if (!/\b(work|energy|joule|joules|power|watt|watts|time|force|distance)\b|\bp\s*=|\bw\s*=|\bt\s*=/.test(lower)) return null;

  const work = findQuantity(text, ['work', 'energy', 'joules', 'joule', 'w'], ENERGY_UNITS, null);
  const power = findQuantity(text, ['power', 'watts', 'watt', 'p'], POWER_UNITS, null);
  const time = findQuantity(text, ['time', 't'], TIME_UNITS, null);
  const force = findQuantity(text, ['force'], FORCE_UNITS, null) || findNumberWithUnit(text, FORCE_UNITS);
  const distance = findWorkDistance(text);
  const target = workPowerTimeTarget(lower, { work, power, time, force, distance });

  if (target === 'work' && force && distance && asksForWorkFromForceDistance(lower)) {
    const meters = convertDistance(distance.value, distance.unit, 'm');
    if (meters == null) return null;

    const value = force.value * meters;

    return answer('Recognized work problem: solving from force and distance.', [
      'Use the work formula: W = force × distance.',
      `W = ${cleanNumber(force.value)} N × ${cleanNumber(meters)} m`,
      `W = ${cleanNumber(value)} J`
    ]);
  }

  if (target === 'power' && force && distance && time) {
    const meters = convertDistance(distance.value, distance.unit, 'm');
    const seconds = convertTime(time.value, time.unit, 's');
    if (meters == null || seconds == null || seconds === 0) return null;

    const workValue = force.value * meters;
    const powerValue = workValue / seconds;

    return answer('Recognized multi-step power problem: solving work first, then power.', [
      'First find the work.',
      'Use the work formula: W = force × distance.',
      `W = ${cleanNumber(force.value)} N × ${cleanNumber(meters)} m`,
      `W = ${cleanNumber(workValue)} J`,
      'Then find power.',
      'Use the power formula: P = W / t.',
      `P = ${cleanNumber(workValue)} J / ${cleanNumber(seconds)} s`,
      `P = ${cleanNumber(powerValue)} W`
    ]);
  }

  if (target === 'power' && work && time) {
    const seconds = convertTime(time.value, time.unit, 's');
    if (seconds == null || seconds === 0) return null;
    const value = work.value / seconds;
    return answer('Recognized work, power, and time problem: solving for power.', [
      'Use the power formula: P = W / t.',
      `P = ${cleanNumber(work.value)} J / ${cleanNumber(seconds)} s`,
      `P = ${cleanNumber(value)} W`
    ]);
  }

  if (target === 'work' && power && time) {
    const seconds = convertTime(time.value, time.unit, 's');
    if (seconds == null) return null;
    const value = power.value * seconds;
    return answer('Recognized work, power, and time problem: solving for work.', [
      'Use the power formula: W = P × t.',
      `W = ${cleanNumber(power.value)} W × ${cleanNumber(seconds)} s`,
      `W = ${cleanNumber(value)} J`
    ]);
  }

  if (target === 'time' && work && power && power.value !== 0) {
    const value = work.value / power.value;
    return answer('Recognized work, power, and time problem: solving for time.', [
      'Use the power formula: t = W / P.',
      `t = ${cleanNumber(work.value)} J / ${cleanNumber(power.value)} W`,
      `t = ${cleanNumber(value)} s`
    ]);
  }

  return null;
}

function workPowerTimeTarget(lower, values) {
  if (questionTargetRegex('power|powr|watts|watt|p').test(lower) || /\bhow many watts\b/.test(lower)) return 'power';
  if (questionTargetRegex('work|energy|joules|joule|w').test(lower) || /\bhow many joules\b/.test(lower)) return 'work';
  if (/\bhow much work\b/.test(lower)) return 'work';
  if (questionTargetRegex('time|t').test(lower) || /\bhow long\b/.test(lower)) return 'time';

  if (values.force && values.distance && !values.work) return 'work';
  if (values.work && values.time && !values.power) return 'power';
  if (values.power && values.time && !values.work) return 'work';
  if (values.work && values.power && !values.time) return 'time';
  return null;
}

function asksForWorkFromForceDistance(lower) {
  return /\bhow much work\b/.test(lower) ||
    /\b(work|joules?|energy)\b/.test(questionPortion(lower));
}

function questionPortion(lower) {
  const questionIndex = lower.lastIndexOf('question:');
  if (questionIndex >= 0) return lower.slice(questionIndex);

  const whatIndex = lower.lastIndexOf('what');
  if (whatIndex >= 0) return lower.slice(whatIndex);

  return lower;
}

function findWorkDistance(text) {
  const movementDistance = findMovementDistance(text);
  if (movementDistance) return movementDistance;

  return findQuantity(text, ['distance'], DISTANCE_UNITS, null);
}

function findMovementDistance(text) {
  const unitPattern = unitPatternFor(DISTANCE_UNITS);
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const pattern = new RegExp(`\\b(?:moves?|moved|travels?|traveled|travelled|goes?|went|slides?|slid|pushes?|pushed|pulls?|pulled)\\b[^.?!]{0,80}?${number}\\s*(${unitPattern})\\b`, 'i');
  const match = pattern.exec(text);

  if (!match) return null;

  const quantity = quantityFromRawUnit(match[1], match[2], DISTANCE_UNITS);
  quantity.start = match.index + match[0].indexOf(match[1]);
  quantity.end = quantity.start + `${match[1]} ${match[2]}`.length;
  return quantity;
}

// ---------------- Waves: wave speed = frequency × wavelength ----------------
function tryWaves(text, lower) {
  if (!/\b(wave|waves|frequency|hertz|hz|wavelength|lambda)\b/.test(lower)) return null;

  const waveSpeed = findQuantity(text, ['wave speed', 'speed', 'velocity'], SPEED_UNITS, null);
  const maskedText = waveSpeed ? mask(text, waveSpeed.start, waveSpeed.end) : text;
  const frequency = findQuantity(maskedText, ['frequency', 'freq', 'f'], FREQUENCY_UNITS, null);
  const wavelength = findQuantity(maskedText, ['wavelength', 'wave length', 'lambda'], DISTANCE_UNITS, null);
  const target = wavesTarget(lower, { waveSpeed, frequency, wavelength });

  if (target === 'wave speed' && frequency && wavelength) {
    const meters = convertDistance(wavelength.value, wavelength.unit, 'm');
    if (meters == null) return null;
    const value = frequency.value * meters;
    return answer('Recognized wave problem: solving for wave speed.', [
      'Use the wave formula: wave speed = frequency × wavelength.',
      `wave speed = ${cleanNumber(frequency.value)} Hz × ${cleanNumber(meters)} m`,
      `wave speed = ${cleanNumber(value)} m/s`
    ]);
  }

  if (target === 'frequency' && waveSpeed && wavelength) {
    const speed = velocityToMS(waveSpeed);
    const meters = convertDistance(wavelength.value, wavelength.unit, 'm');
    if (speed == null || meters == null || meters === 0) return null;
    const value = speed / meters;
    return answer('Recognized wave problem: solving for frequency.', [
      'Use the wave formula: frequency = wave speed / wavelength.',
      `frequency = ${cleanNumber(speed)} m/s / ${cleanNumber(meters)} m`,
      `frequency = ${cleanNumber(value)} Hz`
    ]);
  }

  if (target === 'wavelength' && waveSpeed && frequency && frequency.value !== 0) {
    const speed = velocityToMS(waveSpeed);
    if (speed == null) return null;
    const value = speed / frequency.value;
    return answer('Recognized wave problem: solving for wavelength.', [
      'Use the wave formula: wavelength = wave speed / frequency.',
      `wavelength = ${cleanNumber(speed)} m/s / ${cleanNumber(frequency.value)} Hz`,
      `wavelength = ${cleanNumber(value)} m`
    ]);
  }

  return null;
}

function wavesTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(wave speed|speed|velocity)\b/.test(lower) || /\bhow fast\b/.test(lower)) return 'wave speed';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(frequency|freq|f)\b/.test(lower) || /\bhow many hertz\b/.test(lower)) return 'frequency';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(wavelength|wave length|lambda)\b/.test(lower)) return 'wavelength';

  if (values.frequency && values.wavelength && !values.waveSpeed) return 'wave speed';
  if (values.waveSpeed && values.wavelength && !values.frequency) return 'frequency';
  if (values.waveSpeed && values.frequency && !values.wavelength) return 'wavelength';
  return null;
}



// ---------------- Kinetic Energy: KE = 1/2 × m × v² ----------------
function tryKineticEnergy(text, lower) {
  if (/\b(momentum|kg\s*[·*x-]?\s*m\/s|kgm\/s|p\s*=)\b/.test(lower)) return null;
  if (!/\b(kinetic energy|ke|energy|joule|joules|mass|velocity|speed)\b/.test(lower)) return null;

  const kineticEnergy = findQuantity(text, ['kinetic energy', 'energy', 'ke'], ENERGY_UNITS, null);
  const mass = findQuantity(text, ['mass', 'm'], MASS_UNITS, null);
  const velocity = findQuantity(text, ['velocity', 'speed', 'v'], VELOCITY_UNITS, null);
  const velocities = uniqueVelocities(findAllNumbersWithUnits(text, VELOCITY_UNITS));
  const target = kineticEnergyTarget(lower, { kineticEnergy, mass, velocity });

  if (target === 'kinetic energy' && mass && velocities.length >= 2) {
    const m = massToKg(mass);
    const lines = ['Use the kinetic energy formula: KE = 1/2 × m × v².'];
    const results = [];

    velocities.forEach((item, index) => {
      const v = velocityToMS(item);
      if (v == null) return;
      const value = 0.5 * m * v * v;
      results.push({ v, value });

      const label = partLabel(index);
      lines.push(`${label}:`);
      lines.push(`KE = 1/2 × ${cleanNumber(m)} kg × (${cleanNumber(v)} m/s)²`);
      lines.push(`KE = ${cleanNumber(0.5 * m)} × ${cleanNumber(v * v)}`);
      lines.push(`KE = ${cleanNumber(value)} J`);
    });

    if (results.length < 2) return null;

    if (results.length === 2) {
      lines.push(`When speed changes from ${cleanNumber(results[0].v)} m/s to ${cleanNumber(results[1].v)} m/s, kinetic energy changes from ${cleanNumber(results[0].value)} J to ${cleanNumber(results[1].value)} J.`);
    }

    return answer('Recognized multi-part kinetic energy problem.', lines);
  }

  if (target === 'kinetic energy' && mass && velocity) {
    const m = massToKg(mass);
    const v = velocityToMS(velocity);
    if (v == null) return null;
    const value = 0.5 * m * v * v;
    return answer('Recognized kinetic energy problem: solving for kinetic energy.', [
      'Use the kinetic energy formula: KE = 1/2 × m × v².',
      `KE = 1/2 × ${cleanNumber(m)} kg × ${cleanNumber(v)}²`,
      `KE = ${cleanNumber(value)} J`
    ]);
  }

  if (target === 'mass' && kineticEnergy && velocity) {
    const v = velocityToMS(velocity);
    if (v == null || v === 0) return null;
    const value = (2 * kineticEnergy.value) / (v * v);
    return answer('Recognized kinetic energy problem: solving for mass.', [
      'Use the kinetic energy formula: mass = 2 × KE / v².',
      `m = 2 × ${cleanNumber(kineticEnergy.value)} J / ${cleanNumber(v)}²`,
      `m = ${cleanNumber(value)} kg`
    ]);
  }

  if (target === 'velocity' && kineticEnergy && mass) {
    const m = massToKg(mass);
    if (m === 0) return null;
    const value = Math.sqrt((2 * kineticEnergy.value) / m);
    return answer('Recognized kinetic energy problem: solving for velocity.', [
      'Use the kinetic energy formula: velocity = square root of (2 × KE / mass).',
      `v = √(2 × ${cleanNumber(kineticEnergy.value)} J / ${cleanNumber(m)} kg)`,
      `v = ${cleanNumber(value)} m/s`
    ]);
  }

  return null;
}

function kineticEnergyTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(kinetic energy|ke|energy)\b/.test(lower)) return 'kinetic energy';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(mass|m)\b/.test(lower)) return 'mass';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(velocity|speed|v)\b/.test(lower)) return 'velocity';

  if (values.mass && values.velocity && !values.kineticEnergy) return 'kinetic energy';
  if (values.kineticEnergy && values.velocity && !values.mass) return 'mass';
  if (values.kineticEnergy && values.mass && !values.velocity) return 'velocity';
  return null;
}

function uniqueVelocities(velocities) {
  const seen = new Set();
  const unique = [];

  for (const velocity of velocities) {
    const metersPerSecond = velocityToMS(velocity);
    if (metersPerSecond == null) continue;

    const key = cleanNumber(metersPerSecond);
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(velocity);
  }

  return unique;
}

function partLabel(index) {
  const letter = String.fromCharCode(65 + index);
  return `Part ${letter}`;
}

// ---------------- Potential Energy: PE = m × g × h or PE = force × height ----------------
function tryPotentialEnergy(text, lower) {
  if (!/\b(potential energy|gravitational potential energy|pe|height|force|weight|gravity|mass|joule|joules)\b/.test(lower)) return null;

  const potentialEnergy = findQuantity(text, ['gravitational potential energy', 'potential energy', 'energy', 'pe'], ENERGY_UNITS, null);
  const mass = findQuantity(text, ['mass', 'm'], MASS_UNITS, null);
  const acceleration = findAccelerationQuantity(text, formulaContext()) ||
    findQuantity(text, ['acceleration', 'a'], ACCEL_UNITS, null);

  if (asksForForce(lower) && mass && acceleration) return null;

  const force = findQuantity(text, ['force', 'weight', 'f'], FORCE_UNITS, null);
  const heights = uniqueHeights(findHeightQuantities(text));
  const height = heights[0] || null;
  const gravity = findExplicitQuantity(text, ['gravity', 'g'], ACCEL_UNITS, null) || { value: 9.8, unit: 'm/s^2', isDefault: true };
  const target = potentialEnergyTarget(lower, { potentialEnergy, mass, force, height, gravity });

  if (target === 'potential energy' && mass && heights.length >= 2) {
    const m = massToKg(mass);
    const lines = [
      'Use the potential energy formula: PE = m × g × h.',
      gravity.isDefault ? 'For Earth, use g = 9.8 m/s².' : `g = ${cleanNumber(gravity.value)} m/s²`
    ];
    const results = [];

    heights.forEach((item, index) => {
      const h = convertDistance(item.value, item.unit, 'm');
      if (h == null) return;
      const value = m * gravity.value * h;
      results.push({ h, value });

      const label = partLabel(index);
      lines.push(`${label}:`);
      lines.push(`PE = ${cleanNumber(m)} kg × ${cleanNumber(gravity.value)} m/s² × ${cleanNumber(h)} m`);
      lines.push(`PE = ${cleanNumber(value)} J`);
    });

    if (results.length < 2) return null;

    if (results.length === 2) {
      lines.push(`When height changes from ${cleanNumber(results[0].h)} m to ${cleanNumber(results[1].h)} m, potential energy changes from ${cleanNumber(results[0].value)} J to ${cleanNumber(results[1].value)} J.`);
    }

    return answer('Recognized multi-part potential energy problem.', lines);
  }

  if (target === 'potential energy' && force && height) {
    const h = convertDistance(height.value, height.unit, 'm');
    if (h == null) return null;
    const value = force.value * h;
    return answer('Recognized potential energy problem: solving for potential energy using force and height.', [
      'Use the potential energy formula: PE = force × height.',
      `PE = ${cleanNumber(force.value)} N × ${cleanNumber(h)} m`,
      `PE = ${cleanNumber(value)} J`
    ]);
  }

  if (target === 'potential energy' && mass && height) {
    const m = massToKg(mass);
    const h = convertDistance(height.value, height.unit, 'm');
    if (h == null) return null;
    const value = m * gravity.value * h;
    return answer('Recognized potential energy problem: solving for potential energy using mass, gravity, and height.', [
      'Use the potential energy formula: PE = m × g × h.',
      gravity.isDefault ? 'For Earth, use g = 9.8 m/s².' : `g = ${cleanNumber(gravity.value)} m/s²`,
      `PE = ${cleanNumber(m)} kg × ${cleanNumber(gravity.value)} m/s² × ${cleanNumber(h)} m`,
      `PE = ${cleanNumber(value)} J`
    ]);
  }

  if (target === 'mass' && potentialEnergy && height) {
    const h = convertDistance(height.value, height.unit, 'm');
    if (h == null || h === 0 || gravity.value === 0) return null;
    const value = potentialEnergy.value / (gravity.value * h);
    return answer('Recognized potential energy problem: solving for mass.', [
      'Use the potential energy formula: mass = PE / (gravity × height).',
      gravity.isDefault ? 'For Earth, use g = 9.8 m/s².' : `g = ${cleanNumber(gravity.value)} m/s²`,
      `m = ${cleanNumber(potentialEnergy.value)} J / (${cleanNumber(gravity.value)} m/s² × ${cleanNumber(h)} m)`,
      `m = ${cleanNumber(value)} kg`
    ]);
  }

  if (target === 'force' && potentialEnergy && height) {
    const h = convertDistance(height.value, height.unit, 'm');
    if (h == null || h === 0) return null;
    const value = potentialEnergy.value / h;
    return answer('Recognized potential energy problem: solving for force/weight.', [
      'Use the potential energy formula: force = PE / height.',
      `force = ${cleanNumber(potentialEnergy.value)} J / ${cleanNumber(h)} m`,
      `force = ${cleanNumber(value)} N`
    ]);
  }

  if (target === 'height' && potentialEnergy && force) {
    if (force.value === 0) return null;
    const value = potentialEnergy.value / force.value;
    return answer('Recognized potential energy problem: solving for height using force.', [
      'Use the potential energy formula: height = PE / force.',
      `height = ${cleanNumber(potentialEnergy.value)} J / ${cleanNumber(force.value)} N`,
      `height = ${cleanNumber(value)} m`
    ]);
  }

  if (target === 'height' && potentialEnergy && mass) {
    const m = massToKg(mass);
    if (m === 0 || gravity.value === 0) return null;
    const value = potentialEnergy.value / (m * gravity.value);
    return answer('Recognized potential energy problem: solving for height using mass and gravity.', [
      'Use the potential energy formula: height = PE / (mass × gravity).',
      gravity.isDefault ? 'For Earth, use g = 9.8 m/s².' : `g = ${cleanNumber(gravity.value)} m/s²`,
      `height = ${cleanNumber(potentialEnergy.value)} J / (${cleanNumber(m)} kg × ${cleanNumber(gravity.value)} m/s²)`,
      `height = ${cleanNumber(value)} m`
    ]);
  }

  if (target === 'gravity' && potentialEnergy && mass && height) {
    const m = massToKg(mass);
    const h = convertDistance(height.value, height.unit, 'm');
    if (m === 0 || h == null || h === 0) return null;
    const value = potentialEnergy.value / (m * h);
    return answer('Recognized potential energy problem: solving for gravity.', [
      'Use the potential energy formula: gravity = PE / (mass × height).',
      `g = ${cleanNumber(potentialEnergy.value)} J / (${cleanNumber(m)} kg × ${cleanNumber(h)} m)`,
      `g = ${cleanNumber(value)} m/s²`
    ]);
  }

  return null;
}

function potentialEnergyTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(potential energy|gravitational potential energy|pe|energy)\b/.test(lower)) return 'potential energy';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(mass|m)\b/.test(lower)) return 'mass';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(force|weight|f)\b/.test(lower)) return 'force';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(height|h)\b/.test(lower)) return 'height';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(gravity|g)\b/.test(lower)) return 'gravity';

  if ((values.mass || values.force) && values.height && !values.potentialEnergy) return 'potential energy';
  if (values.potentialEnergy && values.mass && !values.height) return 'height';
  if (values.potentialEnergy && values.force && !values.height) return 'height';
  return null;
}

function findHeightQuantities(text) {
  const unitPattern = DISTANCE_UNITS
    .flatMap((def) => [...def.names, def.canonical])
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join('|');
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const unit = `(${unitPattern})`;
  const unitEnd = unitEndBoundary();
  const results = [];

  const patterns = [
    new RegExp(`\\bheight\\s*(?:of|is|=|:)?\\s*${number}\\s*${unit}${unitEnd}`, 'gi'),
    new RegExp(`\\bh\\s*(?:=|:)\\s*${number}\\s*${unit}${unitEnd}`, 'gi'),
    new RegExp(`\\b(?:lifted|raised|placed|put)\\s+(?:to|onto|up\\s+to)?[\\s\\S]{0,40}?\\b(?:height\\s+of\\s+)?${number}\\s*${unit}${unitEnd}`, 'gi'),
    new RegExp(`\\b${number}\\s*${unit}${unitEnd}[\\s\\S]{0,35}\\b(?:high|height|shelf|shelves)\\b`, 'gi'),
    new RegExp(`\\b(?:at|to)\\s+${number}\\s*${unit}${unitEnd}`, 'gi')
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const quantity = quantityFromRawUnit(match[1], match[2], DISTANCE_UNITS);
      quantity.start = match.index + match[0].indexOf(match[1]);
      quantity.end = quantity.start + `${match[1]} ${match[2]}`.length;
      results.push(quantity);
    }
  }

  return results.sort((a, b) => a.start - b.start);
}

function uniqueHeights(heights) {
  const seen = new Set();
  const unique = [];

  for (const height of heights) {
    const meters = convertDistance(height.value, height.unit, 'm');
    if (meters == null) continue;

    const key = cleanNumber(meters);
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(height);
  }

  return unique;
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

// ---------------- Shared parser ----------------
const SPEED_UNITS = [
  unit('mile/hr', 'mile', 'hr', ['miles per hour', 'mile per hour', 'mph', 'mi/hr', 'mi/h']),
  unit('km/hr', 'km', 'hr', ['kilometers per hour', 'kilometer per hour', 'km/hr', 'km/h', 'kph']),
  unit('m/s', 'm', 's', ['meters per second', 'meter per second', 'm/s']),
  unit('ft/s', 'ft', 's', ['feet per second', 'foot per second', 'ft/s'])
];
const VELOCITY_UNITS = SPEED_UNITS;
const DISTANCE_UNITS = [unit('mile', null, null, ['miles', 'mile', 'mi']), unit('km', null, null, ['kilometers', 'kilometer', 'km']), unit('m', null, null, ['meters', 'meter', 'm']), unit('ft', null, null, ['feet', 'foot', 'ft']), unit('cm', null, null, ['centimeters', 'centimeter', 'cm'])];
const TIME_UNITS = [unit('hr', null, null, ['hours', 'hour', 'hrs', 'hr']), unit('min', null, null, ['minutes', 'minute', 'mins', 'min']), unit('s', null, null, ['seconds', 'second', 'secs', 'sec', 's'])];
const MASS_UNITS = [unit('kg', null, null, ['kilograms', 'kilogram', 'kg']), unit('g', null, null, ['grams', 'gram', 'g'])];
const VOLUME_UNITS = [unit('mL', null, null, ['milliliters', 'milliliter', 'ml']), unit('L', null, null, ['liters', 'liter', 'l']), unit('cm^3', null, null, ['cm^3', 'cm³', 'cm3'])];
const FORCE_UNITS = [unit('N', null, null, ['newtons', 'newton', 'n'])];
const ACCEL_UNITS = [
  unit('m/s^2', 'm', 's', ['meters per second squared', 'meter per second squared', 'm/s^2', 'm/s²', 'm/s/s']),
  unit('ft/s^2', 'ft', 's', ['feet per second squared', 'foot per second squared', 'ft/s^2', 'ft/s²', 'ft/s/s'])
];
const DENSITY_UNITS = [unit('g/mL', null, null, ['g/ml', 'g/mL', 'grams per milliliter', 'gram per milliliter', 'g/cm^3', 'g/cm3'])];
const MOMENTUM_UNITS = [unit('kg·m/s', null, null, ['kg*m/s', 'kg·m/s', 'kilogram meters per second', 'kilogram meter per second'])];
const VOLTAGE_UNITS = [unit('V', null, null, ['volts', 'volt', 'v'])];
const CURRENT_UNITS = [unit('A', null, null, ['amps', 'amp', 'amperes', 'ampere', 'a'])];
const RESISTANCE_UNITS = [unit('Ω', null, null, ['ohms', 'ohm', 'Ω'])];
const POWER_UNITS = [unit('W', null, null, ['watts', 'watt', 'w'])];
const ENERGY_UNITS = [unit('J', null, null, ['joules', 'joule', 'j'])];
const FREQUENCY_UNITS = [unit('Hz', null, null, ['hertz', 'hz'])];

function unit(canonical, distanceUnit, perTimeUnit, names) {
  return { canonical, distanceUnit, perTimeUnit, names };
}

function findQuantity(text, labels, unitDefs, defaultUnit) {
  const explicit = findExplicitQuantity(text, labels, unitDefs, defaultUnit);
  if (explicit) return explicit;

  return findNumberWithUnit(text, unitDefs);
}

function findExplicitQuantity(text, labels, unitDefs, defaultUnit) {
  const naturalLabels = labels.filter((label) => label.length > 1);
  const symbolLabels = labels.filter((label) => label.length === 1);
  const unitPattern = unitDefs.flatMap((def) => def.names).map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const number = '-?\\d+(?:\\.\\d+)?';
  const unitEnd = unitEndBoundary();

  if (naturalLabels.length) {
    const labelPattern = naturalLabels.map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
    let match = new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:is|=|:|of|as|equals?)?\\s*(${number})\\s*(${unitPattern})?${unitEnd}`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);

    match = new RegExp(`(${number})\\s*(${unitPattern})?${unitEnd}\\s*(?:of\\s+)?(?:${labelPattern})\\b`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);
  }

  if (symbolLabels.length) {
    const symbolPattern = symbolLabels.map(escapeRegex).join('|');
    const match = new RegExp(`\\b(?:${symbolPattern})\\b\\s*(?:=|:)\\s*(${number})\\s*(${unitPattern})?${unitEnd}`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);
  }

  return null;
}

function findNumberWithUnit(text, unitDefs) {
  const unitPattern = unitDefs.flatMap((def) => def.names).map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const match = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})${unitEndBoundary()}`, 'i').exec(text);
  if (!match) return null;
  return buildQuantity(match, unitDefs, null);
}

function buildQuantity(match, unitDefs, defaultUnit) {
  const rawUnit = match[2] || defaultUnit;
  const def = rawUnit ? unitDefs.find((item) => item.names.some((name) => name.toLowerCase() === String(rawUnit).toLowerCase()) || item.canonical.toLowerCase() === String(rawUnit).toLowerCase()) : null;
  const canonical = def ? def.canonical : rawUnit;
  return {
    value: Number(match[1]),
    unit: canonical,
    distanceUnit: def ? def.distanceUnit : null,
    perTimeUnit: def ? def.perTimeUnit : null,
    start: match.index,
    end: match.index + match[0].length
  };
}

function targetFromQuestion(lower, targets, values) {
  for (const target of targets) {
    const pattern = target.replace(/ /g, '\\s+');
    if (new RegExp(`\\b(what is|what's|find|calculate|solve for|determine)\\s+(?:the\\s+)?${pattern}\\b`).test(lower)) return target;
  }
  const present = Object.entries(values).filter(([, value]) => Boolean(value));
  const missing = Object.keys(values).filter((key) => !values[key]);
  if (present.length === 2 && missing.length === 1) return missing[0];
  return null;
}

function massToGrams(mass) {
  return mass.unit === 'kg' ? mass.value * 1000 : mass.value;
}

function massToKg(mass) {
  return mass.unit === 'g' ? mass.value / 1000 : mass.value;
}

function volumeToML(volume) {
  if (volume.unit === 'L') return volume.value * 1000;
  return volume.value;
}

function velocityToMS(velocity) {
  if (velocity.unit === 'm/s') return velocity.value;
  if (velocity.unit === 'mile/hr') return velocity.value * 0.44704;
  if (velocity.unit === 'km/hr') return velocity.value / 3.6;
  if (velocity.unit === 'ft/s') return velocity.value * 0.3048;
  return null;
}

function convertTime(value, fromUnit, toUnit) {
  const seconds = fromUnit === 'hr' ? value * 3600 : fromUnit === 'min' ? value * 60 : fromUnit === 's' ? value : null;
  if (seconds == null) return null;
  if (toUnit === 'hr') return seconds / 3600;
  if (toUnit === 'min') return seconds / 60;
  if (toUnit === 's') return seconds;
  return null;
}

function convertDistance(value, fromUnit, toUnit) {
  const meters = { m: 1, km: 1000, cm: 0.01, mile: 1609.344, ft: 0.3048 };
  if (!meters[fromUnit] || !meters[toUnit]) return null;
  return (value * meters[fromUnit]) / meters[toUnit];
}

function normalizeNumberWords(value) {
  let text = value.replace(/(\d),(?=\d{3}\b)/g, '$1');

  const ones = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9
  };
  const teens = {
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19
  };
  const tens = {
    twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };

  for (const [tenWord, tenValue] of Object.entries(tens)) {
    const onesPattern = Object.keys(ones).join('|');
    text = text.replace(new RegExp(`\\b${tenWord}[-\\s]+(${onesPattern})\\b`, 'gi'), (_match, oneWord) => {
      return String(tenValue + ones[oneWord.toLowerCase()]);
    });
  }

  for (const [word, number] of Object.entries({ ...teens, ...tens, ...ones })) {
    text = text.replace(new RegExp(`\\b${word}\\b`, 'gi'), String(number));
  }

  return text;
}

function mask(text, start, end) {
  return text.slice(0, start) + ' '.repeat(Math.max(0, end - start)) + text.slice(end);
}

function answer(notes, lines) {
  return { notes, answer: lines.join('\n') };
}

function plural(unit, value) {
  if (unit === 'mile' && Math.abs(value) !== 1) return 'miles';
  return unit;
}

function cleanNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4))).replace(/\.0+$/, '');
}

function unitPatternFor(unitDefs) {
  return unitDefs
    .flatMap((def) => [...def.names, def.canonical])
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join('|');
}

function unitEndBoundary() {
  return '(?=$|[^A-Za-z0-9/²³^])';
}

function questionTargetRegex(targetPattern) {
  return new RegExp(`\\b(?:what is|what's|find|calculate|solve for|determine)\\s+(?:(?:my|the)\\s+)?(?:[a-z0-9-]+(?:['’]s)?\\s+)?(?:${targetPattern})\\b`);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formulaContext() {
  return {
    ACCEL_UNITS,
    DENSITY_UNITS,
    DISTANCE_UNITS,
    FORCE_UNITS,
    MASS_UNITS,
    SPEED_UNITS,
    TIME_UNITS,
    VELOCITY_UNITS,
    VOLUME_UNITS,
    answer,
    asksForAcceleration,
    asksForForce,
    cleanNumber,
    convertDistance,
    convertTime,
    escapeRegex,
    findAccelerationQuantity: (inputText) => findAccelerationQuantity(inputText, formulaContext()),
    findAccelerationVelocityChange: (inputText, inputLower) => findAccelerationVelocityChange(inputText, inputLower, formulaContext()),
    findAllNumbersWithUnits,
    findNumberWithUnit,
    findQuantity,
    hasVelocityChangeCue,
    massToGrams,
    massToKg,
    mask,
    plural,
    quantityFromRawUnit,
    targetFromQuestion,
    unitPatternFor,
    velocityToMS,
    volumeToML
  };
}

module.exports = { tryScienceFormula };
