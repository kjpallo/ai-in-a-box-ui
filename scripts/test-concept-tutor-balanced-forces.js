const assert = require('node:assert/strict');

const {
  buildBalancedUnbalancedForcesConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const BALANCED_FINAL = /This shows balanced forces because the forces are equal or cancel out, so the net force is zero and the motion does not change\./i;
const UNBALANCED_FINAL = /This shows unbalanced forces because the forces do not cancel out, so there is a net force and the object's motion can change\./i;

const SUPPORTED_IDENTIFICATION_CASES = [
  {
    prompt: 'Are the forces balanced or unbalanced if 5 N pushes right and 5 N pushes left?',
    choice: '1',
    finalPattern: BALANCED_FINAL
  },
  {
    prompt: 'Is a book sitting still on a table balanced or unbalanced?',
    choice: '1',
    finalPattern: BALANCED_FINAL
  },
  {
    prompt: 'Is a tug-of-war with equal pulls balanced or unbalanced?',
    choice: '1',
    finalPattern: BALANCED_FINAL
  },
  {
    prompt: 'Are the forces balanced or unbalanced when one team pulls harder in tug-of-war?',
    choice: '2',
    finalPattern: UNBALANCED_FINAL
  },
  {
    prompt: 'Is a box speeding up because it is being pushed balanced or unbalanced?',
    choice: '2',
    finalPattern: UNBALANCED_FINAL
  },
  {
    prompt: 'Is an object moving at constant speed with no change in motion balanced or unbalanced?',
    choice: '1',
    finalPattern: BALANCED_FINAL
  },
  {
    prompt: 'Are equal forces on opposite sides balanced or unbalanced?',
    choice: '1',
    finalPattern: BALANCED_FINAL
  },
  {
    prompt: 'Are unequal forces balanced or unbalanced?',
    choice: '2',
    finalPattern: UNBALANCED_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What are balanced forces?',
    includes: /balanced|equal|cancel|net force/i
  },
  {
    prompt: 'Define unbalanced forces.',
    includes: /unbalanced|do not cancel|net force|change motion/i
  },
  {
    prompt: 'Explain balanced and unbalanced forces.',
    includes: /balanced|unbalanced|net force|change motion/i
  },
  {
    prompt: 'What is net force?',
    includes: /net force|overall|total/i
  },
  {
    prompt: 'What does balanced mean in science?',
    includes: /balanced|equal|cancel|net force/i
  }
];

const FORMULA_TUTOR_CASES_TO_PRESERVE = [
  'What is the net force if 5 N pushes right and 2 N pushes left?',
  'Calculate the net force from 10 N right and 4 N left.',
  'A 2 N and an 8 N force pull right and a 4 N force pulls left. What is the acceleration of a 0.5 kg object?',
  'A 4 kg object accelerates at 3 m/s^2. What force is needed?'
];

async function main() {
  assert.ok(
    buildBalancedUnbalancedForcesConceptTutorPattern('Are the forces balanced or unbalanced if 5 N pushes right and 5 N pushes left?'),
    'supported balanced/unbalanced identification prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildBalancedUnbalancedForcesConceptTutorPattern('What are balanced forces?'),
    null,
    'pure definition questions should not build the concept tutor pattern'
  );
  assert.equal(
    buildBalancedUnbalancedForcesConceptTutorPattern('What is the net force if 5 N pushes right and 2 N pushes left?'),
    null,
    'numeric calculation questions should not build the concept tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedIdentificationPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertWrongNumberedChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertFormulaPromptsKeepFormulaTutor({ request, classSessionId });
  await assertNewtonsLawsStillStarts({ request, classSessionId });

  console.log('PASS concept tutor balanced forces: live identification route is controlled, completes, and preserves direct/formula/Newtons routes');
}

async function assertSupportedIdentificationPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_IDENTIFICATION_CASES) {
    const studentHubId = `balanced-forces-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });
    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'motion-force.balanced-unbalanced-forces.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /Are the forces balanced or unbalanced\?/i);
    assert.match(start.body.response, /1\. Balanced: forces are equal or cancel out\./i);
    assert.match(start.body.response, /2\. Unbalanced: forces are unequal and cause a change in motion\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, testCase.finalPattern, 'start response should hide final answer');

    const complete = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.choice
    });
    assert.equal(complete.statusCode, 200);
    assert.equal(complete.body.routeType, 'concept_tutor');
    assert.equal(complete.body.tutor.completed, true);
    assert.equal(complete.body.tutor.active, false);
    assert.match(complete.body.response, testCase.finalPattern);
    assert.match(complete.body.tutor.finalAnswer, testCase.finalPattern);
    assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
  }
}

async function assertWrongNumberedChoiceRetries({ request, classSessionId }) {
  const studentHubId = 'balanced-forces-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Are the forces balanced or unbalanced when one team pulls harder in tug-of-war?'
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');

  const wrong = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '1'
  });
  assert.equal(wrong.statusCode, 200);
  assert.equal(wrong.body.routeType, 'concept_tutor');
  assert.equal(wrong.body.tutor.active, true);
  assert.equal(wrong.body.tutor.currentStepIndex, 0);
  assert.match(wrong.body.response, /Not quite/i);
  assert.doesNotMatch(wrong.body.response, UNBALANCED_FINAL);

  const correct = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '2'
  });
  assert.equal(correct.statusCode, 200);
  assert.equal(correct.body.routeType, 'concept_tutor');
  assert.equal(correct.body.tutor.completed, true);
  assert.match(correct.body.response, UNBALANCED_FINAL);
}

async function assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId }) {
  for (const testCase of DIRECT_ANSWER_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should stay a direct answer`);
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertFormulaPromptsKeepFormulaTutor({ request, classSessionId }) {
  for (const prompt of FORMULA_TUTOR_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `formula-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'formula_tutor', `${prompt} should keep Formula Tutor priority`);
    assert.notEqual(response.body.tutor?.id, 'motion-force.balanced-unbalanced-forces.identification');
  }
}

async function assertNewtonsLawsStillStarts({ request, classSessionId }) {
  const response = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'newtons-law-preserved',
    message: "Which Newton's law is shown when pushing a shopping cart harder makes it accelerate more?"
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.routeType, 'concept_tutor');
  assert.equal(response.body.tutor.id, 'motion-force.newtons-laws.identification');
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
