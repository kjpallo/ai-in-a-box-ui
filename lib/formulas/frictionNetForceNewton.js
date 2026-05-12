const { buildForceFormulaWork } = require('./force');

const NUMBER = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';

function tryFrictionNetForceNewton(text, lower, ctx) {
  if (!asksForAcceleration(lower)) return null;
  if (!looksLikeCoefficientFrictionAcceleration(lower)) return null;

  const mass = ctx.findQuantity(text, ['mass', 'm'], ctx.MASS_UNITS, null);
  const appliedForce = findAppliedForce(text, lower, ctx);
  const coefficient = findCoefficient(text);
  const normalForce = findNormalForce(text, ctx);
  const missing = missingValues({ mass, appliedForce, coefficient, normalForce });

  if (missing.length > 0) {
    return ctx.answer('Recognized friction, net force, and Newton’s second law problem, but more information is needed.', [
      'To find acceleration with friction, first find friction force, then net force, then acceleration.',
      `I need the ${joinNeeded(missing)} to solve this problem.`
    ]);
  }

  const massKg = ctx.massToKg(mass);
  if (massKg === 0) return null;

  const frictionForce = coefficient.value * normalForce.value;
  const netForce = appliedForce.value - frictionForce;
  const acceleration = netForce / massKg;
  const balanced = netForce === 0;
  const formulaWork = buildBridgeFormulaWork({
    appliedForce: appliedForce.value,
    coefficient: coefficient.value,
    normalForce: normalForce.value,
    frictionForce,
    netForce,
    mass: massKg,
    acceleration,
    ctx
  });

  return ctx.answer('Recognized multi-step friction, net force, and Newton’s second law problem: solving for acceleration.', [
    'First calculate friction force.',
    'Use the friction formula: Ff = μ × Fn.',
    `Ff = ${ctx.cleanNumber(coefficient.value)} × ${ctx.cleanNumber(normalForce.value)} N`,
    `Ff = ${ctx.cleanNumber(frictionForce)} N`,
    'Then calculate net force.',
    `Fnet = ${ctx.cleanNumber(appliedForce.value)} N - ${ctx.cleanNumber(frictionForce)} N = ${ctx.cleanNumber(netForce)} N`,
    ...(balanced ? ['The forces are balanced.'] : []),
    'Use Newton’s second law: Fnet = m × a.',
    'Solve for acceleration: a = Fnet / m.',
    `a = ${ctx.cleanNumber(netForce)} N / ${ctx.cleanNumber(massKg)} kg`,
    `a = ${ctx.cleanNumber(acceleration)} m/s²`,
    `The acceleration is ${ctx.cleanNumber(acceleration)} m/s².`
  ], formulaWork);
}

function asksForAcceleration(lower) {
  return /\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+|its\s+)?(?:acceleration|accelerashun|acelerashun|aceleration|accretion|a)\b/.test(lower);
}

function looksLikeCoefficientFrictionAcceleration(lower) {
  const hasFrictionCue = /\b(?:coefficient|mu|fn|normal force)\b|μ/.test(lower);
  return hasFrictionCue;
}

function findAppliedForce(text, lower, ctx) {
  const forces = ctx.findAllNumbersWithUnits(text, ctx.FORCE_UNITS)
    .filter((force) => !isFrictionOrNormalForce(text, lower, force));

  const actionForce = forces.find((force) => {
    const before = lower.slice(Math.max(0, force.start - 70), force.start);
    const after = lower.slice(force.end, Math.min(lower.length, force.end + 35));
    return /\b(?:push(?:es|ed|ing)?|pull(?:s|ed|ing)?|appl(?:y|ies|ied)|exerts?)\b/.test(before) ||
      /\b(?:push(?:es|ed|ing)?|pull(?:s|ed|ing)?|appl(?:y|ies|ied)|exerts?)\b/.test(after);
  });
  if (actionForce) return actionForce;

  return forces[0] || null;
}

