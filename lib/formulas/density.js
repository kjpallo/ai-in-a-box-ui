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
    const densityDisplayValue = formatDensityValue(value, ctx);
    const formulaWork = buildDensityFormulaWork({
      solveFor: 'density',
      massValue: m,
      massUnit,
      volumeValue: v,
      volumeUnit,
      densityValue: value,
      densityUnit: resultUnit,
      derivedVolume,
      ctx
    });
    const densityTableLine = densityTableIdentificationLine(value, resultUnit, lower, ctx);
    const floatSinkLines = densityFloatSinkLines(value, resultUnit, lower, ctx);
    return ctx.answer('Recognized density problem: solving for density.', [
      ...densityVolumeLines(derivedVolume, ctx),
      'Use the density formula: D = m / V.',
      `D = ${ctx.cleanNumber(m)} ${massUnit} / ${ctx.cleanNumber(v)} ${volumeUnit}`,
      `D = ${densityDisplayValue} ${resultUnit}`,
      ...floatSinkLines,
      ...(densityTableLine ? [densityTableLine] : [])
    ], formulaWork);
  }

  if (target === 'mass' && density && volume) {
    const v = densityVolumeValue(volume, derivedVolume, ctx);
    const volumeUnit = densityVolumeUnit(volume, derivedVolume);
    const resultUnit = densityUnitFromPrompt(text, density) || densityResultUnit(densityMassUnit(volumeUnit), volumeUnit);
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
    const densityUnit = densityUnitFromPrompt(text, density) || 'g/mL';
    const volumeUnit = densityUnit.includes('cm') ? 'cm³' : 'mL';
    const value = m / density.value;
    const formulaWork = buildDensityFormulaWork({
      solveFor: 'volume',
      massValue: m,
      massUnit: 'g',
      volumeValue: value,
      volumeUnit,
      densityValue: density.value,
      densityUnit,
      ctx
    });
    return ctx.answer('Recognized density problem: solving for volume.', [
      'Use the density formula: volume = mass / density.',
      `V = ${ctx.cleanNumber(m)} g / ${ctx.cleanNumber(density.value)} ${densityUnit}`,
      `V = ${ctx.cleanNumber(value)} ${volumeUnit}`
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
    const targetRegex = new RegExp(`(?:\\bsolve\\s+for\\s+(?:the\\s+)?(?:${pattern})\\b|\\b(?:find|calculate|determine)\\s+(?:the\\s+)?(?:${pattern})\\b|\\bhow\\s+(?:do|would|can)\\s+i\\s+(?:solve\\s+for|find|calculate)\\s+(?:the\\s+)?(?:${pattern})\\b|\\bwhat\\s+formula\\s+(?:do\\s+i\\s+use\\s+)?(?:(?:for|to\\s+find|to\\s+solve\\s+for|finds?)\\s+)(?:the\\s+)?(?:${pattern})\\b)`);
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
  if (!/\b(displacement|water level|graduated cylinder|starts? at|rises? to|rises? from|rose to|water\s+goes\s+from|dropped in|placed in)\b/.test(lower)) return null;

  const shorthand = findDisplacementFromToVolume(text, ctx);
  if (shorthand) return shorthand;

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

function findDisplacementFromToVolume(text, ctx) {
  const unitPattern = ctx.unitPatternFor(ctx.VOLUME_UNITS);
  const number = '(-?\\d+(?:\\.\\d+)?)';
  const pattern = new RegExp(`\\b(?:water\\s+goes\\s+from|water\\s+rises?\\s+from|rises?\\s+from|rose\\s+from|from)\\s+${number}\\s+(?:mL\\s+)?(?:to|up\\s+to)\\s+${number}\\s*(${unitPattern})\\b`, 'i');
  const match = pattern.exec(text);
  if (!match) return null;

  const initial = ctx.quantityFromRawUnit(match[1], match[3], ctx.VOLUME_UNITS);
  const final = ctx.quantityFromRawUnit(match[2], match[3], ctx.VOLUME_UNITS);
  const initialML = ctx.volumeToML(initial);
  const finalML = ctx.volumeToML(final);
  const displaced = finalML - initialML;
  if (!Number.isFinite(displaced) || displaced === 0) return null;

  initial.start = match.index + match[0].indexOf(match[1]);
  initial.end = initial.start + String(match[1]).length;
  final.start = match.index + match[0].indexOf(match[2]);
  final.end = final.start + String(match[2]).length;

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
  if (!/\b(length|width|height|long|wide|tall|measures?|l\s*[×x*]\s*w\s*[×x*]\s*h|rectangular|box|cube|block)\b/.test(lower)) return null;

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
  const byPattern = new RegExp(`${number}\\s*(${unitPattern})\\s*(?:x|×|\\*|by)\\s*${number}\\s*(${unitPattern})\\s*(?:x|×|\\*|by)\\s*${number}\\s*(${unitPattern})`, 'i');
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

  const repeatedUnitPattern = new RegExp(`${number}\\s*(${unitPattern})\\s*(?:x|×|\\*|by)\\s*${number}\\s*(?:x|×|\\*|by)\\s*${number}\\s*(${unitPattern})`, 'i');
  const repeatedUnitMatch = repeatedUnitPattern.exec(text);
  if (repeatedUnitMatch) {
    const length = ctx.quantityFromRawUnit(repeatedUnitMatch[1], repeatedUnitMatch[2], ctx.DISTANCE_UNITS);
    const width = ctx.quantityFromRawUnit(repeatedUnitMatch[3], repeatedUnitMatch[2], ctx.DISTANCE_UNITS);
    const height = ctx.quantityFromRawUnit(repeatedUnitMatch[4], repeatedUnitMatch[5], ctx.DISTANCE_UNITS);
    length.start = repeatedUnitMatch.index + repeatedUnitMatch[0].indexOf(repeatedUnitMatch[1]);
    length.end = length.start + `${repeatedUnitMatch[1]} ${repeatedUnitMatch[2]}`.length;
    width.start = repeatedUnitMatch.index + repeatedUnitMatch[0].indexOf(repeatedUnitMatch[3]);
    width.end = width.start + `${repeatedUnitMatch[3]} ${repeatedUnitMatch[2]}`.length;
    height.start = repeatedUnitMatch.index + repeatedUnitMatch[0].lastIndexOf(repeatedUnitMatch[4]);
    height.end = height.start + `${repeatedUnitMatch[4]} ${repeatedUnitMatch[5]}`.length;
    return { length, width, height };
  }

  const unitlessByPattern = new RegExp(`\\b(?:box|cube|block|measures?)\\b[^\\d]{0,40}${number}\\s*(?:x|×|\\*|by)\\s*${number}\\s*(?:x|×|\\*|by)\\s*${number}\\b`, 'i');
  const unitlessByMatch = unitlessByPattern.exec(text);
  if (unitlessByMatch) {
    const length = quantityFromAssumedCm(unitlessByMatch[1], unitlessByMatch.index + unitlessByMatch[0].indexOf(unitlessByMatch[1]));
    const width = quantityFromAssumedCm(unitlessByMatch[2], unitlessByMatch.index + unitlessByMatch[0].indexOf(unitlessByMatch[2]));
    const height = quantityFromAssumedCm(unitlessByMatch[3], unitlessByMatch.index + unitlessByMatch[0].lastIndexOf(unitlessByMatch[3]));
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

function quantityFromAssumedCm(rawValue, start) {
  return {
    value: Number(rawValue),
    unit: 'cm',
    start,
    end: start + String(rawValue).length
  };
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

function buildDensityFormulaWork({ solveFor, massValue, massUnit, volumeValue, volumeUnit, densityValue, densityUnit, derivedVolume = null, ctx }) {
  const massDisplay = `${ctx.cleanNumber(massValue)} ${massUnit}`;
  const volumeDisplay = `${ctx.cleanNumber(volumeValue)} ${volumeUnit}`;
  const densityDisplay = `${formatDensityValue(densityValue, ctx)} ${densityUnit}`;
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
      ...buildDerivedVolumeVariables(derivedVolume, volumeDisplay, ctx),
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
      buildDerivedVolumeSteps(derivedVolume, ctx),
      buildDensityQuantitySteps({ solveFor, massValue, massUnit, massDisplay, volumeValue, volumeUnit, volumeDisplay, densityValue, densityUnit, densityDisplay, hasDerivedVolume: Boolean(derivedVolume) }),
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
  if (values.solveFor !== 'volume' && !values.hasDerivedVolume) {
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

function buildDerivedVolumeVariables(derivedVolume, volumeDisplay, ctx) {
  if (!derivedVolume) return {};

  if (derivedVolume.kind === 'displacement') {
    return {
      initial: {
        symbol: 'Vi',
        value: derivedVolume.initial,
        unit: 'mL',
        display: `${ctx.cleanNumber(derivedVolume.initial)} mL`
      },
      final: {
        symbol: 'Vf',
        value: derivedVolume.final,
        unit: 'mL',
        display: `${ctx.cleanNumber(derivedVolume.final)} mL`
      },
      objectVolume: {
        symbol: 'V',
        value: derivedVolume.quantity.value,
        unit: 'mL',
        display: volumeDisplay
      }
    };
  }

  if (derivedVolume.kind === 'rectangular') {
    const unit = derivedVolume.unit || 'cm';
    return {
      length: {
        symbol: 'L',
        value: derivedVolume.length,
        unit,
        display: `${ctx.cleanNumber(derivedVolume.length)} ${unit}`
      },
      width: {
        symbol: 'W',
        value: derivedVolume.width,
        unit,
        display: `${ctx.cleanNumber(derivedVolume.width)} ${unit}`
      },
      height: {
        symbol: 'H',
        value: derivedVolume.height,
        unit,
        display: `${ctx.cleanNumber(derivedVolume.height)} ${unit}`
      },
      objectVolume: {
        symbol: 'V',
        value: derivedVolume.quantity.value,
        unit: displayVolumeUnit(derivedVolume.quantity.unit),
        display: volumeDisplay
      }
    };
  }

  if (derivedVolume.kind === 'cube') {
    return {
      side: {
        symbol: 's',
        value: derivedVolume.side,
        unit: 'cm',
        display: `${ctx.cleanNumber(derivedVolume.side)} cm`
      },
      objectVolume: {
        symbol: 'V',
        value: derivedVolume.quantity.value,
        unit: 'cm³',
        display: volumeDisplay
      }
    };
  }

  return {};
}

function buildDerivedVolumeSteps(derivedVolume, ctx) {
  if (!derivedVolume) return [];

  if (derivedVolume.kind === 'displacement') {
    const volumeDisplay = `${ctx.cleanNumber(derivedVolume.quantity.value)} mL`;
    return [
      {
        id: 'identify_initial_volume',
        type: 'quantity',
        prompt: 'What is the initial water volume?',
        expectedValue: derivedVolume.initial,
        expectedUnit: 'mL',
        expectedDisplay: `${ctx.cleanNumber(derivedVolume.initial)} mL`,
        hints: ['Use the starting water level before the object is added.']
      },
      {
        id: 'identify_final_volume',
        type: 'quantity',
        prompt: 'What is the final water volume?',
        expectedValue: derivedVolume.final,
        expectedUnit: 'mL',
        expectedDisplay: `${ctx.cleanNumber(derivedVolume.final)} mL`,
        hints: ['Use the water level after the object is added.']
      },
      {
        id: 'calculate_displacement_volume',
        type: 'calculation',
        prompt: `Find the object's volume by displacement: ${ctx.cleanNumber(derivedVolume.final)} - ${ctx.cleanNumber(derivedVolume.initial)}. What is the object volume?`,
        expectedValue: derivedVolume.quantity.value,
        expectedUnit: 'mL',
        expectedDisplay: volumeDisplay,
        hints: ['Object volume = final water volume - initial water volume.']
      },
      {
        id: 'identify_object_volume',
        type: 'quantity',
        prompt: 'What volume should go into the density formula?',
        expectedValue: derivedVolume.quantity.value,
        expectedUnit: 'mL',
        expectedDisplay: volumeDisplay,
        hints: ['Use the object volume you found by water displacement.']
      }
    ];
  }

  if (derivedVolume.kind === 'rectangular') {
    const unit = derivedVolume.unit || 'cm';
    const volumeUnit = displayVolumeUnit(derivedVolume.quantity.unit);
    const volumeDisplay = `${ctx.cleanNumber(derivedVolume.quantity.value)} ${volumeUnit}`;
    return [
      {
        id: 'identify_length',
        type: 'quantity',
        prompt: 'What is the length?',
        expectedValue: derivedVolume.length,
        expectedUnit: unit,
        expectedDisplay: `${ctx.cleanNumber(derivedVolume.length)} ${unit}`,
        hints: ['Use the first dimension given in the problem.']
      },
      {
        id: 'identify_width',
        type: 'quantity',
        prompt: 'What is the width?',
        expectedValue: derivedVolume.width,
        expectedUnit: unit,
        expectedDisplay: `${ctx.cleanNumber(derivedVolume.width)} ${unit}`,
        hints: ['Use the second dimension given in the problem.']
      },
      {
        id: 'identify_height',
        type: 'quantity',
        prompt: 'What is the height?',
        expectedValue: derivedVolume.height,
        expectedUnit: unit,
        expectedDisplay: `${ctx.cleanNumber(derivedVolume.height)} ${unit}`,
        hints: ['Use the third dimension given in the problem.']
      },
      {
        id: 'calculate_rectangular_volume',
        type: 'calculation',
        prompt: `First find volume: V = ${ctx.cleanNumber(derivedVolume.length)} × ${ctx.cleanNumber(derivedVolume.width)} × ${ctx.cleanNumber(derivedVolume.height)}. What is the volume?`,
        expectedValue: derivedVolume.quantity.value,
        expectedUnit: volumeUnit,
        expectedDisplay: volumeDisplay,
        hints: ['For a rectangular prism, volume = length × width × height.']
      },
      {
        id: 'identify_object_volume',
        type: 'quantity',
        prompt: 'What volume should go into the density formula?',
        expectedValue: derivedVolume.quantity.value,
        expectedUnit: volumeUnit,
        expectedDisplay: volumeDisplay,
        hints: ['Use the rectangular-prism volume you just calculated.']
      }
    ];
  }

  if (derivedVolume.kind === 'cube') {
    const volumeDisplay = `${ctx.cleanNumber(derivedVolume.quantity.value)} cm³`;
    return [
      {
        id: 'identify_side',
        type: 'quantity',
        prompt: 'What is the side length of the cube?',
        expectedValue: derivedVolume.side,
        expectedUnit: 'cm',
        expectedDisplay: `${ctx.cleanNumber(derivedVolume.side)} cm`,
        hints: ['Use the side length given in the problem.']
      },
      {
        id: 'calculate_cube_volume',
        type: 'calculation',
        prompt: `First find volume: V = ${ctx.cleanNumber(derivedVolume.side)} × ${ctx.cleanNumber(derivedVolume.side)} × ${ctx.cleanNumber(derivedVolume.side)}. What is the volume?`,
        expectedValue: derivedVolume.quantity.value,
        expectedUnit: 'cm³',
        expectedDisplay: volumeDisplay,
        hints: ['For a cube, volume = side × side × side.']
      },
      {
        id: 'identify_object_volume',
        type: 'quantity',
        prompt: 'What volume should go into the density formula?',
        expectedValue: derivedVolume.quantity.value,
        expectedUnit: 'cm³',
        expectedDisplay: volumeDisplay,
        hints: ['Use the cube volume you just calculated.']
      }
    ];
  }

  return [];
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

function densityUnitFromPrompt(text, density) {
  if (!density) return '';
  const raw = String(text || '').slice(Math.max(0, density.start || 0), Math.max(0, density.end || 0));
  if (/g\s*\/\s*cm|grams?\s+per\s+cubic\s+centimeter/i.test(raw)) return 'g/cm³';
  if (/g\s*\/\s*mL|grams?\s+per\s+milliliter/i.test(raw)) return 'g/mL';
  return '';
}

function formatDensityValue(value, ctx) {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return ctx.cleanNumber(value);
  return ctx.cleanNumber(Number(value.toFixed(2)));
}

function densityFloatSinkLines(value, resultUnit, lower, ctx) {
  if (!/\bfloat|sink|water\b/.test(lower)) return [];
  if (!/g\/(?:mL|cm³)/.test(resultUnit)) return [];
  const rounded = Number(value.toFixed(2));
  if (rounded > 1) {
    return [`${formatDensityValue(value, ctx)} ${resultUnit} is greater than water's density of about 1 g/mL, so it sinks.`];
  }
  if (rounded < 1) {
    return [`${formatDensityValue(value, ctx)} ${resultUnit} is less than water's density of about 1 g/mL, so it floats.`];
  }
  return [`${formatDensityValue(value, ctx)} ${resultUnit} is about the same as water's density of 1 g/mL.`];
}

function densityTableIdentificationLine(value, resultUnit, lower, ctx) {
  if (!/\bdensity table\b|\bidentify\b/.test(lower)) return '';
  if (!/g\/cm³/.test(resultUnit)) return '';

  const table = [
    { name: 'zinc', density: 7.14 },
    { name: 'nickel', density: 8.92 },
    { name: 'silver', density: 10.5 },
    { name: 'gold', density: 19.32 }
  ];
  const closest = table.reduce((best, candidate) => {
    const distance = Math.abs(candidate.density - value);
    return distance < best.distance ? { ...candidate, distance } : best;
  }, { name: '', density: 0, distance: Infinity });

  if (!closest.name) return '';
  return `Using the density table, ${formatDensityValue(value, ctx)} g/cm³ is closest to ${closest.name}, about ${ctx.cleanNumber(closest.density)} g/cm³.`;
}
module.exports = { tryDensity };
