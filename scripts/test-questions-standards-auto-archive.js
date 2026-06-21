const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  runQuestionsStandardsAutoArchive
} = require('../lib/profile/questionsStandardsAutoArchive');
const {
  loadQuestionsStandardsRecords
} = require('../lib/profile/questionsStandardsArchiveRecords');
const {
  buildStandardsSummaryReport,
  loadStudentInteractionLogs
} = require('../lib/system/standardsSummaryReport');

const projectRoot = path.join(__dirname, '..');
const protectedStudentPageFiles = [
  'public/student.html',
  'public/student/student-ui.js',
  'public/styles/student.css'
];
const protectedStudentPageSnapshots = new Map(
  protectedStudentPageFiles.map((file) => {
    const absolutePath = path.join(projectRoot, file);
    return [file, fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : null];
  })
);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-standards-auto-archive-'));
const logFilePath = path.join(tmpDir, 'student_interactions.json');
const archiveDir = path.join(tmpDir, 'archives');
const now = new Date('2026-06-06T15:00:00.000Z');
const records = [
  {
    id: 'inactive-1',
    timestamp: '2026-06-06T13:45:00.000Z',
    studentQuestion: 'What is velocity?',
    answerGiven: 'Velocity is speed with direction.',
    routeType: 'knowledge',
    confidence: 'strong',
    category: 'motion',
    sessionId: 'inactive-session',
    primaryStandards: [
      { standardId: 'AUTO.ARCHIVE.1', label: 'Auto archive standard', unit: 'Motion' }
    ],
    standards: [
      { standardId: 'AUTO.ARCHIVE.1', label: 'Auto archive standard', unit: 'Motion' }
    ],
    units: ['Motion'],
    reportableForStandards: true,
    debug: { studentHubId: 'inactive-hub' }
  },
  {
    id: 'active-1',
    timestamp: '2026-06-06T14:55:00.000Z',
    studentQuestion: 'What is mass?',
    answerGiven: 'Mass is the amount of matter in an object.',
    routeType: 'knowledge',
    confidence: 'strong',
    category: 'matter',
    sessionId: 'active-session',
    primaryStandards: [
      { standardId: 'AUTO.ACTIVE.1', label: 'Active standard', unit: 'Matter' }
    ],
    standards: [
      { standardId: 'AUTO.ACTIVE.1', label: 'Active standard', unit: 'Matter' }
    ],
    units: ['Matter'],
    reportableForStandards: true,
    debug: { studentHubId: 'active-hub' }
  }
];
const originalLogContents = `${JSON.stringify(records, null, 2)}\n`;

fs.writeFileSync(logFilePath, originalLogContents, 'utf8');

const defaultOffSessions = buildStudentSessions();
const defaultOff = runQuestionsStandardsAutoArchive({
  studentSessions: defaultOffSessions,
  logFilePath,
  archiveDir,
  now: () => now,
  logger: null
});
assert.equal(defaultOff.status, 'disabled', 'auto archive should be off by default');
assert.equal(defaultOff.enabled, false);
assert.equal(fs.readFileSync(logFilePath, 'utf8'), originalLogContents, 'default-off auto archive should not change raw records');
assert.ok(defaultOffSessions['inactive-session'], 'default-off auto archive should not clear stale runtime sessions');

const disabledSessions = buildStudentSessions();
const disabled = runQuestionsStandardsAutoArchive({
  enabled: false,
  inactiveMinutes: 30,
  studentSessions: disabledSessions,
  logFilePath,
  archiveDir,
  now: () => now,
  logger: null
});
assert.equal(disabled.status, 'disabled', 'auto archive should default to off when disabled');
assert.equal(fs.readFileSync(logFilePath, 'utf8'), originalLogContents, 'disabled auto archive should not change raw records');
assert.ok(disabledSessions['inactive-session'], 'disabled auto archive should not clear runtime sessions');

const studentSessions = buildStudentSessions();
const result = runQuestionsStandardsAutoArchive({
  enabled: true,
  inactiveMinutes: 30,
  studentSessions,
  logFilePath,
  archiveDir,
  now: () => now,
  logger: null
});

assert.equal(result.ok, true, 'auto archive should succeed');
assert.equal(result.archivedSessions.length, 1, 'inactive session should archive');
assert.equal(result.archivedSessions[0].sessionId, 'inactive-session');
assert.equal(result.archivedSessions[0].rowCount, 1);
assert.equal(result.archivedSessions[0].deletedRecordCount, 1);
assert.equal(result.archivedSessions[0].rawRecordsDeleted, true);
assert.equal(studentSessions['inactive-session'], undefined, 'inactive runtime session should be cleared after archive succeeds');
assert.ok(studentSessions['active-session'], 'active runtime session should remain');
assert.ok(studentSessions['hubless-session'], 'hubless sessions should remain untouched');
assert.equal(
  result.skippedSessions.some((session) => session.sessionId === 'active-session' && session.reason === 'active_within_threshold'),
  true,
  'active sessions should be skipped'
);
assert.equal(
  result.skippedSessions.some((session) => session.sessionId === 'hubless-session' && session.reason === 'no_student_hubs'),
  true,
  'hubless sessions should be skipped conservatively'
);

