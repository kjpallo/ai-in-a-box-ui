const {
  DISTANCE_UNITS,
  ENERGY_UNITS,
  FORCE_UNITS,
  POWER_UNITS,
  TIME_UNITS,
  convertDistance,
  convertTime,
  findNumberWithUnit,
  findQuantity,
  questionTargetRegex,
  unitPatternFor
} = require('./formulaParser');
const { answer, cleanNumber } = require('./formulaAnswerFormatter');

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

module.exports = { tryWorkPowerTime };
