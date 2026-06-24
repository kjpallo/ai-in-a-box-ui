function tryForceAndFinalMomentumFromVelocityChange(text, lower, ctx) {
  if (!ctx.asksForForce(lower) || !/\b(?:final\s+momentum|momentum)\b/.test(lower)) return null;

  const solved = solveVelocityChangeForce(text, lower, ctx);
  if (!solved) return null;

  const finalMomentum = solved.massKg * solved.vfMS;
  const formulaWork = buildVelocityChangeForceFormulaWork({
    ...solved,
    force: solved.force,
    ctx,
    finalAnswer: {
      value: solved.force,
      unit: 'N',
      display: `${ctx.cleanNumber(solved.force)} N`
    },
    combinedFinalAnswer: {
      values: [
        { value: solved.force, unit: 'N' },
        { value: finalMomentum, unit: 'kg·m/s' }
      ],
      response: `Correct. Force = ${ctx.cleanNumber(solved.force)} N and final momentum = ${ctx.cleanNumber(finalMomentum)} kg·m/s.`
    }
  });
  formulaWork.formulaId = 'force_and_final_momentum';
  formulaWork.solveFor = 'force';
  formulaWork.finalAnswer = {
    value: solved.force,
    unit: 'N',
    display: `${ctx.cleanNumber(solved.force)} N`
  };
  formulaWork.secondaryAnswer = {
    solveFor: 'final momentum',
    value: finalMomentum,
    unit: 'kg·m/s',
    display: `${ctx.cleanNumber(finalMomentum)} kg·m/s`
  };
  formulaWork.finalExplanation = [
    `Force = ${ctx.cleanNumber(solved.force)} N.`,
    `Final momentum = ${ctx.cleanNumber(finalMomentum)} kg·m/s.`
  ].join('\n');

  return ctx.answer('Recognized multi-answer force and momentum problem.', [
    'First find acceleration.',
    'Use the acceleration formula: a = (vf - vi) / t.',
    `a = (${ctx.cleanNumber(solved.vfMS)} m/s - ${ctx.cleanNumber(solved.viMS)} m/s) / ${ctx.cleanNumber(solved.timeS)} s`,
    `a = ${ctx.cleanNumber(solved.acceleration)} m/s²`,
    ...massAdjustmentLines(solved.adjustedMass, ctx),
    'Then use Newton’s second law: F = m × a.',
    `F = ${ctx.cleanNumber(solved.massKg)} kg × ${ctx.cleanNumber(solved.acceleration)} m/s²`,
    `F = ${ctx.cleanNumber(solved.force)} N`,
    'Then find final momentum with the final speed.',
    'Use the momentum formula: p = m × v.',
    `p = ${ctx.cleanNumber(solved.massKg)} kg × ${ctx.cleanNumber(solved.vfMS)} m/s`,
    `p = ${ctx.cleanNumber(finalMomentum)} kg·m/s`
  ], formulaWork);
}

function tryForceFromVelocityChange(text, lower, ctx) {
  if (!ctx.asksForForce(lower)) return null;

  const solved = solveVelocityChangeForce(text, lower, ctx);
  if (!solved) return null;
  const formulaWork = buildVelocityChangeForceFormulaWork({
    ...solved,
    force: solved.force,
    ctx,
    finalAnswer: {
      value: solved.force,
      unit: 'N',
      display: `${ctx.cleanNumber(solved.force)} N`
    }
  });

  return ctx.answer('Recognized multi-step force problem: solving acceleration first, then force.', [
    'First find acceleration.',
    'Use the acceleration formula: a = (vf - vi) / t.',
    `a = (${ctx.cleanNumber(solved.vfMS)} m/s - ${ctx.cleanNumber(solved.viMS)} m/s) / ${ctx.cleanNumber(solved.timeS)} s`,
    `a = ${ctx.cleanNumber(solved.acceleration)} m/s²`,
    ...massAdjustmentLines(solved.adjustedMass, ctx),
    'Then use Newton’s second law: F = m × a.',
    `F = ${ctx.cleanNumber(solved.massKg)} kg × ${ctx.cleanNumber(solved.acceleration)} m/s²`,
    `F = ${ctx.cleanNumber(solved.force)} N`
  ], formulaWork);
}

