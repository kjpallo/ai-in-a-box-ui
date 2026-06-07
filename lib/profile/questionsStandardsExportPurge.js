const fs = require('fs');
const path = require('path');
const {
  DEFAULT_EXPORT_MANIFEST_DIR
} = require('./questionsStandardsExportManifest');
const {
  DEFAULT_INTERACTIONS_FILE
} = require('./questionsStandardsCsvExport');

function purgeQuestionsStandardsExport({
  exportId,
  logFilePath = DEFAULT_INTERACTIONS_FILE,
  manifestDir = DEFAULT_EXPORT_MANIFEST_DIR,
  now = () => new Date()
} = {}) {
  const cleanExportId = safeText(exportId);
  if (!cleanExportId) {
    throwPurgeError(400, 'exportId is required.');
  }

  const manifestResult = readManifestByExportId(cleanExportId, manifestDir);
  if (!manifestResult) {
    throwPurgeError(404, 'Export manifest not found.');
  }

  const { manifest, manifestPath } = manifestResult;
  validatePurgeReadyManifest(manifest);

  const source = readSourceLog(logFilePath);
  const exportedIds = new Set(manifest.exportedRecordIds);
  const remainingRecords = [];
  const deletedIds = new Set();

  for (const record of source.records) {
    if (record && typeof record === 'object' && exportedIds.has(String(record.id || ''))) {
      deletedIds.add(String(record.id));
      continue;
    }

    remainingRecords.push(record);
  }

  const remainingUnmatchedExportIds = manifest.exportedRecordIds
    .filter((id) => !deletedIds.has(id));
  const deletedRecordCount = source.records.length - remainingRecords.length;
  const nextManifest = {
    ...manifest,
    purgeCompleted: true,
    purgedAt: toIsoString(now()),
    deletedRecordCount,
    remainingUnmatchedExportIds,
    purgeStatus: remainingUnmatchedExportIds.length
      ? 'completed_with_unmatched_export_ids'
      : 'completed'
  };

  writeSourceLog(logFilePath, source, remainingRecords);
  fs.writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');

  return {
    ok: true,
    exportId: manifest.exportId,
    deletedRecordCount,
    remainingUnmatchedExportIds,
    purgeCompleted: true,
    purgeStatus: nextManifest.purgeStatus,
    purgedAt: nextManifest.purgedAt,
    manifestPath
  };
}

function readManifestByExportId(exportId, manifestDir = DEFAULT_EXPORT_MANIFEST_DIR) {
  const cleanExportId = safeText(exportId);
  if (!cleanExportId || !fs.existsSync(manifestDir)) return null;

  const stat = fs.statSync(manifestDir);
  if (!stat.isDirectory()) return null;

  for (const fileName of fs.readdirSync(manifestDir).sort()) {
    if (!fileName.endsWith('.json')) continue;

    const manifestPath = path.join(manifestDir, fileName);
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (safeText(manifest?.exportId) === cleanExportId) {
        return { manifest, manifestPath };
      }
    } catch {
      // Ignore unrelated or damaged files; absence of a matching manifest is handled by the caller.
    }
  }

  return null;
}

function validatePurgeReadyManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throwPurgeError(409, 'Export manifest shape is invalid.');
  }

  if (manifest.purgeCompleted === true) {
    throwPurgeError(409, 'Export has already been purged.');
  }

  if (!Array.isArray(manifest.exportedRecordIds) || manifest.exportedRecordIds.length === 0) {
    throwPurgeError(409, 'Export manifest has no exported record IDs.');
  }

  const exportedRecordIds = manifest.exportedRecordIds.map((id) => safeText(id));
  if (exportedRecordIds.some((id) => !id)) {
    throwPurgeError(409, 'Export manifest record IDs are invalid.');
  }

  if (new Set(exportedRecordIds).size !== exportedRecordIds.length) {
    throwPurgeError(409, 'Export manifest record IDs must be unique.');
  }

  const rowCount = Number(manifest.rowCount);
  if (
    !Number.isInteger(rowCount) ||
    rowCount <= 0 ||
    rowCount !== exportedRecordIds.length
  ) {
    throwPurgeError(409, 'Export manifest row count does not match exported record IDs.');
  }

  manifest.exportedRecordIds = exportedRecordIds;
}

function readSourceLog(logFilePath) {
  if (!fs.existsSync(logFilePath)) {
    throwPurgeError(404, 'Source interaction log not found.');
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  } catch {
    throwPurgeError(409, 'Source interaction log is invalid.');
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

  throwPurgeError(409, 'Source interaction log shape is invalid.');
}

function writeSourceLog(logFilePath, source, records) {
  const nextLog = source.recordsKey
    ? { ...source.parsed, [source.recordsKey]: records }
    : records;

  fs.writeFileSync(logFilePath, `${JSON.stringify(nextLog, null, 2)}\n`, 'utf8');
}

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function safeText(value) {
  return String(value ?? '').trim();
}

function throwPurgeError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  purgeQuestionsStandardsExport,
  readManifestByExportId,
  validatePurgeReadyManifest
};
