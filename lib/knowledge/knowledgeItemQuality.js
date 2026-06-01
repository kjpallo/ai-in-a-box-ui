const QUALITY_STATUSES = Object.freeze({
  USABLE: 'usable',
  NEEDS_REVIEW: 'needs_review',
  REJECT: 'reject'
});

const COMMON_SHORT_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'is', 'of', 'on', 'or', 'the', 'to']);
const LINKING_WORDS = new Set(['am', 'are', 'be', 'been', 'being', 'causes', 'cause', 'describes', 'describes', 'explain', 'explains', 'is', 'means', 'refers', 'shows', 'stores', 'was', 'were']);
const PLACEHOLDER_TEXT_PATTERN = /^(?:n\/a|na|none|unknown|not available|draft wording not available|tbd)\.?$/i;

function evaluateKnowledgeItemQuality(sectionName, item = {}) {
  const section = String(sectionName || '').trim();
  const warnings = [];
  let status = QUALITY_STATUSES.USABLE;
  const isDefinitionLikeSection = section === 'vocabulary' || section === 'concepts';
  const isQuestionLikeSection = section === 'problemBank' || section === 'smokeTests';

  const titleOrTerm = firstNonEmptyString(item.term, item.title, item.question, item.standardId);
  const rawExplanation = firstNonEmptyString(
    item.studentAnswer,
    item.answerPreview,
    item.studentDefinition,
    item.studentExplanation,
    item.expectedAnswer,
    item.teacherDefinition
  );
  const sourceSnippet = firstNonEmptyString(item.sourceTextSnippet, item.sourceSnippet);

  if (looksLikeSlideFragment(titleOrTerm) || looksLikeSlideFragment(rawExplanation)) {
    addWarning(warnings, QUALITY_STATUSES.REJECT, 'Text starts with leftover slide/extraction fragments.');
    status = maxStatus(status, QUALITY_STATUSES.REJECT);
  }

  if (!isQuestionLikeSection && looksTruncatedTitle(titleOrTerm)) {
    addWarning(warnings, QUALITY_STATUSES.REJECT, 'Generated title/term appears truncated.');
    status = maxStatus(status, QUALITY_STATUSES.REJECT);
  }

  if (isDefinitionLikeSection && looksLikeNearDuplicateShortFragment(titleOrTerm, rawExplanation)) {
    addWarning(warnings, QUALITY_STATUSES.REJECT, 'Title/term and explanation repeat the same short fragment.');
    status = maxStatus(status, QUALITY_STATUSES.REJECT);
  }
  if (section === 'concepts' && looksLikeKeywordFragment(titleOrTerm, rawExplanation)) {
    addWarning(warnings, QUALITY_STATUSES.REJECT, 'Concept explanation looks like a broken keyword fragment.');
    status = maxStatus(status, QUALITY_STATUSES.REJECT);
  }

  if (section === 'vocabulary') {
    return finalizeVocabularyQuality(item, status, warnings, sourceSnippet);
  }
  if (section === 'concepts') {
    return finalizeConceptQuality(item, status, warnings, sourceSnippet);
  }
  if (section === 'referenceFormulas') {
    return finalizeFormulaQuality(item, status, warnings, sourceSnippet);
  }
  if (section === 'problemBank') {
    return finalizeProblemQuality(item, status, warnings, sourceSnippet);
  }

  const answerPreview = ensureSentence(rawExplanation);
  return {
    status,
    warnings,
    answerPreview,
    studentAnswer: answerPreview,
    originalExtractedText: sourceSnippet
  };
}

