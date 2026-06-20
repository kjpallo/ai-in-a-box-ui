const { normalizeGraphTerm } = require('./knowledgeGraph');
const {
  cleanLabel,
  cleanSentence,
  ensureSentence,
  formatList,
  displayLabel,
  sentenceCase,
  lowerFirst,
  formatGraphPath,
  isApprovedGraphContext
} = require('./graphResponseUtils');

const SOURCE = 'approved_knowledge_graph';
const SUPPORT_TYPE = 'knowledge_graph_support';
const STUDENT_CONCEPT_TYPES = new Set(['vocabulary', 'concept']);
const FIND_TARGET_TYPES = new Set(['vocabulary', 'concept', 'formula']);
const LOW_VALUE_EDGE_TYPES = new Set(['source_supports', 'assessed_by', 'example_of']);
const ALWAYS_CRITICAL_ROUTE_TYPES = new Set([
  'math_only',
  'chemistry_formula',
  'periodic_table',
  'circuit_diagram',
  'circuit_diagram_followup'
]);

function detectGraphSupportIntent(message, options = {}) {
  const normalized = normalizeMessage(message);
  if (!normalized) return 'none';

  if (/\b(?:what\s+do\s+i\s+need\s+to\s+know|what\s+should\s+i\s+(?:understand|know)|need\s+to\s+know|understand)\s+before\b/.test(normalized) ||
    /\bwhat\s+comes\s+before\b/.test(normalized) ||
    /\bbefore\s+[a-z0-9 ]+\??$/.test(normalized)) {
    return 'prerequisite';
  }

  if ((/\b(?:mixing\s+up|mixed\s+up|confus(?:e|ed|ing)|same|vs|versus)\b/.test(normalized) && !isMotionGraphAxisVs(normalized)) ||
    /\bhow\s+do\s+i\s+know\s+if\s+it\s+wants\b/.test(normalized)) {
    return 'misconception';
  }

  if (/\b(?:what\s+is\s+this\s+asking\s+(?:me\s+)?to\s+find|what\s+am\s+i\s+(?:supposed\s+)?to\s+find|which\s+equation\s+is\s+this|how\s+do\s+i\s+know\s+what\s+formula\s+to\s+use|what\s+formula\s+(?:do\s+i|should\s+i)\s+use)\b/.test(normalized)) {
    return 'find_target';
  }

  if (/\b(?:why\s+(?:does|do|is|are)\b.+\bmatter|what(?:s|\s+is)\s+the\s+(?:point|purpose)\s+of|why\s+do\s+we\s+need)\b/.test(normalized)) {
    return 'why_matters';
  }

  if (/\b(?:i\s+(?:do\s+not|dont|don\s+t)\s+get|i\s+(?:do\s+not|dont|don\s+t)\s+understand|i\s+am\s+lost\s+on|im\s+lost\s+on|confused\s+about)\b/.test(normalized)) {
    return 'weak_confusion';
  }

  return options.defaultIntent || 'none';
}

function canUseGraphRoutingSupport(message, route, graphContext, options = {}) {
  const supportIntent = detectGraphSupportIntent(message, options);
  if (supportIntent === 'none') return false;
  if (!isApprovedGraphContext(graphContext)) return false;
  if (isCriticalRoute(message, route)) return false;

  const explicitSupport = supportIntent !== 'find_target';
  const routeNeedsSupport = isWeakRoute(route) || explicitSupport;
  if (!routeNeedsSupport) return false;

  if (shouldPreserveStrongDirectAnswer(message, route, supportIntent)) return false;

  return Boolean(buildGraphRoutingSupportAnswer(message, route, graphContext, {
    ...options,
    supportIntent
  }));
}

