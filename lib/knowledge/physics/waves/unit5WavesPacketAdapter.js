function buildUnit5WavesPacket({ facts, matcherName }) {
  const canonicalFacts = arrayOrEmpty(facts);
  const vocabulary = buildVocabulary(canonicalFacts);
  const concepts = buildConceptGroups(canonicalFacts);
  const relationships = buildRelationships();
  const referenceFormulas = buildReferenceFormulas();
  const conceptTutorHooks = buildConceptTutorHooks();
  const formulaTutorHooks = buildFormulaTutorHooks();
  const smokeTests = buildSmokeTests(canonicalFacts);

  return {
    packetId: 'unit5-waves',
    title: 'Waves',
    version: '1.0.0',
    subject: 'science',
    gradeLevel: '8th / physical science',
    unit: 5,
    unitTitle: 'Waves',
    topic: 'Waves',
    sourceMetadata: {
      sourceBacked: false,
      sourceRefs: [],
      note: 'Generated from existing checked-in Unit 5 Waves matcher behavior only.'
    },
    vocabulary,
    concepts,
    canonicalFacts,
    comparisons: [],
    relationships,
    referenceFormulas,
    examples: buildExamples(canonicalFacts),
    smokeTests,
    conceptTutorHooks,
    formulaTutorHooks,
    routeHints: [
      {
        id: 'unit5.boundary.wave-terms',
        owns: ['reflection', 'period', 'wavelength', 'frequency', 'light as a wave'],
        avoidRoutingAs: ['Unit 7 atomic structure', 'Unit 3 general energy transformations']
      },
      {
        id: 'unit5.boundary.formulas',
        owns: ['wave speed', 'frequency', 'wavelength', 'period'],
        route: 'scienceFormulaTools wave formula routes for numeric prompts'
      }
    ],
    routePreference: {
      directAnswer: 'tryUnit5WavesKnowledge for supported wave definitions, behaviors, classifications, and classroom examples',
      formulaTutor: 'lib/formulas/waves.js for numeric wave speed, frequency, wavelength, and period prompts',
      conceptTutor: 'conceptTutorPatterns Unit 5 wave concept identification hooks for supported guided prompts'
    },
    legacyExports: {
      packet: 'UNIT5_WAVES_PACKET',
      facts: 'UNIT5_WAVE_FACTS',
      matcher: matcherName || 'tryUnit5WavesKnowledge'
    },
    counts: {
      vocabulary: vocabulary.length,
      concepts: concepts.length,
      canonicalFacts: canonicalFacts.length,
      comparisons: 0,
      relationships: relationships.length,
      referenceFormulas: referenceFormulas.length,
      examples: countExamples(canonicalFacts),
      smokeTests: smokeTests.length,
      conceptTutorHooks: conceptTutorHooks.length,
      formulaTutorHooks: formulaTutorHooks.length,
      sourceRefs: 0
    },
    metadata: {
      generatedFromExistingUnit5WavesContentOnly: true,
      sourceBacked: false,
      sourceReferences: [],
      missing: {
        sourceReferences: 'not exposed by existing Unit 5 Waves module data',
        comparisons: 'not exposed as structured comparison data by existing Unit 5 Waves module data'
      }
    }
  };
}

function buildVocabulary(facts) {
  const requiredTerms = [
    ['wavelength', ['lambda', 'crest-to-crest distance']],
    ['frequency', ['hertz', 'Hz', 'waves per second']],
    ['amplitude', ['wave height', 'loudness']],
    ['period', ['cycle time', 'T']],
    ['wave speed', ['velocity', 'v = f lambda']],
    ['reflection', ['bounce', 'bounces off']],
    ['refraction', ['bending', 'changes speed']],
    ['mechanical wave', ['needs a medium', 'sound wave']],
    ['electromagnetic wave', ['EM wave', 'light wave']],
    ['transverse wave', ['crest', 'trough']],
    ['longitudinal wave', ['compressional wave', 'compression', 'rarefaction']]
  ].map(([term, aliases]) => ({ term, aliases, sourceRefs: [] }));

  const factTerms = facts
    .filter((fact) => fact && fact.term)
    .map((fact) => ({
      term: fact.term,
      aliases: arrayOrEmpty(fact.aliases),
      sourceRefs: arrayOrEmpty(fact.sourceRefs)
    }));

  return uniqueByTerm([...requiredTerms, ...factTerms]);
}

