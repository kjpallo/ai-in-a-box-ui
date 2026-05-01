function tryAccelerationFromVelocity(text, lower, ctx) {
  const looksLikeAcceleration =
    asksForAcceleration(lower) ||
    /\b(initial velocity|starting velocity|start velocity|final velocity|ending velocity|end velocity|velocity|vf|vi)\b/.test(lower) ||
    hasVelocityChangeCue(lower);

  if (!looksLikeAcceleration) return null;

  const velocityChange = findAccelerationVelocityChange(text, lower, ctx);

  const vi = (velocityChange && velocityChange.vi) ||
    ctx.findQuantity(text, ['initial velocity', 'starting velocity', 'start velocity', 'vi'], ctx.VELOCITY_UNITS, null);

  const vf = (velocityChange && velocityChange.vf) ||
    ctx.findQuantity(text, ['final velocity', 'ending velocity', 'end velocity', 'vf'], ctx.VELOCITY_UNITS, null);

  const acceleration = findAccelerationQuantity(text, ctx) ||
    ctx.findQuantity(text, ['acceleration', 'a'], ctx.ACCEL_UNITS, null);

  const time = (velocityChange && velocityChange.time) ||
    ctx.findQuantity(text, ['time', 't'], ctx.TIME_UNITS, null);

  const target = accelerationTarget(lower, { acceleration, vi, vf, time });

  if (target === 'acceleration' && vi && vf && time && time.value !== 0) {
    const viMS = ctx.velocityToMS(vi);
    const vfMS = ctx.velocityToMS(vf);
    const tS = ctx.convertTime(time.value, time.unit, 's');

    if (viMS == null || vfMS == null || tS == null || tS === 0) return null;

    const value = (vfMS - viMS) / tS;

    return ctx.answer('Recognized acceleration problem: solving from final velocity, initial velocity, and time.', [
      'Use the acceleration formula: a = (vf - vi) / t.',
      `a = (${ctx.cleanNumber(vfMS)} m/s - ${ctx.cleanNumber(viMS)} m/s) / ${ctx.cleanNumber(tS)} s`,
      `a = ${ctx.cleanNumber(value)} m/s²`
    ]);
  }

  if (target === 'final velocity' && vi && acceleration && time) {
    const calculation = finalVelocityCalculation(vi, acceleration, time, ctx);

    if (!calculation) return null;

    return ctx.answer('Recognized acceleration problem: solving for final velocity.', [
      'Use the formula: vf = vi + a × t.',
      `vf = ${ctx.cleanNumber(calculation.initial)} ${calculation.velocityUnit} + ${ctx.cleanNumber(acceleration.value)} ${displayUnit(acceleration.unit)} × ${ctx.cleanNumber(calculation.time)} ${calculation.timeUnit}`,
      `vf = ${ctx.cleanNumber(calculation.initial)} ${calculation.velocityUnit} + ${ctx.cleanNumber(calculation.delta)} ${calculation.velocityUnit}`,
      `vf = ${ctx.cleanNumber(calculation.value)} ${calculation.velocityUnit}`
    ]);
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

function findAccelerationVelocityChange(text, lower, ctx) {
  const speeds = ctx.findAllNumbersWithUnits(text, ctx.VELOCITY_UNITS);
  const times = ctx.findAllNumbersWithUnits(text, ctx.TIME_UNITS);
  const time = times.length ? times[times.length - 1] : null;

  if (/\b(from rest|at rest|starts?\s+from\s+rest|started\s+from\s+rest|begins?\s+from\s+rest)\b/.test(lower) && speeds.length >= 1) {
    return {
      vi: ctx.quantityFromRawUnit('0', speeds[0].unit, ctx.VELOCITY_UNITS),
      vf: speeds[0],
      time
    };
  }

  if (speeds.length >= 2 && time && hasVelocityChangeCue(lower)) {
    return {
      vi: speeds[0],
      vf: speeds[1],
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
    /\b(moving|traveling|travelling|going|running|jogging|walking|sprinting)\s+at\b/.test(lower) ||
    /\b(speed(?:s|ing)? up|sped up|slow(?:s|ing)? down|slowed down)\b/.test(lower) ||
    /\b(reach|reaches|reached|gets? to|got to)\b/.test(lower) ||
    /\bfrom\b[\s\S]{0,80}\bto\b/.test(lower)
  );
}

function accelerationTarget(lower, values) {
  if (questionTargetRegex(`(?:${accelerationWordPattern()}|a)`).test(lower)) return 'acceleration';
  if (questionTargetRegex('final velocity|ending velocity|end velocity|vf').test(lower)) return 'final velocity';
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

function accelerationWordPattern() {
  return 'acceleration|accelerashun|acelerashun|aceleration';
}

function questionTargetRegex(targetPattern) {
  return new RegExp(`\\b(?:what is|what's|find|calculate|solve for|determine)\\s+(?:(?:my|the)\\s+)?(?:[a-z0-9-]+(?:['’]s)?\\s+)?(?:${targetPattern})\\b`);
}

function displayUnit(unit) {
  if (unit === 'm/s^2') return 'm/s²';
  if (unit === 'ft/s^2') return 'ft/s²';
  return unit;
}

module.exports = {
  asksForAcceleration,
  findAccelerationQuantity,
  findAccelerationVelocityChange,
  hasVelocityChangeCue,
  tryAccelerationFromDistanceTimeRuns,
  tryAccelerationFromVelocity
};
