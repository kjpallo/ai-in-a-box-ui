const assert = require('node:assert/strict');

const {
  buildEndothermicExothermicConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const ENDOTHERMIC_PROCESS_FINAL = /This is an endothermic process because it absorbs thermal energy from the surroundings\./i;
const EXOTHERMIC_PROCESS_FINAL = /This is an exothermic process because it releases thermal energy to the surroundings\./i;
const ENDOTHERMIC_REACTION_FINAL = /This is an endothermic reaction because it absorbs thermal energy from the surroundings\. The surroundings lose thermal energy and usually become cooler\./i;
const EXOTHERMIC_REACTION_FINAL = /This is an exothermic reaction because it releases thermal energy to the surroundings\. The surroundings gain thermal energy and usually become warmer\./i;

const SUPPORTED_ENDO_EXO_CASES = [
  {
    prompt: 'Is melting ice endothermic or exothermic?',
    choice: '1',
    finalAnswer: ENDOTHERMIC_PROCESS_FINAL,
    scenarioType: 'process'
  },
  {
    prompt: 'Is evaporation endothermic or exothermic?',
    choice: '1',
    finalAnswer: ENDOTHERMIC_PROCESS_FINAL,
    scenarioType: 'process'
  },
  {
    prompt: 'Is an instant cold pack endothermic or exothermic?',
    choice: '1',
    finalAnswer: ENDOTHERMIC_PROCESS_FINAL,
    scenarioType: 'process'
  },
  {
    prompt: 'Is fire burning endothermic or exothermic?',
    choice: '2',
    finalAnswer: EXOTHERMIC_PROCESS_FINAL,
    scenarioType: 'process'
  },
  {
    prompt: 'Is fire endothermic or exothermic?',
    choice: '2',
    finalAnswer: EXOTHERMIC_PROCESS_FINAL,
    scenarioType: 'process'
  },
  {
    prompt: 'Is a hand warmer endothermic or exothermic?',
    choice: '2',
    finalAnswer: EXOTHERMIC_PROCESS_FINAL,
    scenarioType: 'process'
  },
  {
    prompt: 'Is freezing water endothermic or exothermic?',
    choice: '2',
    finalAnswer: EXOTHERMIC_PROCESS_FINAL,
    scenarioType: 'process'
  },
  {
    prompt: 'Which is endothermic: melting ice or fire burning?',
    choice: '1',
    finalAnswer: ENDOTHERMIC_PROCESS_FINAL,
    scenarioType: 'process'
  },
  {
    prompt: 'Which is exothermic: melting ice or fire burning?',
    choice: '2',
    finalAnswer: EXOTHERMIC_PROCESS_FINAL,
    scenarioType: 'process'
  },
  {
    prompt: 'A chemical reaction releases thermal energy into the room. Is it endothermic or exothermic, and what happens to the surroundings?',
    choice: '2',
    finalAnswer: EXOTHERMIC_REACTION_FINAL,
    scenarioType: 'chemical_reaction'
  },
  {
    prompt: 'A reaction absorbs thermal energy from the room. Is it endothermic or exothermic, and what happens to the surroundings?',
    choice: '1',
    finalAnswer: ENDOTHERMIC_REACTION_FINAL,
    scenarioType: 'chemical_reaction'
  }
];

const DIRECT_ENERGY_RESPONSE_CASES = [
  {
    prompt: 'What happens to the surroundings during an exothermic process?',
    includes: [/exothermic process/i, /releases thermal energy to the surroundings/i],
    excludes: [/\breaction\b/i, /usually become warmer/i]
  },
  {
    prompt: 'What happens to the surroundings during an endothermic process?',
    includes: [/endothermic process/i, /absorbs thermal energy from the surroundings/i],
    excludes: [/\breaction\b/i, /usually become cooler/i]
  },
  {
    prompt: 'What happens to the surroundings during an exothermic reaction?',
    includes: [/exothermic/i, /release(?:s)? thermal energy to the surroundings/i, /surroundings gain thermal energy/i, /usually become warmer/i],
    excludes: [/Exergonic means/i]
  },
  {
    prompt: 'During a chemical reaction, heat flows from the reacting chemicals into the surrounding air. Classify the reaction and explain what happens to the air.',
    includes: [/exothermic/i, /thermal energy flows from the reacting chemicals to the surrounding air/i, /air gains thermal energy/i, /usually becomes warmer/i],
    excludes: [/process where substances change into new substances/i]
  },
  {
    prompt: 'How are the surroundings affected by an endothermic reaction?',
    includes: [/endothermic/i, /absorb(?:s)? thermal energy from the surroundings/i, /surroundings lose thermal energy/i, /usually become cooler/i],
    excludes: [/Endergonic means/i]
  },
  {
    prompt: 'What happens to the surroundings during an endothermic reaction?',
    includes: [/endothermic/i, /absorb(?:s)? thermal energy from the surroundings/i, /surroundings lose thermal energy/i, /usually become cooler/i],
    excludes: [/Endergonic means/i]
  },
  {
    prompt: 'A reaction gives off heat to its surroundings. Classify it and explain the effect on the surroundings.',
    includes: [/exothermic/i, /surroundings gain thermal energy/i, /usually become warmer/i],
    excludes: [/process where substances change into new substances/i]
  },
  {
    prompt: 'Thermal energy flows from the surrounding air into the reacting chemicals. Classify the reaction and explain what happens to the air.',
    includes: [/endothermic/i, /air loses thermal energy/i, /usually becomes cooler/i],
    excludes: [/process where substances change into new substances/i]
  }
];

const ENERGY_RESPONSE_BOUNDARY_CASES = [
  {
    prompt: 'What is room temperature?',
    includes: [],
    excludes: [/surroundings (?:gain|lose) thermal energy/i, /usually become (?:warmer|cooler)/i]
  },
  {
    prompt: 'Why does warm air rise?',
    includes: [],
    excludes: [/surroundings (?:gain|lose) thermal energy/i, /usually become (?:warmer|cooler)/i]
  },
  {
    prompt: 'What is thermal energy?',
    includes: [],
    excludes: [/surroundings (?:gain|lose) thermal energy/i, /usually become (?:warmer|cooler)/i]
  },
  {
    prompt: 'Air is in the room during the reaction.',
    includes: [],
    excludes: [/surroundings (?:gain|lose) thermal energy/i, /usually become (?:warmer|cooler)/i]
  },
  {
    prompt: 'A student heats water in a room.',
    includes: [],
    excludes: [/surroundings (?:gain|lose) thermal energy/i, /usually become (?:warmer|cooler)/i]
  },
  {
    prompt: 'Does every reaction make a room warmer?',
    includes: [],
    excludes: [/surroundings (?:gain|lose) thermal energy/i, /usually become (?:warmer|cooler)/i]
  },
  {
    prompt: 'What happens when air absorbs sound energy?',
    includes: [],
    excludes: [/surroundings (?:gain|lose) thermal energy/i, /usually become (?:warmer|cooler)/i]
  },
  {
    prompt: 'What is a chemical reaction?',
    includes: [/process where substances change into new substances/i],
    excludes: [/usually become warmer|usually become cooler/i]
  },
  {
    prompt: 'What is an exergonic reaction?',
    includes: [/Exergonic means a reaction releases energy overall/i],
    excludes: [/Exothermic means|usually become warmer/i]
  },
  {
    prompt: 'What is an endergonic reaction?',
    includes: [/Endergonic means a reaction absorbs energy overall/i],
    excludes: [/Endothermic means|usually become cooler/i]
  },
  {
    prompt: 'What does exothermic mean?',
    includes: [/Exothermic means a reaction releases heat energy/i],
    excludes: [/Exergonic means/i]
  },
  {
    prompt: 'What does endothermic mean?',
    includes: [/Endothermic means a reaction absorbs heat energy/i],
    excludes: [/Endergonic means/i]
  },
  {
    prompt: 'Does an exothermic reaction release heat?',
    choice: '2',
    includes: [/exothermic reaction/i, /releases thermal energy to the surroundings/i, /surroundings gain thermal energy/i, /usually become warmer/i],
    excludes: [/Exergonic means/i]
  },
  {
    prompt: 'Does an endothermic reaction absorb heat?',
    choice: '1',
    includes: [/endothermic reaction/i, /absorbs thermal energy from the surroundings/i, /surroundings lose thermal energy/i, /usually become cooler/i],
    excludes: [/Endergonic means/i]
  },
  {
    prompt: 'Classify this reaction: 2KClO3 → 2KCl + 3O2',
    includes: [/decomposition reaction/i],
    excludes: [/exothermic|endothermic/i]
  },
  {
    prompt: 'What is air resistance in a room?',
    includes: [/air resistance/i],
    excludes: [/exothermic|endothermic|usually become warmer|usually become cooler/i]
  },
  {
    prompt: 'A poster in the room lists the words heat and reaction. What is a poster?',
    includes: [/do not have a trusted local science fact|chemical reaction/i],
    excludes: [/exothermic|endothermic|usually become warmer|usually become cooler/i]
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: 'What is endothermic?',
    includes: /endothermic|absorbed|surroundings/i
  },
  {
    prompt: 'Define endothermic.',
    includes: /endothermic|absorbed|surroundings/i
  },
  {
    prompt: 'What is exothermic?',
    includes: /exothermic|released|surroundings/i
  },
  {
    prompt: 'Define exothermic.',
    includes: /exothermic|released|surroundings/i
  },
  {
    prompt: 'Explain the difference between endothermic and exothermic.',
    includes: /endothermic|absorbs|exothermic|releases/i
  },
  {
    prompt: 'Give examples of endothermic and exothermic processes.',
    includes: /endothermic|melting|evaporation|cold pack|exothermic|burning|freezing|hand warmer/i
  }
];

const PHYSICAL_CHEMICAL_CASES_TO_PRESERVE = [
  'Is ice melting a physical or chemical change?',
  'Is water freezing a physical or chemical change?',
  'Is wood burning a physical or chemical change?',
  'Is baking a cake a physical or chemical change?'
];

const ENERGY_TRANSFER_CASES_TO_PRESERVE = [
  'Is heat from the Sun conduction, convection, or radiation?',
  'Is heat from a lamp conduction, convection, or radiation?',
  'Is boiling water heated by a stove conduction, convection, or radiation?'
];

const FORMULA_CASES_TO_PRESERVE = [
  'Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.',
  'Calculate thermal energy if mass is 2 kg, specific heat is 4 J/g°C, and temperature change is 5°C.',
  'Calculate power if work is 100 J and time is 5 s.',
  'Calculate work if force is 10 N and distance is 3 m.'
];

const EXISTING_CONCEPT_TUTOR_CASES = [
  {
    prompt: 'Is a circuit with a closed switch open or closed?',
    expectedTutorId: 'electricity.circuits.open-closed.identification'
  },
  {
    prompt: 'Is a circuit with one path series or parallel?',
    expectedTutorId: 'electricity.circuits.series-parallel.identification'
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
    prompt: 'Is vinegar acidic, basic, or neutral?',
    expectedTutorId: 'chemistry.acids-bases.identification'
  }
];

async function main() {
  assert.ok(
    buildEndothermicExothermicConceptTutorPattern('Is melting ice endothermic or exothermic?'),
    'supported endothermic/exothermic prompts should build the concept tutor pattern'
  );
  assert.equal(
    buildEndothermicExothermicConceptTutorPattern('What is endothermic?'),
    null,
    'definition prompts should not build the endothermic/exothermic concept tutor pattern'
  );
  assert.equal(
    buildEndothermicExothermicConceptTutorPattern('Explain the difference between endothermic and exothermic.'),
    null,
    'broad difference prompts should not build the endothermic/exothermic concept tutor pattern'
  );
  assert.equal(
    buildEndothermicExothermicConceptTutorPattern('Is ice melting a physical or chemical change?'),
    null,
    'physical/chemical prompts should not build the endothermic/exothermic concept tutor pattern'
  );
  assert.equal(
    buildEndothermicExothermicConceptTutorPattern('Is heat from the Sun conduction, convection, or radiation?'),
    null,
    'energy transfer prompts should not build the endothermic/exothermic concept tutor pattern'
  );
  assert.equal(
    buildEndothermicExothermicConceptTutorPattern('Calculate power if work is 100 J and time is 5 s.'),
    null,
    'formula prompts should not build the endothermic/exothermic concept tutor pattern'
  );
  assertPatternScenarioTypeConsistency();

  const { request, studentSessions } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  await assertSupportedEndothermicExothermicPromptsStartAndComplete({
    request,
    studentSessions,
    classSessionId
  });
  await assertAmbiguousBurningPromptStaysNeutral({ request, classSessionId });
  await assertScenarioTypeStateAuthority({ request, studentSessions, classSessionId });
  await assertDirectAnswerPromptsBypassConceptTutor({ request, classSessionId });
  await assertDirectEnergyResponses({ request, classSessionId });
  await assertEnergyResponseBoundaries({ request, classSessionId });
  await assertPhysicalChemicalConceptTutorStillStarts({ request, classSessionId });
  await assertEnergyTransferConceptTutorStillStarts({ request, classSessionId });
  await assertFormulaPromptsKeepFormulaRoute({ request, classSessionId });
  await assertExistingConceptTutorsStillStart({ request, classSessionId });

  console.log('PASS concept tutor endothermic/exothermic: starts narrowly and preserves direct/physical-chemical/energy-transfer/formula/existing routes');
}

function assertPatternScenarioTypeConsistency() {
  const cases = [
    ['Is a hand warmer endothermic or exothermic?', 'process', /\bprocess\b/i, /\breaction\b/i],
    ['Is fire endothermic or exothermic?', 'process', /\bprocess\b/i, /\breaction\b/i],
    ['Is melting ice endothermic or exothermic?', 'process', /\bprocess\b/i, /\breaction\b/i],
    ['A chemical reaction releases thermal energy into the room. Is it endothermic or exothermic?', 'chemical_reaction', /\breaction\b/i, /\bprocess\b/i]
  ];

  for (const [prompt, scenarioType, includes, excludes] of cases) {
    const pattern = buildEndothermicExothermicConceptTutorPattern(prompt);
    assert.ok(pattern, `${prompt} should build the endothermic/exothermic pattern`);
    assert.equal(pattern.scenarioType, scenarioType);
    assert.match(pattern.finalAnswer, includes);
    assert.doesNotMatch(pattern.finalAnswer, excludes);
    for (const choice of pattern.steps[0].choices) {
      assert.match(choice.finalAnswer, includes, 'choice-level and pattern-level final answers should use the same scenario type');
      assert.doesNotMatch(choice.finalAnswer, excludes, 'choice-level final answers should not switch scenario type');
    }
  }
}

async function assertSupportedEndothermicExothermicPromptsStartAndComplete({
  request,
  studentSessions,
  classSessionId
}) {
  for (const testCase of SUPPORTED_ENDO_EXO_CASES) {
    const studentHubId = `endo-exo-${testCase.choice}-${slug(testCase.prompt)}`;
    const start = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });

    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
    assert.equal(start.body.tutor.id, 'energy.processes.endothermic-exothermic.identification');
    assert.equal(start.body.tutor.active, true);
    assert.equal(start.body.tutor.originalQuestion, testCase.prompt);
    assert.equal(start.body.tutor.finalAnswer, undefined, 'active tutor metadata should hide final answer');
    assert.equal(start.body.tutor.work.finalAnswer, '', 'active tutor work should hide final answer');
    assert.match(start.body.response, /What happens to thermal energy\?/i);
    assert.match(start.body.response, /1\. Energy is absorbed from the surroundings\./i);
    assert.match(start.body.response, /2\. Energy is released to the surroundings\./i);
    assert.match(start.body.response, /type only the number/i);
    assert.doesNotMatch(start.body.response, ENDOTHERMIC_PROCESS_FINAL, 'start response should hide endothermic process final answer');
    assert.doesNotMatch(start.body.response, EXOTHERMIC_PROCESS_FINAL, 'start response should hide exothermic process final answer');
    assert.doesNotMatch(start.body.response, ENDOTHERMIC_REACTION_FINAL, 'start response should hide endothermic reaction final answer');
    assert.doesNotMatch(start.body.response, EXOTHERMIC_REACTION_FINAL, 'start response should hide exothermic reaction final answer');

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
    if (testCase.scenarioType === 'process') {
      assert.doesNotMatch(complete.body.response, /\breaction\b/i, `${testCase.prompt} should not call a physical process a reaction`);
      assert.doesNotMatch(complete.body.tutor.finalAnswer, /\breaction\b/i, `${testCase.prompt} tutor state should not call a physical process a reaction`);
    } else {
      assert.match(complete.body.response, /\b(?:endothermic|exothermic) reaction\b/i, `${testCase.prompt} should retain chemical-reaction wording`);
    }
    const hub = studentSessions[classSessionId].anonymousHubs[studentHubId];
    assert.equal(hub.currentTutorProblem, null);
    assert.equal(hub.messageCount, 2, 'tutor completion should record exactly the prompt and controlled choice');
    assert.equal(hub.messages.length, 2, 'tutor transcript should not duplicate prompt or choice entries');
    assert.equal(hub.messages[1].contextPrompt, testCase.prompt, 'completed tutor turn should retain the original prompt as context');
    assert.equal(hub.messages[1].tutorOriginalQuestion, testCase.prompt);
  }
}

