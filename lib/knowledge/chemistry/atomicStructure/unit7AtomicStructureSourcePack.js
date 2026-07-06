const UNIT7_SOURCE_REFERENCES = [
  '8th Science TEST atoms, PT history, PT info .pdf',
  'HW 1.5 Atomic Structure .pdf',
  'Atomic Structure _ .pdf',
  'Packet KEY - Atomic Structure Honors.pdf',
  'Test Key Honors (2).pdf',
  'Review Game Atomic Structure.pptx',
  'Concept 1 Notes - Structure of the Atom.pptx',
  'Concept 2 Notes - Isotopes.pptx',
  'Concept 3 Notes -Periodic Table.pptx'
];

const UNIT7_CONCEPT_GROUPS = [
  conceptGroup('unit7.concept.structure_of_atom', 'Structure of the Atom', [
    'atom',
    'element',
    'nucleus',
    'electron cloud',
    'proton',
    'neutron',
    'electron',
    'quarks',
    'energy levels',
    'valence electrons'
  ]),
  conceptGroup('unit7.concept.isotopes', 'Isotopes', [
    'atomic number',
    'mass number',
    'average atomic mass',
    'isotopes',
    'hyphen notation',
    'nuclear notation'
  ]),
  conceptGroup('unit7.concept.periodic_table', 'Periodic Table of Elements', [
    'periodic table',
    'groups',
    'periods',
    'alkali metals',
    'alkaline earth metals',
    'transition metals',
    'halogens',
    'noble gases',
    'metals',
    'nonmetals',
    'metalloids'
  ]),
  conceptGroup('unit7.concept.atomic_theory_history', 'Atomic Theory History', [
    'Democritus',
    'Dalton',
    'Thomson',
    'Rutherford',
    'Mendeleev',
    'Moseley',
    'Bohr',
    'Schrodinger',
    'Heisenberg',
    'Chadwick'
  ]),
  conceptGroup('unit7.concept.bohr_models', 'Bohr Models', [
    'protons from atomic number',
    'neutrons from mass number minus atomic number',
    'neutral electrons from protons',
    'shell capacities',
    'valence electrons from group',
    'energy levels from period'
  ])
];

const UNIT7_VOCABULARY = [
  vocab('atom', ['atoms', 'smallest particle of an element']),
  vocab('element', ['simplest form of matter', 'one type of atom']),
  vocab('nucleus', ['atomic nucleus', 'dense center']),
  vocab('electron cloud', ['electron cloud model', 'regions of space']),
  vocab('proton', ['protone', 'protons', 'p+']),
  vocab('neutron', ['nuetron', 'nuetrons', 'newtron', 'neutrons', 'n0']),
  vocab('electron', ['eletron', 'eletrons', 'electon', 'electrons', 'e-']),
  vocab('atomic number', ['number of protons', 'identifies element']),
  vocab('mass number', ['protons plus neutrons', 'atomic mass number']),
  vocab('average atomic mass', ['weighted average', 'most common isotope']),
  vocab('isotope', ['isotopes', 'same element different neutrons']),
  vocab('hyphen notation', ['carbon-13', 'element name mass number']),
  vocab('nuclear notation', ['13c', 'mass number before symbol']),
  vocab('group', ['groups', 'family', 'families', 'columns', 'vertical columns']),
  vocab('period', ['periods', 'rows', 'horizontal rows']),
  vocab('valence electrons', ['outer electrons', 'outermost electrons']),
  vocab('metalloid', ['metalloids', 'metaloids', 'semiconductor', 'stair-step'])
];

