const assert = require('node:assert/strict');
const path = require('node:path');

const { findRelevantKnowledge, loadTeacherKnowledge } = require('../lib/knowledge/teacherKnowledge');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createQuestionAnswerService } = require('../lib/server/questionAnswerService');
const { registerProfileRoutes } = require('../routes/profileRoutes');
const { registerStudentRoutes } = require('../routes/studentRoutes');

const teacherFactsFile = path.join(__dirname, '..', 'knowledge', 'teacher_facts.json');

function createRouteHarness() {
  const handlers = new Map();
  const app = {
    get(route, handler) {
      handlers.set(`GET ${route}`, handler);
    },
    post(route, handler) {
      handlers.set(`POST ${route}`, handler);
    }
  };
  const studentSessions = Object.create(null);
  const questionAnswer = createQuestionAnswerService({
    teacherFactsFile,
    maxKnowledgeItems: 6,
    loadTeacherKnowledge,
    findRelevantKnowledge,
    routeStudentQuestion,
    ollama: {
      async stream() {
        throw new Error('AI fallback should not be used in student session tests.');
      },
      buildTeacherPrompt() {
        return '';
      }
    },
    logProblem() {},
    logStudentInteraction() {},
    initialTeacherKnowledge: loadTeacherKnowledge(teacherFactsFile)
  });

  registerProfileRoutes(app, {
    clearGoogleIdentity() {},
    completeGoogleConnect() {},
    createGoogleConnectUrl() {},
    disconnectGoogle() {},
    getAvailableProfileDates() {
      return { dates: [] };
    },
    getDailyQuestionSummary() {
      return {};
    },
    getStandardsSummaryReport() {
      return {};
    },
    getProfileStatus() {
      return {};
    },
    linkGoogleIdentity() {},
    port: 3000,
    sendDailySummaryEmail() {},
    studentSessions
  });

  registerStudentRoutes(app, {
    answerStudentMessage: questionAnswer.answerStudentMessage,
    getClassroomControls: () => ({
      studentCopyInspectLockEnabled: true,
      studentQuestionRateLimitEnabled: false,
      studentQuestionsPerMinute: 6
    }),
    logCompletedInteraction: questionAnswer.logCompletedInteraction,
    studentSessions
  });

  async function request(method, route, body = {}, query = {}) {
    const handler = handlers.get(`${method} ${route}`);
    assert.ok(handler, `Missing handler: ${method} ${route}`);

    const req = {
      body,
      query,
      protocol: 'http',
      get(name) {
        return name === 'host' ? 'localhost:3000' : '';
      }
    };
    const res = createResponse();
    await handler(req, res);
    return res;
  }

  return { request, studentSessions };
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
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    redirect(url) {
      this.body = { redirect: url };
      return this;
    }
  };
}

async function main() {
  const { request, studentSessions } = createRouteHarness();

  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;
  assert.ok(classSessionId, 'created student session should include sessionId');
  assert.ok(create.body.studentUrl.includes(`sessionId=${encodeURIComponent(classSessionId)}`));

  const joinA = await request('POST', '/api/student/join', {
    classSessionId,
    studentHubId: 'student-a'
  });
  assert.equal(joinA.statusCode, 200);
  assert.equal(joinA.body.classSessionId, classSessionId);

  let summary = await request('GET', '/api/profile/student-sessions');
  const activeSession = summary.body.sessions.find((session) => session.sessionId === classSessionId);
  assert.ok(activeSession, 'profile summary should include generated class session');
  assert.equal(activeSession.activeAnonymousHubCount, 1);
  assert.equal(activeSession.anonymousHubs[0].label, 'Anonymous Student 1');

  const massDefinition = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'what is mass'
  });
  assert.equal(massDefinition.statusCode, 200);
  assert.match(massDefinition.body.response, /Mass is the amount of matter/i);

  const massFollowUp = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'what are some formulas to solve for it'
  });
  assert.equal(massFollowUp.statusCode, 200);
  assert.match(massFollowUp.body.response, /You were asking about mass/i);
  assert.match(massFollowUp.body.response, /m = F \/ a/i);
  assert.match(massFollowUp.body.response, /mass = density × volume/i);
  assert.doesNotMatch(massFollowUp.body.response, /ionic/i);

  const volumeDefinition = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'what is volume'
  });
  assert.equal(volumeDefinition.statusCode, 200);
  assert.match(volumeDefinition.body.response, /Volume is the amount of space/i);
  assert.doesNotMatch(volumeDefinition.body.response, /Density tells how much mass is packed/i);

  const volumeFollowUp = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'how do I solve fro it'
  });
  assert.equal(volumeFollowUp.statusCode, 200);
  assert.match(volumeFollowUp.body.response, /You were asking about volume/i);
  assert.match(volumeFollowUp.body.response, /I read "fro" as "for."/i);
  assert.match(volumeFollowUp.body.response, /V = m \/ D/i);
  assert.match(volumeFollowUp.body.response, /V = l × w × h/i);
  assert.match(volumeFollowUp.body.response, /Water displacement/i);
  assert.doesNotMatch(volumeFollowUp.body.response, /Density tells how much mass is packed/i);

  const timeFormulas = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'what formulas have time'
  });
  assert.equal(timeFormulas.statusCode, 200);
  assert.match(timeFormulas.body.response, /Speed = distance \/ time/i);
  assert.match(timeFormulas.body.response, /Acceleration = change in velocity \/ time/i);
  assert.match(timeFormulas.body.response, /Power = work \/ time/i);

  const velocityFormulas = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'what formulas have velocity'
  });
  assert.equal(velocityFormulas.statusCode, 200);
  assert.match(velocityFormulas.body.response, /Acceleration = \(final velocity - initial velocity\) \/ time/i);
  assert.match(velocityFormulas.body.response, /Kinetic energy = 1\/2 × mass × velocity²/i);
  assert.match(velocityFormulas.body.response, /Momentum = mass × velocity/i);

  const studentBFollowUp = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-b',
    message: 'what are some formulas to solve for it'
  });
  assert.equal(studentBFollowUp.statusCode, 200);
  assert.equal(studentBFollowUp.body.routeType, 'student_context_clarification');
  assert.match(studentBFollowUp.body.response, /What topic do you mean/i);
  assert.doesNotMatch(studentBFollowUp.body.response, /mass/i);

  summary = await request('GET', '/api/profile/student-sessions');
  const updatedSession = summary.body.sessions.find((session) => session.classSessionId === classSessionId);
  assert.ok(updatedSession, 'profile summary should use same classSessionId as generated link');
  assert.equal(updatedSession.activeAnonymousHubCount, 2);
  assert.deepEqual(
    updatedSession.anonymousHubs.map((hub) => hub.label),
    ['Anonymous Student 1', 'Anonymous Student 2']
  );

  assert.equal(studentSessions[classSessionId].anonymousHubs['student-a'].messages.length, 6);
  assert.equal(studentSessions[classSessionId].anonymousHubs['student-b'].messages.length, 1);

  console.log('✅ student sessions: anonymous hubs, active count, and same-hub context are isolated');
}

main().catch((error) => {
  console.error('❌ student sessions');
  console.error(error);
  process.exit(1);
});
