const { buildUnit9ReactionsPacket } = require('./unit9ReactionsPacketAdapter');

const SOURCE_REFERENCES = Object.freeze([
  'Grounded Reactions synthesis supplied by user for Patch 11'
]);
const TEACHER_APPROVED_ENERGY_SOURCE_REFERENCES = Object.freeze([
  'Teacher-approved supplemental Unit 9 energy-response content'
]);
const PACKET_SOURCE_REFERENCES = Object.freeze([
  ...SOURCE_REFERENCES,
  ...TEACHER_APPROVED_ENERGY_SOURCE_REFERENCES
]);

const UNIT9_REACTIONS_METADATA = Object.freeze({
  unit: 9,
  unitTitle: 'Unit 9 Reactions',
  gradeBand: '8th / physical science',
  sourcePack: 'reactions',
  sourceNote: 'Built from the grounded Reactions synthesis supplied by the user, with separately identified teacher-approved supplemental Unit 9 energy-response content. Raw PDFs/PPTX files are not required for this patch.',
  essentialQuestion: 'How do compounds change form in chemical reactions without losing energy or matter?',
  concepts: [
    'Balancing Reactions',
    'Classifying Reactions',
    'Energy in Reactions',
    'Acids and Bases',
    'Nuclear Chemistry'
  ],
  subtopics: [
    'reactants, products, coefficients, and subscripts',
    'Law of Conservation of Mass',
    'chemical reaction evidence and precipitates',
    'reaction classification',
    'reaction rate factors',
    'exergonic, exothermic, endergonic, and endothermic reactions',
    'acids, bases, pH, litmus, and neutralization',
    'radioactivity, radiation, radioactive decay, fission, and fusion'
  ],
  routePreference: {
    directAnswer: 'Unit 9 Reactions definitions, balancing/classifying examples, reaction rate, acids/bases, and nuclear chemistry',
    formulaTutor: 'direct curriculum answers for grounded balancing, conservation of mass, and atom-counting examples only',
    conceptTutor: 'future guided support for reaction classification, rate factors, acids/bases, and radiation comparisons'
  },
  sourceReferences: PACKET_SOURCE_REFERENCES
});

const UNIT9_REACTIONS_VOCABULARY = Object.freeze([
  vocab('chemical reaction', ['reaction'], 'A chemical reaction is a process where substances change into new substances.'),
  vocab('physical change', [], 'A physical change changes the form or appearance of matter but does not make a new substance.'),
  vocab('chemical change', [], 'A chemical change makes a new substance.'),
  vocab('reactant', ['reactants'], 'A reactant is a starting substance in a chemical reaction.'),
  vocab('product', ['products'], 'A product is a substance made by a chemical reaction.'),
  vocab('coefficient', ['coefficients'], 'A coefficient is a number placed in front of a chemical formula to show how many units of that substance are present.'),
  vocab('subscript', ['subscripts'], 'A subscript is a small number in a chemical formula that shows how many atoms of an element are in one molecule or formula unit.'),
  vocab('chemical equation', ['equation'], 'A chemical equation uses formulas and symbols to show the reactants and products in a chemical reaction.'),
  vocab('yields', ['yield', 'arrow'], 'Yields means produces; in a chemical equation the arrow points from reactants to products.'),
  vocab('state symbols', ['state symbol'], 'State symbols show the physical state of a substance in an equation.'),
  vocab('aqueous', ['(aq)', 'aq'], 'Aqueous, or (aq), means dissolved in water.'),
  vocab('Law of Conservation of Mass', ['conservation of mass'], 'The Law of Conservation of Mass says matter is not created or destroyed in a chemical reaction, so mass is conserved.'),
  vocab('precipitate', ['precipitate forms'], 'A precipitate is a solid that forms from a reaction between solutions.'),
  vocab('synthesis reaction', ['synthesis'], 'A synthesis reaction combines simpler substances to make one product.'),
  vocab('decomposition reaction', ['decomposition'], 'A decomposition reaction breaks one compound into simpler substances.'),
  vocab('combustion reaction', ['combustion'], 'A combustion reaction is a reaction with oxygen that produces carbon dioxide and water for hydrocarbons.'),
  vocab('single replacement reaction', ['single replacement'], 'A single replacement reaction happens when one element replaces another element in a compound.'),
  vocab('double replacement reaction', ['double replacement'], 'A double replacement reaction happens when two compounds exchange ions.'),
  vocab('exergonic', [], 'Exergonic means a reaction releases energy overall.'),
  vocab('exothermic', [], 'Exothermic means a reaction releases heat energy.'),
  vocab('endergonic', [], 'Endergonic means a reaction absorbs energy overall.'),
  vocab('endothermic', [], 'Endothermic means a reaction absorbs heat energy.'),
  vocab('reaction rate', ['rate of reaction'], 'Reaction rate is how fast reactants change into products.'),
  vocab('temperature', [], 'Temperature affects rate because higher temperature usually makes particles move faster and collide more often.'),
  vocab('concentration', [], 'Concentration affects rate because more particles in the same space can cause more collisions.'),
  vocab('surface area', [], 'Surface area affects rate because more exposed area gives particles more places to collide.'),
  vocab('catalyst', ['catalysts'], 'A catalyst speeds up a reaction by lowering activation energy and is not changed by the reaction.'),
  vocab('activation energy', [], 'Activation energy is the energy needed to start a reaction.'),
  vocab('pressure', [], 'Pressure affects the rate of gas reactions because gas particles are forced closer together.'),
  vocab('acid', ['acids'], 'An acid is a substance that produces hydrogen ions in water and has a pH below 7.'),
  vocab('base', ['bases'], 'A base is a substance that produces hydroxide ions in water and has a pH above 7.'),
  vocab('electrolyte', ['electrolytes'], 'An electrolyte is a substance that conducts electricity when dissolved in water.'),
  vocab('pH', ['ph'], 'pH measures hydrogen ion concentration and tells how acidic, neutral, or basic a solution is.'),
  vocab('hydrogen ion', ['hydrogen ions'], 'A hydrogen ion is H+ and is connected with acidity.'),
  vocab('hydronium ion', ['hydronium'], 'A hydronium ion is H3O+ and forms when hydrogen ions attach to water.'),
  vocab('hydroxide ion', ['hydroxide ions'], 'A hydroxide ion is OH- and is connected with bases.'),
  vocab('neutralization', [], 'Neutralization is a reaction between an acid and a base that forms salt and water.'),
  vocab('salt', [], 'In neutralization, a salt is an ionic compound produced along with water.'),
  vocab('litmus paper', ['litmus'], 'Litmus paper is an indicator: acids turn blue litmus red, and bases turn red litmus blue.'),
  vocab('strong acid', [], 'A strong acid produces many hydrogen ions in water.'),
  vocab('strong base', [], 'A strong base produces many hydroxide ions in water.'),
  vocab('weak acid', [], 'A weak acid produces fewer hydrogen ions in water than a strong acid.'),
  vocab('weak base', [], 'A weak base produces fewer hydroxide ions in water than a strong base.'),
  vocab('neutral', [], 'Neutral means neither acidic nor basic; pH 7 is neutral.'),
  vocab('nucleus', ['atomic nucleus'], 'The nucleus is the center of the atom and contains protons and neutrons.'),
  vocab('proton', ['protons'], 'A proton is a positively charged particle in the nucleus.'),
  vocab('neutron', ['neutrons'], 'A neutron is a neutral particle in the nucleus.'),
  vocab('strong force', ['strong nuclear force'], 'The strong force holds the nucleus together.'),
  vocab('nuclear chemistry', [], 'Nuclear chemistry studies changes in the nucleus of an atom.'),
  vocab('radioactivity', [], 'Radioactivity is the process of unstable nuclei releasing radiation.'),
  vocab('radiation', [], 'Radiation is energy or particles released from unstable nuclei.'),
  vocab('radioactive decay', ['decay'], 'Radioactive decay is the process where an unstable nucleus changes by releasing radiation.'),
  vocab('alpha radiation', ['alpha particle'], 'Alpha radiation releases an alpha particle with 2 protons and 2 neutrons.'),
  vocab('beta radiation', ['beta particle'], 'Beta radiation releases a beta particle from the nucleus.'),
  vocab('gamma radiation', ['gamma rays', 'gamma'], 'Gamma radiation releases electromagnetic energy.'),
  vocab('nuclear fission', ['fission'], 'Nuclear fission splits a larger atom into smaller atoms and is used in nuclear power plants.'),
  vocab('nuclear fusion', ['fusion'], 'Nuclear fusion combines lighter atoms into a larger atom and occurs naturally in stars.'),
  vocab('nuclear reactor', ['reactor'], 'A nuclear reactor uses controlled fission to produce energy.'),
  vocab('chain reaction', [], 'A chain reaction happens when one nuclear event triggers more nuclear events.'),
  vocab('radioactive waste', [], 'Radioactive waste is material left from nuclear processes that gives off radiation.'),
  vocab('tracer', ['medical tracer'], 'A tracer is a radioactive substance used to follow a process in the body or another system.'),
  vocab('PET scan', ['pet scan'], 'A PET scan uses radioactive tracers for medical imaging.'),
  vocab('X-ray', ['x ray'], 'An X-ray is medical imaging that uses radiation to see inside the body.'),
  vocab('CT scan', ['ct scan'], 'A CT scan uses many X-ray images to make cross-sectional pictures.')
]);

