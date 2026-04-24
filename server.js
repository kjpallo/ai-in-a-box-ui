const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';
const publicDir = path.join(__dirname, 'public');
const voicesDir = path.join(__dirname, 'voices');
const audioDir = path.join(__dirname, 'audio');

const PIPER_BACKEND = (process.env.PIPER_BACKEND || 'auto').toLowerCase();
const PIPER_HTTP_URL = process.env.PIPER_HTTP_URL || '';
const PIPER_AUDIO_MODE = (process.env.PIPER_AUDIO_MODE || 'file').toLowerCase();
const PIPER_SAMPLE_RATE = Number(process.env.PIPER_SAMPLE_RATE || 0);
const AUDIO_TTL_MS = Number(process.env.AUDIO_TTL_MS || 1000 * 60 * 30);
const PIPER_LENGTH_SCALE = process.env.PIPER_LENGTH_SCALE || '1.25';

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

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.2);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 110);
const OLLAMA_TOP_K = Number(process.env.OLLAMA_TOP_K || 20);
const OLLAMA_TOP_P = Number(process.env.OLLAMA_TOP_P || 0.85);
const OLLAMA_REPEAT_PENALTY = Number(process.env.OLLAMA_REPEAT_PENALTY || 1.1);

ensureDir(audioDir);
pruneAudioDir();
setInterval(pruneAudioDir, Math.max(60_000, Math.floor(AUDIO_TTL_MS / 2))).unref();

app.use(express.json());
app.use(express.static(publicDir));
app.use('/audio', express.static(audioDir));

app.get('/api/health', (_req, res) => {
  const voices = listPiperVoices();
  res.json({
    ok: true,
    model: OLLAMA_MODEL,
    conciseMode: true,
    ttsBackend: getEffectiveTtsBackend(),
    piperHttpConfigured: usingPiperHttp(),
    ttsAudioMode: getEffectiveAudioMode(),
    canStreamAudio: canStreamAudio(),
    canSelectVoice: !usingPiperHttp(),
    hasVoice: usingPiperHttp() || voices.length > 0,
    voices
  });
});

