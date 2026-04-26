function tryScienceFormula(message) {
  const text = String(message || '');
  const lower = text.toLowerCase();

  if (lower.includes('density') || /\bd\s*=/.test(lower)) {
    const mass = findMass(text, 'g');
    const volume = findVolume(text, 'mL');

    if (mass && volume && volume.value !== 0) {
      const m = massForDensity(mass);
      const v = volumeForDensity(volume);
      const density = m.value / v.value;

      return answer('Recognized density problem with mass and volume.', [
        'Use the density formula: D = m / V.',
        `D = ${cleanNumber(m.value)} ${m.unit} / ${cleanNumber(v.value)} ${v.unit}`,
        `D = ${cleanNumber(density)} ${m.unit}/${v.unit}`
      ]);
    }
  }

  if (lower.includes('weight') || lower.includes('force of gravity') || lower.includes('weigh')) {
    const mass = findMass(text, 'kg');

    if (mass) {
      const gravity = findLabeledNumber(text, ['gravity', 'g'], ['m/s^2', 'm/s²', 'm/s/s'], 'm/s^2') || {
        value: 9.8,
        unit: 'm/s^2',
        assumed: true
      };

      const m = massForForce(mass);
      const weight = m.value * gravity.value;

      return answer(
        gravity.assumed
          ? 'Recognized weight problem and used Earth gravity, 9.8 m/s^2.'
          : 'Recognized weight problem with mass and gravity.',
        [
          'Use the weight formula: Fg = m × g.',
          gravity.assumed ? 'For Earth, use g = 9.8 m/s^2.' : `g = ${cleanNumber(gravity.value)} ${gravity.unit}`,
          `Fg = ${cleanNumber(m.value)} kg × ${cleanNumber(gravity.value)} m/s^2`,
          `Fg = ${cleanNumber(weight)} N`
        ]
      );
    }
  }

  if (lower.includes('force') && (lower.includes('mass') || /\bm\s*=/.test(lower)) && (lower.includes('acceleration') || /\ba\s*=/.test(lower) || lower.includes('m/s'))) {
    const mass = findMass(text, 'kg');
    const acceleration = findAcceleration(text);

    if (mass && acceleration) {
      const m = massForForce(mass);
      const force = m.value * acceleration.value;

      return answer('Recognized force problem with mass and acceleration.', [
        "Use Newton's second law: F = m × a.",
        `F = ${cleanNumber(m.value)} kg × ${cleanNumber(acceleration.value)} m/s^2`,
        `F = ${cleanNumber(force)} N`
      ]);
    }
  }

  if (lower.includes('acceleration') && (lower.includes('change in velocity') || lower.includes('delta v') || lower.includes('velocity change'))) {
    const velocityChange =
      findLabeledNumber(text, ['change in velocity', 'velocity change', 'delta v'], ['m/s', 'meters per second'], 'm/s') ||
      findNumberWithUnit(text, ['m/s', 'meters per second']);

    const time = findTime(text, 's');

    if (velocityChange && time && time.value !== 0) {
      const acceleration = velocityChange.value / time.value;

      return answer('Recognized acceleration problem with change in velocity and time.', [
        'Use the acceleration formula: a = Δv / t.',
        `a = ${cleanNumber(velocityChange.value)} m/s / ${cleanNumber(time.value)} ${time.unit}`,
        `a = ${cleanNumber(acceleration)} m/s^2`
      ]);
    }
  }

  if (lower.includes('speed') || lower.includes('velocity') || /\bs\s*=/.test(lower)) {
    const distance = findDistance(text, 'units');
    const time = findTime(text, 'time unit');

    if (distance && time && time.value !== 0) {
      const speed = distance.value / time.value;

      return answer('Recognized speed problem with distance and time.', [
        'Use the speed formula: speed = distance / time.',
        `speed = ${cleanNumber(distance.value)} ${distance.unit} / ${cleanNumber(time.value)} ${time.unit}`,
        `speed = ${cleanNumber(speed)} ${distance.unit}/${time.unit}`
      ]);
    }
  }

  return null;
}

function answer(notes, lines) {
  return { notes, answer: lines.join('\n') };
}

function findMass(text, defaultUnit) {
  return findLabeledNumber(text, ['mass', 'm'], ['kilograms', 'kilogram', 'grams', 'gram', 'kg', 'g'], defaultUnit) ||
    findNumberWithUnit(text, ['kilograms', 'kilogram', 'grams', 'gram', 'kg', 'g']);
}

