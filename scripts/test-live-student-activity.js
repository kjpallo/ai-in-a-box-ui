const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

async function main() {
  const nowMs = Date.now();
  const {
    request,
    questionRateLimiter,
    studentSessions
  } = createStudentRouteHarness({
    rateLimitClock: () => nowMs,
    studentQuestionRateLimitEnabled: true,
    studentQuestionsPerMinute: 1
  });

  const classSessionId = 'class-live-activity';
  const activeLastSeenAt = new Date(nowMs - 60_000).toISOString();
  const idleLastSeenAt = new Date(nowMs - 10 * 60_000).toISOString();

  studentSessions[classSessionId] = {
    sessionId: classSessionId,
    className: 'Physical Science',
    createdAt: new Date(nowMs - 30 * 60_000).toISOString(),
    studentUrl: `/student.html?sessionId=${classSessionId}`,
    messages: [],
    anonymousHubs: {
      'active-hub': {
        studentHubId: 'active-hub',
        label: 'Should Be Renumbered',
        firstSeenAt: new Date(nowMs - 20 * 60_000).toISOString(),
        lastSeenAt: activeLastSeenAt,
        lastMessageAt: new Date(nowMs - 90_000).toISOString(),
        messageCount: 2,
        pendingClarification: { internal: true },
        currentTutorProblem: {
          tutorType: 'formula_tutor',
          formulaId: 'force_mass_acceleration',
          finalAnswer: 'hidden implementation state'
        },
        messages: [
          {
            createdAt: new Date(nowMs - 120_000).toISOString(),
            message: 'What is force?',
            response: 'Force is a push or pull.',
            routeType: 'knowledge',
            confidence: 'strong',
            standardId: 'HS-PS2-1',
            debug: {
              safeFlag: true,
              nested: { shouldNotLeak: true }
            }
          },
          {
            createdAt: new Date(nowMs - 90_000).toISOString(),
            message: 'What force if mass is 2 kg and acceleration is 3 m/s^2?',
            response: 'Let us solve it with the Guided Formula Tutor.',
            routeType: 'formula_tutor',
            confidence: 'strong',
            standardId: 'HS-PS2-1',
            topic: 'Forces and motion',
            source: 'formula_tools'
          }
        ]
      },
      'idle-hub': {
        studentHubId: 'idle-hub',
        firstSeenAt: new Date(nowMs - 25 * 60_000).toISOString(),
        lastSeenAt: idleLastSeenAt,
        messageCount: 1,
        messages: [
          {
            createdAt: new Date(nowMs - 12 * 60_000).toISOString(),
            message: 'tell me a joke',
            response: 'Ask a science question so I can help.',
            routeType: 'no_match',
            confidence: 'low',
            standardId: ''
          }
        ]
      },
      'missing-fields-hub': {
        studentHubId: 'missing-fields-hub',
        firstSeenAt: '',
        lastSeenAt: '',
        messageCount: 0
      }
    }
  };
  studentSessions['older-live-activity'] = {
    sessionId: 'older-live-activity',
    className: 'Earth Science',
    createdAt: new Date(nowMs - 90 * 60_000).toISOString(),
    studentUrl: '/student.html?sessionId=older-live-activity',
    messages: [],
    anonymousHubs: {}
  };
  studentSessions['newer-live-activity'] = {
    sessionId: 'newer-live-activity',
    className: 'Biology',
    createdAt: new Date(nowMs - 5 * 60_000).toISOString(),
    studentUrl: '/student.html?sessionId=newer-live-activity',
    messages: [],
    anonymousHubs: {}
  };

  questionRateLimiter.check({
    classSessionId,
    studentHubId: 'active-hub',
    questionsPerMinute: 1
  });

  const beforeLastSeenAt = studentSessions[classSessionId].anonymousHubs['active-hub'].lastSeenAt;
  const response = await request('GET', '/api/profile/live-student-activity');
  assert.equal(response.statusCode, 200);
  assert.equal(
    studentSessions[classSessionId].anonymousHubs['active-hub'].lastSeenAt,
    beforeLastSeenAt,
    'teacher live polling must not refresh hub presence'
  );
  assert.deepEqual(
    response.body.sessions.map((item) => item.classSessionId),
    ['newer-live-activity', classSessionId, 'older-live-activity'],
    'live activity should return multiple running sessions newest first'
  );

  const session = response.body.sessions.find((item) => item.classSessionId === classSessionId);
  assert.ok(session, 'live activity should include the seeded class session');
  assert.equal(session.anonymousHubCount, 3);
  assert.equal(session.activeAnonymousHubCount, 1);
  assert.equal(session.activeStudentCount, 1);
  assert.equal(session.totalStudentCount, 3);
  assert.equal(session.idleStudentCount, 2, 'stale hubs should become idle without closing the class session');
  assert.equal(session.totalMessageCount, 3);
  assert.equal(session.recentQuestionCount, 3);
  assert.equal(session.topStandardId, 'HS-PS2-1');
  assert.equal(session.topTopic, 'Forces and motion');
  assert.ok(session.runningSeconds > 0, 'live session summary should expose safe running seconds');
  assert.ok(studentSessions[classSessionId], 'teacher live polling should not remove stale sessions');

  const activeHub = session.anonymousHubs.find((hub) => hub.studentHubId === 'active-hub');
  assert.ok(activeHub, 'active hub should be serialized');
  assert.equal(activeHub.status, 'active');
  assert.equal(activeHub.active, true);
  assert.equal(activeHub.latestQuestion, 'What force if mass is 2 kg and acceleration is 3 m/s^2?');
  assert.equal(activeHub.latestResponse, 'Let us solve it with the Guided Formula Tutor.');
  assert.equal(activeHub.routeType, 'formula_tutor');
  assert.equal(activeHub.confidence, 'strong');
  assert.equal(activeHub.standardId, 'HS-PS2-1');
  assert.equal(activeHub.topic, 'Forces and motion');
  assert.equal(activeHub.source, 'formula_tools');
  assert.equal(activeHub.rateLimit.remainingWhole, 0);
  assert.equal(activeHub.rateLimit.maxQuestionsPerMinute, 1);
  assert.equal(activeHub.rateLimit.limited, true);
  assert.equal(activeHub.alerts.outOfQuestions, true);
  assert.equal(activeHub.alerts.formulaTutorActive, true);
  assert.equal(activeHub.recentMessages.length, 2);
  assert.equal(activeHub.recentMessages[0].debug, undefined);
  assert.equal(activeHub.recentMessages[0].sourceMetadata, undefined);

  const activeHubJson = JSON.stringify(activeHub);
  assert.doesNotMatch(activeHubJson, /currentTutorProblem|pendingClarification|finalAnswer|hidden implementation state|debug|sourceMetadata/);

  const idleHub = session.anonymousHubs.find((hub) => hub.studentHubId === 'idle-hub');
  assert.ok(idleHub, 'idle hub should be serialized');
  assert.equal(idleHub.status, 'idle');
  assert.equal(idleHub.active, false);
  assert.equal(idleHub.alerts.noMatch, true);
  assert.equal(idleHub.alerts.lowConfidence, true);
  assert.equal(idleHub.alerts.missingStandard, true);
  assert.equal(idleHub.alerts.needsReview, true);
  assert.ok(studentSessions[classSessionId], 'idle students should not archive, end, disable, or remove the class session by default');

  const missingFieldsHub = session.anonymousHubs.find((hub) => hub.studentHubId === 'missing-fields-hub');
  assert.ok(missingFieldsHub, 'hub with missing optional fields should not crash serialization');
  assert.equal(missingFieldsHub.latestQuestion, '');
  assert.deepEqual(missingFieldsHub.recentMessages, []);

  const createResponse = await request('POST', '/api/profile/create-student-session', {
    className: 'Chemistry'
  });
  assert.equal(createResponse.statusCode, 201);
  const afterCreateResponse = await request('GET', '/api/profile/live-student-activity');
  assert.equal(afterCreateResponse.statusCode, 200);
  assert.ok(
    afterCreateResponse.body.sessions.some((item) => item.classSessionId === classSessionId),
    'creating a new student link should not hide older running sessions'
  );
  assert.ok(
    afterCreateResponse.body.sessions.some((item) => item.classSessionId === createResponse.body.sessionId),
    'creating a student link should create a new running session'
  );
  assert.equal(
    afterCreateResponse.body.sessions[0].classSessionId,
    createResponse.body.sessionId,
    'newly created sessions should appear at the top of live activity'
  );

  console.log('live student activity: teacher endpoint serializes anonymous hub activity safely');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
