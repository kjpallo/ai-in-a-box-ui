const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');
const { projectRoot } = require('./test-helpers/fileSystem');

async function main() {
  const clock = new Date('2026-07-27T15:00:00.000Z');
  const harness = createStudentRouteHarness({
    now: () => new Date(clock)
  });
  const sessionA = await harness.request('POST', '/api/profile/create-student-session', {
    className: 'Reopen A'
  });
  const sessionB = await harness.request('POST', '/api/profile/create-student-session', {
    className: 'Reopen B'
  });

  await join(harness, sessionA.body.joinCode, 'student-a-1');
  await join(harness, sessionA.body.joinCode, 'student-a-2');
  await join(harness, sessionB.body.joinCode, 'student-b');
  await lifecycle(harness, sessionA.body.sessionId, 'end');
  await lifecycle(harness, sessionB.body.sessionId, 'end');

  const sessionAState = harness.studentSessions[sessionA.body.sessionId];
  const sessionBState = harness.studentSessions[sessionB.body.sessionId];
  sessionAState.reopenRequests = Object.create(null);
  sessionAState.reopenRequests['student-a-1'] = false;

  let teacherSessions = await harness.request('GET', '/api/profile/live-student-activity');
  assertRequestCount(teacherSessions, sessionA.body.sessionId, 0);
  const falseMarkerJoin = await join(harness, sessionA.body.joinCode, 'student-a-1', 410);
  assert.equal(falseMarkerJoin.body.reopenRequest.pending, false);

  sessionAState.reopenRequests['student-a-1'] = null;
  teacherSessions = await harness.request('GET', '/api/profile/live-student-activity');
  assertRequestCount(teacherSessions, sessionA.body.sessionId, 0);
  const nullMarkerJoin = await join(harness, sessionA.body.joinCode, 'student-a-1', 410);
  assert.equal(nullMarkerJoin.body.reopenRequest.pending, false);

  const created = await requestReopen(harness, sessionA.body.joinCode, 'student-a-1');
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.created, true);
  assert.equal(created.body.reopenRequest.pending, true);
  assert.equal(sessionAState.reopenRequests['student-a-1'], true);
  assert.deepEqual(
    Object.keys(sessionAState.reopenRequests),
    ['student-a-1']
  );

  const duplicate = await requestReopen(harness, sessionA.body.joinCode, 'student-a-1');
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.body.created, false);
  assert.equal(
    Object.keys(harness.studentSessions[sessionA.body.sessionId].reopenRequests).length,
    1
  );

  const unrelated = await requestReopen(harness, sessionA.body.joinCode, 'student-b');
  assert.equal(unrelated.statusCode, 403);
  assert.equal(unrelated.body.code, 'STUDENT_NOT_IN_SESSION');

  const changedSession = await requestReopen(harness, sessionB.body.joinCode, 'student-a-1');
  assert.equal(changedSession.statusCode, 403);
  assert.equal(changedSession.body.code, 'STUDENT_NOT_IN_SESSION');

  for (const studentHubId of ['__proto__', 'constructor', 'prototype', { id: 'student-b' }, 42]) {
    const malformedStudent = await requestReopen(harness, sessionB.body.joinCode, studentHubId);
    assert.equal(malformedStudent.statusCode, 403);
    assert.equal(malformedStudent.body.code, 'STUDENT_NOT_IN_SESSION');
  }
  for (const studentHubId of ['', null]) {
    const missingStudent = await requestReopen(harness, sessionB.body.joinCode, studentHubId);
    assert.equal(missingStudent.statusCode, 400);
    assert.equal(missingStudent.body.code, 'STUDENT_HUB_REQUIRED');
  }
  for (const sessionId of ['__proto__', 'constructor', 'prototype', '', null, { id: sessionB.body.sessionId }]) {
    const malformedSession = await harness.request('POST', '/api/student/reopen-request', {
      sessionId,
      studentHubId: 'student-b'
    });
    assert.equal(malformedSession.statusCode, 404);
    assert.equal(malformedSession.body.code, 'SESSION_NOT_FOUND');
  }
  assert.equal(Object.prototype.hasOwnProperty.call(sessionBState, 'reopenRequests'), false);
  assert.deepEqual(Object.keys(sessionAState.reopenRequests), ['student-a-1']);

  const pendingJoin = await join(harness, sessionA.body.joinCode, 'student-a-1', 410);
  assert.equal(pendingJoin.body.code, 'SESSION_ENDED');
  assert.equal(pendingJoin.body.reopenRequest.pending, true);
  const peerJoin = await join(harness, sessionA.body.joinCode, 'student-a-2', 410);
  assert.equal(peerJoin.body.code, 'SESSION_ENDED');
  assert.equal(peerJoin.body.reopenRequest.pending, false);

  teacherSessions = await harness.request('GET', '/api/profile/live-student-activity');
  assertRequestCount(teacherSessions, sessionA.body.sessionId, 1);
  assertRequestCount(teacherSessions, sessionB.body.sessionId, 0);

  const secondRequest = await requestReopen(harness, sessionA.body.joinCode, 'student-a-2');
  assert.equal(secondRequest.statusCode, 201);
  teacherSessions = await harness.request('GET', '/api/profile/live-student-activity');
  assertRequestCount(teacherSessions, sessionA.body.sessionId, 2);
  assertRequestCount(teacherSessions, sessionB.body.sessionId, 0);

  const dismissed = await dismissAll(harness, sessionA.body.sessionId);
  assert.equal(dismissed.statusCode, 200);
  assert.equal(dismissed.body.clearedCount, 2);
  assert.equal(dismissed.body.session.status, 'ended');
  assert.equal(dismissed.body.session.reopenRequest.count, 0);
  assert.equal(harness.studentSessions[sessionA.body.sessionId].reopenRequests, undefined);

  await requestReopen(harness, sessionA.body.joinCode, 'student-a-1');
  await requestReopen(harness, sessionA.body.joinCode, 'student-a-2');
  const reopened = await lifecycle(harness, sessionA.body.sessionId, 'reopen');
  assert.equal(reopened.statusCode, 200);
  assert.equal(reopened.body.session.status, 'active');
  assert.equal(reopened.body.session.reopenRequest.count, 0);
  assert.equal(harness.studentSessions[sessionA.body.sessionId].reopenRequests, undefined);

  const activeRequest = await requestReopen(harness, sessionA.body.joinCode, 'student-a-1');
  assert.equal(activeRequest.statusCode, 409);
  assert.equal(activeRequest.body.code, 'SESSION_ALREADY_ACTIVE');

  assertUiAndHeartbeatContract();
  console.log('Student session reopen request checks passed.');
}

