const fs = require('node:fs');
const path = require('node:path');

const {
  UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK,
  UNIT7_ELEMENT_TILE_FIELDS,
  UNIT7_COMPARISON_PAIRS,
  UNIT7_OPEN_RESPONSE_FACTS,
  UNIT7_RELATIONSHIP_EDGES,
  UNIT7_ROUTE_PREFERENCE,
  UNIT7_SOURCE_REFERENCES,
  UNIT7_VISUAL_DIAGRAM_FACTS
} = require('./unit7AtomicStructureSourcePack');

const periodicTablePath = path.join(__dirname, '..', '..', '..', '..', 'knowledge', 'periodic_table.json');
const periodicTableRaw = JSON.parse(fs.readFileSync(periodicTablePath, 'utf8'));
const periodicColumns = periodicTableRaw.columns || [];
const periodicElements = (periodicTableRaw.elements || []).map((row) => {
  const element = {};
  periodicColumns.forEach((column, index) => {
    element[column] = row[index];
  });
  return element;
});

const UNIT7_ATOMIC_STRUCTURE_METADATA = {
  unit: 7,
  unitTitle: 'Atomic Structure',
  gradeBand: '8th / physical science',
  sourcePack: 'atomic-structure',
  concepts: [
    'Structure of the Atom',
    'Isotopes',
    'Periodic Table of Elements'
  ],
  subtopics: [
    'subatomic particles',
    'atomic theory history',
    'atomic number and mass number',
    'isotopes and notation',
    'periodic table groups and periods',
    'metals, nonmetals, and metalloids',
    'Bohr models'
  ],
  routePreference: {
    directAnswer: 'definitions, facts, history, group names, particle charges and locations',
    formulaTutor: 'protons/electrons/neutrons/mass number/isotope notation/Bohr setup calculations',
    conceptTutor: 'classification, model selection, group/period reasoning, isotope sameness'
  },
  sourceReferences: UNIT7_SOURCE_REFERENCES,
  sourcePackMetadata: UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK,
  structuredRoutePreference: UNIT7_ROUTE_PREFERENCE
};

