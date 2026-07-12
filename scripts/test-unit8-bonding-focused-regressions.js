const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const E2E_CASES = [
  {
    name: 'symbolic magnesium and oxygen bond',
    prompt: 'What bond forms between Mg and O, and why?',
    routeType: 'definition',
    tool: /unit8_bonding_knowledge/i,
    includes: [/ionic bond/i, /magnesium loses two electrons/i, /Mg2\+/i, /oxygen gains two electrons/i, /O2-/i, /oppositely charged ions attract/i]
  },
  {
    name: 'mixed magnesium name and oxygen symbol',
    prompt: 'What ionic bond forms between magnesium and O?',
    routeType: 'definition',
    tool: /unit8_bonding_knowledge/i,
    includes: [/ionic bond/i, /magnesium loses two electrons/i, /Mg2\+/i, /oxygen gains two electrons/i, /O2-/i, /oppositely charged ions attract/i]
  },
  {
    name: 'ion-size why question is not a bonding request',
    prompt: 'Why are magnesium and oxygen ions different sizes?',
    routeType: 'definition',
    tool: /unit8_bonding_knowledge/i,
    includes: [/ions form when atoms gain or lose electrons/i],
    excludes: [/magnesium and oxygen form an ionic bond/i, /magnesium loses two electrons/i, /oppositely charged ions attract/i]
  },
  {
    name: 'water dot structure wording',
    prompt: 'Show the dot structure of water.',
    routeType: 'definition',
    tool: /unit8_bonding_knowledge/i,
    includes: [/oxygen is the central atom/i, /two single O-H bonds/i, /oxygen has two lone pairs/i]
  },
  {
    name: 'H2O drawing wording',
    prompt: 'Draw the structure of H2O.',
    routeType: 'definition',
    tool: /unit8_bonding_knowledge/i,
    includes: [/oxygen is the central atom/i, /two single O-H bonds/i, /oxygen has two lone pairs/i]
  },
  {
    name: 'plain H2O lookup remains on the compound route',
    prompt: 'What is H2O?',
    routeType: 'chemistry_formula',
    tool: /chemistry_compounds/i,
    forbiddenTool: /unit8_bonding_knowledge/i,
    includes: [/H2O is water/i, /covalent compound/i],
    excludes: [/oxygen is the central atom/i, /two single O-H bonds/i, /two lone pairs/i]
  },
  {
    name: 'oxygen self-bond wording',
    prompt: 'How does oxygen bond with itself?',
    routeType: 'definition',
    tool: /unit8_bonding_knowledge/i,
    includes: [/O2 forms a covalent double bond/i, /sharing 4 electrons/i]
  },
  {
    name: 'original magnesium and oxygen prompt',
    prompt: 'What bond forms between magnesium and oxygen, and why?',
    routeType: 'definition',
    tool: /unit8_bonding_knowledge/i,
    includes: [/ionic bond/i, /magnesium loses two electrons/i, /Mg2\+/i, /oxygen gains two electrons/i, /O2-/i, /oppositely charged ions attract/i]
  },
  {
    name: 'original magnesium and oxygen why prompt',
    prompt: 'Why do magnesium and oxygen form an ionic bond?',
    routeType: 'definition',
    tool: /unit8_bonding_knowledge/i,
    includes: [/ionic bond/i, /magnesium loses two electrons/i, /oxygen gains two electrons/i, /oppositely charged ions attract/i]
  },
  {
    name: 'original water Lewis prompt',
    prompt: 'Describe the Lewis dot structure of a water molecule, H2O.',
    routeType: 'definition',
    tool: /unit8_bonding_knowledge/i,
    includes: [/oxygen is the central atom/i, /two single O-H bonds/i, /oxygen has two lone pairs/i]
  },
  {
    name: 'original O2 prompt',
    prompt: 'What kind of bond joins the two oxygen atoms in O2?',
    routeType: 'definition',
    tool: /unit8_bonding_knowledge/i,
    includes: [/O2 forms a covalent double bond/i, /sharing 4 electrons/i]
  },
  {
    name: 'molecular total valence remains unsupported',
    prompt: 'How many total valence electrons are in H2O?',
    routeType: 'no_match',
    tool: /unit7_atomic_structure_knowledge/i,
    forbiddenTool: /unit8_bonding_knowledge/i,
    includes: [/do not have a trusted local science fact/i],
    excludes: [/oxygen is the central atom/i, /two single O-H bonds/i, /H2O has/i]
  }
];

async function main() {
  assertRoutingBoundaries();

  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);

  for (const [index, testCase] of E2E_CASES.entries()) {
    const response = await request('POST', '/api/student/message', {
      sessionId: create.body.sessionId,
      studentHubId: `unit8-focused-${index}`,
      message: testCase.prompt
    });
    assert.equal(response.statusCode, 200, testCase.name);
    assert.equal(response.body.routeType, testCase.routeType, `${testCase.name} route type`);
    for (const pattern of testCase.includes) {
      assert.match(response.body.response, pattern, `${testCase.name} should include ${pattern}`);
    }
    for (const pattern of testCase.excludes || []) {
      assert.doesNotMatch(response.body.response, pattern, `${testCase.name} should not include ${pattern}`);
    }
  }

  console.log(`PASS focused Unit 8 Bonding regressions: ${E2E_CASES.length} end-to-end prompts with route and answer boundaries`);
}

function assertRoutingBoundaries() {
  for (const testCase of E2E_CASES) {
    const route = routeStudentQuestion(testCase.prompt);
    const tools = route.public?.toolsUsed?.join(' ') || route.toolsUsed?.join(' ') || '';
    assert.equal(route.type, testCase.routeType, `${testCase.name} direct route type`);
    assert.match(tools, testCase.tool, `${testCase.name} should use ${testCase.tool}`);
    if (testCase.forbiddenTool) {
      assert.doesNotMatch(tools, testCase.forbiddenTool, `${testCase.name} should not use ${testCase.forbiddenTool}`);
    }
    for (const pattern of testCase.includes) {
      assert.match(route.directAnswer, pattern, `${testCase.name} direct answer should include ${pattern}`);
    }
    for (const pattern of testCase.excludes || []) {
      assert.doesNotMatch(route.directAnswer, pattern, `${testCase.name} direct answer should not include ${pattern}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
