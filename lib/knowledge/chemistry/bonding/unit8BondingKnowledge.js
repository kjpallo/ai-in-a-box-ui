const SOURCE_REFERENCES = Object.freeze([
  '8 Packet - Bonding Honors - Filled.pdf',
  'Concept 1 Notes - Stability and Bonding (1).pptx',
  'Concept 2 Notes - Naming Ionic Compounds.pptx',
  'Concept 3 Notes - Naming Covalent Compounds.pptx',
  'Free Printable Chapter 18 - Chemical Bonds.pdf',
  'Free Printable GenChem - Chemical Bonding - Lecture II.pdf',
  'Quiz Key Naming Honors.pdf',
  'Quiz Key Polyatomic Ions Honors.pdf',
  'Test Key Honors (2).pdf',
  'Patch 10 grounded synthesis supplied with source upload notes'
]);

const UNIT8_BONDING_METADATA = Object.freeze({
  unit: 8,
  unitTitle: 'Bonding',
  gradeBand: '8th / physical science',
  sourcePack: 'bonding',
  sourceUnitNumberBasis: 'The uploaded synthesis did not state a unit number inside the materials; unit 8 is inferred from source filename "8 Packet - Bonding Honors - Filled.pdf".',
  essentialQuestion: 'Why and how do elements form compounds in nature?',
  concepts: [
    'Stability and Bonding',
    'Naming Ionic Compounds',
    'Naming Covalent Compounds'
  ],
  subtopics: [
    'chemical formulas',
    'octet rule and stability',
    'valence electrons',
    'ion formation',
    'ionic bonds and covalent bonds',
    'oxidation numbers and group charges',
    'polyatomic ions',
    'transition metal Roman numerals',
    'ionic formula writing',
    'covalent prefixes and naming'
  ],
  routePreference: {
    directAnswer: 'bonding definitions, naming rules, formula writing rules, and grounded packet examples',
    formulaTutor: 'not used for this packet; chemical formula writing is answered as direct curriculum knowledge',
    conceptTutor: 'future guided support for ionic/covalent naming and bonding classification'
  },
  sourceReferences: SOURCE_REFERENCES
});

const UNIT8_BONDING_VOCABULARY = Object.freeze([
  vocab('compound', ['elements combined', 'chemical compound'], 'A compound is made of two or more different elements chemically bonded together.'),
  vocab('chemical formula', ['formula'], 'A chemical formula shows which elements are present and how many atoms of each element are in one unit of a compound.'),
  vocab('octet rule', ['rule of eight'], 'The octet rule says atoms gain, lose, or share electrons to get 8 electrons in their outer shell. Hydrogen and helium are exceptions.'),
  vocab('chemical bond', ['bond'], 'A chemical bond is an attraction that holds atoms or ions together in a compound.'),
  vocab('ionic bond', ['ionic bonding'], 'An ionic bond forms when electrons are transferred and oppositely charged ions attract.'),
  vocab('ions', ['ion'], 'Ions are atoms or groups of atoms with a charge because they gained or lost electrons.'),
  vocab('oxidation number', ['charge', 'oxidation state'], 'An oxidation number is the charge an ion has or the charge shown by a Roman numeral for many transition metals.'),
  vocab('polyatomic ions', ['polyatomic ion'], 'A polyatomic ion is a bonded group of atoms that acts as one charged ion.'),
  vocab('covalent bond', ['covalent bonding'], 'A covalent bond forms when nonmetal atoms share electrons.'),
  vocab('molecule', ['molecular compound'], 'A molecule is a group of covalently bonded atoms.'),
  vocab('stable', ['stability'], 'In this unit, stable usually means having a full outer energy level.'),
  vocab('valence electrons', ['outer electrons'], 'Valence electrons are electrons in the outer energy level and are the electrons involved in bonding.'),
  vocab('cation', ['positive ion'], 'A cation is a positive ion formed when an atom loses electrons.'),
  vocab('anion', ['negative ion'], 'An anion is a negative ion formed when an atom gains electrons.'),
  vocab('Lewis dot diagram', ['electron dot diagram', 'Lewis dot structure'], 'A Lewis dot diagram shows valence electrons as dots around an element symbol.'),
  vocab('transition metal', ['transition metals'], 'Transition metals are Groups 3-12 and often need Roman numerals because they can form more than one ion.'),
  vocab('Roman numeral', ['roman numerals'], 'A Roman numeral in a compound name shows a transition metal ion charge.'),
  vocab('subscript', ['subscripts'], 'A subscript tells how many atoms or polyatomic ions are present in a formula.'),
  vocab('superscript', ['superscripts'], 'A superscript is used to show ion charge.'),
  vocab('ionic compound', ['ionic compounds'], 'An ionic compound is made from ions and must have a total charge of zero.'),
  vocab('covalent compound', ['covalent compounds'], 'A covalent compound is made from nonmetals that share electrons.'),
  vocab('single bond', ['single covalent bond'], 'A single bond shares one pair of electrons.'),
  vocab('double bond', ['double covalent bond'], 'A double bond shares two pairs, or 4 electrons.'),
  vocab('triple bond', ['triple covalent bond'], 'A triple bond shares three pairs, or 6 electrons.'),
  vocab('crystal lattice', ['crystal'], 'An ionic crystal lattice is a repeating arrangement of positive and negative ions.'),
  vocab('electronegativity', [], 'Electronegativity is how strongly an atom attracts shared electrons.'),
  vocab('binary compound', ['binary'], 'A binary compound has two different elements.'),
  vocab('hydrate', ['hydrates'], 'A hydrate is an ionic compound with water built into its crystal structure.'),
  vocab('polar', ['nonpolar'], 'Polar covalent bonds share electrons unevenly; nonpolar covalent bonds share them more evenly.')
]);

