const { loadApprovedKnowledgePacks } = require('./loadApprovedKnowledgePacks');
const { loadApprovedPackActivation } = require('./approvedPackActivationStore');

const APPROVED_STATUS = 'approved';

function loadEnabledApprovedKnowledgeItems(options = {}) {
  const items = [];

  loadEnabledApprovedKnowledgePackRecords(options).forEach((record) => {
    items.push(...mapVocabularyItems(record));
    items.push(...mapConceptItems(record));
    items.push(...mapProblemItems(record));
  });

  return items;
}

function loadEnabledApprovedKnowledgePackRecords(options = {}) {
  const approved = loadApprovedKnowledgePacks({
    approvedPacksDir: options.approvedPacksDir,
    includeFixtures: options.includeFixtures === true,
    includeExamples: options.includeExamples === true,
    validationOptions: options.validationOptions || {}
  });
  const activation = loadApprovedPackActivation({
    approvedPacksDir: options.approvedPacksDir
  });

  return approved.packs.filter((record) => {
    const packId = String(record.packId || '').trim();
    if (!packId) return false;

    const activationRecord = activation.packs[packId] || {};
    return activationRecord.enabled === true;
  });
}

function mapVocabularyItems(record) {
  const vocabulary = Array.isArray(record.pack && record.pack.vocabulary)
    ? record.pack.vocabulary
    : [];

  return vocabulary
    .filter((item) => item && item.reviewStatus === APPROVED_STATUS)
    .map((item, index) => {
      const term = String(item.term || '').trim();
      const definition = firstNonEmptyString([
        item.studentDefinition,
        item.teacherDefinition,
        item.sourceTextSnippet
      ]);
      const fact = makeVocabularySentence(term, definition);
      const targetConcept = firstNonEmptyString([item.targetConcept, term]);

      return {
        id: `approved-pack:${record.packId}:vocabulary:${index + 1}`,
        category: 'approved_vocabulary',
        title: term || `Vocabulary ${index + 1}`,
        subject: String(record.subject || '').trim(),
        gradeLevel: String(record.gradeLevel || '').trim(),
        answerContext: inferAnswerContext(record),
        terms: uniqueTerms([
          term,
          ...(Array.isArray(item.aliases) ? item.aliases : []),
          ...extractDefinitionSearchTerms(definition)
        ]),
        fact,
        formula: '',
        examples: uniqueTerms([
          item.exampleQuestion,
          item.exampleAnswer
        ]),
        source: buildSourceLabel(record, item),
        ...buildApprovedMetadata(record, item, targetConcept)
      };
    })
    .filter((item) => item.fact);
}

function mapConceptItems(record) {
  const concepts = Array.isArray(record.pack && record.pack.concepts)
    ? record.pack.concepts
    : [];

  return concepts
    .filter((item) => item && item.reviewStatus === APPROVED_STATUS)
    .map((item, index) => {
      const explanation = firstNonEmptyString([
        item.studentExplanation,
        firstArrayValue(item.keyIdeas),
        item.sourceTextSnippet
      ]);
      const targetConcept = firstNonEmptyString([
        item.targetConcept,
        item.title,
        item.conceptId
      ]);

      return {
        id: `approved-pack:${record.packId}:concept:${index + 1}`,
        category: 'approved_concept',
        title: String(item.title || '').trim() || `Concept ${index + 1}`,
        subject: String(record.subject || '').trim(),
        gradeLevel: String(record.gradeLevel || '').trim(),
        answerContext: inferAnswerContext(record),
        terms: uniqueTerms([item.title, ...(Array.isArray(item.aliases) ? item.aliases : [])]),
        fact: toSentence(explanation),
        formula: '',
        examples: sanitizeStringArray(item.examples),
        source: buildSourceLabel(record, item),
        ...buildApprovedMetadata(record, item, targetConcept)
      };
    })
    .filter((item) => item.fact);
}

function mapProblemItems(record) {
  const problemBank = Array.isArray(record.pack && record.pack.problemBank)
    ? record.pack.problemBank
    : [];

  return problemBank
    .filter((item) => item && item.reviewStatus === APPROVED_STATUS)
    .map((item, index) => {
      const question = String(item.question || '').trim();
      const answer = toSentence(item.expectedAnswer);
      const fact = answer;
      const targetConcept = inferProblemTargetConcept(record, item);

      return {
        id: `approved-pack:${record.packId}:problem:${index + 1}`,
        category: 'approved_problem_bank',
        title: String(item.problemId || '').trim() || `Problem ${index + 1}`,
        subject: String(record.subject || '').trim(),
        gradeLevel: String(record.gradeLevel || '').trim(),
        answerContext: inferAnswerContext(record),
        terms: uniqueTerms(extractProblemSearchTerms(question)),
        fact,
        formula: '',
        examples: [],
        source: buildSourceLabel(record, item),
        ...buildApprovedMetadata(record, item, targetConcept)
      };
    })
    .filter((item) => item.fact);
}

