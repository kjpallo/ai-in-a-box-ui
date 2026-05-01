const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', '..', 'logs');
const problemLogPath = path.join(logsDir, 'problem_questions.json');

function getProblems() {
  return readProblems();
}

function logProblem(problem = {}) {
  const now = new Date().toISOString();
  const problems = readProblems();
  const category = problem.category || 'needs_review';
  const reason = problem.reason || '';
  const duplicateIndex = findOpenDuplicateIndex(problems, problem.studentQuestion, category, reason);

  if (duplicateIndex >= 0) {
    const existing = problems[duplicateIndex];
    const entry = {
      ...existing,
      updatedAt: now,
      lastSeenAt: now,
      count: Number(existing.count || 1) + 1,
      answerGiven: problem.answerGiven || existing.answerGiven || '',
      routerType: problem.routerType || existing.routerType || '',
      formulaChosen: problem.formulaChosen || existing.formulaChosen || '',
      confidence: problem.confidence || existing.confidence || '',
      source: problem.source || existing.source || '',
      reason: reason || existing.reason || '',
      debug: hasDebug(problem.debug) ? problem.debug : existing.debug || {}
    };

    if (problem.expectedBehavior && !entry.expectedBehavior) {
      entry.expectedBehavior = problem.expectedBehavior;
    }

    if (problem.teacherNotes && !entry.teacherNotes) {
      entry.teacherNotes = problem.teacherNotes;
    }

    problems[duplicateIndex] = entry;
    writeProblems(problems);
    return entry;
  }

  const entry = {
    id: createProblemId(),
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
    count: Number(problem.count || 1),
    status: problem.status || 'open',
    category,
    studentQuestion: problem.studentQuestion || '',
    answerGiven: problem.answerGiven || '',
    routerType: problem.routerType || '',
    formulaChosen: problem.formulaChosen || '',
    confidence: problem.confidence || '',
    expectedBehavior: problem.expectedBehavior || '',
    teacherNotes: problem.teacherNotes || '',
    source: problem.source || '',
    reason,
    debug: problem.debug || {}
  };

  problems.push(entry);
  writeProblems(problems);
  return entry;
}

function updateProblem(id, changes = {}) {
  const problems = readProblems();
  const index = problems.findIndex((problem) => problem.id === id);
  if (index < 0) return null;

  const allowed = [
    'status',
    'category',
    'teacherNotes',
    'expectedBehavior',
    'answerGiven',
    'formulaChosen',
    'confidence',
    'source',
    'reason',
    'count',
    'lastSeenAt',
    'debug'
  ];
  const next = { ...problems[index] };

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(changes, key) && changes[key] !== undefined) {
      next[key] = changes[key];
    }
  }

  next.updatedAt = new Date().toISOString();
  problems[index] = next;
  writeProblems(problems);
  return next;
}

function readProblems() {
  ensureLogFile();

  try {
    const raw = fs.readFileSync(problemLogPath, 'utf8').trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeProblems(problems) {
  ensureLogFile();
  const tempPath = `${problemLogPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(problems, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, problemLogPath);
}

function ensureLogFile() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  if (!fs.existsSync(problemLogPath)) {
    fs.writeFileSync(problemLogPath, '[]\n', 'utf8');
  }
}

function createProblemId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const random = Math.random().toString(36).slice(2, 8);
  return `problem_${timestamp}_${random}`;
}

function findOpenDuplicateIndex(problems, studentQuestion, category, reason) {
  const normalizedQuestion = normalizeQuestion(studentQuestion);
  if (!normalizedQuestion) return -1;

  return problems.findIndex((problem) => {
    const status = problem.status || 'open';
    const open = status === 'open' || status === 'needs_review';
    if (!open) return false;

    return normalizeQuestion(problem.studentQuestion) === normalizedQuestion
      && (problem.category || 'needs_review') === category
      && (problem.reason || '') === reason;
  });
}

function normalizeQuestion(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function hasDebug(value) {
  if (!value) return false;
  if (typeof value === 'string') return Boolean(value.trim());
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

module.exports = {
  getProblems,
  logProblem,
  updateProblem
};
