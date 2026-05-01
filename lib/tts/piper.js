const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function createTtsService(config) {
  ensureDir(config.audioDir);

  return {
    streamSentenceAudio: (options) => streamSentenceAudio(config, options),
    listVoices: () => listPiperVoices(config),
    usingPiperHttp: () => usingPiperHttp(config),
    getEffectiveTtsBackend: () => getEffectiveTtsBackend(config),
    getEffectiveAudioMode: () => getEffectiveAudioMode(config),
    canStreamAudio: () => canStreamAudio(config),
    pruneAudioDir: () => pruneAudioDir(config)
  };
}

async function streamSentenceAudio(config, { sentence, index, selectedVoiceId, sendEvent, signal, isClientClosed }) {
  const backend = getEffectiveTtsBackend(config);
  const mode = getEffectiveAudioMode(config);

  if (backend === 'http') {
    const filename = `tts-${Date.now()}-${index}.wav`;
    const outputFile = path.join(config.audioDir, filename);
    await runPiperHttp(config, sentence, outputFile, signal);
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

  const voiceModel = resolveVoiceModel(config, selectedVoiceId);
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
    const outputFile = path.join(config.audioDir, filename);

    await runPiperCliFile(config, sentence, voiceModel.filePath, outputFile, signal);
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

  const sampleRate = resolveSampleRate(config, voiceModel);
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
  await runPiperCliStream(config, sentence, voiceModel.filePath, {
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

async function runPiperHttp(config, sentence, outputFile, signal) {
  const response = await fetch(config.piperHttpUrl, {
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

function runPiperCliFile(config, sentence, voiceModelPath, outputFile, signal) {
  return new Promise((resolve, reject) => {
    const piper = spawn(config.piperBin, [
      '--model',
      voiceModelPath,
      '--output_file',
      outputFile,
      '--length-scale',
      config.piperLengthScale
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

function runPiperCliStream(config, sentence, voiceModelPath, { onChunk, signal }) {
  return new Promise((resolve, reject) => {
    const piper = spawn(config.piperBin, [
      '--model',
      voiceModelPath,
      '--output-raw',
      '--length-scale',
      config.piperLengthScale
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

function listPiperVoices(config) {
  if (!fs.existsSync(config.voicesDir)) return [];

  const files = fs.readdirSync(config.voicesDir)
    .filter((file) => file.toLowerCase().endsWith('.onnx'))
    .sort((a, b) => a.localeCompare(b));

  return files.map((file) => {
    const filePath = path.join(config.voicesDir, file);
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

function resolveVoiceModel(config, selectedVoiceId) {
  const voices = listPiperVoices(config);
  if (!voices.length) return null;
  return voices.find((voice) => voice.id === selectedVoiceId) || voices[0];
}

function resolveSampleRate(config, voiceModel) {
  return Number(voiceModel?.sampleRate || config.piperSampleRate || 0) || null;
}

function usingPiperHttp(config) {
  if (!config.piperHttpUrl) return false;

  if (config.piperBackend === 'http') return true;
  if (config.piperBackend === 'auto') return true;

  return false;
}

function getEffectiveTtsBackend(config) {
  if (usingPiperHttp(config)) return 'http';
  return 'cli';
}

function getEffectiveAudioMode(config) {
  if (getEffectiveTtsBackend(config) === 'http') return 'file';
  return config.piperAudioMode === 'file' ? 'file' : 'stream';
}

function canStreamAudio(config) {
  return getEffectiveTtsBackend(config) === 'cli' && getEffectiveAudioMode(config) === 'stream';
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function pruneAudioDir(config) {
  if (!fs.existsSync(config.audioDir)) return;
  const cutoff = Date.now() - config.audioTtlMs;

  for (const file of fs.readdirSync(config.audioDir)) {
    const fullPath = path.join(config.audioDir, file);

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

module.exports = { createTtsService };
