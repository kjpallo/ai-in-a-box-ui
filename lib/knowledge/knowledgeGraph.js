const { getLinkedStandardIds } = require('./standardsMetadata');

const APPROVED_STATUS = 'approved';

const NODE_TYPES = new Set([
  'vocabulary',
  'concept',
  'formula',
  'problem',
  'standard',
  'misconception',
  'source'
]);

const EDGE_TYPES = new Set([
  'alias_of',
  'related_to',
  'commonly_confused_with',
  'uses_formula',
  'uses_concept',
  'prerequisite_for',
  'assessed_by',
  'aligned_to_standard',
  'has_misconception',
  'example_of',
  'source_supports'
]);

const MOTION_FORCE_SEED_RELATIONSHIPS = [
  ['distance', 'displacement', 'commonly_confused_with'],
  ['displacement', 'direction', 'related_to'],
  ['speed', 'velocity', 'related_to'],
  ['velocity', 'displacement', 'uses_concept'],
  ['velocity', 'time', 'uses_concept'],
  ['acceleration', 'velocity', 'uses_concept'],
  ['acceleration', 'time', 'uses_concept'],
  ["Newton's second law", 'F = ma', 'uses_formula'],
  ['unbalanced force', "Newton's second law", 'prerequisite_for'],
  ['distance-time graph', 'speed', 'related_to'],
  ['velocity-time graph', 'acceleration', 'related_to']
];

const MOTION_FORCE_SEED_NODE_TYPES = {
  distance: 'vocabulary',
  displacement: 'vocabulary',
  direction: 'concept',
  speed: 'vocabulary',
  velocity: 'vocabulary',
  time: 'concept',
  acceleration: 'concept',
  'newtons second law': 'concept',
  'f ma': 'formula',
  'unbalanced force': 'concept',
  'distance time graph': 'concept',
  'velocity time graph': 'concept'
};

function normalizeGraphTerm(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .normalize('NFKD')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/\b([a-zA-Z])'s\b/g, '$1s')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildKnowledgeGraph(packRecords = [], teacherKnowledgeItems = []) {
  const builder = makeGraphBuilder();

  normalizePackRecords(packRecords).forEach((record) => {
    addPackRecord(builder, record);
  });

  normalizeTeacherKnowledgeItems(teacherKnowledgeItems).forEach((item, index) => {
    addTeacherKnowledgeItem(builder, item, index);
  });

  addMotionForceSeedRelationships(builder);

  const graph = finalizeGraph(builder);
  return graph;
}

function findGraphContext(message, graph, options = {}) {
  const safeGraph = normalizeGraphShape(graph);
  const normalizedMessage = normalizeGraphTerm(message);
  const minTermLength = Number.isInteger(options.minTermLength)
    ? Math.max(1, options.minTermLength)
    : 3;

  if (!normalizedMessage) {
    return {
      matchedNodes: [],
      relatedNodes: [],
      edges: [],
      possiblePaths: []
    };
  }

  const matches = [];
  Object.values(safeGraph.nodes).forEach((node) => {
    const terms = uniqueStrings([node.label, ...(Array.isArray(node.aliases) ? node.aliases : [])]);
    const bestMatch = findBestTermMatch(normalizedMessage, terms, minTermLength);
    if (!bestMatch) return;

    matches.push({
      node,
      matchedTerm: bestMatch.term,
      normalizedTerm: bestMatch.normalizedTerm,
      index: bestMatch.index,
      length: bestMatch.normalizedTerm.length
    });
  });

  const matchedNodes = matches
    .sort((left, right) => left.index - right.index || right.length - left.length || left.node.id.localeCompare(right.node.id))
    .map((match) => ({
      ...cloneNode(match.node),
      matchedTerm: match.matchedTerm
    }));

  const matchedIds = new Set(matchedNodes.map((node) => node.id));
  const relatedIds = new Set();
  const contextEdges = [];

  safeGraph.edges.forEach((edge) => {
    if (!matchedIds.has(edge.from) && !matchedIds.has(edge.to)) return;
    contextEdges.push(cloneEdge(edge));
    if (matchedIds.has(edge.from) && !matchedIds.has(edge.to)) relatedIds.add(edge.to);
    if (matchedIds.has(edge.to) && !matchedIds.has(edge.from)) relatedIds.add(edge.from);
  });

  const relatedNodes = Array.from(relatedIds)
    .map((nodeId) => safeGraph.nodes[nodeId])
    .filter(Boolean)
    .sort(compareNodes)
    .map(cloneNode);

  const maxPaths = Number.isInteger(options.maxPaths) ? Math.max(0, options.maxPaths) : 3;
  const possiblePaths = [];
  for (let i = 0; i < matchedNodes.length && possiblePaths.length < maxPaths; i += 1) {
    for (let j = i + 1; j < matchedNodes.length && possiblePaths.length < maxPaths; j += 1) {
      const path = explainGraphPath(safeGraph, matchedNodes[i].id, matchedNodes[j].id, options);
      if (path) possiblePaths.push(path);
    }
  }

  return {
    matchedNodes,
    relatedNodes,
    edges: contextEdges.sort(compareEdges),
    possiblePaths
  };
}

