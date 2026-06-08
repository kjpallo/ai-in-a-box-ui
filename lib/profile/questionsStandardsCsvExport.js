const fs = require('fs');
const path = require('path');
const {
  DEFAULT_QUESTIONS_STANDARDS_ARCHIVE_DIR,
  loadQuestionsStandardsRecords
} = require('./questionsStandardsArchiveRecords');

const DEFAULT_INTERACTIONS_FILE = path.join(__dirname, '..', '..', 'logs', 'student_interactions.json');

const CSV_COLUMNS = [
  'id',
  'timestamp',
  'date',
  'sessionId',
  'studentHubId',
  'source',
  'routeType',
  'confidence',
  'topic/category',
  'question',
  'response',
  'responsePreview',
  'primaryStandards',
  'possibleStandards',
  'standards',
  'units',
  'reportableForStandards',
  'isTutorStep',
  'tutorOriginalQuestion'
];

function exportQuestionsStandardsCsv(options = {}) {
  return buildQuestionsStandardsCsvExport(loadQuestionsStandardsRecords({
    logFilePath: options.logFilePath,
    archiveDir: options.archiveDir,
    readCurrentRecords: readStudentInteractions
  }), options);
}

function buildQuestionsStandardsCsvExport(records, options = {}) {
  const selectedDate = isDateKey(options.date) ? String(options.date) : '';
  const startDate = isDateKey(options.startDate) ? String(options.startDate) : '';
  const endDate = isDateKey(options.endDate) ? String(options.endDate) : '';
  const selectedSessionId = normalizeText(options.sessionId);
  const rows = (Array.isArray(records) ? records : [])
    .filter(isPlainObject)
    .filter((record) => matchesDateFilters(record, { selectedDate, startDate, endDate }))
    .filter((record) => !selectedSessionId || normalizeText(record.sessionId) === selectedSessionId)
    .map(normalizeInteractionRow);

  return {
    csv: rowsToCsv(rows),
    rowCount: rows.length,
    exportedRecordIds: rows.map((row) => row.id).filter(Boolean),
    rows,
    columns: [...CSV_COLUMNS]
  };
}

function matchesDateFilters(record, { selectedDate = '', startDate = '', endDate = '' } = {}) {
  const recordDate = dateKeyFromEntry(record);
  if (selectedDate && recordDate !== selectedDate) return false;
  if (startDate && (!recordDate || recordDate < startDate)) return false;
  if (endDate && (!recordDate || recordDate > endDate)) return false;
  return true;
}

function readStudentInteractions(logFilePath = DEFAULT_INTERACTIONS_FILE) {
  try {
    if (!fs.existsSync(logFilePath)) return [];

    const raw = fs.readFileSync(logFilePath, 'utf8').trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (isPlainObject(parsed)) {
      for (const key of ['interactions', 'records', 'entries', 'items']) {
        if (Array.isArray(parsed[key])) return parsed[key];
      }
    }
  } catch {
    return [];
  }

  return [];
}

function normalizeInteractionRow(record) {
  const timestamp = firstText(record.timestamp, record.createdAt, record.updatedAt, record.date);
  const response = firstText(record.answerGiven, record.answer, record.response);

  return {
    id: firstText(record.id),
    timestamp,
    date: dateKeyFromEntry(record),
    sessionId: firstText(record.sessionId),
    studentHubId: firstText(record.debug?.studentHubId),
    source: firstText(record.source),
    routeType: firstText(record.routeType, record.routerType, record.type),
    confidence: firstText(record.confidence),
    'topic/category': firstText(record.category),
    question: firstText(record.studentQuestion, record.question, record.message),
    response,
    responsePreview: firstText(record.responsePreview),
    primaryStandards: flattenCellValue(record.primaryStandards),
    possibleStandards: flattenCellValue(record.possibleStandards),
    standards: flattenCellValue(record.standards),
    units: flattenCellValue(record.units),
    reportableForStandards: booleanCell(record.reportableForStandards),
    isTutorStep: booleanCell(record.isTutorStep),
    tutorOriginalQuestion: firstText(record.tutorOriginalQuestion)
  };
}

function rowsToCsv(rows) {
  return [CSV_COLUMNS, ...rows.map((row) => CSV_COLUMNS.map((column) => row[column]))]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function flattenCellValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map(flattenArrayItem)
      .filter(Boolean)
      .join('; ');
  }
  if (isPlainObject(value)) return flattenObject(value);
  return normalizeText(value);
}

function flattenArrayItem(item) {
  if (item == null) return '';
  if (Array.isArray(item)) return flattenCellValue(item);
  if (isPlainObject(item)) return flattenObject(item);
  return normalizeText(item);
}

function flattenObject(value) {
  const preferred = [
    ['standardId', value.standardId],
    ['id', value.id],
    ['label', value.label],
    ['title', value.title],
    ['unit', value.unit],
    ['type', value.type],
    ['confidence', value.confidence],
    ['score', value.score]
  ]
    .map(([, item]) => normalizeText(item))
    .filter(Boolean);

  if (preferred.length) return preferred.join(' | ');

  return Object.entries(value)
    .filter(([, item]) => item != null && typeof item !== 'object')
    .map(([key, item]) => `${key}: ${normalizeText(item)}`)
    .filter((item) => !item.endsWith(': '))
    .join(' | ');
}

function booleanCell(value) {
  return typeof value === 'boolean' ? String(value) : '';
}

function firstText(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return '';
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function dateKeyFromEntry(entry) {
  return dateKeyFromValue(entry.timestamp || entry.createdAt || entry.updatedAt || entry.date);
}

function dateKeyFromValue(value) {
  const text = normalizeText(value);
  if (!text) return '';
  if (isDateKey(text)) return text;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  return localDateKey(date);
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

module.exports = {
  CSV_COLUMNS,
  DEFAULT_QUESTIONS_STANDARDS_ARCHIVE_DIR,
  DEFAULT_INTERACTIONS_FILE,
  buildQuestionsStandardsCsvExport,
  csvCell,
  exportQuestionsStandardsCsv,
  matchesDateFilters,
  normalizeInteractionRow,
  readStudentInteractions
};
