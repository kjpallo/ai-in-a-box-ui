const {
  arrayOrEmpty,
  collectExamples,
  collectRelationships,
  groupFactsByType,
  unique
} = require('./unit1PacketAdapterHelpers');

function buildUnit1ScientificMethodPacket({ facts, matcherName }) {
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
    defaultType: 'science_method',
    idPrefix: 'unit1.scientific_method.concept'
  });
  const conceptTutorHooks = canonicalFacts
    .filter((fact) => fact.conceptTutorCandidate)
    .map((fact) => ({
      factId: fact.id,
      term: fact.canonicalTerm,
      type: fact.type,
      routePreference: 'concept_tutor_when_scenario_identification_is_requested'
    }));

  return {
    packetId: 'unit1-scientific-method',
    title: 'Scientific Method and Variables',
    version: '1.0.0',
    subject: 'science',
    gradeLevel: '8th / physical science',
    unit: 1,
    unitTitle: 'Science Practices',
    sourcePack: 'unit1-scientific-method-variables',
    sourceFiles: sourceReferences,
    concepts,
    vocabulary,
    canonicalFacts,
    comparisons: [],
    relationships: collectRelationships(canonicalFacts),
    referenceFormulas: [],
    examples: collectExamples(canonicalFacts),
    conceptTutorHooks,
    routePreference: {
      directAnswer: 'definitions, examples, comparison-style explanations, typo recovery, and narrow scenario facts',
      formulaTutor: 'none for this packet',
      conceptTutor: 'scenario identification for variables, constants, control groups, and experimental groups'
    },
    legacyExports: {
      facts: 'ALL_UNIT1_SCIENTIFIC_METHOD_FACTS',
      matcher: matcherName || 'tryUnit1ScientificMethodKnowledge'
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
      conceptTutorHooks: conceptTutorHooks.length
    },
    metadata: {
      sourceBacked: sourceReferences.length > 0,
      sourceReferences,
      chunk: 'scientific-method-variables',
      generatedFromExistingFactsOnly: true
    }
  };
}

module.exports = {
  buildUnit1ScientificMethodPacket
};