function buildGraphRoutingSupportAnswer(message, route, graphContext, options = {}) {
  if (!isApprovedGraphContext(graphContext)) return null;

  const supportIntent = options.supportIntent || detectGraphSupportIntent(message, options);
  if (supportIntent === 'none') return null;

  if (supportIntent === 'prerequisite') {
    return buildPrerequisiteAnswer(message, graphContext, supportIntent);
  }

  if (supportIntent === 'misconception') {
    return buildMisconceptionAnswer(message, graphContext, supportIntent);
  }

  if (supportIntent === 'find_target') {
    return buildFindTargetAnswer(message, route, graphContext, supportIntent, options);
  }

  if (supportIntent === 'why_matters') {
    return buildWhyMattersAnswer(message, graphContext, supportIntent);
  }

  if (supportIntent === 'weak_confusion') {
    return buildWeakConfusionAnswer(message, graphContext, supportIntent);
  }

  return null;
}

function buildPrerequisiteAnswer(message, graphContext, supportIntent) {
  const anchor = selectAnchorConcept(message, graphContext);
  if (!anchor) return null;

  const prerequisites = selectPrerequisites(anchor, graphContext);
  if (!prerequisites.length) return null;

  const targetLabel = displayLabel(anchor.label);
  const prerequisiteLabels = prerequisites.map((concept) => displayLabel(concept.label));
  const firstPrerequisite = prerequisites[0];
  const connection = buildPrerequisitePath(firstPrerequisite, anchor);
  const explanation = buildPrerequisiteExplanation(anchor, prerequisites);
  const directAnswer = [
    `Before ${targetLabel}, make sure you understand ${formatList(prerequisiteLabels)}.`,
    explanation,
    connection ? `Connection: ${formatGraphPath(connection)}` : ''
  ].filter(Boolean).join('\n');

  return makeSupportAnswer({
    supportIntent,
    directAnswer,
    explanation,
    connectedConcepts: [targetLabel, ...prerequisiteLabels],
    prerequisiteConcepts: prerequisiteLabels,
    commonMisconceptions: selectMisconceptions([anchor, ...prerequisites], graphContext),
    graphPath: connection
  });
}

function buildMisconceptionAnswer(message, graphContext, supportIntent) {
  const concepts = selectMessageConcepts(message, graphContext, { max: 3 });
  if (!concepts.length) return null;

  const pair = selectMisconceptionPair(concepts, graphContext);
  if (!pair && concepts.length < 2) return null;

  const primary = pair ? pair.primary : concepts[0];
  const secondary = pair ? pair.secondary : concepts[1];
  if (!primary || !secondary) return null;

  const path = buildPairPath(primary, secondary, graphContext);
  const explanation = buildMisconceptionExplanation(primary, secondary);
  const warnings = selectMisconceptions([primary, secondary], graphContext);
  const directAnswer = [
    'That is a common mix-up.',
    explanation,
    warnings[0] ? `Watch out: ${ensureSentence(warnings[0])}` : '',
    path ? `Connection: ${formatGraphPath(path)}` : ''
  ].filter(Boolean).join('\n');

  return makeSupportAnswer({
    supportIntent,
    directAnswer,
    explanation,
    connectedConcepts: [displayLabel(primary.label), displayLabel(secondary.label)],
    prerequisiteConcepts: [],
    commonMisconceptions: warnings,
    graphPath: path
  });
}

function buildFindTargetAnswer(message, route, graphContext, supportIntent, options = {}) {
  const routeTarget = cleanLabel(options.target || route?.formulaWork?.solveFor || route?.public?.formulaWork?.solveFor || '');
  const anchor = routeTarget
    ? selectConceptByLabel(routeTarget, graphContext, { includeFormula: true })
    : selectAnchorConcept(message, graphContext, { includeFormula: true });

  if (!anchor) return null;
  if (!routeTarget && !hasClearFindTargetContext(route, graphContext)) return null;

  const label = displayLabel(routeTarget || anchor.label);
  const formula = route?.formulaWork?.formula || route?.public?.formulaWork?.formula || '';
  const explanation = formula
    ? `Use the formula connected to ${label}: ${formula}.`
    : `Look for the value connected to ${label} in the problem.`;
  const directAnswer = [`This is asking you to find ${label}.`, explanation].join('\n');

  return makeSupportAnswer({
    supportIntent,
    directAnswer,
    explanation,
    connectedConcepts: [label],
    prerequisiteConcepts: [],
    commonMisconceptions: selectMisconceptions([anchor], graphContext),
    graphPath: selectFirstUsefulPath(graphContext)
  });
}

