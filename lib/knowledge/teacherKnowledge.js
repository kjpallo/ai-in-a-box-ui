const fs = require('node:fs');
const { normalize: normalizeQuestionText } = require('../router/classifyQuestion');
const { isApprovedKnowledgeItem } = require('./approvedKnowledgeIdentity');
const {
  inferCandidateTopics,
  inferTargetConcept
} = require('../router/questionContract');

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
        subject: String(item.subject || '').trim(),
        topic: String(item.topic || '').trim(),
        topics: uniqueTerms([
          item.topic,
          ...(Array.isArray(item.topics) ? item.topics : [])
        ]),
        aliases: uniqueTerms([
          ...(Array.isArray(item.aliases) ? item.aliases : []),
          ...(Array.isArray(item.synonyms) ? item.synonyms : [])
        ]),
        targetConcept: String(
          item.targetConcept || item.target_concept || item.concept || ''
        ).trim(),
        terms: Array.isArray(item.terms) ? item.terms : [],
        fact: item.fact || item.definition || item.text || '',
        formula: item.formula || '',
        examples: Array.isArray(item.examples) ? item.examples : [],
        source: item.source || 'Teacher-created local knowledge base',
        provenance: clonePlainObject(item.provenance),
        reviewStatus: String(item.reviewStatus || '').trim(),
        reviewState: String(item.reviewState || '').trim(),
        sourceQuality: String(
          item.sourceQuality || item.source_quality || item.confidence || ''
        ).trim(),
        confidence: String(item.confidence || '').trim()
      }))
      .filter((item) => item.fact || item.formula);
  } catch (error) {
    console.error('Could not load teacher knowledge:', error);
    return [];
  }
}

function findRelevantKnowledge(message, knowledgeItems, maxItems = 6, options = {}) {
  const normalizedMessage = expandComparisonSearchPhrases(normalizeForSearch(message));

  if (!normalizedMessage || !knowledgeItems.length) return [];

  const questionContract = resolveQuestionContract(options);
  const directDefinitionTarget = getDirectDefinitionTarget(normalizedMessage);
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
        item.topic,
        ...(item.topics || []),
        item.category,
        item.title,
        item.fact,
        item.source,
        ...(item.aliases || []),
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
      const knowledgeTopics = inferKnowledgeTopics(item);
      const knowledgeConcepts = inferKnowledgeConcepts(item);
      const contractCompatibility = assessContractCompatibility({
        questionContract,
        knowledgeTopics,
        knowledgeConcepts,
        item
      });

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
        strongEnoughMatch,
        knowledgeTopics,
        knowledgeConcepts,
        topicCompatibility: contractCompatibility.topic,
        targetCompatibility: contractCompatibility.target,
        contractCompatible: contractCompatibility.compatible,
        compatibilityReasons: contractCompatibility.reasons
      };
    })
    .filter((item) =>
      item.score > 0 &&
      item.contractCompatible !== false &&
      (!isApprovedKnowledgeItem(item) || item.strongEnoughMatch)
    )
    .sort((a, b) => {
      const definitionPriorityDifference =
        getDirectDefinitionPriority(b, directDefinitionTarget) -
        getDirectDefinitionPriority(a, directDefinitionTarget);
      if (definitionPriorityDifference !== 0) return definitionPriorityDifference;
      return b.score - a.score;
    })
    .slice(0, maxItems);
}

function resolveQuestionContract(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return null;
  if (options.questionContract && typeof options.questionContract === 'object') {
    return options.questionContract;
  }
  if (options.taskType || options.candidateTopics || options.targetConcept) {
    return options;
  }
  return null;
}

function getDirectDefinitionTarget(normalizedMessage) {
  const match = /^(?:what|who)\s+(?:is|are)\s+(?:an?\s+|the\s+)?(.+?)\s*[?.!]*$/.exec(
    String(normalizedMessage || '').trim()
  );
  return match ? normalizeForSearch(match[1]) : '';
}

function getDirectDefinitionPriority(item = {}, directDefinitionTarget = '') {
  if (!directDefinitionTarget) return 0;
  const title = normalizeForSearch(item.title);
  if (title !== directDefinitionTarget) return 0;
  const category = normalizeForSearch(item.category);
  if (category.includes('vocabulary') || category.includes('definition')) return 2;
  return 1;
}

