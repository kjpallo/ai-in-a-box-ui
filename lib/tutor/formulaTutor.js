const { normalizeNumberWords } = require('../formulas/formulaParser');

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
    finalExplanation: String(formulaWork.finalExplanation || ''),
    diagramText: String(formulaWork.diagramText || ''),
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

  if (command === 'stop') {
    return {
      response: 'Guided Formula Tutor stopped. You can ask a new question now.',
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
    const attempts = getAttemptCount(updated, step);
    return {
      response: buildWrongAnswerResponse(updated, step, attempts),
      currentTutorProblem: updated,
      completed: false,
      stopped: false
    };
  }

  const advanced = advanceProblem(problem, step, result);
  if (advanced.currentStepIndex >= advanced.steps.length) {
    const response = result.response
      ? [result.response, advanced.finalExplanation].filter(Boolean).join('\n\n')
      : completionResponse(advanced);
    return {
      response,
      currentTutorProblem: null,
      completed: true,
      stopped: false
    };
  }

  const prefix = result.response
    ? `${result.response}\n\n`
    : result.unitReminder
    ? `${buildAcceptedQuantityResponse(problem, step)}\n\n`
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
      lines.push(`${choice.number}. ${buildChoiceDisplay(problem, step, choice)}`);
    }
    const clue = buildSolveTargetClue(problem, step);
    if (clue) lines.push('', clue);
  }

  return lines.join('\n');
}

function buildChoiceDisplay(problem, step, choice) {
  if (!isMotionSolveTargetStep(problem, step)) return choice.label;

  const descriptions = {
    speed: 'how fast something moves',
    distance: 'how far something travels',
    time: 'how long it takes'
  };
  const label = String(choice.label || '');
  return descriptions[label] ? `${label} — ${descriptions[label]}` : label;
}

function buildSolveTargetClue(problem, step) {
  if (!isMotionSolveTargetStep(problem, step)) return '';

  const cue = findMotionTargetCue(problem);
  if (!cue) return '';

  return `The question says “${cue},” so we are solving for ${problem.solveFor}.`;
}

function findMotionTargetCue(problem) {
  const question = String(problem.originalQuestion || '');
  const patternsByTarget = {
    distance: [/\bhow far\b/i, /\bwhat distance\b/i],
    time: [/\bhow long\b/i, /\bwhat time\b/i],
    speed: [/\bwhat is (?:its|the|their|his|her)?\s*speed\b/i, /\bwhat speed\b/i, /\bhow fast\b/i]
  };
  const patterns = patternsByTarget[problem.solveFor] || [];

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) return match[0].replace(/\s+/g, ' ').trim();
  }
  return '';
}

