const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PACK_DIR = path.join(__dirname, '..', '..', 'knowledge', 'packs', 'physical-science');
const DEFAULT_STANDARDS_DIR = path.join(__dirname, '..', '..', 'knowledge', 'standards');
const DEFAULT_BANK_PATH = path.join(DEFAULT_STANDARDS_DIR, 'missouri_science_6_12_standards.json');
const DEFAULT_PROFILES_PATH = path.join(DEFAULT_STANDARDS_DIR, 'course_profiles.json');
const DEFAULT_MAX_CONCEPTS = 5;
const DEFAULT_MAX_STANDARDS = 5;
const DEFAULT_MAX_POSSIBLE_STANDARDS = 5;
const PRIMARY_INACTIVE_THRESHOLD = 34;
const PRIMARY_RAW_SCORE_THRESHOLD = 8;
const PRIMARY_WEIGHTED_SCORE_THRESHOLD = 10;

const RELEVANCE_RANK = {
  core: 4,
  supporting: 3,
  available_off: 2,
  out_of_course: 1
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'from',
  'how', 'i', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'was', 'what',
  'when', 'where', 'which', 'who', 'why', 'with'
]);
const GENERIC_SINGLE_WORD_TRIGGERS = new Set([
  'atom',
  'cells',
  'change',
  'current',
  'design',
  'ecosystem',
  'engineering',
  'energy',
  'force',
  'frequency',
  'gravity',
  'mass',
  'matter',
  'moon',
  'sun',
  'wave'
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

function loadMissouriStandardsBank(bankPath = DEFAULT_BANK_PATH) {
  const raw = JSON.parse(fs.readFileSync(bankPath, 'utf8'));

  return {
    bankId: raw.bankId || 'missouri_science_6_12',
    title: raw.title || 'Missouri Science 6-12 Standards',
    source: raw.source || {},
    standards: Array.isArray(raw.standards) ? raw.standards : []
  };
}

function loadCourseProfiles(profilesPath = DEFAULT_PROFILES_PATH) {
  const raw = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));

  return {
    defaultProfileId: raw.defaultProfileId || 'physical_science',
    profiles: Array.isArray(raw.profiles) ? raw.profiles : []
  };
}

function matchQuestionToStandards(question, options = {}) {
  if (options.pack || options.useSamplePack) {
    return matchQuestionToSamplePack(question, options);
  }

  try {
    return matchQuestionToStandardsBank(question, options);
  } catch (error) {
    try {
      return matchQuestionToSamplePack(question, options);
    } catch {
      return {
        ...buildEmptyResult(question),
        standardsError: error?.message || String(error || 'Unable to load standards bank')
      };
    }
  }
}