function buildWhyMattersAnswer(message, graphContext, supportIntent) {
  const anchor = selectAnchorConcept(message, graphContext);
  if (!anchor) return null;

  const connected = selectConnectedConcepts(anchor, graphContext).slice(0, 3);
  if (!anchor.definition && !connected.length) return null;

  const label = displayLabel(anchor.label);
  const key = normalizeGraphTerm(anchor.label);
  const path = connected[0] ? buildPairPath(anchor, connected[0], graphContext) : null;
  const explanation = buildWhyMattersExplanation(anchor, connected);
  const directAnswer = [
    `${sentenceCase(label)} matters because ${lowerFirst(explanation)}`,
    buildWhyMattersSecondLine(key, anchor, connected),
    path ? `Connection: ${formatGraphPath(path)}` : ''
  ].filter(Boolean).join('\n');

  return makeSupportAnswer({
    supportIntent,
    directAnswer,
    explanation,
    connectedConcepts: [label, ...connected.map((concept) => displayLabel(concept.label))],
    prerequisiteConcepts: selectPrerequisites(anchor, graphContext).map((concept) => displayLabel(concept.label)),
    commonMisconceptions: selectMisconceptions([anchor, ...connected], graphContext),
    graphPath: path
  });
}

function buildWeakConfusionAnswer(message, graphContext, supportIntent) {
  const anchor = selectAnchorConcept(message, graphContext);
  if (!anchor) return null;

  const connected = selectConnectedConcepts(anchor, graphContext).slice(0, 2);
  const misconceptions = selectMisconceptions([anchor, ...connected], graphContext);
  if (!anchor.definition && !connected.length && !misconceptions.length) return null;

  const label = displayLabel(anchor.label);
  const connection = connected[0] ? buildPairPath(anchor, connected[0], graphContext) : null;
  const explanation = anchor.definition
    ? `${sentenceCase(label)} means ${lowerFirst(cleanSentence(anchor.definition))}`
    : `${sentenceCase(label)} connects to ${formatList(connected.map((concept) => displayLabel(concept.label)))}.`;
  const directAnswer = [
    explanation,
    connected.length ? `Helpful connection: ${sentenceCase(label)} connects to ${formatList(connected.map((concept) => displayLabel(concept.label)))}.` : '',
    misconceptions[0] ? `Watch out: ${ensureSentence(misconceptions[0])}` : '',
    connection ? `Connection: ${formatGraphPath(connection)}` : ''
  ].filter(Boolean).join('\n');

  return makeSupportAnswer({
    supportIntent,
    directAnswer,
    explanation,
    connectedConcepts: [label, ...connected.map((concept) => displayLabel(concept.label))],
    prerequisiteConcepts: selectPrerequisites(anchor, graphContext).map((concept) => displayLabel(concept.label)),
    commonMisconceptions: misconceptions,
    graphPath: connection
  });
}

function makeSupportAnswer({
  supportIntent,
  directAnswer,
  explanation,
  connectedConcepts,
  prerequisiteConcepts,
  commonMisconceptions,
  graphPath
}) {
  if (!directAnswer) return null;

  return {
    type: SUPPORT_TYPE,
    aiAllowed: false,
    supportIntent,
    directAnswer,
    explanation: cleanSentence(explanation),
    connectedConcepts: uniqueLabels(connectedConcepts),
    prerequisiteConcepts: uniqueLabels(prerequisiteConcepts),
    commonMisconceptions: uniqueLabels(commonMisconceptions),
    graphPath: graphPath || null,
    source: SOURCE
  };
}

