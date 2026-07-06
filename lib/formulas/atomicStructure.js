const fs = require('node:fs');
const path = require('node:path');

const { answer, cleanNumber } = require('./formulaAnswerFormatter');
const { buildFormulaWork } = require('./formulaWorkBuilder');

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
  byName.set(normalizeElementName(element.name), element);
  bySymbol.set(String(element.symbol || '').toLowerCase(), element);
}

const ELEMENT_ALIASES = new Map(Object.entries({
  aluminium: 'aluminum',
  sulphur: 'sulfur',
  hydorgen: 'hydrogen',
  hydrogren: 'hydrogen',
  oxegen: 'oxygen',
  oxgen: 'oxygen',
  clorine: 'chlorine',
  chlorin: 'chlorine',
  florine: 'fluorine',
  phosporus: 'phosphorus',
  phosphorous: 'phosphorus',
  sillicon: 'silicon',
  magnisium: 'magnesium',
  potasium: 'potassium'
}));

function tryAtomicStructureFormula(text, lower) {
  if (!/\b(?:atom|atomic|protons?|neutrons?|nuetrons?|nuetron|newtrons?|electrons?|mass number|isotope|bohr|neutral|nucleus|energy levels?)\b/.test(lower)) {
    return null;
  }

  return tryIsotopeNotation(text, lower) ||
    tryBohrModelSetup(text, lower) ||
    tryNeutralElectrons(text, lower) ||
    tryNeutronCount(text, lower) ||
    tryMassNumber(text, lower) ||
    tryProtonsFromAtomicNumber(text, lower) ||
    null;
}

function tryProtonsFromAtomicNumber(text, lower) {
  if (!/\b(?:atomic number|protons?)\b/.test(lower)) return null;
  if (!/\b(?:how many|calculate|find|determine|solve)\b/.test(lower)) return null;
  const atomicNumber = findAtomicNumber(text);
  if (atomicNumber == null || !/\bprotons?\b/.test(lower)) return null;

  return answer('Recognized atomic structure problem: protons from atomic number.', [
    'Use the atomic number rule: protons = atomic number.',
    `Protons = ${cleanNumber(atomicNumber)}`
  ], buildAtomicNumberFormulaWork({
    originalQuestion: text,
    formulaId: 'unit7.atomic_number.protons',
    solveFor: 'protons',
    formula: 'protons = atomic number',
    atomicNumber,
    result: atomicNumber,
    unit: 'protons'
  }));
}

function tryNeutralElectrons(text, lower) {
  if (!/\b(?:neutral atom|neutral)\b/.test(lower) || !/\belectrons?|electons?\b/.test(lower)) return null;
  if (!/\b(?:how many|calculate|find|determine|solve)\b/.test(lower)) return null;
  const atomicNumber = findAtomicNumber(text) ?? findProtons(text);
  if (atomicNumber == null) return null;

  return answer('Recognized atomic structure problem: electrons in a neutral atom.', [
    'For a neutral atom, electrons = protons.',
    'Atomic number = protons.',
    `Electrons = ${cleanNumber(atomicNumber)}`
  ], buildAtomicNumberFormulaWork({
    originalQuestion: text,
    formulaId: 'unit7.atomic_number.neutral_electrons',
    solveFor: 'electrons',
    formula: 'electrons = protons = atomic number',
    atomicNumber,
    result: atomicNumber,
    unit: 'electrons'
  }));
}

