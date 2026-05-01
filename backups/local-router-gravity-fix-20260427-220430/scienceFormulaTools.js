function tryScienceFormula(message) {
  const text = normalizeNumberWords(String(message || ''));
  const lower = text.toLowerCase();

  return tryAccelerationFromVelocity(text, lower) ||
    tryWaves(text, lower) ||
    tryMomentum(text, lower) ||
    tryKineticEnergy(text, lower) ||
    tryPotentialEnergy(text, lower) ||
    tryElectricalPower(text, lower) ||
    tryWorkPowerTime(text, lower) ||
    tryOhmsLaw(text, lower) ||
    tryMotion(text, lower) ||
    tryDensity(text, lower) ||
    tryForce(text, lower) ||
    tryWeight(text, lower) ||
    null;
}

// ---------------- Motion: distance = speed × time ----------------
function tryMotion(text, lower) {
  const speed = findNumberWithUnit(text, SPEED_UNITS);
  const masked = speed ? mask(text, speed.start, speed.end) : text;
  const distance = findQuantity(masked, ['distance'], DISTANCE_UNITS, null);
  const time = findQuantity(masked, ['time'], TIME_UNITS, null);
  const target = motionTarget(lower, { speed, distance, time });

  if (target === 'distance' && speed && time) {
    const timeInRateUnit = convertTime(time.value, time.unit, speed.perTimeUnit);
    if (timeInRateUnit == null) return null;
    const value = speed.value * timeInRateUnit;
    return answer('Recognized motion problem: solving for distance using speed and time.', [
      'Use the motion formula: distance = speed × time.',
      `distance = ${cleanNumber(speed.value)} ${speed.unit} × ${cleanNumber(timeInRateUnit)} ${speed.perTimeUnit}`,
      `distance = ${cleanNumber(value)} ${plural(speed.distanceUnit, value)}`
    ]);
  }

  if (target === 'speed' && distance && time && time.value !== 0) {
    const value = distance.value / time.value;
    return answer('Recognized motion problem: solving for speed using distance and time.', [
      'Use the motion formula: speed = distance / time.',
      `speed = ${cleanNumber(distance.value)} ${plural(distance.unit, distance.value)} / ${cleanNumber(time.value)} ${time.unit}`,
      `speed = ${cleanNumber(value)} ${distance.unit}/${time.unit}`
    ]);
  }

  if (target === 'time' && distance && speed && speed.value !== 0) {
    const distanceInRateUnit = convertDistance(distance.value, distance.unit, speed.distanceUnit);
    if (distanceInRateUnit == null) return null;
    const value = distanceInRateUnit / speed.value;
    return answer('Recognized motion problem: solving for time using distance and speed.', [
      'Use the motion formula: time = distance / speed.',
      `time = ${cleanNumber(distanceInRateUnit)} ${plural(speed.distanceUnit, distanceInRateUnit)} / ${cleanNumber(speed.value)} ${speed.unit}`,
      `time = ${cleanNumber(value)} ${speed.perTimeUnit}`
    ]);
  }

  return null;
}

function motionTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?speed\b/.test(lower) || /\bhow fast\b/.test(lower)) return 'speed';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?velocity\b/.test(lower)) return 'speed';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?time\b/.test(lower) || /\bhow long\b/.test(lower)) return 'time';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:my\s+|the\s+)?distance\b/.test(lower) || /\bhow far\b/.test(lower) || /\bhow many\s+(miles|kilometers|meters|feet)\b/.test(lower)) return 'distance';

  if (values.speed && values.time && !values.distance) return 'distance';
  if (values.distance && values.time && !values.speed) return 'speed';
  if (values.distance && values.speed && !values.time) return 'time';
  return null;
}

// ---------------- Density: D = m / V ----------------
function tryDensity(text, lower) {
  if (!/\b(density|mass|volume)\b|\bd\s*=|\bm\s*=|\bv\s*=/.test(lower)) return null;

  const density = findQuantity(text, ['density'], DENSITY_UNITS, null);
  const mass = findQuantity(text, ['mass'], MASS_UNITS, null);
  const volume = findQuantity(text, ['volume'], VOLUME_UNITS, null);
  const target = targetFromQuestion(lower, ['density', 'mass', 'volume'], { density, mass, volume });

  if (target === 'density' && mass && volume && volume.value !== 0) {
    const m = massToGrams(mass);
    const v = volumeToML(volume);
    const value = m / v;
    return answer('Recognized density problem: solving for density.', [
      'Use the density formula: D = m / V.',
      `D = ${cleanNumber(m)} g / ${cleanNumber(v)} mL`,
      `D = ${cleanNumber(value)} g/mL`
    ]);
  }

  if (target === 'mass' && density && volume) {
    const v = volumeToML(volume);
    const value = density.value * v;
    return answer('Recognized density problem: solving for mass.', [
      'Use the density formula: mass = density × volume.',
      `m = ${cleanNumber(density.value)} g/mL × ${cleanNumber(v)} mL`,
      `m = ${cleanNumber(value)} g`
    ]);
  }

  if (target === 'volume' && mass && density && density.value !== 0) {
    const m = massToGrams(mass);
    const value = m / density.value;
    return answer('Recognized density problem: solving for volume.', [
      'Use the density formula: volume = mass / density.',
      `V = ${cleanNumber(m)} g / ${cleanNumber(density.value)} g/mL`,
      `V = ${cleanNumber(value)} mL`
    ]);
  }

  return null;
}

