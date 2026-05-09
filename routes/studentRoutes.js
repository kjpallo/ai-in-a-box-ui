const { isInstructionalFollowUpPrompt } = require('../lib/standards/standardsFollowUp');

function registerStudentRoutes(app, {
  answerStudentMessage,
  logCompletedInteraction,
  studentSessions
}) {
  app.post('/api/student/message', async (req, res) => {
    const sessionId = String(req.body?.sessionId || '').trim();
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
      const lastAnsweredContext = findLastAnsweredContext(session.messages);
      const result = await answerStudentMessage(message, {
        intent,
        lastAnsweredPrompt: lastAnsweredContext.prompt,
        lastAnsweredAnswer: lastAnsweredContext.answer,
        pendingClarification: session.pendingClarification || null,
        currentStandardId: findLastStandardIdForCurrentContext(session.messages)
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

      session.pendingClarification = result.pendingClarification || null;
      session.messages.push(entry);

      logCompletedInteraction({
        message,
        questionRoute: result.questionRoute,
        answerGiven: result.response,
        source: 'student',
        sessionId,
        debug: {
          className: session.className || ''
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
  registerStudentRoutes
};