const UNIT7_FORMULAS_AND_RULES = [
  rule('unit7.rule.atomic_number_protons', 'Atomic number = number of protons.', 'formula_tutor'),
  rule('unit7.rule.protons_atomic_number', 'Number of protons = atomic number.', 'formula_tutor'),
  rule('unit7.rule.neutral_electrons', 'In a neutral atom, electrons = protons = atomic number.', 'formula_tutor'),
  rule('unit7.rule.mass_number', 'Mass number = protons + neutrons.', 'formula_tutor'),
  rule('unit7.rule.neutrons', 'Neutrons = mass number - atomic number.', 'formula_tutor'),
  rule('unit7.rule.isotope_hyphen', 'Hyphen notation uses element name + mass number, such as Carbon-13.', 'formula_tutor'),
  rule('unit7.rule.isotope_nuclear', 'Nuclear notation places the mass number before the symbol, such as 13C.', 'formula_tutor'),
  rule('unit7.rule.bohr_shells', 'For this course, fill Bohr shells inside out with 2, 8, 8, then 18 electrons.', 'formula_tutor'),
  rule('unit7.rule.group_valence', 'Main-group elements in the same group have the same number of valence electrons.', 'concept_tutor'),
  rule('unit7.rule.period_energy_levels', 'Elements in the same period have the same number of energy levels.', 'concept_tutor')
];

const UNIT7_VISUAL_DIAGRAM_FACTS = [
  curatedFact('unit7.visual.diagram.green_negative_particles', 'In an atom diagram, green negative particles are electrons.', ['green negative particles', 'negative particles in atom diagram', 'green particles']),
  curatedFact('unit7.visual.diagram.nucleus_center', 'The nucleus is the center of the atom.', ['center of atom diagram', 'middle of atom diagram']),
  curatedFact('unit7.visual.diagram.shell_ring', 'A shell, ring, or energy level is the circular level around the nucleus where electrons are shown.', ['shell ring', 'ring around nucleus', 'circular level', 'energy level ring'])
];

const UNIT7_ELEMENT_TILE_FIELDS = [
  curatedFact('unit7.tile.atomic_number', 'On an element tile, the atomic number tells the number of protons.', ['which part is atomic number', 'atomic number on a tile', 'top number on tile']),
  curatedFact('unit7.tile.symbol', 'On an element tile, the symbol is the large one- or two-letter abbreviation.', ['which part is symbol', 'element symbol on tile', 'large letters on tile']),
  curatedFact('unit7.tile.element_name', 'On an element tile, the element name is the written name of the element.', ['which part is element name', 'written name on tile']),
  curatedFact('unit7.tile.atomic_mass', 'On an element tile, atomic mass is the decimal mass number. Round it when the course asks for the most common mass number.', ['which part is atomic mass', 'atomic mass on tile', 'decimal number on tile', 'rounded mass'])
];

const UNIT7_OPEN_RESPONSE_FACTS = [
  curatedFact('unit7.open_response.atom_forces', 'Three important forces or interactions in an atom are attraction between the positive nucleus and negative electron cloud, electron-electron repulsion that helps give the electron cloud volume, and proton-proton repulsion that means the nucleus needs strong binding energy.', ['three forces holding atom together', 'forces holding atom together']),
  curatedFact('unit7.open_response.mass_volume_location', 'Most of the atom’s mass is in the nucleus, while most of the atom’s volume is in the electron cloud.', ['where is mass and volume in atom', 'mass in nucleus volume in electron cloud']),
  curatedFact('unit7.open_response.nucleus_cloud_charge', 'The nucleus is positive because it contains protons, and the electron cloud is negative because it contains electrons.', ['nucleus positive electron cloud negative', 'charge of nucleus and electron cloud']),
  curatedFact('unit7.open_response.nucleus_particles', 'Protons and neutrons are in the nucleus.', ['protons and neutrons are in nucleus', 'which particles are in nucleus']),
  curatedFact('unit7.open_response.electrons_not_mass_number', 'Electrons are not counted in mass number because their mass is very small compared with protons and neutrons.', ['electrons not counted in mass number', 'why electrons not mass number']),
  curatedFact('unit7.open_response.quarks', 'Quarks make up protons and neutrons.', ['quarks make up protons and neutrons', 'what do quarks make']),
  curatedFact('unit7.open_response.valence_energy', 'Valence electrons are in the outermost energy level, so they have the most energy.', ['valence electrons most energy', 'outermost energy level most energy'])
];