function explainGraphPath(graph, fromNodeId, toNodeId, options = {}) {
  const safeGraph = normalizeGraphShape(graph);
  const fromId = String(fromNodeId || '').trim();
  const toId = String(toNodeId || '').trim();
  const maxDepth = Number.isInteger(options.maxDepth) ? Math.max(0, options.maxDepth) : 6;
  const directed = options.directed === true;

  if (!safeGraph.nodes[fromId] || !safeGraph.nodes[toId]) return null;

  if (fromId === toId) {
    return {
      found: true,
      from: fromId,
      to: toId,
      length: 0,
      nodes: [cloneNodeForPath(safeGraph.nodes[fromId])],
      edges: []
    };
  }

  const neighbors = directed
    ? buildDirectedNeighborMap(safeGraph)
    : buildUndirectedNeighborMap(safeGraph);
  const queue = [{
    nodeId: fromId,
    nodeIds: [fromId],
    edges: []
  }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.edges.length >= maxDepth) continue;

    const nextSteps = neighbors[current.nodeId] || [];
    for (const step of nextSteps) {
      if (current.nodeIds.includes(step.nodeId)) continue;

      const nextNodeIds = current.nodeIds.concat(step.nodeId);
      const nextEdges = current.edges.concat(step);

      if (step.nodeId === toId) {
        return {
          found: true,
          from: fromId,
          to: toId,
          length: nextEdges.length,
          nodes: nextNodeIds.map((nodeId) => cloneNodeForPath(safeGraph.nodes[nodeId])),
          edges: nextEdges.map((pathEdge) => ({
            from: pathEdge.edge.from,
            to: pathEdge.edge.to,
            type: pathEdge.edge.type,
            label: pathEdge.edge.label,
            confidence: pathEdge.edge.confidence,
            source: pathEdge.edge.source,
            direction: pathEdge.direction
          }))
        };
      }

      queue.push({
        nodeId: step.nodeId,
        nodeIds: nextNodeIds,
        edges: nextEdges
      });
    }
  }

  return null;
}

function makeGraphBuilder() {
  return {
    nodes: {},
    edges: [],
    edgeKeys: new Set(),
    termIndex: {}
  };
}

