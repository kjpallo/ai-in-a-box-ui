const assert = require('node:assert/strict');

const {
  buildOpenClosedCircuitsConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const CLOSED_FINAL = /This describes a closed circuit because the path is complete, so current can flow\./i;
const OPEN_FINAL = /This describes an open circuit because the path is broken or open, so current cannot flow\./i;

const SUPPORTED_OPEN_CLOSED_CASES = [
  {
    prompt: 'Is a circuit with a closed switch open or closed?',
    choice: '1',
    finalAnswer: CLOSED_FINAL
  },
  {
    prompt: 'Is a circuit with an open switch open or closed?',
    choice: '2',
    finalAnswer: OPEN_FINAL
  },
  {
    prompt: 'Is a complete path open or closed circuit?',
    choice: '1',
    finalAnswer: CLOSED_FINAL
  },
  {
    prompt: 'Is a broken wire an open or closed circuit?',
    choice: '2',
    finalAnswer: OPEN_FINAL
  },
  {
    prompt: 'If the bulb lights, is the circuit open or closed?',
    choice: '1',
    finalAnswer: CLOSED_FINAL
  },
  {
    prompt: 'If the bulb is off because the switch is open, is the circuit open or closed?',
    choice: '2',
    finalAnswer: OPEN_FINAL
  },
  {
    prompt: 'Which is closed: complete path or broken path?',
    choice: '1',
    finalAnswer: CLOSED_FINAL
  },
  {
    prompt: 'Which is open: complete path or broken path?',
    choice: '2',
    finalAnswer: OPEN_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is an open circuit?',
    includes: /open circuit|break|broken|incomplete|current cannot flow|current does not flow/i
  },
  {
    prompt: 'Define open circuit.',
    includes: /open circuit|break|broken|incomplete|current cannot flow|current does not flow/i
  },
  {
    prompt: 'What is a closed circuit?',
    includes: /closed circuit|complete|connected|current can flow|current flows/i
  },
  {
    prompt: 'Define closed circuit.',
    includes: /closed circuit|complete|connected|current can flow|current flows/i
  },
  {
    prompt: 'Explain the difference between open and closed circuits.',
    includes: /open circuit|closed circuit|broken|complete|current/i
  },
  {
    prompt: 'Why does a bulb turn off in an open circuit?',
    includes: /open circuit|broken|incomplete|current|cannot flow|does not flow/i
  }
];

const FORMULA_CASES_TO_PRESERVE = [
  'Calculate voltage if current is 2 A and resistance is 3 ohms.',
  'Calculate current if voltage is 12 V and resistance is 4 ohms.',
  'Calculate resistance if voltage is 10 V and current is 2 A.'
];

const EXISTING_CONCEPT_TUTOR_CASES = [
  {
    prompt: 'Is light mechanical or electromagnetic?',
    expectedTutorId: 'waves.mechanical-electromagnetic.identification'
  },
  {
    prompt: 'Is a sound wave transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  },
  {
    prompt: 'Is the height of a wave amplitude, wavelength, or frequency?',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency'
  },
  {
    prompt: 'Is light bouncing off a mirror reflection, refraction, or absorption?',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification'
  },
  {
    prompt: 'Is ice melting a physical or chemical change?',
    expectedTutorId: 'matter.physical-chemical-change.identification'
  },
  {
    prompt: 'Is vinegar acidic, basic, or neutral?',
    expectedTutorId: 'chemistry.acids-bases.identification'
  }
];

async function main() {
  assert.ok(
    buildOpenClosedCircuitsConceptTutorPattern('Is a circuit with a closed switch open or closed?'),
    'supported open/closed circuit prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildOpenClosedCircuitsConceptTutorPattern('What is an open circuit?'),
    null,
    'definition prompts should not build the open/closed circuit concept tutor pattern'
  );
  assert.equal(
    buildOpenClosedCircuitsConceptTutorPattern('Explain the difference between open and closed circuits.'),
    null,
    'broad difference prompts should not build the open/closed circuit concept tutor pattern'
  );
  assert.equal(
    buildOpenClosedCircuitsConceptTutorPattern('Calculate current if voltage is 12 V and resistance is 4 ohms.'),
    null,
    'formula prompts should not build the open/closed circuit concept tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedOpenClosedPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertWrongChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertFormulaPromptsKeepFormulaRoute({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor open/closed circuits: starts narrowly and preserves direct/formula/existing concept routes');
}

async function assertSupportedOpenClosedPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_OPEN_CLOSED_CASES) {
    const studentHubId = `open-closed-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'electricity.circuits.open-closed.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /Can electric current flow\?/i);
    assert.match(start.body.response, /1\. Yes, the path is complete\./i);
    assert.match(start.body.response, /2\. No, the path is broken or open\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, CLOSED_FINAL, 'start response should hide closed-circuit final answer');
    assert.doesNotMatch(start.body.response, OPEN_FINAL, 'start response should hide open-circuit final answer');

    const complete = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.choice
    });
    assert.equal(complete.statusCode, 200);
    assert.equal(complete.body.routeType, 'concept_tutor');
    assert.equal(complete.body.tutor.completed, true);
    assert.equal(complete.body.tutor.active, false);
    assert.match(complete.body.response, testCase.finalAnswer);
    assert.match(complete.body.tutor.finalAnswer, testCase.finalAnswer);
    assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
  }
}

async function assertWrongChoiceRetries({ request, classSessionId }) {
  const studentHubId = 'open-closed-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is a circuit with a closed switch open or closed?'
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');

  const wrong = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '2'
  });
  assert.equal(wrong.statusCode, 200);
  assert.equal(wrong.body.routeType, 'concept_tutor');
  assert.equal(wrong.body.tutor.active, true);
  assert.equal(wrong.body.tutor.currentStepIndex, 0);
  assert.match(wrong.body.response, /Not quite|not the best fit/i);
  assert.doesNotMatch(wrong.body.response, CLOSED_FINAL);
}

async function assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId }) {
  for (const testCase of DIRECT_ANSWER_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should stay direct`);
    assert.notEqual(response.body.tutor?.id, 'electricity.circuits.open-closed.identification');
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertFormulaPromptsKeepFormulaRoute({ request, classSessionId }) {
  for (const prompt of FORMULA_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `formula-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body.routeType, /formula/i, `${prompt} should keep Formula Tutor or formula route`);
    assert.notEqual(response.body.tutor?.id, 'electricity.circuits.open-closed.identification');
  }
}

async function assertExistingConceptTutorsStillStart({ request, classSessionId }) {
  for (const testCase of EXISTING_CONCEPT_TUTOR_CASES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `existing-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${testCase.prompt} should still start Concept Tutor`);
    assert.equal(response.body.tutor.id, testCase.expectedTutorId);
  }
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
