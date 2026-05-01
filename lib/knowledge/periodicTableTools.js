const fs = require('node:fs');
const path = require('node:path');

const tablePath = path.join(__dirname, '..', '..', 'knowledge', 'periodic_table.json');
const tableRaw = JSON.parse(fs.readFileSync(tablePath, 'utf8'));
const columns = tableRaw.columns || [];
const elements = (tableRaw.elements || []).map((row) => {
  const item = {};
  columns.forEach((column, index) => {
    item[column] = row[index];
  });
  return item;
});

const byName = new Map();
const bySymbol = new Map();

for (const element of elements) {
  byName.set(normalizeName(element.name), element);
  bySymbol.set(element.symbol, element);
}

const elementAliases = new Map(Object.entries({
  aluminium: 'Aluminum',
  caesium: 'Cesium',
  sulphur: 'Sulfur',
  hydorgen: 'Hydrogen',
  hydrogren: 'Hydrogen',
  oxegen: 'Oxygen',
  oxgen: 'Oxygen',
  clorine: 'Chlorine',
  chlorin: 'Chlorine',
  florine: 'Fluorine',
  phosporus: 'Phosphorus',
  phosphorous: 'Phosphorus',
  sillicon: 'Silicon',
  magnisium: 'Magnesium',
  potasium: 'Potassium'
}));

function tryPeriodicTable(message) {
  const text = String(message || '');
  const lower = normalizeQuestion(text);
  const target = periodicTarget(lower);
  if (!target) return null;

  const isotopeMassNumber = findIsotopeMassNumber(text);
  const element = findElement(text, lower, isotopeMassNumber);
  if (!element) return null;

  return {
    notes: `Answered from local periodic table dataset: ${tableRaw.source && tableRaw.source.name ? tableRaw.source.name : 'periodic_table.json'}.`,
    answer: buildAnswer(element, target, isotopeMassNumber)
  };
}

function buildAnswer(element, target, isotopeMassNumber) {
  const name = element.name;
  const symbol = element.symbol;
  const atomicNumber = Number(element.atomicNumber);
  const atomicMass = Number(element.atomicMass);
  const estimatedMassNumber = Math.round(atomicMass);
  const massNumber = isotopeMassNumber || estimatedMassNumber;
  const neutrons = massNumber - atomicNumber;
  const intro = `${name} (${symbol})`;

  if (target === 'atomicNumber') {
    return [
      `${intro} has atomic number ${atomicNumber}.`,
      `Atomic number = number of protons, so ${name} has ${atomicNumber} ${plural('proton', atomicNumber)}.`
    ].join('\n');
  }

  if (target === 'protons') {
    return [
      `${intro} has ${atomicNumber} ${plural('proton', atomicNumber)}.`,
      `Number of protons = atomic number = ${atomicNumber}.`
    ].join('\n');
  }

  if (target === 'electrons') {
    return [
      `For a neutral ${name} atom, electrons = protons.`,
      `${intro} has ${atomicNumber} ${plural('electron', atomicNumber)} in a neutral atom.`
    ].join('\n');
  }

  if (target === 'neutrons') {
    const lines = [
      'Use the neutron rule: neutrons = mass number - atomic number.'
    ];

    if (isotopeMassNumber) {
      lines.push(`Mass number = ${massNumber}`);
    } else {
      lines.push(`Estimate mass number by rounding atomic mass: ${cleanNumber(atomicMass)} -> ${massNumber}`);
    }

    lines.push(`Neutrons = ${massNumber} - ${atomicNumber}`);
    lines.push(`Neutrons = ${neutrons}`);
    return lines.join('\n');
  }

  if (target === 'massNumber') {
    if (isotopeMassNumber) {
      return `${intro} has mass number ${massNumber} in ${name}-${massNumber}.`;
    }

    return [
      `${intro} has average atomic mass ${cleanNumber(atomicMass)} u.`,
      `For a 9th-grade class estimate, round atomic mass to find the common mass number.`,
      `Estimated mass number = ${massNumber}`
    ].join('\n');
  }

  if (target === 'atomicMass') {
    return `${intro} has an average atomic mass of ${cleanNumber(atomicMass)} u.`;
  }

  if (target === 'group') {
    const group = formatGroup(element);
    return [
      `${intro} is in ${group}.`,
      `Group block/family: ${element.groupBlock}.`
    ].join('\n');
  }

  if (target === 'period') {
    return [
      `${intro} is in period ${element.period}.`,
      'A period is a horizontal row on the periodic table.'
    ].join('\n');
  }

  if (target === 'groupBlock') {
    return `${intro} is classified as: ${element.groupBlock}.`;
  }

  if (target === 'symbol') {
    return `${name}'s chemical symbol is ${symbol}.`;
  }

  return [
    `${intro}`,
    `Atomic number: ${atomicNumber}`,
    `Protons: ${atomicNumber}`,
    `Electrons in a neutral atom: ${atomicNumber}`,
    `Atomic mass: ${cleanNumber(atomicMass)} u`,
    `Estimated mass number: ${massNumber}`,
    `Estimated neutrons: ${neutrons}`,
    `Group: ${formatGroup(element, true)}`,
    `Period: ${element.period}`,
    `Group block/family: ${element.groupBlock}`
  ].join('\n');
}

