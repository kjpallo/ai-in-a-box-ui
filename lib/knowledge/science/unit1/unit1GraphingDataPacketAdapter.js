const {
  arrayOrEmpty,
  collectExamples,
  collectRelationships,
  groupFactsByType,
  unique
} = require('./unit1PacketAdapterHelpers');

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
  const concepts = groupFactsByType(canonicalFacts, {
    defaultType: 'graphing_data_concept',
    idPrefix: 'unit1.graphing_data.concept'
  });
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

module.exports = {
  buildUnit1GraphingDataPacket
};
