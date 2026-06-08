const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { hashCsv } = require('./questionsStandardsExportManifest');

const DEFAULT_QUESTIONS_STANDARDS_ARCHIVE_DIR = path.join(
  __dirname,
  '..',
  '..',
  'exports',
  'questions-standards',
  'archives'
);

function loadQuestionsStandardsRecords({
  logFilePath,
  archiveDir = DEFAULT_QUESTIONS_STANDARDS_ARCHIVE_DIR,
  readCurrentRecords,
  verifyChecksums = true
} = {}) {
  const currentRecords = typeof readCurrentRecords === 'function'
    ? readCurrentRecords(logFilePath)
    : [];
  return mergeQuestionStandardsRecords(
    Array.isArray(currentRecords) ? currentRecords : [],
    readArchivedQuestionsStandardsRecords({ archiveDir, verifyChecksums })
  );
}

function readArchivedQuestionsStandardsRecords({
  archiveDir = DEFAULT_QUESTIONS_STANDARDS_ARCHIVE_DIR,
  verifyChecksums = true
} = {}) {
  if (!archiveDir || !fs.existsSync(archiveDir)) return [];

  const archiveFiles = discoverArchiveCsvFiles(archiveDir);
  return archiveFiles.flatMap((archiveFile) => readArchivedCsvRecords(archiveFile, { verifyChecksums }));
}

function discoverArchiveCsvFiles(archiveDir) {
  let filenames;
  try {
    filenames = fs.readdirSync(archiveDir);
  } catch {
    return [];
  }

  const csvFiles = new Map();
  const manifestNames = filenames.filter((filename) => /\.manifest\.json$/i.test(filename)).sort();

  for (const manifestName of manifestNames) {
    const manifestPath = path.join(archiveDir, manifestName);
    const manifest = readJsonFile(manifestPath);
    const csvFilename = safeText(manifest?.csvFilename || manifest?.filename);
    if (!csvFilename || path.basename(csvFilename) !== csvFilename) continue;

    const csvPath = path.join(archiveDir, csvFilename);
    csvFiles.set(csvPath, {
      csvPath,
      manifestPath,
      manifest
    });
  }

  filenames
    .filter((filename) => /\.csv$/i.test(filename))
    .sort()
    .forEach((filename) => {
      const csvPath = path.join(archiveDir, filename);
      if (!csvFiles.has(csvPath)) {
        csvFiles.set(csvPath, {
          csvPath,
          manifestPath: '',
          manifest: null
        });
      }
    });

  return Array.from(csvFiles.values());
}

function readArchivedCsvRecords(archiveFile, { verifyChecksums = true } = {}) {
  let csv;
  try {
    csv = fs.readFileSync(archiveFile.csvPath, 'utf8');
  } catch {
    return [];
  }

  if (verifyChecksums && archiveFile.manifest?.checksum?.value) {
    const expected = safeText(archiveFile.manifest.checksum.value);
    if (expected && hashCsv(csv) !== expected) return [];
  }

  let rows;
  try {
    rows = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true
    });
  } catch {
    return [];
  }

  return rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => archivedCsvRowToInteraction(row, archiveFile))
    .filter(Boolean);
}

function archivedCsvRowToInteraction(row, archiveFile) {
  const id = safeText(row.id);
  const timestamp = safeText(row.timestamp) || safeText(row.date);
  const question = safeText(row.question);
  if (!id || !timestamp || !question) return null;

  const studentHubId = safeText(row.studentHubId);
  const record = {
    id,
    timestamp,
    date: safeText(row.date),
    sessionId: safeText(row.sessionId),
    source: safeText(row.source) || 'questions_standards_archive',
    routeType: safeText(row.routeType),
    confidence: safeText(row.confidence),
    standardsConfidence: normalizeArchivedConfidence(row.confidence),
    category: safeText(row['topic/category']),
    topic: safeText(row['topic/category']),
    studentQuestion: question,
    question,
    answerGiven: safeText(row.response),
    response: safeText(row.response),
    responsePreview: safeText(row.responsePreview) || previewText(row.response),
    primaryStandards: parseStandardsCell(row.primaryStandards),
    possibleStandards: parseStandardsCell(row.possibleStandards),
    standards: parseStandardsCell(row.standards),
    units: parseListCell(row.units),
    reportableForStandards: parseBooleanCell(row.reportableForStandards),
    isTutorStep: parseBooleanCell(row.isTutorStep),
    tutorOriginalQuestion: safeText(row.tutorOriginalQuestion),
    archived: true,
    archiveId: safeText(archiveFile.manifest?.archiveId || archiveFile.manifest?.exportId),
    archiveCreatedAt: safeText(archiveFile.manifest?.createdAt),
    archiveCsvFilename: path.basename(archiveFile.csvPath)
  };

  if (studentHubId) record.debug = { studentHubId };
  return record;
}

function mergeQuestionStandardsRecords(currentRecords, archivedRecords) {
  const seen = new Set();
  const merged = [];

  for (const record of [
    ...(Array.isArray(currentRecords) ? currentRecords : []),
    ...(Array.isArray(archivedRecords) ? archivedRecords : [])
  ]) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      if (!currentRecords.includes(record)) continue;
    }

    const key = dedupeKey(record);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(record);
  }

  return merged;
}

function dedupeKey(record) {
  const id = safeText(record?.id);
  if (id) return `id:${id}`;

  const timestamp = safeText(record?.timestamp || record?.createdAt || record?.updatedAt || record?.date);
  const question = normalizeForKey(record?.studentQuestion || record?.question || record?.message);
  const response = normalizeForKey(record?.answerGiven || record?.answer || record?.response || record?.responsePreview);
  const sessionId = normalizeForKey(record?.sessionId);
  const routeType = normalizeForKey(record?.routeType || record?.routerType || record?.type);

  if (!timestamp && !question && !response) return '';
  return ['fallback', timestamp, question, response, sessionId, routeType].join('|');
}

function parseStandardsCell(value) {
  return parseListCell(value)
    .map((item) => {
      const parts = item.split(/\s+\|\s+/u).map(safeText).filter(Boolean);
      if (!parts.length) return null;
      return {
        standardId: parts[0],
        label: parts[1] || '',
        unit: parts[2] || '',
        confidence: parts[3] || ''
      };
    })
    .filter((item) => item && item.standardId);
}

function parseListCell(value) {
  const text = safeText(value);
  if (!text) return [];
  return text.split(/\s*;\s*/u).map(safeText).filter(Boolean);
}

function parseBooleanCell(value) {
  const text = safeText(value).toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return undefined;
}

function normalizeArchivedConfidence(value) {
  const confidence = safeText(value).toLowerCase();
  return ['strong', 'medium', 'weak', 'none'].includes(confidence) ? confidence : '';
}

function previewText(value) {
  const text = safeText(value).replace(/\s+/g, ' ');
  if (!text) return '';
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function safeText(value) {
  return String(value ?? '').trim();
}

function normalizeForKey(value) {
  return safeText(value).replace(/\s+/g, ' ').toLowerCase();
}

module.exports = {
  DEFAULT_QUESTIONS_STANDARDS_ARCHIVE_DIR,
  archivedCsvRowToInteraction,
  loadQuestionsStandardsRecords,
  mergeQuestionStandardsRecords,
  parseStandardsCell,
  readArchivedQuestionsStandardsRecords
};