const remainingRecords = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
assert.deepEqual(
  remainingRecords.map((record) => record.id),
  ['active-1'],
  'auto archive should delete only raw records for the archived inactive session'
);

const mergedRecords = loadQuestionsStandardsRecords({
  logFilePath,
  archiveDir,
  readCurrentRecords: loadStudentInteractionLogs
});
assert.deepEqual(
  mergedRecords.map((record) => record.id),
  ['active-1', 'inactive-1'],
  'Questions & Standards should include current raw records plus archived records'
);
const summary = buildStandardsSummaryReport(mergedRecords, {
  date: '2026-06-06',
  now
});
assert.equal(summary.totalQuestions, 2, 'archived data should remain visible in Questions & Standards');
assert.equal(summary.standards.some((standard) => standard.standardId === 'AUTO.ARCHIVE.1'), true);

assertArchiveFailureDoesNotDeleteRawRecords();
assertNoStudentPageChanges();

console.log('Questions & Standards auto-archive checks passed');

function assertArchiveFailureDoesNotDeleteRawRecords() {
  const failingTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-standards-auto-archive-failure-'));
  const failingLogFilePath = path.join(failingTmpDir, 'student_interactions.json');
  const failingArchivePath = path.join(failingTmpDir, 'archive-blocker');
  const failingSessions = {
    'inactive-session': buildStudentSessions()['inactive-session']
  };
  fs.writeFileSync(failingLogFilePath, originalLogContents, 'utf8');
  fs.writeFileSync(failingArchivePath, 'not a directory', 'utf8');

  const failure = runQuestionsStandardsAutoArchive({
    enabled: true,
    inactiveMinutes: 30,
    studentSessions: failingSessions,
    logFilePath: failingLogFilePath,
    archiveDir: failingArchivePath,
    now: () => now,
    logger: null
  });

  assert.equal(failure.ok, false, 'auto archive should report archive failures');
  assert.equal(failure.errors.length, 1);
  assert.equal(failure.errors[0].sessionId, 'inactive-session');
  assert.equal(
    fs.readFileSync(failingLogFilePath, 'utf8'),
    originalLogContents,
    'auto archive failure should not delete raw records'
  );
  assert.ok(failingSessions['inactive-session'], 'auto archive failure should not clear runtime session');
}

function assertNoStudentPageChanges() {
  for (const file of protectedStudentPageFiles) {
    const absolutePath = path.join(projectRoot, file);
    const currentContents = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : null;
    assert.equal(
      currentContents,
      protectedStudentPageSnapshots.get(file),
      `${file} should not change while testing auto archive`
    );
  }
}

function buildStudentSessions() {
  return {
    'inactive-session': {
      sessionId: 'inactive-session',
      className: 'Inactive Science',
      createdAt: '2026-06-06T13:30:00.000Z',
      studentUrl: '/student.html?sessionId=inactive-session',
      messages: [],
      anonymousHubs: {
        'inactive-hub': {
          studentHubId: 'inactive-hub',
          firstSeenAt: '2026-06-06T13:35:00.000Z',
          lastSeenAt: '2026-06-06T14:00:00.000Z',
          lastMessageAt: '2026-06-06T13:45:00.000Z',
          messageCount: 1,
          messages: []
        }
      }
    },
    'active-session': {
      sessionId: 'active-session',
      className: 'Active Science',
      createdAt: '2026-06-06T14:30:00.000Z',
      studentUrl: '/student.html?sessionId=active-session',
      messages: [],
      anonymousHubs: {
        'active-hub': {
          studentHubId: 'active-hub',
          firstSeenAt: '2026-06-06T14:30:00.000Z',
          lastSeenAt: '2026-06-06T14:55:00.000Z',
          lastMessageAt: '2026-06-06T14:55:00.000Z',
          messageCount: 1,
          messages: []
        }
      }
    },
    'hubless-session': {
      sessionId: 'hubless-session',
      className: 'Hubless Science',
      createdAt: '2026-06-06T12:00:00.000Z',
      studentUrl: '/student.html?sessionId=hubless-session',
      messages: [],
      anonymousHubs: {}
    }
  };
}
