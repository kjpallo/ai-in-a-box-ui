const {
  getUnsafeStudentTutorStepReasons
} = require('../studentTutorSafety');

const SAFE_CONCEPT_CHOICE_STEP_TYPES = new Set([
  'choice',
  'multiple_choice',
  'controlled_choice',
  'button_choice',
  'buttons'
]);

function canStartConceptTutor(pattern) {
  return getConceptTutorStartBlockers(pattern).length === 0;
}

function getConceptTutorStartBlockers(pattern) {
  if (!pattern || typeof pattern !== 'object' || Array.isArray(pattern)) {
    return [{ index: -1, reason: 'pattern_must_be_object' }];
  }

  const steps = Array.isArray(pattern.steps) ? pattern.steps : [];
  if (steps.length === 0) {
    return [{ index: -1, reason: 'missing_steps' }];
  }

  const blockers = [];
  steps.forEach((step, index) => {
    if (!isConceptChoiceStep(step)) {
      blockers.push({
        index,
        stepId: step && typeof step === 'object' && !Array.isArray(step) ? String(step.id || '') : '',
        reason: 'concept_step_must_be_controlled_choice'
      });
    } else if (!getCorrectChoice(step)) {
      blockers.push({
        index,
        stepId: String(step.id || ''),
        reason: 'concept_step_missing_correct_choice'
      });
    }
  });

  return blockers.concat(getUnsafeStudentTutorStepReasons(steps));
}

function startConceptTutor(pattern, originalQuestion) {
  if (!canStartConceptTutor(pattern)) return null;

  const now = new Date().toISOString();
  return {
    tutorType: 'concept_tutor',
    routeType: 'concept_tutor',
    id: String(pattern.id || ''),
    topic: String(pattern.topic || ''),
    originalQuestion: String(originalQuestion || pattern.originalQuestion || ''),
    steps: clonePlain(pattern.steps),
    finalAnswer: String(pattern.finalAnswer || ''),
    finalExplanation: String(pattern.finalExplanation || pattern.finalAnswer || ''),
    currentStepIndex: 0,
    attempts: {},
    completedSteps: [],
    startedAt: now,
    updatedAt: now
  };
}

function answerConceptTutorStep(session, studentAnswer) {
  const problem = normalizeSession(session);
  const message = String(studentAnswer || '').trim();
  const command = normalizeCommand(message);

  if (command === 'hint') {
    const updated = recordAttempt(problem);
    const response = currentHintResponse(updated);
    return {
      response,
      currentTutorProblem: touch({ ...updated, lastHint: response }),
      completed: false,
      stopped: false
    };
  }

  if (command === 'restart') {
    const restarted = restartConceptTutor(problem);
    return {
      response: buildConceptTutorPrompt(restarted),
      currentTutorProblem: restarted,
      completed: false,
      stopped: false
    };
  }

  if (command === 'stop') {
    return {
      response: 'Concept Tutor stopped. You can ask a new question now.',
      currentTutorProblem: null,
      completed: false,
      stopped: true
    };
  }

  const step = getCurrentStep(problem);
  if (!step) {
    return {
      response: completionResponse(problem),
      currentTutorProblem: null,
      completedTutorProblem: completeProblem(problem),
      completed: true,
      stopped: false
    };
  }

  const selectedChoice = getSelectedChoice(step, message);
  if (!selectedChoice || selectedChoice.correct !== true) {
    const updated = recordAttempt(problem, step);
    return {
      response: buildWrongChoiceResponse(updated, step, selectedChoice),
      currentTutorProblem: updated,
      completed: false,
      stopped: false
    };
  }

  const advanced = advanceProblem(problem, step, selectedChoice);
  if (advanced.currentStepIndex >= advanced.steps.length) {
    return {
      response: completionResponse(advanced),
      currentTutorProblem: null,
      completedTutorProblem: advanced,
      completed: true,
      stopped: false
    };
  }

  return {
    response: `Correct.\n\n${buildConceptTutorPrompt(advanced, { includeIntro: false })}`,
    currentTutorProblem: advanced,
    completed: false,
    stopped: false
  };
}

