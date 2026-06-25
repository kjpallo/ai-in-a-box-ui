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
    name: 'core vocabulary routing',
    run: () => assertDirectStudentCases(coreVocabularyCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'multiple choice and fill blanks',
    run: () => assertDirectStudentCases(multipleChoiceAndFillBlankCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'ohms law formulas',
    run: () => assertFormulaDirectCases(ohmsLawCases())
  },
  {
    name: 'circuit resistance formulas',
    run: () => assertFormulaDirectCases(circuitResistanceCases())
  },
  {
    name: 'electrical power formulas',
    run: () => assertFormulaDirectCases(electricalPowerCases())
  },
  {
    name: 'formula tutor gating',
    run: () => assertTutorGatingCases(tutorGatingCases())
  },
  {
    name: 'formula tutor wording',
    run: () => assertTutorWordingCases(tutorWordingCases())
  },
  {
    name: 'circuit concepts',
    run: () => assertDirectStudentCases(circuitConceptCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'circuit components and symbols',
    run: () => assertDirectStudentCases(circuitComponentCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'magnetism concepts',
    run: () => assertDirectStudentCases(magnetismCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'open response explanations',
    run: () => assertDirectStudentCases(openResponseCases(), {
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
    name: 'student route debug',
    run: () => assertStudentRouteDebugCases(studentRouteDebugCases())
  }
];

run();

async function run() {
  const allResults = [];

  for (const category of CATEGORIES) {
    console.log('');
    console.log(`Unit 4 Electricity ${category.name}:`);
    const results = await category.run();
    allResults.push(...results);
    const passed = results.filter((result) => result.passed).length;
    const failed = results.filter((result) => !result.passed).length;
    console.log(`  ${passed} passed, ${failed} failed.`);
  }

  const passed = allResults.filter((result) => result.passed).length;
  const failed = allResults.filter((result) => !result.passed);

  console.log('');
  console.log(`Unit 4 Electricity regression audit passed ${passed}/${allResults.length} checks`);

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
      assert.equal(response.body.statusCode, undefined);
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
      assert.notEqual(response.body.routeType, 'formula_tutor', detail(testCase, route, response.body, 'should answer directly when guided tutor is off'));
      assertDirectBody(response.body, testCase);
    });
  }

  return results;
}

async function assertTutorGatingCases(cases) {
  const results = [];

  for (const testCase of cases) {
    await record(results, testCase, async () => {
      const route = routeWithTeacherKnowledge(testCase.prompt);
      assert.equal(route.type, 'science_formula', detail(testCase, route, null, 'should route as a science formula'));
      assertFormulaWork(route.formulaWork, testCase, route);

      const directHarness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: false });
      const direct = await sendHarnessMessage(directHarness, `${testCase.name}-direct`, testCase.prompt);
      assert.notEqual(direct.body.routeType, 'formula_tutor', detail(testCase, route, direct.body, 'direct-answer mode should not start Formula Tutor'));
      assertAnswer(direct.body.response, testCase, route);

      const guidedHarness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
      const guided = await sendHarnessMessage(guidedHarness, `${testCase.name}-guided`, testCase.prompt);
      assert.equal(guided.body.routeType, 'formula_tutor', detail(testCase, route, guided.body, 'should start Formula Tutor when guided tutoring is enabled'));
      assert.equal(guided.body.tutor?.active, true, detail(testCase, route, guided.body, 'tutor should be active'));
      assert.match(guided.body.tutor?.formulaId || '', testCase.formulaId, detail(testCase, route, guided.body, 'formula id'));
      assert.match(guided.body.tutor?.solveFor || '', testCase.solveFor, detail(testCase, route, guided.body, 'solve target'));
      assert.equal(guided.body.tutor?.originalQuestion, testCase.prompt, detail(testCase, route, guided.body, 'should keep original question'));
      assert.ok(guided.body.tutor?.totalSteps > 0, detail(testCase, route, guided.body, 'should expose total steps'));
    });
  }

  return results;
}