function addPackRecord(builder, record) {
  const pack = record.pack || record;
  if (!pack || typeof pack !== 'object') return;

  const packContext = {
    packId: firstNonEmptyString([record.packId, pack.packId]),
    packTitle: firstNonEmptyString([record.title, pack.title]),
    source: firstNonEmptyString([record.sourcePath, pack.source, pack.title, pack.packId])
  };

  addPackSources(builder, pack, packContext);

  const standards = new Map();
  getArray(pack.standardsMap).forEach((item, index) => {
    if (!isApprovedKnowledgeItem(item)) return;
    const standardId = firstNonEmptyString([item.standardId, item.id, item.code]);
    if (!standardId) return;

    const node = addNode(builder, {
      id: makeNodeId('standard', standardId, packContext.packId),
      type: 'standard',
      label: standardId,
      aliases: uniqueStrings([item.description, item.title]),
      source: packContext.source,
      packId: packContext.packId,
      standards: [standardId],
      metadata: {
        ...copyMetadata(item),
        index
      }
    });
    standards.set(normalizeGraphTerm(standardId), node.id);
  });

  getArray(pack.vocabulary).forEach((item, index) => {
    if (!isApprovedKnowledgeItem(item)) return;
    const label = firstNonEmptyString([item.term, item.title, item.id]);
    if (!label) return;

    const node = addNode(builder, {
      id: makeNodeId('vocabulary', firstNonEmptyString([item.id, item.term, item.title]), packContext.packId),
      type: 'vocabulary',
      label,
      aliases: uniqueStrings([
        ...getAliases(item),
        item.studentDefinition,
        item.teacherDefinition
      ]),
      source: buildSourceLabel(packContext, item),
      packId: packContext.packId,
      standards: getStandards(item),
      metadata: {
        ...copyMetadata(item),
        definition: firstNonEmptyString([item.studentDefinition, item.teacherDefinition, item.definition, item.student_definition]),
        exampleQuestion: item.exampleQuestion,
        exampleAnswer: item.exampleAnswer,
        exampleCue: item.exampleCue || item.example_cue,
        index
      }
    });

    connectStandards(builder, node, standards, getStandards(item));
    connectSource(builder, packContext, item, node);
    connectExplicitConcept(builder, node, item, 'uses_concept');
    addMisconceptionNodes(builder, node, item, packContext, index);
  });

  getArray(pack.concepts).forEach((item, index) => {
    if (!isApprovedKnowledgeItem(item)) return;
    const label = firstNonEmptyString([item.title, item.concept, item.conceptId, item.id]);
    if (!label) return;

    const node = addNode(builder, {
      id: makeNodeId('concept', firstNonEmptyString([item.conceptId, item.id, item.title, item.concept]), packContext.packId),
      type: 'concept',
      label,
      aliases: uniqueStrings([
        ...getAliases(item),
        item.learningTarget,
        item.learning_target,
        item.studentFriendlyRule,
        item.student_friendly_rule
      ]),
      source: buildSourceLabel(packContext, item),
      packId: packContext.packId,
      standards: getStandards(item),
      metadata: {
        ...copyMetadata(item),
        keyIdeas: getArray(item.keyIdeas),
        examples: getArray(item.examples),
        nonExamples: getArray(item.nonExamples),
        index
      }
    });

    connectStandards(builder, node, standards, getStandards(item));
    connectSource(builder, packContext, item, node);
    addMisconceptionNodes(builder, node, item, packContext, index);
  });

  getArray(pack.referenceFormulas || pack.formulas).forEach((item, index) => {
    if (!isApprovedKnowledgeItem(item)) return;
    const label = firstNonEmptyString([item.title, item.name, item.equation, item.formulaId, item.id]);
    if (!label) return;

    const node = addNode(builder, {
      id: makeNodeId('formula', firstNonEmptyString([item.formulaId, item.id, item.title, item.name, item.equation]), packContext.packId),
      type: 'formula',
      label,
      aliases: uniqueStrings([
        item.equation,
        ...getAliases(item),
        ...getArray(item.triggerPhrases),
        ...getArray(item.solveFor)
      ]),
      source: buildSourceLabel(packContext, item),
      packId: packContext.packId,
      standards: getStandards(item),
      metadata: {
        ...copyMetadata(item),
        equation: item.equation,
        variables: getArray(item.variables),
        rearrangements: getArray(item.rearrangements),
        index
      }
    });

    connectStandards(builder, node, standards, getStandards(item));
    connectSource(builder, packContext, item, node);
    connectExplicitConcept(builder, node, item, 'uses_concept');
  });

  getArray(pack.problemBank).forEach((item, index) => {
    if (!isApprovedKnowledgeItem(item)) return;
    const label = firstNonEmptyString([item.question, item.title, item.problemId, item.id]);
    if (!label) return;

    const node = addNode(builder, {
      id: makeNodeId('problem', firstNonEmptyString([item.problemId, item.id, item.question]), packContext.packId),
      type: 'problem',
      label,
      aliases: uniqueStrings([...getArray(item.tags), item.skill]),
      source: buildSourceLabel(packContext, item),
      packId: packContext.packId,
      standards: getStandards(item),
      metadata: {
        ...copyMetadata(item),
        question: item.question,
        expectedAnswer: item.expectedAnswer,
        workedSteps: item.workedSteps,
        answerType: item.answerType,
        index
      }
    });

    connectStandards(builder, node, standards, getStandards(item));
    connectSource(builder, packContext, item, node);
    connectExplicitConcept(builder, node, item, 'example_of');
    connectProblemTags(builder, node, item);
  });
}