function buildApprovedMetadata(record = {}, item = {}, targetConcept = '') {
  const subject = String(record.subject || record.pack && record.pack.subject || '').trim();
  const packTopic = firstNonEmptyString([
    record.pack && record.pack.topic,
    record.pack && record.pack.unitTitle,
    record.pack && record.pack.moduleTitle
  ]);
  const topic = firstNonEmptyString([
    item.topic,
    firstArrayValue(item.topics),
    packTopic
  ]);
  const aliases = sanitizeStringArray(item.aliases);
  const confidence = firstNonEmptyString([item.confidence]);
  const sourceQuality = firstNonEmptyString([
    item.sourceQuality,
    confidence,
    findSourceFileConfidence(record, item.sourceFile)
  ]);
  const reviewStatus = firstNonEmptyString([item.reviewStatus, APPROVED_STATUS]);
  const reviewState = firstNonEmptyString([item.reviewState, reviewStatus]);
  const packId = String(record.packId || '').trim();
  const packTitle = String(record.title || record.pack && record.pack.title || '').trim();
  const packVersion = String(record.version || record.pack && record.pack.version || '').trim();
  const sourceFile = String(item.sourceFile || '').trim();
  const sourceLocation = String(item.sourceLocation || '').trim();

  return {
    subject,
    topic,
    topics: uniqueTerms([
      ...(Array.isArray(item.topics) ? item.topics : []),
      item.topic,
      packTopic
    ]),
    aliases,
    targetConcept: String(targetConcept || '').trim(),
    standards: sanitizeStringArray(item.standards),
    reviewStatus,
    reviewState,
    sourceQuality,
    confidence,
    sourceFile,
    sourceLocation,
    packId,
    packTitle,
    packVersion,
    provenance: {
      type: 'approved_knowledge_pack',
      packId,
      packTitle,
      packVersion,
      sourceFile,
      sourceLocation
    }
  };
}

function inferProblemTargetConcept(record = {}, item = {}) {
  const direct = firstNonEmptyString([
    item.targetConcept,
    item.concept,
    item.conceptId,
    firstArrayValue(item.concepts),
    firstArrayValue(item.relatedConcepts)
  ]);
  if (direct) return resolveConceptTitle(record, direct);

  const standardIds = new Set(sanitizeStringArray(item.standards).map((value) => value.toLowerCase()));
  if (!standardIds.size) return '';

  const standardsMap = Array.isArray(record.pack && record.pack.standardsMap)
    ? record.pack.standardsMap
    : [];
  const relatedConcepts = uniqueTerms(standardsMap.flatMap((standard) => {
    const standardId = String(standard && standard.standardId || '').trim().toLowerCase();
    if (!standardIds.has(standardId)) return [];
    return Array.isArray(standard.relatedConcepts) ? standard.relatedConcepts : [];
  }));

  if (relatedConcepts.length !== 1) return '';
  return resolveConceptTitle(record, relatedConcepts[0]);
}

function resolveConceptTitle(record = {}, conceptReference = '') {
  const reference = String(conceptReference || '').trim();
  if (!reference) return '';

  const concepts = Array.isArray(record.pack && record.pack.concepts)
    ? record.pack.concepts
    : [];
  const matchedConcept = concepts.find((concept) => {
    const conceptId = String(concept && concept.conceptId || '').trim();
    const title = String(concept && concept.title || '').trim();
    return conceptId.toLowerCase() === reference.toLowerCase() ||
      title.toLowerCase() === reference.toLowerCase();
  });

  return firstNonEmptyString([
    matchedConcept && matchedConcept.title,
    reference
  ]);
}

function findSourceFileConfidence(record = {}, sourceFileName = '') {
  const sourceFile = String(sourceFileName || '').trim().toLowerCase();
  if (!sourceFile) return '';

  const sourceFiles = Array.isArray(record.pack && record.pack.sourceFiles)
    ? record.pack.sourceFiles
    : [];
  const matchedSource = sourceFiles.find((item) => (
    String(item && item.fileName || '').trim().toLowerCase() === sourceFile
  ));

  return firstNonEmptyString([
    matchedSource && matchedSource.sourceQuality,
    matchedSource && matchedSource.confidence
  ]);
}