async function assertTutorWordingCases(cases) {
  const results = [];

  for (const testCase of cases) {
    await record(results, testCase, async () => {
      const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
      const start = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
      assert.equal(start.body.routeType, 'formula_tutor', detail(testCase, null, start.body, 'should start Formula Tutor so wording can be audited'));

      const tutor = start.body.tutor || {};
      const work = tutor.work || {};
      const startText = `${start.body.response || ''}\n${JSON.stringify(tutor)}`;
      const knownValues = tutor.knownValues || work.knownValues || valuesFromVariables(tutor.variables || work.variables);
      assert.equal(tutor.originalQuestion || work.originalQuestion, testCase.prompt, detail(testCase, null, start.body, 'should preserve original question context'));
      assert.ok(Array.isArray(knownValues), detail(testCase, null, start.body, 'should expose known values'));
      assert.ok(knownValues.length >= testCase.minimumKnownValues, detail(testCase, null, start.body, 'should expose the problem known values'));
      assert.match(tutor.currentStepPrompt || work.currentStep?.prompt || '', /what variable are we solving for|what kind of circuit is it/i, detail(testCase, null, start.body, 'should begin with a concrete guided prompt'));
      assert.doesNotMatch(startText, /PJ|sidewalk|doorstep|pool|truck|suitcase|Newton'?s Second Law|motion\/force/i, detail(testCase, null, start.body, 'should not leak motion/force wording'));
      assert.doesNotMatch(start.body.response || '', /what should we do next\?/i, detail(testCase, null, start.body, 'should not use a vague open-ended formula prompt'));

      const solveTargetChoice = findCorrectChoice(
        tutor.currentStep?.choices || work.currentStep?.choices || [],
        tutor.solveFor || work.solveFor || ''
      );

      if (solveTargetChoice) {
        const formulaStep = await sendHarnessMessage(harness, testCase.name, String(solveTargetChoice.number));
        assert.match(formulaStep.body.tutor?.currentStepPrompt || '', /which formula|what number|what operation|substitute/i, detail(testCase, null, formulaStep.body, 'should advance to the next concrete tutor step'));
      }

      const stopped = await sendHarnessMessage(harness, testCase.name, 'stop');
      assert.equal(stopped.body.tutor?.stopped, true, detail(testCase, null, stopped.body, 'should stop tutor cleanly'));
      assert.equal(stopped.body.tutor?.currentStep, null, detail(testCase, null, stopped.body, 'should clear stale choices after stop'));
    });
  }

  return results;
}

async function assertStudentRouteDebugCases(cases) {
  const results = [];

  for (const testCase of cases) {
    await record(results, testCase, async () => {
      const harness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: testCase.guidedTutorEnabled });
      const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
      assertDirectBody(response.body, testCase);

      const interaction = harness.studentInteractionLog.at(-1);
      assert.ok(interaction, detail(testCase, null, response.body, 'should log a completed student interaction'));
      const debugText = JSON.stringify(interaction.debug || {});
      for (const expected of testCase.debugIncludes || []) {
        assert.match(debugText, expected, detail(testCase, null, response.body, `debug should include ${expected}`));
      }
    });
  }

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
  assert.equal(create.statusCode, 201, 'electricity regression harness should create a session');
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
  return Object.values(variables)
    .filter((variable) => variable && typeof variable === 'object' && variable.display);
}

function detail(testCase, route = null, body = null, message = '') {
  const parts = [
    `${label(testCase)} ${message}`.trim(),
    `Prompt: ${testCase.prompt}`,
    `Expected idea: ${testCase.expectedIdea || '(see includes/excludes)'}`
  ];

  if (route) {
    parts.push(`Route: ${route.type || ''} / ${route.confidence || ''} / ${(route.toolsUsed || []).join(', ')}`);
    if (route.formulaWork) {
      parts.push(`FormulaWork: ${route.formulaWork.formulaId || ''} solving ${route.formulaWork.solveFor || ''}, steps ${(route.formulaWork.steps || []).length}`);
    }
    parts.push(`Route answer: ${String(route.directAnswer || '').slice(0, 900)}`);
  }

  if (body) {
    parts.push(`Body route: ${body.routeType || ''} / ${body.confidence || ''}`);
    if (body.tutor) {
      parts.push(`Tutor: ${JSON.stringify(body.tutor).slice(0, 900)}`);
    }
    parts.push(`Body answer: ${String(body.response || '').slice(0, 900)}`);
  }

  return parts.join('\n');
}

function label(testCase) {
  return `${testCase.name} [${testCase.category}]`;
}

