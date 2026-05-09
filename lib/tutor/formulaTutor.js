function canStartFormulaTutor(questionRoute) {
  return Boolean(
    questionRoute &&
    questionRoute.formulaWork &&
    Array.isArray(questionRoute.formulaWork.steps) &&
    questionRoute.formulaWork.steps.length > 0
  );
}

function startFormulaTutor({ questionRoute, originalQuestion }) {
  if (!canStartFormulaTutor(questionRoute)) return null;

  const formulaWork = questionRoute.formulaWork;
  const now = new Date().toISOString();
  return {
    formulaId: formulaWork.formulaId || '',
    family: formulaWork.family || '',
    solveFor: formulaWork.solveFor || '',
    formula: formulaWork.formula || '',
    variables: clonePlain(formulaWork.variables || {}),
    finalAnswer: clonePlain(formulaWork.finalAnswer || null),
    steps: clonePlain(formulaWork.steps),
    currentStepIndex: 0,
    attempts: {},
    completedSteps: [],
    startedAt: now,
    updatedAt: now,
    originalQuestion: String(originalQuestion || '')
  };
}

function answerFormulaTutorStep(currentTutorProblem, studentMessage) {
  const problem = normalizeProblem(currentTutorProblem);
  const message = String(studentMessage || '').trim();
  const command = normalizeCommand(message);

  if (command === 'hint') {
    const hint = currentHintResponse(problem);
    return {
      response: hint,
      currentTutorProblem: touch({ ...problem, lastHint: hint }),
      completed: false,
      stopped: false
    };
  }

  if (command === 'restart') {
    const restarted = restartFormulaTutor(problem);
    return {
      response: buildFormulaTutorPrompt(restarted),
      currentTutorProblem: restarted,
      completed: false,
      stopped: false
    };
  }

  if (command === 'stop' || command === 'cancel') {
    return {
      response: 'The guided problem was stopped.',
      currentTutorProblem: null,
      completed: false,
      stopped: true
    };
  }

  if (command === 'show_answer') {
    return {
      response: 'Try the next step first. Ask your teacher if you need the full answer.',
      currentTutorProblem: touch(problem),
      completed: false,
      stopped: false
    };
  }

  const step = getCurrentStep(problem);
  if (!step) {
    return {
      response: completionResponse(problem),
      currentTutorProblem: null,
      completed: true,
      stopped: false
    };
  }

  const result = checkStepAnswer(step, message);
  if (!result.correct) {
    const updated = recordAttempt(problem, step);
    return {
      response: `Not quite yet. ${getHint(step)}`,
      currentTutorProblem: updated,
      completed: false,
      stopped: false
    };
  }

  const advanced = advanceProblem(problem, step);
  if (advanced.currentStepIndex >= advanced.steps.length) {
    return {
      response: completionResponse(advanced),
      currentTutorProblem: null,
      completed: true,
      stopped: false
    };
  }

  const prefix = result.unitReminder
    ? `Correct number. Add the unit too: ${step.expectedUnit}.\n\n`
    : 'Correct.\n\n';
  return {
    response: `${prefix}${buildFormulaTutorPrompt(advanced, { includeIntro: false })}`,
    currentTutorProblem: advanced,
    completed: false,
    stopped: false
  };
}

function buildFormulaTutorPrompt(currentTutorProblem, options = {}) {
  const problem = normalizeProblem(currentTutorProblem);
  const step = getCurrentStep(problem);
  if (!step) return completionResponse(problem);

  const lines = [];
  if (options.includeIntro !== false && problem.solveFor) {
    lines.push(`We are solving for ${problem.solveFor}.`, '');
  }

  lines.push(`Step ${problem.currentStepIndex + 1} of ${problem.steps.length}:`);
  lines.push(step.prompt || 'What should we do next?');

  if (step.type === 'multiple_choice' && Array.isArray(step.choices)) {
    lines.push('');
    for (const choice of step.choices) {
      lines.push(`${choice.number}. ${choice.label}`);
    }
  }

  return lines.join('\n');
}

