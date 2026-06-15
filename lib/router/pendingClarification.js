const { makeRoute } = require('./answerBuilder');

const NUMBER_ONLY_PATTERN = /^\s*(\d+)\s*$/;

function resolvePendingClarification(message, pendingClarification) {
  if (!pendingClarification) return null;

  const match = NUMBER_ONLY_PATTERN.exec(String(message || ''));
  if (!match) return null;

  const selectedNumber = Number(match[1]);
  const selectedChoice = (pendingClarification.choices || [])
    .find((choice) => choice.number === selectedNumber);

  if (!selectedChoice) {
    const directAnswer = pendingClarification.invalidChoiceMessage ||
      'Please type one of the choices listed, like 1 or 2.';

    return {
      handled: true,
      pendingClarification,
      questionRoute: makeRoute({
        type: 'clarification_followup',
        confidence: 'none',
        toolsUsed: pendingClarification.toolsUsed || ['answer_intent_rules'],
        notes: `Invalid clarification choice ${selectedNumber} for ${pendingClarification.id}.`,
        directAnswer,
        aiAllowed: false
      })
    };
  }

  if (pendingClarification.formulaRequested) {
    const formulaAnswer = buildFormulaUnavailableAnswer(selectedChoice);
    if (formulaAnswer) {
      return {
        handled: true,
        pendingClarification: null,
        questionRoute: makeRoute({
          type: 'formula_only',
          confidence: 'none',
          toolsUsed: selectedChoice.toolsUsed || pendingClarification.toolsUsed || ['answer_intent_rules'],
          notes: selectedChoice.notes
            ? `${selectedChoice.notes} Formula was requested, but the selected trusted fact has no formula.`
            : `Formula was requested for selected clarification choice ${selectedNumber}, but the trusted fact has no formula.`,
          directAnswer: formulaAnswer,
          standardId: selectedChoice.standardId || '',
          aiAllowed: false
        })
      };
    }
  }

  return {
    handled: true,
    pendingClarification: null,
    questionRoute: makeRoute({
      type: selectedChoice.intent || 'formula_only',
      confidence: 'strong',
      toolsUsed: selectedChoice.toolsUsed || pendingClarification.toolsUsed || ['answer_intent_rules'],
      notes: selectedChoice.notes || `Answered selected clarification choice ${selectedNumber}.`,
      directAnswer: selectedChoice.answer,
      standardId: selectedChoice.standardId || '',
      aiAllowed: false
    })
  };
}

function buildFormulaUnavailableAnswer(selectedChoice = {}) {
  const answer = String(selectedChoice.answer || '').trim();
  if (/\b(?:formula|equation)\b\s*:|[a-z]\s*=/.test(answer)) return '';

  const label = String(selectedChoice.label || 'that choice')
    .replace(/^friction\s+as\s+/i, 'friction as ')
    .trim();
  return `The approved local fact for ${label} does not include a formula yet. I should not switch to a different friction topic or make one up.`;
}

function nextPendingClarification(questionRoute) {
  return questionRoute?.pendingClarification || null;
}

module.exports = {
  nextPendingClarification,
  resolvePendingClarification
};
