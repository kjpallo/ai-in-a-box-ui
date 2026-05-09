const assert = require('node:assert/strict');
const path = require('node:path');

const { findRelevantKnowledge, loadTeacherKnowledge } = require('../lib/knowledge/teacherKnowledge');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createQuestionAnswerService } = require('../lib/server/questionAnswerService');
const { registerProfileRoutes } = require('../routes/profileRoutes');
const { registerStudentRoutes } = require('../routes/studentRoutes');

const teacherFactsFile = path.join(__dirname, '..', 'knowledge', 'teacher_facts.json');

function createRouteHarness(options = {}) {
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
  const classroomControls = {
    studentCopyInspectLockEnabled: true,
    studentGuidedFormulaTutoringEnabled: options.studentGuidedFormulaTutoringEnabled !== false,
    studentQuestionRateLimitEnabled: options.studentQuestionRateLimitEnabled === true,
    studentQuestionsPerMinute: options.studentQuestionsPerMinute || 6
  };
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
    getClassroomControls: () => classroomControls,
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

  return { request, questionAnswer, studentSessions, classroomControls };
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
  const { request, questionAnswer, studentSessions } = createRouteHarness();

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

  const forceQuestion = 'What is the force if mass is 10 kg and acceleration is 3 m/s²?';
  const teacherDirect = await questionAnswer.answerStudentMessage(forceQuestion);
  assert.match(teacherDirect.response, /F = 30 N/i);

  const forceTutorStart = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: forceQuestion
  });
  assert.equal(forceTutorStart.statusCode, 200);
  assert.equal(forceTutorStart.body.routeType, 'formula_tutor');
  assert.doesNotMatch(forceTutorStart.body.response, /F = 30 N/i);
  assert.match(forceTutorStart.body.response, /Which formula should we use\?/i);
  assert.ok(studentSessions[classSessionId].anonymousHubs['student-a'].currentTutorProblem);
  assert.equal(studentSessions[classSessionId].anonymousHubs['student-b'].currentTutorProblem, null);

  const forceFormula = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: '1'
  });
  assert.equal(forceFormula.statusCode, 200);
  assert.match(forceFormula.body.response, /mass/i);

  const forceMass = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: '10 kg'
  });
  assert.equal(forceMass.statusCode, 200);
  assert.match(forceMass.body.response, /acceleration/i);

  const forceAcceleration = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: '3 m/s²'
  });
  assert.equal(forceAcceleration.statusCode, 200);
  assert.match(forceAcceleration.body.response, /What is 10 × 3\?/i);

  const forceCalculation = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: '30'
  });
  assert.equal(forceCalculation.statusCode, 200);
  assert.match(forceCalculation.body.response, /Correct/i);
  assert.match(forceCalculation.body.response, /30 N/i);
  assert.equal(studentSessions[classSessionId].anonymousHubs['student-a'].currentTutorProblem, null);

  summary = await request('GET', '/api/profile/student-sessions');
  const updatedSession = summary.body.sessions.find((session) => session.classSessionId === classSessionId);
  assert.ok(updatedSession, 'profile summary should use same classSessionId as generated link');
  assert.equal(updatedSession.activeAnonymousHubCount, 2);
  assert.deepEqual(
    updatedSession.anonymousHubs.map((hub) => hub.label),
    ['Anonymous Student 1', 'Anonymous Student 2']
  );

  assert.equal(studentSessions[classSessionId].anonymousHubs['student-a'].messages.length, 11);
  assert.equal(studentSessions[classSessionId].anonymousHubs['student-b'].messages.length, 1);

  await testFormulaTutorBypassesQuestionEnergy();
  await testGuidedFormulaTutorDisabled();
  await testActiveFormulaTutorStopsWhenDisabled();
  await testExpandedFormulaTutorFlows();
  await testExpandedFormulaTutorIsolation();

  console.log('✅ student sessions: anonymous hubs, same-hub context, and formula tutoring are isolated');
}

async function testExpandedFormulaTutorFlows() {
  await runGuidedFormulaFlow({
    name: 'density',
    question: 'A rock has a mass of 180 g and a volume of 30 mL. What is its density?',
    finalAnswer: '6 g/mL',
    formulaId: 'density_mass_volume',
    steps: [
      { message: '1', match: /mass/i },
      { message: '180 g', match: /volume/i },
      { message: '30 mL', match: /What is 180 \/ 30\?/i },
      { message: '6', match: /6 g\/mL/i }
    ]
  });

  await runGuidedFormulaFlow({
    name: 'speed',
    question: 'A car travels 72 meters in 12 seconds. What is its speed?',
    finalAnswer: '6 m/s',
    formulaId: 'speed_distance_time',
    steps: [
      { message: '1', match: /distance/i },
      { message: '72 m', match: /time/i },
      { message: '12 s', match: /What is 72 \/ 12\?/i },
      { message: '6', match: /6 m\/s/i }
    ]
  });

  await runGuidedFormulaFlow({
    name: 'voltage',
    question: 'A circuit has a current of 2 A and a resistance of 5 ohms. What is the voltage?',
    finalAnswer: '10 V',
    formulaId: 'voltage_current_resistance',
    steps: [
      { message: '1', match: /current/i },
      { message: '2 A', match: /resistance/i },
      { message: '5 ohms', match: /What is 2 × 5\?/i },
      { message: '10', match: /10 V/i }
    ]
  });

  await testExpandedFormulaTutorEnergyBypass();
}

