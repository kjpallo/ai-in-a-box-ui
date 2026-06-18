function tryMotion(text, lower, ctx) {
  if (/\b(final velocity|final speed|ending velocity|ending speed|end velocity|end speed|vf)\b/.test(lower)) return null;
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
  const time = ctx.findQuantity(masked, ['time'], ctx.TIME_UNITS, null) ||
    ctx.findNumberOrArticleWithUnit(masked, ctx.TIME_UNITS);
  const target = motionTarget(lower, { speed, distance, time });
  const answerKind = asksForVelocity(lower) ? 'velocity' : 'speed';
  const direction = answerKind === 'velocity' ? inferVelocityDirection(lower) : '';
  const requestedMetersPerSecond = asksForMetersPerSecond(lower);

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
    const lines = [
      'Use the motion formula: distance = speed × time.',
      ...conversionLines({
        original: time,
        convertedValue: timeInRateUnit,
        convertedUnit: speed.perTimeUnit,
        kind: 'time',
        ctx
      }),
      `distance = ${ctx.cleanNumber(speed.value)} ${speed.unit} × ${ctx.cleanNumber(timeInRateUnit)} ${speed.perTimeUnit}`,
      `distance = ${ctx.cleanNumber(value)} ${ctx.plural(speed.distanceUnit, value)}`
    ];
    return ctx.answer('Recognized motion problem: solving for distance using speed and time.', lines, formulaWork);
  }

  if (target === 'speed' && distance && time && time.value !== 0) {
    const value = distance.value / time.value;
    const primaryUnit = `${distance.unit}/${time.unit}`;
    const primaryDisplay = formatRateAnswer(value, primaryUnit, ctx, { compact: answerKind === 'velocity', final: true });
    const finalDisplay = withDirection(primaryDisplay, direction);
    const finalLineLabel = answerKind === 'velocity' ? 'velocity' : 'speed';
    const extraFinalAnswers = [];
    const extraLines = [];

    if (answerKind === 'velocity' && requestedMetersPerSecond && primaryUnit === 'mile/hr') {
      const metersPerSecond = value * 0.44704;
      const metersPerSecondDisplay = withDirection(`${formatApproxNumber(metersPerSecond, 2)} m/s`, direction);
      extraFinalAnswers.push({
        value: metersPerSecond,
        unit: 'm/s',
        display: metersPerSecondDisplay
      });
      extraLines.push(`Convert: ${ctx.cleanNumber(value)} mi/hr × 0.44704 = ${formatApproxNumber(metersPerSecond, 2)} m/s.`);
    }

    const formulaWork = buildMotionFormulaWork({
      solveFor: 'speed',
      distanceValue: distance.value,
      distanceUnit: distance.unit,
      timeValue: time.value,
      timeUnit: time.unit,
      speedValue: value,
      speedUnit: primaryUnit,
      answerKind,
      direction,
      finalDisplay,
      extraFinalAnswers,
      ctx
    });
    const lines = [
      `Use the motion formula: ${finalLineLabel} = distance / time.`,
      `${finalLineLabel} = ${ctx.cleanNumber(distance.value)} ${ctx.plural(distance.unit, distance.value)} / ${ctx.cleanNumber(time.value)} ${time.unit}`,
      ...extraLines,
      extraFinalAnswers.length > 0
        ? `${finalLineLabel} = ${finalDisplay} and about ${extraFinalAnswers[0].display}`
        : `${finalLineLabel} = ${formatMaybeApprox(value, finalDisplay)}`
    ];
    return ctx.answer(`Recognized motion problem: solving for ${finalLineLabel} using distance and time.`, lines, formulaWork);
  }

  if (target === 'time' && distance && speed && speed.value !== 0) {
    const distanceInRateUnit = ctx.convertDistance(distance.value, distance.unit, speed.distanceUnit);
    if (distanceInRateUnit == null) return null;
    const value = distanceInRateUnit / speed.value;
    const formulaWork = buildMotionFormulaWork({
      solveFor: 'time',
      distanceValue: distanceInRateUnit,
      distanceUnit: speed.distanceUnit,
      distanceOriginalValue: distance.value,
      distanceOriginalUnit: distance.unit,
      timeValue: value,
      timeUnit: speed.perTimeUnit,
      speedValue: speed.value,
      speedUnit: speed.unit,
      ctx
    });
    const lines = [
      'Use the motion formula: time = distance / speed.',
      ...conversionLines({
        original: distance,
        convertedValue: distanceInRateUnit,
        convertedUnit: speed.distanceUnit,
        kind: 'distance',
        ctx
      }),
      `time = ${ctx.cleanNumber(distanceInRateUnit)} ${ctx.plural(speed.distanceUnit, distanceInRateUnit)} / ${ctx.cleanNumber(speed.value)} ${speed.unit}`,
      `time = ${formatMaybeApprox(value, `${formatFinalNumber(value)} ${speed.perTimeUnit}`)}`
    ];
    return ctx.answer('Recognized motion problem: solving for time using distance and speed.', lines, formulaWork);
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
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?distance\b/.test(lower) ||
    /\bhow far(?:\s+apart)?\b/.test(lower) ||
    /\bhow much\s+ground\b/.test(lower) ||
    /\bhow many\s+(miles|kilometers|meters|feet)\b/.test(lower)) return 'distance';

  if (values.speed && values.time && !values.distance) return 'distance';
  if (values.distance && values.time && !values.speed) return 'speed';
  if (values.distance && values.speed && !values.time) return 'time';
  return null;
}

