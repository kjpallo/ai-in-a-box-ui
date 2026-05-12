const EARTH_GRAVITY = 9.8;
const NUMBER = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';

function tryFreeBodyInference(text, lower, ctx) {
  if (!looksLikeSupportedFreeBodyInference(lower)) return null;
  if (hasUnsupportedCue(lower)) return null;

  const target = targetFromQuestion(lower);
  const mass = ctx.findQuantity(text, ['mass', 'm'], ctx.MASS_UNITS, null);
  const normalForce = findForceQuantity(text, ['normal force', 'normal', 'fn', 'f_n'], ctx);
  const maxStaticFriction = findForceQuantity(text, [
    'maximum static friction force',
    'maximum static friction',
    'max static friction force',
    'max static friction',
    'static friction force',
    'static friction'
  ], ctx);
  const kineticCoefficient = findCoefficient(text, ['kinetic friction coefficient', 'coefficient of kinetic friction', 'kinetic coefficient', 'coefficient'], 'kinetic');
  const staticCoefficient = findCoefficient(text, ['static friction coefficient', 'coefficient of static friction', 'static coefficient', 'coefficient'], 'static');
  const coefficient = kineticCoefficient || staticCoefficient || findCoefficient(text, ['coefficient of friction', 'coefficient', 'mu'], null);
  const appliedForce = findAppliedForce(text, lower, ctx);

  if (target === 'weight' && mass) {
    return weightAnswer(mass, ctx);
  }

  if (target === 'normalForce' && mass && isLevelSurfaceBalance(lower)) {
    return normalFromMassAnswer(mass, ctx);
  }

  if (target === 'staticFriction' && appliedForce && isStaticBalance(lower)) {
    return staticFrictionBalancesAnswer(appliedForce, ctx);
  }

  if (target === 'maximumStaticFriction' && appliedForce && /\bjust\s+begins?\s+to\s+move\b/.test(lower)) {
    return ctx.answer('Recognized maximum static friction from threshold motion.', [
      'At the instant the object just begins to move, the push has reached maximum static friction.',
      `Maximum static friction = ${ctx.cleanNumber(appliedForce.value)} N.`
    ]);
  }

  if (target === 'coefficient' && (maxStaticFriction || looksLikeMaximumStaticFrictionCoefficient(lower)) && normalForce) {
    const friction = maxStaticFriction || findAnyFrictionForce(text, ctx);
    if (friction && normalForce.value !== 0) {
      const value = friction.value / normalForce.value;
      return ctx.answer('Recognized static friction coefficient problem.', [
        'Use the maximum static friction formula: Ff,max = μs × Fn.',
        'Solve for coefficient of static friction: μs = Ff,max / Fn.',
        `μ = Ff / Fn`,
        `μs = ${ctx.cleanNumber(friction.value)} N / ${ctx.cleanNumber(normalForce.value)} N`,
        `μ = ${ctx.cleanNumber(friction.value)} N / ${ctx.cleanNumber(normalForce.value)} N`,
        `μ = ${ctx.cleanNumber(value)}`,
        `μs ≈ ${ctx.cleanNumber(roundToHundredths(value))}`
      ]);
    }
  }

  if (target === 'kineticFriction' && isConstantVelocity(lower) && appliedForce) {
    return kineticFrictionBalancedAnswer(appliedForce, ctx);
  }

  if (target === 'friction' && isConstantVelocity(lower) && appliedForce) {
    return frictionBalancedAnswer(appliedForce, ctx);
  }

  if (target === 'coefficient' && isConstantVelocity(lower) && appliedForce) {
    const inferredNormal = normalForce || (mass ? normalFromMass(mass, ctx) : null);
    if (!inferredNormal || inferredNormal.value === 0) {
      return ctx.answer('Recognized constant-velocity friction problem, but more information is needed.', [
        'Constant velocity means balanced horizontal forces.',
        'To find coefficient of friction, I need the normal force or the mass on level ground.'
      ]);
    }

    const value = appliedForce.value / inferredNormal.value;
    return ctx.answer('Recognized coefficient of friction from constant velocity.', [
      ...(normalForce ? [] : [`Fn = ${ctx.cleanNumber(inferredNormal.value)} N`]),
      'Constant velocity means balanced horizontal forces.',
      `μ = ${ctx.cleanNumber(appliedForce.value)} N / ${ctx.cleanNumber(inferredNormal.value)} N`,
      `μ ≈ ${ctx.cleanNumber(roundToHundredths(value))}`
    ]);
  }

  if (target === 'friction' && coefficient && normalForce && /(?:kinetic|skidding|sliding|braking)/.test(lower)) {
    const value = coefficient.value * normalForce.value;
    const symbol = kineticCoefficient || /(?:kinetic|skidding|sliding|braking)/.test(lower) ? 'μk' : 'μ';
    return ctx.answer('Recognized kinetic friction formula problem.', [
      'Use the friction formula: Ff = μ × Fn.',
      `For kinetic friction: Ff = ${symbol} × Fn.`,
      `Ff = ${ctx.cleanNumber(coefficient.value)} × ${ctx.cleanNumber(normalForce.value)} N`,
      `Ff = ${ctx.cleanNumber(value)} N`
    ]);
  }

  if (target === 'netForce' && isConstantVelocity(lower)) {
    return ctx.answer('Recognized constant-velocity free-body inference.', [
      'Constant velocity means no acceleration.',
      'Net force = 0 N.',
      'The forces are balanced.'
    ]);
  }

  return null;
}

