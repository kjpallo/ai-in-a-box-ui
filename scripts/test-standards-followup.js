const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { resolvePendingClarification } = require('../lib/router/pendingClarification');
const { createQuestionAnswerService } = require('../lib/server/questionAnswerService');
const { registerQuestionRoutes } = require('../routes/questionRoutes');
const { loadMissouriStandardsBank } = require('../lib/standards/standardsMatcher');
const {
  NO_CONTEXT_MESSAGE,
  NO_STRONG_MATCH_MESSAGE,
  answerStandardsFollowUp,
  formatStandardsAnswer,
  getWhyThisMattersForStandard,
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

runStandardsClarificationTests();
runWhyThisMattersTests();
runRequestPathTests()
  .then(() => {
    console.log(`Standards follow-up tests passed (${cases.length + 31} checks)`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

function runStandardsClarificationTests() {
  const multiStandardMatcher = () => ({
    confidence: 'medium',
    standards: [],
    possibleStandards: [
      { standardId: '9-12.PS2.A.1', unit: 'Forces and Motion', label: 'Forces and Motion' },
      { standardId: '9-12.PS3.A.1', unit: 'Energy', label: 'Energy' },
      { standardId: '9-12.PS4.A.1', unit: 'Waves', label: 'Waves' }
    ]
  });

  const clarification = answerStandardsFollowUp(
    'What standard is this over?',
    'We are learning about forces, energy, and motion.',
    { matcher: multiStandardMatcher }
  );

  assert.equal(clarification.handled, true, 'multiple-standard follow-up should be handled');
  assert.equal(clarification.reason, 'multiple_standard_matches');
  assert.ok(clarification.response.includes('This could match more than one standard.'));
  assert.ok(clarification.response.includes('1. Forces and motion — how force, mass, and acceleration explain why objects speed up or slow down'));
  assert.ok(clarification.response.includes('2. Kinetic and potential energy — how motion and position store or change energy'));
  assert.ok(clarification.response.includes('3. Wave properties — how frequency, wavelength, and speed describe waves like sound and light'));
  assert.ok(!clarification.response.includes('9-12.PS2.A.1'), 'clarification choices should not lead with standard codes');
  assert.ok(clarification.response.includes('Type 1, 2, or 3.'));
  assert.equal(clarification.pendingClarification.id, 'standards_followup');
  assert.equal(clarification.pendingClarification.choices.length, 3);
  assert.equal(
    clarification.pendingClarification.choices[0].standardId,
    '9-12.PS2.A.1',
    'force and motion context should rank Forces and Motion first'
  );

  const firstChoice = resolvePendingClarification('1', clarification.pendingClarification);
  assert.equal(firstChoice.handled, true);
  assert.equal(firstChoice.pendingClarification, null, 'valid standards choice should clear pending clarification');
  assert.equal(firstChoice.questionRoute.type, 'standards_followup');
  assert.ok(firstChoice.questionRoute.directAnswer.includes('Standard code:\n9-12.PS2.A.1'));
  assert.ok(firstChoice.questionRoute.directAnswer.includes('car crashes, seatbelts, sports, ramps'));
  assert.ok(!firstChoice.questionRoute.directAnswer.includes('9-12.PS3.A.1'));
  assert.ok(!firstChoice.questionRoute.directAnswer.includes('This could match more than one standard.'));

  const secondChoice = resolvePendingClarification('2', clarification.pendingClarification);
  assert.equal(secondChoice.handled, true);
  assert.equal(secondChoice.pendingClarification, null);
  assert.ok(secondChoice.questionRoute.directAnswer.includes('Standard code:\n9-12.PS3.A.1'));
  assert.ok(!secondChoice.questionRoute.directAnswer.includes('9-12.PS2.A.1'));

  const invalidChoice = resolvePendingClarification('4', clarification.pendingClarification);
  assert.equal(invalidChoice.handled, true);
  assert.equal(invalidChoice.pendingClarification, clarification.pendingClarification);
  assert.equal(
    invalidChoice.questionRoute.directAnswer,
    'Please type one of the choices listed, like 1, 2, or 3.'
  );

  const normalQuestion = resolvePendingClarification('What is the formula for force?', clarification.pendingClarification);
  assert.equal(normalQuestion, null, 'normal new question should route normally instead of resolving old standards choices');
  const normalRoute = routeStudentQuestion('What is the formula for force?', []);
  assert.equal(normalRoute.type, 'formula_only');
  assert.ok(normalRoute.directAnswer.includes('F = m × a.'));

  const standaloneNumberRoute = routeStudentQuestion('2', []);
  assert.ok(
    !String(standaloneNumberRoute.directAnswer || '').includes('Standard code:'),
    'standalone number without pending standards clarification should not return a standards answer'
  );

  assertClarificationLabels(
    'energy standards should use student-friendly subtopics',
    [
      { standardId: '9-12.PS3.C.1', unit: 'Relationship Between Energy and Forces' },
      { standardId: '9-12.PS3.B.1', unit: 'Conservation of Energy and Energy Transfer' },
      { standardId: '9-12.PS3.A.1', unit: 'Definitions of Energy' }
    ],
    'How are force, energy transfer, kinetic energy, and potential energy connected?',
    [
      'Energy and forces — how energy changes when objects push, pull, attract, or repel each other',
      'Energy transfer — how energy moves from one object or system to another',
      'Kinetic and potential energy — how motion and position store or change energy'
    ]
  );

  assertClarificationLabels(
    'forces and motion standards should use student-friendly subtopics',
    [
      { standardId: '9-12.PS2.A.1', unit: 'Forces and Motion' },
      { standardId: '9-12.PS2.A.2', unit: 'Forces and Motion' }
    ],
    'How do force, acceleration, momentum, and collisions work?',
    [
      'Forces and motion — how force, mass, and acceleration explain why objects speed up or slow down',
      'Momentum — how moving objects transfer motion during collisions or impacts'
    ]
  );

  assertClarificationLabels(
    'waves standards should use student-friendly subtopics',
    [
      { standardId: '9-12.PS4.A.1', unit: 'Wave Properties' },
      { standardId: '9-12.PS4.B.1', unit: 'Electromagnetic Radiation' }
    ],
    'How do frequency, wavelength, light, sound, and electromagnetic waves work?',
    [
      'Wave properties — how frequency, wavelength, and speed describe waves like sound and light',
      'Electromagnetic radiation — how light, radio waves, phones, Wi-Fi, and medical imaging use waves'
    ]
  );

  assertClarificationLabels(
    'matter and chemistry standards should use student-friendly subtopics',
    [
      { standardId: '9-12.PS1.A.1', unit: 'Structure and Properties of Matter' },
      { standardId: '9-12.PS1.B.3', unit: 'Chemical Reactions' }
    ],
    'How do periodic table patterns, electron patterns, balanced equations, and reactions work?',
    [
      'Atoms and the periodic table — how electron patterns help predict how elements behave',
      'Conservation of matter — how balanced equations show atoms are not lost during reactions'
    ]
  );

  assertOptionalClarificationLabels(
    'life science standards should use student-friendly subtopics',
    [
      { standardId: '9-12.LS1.C.1', unit: 'Organization for Matter and Energy Flow in Organisms' },
      { standardId: '9-12.LS3.A.1', unit: 'Inheritance of Traits' }
    ],
    'How do photosynthesis and genetics work in living things?',
    [
      'Photosynthesis — how plants turn light into stored chemical energy',
      'Genetics — how living things pass traits from parents to offspring'
    ]
  );

  assertOptionalClarificationLabels(
    'earth and space standards should use student-friendly subtopics',
    [
      { standardId: '9-12.ESS1.B.1', unit: 'Earth and the Solar System' },
      { standardId: '9-12.ESS2.D.1', unit: 'Weather and Climate' }
    ],
    'How do satellites, orbits, weather, and climate work?',
    [
      'Gravity and space — how gravity helps explain orbits, moons, planets, and satellites',
      'Weather and climate — how storms, climate patterns, air, and water affect daily life'
    ]
  );

  assertOptionalClarificationLabels(
    'engineering standards should use student-friendly subtopics',
    [
      { standardId: '9-12.ETS1.A.1', unit: 'Defining and Delimiting Engineering Problems' },
      { standardId: '9-12.ETS1.B.1', unit: 'Developing Possible Solutions' }
    ],
    'How do engineers define problems, test solutions, and compare trade-offs?',
    [
      'Engineering design — how people define problems, test ideas, and improve real solutions',
      'Testing solutions — how people compare designs using evidence, trade-offs, cost, safety, and reliability'
    ]
  );
}

function assertClarificationLabels(name, possibleStandards, previousQuestion, expectedLines) {
  const result = answerStandardsFollowUp(
    'What standard is this over?',
    previousQuestion,
    {
      matcher: () => ({
        confidence: 'medium',
        standards: [],
        possibleStandards
      })
    }
  );

  assert.equal(result.handled, true, `${name} should be handled`);
  assert.equal(result.reason, 'multiple_standard_matches', `${name} should ask a clarification`);
  for (const expectedLine of expectedLines) {
    const numberedChoicePattern = new RegExp(`\\n\\d+\\. ${escapeRegExp(expectedLine)}(?:\\n|$)`);
    assert.ok(
      numberedChoicePattern.test(`\n${result.response}\n`),
      `${name} expected a numbered choice "${expectedLine}" but got:\n${result.response}`
    );
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertOptionalClarificationLabels(name, possibleStandards, previousQuestion, expectedLines) {
  const bank = loadMissouriStandardsBank();
  const availableIds = new Set(bank.standards.map((standard) => standard.standardId));
  if (!possibleStandards.every((standard) => availableIds.has(standard.standardId))) return;

  assertClarificationLabels(name, possibleStandards, previousQuestion, expectedLines);
}

function runWhyThisMattersTests() {
  const categoryCases = [
    {
      name: 'forces',
      standard: { standardId: '9-12.PS2.A.1', conceptTitle: 'Forces and Motion' },
      expected: 'car crashes, seatbelts, sports, ramps'
    },
    {
      name: 'energy',
      standard: { standardId: '9-12.PS3.A.1', conceptTitle: 'Definitions of Energy' },
      expected: 'machines need fuel or electricity'
    },
    {
      name: 'waves',
      standard: { standardId: '9-12.PS4.A.1', conceptTitle: 'Wave Properties' },
      expected: 'phones, Wi-Fi, Bluetooth'
    },
    {
      name: 'matter and chemistry',
      standard: { standardId: '9-12.PS1.A.1', conceptTitle: 'Structure and Properties of Matter' },
      expected: 'metals conduct electricity'
    }
  ];

  for (const testCase of categoryCases) {
    const why = getWhyThisMattersForStandard(testCase.standard);
    assert.ok(
      why.includes(testCase.expected),
      `${testCase.name} standard should use practical why-this-matters wording, got:\n${why}`
    );

    const answer = formatStandardsAnswer(testCase.standard);
    assert.ok(
      answer.includes(testCase.expected),
      `${testCase.name} standards answer should include practical why-this-matters wording`
    );
    assert.ok(
      !answer.includes('science skill your class is practicing'),
      `${testCase.name} answer should not use generic school-speak wording`
    );
  }

  const fallback = getWhyThisMattersForStandard({
    standardId: 'LOCAL.UNKNOWN.1',
    conceptTitle: 'Careful Observations'
  });
  assert.ok(fallback.includes('real situations'), 'generic fallback should still exist');
}

async function runRequestPathTests() {
  await runStudentSessionPathTests();
  await runPowerClarificationPathTests();
  await runChatRoutePathTests();
}

async function runStudentSessionPathTests() {
  const service = createQuestionAnswerService({
    teacherFactsFile: '',
    maxKnowledgeItems: 0,
    loadTeacherKnowledge: () => [],
    findRelevantKnowledge: () => [],
    routeStudentQuestion,
    ollama: {
      buildTeacherPrompt: () => '',
      stream: async ({ onText }) => {
        onText('Force can change motion, and energy is the ability to cause changes. ');
        onText('Kinetic energy is energy of motion, so force, energy, and motion are connected.');
      }
    },
    logProblem: () => {},
    logStudentInteraction: () => {},
    initialTeacherKnowledge: []
  });

  const followUp = await service.answerStudentMessage('what standard is this over', {
    lastAnsweredPrompt: 'how are force and energy related to motion',
    pendingClarification: null
  });

  assert.equal(followUp.routeType, 'standards_followup');
  assert.notEqual(followUp.response, NO_STRONG_MATCH_MESSAGE);
  assert.ok(followUp.pendingClarification, 'session path should create standards clarification');
  assert.ok(followUp.response.includes('This could match more than one standard.'));
  assert.ok(followUp.response.includes('Type 1, 2, or 3.'));

  const selected = await service.answerStudentMessage('1', {
    lastAnsweredPrompt: 'how are force and energy related to motion',
    pendingClarification: followUp.pendingClarification
  });

  assert.equal(selected.pendingClarification, null);
  assert.ok(selected.response.includes('Standard code:'), 'selected standards clarification should resolve to a standard answer');
  assert.ok(
    !selected.response.includes('science skill your class is practicing'),
    'selected standards clarification should use practical why-this-matters wording'
  );
}

async function runPowerClarificationPathTests() {
  const service = createQuestionAnswerService({
    teacherFactsFile: '',
    maxKnowledgeItems: 0,
    loadTeacherKnowledge: () => [],
    findRelevantKnowledge: () => [],
    routeStudentQuestion,
    ollama: {
      buildTeacherPrompt: () => '',
      stream: async ({ onText }) => {
        onText('Power can mean work divided by time or electrical power, depending on the problem.');
      }
    },
    logProblem: () => {},
    logStudentInteraction: () => {},
    initialTeacherKnowledge: []
  });

  const followUp = await service.answerStudentMessage('how do I solve for power', {
    lastAnsweredPrompt: '',
    pendingClarification: null
  });

  assert.ok(followUp.pendingClarification, 'power question should still ask a clarification');

  const selected = await service.answerStudentMessage('2', {
    lastAnsweredPrompt: '',
    pendingClarification: followUp.pendingClarification
  });

  assert.equal(selected.pendingClarification, null, 'power clarification choice should clear pending clarification');
  assert.ok(
    selected.response.includes('P = V × I') || selected.response.includes('electrical power'),
    'power clarification choice 2 should still resolve to electrical power'
  );
}

async function runChatRoutePathTests() {
  const app = createFakeApp();
  const tts = createFakeTts();
  const questionAnswer = createQuestionAnswerService({
    teacherFactsFile: '',
    maxKnowledgeItems: 0,
    loadTeacherKnowledge: () => [],
    findRelevantKnowledge: () => [],
    routeStudentQuestion,
    ollama: {
      buildTeacherPrompt: () => '',
      stream: async ({ onText }) => {
        onText('Force can change motion, and kinetic energy is energy of motion.');
      }
    },
    logProblem: () => {},
    logStudentInteraction: () => {},
    initialTeacherKnowledge: []
  });

  registerQuestionRoutes(app, {
    ollama: {
      buildTeacherPrompt: () => '',
      extractCompletedSentences: () => ({ complete: [], remaining: '' }),
      stream: async ({ onText }) => {
        onText('Force can change motion, and kinetic energy is energy of motion.');
      }
    },
    questionAnswer,
    tts
  });

  await app.handlers.post['/api/chat'](
    createFakeRequest({ message: 'how are force and energy related to motion' }),
    createFakeResponse()
  );

  const followUpResponse = createFakeResponse();
  await app.handlers.post['/api/chat'](
    createFakeRequest({ message: 'what standard is this over' }),
    followUpResponse
  );

  const events = followUpResponse.events();
  const text = events
    .filter((event) => event.type === 'text_delta')
    .map((event) => event.chunk)
    .join('');

  assert.ok(text.includes('This could match more than one standard.'), 'chat route should ask standards clarification');
  assert.ok(text.includes('Type 1, 2, or 3.'));
  assert.ok(!text.includes(NO_STRONG_MATCH_MESSAGE), 'chat route should not return the no-match standard message');

  const selectedResponse = createFakeResponse();
  await app.handlers.post['/api/chat'](
    createFakeRequest({ message: '1' }),
    selectedResponse
  );

  const selectedText = selectedResponse.events()
    .filter((event) => event.type === 'text_delta')
    .map((event) => event.chunk)
    .join('');

  assert.ok(selectedText.includes('Standard code:'), 'chat route numbered standards choice should resolve');
  assert.ok(!selectedText.includes('This could match more than one standard.'));
}

function createFakeApp() {
  return {
    handlers: {
      get: {},
      post: {}
    },
    get(path, handler) {
      this.handlers.get[path] = handler;
    },
    post(path, handler) {
      this.handlers.post[path] = handler;
    }
  };
}

function createFakeRequest(body) {
  const req = new EventEmitter();
  req.body = body;
  return req;
}

function createFakeResponse() {
  const chunks = [];
  const res = new EventEmitter();

  Object.assign(res, {
    writableEnded: false,
    setHeader() {},
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonPayload = payload;
      this.writableEnded = true;
      return this;
    },
    write(chunk) {
      chunks.push(String(chunk || ''));
    },
    end() {
      this.writableEnded = true;
    },
    events() {
      return chunks
        .join('')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    }
  });

  return res;
}

function createFakeTts() {
  return {
    getEffectiveTtsBackend: () => 'none',
    getEffectiveAudioMode: () => 'none',
    canStreamAudio: () => false,
    streamSentenceAudio: async () => {}
  };
}
