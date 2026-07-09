function buildUnit6MatterPacket({ facts, matcherName }) {
  const canonicalFacts = arrayOrEmpty(facts);
  const vocabulary = buildVocabulary(canonicalFacts);
  const concepts = buildConceptGroups(canonicalFacts);
  const comparisons = buildComparisons();
  const relationships = buildRelationships();
  const referenceFormulas = buildReferenceFormulas();
  const examples = buildExamples(canonicalFacts);
  const smokeTests = buildSmokeTests(canonicalFacts);
  const conceptTutorHooks = buildConceptTutorHooks();
  const formulaTutorHooks = buildFormulaTutorHooks();

  return {
    packetId: 'unit6-matter',
    title: 'Matter',
    version: '1.0.0',
    subject: 'science',
    gradeLevel: '8th / physical science',
    unit: 6,
    unitTitle: 'Matter',
    topic: 'Matter',
    sourceMetadata: {
      sourceBacked: false,
      sourceRefs: [],
      note: 'Generated from existing checked-in Unit 6 Matter matcher behavior only.'
    },
    vocabulary,
    concepts,
    canonicalFacts,
    comparisons,
    relationships,
    referenceFormulas,
    examples,
    smokeTests,
    conceptTutorHooks,
    formulaTutorHooks,
    routeHints: [
      {
        id: 'unit6.boundary.matter-ownership',
        owns: [
          'density',
          'physical property',
          'chemical property',
          'physical change',
          'chemical change',
          'states of matter',
          'mixtures',
          'pure substances',
          'elements',
          'compounds',
          'classification of matter'
        ],
        avoidRoutingAs: ['Unit 1 measurement tools/units', 'Unit 1 safety actions', 'Unit 7 atomic structure calculations']
      },
      {
        id: 'unit6.boundary.density-formulas',
        owns: ['density concepts', 'float or sink density comparisons'],
        route: 'scienceFormulaTools density routes for numeric mass-volume-density prompts'
      }
    ],
    routePreference: {
      directAnswer: matcherName || 'tryUnit6MatterKnowledge',
      formulaTutor: 'lib/formulas/density.js for numeric density, mass, and volume prompts',
      conceptTutor: 'conceptTutorPatterns Unit 6 hooks for supported matter classification and change prompts'
    },
    directKnowledgeMatcher: matcherName || 'tryUnit6MatterKnowledge',
    legacyExports: {
      packet: 'UNIT6_MATTER_PACKET',
      facts: 'UNIT6_MATTER_FACTS',
      matcher: matcherName || 'tryUnit6MatterKnowledge'
    },
    counts: {
      vocabulary: vocabulary.length,
      concepts: concepts.length,
      canonicalFacts: canonicalFacts.length,
      comparisons: comparisons.length,
      relationships: relationships.length,
      referenceFormulas: referenceFormulas.length,
      examples: examples.length,
      smokeTests: smokeTests.length,
      conceptTutorHooks: conceptTutorHooks.length,
      formulaTutorHooks: formulaTutorHooks.length,
      sourceRefs: 0
    },
    metadata: {
      generatedFromExistingUnit6MatterContentOnly: true,
      sourceBacked: false,
      sourceReferences: [],
      missing: {
        sourceReferences: 'not exposed by existing Unit 6 Matter module data'
      }
    }
  };
}

function buildVocabulary(facts) {
  const requiredTerms = [
    ['matter', ['mass and volume']],
    ['mass', ['amount of matter']],
    ['volume', ['takes up space']],
    ['density', ['D = m / V', 'mass per unit volume']],
    ['physical property', ['observed without changing identity']],
    ['chemical property', ['observed during a chemical change']],
    ['physical change', ['same chemical identity']],
    ['chemical change', ['new substance']],
    ['solid', ['definite shape', 'definite volume']],
    ['liquid', ['definite volume', 'takes the shape of its container']],
    ['gas', ['no definite shape', 'no definite volume']],
    ['plasma', ['charged particles']],
    ['element', ['one type of atom']],
    ['compound', ['elements chemically combined']],
    ['mixture', ['physically combined']],
    ['pure substance', ['fixed composition', 'substance']],
    ['atom', ['one type of atom', 'particle']],
    ['molecule', ['particle']],
    ['homogeneous mixture', ['solution', 'same throughout']],
    ['heterogeneous mixture', ['different visible parts']],
    ['solution', ['homogeneous mixture']],
    ['solute', ['substance being dissolved']],
    ['solvent', ['substance doing the dissolving']]
  ].map(([term, aliases]) => ({ term, aliases, sourceRefs: [] }));

  const factTerms = facts
    .filter((fact) => fact && fact.term)
    .map((fact) => ({
      term: fact.term,
      aliases: arrayOrEmpty(fact.aliases),
      sourceRefs: arrayOrEmpty(fact.sourceRefs),
      definition: fact.type === 'definition' ? fact.answer : ''
    }));

  return uniqueByTerm([...requiredTerms, ...factTerms]);
}

function buildConceptGroups(facts) {
  const groups = [
    ['unit6.matter.classification', 'classification of matter'],
    ['unit6.matter.properties_changes', 'properties and changes'],
    ['unit6.matter.density', 'density'],
    ['unit6.matter.states_kmt', 'states of matter and kinetic molecular theory'],
    ['unit6.matter.state_changes', 'state changes and heating curves'],
    ['unit6.matter.solutions', 'solutions and solubility']
  ];

  return groups.map(([id, label]) => ({
    id,
    label,
    factIds: facts
      .filter((fact) => fact.category === lastSegment(id) || fact.conceptGroup === id)
      .map((fact) => fact.id)
  }));
}

