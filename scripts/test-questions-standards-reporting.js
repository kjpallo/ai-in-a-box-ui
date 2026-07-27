process.env.TZ = 'America/Chicago';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const {
  buildAnonymousQuestionsStandardsCsvExport,
  buildQuestionsStandardsCsvExport,
  publicReportCsvCell
} = require('../lib/profile/questionsStandardsCsvExport');
const {
  loadQuestionsStandardsRecords
} = require('../lib/profile/questionsStandardsArchiveRecords');
const {
  anonymizeQuestionText,
  buildAnonymousQuestionsStandardsReport,
  buildQuestionsStandardsReport,
  normalizeQuestionsStandardsRecord
} = require('../lib/profile/questionsStandardsReport');
const {
  reportingDateKeyFromEntry
} = require('../lib/system/reportingDate');
const {
  buildStandardsSummaryReport
} = require('../lib/system/standardsSummaryReport');
const {
  archiveQuestionsStandardsSession
} = require('../lib/profile/questionsStandardsSessionArchive');
const {
  createTeacherSessionStore,
  requireTeacherAuth,
  SESSION_COOKIE_NAME
} = require('../lib/auth/teacherAuth');
const { registerProfileRoutes } = require('../routes/profileRoutes');
const { createApp, request } = require('./test-helpers/httpHarness');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const records = [
  {
    id: 'private-record-1',
    timestamp: '2026-07-27T14:00:00.000Z',
    studentQuestion: 'What is force, really?',
    category: 'forces',
    standardsConfidence: 'strong',
    primaryStandards: [
      { standardId: 'PS2.A.1', label: 'Forces and motion', unit: 'Forces' }
    ],
    sessionId: 'raw-session-token-a',
    debug: { studentHubId: 'device-hub-a', email: 'student@example.com' }
  },
  {
    id: 'private-record-2',
    timestamp: '2026-07-27T14:05:00.000Z',
    studentQuestion: 'How does a push change motion?',
    topic: 'forces',
    standardsConfidence: 'medium',
    standards: [
      { standardId: 'PS2.A.1', label: 'Forces and motion', unit: 'Forces' }
    ],
    sessionId: 'raw-session-token-a'
  },
  {
    id: 'private-record-3',
    timestamp: '2026-07-27T14:10:00.000Z',
    studentQuestion: 'My name is Alice, email me at alice@example.com.\nWhy is this "thing", strange?',
    topic: 'other',
    routeType: 'no_match',
    confidence: 'none',
    sessionId: 'raw-session-token-b',
    debug: { studentHubId: 'device-hub-b' }
  },
  {
    id: 'private-record-4',
    timestamp: '2026-07-27T14:15:00.000Z',
    studentQuestion: 'Which standard covers waves?',
    category: 'waves',
    confidence: 'strong',
    primaryStandards: [
      { standardId: 'PS4.A.1', label: 'Wave properties', unit: 'Waves' }
    ],
    sessionId: 'raw-session-token-c',
    archived: true,
    archiveId: 'private-archive-token',
    archiveCreatedAt: '2026-07-27T15:00:00.000Z'
  },
  {
    id: 'non-reportable-control',
    timestamp: '2026-07-27T14:20:00.000Z',
    studentQuestion: 'Used a tutor control',
    reportableForStandards: false
  },
  null,
  'legacy-invalid'
];

const empty = buildQuestionsStandardsReport([null, undefined, 'legacy']);
assert.deepEqual(empty.counts, {
  totalQuestions: 0,
  matchedStandards: 0,
  needsReview: 0,
  missingStandard: 0,
  liveQuestions: 0,
  archivedQuestions: 0,
  liveSessions: 0,
  archivedSessions: 0
}, 'empty and malformed data should normalize without a map.set failure');

assert.equal(normalizeQuestionsStandardsRecord(null), null);
const partial = normalizeQuestionsStandardsRecord({ question: 'Legacy partial question' });
assert.equal(partial.question, 'Legacy partial question');
assert.equal(partial.topic, 'other');
assert.equal(partial.needsReview, true);
assert.equal(partial.missingStandard, true);
assert.equal(partial.state, 'live');