const UNIT7_COMPARISON_PAIRS = [
  comparison({
    id: 'unit7.compare.proton.neutron.electron',
    concepts: ['proton', 'neutron', 'electron'],
    left: 'protons',
    right: 'neutrons and electrons',
    aliases: ['subatomic particles', 'protons neutrons electrons', 'proton neutron electron'],
    same: 'Protons, neutrons, and electrons are subatomic particles that make up atoms.',
    differences: [
      'Protons are positive particles in the nucleus and identify the element.',
      'Neutrons are neutral particles in the nucleus and add mass.',
      'Electrons are negative particles in the electron cloud and are not counted in mass number.'
    ],
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx']
  }),
  comparison({
    id: 'unit7.compare.proton.electron',
    concepts: ['proton', 'electron'],
    left: 'proton',
    right: 'electron',
    same: 'Both are charged subatomic particles in atoms.',
    differences: [
      'A proton is positive, is in the nucleus, and helps identify the element.',
      'An electron is negative, is in the electron cloud, and has very small mass.'
    ],
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx']
  }),
  comparison({
    id: 'unit7.compare.neutron.electron',
    concepts: ['neutron', 'electron'],
    left: 'neutron',
    right: 'electron',
    same: 'Both are subatomic particles found in atoms.',
    differences: [
      'A neutron is neutral, is in the nucleus, and adds to mass number.',
      'An electron is negative, is in the electron cloud, and is not counted in mass number.'
    ],
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx']
  }),
  comparison({
    id: 'unit7.compare.nucleus.electron_cloud',
    concepts: ['nucleus', 'electron cloud'],
    left: 'nucleus',
    right: 'electron cloud',
    same: 'Both are parts of an atom.',
    differences: [
      'The nucleus is the dense positive center and contains protons, neutrons, and most of the mass.',
      'The electron cloud is the space around the nucleus where electrons are found and takes up most of the volume.'
    ],
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx']
  }),
  comparison({
    id: 'unit7.compare.atom_mass.volume',
    concepts: ['mass of atom', 'volume of atom'],
    left: 'mass of an atom',
    right: 'volume of an atom',
    aliases: ['mass vs volume atom', 'most mass most volume'],
    same: 'Both describe the structure of an atom.',
    differences: [
      'Most of an atom’s mass is in the nucleus because protons and neutrons are there.',
      'Most of an atom’s volume is the electron cloud because electrons occupy the space around the nucleus.'
    ],
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx']
  }),
  comparison({
    id: 'unit7.compare.bohr.electron_cloud',
    concepts: ['Bohr model', 'electron cloud model'],
    left: 'Bohr model',
    right: 'electron cloud model',
    same: 'Both are atomic models that describe where electrons are around the nucleus.',
    differences: [
      'The Bohr model shows electrons in fixed orbits or energy levels.',
      'The electron cloud model says electrons are found in regions of space, not fixed paths.'
    ],
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx']
  }),
  comparison({
    id: 'unit7.compare.dalton.thomson',
    concepts: ['Dalton model', 'Thomson model'],
    left: 'Dalton model',
    right: 'Thomson model',
    same: 'Both were early models used to explain atoms.',
    differences: [
      'Dalton described atoms as solid spheres.',
      'Thomson discovered electrons and proposed the plum pudding model, showing atoms are divisible.'
    ],
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx']
  }),
  comparison({
    id: 'unit7.compare.thomson.rutherford',
    concepts: ['Thomson model', 'Rutherford model'],
    left: 'Thomson model',
    right: 'Rutherford model',
    same: 'Both improved atomic theory after Dalton.',
    differences: [
      'Thomson’s plum pudding model included electrons inside a positive atom.',
      'Rutherford’s gold foil experiment showed atoms have a small dense positive nucleus.'
    ],
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx']
  }),
  comparison({
    id: 'unit7.compare.rutherford.bohr',
    concepts: ['Rutherford model', 'Bohr model'],
    left: 'Rutherford model',
    right: 'Bohr model',
    same: 'Both include a nucleus at the center of the atom.',
    differences: [
      'Rutherford showed the atom has a small dense positive nucleus.',
      'Bohr added electrons in fixed orbits or energy levels around the nucleus.'
    ],
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx']
  }),
  comparison({
    id: 'unit7.compare.mendeleev.moseley',
    concepts: ['Mendeleev', 'Moseley'],
    left: 'Mendeleev',
    right: 'Moseley',
    same: 'Both are connected to the development of the periodic table.',
    differences: [
      'Mendeleev arranged an early periodic table by atomic mass and predicted missing elements.',
      'Moseley showed atomic number, or proton number, is unique to each element and organizes the modern periodic table.'
    ],
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx', 'Atomic Structure Honors source pack']
  }),
  comparison({
    id: 'unit7.compare.atomic_number.mass_number',
    concepts: ['atomic number', 'mass number'],
    left: 'atomic number',
    right: 'mass number',
    same: 'Both are numbers used to describe atoms and support atomic calculations.',
    differences: [
      'Atomic number tells the number of protons and identifies the element.',
      'Mass number tells protons plus neutrons for one isotope of an atom.'
    ],
    sourceRefs: ['Concept 2 Notes - Isotopes.pptx', 'Packet KEY - Atomic Structure Honors.pdf']
  }),
  comparison({
    id: 'unit7.compare.mass_number.average_atomic_mass',
    concepts: ['mass number', 'average atomic mass'],
    left: 'mass number',
    right: 'average atomic mass',
    same: 'Both describe atomic mass information.',
    differences: [
      'Mass number is protons plus neutrons for one atom or isotope and is a whole number.',
      'Average atomic mass is the weighted average of naturally occurring isotopes and is usually closest to the most common isotope.'
    ],
    sourceRefs: ['Concept 2 Notes - Isotopes.pptx']
  }),
  comparison({
    id: 'unit7.compare.isotope.normal_atom',
    concepts: ['isotope', 'atom'],
    left: 'isotope',
    right: 'normal atom wording',
    aliases: ['isotope normal atom', 'isotope atom'],
    same: 'An isotope is still an atom of an element, and isotopes of the same element have the same protons.',
    differences: [
      'Isotope wording emphasizes atoms of the same element with different numbers of neutrons and different mass numbers.',
      'Normal atom wording often describes the element without focusing on which isotope or mass number it has.'
    ],
    sourceRefs: ['Concept 2 Notes - Isotopes.pptx']
  }),
  comparison({
    id: 'unit7.compare.hyphen_notation.nuclear_notation',
    concepts: ['hyphen notation', 'nuclear notation'],
    left: 'hyphen isotope notation',
    right: 'nuclear notation',
    aliases: ['isotope notation forms', 'hyphen form nuclear form'],
    same: 'Both forms show the isotope by including the mass number.',
    differences: [
      'Hyphen notation writes the element name and mass number, such as Carbon-13.',
      'Nuclear notation places the mass number before the chemical symbol, such as 13C.'
    ],
    sourceRefs: ['Concept 2 Notes - Isotopes.pptx']
  }),
  comparison({
    id: 'unit7.compare.groups.periods',
    concepts: ['groups', 'periods'],
    left: 'groups',
    right: 'periods',
    same: 'Both organize elements on the periodic table.',
    differences: [
      'Groups are vertical columns; elements in the same group have the same number of valence electrons and similar chemical properties.',
      'Periods are horizontal rows; elements in the same period have the same number of energy levels.'
    ],
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx']
  }),
  comparison({
    id: 'unit7.compare.valence_electrons.energy_levels',
    concepts: ['valence electrons', 'energy levels'],
    left: 'valence electrons',
    right: 'energy levels',
    same: 'Both describe where electrons are arranged in atoms.',
    differences: [
      'Valence electrons are the electrons in the outermost energy level and relate to group and chemical properties.',
      'Energy levels are shells around the nucleus; the number of occupied levels relates to the period.'
    ],
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx']
  }),
  comparison({
    id: 'unit7.compare.metals.nonmetals.metalloids',
    concepts: ['metals', 'nonmetals', 'metalloids'],
    left: 'metals',
    right: 'nonmetals and metalloids',
    aliases: ['metals nonmetals metalloids', 'metal nonmetal metalloid'],
    same: 'Metals, nonmetals, and metalloids are element classifications based on periodic table location and properties.',
    differences: [
      'Metals are left of the metalloids and are usually shiny, malleable, ductile, and good conductors.',
      'Nonmetals are right of the metalloids plus hydrogen and are usually poor conductors.',
      'Metalloids are near the stair-step line and have properties of both metals and nonmetals.'
    ],
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx']
  }),
  comparison({
    id: 'unit7.compare.metals.nonmetals',
    concepts: ['metals', 'nonmetals'],
    left: 'metals',
    right: 'nonmetals',
    same: 'Both are classifications of elements on the periodic table.',
    differences: [
      'Metals are generally left of the metalloids, shiny, malleable, ductile, and good conductors.',
      'Nonmetals are generally right of the metalloids plus hydrogen, and are poor conductors.'
    ],
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx']
  }),
  comparison({
    id: 'unit7.compare.alkali.alkaline_earth',
    concepts: ['alkali metals', 'alkaline earth metals'],
    left: 'alkali metals',
    right: 'alkaline earth metals',
    same: 'Both are reactive metal groups on the periodic table.',
    differences: [
      'Alkali metals are Group 1 metals, excluding hydrogen, and are the most reactive metals.',
      'Alkaline earth metals are Group 2 metals.'
    ],
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx']
  }),
  comparison({
    id: 'unit7.compare.halogens.noble_gases',
    concepts: ['halogens', 'noble gases'],
    left: 'halogens',
    right: 'noble gases',
    same: 'Both are named groups on the periodic table.',
    differences: [
      'Halogens are Group 17 and are the most reactive nonmetals.',
      'Noble gases are Group 18 and are stable or mostly nonreactive.'
    ],
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx']
  }),
  comparison({
    id: 'unit7.compare.hydrogen.alkali_metals',
    concepts: ['hydrogen', 'alkali metals'],
    left: 'hydrogen',
    right: 'alkali metals',
    same: 'Hydrogen is placed in Group 1 because it has 1 valence electron.',
    differences: [
      'Hydrogen is a nonmetal.',
      'Alkali metals are Group 1 metals and are the most reactive metals; hydrogen is not classified as an alkali metal.'
    ],
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx']
  }),
  comparison({
    id: 'unit7.compare.helium.noble_gases',
    concepts: ['helium', 'noble gases'],
    left: 'helium',
    right: 'other noble gases',
    same: 'Helium is a noble gas and is stable.',
    differences: [
      'Helium has 2 valence electrons.',
      'Most other noble gases have 8 valence electrons.'
    ],
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx']
  }),
  comparison({
    id: 'unit7.compare.element.compound',
    concepts: ['element', 'compound'],
    left: 'element',
    right: 'compound',
    same: 'Both are types of matter made of atoms.',
    differences: [
      'An element is made of one type of atom.',
      'A compound has atoms of different elements chemically joined together.'
    ],
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx', 'Unit 6 matter knowledge boundary']
  })
];

