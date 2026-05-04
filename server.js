const express = require('express');
const path = require('path');

const { routeStudentQuestion } = require('./lib/router/questionRouter');
const {
  loadTeacherKnowledge,
  findRelevantKnowledge
} = require('./lib/knowledge/teacherKnowledge');
const { createOllamaClient } = require('./lib/ollama/client');
const { createTtsService } = require('./lib/tts/piper');
const {
  getProblems,
  logProblem,
  updateProblem
} = require('./lib/system/problemLogger');
const {
  getAvailableProfileDates,
  getDailyQuestionSummary
} = require('./lib/system/profileSummary');
const {
  getProfileStatus,
  createGoogleConnectUrl,
  completeGoogleConnect,
  sendDailySummaryEmail
} = require('./lib/system/gmailConnector');
const { buildSystemHealthReport } = require('./lib/system/healthReport');
const { logStudentInteraction } = require('./lib/system/studentInteractionLogger');
const { createQuestionAnswerService } = require('./lib/server/questionAnswerService');
const { ensureDir, loadLocalEnv } = require('./lib/server/utils');
const { registerAiImprovementRoutes } = require('./routes/aiImprovementRoutes');
const { registerHealthRoutes } = require('./routes/healthRoutes');
const { registerProfileRoutes } = require('./routes/profileRoutes');
const { registerQuestionRoutes } = require('./routes/questionRoutes');
const { registerStudentRoutes } = require('./routes/studentRoutes');
const { registerVoiceRoutes } = require('./routes/voiceRoutes');
const { registerWhisperRoutes } = require('./routes/whisperRoutes');

loadLocalEnv(path.join(__dirname, '.env'));

const app = express();
const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname, 'public');
const voicesDir = path.join(__dirname, 'voices');
const audioDir = path.join(__dirname, 'audio');
const knowledgeDir = path.join(__dirname, 'knowledge');
const teacherFactsFile = path.join(knowledgeDir, 'teacher_facts.json');
const MAX_KNOWLEDGE_ITEMS = Number(process.env.MAX_KNOWLEDGE_ITEMS || 6);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';
const studentSessions = Object.create(null);

const DEFAULT_SYSTEM_PROMPT = [
  'You are a classroom assistant helping in a 9th-grade science class.',
  'Answer at about a 9th-grade reading level.',
  'Be concise. Default to 2-3 sentences unless the teacher asks for more.',
  'If the answer is a process, a list of steps, or math work, use short bullet points.',
  'When a word has multiple meanings, give the school-science meaning first.',
  'For definition questions, start with the words: In 9th-grade science,',
  'For simple definition questions, give one clear definition first, then one short example only if it helps.',
  'For math or physics questions, show the formula, plug in the values, and give the final answer with units.',
  'Do not guess. If the question is unclear or missing information, ask one short clarifying question instead of assuming.',
  'Avoid extra background information unless asked.'
].join(' ');

const ollama = createOllamaClient({
  url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate',
  model: OLLAMA_MODEL,
  systemPrompt: process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
  temperature: Number(process.env.OLLAMA_TEMPERATURE || 0.2),
  numPredict: Number(process.env.OLLAMA_NUM_PREDICT || 110),
  topK: Number(process.env.OLLAMA_TOP_K || 20),
  topP: Number(process.env.OLLAMA_TOP_P || 0.85),
  repeatPenalty: Number(process.env.OLLAMA_REPEAT_PENALTY || 1.1)
});

const tts = createTtsService({
  voicesDir,
  audioDir,
  piperBackend: (process.env.PIPER_BACKEND || 'auto').toLowerCase(),
  piperHttpUrl: process.env.PIPER_HTTP_URL || '',
  piperAudioMode: (process.env.PIPER_AUDIO_MODE || 'file').toLowerCase(),
  piperSampleRate: Number(process.env.PIPER_SAMPLE_RATE || 0),
  audioTtlMs: Number(process.env.AUDIO_TTL_MS || 1000 * 60 * 30),
  piperLengthScale: process.env.PIPER_LENGTH_SCALE || '1.25',
  piperBin: process.env.PIPER_BIN || path.join(__dirname, '.venv', 'bin', 'piper')
});

ensureDir(knowledgeDir);

const questionAnswer = createQuestionAnswerService({
  teacherFactsFile,
  maxKnowledgeItems: MAX_KNOWLEDGE_ITEMS,
  loadTeacherKnowledge,
  findRelevantKnowledge,
  routeStudentQuestion,
  ollama,
  logProblem,
  logStudentInteraction,
  initialTeacherKnowledge: loadTeacherKnowledge(teacherFactsFile)
});

tts.pruneAudioDir();
setInterval(tts.pruneAudioDir, Math.max(60_000, Math.floor(Number(process.env.AUDIO_TTL_MS || 1000 * 60 * 30) / 2))).unref();

app.use(express.json());
app.use(express.static(publicDir));
app.use('/audio', express.static(audioDir));

// Voice and audio routes.
registerWhisperRoutes(app);
registerVoiceRoutes(app, { tts });

// Health and diagnostics routes.
registerHealthRoutes(app, {
  buildSystemHealthReport,
  getTeacherKnowledgeCount: questionAnswer.getTeacherKnowledgeCount,
  knowledgeDir,
  model: OLLAMA_MODEL,
  port: PORT,
  projectDir: __dirname,
  teacherFactsFile,
  tts,
  voicesDir
});

// Router, AI answer, and review routes.
registerQuestionRoutes(app, { ollama, questionAnswer, tts });
registerAiImprovementRoutes(app, { getProblems, logProblem, updateProblem });

// Profile and student-session routes.
registerProfileRoutes(app, {
  completeGoogleConnect,
  createGoogleConnectUrl,
  getAvailableProfileDates,
  getDailyQuestionSummary,
  getProfileStatus,
  port: PORT,
  sendDailySummaryEmail,
  studentSessions
});
registerStudentRoutes(app, {
  answerStudentMessage: questionAnswer.answerStudentMessage,
  logCompletedInteraction: questionAnswer.logCompletedInteraction,
  studentSessions
});

app.listen(PORT, () => {
  console.log(`AI in a Box running at http://localhost:${PORT}`);
  console.log(`TTS backend: ${tts.getEffectiveTtsBackend()}`);
  console.log(`Audio mode: ${tts.getEffectiveAudioMode()}`);
  if (tts.usingPiperHttp()) {
    console.log(`Piper HTTP URL: ${process.env.PIPER_HTTP_URL}`);
  }
});