function buildFormulaTutorMetadata(currentTutorProblem, options = {}) {
  const problem = normalizeProblem(currentTutorProblem);
  const step = getCurrentStep(problem);
  const completed = options.completed === true;
  const stopped = options.stopped === true;

  if (stopped) {
    return {
      active: false,
      completed: false,
      stopped: true
    };
  }

  if (completed) {
    return {
      active: false,
      completed: true,
      formulaId: problem.formulaId,
      solveFor: problem.solveFor,
      formula: problem.formula,
      finalAnswerDisplay: problem.finalAnswer?.display || ''
    };
  }

  return {
    active: true,
    completed: false,
    formulaId: problem.formulaId,
    solveFor: problem.solveFor,
    formula: problem.formula,
    currentStepIndex: problem.currentStepIndex,
    totalSteps: problem.steps.length,
    stepId: step?.id || '',
    stepType: step?.type || '',
    currentStepPrompt: step?.prompt || '',
    currentHint: problem.lastHint || '',
    completedSteps: Array.isArray(problem.completedSteps) ? [...problem.completedSteps] : [],
    knownValues: buildKnownValues(problem)
  };
}

function normalizeProblem(problem) {
  const normalized = problem && typeof problem === 'object' ? problem : {};
  return {
    formulaId: normalized.formulaId || '',
    family: normalized.family || '',
    solveFor: normalized.solveFor || '',
    formula: normalized.formula || '',
    variables: normalized.variables || {},
    finalAnswer: normalized.finalAnswer || null,
    steps: Array.isArray(normalized.steps) ? normalized.steps : [],
    currentStepIndex: Number.isInteger(normalized.currentStepIndex) ? normalized.currentStepIndex : 0,
    attempts: normalized.attempts && typeof normalized.attempts === 'object' ? normalized.attempts : {},
    completedSteps: Array.isArray(normalized.completedSteps) ? normalized.completedSteps : [],
    lastHint: normalized.lastHint || '',
    startedAt: normalized.startedAt || new Date().toISOString(),
    updatedAt: normalized.updatedAt || new Date().toISOString(),
    originalQuestion: normalized.originalQuestion || ''
  };
}

function normalizeCommand(message) {
  const normalized = normalizeText(message);
  if (normalized === 'hint' || normalized === 'help') return 'hint';
  if (normalized === 'restart' || normalized === 'start over') return 'restart';
  if (normalized === 'stop' || normalized === 'cancel') return normalized;
  if (normalized === 'show answer' || normalized === 'answer' || normalized === 'tell me the answer') return 'show_answer';
  return '';
}

function restartFormulaTutor(problem) {
  return touch({
    ...problem,
    currentStepIndex: 0,
    attempts: {},
    completedSteps: [],
    lastHint: ''
  });
}

function getCurrentStep(problem) {
  return problem.steps[problem.currentStepIndex] || null;
}

function recordAttempt(problem, step) {
  const attempts = { ...problem.attempts };
  const key = step.id || String(problem.currentStepIndex);
  attempts[key] = (Number(attempts[key]) || 0) + 1;
  return touch({ ...problem, attempts, lastHint: getHint(step) });
}

function advanceProblem(problem, step) {
  const completedSteps = problem.completedSteps.includes(step.id)
    ? problem.completedSteps
    : [...problem.completedSteps, step.id || String(problem.currentStepIndex)];
  return touch({
    ...problem,
    completedSteps,
    currentStepIndex: problem.currentStepIndex + 1,
    lastHint: ''
  });
}

function touch(problem) {
  return {
    ...problem,
    updatedAt: new Date().toISOString()
  };
}

function checkStepAnswer(step, message) {
  if (step.type === 'multiple_choice') return checkMultipleChoice(step, message);
  if (step.type === 'quantity') return checkQuantity(step, message);
  if (step.type === 'calculation') return checkCalculation(step, message);
  return { correct: normalizeText(message) === normalizeText(step.expected || step.expectedDisplay || '') };
}

