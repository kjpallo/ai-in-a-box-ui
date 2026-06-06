const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { registerProfileRoutes } = require('../routes/profileRoutes');
const {
  createTeacherSessionStore,
  requireTeacherAuth,
  SESSION_COOKIE_NAME
} = require('../lib/auth/teacherAuth');
const { createApp, request } = require('./test-helpers/httpHarness');
const {
  hashCsv
} = require('../lib/profile/questionsStandardsExportManifest');
const {
  CSV_COLUMNS,
  buildQuestionsStandardsCsvExport,
  exportQuestionsStandardsCsv
} = require('../lib/profile/questionsStandardsCsvExport');

const records = [
  {
    id: 'interaction-1',
    timestamp: '2026-05-01T15:00:00.000Z',
    studentQuestion: 'What is force, really?',
    answerGiven: 'A force is a push, a "pull", or both.\nIt can change motion.',
    responsePreview: 'A force is a push, a pull, or both.',
    routeType: 'knowledge',
    confidence: 'strong',
    category: 'forces',
    primaryStandards: [
      { standardId: '9-12.PS2.A.1', label: 'Forces and motion', unit: 'Forces' }
    ],
    possibleStandards: [
      { standardId: '9-12.PS3.B.1', label: 'Energy transfer', unit: 'Energy' }
    ],
    standards: [
      { standardId: '9-12.PS2.A.1', label: 'Forces and motion', unit: 'Forces' }
    ],
    units: ['Forces', 'Motion'],
    reportableForStandards: true,
    isTutorStep: false,
    source: 'student',
    sessionId: 'session-a',
    debug: { studentHubId: 'hub-7' }
  },
  {
    id: 'interaction-2',
    timestamp: '2026-05-01T16:00:00.000Z',
    question: 'Question fallback works',
    answer: 'Answer fallback works',
    routerType: 'formula',
    category: 'density',
    standards: [
      { standardId: '9-12.PS1.A.3', label: 'Matter, structure, and properties', unit: 'Matter' },
      'legacy-standard-string'
    ],
    units: ['Matter'],
    reportableForStandards: false,
    isTutorStep: true,
    tutorOriginalQuestion: 'Original formula problem',
    source: 'chat',
    sessionId: 'session-b'
  },
  {
    id: 'interaction-3',
    timestamp: '2026-05-02T15:00:00.000Z',
    message: 'Message fallback works',
    response: 'Response fallback works',
    type: 'no_match',
    units: 'Waves',
    sessionId: 'session-a'
  },
  null,
  'not a record'
];

const result = buildQuestionsStandardsCsvExport(records);
const parsedRows = parse(result.csv, {
  columns: true,
  relax_column_count: false
});

assert.deepEqual(result.columns, CSV_COLUMNS, 'export should expose the stable CSV columns');
assert.equal(result.rowCount, 3, 'export should include valid interaction records');
assert.deepEqual(result.exportedRecordIds, ['interaction-1', 'interaction-2', 'interaction-3']);
assert.equal(parsedRows.length, 3, 'CSV should parse back to the exported rows');
assert.equal(parsedRows[0].studentHubId, 'hub-7', 'debug.studentHubId should be exported');
assert.equal(parsedRows[0]['topic/category'], 'forces', 'topic/category should use category');
assert.equal(parsedRows[0].question, 'What is force, really?');
assert.equal(parsedRows[0].response, 'A force is a push, a "pull", or both.\nIt can change motion.');
assert.equal(parsedRows[0].primaryStandards, '9-12.PS2.A.1 | Forces and motion | Forces');
assert.equal(parsedRows[0].possibleStandards, '9-12.PS3.B.1 | Energy transfer | Energy');
assert.equal(parsedRows[0].standards, '9-12.PS2.A.1 | Forces and motion | Forces');
assert.equal(parsedRows[0].units, 'Forces; Motion');
assert.equal(parsedRows[0].reportableForStandards, 'true');
assert.equal(parsedRows[0].isTutorStep, 'false');
assert.equal(parsedRows[1].question, 'Question fallback works', 'question should fall back to question');
assert.equal(parsedRows[1].response, 'Answer fallback works', 'response should fall back to answer');
assert.equal(parsedRows[1].routeType, 'formula', 'routeType should fall back to routerType');
assert.equal(
  parsedRows[1].standards,
  '9-12.PS1.A.3 | Matter, structure, and properties | Matter; legacy-standard-string',
  'standards arrays should flatten safely'
);
assert.equal(parsedRows[1].reportableForStandards, 'false');
assert.equal(parsedRows[1].isTutorStep, 'true');
assert.equal(parsedRows[1].tutorOriginalQuestion, 'Original formula problem');
assert.equal(parsedRows[2].question, 'Message fallback works', 'question should fall back to message');
assert.equal(parsedRows[2].response, 'Response fallback works', 'response should fall back to response');
assert.equal(parsedRows[2].routeType, 'no_match', 'routeType should fall back to type');
assert.equal(parsedRows[2].units, 'Waves', 'non-array values should not crash flattening');

