const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';
const publicDir = path.join(__dirname, 'public');
const voicesDir = path.join(__dirname, 'voices');
const audioDir = path.join(__dirname, 'audio');

app.use(express.json());
app.use(express.static(publicDir));
app.use('/audio', express.static(audioDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: OLLAMA_MODEL, hasVoice: Boolean(findPiperVoice()) });
});

app.post('/api/chat', async (req, res) => {
  const message = (req.body?.message || '').trim();

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

  req.on('close', () => {
    clientClosed = true;
    abortController.abort();
  });

  const sendEvent = (payload) => {
    if (clientClosed) return;
    res.write(`${JSON.stringify(payload)}\n`);
  };

  sendEvent({ type: 'start' });

  try {
    let fullText = '';
    let pending = '';

    await streamFromOllama({
      prompt: message,
      signal: abortController.signal,
      onText(textChunk) {
        if (!textChunk || clientClosed) return;

        fullText += textChunk;
        pending += textChunk;
        sendEvent({ type: 'text_delta', chunk: textChunk });

        const { complete, remaining } = extractCompletedSentences(pending);
        pending = remaining;

        for (const sentence of complete) {
          const cleanSentence = sentence.trim();
          if (!cleanSentence) continue;

          const itemNumber = sentenceIndex++;
          ttsChain = ttsChain
            .then(async () => {
              const audioPayload = await buildTtsPayload(cleanSentence, itemNumber);
              sendEvent({
                type: 'audio',
                sentence: cleanSentence,
                ...audioPayload
              });
            })
            .catch((error) => {
              sendEvent({
                type: 'audio_error',
                sentence: cleanSentence,
                message: error.message
              });
            });
        }
      }
    });

    const trailing = pending.trim();
    if (trailing) {
      const itemNumber = sentenceIndex++;
      ttsChain = ttsChain
        .then(async () => {
          const audioPayload = await buildTtsPayload(trailing, itemNumber);
          sendEvent({
            type: 'audio',
            sentence: trailing,
            ...audioPayload
          });
        })
        .catch((error) => {
          sendEvent({
            type: 'audio_error',
            sentence: trailing,
            message: error.message
          });
        });
    }

    await ttsChain;

    sendEvent({ type: 'done', fullText });
    res.end();
  } catch (error) {
    if (!clientClosed) {
      sendEvent({ type: 'error', message: error.message || 'Chat failed.' });
      res.end();
    }
  }
});

async function streamFromOllama({ prompt, onText, signal }) {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: true
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

async function buildTtsPayload(sentence, index) {
  const voiceModel = findPiperVoice();

  if (!voiceModel) {
    return {
      mode: 'placeholder',
      durationMs: estimateDuration(sentence),
      index
    };
  }

  const filename = `tts-${Date.now()}-${index}.wav`;
  const outputFile = path.join(audioDir, filename);

  await runPiper(sentence, voiceModel, outputFile);

  return {
    mode: 'file',
    url: `/audio/${filename}`,
    index
  };
}

function runPiper(sentence, voiceModel, outputFile) {
  return new Promise((resolve, reject) => {
    const piper = spawn('piper', [
      '--model',
      voiceModel,
      '--output_file',
      outputFile
    ]);

    let stderr = '';

    piper.stdin.write(sentence);
    piper.stdin.end();

    piper.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    piper.on('error', (error) => {
      reject(new Error(`Piper failed to start: ${error.message}`));
    });

    piper.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `Piper exited with code ${code}.`));
      }
    });
  });
}

function findPiperVoice() {
  if (!fs.existsSync(voicesDir)) return null;
  const files = fs.readdirSync(voicesDir);
  const onnxFile = files.find((file) => file.toLowerCase().endsWith('.onnx'));
  return onnxFile ? path.join(voicesDir, onnxFile) : null;
}

function estimateDuration(sentence) {
  const words = sentence.split(/\s+/).filter(Boolean).length;
  return Math.max(900, Math.round(words * 330));
}

app.listen(PORT, () => {
  console.log(`AI in a Box running at http://localhost:${PORT}`);
});
