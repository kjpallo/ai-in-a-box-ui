const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

loadLocalEnv(path.join(__dirname, '.env'));

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
const { registerWhisperRoutes } = require('./routes/whisperRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname, 'public');
const voicesDir = path.join(__dirname, 'voices');
const audioDir = path.join(__dirname, 'audio');
const knowledgeDir = path.join(__dirname, 'knowledge');
const teacherFactsFile = path.join(knowledgeDir, 'teacher_facts.json');
const MAX_KNOWLEDGE_ITEMS = Number(process.env.MAX_KNOWLEDGE_ITEMS || 6);
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
  model: process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
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
let TEACHER_KNOWLEDGE = loadTeacherKnowledge(teacherFactsFile);
tts.pruneAudioDir();
setInterval(tts.pruneAudioDir, Math.max(60_000, Math.floor(Number(process.env.AUDIO_TTL_MS || 1000 * 60 * 30) / 2))).unref();

app.use(express.json());
app.use(express.static(publicDir));
app.use('/audio', express.static(audioDir));
registerWhisperRoutes(app);

app.get('/api/health', (_req, res) => {
  const voices = tts.listVoices();
  res.json({
    ok: true,
    model: process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
    conciseMode: true,
    ttsBackend: tts.getEffectiveTtsBackend(),
    piperHttpConfigured: tts.usingPiperHttp(),
    ttsAudioMode: tts.getEffectiveAudioMode(),
    canStreamAudio: tts.canStreamAudio(),
    canSelectVoice: !tts.usingPiperHttp(),
    hasVoice: tts.usingPiperHttp() || voices.length > 0,
    knowledgeItems: TEACHER_KNOWLEDGE.length,
    voices
  });
});

app.get('/api/system-health', async (_req, res) => {
  try {
    const report = await buildSystemHealthReport({
      projectDir: __dirname,
      port: PORT,
      tts,
      voicesDir,
      knowledgeDir,
      teacherFactsFile,
      getTeacherKnowledgeCount: () => TEACHER_KNOWLEDGE.length
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({
      ok: false,
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('/api/router-test', (req, res) => {
  TEACHER_KNOWLEDGE = loadTeacherKnowledge(teacherFactsFile);
  const message = String(req.query.q || '').trim();
  const matchedKnowledge = getRelevantKnowledge(message);
  const questionRoute = routeStudentQuestion(message, matchedKnowledge);

  res.json({
    question: message,
    router: questionRoute.public,
    answerPreview: questionRoute.directAnswer,
    matchedKnowledge: matchedKnowledge.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      score: item.score,
      exactTermMatch: item.exactTermMatch,
      exactTitleMatch: item.exactTitleMatch,
      importantKeywordMatches: item.importantKeywordMatches,
      strongEnoughMatch: item.strongEnoughMatch
    }))
  });
});

app.get('/api/voices', (_req, res) => {
  res.json({
    backend: tts.getEffectiveTtsBackend(),
    ttsAudioMode: tts.getEffectiveAudioMode(),
    canStreamAudio: tts.canStreamAudio(),
    canSelectVoice: !tts.usingPiperHttp(),
    voices: tts.listVoices()
  });
});

app.get('/api/ai-improvement/problems', (_req, res) => {
  const problems = getProblems()
    .slice()
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  res.json({ problems });
});

app.get('/api/profile/status', (_req, res) => {
  res.json(getProfileStatus());
});

app.post('/api/profile/create-student-session', (req, res) => {
  const sessionId = crypto.randomUUID();
  const className = String(req.body?.className || '').trim();
  const studentUrl = buildStudentUrl(req, sessionId);

  studentSessions[sessionId] = {
    sessionId,
    className,
    createdAt: new Date().toISOString(),
    studentUrl,
    messages: []
  };

  res.status(201).json({
    sessionId,
    className,
    createdAt: studentSessions[sessionId].createdAt,
    studentUrl
  });
});

app.get('/api/profile/student-sessions', (_req, res) => {
  const sessions = Object.values(studentSessions)
    .map((session) => ({
      className: session.className || '',
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      studentUrl: session.studentUrl || `/student.html?sessionId=${encodeURIComponent(session.sessionId)}`
    }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  res.json({ sessions });
});

app.get('/api/profile/google/start', (_req, res) => {
  try {
    res.redirect(createGoogleConnectUrl());
  } catch (error) {
    sendProfileError(res, error);
  }
});

app.get('/api/profile/google/callback', async (req, res) => {
  try {
    await completeGoogleConnect(req.query);
    res.send(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>Gmail connected</title>
          <meta http-equiv="refresh" content="1; url=/">
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #03090a;
              color: #effff8;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            main {
              max-width: 520px;
              padding: 2rem;
              border: 1px solid rgba(103, 255, 208, 0.25);
              border-radius: 18px;
              background: rgba(0, 18, 17, 0.82);
            }
            a { color: #67ffd0; }
          </style>
        </head>
        <body>
          <main>
            <h1>Gmail connected</h1>
            <p>You can return to Charlemagne and send daily summary emails.</p>
            <p><a href="/">Back to Charlemagne</a></p>
          </main>
        </body>
      </html>
    `);
  } catch (error) {
    const message = escapeHtml(error instanceof Error ? error.message : String(error));
    res.status(error.statusCode || 500).send(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>Gmail connection failed</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #03090a;
              color: #effff8;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            main {
              max-width: 620px;
              padding: 2rem;
              border: 1px solid rgba(255, 124, 124, 0.3);
              border-radius: 18px;
              background: rgba(40, 0, 8, 0.72);
            }
            a { color: #67ffd0; }
          </style>
        </head>
        <body>
          <main>
            <h1>Gmail connection failed</h1>
            <p>${message}</p>
            <p><a href="/">Back to Charlemagne</a></p>
          </main>
        </body>
      </html>
    `);
  }
});

app.get('/api/profile/dates', (_req, res) => {
  res.json(getAvailableProfileDates());
});

app.get('/api/profile/question-summary', (req, res) => {
  res.json(getDailyQuestionSummary(req.query.date));
});

app.post('/api/profile/send-daily-summary', async (req, res) => {
  sendProfileDailySummary(req, res);
});

app.post('/api/profile/send-email', async (req, res) => {
  sendProfileDailySummary(req, res);
});

async function sendProfileDailySummary(req, res) {
  try {
    const summary = getDailyQuestionSummary(req.body?.date);
    const result = await sendDailySummaryEmail(summary);
    res.json(result);
  } catch (error) {
    sendProfileError(res, error);
  }
}

app.post('/api/ai-improvement/problems', (req, res) => {
  const problem = logProblem({
    status: req.body?.status || 'open',
    category: req.body?.category || 'needs_review',
    studentQuestion: req.body?.studentQuestion || '',
    answerGiven: req.body?.answerGiven || '',
    routerType: req.body?.routerType || '',
    formulaChosen: req.body?.formulaChosen || '',
    confidence: req.body?.confidence || '',
    expectedBehavior: req.body?.expectedBehavior || '',
    teacherNotes: req.body?.teacherNotes || '',
    source: req.body?.source || '',
    reason: req.body?.reason || '',
    debug: req.body?.debug || {}
  });

  res.status(201).json({ problem });
});

app.post('/api/student/message', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  const message = String(req.body?.message || '').trim();
  const session = studentSessions[sessionId];

  if (!session) {
    return res.status(404).json({ error: 'Student session not found.' });
  }

  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const result = await answerStudentMessage(message);
    const entry = {
      message,
      response: result.response,
      routeType: result.routeType,
      confidence: result.confidence,
      createdAt: new Date().toISOString()
    };

    session.messages.push(entry);

    logCompletedInteraction({
      message,
      questionRoute: result.questionRoute,
      answerGiven: result.response,
      source: 'student',
      sessionId,
      debug: {
        className: session.className || ''
      }
    });

    res.json({
      response: result.response,
      routeType: result.routeType,
      confidence: result.confidence
    });
  } catch (error) {
    console.error('Student message route error:', error);
    res.status(500).json({
      error: 'Could not answer that student message.'
    });
  }
});

app.patch('/api/ai-improvement/problems/:id', (req, res) => {
  const problem = updateProblem(req.params.id, {
    status: req.body?.status,
    category: req.body?.category,
    teacherNotes: req.body?.teacherNotes,
    expectedBehavior: req.body?.expectedBehavior,
    source: req.body?.source,
    reason: req.body?.reason
  });

  if (!problem) {
    return res.status(404).json({ error: 'Problem not found.' });
  }

  res.json({ problem });
});

app.post('/api/chat', async (req, res) => {
  const message = (req.body?.message || '').trim();
  const selectedVoiceId = (req.body?.voice || '').trim();
  console.log('Incoming message:', message);

  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const abortController = new AbortController();
  let clientClosed = false;
  let sentenceIndex = 0;
  let ttsChain = Promise.resolve();

  req.on('aborted', () => {
    clientClosed = true;
    abortController.abort();
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort();
    }
  });

  const sendEvent = (payload) => {
    if (clientClosed) return;
    res.write(`${JSON.stringify(payload)}\n`);
  };

  sendEvent({
    type: 'start',
    voice: selectedVoiceId || null,
    ttsBackend: tts.getEffectiveTtsBackend(),
    ttsAudioMode: tts.getEffectiveAudioMode(),
    canStreamAudio: tts.canStreamAudio()
  });

  let fullText = '';
  let matchedKnowledge = [];
  let questionRoute = null;
  let usedAiFallback = false;

  try {
    let pending = '';
    let speechBuffer = [];
    let firstChunkSent = false;

    TEACHER_KNOWLEDGE = loadTeacherKnowledge(teacherFactsFile);
    matchedKnowledge = getRelevantKnowledge(message);
    questionRoute = routeStudentQuestion(message, matchedKnowledge);

    console.log('Knowledge matches:', matchedKnowledge.map((item) => item.title || item.id));
    console.log('Question route:', questionRoute.public);
    sendEvent({ type: 'router', router: questionRoute.public });

    maybeLogReviewQuestion({
      message,
      questionRoute,
      matchedKnowledge,
      answerGiven: questionRoute.directAnswer
    });

    if (questionRoute.directAnswer && !questionRoute.aiAllowed) {
      fullText += questionRoute.directAnswer;
      sendEvent({ type: 'text_delta', chunk: questionRoute.directAnswer });
      queueSentenceForSpeech(questionRoute.directAnswer);
    } else {
      usedAiFallback = true;
      await ollama.stream({
        prompt: ollama.buildTeacherPrompt({ message, matchedKnowledge, questionRoute }),
        signal: abortController.signal,
        onText(textChunk) {
          if (!textChunk || clientClosed) return;

          fullText += textChunk;
          pending += textChunk;
          sendEvent({ type: 'text_delta', chunk: textChunk });

          const { complete, remaining } = ollama.extractCompletedSentences(pending);
          pending = remaining;

          for (const sentence of complete) {
            const cleaned = sentence.trim();
            if (!cleaned) continue;

            speechBuffer.push(cleaned);

            if (!firstChunkSent) {
              if (speechBuffer.length >= 2) {
                queueSentenceForSpeech(speechBuffer.join(' '));
                speechBuffer = [];
                firstChunkSent = true;
              }
            } else {
              queueSentenceForSpeech(speechBuffer.shift());
            }
          }
        }
      });
    }

    const trailing = pending.trim();
    if (trailing) {
      speechBuffer.push(trailing);
    }

    if (speechBuffer.length) {
      if (!firstChunkSent) {
        queueSentenceForSpeech(speechBuffer.join(' '));
      } else {
        for (const chunk of speechBuffer) {
          queueSentenceForSpeech(chunk);
        }
      }
    }

    if (usedAiFallback) {
      logAiImprovementProblem({
        message,
        questionRoute,
        matchedKnowledge,
        answerGiven: fullText,
        category: 'fallback_review',
        reason: 'fallback',
        source: 'auto'
      });
    }

    logCompletedInteraction({
      message,
      questionRoute,
      answerGiven: fullText,
      source: usedAiFallback ? 'chat_ai_fallback' : 'chat_router'
    });

    await ttsChain;

    sendEvent({ type: 'done', fullText });
    res.end();
  } catch (error) {
    console.error('Chat route error:', error);
    if (!clientClosed) {
      const safeMessage = 'I do not have a trusted answer for that yet. Ask your teacher or try rewording the question.';
      logAiImprovementProblem({
        message,
        questionRoute,
        matchedKnowledge,
        answerGiven: fullText || safeMessage,
        category: 'server_error',
        reason: 'server_error',
        source: 'auto',
        debug: {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        }
      });
      sendEvent({ type: 'error', message: safeMessage });
      res.end();
    }
  }

  function queueSentenceForSpeech(sentence) {
    if (!sentence) return;

    const itemNumber = sentenceIndex++;
    ttsChain = ttsChain
      .then(async () => {
        await tts.streamSentenceAudio({
          sentence,
          index: itemNumber,
          selectedVoiceId,
          sendEvent,
          signal: abortController.signal,
          isClientClosed: () => clientClosed
        });
      })
      .catch((error) => {
        sendEvent({
          type: 'audio_error',
          sentence,
          index: itemNumber,
          message: error.message
        });
      });
  }
});

function getRelevantKnowledge(message) {
  return findRelevantKnowledge(message, TEACHER_KNOWLEDGE, MAX_KNOWLEDGE_ITEMS);
}

async function answerStudentMessage(message) {
  TEACHER_KNOWLEDGE = loadTeacherKnowledge(teacherFactsFile);
  const matchedKnowledge = getRelevantKnowledge(message);
  const questionRoute = routeStudentQuestion(message, matchedKnowledge);
  let response = questionRoute.directAnswer || '';
  let usedAiFallback = false;

  maybeLogReviewQuestion({
    message,
    questionRoute,
    matchedKnowledge,
    answerGiven: response
  });

  if (!response || questionRoute.aiAllowed) {
    usedAiFallback = true;
    response = '';
    await ollama.stream({
      prompt: ollama.buildTeacherPrompt({ message, matchedKnowledge, questionRoute }),
      onText(textChunk) {
        response += textChunk || '';
      }
    });
  }

  if (usedAiFallback) {
    logAiImprovementProblem({
      message,
      questionRoute,
      matchedKnowledge,
      answerGiven: response,
      category: 'fallback_review',
      reason: 'fallback',
      source: 'student_session'
    });
  }

  return {
    response: response || 'I do not have a trusted answer for that yet. Please ask your teacher.',
    routeType: questionRoute?.public?.type || questionRoute?.type || 'unknown',
    confidence: questionRoute?.confidence || 'unknown',
    questionRoute
  };
}

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  try {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex <= 0) continue;

      const key = trimmed.slice(0, equalsIndex).trim();
      const rawValue = trimmed.slice(equalsIndex + 1).trim();
      if (!key || process.env[key] !== undefined) continue;

      process.env[key] = unquoteEnvValue(rawValue);
    }
  } catch (error) {
    console.warn('Could not load local .env file:', error.message);
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sendProfileError(res, error) {
  const statusCode = Number(error?.statusCode || 500);
  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: error instanceof Error ? error.message : String(error)
  });
}

function buildStudentUrl(req, sessionId) {
  const host = req.get('host') || `localhost:${PORT}`;
  const protocol = req.protocol || 'http';
  return `${protocol}://${host}/student.html?sessionId=${encodeURIComponent(sessionId)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function maybeLogReviewQuestion({ message, questionRoute, matchedKnowledge, answerGiven }) {
  const review = getRouteReviewInfo(questionRoute);
  if (!review) return;

  logAiImprovementProblem({
    message,
    questionRoute,
    matchedKnowledge,
    answerGiven,
    source: 'auto',
    category: review.category,
    reason: review.reason
  });
}

function logAiImprovementProblem({
  message,
  questionRoute = null,
  matchedKnowledge = [],
  answerGiven = '',
  category = 'needs_review',
  reason = '',
  source = 'auto',
  debug = {}
}) {
  try {
    logProblem({
      status: 'open',
      category,
      studentQuestion: message,
      answerGiven,
      routerType: questionRoute?.type || '',
      formulaChosen: getFormulaChosen(questionRoute),
      confidence: questionRoute?.confidence || '',
      source,
      reason,
      debug: {
        route: questionRoute?.public || null,
        notes: questionRoute?.notes || '',
        toolsUsed: questionRoute?.toolsUsed || [],
        matchedKnowledge: matchedKnowledge.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          score: item.score
        })),
        ...debug
      }
    });
  } catch (error) {
    console.warn('Could not write AI Improvement problem log:', error.message);
  }
}

function logCompletedInteraction({
  message,
  questionRoute = null,
  answerGiven = '',
  source = 'chat',
  sessionId = '',
  debug = {}
}) {
  try {
    const routeType = questionRoute?.public?.type || questionRoute?.type || '';
    const formulaChosen = getFormulaChosen(questionRoute);

    logStudentInteraction({
      studentQuestion: message,
      question: message,
      message,
      answerGiven,
      answer: answerGiven,
      response: answerGiven,
      routerType: questionRoute?.type || '',
      routeType,
      type: routeType,
      formulaChosen,
      category: formulaChosen || routeType,
      confidence: questionRoute?.confidence || '',
      source,
      sessionId,
      debug: {
        route: questionRoute?.public || null,
        ...debug
      }
    });
  } catch (error) {
    console.warn('Could not write student interaction log:', error.message);
  }
}

function getRouteReviewInfo(questionRoute) {
  if (!questionRoute) {
    return { category: 'no_trusted_answer', reason: 'no_route' };
  }

  if (questionRoute.type === 'no_match') {
    if (looksLikeSafetyBlock(questionRoute)) {
      return { category: 'rejected_question', reason: 'rejected' };
    }

    return { category: 'no_trusted_answer', reason: 'no_trusted_answer' };
  }

  if (questionRoute.confidence === 'none') {
    return { category: 'no_trusted_answer', reason: 'no_trusted_answer' };
  }

  if (questionRoute.confidence === 'weak') {
    return { category: 'needs_review', reason: 'low_confidence' };
  }

  return null;
}

function looksLikeSafetyBlock(questionRoute) {
  const text = `${questionRoute.notes || ''} ${questionRoute.directAnswer || ''}`.toLowerCase();
  return /\bsafety\b|\beating\b|\btouching\b|\bsmelling\b|\bchemical\b/.test(text);
}

function getFormulaChosen(questionRoute) {
  return questionRoute?.formulaChosen
    || questionRoute?.public?.formulaChosen
    || questionRoute?.calculatorResult?.expression
    || '';
}

app.listen(PORT, () => {
  console.log(`AI in a Box running at http://localhost:${PORT}`);
  console.log(`TTS backend: ${tts.getEffectiveTtsBackend()}`);
  console.log(`Audio mode: ${tts.getEffectiveAudioMode()}`);
  if (tts.usingPiperHttp()) {
    console.log(`Piper HTTP URL: ${process.env.PIPER_HTTP_URL}`);
  }
});
