const {
  getBuiltinPacketRegistry,
  loadBuiltinPacketForRegistryEntry
} = require('./builtinPacketRegistry');
const {
  getPacketBodyCounts,
  isPacketShapedRegistryEntry,
  validateBuiltinPacket,
  validateBuiltinPacketEntry
} = require('./builtinPacketSchema');
const { normalizeGraphTerm } = require('./knowledgeGraph');

const SOURCE = 'built-in curriculum packet';
const GRAPH_SUPPORT_PURPOSE = 'graph-support';

function normalizeBuiltinPacketForGraph(packet, entry = {}) {
  const safePacket = packet && typeof packet === 'object' && !Array.isArray(packet) ? packet : null;
  const safeEntry = entry && typeof entry === 'object' ? entry : {};
  const validation = validateBuiltinPacket(safePacket, safeEntry);
  const packetId = readPacketId(safePacket, safeEntry);
  const unit = formatUnit(safePacket, safeEntry);
  const unitTitle = firstNonEmptyString([safePacket && safePacket.unitTitle, safeEntry.unitTitle]);

  if (!safePacket || validation.ok !== true) {
    return {
      packetId,
      unit,
      unitTitle,
      topic: firstNonEmptyString([safePacket && safePacket.topic, safeEntry.topic]),
      source: SOURCE,
      purpose: GRAPH_SUPPORT_PURPOSE,
      normalizationStatus: 'invalid',
      validationStatus: validation.validationStatus,
      ok: false,
      requiredMissing: validation.requiredMissing || [],
      recommendedMissing: validation.recommendedMissing || [],
      bodyCounts: validation.bodyCounts || {},
      nodes: [],
      edges: [],
      nodeCounts: emptyNodeCounts(),
      edgeCounts: emptyEdgeCounts()
    };
  }

  const vocabularyNodes = normalizeVocabularyNodes(safePacket, safeEntry);
  const conceptNodes = normalizeConceptNodes(safePacket, safeEntry);
  const factNodes = normalizeFactNodes(safePacket, safeEntry);
  const formulaNodes = normalizeFormulaNodes(safePacket, safeEntry);
  const nodes = uniqueById([
    ...vocabularyNodes,
    ...conceptNodes,
    ...factNodes,
    ...formulaNodes
  ]);
  const nodeLookup = buildNodeLookup(nodes);
  const relationshipEdges = normalizeRelationshipEdges(safePacket, safeEntry, nodeLookup);
  const comparisonEdges = normalizeComparisonEdges(safePacket, safeEntry, nodeLookup);
  const edges = uniqueById([
    ...relationshipEdges,
    ...comparisonEdges
  ]);

  return {
    packetId,
    unit,
    unitTitle,
    topic: firstNonEmptyString([safePacket.topic, safeEntry.topic]),
    source: SOURCE,
    purpose: GRAPH_SUPPORT_PURPOSE,
    normalizationStatus: 'normalized',
    validationStatus: validation.validationStatus,
    ok: true,
    requiredMissing: validation.requiredMissing || [],
    recommendedMissing: validation.recommendedMissing || [],
    bodyCounts: validation.bodyCounts || getPacketBodyCounts(safePacket),
    nodes,
    edges,
    nodeCounts: countByType(nodes, ['vocabulary', 'concept', 'fact', 'formula']),
    edgeCounts: countByType(edges, ['relationship', 'comparison'])
  };
}

