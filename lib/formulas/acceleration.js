const { buildFormulaWork } = require('./formulaWorkBuilder');

function tryAccelerationFromVelocity(text, lower, ctx) {
  if (asksForDistanceFromSpeedAndTime(lower)) return null;

  const looksLikeAcceleration =
    asksForAcceleration(lower) ||
    /\b(initial velocity|starting velocity|start velocity|final velocity|ending velocity|end velocity|velocity|vf|vi)\b/.test(lower) ||
    hasVelocityChangeCue(lower);

  if (!looksLikeAcceleration) return null;

  const velocityChange = findAccelerationVelocityChange(text, lower, ctx);
  const explicitVi = findExplicitVelocity(text, ['initial velocity', 'starting velocity', 'start velocity', 'initial speed', 'starting speed', 'start speed', 'vi'], ctx);
  const explicitVf = findExplicitVelocity(text, ['final velocity', 'final speed', 'ending velocity', 'end velocity', 'vf'], ctx);

  const acceleration = findAccelerationQuantity(text, ctx) ||
    ctx.findQuantity(text, ['acceleration', 'a'], ctx.ACCEL_UNITS, null);

  const vi = explicitVi || (velocityChange && velocityChange.vi);

  const vf = explicitVf || (velocityChange && velocityChange.vf) ||
    (hasFinalRestPhrase(lower) ? zeroVelocityQuantity(vi || firstVelocityQuantity(text, ctx) || null, acceleration, ctx) : null);

  const time = (velocityChange && velocityChange.time) ||
    ctx.findQuantity(text, ['time', 't'], ctx.TIME_UNITS, null);

  const viForCalculation = vi || (hasInitialRestPhrase(lower)
    ? zeroVelocityQuantity(vf || firstVelocityQuantity(text, ctx) || null, acceleration, ctx)
    : null);

  const target = accelerationTarget(lower, { acceleration, vi: viForCalculation, vf, time });

  if (target === 'acceleration' && viForCalculation && vf && time && time.value !== 0) {
    const calculation = accelerationCalculation(viForCalculation, vf, time, lower, ctx);

    if (!calculation) return null;
    const formulaWork = buildAccelerationFormulaWork({
      solveFor: 'acceleration',
      initialVelocityValue: calculation.initialVelocity,
      finalVelocityValue: calculation.finalVelocity,
      timeValue: calculation.time,
      accelerationValue: calculation.value,
      velocityUnit: calculation.velocityUnit,
      accelerationUnit: calculation.accelerationUnit,
      timeUnit: calculation.timeUnit,
      ctx
    });
    const lines = [
      'Use the acceleration formula: a = (vf - vi) / t.',
      ...calculation.conversionLines,
      `a = (${ctx.cleanNumber(calculation.finalVelocity)} ${calculation.velocityUnit} - ${ctx.cleanNumber(calculation.initialVelocity)} ${calculation.velocityUnit}) / ${calculation.timeDisplay} ${calculation.timeUnit}`,
      `a = ${formatAccelerationAnswer(calculation.value, calculation.accelerationUnit, ctx, calculation.isApproximate)}`
    ];

    if (calculation.siValue != null) {
      lines.push(`In SI units, a = ${formatAccelerationAnswer(calculation.siValue, 'm/s²', ctx)}`);
    }

    return ctx.answer('Recognized acceleration problem: solving from final velocity, initial velocity, and time.', [
      ...lines
    ], formulaWork);
  }

  if (target === 'final velocity' && viForCalculation && acceleration && time) {
    const calculation = finalVelocityCalculation(viForCalculation, acceleration, time, ctx);

    if (!calculation) return null;

    const formulaWork = buildAccelerationFormulaWork({
      solveFor: 'final velocity',
      initialVelocityValue: calculation.initial,
      finalVelocityValue: calculation.value,
      timeValue: calculation.time,
      accelerationValue: acceleration.value,
      velocityUnit: calculation.velocityUnit,
      accelerationUnit: displayUnit(acceleration.unit),
      timeUnit: calculation.timeUnit,
      ctx
    });

    return ctx.answer('Recognized acceleration problem: solving for final velocity.', [
      'Use the formula: vf = vi + a × t.',
      `vf = ${ctx.cleanNumber(calculation.initial)} ${calculation.velocityUnit} + ${ctx.cleanNumber(acceleration.value)} ${displayUnit(acceleration.unit)} × ${ctx.cleanNumber(calculation.time)} ${calculation.timeUnit}`,
      `vf = ${ctx.cleanNumber(calculation.initial)} ${calculation.velocityUnit} + ${ctx.cleanNumber(calculation.delta)} ${calculation.velocityUnit}`,
      `vf = ${ctx.cleanNumber(calculation.value)} ${calculation.velocityUnit}`
    ], formulaWork);
  }

  if (target === 'initial velocity' && vf && acceleration && time) {
    const vfMS = ctx.velocityToMS(vf);
    const tS = ctx.convertTime(time.value, time.unit, 's');

    if (vfMS == null || tS == null) return null;

    const value = vfMS - acceleration.value * tS;

    return ctx.answer('Recognized acceleration problem: solving for initial velocity.', [
      'Use the formula: vi = vf - a × t.',
      `vi = ${ctx.cleanNumber(vfMS)} m/s - ${ctx.cleanNumber(acceleration.value)} m/s² × ${ctx.cleanNumber(tS)} s`,
      `vi = ${ctx.cleanNumber(value)} m/s`
    ]);
  }

  if (target === 'time' && vi && vf && acceleration && acceleration.value !== 0) {
    const viMS = ctx.velocityToMS(vi);
    const vfMS = ctx.velocityToMS(vf);

    if (viMS == null || vfMS == null) return null;

    const value = (vfMS - viMS) / acceleration.value;

    return ctx.answer('Recognized acceleration problem: solving for time.', [
      'Use the formula: time = (vf - vi) / acceleration.',
      `t = (${ctx.cleanNumber(vfMS)} m/s - ${ctx.cleanNumber(viMS)} m/s) / ${ctx.cleanNumber(acceleration.value)} m/s²`,
      `t = ${ctx.cleanNumber(value)} s`
    ]);
  }

  return null;
}