function buildComparisons() {
  return [
    comparison('unit6.comparison.physical-chemical-property', ['physical property', 'chemical property'], 'physical vs chemical property'),
    comparison('unit6.comparison.physical-chemical-change', ['physical change', 'chemical change'], 'physical vs chemical change'),
    comparison('unit6.comparison.element-compound', ['element', 'compound'], 'element vs compound'),
    comparison('unit6.comparison.substance-mixture', ['pure substance', 'mixture'], 'pure substance vs mixture'),
    comparison('unit6.comparison.homogeneous-heterogeneous', ['homogeneous mixture', 'heterogeneous mixture'], 'homogeneous vs heterogeneous mixture')
  ];
}

function buildRelationships() {
  return [
    relationship('unit6.relationship.matter-mass', 'matter', 'mass', 'has mass'),
    relationship('unit6.relationship.matter-volume', 'matter', 'volume', 'takes up space'),
    relationship('unit6.relationship.density-mass-volume', 'density', 'mass and volume', 'density equals mass per unit volume'),
    relationship('unit6.relationship.substance-fixed-composition', 'pure substance', 'fixed composition', 'has fixed composition'),
    relationship('unit6.relationship.mixture-variable-composition', 'mixture', 'variable composition', 'has variable composition'),
    relationship('unit6.relationship.element-atom', 'element', 'atom', 'made of one type of atom'),
    relationship('unit6.relationship.compound-elements', 'compound', 'elements', 'chemically combined in fixed proportion'),
    relationship('unit6.relationship.solution-homogeneous', 'solution', 'homogeneous mixture', 'is a type of'),
    relationship('unit6.relationship.colloid-heterogeneous', 'colloid', 'heterogeneous mixture', 'is treated as'),
    relationship('unit6.relationship.suspension-heterogeneous', 'suspension', 'heterogeneous mixture', 'is a type of'),
    relationship('unit6.relationship.state-change-physical', 'state change', 'physical change', 'is a type of'),
    relationship('unit6.relationship.temperature-kinetic-energy', 'temperature', 'average kinetic energy', 'measures'),
    relationship('unit6.relationship.solute-solvent-solution', 'solute', 'solvent', 'combine to form a solution'),
    relationship('unit6.relationship.saturated-solubility', 'saturated solution', 'solubility', 'contains the maximum dissolved solute')
  ];
}

function buildReferenceFormulas() {
  return [
    {
      id: 'unit6.density_mass_volume',
      formula: 'D = m / V',
      variables: ['density', 'mass', 'volume'],
      solveFor: ['density', 'mass', 'volume'],
      sourceRefs: []
    },
    {
      id: 'unit6.mass_density_volume',
      formula: 'm = D * V',
      variables: ['mass', 'density', 'volume'],
      solveFor: ['mass'],
      sourceRefs: []
    },
    {
      id: 'unit6.volume_mass_density',
      formula: 'V = m / D',
      variables: ['volume', 'mass', 'density'],
      solveFor: ['volume'],
      sourceRefs: []
    }
  ];
}

function buildConceptTutorHooks() {
  return [
    {
      id: 'matter.classification.element-compound-mixture',
      terms: ['element', 'compound', 'mixture', 'pure substance']
    },
    {
      id: 'matter.mixtures.homogeneous-heterogeneous',
      terms: ['homogeneous mixture', 'heterogeneous mixture', 'solution', 'colloid', 'suspension']
    },
    {
      id: 'matter.changes.physical-chemical',
      terms: ['physical change', 'chemical change', 'physical property', 'chemical property']
    },
    {
      id: 'matter.states.state-changes',
      terms: ['solid', 'liquid', 'gas', 'plasma', 'melting', 'freezing', 'vaporization', 'condensation']
    }
  ];
}

function buildFormulaTutorHooks() {
  return [
    {
      module: 'lib/formulas/density.js',
      exports: ['tryDensity'],
      routePreference: 'density, mass, and volume calculations'
    }
  ];
}

function buildExamples(facts) {
  return facts.flatMap((fact) =>
    arrayOrEmpty(fact.examples).map((example, index) => ({
      id: `${fact.id}.example.${index + 1}`,
      factId: fact.id,
      text: example,
      sourceRefs: arrayOrEmpty(fact.sourceRefs)
    }))
  );
}

function buildSmokeTests(facts) {
  return facts
    .filter((fact) => fact.smokePrompt)
    .map((fact) => ({
      id: `${fact.id}.smoke`,
      query: fact.smokePrompt,
      expectedRoute: 'direct_answer',
      expectedTool: 'unit6_matter_knowledge',
      expectedCoreAnswer: fact.answer,
      sourceRefs: arrayOrEmpty(fact.sourceRefs)
    }));
}

function comparison(id, concepts, label) {
  return { id, concepts, label, sourceRefs: [] };
}

function relationship(id, fromTerm, toTerm, label) {
  return { id, from: fromTerm, to: toTerm, fromTerm, toTerm, label, sourceRefs: [] };
}

function lastSegment(value) {
  const parts = String(value || '').split('.');
  return parts[parts.length - 1] || '';
}

function uniqueByTerm(entries) {
  const seen = new Set();
  const unique = [];
  for (const entry of entries) {
    const key = normalizeTerm(entry.term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

function normalizeTerm(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  buildUnit6MatterPacket
};