function isCriticalRoute(message, route = {}) {
  if (!route) return false;
  if (ALWAYS_CRITICAL_ROUTE_TYPES.has(route.type)) return true;
  if (isStrongLocalRoute(route)) return true;
  if (route.calculatorResult || route.motionForceTutor) return true;
  if (route.public?.calculator || route.public?.motionForceTutor) return true;
  if (String(route.type || '').includes('tutor')) return true;

  if (route.type === 'science_formula') {
    if (route.formulaWork || route.public?.formulaWork) return true;
    return looksLikeNumericFormulaWork(message);
  }

  return false;
}

function isWeakRoute(route = {}) {
  if (!route) return true;
  if (route.pendingClarification || route.public?.pendingClarification) return true;
  if (route.confidence === 'none' || route.confidence === 'weak') return true;
  if (route.type === 'no_match' || route.type === 'ambiguous_vocab') return true;
  return !route.directAnswer;
}

function isStrongLocalRoute(route = {}) {
  if (route.confidence !== 'strong' || !route.directAnswer) return false;
  if (Array.isArray(route.toolsUsed) && route.toolsUsed.includes('motion_force_knowledge')) return true;
  if (route.type === 'graph_concept' || route.type === 'cloze_completion') return true;
  return false;
}

function shouldPreserveStrongDirectAnswer(message, route = {}, supportIntent) {
  if (!route || route.confidence !== 'strong' || !route.directAnswer) return false;
  if (supportIntent !== 'none') return false;
  return true;
}

function looksLikeNumericFormulaWork(message) {
  const normalized = normalizeMessage(message);
  return /(?:\d|=|μ|µ|\bif\b|\bgiven\b|\bcalculate\b|\bsolve\b|\bfind\b|\bdetermine\b|\bhow\s+much\b|\bhow\s+many\b)/.test(normalized);
}

function selectAnchorConcept(message, graphContext, options = {}) {
  const targetPhrase = extractTargetPhrase(message);
  if (targetPhrase) {
    const target = selectConceptByLabel(targetPhrase, graphContext, options);
    if (target) return target;
  }

  return selectMessageConcepts(message, graphContext, { ...options, max: 1 })[0] || null;
}

function selectConceptByLabel(label, graphContext, options = {}) {
  const key = normalizeGraphTerm(label);
  if (!key) return null;

  return allConceptNodes(graphContext, options)
    .map((node) => ({
      node,
      matchRank: getLabelMatchRank(node, key)
    }))
    .filter((entry) => entry.matchRank < 10)
    .sort((left, right) => left.matchRank - right.matchRank || compareConcepts(left.node, right.node))
    .map((entry) => entry.node)[0] || null;
}

function getLabelMatchRank(node, key) {
  const labelKey = normalizeGraphTerm(node.label);
  const matchedKey = normalizeGraphTerm(node.matchedTerm);
  if (labelKey === key || matchedKey === key) return 0;
  if (labelKey.endsWith(` ${key}`)) return 1;
  if (key.endsWith(` ${labelKey}`)) return 2;
  return 10;
}

function selectMessageConcepts(message, graphContext, options = {}) {
  const max = Number.isInteger(options.max) ? Math.max(1, options.max) : 4;
  const normalized = normalizeMessage(message);
  const candidates = allConceptNodes(graphContext, options)
    .filter((node) => {
      const labelKey = normalizeGraphTerm(node.label);
      const matchedKey = normalizeGraphTerm(node.matchedTerm);
      return (labelKey && normalized.includes(labelKey)) || (matchedKey && normalized.includes(matchedKey));
    });

  return uniqueNodes(candidates)
    .sort((left, right) => {
      const leftOrder = getMentionOrder(normalized, left);
      const rightOrder = getMentionOrder(normalized, right);
      return leftOrder - rightOrder || compareConcepts(left, right);
    })
    .slice(0, max);
}

