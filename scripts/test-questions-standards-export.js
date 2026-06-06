const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parse } = require('csv-parse/sync');
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
  'CSV export should not write artifact files yet'
);

console.log('Questions & Standards CSV export checks passed');
