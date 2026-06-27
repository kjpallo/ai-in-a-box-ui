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
    name: 'knowledge/routing',
    run: () => assertDirectStudentCases(knowledgeRoutingCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'energy-type direct answers',
    run: () => assertDirectStudentCases(energyTypeDirectAnswerCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'wrong-domain answer',
    run: () => assertDirectStudentCases(wrongDomainCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'formula solving',
    run: () => assertFormulaDirectCases(formulaSolvingCases())
  },
  {
    name: 'tutor gating',
    run: () => assertTutorGatingCases(tutorGatingCases())
  },
  {
    name: 'tutor wording',
    run: () => assertTutorWordingCases(tutorWordingCases())
  },
  {
    name: 'graph/diagram wording',
    run: () => assertDirectStudentCases(graphDiagramCases(), {
      guidedTutorEnabled: true,
      assertRoute: true
    })
  },
  {
    name: 'answer formatting',
    run: () => assertDirectStudentCases(answerFormattingCases(), {
      guidedTutorEnabled: false,
      assertRoute: false
    })
  }
];

run();

async function run() {
  const allResults = [];

  for (const category of CATEGORIES) {
    console.log('');
    console.log(`Energy Unit 3 ${category.name}:`);
    const results = await category.run();
    allResults.push(...results);
    const passed = results.filter((result) => result.passed).length;
    const failed = results.filter((result) => !result.passed).length;
    console.log(`  ${passed} passed, ${failed} failed.`);
  }

  const passed = allResults.filter((result) => result.passed).length;
  const failed = allResults.filter((result) => !result.passed);

  console.log('');
  console.log(`Energy Unit 3 regression audit: ${passed} passed, ${failed.length} failed.`);

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
      assert.equal(route.type, 'science_formula', `${label(testCase)} should route as a science formula`);
      assertAnswer(route.directAnswer, testCase);
      assertConservationWording(route.directAnswer, testCase);

      const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
      assert.notEqual(response.body.routeType, 'formula_tutor', `${label(testCase)} should answer directly when guided tutor is off`);
      assertDirectBody(response.body, testCase);
    });
  }

  return results;
}

