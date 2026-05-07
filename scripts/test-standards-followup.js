const assert = require('node:assert/strict');
const {
  NO_CONTEXT_MESSAGE,
  NO_STRONG_MATCH_MESSAGE,
  answerStandardsFollowUp,
  isStandardsFollowUp
} = require('../lib/standards/standardsFollowUp');

const cases = [
  {
    name: 'formula question followed by standard prompt',
    priorQuestion: 'If wavelength is 2 m and frequency is 3 Hz, what is wave speed?',
    followUp: 'What standard is this?',
    includes: [
      'I can statement:',
      'I can use math models',
      'Standard code:',
      '9-12.PS4.A.1',
      'Short summary:',
      'Why this matters:',
      'Want the full standard? Ask: "Read the full standard."'
    ]
  },
  {
    name: 'force mass acceleration follow-up',
    priorQuestion: 'What is the force if mass is 10 kg and acceleration is 2 m/s^2?',
    followUp: 'What standard does that belong to?',
    includes: [
      'I can statement:',
      'Standard code:',
      '9-12.PS2.A.1',
      "Newton's second law connects net force, mass, and acceleration."
    ]
  },
  {
    name: 'learning target phrasing',
    priorQuestion: 'If wavelength is 2 m and frequency is 3 Hz, what is wave speed?',
    followUp: 'What is the I can statement?',
    includes: [
      'I can statement:',
      '9-12.PS4.A.1',
      'Why this matters:'
    ]
  },
  {
    name: 'standered misspelling after force question',
    priorQuestion: 'What is the force if mass is 10 kg and acceleration is 2 m/s^2?',
    followUp: 'what standered is that',
    includes: [
      'I can statement:',
      'Standard code:',
      '9-12.PS2.A.1'
    ]
  },
  {
    name: 'what is this over after wave speed question',
    priorQuestion: 'If wavelength is 2 m and frequency is 3 Hz, what is wave speed?',
    followUp: 'what is this over',
    includes: [
      'I can statement:',
      'Standard code:',
      '9-12.PS4.A.1'
    ]
  }
];

for (const testCase of cases) {
  assert.equal(isStandardsFollowUp(testCase.followUp), true, `${testCase.name} should be detected`);
  const result = answerStandardsFollowUp(testCase.followUp, testCase.priorQuestion);

  assert.equal(result.handled, true, `${testCase.name} should be handled`);
  assert.equal(result.matched, true, `${testCase.name} should find a strong standard`);
  for (const expected of testCase.includes) {
    assert.ok(
      result.response.includes(expected),
      `${testCase.name} expected response to include "${expected}" but got:\n${result.response}`
    );
  }
}

const noContext = answerStandardsFollowUp('What standard is this?', '');
assert.equal(noContext.response, NO_CONTEXT_MESSAGE, 'follow-up before a prior answer should explain missing context');

const noStrongMatch = answerStandardsFollowUp('What standard is this?', 'What is mass?');
assert.equal(
  noStrongMatch.response,
  NO_STRONG_MATCH_MESSAGE,
  'vague prior question should not guess a standard'
);

assert.equal(
  answerStandardsFollowUp('What is photosynthesis?', 'What is mass?'),
  null,
  'normal questions should not be handled as standards follow-ups'
);

console.log(`Standards follow-up tests passed (${cases.length + 3} checks)`);
