const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const DEFAULT_AUTH_FILE = path.join(__dirname, '..', '..', 'logs', 'teacher_auth.json');
const SESSION_COOKIE_NAME = 'teacher_session';
const PIN_MIN_LENGTH = 6;
const SCRYPT_KEY_LENGTH = 64;
const RECOVERY_CODE_LENGTH = 16;

function hashSecret(secret, options = {}) {
  const salt = options.salt || crypto.randomBytes(16).toString('hex');
  const keyLength = Number(options.keyLength || SCRYPT_KEY_LENGTH);
  const hash = crypto.scryptSync(String(secret), salt, keyLength).toString('hex');

  return {
    algorithm: 'scrypt',
    salt,
    keyLength,
    hash
  };
}

function verifySecret(secret, secretHash) {
  if (!secretHash || secretHash.algorithm !== 'scrypt' || !secretHash.salt || !secretHash.hash) {
    return false;
  }

  const keyLength = Number(secretHash.keyLength || SCRYPT_KEY_LENGTH);
  const expected = Buffer.from(String(secretHash.hash), 'hex');
  const actual = crypto.scryptSync(String(secret), String(secretHash.salt), keyLength);

  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function hashPin(pin, options = {}) {
  return hashSecret(pin, options);
}

function verifyPin(pin, pinHash) {
  return verifySecret(pin, pinHash);
}

function generateRecoveryCode() {
  return crypto.randomBytes(12).toString('base64url').slice(0, RECOVERY_CODE_LENGTH).toUpperCase();
}

function hashRecoveryCode(recoveryCode, options = {}) {
  return hashSecret(normalizeRecoveryCode(recoveryCode), options);
}

function verifyRecoveryCode(recoveryCode, recoveryCodeHash) {
  return verifySecret(normalizeRecoveryCode(recoveryCode), recoveryCodeHash);
}

function createTeacherAuthStore(authFile = DEFAULT_AUTH_FILE) {
  return {
    authFile,
    exists() {
      return fs.existsSync(authFile);
    },
    read() {
      if (!fs.existsSync(authFile)) return null;
      const raw = fs.readFileSync(authFile, 'utf8');
      return JSON.parse(raw);
    },
    async createTeacher({ username, pin, linkedGoogleEmail = '', linkedGoogleName = '' }) {
      if (fs.existsSync(authFile)) {
        const error = new Error('A teacher account already exists.');
        error.statusCode = 409;
        throw error;
      }

      const cleanUsername = normalizeUsername(username);
      validatePin(pin);

      const now = new Date().toISOString();
      const recoveryCode = generateRecoveryCode();
      const record = {
        username: cleanUsername,
        linkedGoogleEmail: String(linkedGoogleEmail || '').trim(),
        linkedGoogleName: String(linkedGoogleName || '').trim(),
        googleLinkedAt: '',
        createdAt: now,
        updatedAt: now,
        pinHash: hashPin(pin),
        recoveryCodeHash: hashRecoveryCode(recoveryCode),
        recoveryCodeRotatedAt: now
      };

      await fsp.mkdir(path.dirname(authFile), { recursive: true });
      await fsp.writeFile(authFile, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
      await chmodPrivate(authFile);
      return {
        teacher: sanitizeTeacher(record),
        recoveryCode
      };
    },
    verifyLogin({ username, pin }) {
      const record = this.read();
      if (!record) return null;
      if (normalizeUsername(username) !== normalizeUsername(record.username)) return null;
      if (!verifyPin(pin, record.pinHash)) return null;
      return sanitizeTeacher(record);
    },
    verifyRecovery({ username, recoveryCode }) {
      const record = this.read();
      if (!record) return null;
      if (normalizeUsername(username) !== normalizeUsername(record.username)) return null;
      if (!verifyRecoveryCode(recoveryCode, record.recoveryCodeHash)) return null;
      return sanitizeTeacher(record);
    },
    async rotateRecoveryCode() {
      const record = this.read();
      if (!record) {
        const error = new Error('Teacher account not found.');
        error.statusCode = 404;
        throw error;
      }

      const recoveryCode = generateRecoveryCode();
      const nextRecord = {
        ...record,
        recoveryCodeHash: hashRecoveryCode(recoveryCode),
        recoveryCodeRotatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await writeTeacherRecord(authFile, nextRecord);
      return {
        teacher: sanitizeTeacher(nextRecord),
        recoveryCode
      };
    },
    async resetPinWithRecovery({ username, newPin }) {
      const record = this.read();
      if (!record) {
        const error = new Error('Teacher account not found.');
        error.statusCode = 404;
        throw error;
      }

      if (normalizeUsername(username) !== normalizeUsername(record.username)) {
        const error = new Error('Invalid recovery session.');
        error.statusCode = 401;
        throw error;
      }

      validatePin(newPin);
      const recoveryCode = generateRecoveryCode();
      const now = new Date().toISOString();
      const nextRecord = {
        ...record,
        pinHash: hashPin(newPin),
        recoveryCodeHash: hashRecoveryCode(recoveryCode),
        recoveryCodeRotatedAt: now,
        updatedAt: now
      };

      await writeTeacherRecord(authFile, nextRecord);
      return {
        teacher: sanitizeTeacher(nextRecord),
        recoveryCode
      };
    },
    async updateGoogleIdentity({ email = '', name = '' }) {
      const record = this.read();
      if (!record) {
        const error = new Error('Create a local teacher account before connecting Google.');
        error.statusCode = 409;
        throw error;
      }

      const nextRecord = {
        ...record,
        linkedGoogleEmail: String(email || '').trim(),
        linkedGoogleName: String(name || '').trim(),
        googleLinkedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await writeTeacherRecord(authFile, nextRecord);
      return sanitizeTeacher(nextRecord);
    },
    async clearGoogleIdentity() {
      const record = this.read();
      if (!record) return null;

      const nextRecord = {
        ...record,
        linkedGoogleEmail: '',
        linkedGoogleName: '',
        googleLinkedAt: '',
        updatedAt: new Date().toISOString()
      };

      await writeTeacherRecord(authFile, nextRecord);
      return sanitizeTeacher(nextRecord);
    }
  };
}

function createTeacherSessionStore() {
  const sessions = new Map();

  return {
    createSession(teacher) {
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, {
        sessionId,
        teacher,
        createdAt: new Date().toISOString()
      });
      return sessionId;
    },
    getSession(sessionId) {
      if (!sessionId) return null;
      return sessions.get(sessionId) || null;
    },
    deleteSession(sessionId) {
      if (sessionId) sessions.delete(sessionId);
    }
  };
}

function requireTeacherAuth(sessionStore) {
  return (req, res, next) => {
    const session = getTeacherSession(req, sessionStore);
    if (!session) {
      return res.status(401).json({ error: 'Teacher login required.' });
    }

    req.teacher = session.teacher;
    req.teacherSession = session;
    next();
  };
}

function getTeacherSession(req, sessionStore) {
  const sessionId = readCookie(req, SESSION_COOKIE_NAME);
  return sessionStore.getSession(sessionId);
}

function setSessionCookie(res, sessionId, req) {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (req?.secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ].join('; '));
}

function readCookie(req, name) {
  const header = String(req.headers?.cookie || '');
  const cookies = header.split(';');

  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === name) return decodeURIComponent(rawValue.join('=') || '');
  }

  return '';
}

