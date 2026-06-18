const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');
const { parse } = require('csv-parse/sync');
const {
  parseStudentSessionIdFromUrl,
  registerProfileRoutes
} = require('../routes/profileRoutes');
const { registerStudentRoutes } = require('../routes/studentRoutes');
const {
  createTeacherSessionStore,
  requireTeacherAuth,
  SESSION_COOKIE_NAME
} = require('../lib/auth/teacherAuth');
const {
  loadQuestionsStandardsRecords
} = require('../lib/profile/questionsStandardsArchiveRecords');
const {
  buildStandardsSummaryReport,
  loadStudentInteractionLogs
} = require('../lib/system/standardsSummaryReport');
const { createApp, request } = require('./test-helpers/httpHarness');

const projectRoot = path.join(__dirname, '..');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'student-session-archive-route-'));
const logFilePath = path.join(tmpDir, 'student_interactions.json');
const problemQuestionsPath = path.join(tmpDir, 'problem_questions.json');
const archiveDir = path.join(tmpDir, 'archives');
const manifestDir = path.join(tmpDir, 'export-manifests');
const records = [
  {
    id: 'session-a-1',
    timestamp: '2026-05-05T14:00:00.000Z',
    studentQuestion: 'What is force?',
    answerGiven: 'A force is a push or pull.',
    routeType: 'knowledge',
    confidence: 'strong',
    category: 'forces',
    sessionId: 'session-a',
    primaryStandards: [
      { standardId: 'ARCHIVE.ROUTE.1', label: 'Archive route standard', unit: 'Forces' }
    ],
    standards: [
      { standardId: 'ARCHIVE.ROUTE.1', label: 'Archive route standard', unit: 'Forces' }
    ],
    units: ['Forces'],
    reportableForStandards: true
  },
  {
    id: 'session-a-2',
    timestamp: '2026-05-05T14:05:00.000Z',
    studentQuestion: 'What is acceleration?',
    answerGiven: 'Acceleration is how quickly velocity changes.',
    routeType: 'knowledge',
    confidence: 'medium',
    category: 'motion',
    sessionId: 'session-a',
    primaryStandards: [
      { standardId: 'ARCHIVE.ROUTE.2', label: 'Motion standard', unit: 'Motion' }
    ],
    standards: [
      { standardId: 'ARCHIVE.ROUTE.2', label: 'Motion standard', unit: 'Motion' }
    ],
    units: ['Motion'],
    reportableForStandards: true
  },
  {
    id: 'session-b-1',
    timestamp: '2026-05-05T14:10:00.000Z',
    studentQuestion: 'What is density?',
    answerGiven: 'Density is mass divided by volume.',
    routeType: 'formula',
    confidence: 'strong',
    category: 'matter',
    sessionId: 'session-b',
    primaryStandards: [
      { standardId: 'OTHER.SESSION.1', label: 'Other session standard', unit: 'Matter' }
    ],
    standards: [
      { standardId: 'OTHER.SESSION.1', label: 'Other session standard', unit: 'Matter' }
    ],
    units: ['Matter'],
    reportableForStandards: true
  }
];
const originalLogContents = `${JSON.stringify(records, null, 2)}\n`;
const problemQuestionsContents = `${JSON.stringify([
  { id: 'problem-archive-route-1', question: 'This should stay untouched.' }
], null, 2)}\n`;

fs.writeFileSync(logFilePath, originalLogContents, 'utf8');
fs.writeFileSync(problemQuestionsPath, problemQuestionsContents, 'utf8');

const handlers = new Map();
const app = createApp(handlers);
const sessionStore = createTeacherSessionStore();
const teacherSessionId = sessionStore.createSession({ username: 'teacher' });
const studentSessions = {
  'session-a': {
    sessionId: 'session-a',
    className: 'Science A',
    createdAt: '2026-05-05T13:55:00.000Z',
    studentUrl: '/student.html?sessionId=session-a',
    messages: [],
    anonymousHubs: {}
  },
  'session-b': {
    sessionId: 'session-b',
    className: 'Science B',
    createdAt: '2026-05-05T13:56:00.000Z',
    studentUrl: '/student.html?sessionId=session-b',
    messages: [],
    anonymousHubs: {}
  }
};

