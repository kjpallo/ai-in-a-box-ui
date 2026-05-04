const fs = require('fs');
const path = require('path');

async function buildSystemHealthReport({
  projectDir,
  port,
  tts,
  voicesDir,
  knowledgeDir,
  teacherFactsFile,
  getTeacherKnowledgeCount
}) {
  const checks = [];
  const addCheck = (id, label, status, message, details = {}) => {
    checks.push({ id, label, status, message, details });
  };

  const configuredOllamaGenerateUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
  const configuredOllamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';
  const ollamaTagsUrl = getOllamaTagsUrl(configuredOllamaGenerateUrl);

  const piperBackend = (process.env.PIPER_BACKEND || 'auto').toLowerCase();
  const piperAudioMode = tts.getEffectiveAudioMode();
  const piperBin = process.env.PIPER_BIN || path.join(projectDir, '.venv', 'bin', 'piper');
  const piperHttpUrl = process.env.PIPER_HTTP_URL || '';

  const logsDir = path.join(projectDir, 'logs');
  const problemLogPath = path.join(logsDir, 'problem_questions.json');
  const teacherKnowledgeCount = Number(getTeacherKnowledgeCount()) || 0;

  addCheck('node_server', 'Node server', 'green', 'Node/Express server is running.', {
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    port
  });

  addCheck(
    'working_directory',
    'Project folder',
    canRead(projectDir) ? 'green' : 'red',
    canRead(projectDir) ? 'Project folder is readable.' : 'Project folder is not readable.',
    {
      cwd: process.cwd(),
      projectDir
    }
  );

  try {
    const ollamaTags = await fetchJsonWithTimeout(ollamaTagsUrl, 1500);
    const models = Array.isArray(ollamaTags && ollamaTags.models) ? ollamaTags.models : [];
    const modelNames = models.map((model) => model.name || model.model).filter(Boolean);
    const foundModel = modelNames.includes(configuredOllamaModel);

    addCheck('ollama_reachable', 'Ollama', 'green', 'Ollama is reachable.', {
      url: ollamaTagsUrl
    });

    addCheck(
      'ollama_model_found',
      'Ollama model',
      foundModel ? 'green' : 'red',
      foundModel
        ? 'Model ' + configuredOllamaModel + ' is installed.'
        : 'Model ' + configuredOllamaModel + ' was not found in Ollama.',
      {
        configuredModel: configuredOllamaModel,
        availableModels: modelNames
      }
    );
  } catch (error) {
    addCheck('ollama_reachable', 'Ollama', 'red', 'Ollama is not reachable at ' + ollamaTagsUrl + '.', {
      error: error instanceof Error ? error.message : String(error)
    });

    addCheck('ollama_model_found', 'Ollama model', 'yellow', 'Could not check model because Ollama is not reachable.', {
      configuredModel: configuredOllamaModel
    });
  }

  addCheck(
    'piper_backend',
    'Piper backend',
    piperBackend ? 'green' : 'yellow',
    'Configured Piper backend: ' + (piperBackend || 'unknown') + '.',
    {
      requestedBackend: piperBackend,
      effectiveBackend: tts.getEffectiveTtsBackend(),
      audioMode: piperAudioMode
    }
  );

  addCheck(
    'piper_cli_found',
    'Piper CLI',
    fs.existsSync(piperBin) ? 'green' : 'red',
    fs.existsSync(piperBin) ? 'Piper CLI binary was found.' : 'Piper CLI binary was not found.',
    { piperBin }
  );

  if (piperHttpUrl) {
    const piperHealthUrl = getPiperHealthUrl(piperHttpUrl);

    try {
      const piperHealth = await fetchJsonWithTimeout(piperHealthUrl, 1500);
      addCheck('piper_http_reachable', 'Piper HTTP', 'green', 'Piper HTTP health endpoint is reachable.', {
        url: piperHealthUrl,
        response: piperHealth
      });
    } catch (error) {
      addCheck('piper_http_reachable', 'Piper HTTP', 'red', 'Piper HTTP is configured but not reachable at ' + piperHealthUrl + '.', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    addCheck('piper_http_reachable', 'Piper HTTP', 'yellow', 'Piper HTTP URL is not configured. This is okay if you are using Piper CLI.', {});
  }

  const voiceScan = scanVoicesDirectory(voicesDir);

  addCheck(
    'voices_dir',
    'Voices folder',
    voiceScan.dirExists ? 'green' : 'red',
    voiceScan.dirExists ? 'Voices folder exists.' : 'Voices folder is missing.',
    { voicesDir }
  );

  addCheck(
    'voice_onnx_found',
    'Voice .onnx file',
    voiceScan.onnxFiles.length > 0 ? 'green' : 'red',
    voiceScan.onnxFiles.length > 0 ? String(voiceScan.onnxFiles.length) + ' .onnx voice file(s) found.' : 'No .onnx voice files found.',
    { files: voiceScan.onnxFiles }
  );

  addCheck(
    'voice_json_found',
    'Voice .onnx.json file',
    voiceScan.missingJson.length === 0 && voiceScan.onnxFiles.length > 0 ? 'green' : 'red',
    voiceScan.missingJson.length === 0 && voiceScan.onnxFiles.length > 0
      ? 'Every .onnx voice has a matching .onnx.json file.'
      : 'One or more voice metadata files are missing.',
    { missingJson: voiceScan.missingJson }
  );

  addCheck(
    'knowledge_dir',
    'Knowledge folder',
    fs.existsSync(knowledgeDir) ? 'green' : 'yellow',
    fs.existsSync(knowledgeDir) ? 'Knowledge folder exists.' : 'Knowledge folder was not found.',
    { knowledgeDir }
  );

  addCheck(
    'teacher_facts',
    'Teacher facts file',
    fs.existsSync(teacherFactsFile) ? 'green' : 'yellow',
    fs.existsSync(teacherFactsFile) ? 'Teacher facts loaded: ' + teacherKnowledgeCount + ' item(s).' : 'Teacher facts file was not found.',
    {
      teacherFactsFile,
      knowledgeItems: teacherKnowledgeCount
    }
  );

  addCheck(
    'logs_dir',
    'Logs folder',
    fs.existsSync(logsDir) ? (canWrite(logsDir) ? 'green' : 'red') : 'yellow',
    fs.existsSync(logsDir) ? (canWrite(logsDir) ? 'Logs folder is writable.' : 'Logs folder is not writable.') : 'Logs folder does not exist yet.',
    { logsDir }
  );

  addCheck(
    'problem_log',
    'AI Improvement log',
    fs.existsSync(problemLogPath) ? (canRead(problemLogPath) && canWrite(problemLogPath) ? 'green' : 'red') : 'yellow',
    fs.existsSync(problemLogPath) ? 'Problem log file exists.' : 'Problem log file does not exist yet; it will be created when needed.',
    { problemLogPath }
  );

  const summary = checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  }, { green: 0, yellow: 0, red: 0 });

  return {
    ok: true,
    healthy: summary.red === 0,
    generatedAt: new Date().toISOString(),
    summary,
    config: {
      port,
      ollamaGenerateUrl: configuredOllamaGenerateUrl,
      ollamaTagsUrl,
      ollamaModel: configuredOllamaModel,
      piperBackend,
      effectiveTtsBackend: tts.getEffectiveTtsBackend(),
      piperAudioMode,
      piperBin,
      piperHttpUrl,
      voicesDir,
      knowledgeDir,
      teacherFactsFile
    },
    checks
  };
}

function scanVoicesDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return { dirExists: false, onnxFiles: [], missingJson: [] };
  }

  let files = [];
  try {
    files = fs.readdirSync(dirPath);
  } catch {
    return { dirExists: true, onnxFiles: [], missingJson: [] };
  }

  const onnxFiles = files.filter((file) => file.toLowerCase().endsWith('.onnx')).sort();
  const missingJson = onnxFiles.filter((file) => !fs.existsSync(path.join(dirPath, file + '.json')));

  return { dirExists: true, onnxFiles, missingJson };
}

function canRead(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function canWrite(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function getOllamaTagsUrl(generateUrl) {
  try {
    const url = new URL(generateUrl);
    url.pathname = '/api/tags';
    url.search = '';
    return url.toString();
  } catch {
    return 'http://127.0.0.1:11434/api/tags';
  }
}

function getPiperHealthUrl(piperHttpUrl) {
  try {
    const url = new URL(piperHttpUrl);
    url.pathname = '/health';
    url.search = '';
    return url.toString();
  } catch {
    return piperHttpUrl;
  }
}

module.exports = {
  buildSystemHealthReport
};