function coreVocabularyCases() {
  const category = 'core vocabulary routing';
  return [
    {
      category,
      name: 'circuit-complete-path',
      prompt: 'What is a circuit in electricity?',
      expectedIdea: 'Circuit is a complete/closed/unbroken path for electric current.',
      includes: [/circuit/i, /path/i, /current|charge/i, /complete|closed|flow/i]
    },
    {
      category,
      name: 'electrons-negative-electricity',
      prompt: 'What are electrons?',
      expectedIdea: 'Electrons are negatively charged particles involved in electricity.',
      includes: [/electron/i, /negative/i, /charge/i]
    },
    {
      category,
      name: 'protons-positive',
      prompt: 'What charge do protons have?',
      expectedIdea: 'Protons have positive charge.',
      includes: [/proton/i, /positive/i],
      excludes: [/negative/i]
    },
    {
      category,
      name: 'neutrons-no-charge',
      prompt: 'What charge do neutrons have?',
      expectedIdea: 'Neutrons have no charge.',
      includes: [/neutron/i, /neutral|no electric charge|no charge/i]
    },
    {
      category,
      name: 'static-electricity-buildup',
      prompt: 'What is static electricity?',
      expectedIdea: 'Static electricity is build-up/accumulation of excess electric charge.',
      includes: [/static electricity/i, /buildup|build up|built up|accumulation/i, /charge/i]
    },
    {
      category,
      name: 'electroscope-detects-charge',
      prompt: 'What is an electroscope used for?',
      expectedIdea: 'Electroscope detects electrical charge.',
      includes: [/electroscope/i, /detect/i, /charge/i]
    },
    {
      category,
      name: 'electric-field-force-distance',
      prompt: 'What is an electric field?',
      expectedIdea: 'Electric field is area around charged objects that can exert force at a distance.',
      includes: [/electric field/i, /area|around/i, /charged|charge/i, /force|push|pull/i, /distance/i]
    },
    {
      category,
      name: 'voltage-difference-push',
      prompt: 'What is voltage difference in a circuit?',
      expectedIdea: 'Voltage difference is the push that causes charges to move.',
      includes: [/voltage difference|voltage|potential difference/i, /push|causes/i, /charge|current/i, /flow|move/i]
    },
    {
      category,
      name: 'current-flow-amps',
      prompt: 'What is electric current?',
      expectedIdea: 'Current is flow/net movement of electric charge/electrons, measured in amps.',
      includes: [/current/i, /flow|movement/i, /charge|electron/i, /amps?|amperes?/i],
      excludes: [/present day|news|event/i]
    },
    {
      category,
      name: 'resistance-opposes-electron-flow',
      prompt: 'In electricity, what is resistance?',
      expectedIdea: 'Resistance opposes electron/current flow and is measured in ohms.',
      includes: [/resistance/i, /opposition|opposes|difficult|resist/i, /current|electron|charge/i, /ohms?|Ω/i],
      excludes: [/friction|horse|image|political/i]
    },
    {
      category,
      name: 'conductor-electrons-easily',
      prompt: 'What is a conductor in electricity?',
      expectedIdea: 'Conductors allow electrons/current to flow easily.',
      includes: [/conductor/i, /allow|let/i, /charge|current|electrons/i, /easily/i]
    },
    {
      category,
      name: 'insulator-electrons-not-easily',
      prompt: 'What is an insulator in electricity?',
      expectedIdea: 'Insulators do not allow electrons/current to flow easily.',
      includes: [/insulator/i, /does not|do not|resist/i, /charge|current|electrons/i, /easily/i]
    },
    {
      category,
      name: 'conservation-charge',
      prompt: 'What is the law of conservation of charge?',
      expectedIdea: 'Charge cannot be created or destroyed, only transferred.',
      includes: [/charge/i, /cannot be created/i, /cannot be destroyed/i, /transfer|transferred/i]
    }
  ];
}

function multipleChoiceAndFillBlankCases() {
  const category = 'multiple choice and fill blanks';
  return [
    {
      category,
      name: 'mc-conductor-copper',
      prompt: 'Which choice is a conductor? A. rubber B. copper C. plastic D. wood',
      expectedIdea: 'Copper is a conductor.',
      includes: [/copper|B\b/i, /conductor/i],
      excludes: [/rubber is a conductor|plastic is a conductor|wood is a conductor/i]
    },
    {
      category,
      name: 'mc-open-switch-no-current',
      prompt: 'An open switch means: A. current flows B. current does not flow C. voltage is zero',
      expectedIdea: 'Open switch means incomplete path and no current flow.',
      includes: [/current does not flow|does not flow|no current|B\b/i],
      excludes: [/current flows\b/i]
    },
    {
      category,
      name: 'student-letter-parallel-homes',
      prompt: 'Homes and schools are usually wired in which kind of circuit? A. series B. parallel',
      expectedIdea: 'Homes/schools usually use parallel circuits.',
      includes: [/parallel|B\b/i]
    },
    {
      category,
      name: 'fill-voltage-push',
      prompt: 'The force or push that causes electric charges to move in a circuit is ____.',
      expectedIdea: 'Voltage difference is the push that moves charges in a circuit.',
      includes: [/voltage difference|voltage|potential difference/i],
      excludes: [/electric field is the answer/i]
    },
    {
      category,
      name: 'fill-series-one-path',
      prompt: 'A circuit with one path for current is a ____ circuit.',
      expectedIdea: 'One path means series circuit.',
      includes: [/series/i, /one path/i]
    },
    {
      category,
      name: 'fill-like-poles-repel',
      prompt: 'Two north magnetic poles will ____ each other.',
      expectedIdea: 'Like magnetic poles repel.',
      includes: [/repel/i],
      excludes: [/attract/i]
    }
  ];
}