function tryNeutronCount(text, lower) {
  if (!/\b(?:neutrons?|nuetrons?|nuetron|newtrons?)\b/.test(lower)) return null;
  if (!/\b(?:how many|calculate|find|determine|solve)\b/.test(lower)) return null;

  const parsed = findAtomicProblemValues(text);
  if (parsed.massNumber == null || parsed.atomicNumber == null) return null;

  const neutrons = parsed.massNumber - parsed.atomicNumber;
  return answer('Recognized atomic structure problem: neutrons from mass number and atomic number.', [
    'Use the neutron rule: neutrons = mass number - atomic number.',
    `Neutrons = ${cleanNumber(parsed.massNumber)} - ${cleanNumber(parsed.atomicNumber)}`,
    `Neutrons = ${cleanNumber(neutrons)}`
  ], buildMassNeutronFormulaWork({
    formulaId: 'unit7.mass_number.neutrons',
    solveFor: 'neutrons',
    formula: 'neutrons = mass number - atomic number',
    massNumber: parsed.massNumber,
    atomicNumber: parsed.atomicNumber,
    result: neutrons,
    unit: 'neutrons'
  }));
}

function tryMassNumber(text, lower) {
  if (!/\bmass number\b/.test(lower)) return null;
  const protons = findProtons(text) ?? findAtomicNumber(text);
  const neutrons = findNeutrons(text);
  if (protons == null || neutrons == null) return null;

  const massNumber = protons + neutrons;
  return answer('Recognized atomic structure problem: mass number from protons and neutrons.', [
    'Use the mass number rule: mass number = protons + neutrons.',
    `Mass number = ${cleanNumber(protons)} + ${cleanNumber(neutrons)}`,
    `Mass number = ${cleanNumber(massNumber)}`
  ], buildMassNumberFormulaWork({
    formulaId: 'unit7.mass_number.total',
    solveFor: 'mass number',
    protons,
    neutrons,
    result: massNumber
  }));
}

function tryIsotopeNotation(text, lower) {
  if (!/\b(?:isotope|hyphen notation|nuclear notation|write)\b/.test(lower)) return null;
  if (!/\b(?:write|notation|isotope)\b/.test(lower)) return null;

  const element = findElement(text);
  if (!element) return null;

  const protons = findProtons(text) ?? Number(element.atomicNumber);
  const neutrons = findNeutrons(text);
  let massNumber = findMassNumber(text);
  if (massNumber == null && neutrons != null) massNumber = protons + neutrons;
  if (massNumber == null) return null;

  const hyphen = `${element.name}-${cleanNumber(massNumber)}`;
  const nuclear = `${cleanNumber(massNumber)}${element.symbol}`;

  return answer('Recognized atomic structure problem: isotope notation.', [
    'Use isotope notation: mass number = protons + neutrons.',
    `Mass number = ${cleanNumber(massNumber)}`,
    `Hyphen notation: ${hyphen}`,
    `Nuclear notation: ${nuclear}`
  ], buildIsotopeNotationWork({
    element,
    protons,
    neutrons,
    massNumber,
    hyphen,
    nuclear
  }));
}

function tryBohrModelSetup(text, lower) {
  if (!/\bbohr\b/.test(lower)) return null;
  if (!/\b(?:draw|setup|set up|make|model|diagram)\b/.test(lower)) return null;
  const element = findElement(text);
  if (!element) return null;
  const atomicNumber = Number(element.atomicNumber);
  const massNumber = findMassNumber(text) ?? Math.round(Number(element.atomicMass));
  const neutrons = massNumber - atomicNumber;
  const electrons = atomicNumber;
  const shells = distributeBohrElectrons(electrons);

  return answer('Recognized atomic structure problem: Bohr model setup.', [
    `For ${element.name}, atomic number = ${atomicNumber}, so protons = ${atomicNumber}.`,
    `Use mass number ${massNumber}; neutrons = ${massNumber} - ${atomicNumber} = ${neutrons}.`,
    `A neutral atom has ${electrons} electrons.`,
    `Fill shells inside out: ${shells.join(', ')}.`
  ], buildBohrModelWork({
    element,
    atomicNumber,
    massNumber,
    neutrons,
    electrons,
    shells
  }));
}