const UNIT7_FACTS = [
  fact({
    id: 'unit7.atom.definition',
    canonicalTerm: 'atom',
    aliases: ['atoms', 'smallest particle of an element'],
    definition: 'An atom is the smallest particle of an element that still has the properties of that element.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx']
  }),
  fact({
    id: 'unit7.element.definition',
    canonicalTerm: 'element',
    aliases: ['simplest form of matter', 'one type of atom'],
    definition: 'An element is the simplest form of matter and is made of only one type of atom.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx']
  }),
  fact({
    id: 'unit7.nucleus',
    canonicalTerm: 'nucleus',
    aliases: ['center of atom', 'atomic nucleus', 'dense center'],
    definition: 'The nucleus is the dense, positive center of an atom. It contains protons and neutrons and holds most of the atom’s mass.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slide 7']
  }),
  fact({
    id: 'unit7.electron_cloud',
    canonicalTerm: 'electron cloud',
    aliases: ['electron cloud model', 'where electrons are', 'eletrons', 'electrons location'],
    definition: 'The electron cloud is the space around the nucleus where electrons are found. It takes up most of the atom’s volume.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slide 7']
  }),
  fact({
    id: 'unit7.energy_levels',
    canonicalTerm: 'energy levels',
    aliases: ['shells', 'electron shells', 'levels'],
    definition: 'Energy levels, or shells, are regions in the electron cloud where electrons are found. In this course, the first four shell capacities are 2, 8, 8, and 18 electrons.',
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx, slide 7']
  }),
  fact({
    id: 'unit7.valence_electrons',
    canonicalTerm: 'valence electrons',
    aliases: ['valence electron', 'outer electrons', 'outermost electrons'],
    definition: 'Valence electrons are the electrons in the outermost energy level. They help determine bonding and chemical properties.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slide 7']
  }),
  fact({
    id: 'unit7.proton',
    canonicalTerm: 'proton',
    aliases: ['protone', 'protons', 'p+'],
    definition: 'A proton is a positively charged particle in the nucleus. Protons identify the element.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slide 7']
  }),
  fact({
    id: 'unit7.neutron',
    canonicalTerm: 'neutron',
    aliases: ['nuetron', 'nuetrons', 'newtron', 'neutrons', 'n0'],
    definition: 'A neutron is a neutral particle in the nucleus. Neutrons add mass but do not change the element’s identity.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slide 7']
  }),
  fact({
    id: 'unit7.electron',
    canonicalTerm: 'electron',
    aliases: ['eletron', 'eletrons', 'electon', 'electrons', 'e-'],
    definition: 'An electron is a negatively charged particle in the electron cloud outside the nucleus. Its mass is very small and is not counted in the mass number.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slide 7']
  }),
  fact({
    id: 'unit7.quarks',
    canonicalTerm: 'quarks',
    aliases: ['quark', 'what makes protons and neutrons'],
    definition: 'Quarks are smaller particles that make up protons and neutrons.',
    sourceRefs: ['Atomic Structure Honors source pack']
  }),
  fact({
    id: 'unit7.neutral_atom',
    canonicalTerm: 'neutral atom',
    aliases: ['neutral atoms', 'electrons equal protons'],
    definition: 'A neutral atom has equal numbers of protons and electrons, so the positive and negative charges balance.',
    sourceRefs: ['Concept 2 Notes - Isotopes.pptx, slide 3']
  }),
  fact({
    id: 'unit7.atomic_forces',
    canonicalTerm: 'atomic forces',
    aliases: ['what holds atom together', 'forces in atom', 'why electron cloud has volume'],
    definition: 'Atoms are held together by attraction between the positive nucleus and negative electron cloud. Electron-electron repulsion helps give the electron cloud volume, and proton-proton repulsion means the nucleus requires strong binding energy.',
    sourceRefs: ['Atomic Structure Honors source pack']
  }),
  fact({
    id: 'unit7.democritus',
    canonicalTerm: 'Democritus',
    aliases: ['atomos', 'first named atom'],
    definition: 'Democritus first named the atom from atomos, meaning indivisible.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slides 4-6']
  }),
  fact({
    id: 'unit7.dalton',
    canonicalTerm: 'Dalton',
    aliases: ['solid sphere model', 'first atomic theory'],
    definition: 'John Dalton described atoms as solid spheres and developed an early atomic theory.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slides 4-6']
  }),
  fact({
    id: 'unit7.mendeleev',
    canonicalTerm: 'Mendeleev',
    aliases: ['early periodic table', 'predicted missing elements'],
    definition: 'Dmitri Mendeleev arranged an early periodic table by atomic mass and predicted missing elements.',
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx']
  }),
  fact({
    id: 'unit7.thomson',
    canonicalTerm: 'Thomson',
    aliases: ['plum pudding model', 'discovered electrons', 'atom divisible'],
    definition: 'J. J. Thomson discovered electrons and proposed the plum pudding model, showing atoms were divisible.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slides 4-6']
  }),
  fact({
    id: 'unit7.rutherford',
    canonicalTerm: 'Rutherford',
    aliases: ['ruther ford', 'gold foil experiment', 'nuclear model', 'discovered nucleus'],
    definition: 'Ernest Rutherford used the gold foil experiment to show that atoms have a small, dense, positive nucleus.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slides 4-6']
  }),
  fact({
    id: 'unit7.moseley',
    canonicalTerm: 'Moseley',
    aliases: ['atomic number', 'modern periodic table'],
    definition: 'Henry Moseley showed that atomic number, or number of protons, is unique to each element and is used to organize the modern periodic table.',
    sourceRefs: ['Atomic Structure Honors source pack']
  }),
  fact({
    id: 'unit7.bohr',
    canonicalTerm: 'Bohr',
    aliases: ['fixed orbits', 'energy levels', 'bohr model'],
    definition: 'Niels Bohr described electrons in fixed orbits or energy levels around the nucleus.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slides 4-6']
  }),
  fact({
    id: 'unit7.schrodinger_heisenberg',
    canonicalTerm: 'Schrodinger and Heisenberg',
    aliases: ['electron cloud scientists', 'modern atomic model'],
    definition: 'Schrodinger and Heisenberg are connected with the electron cloud model, where electrons are found in regions of space and are not fixed in orbits.',
    sourceRefs: ['Concept 1 Notes - Structure of the Atom.pptx, slides 4-6']
  }),
  fact({
    id: 'unit7.chadwick',
    canonicalTerm: 'Chadwick',
    aliases: ['neutron discovery', 'discovered neutron'],
    definition: 'James Chadwick is credited with discovering the neutron.',
    sourceRefs: ['Atomic Structure Honors source pack']
  }),
  fact({
    id: 'unit7.atomic_number',
    canonicalTerm: 'atomic number',
    aliases: ['number of protons', 'identifies element'],
    definition: 'Atomic number is the number of protons in an atom. It identifies the element.',
    sourceRefs: ['Concept 2 Notes - Isotopes.pptx, slide 3']
  }),
  fact({
    id: 'unit7.mass_number',
    canonicalTerm: 'mass number',
    aliases: ['protons plus neutrons'],
    definition: 'Mass number is the total number of protons and neutrons in the nucleus.',
    sourceRefs: ['Concept 2 Notes - Isotopes.pptx, slide 4']
  }),
  fact({
    id: 'unit7.isotopes',
    canonicalTerm: 'isotopes',
    aliases: ['isotope', 'same element different neutrons'],
    definition: 'Isotopes are atoms of the same element with the same number of protons but different numbers of neutrons, so they have different mass numbers.',
    sourceRefs: ['Concept 2 Notes - Isotopes.pptx, slide 3']
  }),
  fact({
    id: 'unit7.average_atomic_mass',
    canonicalTerm: 'average atomic mass',
    aliases: ['weighted average', 'most common isotope'],
    definition: 'Average atomic mass is the weighted average of an element’s naturally occurring isotopes. It is usually closest to the most common isotope.',
    sourceRefs: ['Concept 2 Notes - Isotopes.pptx, slide 10']
  }),
  fact({
    id: 'unit7.isotope_notation',
    canonicalTerm: 'isotope notation',
    aliases: ['hyphen notation', 'nuclear notation', 'carbon-13', '13c'],
    definition: 'Hyphen notation writes the element name and mass number, such as Carbon-13. Nuclear notation places the mass number before the chemical symbol, such as 13C.',
    sourceRefs: ['Concept 2 Notes - Isotopes.pptx, slides 8-9']
  }),
  fact({
    id: 'unit7.periodic_table',
    canonicalTerm: 'periodic table',
    aliases: ['perodic table', 'organized by atomic number'],
    definition: 'The periodic table organizes elements by atomic number and chemical properties.',
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx, slide 2']
  }),
  fact({
    id: 'unit7.groups',
    canonicalTerm: 'groups',
    aliases: ['columns', 'families', 'vertical columns'],
    definition: 'Groups are vertical columns on the periodic table. Elements in the same group have the same number of valence electrons and similar chemical properties.',
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx, slide 3']
  }),
  fact({
    id: 'unit7.periods',
    canonicalTerm: 'periods',
    aliases: ['rows', 'horizontal rows'],
    definition: 'Periods are horizontal rows on the periodic table. Elements in the same period have the same number of energy levels.',
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx, slide 7']
  }),
  fact({
    id: 'unit7.group_names',
    canonicalTerm: 'group names',
    aliases: ['alkali metals', 'alkaline earth metals', 'transition metals', 'halogens', 'noble gases', 'rare earth metals'],
    definition: 'Group 1 elements are alkali metals except hydrogen, Group 2 are alkaline earth metals, Groups 3-12 are transition metals, Group 17 are halogens, and Group 18 are noble gases. This packet also labels Group 3 as rare earth metals.',
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx, slide 5']
  }),
  fact({
    id: 'unit7.hydrogen_helium_exceptions',
    canonicalTerm: 'hydrogen and helium exceptions',
    aliases: ['hydrogen group 1', 'helium valence electrons'],
    definition: 'Hydrogen is a nonmetal in Group 1 because it has 1 valence electron, but it is not an alkali metal. Helium is a noble gas with 2 valence electrons, not 8.',
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx']
  }),
  fact({
    id: 'unit7.metals',
    canonicalTerm: 'metals',
    aliases: ['metal properties', 'Na', 'Al'],
    definition: 'Metals are left of the metalloids. They are usually shiny or silvery solids, malleable, ductile, and good conductors. Sodium and aluminum are metals.',
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx, slide 10']
  }),
  fact({
    id: 'unit7.nonmetals',
    canonicalTerm: 'nonmetals',
    aliases: ['nonmetal properties', 'Ar', 'H', 'F'],
    definition: 'Nonmetals are right of the metalloids plus hydrogen. They can be gases or dull brittle solids and are poor conductors. Argon, hydrogen, and fluorine are nonmetals.',
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx, slide 11']
  }),
  fact({
    id: 'unit7.metalloids',
    canonicalTerm: 'metalloids',
    aliases: ['metaloids', 'stair step', 'semiconductors', 'Te'],
    definition: 'Metalloids are near the stair-step line, have properties of metals and nonmetals, and are semiconductors. Tellurium is a metalloid.',
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx, slide 12']
  }),
  fact({
    id: 'unit7.bohr_model_steps',
    canonicalTerm: 'Bohr model',
    aliases: ['bohr diagram', 'draw bohr model', 'bohr model steps'],
    definition: 'To set up a Bohr model, use atomic number for protons, mass number minus atomic number for neutrons, put protons and neutrons in the nucleus, use protons for electrons in a neutral atom, then fill energy levels from the inside out. If the mass number is missing, round the average atomic mass to the nearest whole number as the most common isotope for this course.',
    sourceRefs: ['Concept 3 Notes -Periodic Table.pptx, slides 13-14']
  })
];

