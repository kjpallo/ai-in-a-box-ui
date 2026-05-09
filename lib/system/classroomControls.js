const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const DEFAULT_CLASSROOM_CONTROLS_FILE = path.join(__dirname, '..', '..', 'logs', 'classroom_controls.json');
const DEFAULT_CLASSROOM_CONTROLS = Object.freeze({
  studentCopyInspectLockEnabled: true,
  studentQuestionRateLimitEnabled: true,
  studentQuestionsPerMinute: 6
});

function getClassroomControls(controlsFile = DEFAULT_CLASSROOM_CONTROLS_FILE) {
  const stored = readControlsFile(controlsFile);
  try {
    return sanitizeClassroomControls(stored);
  } catch {
    return { ...DEFAULT_CLASSROOM_CONTROLS };
  }
}

async function updateClassroomControls(partialSettings = {}, controlsFile = DEFAULT_CLASSROOM_CONTROLS_FILE) {
  const next = sanitizeClassroomControls(partialSettings, { allowPartial: true, rejectUnknown: true });
  const controls = {
    ...getClassroomControls(controlsFile),
    ...next
  };

  await fsp.mkdir(path.dirname(controlsFile), { recursive: true });
  await fsp.writeFile(controlsFile, `${JSON.stringify(controls, null, 2)}\n`, 'utf8');
  return controls;
}

function sanitizeClassroomControls(value = {}, options = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const allowedKeys = Object.keys(DEFAULT_CLASSROOM_CONTROLS);
  const controls = options.allowPartial ? {} : { ...DEFAULT_CLASSROOM_CONTROLS };

  if (options.rejectUnknown) {
    const unknown = Object.keys(source).filter((key) => !allowedKeys.includes(key));
    if (unknown.length) {
      const error = new Error(`Unsupported classroom control setting: ${unknown[0]}`);
      error.statusCode = 400;
      throw error;
    }
  }

  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

    if (key === 'studentQuestionsPerMinute') {
      controls[key] = validateQuestionsPerMinute(source[key]);
    } else {
      controls[key] = validateBoolean(source[key], key);
    }
  }

  return options.allowPartial ? controls : { ...DEFAULT_CLASSROOM_CONTROLS, ...controls };
}

function validateQuestionsPerMinute(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 30) {
    const error = new Error('Questions per minute must be a whole number from 1 to 30.');
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function validateBoolean(value, key) {
  if (typeof value !== 'boolean') {
    const error = new Error(`${key} must be true or false.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function readControlsFile(controlsFile) {
  try {
    if (!fs.existsSync(controlsFile)) return {};
    return JSON.parse(fs.readFileSync(controlsFile, 'utf8'));
  } catch {
    return {};
  }
}

module.exports = {
  DEFAULT_CLASSROOM_CONTROLS,
  DEFAULT_CLASSROOM_CONTROLS_FILE,
  getClassroomControls,
  sanitizeClassroomControls,
  updateClassroomControls
};
