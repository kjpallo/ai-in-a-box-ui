function tryForceFromVelocityChange(text, lower, ctx) {
  if (!ctx.asksForForce(lower)) return null;

  const velocityChange = ctx.findAccelerationVelocityChange(text, lower);
  if (!velocityChange || !velocityChange.vi || !velocityChange.vf || !velocityChange.time) return null;

  const mass = ctx.findQuantity(text, ['mass', 'm'], ctx.MASS_UNITS, null);
  const adjustedMass = findAdjustedMass(text, mass, ctx);
  const massForForce = adjustedMass ? adjustedMass.quantity : mass;
  if (!massForForce) return null;

  const viMS = ctx.velocityToMS(velocityChange.vi);
  const vfMS = ctx.velocityToMS(velocityChange.vf);
  const tS = ctx.convertTime(velocityChange.time.value, velocityChange.time.unit, 's');
  const m = ctx.massToKg(massForForce);

  if (viMS == null || vfMS == null || tS == null || tS === 0 || m === 0) return null;

  const acceleration = (vfMS - viMS) / tS;
  const force = m * acceleration;

  return ctx.answer('Recognized multi-step force problem: solving acceleration first, then force.', [
    'First find acceleration.',
    'Use the acceleration formula: a = (vf - vi) / t.',
    `a = (${ctx.cleanNumber(vfMS)} m/s - ${ctx.cleanNumber(viMS)} m/s) / ${ctx.cleanNumber(tS)} s`,
    `a = ${ctx.cleanNumber(acceleration)} m/s²`,
    ...massAdjustmentLines(adjustedMass, ctx),
    'Then use Newton’s second law: F = m × a.',
    `F = ${ctx.cleanNumber(m)} kg × ${ctx.cleanNumber(acceleration)} m/s²`,
    `F = ${ctx.cleanNumber(force)} N`
  ]);
}

