const assert = require('node:assert/strict');

const {
  buildSeriesParallelCircuitsConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const SERIES_FINAL = /This describes a series circuit because current has only one path to follow\./i;
const PARALLEL_FINAL = /This describes a parallel circuit because current has more than one path to follow\./i;

const SUPPORTED_SERIES_PARALLEL_CASES = [
  {
    prompt: 'Is a circuit with one path series or parallel?',
    choice: '1',
    finalAnswer: SERIES_FINAL
  },
  {
    prompt: 'Is a circuit with more than one path series or parallel?',
    choice: '2',
    finalAnswer: PARALLEL_FINAL
  },
  {
    prompt: 'Is a circuit with branches series or parallel?',
    choice: '2',
    finalAnswer: PARALLEL_FINAL
  },
  {
    prompt: 'If one bulb goes out and all bulbs go out, is it series or parallel?',
    choice: '1',
    finalAnswer: SERIES_FINAL
  },
  {
    prompt: 'If one bulb goes out and the others stay on, is it series or parallel?',
    choice: '2',
    finalAnswer: PARALLEL_FINAL
  },
  {
    prompt: 'Which is series: one path or many paths?',
    choice: '1',
    finalAnswer: SERIES_FINAL
  },
  {
    prompt: 'Which is parallel: one path or many paths?',
    choice: '2',
    finalAnswer: PARALLEL_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is a series circuit?',
    includes: /series circuit|one path|same current|current/i
  },
  {
    prompt: 'Define series circuit.',
    includes: /series circuit|one path|same current|current/i
  },
  {
    prompt: 'What is a parallel circuit?',
    includes: /parallel circuit|more than one path|branch|current/i
  },
  {
    prompt: 'Define parallel circuit.',
    includes: /parallel circuit|more than one path|branch|current/i
  },
  {
    prompt: 'Explain the difference between series and parallel circuits.',
    includes: /series|parallel|one path|more than one path|branch|current/i
  }
];

const OPEN_CLOSED_CASES_TO_PRESERVE = [
  'Is a circuit with a closed switch open or closed?',
  'Is a circuit with an open switch open or closed?',
  'Is a complete path open or closed circuit?',
  'Is a broken wire an open or closed circuit?',
  'If the bulb lights, is the circuit open or closed?',
  'If the bulb is off because the switch is open, is the circuit open or closed?'
];

const FORMULA_CASES_TO_PRESERVE = [
  'Calculate voltage if current is 2 A and resistance is 3 ohms.',
  'Calculate current if voltage is 12 V and resistance is 4 ohms.',
  'Calculate resistance if voltage is 10 V and current is 2 A.',
  'Find total resistance for two resistors in series, 2 ohms and 3 ohms.',
  'Find total resistance for two resistors in parallel, 2 ohms and 3 ohms.'
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
    buildSeriesParallelCircuitsConceptTutorPattern('Is a circuit with one path series or parallel?'),
    'supported series/parallel circuit prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildSeriesParallelCircuitsConceptTutorPattern('What is a series circuit?'),
    null,
    'definition prompts should not build the series/parallel circuit concept tutor pattern'
  );
  assert.equal(
    buildSeriesParallelCircuitsConceptTutorPattern('Explain the difference between series and parallel circuits.'),
    null,
    'broad difference prompts should not build the series/parallel circuit concept tutor pattern'
  );
  assert.equal(
    buildSeriesParallelCircuitsConceptTutorPattern('Find total resistance for two resistors in series, 2 ohms and 3 ohms.'),
    null,
    'formula prompts should not build the series/parallel circuit concept tutor pattern'
  );
  assert.equal(
    buildSeriesParallelCircuitsConceptTutorPattern('Is a circuit with a closed switch open or closed?'),
    null,
    'open/closed circuit prompts should not build the series/parallel circuit concept tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedSeriesParallelPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertWrongChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertOpenClosedConceptTutorStillStarts({ request, classSessionId });
  await assertFormulaPromptsKeepFormulaRoute({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor series/parallel circuits: starts narrowly and preserves direct/open-closed/formula/existing concept routes');
}

async function assertSupportedSeriesParallelPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_SERIES_PARALLEL_CASES) {
    const studentHubId = `series-parallel-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'electricity.circuits.series-parallel.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /How are the parts connected\?/i);
    assert.match(start.body.response, /1\. Series: one path for current\./i);
    assert.match(start.body.response, /2\. Parallel: more than one path for current\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, SERIES_FINAL, 'start response should hide series-circuit final answer');
    assert.doesNotMatch(start.body.response, PARALLEL_FINAL, 'start response should hide parallel-circuit final answer');

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
  const studentHubId = 'series-parallel-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is a circuit with one path series or parallel?'
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
  assert.doesNotMatch(wrong.body.response, SERIES_FINAL);
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
    assert.notEqual(response.body.tutor?.id, 'electricity.circuits.series-parallel.identification');
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertOpenClosedConceptTutorStillStarts({ request, classSessionId }) {
  for (const prompt of OPEN_CLOSED_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `open-closed-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${prompt} should still start open/closed Concept Tutor`);
    assert.equal(response.body.tutor.id, 'electricity.circuits.open-closed.identification');
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
    assert.notEqual(response.body.tutor?.id, 'electricity.circuits.series-parallel.identification');
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