function allConceptNodes(graphContext, options = {}) {
  const allowedTypes = options.includeFormula ? FIND_TARGET_TYPES : STUDENT_CONCEPT_TYPES;
  return uniqueNodes([
    ...(graphContext?.matchedNodes || []),
    ...(graphContext?.relatedNodes || [])
  ])
    .filter((node) => allowedTypes.has(node.type))
    .filter((node) => isUsefulConceptLabel(node.label));
}

function selectPrerequisites(anchor, graphContext) {
  const nodes = buildNodeMap(graphContext);
  const anchorIds = new Set([anchor.id].filter(Boolean));
  const prerequisites = [];

  usefulEdges(graphContext).forEach((edge) => {
    if (edge.type === 'uses_concept' && anchorIds.has(edge.from)) {
      prerequisites.push(conceptFromEdgeEndpoint(edge.to, nodes));
    }
    if (edge.type === 'prerequisite_for' && anchorIds.has(edge.to)) {
      prerequisites.push(conceptFromEdgeEndpoint(edge.from, nodes));
    }
  });

  return uniqueNodes(prerequisites.filter(Boolean))
    .filter((node) => STUDENT_CONCEPT_TYPES.has(node.type))
    .filter((node) => normalizeGraphTerm(node.label) !== normalizeGraphTerm(anchor.label))
    .sort(compareConcepts)
    .slice(0, 4);
}

function selectConnectedConcepts(anchor, graphContext) {
  const nodes = buildNodeMap(graphContext);
  const anchorIds = idsForConcept(anchor, graphContext);
  const connected = [];

  usefulEdges(graphContext).forEach((edge) => {
    if (anchorIds.has(edge.from)) connected.push(conceptFromEdgeEndpoint(edge.to, nodes));
    if (anchorIds.has(edge.to)) connected.push(conceptFromEdgeEndpoint(edge.from, nodes));
  });

  return uniqueNodes(connected.filter(Boolean))
    .filter((node) => STUDENT_CONCEPT_TYPES.has(node.type))
    .filter((node) => normalizeGraphTerm(node.label) !== normalizeGraphTerm(anchor.label))
    .sort((left, right) => getConnectionPriority(anchor, left, graphContext) - getConnectionPriority(anchor, right, graphContext) || compareConcepts(left, right));
}

function selectMisconceptionPair(concepts, graphContext) {
  for (let leftIndex = 0; leftIndex < concepts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < concepts.length; rightIndex += 1) {
      const primary = concepts[leftIndex];
      const secondary = concepts[rightIndex];
      const edge = findEdgeBetween(primary, secondary, graphContext);
      const pairKey = getPairKey(primary, secondary);
      if (edge?.type === 'commonly_confused_with' || pairKey === 'speed|velocity') {
        return { primary, secondary };
      }
    }
  }

  return concepts.length >= 2 ? { primary: concepts[0], secondary: concepts[1] } : null;
}

function selectMisconceptions(concepts, graphContext) {
  const conceptKeys = new Set(concepts.map((concept) => normalizeGraphTerm(concept.label)).filter(Boolean));
  const warnings = [];

  const pairKeys = new Set();
  concepts.forEach((left, leftIndex) => {
    concepts.slice(leftIndex + 1).forEach((right) => pairKeys.add(getPairKey(left, right)));
  });

  if (pairKeys.has('displacement|distance')) {
    warnings.push('You can walk a long distance and still have zero displacement if you return to where you started.');
  }
  if (pairKeys.has('speed|velocity')) {
    warnings.push('Speed does not include direction, but velocity does.');
  }

  concepts.forEach((concept) => {
    if (concept.misconception) warnings.push(cleanSentence(concept.misconception));
  });

  const nodes = buildNodeMap(graphContext);
  usefulEdges(graphContext).forEach((edge) => {
    if (edge.type !== 'has_misconception') return;
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !conceptKeys.has(normalizeGraphTerm(from.label))) return;
    const warning = cleanSentence(to?.label || to?.definition);
    if (warning) warnings.push(warning);
  });

  return uniqueLabels(warnings).slice(0, 4);
}

