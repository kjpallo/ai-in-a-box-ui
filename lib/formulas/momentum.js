const {
  MASS_UNITS,
  MOMENTUM_UNITS,
  VELOCITY_UNITS,
  findQuantity,
  mask,
  massToKg,
  velocityToMS
} = require('./formulaParser');
const { answer, cleanNumber } = require('./formulaAnswerFormatter');
const { buildFormulaWork } = require('./formulaWorkBuilder');

// ---------------- Momentum: p = m × v ----------------
function tryMomentum(text, lower) {
  if (!/\b(momentum|p\s*=)\b/.test(lower)) return null;
  let momentum = findQuantity(text, ['momentum'], MOMENTUM_UNITS, null);
  if (momentum && !momentum.unit) momentum = null;
  const textWithoutMomentum = momentum ? mask(text, momentum.start, momentum.end) : text;
  const mass = findQuantity(textWithoutMomentum, ['mass'], MASS_UNITS, null);
  const velocity = findQuantity(text, ['velocity', 'speed'], VELOCITY_UNITS, null);
  const target = momentumTarget(lower, { momentum, mass, velocity });

  if (target === 'momentum' && mass && velocity) {
    const m = massToKg(mass);
    const v = velocityToMS(velocity);
    if (v == null) return null;
    const value = m * v;
    const formulaWork = buildMomentumFormulaWork({
      solveFor: 'momentum',
      momentumValue: value,
      massValue: m,
      velocityValue: v
    });
    return answer('Recognized momentum problem: solving for momentum.', [
      'Use the momentum formula: p = m × v.',
      `p = ${cleanNumber(m)} kg × ${cleanNumber(v)} m/s`,
      `p = ${cleanNumber(value)} kg·m/s`
    ], formulaWork);
  }

  if (target === 'mass' && momentum && velocity) {
    const v = velocityToMS(velocity);
    if (v == null || v === 0) return null;
    const value = momentum.value / v;
    const formulaWork = buildMomentumFormulaWork({
      solveFor: 'mass',
      momentumValue: momentum.value,
      massValue: value,
      velocityValue: v
    });
    return answer('Recognized momentum problem: solving for mass.', [
      'Use the momentum formula: mass = momentum / velocity.',
      `m = ${cleanNumber(momentum.value)} kg·m/s / ${cleanNumber(v)} m/s`,
      `m = ${cleanNumber(value)} kg`
    ], formulaWork);
  }

  if (target === 'velocity' && momentum && mass) {
    const m = massToKg(mass);
    if (m === 0) return null;
    const value = momentum.value / m;
    const formulaWork = buildMomentumFormulaWork({
      solveFor: 'velocity',
      momentumValue: momentum.value,
      massValue: m,
      velocityValue: value
    });
    return answer('Recognized momentum problem: solving for velocity.', [
      'Use the momentum formula: velocity = momentum / mass.',
      `v = ${cleanNumber(momentum.value)} kg·m/s / ${cleanNumber(m)} kg`,
      `v = ${cleanNumber(value)} m/s`
    ], formulaWork);
  }

  return null;
}

function momentumTarget(lower, values) {
  if (asksForMomentumTarget(lower, 'momentum|p')) return 'momentum';
  if (asksForMomentumTarget(lower, 'mass|m')) return 'mass';
  if (asksForMomentumTarget(lower, 'velocity|speed|v')) return 'velocity';

  if (values.mass && values.velocity && !values.momentum) return 'momentum';
  if (values.momentum && values.velocity && !values.mass) return 'mass';
  if (values.momentum && values.mass && !values.velocity) return 'velocity';
  return null;
}

function asksForMomentumTarget(lower, targetPattern) {
  return new RegExp(`\\b(?:what is|what's|find|calculate|solve for|determine)\\s+(?:its\\s+|the\\s+|my\\s+|[a-z0-9-]+(?:['’]s)?\\s+)*(?:${targetPattern})\\b`).test(lower);
}

function buildMomentumFormulaWork({ solveFor, momentumValue, massValue, velocityValue }) {
  const momentumDisplay = `${cleanNumber(momentumValue)} kg·m/s`;
  const massDisplay = `${cleanNumber(massValue)} kg`;
  const velocityDisplay = `${cleanNumber(velocityValue)} m/s`;
  const finalAnswerByTarget = {
    momentum: { value: momentumValue, unit: 'kg·m/s', display: momentumDisplay },
    mass: { value: massValue, unit: 'kg', display: massDisplay },
    velocity: { value: velocityValue, unit: 'm/s', display: velocityDisplay }
  };
  const formulaByTarget = {
    momentum: 'p = m × v',
    mass: 'm = p / v',
    velocity: 'v = p / m'
  };
  const finalAnswer = finalAnswerByTarget[solveFor];

  return buildFormulaWork({
    formulaId: 'momentum_mass_velocity',
    family: 'momentum',
    solveFor,
    formula: formulaByTarget[solveFor],
    finalAnswer,
    choices: ['momentum', 'mass', 'velocity'],
    formulaDistractors: ['KE = 1/2 × m × v²', 'F = m × a'],
    variables: [
      { key: 'momentum', symbol: 'p', value: momentumValue, unit: 'kg·m/s', display: momentumDisplay },
      { key: 'mass', symbol: 'm', value: massValue, unit: 'kg', display: massDisplay },
      { key: 'velocity', symbol: 'v', value: velocityValue, unit: 'm/s', display: velocityDisplay }
    ],
    calculation: {
      prompt: buildMomentumCalculationPrompt({
        solveFor,
        momentumValue,
        massValue,
        velocityValue
      }),
      expectedValue: finalAnswer.value,
      hints: [buildMomentumCalculationHint(solveFor)]
    }
  });
}

function buildMomentumCalculationPrompt({ solveFor, momentumValue, massValue, velocityValue }) {
  if (solveFor === 'momentum') {
    return `Now substitute: p = ${cleanNumber(massValue)} × ${cleanNumber(velocityValue)}. What is ${cleanNumber(massValue)} × ${cleanNumber(velocityValue)}?`;
  }
  if (solveFor === 'mass') {
    return `Now substitute: m = ${cleanNumber(momentumValue)} / ${cleanNumber(velocityValue)}. What is ${cleanNumber(momentumValue)} / ${cleanNumber(velocityValue)}?`;
  }
  return `Now substitute: v = ${cleanNumber(momentumValue)} / ${cleanNumber(massValue)}. What is ${cleanNumber(momentumValue)} / ${cleanNumber(massValue)}?`;
}

function buildMomentumCalculationHint(solveFor) {
  if (solveFor === 'momentum') return 'Multiply mass by velocity.';
  if (solveFor === 'mass') return 'Divide momentum by velocity.';
  return 'Divide momentum by mass.';
}

module.exports = { tryMomentum };