assert.match(result.csv, /"What is force, really\?"/, 'commas should trigger CSV quoting');
assert.match(result.csv, /"A force is a push, a ""pull"", or both\.\nIt can change motion\."/u, 'quotes and newlines should be escaped');
assert.match(result.csv, /"9-12\.PS1\.A\.3 \| Matter, structure, and properties \| Matter; legacy-standard-string"/, 'commas inside flattened arrays should be escaped');

const dateFiltered = buildQuestionsStandardsCsvExport(records, { date: '2026-05-01' });
assert.equal(dateFiltered.rowCount, 2, 'date filtering should keep matching local-date records');
assert.deepEqual(dateFiltered.exportedRecordIds, ['interaction-1', 'interaction-2']);

const sessionFiltered = buildQuestionsStandardsCsvExport(records, { sessionId: 'session-a' });
assert.equal(sessionFiltered.rowCount, 2, 'sessionId filtering should use top-level sessionId');
assert.deepEqual(sessionFiltered.exportedRecordIds, ['interaction-1', 'interaction-3']);

const dateAndSessionFiltered = buildQuestionsStandardsCsvExport(records, {
  date: '2026-05-01',
  sessionId: 'session-a'
});
assert.equal(dateAndSessionFiltered.rowCount, 1, 'date and session filters should compose');
assert.deepEqual(dateAndSessionFiltered.exportedRecordIds, ['interaction-1']);

const dateRangeFiltered = buildQuestionsStandardsCsvExport(records, {
  startDate: '2026-05-02',
  endDate: '2026-05-02'
});
assert.equal(dateRangeFiltered.rowCount, 1, 'date range filtering should keep records in the inclusive range');
assert.deepEqual(dateRangeFiltered.exportedRecordIds, ['interaction-3']);

const empty = buildQuestionsStandardsCsvExport([]);
assert.equal(empty.rowCount, 0, 'empty history should export zero rows');
assert.deepEqual(empty.exportedRecordIds, []);
assert.equal(empty.csv, CSV_COLUMNS.join(','), 'empty history should still export headers');
assert.deepEqual(parse(empty.csv, { columns: true }), [], 'header-only CSV should parse as no rows');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-standards-export-'));
const logFilePath = path.join(tmpDir, 'student_interactions.json');
const logContents = `${JSON.stringify(records, null, 2)}\n`;
fs.writeFileSync(logFilePath, logContents, 'utf8');

const fileBacked = exportQuestionsStandardsCsv({
  logFilePath,
  date: '2026-05-01',
  sessionId: 'session-b'
});

assert.equal(fileBacked.rowCount, 1, 'file-backed export should read student_interactions.json records');
assert.deepEqual(fileBacked.exportedRecordIds, ['interaction-2']);
assert.equal(fs.existsSync(logFilePath), true, 'raw interaction history should not be deleted');
assert.equal(fs.readFileSync(logFilePath, 'utf8'), logContents, 'raw interaction history should not be modified');
assert.deepEqual(
  fs.readdirSync(tmpDir).sort(),
  ['student_interactions.json'],
  'pure CSV export service should not write artifact files'
);

const manifestDir = path.join(tmpDir, 'manifests');
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
  questionsStandardsExportManifestDir: manifestDir
});

