function buildMotionForcePacket({
  vocabulary,
  formulas,
  concepts,
  graphPatterns,
  problemBank,
  smokeTests
}) {
  const safeVocabulary = arrayOrEmpty(vocabulary);
  const safeFormulas = arrayOrEmpty(formulas);
  const safeConcepts = arrayOrEmpty(concepts);
  const safeGraphPatterns = arrayOrEmpty(graphPatterns);
  const safeProblemBank = arrayOrEmpty(problemBank);
  const safeSmokeTests = arrayOrEmpty(smokeTests);
  const sourcePages = collectSourcePages([
    safeVocabulary,
    safeFormulas,
    safeConcepts,
    safeGraphPatterns,
    safeProblemBank
  ]);
  const examples = collectExamples(safeVocabulary);
  const conceptTutorHooks = buildConceptTutorHooks();
  const formulaTutorHooks = buildFormulaTutorHooks();

  return {
    packetId: 'motion-force',
    title: 'Motion and Force',
    version: '1.0.0',
    subject: 'science',
    unitTitle: 'Motion and Force',
    vocabulary: safeVocabulary,
    concepts: safeConcepts,
    formulas: safeFormulas,
    graphPatterns: safeGraphPatterns,
    problemBank: safeProblemBank,
    smokePrompts: safeSmokeTests,
    smokeTests: safeSmokeTests,
    formulaTutorHooks,
    conceptTutorHooks,
    conceptGroups: safeConcepts,
    sourceMetadata: {
      sourcePages,
      sourceFiles: []
    },
    sourceFiles: [],
    canonicalFacts: [],
    examples,
    nonexamples: [],
    comparisons: [],
    relationships: [],
    directKnowledgeMatcher: 'tryMotionForceKnowledge',
    routePreference: {
      directAnswer: 'tryMotionForceKnowledge for supported vocabulary, graph, Newton law, and local-cue prompts',
      formulaTutor: 'scienceFormulaTools motion/force formula routes for supported calculations',
      conceptTutor: 'conceptTutorPatterns motion-force identification hooks for supported concept-classification prompts'
    },
    legacyExports: {
      vocabulary: 'vocabulary',
      formulas: 'formulas',
      concepts: 'concepts',
      graphPatterns: 'graphPatterns',
      problemBank: 'problemBank',
      smokeTests: 'smokeTests',
      matcher: 'tryMotionForceKnowledge'
    },
    counts: {
      vocabulary: safeVocabulary.length,
      concepts: safeConcepts.length,
      formulas: safeFormulas.length,
      graphPatterns: safeGraphPatterns.length,
      problemBank: safeProblemBank.length,
      smokePrompts: safeSmokeTests.length,
      smokeTests: safeSmokeTests.length,
      formulaTutorHooks: formulaTutorHooks.length,
      conceptTutorHooks: conceptTutorHooks.length,
      sourcePages: sourcePages.length,
      sourceFiles: 0,
      canonicalFacts: 0,
      examples: examples.length,
      nonexamples: 0,
      comparisons: 0,
      relationships: 0
    },
    metadata: {
      generatedFromExistingMotionForceDataOnly: true,
      sourceBacked: sourcePages.length > 0,
      sourcePages,
      missing: {
        unitNumber: 'not exposed by existing motion-force module metadata',
        gradeLevel: 'not exposed by existing motion-force module metadata',
        sourceFiles: 'existing rows expose sourcePages, not source file identifiers',
        canonicalFacts: 'not exposed as a separate canonical-fact collection',
        nonexamples: 'not exposed by existing motion-force module data',
        comparisons: 'not exposed by existing motion-force module data',
        relationships: 'not exposed by existing motion-force module data'
      }
    }
  };
}

function buildFormulaTutorHooks() {
  return [
    {
      module: 'lib/formulas/motion.js',
      exports: ['tryMotion'],
      routePreference: 'motion speed, velocity, distance, time, and distance/displacement calculations'
    },
    {
      module: 'lib/formulas/acceleration.js',
      exports: ['tryAccelerationFromVelocity', 'tryAccelerationFromDistanceTimeRuns'],
      routePreference: 'acceleration calculations from supported velocity/time prompts'
    },
    {
      module: 'lib/formulas/displacement.js',
      exports: ['tryDisplacement'],
      routePreference: 'distance/displacement calculations from supported path prompts'
    },
    {
      module: 'lib/formulas/force.js',
      exports: ['tryForce', 'tryForceAndFinalMomentumFromVelocityChange', 'tryForceFromVelocityChange'],
      routePreference: 'Newton second-law force calculations and supported force/momentum combined prompts'
    },
    {
      module: 'lib/formulas/netForce.js',
      exports: ['tryNetForce'],
      routePreference: 'net force calculations from supported directional-force prompts'
    },
    {
      module: 'lib/formulas/netForceNewton.js',
      exports: ['tryNetForceNewton'],
      routePreference: 'net-force plus acceleration calculations from supported prompts'
    },
    {
      module: 'lib/formulas/frictionNetForceNewton.js',
      exports: ['tryFrictionNetForceNewton'],
      routePreference: 'friction/net-force/Newton second-law calculations from supported prompts'
    },
    {
      module: 'lib/formulas/friction.js',
      exports: ['tryFriction'],
      routePreference: 'friction force calculations from supported prompts'
    },
    {
      module: 'lib/formulas/momentum.js',
      exports: ['tryMomentum'],
      routePreference: 'momentum calculations from supported mass/velocity and transfer prompts'
    },
    {
      module: 'lib/formulas/basics.js',
      exports: ['tryWeight', 'tryGravityConstant'],
      routePreference: 'weight and gravity-constant calculations from supported prompts'
    }
  ];
}

function buildConceptTutorHooks() {
  return [
    {
      id: 'motion-force.newtons-laws.identification',
      builder: 'buildNewtonsLawsConceptTutorPattern',
      topic: "Newton's laws identification"
    },
    {
      id: 'motion-force.balanced-unbalanced-forces.identification',
      builder: 'buildBalancedUnbalancedForcesConceptTutorPattern',
      topic: 'balanced and unbalanced forces'
    },
    {
      id: 'motion-force.reference-point.identification',
      builder: 'buildReferencePointConceptTutorPattern',
      topic: 'reference points'
    },
    {
      id: 'motion-force.distance-displacement.identification',
      builder: 'buildDistanceDisplacementConceptTutorPattern',
      topic: 'distance and displacement'
    },
    {
      id: 'motion-force.speed-velocity.identification',
      builder: 'buildSpeedVelocityConceptTutorPattern',
      topic: 'speed and velocity'
    },
    {
      id: 'motion-force.acceleration.identification',
      builder: 'buildAccelerationConceptTutorPattern',
      topic: 'acceleration'
    }
  ];
}

function collectSourcePages(groups) {
  return unique(groups.flatMap((group) => group.flatMap((item) => splitSourcePages(item && item.sourcePages))));
}

function collectExamples(vocabulary) {
  return arrayOrEmpty(vocabulary).flatMap((entry) => arrayOrEmpty(entry.examples).map((example) => ({
    vocabularyId: entry.id,
    term: entry.term,
    text: example,
    sourcePages: splitSourcePages(entry.sourcePages)
  })));
}

function splitSourcePages(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((page) => page.trim())
    .filter(Boolean);
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(arrayOrEmpty(values).filter(Boolean))];
}

module.exports = {
  buildMotionForcePacket
};
