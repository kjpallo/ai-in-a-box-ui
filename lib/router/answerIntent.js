const NARROW_FACTS = [
  {
    id: 'electrical_power',
    names: ['electrical power', 'electric power', 'power'],
    symbol: 'P',
    units: 'W',
    formula: 'P = V × I'
  },
  {
    id: 'wave_speed',
    names: ['wave speed'],
    symbol: 'v',
    units: 'm/s',
    formula: 'v = f × λ'
  },
  {
    id: 'mass',
    names: ['mass'],
    symbol: 'm',
    units: 'g or kg'
  },
  {
    id: 'volume',
    names: ['volume'],
    symbol: 'V',
    units: 'mL, L, cm³, or m³'
  },
  {
    id: 'density',
    names: ['density'],
    symbol: 'D',
    units: 'g/mL, g/cm³, or kg/m³',
    formula: 'D = m / V'
  },
  {
    id: 'force',
    names: ['force', 'net force'],
    symbol: 'F',
    units: 'N',
    formula: 'F = m × a'
  },
  {
    id: 'acceleration',
    names: ['acceleration', 'accelerashun'],
    symbol: 'a',
    units: 'm/s²',
    formula: 'a = (vf - vi) / t or a = F / m'
  },
  {
    id: 'speed',
    names: ['speed'],
    symbol: 'v',
    units: 'm/s, km/h, or mph',
    formula: 'speed = distance / time'
  },
  {
    id: 'velocity',
    names: ['velocity'],
    symbol: 'v',
    units: 'm/s, km/h, or mph'
  },
  {
    id: 'frequency',
    names: ['frequency'],
    symbol: 'f',
    units: 'Hz'
  },
  {
    id: 'wavelength',
    names: ['wavelength', 'wave length'],
    symbol: 'λ',
    units: 'm'
  },
  {
    id: 'voltage',
    names: ['voltage', 'volt', 'volts'],
    symbol: 'V',
    units: 'V'
  },
  {
    id: 'current',
    names: ['current'],
    symbol: 'I',
    units: 'A'
  },
  {
    id: 'resistance',
    names: ['resistance', 'electrical resistance'],
    symbol: 'R',
    units: 'Ω',
    formula: 'R = V / I'
  }
];

const SYMBOL_MEANINGS = new Map([
  ['m', 'm stands for mass.'],
  ['d', 'D stands for density.'],
  ['f', 'F stands for force.'],
  ['a', 'a stands for acceleration.'],
  ['i', 'I stands for current.'],
  ['r', 'R stands for resistance.'],
  ['p', 'P stands for electrical power.'],
  ['v', 'v can stand for speed or velocity.']
]);

function answerNarrowIntent(message) {
  const text = normalize(message);
  if (!text) return null;

  const symbolMeaning = answerSymbolMeaning(text);
  if (symbolMeaning) return symbolMeaning;

  const fact = findFact(text);
  if (!fact) return null;

  if (hasFormulaIntent(text) && fact.formula) {
    return {
      intent: 'formula_only',
      answer: `${fact.formula}.`,
      notes: `Answered formula-only question for ${fact.id}.`
    };
  }

  if (hasUnitsIntent(text) && fact.units) {
    return {
      intent: 'units_only',
      answer: `${titleFor(fact)} is measured in ${fact.units}.`,
      notes: `Answered units-only question for ${fact.id}.`
    };
  }

  if (hasSymbolIntent(text) && fact.symbol) {
    return {
      intent: 'symbol_only',
      answer: `The symbol for ${titleFor(fact).toLowerCase()} is ${fact.symbol}.`,
      notes: `Answered symbol-only question for ${fact.id}.`
    };
  }

  return null;
}

function answerSymbolMeaning(text) {
  const match = /\bwhat\s+does\s+([a-z])\s+stand\s+for\b/.exec(text);
  if (!match) return null;

  const answer = SYMBOL_MEANINGS.get(match[1]);
  if (!answer) return null;

  return {
    intent: 'symbol_only',
    answer,
    notes: `Answered symbol meaning question for ${match[1]}.`
  };
}

function hasUnitsIntent(text) {
  return /\bunits?\b/.test(text) ||
    /\b(?:measured|mesured)\s+in\b/.test(text) ||
    /\bwhat\s+unit\s+is\b/.test(text);
}

function hasSymbolIntent(text) {
  return /\bsymbol\s+for\b/.test(text) ||
    /\bwhat\s+is\s+the\s+symbol\b/.test(text);
}

function hasFormulaIntent(text) {
  return /\bformula\s+for\b/.test(text) ||
    /\bwhat\s+is\s+the\s+formula\b/.test(text) ||
    /\bwhat\s+formula\s+(?:do|would|can)\s+i\s+use\b/.test(text);
}

function findFact(text) {
  if (/\bohm'?s?\s+law\b/.test(text)) {
    return {
      id: 'ohms_law',
      names: ["ohm's law"],
      formula: 'V = I × R'
    };
  }

  return NARROW_FACTS.find((fact) =>
    fact.names.some((name) => new RegExp(`\\b${escapeRegex(name)}\\b`).test(text))
  ) || null;
}

function titleFor(fact) {
  if (fact.id === 'electrical_power') return 'Electrical power';
  if (fact.id === 'wave_speed') return 'Wave speed';
  return fact.names[0].replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  answerNarrowIntent
};