function tryUnit7AtomicStructureKnowledge(message) {
  const text = normalize(message);
  if (!text) return null;
  if (looksLikeAtomicCalculation(text)) return null;
  if (looksLikeUnit7ConceptTutorPrompt(text) && !looksLikeRelationshipQuestion(text)) return null;

  const answer = answerUnit7AtomicStructure(text);
  if (!answer) return null;

  return {
    type: answer.type || 'science_concept',
    confidence: 'strong',
    toolsUsed: ['unit7_atomic_structure_knowledge'],
    notes: `Answered Unit 7 Atomic Structure concept: ${answer.id}.`,
    directAnswer: answer.answer,
    aiAllowed: false,
    knowledgeRefs: answer.sourceRefs || []
  };
}

function answerUnit7AtomicStructure(text) {
  const comparisonAnswer = answerUnit7Comparison(text);
  if (comparisonAnswer) return comparisonAnswer;

  const relationshipAnswer = answerUnit7Relationship(text);
  if (relationshipAnswer) return relationshipAnswer;

  const sourcePackAnswer = answerCuratedSourcePackFact(text);
  if (sourcePackAnswer) return sourcePackAnswer;

  const tileElementAnswer = answerElementTileProtons(text);
  if (tileElementAnswer) return tileElementAnswer;

  if (/\bbohr\b/.test(text) && /\b(?:set up|setup|draw|build|make|how do|mass number|missing)\b/.test(text)) {
    return factAnswer(findFact('unit7.bohr_model_steps'));
  }

  const historyAnswer = answerAtomicHistoryScientist(text);
  if (historyAnswer) return historyAnswer;

  const coreDefinition = answerCoreAtomicDefinition(text);
  if (coreDefinition) return coreDefinition;

  if (/\b(?:where|location|found|located)\b/.test(text) && /\b(?:electrons?|eletrons?|electons?)\b/.test(text)) {
    return factAnswer(findFact('unit7.electron_cloud'));
  }
  if (/\b(?:shells?|energy levels?)\b/.test(text) && /\b(?:how many|hold|capacity|first|second|third|fourth)\b/.test(text)) {
    return factAnswer(findFact('unit7.energy_levels'));
  }
  if (asksDifference(text, ['bohr'], ['electron cloud', 'cloud model'])) {
    return concept('unit7.bohr_vs_electron_cloud', 'The Bohr model shows electrons in fixed energy levels or orbits. The electron cloud model shows electrons in regions of space instead of fixed paths.');
  }
  if (asksSameGroupSimilar(text)) {
    return concept('unit7.same_group_similar_properties', 'Elements in the same group act similar because they have the same number of valence electrons.');
  }
  if (/\b(?:what\s+did|what\s+was|what\s+is)\s+ruther\s*ford\b|\bruther\s*ford\b.*\bdo\b/.test(text)) {
    return factAnswer(findFact('unit7.rutherford'));
  }
  if (/\bhydrogen\b|\bhelium\b/.test(text)) {
    if (/\bgroup\s*1|alkali|noble|valence|exception\b/.test(text)) return factAnswer(findFact('unit7.hydrogen_helium_exceptions'));
  }
  if (/\b(?:metals?|nonmetals?|metalloids?|metaloids?)\b/.test(text) && /\b(?:difference|compare|classify|properties|what are|what is|where|is|are)\b/.test(text)) {
    if (/\bmetalloids?|metaloids?\b/.test(text)) return factAnswer(findFact('unit7.metalloids'));
    if (/\bnonmetals?\b/.test(text)) return factAnswer(findFact('unit7.nonmetals'));
    if (/\bmetals?\b/.test(text)) return factAnswer(findFact('unit7.metals'));
  }
  if (/\b(?:alkali|alkaline|transition|halogens?|noble gases?|rare earth|group names?|reactive)\b/.test(text)) {
    if (/\bhydrogen\b|\bhelium\b/.test(text)) return factAnswer(findFact('unit7.hydrogen_helium_exceptions'));
    if (/\bhalogens?\b|\bhalogens?\b.*\breactive|reactive\b.*\bnonmetals?\b/.test(text)) {
      return concept('unit7.halogen_reactivity', 'Group 17 halogens are the most reactive nonmetals. Nonmetal reactivity generally decreases down a group.');
    }
    if (/\balkali\b.*\breactive|reactive\b.*\bmetals?\b/.test(text)) {
      return concept('unit7.alkali_reactivity', 'Group 1 alkali metals are the most reactive metals, not including hydrogen. Metal reactivity generally increases down a group.');
    }
    if (/\bnoble gases?\b/.test(text)) {
      return concept('unit7.noble_gases', 'Group 18 noble gases are stable and mostly nonreactive. Helium is a noble gas with 2 valence electrons; most others have 8.');
    }
    return factAnswer(findFact('unit7.group_names'));
  }
  if (/\bperiods?\b|\brows?\b/.test(text) && /\b(?:periodic|table|energy levels?|horizontal|same)\b/.test(text)) {
    return factAnswer(findFact('unit7.periods'));
  }
  if (/\bgroups?\b|\bcolumns?\b|\bfamilies\b/.test(text) && /\b(?:periodic|table|valence|vertical|same|properties)\b/.test(text)) {
    return factAnswer(findFact('unit7.groups'));
  }

  for (const entry of UNIT7_FACTS) {
    if (matchesFact(text, entry)) return factAnswer(entry);
  }

  return null;
}

