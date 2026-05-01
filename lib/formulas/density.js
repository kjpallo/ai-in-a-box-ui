function tryDensity(text, lower, ctx) {
  if (!/\b(density|mass|volume)\b|\bd\s*=|\bm\s*=|\bv\s*=/.test(lower)) return null;

  const density = ctx.findQuantity(text, ['density'], ctx.DENSITY_UNITS, null);
  const mass = ctx.findQuantity(text, ['mass'], ctx.MASS_UNITS, null);
  const derivedVolume = findDisplacementVolume(text, lower, ctx) ||
    findCubeVolume(text, lower, ctx) ||
    findRectangularVolume(text, lower, ctx);
  const volume = (derivedVolume && derivedVolume.quantity) ||
    ctx.findQuantity(text, ['volume'], ctx.VOLUME_UNITS, null);
  const target = ctx.targetFromQuestion(lower, ['density', 'mass', 'volume'], { density, mass, volume });

  if (target === 'density' && mass && volume && volume.value !== 0) {
    const v = densityVolumeValue(volume, derivedVolume, ctx);
    const volumeUnit = densityVolumeUnit(volume, derivedVolume);
    const massUnit = densityMassUnit(volumeUnit);
    const m = densityMassValue(mass, massUnit, ctx);
    const resultUnit = densityResultUnit(massUnit, volumeUnit);
    const value = m / v;
    return ctx.answer('Recognized density problem: solving for density.', [
      ...densityVolumeLines(derivedVolume, ctx),
      'Use the density formula: D = m / V.',
      `D = ${ctx.cleanNumber(m)} ${massUnit} / ${ctx.cleanNumber(v)} ${volumeUnit}`,
      `D = ${ctx.cleanNumber(value)} ${resultUnit}`
    ]);
  }

  if (target === 'mass' && density && volume) {
    const v = densityVolumeValue(volume, derivedVolume, ctx);
    const volumeUnit = densityVolumeUnit(volume, derivedVolume);
    const resultUnit = densityResultUnit(densityMassUnit(volumeUnit), volumeUnit);
    const value = density.value * v;
    return ctx.answer('Recognized density problem: solving for mass.', [
      ...densityVolumeLines(derivedVolume, ctx),
      'Use the density formula: mass = density × volume.',
      `m = ${ctx.cleanNumber(density.value)} ${resultUnit} × ${ctx.cleanNumber(v)} ${volumeUnit}`,
      `m = ${ctx.cleanNumber(value)} g`
    ]);
  }

  if (target === 'volume' && mass && density && density.value !== 0) {
    const m = ctx.massToGrams(mass);
    const value = m / density.value;
    return ctx.answer('Recognized density problem: solving for volume.', [
      'Use the density formula: volume = mass / density.',
      `V = ${ctx.cleanNumber(m)} g / ${ctx.cleanNumber(density.value)} g/mL`,
      `V = ${ctx.cleanNumber(value)} mL`
    ]);
  }

  if (target === 'volume' && derivedVolume) {
    return ctx.answer('Recognized volume problem.', densityVolumeLines(derivedVolume, ctx));
  }

  return null;
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

module.exports = { tryDensity };
