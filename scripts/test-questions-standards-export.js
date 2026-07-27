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
  ANONYMOUS_CSV_COLUMNS,
  CSV_COLUMNS,
  buildQuestionsStandardsCsvExport,
  exportQuestionsStandardsCsv
} = require('../lib/profile/questionsStandardsCsvExport');
const {
  purgeQuestionsStandardsExport
} = require('../lib/profile/questionsStandardsExportPurge');

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
const problemQuestionsPath = path.join(tmpDir, 'problem_questions.json');
const archiveDir = path.join(tmpDir, 'archives');
const logContents = `${JSON.stringify(records, null, 2)}\n`;
const problemQuestionsContents = `${JSON.stringify([
  { id: 'problem-1', question: 'Needs review' }
], null, 2)}\n`;
fs.writeFileSync(logFilePath, logContents, 'utf8');
fs.writeFileSync(problemQuestionsPath, problemQuestionsContents, 'utf8');

const fileBacked = exportQuestionsStandardsCsv({
  logFilePath,
  archiveDir,
  date: '2026-05-01',
  sessionId: 'session-a'
});

assert.equal(fileBacked.rowCount, 1, 'file-backed export should read student_interactions.json records');
assert.deepEqual(fileBacked.exportedRecordIds, ['interaction-1']);
assert.deepEqual(fileBacked.columns, ANONYMOUS_CSV_COLUMNS, 'teacher export should use anonymous report columns');
assert.doesNotMatch(fileBacked.csv, /session-a|hub-7|interaction-1/u, 'teacher export should omit internal identifiers');
assert.equal(fs.existsSync(logFilePath), true, 'raw interaction history should not be deleted');
assert.equal(fs.readFileSync(logFilePath, 'utf8'), logContents, 'raw interaction history should not be modified');
assert.deepEqual(
  fs.readdirSync(tmpDir).sort(),
  ['problem_questions.json', 'student_interactions.json'],
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
  questionsStandardsArchiveDir: archiveDir,
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
    /^attachment; filename="questions-standards-2026-05-01-to-2026-05-02-session\.csv"$/,
    'CSV export should describe the session scope without exposing its identifier'
  );
  assert.doesNotMatch(csvResponse.getHeader('content-disposition'), /session-a/u);
  assert.match(
    csvResponse.getHeader('x-export-id'),
    /^[0-9a-f-]{32,36}$/i,
    'CSV export should expose a safe export id header'
  );
  const routeRows = parse(csvResponse.body, { columns: true });
  assert.deepEqual(
    routeRows.map((row) => row.question),
    ['What is force, really?', 'Message fallback works'],
    'route should apply date-range and class-session filters using anonymous rows'
  );
  assert.equal(routeRows[0].question, 'What is force, really?');
  assert.equal(routeRows[0].standard, '9-12.PS2.A.1 | Forces and motion');
  assert.equal(routeRows[1].reviewStatus, 'Missing standard');
  assert.equal(Object.hasOwn(routeRows[0], 'id'), false, 'anonymous CSV must omit raw record ids');
  assert.equal(Object.hasOwn(routeRows[0], 'sessionId'), false, 'anonymous CSV must omit session ids');
  assert.equal(Object.hasOwn(routeRows[0], 'studentHubId'), false, 'anonymous CSV must omit student hub ids');
  assert.equal(Object.hasOwn(routeRows[0], 'response'), false, 'anonymous CSV should not include answer metadata');
  assert.doesNotMatch(csvResponse.body, /session-a|hub-7|interaction-1/u);

  const manifestFiles = fs.readdirSync(manifestDir).sort();
  assert.equal(manifestFiles.length, 1, 'successful route export should write one manifest');
  const manifestPath = path.join(manifestDir, manifestFiles[0]);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.exportId, csvResponse.getHeader('x-export-id'), 'manifest exportId should match response header');
  assert.equal(manifest.filename, 'questions-standards-2026-05-01-to-2026-05-02-session.csv');
  assert.deepEqual(manifest.filters, {
    date: '',
    startDate: '2026-05-01',
    endDate: '2026-05-02',
    sessionId: 'session-a',
    status: 'all'
  });
  assert.equal(manifest.sourceLogPath, path.resolve(logFilePath), 'manifest should record the source log path');
  assert.deepEqual(manifest.exportedRecordIds, ['interaction-1', 'interaction-3']);
  assert.equal(manifest.rowCount, 2, 'manifest should record exported row count');
  assert.deepEqual(manifest.columns, ANONYMOUS_CSV_COLUMNS, 'manifest should record anonymous exported columns');
  assert.deepEqual(manifest.checksum, {
    algorithm: 'sha256',
    value: hashCsv(csvResponse.body)
  }, 'manifest checksum should match the generated CSV');
  assert.equal(manifest.purgeCompleted, false, 'manifest should not mark purge complete');
  assert.equal(manifest.deletedRecordCount, 0, 'manifest should not record deleted rows');
  assert.equal(fs.readFileSync(logFilePath, 'utf8'), logContents, 'export endpoint should not purge raw records');

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
  assert.equal(parse(allHistoryResponse.body, { columns: true }).length, 2, 'route should export all reportable current history without filters');
  assert.equal(fs.readdirSync(manifestDir).length, 2, 'each successful route export should write a manifest');
  assert.equal(fs.readFileSync(logFilePath, 'utf8'), logContents, 'subsequent export endpoint calls should not purge raw records');

  const hostileSessionValue = 'raw-session-id\r\nX-Injected: yes " JOINABCDE';
  const hostileFilenameResponse = await request(
    handlers,
    'GET',
    '/api/profile/questions-standards/export.csv',
    {},
    {},
    { date: '2026-05-01', classSessionId: hostileSessionValue },
    authorizedExtras
  );
  assert.equal(hostileFilenameResponse.statusCode, 200);
  const hostileDisposition = hostileFilenameResponse.getHeader('content-disposition');
  assert.equal(
    hostileDisposition,
    'attachment; filename="questions-standards-2026-05-01-session.csv"',
    'session-filtered filenames should be deterministic and independent of the raw query value'
  );
  assert.doesNotMatch(hostileDisposition, /raw-session-id|JOINABCDE|X-Injected/iu);
  assert.doesNotMatch(hostileDisposition, /[\r\n]/u, 'Content-Disposition must not contain header injection characters');
  const hostileFilename = hostileDisposition.match(/filename="([^"]+)"/u)?.[1] || '';
  assert.match(hostileFilename, /^[a-z0-9_-]+\.csv$/u);
  assert.equal(hostileFilename.endsWith('.csv'), true);
  assert.doesNotMatch(hostileFilename, /["\r\n]/u);

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

  const impossibleDateResponse = await request(
    handlers,
    'GET',
    '/api/profile/questions-standards/export.csv',
    {},
    {},
    { date: '2026-02-30' },
    authorizedExtras
  );
  assert.equal(impossibleDateResponse.statusCode, 400, 'route should reject impossible calendar dates');
  assert.equal(impossibleDateResponse.body.error, 'date must use YYYY-MM-DD.');

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
    questionsStandardsArchiveDir: archiveDir,
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

  const missingManifestResponse = await request(
    handlers,
    'POST',
    '/api/profile/questions-standards/export/:exportId/purge',
    { confirm: true },
    { exportId: 'missing-export-id' },
    {},
    authorizedExtras
  );
  assert.equal(missingManifestResponse.statusCode, 404, 'purge should fail when manifest is missing');
  assert.equal(missingManifestResponse.body.error, 'Export manifest not found.');
  assert.equal(fs.readFileSync(logFilePath, 'utf8'), logContents, 'missing manifest purge should not modify raw records');

  const missingConfirmResponse = await request(
    handlers,
    'POST',
    '/api/profile/questions-standards/export/:exportId/purge',
    {},
    { exportId: manifest.exportId },
    {},
    authorizedExtras
  );
  assert.equal(missingConfirmResponse.statusCode, 400, 'purge should require confirm true');
  assert.equal(missingConfirmResponse.body.error, 'confirm true is required.');
  assert.equal(fs.readFileSync(logFilePath, 'utf8'), logContents, 'unconfirmed purge should not modify raw records');

  const falseConfirmResponse = await request(
    handlers,
    'POST',
    '/api/profile/questions-standards/export/:exportId/purge',
    { confirm: false },
    { exportId: manifest.exportId },
    {},
    authorizedExtras
  );
  assert.equal(falseConfirmResponse.statusCode, 400, 'purge should reject false confirm');
  assert.equal(fs.readFileSync(logFilePath, 'utf8'), logContents, 'false confirm purge should not modify raw records');

  const unauthorizedPurge = await request(
    handlers,
    'POST',
    '/api/profile/questions-standards/export/:exportId/purge',
    { confirm: true },
    { exportId: manifest.exportId }
  );
  assert.equal(unauthorizedPurge.statusCode, 401, 'purge route should require teacher auth');
  assert.equal(unauthorizedPurge.body.error, 'Teacher login required.');
  assert.equal(fs.readFileSync(logFilePath, 'utf8'), logContents, 'unauthorized purge should not modify raw records');

  const purgeResponse = await request(
    handlers,
    'POST',
    '/api/profile/questions-standards/export/:exportId/purge',
    { confirm: true },
    { exportId: manifest.exportId },
    {},
    authorizedExtras
  );
  assert.equal(purgeResponse.statusCode, 200, 'confirmed purge should succeed');
  assert.equal(purgeResponse.body.ok, true);
  assert.equal(purgeResponse.body.exportId, manifest.exportId);
  assert.equal(purgeResponse.body.deletedRecordCount, 2, 'purge should delete only exported records');
  assert.deepEqual(purgeResponse.body.remainingUnmatchedExportIds, [], 'purge should match all exported IDs');
  assert.equal(purgeResponse.body.purgeCompleted, true);
  assert.equal(purgeResponse.body.purgeStatus, 'completed');
  assert.match(purgeResponse.body.purgedAt, /^\d{4}-\d{2}-\d{2}T/u, 'purge should report purge time');

  const purgedRecords = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  assert.deepEqual(
    purgedRecords.map((entry) => entry && entry.id).filter(Boolean),
    ['interaction-2'],
    'purge should leave unrelated interaction records'
  );
  assert.equal(purgedRecords.includes(null), true, 'purge should leave unrelated non-record log entries');
  assert.equal(purgedRecords.includes('not a record'), true, 'purge should leave unrelated non-object log entries');
  assert.equal(
    fs.readFileSync(problemQuestionsPath, 'utf8'),
    problemQuestionsContents,
    'purge should not touch problem_questions.json'
  );

  const updatedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(updatedManifest.purgeCompleted, true, 'manifest should mark purge complete');
  assert.match(updatedManifest.purgedAt, /^\d{4}-\d{2}-\d{2}T/u, 'manifest should record purge time');
  assert.equal(updatedManifest.deletedRecordCount, 2, 'manifest should record deleted rows');
  assert.deepEqual(updatedManifest.remainingUnmatchedExportIds, [], 'manifest should record unmatched exported IDs');
  assert.equal(updatedManifest.purgeStatus, 'completed', 'manifest should record purge status');

  const alreadyCompletedResponse = await request(
    handlers,
    'POST',
    '/api/profile/questions-standards/export/:exportId/purge',
    { confirm: true },
    { exportId: manifest.exportId },
    {},
    authorizedExtras
  );
  assert.equal(alreadyCompletedResponse.statusCode, 409, 'purge should fail if manifest is already completed');
  assert.equal(alreadyCompletedResponse.body.error, 'Export has already been purged.');
  assert.deepEqual(
    JSON.parse(fs.readFileSync(logFilePath, 'utf8')).map((entry) => entry && entry.id).filter(Boolean),
    ['interaction-2'],
    'already-completed purge should not modify raw records'
  );

  const serviceTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-standards-purge-service-'));
  const serviceLogFilePath = path.join(serviceTmpDir, 'student_interactions.json');
  const serviceManifestDir = path.join(serviceTmpDir, 'manifests');
  fs.mkdirSync(serviceManifestDir, { recursive: true });
  fs.writeFileSync(serviceLogFilePath, JSON.stringify([
    { id: 'direct-1', question: 'Exported one' },
    { id: 'direct-2', question: 'Not exported' }
  ], null, 2), 'utf8');
  fs.writeFileSync(path.join(serviceManifestDir, 'manifest.json'), JSON.stringify({
    exportId: 'direct-export',
    exportedRecordIds: ['direct-1', 'missing-direct'],
    rowCount: 2,
    purgeCompleted: false,
    deletedRecordCount: 0
  }, null, 2), 'utf8');

  const directResult = purgeQuestionsStandardsExport({
    exportId: 'direct-export',
    logFilePath: serviceLogFilePath,
    manifestDir: serviceManifestDir,
    now: () => new Date('2026-06-06T12:00:00.000Z')
  });
  assert.equal(directResult.deletedRecordCount, 1, 'purge service should delete matched exported records');
  assert.deepEqual(
    directResult.remainingUnmatchedExportIds,
    ['missing-direct'],
    'purge service should report exported IDs that were no longer in the source log'
  );
  assert.equal(directResult.purgeStatus, 'completed_with_unmatched_export_ids');
}

runRouteChecks()
  .then(() => {
    console.log('Questions & Standards CSV export checks passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
