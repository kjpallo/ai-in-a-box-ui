const { normalizeGraphTerm } = require('../knowledge/knowledgeGraph');
const {
  cleanLabel: cleanGraphLabel,
  cleanSentence: cleanGraphSentence,
  formatList: formatGraphList,
  isApprovedGraphContext
} = require('../knowledge/graphResponseUtils');

const SOURCE = 'approved_knowledge_graph';
const STUDENT_CONCEPT_TYPES = new Set(['vocabulary', 'concept']);
const EXCLUDED_EDGE_TYPES = new Set(['source_supports', 'assessed_by', 'example_of']);

function cleanLabel(value) {
  return cleanGraphLabel(value, { maxLength: 80 });
}

function cleanSentence(value) {
  return cleanGraphSentence(value, {
    maxLength: 160,
    ensureTerminalPunctuation: true
  });
}

function formatList(labels) {
  return formatGraphList(labels, {
    cleanItem: cleanLabel,
    formatItem: cleanLabel
  });
}

function buildGraphTutorSupport(questionRoute, graphContext, options = {}) {
  const support = emptySupport();
  if (!isApprovedGraphContext(graphContext)) return support;

  const nodes = uniqueNodes([
    ...(Array.isArray(graphContext.matchedNodes) ? graphContext.matchedNodes : []),
    ...(Array.isArray(graphContext.relatedNodes) ? graphContext.relatedNodes : [])
  ]);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = (Array.isArray(graphContext.edges) ? graphContext.edges : [])
    .filter((edge) => edge && !EXCLUDED_EDGE_TYPES.has(String(edge.type || '')));
  const anchorIds = getAnchorIds(questionRoute, graphContext, nodes);

  support.connectedConcepts = selectConnectedConcepts(nodes, edges, anchorIds, options);
  support.prerequisiteConcepts = selectPrerequisites(edges, nodeById, anchorIds, options);
  support.commonMisconceptions = selectMisconceptions(nodes, edges, nodeById, support, options);
  support.whyItMatters = selectWhyItMatters(edges, nodeById, anchorIds, support, options);
  support.graphPaths = selectGraphPaths(graphContext.possiblePaths, options);

  return support;
}

function buildGraphTutorHint(tutorState, graphTutorSupport, options = {}) {
  if (!isGraphTutorSupport(graphTutorSupport)) return '';

  const message = String(options.message || tutorState?.latestStudentReply || '').trim();
  const intent = options.intent || inferHintIntent(message);
  const target = cleanLabel(options.target || tutorState?.solveFor || graphTutorSupport.connectedConcepts?.[0]?.label || '');

  if (intent === 'why_it_matters') {
    const targetKey = normalizeGraphTerm(target);
    const bridges = Array.isArray(graphTutorSupport.whyItMatters) ? graphTutorSupport.whyItMatters : [];
    const bridge = bridges
      .find((entry) => targetKey && normalizeGraphTerm(entry?.concept) === targetKey && /\bused to understand\b/i.test(entry?.bridge || '')) ||
      bridges.find((entry) => targetKey && normalizeGraphTerm(entry?.concept) === targetKey) ||
      firstUsable(bridges);
    if (bridge?.bridge) return cleanSentence(`This matters because ${bridge.bridge}`);
  }

  const prerequisiteLine = summarizePrerequisites(graphTutorSupport, { target });
  if (prerequisiteLine) return prerequisiteLine;

  const misconception = firstUsable(graphTutorSupport.commonMisconceptions);
  if (misconception?.warning) return cleanSentence(`Watch out: ${misconception.warning}`);

  const connectedLabels = graphTutorSupport.connectedConcepts
    .map((concept) => cleanLabel(concept.label))
    .filter(Boolean)
    .slice(0, 3);
  if (connectedLabels.length >= 2) {
    return cleanSentence(`Helpful connection: This problem connects ${formatList(connectedLabels)}.`);
  }

  return '';
}

function summarizePrerequisites(graphTutorSupport, options = {}) {
  if (!isGraphTutorSupport(graphTutorSupport)) return '';

  const labels = graphTutorSupport.prerequisiteConcepts
    .map((concept) => cleanLabel(concept.label))
    .filter(Boolean)
    .slice(0, 3);
  if (!labels.length) return '';

  const target = cleanLabel(options.target || graphTutorSupport.connectedConcepts?.[0]?.label || '');
  if (target) {
    return cleanSentence(`Before solving ${target}, make sure you know ${formatList(labels)}.`);
  }
  return cleanSentence(`Before solving, make sure you know ${formatList(labels)}.`);
}

