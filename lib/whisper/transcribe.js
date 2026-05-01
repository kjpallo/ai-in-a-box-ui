const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_TIMEOUT_MS = 60_000;
const GENERIC_WHISPER_ERROR = 'Whisper is not installed or transcription failed.';

function resolveProjectPath(value) {
  if (!value) return '';
  return path.isAbsolute(value) ? value : path.resolve(PROJECT_ROOT, value);
}

function resolveCommand(value) {
  if (!value) return '';
  if (path.isAbsolute(value) || value.startsWith('.') || value.includes(path.sep)) {
    return resolveProjectPath(value);
  }
  return value;
}

function firstExistingPath(candidates) {
  return candidates.find((candidate) => {
    try {
      fs.accessSync(candidate, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function getWhisperConfig() {
  const binCandidates = [
    path.join(PROJECT_ROOT, 'vendor', 'whisper.cpp', 'build', 'bin', 'whisper-cli'),
    path.join(PROJECT_ROOT, 'vendor', 'whisper.cpp', 'build', 'bin', 'main'),
    path.join(PROJECT_ROOT, 'vendor', 'whisper.cpp', 'main'),
    path.join(PROJECT_ROOT, 'whisper.cpp', 'build', 'bin', 'whisper-cli'),
    path.join(PROJECT_ROOT, 'whisper.cpp', 'build', 'bin', 'main'),
    path.join(PROJECT_ROOT, 'whisper.cpp', 'main')
  ];

  const modelCandidates = [
    path.join(PROJECT_ROOT, 'models', 'ggml-tiny.en.bin'),
    path.join(PROJECT_ROOT, 'models', 'ggml-base.en.bin'),
    path.join(PROJECT_ROOT, 'vendor', 'whisper.cpp', 'models', 'ggml-tiny.en.bin'),
    path.join(PROJECT_ROOT, 'vendor', 'whisper.cpp', 'models', 'ggml-base.en.bin')
  ];

  return {
    whisperBin: process.env.WHISPER_CPP_BIN
      ? resolveCommand(process.env.WHISPER_CPP_BIN)
      : firstExistingPath(binCandidates) || binCandidates[0],
    modelPath: process.env.WHISPER_MODEL
      ? resolveProjectPath(process.env.WHISPER_MODEL)
      : firstExistingPath(modelCandidates) || modelCandidates[0],
    language: process.env.WHISPER_LANGUAGE || DEFAULT_LANGUAGE,
    ffmpegBin: resolveCommand(process.env.FFMPEG_BIN || 'ffmpeg'),
    timeoutMs: Number(process.env.WHISPER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  };
}

async function transcribeAudioFile(inputPath, options = {}) {
  const config = getWhisperConfig();
  const tempDir = options.tempDir || path.dirname(inputPath);
  const whisperInputPath = isWavInput(inputPath, options.contentType)
    ? inputPath
    : await convertToWav(inputPath, path.join(tempDir, 'input.wav'), config);

  await assertReadable(config.modelPath, 'Whisper model is missing.');
  await assertRunnable(config.whisperBin, 'Whisper executable is missing.');

  const outputBase = path.join(tempDir, 'whisper-output');
  const args = [
    '-m', config.modelPath,
    '-f', whisperInputPath,
    '-l', config.language,
    '-nt',
    '-otxt',
    '-of', outputBase
  ];

  const result = await runCommand(config.whisperBin, args, { timeoutMs: config.timeoutMs });
  if (result.code !== 0) {
    throw publicError('Whisper command failed.', result.stderr || result.stdout);
  }

  const textPath = `${outputBase}.txt`;
  let text = '';
  try {
    text = await fsp.readFile(textPath, 'utf8');
  } catch {
    text = extractTextFromStdout(result.stdout);
  }

  return { text: normalizeTranscript(text) };
}

async function convertToWav(inputPath, outputPath, config) {
  const args = [
    '-y',
    '-i', inputPath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    outputPath
  ];

  const result = await runCommand(config.ffmpegBin, args, { timeoutMs: config.timeoutMs });
  if (result.code !== 0) {
    throw publicError('ffmpeg conversion failed.', result.stderr || result.stdout);
  }

  await assertReadable(outputPath, 'Converted wav file is missing.');
  return outputPath;
}

function isWavInput(inputPath, contentType = '') {
  const lowerType = String(contentType || '').toLowerCase();
  const lowerPath = inputPath.toLowerCase();
  return lowerType.includes('audio/wav')
    || lowerType.includes('audio/x-wav')
    || lowerType.includes('audio/wave')
    || lowerPath.endsWith('.wav');
}

async function assertReadable(targetPath, message) {
  try {
    await fsp.access(targetPath, fs.constants.R_OK);
  } catch {
    throw publicError(message);
  }
}

async function assertRunnable(command, message) {
  if (!command || command === path.basename(command)) return;

  try {
    await fsp.access(command, fs.constants.X_OK);
  } catch {
    throw publicError(message);
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let child;
    let settled = false;
    let stdout = '';
    let stderr = '';

    try {
      child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      reject(publicError('Command could not be started.', error.message));
      return;
    }

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(publicError('Command timed out.'));
    }, Math.max(5_000, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS)));

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 200_000) stdout = stdout.slice(-100_000);
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(publicError('Command failed to start.', error.message));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

function extractTextFromStdout(stdout) {
  return String(stdout || '')
    .split('\n')
    .filter((line) => !line.includes('whisper_') && !line.includes('system_info'))
    .join('\n');
}

function normalizeTranscript(text) {
  return String(text || '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function publicError(message, detail = '') {
  const error = new Error(message);
  error.publicMessage = GENERIC_WHISPER_ERROR;
  error.detail = detail;
  return error;
}

module.exports = {
  GENERIC_WHISPER_ERROR,
  getWhisperConfig,
  transcribeAudioFile
};
