const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildStudentUrl,
  createProfileStudentSession,
  parseStudentJoinCodeFromUrl
} = require('../routes/profileRoutes');
const {
  JOIN_CODE_ALPHABET,
  generateJoinCode,
  generateUniqueJoinCode,
  getDefaultStudentSessionMinutes,
  registerStudentPageRoutes
} = require('../lib/server/studentSessionLifecycle');
const {
  getProfileStatus: getGmailProfileStatus
} = require('../lib/system/gmailConnector');
const {
  hashPin,
  verifyPin
} = require('../lib/auth/teacherAuth');
const {
  createApp,
  request
} = require('./test-helpers/httpHarness');
const {
  createStudentRouteHarness
} = require('./test-helpers/studentRouteHarness');
const { projectRoot } = require('./test-helpers/fileSystem');

async function main() {
  testJoinCodeGenerationAndCollisions();
  testCleanStudentUrls();
  await testLegacyRedirectAndCleanPageRoute();
  await testActiveExpirationAndAllStudentEndpoints();
  await testManualEndExtensionReopenAndPermanentMode();
  testStudentExpiredEndedUiContract();
  testTeacherAuthAndGmailBoundaries();
  console.log('Student clean-link and session lifecycle checks passed.');
}

function testJoinCodeGenerationAndCollisions() {
  const codes = new Set(Array.from({ length: 250 }, () => generateJoinCode()));
  assert.equal(codes.size, 250, 'cryptographic join-code generation should not repeat in the sample');
  for (const code of codes) {
    assert.match(code, /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}$/);
    assert.doesNotMatch(code, /[01ILOU]/, 'join code should exclude confusing characters');
  }
  assert.ok(Math.log2(JOIN_CODE_ALPHABET.length) * 10 >= 49, 'join codes should carry approximately 50 bits of entropy');

  const studentSessions = {
    existing: {
      sessionId: 'existing',
      joinCode: 'ABCDE-FGHJK',
      archivedAt: '2026-07-26T00:00:00.000Z'
    }
  };
  const candidates = ['ABCDE-FGHJK', 'K7M4Q-P9X2D'];
  const collisionSafe = generateUniqueJoinCode(studentSessions, {
    generateCode: () => candidates.shift()
  });
  assert.equal(collisionSafe, 'K7M4Q-P9X2D', 'collision handling should retry even for archived runtime sessions');
  assert.equal(getDefaultStudentSessionMinutes({}), 60);
  assert.equal(getDefaultStudentSessionMinutes({ STUDENT_SESSION_DEFAULT_MINUTES: '90' }), 90);
}

function testCleanStudentUrls() {
  const originalPublicBaseUrl = process.env.PUBLIC_BASE_URL;
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  try {
    process.env.PUBLIC_BASE_URL = 'http://10.0.0.59:3000/';
    delete process.env.APP_BASE_URL;
    const url = buildStudentUrl(makeRequest('attacker.invalid', 'http'), 'K7M4Q-P9X2D', 3000);
    assert.equal(url, 'http://10.0.0.59:3000/join/K7M4Q-P9X2D');
    assert.doesNotMatch(url, /sessionId|classSessionId|\?/);

    delete process.env.PUBLIC_BASE_URL;
    const noForwardedTrust = makeRequest('teacher-mac.local:3000', 'http');
    noForwardedTrust.headers['x-forwarded-host'] = 'attacker.invalid';
    noForwardedTrust.headers['x-forwarded-proto'] = 'https';
    assert.equal(
      buildStudentUrl(noForwardedTrust, 'K7M4Q-P9X2D', 3000),
      'http://teacher-mac.local:3000/join/K7M4Q-P9X2D'
    );
  } finally {
    restoreEnv('PUBLIC_BASE_URL', originalPublicBaseUrl);
    restoreEnv('APP_BASE_URL', originalAppBaseUrl);
  }
}

