const { randomBytes } = require('node:crypto');
const {
  DISTANCE_UNITS,
  MASS_UNITS,
  TIME_UNITS,
  VELOCITY_UNITS,
  VOLUME_UNITS,
  convertDistance,
  convertTime,
  findNumberWithUnit,
  massToGrams,
  massToKg,
  normalizeNumberWords,
  volumeToML
} = require('../formulas/formulaParser');
const { tryMathOnly } = require('../router/mathCalculator');
const {
  buildGraphTutorHint,
  buildGraphTutorSupport
} = require('./graphTutorSupport');
const {
  canStartStudentTutorSteps,
  getUnsafeStudentTutorStepReasons
} = require('./studentTutorSafety');
const {
  buildBalancingActivityMetadata,
  handleAmmoniaBalancingAction,
  isAmmoniaBalancingProblem
} = require('./activities/ammoniaBalancingActivity');

function canStartFormulaTutor(questionRoute) {
  const formulaWork = questionRoute?.formulaWork;
  return Boolean(
    questionRoute &&
    formulaWork &&
    Array.isArray(formulaWork.steps) &&
    formulaWork.steps.length > 0 &&
    canStartStudentTutorSteps(formulaWork.steps)
  );
}

function createTutorProblemId() {
  return `formula-${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`;
}

function shouldBypassFormulaTutorForOpenEndedWork(formulaWork = {}) {
  return getUnsafeStudentTutorStepReasons(formulaWork.steps).some((item) => item.reason === 'open_ended_text_step');
}

function getFormulaTutorDecisionDebug(result = {}, settings = {}) {
  const questionRoute = result?.questionRoute || null;
  const formulaWork = questionRoute?.formulaWork || null;
  const routeType = result?.routeType || questionRoute?.public?.type || questionRoute?.type || '';
  const formulaWorkStepCount = Array.isArray(formulaWork?.steps) ? formulaWork.steps.length : 0;
  const guidedFormulaTutoringEnabled = getGuidedFormulaTutoringEnabled(settings);
  const canStart = canStartFormulaTutor(questionRoute);
  const startedTutor = Boolean(settings.startedTutor);

  const debug = {
    guidedFormulaTutoringEnabled,
    hasQuestionRoute: Boolean(questionRoute),
    routeType,
    routeSource: getQuestionRouteSource(result, questionRoute),
    answerMode: startedTutor ? 'guided_formula_tutor' : getAnswerMode(result, questionRoute),
    formulaKey: formulaWork?.formulaKey || formulaWork?.formulaId || '',
    formulaId: formulaWork?.formulaId || '',
    solvingFor: formulaWork?.solveFor || '',
    hasFormulaWork: Boolean(formulaWork),
    formulaWorkStepCount,
    canStartFormulaTutor: canStart,
    startedTutor,
    bypassReason: ''
  };

  debug.bypassReason = getFormulaTutorBypassReason({
    debug,
    result,
    questionRoute,
    formulaWork
  });
  return debug;
}

function getGuidedFormulaTutoringEnabled(settings = {}) {
  if (typeof settings.guidedFormulaTutoringEnabled === 'boolean') return settings.guidedFormulaTutoringEnabled;
  if (typeof settings.studentGuidedFormulaTutoringEnabled === 'boolean') return settings.studentGuidedFormulaTutoringEnabled;
  if (typeof settings.controls?.studentGuidedFormulaTutoringEnabled === 'boolean') {
    return settings.controls.studentGuidedFormulaTutoringEnabled;
  }
  return false;
}

function getQuestionRouteSource(result = {}, questionRoute = null) {
  if (result.routeSource) return String(result.routeSource);
  if (questionRoute?.source) return String(questionRoute.source);
  if (Array.isArray(questionRoute?.toolsUsed) && questionRoute.toolsUsed.length > 0) {
    return String(questionRoute.toolsUsed[0] || '');
  }
  if (questionRoute?.type) return String(questionRoute.type);
  return '';
}

function getAnswerMode(result = {}, questionRoute = null) {
  if (result.answerMode) return String(result.answerMode);
  if (questionRoute?.directAnswer || result.response) return 'direct_answer';
  return 'none';
}

function getFormulaTutorBypassReason({ debug, result, questionRoute, formulaWork }) {
  if (debug.startedTutor) return '';
  if (!debug.guidedFormulaTutoringEnabled) return 'guided_formula_tutoring_disabled';
  if (!questionRoute) {
    return result?.response ? 'direct_answer_path_returned_before_tutor_gate' : 'missing_question_route';
  }
  if (!isFormulaTutorCandidateRoute(questionRoute, debug.routeType)) return 'not_formula_route';
  if (!formulaWork) return 'missing_formula_work';
  if (!Array.isArray(formulaWork.steps) || formulaWork.steps.length === 0) return 'formula_work_has_no_steps';
  if (shouldBypassFormulaTutorForOpenEndedWork(formulaWork)) return 'open_ended_net_force_tutor_step';
  const unsafeStep = getUnsafeStudentTutorStepReasons(formulaWork.steps)[0];
  if (unsafeStep) return unsafeStep.reason;
  if (!debug.canStartFormulaTutor) return 'can_start_formula_tutor_false';
  return '';
}

function isFormulaTutorCandidateRoute(questionRoute = {}, routeType = '') {
  if (questionRoute.formulaWork) return true;
  if (/\bformula\b/.test(String(routeType || ''))) return true;
  return Array.isArray(questionRoute.toolsUsed) &&
    questionRoute.toolsUsed.some((tool) => /\bformula\b/.test(String(tool || '')));
}

function startFormulaTutor({ questionRoute, originalQuestion }) {
  if (!canStartFormulaTutor(questionRoute)) return null;

  const formulaWork = questionRoute.formulaWork;
  const now = new Date().toISOString();
  const graphContext = questionRoute.graphContext || questionRoute.public?.graphContext || null;
  const tutorProblem = {
    tutorProblemId: createTutorProblemId(),
    formulaId: formulaWork.formulaId || '',
    family: formulaWork.family || '',
    solveFor: formulaWork.solveFor || '',
    formula: formulaWork.formula || '',
    variables: clonePlain(formulaWork.variables || {}),
    visualMetadata: clonePlain(formulaWork.visualMetadata || null),
    finalAnswer: clonePlain(formulaWork.finalAnswer || null),
    finalExplanation: String(formulaWork.finalExplanation || ''),
    diagramText: String(formulaWork.diagramText || ''),
    steps: clonePlain(formulaWork.steps),
    currentStepIndex: 0,
    attempts: {},
    completedSteps: [],
    selectedMethod: '',
    calculatorChecks: [],
    startedAt: now,
    updatedAt: now,
    originalQuestion: String(originalQuestion || '')
  };

  if (formulaWork.activityId) {
    tutorProblem.activityId = String(formulaWork.activityId);
    tutorProblem.activityVersion = String(formulaWork.activityVersion || '');
    tutorProblem.activityState = clonePlain(formulaWork.activityState || null);
  }

  if (graphContext) {
    tutorProblem.graphTutorSupport = buildGraphTutorSupport(questionRoute, graphContext);
  }

  return tutorProblem;
}