function isMotionSolveTargetStep(problem, step) {
  if (!step || step.id !== 'identify_solve_target') return false;
  if (problem.formulaId !== 'speed_distance_time' && problem.family !== 'motion') return false;

  const labels = (step.choices || []).map((choice) => choice?.label).sort();
  return labels.length === 3 &&
    labels[0] === 'distance' &&
    labels[1] === 'speed' &&
    labels[2] === 'time';
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
      stopped: true,
      tutorCategory: 'formula',
      tutorLabel: 'Formula Tutor'
    };
  }

  if (completed) {
    return {
      active: false,
      completed: true,
      tutorCategory: 'formula',
      tutorLabel: 'Formula Tutor',
      formulaId: problem.formulaId,
      solveFor: problem.solveFor,
      formula: problem.formula,
      originalQuestion: problem.originalQuestion,
      finalAnswer: problem.finalAnswer,
      finalExplanation: problem.finalExplanation,
      finalAnswerDisplay: problem.finalAnswer?.display || '',
      work: buildTutorWork(problem, { completed: true })
    };
  }

  // Keep expected values and final answers out of active tutor metadata; only completed/safe values are sent.
  return {
    active: true,
    completed: false,
    tutorCategory: 'formula',
    tutorLabel: 'Formula Tutor',
    formulaId: problem.formulaId,
    solveFor: problem.solveFor,
    formula: problem.formula,
    originalQuestion: problem.originalQuestion,
    currentStepIndex: problem.currentStepIndex,
    totalSteps: problem.steps.length,
    stepId: step?.id || '',
    stepType: step?.type || '',
    currentStepPrompt: step?.prompt || '',
    currentHint: problem.lastHint || '',
    completedSteps: Array.isArray(problem.completedSteps) ? [...problem.completedSteps] : [],
    knownValues: buildKnownValues(problem),
    work: buildTutorWork(problem)
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
    finalExplanation: normalized.finalExplanation || '',
    diagramText: normalized.diagramText || '',
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
  if (normalized === 'restart' || normalized === 'start over' || normalized === 'reset') return 'restart';
  if (normalized === 'stop' || normalized === 'cancel' || normalized === 'exit' || normalized === 'quit') return 'stop';
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

function getAttemptCount(problem, step) {
  const key = step.id || String(problem.currentStepIndex);
  return Number(problem.attempts?.[key]) || 0;
}

function buildWrongAnswerResponse(problem, step, attempts) {
  if (isSolveTargetStep(step)) {
    return buildSolveTargetWrongAnswer(problem, step, attempts);
  }

  const lines = [
    attempts >= 2 ? `Not quite yet. ${getStrongerHint(step)}` : `Not quite yet. ${getHint(step)}`
  ];

  if (step.type === 'multiple_choice' && Array.isArray(step.choices)) {
    lines.push('', 'Choose:', ...step.choices.map((choice) => `${choice.number}. ${buildChoiceDisplay(problem, step, choice)}`));
    const correctChoice = step.choices.find((choice) => choice.correct);
    if (correctChoice) {
      lines.push('', attempts >= 2
        ? `Try ${correctChoice.number}, or type stop to leave the tutor.`
        : `Type ${correctChoice.number} when you are ready, or type stop to leave the tutor.`);
    }
  } else {
    lines.push('', 'Try again, type hint for help, or type stop to leave the tutor.');
  }

  return lines.join('\n');
}

function buildSolveTargetWrongAnswer(problem, step, attempts) {
  const target = problem.solveFor || step.expected || 'the unknown';
  const cue = findSolveTargetCue(problem, target);
  const correctChoice = (step.choices || []).find((choice) => choice.correct || normalizeFormulaText(choice.label) === normalizeFormulaText(target));
  const clue = cue
    ? `This question asks “${cue}” so we are solving for ${target}.`
    : `Look for what the question asks you to find. Here, we are solving for ${target}.`;
  const lines = [
    attempts >= 2
      ? `Not quite yet. ${clue} ${correctChoice ? `Type ${correctChoice.number}.` : ''}`.trim()
      : `Not quite yet. ${clue}`
  ];

  if (Array.isArray(step.choices) && step.choices.length > 0) {
    lines.push('', 'Choose:', ...step.choices.map((choice) => `${choice.number}. ${buildChoiceDisplay(problem, step, choice)}`));
  }

  if (correctChoice) {
    lines.push('', attempts >= 2
      ? `Type ${correctChoice.number} for ${target}, or type stop to leave the tutor.`
      : `Type ${correctChoice.number} for ${target}, or type stop to leave the tutor.`);
  } else {
    lines.push('', 'Try again, type hint for help, or type stop to leave the tutor.');
  }

  return lines.join('\n');
}

function isSolveTargetStep(step) {
  return step?.id === 'identify_solve_target';
}

function findSolveTargetCue(problem, target) {
  const question = String(problem.originalQuestion || '');
  const escaped = escapeRegExp(target);
  const patterns = [
    new RegExp(`\\bwhat\\s+is\\s+(?:its|the|their|his|her)?\\s*${escaped}\\b`, 'i'),
    new RegExp(`\\bwhat\\s+${escaped}\\b`, 'i'),
    new RegExp(`\\bhow\\s+(?:much|many|far|fast|long)[^?]*\\b${escaped}\\b`, 'i')
  ];

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) return match[0].replace(/\s+/g, ' ').trim();
  }
  return '';
}

