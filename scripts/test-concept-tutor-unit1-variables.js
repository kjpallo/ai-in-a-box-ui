const assert = require('node:assert/strict');

const {
  buildUnit1VariablesConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const TUTOR_ID = 'unit1.scientific_method.variables.identification';

const VARIABLE_SCENARIO_CASES = [
  {
    prompt: 'A student tests how fertilizer affects plant height. What is the independent variable?',
    choice: '1',
    promptClue: /What did the experimenter change on purpose\?/i,
    correctLabel: /Type of fertilizer/i,
    finalAnswer: /The independent variable is the type of fertilizer because it is what the scientist changes on purpose\./i
  },
  {
    prompt: 'A class tests if water temperature changes how fast sugar dissolves. What is the independent variable?',
    choice: '1',
    promptClue: /What did the experimenter change on purpose\?/i,
    correctLabel: /Temperature/i,
    finalAnswer: /The independent variable is temperature because it is what the scientist changes on purpose\./i
  },
  {
    prompt: 'Students test whether ramp height affects how far a toy car rolls. What is the independent variable?',
    choice: '1',
    promptClue: /What did the experimenter change on purpose\?/i,
    correctLabel: /Ramp height/i,
    finalAnswer: /The independent variable is ramp height because it is what the scientist changes on purpose\./i
  },
  {
    prompt: 'A student tests how fertilizer affects plant height. What is the dependent variable?',
    choice: '2',
    promptClue: /What is being measured or observed\?/i,
    correctLabel: /Plant height or growth/i,
    finalAnswer: /The dependent variable is plant height or growth because it is what the scientist measures as the result\./i
  },
  {
    prompt: 'A class tests if water temperature changes how fast sugar dissolves. What is the dependent variable?',
    choice: '2',
    promptClue: /What is being measured or observed\?/i,
    correctLabel: /How fast or how much dissolves/i,
    finalAnswer: /The dependent variable is how fast or how much dissolves because it is what the scientist measures as the result\./i
  },
  {
    prompt: 'Students test whether ramp height affects how far a toy car rolls. What is the dependent variable?',
    choice: '2',
    promptClue: /What is being measured or observed\?/i,
    correctLabel: /How far the toy car rolls/i,
    finalAnswer: /The dependent variable is how far the toy car rolls because it is what the scientist measures as the result\./i
  },
  {
    prompt: 'A student tests how fertilizer affects plant height. What should be constant?',
    choice: '3',
    promptClue: /What stayed the same for all groups\?/i,
    correctLabel: /Amount of water/i,
    finalAnswer: /A constant is the amount of water because it should be kept the same to make the test fair\./i
  },
  {
    prompt: 'A class tests if water temperature changes how fast sugar dissolves. What are the constants?',
    choice: '3',
    promptClue: /What stayed the same for all groups\?/i,
    correctLabel: /Amount of solute and water/i,
    finalAnswer: /A constant is the amount of solute and water because it should be kept the same to make the test fair\./i
  },
  {
    prompt: 'Students test whether ramp height affects how far a toy car rolls. What should stay the same?',
    choice: '3',
    promptClue: /What stayed the same for all groups\?/i,
    correctLabel: /same toy car and surface/i,
    finalAnswer: /A constant is the same toy car and surface because it should be kept the same to make the test fair\./i
  },
  {
    prompt: 'A student tests a new fertilizer on plants. One group gets no fertilizer. What is the control group?',
    choice: '1',
    promptClue: /Which group did not receive the treatment or change\?/i,
    correctLabel: /group with no fertilizer/i,
    finalAnswer: /The control group is the group with no fertilizer because it did not receive the treatment or change\./i
  },
  {
    prompt: 'A medicine test has one group take the medicine and another group take a sugar pill. What is the control group?',
    choice: '2',
    promptClue: /Which group did not receive the treatment or change\?/i,
    correctLabel: /group that takes the sugar pill/i,
    finalAnswer: /The control group is the group that takes the sugar pill because it did not receive the medicine treatment\./i
  },
  {
    prompt: 'A class tests music on studying. One group studies with no music. What is the control group?',
    choice: '1',
    promptClue: /Which group did not receive the treatment or change\?/i,
    correctLabel: /group studying with no music/i,
    finalAnswer: /The control group is the group studying with no music because it did not receive the treatment or change\./i
  },
  {
    prompt: 'A student tests a new fertilizer on plants. One group gets fertilizer. What is the experimental group?',
    choice: '2',
    promptClue: /Which group received the treatment or change\?/i,
    correctLabel: /group that gets fertilizer/i,
    finalAnswer: /The experimental group is the group that gets fertilizer because it received the treatment or change\./i
  },
  {
    prompt: 'A medicine test has one group take the medicine and another group take a sugar pill. What is the experimental group?',
    choice: '1',
    promptClue: /Which group received the treatment or change\?/i,
    correctLabel: /group that takes the medicine/i,
    finalAnswer: /The experimental group is the group that takes the medicine because it received the treatment or change\./i
  },
  {
    prompt: 'A class tests music on studying. One group studies with music. What is the experimental group?',
    choice: '2',
    promptClue: /Which group received the treatment or change\?/i,
    correctLabel: /group studying with music/i,
    finalAnswer: /The experimental group is the group studying with music because it received the treatment or change\./i
  }
];

const MULTI_TARGET_SCENARIO_CASES = [
  {
    prompt: 'A student tests how fertilizer affects plant height. What are the independent and dependent variables?',
    choices: ['1', '2'],
    clues: [
      /What did the experimenter change on purpose\?/i,
      /What is being measured or observed\?/i
    ],
    finalAnswer: /The independent variable is the type of fertilizer because it is what the scientist changes on purpose\. The dependent variable is plant height or growth because it is what the scientist measures as the result\./i
  },
  {
    prompt: 'A class tests if water temperature changes how fast sugar dissolves. Identify the independent variable, dependent variable, and constants.',
    choices: ['1', '2', '3'],
    clues: [
      /What did the experimenter change on purpose\?/i,
      /What is being measured or observed\?/i,
      /What stayed the same for all groups\?/i
    ],
    finalAnswer: /The independent variable is temperature because it is what the scientist changes on purpose\. The dependent variable is how fast or how much dissolves because it is what the scientist measures as the result\. A constant is the amount of solute and water because it should be kept the same to make the test fair\./i
  },
  {
    prompt: 'A student tests a new fertilizer on plants. One group gets fertilizer and one group gets no fertilizer. What are the control and experimental groups?',
    choices: ['1', '2'],
    clues: [
      /Which group did not receive the treatment or change\?/i,
      /Which group received the treatment or change\?/i
    ],
    finalAnswer: /The control group is the group with no fertilizer because it did not receive the treatment or change\. The experimental group is the group that gets fertilizer because it received the treatment or change\./i
  },
  {
    prompt: 'Students test whether ramp height affects how far a toy car rolls. Identify the independent variable, dependent variable, and constants.',
    choices: ['1', '2', '3'],
    clues: [
      /What did the experimenter change on purpose\?/i,
      /What is being measured or observed\?/i,
      /What stayed the same for all groups\?/i
    ],
    finalAnswer: /The independent variable is ramp height because it is what the scientist changes on purpose\. The dependent variable is how far the toy car rolls because it is what the scientist measures as the result\. A constant is the same toy car and surface because it should be kept the same to make the test fair\./i
  },
  {
    prompt: 'A medicine test has one group take the medicine and another group take a sugar pill. What are the control and experimental groups?',
    choices: ['2', '1'],
    clues: [
      /Which group did not receive the treatment or change\?/i,
      /Which group received the treatment or change\?/i
    ],
    finalAnswer: /The control group is the group that takes the sugar pill because it did not receive the medicine treatment\. The experimental group is the group that takes the medicine because it received the treatment or change\./i
  },
  {
    prompt: 'A class tests music on studying. One group studies with music and one group studies with no music. What are the control and experimental groups?',
    choices: ['1', '2'],
    clues: [
      /Which group did not receive the treatment or change\?/i,
      /Which group received the treatment or change\?/i
    ],
    finalAnswer: /The control group is the group studying with no music because it did not receive the treatment or change\. The experimental group is the group studying with music because it received the treatment or change\./i
  }
];

const DIRECT_ANSWER_BOUNDARIES = [
  {
    prompt: 'What is an independent variable?',
    includes: /independent variable|changes on purpose/i
  },
  {
    prompt: 'What is a dependent variable?',
    includes: /dependent variable|measures|result/i
  },
  {
    prompt: 'What is a constant?',
    includes: /constant|kept the same/i
  },
  {
    prompt: 'What is a control group?',
    includes: /control group|comparison|normal/i
  },
  {
    prompt: 'What is an experimental group?',
    includes: /experimental group|tested change|independent variable/i
  },
  {
    prompt: 'What is qualitative data?',
    includes: /qualitative data|descriptive/i
  },
  {
    prompt: 'What is the scientific method?',
    includes: /scientific method|ask questions|test ideas|collect data|draw conclusions/i
  }
];

const FORMULA_BOUNDARIES = [
  'Convert 48 km to meters.',
  'Write 354,000,000 in scientific notation.',
  'Calculate density if mass is 10 g and volume is 5 mL.',
  'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.'
];

const EXISTING_CONCEPT_TUTOR_BOUNDARIES = [
  {
    prompt: 'Is melting ice endothermic or exothermic?',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification'
  },
  {
    prompt: 'Is a circuit with one path series or parallel?',
    expectedTutorId: 'electricity.circuits.series-parallel.identification'
  },
  {
    prompt: 'Is a car speeding up acceleration?',
    expectedTutorId: 'motion-force.acceleration.identification'
  },
  {
    prompt: 'Is salt water homogeneous or heterogeneous?',
    expectedTutorId: 'matter.mixtures.homogeneous-heterogeneous'
  }
];

async function main() {
  assert.ok(
    buildUnit1VariablesConceptTutorPattern('In an experiment testing how sunlight affects plant growth, what is the independent variable?'),
    'supported source-aligned variable scenarios should build the Unit 1 variables Concept Tutor pattern'
  );
  assert.equal(
    buildUnit1VariablesConceptTutorPattern('What is an independent variable?'),
    null,
    'definition prompts should not build the Unit 1 variables Concept Tutor pattern'
  );
  assert.equal(
    buildUnit1VariablesConceptTutorPattern('Convert 48 km to meters.'),
    null,
    'formula prompts should not build the Unit 1 variables Concept Tutor pattern'
  );
  const multiTargetPattern = buildUnit1VariablesConceptTutorPattern('A student tests how fertilizer affects plant height. What are the independent and dependent variables?');
  assert.equal(
    multiTargetPattern?.steps?.length,
    2,
    'multi-target variable prompts should build a multi-step Unit 1 variables Concept Tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertVariableScenariosStartRetryAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertMultiTargetScenariosAdvanceAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertDefinitionsStayDirect({ request, classSessionId });
  await assertFormulaBoundariesStayFormula({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor Unit 1 variables: scenario prompts start narrowly, retry with numbered choices, and preserve direct/formula/existing concept routes');
}

async function assertVariableScenariosStartRetryAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of VARIABLE_SCENARIO_CASES) {
    const studentHubId = `unit1-variables-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, TUTOR_ID);
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /Topic: identifying variables/i);
    assert.match(start.body.response, testCase.promptClue, `${testCase.prompt} should ask the scenario clue question`);
    assert.match(start.body.response, /Choose one:/i);
    assert.match(start.body.response, /type only the number/i);
    assert.match(start.body.response, testCase.correctLabel);
    assert.doesNotMatch(start.body.response, testCase.finalAnswer);

    assertChoicesAreEvidenceBased(start.body.tutor.currentStep.choices);

    const wrongChoice = testCase.choice === '1' ? '2' : '1';
    const wrong = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: wrongChoice
    });
    assert.equal(wrong.statusCode, 200);
    assert.equal(wrong.body.routeType, 'concept_tutor');
    assert.equal(wrong.body.tutor.id, TUTOR_ID);
    assert.equal(wrong.body.tutor.active, true);
    assert.equal(wrong.body.tutor.currentStepIndex, 0);
    assert.match(wrong.body.response, /Not quite|not the best fit/i);
    assert.match(wrong.body.response, testCase.correctLabel);
    assert.match(wrong.body.response, /1\.\s+/);
    assert.match(wrong.body.response, /2\.\s+/);
    assert.match(wrong.body.response, /3\.\s+/);
    assert.match(wrong.body.response, /Try again/i);
    assert.doesNotMatch(wrong.body.response, testCase.finalAnswer);

    const complete = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.choice
    });
    assert.equal(complete.statusCode, 200);
    assert.equal(complete.body.routeType, 'concept_tutor');
    assert.equal(complete.body.tutor.id, TUTOR_ID);
    assert.equal(complete.body.tutor.completed, true);
    assert.equal(complete.body.tutor.active, false);
    assert.match(complete.body.response, testCase.finalAnswer);
    assert.match(complete.body.tutor.finalAnswer, testCase.finalAnswer);
    assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
  }
}

async function assertMultiTargetScenariosAdvanceAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of MULTI_TARGET_SCENARIO_CASES) {
    const studentHubId = `unit1-variables-multi-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, TUTOR_ID);
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.totalSteps, testCase.choices.length);
    assert.match(start.body.response, testCase.clues[0], `${testCase.prompt} should start with the first requested clue`);
    assert.doesNotMatch(start.body.response, testCase.finalAnswer);

    let current = start;
    for (let index = 0; index < testCase.choices.length; index += 1) {
      const answer = await request('POST', '/api/student/message', {
        sessionId: classSessionId,
        studentHubId,
        message: testCase.choices[index]
      });

      assert.equal(answer.statusCode, 200);
      assert.equal(answer.body.routeType, 'concept_tutor');
      assert.equal(answer.body.tutor.id, TUTOR_ID);

      const isLast = index === testCase.choices.length - 1;
      if (isLast) {
        assert.equal(answer.body.tutor.completed, true, `${testCase.prompt} should complete after the final requested target`);
        assert.equal(answer.body.tutor.active, false);
        assert.match(answer.body.response, testCase.finalAnswer);
        assert.match(answer.body.tutor.finalAnswer, testCase.finalAnswer);
        assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);
      } else {
        assert.equal(answer.body.tutor.active, true, `${testCase.prompt} should advance instead of stopping after step ${index + 1}`);
        assert.equal(answer.body.tutor.completed, false);
        assert.equal(answer.body.tutor.currentStepIndex, index + 1);
        assert.match(answer.body.response, /Correct/i);
        assert.match(answer.body.response, testCase.clues[index + 1], `${testCase.prompt} should ask the next requested clue`);
        assert.doesNotMatch(answer.body.response, testCase.finalAnswer);
      }

      current = answer;
    }

    assert.ok(current, `${testCase.prompt} should produce tutor responses`);
  }
}