function buildAtomicNumberFormulaWork({ formulaId, solveFor, formula, atomicNumber, result, unit }) {
  return buildFormulaWork({
    formulaId,
    family: 'atomic_structure',
    solveFor,
    formula,
    finalAnswer: {
      value: result,
      unit,
      display: `${cleanNumber(result)} ${unit}`
    },
    variables: [
      { key: 'atomic number', symbol: 'Z', value: atomicNumber, unit: '', display: cleanNumber(atomicNumber) },
      { key: solveFor, symbol: solveFor === 'electrons' ? 'e-' : 'p+', value: result, unit, input: false, display: `${cleanNumber(result)} ${unit}` }
    ],
    choices: [solveFor, 'neutrons', 'mass number'],
    formulaDistractors: ['neutrons = mass number - atomic number', 'mass number = protons + neutrons'],
    calculation: {
      prompt: `What is the number of ${solveFor}?`,
      expectedValue: result,
      calculationExpression: `${atomicNumber}`,
      hints: ['For this rule, the answer equals the atomic number.']
    }
  });
}

function buildMassNeutronFormulaWork({ formulaId, solveFor, formula, massNumber, atomicNumber, result, unit }) {
  return buildFormulaWork({
    formulaId,
    family: 'atomic_structure',
    solveFor,
    formula,
    finalAnswer: {
      value: result,
      unit,
      display: `${cleanNumber(result)} ${unit}`
    },
    variables: [
      { key: 'mass number', symbol: 'A', value: massNumber, unit: '', display: cleanNumber(massNumber) },
      { key: 'atomic number', symbol: 'Z', value: atomicNumber, unit: '', display: cleanNumber(atomicNumber) },
      { key: solveFor, symbol: 'n0', value: result, unit, input: false, display: `${cleanNumber(result)} ${unit}` }
    ],
    choices: [solveFor, 'protons', 'electrons'],
    formulaDistractors: ['mass number = protons + neutrons', 'electrons = protons'],
    calculation: {
      prompt: 'Calculate neutrons = mass number - atomic number.',
      expectedValue: result,
      calculationExpression: `${massNumber} - ${atomicNumber}`,
      hints: ['Subtract atomic number from mass number.']
    }
  });
}

function buildMassNumberFormulaWork({ formulaId, solveFor, protons, neutrons, result }) {
  return buildFormulaWork({
    formulaId,
    family: 'atomic_structure',
    solveFor,
    formula: 'mass number = protons + neutrons',
    finalAnswer: {
      value: result,
      unit: '',
      display: cleanNumber(result)
    },
    variables: [
      { key: 'protons', symbol: 'p+', value: protons, unit: '', display: cleanNumber(protons) },
      { key: 'neutrons', symbol: 'n0', value: neutrons, unit: '', display: cleanNumber(neutrons) },
      { key: solveFor, symbol: 'A', value: result, unit: '', input: false, display: cleanNumber(result) }
    ],
    choices: [solveFor, 'electrons', 'atomic number'],
    formulaDistractors: ['neutrons = mass number - atomic number', 'electrons = protons'],
    calculation: {
      prompt: 'Calculate mass number = protons + neutrons.',
      expectedValue: result,
      calculationExpression: `${protons} + ${neutrons}`,
      hints: ['Add protons and neutrons.']
    }
  });
}

