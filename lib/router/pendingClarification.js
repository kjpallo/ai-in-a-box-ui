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

  return {
    handled: true,
    pendingClarification: null,
    questionRoute: makeRoute({
      type: selectedChoice.intent || 'formula_only',
      confidence: 'strong',
      toolsUsed: selectedChoice.toolsUsed || pendingClarification.toolsUsed || ['answer_intent_rules'],
      notes: selectedChoice.notes || `Answered selected clarification choice ${selectedNumber}.`,
      directAnswer: selectedChoice.answer,
      aiAllowed: false
    })
  };
}

function nextPendingClarification(questionRoute) {
  return questionRoute?.pendingClarification || null;
}

module.exports = {
  nextPendingClarification,
  resolvePendingClarification
};