function weightAnswer(mass, ctx) {
  const m = ctx.massToKg(mass);
  const weight = m * EARTH_GRAVITY;
  return ctx.answer('Recognized weight from mass on Earth.', [
    'Use the weight formula: Fg = m × g.',
    'For Earth, use g = 9.8 m/s².',
    `Fg = ${ctx.cleanNumber(m)} kg × 9.8 m/s²`,
    `Fg = ${ctx.cleanNumber(weight)} N`
  ]);
}

function normalFromMassAnswer(mass, ctx) {
  const weight = normalFromMass(mass, ctx).value;
  return ctx.answer('Recognized normal force on a level surface.', [
    `Weight = ${ctx.cleanNumber(weight)} N`,
    `Normal force = ${ctx.cleanNumber(weight)} N upward, assuming level ground.`
  ]);
}

function normalFromMass(mass, ctx) {
  return {
    value: ctx.massToKg(mass) * EARTH_GRAVITY,
    unit: 'N'
  };
}

function staticFrictionBalancesAnswer(appliedForce, ctx) {
  return ctx.answer('Recognized static friction balancing an applied force.', [
    'Static friction balances the push.',
    `Friction force = ${ctx.cleanNumber(appliedForce.value)} N ${oppositeDirection(appliedForce.direction) || 'opposite the push'}.`
  ]);
}

function frictionBalancedAnswer(appliedForce, ctx) {
  return ctx.answer('Recognized friction from constant velocity.', [
    'Constant velocity means balanced horizontal forces.',
    `Friction force = ${ctx.cleanNumber(appliedForce.value)} N opposite the push.`
  ]);
}

function kineticFrictionBalancedAnswer(appliedForce, ctx) {
  return ctx.answer('Recognized kinetic friction from constant velocity.', [
    'Constant velocity means balanced forces.',
    `Kinetic friction = ${ctx.cleanNumber(appliedForce.value)} N opposite the pull.`
  ]);
}

function looksLikeSupportedFreeBodyInference(lower) {
  return /\b(?:weight|normal force|static friction|maximum static friction|max static friction|kinetic friction|frictional force|coefficient of friction|coefficient of static friction|braking force|net force)\b/.test(lower) &&
    /\b(?:rests?|resting|ground|level|constant velocity|does not move|doesn’t move|not move|just begins? to move|normal force|friction|skidding|sliding)\b/.test(lower);
}

function hasUnsupportedCue(lower) {
  return /\b(?:moon|mars|planet|slope|sloped|incline|inclined|ramp|hill|angle|bearing|component|vector angle)\b/.test(lower);
}