async function assertTutorGatingCases(cases) {
  const results = [];

  for (const testCase of cases) {
    await record(results, testCase, async () => {
      const directHarness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: false });
      const direct = await sendHarnessMessage(directHarness, `${testCase.name}-direct`, testCase.prompt);
      assert.notEqual(direct.body.routeType, 'formula_tutor', `${label(testCase)} direct-answer mode should not start Formula Tutor`);
      assertAnswer(direct.body.response, testCase);

      const route = routeWithTeacherKnowledge(testCase.prompt);
      assert.equal(route.type, 'science_formula', `${label(testCase)} should route as a science formula`);
      assert.ok(route.formulaWork, `${label(testCase)} should expose formulaWork`);
      assert.ok(Array.isArray(route.formulaWork.steps) && route.formulaWork.steps.length > 0, `${label(testCase)} formulaWork should include guided steps`);

      const guidedHarness = await createHarnessSession({ studentGuidedFormulaTutoringEnabled: true });
      const guided = await sendHarnessMessage(guidedHarness, `${testCase.name}-guided`, testCase.prompt);
      assert.equal(guided.body.routeType, 'formula_tutor', `${label(testCase)} should start Formula Tutor when guided tutoring is enabled`);
      assert.equal(guided.body.tutor?.active, true, `${label(testCase)} tutor should be active`);
      assert.equal(guided.body.tutor?.formulaId, testCase.formulaId, `${label(testCase)} formula id`);
      assert.match(guided.body.tutor?.solveFor || '', testCase.solveFor, `${label(testCase)} solve target`);
      assert.equal(guided.body.tutor?.originalQuestion, testCase.prompt, `${label(testCase)} should keep original question`);
      assert.ok(guided.body.tutor?.totalSteps > 0, `${label(testCase)} should expose total steps`);
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
      assert.equal(start.body.routeType, 'formula_tutor', `${label(testCase)} should start Formula Tutor so wording can be audited`);

      const tutor = start.body.tutor || {};
      const work = tutor.work || {};
      const startText = `${start.body.response || ''}\n${JSON.stringify(tutor)}`;
      assert.equal(tutor.originalQuestion || work.originalQuestion, testCase.prompt, `${label(testCase)} should preserve original question context`);
      assert.ok(Array.isArray(tutor.knownValues || work.knownValues), `${label(testCase)} should expose known values`);
      assert.ok((tutor.knownValues || work.knownValues || []).length >= testCase.minimumKnownValues, `${label(testCase)} should expose the problem's known values`);
      assert.match(tutor.currentStepPrompt || work.currentStep?.prompt || '', /what variable are we solving for/i, `${label(testCase)} should ask what variable is being solved for`);
      assert.doesNotMatch(startText, /PJ|sidewalk|doorstep|pool|truck|suitcase|Newton'?s Second Law|motion\/force/i, `${label(testCase)} should not leak old motion/force wording`);
      assert.doesNotMatch(start.body.response || '', /what should we do next\?/i, `${label(testCase)} should not use a vague open-ended formula prompt`);

      const solveTargetChoice = findCorrectChoice(
        tutor.currentStep?.choices || work.currentStep?.choices || [],
        tutor.solveFor || work.solveFor || ''
      );
      assert.ok(solveTargetChoice, `${label(testCase)} should expose a correct solve-target choice`);
      const formulaStep = await sendHarnessMessage(harness, testCase.name, String(solveTargetChoice.number));
      assert.equal(formulaStep.body.tutor?.stepId, 'choose_formula', `${label(testCase)} should move to formula choice step`);
      assert.match(formulaStep.body.tutor?.currentStepPrompt || '', /which formula/i, `${label(testCase)} should ask for formula choice`);
      assert.match(JSON.stringify(formulaStep.body.tutor?.currentStep?.choices || []), testCase.formulaChoice, `${label(testCase)} should show the expected formula`);

      const stopped = await sendHarnessMessage(harness, testCase.name, 'stop');
      assert.equal(stopped.body.tutor?.stopped, true, `${label(testCase)} should stop tutor cleanly`);
      assert.equal(stopped.body.tutor?.currentStep, null, `${label(testCase)} should clear stale choices after stop`);
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
  assert.ok(route, `${label(testCase)} should return a route`);
  assert.notEqual(route.type, 'no_match', `${label(testCase)} should not be no_match`);
  if (!testCase.allowsFormulaRoute) {
    assert.notEqual(route.type, 'science_formula', `${label(testCase)} should not route as formula work`);
  }
  assertAnswer(route.directAnswer, testCase);
}

function assertDirectBody(body, testCase) {
  assert.ok(body, `${label(testCase)} should return a student body`);
  if (!testCase.allowsTutor) {
    assert.notEqual(body.routeType, 'formula_tutor', `${label(testCase)} should answer directly, not start Formula Tutor`);
    assert.notEqual(body.routeType, 'motion_force_knowledge_tutor', `${label(testCase)} should answer directly, not start General Tutor`);
  }
  if (testCase.routeTypes) {
    assert.ok(testCase.routeTypes.includes(body.routeType), `${label(testCase)} should use one of ${testCase.routeTypes.join(', ')}, got ${body.routeType}`);
  }
  assertAnswer(body.response, testCase);
  assertConservationWording(body.response, testCase);
}

function assertAnswer(answer, testCase) {
  const answerText = String(answer || '');
  assert.ok(answerText.trim(), `${label(testCase)} should produce an answer`);

  for (const expected of testCase.includes || []) {
    assert.match(answerText, expected, `${label(testCase)} should include ${expected} but got:\n${answerText}`);
  }

  for (const unexpected of testCase.excludes || []) {
    assert.doesNotMatch(answerText, unexpected, `${label(testCase)} should not include ${unexpected} but got:\n${answerText}`);
  }

  for (const unit of testCase.units || []) {
    assert.match(answerText, unit, `${label(testCase)} should include required unit ${unit} but got:\n${answerText}`);
  }
}

function assertConservationWording(answer, testCase) {
  if (!testCase.checkConservationWording) return;
  const answerText = String(answer || '');
  assert.doesNotMatch(answerText, /\benergy\s+is\s+created\b|\bcreated\s+energy\b/i, `${label(testCase)} should not say energy is created`);
  assert.doesNotMatch(answerText, /\benergy\s+is\s+destroyed\b|\bdestroyed\s+energy\b/i, `${label(testCase)} should not say energy is destroyed`);
  if (/\benergy\s+(?:is\s+)?lost\b/i.test(answerText)) {
    assert.match(answerText, /thermal|heat|sound|other forms|transformed|converted|changes form/i, `${label(testCase)} should explain "lost" energy as changed into other forms`);
  }
}

async function createHarnessSession(options) {
  const harness = createStudentRouteHarness(options);
  const create = await harness.request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201, 'energy regression harness should create a session');
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

function label(testCase) {
  return `${testCase.name} [${testCase.category}]`;
}

function knowledgeRoutingCases() {
  const category = 'knowledge/routing';
  return [
    {
      category,
      name: 'energy-definition',
      prompt: 'What is energy?',
      includes: [/ability to cause change|ability to do work|cause change/i, /joules?|J\b/i]
    },
    {
      category,
      name: 'kinetic-energy-definition',
      prompt: 'What is kinetic energy?',
      includes: [/energy.*motion|moving/i, /KE\s*=\s*(?:1\/2|0\.5).*m.*v/i]
    },
    {
      category,
      name: 'potential-energy-definition',
      prompt: 'What is potential energy?',
      includes: [/stored energy/i],
      excludes: [/only gravitational/i]
    },
    {
      category,
      name: 'three-types-potential-energy',
      prompt: 'What are the three types of potential energy?',
      includes: [/elastic/i, /chemical/i, /gravitational/i]
    },
    {
      category,
      name: 'gravitational-potential-energy-definition',
      prompt: 'What is gravitational potential energy?',
      includes: [/stored energy/i, /above|height|Earth/i, /(?:GPE|PE)\s*=\s*(?:h\s*(?:[*x]|\u00d7)\s*a\s*(?:[*x]|\u00d7)\s*m|m\s*(?:[*x]|\u00d7)\s*g\s*(?:[*x]|\u00d7)\s*h|mgh)/i]
    },
    {
      category,
      name: 'law-conservation-energy',
      prompt: 'What is the law of conservation of energy?',
      includes: [/cannot be created/i, /cannot be destroyed/i, /changes forms|transformed|converted/i],
      checkConservationWording: true
    },
    {
      category,
      name: 'mechanical-energy-definition',
      prompt: 'What is mechanical energy?',
      includes: [/kinetic energy/i, /potential energy/i, /total|sum|\+/i],
      excludes: [/machines? only/i]
    },
    {
      category,
      name: 'falling-object-ke-gpe',
      prompt: 'What happens to potential energy and kinetic energy as an object falls?',
      includes: [/potential energy|GPE/i, /decreases|goes down/i, /kinetic energy|KE/i, /increases|goes up/i]
    },
    {
      category,
      name: 'bouncing-ball-eventually-stops',
      prompt: 'Why does a bouncing ball eventually stop?',
      includes: [/energy/i, /thermal|heat|sound|air resistance|friction/i, /changes form|converted|transferred|transforms/i],
      excludes: [/energy (?:is )?destroyed/i],
      checkConservationWording: true
    },
    {
      category,
      name: 'food-stored-energy',
      prompt: 'What type of energy is stored in food?',
      includes: [/chemical/i, /potential/i]
    },
    {
      category,
      name: 'stretched-spring-energy',
      prompt: 'What type of energy is stored in a stretched spring?',
      includes: [/elastic/i, /potential/i]
    },
    {
      category,
      name: 'outlets-power-plants-energy',
      prompt: 'What type of energy comes from outlets and power plants?',
      includes: [/electrical energy|electricity/i]
    },
    {
      category,
      name: 'temperature-measures',
      prompt: 'What is temperature measuring?',
      includes: [/average kinetic energy/i, /particles/i]
    },
    {
      category,
      name: 'heat-flow-direction',
      prompt: 'Which way does heat flow?',
      includes: [/higher temperature|warmer|hotter/i, /lower temperature|cooler|colder/i]
    },
    {
      category,
      name: 'ice-cube-cold-hand',
      prompt: 'Why does your hand feel cold when you hold an ice cube?',
      includes: [/heat/i, /leaves|flows out|transfers from/i, /hand|body/i, /ice/i],
      excludes: [/cold flows/i]
    },
    {
      category,
      name: 'conduction-definition',
      prompt: 'What is conduction?',
      includes: [/heat transfer/i, /direct contact|direct particle contact|touching/i]
    },
    {
      category,
      name: 'convection-definition',
      prompt: 'What is convection?',
      includes: [/heat transfer|transfers heat/i, /movement/i, /liquids?|gases/i]
    },
    {
      category,
      name: 'radiation-definition',
      prompt: 'What is radiation?',
      includes: [/heat transfer|transfers heat/i, /electromagnetic waves/i, /space|empty space/i]
    },
    {
      category,
      name: 'insulator-definition',
      prompt: 'What is an insulator?',
      includes: [/resist|limit|does not allow/i, /heat|thermal/i],
      excludes: [/charge or current/i]
    },
    {
      category,
      name: 'conductor-definition',
      prompt: 'What is a conductor?',
      includes: [/allow/i, /heat|thermal/i, /flow|transfer/i],
      excludes: [/charge or current/i]
    },
    {
      category,
      name: 'specific-heat-definition',
      prompt: 'What is specific heat?',
      includes: [/heat|energy/i, /1\s*(?:kg|kilogram)/i, /1(?:\s*degree)?(?:\s*C| Celsius| K| kelvin)|1\u00b0C/i]
    },
    {
      category,
      name: 'work-physics-definition',
      prompt: 'What is work in physics?',
      includes: [/force/i, /move|movement|distance/i, /direction/i]
    },
    {
      category,
      name: 'weightlifter-holding-still-work',
      prompt: 'Is work being done when a weightlifter holds a weight still? Why or why not?',
      includes: [/no/i, /not moving|no movement|distance is 0|displacement is 0/i]
    },
    {
      category,
      name: 'power-definition',
      prompt: 'What is power?',
      includes: [/rate/i, /work|energy transfer/i, /P\s*=\s*W\s*\/\s*t|work\s*\/\s*time/i]
    }
  ];
}

function wrongDomainCases() {
  const category = 'wrong-domain answer';
  return [
    {
      category,
      name: 'work-physics-not-schoolwork',
      prompt: 'In physics, what does work mean?',
      includes: [/force/i, /moves?|distance/i, /direction/i],
      excludes: [/schoolwork|homework|job|labor/i]
    },
    {
      category,
      name: 'power-not-political',
      prompt: 'In energy physics, what does power mean?',
      includes: [/rate/i, /work|energy/i, /time/i],
      excludes: [/political|government|authority|control over people/i]
    },
    {
      category,
      name: 'radiation-heat-transfer-not-nuclear',
      prompt: 'In this heat transfer unit, what is radiation?',
      includes: [/electromagnetic waves/i, /heat transfer|transfers heat/i],
      excludes: [/nuclear danger|radioactive|cancer/i]
    },
    {
      category,
      name: 'conductor-heat-context',
      prompt: 'In heat transfer, what is a conductor?',
      includes: [/heat|thermal/i, /flow|transfer/i, /easily/i],
      excludes: [/charge or current|electrons/i]
    },
    {
      category,
      name: 'mechanical-energy-not-machines',
      prompt: 'In energy class, what is mechanical energy?',
      includes: [/kinetic/i, /potential/i],
      excludes: [/machines? only|engines? only/i]
    },
    {
      category,
      name: 'cold-does-not-flow',
      prompt: 'Does cold flow from an ice cube into my hand?',
      includes: [/cold (?:does not|doesn't) flow|cold is not what flows/i, /heat/i, /hand/i, /ice/i],
      excludes: [/cold flows/i]
    },
    {
      category,
      name: 'energy-lost-means-changed-form',
      prompt: 'When a bouncing ball stops, is the energy lost?',
      includes: [/not destroyed|not gone|conserved|changes form|converted|transferred/i, /thermal|heat|sound/i],
      excludes: [/energy (?:is )?destroyed/i],
      checkConservationWording: true
    }
  ];
}

function energyTypeDirectAnswerCases() {
  const category = 'energy-type direct answers';
  const routeTypes = ['science_concept', 'definition'];
  return [
    {
      category,
      routeTypes,
      name: 'moving-car-kinetic-mechanical',
      prompt: 'What type of energy does a moving car have?',
      includes: [/kinetic energy/i, /motion/i, /mechanical energy/i]
    },
    {
      category,
      routeTypes,
      name: 'rolling-ball-kinetic',
      prompt: 'What type of energy does a rolling ball have?',
      includes: [/kinetic energy/i, /moving|motion/i]
    },
    {
      category,
      routeTypes,
      name: 'running-person-kinetic',
      prompt: 'What type of energy does a running person have?',
      includes: [/kinetic energy/i, /moving|motion/i]
    },
    {
      category,
      routeTypes,
      name: 'mechanical-kinetic-alias',
      prompt: 'What is mechanical kinetic energy?',
      includes: [/kinetic energy/i, /energy of motion/i, /form of mechanical energy/i],
      excludes: [/separate energy type/i]
    },
    {
      category,
      routeTypes,
      name: 'kinetic-is-mechanical',
      prompt: 'Is kinetic energy mechanical energy?',
      includes: [/yes/i, /kinetic energy/i, /form of mechanical energy/i]
    },
    {
      category,
      routeTypes,
      name: 'book-shelf-gpe',
      prompt: 'What type of energy does a book on a shelf have?',
      includes: [/gravitational potential energy/i, /height|position/i]
    },
    {
      category,
      routeTypes,
      name: 'ball-above-ground-gpe',
      prompt: 'What type of energy does a ball held above the ground have?',
      includes: [/gravitational potential energy/i, /height|position/i]
    },
    {
      category,
      routeTypes,
      name: 'water-behind-dam-gpe',
      prompt: 'What type of energy does water behind a dam have?',
      includes: [/gravitational potential energy/i, /height|position/i]
    },
    {
      category,
      routeTypes,
      name: 'stretched-rubber-band-elastic',
      prompt: 'What type of energy does a stretched rubber band have?',
      includes: [/elastic potential energy/i, /stretched|compressed/i]
    },
    {
      category,
      routeTypes,
      name: 'compressed-spring-elastic',
      prompt: 'What type of energy does a compressed spring have?',
      includes: [/elastic potential energy/i, /stretched|compressed/i]
    },
    {
      category,
      routeTypes,
      name: 'pulled-back-bow-elastic',
      prompt: 'What type of energy does a pulled-back bow have?',
      includes: [/elastic potential energy/i, /stretched|compressed/i]
    },
    {
      category,
      routeTypes,
      name: 'food-chemical',
      prompt: 'What type of energy is stored in food?',
      includes: [/chemical energy/i, /chemical potential energy/i]
    },
    {
      category,
      routeTypes,
      name: 'battery-stored-chemical',
      prompt: 'What type of energy is stored in a battery?',
      includes: [/chemical energy/i, /electrical energy/i, /circuit|used/i]
    },
    {
      category,
      routeTypes,
      name: 'gasoline-fuel-chemical',
      prompt: 'What type of energy is stored in gasoline or fuel?',
      includes: [/chemical energy/i, /bonds/i]
    },
    {
      category,
      routeTypes,
      name: 'hot-soup-thermal',
      prompt: 'What type of energy does hot soup have?',
      includes: [/thermal energy/i, /particle motion|particles/i]
    },
    {
      category,
      routeTypes,
      name: 'heat-is-thermal',
      prompt: 'What type of energy is heat?',
      includes: [/thermal energy/i, /particle motion|particles/i]
    },
    {
      category,
      routeTypes,
      name: 'particles-faster-thermal',
      prompt: 'What type of energy increases when particles move faster?',
      includes: [/thermal energy/i, /particle motion|particles/i]
    },
    {
      category,
      routeTypes,
      name: 'electric-current-electrical',
      prompt: 'What type of energy is in an electric current?',
      includes: [/electrical energy/i, /charges|electricity/i]
    },
    {
      category,
      routeTypes,
      name: 'lightning-electrical',
      prompt: 'What type of energy does lightning have?',
      includes: [/electrical energy/i, /charges|electricity/i]
    },
    {
      category,
      routeTypes,
      name: 'outlet-electrical',
      prompt: 'What type of energy comes from an outlet?',
      includes: [/electrical energy/i, /charges|electricity/i]
    },
    {
      category,
      routeTypes,
      name: 'sunlight-radiant',
      prompt: 'What type of energy is sunlight?',
      includes: [/radiant energy/i, /light|optical/i]
    },
    {
      category,
      routeTypes,
      name: 'lamp-radiant-light',
      prompt: 'What type of energy does a lamp give off?',
      includes: [/radiant energy/i, /light energy/i]
    },
    {
      category,
      routeTypes,
      name: 'optical-energy-definition',
      prompt: 'What is optical energy?',
      includes: [/light energy/i, /radiant energy/i]
    },
    {
      category,
      routeTypes,
      name: 'radiant-same-as-light',
      prompt: 'Is radiant energy the same as light energy?',
      includes: [/radiant energy/i, /light energy|light/i, /electromagnetic waves|class context|classroom/i]
    },
    {
      category,
      routeTypes,
      name: 'sound-energy-definition',
      prompt: 'What type of energy is sound?',
      includes: [/sound energy/i, /vibrations?|sound waves/i]
    },
    {
      category,
      routeTypes,
      name: 'vibrating-speaker-sound',
      prompt: 'What type of energy comes from a vibrating speaker?',
      includes: [/sound energy/i, /vibrations?|sound waves/i]
    },
    {
      category,
      routeTypes,
      name: 'vibrations-through-matter-sound',
      prompt: 'What type of energy travels as vibrations through matter?',
      includes: [/sound energy/i, /vibrations?|sound waves/i]
    },
    {
      category,
      routeTypes,
      name: 'moving-car-kinetic-or-mechanical',
      prompt: 'Does a moving car have kinetic or mechanical energy?',
      includes: [/both/i, /kinetic energy/i, /mechanical energy/i, /more specific/i]
    },
    {
      category,
      routeTypes,
      name: 'rubber-band-elastic-or-potential',
      prompt: 'Is a stretched rubber band elastic or potential energy?',
      includes: [/elastic potential energy/i, /specific kind of potential energy/i]
    },
    {
      category,
      routeTypes,
      name: 'sunlight-radiant-or-optical',
      prompt: 'Is sunlight radiant or optical energy?',
      includes: [/both/i, /radiant energy/i, /optical|light energy/i]
    },
    {
      category,
      routeTypes,
      name: 'battery-chemical-or-electrical',
      prompt: 'Is a battery chemical or electrical energy?',
      includes: [/chemical energy/i, /electrical energy/i, /circuit|used/i]
    },
    {
      category,
      routeTypes,
      name: 'define-chemical-energy',
      prompt: 'What is chemical energy?',
      includes: [/stored/i, /chemical bonds/i]
    },
    {
      category,
      routeTypes,
      name: 'define-electrical-energy',
      prompt: 'What is electrical energy?',
      includes: [/moving electric charges|electricity/i]
    },
    {
      category,
      routeTypes,
      name: 'define-radiant-energy',
      prompt: 'What is radiant energy?',
      includes: [/light|electromagnetic waves/i]
    },
    {
      category,
      routeTypes,
      name: 'define-light-energy',
      prompt: 'What is light energy?',
      includes: [/light energy/i, /radiant energy/i]
    },
    {
      category,
      routeTypes,
      name: 'define-sound-energy',
      prompt: 'What is sound energy?',
      includes: [/vibrations?/i, /sound waves/i]
    },
    {
      category,
      routeTypes,
      name: 'kinetic-potential-difference',
      prompt: 'Explain the difference between kinetic and potential energy.',
      includes: [/kinetic energy/i, /motion/i, /potential energy/i, /stored energy/i]
    },
    {
      category,
      routeTypes,
      name: 'radiant-thermal-difference',
      prompt: 'Explain the difference between radiant and thermal energy.',
      includes: [/radiant energy/i, /light|electromagnetic waves/i, /thermal energy/i, /particles/i]
    },
    {
      category,
      routeTypes,
      name: 'chemical-electrical-difference',
      prompt: 'Explain the difference between chemical and electrical energy.',
      includes: [/chemical energy/i, /chemical bonds/i, /electrical energy/i, /moving electric charges|electricity/i]
    }
  ];
}

function formulaSolvingCases() {
  const category = 'formula solving';
  return [
    {
      category,
      name: 'boundary-calculate-ke-2kg-3ms',
      prompt: 'Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.',
      includes: [/KE\s*=\s*(?:1\/2|0\.5)/i, /9\s*J\b/i],
      units: [/\bJ\b/]
    },
    {
      category,
      name: 'boundary-calculate-pe-5kg-10m',
      prompt: 'Calculate potential energy if mass is 5 kg and height is 10 m.',
      includes: [/(?:G?PE)\s*=/i, /490\s*J\b/i],
      units: [/\bJ\b/]
    },
    {
      category,
      name: 'boundary-calculate-work-20n-3m',
      prompt: 'Calculate work if force is 20 N and distance is 3 m.',
      includes: [/W\s*=/i, /60\s*J\b/i],
      units: [/\bJ\b/]
    },
    {
      category,
      name: 'boundary-calculate-power-100j-5s',
      prompt: 'Calculate power if work is 100 J and time is 5 s.',
      includes: [/P\s*=/i, /20\s*(?:W|J\/s)\b/i],
      units: [/\bW\b|J\/s/]
    },
    {
      category,
      name: 'boundary-calculate-wave-speed-2m-5hz',
      prompt: 'Calculate wave speed if wavelength is 2 m and frequency is 5 Hz.',
      includes: [/wave speed\s*=/i, /10\s*m\/s/i],
      units: [/m\/s/]
    },
    {
      category,
      name: 'baseball-ke-120j',
      prompt: "A baseball with a mass of 0.15 kg is moving at a speed of 40 m/s. What is the baseball's kinetic energy?",
      includes: [/KE\s*=\s*(?:1\/2|0\.5)/i, /120\s*J\b/i],
      units: [/\bJ\b/]
    },
    {
      category,
      name: 'stone-ke-mass-5-42kg',
      prompt: 'If a stone has 390 J of energy and is moving with a speed of 12 m/s, what is the mass of the stone?',
      includes: [/m\s*=\s*2/i, /5\.4(?:[12]|167)\s*kg/i],
      units: [/\bkg\b/]
    },
    {
      category,
      name: 'ball-ke-velocity-50ms',
      prompt: 'What is the velocity of a 0.06 kg ball moving with 75 J of energy?',
      includes: [/v\s*=/i, /50\s*m\/s/i],
      units: [/m\/s/]
    },
    {
      category,
      name: 'apple-gpe-73-5j',
      prompt: 'A 5 kg apple is sitting on a 1.5 m high tree branch. What is its gravitational potential energy?',
      includes: [/(?:G?PE)\s*=/i, /73\.5\s*J\b/i],
      units: [/\bJ\b/]
    },
    {
      category,
      name: 'puppy-weight-gpe-36j',
      prompt: 'A puppy weighs 18 N and sits in a high chair 2 m high. What is its gravitational potential energy?',
      includes: [/36\s*J\b/i],
      units: [/\bJ\b/]
    },
    {
      category,
      name: 'squirrel-gpe-mass-1-63kg',
      prompt: 'A squirrel has 40 J of potential energy and is sitting on a house 2.5 m tall. What is its mass?',
      includes: [/1\.6[23]\s*kg/i],
      units: [/\bkg\b/]
    },
    {
      category,
      name: 'box-work-8j',
      prompt: 'A constant force of 2.0 N is used to push a box 4.0 m across the floor. How much work is done?',
      includes: [/W\s*=/i, /8\s*J\b/i],
      units: [/\bJ\b/]
    },
    {
      category,
      name: 'box-work-150j',
      prompt: 'A force of 30 N is used to push a box along the floor a distance of 5 meters. How much work was done?',
      includes: [/150\s*J\b/i],
      units: [/\bJ\b/]
    },
    {
      category,
      name: 'machine-work-distance-15m',
      prompt: 'A machine exerts 12,000 J of work with 800 N of force. What distance did it cover?',
      includes: [/15\s*m\b/i],
      units: [/\bm\b/]
    },
    {
      category,
      name: 'power-28j-7s-4w',
      prompt: 'How much power is used if a machine does 28 J of work in 7 seconds?',
      includes: [/4\s*(?:W|J\/s)\b/i],
      units: [/\bW\b|J\/s/]
    },
    {
      category,
      name: 'power-time-6-67s',
      prompt: 'If a machine is doing 500 J of work with 75 watts of power, how long did it take?',
      includes: [/6\.6(?:[67]|667)\s*(?:s|seconds?)\b/i],
      units: [/\bs\b|seconds?/i]
    },
    {
      category,
      name: 'zinc-specific-heat-570j',
      prompt: 'A piece of zinc was 26\u00b0C and later reached 36\u00b0C. If its mass is 0.15 kg and zinc has a specific heat of 380 J/kg/\u00b0C, find the thermal energy.',
      includes: [/570\s*J\b/i],
      units: [/\bJ\b/, /\u00b0C|degrees? Celsius/i]
    },
    {
      category,
      name: 'living-room-air-306000j',
      prompt: 'The air in a living room has a mass of 60 kg and a specific heat of 1,020 J/kg\u00b0C. What is the change in thermal energy when it warms from 20\u00b0C to 25\u00b0C?',
      includes: [/306,?000\s*J\b/i],
      units: [/\bJ\b/, /\u00b0C|degrees? Celsius/i]
    },
    {
      category,
      name: 'water-specific-heat-mass-0-15kg',
      prompt: 'The thermal energy of water in a mug increases by 12,552 J when heated from 20\u00b0C to 40\u00b0C. If c = 4,184 J/kg\u00b0C, what is the mass?',
      includes: [/0\.15\s*kg/i],
      units: [/\bkg\b/]
    },
    {
      category,
      name: 'football-conservation-height-1-84m',
      prompt: 'Justin kicks a 2.6 kg football straight up with velocity 6 m/s. Assuming all energy is conserved, at what height did it travel?',
      includes: [/1\.8[34]\s*m\b/i],
      units: [/\bm\b/],
      checkConservationWording: true
    },
    {
      category,
      name: 'baseball-conservation-height-127-6m',
      prompt: 'Thomas hits a 0.14 kg baseball straight upward at 50 m/s. Assuming all energy is conserved, what height could it reach?',
      includes: [/127\.6\s*m\b/i],
      units: [/\bm\b/],
      checkConservationWording: true
    }
  ];
}

function tutorGatingCases() {
  const category = 'tutor gating';
  return [
    {
      category,
      name: 'tutor-ke-solving-ke',
      prompt: "A baseball with a mass of 0.15 kg is moving at a speed of 40 m/s. What is the baseball's kinetic energy?",
      includes: [/120\s*J\b/i],
      formulaId: 'kinetic_energy',
      solveFor: /kinetic energy/i
    },
    {
      category,
      name: 'tutor-ke-solving-mass',
      prompt: 'If a stone has 390 J of energy and is moving with a speed of 12 m/s, what is the mass of the stone?',
      includes: [/5\.4(?:[12]|167)\s*kg/i],
      formulaId: 'kinetic_energy',
      solveFor: /mass/i
    },
    {
      category,
      name: 'tutor-ke-solving-velocity',
      prompt: 'What is the velocity of a 0.06 kg ball moving with 75 J of energy?',
      includes: [/50\s*m\/s/i],
      formulaId: 'kinetic_energy',
      solveFor: /velocity/i
    },
    {
      category,
      name: 'tutor-gpe-solving-gpe',
      prompt: 'A 5 kg apple is sitting on a 1.5 m high tree branch. What is its gravitational potential energy?',
      includes: [/73\.5\s*J\b/i],
      formulaId: 'potential_energy',
      solveFor: /potential energy/i
    },
    {
      category,
      name: 'tutor-gpe-solving-mass',
      prompt: 'A squirrel has 40 J of potential energy and is sitting on a house 2.5 m tall. What is its mass?',
      includes: [/1\.6[23]\s*kg/i],
      formulaId: 'potential_energy',
      solveFor: /mass/i
    },
    {
      category,
      name: 'tutor-gpe-solving-height',
      prompt: 'A 20 kg object has 196 J of potential energy. How high is it above the ground?',
      includes: [/1\s*m\b/i],
      formulaId: 'potential_energy',
      solveFor: /height/i
    },
    {
      category,
      name: 'tutor-work-solving-work',
      prompt: 'A constant force of 2.0 N is used to push a box 4.0 m across the floor. How much work is done?',
      includes: [/8\s*J\b/i],
      formulaId: 'work_force_distance',
      solveFor: /work/i
    },
    {
      category,
      name: 'tutor-work-solving-distance',
      prompt: 'A machine exerts 12,000 J of work with 800 N of force. What distance did it cover?',
      includes: [/15\s*m\b/i],
      formulaId: 'work_force_distance',
      solveFor: /distance/i
    },
    {
      category,
      name: 'tutor-work-solving-force',
      prompt: 'A machine does 150 J of work while moving a box 5 m. What force did it use?',
      includes: [/30\s*N\b/i],
      formulaId: 'work_force_distance',
      solveFor: /force/i
    },
    {
      category,
      name: 'tutor-power-solving-power',
      prompt: 'How much power is used if a machine does 28 J of work in 7 seconds?',
      includes: [/4\s*(?:W|J\/s)\b/i],
      formulaId: 'work_power_time',
      solveFor: /power/i
    },
    {
      category,
      name: 'tutor-power-solving-time',
      prompt: 'If a machine is doing 500 J of work with 75 watts of power, how long did it take?',
      includes: [/6\.6(?:[67]|667)\s*(?:s|seconds?)\b/i],
      formulaId: 'work_power_time',
      solveFor: /time/i
    },
    {
      category,
      name: 'tutor-specific-heat-solving-q',
      prompt: 'A piece of zinc was 26\u00b0C and later reached 36\u00b0C. If its mass is 0.15 kg and zinc has a specific heat of 380 J/kg/\u00b0C, find the thermal energy.',
      includes: [/570\s*J\b/i],
      formulaId: 'specific_heat',
      solveFor: /heat energy|thermal energy|q/i
    },
    {
      category,
      name: 'tutor-specific-heat-solving-mass',
      prompt: 'The thermal energy of water in a mug increases by 12,552 J when heated from 20\u00b0C to 40\u00b0C. If c = 4,184 J/kg\u00b0C, what is the mass?',
      includes: [/0\.15\s*kg/i],
      formulaId: 'specific_heat',
      solveFor: /mass/i
    },
    {
      category,
      name: 'tutor-conservation-ke-to-gpe-height',
      prompt: 'Justin kicks a 2.6 kg football straight up with velocity 6 m/s. Assuming all energy is conserved, at what height did it travel?',
      includes: [/1\.8[34]\s*m\b/i],
      formulaId: 'energy_conservation',
      solveFor: /height/i
    }
  ];
}

function tutorWordingCases() {
  const category = 'tutor wording';
  return [
    {
      category,
      name: 'ke-tutor-wording',
      prompt: "A baseball with a mass of 0.15 kg is moving at a speed of 40 m/s. What is the baseball's kinetic energy?",
      minimumKnownValues: 2,
      formulaChoice: /KE\s*=\s*(?:1\/2|0\.5)/i
    },
    {
      category,
      name: 'gpe-tutor-wording',
      prompt: 'A 5 kg apple is sitting on a 1.5 m high tree branch. What is its gravitational potential energy?',
      minimumKnownValues: 3,
      formulaChoice: /PE\s*=\s*m/i
    },
    {
      category,
      name: 'work-tutor-wording',
      prompt: 'A constant force of 2.0 N is used to push a box 4.0 m across the floor. How much work is done?',
      minimumKnownValues: 2,
      formulaChoice: /W\s*=\s*F/i
    },
    {
      category,
      name: 'power-tutor-wording',
      prompt: 'How much power is used if a machine does 28 J of work in 7 seconds?',
      minimumKnownValues: 2,
      formulaChoice: /P\s*=\s*W\s*\/\s*t/i
    },
    {
      category,
      name: 'specific-heat-tutor-wording',
      prompt: 'A piece of zinc was 26\u00b0C and later reached 36\u00b0C. If its mass is 0.15 kg and zinc has a specific heat of 380 J/kg/\u00b0C, find the thermal energy.',
      minimumKnownValues: 3,
      formulaChoice: /q\s*=\s*m/i
    }
  ];
}

function graphDiagramCases() {
  const category = 'graph/diagram wording';
  return [
    {
      category,
      name: 'roller-coaster-greatest-pe',
      prompt: 'Where does a roller coaster have the greatest potential energy?',
      includes: [/highest point|top/i, /potential energy/i]
    },
    {
      category,
      name: 'roller-coaster-top-pe-or-ke',
      prompt: 'At the top of a hill, does a roller coaster have more potential energy or kinetic energy?',
      includes: [/potential energy/i, /more/i],
      excludes: [/kinetic energy is greater/i]
    },
    {
      category,
      name: 'falling-ball-gpe-ke',
      prompt: 'As a ball falls, what happens to GPE and KE?',
      includes: [/GPE|gravitational potential energy/i, /decreases/i, /KE|kinetic energy/i, /increases/i]
    },
    {
      category,
      name: 'sun-to-solar-panel-radiation',
      prompt: 'Which heat transfer happens when energy travels from the Sun to a solar panel?',
      includes: [/radiation/i, /electromagnetic waves|space/i]
    },
    {
      category,
      name: 'liquids-gases-heated-particles-convection',
      prompt: 'Which heat transfer occurs in liquids and gases because heated particles move?',
      includes: [/convection/i, /liquids?|gases/i]
    },
    {
      category,
      name: 'swinging-bat-diagram-safe-clarification',
      prompt: 'Which point on a swinging bat would have the greatest kinetic energy?',
      includes: [/diagram|point|which point|farther from|tip|need/i],
      excludes: [/definitely point A|definitely point B|definitely point C/i]
    }
  ];
}

function answerFormattingCases() {
  const category = 'answer formatting';
  return [
    {
      category,
      name: 'format-ke-joules',
      prompt: "A baseball with a mass of 0.15 kg is moving at a speed of 40 m/s. What is the baseball's kinetic energy?",
      includes: [/120\s*J\b/i],
      units: [/\bJ\b/]
    },
    {
      category,
      name: 'format-mass-kg',
      prompt: 'If a stone has 390 J of energy and is moving with a speed of 12 m/s, what is the mass of the stone?',
      includes: [/5\.4(?:[12]|167)\s*kg/i],
      units: [/\bkg\b/]
    },
    {
      category,
      name: 'format-velocity-ms',
      prompt: 'What is the velocity of a 0.06 kg ball moving with 75 J of energy?',
      includes: [/50\s*m\/s/i],
      units: [/m\/s/]
    },
    {
      category,
      name: 'format-height-m',
      prompt: 'A 20 kg object has 196 J of potential energy. How high is it above the ground?',
      includes: [/1\s*m\b/i],
      units: [/\bm\b/]
    },
    {
      category,
      name: 'format-power-watts',
      prompt: 'How much power is used if a machine does 28 J of work in 7 seconds?',
      includes: [/4\s*(?:W|J\/s)\b/i],
      units: [/\bW\b|J\/s/]
    },
    {
      category,
      name: 'format-time-seconds',
      prompt: 'If a machine is doing 500 J of work with 75 watts of power, how long did it take?',
      includes: [/6\.6(?:[67]|667)\s*(?:s|seconds?)\b/i],
      units: [/\bs\b|seconds?/i]
    },
    {
      category,
      name: 'format-temperature-delta-c',
      prompt: 'A piece of zinc was 26\u00b0C and later reached 36\u00b0C. If its mass is 0.15 kg and zinc has a specific heat of 380 J/kg/\u00b0C, find the thermal energy.',
      includes: [/\u0394T/i, /10\s*\u00b0C/i, /570\s*J\b/i],
      units: [/\u00b0C|degrees? Celsius/i]
    },
    {
      category,
      name: 'format-conservation-not-created-destroyed',
      prompt: 'When a bouncing ball stops, is the energy lost?',
      includes: [/thermal|heat|sound|other forms|converted|transferred/i],
      excludes: [/energy (?:is )?created/i, /energy (?:is )?destroyed/i],
      checkConservationWording: true
    }
  ];
}
