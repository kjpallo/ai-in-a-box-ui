const DEMO_SAME_OR_DIFFERENT_PATTERN = {
  id: 'demo.same-or-different',
  topic: 'same or different',
  originalQuestion: 'Is this all the same or different?',
  steps: [
    {
      id: 'same-or-different',
      type: 'choice',
      prompt: 'Is everything the same, or can you see different parts?',
      choices: [
        { number: 1, label: 'Everything is the same.', value: 'same', correct: true },
        { number: 2, label: 'I can see different parts.', value: 'different', correct: false }
      ],
      correctAnswer: 'same'
    }
  ],
  finalAnswer: 'This is the same throughout.'
};

const DEMO_CONCEPT_TUTOR_PATTERNS = [
  DEMO_SAME_OR_DIFFERENT_PATTERN
];

module.exports = {
  DEMO_CONCEPT_TUTOR_PATTERNS,
  DEMO_SAME_OR_DIFFERENT_PATTERN
};
