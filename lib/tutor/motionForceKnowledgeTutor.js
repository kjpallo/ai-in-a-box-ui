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
  newton_first_law_scenario: {
    steps: {
      0: {
        match: isInertiaResistanceAnswer,
        choices: [
          choice(1, 'An object resists changes in motion', true),
          choice(2, 'An object always speeds up', false),
          choice(3, 'An object has no mass', false)
        ]
      },
      1: {
        match: (text) => /\bfirst\b|\b1st\b|\bkeep\b|\bunbalanced\b/.test(text)
      }
    }
  },
  balanced_force_concept_3_vocab: {
    steps: {
      0: {
        match: (text) => /\b(?:0|zero)\b/.test(text),
        choices: [
          choice(1, '0', true),
          choice(2, 'Greater than 0', false),
          choice(3, 'Always negative', false)
        ]
      }
    }
  },
  unbalanced_force_concept_3_vocab: {
    steps: {
      0: {
        match: (text) => /\bchange\b/.test(text) && /\bmotion\b/.test(text),
        choices: [
          choice(1, 'Change an object’s motion', true),
          choice(2, 'Make net force equal 0', false),
          choice(3, 'Stop all forces from acting', false)
        ]
      }
    }
  },
  friction_concept_3_vocab: {
    steps: {
      0: {
        match: (text) => /\bresist(?:s|ing)?\b/.test(text) && /\bmotion\b/.test(text),
        choices: [
          choice(1, 'Resists motion when surfaces touch', true),
          choice(2, 'Measures how fast an object moves', false),
          choice(3, 'Makes net force always equal 0', false)
        ]
      }
    }
  },
  air_resistance_vocab: {
    steps: {
      0: {
        match: (text) => /\bopposite\b/.test(text) && /\bmotion\b/.test(text),
        choices: [
          choice(1, 'Opposite the motion', true),
          choice(2, 'Same direction as the motion', false),
          choice(3, 'Straight down because of gravity', false)
        ]
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
          choice(1, 'Resisting a change in motion', true),
          choice(2, 'Changing motion easily', false),
          choice(3, 'Measuring speed', false)
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
  'air_resistance_vocab',
  'balanced_force_concept_3_vocab',
  'friction_concept_3_vocab',
  'inertia_vocab',
  'newton_first_law_scenario',
  'unbalanced_force_concept_3_vocab'
]);

const IMMEDIATE_CHOICE_TUTOR_IDS = new Set([
  'air_resistance_vocab',
  'balanced_force_concept_3_vocab',
  'friction_concept_3_vocab',
  'inertia_vocab',
  'newton_first_law_scenario',
  'unbalanced_force_concept_3_vocab'
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

  if (command === 'stop_and_explain') {
    return {
      response: `No problem. I’ll stop the Guided General Tutor and explain it directly.\n\n${completionResponse(problem)}`,
      currentTutorProblem: null,
      completed: false,
      stopped: true
    };
  }

  if (command === 'show_answer') {
    return {
      response: `Okay, I’ll stop the Guided General Tutor and give the direct answer.\n\n${completionResponse(problem)}`,
      currentTutorProblem: null,
      completed: false,
      stopped: true
    };
  }

  const currentQuestion = getCurrentBaseQuestion(problem);
  if (!currentQuestion) {
    return {
      response: completionResponse(problem),
      currentTutorProblem: null,
      completedTutorProblem: problem,
      completed: true,
      stopped: false
    };
  }

  if (matchesDirectExpectedCompletion(problem, message)) {
    const completedProblem = completeProblem(problem);
    return {
      response: completionResponse(completedProblem),
      currentTutorProblem: null,
      completedTutorProblem: completedProblem,
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
      completedTutorProblem: advanced,
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
  const question = buildCurrentStepPrompt(problem);
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
      currentStepIndex: problem.currentStepIndex,
      totalSteps: problem.guidingQuestions.length,
      finalAnswer: problem.finalAnswer,
      finalExplanation: problem.finalAnswer,
      finalAnswerDisplay: problem.finalAnswer,
      work: buildTutorWork(problem, { completed: true })
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
    currentStepPrompt: buildCurrentStepPrompt(problem),
    currentHint: problem.lastHint || '',
    completedSteps: Array.isArray(problem.completedSteps) ? [...problem.completedSteps] : [],
    work: buildTutorWork(problem)
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
  if (matchesStopCommand(normalized)) return 'stop';
  if (matchesFrustrationCommand(normalized)) return 'stop_and_explain';
  if (matchesDirectAnswerCommand(normalized)) return 'show_answer';
  return '';
}

function matchesStopCommand(normalized) {
  return [
    /^(?:please\s+)?(?:stop|cancel|exit|quit)(?:\s+(?:please|the\s+tutor|this\s+tutor|guided\s+tutor|guided\s+general\s+tutor|tutoring))?$/,
    /^(?:i\s+(?:want|need)\s+to|let\s+me)\s+(?:stop|cancel|exit|quit)(?:\s+(?:the\s+tutor|this\s+tutor|guided\s+tutor|guided\s+general\s+tutor|tutoring))?$/,
    /^(?:nevermind|never\s+mind)$/
  ].some((pattern) => pattern.test(normalized));
}

function matchesFrustrationCommand(normalized) {
  return [
    /^(?:i\s+)?(?:dont|do\s+not)\s+like\s+this$/,
    /^(?:i\s+)?hate\s+this$/,
    /^(?:this\s+is\s+)?(?:frustrating|annoying)$/,
    /^(?:im|i\s+am)\s+(?:frustrated|annoyed)$/,
    /^(?:i\s+)?give\s+up$/
  ].some((pattern) => pattern.test(normalized));
}

function matchesDirectAnswerCommand(normalized) {
  return [
    /^(?:show\s+(?:me\s+)?(?:the\s+)?answer|answer|tell\s+me\s+the\s+answer|just\s+tell\s+me|give\s+me\s+(?:the\s+)?answer)$/,
    /^(?:please\s+)?(?:show|give)\s+(?:me\s+)?(?:the\s+)?answer$/,
    /^(?:(?:can|could|will)\s+you\s+)?(?:please\s+)?(?:just\s+)?tell\s+me(?:\s+(?:the\s+)?answer)?$/,
    /^(?:i\s+(?:want|need)|i\s+just\s+(?:want|need))\s+(?:the\s+)?answer$/,
    /^(?:whats|what\s+is)\s+the\s+answer$/
  ].some((pattern) => pattern.test(normalized));
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

function getCurrentBaseQuestion(problem) {
  return problem.guidingQuestions[problem.currentStepIndex] || '';
}

function buildCurrentStepPrompt(problem) {
  const question = getCurrentBaseQuestion(problem);
  if (!question) return '';
  if (!shouldOfferNumberedChoices(problem)) return question;
  return [question, formatNumberedChoices(getCurrentStepChoices(problem))].join('\n\n');
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

function matchesDirectExpectedCompletion(problem, message) {
  if (!['distance_time_slope', 'velocity_time_slope'].includes(problem.id || '')) return false;
  if (problem.currentStepIndex === 0 && !isSlopeFillInOriginalQuestion(problem)) return false;

  const text = normalizeText(message);
  const expected = normalizeText(problem.expectedAnswer);
  if (!text || !expected || hasContradictingIdea(problem, text)) return false;

  return text === expected || new RegExp(`\\b${escapeRegExp(expected)}\\b`).test(text);
}

function isSlopeFillInOriginalQuestion(problem) {
  const originalQuestion = normalizeText(problem.originalQuestion);
  return /\bslope\b/.test(originalQuestion) &&
    /\bequals?\b/.test(originalQuestion) &&
    /\bobjects?\b/.test(originalQuestion);
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
  const choices = shouldOfferNumberedChoices(problem) ? getCurrentStepChoices(problem) : [];
  if (choices.length > 0) {
    return [
      'Try this:',
      formatNumberedChoices(choices),
      '',
      getCurrentBaseQuestion(problem),
      '',
      'Type hint for help, or type stop to leave the tutor.'
    ].join('\n');
  }

  const hint = getAttemptAwareHint(problem, attempts) || (attempts >= 2 ? getStrongerHint(problem) : getHint(problem));
  const prefix = attempts >= 3 ? 'Try this:' : 'Not quite.';
  const cleanHint = stripTryThisPrefix(hint);
  return `${prefix} ${cleanHint}\n\n${getCurrentBaseQuestion(problem)}\n\nType hint for help, or type stop to leave the tutor.`;
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
  const choices = shouldOfferNumberedChoices(problem) ? getCurrentStepChoices(problem) : [];
  if (choices.length > 0) return formatNumberedChoices(choices);
  return getHint(problem);
}

function getCurrentStepChoices(problem) {
  const choices = getStepConfig(problem).choices;
  return Array.isArray(choices) ? choices : [];
}

function shouldOfferNumberedChoices(problem) {
  if (getCurrentStepChoices(problem).length === 0) return false;
  return IMMEDIATE_CHOICE_TUTOR_IDS.has(problem.id || '') || getAttemptCount(problem) >= 3;
}

function choice(number, label, correct) {
  return { number, label, correct };
}

function formatNumberedChoices(choices) {
  return ['Choose one:', ...choices.map((option) => `${option.number}. ${option.label}`)].join('\n');
}

function getSelectedNumberedChoice(problem, message) {
  if (!shouldOfferNumberedChoices(problem)) return null;
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
    getCurrentBaseQuestion(problem),
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

function completeProblem(problem) {
  const completedSteps = problem.guidingQuestions.map((_question, index) => String(index));
  return touch({
    ...problem,
    completedSteps,
    currentStepIndex: problem.guidingQuestions.length,
    lastHint: ''
  });
}

function buildTutorWork(problem, options = {}) {
  const completed = options.completed === true;
  return {
    tutorType: 'motion_force_knowledge',
    tutorCategory: 'general',
    tutorLabel: 'General Tutor',
    id: problem.id,
    topic: problem.topic,
    title: problem.topic,
    category: problem.category,
    originalQuestion: problem.originalQuestion,
    currentStep: completed
      ? null
      : {
          prompt: buildCurrentStepPrompt(problem),
          stepNumber: problem.currentStepIndex + 1,
          totalSteps: problem.guidingQuestions.length
        },
    currentStepIndex: problem.currentStepIndex,
    stepNumber: completed
      ? problem.guidingQuestions.length
      : problem.currentStepIndex + 1,
    totalSteps: problem.guidingQuestions.length,
    finalAnswer: completed ? problem.finalAnswer : '',
    answer: completed ? problem.finalAnswer : ''
  };
}

function completionResponse(problem) {
  if (problem.finalAnswer) return `Yes. ${problem.finalAnswer}`;
  return 'Yes. That is the key idea.';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
