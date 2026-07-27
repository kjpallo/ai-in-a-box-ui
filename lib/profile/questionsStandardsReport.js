const {
  normalizeDateKey,
  reportingDateKeyFromEntry
} = require('../system/reportingDate');

const VALID_STATUS_FILTERS = new Set(['all', 'needs-review', 'missing-standard']);
const VALID_REPORT_MODES = new Set(['summary', 'detailed']);
const DEFAULT_GMAIL_URL_LIMIT = 7000;

function buildQuestionsStandardsReport(records, options = {}) {
  const status = normalizeStatusFilter(options.status || options.filter);
  const date = normalizeDateKey(options.date);
  const startDate = normalizeDateKey(options.startDate);
  const endDate = normalizeDateKey(options.endDate);
  const sessionId = safeText(options.sessionId);
  const allRecords = (Array.isArray(records) ? records : [])
    .map(normalizeQuestionsStandardsRecord)
    .filter(Boolean);
  const availableDates = Array.from(new Set(allRecords.map((record) => record.date).filter(Boolean)))
    .sort()
    .reverse();
  const dateScoped = allRecords
    .filter((record) => !date || record.date === date)
    .filter((record) => !startDate || (record.date && record.date >= startDate))
    .filter((record) => !endDate || (record.date && record.date <= endDate))
    .filter((record) => !sessionId || record.sessionKey === sessionId);
  assignAnonymousSessionLabels(dateScoped);
  const scopedRecords = dateScoped.filter((record) => matchesStatusFilter(record, status));
  const standardCounts = countStandards(scopedRecords);
  const topicCounts = countValues(scopedRecords.map((record) => record.topic).filter(Boolean));
  const archivedSessionKeys = distinctSessionKeys(scopedRecords.filter((record) => record.state === 'archived'));
  const liveSessionKeys = distinctSessionKeys(scopedRecords.filter((record) => record.state === 'live'));

  return {
    generatedAt: toIsoString(options.now || new Date()),
    scope: {
      date,
      startDate: date ? '' : startDate,
      endDate: date ? '' : endDate,
      status
    },
    availableDates,
    counts: {
      totalQuestions: scopedRecords.length,
      matchedStandards: standardCounts.size,
      needsReview: scopedRecords.filter((record) => record.needsReview).length,
      missingStandard: scopedRecords.filter((record) => record.missingStandard).length,
      liveQuestions: scopedRecords.filter((record) => record.state === 'live').length,
      archivedQuestions: scopedRecords.filter((record) => record.state === 'archived').length,
      liveSessions: liveSessionKeys.size,
      archivedSessions: archivedSessionKeys.size
    },
    standards: sortedCounts(standardCounts, 'standard'),
    topics: sortedCounts(topicCounts, 'topic'),
    records: scopedRecords.map(toPublicReportingRecord)
  };
}

function normalizeQuestionsStandardsRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.reportableForStandards === false) return null;

  const question = multilineText(value.studentQuestion || value.question || value.message);
  if (!question) return null;

  const timestamp = safeText(value.timestamp || value.createdAt || value.updatedAt || value.date);
  const matchedStandards = normalizeStandards(
    arrayWithItems(value.primaryStandards)
      ? value.primaryStandards
      : value.standards
  );
  const possibleStandards = normalizeStandards(value.possibleStandards);
  const routeType = safeText(value.routeType || value.routerType || value.type);
  const confidence = safeText(
    value.standardsConfidence ||
    value.possibleStandardsConfidence ||
    value.confidence
  ).toLowerCase();
  const standardsError = safeText(value.standardsError);
  const missingStandard = matchedStandards.length === 0;
  const needsReview = (
    missingStandard ||
    !confidence ||
    isNoMatch(routeType, value.topic || value.category) ||
    Boolean(standardsError) ||
    ['none', 'weak', 'low', 'unknown'].includes(confidence)
  );
  const archived = Boolean(
    value.archived === true ||
    value.completed === true ||
    safeText(value.archiveId || value.archiveCreatedAt || value.archiveCsvFilename)
  );
  const sessionKey = safeText(
    value.sessionKey ||
    value.sessionId ||
    value.classSessionId ||
    (value.archiveId ? `archive:${value.archiveId}` : '') ||
    (value.archiveCsvFilename ? `archive-file:${value.archiveCsvFilename}` : '')
  );
  const record = {
    timestamp,
    date: reportingDateKeyFromEntry(value),
    anonymousSession: '',
    sessionKey,
    className: safeText(value.className || value.sessionLabel || value.debug?.className),
    sessionLabel: safeText(value.sessionLabel || value.className || value.debug?.className),
    question,
    topic: safeText(value.topic || value.category || value.source) || 'other',
    matchedStandards,
    possibleStandards,
    matchedStandard: matchedStandards[0] || null,
    needsReview,
    missingStandard,
    reviewStatus: needsReview ? (missingStandard ? 'Missing standard' : 'Needs review') : 'Ready',
    state: archived ? 'archived' : 'live',
    archived,
    completed: archived,
    routeType,
    confidence,
    standardsConfidence: safeText(value.standardsConfidence || confidence),
    possibleStandardsConfidence: safeText(value.possibleStandardsConfidence),
    standardsBankId: safeText(value.standardsBankId),
    standardsError,
    archiveCreatedAt: safeText(value.archiveCreatedAt),
    archiveId: safeText(value.archiveId),
    archiveCsvFilename: safeText(value.archiveCsvFilename)
  };

  Object.defineProperty(record, '_recordId', {
    configurable: false,
    enumerable: false,
    value: safeText(value.id),
    writable: false
  });
  return record;
}

function toPublicReportingRecord(record) {
  const output = {
    timestamp: record.timestamp,
    date: record.date,
    anonymousSession: record.anonymousSession,
    sessionKey: record.sessionKey,
    className: record.className,
    sessionLabel: record.sessionLabel,
    question: record.question,
    topic: record.topic,
    matchedStandard: record.matchedStandard,
    primaryStandards: record.matchedStandards,
    standards: record.matchedStandards,
    possibleStandards: record.possibleStandards,
    needsReview: record.needsReview,
    missingStandard: record.missingStandard,
    reviewStatus: record.reviewStatus,
    state: record.state,
    archived: record.archived,
    completed: record.completed,
    routeType: record.routeType,
    confidence: record.confidence,
    standardsConfidence: record.standardsConfidence,
    possibleStandardsConfidence: record.possibleStandardsConfidence,
    standardsBankId: record.standardsBankId,
    standardsError: record.standardsError,
    archiveCreatedAt: record.archiveCreatedAt,
    archiveId: record.archiveId,
    archiveCsvFilename: record.archiveCsvFilename
  };
  Object.defineProperty(output, '_recordId', {
    configurable: false,
    enumerable: false,
    value: record._recordId,
    writable: false
  });
  return output;
}

function buildAnonymousQuestionsStandardsReport(report, options = {}) {
  const safeReport = report && typeof report === 'object'
    ? report
    : buildQuestionsStandardsReport([]);
  const mode = normalizeReportMode(options.mode);
  const summaryBody = buildSummaryBody(safeReport);
  const detailedBody = mode === 'detailed'
    ? buildDetailedBody(safeReport, summaryBody)
    : summaryBody;
  const subject = `Questions & Standards — ${mode === 'detailed' ? 'Detailed' : 'Summary'} anonymous report — ${scopeLabel(safeReport.scope)}`;
  const fullComposeUrl = gmailComposeUrl(subject, detailedBody);
  const maxUrlLength = positiveInteger(options.maxUrlLength, DEFAULT_GMAIL_URL_LIMIT);
  const requiresCsvAttachment = mode === 'detailed' && fullComposeUrl.length > maxUrlLength;
  const body = requiresCsvAttachment
    ? [
        summaryBody,
        '',
        'The detailed anonymous report is too large for a Gmail compose link.',
        'Export the current filtered CSV from Charlemagne and attach it to this message.'
      ].join('\n')
    : detailedBody;

  return {
    mode,
    subject,
    body,
    summaryBody,
    requiresCsvAttachment,
    composeUrl: gmailComposeUrl(subject, body)
  };
}