function normalizeBuiltinPacketsForGraph() {
  const packets = [];
  const skipped = [];

  getBuiltinPacketRegistry().forEach((entry) => {
    const schemaEntry = validateBuiltinPacketEntry(entry);
    if (!isPacketShapedRegistryEntry(entry)) {
      skipped.push({
        packetId: entry.packetId,
        status: entry.status,
        kind: entry.kind,
        normalizationStatus: 'skipped',
        validationStatus: schemaEntry.validationStatus,
        reason: 'legacy built-in module has not been converted to the shared packet shape yet'
      });
      return;
    }

    let loaded;
    try {
      loaded = loadBuiltinPacketForRegistryEntry(entry);
    } catch (error) {
      packets.push({
        packetId: entry.packetId,
        unit: formatUnit(null, entry),
        unitTitle: entry.unitTitle || '',
        topic: entry.topic || '',
        source: SOURCE,
        purpose: GRAPH_SUPPORT_PURPOSE,
        normalizationStatus: 'load-failed',
        validationStatus: 'failed',
        ok: false,
        loadError: error && error.message ? error.message : String(error),
        nodes: [],
        edges: [],
        nodeCounts: emptyNodeCounts(),
        edgeCounts: emptyEdgeCounts()
      });
      return;
    }

    packets.push(normalizeBuiltinPacketForGraph(loaded.packet, loaded.entry));
  });

  const nodes = packets.flatMap((packet) => packet.nodes || []);
  const edges = packets.flatMap((packet) => packet.edges || []);

  return {
    source: SOURCE,
    purpose: GRAPH_SUPPORT_PURPOSE,
    packets,
    skipped,
    nodes,
    edges,
    counts: {
      registryEntries: packets.length + skipped.length,
      normalizedPackets: packets.filter((packet) => packet.normalizationStatus === 'normalized').length,
      skippedLegacyEntries: skipped.length,
      nodes: nodes.length,
      edges: edges.length,
      nodeTypes: countByType(nodes, ['vocabulary', 'concept', 'fact', 'formula']),
      edgeTypes: countByType(edges, ['relationship', 'comparison'])
    }
  };
}

function getBuiltinPacketGraphReport() {
  const normalized = normalizeBuiltinPacketsForGraph();
  const packetEntries = new Map(normalized.packets.map((packet) => [packet.packetId, {
    packetId: packet.packetId,
    unit: packet.unit,
    unitTitle: packet.unitTitle,
    topic: packet.topic,
    source: packet.source,
    purpose: packet.purpose,
    normalizationStatus: packet.normalizationStatus,
    validationStatus: packet.validationStatus,
    ok: packet.ok,
    bodyCounts: packet.bodyCounts || {},
    nodeCounts: packet.nodeCounts || emptyNodeCounts(),
    edgeCounts: packet.edgeCounts || emptyEdgeCounts()
  }]));
  const skippedEntries = new Map(normalized.skipped.map((entry) => [entry.packetId, {
    packetId: entry.packetId,
    unit: '',
    unitTitle: '',
    topic: '',
    source: SOURCE,
    purpose: GRAPH_SUPPORT_PURPOSE,
    normalizationStatus: entry.normalizationStatus,
    validationStatus: entry.validationStatus,
    ok: true,
    skippedReason: entry.reason,
    nodeCounts: emptyNodeCounts(),
    edgeCounts: emptyEdgeCounts()
  }]));

  return getBuiltinPacketRegistry()
    .map((entry) => packetEntries.get(entry.packetId) || skippedEntries.get(entry.packetId))
    .filter(Boolean);
}

function normalizeVocabularyNodes(packet, entry = {}) {
  return normalizeItems(readArrayField(packet, ['vocabulary']), packet, entry, 'vocabulary', (item, index) => {
    const term = firstNonEmptyString([item.term, item.title, item.name, item.canonicalTerm, item.id]);
    if (!term) return null;
    return makeNode(packet, entry, {
      type: 'vocabulary',
      item,
      index,
      term,
      label: term,
      text: firstNonEmptyString([item.definition, item.studentDefinition, item.teacherDefinition, item.answer, item.use]),
      aliases: [
        ...arrayOrEmpty(item.aliases),
        ...arrayOrEmpty(item.typoAliases),
        ...arrayOrEmpty(item.studentWording),
        item.exampleCue
      ]
    });
  });
}

