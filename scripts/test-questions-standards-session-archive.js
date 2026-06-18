const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parse } = require('csv-parse/sync');
const {
  archiveQuestionsStandardsSession
} = require('../lib/profile/questionsStandardsSessionArchive');
const { hashCsv } = require('../lib/profile/questionsStandardsExportManifest');

const records = [
  {
    id: 'session-a-1',
    timestamp: '2026-05-01T15:00:00.000Z',
    studentQuestion: 'What is force?',
    answerGiven: 'A push or pull.',
    routeType: 'knowledge',
    confidence: 'strong',
    category: 'forces',
    sessionId: 'session-a',
    debug: { studentHubId: 'hub-a' }
  },
  {
    id: 'session-b-1',
    timestamp: '2026-05-01T16:00:00.000Z',
    question: 'What is density?',
    answer: 'Mass divided by volume.',
    routeType: 'formula',
    category: 'density',
    sessionId: 'session-b'
  },
  {
    id: 'session-a-2',
    timestamp: '2026-05-02T15:00:00.000Z',
    message: 'What is displacement?',
    response: 'Change in position.',
    type: 'knowledge',
    sessionId: 'session-a'
  },
  null,
  'not a record'
];

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-standards-session-archive-'));
const logFilePath = path.join(tmpDir, 'student_interactions.json');
const problemQuestionsPath = path.join(tmpDir, 'problem_questions.json');
const archiveDir = path.join(tmpDir, 'archives');
const originalLogContents = `${JSON.stringify(records, null, 2)}\n`;
const problemQuestionsContents = `${JSON.stringify([
  { id: 'problem-1', question: 'Review me later' }
], null, 2)}\n`;

writeFixtureLog(originalLogContents);
fs.writeFileSync(problemQuestionsPath, problemQuestionsContents, 'utf8');

const archiveResult = archiveQuestionsStandardsSession({
  classSessionId: 'session-a',
  startDate: '2026-05-01',
  endDate: '2026-05-02',
  logFilePath,
  archiveDir,
  archiveId: 'archive-session-a',
  now: () => new Date('2026-06-06T12:00:00.000Z')
});

assert.equal(archiveResult.ok, true, 'archive should succeed');
assert.equal(archiveResult.archived, true, 'archive should report archived true');
assert.equal(archiveResult.archiveId, 'archive-session-a');
assert.equal(archiveResult.exportId, 'archive-session-a');
assert.equal(archiveResult.sessionId, 'session-a');
assert.equal(archiveResult.classSessionId, 'session-a');
assert.equal(archiveResult.startDate, '2026-05-01');
assert.equal(archiveResult.endDate, '2026-05-02');
assert.equal(archiveResult.rowCount, 2, 'archive should include matching session/date rows');
assert.deepEqual(archiveResult.exportedRecordIds, ['session-a-1', 'session-a-2']);
assert.equal(archiveResult.rawRecordsDeleted, true, 'archive should report raw deletion after success');
assert.equal(archiveResult.deletedRecordCount, 2, 'archive should delete only archived records');
assert.equal(fs.existsSync(archiveResult.csvPath), true, 'archive should write CSV');
assert.equal(fs.existsSync(archiveResult.manifestPath), true, 'archive should write manifest');

const archivedCsv = fs.readFileSync(archiveResult.csvPath, 'utf8');
const archivedRows = parse(archivedCsv, { columns: true });
assert.deepEqual(
  archivedRows.map((row) => row.id),
  ['session-a-1', 'session-a-2'],
  'archive CSV should contain only matching session rows'
);
assert.equal(archivedRows[0].question, 'What is force?');
assert.equal(archivedRows[1].question, 'What is displacement?');

