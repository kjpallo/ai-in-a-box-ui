const ROUTER_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'did', 'do', 'does',
  'for', 'from', 'how', 'i', 'in', 'is', 'it', 'mean', 'means', 'of', 'on', 'or',
  'the', 'this', 'to', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you'
]);

function looksLikeDefinitionQuestion(normalized) {
  return /\b(what is|what are|define|meaning of|what does)\b/.test(normalized);
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
  return applyRoutingAliases(String(value || '').toLowerCase())
    .replace(/\bdif+e?r+e?n?c?e?\b/g, 'difference')
    .replace(/\bdiff?ers?\b/g, 'difference')
    .replace(/\brelater\b/g, 'related')
    .replace(/\boms\s+law\b/g, 'ohms law')
    .replace(/\bohm'?s?\s+law\b/g, 'ohms law')
    .replace(/[^a-z0-9µμ.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyRoutingAliases(value) {
  return String(value || '')
    .replace(/\bwieght\b/g, 'weight')
    .replace(/\bherts\b/g, 'hertz')
    .replace(/\bwave\s+length\b/g, 'wavelength')
    .replace(/\bvraiable\b/g, 'variable')
    .replace(/\bpotetial\b/g, 'potential')
    .replace(/\bpotietal\b/g, 'potential')
    .replace(/\btempter\b/g, 'temperature')
    .replace(/\btempituer\b/g, 'temperature');
}

module.exports = {
  ROUTER_STOP_WORDS,
  applyRoutingAliases,
  looksLikeDefinitionQuestion,
  looksLikeSafetyAdviceQuestion,
  looksLikeScienceQuestion,
  normalize
};
