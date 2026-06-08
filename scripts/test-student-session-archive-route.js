const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');
const { parse } = require('csv-parse/sync');
const { registerProfileRoutes } = require('../routes/profileRoutes');
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
  assert.equal(restartResponse.body.className, 'Science A', 'restart should reuse the archived class label');
  assert.equal(studentSessions['session-a'], undefined, 'restart should not resurrect the old archived runtime session');
  assert.ok(studentSessions[restartResponse.body.sessionId], 'restart should create a new runtime session');
  assert.equal(studentSessions[restartResponse.body.sessionId].className, 'Science A');
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