function tryAccelerationFromDistanceTimeRuns(text, lower, ctx) {
  if (!asksForAcceleration(lower)) return null;

  const pairs = findDistanceTimePairs(text, ctx);
  if (pairs.length < 2) return null;

  const accelerationTime = findAccelerationTransitionTime(text, pairs, ctx);
  if (!accelerationTime) return null;

  const first = velocityFromDistanceTimePair(pairs[0], ctx);
  const second = velocityFromDistanceTimePair(pairs[1], ctx);
  const t = ctx.convertTime(accelerationTime.value, accelerationTime.unit, 's');

  if (!first || !second || t == null || t === 0) return null;

  const acceleration = (second.velocity - first.velocity) / t;

  return ctx.answer('Recognized multi-step acceleration problem: solving two velocities first, then acceleration.', [
    'First find the starting velocity.',
    'Use the motion formula: speed = distance / time.',
    `starting velocity = ${ctx.cleanNumber(first.distance)} m / ${ctx.cleanNumber(first.time)} s`,
    `starting velocity = ${ctx.cleanNumber(first.velocity)} m/s`,
    'Find the final velocity.',
    `final velocity = ${ctx.cleanNumber(second.distance)} m / ${ctx.cleanNumber(second.time)} s`,
    `final velocity = ${ctx.cleanNumber(second.velocity)} m/s`,
    'Use the acceleration formula: a = (vf - vi) / t.',
    `a = (${ctx.cleanNumber(second.velocity)} m/s - ${ctx.cleanNumber(first.velocity)} m/s) / ${ctx.cleanNumber(t)} s`,
    `a = ${ctx.cleanNumber(acceleration)} m/s²`
  ]);
}

