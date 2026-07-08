function buildUnit1MeasurementPacket({ facts, matcherName }) {
  const canonicalFacts = arrayOrEmpty(facts);
  const sourceReferences = unique(canonicalFacts.flatMap((fact) => arrayOrEmpty(fact.sourceRefs)));
  const vocabulary = canonicalFacts.map((fact) => ({
    term: fact.canonicalTerm,
    aliases: [
      ...arrayOrEmpty(fact.aliases),
      ...arrayOrEmpty(fact.typoAliases),
      ...arrayOrEmpty(fact.studentWording)
    ],
    sourceRefs: arrayOrEmpty(fact.sourceRefs)
  }));
  const concepts = groupFactsByType(canonicalFacts);
  const quantityLookups = canonicalFacts
    .filter((fact) => fact.type === 'quantity')
    .map((fact) => ({
      factId: fact.id,
      quantity: fact.canonicalTerm,
      unitAnswer: fact.unitAnswer || '',
      toolAnswer: fact.toolAnswer || '',
      sourceRefs: arrayOrEmpty(fact.sourceRefs)
    }));

  return {
    packetId: 'unit1-measurement',
    title: 'Measurement and Data Quality',
    version: '1.0.0',
    subject: 'science',
    gradeLevel: '8th / physical science',
    unit: 1,
    unitTitle: 'Science Practices',
    sourcePack: 'unit1-measurement-data-quality',
    sourceFiles: sourceReferences,
    concepts,
    vocabulary,
    canonicalFacts,
    comparisons: [],
    relationships: collectRelationships(canonicalFacts),
    referenceFormulas: [],
    examples: collectExamples(canonicalFacts),
    quantityLookups,
    conceptTutorHooks: [],
    routePreference: {
      directAnswer: 'definitions, examples, typo recovery, tool lookups, unit lookups, and data-quality explanations',
      formulaTutor: 'none for this packet',
      conceptTutor: 'none for this packet'
    },
    legacyExports: {
      facts: 'ALL_UNIT1_MEASUREMENT_FACTS',
      matcher: matcherName || 'tryUnit1MeasurementKnowledge'
    },
    counts: {
      sourceFiles: sourceReferences.length,
      concepts: concepts.length,
      vocabulary: vocabulary.length,
      canonicalFacts: canonicalFacts.length,
      comparisons: 0,
      relationships: collectRelationships(canonicalFacts).length,
      referenceFormulas: 0,
      examples: collectExamples(canonicalFacts).length,
      quantityLookups: quantityLookups.length,
      conceptTutorHooks: 0
    },
    metadata: {
      sourceBacked: sourceReferences.length > 0,
      sourceReferences,
      chunk: 'measurement-data-quality',
      generatedFromExistingFactsOnly: true
    }
  };
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function groupFactsByType(facts) {
  return Object.values(facts.reduce((groups, fact) => {
    const type = fact.type || 'measurement_concept';
    if (!groups[type]) {
      groups[type] = {
        id: `unit1.measurement.concept.${type}`,
        title: titleFromType(type),
        terms: [],
        sourceRefs: []
      };
    }
    groups[type].terms.push(fact.canonicalTerm);
    groups[type].sourceRefs = unique([
      ...groups[type].sourceRefs,
      ...arrayOrEmpty(fact.sourceRefs)
    ]);
    return groups;
  }, {}));
}

function titleFromType(type) {
  return String(type || '')
    .split('_')
    .map((word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(' ');
}

function collectRelationships(facts) {
  return facts.flatMap((fact) => arrayOrEmpty(fact.related).map((target) => ({
    id: `${fact.id}.related.${slug(target)}`,
    from: fact.canonicalTerm,
    relation: 'related to',
    to: target,
    sourceRefs: arrayOrEmpty(fact.sourceRefs)
  })));
}

function collectExamples(facts) {
  return facts.flatMap((fact) => [
    ...arrayOrEmpty(fact.examples).map((example) => ({ factId: fact.id, type: 'example', text: example })),
    ...arrayOrEmpty(fact.nonExamples).map((example) => ({ factId: fact.id, type: 'non_example', text: example }))
  ]);
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

module.exports = {
  buildUnit1MeasurementPacket
};