function buildPrerequisiteExplanation(anchor, prerequisites) {
  const key = normalizeGraphTerm(anchor.label);
  const labels = prerequisites.map((concept) => displayLabel(concept.label));
  if (key === 'acceleration') return 'Acceleration describes how velocity changes over time.';
  if (key === 'velocity') return 'Velocity describes speed with direction, so displacement and time are the ideas underneath it.';
  return `${sentenceCase(displayLabel(anchor.label))} uses ${formatList(labels)}.`;
}

function buildMisconceptionExplanation(primary, secondary) {
  const pair = getPairKey(primary, secondary);
  if (pair === 'displacement|distance') {
    return 'Distance is the total path traveled, while displacement is the change from start to finish in a direction.';
  }
  if (pair === 'speed|velocity') {
    return 'Speed tells how fast something moves, while velocity tells how fast and in what direction.';
  }

  const primaryDefinition = cleanSentence(primary.definition);
  const secondaryDefinition = cleanSentence(secondary.definition);
  if (primaryDefinition && secondaryDefinition) {
    return `${sentenceCase(displayLabel(primary.label))}: ${primaryDefinition} ${sentenceCase(displayLabel(secondary.label))}: ${secondaryDefinition}`;
  }
  return `${sentenceCase(displayLabel(primary.label))} and ${displayLabel(secondary.label)} are connected, but they are not the same idea.`;
}

function buildWhyMattersExplanation(anchor, connected) {
  const key = normalizeGraphTerm(anchor.label);
  if (key === 'net force') {
    return 'it tells whether all the forces on an object cancel out or leave an overall push or pull.';
  }
  if (key === 'displacement') {
    return 'it keeps track of the start-to-finish change in position and direction.';
  }
  if (key === 'acceleration') {
    return 'it tells how velocity is changing over time.';
  }
  if (anchor.definition) return cleanSentence(anchor.definition);
  if (connected.length) {
    return `it connects to ${formatList(connected.map((concept) => displayLabel(concept.label)))}.`;
  }
  return '';
}

function buildWhyMattersSecondLine(key, anchor, connected) {
  if (key === 'net force') {
    return 'If forces are balanced, motion does not change. If forces are unbalanced, the object accelerates.';
  }
  if (key === 'displacement' && connected.some((concept) => normalizeGraphTerm(concept.label) === 'velocity')) {
    return 'It helps you understand velocity, because velocity includes direction.';
  }
  if (connected.length) {
    return `It connects to ${formatList(connected.map((concept) => displayLabel(concept.label)))}.`;
  }
  if (anchor.example) return `Example: ${cleanSentence(anchor.example)}`;
  return '';
}

function buildPrerequisitePath(prerequisite, anchor) {
  return {
    found: true,
    from: prerequisite.id,
    to: anchor.id,
    length: 1,
    nodes: [
      { id: prerequisite.id, type: prerequisite.type, label: displayLabel(prerequisite.label) },
      { id: anchor.id, type: anchor.type, label: displayLabel(anchor.label) }
    ],
    edges: [{
      from: prerequisite.id,
      to: anchor.id,
      type: 'used_by',
      label: 'used by',
      confidence: 'high',
      direction: 'reverse'
    }]
  };
}

function buildPairPath(primary, secondary, graphContext) {
  const edge = findEdgeBetween(primary, secondary, graphContext);
  if (!edge) return null;

  const primaryIds = idsForConcept(primary, graphContext);
  const primaryIsFrom = primaryIds.has(edge.from);
  const label = !primaryIsFrom && edge.type === 'uses_concept'
    ? 'used by'
    : edge.label || edge.type.replace(/_/g, ' ');

  return {
    found: true,
    from: edge.from,
    to: edge.to,
    length: 1,
    nodes: [primary, secondary].map((node) => ({ id: node.id, type: node.type, label: displayLabel(node.label) })),
    edges: [{
      from: edge.from,
      to: edge.to,
      type: edge.type,
      label,
      confidence: edge.confidence,
      direction: primaryIsFrom ? 'forward' : 'reverse'
    }]
  };
}