const report = buildQuestionsStandardsReport(records, { date: '2026-07-27' });
assert.equal(report.counts.totalQuestions, 4);
assert.equal(report.counts.matchedStandards, 2, 'matched standard count should be distinct');
assert.equal(report.counts.needsReview, 1);
assert.equal(report.counts.missingStandard, 1);
assert.equal(report.counts.liveQuestions, 3);
assert.equal(report.counts.archivedQuestions, 1);
assert.equal(report.counts.liveSessions, 2);
assert.equal(report.counts.archivedSessions, 1);
assert.deepEqual(
  report.standards.map((standard) => [standard.standard, standard.count]),
  [['PS2.A.1', 2], ['PS4.A.1', 1]],
  'two questions for the same standard should produce one distinct standard and two records'
);
assert.deepEqual(
  report.records.map((record) => record.anonymousSession),
  ['Session 1', 'Session 1', 'Session 2', 'Session 3']
);

const needsReview = buildQuestionsStandardsReport(records, {
  date: '2026-07-27',
  status: 'needs-review'
});
assert.equal(needsReview.counts.totalQuestions, 1);
assert.equal(needsReview.counts.matchedStandards, 0);
assert.equal(needsReview.counts.needsReview, 1);
assert.equal(needsReview.records[0].missingStandard, true);

const missingStandard = buildQuestionsStandardsReport(records, {
  date: '2026-07-27',
  status: 'missing-standard'
});
assert.equal(missingStandard.counts.totalQuestions, 1);
assert.equal(missingStandard.counts.matchedStandards, 0);
assert.equal(missingStandard.counts.needsReview, 1);

const otherDate = buildQuestionsStandardsReport(records, { date: '2026-07-28' });
assert.equal(otherDate.counts.totalQuestions, 0);
assert.equal(otherDate.counts.matchedStandards, 0);

const formulaValues = [
  '=HYPERLINK("https://example.test","click")',
  '+SUM(1,2)',
  '-1+2',
  '@SUM(1,2)',
  '  =1+1',
  '\t=1+1',
  '=value with "quotes", commas,\nand a newline',
  '-42'
];
for (const value of formulaValues) {
  const [row] = parse(`value\n${publicReportCsvCell(value)}`, { columns: true });
  assert.equal(row.value, `'${value}`, `public CSV should neutralize ${JSON.stringify(value)} without losing text`);
}
assert.equal(
  parse(`value\n${publicReportCsvCell('ordinary classroom text')}`, { columns: true })[0].value,
  'ordinary classroom text',
  'ordinary public CSV text should remain unchanged'
);

const formulaExport = buildAnonymousQuestionsStandardsCsvExport([
  {
    id: 'formula-record',
    date: '2026-07-27',
    timestamp: '2026-07-27T12:00:00.000Z',
    studentQuestion: '=HYPERLINK("https://example.test","click")',
    topic: '+SUM(1,2)',
    primaryStandards: [
      { standardId: '@STANDARD', label: '-1+2' }
    ],
    standardsConfidence: 'strong'
  }
], { date: '2026-07-27' });
const [formulaRow] = parse(formulaExport.csv, { columns: true });
assert.equal(formulaRow.question, '\'=HYPERLINK("https://example.test","click")');
assert.equal(formulaRow.topic, "'+SUM(1,2)");
assert.equal(formulaRow.standard, "'@STANDARD | -1+2");

