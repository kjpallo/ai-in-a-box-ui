const APPROVED_STATUS = 'approved';

function buildKnowledgePackIndex(packRecords) {
  const index = {
    vocabularyByTerm: {},
    vocabularyByAlias: {},
    conceptsByTitle: {},
    conceptsByAlias: {},
    problemBankByQuestion: {},
    standardsMapByStandardId: {}
  };

  (packRecords || []).forEach((record) => {
    const pack = record.pack || record;
    const packContext = {
      packId: record.packId || pack.packId,
      packTitle: record.title || pack.title
    };

    indexVocabulary(pack.vocabulary, packContext, index);
    indexConcepts(pack.concepts, packContext, index);
    indexProblemBank(pack.problemBank, packContext, index);
    indexStandardsMap(pack.standardsMap, packContext, index);
  });

  return index;
}

function indexVocabulary(items, packContext, index) {
  if (!Array.isArray(items)) return;

  items.forEach((item) => {
    if (!isApproved(item)) return;

    const entry = makeIndexEntry(packContext, 'vocabulary', item, item.standards || []);
    addEntry(index.vocabularyByTerm, item.term, entry);
    (item.aliases || []).forEach((alias) => addEntry(index.vocabularyByAlias, alias, entry));
  });
}

function indexConcepts(items, packContext, index) {
  if (!Array.isArray(items)) return;

  items.forEach((item) => {
    if (!isApproved(item)) return;

    const entry = makeIndexEntry(packContext, 'concept', item, item.standards || []);
    addEntry(index.conceptsByTitle, item.title, entry);
    (item.aliases || []).forEach((alias) => addEntry(index.conceptsByAlias, alias, entry));
  });
}

function indexProblemBank(items, packContext, index) {
  if (!Array.isArray(items)) return;

  items.forEach((item) => {
    if (!isApproved(item)) return;

    const entry = makeIndexEntry(packContext, 'problem', item, item.standards || []);
    addEntry(index.problemBankByQuestion, item.question, entry);
  });
}

function indexStandardsMap(items, packContext, index) {
  if (!Array.isArray(items)) return;

  items.forEach((item) => {
    if (!isApproved(item)) return;

    const entry = makeIndexEntry(packContext, 'standardsMap', item, [item.standardId].filter(Boolean));
    addEntry(index.standardsMapByStandardId, item.standardId, entry);
  });
}

function makeIndexEntry(packContext, type, item, standards) {
  return {
    packId: packContext.packId,
    packTitle: packContext.packTitle,
    type,
    item,
    sourceTracking: {
      sourceFile: item.sourceFile,
      sourceLocation: item.sourceLocation,
      sourceTextSnippet: item.sourceTextSnippet
    },
    standards
  };
}

function addEntry(bucket, key, entry) {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) return;

  if (!bucket[normalizedKey]) {
    bucket[normalizedKey] = [];
  }
  bucket[normalizedKey].push(entry);
}

function isApproved(item) {
  return item && item.reviewStatus === APPROVED_STATUS;
}

function normalizeKey(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

module.exports = {
  buildKnowledgePackIndex,
  normalizeKey
};
