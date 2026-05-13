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
const { buildFormulaWork } = require('./formulaWorkBuilder');

// ---------------- Work, Power, Time: P = W / t ----------------
function tryWorkPowerTime(text, lower) {
  if (!/\b(work|energy|joule|joules|power|watt|watts|time|force|distance)\b|\bp\s*=|\bw\s*=|\bt\s*=/.test(lower)) return null;

  if (asksToSolveWorkDistanceForForce(lower)) {
    return answer('Recognized work formula question: solving for force.', [
      'Start with the work formula: W = F × d.',
      'To solve for force, divide both sides by distance.',
      'F = W / d.'
    ]);
  }

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
    const formulaWork = buildWorkForceFormulaWork({
      solveFor: 'work',
      workValue: value,
      forceValue: force.value,
      distanceValue: meters
    });

    return answer('Recognized work problem: solving from force and distance.', [
      'Use the work formula: W = force × distance.',
      `W = ${cleanNumber(force.value)} N × ${cleanNumber(meters)} m`,
      `W = ${cleanNumber(value)} J`
    ], formulaWork);
  }

  if (target === 'distance' && work && force && force.value !== 0) {
    const value = work.value / force.value;
    const formulaWork = buildWorkForceFormulaWork({
      solveFor: 'distance',
      workValue: work.value,
      forceValue: force.value,
      distanceValue: value
    });

    return answer('Recognized work problem: solving for distance from work and force.', [
      'Use the work formula: distance = work / force.',
      `distance = ${cleanNumber(work.value)} J / ${cleanNumber(force.value)} N`,
      `distance = ${cleanNumber(value)} m`
    ], formulaWork);
  }

  if (target === 'force' && work && distance) {
    const meters = convertDistance(distance.value, distance.unit, 'm');
    if (meters == null || meters === 0) return null;

    const value = work.value / meters;
    const formulaWork = buildWorkForceFormulaWork({
      solveFor: 'force',
      workValue: work.value,
      forceValue: value,
      distanceValue: meters
    });

    return answer('Recognized work problem: solving for force from work and distance.', [
      'Use the work formula: W = F × d.',
      'Rearrange to solve for force: F = W / d.',
      `F = ${cleanNumber(work.value)} J / ${cleanNumber(meters)} m`,
      `F = ${cleanNumber(value)} N`
    ], formulaWork);
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
    const formulaWork = buildWorkPowerFormulaWork({
      solveFor: 'power',
      workValue: work.value,
      powerValue: value,
      timeValue: seconds
    });
    return answer('Recognized work, power, and time problem: solving for power.', [
      'Use the power formula: P = W / t.',
      `P = ${cleanNumber(work.value)} J / ${cleanNumber(seconds)} s`,
      `P = ${cleanNumber(value)} W`
    ], formulaWork);
  }

  if (target === 'work' && power && time) {
    const seconds = convertTime(time.value, time.unit, 's');
    if (seconds == null) return null;
    const value = power.value * seconds;
    const formulaWork = buildWorkPowerFormulaWork({
      solveFor: 'work',
      workValue: value,
      powerValue: power.value,
      timeValue: seconds
    });
    return answer('Recognized work, power, and time problem: solving for work.', [
      'Use the power formula: W = P × t.',
      `W = ${cleanNumber(power.value)} W × ${cleanNumber(seconds)} s`,
      `W = ${cleanNumber(value)} J`
    ], formulaWork);
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
  if (questionTargetRegex('force|f').test(lower) || /\bhow much force\b/.test(lower)) return 'force';
  if (/\bhow much work\b/.test(lower)) return 'work';
  if (questionTargetRegex('distance|d').test(lower) || /\bhow far\b/.test(lower)) return 'distance';
  if (questionTargetRegex('time|t').test(lower) || /\bhow long\b/.test(lower)) return 'time';

  if (values.force && values.distance && !values.work) return 'work';
  if (values.work && values.time && !values.power) return 'power';
  if (values.power && values.time && !values.work) return 'work';
  if (values.work && values.force && !values.distance) return 'distance';
  if (values.work && values.distance && !values.force) return 'force';
  if (values.work && values.power && !values.time) return 'time';
  return null;
}

