const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PACK_DIR = path.join(__dirname, '..', '..', 'knowledge', 'packs', 'physical-science');
const DEFAULT_MAX_CONCEPTS = 5;
const DEFAULT_MAX_STANDARDS = 5;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'from',
  'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'was', 'what',
  'when', 'where', 'which', 'who', 'why', 'with'
]);

function loadPhysicalSciencePack(packDir = DEFAULT_PACK_DIR) {
  const knowledgeItemsPath = path.join(packDir, 'knowledge_items.sample.json');
  const standardsMapPath = path.join(packDir, 'standards_map.sample.json');

  const knowledgeItemsRaw = JSON.parse(fs.readFileSync(knowledgeItemsPath, 'utf8'));
  const standardsMapRaw = JSON.parse(fs.readFileSync(standardsMapPath, 'utf8'));

  return {
    packId: knowledgeItemsRaw.packId || standardsMapRaw.packId || 'physical-science',
    knowledgeItems: Array.isArray(knowledgeItemsRaw.items) ? knowledgeItemsRaw.items : [],
    standards: Array.isArray(standardsMapRaw.standards) ? standardsMapRaw.standards : []
  };
}

function matchQuestionToStandards(question, options = {}) {
  const pack = options.pack || loadPhysicalSciencePack(options.packDir);
  const normalizedQuestion = normalizeForSearch(question);
  const questionTokens = tokenizeForSearch(question);
  const maxConcepts = options.maxConcepts || DEFAULT_MAX_CONCEPTS;
  const maxStandards = options.maxStandards || DEFAULT_MAX_STANDARDS;

  if (!normalizedQuestion) {
    return buildEmptyResult(question);
  }

  const standardById = new Map(pack.standards.map((standard) => [standard.standardId, standard]));

  const conceptMatches = pack.knowledgeItems
    .map((item) => scoreKnowledgeItem(item, normalizedQuestion, questionTokens))
    .filter((match) => match.score > 0)
    .sort(sortByScoreThenTitle)
    .slice(0, maxConcepts);

  const conceptScoreById = new Map(conceptMatches.map((match) => [match.id, match.score]));

  const standardMatches = pack.standards
    .map((standard) => scoreStandard(standard, normalizedQuestion, questionTokens, conceptScoreById))
    .filter((match) => match.score > 0);

  for (const concept of conceptMatches) {
    for (const standardId of concept.standards || []) {
      const standard = standardById.get(standardId);
      if (!standard) continue;

      const existing = standardMatches.find((match) => match.standardId === standard.standardId);
      if (existing) {
        existing.score += Math.min(8, Math.ceil(concept.score / 3));
        existing.matchedReasons.push('concept standard link');
      } else {
        standardMatches.push(formatStandardMatch(standard, Math.min(8, Math.ceil(concept.score / 3)), [
          'concept standard link'
        ]));
      }
    }
  }

  const matchedStandards = dedupeById(standardMatches, 'standardId')
    .sort(sortByScoreThenStandardId)
    .slice(0, maxStandards)
    .map(({ standardId, unit, label }) => ({ standardId, unit, label }));

  const matchedConcepts = conceptMatches.map((match) => ({
    id: match.id,
    title: cleanConceptTitle(match),
    type: match.type,
    unit: match.unit,
    score: match.score
  }));

  const units = unique([
    ...matchedConcepts.map((concept) => concept.unit),
    ...matchedStandards.map((standard) => standard.unit)
  ].filter(Boolean));

  return {
    question: String(question || ''),
    matchedConcepts,
    standards: matchedStandards,
    units,
    confidence: getConfidence(matchedConcepts, dedupeById(standardMatches, 'standardId'))
  };
}

function scoreKnowledgeItem(item, normalizedQuestion, questionTokens) {
  let score = 0;
  const matchedReasons = [];
  const normalizedTitle = normalizeForSearch(item.title);

  if (normalizedTitle && containsPhrase(normalizedQuestion, normalizedTitle)) {
    score += 10;
    matchedReasons.push('title');
  } else {
    const titleTokens = tokenizeForSearch(item.title);
    const titleOverlap = countTokenOverlap(questionTokens, titleTokens);
    if (titleOverlap > 0) {
      score += titleOverlap * 4;
      matchedReasons.push('title token');
    }
  }

  for (const topic of item.topics || []) {
    const normalizedTopic = normalizeForSearch(topic);
    if (normalizedTopic && containsPhrase(normalizedQuestion, normalizedTopic)) {
      score += normalizedTopic.includes(' ') ? 6 : 4;
      matchedReasons.push('topic');
    }
  }

  for (const trigger of item.questionTriggers || []) {
    const normalizedTrigger = normalizeForSearch(trigger);
    if (normalizedTrigger && containsPhrase(normalizedQuestion, normalizedTrigger)) {
      score += normalizedTrigger.includes(' ') ? 10 : 7;
      matchedReasons.push('question trigger');
    }
  }

  return {
    id: item.id,
    title: item.title,
    type: item.type,
    unit: item.unit,
    standards: Array.isArray(item.standards) ? item.standards : [],
    score,
    matchedReasons
  };
}

