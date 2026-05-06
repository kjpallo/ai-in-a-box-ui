const assert = require('node:assert/strict');
const { buildStandardsSummaryReport } = require('../lib/system/standardsSummaryReport');

const leakedAnswerText = 'THIS_FULL_ANSWER_SHOULD_NOT_LEAK';
const entries = [
  {
    timestamp: '2026-05-01T10:00:00.000Z',
    studentQuestion: 'What is density?',
    routeType: 'formula',
    answerGiven: leakedAnswerText,
    sessionId: 'student-session-1',
    debug: { route: { type: 'formula' } },
    matchedConcepts: [
      { id: 'density-formula', title: 'Density', type: 'formula', unit: 'Matter', score: 15 }
    ],
    primaryStandards: [],
    standards: [],
    possibleStandards: [
      { standardId: '9-12.PS1.A.3', unit: 'Matter', label: 'Structure and properties of matter.' }
    ],
    units: ['Matter'],
    conceptConfidence: 'medium',
    standardsConfidence: 'none',
    possibleStandardsConfidence: 'medium',
    courseProfileId: 'physical_science',
    standardsBankId: 'missouri_science_6_12'
  },
  {
    timestamp: '2026-05-01T10:03:00.000Z',
    studentQuestion: 'What is Newton\'s second law?',
    routeType: 'knowledge',
    response: leakedAnswerText,
    matchedConcepts: [],
    primaryStandards: [
      { standardId: '9-12.PS2.A.1', unit: 'Forces and Motion', label: 'Forces and motion.' }
    ],
    standards: [
      { standardId: '9-12.PS2.A.1', unit: 'Forces and Motion', label: 'Forces and motion.' }
    ],
    possibleStandards: [
      { standardId: '9-12.PS3.B.1', unit: 'Energy', label: 'Energy transfer.' }
    ],
    units: ['Forces and Motion'],
    conceptConfidence: 'none',
    standardsConfidence: 'strong',
    possibleStandardsConfidence: 'medium',
    courseProfileId: 'physical_science',
    standardsBankId: 'missouri_science_6_12'
  },
  {
    timestamp: '2026-05-01T10:05:00.000Z',
    studentQuestion: 'How does an electric current make a magnetic field?',
    routeType: 'knowledge',
    matchedConcepts: [],
    primaryStandards: [
      { standardId: '9-12.PS2.B.2', unit: 'Types of Interactions', label: 'Electric and magnetic fields.' }
    ],
    standards: [
      { standardId: '9-12.PS2.B.2', unit: 'Types of Interactions', label: 'Electric and magnetic fields.' }
    ],
    units: ['Types of Interactions'],
    conceptConfidence: 'none',
    standardsConfidence: 'strong',
    courseProfileId: 'physical_science',
    standardsBankId: 'missouri_science_6_12'
  },
  {
    timestamp: '2026-05-01T10:06:00.000Z',
    studentQuestion: 'Old log with only legacy standards',
    routeType: 'formula',
    matchedConcepts: [
      { id: 'force-formula', title: 'Force', type: 'formula', unit: 'Forces', score: 11 }
    ],
    standards: [
      { standardId: 'PS.FORCES.NEWTON2', unit: 'Forces', label: 'Use force, mass, and acceleration.' }
    ],
    units: ['Forces'],
    standardsConfidence: 'medium'
  },
  {
    timestamp: '2026-05-01T10:07:00.000Z',
    studentQuestion: 'What was Sputnik 1?',
    routeType: 'knowledge',
    matchedConcepts: [
      { id: 'sputnik-1-launch', title: 'Sputnik 1 Launch', type: 'timeline_event', unit: 'Science History', score: 11 }
    ],
    primaryStandards: [],
    standards: [],
    units: ['Science History'],
    conceptConfidence: 'medium',
    standardsConfidence: 'none'
  },
  {
    timestamp: '2026-05-01T10:08:00.000Z',
    routeType: 'unknown'
  },
  {
    timestamp: '2026-05-01T10:09:00.000Z',
    studentQuestion: 'Malformed old entry should not crash',
    matchedConcepts: 'not an array',
    standards: { standardId: 'bad' },
    units: 'Matter',
    standardsConfidence: 'unexpected',
    conceptConfidence: 'unexpected'
  },
  null,
  'not an entry'
];

