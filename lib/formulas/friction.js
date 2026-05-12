const { buildFormulaWork } = require('./formulaWorkBuilder');

const NUMBER = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const FORCE_UNIT = '(?:n|newton|newtons)';

function tryFriction(text, lower, ctx) {
  if (!looksLikeFriction(lower)) return null;

  const friction = findForceQuantity(text, [
    'frictional force',
    'friction force',
    'force of friction',
    'friction',
    'ff',
    'f_f'
  ]);
  const normalForce = findForceQuantity(text, [
    'normal force',
    'normal',
    'fn',
    'f_n'
  ]);
  const coefficient = findCoefficient(text);
  const target = frictionTarget(lower, { friction, normalForce, coefficient });

  if (target === 'friction' && coefficient && normalForce) {
    const value = coefficient.value * normalForce.value;
    const formulaWork = buildFrictionFormulaWork({
      solveFor: 'frictional force',
      frictionValue: value,
      coefficientValue: coefficient.value,
      normalForceValue: normalForce.value,
      ctx
    });

    return ctx.answer('Recognized friction formula problem: solving for frictional force.', [
      'Use the friction formula: Ff = μ × Fn.',
      `Ff = ${ctx.cleanNumber(coefficient.value)} × ${ctx.cleanNumber(normalForce.value)} N`,
      `Ff = ${ctx.cleanNumber(value)} N`
    ], formulaWork);
  }

  if (target === 'coefficient' && friction && normalForce && normalForce.value !== 0) {
    const value = friction.value / normalForce.value;
    const formulaWork = buildFrictionFormulaWork({
      solveFor: 'coefficient of friction',
      frictionValue: friction.value,
      coefficientValue: value,
      normalForceValue: normalForce.value,
      ctx
    });

    return ctx.answer('Recognized friction formula problem: solving for coefficient of friction.', [
      'Use the friction formula: Ff = μ × Fn.',
      'Solve for coefficient of friction: μ = Ff / Fn.',
      `μ = ${ctx.cleanNumber(friction.value)} N / ${ctx.cleanNumber(normalForce.value)} N`,
      `μ = ${ctx.cleanNumber(value)}`
    ], formulaWork);
  }

  if (target === 'normalForce' && friction && coefficient && coefficient.value !== 0) {
    const value = friction.value / coefficient.value;
    const formulaWork = buildFrictionFormulaWork({
      solveFor: 'normal force',
      frictionValue: friction.value,
      coefficientValue: coefficient.value,
      normalForceValue: value,
      ctx
    });

    return ctx.answer('Recognized friction formula problem: solving for normal force.', [
      'Use the friction formula: Ff = μ × Fn.',
      'Solve for normal force: Fn = Ff / μ.',
      `Fn = ${ctx.cleanNumber(friction.value)} N / ${ctx.cleanNumber(coefficient.value)}`,
      `Fn = ${ctx.cleanNumber(value)} N`
    ], formulaWork);
  }

  if (target) {
    return ctx.answer('Recognized friction formula question, but more information is needed.', missingValueLines(target, {
      friction,
      normalForce,
      coefficient
    }));
  }

  return null;
}

function looksLikeFriction(lower) {
  return /\b(?:friction|frictional|force of friction|coefficient of friction|mu|ff|fn)\b|μ/.test(lower);
}