function answerAtomicHistoryScientist(text) {
  if (/\bdemocritus\b/.test(text)) return factAnswer(findFact('unit7.democritus'));
  if (/\bdalton\b/.test(text)) return factAnswer(findFact('unit7.dalton'));
  if (/\bmendeleev\b/.test(text)) return factAnswer(findFact('unit7.mendeleev'));
  if (/\bthomson\b|\bplum\s+pudding\b/.test(text)) return factAnswer(findFact('unit7.thomson'));
  if (/\bruther\s*ford\b|\brutherford\b|\bgold\s+foil\b/.test(text)) return factAnswer(findFact('unit7.rutherford'));
  if (/\bmoseley\b/.test(text)) return factAnswer(findFact('unit7.moseley'));
  if (/\bbohr\b/.test(text) && /\b(?:who|what did|scientist|model|history)\b/.test(text)) return factAnswer(findFact('unit7.bohr'));
  if (/\bschrodinger\b|\bheisenberg\b/.test(text)) return factAnswer(findFact('unit7.schrodinger_heisenberg'));
  if (/\bchadwick\b/.test(text)) return factAnswer(findFact('unit7.chadwick'));
  return null;
}

function answerCoreAtomicDefinition(text) {
  if (!hasDefinitionIntent(text)) return null;
  if (/\batomic\s+number\b/.test(text)) return factAnswer(findFact('unit7.atomic_number'));
  if (/\bmass\s+number\b/.test(text)) return factAnswer(findFact('unit7.mass_number'));
  if (/\baverage\s+atomic\s+mass\b|\bweighted\s+average\b/.test(text)) return factAnswer(findFact('unit7.average_atomic_mass'));
  if (/\bisotope\s+notation\b|\bhyphen\s+notation\b|\bnuclear\s+notation\b/.test(text)) return factAnswer(findFact('unit7.isotope_notation'));
  if (/\bisotopes?\b/.test(text)) return factAnswer(findFact('unit7.isotopes'));
  if (/\bhydrogen\b|\bhelium\b/.test(text)) return factAnswer(findFact('unit7.hydrogen_helium_exceptions'));
  if (/\bhalogens?\b/.test(text)) return concept('unit7.halogen_reactivity', 'Group 17 halogens are the most reactive nonmetals. Nonmetal reactivity generally decreases down a group.');
  if (/\bnoble gases?\b/.test(text)) return concept('unit7.noble_gases', 'Group 18 noble gases are stable and mostly nonreactive. Helium is a noble gas with 2 valence electrons; most others have 8.');
  if (/\bgroup\s+names?\b|\balkali\b|\balkaline\b|\btransition\b|\bhalogens?\b|\bnoble gases?\b|\brare earth\b/.test(text)) return factAnswer(findFact('unit7.group_names'));
  if (/\bgroups?\b|\bcolumns?\b|\bfamilies\b/.test(text)) return factAnswer(findFact('unit7.groups'));
  if (/\bperiods?\b|\brows?\b/.test(text)) return factAnswer(findFact('unit7.periods'));
  if (/\bperiodic\s+table\b/.test(text)) return factAnswer(findFact('unit7.periodic_table'));
  return null;
}

