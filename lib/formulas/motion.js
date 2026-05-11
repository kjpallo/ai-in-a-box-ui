function tryMotion(text, lower, ctx) {
  if (/\b(final velocity|ending velocity|end velocity|vf)\b/.test(lower)) return null;
  if (asksForPotentialEnergy(lower)) return null;

  if (
    ctx.asksForForce(lower) &&
    ctx.findQuantity(text, ['mass', 'm'], ctx.MASS_UNITS, null) &&
    (ctx.findAccelerationQuantity(text) || ctx.findQuantity(text, ['acceleration', 'a'], ctx.ACCEL_UNITS, null))
  ) {
    return null;
  }

  if (
    ctx.asksForAcceleration(lower) &&
    ctx.findAllNumbersWithUnits(text, ctx.DISTANCE_UNITS).length >= 2 &&
    ctx.findAllNumbersWithUnits(text, ctx.TIME_UNITS).length >= 2
  ) {
    return null;
  }

  if (
    ctx.hasVelocityChangeCue(lower) &&
    ctx.findAllNumbersWithUnits(text, ctx.VELOCITY_UNITS).length >= 2 &&
    ctx.findAllNumbersWithUnits(text, ctx.TIME_UNITS).length > 0
  ) {
    return null;
  }

  const speed = ctx.findNumberWithUnit(text, ctx.SPEED_UNITS);
  const masked = speed ? ctx.mask(text, speed.start, speed.end) : text;
  const distance = ctx.findQuantity(masked, ['distance'], ctx.DISTANCE_UNITS, null);
  const time = ctx.findQuantity(masked, ['time'], ctx.TIME_UNITS, null);
  const target = motionTarget(lower, { speed, distance, time });

  if (target === 'distance' && speed && time) {
    const timeInRateUnit = ctx.convertTime(time.value, time.unit, speed.perTimeUnit);
    if (timeInRateUnit == null) return null;
    const value = speed.value * timeInRateUnit;
    const formulaWork = buildMotionFormulaWork({
      solveFor: 'distance',
      distanceValue: value,
      distanceUnit: speed.distanceUnit,
      timeValue: timeInRateUnit,
      timeUnit: speed.perTimeUnit,
      speedValue: speed.value,
      speedUnit: speed.unit,
      ctx
    });
    return ctx.answer('Recognized motion problem: solving for distance using speed and time.', [
      'Use the motion formula: distance = speed × time.',
      `distance = ${ctx.cleanNumber(speed.value)} ${speed.unit} × ${ctx.cleanNumber(timeInRateUnit)} ${speed.perTimeUnit}`,
      `distance = ${ctx.cleanNumber(value)} ${ctx.plural(speed.distanceUnit, value)}`
    ], formulaWork);
  }

  if (target === 'speed' && distance && time && time.value !== 0) {
    const value = distance.value / time.value;
    const formulaWork = buildMotionFormulaWork({
      solveFor: 'speed',
      distanceValue: distance.value,
      distanceUnit: distance.unit,
      timeValue: time.value,
      timeUnit: time.unit,
      speedValue: value,
      speedUnit: `${distance.unit}/${time.unit}`,
      ctx
    });
    return ctx.answer('Recognized motion problem: solving for speed using distance and time.', [
      'Use the motion formula: speed = distance / time.',
      `speed = ${ctx.cleanNumber(distance.value)} ${ctx.plural(distance.unit, distance.value)} / ${ctx.cleanNumber(time.value)} ${time.unit}`,
      `speed = ${formatSpeedAnswer(value, `${distance.unit}/${time.unit}`, ctx)}`
    ], formulaWork);
  }

  if (target === 'time' && distance && speed && speed.value !== 0) {
    const distanceInRateUnit = ctx.convertDistance(distance.value, distance.unit, speed.distanceUnit);
    if (distanceInRateUnit == null) return null;
    const value = distanceInRateUnit / speed.value;
    const formulaWork = buildMotionFormulaWork({
      solveFor: 'time',
      distanceValue: distanceInRateUnit,
      distanceUnit: speed.distanceUnit,
      timeValue: value,
      timeUnit: speed.perTimeUnit,
      speedValue: speed.value,
      speedUnit: speed.unit,
      ctx
    });
    return ctx.answer('Recognized motion problem: solving for time using distance and speed.', [
      'Use the motion formula: time = distance / speed.',
      `time = ${ctx.cleanNumber(distanceInRateUnit)} ${ctx.plural(speed.distanceUnit, distanceInRateUnit)} / ${ctx.cleanNumber(speed.value)} ${speed.unit}`,
      `time = ${ctx.cleanNumber(value)} ${speed.perTimeUnit}`
    ], formulaWork);
  }

  return null;
}