function normalizeUsername(username) {
  const cleanUsername = String(username || '').trim();
  if (!cleanUsername) {
    const error = new Error('Username is required.');
    error.statusCode = 400;
    throw error;
  }
  return cleanUsername;
}

function validatePin(pin) {
  if (String(pin || '').length < PIN_MIN_LENGTH) {
    const error = new Error('PIN/password must be at least 6 characters.');
    error.statusCode = 400;
    throw error;
  }
}

function normalizeRecoveryCode(recoveryCode) {
  return String(recoveryCode || '').trim().replace(/\s+/g, '').toUpperCase();
}

function sanitizeTeacher(record) {
  return {
    username: record.username,
    linkedGoogleEmail: record.linkedGoogleEmail || '',
    linkedGoogleName: record.linkedGoogleName || '',
    googleLinkedAt: record.googleLinkedAt || '',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function sanitizeTeacherProfileStatus({ authStore, authenticated = false, gmailStatus = {} }) {
  const record = authStore.read();
  const teacher = record ? sanitizeTeacher(record) : null;
  const gmailConnected = Boolean(gmailStatus.gmailConnected || gmailStatus.googleConnected);

  return {
    localTeacherAuthExists: Boolean(record),
    setupRequired: !record,
    teacherAuthenticated: Boolean(authenticated),
    authenticated: Boolean(authenticated),
    googleConfigured: Boolean(gmailStatus.googleConfigured),
    googleConnected: gmailConnected,
    gmailConnected,
    canSendEmail: Boolean(gmailStatus.canSendEmail && gmailConnected),
    username: teacher?.username || '',
    linkedGoogleEmail: teacher?.linkedGoogleEmail || '',
    linkedGoogleName: teacher?.linkedGoogleName || '',
    googleLinkedAt: teacher?.googleLinkedAt || '',
    teacher,
    message: gmailStatus.message || 'Google sign-in is not connected yet.',
    connectUrl: gmailStatus.connectUrl || '/api/profile/google/start',
    disconnectUrl: '/api/profile/google/disconnect',
    requiredEnv: Array.isArray(gmailStatus.requiredEnv) ? gmailStatus.requiredEnv : []
  };
}

async function writeTeacherRecord(authFile, record) {
  await fsp.mkdir(path.dirname(authFile), { recursive: true });
  const tempFile = `${authFile}.tmp`;
  await fsp.writeFile(tempFile, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  await chmodPrivate(tempFile);
  await fsp.rename(tempFile, authFile);
  await chmodPrivate(authFile);
}

async function chmodPrivate(file) {
  try {
    await fsp.chmod(file, 0o600);
  } catch {
    // Some filesystems do not support POSIX permissions; the app can still run locally.
  }
}

module.exports = {
  DEFAULT_AUTH_FILE,
  PIN_MIN_LENGTH,
  RECOVERY_CODE_LENGTH,
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createTeacherAuthStore,
  createTeacherSessionStore,
  generateRecoveryCode,
  getTeacherSession,
  hashRecoveryCode,
  hashPin,
  requireTeacherAuth,
  sanitizeTeacherProfileStatus,
  setSessionCookie,
  validatePin,
  verifyRecoveryCode,
  verifyPin
};
