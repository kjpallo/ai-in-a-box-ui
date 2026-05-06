const { buildStandardsLogMetadata } = require('../lib/standards/standardsLogMetadata');

const questions = [
  'What is density?',
  'How can density help identify or compare substances?',
  'What was Sputnik 1?',
  "What is Newton's second law?",
  'How does an electric current make a magnetic field?'
];

for (const question of questions) {
  const metadata = buildStandardsLogMetadata(question);
  console.log(`\n${question}`);
  console.log(JSON.stringify(metadata, null, 2));
}
