const crypto = require('crypto');

function registerProfileRoutes(app, {
  completeGoogleConnect,
  createGoogleConnectUrl,
  getAvailableProfileDates,
  getDailyQuestionSummary,
  getStandardsSummaryReport,
  getProfileStatus,
  port,
  sendDailySummaryEmail,
  studentSessions
}) {
  app.get('/api/profile/status', (_req, res) => {
    res.json(getProfileStatus());
  });

  app.post('/api/profile/create-student-session', (req, res) => {
    const sessionId = crypto.randomUUID();
    const className = String(req.body?.className || '').trim();
    const studentUrl = buildStudentUrl(req, sessionId, port);

    studentSessions[sessionId] = {
      sessionId,
      className,
      createdAt: new Date().toISOString(),
      studentUrl,
      messages: []
    };

    res.status(201).json({
      sessionId,
      className,
      createdAt: studentSessions[sessionId].createdAt,
      studentUrl
    });
  });

  app.get('/api/profile/student-sessions', (_req, res) => {
    const sessions = Object.values(studentSessions)
      .map((session) => ({
        className: session.className || '',
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        studentUrl: session.studentUrl || `/student.html?sessionId=${encodeURIComponent(session.sessionId)}`
      }))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    res.json({ sessions });
  });

  app.get('/api/profile/google/start', (_req, res) => {
    try {
      res.redirect(createGoogleConnectUrl());
    } catch (error) {
      sendProfileError(res, error);
    }
  });

  app.get('/api/profile/google/callback', async (req, res) => {
    try {
      await completeGoogleConnect(req.query);
      res.send(`
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <title>Gmail connected</title>
            <meta http-equiv="refresh" content="1; url=/">
            <style>
              body {
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                background: #03090a;
                color: #effff8;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              }
              main {
                max-width: 520px;
                padding: 2rem;
                border: 1px solid rgba(103, 255, 208, 0.25);
                border-radius: 18px;
                background: rgba(0, 18, 17, 0.82);
              }
              a { color: #67ffd0; }
            </style>
          </head>
          <body>
            <main>
              <h1>Gmail connected</h1>
              <p>You can return to Charlemagne and send daily summary emails.</p>
              <p><a href="/">Back to Charlemagne</a></p>
            </main>
          </body>
        </html>
      `);
    } catch (error) {
      const message = escapeHtml(error instanceof Error ? error.message : String(error));
      res.status(error.statusCode || 500).send(`
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <title>Gmail connection failed</title>
            <style>
              body {
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                background: #03090a;
                color: #effff8;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              }
              main {
                max-width: 620px;
                padding: 2rem;
                border: 1px solid rgba(255, 124, 124, 0.3);
                border-radius: 18px;
                background: rgba(40, 0, 8, 0.72);
              }
              a { color: #67ffd0; }
            </style>
          </head>
          <body>
            <main>
              <h1>Gmail connection failed</h1>
              <p>${message}</p>
              <p><a href="/">Back to Charlemagne</a></p>
            </main>
          </body>
        </html>
      `);
    }
  });

  app.get('/api/profile/dates', (_req, res) => {
    res.json(getAvailableProfileDates());
  });

  app.get('/api/profile/question-summary', (req, res) => {
    res.json(getDailyQuestionSummary(req.query.date));
  });

  app.get('/api/profile/standards-summary', (_req, res) => {
    try {
      res.json({
        ok: true,
        summary: getStandardsSummaryReport()
      });
    } catch {
      res.status(500).json({
        ok: false,
        error: 'Unable to build standards summary report.'
      });
    }
  });

  app.post('/api/profile/send-daily-summary', async (req, res) => {
    sendProfileDailySummary(req, res);
  });

  app.post('/api/profile/send-email', async (req, res) => {
    sendProfileDailySummary(req, res);
  });

  async function sendProfileDailySummary(req, res) {
    try {
      const summary = getDailyQuestionSummary(req.body?.date);
      const result = await sendDailySummaryEmail(summary);
      res.json(result);
    } catch (error) {
      sendProfileError(res, error);
    }
  }
}

function sendProfileError(res, error) {
  const statusCode = Number(error?.statusCode || 500);
  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: error instanceof Error ? error.message : String(error)
  });
}

function buildStudentUrl(req, sessionId, port) {
  const host = req.get('host') || `localhost:${port}`;
  const protocol = req.protocol || 'http';
  return `${protocol}://${host}/student.html?sessionId=${encodeURIComponent(sessionId)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

module.exports = {
  registerProfileRoutes
};