function scoreStandard(standard, normalizedQuestion, questionTokens, conceptScoreById) {
  let score = 0;
  const matchedReasons = [];

  for (const keyword of standard.keywords || []) {
    const normalizedKeyword = normalizeForSearch(keyword);
    if (normalizedKeyword === 'work' && isEverydayWorkQuestion(normalizedQuestion)) {
      continue;
    }

    if (normalizedKeyword && containsPhrase(normalizedQuestion, normalizedKeyword)) {
      score += normalizedKeyword.includes(' ') ? 6 : 3;
      matchedReasons.push('keyword');
    } else {
      const keywordOverlap = countTokenOverlap(questionTokens, tokenizeForSearch(keyword));
      if (keywordOverlap > 0) {
        score += keywordOverlap * 3;
        matchedReasons.push('keyword token');
      }
    }
  }

  const linkedConceptHits = (standard.linkedConcepts || [])
    .filter((conceptId) => conceptScoreById.has(conceptId));

  if (linkedConceptHits.length > 0) {
    score += linkedConceptHits.reduce((total, conceptId) => {
      return total + Math.min(8, Math.ceil(conceptScoreById.get(conceptId) / 3));
    }, 0);
    matchedReasons.push('linked concept');
  }

  const unitTokens = tokenizeForSearch(standard.unit);
  const unitOverlap = countTokenOverlap(questionTokens, unitTokens);
  if (unitOverlap > 0) {
    score += unitOverlap * 2;
    matchedReasons.push('unit');
  }

  return formatStandardMatch(standard, score, matchedReasons);
}

function formatStandardMatch(standard, score, matchedReasons) {
  return {
    standardId: standard.standardId,
    unit: standard.unit,
    label: standard.label,
    score,
    matchedReasons
  };
}

function buildEmptyResult(question) {
  return {
    question: String(question || ''),
    matchedConcepts: [],
    standards: [],
    units: [],
    confidence: 'none'
  };
}

function isEverydayWorkQuestion(normalizedQuestion) {
  return /\b(how|why)\s+(do|does|did)\b.*\bwork\b/.test(normalizedQuestion);
}

function getConfidence(concepts, standards) {
  const topConceptScore = concepts[0] ? concepts[0].score : 0;
  const topStandardScore = standards[0] ? standards[0].score : 0;
  const topScore = Math.max(topConceptScore, topStandardScore);

  if (topScore >= 10 || (topConceptScore >= 7 && topStandardScore >= 7)) return 'strong';
  if (topScore >= 3) return 'medium';
  if (topScore > 0) return 'weak';
  return 'none';
}

function cleanConceptTitle(match) {
  if (match.type === 'formula') {
    return String(match.title || '').replace(/\s+Formula$/i, '').trim() || match.title;
  }

  return match.title;
}

function normalizeForSearch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'=\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeForSearch(value) {
  return normalizeForSearch(value)
    .split(' ')
    .map((token) => token.replace(/^'+|'+$/g, '').replace(/'s$/g, ''))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function containsPhrase(haystack, phrase) {
  if (!haystack || !phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|\\s)${escaped}($|\\s)`);
  return pattern.test(haystack);
}

function countTokenOverlap(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  return unique(rightTokens).filter((token) => left.has(token)).length;
}

function dedupeById(items, idKey) {
  const byId = new Map();

  for (const item of items) {
    const existing = byId.get(item[idKey]);
    if (!existing || item.score > existing.score) {
      byId.set(item[idKey], item);
    }
  }

  return [...byId.values()];
}

function unique(values) {
  return [...new Set(values)];
}

function sortByScoreThenTitle(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return String(a.title || '').localeCompare(String(b.title || ''));
}

function sortByScoreThenStandardId(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return String(a.standardId || '').localeCompare(String(b.standardId || ''));
}

module.exports = {
  loadPhysicalSciencePack,
  matchQuestionToStandards
};
