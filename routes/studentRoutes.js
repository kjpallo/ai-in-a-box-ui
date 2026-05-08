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
        pendingClarification: session.pendingClarification || null
      });
      const entry = {
        message,
        response: result.response,
        routeType: result.routeType,
        confidence: result.confidence,
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
    if (isInstructionalFollowUpPrompt(entry.message)) continue;
    if (!entry.response) continue;
    return {
      prompt: entry.message,
      answer: entry.response
    };
  }

  return { prompt: '', answer: '' };
}

module.exports = {
  findLastAnsweredContext,
  registerStudentRoutes
};
