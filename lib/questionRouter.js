const CHEMISTRY_CHEAT_SHEET = [
  {
    formula: 'NaCl',
    name: 'sodium chloride',
    type: 'ionic compound',
    note: 'Sodium chloride is table salt. It is made from sodium ions and chloride ions.'
  },
  {
    formula: 'H2O',
    name: 'water',
    type: 'covalent compound',
    note: 'Water is made of hydrogen and oxygen.'
  },
  {
    formula: 'CO2',
    name: 'carbon dioxide',
    type: 'covalent compound',
    note: 'Carbon dioxide is a gas made of carbon and oxygen.'
  },
  {
    formula: 'O2',
    name: 'oxygen gas',
    type: 'diatomic element',
    note: 'Oxygen gas is made of two oxygen atoms bonded together.'
  },
  {
    formula: 'H2',
    name: 'hydrogen gas',
    type: 'diatomic element',
    note: 'Hydrogen gas is made of two hydrogen atoms bonded together.'
  },
  {
    formula: 'N2',
    name: 'nitrogen gas',
    type: 'diatomic element',
    note: 'Nitrogen gas is made of two nitrogen atoms bonded together.'
  },
  {
    formula: 'NH3',
    name: 'ammonia',
    type: 'covalent compound',
    note: 'Ammonia is made of nitrogen and hydrogen.'
  },
  {
    formula: 'CH4',
    name: 'methane',
    type: 'covalent compound',
    note: 'Methane is made of carbon and hydrogen.'
  },
  {
    formula: 'C6H12O6',
    name: 'glucose',
    type: 'covalent compound',
    note: 'Glucose is a simple sugar made of carbon, hydrogen, and oxygen.'
  }
];

const ROUTER_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'did', 'do', 'does',
  'for', 'from', 'how', 'i', 'in', 'is', 'it', 'mean', 'means', 'of', 'on', 'or',
  'the', 'this', 'to', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you'
]);

function routeStudentQuestion(message, matchedKnowledge = []) {
  const text = String(message || '').trim();
  const normalized = normalize(text);

  const mathResult = tryMathOnly(text);
  if (mathResult) {
    return makeRoute({
      type: 'math_only',
      confidence: 'strong',
      toolsUsed: ['calculator'],
      notes: `Calculated ${mathResult.expression} locally.`,
      directAnswer: mathResult.answer,
      aiAllowed: false
    });
  }

  const chemistryResult = tryChemistryFormula(text);
  if (chemistryResult) {
    return makeRoute({
      type: 'chemistry_formula',
      confidence: 'strong',
      toolsUsed: ['chemistry_cheat_sheet'],
      notes: `Found ${chemistryResult.formula} as ${chemistryResult.name}.`,
      directAnswer: `${chemistryResult.formula} is ${chemistryResult.name}. It is a ${chemistryResult.type}. ${chemistryResult.note}`,
      aiAllowed: false
    });
  }

  const scienceFormulaResult = tryScienceFormula(text);
  if (scienceFormulaResult) {
    return makeRoute({
      type: 'science_formula',
      confidence: 'strong',
      toolsUsed: ['science_formula_rules'],
      notes: scienceFormulaResult.notes,
      directAnswer: scienceFormulaResult.answer,
      aiAllowed: false
    });
  }

  const bestKnowledge = matchedKnowledge[0] || null;
  if (bestKnowledge) {
    const isStrong = Boolean(bestKnowledge.exactTermMatch || bestKnowledge.exactTitleMatch || bestKnowledge.score >= 18);
    const isDefinitionQuestion = looksLikeDefinitionQuestion(normalized);

    return makeRoute({
      type: isDefinitionQuestion ? 'definition' : 'class_fact',
      confidence: isStrong ? 'strong' : 'weak',
      toolsUsed: ['teacher_facts'],
      notes: isStrong
        ? `Found strong local match: ${bestKnowledge.title}.`
        : `Found related local match: ${bestKnowledge.title}.`,
      directAnswer: buildKnowledgeAnswer(bestKnowledge, isStrong),
      aiAllowed: false
    });
  }

  const possibleScience = looksLikeScienceQuestion(normalized);
  return makeRoute({
    type: possibleScience ? 'no_match' : 'no_match',
    confidence: 'none',
    toolsUsed: [],
    notes: possibleScience
      ? 'No trusted local science match found. Blocking free science answer.'
      : 'No trusted local match found.',
    directAnswer: possibleScience
      ? 'I do not have a trusted local science fact for that yet. Please reword the question with the vocabulary word, formula, or numbers you are asking about, or ask your teacher.'
      : 'I do not have a trusted local fact for that yet. Please reword the question or ask your teacher.',
    aiAllowed: false
  });
}

