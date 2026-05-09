const { isInstructionalFollowUpPrompt } = require('../lib/standards/standardsFollowUp');
const {
  answerFormulaTutorStep,
  buildFormulaTutorMetadata,
  buildFormulaTutorPrompt,
  canStartFormulaTutor,
  startFormulaTutor
} = require('../lib/tutor/formulaTutor');

function registerStudentRoutes(app, {
  answerStudentMessage,
  getClassroomControls = () => ({
    studentCopyInspectLockEnabled: true,
    studentQuestionRateLimitEnabled: true,
    studentQuestionsPerMinute: 6
  }),
  logCompletedInteraction,
  studentSessions,
  questionRateLimiter = createStudentQuestionRateLimiter()
}) {
  app.get('/api/student/controls', (_req, res) => {
    const controls = normalizeStudentControls(getClassroomControls());
    res.json({
      studentCopyInspectLockEnabled: controls.studentCopyInspectLockEnabled,
      studentQuestionRateLimitEnabled: controls.studentQuestionRateLimitEnabled,
      studentQuestionsPerMinute: controls.studentQuestionsPerMinute
    });
  });

  app.get('/api/student/rate-limit-status', (req, res) => {
    const sessionId = String(req.query?.sessionId || req.query?.classSessionId || '').trim();
    const studentHubId = String(req.query?.studentHubId || '').trim();
    const session = studentSessions[sessionId];

    if (!session) {
      return res.status(404).json({ error: 'Student session not found.' });
    }

    if (!studentHubId) {
      return res.status(400).json({ error: 'Student hub id is required.' });
    }

    touchAnonymousHub(session, studentHubId);
    const controls = normalizeStudentControls(getClassroomControls());
    res.json({
      rateLimit: getStudentRateLimitInfo({
        controls,
        questionRateLimiter,
        classSessionId: sessionId,
        studentHubId
      })
    });
  });

  app.post('/api/student/join', (req, res) => {
    const sessionId = String(req.body?.sessionId || req.body?.classSessionId || '').trim();
    const studentHubId = String(req.body?.studentHubId || '').trim();
    const session = studentSessions[sessionId];

    if (!session) {
      return res.status(404).json({ error: 'Student session not found.' });
    }

    if (!studentHubId) {
      return res.status(400).json({ error: 'Student hub id is required.' });
    }

    const hub = touchAnonymousHub(session, studentHubId);
    res.json({
      ok: true,
      sessionId,
      classSessionId: sessionId,
      studentHub: {
        label: hub.label,
        firstSeenAt: hub.firstSeenAt,
        lastSeenAt: hub.lastSeenAt,
        messageCount: hub.messageCount
      }
    });
  });

  app.post('/api/student/message', async (req, res) => {
    const sessionId = String(req.body?.sessionId || req.body?.classSessionId || '').trim();
    const studentHubId = String(req.body?.studentHubId || '').trim();
    const message = String(req.body?.message || '').trim();
    const intent = String(req.body?.intent || '').trim();
    const session = studentSessions[sessionId];

    if (!session) {
      return res.status(404).json({ error: 'Student session not found.' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    if (!studentHubId) {
      return res.status(400).json({ error: 'Student hub id is required.' });
    }

    try {
      const hub = touchAnonymousHub(session, studentHubId);
      const controls = normalizeStudentControls(getClassroomControls());
      let rateLimitInfo = getStudentRateLimitInfo({
        controls,
        questionRateLimiter,
        classSessionId: sessionId,
        studentHubId
      });

      const contextMessages = hub.messages;
      const lastAnsweredContext = findLastAnsweredContext(contextMessages);

      // Guided tutor messages are already inside a teacher-safe scaffold, so they do not spend question energy.
      if (hub.currentTutorProblem) {
        const previousTutorProblem = hub.currentTutorProblem;
        const tutorResult = answerFormulaTutorStep(previousTutorProblem, message);
        hub.currentTutorProblem = tutorResult.currentTutorProblem;
        const tutorMetadata = buildFormulaTutorMetadata(
          hub.currentTutorProblem || previousTutorProblem,
          { completed: tutorResult.completed, stopped: tutorResult.stopped }
        );

        const entry = appendStudentHubEntry({
          session,
          hub,
          message,
          response: tutorResult.response,
          routeType: 'formula_tutor',
          confidence: 'strong'
        });

        logCompletedInteraction({
          message,
          questionRoute: makeFormulaTutorRoute(hub.currentTutorProblem || previousTutorProblem, entry),
          answerGiven: tutorResult.response,
          source: 'student',
          sessionId,
          debug: {
            className: session.className || '',
            studentHubId,
            formulaTutor: {
              active: Boolean(hub.currentTutorProblem),
              completed: Boolean(tutorResult.completed),
              stopped: Boolean(tutorResult.stopped)
            }
          }
        });

        return res.json({
          response: tutorResult.response,
          routeType: 'formula_tutor',
          confidence: 'strong',
          rateLimit: rateLimitInfo,
          tutor: tutorMetadata
        });
      }

      const result = await answerStudentMessage(message, {
        intent,
        lastAnsweredPrompt: lastAnsweredContext.prompt,
        lastAnsweredAnswer: lastAnsweredContext.answer,
        pendingClarification: hub.pendingClarification || null,
        currentStandardId: findLastStandardIdForCurrentContext(contextMessages),
        recentMessages: contextMessages
      });
      // Starting a guided tutor also bypasses energy; normal student questions still spend energy below.
      if (canStartFormulaTutor(result.questionRoute)) {
        hub.currentTutorProblem = startFormulaTutor({
          questionRoute: result.questionRoute,
          originalQuestion: message
        });
        const response = buildFormulaTutorPrompt(hub.currentTutorProblem);
        const tutorMetadata = buildFormulaTutorMetadata(hub.currentTutorProblem);
        const entry = appendStudentHubEntry({
          session,
          hub,
          message,
          response,
          routeType: 'formula_tutor',
          confidence: result.confidence,
          standardId: result.standardId || result.questionRoute?.standardId || result.questionRoute?.public?.standardId || '',
          isStandardsFollowUp: Boolean(result.isStandardsFollowUp)
        });

        hub.pendingClarification = null;

        logCompletedInteraction({
          message,
          questionRoute: makeFormulaTutorRoute(hub.currentTutorProblem, entry),
          answerGiven: response,
          source: 'student',
          sessionId,
          debug: {
            className: session.className || '',
            studentHubId,
            originalRouteType: result.routeType
          }
        });

        return res.json({
          response,
          routeType: 'formula_tutor',
          confidence: result.confidence,
          rateLimit: rateLimitInfo,
          tutor: tutorMetadata
        });
      }

      const consumed = consumeStudentQuestionEnergy({
        controls,
        questionRateLimiter,
        classSessionId: sessionId,
        studentHubId
      });
      rateLimitInfo = consumed.rateLimitInfo;

      if (!consumed.allowed) {
        return res.status(429).json({
          error: 'Slow down a little. Try reading the last answer before asking another question.',
          code: 'student_rate_limited',
          retryAfterMs: consumed.retryAfterMs,
          rateLimit: rateLimitInfo
        });
      }

      const entry = {
        message,
        response: result.response,
        routeType: result.routeType,
        confidence: result.confidence,
        standardId: result.standardId || result.questionRoute?.standardId || result.questionRoute?.public?.standardId || '',
        isStandardsFollowUp: Boolean(result.isStandardsFollowUp),
        createdAt: new Date().toISOString()
      };

      session.messages.push(entry);
      hub.pendingClarification = result.pendingClarification || null;
      hub.messages.push(entry);
      hub.messageCount += 1;
      hub.lastMessageAt = entry.createdAt;

      logCompletedInteraction({
        message,
        questionRoute: result.questionRoute,
        answerGiven: result.response,
        source: 'student',
        sessionId,
        debug: {
          className: session.className || '',
          studentHubId
        }
      });

      res.json({
        response: result.response,
        routeType: result.routeType,
        confidence: result.confidence,
        rateLimit: rateLimitInfo
      });
    } catch (error) {
      console.error('Student message route error:', error);
      res.status(500).json({
        error: 'Could not answer that student message.'
      });
    }
  });
}

function normalizeStudentControls(value = {}) {
  const controls = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    studentCopyInspectLockEnabled: typeof controls.studentCopyInspectLockEnabled === 'boolean'
      ? controls.studentCopyInspectLockEnabled
      : true,
    studentQuestionRateLimitEnabled: typeof controls.studentQuestionRateLimitEnabled === 'boolean'
      ? controls.studentQuestionRateLimitEnabled
      : true,
    studentQuestionsPerMinute: normalizeQuestionLimit(controls.studentQuestionsPerMinute)
  };
}

function createStudentQuestionRateLimiter({ now = () => Date.now() } = {}) {
  const buckets = new Map();

  function getBucket(key, limit, currentTime) {
    const existing = buckets.get(key);
    if (!existing) {
      const bucket = { tokens: limit, updatedAt: currentTime, limit };
      buckets.set(key, bucket);
      return bucket;
    }

    refillBucket(existing, limit, currentTime);
    return existing;
  }

  function refillBucket(bucket, limit, currentTime) {
    const previousLimit = normalizeQuestionLimit(bucket.limit);
    const previousUpdatedAt = Number.isFinite(Number(bucket.updatedAt)) ? Number(bucket.updatedAt) : currentTime;
    const elapsedSeconds = Math.max(0, (currentTime - previousUpdatedAt) / 1000);
    const refillRatePerSecond = getRefillRatePerSecond(previousLimit);
    const tokens = Number.isFinite(Number(bucket.tokens)) ? Number(bucket.tokens) : previousLimit;

    bucket.tokens = Math.min(limit, Math.max(0, tokens) + (elapsedSeconds * refillRatePerSecond));
    bucket.updatedAt = currentTime;
    bucket.limit = limit;

    if (bucket.tokens > limit) bucket.tokens = limit;
    return bucket;
  }

  function getRefillRatePerSecond(limit) {
    return normalizeQuestionLimit(limit) / 60;
  }

  function getStatusForBucket(bucket, limit) {
    const remaining = Math.max(0, Math.min(limit, Number(bucket.tokens) || 0));
    const refillRatePerSecond = getRefillRatePerSecond(limit);
    const tokensUntilNext = Math.max(0, 1 - remaining);
    const tokensUntilFull = Math.max(0, limit - remaining);

    return {
      limit,
      max: limit,
      remaining,
      remainingWhole: Math.max(0, Math.min(limit, Math.floor(remaining))),
      refillRatePerSecond,
      secondsUntilNextQuestion: tokensUntilNext > 0 ? Math.ceil(tokensUntilNext / refillRatePerSecond) : 0,
      secondsUntilFull: tokensUntilFull > 0 ? Math.ceil(tokensUntilFull / refillRatePerSecond) : 0
    };
  }

  function setBucket(key, bucket) {
    buckets.set(key, bucket);
    return bucket;
  }

  function getKey(classSessionId, studentHubId) {
    return `${String(classSessionId || '').trim()}::${String(studentHubId || '').trim()}`;
  }

  return {
    check({ classSessionId, studentHubId, questionsPerMinute }) {
      const limit = normalizeQuestionLimit(questionsPerMinute);
      const key = getKey(classSessionId, studentHubId);
      const currentTime = now();
      const bucket = getBucket(key, limit, currentTime);

      // TODO: Math guided problem-solving questions may use a different rate limit later.
      if (bucket.tokens < 1) {
        const status = getStatusForBucket(bucket, limit);
        return {
          allowed: false,
          retryAfterMs: Math.max(1000, status.secondsUntilNextQuestion * 1000),
          ...status
        };
      }

      bucket.tokens -= 1;
      setBucket(key, bucket);
      return {
        allowed: true,
        retryAfterMs: 0,
        ...getStatusForBucket(bucket, limit)
      };
    },
    status({ classSessionId, studentHubId, questionsPerMinute }) {
      const limit = normalizeQuestionLimit(questionsPerMinute);
      const key = getKey(classSessionId, studentHubId);
      const currentTime = now();
      const bucket = getBucket(key, limit, currentTime);
      return getStatusForBucket(bucket, limit);
    },
    reset() {
      buckets.clear();
    }
  };
}

function normalizeQuestionLimit(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return 6;
  return Math.min(number, 30);
}

function getStudentRateLimitInfo({ controls, questionRateLimiter, classSessionId, studentHubId }) {
  if (!controls.studentQuestionRateLimitEnabled) {
    return toPublicRateLimit({
      enabled: false,
      limit: controls.studentQuestionsPerMinute,
      max: controls.studentQuestionsPerMinute,
      remaining: controls.studentQuestionsPerMinute,
      remainingWhole: controls.studentQuestionsPerMinute,
      refillRatePerSecond: controls.studentQuestionsPerMinute / 60,
      secondsUntilNextQuestion: 0,
      secondsUntilFull: 0
    });
  }

  const status = questionRateLimiter.status({
    classSessionId,
    studentHubId,
    questionsPerMinute: controls.studentQuestionsPerMinute
  });

  return toPublicRateLimit({
    enabled: true,
    limit: status.limit,
    remaining: status.remaining,
    remainingWhole: status.remainingWhole,
    max: status.max,
    refillRatePerSecond: status.refillRatePerSecond,
    secondsUntilNextQuestion: status.secondsUntilNextQuestion,
    secondsUntilFull: status.secondsUntilFull
  });
}

function consumeStudentQuestionEnergy({ controls, questionRateLimiter, classSessionId, studentHubId }) {
  if (!controls.studentQuestionRateLimitEnabled) {
    return {
      allowed: true,
      retryAfterMs: 0,
      rateLimitInfo: getStudentRateLimitInfo({
        controls,
        questionRateLimiter,
        classSessionId,
        studentHubId
      })
    };
  }

  const rateLimit = questionRateLimiter.check({
    classSessionId,
    studentHubId,
    questionsPerMinute: controls.studentQuestionsPerMinute
  });

  return {
    allowed: rateLimit.allowed,
    retryAfterMs: rateLimit.retryAfterMs,
    rateLimitInfo: toPublicRateLimit({
      enabled: true,
      limit: controls.studentQuestionsPerMinute,
      remaining: rateLimit.remaining,
      remainingWhole: rateLimit.remainingWhole,
      max: rateLimit.max,
      refillRatePerSecond: rateLimit.refillRatePerSecond,
      secondsUntilNextQuestion: rateLimit.secondsUntilNextQuestion,
      secondsUntilFull: rateLimit.secondsUntilFull
    })
  };
}

function toPublicRateLimit({
  enabled,
  limit,
  remaining,
  remainingWhole,
  max,
  refillRatePerSecond,
  secondsUntilNextQuestion,
  secondsUntilFull
}) {
  const normalizedLimit = normalizeQuestionLimit(limit);
  const normalizedMax = normalizeQuestionLimit(max || normalizedLimit);
  const normalizedRemaining = Math.max(0, Math.min(normalizedMax, Number.isFinite(Number(remaining)) ? Number(remaining) : 0));
  const normalizedRefillRate = Number.isFinite(Number(refillRatePerSecond)) && Number(refillRatePerSecond) > 0
    ? Number(refillRatePerSecond)
    : normalizedLimit / 60;
  const nextSeconds = Number.isFinite(Number(secondsUntilNextQuestion))
    ? Math.max(0, Math.ceil(Number(secondsUntilNextQuestion)))
    : (normalizedRemaining >= 1 ? 0 : Math.ceil((1 - normalizedRemaining) / normalizedRefillRate));
  const fullSeconds = Number.isFinite(Number(secondsUntilFull))
    ? Math.max(0, Math.ceil(Number(secondsUntilFull)))
    : Math.ceil(Math.max(0, normalizedMax - normalizedRemaining) / normalizedRefillRate);

  return {
    enabled: Boolean(enabled),
    limit: normalizedLimit,
    remaining: Number(normalizedRemaining.toFixed(4)),
    remainingWhole: Number.isInteger(Number(remainingWhole))
      ? Math.max(0, Math.min(normalizedMax, Number(remainingWhole)))
      : Math.max(0, Math.min(normalizedMax, Math.floor(normalizedRemaining))),
    max: normalizedMax,
    refillRatePerSecond: Number(normalizedRefillRate.toFixed(4)),
    secondsUntilNextQuestion: nextSeconds,
    secondsUntilFull: fullSeconds,
    windowSeconds: 60,
    resetInSeconds: nextSeconds
  };
}

function touchAnonymousHub(session, studentHubId) {
  session.anonymousHubs = session.anonymousHubs || Object.create(null);
  const now = new Date().toISOString();
  const existingHubCount = Object.keys(session.anonymousHubs).length;
  const hub = session.anonymousHubs[studentHubId] || {
    studentHubId,
    label: `Anonymous Student ${existingHubCount + 1}`,
    firstSeenAt: now,
    lastSeenAt: now,
    lastMessageAt: '',
    messageCount: 0,
    messages: [],
    pendingClarification: null,
    currentTutorProblem: null
  };

  hub.lastSeenAt = now;
  if (!Array.isArray(hub.messages)) hub.messages = [];
  if (!Object.prototype.hasOwnProperty.call(hub, 'currentTutorProblem')) hub.currentTutorProblem = null;
  session.anonymousHubs[studentHubId] = hub;
  return hub;
}

function appendStudentHubEntry({
  session,
  hub,
  message,
  response,
  routeType,
  confidence,
  standardId = '',
  isStandardsFollowUp = false
}) {
  const entry = {
    message,
    response,
    routeType,
    confidence,
    standardId,
    isStandardsFollowUp,
    createdAt: new Date().toISOString()
  };

  session.messages.push(entry);
  hub.pendingClarification = null;
  hub.messages.push(entry);
  hub.messageCount += 1;
  hub.lastMessageAt = entry.createdAt;
  return entry;
}

function makeFormulaTutorRoute(currentTutorProblem) {
  const problem = currentTutorProblem || {};
  return {
    type: 'formula_tutor',
    confidence: 'strong',
    toolsUsed: ['formula_tutor'],
    notes: 'Guided formula tutor step.',
    aiAllowed: false,
    formulaWork: {
      formulaId: problem.formulaId || '',
      family: problem.family || '',
      solveFor: problem.solveFor || '',
      formula: problem.formula || '',
      steps: Array.isArray(problem.steps) ? problem.steps : []
    },
    public: {
      type: 'formula_tutor',
      confidence: 'strong',
      toolsUsed: ['formula_tutor'],
      notes: 'Guided formula tutor step.',
      aiAllowed: false,
      formulaWork: {
        formulaId: problem.formulaId || '',
        family: problem.family || '',
        solveFor: problem.solveFor || '',
        formula: problem.formula || '',
        hasGuidedSteps: Array.isArray(problem.steps) && problem.steps.length > 0
      }
    }
  };
}

function findLastAnsweredContext(messages) {
  if (!Array.isArray(messages)) return { prompt: '', answer: '' };

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (!entry?.message || entry.isStandardsFollowUp) continue;
    if (entry.routeType === 'no_match') continue;
    if (isInstructionalFollowUpPrompt(entry.message) && !isResolvedNumberChoice(entry)) continue;
    if (!entry.response) continue;
    return {
      prompt: entry.message,
      answer: entry.response
    };
  }

  return { prompt: '', answer: '' };
}

function findLastStandardIdForCurrentContext(messages) {
  if (!Array.isArray(messages)) return '';

  let contextIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (!entry?.message || entry.isStandardsFollowUp) continue;
    if (entry.routeType === 'no_match') continue;
    if (isInstructionalFollowUpPrompt(entry.message) && !isResolvedNumberChoice(entry)) continue;
    if (!entry.response) continue;
    contextIndex = index;
    break;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (contextIndex >= 0 && index <= contextIndex) break;
    const standardId = String(messages[index]?.standardId || '').trim();
    if (standardId) return standardId;
  }

  return '';
}

function isResolvedNumberChoice(entry) {
  return /^\s*\d+\s*$/.test(String(entry?.message || '')) &&
    entry.routeType &&
    !['no_match', 'standards_followup', 'clarification_followup'].includes(entry.routeType);
}

module.exports = {
  findLastAnsweredContext,
  findLastStandardIdForCurrentContext,
  createStudentQuestionRateLimiter,
  getStudentRateLimitInfo,
  normalizeStudentControls,
  toPublicRateLimit,
  registerStudentRoutes,
  touchAnonymousHub
};
