const { normalizeGraphTerm } = require('./knowledgeGraph');
const {
  cleanSentence: cleanGraphSentence,
  formatGraphPath: formatSharedGraphPath,
  lowerFirst: lowerGraphFirst
} = require('./graphResponseUtils');

const CRITICAL_ROUTE_TYPES = new Set([
  'science_formula',
  'math_only',
  'chemistry_formula',
  'periodic_table',
  'circuit_diagram',
  'circuit_diagram_followup'
]);

const TYPE_PRIORITY = {
  vocabulary: 0,
  concept: 1,
  formula: 2,
  problem: 3,
  standard: 4,
  misconception: 5,
  source: 6
};

function canAnswerWithGraph(message, route, graphContext) {
  if (!hasRelationshipIntent(message)) return false;
  if (!hasUsableGraphContext(graphContext)) return false;
  if (isCriticalRoute(route)) return false;
  if (shouldPreserveExistingRoute(message, route)) return false;

  return true;
}

function buildGraphAnswer(message, graphContext, options = {}) {
  const concepts = selectConnectedConcepts(message, graphContext);
  if (concepts.length < 2) return null;

  const edge = selectConnectionEdge(concepts, graphContext);
  const path = edge ? buildEdgePath(edge, graphContext) : selectPath(concepts, graphContext);
  if (!path) return null;

  const primary = concepts[0];
  const secondary = concepts[1];
  const intent = getRelationshipIntent(message);
  const directSentence = buildDirectSentence(primary, secondary, edge, intent);
  const connectionLine = `Connection: ${formatGraphPath(path)}`;
  const explanation = buildExplanation(primary, secondary, edge, intent);
  const watchOut = buildWatchOut(primary, secondary, graphContext);
  const lines = [directSentence, connectionLine, explanation];
  if (watchOut) lines.push(`Watch out: ${watchOut}`);

  return {
    type: 'knowledge_graph_answer',
    aiAllowed: false,
    directAnswer: lines.filter(Boolean).join('\n'),
    explanation,
    graphPath: path,
    connectedConcepts: concepts.map((concept) => concept.label),
    source: options.source || 'approved_knowledge_graph'
  };
}

function hasRelationshipIntent(message) {
  const normalized = normalizeGraphTerm(message);
  if (!normalized) return false;
  if (isMotionGraphAxisVs(normalized)) return false;

  return /\b(?:related|relate|relationship|connection|connected|connects|difference|different|compare|comparison|vs|versus)\b/.test(normalized) ||
    /\bwhy\s+(?:does|do|is|are)\b.+\bmatter\s+(?:for|to)\b/.test(normalized) ||
    /\bmatter\s+(?:for|to)\b/.test(normalized) ||
    /\bhow\s+(?:does|do|is|are)\b.+\b(?:relate|connect)\b/.test(normalized);
}

function hasUsableGraphContext(graphContext) {
  if (!graphContext || graphContext.aiAllowed !== false) return false;

  const concepts = selectConnectedConcepts('', graphContext);
  if (concepts.length >= 2) return true;

  return (graphContext.possiblePaths || []).some((path) => isClearPath(path));
}

function isCriticalRoute(route = {}) {
  if (!route) return false;
  if (CRITICAL_ROUTE_TYPES.has(route.type)) return true;
  if (route.formulaWork || route.calculatorResult || route.motionForceTutor) return true;
  if (route.public?.formulaWork || route.public?.calculator || route.public?.motionForceTutor) return true;
  if (String(route.type || '').includes('tutor')) return true;
  return false;
}

function shouldPreserveExistingRoute(message, route = {}) {
  if (!route) return false;
  if (route.pendingClarification || route.public?.pendingClarification) return true;
  if (route.confidence !== 'strong') return false;
  if (!route.directAnswer) return false;

  const intent = getRelationshipIntent(message);
  if (intent) return false;

  return true;
}

function getRelationshipIntent(message) {
  const normalized = normalizeGraphTerm(message);
  if (isMotionGraphAxisVs(normalized)) return '';
  if (/\b(?:difference|different|compare|comparison|vs|versus)\b/.test(normalized)) return 'difference';
  if (/\bwhy\s+(?:does|do|is|are)\b.+\bmatter\s+(?:for|to)\b/.test(normalized) || /\bmatter\s+(?:for|to)\b/.test(normalized)) {
    return 'why_matter';
  }
  if (/\b(?:connection|connected|connects|relate|related|relationship)\b/.test(normalized)) return 'relationship';
  return '';
}

function selectConnectedConcepts(message, graphContext) {
  const candidates = (graphContext?.matchedNodes || [])
    .filter((node) => isConceptNode(node))
    .map((node) => toConceptCandidate(node))
    .filter((node) => isUsefulConceptKey(node.key));

  const byKey = new Map();
  candidates.forEach((candidate) => {
    const existing = byKey.get(candidate.key);
    if (!existing || compareConceptCandidates(candidate, existing) < 0) {
      byKey.set(candidate.key, candidate);
    }
  });

  const messageOrder = getMessageTermOrder(message, Array.from(byKey.values()));
  return Array.from(byKey.values())
    .sort((left, right) => {
      const leftOrder = messageOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = messageOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || compareConceptCandidates(left, right);
    })
    .slice(0, 3);
}

