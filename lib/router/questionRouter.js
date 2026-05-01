const { tryScienceFormula } = require('../formulas/scienceFormulaTools');
const { tryChemistryFormula } = require('../knowledge/chemistryTools');
const { tryPeriodicTable } = require('../knowledge/periodicTableTools');

let math = null;

try {
  const { create, all } = require('mathjs');
  math = create(all, {
    number: 'number'
  });
} catch (error) {
  console.warn('mathjs is not installed yet. Run: npm install mathjs. Calculator will use a small fallback parser for now.');
}

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
      toolsUsed: ['calculator', math ? 'mathjs' : 'fallback_calculator'],
      notes: `Calculated ${mathResult.expression} locally.`,
      calculatorResult: mathResult,
      directAnswer: mathResult.answer,
      aiAllowed: false
    });
  }

  if (looksLikeSafetyAdviceQuestion(normalized)) {
    return makeRoute({
      type: 'no_match',
      confidence: 'none',
      toolsUsed: [],
      notes: 'Safety or advice question blocked because no trusted local safety reference matched.',
      directAnswer: 'I do not have a trusted local safety fact for that yet. Please ask your teacher or another trusted adult before eating, touching, smelling, or using a chemical.',
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

  const periodicTableResult = tryPeriodicTable(text);
  if (periodicTableResult) {
    return makeRoute({
      type: 'periodic_table',
      confidence: 'strong',
      toolsUsed: ['local_periodic_table'],
      notes: periodicTableResult.notes,
      directAnswer: periodicTableResult.answer,
      aiAllowed: false
    });
  }

  const chemistryResult = tryChemistryFormula(text);
  if (chemistryResult) {
    return makeRoute({
      type: 'chemistry_formula',
      confidence: 'strong',
      toolsUsed: ['chemistry_compounds'],
      notes: `Found ${chemistryResult.formula} as ${chemistryResult.name}.`,
      directAnswer: chemistryResult.student_answer || `${chemistryResult.formula} is ${chemistryResult.name}. It is a ${chemistryResult.type}. ${chemistryResult.note}`,
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
        ? `Found strong local match: ${bestKnowledge.title}. Answering directly from teacher facts.`
        : `Found related local match: ${bestKnowledge.title}. Answering directly from teacher facts.`,
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
  const publicRoute = {
    type: route.type,
    confidence: route.confidence,
    toolsUsed: route.toolsUsed || [],
    notes: route.notes || '',
    aiAllowed: Boolean(route.aiAllowed)
  };

  if (route.calculatorResult) {
    publicRoute.calculator = {
      expression: route.calculatorResult.expression,
      displayExpression: route.calculatorResult.displayExpression,
      answer: route.calculatorResult.displayValue
    };
  }

  return {
    type: route.type,
    confidence: route.confidence,
    toolsUsed: route.toolsUsed || [],
    notes: route.notes || '',
    directAnswer: route.directAnswer || '',
    calculatorResult: route.calculatorResult || null,
    aiAllowed: Boolean(route.aiAllowed),
    public: publicRoute
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

function tryMathOnly(message) {
  const expression = wordsToMathExpression(message);
  if (!expression) return null;

  const normalizedExpression = cleanMathExpression(expression);
  if (!looksLikeSafeMathExpression(normalizedExpression)) return null;

  try {
    const value = math
      ? evaluateWithMathjs(normalizedExpression)
      : evaluateWithFallbackCalculator(normalizedExpression);

    if (!Number.isFinite(value)) return null;

    const displayExpression = formatMathExpressionForStudent(normalizedExpression);
    const displayValue = cleanNumber(value);

    return {
      rawInput: message,
      expression: normalizedExpression,
      displayExpression,
      value,
      displayValue,
      answer: `${displayExpression} = ${displayValue}`
    };
  } catch (error) {
    return null;
  }
}

function wordsToMathExpression(message) {
  let text = String(message || '').toLowerCase();

  // Percent problems are useful, but we are intentionally saving them for a later phase.
  if (/%|\bpercent\b|\bpercentage\b/.test(text)) return '';

  text = text.replace(/[?]/g, ' ');
  text = text.replace(/[×]/g, '*');
  text = text.replace(/[÷]/g, '/');
  text = text.replace(/[√]\s*(-?\d+(?:\.\d+)?)/g, ' sqrt($1) ');

  // Remove normal classroom question starters, but do not remove words needed for operations.
  text = text.replace(/\bwhat is\b/g, ' ');
  text = text.replace(/\bwhat's\b/g, ' ');
  text = text.replace(/\bcalculate\b/g, ' ');
  text = text.replace(/\bsolve\b/g, ' ');
  text = text.replace(/\bplease\b/g, ' ');
  text = text.replace(/\btell me\b/g, ' ');
  text = text.replace(/\bthe answer to\b/g, ' ');
  text = text.replace(/\bequals?\b/g, ' ');

  // Word operations.
  text = text.replace(/\bto the power of\b/g, '^');
  text = text.replace(/\b(square root of|square root)\s*(-?\d+(?:\.\d+)?|\([^()]+\))/g, 'sqrt($2)');
  text = text.replace(/\bsqrt\s+(-?\d+(?:\.\d+)?|\([^()]+\))/g, 'sqrt($1)');
  text = text.replace(/(-?\d+(?:\.\d+)?|\([^()]+\))\s*\bsquared\b/g, '$1^2');
  text = text.replace(/(-?\d+(?:\.\d+)?|\([^()]+\))\s*\bcubed\b/g, '$1^3');
  text = text.replace(/\btimes\b|\bmultiplied by\b|\bx\b/g, '*');
  text = text.replace(/\bdivided by\b|\bover\b/g, '/');
  text = text.replace(/\bplus\b/g, '+');
  text = text.replace(/\bminus\b/g, '-');

  // Keep only safe calculator characters and the sqrt function name.
  text = text.replace(/[^0-9+\-*/^().\ssqrt]/g, ' ');
  return cleanMathExpression(text);
}

function cleanMathExpression(expression) {
  return String(expression || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([+\-*/^()])\s*/g, '$1')
    .trim();
}

function looksLikeSafeMathExpression(expression) {
  if (!expression || expression.length > 100) return false;
  if (!/[0-9]/.test(expression)) return false;

  // Only allow numbers, basic operators, parentheses, decimals, spaces, and sqrt().
  if (/[^0-9+\-*/^().\ssqrt]/.test(expression)) return false;

  // If letters remain, they must only be part of sqrt.
  const letters = expression.match(/[a-z]+/g) || [];
  if (letters.some((word) => word !== 'sqrt')) return false;

  // Require an actual operation. A single number should not trigger the calculator.
  if (!/[+\-*/^]/.test(expression) && !/sqrt\(/.test(expression)) return false;

  // Basic guardrails against malformed expressions.
  if (/[+*/^]{2,}/.test(expression)) return false;
  if (/\.{2,}/.test(expression)) return false;

  return true;
}

function evaluateWithMathjs(expression) {
  const parsed = math.parse(expression);
  if (!isSafeMathNode(parsed)) {
    throw new Error('Unsafe math expression');
  }

  const value = parsed.evaluate({});
  if (typeof value !== 'number') {
    throw new Error('Calculator result was not a number');
  }

  return value;
}

function isSafeMathNode(node) {
  if (!node) return false;

  switch (node.type) {
    case 'ConstantNode':
      return Number.isFinite(Number(node.value));

    case 'ParenthesisNode':
      return isSafeMathNode(node.content);

    case 'OperatorNode':
      return ['+', '-', '*', '/', '^', 'unaryMinus', 'unaryPlus'].includes(node.op) &&
        node.args.every(isSafeMathNode);

    case 'FunctionNode': {
      const fnName = node.fn && node.fn.name;
      return fnName === 'sqrt' && node.args.length === 1 && node.args.every(isSafeMathNode);
    }

    case 'SymbolNode':
      return node.name === 'sqrt';

    default:
      return false;
  }
}

function evaluateWithFallbackCalculator(expression) {
  const tokens = expression.match(/sqrt|\d+(?:\.\d+)?|[()+\-*/^]/g);
  if (!tokens) throw new Error('No tokens');
  let position = 0;

  function peek() {
    return tokens[position];
  }

  function consume() {
    return tokens[position++];
  }

  function parseExpression() {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  function parseTerm() {
    let value = parsePower();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parsePower();
      value = op === '*' ? value * right : value / right;
    }
    return value;
  }

  function parsePower() {
    let value = parseFactor();
    if (peek() === '^') {
      consume();
      const exponent = parsePower();
      value = value ** exponent;
    }
    return value;
  }

  function parseFactor() {
    const token = consume();

    if (token === '+') return parseFactor();
    if (token === '-') return -parseFactor();

    if (token === 'sqrt') {
      if (consume() !== '(') throw new Error('Expected opening parenthesis after sqrt');
      const value = parseExpression();
      if (consume() !== ')') throw new Error('Missing closing parenthesis after sqrt');
      return Math.sqrt(value);
    }

    if (token === '(') {
      const value = parseExpression();
      if (consume() !== ')') throw new Error('Missing closing parenthesis');
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

function formatMathExpressionForStudent(expression) {
  let display = expression;

  display = display.replace(/sqrt\(\((-?\d+(?:\.\d+)?)\)\)/g, '√$1');
  display = display.replace(/sqrt\((-?\d+(?:\.\d+)?)\)/g, '√$1');
  display = display.replace(/\*/g, ' × ');
  display = display.replace(/\//g, ' ÷ ');
  display = display.replace(/\+/g, ' + ');
  display = display.replace(/-/g, ' - ');
  display = display.replace(/\^2\b/g, '²');
  display = display.replace(/\^3\b/g, '³');
  display = display.replace(/\^/g, '^');
  display = display.replace(/\s+/g, ' ').trim();
  display = display.replace(/^−\s*/, '-');

  return display;
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

function looksLikeSafetyAdviceQuestion(normalized) {
  const safetyWords = /\b(safe|safety|dangerous|danger|harmful|toxic|poison|poisonous|edible|eat|eaten|drink|drunk|taste|touch|handle|breathe|inhale)\b/;
  const adviceWords = /\b(should|can|could|may|is|are|would)\b/;

  return safetyWords.test(normalized) && adviceWords.test(normalized);
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

module.exports = {
  routeStudentQuestion
};