const summary = buildStandardsSummaryReport(entries, {
  now: new Date('2026-05-04T12:00:00.000Z'),
  exampleLimit: 2,
  recentLimit: 3
});

assert.equal(summary.generatedAt, '2026-05-04T12:00:00.000Z');
assert.equal(summary.totalQuestions, 7, 'totalQuestions should count valid object log entries');
assert.equal(summary.taggedQuestions, 5, 'taggedQuestions should count entries with standards, possible standards, concepts, or units');
assert.equal(summary.untaggedQuestions, 2, 'untaggedQuestions should be total minus tagged');

assert.deepEqual(
  summary.standards.map((row) => [row.standardId, row.count]),
  [
    ['9-12.PS2.A.1', 1],
    ['9-12.PS2.B.2', 1],
    ['PS.FORCES.NEWTON2', 1]
  ],
  'primaryStandards should be counted, with legacy standards as fallback'
);
assert.equal(
  summary.standards.some((row) => row.standardId === '9-12.PS1.A.3'),
  false,
  'possibleStandards should not count as primary standards'
);

assert.deepEqual(
  summary.possibleStandardsSummary.map((row) => [row.standardId, row.count]),
  [
    ['9-12.PS1.A.3', 1],
    ['9-12.PS3.B.1', 1]
  ],
  'possible standards should be summarized separately'
);

assert.deepEqual(
  summary.concepts.map((row) => [row.id, row.count]),
  [
    ['density-formula', 1],
    ['force-formula', 1],
    ['sputnik-1-launch', 1]
  ],
  'concept counts should include concept-only logs'
);
assert.equal(summary.concepts.find((row) => row.id === 'density-formula').averageScore, 15);

assert.deepEqual(summary.standardsConfidence, {
  strong: 2,
  medium: 1,
  weak: 0,
  none: 4
});

assert.deepEqual(summary.conceptConfidence, {
  strong: 0,
  medium: 2,
  weak: 0,
  none: 5
});

assert.deepEqual(summary.courseProfileIds, [
  { courseProfileId: 'physical_science', count: 3 }
]);
assert.deepEqual(summary.standardsBankIds, [
  { standardsBankId: 'missouri_science_6_12', count: 3 }
]);

assert.equal(summary.standards[0].exampleQuestions.length, 1, 'standard examples should be present');
assert.equal(summary.concepts[0].exampleQuestions.length, 1, 'concept examples should be present');
assert.equal(summary.units[0].exampleQuestions.length <= 2, true, 'unit examples should be limited');
assert.equal(summary.recentTaggedQuestions.length, 3, 'recent tagged examples should be limited');
assert.deepEqual(
  summary.recentTaggedQuestions.map((entry) => entry.question),
  ['What was Sputnik 1?', 'Old log with only legacy standards', 'How does an electric current make a magnetic field?'],
  'recent tagged examples should be newest first'
);

for (const example of [
  ...summary.recentTaggedQuestions,
  ...summary.standards.flatMap((row) => row.exampleQuestions),
  ...summary.possibleStandardsSummary.flatMap((row) => row.exampleQuestions),
  ...summary.concepts.flatMap((row) => row.exampleQuestions),
  ...summary.units.flatMap((row) => row.exampleQuestions)
]) {
  assert.deepEqual(
    Object.keys(example).sort(),
    [
      'conceptConfidence',
      'concepts',
      'possibleStandards',
      'question',
      'routeType',
      'standards',
      'standardsConfidence',
      'timestamp',
      'units'
    ].sort(),
    'examples should only contain compact reporting fields'
  );
}

const serialized = JSON.stringify(summary);
assert.equal(serialized.includes('sessionId'), false, 'examples should not leak sessionId');
assert.equal(serialized.includes('student-session-1'), false, 'examples should not leak session values');
assert.equal(serialized.includes('debug'), false, 'examples should not leak debug');
assert.equal(serialized.includes(leakedAnswerText), false, 'examples should not leak full answer text');

const emptySummary = buildStandardsSummaryReport({ not: 'an array' });
assert.equal(emptySummary.totalQuestions, 0, 'non-array input should behave like an empty log');
assert.deepEqual(emptySummary.standards, [], 'non-array input should not produce standards');
assert.deepEqual(emptySummary.possibleStandardsSummary, [], 'non-array input should not produce possible standards');

console.log('Standards summary report checks passed');