function answerUnit7Comparison(text) {
  if (!looksLikeComparisonQuestion(text)) return null;
  const pair = findComparisonPair(text);
  if (!pair) return null;
  const differenceText = pair.differences
    .map((difference) => `- ${difference}`)
    .join('\n');
  return {
    id: pair.id,
    answer: `Compare ${pair.left} and ${pair.right}: ${pair.same}\nDifferences:\n${differenceText}`,
    type: 'science_concept',
    sourceRefs: pair.sourceRefs || UNIT7_SOURCE_REFERENCES
  };
}

function answerUnit7Relationship(text) {
  if (!looksLikeRelationshipQuestion(text)) return null;
  const edge = findRelationshipEdge(text);
  if (!edge) return null;
  return {
    id: edge.id,
    answer: `${capitalize(edge.from)} ${edge.relation} ${edge.to}.`,
    type: 'science_concept',
    sourceRefs: edge.sourceRefs || UNIT7_SOURCE_REFERENCES
  };
}

function answerCuratedSourcePackFact(text) {
  const facts = [
    ...UNIT7_VISUAL_DIAGRAM_FACTS,
    ...UNIT7_ELEMENT_TILE_FIELDS,
    ...UNIT7_OPEN_RESPONSE_FACTS
  ];
  const match = facts.find((entry) => {
    const terms = [entry.statement, ...(entry.aliases || [])]
      .map(normalize)
      .filter(Boolean);
    return terms.some((term) => text.includes(term)) || matchesCuratedFactPattern(text, entry.id);
  });
  if (!match) return null;
  return {
    id: match.id,
    answer: match.statement,
    type: 'science_concept',
    sourceRefs: match.sourceRefs || UNIT7_SOURCE_REFERENCES
  };
}