function addPackSources(builder, pack, packContext) {
  getArray(pack.sourceFiles).forEach((item, index) => {
    if (!isApprovedKnowledgeItem(item)) return;
    const label = firstNonEmptyString([item.fileName, item.name, item.id]);
    if (!label) return;

    addNode(builder, {
      id: makeNodeId('source', label, packContext.packId),
      type: 'source',
      label,
      aliases: uniqueStrings([item.notes, item.fileType]),
      source: packContext.source,
      packId: packContext.packId,
      standards: [],
      metadata: {
        ...copyMetadata(item),
        index
      }
    });
  });

  if (!pack.source) return;

  addNode(builder, {
    id: makeNodeId('source', pack.source, packContext.packId),
    type: 'source',
    label: pack.source,
    aliases: [],
    source: packContext.source,
    packId: packContext.packId,
    standards: [],
    metadata: {}
  });
}

function addTeacherKnowledgeItem(builder, item, index) {
  if (!isApprovedKnowledgeItem(item)) return;

  const label = firstNonEmptyString([item.title, item.term, item.id]);
  if (!label) return;

  const type = inferTeacherKnowledgeNodeType(item);
  const node = addNode(builder, {
    id: makeNodeId(type, firstNonEmptyString([item.id, item.title, item.term]), 'teacher'),
    type,
    label,
    aliases: uniqueStrings([
      ...getArray(item.terms),
      ...getAliases(item),
      item.formula
    ]),
    source: firstNonEmptyString([item.source, 'teacher-approved local knowledge']),
    packId: '',
    standards: getStandards(item),
    metadata: {
      ...copyMetadata(item),
      fact: item.fact,
      formula: item.formula,
      examples: getArray(item.examples),
      index
    }
  });

  if (item.source) {
    const sourceNode = addNode(builder, {
      id: makeNodeId('source', item.source, 'teacher'),
      type: 'source',
      label: item.source,
      aliases: [],
      source: item.source,
      packId: '',
      standards: [],
      metadata: {}
    });
    addEdge(builder, sourceNode.id, node.id, 'source_supports', {
      label: 'source supports',
      confidence: confidenceValue(item),
      source: item.source
    });
  }
}

function addMotionForceSeedRelationships(builder) {
  MOTION_FORCE_SEED_RELATIONSHIPS.forEach(([fromLabel, toLabel, edgeType]) => {
    const from = findOrCreateSeedNode(builder, fromLabel);
    const to = findOrCreateSeedNode(builder, toLabel);

    addEdge(builder, from.id, to.id, edgeType, {
      label: edgeType.replace(/_/g, ' '),
      confidence: 'high',
      source: 'seed:motion-force'
    });
  });
}