function makeRoute(route) {
  return {
    type: route.type,
    confidence: route.confidence,
    toolsUsed: route.toolsUsed || [],
    notes: route.notes || '',
    directAnswer: route.directAnswer || '',
    aiAllowed: Boolean(route.aiAllowed),
    public: {
      type: route.type,
      confidence: route.confidence,
      toolsUsed: route.toolsUsed || [],
      notes: route.notes || '',
      aiAllowed: Boolean(route.aiAllowed)
    }
  };
}

function buildKnowledgeAnswer(item, isStrong) {
  const prefix = isStrong ? '' : 'I found something related. ';
  const lines = [];

  if (item.fact) {
    lines.push(`${prefix}In 9th-grade science, ${item.fact}`);
  } else {
    lines.push(`${prefix}I found ${item.title}, but the local fact is incomplete.`);
  }

  if (item.formula) {
    lines.push(`Formula: ${item.formula}`);
  }

  if (Array.isArray(item.examples) && item.examples.length > 0) {
    lines.push(`Example: ${item.examples[0]}`);
  }

  return lines.join('\n');
}

function tryChemistryFormula(message) {
  const compactMessage = message.replace(/\s+/g, '');

  return CHEMISTRY_CHEAT_SHEET.find((item) => {
    const formulaRegex = new RegExp(`(^|[^A-Za-z0-9])${escapeRegex(item.formula)}([^A-Za-z0-9]|$)`, 'i');
    const compactFormulaRegex = new RegExp(escapeRegex(item.formula), 'i');
    const nameRegex = new RegExp(`(^|\\b)${escapeRegex(item.name)}(\\b|$)`, 'i');
    return formulaRegex.test(message) || compactFormulaRegex.test(compactMessage) || nameRegex.test(message);
  });
}

