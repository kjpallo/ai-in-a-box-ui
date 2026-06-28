const {
  asksForAcceleration,
  findAccelerationQuantity,
  findAccelerationVelocityChange,
  hasVelocityChangeCue,
  tryAccelerationFromDistanceTimeRuns,
  tryAccelerationFromVelocity
} = require('./acceleration');
const { tryUnit1ConversionsNotation } = require('./unit1Conversions');
const {
  tryAtomicNumber,
  tryGravityConstant,
  trySpecificHeat,
  tryWeight
} = require('./basics');
const { tryDensity } = require('./density');
const { tryDisplacement } = require('./displacement');
const { tryElectricity } = require('./electricity');
const { tryEnergyConservationHeight, tryKineticEnergy, tryPotentialEnergy } = require('./energy');
const { tryForce, tryForceAndFinalMomentumFromVelocityChange, tryForceFromVelocityChange } = require('./force');
const { tryFreeBodyInference } = require('./freeBodyInference');
const { tryFriction } = require('./friction');
const { tryFrictionNetForceNewton } = require('./frictionNetForceNewton');
const { tryMomentum } = require('./momentum');
const { tryNetForce } = require('./netForce');
const { tryNetForceNewton } = require('./netForceNewton');
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
  findNumberOrArticleWithUnit,
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

const NUMBER_PATTERN = '-?(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)';

function tryScienceFormula(message) {
  const text = normalizeNumberWords(String(message || ''));
  const lower = text.toLowerCase();

  return tryUnit1ConversionsNotation(text, lower) ||
    tryAtomicNumber(text, lower) ||
    trySpecificHeat(text, lower) ||
    tryGravityConstant(text, lower) ||
    tryForceAndFinalMomentumFromVelocityChange(text, lower, formulaContext()) ||
    tryForceFromVelocityChange(text, lower, formulaContext()) ||
    tryAccelerationFromDistanceTimeRuns(text, lower, formulaContext()) ||
    tryAccelerationFromVelocity(text, lower, formulaContext()) ||
    tryWaves(text, lower) ||
    tryMomentum(text, lower) ||
    tryEnergyConservationHeight(text, lower) ||
    tryKineticEnergy(text, lower) ||
    tryDensity(text, lower, formulaContext()) ||
    tryElectricity(text, lower) ||
    tryWorkPowerTime(text, lower) ||
    tryDisplacement(text, lower, formulaContext()) ||
    tryMotion(text, lower, formulaContext()) ||
    tryFrictionNetForceNewton(text, lower, formulaContext()) ||
    tryNetForceNewton(text, lower, formulaContext()) ||
    tryNetForce(text, lower, formulaContext()) ||
    tryFreeBodyInference(text, lower, formulaContext()) ||
    tryFriction(text, lower, formulaContext()) ||
    tryForce(text, lower, formulaContext()) ||
    tryPotentialEnergy(text, lower, formulaContext()) ||
    tryWeight(text, lower) ||
    tryEverydayPoundMass(text, lower) ||
    tryMassFormulaClarification(lower) ||
    null;
}

function tryEverydayPoundMass(text, lower) {
  if (!asksForEverydayMassFromPounds(lower)) return null;
  if (/\b(?:force\s+of\s+gravity|weight\s+in\s+newtons?|newtons?)\b/.test(lower)) return null;

  const match = /\b(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(lb|lbs|pound|pounds)\b/i.exec(text);
  if (!match) return null;

  const pounds = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(pounds) || pounds <= 0) return null;

  const kilograms = pounds / 2.205;
  const kilogramsRounded = Number(kilograms.toFixed(kilograms < 10 ? 2 : 1));
  const subject = everydayPoundSubject(text, match) || 'object';

  return answer('Recognized everyday pounds-to-kilograms mass question.', [
    `A ${cleanNumber(pounds)} lb ${subject} has a mass of about ${cleanNumber(kilogramsRounded)} kg on Earth.`,
    'In everyday speech, pounds are often used for body weight, while kilograms measure mass.'
  ]);
}

