const ROUTER_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'did', 'do', 'does',
  'for', 'from', 'how', 'i', 'in', 'is', 'it', 'mean', 'means', 'of', 'on', 'or',
  'the', 'this', 'to', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you'
]);

function looksLikeDefinitionQuestion(normalized) {
  return /\b(what is|define|meaning of|what does)\b/.test(normalized);
}

function looksLikeScienceQuestion(normalized) {
  const scienceWords = [
    'atom', 'chemical', 'chemistry', 'compound', 'density', 'element', 'energy', 'force',
    'formula', 'gravity', 'mass', 'matter', 'molecule', 'motion', 'newton', 'periodic',
    'physical', 'reaction', 'science', 'speed', 'velocity', 'volume', 'wave'
  ];

  return scienceWords.some((word) => normalized.includes(word));
}

function looksLikeSafetyAdviceQuestion(normalized) {
  const safetyWords = /\b(safe|safety|dangerous|danger|harmful|toxic|poison|poisonous|edible|eat|eaten|drink|drunk|taste|touch|handle|breathe|inhale)\b/;
  const adviceWords = /\b(should|can|could|may|is|are|would)\b/;

  return safetyWords.test(normalized) && adviceWords.test(normalized);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9µμ.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  ROUTER_STOP_WORDS,
  looksLikeDefinitionQuestion,
  looksLikeSafetyAdviceQuestion,
  looksLikeScienceQuestion,
  normalize
};
