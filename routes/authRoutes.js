const {
  clearSessionCookie,
  getTeacherSession,
  setSessionCookie
} = require('../lib/auth/teacherAuth');

function registerAuthRoutes(app, {
  authStore,
  sessionStore
}) {
  app.get('/api/auth/status', (req, res) => {
    res.json({
      setupRequired: !authStore.exists(),
      authenticated: Boolean(getTeacherSession(req, sessionStore))
    });
  });

  app.post('/api/auth/setup', async (req, res) => {
    try {
      if (req.body?.pin !== req.body?.confirmPin) {
        return res.status(400).json({ error: 'PIN/password confirmation does not match.' });
      }

      const teacher = await authStore.createTeacher({
        username: req.body?.username,
        pin: req.body?.pin,
        linkedGoogleEmail: req.body?.linkedGoogleEmail
      });
      const sessionId = sessionStore.createSession(teacher);
      setSessionCookie(res, sessionId, req);
      res.status(201).json({ ok: true, teacher });
    } catch (error) {
      sendAuthError(res, error);
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const teacher = authStore.verifyLogin({
        username: req.body?.username,
        pin: req.body?.pin
      });

      if (!teacher) {
        return res.status(401).json({ error: 'Invalid username or PIN/password.' });
      }

      const sessionId = sessionStore.createSession(teacher);
      setSessionCookie(res, sessionId, req);
      res.json({ ok: true, teacher });
    } catch (error) {
      sendAuthError(res, error);
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const session = getTeacherSession(req, sessionStore);
    if (session) sessionStore.deleteSession(session.sessionId);
    clearSessionCookie(res);
    res.json({ ok: true });
  });
}

function sendAuthError(res, error) {
  const statusCode = Number(error?.statusCode || 500);
  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: error instanceof Error ? error.message : String(error)
  });
}

module.exports = {
  registerAuthRoutes
};