const UNIT9_REACTIONS_CONCEPTS = Object.freeze([
  conceptGroup('unit9.reactions.balancing', 'Balancing Reactions', [
    'unit9.reactant_product',
    'unit9.coefficient_subscript',
    'unit9.coefficients_not_subscripts',
    'unit9.conservation_mass'
  ]),
  conceptGroup('unit9.reactions.classifying', 'Classifying Reactions', [
    'unit9.synthesis',
    'unit9.decomposition',
    'unit9.combustion',
    'unit9.single_replacement',
    'unit9.double_replacement',
    'unit9.precipitate'
  ]),
  conceptGroup('unit9.reactions.energy', 'Energy in Reactions', [
    'unit9.reaction_rate',
    'unit9.rate_factors',
    'unit9.exergonic_exothermic',
    'unit9.endergonic_endothermic'
  ]),
  conceptGroup('unit9.reactions.acids_bases', 'Acids and Bases', [
    'unit9.acid',
    'unit9.base',
    'unit9.ph',
    'unit9.neutralization',
    'unit9.litmus'
  ]),
  conceptGroup('unit9.reactions.nuclear', 'Nuclear Chemistry', [
    'unit9.nuclear_chemistry',
    'unit9.radioactivity',
    'unit9.alpha_beta_gamma',
    'unit9.fission_fusion',
    'unit9.nuclear_uses'
  ])
]);