const UNIT8_BONDING_CONCEPTS = Object.freeze([
  conceptGroup('unit8.bonding.stability', 'Stability and Bonding', [
    'unit8.why_compounds_form',
    'unit8.octet_rule',
    'unit8.chemical_formula_meaning',
    'unit8.ionic_vs_covalent',
    'unit8.valence_electrons'
  ]),
  conceptGroup('unit8.bonding.ionic_naming', 'Naming Ionic Compounds', [
    'unit8.group_charge_rules',
    'unit8.ionic_formula_rule',
    'unit8.polyatomic_ion_rule',
    'unit8.transition_metal_rule'
  ]),
  conceptGroup('unit8.bonding.covalent_naming', 'Naming Covalent Compounds', [
    'unit8.covalent_prefix_rule',
    'unit8.covalent_prefix_table'
  ])
]);

const UNIT8_BONDING_FACTS = Object.freeze([
  fact('unit8.essential_question', 'essential question', ['why do elements form compounds', 'how do elements form compounds'], 'Elements form compounds to become more stable, often by gaining, losing, or sharing valence electrons so their outer shell is full.'),
  fact('unit8.why_compounds_form', 'why elements form compounds', ['why atoms bond', 'why elements bond'], 'Elements form compounds because bonding can make atoms more stable. Atoms may transfer or share valence electrons to reach a stable outer energy level.'),
  fact('unit8.chemical_formula_meaning', 'chemical formula', ['what does a chemical formula tell', 'formula meaning'], 'A chemical formula tells what elements are present and how many atoms of each element are in one unit of a compound. For example, H2O has 2 H and 1 O, and NH3 has 1 N and 3 H.'),
  fact('unit8.octet_rule', 'octet rule', ['rule of eight'], 'Atoms gain, lose, or share electrons to have 8 electrons in their outer shell. Hydrogen and helium are exceptions.'),
  fact('unit8.valence_electrons', 'valence electrons', ['outer electrons'], 'Valence electrons are the outer-shell electrons that atoms gain, lose, or share during bonding.'),
  fact('unit8.ionic_bond', 'ionic bond', ['ionic bonding'], 'An ionic bond forms when electrons are transferred, usually from a metal to a nonmetal, creating cations and anions that attract.'),
  fact('unit8.covalent_bond', 'covalent bond', ['covalent bonding'], 'A covalent bond forms when atoms, usually nonmetals, share electrons.'),
  fact('unit8.ions', 'ions', ['ion formation'], 'Ions form when atoms gain or lose electrons. Losing electrons makes a positive cation; gaining electrons makes a negative anion.'),
  fact('unit8.group_charge_rules', 'group charge rules', ['oxidation group rules', 'periodic table charges'], 'Common group charges are Group 1: +1, Group 2: +2, Group 13: +3, Group 14: +/-4, Group 15: -3, Group 16: -2, and Group 17: -1. Groups 3-12 are transition metals and often need Roman numerals.'),
  fact('unit8.ionic_formula_rule', 'ionic formula rule', ['crisscross rule', 'write ionic formulas'], 'To write an ionic formula, write the ions with charges, determine how many of each ion makes total charge zero, crisscross charges to subscripts, write the formula, and reduce or simplify if needed.'),
  fact('unit8.polyatomic_ion_rule', 'polyatomic ion rule', ['parentheses polyatomic ions'], 'Keep a polyatomic ion together, use parentheses when more than one is needed, keep subscripts outside the parentheses, and do not change anything inside the polyatomic ion.'),
  fact('unit8.transition_metal_rule', 'transition metal rule', ['Roman numerals', 'copper(I)', 'copper(II)'], 'Transition metals can form multiple ions, so a Roman numeral shows the oxidation number or charge. Cu+1 is copper(I), and Cu+2 is copper(II).'),
  fact('unit8.covalent_prefix_rule', 'covalent naming rule', ['covalent formula rule', 'molecular prefixes'], 'Covalent compound names use prefixes to determine subscripts. Do not crisscross or simplify covalent compounds.'),
  fact('unit8.covalent_prefix_table', 'covalent prefix table', ['prefixes mono di tri'], 'Covalent prefixes are mono = 1, di = 2, tri = 3, tetra = 4, penta = 5, hexa = 6, hepta = 7, octa = 8, nona = 9, and deca = 10.'),
  fact('unit8.polyatomic_ions_to_know', 'polyatomic ions to know', ['common polyatomic ions'], 'Polyatomic ions to know: ammonium NH4+1, sulfate SO4-2, nitrate NO3-1, carbonate CO3-2, hydroxide OH-1, acetate C2H3O2-1, phosphate PO4-3, and chlorate ClO3-1.'),
  fact('unit8.oxygen_double_bond', 'O2 double bond', ['oxygen double bond', 'O2 bond'], 'O2 forms a covalent double bond by sharing 4 electrons.')
]);

