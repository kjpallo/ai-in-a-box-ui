const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const OWNER = 'unit1_scientific_method_knowledge';
const EXPLICIT_VARIABLES_FACT = 'unit1.scenario.explicit_changed_measured_variables';
const CONTROL_USEFULNESS_FACT = 'unit1.scientific_method.control_group_usefulness';

const VARIABLE_CASES = [
  {
    name: 'amount-of-fertilizer-original',
    prompt: 'A student changes the amount of fertilizer given to bean plants and records their growth after two weeks. Identify the independent and dependent variables.',
    includes: [
      /independent variable is the amount of fertilizer/i,
      /dependent variable is the bean plants' growth after two weeks/i
    ]
  },
  {
    name: 'amount-of-fertilizer-wording-variation',
    prompt: 'A class gives identical plants different amounts of fertilizer and measures their height. Identify the independent and dependent variables.',
    includes: [
      /independent variable is the amount of fertilizer/i,
      /dependent variable is the plants' height/i
    ]
  },
  {
    name: 'type-of-fertilizer-remains-distinct',
    prompt: 'A student changes the type of fertilizer and measures plant height. Identify the independent and dependent variables.',
    tutorChoices: ['1', '2'],
    includes: [
      /independent variable is the type of fertilizer/i,
      /dependent variable is plant height|dependent variable is plant height or growth/i
    ],
    excludes: [/independent variable is the amount of fertilizer/i]
  },
  {
    name: 'different-explicit-experiment',
    prompt: 'A class changes the soil moisture and measures seed germination. Identify the independent and dependent variables.',
    includes: [
      /independent variable is soil moisture/i,
      /dependent variable is seed germination/i
    ],
    excludes: [/fertilizer/i]
  },
  {
    name: 'meaningful-outcome-with-data',
    prompt: 'A student changes the amount of fertilizer and records plant-growth data. Identify the independent and dependent variables.',
    includes: [
      /independent variable is the amount of fertilizer/i,
      /dependent variable is plant growth data/i
    ]
  },
  {
    name: 'constants-are-not-mislabeled',
    prompt: 'A student changes the amount of fertilizer and measures plant growth while keeping plant type, watering schedule, and observation period the same. Identify the independent and dependent variables.',
    includes: [
      /independent variable is the amount of fertilizer/i,
      /dependent variable is plant growth/i
    ],
    excludes: [
      /independent variable is (?:the )?(?:plant type|watering schedule|observation period)/i,
      /dependent variable is (?:the )?(?:plant type|watering schedule|observation period)/i
    ]
  }
];

const VAGUE_OUTCOME_CASES = [
  {
    name: 'generic-data-is-not-a-dependent-variable',
    prompt: 'A student changes the amount of fertilizer and records data. Identify the independent and dependent variables.',
    excludes: [/dependent variable is (?:the )?data\b/i]
  },
  {
    name: 'generic-results-are-not-a-dependent-variable',
    prompt: 'A student changes the temperature and records results. Identify the independent and dependent variables.',
    excludes: [/dependent variable is (?:the )?results\b/i]
  }
];

const CONTROL_GROUP_CASES = [
  {
    name: 'control-group-usefulness-original',
    prompt: 'Why is a control group useful in an experiment?',
    factId: CONTROL_USEFULNESS_FACT,
    includes: [/baseline for comparison/i, /normal or unchanged conditions/i, /independent variable caused the observed result/i]
  },
  {
    name: 'control-group-purpose-variation',
    prompt: 'What is the purpose of a control group?',
    factId: CONTROL_USEFULNESS_FACT,
    includes: [/baseline for comparison/i, /tested group/i, /independent variable caused the observed result/i]
  },
  {
    name: 'control-group-simple-definition',
    prompt: 'What is a control group?',
    factId: 'unit1.scientific_method.control_group',
    includes: [/normal or comparison group/i, /does not receive the tested change/i],
    excludes: [/independent variable caused the observed result/i]
  },
  {
    name: 'control-group-baseline-comparison-variation',
    prompt: 'How does a control group provide a baseline for comparison?',
    factId: CONTROL_USEFULNESS_FACT,
    includes: [/baseline for comparison/i, /normal or unchanged conditions/i, /independent variable caused the observed result/i]
  }
];