function selectFirstUsefulPath(graphContext) {
  return (graphContext?.possiblePaths || [])
    .find((path) => path?.found && Array.isArray(path.nodes) && path.nodes.length > 1 && Array.isArray(path.edges) && path.edges.some((edge) => !LOW_VALUE_EDGE_TYPES.has(edge.type))) || null;
}

function findEdgeBetween(left, right, graphContext) {
  const leftIds = idsForConcept(left, graphContext);
  const rightIds = idsForConcept(right, graphContext);
  return usefulEdges(graphContext)
    .find((edge) => (leftIds.has(edge.from) && rightIds.has(edge.to)) || (leftIds.has(edge.to) && rightIds.has(edge.from))) || null;
}

function getConnectionPriority(anchor, candidate, graphContext) {
  const anchorIds = idsForConcept(anchor, graphContext);
  const candidateIds = idsForConcept(candidate, graphContext);
  const edge = usefulEdges(graphContext)
    .find((entry) => (anchorIds.has(entry.from) && candidateIds.has(entry.to)) || (anchorIds.has(entry.to) && candidateIds.has(entry.from)));
  if (!edge) return 10;
  if (edge.type === 'uses_concept' && candidateIds.has(edge.from) && anchorIds.has(edge.to)) return 0;
  if (edge.type === 'prerequisite_for' && anchorIds.has(edge.from) && candidateIds.has(edge.to)) return 1;
  if (edge.type === 'related_to') return 2;
  if (edge.type === 'uses_concept') return 3;
  if (edge.type === 'commonly_confused_with') return 4;
  if (edge.type === 'has_misconception') return 8;
  return 6;
}

function idsForConcept(concept, graphContext) {
  const key = normalizeGraphTerm(concept.label);
  const ids = new Set([concept.id].filter(Boolean));
  allConceptNodes(graphContext, { includeFormula: true }).forEach((node) => {
    if (normalizeGraphTerm(node.label) === key) {
      ids.add(node.id);
    }
  });
  return ids;
}

function conceptFromEdgeEndpoint(nodeId, nodes) {
  const node = nodes.get(nodeId);
  if (node) return node;

  const fallback = labelFromNodeId(nodeId);
  if (!fallback) return null;

  return {
    id: String(nodeId || ''),
    type: typeFromNodeId(nodeId),
    label: fallback,
    matchedTerm: '',
    definition: '',
    misconception: '',
    example: ''
  };
}

function buildNodeMap(graphContext) {
  return new Map(uniqueNodes([
    ...(graphContext?.matchedNodes || []),
    ...(graphContext?.relatedNodes || [])
  ]).map((node) => [node.id, node]));
}

function usefulEdges(graphContext) {
  return (Array.isArray(graphContext?.edges) ? graphContext.edges : [])
    .filter((edge) => edge && !LOW_VALUE_EDGE_TYPES.has(String(edge.type || '')));
}

function hasClearFindTargetContext(route, graphContext) {
  if (route?.formulaWork?.solveFor || route?.public?.formulaWork?.solveFor) return true;
  return selectMessageConcepts('', graphContext, { includeFormula: true, max: 2 }).length === 1;
}

function extractTargetPhrase(message) {
  const normalized = normalizeMessage(message);
  const patterns = [
    /\bbefore\s+(.+?)$/,
    /\bwhat\s+comes\s+before\s+(.+?)$/,
    /\bwhy\s+(?:does|do|is|are)\s+(.+?)\s+matter\b/,
    /\bwhat(?:s|\s+is)\s+the\s+(?:point|purpose)\s+of\s+(.+?)$/,
    /\bwhy\s+do\s+we\s+need\s+(.+?)$/,
    /\bi\s+(?:do\s+not|dont|don\s+t)\s+get\s+(.+?)$/,
    /\bi\s+(?:do\s+not|dont|don\s+t)\s+understand\s+(.+?)$/,
    /\bconfused\s+about\s+(.+?)$/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return trimTargetPhrase(match[1]);
  }

  return '';
}