async function runGuidedFormulaFlow({ name, question, finalAnswer, formulaId, steps }) {
  const { request, questionAnswer, studentSessions } = createRouteHarness();

  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  const teacherDirect = await questionAnswer.answerStudentMessage(question);
  assert.match(teacherDirect.response, new RegExp(escapeRegExp(finalAnswer), 'i'));

  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: `${name}-student`,
    message: question
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'formula_tutor');
  assert.equal(start.body.tutor.formulaId, formulaId);
  assert.equal(start.body.tutor.active, true);
  assert.doesNotMatch(start.body.response, new RegExp(escapeRegExp(finalAnswer), 'i'));
  assert.match(start.body.response, /Which formula should we use\?/i);
  assert.ok(!start.body.tutor.finalAnswerDisplay);

  let response = start;
  for (const [index, step] of steps.entries()) {
    response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `${name}-student`,
      message: step.message
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body.response, step.match);

    if (index < steps.length - 1) {
      assert.equal(response.body.tutor.active, true);
      assert.ok(!response.body.tutor.finalAnswerDisplay);
    }
  }

  assert.equal(response.body.tutor.active, false);
  assert.equal(response.body.tutor.completed, true);
  assert.equal(response.body.tutor.finalAnswerDisplay, finalAnswer);
  assert.equal(studentSessions[classSessionId].anonymousHubs[`${name}-student`].currentTutorProblem, null);
}

async function testExpandedFormulaTutorEnergyBypass() {
  const { request } = createRouteHarness({
    studentQuestionRateLimitEnabled: true,
    studentQuestionsPerMinute: 1
  });

  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  const normalQuestion = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'What is mass?'
  });
  assert.equal(normalQuestion.statusCode, 200);
  assert.equal(normalQuestion.body.rateLimit.remainingWhole, 0);

  const tutorScenarios = [
    {
      question: 'A rock has a mass of 180 g and a volume of 30 mL. What is its density?',
      answers: ['1', '180 g', '30 mL', '6']
    },
    {
      question: 'A car travels 72 meters in 12 seconds. What is its speed?',
      answers: ['1', '72 m', '12 s', '6']
    },
    {
      question: 'A circuit has a current of 2 A and a resistance of 5 ohms. What is the voltage?',
      answers: ['1', '2 A', '5 ohms', '10']
    }
  ];

  for (const [index, scenario] of tutorScenarios.entries()) {
    const studentHubId = index === 0 ? 'student-a' : `student-${index + 1}`;
    const expectedRemaining = index === 0 ? 0 : 1;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: scenario.question
    });
    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'formula_tutor');
    assert.equal(start.body.rateLimit.remainingWhole, expectedRemaining);

    for (const answer of scenario.answers) {
      const step = await request('POST', '/api/student/message', {
        sessionId: classSessionId,
        studentHubId,
        message: answer
      });
      assert.equal(step.statusCode, 200);
      assert.equal(step.body.rateLimit.remainingWhole, expectedRemaining);
    }
  }

  const blockedNormal = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'What is volume?'
  });
  assert.equal(blockedNormal.statusCode, 429);
}

async function testExpandedFormulaTutorIsolation() {
  const { request, studentSessions } = createRouteHarness();

  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  const densityStart = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'A rock has a mass of 180 g and a volume of 30 mL. What is its density?'
  });
  assert.equal(densityStart.statusCode, 200);
  assert.equal(densityStart.body.tutor.formulaId, 'density_mass_volume');

  const speedStart = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-b',
    message: 'A car travels 72 meters in 12 seconds. What is its speed?'
  });
  assert.equal(speedStart.statusCode, 200);
  assert.equal(speedStart.body.tutor.formulaId, 'speed_distance_time');

  assert.equal(
    studentSessions[classSessionId].anonymousHubs['student-a'].currentTutorProblem.formulaId,
    'density_mass_volume'
  );
  assert.equal(
    studentSessions[classSessionId].anonymousHubs['student-b'].currentTutorProblem.formulaId,
    'speed_distance_time'
  );
}