async function assertAmbiguousBurningPromptStaysNeutral({ request, classSessionId }) {
  const prompt = 'My skin is burning after touching a hot pan.';
  const response = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId: 'endo-exo-ambiguous-skin-burning',
    message: prompt
  });
  assert.equal(response.statusCode, 200);
  assert.notEqual(response.body.tutor?.id, 'energy.processes.endothermic-exothermic.identification');
  assert.doesNotMatch(response.body.response, /\b(?:endothermic|exothermic) reaction\b/i);
}

async function assertScenarioTypeStateAuthority({ request, studentSessions, classSessionId }) {
  const studentHubId = 'endo-exo-scenario-type-authority';
  const explicitReactionPrompt = 'A chemical reaction releases thermal energy into the room. Is it endothermic or exothermic, and what happens to the surroundings?';
  const ambiguousProcessPrompt = 'Is a hand warmer endothermic or exothermic?';

  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: explicitReactionPrompt
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor');

  const wrong = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '1',
    scenarioType: 'process',
    action: { scenarioType: 'process' }
  });
  assert.equal(wrong.statusCode, 200);
  assert.equal(wrong.body.routeType, 'concept_tutor');
  assert.equal(wrong.body.tutor.active, true);
  assert.equal(wrong.body.tutor.currentStepIndex, 0);
  assert.match(wrong.body.response, /Not quite|not the best fit/i);
  assert.doesNotMatch(wrong.body.response, EXOTHERMIC_REACTION_FINAL);

  const reactionComplete = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '2',
    scenarioType: 'process',
    action: { scenarioType: 'process' }
  });
  assert.equal(reactionComplete.body.tutor?.completed, true);
  assert.match(reactionComplete.body.response, EXOTHERMIC_REACTION_FINAL, 'active tutor state should remain authoritative over action payloads');
  assert.equal(studentSessions[classSessionId].anonymousHubs[studentHubId].currentTutorProblem, null);

  const processStart = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: ambiguousProcessPrompt
  });
  assert.equal(processStart.body.tutor?.active, true);
  assert.doesNotMatch(processStart.body.response, EXOTHERMIC_REACTION_FINAL, 'a new prompt should not reuse completed reaction metadata');

  const processWrong = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '1',
    scenarioType: 'chemical_reaction',
    action: { scenarioType: 'chemical_reaction' }
  });
  assert.equal(processWrong.body.tutor?.active, true);
  assert.equal(processWrong.body.tutor?.currentStepIndex, 0);
  assert.match(processWrong.body.response, /Not quite|not the best fit/i);

  const processComplete = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: '2',
    scenarioType: 'chemical_reaction',
    action: { scenarioType: 'chemical_reaction' }
  });
  assert.equal(processComplete.body.tutor?.completed, true);
  assert.match(processComplete.body.response, EXOTHERMIC_PROCESS_FINAL, 'retry and action payloads should not change the active scenario type');
  assert.doesNotMatch(processComplete.body.response, /\breaction\b/i);

  const hub = studentSessions[classSessionId].anonymousHubs[studentHubId];
  assert.equal(hub.currentTutorProblem, null);
  assert.equal(hub.messageCount, 6);
  assert.equal(hub.messages.length, 6, 'state-authority transcript should contain one clean entry per public request');
  assert.equal(hub.messages[2].contextPrompt, explicitReactionPrompt);
  assert.equal(hub.messages[5].contextPrompt, ambiguousProcessPrompt);
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
    assert.notEqual(response.body.tutor?.id, 'energy.processes.endothermic-exothermic.identification');
    assert.match(response.body.response, testCase.includes);
  }
}