function trimTargetPhrase(value) {
  return String(value || '')
    .replace(/\b(?:the|a|an|this|that|concept|formula|equation)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMessage(message) {
  return normalizeGraphTerm(message)
    .replace(/\bdont\b/g, 'dont')
    .replace(/\bdoesnt\b/g, 'doesnt')
    .replace(/\bwhats\b/g, 'what is')
    .trim();
}

function isMotionGraphAxisVs(normalized) {
  return /\b(?:distance|position|velocity|speed)\s+(?:vs|versus)\s+time\s+graph\b/.test(normalized) ||
    (/\b(?:distance|position|velocity|speed)\s+(?:vs|versus)\s*time\b/.test(normalized) && /\bgraph\b/.test(normalized));
}

function isUsefulConceptLabel(label) {
  const normalized = normalizeGraphTerm(label);
  if (!normalized) return false;
  if (normalized === 'matter') return false;
  if (normalized.split(/\s+/).length > 5) return false;
  return true;
}

function compareConcepts(left, right) {
  const leftType = typePriority(left.type);
  const rightType = typePriority(right.type);
  if (leftType !== rightType) return leftType - rightType;

  const leftWords = normalizeGraphTerm(left.label).split(/\s+/).length;
  const rightWords = normalizeGraphTerm(right.label).split(/\s+/).length;
  if (leftWords !== rightWords) return leftWords - rightWords;

  return cleanLabel(left.label).localeCompare(cleanLabel(right.label));
}

function typePriority(type) {
  if (type === 'vocabulary') return 0;
  if (type === 'concept') return 1;
  if (type === 'formula') return 2;
  return 10;
}

function getMentionOrder(normalizedMessage, node) {
  const labelIndex = normalizedMessage.indexOf(normalizeGraphTerm(node.label));
  const matchedIndex = normalizedMessage.indexOf(normalizeGraphTerm(node.matchedTerm));
  const indexes = [labelIndex, matchedIndex].filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : Number.MAX_SAFE_INTEGER;
}

function uniqueNodes(nodes) {
  const seen = new Set();
  const result = [];
  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    if (!node || typeof node !== 'object') return;
    const id = String(node.id || '');
    const label = cleanLabel(node.label);
    if (!id || !label || seen.has(id)) return;
    seen.add(id);
    result.push({
      id,
      type: String(node.type || ''),
      label,
      matchedTerm: cleanLabel(node.matchedTerm),
      definition: cleanSentence(node.definition),
      misconception: cleanSentence(node.misconception),
      example: cleanSentence(node.example)
    });
  });
  return result;
}

function uniqueLabels(labels) {
  const seen = new Set();
  const result = [];
  (Array.isArray(labels) ? labels : []).forEach((label) => {
    const clean = cleanSentence(label).replace(/\.$/, '');
    const key = normalizeGraphTerm(clean);
    if (!clean || !key || seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });
  return result;
}

function labelFromNodeId(nodeId) {
  const parts = String(nodeId || '').split(':');
  const slug = parts[parts.length - 1] || '';
  return slug.replace(/-/g, ' ').trim();
}

function typeFromNodeId(nodeId) {
  const type = String(nodeId || '').split(':')[0];
  return FIND_TARGET_TYPES.has(type) ? type : 'concept';
}

function getPairKey(left, right) {
  return [normalizeGraphTerm(left.label), normalizeGraphTerm(right.label)].sort().join('|');
}

module.exports = {
  detectGraphSupportIntent,
  canUseGraphRoutingSupport,
  buildGraphRoutingSupportAnswer
};