function getStrongerHint(step) {
  if (Array.isArray(step.hints) && step.hints.length > 1) return step.hints[1];
  return getHint(step);
}

function advanceProblem(problem, step, result = {}) {
  const completedSteps = addCompletedSteps(problem.completedSteps, [
    step.id || String(problem.currentStepIndex),
    result.skipStepId || ''
  ]);
  const skipOffset = result.skipNextStep ? 2 : 1;
  return touch({
    ...problem,
    completedSteps,
    currentStepIndex: problem.currentStepIndex + skipOffset,
    lastHint: ''
  });
}

function addCompletedSteps(existingSteps, newSteps) {
  const completed = Array.isArray(existingSteps) ? [...existingSteps] : [];
  for (const stepId of newSteps) {
    if (stepId && !completed.includes(stepId)) completed.push(stepId);
  }
  return completed;
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
  const finalValueResult = checkAcceptedFinalValue(step, message);
  if (finalValueResult.correct) return finalValueResult;
  if (Array.isArray(step.acceptedAnswers) && matchesAcceptedAnswer(step.acceptedAnswers, message)) {
    return { correct: true };
  }
  return { correct: normalizeText(message) === normalizeText(step.expected || step.expectedDisplay || '') };
}

function checkMultipleChoice(step, message) {
  const text = String(message || '').trim();
  const normalized = normalizeFormulaText(text);
  const correctChoice = (step.choices || []).find((choice) => choice.correct);

  if (correctChoice && text === String(correctChoice.number)) return { correct: true };
  if (correctChoice && normalizeFormulaText(correctChoice.label) === normalized) return { correct: true };
  if (step.expected && normalizeFormulaText(step.expected) === normalized) return { correct: true };
  if (Array.isArray(step.acceptedAnswers) && matchesAcceptedAnswer(step.acceptedAnswers, text)) return { correct: true };
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

function checkAcceptedFinalValue(step, message) {
  if (!step || !Number.isFinite(Number(step.acceptFinalValue))) return { correct: false };
  const answerValue = extractNumber(message);
  if (!numbersClose(answerValue, Number(step.acceptFinalValue))) return { correct: false };

  const display = step.acceptFinalDisplay || `${formatNumber(step.acceptFinalValue)} ${step.acceptFinalUnit || ''}`.trim();
  return {
    correct: true,
    response: display ? `Correct. Rt = ${display}.` : 'Correct.',
    skipNextStep: Boolean(step.skipNextStepOnFinalValue),
    skipStepId: step.skipStepId || ''
  };
}

function buildAcceptedQuantityResponse(problem, step) {
  const variable = findVariableForStep(step, problem.variables || {});
  const label = variable.label || '';
  const display = buildExpectedQuantityDisplay(step) || variable.display || step.expectedDisplay || step.expectedValue;

  if (label && display) return `Correct. ${label} = ${display}.`;
  if (display) return `Correct. ${display}.`;
  return 'Correct.';
}

function buildExpectedQuantityDisplay(step) {
  if (!step || !step.expectedUnit || !Number.isFinite(Number(step.expectedValue))) return '';
  return `${formatNumber(step.expectedValue)} ${step.expectedUnit}`;
}

function formatNumber(value) {
  return Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 4,
    useGrouping: false
  });
}

function extractNumber(message) {
  const normalized = normalizeNumberWords(String(message || ''))
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '')
    .trim();
  const scientific = parseScientificNumber(normalized);
  if (Number.isFinite(scientific)) return scientific;

  const match = normalized.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/);
  return match ? Number(match[0]) : NaN;
}

function parseScientificNumber(value) {
  const text = String(value || '');
  const base = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  const exponent = '[+-]?\\d+';
  const timesTen = new RegExp(`(${base})\\s*(?:x|×|\\*)\\s*10\\s*(?:\\^\\s*)?(${exponent})`, 'i');
  const timesTenMatch = text.match(timesTen);
  if (timesTenMatch) {
    return Number(timesTenMatch[1]) * (10 ** Number(timesTenMatch[2]));
  }

  const eNotation = new RegExp(`(${base})\\s*e\\s*(${exponent})`, 'i');
  const eMatch = text.match(eNotation);
  if (eMatch) {
    return Number(eMatch[1]) * (10 ** Number(eMatch[2]));
  }

  return NaN;
}

