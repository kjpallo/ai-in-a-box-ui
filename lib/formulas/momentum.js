const {
  MASS_UNITS,
  MOMENTUM_UNITS,
  VELOCITY_UNITS,
  findQuantity,
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
  const mass = findQuantity(text, ['mass'], MASS_UNITS, null);
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
    return answer('Recognized momentum problem: solving for velocity.', [
      'Use the momentum formula: velocity = momentum / mass.',
      `v = ${cleanNumber(momentum.value)} kg·m/s / ${cleanNumber(m)} kg`,
      `v = ${cleanNumber(value)} m/s`
    ]);
  }

  return null;
}

function momentumTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:its|the|my)?\s*(momentum|p)\b/.test(lower)) return 'momentum';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:its|the|my)?\s*(mass|m)\b/.test(lower)) return 'mass';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:its|the|my)?\s*(velocity|speed|v)\b/.test(lower)) return 'velocity';

  if (values.mass && values.velocity && !values.momentum) return 'momentum';
  if (values.momentum && values.velocity && !values.mass) return 'mass';
  if (values.momentum && values.mass && !values.velocity) return 'velocity';
  return null;
}

function buildMomentumFormulaWork({ solveFor, momentumValue, massValue, velocityValue }) {
  const momentumDisplay = `${cleanNumber(momentumValue)} kg·m/s`;
  const massDisplay = `${cleanNumber(massValue)} kg`;
  const velocityDisplay = `${cleanNumber(velocityValue)} m/s`;
  const finalAnswer = solveFor === 'momentum'
    ? { value: momentumValue, unit: 'kg·m/s', display: momentumDisplay }
    : { value: massValue, unit: 'kg', display: massDisplay };

  return buildFormulaWork({
    formulaId: 'momentum_mass_velocity',
    family: 'momentum',
    solveFor,
    formula: solveFor === 'momentum' ? 'p = m × v' : 'm = p / v',
    finalAnswer,
    choices: ['momentum', 'mass', 'velocity'],
    formulaDistractors: ['KE = 1/2 × m × v²', 'F = m × a'],
    variables: [
      { key: 'momentum', symbol: 'p', value: momentumValue, unit: 'kg·m/s', display: momentumDisplay },
      { key: 'mass', symbol: 'm', value: massValue, unit: 'kg', display: massDisplay },
      { key: 'velocity', symbol: 'v', value: velocityValue, unit: 'm/s', display: velocityDisplay }
    ],
    calculation: {
      prompt: solveFor === 'momentum'
        ? `Now substitute: p = ${cleanNumber(massValue)} × ${cleanNumber(velocityValue)}. What is ${cleanNumber(massValue)} × ${cleanNumber(velocityValue)}?`
        : `Now substitute: m = ${cleanNumber(momentumValue)} / ${cleanNumber(velocityValue)}. What is ${cleanNumber(momentumValue)} / ${cleanNumber(velocityValue)}?`,
      expectedValue: finalAnswer.value,
      hints: [solveFor === 'momentum' ? 'Multiply mass by velocity.' : 'Divide momentum by velocity.']
    }
  });
}

module.exports = { tryMomentum };