async function testLegacyRedirectAndCleanPageRoute() {
  const studentSessions = Object.create(null);
  const session = createProfileStudentSession({
    className: 'Redirect Test',
    durationMinutes: 60,
    now: new Date('2026-07-26T12:00:00.000Z'),
    port: 3000,
    req: makeRequest('teacher-mac.local:3000', 'http'),
    studentSessions
  });
  const handlers = new Map();
  registerStudentPageRoutes(createApp(handlers, ['get']), {
    studentSessions,
    studentPagePath: path.join(projectRoot, 'public', 'student.html')
  });

  const oldLink = await request(
    handlers,
    'GET',
    '/student.html',
    {},
    {},
    { sessionId: session.sessionId }
  );
  assert.equal(oldLink.statusCode, 302);
  assert.equal(oldLink.body.redirect, session.studentUrl);
  assert.doesNotMatch(oldLink.body.redirect, new RegExp(session.sessionId));

  const cleanPage = await request(
    handlers,
    'GET',
    '/join/:joinCode',
    {},
    { joinCode: session.joinCode }
  );
  assert.equal(cleanPage.statusCode, 200);
  assert.equal(cleanPage.body.filePath, path.join(projectRoot, 'public', 'student.html'));
  assert.equal(parseStudentJoinCodeFromUrl(session.studentUrl), session.joinCode);
}