const UNIT9_REACTIONS_FACTS = Object.freeze([
  fact('unit9.essential_question', 'essential question', ['how do compounds change form'], 'Compounds change form in chemical reactions when atoms rearrange into new substances, but matter and energy are conserved.'),
  fact('unit9.reactant_product', 'reactant and product', ['reactant', 'product'], 'Reactants are the starting substances in a chemical reaction. Products are the substances made by the reaction.'),
  fact('unit9.coefficient_subscript', 'coefficient and subscript', ['coefficient', 'subscript'], 'A coefficient is placed in front of a formula and can change when balancing. A subscript is part of a formula and shows how many atoms are in that substance.'),
  fact('unit9.coefficients_not_subscripts', 'coefficients can change but subscripts cannot', ['why coefficients can change', 'why subscripts cannot change'], 'You can change coefficients to balance a chemical equation because they change the number of molecules or formula units. You cannot change subscripts because that would change the substance.'),
  fact('unit9.aqueous', 'aqueous', ['(aq)', 'aq'], 'Aqueous, or (aq), means dissolved in water.'),
  fact('unit9.conservation_mass', 'Law of Conservation of Mass', ['conservation of mass', 'missing mass'], 'The Law of Conservation of Mass says matter is not created or destroyed in a chemical reaction, so the total mass of reactants equals the total mass of products.'),
  fact('unit9.chemical_change_evidence', 'evidence of chemical change', ['evidence of reaction'], 'Evidence of chemical change can include color change, gas production, temperature or energy change, light production, odor change, or formation of a precipitate.'),
  fact('unit9.precipitate', 'precipitate', ['solid forms'], 'A precipitate is a solid that forms from a reaction between solutions.'),
  fact('unit9.synthesis', 'synthesis reaction', ['synthesis'], 'A synthesis reaction combines simpler substances to make one product.'),
  fact('unit9.decomposition', 'decomposition reaction', ['decomposition'], 'A decomposition reaction breaks one compound into simpler substances.'),
  fact('unit9.combustion', 'combustion reaction', ['combustion'], 'A combustion reaction is a reaction with oxygen. For hydrocarbons, the products are carbon dioxide and water.'),
  fact('unit9.single_replacement', 'single replacement reaction', ['single replacement'], 'A single replacement reaction happens when one element replaces another element in a compound.'),
  fact('unit9.double_replacement', 'double replacement reaction', ['double replacement'], 'A double replacement reaction happens when two compounds exchange ions.'),
  fact('unit9.reaction_rate', 'reaction rate', ['rate of reaction'], 'Reaction rate is how fast reactants change into products.'),
  fact('unit9.rate_factors', 'reaction rate factors', ['temperature concentration surface area catalyst pressure'], 'Temperature, concentration, surface area, and catalysts affect reaction rate. Pressure affects rate for gases in the notes.'),
  fact('unit9.catalyst', 'catalyst', ['what does a catalyst do'], 'A catalyst speeds up a reaction by lowering activation energy and is not changed by the reaction.'),
  fact('unit9.exergonic_exothermic', 'exergonic vs exothermic', ['exergonic', 'exothermic'], 'Exergonic means a reaction releases energy overall. Exothermic means a reaction releases heat energy.'),
  fact('unit9.endergonic_endothermic', 'endergonic vs endothermic', ['endergonic', 'endothermic'], 'Endergonic means a reaction absorbs energy overall. Endothermic means a reaction absorbs heat energy.'),
  fact(
    'unit9.exothermic_surroundings',
    'exothermic effect on surroundings',
    ['exothermic surroundings', 'surroundings during exothermic reaction'],
    'Exothermic reactions release thermal energy to the surroundings. The surroundings gain thermal energy and usually become warmer.',
    TEACHER_APPROVED_ENERGY_SOURCE_REFERENCES
  ),
  fact(
    'unit9.endothermic_surroundings',
    'endothermic effect on surroundings',
    ['endothermic surroundings', 'surroundings during endothermic reaction'],
    'Endothermic reactions absorb thermal energy from the surroundings. The surroundings lose thermal energy and usually become cooler.',
    TEACHER_APPROVED_ENERGY_SOURCE_REFERENCES
  ),
  fact('unit9.acid', 'acid', ['acids'], 'An acid is a substance that produces hydrogen ions in water and has a pH below 7.'),
  fact('unit9.base', 'base', ['bases'], 'A base is a substance that produces hydroxide ions in water and has a pH above 7.'),
  fact('unit9.electrolyte', 'electrolyte', ['electrolytes'], 'An electrolyte is a substance that conducts electricity when dissolved in water.'),
  fact('unit9.ph', 'pH', ['what does pH measure'], 'pH measures hydrogen ion concentration and tells how acidic, neutral, or basic a solution is.'),
  fact('unit9.low_high_ph', 'low pH and high pH', ['low pH', 'high pH'], 'Low pH means acidic and high hydrogen ion concentration. High pH means basic and high hydroxide ion concentration.'),
  fact('unit9.neutralization', 'neutralization', ['neutralization products'], 'Neutralization is an acid-base reaction that forms salt and water.'),
  fact('unit9.litmus', 'litmus paper', ['red litmus', 'blue litmus'], 'Acids turn blue litmus paper red. Bases turn red litmus paper blue.'),
  fact('unit9.nuclear_chemistry', 'nuclear chemistry', ['nuclear reactions'], 'Nuclear chemistry studies changes in the nucleus of an atom.'),
  fact('unit9.radioactivity', 'radioactivity radiation radioactive decay', ['radioactivity', 'radiation', 'radioactive decay'], 'Radioactivity is unstable nuclei releasing radiation. Radiation is the energy or particles released. Radioactive decay is the process where an unstable nucleus changes by releasing radiation.'),
  fact('unit9.alpha_beta_gamma', 'alpha beta gamma radiation', ['alpha radiation', 'beta radiation', 'gamma radiation'], 'Alpha radiation releases an alpha particle with 2 protons and 2 neutrons. Beta radiation releases a beta particle from the nucleus. Gamma radiation releases electromagnetic energy.'),
  fact('unit9.fission_fusion', 'fission vs fusion', ['nuclear fission', 'nuclear fusion'], 'Fusion combines lighter atoms into a larger atom and occurs naturally in stars. Fission splits a larger atom into smaller atoms and is used in nuclear power plants.'),
  fact('unit9.nuclear_uses', 'nuclear chemistry uses', ['medical uses', 'reactor uses', 'weapons uses'], 'At a course-description level, nuclear chemistry is used in medical imaging and tracers, nuclear reactors for energy, and nuclear weapons as a historical and social-impact topic.')
]);

const UNIT9_REACTIONS_COMPARISONS = Object.freeze([
  comparison('unit9.compare.reactant_product', ['reactant', 'product'], 'Reactant vs product'),
  comparison('unit9.compare.coefficient_subscript', ['coefficient', 'subscript'], 'Coefficient vs subscript'),
  comparison('unit9.compare.physical_chemical_change', ['physical change', 'chemical change'], 'Physical vs chemical change'),
  comparison('unit9.compare.exergonic_exothermic', ['exergonic', 'exothermic'], 'Exergonic vs exothermic'),
  comparison('unit9.compare.endergonic_endothermic', ['endergonic', 'endothermic'], 'Endergonic vs endothermic'),
  comparison('unit9.compare.acid_base', ['acid', 'base'], 'Acid vs base'),
  comparison('unit9.compare.alpha_beta_gamma', ['alpha radiation', 'beta radiation', 'gamma radiation'], 'Alpha vs beta vs gamma radiation'),
  comparison('unit9.compare.fission_fusion', ['nuclear fission', 'nuclear fusion'], 'Fission vs fusion')
]);

const UNIT9_REACTIONS_RELATIONSHIPS = Object.freeze([
  relationship('unit9.relationship.reactants-products', 'reactants', 'products', 'change into'),
  relationship('unit9.relationship.coefficient-balance', 'coefficient', 'balanced equation', 'can change to balance'),
  relationship('unit9.relationship.subscript-substance', 'subscript', 'substance identity', 'cannot change without changing'),
  relationship('unit9.relationship.conservation-mass', 'balanced equation', 'Law of Conservation of Mass', 'models'),
  relationship('unit9.relationship.precipitate-evidence', 'precipitate', 'chemical change evidence', 'is evidence of'),
  relationship('unit9.relationship.catalyst-activation', 'catalyst', 'activation energy', 'lowers'),
  relationship('unit9.relationship.ph-hydrogen', 'pH', 'hydrogen ion concentration', 'measures'),
  relationship('unit9.relationship.neutralization-products', 'neutralization', 'salt and water', 'forms'),
  relationship('unit9.relationship.radioactivity-radiation', 'radioactivity', 'radiation', 'releases'),
  relationship('unit9.relationship.fission-reactor', 'nuclear fission', 'nuclear reactor', 'is used in')
]);