function assertChoicesAreEvidenceBased(choices) {
  assert.ok(Array.isArray(choices));
  assert.ok(choices.length >= 3);
  const labels = choices.map((choice) => String(choice.label || '')).join(' ');
  assert.doesNotMatch(
    labels,
    /\b1\.\s*Independent variable\b|\b2\.\s*Dependent variable\b|\b3\.\s*Constant\b/i,
    'choices should be experiment parts, not just variable labels'
  );
  assert.doesNotMatch(
    labels,
    /^Independent variable\s+Dependent variable\s+Constant$/i,
    'choices should be experiment parts, not only label words'
  );
}

async function assertDefinitionsStayDirect({ request, classSessionId }) {
  for (const testCase of DIRECT_ANSWER_BOUNDARIES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should stay Direct Answer`);
    assert.notEqual(response.body.routeType, 'formula_tutor', `${testCase.prompt} should not start Formula Tutor`);
    assert.notEqual(response.body.tutor?.id, TUTOR_ID);
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertFormulaBoundariesStayFormula({ request, classSessionId }) {
  for (const prompt of FORMULA_BOUNDARIES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `formula-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body.routeType, /formula/i, `${prompt} should keep Formula Tutor or formula route`);
    assert.notEqual(response.body.tutor?.id, TUTOR_ID);
  }
}

async function assertExistingConceptTutorsStillStart({ request, classSessionId }) {
  for (const testCase of EXISTING_CONCEPT_TUTOR_BOUNDARIES) {
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
    .slice(0, 56);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