function matchQuestionToStandardsBank(question, options = {}) {
  const bank = options.bank || loadMissouriStandardsBank(options.bankPath);
  const profiles = options.courseProfiles || loadCourseProfiles(options.profilesPath);
  const profile = resolveCourseProfile(profiles, options.courseProfileId);
  const normalizedQuestion = normalizeForSearch(question);
  const questionTokens = tokenizeForSearch(question);
  const maxConcepts = options.maxConcepts || DEFAULT_MAX_CONCEPTS;
  const maxStandards = options.maxStandards || DEFAULT_MAX_STANDARDS;
  const maxPossibleStandards = options.maxPossibleStandards || DEFAULT_MAX_POSSIBLE_STANDARDS;
  const includeInactiveStandards = Boolean(options.includeInactiveStandards);

  if (!normalizedQuestion) {
    return {
      ...buildEmptyResult(question),
      courseProfileId: profile?.profileId || profiles.defaultProfileId,
      bankId: bank.bankId
    };
  }

  const supplementalConcepts = loadSupplementalKnowledgeItems(options);
  const conceptMatches = supplementalConcepts
    .map((item) => scoreKnowledgeItem(item, normalizedQuestion, questionTokens))
    .filter((match) => match.score > 0)
    .sort(sortByScoreThenTitle)
    .slice(0, maxConcepts);

  const conceptScoreById = new Map(conceptMatches.map((match) => [match.id, match.score]));
  const standardMatches = bank.standards
    .map((standard) => scoreBankStandard(standard, normalizedQuestion, questionTokens, conceptScoreById, profile))
    .filter((match) => match.rawScore > 0);

  const dedupedMatches = dedupeById(standardMatches, 'standardId').sort(sortByScoreThenStandardId);
  const primaryMatches = dedupedMatches
    .filter((match) => isPrimaryStandardMatch(match, includeInactiveStandards))
    .slice(0, maxStandards);
  const primaryIds = new Set(primaryMatches.map((match) => match.standardId));
  const possibleMatches = dedupedMatches
    .filter((match) => !primaryIds.has(match.standardId))
    .filter((match) => {
      return match.score >= 3 ||
        match.rawScore >= 10 ||
        (match.courseRelevance === 'available_off' && match.hasStrongPhraseMatch && match.rawScore >= 6);
    })
    .slice(0, maxPossibleStandards);

  const matchedStandards = primaryMatches.map(compactStandardMatch);
  const possibleStandards = possibleMatches.map(compactStandardMatch);
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
    confidence: getProfileConfidence(matchedConcepts, primaryMatches, possibleMatches),
    possibleStandards,
    courseProfileId: profile?.profileId || profiles.defaultProfileId,
    bankId: bank.bankId
  };
}

function matchQuestionToSamplePack(question, options = {}) {
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
    .map((standard) => scoreSampleStandard(standard, normalizedQuestion, questionTokens, conceptScoreById))
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
    confidence: getSampleConfidence(matchedConcepts, dedupeById(standardMatches, 'standardId'))
  };
}

function resolveCourseProfile(courseProfiles, requestedProfileId) {
  const profiles = Array.isArray(courseProfiles?.profiles) ? courseProfiles.profiles : [];
  const profileId = requestedProfileId || courseProfiles?.defaultProfileId;

  return profiles.find((profile) => profile.profileId === profileId) || profiles[0] || null;
}

