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
const { tryKineticEnergy, tryPotentialEnergy } = require('./energy');
const {
  tryAtomicNumber,
  tryGravityConstant,
  trySpecificHeat,
  tryWeight
} = require('./basics');

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
    tryPotentialEnergy(text, lower, formulaContext()) ||
    tryWeight(text, lower) ||
    null;
}

function asksForForce(lower) {
  return /\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(?:force|net force|f)\b/.test(lower) ||
    /\bwhat\s+force\b/.test(lower) ||
    /\bhow\s+much\s+force\b/.test(lower);
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
  findNumberWithUnit,
  findQuantity,
  mask,
  massToGrams,
  massToKg,
  normalizeNumberWords,
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