registerProfileRoutes(app, {
  clearGoogleIdentity: async () => null,
  completeGoogleConnect: async () => ({ teacher: {} }),
  createGoogleConnectUrl: () => '/google/start',
  disconnectGoogle: () => {},
  getAvailableProfileDates: () => ({ dates: [] }),
  getClassroomControls: () => ({}),
  getDailyQuestionSummary: () => ({}),
  getProfileStatus: () => ({ authenticated: true }),
  getStandardsSummaryReport: (date) => buildStandardsSummaryReport(loadQuestionsStandardsRecords({
    logFilePath,
    archiveDir,
    readCurrentRecords: loadStudentInteractionLogs
  }), { date }),
  linkGoogleIdentity: async () => ({}),
  port: 3000,
  questionRateLimiter: null,
  requireTeacherAuth: requireTeacherAuth(sessionStore),
  sendDailySummaryEmail: async () => ({ ok: true }),
  studentInteractionsFile: logFilePath,
  studentSessions,
  questionsStandardsArchiveDir: archiveDir,
  questionsStandardsExportManifestDir: manifestDir
});
registerStudentRoutes(app, {
  answerStudentMessage: async () => ({ response: 'ok' }),
  getClassroomControls: () => ({}),
  logCompletedInteraction: () => {},
  studentSessions
});

