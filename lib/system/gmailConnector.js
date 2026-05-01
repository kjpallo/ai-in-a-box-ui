const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const logsDir = path.join(__dirname, '..', '..', 'logs');
const authPath = path.join(logsDir, 'teacher_gmail_auth.json');
const stateTtlMs = 10 * 60 * 1000;
const pendingStates = new Map();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

const GMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send'
];

function getProfileStatus() {
  const config = getGoogleConfig();
  const auth = readAuth();
  const teacher = normalizeTeacher(auth.teacher);
  const connected = Boolean(config.configured && teacher && hasUsableAuth(auth));

  let message = 'Google sign-in is not connected yet.';
  if (!config.configured) {
    message = 'Google OAuth is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then restart the app.';
  } else if (connected) {
    message = 'Gmail is connected and ready for daily reports.';
  } else {
    message = 'Google OAuth is configured. Connect Gmail to send daily reports.';
  }

  return {
    googleConfigured: config.configured,
    googleConnected: connected,
    gmailConnected: connected,
    teacher: connected ? teacher : null,
    message,
    connectUrl: '/api/profile/google/start',
    canSendEmail: connected,
    redirectUri: config.redirectUri,
    requiredEnv: config.configured ? [] : ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
  };
}

function createGoogleConnectUrl() {
  const config = getGoogleConfig();
  if (!config.configured) {
    throw httpError(400, 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.');
  }

  prunePendingStates();
  const state = crypto.randomBytes(24).toString('hex');
  pendingStates.set(state, Date.now());

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GMAIL_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  return url.toString();
}

async function completeGoogleConnect(query = {}) {
  const error = firstText(query.error);
  if (error) {
    throw httpError(400, `Google sign-in was not completed: ${error}`);
  }

  const code = firstText(query.code);
  const state = firstText(query.state);
  if (!code || !state || !isValidPendingState(state)) {
    throw httpError(400, 'Google sign-in could not be verified. Please try connecting Gmail again.');
  }

  const config = getGoogleConfig();
  if (!config.configured) {
    throw httpError(400, 'Google OAuth is not configured.');
  }

  pendingStates.delete(state);
  const tokenPayload = await postGoogleToken({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code'
  });

  const existing = readAuth();
  const accessToken = firstText(tokenPayload.access_token);
  const teacher = await fetchTeacherProfile(accessToken);
  const auth = {
    teacher,
    accessToken,
    refreshToken: firstText(tokenPayload.refresh_token) || firstText(existing.refreshToken),
    tokenType: firstText(tokenPayload.token_type) || 'Bearer',
    scope: firstText(tokenPayload.scope),
    expiresAt: expiresAtFromPayload(tokenPayload),
    updatedAt: new Date().toISOString()
  };

  if (!auth.refreshToken) {
    throw httpError(400, 'Google did not return a refresh token. Try connecting again and approve offline Gmail access.');
  }

  writeAuth(auth);
  return getProfileStatus();
}

async function sendDailySummaryEmail(summary) {
  const config = getGoogleConfig();
  if (!config.configured) {
    throw httpError(400, 'Google OAuth is not configured.');
  }

  const auth = readAuth();
  const teacher = normalizeTeacher(auth.teacher);
  if (!teacher || !teacher.email) {
    throw httpError(409, 'Connect Gmail before sending daily reports.');
  }

  const accessToken = await getValidAccessToken(config, auth);
  const date = firstText(summary?.date) || localDateKey(new Date());
  const subject = `Charlemagne daily summary for ${date}`;
  const body = buildDailySummaryBody(summary, teacher);
  const raw = toBase64Url(buildMimeMessage({
    to: teacher.email,
    subject,
    body
  }));

  const response = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw httpError(response.status, googleErrorMessage(payload, 'Could not send the daily summary email.'));
  }

  return {
    sent: true,
    to: teacher.email,
    subject,
    date,
    messageId: payload.id || '',
    threadId: payload.threadId || ''
  };
}