function inferKnowledgeTopics(item = {}) {
  const explicitTopics = uniqueTerms([
    item.topic,
    ...(Array.isArray(item.topics) ? item.topics : [])
  ])
    .map(canonicalTopic)
    .filter(isKnownScienceTopic);
  if (explicitTopics.length > 0) return explicitTopics;

  const sourceText = [
    item.subject,
    item.category,
    item.title,
    ...(item.aliases || []),
    ...(item.terms || []),
    item.fact,
    item.formula
  ].filter(Boolean).join(' ');
  const inferredTopics = inferCandidateTopics(sourceText)
    .map(canonicalTopic)
    .filter((topic) => topic && topic !== 'unknown');
  return uniqueTerms(inferredTopics);
}

function inferKnowledgeConcepts(item = {}) {
  const primaryText = [
    item.targetConcept,
    item.title,
    ...(item.aliases || []),
    ...(item.terms || [])
  ].filter(Boolean).join(' ');
  const explicit = canonicalConcept(item.targetConcept);
  const inferred = canonicalConcept(inferTargetConcept(
    `What is ${primaryText}?`
  ));
  return uniqueTerms([
    explicit,
    inferred,
    ...detectPrimaryKnowledgeConcepts(primaryText)
  ]);
}

function assessContractCompatibility({
  questionContract,
  knowledgeTopics,
  knowledgeConcepts,
  item
}) {
  if (!questionContract) {
    return {
      compatible: true,
      topic: 'not_checked',
      target: 'not_checked',
      reasons: []
    };
  }

  const questionTopics = uniqueTerms(
    Array.isArray(questionContract.candidateTopics)
      ? questionContract.candidateTopics
      : []
  )
    .map(canonicalTopic)
    .filter((topic) => topic && topic !== 'unknown');
  const itemTopics = uniqueTerms(knowledgeTopics || [])
    .map(canonicalTopic)
    .filter(isKnownScienceTopic);
  const reasons = [];
  let topic = 'neutral';
  let target = 'neutral';

  if (questionTopics.length > 0 && itemTopics.length > 0) {
    const compatibleTopic = questionTopics.some((questionTopic) =>
      itemTopics.some((itemTopic) => topicsAreCompatible(questionTopic, itemTopic))
    );
    topic = compatibleTopic ? 'compatible' : 'conflict';
    if (!compatibleTopic) {
      reasons.push(
        `question topics ${questionTopics.join(', ')} conflict with evidence topics ${itemTopics.join(', ')}`
      );
    }
  }

  const targetConcept = canonicalConcept(questionContract.targetConcept);
  const itemConcepts = uniqueTerms(knowledgeConcepts || []).map(canonicalConcept);
  if (targetConcept && itemConcepts.includes(targetConcept)) {
    target = 'compatible';
  } else if (
    targetConcept &&
    hasExplicitTargetConflict(targetConcept, itemConcepts, item)
  ) {
    target = 'conflict';
    reasons.push(
      `target concept ${targetConcept} conflicts with evidence concept ${itemConcepts.join(', ') || item.title || 'unknown'}`
    );
  }

  return {
    compatible: topic !== 'conflict' && target !== 'conflict',
    topic,
    target,
    reasons
  };
}

function canonicalTopic(value) {
  const topic = normalizeForSearch(value).replace(/\s+/g, '_');
  const aliases = {
    atomic: 'atomic_structure',
    atoms: 'atomic_structure',
    chemistry: 'atomic_structure',
    circuit: 'circuits',
    electrical: 'circuits',
    electricity: 'circuits',
    electricity_and_magnetism: 'circuits',
    force: 'forces',
    newton_laws: 'newtons_laws',
    newtons_law: 'newtons_laws',
    periodic_table: 'atomic_structure'
  };
  return aliases[topic] || topic;
}

function topicsAreCompatible(left, right) {
  if (left === right) return true;
  const topicFamilies = [
    new Set(['forces', 'newtons_laws']),
    new Set(['atomic_structure', 'chemistry']),
    new Set(['circuits', 'electricity'])
  ];
  return topicFamilies.some((family) => family.has(left) && family.has(right));
}

function isKnownScienceTopic(topic) {
  return new Set([
    'atomic_structure',
    'chemistry',
    'circuits',
    'electricity',
    'energy',
    'forces',
    'gravity',
    'matter',
    'measurement',
    'motion',
    'newtons_laws',
    'waves'
  ]).has(topic);
}

