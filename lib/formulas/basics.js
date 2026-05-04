const {
  ACCEL_UNITS,
  MASS_UNITS,
  escapeRegex,
  findNumberWithUnit,
  findQuantity,
  massToGrams,
  massToKg,
  questionTargetRegex
} = require('./formulaParser');
const { answer, cleanNumber } = require('./formulaAnswerFormatter');

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

module.exports = {
  tryAtomicNumber,
  tryGravityConstant,
  trySpecificHeat,
  tryWeight
};