function buildConceptGroups(facts) {
  const groups = [
    ['unit5.waves.nature', 'wave nature and classification'],
    ['unit5.waves.properties', 'wave parts and measurements'],
    ['unit5.waves.behaviors', 'wave behaviors'],
    ['unit5.waves.electromagnetic_spectrum', 'electromagnetic spectrum'],
    ['unit5.waves.sound_light_color', 'sound, light, color, and lenses']
  ];

  return groups.map(([id, label]) => ({
    id,
    label,
    factIds: facts
      .filter((fact) => fact.category === lastSegment(id) || fact.conceptGroup === id)
      .map((fact) => fact.id)
  }));
}

function lastSegment(value) {
  const parts = String(value || '').split('.');
  return parts[parts.length - 1] || '';
}

function buildRelationships() {
  return [
    relationship('unit5.relationship.frequency-period', 'frequency', 'period', 'inverse relationship'),
    relationship('unit5.relationship.wavelength-frequency', 'wavelength', 'frequency', 'inverse when wave speed stays constant'),
    relationship('unit5.relationship.amplitude-energy', 'amplitude', 'wave energy', 'greater amplitude means more wave energy'),
    relationship('unit5.relationship.sound-medium', 'sound wave', 'mechanical wave', 'sound needs a medium'),
    relationship('unit5.relationship.light-em', 'light', 'electromagnetic wave', 'light can travel through empty space'),
    relationship('unit5.relationship.reflection-incidence', 'angle of incidence', 'angle of reflection', 'equal by the law of reflection'),
    relationship('unit5.relationship.refraction-speed', 'refraction', 'wave speed', 'bending happens when speed changes in a new material'),
    relationship('unit5.relationship.radio-diffraction', 'radio waves', 'diffraction', 'longer wavelengths diffract better'),
    relationship('unit5.relationship.absorption-thermal', 'absorption', 'thermal energy', 'absorbed wave energy can become heat')
  ];
}

function relationship(id, fromTerm, toTerm, label) {
  return { id, from: fromTerm, to: toTerm, fromTerm, toTerm, label, sourceRefs: [] };
}

function buildReferenceFormulas() {
  return [
    {
      id: 'unit5.wave_speed_frequency_wavelength',
      formula: 'v = f * wavelength',
      variables: ['wave speed', 'frequency', 'wavelength'],
      sourceRefs: []
    },
    {
      id: 'unit5.period_frequency',
      formula: 'T = 1 / f',
      variables: ['period', 'frequency'],
      sourceRefs: []
    },
    {
      id: 'unit5.law_of_reflection',
      formula: 'angle of incidence = angle of reflection',
      variables: ['angle of incidence', 'angle of reflection'],
      sourceRefs: []
    }
  ];
}

function buildConceptTutorHooks() {
  return [
    {
      id: 'waves.mechanical-electromagnetic.identification',
      terms: ['mechanical wave', 'electromagnetic wave']
    },
    {
      id: 'waves.transverse-longitudinal.identification',
      terms: ['transverse wave', 'longitudinal wave']
    },
    {
      id: 'waves.properties.amplitude-wavelength-frequency',
      terms: ['amplitude', 'wavelength', 'frequency']
    },
    {
      id: 'waves.reflection-refraction-absorption.identification',
      terms: ['reflection', 'refraction', 'absorption']
    }
  ];
}

function buildFormulaTutorHooks() {
  return [
    {
      module: 'lib/formulas/waves.js',
      exports: ['tryWaveSpeed', 'tryWaveFrequency', 'tryWaveWavelength', 'tryWavePeriod'],
      routePreference: 'wave speed, frequency, wavelength, and period calculations'
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
      expectedTool: 'unit5_waves_knowledge',
      expectedCoreAnswer: fact.answer,
      sourceRefs: arrayOrEmpty(fact.sourceRefs)
    }));
}

function countExamples(facts) {
  return facts.reduce((total, fact) => total + arrayOrEmpty(fact.examples).length, 0);
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
  buildUnit5WavesPacket
};