function numbersClose(actual, expected) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  const tolerance = Math.abs(expected) < 1
    ? Math.max(1e-9, Math.abs(expected) * 0.01)
    : Math.max(0.005, Math.abs(expected) * 0.001);
  return Math.abs(actual - expected) <= tolerance;
}

function hasExpectedUnit(message, expectedUnit) {
  if (!expectedUnit) return true;
  const text = normalizeUnitText(message);
  const unit = normalizeUnitText(expectedUnit);

  if (unit === 'kg') return /\b(kg|kilogram|kilograms)\b/.test(text);
  if (unit === 'g') return /\b(g|gram|grams)\b/.test(text);
  if (unit === 'ml') return /\b(ml|milliliter|milliliters|millilitre|millilitres)\b/.test(text);
  if (unit === 'l') return /\b(l|liter|liters|litre|litres)\b/.test(text);
  if (unit === 'cm3') return /\b(cm3|cubic centimeters?|cubic centimetres?)\b/.test(text);
  if (unit === 'm') return /\b(m|meter|meters|metre|metres)\b/.test(text);
  if (unit === 'km') return /\b(km|kilometer|kilometers|kilometre|kilometres)\b/.test(text);
  if (unit === 'mile') return /\b(mi|mile|miles)\b/.test(text);
  if (unit === 'hr') return /\b(h|hr|hrs|hour|hours)\b/.test(text);
  if (unit === 'min') return /\b(min|mins|minute|minutes)\b/.test(text);
  if (unit === 's') return /\b(s|sec|secs|second|seconds)\b/.test(text);
  if (unit === 'a') return /\b(a|amp|amps|ampere|amperes)\b/.test(text);
  if (unit === 'n') return /\b(n|newton|newtons)\b/.test(text);
  if (unit === 'v') return /\b(v|volt|volts)\b/.test(text);
  if (unit === 'ω') return /\b(ω|ohm|ohms|oms)\b/.test(text);
  if (unit === 'j') return /\b(j|joule|joules)\b/.test(text);
  if (unit === 'w') return /\b(w|watt|watts)\b/.test(text);
  if (unit === 'hz') return /\b(hz|hertz)\b/.test(text);
  if (unit === 'm/s2') return /\b(m\/s2|m\/sec\/sec|meters? per second squared|metres? per second squared)\b/.test(text);
  if (unit === 'm/s') return /\b(m\/s|m\/sec|meters? per second|metres? per second)\b/.test(text);
  if (unit === 'kgm/s') return /\b(kg\s*(?:x|\*|·)?\s*m\/s|kilogram meters? per second)\b/.test(text);
  if (unit === 'j/kgc') return /\b(j\/kgc|j\/kg\/c|j\/kg°c|joules? per kilogram(?: degree)? celsius)\b/.test(text);
  if (unit === 'j/gc') return /\b(j\/gc|j\/g\/c|j\/g°c|joules? per gram(?: degree)? celsius)\b/.test(text);
  if (unit === 'km/hr') return /\b(km\/h|km\/hr|kph|kilometers? per hour|kilometres? per hour)\b/.test(text);
  if (unit === 'mile/hr') return /\b(mph|mi\/h|mi\/hr|miles? per hour)\b/.test(text);
  if (unit === 'ft/s') return /\b(ft\/s|feet per second|foot per second)\b/.test(text);
  if (unit === 'g/ml') return /\b(g\/ml|grams? per millilit(?:er|re)s?)\b/.test(text);

  return text.includes(unit);
}

function normalizeUnitText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/\^2/g, '2')
    .replace(/\^3/g, '3')
    .replace(/°/g, '')
    .replace(/·/g, '')
    .replace(/(-?\d+(?:\.\d+)?)([a-zω])/g, '$1 $2')
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