function buildMotionFormulaWork({
  solveFor,
  distanceValue,
  distanceUnit,
  distanceOriginalValue = distanceValue,
  distanceOriginalUnit = distanceUnit,
  timeValue,
  timeUnit,
  speedValue,
  speedUnit,
  answerKind = 'speed',
  direction = '',
  finalDisplay = '',
  extraFinalAnswers = [],
  ctx
}) {
  const distanceDisplay = `${ctx.cleanNumber(distanceValue)} ${ctx.plural(distanceUnit, distanceValue)}`;
  const distanceOriginalDisplay = `${ctx.cleanNumber(distanceOriginalValue)} ${ctx.plural(distanceOriginalUnit, distanceOriginalValue)}`;
  const timeDisplay = formatTimeAnswer(timeValue, timeUnit, ctx);
  const finalTimeDisplay = formatFinalTimeAnswer(timeValue, timeUnit, ctx);
  const speedDisplay = formatRateAnswer(speedValue, speedUnit, ctx, { compact: answerKind === 'velocity' });
  const directedSpeedDisplay = withDirection(speedDisplay, direction);
  const finalSpeedDisplay = finalDisplay || directedSpeedDisplay;
  const finalByTarget = {
    speed: {
      value: speedValue,
      unit: speedUnit,
      display: finalSpeedDisplay,
      alternates: extraFinalAnswers
    },
    time: { value: timeValue, unit: timeUnit, display: finalTimeDisplay },
    distance: { value: distanceValue, unit: distanceUnit, display: distanceDisplay }
  };
  const formulaByTarget = {
    speed: answerKind === 'velocity' ? 'velocity = distance / time' : 'speed = distance / time',
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
      ...buildMotionQuantitySteps({
        solveFor,
        distanceValue,
        distanceUnit,
        distanceDisplay,
        distanceOriginalValue,
        distanceOriginalUnit,
        distanceOriginalDisplay,
        timeValue,
        timeUnit,
        timeDisplay,
        speedValue,
        speedUnit,
        speedDisplay
      }),
      buildMotionCalculationStep({ solveFor, distanceValue, timeValue, speedValue, distanceDisplay, timeDisplay, speedDisplay: finalSpeedDisplay, ctx })
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
    acceptedAnswers: buildFormulaAliases(solveFor, formula),
    hints: [`This problem gives the values needed to solve for ${solveFor}.`]
  };
}

function buildFormulaAliases(solveFor, formula) {
  const aliases = [formula];
  if (solveFor === 'speed') aliases.push('s = d / t', 'v = d / t');
  if (solveFor === 'distance') aliases.push('d = s × t', 'd = v × t');
  if (solveFor === 'time') aliases.push('t = d / s', 't = d / v');
  return aliases;
}