// ---------------- Force: F = m × a ----------------
function tryForce(text, lower) {
  if (!(/\b(force|net force|newton|newtons|newton's second law)\b|\bf\s*=/.test(lower) || (/\bmass\b/.test(lower) && /\bacceleration\b/.test(lower)))) return null;

  const force = findQuantity(text, ['net force', 'force', 'f'], FORCE_UNITS, null);
  const mass = findQuantity(text, ['mass', 'm'], MASS_UNITS, null);
  const acceleration = findQuantity(text, ['acceleration', 'a'], ACCEL_UNITS, null);
  const target = forceTarget(lower, { force, mass, acceleration });

  if (target === 'force' && mass && acceleration) {
    const m = massToKg(mass);
    const value = m * acceleration.value;
    return answer('Recognized Newton’s second law problem: solving for force.', [
      'Use Newton’s second law: F = m × a.',
      `F = ${cleanNumber(m)} kg × ${cleanNumber(acceleration.value)} m/s²`,
      `F = ${cleanNumber(value)} N`
    ]);
  }

  if (target === 'mass' && force && acceleration && acceleration.value !== 0) {
    const value = force.value / acceleration.value;
    return answer('Recognized Newton’s second law problem: solving for mass.', [
      'Use Newton’s second law: mass = force / acceleration.',
      `m = ${cleanNumber(force.value)} N / ${cleanNumber(acceleration.value)} m/s²`,
      `m = ${cleanNumber(value)} kg`
    ]);
  }

  if (target === 'acceleration' && force && mass) {
    const m = massToKg(mass);
    if (m === 0) return null;
    const value = force.value / m;
    return answer('Recognized Newton’s second law problem: solving for acceleration.', [
      'Use Newton’s second law: acceleration = force / mass.',
      `a = ${cleanNumber(force.value)} N / ${cleanNumber(m)} kg`,
      `a = ${cleanNumber(value)} m/s²`
    ]);
  }

  return null;
}

function forceTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(force|net force|f)\b/.test(lower)) return 'force';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(mass|m)\b/.test(lower)) return 'mass';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(acceleration|a)\b/.test(lower)) return 'acceleration';

  if (values.mass && values.acceleration && !values.force) return 'force';
  if (values.force && values.acceleration && !values.mass) return 'mass';
  if (values.force && values.mass && !values.acceleration) return 'acceleration';
  return null;
}

// ---------------- Weight: Fg = m × g ----------------
function tryWeight(text, lower) {
  if (!/\b(weight|force of gravity|weigh)\b/.test(lower)) return null;
  const mass = findQuantity(text, ['mass'], MASS_UNITS, null);
  if (!mass) return null;
  const gravity = findQuantity(text, ['gravity'], ACCEL_UNITS, null) || { value: 9.8 };
  const m = massToKg(mass);
  const value = m * gravity.value;
  return answer('Recognized weight problem.', [
    'Use the weight formula: Fg = m × g.',
    gravity.value === 9.8 ? 'For Earth, use g = 9.8 m/s^2.' : `g = ${cleanNumber(gravity.value)} m/s^2`,
    `Fg = ${cleanNumber(m)} kg × ${cleanNumber(gravity.value)} m/s^2`,
    `Fg = ${cleanNumber(value)} N`
  ]);
}

// ---------------- Acceleration: a = (vf - vi) / t ----------------
function tryAccelerationFromVelocity(text, lower) {
  if (!/\b(acceleration|initial velocity|starting velocity|final velocity|ending velocity|velocity|vf|vi|from)\b/.test(lower)) return null;

  const fromTo = findVelocityChangeFromTo(text);

  // If the student says "from 10 m/s to 30 m/s in 5 seconds",
  // trust that pattern first. Do not let the generic parser reuse 10 m/s twice.
  const vi = (fromTo && fromTo.vi) || findQuantity(text, ['initial velocity', 'starting velocity', 'start velocity', 'vi'], VELOCITY_UNITS, null);
  const vf = (fromTo && fromTo.vf) || findQuantity(text, ['final velocity', 'ending velocity', 'end velocity', 'vf'], VELOCITY_UNITS, null);
  const acceleration = findQuantity(text, ['acceleration', 'a'], ACCEL_UNITS, null);
  const time = (fromTo && fromTo.time) || findQuantity(text, ['time', 't'], TIME_UNITS, null);
  const target = accelerationTarget(lower, { acceleration, vi, vf, time });

  if (target === 'acceleration' && vi && vf && time && time.value !== 0) {
    const viMS = velocityToMS(vi);
    const vfMS = velocityToMS(vf);
    const tS = convertTime(time.value, time.unit, 's');
    if (viMS == null || vfMS == null || tS == null || tS === 0) return null;
    const value = (vfMS - viMS) / tS;
    return answer('Recognized acceleration problem: solving from final velocity, initial velocity, and time.', [
      'Use the acceleration formula: a = (vf - vi) / t.',
      `a = (${cleanNumber(vfMS)} m/s - ${cleanNumber(viMS)} m/s) / ${cleanNumber(tS)} s`,
      `a = ${cleanNumber(value)} m/s²`
    ]);
  }

  if (target === 'final velocity' && vi && acceleration && time) {
    const viMS = velocityToMS(vi);
    const tS = convertTime(time.value, time.unit, 's');
    if (viMS == null || tS == null) return null;
    const value = viMS + acceleration.value * tS;
    return answer('Recognized acceleration problem: solving for final velocity.', [
      'Use the formula: vf = vi + a × t.',
      `vf = ${cleanNumber(viMS)} m/s + ${cleanNumber(acceleration.value)} m/s² × ${cleanNumber(tS)} s`,
      `vf = ${cleanNumber(value)} m/s`
    ]);
  }

  if (target === 'initial velocity' && vf && acceleration && time) {
    const vfMS = velocityToMS(vf);
    const tS = convertTime(time.value, time.unit, 's');
    if (vfMS == null || tS == null) return null;
    const value = vfMS - acceleration.value * tS;
    return answer('Recognized acceleration problem: solving for initial velocity.', [
      'Use the formula: vi = vf - a × t.',
      `vi = ${cleanNumber(vfMS)} m/s - ${cleanNumber(acceleration.value)} m/s² × ${cleanNumber(tS)} s`,
      `vi = ${cleanNumber(value)} m/s`
    ]);
  }

  if (target === 'time' && vi && vf && acceleration && acceleration.value !== 0) {
    const viMS = velocityToMS(vi);
    const vfMS = velocityToMS(vf);
    if (viMS == null || vfMS == null) return null;
    const value = (vfMS - viMS) / acceleration.value;
    return answer('Recognized acceleration problem: solving for time.', [
      'Use the formula: time = (vf - vi) / acceleration.',
      `t = (${cleanNumber(vfMS)} m/s - ${cleanNumber(viMS)} m/s) / ${cleanNumber(acceleration.value)} m/s²`,
      `t = ${cleanNumber(value)} s`
    ]);
  }

  return null;
}

function accelerationTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(acceleration|a)\b/.test(lower)) return 'acceleration';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(final velocity|ending velocity|end velocity|vf)\b/.test(lower)) return 'final velocity';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(initial velocity|starting velocity|start velocity|vi)\b/.test(lower)) return 'initial velocity';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(time|t)\b/.test(lower) || /\bhow long\b/.test(lower)) return 'time';

  if (values.vi && values.vf && values.time && !values.acceleration) return 'acceleration';
  if (values.vi && values.acceleration && values.time && !values.vf) return 'final velocity';
  if (values.vf && values.acceleration && values.time && !values.vi) return 'initial velocity';
  if (values.vi && values.vf && values.acceleration && !values.time) return 'time';
  return null;
}

// ---------------- Momentum: p = m × v ----------------
function tryMomentum(text, lower) {
  if (!/\b(momentum|p\s*=)\b/.test(lower)) return null;
  const momentum = findQuantity(text, ['momentum'], MOMENTUM_UNITS, null);
  const mass = findQuantity(text, ['mass'], MASS_UNITS, null);
  const velocity = findQuantity(text, ['velocity', 'speed'], VELOCITY_UNITS, null);
  const target = targetFromQuestion(lower, ['momentum', 'mass', 'velocity'], { momentum, mass, velocity });

  if (target === 'momentum' && mass && velocity) {
    const m = massToKg(mass);
    const v = velocityToMS(velocity);
    if (v == null) return null;
    const value = m * v;
    return answer('Recognized momentum problem: solving for momentum.', [
      'Use the momentum formula: p = m × v.',
      `p = ${cleanNumber(m)} kg × ${cleanNumber(v)} m/s`,
      `p = ${cleanNumber(value)} kg·m/s`
    ]);
  }

  if (target === 'mass' && momentum && velocity) {
    const v = velocityToMS(velocity);
    if (v == null || v === 0) return null;
    const value = momentum.value / v;
    return answer('Recognized momentum problem: solving for mass.', [
      'Use the momentum formula: mass = momentum / velocity.',
      `m = ${cleanNumber(momentum.value)} kg·m/s / ${cleanNumber(v)} m/s`,
      `m = ${cleanNumber(value)} kg`
    ]);
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


// ---------------- Ohm's Law: V = I × R ----------------
function tryOhmsLaw(text, lower) {
  if (!/\b(voltage|volt|volts|current|amp|amps|amperes|ampere|resistance|ohm|ohms|ohm's law)\b|\bv\s*=|\bi\s*=|\br\s*=/.test(lower)) return null;

  const voltage = findQuantity(text, ['voltage', 'volts', 'volt', 'v'], VOLTAGE_UNITS, null);
  const current = findQuantity(text, ['current', 'amps', 'amp', 'amperes', 'ampere', 'i'], CURRENT_UNITS, null);
  const resistance = findQuantity(text, ['resistance', 'ohms', 'ohm', 'r'], RESISTANCE_UNITS, null);
  const target = ohmsTarget(lower, { voltage, current, resistance });

  if (target === 'voltage' && current && resistance) {
    const value = current.value * resistance.value;
    return answer('Recognized Ohm’s law problem: solving for voltage.', [
      'Use Ohm’s law: V = I × R.',
      `V = ${cleanNumber(current.value)} A × ${cleanNumber(resistance.value)} Ω`,
      `V = ${cleanNumber(value)} V`
    ]);
  }

  if (target === 'current' && voltage && resistance && resistance.value !== 0) {
    const value = voltage.value / resistance.value;
    return answer('Recognized Ohm’s law problem: solving for current.', [
      'Use Ohm’s law: I = V / R.',
      `I = ${cleanNumber(voltage.value)} V / ${cleanNumber(resistance.value)} Ω`,
      `I = ${cleanNumber(value)} A`
    ]);
  }

  if (target === 'resistance' && voltage && current && current.value !== 0) {
    const value = voltage.value / current.value;
    return answer('Recognized Ohm’s law problem: solving for resistance.', [
      'Use Ohm’s law: R = V / I.',
      `R = ${cleanNumber(voltage.value)} V / ${cleanNumber(current.value)} A`,
      `R = ${cleanNumber(value)} Ω`
    ]);
  }

  return null;
}

function ohmsTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(voltage|volt|volts|v)\b/.test(lower) || /\bhow many volts\b/.test(lower)) return 'voltage';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(current|amps|amp|amperes|ampere|i)\b/.test(lower) || /\bhow many amps\b/.test(lower)) return 'current';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(resistance|ohms|ohm|r)\b/.test(lower) || /\bhow many ohms\b/.test(lower)) return 'resistance';

  if (values.current && values.resistance && !values.voltage) return 'voltage';
  if (values.voltage && values.resistance && !values.current) return 'current';
  if (values.voltage && values.current && !values.resistance) return 'resistance';
  return null;
}