function normalizeConceptNodes(packet, entry = {}) {
  return normalizeItems(readArrayField(packet, ['concepts', 'conceptGroups', 'conceptTutorHooks']), packet, entry, 'concept', (item, index) => {
    const term = firstNonEmptyString([
      item.title,
      item.label,
      item.topic,
      item.concept,
      item.learningTarget,
      item.studentFriendlyRule,
      item.id
    ]);
    if (!term) return null;
    return makeNode(packet, entry, {
      type: 'concept',
      item,
      index,
      term,
      label: term,
      text: firstNonEmptyString([
        item.studentFriendlyRule,
        item.learningTarget,
        item.description,
        item.routePreference,
        item.topic
      ]),
      aliases: [
        ...arrayOrEmpty(item.terms),
        ...arrayOrEmpty(item.factIds),
        ...arrayOrEmpty(item.needsRouterSupport),
        item.builder
      ]
    });
  });
}

function normalizeFactNodes(packet, entry = {}) {
  return normalizeItems(readArrayField(packet, ['canonicalFacts', 'facts', 'visualFacts']), packet, entry, 'fact', (item, index) => {
    const term = firstNonEmptyString([item.canonicalTerm, item.term, item.title, item.name, item.legacyAnswerId, item.id]);
    if (!term) return null;
    return makeNode(packet, entry, {
      type: 'fact',
      item,
      index,
      term,
      label: term,
      text: firstNonEmptyString([
        item.definition,
        item.answerTemplate,
        item.answer,
        item.statement,
        item.use,
        item.unitAnswer,
        item.toolAnswer
      ]),
      aliases: [
        ...arrayOrEmpty(item.aliases),
        ...arrayOrEmpty(item.typoAliases),
        ...arrayOrEmpty(item.studentWording),
        item.category,
        item.type
      ]
    });
  });
}

function normalizeFormulaNodes(packet, entry = {}) {
  return normalizeItems(readArrayField(packet, ['referenceFormulas', 'formulas', 'formulaTutorHooks']), packet, entry, 'formula', (item, index) => {
    const term = firstNonEmptyString([item.title, item.name, item.equation, item.rule, item.statement, item.module, item.id, item.factId]);
    if (!term) return null;
    return makeNode(packet, entry, {
      type: 'formula',
      item,
      index,
      term,
      label: firstNonEmptyString([item.title, item.name, item.equation, item.statement, item.rule, item.module, term]),
      text: firstNonEmptyString([item.rule, item.statement, item.routePreference, item.equation]),
      aliases: [
        item.equation,
        ...arrayOrEmpty(item.exports),
        ...arrayOrEmpty(item.solveFor),
        ...arrayOrEmpty(item.triggerPhrases),
        ...arrayOrEmpty(item.variables),
        ...arrayOrEmpty(item.rearrangements)
      ]
    });
  });
}

function normalizeRelationshipEdges(packet, entry = {}, nodeLookup = null) {
  const lookup = nodeLookup || buildNodeLookup([
    ...normalizeVocabularyNodes(packet, entry),
    ...normalizeConceptNodes(packet, entry),
    ...normalizeFactNodes(packet, entry),
    ...normalizeFormulaNodes(packet, entry)
  ]);

  return normalizeItems(readArrayField(packet, ['relationships']), packet, entry, 'relationship', (item, index) => {
    const fromTerm = firstNonEmptyString([item.from, item.source, item.left, item.concept]);
    const toTerm = firstNonEmptyString([item.to, item.target, item.right, item.related]);
    if (!fromTerm || !toTerm) return null;
    const relation = firstNonEmptyString([item.relation, item.relationship, item.label, item.type, 'related to']);
    return makeEdge(packet, entry, {
      type: 'relationship',
      item,
      index,
      fromTerm,
      toTerm,
      from: findNodeId(lookup, fromTerm),
      to: findNodeId(lookup, toTerm),
      label: relation,
      text: firstNonEmptyString([item.text, item.explanation, item.answer]),
      graphType: mapRelationshipType(relation)
    });
  });
}

