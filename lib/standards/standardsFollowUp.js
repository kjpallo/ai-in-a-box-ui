const fs = require('node:fs');
const path = require('node:path');
const {
  loadMissouriStandardsBank,
  matchQuestionToStandards
} = require('./standardsMatcher');

const DEFAULT_CONTEXT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'knowledge',
  'standards',
  'standards_student_context.json'
);

const NO_CONTEXT_MESSAGE = 'Ask a science question first, then I can connect that answer to a standard.';
const NO_STRONG_MATCH_MESSAGE = 'I do not have a strong standard match for that yet.';

function isStandardsFollowUp(message) {
  const text = normalizeText(message).toLowerCase();
  if (!text) return false;

  return [
    /\bstandards?\b/,
    /\bstandereds?\b/,
    /\bstanderds?\b/,
    /^what standard is (this|that)\??$/,
    /^what standard does (this|that) belong to\??$/,
    /^what standard does (this|that) match\??$/,
    /^what is this over\??$/,
    /^what is this about\??$/,
    /^what topic is this\??$/,
    /^what learning target\b/,
    /^what objective\b/,
    /^what skill is this\??$/,
    /^what are we learning\??$/,
    /\bi can statement\b/,
    /\blearning goal\b/,
    /^what is the i can statement\??$/,
    /^what learning target is (this|that)\??$/
  ].some((pattern) => pattern.test(text));
}

function answerStandardsFollowUp(message, contextQuestion, options = {}) {
  if (!isStandardsFollowUp(message)) return null;

  const previousQuestion = normalizeText(contextQuestion);
  if (!previousQuestion) {
    return {
      handled: true,
      response: NO_CONTEXT_MESSAGE,
      matched: false,
      reason: 'no_context'
    };
  }

  const matcher = options.matcher || matchQuestionToStandards;
  const match = matcher(previousQuestion, options.matcherOptions || {});
  const standards = Array.isArray(match?.standards) ? match.standards : [];

  if (match?.confidence !== 'strong' || standards.length !== 1) {
    return {
      handled: true,
      response: NO_STRONG_MATCH_MESSAGE,
      matched: false,
      reason: 'no_strong_match',
      match
    };
  }

  const standardId = standards[0].standardId;
  const standard = findStandardById(standardId, options);

  if (!standard) {
    return {
      handled: true,
      response: NO_STRONG_MATCH_MESSAGE,
      matched: false,
      reason: 'missing_standard',
      match
    };
  }

  const context = loadStudentContext(options.contextPath || DEFAULT_CONTEXT_PATH)[standardId] || {};
  const response = formatStandardsAnswer(standard, context);

  return {
    handled: true,
    response,
    matched: true,
    standardId,
    match
  };
}

function findStandardById(standardId, options = {}) {
  const bank = options.bank || loadMissouriStandardsBank(options.bankPath);
  const standards = Array.isArray(bank?.standards) ? bank.standards : [];
  return standards.find((standard) => standard.standardId === standardId) || null;
}

function loadStudentContext(contextPath = DEFAULT_CONTEXT_PATH) {
  try {
    if (!fs.existsSync(contextPath)) return {};
    const raw = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function formatStandardsAnswer(standard, context = {}) {
  const canStatement = cleanSentence(
    context.studentCanStatementOverride ||
    standard.studentCanStatement ||
    standard.studentFriendlyStandard ||
    `I can explain ${standard.conceptTitle || 'this science idea'}.`
  );
  const shortSummary = cleanSentence(
    context.shortSummary ||
    standard.teacherShortName ||
    standard.statement ||
    standard.conceptTitle ||
    'This standard connects to a science skill.'
  );
  const whyImportant = cleanSentence(
    context.whyImportant ||
    `This helps you connect a question to the science skill your class is practicing.`
  );

  return [
    'I can statement:',
    canStatement,
    '',
    'Standard code:',
    standard.standardId,
    '',
    'Short summary:',
    shortSummary,
    '',
    'Why this matters:',
    whyImportant,
    '',
    'Want the full standard? Ask: "Read the full standard."'
  ].join('\n');
}

function cleanSentence(value) {
  return normalizeText(value).replace(/\s+\[/, ' [');
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  NO_CONTEXT_MESSAGE,
  NO_STRONG_MATCH_MESSAGE,
  answerStandardsFollowUp,
  formatStandardsAnswer,
  isStandardsFollowUp
};