function findOrCreateSeedNode(builder, label) {
  const normalized = normalizeGraphTerm(label);
  const existing = Object.values(builder.nodes)
    .find((node) => normalizeGraphTerm(node.label) === normalized);
  if (existing) return existing;

  return addNode(builder, {
    id: makeNodeId(MOTION_FORCE_SEED_NODE_TYPES[normalized] || 'concept', label, 'seed-motion-force'),
    type: MOTION_FORCE_SEED_NODE_TYPES[normalized] || 'concept',
    label,
    aliases: [],
    source: 'seed:motion-force',
    packId: 'seed-motion-force',
    standards: [],
    metadata: {
      seed: 'motion-force'
    }
  });
}

function connectStandards(builder, node, standardsMap, standards) {
  getArray(standards).forEach((standardId) => {
    const normalized = normalizeGraphTerm(standardId);
    let standardNodeId = standardsMap.get(normalized);

    if (!standardNodeId) {
      const standardNode = addNode(builder, {
        id: makeNodeId('standard', standardId, node.packId),
        type: 'standard',
        label: standardId,
        aliases: [],
        source: node.source,
        packId: node.packId,
        standards: [standardId],
        metadata: {}
      });
      standardNodeId = standardNode.id;
      standardsMap.set(normalized, standardNodeId);
    }

    addEdge(builder, node.id, standardNodeId, 'aligned_to_standard', {
      label: 'aligned to standard',
      confidence: 'high',
      source: node.source
    });
  });
}

function connectSource(builder, packContext, item, node) {
  const sourceLabel = firstNonEmptyString([
    item.sourceFile,
    item.source_file,
    item.source,
    item.sourcePages ? `${packContext.source || packContext.packTitle || 'source'} pages ${item.sourcePages}` : '',
    item.source_pages ? `${packContext.source || packContext.packTitle || 'source'} pages ${item.source_pages}` : ''
  ]);

  if (!sourceLabel) return;

  const sourceNode = addNode(builder, {
    id: makeNodeId('source', sourceLabel, packContext.packId),
    type: 'source',
    label: sourceLabel,
    aliases: uniqueStrings([item.sourceLocation, item.sourceTextSnippet]),
    source: packContext.source,
    packId: packContext.packId,
    standards: [],
    metadata: {}
  });

  addEdge(builder, sourceNode.id, node.id, 'source_supports', {
    label: 'source supports',
    confidence: confidenceValue(item),
    source: sourceLabel
  });
}

function connectExplicitConcept(builder, node, item, edgeType) {
  const conceptLabel = firstNonEmptyString([item.concept, item.conceptId]);
  if (!conceptLabel) return;

  const conceptNode = findNodeByTerm(builder, conceptLabel);
  if (!conceptNode || conceptNode.id === node.id) return;

  addEdge(builder, node.id, conceptNode.id, edgeType, {
    label: edgeType === 'example_of' ? 'example of' : 'uses concept',
    confidence: confidenceValue(item),
    source: node.source
  });

  if (node.type === 'problem') {
    addEdge(builder, conceptNode.id, node.id, 'assessed_by', {
      label: 'assessed by',
      confidence: confidenceValue(item),
      source: node.source
    });
  }
}

function connectProblemTags(builder, node, item) {
  uniqueStrings([...getArray(item.tags), item.skill]).forEach((tag) => {
    const relatedNode = findNodeByTerm(builder, tag);
    if (!relatedNode || relatedNode.id === node.id) return;

    addEdge(builder, node.id, relatedNode.id, 'uses_concept', {
      label: 'uses concept',
      confidence: confidenceValue(item),
      source: node.source
    });
  });
}