const manifest = JSON.parse(fs.readFileSync(archiveResult.manifestPath, 'utf8'));
assert.equal(manifest.archiveId, 'archive-session-a', 'manifest should record archiveId');
assert.equal(manifest.exportId, 'archive-session-a', 'manifest should expose exportId alias');
assert.equal(manifest.createdAt, '2026-06-06T12:00:00.000Z');
assert.equal(manifest.sessionId, 'session-a');
assert.equal(manifest.classSessionId, 'session-a');
assert.equal(manifest.csvFilename, path.basename(archiveResult.csvPath));
assert.deepEqual(manifest.exportedRecordIds, ['session-a-1', 'session-a-2']);
assert.equal(manifest.rowCount, 2, 'manifest should record archived row count');
assert.deepEqual(manifest.checksum, {
  algorithm: 'sha256',
  value: hashCsv(archivedCsv)
}, 'manifest checksum should match archive CSV');
assert.equal(manifest.rawRecordsDeleted, true, 'manifest should record raw deletion completed');
assert.equal(manifest.deletedRecordCount, 2, 'manifest should record deleted raw count');

const remainingRecords = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
assert.deepEqual(
  remainingRecords.map((entry) => entry && entry.id).filter(Boolean),
  ['session-b-1'],
  'archive should leave unrelated session records untouched'
);
assert.equal(remainingRecords.includes(null), true, 'archive should leave unrelated null log entries');
assert.equal(remainingRecords.includes('not a record'), true, 'archive should leave unrelated non-object log entries');
assert.equal(
  fs.readFileSync(problemQuestionsPath, 'utf8'),
  problemQuestionsContents,
  'archive should not touch problem_questions.json'
);

writeFixtureLog(originalLogContents);
const noRecordsArchiveDir = path.join(tmpDir, 'no-records-archives');
const noRecordsResult = archiveQuestionsStandardsSession({
  sessionId: 'missing-session',
  logFilePath,
  archiveDir: noRecordsArchiveDir,
  archiveId: 'missing-session-archive'
});
assert.equal(noRecordsResult.ok, true);
assert.equal(noRecordsResult.archived, false, 'empty session should not create archive');
assert.equal(noRecordsResult.status, 'no_records');
assert.equal(noRecordsResult.rowCount, 0);
assert.equal(noRecordsResult.rawRecordsDeleted, false);
assert.equal(fs.existsSync(noRecordsArchiveDir), false, 'empty session should not write archive files');
assert.equal(fs.readFileSync(logFilePath, 'utf8'), originalLogContents, 'empty session should not delete raw records');

const classSessionOnlyRecords = [
  {
    id: 'class-session-only-1',
    timestamp: '2026-05-03T15:00:00.000Z',
    studentQuestion: 'Can classSessionId records archive?',
    answerGiven: 'Yes, classSessionId can identify a recorded session.',
    routeType: 'knowledge',
    confidence: 'strong',
    category: 'archive workflow',
    classSessionId: 'class-session-only'
  },
  {
    id: 'class-session-other-1',
    timestamp: '2026-05-03T15:05:00.000Z',
    studentQuestion: 'Should this stay current?',
    answerGiven: 'Yes.',
    routeType: 'knowledge',
    confidence: 'strong',
    category: 'archive workflow',
    classSessionId: 'class-session-other'
  }
];
writeFixtureLog(`${JSON.stringify(classSessionOnlyRecords, null, 2)}\n`);
const classSessionOnlyResult = archiveQuestionsStandardsSession({
  sessionId: 'class-session-only',
  logFilePath,
  archiveDir: path.join(tmpDir, 'class-session-only-archives'),
  archiveId: 'archive-class-session-only',
  now: () => new Date('2026-06-06T12:15:00.000Z')
});
assert.equal(classSessionOnlyResult.archived, true, 'archive should match records stored with classSessionId only');
assert.equal(classSessionOnlyResult.rowCount, 1, 'classSessionId-only archive should include the matching question');
assert.deepEqual(classSessionOnlyResult.exportedRecordIds, ['class-session-only-1']);
const classSessionOnlyCsvRows = parse(fs.readFileSync(classSessionOnlyResult.csvPath, 'utf8'), { columns: true });
assert.equal(
  classSessionOnlyCsvRows[0].sessionId,
  'class-session-only',
  'archive CSV should preserve classSessionId as the restartable session id'
);
assert.deepEqual(
  JSON.parse(fs.readFileSync(logFilePath, 'utf8')).map((entry) => entry.id),
  ['class-session-other-1'],
  'classSessionId-only archive should leave other recorded sessions untouched'
);