async function testActiveExpirationAndAllStudentEndpoints() {
  let clock = new Date('2026-07-26T12:00:00.000Z');
  let answerCalls = 0;
  const harness = createStudentRouteHarness({
    now: () => new Date(clock),
    answerStudentMessage: async () => {
      answerCalls += 1;
      return echoAnswer('unexpected');
    },
    studentQuestionRateLimitEnabled: true,
    studentQuestionsPerMinute: 1
  });
  const created = await harness.request('POST', '/api/profile/create-student-session', {
    durationMinutes: 45
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.status, 'active');
  assert.equal(created.body.expiresAt, '2026-07-26T12:45:00.000Z');
  assert.match(created.body.studentUrl, new RegExp(`/join/${created.body.joinCode}$`));
  assert.doesNotMatch(created.body.studentUrl, new RegExp(created.body.sessionId));

  const activeJoin = await harness.request('POST', '/api/student/join', {
    joinCode: created.body.joinCode,
    studentHubId: 'expiration-student'
  });
  assert.equal(activeJoin.statusCode, 200);
  assert.equal(activeJoin.body.sessionId, undefined);
  assert.equal(activeJoin.body.classSessionId, undefined);
  assert.equal(activeJoin.body.joinCode, created.body.joinCode);

  const beforeMessages = harness.studentSessions[created.body.sessionId]
    .anonymousHubs['expiration-student'].messages.length;
  clock = new Date('2026-07-26T12:45:00.001Z');
  const probes = await Promise.all([
    harness.request('GET', '/api/student/controls', {}, { joinCode: created.body.joinCode }),
    harness.request('GET', '/api/student/rate-limit-status', {}, {
      joinCode: created.body.joinCode,
      studentHubId: 'expiration-student'
    }),
    harness.request('POST', '/api/student/join', {
      joinCode: created.body.joinCode,
      studentHubId: 'expiration-student'
    }),
    harness.request('POST', '/api/student/message', {
      joinCode: created.body.joinCode,
      studentHubId: 'expiration-student',
      message: 'This must not be processed.'
    })
  ]);
  probes.forEach((response) => {
    assert.equal(response.statusCode, 410);
    assert.equal(response.body.code, 'SESSION_EXPIRED');
    assert.match(response.body.error, /classroom session has expired/i);
  });
  assert.equal(answerCalls, 0, 'expiration must block answer/model work before processing');
  assert.equal(
    harness.studentSessions[created.body.sessionId].anonymousHubs['expiration-student'].messages.length,
    beforeMessages,
    'expiration must not mutate student history'
  );

  const rawUnknownUuid = await harness.request('POST', '/api/student/join', {
    sessionId: '11111111-1111-4111-8111-111111111111',
    studentHubId: 'unknown'
  });
  assert.equal(rawUnknownUuid.statusCode, 404);
  assert.equal(rawUnknownUuid.body.code, 'SESSION_NOT_FOUND');
}

async function testManualEndExtensionReopenAndPermanentMode() {
  let clock = new Date('2026-07-26T13:00:00.000Z');
  const harness = createStudentRouteHarness({
    now: () => new Date(clock),
    studentGuidedFormulaTutoringEnabled: false
  });
  const created = await harness.request('POST', '/api/profile/create-student-session', {
    durationMinutes: 60
  });
  const sessionId = created.body.sessionId;
  const joinCode = created.body.joinCode;

  const studentAQuestion = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'lifecycle-student-a',
    message: 'What is mass?'
  });
  const studentBQuestion = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'lifecycle-student-b',
    message: 'What is volume?'
  });
  assert.equal(studentAQuestion.statusCode, 200);
  assert.equal(studentBQuestion.statusCode, 200);

  const extended = await lifecycleAction(harness, sessionId, {
    action: 'extend',
    minutes: 15
  });
  assert.equal(extended.statusCode, 200);
  assert.equal(extended.body.session.expiresAt, '2026-07-26T14:15:00.000Z');

  const setExpiration = await lifecycleAction(harness, sessionId, {
    action: 'set_expiration',
    minutes: 90
  });
  assert.equal(setExpiration.body.session.expiresAt, '2026-07-26T14:30:00.000Z');

  const ended = await lifecycleAction(harness, sessionId, { action: 'end' });
  assert.equal(ended.body.session.status, 'ended');
  assert.equal(ended.body.session.endedAt, '2026-07-26T13:00:00.000Z');
  for (const studentHubId of ['lifecycle-student-a', 'lifecycle-student-b']) {
    const blocked = await harness.request('POST', '/api/student/join', { joinCode, studentHubId });
    assert.equal(blocked.statusCode, 410);
    assert.equal(blocked.body.code, 'SESSION_ENDED');
  }

  const historiesBeforeReopen = snapshotHubHistories(harness.studentSessions[sessionId]);
  clock = new Date('2026-07-26T13:10:00.000Z');
  const reopened = await lifecycleAction(harness, sessionId, {
    action: 'reopen',
    minutes: 30
  });
  assert.equal(reopened.body.session.status, 'active');
  assert.equal(reopened.body.session.joinCode, joinCode);
  assert.equal(reopened.body.session.expiresAt, '2026-07-26T13:40:00.000Z');
  assert.equal(reopened.body.session.endedAt, null);

  for (const studentHubId of ['lifecycle-student-a', 'lifecycle-student-b']) {
    const restored = await harness.request('POST', '/api/student/join', { joinCode, studentHubId });
    assert.equal(restored.statusCode, 200);
  }
  assert.deepEqual(snapshotHubHistories(harness.studentSessions[sessionId]), historiesBeforeReopen);
  assert.notDeepEqual(
    historiesBeforeReopen['lifecycle-student-a'],
    historiesBeforeReopen['lifecycle-student-b'],
    'reopening must preserve separate student histories without merging'
  );

  const permanent = await harness.request('POST', '/api/profile/create-student-session', {
    noExpiration: true
  });
  assert.equal(permanent.body.status, 'active');
  assert.equal(permanent.body.expiresAt, null);
  clock = new Date('2036-07-26T13:10:00.000Z');
  const permanentJoin = await harness.request('POST', '/api/student/join', {
    joinCode: permanent.body.joinCode,
    studentHubId: 'permanent-student'
  });
  assert.equal(permanentJoin.statusCode, 200);

  const newSession = await harness.request('POST', '/api/profile/create-student-session');
  assert.notEqual(newSession.body.sessionId, sessionId);
  assert.notEqual(newSession.body.joinCode, joinCode);
  assert.equal(Object.keys(harness.studentSessions[newSession.body.sessionId].anonymousHubs).length, 0);
}

