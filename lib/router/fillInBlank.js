function isFillInTheBlankPrompt(message) {
  const text = String(message || '');
  if (!text.trim()) return false;

  return /_{2,}/.test(text) ||
    /(?:^|\s)[*_]*_[*_]*(?=$|\s|[.,;:!?])/.test(text) ||
    /\bfill\s+in\s+the\s+blank\b/i.test(text) ||
    /\bblank\b/i.test(text);
}

function hasExplicitBlankContextDependency(message) {
  const normalized = String(message || '')
    .toLowerCase()
    .replace(/[?.!,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /\b(?:previous|last|above|same)\s+(?:question|problem|one|blank|sentence)\b/.test(normalized) ||
    /\b(?:that|this)\s+(?:question|problem|one|sentence)\b/.test(normalized);
}

module.exports = {
  hasExplicitBlankContextDependency,
  isFillInTheBlankPrompt
};