const UNIT7_RELATIONSHIP_EDGES = [
  edge('atomic number', 'tells', 'number of protons'),
  edge('atomic number', 'identifies', 'element'),
  edge('neutral atom', 'has same number of', 'protons and electrons'),
  edge('mass number', 'equals', 'protons + neutrons'),
  edge('neutrons', 'equal', 'mass number - atomic number'),
  edge('isotope', 'same element because', 'same protons'),
  edge('isotope', 'different mass because', 'different neutrons'),
  edge('group', 'tells', 'valence electrons'),
  edge('period', 'tells', 'energy levels'),
  edge('metals', 'located', 'left of metalloids'),
  edge('nonmetals', 'located', 'right of metalloids plus hydrogen'),
  edge('metalloids', 'located', 'stair-step area'),
  edge('Bohr model', 'shows', 'fixed electron orbits/levels'),
  edge('electron cloud model', 'says', 'electrons are in regions of space, not fixed orbits')
];

const UNIT7_STUDENT_WORDING = {
  comparison: ['compare', 'difference between', 'how are different', 'how are alike', 'vs', 'same and different', 'similarities and differences'],
  relationship: ['which one tells', 'which number tells', 'what tells', 'what equals'],
  typos: ['protone', 'eletrons', 'nuetrons', 'metaloids', 'ruther ford', 'diffrence']
};