function isConceptNode(node = {}) {
  return !new Set(['source', 'standard', 'misconception', 'problem']).has(String(node.type || ''));
}

function isUsefulConceptKey(key) {
  const normalized = normalizeGraphTerm(key);
  if (!normalized) return false;
  if (/\b(?:and|or|from|with|plus)\b/.test(normalized)) return false;
  return normalized.split(/\s+/).length <= 3;
}

function toConceptCandidate(node = {}) {
  const matchedTerm = normalizeGraphTerm(node.matchedTerm);
  const label = String(node.label || node.matchedTerm || '').trim();
  const normalizedLabel = normalizeGraphTerm(label);
  const key = matchedTerm && matchedTerm.length <= normalizedLabel.length
    ? matchedTerm
    : normalizedLabel;

  return {
    id: String(node.id || ''),
    type: String(node.type || ''),
    label: titleCase(key || label),
    rawLabel: label,
    key,
    definition: cleanDefinition(node.definition),
    misconception: cleanSentence(node.misconception),
    example: cleanSentence(node.example),
    matchedTerm: String(node.matchedTerm || '')
  };
}

function compareConceptCandidates(left, right) {
  const priorityDifference = getTypePriority(left.type) - getTypePriority(right.type);
  if (priorityDifference !== 0) return priorityDifference;

  const leftExact = normalizeGraphTerm(left.rawLabel) === left.key ? 0 : 1;
  const rightExact = normalizeGraphTerm(right.rawLabel) === right.key ? 0 : 1;
  if (leftExact !== rightExact) return leftExact - rightExact;

  return left.rawLabel.localeCompare(right.rawLabel);
}

function getTypePriority(type) {
  return TYPE_PRIORITY[type] ?? 10;
}

function getMessageTermOrder(message, concepts) {
  const normalized = normalizeGraphTerm(message);
  const order = new Map();

  concepts.forEach((concept) => {
    const index = normalized.indexOf(concept.key);
    if (index >= 0) order.set(concept.key, index);
  });

  return order;
}

function selectConnectionEdge(concepts, graphContext) {
  const idsByKey = buildNodeIdsByKey(graphContext);
  const conceptIds = concepts.flatMap((concept) => idsByKey.get(concept.key) || [concept.id]).filter(Boolean);
  const conceptIdSet = new Set(conceptIds);

  return (graphContext?.edges || [])
    .filter((edge) => conceptIdSet.has(edge.from) && conceptIdSet.has(edge.to))
    .filter((edge) => !isLowValueEdge(edge))
    .sort(compareEdgesForAnswer)[0] || null;
}

function buildNodeIdsByKey(graphContext) {
  const idsByKey = new Map();
  const nodes = [
    ...(graphContext?.matchedNodes || []),
    ...(graphContext?.relatedNodes || [])
  ];

  nodes.forEach((node) => {
    if (!isConceptNode(node)) return;
    const candidate = toConceptCandidate(node);
    if (!candidate.key || !candidate.id) return;
    const ids = idsByKey.get(candidate.key) || [];
    ids.push(candidate.id);
    idsByKey.set(candidate.key, ids);
  });

  return idsByKey;
}

function isLowValueEdge(edge = {}) {
  return new Set(['source_supports', 'assessed_by', 'example_of']).has(String(edge.type || ''));
}

function compareEdgesForAnswer(left, right) {
  const leftScore = getEdgePriority(left);
  const rightScore = getEdgePriority(right);
  if (leftScore !== rightScore) return leftScore - rightScore;
  return String(left.label || '').localeCompare(String(right.label || ''));
}

function getEdgePriority(edge = {}) {
  if (edge.type === 'commonly_confused_with') return 0;
  if (edge.type === 'related_to') return 1;
  if (edge.type === 'uses_concept') return 2;
  if (edge.type === 'prerequisite_for') return 3;
  return 4;
}

function buildEdgePath(edge, graphContext) {
  const nodes = [
    findNodeForEdge(edge.from, graphContext),
    findNodeForEdge(edge.to, graphContext)
  ].filter(Boolean);

  if (nodes.length < 2) return null;

  return {
    found: true,
    from: edge.from,
    to: edge.to,
    length: 1,
    nodes,
    edges: [{
      from: edge.from,
      to: edge.to,
      type: edge.type,
      label: edge.label,
      confidence: edge.confidence,
      direction: edge.direction || 'forward'
    }]
  };
}

function selectPath(concepts, graphContext) {
  const conceptKeys = new Set(concepts.map((concept) => concept.key));
  return (graphContext?.possiblePaths || [])
    .filter((path) => isClearPath(path))
    .filter((path) => {
      const pathLabels = (path.nodes || []).map((node) => normalizeGraphTerm(node.label));
      return Array.from(conceptKeys).filter((key) => pathLabels.includes(key)).length >= 2;
    })
    .sort((left, right) => left.length - right.length)[0] || null;
}