// ---------------- Electrical Power: P = V × I ----------------
function tryElectricalPower(text, lower) {
  if (!/\b(power|watt|watts|voltage|volt|volts|current|amp|amps|amperes|ampere)\b|\bp\s*=|\bv\s*=|\bi\s*=/.test(lower)) return null;

  const power = findQuantity(text, ['power', 'watts', 'watt', 'p'], POWER_UNITS, null);
  const voltage = findQuantity(text, ['voltage', 'volts', 'volt', 'v'], VOLTAGE_UNITS, null);
  const current = findQuantity(text, ['current', 'amps', 'amp', 'amperes', 'ampere', 'i'], CURRENT_UNITS, null);
  const target = electricalPowerTarget(lower, { power, voltage, current });

  if (target === 'power' && voltage && current) {
    const value = voltage.value * current.value;
    return answer('Recognized electrical power problem: solving for power.', [
      'Use the electrical power formula: P = V × I.',
      `P = ${cleanNumber(voltage.value)} V × ${cleanNumber(current.value)} A`,
      `P = ${cleanNumber(value)} W`
    ]);
  }

  if (target === 'voltage' && power && current && current.value !== 0) {
    const value = power.value / current.value;
    return answer('Recognized electrical power problem: solving for voltage.', [
      'Use the electrical power formula: V = P / I.',
      `V = ${cleanNumber(power.value)} W / ${cleanNumber(current.value)} A`,
      `V = ${cleanNumber(value)} V`
    ]);
  }

  if (target === 'current' && power && voltage && voltage.value !== 0) {
    const value = power.value / voltage.value;
    return answer('Recognized electrical power problem: solving for current.', [
      'Use the electrical power formula: I = P / V.',
      `I = ${cleanNumber(power.value)} W / ${cleanNumber(voltage.value)} V`,
      `I = ${cleanNumber(value)} A`
    ]);
  }

  return null;
}

function electricalPowerTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(power|watts|watt|p)\b/.test(lower) || /\bhow many watts\b/.test(lower)) return 'power';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(voltage|volt|volts|v)\b/.test(lower) || /\bhow many volts\b/.test(lower)) return 'voltage';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(current|amps|amp|amperes|ampere|i)\b/.test(lower) || /\bhow many amps\b/.test(lower)) return 'current';

  if (values.voltage && values.current && !values.power) return 'power';
  if (values.power && values.current && !values.voltage) return 'voltage';
  if (values.power && values.voltage && !values.current) return 'current';
  return null;
}

// ---------------- Work, Power, Time: P = W / t ----------------
function tryWorkPowerTime(text, lower) {
  if (!/\b(work|energy|joule|joules|power|watt|watts|time)\b|\bp\s*=|\bw\s*=|\bt\s*=/.test(lower)) return null;

  const work = findQuantity(text, ['work', 'energy', 'joules', 'joule', 'w'], ENERGY_UNITS, null);
  const power = findQuantity(text, ['power', 'watts', 'watt', 'p'], POWER_UNITS, null);
  const time = findQuantity(text, ['time', 't'], TIME_UNITS, null);
  const target = workPowerTimeTarget(lower, { work, power, time });

  if (target === 'power' && work && time) {
    const seconds = convertTime(time.value, time.unit, 's');
    if (seconds == null || seconds === 0) return null;
    const value = work.value / seconds;
    return answer('Recognized work, power, and time problem: solving for power.', [
      'Use the power formula: P = W / t.',
      `P = ${cleanNumber(work.value)} J / ${cleanNumber(seconds)} s`,
      `P = ${cleanNumber(value)} W`
    ]);
  }

  if (target === 'work' && power && time) {
    const seconds = convertTime(time.value, time.unit, 's');
    if (seconds == null) return null;
    const value = power.value * seconds;
    return answer('Recognized work, power, and time problem: solving for work.', [
      'Use the power formula: W = P × t.',
      `W = ${cleanNumber(power.value)} W × ${cleanNumber(seconds)} s`,
      `W = ${cleanNumber(value)} J`
    ]);
  }

  if (target === 'time' && work && power && power.value !== 0) {
    const value = work.value / power.value;
    return answer('Recognized work, power, and time problem: solving for time.', [
      'Use the power formula: t = W / P.',
      `t = ${cleanNumber(work.value)} J / ${cleanNumber(power.value)} W`,
      `t = ${cleanNumber(value)} s`
    ]);
  }

  return null;
}

function workPowerTimeTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(power|watts|watt|p)\b/.test(lower) || /\bhow many watts\b/.test(lower)) return 'power';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(work|energy|joules|joule|w)\b/.test(lower) || /\bhow many joules\b/.test(lower)) return 'work';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(time|t)\b/.test(lower) || /\bhow long\b/.test(lower)) return 'time';

  if (values.work && values.time && !values.power) return 'power';
  if (values.power && values.time && !values.work) return 'work';
  if (values.work && values.power && !values.time) return 'time';
  return null;
}

// ---------------- Waves: wave speed = frequency × wavelength ----------------
function tryWaves(text, lower) {
  if (!/\b(wave|waves|frequency|hertz|hz|wavelength|lambda)\b/.test(lower)) return null;

  const waveSpeed = findQuantity(text, ['wave speed', 'speed', 'velocity'], SPEED_UNITS, null);
  const maskedText = waveSpeed ? mask(text, waveSpeed.start, waveSpeed.end) : text;
  const frequency = findQuantity(maskedText, ['frequency', 'freq', 'f'], FREQUENCY_UNITS, null);
  const wavelength = findQuantity(maskedText, ['wavelength', 'wave length', 'lambda'], DISTANCE_UNITS, null);
  const target = wavesTarget(lower, { waveSpeed, frequency, wavelength });

  if (target === 'wave speed' && frequency && wavelength) {
    const meters = convertDistance(wavelength.value, wavelength.unit, 'm');
    if (meters == null) return null;
    const value = frequency.value * meters;
    return answer('Recognized wave problem: solving for wave speed.', [
      'Use the wave formula: wave speed = frequency × wavelength.',
      `wave speed = ${cleanNumber(frequency.value)} Hz × ${cleanNumber(meters)} m`,
      `wave speed = ${cleanNumber(value)} m/s`
    ]);
  }

  if (target === 'frequency' && waveSpeed && wavelength) {
    const speed = velocityToMS(waveSpeed);
    const meters = convertDistance(wavelength.value, wavelength.unit, 'm');
    if (speed == null || meters == null || meters === 0) return null;
    const value = speed / meters;
    return answer('Recognized wave problem: solving for frequency.', [
      'Use the wave formula: frequency = wave speed / wavelength.',
      `frequency = ${cleanNumber(speed)} m/s / ${cleanNumber(meters)} m`,
      `frequency = ${cleanNumber(value)} Hz`
    ]);
  }

  if (target === 'wavelength' && waveSpeed && frequency && frequency.value !== 0) {
    const speed = velocityToMS(waveSpeed);
    if (speed == null) return null;
    const value = speed / frequency.value;
    return answer('Recognized wave problem: solving for wavelength.', [
      'Use the wave formula: wavelength = wave speed / frequency.',
      `wavelength = ${cleanNumber(speed)} m/s / ${cleanNumber(frequency.value)} Hz`,
      `wavelength = ${cleanNumber(value)} m`
    ]);
  }

  return null;
}

function wavesTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(wave speed|speed|velocity)\b/.test(lower) || /\bhow fast\b/.test(lower)) return 'wave speed';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(frequency|freq|f)\b/.test(lower) || /\bhow many hertz\b/.test(lower)) return 'frequency';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(wavelength|wave length|lambda)\b/.test(lower)) return 'wavelength';

  if (values.frequency && values.wavelength && !values.waveSpeed) return 'wave speed';
  if (values.waveSpeed && values.wavelength && !values.frequency) return 'frequency';
  if (values.waveSpeed && values.frequency && !values.wavelength) return 'wavelength';
  return null;
}



// ---------------- Kinetic Energy: KE = 1/2 × m × v² ----------------
function tryKineticEnergy(text, lower) {
  if (/\b(momentum|kg\s*[·*x-]?\s*m\/s|kgm\/s|p\s*=)\b/.test(lower)) return null;
  if (!/\b(kinetic energy|ke|energy|joule|joules|mass|velocity|speed)\b/.test(lower)) return null;

  const kineticEnergy = findQuantity(text, ['kinetic energy', 'energy', 'ke'], ENERGY_UNITS, null);
  const mass = findQuantity(text, ['mass', 'm'], MASS_UNITS, null);
  const velocity = findQuantity(text, ['velocity', 'speed', 'v'], VELOCITY_UNITS, null);
  const target = kineticEnergyTarget(lower, { kineticEnergy, mass, velocity });

  if (target === 'kinetic energy' && mass && velocity) {
    const m = massToKg(mass);
    const v = velocityToMS(velocity);
    if (v == null) return null;
    const value = 0.5 * m * v * v;
    return answer('Recognized kinetic energy problem: solving for kinetic energy.', [
      'Use the kinetic energy formula: KE = 1/2 × m × v².',
      `KE = 1/2 × ${cleanNumber(m)} kg × ${cleanNumber(v)}²`,
      `KE = ${cleanNumber(value)} J`
    ]);
  }

  if (target === 'mass' && kineticEnergy && velocity) {
    const v = velocityToMS(velocity);
    if (v == null || v === 0) return null;
    const value = (2 * kineticEnergy.value) / (v * v);
    return answer('Recognized kinetic energy problem: solving for mass.', [
      'Use the kinetic energy formula: mass = 2 × KE / v².',
      `m = 2 × ${cleanNumber(kineticEnergy.value)} J / ${cleanNumber(v)}²`,
      `m = ${cleanNumber(value)} kg`
    ]);
  }

  if (target === 'velocity' && kineticEnergy && mass) {
    const m = massToKg(mass);
    if (m === 0) return null;
    const value = Math.sqrt((2 * kineticEnergy.value) / m);
    return answer('Recognized kinetic energy problem: solving for velocity.', [
      'Use the kinetic energy formula: velocity = square root of (2 × KE / mass).',
      `v = √(2 × ${cleanNumber(kineticEnergy.value)} J / ${cleanNumber(m)} kg)`,
      `v = ${cleanNumber(value)} m/s`
    ]);
  }

  return null;
}

function kineticEnergyTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(kinetic energy|ke|energy)\b/.test(lower)) return 'kinetic energy';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(mass|m)\b/.test(lower)) return 'mass';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(velocity|speed|v)\b/.test(lower)) return 'velocity';

  if (values.mass && values.velocity && !values.kineticEnergy) return 'kinetic energy';
  if (values.kineticEnergy && values.velocity && !values.mass) return 'mass';
  if (values.kineticEnergy && values.mass && !values.velocity) return 'velocity';
  return null;
}

// ---------------- Potential Energy: PE = m × g × h or PE = force × height ----------------
function tryPotentialEnergy(text, lower) {
  if (!/\b(potential energy|gravitational potential energy|pe|height|force|weight|gravity|mass|joule|joules)\b/.test(lower)) return null;

  const potentialEnergy = findQuantity(text, ['gravitational potential energy', 'potential energy', 'energy', 'pe'], ENERGY_UNITS, null);
  const mass = findQuantity(text, ['mass', 'm'], MASS_UNITS, null);
  const force = findQuantity(text, ['force', 'weight', 'f'], FORCE_UNITS, null);
  const height = findQuantity(text, ['height', 'h'], DISTANCE_UNITS, null);
  const gravity = findQuantity(text, ['gravity', 'g'], ACCEL_UNITS, null) || { value: 9.8, unit: 'm/s^2', isDefault: true };
  const target = potentialEnergyTarget(lower, { potentialEnergy, mass, force, height, gravity });

  if (target === 'potential energy' && force && height) {
    const h = convertDistance(height.value, height.unit, 'm');
    if (h == null) return null;
    const value = force.value * h;
    return answer('Recognized potential energy problem: solving for potential energy using force and height.', [
      'Use the potential energy formula: PE = force × height.',
      `PE = ${cleanNumber(force.value)} N × ${cleanNumber(h)} m`,
      `PE = ${cleanNumber(value)} J`
    ]);
  }

  if (target === 'potential energy' && mass && height) {
    const m = massToKg(mass);
    const h = convertDistance(height.value, height.unit, 'm');
    if (h == null) return null;
    const value = m * gravity.value * h;
    return answer('Recognized potential energy problem: solving for potential energy using mass, gravity, and height.', [
      'Use the potential energy formula: PE = m × g × h.',
      gravity.isDefault ? 'For Earth, use g = 9.8 m/s².' : `g = ${cleanNumber(gravity.value)} m/s²`,
      `PE = ${cleanNumber(m)} kg × ${cleanNumber(gravity.value)} m/s² × ${cleanNumber(h)} m`,
      `PE = ${cleanNumber(value)} J`
    ]);
  }

  if (target === 'mass' && potentialEnergy && height) {
    const h = convertDistance(height.value, height.unit, 'm');
    if (h == null || h === 0 || gravity.value === 0) return null;
    const value = potentialEnergy.value / (gravity.value * h);
    return answer('Recognized potential energy problem: solving for mass.', [
      'Use the potential energy formula: mass = PE / (gravity × height).',
      gravity.isDefault ? 'For Earth, use g = 9.8 m/s².' : `g = ${cleanNumber(gravity.value)} m/s²`,
      `m = ${cleanNumber(potentialEnergy.value)} J / (${cleanNumber(gravity.value)} m/s² × ${cleanNumber(h)} m)`,
      `m = ${cleanNumber(value)} kg`
    ]);
  }

  if (target === 'force' && potentialEnergy && height) {
    const h = convertDistance(height.value, height.unit, 'm');
    if (h == null || h === 0) return null;
    const value = potentialEnergy.value / h;
    return answer('Recognized potential energy problem: solving for force/weight.', [
      'Use the potential energy formula: force = PE / height.',
      `force = ${cleanNumber(potentialEnergy.value)} J / ${cleanNumber(h)} m`,
      `force = ${cleanNumber(value)} N`
    ]);
  }

  if (target === 'height' && potentialEnergy && force) {
    if (force.value === 0) return null;
    const value = potentialEnergy.value / force.value;
    return answer('Recognized potential energy problem: solving for height using force.', [
      'Use the potential energy formula: height = PE / force.',
      `height = ${cleanNumber(potentialEnergy.value)} J / ${cleanNumber(force.value)} N`,
      `height = ${cleanNumber(value)} m`
    ]);
  }

  if (target === 'height' && potentialEnergy && mass) {
    const m = massToKg(mass);
    if (m === 0 || gravity.value === 0) return null;
    const value = potentialEnergy.value / (m * gravity.value);
    return answer('Recognized potential energy problem: solving for height using mass and gravity.', [
      'Use the potential energy formula: height = PE / (mass × gravity).',
      gravity.isDefault ? 'For Earth, use g = 9.8 m/s².' : `g = ${cleanNumber(gravity.value)} m/s²`,
      `height = ${cleanNumber(potentialEnergy.value)} J / (${cleanNumber(m)} kg × ${cleanNumber(gravity.value)} m/s²)`,
      `height = ${cleanNumber(value)} m`
    ]);
  }

  if (target === 'gravity' && potentialEnergy && mass && height) {
    const m = massToKg(mass);
    const h = convertDistance(height.value, height.unit, 'm');
    if (m === 0 || h == null || h === 0) return null;
    const value = potentialEnergy.value / (m * h);
    return answer('Recognized potential energy problem: solving for gravity.', [
      'Use the potential energy formula: gravity = PE / (mass × height).',
      `g = ${cleanNumber(potentialEnergy.value)} J / (${cleanNumber(m)} kg × ${cleanNumber(h)} m)`,
      `g = ${cleanNumber(value)} m/s²`
    ]);
  }

  return null;
}

function potentialEnergyTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(potential energy|gravitational potential energy|pe|energy)\b/.test(lower)) return 'potential energy';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(mass|m)\b/.test(lower)) return 'mass';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(force|weight|f)\b/.test(lower)) return 'force';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(height|h)\b/.test(lower)) return 'height';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(gravity|g)\b/.test(lower)) return 'gravity';

  if ((values.mass || values.force) && values.height && !values.potentialEnergy) return 'potential energy';
  if (values.potentialEnergy && values.mass && !values.height) return 'height';
  if (values.potentialEnergy && values.force && !values.height) return 'height';
  return null;
}



function findVelocityChangeFromTo(text) {
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
  ].map(escapeRegex).sort((a, b) => b.length - a.length).join('|');

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
  ].map(escapeRegex).sort((a, b) => b.length - a.length).join('|');

  const pattern = new RegExp(
    `\\bfrom\\s+(${number})\\s*(${speedUnitPattern})\\s+to\\s+(${number})\\s*(${speedUnitPattern})(?:\\s+(?:in|over|during|for|after)\\s+(${number})\\s*(${timeUnitPattern}))?`,
    'i'
  );

  const match = pattern.exec(text);
  if (!match) return null;

  return {
    vi: quantityFromRawUnit(match[1], match[2], SPEED_UNITS),
    vf: quantityFromRawUnit(match[3], match[4], SPEED_UNITS),
    time: match[5] ? quantityFromRawUnit(match[5], match[6], TIME_UNITS) : null
  };
}

function quantityFromRawUnit(value, rawUnit, unitDefs) {
  const def = unitDefs.find((item) => item.names.some((name) => name.toLowerCase() === String(rawUnit).toLowerCase()) || item.canonical.toLowerCase() === String(rawUnit).toLowerCase());
  return {
    value: Number(value),
    unit: def ? def.canonical : rawUnit,
    distanceUnit: def ? def.distanceUnit : null,
    perTimeUnit: def ? def.perTimeUnit : null,
    start: 0,
    end: 0
  };
}

// ---------------- Shared parser ----------------
const SPEED_UNITS = [
  unit('mile/hr', 'mile', 'hr', ['miles per hour', 'mile per hour', 'mph', 'mi/hr', 'mi/h']),
  unit('km/hr', 'km', 'hr', ['kilometers per hour', 'kilometer per hour', 'km/hr', 'km/h', 'kph']),
  unit('m/s', 'm', 's', ['meters per second', 'meter per second', 'm/s']),
  unit('ft/s', 'ft', 's', ['feet per second', 'foot per second', 'ft/s'])
];
const VELOCITY_UNITS = SPEED_UNITS;
const DISTANCE_UNITS = [unit('mile', null, null, ['miles', 'mile', 'mi']), unit('km', null, null, ['kilometers', 'kilometer', 'km']), unit('m', null, null, ['meters', 'meter', 'm']), unit('ft', null, null, ['feet', 'foot', 'ft']), unit('cm', null, null, ['centimeters', 'centimeter', 'cm'])];
const TIME_UNITS = [unit('hr', null, null, ['hours', 'hour', 'hrs', 'hr']), unit('min', null, null, ['minutes', 'minute', 'mins', 'min']), unit('s', null, null, ['seconds', 'second', 'secs', 'sec', 's'])];
const MASS_UNITS = [unit('kg', null, null, ['kilograms', 'kilogram', 'kg']), unit('g', null, null, ['grams', 'gram', 'g'])];
const VOLUME_UNITS = [unit('mL', null, null, ['milliliters', 'milliliter', 'ml']), unit('L', null, null, ['liters', 'liter', 'l']), unit('cm^3', null, null, ['cm^3', 'cm3'])];
const FORCE_UNITS = [unit('N', null, null, ['newtons', 'newton', 'n'])];
const ACCEL_UNITS = [unit('m/s^2', null, null, ['meters per second squared', 'meter per second squared', 'm/s^2', 'm/s²', 'm/s/s'])];
const DENSITY_UNITS = [unit('g/mL', null, null, ['g/ml', 'g/mL', 'grams per milliliter', 'gram per milliliter', 'g/cm^3', 'g/cm3'])];
const MOMENTUM_UNITS = [unit('kg·m/s', null, null, ['kg*m/s', 'kg·m/s', 'kilogram meters per second', 'kilogram meter per second'])];
const VOLTAGE_UNITS = [unit('V', null, null, ['volts', 'volt', 'v'])];
const CURRENT_UNITS = [unit('A', null, null, ['amps', 'amp', 'amperes', 'ampere', 'a'])];
const RESISTANCE_UNITS = [unit('Ω', null, null, ['ohms', 'ohm', 'Ω'])];
const POWER_UNITS = [unit('W', null, null, ['watts', 'watt', 'w'])];
const ENERGY_UNITS = [unit('J', null, null, ['joules', 'joule', 'j'])];
const FREQUENCY_UNITS = [unit('Hz', null, null, ['hertz', 'hz'])];