function tryForce(text, lower, ctx) {
  if (!(/\b(force|net force|newton|newtons|newton's second law)\b|\bf\s*=/.test(lower) || (/\bmass\b/.test(lower) && /\b(?:acceleration|accelerashun|acelerashun|aceleration|accretion)\b/.test(lower)))) return null;
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
    const formulaWork = buildForceFormulaWork({
      solveFor: 'force',
      forceValue: value,
      massValue: m,
      accelerationValue: acceleration.value,
      ctx
    });
    return ctx.answer('Recognized Newton’s second law problem: solving for force.', [
      ...massAdjustmentLines(adjustedMass, ctx),
      'Use Newton’s second law: F = m × a.',
      ...assumedUnitLines({ mass: massForForce, acceleration }, 'force'),
      `F = ${ctx.cleanNumber(m)} kg × ${ctx.cleanNumber(acceleration.value)} m/s²`,
      `F = ${ctx.cleanNumber(value)} N`
    ], formulaWork);
  }

  if (target === 'mass' && force && acceleration && acceleration.value !== 0) {
    const value = force.value / acceleration.value;
    const formattedMass = formatMassAnswer(value, ctx);
    const formulaWork = buildForceFormulaWork({
      solveFor: 'mass',
      forceValue: force.value,
      massValue: value,
      accelerationValue: acceleration.value,
      ctx
    });
    return ctx.answer('Recognized Newton’s second law problem: solving for mass.', [
      'Use Newton’s second law: F = m × a.',
      'Solve for mass: m = F / a.',
      'Use Newton’s second law: mass = force / acceleration.',
      ...assumedUnitLines({ force, acceleration }, 'mass'),
      `m = ${ctx.cleanNumber(force.value)} N / ${ctx.cleanNumber(acceleration.value)} m/s²`,
      `m = ${formattedMass} kg`,
      `The mass is about ${formattedMass} kg.`
    ], formulaWork);
  }

  if (target === 'acceleration' && force && massForForce) {
    const m = ctx.massToKg(massForForce);
    if (m === 0) return null;
    const value = force.value / m;
    const formulaWork = buildForceFormulaWork({
      solveFor: 'acceleration',
      forceValue: force.value,
      massValue: m,
      accelerationValue: value,
      ctx
    });
    return ctx.answer('Recognized Newton’s second law problem: solving for acceleration.', [
      ...massAdjustmentLines(adjustedMass, ctx),
      'Use Newton’s second law: acceleration = force / mass.',
      ...assumedUnitLines({ force, mass: massForForce }, 'acceleration'),
      `a = ${ctx.cleanNumber(force.value)} N / ${ctx.cleanNumber(m)} kg`,
      `a = ${ctx.cleanNumber(value)} m/s²`,
      ...approxAnswerLine(value, 'acceleration', 'm/s²')
    ], formulaWork);
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

function solveVelocityChangeForce(text, lower, ctx) {
  const velocityChange = ctx.findAccelerationVelocityChange(text, lower) ||
    inferVelocityChangeFromOrderedSpeeds(text, ctx);
  if (!velocityChange || !velocityChange.vi || !velocityChange.vf || !velocityChange.time) return null;

  const mass = ctx.findQuantity(text, ['mass', 'm'], ctx.MASS_UNITS, null);
  const adjustedMass = findAdjustedMass(text, mass, ctx);
  const massForForce = adjustedMass ? adjustedMass.quantity : mass;
  if (!massForForce) return null;

  const viMS = ctx.velocityToMS(velocityChange.vi);
  const vfMS = ctx.velocityToMS(velocityChange.vf);
  const timeS = ctx.convertTime(velocityChange.time.value, velocityChange.time.unit, 's');
  const massKg = ctx.massToKg(massForForce);

  if (viMS == null || vfMS == null || timeS == null || timeS === 0 || massKg === 0) return null;

  const acceleration = (vfMS - viMS) / timeS;
  const force = massKg * acceleration;

  return {
    velocityChange,
    mass,
    adjustedMass,
    massForForce,
    viMS,
    vfMS,
    timeS,
    massKg,
    acceleration,
    force
  };
}

function inferVelocityChangeFromOrderedSpeeds(text, ctx) {
  const speeds = ctx.findAllNumbersWithUnits(text, ctx.VELOCITY_UNITS);
  const times = ctx.findAllNumbersWithUnits(text, ctx.TIME_UNITS);
  if (speeds.length < 2 || times.length < 1) return null;

  return {
    vi: speeds[0],
    vf: speeds[1],
    time: times[times.length - 1]
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

function assumedUnitLines(values, solveFor) {
  const missing = [];
  if (values.force && !values.force.unit) missing.push('force is in newtons (N)');
  if (values.mass && !values.mass.unit) missing.push('mass is in kilograms (kg)');
  if (values.acceleration && !values.acceleration.unit) missing.push('acceleration is in m/s²');

  if (!missing.length) return [];

  return [`Units were not included, so I am assuming ${joinAssumptions(missing)} to solve for ${solveFor}.`];
}

function joinAssumptions(items) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function approxAnswerLine(value, label, unit) {
  if (Number.isInteger(value)) return [];
  const rounded = Number(value.toFixed(2));
  if (rounded === Number(value.toFixed(4))) return [];
  return [`The ${label} is about ${String(rounded).replace(/\.0+$/, '')} ${unit}.`];
}

function formatMassAnswer(value, ctx) {
  if (Number.isInteger(value)) return ctx.cleanNumber(value);
  return String(Number(value.toFixed(2))).replace(/\.0+$/, '');
}

function buildForceFormulaWork({ solveFor, forceValue, massValue, accelerationValue, ctx, includeSteps = true }) {
  const massDisplay = `${ctx.cleanNumber(massValue)} kg`;
  const accelerationDisplay = `${ctx.cleanNumber(accelerationValue)} m/s²`;
  const forceDisplay = `${ctx.cleanNumber(forceValue)} N`;
  const isSolvingForce = solveFor === 'force';
  const isSolvingMass = solveFor === 'mass';
  const finalValue = isSolvingForce ? forceValue : isSolvingMass ? massValue : accelerationValue;
  const finalUnit = isSolvingForce ? 'N' : isSolvingMass ? 'kg' : 'm/s²';
  const finalDisplay = isSolvingForce ? forceDisplay : isSolvingMass ? massDisplay : accelerationDisplay;
  const formula = isSolvingForce ? 'F = m × a' : isSolvingMass ? 'm = F / a' : 'a = F / m';

  return {
    formulaId: 'force_mass_acceleration',
    family: 'force',
    solveFor,
    formula,
    finalAnswer: {
      value: finalValue,
      unit: finalUnit,
      display: finalDisplay
    },
    variables: {
      mass: {
        symbol: 'm',
        value: massValue,
        unit: 'kg',
        display: massDisplay
      },
      acceleration: {
        symbol: 'a',
        value: accelerationValue,
        unit: 'm/s²',
        display: accelerationDisplay
      },
      force: {
        symbol: 'F',
        value: forceValue,
        unit: 'N',
        display: forceDisplay
      }
    },
    steps: includeSteps ? [
      {
        id: 'identify_solve_target',
        type: 'multiple_choice',
        prompt: 'What variable are we solving for?',
        choices: [
          { number: 1, label: 'force', correct: solveFor === 'force' },
          { number: 2, label: 'acceleration', correct: solveFor === 'acceleration' },
          { number: 3, label: 'mass', correct: solveFor === 'mass' }
        ],
        expected: solveFor,
        hints: [`The question asks for ${solveFor}.`]
      },
      {
        id: 'choose_formula',
        type: 'multiple_choice',
        prompt: 'Which formula should we use?',
        choices: [
          { number: 1, label: formula, correct: true },
          { number: 2, label: 'D = m / V', correct: false },
          { number: 3, label: 'speed = distance / time', correct: false }
        ],
        expected: formula,
        hints: [`This problem gives the values needed to solve for ${solveFor}.`]
      },
      ...(isSolvingForce
        ? [
          {
            id: 'identify_mass',
            type: 'quantity',
            prompt: 'What number should go in for mass, m?',
            expectedValue: massValue,
            expectedUnit: 'kg',
            expectedDisplay: massDisplay,
            hints: ['Look for the number with kg.']
          },
          {
            id: 'identify_acceleration',
            type: 'quantity',
            prompt: 'What number should go in for acceleration, a?',
            expectedValue: accelerationValue,
            expectedUnit: 'm/s²',
            expectedDisplay: accelerationDisplay,
            hints: ['Look for m/s².']
          },
          {
            id: 'calculate',
            type: 'calculation',
            prompt: `Now substitute: F = ${ctx.cleanNumber(massValue)} × ${ctx.cleanNumber(accelerationValue)}. What is ${ctx.cleanNumber(massValue)} × ${ctx.cleanNumber(accelerationValue)}?`,
            expectedValue: forceValue,
            expectedUnit: 'N',
            expectedDisplay: forceDisplay,
            hints: ['Multiply mass by acceleration.']
          }
        ]
        : isSolvingMass
          ? [
            {
              id: 'identify_force',
              type: 'quantity',
              prompt: 'What number should go in for force, F?',
              expectedValue: forceValue,
              expectedUnit: 'N',
              expectedDisplay: forceDisplay,
              hints: ['Look for the number with N or newtons.']
            },
            {
              id: 'identify_acceleration',
              type: 'quantity',
              prompt: 'What number should go in for acceleration, a?',
              expectedValue: accelerationValue,
              expectedUnit: 'm/s²',
              expectedDisplay: accelerationDisplay,
              hints: ['Look for m/s².']
            },
            {
              id: 'calculate',
              type: 'calculation',
              prompt: `Now substitute: m = ${ctx.cleanNumber(forceValue)} / ${ctx.cleanNumber(accelerationValue)}. What is ${ctx.cleanNumber(forceValue)} / ${ctx.cleanNumber(accelerationValue)}?`,
              expectedValue: massValue,
              expectedUnit: 'kg',
              expectedDisplay: massDisplay,
              hints: ['Divide force by acceleration.']
            }
          ]
        : [
          {
            id: 'identify_force',
            type: 'quantity',
            prompt: 'What number should go in for force, F?',
            expectedValue: forceValue,
            expectedUnit: 'N',
            expectedDisplay: forceDisplay,
            hints: ['Look for the number with N or newtons.']
          },
          {
            id: 'identify_mass',
            type: 'quantity',
            prompt: 'What number should go in for mass, m?',
            expectedValue: massValue,
            expectedUnit: 'kg',
            expectedDisplay: massDisplay,
            hints: ['Look for the number with kg.']
          },
          {
            id: 'calculate',
            type: 'calculation',
            prompt: `Now substitute: a = ${ctx.cleanNumber(forceValue)} / ${ctx.cleanNumber(massValue)}. What is ${ctx.cleanNumber(forceValue)} / ${ctx.cleanNumber(massValue)}?`,
            expectedValue: accelerationValue,
            expectedUnit: 'm/s²',
            expectedDisplay: accelerationDisplay,
            hints: ['Divide force by mass.']
          }
        ])
    ] : []
  };
}

function buildVelocityChangeForceFormulaWork({
  viMS,
  vfMS,
  timeS,
  massKg,
  acceleration,
  force,
  ctx,
  finalAnswer,
  combinedFinalAnswer = null
}) {
  const forceDisplay = `${ctx.cleanNumber(force)} N`;
  const accelerationDisplay = `${ctx.cleanNumber(acceleration)} m/s²`;
  const massDisplay = `${ctx.cleanNumber(massKg)} kg`;
  const finalVelocityDisplay = `${ctx.cleanNumber(vfMS)} m/s`;
  const initialVelocityDisplay = `${ctx.cleanNumber(viMS)} m/s`;
  const timeDisplay = `${ctx.cleanNumber(timeS)} s`;
  const steps = [
    {
      id: 'identify_solve_target',
      type: 'multiple_choice',
      prompt: 'What variable are we solving for first?',
      choices: [
        { number: 1, label: 'force', correct: true },
        { number: 2, label: 'momentum', correct: false },
        { number: 3, label: 'distance', correct: false }
      ],
      expected: 'force',
      hints: ['The question asks what force changed the speed.']
    },
    {
      id: 'choose_acceleration_formula',
      type: 'multiple_choice',
      prompt: 'Which formula finds acceleration from a change in speed?',
      choices: [
        { number: 1, label: 'a = (vf - vi) / t', correct: true },
        { number: 2, label: 'p = m × v', correct: false },
        { number: 3, label: 'F = m × a', correct: false }
      ],
      expected: 'a = (vf - vi) / t',
      hints: ['Use final speed, initial speed, and time first.']
    },
    {
      id: 'identify_initial_velocity',
      type: 'quantity',
      prompt: 'What number should go in for initial speed, vi?',
      expectedValue: viMS,
      expectedUnit: 'm/s',
      expectedDisplay: initialVelocityDisplay,
      hints: ['Use the first speed in the problem.']
    },
    {
      id: 'identify_final_velocity',
      type: 'quantity',
      prompt: 'What number should go in for final speed, vf?',
      expectedValue: vfMS,
      expectedUnit: 'm/s',
      expectedDisplay: finalVelocityDisplay,
      hints: ['Use the speed after speeding up or slowing down.']
    },
    {
      id: 'identify_time',
      type: 'quantity',
      prompt: 'What time should go in for t?',
      expectedValue: timeS,
      expectedUnit: 's',
      expectedDisplay: timeDisplay,
      hints: ['Look for how many seconds the change took.']
    },
    {
      id: 'calculate_acceleration',
      type: 'calculation',
      prompt: `Now substitute: a = (${ctx.cleanNumber(vfMS)} - ${ctx.cleanNumber(viMS)}) / ${ctx.cleanNumber(timeS)}. What is the acceleration?`,
      calculationExpression: `(${ctx.cleanNumber(vfMS)} - ${ctx.cleanNumber(viMS)}) / ${ctx.cleanNumber(timeS)}`,
      expectedValue: acceleration,
      expectedUnit: 'm/s²',
      expectedDisplay: accelerationDisplay,
      hints: ['Subtract the initial speed from the final speed, then divide by time.']
    },
    {
      id: 'choose_force_formula',
      type: 'multiple_choice',
      prompt: 'Which formula uses mass and acceleration to find force?',
      choices: [
        { number: 1, label: 'F = m × a', correct: true },
        { number: 2, label: 'a = F / m', correct: false },
        { number: 3, label: 'speed = distance / time', correct: false }
      ],
      expected: 'F = m × a',
      hints: ['Newton’s second law finds force from mass and acceleration.']
    },
    {
      id: 'identify_mass',
      type: 'quantity',
      prompt: 'What number should go in for mass, m?',
      expectedValue: massKg,
      expectedUnit: 'kg',
      expectedDisplay: massDisplay,
      hints: ['Look for the number with kg.']
    },
    {
      id: 'calculate',
      type: 'calculation',
      prompt: `Now substitute: F = ${ctx.cleanNumber(massKg)} × ${ctx.cleanNumber(acceleration)}. What is ${ctx.cleanNumber(massKg)} × ${ctx.cleanNumber(acceleration)}?`,
      calculationExpression: `${ctx.cleanNumber(massKg)} * ${ctx.cleanNumber(acceleration)}`,
      expectedValue: force,
      expectedUnit: 'N',
      expectedDisplay: forceDisplay,
      hints: ['Multiply mass by acceleration.']
    }
  ];

  if (combinedFinalAnswer) {
    steps[steps.length - 1] = {
      ...steps[steps.length - 1],
      acceptCombinedFinalAnswer: true,
      combinedFinalAnswer
    };
  }

  return {
    formulaId: 'force_from_velocity_change',
    family: 'force',
    solveFor: 'force',
    formula: 'a = (vf - vi) / t, then F = m × a',
    finalAnswer,
    variables: {
      initialVelocity: { symbol: 'vi', value: viMS, unit: 'm/s', display: initialVelocityDisplay },
      finalVelocity: { symbol: 'vf', value: vfMS, unit: 'm/s', display: finalVelocityDisplay },
      time: { symbol: 't', value: timeS, unit: 's', display: timeDisplay },
      acceleration: { symbol: 'a', value: acceleration, unit: 'm/s²', display: accelerationDisplay },
      mass: { symbol: 'm', value: massKg, unit: 'kg', display: massDisplay },
      force: { symbol: 'F', value: force, unit: 'N', display: forceDisplay }
    },
    steps
  };
}

function forceTarget(lower, values, ctx) {
  if (ctx.asksForForce(lower)) return 'force';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(mass|m)\b/.test(lower)) return 'mass';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?(?:acceleration|accelerashun|acelerashun|aceleration|accretion|a)\b/.test(lower)) return 'acceleration';

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

module.exports = { buildForceFormulaWork, tryForce, tryForceAndFinalMomentumFromVelocityChange, tryForceFromVelocityChange };