function periodicTarget(lower) {
  if (/\b(?:atomic\s+mass|average\s+atomic\s+mass|mass\s+on\s+the\s+periodic\s+table)\b/.test(lower)) return 'atomicMass';
  if (/\b(?:mass\s+number|mass\s+nuber)\b/.test(lower)) return 'massNumber';
  if (/\b(?:neutrons?|newtrons?|number\s+of\s+neutrons?|number\s+of\s+newtrons?|how\s+many\s+neutrons?|how\s+many\s+newtrons?)\b/.test(lower)) return 'neutrons';
  if (/\b(?:electrons?|electons?|number\s+of\s+electrons?|number\s+of\s+electons?|how\s+many\s+electrons?|how\s+many\s+electons?)\b/.test(lower)) return 'electrons';
  if (/\b(?:protons?|number\s+of\s+protons?|how\s+many\s+protons?)\b/.test(lower)) return 'protons';
  if (/\b(?:atomic\s+number|atomic\s+nuber|atom\s+number)\b/.test(lower)) return 'atomicNumber';
  if (/\b(?:group\s+block|family\s+type|element\s+type|classification|classified|category)\b/.test(lower)) return 'groupBlock';
  if (/\b(?:groups?|families|family|columns?|colum)\b/.test(lower)) return 'group';
  if (/\b(?:periods?|rows?)\b/.test(lower)) return 'period';
  if (/\b(?:chemical\s+symbol|element\s+symbol|atomic\s+symbol|symbol)\b/.test(lower)) return 'symbol';
  if (/\b(?:periodic\s+table|perodic\s+table|preiodic\s+table|element\s+data|element\s+info|tell\s+me\s+about)\b/.test(lower)) return 'summary';
  return null;
}

function findElement(text, lower, isotopeMassNumber) {
  const nameEntries = elements
    .map((element) => [element.name, element])
    .concat([...elementAliases.entries()].map(([alias, name]) => [alias, byName.get(normalizeName(name))]))
    .filter(([, element]) => Boolean(element))
    .sort((a, b) => b[0].length - a[0].length);

  for (const [nameOrAlias, element] of nameEntries) {
    if (hasElementName(lower, nameOrAlias)) return element;
  }

  if (isotopeMassNumber) {
    const isotopeSymbolMatch = /\b([A-Z][a-z]?)\s*-\s*\d{1,3}\b/.exec(text);
    if (isotopeSymbolMatch && bySymbol.has(isotopeSymbolMatch[1])) return bySymbol.get(isotopeSymbolMatch[1]);
  }

  const symbolEntries = [...bySymbol.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [symbol, element] of symbolEntries) {
    if (hasElementSymbol(text, symbol)) return element;
  }

  return null;
}

function hasElementName(lower, nameOrAlias) {
  const key = normalizeName(nameOrAlias);
  const suffix = key.endsWith('s') ? "(?:['’]s)?" : "(?:['’]s|s)?";
  return new RegExp(`(^|[^a-z])${escapeRegex(key)}${suffix}(?=$|[^a-z])`, 'i').test(lower);
}

function hasElementSymbol(text, symbol) {
  const escaped = escapeRegex(symbol);
  const contextBefore = `(?:symbol|element|atom|of|for|about)\\s+${escaped}(?:['’]s)?\\b`;
  const contextAfter = `\\b${escaped}(?:['’]s)?\\s+(?:atom|element|atomic|period|group|protons?|electrons?|neutrons?|mass|symbol)\\b`;
  return new RegExp(`${contextBefore}|${contextAfter}`).test(text);
}

function findIsotopeMassNumber(text) {
  const match = /\b(?:[A-Z][a-z]?|[A-Za-z]+)\s*-\s*(\d{1,3})\b/.exec(text);
  if (match) return Number(match[1]);

  const massNumber = /\bmass\s+number\s*(?:is|=|:)?\s*(\d{1,3})\b/i.exec(text);
  if (massNumber) return Number(massNumber[1]);

  return null;
}

function formatGroup(element, compact = false) {
  if (element.group != null) return compact ? String(element.group) : `group ${element.group}`;
  const block = String(element.groupBlock || '').toLowerCase();
  return compact
    ? `${element.groupBlock} f-block`
    : `the ${block} f-block, which is usually shown below the main numbered groups`;
}

function normalizeQuestion(text) {
  return text
    .replace(/[’]/g, "'")
    .toLowerCase();
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function plural(word, value) {
  return Math.abs(value) === 1 ? word : `${word}s`;
}

function cleanNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4))).replace(/\.0+$/, '');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { tryPeriodicTable };
