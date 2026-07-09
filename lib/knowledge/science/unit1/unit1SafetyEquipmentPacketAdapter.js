const {
  arrayOrEmpty,
  collectExamples,
  collectRelationships,
  groupFactsByType,
  unique
} = require('./unit1PacketAdapterHelpers');

function buildUnit1SafetyEquipmentPacket({ facts, matcherName }) {
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
    defaultType: 'safety_equipment_concept',
    idPrefix: 'unit1.safety_equipment.concept'
  });
  const topics = concepts.map((concept) => ({
    id: concept.id.replace('.concept.', '.topic.'),
    title: concept.title,
    terms: concept.terms,
    sourceRefs: concept.sourceRefs
  }));
  const relationships = collectRelationships(canonicalFacts);
  const examples = collectExamples(canonicalFacts);
  const smokeTests = collectSmokeTests(canonicalFacts);
  const safetyRules = canonicalFacts
    .filter((fact) => fact.safetyRule)
    .map((fact) => ({
      factId: fact.id,
      term: fact.canonicalTerm,
      rule: fact.safetyRule,
      sourceRefs: arrayOrEmpty(fact.sourceRefs)
    }));

  return {
    packetId: 'unit1-safety-equipment',
    title: 'Lab Safety and Equipment',
    version: '1.0.0',
    subject: 'science',
    gradeLevel: '8th / physical science',
    unit: 1,
    unitTitle: 'Science Practices',
    sourcePack: 'lab-safety-equipment',
    sourceFiles: sourceReferences,
    topics,
    concepts,
    vocabulary,
    canonicalFacts,
    comparisons: [],
    relationships,
    referenceFormulas: [],
    safetyRules,
    examples,
    smokeTests,
    conceptTutorHooks: [],
    routePreference: {
      directAnswer: 'definitions, safety rules, typo recovery, and equipment-use facts',
      formulaTutor: 'none for this packet',
      conceptTutor: 'none for this packet'
    },
    legacyExports: {
      facts: 'ALL_UNIT1_SAFETY_EQUIPMENT_FACTS',
      smokeTests: 'UNIT1_SAFETY_EQUIPMENT_PACKET.smokeTests',
      matcher: matcherName || 'tryUnit1SafetyEquipmentKnowledge'
    },
    counts: {
      sourceFiles: sourceReferences.length,
      topics: topics.length,
      concepts: concepts.length,
      vocabulary: vocabulary.length,
      canonicalFacts: canonicalFacts.length,
      comparisons: 0,
      relationships: relationships.length,
      referenceFormulas: 0,
      safetyRules: safetyRules.length,
      examples: examples.length,
      smokeTests: smokeTests.length,
      conceptTutorHooks: 0
    },
    metadata: {
      sourceBacked: sourceReferences.length > 0,
      sourceReferences,
      chunk: 'lab-safety-equipment',
      generatedFromExistingFactsOnly: true
    }
  };
}

function collectSmokeTests(facts) {
  return canonicalFactsWithPrompts(facts).map((fact) => ({
    id: `${fact.id}.smoke`,
    query: fact.studentWording[0],
    expectedRoute: 'direct_answer',
    expectedTool: 'unit1_safety_equipment_knowledge',
    expectedCoreAnswer: fact.answerTemplate,
    sourceRefs: arrayOrEmpty(fact.sourceRefs)
  }));
}

function canonicalFactsWithPrompts(facts) {
  return arrayOrEmpty(facts).filter((fact) =>
    fact &&
    Array.isArray(fact.studentWording) &&
    fact.studentWording.length > 0 &&
    typeof fact.answerTemplate === 'string' &&
    fact.answerTemplate.trim()
  );
}

module.exports = {
  buildUnit1SafetyEquipmentPacket
};
