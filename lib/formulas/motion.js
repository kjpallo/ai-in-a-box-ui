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
    return ctx.answer('Recognized motion problem: solving for distance using speed and time.', [
      'Use the motion formula: distance = speed × time.',
      `distance = ${ctx.cleanNumber(speed.value)} ${speed.unit} × ${ctx.cleanNumber(timeInRateUnit)} ${speed.perTimeUnit}`,
      `distance = ${ctx.cleanNumber(value)} ${ctx.plural(speed.distanceUnit, value)}`
    ]);
  }

  if (target === 'speed' && distance && time && time.value !== 0) {
    const value = distance.value / time.value;
    const formulaWork = buildSpeedFormulaWork(distance.value, distance.unit, time.value, time.unit, value, ctx);
    return ctx.answer('Recognized motion problem: solving for speed using distance and time.', [
      'Use the motion formula: speed = distance / time.',
      `speed = ${ctx.cleanNumber(distance.value)} ${ctx.plural(distance.unit, distance.value)} / ${ctx.cleanNumber(time.value)} ${time.unit}`,
      `speed = ${ctx.cleanNumber(value)} ${distance.unit}/${time.unit}`
    ], formulaWork);
  }

  if (target === 'time' && distance && speed && speed.value !== 0) {
    const distanceInRateUnit = ctx.convertDistance(distance.value, distance.unit, speed.distanceUnit);
    if (distanceInRateUnit == null) return null;
    const value = distanceInRateUnit / speed.value;
    return ctx.answer('Recognized motion problem: solving for time using distance and speed.', [
      'Use the motion formula: time = distance / speed.',
      `time = ${ctx.cleanNumber(distanceInRateUnit)} ${ctx.plural(speed.distanceUnit, distanceInRateUnit)} / ${ctx.cleanNumber(speed.value)} ${speed.unit}`,
      `time = ${ctx.cleanNumber(value)} ${speed.perTimeUnit}`
    ]);
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

function buildSpeedFormulaWork(distanceValue, distanceUnit, timeValue, timeUnit, speedValue, ctx) {
  const speedUnit = `${distanceUnit}/${timeUnit}`;
  const distanceDisplay = `${ctx.cleanNumber(distanceValue)} ${distanceUnit}`;
  const timeDisplay = `${ctx.cleanNumber(timeValue)} ${timeUnit}`;
  const speedDisplay = `${ctx.cleanNumber(speedValue)} ${speedUnit}`;

  return {
    formulaId: 'speed_distance_time',
    family: 'motion',
    solveFor: 'speed',
    formula: 'speed = distance / time',
    finalAnswer: {
      value: speedValue,
      unit: speedUnit,
      display: speedDisplay
    },
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
      {
        id: 'choose_formula',
        type: 'multiple_choice',
        prompt: 'Which formula should we use?',
        choices: [
          { number: 1, label: 'speed = distance / time', correct: true },
          { number: 2, label: 'D = m / V', correct: false },
          { number: 3, label: 'F = m × a', correct: false }
        ],
        expected: 'speed = distance / time',
        hints: ['This problem gives distance and time.']
      },
      {
        id: 'identify_distance',
        type: 'quantity',
        prompt: 'What number should go in for distance, d?',
        expectedValue: distanceValue,
        expectedUnit: distanceUnit,
        expectedDisplay: distanceDisplay,
        hints: [`Look for the number with ${distanceUnit}.`]
      },
      {
        id: 'identify_time',
        type: 'quantity',
        prompt: 'What number should go in for time, t?',
        expectedValue: timeValue,
        expectedUnit: timeUnit,
        expectedDisplay: timeDisplay,
        hints: [`Look for the number with ${timeUnit}.`]
      },
      {
        id: 'calculate',
        type: 'calculation',
        prompt: `Now substitute: speed = ${ctx.cleanNumber(distanceValue)} / ${ctx.cleanNumber(timeValue)}. What is ${ctx.cleanNumber(distanceValue)} / ${ctx.cleanNumber(timeValue)}?`,
        expectedValue: speedValue,
        expectedUnit: speedUnit,
        expectedDisplay: speedDisplay,
        hints: ['Divide distance by time.']
      }
    ]
  };
}

module.exports = { tryMotion };
