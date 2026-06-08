const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const {
  DEFAULT_INTERACTIONS_FILE,
  buildQuestionsStandardsCsvExport
} = require('./questionsStandardsCsvExport');
const { hashCsv } = require('./questionsStandardsExportManifest');

const DEFAULT_SESSION_ARCHIVE_DIR = path.join(
  __dirname,
  '..',
  '..',
  'exports',
  'questions-standards',
  'archives'
);

function archiveQuestionsStandardsSession({
  sessionId,
  classSessionId,
  date,
  startDate,
  endDate,
  logFilePath = DEFAULT_INTERACTIONS_FILE,
  archiveDir = DEFAULT_SESSION_ARCHIVE_DIR,
  archiveId = createArchiveId(),
  now = () => new Date()
} = {}) {
  const selectedSessionId = safeText(sessionId || classSessionId);
  if (!selectedSessionId) {
    throwArchiveError(400, 'sessionId or classSessionId is required.');
  }

  const filters = normalizeArchiveFilters({
    sessionId: selectedSessionId,
    date,
    startDate,
    endDate
  });
  const source = readSourceLog(logFilePath);
  const exportResult = buildQuestionsStandardsCsvExport(source.records, filters);

  if (exportResult.rowCount === 0) {
    return {
      ok: true,
      archived: false,
      status: 'no_records',
      sessionId: selectedSessionId,
      rowCount: 0,
      deletedRecordCount: 0,
      rawRecordsDeleted: false,
      message: 'No question history records matched this session.'
    };
  }

  validateExportedRecordIds(exportResult);

  const createdAt = toIsoString(now());
  const filename = buildArchiveCsvFilename({
    createdAt,
    archiveId,
    filters
  });
  const manifestFilename = filename.replace(/\.csv$/i, '.manifest.json');
  const csvPath = path.join(archiveDir, filename);
  const manifestPath = path.join(archiveDir, manifestFilename);

  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(csvPath, exportResult.csv, 'utf8');
  verifyWrittenCsv(csvPath, exportResult);

  const manifest = buildArchiveManifest({
    archiveId,
    createdAt,
    csv: exportResult.csv,
    filename,
    filters,
    exportedRecordIds: exportResult.exportedRecordIds,
    rowCount: exportResult.rowCount,
    sourceLogPath: logFilePath,
    rawRecordsDeleted: false,
    deletedRecordCount: 0
  });

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  verifyWrittenManifest(manifestPath, manifest, exportResult);

  const deleteResult = deleteExportedRawRecords(source, exportResult.exportedRecordIds);
  writeSourceLog(logFilePath, source, deleteResult.remainingRecords);

  const completedManifest = {
    ...manifest,
    rawRecordsDeleted: true,
    deletedRecordCount: deleteResult.deletedRecordCount
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(completedManifest, null, 2)}\n`, 'utf8');

  return {
    ok: true,
    archived: true,
    archiveId,
    exportId: archiveId,
    createdAt,
    sessionId: selectedSessionId,
    classSessionId: selectedSessionId,
    date: filters.date,
    startDate: filters.startDate,
    endDate: filters.endDate,
    csvFilename: filename,
    csvPath,
    manifestPath,
    exportedRecordIds: exportResult.exportedRecordIds,
    rowCount: exportResult.rowCount,
    checksum: completedManifest.checksum,
    rawRecordsDeleted: true,
    deletedRecordCount: deleteResult.deletedRecordCount
  };
}

function buildArchiveManifest({
  archiveId,
  createdAt,
  csv,
  filename,
  filters,
  exportedRecordIds,
  rowCount,
  sourceLogPath,
  rawRecordsDeleted,
  deletedRecordCount
} = {}) {
  const cleanArchiveId = safeText(archiveId);
  return {
    archiveId: cleanArchiveId,
    exportId: cleanArchiveId,
    createdAt: safeText(createdAt),
    sessionId: safeText(filters?.sessionId),
    classSessionId: safeText(filters?.sessionId),
    date: safeText(filters?.date),
    startDate: safeText(filters?.startDate),
    endDate: safeText(filters?.endDate),
    csvFilename: safeText(filename),
    sourceLogPath: sourceLogPath ? path.resolve(sourceLogPath) : '',
    exportedRecordIds: Array.isArray(exportedRecordIds)
      ? exportedRecordIds.map((id) => safeText(id)).filter(Boolean)
      : [],
    rowCount: Number.isInteger(rowCount) ? rowCount : 0,
    checksum: {
      algorithm: 'sha256',
      value: hashCsv(csv)
    },
    rawRecordsDeleted: rawRecordsDeleted === true,
    deletedRecordCount: Number.isInteger(deletedRecordCount) && deletedRecordCount > 0
      ? deletedRecordCount
      : 0
  };
}

function normalizeArchiveFilters({ sessionId, date, startDate, endDate } = {}) {
  const selectedDate = safeText(date);
  const selectedStartDate = safeText(startDate);
  const selectedEndDate = safeText(endDate);

  if (selectedDate && !isDateKey(selectedDate)) {
    throwArchiveError(400, 'date must use YYYY-MM-DD.');
  }
  if (selectedStartDate && !isDateKey(selectedStartDate)) {
    throwArchiveError(400, 'startDate must use YYYY-MM-DD.');
  }
  if (selectedEndDate && !isDateKey(selectedEndDate)) {
    throwArchiveError(400, 'endDate must use YYYY-MM-DD.');
  }
  if (selectedStartDate && selectedEndDate && selectedStartDate > selectedEndDate) {
    throwArchiveError(400, 'startDate must be on or before endDate.');
  }

  return {
    sessionId: safeText(sessionId),
    date: selectedDate,
    startDate: selectedDate ? '' : selectedStartDate,
    endDate: selectedDate ? '' : selectedEndDate
  };
}

function validateExportedRecordIds(exportResult) {
  const ids = Array.isArray(exportResult?.exportedRecordIds)
    ? exportResult.exportedRecordIds.map((id) => safeText(id))
    : [];

  if (ids.length !== exportResult.rowCount) {
    throwArchiveError(409, 'Every archived row must have a raw record id before deletion.');
  }
  if (ids.some((id) => !id)) {
    throwArchiveError(409, 'Archived row record ids are invalid.');
  }
  if (new Set(ids).size !== ids.length) {
    throwArchiveError(409, 'Archived row record ids must be unique.');
  }

  exportResult.exportedRecordIds = ids;
}

function verifyWrittenCsv(csvPath, exportResult) {
  const writtenCsv = fs.readFileSync(csvPath, 'utf8');
  if (writtenCsv !== exportResult.csv) {
    throwArchiveError(500, 'Archive CSV verification failed.');
  }

  const rows = parse(writtenCsv, {
    columns: true,
    relax_column_count: false
  });
  if (rows.length !== exportResult.rowCount) {
    throwArchiveError(500, 'Archive CSV row count verification failed.');
  }
}

function verifyWrittenManifest(manifestPath, expectedManifest, exportResult) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    throwArchiveError(500, 'Archive manifest verification failed.');
  }

  if (manifest.archiveId !== expectedManifest.archiveId) {
    throwArchiveError(500, 'Archive manifest id verification failed.');
  }
  if (manifest.rowCount !== exportResult.rowCount) {
    throwArchiveError(500, 'Archive manifest row count verification failed.');
  }
  if (manifest.checksum?.value !== hashCsv(exportResult.csv)) {
    throwArchiveError(500, 'Archive manifest checksum verification failed.');
  }
  if (!Array.isArray(manifest.exportedRecordIds) || manifest.exportedRecordIds.length !== exportResult.rowCount) {
    throwArchiveError(500, 'Archive manifest exported id verification failed.');
  }
}

function deleteExportedRawRecords(source, exportedRecordIds) {
  const exportedIds = new Set(exportedRecordIds);
  const remainingRecords = [];
  let deletedRecordCount = 0;

  for (const record of source.records) {
    if (record && typeof record === 'object' && exportedIds.has(safeText(record.id))) {
      deletedRecordCount += 1;
      continue;
    }

    remainingRecords.push(record);
  }

  if (deletedRecordCount !== exportedRecordIds.length) {
    throwArchiveError(409, 'Archive deletion did not match every exported record id.');
  }

  return {
    remainingRecords,
    deletedRecordCount
  };
}

function readSourceLog(logFilePath) {
  if (!fs.existsSync(logFilePath)) {
    throwArchiveError(404, 'Source interaction log not found.');
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  } catch {
    throwArchiveError(409, 'Source interaction log is invalid.');
  }

  if (Array.isArray(parsed)) {
    return {
      parsed,
      records: parsed,
      recordsKey: ''
    };
  }

  if (parsed && typeof parsed === 'object') {
    for (const key of ['interactions', 'records', 'entries', 'items']) {
      if (Array.isArray(parsed[key])) {
        return {
          parsed,
          records: parsed[key],
          recordsKey: key
        };
      }
    }
  }

  throwArchiveError(409, 'Source interaction log shape is invalid.');
}

function writeSourceLog(logFilePath, source, records) {
  const nextLog = source.recordsKey
    ? { ...source.parsed, [source.recordsKey]: records }
    : records;

  fs.writeFileSync(logFilePath, `${JSON.stringify(nextLog, null, 2)}\n`, 'utf8');
}

function buildArchiveCsvFilename({ createdAt, archiveId, filters } = {}) {
  const datePart = filters.date
    || [filters.startDate, filters.endDate].filter(Boolean).join('-to-')
    || 'all-dates';
  return [
    safeFilenamePart(createdAt),
    'questions-standards-session',
    safeFilenamePart(filters.sessionId),
    safeFilenamePart(datePart),
    safeFilenamePart(archiveId)
  ].filter(Boolean).join('-') + '.csv';
}

function createArchiveId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function safeFilenamePart(value) {
  return safeText(value)
    .replace(/[^a-z0-9_-]+/giu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function safeText(value) {
  return String(value ?? '').trim();
}

function throwArchiveError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  DEFAULT_SESSION_ARCHIVE_DIR,
  archiveQuestionsStandardsSession,
  buildArchiveManifest,
  normalizeArchiveFilters
};
