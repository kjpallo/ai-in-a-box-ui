const assert = require('node:assert/strict');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');

const {
  createTeacherSessionStore,
  requireTeacherAuth
} = require('../lib/auth/teacherAuth');
const {
  DEFAULT_CLASSROOM_CONTROLS,
  getClassroomControls,
  updateClassroomControls
} = require('../lib/system/classroomControls');
const { registerClassroomControlsRoutes } = require('../routes/classroomControlsRoutes');
const { registerStudentRoutes } = require('../routes/studentRoutes');

async function main() {
  await testClassroomControlsStoreAndRoutes();
  await testStudentSafeControlsAndRateLimit();
  await testInvalidStudentControlsFallBackSafely();
  console.log('✅ classroom controls: defaults, auth, validation, safe public controls, and rate limits passed');
}

async function testClassroomControlsStoreAndRoutes() {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'classroom-controls-test-'));
  const controlsFile = path.join(tempDir, 'classroom_controls.json');

  try {
    assert.deepEqual(getClassroomControls(controlsFile), DEFAULT_CLASSROOM_CONTROLS);

    const handlers = new Map();
    registerClassroomControlsRoutes(createApp(handlers), {
      getClassroomControls: () => getClassroomControls(controlsFile),
      updateClassroomControls: (settings) => updateClassroomControls(settings, controlsFile)
    });

    const unauthenticated = await callMiddleware(requireTeacherAuth(createTeacherSessionStore()));
    assert.equal(unauthenticated.statusCode, 401);

    const invalid = await request(handlers, 'POST', '/api/classroom-controls', {
      studentQuestionsPerMinute: 0
    });
    assert.equal(invalid.statusCode, 400);
    assert.match(invalid.body.error, /1 to 30/);

    const extraField = await request(handlers, 'POST', '/api/classroom-controls', {
      studentQuestionsPerMinute: 6,
      secret: 'nope'
    });
    assert.equal(extraField.statusCode, 400);

    const updated = await request(handlers, 'POST', '/api/classroom-controls', {
      studentCopyInspectLockEnabled: false,
      studentQuestionRateLimitEnabled: true,
      studentQuestionsPerMinute: 2
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.controls.studentCopyInspectLockEnabled, false);
    assert.equal(updated.body.controls.studentQuestionRateLimitEnabled, true);
    assert.equal(updated.body.controls.studentQuestionsPerMinute, 2);

    const saved = getClassroomControls(controlsFile);
    assert.equal(saved.studentQuestionRateLimitEnabled, true);
    assert.equal(saved.studentQuestionsPerMinute, 2);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function testStudentSafeControlsAndRateLimit() {
  const handlers = new Map();
  const studentSessions = {
    classA: {
      sessionId: 'classA',
      messages: [],
      anonymousHubs: Object.create(null)
    },
    classB: {
      sessionId: 'classB',
      messages: [],
      anonymousHubs: Object.create(null)
    }
  };
  const controls = {
    studentCopyInspectLockEnabled: true,
    studentQuestionRateLimitEnabled: true,
    studentQuestionsPerMinute: 2,
    teacherOnlySecret: 'must-not-leak'
  };

  registerStudentRoutes(createApp(handlers), {
    answerStudentMessage: async () => ({
      response: 'Test answer',
      routeType: 'definition',
      confidence: 'high',
      standardId: ''
    }),
    getClassroomControls: () => controls,
    logCompletedInteraction() {},
    studentSessions
  });

  const publicControls = await request(handlers, 'GET', '/api/student/controls');
  assert.equal(publicControls.statusCode, 200);
  assert.equal(publicControls.body.studentCopyInspectLockEnabled, true);
  assert.equal(publicControls.body.teacherOnlySecret, undefined);

  const initialStatus = await getRateLimitStatus(handlers, 'classA', 'student-a');
  assert.equal(initialStatus.statusCode, 200);
  assert.deepEqual(Object.keys(initialStatus.body).sort(), ['rateLimit']);
  assert.equal(initialStatus.body.rateLimit.enabled, true);
  assert.equal(initialStatus.body.rateLimit.limit, 2);
  assert.equal(initialStatus.body.rateLimit.remaining, 2);
  assert.equal(initialStatus.body.rateLimit.windowSeconds, 60);
  assert.equal(initialStatus.body.teacherOnlySecret, undefined);

  const firstA = await sendStudentMessage(handlers, 'classA', 'student-a');
  assert.equal(firstA.statusCode, 200);
  assert.equal(firstA.body.rateLimit.enabled, true);
  assert.equal(firstA.body.rateLimit.limit, 2);
  assert.equal(firstA.body.rateLimit.remaining, 1);

  const secondA = await sendStudentMessage(handlers, 'classA', 'student-a');
  assert.equal(secondA.statusCode, 200);
  assert.equal(secondA.body.rateLimit.remaining, 0);

  const blockedA = await sendStudentMessage(handlers, 'classA', 'student-a');
  assert.equal(blockedA.statusCode, 429);
  assert.match(blockedA.body.error, /Slow down a little/);
  assert.equal(blockedA.body.rateLimit.enabled, true);
  assert.equal(blockedA.body.rateLimit.limit, 2);
  assert.equal(blockedA.body.rateLimit.remaining, 0);
  assert.ok(blockedA.body.rateLimit.resetInSeconds > 0);

  const blockedStatus = await getRateLimitStatus(handlers, 'classA', 'student-a');
  assert.equal(blockedStatus.body.rateLimit.remaining, 0);

  const studentB = await sendStudentMessage(handlers, 'classA', 'student-b');
  assert.equal(studentB.statusCode, 200);
  assert.equal(studentB.body.rateLimit.remaining, 1);

  const studentBStatus = await getRateLimitStatus(handlers, 'classA', 'student-b');
  assert.equal(studentBStatus.body.rateLimit.remaining, 1);
  assert.equal(studentBStatus.body.rateLimit.limit, 2);

  const sameStudentDifferentClass = await sendStudentMessage(handlers, 'classB', 'student-a');
  assert.equal(sameStudentDifferentClass.statusCode, 200);
  assert.equal(sameStudentDifferentClass.body.rateLimit.remaining, 1);

  controls.studentQuestionsPerMinute = 6;
  const updatedLimitStatus = await getRateLimitStatus(handlers, 'classA', 'student-a');
  assert.equal(updatedLimitStatus.statusCode, 200);
  assert.equal(updatedLimitStatus.body.rateLimit.limit, 6);
  assert.equal(updatedLimitStatus.body.rateLimit.remaining, 4);

  controls.studentQuestionRateLimitEnabled = false;
  const offStatus = await getRateLimitStatus(handlers, 'classA', 'student-a');
  assert.equal(offStatus.statusCode, 200);
  assert.equal(offStatus.body.rateLimit.enabled, false);
  assert.equal(offStatus.body.rateLimit.limit, 6);

  const unlimited = await sendStudentMessage(handlers, 'classA', 'student-a');
  assert.equal(unlimited.statusCode, 200);
  assert.equal(unlimited.body.rateLimit.enabled, false);
}

async function testInvalidStudentControlsFallBackSafely() {
  const handlers = new Map();
  const studentSessions = {
    classA: {
      sessionId: 'classA',
      messages: [],
      anonymousHubs: Object.create(null)
    }
  };
  let controls = {
    studentCopyInspectLockEnabled: 'not-a-boolean',
    studentQuestionRateLimitEnabled: 'not-a-boolean',
    studentQuestionsPerMinute: 'not-a-number'
  };

  registerStudentRoutes(createApp(handlers), {
    answerStudentMessage: async () => ({
      response: 'Test answer',
      routeType: 'definition',
      confidence: 'high',
      standardId: ''
    }),
    getClassroomControls: () => controls,
    logCompletedInteraction() {},
    studentSessions
  });

  const publicControls = await request(handlers, 'GET', '/api/student/controls');
  assert.equal(publicControls.statusCode, 200);
  assert.equal(publicControls.body.studentCopyInspectLockEnabled, true);
  assert.equal(publicControls.body.studentQuestionRateLimitEnabled, true);
  assert.equal(publicControls.body.studentQuestionsPerMinute, 6);

  for (let index = 0; index < 6; index += 1) {
    const allowed = await sendStudentMessage(handlers, 'classA', 'student-a');
    assert.equal(allowed.statusCode, 200);
  }

  const blocked = await sendStudentMessage(handlers, 'classA', 'student-a');
  assert.equal(blocked.statusCode, 429);

  controls = {};
  const fallbackControls = await request(handlers, 'GET', '/api/student/controls');
  assert.equal(fallbackControls.statusCode, 200);
  assert.equal(fallbackControls.body.studentQuestionsPerMinute, 6);
}

function createApp(handlers) {
  return {
    get(route, handler) {
      handlers.set(`GET ${route}`, handler);
    },
    post(route, handler) {
      handlers.set(`POST ${route}`, handler);
    }
  };
}

async function sendStudentMessage(handlers, classSessionId, studentHubId) {
  return request(handlers, 'POST', '/api/student/message', {
    classSessionId,
    studentHubId,
    message: 'what is mass'
  });
}

async function getRateLimitStatus(handlers, classSessionId, studentHubId) {
  return request(handlers, 'GET', '/api/student/rate-limit-status', {}, {
    classSessionId,
    sessionId: classSessionId,
    studentHubId
  });
}

async function request(handlers, method, route, body = {}, query = {}) {
  const handler = handlers.get(`${method} ${route}`);
  assert.ok(handler, `Missing handler: ${method} ${route}`);

  const req = { body, query, headers: {} };
  const res = createResponse();
  await handler(req, res);
  return res;
}

async function callMiddleware(middleware) {
  const req = { headers: {} };
  const res = createResponse();
  await middleware(req, res, () => {
    res.nextCalled = true;
  });
  return res;
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

main().catch((error) => {
  console.error('❌ classroom controls');
  console.error(error);
  process.exit(1);
});