function buildSourceLabel(record, item = {}) {
  const sourceBits = [
    `Approved pack: ${record.title || record.packId}`,
    record.packId ? `(${record.packId})` : '',
    item.sourceFile ? `Source file: ${item.sourceFile}` : '',
    item.sourceLocation ? `Source location: ${item.sourceLocation}` : ''
  ].filter(Boolean);

  return sourceBits.join(' | ');
}

function makeVocabularySentence(term, definition) {
  const cleanTerm = String(term || '').trim();
  const cleanDefinition = toSentence(definition);

  if (!cleanTerm) return cleanDefinition;
  if (!cleanDefinition) return '';

  if (looksLikeBranchResponsibilityDefinition(cleanTerm, cleanDefinition)) {
    return `${withLeadingThe(cleanTerm)} ${lowercaseFirst(stripFinalPunctuation(cleanDefinition))}.`;
  }

  const lowerDefinition = cleanDefinition.toLowerCase();
  const lowerTerm = cleanTerm.toLowerCase();
  if (lowerDefinition.startsWith(`${lowerTerm} is `) ||
      lowerDefinition.startsWith(`${lowerTerm} means `) ||
      lowerDefinition.startsWith(`${lowerTerm} refers to `)) {
    return cleanDefinition;
  }

  return `${cleanTerm} is ${withLeadingArticle(cleanDefinition)}`;
}

function inferAnswerContext(record = {}) {
  const subject = String(record.subject || '').toLowerCase();
  const title = String(record.title || '').toLowerCase();
  const source = `${subject} ${title}`;

  if (/\b(civic|civics|government|history|social\s+studies|geography|economics)\b/.test(source)) {
    return 'plain';
  }

  return '';
}

function extractDefinitionSearchTerms(definition) {
  const phrase = normalizeSearchPhrase(definition);
  if (!phrase) return [];

  const terms = [];
  const words = phrase.split(/\s+/);
  if (words.length >= 2 && words.length <= 8) {
    terms.push(phrase);
  }

  const withoutArticle = phrase.replace(/^(?:a|an|the)\s+/, '');
  if (withoutArticle !== phrase && withoutArticle.split(/\s+/).length >= 2) {
    terms.push(withoutArticle);
  }

  return uniqueTerms(terms);
}

function looksLikeBranchResponsibilityDefinition(term, definition) {
  if (!/\bbranch$/i.test(String(term || '').trim())) return false;

  const phrase = stripFinalPunctuation(definition).trim();
  const firstWord = phrase.split(/\s+/)[0] || '';
  if (/^(a|an|the|is|means|refers)$/i.test(firstWord)) return false;

  return /s$/i.test(firstWord);
}

function withLeadingThe(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  if (/^the\b/i.test(text)) {
    return `The${text.slice(3)}`;
  }

  if (/^(a|an)\b/i.test(text)) {
    return `The ${text.replace(/^(a|an)\s+/i, '')}`;
  }

  return `The ${lowercaseFirst(text)}`;
}

function toSentence(value) {
  const trimmed = String(value || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  if (/[.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function lowercaseFirst(value) {
  const text = String(value || '');
  if (!text) return '';
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function stripFinalPunctuation(value) {
  return String(value || '').trim().replace(/[.!?]+$/g, '').trim();
}

function withLeadingArticle(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  if (/^(a|an|the)\b/i.test(text)) {
    return lowercaseFirst(text);
  }

  const firstWord = text.split(/\s+/)[0] || '';
  if (!firstWord) return lowercaseFirst(text);

  if (/ing$/i.test(firstWord)) {
    return lowercaseFirst(text);
  }

  if (/s$/i.test(firstWord) && !/(?:ss|us)$/i.test(firstWord)) {
    return lowercaseFirst(text);
  }

  const article = /^[aeiou]/i.test(firstWord) ? 'an' : 'a';
  return `${article} ${lowercaseFirst(text)}`;
}

function uniqueTerms(values) {
  const seen = new Set();
  const result = [];

  (values || []).forEach((value) => {
    const text = String(value || '').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });

  return result;
}

function sanitizeStringArray(values) {
  return uniqueTerms(Array.isArray(values) ? values : []);
}

function firstArrayValue(values) {
  if (!Array.isArray(values)) return '';
  return firstNonEmptyString(values);
}

function firstNonEmptyString(values) {
  for (const value of values || []) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function normalizeSearchPhrase(value) {
  return stripFinalPunctuation(value)
    .toLowerCase()
    .replace(/[^a-z0-9µμ.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProblemSearchTerms(question) {
  const text = String(question || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return [];
  return text.split(' ').length >= 3 ? [text] : [];
}

module.exports = {
  loadEnabledApprovedKnowledgeItems,
  loadEnabledApprovedKnowledgePackRecords,
  makeVocabularySentence
};