function buildIsotopeNotationWork({ element, protons, neutrons, massNumber, hyphen, nuclear }) {
  const finalDisplay = `${hyphen} and ${nuclear}`;
  const steps = [
    {
      id: 'identify_mass_number',
      type: 'quantity',
      prompt: 'What mass number should the isotope use?',
      expectedValue: massNumber,
      expectedDisplay: cleanNumber(massNumber),
      hints: ['Mass number is protons plus neutrons.']
    },
    {
      id: 'choose_hyphen_notation',
      type: 'multiple_choice',
      prompt: 'Which is the hyphen notation?',
      choices: [
        { number: 1, label: hyphen, correct: true },
        { number: 2, label: `${element.name}-${cleanNumber(protons)}`, correct: false },
        { number: 3, label: `${cleanNumber(massNumber)}${element.symbol}`, correct: false }
      ],
      expected: hyphen,
      hints: ['Hyphen notation uses the element name and mass number.']
    },
    {
      id: 'choose_nuclear_notation',
      type: 'multiple_choice',
      prompt: 'Which is the nuclear notation?',
      choices: [
        { number: 1, label: `${element.symbol}-${cleanNumber(massNumber)}`, correct: false },
        { number: 2, label: nuclear, correct: true },
        { number: 3, label: `${cleanNumber(protons)}${element.symbol}`, correct: false }
      ],
      expected: nuclear,
      hints: ['Nuclear notation places the mass number before the symbol.']
    }
  ];

  return {
    formulaId: 'unit7.isotope.notation',
    family: 'atomic_structure',
    solveFor: 'isotope notation',
    formula: 'mass number = protons + neutrons',
    finalAnswer: { value: massNumber, unit: '', display: finalDisplay },
    finalExplanation: `${hyphen} can also be written as ${nuclear}.`,
    variables: {
      protons: { symbol: 'p+', value: protons, unit: '', display: cleanNumber(protons) },
      neutrons: { symbol: 'n0', value: neutrons, unit: '', display: cleanNumber(neutrons) },
      massNumber: { symbol: 'A', value: massNumber, unit: '', display: cleanNumber(massNumber) }
    },
    steps
  };
}

function buildBohrModelWork({ element, atomicNumber, massNumber, neutrons, electrons, shells }) {
  return {
    formulaId: 'unit7.bohr_model.setup',
    family: 'atomic_structure',
    solveFor: 'Bohr model setup',
    formula: 'p+ = atomic number; n0 = mass number - atomic number; e- = p+ for neutral atoms',
    finalAnswer: {
      value: electrons,
      unit: 'electrons',
      display: `${element.name}: ${atomicNumber} protons, ${neutrons} neutrons, ${electrons} electrons; shells ${shells.join('-')}`
    },
    variables: {
      atomicNumber: { symbol: 'Z', value: atomicNumber, unit: '', display: cleanNumber(atomicNumber) },
      massNumber: { symbol: 'A', value: massNumber, unit: '', display: cleanNumber(massNumber) }
    },
    steps: [
      {
        id: 'identify_protons',
        type: 'quantity',
        prompt: 'How many protons go in the nucleus?',
        expectedValue: atomicNumber,
        expectedDisplay: cleanNumber(atomicNumber),
        hints: ['Protons equal atomic number.']
      },
      {
        id: 'identify_neutrons',
        type: 'quantity',
        prompt: 'How many neutrons go in the nucleus?',
        expectedValue: neutrons,
        expectedDisplay: cleanNumber(neutrons),
        hints: ['Neutrons = mass number - atomic number.']
      },
      {
        id: 'identify_electrons',
        type: 'quantity',
        prompt: 'How many electrons go in the electron cloud for a neutral atom?',
        expectedValue: electrons,
        expectedDisplay: cleanNumber(electrons),
        hints: ['Neutral atoms have electrons equal to protons.']
      },
      {
        id: 'choose_shell_distribution',
        type: 'multiple_choice',
        prompt: 'Which shell distribution fits this Bohr model?',
        choices: [
          { number: 1, label: shells.join('-'), correct: true },
          { number: 2, label: `${electrons}`, correct: false },
          { number: 3, label: shells.slice().reverse().join('-'), correct: false }
        ],
        expected: shells.join('-'),
        hints: ['Fill shells from the inside out: 2, 8, 8, then 18 for this course.']
      }
    ]
  };
}

function findAtomicProblemValues(text) {
  const element = findElement(text);
  let atomicNumber = findAtomicNumber(text) ?? findProtons(text);
  if (atomicNumber == null && element) atomicNumber = Number(element.atomicNumber);
  let massNumber = findMassNumber(text);
  if (massNumber == null) massNumber = findIsotopeMassNumber(text);
  return { element, atomicNumber, massNumber };
}

function findAtomicNumber(text) {
  const match = /\batomic\s+number\s*(?:is|=|:|of)?\s*(\d{1,3})\b/i.exec(text) ||
    /\b(\d{1,3})\s+(?:is\s+)?(?:the\s+)?atomic\s+number\b/i.exec(text);
  return match ? Number(match[1]) : null;
}