async function main() {
  const { request, questionAnswer } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);

  for (const testCase of VARIABLE_CASES) {
    const questionRoute = assertOwnedRoute(questionAnswer, testCase.prompt, EXPLICIT_VARIABLES_FACT, testCase.name);
    assertAnswer(questionRoute.directAnswer, testCase);
    let response = await ask(request, create.body.sessionId, testCase);
    if (testCase.tutorChoices) {
      assert.equal(response.routeType, 'concept_tutor', `${testCase.name} should preserve the existing variables tutor`);
      assert.equal(response.tutor?.id, 'unit1.scientific_method.variables.identification', `${testCase.name} tutor ownership`);
      for (const choice of testCase.tutorChoices) {
        response = await askMessage(request, create.body.sessionId, testCase.name, choice);
      }
      assert.equal(response.tutor?.completed, true, `${testCase.name} tutor completion`);
    } else {
      assert.equal(response.routeType, 'definition', `${testCase.name} should remain a direct Unit 1 answer`);
    }
    assertAnswer(response.response, {
      ...testCase,
      includes: testCase.responseIncludes || testCase.includes
    });
  }

  for (const testCase of VAGUE_OUTCOME_CASES) {
    const { questionRoute } = questionAnswer.routeMessage(testCase.prompt);
    assert.doesNotMatch(questionRoute.notes, new RegExp(escapeRegExp(EXPLICIT_VARIABLES_FACT)), `${testCase.name} should use the existing fallback route`);
    const response = await ask(request, create.body.sessionId, testCase);
    assertAnswer(response.response, testCase);
  }

  for (const testCase of CONTROL_GROUP_CASES) {
    assertOwnedRoute(questionAnswer, testCase.prompt, testCase.factId, testCase.name);
    const response = await ask(request, create.body.sessionId, testCase);
    assert.match(response.routeType, /definition|science_concept/i, `${testCase.name} direct route type`);
    assertAnswer(response.response, testCase);
  }

  console.log('PASS focused Unit 1 scientific method regressions: fertilizer variables and control-group usefulness');
}

function assertOwnedRoute(questionAnswer, prompt, factId, name) {
  const { questionRoute } = questionAnswer.routeMessage(prompt);
  assert.equal(questionRoute.confidence, 'strong', `${name} route confidence`);
  assert.equal(questionRoute.aiAllowed, false, `${name} should not use fallback`);
  assert.deepEqual(questionRoute.toolsUsed, [OWNER], `${name} owning tool`);
  assert.match(questionRoute.notes, new RegExp(escapeRegExp(factId)), `${name} matched fact`);
  return questionRoute;
}

async function ask(request, sessionId, testCase) {
  return askMessage(request, sessionId, testCase.name, testCase.prompt);
}

async function askMessage(request, sessionId, name, message) {
  const response = await request('POST', '/api/student/message', {
    sessionId,
    studentHubId: `unit1-focused-${name}`,
    message
  });
  assert.equal(response.statusCode, 200, `${name} HTTP status`);
  return response.body;
}

function assertAnswer(answer, testCase) {
  const text = String(answer || '');
  assert.ok(text.trim(), `${testCase.name} should return an answer`);
  for (const expected of testCase.includes || []) {
    assert.match(text, expected, `${testCase.name} should include ${expected} but got:\n${text}`);
  }
  for (const unexpected of testCase.excludes || []) {
    assert.doesNotMatch(text, unexpected, `${testCase.name} should exclude ${unexpected} but got:\n${text}`);
  }
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
