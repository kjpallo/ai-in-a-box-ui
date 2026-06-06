const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_EXPORT_MANIFEST_DIR = path.join(
  __dirname,
  '..',
  '..',
  'exports',
  'questions-standards',
  'manifests'
);

function writeQuestionsStandardsExportManifest({
  columns,
  csv,
  exportId = createExportId(),
  filename,
  filters = {},
  manifestDir = DEFAULT_EXPORT_MANIFEST_DIR,
  rowCount,
  sourceLogPath,
  exportedRecordIds
} = {}) {
  const createdAt = new Date().toISOString();
  const manifest = buildQuestionsStandardsExportManifest({
    columns,
    createdAt,
    csv,
    exportId,
    filename,
    filters,
    rowCount,
    sourceLogPath,
    exportedRecordIds
  });
  const manifestPath = path.join(manifestDir, `${safeFilenamePart(createdAt)}-${safeFilenamePart(exportId)}.json`);

  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    exportId,
    manifest,
    manifestPath
  };
}

function buildQuestionsStandardsExportManifest({
  columns,
  createdAt,
  csv,
  exportId,
  filename,
  filters = {},
  rowCount,
  sourceLogPath,
  exportedRecordIds
} = {}) {
  return {
    exportId: String(exportId || ''),
    createdAt: String(createdAt || ''),
    filename: String(filename || ''),
    filters: normalizeFilters(filters),
    sourceLogPath: sourceLogPath ? path.resolve(sourceLogPath) : '',
    exportedRecordIds: Array.isArray(exportedRecordIds)
      ? exportedRecordIds.map((id) => String(id)).filter(Boolean)
      : [],
    rowCount: Number.isFinite(rowCount) ? rowCount : 0,
    columns: Array.isArray(columns) ? columns.map((column) => String(column)) : [],
    checksum: {
      algorithm: 'sha256',
      value: hashCsv(csv)
    },
    purgeCompleted: false,
    deletedRecordCount: 0
  };
}

function normalizeFilters(filters = {}) {
  return {
    date: safeText(filters.date),
    startDate: safeText(filters.startDate),
    endDate: safeText(filters.endDate),
    sessionId: safeText(filters.sessionId)
  };
}

function hashCsv(csv = '') {
  return crypto.createHash('sha256').update(String(csv), 'utf8').digest('hex');
}

function createExportId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function safeFilenamePart(value) {
  return String(value || '')
    .replace(/[^a-z0-9_-]+/giu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function safeText(value) {
  return String(value ?? '').trim();
}

module.exports = {
  DEFAULT_EXPORT_MANIFEST_DIR,
  buildQuestionsStandardsExportManifest,
  hashCsv,
  writeQuestionsStandardsExportManifest
};