function join(harness, joinCode, studentHubId, expectedStatus = 200) {
  return harness.request('POST', '/api/student/join', {
    joinCode,
    studentHubId
  }).then((response) => {
    assert.equal(response.statusCode, expectedStatus);
    return response;
  });
}

function requestReopen(harness, joinCode, studentHubId) {
  return harness.request('POST', '/api/student/reopen-request', {
    joinCode,
    studentHubId
  });
}

function lifecycle(harness, sessionId, action) {
  return harness.request(
    'POST',
    '/api/profile/student-sessions/:sessionId/lifecycle',
    { action, ...(action === 'reopen' ? { minutes: 30 } : {}) },
    {},
    { sessionId }
  );
}

function dismissAll(harness, sessionId) {
  return harness.request(
    'POST',
    '/api/profile/student-sessions/:sessionId/reopen-request/dismiss',
    {},
    {},
    { sessionId }
  );
}

function assertRequestCount(response, sessionId, expectedCount) {
  assert.equal(response.statusCode, 200);
  const session = response.body.sessions.find((item) => item.sessionId === sessionId);
  assert.ok(session);
  assert.equal(session.reopenRequest.pending, expectedCount > 0);
  assert.equal(session.reopenRequest.count, expectedCount);
}

function assertUiAndHeartbeatContract() {
  const studentHtml = fs.readFileSync(path.join(projectRoot, 'public', 'student.html'), 'utf8');
  const studentUi = fs.readFileSync(path.join(projectRoot, 'public', 'student', 'student-ui.js'), 'utf8');
  const profileUi = fs.readFileSync(path.join(projectRoot, 'public', 'profile.js'), 'utf8');
  const control = studentHtml.match(/<button[^>]+id="studentSessionReopenRequest"[^>]*>([^<]+)<\/button>/);

  assert.ok(control);
  assert.equal(control[1].trim(), 'Ask teacher to reopen');
  assert.notEqual(control[1].trim(), 'Check session again');
  assert.match(studentUi, /requestStudentSessionReopen\(sessionAccess, studentHubId\)/);
  assert.match(studentUi, /Reopen request sent/);

  const heartbeat = studentUi.match(
    /async function sendHeartbeat[\s\S]*?(?=\n  async function refreshRateLimitStatus)/
  )?.[0] || '';
  assert.match(heartbeat, /joinStudentSession\(sessionAccess, studentHubId\)/);
  assert.match(heartbeat, /if \(!sessionIsValid\) await validateSession\(\)/);
  assert.match(heartbeat, /setInterval\([\s\S]*20_000/);

  assert.match(profileUi, /reopenRequestPending \? `<span class="active-session-running-pill is-expired"/);
  assert.match(profileUi, />Dismiss all<\/button>/);
  assert.match(profileUi, /data-student-session-lifecycle="reopen"/);
}

main().catch((error) => {
  console.error('Student session reopen request checks failed.');
  console.error(error);
  process.exit(1);
});