function answerElementTileProtons(text) {
  if (!/\b(?:tile|element|atom|atomic number|protons?)\b/.test(text)) return null;
  if (!/\bprotons?\b/.test(text)) return null;
  if (/\b(?:how many|which|what|find|determine)\b/.test(text) === false) return null;
  const element = findPeriodicElement(text);
  if (!element) return null;
  const atomicNumber = Number(element.atomicNumber);
  if (!Number.isFinite(atomicNumber)) return null;
  return {
    id: 'unit7.tile.element_protons',
    answer: `${element.name} has atomic number ${atomicNumber}, so a neutral ${element.name} atom has ${atomicNumber} protons. On an element tile, atomic number tells protons.`,
    type: 'science_concept',
    sourceRefs: UNIT7_SOURCE_REFERENCES
  };
}

function matchesCuratedFactPattern(text, id) {
  if (id === 'unit7.visual.diagram.green_negative_particles') {
    return /\b(?:green|negative)\b.*\bparticles?\b.*\b(?:diagram|atom)\b|\bparticles?\b.*\b(?:green|negative)\b/.test(text);
  }
  if (id === 'unit7.visual.diagram.nucleus_center') {
    return /\b(?:center|middle)\b.*\b(?:atom|diagram)\b|\bnucleus\b.*\b(?:center|middle)\b/.test(text);
  }
  if (id === 'unit7.visual.diagram.shell_ring') {
    return /\b(?:shell|ring|energy level|circular level)\b.*\b(?:around|nucleus|diagram)\b/.test(text);
  }
  if (id === 'unit7.tile.atomic_number') {
    return /\b(?:which part|what part|where)\b.*\batomic number\b|\batomic number\b.*\btile\b/.test(text);
  }
  if (id === 'unit7.tile.symbol') {
    return /\b(?:which part|what part|where)\b.*\bsymbol\b|\bsymbol\b.*\btile\b|\blarge\b.*\bletters?\b/.test(text);
  }
  if (id === 'unit7.tile.element_name') {
    return /\b(?:which part|what part|where)\b.*\belement name\b|\bwritten name\b.*\btile\b/.test(text);
  }
  if (id === 'unit7.tile.atomic_mass') {
    return /\b(?:which part|what part|where)\b.*\batomic mass\b|\batomic mass\b.*\btile\b|\brounded mass\b/.test(text);
  }
  if (id === 'unit7.open_response.atom_forces') {
    return /\b(?:three|3)\b.*\bforces?\b.*\batom\b|\bforces?\b.*\bholding\b.*\batom\b/.test(text);
  }
  if (id === 'unit7.open_response.mass_volume_location') {
    return /\bmass\b.*\bnucleus\b.*\bvolume\b.*\belectron cloud\b|\bwhere\b.*\bmass\b.*\bvolume\b.*\batom\b/.test(text);
  }
  if (id === 'unit7.open_response.nucleus_cloud_charge') {
    return /\bnucleus\b.*\bpositive\b.*\belectron cloud\b.*\bnegative\b|\bcharge\b.*\bnucleus\b.*\belectron cloud\b/.test(text);
  }
  if (id === 'unit7.open_response.nucleus_particles') {
    return /\bprotons?\b.*\bneutrons?\b.*\bnucleus\b|\bparticles?\b.*\bnucleus\b/.test(text);
  }
  if (id === 'unit7.open_response.electrons_not_mass_number') {
    return /\belectrons?\b.*\bnot\b.*\bmass number\b|\bwhy\b.*\belectrons?\b.*\bmass number\b/.test(text);
  }
  if (id === 'unit7.open_response.quarks') {
    return /\bquarks?\b.*\b(?:make|made)\b.*\b(?:protons?|neutrons?)\b|\bwhat\b.*\bquarks?\b.*\bmake\b/.test(text);
  }
  if (id === 'unit7.open_response.valence_energy') {
    return /\bvalence electrons?\b.*\b(?:outermost|most energy|energy level)\b|\boutermost energy level\b.*\bmost energy\b/.test(text);
  }
  return false;
}