const structuredIdentifierQuestion = [
  'studentId=ABC123',
  'student_id=ABC123',
  'student-id=ABC123',
  'joinCode=ABCDE',
  'join_code=ABCDE',
  'sessionId=secret',
  'sessionToken=secret',
  'deviceId=ABC',
  'hubId=ABC',
  'email=student@example.com',
  'ipAddress=192.0.2.1'
].join(' ');
const structuredReport = buildQuestionsStandardsReport([
  {
    id: 'structured-private-record',
    date: '2026-07-27',
    timestamp: '2026-07-27T12:30:00.000Z',
    studentQuestion: `Explain force. ${structuredIdentifierQuestion}`,
    topic: 'privacy check',
    primaryStandards: [
      { standardId: 'PS2.A.1', label: 'Forces and motion' }
    ],
    standardsConfidence: 'strong',
    sessionId: 'structured-private-session'
  }
], { date: '2026-07-27' });
const structuredCsv = buildAnonymousQuestionsStandardsCsvExport([
  {
    id: 'structured-private-record',
    date: '2026-07-27',
    timestamp: '2026-07-27T12:30:00.000Z',
    studentQuestion: `Explain force. ${structuredIdentifierQuestion}`,
    topic: 'privacy check',
    primaryStandards: [
      { standardId: 'PS2.A.1', label: 'Forces and motion' }
    ],
    standardsConfidence: 'strong',
    sessionId: 'structured-private-session'
  }
], { date: '2026-07-27' }).csv;
const structuredDetailed = buildAnonymousQuestionsStandardsReport(structuredReport, { mode: 'detailed' }).body;
for (const privateValue of [
  'studentId=ABC123',
  'student_id=ABC123',
  'student-id=ABC123',
  'joinCode=ABCDE',
  'join_code=ABCDE',
  'sessionId=secret',
  'sessionToken=secret',
  'deviceId=ABC',
  'hubId=ABC',
  'email=student@example.com',
  'ipAddress=192.0.2.1'
]) {
  assert.doesNotMatch(structuredCsv, new RegExp(privateValue, 'iu'), `anonymous CSV should redact ${privateValue}`);
  assert.doesNotMatch(structuredDetailed, new RegExp(privateValue, 'iu'), `detailed report should redact ${privateValue}`);
}
assert.match(structuredCsv, /\[redacted\]/u);
assert.match(structuredDetailed, /\[redacted\]/u);
assert.equal(
  anonymizeQuestionText('The student identification lesson compares equal signs.'),
  'The student identification lesson compares equal signs.',
  'structured-field redaction should not consume ordinary educational wording'
);
assert.match(
  anonymizeQuestionText('Email me at student@example.com about force.'),
  /^Email me at \[redacted email\] about force\.$/u,
  'standalone email redaction should preserve useful surrounding text'
);
const separatorVariants = anonymizeQuestionText(
  'student id: ABC123; join code ABCDE; session token is secret; device_id ABC; hub-id=XYZ'
);
for (const privateValue of ['ABC123', 'ABCDE', 'secret', 'ABC', 'XYZ']) {
  assert.doesNotMatch(separatorVariants, new RegExp(`\\b${privateValue}\\b`, 'u'));
}
assert.match(separatorVariants, /student id \[redacted\]/u);
assert.match(separatorVariants, /join code \[redacted\]/u);
assert.match(separatorVariants, /session token \[redacted\]/u);

const midnightRecords = [
  {
    id: 'local-midnight-matched',
    timestamp: '2026-07-28T00:30:00.000Z',
    studentQuestion: 'Local previous-day matched question',
    topic: 'motion',
    primaryStandards: [{ standardId: 'LOCAL.A', label: 'Local A' }],
    standardsConfidence: 'strong'
  },
  {
    id: 'local-midnight-review',
    timestamp: '2026-07-28T01:00:00.000Z',
    studentQuestion: 'Local previous-day review question',
    topic: 'motion',
    primaryStandards: [],
    standardsConfidence: 'none'
  },
  {
    id: 'persisted-date-wins',
    date: '2026-07-27',
    timestamp: '2026-07-28T06:00:00.000Z',
    studentQuestion: 'Persisted local date question',
    topic: 'energy',
    primaryStandards: [{ standardId: 'LOCAL.B', label: 'Local B' }],
    standardsConfidence: 'strong'
  },
  {
    id: 'local-next-day',
    timestamp: '2026-07-28T06:00:00.000Z',
    studentQuestion: 'Actual local next-day question',
    topic: 'waves',
    primaryStandards: [{ standardId: 'LOCAL.C', label: 'Local C' }],
    standardsConfidence: 'strong'
  }
];
const midnightReport = buildQuestionsStandardsReport(midnightRecords, { date: '2026-07-27' });
assert.deepEqual(
  midnightReport.records.map((record) => record.question),
  [
    'Local previous-day matched question',
    'Local previous-day review question',
    'Persisted local date question'
  ],
  'displayed report rows should use the canonical local reporting date'
);
assert.deepEqual(midnightReport.counts, {
  totalQuestions: 3,
  matchedStandards: 2,
  needsReview: 1,
  missingStandard: 1,
  liveQuestions: 3,
  archivedQuestions: 0,
  liveSessions: 1,
  archivedSessions: 0
});
const midnightCsvRows = parse(
  buildAnonymousQuestionsStandardsCsvExport(midnightRecords, { date: '2026-07-27' }).csv,
  { columns: true }
);
assert.deepEqual(
  midnightCsvRows.map((row) => row.question),
  midnightReport.records.map((record) => record.question),
  'CSV should include exactly the displayed local-date rows'
);
const midnightSummaryEmail = buildAnonymousQuestionsStandardsReport(midnightReport, { mode: 'summary' });
const midnightDetailedEmail = buildAnonymousQuestionsStandardsReport(midnightReport, { mode: 'detailed' });
assert.match(midnightSummaryEmail.body, /Total questions: 3/u);
assert.match(midnightSummaryEmail.body, /Distinct matched standards: 2/u);
assert.match(midnightSummaryEmail.body, /Needs review: 1/u);
assert.doesNotMatch(midnightSummaryEmail.body, /Local previous-day/u);
for (const record of midnightReport.records) {
  assert.match(midnightDetailedEmail.body, new RegExp(record.question, 'u'));
}
const midnightStandardsSummary = buildStandardsSummaryReport(midnightRecords, {
  date: '2026-07-27',
  now: new Date('2026-07-28T12:00:00.000Z')
});
assert.equal(midnightStandardsSummary.totalQuestions, 3);
assert.deepEqual(
  midnightStandardsSummary.questions.map((record) => record.question).sort(),
  midnightReport.records.map((record) => record.question).sort(),
  'authoritative standards summary and normalized report should share date scope'
);
assert.equal(
  reportingDateKeyFromEntry({ timestamp: '2026-02-30T25:61:00.000Z' }),
  '',
  'invalid timestamps should not be assigned an arbitrary reporting date'
);
assert.equal(
  reportingDateKeyFromEntry({ date: '2026-02-30', timestamp: 'not-a-timestamp' }),
  '',
  'invalid explicit dates and timestamps should normalize safely'
);

