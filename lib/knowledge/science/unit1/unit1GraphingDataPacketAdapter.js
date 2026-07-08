function buildUnit1GraphingDataPacket({ facts, matcherName }) {
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
  const topics = concepts.map((concept) => ({
    id: concept.id.replace('.concept.', '.topic.'),
    title: concept.title,
    terms: concept.terms,
    sourceRefs: concept.sourceRefs
  }));
  const conceptTutorHooks = canonicalFacts
    .filter((fact) => fact.conceptTutorCandidate)
    .map((fact) => ({
      factId: fact.id,
      term: fact.canonicalTerm,
      type: fact.type,
      routePreference: 'concept_tutor_when_scenario_identification_is_requested'
    }));

  return {
    packetId: 'unit1-graphing-data',
    title: 'Graphing and Data Analysis',
    version: '1.0.0',
    subject: 'science',
    gradeLevel: '8th / physical science',
    unit: 1,
    unitTitle: 'Science Practices',
    sourcePack: 'graphing-data-analysis',
    sourceFiles: sourceReferences,
    topics,
    concepts,
    vocabulary,
    canonicalFacts,
    comparisons: [],
    relationships: collectRelationships(canonicalFacts),
    referenceFormulas: [],
    examples: collectExamples(canonicalFacts),
    conceptTutorHooks,
    routePreference: {
      directAnswer: 'definitions, examples, typo recovery, graph setup, graph type, data relationship, and CER facts',
      formulaTutor: 'none for this packet',
      conceptTutor: 'none from canonical facts in this packet'
    },
    legacyExports: {
      facts: 'ALL_UNIT1_GRAPHING_DATA_FACTS',
      matcher: matcherName || 'tryUnit1GraphingDataKnowledge'
    },
    counts: {
      sourceFiles: sourceReferences.length,
      topics: topics.length,
      concepts: concepts.length,
      vocabulary: vocabulary.length,
      canonicalFacts: canonicalFacts.length,
      comparisons: 0,
      relationships: collectRelationships(canonicalFacts).length,
      referenceFormulas: 0,
      examples: collectExamples(canonicalFacts).length,
      conceptTutorHooks: conceptTutorHooks.length
    },
    metadata: {
      sourceBacked: sourceReferences.length > 0,
      sourceReferences,
      chunk: 'graphing-data-analysis',
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
    const type = fact.type || 'graphing_data_concept';
    if (!groups[type]) {
      groups[type] = {
        id: `unit1.graphing_data.concept.${type}`,
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
  buildUnit1GraphingDataPacket
};