const UNIT8_BONDING_COMPARISONS = Object.freeze([
  comparison('unit8.compare.ionic_covalent_bond', ['ionic bond', 'covalent bond'], 'Ionic vs covalent bond'),
  comparison('unit8.compare.cation_anion', ['cation', 'anion'], 'Cation vs anion'),
  comparison('unit8.compare.ionic_covalent_compound', ['ionic compound', 'covalent compound'], 'Ionic vs covalent compound'),
  comparison('unit8.compare.subscript_superscript', ['subscript', 'superscript'], 'Subscript vs superscript'),
  comparison('unit8.compare.metal_nonmetal', ['metal', 'nonmetal'], 'Metal vs nonmetal in bonding')
]);

const UNIT8_BONDING_RELATIONSHIPS = Object.freeze([
  relationship('unit8.relationship.compound-formula', 'compound', 'chemical formula', 'is represented by'),
  relationship('unit8.relationship.stability-octet', 'stability', 'octet rule', 'is explained by'),
  relationship('unit8.relationship.valence-bonding', 'valence electrons', 'chemical bond', 'are involved in'),
  relationship('unit8.relationship.ionic-ion-attraction', 'ionic bond', 'cations and anions', 'forms from attraction between'),
  relationship('unit8.relationship.covalent-sharing', 'covalent bond', 'shared electrons', 'forms by'),
  relationship('unit8.relationship.transition-roman', 'transition metal', 'Roman numeral', 'often requires'),
  relationship('unit8.relationship.polyatomic-parentheses', 'polyatomic ions', 'parentheses', 'use when more than one ion is needed'),
  relationship('unit8.relationship.prefix-subscript', 'covalent prefix', 'subscript', 'determines')
]);

const UNIT8_BONDING_REFERENCE_FORMULAS = Object.freeze([
  formulaRule('unit8.rule.ionic_formula_zero_charge', 'ionic formula total charge = 0', ['ion charge', 'subscript'], ['ionic formulas']),
  formulaRule('unit8.rule.crisscross_charges', 'crisscross ion charges to subscripts, then simplify when needed', ['cation charge', 'anion charge', 'subscript'], ['ionic formulas']),
  formulaRule('unit8.rule.covalent_prefixes', 'prefix value = covalent formula subscript', ['prefix', 'subscript'], ['covalent formulas']),
  formulaRule('unit8.rule.polyatomic_parentheses', 'use parentheses when a formula needs more than one unchanged polyatomic ion', ['polyatomic ion', 'subscript'], ['polyatomic formulas'])
]);

const UNIT8_BONDING_EXAMPLES = Object.freeze([
  example('unit8.example.kcl', 'Potassium + chlorine -> KCl', 'unit8.ionic_formula_rule'),
  example('unit8.example.mgf2', 'Magnesium + fluorine -> MgF2', 'unit8.ionic_formula_rule'),
  example('unit8.example.aln', 'Aluminum + nitrogen -> AlN', 'unit8.ionic_formula_rule'),
  example('unit8.example.mg3p2', 'Magnesium + phosphorus -> Mg3P2', 'unit8.ionic_formula_rule'),
  example('unit8.example.alcl3', 'Aluminum + chlorine -> AlCl3', 'unit8.ionic_formula_rule'),
  example('unit8.example.ca_no3_2', 'calcium nitrate -> Ca(NO3)2', 'unit8.polyatomic_ion_rule'),
  example('unit8.example.fecl3', 'FeCl3 -> iron(III) chloride', 'unit8.transition_metal_rule'),
  example('unit8.example.co2', 'CO2 -> carbon dioxide', 'unit8.covalent_prefix_rule'),
  example('unit8.example.s3n2', 'trisulfur dinitride -> S3N2', 'unit8.covalent_prefix_rule')
]);

