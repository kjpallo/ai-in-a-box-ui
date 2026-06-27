const assert = require('node:assert/strict');

const {
  buildMechanicalElectromagneticWavesConceptTutorPattern,
  buildTransverseLongitudinalWavesConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const MECHANICAL_FINAL = /This describes a mechanical wave because it needs matter or a medium to travel\./i;
const ELECTROMAGNETIC_FINAL = /This describes an electromagnetic wave because it can travel through empty space and does not need a medium\./i;

const MECHANICAL_ELECTROMAGNETIC_STARTS = [
  {
    prompt: 'Is sound mechanical or electromagnetic?',
    choice: '1',
    finalAnswer: MECHANICAL_FINAL
  },
  {
    prompt: 'Is light mechanical or electromagnetic?',
    choice: '2',
    finalAnswer: ELECTROMAGNETIC_FINAL
  },
  {
    prompt: 'Is a radio wave mechanical or electromagnetic?',
    choice: '2',
    finalAnswer: ELECTROMAGNETIC_FINAL
  },
  {
    prompt: 'Is a microwave mechanical or electromagnetic?',
    choice: '2',
    finalAnswer: ELECTROMAGNETIC_FINAL
  },
  {
    prompt: 'Is an ocean wave mechanical or electromagnetic?',
    choice: '1',
    finalAnswer: MECHANICAL_FINAL
  },
  {
    prompt: 'Is a seismic wave mechanical or electromagnetic?',
    choice: '1',
    finalAnswer: MECHANICAL_FINAL
  },
  {
    prompt: 'Is a wave on a rope mechanical or electromagnetic?',
    choice: '1',
    finalAnswer: MECHANICAL_FINAL
  },
  {
    prompt: 'Which is mechanical: sound or light?',
    choice: '1',
    finalAnswer: MECHANICAL_FINAL
  },
  {
    prompt: 'Which is electromagnetic: sound or light?',
    choice: '2',
    finalAnswer: ELECTROMAGNETIC_FINAL
  },
  {
    prompt: 'Which type of wave needs a medium?',
    choice: '1',
    finalAnswer: MECHANICAL_FINAL
  },
  {
    prompt: 'Which type of wave can travel through empty space?',
    choice: '2',
    finalAnswer: ELECTROMAGNETIC_FINAL
  }
];

const MIXED_OR_BROAD_DIRECT_CASES = [
  {
    prompt: 'What type of wave is light?',
    includes: [/electromagnetic/i, /empty space|vacuum|space/i, /transverse/i]
  },
  {
    prompt: 'What kind of wave is light?',
    includes: [/electromagnetic/i, /empty space|vacuum|space/i, /transverse/i]
  },
  {
    prompt: 'Is light a mechanical or electromagnetic wave?',
    includes: [/electromagnetic/i, /empty space|vacuum|space/i]
  },
  {
    prompt: 'What type of wave is sound?',
    includes: [/mechanical/i, /medium|matter/i, /longitudinal|parallel/i]
  },
  {
    prompt: 'What kind of wave is sound?',
    includes: [/mechanical/i, /medium|matter/i, /longitudinal|parallel/i]
  },
  {
    prompt: 'Is sound a mechanical or electromagnetic wave?',
    includes: [/mechanical/i, /medium|matter/i]
  },
  {
    prompt: 'What type of wave is water?',
    includes: [/mechanical/i, /medium|water/i, /transverse/i]
  },
  {
    prompt: 'What kind of wave is a water wave?',
    includes: [/mechanical/i, /medium|water/i, /transverse/i]
  },
  {
    prompt: 'Is a water wave mechanical or electromagnetic?',
    includes: [/mechanical/i, /medium|water/i]
  },
  {
    prompt: 'Is a water wave longitudinal or mechanical?',
    includes: [/different classification systems/i, /mechanical/i, /medium/i, /longitudinal/i, /transverse/i]
  },
  {
    prompt: 'Is light transverse or electromagnetic?',
    includes: [/different classification systems/i, /electromagnetic/i, /empty space|vacuum|space/i, /transverse/i]
  },
  {
    prompt: 'Is sound longitudinal or mechanical?',
    includes: [/different classification systems/i, /mechanical/i, /medium/i, /longitudinal|parallel/i]
  },
  {
    prompt: 'Is light longitudinal or electromagnetic?',
    includes: [/different classification systems/i, /electromagnetic/i, /not longitudinal/i, /transverse/i]
  },
  {
    prompt: 'Is sound transverse or mechanical?',
    includes: [/different classification systems/i, /mechanical/i, /not transverse/i, /longitudinal/i]
  },
  {
    prompt: 'Is a water wave transverse or mechanical?',
    includes: [/different classification systems/i, /mechanical/i, /medium/i, /transverse/i]
  },
  {
    prompt: 'What type of wave is a radio wave?',
    includes: [/electromagnetic/i, /empty space|vacuum|space/i]
  },
  {
    prompt: 'What type of wave is a microwave?',
    includes: [/electromagnetic/i, /empty space|vacuum|space/i]
  },
  {
    prompt: 'What type of wave is a seismic wave?',
    includes: [/mechanical/i, /medium|rock|earth/i]
  },
  {
    prompt: 'What type of wave is a wave on a rope?',
    includes: [/mechanical/i, /medium|rope/i, /transverse/i]
  }
];

const TRANSVERSE_LONGITUDINAL_STILL_STARTS = [
  {
    prompt: 'Is a sound wave transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  },
  {
    prompt: 'Is a wave on a rope transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  },
  {
    prompt: 'Is a wave moving up and down transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  },
  {
    prompt: 'Is a wave moving back and forth transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  },
  {
    prompt: 'Is a wave with matter moving perpendicular to the wave direction transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  },
  {
    prompt: 'Is a wave with matter moving parallel to the wave direction transverse or longitudinal?',
    expectedTutorId: 'waves.transverse-longitudinal.identification'
  }
];

async function main() {
  assert.ok(
    buildMechanicalElectromagneticWavesConceptTutorPattern('Is sound mechanical or electromagnetic?'),
    'supported mechanical/electromagnetic prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildMechanicalElectromagneticWavesConceptTutorPattern('What type of wave is sound?'),
    null,
    'broad type-of-wave prompts should not build the mechanical/electromagnetic concept tutor pattern'
  );
  assert.equal(
    buildMechanicalElectromagneticWavesConceptTutorPattern('Is sound longitudinal or mechanical?'),
    null,
    'mixed classification systems should not build the mechanical/electromagnetic concept tutor pattern'
  );
  assert.ok(
    buildTransverseLongitudinalWavesConceptTutorPattern('Is a sound wave transverse or longitudinal?'),
    'existing transverse/longitudinal pattern should still own transverse/longitudinal prompts'
  );

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertMechanicalElectromagneticStarts({
    request,
    studentSessions,
    classSessionId
  });
  await assertInvalidChoiceRetries({ request, classSessionId });
  await assertMixedAndBroadCasesStayDirect({ request, classSessionId });
  await assertTransverseLongitudinalStillStarts({ request, classSessionId });
  await assertFormulaPromptKeepsFormulaTutor({ request, classSessionId });

  console.log('PASS concept tutor waves mechanical/electromagnetic: clean pair starts, mixed classifications stay direct, and transverse/longitudinal is preserved');
}

async function assertMechanicalElectromagneticStarts({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of MECHANICAL_ELECTROMAGNETIC_STARTS) {
    const studentHubId = `waves-me-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'waves.mechanical-electromagnetic.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /Does this wave need matter as a medium, or can it travel through empty space\?/i);
    assert.match(start.body.response, /1\. Needs matter or a medium\./i);
    assert.match(start.body.response, /2\. Can travel through empty space\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, MECHANICAL_FINAL, 'start response should hide mechanical final answer');
    assert.doesNotMatch(start.body.response, ELECTROMAGNETIC_FINAL, 'start response should hide electromagnetic final answer');

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
  const studentHubId = 'waves-mechanical-electromagnetic-invalid-choice-retry';
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: 'Is sound mechanical or electromagnetic?'
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');

  const invalid = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '3'
  });
  assert.equal(invalid.statusCode, 200);
  assert.equal(invalid.body.routeType, 'concept_tutor');
  assert.equal(invalid.body.tutor.active, true);
  assert.equal(invalid.body.tutor.currentStepIndex, 0);
  assert.match(invalid.body.response, /Please choose one of the listed options/i);
  assert.doesNotMatch(invalid.body.response, MECHANICAL_FINAL);
  assert.doesNotMatch(invalid.body.response, ELECTROMAGNETIC_FINAL);
}

async function assertMixedAndBroadCasesStayDirect({ request, classSessionId }) {
  for (const testCase of MIXED_OR_BROAD_DIRECT_CASES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `direct-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should stay direct`);
    assert.notEqual(response.body.tutor?.id, 'waves.mechanical-electromagnetic.identification');
    assert.notEqual(response.body.tutor?.id, 'waves.transverse-longitudinal.identification');
    for (const expected of testCase.includes) {
      assert.match(response.body.response, expected, `${testCase.prompt} should include ${expected}`);
    }
  }
}

async function assertTransverseLongitudinalStillStarts({ request, classSessionId }) {
  for (const testCase of TRANSVERSE_LONGITUDINAL_STILL_STARTS) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `tl-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${testCase.prompt} should still start Concept Tutor`);
    assert.equal(response.body.tutor.id, testCase.expectedTutorId);
  }
}

async function assertFormulaPromptKeepsFormulaTutor({ request, classSessionId }) {
  const prompt = 'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.';
  const response = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'formula-wave-speed',
    message: prompt
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.routeType, 'formula_tutor', `${prompt} should keep Formula Tutor priority`);
  assert.notEqual(response.body.tutor?.id, 'waves.mechanical-electromagnetic.identification');
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