function targetFromQuestion(lower) {
  if (/\bnet force\b/.test(lower)) return 'netForce';
  if (/\b(?:what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?weight\b/.test(lower)) return 'weight';
  if (/\b(?:what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?normal force\b/.test(lower)) return 'normalForce';
  if (/\b(?:what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(?:coefficient of static friction|coefficient of kinetic friction|coefficient of friction|coefficient|mu)\b/.test(lower)) return 'coefficient';
  if (/\b(?:what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(?:maximum static friction force|maximum static friction|max static friction force|max static friction)\b/.test(lower)) return 'maximumStaticFriction';
  if (/\b(?:what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?static friction force\b/.test(lower)) return 'staticFriction';
  if (/\b(?:what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?kinetic friction force\b/.test(lower)) return 'kineticFriction';
  if (/\b(?:what is|what's|find|calculate|solve for|determine|how much)\s+(?:the\s+)?(?:frictional force|friction force|force of friction|friction|braking force)\b/.test(lower)) return 'friction';
  return null;
}

function isLevelSurfaceBalance(lower) {
  return /\b(?:rests?|resting|at rest|ground|level|constant velocity)\b/.test(lower) &&
    !/\b(?:slope|sloped|incline|ramp|hill)\b/.test(lower);
}

function isStaticBalance(lower) {
  return /\b(?:does not move|doesn’t move|doesn't move|not moving|at rest)\b/.test(lower);
}

function isConstantVelocity(lower) {
  return /\bconstant velocity\b/.test(lower);
}

function findAppliedForce(text, lower, ctx) {
  const forces = ctx.findAllNumbersWithUnits(text, ctx.FORCE_UNITS)
    .filter((force) => !isNormalOrFrictionForce(lower, force));

  const actionForce = forces.find((force) => {
    const around = lower.slice(Math.max(0, force.start - 80), Math.min(lower.length, force.end + 45));
    return /\b(?:push(?:es|ed|ing)?|pull(?:s|ed|ing)?|appl(?:y|ies|ied)|pushing force|horizontal force)\b/.test(around);
  });
  const force = actionForce || forces[0] || null;
  if (!force) return null;

  return {
    ...force,
    direction: findDirectionNear(text, force.start, force.end)
  };
}

function isNormalOrFrictionForce(lower, force) {
  const before = lower.slice(Math.max(0, force.start - 55), force.start);
  const after = lower.slice(force.end, Math.min(lower.length, force.end + 25));
  const labelBefore = /\b(?:normal force|normal|fn|friction|frictional|static friction|kinetic friction|force of friction|ff|max(?:imum)? static friction)\b/.test(before);
  const labelAfter = /^\s*(?:of\s+)?(?:normal force|normal|fn|friction|frictional|static friction|kinetic friction|force of friction|ff|max(?:imum)? static friction)\b/.test(after);
  return labelBefore || labelAfter;
}

function findForceQuantity(text, labels, ctx) {
  const labelPattern = labels.map(ctx.escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const unitPattern = ctx.unitPatternFor(ctx.FORCE_UNITS);

  let match = new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:is|=|:|of|as|equals?)?\\s*(${NUMBER})\\s*(?:${unitPattern})\\b`, 'i').exec(text);
  if (match) return quantityFromMatch(match);

  match = new RegExp(`(${NUMBER})\\s*(?:${unitPattern})\\b\\s*(?:of\\s+)?(?:${labelPattern})\\b`, 'i').exec(text);
  if (match) return quantityFromMatch(match);

  return null;
}

function findAnyFrictionForce(text, ctx) {
  return findForceQuantity(text, ['friction force', 'frictional force', 'force of friction', 'friction', 'ff', 'f_f'], ctx);
}

function findCoefficient(text, labels, kind) {
  const labelPattern = labels.map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const symbol = kind === 'kinetic' ? 'μk|µk' : kind === 'static' ? 'μs|µs' : 'μ|µ';

  let match = new RegExp(`(?:\\b(?:${labelPattern})\\b|${symbol})\\s*(?:is|=|:|of|as|equals?)?\\s*(${NUMBER})\\b`, 'i').exec(text);
  if (match) return coefficientFromMatch(match);

  match = new RegExp(`(${NUMBER})\\s*(?:\\b(?:${labelPattern})\\b|${symbol})`, 'i').exec(text);
  if (match) return coefficientFromMatch(match);

  return null;
}

function quantityFromMatch(match) {
  return {
    value: Number(match[1]),
    unit: 'N',
    start: match.index,
    end: match.index + match[0].length
  };
}

function coefficientFromMatch(match) {
  return {
    value: Number(match[1]),
    unit: '',
    start: match.index,
    end: match.index + match[0].length
  };
}

function findDirectionNear(text, start, end) {
  const before = text.slice(Math.max(0, start - 55), start).toLowerCase();
  const after = text.slice(end, Math.min(text.length, end + 45)).toLowerCase();
  const directions = ['left', 'right', 'up', 'down', 'east', 'west', 'north', 'south'];

  for (const direction of directions) {
    if (new RegExp(`\\b${direction}\\b`).test(after) || new RegExp(`\\b${direction}\\b`).test(before)) return direction;
  }
  return null;
}

function oppositeDirection(direction) {
  const opposites = {
    left: 'right / opposite the push',
    right: 'left / opposite the push',
    up: 'down / opposite the push',
    down: 'up / opposite the push',
    east: 'west / opposite the push',
    west: 'east / opposite the push',
    north: 'south / opposite the push',
    south: 'north / opposite the push'
  };
  return opposites[direction] || null;
}

function looksLikeMaximumStaticFrictionCoefficient(lower) {
  return /\bmaximum static friction\b/.test(lower) && /\bcoefficient\b/.test(lower);
}

function roundToHundredths(value) {
  return Math.round(value * 100) / 100;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { tryFreeBodyInference };
