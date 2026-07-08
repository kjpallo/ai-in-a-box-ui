function buildUnit3EnergyPacket({
  directAnswerFacts,
  energyTypeFacts,
  energyExampleFacts,
  energyTransformationFacts,
  matcherName
}) {
  const safeDirectAnswerFacts = arrayOrEmpty(directAnswerFacts);
  const safeEnergyTypeFacts = arrayOrEmpty(energyTypeFacts);
  const safeEnergyExampleFacts = arrayOrEmpty(energyExampleFacts);
  const safeEnergyTransformationFacts = arrayOrEmpty(energyTransformationFacts);
  const canonicalFacts = [
    ...safeDirectAnswerFacts.map(normalizeDirectAnswerFact),
    ...safeEnergyTypeFacts.map(normalizeEnergyTypeFact),
    ...safeEnergyExampleFacts.map(normalizeEnergyExampleFact),
    ...safeEnergyTransformationFacts.map(normalizeEnergyTransformationFact)
  ];
  const vocabulary = safeEnergyTypeFacts.map((fact) => ({
    id: fact.id,
    term: fact.name,
    definition: fact.definition,
    examples: fact.example ? [fact.example] : []
  }));
  const examples = safeEnergyTypeFacts
    .filter((fact) => fact.example)
    .map((fact) => ({
      factId: fact.id,
      type: 'example',
      text: fact.example
    }));
  const comparisons = safeDirectAnswerFacts
    .filter((fact) => fact.category === 'comparison')
    .map((fact) => ({
      id: directAnswerCanonicalId(fact.id),
      legacyAnswerId: fact.id,
      answer: fact.answer
    }));
  const formulas = buildFormulaHooks();
  const conceptTutorHooks = buildConceptTutorHooks();

  return {
    packetId: 'unit3-energy',
    unit: 3,
    unitTitle: 'Energy',
    title: 'Energy',
    version: '1.0.0',
    subject: 'science',
    vocabulary,
    concepts: [
      conceptGroup('unit3.energy.types', 'energy types', safeEnergyTypeFacts),
      conceptGroup('unit3.energy.examples', 'energy examples', safeEnergyExampleFacts),
      conceptGroup('unit3.energy.transformations', 'energy transformations', safeEnergyTransformationFacts),
      conceptGroup('unit3.energy.direct_answers', 'direct energy answers', safeDirectAnswerFacts, directAnswerCanonicalId)
    ],
    canonicalFacts,
    examples,
    nonexamples: [],
    comparisons,
    relationships: [],
    formulas,
    formulaTutorHooks: formulas,
    conceptTutorHooks,
    routePreference: {
      directAnswer: 'tryUnit3EnergyKnowledge for supported Unit 3 energy definitions, examples, transformations, and concept explanations',
      formulaTutor: 'scienceFormulaTools energy, work/power, and specific-heat formula routes for supported numeric prompts',
      conceptTutor: 'conceptTutorPatterns Unit 3 energy classification hooks for supported multiple-choice concept prompts'
    },
    legacyExports: {
      packet: 'UNIT3_ENERGY_PACKET',
      directAnswerFacts: 'UNIT3_DIRECT_ANSWER_FACTS',
      energyTypeFacts: 'ENERGY_TYPE_FACTS',
      energyExampleFacts: 'ENERGY_EXAMPLE_FACTS',
      energyTransformationFacts: 'ENERGY_TRANSFORMATION_FACTS',
      matcher: matcherName || 'tryUnit3EnergyKnowledge'
    },
    counts: {
      vocabulary: vocabulary.length,
      concepts: 4,
      canonicalFacts: canonicalFacts.length,
      directAnswerFacts: safeDirectAnswerFacts.length,
      energyTypeFacts: safeEnergyTypeFacts.length,
      energyExampleFacts: safeEnergyExampleFacts.length,
      energyTransformationFacts: safeEnergyTransformationFacts.length,
      examples: examples.length,
      nonexamples: 0,
      comparisons: comparisons.length,
      relationships: 0,
      formulas: formulas.length,
      formulaTutorHooks: formulas.length,
      conceptTutorHooks: conceptTutorHooks.length,
      sourceFiles: 0,
      sourceReferences: 0
    },
    metadata: {
      generatedFromExistingUnit3EnergyContentOnly: true,
      sourceBacked: false,
      sourceReferences: [],
      missing: {
        sourceReferences: 'not exposed by existing Unit 3 Energy module data',
        gradeBand: 'not exposed by existing Unit 3 Energy module data',
        nonexamples: 'not exposed by existing Unit 3 Energy module data',
        relationships: 'not exposed as structured relationship data by existing Unit 3 Energy module data'
      }
    }
  };
}

function normalizeDirectAnswerFact(fact) {
  return {
    id: directAnswerCanonicalId(fact.id),
    legacyAnswerId: fact.id,
    type: fact.type || 'science_concept',
    category: fact.category || 'direct_answer',
    answer: fact.answer
  };
}

function normalizeEnergyTypeFact(fact) {
  return {
    id: fact.id,
    type: 'energy_type',
    name: fact.name,
    definition: fact.definition,
    example: fact.example,
    answer: fact.answer
  };
}

function normalizeEnergyExampleFact(fact) {
  return {
    id: fact.id,
    type: 'energy_example',
    answer: fact.answer
  };
}

function normalizeEnergyTransformationFact(fact) {
  return {
    id: fact.id,
    type: 'energy_transformation',
    answer: fact.answer
  };
}

function conceptGroup(id, label, facts, mapFactId = (factId) => factId) {
  return {
    id,
    label,
    factIds: arrayOrEmpty(facts).map((fact) => mapFactId(fact.id))
  };
}

function directAnswerCanonicalId(id) {
  return `unit3.direct.${id}`;
}

function buildFormulaHooks() {
  return [
    {
      module: 'lib/formulas/energy.js',
      exports: ['tryEnergyConservationHeight', 'tryKineticEnergy', 'tryPotentialEnergy'],
      routePreference: 'kinetic energy, gravitational potential energy, and conservation bridge calculations'
    },
    {
      module: 'lib/formulas/workPower.js',
      exports: ['tryWorkPowerTime'],
      routePreference: 'work, power, and time calculations'
    },
    {
      module: 'lib/formulas/basics.js',
      exports: ['trySpecificHeat'],
      routePreference: 'thermal energy and specific heat calculations'
    }
  ];
}

function buildConceptTutorHooks() {
  return [
    {
      id: 'energy.processes.endothermic-exothermic.identification',
      builder: 'buildEndothermicExothermicConceptTutorPattern',
      topic: 'endothermic and exothermic process identification'
    },
    {
      id: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
      builder: 'buildMechanicalEnergyTypesConceptTutorPattern',
      topic: 'kinetic, gravitational potential, and elastic potential energy identification'
    },
    {
      id: 'energy.transfer.conduction-convection-radiation',
      builder: 'buildEnergyTransferConceptTutorPattern',
      topic: 'conduction, convection, and radiation identification'
    }
  ];
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  buildUnit3EnergyPacket
};
