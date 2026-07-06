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
  sourceReferences: [
    'Concept 1 Notes - Structure of the Atom.pptx',
    'Concept 2 Notes - Isotopes.pptx',
    'Concept 3 Notes -Periodic Table.pptx',
    'Packet KEY - Atomic Structure Honors.pdf',
    'Test Key Honors (2).pdf',
    'Review Game Atomic Structure.pptx'
  ]
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
    definition: 'Schrodinger and Heisenberg are connected with the electron cloud model, where electrons are found in regions of space instead of fixed orbits.',
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
  if (looksLikeUnit7ConceptTutorPrompt(text)) return null;

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
    if (/\bhalogens?\b.*\breactive|reactive\b.*\bnonmetals?\b/.test(text)) {
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

function looksLikeAtomicCalculation(text) {
  return /\b(?:calculate|find|solve|determine|how many|write|set up|setup|make|build|draw)\b/.test(text) &&
    /\b(?:protons?|neutrons?|nuetrons?|newtrons?|electrons?|mass number|atomic number|isotope|bohr model|neutral atom)\b/.test(text) &&
    /\d/.test(text);
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

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[-‐‑‒–—]/g, ' ')
    .replace(/[^a-z0-9+\s./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  UNIT7_ATOMIC_STRUCTURE_METADATA,
  UNIT7_FACTS,
  tryUnit7AtomicStructureKnowledge
};
