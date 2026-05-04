// Shared formula parser and unit helpers.
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
const VOLUME_UNITS = [unit('mL', null, null, ['milliliters', 'milliliter', 'ml']), unit('L', null, null, ['liters', 'liter', 'l']), unit('cm^3', null, null, ['cm^3', 'cm³', 'cm3'])];
const FORCE_UNITS = [unit('N', null, null, ['newtons', 'newton', 'n'])];
const ACCEL_UNITS = [
  unit('m/s^2', 'm', 's', ['meters per second squared', 'meter per second squared', 'm/s^2', 'm/s²', 'm/s/s']),
  unit('ft/s^2', 'ft', 's', ['feet per second squared', 'foot per second squared', 'ft/s^2', 'ft/s²', 'ft/s/s'])
];
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
  const explicit = findExplicitQuantity(text, labels, unitDefs, defaultUnit);
  if (explicit) return explicit;

  return findNumberWithUnit(text, unitDefs);
}

function findExplicitQuantity(text, labels, unitDefs, defaultUnit) {
  const naturalLabels = labels.filter((label) => label.length > 1);
  const symbolLabels = labels.filter((label) => label.length === 1);
  const unitPattern = unitDefs.flatMap((def) => def.names).map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const number = '-?\\d+(?:\\.\\d+)?';
  const unitEnd = unitEndBoundary();

  if (naturalLabels.length) {
    const labelPattern = naturalLabels.map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
    let match = new RegExp(`\\b(?:${labelPattern})\\b\\s*(?:is|=|:|of|as|equals?)?\\s*(${number})\\s*(${unitPattern})?${unitEnd}`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);

    match = new RegExp(`(${number})\\s*(${unitPattern})?${unitEnd}\\s*(?:of\\s+)?(?:${labelPattern})\\b`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);
  }

  if (symbolLabels.length) {
    const symbolPattern = symbolLabels.map(escapeRegex).join('|');
    const match = new RegExp(`\\b(?:${symbolPattern})\\b\\s*(?:=|:)\\s*(${number})\\s*(${unitPattern})?${unitEnd}`, 'i').exec(text);
    if (match) return buildQuantity(match, unitDefs, defaultUnit);
  }

  return null;
}

function findNumberWithUnit(text, unitDefs) {
  const unitPattern = unitDefs.flatMap((def) => def.names).map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const match = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})${unitEndBoundary()}`, 'i').exec(text);
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
  let text = value.replace(/(\d),(?=\d{3}\b)/g, '$1');

  const ones = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9
  };
  const teens = {
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19
  };
  const tens = {
    twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };

  for (const [tenWord, tenValue] of Object.entries(tens)) {
    const onesPattern = Object.keys(ones).join('|');
    text = text.replace(new RegExp(`\\b${tenWord}[-\\s]+(${onesPattern})\\b`, 'gi'), (_match, oneWord) => {
      return String(tenValue + ones[oneWord.toLowerCase()]);
    });
  }

  for (const [word, number] of Object.entries({ ...teens, ...tens, ...ones })) {
    text = text.replace(new RegExp(`\\b${word}\\b`, 'gi'), String(number));
  }

  return text;
}

function mask(text, start, end) {
  return text.slice(0, start) + ' '.repeat(Math.max(0, end - start)) + text.slice(end);
}




function unitPatternFor(unitDefs) {
  return unitDefs
    .flatMap((def) => [...def.names, def.canonical])
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join('|');
}

function unitEndBoundary() {
  return '(?=$|[^A-Za-z0-9/²³^])';
}

function questionTargetRegex(targetPattern) {
  return new RegExp(`\\b(?:what is|what's|find|calculate|solve for|determine)\\s+(?:(?:my|the)\\s+)?(?:[a-z0-9-]+(?:['’]s)?\\s+)?(?:${targetPattern})\\b`);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
module.exports = {
  ACCEL_UNITS,
  DENSITY_UNITS,
  DISTANCE_UNITS,
  ENERGY_UNITS,
  FORCE_UNITS,
  FREQUENCY_UNITS,
  MASS_UNITS,
  MOMENTUM_UNITS,
  POWER_UNITS,
  RESISTANCE_UNITS,
  SPEED_UNITS,
  TIME_UNITS,
  VELOCITY_UNITS,
  VOLTAGE_UNITS,
  CURRENT_UNITS,
  VOLUME_UNITS,
  convertDistance,
  convertTime,
  escapeRegex,
  findExplicitQuantity,
  findNumberWithUnit,
  findQuantity,
  mask,
  massToGrams,
  massToKg,
  normalizeNumberWords,
  questionTargetRegex,
  targetFromQuestion,
  unitEndBoundary,
  unitPatternFor,
  velocityToMS,
  volumeToML
};