function finalizeVocabularyQuality(item, baseStatus, warnings, sourceSnippet) {
  const term = cleanText(firstNonEmptyString(item.term, item.title));
  const definition = cleanText(firstNonEmptyString(item.studentDefinition, item.teacherDefinition, item.studentAnswer, item.answerPreview));
  let status = baseStatus;

  if (!term) {
    addWarning(warnings, QUALITY_STATUSES.REJECT, 'Vocabulary term is missing.');
    status = maxStatus(status, QUALITY_STATUSES.REJECT);
  }
  if (!hasMeaningfulText(definition)) {
    addWarning(warnings, QUALITY_STATUSES.REJECT, 'Vocabulary definition is missing.');
    status = maxStatus(status, QUALITY_STATUSES.REJECT);
  } else if (wordCount(definition) < 4 || definition.length < 16) {
    addWarning(warnings, QUALITY_STATUSES.NEEDS_REVIEW, 'Vocabulary definition is too short for student use.');
    status = maxStatus(status, QUALITY_STATUSES.NEEDS_REVIEW);
  }

  const answerPreview = buildVocabularyAnswerPreview(term, definition);
  return {
    status,
    warnings,
    answerPreview,
    studentAnswer: answerPreview,
    originalExtractedText: sourceSnippet
  };
}

function finalizeConceptQuality(item, baseStatus, warnings, sourceSnippet) {
  const title = cleanText(firstNonEmptyString(item.title, item.term));
  const explanation = cleanText(firstNonEmptyString(
    item.studentAnswer,
    item.answerPreview,
    item.studentExplanation,
    Array.isArray(item.keyIdeas) ? item.keyIdeas.filter(hasMeaningfulText).join(' ') : ''
  ));
  let status = baseStatus;

  if (!title) {
    addWarning(warnings, QUALITY_STATUSES.REJECT, 'Concept title is missing.');
    status = maxStatus(status, QUALITY_STATUSES.REJECT);
  }
  if (!hasMeaningfulText(explanation)) {
    addWarning(warnings, QUALITY_STATUSES.REJECT, 'Concept explanation is missing.');
    status = maxStatus(status, QUALITY_STATUSES.REJECT);
  } else if (wordCount(explanation) < 6 || explanation.length < 28) {
    addWarning(warnings, QUALITY_STATUSES.NEEDS_REVIEW, 'Concept explanation is too short.');
    status = maxStatus(status, QUALITY_STATUSES.NEEDS_REVIEW);
  }

  const answerPreview = buildConceptAnswerPreview(explanation);
  if (!looksSentenceLike(answerPreview)) {
    addWarning(warnings, QUALITY_STATUSES.NEEDS_REVIEW, 'Concept explanation needs a complete sentence.');
    status = maxStatus(status, QUALITY_STATUSES.NEEDS_REVIEW);
  }

  return {
    status,
    warnings,
    answerPreview,
    studentAnswer: answerPreview,
    originalExtractedText: sourceSnippet
  };
}

function finalizeFormulaQuality(item, baseStatus, warnings, sourceSnippet) {
  const equation = cleanText(firstNonEmptyString(item.equation, item.formula));
  const explanation = cleanText(firstNonEmptyString(item.studentExplanation, item.studentAnswer, item.answerPreview, item.title));
  let status = baseStatus;

  if (!equation) {
    addWarning(warnings, QUALITY_STATUSES.REJECT, 'Formula equation is missing.');
    status = maxStatus(status, QUALITY_STATUSES.REJECT);
  } else if (looksIncompleteFormula(equation)) {
    addWarning(warnings, QUALITY_STATUSES.NEEDS_REVIEW, 'Formula appears incomplete or cut off.');
    status = maxStatus(status, QUALITY_STATUSES.NEEDS_REVIEW);
  }

  if (!hasMeaningfulText(explanation)) {
    addWarning(warnings, QUALITY_STATUSES.NEEDS_REVIEW, 'Formula is missing a student-friendly explanation.');
    status = maxStatus(status, QUALITY_STATUSES.NEEDS_REVIEW);
  }

  const explanationSentence = ensureSentence(explanation || 'Use this equation with the matching variable values.');
  const answerPreview = equation
    ? `${equation}. ${explanationSentence}`.trim()
    : explanationSentence;

  return {
    status,
    warnings,
    answerPreview,
    studentAnswer: answerPreview,
    originalExtractedText: sourceSnippet
  };
}