function asksForPotentialEnergy(lower) {
  return /\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?(?:[a-z0-9-]+(?:['’]s)?\s+)?(?:potential energy|gravitational potential energy|pe|energy)\b/.test(lower);
}

function motionTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?spe+ed\b/.test(lower) || /\bhow fast\b/.test(lower)) return 'speed';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?velocity\b/.test(lower)) return 'speed';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?time\b/.test(lower) || /\bhow long\b/.test(lower)) return 'time';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?distance\b/.test(lower) || /\bhow far\b/.test(lower) || /\bhow many\s+(miles|kilometers|meters|feet)\b/.test(lower)) return 'distance';

  if (values.speed && values.time && !values.distance) return 'distance';
  if (values.distance && values.time && !values.speed) return 'speed';
  if (values.distance && values.speed && !values.time) return 'time';
  return null;
}

function buildMotionFormulaWork({ solveFor, distanceValue, distanceUnit, timeValue, timeUnit, speedValue, speedUnit, ctx }) {
  const distanceDisplay = `${ctx.cleanNumber(distanceValue)} ${distanceUnit}`;
  const timeDisplay = formatTimeAnswer(timeValue, timeUnit, ctx);
  const speedDisplay = formatSpeedAnswer(speedValue, speedUnit, ctx);
  const finalByTarget = {
    speed: { value: speedValue, unit: speedUnit, display: speedDisplay },
    time: { value: timeValue, unit: timeUnit, display: timeDisplay },
    distance: { value: distanceValue, unit: distanceUnit, display: distanceDisplay }
  };
  const formulaByTarget = {
    speed: 'speed = distance / time',
    time: 'time = distance / speed',
    distance: 'distance = speed × time'
  };

  return {
    formulaId: 'speed_distance_time',
    family: 'motion',
    solveFor,
    formula: formulaByTarget[solveFor],
    finalAnswer: finalByTarget[solveFor],
    variables: {
      distance: {
        symbol: 'd',
        value: distanceValue,
        unit: distanceUnit,
        display: distanceDisplay
      },
      time: {
        symbol: 't',
        value: timeValue,
        unit: timeUnit,
        display: timeDisplay
      },
      speed: {
        symbol: 'v',
        value: speedValue,
        unit: speedUnit,
        display: speedDisplay
      }
    },
    steps: [
      buildSolveTargetStep(solveFor, ['speed', 'distance', 'time']),
      buildFormulaChoiceStep(formulaByTarget[solveFor], solveFor),
      ...buildMotionQuantitySteps({ solveFor, distanceValue, distanceUnit, distanceDisplay, timeValue, timeUnit, timeDisplay, speedValue, speedUnit, speedDisplay }),
      buildMotionCalculationStep({ solveFor, distanceValue, timeValue, speedValue, distanceDisplay, timeDisplay, speedDisplay, ctx })
    ]
  };
}

function buildSolveTargetStep(solveFor, targets) {
  return {
    id: 'identify_solve_target',
    type: 'multiple_choice',
    prompt: 'What variable are we solving for?',
    choices: targets.map((target, index) => ({
      number: index + 1,
      label: target,
      correct: target === solveFor
    })),
    expected: solveFor,
    hints: [`The question asks for ${solveFor}.`]
  };
}

