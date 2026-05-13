const STEP_CONFIGS = {
  distance_time_flat_line: {
    steps: {
      0: {
        match: (text) => /\b(?:same|constant|unchanged)\b/.test(text) || /\bnot\s+chang(?:e|ing)\b/.test(text)
      },
      1: {
        match: (text) => /\bstopp?ed\b|\bnot\s+mov(?:e|ing)\b/.test(text)
      }
    }
  },
  distance_time_slope: {
    contradicts: (text) => /\bacceleration\b/.test(text),
    steps: {
      0: {
        match: isDistanceTimeComparisonAnswer,
        hints: [
          'A distance-time graph compares distance and time.',
          'Look at the graph name: distance-time. The two quantities are in the name.',
          'Try this: "The graph compares distance and ___."'
        ],
        choices: [
          choice(1, 'distance and time', true),
          choice(2, 'mass and force', false),
          choice(3, 'speed and acceleration', false)
        ]
      },
      1: {
        match: (text) => /\bspeed\b/.test(text),
        hints: [
          'Slope here means change in distance divided by change in time.',
          'Distance divided by time is speed.',
          'Try this: "The slope shows ___."'
        ],
        choices: [
          choice(1, 'acceleration', false),
          choice(2, 'speed', true),
          choice(3, 'force', false)
        ]
      }
    }
  },
  distance_time_steeper: {
    contradicts: (text) => /\b(?:decreas(?:e|es|ing)|slower|slow(?:ing)?\s+down)\b/.test(text),
    defaultStep: {
      match: (text) => /\b(?:speed(?:ing)?\s+up|speeds?\s+up|faster|moving\s+faster|incresing|increasng|increassing|increaseing|increas(?:e|es|ing)|greater\s+speed|more\s+speed)\b/.test(text),
      hints: [
        'A steeper distance-time line means greater speed.',
        'Greater speed means the object is moving faster.',
        'Try this: "The object is ___ up."'
      ]
    },
    steps: {
      1: {
        choices: [
          choice(1, 'increasing', true),
          choice(2, 'decreasing', false),
          choice(3, 'staying the same', false)
        ]
      }
    }
  },
  distance_time_flattening: {
    contradicts: (text) => /\b(?:increas(?:e|es|ing)|faster|speed(?:ing)?\s+up)\b/.test(text),
    defaultStep: {
      match: (text) => /\b(?:slow(?:ing)?\s+down|slower|decreas(?:e|es|ing)|less\s+speed)\b/.test(text)
    }
  },
  velocity_time_slope: {
    contradicts: (text) => /\bspeed\b/.test(text) && !/\bacceleration\b/.test(text),
    steps: {
      0: {
        match: (text) => /\bvelocity\b/.test(text)
      },
      1: {
        match: (text) => /\bacceleration\b/.test(text)
      }
    }
  },
  velocity_time_flat_line: {
    steps: {
      0: {
        match: (text) => /\b(?:same|constant|unchanged)\b/.test(text) || /\bnot\s+chang(?:e|ing)\b/.test(text)
      },
      1: {
        match: (text) => /\bzero\b|\b0\b|\bno\s+acceleration\b/.test(text)
      }
    }
  },
  newton_third_law_scenario: {
    steps: {
      0: {
        match: (text) => /\b(?:swimmer|water|objects?|each\s+other)\b/.test(text)
      },
      1: {
        match: (text) => /\bthird\b|\b3rd\b|\bequal\b|\bopposite\b|\bpairs?\b/.test(text)
      }
    }
  },
  inertia_vocab: {
    steps: {
      0: {
        match: isInertiaResistanceAnswer,
        hints: [
          'Inertia means resisting a change in motion.',
          'Think: an object with more mass is harder to start, stop, or turn.',
          'Try this sentence starter: "Inertia means resisting a change in ___."'
        ],
        choices: [
          choice(1, 'changing motion easily', false),
          choice(2, 'resisting a change in motion', true),
          choice(3, 'making speed disappear', false)
        ]
      },
      1: {
        match: (text) => /\bmass\b/.test(text),
        hints: [
          'More mass usually gives an object more inertia.',
          'Think: a heavier object is harder to start, stop, or turn.',
          'Try this: "More ___ means more inertia."'
        ],
        choices: [
          choice(1, 'color', false),
          choice(2, 'mass', true),
          choice(3, 'temperature', false)
        ]
      }
    }
  }
};

