const {
  clearSessionCookie,
  getTeacherSession,
  setSessionCookie
} = require('../lib/auth/teacherAuth');

function registerAuthRoutes(app, {
  authStore,
  sessionStore
}) {
  const recoverySessions = createRecoverySessionStore();

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

      const setupResult = await authStore.createTeacher({
        username: req.body?.username,
        pin: req.body?.pin,
        linkedGoogleEmail: req.body?.linkedGoogleEmail
      });
      const teacher = setupResult.teacher;
      const sessionId = sessionStore.createSession(teacher);
      setSessionCookie(res, sessionId, req);
      res.status(201).json({ ok: true, teacher, recoveryCode: setupResult.recoveryCode });
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

  app.post('/api/auth/recover/verify', (req, res) => {
    try {
      const teacher = authStore.verifyRecovery({
        username: req.body?.username,
        recoveryCode: req.body?.recoveryCode
      });

      if (!teacher) {
        return res.status(401).json({ error: 'Invalid username or recovery code.' });
      }

      const recoveryToken = recoverySessions.create(teacher.username);
      res.json({ ok: true, recoveryToken, expiresInSeconds: recoverySessions.ttlSeconds });
    } catch (error) {
      sendAuthError(res, error);
    }
  });

  app.post('/api/auth/recover/reset', async (req, res) => {
    try {
      if (req.body?.newPin !== req.body?.confirmPin) {
        return res.status(400).json({ error: 'PIN/password confirmation does not match.' });
      }

      const recoverySession = recoverySessions.consume(req.body?.recoveryToken);
      if (!recoverySession) {
        return res.status(401).json({ error: 'Recovery session expired. Verify the recovery code again.' });
      }

      const resetResult = await authStore.resetPinWithRecovery({
        username: recoverySession.username,
        newPin: req.body?.newPin
      });

      res.json({
        ok: true,
        teacher: resetResult.teacher,
        recoveryCode: resetResult.recoveryCode
      });
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

function createRecoverySessionStore() {
  const ttlMs = 10 * 60 * 1000;
  const sessions = new Map();

  return {
    ttlSeconds: Math.floor(ttlMs / 1000),
    create(username) {
      const token = require('crypto').randomBytes(32).toString('base64url');
      sessions.set(token, {
        username,
        expiresAt: Date.now() + ttlMs
      });
      return token;
    },
    consume(token) {
      const cleanToken = String(token || '');
      const session = sessions.get(cleanToken);
      sessions.delete(cleanToken);

      if (!session || session.expiresAt < Date.now()) return null;
      return session;
    }
  };
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
