const fs = require('fs');
const path = require('path');

const compoundsFile = path.join(__dirname, '..', 'knowledge', 'chemistry_compounds.json');

function tryChemistryFormula(message) {
  const text = String(message || '');
  const compounds = loadCompounds();

  const formulaMatch = compounds.find((item) => matchesFormula(text, item.formula));
  if (formulaMatch) return buildResult(formulaMatch, 'formula');

  const nameMatch = compounds.find((item) => matchesPhrase(text, item.name));
  if (nameMatch) return buildResult(nameMatch, 'name');

  const aliasMatch = compounds.find((item) => {
    return Array.isArray(item.aliases) &&
      item.aliases.some((alias) => matchesPhrase(text, alias) || matchesFormula(text, alias));
  });

  if (aliasMatch) return buildResult(aliasMatch, 'alias');

  return null;
}

function loadCompounds() {
  try {
    const raw = fs.readFileSync(compoundsFile, 'utf8');
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.items)) return parsed.items;

    return [];
  } catch (error) {
    console.warn('Could not load chemistry compounds:', error.message);
    return [];
  }
}

function buildResult(item, matchType) {
  const studentAnswer = item.student_answer || `${item.formula} is ${item.name}. It is a ${item.type}.`;

  return {
    formula: item.formula,
    name: item.name,
    type: item.type || 'compound',
    ions: item.ions || [],
    ratio: item.ratio || '',
    note: item.note || studentAnswer,
    student_answer: studentAnswer,
    misconceptions: item.misconceptions || [],
    source: item.source || '',
    matchType
  };
}

function matchesFormula(text, formula) {
  if (!formula) return false;

  const pattern = formulaToLoosePattern(formula);
  const regex = new RegExp(`(^|[^A-Za-z0-9])${pattern}([^A-Za-z0-9]|$)`, 'i');

  return regex.test(text);
}

function formulaToLoosePattern(formula) {
  return String(formula)
    .replace(/\s+/g, '')
    .split('')
    .map(escapeRegex)
    .join('\\s*');
}

function matchesPhrase(text, phrase) {
  if (!phrase) return false;

  const words = String(phrase)
    .trim()
    .split(/\s+/)
    .map(escapeRegex)
    .join('\\s+');

  const regex = new RegExp(`(^|\\b)${words}(\\b|$)`, 'i');

  return regex.test(String(text));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { tryChemistryFormula };