const UNIT9_REACTIONS_REFERENCE_FORMULAS = Object.freeze([
  formulaRule('unit9.rule.balance_coefficients', 'balance equations by changing coefficients, not subscripts', ['coefficient', 'subscript'], ['balanced chemical equations']),
  formulaRule('unit9.rule.atom_counting', 'coefficient * subscript gives atom count for an element in a formula', ['coefficient', 'subscript'], ['atom counting']),
  formulaRule('unit9.rule.conservation_mass', 'total reactant mass = total product mass', ['reactant mass', 'product mass'], ['missing mass']),
  formulaRule('unit9.rule.ph_scale', 'low pH = acidic; pH 7 = neutral; high pH = basic', ['pH', 'hydrogen ion concentration', 'hydroxide ion concentration'], ['acid-base classification'])
]);

const UNIT9_REACTIONS_EXAMPLES = Object.freeze([
  example('unit9.example.balance_h2_o2', 'H2 + O2 -> H2O balances as 2H2 + O2 -> 2H2O.', 'unit9.coefficients_not_subscripts'),
  example('unit9.example.balance_al_o2', 'Al + O2 -> Al2O3 balances as 4Al + 3O2 -> 2Al2O3.', 'unit9.coefficients_not_subscripts'),
  example('unit9.example.oxygen_count', '2Ca(NO3)2 contains 12 oxygen atoms.', 'unit9.coefficient_subscript'),
  example('unit9.example.missing_mass', 'Zn + 2HCl -> ZnCl2 + H2 with 65 g + 72 g -> 135 g + ? g gives 2 g.', 'unit9.conservation_mass'),
  example('unit9.example.licl_br2', 'LiCl + Br2 -> LiBr + Cl2 balances as 2LiCl + Br2 -> 2LiBr + Cl2 and is single replacement.', 'unit9.single_replacement'),
  example('unit9.example.kclo3', '2KClO3 -> 2KCl + 3O2 is decomposition.', 'unit9.decomposition'),
  example('unit9.example.n2_o2', '2N2 + 5O2 -> 2N2O5 is synthesis.', 'unit9.synthesis'),
  example('unit9.example.c3h8', 'C3H8 + O2 balances as C3H8 + 5O2 -> 3CO2 + 4H2O and is combustion.', 'unit9.combustion'),
  example('unit9.example.neutralization', '3Ca(OH)2 + 2H3PO4 -> Ca3(PO4)2 + 6H2O is double replacement in a neutralization context.', 'unit9.double_replacement')
]);

const UNIT9_REACTIONS_SMOKE_TESTS = Object.freeze([
  smoke('unit9.smoke.aq', 'What does (aq) mean?', 'dissolved in water'),
  smoke('unit9.smoke.balance_h2_o2', 'Balance H2 + O2 -> H2O.', '2H2 + O2 -> 2H2O'),
  smoke('unit9.smoke.oxygen_count', 'How many oxygen atoms are in 2Ca(NO3)2?', '12'),
  smoke('unit9.smoke.neutralization', 'What are the products of neutralization?', 'salt and water'),
  smoke('unit9.smoke.fission_fusion', 'Fusion vs fission?', 'Fusion combines lighter atoms')
]);

const UNIT9_REACTIONS_PACKET = buildUnit9ReactionsPacket({
  metadata: UNIT9_REACTIONS_METADATA,
  sourceReferences: PACKET_SOURCE_REFERENCES,
  vocabulary: UNIT9_REACTIONS_VOCABULARY,
  concepts: UNIT9_REACTIONS_CONCEPTS,
  canonicalFacts: UNIT9_REACTIONS_FACTS,
  comparisons: UNIT9_REACTIONS_COMPARISONS,
  relationships: UNIT9_REACTIONS_RELATIONSHIPS,
  referenceFormulas: UNIT9_REACTIONS_REFERENCE_FORMULAS,
  examples: UNIT9_REACTIONS_EXAMPLES,
  smokeTests: UNIT9_REACTIONS_SMOKE_TESTS,
  commonMisconceptions: [
    {
      id: 'unit9.misconception.change_subscripts',
      misconception: 'Changing subscripts to balance a chemical equation.',
      correction: 'Change coefficients only. Changing subscripts changes the substance.'
    },
    {
      id: 'unit9.misconception.exergonic_exothermic',
      misconception: 'Treating exergonic and exothermic as exactly the same word.',
      correction: 'Exergonic releases energy overall; exothermic specifically releases heat.'
    },
    {
      id: 'unit9.misconception.nuclear_classification',
      misconception: 'Classifying fission or fusion as synthesis, decomposition, or combustion.',
      correction: 'Fission and fusion are nuclear processes, not chemical reaction classification examples.'
    }
  ],
  conceptTutorHooks: [
    { id: 'reactions.classification', terms: ['synthesis', 'decomposition', 'combustion', 'single replacement', 'double replacement'] },
    { id: 'reactions.rate-factors', terms: ['temperature', 'concentration', 'surface area', 'catalyst', 'pressure'] },
    { id: 'reactions.acids-bases', terms: ['acid', 'base', 'pH', 'neutralization', 'litmus paper'] },
    { id: 'reactions.nuclear', terms: ['radioactivity', 'alpha radiation', 'beta radiation', 'gamma radiation', 'fission', 'fusion'] }
  ],
  formulaTutorHooks: [
    {
      module: 'lib/knowledge/chemistry/reactions/unit9ReactionsKnowledge.js',
      exports: ['tryUnit9ReactionsKnowledge'],
      routePreference: 'direct curriculum answers for grounded balancing, atom-counting, and missing-mass examples'
    }
  ],
  routeHints: [
    {
      id: 'unit9.boundary.reactions-ownership',
      owns: [
        'balancing chemical equations',
        'classifying chemical reactions',
        'chemical reaction evidence',
        'reaction rate',
        'energy in chemical reactions',
        'acids and bases',
        'nuclear chemistry'
      ],
      avoidRoutingAs: [
        'Unit 8 ionic/covalent compound naming',
        'Unit 7 atomic structure calculations',
        'Unit 6 matter classification unless asking broad matter properties',
        'Unit 3 general energy transformations'
      ]
    }
  ],
  matcherName: 'tryUnit9ReactionsKnowledge'
});

const BALANCED_REACTION_EXAMPLES = Object.freeze([
  {
    id: 'unit9.example.balance_h2_o2',
    patterns: [/\bh2\b.*\bo2\b.*\bh2o\b/],
    answer: 'H2 + O2 -> H2O balances as 2H2 + O2 -> 2H2O.'
  },
  {
    id: 'unit9.example.balance_al_o2',
    patterns: [/\bal\b.*\bo2\b.*\bal2o3\b/, /\baluminum\b.*\boxygen\b.*\bal2o3\b/],
    answer: 'Al + O2 -> Al2O3 balances as 4Al + 3O2 -> 2Al2O3.'
  },
  {
    id: 'unit9.example.licl_br2',
    patterns: [/\blicl\b.*\bbr2\b.*\blibr\b.*\bcl2\b/],
    answer: 'LiCl + Br2 -> LiBr + Cl2 balances as 2LiCl + Br2 -> 2LiBr + Cl2. It is a single replacement reaction.'
  },
  {
    id: 'unit9.example.c3h8',
    patterns: [/\bc3h8\b.*\bo2\b/],
    answer: 'C3H8 + O2 balances as C3H8 + 5O2 -> 3CO2 + 4H2O. It is a combustion reaction.'
  }
]);