function canonicalConcept(value) {
  const concept = normalizeForSearch(value).replace(/\s+/g, '_');
  const aliases = {
    current: 'electric_current',
    earth_gravity: 'earth_surface_gravity',
    gravitational_acceleration: 'earth_surface_gravity',
    lunar_gravity: 'moon_gravity',
    newton_first_law: 'newtons_first_law',
    physical_property: 'physical_properties',
    voltage: 'voltage_difference'
  };
  return aliases[concept] || concept;
}

function detectPrimaryKnowledgeConcepts(value) {
  const text = normalizeForSearch(value);
  const patterns = [
    [/\bperiodic table\b/, 'periodic_table'],
    [/\bnewtons? first law\b|\bfirst law of motion\b/, 'newtons_first_law'],
    [/\bvoltage difference\b|\belectric potential difference\b|\bvoltage\b/, 'voltage_difference'],
    [/\belectric fields?\b/, 'electric_field'],
    [/\belectric current\b|\bcurrent electricity\b/, 'electric_current'],
    [/\bconductors?\b/, 'conductor'],
    [/\bthermal energy\b/, 'thermal_energy'],
    [/\bgravitational potential energy\b|\bgpe\b/, 'gravitational_potential_energy'],
    [/\bgravity (?:near|on) earth\b|\bearth gravity\b|\bacceleration due to gravity\b/, 'earth_surface_gravity'],
    [/\bmoon gravity\b|\bgravity on the moon\b|\blunar gravity\b/, 'moon_gravity'],
    [/\bbalanced forces?\b/, 'balanced_forces'],
    [/\bunbalanced forces?\b/, 'unbalanced_forces'],
    [/\bnet force\b/, 'net_force'],
    [/\bforce\b/, 'force']
  ];
  return uniqueTerms(
    patterns
      .filter(([pattern]) => pattern.test(text))
      .map(([, concept]) => concept)
  );
}

function hasExplicitTargetConflict(targetConcept, itemConcepts, item = {}) {
  const conflicts = {
    force: ['voltage_difference', 'electric_field'],
    voltage_difference: ['force', 'electric_field'],
    electric_field: ['voltage_difference'],
    electric_current: ['conductor'],
    conductor: ['electric_current'],
    thermal_energy: ['gravitational_potential_energy'],
    gravitational_potential_energy: ['thermal_energy'],
    moon_gravity: ['earth_surface_gravity'],
    earth_surface_gravity: ['moon_gravity'],
    newtons_first_law: ['periodic_table'],
    periodic_table: ['newtons_first_law']
  };
  const conflictingConcepts = new Set(conflicts[targetConcept] || []);
  if (itemConcepts.some((concept) => conflictingConcepts.has(concept))) return true;

  const primary = normalizeForSearch([
    item.title,
    ...(item.aliases || []),
    ...(item.terms || [])
  ].join(' '));
  if (targetConcept === 'newtons_first_law') return /\bperiodic table\b/.test(primary);
  if (targetConcept === 'periodic_table') return /\bnewtons? first law\b/.test(primary);
  return false;
}

function expandComparisonSearchPhrases(normalizedMessage) {
  const text = String(normalizedMessage || '').trim();
  if (!text) return '';

  const additions = [];
  if (/\bnewtons?\b/.test(text) && /\blaws?\b/.test(text)) {
    if (/\b(?:first|1st|one)\b/.test(text)) {
      additions.push('newtons first law', 'newton first law');
    }
    if (/\b(?:second|2nd|two)\b/.test(text)) {
      additions.push('newtons second law', 'newton second law');
    }
    if (/\b(?:third|3rd|three)\b/.test(text)) {
      additions.push('newtons third law', 'newton third law');
    }
  }

  if (/\b(?:voltage|volt|volts)\b/.test(text) && /\b(?:current|amp|amps|amperes?)\b/.test(text)) {
    additions.push('ohms law voltage current resistance');
  }

  return additions.length ? `${text} ${additions.join(' ')}` : text;
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
  return normalizeQuestionText(value);
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
        const meaningfulTokens = phraseTokens.filter((token) => token.length >= 3 && !stopWords.has(token));
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

function clonePlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  loadTeacherKnowledge,
  findRelevantKnowledge,
  formatKnowledgeForPrompt
};
