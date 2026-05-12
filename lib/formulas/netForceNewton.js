const { buildForceFormulaWork } = require('./force');
const { tryNetForce } = require('./netForce');

function tryNetForceNewton(text, lower, ctx) {
  const target = newtonTarget(lower, ctx);
  if (!target) return null;

  const mass = ctx.findQuantity(text, ['mass', 'm'], ctx.MASS_UNITS, null);
  const acceleration = ctx.findAccelerationQuantity(text) ||
    ctx.findQuantity(text, ['acceleration', 'a'], ctx.ACCEL_UNITS, null);
  const netForceResult = tryNetForce(text, lower, ctx);
  const netForce = netForceFromResult(netForceResult);
  const balancedNetForce = !netForce && target === 'acceleration' && mass && looksBalancedWithoutNumbers(lower)
    ? { value: 0, direction: '', display: '0 N', lines: ['The forces are balanced.', 'Net force = 0 N.'] }
    : null;
  const knownNetForce = netForce || balancedNetForce;

  if (!knownNetForce) return null;

  if (target === 'acceleration' && mass) {
    const massKg = ctx.massToKg(mass);
    if (massKg === 0) return null;

    const value = knownNetForce.value / massKg;
    const direction = knownNetForce.value === 0 ? '' : knownNetForce.direction;
    const formulaWork = buildTwoStepFormulaWork({
      solveFor: 'acceleration',
      forceValue: knownNetForce.value,
      massValue: massKg,
      accelerationValue: value,
      direction,
      ctx
    });

    return ctx.answer('Recognized two-step net force and Newton’s second law problem: solving for acceleration.', [
      ...netForceStepLines(knownNetForce),
      'Use Newton’s second law: Fnet = m × a.',
      'Solve for acceleration: a = Fnet / m.',
      `a = ${ctx.cleanNumber(knownNetForce.value)} N / ${ctx.cleanNumber(massKg)} kg`,
      `a = ${ctx.cleanNumber(value)} m/s²`,
      finalAccelerationLine(value, direction, ctx)
    ], formulaWork);
  }

  if (target === 'mass' && acceleration && acceleration.value !== 0) {
    const value = knownNetForce.value / acceleration.value;
    const formulaWork = buildTwoStepFormulaWork({
      solveFor: 'mass',
      forceValue: knownNetForce.value,
      massValue: value,
      accelerationValue: acceleration.value,
      direction: knownNetForce.direction,
      ctx
    });

    return ctx.answer('Recognized two-step net force and Newton’s second law problem: solving for mass.', [
      ...netForceStepLines(knownNetForce),
      'Use Newton’s second law: Fnet = m × a.',
      'Solve for mass: m = Fnet / a.',
      `m = ${ctx.cleanNumber(knownNetForce.value)} N / ${ctx.cleanNumber(acceleration.value)} m/s²`,
      `m = ${ctx.cleanNumber(value)} kg`,
      `The mass is ${ctx.cleanNumber(value)} kg.`
    ], formulaWork);
  }

  if (target === 'force' && mass && acceleration) {
    const massKg = ctx.massToKg(mass);
    const value = massKg * acceleration.value;
    if (!numbersClose(value, knownNetForce.value)) return null;

    const formulaWork = buildTwoStepFormulaWork({
      solveFor: 'force',
      forceValue: value,
      massValue: massKg,
      accelerationValue: acceleration.value,
      direction: knownNetForce.direction,
      ctx
    });

    return ctx.answer('Recognized two-step net force and Newton’s second law problem: solving for force.', [
      ...netForceStepLines(knownNetForce),
      'Use Newton’s second law: Fnet = m × a.',
      `Fnet = ${ctx.cleanNumber(massKg)} kg × ${ctx.cleanNumber(acceleration.value)} m/s²`,
      `Fnet = ${ctx.cleanNumber(value)} N`,
      finalForceLine(value, knownNetForce.direction, ctx)
    ], formulaWork);
  }

  return null;
}

function newtonTarget(lower, ctx) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+|its\s+)?(?:acceleration|accelerashun|acelerashun|aceleration|accretion|a)\b/.test(lower)) {
    return 'acceleration';
  }
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+|its\s+)?(?:mass|m)\b/.test(lower)) {
    return 'mass';
  }
  if (ctx.asksForForce(lower)) {
    return 'force';
  }
  return null;
}

function netForceFromResult(result) {
  const work = result && result.formulaWork;
  const netForce = work && work.variables && work.variables.netForce;
  if (!netForce || !Number.isFinite(netForce.value)) return null;

  return {
    value: netForce.value,
    direction: directionFromNetForceDisplay(netForce.display),
    display: netForce.display,
    lines: String(result.answer || '').split('\n').filter(Boolean)
  };
}

function directionFromNetForceDisplay(display) {
  const match = /^\s*-?\d+(?:\.\d+)?\s*N\s+(.+?)\s*$/.exec(String(display || ''));
  return match ? match[1] : '';
}

function looksBalancedWithoutNumbers(lower) {
  return /\bbalanced\s+forces?\b/.test(lower) || /\bforces?\s+are\s+balanced\b/.test(lower);
}

function netForceStepLines(netForce) {
  const lines = ['First find the net force.'];
  const workLine = netForce.lines.find((line) => /=/.test(line) && /\bN\b/.test(line));
  if (workLine && !/^net force\s*=/i.test(workLine)) lines.push(workLine);
  lines.push(`Net force = ${netForce.display}.`);
  return lines;
}

function finalAccelerationLine(value, direction, ctx) {
  const display = `${ctx.cleanNumber(value)} m/s²`;
  if (!direction) return `The acceleration is ${display}.`;
  return `The acceleration is ${display} ${direction}.`;
}

function finalForceLine(value, direction, ctx) {
  const display = `${ctx.cleanNumber(value)} N`;
  if (!direction) return `The net force is ${display}.`;
  return `The net force is ${display} ${direction}.`;
}

function numbersClose(left, right) {
  return Math.abs(left - right) < 1e-9;
}

function buildTwoStepFormulaWork({ solveFor, forceValue, massValue, accelerationValue, direction, ctx }) {
  const formulaWork = buildForceFormulaWork({
    solveFor,
    forceValue,
    massValue,
    accelerationValue,
    ctx,
    includeSteps: false
  });

  formulaWork.formulaId = 'net_force_newton_second_law';
  formulaWork.family = 'forces';
  formulaWork.formula = solveFor === 'mass' ? 'm = Fnet / a' : solveFor === 'force' ? 'Fnet = m × a' : 'a = Fnet / m';
  formulaWork.variables.force.symbol = 'Fnet';
  if (direction) {
    formulaWork.variables.force.display = `${ctx.cleanNumber(forceValue)} N ${direction}`;
  }
  if (solveFor === 'force' && direction) {
    formulaWork.finalAnswer.display = `${ctx.cleanNumber(forceValue)} N ${direction}`;
  }
  if (solveFor === 'acceleration' && direction) {
    formulaWork.finalAnswer.display = `${ctx.cleanNumber(accelerationValue)} m/s² ${direction}`;
  }

  return formulaWork;
}

module.exports = { tryNetForceNewton };
