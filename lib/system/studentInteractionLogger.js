const fs = require('fs');
const path = require('path');
const { buildStandardsLogMetadata } = require('../standards/standardsLogMetadata');

const logsDir = path.join(__dirname, '..', '..', 'logs');
const interactionLogPath = path.join(logsDir, 'student_interactions.json');

function logStudentInteraction(interaction = {}) {
  const timestamp = interaction.timestamp || interaction.createdAt || new Date().toISOString();
  const studentQuestion = interaction.studentQuestion || interaction.question || interaction.message || '';
  const answerGiven = interaction.answerGiven || interaction.answer || interaction.response || '';
  const routerType = interaction.routerType || interaction.routeType || interaction.type || '';
  const routeType = interaction.routeType || routerType;
  const standardsMetadata = hasStandardsMetadata(interaction) || !studentQuestion
    ? {}
    : buildStandardsLogMetadata(studentQuestion);
  const enrichedInteraction = {
    ...standardsMetadata,
    ...interaction
  };
  const matchedConcepts = Array.isArray(enrichedInteraction.matchedConcepts) ? enrichedInteraction.matchedConcepts : [];
  const primaryStandards = Array.isArray(enrichedInteraction.primaryStandards) ? enrichedInteraction.primaryStandards : [];
  const possibleStandards = Array.isArray(enrichedInteraction.possibleStandards) ? enrichedInteraction.possibleStandards : [];
  const standards = Array.isArray(enrichedInteraction.standards) ? enrichedInteraction.standards : [];
  const units = Array.isArray(enrichedInteraction.units) ? enrichedInteraction.units : [];
  const entry = {
    id: createInteractionId(),
    timestamp,
    studentQuestion,
    question: studentQuestion,
    message: studentQuestion,
    answerGiven,
    answer: answerGiven,
    response: answerGiven,
    responsePreview: previewText(answerGiven),
    routerType,
    routeType,
    type: interaction.type || routeType,
    formulaChosen: enrichedInteraction.formulaChosen || '',
    category: enrichedInteraction.category || enrichedInteraction.topic || '',
    confidence: enrichedInteraction.confidence || '',
    matchedConcepts,
    primaryStandards,
    possibleStandards,
    standards,
    units,
    conceptConfidence: enrichedInteraction.conceptConfidence || 'none',
    standardsConfidence: enrichedInteraction.standardsConfidence || 'none',
    possibleStandardsConfidence: enrichedInteraction.possibleStandardsConfidence || 'none',
    courseProfileId: enrichedInteraction.courseProfileId || '',
    standardsBankId: enrichedInteraction.standardsBankId || '',
    matcherVersion: enrichedInteraction.matcherVersion || '',
    standardsError: enrichedInteraction.standardsError || '',
    isTutorStep: Boolean(enrichedInteraction.isTutorStep),
    reportableForStandards: enrichedInteraction.reportableForStandards !== false,
    tutorOriginalQuestion: enrichedInteraction.tutorOriginalQuestion || '',
    source: enrichedInteraction.source || 'chat',
    sessionId: enrichedInteraction.sessionId || '',
    debug: enrichedInteraction.debug || {}
  };

  if (!entry.studentQuestion) return null;

  const interactions = readInteractions();
  interactions.push(entry);
  writeInteractions(interactions);
  return entry;
}

function hasStandardsMetadata(interaction) {
  if (!interaction || typeof interaction !== 'object') return false;

  return [
    'matchedConcepts',
    'primaryStandards',
    'possibleStandards',
    'standards',
    'units',
    'conceptConfidence',
    'standardsConfidence',
    'possibleStandardsConfidence',
    'courseProfileId',
    'standardsBankId',
    'matcherVersion',
    'standardsError'
  ].some((key) => Object.prototype.hasOwnProperty.call(interaction, key));
}

function readInteractions() {
  if (!fs.existsSync(interactionLogPath)) return [];

  try {
    const raw = fs.readFileSync(interactionLogPath, 'utf8').trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeInteractions(interactions) {
  ensureLogsDir();
  const tempPath = `${interactionLogPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(interactions, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, interactionLogPath);
}

function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

function createInteractionId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const random = Math.random().toString(36).slice(2, 8);
  return `interaction_${timestamp}_${random}`;
}

function previewText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

module.exports = {
  logStudentInteraction
};
