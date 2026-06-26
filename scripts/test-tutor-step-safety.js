const assert = require('node:assert/strict');

const { canStartFormulaTutor } = require('../lib/tutor/formulaTutor');
const {
  canStartStudentTutorSteps,
  checkStudentTutorStepSafety,
  getUnsafeStudentTutorStepReasons
} = require('../lib/tutor/studentTutorSafety');

const safeMultipleChoiceNetForceSteps = [
  {
    id: 'identify_forces',
    type: 'multiple_choice',
    prompt: 'Which force amounts are given?',
    choices: [
      { number: 1, label: '15 N and 10 N', correct: true },
      { number: 2, label: '15 kg and 10 kg', correct: false }
    ],
    expected: '15 N and 10 N'
  },
  {
    id: 'calculate_net_force',
    type: 'calculation',
    prompt: 'What is the net force? Use 15 - 10.',
    calculationExpression: '15 - 10',
    expectedValue: 5,
    expectedUnit: 'N',
    expectedDisplay: '5 N'
  }
];

assert.equal(
  canStartStudentTutorSteps(safeMultipleChoiceNetForceSteps),
  true,
  'safe multiple-choice net-force steps should pass the student tutor contract'
);
assert.equal(
  canStartFormulaTutor(makeFormulaRoute(safeMultipleChoiceNetForceSteps)),
  true,
  'safe multiple-choice net-force Formula Tutor should be allowed to start'
);

const safeNumericCalculationSteps = [
  {
    id: 'identify_mass',
    type: 'quantity',
    prompt: 'What number should go in for mass, m?',
    expectedValue: 10,
    expectedUnit: 'kg',
    expectedDisplay: '10 kg'
  },
  {
    id: 'calculate_force',
    type: 'calculation',
    prompt: 'What is 10 × 3?',
    calculationExpression: '10 * 3',
    expectedValue: 30,
    expectedUnit: 'N',
    expectedDisplay: '30 N'
  }
];

assert.equal(
  canStartStudentTutorSteps(safeNumericCalculationSteps),
  true,
  'safe numeric/calculation steps should pass the student tutor contract'
);
assert.equal(
  canStartFormulaTutor(makeFormulaRoute(safeNumericCalculationSteps)),
  true,
  'safe numeric/calculation Formula Tutor should be allowed to start'
);

const unsafeOpenEndedNetForceSteps = [
  {
    id: 'identify_forces',
    type: 'text',
    prompt: 'What forces are given?',
    expected: '15 N right and 10 N left',
    acceptedAnswers: ['15 N right and 10 N left']
  },
  ...safeMultipleChoiceNetForceSteps.slice(1)
];

assert.equal(
  canStartStudentTutorSteps(unsafeOpenEndedNetForceSteps),
  false,
  'open-ended net-force-style first step should fail the student tutor contract'
);
assert.deepEqual(
  getUnsafeStudentTutorStepReasons(unsafeOpenEndedNetForceSteps).map((item) => item.reason),
  ['open_ended_text_step'],
  'open-ended net-force-style first step should report the text-step safety reason'
);
assert.equal(
  canStartFormulaTutor(makeFormulaRoute(unsafeOpenEndedNetForceSteps)),
  false,
  'open-ended net-force-style Formula Tutor should not be allowed to start'
);

const futureConceptTutorStep = {
  id: 'concept_explain',
  type: 'text',
  prompt: 'Explain why balanced forces do not change motion.',
  expected: 'Balanced forces have a net force of zero, so they do not change motion.'
};
assert.deepEqual(
  checkStudentTutorStepSafety(futureConceptTutorStep),
  { safe: false, reason: 'open_ended_text_step' },
  'future open-ended concept tutor text steps should be rejected'
);

const futureGeneralTutorGuidingQuestions = [
  'What do you think inertia means?',
  'Explain how mass changes inertia.'
];
assert.equal(
  canStartStudentTutorSteps(futureGeneralTutorGuidingQuestions),
  false,
  'future general tutor string guiding-question shapes should be rejected'
);
assert.deepEqual(
  getUnsafeStudentTutorStepReasons(futureGeneralTutorGuidingQuestions).map((item) => item.reason),
  ['step_must_be_object', 'step_must_be_object'],
  'future general tutor string guiding-question shapes should report object-shape failures'
);

const fallbackOnlyOpenEndedStep = {
  id: 'fallback_explain',
  type: 'text',
  prompt: 'Explain what you think is happening.',
  fallbackOnly: true
};
assert.equal(
  checkStudentTutorStepSafety(fallbackOnlyOpenEndedStep).safe,
  true,
  'fallback-only open-ended text steps should not block the student tutor contract'
);

console.log('✅ tutor step safety: safe Formula Tutor shapes start and open-ended student tutor shapes are blocked');

function makeFormulaRoute(steps) {
  return {
    formulaWork: {
      formulaId: 'net_force',
      family: 'forces',
      solveFor: 'net force',
      formula: 'net force = forces in one direction - forces in the opposite direction',
      finalAnswer: { value: 5, unit: 'N', display: '5 N right' },
      variables: {},
      steps
    }
  };
}