function findForceQuantity(text, labels) {
  const labelPattern = labels.map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const beforePattern = new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:is|=|:|of|as|equals?|needed)?\\s*(${NUMBER})\\s*${FORCE_UNIT}\\b`, 'i');
  let match = beforePattern.exec(text);
  if (match) return quantityFromMatch(match);

  const afterPattern = new RegExp(`(${NUMBER})\\s*${FORCE_UNIT}\\b\\s*(?:of\\s+)?(?:${labelPattern})\\b`, 'i');
  match = afterPattern.exec(text);
  if (match) return quantityFromMatch(match);

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

function frictionTarget(lower, values) {
  if (asksForFriction(lower)) return 'friction';
  if (asksForCoefficient(lower)) return 'coefficient';
  if (asksForNormalForce(lower)) return 'normalForce';

  if (values.coefficient && values.normalForce && !values.friction) return 'friction';
  if (values.friction && values.normalForce && !values.coefficient) return 'coefficient';
  if (values.friction && values.coefficient && !values.normalForce) return 'normalForce';
  return null;
}

function asksForFriction(lower) {
  return /\b(?:what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(?:frictional force|friction force|force of friction|friction|ff)\b/.test(lower);
}

function asksForCoefficient(lower) {
  return /\b(?:what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(?:coefficient of friction|coefficient|mu)\b/.test(lower) ||
    /\bwhat\s+is\s+μ\b/.test(lower);
}

function asksForNormalForce(lower) {
  return /\b(?:what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(?:normal force|normal|fn)\b/.test(lower) ||
    /\bwhat\s+normal\s+force\b/.test(lower);
}

function missingValueLines(target, values) {
  const needed = [];
  if (target === 'friction') {
    if (!values.coefficient) needed.push('coefficient of friction, μ');
    if (!values.normalForce) needed.push('normal force, Fn');
  } else if (target === 'coefficient') {
    if (!values.friction) needed.push('frictional force, Ff');
    if (!values.normalForce) needed.push('normal force, Fn');
  } else if (target === 'normalForce') {
    if (!values.friction) needed.push('frictional force, Ff');
    if (!values.coefficient) needed.push('coefficient of friction, μ');
  }

  return [
    'Use the friction formula: Ff = μ × Fn.',
    `I need the ${joinNeeded(needed)} to solve this friction problem.`
  ];
}

function joinNeeded(items) {
  if (items.length === 0) return 'missing value';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function buildFrictionFormulaWork({ solveFor, frictionValue, coefficientValue, normalForceValue, ctx }) {
  const frictionDisplay = `${ctx.cleanNumber(frictionValue)} N`;
  const coefficientDisplay = ctx.cleanNumber(coefficientValue);
  const normalForceDisplay = `${ctx.cleanNumber(normalForceValue)} N`;
  const formula = solveFor === 'frictional force'
    ? 'Ff = μ × Fn'
    : solveFor === 'coefficient of friction'
      ? 'μ = Ff / Fn'
      : 'Fn = Ff / μ';

  return buildFormulaWork({
    formulaId: 'friction_coefficient_normal_force',
    family: 'force',
    solveFor,
    formula,
    finalAnswer: {
      value: solveFor === 'frictional force'
        ? frictionValue
        : solveFor === 'coefficient of friction'
          ? coefficientValue
          : normalForceValue,
      unit: solveFor === 'coefficient of friction' ? '' : 'N',
      display: solveFor === 'frictional force'
        ? frictionDisplay
        : solveFor === 'coefficient of friction'
          ? coefficientDisplay
          : normalForceDisplay
    },
    variables: [
      {
        key: 'frictional force',
        symbol: 'Ff',
        value: frictionValue,
        unit: 'N',
        display: frictionDisplay,
        hints: ['Look for friction, frictional force, force of friction, or Ff.']
      },
      {
        key: 'coefficient of friction',
        symbol: 'μ',
        value: coefficientValue,
        unit: '',
        display: coefficientDisplay,
        hints: ['Look for coefficient, coefficient of friction, mu, or μ.']
      },
      {
        key: 'normal force',
        symbol: 'Fn',
        value: normalForceValue,
        unit: 'N',
        display: normalForceDisplay,
        hints: ['Look for normal force or Fn.']
      }
    ],
    choices: ['frictional force', 'coefficient of friction', 'normal force'],
    formulaDistractors: ['F = m × a', 'Fnet = forces together or opposite'],
    calculation: {
      prompt: calculationPrompt(solveFor, frictionValue, coefficientValue, normalForceValue, ctx),
      expectedValue: solveFor === 'frictional force'
        ? frictionValue
        : solveFor === 'coefficient of friction'
          ? coefficientValue
          : normalForceValue,
      hints: [calculationHint(solveFor)]
    }
  });
}

function calculationPrompt(solveFor, frictionValue, coefficientValue, normalForceValue, ctx) {
  if (solveFor === 'frictional force') {
    return `Now substitute: Ff = ${ctx.cleanNumber(coefficientValue)} × ${ctx.cleanNumber(normalForceValue)}. What is ${ctx.cleanNumber(coefficientValue)} × ${ctx.cleanNumber(normalForceValue)}?`;
  }
  if (solveFor === 'coefficient of friction') {
    return `Now substitute: μ = ${ctx.cleanNumber(frictionValue)} / ${ctx.cleanNumber(normalForceValue)}. What is ${ctx.cleanNumber(frictionValue)} / ${ctx.cleanNumber(normalForceValue)}?`;
  }
  return `Now substitute: Fn = ${ctx.cleanNumber(frictionValue)} / ${ctx.cleanNumber(coefficientValue)}. What is ${ctx.cleanNumber(frictionValue)} / ${ctx.cleanNumber(coefficientValue)}?`;
}

function calculationHint(solveFor) {
  if (solveFor === 'frictional force') return 'Multiply coefficient of friction by normal force.';
  if (solveFor === 'coefficient of friction') return 'Divide frictional force by normal force.';
  return 'Divide frictional force by coefficient of friction.';
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { tryFriction };
