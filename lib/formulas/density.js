function tryDensity(text, lower, ctx) {
  if (!/\b(density|mass|volume)\b|\bd\s*=|\bm\s*=|\bv\s*=/.test(lower)) return null;

  const density = ctx.findQuantity(text, ['density'], ctx.DENSITY_UNITS, null);
  const mass = ctx.findQuantity(text, ['mass'], ctx.MASS_UNITS, null);
  const derivedVolume = findDisplacementVolume(text, lower, ctx) ||
    findCubeVolume(text, lower, ctx) ||
    findRectangularVolume(text, lower, ctx);
  const volume = (derivedVolume && derivedVolume.quantity) ||
    ctx.findQuantity(text, ['volume'], ctx.VOLUME_UNITS, null);
  const target = densityTargetFromQuestion(lower) ||
    ctx.targetFromQuestion(lower, ['density', 'mass', 'volume'], { density, mass, volume });

  if (target === 'density' && mass && volume && volume.value !== 0) {
    const v = densityVolumeValue(volume, derivedVolume, ctx);
    const volumeUnit = densityVolumeUnit(volume, derivedVolume);
    const massUnit = densityMassUnit(volumeUnit);
    const m = densityMassValue(mass, massUnit, ctx);
    const resultUnit = densityResultUnit(massUnit, volumeUnit);
    const value = m / v;
    const formulaWork = !derivedVolume
      ? buildDensityFormulaWork({
        solveFor: 'density',
        massValue: m,
        massUnit,
        volumeValue: v,
        volumeUnit,
        densityValue: value,
        densityUnit: resultUnit,
        ctx
      })
      : null;
    return ctx.answer('Recognized density problem: solving for density.', [
      ...densityVolumeLines(derivedVolume, ctx),
      'Use the density formula: D = m / V.',
      `D = ${ctx.cleanNumber(m)} ${massUnit} / ${ctx.cleanNumber(v)} ${volumeUnit}`,
      `D = ${ctx.cleanNumber(value)} ${resultUnit}`
    ], formulaWork);
  }

  if (target === 'mass' && density && volume) {
    const v = densityVolumeValue(volume, derivedVolume, ctx);
    const volumeUnit = densityVolumeUnit(volume, derivedVolume);
    const resultUnit = densityResultUnit(densityMassUnit(volumeUnit), volumeUnit);
    const value = density.value * v;
    const formulaWork = !derivedVolume
      ? buildDensityFormulaWork({
        solveFor: 'mass',
        massValue: value,
        massUnit: densityMassUnit(volumeUnit),
        volumeValue: v,
        volumeUnit,
        densityValue: density.value,
        densityUnit: resultUnit,
        ctx
      })
      : null;
    return ctx.answer('Recognized density problem: solving for mass.', [
      ...densityVolumeLines(derivedVolume, ctx),
      'Use the density formula: mass = density × volume.',
      `m = ${ctx.cleanNumber(density.value)} ${resultUnit} × ${ctx.cleanNumber(v)} ${volumeUnit}`,
      `m = ${ctx.cleanNumber(value)} g`
    ], formulaWork);
  }

  if (target === 'volume' && mass && density && density.value !== 0) {
    const m = ctx.massToGrams(mass);
    const value = m / density.value;
    const formulaWork = buildDensityFormulaWork({
      solveFor: 'volume',
      massValue: m,
      massUnit: 'g',
      volumeValue: value,
      volumeUnit: 'mL',
      densityValue: density.value,
      densityUnit: 'g/mL',
      ctx
    });
    return ctx.answer('Recognized density problem: solving for volume.', [
      'Use the density formula: volume = mass / density.',
      `V = ${ctx.cleanNumber(m)} g / ${ctx.cleanNumber(density.value)} g/mL`,
      `V = ${ctx.cleanNumber(value)} mL`
    ], formulaWork);
  }

  if (target === 'volume' && derivedVolume) {
    return ctx.answer('Recognized volume problem.', densityVolumeLines(derivedVolume, ctx));
  }

  const rearranged = densityRearrangementAnswer(target, lower, ctx);
  if (rearranged) return rearranged;

  return null;
}