const authorizedExtras = {
  headers: {
    cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(teacherSessionId)}`
  }
};

async function main() {
  const unauthorized = await request(
    handlers,
    'POST',
    '/api/profile/student-sessions/:sessionId/archive',
    { confirm: true },
    { sessionId: 'session-a' }
  );
  assert.equal(unauthorized.statusCode, 401, 'archive endpoint should require teacher auth');
  assert.equal(unauthorized.body.error, 'Teacher login required.');

  const missingConfirm = await request(
    handlers,
    'POST',
    '/api/profile/student-sessions/:sessionId/archive',
    {},
    { sessionId: 'session-a' },
    {},
    authorizedExtras
  );
  assert.equal(missingConfirm.statusCode, 400, 'archive endpoint should require confirm true');
  assert.equal(missingConfirm.body.error, 'confirm true is required.');
  assert.equal(fs.readFileSync(logFilePath, 'utf8'), originalLogContents, 'unconfirmed archive should not change raw records');

  const archiveResponse = await request(
    handlers,
    'POST',
    '/api/profile/student-sessions/:sessionId/archive',
    { confirm: true },
    { sessionId: 'session-a' },
    {},
    authorizedExtras
  );
  assert.equal(archiveResponse.statusCode, 200, 'confirmed session archive should succeed');
  assert.equal(archiveResponse.body.ok, true);
  assert.equal(archiveResponse.body.archived, true);
  assert.match(archiveResponse.body.archiveId, /^[0-9a-f-]{32,36}$/i);
  assert.equal(archiveResponse.body.exportId, archiveResponse.body.archiveId);
  assert.match(archiveResponse.body.csvFilename, /questions-standards-session-session-a/u);
  assert.equal(archiveResponse.body.rowCount, 2, 'archive should include only selected session rows');
  assert.equal(archiveResponse.body.deletedRecordCount, 2, 'archive should delete selected session raw records');
  assert.equal(archiveResponse.body.rawRecordsDeleted, true);
  assert.match(archiveResponse.body.message, /Session archived/u);

  const remainingRecords = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  assert.deepEqual(
    remainingRecords.map((record) => record && record.id).filter(Boolean),
    ['session-b-1'],
    'archive endpoint should delete only selected session records'
  );
  assert.equal(
    fs.readFileSync(problemQuestionsPath, 'utf8'),
    problemQuestionsContents,
    'archive endpoint should not touch problem_questions.json'
  );
  assert.equal(studentSessions['session-a'], undefined, 'archived runtime session should be ended');
  assert.ok(studentSessions['session-b'], 'archive endpoint should not end unrelated sessions');

  const archiveCsvPath = path.join(archiveDir, archiveResponse.body.csvFilename);
  assert.equal(fs.existsSync(archiveCsvPath), true, 'archive endpoint should write CSV');
  const archiveRows = parse(fs.readFileSync(archiveCsvPath, 'utf8'), { columns: true });
  assert.deepEqual(
    archiveRows.map((row) => row.id),
    ['session-a-1', 'session-a-2'],
    'archive CSV should contain only selected session rows'
  );
  const archiveManifestPath = path.join(archiveDir, archiveResponse.body.csvFilename.replace(/\.csv$/i, '.manifest.json'));
  const archiveManifestBeforeRestart = fs.readFileSync(archiveManifestPath, 'utf8');
  assert.equal(
    JSON.parse(archiveManifestBeforeRestart).className,
    'Science A',
    'archive manifest should retain the safe class label for restart'
  );

  const mergedRecords = loadQuestionsStandardsRecords({
    logFilePath,
    archiveDir,
    readCurrentRecords: loadStudentInteractionLogs
  });
  assert.deepEqual(
    mergedRecords.map((record) => record.id),
    ['session-b-1', 'session-a-1', 'session-a-2'],
    'Questions & Standards should read remaining raw records plus archived session records'
  );
  const summary = buildStandardsSummaryReport(mergedRecords, {
    date: '2026-05-05',
    now: new Date('2026-06-06T12:00:00.000Z')
  });
  assert.equal(summary.totalQuestions, 3, 'Questions & Standards should still include archived records after raw deletion');
  assert.equal(summary.questions.some((question) => question.id === 'session-a-1'), true);
  assert.equal(summary.standards.some((standard) => standard.standardId === 'ARCHIVE.ROUTE.1'), true);

  const orphanRecord = {
    id: 'orphan-session-1',
    timestamp: '2026-05-05T14:20:00.000Z',
    studentQuestion: 'Can a recorded session still be saved?',
    answerGiven: 'Yes, recorded question history can be archived.',
    routeType: 'knowledge',
    confidence: 'strong',
    category: 'archive workflow',
    sessionId: 'orphan-session',
    primaryStandards: [
      { standardId: 'ORPHAN.SESSION.1', label: 'Persisted session standard', unit: 'Archive' }
    ],
    standards: [
      { standardId: 'ORPHAN.SESSION.1', label: 'Persisted session standard', unit: 'Archive' }
    ],
    units: ['Archive'],
    reportableForStandards: true
  };
  fs.writeFileSync(logFilePath, `${JSON.stringify([...remainingRecords, orphanRecord], null, 2)}\n`, 'utf8');
  assert.equal(studentSessions['orphan-session'], undefined, 'orphan fixture should not be actively running');

  const orphanArchiveResponse = await request(
    handlers,
    'POST',
    '/api/profile/student-sessions/:sessionId/archive',
    { confirm: true, className: 'Recorded Class' },
    { sessionId: 'orphan-session' },
    {},
    authorizedExtras
  );
  assert.equal(orphanArchiveResponse.statusCode, 200, 'recorded session archive should succeed without a live runtime session');
  assert.equal(orphanArchiveResponse.body.ok, true);
  assert.equal(orphanArchiveResponse.body.archived, true);
  assert.equal(orphanArchiveResponse.body.sessionId, 'orphan-session');
  assert.equal(orphanArchiveResponse.body.rowCount, 1, 'recorded session archive should include persisted question records');
  assert.equal(orphanArchiveResponse.body.deletedRecordCount, 1, 'recorded session archive should delete only archived raw records');
  assert.equal(orphanArchiveResponse.body.rawRecordsDeleted, true);

  const remainingAfterOrphanArchive = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  assert.deepEqual(
    remainingAfterOrphanArchive.map((record) => record && record.id).filter(Boolean),
    ['session-b-1'],
    'recorded session archive should leave unrelated current records untouched'
  );
  const orphanSummary = buildStandardsSummaryReport(loadQuestionsStandardsRecords({
    logFilePath,
    archiveDir,
    readCurrentRecords: loadStudentInteractionLogs
  }), {
    date: '2026-05-05',
    now: new Date('2026-06-06T12:00:00.000Z')
  });
  assert.equal(orphanSummary.totalQuestions, 4, 'archived recorded sessions should still appear in Questions & Standards');
  assert.equal(
    orphanSummary.questions.some((question) => question.id === 'orphan-session-1' && question.archived === true),
    true,
    'Questions & Standards should mark the recorded session record as archived after save'
  );

  const unauthorizedRestart = await request(
    handlers,
    'POST',
    '/api/profile/student-sessions/:sessionId/restart',
    {},
    { sessionId: 'session-a' }
  );
  assert.equal(unauthorizedRestart.statusCode, 401, 'restart endpoint should require teacher auth');
  assert.equal(unauthorizedRestart.body.error, 'Teacher login required.');

  const missingRestart = await request(
    handlers,
    'POST',
    '/api/profile/student-sessions/:sessionId/restart',
    {},
    { sessionId: 'missing-session' },
    {},
    authorizedExtras
  );
  assert.equal(missingRestart.statusCode, 404, 'restart should 404 when the old session metadata cannot be found');

  const archiveFilesBeforeRestart = fs.readdirSync(archiveDir).sort();
  const restartResponse = await request(
    handlers,
    'POST',
    '/api/profile/student-sessions/:sessionId/restart',
    {},
    { sessionId: 'session-a' },
    {},
    authorizedExtras
  );
  assert.equal(restartResponse.statusCode, 201, 'restart should create a brand-new live session');
  assert.equal(restartResponse.body.ok, true);
  assert.equal(restartResponse.body.restarted, true);
  assert.notEqual(restartResponse.body.sessionId, 'session-a', 'restart should generate a fresh sessionId');
  assert.match(restartResponse.body.sessionId, /^[0-9a-f-]{32,36}$/i);
  assert.notEqual(restartResponse.body.studentUrl, '/student.html?sessionId=session-a', 'restart should generate a fresh studentUrl');
  assert.match(restartResponse.body.studentUrl, new RegExp(encodeURIComponent(restartResponse.body.sessionId)));
  const restartedSessionIdFromUrl = parseStudentSessionIdFromUrl(restartResponse.body.studentUrl);
  assert.equal(
    restartedSessionIdFromUrl,
    restartResponse.body.sessionId,
    'restart studentUrl should contain the new live session id expected by student join'
  );
  const joinRestarted = await request(
    handlers,
    'POST',
    '/api/student/join',
    { sessionId: restartedSessionIdFromUrl, studentHubId: 'restart-route-student' }
  );
  assert.equal(
    joinRestarted.statusCode,
    200,
    'id parsed from restart studentUrl should be joinable through the real student join route'
  );
  assert.equal(joinRestarted.body.classSessionId, restartResponse.body.sessionId);
  const restartedStudentMessage = await request(
    handlers,
    'POST',
    '/api/student/message',
    {
      sessionId: restartedSessionIdFromUrl,
      studentHubId: 'restart-route-student',
      message: 'Can I ask from the restarted session?'
    }
  );
  assert.equal(
    restartedStudentMessage.statusCode,
    200,
    'restarted student link should accept a student question after join'
  );
  assert.equal(restartedStudentMessage.body.response, 'ok');
  assert.equal(restartResponse.body.className, 'Restarted Science A', 'restart should create a normalized restarted class label');
  assert.equal(
    restartResponse.body.message,
    'Restarted Science A. A new student link is ready.',
    'restart should not double-prefix the success message'
  );
  assert.equal(studentSessions['session-a'], undefined, 'restart should not resurrect the old archived runtime session');
  assert.ok(studentSessions[restartResponse.body.sessionId], 'restart should create a new runtime session');
  assert.equal(studentSessions[restartResponse.body.sessionId].className, 'Restarted Science A');
  assert.deepEqual(
    fs.readdirSync(archiveDir).sort(),
    archiveFilesBeforeRestart,
    'restart should not add, delete, or rename archive files'
  );
  assert.equal(
    fs.readFileSync(archiveManifestPath, 'utf8'),
    archiveManifestBeforeRestart,
    'restart should not mutate old archive metadata'
  );

  const liveAfterRestart = await request(
    handlers,
    'GET',
    '/api/profile/live-student-activity',
    {},
    {},
    {},
    authorizedExtras
  );
  assert.equal(liveAfterRestart.statusCode, 200);
  assert.equal(
    liveAfterRestart.body.sessions[0].classSessionId,
    restartResponse.body.sessionId,
    'restarted sessions should appear at the top of Active Sessions'
  );
  assert.equal(
    liveAfterRestart.body.sessions.some((session) => session.classSessionId === 'session-a'),
    false,
    'archived sessions should stay out of Active Sessions after restart'
  );
  assert.equal(
    buildStandardsSummaryReport(loadQuestionsStandardsRecords({
      logFilePath,
      archiveDir,
      readCurrentRecords: loadStudentInteractionLogs
    }), { date: '2026-05-05' }).questions.some((question) => question.id === 'session-a-1'),
    true,
    'restart should keep archived Questions & Standards history visible'
  );

  const doublePrefixRestart = await request(
    handlers,
    'POST',
    '/api/profile/student-sessions/:sessionId/restart',
    { className: 'Restarted Restarted Session' },
    { sessionId: 'session-a' },
    {},
    authorizedExtras
  );
  assert.equal(doublePrefixRestart.statusCode, 201);
  assert.equal(
    doublePrefixRestart.body.className,
    'Restarted Science A',
    'restart should ignore a generic repeated Restarted fallback when archive metadata has a clean name'
  );
  assert.equal(
    doublePrefixRestart.body.message,
    'Restarted Science A. A new student link is ready.',
    'restart should use the recovered clean archive name when the request body only has fallback copy'
  );
  assert.doesNotMatch(
    doublePrefixRestart.body.message,
    /Restarted Restarted/u,
    'restart response should never say Restarted Restarted Session'
  );

  const legacyCsvFilename = 'questions-standards-session-legacy-session.csv';
  fs.writeFileSync(
    path.join(archiveDir, legacyCsvFilename),
    [
      'id,timestamp,date,sessionId,question,response',
      'legacy-session-1,2026-05-05T15:00:00.000Z,2026-05-05,legacy-session,What is momentum?,Mass times velocity.'
    ].join('\n') + '\n',
    'utf8'
  );

  const legacyRestart = await request(
    handlers,
    'POST',
    '/api/profile/student-sessions/:sessionId/restart',
    {},
    { sessionId: 'legacy-session' },
    {},
    authorizedExtras
  );
  assert.equal(legacyRestart.statusCode, 201, 'legacy archives without class metadata should still restart');
  assert.equal(legacyRestart.body.ok, true);
  assert.match(legacyRestart.body.studentUrl, new RegExp(encodeURIComponent(legacyRestart.body.sessionId)));
  const legacySessionIdFromUrl = parseStudentSessionIdFromUrl(legacyRestart.body.studentUrl);
  assert.equal(
    legacySessionIdFromUrl,
    legacyRestart.body.sessionId,
    'legacy restart studentUrl should contain the new live session id'
  );
  const joinLegacyRestart = await request(
    handlers,
    'POST',
    '/api/student/join',
    { sessionId: legacySessionIdFromUrl, studentHubId: 'legacy-restart-route-student' }
  );
  assert.equal(
    joinLegacyRestart.statusCode,
    200,
    'legacy restart URL should be joinable through the real student join route'
  );
  assert.equal(joinLegacyRestart.body.classSessionId, legacyRestart.body.sessionId);
  assert.equal(
    legacyRestart.body.className,
    'Restarted Session',
    'legacy archives without class metadata should use a safe generic session title'
  );
  assert.equal(
    legacyRestart.body.message,
    'Session restarted. A new student link is ready.',
    'legacy archives without class metadata should not imply a friendly name was recovered'
  );

  const legacyDoublePrefixRestart = await request(
    handlers,
    'POST',
    '/api/profile/student-sessions/:sessionId/restart',
    { className: 'Restarted Restarted Session' },
    { sessionId: 'legacy-session' },
    {},
    authorizedExtras
  );
  assert.equal(legacyDoublePrefixRestart.statusCode, 201);
  assert.equal(
    legacyDoublePrefixRestart.body.className,
    'Restarted Session',
    'restart title normalization should collapse repeated generic Restarted prefixes'
  );
  assert.equal(
    legacyDoublePrefixRestart.body.message,
    'Session restarted. A new student link is ready.',
    'generic restarted labels should use safe generic copy'
  );
  assert.doesNotMatch(
    legacyDoublePrefixRestart.body.message,
    /Restarted Restarted/u,
    'generic legacy restart response should never say Restarted Restarted Session'
  );

  await assertArchiveFailureDoesNotDeleteRawRecords();
  assertNoStudentPageChanges();

  console.log('student session archive route checks passed');
}

async function assertArchiveFailureDoesNotDeleteRawRecords() {
  const failingTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'student-session-archive-failure-'));
  const failingLogFilePath = path.join(failingTmpDir, 'student_interactions.json');
  const failingArchivePath = path.join(failingTmpDir, 'archive-blocker');
  const failingHandlers = new Map();
  const failingApp = createApp(failingHandlers);
  fs.writeFileSync(failingLogFilePath, originalLogContents, 'utf8');
  fs.writeFileSync(failingArchivePath, 'not a directory', 'utf8');

  registerProfileRoutes(failingApp, {
    clearGoogleIdentity: async () => null,
    completeGoogleConnect: async () => ({ teacher: {} }),
    createGoogleConnectUrl: () => '/google/start',
    disconnectGoogle: () => {},
    getAvailableProfileDates: () => ({ dates: [] }),
    getClassroomControls: () => ({}),
    getDailyQuestionSummary: () => ({}),
    getProfileStatus: () => ({ authenticated: true }),
    getStandardsSummaryReport: () => ({}),
    linkGoogleIdentity: async () => ({}),
    port: 3000,
    questionRateLimiter: null,
    requireTeacherAuth: requireTeacherAuth(sessionStore),
    sendDailySummaryEmail: async () => ({ ok: true }),
    studentInteractionsFile: failingLogFilePath,
    studentSessions: {},
    questionsStandardsArchiveDir: failingArchivePath,
    questionsStandardsExportManifestDir: path.join(failingTmpDir, 'manifests')
  });

  const failure = await request(
    failingHandlers,
    'POST',
    '/api/profile/student-sessions/:sessionId/archive',
    { confirm: true },
    { sessionId: 'session-a' },
    {},
    authorizedExtras
  );
  assert.equal(failure.statusCode, 500, 'archive write failure should fail safely');
  assert.equal(
    fs.readFileSync(failingLogFilePath, 'utf8'),
    originalLogContents,
    'raw records should only be deleted after archive succeeds'
  );
}

function assertNoStudentPageChanges() {
  const protectedDiff = spawnSync(
    'git',
    [
      'diff',
      '--name-only',
      '--',
      'public/student.html',
      'public/student/student-ui.js',
      'public/styles/student.css'
    ],
    { cwd: projectRoot, encoding: 'utf8' }
  );
  assert.equal(protectedDiff.status, 0, protectedDiff.stderr || 'Could not inspect protected file diff.');
  assert.equal(
    protectedDiff.stdout.trim(),
    '',
    'student page files should not change for teacher session archiving'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
