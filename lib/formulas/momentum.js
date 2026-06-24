const {
  MASS_UNITS,
  MOMENTUM_UNITS,
  VELOCITY_UNITS,
  findQuantity,
  mask,
  massToKg,
  parseQuantityNumber,
  unitPatternFor,
  velocityToMS
} = require('./formulaParser');
const { answer, cleanNumber } = require('./formulaAnswerFormatter');
const { buildFormulaWork } = require('./formulaWorkBuilder');

// ---------------- Momentum: p = m × v ----------------
function tryMomentum(text, lower) {
  if (!/\b(momentum|p\s*=)\b/.test(lower)) return null;

  const transfer = tryMomentumTransfer(text, lower);
  if (transfer) return transfer;

  let momentum = findQuantity(text, ['momentum'], MOMENTUM_UNITS, null);
  if (momentum && !momentum.unit) momentum = null;
  const textWithoutMomentum = momentum ? mask(text, momentum.start, momentum.end) : text;
  const mass = findQuantity(textWithoutMomentum, ['mass'], MASS_UNITS, null);
  const velocity = findMomentumVelocity(text, lower);
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
  return new RegExp(`\\b(?:what is|what's|find|calculate|solve for|determine)\\s+(?:its\\s+|their\\s+|his\\s+|her\\s+|the\\s+|my\\s+|final\\s+|initial\\s+|[a-z0-9-]+(?:['’]s)\\s+)*(?:${targetPattern})\\b`).test(lower);
}

function tryMomentumTransfer(text, lower) {
  if (!/\btransfers?\s+all(?:\s+of)?\s+(?:its\s+)?momentum\b/.test(lower)) return null;
  if (!/\b(?:collision|collide|collides|collided)\b/.test(lower)) return null;
  if (!asksForMomentumTarget(lower, 'velocity|speed|v')) return null;

  const masses = findAllQuantities(text, MASS_UNITS).map((mass) => ({
    ...mass,
    value: massToKg(mass),
    unit: 'kg'
  }));
  const velocities = findAllQuantities(text, VELOCITY_UNITS);
  if (masses.length < 2 || velocities.length < 1) return null;

  const sourceVelocity = velocities[0];
  const sourceMass = [...masses]
    .filter((mass) => mass.start < sourceVelocity.start)
    .sort((a, b) => Math.abs(b.start - sourceVelocity.start) - Math.abs(a.start - sourceVelocity.start))
    .pop() || masses[0];
  const receiverMass = findReceiverMass(text, lower, masses, sourceMass) ||
    masses.find((mass) => mass.start !== sourceMass.start);

  if (!sourceMass || !receiverMass) return null;

  const sourceVelocityValue = velocityToMS(sourceVelocity);
  if (sourceVelocityValue == null || receiverMass.value === 0) return null;

  const transferredMomentum = sourceMass.value * sourceVelocityValue;
  const receiverVelocity = transferredMomentum / receiverMass.value;
  const formulaWork = buildMomentumTransferFormulaWork({
    sourceMass: sourceMass.value,
    sourceVelocity: sourceVelocityValue,
    transferredMomentum,
    receiverMass: receiverMass.value,
    receiverVelocity
  });

  return answer('Recognized momentum transfer problem: solving for final velocity.', [
    'Find the moving object’s momentum first.',
    'Use the momentum formula: p = m × v.',
    `p = ${cleanNumber(sourceMass.value)} kg × ${cleanNumber(sourceVelocityValue)} m/s`,
    `p = ${cleanNumber(transferredMomentum)} kg·m/s`,
    'The second object receives that momentum.',
    'Use velocity = momentum / mass.',
    `v = ${cleanNumber(transferredMomentum)} kg·m/s / ${cleanNumber(receiverMass.value)} kg`,
    `v = ${cleanNumber(receiverVelocity)} m/s forward`
  ], formulaWork);
}

function findReceiverMass(text, lower, masses, sourceMass) {
  const afterTransfer = /\btransfers?\s+all(?:\s+of)?\s+(?:its\s+)?momentum\s+to\b/i.exec(text);
  if (afterTransfer) {
    const afterIndex = afterTransfer.index + afterTransfer[0].length;
    const afterMass = masses.find((mass) => mass.start > afterIndex && mass.start !== sourceMass.start);
    if (afterMass) return afterMass;
  }

  const namedReceiverMatch = /\b(?:to|towards?)\s+the\s+([a-z]+)\s+ball\b/i.exec(text);
  if (namedReceiverMatch) {
    const name = namedReceiverMatch[1].toLowerCase();
    const receiverCue = new RegExp(`\\b${name}\\s+ball\\b[\\s\\S]{0,80}?\\bhas\\s+a\\s+mass\\s+of\\b`, 'i').exec(lower);
    if (receiverCue) {
      return masses.find((mass) => mass.start > receiverCue.index && mass.start !== sourceMass.start);
    }
  }

  return null;
}

function findMomentumVelocity(text, lower) {
  const velocities = findAllQuantities(text, VELOCITY_UNITS);
  if (!velocities.length) return null;
  if (/\bfinal\s+momentum\b/.test(lower)) return velocities[velocities.length - 1];
  return findQuantity(text, ['velocity', 'speed'], VELOCITY_UNITS, null);
}

