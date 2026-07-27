const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

const {
  createStudentRouteHarness
} = require('./test-helpers/studentRouteHarness');

const HUB_COUNT = 35;

async function main() {
  await testIndependentAnswersAndContext();
  await testTutorFlashcardAndClarificationIsolation();
  await testRateLimitIsolation();
  await testClassWideAnonymousActivityAndCapacity();
  const performanceReport = await testThirtyFiveHubConcurrency();

  console.log('Multi-student isolation and classroom capacity checks passed.');
  console.log(`MULTI_STUDENT_PERFORMANCE ${JSON.stringify(performanceReport)}`);
}

async function testIndependentAnswersAndContext() {
  const harness = createStudentRouteHarness({ studentGuidedFormulaTutoringEnabled: false });
  const created = await harness.request('POST', '/api/profile/create-student-session');
  const sessionId = created.body.sessionId;
  const joinCode = created.body.joinCode;

  const [studentA, studentB] = await Promise.all([
    harness.request('POST', '/api/student/message', {
      joinCode,
      studentHubId: 'independent-student-a',
      message: 'What is mass?'
    }),
    harness.request('POST', '/api/student/message', {
      joinCode,
      studentHubId: 'independent-student-b',
      message: 'What is volume?'
    })
  ]);

  assert.equal(studentA.statusCode, 200);
  assert.equal(studentB.statusCode, 200);
  assert.match(studentA.body.response, /Mass is the amount of matter/i);
  assert.doesNotMatch(studentA.body.response, /Volume is the amount of space/i);
  assert.match(studentB.body.response, /Volume is the amount of space/i);
  assert.doesNotMatch(studentB.body.response, /Mass is the amount of matter/i);

  const followUpA = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'independent-student-a',
    message: 'What are some formulas to solve for it?'
  });
  const followUpB = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'independent-student-b',
    message: 'What are some formulas to solve for it?'
  });

  assert.match(followUpA.body.response, /You were asking about mass/i);
  assert.match(followUpA.body.response, /m = F \/ a/i);
  assert.match(followUpB.body.response, /You were asking about volume/i);
  assert.match(followUpB.body.response, /V = m \/ D/i);
  assert.doesNotMatch(followUpB.body.response, /You were asking about mass/i);

  const session = harness.studentSessions[sessionId];
  assert.deepEqual(
    session.anonymousHubs['independent-student-a'].messages.map((entry) => entry.message),
    ['What is mass?', 'What are some formulas to solve for it?']
  );
  assert.deepEqual(
    session.anonymousHubs['independent-student-b'].messages.map((entry) => entry.message),
    ['What is volume?', 'What are some formulas to solve for it?']
  );
}

async function testTutorFlashcardAndClarificationIsolation() {
  const harness = createStudentRouteHarness();
  const created = await harness.request('POST', '/api/profile/create-student-session');
  const sessionId = created.body.sessionId;
  const joinCode = created.body.joinCode;

  const formulaStart = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'formula-student-a',
    message: 'What is the force if mass is 10 kg and acceleration is 3 m/s²?'
  });
  assert.equal(formulaStart.body.routeType, 'formula_tutor');
  const formulaStudentB = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'formula-student-b',
    message: 'force'
  });
  assert.notEqual(formulaStudentB.body.routeType, 'formula_tutor');
  assert.ok(harness.studentSessions[sessionId].anonymousHubs['formula-student-a'].currentTutorProblem);
  assert.equal(harness.studentSessions[sessionId].anonymousHubs['formula-student-b'].currentTutorProblem, null);
  assert.equal(JSON.stringify(formulaStudentB.body).includes('10 kg'), false);

  const conceptStart = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'concept-student-a',
    message: 'Which model has electrons in fixed orbits?'
  });
  assert.equal(conceptStart.body.routeType, 'concept_tutor');
  const conceptStudentB = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'concept-student-b',
    message: '1'
  });
  assert.notEqual(conceptStudentB.body.routeType, 'concept_tutor');
  assert.ok(harness.studentSessions[sessionId].anonymousHubs['concept-student-a'].currentTutorProblem);
  assert.equal(harness.studentSessions[sessionId].anonymousHubs['concept-student-b'].currentTutorProblem, null);

  const flashcardStart = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'flashcard-student-a',
    message: 'start flashcards for types of friction'
  });
  assert.equal(flashcardStart.body.routeType, 'flashcard_session');
  const flashcardStudentB = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'flashcard-student-b',
    message: 'show'
  });
  assert.notEqual(flashcardStudentB.body.routeType, 'flashcard_session');
  assert.ok(harness.studentSessions[sessionId].anonymousHubs['flashcard-student-a'].currentFlashcardSession);
  assert.equal(harness.studentSessions[sessionId].anonymousHubs['flashcard-student-b'].currentFlashcardSession, null);

  const clarificationA = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'clarification-student-a',
    message: 'What does V mean?'
  });
  assert.equal(clarificationA.statusCode, 200);
  const pendingA = harness.studentSessions[sessionId].anonymousHubs['clarification-student-a'].pendingClarification;
  assert.ok(pendingA, 'Student A should have a pending clarification');

  const clarificationB = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'clarification-student-b',
    message: '1'
  });
  assert.equal(clarificationB.statusCode, 200);
  assert.equal(harness.studentSessions[sessionId].anonymousHubs['clarification-student-b'].pendingClarification, null);
  assert.doesNotMatch(clarificationB.body.response, /density|electricity/i);
}

