const {
  getBuiltinPacketRegistry,
  loadBuiltinPacketForRegistryEntry
} = require('./builtinPacketRegistry');

const KNOWLEDGE_BODY_FIELD_GROUPS = Object.freeze([
  { key: 'vocabulary', fields: ['vocabulary'] },
  { key: 'facts', fields: ['canonicalFacts', 'facts'] },
  { key: 'concepts', fields: ['concepts', 'conceptGroups'] },
  { key: 'formulas', fields: ['referenceFormulas', 'formulas'] }
]);

const RECOMMENDED_FIELD_GROUPS = Object.freeze([
  { label: 'sourceMetadata/sourceRefs', fields: ['sourceMetadata', 'sourceRefs', 'sourceFiles'] },
  { label: 'relationships', fields: ['relationships'] },
  { label: 'comparisons', fields: ['comparisons'] },
  { label: 'examples', fields: ['examples'] },
  { label: 'conceptTutorHooks', fields: ['conceptTutorHooks'] },
  { label: 'formulaTutorHooks', fields: ['formulaTutorHooks'] },
  { label: 'smokeTests', fields: ['smokeTests', 'smokePrompts'] },
  { label: 'routeHints/boundaries', fields: ['routeHints', 'routePreference', 'boundaries'] },
  { label: 'commonMisconceptions', fields: ['commonMisconceptions'] }
]);

function getBuiltinPacketSchemaReport() {
  return getBuiltinPacketRegistry().map(validateBuiltinPacketEntry);
}

function validateBuiltinPacketEntry(entry) {
  const baseReport = buildBaseReport(entry);

  if (!isPacketShapedRegistryEntry(entry)) {
    return {
      ...baseReport,
      validationStatus: 'legacy-gap',
      ok: true,
      notes: ['Active built-in curriculum module has not been converted to the shared packet shape yet.']
    };
  }

  let loaded;
  try {
    loaded = loadBuiltinPacketForRegistryEntry(entry);
  } catch (error) {
    return {
      ...baseReport,
      validationStatus: 'failed',
      ok: false,
      requiredMissing: ['loadableModule'],
      loadError: error && error.message ? error.message : String(error)
    };
  }

  return validateBuiltinPacket(loaded.packet, loaded.entry);
}

function validateBuiltinPacket(packet, entry = {}) {
  const baseReport = buildBaseReport(entry);
  const requiredMissing = [];

  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    return {
      ...baseReport,
      validationStatus: 'failed',
      ok: false,
      requiredMissing: ['packetExport'],
      recommendedMissing: RECOMMENDED_FIELD_GROUPS.map((group) => group.label)
    };
  }

  const bodyCounts = getPacketBodyCounts(packet);
  const hasKnowledgeBody = KNOWLEDGE_BODY_FIELD_GROUPS.some((group) => bodyCounts[group.key] > 0);

  if (!hasPresentValue(packet.packetId)) requiredMissing.push('packetId');
  if (!hasPresentValue(packet.unit) && !hasPresentValue(packet.unitTitle) && !hasPresentValue(entry.unit) && !hasPresentValue(entry.unitTitle)) {
    requiredMissing.push('unit/unitTitle');
  }
  if (!hasPresentValue(packet.topic) && !hasPresentValue(entry.topic)) requiredMissing.push('topic');
  if (!hasKnowledgeBody) requiredMissing.push('knowledgeBody');

  const recommendedMissing = RECOMMENDED_FIELD_GROUPS
    .filter((group) => !hasAnyRecommendedField(packet, group))
    .map((group) => group.label);

  return {
    ...baseReport,
    validationStatus: requiredMissing.length > 0 ? 'failed' : 'valid',
    ok: requiredMissing.length === 0,
    packetId: stringify(packet.packetId || entry.packetId),
    exportedPacketId: stringify(packet.packetId),
    requiredMissing,
    recommendedMissing,
    bodyCounts,
    isPacketShaped: true,
    isLegacy: false
  };
}

function isPacketShapedRegistryEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  return entry.status === 'packet' || hasPresentValue(entry.packetExportName);
}

function getPacketBodyCounts(packet) {
  const safePacket = packet && typeof packet === 'object' ? packet : {};
  return {
    vocabulary: countFieldGroup(safePacket, ['vocabulary']),
    facts: countFieldGroup(safePacket, ['canonicalFacts', 'facts']),
    concepts: countFieldGroup(safePacket, ['concepts', 'conceptGroups']),
    relationships: countFieldGroup(safePacket, ['relationships']),
    comparisons: countFieldGroup(safePacket, ['comparisons']),
    examples: countFieldGroup(safePacket, ['examples']),
    formulas: countFieldGroup(safePacket, ['referenceFormulas', 'formulas']),
    conceptTutorHooks: countFieldGroup(safePacket, ['conceptTutorHooks']),
    formulaTutorHooks: countFieldGroup(safePacket, ['formulaTutorHooks']),
    smokeTests: countFieldGroup(safePacket, ['smokeTests', 'smokePrompts']),
    problems: countFieldGroup(safePacket, ['problemBank', 'problems']),
    routeHints: countFieldGroup(safePacket, ['routeHints', 'routePreference', 'boundaries']),
    commonMisconceptions: countFieldGroup(safePacket, ['commonMisconceptions']),
    sourceRefs: countSourceRefs(safePacket)
  };
}

function buildBaseReport(entry = {}) {
  const isPacketShaped = isPacketShapedRegistryEntry(entry);
  const isLegacy = !isPacketShaped && entry.status === 'legacy';
  return {
    packetId: stringify(entry.packetId),
    status: stringify(entry.status),
    kind: stringify(entry.kind),
    packetExportName: stringify(entry.packetExportName),
    requiredMissing: [],
    recommendedMissing: [],
    bodyCounts: {},
    isPacketShaped,
    isLegacy,
    validationStatus: isLegacy ? 'legacy-gap' : 'unknown',
    ok: true
  };
}

function hasAnyRecommendedField(packet, group) {
  if (group.label === 'sourceMetadata/sourceRefs') {
    return hasSourceMetadata(packet);
  }
  return countFieldGroup(packet, group.fields) > 0;
}

function hasSourceMetadata(packet) {
  if (!packet || typeof packet !== 'object') return false;
  if (hasPresentValue(packet.sourceMetadata)) return true;
  if (countFieldGroup(packet, ['sourceRefs', 'sourceFiles']) > 0) return true;
  if (packet.metadata && typeof packet.metadata === 'object') {
    if (packet.metadata.sourceBacked === true) return true;
    if (countFieldGroup(packet.metadata, ['sourceReferences', 'sourceRefs', 'sourceFiles']) > 0) return true;
  }
  return false;
}

function countSourceRefs(packet) {
  if (!packet || typeof packet !== 'object') return 0;
  const topLevelCount = countFieldGroup(packet, ['sourceRefs', 'sourceFiles']);
  const sourceMetadataCount = countFieldGroup(packet.sourceMetadata, ['sourceRefs', 'sourceFiles', 'sourcePages']);
  const metadataCount = countFieldGroup(packet.metadata, ['sourceReferences', 'sourceRefs', 'sourceFiles']);
  return topLevelCount + sourceMetadataCount + metadataCount;
}

function countFieldGroup(source, fields) {
  if (!source || typeof source !== 'object') return 0;
  const counts = fields.map((field) => countValue(source[field]));
  return counts.find((count) => count > 0) || 0;
}

function countValue(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  if (hasPresentValue(value)) return 1;
  return 0;
}

function hasPresentValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function stringify(value) {
  return value === null || value === undefined ? '' : String(value);
}

module.exports = {
  getBuiltinPacketSchemaReport,
  getPacketBodyCounts,
  isPacketShapedRegistryEntry,
  validateBuiltinPacket,
  validateBuiltinPacketEntry
};