function normalizeComparisonEdges(packet, entry = {}, nodeLookup = null) {
  const lookup = nodeLookup || buildNodeLookup([
    ...normalizeVocabularyNodes(packet, entry),
    ...normalizeConceptNodes(packet, entry),
    ...normalizeFactNodes(packet, entry),
    ...normalizeFormulaNodes(packet, entry)
  ]);

  return normalizeItems(readArrayField(packet, ['comparisons']), packet, entry, 'comparison', (item, index) => {
    const terms = uniqueStrings([
      ...arrayOrEmpty(item.concepts),
      item.left,
      item.right
    ]);
    if (terms.length < 2) return null;
    return terms.slice(1).map((term, termIndex) => makeEdge(packet, entry, {
      type: 'comparison',
      item,
      index: `${index}-${termIndex}`,
      fromTerm: terms[0],
      toTerm: term,
      from: findNodeId(lookup, terms[0]),
      to: findNodeId(lookup, term),
      label: firstNonEmptyString([item.label, item.relation, item.tutorPreference, 'compared with']),
      text: firstNonEmptyString([
        item.same,
        Array.isArray(item.differences) ? item.differences.join(' ') : '',
        item.answer
      ]),
      graphType: 'commonly_confused_with'
    }));
  }).flat();
}

function makeNode(packet, entry, options) {
  const packetId = readPacketId(packet, entry);
  const item = options.item || {};
  const term = String(options.term || '').trim();
  const type = options.type;
  const sourceRefs = collectSourceRefs(item);

  return {
    id: makeGraphSupportId(packetId, type, firstNonEmptyString([item.id, item.factId, item.formulaId, item.conceptId, term])),
    packetId,
    unit: formatUnit(packet, entry),
    unitTitle: firstNonEmptyString([packet && packet.unitTitle, entry.unitTitle]),
    type,
    term,
    label: firstNonEmptyString([options.label, term]),
    text: firstNonEmptyString([options.text]),
    aliases: uniqueStrings(options.aliases || []),
    source: SOURCE,
    sourceRefs,
    metadata: {
      originalId: firstNonEmptyString([item.id, item.factId, item.formulaId, item.conceptId]),
      packetField: type,
      index: options.index
    }
  };
}

function makeEdge(packet, entry, options) {
  const packetId = readPacketId(packet, entry);
  const item = options.item || {};
  const label = firstNonEmptyString([options.label, options.type]);
  const fromTerm = firstNonEmptyString([options.fromTerm]);
  const toTerm = firstNonEmptyString([options.toTerm]);
  const from = options.from || makeGraphSupportId(packetId, 'concept', fromTerm);
  const to = options.to || makeGraphSupportId(packetId, 'concept', toTerm);
  const sourceRefs = collectSourceRefs(item);

  return {
    id: makeGraphSupportId(
      packetId,
      options.type,
      firstNonEmptyString([item.id ? `${item.id}-${fromTerm}-${toTerm}` : '', `${fromTerm}-${label}-${toTerm}`]),
      options.index
    ),
    packetId,
    unit: formatUnit(packet, entry),
    unitTitle: firstNonEmptyString([packet && packet.unitTitle, entry.unitTitle]),
    type: options.type,
    graphType: options.graphType || options.type,
    from,
    to,
    fromTerm,
    toTerm,
    label,
    text: firstNonEmptyString([options.text]),
    source: SOURCE,
    sourceRefs,
    metadata: {
      originalId: firstNonEmptyString([item.id]),
      index: options.index
    }
  };
}

function buildNodeLookup(nodes) {
  const lookup = new Map();
  nodes.forEach((node) => {
    uniqueStrings([node.term, node.label, ...(node.aliases || [])]).forEach((term) => {
      const key = normalizeGraphTerm(term);
      if (key && !lookup.has(key)) lookup.set(key, node.id);
    });
  });
  return lookup;
}

function findNodeId(lookup, term) {
  const key = normalizeGraphTerm(term);
  return key && lookup && lookup.get(key) ? lookup.get(key) : '';
}