function buildSummaryBody(report) {
  const counts = report.counts || {};
  const lines = [
    'Questions & Standards — Summary anonymous report',
    `Scope: ${scopeLabel(report.scope)}`,
    `Filter: ${statusLabel(report.scope?.status)}`,
    `Total questions: ${number(counts.totalQuestions)}`,
    `Distinct matched standards: ${number(counts.matchedStandards)}`,
    `Needs review: ${number(counts.needsReview)}`,
    `Missing standard: ${number(counts.missingStandard)}`,
    `Live questions: ${number(counts.liveQuestions)}`,
    `Archived questions: ${number(counts.archivedQuestions)}`,
    `Live sessions: ${number(counts.liveSessions)}`,
    `Archived sessions: ${number(counts.archivedSessions)}`,
    '',
    'Topics:',
    ...aggregateLines(report.topics, 'topic'),
    '',
    'Standards:',
    ...aggregateLines(report.standards, 'standard')
  ];
  return lines.join('\n');
}

function buildDetailedBody(report, summaryBody) {
  const records = Array.isArray(report.records) ? report.records : [];
  if (!records.length) return `${summaryBody}\n\nNo question rows are included in this scope.`;

  return [
    summaryBody,
    '',
    'Anonymous question details:',
    ...records.flatMap((record, index) => {
      const standards = normalizeStandards(record.primaryStandards || record.standards)
        .map((standard) => standard.standardId)
        .filter(Boolean)
        .join('; ') || 'No standard matched';
      return [
        '',
        `Question ${index + 1}`,
        `Session: ${anonymizeQuestionText(record.anonymousSession) || 'Session'}`,
        `Timestamp: ${anonymizeQuestionText(record.timestamp) || 'Not available'}`,
        `Question: ${anonymizeQuestionText(record.question) || 'No question text'}`,
        `Topic: ${anonymizeQuestionText(record.topic) || 'Other'}`,
        `Standard: ${anonymizeQuestionText(standards)}`,
        `Review status: ${anonymizeQuestionText(record.reviewStatus) || 'Needs review'}`,
        `State: ${anonymizeQuestionText(record.state) || 'live'}`
      ];
    })
  ].join('\n');
}