function ohmsLawCases() {
  const category = 'ohms law formulas';
  return [
    ohmsCase(category, 'voltage-20a-30ohm-600v', 'What is the voltage if current is 20 amps and resistance is 30 ohms?', /V\s*=\s*I\s*(?:×|\*)\s*R|voltage\s*=\s*current/i, /600\s*V\b/i, /voltage/i),
    ohmsCase(category, 'resistance-180v-9a-20ohm', 'A 180 V battery has 9 amps of current. What is the resistance?', /R\s*=\s*V\s*\/\s*I|resistance\s*=\s*voltage/i, /20\s*(?:Ω|ohms?)/i, /resistance/i),
    ohmsCase(category, 'voltage-20ohm-10a-200v', 'Resistance is 20 ohms and current is 10 amps. Find voltage.', /V\s*=\s*I\s*(?:×|\*)\s*R|voltage/i, /200\s*V\b/i, /voltage/i),
    ohmsCase(category, 'current-210v-3ohm-70a', 'What current flows through 3 ohms with a 210 V battery?', /I\s*=\s*V\s*\/\s*R|current/i, /70\s*A\b|70\s*amps?/i, /current/i),
    ohmsCase(category, 'resistance-8v-15a-0-53ohm', 'What resistance is in a circuit with 8 V and 15 amps?', /R\s*=\s*V\s*\/\s*I|resistance/i, /0\.53(?:33)?\s*(?:Ω|ohms?)/i, /resistance/i),
    ohmsCase(category, 'current-9v-0-2ohm-45a', 'What current flows if 9 V goes through 0.2 ohms?', /I\s*=\s*V\s*\/\s*R|current/i, /45\s*A\b|45\s*amps?/i, /current/i),
    ohmsCase(category, 'voltage-0-0198ohm-100a-1-98v', 'Find voltage for 100 amps through 0.0198 ohms.', /V\s*=\s*I\s*(?:×|\*)\s*R|voltage/i, /1\.98\s*V\b/i, /voltage/i),
    ohmsCase(category, 'current-9v-100ohm-0-09a', 'A 9 V battery is connected through 100 ohms. What is the current?', /I\s*=\s*V\s*\/\s*R|current/i, /0\.09\s*A\b|0\.09\s*amps?/i, /current/i),
    ohmsCase(category, 'resistance-toothbrush-9600ohm', 'A toothbrush uses 120 V and 0.0125 amps. What is the resistance?', /R\s*=\s*V\s*\/\s*I|resistance/i, /9,?600\s*(?:Ω|ohms?)/i, /resistance/i)
  ];
}

function ohmsCase(category, name, prompt, formula, answerValue, solveFor) {
  return {
    category,
    name,
    prompt,
    expectedIdea: 'Ohm’s Law direct answer with formula, substitution, numeric result, and units.',
    includes: [formula, answerValue],
    allowsFormulaRoute: true,
    formulaWork: {
      formulaId: /voltage_current_resistance/,
      solveFor,
      minimumSteps: 5
    }
  };
}

function circuitResistanceCases() {
  const category = 'circuit resistance formulas';
  return [
    {
      category,
      name: 'series-2-3-5-10ohm',
      prompt: 'What is total resistance for 2 ohm, 3 ohm, and 5 ohm resistors in series?',
      expectedIdea: 'Series total resistance adds resistors: 10 ohms.',
      includes: [/series/i, /add/i, /2\s*\+\s*3\s*\+\s*5/i, /10\s*ohms?/i],
      allowsFormulaRoute: true,
      formulaWork: { formulaId: /series_total_resistance/, solveFor: /total resistance/i, minimumSteps: 4 }
    },
    {
      category,
      name: 'series-2-3-4-9ohm-current-20a',
      prompt: 'A 180 V battery has 2 ohm, 3 ohm, and 4 ohm resistors in series. Find total resistance and current.',
      expectedIdea: 'Series total resistance is 9 ohms; current is 20 A.',
      includes: [/series/i, /2\s*\+\s*3\s*\+\s*4/i, /9\s*ohms?/i, /I\s*=\s*V\s*\/\s*R|current/i, /20\s*amps?|20\s*A\b/i],
      allowsFormulaRoute: true,
      formulaWork: { formulaId: /series_resistance_current/, solveFor: /total resistance and current/i, minimumSteps: 7 }
    },
    {
      category,
      name: 'parallel-6-3-2ohm',
      prompt: 'What is total resistance for 6 ohm and 3 ohm resistors in parallel?',
      expectedIdea: 'Parallel total resistance adds reciprocals: 2 ohms.',
      includes: [/parallel/i, /reciprocal/i, /1\/6\s*\+\s*1\/3/i, /2\s*ohms?/i],
      allowsFormulaRoute: true,
      formulaWork: { formulaId: /parallel_total_resistance/, solveFor: /total resistance/i, minimumSteps: 4 }
    },
    {
      category,
      name: 'parallel-three-21ohm-7ohm',
      prompt: 'Three equal 21 ohm resistors are connected in parallel. What is the total resistance?',
      expectedIdea: 'Three equal 21 ohm resistors in parallel have 7 ohms total resistance.',
      includes: [/parallel/i, /21\s*\/\s*3|1\/21/i, /7\s*ohms?/i],
      allowsFormulaRoute: true,
      formulaWork: { formulaId: /parallel_total_resistance/, solveFor: /total resistance/i, minimumSteps: 4 }
    },
    {
      category,
      name: 'series-9v-2-3-4-drop-3v',
      prompt: 'A 9 V battery has 2 ohm, 3 ohm, and 4 ohm resistors in series. What is total resistance, current, and voltage drop across the 3 ohm resistor?',
      expectedIdea: 'Series total R is 9 ohms, current is 1 A, voltage drop across 3 ohms is 3 V.',
      includes: [/9\s*ohms?/i, /1\s*A\b|1\s*amp/i, /3\s*V\b|3\s*volts/i],
      allowsFormulaRoute: true
    },
    {
      category,
      name: 'parallel-12v-6ohm-branch-current-2a',
      prompt: 'A 12 V battery has two 6 ohm resistors in parallel. What current flows through one 6 ohm resistor?',
      expectedIdea: 'Each parallel branch has 12 V, so current through one 6 ohm resistor is 2 A.',
      includes: [/12\s*V\b|12\s*volts/i, /6\s*ohms?/i, /2\s*A\b|2\s*amps?/i],
      allowsFormulaRoute: true
    }
  ];
}

