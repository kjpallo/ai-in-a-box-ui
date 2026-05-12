const { tryScienceFormula } = require('../formulas/scienceFormulaTools');
const { tryChemistryFormula } = require('../knowledge/chemistryTools');
const { tryPeriodicTable } = require('../knowledge/periodicTableTools');
const { tryFreeBodyForces } = require('../vocab/freeBodyForces');
const { tryPhysicsForcesVocab } = require('../vocab/physicsForces');
const { answerNarrowIntent } = require('./answerIntent');
const { buildKnowledgeAnswer, makeRoute } = require('./answerBuilder');
const {
  looksLikeDefinitionQuestion,
  looksLikeSafetyAdviceQuestion,
  looksLikeScienceQuestion,
  normalize
} = require('./classifyQuestion');
const { getMathToolName, tryMathOnly } = require('./mathCalculator');

function routeStudentQuestion(message, matchedKnowledge = []) {
  const text = String(message || '').trim();
  const normalized = normalize(text);

  const mathResult = tryMathOnly(text);
  if (mathResult) {
    return makeRoute({
      type: 'math_only',
      confidence: 'strong',
      toolsUsed: ['calculator', getMathToolName()],
      notes: `Calculated ${mathResult.expression} locally.`,
      calculatorResult: mathResult,
      directAnswer: mathResult.answer,
      aiAllowed: false
    });
  }

  if (looksLikeSafetyAdviceQuestion(normalized)) {
    return makeRoute({
      type: 'no_match',
      confidence: 'none',
      toolsUsed: [],
      notes: 'Safety or advice question blocked because no trusted local safety reference matched.',
      directAnswer: 'I do not have a trusted local safety fact for that yet. Please ask your teacher or another trusted adult before eating, touching, smelling, or using a chemical.',
      aiAllowed: false
    });
  }

  const shouldTryFormulaFirst = looksLikeFormulaProblem(normalized);
  const earlyScienceFormulaResult = shouldTryFormulaFirst ? tryScienceFormula(text) : null;
  if (earlyScienceFormulaResult) {
    return makeRoute({
      type: 'science_formula',
      confidence: 'strong',
      toolsUsed: ['science_formula_rules'],
      notes: earlyScienceFormulaResult.notes,
      directAnswer: earlyScienceFormulaResult.answer,
      formulaWork: earlyScienceFormulaResult.formulaWork,
      diagramText: earlyScienceFormulaResult.diagramText,
      aiAllowed: false
    });
  }

  const freeBodyForcesResult = tryFreeBodyForces(text);
  if (freeBodyForcesResult) {
    return makeRoute({
      type: 'science_concept',
      confidence: 'strong',
      toolsUsed: ['free_body_forces_concepts'],
      notes: `Answered local free-body forces concept question: ${freeBodyForcesResult.id}.`,
      directAnswer: freeBodyForcesResult.answer,
      aiAllowed: false
    });
  }

  const physicsVocabResult = tryPhysicsForcesVocab(text);
  if (physicsVocabResult && (!looksLikeFormulaProblem(normalized) || physicsVocabResult.id === 'unbalanced_forces_motion')) {
    return makeRoute({
      type: 'definition',
      confidence: 'strong',
      toolsUsed: ['physics_forces_vocab'],
      notes: `Answered local physics vocabulary question: ${physicsVocabResult.id}.`,
      directAnswer: physicsVocabResult.answer,
      aiAllowed: false
    });
  }

  if (!shouldTryFormulaFirst) {
    const scienceFormulaResult = tryScienceFormula(text);
    if (scienceFormulaResult) {
      return makeRoute({
        type: 'science_formula',
        confidence: 'strong',
        toolsUsed: ['science_formula_rules'],
        notes: scienceFormulaResult.notes,
        directAnswer: scienceFormulaResult.answer,
        formulaWork: scienceFormulaResult.formulaWork,
        diagramText: scienceFormulaResult.diagramText,
        aiAllowed: false
      });
    }
  }

  const narrowIntent = answerNarrowIntent(text);
  if (narrowIntent) {
    return makeRoute({
      type: narrowIntent.intent,
      confidence: 'strong',
      toolsUsed: ['answer_intent_rules'],
      notes: narrowIntent.notes,
      directAnswer: narrowIntent.answer,
      pendingClarification: narrowIntent.pendingClarification,
      aiAllowed: false
    });
  }

  const periodicTableResult = tryPeriodicTable(text);
  if (periodicTableResult) {
    return makeRoute({
      type: 'periodic_table',
      confidence: 'strong',
      toolsUsed: ['local_periodic_table'],
      notes: periodicTableResult.notes,
      directAnswer: periodicTableResult.answer,
      aiAllowed: false
    });
  }

  const chemistryResult = tryChemistryFormula(text);
  if (chemistryResult) {
    return makeRoute({
      type: 'chemistry_formula',
      confidence: 'strong',
      toolsUsed: ['chemistry_compounds'],
      notes: `Found ${chemistryResult.formula} as ${chemistryResult.name}.`,
      directAnswer: chemistryResult.student_answer || `${chemistryResult.formula} is ${chemistryResult.name}. It is a ${chemistryResult.type}. ${chemistryResult.note}`,
      aiAllowed: false
    });
  }

  const bestKnowledge = matchedKnowledge[0] || null;
  if (bestKnowledge) {
    const isStrong = Boolean(bestKnowledge.exactTermMatch || bestKnowledge.exactTitleMatch || bestKnowledge.score >= 18);
    const isDefinitionQuestion = looksLikeDefinitionQuestion(normalized);

    return makeRoute({
      type: isDefinitionQuestion ? 'definition' : 'class_fact',
      confidence: isStrong ? 'strong' : 'weak',
      toolsUsed: ['teacher_facts'],
      notes: isStrong
        ? `Found strong local match: ${bestKnowledge.title}. Answering directly from teacher facts.`
        : `Found related local match: ${bestKnowledge.title}. Answering directly from teacher facts.`,
      directAnswer: buildKnowledgeAnswer(bestKnowledge, isStrong),
      aiAllowed: false
    });
  }

  const possibleScience = looksLikeScienceQuestion(normalized);
  return makeRoute({
    type: possibleScience ? 'no_match' : 'no_match',
    confidence: 'none',
    toolsUsed: [],
    notes: possibleScience
      ? 'No trusted local science match found. Blocking free science answer.'
      : 'No trusted local match found.',
    directAnswer: possibleScience
      ? 'I do not have a trusted local science fact for that yet. Please reword the question with the vocabulary word, formula, or numbers you are asking about, or ask your teacher.'
      : 'I do not have a trusted local fact for that yet. Please reword the question or ask your teacher.',
    aiAllowed: false
  });
}

function looksLikeFormulaProblem(normalized) {
  return /(?:\d|=|μ|µ|\bif\b|\bgiven\b|\bcalculate\b|\bsolve\b|\bfind\b|\bdetermine\b|\bhow\s+much\b|\bhow\s+many\b|\bformula\b)/.test(normalized);
}

module.exports = {
  routeStudentQuestion
};
