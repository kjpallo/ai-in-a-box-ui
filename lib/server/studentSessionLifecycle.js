const crypto = require('crypto');
const path = require('path');

const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const JOIN_CODE_RAW_LENGTH = 10;
const DEFAULT_STUDENT_SESSION_MINUTES = 60;
const SESSION_STATUS_ACTIVE = 'active';
const SESSION_STATUS_EXPIRED = 'expired';
const SESSION_STATUS_ENDED = 'ended';

function generateJoinCode(randomInt = crypto.randomInt) {
  let raw = '';
  for (let index = 0; index < JOIN_CODE_RAW_LENGTH; index += 1) {
    raw += JOIN_CODE_ALPHABET[randomInt(0, JOIN_CODE_ALPHABET.length)];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function generateUniqueJoinCode(studentSessions, options = {}) {
  const generateCode = typeof options.generateCode === 'function'
    ? options.generateCode
    : generateJoinCode;
  const maxAttempts = normalizePositiveWholeNumber(options.maxAttempts, 100);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const joinCode = normalizeJoinCode(generateCode());
    if (!isValidJoinCode(joinCode)) continue;
    if (!findSessionByJoinCode(studentSessions, joinCode)) return joinCode;
  }

  const error = new Error('Could not assign a unique classroom join code.');
  error.statusCode = 503;
  throw error;
}

function normalizeJoinCode(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length !== JOIN_CODE_RAW_LENGTH) return '';
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function isValidJoinCode(value) {
  const joinCode = String(value || '').trim().toUpperCase();
  if (!new RegExp(`^[${JOIN_CODE_ALPHABET}]{5}-[${JOIN_CODE_ALPHABET}]{5}$`).test(joinCode)) {
    return false;
  }
  return true;
}

function findSessionByJoinCode(studentSessions, joinCode) {
  const normalized = normalizeJoinCode(joinCode);
  if (!normalized) return null;
  return Object.values(studentSessions || {})
    .find((session) => normalizeJoinCode(session?.joinCode) === normalized) || null;
}

function resolveStudentSession(studentSessions, access = {}, options = {}) {
  const joinCode = normalizeJoinCode(access.joinCode || access.classroomCode || access.accessCode);
  const legacySessionId = safeText(access.sessionId || access.classSessionId);
  let session = null;
  let matchedBy = '';

  if (joinCode) {
    session = findSessionByJoinCode(studentSessions, joinCode);
    matchedBy = session ? 'joinCode' : '';
  } else if (legacySessionId) {
    const candidate = studentSessions?.[legacySessionId];
    if (candidate && safeText(candidate.sessionId || candidate.classSessionId) === legacySessionId) {
      session = candidate;
      matchedBy = 'legacySessionId';
    }
  }

  if (!session) {
    return {
      ok: false,
      statusCode: 404,
      code: 'SESSION_NOT_FOUND',
      error: 'Student session not found.'
    };
  }

  const status = refreshStudentSessionStatus(session, options.now);
  return {
    ok: true,
    session,
    status,
    matchedBy,
    joinCode: normalizeJoinCode(session.joinCode)
  };
}

function resolveActiveStudentSession(studentSessions, access = {}, options = {}) {
  const resolved = resolveStudentSession(studentSessions, access, options);
  if (!resolved.ok) return resolved;

  if (resolved.status === SESSION_STATUS_EXPIRED) {
    return {
      ...resolved,
      ok: false,
      statusCode: 410,
      code: 'SESSION_EXPIRED',
      error: 'This classroom session has expired. Ask your teacher to reopen it or provide a new link.'
    };
  }

  if (resolved.status === SESSION_STATUS_ENDED) {
    return {
      ...resolved,
      ok: false,
      statusCode: 410,
      code: 'SESSION_ENDED',
      error: 'This classroom session has ended. Ask your teacher for a new link.'
    };
  }

  return resolved;
}

function studentSessionAccessFromRequest(req, source = 'body') {
  const values = source === 'query' ? req?.query : source === 'params' ? req?.params : req?.body;
  return {
    joinCode: values?.joinCode || values?.classroomCode || values?.accessCode,
    sessionId: values?.sessionId,
    classSessionId: values?.classSessionId
  };
}

function sendStudentSessionAccessError(res, result) {
  return res.status(Number(result?.statusCode || 404)).json({
    error: result?.error || 'Student session not found.',
    code: result?.code || 'SESSION_NOT_FOUND'
  });
}

function refreshStudentSessionStatus(session, now = new Date()) {
  if (!session || typeof session !== 'object') return SESSION_STATUS_ENDED;
  const currentStatus = normalizeSessionStatus(session.status);
  if (currentStatus === SESSION_STATUS_ENDED) {
    session.status = SESSION_STATUS_ENDED;
    return session.status;
  }

  const nowMs = normalizeDate(now).getTime();
  const expiresAtMs = parseDateMs(session.expiresAt);
  if (expiresAtMs !== null && expiresAtMs <= nowMs) {
    session.status = SESSION_STATUS_EXPIRED;
    return session.status;
  }

  session.status = SESSION_STATUS_ACTIVE;
  return session.status;
}

function initializeStudentSessionLifecycle(session, options = {}) {
  const createdAt = normalizeDate(options.now || session?.createdAt || new Date());
  const durationMinutes = normalizeSessionDurationMinutes(
    options.durationMinutes,
    options.defaultMinutes
  );
  session.createdAt = createdAt.toISOString();
  session.expiresAt = options.noExpiration === true || durationMinutes === null
    ? null
    : new Date(createdAt.getTime() + (durationMinutes * 60 * 1000)).toISOString();
  session.endedAt = null;
  session.status = SESSION_STATUS_ACTIVE;
  return session;
}

function applyStudentSessionLifecycleAction(session, action, options = {}) {
  if (!session) {
    const error = new Error('Student session not found.');
    error.statusCode = 404;
    throw error;
  }

  const now = normalizeDate(options.now || new Date());
  const cleanAction = safeText(action).toLowerCase();
  const currentStatus = refreshStudentSessionStatus(session, now);

  if (cleanAction === 'extend') {
    if (currentStatus !== SESSION_STATUS_ACTIVE) {
      throw lifecycleError(409, 'Reopen the session before extending it.');
    }
    const minutes = normalizeRequiredDuration(options.minutes, 'Extension minutes');
    const currentExpirationMs = parseDateMs(session.expiresAt);
    const baseMs = currentExpirationMs === null ? now.getTime() : Math.max(now.getTime(), currentExpirationMs);
    session.expiresAt = new Date(baseMs + (minutes * 60 * 1000)).toISOString();
  } else if (cleanAction === 'set_expiration') {
    if (currentStatus === SESSION_STATUS_ENDED) {
      throw lifecycleError(409, 'Reopen the session before setting a new expiration.');
    }
    if (options.noExpiration === true) {
      session.expiresAt = null;
      session.status = SESSION_STATUS_ACTIVE;
    } else if (options.expiresAt) {
      const expiresAt = normalizeDateOrThrow(options.expiresAt, 'Expiration time');
      session.expiresAt = expiresAt.toISOString();
      session.status = expiresAt.getTime() <= now.getTime()
        ? SESSION_STATUS_EXPIRED
        : SESSION_STATUS_ACTIVE;
    } else {
      const minutes = normalizeRequiredDuration(options.minutes, 'Expiration minutes');
      session.expiresAt = new Date(now.getTime() + (minutes * 60 * 1000)).toISOString();
      session.status = SESSION_STATUS_ACTIVE;
    }
  } else if (cleanAction === 'end') {
    session.status = SESSION_STATUS_ENDED;
    session.endedAt = now.toISOString();
  } else if (cleanAction === 'reopen') {
    const minutes = normalizeRequiredDuration(options.minutes || 30, 'Reopen minutes');
    session.status = SESSION_STATUS_ACTIVE;
    session.endedAt = null;
    session.expiresAt = new Date(now.getTime() + (minutes * 60 * 1000)).toISOString();
  } else {
    throw lifecycleError(400, 'Unknown student session lifecycle action.');
  }

  return session;
}

function serializeStudentSessionLifecycle(session, options = {}) {
  const now = normalizeDate(options.now || new Date());
  const status = refreshStudentSessionStatus(session, now);
  const expiresAtMs = parseDateMs(session?.expiresAt);
  return {
    status,
    joinCode: normalizeJoinCode(session?.joinCode),
    createdAt: safeText(session?.createdAt),
    expiresAt: expiresAtMs === null ? null : new Date(expiresAtMs).toISOString(),
    endedAt: safeText(session?.endedAt) || null,
    timeRemainingMs: status === SESSION_STATUS_ACTIVE && expiresAtMs !== null
      ? Math.max(0, expiresAtMs - now.getTime())
      : null
  };
}

function normalizeSessionDurationMinutes(value, fallback = DEFAULT_STUDENT_SESSION_MINUTES) {
  if (value === null || value === 'none' || value === 'no-expiration') return null;
  const candidate = value === undefined || value === '' ? fallback : value;
  if (candidate === null || candidate === 'none' || candidate === 'no-expiration') return null;
  return normalizeRequiredDuration(candidate, 'Session duration');
}

function getDefaultStudentSessionMinutes(env = process.env) {
  const configured = Number(env.STUDENT_SESSION_DEFAULT_MINUTES);
  if (!Number.isInteger(configured) || configured < 1 || configured > 7 * 24 * 60) {
    return DEFAULT_STUDENT_SESSION_MINUTES;
  }
  return configured;
}

function registerStudentPageRoutes(app, {
  studentSessions,
  studentPagePath
}) {
  app.get('/student.html', (req, res, next) => {
    const legacySessionId = safeText(req.query?.sessionId || req.query?.classSessionId);
    if (!legacySessionId) return next();

    const resolved = resolveStudentSession(studentSessions, { sessionId: legacySessionId });
    if (!resolved.ok || !resolved.joinCode) return next();
    return res.redirect(302, resolved.session.studentUrl || `/join/${encodeURIComponent(resolved.joinCode)}`);
  });

  app.get('/join/:joinCode', (_req, res) => {
    res.sendFile(path.resolve(studentPagePath));
  });
}

function normalizeSessionStatus(value) {
  const status = safeText(value).toLowerCase();
  if (status === SESSION_STATUS_ENDED) return SESSION_STATUS_ENDED;
  if (status === SESSION_STATUS_EXPIRED) return SESSION_STATUS_EXPIRED;
  return SESSION_STATUS_ACTIVE;
}

function normalizeRequiredDuration(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 7 * 24 * 60) {
    throw lifecycleError(400, `${label} must be a whole number from 1 to 10080.`);
  }
  return number;
}

function normalizePositiveWholeNumber(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeDateOrThrow(value, label) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw lifecycleError(400, `${label} is invalid.`);
  return date;
}

function parseDateMs(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function lifecycleError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function safeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

module.exports = {
  DEFAULT_STUDENT_SESSION_MINUTES,
  JOIN_CODE_ALPHABET,
  SESSION_STATUS_ACTIVE,
  SESSION_STATUS_ENDED,
  SESSION_STATUS_EXPIRED,
  applyStudentSessionLifecycleAction,
  findSessionByJoinCode,
  generateJoinCode,
  generateUniqueJoinCode,
  getDefaultStudentSessionMinutes,
  initializeStudentSessionLifecycle,
  isValidJoinCode,
  normalizeJoinCode,
  normalizeSessionDurationMinutes,
  refreshStudentSessionStatus,
  registerStudentPageRoutes,
  resolveActiveStudentSession,
  resolveStudentSession,
  sendStudentSessionAccessError,
  serializeStudentSessionLifecycle,
  studentSessionAccessFromRequest
};
