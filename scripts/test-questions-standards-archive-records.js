const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parse } = require('csv-parse/sync');
const {
  buildStandardsSummaryReport
} = require('../lib/system/standardsSummaryReport');
const {
  buildQuestionsStandardsCsvExport,
  exportQuestionsStandardsCsv
} = require('../lib/profile/questionsStandardsCsvExport');
const {
  loadQuestionsStandardsRecords
} = require('../lib/profile/questionsStandardsArchiveRecords');
const { hashCsv } = require('../lib/profile/questionsStandardsExportManifest');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-standards-archive-records-'));
const logFilePath = path.join(tmpDir, 'student_interactions.json');
const archiveDir = path.join(tmpDir, 'archives');

const rawRecords = [
  {
    id: 'raw-current-1',
    timestamp: '2026-05-03T10:00:00.000Z',
    studentQuestion: 'Current raw question still appears?',
    answerGiven: 'Yes, raw records still appear.',
    routeType: 'knowledge',
    confidence: 'strong',
    category: 'current raw',
    sessionId: 'session-current',
    primaryStandards: [
      { standardId: 'RAW.STANDARD.1', label: 'Raw current standard', unit: 'Raw Unit' }
    ],
    standards: [
      { standardId: 'RAW.STANDARD.1', label: 'Raw current standard', unit: 'Raw Unit' }
    ],
    units: ['Raw Unit'],
    standardsConfidence: 'strong',
    reportableForStandards: true
  },
  {
    id: 'duplicate-1',
    timestamp: '2026-05-03T10:05:00.000Z',
    studentQuestion: 'Raw duplicate should win?',
    answerGiven: 'The raw copy wins.',
    routeType: 'formula',
    confidence: 'medium',
    category: 'duplicate raw',
    primaryStandards: [
      { standardId: 'RAW.DUPLICATE.1', label: 'Raw duplicate standard', unit: 'Raw Unit' }
    ],
    standards: [
      { standardId: 'RAW.DUPLICATE.1', label: 'Raw duplicate standard', unit: 'Raw Unit' }
    ],
    units: ['Raw Unit'],
    standardsConfidence: 'medium',
    reportableForStandards: true
  }
];

const archivedRecords = [
  {
    id: 'archived-1',
    timestamp: '2026-05-03T11:00:00.000Z',
    studentQuestion: 'Archived question still appears?',
    answerGiven: 'Archived answer remains reviewable.',
    responsePreview: 'Archived answer remains reviewable.',
    routeType: 'knowledge',
    confidence: 'strong',
    category: 'archived topic',
    source: 'student',
    sessionId: 'session-archived',
    debug: { studentHubId: 'hub-archived' },
    primaryStandards: [
      { standardId: 'ARCH.STANDARD.1', label: 'Archived standard label', unit: 'Archive Unit' }
    ],
    possibleStandards: [
      { standardId: 'ARCH.POSSIBLE.1', label: 'Archived possible label', unit: 'Archive Unit' }
    ],
    standards: [
      { standardId: 'ARCH.STANDARD.1', label: 'Archived standard label', unit: 'Archive Unit' }
    ],
    units: ['Archive Unit'],
    reportableForStandards: true
  },
  {
    id: 'archived-other-date',
    timestamp: '2026-05-04T11:00:00.000Z',
    studentQuestion: 'Other date archived question?',
    answerGiven: 'Other date answer.',
    responsePreview: 'Other date answer.',
    routeType: 'knowledge',
    confidence: 'weak',
    category: 'other archived date',
    primaryStandards: [
      { standardId: 'ARCH.OTHER_DATE.1', label: 'Other date standard', unit: 'Other Unit' }
    ],
    standards: [
      { standardId: 'ARCH.OTHER_DATE.1', label: 'Other date standard', unit: 'Other Unit' }
    ],
    units: ['Other Unit'],
    reportableForStandards: true
  },
  {
    id: 'duplicate-1',
    timestamp: '2026-05-03T12:00:00.000Z',
    studentQuestion: 'Archived duplicate should not count?',
    answerGiven: 'This duplicate should be skipped.',
    routeType: 'knowledge',
    confidence: 'strong',
    category: 'duplicate archive',
    primaryStandards: [
      { standardId: 'ARCH.DUPLICATE.1', label: 'Archived duplicate standard', unit: 'Archive Unit' }
    ],
    standards: [
      { standardId: 'ARCH.DUPLICATE.1', label: 'Archived duplicate standard', unit: 'Archive Unit' }
    ],
    units: ['Archive Unit'],
    reportableForStandards: true
  }
];

fs.mkdirSync(archiveDir, { recursive: true });
fs.writeFileSync(logFilePath, `${JSON.stringify(rawRecords, null, 2)}\n`, 'utf8');

