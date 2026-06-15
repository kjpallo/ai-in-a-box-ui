const EARTH_GRAVITY = {
  canonicalName: 'acceleration due to gravity',
  symbol: 'g',
  value: 9.8,
  unit: 'm/s²',
  context: 'near Earth'
};

const GRAVITY_ALIASES = [
  'acceleration due to gravity',
  'gravitational acceleration',
  'gravity',
  'force of gravity',
  'g',
  'accretion due to gracvity',
  'acceleration due to gracvity'
];

function earthGravityQuantity() {
  return {
    value: EARTH_GRAVITY.value,
    unit: 'm/s^2',
    displayUnit: EARTH_GRAVITY.unit,
    isDefault: true,
    source: EARTH_GRAVITY.context,
    symbol: EARTH_GRAVITY.symbol,
    canonicalName: EARTH_GRAVITY.canonicalName
  };
}

function hasGravityAlias(lower) {
  const text = String(lower || '').toLowerCase();
  return GRAVITY_ALIASES.some((alias) => {
    if (alias === 'g') return false;
    return text.includes(alias);
  });
}

function asksForGravityConstant(lower) {
  const text = String(lower || '').toLowerCase();
  const asksAboutSymbolG = /\bwhat(?:\s+is|'s)\s+(?:the\s+)?(?:value\s+of\s+)?g\b/.test(text) ||
    /\bvalue\s+of\s+g\b/.test(text) ||
    /\bg\s+in\s+(?:the\s+)?(?:weight|gravity|potential energy|gpe)\s+formula\b/.test(text);
  if (!hasGravityAlias(text) && !asksAboutSymbolG) return false;

  return /\b(?:what(?:\s+is|'s)|define|find|calculate|determine)\b/.test(text) ||
    asksAboutSymbolG;
}

function gravityAnswerLines() {
  return [
    'Near Earth, acceleration due to gravity is about 9.8 m/s² downward.',
    'In formulas, this is written as g = 9.8 m/s².',
    'For weight or force of gravity, use Fg = m × g.'
  ];
}

function findGravityQuantity(text, ctx) {
  const explicit = ctx.findQuantity(text, ['acceleration due to gravity', 'gravitational acceleration', 'gravity', 'g'], ctx.ACCEL_UNITS, null);
  if (explicit) return explicit;
  return earthGravityQuantity();
}

module.exports = {
  EARTH_GRAVITY,
  GRAVITY_ALIASES,
  asksForGravityConstant,
  earthGravityQuantity,
  findGravityQuantity,
  gravityAnswerLines,
  hasGravityAlias
};