const UNIT7_ROUTE_PREFERENCE = {
  directAnswer: [
    'definitions',
    'facts',
    'history',
    'group names',
    'particle charges and locations',
    'comparisons',
    'relationships'
  ],
  formulaTutor: [
    'protons from atomic number',
    'electrons in neutral atoms',
    'neutrons from mass number and atomic number',
    'mass number',
    'isotope notation',
    'Bohr model setup calculations'
  ],
  conceptTutor: [
    'classification from clues',
    'atomic model identification',
    'group/period reasoning',
    'isotope sameness/difference from evidence'
  ]
};

const UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK = {
  unit: 7,
  unitTitle: 'Atomic Structure',
  gradeBand: '8th / physical science',
  sourcePack: 'atomic-structure',
  sourceReferences: UNIT7_SOURCE_REFERENCES,
  conceptGroups: UNIT7_CONCEPT_GROUPS,
  vocabulary: UNIT7_VOCABULARY,
  formulasAndRules: UNIT7_FORMULAS_AND_RULES,
  comparisonPairs: UNIT7_COMPARISON_PAIRS,
  relationshipEdges: UNIT7_RELATIONSHIP_EDGES,
  visualDiagramFacts: UNIT7_VISUAL_DIAGRAM_FACTS,
  elementTileFields: UNIT7_ELEMENT_TILE_FIELDS,
  openResponseFacts: UNIT7_OPEN_RESPONSE_FACTS,
  studentWording: UNIT7_STUDENT_WORDING,
  routePreference: UNIT7_ROUTE_PREFERENCE
};