function densityTargetFromQuestion(lower) {
  const targetPatterns = {
    density: 'density|d',
    mass: 'mass|m',
    volume: 'volume|v'
  };

  for (const [target, pattern] of Object.entries(targetPatterns)) {
    const targetRegex = new RegExp(`(?:\\bsolve\\s+for\\s+(?:the\\s+)?(?:${pattern})\\b|\\b(?:find|calculate|determine)\\s+(?:the\\s+)?(?:${pattern})\\b|\\bhow\\s+(?:do|would|can)\\s+i\\s+(?:solve\\s+for|find|calculate)\\s+(?:the\\s+)?(?:${pattern})\\b|\\bwhat\\s+formula\\s+(?:do\\s+i\\s+use\\s+)?(?:for|to\\s+find|to\\s+solve\\s+for)\\s+(?:the\\s+)?(?:${pattern})\\b)`);
    if (targetRegex.test(lower)) return target;
  }

  return null;
}

function densityRearrangementAnswer(target, lower, ctx) {
  if (!target || !hasDensityFormulaIntent(lower)) return null;

  const mentions = {
    density: /\b(density|d)\b/.test(lower),
    mass: /\b(mass|m)\b/.test(lower),
    volume: /\b(volume|v)\b/.test(lower)
  };

  if (target === 'mass' && mentions.density && mentions.volume) {
    return ctx.answer('Recognized density problem: solving for mass.', [
      'To solve for mass, use: mass = density × volume.',
      'Start with D = m / V.',
      'Multiply both sides by V so volume is no longer under mass.',
      'The rearranged formula is m = D × V.',
      'Example: if density = 4 g/cm³ and volume = 5 cm³, then mass = 4 × 5 = 20 g.'
    ]);
  }

  if (target === 'volume' && mentions.mass && mentions.density) {
    return ctx.answer('Recognized density problem: solving for volume.', [
      'To solve for volume, use: volume = mass / density.',
      'Start with D = m / V.',
      'Rearrange it so V is by itself.',
      'The rearranged formula is V = m / D.',
      'Example: if mass = 20 g and density = 4 g/cm³, then volume = 20 / 4 = 5 cm³.'
    ]);
  }

  if (target === 'density' && mentions.mass && mentions.volume) {
    return ctx.answer('Recognized density problem: solving for density.', [
      'To solve for density, use: density = mass / volume.',
      'The formula is D = m / V.',
      'Divide the mass by the volume.',
      'Example: if mass = 20 g and volume = 5 cm³, then density = 20 / 5 = 4 g/cm³.'
    ]);
  }

  return null;
}

function hasDensityFormulaIntent(lower) {
  return /\b(solve|solving|find|calculate|determine|formula|rearrange|rearranged)\b/.test(lower) ||
    /\bhow\s+(?:do|would|can)\s+i\b/.test(lower);
}

function findDisplacementVolume(text, lower, ctx) {
  if (!/\b(displacement|water level|graduated cylinder|starts? at|rises? to|rose to|dropped in|placed in)\b/.test(lower)) return null;

  const volumes = ctx.findAllNumbersWithUnits(text, ctx.VOLUME_UNITS);
  if (volumes.length < 2) return null;

  const initial = volumes[0];
  const final = volumes[1];
  const initialML = ctx.volumeToML(initial);
  const finalML = ctx.volumeToML(final);
  const displaced = finalML - initialML;

  if (!Number.isFinite(displaced) || displaced === 0) return null;

  return {
    kind: 'displacement',
    initial: initialML,
    final: finalML,
    quantity: {
      value: Math.abs(displaced),
      unit: 'mL',
      start: initial.start,
      end: final.end
    }
  };
}

function findRectangularVolume(text, lower, ctx) {
  if (!/\b(length|width|height|long|wide|tall|l\s*[×x*]\s*w\s*[×x*]\s*h|rectangular|box|cube|block)\b/.test(lower)) return null;

  const dimensions = findRectangularDimensions(text, ctx);
  if (!dimensions) return null;

  const baseUnit = rectangularVolumeUnit(dimensions);
  const length = ctx.convertDistance(dimensions.length.value, dimensions.length.unit, baseUnit);
  const width = ctx.convertDistance(dimensions.width.value, dimensions.width.unit, baseUnit);
  const height = ctx.convertDistance(dimensions.height.value, dimensions.height.unit, baseUnit);

  if (length == null || width == null || height == null) return null;

  const volume = length * width * height;

  return {
    kind: 'rectangular',
    length,
    width,
    height,
    unit: baseUnit,
    quantity: {
      value: volume,
      unit: `${baseUnit}^3`,
      start: dimensions.length.start,
      end: dimensions.height.end
    }
  };
}