const STEP_SPECIFIC_ANSWER_CHECK_IDS = new Set([
  'distance_time_flat_line',
  'distance_time_slope',
  'distance_time_steeper',
  'distance_time_flattening',
  'velocity_time_slope',
  'velocity_time_flat_line',
  'inertia_vocab'
]);

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
    const updated = recordAttempt(problem);
    const hint = currentHintResponse(updated);
    return {
      response: hint,
      currentTutorProblem: touch({ ...updated, lastHint: hint }),
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
      response: 'Guided General Tutor stopped. You can ask a new question now.',
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

  const selectedChoice = getSelectedNumberedChoice(problem, message);
  if (selectedChoice && selectedChoice.correct !== true) {
    const updated = recordAttempt(problem);
    return {
      response: buildIncorrectChoiceResponse(updated, selectedChoice),
      currentTutorProblem: updated,
      completed: false,
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
      tutorType: 'motion_force_knowledge',
      tutorCategory: 'general',
      tutorLabel: 'General Tutor'
    };
  }

  if (completed) {
    return {
      active: false,
      completed: true,
      tutorType: 'motion_force_knowledge',
      tutorCategory: 'general',
      tutorLabel: 'General Tutor',
      id: problem.id,
      topic: problem.topic,
      title: problem.topic,
      category: problem.category,
      originalQuestion: problem.originalQuestion,
      finalAnswer: problem.finalAnswer,
      finalExplanation: problem.finalAnswer,
      finalAnswerDisplay: problem.finalAnswer
    };
  }

  return {
    active: true,
    completed: false,
    tutorType: 'motion_force_knowledge',
    tutorCategory: 'general',
    tutorLabel: 'General Tutor',
    id: problem.id,
    topic: problem.topic,
    title: problem.topic,
    category: problem.category,
    originalQuestion: problem.originalQuestion,
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

function getStepConfig(problem) {
  const tutorConfig = STEP_CONFIGS[problem.id || ''] || {};
  const defaultStep = tutorConfig.defaultStep || {};
  const stepConfig = tutorConfig.steps?.[String(Number(problem.currentStepIndex) || 0)] || {};
  return { ...defaultStep, ...stepConfig };
}

function looksLikeReasonableStepAnswer(problem, message) {
  const text = normalizeText(message);
  if (!text) return false;
  const selectedChoice = getSelectedNumberedChoice(problem, message);
  if (selectedChoice) return selectedChoice.correct === true;
  if (isLowEffortAnswer(text)) return false;
  if (hasStepSpecificAnswerCheck(problem)) return matchesStepIdea(problem, text);
  return matchesStepIdea(problem, text) || matchesExpectedIdea(problem, text);
}

function isLowEffortAnswer(text) {
  return /^(idk|i dont know|i do not know|what|why|huh|no idea|maybe)$/.test(text);
}

function matchesExpectedIdea(problem, text) {
  if (hasContradictingIdea(problem, text)) return false;

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

function matchesStepIdea(problem, text) {
  if (hasContradictingIdea(problem, text)) return false;
  const stepConfig = getStepConfig(problem);
  return typeof stepConfig.match === 'function' ? stepConfig.match(text) : false;
}

function hasStepSpecificAnswerCheck(problem) {
  return STEP_SPECIFIC_ANSWER_CHECK_IDS.has(problem.id || '');
}

function hasContradictingIdea(problem, text) {
  const tutorConfig = STEP_CONFIGS[problem.id || ''];
  return typeof tutorConfig?.contradicts === 'function' ? tutorConfig.contradicts(text) : false;
}

function isDistanceTimeComparisonAnswer(text) {
  if (/\bdistance\b/.test(text) && /\btime\b/.test(text)) return true;
  const compact = text.replace(/\//g, ' ').replace(/\band\b/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(?:d\s+t|t\s+d)$/.test(compact);
}

function isInertiaResistanceAnswer(text) {
  return /\b(?:resist(?:s|ing)?|resistance)\b/.test(text) &&
    (/\bchange\b/.test(text) || /\bmotion\b/.test(text) || text === 'resisting');
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
  const choices = attempts >= 3 ? getCurrentStepChoices(problem) : [];
  if (choices.length > 0) {
    return [
      'Try this:',
      formatNumberedChoices(choices),
      '',
      getCurrentQuestion(problem),
      '',
      'Type hint for help, or type stop to leave the tutor.'
    ].join('\n');
  }

  const hint = getAttemptAwareHint(problem, attempts) || (attempts >= 2 ? getStrongerHint(problem) : getHint(problem));
  const prefix = attempts >= 3 ? 'Try this:' : 'Not quite.';
  const cleanHint = stripTryThisPrefix(hint);
  return `${prefix} ${cleanHint}\n\n${getCurrentQuestion(problem)}\n\nType hint for help, or type stop to leave the tutor.`;
}

function getHint(problem) {
  const attemptHint = getAttemptAwareHint(problem, Math.max(1, getAttemptCount(problem)));
  if (attemptHint) return attemptHint;
  if (problem.misconceptionNote) return problem.misconceptionNote;
  if (problem.expectedAnswer) return `Think about this idea: ${problem.expectedAnswer}.`;
  return 'Look for what changes and what stays the same in the situation.';
}

function getStrongerHint(problem) {
  if (problem.expectedAnswer) return `The key idea is ${problem.expectedAnswer}. Try saying that in your own words.`;
  return getHint(problem);
}

function currentHintResponse(problem) {
  const attempts = getAttemptCount(problem);
  const choices = attempts >= 3 ? getCurrentStepChoices(problem) : [];
  if (choices.length > 0) return formatNumberedChoices(choices);
  return getHint(problem);
}

function getCurrentStepChoices(problem) {
  const choices = getStepConfig(problem).choices;
  return Array.isArray(choices) ? choices : [];
}

function choice(number, label, correct) {
  return { number, label, correct };
}

function formatNumberedChoices(choices) {
  return ['Choose one:', ...choices.map((option) => `${option.number}. ${option.label}`)].join('\n');
}

function getSelectedNumberedChoice(problem, message) {
  if (getAttemptCount(problem) < 3) return null;
  const choices = getCurrentStepChoices(problem);
  if (choices.length === 0) return null;
  const text = normalizeText(message);
  const match = text.match(/^(?:choice\s*)?([1-9])$/);
  if (!match) return null;
  const number = Number(match[1]);
  return choices.find((option) => option.number === number) || null;
}

function buildIncorrectChoiceResponse(problem, selectedChoice) {
  return [
    `Not quite. Choice ${selectedChoice.number} is ${selectedChoice.label}, but that is not the idea for this step.`,
    formatNumberedChoices(getCurrentStepChoices(problem)),
    '',
    getCurrentQuestion(problem),
    '',
    'Type hint for help, or type stop to leave the tutor.'
  ].join('\n');
}

function stripTryThisPrefix(hint) {
  return String(hint || '').replace(/^try this(?:\s+sentence\s+starter)?:\s*/i, '');
}

function getAttemptAwareHint(problem, attempts) {
  const tier = Math.min(Math.max(Number(attempts) || 1, 1), 3);
  const hints = getStepConfig(problem).hints;
  return Array.isArray(hints) ? hints[tier - 1] || '' : '';
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