const UNIT8_BONDING_SMOKE_TESTS = Object.freeze([
  smoke('unit8.smoke.octet_rule', 'What is the octet rule?', 'Atoms gain, lose, or share electrons'),
  smoke('unit8.smoke.ionic_formula', 'What is the formula for aluminum carbonate?', 'Al2(CO3)3'),
  smoke('unit8.smoke.transition_name', 'What is Fe2O3 called?', 'iron(III) oxide'),
  smoke('unit8.smoke.covalent_name', 'What is CO2 called?', 'carbon dioxide'),
  smoke('unit8.smoke.prefixes', 'What does tetra mean in covalent naming?', '4')
]);

const UNIT8_BONDING_PACKET = Object.freeze({
  packetId: 'unit8-bonding',
  title: 'Bonding',
  version: '1.0.0',
  subject: 'science',
  gradeLevel: UNIT8_BONDING_METADATA.gradeBand,
  unit: 8,
  unitTitle: 'Bonding',
  topic: 'Bonding',
  sourceMetadata: {
    sourceBacked: true,
    sourceRefs: SOURCE_REFERENCES,
    note: UNIT8_BONDING_METADATA.sourceUnitNumberBasis
  },
  sourceFiles: SOURCE_REFERENCES,
  concepts: UNIT8_BONDING_CONCEPTS,
  vocabulary: UNIT8_BONDING_VOCABULARY,
  canonicalFacts: UNIT8_BONDING_FACTS,
  comparisons: UNIT8_BONDING_COMPARISONS,
  relationships: UNIT8_BONDING_RELATIONSHIPS,
  referenceFormulas: UNIT8_BONDING_REFERENCE_FORMULAS,
  examples: UNIT8_BONDING_EXAMPLES,
  smokeTests: UNIT8_BONDING_SMOKE_TESTS,
  commonMisconceptions: [
    {
      id: 'unit8.misconception.polyatomic_subscripts',
      misconception: 'Changing subscripts inside a polyatomic ion while writing a formula.',
      correction: 'Keep the polyatomic ion unchanged and put any needed subscript outside parentheses.'
    },
    {
      id: 'unit8.misconception.covalent_crisscross',
      misconception: 'Crisscrossing or simplifying covalent compounds.',
      correction: 'Use prefixes as subscripts for covalent formulas; do not crisscross or simplify.'
    }
  ],
  conceptTutorHooks: [
    { id: 'bonding.stability-octet', terms: ['stability', 'octet rule', 'valence electrons'] },
    { id: 'bonding.ionic-formulas', terms: ['ionic bond', 'ions', 'oxidation number', 'polyatomic ions'] },
    { id: 'bonding.covalent-naming', terms: ['covalent bond', 'molecule', 'prefixes'] }
  ],
  formulaTutorHooks: [
    {
      module: 'lib/knowledge/chemistry/bonding/unit8BondingKnowledge.js',
      exports: ['tryUnit8BondingKnowledge'],
      routePreference: 'direct curriculum answers for chemical formula writing and naming examples'
    }
  ],
  routeHints: [
    {
      id: 'unit8.boundary.bonding-ownership',
      owns: [
        'octet rule',
        'ionic and covalent bonding',
        'naming ionic compounds',
        'naming covalent compounds',
        'polyatomic ion formula writing',
        'transition metal Roman numerals'
      ],
      avoidRoutingAs: ['Unit 7 atomic structure calculations', 'Unit 6 matter classification', 'numeric physics formulas']
    }
  ],
  routePreference: UNIT8_BONDING_METADATA.routePreference,
  directKnowledgeMatcher: 'tryUnit8BondingKnowledge',
  legacyExports: {
    metadata: 'UNIT8_BONDING_METADATA',
    packet: 'UNIT8_BONDING_PACKET',
    facts: 'UNIT8_BONDING_FACTS',
    matcher: 'tryUnit8BondingKnowledge'
  },
  counts: {
    sourceFiles: SOURCE_REFERENCES.length,
    concepts: UNIT8_BONDING_CONCEPTS.length,
    vocabulary: UNIT8_BONDING_VOCABULARY.length,
    canonicalFacts: UNIT8_BONDING_FACTS.length,
    comparisons: UNIT8_BONDING_COMPARISONS.length,
    relationships: UNIT8_BONDING_RELATIONSHIPS.length,
    referenceFormulas: UNIT8_BONDING_REFERENCE_FORMULAS.length,
    examples: UNIT8_BONDING_EXAMPLES.length,
    smokeTests: UNIT8_BONDING_SMOKE_TESTS.length,
    conceptTutorHooks: 3,
    formulaTutorHooks: 1
  },
  metadata: {
    sourceBacked: true,
    sourceReferences: SOURCE_REFERENCES,
    sourceUnitNumberBasis: UNIT8_BONDING_METADATA.sourceUnitNumberBasis,
    essentialQuestion: UNIT8_BONDING_METADATA.essentialQuestion,
    concepts: UNIT8_BONDING_METADATA.concepts,
    subtopics: UNIT8_BONDING_METADATA.subtopics
  }
});

