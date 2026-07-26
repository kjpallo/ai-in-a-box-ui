function isApprovedKnowledgeItem(item = {}) {
  const category = normalize(item?.category);
  const id = String(item?.id || '').trim().toLowerCase();
  const provenanceType = normalize(item?.provenance?.type);

  return category.startsWith('approved_') ||
    id.startsWith('approved-pack:') ||
    id.startsWith('approved_pack_') ||
    provenanceType === 'approved_knowledge_pack';
}

function isReviewedApprovedKnowledgeItem(item = {}) {
  if (!isApprovedKnowledgeItem(item)) return false;
  return normalize(item?.reviewStatus || item?.reviewState) === 'approved' &&
    hasApprovedKnowledgeProvenance(item);
}

function hasApprovedKnowledgeProvenance(item = {}) {
  return normalize(item?.provenance?.type) === 'approved_knowledge_pack' &&
    Boolean(String(item?.provenance?.packId || item?.packId || '').trim());
}

function isScienceApprovedKnowledgeItem(item = {}) {
  return isApprovedKnowledgeItem(item) && hasScienceKnowledgeMetadata(item);
}

function hasScienceKnowledgeMetadata(item = {}) {
  const fields = [
    item?.subject,
    item?.topic,
    ...(Array.isArray(item?.topics) ? item.topics : []),
    item?.packTitle
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return fields.some(isScienceMetadataField);
}

function isScienceMetadataField(value) {
  const text = String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return false;
  if (/\b(?:political|social)\s+science\b|\bcomputer\s+science\b/.test(text)) {
    return false;
  }

  return /\b(?:physical science|earth science|life science|environmental science|natural science|biology|chemistry|physics|astronomy)\b/.test(text) ||
    /^(?:general\s+)?science$/.test(text) ||
    /^(?:grade\s*\d+|\d+(?:st|nd|rd|th)?\s+grade)\s+science$/.test(text);
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

module.exports = {
  hasApprovedKnowledgeProvenance,
  hasScienceKnowledgeMetadata,
  isApprovedKnowledgeItem,
  isReviewedApprovedKnowledgeItem,
  isScienceApprovedKnowledgeItem
};