function buildConceptTutorPrompt(session, options = {}) {
  const problem = normalizeSession(session);
  const step = getCurrentStep(problem);
  if (!step) return completionResponse(problem);

  const lines = [];
  if (options.includeIntro !== false) {
    lines.push("Let's figure it out.");
    if (problem.topic) lines.push(`Topic: ${problem.topic}.`);
    lines.push('');
  }

  lines.push(`Step ${problem.currentStepIndex + 1} of ${problem.steps.length}:`);
  lines.push(step.prompt || 'Choose the best answer.');
  lines.push('', 'Choose one:');
  for (const choice of getStepChoices(step)) {
    lines.push(`${choice.number}. ${choice.label}`);
  }
  lines.push('', 'Click a choice or type only the number.');

  return lines.join('\n');
}

function buildConceptTutorMetadata(session, options = {}) {
  const problem = normalizeSession(session);
  const completed = options.completed === true;
  const stopped = options.stopped === true;
  const latestStudentReply = String(options.latestStudentReply || '').trim();

  if (stopped) {
    return {
      active: false,
      completed: false,
      stopped: true,
      routeType: 'concept_tutor',
      tutorType: 'concept_tutor',
      tutorCategory: 'concept',
      tutorLabel: 'Concept Tutor',
      latestStudentReply
    };
  }

  if (completed) {
    return {
      active: false,
      completed: true,
      stopped: false,
      routeType: 'concept_tutor',
      tutorType: 'concept_tutor',
      tutorCategory: 'concept',
      tutorLabel: 'Concept Tutor',
      id: problem.id,
      topic: problem.topic,
      title: problem.topic,
      originalQuestion: problem.originalQuestion,
      currentStep: null,
      currentStepIndex: problem.currentStepIndex,
      stepNumber: problem.steps.length,
      totalSteps: problem.steps.length,
      latestStudentReply,
      finalAnswer: problem.finalAnswer,
      finalExplanation: problem.finalExplanation || problem.finalAnswer,
      finalAnswerDisplay: problem.finalAnswer,
      work: buildTutorWork(problem, { completed: true, latestStudentReply })
    };
  }

  const step = getCurrentStep(problem);
  return {
    active: true,
    completed: false,
    stopped: false,
    routeType: 'concept_tutor',
    tutorType: 'concept_tutor',
    tutorCategory: 'concept',
    tutorLabel: 'Concept Tutor',
    id: problem.id,
    topic: problem.topic,
    title: problem.topic,
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
    work: buildTutorWork(problem, { latestStudentReply })
  };
}

function isConceptTutorProblem(session) {
  return session?.tutorType === 'concept_tutor' || session?.routeType === 'concept_tutor';
}

function isConceptChoiceStep(step) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) return false;
  const type = normalizeType(step.type || step.kind || step.inputType || step.responseType);
  return SAFE_CONCEPT_CHOICE_STEP_TYPES.has(type) && getStepChoices(step).length > 0;
}

function normalizeSession(session) {
  const normalized = session && typeof session === 'object' && !Array.isArray(session) ? session : {};
  return {
    tutorType: 'concept_tutor',
    routeType: 'concept_tutor',
    id: String(normalized.id || ''),
    topic: String(normalized.topic || ''),
    originalQuestion: String(normalized.originalQuestion || ''),
    steps: Array.isArray(normalized.steps) ? normalized.steps : [],
    finalAnswer: String(normalized.finalAnswer || ''),
    finalExplanation: String(normalized.finalExplanation || ''),
    currentStepIndex: Number.isInteger(normalized.currentStepIndex) ? normalized.currentStepIndex : 0,
    attempts: normalized.attempts && typeof normalized.attempts === 'object' ? normalized.attempts : {},
    completedSteps: Array.isArray(normalized.completedSteps) ? normalized.completedSteps : [],
    lastHint: String(normalized.lastHint || ''),
    startedAt: normalized.startedAt || new Date().toISOString(),
    updatedAt: normalized.updatedAt || new Date().toISOString()
  };
}