const IONIC_FORMULA_EXAMPLES = Object.freeze(new Map([
  ['potassium chlorine', 'KCl'],
  ['magnesium fluorine', 'MgF2'],
  ['aluminum nitrogen', 'AlN'],
  ['magnesium phosphorus', 'Mg3P2'],
  ['aluminum chlorine', 'AlCl3'],
  ['lithium nitrogen', 'Li3N'],
  ['magnesium iodine', 'MgI2'],
  ['calcium oxygen', 'CaO'],
  ['sodium sulfur', 'Na2S'],
  ['barium sulfate', 'BaSO4'],
  ['aluminum carbonate', 'Al2(CO3)3'],
  ['calcium nitrate', 'Ca(NO3)2'],
  ['sodium acetate', 'NaC2H3O2'],
  ['potassium phosphate', 'K3PO4'],
  ['copper ii sulfide', 'CuS'],
  ['iron i nitride', 'Fe3N'],
  ['manganese iv oxide', 'MnO2'],
  ['chromium vi sulfide', 'CrS3'],
  ['titanium iv bromide', 'TiBr4'],
  ['ammonium sulfide', '(NH4)2S'],
  ['sodium nitride', 'Na3N'],
  ['calcium phosphorus', 'Ca3P2']
]));

const IONIC_NAME_EXAMPLES = Object.freeze(new Map([
  ['Be3N2', 'beryllium nitride'],
  ['Na2O', 'sodium oxide'],
  ['K3P', 'potassium phosphide'],
  ['AlN', 'aluminum nitride'],
  ['MgCl2', 'magnesium chloride'],
  ['NaNO3', 'sodium nitrate'],
  ['CaSO4', 'calcium sulfate'],
  ['(NH4)2O', 'ammonium oxide'],
  ['Mg3(PO4)2', 'magnesium phosphate'],
  ['NH4NO3', 'ammonium nitrate'],
  ['FeCl3', 'iron(III) chloride'],
  ['CrO', 'chromium(II) oxide'],
  ['Mn2O7', 'manganese(VII) oxide'],
  ['CrN', 'chromium(III) nitride'],
  ['Ag2S', 'silver(I) sulfide'],
  ['CoF3', 'cobalt(III) fluoride'],
  ['K2SO4', 'potassium sulfate'],
  ['Fe2O3', 'iron(III) oxide'],
  ['CaO', 'calcium oxide'],
  ['Mn2(CO3)3', 'manganese(III) carbonate']
]));

const COVALENT_NAME_EXAMPLES = Object.freeze(new Map([
  ['CO2', 'carbon dioxide'],
  ['H2O', 'dihydrogen monoxide'],
  ['CH4', 'carbon tetrahydride'],
  ['PCl3', 'phosphorous trichloride'],
  ['P4O10', 'tetraphosphorous decaoxide'],
  ['CO', 'carbon monoxide'],
  ['S3N2', 'trisulfur dinitride'],
  ['NB3', 'nitrogen triboride']
]));

const COVALENT_FORMULA_EXAMPLES = Object.freeze(new Map([
  ['dicarbon tetraoxide', 'C2O4'],
  ['hydrogen monosulfide', 'HS'],
  ['pentaphosphorous trinitride', 'P5N3'],
  ['sulfur pentoxide', 'SO5'],
  ['silicon tetrafluoride', 'SiF4'],
  ['carbon monoxide', 'CO'],
  ['trisulfur dinitride', 'S3N2'],
  ['nitrogen triboride', 'NB3'],
  ['carbon dioxide', 'CO2'],
  ['dihydrogen monoxide', 'H2O']
]));

const PREFIX_VALUES = Object.freeze(new Map([
  ['mono', 1],
  ['di', 2],
  ['tri', 3],
  ['tetra', 4],
  ['penta', 5],
  ['hexa', 6],
  ['hepta', 7],
  ['octa', 8],
  ['nona', 9],
  ['deca', 10]
]));