async function testRateLimitIsolation() {
  const harness = createStudentRouteHarness({
    studentGuidedFormulaTutoringEnabled: false,
    studentQuestionRateLimitEnabled: true,
    studentQuestionsPerMinute: 1,
    rateLimitClock: () => 0
  });
  const created = await harness.request('POST', '/api/profile/create-student-session');
  const joinCode = created.body.joinCode;

  const firstA = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'rate-student-a',
    message: 'What is mass?'
  });
  const blockedA = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'rate-student-a',
    message: 'What is volume?'
  });
  const firstB = await harness.request('POST', '/api/student/message', {
    joinCode,
    studentHubId: 'rate-student-b',
    message: 'What is volume?'
  });

  assert.equal(firstA.statusCode, 200);
  assert.equal(blockedA.statusCode, 429);
  assert.equal(firstB.statusCode, 200);
  assert.equal(firstB.body.rateLimit.remainingWhole, 0);
}

async function testClassWideAnonymousActivityAndCapacity() {
  const harness = createStudentRouteHarness();
  const created = await harness.request('POST', '/api/profile/create-student-session');
  const joinCode = created.body.joinCode;

  const joins = await Promise.all(Array.from({ length: HUB_COUNT }, (_, index) => {
    return harness.request('POST', '/api/student/join', {
      joinCode,
      studentHubId: `capacity-hub-${String(index).padStart(2, '0')}`
    });
  }));

  joins.forEach((response) => {
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.sessionId, undefined);
    assert.equal(response.body.classSessionId, undefined);
    assert.equal(JSON.stringify(response.body).includes('capacity-hub-'), false);
  });

  const activity = await harness.request('GET', '/api/profile/live-student-activity');
  assert.equal(activity.statusCode, 200);
  assert.equal(activity.body.sessions.length, 1);
  assert.equal(activity.body.sessions[0].anonymousHubCount, HUB_COUNT);
  assert.equal(activity.body.sessions[0].anonymousHubs.length, HUB_COUNT);
  assert.deepEqual(
    activity.body.sessions[0].anonymousHubs
      .map((hub) => hub.displayName)
      .sort((left, right) => Number(left.match(/\d+/)?.[0]) - Number(right.match(/\d+/)?.[0])),
    Array.from({ length: HUB_COUNT }, (_, index) => `Anonymous Student ${index + 1}`)
  );
}

async function testThirtyFiveHubConcurrency() {
  const harness = createStudentRouteHarness({
    studentGuidedFormulaTutoringEnabled: false,
    studentQuestionRateLimitEnabled: false
  });
  const created = await harness.request('POST', '/api/profile/create-student-session');
  const sessionId = created.body.sessionId;
  const joinCode = created.body.joinCode;
  const startedAt = performance.now();

  const requests = Array.from({ length: HUB_COUNT }, (_, index) => {
    const distance = 100 + (index * 2);
    return {
      hubId: `concurrent-hub-${String(index).padStart(2, '0')}`,
      question: `A car travels ${distance} meters in 2 seconds. What is its speed?`,
      expectedAnswer: `speed = ${50 + index} m/s`
    };
  });
  const timedResponses = await Promise.all(requests.map(async (origin) => {
    const requestStartedAt = performance.now();
    try {
      const response = await withTimeout(harness.request('POST', '/api/student/message', {
        joinCode,
        studentHubId: origin.hubId,
        message: origin.question
      }), 10_000);
      return {
        ...origin,
        response,
        elapsedMs: performance.now() - requestStartedAt,
        error: ''
      };
    } catch (error) {
      return {
        ...origin,
        response: null,
        elapsedMs: performance.now() - requestStartedAt,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }));
  const totalCompletionMs = performance.now() - startedAt;

  for (const result of timedResponses) {
    assert.equal(result.error, '', `${result.hubId} should not error or time out`);
    assert.equal(result.response.statusCode, 200);
    assert.equal(result.response.body.routeType, 'science_formula');
    assert.match(result.response.body.response, new RegExp(escapeRegExp(result.expectedAnswer), 'i'));
    assert.equal(JSON.stringify(result.response.body).includes(result.hubId), false);

    const hub = harness.studentSessions[sessionId].anonymousHubs[result.hubId];
    assert.ok(hub, `${result.hubId} should retain its own runtime state`);
    assert.equal(hub.messages.length, 1);
    assert.equal(hub.messages[0].message, result.question);
    assert.match(hub.messages[0].response, new RegExp(escapeRegExp(result.expectedAnswer), 'i'));
  }

  const timings = timedResponses.map((result) => result.elapsedMs).sort((a, b) => a - b);
  const errors = timedResponses.filter((result) => result.error);
  return {
    requestCount: HUB_COUNT,
    totalCompletionTimeMs: roundMs(totalCompletionMs),
    medianResponseTimeMs: roundMs(median(timings)),
    slowestResponseTimeMs: roundMs(timings[timings.length - 1] || 0),
    errorsOrTimeouts: errors.length,
    queuedBehindLocalOllama: false,
    queuedBehindTts: false,
    executionNote: 'The concurrency harness used the real deterministic student answer route; all questions resolved locally, so Ollama and TTS were not invoked.'
  };
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs} ms`)), timeoutMs);
      timer.unref?.();
    })
  ]);
}

function median(values) {
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
}

function roundMs(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error('Multi-student isolation and classroom capacity checks failed.');
  console.error(error);
  process.exit(1);
});