function buildFormulaChoiceStep(formula, solveFor) {
  return {
    id: 'choose_formula',
    type: 'multiple_choice',
    prompt: 'Which formula should we use?',
    choices: [
      { number: 1, label: formula, correct: true },
      { number: 2, label: 'D = m / V', correct: false },
      { number: 3, label: 'F = m × a', correct: false }
    ],
    expected: formula,
    hints: [`This problem gives the values needed to solve for ${solveFor}.`]
  };
}

function buildMotionQuantitySteps(values) {
  const steps = [];
  if (values.solveFor !== 'distance') {
    steps.push({
      id: 'identify_distance',
      type: 'quantity',
      prompt: 'What number should go in for distance, d?',
      expectedValue: values.distanceValue,
      expectedUnit: values.distanceUnit,
      expectedDisplay: values.distanceDisplay,
      hints: [`Look for the number with ${values.distanceUnit}.`]
    });
  }
  if (values.solveFor !== 'time') {
    steps.push({
      id: 'identify_time',
      type: 'quantity',
      prompt: 'What number should go in for time, t?',
      expectedValue: values.timeValue,
      expectedUnit: values.timeUnit,
      expectedDisplay: values.timeDisplay,
      hints: [`Look for the time value.`]
    });
  }
  if (values.solveFor !== 'speed') {
    steps.push({
      id: 'identify_speed',
      type: 'quantity',
      prompt: 'What number should go in for speed?',
      expectedValue: values.speedValue,
      expectedUnit: values.speedUnit,
      expectedDisplay: values.speedDisplay,
      hints: ['Look for the speed or rate value.']
    });
  }
  return steps;
}

function buildMotionCalculationStep({ solveFor, distanceValue, timeValue, speedValue, distanceDisplay, timeDisplay, speedDisplay, ctx }) {
  if (solveFor === 'distance') {
    return {
      id: 'calculate',
      type: 'calculation',
      prompt: `Now substitute: distance = ${ctx.cleanNumber(speedValue)} × ${ctx.cleanNumber(timeValue)}. What is ${ctx.cleanNumber(speedValue)} × ${ctx.cleanNumber(timeValue)}?`,
      expectedValue: distanceValue,
      expectedUnit: 'distance',
      expectedDisplay: distanceDisplay,
      hints: ['Multiply speed by time.']
    };
  }

  if (solveFor === 'time') {
    return {
      id: 'calculate',
      type: 'calculation',
      prompt: `Now substitute: time = ${ctx.cleanNumber(distanceValue)} / ${ctx.cleanNumber(speedValue)}. What is ${ctx.cleanNumber(distanceValue)} / ${ctx.cleanNumber(speedValue)}?`,
      expectedValue: timeValue,
      expectedUnit: 'time',
      expectedDisplay: timeDisplay,
      hints: ['Divide distance by speed.']
    };
  }

  return {
    id: 'calculate',
    type: 'calculation',
    prompt: `Now substitute: speed = ${ctx.cleanNumber(distanceValue)} / ${ctx.cleanNumber(timeValue)}. What is ${ctx.cleanNumber(distanceValue)} / ${ctx.cleanNumber(timeValue)}?`,
    expectedValue: speedValue,
    expectedUnit: 'speed',
    expectedDisplay: speedDisplay,
    hints: ['Divide distance by time.']
  };
}

function formatSpeedAnswer(value, unit, ctx) {
  const number = ctx.cleanNumber(value);
  if (unit === 'mile/hr') return `${number} ${value === 1 ? 'mile' : 'miles'} per hour`;
  if (unit === 'km/hr') return `${number} km/h`;
  return `${number} ${unit}`;
}

function formatTimeAnswer(value, unit, ctx) {
  const number = ctx.cleanNumber(value);
  if (unit === 'hr') return `${number} ${value === 1 ? 'hour' : 'hours'}`;
  if (unit === 'min') return `${number} ${value === 1 ? 'minute' : 'minutes'}`;
  if (unit === 's') return `${number} ${value === 1 ? 'second' : 'seconds'}`;
  return `${number} ${unit}`;
}

module.exports = { tryMotion };