function getGoogleConfig() {
  const clientId = firstText(process.env.GOOGLE_CLIENT_ID, process.env.GMAIL_CLIENT_ID);
  const clientSecret = firstText(process.env.GOOGLE_CLIENT_SECRET, process.env.GMAIL_CLIENT_SECRET);
  const port = firstText(process.env.PORT) || '3000';
  const publicBaseUrl = firstText(process.env.PUBLIC_BASE_URL) || `http://localhost:${port}`;
  const redirectUri = firstText(
    process.env.GOOGLE_REDIRECT_URI,
    process.env.GMAIL_REDIRECT_URI
  ) || `${publicBaseUrl.replace(/\/+$/, '')}/api/profile/google/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret && redirectUri)
  };
}

async function getValidAccessToken(config, auth) {
  if (auth.accessToken && !isExpired(auth.expiresAt)) {
    return auth.accessToken;
  }

  if (!auth.refreshToken) {
    throw httpError(409, 'Gmail access expired. Connect Gmail again.');
  }

  const tokenPayload = await postGoogleToken({
    refresh_token: auth.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token'
  });

  const nextAuth = {
    ...auth,
    accessToken: firstText(tokenPayload.access_token),
    tokenType: firstText(tokenPayload.token_type) || auth.tokenType || 'Bearer',
    scope: firstText(tokenPayload.scope) || auth.scope || '',
    expiresAt: expiresAtFromPayload(tokenPayload),
    updatedAt: new Date().toISOString()
  };

  writeAuth(nextAuth);
  return nextAuth.accessToken;
}

async function postGoogleToken(values) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(values)
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw httpError(response.status, googleErrorMessage(payload, 'Google token exchange failed.'));
  }

  return payload;
}

async function fetchTeacherProfile(accessToken) {
  if (!accessToken) {
    throw httpError(400, 'Google did not return an access token.');
  }

  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw httpError(response.status, googleErrorMessage(payload, 'Could not load Google profile information.'));
  }

  return normalizeTeacher({
    email: payload.email,
    firstName: payload.given_name,
    lastName: payload.family_name,
    name: payload.name,
    picture: payload.picture
  });
}

function readAuth() {
  if (!fs.existsSync(authPath)) return {};

  try {
    const raw = fs.readFileSync(authPath, 'utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAuth(auth) {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const tempPath = `${authPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(auth, null, 2)}\n`, 'utf8');
  try {
    fs.chmodSync(tempPath, 0o600);
  } catch {
    // Best-effort local token privacy; the file remains ignored by Git.
  }
  fs.renameSync(tempPath, authPath);
}

function hasUsableAuth(auth) {
  return Boolean(auth.refreshToken || (auth.accessToken && !isExpired(auth.expiresAt)));
}

function isExpired(expiresAt) {
  const timestamp = Number(expiresAt || 0);
  return !timestamp || Date.now() > timestamp - 60_000;
}

function expiresAtFromPayload(payload) {
  const seconds = Number(payload.expires_in || 3600);
  return Date.now() + Math.max(60, seconds) * 1000;
}

function normalizeTeacher(teacher) {
  if (!teacher || typeof teacher !== 'object') return null;

  const email = firstText(teacher.email);
  const firstName = firstText(teacher.firstName, teacher.given_name);
  const lastName = firstText(teacher.lastName, teacher.family_name);
  const name = firstText(teacher.name, [firstName, lastName].filter(Boolean).join(' '));

  if (!email && !firstName && !lastName && !name) return null;

  return {
    email,
    firstName,
    lastName,
    name,
    picture: firstText(teacher.picture)
  };
}

function buildDailySummaryBody(summary, teacher) {
  const date = firstText(summary?.date) || localDateKey(new Date());
  const questions = Array.isArray(summary?.questions) ? summary.questions : [];
  const topics = Array.isArray(summary?.topics) ? summary.topics : [];
  const firstName = firstText(teacher.firstName, teacher.name, 'Teacher');

  const lines = [
    `Hi ${firstName},`,
    '',
    `Here is the Charlemagne daily question summary for ${date}.`,
    '',
    `Total questions: ${Number(summary?.totalQuestions || questions.length || 0)}`,
    '',
    'Topic summary:'
  ];

  if (topics.length) {
    for (const topic of topics) {
      lines.push(`- ${topic.topic || 'other'}: ${Number(topic.count || 0)} question${Number(topic.count || 0) === 1 ? '' : 's'} (${formatPercent(topic.percent)})`);
    }
  } else {
    lines.push('- No topic activity was logged for this date.');
  }

  lines.push('', 'Question rundown:');

  if (questions.length) {
    questions.slice(0, 25).forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.time || 'Unknown time'} | ${item.topic || 'other'} | ${item.routeType || 'unknown'} | ${item.confidence || 'unknown'}`,
        `   Q: ${oneLine(item.question)}`,
        `   A: ${oneLine(item.responsePreview) || 'No response preview logged.'}`
      );
    });

    if (questions.length > 25) {
      lines.push(`...and ${questions.length - 25} more question${questions.length - 25 === 1 ? '' : 's'}.`);
    }
  } else {
    lines.push('No question activity was logged for this date.');
  }

  lines.push('', 'This report was generated locally from Charlemagne logs.');
  return lines.join('\n');
}

function buildMimeMessage({ to, subject, body }) {
  return [
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body
  ].join('\r\n');
}

function encodeHeader(value) {
  const text = sanitizeHeader(value);
  return /^[\x00-\x7F]*$/.test(text)
    ? text
    : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function sanitizeHeader(value) {
  return firstText(value).replace(/[\r\n]+/g, ' ').trim();
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function googleErrorMessage(payload, fallback) {
  return firstText(
    payload?.error_description,
    payload?.error?.message,
    payload?.message,
    payload?.error,
    fallback
  );
}

function isValidPendingState(state) {
  prunePendingStates();
  return pendingStates.has(state);
}

function prunePendingStates() {
  const now = Date.now();
  for (const [state, createdAt] of pendingStates.entries()) {
    if (now - createdAt > stateTtlMs) {
      pendingStates.delete(state);
    }
  }
}

function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;

    const text = String(value).trim();
    if (text) return text;
  }

  return '';
}

function oneLine(value) {
  return firstText(value).replace(/\s+/g, ' ');
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${Math.round(number * 10) / 10}%`;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  getProfileStatus,
  createGoogleConnectUrl,
  completeGoogleConnect,
  sendDailySummaryEmail
};