async function assertDirectEnergyResponses({ request, classSessionId }) {
  for (const testCase of DIRECT_ENERGY_RESPONSE_CASES) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `energy-response-${slug(testCase.prompt)}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    assert.notEqual(response.body.routeType, 'concept_tutor', `${testCase.prompt} should receive a direct grounded answer`);
    for (const pattern of testCase.includes) {
      assert.match(response.body.response, pattern, `${testCase.prompt} should include ${pattern}`);
    }
    for (const pattern of testCase.excludes) {
      assert.doesNotMatch(response.body.response, pattern, `${testCase.prompt} should not include ${pattern}`);
    }
  }
}

async function assertEnergyResponseBoundaries({ request, classSessionId }) {
  for (const testCase of ENERGY_RESPONSE_BOUNDARY_CASES) {
    const studentHubId = `energy-boundary-${slug(testCase.prompt)}`;
    let response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200);
    if (testCase.choice) {
      assert.equal(response.body.routeType, 'concept_tutor', `${testCase.prompt} should preserve its existing Concept Tutor route`);
      assert.equal(response.body.tutor?.id, 'energy.processes.endothermic-exothermic.identification');
      response = await request('POST', '/api/student/message', {
        sessionId: classSessionId,
        studentHubId,
        message: testCase.choice
      });
      assert.equal(response.body.tutor?.completed, true);
    } else {
      assert.notEqual(
        response.body.tutor?.id,
        'energy.processes.endothermic-exothermic.identification',
        `${testCase.prompt} should not start the energy Concept Tutor`
      );
    }
    for (const pattern of testCase.includes) {
      assert.match(response.body.response, pattern, `${testCase.prompt} should include ${pattern}`);
    }
    for (const pattern of testCase.excludes) {
      assert.doesNotMatch(response.body.response, pattern, `${testCase.prompt} should not include ${pattern}`);
    }
  }
}

async function assertPhysicalChemicalConceptTutorStillStarts({ request, classSessionId }) {
  for (const prompt of PHYSICAL_CHEMICAL_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `physical-chemical-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${prompt} should still start physical/chemical Concept Tutor`);
    assert.equal(response.body.tutor.id, 'matter.physical-chemical-change.identification');
  }
}

async function assertEnergyTransferConceptTutorStillStarts({ request, classSessionId }) {
  for (const prompt of ENERGY_TRANSFER_CASES_TO_PRESERVE) {
    const response = await request('POST', '/api/student/message', {
      sessionId: classSessionId,
      studentHubId: `energy-transfer-${slug(prompt)}`,
      message: prompt
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.routeType, 'concept_tutor', `${prompt} should still start energy-transfer Concept Tutor`);
    assert.equal(response.body.tutor.id, 'energy.transfer.conduction-convection-radiation');
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
    assert.notEqual(response.body.tutor?.id, 'energy.processes.endothermic-exothermic.identification');
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