function testStudentExpiredEndedUiContract() {
  const studentHtml = fs.readFileSync(path.join(projectRoot, 'public', 'student.html'), 'utf8');
  const studentUi = fs.readFileSync(path.join(projectRoot, 'public', 'student', 'student-ui.js'), 'utf8');
  const apiClient = fs.readFileSync(path.join(projectRoot, 'public', 'api-client.js'), 'utf8');
  const bladeUi = fs.readFileSync(path.join(projectRoot, 'public', 'blade-ui.js'), 'utf8');

  assert.match(studentHtml, /id="studentSessionAccessState"/);
  assert.match(studentHtml, /id="studentSessionReopenRequest"[^>]*>Ask teacher to reopen</);
  assert.match(studentUi, /This classroom session has expired\. Ask your teacher to reopen it or provide a new link\./);
  assert.match(studentUi, /This classroom session has ended\. Ask your teacher for a new link\./);
  assert.match(studentUi, /setInterval\([\s\S]*sendHeartbeat[\s\S]*20_000/);
  assert.match(studentUi, /if \(!sessionIsValid\) await validateSession\(\)/);
  assert.match(studentUi, /hideSessionAccessState\(\)[\s\S]*setFormEnabled\(true\)/);
  const accessStateHandler = studentUi.match(/function showSessionAccessState[\s\S]*?(?=\n  function hideSessionAccessState)/)?.[0] || '';
  assert.doesNotMatch(accessStateHandler, /chatTurns|renderTimeline/, 'session access changes must not clear displayed conversation turns');
  assert.match(apiClient, /window\.location\.pathname\.startsWith\('\/join\/'\)/);
  assert.match(apiClient, /return \{ joinCode: value\.toUpperCase\(\) \}/);
  ['45', '60', '90', 'custom', 'none'].forEach((value) => {
    assert.match(bladeUi, new RegExp(`<option value="${value}"`));
  });
}

function testTeacherAuthAndGmailBoundaries() {
  const pinHash = hashPin('local-teacher-pin');
  assert.equal(verifyPin('local-teacher-pin', pinHash), true);
  assert.equal(verifyPin('wrong-pin', pinHash), false);

  const serverSource = fs.readFileSync(path.join(projectRoot, 'server.js'), 'utf8');
  const profileSource = fs.readFileSync(path.join(projectRoot, 'routes', 'profileRoutes.js'), 'utf8');
  const studentSource = fs.readFileSync(path.join(projectRoot, 'routes', 'studentRoutes.js'), 'utf8');
  assert.match(serverSource, /app\.use\('\/api\/profile', teacherAuthRequired\);[\s\S]*registerProfileRoutes/);
  assert.match(profileSource, /\/api\/profile\/google\/start/);
  assert.match(profileSource, /\/api\/profile\/send-daily-summary/);
  assert.doesNotMatch(studentSource, /gmail|google\/start|send-daily-summary/i);

  const saved = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI
  };
  try {
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.PUBLIC_BASE_URL = 'http://10.0.0.59:3000';
    process.env.GOOGLE_REDIRECT_URI = 'http://teacher-auth.local:3000/api/profile/google/callback';
    const gmailStatus = getGmailProfileStatus();
    assert.equal(gmailStatus.redirectUri, process.env.GOOGLE_REDIRECT_URI);
    assert.notEqual(gmailStatus.redirectUri, `${process.env.PUBLIC_BASE_URL}/api/profile/google/callback`);
  } finally {
    Object.entries(saved).forEach(([name, value]) => restoreEnv(name, value));
  }
}

function lifecycleAction(harness, sessionId, body) {
  return harness.request(
    'POST',
    '/api/profile/student-sessions/:sessionId/lifecycle',
    body,
    {},
    { sessionId }
  );
}

function snapshotHubHistories(session) {
  return Object.fromEntries(Object.entries(session.anonymousHubs || {}).map(([hubId, hub]) => [
    hubId,
    (hub.messages || []).map((entry) => ({
      message: entry.message,
      response: entry.response
    }))
  ]));
}

function echoAnswer(message) {
  return {
    response: `Answer for ${message}`,
    routeType: 'test_echo',
    confidence: 'strong',
    standardId: '',
    questionRoute: {
      type: 'test_echo',
      confidence: 'strong',
      toolsUsed: ['test_echo'],
      aiAllowed: false
    }
  };
}

function makeRequest(host, protocol) {
  return {
    protocol,
    headers: { host },
    get(name) {
      return this.headers[String(name).toLowerCase()] || '';
    }
  };
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

main().catch((error) => {
  console.error('Student clean-link and session lifecycle checks failed.');
  console.error(error);
  process.exit(1);
});