function answerFormulaTutorStep(currentTutorProblem, studentMessage) {
  const problem = normalizeProblem(currentTutorProblem);
  const message = String(studentMessage || '').trim();

  if (isAmmoniaBalancingProblem(problem)) {
    return handleAmmoniaBalancingAction(problem, message);
  }

  const command = normalizeCommand(message);

  if (command === 'meta_help') {
    const response = withGraphTutorHint(buildMetaHelpResponse(problem), problem, {
      message,
      intent: 'scaffold'
    });
    return {
      response,
      currentTutorProblem: touch(problem),
      completed: false,
      stopped: false
    };
  }

  if (command === 'hint') {
    const hint = withGraphTutorHint(currentHintResponse(problem), problem, {
      message,
      intent: 'scaffold'
    });
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

  if (command === 'stop_and_explain') {
    const response = buildAnswerRequestRedirect(problem);
    return {
      response,
      currentTutorProblem: touch(problem),
      completed: false,
      stopped: false
    };
  }

  if (command === 'show_answer') {
    const response = buildAnswerRequestRedirect(problem);
    return {
      response,
      currentTutorProblem: touch(problem),
      completed: false,
      stopped: false
    };
  }

  if (isGraphWhyTutorCommand(message)) {
    const graphHint = buildGraphTutorHint(problem, problem.graphTutorSupport, {
      message,
      intent: 'why_it_matters',
      target: problem.solveFor
    });
    if (graphHint) {
      const response = [
        graphHint,
        buildFormulaTutorPrompt(problem, { includeIntro: false })
      ].filter(Boolean).join('\n\n');
      return {
        response,
        currentTutorProblem: touch({ ...problem, lastHint: response }),
        completed: false,
        stopped: false
      };
    }
  }

  const step = getCurrentStep(problem);
  if (!step) {
    return {
      response: completionResponse(problem),
      currentTutorProblem: null,
      completedTutorProblem: problem,
      completed: true,
      stopped: false
    };
  }

  const earlyFinalResult = checkEarlyFinalAnswer(problem, step, message);
  if (earlyFinalResult.correct) {
    const completed = touch({
      ...problem,
      completedSteps: addCompletedSteps(problem.completedSteps, [
        step.id || String(problem.currentStepIndex),
        earlyFinalResult.skipStepId || ''
      ]),
      currentStepIndex: problem.steps.length,
      lastHint: ''
    });
    return {
      response: earlyFinalResult.response || completionResponse(completed),
      currentTutorProblem: null,
      completedTutorProblem: completed,
      completed: true,
      stopped: false
    };
  }

  if (looksLikeStuckMessage(message)) {
    const scaffold = withGraphTutorHint(buildStepScaffold(problem, step), problem, {
      message,
      intent: 'scaffold'
    });
    return {
      response: scaffold,
      currentTutorProblem: touch({ ...problem, lastHint: scaffold }),
      completed: false,
      stopped: false
    };
  }

  const result = checkStepAnswer(step, message);
  if (!result.correct) {
    const updated = recordAttempt(problem, step);
    const attempts = getAttemptCount(updated, step);
    const conceptualNudge = buildConceptualNudgeResponse(step, message);
    return {
      response: conceptualNudge || buildWrongAnswerResponse(updated, step, attempts),
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
      completedTutorProblem: advanced,
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
  if (isAmmoniaBalancingProblem(problem)) {
    return problem.activityState?.tableComplete
      ? 'Adjust the coefficients, watch the atom counts, and press Check Balance when you are ready.'
      : 'Build the element table by copying N and H into both REACTANTS and PRODUCTS.';
  }
  const step = getCurrentStep(problem);
  if (!step) return completionResponse(problem);

  const lines = [];
  if (options.includeIntro !== false && problem.solveFor) {
    lines.push(`We are solving for ${problem.solveFor}.`, '');
  }

  lines.push(`Step ${problem.currentStepIndex + 1} of ${problem.steps.length}:`);
  lines.push(step.prompt || 'What should we do next?');

  if (step.type === 'multiple_choice' && Array.isArray(step.choices)) {
    lines.push('', 'Choose one:');
    for (const choice of step.choices) {
      lines.push(`${choice.number}. ${buildChoiceDisplay(problem, step, choice)}`);
    }
    lines.push('', 'Click a choice or type only the number.');
    const clue = buildSolveTargetClue(problem, step);
    if (clue) lines.push('', clue);
  }

  return lines.join('\n');
}

function buildChoiceDisplay(problem, step, choice) {
  if (!isMotionSolveTargetStep(problem, step)) return choice.label;

  const descriptions = {
    speed: 'how fast something moves',
    velocity: 'speed with direction',
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
    speed: [/\bwhat is (?:its|the|their|his|her)?\s*speed\b/i, /\bwhat speed\b/i, /\bhow fast\b/i],
    velocity: [/\bwhat is (?:its|the|their|his|her)?\s*velocity\b/i, /\bwhat velocity\b/i, /\bfind (?:its|the|their|his|her)?\s*velocity\b/i]
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
  const labelKey = labels.join('|');
  return labelKey === 'distance|speed|time' || labelKey === 'distance|time|velocity';
}

function buildFormulaTutorMetadata(currentTutorProblem, options = {}) {
  const problem = normalizeProblem(currentTutorProblem);
  const step = getCurrentStep(problem);
  const completed = options.completed === true;
  const stopped = options.stopped === true;
  const latestStudentReply = String(options.latestStudentReply || '').trim();
  const activity = buildBalancingActivityMetadata(problem);

  if (stopped) {
    return withGraphTutorSupportMetadata({
      active: false,
      completed: false,
      stopped: true,
      tutorCategory: 'formula',
      tutorLabel: 'Formula Tutor',
      tutorProblemId: problem.tutorProblemId || '',
      formulaId: problem.formulaId,
      solveFor: problem.solveFor,
      formula: problem.formula,
      originalQuestion: problem.originalQuestion,
      currentStep: null,
      currentStepIndex: problem.currentStepIndex,
      stepNumber: problem.steps.length ? Math.min(problem.currentStepIndex + 1, problem.steps.length) : 0,
      totalSteps: problem.steps.length,
      latestStudentReply,
      currentHint: problem.lastHint || '',
      visualMetadata: clonePlain(problem.visualMetadata || null),
      selectedMethod: problem.selectedMethod || '',
      knownValues: buildKnownValues(problem),
      work: buildTutorWork(problem, { latestStudentReply }),
      ...(activity ? { activity } : {})
    }, problem);
  }

  if (completed) {
    return withGraphTutorSupportMetadata({
      active: false,
      completed: true,
      tutorCategory: 'formula',
      tutorLabel: 'Formula Tutor',
      tutorProblemId: problem.tutorProblemId || '',
      formulaId: problem.formulaId,
      solveFor: problem.solveFor,
      formula: problem.formula,
      originalQuestion: problem.originalQuestion,
      currentStep: null,
      stepNumber: problem.steps.length,
      totalSteps: problem.steps.length,
      latestStudentReply,
      finalAnswer: problem.finalAnswer,
      finalExplanation: problem.finalExplanation,
      finalAnswerDisplay: problem.finalAnswer?.display || '',
      visualMetadata: clonePlain(problem.visualMetadata || null),
      selectedMethod: problem.selectedMethod || '',
      work: buildTutorWork(problem, { completed: true, latestStudentReply }),
      ...(activity ? { activity } : {})
    }, problem);
  }

  // Keep final answers out of active tutor metadata while preserving the givens from the original problem.
  return withGraphTutorSupportMetadata({
    active: true,
    completed: false,
    tutorCategory: 'formula',
    tutorLabel: 'Formula Tutor',
    tutorProblemId: problem.tutorProblemId || '',
    formulaId: problem.formulaId,
    solveFor: problem.solveFor,
    formula: problem.formula,
    originalQuestion: problem.originalQuestion,
    currentStep: buildCurrentStepMetadata(problem, step),
    currentStepIndex: problem.currentStepIndex,
    stepNumber: problem.currentStepIndex + 1,
    totalSteps: problem.steps.length,
    stepId: step?.id || '',
    stepType: step?.type || '',
    currentStepPrompt: step?.prompt || '',
    latestStudentReply,
    currentHint: problem.lastHint || '',
    completedSteps: Array.isArray(problem.completedSteps) ? [...problem.completedSteps] : [],
    selectedMethod: problem.selectedMethod || '',
    visualMetadata: clonePlain(problem.visualMetadata || null),
    knownValues: buildKnownValues(problem),
    work: buildTutorWork(problem, { latestStudentReply }),
    ...(activity ? { activity } : {})
  }, problem);
}

function buildCurrentStepMetadata(problem, step) {
  if (!step) return null;
  const metadata = {
    id: step.id || '',
    type: step.type || '',
    prompt: step.prompt || '',
    stepNumber: problem.currentStepIndex + 1,
    totalSteps: problem.steps.length
  };
  if (step.suppressFormulaDetails === true) metadata.suppressFormulaDetails = true;
  if (step.suppressKnownValues === true) metadata.suppressKnownValues = true;
  if (step.suppressInlineChoices === true) metadata.suppressInlineChoices = true;
  if (Array.isArray(step.answerChips) && step.answerChips.length > 0) {
    metadata.answerChips = step.answerChips.map((chip) => ({
      label: String(chip?.label || chip?.value || '').trim(),
      value: String(chip?.value || chip?.label || '').trim()
    })).filter((chip) => chip.label && chip.value);
  }
  if (step.type === 'multiple_choice' && Array.isArray(step.choices)) {
    metadata.choices = step.choices.map((choice) => ({
      number: choice.number,
      label: buildChoiceDisplay(problem, step, choice)
    }));
  }
  return metadata;
}

function withGraphTutorSupportMetadata(metadata, problem) {
  if (!isGraphTutorSupport(problem.graphTutorSupport)) return metadata;
  return {
    ...metadata,
    graphTutorSupport: clonePlain(problem.graphTutorSupport)
  };
}

function withGraphTutorHint(response, problem, options = {}) {
  const graphHint = buildGraphTutorHint(problem, problem.graphTutorSupport, {
    message: options.message || '',
    intent: options.intent || 'scaffold',
    target: problem.solveFor
  });
  return graphHint ? [response, '', graphHint].filter(Boolean).join('\n') : response;
}

function isGraphTutorSupport(value) {
  return value &&
    value.aiAllowed === false &&
    value.source === 'approved_knowledge_graph' &&
    Array.isArray(value.connectedConcepts) &&
    Array.isArray(value.prerequisiteConcepts) &&
    Array.isArray(value.commonMisconceptions) &&
    Array.isArray(value.whyItMatters) &&
    Array.isArray(value.graphPaths);
}

function normalizeProblem(problem) {
  const normalized = problem && typeof problem === 'object' ? problem : {};
  const result = {
    tutorProblemId: normalized.tutorProblemId || normalized.problemInstanceId || normalized.sessionProblemId || createTutorProblemId(),
    formulaId: normalized.formulaId || '',
    family: normalized.family || '',
    solveFor: normalized.solveFor || '',
    formula: normalized.formula || '',
    variables: normalized.variables || {},
    visualMetadata: normalized.visualMetadata && typeof normalized.visualMetadata === 'object'
      ? clonePlain(normalized.visualMetadata)
      : null,
    finalAnswer: normalized.finalAnswer || null,
    finalExplanation: normalized.finalExplanation || '',
    diagramText: normalized.diagramText || '',
    steps: Array.isArray(normalized.steps) ? normalized.steps : [],
    currentStepIndex: Number.isInteger(normalized.currentStepIndex) ? normalized.currentStepIndex : 0,
    attempts: normalized.attempts && typeof normalized.attempts === 'object' ? normalized.attempts : {},
    completedSteps: Array.isArray(normalized.completedSteps) ? normalized.completedSteps : [],
    selectedMethod: normalized.selectedMethod || '',
    calculatorChecks: Array.isArray(normalized.calculatorChecks) ? normalized.calculatorChecks : [],
    lastHint: normalized.lastHint || '',
    startedAt: normalized.startedAt || new Date().toISOString(),
    updatedAt: normalized.updatedAt || new Date().toISOString(),
    originalQuestion: normalized.originalQuestion || ''
  };
  if (isGraphTutorSupport(normalized.graphTutorSupport)) {
    result.graphTutorSupport = clonePlain(normalized.graphTutorSupport);
  }
  if (normalized.activityId) {
    result.activityId = String(normalized.activityId);
    result.activityVersion = String(normalized.activityVersion || '');
    result.activityState = clonePlain(normalized.activityState || null);
  }
  return result;
}

function normalizeCommand(message) {
  const normalized = normalizeText(message).replace(/[’']/g, '');
  if (normalized === 'hint') return 'hint';
  if (isMetaHelpCommand(normalized)) return 'meta_help';
  if (normalized === 'restart' || normalized === 'start over' || normalized === 'reset') return 'restart';
  if (normalized === 'stop' || normalized === 'cancel' || normalized === 'exit' || normalized === 'quit' || normalized === 'nevermind' || normalized === 'never mind') return 'stop';
  if (normalized === 'stop and explain' || normalized === 'explain it directly' || normalized === 'i dont like this' || normalized === 'i do not like this') return 'stop_and_explain';
  if (normalized === 'show answer' || normalized === 'answer' || normalized === 'tell me the answer' || normalized === 'just tell me' || normalized === 'give me the answer') return 'show_answer';
  return '';
}

function isGraphWhyTutorCommand(message) {
  const text = normalizeText(message).replace(/[’']/g, '');
  return /^(?:whats the point|what is the point|why does this matter|why is this important|what is this for)$/.test(text);
}

function isMetaHelpCommand(normalized) {
  return /^(?:help|what do i do|what should i do|explain|where is the rpg|show choices again|show the choices again|choices again|repeat|repeat that|say that again|show options again|show the options again)$/.test(normalized);
}

function restartFormulaTutor(problem) {
  return touch({
    ...problem,
    currentStepIndex: 0,
    attempts: {},
    completedSteps: [],
    selectedMethod: '',
    calculatorChecks: [],
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
    attempts >= 2 ? `Not quite yet. ${getStrongerHint(step)}` : `Not quite yet. ${getHint(step)}`,
    '',
    ...buildStepPromptLines(problem, step)
  ];

  if (step.type === 'multiple_choice' && Array.isArray(step.choices)) {
    lines.push('', ...step.choices.map((choice) => `${choice.number}. ${buildChoiceDisplay(problem, step, choice)}`));
    const correctChoice = step.choices.find((choice) => choice.correct);
    if (correctChoice) {
      const choiceDisplay = buildQuotedChoiceDisplay(problem, step, correctChoice);
      lines.push('', step.retryMessage || (attempts >= 2
        ? `Try ${correctChoice.number}, or click “${choiceDisplay}” Type stop to leave the tutor.`
        : `Try ${correctChoice.number}, or click “${choiceDisplay}” Type stop to leave the tutor.`));
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
      : `Not quite yet. ${clue}`,
    '',
    ...buildStepPromptLines(problem, step)
  ];

  if (Array.isArray(step.choices) && step.choices.length > 0) {
    lines.push('', ...step.choices.map((choice) => `${choice.number}. ${buildChoiceDisplay(problem, step, choice)}`));
  }

  if (correctChoice) {
    const choiceDisplay = buildQuotedChoiceDisplay(problem, step, correctChoice);
    lines.push('', step.retryMessage || (attempts >= 2
      ? `Try ${correctChoice.number}, or click “${choiceDisplay}” Type stop to leave the tutor.`
      : `Try ${correctChoice.number}, or click “${choiceDisplay}” Type stop to leave the tutor.`));
  } else {
    lines.push('', 'Try again, type hint for help, or type stop to leave the tutor.');
  }

  return lines.join('\n');
}

function buildQuotedChoiceDisplay(problem, step, choice) {
  const display = `${choice.number}. ${buildChoiceDisplay(problem, step, choice)}`.trim();
  return /[.!?]$/.test(display) ? display : `${display}.`;
}

function buildStepPromptLines(problem, step) {
  return [
    `Step ${problem.currentStepIndex + 1} of ${problem.steps.length}:`,
    step?.prompt || 'What should we do next?'
  ];
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
  const calculatorChecks = addCalculatorCheck(problem.calculatorChecks, step, result, problem);
  const branched = buildBranchedProblem(problem, step, result, completedSteps, calculatorChecks);
  if (branched) return touch(branched);
  const skipOffset = result.skipNextStep ? 2 : 1;
  return touch({
    ...problem,
    completedSteps,
    calculatorChecks,
    currentStepIndex: problem.currentStepIndex + skipOffset,
    lastHint: ''
  });
}

function addCalculatorCheck(existingChecks, step, result = {}, problem = null) {
  const checks = Array.isArray(existingChecks) ? [...existingChecks] : [];
  if (step?.type !== 'calculation') return checks;

  const calculatorCheck = result.calculatorCheck || buildCalculatorCheckFromStep(step, problem);
  if (!calculatorCheck) return checks;

  const stepId = step.id || 'calculate';
  const withoutExisting = checks.filter((check) => check?.stepId !== stepId);
  withoutExisting.push({ stepId, ...calculatorCheck });
  return withoutExisting;
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
  const combinedFinalResult = checkCombinedFinalAnswer(step, message);
  if (combinedFinalResult.correct) return combinedFinalResult;
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
  const normalizedChoiceNumber = normalizeMultipleChoiceNumber(text);
  const correctChoices = (step.choices || []).filter((choice) => choice.correct);
  const numberChoice = correctChoices.find((choice) => normalizedChoiceNumber === String(choice.number));
  if (numberChoice) return buildMultipleChoiceResult(numberChoice);

  const labelChoice = correctChoices.find((choice) => normalizeFormulaText(choice.label) === normalized);
  if (labelChoice) return buildMultipleChoiceResult(labelChoice);

  if (step.expected && normalizeFormulaText(step.expected) === normalized) {
    return { correct: true, selectedChoiceLabel: step.expected, selectedChoiceValue: step.expected };
  }
  if (Array.isArray(step.acceptedAnswers) && matchesAcceptedAnswer(step.acceptedAnswers, text, {
    allowContains: step.allowAcceptedAnswerContains === true
  })) return { correct: true };
  if (step.acceptNumericAnswer === true && matchesMultipleChoiceNumericAnswer(step, text)) return { correct: true };
  if (/\bforce\b/.test(normalizeText(text)) && /\bmass\b/.test(normalizeText(text)) && /\bacceleration\b/.test(normalizeText(text))) {
    return { correct: true };
  }

  return { correct: false };
}

function buildMultipleChoiceResult(choice) {
  return {
    correct: true,
    selectedChoiceNumber: choice.number,
    selectedChoiceLabel: choice.label,
    selectedChoiceValue: choice.value || choice.label
  };
}

function buildBranchedProblem(problem, step, result, completedSteps, calculatorChecks) {
  const branch = findStepBranch(step, result);
  if (!branch) return null;
  const methodStep = clonePlain(step);
  const branchSteps = Array.isArray(branch.steps) ? clonePlain(branch.steps) : [];
  return {
    ...problem,
    steps: [methodStep, ...branchSteps],
    currentStepIndex: 1,
    completedSteps,
    calculatorChecks,
    selectedMethod: branch.selectedMethod || result.selectedChoiceValue || result.selectedChoiceLabel || '',
    formula: branch.formula || problem.formula,
    visualMetadata: branch.visualMetadata && typeof branch.visualMetadata === 'object'
      ? clonePlain(branch.visualMetadata)
      : problem.visualMetadata,
    lastHint: ''
  };
}

function findStepBranch(step, result = {}) {
  const branches = Array.isArray(step?.branchPaths) ? step.branchPaths : [];
  if (branches.length === 0) return null;
  const candidates = [
    result.selectedChoiceValue,
    result.selectedChoiceLabel,
    result.selectedChoiceNumber
  ].map(normalizeFormulaText).filter(Boolean);

  return branches.find((branch) => {
    const branchCandidates = [
      branch.choiceValue,
      branch.choiceLabel,
      branch.selectedMethod,
      branch.id,
      branch.choiceNumber
    ].map(normalizeFormulaText).filter(Boolean);
    return branchCandidates.some((candidate) => candidates.includes(candidate));
  }) || null;
}

function matchesMultipleChoiceNumericAnswer(step, message) {
  const expectedValue = Number(step?.expectedValue);
  if (!Number.isFinite(expectedValue)) return false;

  const calculatorCheck = checkCalculatorExpression(step, message);
  if (calculatorCheck) {
    return numbersClose(calculatorCheck.value, expectedValue) ||
      matchesRoundedNumber(String(calculatorCheck.value), expectedValue) ||
      matchesRoundedNumber(calculatorCheck.displayValue, expectedValue);
  }

  const answerValue = extractNumber(message);
  return numbersClose(answerValue, expectedValue) || matchesRoundedNumber(message, expectedValue);
}

function checkEarlyFinalAnswer(problem, step, message) {
  if (step?.acceptFinalAnswer !== true) return { correct: false };
  if (!matchesProblemFinalAnswer(problem, step, message)) return { correct: false };
  return {
    correct: true,
    response: completionResponse(problem),
    skipStepId: step.skipStepIdOnFinalAnswer || ''
  };
}

function matchesProblemFinalAnswer(problem, step, message) {
  const acceptedValues = Array.isArray(step?.acceptedFinalValues)
    ? step.acceptedFinalValues
    : [];
  const finalValue = Number(problem?.finalAnswer?.value);
  const expectedValues = [
    ...acceptedValues,
    ...(Number.isFinite(finalValue) ? [finalValue] : [])
  ]
    .map((value) => Number(value))
    .filter((value, index, values) => Number.isFinite(value) && values.indexOf(value) === index);

  if (expectedValues.length === 0) return false;

  const answerNumbers = extractNumberTokens(message);
  return expectedValues.some((expectedValue) => {
    return answerNumbers.some((token) => numberTokenMatchesExpected(token, expectedValue));
  });
}

function normalizeMultipleChoiceNumber(message) {
  const text = String(message || '')
    .trim()
    .replace(/[“”‘’]/g, '')
    .replace(/^[\s"'`([{<]+/, '')
    .replace(/[\s"'`)\]}>,.;:!?\\/]+$/, '')
    .trim();
  return /^\d+$/.test(text) ? text : '';
}

function checkQuantity(step, message) {
  const expectedValue = Number(step.expectedValue);
  const answerValue = extractNumber(message);
  const expectedMatches = numbersClose(answerValue, expectedValue) ||
    matchesRoundedNumber(message, expectedValue);
  const originalMatches = matchesOriginalQuantity(step, message);
  const convertedQuantityMatches = matchesConvertedQuantity(step, message);
  if (
    !expectedMatches &&
    !originalMatches &&
    !convertedQuantityMatches
  ) {
    return { correct: false };
  }

  const hasUnit = hasExpectedUnit(message, step.expectedUnit);
  const skipConversionStep = Boolean(
    step.skipConversionStepOnConvertedAnswer &&
    step.conversionStepId &&
    !originalMatches &&
    (expectedMatches || convertedQuantityMatches)
  );
  const conversionResponse = buildQuantityConversionResponse(step, message, {
    originalMatches,
    skipConversionStep
  });
  if (conversionResponse) {
    return {
      correct: true,
      response: conversionResponse,
      skipNextStep: skipConversionStep,
      skipStepId: skipConversionStep ? step.conversionStepId : ''
    };
  }

  return {
    correct: true,
    unitReminder: Boolean(step.expectedUnit && !hasUnit)
  };
}

function checkCalculation(step, message) {
  if (step.acceptCombinedFinalAnswer === true) {
    const combinedFinalResult = checkCombinedFinalAnswer(step, message);
    if (combinedFinalResult.correct) {
      return {
        ...combinedFinalResult,
        skipNextStep: Boolean(step.skipNextStepOnCombinedFinalAnswer),
        skipStepId: step.skipStepIdOnCombinedFinalAnswer || ''
      };
    }
  }

  const expectedValue = Number(step.expectedValue);
  const calculatorCheck = checkCalculatorExpression(step, message);
  if (calculatorCheck) {
    const displayedExpressionMatches = matchesDisplayedCalculationValue(step, calculatorCheck.value, calculatorCheck.displayValue);
    const correct = numbersClose(calculatorCheck.value, expectedValue) ||
      matchesRoundedNumber(String(calculatorCheck.value), expectedValue) ||
      matchesRoundedNumber(calculatorCheck.displayValue, expectedValue) ||
      displayedExpressionMatches ||
      matchesAcceptedAlternateCalculationValue(step, calculatorCheck.value, calculatorCheck.displayValue);
    return {
      correct,
      calculatorCheck,
      response: correct ? String(step.correctResponse || '').trim() : '',
      skipNextStep: correct && step.skipNextStepOnCorrect === true,
      skipStepId: correct ? String(step.skipStepIdOnCorrect || '') : ''
    };
  }

  const answerValue = extractNumber(message);
  const correct = numbersClose(answerValue, expectedValue) ||
    matchesRoundedNumber(message, expectedValue) ||
    matchesDisplayedCalculationValue(step, answerValue, message) ||
    matchesAcceptedAlternateCalculationValue(step, answerValue, message) ||
    (step.acceptAnyNumberInAnswer === true && messageIncludesExpectedNumber(message, expectedValue));
  return {
    correct,
    calculatorCheck: correct ? buildCalculatorCheckFromStep(step) : null,
    response: correct ? String(step.correctResponse || '').trim() : '',
    skipNextStep: correct && step.skipNextStepOnCorrect === true,
    skipStepId: correct ? String(step.skipStepIdOnCorrect || '') : ''
  };
}

function checkCombinedFinalAnswer(step, message) {
  const combined = step?.combinedFinalAnswer;
  const expectedValues = Array.isArray(combined?.values) ? combined.values : [];
  if (expectedValues.length === 0) return { correct: false };

  const answerNumbers = extractNumberTokens(message);
  if (answerNumbers.length < expectedValues.length) return { correct: false };

  const usedIndexes = new Set();
  for (const expected of expectedValues) {
    const expectedValue = Number(expected?.value);
    if (!Number.isFinite(expectedValue)) return { correct: false };

    const matchIndex = answerNumbers.findIndex((answer, index) => {
      return !usedIndexes.has(index) && numberTokenMatchesExpected(answer, expectedValue);
    });
    if (matchIndex === -1) return { correct: false };
    usedIndexes.add(matchIndex);
  }

  return {
    correct: true,
    response: String(combined.response || '').trim()
  };
}

function matchesAcceptedAlternateCalculationValue(step, answerValue, answerDisplay = '') {
  const alternates = Array.isArray(step?.acceptedAlternateValues) ? step.acceptedAlternateValues : [];
  return alternates.some((alternate) => {
    const expectedValue = Number(alternate?.value ?? alternate);
    if (!Number.isFinite(expectedValue)) return false;
    return numberTokenMatchesExpected({ value: answerValue, text: String(answerDisplay || answerValue) }, expectedValue);
  });
}

function matchesDisplayedCalculationValue(step, actualValue, actualDisplay = '') {
  const expression = extractCalculationExpression(step);
  if (!expression) return false;

  const mathResult = tryMathOnly(expression);
  if (!mathResult || !Number.isFinite(Number(mathResult.value))) return false;
  return numbersClose(actualValue, mathResult.value) ||
    matchesRoundedNumber(String(actualValue), mathResult.value) ||
    matchesRoundedNumber(actualDisplay, mathResult.value);
}

function checkAcceptedFinalValue(step, message) {
  if (!step || !Number.isFinite(Number(step.acceptFinalValue))) return { correct: false };
  const answerValue = extractNumber(message);
  if (!numbersClose(answerValue, Number(step.acceptFinalValue)) && !matchesRoundedNumber(message, Number(step.acceptFinalValue))) return { correct: false };

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

function buildQuantityConversionResponse(step, message, options = {}) {
  if (!step?.conversionReminder || !step?.originalDisplay) return '';
  const label = quantityLabelFromStep(step);
  const acceptedDisplay = options.originalMatches ? step.originalDisplay : step.expectedDisplay;
  const firstLine = label
    ? `Correct. The ${label} is ${acceptedDisplay}.`
    : `Correct. ${acceptedDisplay}.`;
  if (options.skipConversionStep) return firstLine;
  return `${firstLine} ${step.conversionReminder}`;
}

function quantityLabelFromStep(step) {
  return String(step?.id || '')
    .replace(/^identify_/, '')
    .replace(/_/g, ' ')
    .trim();
}

function matchesOriginalQuantity(step, message) {
  if (!Number.isFinite(Number(step?.originalValue))) return false;
  const quantity = extractQuantityWithKnownUnit(message, step.originalUnit || step.expectedUnit);
  if (quantity && quantity.unit !== step.originalUnit) return false;

  const answerValue = extractNumber(message);
  return numbersClose(answerValue, Number(step.originalValue)) || matchesRoundedNumber(message, Number(step.originalValue));
}

function matchesConvertedQuantity(step, message) {
  const expectedValue = Number(step?.expectedValue);
  if (!Number.isFinite(expectedValue) || !step?.expectedUnit) return false;

  const quantity = extractQuantityWithKnownUnit(message, step.expectedUnit);
  if (!quantity) return false;

  const converted = convertQuantityValue(quantity.value, quantity.unit, step.expectedUnit);
  return numbersClose(converted, expectedValue) || matchesRoundedNumber(String(converted), expectedValue);
}

function extractQuantityWithKnownUnit(message, expectedUnit) {
  const unitDefs = unitDefsForExpectedUnit(expectedUnit);
  if (!unitDefs) return null;
  return findNumberWithUnit(normalizeNumberWords(String(message || '')), unitDefs);
}

function unitDefsForExpectedUnit(expectedUnit) {
  const unit = normalizeUnitText(expectedUnit);
  if (['m', 'km', 'cm', 'mile', 'ft'].includes(unit)) return DISTANCE_UNITS;
  if (['s', 'min', 'hr'].includes(unit)) return TIME_UNITS;
  if (['m/s', 'km/hr', 'mph', 'ft/s'].includes(unit)) return VELOCITY_UNITS;
  if (['kg', 'g'].includes(unit)) return MASS_UNITS;
  if (['ml', 'l', 'cm3'].includes(unit)) return VOLUME_UNITS;
  return null;
}

function convertQuantityValue(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;

  const normalizedTo = normalizeUnitText(toUnit);
  const normalizedFrom = normalizeUnitText(fromUnit);
  if (['m', 'km', 'cm', 'mile', 'ft'].includes(normalizedTo)) return convertDistance(value, normalizedFrom, normalizedTo);
  if (['s', 'min', 'hr'].includes(normalizedTo)) return convertTime(value, normalizedFrom, normalizedTo);
  if (normalizedTo === 'kg') return massToKg({ value, unit: normalizedFrom });
  if (normalizedTo === 'g') return massToGrams({ value, unit: normalizedFrom });
  if (normalizedTo === 'ml') return volumeToML({ value, unit: fromUnit });
  if (normalizedTo === 'l') {
    const ml = volumeToML({ value, unit: fromUnit });
    return Number.isFinite(ml) ? ml / 1000 : null;
  }
  return null;
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

function messageIncludesExpectedNumber(message, expected) {
  if (!Number.isFinite(expected)) return false;
  return extractNumbers(message).some((value) => numbersClose(value, expected));
}

function extractNumbers(message) {
  return extractNumberTokens(message).map((token) => token.value);
}

function extractNumberTokens(message) {
  const normalized = normalizeNumberWords(String(message || ''))
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '')
    .trim();
  const matches = normalized.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g) || [];
  return matches
    .map((text) => ({ text, value: Number(text) }))
    .filter((token) => Number.isFinite(token.value));
}

function numberTokenMatchesExpected(token, expected) {
  const value = Number(token?.value);
  if (!Number.isFinite(value) || !Number.isFinite(expected)) return false;
  if (numbersClose(value, expected)) return true;

  const decimalPlaces = decimalPlacesForNumberToken(token?.text);
  if (decimalPlaces == null || decimalPlaces < 1 || decimalPlaces > 4) return false;
  const roundedExpected = Number(expected.toFixed(decimalPlaces));
  const tolerance = decimalPlaces <= 2 ? 10 ** (-(decimalPlaces + 2)) : 1e-9;
  return Math.abs(value - roundedExpected) <= tolerance;
}

function decimalPlacesForNumberToken(value) {
  const text = String(value || '').trim();
  if (!text.includes('.')) return null;
  return text.split('.')[1].length;
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

function matchesRoundedNumber(message, expected) {
  if (!Number.isFinite(expected)) return false;
  const decimalPlaces = firstAnswerDecimalPlaces(message);
  if (decimalPlaces == null || decimalPlaces < 1 || decimalPlaces > 4) return false;

  const answerValue = extractNumber(message);
  if (!Number.isFinite(answerValue)) return false;

  const roundedExpected = Number(expected.toFixed(decimalPlaces));
  const tolerance = decimalPlaces <= 2 ? 10 ** (-(decimalPlaces + 2)) : 1e-9;
  return Math.abs(answerValue - roundedExpected) <= tolerance;
}

function firstAnswerDecimalPlaces(message) {
  const normalized = normalizeNumberWords(String(message || ''))
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '')
    .trim();
  const match = normalized.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/);
  if (!match || !match[0].includes('.')) return null;
  return match[0].split('.')[1].length;
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

function matchesAcceptedAnswer(acceptedAnswers, message, options = {}) {
  const normalized = normalizeFormulaText(message);
  if (acceptedAnswers.some((answer) => normalizeFormulaText(answer) === normalized)) return true;
  if (options.allowContains !== true) return false;

  const normalizedMessage = normalizeFormulaText(message);
  return acceptedAnswers.some((answer) => {
    const normalizedAnswer = normalizeFormulaText(answer);
    return normalizedAnswer.length >= 5 && normalizedMessage.includes(normalizedAnswer);
  });
}

function buildConceptualNudgeResponse(step, message) {
  if (!Array.isArray(step?.conceptualNudges)) return '';

  for (const nudge of step.conceptualNudges) {
    if (Array.isArray(nudge?.answers) && matchesAcceptedAnswer(nudge.answers, message)) {
      return String(nudge.response || '').trim();
    }
  }
  return '';
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
  const looksLikeConversionQuestion = /^convert\b/i.test(text) &&
    /\bto\b/i.test(text) &&
    /-?\d+(?:\.\d+)?/.test(text) &&
    /\b(?:mm|millimeters?|cm|centimeters?|m|meters?|km|kilometers?|mg|milligrams?|cg|centigrams?|g|grams?|kg|kilograms?|ml|milliliters?|l|liters?|s|sec|seconds?|ks|c|f|k|kelvin)\b/i.test(normalized);
  if (looksLikeConversionQuestion) return true;

  const startsLikeWordProblem = /^(a|an|the|find|calculate|solve|determine|how|what)\b/i.test(text);
  const hasQuestionMark = /\?/.test(text);
  const asksForTarget = /\b(?:what|find|calculate|solve|determine|how)\b.+\b(mass|density|volume|speed|distance|time|force|acceleration|velocity|current|resistance|voltage|power|energy|work|momentum|wavelength|frequency)\b/i.test(text) ||
    /\bhow\s+fast\b/i.test(text);
  const formulaKeywordMatches = normalized.match(/\b(mass|density|volume|speed|distance|time|force|acceleration|velocity|current|resistance|voltage|power|energy|work|momentum|wavelength|frequency|travels?|moves?|moving|flies|fly|circuit|block|object|train|car|runner|student|machine|jet)\b/g) || [];
  const unitValueMatches = normalized.match(/-?\d+(?:\.\d+)?\s*(?:kg|kilograms?|g|grams?|ml|milliliters?|l|liters?|cm3|m\/s2|m\/s|km\/hr|km\/h|kilometers? per hour|mile\/hr|mi\/hr|miles? per hour|mph|ft\/s|m|meters?|km|kilometers?|mile|miles|hr|hrs|hours?|h|minutes?|mins?|min|seconds?|secs?|sec|s|a|amps?|amperes?|n|newtons?|v|volts?|ohms?|ω|j|joules?|w|watts?|hz|hertz)\b/g) || [];

  if (hasQuestionMark && (asksForTarget || unitValueMatches.length >= 1 || formulaKeywordMatches.length >= 2)) return true;
  if (startsLikeWordProblem && asksForTarget && (unitValueMatches.length >= 1 || formulaKeywordMatches.length >= 2)) return true;
  if (unitValueMatches.length >= 2 && asksForTarget) return true;
  if (startsLikeWordProblem && unitValueMatches.length >= 2 && formulaKeywordMatches.length >= 2) return true;
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
  return step ? buildStepScaffold(problem, step) : completionResponse(problem);
}

function buildMetaHelpResponse(problem) {
  const prompt = buildFormulaTutorPrompt(problem, { includeIntro: false });
  return [
    'This is Guided Formula Tutor mode. It works like a typed worksheet: I ask one question at a time, and your answer moves us to the next step.',
    prompt
  ].filter(Boolean).join('\n\n');
}

function buildAnswerRequestRedirect(problem) {
  const prompt = buildFormulaTutorPrompt(problem, { includeIntro: false });
  return [
    'I can help, but I will not give the final answer while this Guided Formula Tutor is still active.',
    'Use the current step below, or type hint for help with this step.',
    prompt
  ].filter(Boolean).join('\n\n');
}

function looksLikeStuckMessage(message) {
  const text = normalizeText(message).replace(/[’']/g, '');
  return /^(?:i dont get it|i do not get it|i dont understand|i do not understand|im stuck|i am stuck|stuck|help|holp|this is a bad loop|bad loop|i did|idk|i dont know|i do not know|i dont know what they are asking|i do not know what they are asking|what are they asking|what is it asking)$/.test(text);
}

function buildStepScaffold(problem, step) {
  if (isSolveTargetStep(step)) return buildSolveTargetScaffold(problem, step);
  if (step.type === 'multiple_choice' && Array.isArray(step.choices)) return buildChoiceScaffold(problem, step);
  if (step.type === 'quantity') return buildQuantityScaffold(problem, step);
  if (step.type === 'calculation') return buildCalculationScaffold(step);

  const hint = getHint(step);
  return [
    `You are trying to answer this step: ${step.prompt || 'What should we do next?'}`,
    hint,
    'Next action: type one short answer for that step.'
  ].join('\n');
}

function buildSolveTargetScaffold(problem, step) {
  const choices = Array.isArray(step.choices) ? step.choices : [];
  const choiceLine = choices.length > 0
    ? `Your choices are: ${choices.map((choice) => `${choice.number}. ${buildChoiceDisplay(problem, step, choice)}`).join(', ')}.`
    : '';
  const clue = buildSolveTargetClue(problem, step) || `The question is asking you to find ${problem.solveFor || 'the unknown value'}.`;
  const correctChoice = choices.find((choice) => choice.correct);

  return [
    'You are trying to identify what the question asks you to find.',
    clue,
    choiceLine,
    correctChoice
      ? `Next action: type ${correctChoice.number} for ${correctChoice.label}.`
      : `Next action: type ${problem.solveFor || 'the value being asked for'}.`
  ].filter(Boolean).join('\n');
}

function buildChoiceScaffold(problem, step) {
  const choices = step.choices || [];
  const correctChoice = choices.find((choice) => choice.correct);
  const choiceLine = choices.map((choice) => `${choice.number}. ${buildChoiceDisplay(problem, step, choice)}`).join(', ');
  const hint = getHint(step);

  return [
    'You are trying to choose the formula or idea for this step.',
    choiceLine ? `Your choices are: ${choiceLine}.` : '',
    hint,
    correctChoice
      ? `Next action: type ${correctChoice.number} for ${correctChoice.label}.`
      : 'Next action: type the choice that matches the values in the problem.'
  ].filter(Boolean).join('\n');
}

function buildQuantityScaffold(problem, step) {
  const variable = findVariableForStep(step, problem.variables || {});
  const label = variable.label || 'this value';
  const display = step.originalDisplay || buildExpectedQuantityDisplay(step) || variable.display || step.expectedDisplay || '';
  const hint = getHint(step);
  const sourceDisplay = String(step.sourceDisplay || '').trim();
  const answerDisplay = buildExpectedQuantityDisplay(step) || variable.display || step.expectedDisplay || '';

  if (step.conversionDisplay) {
    return [
      `You are trying to identify the value for ${label}.`,
      hint,
      display ? `Next action: type ${display}.` : 'Next action: copy the matching number and unit from the question.'
    ].join('\n');
  }

  if (sourceDisplay) {
    return [
      `You are trying to identify the value for ${label}.`,
      `Use total ${label}: ${sourceDisplay}.`,
      answerDisplay ? `Next action: type ${answerDisplay}.` : 'Next action: type the total value.'
    ].join('\n');
  }

  return [
    `You are trying to identify the value for ${label}.`,
    display ? `In the question, ${label} is ${display}.` : hint,
    display ? `Next action: type ${display}.` : 'Next action: copy the matching number and unit from the question.'
  ].join('\n');
}

function buildCalculationScaffold(step) {
  const expression = extractCalculationExpression(step);
  const hint = getHint(step);

  return [
    'You are trying to do the arithmetic after substitution.',
    expression ? `Calculate this: ${expression}.` : hint,
    expression ? 'Next action: type just the number you get.' : 'Next action: do that operation and type the result.'
  ].join('\n');
}

function extractCalculationExpression(step) {
  if (step?.calculationExpression) return String(step.calculationExpression).trim();

  const prompt = String(step?.prompt || '');
  const match = prompt.match(/What is\s+(.+?)\?$/i);
  if (match) return match[1].trim();
  const useMatch = prompt.match(/\bUse\s+[^=]+=\s*(.+?)\.?$/i);
  return useMatch ? useMatch[1].trim() : '';
}

function checkCalculatorExpression(step, message) {
  const raw = String(message || '').trim();
  if (!/[+\-*/^×÷]/.test(raw)) return null;

  const mathResult = tryMathOnly(raw);
  if (!mathResult) return null;
  return buildCalculatorCheck(mathResult, step);
}

function buildCalculatorCheckFromStep(step, problem = null) {
  const expression = extractCalculationExpression(step);
  if (!expression) return null;

  const mathResult = tryMathOnly(expression);
  if (!mathResult) return null;
  return buildCalculatorCheck(mathResult, step, problem);
}

function buildCalculatorCheck(mathResult, step, problem = null) {
  if (!mathResult || !Number.isFinite(Number(mathResult.value))) return null;

  const displayValue = formatCalculatorCheckValue(mathResult.value, step, problem);
  const displayExpression = step?.calculationExpression
    ? formatCalculatorExpression(step.calculationExpression)
    : mathResult.displayExpression || formatCalculatorExpression(mathResult.expression);
  return {
    expression: mathResult.expression || '',
    displayExpression,
    value: mathResult.value,
    displayValue,
    display: `${displayExpression} = ${displayValue}`
  };
}

function formatCalculatorCheckValue(value, step, problem = null) {
  const stepDisplayValue = firstNumber(step?.expectedDisplay);
  if (stepDisplayValue) return stepDisplayValue;

  const finalAnswerDisplay = problem?.finalAnswer?.display || '';
  const answerDisplayValue = firstNumber(finalAnswerDisplay);
  if (answerDisplayValue && !finalAnswerDisplay.includes('=')) return answerDisplayValue;

  if (answerDisplayValue) return answerDisplayValue;
  return formatNumber(value);
}

function firstNumber(value) {
  const match = String(value || '').match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/);
  return match ? match[0] : '';
}

function formatCalculatorExpression(value) {
  return String(value || '')
    .replace(/\^2\b/g, '²')
    .replace(/\^3\b/g, '³')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/-/g, '−');
}

function buildKnownValues(problem) {
  const variables = problem.variables && typeof problem.variables === 'object' ? problem.variables : {};
  const knownValues = [];
  const seen = new Set();

  for (const step of problem.steps) {
    if (!step || step.type !== 'quantity') continue;

    const variable = findVariableForStep(step, variables);
    addKnownValue(knownValues, seen, {
      label: variable.label,
      symbol: variable.symbol,
      display: step.conversionDisplay || variable.display || step.expectedDisplay || ''
    });
  }

  if (knownValues.length > 0) return knownValues;

  for (const [label, variable] of Object.entries(variables)) {
    if (!label || normalizeText(label) === normalizeText(problem.solveFor)) continue;
    addKnownValue(knownValues, seen, {
      label,
      symbol: variable?.symbol || '',
      display: variable?.display || ''
    });
  }

  return knownValues;
}

function addKnownValue(knownValues, seen, value) {
  const label = String(value?.label || '').trim();
  const display = String(value?.display || '').trim();
  if (!label || !display) return;

  const symbol = String(value?.symbol || '').trim();
  const key = `${normalizeText(label)}|${normalizeText(symbol)}|${normalizeText(display)}`;
  if (seen.has(key)) return;
  seen.add(key);
  knownValues.push({ label, symbol, display });
}

function buildTutorWork(problem, options = {}) {
  const completed = options.completed === true;
  const completedSteps = Array.isArray(problem.completedSteps) ? problem.completedSteps : [];
  const calculationStep = findRelevantCalculationStep(problem, completed);
  const calculationDone = completed || (calculationStep?.id && completedSteps.includes(calculationStep.id));
  const atCalculation = calculationStep && problem.currentStepIndex >= problem.steps.indexOf(calculationStep);
  const showCalculationWork = completed || calculationDone || atCalculation;
  const calculatorCheck = calculationDone ? findCalculatorCheck(problem, calculationStep) : null;
  const finalAnswer = completed ? buildFinalAnswerDisplay(problem) : '';
  const step = getCurrentStep(problem);
  const work = {
    tutorProblemId: problem.tutorProblemId || '',
    originalQuestion: problem.originalQuestion || '',
    solveFor: problem.solveFor || '',
    currentStep: completed ? null : buildCurrentStepMetadata(problem, step),
    stepNumber: completed ? problem.steps.length : problem.currentStepIndex + 1,
    totalSteps: problem.steps.length,
    formula: problem.formula || '',
    visualMetadata: clonePlain(problem.visualMetadata || null),
    completedSteps: [...completedSteps],
    selectedMethod: problem.selectedMethod || '',
    knownValues: buildKnownValues(problem),
    substitution: showCalculationWork ? buildSubstitutionDisplay(problem, calculationStep, { completed }) : '',
    calculatorCheck,
    latestStudentReply: String(options.latestStudentReply || '').trim(),
    finalAnswer,
    answer: finalAnswer,
    isComplete: completed
  };
  const activity = buildBalancingActivityMetadata(problem);
  if (activity) work.activity = activity;
  return work;
}

function findRelevantCalculationStep(problem, completed = false) {
  const calculationSteps = getCalculationSteps(problem);
  if (calculationSteps.length === 0) return null;
  if (completed) return calculationSteps[calculationSteps.length - 1];

  const currentStep = getCurrentStep(problem);
  if (currentStep?.type === 'calculation') return currentStep;

  for (let index = Math.min(problem.currentStepIndex, problem.steps.length - 1); index >= 0; index -= 1) {
    const step = problem.steps[index];
    if (step?.type === 'calculation') return step;
  }

  return null;
}

function getCalculationSteps(problem) {
  return Array.isArray(problem.steps)
    ? problem.steps.filter((step) => step?.type === 'calculation')
    : [];
}

function findCalculatorCheck(problem, calculationStep) {
  const stepId = calculationStep?.id || '';
  const checks = Array.isArray(problem.calculatorChecks) ? problem.calculatorChecks : [];
  const check = checks.find((item) => item?.stepId === stepId) || buildCalculatorCheckFromStep(calculationStep, problem);
  return normalizeCalculatorCheckDisplay(check, calculationStep, problem);
}

function normalizeCalculatorCheckDisplay(check, calculationStep, problem) {
  if (!check) return null;

  const displayValue = formatCalculatorCheckValue(check.value, calculationStep, problem);
  const displayExpression = check.displayExpression || formatCalculatorExpression(check.expression);
  return {
    ...check,
    displayExpression,
    displayValue,
    display: `${displayExpression} = ${displayValue}`
  };
}

function buildSubstitutionDisplay(problem, step, options = {}) {
  if (!step) return '';
  if (options.completed === true && isDistanceDisplacementFormula(problem)) return buildDistanceDisplacementSubstitution(problem);
  return extractSubstitutionDisplay(step);
}

function isDistanceDisplacementFormula(problem) {
  return [
    'distance_displacement',
    'distance_displacement_2d',
    'distance_displacement_closed_loop',
    'distance_displacement_special_case',
    'distance_displacement_pool_lengths'
  ].includes(problem.formulaId);
}

function buildDistanceDisplacementSubstitution(problem) {
  return getCalculationSteps(problem)
    .map((step) => extractSubstitutionDisplay(step))
    .filter(Boolean)
    .join('; ');
}

function extractSubstitutionDisplay(step) {
  if (step?.substitution) return String(step.substitution).trim();

  const prompt = String(step?.prompt || '').trim();
  const match = prompt.match(/Now substitute:\s*(.+?)\.\s*What is\b/i);
  if (match) return match[1].trim();
  const useMatch = prompt.match(/\bUse\s+([^.?]+?=\s*.+?)\.?$/i);
  if (useMatch) return useMatch[1].trim();
  return '';
}

function buildFinalAnswerDisplay(problem) {
  const display = expandTutorFinalAnswerDirection(problem.finalAnswer?.display || '', problem);
  if (isAmmoniaBalancingProblem(problem)) return display;
  if (display.includes('=')) return display;
  if (problem.solveFor && display) return `${problem.solveFor} = ${display}`;
  return display;
}

function expandTutorFinalAnswerDirection(display, problem) {
  if (problem.formulaId !== 'distance_displacement_2d') return display;
  const directionNames = {
    NE: 'northeast',
    NW: 'northwest',
    SE: 'southeast',
    SW: 'southwest'
  };
  return String(display || '').replace(/\b(NE|NW|SE|SW)\b/g, (match) => directionNames[match] || match);
}

function findVariableForStep(step, variables) {
  const stepId = String(step.id || '');
  const movementMatch = stepId.match(/^identify_(movement\d+)$/i);
  if (movementMatch && variables[movementMatch[1]]) {
    const variable = variables[movementMatch[1]];
    return {
      label: movementMatch[1].replace(/movement/i, 'movement '),
      symbol: variable?.symbol || '',
      display: variable?.display || step.expectedDisplay || ''
    };
  }

  const normalizedId = normalizeText(stepId.replace(/_/g, ' '));
  const expectedDisplay = String(step.expectedDisplay || '').trim();

  for (const [label, variable] of Object.entries(variables)) {
    const normalizedLabel = normalizeText(label);
    if (!normalizedLabel || normalizedLabel.length < 2) continue;
    if (normalizedId.split(' ').includes(normalizedLabel)) {
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
  if (isDistanceDisplacementFormula(problem) && problem.finalAnswer?.distance && problem.finalAnswer?.displacement) {
    lines.push(`Correct. Distance = ${problem.finalAnswer.distance}. Displacement = ${expandTutorFinalAnswerDirection(problem.finalAnswer.displacement, problem)}.`);
  } else if (display.includes('=')) {
    lines.push(`Correct. ${display}.`);
  } else if (problem.solveFor && display) {
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
  getFormulaTutorDecisionDebug,
  isLikelyNewFormulaQuestionDuringTutor,
  startFormulaTutor
};
