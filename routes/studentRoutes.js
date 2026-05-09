const { isInstructionalFollowUpPrompt } = require('../lib/standards/standardsFollowUp');

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

      if (controls.studentQuestionRateLimitEnabled) {
        const rateLimit = questionRateLimiter.check({
          classSessionId: sessionId,
          studentHubId,
          questionsPerMinute: controls.studentQuestionsPerMinute
        });
        rateLimitInfo = toPublicRateLimit({
          enabled: true,
          limit: controls.studentQuestionsPerMinute,
          remaining: rateLimit.remaining,
          resetInSeconds: rateLimit.resetInSeconds
        });

        if (!rateLimit.allowed) {
          return res.status(429).json({
            error: 'Slow down a little. Try reading the last answer before asking another question.',
            code: 'student_rate_limited',
            retryAfterMs: rateLimit.retryAfterMs,
            rateLimit: rateLimitInfo
          });
        }
      }

      const contextMessages = hub.messages;
      const lastAnsweredContext = findLastAnsweredContext(contextMessages);
      const result = await answerStudentMessage(message, {
        intent,
        lastAnsweredPrompt: lastAnsweredContext.prompt,
        lastAnsweredAnswer: lastAnsweredContext.answer,
        pendingClarification: hub.pendingClarification || null,
        currentStandardId: findLastStandardIdForCurrentContext(contextMessages),
        recentMessages: contextMessages
      });
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
  const windowMs = 60_000;

  function getBucket(key, currentTime) {
    const bucket = (buckets.get(key) || []).filter((timestamp) => currentTime - timestamp < windowMs);
    buckets.set(key, bucket);
    return bucket;
  }

  function getStatusForBucket(bucket, limit, currentTime) {
    const oldest = bucket[0] || currentTime;
    const remaining = Math.max(0, limit - bucket.length);
    const resetInMs = bucket.length ? Math.max(0, windowMs - (currentTime - oldest)) : 0;
    return {
      limit,
      remaining,
      windowSeconds: Math.floor(windowMs / 1000),
      resetInSeconds: Math.ceil(resetInMs / 1000)
    };
  }

  function getKey(classSessionId, studentHubId) {
    return `${String(classSessionId || '').trim()}::${String(studentHubId || '').trim()}`;
  }

  return {
    check({ classSessionId, studentHubId, questionsPerMinute }) {
      const limit = normalizeQuestionLimit(questionsPerMinute);
      const key = getKey(classSessionId, studentHubId);
      const currentTime = now();
      const bucket = getBucket(key, currentTime);

      // TODO: Math guided problem-solving questions may use a different rate limit later.
      if (bucket.length >= limit) {
        const oldest = bucket[0] || currentTime;
        return {
          allowed: false,
          retryAfterMs: Math.max(1000, windowMs - (currentTime - oldest)),
          ...getStatusForBucket(bucket, limit, currentTime)
        };
      }

      bucket.push(currentTime);
      buckets.set(key, bucket);
      return {
        allowed: true,
        retryAfterMs: 0,
        ...getStatusForBucket(bucket, limit, currentTime)
      };
    },
    status({ classSessionId, studentHubId, questionsPerMinute }) {
      const limit = normalizeQuestionLimit(questionsPerMinute);
      const key = getKey(classSessionId, studentHubId);
      const currentTime = now();
      const bucket = getBucket(key, currentTime);
      return getStatusForBucket(bucket, limit, currentTime);
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
      remaining: controls.studentQuestionsPerMinute,
      resetInSeconds: 0
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
    resetInSeconds: status.resetInSeconds
  });
}

function toPublicRateLimit({ enabled, limit, remaining, resetInSeconds }) {
  return {
    enabled: Boolean(enabled),
    limit: normalizeQuestionLimit(limit),
    remaining: Math.max(0, Number.isFinite(Number(remaining)) ? Number(remaining) : 0),
    windowSeconds: 60,
    resetInSeconds: Math.max(0, Number.isFinite(Number(resetInSeconds)) ? Math.ceil(Number(resetInSeconds)) : 0)
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
    pendingClarification: null
  };

  hub.lastSeenAt = now;
  if (!Array.isArray(hub.messages)) hub.messages = [];
  session.anonymousHubs[studentHubId] = hub;
  return hub;
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