const CLASSIFICATION_EXAMPLES = Object.freeze([
  {
    id: 'unit9.example.kclo3',
    patterns: [/\b2?kclo3\b.*\b2?kcl\b.*\b3?o2\b/],
    answer: '2KClO3 -> 2KCl + 3O2 is a decomposition reaction.'
  },
  {
    id: 'unit9.example.n2_o2',
    patterns: [/\b2?n2\b.*\b5?o2\b.*\b2?n2o5\b/],
    answer: '2N2 + 5O2 -> 2N2O5 is a synthesis reaction.'
  },
  {
    id: 'unit9.example.neutralization',
    patterns: [/\b\d*ca\(oh\)2\b.*\b\d*h3po4\b.*\bca3\(po4\)2\b.*\b\d*h2o\b/],
    answer: '3Ca(OH)2 + 2H3PO4 -> Ca3(PO4)2 + 6H2O is double replacement in a neutralization context.'
  }
]);

function tryUnit9ReactionsKnowledge(message) {
  const original = String(message || '');
  const text = normalize(original);
  if (!text || !hasReactionsContext(text)) return null;

  const answer = answerUnit9Reactions(text, original);
  if (!answer) return null;

  return {
    type: answer.type || 'science_concept',
    confidence: 'strong',
    toolsUsed: ['unit9_reactions_knowledge'],
    notes: `Answered Unit 9 Reactions concept: ${answer.id}.`,
    directAnswer: answer.answer,
    aiAllowed: false,
    knowledgeRefs: answer.sourceRefs || SOURCE_REFERENCES
  };
}

function answerUnit9Reactions(text, original) {
  const exampleAnswer = answerGroundedExample(text);
  if (exampleAnswer) return exampleAnswer;

  const thermalSurroundingsAnswer = answerThermalSurroundings(text);
  if (thermalSurroundingsAnswer) return thermalSurroundingsAnswer;

  const comparisonAnswer = answerComparison(text);
  if (comparisonAnswer) return comparisonAnswer;

  if (/\bwhy\b.*\bcoefficients?\b.*\b(?:change|changed)\b.*\bsubscripts?\b.*\bcannot\b/.test(text) ||
    /\bcoefficients?\b.*\b(?:change|changed)\b.*\bsubscripts?\b.*\bcannot\b/.test(text) ||
    /\bwhat\b.*\bchanged\b.*\bbalance\b|\bwhat\b.*\bcan\b.*\bchanged\b.*\bbalance\b|\bbalance\b.*\bsubscripts?\b|\bsubscripts?\b.*\bbalance\b/.test(text)) {
    return factAnswer(findFact('unit9.coefficients_not_subscripts'));
  }
  if (/\bcoefficient/.test(text) && /\bsubscript/.test(text)) return factAnswer(findFact('unit9.coefficient_subscript'));
  if (/\breactants?\b/.test(text) && /\bproducts?\b/.test(text)) return factAnswer(findFact('unit9.reactant_product'));
  if (/\b(?:aq|aqueous)\b/.test(text) || /\(aq\)/i.test(original)) return factAnswer(findFact('unit9.aqueous'));
  if ((/\bconservation of mass\b|\blaw of conservation\b|\bmissing mass\b/.test(text)) && hasUnit9ConservationContext(text)) return factAnswer(findFact('unit9.conservation_mass'));
  if (/\bevidence\b.*\bchemical change\b|\bchemical change\b.*\bevidence\b/.test(text)) return factAnswer(findFact('unit9.chemical_change_evidence'));
  if (/\bprecipitate\b/.test(text)) return factAnswer(findFact('unit9.precipitate'));
  if (mentionsAllReactionClasses(text)) {
    return conceptAnswer(
      'unit9.reaction_classes.all',
      'A synthesis reaction combines simpler substances to make one product. A decomposition reaction breaks one compound into simpler substances. A combustion reaction reacts with oxygen. A single replacement reaction happens when one element replaces another element in a compound. A double replacement reaction happens when two compounds exchange ions.'
    );
  }
  if (/\brate\b/.test(text) && /\b(?:temperature|concentration|surface area|catalyst|pressure|factor|affect)\b/.test(text)) return answerRateFactor(text);
  if (/\breaction rate\b|\brate of reaction\b/.test(text)) return factAnswer(findFact('unit9.reaction_rate'));
  if (/\bcatalyst\b/.test(text)) return factAnswer(findFact('unit9.catalyst'));
  if (/\bpressure\b/.test(text) && /\bgases?\b/.test(text)) {
    return conceptAnswer('unit9.rate.pressure_gases', 'Pressure is the rate factor that applies to gases in the notes.');
  }
  if (/\bexergonic\b/.test(text)) return conceptAnswer('unit9.exergonic', 'Exergonic means a reaction releases energy overall.');
  if (/\bexothermic\b/.test(text)) return vocabAnswer('exothermic');
  if (/\bendergonic\b/.test(text)) return conceptAnswer('unit9.endergonic', 'Endergonic means a reaction absorbs energy overall.');
  if (/\bendothermic\b/.test(text)) return vocabAnswer('endothermic');
  if (/\bneutralization\b/.test(text) || (/\bacid\b/.test(text) && /\bbase\b/.test(text) && /\breact|product|form/.test(text))) return factAnswer(findFact('unit9.neutralization'));
  if (/\blitmus\b/.test(text)) return factAnswer(findFact('unit9.litmus'));
  if (/\blow ph\b|\bhigh ph\b/.test(text)) return factAnswer(findFact('unit9.low_high_ph'));
  if (/\bph\b/.test(text) && /\bmeasure/.test(text)) return factAnswer(findFact('unit9.ph'));
  if (/\belectrolyte\b/.test(text)) return factAnswer(findFact('unit9.electrolyte'));
  if (/\bacids?\b/.test(text) && hasDefinitionIntent(text) && !/\bbases?\b/.test(text)) return factAnswer(findFact('unit9.acid'));
  if (/\bbases?\b/.test(text) && hasDefinitionIntent(text) && !/\bacids?\b/.test(text)) return factAnswer(findFact('unit9.base'));
  if (/\bmedical\b|\btracer\b|\bpet scan\b|\bx ray\b|\bct scan\b|\breactor\b|\bweapons?\b/.test(text) && hasNuclearContext(text)) return factAnswer(findFact('unit9.nuclear_uses'));
  if (/\bnuclear chemistry\b/.test(text)) return factAnswer(findFact('unit9.nuclear_chemistry'));
  if (/\bradioactivity\b|\bradiation\b|\bradioactive decay\b/.test(text) && hasNuclearRadiationContext(text)) return answerRadiation(text);
  if (/\bfission\b|\bfusion\b/.test(text) && hasNuclearFusionFissionContext(text)) return factAnswer(findFact('unit9.fission_fusion'));

  if (hasDefinitionIntent(text)) {
    const factMatch = UNIT9_REACTIONS_FACTS.find((entry) => matchesFact(text, entry));
    if (factMatch) return factAnswer(factMatch);
    const vocabMatch = UNIT9_REACTIONS_VOCABULARY.find((entry) => matchesVocab(text, entry));
    if (vocabMatch) {
      return {
        id: `unit9.vocab.${slug(vocabMatch.term)}`,
        answer: vocabMatch.definition,
        type: 'definition',
        sourceRefs: vocabMatch.sourceRefs
      };
    }
  }

  return null;
}