function emptySupport() {
  return {
    aiAllowed: false,
    source: SOURCE,
    connectedConcepts: [],
    prerequisiteConcepts: [],
    commonMisconceptions: [],
    whyItMatters: [],
    graphPaths: []
  };
}

function isGraphTutorSupport(value) {
  return value &&
    value.aiAllowed === false &&
    value.source === SOURCE &&
    Array.isArray(value.connectedConcepts) &&
    Array.isArray(value.prerequisiteConcepts) &&
    Array.isArray(value.commonMisconceptions) &&
    Array.isArray(value.whyItMatters) &&
    Array.isArray(value.graphPaths);
}

function getAnchorIds(questionRoute, graphContext, nodes) {
  const anchorIds = new Set(
    (Array.isArray(graphContext.matchedNodes) ? graphContext.matchedNodes : [])
      .filter(isStudentConceptNode)
      .map((node) => node.id)
      .filter(Boolean)
  );

  const solveFor = normalizeGraphTerm(questionRoute?.formulaWork?.solveFor || questionRoute?.public?.formulaWork?.solveFor || '');
  if (solveFor) {
    nodes
      .filter(isStudentConceptNode)
      .filter((node) => normalizeGraphTerm(node.label) === solveFor || normalizeGraphTerm(node.matchedTerm) === solveFor)
      .forEach((node) => anchorIds.add(node.id));
  }

  return anchorIds;
}

function selectConnectedConcepts(nodes, edges, anchorIds, options = {}) {
  const maxConcepts = getLimit(options.maxConnectedConcepts, 6);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const candidates = [];

  nodes.forEach((node) => {
    if (anchorIds.has(node.id) && isStudentConceptNode(node)) candidates.push(node);
  });

  edges.forEach((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (anchorIds.has(edge.from) && isStudentConceptNode(to)) candidates.push(to);
    if (anchorIds.has(edge.to) && isStudentConceptNode(from)) candidates.push(from);
  });

  nodes.forEach((node) => {
    if (isStudentConceptNode(node)) candidates.push(node);
  });

  return uniqueNodes(candidates)
    .sort((left, right) => compareStudentConcepts(left, right, anchorIds))
    .slice(0, maxConcepts)
    .map(toStudentConcept);
}

function selectPrerequisites(edges, nodeById, anchorIds, options = {}) {
  const maxPrerequisites = getLimit(options.maxPrerequisiteConcepts, 4);
  const prerequisites = [];

  edges.forEach((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (edge.type === 'uses_concept' && anchorIds.has(edge.from) && isStudentConceptNode(to)) {
      prerequisites.push(to);
    }
    if (edge.type === 'prerequisite_for' && anchorIds.has(edge.to) && isStudentConceptNode(from)) {
      prerequisites.push(from);
    }
  });

  return uniqueNodes(prerequisites)
    .sort((left, right) => compareStudentConcepts(left, right, anchorIds))
    .slice(0, maxPrerequisites)
    .map(toStudentConcept);
}

function selectMisconceptions(nodes, edges, nodeById, support, options = {}) {
  const maxMisconceptions = getLimit(options.maxMisconceptions, 4);
  const concepts = [
    ...support.connectedConcepts,
    ...support.prerequisiteConcepts
  ];
  const conceptIds = new Set(concepts.map((concept) => concept.id).filter(Boolean));
  const warnings = [];
  const labels = new Set(concepts.map((concept) => normalizeGraphTerm(concept.label)));

  if (labels.has('speed') && labels.has('velocity')) {
    warnings.push({
      concept: 'velocity',
      warning: 'speed and velocity are related, but velocity includes direction.'
    });
  }

  nodes.forEach((node) => {
    if (!conceptIds.has(node.id) || !isStudentConceptNode(node)) return;
    const warning = cleanSentence(node.misconception);
    if (warning) warnings.push({ concept: cleanLabel(node.label), warning });
  });

  edges.forEach((edge) => {
    if (edge.type !== 'has_misconception') return;
    const concept = nodeById.get(edge.from);
    const misconception = nodeById.get(edge.to);
    if (!conceptIds.has(edge.from) || !misconception || misconception.type !== 'misconception') return;
    const warning = cleanSentence(misconception.label || misconception.definition);
    if (warning) warnings.push({ concept: cleanLabel(concept?.label), warning });
  });

  return uniqueBy(warnings, (entry) => normalizeGraphTerm(`${entry.concept} ${entry.warning}`))
    .slice(0, maxMisconceptions);
}