function tryForce(text, lower, ctx) {
  if (!(/\b(force|net force|newton|newtons|newton's second law)\b|\bf\s*=/.test(lower) || (/\bmass\b/.test(lower) && /\bacceleration\b/.test(lower)))) return null;
  if (asksForMotionTarget(lower)) return null;

  const force = ctx.findQuantity(text, ['net force', 'force', 'f'], ctx.FORCE_UNITS, null);
  const mass = ctx.findQuantity(text, ['mass', 'm'], ctx.MASS_UNITS, null);
  const adjustedMass = findAdjustedMass(text, mass, ctx);
  const massForForce = adjustedMass ? adjustedMass.quantity : mass;
  const acceleration = ctx.findAccelerationQuantity(text) ||
    ctx.findQuantity(text, ['acceleration', 'a'], ctx.ACCEL_UNITS, null);
  const target = forceTarget(lower, { force, mass: massForForce, acceleration }, ctx);

  if (target === 'force' && massForForce && acceleration) {
    const m = ctx.massToKg(massForForce);
    const value = m * acceleration.value;
    return ctx.answer('Recognized Newton’s second law problem: solving for force.', [
      ...massAdjustmentLines(adjustedMass, ctx),
      'Use Newton’s second law: F = m × a.',
      `F = ${ctx.cleanNumber(m)} kg × ${ctx.cleanNumber(acceleration.value)} m/s²`,
      `F = ${ctx.cleanNumber(value)} N`
    ]);
  }

  if (target === 'mass' && force && acceleration && acceleration.value !== 0) {
    const value = force.value / acceleration.value;
    return ctx.answer('Recognized Newton’s second law problem: solving for mass.', [
      'Use Newton’s second law: mass = force / acceleration.',
      `m = ${ctx.cleanNumber(force.value)} N / ${ctx.cleanNumber(acceleration.value)} m/s²`,
      `m = ${ctx.cleanNumber(value)} kg`
    ]);
  }

  if (target === 'acceleration' && force && massForForce) {
    const m = ctx.massToKg(massForForce);
    if (m === 0) return null;
    const value = force.value / m;
    return ctx.answer('Recognized Newton’s second law problem: solving for acceleration.', [
      ...massAdjustmentLines(adjustedMass, ctx),
      'Use Newton’s second law: acceleration = force / mass.',
      `a = ${ctx.cleanNumber(force.value)} N / ${ctx.cleanNumber(m)} kg`,
      `a = ${ctx.cleanNumber(value)} m/s²`
    ]);
  }

  return null;
}

function findAdjustedMass(text, baseMass, ctx) {
  if (!baseMass) return null;

  const changes = findMassChanges(text, ctx);
  if (!changes.length) return null;

  const baseKg = ctx.massToKg(baseMass);
  const removedKg = changes
    .filter((change) => change.operation === 'remove')
    .reduce((total, change) => total + ctx.massToKg(change.quantity), 0);
  const addedKg = changes
    .filter((change) => change.operation === 'add')
    .reduce((total, change) => total + ctx.massToKg(change.quantity), 0);
  const netChangeKg = addedKg - removedKg;
  const adjustedKg = baseKg + netChangeKg;

  if (!Number.isFinite(adjustedKg) || adjustedKg <= 0) return null;

  return {
    operation: netChangeKg < 0 ? 'remove' : 'add',
    baseKg,
    removedKg,
    addedKg,
    netChangeKg,
    adjustedKg,
    changes,
    quantity: {
      value: adjustedKg,
      unit: 'kg',
      distanceUnit: null,
      perTimeUnit: null,
      start: baseMass.start,
      end: changes[changes.length - 1].quantity.end
    }
  };
}

function findMassChanges(text, ctx) {
  const unitPattern = ctx.MASS_UNITS
    .flatMap((def) => [...def.names, def.canonical])
    .map(ctx.escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join('|');
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const unit = `(${unitPattern})`;
  const removeVerb = '(?:removes?|removed|unloads?|unloaded|offloads?|offloaded|dumps?\\s+out|dumped\\s+out|empt(?:y|ies)\\s+out|emptied\\s+out|take(?:s)?\\s+away|took\\s+away|take(?:s)?\\s+off|took\\s+off|subtract(?:s|ed)?|loses?|lost|decreases?\\s+by|decreased\\s+by)';
  const addVerb = '(?:adds?|added|puts?\\s+in|put\\s+in|gains?|gained|increases?\\s+by|increased\\s+by)';

  const changes = [];
  const seen = new Set();

  function addChange(operation, quantity) {
    const key = `${operation}:${quantity.start}:${quantity.end}:${quantity.value}:${quantity.unit}`;
    if (seen.has(key)) return;
    seen.add(key);
    changes.push({ operation, quantity });
  }

  function collectMasses(operation, segment, segmentStart) {
    const regex = new RegExp(`${number}\\s*${unit}\\b`, 'gi');
    for (const match of segment.matchAll(regex)) {
      const quantity = ctx.quantityFromRawUnit(match[1], match[2], ctx.MASS_UNITS);
      quantity.start = segmentStart + match.index;
      quantity.end = quantity.start + match[0].length;
      addChange(operation, quantity);
    }
  }

  function collectAfterVerb(operation, verbPattern) {
    const regex = new RegExp(`\\b${verbPattern}\\b([\\s\\S]{0,140}?)(?:[.!?]|$)`, 'gi');
    for (const match of text.matchAll(regex)) {
      collectMasses(operation, match[1], match.index + match[0].indexOf(match[1]));
    }
  }

  collectAfterVerb('remove', removeVerb);
  collectAfterVerb('add', addVerb);

  let match = new RegExp(`\\b${removeVerb}\\s+${number}\\s*${unit}\\b`, 'i').exec(text);
  if (match) {
    const quantity = ctx.quantityFromRawUnit(match[1], match[2], ctx.MASS_UNITS);
    quantity.start = match.index + match[0].indexOf(match[1]);
    quantity.end = match.index + match[0].length;
    addChange('remove', quantity);
  }

  match = new RegExp(`\\b(?:take(?:s)?|took)\\s+${number}\\s*${unit}\\b[\\s\\S]{0,50}\\boff\\b`, 'i').exec(text);
  if (match) {
    const quantity = ctx.quantityFromRawUnit(match[1], match[2], ctx.MASS_UNITS);
    quantity.start = match.index + match[0].indexOf(match[1]);
    quantity.end = quantity.start + `${match[1]} ${match[2]}`.length;
    addChange('remove', quantity);
  }

  match = new RegExp(`\\b${number}\\s*${unit}\\b[\\s\\S]{0,50}\\b(?:is|are|was|were)?\\s*(?:removed|unloaded|offloaded|dumped\\s+out|emptied\\s+out|taken\\s+away|taken\\s+off|subtracted|lost)\\b`, 'i').exec(text);
  if (match) {
    const quantity = ctx.quantityFromRawUnit(match[1], match[2], ctx.MASS_UNITS);
    quantity.start = match.index;
    quantity.end = quantity.start + `${match[1]} ${match[2]}`.length;
    addChange('remove', quantity);
  }

  match = new RegExp(`\\b${addVerb}\\s+${number}\\s*${unit}\\b`, 'i').exec(text);
  if (match) {
    const quantity = ctx.quantityFromRawUnit(match[1], match[2], ctx.MASS_UNITS);
    quantity.start = match.index + match[0].indexOf(match[1]);
    quantity.end = match.index + match[0].length;
    addChange('add', quantity);
  }

  match = new RegExp(`\\b${number}\\s*${unit}\\b[\\s\\S]{0,50}\\b(?:is|are|was|were)?\\s*(?:added|put\\s+in|gained)\\b`, 'i').exec(text);
  if (match) {
    const quantity = ctx.quantityFromRawUnit(match[1], match[2], ctx.MASS_UNITS);
    quantity.start = match.index;
    quantity.end = match.index + match[0].length;
    addChange('add', quantity);
  }

  return changes.sort((a, b) => a.quantity.start - b.quantity.start);
}

function massAdjustmentLines(adjustedMass, ctx) {
  if (!adjustedMass) return [];

  const lines = [];

  if (adjustedMass.removedKg > 0 && adjustedMass.changes.filter((change) => change.operation === 'remove').length > 1) {
    const removedParts = adjustedMass.changes
      .filter((change) => change.operation === 'remove')
      .map((change) => `${ctx.cleanNumber(ctx.massToKg(change.quantity))} kg`);
    lines.push('First find the total mass removed.');
    lines.push(`mass removed = ${removedParts.join(' + ')}`);
    lines.push(`mass removed = ${ctx.cleanNumber(adjustedMass.removedKg)} kg`);
  }

  if (adjustedMass.addedKg > 0 && adjustedMass.changes.filter((change) => change.operation === 'add').length > 1) {
    const addedParts = adjustedMass.changes
      .filter((change) => change.operation === 'add')
      .map((change) => `${ctx.cleanNumber(ctx.massToKg(change.quantity))} kg`);
    lines.push('First find the total mass added.');
    lines.push(`mass added = ${addedParts.join(' + ')}`);
    lines.push(`mass added = ${ctx.cleanNumber(adjustedMass.addedKg)} kg`);
  }

  const sign = adjustedMass.netChangeKg < 0 ? '-' : '+';
  const changeKg = Math.abs(adjustedMass.netChangeKg);

  lines.push(
    'Find the new mass.',
    `mass = ${ctx.cleanNumber(adjustedMass.baseKg)} kg ${sign} ${ctx.cleanNumber(changeKg)} kg`,
    `mass = ${ctx.cleanNumber(adjustedMass.adjustedKg)} kg`
  );

  return lines;
}

function forceTarget(lower, values, ctx) {
  if (ctx.asksForForce(lower)) return 'force';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(mass|m)\b/.test(lower)) return 'mass';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(acceleration|a)\b/.test(lower)) return 'acceleration';

  if (values.mass && values.acceleration && !values.force) return 'force';
  if (values.force && values.acceleration && !values.mass) return 'mass';
  if (values.force && values.mass && !values.acceleration) return 'acceleration';
  return null;
}

function asksForMotionTarget(lower) {
  return /\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?spe+ed\b/.test(lower) ||
    /\bhow fast\b/.test(lower) ||
    /\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?velocity\b/.test(lower) ||
    /\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?time\b/.test(lower) ||
    /\bhow long\b/.test(lower) ||
    /\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?distance\b/.test(lower) ||
    /\bhow far\b/.test(lower);
}

module.exports = { tryForce, tryForceFromVelocityChange };
