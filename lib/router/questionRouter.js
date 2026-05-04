const { tryScienceFormula } = require('../formulas/scienceFormulaTools');
const { tryChemistryFormula } = require('../knowledge/chemistryTools');
const { tryPeriodicTable } = require('../knowledge/periodicTableTools');
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

  const scienceFormulaResult = tryScienceFormula(text);
  if (scienceFormulaResult) {
    return makeRoute({
      type: 'science_formula',
      confidence: 'strong',
      toolsUsed: ['science_formula_rules'],
      notes: scienceFormulaResult.notes,
      directAnswer: scienceFormulaResult.answer,
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

module.exports = {
  routeStudentQuestion
};
