const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', '..', 'logs');
const studentInteractionsPath = path.join(logsDir, 'student_interactions.json');
const problemQuestionsPath = path.join(logsDir, 'problem_questions.json');

function getProfileStatus() {
  return {
    googleConnected: false,
    gmailConnected: false,
    teacher: null,
    message: 'Google sign-in is not connected yet.'
  };
}

function getAvailableProfileDates(now = new Date()) {
  const entries = loadProfileEntries();
  const dates = Array.from(new Set(entries.map((entry) => entry.date).filter(Boolean)))
    .sort()
    .reverse();

  return {
    dates,
    defaultDate: dates[0] || localDateKey(now)
  };
}

function getDailyQuestionSummary(date, now = new Date()) {
  const selectedDate = isDateKey(date) ? date : localDateKey(now);
  const questions = loadProfileEntries()
    .filter((entry) => entry.date === selectedDate)
    .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')))
    .map((entry) => ({
      timestamp: entry.timestamp,
      time: entry.time,
      topic: entry.topic,
      question: entry.question,
      responsePreview: entry.responsePreview,
      routeType: entry.routeType,
      confidence: entry.confidence,
      source: entry.source,
      sessionId: entry.sessionId
    }));

  return {
    date: selectedDate,
    totalQuestions: questions.length,
    topics: summarizeTopics(questions),
    questions
  };
}

function loadProfileEntries() {
  const interactions = readJsonItems(studentInteractionsPath)
    .map((entry) => normalizeEntry(entry, 'student_interactions'))
    .filter(Boolean);

  const problems = readJsonItems(problemQuestionsPath)
    .map((entry) => normalizeEntry(entry, 'problem_questions'))
    .filter(Boolean);

  return dedupeEntries([...interactions, ...problems]);
}

function readJsonItems(filePath) {
  if (!fs.existsSync(filePath)) return [];

  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;

    if (parsed && typeof parsed === 'object') {
      for (const key of ['interactions', 'questions', 'problems', 'entries', 'items', 'records']) {
        if (Array.isArray(parsed[key])) return parsed[key];
      }
    }
  } catch {
    return [];
  }

  return [];
}

function normalizeEntry(entry, source) {
  if (!entry || typeof entry !== 'object') return null;

  const timestamp = firstText(
    entry.timestamp,
    entry.createdAt,
    entry.lastSeenAt,
    entry.updatedAt,
    entry.time,
    entry.date
  );
  const date = dateKeyFromValue(timestamp);
  const question = firstText(
    entry.studentQuestion,
    entry.question,
    entry.message,
    entry.prompt,
    entry.input,
    entry.text
  );

  if (!date || !question) return null;

  const answer = firstText(
    entry.answerGiven,
    entry.answer,
    entry.response,
    entry.responseText,
    entry.fullText,
    entry.output
  );
  const routeType = firstText(
    entry.routerType,
    entry.routeType,
    entry.type,
    entry.router?.type,
    entry.route?.type,
    entry.debug?.route?.type,
    entry.debug?.router?.type
  );
  const formulaChosen = firstText(
    entry.formulaChosen,
    entry.formula,
    entry.router?.formulaChosen,
    entry.route?.formulaChosen,
    entry.debug?.route?.formulaChosen,
    entry.debug?.router?.formulaChosen
  );
  const confidence = firstText(
    entry.confidence,
    entry.router?.confidence,
    entry.route?.confidence,
    entry.debug?.route?.confidence,
    entry.debug?.router?.confidence
  );

  return {
    logName: source,
    source: firstText(entry.source) || source,
    sessionId: firstText(entry.sessionId, entry.debug?.sessionId),
    id: firstText(entry.id),
    date,
    timestamp: isoTimestamp(timestamp),
    time: displayTime(timestamp),
    topic: deriveTopic({
      category: entry.category,
      reason: entry.reason,
      formulaChosen,
      routerType: entry.routerType,
      routeType,
      type: entry.type,
      confidence
    }),
    question,
    responsePreview: previewText(answer),
    routeType: routeType || 'unknown',
    confidence: confidence || 'unknown',
    dedupeKey: [
      source,
      firstText(entry.id, timestamp),
      date,
      normalizeForKey(question),
      normalizeForKey(answer),
      normalizeForKey(routeType),
      normalizeForKey(firstText(entry.sessionId, entry.debug?.sessionId))
    ].join('|')
  };
}

function deriveTopic({ category, reason, formulaChosen, routerType, routeType, type, confidence }) {
  const categoryValue = normalizeForKey(category);
  const reasonValue = normalizeForKey(reason);
  const confidenceValue = normalizeForKey(confidence);

  if (categoryValue.includes('server_error') || reasonValue.includes('server_error')) {
    return 'server error';
  }

  if (categoryValue.includes('rejected') || reasonValue === 'rejected') {
    return 'rejected';
  }

  if (
    categoryValue.includes('no_trusted_answer')
    || reasonValue.includes('no_trusted_answer')
    || reasonValue === 'no_route'
  ) {
    return 'no trusted answer';
  }

  if (reasonValue.includes('low_confidence') || confidenceValue === 'weak' || confidenceValue === 'low') {
    return 'low confidence';
  }

  return friendlyLabel(category)
    || friendlyLabel(formulaChosen)
    || friendlyLabel(routerType)
    || friendlyLabel(routeType)
    || friendlyLabel(type)
    || 'other';
}

function summarizeTopics(questions) {
  const counts = new Map();

  for (const question of questions) {
    const topic = question.topic || 'other';
    counts.set(topic, (counts.get(topic) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([topic, count]) => ({
      topic,
      count,
      percent: questions.length ? roundPercent((count / questions.length) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

function dedupeEntries(entries) {
  const seen = new Set();
  const unique = [];
  const interactions = [];

  for (const entry of entries) {
    if (entry.logName === 'problem_questions' && hasMatchingInteraction(entry, interactions)) {
      continue;
    }

    const key = entry.dedupeKey || `${entry.source}:${entry.id}`;
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(entry);

    if (entry.logName === 'student_interactions') {
      interactions.push(entry);
    }
  }

  return unique;
}

function hasMatchingInteraction(problemEntry, interactions) {
  return interactions.some((entry) => (
    entry.date === problemEntry.date
    && normalizeForKey(entry.question) === normalizeForKey(problemEntry.question)
    && normalizeForKey(entry.responsePreview) === normalizeForKey(problemEntry.responsePreview)
    && normalizeForKey(entry.routeType) === normalizeForKey(problemEntry.routeType)
    && timestampsAreClose(entry.timestamp, problemEntry.timestamp)
  ));
}

function timestampsAreClose(left, right) {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return left === right;
  }

  return Math.abs(leftTime - rightTime) <= 5000;
}

function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;

    const text = String(value).trim();
    if (text) return text;
  }

  return '';
}

function friendlyLabel(value) {
  const text = firstText(value);
  if (!text) return '';

  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function previewText(value) {
  const text = firstText(value).replace(/\s+/g, ' ');
  if (!text) return '';

  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function normalizeForKey(value) {
  return firstText(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function dateKeyFromValue(value) {
  const text = firstText(value);
  if (!text) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  return localDateKey(date);
}

function isoTimestamp(value) {
  const text = firstText(value);
  if (!text) return '';

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

function displayTime(value) {
  const text = firstText(value);
  if (!text) return '';

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
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

function roundPercent(value) {
  return Math.round(value * 10) / 10;
}

module.exports = {
  getProfileStatus,
  getAvailableProfileDates,
  getDailyQuestionSummary
};