assert.throws(
  () => archiveQuestionsStandardsSession({ logFilePath, archiveDir }),
  /sessionId or classSessionId is required/,
  'archive should reject missing session id'
);
assert.throws(
  () => archiveQuestionsStandardsSession({ sessionId: 'session-a', date: '05/01/2026', logFilePath, archiveDir }),
  /date must use YYYY-MM-DD/,
  'archive should reject invalid dates'
);

writeFixtureLog(originalLogContents);
withPatchedWriteFileSync((originalWriteFileSync) => {
  fs.writeFileSync = (targetPath, contents, encoding) => {
    if (String(targetPath).endsWith('.csv')) {
      throw new Error('simulated CSV write failure');
    }
    return originalWriteFileSync.call(fs, targetPath, contents, encoding);
  };

  assert.throws(
    () => archiveQuestionsStandardsSession({
      sessionId: 'session-a',
      logFilePath,
      archiveDir: path.join(tmpDir, 'csv-write-fails')
    }),
    /simulated CSV write failure/,
    'archive should surface CSV write failures'
  );
});
assert.equal(
  fs.readFileSync(logFilePath, 'utf8'),
  originalLogContents,
  'archive should not delete raw records if CSV write fails'
);

writeFixtureLog(originalLogContents);
withPatchedWriteFileSync((originalWriteFileSync) => {
  fs.writeFileSync = (targetPath, contents, encoding) => {
    if (String(targetPath).endsWith('.csv')) {
      return originalWriteFileSync.call(fs, targetPath, 'id\ncorrupted-row\n', encoding);
    }
    return originalWriteFileSync.call(fs, targetPath, contents, encoding);
  };

  assert.throws(
    () => archiveQuestionsStandardsSession({
      sessionId: 'session-a',
      logFilePath,
      archiveDir: path.join(tmpDir, 'csv-verification-fails')
    }),
    /Archive CSV verification failed/,
    'archive should verify the CSV before deleting raw records'
  );
});
assert.equal(
  fs.readFileSync(logFilePath, 'utf8'),
  originalLogContents,
  'archive should not delete raw records if CSV verification fails'
);

writeFixtureLog(originalLogContents);
withPatchedWriteFileSync((originalWriteFileSync) => {
  fs.writeFileSync = (targetPath, contents, encoding) => {
    if (String(targetPath).endsWith('.manifest.json')) {
      throw new Error('simulated manifest write failure');
    }
    return originalWriteFileSync.call(fs, targetPath, contents, encoding);
  };

  assert.throws(
    () => archiveQuestionsStandardsSession({
      sessionId: 'session-a',
      logFilePath,
      archiveDir: path.join(tmpDir, 'manifest-write-fails')
    }),
    /simulated manifest write failure/,
    'archive should surface manifest write failures'
  );
});
assert.equal(
  fs.readFileSync(logFilePath, 'utf8'),
  originalLogContents,
  'archive should not delete raw records if manifest write fails'
);

console.log('Questions & Standards session archive checks passed');

function writeFixtureLog(contents) {
  fs.writeFileSync(logFilePath, contents, 'utf8');
}

function withPatchedWriteFileSync(callback) {
  const originalWriteFileSync = fs.writeFileSync;
  try {
    callback(originalWriteFileSync);
  } finally {
    fs.writeFileSync = originalWriteFileSync;
  }
}