function answerGroundedExample(text) {
  for (const example of BALANCED_REACTION_EXAMPLES) {
    if (example.patterns.some((pattern) => pattern.test(text))) {
      return conceptAnswer(example.id, example.answer);
    }
  }
  for (const example of CLASSIFICATION_EXAMPLES) {
    if (example.patterns.some((pattern) => pattern.test(text))) {
      return conceptAnswer(example.id, example.answer);
    }
  }
  if (/\b2ca\(no3\)2\b|\bca\(no3\)2\b/.test(text) && /\boxygen atoms?\b|\bhow many oxygen\b/.test(text)) {
    return conceptAnswer('unit9.example.oxygen_count', '2Ca(NO3)2 contains 12 oxygen atoms.');
  }
  if (/\bzn\b.*\b2hcl\b.*\bzncl2\b.*\bh2\b|\b65\b.*\b72\b.*\b135\b/.test(text)) {
    return conceptAnswer('unit9.example.missing_mass', 'By conservation of mass, 65 g + 72 g = 137 g of reactants. If ZnCl2 is 135 g, H2 is 2 g.');
  }
  return null;
}

function answerThermalSurroundings(text) {
  const explicitProcess = classifyExplicitThermalProcess(text);
  if (explicitProcess && hasThermalProcessSurroundingsIntent(text)) {
    if (explicitProcess === 'exothermic') {
      return conceptAnswer(
        'unit9.exothermic_process_surroundings',
        'This is an exothermic process because it releases thermal energy to the surroundings.'
      );
    }
    return conceptAnswer(
      'unit9.endothermic_process_surroundings',
      'This is an endothermic process because it absorbs thermal energy from the surroundings.'
    );
  }

  if (!hasThermalSurroundingsContext(text)) return null;

  const classification = classifyThermalSurroundingsTransfer(text);
  if (!classification) return null;

  const mentionsAir = /\bsurrounding air\b/.test(text);
  if (classification === 'exothermic') {
    if (mentionsAir) {
      return conceptAnswer(
        'unit9.exothermic_surrounding_air',
        'This is an exothermic reaction because thermal energy flows from the reacting chemicals to the surrounding air. The air gains thermal energy and usually becomes warmer.',
        TEACHER_APPROVED_ENERGY_SOURCE_REFERENCES
      );
    }
    return factAnswer(findFact('unit9.exothermic_surroundings'));
  }

  if (mentionsAir) {
    return conceptAnswer(
      'unit9.endothermic_surrounding_air',
      'This is an endothermic reaction because it absorbs thermal energy from the surrounding air. The air loses thermal energy and usually becomes cooler.',
      TEACHER_APPROVED_ENERGY_SOURCE_REFERENCES
    );
  }
  return factAnswer(findFact('unit9.endothermic_surroundings'));
}

function classifyExplicitThermalProcess(text) {
  const hasExothermicProcess = /\bexothermic process(?:es)?\b/.test(text);
  const hasEndothermicProcess = /\bendothermic process(?:es)?\b/.test(text);
  if (hasExothermicProcess && !hasEndothermicProcess) return 'exothermic';
  if (hasEndothermicProcess && !hasExothermicProcess) return 'endothermic';
  return '';
}

function hasThermalProcessSurroundingsIntent(text) {
  return /\b(?:surroundings?|room|surrounding air)\b/.test(text) &&
    /\b(?:what happens?|affected|effect|classify|explain|absorbs?|releases?|gain|gains|lose|loses)\b/.test(text);
}

function classifyThermalSurroundingsTransfer(text) {
  const hasExothermicOnly = /\bexothermic\b/.test(text) && !/\bendothermic\b/.test(text);
  const hasEndothermicOnly = /\bendothermic\b/.test(text) && !/\bexothermic\b/.test(text);
  if (hasExothermicOnly) return 'exothermic';
  if (hasEndothermicOnly) return 'endothermic';

  const system = '(?:reacting chemicals?|reactants?|reacting system|reaction|system)';
  const surroundings = '(?:surrounding air|surroundings?|room)';
  const thermalEnergy = '(?:thermal energy|heat)';
  const exothermicPatterns = [
    new RegExp(`\\b${system}\\b.*\\b(?:releases?|gives? off)\\b.*\\b${thermalEnergy}\\b.*\\b(?:to|into)\\b.*\\b${surroundings}\\b`),
    new RegExp(`\\b${thermalEnergy}\\b.*\\bflows?\\b.*\\bfrom\\b.*\\b${system}\\b.*\\b(?:to|into)\\b.*\\b${surroundings}\\b`),
    new RegExp(`\\b${thermalEnergy}\\b.*\\b(?:is )?released\\b.*\\b(?:to|into)\\b.*\\b${surroundings}\\b`)
  ];
  const endothermicPatterns = [
    new RegExp(`\\b${system}\\b.*\\babsorbs?\\b.*\\b${thermalEnergy}\\b.*\\bfrom\\b.*\\b${surroundings}\\b`),
    new RegExp(`\\b${thermalEnergy}\\b.*\\bflows?\\b.*\\bfrom\\b.*\\b${surroundings}\\b.*\\b(?:to|into)\\b.*\\b${system}\\b`),
    new RegExp(`\\b${thermalEnergy}\\b.*\\b(?:is )?absorbed\\b.*\\b(?:by|into)\\b.*\\b${system}\\b.*\\bfrom\\b.*\\b${surroundings}\\b`)
  ];

  if (exothermicPatterns.some((pattern) => pattern.test(text))) return 'exothermic';
  if (endothermicPatterns.some((pattern) => pattern.test(text))) return 'endothermic';
  return '';
}