function tryUnit8BondingKnowledge(message) {
  const original = String(message || '');
  const text = normalize(original);
  if (!text || !hasBondingContext(text)) return null;
  if (looksLikeReactionBalancingContext(text)) return null;

  const answer = answerUnit8Bonding(text, original);
  if (!answer) return null;

  return {
    type: answer.type || 'science_concept',
    confidence: 'strong',
    toolsUsed: ['unit8_bonding_knowledge'],
    notes: `Answered Unit 8 Bonding concept: ${answer.id}.`,
    directAnswer: answer.answer,
    aiAllowed: false,
    knowledgeRefs: answer.sourceRefs || SOURCE_REFERENCES
  };
}

function answerUnit8Bonding(text, original) {
  const exampleAnswer = answerGroundedExample(text, original);
  if (exampleAnswer) return exampleAnswer;

  const comparisonAnswer = answerComparison(text);
  if (comparisonAnswer) return comparisonAnswer;

  if (/\bo2\b|\boxygen\b/.test(text) && /\bdouble bond|sharing|share|bond\b/.test(text)) {
    return factAnswer(findFact('unit8.oxygen_double_bond'));
  }
  if (/\bwhy\b.*\b(?:elements?|atoms?)\b.*\b(?:form|make)\b.*\bcompounds?\b|\bwhy\b.*\b(?:elements?|atoms?)\b.*\bbond\b/.test(text)) {
    return factAnswer(findFact('unit8.why_compounds_form'));
  }
  if (/\bchemical formula\b|\bformula\b.*\b(?:tell|mean|shows?|h2o|nh3)\b/.test(text)) {
    return factAnswer(findFact('unit8.chemical_formula_meaning'));
  }
  if (/\boctet\b|\brule of eight\b/.test(text)) return factAnswer(findFact('unit8.octet_rule'));
  if (/\bvalence electrons?\b/.test(text)) return factAnswer(findFact('unit8.valence_electrons'));
  if (/\bpolyatomic ions?\b.*\b(?:know|list|common)\b/.test(text)) return factAnswer(findFact('unit8.polyatomic_ions_to_know'));
  if (/\bpolyatomic\b/.test(text) && /\b(?:rule|parentheses|formula|subscript|inside)\b/.test(text)) return factAnswer(findFact('unit8.polyatomic_ion_rule'));
  if (/\btransition metals?\b|\broman numeral/.test(text)) return factAnswer(findFact('unit8.transition_metal_rule'));
  if (/\b(?:group|oxidation|charge)\b.*\b(?:rules?|charges?|oxidation numbers?)\b/.test(text)) return factAnswer(findFact('unit8.group_charge_rules'));
  if (/\bcrisscross\b|\bwrite\b.*\bionic formula\b|\bionic formula\b.*\b(?:rule|how)\b/.test(text)) return factAnswer(findFact('unit8.ionic_formula_rule'));
  if (/\bcovalent\b.*\b(?:prefix|name|formula|rule)\b|\bprefixes?\b.*\b(?:covalent|mono|di|tri)\b/.test(text)) return factAnswer(findFact('unit8.covalent_prefix_rule'));
  if (/\bmono\b|\bdi\b|\btri\b|\btetra\b|\bpenta\b|\bhexa\b|\bhepta\b|\bocta\b|\bnona\b|\bdeca\b/.test(text)) {
    return answerPrefix(text) || factAnswer(findFact('unit8.covalent_prefix_table'));
  }

  if (hasDefinitionIntent(text)) {
    const factMatch = UNIT8_BONDING_FACTS.find((entry) => matchesFact(text, entry));
    if (factMatch) return factAnswer(factMatch);
    const vocabMatch = UNIT8_BONDING_VOCABULARY.find((entry) => matchesVocab(text, entry));
    if (vocabMatch) {
      return {
        id: `unit8.vocab.${slug(entryTerm(vocabMatch))}`,
        answer: vocabMatch.definition,
        type: 'definition',
        sourceRefs: vocabMatch.sourceRefs
      };
    }
  }

  return null;
}