function buildWorkForceFormulaWork({ solveFor, workValue, forceValue, distanceValue }) {
  const workDisplay = `${cleanNumber(workValue)} J`;
  const forceDisplay = `${cleanNumber(forceValue)} N`;
  const distanceDisplay = `${cleanNumber(distanceValue)} m`;
  const finalAnswerByTarget = {
    work: { value: workValue, unit: 'J', display: workDisplay },
    distance: { value: distanceValue, unit: 'm', display: distanceDisplay },
    force: { value: forceValue, unit: 'N', display: forceDisplay }
  };
  const formulaByTarget = {
    work: 'W = F × d',
    distance: 'd = W / F',
    force: 'F = W / d'
  };
  const calculationByTarget = {
    work: {
      prompt: `Now substitute: W = ${cleanNumber(forceValue)} × ${cleanNumber(distanceValue)}. What is ${cleanNumber(forceValue)} × ${cleanNumber(distanceValue)}?`,
      hint: 'Multiply force by distance.'
    },
    distance: {
      prompt: `Now substitute: d = ${cleanNumber(workValue)} / ${cleanNumber(forceValue)}. What is ${cleanNumber(workValue)} / ${cleanNumber(forceValue)}?`,
      hint: 'Divide work by force.'
    },
    force: {
      prompt: `Now substitute: F = ${cleanNumber(workValue)} / ${cleanNumber(distanceValue)}. What is ${cleanNumber(workValue)} / ${cleanNumber(distanceValue)}?`,
      hint: 'Divide work by distance.'
    }
  };
  const finalAnswer = finalAnswerByTarget[solveFor];
  const calculation = calculationByTarget[solveFor];

  return buildFormulaWork({
    formulaId: 'work_force_distance',
    family: 'work',
    solveFor,
    formula: formulaByTarget[solveFor],
    finalAnswer,
    choices: ['work', 'distance', 'force'],
    formulaDistractors: ['PE = m × g × h', 'P = W / t'],
    variables: [
      { key: 'work', symbol: 'W', value: workValue, unit: 'J', display: workDisplay },
      { key: 'force', symbol: 'F', value: forceValue, unit: 'N', display: forceDisplay },
      { key: 'distance', symbol: 'd', value: distanceValue, unit: 'm', display: distanceDisplay }
    ],
    calculation: {
      prompt: calculation.prompt,
      expectedValue: finalAnswer.value,
      hints: [calculation.hint]
    }
  });
}

function buildWorkPowerFormulaWork({ solveFor, workValue, powerValue, timeValue }) {
  const workDisplay = `${cleanNumber(workValue)} J`;
  const powerDisplay = `${cleanNumber(powerValue)} W`;
  const timeDisplay = `${cleanNumber(timeValue)} s`;
  const finalAnswer = solveFor === 'power'
    ? { value: powerValue, unit: 'W', display: powerDisplay }
    : { value: workValue, unit: 'J', display: workDisplay };

  return buildFormulaWork({
    formulaId: 'work_power_time',
    family: 'power',
    solveFor,
    formula: solveFor === 'power' ? 'P = W / t' : 'W = P × t',
    finalAnswer,
    choices: ['power', 'work', 'time'],
    formulaDistractors: ['W = F × d', 'V = I × R'],
    variables: [
      { key: 'work', symbol: 'W', value: workValue, unit: 'J', display: workDisplay },
      { key: 'power', symbol: 'P', value: powerValue, unit: 'W', display: powerDisplay },
      { key: 'time', symbol: 't', value: timeValue, unit: 's', display: timeDisplay }
    ],
    calculation: {
      prompt: solveFor === 'power'
        ? `Now substitute: P = ${cleanNumber(workValue)} / ${cleanNumber(timeValue)}. What is ${cleanNumber(workValue)} / ${cleanNumber(timeValue)}?`
        : `Now substitute: W = ${cleanNumber(powerValue)} × ${cleanNumber(timeValue)}. What is ${cleanNumber(powerValue)} × ${cleanNumber(timeValue)}?`,
      expectedValue: finalAnswer.value,
      hints: [solveFor === 'power' ? 'Divide work by time.' : 'Multiply power by time.']
    }
  });
}

function asksForWorkFromForceDistance(lower) {
  return /\bhow much work\b/.test(lower) ||
    /\b(work|joules?|energy)\b/.test(questionPortion(lower));
}

function asksToSolveWorkDistanceForForce(lower) {
  return /\b(?:solve|rearrange|rearranged)\b/.test(lower) &&
    /\b(?:force|f)\b/.test(lower) &&
    /\bw\s*=\s*f\s*\/?\s*d\b|\bw\s*=\s*f\s*(?:×|\*|x)?\s*d\b/.test(lower.replace(/\s+/g, ' '));
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