function checkMultipleChoice(step, message) {
  const text = String(message || '').trim();
  const normalized = normalizeFormulaText(text);
  const correctChoice = (step.choices || []).find((choice) => choice.correct);

  if (correctChoice && text === String(correctChoice.number)) return { correct: true };
  if (correctChoice && normalizeFormulaText(correctChoice.label) === normalized) return { correct: true };
  if (step.expected && normalizeFormulaText(step.expected) === normalized) return { correct: true };
  if (/\bforce\b/.test(normalizeText(text)) && /\bmass\b/.test(normalizeText(text)) && /\bacceleration\b/.test(normalizeText(text))) {
    return { correct: true };
  }

  return { correct: false };
}

function checkQuantity(step, message) {
  const expectedValue = Number(step.expectedValue);
  const answerValue = extractNumber(message);
  if (!numbersClose(answerValue, expectedValue)) return { correct: false };

  const hasUnit = hasExpectedUnit(message, step.expectedUnit);
  return {
    correct: true,
    unitReminder: Boolean(step.expectedUnit && !hasUnit)
  };
}

function checkCalculation(step, message) {
  const expectedValue = Number(step.expectedValue);
  const answerValue = extractNumber(message);
  return { correct: numbersClose(answerValue, expectedValue) };
}

function extractNumber(message) {
  const match = String(message || '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function numbersClose(actual, expected) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  return Math.abs(actual - expected) < 0.005;
}

function hasExpectedUnit(message, expectedUnit) {
  if (!expectedUnit) return true;
  const text = normalizeUnitText(message);
  const unit = normalizeUnitText(expectedUnit);

  if (unit === 'kg') return /\b(kg|kilogram|kilograms)\b/.test(text);
  if (unit === 'n') return /\b(n|newton|newtons)\b/.test(text);
  if (unit === 'm/s2') return /\b(m\/s2|m\/sec\/sec|meters? per second squared|metres? per second squared)\b/.test(text);

  return text.includes(unit);
}

function normalizeUnitText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/²/g, '2')
    .replace(/\^2/g, '2')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFormulaText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/\*/g, 'x')
    .replace(/equals?/g, '=')
    .replace(/\s+/g, '')
    .trim();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[?.!]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getHint(step) {
  if (Array.isArray(step.hints) && step.hints.length > 0) return step.hints[0];
  return 'Try looking back at the values in the question.';
}

function currentHintResponse(problem) {
  const step = getCurrentStep(problem);
  return step ? getHint(step) : completionResponse(problem);
}

function buildKnownValues(problem) {
  const variables = problem.variables && typeof problem.variables === 'object' ? problem.variables : {};
  const knownValues = [];

  for (const step of problem.steps) {
    if (!step || step.type !== 'quantity') continue;
    const stepId = step.id || '';
    if (!problem.completedSteps.includes(stepId)) continue;

    const variable = findVariableForStep(step, variables);
    knownValues.push({
      label: variable.label,
      symbol: variable.symbol,
      display: variable.display
    });
  }

  return knownValues;
}

function findVariableForStep(step, variables) {
  const normalizedId = normalizeText(step.id || '');
  const expectedDisplay = String(step.expectedDisplay || '').trim();

  for (const [label, variable] of Object.entries(variables)) {
    if (normalizedId.includes(normalizeText(label))) {
      return {
        label,
        symbol: variable?.symbol || '',
        display: variable?.display || expectedDisplay
      };
    }
  }

  return {
    label: normalizedId.replace(/^identify /, '') || step.id || 'value',
    symbol: '',
    display: expectedDisplay
  };
}

function completionResponse(problem) {
  const display = problem.finalAnswer?.display || '';
  const formulaSymbol = problem.variables?.force?.symbol || (problem.solveFor === 'force' ? 'F' : '');
  if (formulaSymbol && display) return `Correct. ${formulaSymbol} = ${display}.`;
  if (display) return `Correct. ${display}.`;
  return 'Correct.';
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  answerFormulaTutorStep,
  buildFormulaTutorMetadata,
  buildFormulaTutorPrompt,
  canStartFormulaTutor,
  startFormulaTutor
};