function finalizeProblemQuality(item, baseStatus, warnings, sourceSnippet) {
  const expectedAnswer = cleanText(firstNonEmptyString(item.expectedAnswer, item.answerPreview, item.studentAnswer));
  let status = baseStatus;
  if (!hasMeaningfulText(expectedAnswer)) {
    addWarning(warnings, QUALITY_STATUSES.NEEDS_REVIEW, 'Problem item is missing an expected answer.');
    status = maxStatus(status, QUALITY_STATUSES.NEEDS_REVIEW);
  }
  const answerPreview = ensureSentence(expectedAnswer);
  return {
    status,
    warnings,
    answerPreview,
    studentAnswer: answerPreview,
    originalExtractedText: sourceSnippet
  };
}

function buildVocabularyAnswerPreview(term, definition) {
  const safeTerm = cleanText(term);
  const safeDefinition = cleanText(definition);
  if (!safeDefinition) return '';
  if (!safeTerm) return ensureSentence(safeDefinition);

  const normalizedTerm = safeTerm.toLowerCase();
  const normalizedDefinition = safeDefinition.toLowerCase();
  if (normalizedDefinition.startsWith(normalizedTerm)) {
    return ensureSentence(safeDefinition);
  }

  const trimmedDefinition = safeDefinition.replace(/^(?:is|are)\s+/i, '').trim();
  let withArticle = /^[a-z]/.test(trimmedDefinition) ? trimmedDefinition : lowerFirst(trimmedDefinition);
  if (/^[a-z]/.test(withArticle) && !/^(?:a|an|the)\b/i.test(withArticle)) {
    const article = /^[aeiou]/i.test(withArticle) ? 'an' : 'a';
    withArticle = `${article} ${withArticle}`;
  }
  return ensureSentence(`${safeTerm} is ${withArticle}`);
}

function buildConceptAnswerPreview(explanation) {
  const cleaned = ensureSentence(explanation);
  if (!cleaned) return '';
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return sentences.slice(0, 2).join(' ');
}

function looksIncompleteFormula(equation) {
  const text = cleanText(equation);
  if (!text) return false;
  if (/[=+\-*/×÷→\-]\s*$/u.test(text)) return true;
  if (/(?:\+|=|→|->)\s*\d+\s*$/u.test(text)) return true;
  if (/(?:->|→)\s*[A-Za-z0-9()]*\+\s*$/u.test(text)) return true;
  return false;
}

function looksLikeSlideFragment(text) {
  const value = cleanText(text);
  if (!value) return false;
  if (/^[a-z]\s+[A-Z]/.test(value)) return true;
  if (/^[lI1]\s+[A-Z]/.test(value)) return true;
  return false;
}

function looksTruncatedTitle(value) {
  const text = cleanText(value);
  if (!text) return false;
  if (isUppercaseAcronym(text)) return false;
  if (text.endsWith('...') || text.endsWith('..')) return true;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  const lastWord = words[words.length - 1];
  const lowerLastWord = lastWord.toLowerCase();
  if (COMMON_SHORT_WORDS.has(lowerLastWord)) return true;
  if (lastWord.length <= 3 && /[A-Za-z]/.test(lastWord) && !isUppercaseAcronym(lastWord)) return true;
  if (/[a-z]$/.test(lastWord) && /^[A-Z]/.test(lastWord) && lastWord.length <= 3) return true;
  return false;
}