function loadSupplementalKnowledgeItems(options = {}) {
  if (Array.isArray(options.knowledgeItems)) return options.knowledgeItems;
  if (options.disableSupplementalConcepts) return [];

  try {
    return loadPhysicalSciencePack(options.packDir).knowledgeItems;
  } catch {
    return [];
  }
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

function scoreBankStandard(standard, normalizedQuestion, questionTokens, conceptScoreById, profile) {
  let rawScore = 0;
  const matchedReasons = [];
  const evidence = createEvidenceTracker();

  rawScore += scorePhraseList([
    ...(standard.exactTriggers || []),
    ...(standard.questionTriggers || [])
  ], normalizedQuestion, questionTokens, {
    phraseScore: 12,
    tokenScore: 4,
    allowTokenFallback: false,
    reason: 'exactTrigger',
    matchedReasons,
    evidence
  });
  rawScore += scorePhraseList(standard.relatedFormulas, normalizedQuestion, questionTokens, {
    phraseScore: 12,
    tokenScore: 5,
    reason: 'relatedFormula',
    matchedReasons,
    evidence
  });
  rawScore += scorePhraseList(standard.strongKeywords, normalizedQuestion, questionTokens, {
    phraseScore: 8,
    tokenScore: 3,
    reason: 'strongKeyword',
    matchedReasons,
    evidence
  });
  rawScore += scorePhraseList([
    ...(standard.supportingKeywords || []),
    ...(standard.keywords || [])
  ], normalizedQuestion, questionTokens, {
    phraseScore: 6,
    tokenScore: 2,
    reason: 'strongKeyword',
    matchedReasons,
    evidence
  });
  rawScore += scorePhraseList(standard.weakContextTerms, normalizedQuestion, questionTokens, {
    phraseScore: 1,
    tokenScore: 1,
    reason: 'weakKeyword',
    matchedReasons,
    evidence
  });
  rawScore += scorePhraseList([
    standard.standardId,
    standard.officialLabel,
    standard.strandTitle,
    standard.conceptTitle,
    standard.unit,
    standard.classroomArea,
    ...(standard.courseTags || [])
  ], normalizedQuestion, questionTokens, {
    phraseScore: 3,
    tokenScore: 1,
    reason: 'metadata',
    matchedReasons,
    evidence
  });

  const statementOverlap = countTokenOverlap(questionTokens, tokenizeForSearch(standard.statement));
  if (statementOverlap > 0) {
    const statementScore = standard.officialStatementVerified
      ? Math.min(4, statementOverlap)
      : Math.min(2, statementOverlap);
    rawScore += statementScore;
    matchedReasons.push('statementWeak');
    evidence.statementWeak += 1;
  }

  const linkedConceptHits = (standard.linkedConcepts || [])
    .filter((conceptId) => conceptScoreById.has(conceptId));

  if (linkedConceptHits.length > 0) {
    const linkedScore = linkedConceptHits.reduce((total, conceptId) => {
      return total + Math.min(8, Math.ceil(conceptScoreById.get(conceptId) / 3));
    }, 0);
    rawScore += linkedScore;
    matchedReasons.push('linkedConcept');
    evidence.linkedConcept += linkedConceptHits.length;
  }

  const antiKeywordHits = countPhraseHits(standard.antiKeywords, normalizedQuestion);
  if (antiKeywordHits > 0) {
    rawScore = Math.max(0, rawScore - (antiKeywordHits * 8));
    matchedReasons.push('antiKeyword');
    evidence.antiKeyword += antiKeywordHits;
  }

  const courseRelevance = getCourseRelevance(standard, profile);
  const relevanceWeights = profile?.relevanceWeights || {};
  const weight = Number(relevanceWeights[courseRelevance]) || 1;
  const score = roundOneDecimal(rawScore * weight);

  return formatBankStandardMatch(standard, {
    rawScore,
    score,
    courseRelevance,
    matchedReasons,
    normalizedQuestion,
    evidence
  });
}

function scoreSampleStandard(standard, normalizedQuestion, questionTokens, conceptScoreById) {
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

function scorePhraseList(values, normalizedQuestion, questionTokens, {
  phraseScore,
  tokenScore,
  allowTokenFallback = true,
  reason,
  matchedReasons,
  evidence
}) {
  let score = 0;

  for (const value of values || []) {
    const normalizedValue = normalizeForSearch(value);
    if (normalizedValue === 'work' && isEverydayWorkQuestion(normalizedQuestion)) {
      continue;
    }

    if (
      reason === 'exactTrigger' &&
      GENERIC_SINGLE_WORD_TRIGGERS.has(normalizedValue)
    ) {
      continue;
    }

    if (normalizedValue && containsPhrase(normalizedQuestion, normalizedValue)) {
      const hasGenericSingleWord = isGenericSingleWord(normalizedValue);
      if (hasGenericSingleWord || reason === 'weakKeyword') {
        score += 1;
        matchedReasons.push('weakKeyword');
        if (evidence) evidence.weakKeyword += 1;
      } else {
        score += normalizedValue.includes(' ') ? phraseScore : Math.ceil(phraseScore * 0.6);
        matchedReasons.push(reason);
        trackEvidence(reason, normalizedValue, evidence);
      }
    } else if (allowTokenFallback) {
      const valueTokens = tokenizeForSearch(value);
      const overlap = countTokenOverlap(
        questionTokens.filter((token) => !GENERIC_SINGLE_WORD_TRIGGERS.has(token)),
        valueTokens.filter((token) => !GENERIC_SINGLE_WORD_TRIGGERS.has(token))
      );
      const hasEnoughTokenContext = valueTokens.length <= 1 ? overlap > 0 : overlap >= 2;
      if (hasEnoughTokenContext) {
        score += overlap * tokenScore;
        matchedReasons.push(`${reason} token`);
        if (evidence && reason !== 'metadata') evidence.supportingKeyword += 1;
      }
    }
  }

  return score;
}

function getCourseRelevance(standard, profile) {
  if (!profile) return 'core';
  if (matchesAnyFilter(standard, profile.activeCoreFilters)) return 'core';
  if (matchesAnyFilter(standard, profile.activeSupportingFilters)) return 'supporting';
  if (matchesAnyFilter(standard, profile.availableOffFilters)) return 'available_off';
  return 'out_of_course';
}

function matchesAnyFilter(standard, filters) {
  return Array.isArray(filters) && filters.some((filter) => matchesFilter(standard, filter));
}

function matchesFilter(standard, filter) {
  if (!filter || typeof filter !== 'object') return false;

  return Object.entries(filter).every(([key, value]) => {
    const expected = String(value || '').toLowerCase();
    const actual = String(standard?.[key] || '').toLowerCase();
    return expected === actual;
  });
}

function isPrimaryStandardMatch(match, includeInactiveStandards) {
  if (match.courseRelevance === 'core' || match.courseRelevance === 'supporting') {
    if (match.standardId === '9-12.PS1.A.3' && match.hasDensitySignal) return false;
    return hasPrimaryStrength(match);
  }
  if (includeInactiveStandards) return true;
  return match.score >= PRIMARY_INACTIVE_THRESHOLD;
}

function hasPrimaryStrength(match) {
  if (!hasPrimaryEvidence(match)) return false;

  if (match.standardId === '9-12.PS2.A.1') {
    return Boolean(match.hasExactQuestionTrigger || match.rawScore >= 13 || match.score >= 16);
  }

  return Boolean(
    match.hasExactQuestionTrigger ||
    match.rawScore >= PRIMARY_RAW_SCORE_THRESHOLD ||
    match.score >= PRIMARY_WEIGHTED_SCORE_THRESHOLD
  );
}

function hasPrimaryEvidence(match) {
  if (match.hasExactQuestionTrigger || match.hasRelatedFormula) return true;
  if (match.hasStrongPhraseMatch && match.rawScore >= PRIMARY_RAW_SCORE_THRESHOLD) return true;
  if (match.standardSpecificSignalCount >= 2 && match.rawScore >= PRIMARY_RAW_SCORE_THRESHOLD) return true;
  return Boolean(
    match.hasLinkedConcept &&
    match.hasCompatibleSpecificKeyword &&
    match.rawScore >= PRIMARY_RAW_SCORE_THRESHOLD
  );
}

function compactStandardMatch(match) {
  return {
    standardId: match.standardId,
    unit: match.unit,
    label: match.label,
    score: match.score,
    courseRelevance: match.courseRelevance,
    gradeBand: match.gradeBand,
    domainCode: match.domainCode,
    strandCode: match.strandCode,
    strandTitle: match.strandTitle,
    conceptTitle: match.conceptTitle,
    classroomArea: match.classroomArea,
    reasonSummary: match.reasonSummary
  };
}

function formatBankStandardMatch(standard, {
  rawScore,
  score,
  courseRelevance,
  matchedReasons,
  normalizedQuestion,
  evidence
}) {
  const standardSpecificSignalCount = (evidence.exactTrigger || 0) +
    (evidence.strongKeyword || 0) +
    (evidence.relatedFormula || 0) +
    (evidence.linkedConcept || 0);

  return {
    standardId: standard.standardId,
    unit: standard.unit,
    label: standard.officialLabel || standard.standardId,
    gradeBand: standard.gradeBand,
    domainCode: standard.domainCode,
    strandCode: standard.strandCode,
    strandTitle: standard.strandTitle,
    conceptTitle: standard.conceptTitle,
    classroomArea: standard.classroomArea,
    courseRelevance,
    score,
    rawScore,
    matchedReasons,
    hasExactQuestionTrigger: evidence.exactTrigger > 0,
    hasStrongPhraseMatch: evidence.strongPhrase > 0,
    hasRelatedFormula: evidence.relatedFormula > 0,
    hasLinkedConcept: evidence.linkedConcept > 0,
    hasCompatibleSpecificKeyword: evidence.strongKeyword > 0 || evidence.supportingKeyword > 0,
    standardSpecificSignalCount,
    hasDensitySignal: /\b(density|mass per volume)\b/.test(normalizedQuestion),
    reasonSummary: summarizeReasons(matchedReasons)
  };
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

function summarizeReasons(reasons) {
  return unique(reasons || []).slice(0, 4).join(', ');
}

function createEvidenceTracker() {
  return {
    exactTrigger: 0,
    strongKeyword: 0,
    supportingKeyword: 0,
    weakKeyword: 0,
    metadata: 0,
    statementWeak: 0,
    relatedFormula: 0,
    linkedConcept: 0,
    antiKeyword: 0,
    strongPhrase: 0
  };
}

function trackEvidence(reason, normalizedValue, evidence) {
  if (!evidence) return;
  if (reason === 'exactTrigger') evidence.exactTrigger += 1;
  if (reason === 'strongKeyword') {
    evidence.strongKeyword += 1;
    if (normalizedValue.includes(' ')) evidence.strongPhrase += 1;
  }
  if (reason === 'relatedFormula') evidence.relatedFormula += 1;
  if (reason === 'metadata') evidence.metadata += 1;
}

function isGenericSingleWord(value) {
  return Boolean(value && !value.includes(' ') && GENERIC_SINGLE_WORD_TRIGGERS.has(value));
}

function countPhraseHits(values, normalizedQuestion) {
  return (values || []).filter((value) => {
    const normalizedValue = normalizeForSearch(value);
    return normalizedValue && containsPhrase(normalizedQuestion, normalizedValue);
  }).length;
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

function getProfileConfidence(concepts, primaryStandards, possibleStandards) {
  const topConceptScore = concepts[0] ? concepts[0].score : 0;
  const topPrimary = primaryStandards[0];
  const topPossible = possibleStandards[0];
  const topPrimaryScore = topPrimary ? topPrimary.score : 0;
  const topPossibleScore = topPossible ? topPossible.score : 0;
  const hasActivePrimary = Boolean(
    topPrimary &&
    (topPrimary.courseRelevance === 'core' || topPrimary.courseRelevance === 'supporting')
  );

  if (
    hasActivePrimary &&
    (topPrimaryScore >= 16 || topPrimary.rawScore >= 13)
  ) {
    return 'strong';
  }

  if (hasActivePrimary && (topPrimaryScore >= 8 || topPrimary.rawScore >= PRIMARY_RAW_SCORE_THRESHOLD)) {
    return 'medium';
  }

  if (topConceptScore >= 10 && topPossibleScore > 0) return 'medium';
  if (topConceptScore >= 7 || topPossibleScore >= 5 || topPrimaryScore > 0) return 'medium';
  if (topPrimaryScore > 0 || topConceptScore > 0 || topPossibleScore > 0) return 'weak';
  return 'none';
}

function getSampleConfidence(concepts, standards) {
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

function roundOneDecimal(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function sortByScoreThenTitle(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return String(a.title || '').localeCompare(String(b.title || ''));
}

function sortByScoreThenStandardId(a, b) {
  const scoreDelta = Math.abs((b.score || 0) - (a.score || 0));
  if (scoreDelta > 3) return (b.score || 0) - (a.score || 0);

  const relevanceDelta = (RELEVANCE_RANK[b.courseRelevance] || 0) - (RELEVANCE_RANK[a.courseRelevance] || 0);
  if (relevanceDelta !== 0) return relevanceDelta;

  if (b.score !== a.score) return (b.score || 0) - (a.score || 0);
  return String(a.standardId || '').localeCompare(String(b.standardId || ''));
}

module.exports = {
  loadCourseProfiles,
  loadMissouriStandardsBank,
  loadPhysicalSciencePack,
  matchQuestionToStandards
};