function findMassNumber(text) {
  const match = /\bmass\s+number\s*(?:is|=|:|of)?\s*(\d{1,3})\b/i.exec(text) ||
    /\bmass\s*(?:is|=|:)?\s*(\d{1,3})\b/i.exec(text) ||
    /\b(\d{1,3})\s+(?:is\s+)?(?:the\s+)?mass\s+number\b/i.exec(text);
  return match ? Number(match[1]) : null;
}

function findIsotopeMassNumber(text) {
  const match = /\b(?:[A-Z][a-z]?|[A-Za-z]+)\s*-\s*(\d{1,3})\b/.exec(text) ||
    /\b(\d{1,3})\s*([A-Z][a-z]?)\b/.exec(text);
  if (match) return Number(match[1]);

  const element = findElement(text);
  if (element) {
    const namePattern = escapeRegex(element.name);
    const symbolPattern = escapeRegex(element.symbol);
    const loose = new RegExp(`\\b(?:${namePattern}|${symbolPattern})\\s+(\\d{1,3})\\b`, 'i').exec(text);
    if (loose) return Number(loose[1]);
  }

  return null;
}

function findProtons(text) {
  return findParticleCount(text, ['proton', 'protons', 'p+']);
}

function findNeutrons(text) {
  return findParticleCount(text, ['neutron', 'neutrons', 'nuetron', 'nuetrons', 'newtron', 'newtrons', 'n0']);
}

function findParticleCount(text, labels) {
  const labelPattern = labels.map(escapeRegex).sort((a, b) => b.length - a.length).join('|');
  const number = '(\\d{1,3})';
  const patterns = [
    new RegExp(`\\b${number}\\s+(?:${labelPattern})\\b`, 'i'),
    new RegExp(`\\b(?:${labelPattern})\\s*(?:is|are|=|:|of)?\\s*${number}\\b`, 'i')
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return Number(match[1]);
  }
  return null;
}

function findElement(text) {
  const lower = text.toLowerCase();
  const isotopeSymbol = /\b(\d{1,3})\s*([A-Z][a-z]?)\b/.exec(text);
  if (isotopeSymbol && bySymbol.has(isotopeSymbol[2].toLowerCase())) return bySymbol.get(isotopeSymbol[2].toLowerCase());

  const symbolHyphen = /\b([A-Z][a-z]?)\s*-\s*\d{1,3}\b/.exec(text);
  if (symbolHyphen && bySymbol.has(symbolHyphen[1].toLowerCase())) return bySymbol.get(symbolHyphen[1].toLowerCase());

  const nameEntries = [...byName.entries()]
    .concat([...ELEMENT_ALIASES.entries()].map(([alias, target]) => [alias, byName.get(target)]))
    .filter(([, element]) => Boolean(element))
    .sort((a, b) => b[0].length - a[0].length);
  for (const [name, element] of nameEntries) {
    if (new RegExp(`(^|[^a-z])${escapeRegex(name)}(?=$|[^a-z])`, 'i').test(lower)) return element;
  }

  const symbolEntries = [...bySymbol.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [symbol, element] of symbolEntries) {
    if (new RegExp(`\\b${escapeRegex(element.symbol)}\\b`).test(text) &&
      /\b(?:atom|element|has|mass|protons?|neutrons?|electrons?|isotope|bohr|atomic)\b/i.test(text)) {
      return element;
    }
  }
  return null;
}

function distributeBohrElectrons(electrons) {
  const capacities = [2, 8, 8, 18];
  let remaining = electrons;
  const shells = [];
  for (const capacity of capacities) {
    if (remaining <= 0) break;
    const used = Math.min(capacity, remaining);
    shells.push(used);
    remaining -= used;
  }
  if (remaining > 0) shells.push(remaining);
  return shells;
}

function normalizeElementName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { tryAtomicStructureFormula };
