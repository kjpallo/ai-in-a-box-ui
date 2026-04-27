function tryScienceFormula(message) {
  const text = normalizeNumberWords(String(message || ''));
  const lower = text.toLowerCase();

  return tryAccelerationFromVelocity(text, lower) ||
    tryMotion(text, lower) ||
    tryDensity(text, lower) ||
    tryForce(text, lower) ||
    tryWeight(text, lower) ||
    tryMomentum(text, lower) ||
    null;
}

// ---------------- Motion: distance = speed × time ----------------
function tryMotion(text, lower) {
  const speed = findNumberWithUnit(text, SPEED_UNITS);
  const masked = speed ? mask(text, speed.start, speed.end) : text;
  const distance = findQuantity(masked, ['distance'], DISTANCE_UNITS, null);
  const time = findQuantity(masked, ['time'], TIME_UNITS, null);
  const target = motionTarget(lower, { speed, distance, time });

  if (target === 'distance' && speed && time) {
    const timeInRateUnit = convertTime(time.value, time.unit, speed.perTimeUnit);
    if (timeInRateUnit == null) return null;
    const value = speed.value * timeInRateUnit;
    return answer('Recognized motion problem: solving for distance using speed and time.', [
      'Use the motion formula: distance = speed × time.',
      `distance = ${cleanNumber(speed.value)} ${speed.unit} × ${cleanNumber(timeInRateUnit)} ${speed.perTimeUnit}`,
      `distance = ${cleanNumber(value)} ${plural(speed.distanceUnit, value)}`
    ]);
  }

  if (target === 'speed' && distance && time && time.value !== 0) {
    const value = distance.value / time.value;
    return answer('Recognized motion problem: solving for speed using distance and time.', [
      'Use the motion formula: speed = distance / time.',
      `speed = ${cleanNumber(distance.value)} ${plural(distance.unit, distance.value)} / ${cleanNumber(time.value)} ${time.unit}`,
      `speed = ${cleanNumber(value)} ${distance.unit}/${time.unit}`
    ]);
  }

  if (target === 'time' && distance && speed && speed.value !== 0) {
    const distanceInRateUnit = convertDistance(distance.value, distance.unit, speed.distanceUnit);
    if (distanceInRateUnit == null) return null;
    const value = distanceInRateUnit / speed.value;
    return answer('Recognized motion problem: solving for time using distance and speed.', [
      'Use the motion formula: time = distance / speed.',
      `time = ${cleanNumber(distanceInRateUnit)} ${plural(speed.distanceUnit, distanceInRateUnit)} / ${cleanNumber(speed.value)} ${speed.unit}`,
      `time = ${cleanNumber(value)} ${speed.perTimeUnit}`
    ]);
  }

  return null;
}

function motionTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?speed\b/.test(lower) || /\bhow fast\b/.test(lower)) return 'speed';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?velocity\b/.test(lower)) return 'speed';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?time\b/.test(lower) || /\bhow long\b/.test(lower)) return 'time';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?distance\b/.test(lower) || /\bhow far\b/.test(lower) || /\bhow many\s+(miles|kilometers|meters|feet)\b/.test(lower)) return 'distance';

  if (values.speed && values.time && !values.distance) return 'distance';
  if (values.distance && values.time && !values.speed) return 'speed';
  if (values.distance && values.speed && !values.time) return 'time';
  return null;
}

// ---------------- Density: D = m / V ----------------
function tryDensity(text, lower) {
  if (!/\b(density|mass|volume)\b|\bd\s*=|\bm\s*=|\bv\s*=/.test(lower)) return null;

  const density = findQuantity(text, ['density'], DENSITY_UNITS, null);
  const mass = findQuantity(text, ['mass'], MASS_UNITS, null);
  const volume = findQuantity(text, ['volume'], VOLUME_UNITS, null);
  const target = targetFromQuestion(lower, ['density', 'mass', 'volume'], { density, mass, volume });

  if (target === 'density' && mass && volume && volume.value !== 0) {
    const m = massToGrams(mass);
    const v = volumeToML(volume);
    const value = m / v;
    return answer('Recognized density problem: solving for density.', [
      'Use the density formula: D = m / V.',
      `D = ${cleanNumber(m)} g / ${cleanNumber(v)} mL`,
      `D = ${cleanNumber(value)} g/mL`
    ]);
  }

  if (target === 'mass' && density && volume) {
    const v = volumeToML(volume);
    const value = density.value * v;
    return answer('Recognized density problem: solving for mass.', [
      'Use the density formula: mass = density × volume.',
      `m = ${cleanNumber(density.value)} g/mL × ${cleanNumber(v)} mL`,
      `m = ${cleanNumber(value)} g`
    ]);
  }

  if (target === 'volume' && mass && density && density.value !== 0) {
    const m = massToGrams(mass);
    const value = m / density.value;
    return answer('Recognized density problem: solving for volume.', [
      'Use the density formula: volume = mass / density.',
      `V = ${cleanNumber(m)} g / ${cleanNumber(density.value)} g/mL`,
      `V = ${cleanNumber(value)} mL`
    ]);
  }

  return null;
}