function conceptGroup(id, title, terms) {
  return { id, title, terms, sourceRefs: UNIT7_SOURCE_REFERENCES };
}

function vocab(term, aliases) {
  return { term, aliases, sourceRefs: UNIT7_SOURCE_REFERENCES };
}

function rule(id, statement, routePreference) {
  return { id, statement, routePreference, sourceRefs: UNIT7_SOURCE_REFERENCES };
}

function comparison(config) {
  return {
    aliases: [],
    tutorPreference: 'direct_answer',
    sourceRefs: UNIT7_SOURCE_REFERENCES,
    ...config
  };
}

function edge(from, relation, to) {
  return {
    id: `unit7.relationship.${slug(from)}.${slug(relation)}.${slug(to)}`,
    from,
    relation,
    to,
    sourceRefs: UNIT7_SOURCE_REFERENCES
  };
}

function curatedFact(id, statement, aliases) {
  return {
    id,
    statement,
    aliases,
    sourceRefs: UNIT7_SOURCE_REFERENCES,
    tutorPreference: 'direct_answer'
  };
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

module.exports = {
  UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK,
  UNIT7_COMPARISON_PAIRS,
  UNIT7_CONCEPT_GROUPS,
  UNIT7_FORMULAS_AND_RULES,
  UNIT7_RELATIONSHIP_EDGES,
  UNIT7_ROUTE_PREFERENCE,
  UNIT7_SOURCE_REFERENCES,
  UNIT7_STUDENT_WORDING,
  UNIT7_VOCABULARY,
  UNIT7_VISUAL_DIAGRAM_FACTS,
  UNIT7_ELEMENT_TILE_FIELDS,
  UNIT7_OPEN_RESPONSE_FACTS
};