function findDistanceTimePairs(text, ctx) {
  const distanceUnitPattern = ctx.unitPatternFor(ctx.DISTANCE_UNITS);
  const timeUnitPattern = ctx.unitPatternFor(ctx.TIME_UNITS);
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`\\b(?:travels?|traveled|travelled|goes?|went|moves?|moved|covers?|covered|rides?|rode|drives?|drove|runs?|ran|rolls?|rolled)\\b[\\s\\S]{0,80}?${number}\\s*(${distanceUnitPattern})\\b[\\s\\S]{0,60}?\\b(?:in|over|during|for)\\s+${number}\\s*(${timeUnitPattern})\\b`, 'gi'),
    new RegExp(`${number}\\s*(${distanceUnitPattern})\\b[\\s\\S]{0,45}?\\b(?:in|over|during|for)\\s+${number}\\s*(${timeUnitPattern})\\b`, 'gi')
  ];
  const pairs = [];
  const seen = new Set();

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const distanceStart = match.index + match[0].indexOf(match[1]);
      const timeStart = match.index + match[0].lastIndexOf(match[3]);
      const key = `${distanceStart}:${timeStart}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const distance = ctx.quantityFromRawUnit(match[1], match[2], ctx.DISTANCE_UNITS);
      const time = ctx.quantityFromRawUnit(match[3], match[4], ctx.TIME_UNITS);
      distance.start = distanceStart;
      distance.end = distance.start + `${match[1]} ${match[2]}`.length;
      time.start = timeStart;
      time.end = time.start + `${match[3]} ${match[4]}`.length;
      pairs.push({ distance, time });
    }
  }

  return pairs.sort((a, b) => a.distance.start - b.distance.start);
}

function findAccelerationTransitionTime(text, pairs, ctx) {
  const timeUnitPattern = ctx.unitPatternFor(ctx.TIME_UNITS);
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const cueAfterTime = new RegExp(`\\b(?:took|takes|take|for|over|in|during|after)\\s+${number}\\s*(${timeUnitPattern})\\b[^.!?]{0,100}?\\b(?:speed\\s+up|sped\\s+up|accelerat|from\\s+the\\s+first\\s+velocity|to\\s+the\\s+second\\s+velocity)`, 'i');
  const cueBeforeTime = new RegExp(`\\b(?:accelerat|from\\s+the\\s+first\\s+velocity|to\\s+the\\s+second\\s+velocity)[^.!?]{0,100}?\\b(?:in|over|during|for|after)\\s+${number}\\s*(${timeUnitPattern})\\b`, 'i');

  let match = cueAfterTime.exec(text);
  if (!match) match = cueBeforeTime.exec(text);

  if (match) {
    const quantity = ctx.quantityFromRawUnit(match[1], match[2], ctx.TIME_UNITS);
    quantity.start = match.index + match[0].indexOf(match[1]);
    quantity.end = quantity.start + `${match[1]} ${match[2]}`.length;
    return quantity;
  }

  const usedTimeStarts = new Set(pairs.map((pair) => pair.time.start));
  const times = ctx.findAllNumbersWithUnits(text, ctx.TIME_UNITS)
    .filter((time) => !usedTimeStarts.has(time.start));

  return times.length ? times[times.length - 1] : null;
}

function velocityFromDistanceTimePair(pair, ctx) {
  const distance = ctx.convertDistance(pair.distance.value, pair.distance.unit, 'm');
  const time = ctx.convertTime(pair.time.value, pair.time.unit, 's');
  if (distance == null || time == null || time === 0) return null;

  return {
    distance,
    time,
    velocity: distance / time
  };
}

function findAccelerationQuantity(text, ctx) {
  const accelUnitPattern = ctx.unitPatternFor(ctx.ACCEL_UNITS);
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`\\b(?:accelerates?|accelerated|accelerating)\\s+(?:at|by)?\\s*${number}\\s*(${accelUnitPattern})(?=$|[^A-Za-z0-9/²^])`, 'i'),
    new RegExp(`\\b(?:acceleration|a)\\s*(?:is|=|:|of|at|as|equals?)?\\s*${number}\\s*(${accelUnitPattern})(?=$|[^A-Za-z0-9/²^])`, 'i')
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;

    const quantity = ctx.quantityFromRawUnit(match[1], match[2], ctx.ACCEL_UNITS);
    quantity.start = match.index + match[0].indexOf(match[1]);
    quantity.end = quantity.start + `${match[1]} ${match[2]}`.length;
    return quantity;
  }

  return null;
}

function finalVelocityCalculation(vi, acceleration, time, ctx) {
  const velocityDistanceUnit = vi.distanceUnit;
  const velocityTimeUnit = vi.perTimeUnit;
  const accelerationDistanceUnit = acceleration.distanceUnit;
  const accelerationTimeUnit = acceleration.perTimeUnit;

  if (!velocityDistanceUnit || !velocityTimeUnit || !accelerationDistanceUnit || !accelerationTimeUnit) return null;

  const timeInAccelerationUnit = ctx.convertTime(time.value, time.unit, accelerationTimeUnit);
  if (timeInAccelerationUnit == null) return null;

  const deltaInAccelerationVelocityUnit = acceleration.value * timeInAccelerationUnit;
  const deltaInVelocityDistanceUnit = ctx.convertDistance(deltaInAccelerationVelocityUnit, accelerationDistanceUnit, velocityDistanceUnit);
  if (deltaInVelocityDistanceUnit == null) return null;

  const rateScale = ctx.convertTime(1, velocityTimeUnit, accelerationTimeUnit);
  if (rateScale == null) return null;

  const delta = deltaInVelocityDistanceUnit * rateScale;

  return {
    initial: vi.value,
    delta,
    value: vi.value + delta,
    velocityUnit: vi.unit,
    time: timeInAccelerationUnit,
    timeUnit: accelerationTimeUnit
  };
}

function accelerationCalculation(vi, vf, time, lower, ctx) {
  const policy = accelerationUnitPolicy(vi, vf, time, lower, ctx);
  if (!policy) return null;

  const initialVelocity = convertVelocityToDisplayUnit(vi, policy.velocityUnit, ctx);
  const finalVelocity = convertVelocityToDisplayUnit(vf, policy.velocityUnit, ctx);
  const convertedTime = ctx.convertTime(time.value, time.unit, policy.timeUnit);
  if (initialVelocity == null || finalVelocity == null || convertedTime == null || convertedTime === 0) return null;

  const value = (finalVelocity - initialVelocity) / convertedTime;
  const siValue = policy.includeSI ? accelerationInSI(vi, vf, time, ctx) : null;

  return {
    initialVelocity,
    finalVelocity,
    time: convertedTime,
    timeDisplay: policy.timeDisplay || ctx.cleanNumber(convertedTime),
    value,
    velocityUnit: policy.velocityUnit,
    timeUnit: policy.timeUnit,
    accelerationUnit: policy.accelerationUnit,
    conversionLines: policy.conversionLines,
    isApproximate: policy.isApproximate,
    siValue
  };
}

function accelerationUnitPolicy(vi, vf, time, lower, ctx) {
  const explicitSI = asksForSIAcceleration(lower);
  const wantsBoth = asksForBothAccelerationUnits(lower);
  const worksheet = worksheetAccelerationPolicy(vi, vf, time, lower, ctx);

  if (wantsBoth && worksheet) {
    return { ...worksheet, includeSI: true };
  }

  if (!explicitSI && worksheet) return worksheet;

  const tS = ctx.convertTime(time.value, time.unit, 's');
  if (tS == null || tS === 0) return null;
  return {
    velocityUnit: 'm/s',
    timeUnit: 's',
    accelerationUnit: 'm/s²',
    conversionLines: [],
    includeSI: false
  };
}

function worksheetAccelerationPolicy(vi, vf, time, lower, ctx) {
  if (!vi.unit || vi.unit !== vf.unit || !vi.perTimeUnit) return null;

  if (time.unit === vi.perTimeUnit) {
    return {
      velocityUnit: vi.unit,
      timeUnit: time.unit,
      accelerationUnit: accelerationUnitFor(vi.unit, time.unit),
      conversionLines: []
    };
  }

  if (vi.perTimeUnit === 'hr' && time.unit === 's' && asksToConvertSecondsToHours(lower)) {
    const hours = ctx.convertTime(time.value, time.unit, 'hr');
    if (hours == null) return null;
    return {
      velocityUnit: vi.unit,
      timeUnit: 'hr',
      accelerationUnit: accelerationUnitFor(vi.unit, 'hr'),
      timeDisplay: displaySmallTimeConversion(hours, ctx),
      conversionLines: [`Convert: ${ctx.cleanNumber(time.value)} s = ${displaySmallTimeConversion(hours, ctx)} hr`],
      isApproximate: true
    };
  }

  return null;
}

function convertVelocityToDisplayUnit(velocity, displayUnit, ctx) {
  if (velocity.unit === displayUnit) return velocity.value;
  const sourceTimeUnit = velocity.perTimeUnit;
  const targetDef = ctx.VELOCITY_UNITS.find((unit) => unit.canonical === displayUnit);
  if (!sourceTimeUnit || !targetDef?.distanceUnit || !targetDef.perTimeUnit) return null;

  const distancePerSourceTime = ctx.convertDistance(velocity.value, velocity.distanceUnit, targetDef.distanceUnit);
  const sourceTimeInTargetTime = ctx.convertTime(1, sourceTimeUnit, targetDef.perTimeUnit);
  if (distancePerSourceTime == null || sourceTimeInTargetTime == null) return null;

  return distancePerSourceTime / sourceTimeInTargetTime;
}

function accelerationInSI(vi, vf, time, ctx) {
  const viMS = ctx.velocityToMS(vi);
  const vfMS = ctx.velocityToMS(vf);
  const tS = ctx.convertTime(time.value, time.unit, 's');
  if (viMS == null || vfMS == null || tS == null || tS === 0) return null;
  return (vfMS - viMS) / tS;
}

function asksForSIAcceleration(lower) {
  return /\b(?:si units?|meters per second squared|meter per second squared)\b/.test(lower) ||
    /m\/s(?:\^?2|²)/.test(lower);
}

function asksForBothAccelerationUnits(lower) {
  return /\b(?:both units?|both worksheet and si|worksheet units? and si|si units? and worksheet)\b/.test(lower);
}

function asksToConvertSecondsToHours(lower) {
  return /\b(?:convert(?:ing)?(?:\s+seconds?)?\s+to\s+(?:hours?|hrs?|hr)|in\s+(?:hours?|hrs?|hr))\b/.test(lower);
}

function accelerationUnitFor(velocityUnit, timeUnit) {
  if (velocityUnit === 'm/s' && timeUnit === 's') return 'm/s²';
  if (velocityUnit === 'ft/s' && timeUnit === 's') return 'ft/s²';
  if (velocityUnit.endsWith(`/${timeUnit}`)) return `${velocityUnit}²`;
  return `${velocityUnit}/${timeUnit}`;
}

function formatAccelerationAnswer(value, unit, ctx, forceApproximate = false) {
  const display = cleanAccelerationNumber(value);
  const rounded = Math.abs(Number(display) - value) > 1e-10;
  return `${forceApproximate || rounded ? 'about ' : ''}${display} ${unit}`;
}

function cleanAccelerationNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  const decimals = Math.abs(value) < 0.01 ? 4 : 2;
  return String(Number(value.toFixed(decimals))).replace(/\.0+$/, '');
}

function displaySmallTimeConversion(value, ctx) {
  if (Math.abs(value) < 0.01) {
    return String(Number(value.toFixed(5))).replace(/\.0+$/, '');
  }
  return ctx.cleanNumber(value);
}

function findAccelerationVelocityChange(text, lower, ctx) {
  const speeds = ctx.findAllNumbersWithUnits(text, ctx.VELOCITY_UNITS);
  const times = ctx.findAllNumbersWithUnits(text, ctx.TIME_UNITS);
  const time = times.length ? times[times.length - 1] : null;

  if (speeds.length >= 2 && time && hasVelocityChangeCue(lower)) {
    return {
      vi: speeds[0],
      vf: speeds[1],
      time
    };
  }

  if (hasInitialRestPhrase(lower) && speeds.length >= 1) {
    return {
      vi: ctx.quantityFromRawUnit('0', speeds[0].unit, ctx.VELOCITY_UNITS),
      vf: speeds[0],
      time
    };
  }

  if (hasFinalRestPhrase(lower) && speeds.length >= 1) {
    return {
      vi: speeds[0],
      vf: ctx.quantityFromRawUnit('0', speeds[0].unit, ctx.VELOCITY_UNITS),
      time
    };
  }

  return findVelocityChangeFromTo(text, ctx);
}

function hasVelocityChangeCue(lower) {
  return (
    asksForAcceleration(lower) ||
    /\b(initial velocity|starting velocity|start velocity|final velocity|ending velocity|end velocity|velocity|vf|vi)\b/.test(lower) ||
    /\b(starts?|started|begins?|began|from rest|at rest)\b/.test(lower) ||
    hasFinalRestPhrase(lower) ||
    /\b(moving|traveling|travelling|going|running|jogging|walking|sprinting)\s+at\b/.test(lower) ||
    /\b(speed(?:s|ing)? up|sped up|slow(?:s|ing)? down|slowed down)\b/.test(lower) ||
    /\b(reach|reaches|reached|gets? to|got to)\b/.test(lower) ||
    /\bfrom\b[\s\S]{0,80}\bto\b/.test(lower)
  );
}

function accelerationTarget(lower, values) {
  if (questionTargetRegex(`(?:${accelerationWordPattern()}|a)`).test(lower)) return 'acceleration';
  if (questionTargetRegex('final velocity|final speed|ending velocity|end velocity|vf').test(lower) || asksForFinalVelocity(lower)) return 'final velocity';
  if (questionTargetRegex('initial velocity|starting velocity|start velocity|vi').test(lower)) return 'initial velocity';
  if (questionTargetRegex('time|t').test(lower) || /\bhow long\b/.test(lower)) return 'time';

  if (values.vi && values.vf && values.time && !values.acceleration) return 'acceleration';
  if (values.vi && values.acceleration && values.time && !values.vf) return 'final velocity';
  if (values.vf && values.acceleration && values.time && !values.vi) return 'initial velocity';
  if (values.vi && values.vf && values.acceleration && !values.time) return 'time';
  return null;
}

function findVelocityChangeFromTo(text, ctx) {
  const number = '-?\\d+(?:\\.\\d+)?';

  const speedUnitPattern = [
    'meters per second',
    'meter per second',
    'm/s',
    'miles per hour',
    'mile per hour',
    'mph',
    'kilometers per hour',
    'kilometer per hour',
    'km/hr',
    'km/h',
    'feet per second',
    'foot per second',
    'ft/s'
  ].map(ctx.escapeRegex).sort((a, b) => b.length - a.length).join('|');

  const timeUnitPattern = [
    'seconds',
    'second',
    'secs',
    'sec',
    's',
    'minutes',
    'minute',
    'mins',
    'min',
    'hours',
    'hour',
    'hrs',
    'hr'
  ].map(ctx.escapeRegex).sort((a, b) => b.length - a.length).join('|');

  const pattern = new RegExp(
    `\\bfrom\\s+(${number})\\s*(${speedUnitPattern})\\s+to\\s+(${number})\\s*(${speedUnitPattern})(?:\\s+(?:in|over|during|for|after)\\s+(${number})\\s*(${timeUnitPattern}))?`,
    'i'
  );

  const match = pattern.exec(text);
  if (!match) return null;

  return {
    vi: ctx.quantityFromRawUnit(match[1], match[2], ctx.VELOCITY_UNITS),
    vf: ctx.quantityFromRawUnit(match[3], match[4], ctx.VELOCITY_UNITS),
    time: match[5] ? ctx.quantityFromRawUnit(match[5], match[6], ctx.TIME_UNITS) : null
  };
}

function asksForAcceleration(lower) {
  return new RegExp(`\\b(?:${accelerationWordPattern()}|accelerate|accelerates|accelerated|accelerating)\\b`).test(lower);
}

function hasInitialRestPhrase(lower) {
  return /\b(?:from rest|starting from rest|starts from rest|started from rest|initially at rest|begins at rest|began at rest)\b/.test(lower);
}

function hasFinalRestPhrase(lower) {
  return /\b(?:comes to a stop|come to a stop|came to a stop|comes to rest|come to rest|came to rest|stops|stopped|stopping|land and park|lands and parks|landed and parked|able to land and park|park|parked)\b/.test(lower);
}

function asksForFinalVelocity(lower) {
  return /\b(?:what speed will (?:it|he|she|they|the [a-z0-9-]+) reach|what velocity will (?:it|he|she|they|the [a-z0-9-]+) reach|what speed does (?:it|he|she|they|the [a-z0-9-]+) reach|what velocity does (?:it|he|she|they|the [a-z0-9-]+) reach|how fast will (?:it|he|she|they|the [a-z0-9-]+) be going|what will (?:its|his|her|their|the [a-z0-9-]+['’]s) speed be|what will (?:its|his|her|their|the [a-z0-9-]+['’]s) final velocity be)\b/.test(lower);
}

function asksForDistanceFromSpeedAndTime(lower) {
  return /\bhow far(?:\s+apart)?\b/.test(lower) ||
    /\bhow much\s+ground\b/.test(lower) ||
    /\bwhat\s+(?:is\s+)?(?:the\s+)?distance\b/.test(lower);
}

function accelerationWordPattern() {
  return 'acceleration|accelerashun|acelerashun|aceleration|accretion';
}

function questionTargetRegex(targetPattern) {
  return new RegExp(`\\b(?:what is|what's|find|calculate|solve for|determine)\\s+(?:(?:my|the)\\s+)?(?:[a-z0-9-]+(?:['’]s)?\\s+)?(?:${targetPattern})\\b`);
}

function displayUnit(unit) {
  if (unit === 'm/s^2') return 'm/s²';
  if (unit === 'ft/s^2') return 'ft/s²';
  return unit;
}

function firstVelocityQuantity(text, ctx) {
  const speeds = ctx.findAllNumbersWithUnits(text, ctx.VELOCITY_UNITS);
  return speeds.length ? speeds[0] : null;
}

function zeroVelocityQuantity(referenceVelocity, acceleration, ctx) {
  if (referenceVelocity && referenceVelocity.unit) {
    return ctx.quantityFromRawUnit('0', referenceVelocity.unit, ctx.VELOCITY_UNITS);
  }

  const unit = acceleration && acceleration.distanceUnit && acceleration.perTimeUnit
    ? `${acceleration.distanceUnit}/${acceleration.perTimeUnit}`
    : 'm/s';

  return {
    value: 0,
    unit,
    distanceUnit: acceleration?.distanceUnit || 'm',
    perTimeUnit: acceleration?.perTimeUnit || 's',
    start: 0,
    end: 0
  };
}

function findExplicitVelocity(text, labels, ctx) {
  const naturalLabels = labels.filter((label) => label.length > 1);
  const symbolLabels = labels.filter((label) => label.length === 1);
  const unitPattern = ctx.unitPatternFor(ctx.VELOCITY_UNITS);
  const number = '-?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';

  if (naturalLabels.length) {
    const labelPattern = naturalLabels.map(ctx.escapeRegex).sort((a, b) => b.length - a.length).join('|');
    const before = new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:is|=|:|of|as|equals?)?\\s*(${number})\\s*(${unitPattern})(?=$|[^A-Za-z0-9/²^])`, 'i').exec(text);
    if (before) return ctx.quantityFromRawUnit(before[1], before[2], ctx.VELOCITY_UNITS);

    const after = new RegExp(`(${number})\\s*(${unitPattern})(?=$|[^A-Za-z0-9/²^])\\s*(?:of\\s+)?(?:${labelPattern})\\b`, 'i').exec(text);
    if (after) return ctx.quantityFromRawUnit(after[1], after[2], ctx.VELOCITY_UNITS);
  }

  if (symbolLabels.length) {
    const symbolPattern = symbolLabels.map(ctx.escapeRegex).join('|');
    const match = new RegExp(`\\b(?:${symbolPattern})\\b\\s*(?:=|:)\\s*(${number})\\s*(${unitPattern})(?=$|[^A-Za-z0-9/²^])`, 'i').exec(text);
    if (match) return ctx.quantityFromRawUnit(match[1], match[2], ctx.VELOCITY_UNITS);
  }

  return null;
}