const csvResult = buildAnonymousQuestionsStandardsCsvExport(records, {
  date: '2026-07-27',
  status: 'missing-standard'
});
const csvRows = parse(csvResult.csv, { columns: true });
assert.equal(csvRows.length, 1, 'CSV should use only the filtered records');
assert.equal(csvRows[0].state, 'live');
assert.equal(csvRows[0].reviewStatus, 'Missing standard');
assert.match(csvRows[0].question, /\[redacted name\]/u);
assert.match(csvRows[0].question, /\[redacted email\]/u);
assert.match(csvResult.csv, /"My name is \[redacted name\], email me at \[redacted email\]\.\nWhy is this ""thing"", strange\?"/u);
for (const privateValue of [
  'private-record-3',
  'raw-session-token-b',
  'device-hub-b',
  'alice@example.com'
]) {
  assert.doesNotMatch(csvResult.csv, new RegExp(privateValue, 'u'), `CSV should omit ${privateValue}`);
}

const emptyCsv = buildAnonymousQuestionsStandardsCsvExport([], { date: '2026-07-27' });
assert.equal(emptyCsv.rowCount, 0);
assert.deepEqual(parse(emptyCsv.csv, { columns: true }), []);
assert.match(emptyCsv.csv, /^date,time,question,topic,standard,reviewStatus,state,anonymousSession$/u);

const summaryEmail = buildAnonymousQuestionsStandardsReport(report, { mode: 'summary' });
assert.match(summaryEmail.body, /Total questions: 4/u);
assert.match(summaryEmail.body, /PS2\.A\.1: 2/u);
assert.doesNotMatch(summaryEmail.body, /What is force/u, 'summary mode should not include individual questions');
const detailedEmail = buildAnonymousQuestionsStandardsReport(report, { mode: 'detailed' });
assert.match(detailedEmail.body, /Question 1/u);
assert.match(detailedEmail.body, /What is force, really\?/u);
assert.match(detailedEmail.body, /\[redacted name\]/u);
assert.match(detailedEmail.body, /\[redacted email\]/u);
for (const privateValue of [
  'private-record-1',
  'raw-session-token-a',
  'device-hub-a',
  'student@example.com',
  'private-archive-token'
]) {
  assert.doesNotMatch(detailedEmail.body, new RegExp(privateValue, 'u'), `detailed report should omit ${privateValue}`);
  assert.doesNotMatch(summaryEmail.body, new RegExp(privateValue, 'u'), `summary report should omit ${privateValue}`);
}
assert.match(detailedEmail.composeUrl, /su=Questions%20%26%20Standards/u);
assert.match(decodeURIComponent(detailedEmail.composeUrl), /What is force, really\?/u);
const fallbackEmail = buildAnonymousQuestionsStandardsReport(report, {
  mode: 'detailed',
  maxUrlLength: 100
});
assert.equal(fallbackEmail.requiresCsvAttachment, true);
assert.match(fallbackEmail.body, /attach it to this message/u);
assert.doesNotMatch(fallbackEmail.body, /What is force/u);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-standards-reporting-'));
const logFilePath = path.join(tmpDir, 'student_interactions.json');
const archiveDir = path.join(tmpDir, 'archives');
const manifestDir = path.join(tmpDir, 'manifests');
fs.writeFileSync(logFilePath, `${JSON.stringify(records.filter((record) => record && typeof record === 'object' && !record.archived), null, 2)}\n`);
const archiveResult = archiveQuestionsStandardsSession({
  sessionId: 'raw-session-token-a',
  logFilePath,
  archiveDir,
  archiveId: 'archive-persistence-test',
  now: () => new Date('2026-07-27T16:00:00.000Z')
});
assert.equal(archiveResult.rowCount, 2);
const reloaded = loadQuestionsStandardsRecords({
  logFilePath,
  archiveDir,
  readCurrentRecords: (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))
});
const reloadedReport = buildQuestionsStandardsReport(reloaded, { date: '2026-07-27' });
assert.equal(reloadedReport.records.filter((record) => record.archived).length, 2);
assert.equal(reloadedReport.records.filter((record) => record.state === 'live').length, 1);
assert.equal(reloadedReport.counts.totalQuestions, 3, 'archiving should not duplicate records after reload');