function rectangularVolumeUnit(dimensions) {
  const units = [dimensions.length.unit, dimensions.width.unit, dimensions.height.unit];
  if (units.every((item) => item === 'm')) return 'm';
  if (units.every((item) => item === 'cm')) return 'cm';
  return 'cm';
}

function findCubeVolume(text, lower, ctx) {
  if (!/\b(cube|side|edge)\b/.test(lower)) return null;

  const side = findCubeSideQuantity(text, ctx);
  if (!side) return null;

  const sideCM = ctx.convertDistance(side.value, side.unit, 'cm');
  if (sideCM == null) return null;

  const volume = sideCM * sideCM * sideCM;

  return {
    kind: 'cube',
    side: sideCM,
    quantity: {
      value: volume,
      unit: 'cm^3',
      start: side.start,
      end: side.end
    }
  };
}

function findCubeSideQuantity(text, ctx) {
  const unitPattern = ctx.unitPatternFor(ctx.DISTANCE_UNITS);
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`\\b(?:each\\s+)?(?:side|edge)(?:\\s+of\\s+(?:the\\s+)?cube)?\\s*(?:length\\s*)?(?:is|=|:|of)?\\s*${number}\\s*(${unitPattern})\\b`, 'i'),
    new RegExp(`\\b(?:side|edge)\\s+length\\s*(?:is|=|:|of)?\\s*${number}\\s*(${unitPattern})\\b`, 'i'),
    new RegExp(`${number}\\s*(${unitPattern})\\s+(?:long\\s+)?(?:on\\s+)?(?:each\\s+)?(?:side|edge)\\b`, 'i')
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;

    const quantity = ctx.quantityFromRawUnit(match[1], match[2], ctx.DISTANCE_UNITS);
    quantity.start = match.index + match[0].indexOf(match[1]);
    quantity.end = quantity.start + `${match[1]} ${match[2]}`.length;
    return quantity;
  }

  return null;
}

function findRectangularDimensions(text, ctx) {
  const unitPattern = ctx.unitPatternFor(ctx.DISTANCE_UNITS);
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const byPattern = new RegExp(`${number}\\s*(${unitPattern})\\s*(?:x|×|\\*)\\s*${number}\\s*(${unitPattern})\\s*(?:x|×|\\*)\\s*${number}\\s*(${unitPattern})`, 'i');
  const byMatch = byPattern.exec(text);

  if (byMatch) {
    const length = ctx.quantityFromRawUnit(byMatch[1], byMatch[2], ctx.DISTANCE_UNITS);
    const width = ctx.quantityFromRawUnit(byMatch[3], byMatch[4], ctx.DISTANCE_UNITS);
    const height = ctx.quantityFromRawUnit(byMatch[5], byMatch[6], ctx.DISTANCE_UNITS);
    length.start = byMatch.index + byMatch[0].indexOf(byMatch[1]);
    length.end = length.start + `${byMatch[1]} ${byMatch[2]}`.length;
    width.start = byMatch.index + byMatch[0].indexOf(byMatch[3]);
    width.end = width.start + `${byMatch[3]} ${byMatch[4]}`.length;
    height.start = byMatch.index + byMatch[0].indexOf(byMatch[5]);
    height.end = height.start + `${byMatch[5]} ${byMatch[6]}`.length;
    return { length, width, height };
  }

  const length = findDimensionQuantity(text, ['length', 'long', 'l'], ctx);
  const width = findDimensionQuantity(text, ['width', 'wide', 'w'], ctx);
  const height = findDimensionQuantity(text, ['height', 'hight', 'tall', 'high', 'h'], ctx);

  if (!length || !width || !height) return null;
  return { length, width, height };
}