function isFrictionOrNormalForce(text, lower, force) {
  const beforeSentence = lower
    .slice(Math.max(0, lower.lastIndexOf('.', force.start - 1), lower.lastIndexOf('?', force.start - 1), lower.lastIndexOf('!', force.start - 1)) + 1, force.start);
  const nextPunctuation = nextSentenceBreak(lower, force.end);
  const afterSentence = lower.slice(force.end, nextPunctuation);
  const around = `${beforeSentence} ${afterSentence}`;
  return /\b(?:friction|frictional|force of friction|ff|f_f|normal force|normal|fn|f_n)\b/.test(around);
}

function nextSentenceBreak(lower, start) {
  const breaks = ['.', '?', '!']
    .map((mark) => lower.indexOf(mark, start))
    .filter((index) => index >= 0);
  return breaks.length ? Math.min(...breaks) : lower.length;
}

function findNormalForce(text, ctx) {
  const labelPattern = '(?:normal\\s+force|normal|fn|f_n)';
  const unitPattern = ctx.FORCE_UNITS
    .flatMap((def) => [...def.names, def.canonical])
    .map(ctx.escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join('|');

  let match = new RegExp(`\\b${labelPattern}\\b\\s*(?:is|=|:|of|as|equals?)?\\s*(${NUMBER})\\s*(?:${unitPattern})\\b`, 'i').exec(text);
  if (match) return forceFromMatch(match);

  match = new RegExp(`(${NUMBER})\\s*(?:${unitPattern})\\b\\s*(?:of\\s+)?${labelPattern}\\b`, 'i').exec(text);
  if (match) return forceFromMatch(match);

  return null;
}

function findCoefficient(text) {
  const wordLabelPattern = [
    'coefficient of friction',
    'coefficient',
    'mu'
  ].map(escapeRegex).join('|');
  const labelPattern = `(?:\\b(?:${wordLabelPattern})\\b|μ)`;

  let match = new RegExp(`${labelPattern}\\s*(?:is|=|:|of|as|equals?)?\\s*(${NUMBER})\\b`, 'i').exec(text);
  if (match) return coefficientFromMatch(match);

  match = new RegExp(`(${NUMBER})\\s*${labelPattern}`, 'i').exec(text);
  if (match) return coefficientFromMatch(match);

  return null;
}

function forceFromMatch(match) {
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

function missingValues(values) {
  const missing = [];
  if (!values.mass) missing.push('mass, m');
  if (!values.appliedForce) missing.push('applied force');
  if (!values.coefficient) missing.push('coefficient of friction, μ');
  if (!values.normalForce) missing.push('normal force, Fn');
  return missing;
}

function joinNeeded(items) {
  if (items.length === 0) return 'missing value';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function buildBridgeFormulaWork({
  appliedForce,
  coefficient,
  normalForce,
  frictionForce,
  netForce,
  mass,
  acceleration,
  ctx
}) {
  const formulaWork = buildForceFormulaWork({
    solveFor: 'acceleration',
    forceValue: netForce,
    massValue: mass,
    accelerationValue: acceleration,
    ctx,
    includeSteps: false
  });

  formulaWork.formulaId = 'friction_net_force_newton_second_law';
  formulaWork.family = 'forces';
  formulaWork.formula = 'a = (Fapplied - (μ × Fn)) / m';
  formulaWork.variables.appliedForce = {
    symbol: 'Fapplied',
    value: appliedForce,
    unit: 'N',
    display: `${ctx.cleanNumber(appliedForce)} N`
  };
  formulaWork.variables.coefficient = {
    symbol: 'μ',
    value: coefficient,
    unit: '',
    display: ctx.cleanNumber(coefficient)
  };
  formulaWork.variables.normalForce = {
    symbol: 'Fn',
    value: normalForce,
    unit: 'N',
    display: `${ctx.cleanNumber(normalForce)} N`
  };
  formulaWork.variables.frictionForce = {
    symbol: 'Ff',
    value: frictionForce,
    unit: 'N',
    display: `${ctx.cleanNumber(frictionForce)} N`
  };
  formulaWork.variables.force.symbol = 'Fnet';
  formulaWork.variables.force.display = `${ctx.cleanNumber(netForce)} N`;
  formulaWork.finalAnswer.display = `${ctx.cleanNumber(acceleration)} m/s²`;

  return formulaWork;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { tryFrictionNetForceNewton };
