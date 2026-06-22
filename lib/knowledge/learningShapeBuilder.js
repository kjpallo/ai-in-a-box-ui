function buildLearningShapeAnswer(message, options = {}) {
  const requestedLearningShape = options.requestedLearningShape || null;
  if (!requestedLearningShape) return null;

  const text = normalize(message);
  const topic = selectTopic(text, options.topics || []);
  if (!topic) return null;

  const directAnswer = formatLearningShape(topic, requestedLearningShape);
  if (!directAnswer) return null;

  return {
    requestedLearningShape,
    directAnswer,
    topicId: topic.id,
    responseType: topic.responseType || ''
  };
}

function formatLearningShape(topic, shape) {
  if (shape === 'flashcards') return formatFlashcards(topic);
  if (shape === 'examples_non_examples') return formatExamplesNonExamples(topic);
  if (shape === 'common_mistakes') return formatCommonMistakes(topic);
  if (shape === 'compare_contrast') return formatCompareContrast(topic);
  return '';
}

function formatFlashcards(topic) {
  const cards = Array.isArray(topic.flashcards) ? topic.flashcards : [];
  if (cards.length === 0) return '';

  return cards.map((card, index) => {
    const term = clean(card.term || card.front || card.question);
    const answer = clean(card.definition || card.back || card.answer);
    if (!term || !answer) return '';
    return `${index + 1}. ${term}\n   Answer: ${answer}`;
  }).filter(Boolean).join('\n');
}

function formatExamplesNonExamples(topic) {
  const examples = asArray(topic.examples);
  const nonExamples = asArray(topic.nonExamples);
  if (examples.length === 0 && nonExamples.length === 0) return '';

  const lines = [];
  if (examples.length > 0) {
    lines.push('Examples:');
    examples.forEach((example, index) => lines.push(`${index + 1}. ${example}`));
  }
  if (nonExamples.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Non-examples:');
    nonExamples.forEach((example, index) => lines.push(`${index + 1}. ${example}`));
  }
  return lines.join('\n');
}

function formatCommonMistakes(topic) {
  const mistakes = asArray(topic.commonMistakes);
  if (mistakes.length === 0) return '';

  return mistakes.map((mistake, index) => `${index + 1}. ${mistake}`).join('\n');
}

function formatCompareContrast(topic) {
  const comparison = topic.compareContrast || null;
  if (!comparison) return '';

  const left = comparison.left || null;
  const right = comparison.right || null;
  const keyPoint = clean(comparison.keyPoint);
  if (!left || !right) return '';

  const lines = [
    `${left.term}: ${left.definition}`,
    `${right.term}: ${right.definition}`
  ];

  if (keyPoint) lines.push(`Key difference: ${keyPoint}`);

  const examples = asArray(topic.examples);
  if (examples.length > 0) {
    lines.push('');
    lines.push('Examples:');
    examples.forEach((example, index) => lines.push(`${index + 1}. ${example}`));
  }

  return lines.join('\n');
}

function selectTopic(text, topics) {
  return topics
    .map((topic) => ({ topic, score: scoreTopic(text, topic) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || (right.topic.priority || 0) - (left.topic.priority || 0))[0]?.topic || null;
}

function scoreTopic(text, topic = {}) {
  const terms = [topic.title, ...(topic.aliases || [])].map(normalize).filter(Boolean);
  return terms.reduce((score, term) => {
    if (hasPhrase(text, term)) return score + term.split(/\s+/).length + (topic.priority || 0);
    return score;
  }, 0);
}

function hasPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function asArray(value) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function clean(value) {
  return String(value || '').trim();
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  buildLearningShapeAnswer
};