app.get('/api/voices', (_req, res) => {
  res.json({
    backend: getEffectiveTtsBackend(),
    ttsAudioMode: getEffectiveAudioMode(),
    canStreamAudio: canStreamAudio(),
    canSelectVoice: !usingPiperHttp(),
    voices: listPiperVoices()
  });
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
    ttsBackend: getEffectiveTtsBackend(),
    ttsAudioMode: getEffectiveAudioMode(),
    canStreamAudio: canStreamAudio()
  });

  try {
    let fullText = '';
let pending = '';
let speechBuffer = [];
let firstChunkSent = false;

    await streamFromOllama({
      prompt: buildTeacherPrompt(message),
      signal: abortController.signal,
      onText(textChunk) {
        if (!textChunk || clientClosed) return;

         fullText += textChunk;
        pending += textChunk;
        sendEvent({ type: 'text_delta', chunk: textChunk });

        const { complete, remaining } = extractCompletedSentences(pending);
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

    await ttsChain;

    sendEvent({ type: 'done', fullText });
    res.end();
  } catch (error) {
    console.error('Chat route error:', error);
    if (!clientClosed) {
      sendEvent({ type: 'error', message: error.message || 'Chat failed.' });
      res.end();
    }
  }

  function queueSentenceForSpeech(sentence) {
    if (!sentence) return;

    const itemNumber = sentenceIndex++;
    ttsChain = ttsChain
      .then(async () => {
        await streamSentenceAudio({
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

async function streamFromOllama({ prompt, onText, signal }) {
  console.log('Calling Ollama:', OLLAMA_URL, 'model:', OLLAMA_MODEL);
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system: SYSTEM_PROMPT,
      prompt,
      stream: true,
      options: {
        temperature: OLLAMA_TEMPERATURE,
        num_predict: OLLAMA_NUM_PREDICT,
        top_k: OLLAMA_TOP_K,
        top_p: OLLAMA_TOP_P,
        repeat_penalty: OLLAMA_REPEAT_PENALTY
      }
    }),
    signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ollama request failed with status ${response.status}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }

      if (parsed.response) {
        onText(parsed.response);
      }

      if (parsed.done) {
        return;
      }
    }
  }
}

function buildTeacherPrompt(message) {
  return [
    'Teacher request:',
    message,
    '',
    'Follow the classroom instructions above. Answer for a 9th-grade science student.'
  ].join('\n');
}

function extractCompletedSentences(text) {
  const complete = [];
  let lastCut = 0;
  const matches = text.matchAll(/[^.!?\n]+[.!?]+(?:\s+|$)|[^\n]+\n+/g);

  for (const match of matches) {
    const sentence = match[0].trim();
    if (sentence) complete.push(sentence);
    lastCut = match.index + match[0].length;
  }

  return {
    complete,
    remaining: text.slice(lastCut)
  };
}

async function streamSentenceAudio({ sentence, index, selectedVoiceId, sendEvent, signal, isClientClosed }) {
  const backend = getEffectiveTtsBackend();
  const mode = getEffectiveAudioMode();

  if (backend === 'http') {
    const filename = `tts-${Date.now()}-${index}.wav`;
    const outputFile = path.join(audioDir, filename);
    await runPiperHttp(sentence, outputFile, signal);
    sendEvent({
      type: 'audio',
      sentence,
      mode: 'file',
      url: `/audio/${filename}`,
      index,
      backend,
      ttsAudioMode: 'file'
    });
    return;
  }

  const voiceModel = resolveVoiceModel(selectedVoiceId);
  if (!voiceModel) {
    sendEvent({
      type: 'audio',
      sentence,
      mode: 'placeholder',
      durationMs: estimateDuration(sentence),
      index,
      backend,
      ttsAudioMode: 'placeholder',
      message: 'No Piper voice found yet.'
    });
    return;
  }

  if (mode !== 'stream') {
  const filename = `tts-${Date.now()}-${index}.wav`;
  const outputFile = path.join(audioDir, filename);

  await runPiperCliFile(sentence, voiceModel.filePath, outputFile, signal);
  const wavInfo = await readWavInfo(outputFile);

  console.log('Generated WAV:', {
    file: filename,
    voice: voiceModel.name,
    wavInfo
  });

  sendEvent({
    type: 'audio',
    sentence,
    mode: 'file',
    url: `/audio/${filename}`,
    index,
    backend,
    ttsAudioMode: 'file',
    voiceId: voiceModel.id,
    voiceName: voiceModel.name,
    sampleRate: voiceModel.sampleRate || null,
    wavInfo
  });
  return;
}

  const sampleRate = resolveSampleRate(voiceModel);
  if (!sampleRate) {
    throw new Error(`Could not determine sample rate for ${voiceModel.name}. Add the matching .onnx.json file or set PIPER_SAMPLE_RATE.`);
  }

  sendEvent({
    type: 'audio_stream_start',
    sentence,
    index,
    backend,
    ttsAudioMode: 'stream',
    voiceId: voiceModel.id,
    voiceName: voiceModel.name,
    sampleRate,
    channels: 1,
    format: 'pcm_s16le'
  });

  let chunkCount = 0;
  await runPiperCliStream(sentence, voiceModel.filePath, {
    signal,
    onChunk(chunk) {
      if (isClientClosed()) return;
      if (!chunk || !chunk.length) return;
      chunkCount += 1;
      sendEvent({
        type: 'audio_chunk',
        index,
        sampleRate,
        encoding: 'base64',
        data: chunk.toString('base64')
      });
    }
  });

  sendEvent({
    type: 'audio_stream_end',
    sentence,
    index,
    chunkCount,
    sampleRate
  });
}

async function runPiperHttp(sentence, outputFile, signal) {
  const response = await fetch(PIPER_HTTP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: sentence,
    signal
  });

  if (!response.ok) {
    throw new Error(`Piper HTTP request failed with status ${response.status}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.promises.writeFile(outputFile, Buffer.from(arrayBuffer));
}

function runPiperCliFile(sentence, voiceModelPath, outputFile, signal) {
  return new Promise((resolve, reject) => {
    const piper = spawn('piper', [
      '--model',
      voiceModelPath,
      '--output_file',
      outputFile,
      '--length-scale',
      PIPER_LENGTH_SCALE
    ]);

    let stderr = '';

    const abortHandler = () => {
      piper.kill('SIGTERM');
      reject(new Error('Audio generation aborted.'));
    };

    if (signal) {
      if (signal.aborted) {
        abortHandler();
        return;
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    piper.stdin.write(sentence);
    piper.stdin.end();

    piper.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    piper.on('error', (error) => {
      reject(new Error(`Piper failed to start: ${error.message}`));
    });

    piper.on('close', (code) => {
      signal?.removeEventListener?.('abort', abortHandler);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `Piper exited with code ${code}.`));
      }
    });
  });
}

function runPiperCliStream(sentence, voiceModelPath, { onChunk, signal }) {
  return new Promise((resolve, reject) => {
    const piper = spawn('piper', [
      '--model',
      voiceModelPath,
      '--output-raw',
      '--length-scale',
      PIPER_LENGTH_SCALE
    ]);

    let stderr = '';
    let settled = false;

    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const finishResolve = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const abortHandler = () => {
      piper.kill('SIGTERM');
      finishReject(new Error('Audio generation aborted.'));
    };

    if (signal) {
      if (signal.aborted) {
        abortHandler();
        return;
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    piper.stdout.on('data', (chunk) => {
      try {
        onChunk(chunk);
      } catch (error) {
        piper.kill('SIGTERM');
        finishReject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    piper.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    piper.on('error', (error) => {
      finishReject(new Error(`Piper failed to start: ${error.message}`));
    });

    piper.on('close', (code) => {
      signal?.removeEventListener?.('abort', abortHandler);
      if (settled) return;
      if (code === 0) {
        finishResolve();
      } else {
        finishReject(new Error(stderr || `Piper exited with code ${code}.`));
      }
    });

    piper.stdin.write(sentence);
    piper.stdin.end();
  });
}

async function readWavInfo(filePath) {
  const handle = await fs.promises.open(filePath, 'r');

  try {
    const header = Buffer.alloc(44);
    await handle.read(header, 0, 44, 0);

    const riff = header.toString('ascii', 0, 4);
    const wave = header.toString('ascii', 8, 12);

    if (riff !== 'RIFF' || wave !== 'WAVE') {
      return {
        ok: false,
        reason: 'Not a valid WAV header'
      };
    }

    return {
      ok: true,
      audioFormat: header.readUInt16LE(20),
      channels: header.readUInt16LE(22),
      sampleRate: header.readUInt32LE(24),
      byteRate: header.readUInt32LE(28),
      blockAlign: header.readUInt16LE(32),
      bitsPerSample: header.readUInt16LE(34),
      dataSize: header.readUInt32LE(40)
    };
  } finally {
    await handle.close();
  }
}

function listPiperVoices() {
  if (!fs.existsSync(voicesDir)) return [];

  const files = fs.readdirSync(voicesDir)
    .filter((file) => file.toLowerCase().endsWith('.onnx'))
    .sort((a, b) => a.localeCompare(b));

  return files.map((file) => {
    const filePath = path.join(voicesDir, file);
    const metaPath = `${filePath}.json`;
    const metadata = readJsonIfPresent(metaPath);
    const sampleRate = metadata?.audio?.sample_rate || metadata?.sample_rate || null;

    return {
      id: file,
      name: file.replace(/\.onnx$/i, '').replace(/[_-]+/g, ' '),
      filePath,
      sampleRate
    };
  });
}

function readJsonIfPresent(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function resolveVoiceModel(selectedVoiceId) {
  const voices = listPiperVoices();
  if (!voices.length) return null;
  return voices.find((voice) => voice.id === selectedVoiceId) || voices[0];
}

function resolveSampleRate(voiceModel) {
  return Number(voiceModel?.sampleRate || PIPER_SAMPLE_RATE || 0) || null;
}

function usingPiperHttp() {
  if (!PIPER_HTTP_URL) return false;
  return PIPER_BACKEND === 'http' || PIPER_BACKEND === 'auto';
}

function getEffectiveTtsBackend() {
  if (usingPiperHttp()) return 'http';
  return 'cli';
}

function getEffectiveAudioMode() {
  if (getEffectiveTtsBackend() === 'http') return 'file';
  return PIPER_AUDIO_MODE === 'file' ? 'file' : 'stream';
}

function canStreamAudio() {
  return getEffectiveTtsBackend() === 'cli' && getEffectiveAudioMode() === 'stream';
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function pruneAudioDir() {
  if (!fs.existsSync(audioDir)) return;
  const cutoff = Date.now() - AUDIO_TTL_MS;

  for (const file of fs.readdirSync(audioDir)) {
    const fullPath = path.join(audioDir, file);

    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch {
      continue;
    }

    if (!stats.isFile()) continue;
    if (stats.mtimeMs >= cutoff) continue;

    try {
      fs.unlinkSync(fullPath);
    } catch {
      // Ignore cleanup issues.
    }
  }
}

function estimateDuration(sentence) {
  const words = sentence.split(/\s+/).filter(Boolean).length;
  return Math.max(900, Math.round(words * 330));
}

app.listen(PORT, () => {
  console.log(`AI in a Box running at http://localhost:${PORT}`);
  console.log(`TTS backend: ${getEffectiveTtsBackend()}`);
  console.log(`Audio mode: ${getEffectiveAudioMode()}`);
  if (usingPiperHttp()) {
    console.log(`Piper HTTP URL: ${PIPER_HTTP_URL}`);
  }
});