// ---------------- Force: F = m × a ----------------
function tryForce(text, lower) {
  if (!(/\b(force|newton|newtons)\b|\bf\s*=/.test(lower) || (/\bmass\b/.test(lower) && /\bacceleration\b/.test(lower)))) return null;

  const force = findQuantity(text, ['force'], FORCE_UNITS, null);
  const mass = findQuantity(text, ['mass'], MASS_UNITS, null);
  const acceleration = findQuantity(text, ['acceleration'], ACCEL_UNITS, null);
  const target = targetFromQuestion(lower, ['force', 'mass', 'acceleration'], { force, mass, acceleration });

  if (target === 'force' && mass && acceleration) {
    const m = massToKg(mass);
    const value = m * acceleration.value;
    return answer('Recognized Newton\'s second law problem: solving for force.', [
      'Use Newton\'s second law: F = m × a.',
      `F = ${cleanNumber(m)} kg × ${cleanNumber(acceleration.value)} m/s^2`,
      `F = ${cleanNumber(value)} N`
    ]);
  }

  if (target === 'mass' && force && acceleration && acceleration.value !== 0) {
    const value = force.value / acceleration.value;
    return answer('Recognized Newton\'s second law problem: solving for mass.', [
      'Use Newton\'s second law: mass = force / acceleration.',
      `m = ${cleanNumber(force.value)} N / ${cleanNumber(acceleration.value)} m/s^2`,
      `m = ${cleanNumber(value)} kg`
    ]);
  }

  if (target === 'acceleration' && force && mass) {
    const m = massToKg(mass);
    if (m === 0) return null;
    const value = force.value / m;
    return answer('Recognized Newton\'s second law problem: solving for acceleration.', [
      'Use Newton\'s second law: acceleration = force / mass.',
      `a = ${cleanNumber(force.value)} N / ${cleanNumber(m)} kg`,
      `a = ${cleanNumber(value)} m/s^2`
    ]);
  }

  return null;
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
    gravity.value === 9.8 ? 'For Earth, use g = 9.8 m/s^2.' : `g = ${cleanNumber(gravity.value)} m/s^2`,
    `Fg = ${cleanNumber(m)} kg × ${cleanNumber(gravity.value)} m/s^2`,
    `Fg = ${cleanNumber(value)} N`
  ]);
}

// ---------------- Acceleration: a = (vf - vi) / t ----------------
function tryAccelerationFromVelocity(text, lower) {
  if (!/\b(acceleration|initial velocity|final velocity|velocity|vf|vi)\b/.test(lower)) return null;

  const vi = findQuantity(text, ['initial velocity', 'starting velocity', 'start velocity', 'vi'], VELOCITY_UNITS, null);
  const vf = findQuantity(text, ['final velocity', 'ending velocity', 'end velocity', 'vf'], VELOCITY_UNITS, null);
  const acceleration = findQuantity(text, ['acceleration'], ACCEL_UNITS, null);
  const time = findQuantity(text, ['time'], TIME_UNITS, null);
  const target = accelerationTarget(lower, { acceleration, vi, vf, time });

  if (target === 'acceleration' && vi && vf && time && time.value !== 0) {
    const viMS = velocityToMS(vi);
    const vfMS = velocityToMS(vf);
    const tS = convertTime(time.value, time.unit, 's');
    if (viMS == null || vfMS == null || tS == null || tS === 0) return null;
    const value = (vfMS - viMS) / tS;
    return answer('Recognized acceleration problem: solving from final velocity, initial velocity, and time.', [
      'Use the acceleration formula: a = (vf - vi) / t.',
      `a = (${cleanNumber(vfMS)} m/s - ${cleanNumber(viMS)} m/s) / ${cleanNumber(tS)} s`,
      `a = ${cleanNumber(value)} m/s^2`
    ]);
  }

  if (target === 'final velocity' && vi && acceleration && time) {
    const viMS = velocityToMS(vi);
    const tS = convertTime(time.value, time.unit, 's');
    if (viMS == null || tS == null) return null;
    const value = viMS + acceleration.value * tS;
    return answer('Recognized velocity problem: solving for final velocity.', [
      'Use the formula: vf = vi + a × t.',
      `vf = ${cleanNumber(viMS)} m/s + ${cleanNumber(acceleration.value)} m/s^2 × ${cleanNumber(tS)} s`,
      `vf = ${cleanNumber(value)} m/s`
    ]);
  }

  if (target === 'initial velocity' && vf && acceleration && time) {
    const vfMS = velocityToMS(vf);
    const tS = convertTime(time.value, time.unit, 's');
    if (vfMS == null || tS == null) return null;
    const value = vfMS - acceleration.value * tS;
    return answer('Recognized velocity problem: solving for initial velocity.', [
      'Use the formula: vi = vf - a × t.',
      `vi = ${cleanNumber(vfMS)} m/s - ${cleanNumber(acceleration.value)} m/s^2 × ${cleanNumber(tS)} s`,
      `vi = ${cleanNumber(value)} m/s`
    ]);
  }

  if (target === 'time' && vi && vf && acceleration && acceleration.value !== 0) {
    const viMS = velocityToMS(vi);
    const vfMS = velocityToMS(vf);
    if (viMS == null || vfMS == null) return null;
    const value = (vfMS - viMS) / acceleration.value;
    return answer('Recognized acceleration problem: solving for time.', [
      'Use the formula: time = (vf - vi) / acceleration.',
      `t = (${cleanNumber(vfMS)} m/s - ${cleanNumber(viMS)} m/s) / ${cleanNumber(acceleration.value)} m/s^2`,
      `t = ${cleanNumber(value)} s`
    ]);
  }

  return null;
}

function accelerationTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?acceleration\b/.test(lower)) return 'acceleration';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?final velocity\b/.test(lower) || /\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?vf\b/.test(lower)) return 'final velocity';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?initial velocity\b/.test(lower) || /\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?vi\b/.test(lower)) return 'initial velocity';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?time\b/.test(lower) || /\bhow long\b/.test(lower)) return 'time';

  if (values.vi && values.vf && values.time && !values.acceleration) return 'acceleration';
  if (values.vi && values.acceleration && values.time && !values.vf) return 'final velocity';
  if (values.vf && values.acceleration && values.time && !values.vi) return 'initial velocity';
  if (values.vi && values.vf && values.acceleration && !values.time) return 'time';
  return null;
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
const VOLUME_UNITS = [unit('mL', null, null, ['milliliters', 'milliliter', 'ml']), unit('L', null, null, ['liters', 'liter', 'l']), unit('cm^3', null, null, ['cm^3', 'cm3'])];
const FORCE_UNITS = [unit('N', null, null, ['newtons', 'newton', 'n'])];
const ACCEL_UNITS = [unit('m/s^2', null, null, ['meters per second squared', 'meter per second squared', 'm/s^2', 'm/s²', 'm/s/s'])];
const DENSITY_UNITS = [unit('g/mL', null, null, ['g/ml', 'g/mL', 'grams per milliliter', 'gram per milliliter', 'g/cm^3', 'g/cm3'])];
const MOMENTUM_UNITS = [unit('kg·m/s', null, null, ['kg*m/s', 'kg·m/s', 'kilogram meters per second', 'kilogram meter per second'])];

function unit(canonical, distanceUnit, perTimeUnit, names) {
  return { canonical, distanceUnit, perTimeUnit, names };
}

function findQuantity(text, labels, unitDefs, defaultUnit) {
  const naturalLabels = labels.filter((label) => label.length > 1);
  const symbolLabels = labels.filter((label) => label.length === 1);
  const unitPattern = unitDefs.flatMap((def) => def.names).map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const number = '-?\\d+(?:\\.\\d+)?';

  if (naturalLabels.length) {
    const labelPattern = naturalLabels.map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
    let match = new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:is|=|:|of|as|equals?)?\\s*(${number})\\s*(${unitPattern})?`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);

    match = new RegExp(`(${number})\\s*(${unitPattern})?\\s*(?:of\\s+)?(?:${labelPattern})\\b`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);
  }

  if (symbolLabels.length) {
    const symbolPattern = symbolLabels.map(escapeRegex).join('|');
    const match = new RegExp(`\\b(?:${symbolPattern})\\b\\s*(?:=|:)\\s*(${number})\\s*(${unitPattern})?`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);
  }

  return findNumberWithUnit(text, unitDefs);
}

function findNumberWithUnit(text, unitDefs) {
  const unitPattern = unitDefs.flatMap((def) => def.names).map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const match = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})(?=$|[^A-Za-z0-9/²^])`, 'i').exec(text);
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
  const words = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20
  };
  let text = value;
  for (const [word, number] of Object.entries(words)) {
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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { tryScienceFormula };