function selectWhyItMatters(edges, nodeById, anchorIds, support, options = {}) {
  const maxBridges = getLimit(options.maxWhyItMatters, 4);
  const bridges = [];
  const prerequisiteLabels = support.prerequisiteConcepts.map((concept) => cleanLabel(concept.label)).filter(Boolean);

  edges.forEach((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);

    if (edge.type === 'uses_concept' && anchorIds.has(edge.to) && isStudentConceptNode(from) && isStudentConceptNode(to)) {
      bridges.push({
        concept: cleanLabel(to.label),
        bridge: `${cleanLabel(to.label)} is used to understand ${cleanLabel(from.label)}.`
      });
    }

    if (edge.type === 'uses_concept' && anchorIds.has(edge.from) && isStudentConceptNode(from) && prerequisiteLabels.length > 0) {
      bridges.push({
        concept: cleanLabel(from.label),
        bridge: `${cleanLabel(from.label)} depends on ${formatList(prerequisiteLabels.slice(0, 2))}.`
      });
    }

    if (edge.type === 'prerequisite_for' && anchorIds.has(edge.from) && isStudentConceptNode(from) && isStudentConceptNode(to)) {
      bridges.push({
        concept: cleanLabel(from.label),
        bridge: `${cleanLabel(from.label)} helps prepare you for ${cleanLabel(to.label)}.`
      });
    }

    if (edge.type === 'related_to' && (anchorIds.has(edge.from) || anchorIds.has(edge.to)) && isStudentConceptNode(from) && isStudentConceptNode(to)) {
      const anchor = anchorIds.has(edge.from) ? from : to;
      const other = anchorIds.has(edge.from) ? to : from;
      bridges.push({
        concept: cleanLabel(anchor.label),
        bridge: `${cleanLabel(anchor.label)} connects to ${cleanLabel(other.label)}.`
      });
    }
  });

  return uniqueBy(bridges, (entry) => normalizeGraphTerm(`${entry.concept} ${entry.bridge}`))
    .slice(0, maxBridges);
}

function selectGraphPaths(paths, options = {}) {
  const maxPaths = getLimit(options.maxGraphPaths, 3);
  return (Array.isArray(paths) ? paths : [])
    .slice(0, maxPaths)
    .map((path) => ({
      nodes: (Array.isArray(path.nodes) ? path.nodes : [])
        .filter(isStudentConceptNode)
        .map((node) => cleanLabel(node.label))
        .filter(Boolean),
      edges: (Array.isArray(path.edges) ? path.edges : [])
        .filter((edge) => !EXCLUDED_EDGE_TYPES.has(String(edge.type || '')))
        .map((edge) => cleanLabel(edge.label || String(edge.type || '').replace(/_/g, ' ')))
        .filter(Boolean)
    }))
    .filter((path) => path.nodes.length > 1);
}

function inferHintIntent(message) {
  const normalized = normalizeGraphTerm(message).replace(/\bwhats\b/g, 'what is');
  if (/\b(?:what is the point|why does this matter|why is this important|what is this for)\b/.test(normalized)) {
    return 'why_it_matters';
  }
  return 'scaffold';
}

function isStudentConceptNode(node = {}) {
  return STUDENT_CONCEPT_TYPES.has(String(node.type || '')) && cleanLabel(node.label);
}

function toStudentConcept(node = {}) {
  return {
    id: String(node.id || ''),
    type: String(node.type || ''),
    label: cleanLabel(node.label)
  };
}

function compareStudentConcepts(left, right, anchorIds) {
  const leftAnchor = anchorIds.has(left.id) ? 0 : 1;
  const rightAnchor = anchorIds.has(right.id) ? 0 : 1;
  if (leftAnchor !== rightAnchor) return leftAnchor - rightAnchor;

  const leftType = left.type === 'vocabulary' ? 0 : 1;
  const rightType = right.type === 'vocabulary' ? 0 : 1;
  if (leftType !== rightType) return leftType - rightType;

  return cleanLabel(left.label).localeCompare(cleanLabel(right.label));
}

function uniqueNodes(nodes) {
  return uniqueBy(
    (Array.isArray(nodes) ? nodes : [])
      .filter((node) => node && typeof node === 'object')
      .map((node) => ({
        ...node,
        id: String(node.id || ''),
        type: String(node.type || ''),
        label: cleanLabel(node.label),
        matchedTerm: cleanLabel(node.matchedTerm),
        misconception: cleanSentence(node.misconception),
        definition: cleanSentence(node.definition)
      }))
      .filter((node) => node.id && node.label),
    (node) => node.id
  );
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const result = [];
  items.forEach((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

function firstUsable(items) {
  return (Array.isArray(items) ? items : []).find((item) => item && typeof item === 'object') || null;
}

function getLimit(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

module.exports = {
  buildGraphTutorHint,
  buildGraphTutorSupport,
  summarizePrerequisites
};