async function testFormulaTutorBypassesQuestionEnergy() {
  const { request, questionAnswer, studentSessions } = createRouteHarness({
    studentQuestionRateLimitEnabled: true,
    studentQuestionsPerMinute: 1
  });

  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  const normalQuestion = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'What is mass?'
  });
  assert.equal(normalQuestion.statusCode, 200);
  assert.equal(normalQuestion.body.rateLimit.remainingWhole, 0);

  const forceQuestion = 'A box has a mass of 10 kg and accelerates at 3 m/s². What force is needed?';
  const teacherDirect = await questionAnswer.answerStudentMessage(forceQuestion);
  assert.match(teacherDirect.response, /F = 30 N/i);

  const forceTutorStart = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: forceQuestion
  });
  assert.equal(forceTutorStart.statusCode, 200);
  assert.equal(forceTutorStart.body.routeType, 'formula_tutor');
  assert.equal(forceTutorStart.body.rateLimit.remainingWhole, 0);
  assert.equal(forceTutorStart.body.tutor.active, true);
  assert.equal(forceTutorStart.body.tutor.currentStepIndex, 0);
  assert.doesNotMatch(forceTutorStart.body.response, /30 N/i);
  assert.ok(studentSessions[classSessionId].anonymousHubs['student-a'].currentTutorProblem);

  const chooseFormula = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: '1'
  });
  assert.equal(chooseFormula.statusCode, 200);
  assert.equal(chooseFormula.body.rateLimit.remainingWhole, 0);
  assert.equal(chooseFormula.body.tutor.currentStepIndex, 1);
  assert.deepEqual(chooseFormula.body.tutor.knownValues, []);

  const mass = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: '10 kg'
  });
  assert.equal(mass.statusCode, 200);
  assert.equal(mass.body.rateLimit.remainingWhole, 0);
  assert.deepEqual(mass.body.tutor.knownValues, [
    { label: 'mass', symbol: 'm', display: '10 kg' }
  ]);

  const acceleration = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: '3 m/s²'
  });
  assert.equal(acceleration.statusCode, 200);
  assert.equal(acceleration.body.rateLimit.remainingWhole, 0);
  assert.deepEqual(acceleration.body.tutor.knownValues, [
    { label: 'mass', symbol: 'm', display: '10 kg' },
    { label: 'acceleration', symbol: 'a', display: '3 m/s²' }
  ]);

  const finalStep = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: '30'
  });
  assert.equal(finalStep.statusCode, 200);
  assert.equal(finalStep.body.rateLimit.remainingWhole, 0);
  assert.equal(finalStep.body.tutor.active, false);
  assert.equal(finalStep.body.tutor.completed, true);
  assert.equal(finalStep.body.tutor.finalAnswerDisplay, '30 N');

  const blockedNormal = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'What is volume?'
  });
  assert.equal(blockedNormal.statusCode, 429);
  assert.equal(blockedNormal.body.code, 'student_rate_limited');

  const studentBNormal = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-b',
    message: 'What is mass?'
  });
  assert.equal(studentBNormal.statusCode, 200);
  assert.equal(studentBNormal.body.rateLimit.remainingWhole, 0);
  assert.equal(studentSessions[classSessionId].anonymousHubs['student-b'].currentTutorProblem, null);
}

async function testGuidedFormulaTutorDisabled() {
  const { request, questionAnswer, studentSessions } = createRouteHarness({
    studentGuidedFormulaTutoringEnabled: false,
    studentQuestionRateLimitEnabled: true,
    studentQuestionsPerMinute: 2
  });

  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;
  const forceQuestion = 'A box has a mass of 10 kg and accelerates at 3 m/s². What force is needed?';

  const teacherDirect = await questionAnswer.answerStudentMessage(forceQuestion);
  assert.match(teacherDirect.response, /F = 30 N/i);

  const disabledFormula = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: forceQuestion
  });
  assert.equal(disabledFormula.statusCode, 200);
  assert.notEqual(disabledFormula.body.routeType, 'formula_tutor');
  assert.match(disabledFormula.body.response, /F = 30 N/i);
  assert.equal(disabledFormula.body.tutor, undefined);
  assert.equal(disabledFormula.body.rateLimit.remainingWhole, 1);
  assert.equal(studentSessions[classSessionId].anonymousHubs['student-a'].currentTutorProblem, null);

  const normalQuestion = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: 'What is mass?'
  });
  assert.equal(normalQuestion.statusCode, 200);
  assert.equal(normalQuestion.body.rateLimit.remainingWhole, 0);
}

async function testActiveFormulaTutorStopsWhenDisabled() {
  const { request, studentSessions, classroomControls } = createRouteHarness();

  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;
  const forceQuestion = 'A box has a mass of 10 kg and accelerates at 3 m/s². What force is needed?';

  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: forceQuestion
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'formula_tutor');
  assert.ok(studentSessions[classSessionId].anonymousHubs['student-a'].currentTutorProblem);

  classroomControls.studentGuidedFormulaTutoringEnabled = false;

  const stopped = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: '1'
  });
  assert.equal(stopped.statusCode, 200);
  assert.equal(stopped.body.routeType, 'formula_tutor');
  assert.match(stopped.body.response, /Guided formula tutoring is turned off right now/i);
  assert.equal(stopped.body.tutor, null);
  assert.equal(studentSessions[classSessionId].anonymousHubs['student-a'].currentTutorProblem, null);

  const normalFormula = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'student-a',
    message: forceQuestion
  });
  assert.equal(normalFormula.statusCode, 200);
  assert.notEqual(normalFormula.body.routeType, 'formula_tutor');
  assert.match(normalFormula.body.response, /F = 30 N/i);
  assert.equal(studentSessions[classSessionId].anonymousHubs['student-a'].currentTutorProblem, null);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error('❌ student sessions');
  console.error(error);
  process.exit(1);
});