function looksLikeNearDuplicateShortFragment(title, explanation) {
  const left = normalizeFragment(title);
  const right = normalizeFragment(explanation);
  if (!left || !right) return false;
  if (left.length > 70 || right.length > 120) return false;
  const leftWords = left.split(' ');
  const rightWords = right.split(' ');
  if (leftWords.length > 9 || rightWords.length > 24) return false;
  if (left === right) return true;

  if (left.includes(right) && rightWords.length <= leftWords.length + 1) return true;

  if (startsWithWordSequence(rightWords, leftWords)) {
    const addedWordCount = rightWords.length - leftWords.length;
    const addedMeaningfulWords = addedMeaningfulWordCount(leftWords, rightWords);
    if (addedMeaningfulWords === 0) return true;
    if (addedMeaningfulWords === 1 && addedWordCount <= 2 && rightWords.length <= 5) return true;
  }

  if (right.includes(left)) {
    const addedMeaningfulWords = addedMeaningfulWordCount(leftWords, rightWords);
    if (addedMeaningfulWords === 0) return true;
    if (addedMeaningfulWords === 1 && rightWords.length <= 4) return true;
  }

  const intersection = leftWords.filter((word) => rightWords.includes(word));
  const overlap = intersection.length / Math.max(1, Math.min(leftWords.length, rightWords.length));
  if (overlap >= 0.9) {
    const addedMeaningfulWords = addedMeaningfulWordCount(leftWords, rightWords);
    return addedMeaningfulWords === 0 && rightWords.length <= leftWords.length + 2;
  }
  return false;
}

function looksLikeKeywordFragment(title, explanation) {
  const text = cleanText(explanation);
  if (!text) return false;
  if (/[.!?]/.test(text)) return false;
  const words = normalizeFragment(text).split(' ').filter(Boolean);
  if (words.length < 3 || words.length > 5) return false;
  if (words.some((word) => COMMON_SHORT_WORDS.has(word))) return false;
  if (words.some((word) => LINKING_WORDS.has(word))) return false;

  const titleWords = normalizeFragment(title).split(' ').filter(Boolean);
  if (!titleWords.length) return false;
  const overlap = words.filter((word) => titleWords.includes(word)).length;
  return overlap / words.length <= 0.25;
}

function startsWithWordSequence(words, sequence) {
  if (!Array.isArray(words) || !Array.isArray(sequence)) return false;
  if (sequence.length === 0 || sequence.length > words.length) return false;
  for (let index = 0; index < sequence.length; index += 1) {
    if (words[index] !== sequence[index]) return false;
  }
  return true;
}

function addedMeaningfulWordCount(leftWords, rightWords) {
  const leftSet = new Set(leftWords);
  return rightWords.filter((word) => !leftSet.has(word) && !COMMON_SHORT_WORDS.has(word)).length;
}

function normalizeFragment(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function maxStatus(current, next) {
  const rank = {
    [QUALITY_STATUSES.USABLE]: 0,
    [QUALITY_STATUSES.NEEDS_REVIEW]: 1,
    [QUALITY_STATUSES.REJECT]: 2
  };
  return rank[next] > rank[current] ? next : current;
}

function addWarning(warnings, severity, message) {
  const prefix = severity === QUALITY_STATUSES.REJECT ? '[reject]' : '[needs_review]';
  const formatted = `${prefix} ${String(message || '').trim()}`;
  if (!warnings.includes(formatted)) warnings.push(formatted);
}

function ensureSentence(value) {
  const text = cleanText(value);
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function looksSentenceLike(value) {
  const text = cleanText(value);
  if (!text) return false;
  return wordCount(text) >= 5 && /[.!?]$/.test(text);
}

function hasMeaningfulText(value) {
  const text = cleanText(value);
  if (!text) return false;
  if (PLACEHOLDER_TEXT_PATTERN.test(text)) return false;
  return /[A-Za-z0-9]/.test(text);
}

function isUppercaseAcronym(value) {
  const text = cleanText(value);
  if (!text || text.length > 6) return false;
  return /^[A-Z0-9]+$/.test(text);
}

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function wordCount(value) {
  return cleanText(value).split(/\s+/).filter(Boolean).length;
}

function lowerFirst(value) {
  const text = cleanText(value);
  if (!text) return '';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

module.exports = {
  QUALITY_STATUSES,
  evaluateKnowledgeItemQuality
};