function findVolume(text, defaultUnit) {
  return findLabeledNumber(text, ['volume', 'v'], ['milliliters', 'milliliter', 'liters', 'liter', 'cm^3', 'cm3', 'ml', 'l'], defaultUnit) ||
    findNumberWithUnit(text, ['milliliters', 'milliliter', 'liters', 'liter', 'cm^3', 'cm3', 'ml', 'l']);
}

function findDistance(text, defaultUnit) {
  return findLabeledNumber(text, ['distance', 'd'], ['kilometers', 'kilometer', 'meters', 'meter', 'centimeters', 'centimeter', 'miles', 'mile', 'feet', 'km', 'cm', 'mi', 'ft', 'm'], defaultUnit) ||
    findNumberWithUnit(text, ['kilometers', 'kilometer', 'meters', 'meter', 'centimeters', 'centimeter', 'miles', 'mile', 'feet', 'km', 'cm', 'mi', 'ft', 'm']);
}

function findTime(text, defaultUnit) {
  return findLabeledNumber(text, ['time', 't'], ['seconds', 'second', 'minutes', 'minute', 'hours', 'hour', 'secs', 'sec', 'mins', 'min', 'hrs', 'hr', 's'], defaultUnit) ||
    findNumberWithUnit(text, ['seconds', 'second', 'minutes', 'minute', 'hours', 'hour', 'secs', 'sec', 'mins', 'min', 'hrs', 'hr', 's']);
}

function findAcceleration(text) {
  return findLabeledNumber(text, ['acceleration', 'a'], ['m/s^2', 'm/s²', 'm/s/s'], 'm/s^2') ||
    findNumberWithUnit(text, ['m/s^2', 'm/s²', 'm/s/s']);
}

function findLabeledNumber(text, labels, units, defaultUnit = '') {
  const labelPattern = labels.map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const unitPattern = units.map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const regex = new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:is|=|:|of|as)?\\s*(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})?`, 'i');
  const match = text.match(regex);

  if (!match) return null;

  return {
    value: Number(match[1]),
    unit: normalizeUnit(match[2] || defaultUnit)
  };
}

function findNumberWithUnit(text, units) {
  const unitPattern = units.map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const regex = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})(?=$|[^A-Za-z0-9])`, 'i');
  const match = text.match(regex);

  if (!match) return null;

  return {
    value: Number(match[1]),
    unit: normalizeUnit(match[2])
  };
}

function massForDensity(mass) {
  if (mass.unit === 'kg') return { value: mass.value * 1000, unit: 'g' };
  return { value: mass.value, unit: 'g' };
}

function volumeForDensity(volume) {
  if (volume.unit === 'L') return { value: volume.value * 1000, unit: 'mL' };
  if (volume.unit === 'cm^3') return { value: volume.value, unit: 'cm^3' };
  return { value: volume.value, unit: 'mL' };
}

function massForForce(mass) {
  if (mass.unit === 'g') return { value: mass.value / 1000, unit: 'kg' };
  return { value: mass.value, unit: 'kg' };
}

function normalizeUnit(unit) {
  const lower = String(unit || '').trim().toLowerCase();

  if (['gram', 'grams', 'g'].includes(lower)) return 'g';
  if (['kilogram', 'kilograms', 'kg'].includes(lower)) return 'kg';
  if (['milliliter', 'milliliters', 'ml'].includes(lower)) return 'mL';
  if (['liter', 'liters', 'l'].includes(lower)) return 'L';
  if (['cm^3', 'cm3'].includes(lower)) return 'cm^3';
  if (['meter', 'meters', 'm'].includes(lower)) return 'm';
  if (['kilometer', 'kilometers', 'km'].includes(lower)) return 'km';
  if (['centimeter', 'centimeters', 'cm'].includes(lower)) return 'cm';
  if (['second', 'seconds', 'sec', 'secs', 's'].includes(lower)) return 's';
  if (['minute', 'minutes', 'min', 'mins'].includes(lower)) return 'min';
  if (['hour', 'hours', 'hr', 'hrs'].includes(lower)) return 'hr';
  if (['m/s^2', 'm/s²', 'm/s/s'].includes(lower)) return 'm/s^2';
  if (['m/s', 'meters per second'].includes(lower)) return 'm/s';

  return unit || '';
}

function cleanNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4))).replace(/\.0+$/, '');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { tryScienceFormula };