function addMisconceptionNodes(builder, node, item, packContext, itemIndex) {
  const misconceptions = uniqueStrings([
    item.misconception,
    item.commonMisconception,
    item.common_misconceptions,
    ...getArray(item.commonMisconceptions),
    ...getArray(item.common_misconceptions)
  ]);

  misconceptions.forEach((label, index) => {
    const misconceptionNode = addNode(builder, {
      id: makeNodeId('misconception', `${node.id}:${index + 1}:${label}`, packContext.packId),
      type: 'misconception',
      label,
      aliases: [],
      source: node.source,
      packId: packContext.packId,
      standards: node.standards,
      metadata: {
        parentNodeId: node.id,
        itemIndex,
        misconceptionIndex: index
      }
    });

    addEdge(builder, node.id, misconceptionNode.id, 'has_misconception', {
      label: 'has misconception',
      confidence: confidenceValue(item),
      source: node.source
    });
  });
}

function addNode(builder, node) {
  const type = NODE_TYPES.has(node.type) ? node.type : 'concept';
  const id = node.id || makeNodeId(type, node.label, node.packId);
  const existing = builder.nodes[id];

  const normalizedNode = {
    id,
    type,
    label: String(node.label || id).trim(),
    aliases: uniqueStrings(node.aliases),
    source: String(node.source || '').trim(),
    packId: String(node.packId || '').trim(),
    standards: uniqueStrings(node.standards),
    metadata: node.metadata && typeof node.metadata === 'object' && !Array.isArray(node.metadata)
      ? { ...node.metadata }
      : {}
  };

  if (existing) {
    existing.aliases = uniqueStrings([...existing.aliases, ...normalizedNode.aliases]);
    existing.standards = uniqueStrings([...existing.standards, ...normalizedNode.standards]);
    existing.source = existing.source || normalizedNode.source;
    existing.packId = existing.packId || normalizedNode.packId;
    existing.metadata = {
      ...normalizedNode.metadata,
      ...existing.metadata
    };
    indexNodeTerms(builder, existing);
    return existing;
  }

  builder.nodes[id] = normalizedNode;
  indexNodeTerms(builder, normalizedNode);
  return normalizedNode;
}

function addEdge(builder, from, to, type, options = {}) {
  if (!from || !to || !builder.nodes[from] || !builder.nodes[to]) return null;
  if (!EDGE_TYPES.has(type)) return null;

  const edge = {
    from,
    to,
    type,
    label: String(options.label || type.replace(/_/g, ' ')).trim(),
    confidence: String(options.confidence || 'medium').trim(),
    source: String(options.source || '').trim()
  };
  const key = [edge.from, edge.to, edge.type, normalizeGraphTerm(edge.label), edge.source].join('|');
  if (builder.edgeKeys.has(key)) return null;

  builder.edgeKeys.add(key);
  builder.edges.push(edge);
  return edge;
}

function finalizeGraph(builder) {
  const nodes = {};
  Object.values(builder.nodes)
    .sort(compareNodes)
    .forEach((node) => {
      nodes[node.id] = cloneNode(node);
    });

  const edges = builder.edges
    .slice()
    .sort(compareEdges)
    .map(cloneEdge);

  const adjacency = {};
  Object.keys(nodes).forEach((nodeId) => {
    adjacency[nodeId] = [];
  });
  edges.forEach((edge) => {
    if (!adjacency[edge.from]) adjacency[edge.from] = [];
    adjacency[edge.from].push(cloneEdge(edge));
  });

  Object.keys(adjacency).forEach((nodeId) => {
    adjacency[nodeId].sort(compareEdges);
  });

  return {
    nodes,
    edges,
    adjacency
  };
}

function normalizePackRecords(packRecords) {
  if (!Array.isArray(packRecords)) return [];
  return packRecords.filter((record) => record && typeof record === 'object' && !Array.isArray(record));
}

function normalizeTeacherKnowledgeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

