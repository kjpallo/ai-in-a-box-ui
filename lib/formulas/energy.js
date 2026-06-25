const {
  ACCEL_UNITS,
  DISTANCE_UNITS,
  ENERGY_UNITS,
  FORCE_UNITS,
  MASS_UNITS,
  VELOCITY_UNITS,
  convertDistance,
  escapeRegex,
  findExplicitQuantity,
  findQuantity,
  massToKg,
  unitEndBoundary,
  velocityToMS
} = require('./formulaParser');
const { answer, cleanNumber } = require('./formulaAnswerFormatter');
const { buildFormulaWork } = require('./formulaWorkBuilder');
const { earthGravityQuantity, findGravityQuantity } = require('./constants');

// ---------------- Kinetic Energy: KE = 1/2 × m × v² ----------------
function tryKineticEnergy(text, lower) {
  if (/\b(momentum|kg\s*[·*x-]?\s*m\/s|kgm\/s|p\s*=)\b/.test(lower)) return null;
  if (/\b(potential energy|gravitational potential energy|height|high|lifted|raised)\b/.test(lower)) return null;
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
    const formulaWork = buildKineticEnergyFormulaWork({
      solveFor: 'kinetic energy',
      kineticEnergyValue: value,
      massValue: m,
      velocityValue: v
    });
    return answer('Recognized kinetic energy problem: solving for kinetic energy.', [
      'Use the kinetic energy formula: KE = 1/2 × m × v².',
      `KE = 1/2 × ${cleanNumber(m)} kg × ${cleanNumber(v)}²`,
      `KE = ${cleanNumber(value)} J`
    ], formulaWork);
  }

  if (target === 'mass' && kineticEnergy && velocity) {
    const v = velocityToMS(velocity);
    if (v == null || v === 0) return null;
    const value = (2 * kineticEnergy.value) / (v * v);
    const formulaWork = buildKineticEnergyFormulaWork({
      solveFor: 'mass',
      kineticEnergyValue: kineticEnergy.value,
      massValue: value,
      velocityValue: v
    });
    return answer('Recognized kinetic energy problem: solving for mass.', [
      'Use the kinetic energy formula: mass = 2 × KE / v².',
      `m = 2 × ${cleanNumber(kineticEnergy.value)} J / ${cleanNumber(v)}²`,
      `m = ${cleanNumber(value)} kg`
    ], formulaWork);
  }

  if (target === 'velocity' && kineticEnergy && mass) {
    const m = massToKg(mass);
    if (m === 0) return null;
    const value = Math.sqrt((2 * kineticEnergy.value) / m);
    const formulaWork = buildKineticEnergyFormulaWork({
      solveFor: 'velocity',
      kineticEnergyValue: kineticEnergy.value,
      massValue: m,
      velocityValue: value
    });
    return answer('Recognized kinetic energy problem: solving for velocity.', [
      'Use the kinetic energy formula: velocity = square root of (2 × KE / mass).',
      `v = √(2 × ${cleanNumber(kineticEnergy.value)} J / ${cleanNumber(m)} kg)`,
      `v = ${cleanNumber(value)} m/s`
    ], formulaWork);
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

// ---------------- Conservation bridge: KE becomes GPE at the peak ----------------
function tryEnergyConservationHeight(text, lower) {
  if (!/\b(?:all\s+energy\s+is\s+conserved|energy\s+is\s+conserved|assuming\s+all\s+energy\s+is\s+conserved|conservation\s+of\s+energy)\b/.test(lower)) return null;
  if (!/\b(?:straight\s+up|straight\s+upward|upward|height|how\s+high|what\s+height)\b/.test(lower)) return null;
  if (!/\b(?:height|how\s+high|what\s+height|reach|travel)\b/.test(lower)) return null;

  const mass = findQuantity(text, ['mass', 'm'], MASS_UNITS, null);
  const velocity = findQuantity(text, ['velocity', 'speed', 'v'], VELOCITY_UNITS, null);
  if (!mass || !velocity) return null;

  const m = massToKg(mass);
  const v = velocityToMS(velocity);
  if (m === 0 || v == null) return null;

  const kineticEnergyValue = 0.5 * m * v * v;
  const gravity = earthGravityQuantity();
  const heightValue = kineticEnergyValue / (m * gravity.value);
  const formulaWork = buildEnergyConservationFormulaWork({
    massValue: m,
    velocityValue: v,
    kineticEnergyValue,
    gravityValue: gravity.value,
    heightValue
  });

  return answer('Recognized energy conservation bridge problem: solving for height from kinetic energy.', [
    'Use conservation of energy: the starting kinetic energy becomes gravitational potential energy at the peak.',
    'First find kinetic energy: KE = 1/2 × m × v².',
    `KE = 1/2 × ${cleanNumber(m)} kg × ${cleanNumber(v)}²`,
    `KE = ${cleanNumber(kineticEnergyValue)} J`,
    'At the highest point, set KE = GPE and solve h = GPE / (m × 9.8).',
    `h = ${cleanNumber(kineticEnergyValue)} J / (${cleanNumber(m)} kg × ${cleanNumber(gravity.value)} m/s²)`,
    `h = ${cleanNumber(roundEnergyHeight(heightValue))} m`
  ], formulaWork);
}

// ---------------- Potential Energy: PE = m × g × h or PE = force × height ----------------
function tryPotentialEnergy(text, lower, context = {}) {
  if (!/\b(potential energy|gravitational potential energy|pe|height|force|weight|gravity|mass|joule|joules)\b/.test(lower)) return null;

  const potentialEnergy = findQuantity(text, ['gravitational potential energy', 'potential energy', 'energy', 'pe'], ENERGY_UNITS, null);
  const mass = findQuantity(text, ['mass', 'm'], MASS_UNITS, null);
  const acceleration = context.findAccelerationQuantity?.(text) ||
    findQuantity(text, ['acceleration', 'a'], ACCEL_UNITS, null);

  if (context.asksForForce?.(lower) && mass && acceleration) return null;

  const force = findQuantity(text, ['force', 'weight', 'f'], FORCE_UNITS, null);
  const heights = uniqueHeights(findHeightQuantities(text));
  const height = heights[0] || null;
  const gravity = findGravityQuantity(text, {
    ACCEL_UNITS,
    findQuantity: (inputText, labels, unitDefs, defaultUnit) => findExplicitQuantity(inputText, labels, unitDefs, defaultUnit)
  }) || earthGravityQuantity();
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
    const formulaWork = buildPotentialEnergyFormulaWork({
      solveFor: 'potential energy',
      potentialEnergyValue: value,
      massValue: m,
      gravityValue: gravity.value,
      heightValue: h
    });
    return answer('Recognized potential energy problem: solving for potential energy using mass, gravity, and height.', [
      'Use the potential energy formula: PE = m × g × h.',
      gravity.isDefault ? 'For Earth, use g = 9.8 m/s².' : `g = ${cleanNumber(gravity.value)} m/s²`,
      `PE = ${cleanNumber(m)} kg × ${cleanNumber(gravity.value)} m/s² × ${cleanNumber(h)} m`,
      `PE = ${cleanNumber(value)} J`
    ], formulaWork);
  }

  if (target === 'mass' && potentialEnergy && height) {
    const h = convertDistance(height.value, height.unit, 'm');
    if (h == null || h === 0 || gravity.value === 0) return null;
    const value = potentialEnergy.value / (gravity.value * h);
    const formulaWork = buildPotentialEnergyFormulaWork({
      solveFor: 'mass',
      potentialEnergyValue: potentialEnergy.value,
      massValue: value,
      gravityValue: gravity.value,
      heightValue: h
    });
    return answer('Recognized potential energy problem: solving for mass.', [
      'Use the potential energy formula: mass = PE / (gravity × height).',
      gravity.isDefault ? 'For Earth, use g = 9.8 m/s².' : `g = ${cleanNumber(gravity.value)} m/s²`,
      `m = ${cleanNumber(potentialEnergy.value)} J / (${cleanNumber(gravity.value)} m/s² × ${cleanNumber(h)} m)`,
      `m = ${cleanNumber(roundTo(value, 2))} kg`
    ], formulaWork);
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
    const formulaWork = buildPotentialEnergyFormulaWork({
      solveFor: 'height',
      potentialEnergyValue: potentialEnergy.value,
      massValue: m,
      gravityValue: gravity.value,
      heightValue: value
    });
    return answer('Recognized potential energy problem: solving for height using mass and gravity.', [
      'Use the potential energy formula: height = PE / (mass × gravity).',
      gravity.isDefault ? 'For Earth, use g = 9.8 m/s².' : `g = ${cleanNumber(gravity.value)} m/s²`,
      `height = ${cleanNumber(potentialEnergy.value)} J / (${cleanNumber(m)} kg × ${cleanNumber(gravity.value)} m/s²)`,
      `height = ${cleanNumber(value)} m`
    ], formulaWork);
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
  if (values.potentialEnergy && values.height && !values.mass && !values.force) return 'mass';
  return null;
}

function buildKineticEnergyFormulaWork({ solveFor, kineticEnergyValue, massValue, velocityValue }) {
  const kineticEnergyDisplay = `${cleanNumber(kineticEnergyValue)} J`;
  const massDisplay = `${cleanNumber(massValue)} kg`;
  const velocityDisplay = `${cleanNumber(velocityValue)} m/s`;
  const finalAnswerByTarget = {
    'kinetic energy': { value: kineticEnergyValue, unit: 'J', display: kineticEnergyDisplay },
    mass: { value: massValue, unit: 'kg', display: massDisplay },
    velocity: { value: velocityValue, unit: 'm/s', display: velocityDisplay }
  };
  const formulaByTarget = {
    'kinetic energy': 'KE = 1/2 × m × v²',
    mass: 'm = 2 × KE / v²',
    velocity: 'v = √(2 × KE / m)'
  };
  const calculationByTarget = {
    'kinetic energy': {
      prompt: `Now substitute: KE = 1/2 × ${cleanNumber(massValue)} × ${cleanNumber(velocityValue)}². What is 1/2 × ${cleanNumber(massValue)} × ${cleanNumber(velocityValue)}²?`,
      hint: 'Square velocity, multiply by mass, then multiply by 1/2.'
    },
    mass: {
      prompt: `Now substitute: m = 2 × ${cleanNumber(kineticEnergyValue)} / ${cleanNumber(velocityValue)}². What is 2 × ${cleanNumber(kineticEnergyValue)} / ${cleanNumber(velocityValue)}²?`,
      hint: 'Double the kinetic energy, then divide by velocity squared.'
    },
    velocity: {
      prompt: `Now substitute: v = √(2 × ${cleanNumber(kineticEnergyValue)} / ${cleanNumber(massValue)}). What is √(2 × ${cleanNumber(kineticEnergyValue)} / ${cleanNumber(massValue)})?`,
      hint: 'Double the kinetic energy, divide by mass, then take the square root.'
    }
  };
  const finalAnswer = finalAnswerByTarget[solveFor];
  const calculation = calculationByTarget[solveFor];

  return buildFormulaWork({
    formulaId: 'kinetic_energy',
    family: 'kinetic_energy',
    solveFor,
    formula: formulaByTarget[solveFor],
    finalAnswer,
    choices: ['kinetic energy', 'mass', 'velocity'],
    formulaDistractors: ['PE = m × g × h', 'p = m × v'],
    variables: [
      { key: 'kinetic energy', symbol: 'KE', value: kineticEnergyValue, unit: 'J', display: kineticEnergyDisplay },
      { key: 'mass', symbol: 'm', value: massValue, unit: 'kg', display: massDisplay },
      { key: 'velocity', symbol: 'v', value: velocityValue, unit: 'm/s', display: velocityDisplay }
    ],
    calculation: {
      prompt: calculation.prompt,
      expectedValue: finalAnswer.value,
      hints: [calculation.hint]
    }
  });
}

function buildPotentialEnergyFormulaWork({ solveFor, potentialEnergyValue, massValue, gravityValue, heightValue }) {
  const potentialEnergyDisplay = `${cleanNumber(potentialEnergyValue)} J`;
  const massDisplay = solveFor === 'mass'
    ? `${cleanNumber(roundTo(massValue, 2))} kg`
    : `${cleanNumber(massValue)} kg`;
  const gravityDisplay = `${cleanNumber(gravityValue)} m/s²`;
  const heightDisplay = solveFor === 'height'
    ? `${cleanNumber(roundEnergyHeight(heightValue))} m`
    : `${cleanNumber(heightValue)} m`;
  const finalAnswerByTarget = {
    'potential energy': { value: potentialEnergyValue, unit: 'J', display: potentialEnergyDisplay },
    height: { value: heightValue, unit: 'm', display: heightDisplay },
    mass: { value: massValue, unit: 'kg', display: massDisplay },
    gravity: { value: gravityValue, unit: 'm/s²', display: gravityDisplay }
  };
  const formulaByTarget = {
    'potential energy': 'PE = m × g × h',
    height: 'h = PE / (m × g)',
    mass: 'm = PE / (g × h)',
    gravity: 'g = PE / (m × h)'
  };
  const calculationByTarget = {
    'potential energy': {
      prompt: `Now substitute: PE = ${cleanNumber(massValue)} × ${cleanNumber(gravityValue)} × ${cleanNumber(heightValue)}. What is ${cleanNumber(massValue)} × ${cleanNumber(gravityValue)} × ${cleanNumber(heightValue)}?`,
      hint: 'Multiply mass, gravity, and height.'
    },
    height: {
      prompt: `Now substitute: h = ${cleanNumber(potentialEnergyValue)} / (${cleanNumber(massValue)} × ${cleanNumber(gravityValue)}). What is ${cleanNumber(potentialEnergyValue)} / (${cleanNumber(massValue)} × ${cleanNumber(gravityValue)})?`,
      hint: 'Multiply mass by gravity, then divide potential energy by that product.'
    },
    mass: {
      prompt: `Now substitute: m = ${cleanNumber(potentialEnergyValue)} / (${cleanNumber(gravityValue)} × ${cleanNumber(heightValue)}). What is ${cleanNumber(potentialEnergyValue)} / (${cleanNumber(gravityValue)} × ${cleanNumber(heightValue)})?`,
      hint: 'Multiply gravity by height, then divide potential energy by that product.'
    },
    gravity: {
      prompt: `Now substitute: g = ${cleanNumber(potentialEnergyValue)} / (${cleanNumber(massValue)} × ${cleanNumber(heightValue)}). What is ${cleanNumber(potentialEnergyValue)} / (${cleanNumber(massValue)} × ${cleanNumber(heightValue)})?`,
      hint: 'Multiply mass by height, then divide potential energy by that product.'
    }
  };
  const finalAnswer = finalAnswerByTarget[solveFor];
  const calculation = calculationByTarget[solveFor];

  return buildFormulaWork({
    formulaId: 'potential_energy',
    family: 'potential_energy',
    solveFor,
    formula: formulaByTarget[solveFor],
    finalAnswer,
    choices: ['potential energy', 'height', 'mass', 'gravity'],
    formulaDistractors: ['KE = 1/2 × m × v²', 'W = F × d'],
    variables: [
      { key: 'potential energy', symbol: 'PE', value: potentialEnergyValue, unit: 'J', display: potentialEnergyDisplay },
      { key: 'mass', symbol: 'm', value: massValue, unit: 'kg', display: massDisplay },
      { key: 'gravity', symbol: 'g', value: gravityValue, unit: 'm/s²', display: gravityDisplay },
      { key: 'height', symbol: 'h', value: heightValue, unit: 'm', display: heightDisplay }
    ],
    calculation: {
      prompt: calculation.prompt,
      expectedValue: finalAnswer.value,
      hints: [calculation.hint]
    }
  });
}

function buildEnergyConservationFormulaWork({ massValue, velocityValue, kineticEnergyValue, gravityValue, heightValue }) {
  const massDisplay = `${cleanNumber(massValue)} kg`;
  const velocityDisplay = `${cleanNumber(velocityValue)} m/s`;
  const kineticEnergyDisplay = `${cleanNumber(kineticEnergyValue)} J`;
  const gravityDisplay = `${cleanNumber(gravityValue)} m/s²`;
  const heightDisplay = `${cleanNumber(roundEnergyHeight(heightValue))} m`;

  return buildFormulaWork({
    formulaId: 'energy_conservation',
    family: 'energy_conservation',
    solveFor: 'height',
    formula: 'KE = 1/2 × m × v², then h = KE / (m × g)',
    finalAnswer: { value: heightValue, unit: 'm', display: heightDisplay },
    choices: ['height', 'kinetic energy', 'mass', 'velocity'],
    formulaDistractors: ['W = F × d', 'P = W / t'],
    variables: [
      { key: 'mass', symbol: 'm', value: massValue, unit: 'kg', display: massDisplay },
      { key: 'velocity', symbol: 'v', value: velocityValue, unit: 'm/s', display: velocityDisplay },
      { key: 'kinetic energy', symbol: 'KE', value: kineticEnergyValue, unit: 'J', display: kineticEnergyDisplay },
      { key: 'gravity', symbol: 'g', value: gravityValue, unit: 'm/s²', display: gravityDisplay },
      { key: 'height', symbol: 'h', value: heightValue, unit: 'm', display: heightDisplay }
    ],
    calculation: {
      prompt: `First KE = 1/2 × ${cleanNumber(massValue)} × ${cleanNumber(velocityValue)}² = ${cleanNumber(kineticEnergyValue)}. Then h = ${cleanNumber(kineticEnergyValue)} / (${cleanNumber(massValue)} × ${cleanNumber(gravityValue)}). What is the height?`,
      expectedValue: heightValue,
      hints: ['Find kinetic energy first, then divide that energy by mass times 9.8.']
    }
  });
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
    new RegExp(`\\b${number}\\s*${unit}${unitEnd}[\\s\\S]{0,35}\\b(?:high|height|tall|shelf|shelves)\\b`, 'gi'),
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

function partLabel(index) {
  const letter = String.fromCharCode(65 + index);
  return `Part ${letter}`;
}

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function roundEnergyHeight(value) {
  return Math.abs(Number(value)) >= 100 ? roundTo(value, 1) : roundTo(value, 2);
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

module.exports = { tryEnergyConservationHeight, tryKineticEnergy, tryPotentialEnergy };
