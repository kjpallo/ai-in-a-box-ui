function canStartMotionForceKnowledgeTutor(questionRoute) {
  return Boolean(
    questionRoute &&
    questionRoute.motionForceTutor &&
    Array.isArray(questionRoute.motionForceTutor.guidingQuestions) &&
    questionRoute.motionForceTutor.guidingQuestions.length > 0
  );
}

function startMotionForceKnowledgeTutor({ questionRoute, originalQuestion }) {
  if (!canStartMotionForceKnowledgeTutor(questionRoute)) return null;

  const tutor = questionRoute.motionForceTutor;
  const now = new Date().toISOString();
  return {
    tutorType: 'motion_force_knowledge',
    id: tutor.id || '',
    routeType: questionRoute.type || tutor.type || '',
    topic: tutor.topic || '',
    category: tutor.category || '',
    expectedAnswer: tutor.expectedAnswer || '',
    guidingQuestions: clonePlain(tutor.guidingQuestions),
    finalAnswer: tutor.finalAnswer || questionRoute.directAnswer || '',
    misconceptionNote: tutor.misconceptionNote || '',
    currentStepIndex: 0,
    attempts: {},
    completedSteps: [],
    startedAt: now,
    updatedAt: now,
    originalQuestion: String(originalQuestion || '')
  };
}

function continueMotionForceKnowledgeTutor(sessionState, studentMessage) {
  const problem = normalizeProblem(sessionState);
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
    const restarted = restartMotionForceKnowledgeTutor(problem);
    return {
      response: buildMotionForceKnowledgeTutorPrompt(restarted),
      currentTutorProblem: restarted,
      completed: false,
      stopped: false
    };
  }

  if (command === 'stop') {
    return {
      response: 'Guided Motion/Force Tutor stopped. You can ask a new question now.',
      currentTutorProblem: null,
      completed: false,
      stopped: true
    };
  }

  if (command === 'show_answer') {
    return {
      response: 'Try the next idea first. Ask your teacher if you need the full answer.',
      currentTutorProblem: touch(problem),
      completed: false,
      stopped: false
    };
  }

  const currentQuestion = getCurrentQuestion(problem);
  if (!currentQuestion) {
    return {
      response: completionResponse(problem),
      currentTutorProblem: null,
      completed: true,
      stopped: false
    };
  }

  if (!looksLikeReasonableStepAnswer(problem, message)) {
    const updated = recordAttempt(problem);
    return {
      response: buildTryAgainResponse(updated),
      currentTutorProblem: updated,
      completed: false,
      stopped: false
    };
  }

  const advanced = advanceProblem(problem);
  if (advanced.currentStepIndex >= advanced.guidingQuestions.length) {
    return {
      response: completionResponse(advanced),
      currentTutorProblem: null,
      completed: true,
      stopped: false
    };
  }

  return {
    response: `Good. ${buildMotionForceKnowledgeTutorPrompt(advanced, { includeIntro: false })}`,
    currentTutorProblem: advanced,
    completed: false,
    stopped: false
  };
}

function buildMotionForceKnowledgeTutorPrompt(sessionState, options = {}) {
  const problem = normalizeProblem(sessionState);
  const question = getCurrentQuestion(problem);
  if (!question) return completionResponse(problem);

  const lines = [];
  if (options.includeIntro !== false) {
    lines.push('Let’s figure it out.');
    if (problem.topic) lines.push(`Topic: ${problem.topic}.`);
    lines.push('');
  }

  lines.push(question);
  return lines.join('\n');
}

function buildMotionForceKnowledgeTutorMetadata(sessionState, options = {}) {
  const problem = normalizeProblem(sessionState);
  const completed = options.completed === true;
  const stopped = options.stopped === true;

  if (stopped) {
    return {
      active: false,
      completed: false,
      stopped: true,
      tutorType: 'motion_force_knowledge'
    };
  }

  if (completed) {
    return {
      active: false,
      completed: true,
      tutorType: 'motion_force_knowledge',
      id: problem.id,
      topic: problem.topic,
      category: problem.category,
      finalAnswerDisplay: problem.finalAnswer
    };
  }

  return {
    active: true,
    completed: false,
    tutorType: 'motion_force_knowledge',
    id: problem.id,
    topic: problem.topic,
    category: problem.category,
    currentStepIndex: problem.currentStepIndex,
    totalSteps: problem.guidingQuestions.length,
    currentStepPrompt: getCurrentQuestion(problem),
    currentHint: problem.lastHint || '',
    completedSteps: Array.isArray(problem.completedSteps) ? [...problem.completedSteps] : []
  };
}