function normalizeItems(items, packet, entry, type, mapper) {
  return arrayOrEmpty(items)
    .map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      return mapper(item, index);
    })
    .flat()
    .filter(Boolean)
    .map((item, index) => ({ ...item, id: ensureUniqueId(item.id, packet, entry, type, index) }));
}

function ensureUniqueId(id, packet, entry, type, index) {
  return id || makeGraphSupportId(readPacketId(packet, entry), type, `item-${index + 1}`);
}

function makeGraphSupportId(packetId, type, value, fallbackIndex = '') {
  const base = `${slug(packetId)}:${slug(type)}:${slug(value) || 'item'}`;
  return fallbackIndex === '' || fallbackIndex === null || fallbackIndex === undefined
    ? base
    : `${base}:${slug(fallbackIndex) || '0'}`;
}

function readArrayField(packet, fields) {
  if (!packet || typeof packet !== 'object') return [];
  for (const field of fields) {
    if (Array.isArray(packet[field])) return packet[field];
  }
  return [];
}

function readPacketId(packet, entry = {}) {
  return firstNonEmptyString([packet && packet.packetId, packet && packet.packId, entry.packetId]);
}

function formatUnit(packet, entry = {}) {
  const value = firstNonEmptyString([packet && packet.unit, entry.unit]);
  if (value) return /^unit\b/i.test(value) ? value : `Unit ${value}`;
  return firstNonEmptyString([packet && packet.unitTitle, entry.unitTitle]);
}

function collectSourceRefs(item = {}) {
  return uniqueStrings([
    ...arrayOrEmpty(item.sourceRefs),
    ...arrayOrEmpty(item.sourceReferences),
    ...arrayOrEmpty(item.sourceFiles),
    ...splitCommaList(item.sourcePages),
    item.sourceFile,
    item.source
  ]);
}

function mapRelationshipType(label) {
  const normalized = normalizeGraphTerm(label);
  if (normalized.includes('prerequisite')) return 'prerequisite_for';
  if (normalized.includes('formula')) return 'uses_formula';
  if (normalized.includes('confus')) return 'commonly_confused_with';
  if (normalized.includes('example')) return 'example_of';
  if (normalized.includes('use')) return 'uses_concept';
  return 'related_to';
}

function countByType(items, knownTypes) {
  const counts = Object.fromEntries(knownTypes.map((type) => [type, 0]));
  arrayOrEmpty(items).forEach((item) => {
    const type = item && item.type ? item.type : 'unknown';
    counts[type] = (counts[type] || 0) + 1;
  });
  counts.total = arrayOrEmpty(items).length;
  return counts;
}

function emptyNodeCounts() {
  return countByType([], ['vocabulary', 'concept', 'fact', 'formula']);
}

function emptyEdgeCounts() {
  return countByType([], ['relationship', 'comparison']);
}

function uniqueById(items) {
  const seen = new Set();
  const results = [];
  arrayOrEmpty(items).forEach((item) => {
    if (!item || !item.id || seen.has(item.id)) return;
    seen.add(item.id);
    results.push(item);
  });
  return results;
}

function uniqueStrings(values) {
  const seen = new Set();
  const results = [];
  arrayOrEmpty(values).flat().forEach((value) => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (!text) return;
    const key = normalizeGraphTerm(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    results.push(text);
  });
  return results;
}

function splitCommaList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function firstNonEmptyString(values) {
  for (const value of values || []) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function slug(value) {
  return normalizeGraphTerm(value).replace(/\s+/g, '-');
}

module.exports = {
  normalizeBuiltinPacketForGraph,
  normalizeBuiltinPacketsForGraph,
  getBuiltinPacketGraphReport,
  normalizeVocabularyNodes,
  normalizeConceptNodes,
  normalizeFactNodes,
  normalizeFormulaNodes,
  normalizeRelationshipEdges,
  normalizeComparisonEdges
};
