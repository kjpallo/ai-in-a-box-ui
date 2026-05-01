const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { GENERIC_WHISPER_ERROR, transcribeAudioFile } = require('../lib/whisper/transcribe');

const MAX_UPLOAD_BYTES = Number(process.env.WHISPER_MAX_UPLOAD_BYTES || 25 * 1024 * 1024);

function registerWhisperRoutes(app) {
  app.post('/api/whisper/transcribe', async (req, res) => {
    let tempDir = '';

    try {
      const contentType = String(req.headers['content-type'] || 'application/octet-stream');
      const audioBuffer = await readRequestBody(req, MAX_UPLOAD_BYTES);

      if (!audioBuffer.length) {
        res.status(400).json({ ok: false, error: 'No audio was received.' });
        return;
      }

      tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'charlemagne-whisper-'));
      const inputPath = path.join(tempDir, `input${extensionForContentType(contentType)}`);
      await fsp.writeFile(inputPath, audioBuffer);

      const result = await transcribeAudioFile(inputPath, { contentType, tempDir });
      res.json({ ok: true, text: result.text });
    } catch (error) {
      const status = error && error.statusCode === 413 ? 413 : 200;
      console.warn('Whisper transcription failed:', error && (error.detail || error.message || error));
      res.status(status).json({
        ok: false,
        error: error && error.statusCode === 413
          ? 'Recording is too large. Please keep Push to Talk recordings short.'
          : GENERIC_WHISPER_ERROR
      });
    } finally {
      if (tempDir) {
        await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  });
}

function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let rejected = false;

    req.on('data', (chunk) => {
      if (rejected) return;

      total += chunk.length;
      if (total > maxBytes) {
        rejected = true;
        const error = new Error('Upload too large.');
        error.statusCode = 413;
        reject(error);
        req.resume();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!rejected) resolve(Buffer.concat(chunks));
    });

    req.on('error', (error) => {
      if (!rejected) reject(error);
    });
  });
}

function extensionForContentType(contentType) {
  const lowerType = String(contentType || '').toLowerCase();
  if (lowerType.includes('audio/wav') || lowerType.includes('audio/x-wav') || lowerType.includes('audio/wave')) return '.wav';
  if (lowerType.includes('audio/webm')) return '.webm';
  if (lowerType.includes('audio/ogg')) return '.ogg';
  if (lowerType.includes('audio/mp4') || lowerType.includes('audio/m4a')) return '.m4a';
  if (lowerType.includes('audio/mpeg')) return '.mp3';
  return '.bin';
}

module.exports = {
  registerWhisperRoutes
};