function answerGroundedExample(text, original) {
  const formulaMatch = findExampleFormula(original);
  const asksName = /\b(?:name|called|write the name)\b/.test(text) ||
    (/\b(?:what is|whats)\b/.test(text) && /\b(?:ionic|covalent|compound|naming)\b/.test(text));
  if (formulaMatch && asksName) {
    const ionicName = IONIC_NAME_EXAMPLES.get(formulaMatch);
    const covalentName = COVALENT_NAME_EXAMPLES.get(formulaMatch);
    const name = ionicName || covalentName;
    if (name) return exampleAnswer(`unit8.example.name.${slug(formulaMatch)}`, `${formulaMatch} is ${name}.`);
  }

  const asksFormula = /\b(?:formula|write|forms?|combine|combined|for)\b/.test(text);
  if (asksFormula) {
    const ionicFormula = findPhraseExample(text, IONIC_FORMULA_EXAMPLES);
    if (ionicFormula) return exampleAnswer(`unit8.example.formula.${slug(ionicFormula.phrase)}`, `${ionicFormula.phrase} -> ${ionicFormula.value}`);

    const covalentFormula = findPhraseExample(text, COVALENT_FORMULA_EXAMPLES);
    if (covalentFormula) return exampleAnswer(`unit8.example.covalent.${slug(covalentFormula.phrase)}`, `${covalentFormula.phrase} -> ${covalentFormula.value}`);
  }

  if (/\bca\b.*\bp\b|\bcalcium\b.*\bphosphorus\b/.test(text) && /\bionic|covalent|forms?\b/.test(text)) {
    return exampleAnswer('unit8.example.ca_p_ionic', 'Calcium and phosphorus form ionic Ca3P2.');
  }
  if (/\bc\b.*\bo\b|\bcarbon\b.*\boxygen\b/.test(text) && /\bionic|covalent|forms?\b/.test(text)) {
    return exampleAnswer('unit8.example.c_o_covalent', 'Carbon and oxygen form covalent CO2.');
  }
  return null;
}

function answerComparison(text) {
  if (!/\b(?:compare|difference|different|vs|versus|ionic|covalent|cation|anion|subscript|superscript)\b/.test(text)) return null;
  if (/\bionic\b/.test(text) && /\bcovalent\b/.test(text)) {
    return {
      id: 'unit8.compare.ionic_covalent_bond',
      answer: 'Ionic bonds form when electrons are transferred and oppositely charged ions attract. Covalent bonds form when nonmetal atoms share electrons.',
      type: 'science_concept',
      sourceRefs: SOURCE_REFERENCES
    };
  }
  if (/\bcation\b/.test(text) && /\banion\b/.test(text)) {
    return {
      id: 'unit8.compare.cation_anion',
      answer: 'A cation is positive because it lost electrons. An anion is negative because it gained electrons.',
      type: 'science_concept',
      sourceRefs: SOURCE_REFERENCES
    };
  }
  if (/\bsubscript\b/.test(text) && /\bsuperscript\b/.test(text)) {
    return {
      id: 'unit8.compare.subscript_superscript',
      answer: 'A subscript tells how many atoms or polyatomic ions are in a formula. A superscript shows ion charge.',
      type: 'science_concept',
      sourceRefs: SOURCE_REFERENCES
    };
  }
  return null;
}

function answerPrefix(text) {
  for (const [prefix, value] of PREFIX_VALUES) {
    if (new RegExp(`\\b${prefix}\\b`).test(text)) {
      return {
        id: `unit8.prefix.${prefix}`,
        answer: `${prefix} = ${value}.`,
        type: 'definition',
        sourceRefs: SOURCE_REFERENCES
      };
    }
  }
  return null;
}

