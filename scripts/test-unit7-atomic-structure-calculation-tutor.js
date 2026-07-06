const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const DIRECT_FORMULA_CASES = [
  {
    prompt: 'how many nuetrons in sodium 23',
    includes: [/neutrons = mass number - atomic number/i, /23 - 11/i, /Neutrons = 12/i],
    formulaId: /unit7\.mass_number\.neutrons/i
  },
  {
    prompt: 'neutral atom atomic number 50 how many electrons',
    includes: [/electrons = protons/i, /Electrons = 50/i],
    formulaId: /unit7\.atomic_number\.neutral_electrons/i
  },
  {
    prompt: 'K has mass 39 and 19 protons, how many neutrons?',
    includes: [/39 - 19/i, /Neutrons = 20/i],
    formulaId: /unit7\.mass_number\.neutrons/i
  },
  {
    prompt: 'phosphorus has 15 protons and 16 neutrons, mass number?',
    includes: [/mass number = protons \+ neutrons/i, /15 \+ 16/i, /Mass number = 31/i],
    formulaId: /unit7\.mass_number\.total/i
  },
  {
    prompt: 'carbon has 7 neutrons write isotope',
    includes: [/Mass number = 13/i, /Carbon-13/i, /13C/i],
    formulaId: /unit7\.isotope\.notation/i
  },
  {
    prompt: 'set up a Bohr model for Sodium-23',
    includes: [/protons = 11/i, /neutrons = 23 - 11 = 12/i, /11 electrons/i, /2, 8, 1/i],
    formulaId: /unit7\.bohr_model\.setup/i
  },
  {
    prompt: 'carbon has 6 protons and 7 neutrons, write isotope notation',
    includes: [/Mass number = 13/i, /Carbon-13/i, /13C/i],
    formulaId: /unit7\.isotope\.notation/i
  },
  {
    prompt: 'how many protons if atomic number is 8',
    includes: [/protons = atomic number/i, /Protons = 8/i],
    formulaId: /unit7\.atomic_number\.protons/i
  }
];

const GUIDED_CASES = [
  {
    name: 'neutrons-k-39',
    prompt: 'K has mass 39 and 19 protons, how many neutrons?',
    answers: ['1', '1', '39', '19', '20'],
    final: /20 neutrons/i
  },
  {
    name: 'neutral-electrons-50',
    prompt: 'neutral atom atomic number 50 how many electrons',
    answers: ['1', '1', '50', '50'],
    final: /50 electrons/i
  },
  {
    name: 'carbon-13-notation',
    prompt: 'carbon has 7 neutrons write isotope',
    answers: ['13', '1', '2'],
    final: /Carbon-13 and 13C|Carbon-13 can also be written as 13C/i
  },
  {
    name: 'sodium-23-bohr',
    prompt: 'set up a Bohr model for Sodium-23',
    answers: ['11', '12', '11', '1'],
    final: /Sodium: 11 protons, 12 neutrons, 11 electrons; shells 2-8-1/i
  }
];

async function main() {
  for (const testCase of DIRECT_FORMULA_CASES) {
    const route = routeStudentQuestion(testCase.prompt);
    assert.equal(route.type, 'science_formula', `${testCase.prompt} should route as a science formula`);
    assert.match(route.formulaWork?.formulaId || '', testCase.formulaId, `${testCase.prompt} formula id`);
    assert.ok(Array.isArray(route.formulaWork?.steps) && route.formulaWork.steps.length > 0, `${testCase.prompt} should expose tutor steps`);
    for (const pattern of testCase.includes) {
      assert.match(route.directAnswer, pattern, `${testCase.prompt} should include ${pattern}`);
    }
  }

  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of GUIDED_CASES) {
    const studentHubId = `unit7-calc-${testCase.name}`;
    const start = await request('POST', '/api/student/message', {
      sessionId,
      studentHubId,
      message: testCase.prompt
    });
    assert.equal(start.statusCode, 200);
    assert.equal(start.body.routeType, 'formula_tutor', `${testCase.prompt} should start Formula Tutor`);
    assert.notEqual(start.body.routeType, 'concept_tutor');
    assert.ok(start.body.tutor?.formulaId, `${testCase.prompt} should include formula tutor metadata`);

    let current = start;
    for (const answer of testCase.answers) {
      current = await request('POST', '/api/student/message', {
        sessionId,
        studentHubId,
        message: answer
      });
      assert.equal(current.statusCode, 200);
      assert.equal(current.body.routeType, 'formula_tutor');
    }
    assert.equal(current.body.tutor?.completed, true, `${testCase.prompt} should complete after guided answers`);
    assert.match(current.body.response, testCase.final);
  }

  console.log(`PASS Unit 7 Atomic Structure calculation tutor: ${DIRECT_FORMULA_CASES.length} formula routes and ${GUIDED_CASES.length} guided completions`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
