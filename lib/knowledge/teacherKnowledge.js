const fs = require('node:fs');

function loadTeacherKnowledge(teacherFactsFile) {
  try {
    if (!fs.existsSync(teacherFactsFile)) {
      console.warn(`No teacher knowledge file found at ${teacherFactsFile}. Running without local facts.`);
      return [];
    }

    const parsed = JSON.parse(fs.readFileSync(teacherFactsFile, 'utf8'));
    const items = Array.isArray(parsed) ? parsed : parsed.items;

    if (!Array.isArray(items)) {
      console.warn('Teacher knowledge file should be an array or an object with an items array.');
      return [];
    }

    return items
      .map((item, index) => ({
        id: item.id || `knowledge-${index + 1}`,
        category: item.category || 'reference',
        title: item.title || item.term || `Knowledge item ${index + 1}`,
        terms: Array.isArray(item.terms) ? item.terms : [],
        fact: item.fact || item.definition || item.text || '',
        formula: item.formula || '',
        examples: Array.isArray(item.examples) ? item.examples : [],
        source: item.source || 'Teacher-created local knowledge base'
      }))
      .filter((item) => item.fact || item.formula);
  } catch (error) {
    console.error('Could not load teacher knowledge:', error);
    return [];
  }
}

function findRelevantKnowledge(message, knowledgeItems, maxItems = 6) {
  const normalizedMessage = normalizeForSearch(message);

  if (!normalizedMessage || !knowledgeItems.length) return [];

  const messageSubjectContexts = detectSubjectContexts(normalizedMessage);

  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
    'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'what',
    'when', 'where', 'which', 'who', 'why', 'with', 'does', 'do', 'did',
    'can', 'could', 'would', 'should', 'this', 'that', 'these', 'those',
    'about', 'because', 'there', 'their', 'they', 'them', 'than', 'then',
    'have', 'has', 'had', 'was', 'were', 'you', 'your', 'its', 'our',
    'get', 'find', 'calculate', 'solve', 'define', 'explain', 'tell',
    'mean', 'means', 'branch', 'branches', 'law', 'laws'
  ]);

  const importantMessageTokens = tokenizeForSearch(message)
    .filter((token) => token.length >= 4 && !stopWords.has(token));

  return knowledgeItems
    .map((item) => {
      const searchableParts = [
        item.title,
        item.category,
        ...(item.terms || [])
      ];

      const itemImportantTokens = new Set(
        tokenizeForSearch(searchableParts.join(' '))
          .filter((token) => token.length >= 4 && !stopWords.has(token))
      );

      let score = 0;
      let exactTermMatch = false;
      let exactTitleMatch = false;
      const exactTermMatches = [];
      const phraseMatches = [];
      let importantKeywordMatches = 0;

      for (const term of item.terms || []) {
        const normalizedTerm = normalizeForSearch(term);
        if (!normalizedTerm) continue;

        if (containsPhrase(normalizedMessage, normalizedTerm)) {
          exactTermMatch = true;
          exactTermMatches.push(normalizedTerm);
          const termWordCount = wordCount(normalizedTerm);
          score += normalizedTerm.includes(' ') ? 30 + ((termWordCount - 1) * 12) : 18;
        }
      }

      const normalizedTitle = normalizeForSearch(item.title);
      if (normalizedTitle && containsPhrase(normalizedMessage, normalizedTitle)) {
        exactTitleMatch = true;
        score += 25;
        phraseMatches.push(normalizedTitle);
      }

      const factPhraseMatch = longestCommonPhrase(normalizedMessage, normalizeForSearch(item.fact), {
        minWords: 3,
        stopWords
      });
      if (factPhraseMatch) {
        phraseMatches.push(factPhraseMatch.phrase);
        score += factPhraseMatch.wordCount >= 5 ? 28 : 18;
      }

      for (const token of new Set(importantMessageTokens)) {
        if (itemImportantTokens.has(token)) {
          importantKeywordMatches += 1;
          score += 4;
        }
      }

      const itemSubjectContexts = detectSubjectContexts([
        item.subject,
        item.category,
        item.title,
        item.fact,
        item.source,
        ...(item.terms || [])
      ].join(' '));
      const subjectContextMatches = [...messageSubjectContexts]
        .filter((context) => itemSubjectContexts.has(context));
      const strongestPhraseWordCount = getStrongestPhraseWordCount({
        exactTitleMatch,
        normalizedTitle,
        exactTermMatches,
        phraseMatches
      });
      if (subjectContextMatches.length > 0 && strongestPhraseWordCount >= 2) {
        score += 22;
      }

      const strongEnoughMatch =
        exactTermMatch ||
        exactTitleMatch ||
        importantKeywordMatches >= 2 ||
        strongestPhraseWordCount >= 3;

      return {
        ...item,
        score,
        exactTermMatch,
        exactTitleMatch,
        exactTermMatches,
        phraseMatches: uniqueTerms(phraseMatches),
        strongestPhraseWordCount,
        importantKeywordMatches,
        subjectContextMatches,
        strongEnoughMatch
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);
}

function formatKnowledgeForPrompt(items) {
  return items
    .map((item, index) => {
      const lines = [
        `${index + 1}. ${item.title} [${item.category}]`,
        `Fact: ${item.fact}`
      ];

      if (item.formula) lines.push(`Formula: ${item.formula}`);
      if (item.examples.length) lines.push(`Examples: ${item.examples.join(' | ')}`);
      if (item.source) lines.push(`Source note: ${item.source}`);

      return lines.join('\n');
    })
    .join('\n\n');
}

function normalizeForSearch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9µμ.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeForSearch(value) {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'how', 'i', 'in',
    'is', 'it', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'which', 'who', 'why', 'with'
  ]);

  return normalizeForSearch(value)
    .split(' ')
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function containsPhrase(haystack, phrase) {
  if (!phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|\\s)${escaped}($|\\s)`);
  return pattern.test(haystack);
}

function longestCommonPhrase(left, right, options = {}) {
  const leftTokens = tokenizePhrase(left);
  const rightTokens = tokenizePhrase(right);
  const minWords = options.minWords || 3;
  const stopWords = options.stopWords || new Set();
  let best = [];

  for (let i = 0; i < leftTokens.length; i += 1) {
    for (let j = 0; j < rightTokens.length; j += 1) {
      let length = 0;
      while (
        i + length < leftTokens.length &&
        j + length < rightTokens.length &&
        leftTokens[i + length] === rightTokens[j + length]
      ) {
        length += 1;
      }

      if (length >= minWords && length > best.length) {
        const phraseTokens = leftTokens.slice(i, i + length);
        const meaningfulTokens = phraseTokens.filter((token) => !stopWords.has(token));
        if (meaningfulTokens.length >= 2) {
          best = phraseTokens;
        }
      }
    }
  }

  if (best.length < minWords) return null;
  return {
    phrase: best.join(' '),
    wordCount: best.length
  };
}

function tokenizePhrase(value) {
  return normalizeForSearch(value)
    .split(' ')
    .filter(Boolean);
}

function detectSubjectContexts(value) {
  const normalized = normalizeForSearch(value);
  const contexts = new Set();

  if (/\b(branch|branches|government|laws?|courts?|judges?|judicial|legislative|executive|constitution|checks\s+and\s+balances|civics?|citizens?|representatives?|voting|amendments?)\b/.test(normalized)) {
    contexts.add('civics');
  }

  if (/\b(formulas?|solve|calculate|watts?|joules?|seconds?|work\s+divided\s+by\s+time|p\s*w\s*t|energy\s+transferred|physics)\b/.test(normalized)) {
    contexts.add('science_formula');
  }

  return contexts;
}

function getStrongestPhraseWordCount({ exactTitleMatch, normalizedTitle, exactTermMatches, phraseMatches }) {
  const counts = [];

  if (exactTitleMatch && normalizedTitle) {
    counts.push(tokenizePhrase(normalizedTitle).length);
  }

  for (const term of exactTermMatches || []) {
    counts.push(tokenizePhrase(term).length);
  }

  for (const phrase of phraseMatches || []) {
    counts.push(tokenizePhrase(phrase).length);
  }

  return Math.max(0, ...counts);
}

function wordCount(value) {
  return tokenizePhrase(value).length;
}

function uniqueTerms(values) {
  const seen = new Set();
  const result = [];

  for (const value of values || []) {
    const text = String(value || '').trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}

module.exports = {
  loadTeacherKnowledge,
  findRelevantKnowledge,
  formatKnowledgeForPrompt
};