function unit(canonical, distanceUnit, perTimeUnit, names) {
  return { canonical, distanceUnit, perTimeUnit, names };
}

function findQuantity(text, labels, unitDefs, defaultUnit) {
  const naturalLabels = labels.filter((label) => label.length > 1);
  const symbolLabels = labels.filter((label) => label.length === 1);
  const unitPattern = unitDefs.flatMap((def) => def.names).map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const number = '-?\\d+(?:\\.\\d+)?';

  if (naturalLabels.length) {
    const labelPattern = naturalLabels.map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
    let match = new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:is|=|:|of|as|equals?)?\\s*(${number})\\s*(${unitPattern})?`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);

    match = new RegExp(`(${number})\\s*(${unitPattern})?\\s*(?:of\\s+)?(?:${labelPattern})\\b`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);
  }

  if (symbolLabels.length) {
    const symbolPattern = symbolLabels.map(escapeRegex).join('|');
    const match = new RegExp(`\\b(?:${symbolPattern})\\b\\s*(?:=|:)\\s*(${number})\\s*(${unitPattern})?`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);
  }

  return findNumberWithUnit(text, unitDefs);
}

function findNumberWithUnit(text, unitDefs) {
  const unitPattern = unitDefs.flatMap((def) => def.names).map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const match = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})(?=$|[^A-Za-z0-9/²^])`, 'i').exec(text);
  if (!match) return null;
  return buildQuantity(match, unitDefs, null);
}

function buildQuantity(match, unitDefs, defaultUnit) {
  const rawUnit = match[2] || defaultUnit;
  const def = rawUnit ? unitDefs.find((item) => item.names.some((name) => name.toLowerCase() === String(rawUnit).toLowerCase()) || item.canonical.toLowerCase() === String(rawUnit).toLowerCase()) : null;
  const canonical = def ? def.canonical : rawUnit;
  return {
    value: Number(match[1]),
    unit: canonical,
    distanceUnit: def ? def.distanceUnit : null,
    perTimeUnit: def ? def.perTimeUnit : null,
    start: match.index,
    end: match.index + match[0].length
  };
}

function targetFromQuestion(lower, targets, values) {
  for (const target of targets) {
    const pattern = target.replace(/ /g, '\\s+');
    if (new RegExp(`\\b(what is|what's|find|calculate|solve for|determine)\\s+(?:the\\s+)?${pattern}\\b`).test(lower)) return target;
  }
  const present = Object.entries(values).filter(([, value]) => Boolean(value));
  const missing = Object.keys(values).filter((key) => !values[key]);
  if (present.length === 2 && missing.length === 1) return missing[0];
  return null;
}

function massToGrams(mass) {
  return mass.unit === 'kg' ? mass.value * 1000 : mass.value;
}

function massToKg(mass) {
  return mass.unit === 'g' ? mass.value / 1000 : mass.value;
}

function volumeToML(volume) {
  if (volume.unit === 'L') return volume.value * 1000;
  return volume.value;
}

function velocityToMS(velocity) {
  if (velocity.unit === 'm/s') return velocity.value;
  if (velocity.unit === 'mile/hr') return velocity.value * 0.44704;
  if (velocity.unit === 'km/hr') return velocity.value / 3.6;
  if (velocity.unit === 'ft/s') return velocity.value * 0.3048;
  return null;
}

function convertTime(value, fromUnit, toUnit) {
  const seconds = fromUnit === 'hr' ? value * 3600 : fromUnit === 'min' ? value * 60 : fromUnit === 's' ? value : null;
  if (seconds == null) return null;
  if (toUnit === 'hr') return seconds / 3600;
  if (toUnit === 'min') return seconds / 60;
  if (toUnit === 's') return seconds;
  return null;
}

function convertDistance(value, fromUnit, toUnit) {
  const meters = { m: 1, km: 1000, cm: 0.01, mile: 1609.344, ft: 0.3048 };
  if (!meters[fromUnit] || !meters[toUnit]) return null;
  return (value * meters[fromUnit]) / meters[toUnit];
}

function normalizeNumberWords(value) {
  const words = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20
  };
  let text = value;
  for (const [word, number] of Object.entries(words)) {
    text = text.replace(new RegExp(`\\b${word}\\b`, 'gi'), String(number));
  }
  return text;
}

function mask(text, start, end) {
  return text.slice(0, start) + ' '.repeat(Math.max(0, end - start)) + text.slice(end);
}

function answer(notes, lines) {
  return { notes, answer: lines.join('\n') };
}

function plural(unit, value) {
  if (unit === 'mile' && Math.abs(value) !== 1) return 'miles';
  return unit;
}

function cleanNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4))).replace(/\.0+$/, '');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { tryScienceFormula };