function buildMotionQuantitySteps(values) {
  const steps = [];
  if (values.solveFor !== 'distance') {
    const distanceStep = {
      id: 'identify_distance',
      type: 'quantity',
      prompt: 'What number should go in for distance, d?',
      expectedValue: values.distanceValue,
      expectedUnit: values.distanceUnit,
      expectedDisplay: values.distanceDisplay,
      hints: [`Look for the number with ${values.distanceUnit}.`]
    };

    if (values.distanceOriginalUnit && values.distanceOriginalUnit !== values.distanceUnit) {
      distanceStep.originalValue = values.distanceOriginalValue;
      distanceStep.originalUnit = values.distanceOriginalUnit;
      distanceStep.originalDisplay = values.distanceOriginalDisplay;
      distanceStep.conversionDisplay = `${values.distanceOriginalDisplay} = ${values.distanceDisplay}`;
      distanceStep.conversionReminder = `Since speed is in ${values.speedUnit}, convert ${values.distanceOriginalDisplay} to ${values.distanceDisplay}.`;
    }

    steps.push(distanceStep);
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

function formatRateAnswer(value, unit, ctx, options = {}) {
  const number = options.final && isRoundedApproximation(value) ? formatApproxNumber(value, 2) : ctx.cleanNumber(value);
  if (unit === 'mile/hr') return options.compact ? `${number} mi/hr` : `${number} ${value === 1 ? 'mile' : 'miles'} per hour`;
  if (unit === 'km/hr') return options.compact ? `${number} km/hr` : `${number} km/h`;
  if (/^[A-Za-z]+\/[A-Za-z]+$/.test(unit)) {
    const [distanceUnit, timeUnit] = unit.split('/');
    const displayedDistanceUnit = distanceUnit === 'mile' && Math.abs(value) !== 1 ? 'miles' : distanceUnit;
    const displayedTimeUnit = timeUnit === 'hr' ? 'hour' : timeUnit;
    return `${number} ${displayedDistanceUnit}/${displayedTimeUnit}`;
  }
  return `${number} ${unit}`;
}

function conversionLines({ original, convertedValue, convertedUnit, kind, ctx }) {
  if (!original || original.unit === convertedUnit) return [];
  const convertedDisplay = kind === 'distance'
    ? `${ctx.cleanNumber(convertedValue)} ${ctx.plural(convertedUnit, convertedValue)}`
    : `${ctx.cleanNumber(convertedValue)} ${convertedUnit}`;
  const originalDisplay = kind === 'distance'
    ? `${ctx.cleanNumber(original.value)} ${ctx.plural(original.unit, original.value)}`
    : `${ctx.cleanNumber(original.value)} ${original.unit}`;
  return [`Convert: ${originalDisplay} = ${convertedDisplay}.`];
}

function asksForVelocity(lower) {
  return /\bvelocity\b/.test(lower);
}

function asksForMetersPerSecond(lower) {
  return /\bm\/s\b|\bmeters?\s+per\s+second\b|\bmetres?\s+per\s+second\b/.test(lower);
}

function inferVelocityDirection(lower) {
  const explicit = [
    'northwest',
    'northeast',
    'southwest',
    'southeast',
    'north',
    'south',
    'east',
    'west'
  ].find((direction) => new RegExp(`\\b${direction}\\b`).test(lower));
  if (explicit) return explicit;

  if (/\bnew york\b[\s\S]{0,80}\bcalifornia\b/.test(lower)) return 'west';
  if (/\bcalifornia\b[\s\S]{0,80}\bnew york\b/.test(lower)) return 'east';
  return '';
}

function withDirection(display, direction) {
  return direction ? `${display} ${direction}` : display;
}

function formatMaybeApprox(value, display) {
  return isRoundedApproximation(value) ? `about ${display}` : display;
}

function formatApproxNumber(value, digits = 2) {
  return String(Number(value.toFixed(digits))).replace(/\.0+$/, '');
}

function formatFinalNumber(value) {
  if (!isRoundedApproximation(value)) return String(Number(value.toFixed(4))).replace(/\.0+$/, '');
  return formatApproxNumber(value, 2);
}

function isRoundedApproximation(value) {
  return Number.isFinite(value) && !Number.isInteger(value) && Math.abs(value - Number(value.toFixed(4))) > 1e-12;
}

function formatTimeAnswer(value, unit, ctx) {
  const number = ctx.cleanNumber(value);
  if (unit === 'hr') return `${number} ${value === 1 ? 'hour' : 'hours'}`;
  if (unit === 'min') return `${number} ${value === 1 ? 'minute' : 'minutes'}`;
  if (unit === 's') return `${number} ${value === 1 ? 'second' : 'seconds'}`;
  return `${number} ${unit}`;
}

function formatFinalTimeAnswer(value, unit, ctx) {
  if (unit !== 's' || Number.isInteger(value)) return formatTimeAnswer(value, unit, ctx);
  return `${formatFinalNumber(value)} ${unit}`;
}

module.exports = { tryMotion };