function looksLikeAtomicCalculation(text) {
  return /\b(?:calculate|find|solve|determine|how many|write|set up|setup|make|build|draw)\b/.test(text) &&
    /\b(?:protons?|neutrons?|nuetrons?|newtrons?|electrons?|mass number|atomic number|isotope|bohr model|neutral atom)\b/.test(text) &&
    /\d/.test(text);
}

function looksLikeComparisonQuestion(text) {
  if (/\b(?:compare|comparison|difference|diffrence|different|alike|vs|versus|same and different|similarities?|similarities and differences)\b/.test(text)) {
    return true;
  }
  if (/\bwhy\b/.test(text) && /\b(?:hydrogen|helium)\b/.test(text) && /\b(?:alkali|noble gases?)\b/.test(text)) {
    return true;
  }
  return false;
}

function findComparisonPair(text) {
  const normalizedText = normalize(text);
  if (/\bisotopes?\b/.test(normalizedText) && /\bsame\b/.test(normalizedText) && /\bdifferent\b/.test(normalizedText)) {
    return comparisonById('unit7.compare.isotope.normal_atom');
  }

  let best = null;
  let bestScore = 0;
  for (const pair of UNIT7_COMPARISON_PAIRS) {
    const concepts = (pair.concepts || []).map(normalize).filter(Boolean);
    const aliases = (pair.aliases || []).map(normalize).filter(Boolean);
    const conceptMatches = concepts.filter((concept) => hasLooseTerm(normalizedText, concept)).length;
    const aliasMatches = aliases.filter((alias) => normalizedText.includes(alias)).length;
    const score = conceptMatches + (aliasMatches * 2);
    if (score > bestScore && (conceptMatches >= 2 || aliasMatches > 0)) {
      best = pair;
      bestScore = score;
    }
  }
  return best;
}

function comparisonById(id) {
  return UNIT7_COMPARISON_PAIRS.find((pair) => pair.id === id) || null;
}

function looksLikeRelationshipQuestion(text) {
  return /\b(?:which one tells|which number tells|what tells|what equals|what does .* tell|what identifies)\b/.test(text);
}

function findRelationshipEdge(text) {
  const normalizedText = normalize(text);
  let best = null;
  let bestScore = 0;
  for (const edge of UNIT7_RELATIONSHIP_EDGES) {
    const from = normalize(edge.from);
    const relation = normalize(edge.relation);
    const to = normalize(edge.to);
    const score = [from, relation, to]
      .filter((term) => term && hasLooseTerm(normalizedText, term))
      .length;
    if (score > bestScore && score >= 1 && (hasLooseTerm(normalizedText, to) || hasLooseTerm(normalizedText, from))) {
      best = edge;
      bestScore = score;
    }
  }
  return best;
}

function looksLikeUnit7ConceptTutorPrompt(text) {
  if (hasDefinitionIntent(text)) return false;
  const asksForClassification = /\b(?:classify|classification|which|what type|what kind|clue|evidence|best matches|identify)\b/.test(text);
  const hasConceptContext = /\b(?:metal|nonmetal|metalloid|metaloid|semiconductor|stair step|shiny|malleable|ductile|poor conductor|good conductor|brittle|bohr|electron cloud|fixed orbits?|regions? of space|isotopes?|same protons?|different neutrons?|same group|same period|atomic number|proton count|energy levels?|valence electrons?)\b/.test(text);
  return asksForClassification && hasConceptContext;
}

function asksSameGroupSimilar(text) {
  return /\bwhy\b/.test(text) &&
    /\bsame\s+group\b/.test(text) &&
    /\b(?:similar|act|properties|react)\b/.test(text);
}