function tryScienceFormula(message) {
  const lower = message.toLowerCase();

  if (lower.includes('density')) {
    const mass = extractNumberWithUnit(message, ['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms']);
    const volume = extractNumberWithUnit(message, ['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'cm3', 'cm^3']);

    if (mass && volume) {
      let massValue = mass.value;
      let volumeValue = volume.value;
      let massUnit = mass.unit;
      let volumeUnit = volume.unit;

      if (massUnit.startsWith('kg')) {
        massValue *= 1000;
        massUnit = 'g';
      }

      if (volumeUnit === 'l' || volumeUnit.startsWith('liter')) {
        volumeValue *= 1000;
        volumeUnit = 'mL';
      }

      const density = massValue / volumeValue;
      const densityText = cleanNumber(density);
      const volumeText = volumeUnit.includes('cm') ? 'cm^3' : 'mL';

      return {
        notes: 'Recognized density problem with mass and volume.',
        answer: `Use the density formula: D = m / V.\nD = ${cleanNumber(massValue)} ${massUnit} / ${cleanNumber(volumeValue)} ${volumeText}\nD = ${densityText} g/${volumeText}`
      };
    }
  }

  if (lower.includes('force') && lower.includes('mass') && (lower.includes('acceleration') || lower.includes('m/s'))) {
    const numbers = extractNumbers(message);
    if (numbers.length >= 2) {
      const force = numbers[0] * numbers[1];
      return {
        notes: 'Recognized force problem with mass and acceleration.',
        answer: `Use Newton's second law: F = m × a.\nF = ${cleanNumber(numbers[0])} × ${cleanNumber(numbers[1])}\nF = ${cleanNumber(force)} N`
      };
    }
  }

  if ((lower.includes('speed') || lower.includes('velocity')) && lower.includes('distance') && lower.includes('time')) {
    const numbers = extractNumbers(message);
    if (numbers.length >= 2) {
      const speed = numbers[0] / numbers[1];
      return {
        notes: 'Recognized speed problem with distance and time.',
        answer: `Use the speed formula: speed = distance / time.\nSpeed = ${cleanNumber(numbers[0])} / ${cleanNumber(numbers[1])}\nSpeed = ${cleanNumber(speed)} units per time unit`
      };
    }
  }

  return null;
}

function tryMathOnly(message) {
  const expression = wordsToMathExpression(message);
  if (!expression) return null;
  if (!/^[0-9+\-*/().\s]+$/.test(expression)) return null;
  if (!/[+\-*/]/.test(expression)) return null;

  try {
    const value = evaluateArithmetic(expression);
    if (!Number.isFinite(value)) return null;
    return {
      expression: expression.replace(/\s+/g, ' ').trim(),
      answer: `${expression.replace(/\s+/g, ' ').trim()} = ${cleanNumber(value)}`
    };
  } catch {
    return null;
  }
}

function wordsToMathExpression(message) {
  let text = message.toLowerCase();
  text = text.replace(/[?]/g, ' ');
  text = text.replace(/\bwhat is\b/g, ' ');
  text = text.replace(/\bwhat's\b/g, ' ');
  text = text.replace(/\bcalculate\b/g, ' ');
  text = text.replace(/\bsolve\b/g, ' ');
  text = text.replace(/\bequals?\b/g, ' ');
  text = text.replace(/\btimes\b|\bmultiplied by\b|\bx\b/g, '*');
  text = text.replace(/\bdivided by\b|\bover\b/g, '/');
  text = text.replace(/\bplus\b|\badd\b/g, '+');
  text = text.replace(/\bminus\b|\bsubtract\b/g, '-');
  text = text.replace(/[^0-9+\-*/().\s]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function evaluateArithmetic(expression) {
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+\-*/]/g);
  if (!tokens) throw new Error('No tokens');
  let position = 0;

  function parseExpression() {
    let value = parseTerm();
    while (tokens[position] === '+' || tokens[position] === '-') {
      const op = tokens[position++];
      const right = parseTerm();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    while (tokens[position] === '*' || tokens[position] === '/') {
      const op = tokens[position++];
      const right = parseFactor();
      value = op === '*' ? value * right : value / right;
    }
    return value;
  }

  function parseFactor() {
    const token = tokens[position++];
    if (token === '-') return -parseFactor();
    if (token === '(') {
      const value = parseExpression();
      if (tokens[position++] !== ')') throw new Error('Missing closing parenthesis');
      return value;
    }
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error('Expected number');
    return value;
  }

  const value = parseExpression();
  if (position !== tokens.length) throw new Error('Unexpected token');
  return value;
}

function extractNumberWithUnit(message, allowedUnits) {
  const unitPattern = allowedUnits.map(escapeRegex).join('|');
  const regex = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, 'i');
  const match = message.match(regex);
  if (!match) return null;
  return { value: Number(match[1]), unit: match[2].toLowerCase() };
}

function extractNumbers(message) {
  return (message.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
}

function looksLikeDefinitionQuestion(normalized) {
  return /\b(what is|define|meaning of|what does)\b/.test(normalized);
}

function looksLikeScienceQuestion(normalized) {
  const scienceWords = [
    'atom', 'chemical', 'chemistry', 'compound', 'density', 'element', 'energy', 'force',
    'formula', 'gravity', 'mass', 'matter', 'molecule', 'motion', 'newton', 'periodic',
    'physical', 'reaction', 'science', 'speed', 'velocity', 'volume', 'wave'
  ];

  return scienceWords.some((word) => normalized.includes(word));
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9µμ.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4))).replace(/\.0+$/, '');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  routeStudentQuestion
};
