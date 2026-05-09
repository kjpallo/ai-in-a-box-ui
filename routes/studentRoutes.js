const { isInstructionalFollowUpPrompt } = require('../lib/standards/standardsFollowUp');

function registerStudentRoutes(app, {
  answerStudentMessage,
  logCompletedInteraction,
  studentSessions
}) {
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

    try {
      const hub = studentHubId ? touchAnonymousHub(session, studentHubId) : null;
      const contextMessages = hub ? hub.messages : [];
      const lastAnsweredContext = findLastAnsweredContext(contextMessages);
      const result = await answerStudentMessage(message, {
        intent,
        lastAnsweredPrompt: lastAnsweredContext.prompt,
        lastAnsweredAnswer: lastAnsweredContext.answer,
        pendingClarification: hub ? hub.pendingClarification || null : null,
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
      if (hub) {
        hub.pendingClarification = result.pendingClarification || null;
        hub.messages.push(entry);
        hub.messageCount += 1;
        hub.lastMessageAt = entry.createdAt;
      }

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
        confidence: result.confidence
      });
    } catch (error) {
      console.error('Student message route error:', error);
      res.status(500).json({
        error: 'Could not answer that student message.'
      });
    }
  });
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
  registerStudentRoutes,
  touchAnonymousHub
};