function findDimensionQuantity(text, labels, ctx) {
  const unitPattern = ctx.unitPatternFor(ctx.DISTANCE_UNITS);
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const labelPattern = labels.map(ctx.escapeRegex).join('|');
  const patterns = [
    new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:is|=|:|of)?\\s*${number}\\s*(${unitPattern})\\b`, 'i'),
    new RegExp(`${number}\\s*(${unitPattern})\\s*(?:${labelPattern})\\b`, 'i')
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;

    const quantity = ctx.quantityFromRawUnit(match[1], match[2], ctx.DISTANCE_UNITS);
    quantity.start = match.index + match[0].indexOf(match[1]);
    quantity.end = quantity.start + `${match[1]} ${match[2]}`.length;
    return quantity;
  }

  return null;
}

function densityVolumeLines(derivedVolume, ctx) {
  if (!derivedVolume) return [];

  if (derivedVolume.kind === 'displacement') {
    return [
      'First find the volume by displacement.',
      `volume = ${ctx.cleanNumber(derivedVolume.final)} mL - ${ctx.cleanNumber(derivedVolume.initial)} mL`,
      `volume = ${ctx.cleanNumber(derivedVolume.quantity.value)} mL`
    ];
  }

  if (derivedVolume.kind === 'rectangular') {
    const unit = derivedVolume.unit || 'cm';
    const volumeUnit = displayVolumeUnit(derivedVolume.quantity.unit);
    return [
      'First find the volume.',
      'Use the rectangular volume formula: V = L × W × H.',
      `V = ${ctx.cleanNumber(derivedVolume.length)} ${unit} × ${ctx.cleanNumber(derivedVolume.width)} ${unit} × ${ctx.cleanNumber(derivedVolume.height)} ${unit}`,
      `V = ${ctx.cleanNumber(derivedVolume.quantity.value)} ${volumeUnit}`
    ];
  }

  if (derivedVolume.kind === 'cube') {
    return [
      'First find the volume of the cube.',
      'Use the cube volume formula: V = side × side × side.',
      `V = ${ctx.cleanNumber(derivedVolume.side)} cm × ${ctx.cleanNumber(derivedVolume.side)} cm × ${ctx.cleanNumber(derivedVolume.side)} cm`,
      `V = ${ctx.cleanNumber(derivedVolume.quantity.value)} cm³`
    ];
  }

  return [];
}

function densityVolumeValue(volume, derivedVolume, ctx) {
  if (derivedVolume && (derivedVolume.kind === 'rectangular' || derivedVolume.kind === 'cube')) return derivedVolume.quantity.value;
  return ctx.volumeToML(volume);
}

function densityVolumeUnit(volume, derivedVolume) {
  if (derivedVolume && (derivedVolume.kind === 'rectangular' || derivedVolume.kind === 'cube')) return displayVolumeUnit(derivedVolume.quantity.unit);
  if (volume.unit === 'cm^3') return 'cm³';
  if (volume.unit === 'm^3') return 'm³';
  return 'mL';
}

function densityMassUnit(volumeUnit) {
  return volumeUnit === 'm³' ? 'kg' : 'g';
}

function densityMassValue(mass, targetUnit, ctx) {
  if (targetUnit === 'kg') return ctx.massToKg(mass);
  return ctx.massToGrams(mass);
}

function densityResultUnit(massUnit, volumeUnit) {
  return `${massUnit}/${volumeUnit}`;
}

function displayVolumeUnit(unit) {
  if (unit === 'cm^3') return 'cm³';
  if (unit === 'm^3') return 'm³';
  return unit;
}

function buildDensityFormulaWork({ solveFor, massValue, massUnit, volumeValue, volumeUnit, densityValue, densityUnit, ctx }) {
  const massDisplay = `${ctx.cleanNumber(massValue)} ${massUnit}`;
  const volumeDisplay = `${ctx.cleanNumber(volumeValue)} ${volumeUnit}`;
  const densityDisplay = `${ctx.cleanNumber(densityValue)} ${densityUnit}`;
  const finalByTarget = {
    density: { value: densityValue, unit: densityUnit, display: densityDisplay },
    mass: { value: massValue, unit: massUnit, display: massDisplay },
    volume: { value: volumeValue, unit: volumeUnit, display: volumeDisplay }
  };
  const formulaByTarget = {
    density: 'D = m / V',
    mass: 'm = D × V',
    volume: 'V = m / D'
  };

  return {
    formulaId: 'density_mass_volume',
    family: 'density',
    solveFor,
    formula: formulaByTarget[solveFor],
    finalAnswer: finalByTarget[solveFor],
    variables: {
      mass: {
        symbol: 'm',
        value: massValue,
        unit: massUnit,
        display: massDisplay
      },
      volume: {
        symbol: 'V',
        value: volumeValue,
        unit: volumeUnit,
        display: volumeDisplay
      },
      density: {
        symbol: 'D',
        value: densityValue,
        unit: densityUnit,
        display: densityDisplay
      }
    },
    steps: [
      {
        id: 'identify_solve_target',
        type: 'multiple_choice',
        prompt: 'What variable are we solving for?',
        choices: [
          { number: 1, label: 'density', correct: solveFor === 'density' },
          { number: 2, label: 'mass', correct: solveFor === 'mass' },
          { number: 3, label: 'volume', correct: solveFor === 'volume' }
        ],
        expected: solveFor,
        hints: [`The question asks for ${solveFor}.`]
      },
      {
        id: 'choose_formula',
        type: 'multiple_choice',
        prompt: 'Which formula should we use?',
        choices: [
          { number: 1, label: formulaByTarget[solveFor], correct: true },
          { number: 2, label: 'F = m × a', correct: false },
          { number: 3, label: 'speed = distance / time', correct: false }
        ],
        expected: formulaByTarget[solveFor],
        hints: [`This problem gives the values needed to solve for ${solveFor}.`]
      }
    ].concat(
      buildDensityQuantitySteps({ solveFor, massValue, massUnit, massDisplay, volumeValue, volumeUnit, volumeDisplay, densityValue, densityUnit, densityDisplay }),
      buildDensityCalculationStep({ solveFor, massValue, massUnit, massDisplay, volumeValue, volumeUnit, volumeDisplay, densityValue, densityUnit, densityDisplay, ctx })
    )
  };
}

function buildDensityQuantitySteps(values) {
  const steps = [];
  if (values.solveFor !== 'mass') {
    steps.push({
      id: 'identify_mass',
      type: 'quantity',
      prompt: 'What number should go in for mass, m?',
      expectedValue: values.massValue,
      expectedUnit: values.massUnit,
      expectedDisplay: values.massDisplay,
      hints: [`Look for the number with ${values.massUnit}.`]
    });
  }
  if (values.solveFor !== 'volume') {
    steps.push({
      id: 'identify_volume',
      type: 'quantity',
      prompt: 'What number should go in for volume, V?',
      expectedValue: values.volumeValue,
      expectedUnit: values.volumeUnit,
      expectedDisplay: values.volumeDisplay,
      hints: [`Look for the number with ${values.volumeUnit}.`]
    });
  }
  if (values.solveFor !== 'density') {
    steps.push({
      id: 'identify_density',
      type: 'quantity',
      prompt: 'What number should go in for density, D?',
      expectedValue: values.densityValue,
      expectedUnit: values.densityUnit,
      expectedDisplay: values.densityDisplay,
      hints: ['Look for the density value.']
    });
  }
  return steps;
}

function buildDensityCalculationStep(values) {
  const { solveFor, massValue, volumeValue, densityValue, ctx } = values;

  if (solveFor === 'mass') {
    return {
      id: 'calculate',
      type: 'calculation',
      prompt: `Now substitute: m = ${ctx.cleanNumber(densityValue)} × ${ctx.cleanNumber(volumeValue)}. What is ${ctx.cleanNumber(densityValue)} × ${ctx.cleanNumber(volumeValue)}?`,
      expectedValue: massValue,
      expectedUnit: values.massUnit,
      expectedDisplay: values.massDisplay,
      hints: ['Multiply density by volume.']
    };
  }

  if (solveFor === 'volume') {
    return {
      id: 'calculate',
      type: 'calculation',
      prompt: `Now substitute: V = ${ctx.cleanNumber(massValue)} / ${ctx.cleanNumber(densityValue)}. What is ${ctx.cleanNumber(massValue)} / ${ctx.cleanNumber(densityValue)}?`,
      expectedValue: volumeValue,
      expectedUnit: values.volumeUnit,
      expectedDisplay: values.volumeDisplay,
      hints: ['Divide mass by density.']
    };
  }

  return {
    id: 'calculate',
    type: 'calculation',
    prompt: `Now substitute: D = ${ctx.cleanNumber(massValue)} / ${ctx.cleanNumber(volumeValue)}. What is ${ctx.cleanNumber(massValue)} / ${ctx.cleanNumber(volumeValue)}?`,
    expectedValue: densityValue,
    expectedUnit: values.densityUnit,
    expectedDisplay: values.densityDisplay,
    hints: ['Divide mass by volume.']
  };
}
module.exports = { tryDensity };
