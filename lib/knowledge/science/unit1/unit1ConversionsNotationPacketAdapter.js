const {
  arrayOrEmpty,
  collectExamples,
  collectRelationships,
  groupFactsByType,
  unique
} = require('./unit1PacketAdapterHelpers');

const FORMULA_TUTOR_HOOKS = [
  {
    formulaId: 'unit1_metric_stair_step_conversion',
    family: 'unit1_conversions',
    routePreference: 'formula_tutor_for_metric_conversion_calculation_prompts'
  },
  {
    formulaId: 'unit1_picket_fence_conversion',
    family: 'unit1_conversions',
    routePreference: 'formula_tutor_for_supported_dimensional_analysis_calculation_prompts'
  },
  {
    formulaId: 'unit1_temperature_conversion',
    family: 'unit1_conversions',
    routePreference: 'formula_tutor_for_temperature_conversion_calculation_prompts'
  },
  {
    formulaId: 'unit1_scientific_notation',
    family: 'unit1_conversions',
    routePreference: 'formula_tutor_for_scientific_notation_calculation_prompts'
  },
  {
    formulaId: 'unit1_standard_notation',
    family: 'unit1_conversions',
    routePreference: 'formula_tutor_for_standard_notation_calculation_prompts'
  }
];

function buildUnit1ConversionsNotationPacket({ facts, matcherName }) {
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
    defaultType: 'conversions_notation_concept',
    idPrefix: 'unit1.conversions_notation.concept'
  });
  const topics = concepts.map((concept) => ({
    id: concept.id.replace('.concept.', '.topic.'),
    title: concept.title,
    terms: concept.terms,
    sourceRefs: concept.sourceRefs
  }));
  const relationships = collectRelationships(canonicalFacts);
  const examples = collectExamples(canonicalFacts);
  const referenceFormulas = canonicalFacts
    .filter((fact) => fact.type === 'formula_lookup')
    .map((fact) => ({
      factId: fact.id,
      title: fact.canonicalTerm,
      rule: fact.use || fact.answerTemplate || fact.definition || '',
      sourceRefs: arrayOrEmpty(fact.sourceRefs)
    }));
  const conversionRules = canonicalFacts
    .filter((fact) => ['method_definition', 'vocabulary'].includes(fact.type))
    .map((fact) => ({
      factId: fact.id,
      term: fact.canonicalTerm,
      rule: fact.use || fact.definition || fact.answerTemplate || '',
      sourceRefs: arrayOrEmpty(fact.sourceRefs)
    }));
  const notationRules = canonicalFacts
    .filter((fact) => fact.type === 'notation_definition')
    .map((fact) => ({
      factId: fact.id,
      term: fact.canonicalTerm,
      rule: fact.use || fact.definition || fact.answerTemplate || '',
      sourceRefs: arrayOrEmpty(fact.sourceRefs)
    }));

  return {
    packetId: 'unit1-conversions-notation',
    title: 'Conversions and Notation',
    version: '1.0.0',
    subject: 'science',
    gradeLevel: '8th / physical science',
    unit: 1,
    unitTitle: 'Science Practices',
    sourcePack: 'dimensional-analysis-conversions-notation',
    sourceFiles: sourceReferences,
    topics,
    concepts,
    vocabulary,
    canonicalFacts,
    comparisons: [],
    relationships,
    referenceFormulas,
    conversionRules,
    notationRules,
    examples,
    formulaTutorHooks: FORMULA_TUTOR_HOOKS,
    conceptTutorHooks: [],
    routePreference: {
      directAnswer: 'definitions, conversion method facts, notation facts, typo recovery, and temperature formula lookups',
      formulaTutor: 'calculation prompts remain handled by the existing Unit 1 conversions formula tutor routes',
      conceptTutor: 'none for this packet'
    },
    legacyExports: {
      facts: 'ALL_UNIT1_CONVERSIONS_NOTATION_FACTS',
      matcher: matcherName || 'tryUnit1ConversionsNotationKnowledge',
      formulaMatcher: 'tryUnit1ConversionsNotation'
    },
    counts: {
      sourceFiles: sourceReferences.length,
      topics: topics.length,
      concepts: concepts.length,
      vocabulary: vocabulary.length,
      canonicalFacts: canonicalFacts.length,
      comparisons: 0,
      relationships: relationships.length,
      referenceFormulas: referenceFormulas.length,
      conversionRules: conversionRules.length,
      notationRules: notationRules.length,
      examples: examples.length,
      formulaTutorHooks: FORMULA_TUTOR_HOOKS.length,
      conceptTutorHooks: 0
    },
    metadata: {
      sourceBacked: sourceReferences.length > 0,
      sourceReferences,
      chunk: 'dimensional-analysis-conversions-notation',
      generatedFromExistingFactsOnly: true
    }
  };
}

module.exports = {
  buildUnit1ConversionsNotationPacket
};