function electricalPowerCases() {
  const category = 'electrical power formulas';
  return [
    {
      category,
      name: 'power-10v-5ohm-20w',
      prompt: 'For a 10 V circuit with 5 ohms resistance, find current and electrical power.',
      expectedIdea: 'I = 2 A and P = V × I = 20 W; power should be eligible for guided formula work when supported.',
      includes: [/I\s*=\s*V\s*\/\s*R|current/i, /2\s*A\b|2\s*amps?/i, /P\s*=\s*V\s*(?:×|\*)\s*I|power/i, /20\s*W\b|20\s*watts?/i],
      allowsFormulaRoute: true,
      formulaWork: { formulaId: /power|electrical_power/i, solveFor: /power|current and power/i, minimumSteps: 1 }
    },
    {
      category,
      name: 'power-direct-voltage-current',
      prompt: 'What electrical power is used by a device with 10 V and 2 amps?',
      expectedIdea: 'Electrical power uses P = V × I and gives 20 W.',
      includes: [/P\s*=\s*V\s*(?:×|\*)\s*I|power/i, /10\s*V\b.*2\s*A|10\s*V\s*(?:×|\*)\s*2\s*A/i, /20\s*W\b|20\s*watts?/i],
      allowsFormulaRoute: true,
      formulaWork: { formulaId: /power|electrical_power/i, solveFor: /power/i, minimumSteps: 1 }
    }
  ];
}

