const {
  DISTANCE_UNITS,
  FREQUENCY_UNITS,
  SPEED_UNITS,
  TIME_UNITS,
  convertDistance,
  convertTime,
  findQuantity,
  mask,
  parseQuantityNumber,
  velocityToMS
} = require('./formulaParser');
const { answer, cleanNumber } = require('./formulaAnswerFormatter');
const { buildFormulaWork } = require('./formulaWorkBuilder');

// ---------------- Waves: wave speed = frequency × wavelength ----------------
function tryWaves(text, lower) {
  if (!/\b(wave|waves|frequency|hertz|hz|wavelength|lambda)\b/.test(lower)) return null;

  const waveSpeed = findQuantity(text, ['wave speed', 'speed', 'velocity'], SPEED_UNITS, null);
  const maskedText = waveSpeed ? mask(text, waveSpeed.start, waveSpeed.end) : text;
  const frequency = findQuantity(maskedText, ['frequency', 'freq', 'f'], FREQUENCY_UNITS, null);
  const wavelength = findQuantity(maskedText, ['wavelength', 'wave length', 'lambda'], DISTANCE_UNITS, null);
  const period = findPeriodQuantity(text);
  const target = wavesTarget(lower, { waveSpeed, frequency, wavelength });

  if (asksForFrequencyAndPeriod(lower) && waveSpeed && wavelength) {
    const speed = velocityToMS(waveSpeed);
    const meters = convertDistance(wavelength.value, wavelength.unit, 'm');
    if (speed == null || meters == null || meters === 0) return null;
    const frequencyValue = speed / meters;
    const periodValue = 1 / frequencyValue;
    const formulaWork = buildFrequencyPeriodFormulaWork({
      waveSpeedValue: speed,
      wavelengthValue: meters,
      frequencyValue,
      periodValue
    });
    return answer('Recognized wave problem: solving for frequency and period.', [
      'First use the wave formula: frequency = wave speed / wavelength.',
      `frequency = ${cleanNumber(speed)} m/s / ${cleanNumber(meters)} m`,
      `frequency = ${cleanNumber(frequencyValue)} Hz`,
      'Then use period = 1 / frequency.',
      `period = 1 / ${cleanNumber(frequencyValue)} Hz`,
      `period = ${cleanNumber(periodValue)} s`
    ], formulaWork);
  }

  if (target === 'wavelength' && waveSpeed && period) {
    const speed = velocityToMS(waveSpeed);
    const periodSeconds = convertTime(period.value, period.unit, 's');
    if (speed == null || periodSeconds == null || periodSeconds === 0) return null;
    const frequencyValue = 1 / periodSeconds;
    const wavelengthValue = speed / frequencyValue;
    const formulaWork = buildPeriodWavelengthFormulaWork({
      waveSpeedValue: speed,
      periodValue: periodSeconds,
      frequencyValue,
      wavelengthValue
    });
    return answer('Recognized wave problem: solving for wavelength from period.', [
      'First use frequency = 1 / period.',
      `frequency = 1 / ${cleanNumber(periodSeconds)} s`,
      `frequency = ${cleanNumber(frequencyValue)} Hz`,
      'Then use wavelength = wave speed / frequency.',
      `wavelength = ${cleanNumber(speed)} m/s / ${cleanNumber(frequencyValue)} Hz`,
      `wavelength = ${cleanNumber(wavelengthValue)} m`
    ], formulaWork);
  }

  const travel = findWaveTravelDistanceTime(text, wavelength);
  if (target === 'frequency' && travel && wavelength) {
    const distanceMeters = convertDistance(travel.distance.value, travel.distance.unit, 'm');
    const timeSeconds = convertTime(travel.time.value, travel.time.unit, 's');
    const wavelengthMeters = convertDistance(wavelength.value, wavelength.unit, 'm');
    if (distanceMeters == null || timeSeconds == null || timeSeconds === 0 || wavelengthMeters == null || wavelengthMeters === 0) return null;
    const speedValue = distanceMeters / timeSeconds;
    const frequencyValue = speedValue / wavelengthMeters;
    const formulaWork = buildDistanceTimeFrequencyFormulaWork({
      distanceValue: distanceMeters,
      timeValue: timeSeconds,
      waveSpeedValue: speedValue,
      wavelengthValue: wavelengthMeters,
      frequencyValue
    });
    return answer('Recognized two-step wave frequency problem.', [
      'First find wave speed using speed = distance / time.',
      `speed = ${cleanNumber(distanceMeters)} m / ${cleanNumber(timeSeconds)} s`,
      `speed = ${cleanNumber(speedValue)} m/s`,
      'Then use frequency = wave speed / wavelength.',
      `frequency = ${cleanNumber(speedValue)} m/s / ${cleanNumber(wavelengthMeters)} m`,
      `frequency = ${cleanNumber(frequencyValue)} Hz`
    ], formulaWork);
  }

  const waveRate = findWavesPerTimeRate(text);
  if (waveRate && wavelength && asksForSpeedAndPeriod(lower)) {
    const wavelengthMeters = convertDistance(wavelength.value, wavelength.unit, 'm');
    const timeSeconds = convertTime(waveRate.timeValue, waveRate.timeUnit, 's');
    if (wavelengthMeters == null || timeSeconds == null || timeSeconds === 0) return null;
    const frequencyValue = waveRate.waveCount / timeSeconds;
    const speedValue = wavelengthMeters * frequencyValue;
    const periodValue = 1 / frequencyValue;
    const formulaWork = buildWaveRateSpeedPeriodFormulaWork({
      waveCount: waveRate.waveCount,
      timeValue: timeSeconds,
      wavelengthValue: wavelengthMeters,
      frequencyValue,
      waveSpeedValue: speedValue,
      periodValue
    });
    return answer('Recognized wave rate problem: solving for speed and period.', [
      'First find frequency from waves per time.',
      `frequency = ${cleanNumber(waveRate.waveCount)} waves / ${cleanNumber(timeSeconds)} s`,
      `frequency = ${cleanNumber(frequencyValue)} Hz`,
      'Then use wave speed = wavelength × frequency.',
      `wave speed = ${cleanNumber(wavelengthMeters)} m × ${cleanNumber(frequencyValue)} Hz`,
      `wave speed = ${cleanNumber(speedValue)} m/s`,
      'Then use period = 1 / frequency.',
      `period = 1 / ${cleanNumber(frequencyValue)} Hz`,
      `period = ${formatFixed(periodValue, 3)} s`
    ], formulaWork);
  }

  if (asksForPeriodAndWavelength(lower) && waveSpeed && frequency && frequency.value !== 0) {
    const speed = velocityToMS(waveSpeed);
    if (speed == null) return null;
    const periodValue = 1 / frequency.value;
    const wavelengthValue = speed / frequency.value;
    const formulaWork = buildPeriodWavelengthFromFrequencyFormulaWork({
      waveSpeedValue: speed,
      frequencyValue: frequency.value,
      periodValue,
      wavelengthValue
    });
    return answer('Recognized wave problem: solving for period and wavelength.', [
      'First use period = 1 / frequency.',
      `period = 1 / ${cleanNumber(frequency.value)} Hz`,
      `period = ${formatScientific(periodValue)} s`,
      'Then use wavelength = wave speed / frequency.',
      `wavelength = ${cleanNumber(speed)} m/s / ${cleanNumber(frequency.value)} Hz`,
      `wavelength = ${formatFixed(wavelengthValue, 1)} m`
    ], formulaWork);
  }

  if (target === 'wave speed' && frequency && wavelength) {
    const meters = convertDistance(wavelength.value, wavelength.unit, 'm');
    if (meters == null) return null;
    const value = frequency.value * meters;
    const formulaWork = buildWaveFormulaWork({
      solveFor: 'wave speed',
      waveSpeedValue: value,
      frequencyValue: frequency.value,
      wavelengthValue: meters
    });
    return answer('Recognized wave problem: solving for wave speed.', [
      'Use the wave formula: wave speed = frequency × wavelength.',
      `wave speed = ${cleanNumber(frequency.value)} Hz × ${cleanNumber(meters)} m`,
      `wave speed = ${cleanNumber(value)} m/s`
    ], formulaWork);
  }

  if (target === 'frequency' && waveSpeed && wavelength) {
    const speed = velocityToMS(waveSpeed);
    const meters = convertDistance(wavelength.value, wavelength.unit, 'm');
    if (speed == null || meters == null || meters === 0) return null;
    const value = speed / meters;
    const formulaWork = buildWaveFormulaWork({
      solveFor: 'frequency',
      waveSpeedValue: speed,
      frequencyValue: value,
      wavelengthValue: meters
    });
    return answer('Recognized wave problem: solving for frequency.', [
      'Use the wave formula: frequency = wave speed / wavelength.',
      `frequency = ${cleanNumber(speed)} m/s / ${cleanNumber(meters)} m`,
      `frequency = ${cleanNumber(value)} Hz`
    ], formulaWork);
  }

  if (target === 'wavelength' && waveSpeed && frequency && frequency.value !== 0) {
    const speed = velocityToMS(waveSpeed);
    if (speed == null) return null;
    const value = speed / frequency.value;
    const formulaWork = buildWaveFormulaWork({
      solveFor: 'wavelength',
      waveSpeedValue: speed,
      frequencyValue: frequency.value,
      wavelengthValue: value
    });
    return answer('Recognized wave problem: solving for wavelength.', [
      'Use the wave formula: wavelength = wave speed / frequency.',
      `wavelength = ${cleanNumber(speed)} m/s / ${cleanNumber(frequency.value)} Hz`,
      `wavelength = ${cleanNumber(value)} m`
    ], formulaWork);
  }

  if (target === 'wavelength' && frequency && !waveSpeed) {
    return answer('Recognized wave problem: wavelength needs wave speed and frequency.', [
      'Use wavelength = wave speed / frequency.',
      `You gave frequency = ${cleanNumber(frequency.value)} Hz, but I need wave speed to calculate wavelength.`
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

function asksForFrequencyAndPeriod(lower) {
  return /\bfrequency\b/.test(lower) && /\bperiod\b/.test(lower);
}

function asksForSpeedAndPeriod(lower) {
  return /\b(?:speed|velocity)\b/.test(lower) && /\bperiod\b/.test(lower);
}

function asksForPeriodAndWavelength(lower) {
  return /\bperiod\b/.test(lower) && /\bwavelength\b/.test(lower);
}

function findPeriodQuantity(text) {
  return findQuantity(text, ['period'], TIME_UNITS, null);
}

function findWaveTravelDistanceTime(text, wavelength) {
  const maskedText = wavelength ? mask(text, wavelength.start, wavelength.end) : text;
  const number = '-?(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)';
  const distanceUnit = '(meters?|meter|m|kilometers?|kilometer|km|centimeters?|centimeter|cm|feet|foot|ft)';
  const timeUnit = '(seconds?|second|secs?|sec|s|minutes?|minute|mins?|min|hours?|hour|hrs?|hr)';
  const match = new RegExp(`\\b(?:wave\\s+)?travels?\\s+(${number})\\s*${distanceUnit}\\s+in\\s+(${number})\\s*${timeUnit}\\b`, 'i').exec(maskedText);
  if (!match) return null;
  return {
    distance: quantityFromUnit(match[1], match[2], DISTANCE_UNITS),
    time: quantityFromUnit(match[3], match[4], TIME_UNITS)
  };
}

function findWavesPerTimeRate(text) {
  const number = '-?(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)';
  const timeUnit = '(seconds?|second|secs?|sec|s|minutes?|minute|mins?|min|hours?|hour|hrs?|hr)';
  const match = new RegExp(`\\b(?:rate\\s+of\\s+)?(${number})\\s+waves?\\s+(?:every|per|in)\\s+(${number})\\s*${timeUnit}\\b`, 'i').exec(text);
  if (!match) return null;
  return {
    waveCount: parseQuantityNumber(match[1]),
    timeValue: parseQuantityNumber(match[2]),
    timeUnit: canonicalUnit(match[3], TIME_UNITS)
  };
}

function quantityFromUnit(numberText, unitText, unitDefs) {
  return {
    value: parseQuantityNumber(numberText),
    unit: canonicalUnit(unitText, unitDefs)
  };
}

function canonicalUnit(unitText, unitDefs) {
  const raw = String(unitText || '').toLowerCase();
  const def = unitDefs.find((item) => item.canonical.toLowerCase() === raw ||
    item.names.some((name) => name.toLowerCase() === raw));
  return def ? def.canonical : raw;
}

function buildWaveFormulaWork({ solveFor, waveSpeedValue, frequencyValue, wavelengthValue }) {
  const waveSpeedDisplay = `${cleanNumber(waveSpeedValue)} m/s`;
  const frequencyDisplay = `${cleanNumber(frequencyValue)} Hz`;
  const wavelengthDisplay = `${cleanNumber(wavelengthValue)} m`;
  const finalByTarget = {
    'wave speed': { value: waveSpeedValue, unit: 'm/s', display: waveSpeedDisplay },
    frequency: { value: frequencyValue, unit: 'Hz', display: frequencyDisplay },
    wavelength: { value: wavelengthValue, unit: 'm', display: wavelengthDisplay }
  };
  const formulaByTarget = {
    'wave speed': 'wave speed = frequency × wavelength',
    frequency: 'frequency = wave speed / wavelength',
    wavelength: 'wavelength = wave speed / frequency'
  };

  return buildFormulaWork({
    formulaId: 'wave_speed_frequency_wavelength',
    family: 'waves',
    solveFor,
    formula: formulaByTarget[solveFor],
    finalAnswer: finalByTarget[solveFor],
    choices: ['wave speed', 'frequency', 'wavelength'],
    formulaDistractors: ['speed = distance / time', 'P = W / t'],
    variables: [
      { key: 'wave speed', symbol: 'v', value: waveSpeedValue, unit: 'm/s', display: waveSpeedDisplay },
      { key: 'frequency', symbol: 'f', value: frequencyValue, unit: 'Hz', display: frequencyDisplay },
      { key: 'wavelength', symbol: 'λ', value: wavelengthValue, unit: 'm', display: wavelengthDisplay }
    ],
    calculation: {
      prompt: solveFor === 'wave speed'
        ? `Now substitute: wave speed = ${cleanNumber(frequencyValue)} × ${cleanNumber(wavelengthValue)}. What is ${cleanNumber(frequencyValue)} × ${cleanNumber(wavelengthValue)}?`
        : solveFor === 'frequency'
          ? `Now substitute: frequency = ${cleanNumber(waveSpeedValue)} / ${cleanNumber(wavelengthValue)}. What is ${cleanNumber(waveSpeedValue)} / ${cleanNumber(wavelengthValue)}?`
          : `Now substitute: wavelength = ${cleanNumber(waveSpeedValue)} / ${cleanNumber(frequencyValue)}. What is ${cleanNumber(waveSpeedValue)} / ${cleanNumber(frequencyValue)}?`,
      expectedValue: finalByTarget[solveFor].value,
      hints: [solveFor === 'wave speed' ? 'Multiply frequency by wavelength.' : 'Divide wave speed by the known value.']
    }
  });
}

function buildFrequencyPeriodFormulaWork({ waveSpeedValue, wavelengthValue, frequencyValue, periodValue }) {
  const speedDisplay = `${cleanNumber(waveSpeedValue)} m/s`;
  const wavelengthDisplay = `${cleanNumber(wavelengthValue)} m`;
  const frequencyDisplay = `${cleanNumber(frequencyValue)} Hz`;
  const periodDisplay = `${cleanNumber(periodValue)} s`;

  return buildMultiStepWaveFormulaWork({
    formulaId: 'wave_frequency_period',
    solveFor: 'frequency and period',
    formula: 'frequency = wave speed / wavelength, then period = 1 / frequency',
    finalAnswer: { value: periodValue, unit: 's', display: `${frequencyDisplay}; ${periodDisplay}` },
    variables: {
      'wave speed': { symbol: 'v', value: waveSpeedValue, unit: 'm/s', display: speedDisplay },
      wavelength: { symbol: 'λ', value: wavelengthValue, unit: 'm', display: wavelengthDisplay },
      frequency: { symbol: 'f', value: frequencyValue, unit: 'Hz', display: frequencyDisplay },
      period: { symbol: 'T', value: periodValue, unit: 's', display: periodDisplay }
    },
    targetChoices: ['frequency and period', 'wave speed', 'wavelength'],
    formulaChoices: ['frequency = wave speed / wavelength, then period = 1 / frequency', 'v = f × λ', 'speed = distance / time'],
    knownSteps: [
      quantityStep('wave_speed', 'wave speed, v', waveSpeedValue, 'm/s', speedDisplay),
      quantityStep('wavelength', 'wavelength, λ', wavelengthValue, 'm', wavelengthDisplay)
    ],
    calculationSteps: [
      calculationStep({
        id: 'calculate_frequency',
        prompt: `First find frequency: frequency = ${cleanNumber(waveSpeedValue)} / ${cleanNumber(wavelengthValue)}. What is ${cleanNumber(waveSpeedValue)} / ${cleanNumber(wavelengthValue)}?`,
        expectedValue: frequencyValue,
        expectedUnit: 'Hz',
        expectedDisplay: frequencyDisplay,
        expression: `${cleanNumber(waveSpeedValue)} / ${cleanNumber(wavelengthValue)}`,
        hints: ['Divide wave speed by wavelength.']
      }),
      calculationStep({
        id: 'calculate_period',
        prompt: `Now find period: period = 1 / ${cleanNumber(frequencyValue)}. What is 1 / ${cleanNumber(frequencyValue)}?`,
        expectedValue: periodValue,
        expectedUnit: 's',
        expectedDisplay: periodDisplay,
        expression: `1 / ${cleanNumber(frequencyValue)}`,
        hints: ['Period is the reciprocal of frequency.']
      })
    ]
  });
}

function buildPeriodWavelengthFormulaWork({ waveSpeedValue, periodValue, frequencyValue, wavelengthValue }) {
  const speedDisplay = `${cleanNumber(waveSpeedValue)} m/s`;
  const periodDisplay = `${cleanNumber(periodValue)} s`;
  const frequencyDisplay = `${cleanNumber(frequencyValue)} Hz`;
  const wavelengthDisplay = `${cleanNumber(wavelengthValue)} m`;

  return buildMultiStepWaveFormulaWork({
    formulaId: 'wave_period_wavelength',
    solveFor: 'wavelength',
    formula: 'f = 1 / T, then λ = v / f',
    finalAnswer: { value: wavelengthValue, unit: 'm', display: `${frequencyDisplay}; ${wavelengthDisplay}` },
    variables: {
      'wave speed': { symbol: 'v', value: waveSpeedValue, unit: 'm/s', display: speedDisplay },
      period: { symbol: 'T', value: periodValue, unit: 's', display: periodDisplay },
      frequency: { symbol: 'f', value: frequencyValue, unit: 'Hz', display: frequencyDisplay },
      wavelength: { symbol: 'λ', value: wavelengthValue, unit: 'm', display: wavelengthDisplay }
    },
    targetChoices: ['wavelength', 'frequency', 'period'],
    formulaChoices: ['f = 1 / T, then λ = v / f', 'λ = v × T only', 'speed = distance / time'],
    knownSteps: [
      quantityStep('wave_speed', 'wave speed, v', waveSpeedValue, 'm/s', speedDisplay),
      quantityStep('period', 'period, T', periodValue, 's', periodDisplay)
    ],
    calculationSteps: [
      calculationStep({
        id: 'calculate_frequency',
        prompt: `First find frequency: frequency = 1 / ${cleanNumber(periodValue)}. What is 1 / ${cleanNumber(periodValue)}?`,
        expectedValue: frequencyValue,
        expectedUnit: 'Hz',
        expectedDisplay: frequencyDisplay,
        expression: `1 / ${cleanNumber(periodValue)}`,
        hints: ['Frequency is the reciprocal of period.']
      }),
      calculationStep({
        id: 'calculate_wavelength',
        prompt: `Now find wavelength: wavelength = ${cleanNumber(waveSpeedValue)} / ${cleanNumber(frequencyValue)}. What is ${cleanNumber(waveSpeedValue)} / ${cleanNumber(frequencyValue)}?`,
        expectedValue: wavelengthValue,
        expectedUnit: 'm',
        expectedDisplay: wavelengthDisplay,
        expression: `${cleanNumber(waveSpeedValue)} / ${cleanNumber(frequencyValue)}`,
        hints: ['Divide wave speed by frequency.']
      })
    ]
  });
}

function buildDistanceTimeFrequencyFormulaWork({ distanceValue, timeValue, waveSpeedValue, wavelengthValue, frequencyValue }) {
  const distanceDisplay = `${cleanNumber(distanceValue)} m`;
  const timeDisplay = `${cleanNumber(timeValue)} s`;
  const speedDisplay = `${cleanNumber(waveSpeedValue)} m/s`;
  const wavelengthDisplay = `${cleanNumber(wavelengthValue)} m`;
  const frequencyDisplay = `${cleanNumber(frequencyValue)} Hz`;

  return buildMultiStepWaveFormulaWork({
    formulaId: 'wave_speed_distance_time_frequency',
    solveFor: 'frequency',
    formula: 'speed = distance / time, then f = v / λ',
    finalAnswer: { value: frequencyValue, unit: 'Hz', display: `${speedDisplay}; ${frequencyDisplay}` },
    variables: {
      distance: { symbol: 'd', value: distanceValue, unit: 'm', display: distanceDisplay },
      time: { symbol: 't', value: timeValue, unit: 's', display: timeDisplay },
      wavelength: { symbol: 'λ', value: wavelengthValue, unit: 'm', display: wavelengthDisplay },
      'wave speed': { symbol: 'v', value: waveSpeedValue, unit: 'm/s', display: speedDisplay },
      frequency: { symbol: 'f', value: frequencyValue, unit: 'Hz', display: frequencyDisplay }
    },
    targetChoices: ['frequency', 'wave speed', 'wavelength'],
    formulaChoices: ['speed = distance / time, then f = v / λ', 'f = wavelength / speed', 'T = 1 / f'],
    knownSteps: [
      quantityStep('distance', 'distance, d', distanceValue, 'm', distanceDisplay),
      quantityStep('time', 'time, t', timeValue, 's', timeDisplay),
      quantityStep('wavelength', 'wavelength, λ', wavelengthValue, 'm', wavelengthDisplay)
    ],
    calculationSteps: [
      calculationStep({
        id: 'calculate_wave_speed',
        prompt: `First find wave speed: speed = ${cleanNumber(distanceValue)} / ${cleanNumber(timeValue)}. What is ${cleanNumber(distanceValue)} / ${cleanNumber(timeValue)}?`,
        expectedValue: waveSpeedValue,
        expectedUnit: 'm/s',
        expectedDisplay: speedDisplay,
        expression: `${cleanNumber(distanceValue)} / ${cleanNumber(timeValue)}`,
        hints: ['Divide distance by time to get wave speed.']
      }),
      calculationStep({
        id: 'calculate_frequency',
        prompt: `Now find frequency: frequency = ${cleanNumber(waveSpeedValue)} / ${cleanNumber(wavelengthValue)}. What is ${cleanNumber(waveSpeedValue)} / ${cleanNumber(wavelengthValue)}?`,
        expectedValue: frequencyValue,
        expectedUnit: 'Hz',
        expectedDisplay: frequencyDisplay,
        expression: `${cleanNumber(waveSpeedValue)} / ${cleanNumber(wavelengthValue)}`,
        hints: ['Divide wave speed by wavelength.']
      })
    ]
  });
}

function buildWaveRateSpeedPeriodFormulaWork({ waveCount, timeValue, wavelengthValue, frequencyValue, waveSpeedValue, periodValue }) {
  const waveCountDisplay = `${cleanNumber(waveCount)} waves`;
  const timeDisplay = `${cleanNumber(timeValue)} s`;
  const wavelengthDisplay = `${cleanNumber(wavelengthValue)} m`;
  const frequencyDisplay = `${cleanNumber(frequencyValue)} Hz`;
  const speedDisplay = `${cleanNumber(waveSpeedValue)} m/s`;
  const periodDisplay = `${formatFixed(periodValue, 3)} s`;

  return buildMultiStepWaveFormulaWork({
    formulaId: 'wave_rate_speed_period',
    solveFor: 'speed and period',
    formula: 'f = waves / time, v = λf, then T = 1 / f',
    finalAnswer: { value: waveSpeedValue, unit: 'm/s', display: `${frequencyDisplay}; ${speedDisplay}; ${periodDisplay}` },
    variables: {
      waves: { symbol: 'n', value: waveCount, unit: 'waves', display: waveCountDisplay },
      time: { symbol: 't', value: timeValue, unit: 's', display: timeDisplay },
      wavelength: { symbol: 'λ', value: wavelengthValue, unit: 'm', display: wavelengthDisplay },
      frequency: { symbol: 'f', value: frequencyValue, unit: 'Hz', display: frequencyDisplay },
      'wave speed': { symbol: 'v', value: waveSpeedValue, unit: 'm/s', display: speedDisplay },
      period: { symbol: 'T', value: periodValue, unit: 's', display: periodDisplay }
    },
    targetChoices: ['speed and period', 'wavelength', 'wave count'],
    formulaChoices: ['f = waves / time, v = λf, then T = 1 / f', 'speed = wavelength / time', 'frequency = wave count'],
    knownSteps: [
      quantityStep('waves', 'number of waves', waveCount, 'waves', waveCountDisplay),
      quantityStep('time', 'time, t', timeValue, 's', timeDisplay),
      quantityStep('wavelength', 'wavelength, λ', wavelengthValue, 'm', wavelengthDisplay)
    ],
    calculationSteps: [
      calculationStep({
        id: 'calculate_frequency',
        prompt: `First find frequency: frequency = ${cleanNumber(waveCount)} / ${cleanNumber(timeValue)}. What is ${cleanNumber(waveCount)} / ${cleanNumber(timeValue)}?`,
        expectedValue: frequencyValue,
        expectedUnit: 'Hz',
        expectedDisplay: frequencyDisplay,
        expression: `${cleanNumber(waveCount)} / ${cleanNumber(timeValue)}`,
        hints: ['Divide the number of waves by the total time.']
      }),
      calculationStep({
        id: 'calculate_speed',
        prompt: `Now find wave speed: speed = ${cleanNumber(wavelengthValue)} × ${cleanNumber(frequencyValue)}. What is ${cleanNumber(wavelengthValue)} × ${cleanNumber(frequencyValue)}?`,
        expectedValue: waveSpeedValue,
        expectedUnit: 'm/s',
        expectedDisplay: speedDisplay,
        expression: `${cleanNumber(wavelengthValue)} * ${cleanNumber(frequencyValue)}`,
        hints: ['Multiply wavelength by frequency.']
      }),
      calculationStep({
        id: 'calculate_period',
        prompt: `Now find period: period = 1 / ${cleanNumber(frequencyValue)}. What is 1 / ${cleanNumber(frequencyValue)}?`,
        expectedValue: periodValue,
        expectedUnit: 's',
        expectedDisplay: periodDisplay,
        expression: `1 / ${cleanNumber(frequencyValue)}`,
        hints: ['Period is the reciprocal of frequency.']
      })
    ]
  });
}

function buildPeriodWavelengthFromFrequencyFormulaWork({ waveSpeedValue, frequencyValue, periodValue, wavelengthValue }) {
  const speedDisplay = `${cleanNumber(waveSpeedValue)} m/s`;
  const frequencyDisplay = `${cleanNumber(frequencyValue)} Hz`;
  const periodDisplay = `${formatScientific(periodValue)} s`;
  const wavelengthDisplay = `${formatFixed(wavelengthValue, 1)} m`;

  return buildMultiStepWaveFormulaWork({
    formulaId: 'wave_period_wavelength',
    solveFor: 'period and wavelength',
    formula: 'T = 1 / f, then λ = v / f',
    finalAnswer: { value: wavelengthValue, unit: 'm', display: `${periodDisplay}; ${wavelengthDisplay}` },
    variables: {
      'wave speed': { symbol: 'v', value: waveSpeedValue, unit: 'm/s', display: speedDisplay },
      frequency: { symbol: 'f', value: frequencyValue, unit: 'Hz', display: frequencyDisplay },
      period: { symbol: 'T', value: periodValue, unit: 's', display: periodDisplay },
      wavelength: { symbol: 'λ', value: wavelengthValue, unit: 'm', display: wavelengthDisplay }
    },
    targetChoices: ['period and wavelength', 'wave speed', 'frequency'],
    formulaChoices: ['T = 1 / f, then λ = v / f', 'v = f × λ only', 'speed = distance / time'],
    knownSteps: [
      quantityStep('wave_speed', 'wave speed, v', waveSpeedValue, 'm/s', speedDisplay),
      quantityStep('frequency', 'frequency, f', frequencyValue, 'Hz', frequencyDisplay)
    ],
    calculationSteps: [
      calculationStep({
        id: 'calculate_period',
        prompt: `First find period, not wavelength yet: period = 1 / frequency = 1 / ${cleanNumber(frequencyValue)}. The answer will be a very small time in seconds. What is the period?`,
        expectedValue: periodValue,
        expectedUnit: 's',
        expectedDisplay: periodDisplay,
        expression: `1 / ${cleanNumber(frequencyValue)}`,
        hints: [`This step is asking for period, not wavelength. Use period = 1 / frequency, so calculate 1 / ${cleanNumber(frequencyValue)}. The answer should be a very small number of seconds; decimal or scientific notation like e-7 is okay. The wavelength step comes next.`]
      }),
      calculationStep({
        id: 'calculate_wavelength',
        prompt: `Now find wavelength: wavelength = ${cleanNumber(waveSpeedValue)} / ${cleanNumber(frequencyValue)}. What is ${cleanNumber(waveSpeedValue)} / ${cleanNumber(frequencyValue)}?`,
        expectedValue: wavelengthValue,
        expectedUnit: 'm',
        expectedDisplay: wavelengthDisplay,
        expression: `${cleanNumber(waveSpeedValue)} / ${cleanNumber(frequencyValue)}`,
        hints: ['Divide wave speed by frequency.']
      })
    ]
  });
}

function buildMultiStepWaveFormulaWork({
  formulaId,
  solveFor,
  formula,
  finalAnswer,
  variables,
  targetChoices,
  formulaChoices,
  knownSteps,
  calculationSteps
}) {
  return {
    formulaId,
    family: 'waves',
    solveFor,
    formula,
    finalAnswer,
    variables,
    steps: [
      {
        id: 'identify_solve_target',
        type: 'multiple_choice',
        prompt: 'What variable are we solving for?',
        choices: targetChoices.map((label, index) => ({
          number: index + 1,
          label,
          correct: label === solveFor
        })),
        expected: solveFor,
        hints: [`The question asks for ${solveFor}.`]
      },
      {
        id: 'choose_formula',
        type: 'multiple_choice',
        prompt: 'Which formula should we use?',
        choices: formulaChoices.map((label, index) => ({
          number: index + 1,
          label,
          correct: index === 0
        })),
        expected: formulaChoices[0],
        hints: ['Use the wave relationship and any reciprocal period relationship needed.']
      },
      ...knownSteps,
      ...calculationSteps
    ]
  };
}

function quantityStep(idKey, label, expectedValue, expectedUnit, expectedDisplay) {
  return {
    id: `identify_${idKey}`,
    type: 'quantity',
    prompt: `What number should go in for ${label}?`,
    expectedValue,
    expectedUnit,
    expectedDisplay,
    hints: [`Look for ${expectedDisplay} in the problem.`]
  };
}

function calculationStep({ id, prompt, expectedValue, expectedUnit, expectedDisplay, expression, hints }) {
  return {
    id,
    type: 'calculation',
    prompt,
    expectedValue,
    expectedUnit,
    expectedDisplay,
    calculationExpression: expression,
    hints
  };
}

function formatFixed(value, digits) {
  return cleanNumber(Number(value).toFixed(digits));
}

function formatScientific(value) {
  if (!Number.isFinite(Number(value)) || value === 0) return cleanNumber(value);
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const coefficient = value / (10 ** exponent);
  return `${formatFixed(coefficient, 2)} × 10^${exponent}`;
}

module.exports = { tryWaves };
