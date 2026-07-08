const {
  arrayOrEmpty,
  collectExamples,
  collectRelationships,
  groupFactsByType,
  unique
} = require('./unit1PacketAdapterHelpers');

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
  const concepts = groupFactsByType(canonicalFacts, {
    defaultType: 'measurement_concept',
    idPrefix: 'unit1.measurement.concept'
  });
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

module.exports = {
  buildUnit1MeasurementPacket
};