function normalizeGraphShape(graph) {
  if (!graph || typeof graph !== 'object') {
    return { nodes: {}, edges: [], adjacency: {} };
  }

  return {
    nodes: graph.nodes && typeof graph.nodes === 'object' ? graph.nodes : {},
    edges: Array.isArray(graph.edges) ? graph.edges : [],
    adjacency: graph.adjacency && typeof graph.adjacency === 'object' ? graph.adjacency : {}
  };
}

function findBestTermMatch(normalizedMessage, terms, minTermLength) {
  const normalizedTerms = uniqueStrings(terms)
    .map((term) => ({
      term,
      normalizedTerm: normalizeGraphTerm(term)
    }))
    .filter((entry) => entry.normalizedTerm.length >= minTermLength)
    .filter((entry) => entry.normalizedTerm.split(/\s+/).length > 1 || entry.normalizedTerm.length >= minTermLength)
    .sort((left, right) => right.normalizedTerm.length - left.normalizedTerm.length || left.term.localeCompare(right.term));

  for (const entry of normalizedTerms) {
    const index = findWholePhraseIndex(normalizedMessage, entry.normalizedTerm);
    if (index !== -1) return { ...entry, index };
  }

  return null;
}

function findWholePhraseIndex(normalizedText, normalizedTerm) {
  if (!normalizedText || !normalizedTerm) return -1;
  const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(normalizedTerm)}(?:\\s|$)`);
  const match = normalizedText.match(pattern);
  if (!match || match.index === undefined) return -1;
  return match.index + (match[0].startsWith(' ') ? 1 : 0);
}

function buildDirectedNeighborMap(graph) {
  const neighbors = {};
  graph.edges.forEach((edge) => {
    if (!neighbors[edge.from]) neighbors[edge.from] = [];
    neighbors[edge.from].push({
      nodeId: edge.to,
      edge,
      direction: 'forward'
    });
  });
  sortNeighborMap(neighbors, graph);
  return neighbors;
}

function buildUndirectedNeighborMap(graph) {
  const neighbors = {};
  graph.edges.forEach((edge) => {
    if (!neighbors[edge.from]) neighbors[edge.from] = [];
    if (!neighbors[edge.to]) neighbors[edge.to] = [];

    neighbors[edge.from].push({
      nodeId: edge.to,
      edge,
      direction: 'forward'
    });
    neighbors[edge.to].push({
      nodeId: edge.from,
      edge,
      direction: 'reverse'
    });
  });
  sortNeighborMap(neighbors, graph);
  return neighbors;
}

function sortNeighborMap(neighbors, graph) {
  Object.keys(neighbors).forEach((nodeId) => {
    neighbors[nodeId].sort((left, right) => {
      const leftNode = graph.nodes[left.nodeId] || {};
      const rightNode = graph.nodes[right.nodeId] || {};
      return compareNodes(leftNode, rightNode) || compareEdges(left.edge, right.edge);
    });
  });
}

function indexNodeTerms(builder, node) {
  uniqueStrings([node.label, ...(Array.isArray(node.aliases) ? node.aliases : [])]).forEach((term) => {
    const normalized = normalizeGraphTerm(term);
    if (!normalized) return;
    if (!builder.termIndex[normalized]) builder.termIndex[normalized] = node.id;
  });
}

function findNodeByTerm(builder, term) {
  const normalized = normalizeGraphTerm(term);
  if (!normalized) return null;
  const nodeId = builder.termIndex[normalized];
  return nodeId ? builder.nodes[nodeId] : null;
}

function makeNodeId(type, value, packId) {
  const normalizedType = NODE_TYPES.has(type) ? type : 'concept';
  const normalizedValue = slugify(value) || 'node';
  const normalizedPackId = slugify(packId);
  return normalizedPackId
    ? `${normalizedType}:${normalizedPackId}:${normalizedValue}`
    : `${normalizedType}:${normalizedValue}`;
}

function slugify(value) {
  return normalizeGraphTerm(value).replace(/\s+/g, '-');
}

function getAliases(item = {}) {
  return uniqueStrings([
    ...getArray(item.aliases),
    ...splitAliasString(item.synonyms_or_aliases),
    ...splitAliasString(item.synonymsOrAliases)
  ]);
}

function splitAliasString(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getStandards(item = {}) {
  return uniqueStrings([
    ...getLinkedStandardIds(item),
    ...getArray(item.standardIds),
    ...getArray(item.linkedStandardIds)
  ]);
}

function getArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined);
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function isApprovedKnowledgeItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  if (!Object.prototype.hasOwnProperty.call(item, 'reviewStatus')) return true;
  return item.reviewStatus === APPROVED_STATUS;
}

function inferTeacherKnowledgeNodeType(item) {
  const category = normalizeGraphTerm(item.category);
  if (category.includes('formula') || item.formula) return 'formula';
  if (category.includes('problem')) return 'problem';
  if (category.includes('misconception')) return 'misconception';
  if (category.includes('concept')) return 'concept';
  if (category.includes('standard')) return 'standard';
  if (category.includes('source')) return 'source';
  return 'vocabulary';
}

function confidenceValue(item = {}) {
  return firstNonEmptyString([item.confidence, item.confidenceLevel]) || 'medium';
}

function buildSourceLabel(packContext, item = {}) {
  return uniqueStrings([
    packContext.packTitle ? `Approved pack: ${packContext.packTitle}` : '',
    packContext.packId ? `(${packContext.packId})` : '',
    item.sourceFile ? `Source file: ${item.sourceFile}` : '',
    item.sourceLocation ? `Source location: ${item.sourceLocation}` : '',
    item.sourcePages ? `Pages: ${item.sourcePages}` : '',
    item.source_pages ? `Pages: ${item.source_pages}` : ''
  ]).join(' | ');
}

function copyMetadata(item = {}) {
  const metadata = {};
  Object.keys(item).forEach((key) => {
    if ([
      'aliases',
      'standards',
      'standardIds',
      'linkedStandardIds',
      'reviewStatus',
      'confidence'
    ].includes(key)) return;

    const value = item[key];
    if (value === undefined) return;
    metadata[key] = value;
  });
  return metadata;
}

function cloneNode(node) {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    aliases: Array.isArray(node.aliases) ? node.aliases.slice() : [],
    source: node.source || '',
    packId: node.packId || '',
    standards: Array.isArray(node.standards) ? node.standards.slice() : [],
    metadata: node.metadata && typeof node.metadata === 'object' && !Array.isArray(node.metadata)
      ? { ...node.metadata }
      : {}
  };
}

function cloneNodeForPath(node) {
  return {
    id: node.id,
    type: node.type,
    label: node.label
  };
}

function cloneEdge(edge) {
  return {
    from: edge.from,
    to: edge.to,
    type: edge.type,
    label: edge.label,
    confidence: edge.confidence,
    source: edge.source
  };
}

function compareNodes(left, right) {
  return String(left.type || '').localeCompare(String(right.type || '')) ||
    String(left.label || '').localeCompare(String(right.label || '')) ||
    String(left.id || '').localeCompare(String(right.id || ''));
}

function compareEdges(left, right) {
  return String(left.from || '').localeCompare(String(right.from || '')) ||
    String(left.to || '').localeCompare(String(right.to || '')) ||
    String(left.type || '').localeCompare(String(right.type || '')) ||
    String(left.label || '').localeCompare(String(right.label || ''));
}

function firstNonEmptyString(values) {
  for (const value of values || []) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function uniqueStrings(values) {
  const seen = new Set();
  const results = [];

  getArray(values).flat().forEach((value) => {
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  normalizeGraphTerm,
  buildKnowledgeGraph,
  findGraphContext,
  explainGraphPath
};
