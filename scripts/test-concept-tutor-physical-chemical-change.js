const assert = require('node:assert/strict');

const {
  buildPhysicalChemicalChangeConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const PHYSICAL_FINAL = /This describes a physical change because the substance changes form, size, shape, or state but does not become a new substance\./i;
const CHEMICAL_FINAL = /This describes a chemical change because a new substance is formed\./i;

const SUPPORTED_CHANGE_CASES = [
  {
    prompt: 'Is ice melting a physical or chemical change?',
    choice: '1',
    finalAnswer: PHYSICAL_FINAL
  },
  {
    prompt: 'Is water freezing a physical or chemical change?',
    choice: '1',
    finalAnswer: PHYSICAL_FINAL
  },
  {
    prompt: 'Is paper tearing a physical or chemical change?',
    choice: '1',
    finalAnswer: PHYSICAL_FINAL
  },
  {
    prompt: 'Is cutting wood a physical or chemical change?',
    choice: '1',
    finalAnswer: PHYSICAL_FINAL
  },
  {
    prompt: 'Is sugar dissolving in water a physical or chemical change?',
    choice: '1',
    finalAnswer: PHYSICAL_FINAL
  },
  {
    prompt: 'Is wood burning a physical or chemical change?',
    choice: '2',
    finalAnswer: CHEMICAL_FINAL
  },
  {
    prompt: 'Is rust forming a physical or chemical change?',
    choice: '2',
    finalAnswer: CHEMICAL_FINAL
  },
  {
    prompt: 'Is baking a cake a physical or chemical change?',
    choice: '2',
    finalAnswer: CHEMICAL_FINAL
  },
  {
    prompt: 'Is vinegar and baking soda fizzing a physical or chemical change?',
    choice: '2',
    finalAnswer: CHEMICAL_FINAL
  },
  {
    prompt: 'Which is physical: ice melting or wood burning?',
    choice: '1',
    finalAnswer: PHYSICAL_FINAL
  },
  {
    prompt: 'Which is chemical: ice melting or wood burning?',
    choice: '2',
    finalAnswer: CHEMICAL_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is a physical change?',
    includes: /physical change|size|shape|state|same identity/i
  },
  {
    prompt: 'Define physical change.',
    includes: /physical change|size|shape|state|same identity/i
  },
  {
    prompt: 'What is a chemical change?',
    includes: /chemical change|chemical reaction|new substance|atoms/i
  },
  {
    prompt: 'Define chemical change.',
    includes: /chemical change|chemical reaction|new substance|atoms/i
  },
  {
    prompt: 'Explain the difference between physical and chemical changes.',
    includes: /physical change|chemical change|new substance|identity/i
  },
  {
    prompt: 'How are physical and chemical changes different?',
    includes: /physical change|chemical change|new substance|identity/i
  },
  {
    prompt: 'Give examples of physical and chemical changes.',
    includes: /physical|chemical|melting|burning|rust/i
  },
  {
    prompt: 'What are signs of a chemical change?',
    includes: /chemical change|light|temperature|odor|color|gas|bubbles|precipitate/i
  }
];

const FORMULA_OR_OTHER_BOUNDARY_CASES = [
  'Calculate density if mass is 10 g and volume is 5 mL.',
  'Calculate speed if distance is 20 m and time is 4 s.',
  'Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.'
];

async function main() {
  assert.ok(
    buildPhysicalChemicalChangeConceptTutorPattern('Is ice melting a physical or chemical change?'),
    'supported physical/chemical change prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildPhysicalChemicalChangeConceptTutorPattern('What is a physical change?'),
    null,
    'definition prompts should not build the physical/chemical change concept tutor pattern'
  );
  assert.equal(
    buildPhysicalChemicalChangeConceptTutorPattern('Explain the difference between physical and chemical changes.'),
    null,
    'broad difference prompts should not build the physical/chemical change concept tutor pattern'
  );
  assert.equal(
    buildPhysicalChemicalChangeConceptTutorPattern('Calculate density if mass is 10 g and volume is 5 mL.'),
    null,
    'formula prompts should not build the physical/chemical change concept tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedChangePromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertWrongChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertMatterConceptTutorsStillStart({ request, classSessionId });
  await assertFormulaAndExistingTutorBoundaries({ request, classSessionId });

  console.log('PASS concept tutor physical/chemical change: starts narrowly, retries safely, and preserves direct/formula/existing concept routes');
}

async function assertSupportedChangePromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_CHANGE_CASES) {
    const studentHubId = `physical-chemical-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'matter.physical-chemical-change.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /Does the change make a new substance\?/i);
    assert.match(start.body.response, /1\. No, it only changes form, size, shape, or state\./i);
    assert.match(start.body.response, /2\. Yes, it makes a new substance\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, PHYSICAL_FINAL, 'start response should hide physical final answer');
    assert.doesNotMatch(start.body.response, CHEMICAL_FINAL, 'start response should hide chemical final answer');

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
  const studentHubId = 'physical-chemical-wrong-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is ice melting a physical or chemical change?'
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
  assert.doesNotMatch(wrong.body.response, PHYSICAL_FINAL);
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
    assert.notEqual(response.body.tutor?.id, 'matter.physical-chemical-change.identification');
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertMatterConceptTutorsStillStart({ request, classSessionId }) {
  const cases = [
    {
      prompt: 'Is water an element compound or mixture?',
      expectedTutorId: 'matter.element-compound-mixture'
    },
    {
      prompt: 'Is salt water homogeneous or heterogeneous?',
      expectedTutorId: 'matter.mixtures.homogeneous-heterogeneous'
    },
    {
      prompt: 'Is gold an element compound or mixture?',
      expectedTutorId: 'matter.element-compound-mixture'
    },
    {
      prompt: 'Is baking soda an element compound or mixture?',
      expectedTutorId: 'matter.element-compound-mixture'
    }
  ];

  for (const testCase of cases) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `matter-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${testCase.prompt} should still start Concept Tutor`);
    assert.equal(response.body.tutor.id, testCase.expectedTutorId);
  }
}

async function assertFormulaAndExistingTutorBoundaries({ request, classSessionId }) {
  for (const prompt of FORMULA_OR_OTHER_BOUNDARY_CASES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `formula-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'formula_tutor', `${prompt} should keep Formula Tutor priority`);
    assert.notEqual(response.body.tutor?.id, 'matter.physical-chemical-change.identification');
  }

  const acidsBases = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'existing-acids-bases',
    message: 'Is vinegar acidic, basic, or neutral?'
  });
  assert.equal(acidsBases.statusCode, 200);
  assert.equal(acidsBases.body.routeType, 'concept_tutor');
  assert.equal(acidsBases.body.tutor.id, 'chemistry.acids-bases.identification');
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