const liveHarness = createStudentRouteHarness({
  studentQuestionRateLimitEnabled: false
});

async function runHttpChecks() {
  const sessionResponse = await liveHarness.request(
    'POST',
    '/api/profile/create-student-session',
    { className: 'Reporting Test' }
  );
  assert.equal(sessionResponse.statusCode, 201);
  const sessionId = sessionResponse.body.sessionId;
  const joinCode = sessionResponse.body.joinCode;
  const messageResponse = await liveHarness.request(
    'POST',
    '/api/student/message',
    {
      joinCode,
      studentHubId: 'private-student-hub',
      message: 'What is force?'
    }
  );
  assert.equal(messageResponse.statusCode, 200);
  assert.equal(liveHarness.studentInteractionLog.length, 1);
  const liveReport = buildQuestionsStandardsReport(liveHarness.studentInteractionLog);
  assert.equal(liveReport.counts.totalQuestions, 1, 'a real student route question should appear live');
  assert.equal(liveReport.records[0].state, 'live');
  assert.equal(liveReport.records[0].sessionKey, sessionId);

  await runProtectedRouteChecks();
}

async function runProtectedRouteChecks() {
  const handlers = new Map();
  const app = createApp(handlers);
  const sessionStore = createTeacherSessionStore();
  const teacherSessionId = sessionStore.createSession({ username: 'teacher' });
  registerProfileRoutes(app, {
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
    studentInteractionsFile: logFilePath,
    studentSessions: {},
    questionsStandardsArchiveDir: archiveDir,
    questionsStandardsExportManifestDir: manifestDir
  });

  const unauthorized = await request(
    handlers,
    'GET',
    '/api/profile/questions-standards/gmail-report',
    {},
    {},
    { date: '2026-07-27', mode: 'summary' }
  );
  assert.equal(unauthorized.statusCode, 401, 'public/student requests must not access Gmail reports');

  const authorizedExtras = {
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(teacherSessionId)}`
    }
  };
  const authorized = await request(
    handlers,
    'GET',
    '/api/profile/questions-standards/gmail-report',
    {},
    {},
    { date: '2026-07-27', status: 'missing-standard', mode: 'detailed' },
    authorizedExtras
  );
  assert.equal(authorized.statusCode, 200);
  assert.equal(authorized.body.counts.totalQuestions, 1);
  assert.match(authorized.body.gmail.composeUrl, /^https:\/\/mail\.google\.com\/mail\//u);
  assert.doesNotMatch(JSON.stringify(authorized.body), /raw-session-token|private-student-hub/u);

  const unauthorizedSummary = await request(
    handlers,
    'GET',
    '/api/profile/standards-summary',
    {},
    {},
    { date: '2026-07-27' }
  );
  assert.equal(unauthorizedSummary.statusCode, 401, 'normalized teacher report data must require teacher auth');

  const authorizedSummary = await request(
    handlers,
    'GET',
    '/api/profile/standards-summary',
    {},
    {},
    { date: '2026-07-27' },
    authorizedExtras
  );
  assert.equal(authorizedSummary.statusCode, 200);
  assert.equal(authorizedSummary.body.summary.report.counts.totalQuestions, 3);
  assert.equal(authorizedSummary.body.summary.report.counts.matchedStandards, 1);
  assert.equal(authorizedSummary.body.summary.report.counts.needsReview, 1);
  assert.equal(
    authorizedSummary.body.summary.questions.some((record) => record.state === 'archived'),
    true,
    'teacher report route should return persisted archived records'
  );
  assert.doesNotMatch(JSON.stringify(authorizedSummary.body), /private-student-hub/u);
}

runHttpChecks()
  .then(() => {
    console.log('Questions & Standards normalized reporting checks passed');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