function isClearPath(path = {}) {
  if (!path.found || !Array.isArray(path.nodes) || !Array.isArray(path.edges)) return false;
  if (path.nodes.length < 2 || path.edges.length < 1) return false;
  return path.edges.some((edge) => !isLowValueEdge(edge));
}

function findNodeForEdge(nodeId, graphContext) {
  const node = [
    ...(graphContext?.matchedNodes || []),
    ...(graphContext?.relatedNodes || [])
  ].find((candidate) => candidate.id === nodeId);

  if (!node) return null;
  return {
    id: node.id,
    type: node.type,
    label: node.label
  };
}

function buildDirectSentence(primary, secondary, edge, intent) {
  const pair = getPairKey(primary, secondary);
  if (pair === 'displacement|distance') {
    return 'Distance is the total path traveled, while displacement is the change from start to finish in a direction.';
  }

  if (pair === 'speed|velocity') {
    return 'Speed and velocity are related because both describe how fast something moves, but velocity also includes direction.';
  }

  if (pair === 'displacement|velocity') {
    return 'Displacement and velocity are connected because velocity uses displacement over time and includes direction.';
  }

  if (pair === 'acceleration|force') {
    return 'Force and acceleration are connected because a net force can change an object\'s acceleration.';
  }

  if (intent === 'difference') {
    return `${primary.label} and ${secondary.label} are different: ${formatDefinition(primary)} while ${formatDefinition(secondary)}.`;
  }

  const relationship = formatRelationshipPhrase(edge);
  return `${primary.label} and ${secondary.label} are connected because the approved graph marks ${primary.label} as ${relationship} ${secondary.label}.`;
}

function buildExplanation(primary, secondary, edge, intent) {
  const pair = getPairKey(primary, secondary);
  if (pair === 'displacement|distance') {
    return 'Think of distance as the whole path you traveled, and displacement as the shortest start-to-finish change with direction.';
  }

  if (pair === 'speed|velocity') {
    return 'Think of speed as "how fast," and velocity as "how fast in what direction."';
  }

  if (pair === 'displacement|velocity') {
    return 'Velocity needs direction, and displacement is the motion idea that keeps track of start-to-finish direction.';
  }

  if (pair === 'acceleration|force') {
    return 'With the same mass, a larger net force means a larger acceleration.';
  }

  if (intent === 'difference') {
    return `${primary.label}: ${formatDefinition(primary)} ${secondary.label}: ${formatDefinition(secondary)}`;
  }

  return `${primary.label}: ${formatDefinition(primary)} ${secondary.label}: ${formatDefinition(secondary)}`;
}

function buildWatchOut(primary, secondary, graphContext) {
  const pair = getPairKey(primary, secondary);
  const misconception = findMisconception(primary, secondary, graphContext);
  if (!misconception) return '';

  if (pair === 'displacement|distance') {
    return 'They are not always the same. If you walk away and come back, your distance can be large while your displacement can be small or zero.';
  }

  if (pair === 'speed|velocity') {
    return 'Speed does not include direction, but velocity does.';
  }

  return misconception;
}

function findMisconception(primary, secondary, graphContext) {
  const nodeMisconception = [primary.misconception, secondary.misconception].find(Boolean);
  if (nodeMisconception) return nodeMisconception;

  const conceptKeys = new Set([primary.key, secondary.key]);
  const misconceptionNode = (graphContext?.relatedNodes || [])
    .find((node) => node.type === 'misconception' && mentionsAnyConcept(node.label, conceptKeys));
  return cleanSentence(misconceptionNode?.label);
}

function mentionsAnyConcept(value, conceptKeys) {
  const normalized = normalizeGraphTerm(value);
  return Array.from(conceptKeys).some((key) => normalized.includes(key));
}

function formatGraphPath(path) {
  return formatSharedGraphPath(path, {
    nodeFormatter: formatNodeLabel,
    relationshipFormatter: formatRelationshipPhrase
  });
}

function formatRelationshipPhrase(edge = {}) {
  return String(edge.label || edge.type || 'related to').replace(/_/g, ' ').trim() || 'related to';
}

function formatNodeLabel(label) {
  return titleCase(normalizeGraphTerm(label) || label);
}

function formatDefinition(concept) {
  const definition = cleanDefinition(concept.definition);
  if (definition) return lowerFirst(definition);
  return `the graph includes ${concept.label}`;
}

function cleanDefinition(value) {
  return cleanSentence(value).replace(/\.$/, '');
}

function cleanSentence(value) {
  return cleanGraphSentence(value, {
    maxLength: null,
    trimTrailingPunctuation: false
  });
}

function getPairKey(primary, secondary) {
  return [primary.key, secondary.key].sort().join('|');
}

function isMotionGraphAxisVs(normalized) {
  return /\b(?:distance|position|velocity|speed)\s+(?:vs|versus)\s+time\s+graph\b/.test(normalized) ||
    (/\b(?:distance|position|velocity|speed)\s+(?:vs|versus)\s*time\b/.test(normalized) && /\bgraph\b/.test(normalized));
}

function titleCase(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function lowerFirst(value) {
  return lowerGraphFirst(value, { maxLength: null });
}

module.exports = {
  canAnswerWithGraph,
  buildGraphAnswer
};