function findAllQuantities(text, unitDefs) {
  const unitPattern = unitPatternFor(unitDefs);
  const number = '-?(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)';
  const regex = new RegExp(`(${number})\\s*(${unitPattern})(?=$|[^A-Za-z0-9/²³^])`, 'gi');
  const quantities = [];

  for (const match of text.matchAll(regex)) {
    const rawUnit = match[2];
    const def = unitDefs.find((item) => item.names.some((name) => name.toLowerCase() === String(rawUnit).toLowerCase()) || item.canonical.toLowerCase() === String(rawUnit).toLowerCase());
    quantities.push({
      value: parseQuantityNumber(match[1]),
      unit: def ? def.canonical : rawUnit,
      distanceUnit: def ? def.distanceUnit : null,
      perTimeUnit: def ? def.perTimeUnit : null,
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return quantities;
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

function buildMomentumTransferFormulaWork({
  sourceMass,
  sourceVelocity,
  transferredMomentum,
  receiverMass,
  receiverVelocity
}) {
  const sourceMassDisplay = `${cleanNumber(sourceMass)} kg`;
  const sourceVelocityDisplay = `${cleanNumber(sourceVelocity)} m/s`;
  const transferredMomentumDisplay = `${cleanNumber(transferredMomentum)} kg·m/s`;
  const receiverMassDisplay = `${cleanNumber(receiverMass)} kg`;
  const receiverVelocityDisplay = `${cleanNumber(receiverVelocity)} m/s forward`;

  return {
    formulaId: 'momentum_transfer_velocity',
    family: 'momentum',
    solveFor: 'velocity',
    formula: 'p = m × v, then v = p / m',
    finalAnswer: {
      value: receiverVelocity,
      unit: 'm/s',
      display: receiverVelocityDisplay
    },
    variables: {
      sourceMass: { symbol: 'm1', value: sourceMass, unit: 'kg', display: sourceMassDisplay },
      sourceVelocity: { symbol: 'v1', value: sourceVelocity, unit: 'm/s', display: sourceVelocityDisplay },
      transferredMomentum: { symbol: 'p', value: transferredMomentum, unit: 'kg·m/s', display: transferredMomentumDisplay },
      receiverMass: { symbol: 'm2', value: receiverMass, unit: 'kg', display: receiverMassDisplay },
      receiverVelocity: { symbol: 'v2', value: receiverVelocity, unit: 'm/s', display: receiverVelocityDisplay }
    },
    steps: [
      {
        id: 'identify_solve_target',
        type: 'multiple_choice',
        prompt: 'What variable are we solving for?',
        choices: [
          { number: 1, label: 'velocity', correct: true },
          { number: 2, label: 'mass', correct: false },
          { number: 3, label: 'force', correct: false }
        ],
        expected: 'velocity',
        hints: ['The question asks for the velocity after the collision.']
      },
      {
        id: 'choose_first_formula',
        type: 'multiple_choice',
        prompt: 'Which formula finds the momentum being transferred?',
        choices: [
          { number: 1, label: 'p = m × v', correct: true },
          { number: 2, label: 'F = m × a', correct: false },
          { number: 3, label: 'a = (vf - vi) / t', correct: false }
        ],
        expected: 'p = m × v',
        hints: ['Momentum equals mass times velocity.']
      },
      {
        id: 'identify_source_mass',
        type: 'quantity',
        prompt: 'What is the mass of the moving object?',
        expectedValue: sourceMass,
        expectedUnit: 'kg',
        expectedDisplay: sourceMassDisplay,
        hints: ['Use the mass of the object that is moving before the collision.']
      },
      {
        id: 'identify_source_velocity',
        type: 'quantity',
        prompt: 'What is the moving object’s velocity?',
        expectedValue: sourceVelocity,
        expectedUnit: 'm/s',
        expectedDisplay: sourceVelocityDisplay,
        hints: ['Look for the velocity before the collision.']
      },
      {
        id: 'calculate_transferred_momentum',
        type: 'calculation',
        prompt: `What momentum transfers? Use ${cleanNumber(sourceMass)} × ${cleanNumber(sourceVelocity)}.`,
        calculationExpression: `${cleanNumber(sourceMass)} * ${cleanNumber(sourceVelocity)}`,
        expectedValue: transferredMomentum,
        expectedUnit: 'kg·m/s',
        expectedDisplay: transferredMomentumDisplay,
        hints: ['Multiply the moving object’s mass by its velocity.']
      },
      {
        id: 'choose_second_formula',
        type: 'multiple_choice',
        prompt: 'Which formula finds velocity from momentum and mass?',
        choices: [
          { number: 1, label: 'v = p / m', correct: true },
          { number: 2, label: 'p = m / v', correct: false },
          { number: 3, label: 'm = p × v', correct: false }
        ],
        expected: 'v = p / m',
        hints: ['Rearrange p = m × v to solve for velocity.']
      },
      {
        id: 'identify_receiver_mass',
        type: 'quantity',
        prompt: 'What is the mass of the object receiving the momentum?',
        expectedValue: receiverMass,
        expectedUnit: 'kg',
        expectedDisplay: receiverMassDisplay,
        hints: ['Use the mass of the object that receives the momentum.']
      },
      {
        id: 'calculate',
        type: 'calculation',
        prompt: `Now substitute: v = ${cleanNumber(transferredMomentum)} / ${cleanNumber(receiverMass)}. What is ${cleanNumber(transferredMomentum)} / ${cleanNumber(receiverMass)}?`,
        calculationExpression: `${cleanNumber(transferredMomentum)} / ${cleanNumber(receiverMass)}`,
        expectedValue: receiverVelocity,
        expectedUnit: 'm/s',
        expectedDisplay: receiverVelocityDisplay,
        hints: ['Divide transferred momentum by the receiving object’s mass.']
      }
    ]
  };
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