function asksDifference(text, aTerms, bTerms) {
  if (!/\b(?:difference|diffrence|different|compare|vs|versus)\b/.test(text)) return false;
  return aTerms.some((term) => text.includes(term)) && bTerms.some((term) => text.includes(term));
}

function matchesFact(text, entry) {
  const terms = [entry.canonicalTerm, ...(entry.aliases || [])]
    .map((term) => normalize(term))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return terms.some((term) => new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}(?=$|[^a-z0-9])`).test(text)) &&
    (hasDefinitionIntent(text) || hasLocationIntent(text) || hasChargeIntent(text) || hasHistoryIntent(text) || hasGeneralUnit7Context(text));
}

function hasDefinitionIntent(text) {
  return /\b(?:what\s+is|whats|define|definition|describe|explain|meaning|means?|what are|tell me about)\b/.test(text);
}

function hasLocationIntent(text) {
  return /\b(?:where|location|found|located|inside|outside|in the nucleus|electron cloud)\b/.test(text);
}

function hasChargeIntent(text) {
  return /\b(?:charge|positive|negative|neutral|p\+|e-|n0)\b/.test(text);
}

function hasHistoryIntent(text) {
  return /\b(?:who|scientist|model|history|discovered|experiment|did|do)\b/.test(text);
}

function hasGeneralUnit7Context(text) {
  return /\b(?:atom|atomic|periodic table|isotope|bohr|nucleus|electron cloud|energy level|valence|element)\b/.test(text);
}

function factAnswer(entry) {
  return {
    id: entry.id,
    answer: entry.definition,
    type: 'definition',
    sourceRefs: entry.sourceRefs
  };
}

function concept(id, answer) {
  return { id, answer, type: 'science_concept', sourceRefs: UNIT7_ATOMIC_STRUCTURE_METADATA.sourceReferences };
}

function fact(config) {
  return {
    aliases: [],
    sourceRefs: [],
    ...config
  };
}

function findFact(id) {
  return UNIT7_FACTS.find((entry) => entry.id === id);
}

function findPeriodicElement(text) {
  const normalizedText = normalize(text);
  const nameMatches = periodicElements
    .map((element) => [normalize(element.name), element])
    .sort((a, b) => b[0].length - a[0].length);
  for (const [name, element] of nameMatches) {
    if (new RegExp(`(^|[^a-z0-9])${escapeRegex(name)}(?=$|[^a-z0-9])`).test(normalizedText)) return element;
  }
  const symbolMatches = periodicElements
    .map((element) => [String(element.symbol || ''), element])
    .filter(([symbol]) => symbol)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [symbol, element] of symbolMatches) {
    if (new RegExp(`\\b${escapeRegex(symbol)}\\b`).test(String(text || ''))) return element;
  }
  return null;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[-‐‑‒–—]/g, ' ')
    .replace(/[^a-z0-9+\s./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasLooseTerm(text, term) {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  if (normalizedTerm === 'nuclear notation') {
    return /\bnuclear\s+(?:notation|form)\b/.test(text);
  }
  if (normalizedTerm === 'hyphen notation') {
    return /\bhyphen\s+(?:notation|form)\b/.test(text);
  }
  if (normalizedTerm === 'electron cloud model') {
    return /\belectron\s+cloud(?:\s+model)?\b/.test(text);
  }
  if (normalizedTerm === 'bohr model') {
    return /\bbohr(?:\s+model)?\b/.test(text);
  }
  if (normalizedTerm === 'alkali metals') {
    return /\balkali(?:\s+metals?)?\b/.test(text);
  }
  if (normalizedTerm === 'alkaline earth metals') {
    return /\balkaline\s+earth(?:\s+metals?)?\b/.test(text);
  }
  if (normalizedTerm === 'noble gases') {
    return /\bnoble\s+gases?\b/.test(text);
  }
  const variants = new Set([normalizedTerm]);
  if (normalizedTerm.endsWith('s')) variants.add(normalizedTerm.slice(0, -1));
  else variants.add(`${normalizedTerm}s`);
  return [...variants].some((variant) => new RegExp(`(^|[^a-z0-9])${escapeRegex(variant)}(?=$|[^a-z0-9])`).test(text));
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  UNIT7_ATOMIC_STRUCTURE_METADATA,
  UNIT7_FACTS,
  UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK,
  UNIT7_COMPARISON_PAIRS,
  UNIT7_RELATIONSHIP_EDGES,
  tryUnit7AtomicStructureKnowledge
};