function tutorGatingCases() {
  const category = 'formula tutor gating';
  return [
    {
      category,
      name: 'ohms-law-voltage-tutor',
      prompt: 'What is the voltage if current is 20 amps and resistance is 30 ohms?',
      expectedIdea: 'Ohm’s Law with formulaWork should start Formula Tutor when guided mode is enabled.',
      includes: [/600\s*V\b/i],
      allowsTutor: true,
      formulaId: /voltage_current_resistance/,
      solveFor: /voltage/i,
      formulaWork: { formulaId: /voltage_current_resistance/, solveFor: /voltage/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'ohms-law-current-tutor',
      prompt: 'What current flows through 3 ohms with a 210 V battery?',
      expectedIdea: 'Current Ohm’s Law problem should start Formula Tutor.',
      includes: [/70\s*A\b|70\s*amps?/i],
      allowsTutor: true,
      formulaId: /voltage_current_resistance/,
      solveFor: /current/i,
      formulaWork: { formulaId: /voltage_current_resistance/, solveFor: /current/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'series-resistance-tutor',
      prompt: 'What is total resistance for 2 ohm, 3 ohm, and 5 ohm resistors in series?',
      expectedIdea: 'Simple series total resistance should start Formula Tutor if supported.',
      includes: [/10\s*ohms?/i],
      allowsTutor: true,
      formulaId: /series_total_resistance/,
      solveFor: /total resistance/i,
      formulaWork: { formulaId: /series_total_resistance/, solveFor: /total resistance/i, minimumSteps: 4 }
    },
    {
      category,
      name: 'parallel-resistance-tutor',
      prompt: 'What is total resistance for 6 ohm and 3 ohm resistors in parallel?',
      expectedIdea: 'Simple parallel total resistance should start Formula Tutor if supported.',
      includes: [/2\s*ohms?/i],
      allowsTutor: true,
      formulaId: /parallel_total_resistance/,
      solveFor: /total resistance/i,
      formulaWork: { formulaId: /parallel_total_resistance/, solveFor: /total resistance/i, minimumSteps: 4 }
    },
    {
      category,
      name: 'electrical-power-tutor-gap',
      prompt: 'What electrical power is used by a device with 10 V and 2 amps?',
      expectedIdea: 'Electrical power should report formulaWork/tutor gating when supported.',
      includes: [/20\s*W\b|20\s*watts?/i],
      allowsTutor: true,
      formulaId: /power|electrical_power/i,
      solveFor: /power/i,
      formulaWork: { formulaId: /power|electrical_power/i, solveFor: /power/i, minimumSteps: 1 }
    }
  ];
}

function tutorWordingCases() {
  const category = 'formula tutor wording';
  return [
    {
      category,
      name: 'ohms-law-tutor-wording',
      prompt: 'What is the voltage if current is 20 amps and resistance is 30 ohms?',
      expectedIdea: 'Formula Tutor should preserve question, known values, concrete choices, and clean stop state.',
      minimumKnownValues: 2,
      allowsTutor: true
    },
    {
      category,
      name: 'series-tutor-wording',
      prompt: 'What is total resistance for 2 ohm, 3 ohm, and 5 ohm resistors in series?',
      expectedIdea: 'Circuit resistance tutor should use concrete series prompts and clean stop state.',
      minimumKnownValues: 2,
      allowsTutor: true
    }
  ];
}

function circuitConceptCases() {
  const category = 'circuit concepts';
  return [
    {
      category,
      name: 'open-circuit-no-current',
      prompt: 'What happens in an open circuit?',
      expectedIdea: 'Open circuit means incomplete path and current does not flow.',
      includes: [/open circuit/i, /break|incomplete|open/i, /current/i, /not flow|cannot flow|stops/i]
    },
    {
      category,
      name: 'closed-circuit-current-flows',
      prompt: 'What happens in a closed circuit?',
      expectedIdea: 'Closed circuit means complete path and current flows.',
      includes: [/closed circuit/i, /complete|connected/i, /current/i, /flow/i]
    },
    {
      category,
      name: 'series-current-same',
      prompt: 'What happens to current in a series circuit?',
      expectedIdea: 'Series current is same throughout one path.',
      includes: [/series/i, /current/i, /same|one path/i]
    },
    {
      category,
      name: 'series-add-components-increases-resistance',
      prompt: 'What happens when you add more lights in series?',
      expectedIdea: 'Adding series components increases total resistance and lowers current/brightness.',
      includes: [/series/i, /resistance/i, /increase/i, /current|dimmer|brightness/i]
    },
    {
      category,
      name: 'parallel-current-splits',
      prompt: 'What happens to current in a parallel circuit?',
      expectedIdea: 'Parallel current splits among branches.',
      includes: [/parallel/i, /current/i, /split|branch|multiple paths/i]
    },
    {
      category,
      name: 'parallel-voltage-same-branches',
      prompt: 'What happens to voltage across branches in a parallel circuit?',
      expectedIdea: 'Parallel voltage is the same across branches.',
      includes: [/parallel/i, /voltage/i, /same/i, /branches|branch/i]
    },
    {
      category,
      name: 'homes-schools-parallel',
      prompt: 'Why are homes and schools usually wired in parallel?',
      expectedIdea: 'Homes/schools use parallel so branches work independently.',
      includes: [/parallel/i, /branch|path/i, /independent|still work|separate/i]
    },
    {
      category,
      name: 'holiday-lights-series',
      prompt: 'Why are some holiday lights an example of a series circuit?',
      expectedIdea: 'Holiday lights may be series: one path and if one opens others go out.',
      includes: [/series/i, /one path/i, /one.*(?:burns out|breaks|opens)|go out/i]
    },
    {
      category,
      name: 'battery-chemical-to-electrical',
      prompt: 'How does a battery work in a circuit?',
      expectedIdea: 'Battery converts chemical energy to electrical energy and creates voltage difference.',
      includes: [/battery/i, /chemical/i, /electrical/i, /voltage difference|voltage/i]
    }
  ];
}

function circuitComponentCases() {
  const category = 'circuit components and symbols';
  return [
    {
      category,
      name: 'resistor-symbol',
      prompt: 'What does a resistor do and what is its circuit symbol?',
      expectedIdea: 'Resistor limits current/adds resistance; symbol is zigzag or rectangle.',
      includes: [/resistor/i, /resistance|limits current/i, /zigzag|rectangle|symbol/i]
    },
    {
      category,
      name: 'battery-symbol',
      prompt: 'What is the circuit symbol for a battery?',
      expectedIdea: 'Battery symbol is long and short parallel lines.',
      includes: [/battery/i, /long|short/i, /parallel lines|lines/i]
    },
    {
      category,
      name: 'switch-symbol',
      prompt: 'What does a switch do in a circuit?',
      expectedIdea: 'Switch opens/closes circuit.',
      includes: [/switch/i, /open|opens/i, /close|closes/i, /circuit/i]
    },
    {
      category,
      name: 'light-bulb-symbol',
      prompt: 'What does a light bulb or lamp do in a circuit?',
      expectedIdea: 'Light bulb/lamp is a load converting electrical energy to light/heat.',
      includes: [/light bulb|lamp|bulb/i, /load|converts/i, /light/i]
    },
    {
      category,
      name: 'ammeter-series',
      prompt: 'Where should an ammeter be placed?',
      expectedIdea: 'Ammeter measures current and is placed in series.',
      includes: [/ammeter/i, /current/i, /series/i]
    },
    {
      category,
      name: 'voltmeter-parallel',
      prompt: 'Where should a voltmeter be placed?',
      expectedIdea: 'Voltmeter measures voltage drop and is placed in parallel/across component.',
      includes: [/voltmeter/i, /voltage/i, /parallel|across/i]
    },
    {
      category,
      name: 'circuit-symbols-list',
      prompt: 'What are the circuit symbols for battery, switch, light bulb, resistor, ammeter, and voltmeter?',
      expectedIdea: 'Recognize battery, switch, bulb/lamp, resistor, ammeter, voltmeter symbols.',
      includes: [/battery/i, /switch/i, /bulb|lamp/i, /resistor/i, /ammeter|circle A/i, /voltmeter|circle V/i]
    }
  ];
}

function magnetismCases() {
  const category = 'magnetism concepts';
  return [
    {
      category,
      name: 'magnetism-force',
      prompt: 'What is magnetism?',
      expectedIdea: 'Magnetism is attractive/repulsive force property.',
      includes: [/magnetism/i, /force/i, /attract|repel/i]
    },
    {
      category,
      name: 'magnetic-field-strongest-poles',
      prompt: 'Where is a magnetic field strongest?',
      expectedIdea: 'Magnetic field is strongest at poles.',
      includes: [/magnetic field|magnetic force/i, /strongest/i, /poles/i]
    },
    {
      category,
      name: 'magnetic-poles-like-repel',
      prompt: 'What happens when two north poles are near each other?',
      expectedIdea: 'Like magnetic poles repel.',
      includes: [/north/i, /repel/i],
      excludes: [/attract/i]
    },
    {
      category,
      name: 'field-lines-north-south',
      prompt: 'What direction are magnetic field lines shown outside a magnet?',
      expectedIdea: 'Magnetic field lines are shown north to south outside magnet.',
      includes: [/north/i, /south/i, /outside|shown|field lines/i]
    },
    {
      category,
      name: 'magnetic-domains-aligned',
      prompt: 'What are magnetic domains?',
      expectedIdea: 'Magnetic domains align in magnetic materials; unaligned in nonmagnetic.',
      includes: [/domains?/i, /aligned|line up|lined up/i, /nonmagnetic|different directions/i]
    },
    {
      category,
      name: 'ferromagnetism-iron-cobalt-nickel',
      prompt: 'What is ferromagnetism?',
      expectedIdea: 'Iron/cobalt/nickel become magnetized when domains/electrons align.',
      includes: [/ferromagnetism|ferromagnetic/i, /domains?|line up|align/i, /iron|nickel|cobalt/i]
    },
    {
      category,
      name: 'current-produces-magnetic-field',
      prompt: 'What can moving electric charge or current produce around a wire?',
      expectedIdea: 'Moving charge/current produces magnetic field around wire.',
      includes: [/current|moving electric charge/i, /magnetic field/i, /wire/i]
    },
    {
      category,
      name: 'electromagnet-temporary-coil-core',
      prompt: 'What is an electromagnet?',
      expectedIdea: 'Temporary magnet made with current-carrying coil around iron/metal core.',
      includes: [/electromagnet/i, /current/i, /coil|wire/i, /metal|iron/i]
    },
    {
      category,
      name: 'generator-conversion',
      prompt: 'What does a generator convert?',
      expectedIdea: 'Generator converts mechanical/motion energy to electrical energy.',
      includes: [/generator/i, /motion|mechanical/i, /electrical energy|electricity/i],
      excludes: [/electrical energy into motion|electrical energy to mechanical/i]
    },
    {
      category,
      name: 'motor-conversion',
      prompt: 'What does an electric motor convert?',
      expectedIdea: 'Motor converts electrical energy to mechanical/motion energy.',
      includes: [/motor/i, /electrical energy|electricity/i, /motion|mechanical|spin/i],
      excludes: [/motion into electricity|mechanical energy to electrical/i]
    }
  ];
}

function openResponseCases() {
  const category = 'open response explanations';
  return [
    {
      category,
      name: 'lightning-static-discharge-explain',
      prompt: 'Explain lightning using static electricity.',
      expectedIdea: 'Lightning is sudden discharge/flow of charge from static buildup.',
      includes: [/lightning/i, /static/i, /discharge|sudden movement|flow/i, /charge/i]
    },
    {
      category,
      name: 'battery-chemical-reaction-voltage',
      prompt: 'Explain how a battery causes electrons to flow from negative to positive in a circuit.',
      expectedIdea: 'Battery chemical reactions create voltage difference between terminals; electrons flow when connected.',
      includes: [/battery/i, /chemical/i, /voltage/i, /negative/i, /positive/i, /electrons?|charge/i]
    },
    {
      category,
      name: 'increase-electromagnet-strength',
      prompt: 'How can you make an electromagnet stronger?',
      expectedIdea: 'Increase loops/coils or increase current.',
      includes: [/more loops|increase.*loops|wire loops/i, /increase.*current|more current/i]
    },
    {
      category,
      name: 'decrease-electromagnet-strength',
      prompt: 'How can you make an electromagnet weaker?',
      expectedIdea: 'Decrease loops/coils or decrease current.',
      includes: [/fewer loops|less.*loops|decrease.*loops/i, /less current|decrease.*current/i]
    },
    {
      category,
      name: 'prevent-overheating-fuse-breaker',
      prompt: 'How do fuses and circuit breakers prevent overheating?',
      expectedIdea: 'Fuse melts or breaker trips to open circuit and stop current.',
      includes: [/fuse|circuit breaker/i, /open|break/i, /circuit/i, /current/i, /overheat|overheating|heat/i]
    },
    {
      category,
      name: 'series-vs-parallel-differences',
      prompt: 'Explain the differences between series and parallel circuits.',
      expectedIdea: 'Series one path, same current, added resistance; parallel multiple paths, same voltage, current splits.',
      includes: [/series/i, /one path/i, /parallel/i, /multiple|more than one|branches/i, /current|voltage/i]
    }
  ];
}

function wrongDomainCases() {
  const category = 'wrong domain protections';
  return [
    {
      category,
      name: 'current-not-news',
      prompt: 'In electricity class, what is current?',
      expectedIdea: 'Current routes to electric current, not present-day events.',
      includes: [/current/i, /flow|movement/i, /charge|electrons/i],
      excludes: [/news|present day|events|currently/i]
    },
    {
      category,
      name: 'resistance-not-friction-horse',
      prompt: 'In electricity class, what does resistance mean?',
      expectedIdea: 'Resistance routes to electrical resistance.',
      includes: [/resistance/i, /current|charge|electrons/i, /ohms?|Ω/i],
      excludes: [/friction|horse|image/i]
    },
    {
      category,
      name: 'conduction-charge-contact',
      prompt: 'In electric charging, what is conduction?',
      expectedIdea: 'Conduction means charge transfer by contact, not heat transfer.',
      includes: [/conduction/i, /charge/i, /direct contact|touch/i],
      excludes: [/heat transfer|thermal/i]
    },
    {
      category,
      name: 'induction-charge-distance',
      prompt: 'What is charging by induction from a distance?',
      expectedIdea: 'Induction is charge shift/transfer effect from nearby charged object without touching.',
      includes: [/induction/i, /charge/i, /without touching|distance|nearby/i],
      excludes: [/electromagnetic induction|generator/i]
    },
    {
      category,
      name: 'field-electric-vs-magnetic-charge',
      prompt: 'What field around a charged object exerts force on other charges?',
      expectedIdea: 'Charge wording should answer electric field.',
      includes: [/electric field/i, /charged|charges/i, /force/i],
      excludes: [/magnetic field is the answer/i]
    },
    {
      category,
      name: 'field-magnetic-vs-electric-magnet',
      prompt: 'What field around a magnet is strongest at the poles?',
      expectedIdea: 'Magnet wording should answer magnetic field.',
      includes: [/magnetic field/i, /magnet/i, /poles/i],
      excludes: [/electric field is the answer/i]
    },
    {
      category,
      name: 'lightening-misspelling-lightning',
      prompt: 'Why is lightening an example of static discharge?',
      expectedIdea: 'Misspelling lightening should still route to lightning/static discharge.',
      includes: [/lightning|static discharge/i, /static/i, /charge/i],
      excludes: [/make lighter|brightness/i]
    },
    {
      category,
      name: 'series-not-grammar',
      prompt: 'In circuits, what does series mean?',
      expectedIdea: 'Series routes to circuit one-path meaning.',
      includes: [/series/i, /one path/i, /current/i],
      excludes: [/grammar|list|sequence of books/i]
    },
    {
      category,
      name: 'parallel-not-grammar',
      prompt: 'In circuits, what does parallel mean?',
      expectedIdea: 'Parallel routes to circuit multi-branch meaning.',
      includes: [/parallel/i, /more than one path|multiple paths|branches/i],
      excludes: [/grammar|sentences/i]
    },
    {
      category,
      name: 'skin-conductor-not-insulator',
      prompt: 'Is skin a conductor or an insulator in this electricity test context?',
      expectedIdea: 'Skin should be treated as conductor/not a good insulator.',
      includes: [/skin/i, /conductor|conducts/i],
      excludes: [/skin is an insulator|good insulator/i]
    }
  ];
}

function studentRouteDebugCases() {
  const category = 'student route debug';
  return [
    {
      category,
      name: 'ohms-student-debug-guided',
      prompt: 'What is the voltage if current is 20 amps and resistance is 30 ohms?',
      expectedIdea: 'Student route logs Formula Tutor debug for guided Ohm’s Law problem.',
      guidedTutorEnabled: true,
      allowsTutor: true,
      routeTypes: ['formula_tutor'],
      includes: [/what variable are we solving for/i, /voltage/i],
      debugIncludes: [/formulaTutorDecision|formulaTutor/i, /startedTutor|active/i]
    },
    {
      category,
      name: 'ohms-student-debug-direct',
      prompt: 'What is the voltage if current is 20 amps and resistance is 30 ohms?',
      expectedIdea: 'Student route logs direct answer decision when guided Formula Tutor is off.',
      guidedTutorEnabled: false,
      routeTypes: ['science_formula'],
      includes: [/600\s*V\b/i],
      debugIncludes: [/formulaTutorDecision/i, /guided_formula_tutoring_disabled|guidedFormulaTutoringEnabled/i]
    }
  ];
}