function mentionsAllReactionClasses(text) {
  return /\bsynthesis\b/.test(text) &&
    /\bdecomposition\b/.test(text) &&
    /\bcombustion\b/.test(text) &&
    /\bsingle replacement\b/.test(text) &&
    /\bdouble replacement\b/.test(text);
}

function answerComparison(text) {
  if (/\b(?:compare|difference|different|vs|versus)\b/.test(text)) {
    if (/\bexergonic\b/.test(text) && /\bexothermic\b/.test(text)) return factAnswer(findFact('unit9.exergonic_exothermic'));
    if (/\bendergonic\b/.test(text) && /\bendothermic\b/.test(text)) return factAnswer(findFact('unit9.endergonic_endothermic'));
    if (/\bfission\b/.test(text) && /\bfusion\b/.test(text)) return factAnswer(findFact('unit9.fission_fusion'));
    if (/\bacids?\b/.test(text) && /\bbases?\b/.test(text)) {
      return conceptAnswer('unit9.compare.acid_base', 'An acid produces hydrogen ions in water and has pH below 7. A base produces hydroxide ions in water and has pH above 7.');
    }
    if (/\bphysical change\b/.test(text) && /\bchemical change\b/.test(text)) {
      return conceptAnswer('unit9.compare.physical_chemical_change', 'A physical change does not make a new substance. A chemical change makes a new substance.');
    }
  }
  return null;
}

function answerRateFactor(text) {
  if (/\btemperature\b/.test(text) && /\bconcentration\b/.test(text) && /\bsurface area\b/.test(text) && /\bcatalyst\b/.test(text)) {
    return factAnswer(findFact('unit9.rate_factors'));
  }
  if (/\btemperature\b/.test(text)) return conceptAnswer('unit9.rate.temperature', 'Higher temperature usually increases reaction rate because particles move faster and collide more often.');
  if (/\bconcentration\b/.test(text)) return conceptAnswer('unit9.rate.concentration', 'Higher concentration usually increases reaction rate because more particles in the same space can collide more often.');
  if (/\bsurface area\b/.test(text)) return conceptAnswer('unit9.rate.surface_area', 'Greater surface area usually increases reaction rate because more material is exposed for collisions.');
  if (/\bcatalyst\b/.test(text)) return factAnswer(findFact('unit9.catalyst'));
  if (/\bpressure\b/.test(text)) return conceptAnswer('unit9.rate.pressure', 'For gases, higher pressure usually increases reaction rate because particles are forced closer together.');
  return factAnswer(findFact('unit9.rate_factors'));
}

function answerRadiation(text) {
  if (/\balpha\b/.test(text) && /\bbeta\b/.test(text) && /\bgamma\b/.test(text)) return factAnswer(findFact('unit9.alpha_beta_gamma'));
  if (/\belectromagnetic energy\b/.test(text)) return conceptAnswer('unit9.radiation.gamma', 'Gamma radiation releases electromagnetic energy.');
  if (/\bgamma\b/.test(text)) return conceptAnswer('unit9.radiation.gamma', 'Gamma radiation releases electromagnetic energy.');
  if (/\balpha\b/.test(text)) return conceptAnswer('unit9.radiation.alpha', 'Alpha radiation releases an alpha particle with 2 protons and 2 neutrons.');
  if (/\bbeta\b/.test(text)) return conceptAnswer('unit9.radiation.beta', 'Beta radiation releases a beta particle from the nucleus.');
  return factAnswer(findFact('unit9.radioactivity'));
}

function hasReactionsContext(text) {
  if (/\bcoefficient\s+of\s+friction\b/.test(text)) return false;
  if (looksLikeUnit8NamingOrFormulaWriting(text)) return false;
  if (looksLikeUnit7AtomicStructureOnly(text)) return false;
  if (looksLikeUnit6MatterBoundary(text)) return false;
  if (looksLikeUnit5WavesBoundary(text)) return false;
  if (looksLikeUnit6PhysicalChemicalChangeBoundary(text)) return false;
  if (/\bhalf life\b|\bstoichiometry\b|\blimiting reactant\b|\bmole ratio\b|\btitration\b|\bpoh\b|\bka\b|\bkb\b/.test(text)) return false;

  return hasThermalSurroundingsContext(text) ||
    /\b(?:reaction|reactants?|products?|coefficients?|subscripts?|chemical equation|yields?|aqueous|aq|precipitate|synthesis|decomposition|combustion|single replacement|double replacement|exergonic|exothermic|endergonic|endothermic|reaction rate|rate factor|activation energy|catalyst|electrolyte|hydrogen ion|hydronium ion|hydroxide ion|strong acid|strong base|weak acid|weak base|neutralization|litmus|nuclear chemistry|radioactivity|radioactive decay|nuclear reactor|chain reaction|radioactive waste|tracer|pet scan)\b/.test(text) ||
    (/\b(?:conservation of mass|law of conservation|missing mass)\b/.test(text) && hasUnit9ConservationContext(text)) ||
    (/\b(?:radiation|alpha|beta|gamma)\b/.test(text) && hasNuclearRadiationContext(text)) ||
    (/\b(?:fission|fusion)\b/.test(text) && hasNuclearFusionFissionContext(text)) ||
    (/\bevidence\b/.test(text) && /\bchemical change\b/.test(text)) ||
    (/\bph\b/.test(text) && /\b(?:measure|low|high|acid|base|hydrogen|hydroxide)\b/.test(text)) ||
    (hasDefinitionIntent(text) && (/\bacids?\b/.test(text) || /\bbases?\b/.test(text)) && !/\bacetic acid\b/.test(text)) ||
    (/\bacids?\b|\bbases?\b/.test(text) && /\b(?:hydrogen ion|hydroxide ion|neutralization|salt and water|litmus|ph|water|produce|produces)\b/.test(text)) ||
    /\b(?:\d*)?(?:h2|o2|h2o|al2o3|ca\(no3\)2|zncl2|licl|libr|kclo3|n2o5|c3h8|ca\(oh\)2|h3po4|ca3\(po4\)2)\b/.test(text);
}

function hasThermalSurroundingsContext(text) {
  const hasSurroundings = /\b(?:surroundings?|room|surrounding air)\b/.test(text);
  const hasEnergyTerm = /\b(?:thermal energy|heat|exothermic|endothermic)\b/.test(text);
  const hasReactingSystem = /\b(?:chemical reaction|reaction|reacting chemicals?|reactants?|reacting system)\b/.test(text);
  const hasTransferOrEffectIntent = /\b(?:absorbs?|absorbed|releases?|released|gives? off|flows?|gain|gains|lose|loses|warmer|cooler|what happens?|affected|effect|classify|explain)\b/.test(text);
  return hasSurroundings && hasEnergyTerm && hasReactingSystem && hasTransferOrEffectIntent;
}

