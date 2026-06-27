const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const NEWTONS_LAWS_IDENTIFICATION_CASES = [
  {
    prompt: "Which Newton's law is shown when a soccer ball stays still until kicked?",
    choice: '1',
    finalPattern: /This shows Newton's First Law because the object stays at rest or keeps moving until a force changes it\./i
  },
  {
    prompt: "Which Newton's law is a rocket launching?",
    choice: '3',
    finalPattern: /This shows Newton's Third Law because two objects push or pull on each other with equal and opposite forces\./i
  },
  {
    prompt: "Which Newton's law is a swimmer pushing water backward and moving forward?",
    choice: '3',
    finalPattern: /This shows Newton's Third Law because two objects push or pull on each other with equal and opposite forces\./i,
    rejectsPattern: /chemistry|compound|mixture|h2o|water is/i
  },
  {
    prompt: "Which Newton's law is force equals mass times acceleration?",
    choice: '2',
    finalPattern: /This shows Newton's Second Law because force, mass, and acceleration are connected\./i
  },
  {
    prompt: "Which Newton's law is about action and reaction?",
    choice: '3',
    finalPattern: /This shows Newton's Third Law because two objects push or pull on each other with equal and opposite forces\./i
  },
  {
    prompt: "Which Newton's law is about inertia?",
    choice: '1',
    finalPattern: /This shows Newton's First Law because the object stays at rest or keeps moving until a force changes it\./i
  },
  {
    prompt: "Which Newton's law is shown when a seatbelt stops you in a car?",
    choice: '1',
    finalPattern: /This shows Newton's First Law because the object stays at rest or keeps moving until a force changes it\./i
  },
  {
    prompt: "Which Newton's law is shown when pushing a shopping cart harder makes it accelerate more?",
    choice: '2',
    finalPattern: /This shows Newton's Second Law because force, mass, and acceleration are connected\./i
  }
];

const NEWTONS_LAWS_CLUE_LABELS = [
  'An object stays still or keeps moving until a force changes it.',
  'Force, mass, and acceleration are connected.',
  'Two objects push or pull on each other with opposite forces.'
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: "What is Newton's first law?",
    includes: /Newton/i
  },
  {
    prompt: "Define Newton's second law.",
    includes: /force|mass|acceleration/i
  },
  {
    prompt: "Explain Newton's third law.",
    includes: /action|reaction|equal|opposite/i
  },
  {
    prompt: "What are Newton's laws?",
    includes: /First Law|Second Law|Third Law/i
  },
  {
    prompt: 'What is inertia?',
    includes: /resist|motion|change/i
  }
];

const FORMULA_TUTOR_CASES_TO_PRESERVE = [
  'A 4 kg object accelerates at 3 m/s^2. What force is needed?',
  'Calculate force if mass is 4 kg and acceleration is 3 m/s^2.',
  'What is the acceleration of a 10 kg object with a 20 N force?',
  'A 2 N and an 8 N force pull right and a 4 N force pulls left. What is the acceleration of a 0.5 kg object?'
];

async function main() {
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

  console.log('PASS concept tutor Newtons laws: live identification route is controlled, completes, and preserves direct/formula routes');
}

async function assertSupportedIdentificationPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of NEWTONS_LAWS_IDENTIFICATION_CASES) {
    const studentHubId = `newtons-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });
    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'motion-force.newtons-laws.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /Which clue best matches the situation\?/i);
    assert.match(start.body.response, /1\. An object stays still or keeps moving until a force changes it\./i);
    assert.match(start.body.response, /2\. Force, mass, and acceleration are connected\./i);
    assert.match(start.body.response, /3\. Two objects push or pull on each other with opposite forces\./i);
    assert.doesNotMatch(start.body.response, /^1\. Newton's First Law$/im);
    assert.doesNotMatch(start.body.response, /^2\. Newton's Second Law$/im);
    assert.doesNotMatch(start.body.response, /^3\. Newton's Third Law$/im);
    assert.deepEqual(
      start.body.tutor.currentStep.choices.map((choice) => choice.label),
      NEWTONS_LAWS_CLUE_LABELS,
      'active tutor metadata should expose clue labels, not law names'
    );
    assert.deepEqual(
      start.body.tutor.work.currentStep.choices.map((choice) => choice.label),
      NEWTONS_LAWS_CLUE_LABELS,
      'active tutor work should expose clue labels, not law names'
    );
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, testCase.finalPattern, 'start response should hide final answer');
    if (testCase.rejectsPattern) {
      assert.doesNotMatch(start.body.response, testCase.rejectsPattern);
    }

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
    if (testCase.rejectsPattern) {
      assert.doesNotMatch(complete.body.response, testCase.rejectsPattern);
      assert.doesNotMatch(complete.body.tutor.finalAnswer, testCase.rejectsPattern);
    }
    assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
  }
}

async function assertWrongNumberedChoiceRetries({ request, classSessionId }) {
  const studentHubId = 'newtons-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: "Which Newton's law is about action and reaction?"
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
  assert.doesNotMatch(wrong.body.response, /This shows Newton's Third Law because two objects push or pull on each other with equal and opposite forces\./i);

  const correct = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '3'
  });
  assert.equal(correct.statusCode, 200);
  assert.equal(correct.body.routeType, 'concept_tutor');
  assert.equal(correct.body.tutor.completed, true);
  assert.match(correct.body.response, /This shows Newton's Third Law because two objects push or pull on each other with equal and opposite forces\./i);
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
    assert.notEqual(response.body.tutor?.id, 'motion-force.newtons-laws.identification');
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
