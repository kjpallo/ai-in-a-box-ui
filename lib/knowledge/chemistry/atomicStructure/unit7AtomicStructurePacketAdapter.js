function buildUnit7AtomicStructurePacket({ metadata, facts, sourcePack, matcherName }) {
  const safeMetadata = metadata || {};
  const safeSourcePack = sourcePack || {};
  const sourceReferences = arrayOrEmpty(safeMetadata.sourceReferences || safeSourcePack.sourceReferences);
  const vocabulary = arrayOrEmpty(safeSourcePack.vocabulary);
  const concepts = arrayOrEmpty(safeSourcePack.conceptGroups);
  const canonicalFacts = arrayOrEmpty(facts);
  const visualFacts = [
    ...arrayOrEmpty(safeSourcePack.visualDiagramFacts),
    ...arrayOrEmpty(safeSourcePack.elementTileFields),
    ...arrayOrEmpty(safeSourcePack.openResponseFacts)
  ];
  const formulasAndRules = arrayOrEmpty(safeSourcePack.formulasAndRules);
  const comparisons = arrayOrEmpty(safeSourcePack.comparisonPairs);
  const relationships = arrayOrEmpty(safeSourcePack.relationshipEdges);

  return {
    packetId: 'unit7-atomic-structure',
    title: safeMetadata.unitTitle || safeSourcePack.unitTitle || 'Atomic Structure',
    version: '1.0.0',
    subject: 'science',
    gradeLevel: safeMetadata.gradeBand || safeSourcePack.gradeBand || '8th / physical science',
    unit: safeMetadata.unit || safeSourcePack.unit || 7,
    unitTitle: safeMetadata.unitTitle || safeSourcePack.unitTitle || 'Atomic Structure',
    sourcePack: safeMetadata.sourcePack || safeSourcePack.sourcePack || 'atomic-structure',
    sourceFiles: sourceReferences,
    concepts,
    vocabulary,
    canonicalFacts,
    visualFacts,
    comparisons,
    relationships,
    referenceFormulas: formulasAndRules,
    examples: collectExamples(canonicalFacts),
    studentWording: safeSourcePack.studentWording || {},
    routePreference: safeMetadata.structuredRoutePreference || safeSourcePack.routePreference || {},
    legacyExports: {
      metadata: 'UNIT7_ATOMIC_STRUCTURE_METADATA',
      facts: 'UNIT7_FACTS',
      sourcePack: 'UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK',
      comparisons: 'UNIT7_COMPARISON_PAIRS',
      relationships: 'UNIT7_RELATIONSHIP_EDGES',
      matcher: matcherName || 'tryUnit7AtomicStructureKnowledge'
    },
    counts: {
      sourceFiles: sourceReferences.length,
      concepts: concepts.length,
      vocabulary: vocabulary.length,
      canonicalFacts: canonicalFacts.length,
      visualFacts: visualFacts.length,
      comparisons: comparisons.length,
      relationships: relationships.length,
      referenceFormulas: formulasAndRules.length,
      examples: collectExamples(canonicalFacts).length
    },
    metadata: {
      sourceBacked: sourceReferences.length > 0,
      sourceReferences,
      concepts: arrayOrEmpty(safeMetadata.concepts),
      subtopics: arrayOrEmpty(safeMetadata.subtopics),
      routePreference: safeMetadata.routePreference || {},
      sourcePackMetadata: safeSourcePack
    }
  };
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function collectExamples(facts) {
  return arrayOrEmpty(facts).flatMap((fact) => [
    ...arrayOrEmpty(fact.examples).map((example) => ({ factId: fact.id, type: 'example', text: example })),
    ...arrayOrEmpty(fact.nonExamples).map((example) => ({ factId: fact.id, type: 'non_example', text: example }))
  ]);
}

module.exports = {
  buildUnit7AtomicStructurePacket
};