function gmailComposeUrl(subject, body) {
  return `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function assignAnonymousSessionLabels(records) {
  const labels = new Map();
  let nextLabel = 1;
  for (const record of records) {
    const key = record.sessionKey || `ungrouped:${record.date || ''}:${record.state}`;
    if (!labels.has(key)) {
      labels.set(key, `Session ${nextLabel}`);
      nextLabel += 1;
    }
    record.anonymousSession = labels.get(key);
  }
}

function countStandards(records) {
  const counts = new Map();
  for (const record of records) {
    const seen = new Set();
    for (const standard of record.matchedStandards) {
      if (!standard.standardId || seen.has(standard.standardId)) continue;
      seen.add(standard.standardId);
      const existing = counts.get(standard.standardId) || {
        label: standard.label,
        count: 0
      };
      existing.count += 1;
      existing.label = existing.label || standard.label;
      counts.set(standard.standardId, existing);
    }
  }
  return counts;
}

function countValues(values) {
  const counts = new Map();
  for (const value of values) {
    const label = safeText(value);
    if (!label) continue;
    counts.set(label, { label, count: (counts.get(label)?.count || 0) + 1 });
  }
  return counts;
}

function sortedCounts(counts, labelKey) {
  return Array.from(counts.entries())
    .map(([key, value]) => ({
      [labelKey]: key,
      label: value.label || key,
      count: number(value.count)
    }))
    .sort((a, b) => b.count - a.count || String(a[labelKey]).localeCompare(String(b[labelKey])));
}

function distinctSessionKeys(records) {
  return new Set(records.map((record) => record.sessionKey || record.anonymousSession).filter(Boolean));
}

function matchesStatusFilter(record, status) {
  if (status === 'needs-review') return record.needsReview;
  if (status === 'missing-standard') return record.missingStandard;
  return true;
}

function normalizeStatusFilter(value) {
  const status = safeText(value).toLowerCase();
  return VALID_STATUS_FILTERS.has(status) ? status : 'all';
}

function normalizeReportMode(value) {
  const mode = safeText(value).toLowerCase();
  return VALID_REPORT_MODES.has(mode) ? mode : 'summary';
}

function normalizeStandards(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((standard) => {
      if (typeof standard === 'string') return { standardId: safeText(standard), label: '', unit: '' };
      if (!standard || typeof standard !== 'object' || Array.isArray(standard)) return null;
      return {
        standardId: safeText(standard.standardId || standard.id),
        label: safeText(standard.label || standard.title),
        unit: safeText(standard.unit)
      };
    })
    .filter((standard) => standard?.standardId)
    .filter((standard) => {
      if (seen.has(standard.standardId)) return false;
      seen.add(standard.standardId);
      return true;
    });
}

function aggregateLines(rows, key) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return ['- None'];
  return safeRows.map((row) => `- ${anonymizeQuestionText(row[key] || row.label) || 'Other'}: ${number(row.count)}`);
}

function scopeLabel(scope = {}) {
  if (scope.date) return scope.date;
  if (scope.startDate || scope.endDate) return `${scope.startDate || 'start'} to ${scope.endDate || 'end'}`;
  return 'All dates';
}

function statusLabel(value) {
  if (value === 'needs-review') return 'Needs review';
  if (value === 'missing-standard') return 'Missing standard';
  return 'All questions';
}

function isNoMatch(routeType, topic) {
  const route = normalizedKey(routeType);
  const topicKey = normalizedKey(topic);
  return route === 'no match' || topicKey === 'no trusted answer';
}

function arrayWithItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizedKey(value) {
  return safeText(value).toLowerCase().replace(/[_-]+/g, ' ');
}

function anonymizeQuestionText(value) {
  return multilineText(value)
    .replace(
      /\b(student[\s_-]*id|join[\s_-]*code|session[\s_-]*(?:id|token)|device[\s_-]*id|hub[\s_-]*id|email|ip[\s_-]*address)\s*[:=]\s*(?:"[^"\r\n]+"|'[^'\r\n]+'|[^\s,;!?]+)/giu,
      redactStructuredField
    )
    .replace(
      /\b(student[\s_-]*id|join[\s_-]*code|session[\s_-]*(?:id|token)|device[\s_-]*id|hub[\s_-]*id)\s+(?:is\s+)?[A-Z0-9][A-Z0-9._@/+~-]{2,}/giu,
      redactStructuredField
    )
    .replace(
      /\b(email)\s+(?:is\s+)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
      redactStructuredField
    )
    .replace(
      /\b(ip[\s_-]*address)\s+(?:is\s+)?(?:\d{1,3}\.){3}\d{1,3}\b/giu,
      redactStructuredField
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '[redacted email]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/gu, '[redacted IP]')
    .replace(/\b(my name is|i am|i'm)\s+[A-Z][\p{L}'-]*(?:\s+[A-Z][\p{L}'-]*)?/giu, '$1 [redacted name]')
    .replace(/\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/gu, '[redacted phone]');
}

function redactStructuredField(match, label) {
  const punctuation = match.match(/[.,;!?]+$/u)?.[0] || '';
  return `${label} [redacted]${punctuation}`;
}

function multilineText(value) {
  return String(value ?? '').trim();
}

function safeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function number(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function positiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

module.exports = {
  DEFAULT_GMAIL_URL_LIMIT,
  VALID_REPORT_MODES,
  VALID_STATUS_FILTERS,
  anonymizeQuestionText,
  buildAnonymousQuestionsStandardsReport,
  buildQuestionsStandardsReport,
  gmailComposeUrl,
  normalizeQuestionsStandardsRecord,
  normalizeReportMode,
  normalizeStatusFilter
};
