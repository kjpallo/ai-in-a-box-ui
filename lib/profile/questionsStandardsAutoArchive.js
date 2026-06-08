const {
  archiveQuestionsStandardsSession
} = require('./questionsStandardsSessionArchive');

const DEFAULT_AUTO_ARCHIVE_INACTIVE_MINUTES = 30;
const DEFAULT_AUTO_ARCHIVE_INTERVAL_MS = 5 * 60 * 1000;

function runQuestionsStandardsAutoArchive({
  enabled = false,
  inactiveMinutes = DEFAULT_AUTO_ARCHIVE_INACTIVE_MINUTES,
  studentSessions,
  logFilePath,
  archiveDir,
  archiveSession = archiveQuestionsStandardsSession,
  now = () => new Date(),
  logger = console
} = {}) {
  const checkedAtDate = normalizeDate(now());
  const checkedAt = checkedAtDate.toISOString();
  const thresholdMs = normalizeInactiveMinutes(inactiveMinutes) * 60 * 1000;

  const result = {
    ok: true,
    enabled: enabled === true,
    checkedAt,
    inactiveMinutes: thresholdMs / 60 / 1000,
    archivedSessions: [],
    skippedSessions: [],
    errors: []
  };

  if (enabled !== true) {
    result.status = 'disabled';
    return result;
  }

  const sessions = Object.values(studentSessions || {});
  for (const session of sessions) {
    const decision = getAutoArchiveDecision(session, {
      now: checkedAtDate,
      thresholdMs
    });

    if (!decision.eligible) {
      result.skippedSessions.push(decision);
      continue;
    }

    const sessionId = decision.sessionId;
    try {
      const archiveResult = archiveSession({
        sessionId,
        logFilePath,
        archiveDir,
        now: () => checkedAtDate
      });

      if (!archiveResult.archived) {
        result.skippedSessions.push({
          ...decision,
          eligible: false,
          reason: archiveResult.status || 'no_records',
          message: archiveResult.message || 'No matching raw history records were archived.'
        });
        continue;
      }

      if (archiveResult.rawRecordsDeleted !== true) {
        result.errors.push({
          sessionId,
          reason: 'archive_incomplete',
          message: 'Archive completed without confirmed raw record deletion.'
        });
        continue;
      }

      if (studentSessions && studentSessions[sessionId]) {
        const deleteDecision = getAutoArchiveDecision(studentSessions[sessionId], {
          now: checkedAtDate,
          thresholdMs
        });
        if (deleteDecision.eligible) {
          delete studentSessions[sessionId];
        }
      }

      const archived = {
        sessionId,
        archiveId: archiveResult.archiveId || '',
        csvFilename: archiveResult.csvFilename || '',
        rowCount: Number(archiveResult.rowCount || 0),
        deletedRecordCount: Number(archiveResult.deletedRecordCount || 0),
        rawRecordsDeleted: archiveResult.rawRecordsDeleted === true,
        lastStudentHubActiveAt: decision.lastStudentHubActiveAt,
        inactiveMs: decision.inactiveMs
      };
      result.archivedSessions.push(archived);
      logInfo(logger, 'Questions & Standards auto-archived inactive session.', archived);
    } catch (error) {
      const safeError = {
        sessionId,
        reason: 'archive_failed',
        message: error instanceof Error ? error.message : String(error)
      };
      result.errors.push(safeError);
      logError(logger, 'Questions & Standards auto-archive failed.', safeError);
    }
  }

  if (result.errors.length) result.ok = false;
  result.status = result.archivedSessions.length ? 'archived' : 'checked';
  return result;
}

function getAutoArchiveDecision(session, {
  now = new Date(),
  thresholdMs = DEFAULT_AUTO_ARCHIVE_INACTIVE_MINUTES * 60 * 1000
} = {}) {
  const sessionId = safeText(session?.sessionId || session?.classSessionId);
  if (!sessionId) {
    return {
      eligible: false,
      sessionId: '',
      reason: 'missing_session_id'
    };
  }

  const hubs = Object.values(session?.anonymousHubs || {})
    .filter((hub) => hub && typeof hub === 'object');
  if (!hubs.length) {
    return {
      eligible: false,
      sessionId,
      reason: 'no_student_hubs'
    };
  }

  let latestHubDate = null;
  let activeHubCount = 0;
  for (const hub of hubs) {
    const hubDate = latestDate([
      hub.lastSeenAt,
      hub.lastMessageAt,
      latestMessageTime(hub.messages)
    ]);
    if (!hubDate) continue;
    if (!latestHubDate || hubDate > latestHubDate) latestHubDate = hubDate;
    if (now.getTime() - hubDate.getTime() <= thresholdMs) activeHubCount += 1;
  }

  if (!latestHubDate) {
    return {
      eligible: false,
      sessionId,
      reason: 'missing_student_hub_activity'
    };
  }

  const inactiveMs = now.getTime() - latestHubDate.getTime();
  if (inactiveMs <= thresholdMs || activeHubCount > 0) {
    return {
      eligible: false,
      sessionId,
      reason: 'active_within_threshold',
      activeHubCount,
      lastStudentHubActiveAt: latestHubDate.toISOString(),
      inactiveMs
    };
  }

  return {
    eligible: true,
    sessionId,
    reason: 'inactive_threshold_elapsed',
    activeHubCount: 0,
    lastStudentHubActiveAt: latestHubDate.toISOString(),
    inactiveMs
  };
}

function normalizeInactiveMinutes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return DEFAULT_AUTO_ARCHIVE_INACTIVE_MINUTES;
  return Math.min(Math.floor(number), 24 * 60);
}

function latestMessageTime(messages) {
  if (!Array.isArray(messages)) return '';
  const latest = latestDate(messages.flatMap((message) => [
    message?.createdAt,
    message?.timestamp,
    message?.time
  ]));
  return latest ? latest.toISOString() : '';
}

function latestDate(values) {
  let latest = null;
  for (const value of values) {
    const date = parseDate(value);
    if (!date) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseDate(value) {
  const text = safeText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function logInfo(logger, message, details) {
  if (logger && typeof logger.info === 'function') logger.info(message, details);
}

function logError(logger, message, details) {
  if (logger && typeof logger.error === 'function') logger.error(message, details);
}

function safeText(value) {
  return String(value ?? '').trim();
}

module.exports = {
  DEFAULT_AUTO_ARCHIVE_INACTIVE_MINUTES,
  DEFAULT_AUTO_ARCHIVE_INTERVAL_MS,
  getAutoArchiveDecision,
  normalizeInactiveMinutes,
  runQuestionsStandardsAutoArchive
};
