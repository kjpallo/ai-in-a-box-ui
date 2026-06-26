const assert = require('node:assert/strict');

const {
  DEMO_SAME_OR_DIFFERENT_PATTERN
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const {
  answerConceptTutorStep,
  buildConceptTutorMetadata,
  buildConceptTutorPrompt,
  canStartConceptTutor,
  getConceptTutorStartBlockers,
  startConceptTutor
} = require('../lib/tutor/conceptTutor/conceptTutorEngine');

assert.equal(
  canStartConceptTutor(DEMO_SAME_OR_DIFFERENT_PATTERN),
  true,
  'safe multiple-choice concept pattern should be allowed to start'
);

const unsafeOpenEndedPattern = {
  id: 'demo.open-ended',
  topic: 'unsafe open-ended concept',
  steps: [
    {
      id: 'explain',
      type: 'text',
      prompt: 'Explain why this answer is true.',
      expected: 'It is the same throughout.'
    }
  ],
  finalAnswer: 'It is the same throughout.'
};

assert.equal(
  canStartConceptTutor(unsafeOpenEndedPattern),
  false,
  'open-ended text concept pattern should be rejected'
);
assert.deepEqual(
  getConceptTutorStartBlockers(unsafeOpenEndedPattern).map((item) => item.reason),
  ['concept_step_must_be_controlled_choice', 'open_ended_text_step'],
  'open-ended concept pattern should report concept and student safety blockers'
);

const originalQuestion = 'Is the sample all the same or different?';
const started = startConceptTutor(DEMO_SAME_OR_DIFFERENT_PATTERN, originalQuestion);
assert.ok(started, 'safe concept tutor should start');
assert.equal(started.originalQuestion, originalQuestion, 'original question should be preserved');

const activePrompt = buildConceptTutorPrompt(started);
assert.match(activePrompt, /Step 1 of 1/, 'prompt should show current step progress');
assert.doesNotMatch(
  activePrompt,
  /This is the same throughout\./,
  'active prompt should not reveal the final answer'
);

const activeMetadata = buildConceptTutorMetadata(started);
assert.equal(activeMetadata.routeType, 'concept_tutor', 'metadata route type should identify concept tutor');
assert.equal(activeMetadata.tutorType, 'concept_tutor', 'metadata tutor type should identify concept tutor');
assert.equal(activeMetadata.active, true, 'active metadata should be marked active');
assert.equal(activeMetadata.currentStepIndex, 0, 'active metadata should expose current step index');
assert.equal(activeMetadata.stepNumber, 1, 'active metadata should expose one-based step number');
assert.equal(activeMetadata.totalSteps, 1, 'active metadata should expose total steps');
assert.equal(activeMetadata.originalQuestion, originalQuestion, 'active metadata should preserve original question');
assert.deepEqual(
  activeMetadata.currentStep.choices,
  [
    { number: '1', label: 'Everything is the same.' },
    { number: '2', label: 'I can see different parts.' }
  ],
  'active metadata should expose controlled choices only'
);
assert.equal(activeMetadata.finalAnswer, undefined, 'active metadata should not reveal final answer');
assert.equal(activeMetadata.work.finalAnswer, '', 'active work should not reveal final answer');

const wrong = answerConceptTutorStep(started, '2');
assert.equal(wrong.completed, false, 'wrong choice should not complete the tutor');
assert.equal(wrong.stopped, false, 'wrong choice should not stop the tutor');
assert.equal(wrong.currentTutorProblem.currentStepIndex, 0, 'wrong choice should not advance');
assert.equal(wrong.currentTutorProblem.attempts['same-or-different'], 1, 'wrong choice should record an attempt');
assert.match(wrong.response, /Not quite/, 'wrong choice should give a retry response');

const typedConceptAnswer = answerConceptTutorStep(wrong.currentTutorProblem, 'same');
assert.equal(typedConceptAnswer.completed, false, 'typed concept words should not complete the tutor');
assert.equal(typedConceptAnswer.currentTutorProblem.currentStepIndex, 0, 'typed concept words should not advance');
assert.match(typedConceptAnswer.response, /Please choose one of the listed options/, 'typed concept words should be redirected to choices');

const correct = answerConceptTutorStep(typedConceptAnswer.currentTutorProblem, '1');
assert.equal(correct.completed, true, 'correct choice should complete a one-step tutor');
assert.equal(correct.stopped, false, 'correct choice should not stop the tutor');
assert.equal(correct.currentTutorProblem, null, 'completed tutor should clear active tutor problem');
assert.equal(correct.completedTutorProblem.currentStepIndex, 1, 'correct choice should advance past final step');
assert.match(correct.response, /This is the same throughout\./, 'completed response should include final answer');

const completedMetadata = buildConceptTutorMetadata(correct.completedTutorProblem, { completed: true });
assert.equal(completedMetadata.active, false, 'completed metadata should not be active');
assert.equal(completedMetadata.completed, true, 'completed metadata should be marked complete');
assert.equal(completedMetadata.finalAnswer, 'This is the same throughout.', 'completed metadata should include final answer');
assert.equal(completedMetadata.work.finalAnswer, 'This is the same throughout.', 'completed work should include final answer');

console.log('PASS concept tutor skeleton: controlled-choice flow starts, retries safely, completes, and hides final answer until completion');