function restartConceptTutor(problem) {
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

function getStepChoices(step) {
  const choices = Array.isArray(step?.choices)
    ? step.choices
    : Array.isArray(step?.options)
      ? step.options
      : [];
  return choices
    .map((choice, index) => normalizeChoice(step, choice, index))
    .filter((choice) => choice.label && choice.number);
}

function normalizeChoice(step, choice, index) {
  if (typeof choice === 'string') {
    const value = choice.trim();
    return {
      number: String(index + 1),
      label: value,
      value,
      correct: matchesStepCorrectAnswer(step, value),
      finalAnswer: '',
      finalExplanation: ''
    };
  }

  const rawNumber = choice?.number ?? choice?.id ?? index + 1;
  const label = String(choice?.label || choice?.text || choice?.value || '').trim();
  const value = String(choice?.value || choice?.label || choice?.text || '').trim();
  return {
    number: String(rawNumber).trim(),
    label,
    value,
    correct: choice?.correct === true || matchesStepCorrectAnswer(step, value) || matchesStepCorrectAnswer(step, label),
    finalAnswer: String(choice?.finalAnswer || '').trim(),
    finalExplanation: String(choice?.finalExplanation || choice?.finalAnswer || '').trim()
  };
}

function getSelectedChoice(step, message) {
  const text = String(message || '').trim();
  const numberMatch = normalizeChoiceNumber(text);
  const choices = getStepChoices(step);
  if (!numberMatch) return null;
  return choices.find((choice) => String(choice.number) === numberMatch) || null;
}

function getCorrectChoice(step) {
  return getStepChoices(step).find((choice) => choice.correct === true) || null;
}

function matchesStepCorrectAnswer(step, value) {
  const correctAnswer = String(step?.correctAnswer || '').trim();
  return correctAnswer && normalizeText(value) === normalizeText(correctAnswer);
}

function normalizeChoiceNumber(value) {
  const match = String(value || '').trim().match(/^(?:choice\s*)?([1-9][0-9]*)$/i);
  return match ? match[1] : '';
}

function recordAttempt(problem, step = getCurrentStep(problem)) {
  const attempts = { ...problem.attempts };
  const key = step?.id || String(problem.currentStepIndex);
  attempts[key] = (Number(attempts[key]) || 0) + 1;
  return touch({ ...problem, attempts, lastHint: getHint(step) });
}

function getAttemptCount(problem, step = getCurrentStep(problem)) {
  const key = step?.id || String(problem.currentStepIndex);
  return Number(problem.attempts?.[key]) || 0;
}

function buildWrongChoiceResponse(problem, step, selectedChoice) {
  const attempts = getAttemptCount(problem, step);
  const prefix = selectedChoice
    ? `Not quite. Choice ${selectedChoice.number} is not the best fit here.`
    : 'Please choose one of the listed options.';
  const hint = attempts >= 2 ? getStrongerHint(step) : getHint(step);
  return [
    `${prefix} ${hint}`.trim(),
    '',
    ...buildStepPromptLines(problem, step),
    '',
    ...getStepChoices(step).map((choice) => `${choice.number}. ${choice.label}`),
    '',
    'Try again, type hint for help, or type stop to leave the tutor.'
  ].join('\n');
}

function currentHintResponse(problem) {
  const step = getCurrentStep(problem);
  return [
    getHint(step),
    '',
    ...buildStepPromptLines(problem, step),
    '',
    ...getStepChoices(step).map((choice) => `${choice.number}. ${choice.label}`)
  ].join('\n');
}

function getHint(step) {
  if (Array.isArray(step?.hints) && step.hints.length > 0) return String(step.hints[0] || '');
  return 'Look carefully at the choices and pick the one that matches the question.';
}

function getStrongerHint(step) {
  if (Array.isArray(step?.hints) && step.hints.length > 1) return String(step.hints[1] || '');
  const correctChoice = getStepChoices(step).find((choice) => choice.correct);
  if (correctChoice) return `The best choice is ${correctChoice.number}. ${correctChoice.label}`;
  return getHint(step);
}

function buildStepPromptLines(problem, step) {
  return [
    `Step ${problem.currentStepIndex + 1} of ${problem.steps.length}:`,
    step?.prompt || 'Choose the best answer.',
    'Choose one:'
  ];
}

function advanceProblem(problem, step, selectedChoice = null) {
  const stepId = step?.id || String(problem.currentStepIndex);
  const completedSteps = problem.completedSteps.includes(stepId)
    ? problem.completedSteps
    : [...problem.completedSteps, stepId];
  const selectedFinalAnswer = String(selectedChoice?.finalAnswer || '').trim();
  const selectedFinalExplanation = String(selectedChoice?.finalExplanation || selectedFinalAnswer).trim();
  return touch({
    ...problem,
    completedSteps,
    currentStepIndex: problem.currentStepIndex + 1,
    finalAnswer: selectedFinalAnswer || problem.finalAnswer,
    finalExplanation: selectedFinalExplanation || problem.finalExplanation,
    lastHint: ''
  });
}

function completeProblem(problem) {
  return touch({
    ...problem,
    currentStepIndex: problem.steps.length,
    completedSteps: problem.steps.map((step, index) => step?.id || String(index)),
    lastHint: ''
  });
}

function buildCurrentStepMetadata(problem, step) {
  if (!step) return null;
  return {
    id: String(step.id || ''),
    type: String(step.type || ''),
    prompt: String(step.prompt || ''),
    stepNumber: problem.currentStepIndex + 1,
    totalSteps: problem.steps.length,
    choices: getStepChoices(step).map((choice) => ({
      number: choice.number,
      label: choice.label
    }))
  };
}

function buildTutorWork(problem, options = {}) {
  const completed = options.completed === true;
  const step = completed ? null : getCurrentStep(problem);
  return {
    routeType: 'concept_tutor',
    tutorType: 'concept_tutor',
    tutorCategory: 'concept',
    tutorLabel: 'Concept Tutor',
    id: problem.id,
    topic: problem.topic,
    title: problem.topic,
    originalQuestion: problem.originalQuestion,
    currentStep: completed ? null : buildCurrentStepMetadata(problem, step),
    currentStepIndex: problem.currentStepIndex,
    stepNumber: completed ? problem.steps.length : problem.currentStepIndex + 1,
    totalSteps: problem.steps.length,
    finalAnswer: completed ? problem.finalAnswer : '',
    answer: completed ? problem.finalAnswer : '',
    latestStudentReply: String(options.latestStudentReply || '')
  };
}

function completionResponse(problem) {
  return problem.finalAnswer ? `Correct. ${problem.finalAnswer}` : 'Correct. That completes the Concept Tutor.';
}

function normalizeCommand(message) {
  const normalized = normalizeText(message);
  if (normalized === 'hint' || normalized === 'help') return 'hint';
  if (normalized === 'restart' || normalized === 'start over' || normalized === 'reset') return 'restart';
  if (/^(?:stop|cancel|exit|quit|nevermind|never mind)$/.test(normalized)) return 'stop';
  return '';
}

function normalizeType(value) {
  return String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function touch(problem) {
  return {
    ...problem,
    updatedAt: new Date().toISOString()
  };
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  answerConceptTutorStep,
  buildConceptTutorMetadata,
  buildConceptTutorPrompt,
  canStartConceptTutor,
  getConceptTutorStartBlockers,
  isConceptTutorProblem,
  startConceptTutor
};