function looksLikeUnit8NamingOrFormulaWriting(text) {
  return /\b(?:name|called|write|formula for|what is the formula|ionic formula|covalent naming|roman numeral|polyatomic ion|crisscross|prefixes?)\b/.test(text) &&
    /\b(?:compound|ionic|covalent|carbonate|nitrate|sulfate|phosphate|acetate|ammonium|chlorate|iron|copper|chromium|manganese|titanium|aluminum carbonate|calcium nitrate|carbon dioxide|trisulfur dinitride|fe2o3|co2)\b/.test(text) &&
    !/\b(?:reaction|balance|classify|neutralization|oxygen atoms|coefficient|subscript)\b/.test(text);
}

function looksLikeUnit7AtomicStructureOnly(text) {
  return /\b(?:atomic number|mass number|isotope|bohr|periodic table|valence electrons?|electron cloud|atom structure|subatomic particles?)\b/.test(text);
}

function looksLikeUnit6MatterBoundary(text) {
  if (/\bheat of fusion\b/.test(text)) return true;
  if (/\brust\b/.test(text) && /\bclosed system\b/.test(text) && !hasReactionEquationOrMathContext(text)) return true;
  if (/\b(?:conservation of mass|law of conservation of mass|conservation of matter|law of conservation)\b/.test(text) && !hasUnit9ConservationContext(text)) return true;
  return false;
}

function looksLikeUnit6PhysicalChemicalChangeBoundary(text) {
  return /\bphysical\b/.test(text) &&
    /\bchemical\b/.test(text) &&
    /\bchange\b/.test(text) &&
    !/\breactions?\b|\breactants?\b|\bproducts?\b|\bprecipitate\b|\bgas production\b|\btemperature\b|\bcolor change\b|\blight production\b|\bodor change\b/.test(text);
}

function looksLikeUnit5WavesBoundary(text) {
  if (/\bem radiation\b|\belectromagnetic radiation\b|\belectromagnetic spectrum\b|\bem spectrum\b/.test(text) && !hasNuclearRadiationContext(text)) return true;
  if (/\bgamma rays?\b/.test(text) && !hasNuclearRadiationContext(text)) return true;
  if (/\b(?:radio|microwaves?|infrared|visible light|ultraviolet|uv|x rays?|gamma rays?)\b/.test(text) &&
    /\b(?:used for|uses?|cooking|doppler|radar|gps|mobile phone|signals?|spectrum|wavelength|frequency)\b/.test(text)) {
    return true;
  }
  return false;
}

function hasUnit9ConservationContext(text) {
  if (/\brust\b/.test(text) && /\bclosed system\b/.test(text) && !hasReactionEquationOrMathContext(text)) return false;
  return hasReactionEquationOrMathContext(text) ||
    /\bchemical reactions?\b|\breactions?\b|\breactants?\b|\bproducts?\b|\bbalanc(?:e|ed|ing)\b|\bequations?\b|\bbefore\b.*\bafter\b.*\breactions?\b|\bafter\b.*\bbefore\b.*\breactions?\b/.test(text);
}

function hasReactionEquationOrMathContext(text) {
  return /\bmissing mass\b|\bbalanc(?:e|ed|ing)\b|\bchemical equations?\b|\bequations?\b|\breactants?\b|\bproducts?\b|\b\d+\s*g\b|\b(?:h2|o2|h2o|al2o3|ca\(no3\)2|zncl2|licl|libr|kclo3|n2o5|c3h8|ca\(oh\)2|h3po4|ca3\(po4\)2)\b/.test(text);
}

function hasNuclearContext(text) {
  return /\bnuclear\b|\bradioactiv(?:e|ity)\b|\bdecay\b|\balpha\b|\bbeta\b|\bgamma\b.*\bnuclear\b|\bnucleus\b|\bnuclei\b|\batoms?\b|\bstars?\b|\bfission\b|\bfusion\b|\btracer\b|\bpet scan\b|\breactor\b/.test(text);
}

function hasNuclearRadiationContext(text) {
  return /\bnuclear\b|\bradioactiv(?:e|ity)\b|\bdecay\b|\bnucleus\b|\bnuclei\b|\balpha\b|\bbeta\b|\btracer\b|\bpet scan\b|\breactor\b|\bfission\b|\bfusion\b/.test(text) ||
    /\bgamma radiation\b/.test(text);
}

function hasNuclearFusionFissionContext(text) {
  if (/\bheat of fusion\b/.test(text)) return false;
  return /\bnuclear\b|\batoms?\b|\bnucleus\b|\bnuclei\b|\bstars?\b|\bfission\b.*\bfusion\b|\bfusion\b.*\bfission\b|\breactor\b/.test(text);
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

function factAnswer(entry) {
  return {
    id: entry.id,
    answer: entry.definition,
    type: 'definition',
    sourceRefs: entry.sourceRefs
  };
}

function conceptAnswer(id, answer, sourceRefs = SOURCE_REFERENCES) {
  return { id, answer, type: 'science_concept', sourceRefs };
}

function findFact(id) {
  return UNIT9_REACTIONS_FACTS.find((entry) => entry.id === id);
}

function fact(id, canonicalTerm, aliases, definition, sourceRefs = SOURCE_REFERENCES) {
  return Object.freeze({
    id,
    canonicalTerm,
    aliases,
    definition,
    examples: [],
    sourceRefs
  });
}

function vocabAnswer(term) {
  const entry = UNIT9_REACTIONS_VOCABULARY.find((candidate) => normalize(candidate.term) === normalize(term));
  return {
    id: `unit9.vocab.${slug(entry.term)}`,
    answer: entry.definition,
    type: 'definition',
    sourceRefs: entry.sourceRefs
  };
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
    expectedTool: 'unit9_reactions_knowledge',
    expectedCoreAnswer,
    sourceRefs: SOURCE_REFERENCES
  });
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
  UNIT9_REACTIONS_METADATA,
  UNIT9_REACTIONS_PACKET,
  UNIT9_REACTIONS_FACTS,
  UNIT9_REACTIONS_VOCABULARY,
  UNIT9_REACTIONS_CONCEPTS,
  UNIT9_REACTIONS_COMPARISONS,
  UNIT9_REACTIONS_RELATIONSHIPS,
  UNIT9_REACTIONS_REFERENCE_FORMULAS,
  UNIT9_REACTIONS_EXAMPLES,
  tryUnit9ReactionsKnowledge
};
