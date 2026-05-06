const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', '..', 'logs');
const interactionLogPath = path.join(logsDir, 'student_interactions.json');

function logStudentInteraction(interaction = {}) {
  const timestamp = interaction.timestamp || interaction.createdAt || new Date().toISOString();
  const studentQuestion = interaction.studentQuestion || interaction.question || interaction.message || '';
  const answerGiven = interaction.answerGiven || interaction.answer || interaction.response || '';
  const routerType = interaction.routerType || interaction.routeType || interaction.type || '';
  const routeType = interaction.routeType || routerType;
  const matchedConcepts = Array.isArray(interaction.matchedConcepts) ? interaction.matchedConcepts : [];
  const primaryStandards = Array.isArray(interaction.primaryStandards) ? interaction.primaryStandards : [];
  const possibleStandards = Array.isArray(interaction.possibleStandards) ? interaction.possibleStandards : [];
  const standards = Array.isArray(interaction.standards) ? interaction.standards : [];
  const units = Array.isArray(interaction.units) ? interaction.units : [];
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
    formulaChosen: interaction.formulaChosen || '',
    category: interaction.category || interaction.topic || '',
    confidence: interaction.confidence || '',
    matchedConcepts,
    primaryStandards,
    possibleStandards,
    standards,
    units,
    conceptConfidence: interaction.conceptConfidence || 'none',
    standardsConfidence: interaction.standardsConfidence || 'none',
    possibleStandardsConfidence: interaction.possibleStandardsConfidence || 'none',
    courseProfileId: interaction.courseProfileId || '',
    standardsBankId: interaction.standardsBankId || '',
    matcherVersion: interaction.matcherVersion || '',
    standardsError: interaction.standardsError || '',
    source: interaction.source || 'chat',
    sessionId: interaction.sessionId || '',
    debug: interaction.debug || {}
  };

  if (!entry.studentQuestion) return null;

  const interactions = readInteractions();
  interactions.push(entry);
  writeInteractions(interactions);
  return entry;
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