function matchesAcceptedAnswer(acceptedAnswers, message) {
  const normalized = normalizeFormulaText(message);
  return acceptedAnswers.some((answer) => normalizeFormulaText(answer) === normalized);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[?.!]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyNewFormulaQuestionDuringTutor(message) {
  const text = String(message || '').trim();
  if (text.length < 18) return false;
  if (/^\d+(?:\.\d+)?(?:\s*[a-z/%²³]+)?$/i.test(text)) return false;

  const normalized = normalizeUnitText(text);
  const startsLikeWordProblem = /^(a|an|the|how|what)\b/i.test(text);
  const hasQuestionMark = /\?/.test(text);
  const asksForTarget = /\b(what|how)\b.+\b(mass|density|volume|speed|distance|time|force|acceleration|current|resistance|voltage|power|energy|work|momentum|wavelength|frequency)\b/i.test(text);
  const formulaKeywordMatches = normalized.match(/\b(mass|density|volume|speed|distance|time|force|acceleration|current|resistance|voltage|power|energy|work|momentum|wavelength|frequency|travels?|moves?|circuit|block|object|train)\b/g) || [];
  const unitValueMatches = normalized.match(/-?\d+(?:\.\d+)?\s*(?:kg|g|ml|l|cm3|m\/s2|m\/s|km\/hr|mile\/hr|ft\/s|m|km|mile|hr|h|s|sec|a|amp|n|v|volt|ohm|ω|j|w|hz)\b/g) || [];

  if (hasQuestionMark && (asksForTarget || unitValueMatches.length >= 1 || formulaKeywordMatches.length >= 2)) return true;
  if (startsLikeWordProblem && asksForTarget && (unitValueMatches.length >= 1 || formulaKeywordMatches.length >= 2)) return true;
  if (unitValueMatches.length >= 2 && asksForTarget) return true;
  return false;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function buildTutorWork(problem, options = {}) {
  const completed = options.completed === true;
  const completedSteps = Array.isArray(problem.completedSteps) ? problem.completedSteps : [];
  const targetDone = completed || completedSteps.includes('identify_solve_target');
  const formulaDone = completed || completedSteps.includes('choose_formula');
  const calculationStep = problem.steps.find((step) => step?.type === 'calculation') || null;
  const calculationDone = completed || (calculationStep?.id && completedSteps.includes(calculationStep.id));
  const atCalculation = calculationStep && problem.currentStepIndex >= problem.steps.indexOf(calculationStep);

  return {
    originalQuestion: problem.originalQuestion || '',
    solveFor: targetDone ? problem.solveFor || '' : '',
    formula: formulaDone ? problem.formula || '' : '',
    knownValues: buildKnownValues(problem),
    substitution: atCalculation || calculationDone ? extractSubstitutionDisplay(calculationStep) : '',
    answer: completed ? buildFinalAnswerDisplay(problem) : ''
  };
}

function extractSubstitutionDisplay(step) {
  const prompt = String(step?.prompt || '').trim();
  const match = prompt.match(/Now substitute:\s*(.+?)\.\s*What is\b/i);
  if (match) return match[1].trim();
  return '';
}

function buildFinalAnswerDisplay(problem) {
  const display = problem.finalAnswer?.display || '';
  if (problem.solveFor && display) return `${problem.solveFor} = ${display}`;
  return display;
}

function findVariableForStep(step, variables) {
  const normalizedId = normalizeText(String(step.id || '').replace(/_/g, ' '));
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
  const lines = [];
  if (problem.solveFor && display) {
    lines.push(`Correct. ${problem.solveFor} = ${display}.`);
  } else if (display) {
    lines.push(`Correct. ${display}.`);
  } else {
    lines.push('Correct.');
  }

  if (problem.finalExplanation) lines.push('', problem.finalExplanation);
  if (problem.diagramText) lines.push('', `Diagram:\n${problem.diagramText}`);
  return lines.join('\n');
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  answerFormulaTutorStep,
  buildFormulaTutorMetadata,
  buildFormulaTutorPrompt,
  canStartFormulaTutor,
  isLikelyNewFormulaQuestionDuringTutor,
  startFormulaTutor
};
