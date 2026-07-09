function buildUnit9ReactionsPacket({
  metadata,
  sourceReferences,
  vocabulary,
  concepts,
  canonicalFacts,
  comparisons,
  relationships,
  referenceFormulas,
  examples,
  smokeTests,
  commonMisconceptions,
  conceptTutorHooks,
  formulaTutorHooks,
  routeHints,
  matcherName
}) {
  const sourceRefs = arrayOrEmpty(sourceReferences);
  const packetVocabulary = arrayOrEmpty(vocabulary);
  const packetConcepts = arrayOrEmpty(concepts);
  const packetFacts = arrayOrEmpty(canonicalFacts);
  const packetComparisons = arrayOrEmpty(comparisons);
  const packetRelationships = arrayOrEmpty(relationships);
  const packetFormulas = arrayOrEmpty(referenceFormulas);
  const packetExamples = arrayOrEmpty(examples);
  const packetSmokeTests = arrayOrEmpty(smokeTests);
  const packetConceptHooks = arrayOrEmpty(conceptTutorHooks);
  const packetFormulaHooks = arrayOrEmpty(formulaTutorHooks);

  return Object.freeze({
    packetId: 'unit9-reactions',
    title: 'Unit 9 Reactions',
    version: '1.0.0',
    subject: 'science',
    gradeLevel: metadata.gradeBand || '8th / physical science',
    unit: 9,
    unitTitle: 'Unit 9 Reactions',
    topic: 'Reactions',
    sourceMetadata: {
      sourceBacked: true,
      sourceRefs,
      note: metadata.sourceNote || 'Built from the grounded Reactions synthesis supplied for Patch 11.'
    },
    sourceFiles: sourceRefs,
    concepts: packetConcepts,
    vocabulary: packetVocabulary,
    canonicalFacts: packetFacts,
    comparisons: packetComparisons,
    relationships: packetRelationships,
    referenceFormulas: packetFormulas,
    examples: packetExamples,
    smokeTests: packetSmokeTests,
    commonMisconceptions: arrayOrEmpty(commonMisconceptions),
    conceptTutorHooks: packetConceptHooks,
    formulaTutorHooks: packetFormulaHooks,
    routeHints: arrayOrEmpty(routeHints),
    routePreference: metadata.routePreference || {},
    directKnowledgeMatcher: matcherName || 'tryUnit9ReactionsKnowledge',
    legacyExports: {
      metadata: 'UNIT9_REACTIONS_METADATA',
      packet: 'UNIT9_REACTIONS_PACKET',
      facts: 'UNIT9_REACTIONS_FACTS',
      matcher: matcherName || 'tryUnit9ReactionsKnowledge'
    },
    counts: {
      sourceFiles: sourceRefs.length,
      concepts: packetConcepts.length,
      vocabulary: packetVocabulary.length,
      canonicalFacts: packetFacts.length,
      comparisons: packetComparisons.length,
      relationships: packetRelationships.length,
      referenceFormulas: packetFormulas.length,
      examples: packetExamples.length,
      smokeTests: packetSmokeTests.length,
      conceptTutorHooks: packetConceptHooks.length,
      formulaTutorHooks: packetFormulaHooks.length
    },
    metadata: {
      sourceBacked: true,
      sourceReferences: sourceRefs,
      essentialQuestion: metadata.essentialQuestion,
      concepts: arrayOrEmpty(metadata.concepts),
      subtopics: arrayOrEmpty(metadata.subtopics),
      sourceNote: metadata.sourceNote || ''
    }
  });
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = { buildUnit9ReactionsPacket };