function buildAccelerationFormulaWork({
  solveFor,
  initialVelocityValue,
  finalVelocityValue,
  timeValue,
  accelerationValue,
  velocityUnit = 'm/s',
  accelerationUnit = 'm/s²',
  timeUnit = 's',
  ctx
}) {
  const initialDisplay = `${ctx.cleanNumber(initialVelocityValue)} ${velocityUnit}`;
  const finalDisplay = `${ctx.cleanNumber(finalVelocityValue)} ${velocityUnit}`;
  const timeDisplay = `${ctx.cleanNumber(timeValue)} ${timeUnit}`;
  const accelerationDisplay = `${ctx.cleanNumber(accelerationValue)} ${accelerationUnit}`;
  const isAcceleration = solveFor === 'acceleration';
  const finalAnswer = isAcceleration
    ? { value: accelerationValue, unit: accelerationUnit, display: accelerationDisplay }
    : { value: finalVelocityValue, unit: velocityUnit, display: finalDisplay };
  const formula = isAcceleration ? 'a = (vf - vi) / t' : 'vf = vi + a × t';
  const calculationPrompt = isAcceleration
    ? `Now substitute: a = (${ctx.cleanNumber(finalVelocityValue)} - ${ctx.cleanNumber(initialVelocityValue)}) / ${ctx.cleanNumber(timeValue)}. What is (${ctx.cleanNumber(finalVelocityValue)} - ${ctx.cleanNumber(initialVelocityValue)}) / ${ctx.cleanNumber(timeValue)}?`
    : `Now substitute: vf = ${ctx.cleanNumber(initialVelocityValue)} + ${ctx.cleanNumber(accelerationValue)} × ${ctx.cleanNumber(timeValue)}. What is ${ctx.cleanNumber(initialVelocityValue)} + ${ctx.cleanNumber(accelerationValue)} × ${ctx.cleanNumber(timeValue)}?`;

  return buildFormulaWork({
    formulaId: 'acceleration_velocity_time',
    family: 'acceleration',
    solveFor,
    formula,
    finalAnswer,
    choices: ['acceleration', 'final velocity', 'initial velocity', 'time'],
    formulaDistractors: ['F = m × a', 'speed = distance / time'],
    variables: [
      {
        key: 'initial velocity',
        symbol: 'vi',
        value: initialVelocityValue,
        unit: velocityUnit,
        display: initialDisplay,
        hints: ['Look for the starting or initial velocity.']
      },
      {
        key: 'final velocity',
        symbol: 'vf',
        value: finalVelocityValue,
        unit: velocityUnit,
        display: finalDisplay,
        hints: ['Look for the ending or final velocity.']
      },
      {
        key: 'acceleration',
        symbol: 'a',
        value: accelerationValue,
        unit: accelerationUnit,
        display: accelerationDisplay,
        hints: ['Look for the acceleration value.']
      },
      {
        key: 'time',
        symbol: 't',
        value: timeValue,
        unit: timeUnit,
        display: timeDisplay,
        hints: ['Look for how long the change takes.']
      }
    ],
    calculation: {
      prompt: calculationPrompt,
      expectedValue: finalAnswer.value,
      hints: [isAcceleration ? 'Subtract initial velocity from final velocity, then divide by time.' : 'Multiply acceleration by time, then add the initial velocity.']
    }
  });
}

module.exports = {
  asksForAcceleration,
  findAccelerationQuantity,
  findAccelerationVelocityChange,
  hasVelocityChangeCue,
  tryAccelerationFromDistanceTimeRuns,
  tryAccelerationFromVelocity
};
