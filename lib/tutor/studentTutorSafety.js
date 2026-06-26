const SAFE_CHOICE_STEP_TYPES = new Set([
  'choice',
  'multiple_choice',
  'controlled_choice',
  'button_choice',
  'buttons'
]);

const SAFE_NUMERIC_STEP_TYPES = new Set([
  'calculation',
  'calculation_entry',
  'number',
  'number_entry',
  'numeric',
  'numeric_entry',
  'quantity'
]);

const UNSAFE_OPEN_ENDED_PROMPT_PATTERN = /\b(?:explain|describe|summarize|what\s+do\s+you\s+think|what\s+do\s+you\s+notice|in\s+your\s+own\s+words|why\s+do\s+you\s+think|how\s+do\s+you\s+know|what\s+forces\s+are\s+given|what\s+direction\s+is\s+each\s+force)\b/i;
const BROAD_TEXT_QUESTION_PATTERN = /^\s*(?:what\s+is|what\s+are|whats|why\s+is|why\s+are|how\s+would|how\s+could)\b/i;
const CONTROLLED_TEXT_PROMPT_PATTERN = /\b(?:what\s+kind|what\s+operation|what\s+formula|substitute|which\s+formula|which\s+operation)\b/i;

function canStartStudentTutorSteps(steps) {
  return getUnsafeStudentTutorStepReasons(steps).length === 0;
}

function getUnsafeStudentTutorStepReasons(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return [{ index: -1, reason: 'missing_steps' }];
  }

  const reasons = [];
  steps.forEach((step, index) => {
    const result = checkStudentTutorStepSafety(step);
    if (!result.safe) {
      reasons.push({
        index,
        stepId: step && typeof step === 'object' && !Array.isArray(step) ? String(step.id || '') : '',
        reason: result.reason
      });
    }
  });
  return reasons;
}

function checkStudentTutorStepSafety(step) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    return { safe: false, reason: 'step_must_be_object' };
  }

  if (isNonStudentFacingOrFallbackStep(step)) {
    return { safe: true, reason: 'not_student_facing' };
  }

  const type = normalizeType(step.type || step.kind || step.inputType || step.responseType);
  if (SAFE_CHOICE_STEP_TYPES.has(type)) {
    return hasControlledChoices(step)
      ? { safe: true, reason: 'controlled_choice' }
      : { safe: false, reason: 'choice_step_missing_choices' };
  }

  if (hasControlledChoices(step) && step.controlledChoice !== false) {
    return { safe: true, reason: 'controlled_choices' };
  }

  if (SAFE_NUMERIC_STEP_TYPES.has(type)) {
    return isNumericEntryStep(step)
      ? { safe: true, reason: 'numeric_entry' }
      : { safe: false, reason: 'numeric_step_missing_expected_value' };
  }

  if (type === 'text') {
    return isSafeBoundedTextStep(step)
      ? { safe: true, reason: 'bounded_text' }
      : { safe: false, reason: 'open_ended_text_step' };
  }

  if (type === 'final_answer') {
    return isSafeBoundedTextStep(step)
      ? { safe: true, reason: 'bounded_final_answer' }
      : { safe: false, reason: 'open_ended_final_answer_step' };
  }

  return { safe: false, reason: type ? `unsupported_step_type:${type}` : 'missing_step_type' };
}

function isNonStudentFacingOrFallbackStep(step) {
  return step.studentFacing === false ||
    step.studentVisible === false ||
    step.nonStudentFacing === true ||
    step.fallbackOnly === true ||
    step.studentFallbackOnly === true;
}

function hasControlledChoices(step) {
  const choices = Array.isArray(step.choices)
    ? step.choices
    : Array.isArray(step.options)
      ? step.options
      : [];
  if (choices.length === 0) return false;
  return choices.every((choice, index) => {
    if (typeof choice === 'string') return choice.trim().length > 0;
    if (!choice || typeof choice !== 'object' || Array.isArray(choice)) return false;
    const label = String(choice.label || choice.text || choice.value || '').trim();
    const hasNumber = choice.number != null || choice.id != null || index >= 0;
    return label.length > 0 && hasNumber;
  });
}

function isNumericEntryStep(step) {
  if (Number.isFinite(Number(step.expectedValue))) return true;
  if (Number.isFinite(Number(step.acceptFinalValue))) return true;
  if (String(step.calculationExpression || '').trim()) return true;
  const combinedValues = step.combinedFinalAnswer?.values;
  return Array.isArray(combinedValues) &&
    combinedValues.length > 0 &&
    combinedValues.every((item) => Number.isFinite(Number(item?.value ?? item)));
}

function isSafeBoundedTextStep(step) {
  if (isOpenEndedTextStep(step)) return false;

  const answers = [
    step.expected,
    step.expectedDisplay,
    ...(Array.isArray(step.acceptedAnswers) ? step.acceptedAnswers : [])
  ]
    .map((answer) => String(answer || '').trim())
    .filter(Boolean);

  if (answers.length === 0 && !Number.isFinite(Number(step.acceptFinalValue))) return false;
  if (step.allowAcceptedAnswerContains === true) return false;
  return answers.every(isShortControlledAnswer);
}

function isOpenEndedTextStep(step) {
  const prompt = String(step.prompt || step.question || '').trim();
  if (UNSAFE_OPEN_ENDED_PROMPT_PATTERN.test(prompt)) return true;
  if (
    BROAD_TEXT_QUESTION_PATTERN.test(prompt) &&
    !CONTROLLED_TEXT_PROMPT_PATTERN.test(prompt) &&
    !hasNumericOrFormulaAnswer(step)
  ) {
    return true;
  }
  if (step.openEnded === true || step.freeResponse === true || step.allowFreeResponse === true) return true;
  return false;
}

function isShortControlledAnswer(answer) {
  const text = String(answer || '').trim();
  if (!text) return false;
  if (/[.!?]\s*$/.test(text) && countWords(text) > 5) return false;
  const wordCount = countWords(text);
  if (wordCount <= 12) return true;
  if (/[=+*/^×÷Ωω]/.test(text)) return true;
  return /\d/.test(text) && wordCount <= 8;
}

function hasNumericOrFormulaAnswer(step) {
  const answers = [
    step.expected,
    step.expectedDisplay,
    ...(Array.isArray(step.acceptedAnswers) ? step.acceptedAnswers : [])
  ]
    .map((answer) => String(answer || '').trim())
    .filter(Boolean);
  return answers.some((answer) => /\d/.test(answer) || /[=+*/^×÷Ωω]/.test(answer));
}

function countWords(value) {
  const matches = String(value || '').match(/[A-Za-z]+(?:'[A-Za-z]+)?/g);
  return matches ? matches.length : 0;
}

function normalizeType(value) {
  return String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
}

module.exports = {
  canStartStudentTutorSteps,
  checkStudentTutorStepSafety,
  getUnsafeStudentTutorStepReasons
};