function isMotionForceKnowledgeTutorProblem(sessionState) {
  return sessionState?.tutorType === 'motion_force_knowledge';
}

function normalizeProblem(problem) {
  const normalized = problem && typeof problem === 'object' ? problem : {};
  return {
    tutorType: 'motion_force_knowledge',
    id: normalized.id || '',
    routeType: normalized.routeType || '',
    topic: normalized.topic || '',
    category: normalized.category || '',
    expectedAnswer: normalized.expectedAnswer || '',
    guidingQuestions: Array.isArray(normalized.guidingQuestions) ? normalized.guidingQuestions : [],
    finalAnswer: normalized.finalAnswer || '',
    misconceptionNote: normalized.misconceptionNote || '',
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

function restartMotionForceKnowledgeTutor(problem) {
  return touch({
    ...problem,
    currentStepIndex: 0,
    attempts: {},
    completedSteps: [],
    lastHint: ''
  });
}

function getCurrentQuestion(problem) {
  return problem.guidingQuestions[problem.currentStepIndex] || '';
}

function looksLikeReasonableStepAnswer(problem, message) {
  const text = normalizeText(message);
  if (!text) return false;
  if (text.length >= 3 && !isLowEffortAnswer(text)) return true;
  return matchesExpectedIdea(problem, text);
}

function isLowEffortAnswer(text) {
  return /^(idk|i dont know|i do not know|what|why|huh|no idea|maybe)$/.test(text);
}

function matchesExpectedIdea(problem, text) {
  const expected = normalizeText(problem.expectedAnswer);
  if (expected && text.includes(expected)) return true;

  const ideaPatterns = [
    /\bstays?\s+(?:the\s+)?same\b/,
    /\bnot\s+chang(?:e|ing)\b/,
    /\bstopp?ed\b/,
    /\bzero\b|\b0\b/,
    /\bdirection\b/,
    /\bstart\s+to\s+finish\b/,
    /\bacceleration\b/,
    /\bair\s+resistance\b/,
    /\bgravity\b/,
    /\bfriction\b/,
    /\bsliding\b/,
    /\brolling\b/,
    /\bstatic\b/,
    /\bmass\b/,
    /\bvelocity\b/,
    /\bthird\b|\b3rd\b/,
    /\bfirst\b|\b1st\b/,
    /\bsecond\b|\b2nd\b/,
    /\bopposite\b/
  ];
  return ideaPatterns.some((pattern) => pattern.test(text));
}

function recordAttempt(problem) {
  const attempts = { ...problem.attempts };
  const key = String(problem.currentStepIndex);
  attempts[key] = (Number(attempts[key]) || 0) + 1;
  return touch({ ...problem, attempts, lastHint: getHint(problem) });
}

function getAttemptCount(problem) {
  return Number(problem.attempts?.[String(problem.currentStepIndex)]) || 0;
}

function buildTryAgainResponse(problem) {
  const attempts = getAttemptCount(problem);
  const hint = attempts >= 2 ? getStrongerHint(problem) : getHint(problem);
  return `Not quite yet. ${hint}\n\n${getCurrentQuestion(problem)}\n\nType hint for help, or type stop to leave the tutor.`;
}

function getHint(problem) {
  if (problem.misconceptionNote) return problem.misconceptionNote;
  if (problem.expectedAnswer) return `Think about this idea: ${problem.expectedAnswer}.`;
  return 'Look for what changes and what stays the same in the situation.';
}

function getStrongerHint(problem) {
  if (problem.expectedAnswer) return `The key idea is ${problem.expectedAnswer}. Try saying that in your own words.`;
  return getHint(problem);
}

function currentHintResponse(problem) {
  return getHint(problem);
}

function advanceProblem(problem) {
  const stepId = String(problem.currentStepIndex);
  const completedSteps = problem.completedSteps.includes(stepId)
    ? problem.completedSteps
    : [...problem.completedSteps, stepId];
  return touch({
    ...problem,
    completedSteps,
    currentStepIndex: problem.currentStepIndex + 1,
    lastHint: ''
  });
}

function completionResponse(problem) {
  if (problem.finalAnswer) return `Yes. ${problem.finalAnswer}`;
  return 'Yes. That is the key idea.';
}

function touch(problem) {
  return {
    ...problem,
    updatedAt: new Date().toISOString()
  };
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[?.!,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  buildMotionForceKnowledgeTutorMetadata,
  buildMotionForceKnowledgeTutorPrompt,
  canStartMotionForceKnowledgeTutor,
  continueMotionForceKnowledgeTutor,
  isMotionForceKnowledgeTutorProblem,
  startMotionForceKnowledgeTutor
};