async function runRouteChecks() {
  const unauthorized = await request(handlers, 'GET', '/api/profile/questions-standards/export.csv');
  assert.equal(unauthorized.statusCode, 401, 'CSV export route should require teacher auth');
  assert.equal(unauthorized.body.error, 'Teacher login required.');

  const authorizedExtras = {
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(teacherSessionId)}`
    }
  };
  const csvResponse = await request(
    handlers,
    'GET',
    '/api/profile/questions-standards/export.csv',
    {},
    {},
    { startDate: '2026-05-01', endDate: '2026-05-02', classSessionId: 'session-a' },
    authorizedExtras
  );
  assert.equal(csvResponse.statusCode, 200, 'authorized teacher should be able to export CSV');
  assert.equal(csvResponse.getHeader('content-type'), 'text/csv; charset=utf-8');
  assert.match(
    csvResponse.getHeader('content-disposition'),
    /^attachment; filename="questions-standards-history-2026-05-01-to-2026-05-02-session-session-a\.csv"$/,
    'CSV export should be returned as a safe download filename'
  );
  assert.match(
    csvResponse.getHeader('x-export-id'),
    /^[0-9a-f-]{32,36}$/i,
    'CSV export should expose a safe export id header'
  );
  const routeRows = parse(csvResponse.body, { columns: true });
  assert.deepEqual(
    routeRows.map((row) => row.id),
    ['interaction-1', 'interaction-3'],
    'route should apply date-range and class-session filters'
  );
  assert.equal(routeRows[0].question, 'What is force, really?');
  assert.equal(routeRows[0].response, 'A force is a push, a "pull", or both.\nIt can change motion.');

  const manifestFiles = fs.readdirSync(manifestDir).sort();
  assert.equal(manifestFiles.length, 1, 'successful route export should write one manifest');
  const manifestPath = path.join(manifestDir, manifestFiles[0]);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.exportId, csvResponse.getHeader('x-export-id'), 'manifest exportId should match response header');
  assert.equal(manifest.filename, 'questions-standards-history-2026-05-01-to-2026-05-02-session-session-a.csv');
  assert.deepEqual(manifest.filters, {
    date: '',
    startDate: '2026-05-01',
    endDate: '2026-05-02',
    sessionId: 'session-a'
  });
  assert.equal(manifest.sourceLogPath, path.resolve(logFilePath), 'manifest should record the source log path');
  assert.deepEqual(manifest.exportedRecordIds, ['interaction-1', 'interaction-3']);
  assert.equal(manifest.rowCount, 2, 'manifest should record exported row count');
  assert.deepEqual(manifest.columns, CSV_COLUMNS, 'manifest should record exported columns');
  assert.deepEqual(manifest.checksum, {
    algorithm: 'sha256',
    value: hashCsv(csvResponse.body)
  }, 'manifest checksum should match the generated CSV');
  assert.equal(manifest.purgeCompleted, false, 'manifest should not mark purge complete');
  assert.equal(manifest.deletedRecordCount, 0, 'manifest should not record deleted rows');

  const manifestText = fs.readFileSync(manifestPath, 'utf8');
  assert.doesNotMatch(manifestText, /What is force, really\?/u, 'manifest should not include full question text');
  assert.doesNotMatch(manifestText, /push, a "pull", or both/u, 'manifest should not include full answer text');
  assert.doesNotMatch(manifestText, /Message fallback works/u, 'manifest should not include filtered question text');
  assert.doesNotMatch(manifestText, /Response fallback works/u, 'manifest should not include filtered answer text');

  const allHistoryResponse = await request(
    handlers,
    'GET',
    '/api/profile/questions-standards/export.csv',
    {},
    {},
    {},
    authorizedExtras
  );
  assert.equal(parse(allHistoryResponse.body, { columns: true }).length, 3, 'route should export all current history without filters');
  assert.equal(fs.readdirSync(manifestDir).length, 2, 'each successful route export should write a manifest');

  const invalidDateResponse = await request(
    handlers,
    'GET',
    '/api/profile/questions-standards/export.csv',
    {},
    {},
    { date: '05/01/2026' },
    authorizedExtras
  );
  assert.equal(invalidDateResponse.statusCode, 400, 'route should reject unsafe date filters');
  assert.equal(invalidDateResponse.body.error, 'date must use YYYY-MM-DD.');

  const failingHandlers = new Map();
  const failingApp = createApp(failingHandlers);
  const failingManifestDir = path.join(tmpDir, 'manifest-blocker');
  fs.writeFileSync(failingManifestDir, 'not a directory', 'utf8');
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
    studentInteractionsFile: logFilePath,
    studentSessions: {},
    questionsStandardsExportManifestDir: failingManifestDir
  });

  const failedManifestResponse = await request(
    failingHandlers,
    'GET',
    '/api/profile/questions-standards/export.csv',
    {},
    {},
    { date: '2026-05-01' },
    authorizedExtras
  );
  assert.equal(failedManifestResponse.statusCode, 500, 'manifest write failure should fail the export safely');
  assert.equal(failedManifestResponse.body.error, 'Unable to export question history.');
  assert.equal(failedManifestResponse.getHeader('x-export-id'), undefined, 'failed manifest write should not create a purge-ready export id');
  assert.equal(fs.readFileSync(logFilePath, 'utf8'), logContents, 'failed manifest write should not modify raw records');
}

runRouteChecks()
  .then(() => {
    console.log('Questions & Standards CSV export checks passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
