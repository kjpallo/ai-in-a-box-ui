const assert = require('node:assert/strict');

const {
  buildAcidsBasesConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const ACIDIC_FINAL = /This describes an acidic substance because acids have a pH below 7\./i;
const NEUTRAL_FINAL = /This describes a neutral substance because neutral substances have a pH of 7\./i;
const BASIC_FINAL = /This describes a basic substance because bases have a pH above 7\./i;

const SUPPORTED_ACIDS_BASES_CASES = [
  {
    prompt: 'Is a substance with pH 3 acidic, basic, or neutral?',
    choice: '1',
    finalAnswer: ACIDIC_FINAL
  },
  {
    prompt: 'Is a substance with pH 7 acidic, basic, or neutral?',
    choice: '2',
    finalAnswer: NEUTRAL_FINAL
  },
  {
    prompt: 'Is a substance with pH 10 acidic, basic, or neutral?',
    choice: '3',
    finalAnswer: BASIC_FINAL
  },
  {
    prompt: 'Is vinegar acidic, basic, or neutral?',
    choice: '1',
    finalAnswer: ACIDIC_FINAL
  },
  {
    prompt: 'Is lemon juice acidic, basic, or neutral?',
    choice: '1',
    finalAnswer: ACIDIC_FINAL
  },
  {
    prompt: 'Is stomach acid acidic, basic, or neutral?',
    choice: '1',
    finalAnswer: ACIDIC_FINAL
  },
  {
    prompt: 'Is pure water acidic, basic, or neutral?',
    choice: '2',
    finalAnswer: NEUTRAL_FINAL
  },
  {
    prompt: 'Is soap acidic, basic, or neutral?',
    choice: '3',
    finalAnswer: BASIC_FINAL
  },
  {
    prompt: 'Is baking soda basic, acidic, or neutral?',
    choice: '3',
    finalAnswer: BASIC_FINAL
  },
  {
    prompt: 'Is bleach acidic, basic, or neutral?',
    choice: '3',
    finalAnswer: BASIC_FINAL
  },
  {
    prompt: 'Which is acidic: pH 3, pH 7, or pH 10?',
    choice: '1',
    finalAnswer: ACIDIC_FINAL
  },
  {
    prompt: 'Which is neutral: pH 3, pH 7, or pH 10?',
    choice: '2',
    finalAnswer: NEUTRAL_FINAL
  },
  {
    prompt: 'Which is basic: pH 3, pH 7, or pH 10?',
    choice: '3',
    finalAnswer: BASIC_FINAL
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is an acid?',
    includes: [/acid/i, /pH below 7/i]
  },
  {
    prompt: 'Define acid.',
    includes: [/acid/i, /pH below 7/i]
  },
  {
    prompt: 'What is a base?',
    includes: [/base|basic/i, /pH above 7/i]
  },
  {
    prompt: 'Define base.',
    includes: [/base|basic/i, /pH above 7/i]
  },
  {
    prompt: 'What is pH?',
    includes: [/pH/i, /acidic/i, /basic/i, /neutral/i]
  },
  {
    prompt: 'What does pH measure?',
    includes: [/pH/i, /acidic/i, /basic/i]
  },
  {
    prompt: 'What is a neutral substance?',
    includes: [/neutral/i, /pH of 7|pH 7/i]
  },
  {
    prompt: 'Explain the difference between acids and bases.',
    includes: [/acids?/i, /bases?/i, /below 7/i, /above 7/i]
  },
  {
    prompt: 'How are acids and bases different?',
    includes: [/acids?/i, /bases?/i, /below 7/i, /above 7/i]
  },
  {
    prompt: 'Give examples of acids and bases.',
    includes: [/vinegar|lemon juice|stomach acid/i, /soap|baking soda|bleach|ammonia/i]
  },
  {
    prompt: 'What is acetic acid?',
    includes: [/acetic acid/i, /vinegar/i, /acidic/i]
  },
  {
    prompt: 'Is acetic acid the same as acidic?',
    includes: [/No|not/i, /Acetic acid/i, /specific acid/i, /acidic/i, /pH below 7/i]
  },
  {
    prompt: 'Why is vinegar acidic?',
    includes: [/vinegar/i, /acetic acid/i, /pH below 7/i]
  },
  {
    prompt: 'Why is soap basic?',
    includes: [/soap/i, /basic/i, /pH above 7/i]
  },
  {
    prompt: 'Why is pure water neutral?',
    includes: [/pure water/i, /neutral/i, /pH.*7/i]
  },
  {
    prompt: 'How can you tell if something is acidic or basic?',
    includes: [/pH/i, /below 7/i, /above 7/i]
  },
  {
    prompt: 'What happens when an acid and a base react?',
    includes: [/acid/i, /base/i, /neutralize|neutralization/i]
  },
  {
    prompt: 'What is neutralization?',
    includes: [/neutralization/i, /acid/i, /base/i]
  }
];

const FORMULA_CASES_TO_PRESERVE = [
  {
    prompt: 'Calculate density if mass is 10 g and volume is 5 mL.',
    expectedRouteType: 'formula_tutor'
  },
  {
    prompt: 'Calculate speed if distance is 20 m and time is 4 s.',
    expectedRouteType: 'formula_tutor'
  },
  {
    prompt: 'Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.',
    expectedRouteType: 'formula_tutor'
  },
  {
    prompt: 'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.',
    expectedRouteType: 'formula_tutor'
  },
  {
    prompt: 'What is the pH if hydrogen ion concentration is given?'
  }
];

async function main() {
  assert.ok(
    buildAcidsBasesConceptTutorPattern('Is a substance with pH 3 acidic, basic, or neutral?'),
    'supported acid/base classification prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildAcidsBasesConceptTutorPattern('What is an acid?'),
    null,
    'definition prompts should not build the acids/bases concept tutor pattern'
  );
  assert.equal(
    buildAcidsBasesConceptTutorPattern('Why is vinegar acidic?'),
    null,
    'broad explanation prompts should not build the acids/bases concept tutor pattern'
  );
  assert.equal(
    buildAcidsBasesConceptTutorPattern('What is the pH if hydrogen ion concentration is given?'),
    null,
    'pH formula/calculation prompts should not build the acids/bases concept tutor pattern'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedAcidsBasesPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertInvalidChoiceRetries({ request, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertFormulaPromptsBypassConceptTutor({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor acids/bases: acidic/basic/neutral starts narrowly and preserves direct/formula/existing concept routes');
}

async function assertSupportedAcidsBasesPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_ACIDS_BASES_CASES) {
    const studentHubId = `acids-bases-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'chemistry.acids-bases.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /What does the pH or example tell you\?/i);
    assert.match(start.body.response, /1\. Acidic: pH below 7\./i);
    assert.match(start.body.response, /2\. Neutral: pH equal to 7\./i);
    assert.match(start.body.response, /3\. Basic: pH above 7\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, ACIDIC_FINAL, 'start response should hide acidic final answer');
    assert.doesNotMatch(start.body.response, NEUTRAL_FINAL, 'start response should hide neutral final answer');
    assert.doesNotMatch(start.body.response, BASIC_FINAL, 'start response should hide basic final answer');

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

async function assertInvalidChoiceRetries({ request, classSessionId }) {
  const studentHubId = 'acids-bases-invalid-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is vinegar acidic, basic, or neutral?'
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');

  const invalid = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '4'
  });
  assert.equal(invalid.statusCode, 200);
  assert.equal(invalid.body.routeType, 'concept_tutor');
  assert.equal(invalid.body.tutor.active, true);
  assert.equal(invalid.body.tutor.currentStepIndex, 0);
  assert.match(invalid.body.response, /Please choose one of the listed options/i);
  assert.doesNotMatch(invalid.body.response, ACIDIC_FINAL);
  assert.doesNotMatch(invalid.body.response, NEUTRAL_FINAL);
  assert.doesNotMatch(invalid.body.response, BASIC_FINAL);
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
    assert.notEqual(response.body.tutor?.id, 'chemistry.acids-bases.identification');
    for (const expected of testCase.includes) {
      assert.match(response.body.response, expected, `${testCase.prompt} should include ${expected}`);
    }
  }
}

async function assertFormulaPromptsBypassConceptTutor({ request, classSessionId }) {
  for (const testCase of FORMULA_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `formula-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should not start Concept Tutor`);
    assert.notEqual(response.body.tutor?.id, 'chemistry.acids-bases.identification');
    if (testCase.expectedRouteType) {
      assert.equal(response.body.routeType, testCase.expectedRouteType, `${testCase.prompt} should preserve Formula Tutor priority`);
    }
  }
}

async function assertExistingConceptTutorsStillStart({ request, classSessionId }) {
  const cases = [
    {
      prompt: 'Is touching a hot pan conduction, convection, or radiation?',
      expectedTutorId: 'energy.transfer.conduction-convection-radiation'
    },
    {
      prompt: 'Is light mechanical or electromagnetic?',
      expectedTutorId: 'waves.mechanical-electromagnetic.identification'
    },
    {
      prompt: 'Is a sound wave transverse or longitudinal?',
      expectedTutorId: 'waves.transverse-longitudinal.identification'
    },
    {
      prompt: 'Is a car speeding up acceleration?',
      expectedTutorId: 'motion-force.acceleration.identification'
    },
    {
      prompt: 'Is 20 m/s north speed or velocity?',
      expectedTutorId: 'motion-force.speed-velocity.identification'
    },
    {
      prompt: 'Is 10 meters north distance or displacement?',
      expectedTutorId: 'motion-force.distance-displacement.identification'
    },
    {
      prompt: 'Are the forces balanced or unbalanced if 5 N pushes right and 5 N pushes left?',
      expectedTutorId: 'motion-force.balanced-unbalanced-forces.identification'
    },
    {
      prompt: 'What do you compare an object\'s position to?',
      expectedTutorId: 'motion-force.reference-point.identification'
    },
    {
      prompt: 'Is salt water homogeneous or heterogeneous?',
      expectedTutorId: 'matter.mixtures.homogeneous-heterogeneous'
    },
    {
      prompt: 'Is water an element compound or mixture?',
      expectedTutorId: 'matter.element-compound-mixture'
    }
  ];

  for (const testCase of cases) {
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
