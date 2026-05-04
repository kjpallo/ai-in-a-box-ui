const {
  asksForAcceleration,
  findAccelerationQuantity,
  findAccelerationVelocityChange,
  hasVelocityChangeCue,
  tryAccelerationFromDistanceTimeRuns,
  tryAccelerationFromVelocity
} = require('./acceleration');
const {
  tryAtomicNumber,
  tryGravityConstant,
  trySpecificHeat,
  tryWeight
} = require('./basics');
const { tryDensity } = require('./density');
const { tryElectricity } = require('./electricity');
const { tryKineticEnergy, tryPotentialEnergy } = require('./energy');
const { tryForce, tryForceFromVelocityChange } = require('./force');
const { tryMomentum } = require('./momentum');
const { tryMotion } = require('./motion');
const { tryWaves } = require('./waves');
const { tryWorkPowerTime } = require('./workPower');
const {
  ACCEL_UNITS,
  DENSITY_UNITS,
  DISTANCE_UNITS,
  FORCE_UNITS,
  MASS_UNITS,
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
