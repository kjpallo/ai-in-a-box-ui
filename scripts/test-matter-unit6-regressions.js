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
    name: 'classification of matter',
    run: () => assertDirectStudentCases(classificationCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'properties and changes',
    run: () => assertDirectStudentCases(propertiesChangeCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'density properties and formulas',
    run: () => assertFormulaDirectCases(densityFormulaCases())
  },
  {
    name: 'density formula tutor audit shape',
    run: () => assertFormulaTutorCases(densityTutorCases())
  },
  {
    name: 'kinetic molecular theory and states',
    run: () => assertDirectStudentCases(statesKmtCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'changes of state and heating curves',
    run: () => assertDirectStudentCases(stateChangeHeatingCurveCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'solutions and solubility',
    run: () => assertDirectStudentCases(solutionSolubilityCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'student wording and wrong-domain protections',
    run: () => assertDirectStudentCases(studentWordingCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
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
    console.log(`Unit 6 Matter ${category.name}:`);
    const results = await category.run();
    allResults.push(...results);
    const passed = results.filter((result) => result.passed).length;
    const failed = results.filter((result) => !result.passed).length;
    console.log(`  ${passed} passed, ${failed} failed.`);
  }

  const passed = allResults.filter((result) => result.passed).length;
  const failed = allResults.filter((result) => !result.passed);

  console.log('');
  console.log(`Unit 6 Matter regression audit passed ${passed}/${allResults.length} checks`);

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
      if (testCase.conceptTutorChoice || testCase.conceptTutorChoices) {
        const conceptTutorChoices = Array.isArray(testCase.conceptTutorChoices)
          ? testCase.conceptTutorChoices
          : [testCase.conceptTutorChoice];
        const hiddenFinalPattern = testCase.hiddenFinalPattern || testCase.includes[0];
        assert.equal(response.body.routeType, 'concept_tutor', detail(testCase, null, response.body, 'student route should start Concept Tutor'));
        assert.match(response.body.response, testCase.conceptTutorPrompt || /Is it the same throughout, or can you see different parts\?/i, detail(testCase, null, response.body, 'Concept Tutor should ask the expected clue first'));
        assert.doesNotMatch(response.body.response, hiddenFinalPattern, detail(testCase, null, response.body, 'Concept Tutor should hide the final answer before completion'));
        assert.equal(response.body.tutor?.originalQuestion, testCase.prompt, detail(testCase, null, response.body, 'Concept Tutor should preserve original question'));

        let completed = null;
        for (let index = 0; index < conceptTutorChoices.length; index += 1) {
          completed = await sendHarnessMessage(harness, testCase.name, String(conceptTutorChoices[index]));
          assert.equal(completed.statusCode, 200, detail(testCase, null, completed.body, 'concept tutor step should return 200'));
          assert.equal(completed.body.routeType, 'concept_tutor', detail(testCase, null, completed.body, 'concept tutor step should stay in Concept Tutor'));
          if (index < conceptTutorChoices.length - 1) {
            assert.equal(completed.body.tutor?.active, true, detail(testCase, null, completed.body, 'Concept Tutor should stay active before final choice'));
            assert.doesNotMatch(completed.body.response, hiddenFinalPattern, detail(testCase, null, completed.body, 'Concept Tutor should hide the final answer before completion'));
          }
        }

        assert.equal(completed.statusCode, 200, detail(testCase, null, completed.body, 'concept tutor completion should return 200'));
        assert.equal(completed.body.routeType, 'concept_tutor', detail(testCase, null, completed.body, 'completion should stay in Concept Tutor'));
        assert.equal(completed.body.tutor?.completed, true, detail(testCase, null, completed.body, 'Concept Tutor should complete after correct choice'));
        assertAnswer(completed.body.response, testCase, null, completed.body);
        return;
      }
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
      if (testCase.allowsConceptRoute && route.type !== 'science_formula') {
        assert.notEqual(route.type, 'no_match', detail(testCase, route, null, 'should answer directly or route as a science formula'));
      } else {
        assert.equal(route.type, 'science_formula', detail(testCase, route, null, 'should route as a science formula'));
      }
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
      assert.doesNotMatch(`${guided.body.response || ''}\n${JSON.stringify(tutor)}`, /electric current|circuit|Newton|wave speed|sidewalk|truck|suitcase/i, detail(testCase, route, guided.body, 'density tutor should not leak unrelated domains'));

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
  if (testCase.allowsTutor && body.routeType === 'formula_tutor') {
    return;
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
  assert.equal(create.statusCode, 201, 'matter regression harness should create a session');
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

function classificationCases() {
  const category = 'classification of matter';
  return [
    {
      category,
      name: 'matter-definition',
      prompt: 'what is matter',
      expectedIdea: 'Matter is anything that has mass and takes up space.',
      includes: [/matter/i, /mass/i, /takes up space|occupies space|volume/i]
    },
    {
      category,
      name: 'classification-main-types',
      prompt: 'matter is classified as what two main categories',
      expectedIdea: 'Matter is classified as substances and mixtures.',
      includes: [/substances?/i, /mixtures?/i]
    },
    {
      category,
      name: 'substance-definition',
      prompt: 'what is a substance in matter',
      expectedIdea: 'A substance has identical particles and fixed composition.',
      includes: [/substance/i, /identical|same/i, /fixed|definite/i, /composition|particles?/i]
    },
    {
      category,
      name: 'mixture-definition',
      prompt: 'what is a mixture in matter',
      expectedIdea: 'A mixture is two or more substances physically combined with variable composition.',
      includes: [/mixture/i, /two or more|2 or more/i, /physically/i, /variable|not fixed|different amounts/i]
    },
    {
      category,
      name: 'element-definition',
      prompt: 'what is an element',
      expectedIdea: 'An element is the simplest form of matter with one type of atom, found on the periodic table.',
      includes: [/element/i, /simplest|one type of atom|same type of atom/i, /periodic table|atom/i]
    },
    {
      category,
      name: 'compound-definition',
      prompt: 'what is a compound',
      expectedIdea: 'A compound has two or more elements chemically combined in fixed proportions.',
      includes: [/compound/i, /two or more|2 or more/i, /elements?/i, /chemically combined|chemical/i, /fixed|definite/i]
    },
    {
      category,
      name: 'element-vs-compound',
      prompt: 'what is the difference between an element and a compound',
      expectedIdea: 'Elements have one kind of atom; compounds have elements chemically combined.',
      includes: [/element/i, /compound/i, /one type|one kind|same type/i, /chemically combined|two or more elements/i]
    },
    {
      category,
      name: 'homogeneous-definition',
      prompt: 'what is a homogeneous mixture',
      expectedIdea: 'Homogeneous mixtures are evenly distributed and same throughout, also called solutions.',
      includes: [/homogeneous/i, /evenly|uniform|same throughout/i, /solution/i]
    },
    {
      category,
      name: 'heterogeneous-definition',
      prompt: 'what is a heterogeneous mixture',
      expectedIdea: 'Heterogeneous mixtures are uneven and have visibly different parts.',
      includes: [/heterogeneous/i, /uneven|not uniform|different parts/i, /visible|separate|not same throughout/i]
    },
    {
      category,
      name: 'homogeneous-vs-heterogeneous',
      prompt: 'what is the difference between a homogeneous and heterogeneous mixture',
      expectedIdea: 'Homogeneous is same throughout; heterogeneous has different parts.',
      includes: [/homogeneous/i, /heterogeneous/i, /same throughout|uniform/i, /different parts|uneven|not uniform/i]
    },
    {
      category,
      name: 'colloid-definition',
      prompt: 'what is a colloid',
      expectedIdea: 'A colloid is a heterogeneous mixture with small dispersed particles larger than solution particles.',
      includes: [/colloid/i, /heterogeneous/i, /dispersed|spread/i, /particles?/i, /solution/i]
    },
    {
      category,
      name: 'suspension-definition',
      prompt: 'what is a suspension',
      expectedIdea: 'A suspension has larger particles that settle out.',
      includes: [/suspension/i, /heterogeneous/i, /larger particles?/i, /settle/i]
    },
    {
      category,
      name: 'tyndall-effect',
      prompt: 'what is the tyndall effect',
      expectedIdea: 'The Tyndall effect is light scattering by colloids or suspensions, not true solutions.',
      includes: [/Tyndall/i, /scatter|scattering/i, /light/i, /colloid|suspension/i],
      excludes: [/electric|circuit|wave speed/i]
    },
    {
      category,
      name: 'salt-compound',
      prompt: 'is salt an element compound or mixture',
      expectedIdea: 'Salt/NaCl is a compound.',
      includes: [/compound/i, /salt|NaCl|sodium chloride/i],
      hiddenFinalPattern: /Salt is a compound/i,
      conceptTutorPrompt: /Is it made of one kind of atom\?/i,
      conceptTutorChoices: [2, 1]
    },
    {
      category,
      name: 'oxygen-element',
      prompt: 'is oxygen an element or compound',
      expectedIdea: 'Oxygen is an element.',
      includes: [/oxygen/i, /element/i],
      conceptTutorPrompt: /Is it made of one kind of atom\?/i,
      conceptTutorChoices: [1]
    },
    {
      category,
      name: 'carbon-dioxide-compound',
      prompt: 'is carbon dioxide a compound',
      expectedIdea: 'Carbon dioxide/CO2 is a compound.',
      includes: [/carbon dioxide|CO2/i, /compound/i, /carbon/i, /oxygen/i],
      conceptTutorPrompt: /Is it made of one kind of atom\?/i,
      conceptTutorChoices: [2, 1]
    },
    {
      category,
      name: 'hcl-compound',
      prompt: 'is HCl an element compound or mixture',
      expectedIdea: 'HCl is a compound.',
      includes: [/HCl|hydrogen chloride|hydrochloric/i, /compound/i],
      conceptTutorPrompt: /Is it made of one kind of atom\?/i,
      conceptTutorChoices: [2, 1]
    },
    {
      category,
      name: 'chlorine-element',
      prompt: 'is chlorine an element',
      expectedIdea: 'Chlorine is an element.',
      includes: [/chlorine/i, /element/i],
      conceptTutorPrompt: /Is it made of one kind of atom\?/i,
      conceptTutorChoices: [1]
    },
    {
      category,
      name: 'gold-iron-hydrogen-elements',
      prompt: 'are hydrogen gold and iron elements',
      expectedIdea: 'Hydrogen, gold, and iron are elements.',
      includes: [/hydrogen/i, /gold/i, /iron/i, /elements?/i]
    },
    {
      category,
      name: 'lemonade-homogeneous',
      prompt: 'is lemonade homogeneous or heterogeneous',
      expectedIdea: 'Lemonade is usually a homogeneous mixture or solution.',
      includes: [/lemonade/i, /homogeneous|solution/i]
    },
    {
      category,
      name: 'sugar-water-solution',
      prompt: 'classify sugar water',
      expectedIdea: 'Sugar water is a homogeneous mixture/solution.',
      includes: [/sugar water/i, /homogeneous|solution/i]
    },
    {
      category,
      name: 'saltwater-solution',
      prompt: 'classify saltwater',
      expectedIdea: 'Saltwater is a homogeneous mixture/solution.',
      includes: [/saltwater|salt water/i, /homogeneous|solution/i]
    },
    {
      category,
      name: 'black-coffee-homogeneous',
      prompt: 'classify black coffee',
      expectedIdea: 'Black coffee is a homogeneous mixture.',
      includes: [/black coffee|coffee/i, /homogeneous|solution/i]
    },
    {
      category,
      name: 'trail-mix-heterogeneous',
      prompt: 'is trail mix homogeneous or heterogeneous',
      expectedIdea: 'Trail mix is heterogeneous.',
      includes: [/trail mix/i, /heterogeneous/i],
      conceptTutorChoice: 2
    },
    {
      category,
      name: 'fruit-salad-heterogeneous',
      prompt: 'classify fruit salad',
      expectedIdea: 'Fruit salad is heterogeneous.',
      includes: [/fruit salad/i, /heterogeneous/i]
    },
    {
      category,
      name: 'salad-dressing-heterogeneous',
      prompt: 'why is salad dressing heterogeneous',
      expectedIdea: 'Salad dressing is heterogeneous because its parts are uneven or can separate.',
      includes: [/salad dressing/i, /heterogeneous/i, /separate|uneven|different parts/i]
    },
    {
      category,
      name: 'vegetable-soup-heterogeneous',
      prompt: 'is vegetable soup a homogeneous or heterogeneous mixture',
      expectedIdea: 'Vegetable soup is heterogeneous.',
      includes: [/vegetable soup|soup/i, /heterogeneous/i]
    },
    {
      category,
      name: 'pizza-heterogeneous',
      prompt: 'classify pizza as homogeneous or heterogeneous',
      expectedIdea: 'Pizza is heterogeneous.',
      includes: [/pizza/i, /heterogeneous/i]
    },
    {
      category,
      name: 'hot-chocolate-whipped-cream',
      prompt: 'classify hot chocolate with whipped cream',
      expectedIdea: 'Hot chocolate with whipped cream is heterogeneous.',
      includes: [/hot chocolate/i, /whipped cream/i, /heterogeneous/i]
    },
    {
      category,
      name: 'milk-colloid-not-solution',
      prompt: 'what kind of mixture is milk',
      expectedIdea: 'Milk is a colloid/heterogeneous mixture, not a simple solution.',
      includes: [/milk/i, /colloid|heterogeneous/i],
      excludes: [/simple solution|true solution/i]
    },
    {
      category,
      name: 'milk-is-solution',
      prompt: 'is milk a solution',
      expectedIdea: 'Milk is a colloid, not a true solution.',
      includes: [/milk/i, /colloid/i, /not|isn'?t/i, /solution/i]
    },
    {
      category,
      name: 'paint-colloid',
      prompt: 'is paint a solution colloid or suspension',
      expectedIdea: 'Paint is commonly classified as a colloid/heterogeneous mixture.',
      includes: [/paint/i, /colloid|heterogeneous/i]
    },
    {
      category,
      name: 'mayonnaise-colloid',
      prompt: 'is mayonnaise a mixture',
      expectedIdea: 'Mayonnaise is a colloid/heterogeneous mixture.',
      includes: [/mayonnaise|mayo/i, /colloid|heterogeneous|mixture/i]
    },
    {
      category,
      name: 'iron-sand-magnet-heterogeneous',
      prompt: 'iron and sand can be separated by a magnet what kind of mixture is it',
      expectedIdea: 'Iron and sand is a heterogeneous mixture.',
      includes: [/iron/i, /sand/i, /heterogeneous/i, /magnet|separate/i]
    },
    {
      category,
      name: 'air-gaseous-solution',
      prompt: 'is air a solution',
      expectedIdea: 'Air is a gaseous solution/homogeneous mixture.',
      includes: [/air/i, /solution|homogeneous/i, /gas|gaseous/i]
    }
  ];
}

function propertiesChangeCases() {
  const category = 'properties and changes';
  return [
    {
      category,
      name: 'physical-property-definition',
      prompt: 'what is a physical property',
      expectedIdea: 'A physical property can be observed or measured without changing identity.',
      includes: [/physical property/i, /observed|measured/i, /without changing|does not change/i, /identity|substance/i]
    },
    {
      category,
      name: 'chemical-property-definition',
      prompt: 'what is a chemical property',
      expectedIdea: 'A chemical property is observed through a chemical change or forming a new substance.',
      includes: [/chemical property/i, /chemical change|reaction/i, /new substance|changes identity/i]
    },
    {
      category,
      name: 'physical-change-definition',
      prompt: 'what is a physical change',
      expectedIdea: 'A physical change affects physical properties only; identity stays the same.',
      includes: [/physical change/i, /identity|substance/i, /same|does not change/i]
    },
    {
      category,
      name: 'chemical-change-definition',
      prompt: 'what is a chemical change',
      expectedIdea: 'A chemical change rearranges atoms and forms a new substance.',
      includes: [/chemical change|chemical reaction/i, /atoms?|particles?/i, /rearranged|new substance/i]
    },
    {
      category,
      name: 'color-physical-property',
      prompt: 'is color a physical property',
      expectedIdea: 'Color is a physical property.',
      includes: [/color/i, /physical property/i]
    },
    {
      category,
      name: 'density-physical-property',
      prompt: 'is density a physical property',
      expectedIdea: 'Density is a physical property.',
      includes: [/density/i, /physical property/i]
    },
    {
      category,
      name: 'flower-fragrance-physical',
      prompt: 'is the fragrance of a flower a physical or chemical property',
      expectedIdea: 'Fragrance/odor is a physical property.',
      includes: [/fragrance|odor|smell/i, /physical property/i]
    },
    {
      category,
      name: 'flammability-chemical',
      prompt: 'is flammability physical or chemical',
      expectedIdea: 'Flammability is a chemical property.',
      includes: [/flammability|flammable/i, /chemical property/i]
    },
    {
      category,
      name: 'ability-to-rot-chemical',
      prompt: 'is ability to rot chemical',
      expectedIdea: 'Ability to rot is a chemical property.',
      includes: [/rot/i, /chemical property/i]
    },
    {
      category,
      name: 'reactivity-oxygen-chemical',
      prompt: 'is reactivity with oxygen physical property',
      expectedIdea: 'Reactivity with oxygen is a chemical property.',
      includes: [/reactivity|reacts?/i, /oxygen/i, /chemical property/i]
    },
    {
      category,
      name: 'boiling-water-physical',
      prompt: 'is boiling water physical or chemical',
      expectedIdea: 'Boiling water is a physical change.',
      includes: [/boiling|boil/i, /physical change/i]
    },
    {
      category,
      name: 'rusting-chemical',
      prompt: 'is rusting chemical',
      expectedIdea: 'Rusting is a chemical change.',
      includes: [/rust/i, /chemical change/i]
    },
    {
      category,
      name: 'inflating-tire-physical',
      prompt: 'is inflating a tire a physical change',
      expectedIdea: 'Inflating a tire is a physical change.',
      includes: [/inflating|inflate/i, /tire/i, /physical change/i]
    },
    {
      category,
      name: 'sharpening-pencil-physical',
      prompt: 'is sharpening a pencil physical or chemical',
      expectedIdea: 'Sharpening a pencil is a physical change.',
      includes: [/sharpening|sharpen/i, /pencil/i, /physical change/i]
    },
    {
      category,
      name: 'chopping-wood-physical',
      prompt: 'is chopping wood physical or chemical',
      expectedIdea: 'Chopping wood is a physical change.',
      includes: [/chopping|cutting/i, /wood/i, /physical change/i]
    },
    {
      category,
      name: 'burning-wood-chemical',
      prompt: 'is burning wood physical or chemical',
      expectedIdea: 'Burning wood is a chemical change.',
      includes: [/burning|burn/i, /wood/i, /chemical change/i]
    },
    {
      category,
      name: 'melting-ice-physical',
      prompt: 'is ice melting physical or chemical',
      expectedIdea: 'Melting ice is a physical change.',
      includes: [/melting|melt/i, /ice/i, /physical change/i]
    },
    {
      category,
      name: 'signs-chemical-change',
      prompt: 'what are signs of a chemical change',
      expectedIdea: 'Evidence includes light, temperature change, odor, color change, gas, precipitate.',
      includes: [/chemical change/i, /light/i, /temperature|heat/i, /odor|smell/i, /color/i, /gas|bubbles/i, /precipitate/i]
    },
    {
      category,
      name: 'conservation-mass-definition',
      prompt: 'what does conservation of mass mean',
      expectedIdea: 'Mass/matter is not created or destroyed during a chemical change.',
      includes: [/conservation of mass|conservation of matter/i, /not created/i, /not destroyed/i, /chemical change|reaction/i]
    },
    {
      category,
      name: 'mass-disappear-chemical-reaction',
      prompt: 'does mass disappear in a chemical reaction',
      expectedIdea: 'Mass does not disappear; it is conserved.',
      includes: [/no|does not|doesn'?t/i, /mass|matter/i, /conserved|not created|not destroyed/i]
    },
    {
      category,
      name: 'rust-closed-system-mass',
      prompt: 'why is the mass of rust equal to iron plus oxygen before the reaction in a closed system',
      expectedIdea: 'Closed-system rust mass stays the same because mass is conserved.',
      includes: [/rust/i, /iron/i, /oxygen/i, /closed system/i, /conservation|conserved/i, /mass/i]
    },
    {
      category,
      name: 'burning-popcorn-chemical',
      prompt: 'why is burning popcorn a chemical change',
      expectedIdea: 'Burning popcorn forms new substances with odor/color/temperature evidence.',
      includes: [/burning|burnt/i, /popcorn/i, /chemical change/i, /new substance|odor|color|temperature|gas/i]
    },
    {
      category,
      name: 'broken-glass-physical',
      prompt: 'is broken glass evidence of a physical or chemical change',
      expectedIdea: 'Broken glass is evidence of a physical change.',
      includes: [/broken glass|glass/i, /physical change/i]
    }
  ];
}

function densityFormulaCases() {
  const category = 'density properties and formulas';
  return [
    {
      category,
      name: 'density-formula-definition',
      prompt: 'what is the formula for density',
      expectedIdea: 'Density equals mass divided by volume.',
      includes: [/density/i, /mass/i, /volume/i, /\/|divided/i],
      allowsConceptRoute: true
    },
    {
      category,
      name: 'mass-density-volume-formula',
      prompt: 'what formula finds mass from density and volume',
      expectedIdea: 'Mass = density × volume.',
      includes: [/mass/i, /density/i, /volume/i, /×|\*|times|multiply/i]
    },
    {
      category,
      name: 'volume-mass-density-formula',
      prompt: 'what formula finds volume from mass and density',
      expectedIdea: 'Volume = mass / density.',
      includes: [/volume/i, /mass/i, /density/i, /\/|divided/i]
    },
    {
      category,
      name: 'wood-density-80g-3-6-4',
      prompt: 'A piece of wood measures 3 cm by 6 cm by 4 cm and has a mass of 80 g. What is its density?',
      expectedIdea: 'Volume = 72 cm3; density = 80 / 72 = about 1.11 g/cm3.',
      includes: [/72\s*cm/i, /80\s*g\s*\/\s*72/i, /1\.11\s*g\/cm/i],
      allowsMissingFormulaWork: true
    },
    {
      category,
      name: 'wood-density-float-sink',
      prompt: 'A piece of wood measures 3 cm by 6 cm by 4 cm and has a mass of 80 g. Will it float or sink in water?',
      expectedIdea: 'Density is about 1.11 g/cm3, greater than water, so it sinks.',
      includes: [/1\.11\s*g\/cm/i, /greater than|more than/i, /water/i, /sink|not float/i],
      allowsMissingFormulaWork: true
    },
    {
      category,
      name: 'water-mass-50ml',
      prompt: 'Find the mass of a 50 mL volume of water if density is 1 g/mL.',
      expectedIdea: 'mass = 1 g/mL × 50 mL = 50 g.',
      includes: [/mass/i, /1\s*g\/mL\s*(?:×|\*)\s*50\s*mL|50\s*mL\s*(?:×|\*)\s*1\s*g\/mL/i, /50\s*g/i],
      formulaWork: { formulaId: /density_mass_volume/, solveFor: /mass/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'copper-volume-72g-9',
      prompt: 'What is the volume of 72 g of copper if copper has a density of 9 g/cm³?',
      expectedIdea: 'volume = 72 / 9 = 8 cm3.',
      includes: [/volume/i, /72\s*g\s*\/\s*9\s*g\/cm/i, /8\s*cm/i],
      formulaWork: { formulaId: /density_mass_volume/, solveFor: /volume/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'metal-displacement-density-33-5-46-2-16-25',
      prompt: 'A graduated cylinder has 33.5 mL of water. A piece of metal is added and the new volume is 46.2 mL. The metal has a mass of 16.25 g. What is its density?',
      expectedIdea: 'Object volume = 46.2 - 33.5 = 12.7 mL; density = 16.25 / 12.7 = about 1.28 g/mL.',
      includes: [/46\.2\s*-\s*33\.5|12\.7\s*mL/i, /16\.25\s*g\s*\/\s*12\.7\s*mL/i, /1\.28\s*g\/mL/i],
      allowsMissingFormulaWork: true
    },
    {
      category,
      name: 'box-density-15g-10-5-2',
      prompt: 'What is the density of a 15 g box measuring 10 cm by 5 cm by 2 cm?',
      expectedIdea: 'Volume = 100 cm3; density = 0.15 g/cm3.',
      includes: [/100\s*cm/i, /15\s*g\s*\/\s*100/i, /0\.15\s*g\/cm/i],
      allowsMissingFormulaWork: true
    },
    {
      category,
      name: 'aluminum-displacement-density',
      prompt: 'A sample of aluminum is put into 10.5 mL of water. Water rises to 13.5 mL. Mass is 8.1 g. What is density?',
      expectedIdea: 'Volume = 3 mL; density = 2.7 g/mL.',
      includes: [/13\.5\s*-\s*10\.5|3\s*mL/i, /8\.1\s*g\s*\/\s*3\s*mL/i, /2\.7\s*g\/mL/i],
      allowsMissingFormulaWork: true
    },
    {
      category,
      name: 'marble-displacement-density',
      prompt: 'A marble has mass 3.75 g. Water rises from 25 mL to 28 mL. What is density?',
      expectedIdea: 'Volume = 3 mL; density = 1.25 g/mL.',
      includes: [/28\s*-\s*25|3\s*mL/i, /3\.75\s*g\s*\/\s*3\s*mL/i, /1\.25\s*g\/mL/i],
      allowsMissingFormulaWork: true
    },
    {
      category,
      name: 'metal-cube-nickel-density-table',
      prompt: 'A cube of metal measures 1.2 cm on each side and has mass 15.4 g. Using density table, identify the metal.',
      expectedIdea: 'Volume = 1.728 cm3; density about 8.91 g/cm3; closest to nickel.',
      includes: [/1\.728\s*cm/i, /8\.91\s*g\/cm/i, /nickel/i],
      allowsMissingFormulaWork: true
    },
    {
      category,
      name: 'metal-cube-silver-density-table',
      prompt: 'A cube of metal measures 1.2 cm on each side and has mass 18.15 g. Using density table, identify the metal.',
      expectedIdea: 'Volume = 1.728 cm3; density about 10.5 g/cm3; closest to silver.',
      includes: [/1\.728\s*cm/i, /10\.5\s*g\/cm/i, /silver/i],
      allowsMissingFormulaWork: true
    },
    {
      category,
      name: 'water-density-float-sink',
      prompt: 'If an object has density less than 1 g/mL in water will it float or sink',
      expectedIdea: 'Less dense than water floats; greater than 1 sinks.',
      includes: [/less than\s*1|less dense/i, /water/i, /float/i],
      allowsConceptRoute: true
    },
    {
      category,
      name: 'viscosity-definition',
      prompt: 'what is viscosity',
      expectedIdea: 'Viscosity is resistance to flow/thickness of a liquid.',
      includes: [/viscosity/i, /resistance to flow|resists flow|flow/i, /thick|thickness|liquid/i],
      allowsConceptRoute: true
    },
    {
      category,
      name: 'syrup-high-viscosity',
      prompt: 'why does syrup move slower than alcohol',
      expectedIdea: 'Syrup has higher viscosity than alcohol.',
      includes: [/syrup/i, /alcohol/i, /higher viscosity|more viscous|resists flow/i],
      allowsConceptRoute: true
    },
    {
      category,
      name: 'solubility-physical-property',
      prompt: 'is solubility a physical property',
      expectedIdea: 'Solubility is a physical property.',
      includes: [/solubility/i, /physical property/i],
      allowsConceptRoute: true
    },
    {
      category,
      name: 'melting-boiling-physical-properties',
      prompt: 'are melting point and boiling point physical properties',
      expectedIdea: 'Melting point and boiling point are physical properties.',
      includes: [/melting point/i, /boiling point/i, /physical propert/i],
      allowsConceptRoute: true
    }
  ];
}

function densityTutorCases() {
  const category = 'density formula tutor audit shape';
  return [
    {
      category,
      name: 'density-tutor-solving-density',
      prompt: 'A rock has a mass of 180 g and a volume of 30 mL. What is its density?',
      expectedIdea: 'Formula Tutor should solve density with D = m / V and known mass/volume.',
      includes: [/6\s*g\/mL/i],
      minimumKnownValues: 2,
      formulaChoice: /density.*mass.*volume|D\s*=\s*m\s*\/\s*V/i,
      formulaWork: { formulaId: /density_mass_volume/, solveFor: /density/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'rectangular-prism-density-has-formula-work-or-tutor',
      prompt: 'A piece of wood measures 3 cm by 6 cm by 4 cm and has a mass of 80 g. What is its density?',
      expectedIdea: 'Derived rectangular-prism volume density should expose Formula Tutor work.',
      includes: [/72\s*cm/i, /1\.11\s*g\/cm/i],
      minimumKnownValues: 5,
      formulaChoice: /density.*mass.*volume|D\s*=\s*m\s*\/\s*V/i,
      formulaWork: { formulaId: /density_mass_volume/, solveFor: /density/i, minimumSteps: 8 }
    },
    {
      category,
      name: 'displacement-density-has-formula-work-or-tutor',
      prompt: 'A graduated cylinder has 33.5 mL of water. A piece of metal is added and the new volume is 46.2 mL. The metal has a mass of 16.25 g. What is its density?',
      expectedIdea: 'Derived displacement-volume density should expose Formula Tutor work.',
      includes: [/12\.7\s*mL/i, /1\.28\s*g\/mL/i],
      minimumKnownValues: 4,
      formulaChoice: /density.*mass.*volume|D\s*=\s*m\s*\/\s*V/i,
      formulaWork: { formulaId: /density_mass_volume/, solveFor: /density/i, minimumSteps: 7 }
    },
    {
      category,
      name: 'shorthand-displacement-density-has-formula-work-or-tutor',
      prompt: 'water goes from 33.5 to 46.2 ml and metal mass 16.25 what density',
      expectedIdea: 'Student shorthand displacement density should expose Formula Tutor work.',
      includes: [/12\.7\s*mL/i, /1\.28\s*g\/mL/i],
      minimumKnownValues: 4,
      formulaChoice: /density.*mass.*volume|D\s*=\s*m\s*\/\s*V/i,
      formulaWork: { formulaId: /density_mass_volume/, solveFor: /density/i, minimumSteps: 7 }
    },
    {
      category,
      name: 'density-tutor-solving-mass',
      prompt: 'A metal cube has a density of 2.7 g/cm³ and a volume of 10 cm³. What is its mass?',
      expectedIdea: 'Formula Tutor should solve mass with m = D x V.',
      includes: [/27\s*g/i],
      minimumKnownValues: 2,
      formulaChoice: /mass.*density.*volume|m\s*=\s*D/i,
      formulaWork: { formulaId: /density_mass_volume/, solveFor: /mass/i, minimumSteps: 5 }
    },
    {
      category,
      name: 'density-tutor-solving-volume',
      prompt: 'A liquid has a mass of 45 grams and a density of 5 g/mL. What is its volume?',
      expectedIdea: 'Formula Tutor should solve volume with V = m / D.',
      includes: [/9\s*mL/i],
      minimumKnownValues: 2,
      formulaChoice: /volume.*mass.*density|V\s*=\s*m\s*\/\s*D/i,
      formulaWork: { formulaId: /density_mass_volume/, solveFor: /volume/i, minimumSteps: 5 }
    }
  ];
}

function statesKmtCases() {
  const category = 'kinetic molecular theory and states';
  return [
    {
      category,
      name: 'matter-small-particles',
      prompt: 'what does kinetic molecular theory say matter is made of',
      expectedIdea: 'All matter is made of small particles.',
      includes: [/matter/i, /small|tiny/i, /particles?/i]
    },
    {
      category,
      name: 'particles-constant-motion',
      prompt: 'are particles in matter always moving',
      expectedIdea: 'Matter particles are in constant random motion.',
      includes: [/particles?/i, /constant|always/i, /random/i, /motion|moving/i]
    },
    {
      category,
      name: 'temperature-average-ke',
      prompt: 'what is temperature measuring',
      expectedIdea: 'Temperature measures average kinetic energy of particles.',
      includes: [/temperature/i, /average kinetic energy/i, /particles?/i]
    },
    {
      category,
      name: 'heating-particles-faster',
      prompt: 'what happens to particles when heated',
      expectedIdea: 'Heating makes particles move faster.',
      includes: [/particles?/i, /heated|heating/i, /move faster|speed up|kinetic energy/i]
    },
    {
      category,
      name: 'solid-shape-volume',
      prompt: 'what state has definite shape and definite volume',
      expectedIdea: 'A solid has definite shape and definite volume.',
      includes: [/solid/i, /definite|fixed/i, /shape/i, /volume/i]
    },
    {
      category,
      name: 'solid-particle-motion',
      prompt: 'how do particles move in a solid',
      expectedIdea: 'Solid particles are tightly packed and vibrate in place.',
      includes: [/solid/i, /tightly packed|close together/i, /vibrate|vibration/i]
    },
    {
      category,
      name: 'liquid-volume-container-shape',
      prompt: 'what has definite volume but takes shape of container',
      expectedIdea: 'A liquid has definite volume but takes shape of its container.',
      includes: [/liquid/i, /definite|fixed/i, /volume/i, /shape of.*container|takes.*container/i]
    },
    {
      category,
      name: 'liquid-particles-slide',
      prompt: 'how do liquid particles move',
      expectedIdea: 'Liquid particles slide/flow past each other.',
      includes: [/liquid/i, /slide|flow/i, /past each other/i]
    },
    {
      category,
      name: 'gas-no-fixed-shape-volume',
      prompt: 'what has no fixed volume or shape',
      expectedIdea: 'A gas has no definite shape or volume.',
      includes: [/gas/i, /no|not/i, /fixed|definite/i, /shape/i, /volume/i]
    },
    {
      category,
      name: 'gas-particles-farthest-apart',
      prompt: 'which phase has particles farthest apart',
      expectedIdea: 'Gas particles are farthest apart among solid/liquid/gas.',
      includes: [/gas/i, /farthest apart|far apart/i]
    },
    {
      category,
      name: 'gases-spread-out',
      prompt: 'why do gases spread out',
      expectedIdea: 'Gas particles move freely and spread to fill the container.',
      includes: [/gas|gases/i, /particles?/i, /spread|diffuse|fill/i, /container|space/i]
    },
    {
      category,
      name: 'diffusion-definition',
      prompt: 'what is diffusion',
      expectedIdea: 'Diffusion is spreading out/mixing of particles from high to low concentration.',
      includes: [/diffusion/i, /particles?|molecules?/i, /spread|move/i, /high.*low|concentration/i]
    },
    {
      category,
      name: 'plasma-definition-examples',
      prompt: 'where can plasma be found',
      expectedIdea: 'Plasma is in stars, neon lights, lightning/auroras.',
      includes: [/plasma/i, /stars?|sun|neon|auroras?|lightning/i]
    },
    {
      category,
      name: 'two-plasma-places',
      prompt: 'two places you can find plasma',
      expectedIdea: 'Examples include stars, neon lights, auroras.',
      includes: [/stars?|sun/i, /neon|auroras?|lightning/i]
    },
    {
      category,
      name: 'bose-einstein-condensate',
      prompt: 'what is a Bose Einstein condensate used for',
      expectedIdea: 'BEC is super-cooled near absolute zero, super atom, used to simulate black-hole conditions.',
      includes: [/Bose|Einstein|condensate|BEC/i, /super.?cool|absolute zero|super atom/i, /black.?hole|simulate/i]
    }
  ];
}

function stateChangeHeatingCurveCases() {
  const category = 'changes of state and heating curves';
  return [
    {
      category,
      name: 'state-change-physical',
      prompt: 'why is melting ice a physical change',
      expectedIdea: 'A state change is physical because identity stays the same.',
      includes: [/melting|state change/i, /physical change/i, /same substance|identity stays|still water/i]
    },
    {
      category,
      name: 'melting-definition',
      prompt: 'what is melting',
      expectedIdea: 'Melting is solid to liquid.',
      includes: [/melting/i, /solid/i, /liquid/i]
    },
    {
      category,
      name: 'freezing-definition',
      prompt: 'what is freezing',
      expectedIdea: 'Freezing is liquid to solid.',
      includes: [/freezing/i, /liquid/i, /solid/i]
    },
    {
      category,
      name: 'vaporization-definition',
      prompt: 'what is vaporization',
      expectedIdea: 'Vaporization is liquid to gas.',
      includes: [/vaporization/i, /liquid/i, /gas/i]
    },
    {
      category,
      name: 'evaporation-vs-boiling',
      prompt: 'what is the difference between boiling and evaporation',
      expectedIdea: 'Evaporation occurs at the surface; boiling occurs throughout the liquid at boiling point.',
      includes: [/evaporation/i, /boiling/i, /surface/i, /throughout|whole liquid/i]
    },
    {
      category,
      name: 'condensation-definition',
      prompt: 'what is condensation',
      expectedIdea: 'Condensation is gas to liquid.',
      includes: [/condensation/i, /gas/i, /liquid/i]
    },
    {
      category,
      name: 'sublimation-definition',
      prompt: 'what is sublimation',
      expectedIdea: 'Sublimation is solid to gas, like dry ice.',
      includes: [/sublimation/i, /solid/i, /gas/i, /dry ice/i]
    },
    {
      category,
      name: 'deposition-definition',
      prompt: 'what is deposition',
      expectedIdea: 'Deposition is gas to solid, like frost.',
      includes: [/deposition/i, /gas/i, /solid/i, /frost/i]
    },
    {
      category,
      name: 'heat-of-fusion',
      prompt: 'what is heat of fusion',
      expectedIdea: 'Heat of fusion is energy needed to turn solid to liquid at melting point.',
      includes: [/heat of fusion/i, /energy/i, /solid/i, /liquid/i, /melting point/i]
    },
    {
      category,
      name: 'heat-of-vaporization',
      prompt: 'what is heat of vaporization',
      expectedIdea: 'Heat of vaporization is energy needed to turn liquid to gas at boiling point.',
      includes: [/heat of vaporization/i, /energy/i, /liquid/i, /gas/i, /boiling point/i]
    },
    {
      category,
      name: 'heating-curve-definition',
      prompt: 'what is a heating curve',
      expectedIdea: 'A heating curve shows state transitions as heat/energy is added.',
      includes: [/heating curve/i, /state|phase/i, /heat|energy/i, /added/i]
    },
    {
      category,
      name: 'heating-curve-flat-zero',
      prompt: 'on a heating curve what is happening at the flat part at 0 degrees',
      expectedIdea: 'At 0 C water is melting; heat of fusion; solid and liquid.',
      includes: [/0/i, /melting|heat of fusion/i, /solid/i, /liquid/i]
    },
    {
      category,
      name: 'heating-curve-liquid-segment',
      prompt: 'what part of a heating curve is liquid',
      expectedIdea: 'Liquid water is segment 3 or 0-100 C.',
      includes: [/liquid/i, /segment 3|0.*100|between/i]
    },
    {
      category,
      name: 'water-120c-gas',
      prompt: 'what state is water at 120 C',
      expectedIdea: 'Water at 120 C is gas/water vapor.',
      includes: [/120/i, /gas|water vapor|steam/i]
    },
    {
      category,
      name: 'water-negative-10c-solid',
      prompt: 'what state is water at -10 C',
      expectedIdea: 'Water at -10 C is solid ice.',
      includes: [/-10/i, /solid|ice/i]
    },
    {
      category,
      name: 'bare-heating-curve-segment-needs-context',
      prompt: 'what is segment 4 on a heating curve',
      expectedIdea: 'Bare segment-number prompts should ask for diagram context while giving the standard Unit 6 water curve as a cautious reference.',
      includes: [/need|diagram|context|know for sure/i, /standard Unit 6 water heating curve/i, /segment 4/i, /boiling|heat of vaporization/i, /liquid/i, /gas/i]
    },
    {
      category,
      name: 'standard-unit6-heating-curve-segment-4',
      prompt: 'on the standard Unit 6 water heating curve what is segment 4',
      expectedIdea: 'On the standard Unit 6 water heating curve, segment 4 is boiling/heat of vaporization/liquid plus gas.',
      includes: [/segment 4/i, /boiling|heat of vaporization/i, /liquid/i, /gas/i],
      excludes: [/need.*diagram|diagram.*know for sure/i]
    },
    {
      category,
      name: 'segment-one-solid',
      prompt: 'what is segment 1 on a heating curve',
      expectedIdea: 'Segment 1 is solid.',
      includes: [/segment 1/i, /solid/i]
    },
    {
      category,
      name: 'segment-five-gas',
      prompt: 'what is segment 5 on a heating curve',
      expectedIdea: 'Segment 5 is gas.',
      includes: [/segment 5/i, /gas/i]
    }
  ];
}

function solutionSolubilityCases() {
  const category = 'solutions and solubility';
  return [
    {
      category,
      name: 'solution-definition',
      prompt: 'what is a solution',
      expectedIdea: 'A solution is a homogeneous mixture with same composition throughout.',
      includes: [/solution/i, /homogeneous/i, /same throughout|uniform/i]
    },
    {
      category,
      name: 'solute-definition',
      prompt: 'what is a solute',
      expectedIdea: 'The solute is the substance dissolved.',
      includes: [/solute/i, /dissolved|gets dissolved/i]
    },
    {
      category,
      name: 'solvent-definition',
      prompt: 'what is a solvent',
      expectedIdea: 'The solvent does the dissolving.',
      includes: [/solvent/i, /does the dissolving|dissolves/i]
    },
    {
      category,
      name: 'lemonade-solute',
      prompt: 'what is the solute in lemonade',
      expectedIdea: 'Sugar/lemon mix is the solute in lemonade.',
      includes: [/solute/i, /sugar|lemon/i]
    },
    {
      category,
      name: 'lemonade-solvent',
      prompt: 'what is the solvent in lemonade',
      expectedIdea: 'Water is the solvent in lemonade.',
      includes: [/solvent/i, /water/i]
    },
    {
      category,
      name: 'air-gas-solution',
      prompt: 'is air a gas in gas solution',
      expectedIdea: 'Air is a gas-in-gas solution.',
      includes: [/air/i, /gas/i, /solution/i]
    },
    {
      category,
      name: 'soda-gas-liquid-solution',
      prompt: 'what type of solution is soda',
      expectedIdea: 'Soda is carbon dioxide gas in water/liquid.',
      includes: [/soda/i, /carbon dioxide|CO2/i, /gas/i, /liquid|water/i]
    },
    {
      category,
      name: 'rubbing-alcohol-liquid-liquid',
      prompt: 'what kind of solution is rubbing alcohol',
      expectedIdea: 'Rubbing alcohol is liquid in liquid.',
      includes: [/rubbing alcohol/i, /liquid/i, /solution/i]
    },
    {
      category,
      name: 'alloy-definition',
      prompt: 'what is an alloy',
      expectedIdea: 'An alloy is a solid solution of metals.',
      includes: [/alloy/i, /solution/i, /metals?/i]
    },
    {
      category,
      name: 'brass-bronze-sterling-examples',
      prompt: 'are brass bronze and sterling silver alloys',
      expectedIdea: 'Brass, bronze, and sterling silver are alloys.',
      includes: [/brass/i, /bronze/i, /sterling silver/i, /alloys?/i]
    },
    {
      category,
      name: 'solubility-definition',
      prompt: 'what is solubility',
      expectedIdea: 'Solubility is maximum solute dissolved in a solvent at a given temperature.',
      includes: [/solubility/i, /maximum|amount/i, /solute/i, /solvent/i, /temperature/i]
    },
    {
      category,
      name: 'unsaturated-definition',
      prompt: 'what does unsaturated mean',
      expectedIdea: 'Unsaturated can dissolve more solute.',
      includes: [/unsaturated/i, /dissolve more|can hold more|more solute/i]
    },
    {
      category,
      name: 'saturated-definition',
      prompt: 'what does saturated mean',
      expectedIdea: 'Saturated contains all the solute it can hold at that temperature.',
      includes: [/saturated/i, /all|maximum|can hold/i, /solute/i, /temperature/i]
    },
    {
      category,
      name: 'supersaturated-definition',
      prompt: 'what is supersaturated',
      expectedIdea: 'Supersaturated contains more solute than normally possible and is unstable.',
      includes: [/supersaturated/i, /more solute|more than/i, /normally|usually/i, /unstable|extra/i]
    },
    {
      category,
      name: 'solubility-curve',
      prompt: 'what does a solubility curve show',
      expectedIdea: 'A solubility curve shows how much solute dissolves at different temperatures.',
      includes: [/solubility curve/i, /amount|how much/i, /solute/i, /temperature/i]
    },
    {
      category,
      name: 'water-polar',
      prompt: 'why is water called polar',
      expectedIdea: 'Water has slightly positive and negative sides.',
      includes: [/water/i, /polar/i, /positive/i, /negative/i]
    },
    {
      category,
      name: 'salt-dissolves-water',
      prompt: 'why does salt dissolve in water',
      expectedIdea: 'Ionic salt dissolves because polar water attracts opposite charges/ions.',
      includes: [/salt/i, /water/i, /polar/i, /ions?|charges?/i, /attract/i]
    },
    {
      category,
      name: 'dissociation-definition',
      prompt: 'what is dissociation',
      expectedIdea: 'Dissociation is ionic compounds separating into ions with water surrounding them.',
      includes: [/dissociation/i, /ionic/i, /separate/i, /ions?/i, /water/i]
    },
    {
      category,
      name: 'sugar-dissolve-faster',
      prompt: 'how can I make sugar dissolve faster',
      expectedIdea: 'Heat, stir, and crush/increase surface area.',
      includes: [/heat|temperature/i, /stir/i, /crush|smaller|surface area/i]
    },
    {
      category,
      name: 'stirring-dissolving-faster',
      prompt: 'does stirring make dissolving faster',
      expectedIdea: 'Stirring makes dissolving faster by bringing fresh solvent into contact.',
      includes: [/stirring|stir/i, /faster/i, /fresh solvent|contact|collisions/i]
    },
    {
      category,
      name: 'crushing-solute-faster',
      prompt: 'does crushing a solute make it dissolve faster',
      expectedIdea: 'Crushing increases surface area and speeds dissolving.',
      includes: [/crushing|crush/i, /solute/i, /surface area|smaller pieces/i, /faster/i]
    },
    {
      category,
      name: 'heating-solvent-faster',
      prompt: 'why does heating solvent make dissolving faster',
      expectedIdea: 'Heating raises kinetic energy and collisions.',
      includes: [/heating|heat/i, /solvent/i, /kinetic energy|particles move faster/i, /collisions?|faster/i]
    }
  ];
}

function studentWordingCases() {
  const category = 'student wording and wrong-domain protections';
  return [
    {
      category,
      name: 'homogenous-typo',
      prompt: 'what does homogenous mean',
      expectedIdea: 'Homogenous should be treated as homogeneous.',
      includes: [/homogeneous|homogenous/i, /same throughout|uniform/i]
    },
    {
      category,
      name: 'heterogenous-typo',
      prompt: 'what does heterogenous mean',
      expectedIdea: 'Heterogenous should be treated as heterogeneous.',
      includes: [/heterogeneous|heterogenous/i, /different parts|uneven|not uniform/i]
    },
    {
      category,
      name: 'viscosty-typo',
      prompt: 'what is viscosty',
      expectedIdea: 'Viscosty should route to viscosity.',
      includes: [/viscosity|viscosty/i, /flow/i, /thick|resistance/i]
    },
    {
      category,
      name: 'syrup-pour-slow',
      prompt: 'why syrup pour slow',
      expectedIdea: 'Syrup pours slowly because it has high viscosity.',
      includes: [/syrup/i, /slow/i, /viscosity|viscous|resists flow/i]
    },
    {
      category,
      name: 'milk-homo-hetero',
      prompt: 'is milk homo or hetero',
      expectedIdea: 'Milk is a colloid/heterogeneous mixture.',
      includes: [/milk/i, /colloid|heterogeneous|hetero/i]
    },
    {
      category,
      name: 'paint-typo-pant-homo',
      prompt: 'is pant homo',
      expectedIdea: 'Pant should be treated as likely paint only in homo/hetero classification context.',
      includes: [/paint/i, /colloid|heterogeneous/i, /not.*homogeneous|not.*solution/i]
    },
    {
      category,
      name: 'olive-oil-water-heterogeneous-not-h2o',
      prompt: 'olive oil in water is that a homo or hetero',
      expectedIdea: 'Oil in water is heterogeneous/suspension, not H2O compound routing.',
      includes: [/olive oil|oil/i, /water/i, /heterogeneous/i, /separate|different parts/i],
      excludes: [/H2O|covalent|hydrogen|oxygen/i],
      conceptTutorChoice: 2
    },
    {
      category,
      name: 'mineral-water-homogeneous-not-h2o',
      prompt: 'mineral water is homo or hetero',
      expectedIdea: 'Mineral water is usually homogeneous because minerals are dissolved evenly.',
      includes: [/mineral water/i, /homogeneous|solution/i, /evenly|same throughout|dissolved/i],
      excludes: [/H2O|covalent|hydrogen|oxygen/i]
    },
    {
      category,
      name: 'bleach-homogeneous',
      prompt: 'bleach is homo or hetero',
      expectedIdea: 'Bleach is a homogeneous mixture/solution.',
      includes: [/bleach/i, /homogeneous|solution/i]
    },
    {
      category,
      name: 'dirt-heterogeneous-usually',
      prompt: 'dirt is homo or hetero',
      expectedIdea: 'Dirt is usually heterogeneous because it has different visible particles.',
      includes: [/dirt|soil/i, /usually/i, /heterogeneous/i, /different|visible|particles/i]
    },
    {
      category,
      name: 'skittles-typo-heterogeneous',
      prompt: 'skittles ar homogeneous or heterogeneous',
      expectedIdea: 'Skittles are heterogeneous because different pieces/colors are visible.',
      includes: [/skittles/i, /heterogeneous/i, /pieces|colors|visible/i]
    },
    {
      category,
      name: 'asphalt-heterogeneous-usually',
      prompt: 'Asphalt is homo or hetero',
      expectedIdea: 'Asphalt is usually heterogeneous because aggregate/stone and binder are mixed.',
      includes: [/asphalt/i, /usually/i, /heterogeneous/i, /aggregate|stone|binder|different materials/i]
    },
    {
      category,
      name: 'toothpaste-colloid-usually',
      prompt: 'toothpaste is homo or hetero',
      expectedIdea: 'Toothpaste is usually treated as a colloid/heterogeneous mixture in this unit.',
      includes: [/toothpaste/i, /usually/i, /colloid/i, /heterogeneous/i]
    },
    {
      category,
      name: 'mayo-mixture',
      prompt: 'is mayo a mixture',
      expectedIdea: 'Mayo is a colloid/heterogeneous mixture.',
      includes: [/mayo|mayonnaise/i, /mixture|colloid|heterogeneous/i]
    },
    {
      category,
      name: 'vaporization-vs-evaporation',
      prompt: 'what is vaporization vs evaporation',
      expectedIdea: 'Vaporization is liquid to gas; evaporation is surface vaporization.',
      includes: [/vaporization/i, /evaporation/i, /liquid/i, /gas/i, /surface/i]
    },
    {
      category,
      name: 'boiling-water-physical-chem-short',
      prompt: 'boiling water physical or chem',
      expectedIdea: 'Boiling water is physical, not chemical.',
      includes: [/boiling/i, /physical/i]
    },
    {
      category,
      name: 'rusting-fishing-pole',
      prompt: 'rusting fishing pole physical or chemical',
      expectedIdea: 'Rusting a fishing pole is a chemical change.',
      includes: [/rusting|rust/i, /fishing pole|pole/i, /chemical/i]
    },
    {
      category,
      name: 'density-box-student-phrasing',
      prompt: 'density if mass is 80g and box is 3 by 6 by 4',
      expectedIdea: 'Student shorthand should solve volume 72 and density about 1.11.',
      includes: [/72/i, /1\.11/i, /density/i],
      allowsFormulaRoute: true,
      allowsTutor: true
    },
    {
      category,
      name: 'water-displacement-student-phrasing',
      prompt: 'water goes from 33.5 to 46.2 ml and metal mass 16.25 what density',
      expectedIdea: 'Student shorthand should use displacement 12.7 mL and density about 1.28.',
      includes: [/12\.7/i, /1\.28/i, /density/i],
      allowsFormulaRoute: true,
      allowsTutor: true
    },
    {
      category,
      name: 'solvnet-typo',
      prompt: 'what does solvnet mean',
      expectedIdea: 'Solvnet should route to solvent.',
      includes: [/solvent|solvnet/i, /dissolves|dissolving/i]
    },
    {
      category,
      name: 'solute-solvent-difference',
      prompt: 'solute solvent difference',
      expectedIdea: 'Solute is dissolved; solvent does the dissolving.',
      includes: [/solute/i, /solvent/i, /dissolved/i, /dissolving|dissolves/i]
    },
    {
      category,
      name: 'matter-not-waves',
      prompt: 'what is matter in Unit 6 chemistry',
      expectedIdea: 'Matter prompt should not answer as Unit 5 waves transferring energy through matter.',
      includes: [/mass/i, /space|volume/i],
      excludes: [/wave speed|electromagnetic|transfers energy/i]
    },
    {
      category,
      name: 'saturated-not-fat',
      prompt: 'what does saturated mean in solutions',
      expectedIdea: 'Saturated in solutions means holding all the solute it can.',
      includes: [/saturated/i, /solute/i, /solution/i],
      excludes: [/fat|nutrition/i]
    }
  ];
}

function conceptTutorCases() {
  const category = 'concept tutor audit shape';
  return [
    {
      category,
      name: 'classification-concept-tutor-shape',
      prompt: 'Quiz me on homogeneous and heterogeneous mixtures.',
      expectedIdea: 'If a concept tutor starts, it should keep the original question and ask focused choices.',
      includes: [/homogeneous|heterogeneous|mixture/i],
      allowsTutor: true
    },
    {
      category,
      name: 'state-change-concept-tutor-shape',
      prompt: 'Teach me changes of state with a quick guided question.',
      expectedIdea: 'If a concept tutor starts, it should ask focused state-change choices.',
      includes: [/state|melting|freezing|vaporization|condensation|physical/i],
      allowsTutor: true
    },
    {
      category,
      name: 'solutions-concept-tutor-shape',
      prompt: 'Quiz me on solute and solvent.',
      expectedIdea: 'If a concept tutor starts, it should ask focused solution choices.',
      includes: [/solute|solvent|solution/i],
      allowsTutor: true
    }
  ];
}
