const assert = require('node:assert/strict');

const { findRelevantKnowledge, loadTeacherKnowledge } = require('../lib/knowledge/teacherKnowledge');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const {
  createStudentRouteHarness,
  teacherFactsFile
} = require('./test-helpers/studentRouteHarness');

const teacherKnowledge = loadTeacherKnowledge(teacherFactsFile);

const CATEGORIES = [
  {
    name: 'wave nature and classification',
    run: () => assertDirectStudentCases(waveNatureCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'wave parts and measurements',
    run: () => assertDirectStudentCases(wavePartsCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'wave speed and medium behavior',
    run: () => assertDirectStudentCases(speedMediumCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'wave behaviors',
    run: () => assertDirectStudentCases(waveBehaviorCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'electromagnetic spectrum',
    run: () => assertDirectStudentCases(electromagneticSpectrumCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'doppler color and lenses',
    run: () => assertDirectStudentCases(dopplerColorLensCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'formula direct answers',
    run: () => assertFormulaDirectCases(formulaCases())
  },
  {
    name: 'multiple choice classroom patterns',
    run: () => assertDirectStudentCases(multipleChoiceCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'wrong domain protections',
    run: () => assertDirectStudentCases(wrongDomainCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'formula tutor audit shape',
    run: () => assertFormulaTutorCases(formulaTutorCases())
  },
  {
    name: 'manual browser polish',
    run: () => assertManualBrowserPolishCases()
  },
  {
    name: 'concept tutor audit shape',
    run: () => assertConceptTutorCases(conceptTutorCases())
  }
];

run();

async function run() {
  const allResults = [];

  for (const category of CATEGORIES) {
    console.log('');
    console.log(`Unit 5 Waves ${category.name}:`);
    const results = await category.run();
    allResults.push(...results);
    const passed = results.filter((result) => result.passed).length;
    const failed = results.filter((result) => !result.passed).length;
    console.log(`  ${passed} passed, ${failed} failed.`);
  }

  const passed = allResults.filter((result) => result.passed).length;
  const failed = allResults.filter((result) => !result.passed);

  console.log('');
  console.log(`Unit 5 Waves regression audit passed ${passed}/${allResults.length} checks`);

  if (failed.length > 0) {
    console.log('');
    console.log('Failing checks by category:');
    for (const category of CATEGORIES) {
      const categoryFailures = failed.filter((result) => result.category === category.name);
      if (categoryFailures.length === 0) continue;
      console.log(`- ${category.name}:`);
      categoryFailures.forEach((result) => {
        console.log(`  - ${result.name}: ${result.error.message}`);
      });
    }
    process.exitCode = 1;
  }
}

async function assertDirectStudentCases(cases, { guidedTutorEnabled, assertRoute }) {
  const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: guidedTutorEnabled });
  const results = [];

  for (const testCase of cases) {
    await record(results, testCase, async () => {
      if (assertRoute) {
        const route = routeWithTeacherKnowledge(testCase.prompt);
        assertDirectRoute(route, testCase);
      }

      const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
      assert.equal(response.statusCode, 200, detail(testCase, null, response.body, 'student route should return 200'));
      assertDirectBody(response.body, testCase);
    });
  }

  return results;
}

async function assertFormulaDirectCases(cases) {
  const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: false });
  const results = [];

  for (const testCase of cases) {
    await record(results, testCase, async () => {
      const route = routeWithTeacherKnowledge(testCase.prompt);
      assert.equal(route.type, 'science_formula', detail(testCase, route, null, 'should route as a science formula'));
      assertAnswer(route.directAnswer, testCase, route);
      assertFormulaWork(route.formulaWork, testCase, route);

      const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
      assert.notEqual(response.body.routeType, 'formula_tutor', detail(testCase, route, response.body, 'guided tutor off should answer directly'));
      assertDirectBody(response.body, testCase);
    });
  }

  return results;
}

async function assertFormulaTutorCases(cases) {
  const results = [];

  for (const testCase of cases) {
    await record(results, testCase, async () => {
      const route = routeWithTeacherKnowledge(testCase.prompt);
      assert.equal(route.type, 'science_formula', detail(testCase, route, null, 'should route as science formula'));
      assertFormulaWork(route.formulaWork, testCase, route);

      const directHarness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: false });
      const direct = await sendHarnessMessage(directHarness, `${testCase.name}-direct`, testCase.prompt);
      assert.notEqual(direct.body.routeType, 'formula_tutor', detail(testCase, route, direct.body, 'direct mode should not start Formula Tutor'));
      assertAnswer(direct.body.response, testCase, route, direct.body);

      const guidedHarness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
      const guided = await sendHarnessMessage(guidedHarness, `${testCase.name}-guided`, testCase.prompt);
      assert.equal(guided.body.routeType, 'formula_tutor', detail(testCase, route, guided.body, 'guided mode should start Formula Tutor'));

      const tutor = guided.body.tutor || {};
      const work = tutor.work || {};
      const knownValues = tutor.knownValues || work.knownValues || valuesFromVariables(tutor.variables || work.variables);
      assert.equal(tutor.originalQuestion || work.originalQuestion, testCase.prompt, detail(testCase, route, guided.body, 'tutor should preserve original question'));
      assert.match(tutor.formulaId || work.formulaId || '', testCase.formulaWork.formulaId, detail(testCase, route, guided.body, 'formula id'));
      assert.match(tutor.solveFor || work.solveFor || '', testCase.formulaWork.solveFor, detail(testCase, route, guided.body, 'solve target'));
      assert.ok(Array.isArray(knownValues) && knownValues.length >= testCase.minimumKnownValues, detail(testCase, route, guided.body, 'tutor should expose known values'));
      assert.match(tutor.currentStepPrompt || work.currentStep?.prompt || '', /what variable are we solving for/i, detail(testCase, route, guided.body, 'tutor should start with solve-for step'));
      assert.doesNotMatch(`${guided.body.response || ''}\n${JSON.stringify(tutor)}`, /electric current|resistance|circuit|Newton|sidewalk|truck|suitcase/i, detail(testCase, route, guided.body, 'wave tutor should not leak unrelated domains'));

      const choice = findCorrectChoice(tutor.currentStep?.choices || work.currentStep?.choices || [], tutor.solveFor || work.solveFor || '');
      assert.ok(choice, detail(testCase, route, guided.body, 'solve-for step should expose a correct choice number'));
      const formulaStep = await sendHarnessMessage(guidedHarness, `${testCase.name}-guided`, String(choice.number));
      assert.match(formulaStep.body.tutor?.currentStepPrompt || '', /which formula/i, detail(testCase, route, formulaStep.body, 'second step should ask for formula'));
      assert.match(JSON.stringify(formulaStep.body.tutor?.currentStep?.choices || []), testCase.formulaChoice, detail(testCase, route, formulaStep.body, 'formula choices should include expected formula'));
    });
  }

  return results;
}

async function assertConceptTutorCases(cases) {
  const results = [];

  for (const testCase of cases) {
    await record(results, testCase, async () => {
      const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
      const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
      assertDirectBody(response.body, testCase);

      if (response.body.routeType === 'motion_force_knowledge_tutor' || response.body.routeType === 'general_tutor') {
        const tutor = response.body.tutor || {};
        assert.equal(tutor.originalQuestion || tutor.work?.originalQuestion, testCase.prompt, detail(testCase, null, response.body, 'concept tutor should preserve original question'));
        const tutorText = `${response.body.response || ''}\n${JSON.stringify(tutor)}`;
        assert.doesNotMatch(tutorText, /what do you think\?|tell me anything/i, detail(testCase, null, response.body, 'concept tutor should avoid vague open-ended prompts'));
        assert.match(tutorText, /\b1\.|\bchoices?\b|which\b|what\b/i, detail(testCase, null, response.body, 'concept tutor should use focused choices or short prompts'));
      }
    });
  }

  return results;
}

async function assertManualBrowserPolishCases() {
  const results = [];

  await record(results, {
    category: 'manual browser polish',
    name: 'objects-look-bent-water-refraction',
    prompt: 'what do objects look bent in water',
    expectedIdea: 'Natural bent-in-water wording should route to Unit 5 refraction, not chemistry/H2O.'
  }, async () => {
    const testCase = {
      category: 'manual browser polish',
      name: 'objects-look-bent-water-refraction',
      prompt: 'what do objects look bent in water',
      expectedIdea: 'Objects look bent in water because of refraction.',
      includes: [/refraction|refract/i, /light/i, /speed/i, /bend|bends|bent/i, /air/i, /water/i],
      excludes: [/H2O|covalent|hydrogen|oxygen|chemistry/i]
    };
    const route = routeWithTeacherKnowledge(testCase.prompt);
    assert.notEqual(route.type, 'chemistry_formula', detail(testCase, route, null, 'should not route to chemistry'));
    assertDirectRoute(route, testCase);

    const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
    const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
    assertDirectBody(response.body, testCase);
  });

  await record(results, {
    category: 'manual browser polish',
    name: 'microwave-period-step-helpful-hint',
    prompt: 'A microwave operates at 2,358,000 Hz. If speed of light is 300,000,000 m/s, what is period and wavelength?',
    expectedIdea: 'Wrong wavelength answer on period step should get a helpful period hint; scientific notation should be accepted.'
  }, async () => {
    const testCase = {
      category: 'manual browser polish',
      name: 'microwave-period-step-helpful-hint',
      prompt: 'A microwave operates at 2,358,000 Hz. If speed of light is 300,000,000 m/s, what is period and wavelength?',
      expectedIdea: 'Wrong wavelength answer on period step should get a helpful period hint; scientific notation should be accepted.'
    };
    const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
    const start = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
    assert.equal(start.body.routeType, 'formula_tutor', detail(testCase, null, start.body, 'should start Formula Tutor'));

    await sendHarnessMessage(harness, testCase.name, '1');
    await sendHarnessMessage(harness, testCase.name, '1');
    await sendHarnessMessage(harness, testCase.name, '300000000 m/s');
    const periodStep = await sendHarnessMessage(harness, testCase.name, '2358000 Hz');
    assert.match(periodStep.body.tutor?.currentStepPrompt || periodStep.body.response || '', /period/i, detail(testCase, null, periodStep.body, 'should ask for period before wavelength'));

    const wrong = await sendHarnessMessage(harness, testCase.name, '127.2');
    const wrongText = `${wrong.body.response || ''}\n${JSON.stringify(wrong.body.tutor || {})}`;
    assert.match(wrongText, /period/i, detail(testCase, null, wrong.body, 'hint should name period'));
    assert.match(wrongText, /1\s*\/\s*frequency|reciprocal/i, detail(testCase, null, wrong.body, 'hint should explain reciprocal frequency'));
    assert.match(wrongText, /small/i, detail(testCase, null, wrong.body, 'hint should flag tiny period value'));
    assert.match(wrongText, /decimal|scientific|e-7|10\^-?7/i, detail(testCase, null, wrong.body, 'hint should mention acceptable tiny-number forms'));
    assert.match(wrongText, /wavelength.*next|next.*wavelength/i, detail(testCase, null, wrong.body, 'hint should say wavelength comes next'));

    const acceptedScientific = await sendHarnessMessage(harness, testCase.name, '4.24e-7 s');
    assert.match(acceptedScientific.body.tutor?.currentStepPrompt || acceptedScientific.body.response || '', /wavelength/i, detail(testCase, null, acceptedScientific.body, 'scientific notation should advance to wavelength step'));
  });

  return results;
}

async function record(results, testCase, fn) {
  try {
    await fn();
    results.push({ category: testCase.category, name: testCase.name, passed: true });
    console.log(`  PASS ${testCase.name}`);
  } catch (error) {
    results.push({ category: testCase.category, name: testCase.name, passed: false, error });
    console.error(`  FAIL ${testCase.name}`);
    console.error(`    ${error.message}`);
  }
}

function assertDirectRoute(route, testCase) {
  assert.ok(route, detail(testCase, route, null, 'should return a route'));
  assert.notEqual(route.type, 'no_match', detail(testCase, route, null, 'should not be no_match'));
  if (!testCase.allowsFormulaRoute) {
    assert.notEqual(route.type, 'science_formula', detail(testCase, route, null, 'should not route as formula work'));
  }
  if (testCase.routeTypes) {
    assert.ok(testCase.routeTypes.includes(route.type), detail(testCase, route, null, `route should be one of ${testCase.routeTypes.join(', ')}`));
  }
  assertAnswer(route.directAnswer, testCase, route);
}

function assertDirectBody(body, testCase) {
  assert.ok(body, detail(testCase, null, body, 'should return a student body'));
  if (!testCase.allowsTutor) {
    assert.notEqual(body.routeType, 'formula_tutor', detail(testCase, null, body, 'should answer directly, not start Formula Tutor'));
    assert.notEqual(body.routeType, 'motion_force_knowledge_tutor', detail(testCase, null, body, 'should answer directly, not start General Tutor'));
  }
  if (testCase.routeTypes) {
    assert.ok(testCase.routeTypes.includes(body.routeType), detail(testCase, null, body, `body route should be one of ${testCase.routeTypes.join(', ')}`));
  }
  assertAnswer(body.response, testCase, null, body);
}

function assertAnswer(answer, testCase, route = null, body = null) {
  const answerText = String(answer || '');
  assert.ok(answerText.trim(), detail(testCase, route, body, 'should produce an answer'));

  for (const expected of testCase.includes || []) {
    assert.match(answerText, expected, detail(testCase, route, body, `should include ${expected}`));
  }

  for (const unexpected of testCase.excludes || []) {
    assert.doesNotMatch(answerText, unexpected, detail(testCase, route, body, `should not include ${unexpected}`));
  }
}

function assertFormulaWork(formulaWork, testCase, route) {
  const expected = testCase.formulaWork;
  if (!expected) return;

  assert.ok(formulaWork, detail(testCase, route, null, 'should expose formulaWork for Formula Tutor eligibility'));
  assert.match(formulaWork.formulaId || '', expected.formulaId, detail(testCase, route, null, 'formulaWork formulaId'));
  assert.match(formulaWork.solveFor || '', expected.solveFor, detail(testCase, route, null, 'formulaWork solveFor'));
  assert.ok(Array.isArray(formulaWork.steps) && formulaWork.steps.length >= expected.minimumSteps, detail(testCase, route, null, `formulaWork should include at least ${expected.minimumSteps} steps`));
}

async function createHarnessSession(options) {
  const harness = createStudentRouteHarness(options);
  const create = await harness.request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201, 'waves regression harness should create a session');
  return { ...harness, sessionId: create.body.sessionId };
}

async function sendHarnessMessage(harness, studentHubId, message) {
  const response = await harness.request('POST', '/api/student/message', {
    sessionId: harness.sessionId,
    studentHubId,
    message
  });
  assert.equal(response.statusCode, 200, `${studentHubId}: ${message}`);
  return response;
}

function routeWithTeacherKnowledge(question) {
  return routeStudentQuestion(question, findRelevantKnowledge(question, teacherKnowledge, 8));
}

function findCorrectChoice(choices, solveFor) {
  const normalizedSolveFor = String(solveFor || '').trim().toLowerCase();
  return (choices || []).find((choice) => choice.correct === true) ||
    (choices || []).find((choice) => String(choice.label || '').trim().toLowerCase() === normalizedSolveFor) ||
    null;
}

function valuesFromVariables(variables) {
  if (Array.isArray(variables)) return variables;
  if (!variables || typeof variables !== 'object') return [];
  return Object.entries(variables)
    .filter(([, variable]) => variable && typeof variable === 'object' && variable.display)
    .map(([label, variable]) => ({
      label,
      symbol: variable.symbol || '',
      display: variable.display || ''
    }));
}

function detail(testCase, route = null, body = null, message = '') {
  const parts = [
    `${label(testCase)} ${message}`.trim(),
    `Prompt: ${testCase.prompt}`,
    `Expected content: ${testCase.expectedIdea || '(see includes/excludes)'}`
  ];

  if (route) {
    parts.push(`Route: ${route.type || ''} / ${route.confidence || ''} / ${(route.toolsUsed || []).join(', ')}`);
    if (route.formulaWork) {
      parts.push(`FormulaWork: ${route.formulaWork.formulaId || ''} solving ${route.formulaWork.solveFor || ''}, steps ${(route.formulaWork.steps || []).length}`);
    }
    parts.push(`Actual route answer: ${String(route.directAnswer || '').slice(0, 1200)}`);
  }

  if (body) {
    parts.push(`Body route: ${body.routeType || ''} / ${body.confidence || ''}`);
    if (body.tutor) {
      parts.push(`Tutor metadata: ${JSON.stringify(body.tutor).slice(0, 1200)}`);
    }
    parts.push(`Actual body answer: ${String(body.response || '').slice(0, 1200)}`);
  }

  return parts.join('\n');
}

function label(testCase) {
  return `${testCase.name} [${testCase.category}]`;
}

function waveNatureCases() {
  const category = 'wave nature and classification';
  return [
    {
      category,
      name: 'wave-definition',
      prompt: 'What is a wave?',
      expectedIdea: 'A wave is a rhythmic/repeating disturbance that transfers energy through matter or space without carrying matter place to place.',
      includes: [/wave/i, /disturbance|vibration/i, /energy/i, /matter|medium|space/i],
      excludes: [/circuit|electrons|resistance/i]
    },
    {
      category,
      name: 'medium-definition',
      prompt: 'What is a medium in waves?',
      expectedIdea: 'Medium is matter/material a wave travels through, such as solid, liquid, or gas.',
      includes: [/medium/i, /matter|material|substance/i, /travels? through/i, /solid/i, /liquid/i, /gas/i],
      excludes: [/news|psychic|art/i]
    },
    {
      category,
      name: 'mechanical-waves-need-medium',
      prompt: 'Mechanical waves can only travel through what?',
      expectedIdea: 'Mechanical waves need a medium/matter and cannot travel through a vacuum.',
      includes: [/medium|matter/i, /not|cannot|can't/i, /vacuum|empty space/i]
    },
    {
      category,
      name: 'vacuum-wave-type',
      prompt: 'What type of wave can transfer energy through a vacuum?',
      expectedIdea: 'Electromagnetic waves can transfer energy through a vacuum.',
      includes: [/electromagnetic/i, /vacuum|empty space/i]
    },
    {
      category,
      name: 'astronauts-see-not-hear',
      prompt: 'Why can astronauts see each other in space but not hear each other talking?',
      expectedIdea: 'Light/electromagnetic waves travel through vacuum; sound/mechanical waves need a medium.',
      includes: [/light|electromagnetic/i, /vacuum|space/i, /sound/i, /medium|matter/i],
      excludes: [/because sound is faster/i]
    },
    {
      category,
      name: 'sound-wave-type',
      prompt: 'What type of wave is sound?',
      expectedIdea: 'Sound is a longitudinal/compressional mechanical wave that needs a medium.',
      includes: [/longitudinal|compressional/i, /mechanical/i, /medium|matter/i]
    },
    {
      category,
      name: 'transverse-wave-definition',
      prompt: 'What is a transverse wave?',
      expectedIdea: 'Particles move perpendicular/right angles to wave direction.',
      includes: [/transverse/i, /perpendicular|right angle/i, /direction/i]
    },
    {
      category,
      name: 'longitudinal-wave-definition',
      prompt: 'What is a longitudinal wave?',
      expectedIdea: 'Particles move parallel/same direction as wave motion; compressional.',
      includes: [/longitudinal/i, /parallel|same direction/i, /compression|compressional/i]
    }
  ];
}

function wavePartsCases() {
  const category = 'wave parts and measurements';
  return [
    {
      category,
      name: 'crest-highest-point',
      prompt: 'What is the highest point of a transverse wave?',
      expectedIdea: 'Highest point is the crest/peak.',
      includes: [/crest|peak/i]
    },
    {
      category,
      name: 'trough-lowest-point',
      prompt: 'What is the lowest point of a transverse wave?',
      expectedIdea: 'Lowest point is the trough.',
      includes: [/trough/i]
    },
    {
      category,
      name: 'compression-pushed-together',
      prompt: 'Where particles are pushed together in a longitudinal wave is called what?',
      expectedIdea: 'Particles pushed together are a compression.',
      includes: [/compression/i, /pushed together|close together|crowded/i]
    },
    {
      category,
      name: 'rarefaction-spread-apart',
      prompt: 'Where particles are spread apart in a longitudinal wave is called what?',
      expectedIdea: 'Particles spread apart are a rarefaction.',
      includes: [/rarefaction/i, /spread apart|farther apart/i]
    },
    {
      category,
      name: 'amplitude-represents-energy',
      prompt: 'What does amplitude represent?',
      expectedIdea: 'Amplitude represents wave energy; height in transverse waves or compression density in longitudinal waves.',
      includes: [/amplitude/i, /energy/i],
      excludes: [/electric current|circuit/i]
    },
    {
      category,
      name: 'transverse-wavelength-measurement',
      prompt: 'How is wavelength measured in a transverse wave?',
      expectedIdea: 'Wavelength is measured crest to crest or trough to trough.',
      includes: [/crest to crest|crest.*crest/i, /trough to trough|trough.*trough/i]
    },
    {
      category,
      name: 'longitudinal-wavelength-measurement',
      prompt: 'How is wavelength measured in a longitudinal wave?',
      expectedIdea: 'Wavelength is measured compression to compression or rarefaction to rarefaction.',
      includes: [/compression to compression|compression.*compression/i, /rarefaction to rarefaction|rarefaction.*rarefaction/i]
    },
    {
      category,
      name: 'period-definition',
      prompt: 'What is period in waves?',
      expectedIdea: 'Period is time for one wavelength/cycle to pass a point, measured in seconds.',
      includes: [/period/i, /time/i, /one wave|one cycle|one wavelength/i, /seconds|s\b/i]
    },
    {
      category,
      name: 'frequency-definition',
      prompt: 'What is frequency in waves?',
      expectedIdea: 'Frequency is waves per second, measured in Hertz/Hz.',
      includes: [/frequency/i, /waves?.*second|cycles?.*second|per second/i, /hertz|Hz/i]
    },
    {
      category,
      name: 'frequency-period-relationship',
      prompt: 'What is the relationship between frequency and period?',
      expectedIdea: 'Frequency and period are inverse/reciprocal: T = 1/f and f = 1/T.',
      includes: [/inverse|reciprocal/i, /T\s*=\s*1\s*\/\s*f/i, /f\s*=\s*1\s*\/\s*T/i]
    },
    {
      category,
      name: 'wavelength-increases-frequency-decreases',
      prompt: 'As wavelength increases, what happens to frequency?',
      expectedIdea: 'Frequency decreases as wavelength increases.',
      includes: [/frequency/i, /decreases|goes down|lower/i]
    },
    {
      category,
      name: 'higher-frequency-shorter-wavelength',
      prompt: 'Higher frequency means what kind of wavelength?',
      expectedIdea: 'Higher frequency means shorter wavelength.',
      includes: [/shorter|short/i, /wavelength/i]
    }
  ];
}

function speedMediumCases() {
  const category = 'wave speed and medium behavior';
  return [
    {
      category,
      name: 'sound-fastest-metal-spoon-choice',
      prompt: 'Sound travels fastest through which choice: space, cool air, warm air, or a metal spoon?',
      expectedIdea: 'Sound travels fastest through the metal spoon/solid.',
      includes: [/metal spoon|spoon|solid/i],
      excludes: [/space|vacuum/i]
    },
    {
      category,
      name: 'sound-fastest-solid',
      prompt: 'Sound travels fastest through solid, liquid, gas, or empty space?',
      expectedIdea: 'Sound travels fastest through solids.',
      includes: [/solid/i],
      excludes: [/empty space|vacuum/i]
    },
    {
      category,
      name: 'light-fastest-vacuum',
      prompt: 'Light or electromagnetic waves travel fastest through solid, liquid, gas, or empty space?',
      expectedIdea: 'Electromagnetic waves travel fastest through empty space/vacuum.',
      includes: [/empty space|vacuum/i],
      excludes: [/solid/i]
    },
    {
      category,
      name: 'mechanical-waves-warmer-medium',
      prompt: 'Why do mechanical waves travel faster through warmer mediums?',
      expectedIdea: 'Warmer particles move faster and collide more often.',
      includes: [/particles?/i, /move faster|faster motion/i, /collide|collisions/i]
    },
    {
      category,
      name: 'loud-sound-not-faster',
      prompt: 'Do loud sounds travel faster than soft sounds?',
      expectedIdea: 'No; loudness/amplitude changes energy, not speed.',
      includes: [/no/i, /loudness|amplitude/i, /speed/i, /medium/i],
      excludes: [/yes/i]
    },
    {
      category,
      name: 'pitch-not-speed',
      prompt: 'Does pitch affect sound speed?',
      expectedIdea: 'No; pitch is frequency, while medium controls sound speed.',
      includes: [/no/i, /pitch/i, /frequency/i, /medium/i],
      excludes: [/yes/i]
    }
  ];
}

function waveBehaviorCases() {
  const category = 'wave behaviors';
  return [
    {
      category,
      name: 'reflection-bounces-off',
      prompt: 'Reflection occurs when a wave does what?',
      expectedIdea: 'Reflection is when a wave strikes an object and bounces off.',
      includes: [/bounce|bounces/i, /object|surface/i]
    },
    {
      category,
      name: 'echo-reflection',
      prompt: 'Echo is an example of what sound behavior?',
      expectedIdea: 'An echo is sound reflection.',
      includes: [/reflection/i]
    },
    {
      category,
      name: 'angle-reflection-30',
      prompt: 'If the angle of incidence is 30 degrees, what is the angle of reflection?',
      expectedIdea: 'Angle of reflection is 30 degrees.',
      includes: [/30\s*(?:degrees|°)/i]
    },
    {
      category,
      name: 'angle-incidence-25',
      prompt: 'If the angle of reflection is 25 degrees, what is the angle of incidence?',
      expectedIdea: 'Angle of incidence is 25 degrees.',
      includes: [/25\s*(?:degrees|°)/i]
    },
    {
      category,
      name: 'law-of-reflection',
      prompt: 'What is the law of reflection?',
      expectedIdea: 'Angle of incidence equals angle of reflection.',
      includes: [/angle of incidence/i, /angle of reflection/i, /equal|same/i]
    },
    {
      category,
      name: 'normal-line',
      prompt: 'What is the normal line?',
      expectedIdea: 'Normal line is perpendicular to the reflecting surface.',
      includes: [/perpendicular|90/i, /surface/i]
    },
    {
      category,
      name: 'refraction-speed-change',
      prompt: 'Refraction occurs when a wave changes what as it passes into a different medium?',
      expectedIdea: 'Refraction occurs when speed changes and the wave bends.',
      includes: [/speed/i, /bend|bending/i, /medium/i]
    },
    {
      category,
      name: 'pencil-broken-water',
      prompt: 'Why does a pencil look broken in water?',
      expectedIdea: 'Refraction: light changes speed/bends between air and water.',
      includes: [/refraction|refracts/i, /light/i, /speed/i, /bend|bends/i, /air/i, /water/i]
    },
    {
      category,
      name: 'prism-separates-white-light',
      prompt: 'Why does a prism separate white light?',
      expectedIdea: 'Different wavelengths/colors refract and bend different amounts.',
      includes: [/refraction|refract|bend/i, /different/i, /colors?|wavelengths?/i]
    },
    {
      category,
      name: 'rainbow-cause',
      prompt: 'What causes a rainbow?',
      expectedIdea: 'Rainbows form from refraction/dispersion separating light colors.',
      includes: [/refraction|dispersion/i, /colors?|wavelengths?/i, /bend|separate/i]
    },
    {
      category,
      name: 'diffraction-definition',
      prompt: 'Diffraction means what?',
      expectedIdea: 'Diffraction is bending around an object or through an opening.',
      includes: [/bend|bending/i, /around|through/i, /object|opening/i]
    },
    {
      category,
      name: 'radio-diffract-better',
      prompt: 'Why do radio waves diffract better than visible light?',
      expectedIdea: 'Radio waves have longer wavelengths than visible light.',
      includes: [/radio/i, /longer wavelength/i, /visible light/i, /shorter wavelength/i]
    },
    {
      category,
      name: 'absorption-definition',
      prompt: 'Absorption means what in waves?',
      expectedIdea: 'Wave energy goes into a material and may become thermal energy.',
      includes: [/energy/i, /material|object/i, /thermal|heat/i]
    },
    {
      category,
      name: 'carpet-absorption',
      prompt: 'Why are carpeted houses quieter than tile or hardwood?',
      expectedIdea: 'Carpet absorbs sound energy.',
      includes: [/absorb|absorption/i, /sound/i, /carpet/i]
    },
    {
      category,
      name: 'interference-definition',
      prompt: 'Interference means what in waves?',
      expectedIdea: 'Two or more waves overlap/combine to form a new wave.',
      includes: [/two|more/i, /waves/i, /overlap|combine/i, /new wave|result/i]
    },
    {
      category,
      name: 'noise-canceling-headphones',
      prompt: 'Noise-canceling headphones are an example of what behavior?',
      expectedIdea: 'Noise canceling uses destructive interference.',
      includes: [/destructive interference|interference/i, /cancel|out of phase/i]
    },
    {
      category,
      name: 'constructive-interference-definition',
      prompt: 'Constructive interference means what?',
      expectedIdea: 'Like parts line up/add and amplitude increases.',
      includes: [/add|combine|line up/i, /amplitude/i, /increase|larger/i]
    },
    {
      category,
      name: 'destructive-interference-definition',
      prompt: 'Destructive interference means what?',
      expectedIdea: 'Opposite parts line up/subtract/cancel and amplitude decreases.',
      includes: [/cancel|subtract|opposite/i, /amplitude/i, /decrease|smaller/i]
    },
    {
      category,
      name: 'standing-wave-definition',
      prompt: 'What is a standing wave?',
      expectedIdea: 'Opposite traveling waves continuously interfere and form a pattern that appears not to move.',
      includes: [/opposite directions?|opposite/i, /interfere|interference/i, /appears? not to move|stationary/i]
    },
    {
      category,
      name: 'node-definition',
      prompt: 'What is a node in a standing wave?',
      expectedIdea: 'A node is a point where waves cancel or there is no vibration.',
      includes: [/node/i, /cancel|no vibration|not vibrat/i]
    },
    {
      category,
      name: 'resonance-definition',
      prompt: 'What is resonance?',
      expectedIdea: 'Object vibrates at natural frequency because another object vibrates at same frequency.',
      includes: [/natural frequency/i, /vibrate|vibration/i, /same frequency/i]
    }
  ];
}

function electromagneticSpectrumCases() {
  const category = 'electromagnetic spectrum';
  return [
    {
      category,
      name: 'electromagnetic-waves-definition',
      prompt: 'What are electromagnetic waves?',
      expectedIdea: 'Electric and magnetic waves from vibrating electric charge transfer energy through a vacuum without a medium.',
      includes: [/electric/i, /magnetic/i, /energy/i, /vacuum|empty space/i, /medium/i]
    },
    {
      category,
      name: 'em-speed-vacuum',
      prompt: 'What speed do all electromagnetic waves travel in a vacuum?',
      expectedIdea: 'All EM waves travel 300,000,000 m/s or 3 x 10^8 m/s in vacuum.',
      includes: [/3\s*(?:x|×|\*)\s*10\^?8|300,?000,?000/i, /m\/s/i]
    },
    {
      category,
      name: 'em-spectrum-represents',
      prompt: 'What does the electromagnetic spectrum represent?',
      expectedIdea: 'The EM spectrum is the entire range of electromagnetic radiation frequencies.',
      includes: [/entire range|range/i, /frequenc/i, /electromagnetic radiation|electromagnetic waves/i]
    },
    {
      category,
      name: 'em-spectrum-order',
      prompt: 'Put the EM spectrum in order from longest wavelength and lowest frequency to shortest wavelength and highest frequency.',
      expectedIdea: 'Radio, microwave, infrared, visible, ultraviolet, X-ray, gamma ray.',
      includes: [/radio[\s\S]*microwave[\s\S]*infrared[\s\S]*visible[\s\S]*ultraviolet[\s\S]*x-?ray[\s\S]*gamma/i]
    },
    {
      category,
      name: 'longest-em-wavelength',
      prompt: 'Which EM wave has the longest wavelength?',
      expectedIdea: 'Radio waves have the longest wavelength.',
      includes: [/radio/i]
    },
    {
      category,
      name: 'shortest-highest-em',
      prompt: 'Which EM wave has the shortest wavelength and highest frequency?',
      expectedIdea: 'Gamma rays have shortest wavelength/highest frequency.',
      includes: [/gamma/i]
    },
    {
      category,
      name: 'visible-light-color-order',
      prompt: 'What is the visible light color order?',
      expectedIdea: 'ROYGBIV, red longest and violet shortest.',
      includes: [/ROYGBIV|red.*orange.*yellow.*green.*blue.*indigo.*violet/i, /red/i, /violet/i]
    },
    {
      category,
      name: 'infrared-night-vision-remote',
      prompt: 'What type of waves are used in night vision goggles and remote controls?',
      expectedIdea: 'Infrared waves.',
      includes: [/infrared/i]
    },
    {
      category,
      name: 'microwaves-uses',
      prompt: 'What type of EM radiation is used for cooking, Doppler radar, GPS, and mobile phone signals?',
      expectedIdea: 'Microwaves.',
      includes: [/microwave/i]
    },
    {
      category,
      name: 'ultraviolet-vitamin-d-bacteria',
      prompt: 'What wave gives vitamin D and kills bacteria?',
      expectedIdea: 'Ultraviolet.',
      includes: [/ultraviolet|UV/i]
    },
    {
      category,
      name: 'xray-uses-risk',
      prompt: 'What are X-rays used for and what is the overexposure risk?',
      expectedIdea: 'X-rays image bones/CAT scans; overexposure can cause cancer or cell damage.',
      includes: [/bone|CAT scan|medical image|image/i, /cancer|cell damage|damage cells/i]
    },
    {
      category,
      name: 'gamma-rays-uses-risk',
      prompt: 'What are gamma rays used for?',
      expectedIdea: 'Gamma rays can kill cancer cells, sterilize equipment, or trace radioactivity; high energy can damage cells.',
      includes: [/cancer|steriliz|radioactive tracer/i, /danger|damage|high energy/i]
    }
  ];
}

function dopplerColorLensCases() {
  const category = 'doppler color and lenses';
  return [
    {
      category,
      name: 'doppler-effect-definition',
      prompt: 'What is the Doppler effect?',
      expectedIdea: 'Change in frequency/pitch due to moving wave source.',
      includes: [/change/i, /frequency|pitch/i, /moving|motion/i, /source/i]
    },
    {
      category,
      name: 'siren-approaches',
      prompt: 'As a fire truck siren approaches, what happens to wavelength, frequency, and pitch?',
      expectedIdea: 'Approaching source compresses waves: shorter wavelength, higher frequency, higher pitch.',
      includes: [/shorter wavelength|compressed/i, /higher frequency/i, /higher pitch/i]
    },
    {
      category,
      name: 'siren-moves-away',
      prompt: 'As an ambulance siren moves away, what happens to wavelength, frequency, and pitch?',
      expectedIdea: 'Moving away spreads waves: longer wavelength, lower frequency, lower pitch.',
      includes: [/longer wavelength|spread out/i, /lower frequency/i, /lower pitch/i]
    },
    {
      category,
      name: 'red-shirt',
      prompt: 'Why does a red shirt appear red?',
      expectedIdea: 'It absorbs most colors and reflects red light to your eyes/retina.',
      includes: [/absorbs?|absorb/i, /reflects? red/i, /eyes?|retina/i]
    },
    {
      category,
      name: 'rods-and-cones',
      prompt: 'What do rods and cones do?',
      expectedIdea: 'Rods help in low light/night; cones allow color vision/bright light.',
      includes: [/rods?/i, /low light|night/i, /cones?/i, /color/i]
    },
    {
      category,
      name: 'convex-lens',
      prompt: 'Describe a convex lens.',
      expectedIdea: 'Convex is converging, thicker middle, bends light inward to focal point, helps farsightedness/magnification.',
      includes: [/convex/i, /converging|converge/i, /thicker middle|middle.*thick/i, /focal point|inward/i],
      excludes: [/near-?sighted/i]
    },
    {
      category,
      name: 'concave-lens',
      prompt: 'Describe a concave lens.',
      expectedIdea: 'Concave is diverging, thicker edges, bends light outward, helps nearsightedness.',
      includes: [/concave/i, /diverging|diverge/i, /thicker edges|edges.*thick/i, /outward/i],
      excludes: [/far-?sighted/i]
    }
  ];
}

function formulaCases() {
  const category = 'formula direct answers';
  return [
    {
      category,
      name: 'wave-speed-2m-3hz',
      prompt: 'What is the speed of a wave with wavelength 2 m and frequency 3 Hz?',
      expectedIdea: 'v = wavelength x frequency = 6 m/s.',
      includes: [/wave speed|speed|velocity/i, /3\s*Hz\s*(?:×|\*)\s*2\s*m|2\s*m\s*(?:×|\*)\s*3\s*Hz/i, /6\s*m\/s/i],
      formulaWork: { formulaId: /wave_speed_frequency_wavelength/, solveFor: /wave speed|speed|velocity/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'wave-velocity-400hz-0-5m',
      prompt: 'What is the velocity of a wave that has a frequency of 400 Hz and a wavelength of 0.5 meters?',
      expectedIdea: 'v = 400 x 0.5 = 200 m/s.',
      includes: [/400\s*Hz/i, /0\.5\s*m/i, /200\s*m\/s/i],
      formulaWork: { formulaId: /wave_speed_frequency_wavelength/, solveFor: /wave speed|speed|velocity/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'sound-frequency-330-0-1',
      prompt: 'The speed of sound is 330 m/s. What is the frequency of a sound wave with a wavelength of 0.1 m?',
      expectedIdea: 'f = 330 / 0.1 = 3300 Hz.',
      includes: [/frequency/i, /330\s*m\/s\s*\/\s*0\.1\s*m/i, /3300\s*Hz/i],
      formulaWork: { formulaId: /wave_speed_frequency_wavelength/, solveFor: /frequency/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'ocean-frequency-3-5-4',
      prompt: 'Ocean waves crash at 3.5 m/s. The distance between crests is 4 m. Find frequency.',
      expectedIdea: 'f = 3.5 / 4 = 0.875 Hz.',
      includes: [/frequency/i, /3\.5\s*m\/s\s*\/\s*4\s*m/i, /0\.875\s*Hz|0\.88\s*Hz/i],
      formulaWork: { formulaId: /wave_speed_frequency_wavelength/, solveFor: /frequency/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'wave-velocity-25hz-10m',
      prompt: 'What is the velocity of a wave having frequency 25 Hz and wavelength 10 m?',
      expectedIdea: 'v = 25 x 10 = 250 m/s.',
      includes: [/25\s*Hz/i, /10\s*m/i, /250\s*m\/s/i],
      formulaWork: { formulaId: /wave_speed_frequency_wavelength/, solveFor: /wave speed|speed|velocity/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'frequency-and-period-12-3',
      prompt: 'A wave is traveling at 12 m/s and its wavelength is 3 m. Calculate frequency and period.',
      expectedIdea: 'f = 4 Hz and T = 0.25 s.',
      includes: [/frequency/i, /4\s*Hz/i, /period/i, /0\.25\s*s|0\.25\s*seconds/i],
      formulaWork: { formulaId: /wave_speed_frequency_wavelength|wave/, solveFor: /frequency|period/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'tuning-fork-velocity',
      prompt: 'A tuning fork has frequency 280 Hz and wavelength 1.5 m. Calculate velocity.',
      expectedIdea: 'v = 420 m/s.',
      includes: [/280\s*Hz/i, /1\.5\s*m/i, /420\s*m\/s/i],
      formulaWork: { formulaId: /wave_speed_frequency_wavelength/, solveFor: /wave speed|speed|velocity/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'wavelength-from-period',
      prompt: 'A wave is moving toward shore with velocity 4 m/s. Its period is 0.4 s. What is wavelength?',
      expectedIdea: 'f = 2.5 Hz and wavelength = 1.6 m.',
      includes: [/frequency/i, /2\.5\s*Hz/i, /wavelength/i, /1\.6\s*m/i],
      formulaWork: { formulaId: /wave|period/i, solveFor: /wavelength/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'cicada-frequency',
      prompt: 'Cicadas produce a buzzing sound with wavelength 2.69 m. Speed of sound is 346 m/s. What is frequency?',
      expectedIdea: 'f = 346 / 2.69 = about 128.6 Hz.',
      includes: [/frequency/i, /346\s*m\/s\s*\/\s*2\.69\s*m/i, /128\.6(?:\d+)?\s*Hz|129\s*Hz/i],
      formulaWork: { formulaId: /wave_speed_frequency_wavelength/, solveFor: /frequency/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'light-wavelength-scientific',
      prompt: 'The speed of light is 3 x 10^8 m/s. If frequency is 4.11 x 10^4 Hz, what is wavelength?',
      expectedIdea: 'wavelength is about 7299 m or 7.299 x 10^3 m, not 7.299 x 10^11.',
      includes: [/wavelength/i, /7299(?:\.\d+)?\s*m|7\.299\s*(?:x|×|\*)\s*10\^?3\s*m/i],
      excludes: [/7\.299\s*(?:x|×|\*)\s*10\^?11/i],
      formulaWork: { formulaId: /wave_speed_frequency_wavelength/, solveFor: /wavelength/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'distance-time-then-frequency',
      prompt: 'A wave travels 60 meters in 5 seconds and has wavelength 3 meters. What is frequency?',
      expectedIdea: 'First speed = 60 / 5 = 12 m/s, then f = 12 / 3 = 4 Hz.',
      includes: [/60\s*(?:meters|m)\s*\/\s*5\s*(?:seconds|s)|speed\s*=\s*12\s*m\/s/i, /frequency/i, /4\s*Hz/i],
      formulaWork: { formulaId: /wave|speed_distance_time/i, solveFor: /frequency/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'water-waves-rate-speed-period',
      prompt: 'Water waves are 0.075 m long. They pass a point at a rate of 21 waves every 3 seconds. What is speed and period?',
      expectedIdea: 'f = 7 Hz, v = 0.525 m/s, T = 0.143 s; do not treat 21 waves every 3 seconds as 21 Hz.',
      includes: [/7\s*Hz/i, /0\.525\s*m\/s/i, /0\.143\s*s|0\.14\s*s/i],
      excludes: [/21\s*Hz/i],
      formulaWork: { formulaId: /wave|period/i, solveFor: /speed|period/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'microwave-period-wavelength',
      prompt: 'A microwave operates at 2,358,000 Hz. If speed of light is 300,000,000 m/s, what is period and wavelength?',
      expectedIdea: 'Using prompt values, T is about 4.24 x 10^-7 s and wavelength is about 127.2 m.',
      includes: [/4\.24\s*(?:x|×|\*)\s*10\^-?7\s*s|0\.000000424\s*s/i, /127\.2\s*m/i],
      excludes: [/GHz/i],
      formulaWork: { formulaId: /wave|period/i, solveFor: /period|wavelength/i, minimumSteps: 5 }
    }
  ];
}

function multipleChoiceCases() {
  const category = 'multiple choice classroom patterns';
  return [
    {
      category,
      name: 'mc-refraction-changes-speed',
      prompt: 'In refraction, what changes? A. mass B. speed C. charge',
      expectedIdea: 'Refraction changes speed.',
      includes: [/speed|B\b/i]
    },
    {
      category,
      name: 'mc-carpet-absorption',
      prompt: 'Carpet quiets sound by which wave behavior? A. absorption B. refraction C. diffraction',
      expectedIdea: 'Carpet quiets sound by absorption.',
      includes: [/absorption|A\b/i]
    },
    {
      category,
      name: 'mc-compressional-sound',
      prompt: 'Which is an example of a compressional wave? A. sound wave B. X-ray C. light wave',
      expectedIdea: 'Sound is compressional.',
      includes: [/sound|A\b/i]
    },
    {
      category,
      name: 'mc-amplitude-louder',
      prompt: 'Increasing amplitude of sound makes it ____.',
      expectedIdea: 'Increasing amplitude makes sound louder.',
      includes: [/louder|loud/i]
    },
    {
      category,
      name: 'mc-reflection-bounce',
      prompt: 'In order for reflection to occur, a wave must ____.',
      expectedIdea: 'Wave must bounce off an object/surface.',
      includes: [/bounce|bounces/i, /object|surface/i]
    },
    {
      category,
      name: 'mc-transmit-energy',
      prompt: 'What do X-rays, UV waves, and sound waves all transmit?',
      expectedIdea: 'They all transmit energy.',
      includes: [/energy/i]
    },
    {
      category,
      name: 'mc-constructive-two-crests',
      prompt: 'Constructive interference happens when two crests meet. What happens?',
      expectedIdea: 'The waves add and amplitude increases.',
      includes: [/add|combine/i, /amplitude/i, /increase|larger/i]
    },
    {
      category,
      name: 'mc-sound-vacuum',
      prompt: 'Can sound travel through empty space or a vacuum?',
      expectedIdea: 'Sound cannot travel through a vacuum.',
      includes: [/no|cannot|can't/i, /vacuum|empty space/i, /medium/i]
    },
    {
      category,
      name: 'mc-visible-light-diffraction',
      prompt: 'Why does visible light not diffract as well as radio waves?',
      expectedIdea: 'Visible light has wavelengths that are too small/short.',
      includes: [/visible light/i, /shorter|small/i, /wavelength/i]
    },
    {
      category,
      name: 'mc-tuning-fork-resonance',
      prompt: 'A tuning fork starts vibrating from a piano note. What is this called?',
      expectedIdea: 'Resonance.',
      includes: [/resonance/i]
    },
    {
      category,
      name: 'mc-gamma-cell-damage',
      prompt: 'Which waves can break down molecules and cells?',
      expectedIdea: 'Gamma rays.',
      includes: [/gamma/i]
    },
    {
      category,
      name: 'mc-uv-bacteria-vitamin-d',
      prompt: 'Which waves can kill bacteria and help make vitamin D?',
      expectedIdea: 'Ultraviolet waves.',
      includes: [/ultraviolet|UV/i]
    },
    {
      category,
      name: 'mc-infrared-night-vision',
      prompt: 'Which waves are used for night vision and remote controls?',
      expectedIdea: 'Infrared.',
      includes: [/infrared/i]
    },
    {
      category,
      name: 'mc-radio-wifi-tv-cell',
      prompt: 'Which waves are used for Wi-Fi, TV, cell phones, MRI, or RADAR depending on wording?',
      expectedIdea: 'Radio waves.',
      includes: [/radio/i]
    },
    {
      category,
      name: 'mc-microwaves-cooking-gps-radar',
      prompt: 'Which waves are used for cooking, GPS, and Doppler radar?',
      expectedIdea: 'Microwaves.',
      includes: [/microwave/i]
    }
  ];
}

function wrongDomainCases() {
  const category = 'wrong domain protections';
  return [
    {
      category,
      name: 'frequency-wave-not-study-habit',
      prompt: 'In waves, what is frequency?',
      expectedIdea: 'Frequency should answer waves per second, not general study frequency.',
      includes: [/waves?|cycles?/i, /second/i, /Hz|hertz/i],
      excludes: [/how often you study|schedule|habit/i]
    },
    {
      category,
      name: 'amplitude-not-electricity',
      prompt: 'What does amplitude mean for a sound wave?',
      expectedIdea: 'Amplitude is related to energy/loudness, not circuit current.',
      includes: [/amplitude/i, /energy|loudness|loud/i],
      excludes: [/electric current|circuit|voltage|resistance/i]
    },
    {
      category,
      name: 'resistance-medium-not-circuit',
      prompt: 'When a medium resists a wave, what happens to the wave energy?',
      expectedIdea: 'Wave energy can be absorbed/converted, without circuit helper text.',
      includes: [/wave/i, /energy/i, /absorbed|absorption|converted|thermal|heat/i],
      excludes: [/Ohm|circuit|electrons|voltage|current/i]
    },
    {
      category,
      name: 'current-in-waves-not-electric-current',
      prompt: 'In a wave tank, the current makes the water waves move. Is this electrical current?',
      expectedIdea: 'Water current context should not route to electric current/resistance.',
      includes: [/water/i, /waves?/i],
      excludes: [/electrons|amps|voltage|resistance|circuit/i]
    },
    {
      category,
      name: 'direct-wave-no-unrelated-helpful-connection',
      prompt: 'Why do radio waves diffract better than visible light?',
      expectedIdea: 'Direct Unit 5 answer should not add unrelated Helpful connection text.',
      includes: [/longer wavelength/i],
      excludes: [/Helpful connection:[\s\S]*(?:Newton|circuit|Longitudinal Waves|Battery|Electric Current)/i]
    }
  ];
}

function formulaTutorCases() {
  const category = 'formula tutor audit shape';
  return [
    {
      category,
      name: 'wave-speed-tutor-shape',
      prompt: 'What is the speed of a wave with wavelength 2 m and frequency 3 Hz?',
      expectedIdea: 'Formula Tutor should solve wave speed with v = lambda f and known frequency/wavelength.',
      includes: [/6\s*m\/s/i],
      minimumKnownValues: 2,
      formulaChoice: /frequency.*wavelength|wavelength.*frequency|wave speed/i,
      formulaWork: { formulaId: /wave_speed_frequency_wavelength/, solveFor: /wave speed|speed|velocity/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'wave-frequency-tutor-shape',
      prompt: 'The speed of sound is 330 m/s. What is the frequency of a sound wave with a wavelength of 0.1 m?',
      expectedIdea: 'Formula Tutor should solve frequency with f = v / lambda and known speed/wavelength.',
      includes: [/3300\s*Hz/i],
      minimumKnownValues: 2,
      formulaChoice: /wave speed.*wavelength|frequency/i,
      formulaWork: { formulaId: /wave_speed_frequency_wavelength/, solveFor: /frequency/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'wave-wavelength-tutor-shape',
      prompt: 'The speed of light is 3 x 10^8 m/s. If frequency is 4.11 x 10^4 Hz, what is wavelength?',
      expectedIdea: 'Formula Tutor should solve wavelength with lambda = v / f and should not use wrong scientific notation.',
      includes: [/7299(?:\.\d+)?\s*m|7\.299\s*(?:x|×|\*)\s*10\^?3\s*m/i],
      excludes: [/7\.299\s*(?:x|×|\*)\s*10\^?11/i],
      minimumKnownValues: 2,
      formulaChoice: /wave speed.*frequency|wavelength/i,
      formulaWork: { formulaId: /wave_speed_frequency_wavelength/, solveFor: /wavelength/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'period-derived-tutor-shape',
      prompt: 'A wave is traveling at 12 m/s and its wavelength is 3 m. Calculate frequency and period.',
      expectedIdea: 'Tutor should solve both frequency and period without saying derived period was written in the problem.',
      includes: [/4\s*Hz/i, /0\.25\s*s/i],
      minimumKnownValues: 2,
      formulaChoice: /frequency|period|wave speed/i,
      formulaWork: { formulaId: /wave|period/i, solveFor: /frequency|period/i, minimumSteps: 5 }
    }
  ];
}

function conceptTutorCases() {
  const category = 'concept tutor audit shape';
  return [
    {
      category,
      name: 'transverse-concept-tutor-shape',
      prompt: 'Teach me transverse waves as a quick guided question.',
      expectedIdea: 'If a concept tutor starts, it should keep the original question and ask focused choices.',
      includes: [/transverse|perpendicular|wave/i],
      allowsTutor: true
    },
    {
      category,
      name: 'reflection-concept-tutor-shape',
      prompt: 'Quiz me on reflection of waves.',
      expectedIdea: 'If a concept tutor starts, it should ask focused reflection choices rather than vague prompts.',
      includes: [/reflection|bounce|wave/i],
      allowsTutor: true
    }
  ];
}