function asksForEverydayMassFromPounds(lower) {
  if (!/\b(?:lb|lbs|pounds?)\b/.test(lower)) return false;
  if (!/\bmass\b/.test(lower)) return false;

  return /\b(?:what is|what's|find|calculate|determine)\s+(?:the\s+)?mass\b/.test(lower) ||
    /\bmass\s+of\b/.test(lower) ||
    /\bhas\s+what\s+mass\b/.test(lower) ||
    /\bwhat\s+mass\b/.test(lower) ||
    /\b(?:weighs?|weight)\b/.test(lower);
}

function everydayPoundSubject(text, poundMatch) {
  const numberUnit = escapeRegex(poundMatch[0]);
  const beforeNumber = text.slice(0, poundMatch.index);
  const afterNumber = text.slice(poundMatch.index + poundMatch[0].length);

  const beforeMatch = /\b(?:a|an|the)\s+([a-z][a-z-]*)\s+(?:has|weighs?)\b/i.exec(beforeNumber);
  if (beforeMatch) return beforeMatch[1].toLowerCase();

  const afterMatch = new RegExp(`${numberUnit}\\s+([a-z][a-z-]*)\\b`, 'i').exec(text);
  if (afterMatch && !isEverydayPoundStopWord(afterMatch[1])) return afterMatch[1].toLowerCase();

  const massOfMatch = /\bmass\s+of\s+(?:a|an|the)\s+([a-z][a-z-]*)\b/i.exec(beforeNumber);
  if (massOfMatch && !isEverydayPoundStopWord(massOfMatch[1])) return massOfMatch[1].toLowerCase();

  const trailingSubject = /^\s+([a-z][a-z-]*)\b/i.exec(afterNumber);
  if (trailingSubject && !isEverydayPoundStopWord(trailingSubject[1])) return trailingSubject[1].toLowerCase();

  return '';
}

function isEverydayPoundStopWord(value) {
  return /^(on|in|at|has|have|had|what|mass|weigh|weight|weighs)$/i.test(String(value || ''));
}

function tryMassFormulaClarification(lower) {
  if (!asksToSolveForMass(lower)) return null;

  const hasDensity = /\bdensity\b/.test(lower);
  const hasVolume = /\bvolume\b/.test(lower);
  const hasForce = /\bforce|net force|newtons?\b/.test(lower);
  const hasAcceleration = /\bacceleration|accelerashun|m\/s\^?2|m\/s²\b/.test(lower);
  const hasKineticEnergy = /\bkinetic energy|ke\b/.test(lower);
  const hasVelocity = /\bvelocity|speed\b/.test(lower);

  if (hasDensity && hasVolume) {
    return answer('Recognized density formula question: solving for mass.', [
      'To solve for mass with density and volume, use: mass = density × volume.',
      'm = D × V.'
    ]);
  }

  if (hasForce && hasAcceleration) {
    return answer('Recognized Newton’s second law formula question: solving for mass.', [
      'To solve for mass with force and acceleration, use: mass = force / acceleration.',
      'm = F / a.'
    ]);
  }

  if (hasKineticEnergy && hasVelocity) {
    return answer('Recognized kinetic energy formula question: solving for mass.', [
      'To solve for mass with kinetic energy and velocity, use: mass = 2KE / velocity².',
      'm = 2KE / v².'
    ]);
  }

  return answer('Recognized ambiguous formula question: solving for mass.', [
    'Here are common formulas that can solve for mass:',
    '1. From force and acceleration: mass = force ÷ acceleration, or m = F / a.',
    '2. From density and volume: mass = density × volume, or m = D × V.',
    '3. From kinetic energy and velocity: mass = 2KE ÷ velocity², or m = 2KE / v².',
    'Which values do you have?'
  ]);
}

function asksToSolveForMass(lower) {
  return /\b(?:solve for|find|calculate|determine)\s+(?:the\s+)?mass\b/.test(lower) ||
    /\bhow\s+(?:do|would|can)\s+i\s+(?:solve for|find|calculate)\s+(?:the\s+)?mass\b/.test(lower) ||
    /\bwhat\s+formulas?\s+(?:do\s+i\s+use\s+)?(?:for|to\s+find|to\s+solve\s+for)\s+(?:the\s+)?mass\b/.test(lower) ||
    /\bwhat\s+are\s+some\s+formulas?\s+to\s+solve\s+for\s+(?:the\s+)?mass\b/.test(lower);
}

function asksForForce(lower) {
  return /\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(?:force|net force|f)\b/.test(lower) ||
    /\bforce\s+for\b/.test(lower) ||
    /\bwhat\s+force\b/.test(lower) ||
    /\bhow\s+much\s+force\b/.test(lower);
}

function findAllNumbersWithUnits(text, unitDefs) {
  const unitPattern = unitDefs
    .flatMap((def) => [...def.names, def.canonical])
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join('|');

  const regex = new RegExp(`(${NUMBER_PATTERN})\\s*(${unitPattern})${unitEndBoundary()}`, 'gi');
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
    value: Number(String(value).replace(/,/g, '')),
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
    findNumberOrArticleWithUnit,
    findQuantity,
    hasVelocityChangeCue,
    massToGrams,
    massToKg,
    mask,
    plural,
    quantityFromRawUnit,
    targetFromQuestion,
    unitEndBoundary,
    unitPatternFor,
    velocityToMS,
    volumeToML
  };
}


module.exports = { tryScienceFormula };
