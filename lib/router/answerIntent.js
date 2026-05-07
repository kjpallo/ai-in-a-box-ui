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

  const ambiguousNarrowAnswer = answerAmbiguousNarrowQuestion(text);
  if (ambiguousNarrowAnswer) return ambiguousNarrowAnswer;

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
  const symbol = findSymbolMeaningTarget(text);
  if (!symbol) return null;

  const answer = SYMBOL_MEANINGS.get(symbol);
  if (!answer) return null;

  return {
    intent: 'symbol_only',
    answer,
    notes: `Answered symbol meaning question for ${symbol}.`
  };
}

function answerAmbiguousNarrowQuestion(text) {
  if (hasFormulaIntent(text)) {
    const powerAnswer = answerPowerFormulaQuestion(text);
    if (powerAnswer) return powerAnswer;

    const accelerationAnswer = answerAccelerationFormulaQuestion(text);
    if (accelerationAnswer) return accelerationAnswer;

    const volumeAnswer = answerVolumeFormulaQuestion(text);
    if (volumeAnswer) return volumeAnswer;
  }

  const symbolAnswer = answerAmbiguousSymbolMeaning(text);
  if (symbolAnswer) return symbolAnswer;

  return null;
}

function answerVolumeFormulaQuestion(text) {
  if (!/\bvolume\b/.test(text)) return null;

  return {
    intent: 'formula_only',
    answer: [
      'There is more than one volume formula:',
      '',
      '1. Density volume: V = m / D',
      '2. Rectangular volume: V = l × w × h',
      '3. Cube volume: V = s³',
      '',
      'Which one are you working on?'
    ].join('\n'),
    notes: 'Asked clarification for ambiguous volume formula question.'
  };
}

function answerPowerFormulaQuestion(text) {
  if (!/\bpower\b/.test(text)) return null;

  if (/\b(?:electrical|electric|circuit|voltage|volt|volts|current|amps?|amperes?|ampere)\b/.test(text)) {
    return {
      intent: 'formula_only',
      answer: 'P = V × I.',
      notes: 'Answered formula-only question for electrical_power.'
    };
  }

  if (/\b(?:work|time|seconds?|minutes?|hours?|joules?|j)\b/.test(text)) {
    return {
      intent: 'formula_only',
      answer: 'P = W / t.',
      notes: 'Answered formula-only question for work_time_power.'
    };
  }

  return {
    intent: 'formula_only',
    answer: [
      'There are two common power formulas:',
      '',
      '1. Electrical power: P = V × I',
      '2. Work/time power: P = W / t',
      '',
      'Which one are you working on?'
    ].join('\n'),
    notes: 'Asked clarification for ambiguous power formula question.'
  };
}

function answerAccelerationFormulaQuestion(text) {
  if (!/\b(?:acceleration|accelerashun)\b/.test(text)) return null;

  if (/\b(?:force|net force|mass|newtons?|n\b|f\s*=|f\s*\/|f\s+and\s+m|m\s+and\s+f)\b/.test(text)) {
    return {
      intent: 'formula_only',
      answer: 'a = F / m.',
      notes: 'Answered formula-only question for acceleration from force and mass.'
    };
  }

  if (/\b(?:velocity|speed|initial|final|vf|vi|time|seconds?|change)\b/.test(text)) {
    return {
      intent: 'formula_only',
      answer: 'a = (vf - vi) / t.',
      notes: 'Answered formula-only question for acceleration from velocity change.'
    };
  }

  return {
    intent: 'formula_only',
    answer: [
      'There are two common acceleration formulas:',
      '',
      '1. Change in velocity over time: a = (vf - vi) / t',
      '2. From force and mass: a = F / m',
      '',
      'Which one are you working on?'
    ].join('\n'),
    notes: 'Asked clarification for ambiguous acceleration formula question.'
  };
}

function answerAmbiguousSymbolMeaning(text) {
  const symbol = findSymbolMeaningTarget(text);
  if (!symbol) return null;

  if (symbol === 'v') {
    if (/\bdensity\b/.test(text)) {
      return {
        intent: 'symbol_only',
        answer: 'In density, V means volume.',
        notes: 'Answered symbol meaning question for V in density.'
      };
    }

    if (/\b(?:electricity|electrical|electric|circuit|voltage|volt|volts|ohm'?s?\s+law)\b/.test(text)) {
      return {
        intent: 'symbol_only',
        answer: 'In electricity, V means voltage.',
        notes: 'Answered symbol meaning question for V in electricity.'
      };
    }

    if (/\b(?:velocity|speed|motion)\b/.test(text)) {
      return {
        intent: 'symbol_only',
        answer: /\bspeed\b/.test(text)
          ? 'In speed problems, v means velocity or speed.'
          : 'In motion, v means velocity or speed.',
        notes: 'Answered symbol meaning question for v in motion.'
      };
    }

    return {
      intent: 'symbol_only',
      answer: [
        'v or V can mean more than one thing:',
        '',
        '1. v — velocity or speed',
        '2. V — volume',
        '3. V — voltage',
        '',
        'Which one are you working on?'
      ].join('\n'),
      notes: 'Asked clarification for ambiguous V symbol question.'
    };
  }

  if (symbol === 'm') {
    if (/\bf\s*=\s*m\s*a\b|\bf\s*=\s*ma\b|\bforce\b|\bacceleration\b|\bmass\b/.test(text)) {
      return {
        intent: 'symbol_only',
        answer: 'In F = ma, m means mass.',
        notes: 'Answered symbol meaning question for m in F = ma.'
      };
    }

    if (/\bmeters?|metres?|distance|length\b/.test(text)) {
      return {
        intent: 'symbol_only',
        answer: 'm is the abbreviation for meters.',
        notes: 'Answered symbol meaning question for m as meters.'
      };
    }

    return {
      intent: 'symbol_only',
      answer: [
        'm can mean more than one thing:',
        '',
        '1. Mass — the amount of matter in an object',
        '2. Meter — a unit for distance or length',
        '',
        'Which one are you working on?'
      ].join('\n'),
      notes: 'Asked clarification for ambiguous m symbol question.'
    };
  }

  if (symbol === 'p') {
    return {
      intent: 'symbol_only',
      answer: [
        'P can mean more than one thing:',
        '',
        '1. Power — how fast energy is transferred or work is done',
        '2. Pressure — force spread over an area',
        '',
        'Which one are you working on?'
      ].join('\n'),
      notes: 'Asked clarification for ambiguous P symbol question.'
    };
  }

  return null;
}

function findSymbolMeaningTarget(text) {
  const patterns = [
    /\bwhat\s+does\s+([a-z])\s+(?:stand\s+for|mean)\b/,
    /\bwhat\s+is\s+(?:the\s+)?symbol\s+([a-z])\b/,
    /\bsymbol\s+([a-z])\b/,
    /\bwhat\s+is\s+([a-z])(?:\s+in\b|[?.!]*$)/
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return match[1];
  }

  return null;
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
  const typoMap = new Map([
    ['vloume', 'volume'],
    ['volme', 'volume'],
    ['volum', 'volume'],
    ['denisty', 'density'],
    ['dencity', 'density'],
    ['accelleration', 'acceleration'],
    ['accleration', 'acceleration'],
    ['resitance', 'resistance'],
    ['eletrical', 'electrical']
  ]);

  return String(value || '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\b(?:vloume|volme|volum|denisty|dencity|accelleration|accleration|resitance|eletrical)\b/g, (term) => typoMap.get(term) || term)
    .trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  answerNarrowIntent
};
