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
const { tryWaves } = require('./waves');
const { tryWorkPowerTime } = require('./workPower');
const { tryElectricity } = require('./electricity');

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
    tryElectricity(text, lower) ||
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

const {
  ACCEL_UNITS,
  DENSITY_UNITS,
  DISTANCE_UNITS,
  ENERGY_UNITS,
  FORCE_UNITS,
  MASS_UNITS,
  MOMENTUM_UNITS,
  SPEED_UNITS,
  TIME_UNITS,
  VELOCITY_UNITS,
  VOLUME_UNITS,
  convertDistance,
  convertTime,
  escapeRegex,
  findExplicitQuantity,
  findNumberWithUnit,
  findQuantity,
  mask,
  massToGrams,
  massToKg,
  normalizeNumberWords,
  questionTargetRegex,
  targetFromQuestion,
  unitEndBoundary,
  unitPatternFor,
  velocityToMS,
  volumeToML
} = require('./formulaParser');
const { answer, cleanNumber, plural } = require('./formulaAnswerFormatter');

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
