const crypto = require('crypto');
const { getStandardsBankDetails } = require('../lib/standards/standardsBankDiscovery');
const { loadMissouriStandardsBank } = require('../lib/standards/standardsMatcher');

function registerProfileRoutes(app, {
  completeGoogleConnect,
  createGoogleConnectUrl,
  clearGoogleIdentity,
  disconnectGoogle,
  getAvailableProfileDates,
  getDailyQuestionSummary,
  getClassroomControls,
  getStandardsSummaryReport,
  getProfileStatus,
  linkGoogleIdentity,
  port,
  sendDailySummaryEmail,
  studentSessions,
  getStudentRateLimitInfo,
  questionRateLimiter
}) {
  app.get('/api/profile/status', (req, res) => {
    res.json(getProfileStatus(req));
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
      messages: [],
      anonymousHubs: Object.create(null)
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
      .map(serializeClassSession)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    res.json({ sessions });
  });

  app.get('/api/profile/live-student-activity', (_req, res) => {
    const sessions = serializeLiveStudentActivity({
      studentSessions,
      getClassroomControls,
      getStudentRateLimitInfo,
      questionRateLimiter
    });

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
      const googleStatus = await completeGoogleConnect(req.query);
      const teacher = googleStatus?.teacher || {};
      await linkGoogleIdentity({
        email: teacher.email || '',
        name: teacher.name || [teacher.firstName, teacher.lastName].filter(Boolean).join(' ')
      });
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

  app.post('/api/profile/google/disconnect', async (_req, res) => {
    try {
      disconnectGoogle();
      const teacher = await clearGoogleIdentity();
      res.json({ ok: true, teacher });
    } catch (error) {
      sendProfileError(res, error);
    }
  });

  app.get('/api/profile/dates', (_req, res) => {
    res.json(getAvailableProfileDates());
  });

  app.get('/api/profile/question-summary', (req, res) => {
    res.json(getDailyQuestionSummary(req.query.date));
  });

  app.get('/api/profile/standards-summary', (req, res) => {
    try {
      res.json({
        ok: true,
        summary: getStandardsSummaryReport(req.query.date)
      });
    } catch {
      res.status(500).json({
        ok: false,
        error: 'Unable to build standards summary report.'
      });
    }
  });

  app.get('/api/profile/standard-details/:standardId', (req, res) => {
    const standardId = String(req.params?.standardId || '').trim();
    const standardsBankId = String(req.query?.standardsBankId || '').trim();
    if (!standardId) {
      res.status(400).json({ ok: false, error: 'standardId is required.' });
      return;
    }

    try {
      res.json({
        ok: true,
        standard: getProfileStandardDetails(standardId, standardsBankId)
      });
    } catch {
      res.json({
        ok: true,
        standard: { standardId }
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

function getProfileStandardDetails(standardId, standardsBankId = '') {
  const fromSavedBank = standardsBankId && standardsBankId !== 'missouri_science_6_12'
    ? getSavedStandardsBankDetail(standardId, standardsBankId)
    : null;
  if (fromSavedBank) return fromSavedBank;

  const bank = loadMissouriStandardsBank();
  const standard = Array.isArray(bank.standards)
    ? bank.standards.find((item) => item && item.standardId === standardId)
    : null;

  return normalizeProfileStandardDetail(standard || { standardId }, bank.bankId || standardsBankId);
}

function getSavedStandardsBankDetail(standardId, standardsBankId) {
  const result = getStandardsBankDetails(standardsBankId, { maxStandards: 1000 });
  if (!result.success) return null;

  const standards = Array.isArray(result.standardsBank?.standards) ? result.standardsBank.standards : [];
  const standard = standards.find((item) => item && item.standardId === standardId);
  return standard ? normalizeProfileStandardDetail(standard, standardsBankId) : null;
}

function normalizeProfileStandardDetail(standard, standardsBankId = '') {
  const item = standard || {};
  return {
    standardId: textField(item, 'standardId'),
    standardsBankId,
    code: textField(item, 'code'),
    title: textField(item, 'title'),
    label: textField(item, 'label') || textField(item, 'teacherShortName') || textField(item, 'title'),
    officialStandard: textField(item, 'officialStandard') || textField(item, 'officialText'),
    officialText: textField(item, 'officialText'),
    standardText: textField(item, 'statement') || textField(item, 'description'),
    statement: textField(item, 'statement'),
    studentFriendlyStandard: textField(item, 'studentFriendlyStandard') || textField(item, 'studentFriendlyText'),
    studentFriendlyText: textField(item, 'studentFriendlyText'),
    studentCanStatement: textField(item, 'studentCanStatement'),
    teacherShortName: textField(item, 'teacherShortName'),
    unit: textField(item, 'unit'),
    topic: textField(item, 'topic'),
    conceptTitle: textField(item, 'conceptTitle'),
    classroomArea: textField(item, 'classroomArea'),
    domainName: textField(item, 'domainName'),
    domainCode: textField(item, 'domainCode'),
    strandTitle: textField(item, 'strandTitle') || textField(item, 'strand'),
    strandCode: textField(item, 'strandCode')
  };
}

function textField(item, field) {
  return typeof item?.[field] === 'string' ? item[field].trim() : '';
}

function buildStudentUrl(req, sessionId, port) {
  const host = req.get('host') || `localhost:${port}`;
  const protocol = req.protocol || 'http';
  return `${protocol}://${host}/student.html?sessionId=${encodeURIComponent(sessionId)}`;
}

function serializeClassSession(session) {
  const now = Date.now();
  const hubs = Object.values(session.anonymousHubs || {})
    .map((hub, index) => ({
      label: `Anonymous Student ${index + 1}`,
      studentHubId: hub.studentHubId || '',
      firstSeenAt: hub.firstSeenAt || '',
      lastSeenAt: hub.lastSeenAt || '',
      messageCount: Number(hub.messageCount || 0),
      active: isRecentlyActive(hub.lastSeenAt, now)
    }))
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return String(a.firstSeenAt || '').localeCompare(String(b.firstSeenAt || ''));
    })
    .map((hub, index) => ({
      ...hub,
      label: `Anonymous Student ${index + 1}`
    }));

  return {
    className: session.className || '',
    sessionId: session.sessionId,
    classSessionId: session.sessionId,
    createdAt: session.createdAt,
    studentUrl: session.studentUrl || `/student.html?sessionId=${encodeURIComponent(session.sessionId)}`,
    activeAnonymousHubCount: hubs.filter((hub) => hub.active).length,
    anonymousHubs: hubs
  };
}

function serializeLiveStudentActivity({
  studentSessions,
  getClassroomControls,
  getStudentRateLimitInfo,
  questionRateLimiter,
  now = Date.now()
}) {
  const controls = typeof getClassroomControls === 'function' ? getClassroomControls() : null;
  return Object.values(studentSessions || {})
    .map((session) => serializeLiveClassSession(session, {
      controls,
      getStudentRateLimitInfo,
      questionRateLimiter,
      now
    }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function serializeLiveClassSession(session, {
  controls,
  getStudentRateLimitInfo,
  questionRateLimiter,
  now = Date.now()
} = {}) {
  const rawHubs = Object.values(session?.anonymousHubs || {});
  const displayOrderByHubId = new Map(rawHubs
    .slice()
    .sort(compareHubsForStableDisplay)
    .map((hub, index) => [safeText(hub?.studentHubId), index]));
  const hubs = rawHubs
    .map((hub, index) => serializeLiveStudentHub(hub, {
      classSessionId: session?.sessionId || '',
      controls,
      getStudentRateLimitInfo,
      index,
      now,
      questionRateLimiter,
      stableDisplayIndex: displayOrderByHubId.get(safeText(hub?.studentHubId))
    }))
    .sort(compareLiveStudentHubs);

  return {
    className: session?.className || '',
    sessionId: session?.sessionId || '',
    classSessionId: session?.sessionId || '',
    createdAt: session?.createdAt || '',
    studentUrl: session?.studentUrl || (session?.sessionId ? `/student.html?sessionId=${encodeURIComponent(session.sessionId)}` : ''),
    activeAnonymousHubCount: hubs.filter((hub) => hub.active).length,
    anonymousHubCount: hubs.length,
    anonymousHubs: hubs,
    students: hubs
  };
}

function serializeLiveStudentHub(hub, {
  classSessionId,
  controls,
  getStudentRateLimitInfo,
  index = 0,
  now = Date.now(),
  questionRateLimiter,
  stableDisplayIndex
} = {}) {
  const messages = Array.isArray(hub?.messages) ? hub.messages : [];
  const latest = findLatestMessage(messages);
  const active = isRecentlyActive(hub?.lastSeenAt, now);
  const rateLimit = serializeHubRateLimit({
    classSessionId,
    controls,
    getStudentRateLimitInfo,
    questionRateLimiter,
    studentHubId: hub?.studentHubId || ''
  });
  const formulaTutorActive = isFormulaTutorActive(hub?.currentTutorProblem);
  const displayNumber = Number.isInteger(stableDisplayIndex) ? stableDisplayIndex + 1 : index + 1;
  const displayName = `Anonymous Student ${displayNumber}`;

  return {
    label: displayName,
    displayName,
    classSessionId: safeText(classSessionId),
    sessionId: safeText(classSessionId),
    studentHubId: safeText(hub?.studentHubId),
    firstSeenAt: safeText(hub?.firstSeenAt),
    lastSeenAt: safeText(hub?.lastSeenAt),
    lastMessageAt: safeText(hub?.lastMessageAt || latest?.createdAt || latest?.time),
    messageCount: Number(hub?.messageCount || messages.length || 0),
    active,
    status: active ? 'active' : 'idle',
    latestQuestion: safeText(latest?.question || latest?.message),
    latestResponse: safeText(latest?.response),
    routeType: safeText(latest?.routeType),
    confidence: safeText(latest?.confidence),
    standardId: safeText(latest?.standardId),
    topic: safeText(latest?.topic || latest?.title || latest?.sourceTopic),
    source: safeText(latest?.source || latest?.sourceName),
    rateLimit,
    alerts: buildLiveStudentAlerts({ latest, rateLimit, formulaTutorActive }),
    recentMessages: messages.slice(-10).map(serializeRecentLiveMessage).filter(Boolean)
  };
}

function compareHubsForStableDisplay(a, b) {
  const firstSeen = String(a?.firstSeenAt || '').localeCompare(String(b?.firstSeenAt || ''));
  if (firstSeen !== 0) return firstSeen;
  return String(a?.studentHubId || '').localeCompare(String(b?.studentHubId || ''));
}

function compareLiveStudentHubs(a, b) {
  if (a.active !== b.active) return a.active ? -1 : 1;
  const aLast = String(a.lastMessageAt || a.lastSeenAt || '');
  const bLast = String(b.lastMessageAt || b.lastSeenAt || '');
  if (aLast !== bLast) return bLast.localeCompare(aLast);
  return String(a.firstSeenAt || '').localeCompare(String(b.firstSeenAt || ''));
}

function findLatestMessage(messages) {
  if (!Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (entry && typeof entry === 'object') return entry;
  }
  return null;
}

function serializeRecentLiveMessage(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const serialized = {
    time: safeText(entry.time || entry.createdAt),
    question: safeText(entry.question || entry.message),
    message: safeText(entry.message || entry.question),
    response: safeText(entry.response),
    routeType: safeText(entry.routeType),
    confidence: safeText(entry.confidence),
    standardId: safeText(entry.standardId)
  };

  addOptionalText(serialized, 'topic', entry.topic || entry.title || entry.sourceTopic);
  addOptionalText(serialized, 'source', entry.source || entry.sourceName);
  addOptionalSafeObject(serialized, 'debug', entry.debug);
  addOptionalSafeObject(serialized, 'sourceMetadata', entry.sourceMetadata || entry.sourceDebug);

  return serialized;
}

function serializeHubRateLimit({
  classSessionId,
  controls,
  getStudentRateLimitInfo,
  questionRateLimiter,
  studentHubId
}) {
  if (
    !controls ||
    !questionRateLimiter ||
    typeof getStudentRateLimitInfo !== 'function' ||
    !classSessionId ||
    !studentHubId
  ) {
    return null;
  }

  const status = getStudentRateLimitInfo({
    controls,
    questionRateLimiter,
    classSessionId,
    studentHubId
  });
  const remainingWhole = Number(status?.remainingWhole);
  const limited = Boolean(status?.enabled) && Number.isFinite(remainingWhole) && remainingWhole < 1;

  return {
    enabled: Boolean(status?.enabled),
    limit: Number(status?.limit || 0),
    max: Number(status?.max || status?.limit || 0),
    maxQuestionsPerMinute: Number(status?.max || status?.limit || 0),
    remaining: Number(status?.remaining || 0),
    remainingWhole: Number.isFinite(remainingWhole) ? remainingWhole : 0,
    limited,
    notLimited: !limited,
    secondsUntilNextQuestion: Number(status?.secondsUntilNextQuestion || 0),
    secondsUntilFull: Number(status?.secondsUntilFull || 0),
    windowSeconds: Number(status?.windowSeconds || 60),
    resetInSeconds: Number(status?.resetInSeconds || status?.secondsUntilNextQuestion || 0)
  };
}

function buildLiveStudentAlerts({ latest, rateLimit, formulaTutorActive }) {
  const confidence = String(latest?.confidence || '').trim().toLowerCase();
  const routeType = String(latest?.routeType || '').trim().toLowerCase();
  const missingStandard = Boolean(latest) && !safeText(latest?.standardId);
  const noMatch = routeType === 'no_match';
  const lowConfidence = ['low', 'weak'].includes(confidence);
  const outOfQuestions = Boolean(rateLimit?.limited);
  return {
    needsReview: noMatch || lowConfidence || outOfQuestions,
    missingStandard,
    noMatch,
    lowConfidence,
    outOfQuestions,
    formulaTutorActive: Boolean(formulaTutorActive)
  };
}

function isFormulaTutorActive(currentTutorProblem) {
  if (!currentTutorProblem || typeof currentTutorProblem !== 'object') return false;
  const tutorType = String(currentTutorProblem.tutorType || '').toLowerCase();
  return tutorType === 'formula' || tutorType === 'formula_tutor' || Boolean(currentTutorProblem.formulaId);
}

function addOptionalText(target, field, value) {
  const text = safeText(value);
  if (text) target[field] = text;
}

function addOptionalSafeObject(target, field, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const safe = {};
  Object.entries(value).forEach(([key, item]) => {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null) {
      safe[key] = item;
    }
  });
  if (Object.keys(safe).length) target[field] = safe;
}

function safeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecentlyActive(value, now = Date.now()) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return false;
  return now - time <= 1000 * 60 * 5;
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
  registerProfileRoutes,
  serializeLiveStudentActivity
};