const archiveExport = buildQuestionsStandardsCsvExport(archivedRecords);
const archiveCsvPath = path.join(archiveDir, 'archive-test.csv');
const archiveManifestPath = path.join(archiveDir, 'archive-test.manifest.json');
fs.writeFileSync(archiveCsvPath, archiveExport.csv, 'utf8');
fs.writeFileSync(archiveManifestPath, `${JSON.stringify({
  archiveId: 'archive-test',
  exportId: 'archive-test',
  createdAt: '2026-06-06T12:00:00.000Z',
  csvFilename: 'archive-test.csv',
  exportedRecordIds: archiveExport.exportedRecordIds,
  rowCount: archiveExport.rowCount,
  checksum: {
    algorithm: 'sha256',
    value: hashCsv(archiveExport.csv)
  },
  rawRecordsDeleted: true,
  deletedRecordCount: archiveExport.rowCount
}, null, 2)}\n`, 'utf8');

const mergedRecords = loadQuestionsStandardsRecords({
  logFilePath,
  archiveDir,
  readCurrentRecords: (targetPath) => JSON.parse(fs.readFileSync(targetPath, 'utf8'))
});

assert.deepEqual(
  mergedRecords.map((record) => record.id),
  ['raw-current-1', 'duplicate-1', 'archived-1', 'archived-other-date'],
  'merged history should include raw and archived records without duplicate ids'
);

const summary = buildStandardsSummaryReport(mergedRecords, {
  now: new Date('2026-06-06T12:00:00.000Z'),
  date: '2026-05-03'
});

assert.equal(summary.totalQuestions, 3, 'date-filtered summary should include raw records and archived records');
assert.deepEqual(summary.availableDates, ['2026-05-04', '2026-05-03'], 'archived dates should remain available for reports');
assert.deepEqual(
  summary.standards.map((row) => [row.standardId, row.count]),
  [
    ['ARCH.STANDARD.1', 1],
    ['RAW.DUPLICATE.1', 1],
    ['RAW.STANDARD.1', 1]
  ],
  'duplicate archived ids should not add extra standard counts'
);
assert.equal(
  summary.standards.some((row) => row.standardId === 'ARCH.DUPLICATE.1'),
  false,
  'skipped duplicate archive records should not appear in standards'
);

const archivedQuestion = summary.questions.find((question) => question.id === 'archived-1');
assert.ok(archivedQuestion, 'Questions & Standards summary should include archived CSV questions');
assert.equal(archivedQuestion.question, 'Archived question still appears?');
assert.equal(archivedQuestion.responsePreview, 'Archived answer remains reviewable.');
assert.equal(archivedQuestion.topic, 'archived topic');
assert.equal(archivedQuestion.source, 'student');
assert.equal(archivedQuestion.confidence, 'strong');
assert.equal(archivedQuestion.standardsConfidence, 'strong');
assert.deepEqual(archivedQuestion.primaryStandards, [
  { standardId: 'ARCH.STANDARD.1', label: 'Archived standard label', unit: 'Archive Unit' }
]);
assert.deepEqual(archivedQuestion.possibleStandards, [
  { standardId: 'ARCH.POSSIBLE.1', label: 'Archived possible label', unit: 'Archive Unit' }
]);
assert.deepEqual(archivedQuestion.units, ['Archive Unit']);

const otherDateSummary = buildStandardsSummaryReport(mergedRecords, {
  now: new Date('2026-06-06T12:00:00.000Z'),
  date: '2026-05-04'
});
assert.equal(otherDateSummary.totalQuestions, 1, 'date filtering should work for archived-only dates');
assert.equal(otherDateSummary.questions[0].id, 'archived-other-date');

const currentOnly = summary.questions.find((question) => question.id === 'raw-current-1');
assert.ok(currentOnly, 'current raw records should still appear in Questions & Standards');

const exported = exportQuestionsStandardsCsv({
  logFilePath,
  archiveDir,
  date: '2026-05-03'
});
const exportedRows = parse(exported.csv, { columns: true });
assert.deepEqual(
  exportedRows.map((row) => row.id),
  ['raw-current-1', 'duplicate-1', 'archived-1'],
  'CSV export should preserve date filtering and include archived records'
);
assert.equal(
  exportedRows.find((row) => row.id === 'archived-1').response,
  'Archived answer remains reviewable.',
  'CSV export should preserve archived answers'
);
assert.equal(
  exportedRows.find((row) => row.id === 'archived-1').primaryStandards,
  'ARCH.STANDARD.1 | Archived standard label | Archive Unit',
  'CSV export should preserve archived standards'
);

console.log('Questions & Standards archive record checks passed');
