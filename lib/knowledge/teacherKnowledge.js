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

  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
    'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'what',
    'when', 'where', 'which', 'who', 'why', 'with', 'does', 'do', 'did',
    'can', 'could', 'would', 'should', 'this', 'that', 'these', 'those',
    'about', 'because', 'there', 'their', 'they', 'them', 'than', 'then',
    'have', 'has', 'had', 'was', 'were', 'you', 'your', 'its', 'our',
    'get', 'find', 'calculate', 'solve', 'define', 'explain', 'tell',
    'mean', 'means'
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
      let importantKeywordMatches = 0;

      for (const term of item.terms || []) {
        const normalizedTerm = normalizeForSearch(term);
        if (!normalizedTerm) continue;

        if (containsPhrase(normalizedMessage, normalizedTerm)) {
          exactTermMatch = true;
          score += normalizedTerm.includes(' ') ? 30 : 18;
        }
      }

      const normalizedTitle = normalizeForSearch(item.title);
      if (normalizedTitle && containsPhrase(normalizedMessage, normalizedTitle)) {
        exactTitleMatch = true;
        score += 25;
      }

      for (const token of new Set(importantMessageTokens)) {
        if (itemImportantTokens.has(token)) {
          importantKeywordMatches += 1;
          score += 4;
        }
      }

      const strongEnoughMatch =
        exactTermMatch ||
        exactTitleMatch ||
        importantKeywordMatches >= 2;

      return {
        ...item,
        score,
        exactTermMatch,
        exactTitleMatch,
        importantKeywordMatches,
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

module.exports = {
  loadTeacherKnowledge,
  findRelevantKnowledge,
  formatKnowledgeForPrompt
};