function hasBondingContext(text) {
  return /\b(?:bonding|bonds?|chemical formula|naming|octet|valence|ionic|covalent|ions?|oxidation|polyatomic|cation|anion|lewis|electron dot|transition metal|roman numeral|subscript|superscript|molecules?|crisscross|prefix|mono|di|tri|tetra|penta|hexa|hepta|octa|nona|deca|carbonate|nitrate|sulfate|phosphate|acetate|ammonium|chlorate|hydroxide|iron\(|copper\(|chromium\(|manganese\(|titanium\(|beryllium nitride|carbon dioxide|carbon monoxide|dihydrogen monoxide|trisulfur dinitride|nitrogen triboride|aluminum carbonate|calcium nitrate)\b/.test(text) ||
    /\bformula\b.*\b(?:tell|mean|shows?|h2o|nh3)\b/.test(text) ||
    hasExplicitCompoundBondingContext(text) ||
    /\b(?:fecl3|fe2o3|co2|h2o|ch4|pcl3|p4o10|mg3\(po4\)2|mn2\(co3\)3|ca\(no3\)2|nh4no3|k2so4|cof3|nb3|s3n2)\b/.test(String(text));
}

function looksLikeReactionBalancingContext(text) {
  return /\bcoefficient/.test(text) ||
    /\bbalanc(?:e|ed|ing)\b/.test(text) ||
    /\bchemical equation\b/.test(text) ||
    /\breactants?\b|\bproducts?\b/.test(text);
}

function hasExplicitCompoundBondingContext(text) {
  return /\b(?:elements?|atoms?)\b.*\b(?:form|make|become stable)\b.*\bcompounds?\b/.test(text) ||
    /\bcompounds?\b.*\b(?:form|make|become stable|stable|bond|bonding|ionic|covalent|formula|naming|octet|valence|polyatomic|roman numerals?|prefixes?)\b/.test(text) ||
    /\b(?:ionic|covalent|binary|molecular)\s+compounds?\b/.test(text);
}

function hasDefinitionIntent(text) {
  return /\b(?:what is|whats|what are|define|definition|describe|explain|meaning|means?|tell me about|how do|why)\b/.test(text);
}

function matchesFact(text, entry) {
  const terms = [entry.canonicalTerm, ...(entry.aliases || [])].map(normalize).filter(Boolean);
  return terms.some((term) => hasLooseTerm(text, term));
}

function matchesVocab(text, entry) {
  const terms = [entry.term, ...(entry.aliases || [])].map(normalize).filter(Boolean);
  return terms.some((term) => hasLooseTerm(text, term));
}

function findPhraseExample(text, examples) {
  const normalizedText = normalize(text.replace(/\band\b/g, ' '));
  const entries = [...examples.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, value] of entries) {
    const normalizedPhrase = normalize(phrase);
    const loosePhrase = normalizedPhrase.replace(/\bii\b/g, '2').replace(/\biv\b/g, '4').replace(/\bvi\b/g, '6');
    if (hasLooseTerm(normalizedText, normalizedPhrase) || normalizedText.includes(loosePhrase)) {
      return { phrase, value };
    }
    const words = normalizedPhrase.split(' ');
    if (words.length === 2 && words.every((word) => hasLooseTerm(normalizedText, word))) {
      return { phrase, value };
    }
  }
  return null;
}

function findExampleFormula(original) {
  const raw = String(original || '');
  const maps = [IONIC_NAME_EXAMPLES, COVALENT_NAME_EXAMPLES];
  for (const exampleMap of maps) {
    for (const formula of exampleMap.keys()) {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(formula)}(?=$|[^a-z0-9])`, 'i');
      if (pattern.test(raw)) return formula;
    }
  }
  return null;
}

function factAnswer(entry) {
  return {
    id: entry.id,
    answer: entry.definition,
    type: 'definition',
    sourceRefs: entry.sourceRefs
  };
}

function exampleAnswer(id, answer) {
  return { id, answer, type: 'science_concept', sourceRefs: SOURCE_REFERENCES };
}

function findFact(id) {
  return UNIT8_BONDING_FACTS.find((entry) => entry.id === id);
}

function fact(id, canonicalTerm, aliases, definition) {
  return Object.freeze({
    id,
    canonicalTerm,
    aliases,
    definition,
    examples: [],
    sourceRefs: SOURCE_REFERENCES
  });
}

function vocab(term, aliases, definition) {
  return Object.freeze({ term, aliases, definition, sourceRefs: SOURCE_REFERENCES });
}

function conceptGroup(id, label, factIds) {
  return Object.freeze({ id, label, factIds, sourceRefs: SOURCE_REFERENCES });
}

function comparison(id, concepts, label) {
  return Object.freeze({ id, concepts, label, sourceRefs: SOURCE_REFERENCES });
}

function relationship(id, fromTerm, toTerm, label) {
  return Object.freeze({ id, from: fromTerm, to: toTerm, fromTerm, toTerm, label, sourceRefs: SOURCE_REFERENCES });
}

function formulaRule(id, formula, variables, solveFor) {
  return Object.freeze({ id, formula, variables, solveFor, sourceRefs: SOURCE_REFERENCES });
}

function example(id, text, factId) {
  return Object.freeze({ id, text, factId, sourceRefs: SOURCE_REFERENCES });
}

function smoke(id, query, expectedCoreAnswer) {
  return Object.freeze({
    id,
    query,
    expectedRoute: 'direct_answer',
    expectedTool: 'unit8_bonding_knowledge',
    expectedCoreAnswer,
    sourceRefs: SOURCE_REFERENCES
  });
}

function entryTerm(entry) {
  return entry && entry.term ? entry.term : '';
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[-‐‑‒–—]/g, ' ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9().\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasLooseTerm(text, term) {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm)}(?=$|[^a-z0-9])`).test(text);
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  UNIT8_BONDING_METADATA,
  UNIT8_BONDING_PACKET,
  UNIT8_BONDING_FACTS,
  UNIT8_BONDING_VOCABULARY,
  UNIT8_BONDING_CONCEPTS,
  UNIT8_BONDING_COMPARISONS,
  UNIT8_BONDING_RELATIONSHIPS,
  UNIT8_BONDING_REFERENCE_FORMULAS,
  UNIT8_BONDING_EXAMPLES,
  tryUnit8BondingKnowledge
};
