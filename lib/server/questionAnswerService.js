const { buildStandardsLogMetadata } = require('../standards/standardsLogMetadata');
const {
  answerStandardsFollowUp,
  answerWhyThisMattersFollowUp,
  isWhyThisMattersFollowUp
} = require('../standards/standardsFollowUp');
const {
  nextPendingClarification,
  resolvePendingClarification
} = require('../router/pendingClarification');
const { normalize } = require('../router/classifyQuestion');
const { findGraphContext } = require('../knowledge/knowledgeGraph');
const {
  buildGraphAnswer,
  canAnswerWithGraph
} = require('../knowledge/graphAnswerBuilder');
const {
  buildGraphRoutingSupportAnswer,
  canUseGraphRoutingSupport
} = require('../knowledge/graphRoutingSupport');
const {
  hasExplicitBlankContextDependency,
  isFillInTheBlankPrompt
} = require('../router/fillInBlank');

function createQuestionAnswerService({
  teacherFactsFile,
  maxKnowledgeItems,
  loadTeacherKnowledge,
  loadKnowledgeGraph = null,
  findRelevantKnowledge,
  routeStudentQuestion,
  ollama,
  logProblem,
  logStudentInteraction,
  initialTeacherKnowledge = [],
  initialKnowledgeGraph = null
}) {
  let teacherKnowledge = initialTeacherKnowledge;
  let knowledgeGraph = initialKnowledgeGraph;

  function reloadTeacherKnowledge() {
    teacherKnowledge = loadTeacherKnowledge(teacherFactsFile);
    if (typeof loadKnowledgeGraph === 'function') {
      knowledgeGraph = loadKnowledgeGraph({
        teacherFactsFile,
        teacherKnowledge
      });
    }
    return teacherKnowledge;
  }

  function getTeacherKnowledgeCount() {
    return teacherKnowledge.length;
  }

  function getRelevantKnowledge(message) {
    return findRelevantKnowledge(message, getStudentAnswerKnowledge(), maxKnowledgeItems);
  }

  function getStudentAnswerKnowledge() {
    return (Array.isArray(teacherKnowledge) ? teacherKnowledge : [])
      .filter((item) => !isApprovedUploadedKnowledgeItem(item));
  }

  function routeMessage(message) {
    reloadTeacherKnowledge();
    const matchedKnowledge = getRelevantKnowledge(message);
    const questionRoute = routeStudentQuestion(message, matchedKnowledge);
    const graphContext = getGraphContext(message, knowledgeGraph);
    attachGraphContextToRoute(questionRoute, graphContext);
    return { matchedKnowledge, questionRoute, graphContext };
  }

  async function answerStudentMessage(message, options = {}) {
    let contextCarryover = resolveStudentContextCarryover(message, options.recentMessages || [], {
      lastAnsweredPrompt: options.lastAnsweredPrompt || '',
      lastAnsweredAnswer: options.lastAnsweredAnswer || options.contextAnswer || ''
    });
    let independentRouting = null;
    if (contextCarryover.needsContext) {
      independentRouting = routeMessage(message);
      if (isTrustedIndependentRoute(message, independentRouting.questionRoute)) {
        contextCarryover = { needsContext: false, topic: '', message };
      } else {
        independentRouting = null;
      }
    }
    if (contextCarryover.needsContext && !contextCarryover.topic) {
      return buildContextClarificationResponse();
    }

    const routedMessage = contextCarryover.message || message;

    if (options.intent === 'why_this_matters' || isWhyThisMattersFollowUp(message)) {
      const whyThisMatters = answerWhyThisMattersFollowUp(contextCarryover.topic || options.lastAnsweredPrompt || '', {
        lastAnsweredAnswer: options.lastAnsweredAnswer || options.contextAnswer || ''
      });

      return {
        response: whyThisMatters.response,
        routeType: 'why_this_matters_followup',
        confidence: whyThisMatters.matched ? 'strong' : 'none',
        questionRoute: {
          type: 'why_this_matters_followup',
          confidence: whyThisMatters.matched ? 'strong' : 'none',
          directAnswer: whyThisMatters.response,
          aiAllowed: false,
          public: {
            type: 'why_this_matters_followup',
            confidence: whyThisMatters.matched ? 'strong' : 'none',
            standardId: whyThisMatters.standardId || ''
          }
        },
        pendingClarification: null,
        isStandardsFollowUp: true
      };
    }

    const clarificationFollowUp = resolvePendingClarification(message, options.pendingClarification);
    if (clarificationFollowUp?.handled) {
      return {
        response: clarificationFollowUp.questionRoute.directAnswer,
        routeType: clarificationFollowUp.questionRoute?.public?.type || clarificationFollowUp.questionRoute.type,
        confidence: clarificationFollowUp.questionRoute.confidence,
        questionRoute: clarificationFollowUp.questionRoute,
        pendingClarification: clarificationFollowUp.pendingClarification,
        standardId: clarificationFollowUp.questionRoute.standardId || clarificationFollowUp.questionRoute.public?.standardId || '',
        isStandardsFollowUp: false
      };
    }

    const circuitDiagramFollowUp = answerCircuitDiagramCheckFollowUp(message, options.recentMessages || []);
    if (circuitDiagramFollowUp) {
      return circuitDiagramFollowUp;
    }

    const distanceDisplacementFollowUp = answerDistanceDisplacementFollowUp(message, options.recentMessages || []);
    if (distanceDisplacementFollowUp) {
      return distanceDisplacementFollowUp;
    }

    const standardsFollowUp = answerStandardsFollowUp(routedMessage, options.lastAnsweredPrompt || '', {
      lastAnsweredAnswer: options.lastAnsweredAnswer || options.contextAnswer || '',
      currentStandardId: options.currentStandardId || ''
    });

    if (standardsFollowUp?.handled) {
      return {
        response: standardsFollowUp.response,
        routeType: 'standards_followup',
        confidence: standardsFollowUp.matched ? 'strong' : 'none',
        questionRoute: {
          type: 'standards_followup',
          confidence: standardsFollowUp.matched ? 'strong' : 'none',
          directAnswer: standardsFollowUp.response,
          aiAllowed: false,
          standardId: standardsFollowUp.standardId || '',
          public: {
            type: 'standards_followup',
            confidence: standardsFollowUp.matched ? 'strong' : 'none',
            standardId: standardsFollowUp.standardId || '',
            pendingClarification: standardsFollowUp.pendingClarification
              ? {
                id: standardsFollowUp.pendingClarification.id,
                choices: standardsFollowUp.pendingClarification.choices.map((choice) => ({
                  number: choice.number,
                  label: choice.label
                }))
              }
              : undefined
          }
        },
        pendingClarification: standardsFollowUp.pendingClarification || null,
        standardId: standardsFollowUp.standardId || '',
        isStandardsFollowUp: true
      };
    }

    const { matchedKnowledge, questionRoute: routedQuestionRoute, graphContext } = independentRouting || routeMessage(routedMessage);
    let questionRoute = routedQuestionRoute;
    const graphAnswer = canAnswerWithGraph(routedMessage, questionRoute, graphContext)
      ? buildGraphAnswer(routedMessage, graphContext)
      : null;
    if (graphAnswer) {
      questionRoute = buildGraphQuestionRoute(questionRoute, graphAnswer);
    }
    const graphRoutingSupportAnswer = canUseGraphRoutingSupport(routedMessage, questionRoute, graphContext)
      ? buildGraphRoutingSupportAnswer(routedMessage, questionRoute, graphContext)
      : null;
    if (graphRoutingSupportAnswer) {
      questionRoute = buildGraphRoutingSupportQuestionRoute(questionRoute, graphRoutingSupportAnswer);
    }
    let response = questionRoute.directAnswer || '';
    let usedAiFallback = false;

    maybeLogReviewQuestion({
      message: routedMessage,
      questionRoute,
      matchedKnowledge,
      answerGiven: response
    });

    if (!response || questionRoute.aiAllowed) {
      usedAiFallback = true;
      response = '';
      await ollama.stream({
        prompt: ollama.buildTeacherPrompt({ message: routedMessage, matchedKnowledge, questionRoute }),
        onText(textChunk) {
          response += textChunk || '';
        }
      });
    }

    if (usedAiFallback) {
      logAiImprovementProblem({
        message: routedMessage,
        questionRoute,
        matchedKnowledge,
        answerGiven: response,
        category: 'fallback_review',
        reason: 'fallback',
        source: 'student_session'
      });
    }

    return {
      response: withCarryoverPrefix(response || 'I do not have a trusted answer for that yet. Please ask your teacher.', contextCarryover),
      routeType: questionRoute?.public?.type || questionRoute?.type || 'unknown',
      confidence: questionRoute?.confidence || 'unknown',
      questionRoute,
      pendingClarification: nextPendingClarification(questionRoute),
      isStandardsFollowUp: false
    };
  }

  function maybeLogReviewQuestion({ message, questionRoute, matchedKnowledge, answerGiven }) {
    const review = getRouteReviewInfo(questionRoute);
    if (!review) return;

    logAiImprovementProblem({
      message,
      questionRoute,
      matchedKnowledge,
      answerGiven,
      source: 'auto',
      category: review.category,
      reason: review.reason
    });
  }

  function answerDistanceDisplacementFollowUp(message, recentMessages = []) {
    if (!asksForDistanceAfterDisplacement(message)) return null;

    const previousPrompt = findRecentDisplacementProblemPrompt(recentMessages);
    if (!previousPrompt) return null;

    const followUpPrompt = `${previousPrompt} What is the total distance traveled?`;
    const { questionRoute } = routeMessage(followUpPrompt);
    if (questionRoute?.type !== 'science_formula' || !/distance/i.test(questionRoute.directAnswer || '')) return null;

    return {
      response: questionRoute.directAnswer,
      routeType: questionRoute?.public?.type || questionRoute.type,
      confidence: questionRoute.confidence,
      questionRoute,
      pendingClarification: nextPendingClarification(questionRoute),
      isStandardsFollowUp: false
    };
  }

  function logAiImprovementProblem({
    message,
    questionRoute = null,
    matchedKnowledge = [],
    answerGiven = '',
    category = 'needs_review',
    reason = '',
    source = 'auto',
    debug = {}
  }) {
    try {
      logProblem({
        status: 'open',
        category,
        studentQuestion: message,
        answerGiven,
        routerType: questionRoute?.type || '',
        formulaChosen: getFormulaChosen(questionRoute),
        confidence: questionRoute?.confidence || '',
        source,
        reason,
        debug: {
          route: questionRoute?.public || null,
          notes: questionRoute?.notes || '',
          toolsUsed: questionRoute?.toolsUsed || [],
          matchedKnowledge: matchedKnowledge.map((item) => ({
            id: item.id,
            title: item.title,
            category: item.category,
            score: item.score
          })),
          ...debug
        }
      });
    } catch (error) {
      console.warn('Could not write AI Improvement problem log:', error.message);
    }
  }

  function logCompletedInteraction({
    message,
    questionRoute = null,
    answerGiven = '',
    source = 'chat',
    sessionId = '',
    isTutorStep = false,
    reportableForStandards = true,
    tutorOriginalQuestion = '',
    debug = {}
  }) {
    try {
      const routeType = questionRoute?.public?.type || questionRoute?.type || '';
      const formulaChosen = getFormulaChosen(questionRoute);
      const standardsMetadata = buildStandardsLogMetadata(message);

      logStudentInteraction({
        studentQuestion: message,
        question: message,
        message,
        answerGiven,
        answer: answerGiven,
        response: answerGiven,
        routerType: questionRoute?.type || '',
        routeType,
        type: routeType,
        formulaChosen,
        category: formulaChosen || routeType,
        confidence: questionRoute?.confidence || '',
        ...standardsMetadata,
        source,
        sessionId,
        isTutorStep: Boolean(isTutorStep),
        reportableForStandards: reportableForStandards !== false,
        tutorOriginalQuestion,
        debug: {
          route: questionRoute?.public || null,
          ...debug
        }
      });
    } catch (error) {
      console.warn('Could not write student interaction log:', error.message);
    }
  }

  return {
    answerStudentMessage,
    answerStandardsFollowUp,
    answerWhyThisMattersFollowUp,
    getTeacherKnowledgeCount,
    logAiImprovementProblem,
    logCompletedInteraction,
    maybeLogReviewQuestion,
    nextPendingClarification,
    resolvePendingClarification,
    routeMessage
  };
}

function isTrustedIndependentRoute(message, questionRoute) {
  const normalizedMessage = normalize(message);
  const isContextOnlyFragment =
    /^(?:what is|whats) the formula(?: for (?:it|that|this))?$/.test(normalizedMessage) ||
    /^for\s+/.test(normalizedMessage);
  return Boolean(
    !isContextOnlyFragment &&
    questionRoute &&
    questionRoute.type !== 'no_match' &&
    questionRoute.confidence === 'strong' &&
    questionRoute.aiAllowed === false &&
    String(questionRoute.directAnswer || '').trim()
  );
}

function getGraphContext(message, graph) {
  if (!graph) return null;

  return sanitizeGraphContext(findGraphContext(message, graph));
}

function sanitizeGraphContext(context) {
  const matchedNodes = sanitizeGraphNodes(context?.matchedNodes, 12);
  const relatedNodes = sanitizeGraphNodes(context?.relatedNodes, 12);
  const edges = sanitizeGraphEdges(prioritizeGraphEdges(context?.edges, context), 24);
  const possiblePaths = sanitizeGraphPaths(context?.possiblePaths, 4);

  if (!matchedNodes.length && !relatedNodes.length && !edges.length && !possiblePaths.length) {
    return null;
  }

  return {
    aiAllowed: false,
    matchedNodes,
    relatedNodes,
    edges,
    possiblePaths
  };
}

function sanitizeGraphNodes(nodes, limit) {
  return (Array.isArray(nodes) ? nodes : [])
    .slice(0, limit)
    .map((node) => ({
      id: String(node.id || ''),
      type: String(node.type || ''),
      label: String(node.label || ''),
      matchedTerm: String(node.matchedTerm || ''),
      packId: String(node.packId || ''),
      standards: Array.isArray(node.standards) ? node.standards.map(String) : [],
      definition: firstGraphMetadataString(node, ['definition', 'fact', 'studentFriendlyRule']),
      misconception: firstGraphMetadataString(node, ['commonMisconception', 'misconception', 'common_misconceptions']),
      example: firstGraphMetadataString(node, ['exampleCue', 'example'])
    }));
}

function firstGraphMetadataString(node, keys) {
  const metadata = node?.metadata && typeof node.metadata === 'object' && !Array.isArray(node.metadata)
    ? node.metadata
    : {};

  for (const key of keys) {
    const value = metadata[key];
    if (Array.isArray(value)) {
      const firstValue = value.map(String).find((entry) => entry.trim());
      if (firstValue) return firstValue.trim();
    }
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return '';
}

function prioritizeGraphEdges(edges, context) {
  const nodeById = new Map([
    ...(context?.matchedNodes || []),
    ...(context?.relatedNodes || [])
  ].map((node) => [node.id, node]));

  return (Array.isArray(edges) ? edges : [])
    .slice()
    .sort((left, right) => graphEdgePriority(left, nodeById) - graphEdgePriority(right, nodeById) || compareGraphEdges(left, right));
}

function graphEdgePriority(edge, nodeById) {
  const fromNode = nodeById.get(edge.from) || {};
  const toNode = nodeById.get(edge.to) || {};
  const endpointPenalty = graphEndpointPenalty(fromNode) + graphEndpointPenalty(toNode);
  const typePenalty = graphEdgeTypePenalty(edge.type);
  return endpointPenalty + typePenalty;
}

function graphEndpointPenalty(node = {}) {
  if (node.type === 'vocabulary') return 0;
  if (node.type === 'concept') return 1;
  if (node.type === 'formula') return 2;
  if (node.type === 'misconception') return 4;
  if (node.type === 'problem') return 8;
  if (node.type === 'source') return 12;
  return 6;
}

function graphEdgeTypePenalty(type) {
  if (type === 'commonly_confused_with') return 0;
  if (type === 'related_to') return 1;
  if (type === 'uses_concept') return 2;
  if (type === 'has_misconception') return 3;
  if (type === 'prerequisite_for') return 4;
  if (type === 'example_of') return 8;
  if (type === 'assessed_by') return 10;
  if (type === 'source_supports') return 12;
  return 6;
}

function compareGraphEdges(left, right) {
  return String(left.from || '').localeCompare(String(right.from || '')) ||
    String(left.to || '').localeCompare(String(right.to || '')) ||
    String(left.type || '').localeCompare(String(right.type || ''));
}

function sanitizeGraphEdges(edges, limit) {
  return (Array.isArray(edges) ? edges : [])
    .slice(0, limit)
    .map((edge) => ({
      from: String(edge.from || ''),
      to: String(edge.to || ''),
      type: String(edge.type || ''),
      label: String(edge.label || ''),
      confidence: String(edge.confidence || '')
    }));
}

function sanitizeGraphPaths(paths, limit) {
  return (Array.isArray(paths) ? paths : [])
    .slice(0, limit)
    .map((path) => ({
      found: Boolean(path.found),
      from: String(path.from || ''),
      to: String(path.to || ''),
      length: Number.isFinite(path.length) ? path.length : 0,
      nodes: sanitizeGraphPathNodes(path.nodes, 8),
      edges: sanitizeGraphPathEdges(path.edges, 8)
    }));
}

function sanitizeGraphPathNodes(nodes, limit) {
  return (Array.isArray(nodes) ? nodes : [])
    .slice(0, limit)
    .map((node) => ({
      id: String(node.id || ''),
      type: String(node.type || ''),
      label: String(node.label || '')
    }));
}

function sanitizeGraphPathEdges(edges, limit) {
  return (Array.isArray(edges) ? edges : [])
    .slice(0, limit)
    .map((edge) => ({
      from: String(edge.from || ''),
      to: String(edge.to || ''),
      type: String(edge.type || ''),
      label: String(edge.label || ''),
      confidence: String(edge.confidence || ''),
      direction: String(edge.direction || '')
    }));
}

function attachGraphContextToRoute(questionRoute, graphContext) {
  if (!questionRoute || !graphContext) return;

  questionRoute.graphContext = graphContext;
  if (questionRoute.public && typeof questionRoute.public === 'object') {
    questionRoute.public.graphContext = graphContext;
  }
}

function buildGraphQuestionRoute(questionRoute, graphAnswer) {
  const toolsUsed = uniqueRouteTools([...(questionRoute.toolsUsed || []), 'knowledge_graph']);
  const publicGraphAnswer = {
    type: graphAnswer.type,
    aiAllowed: false,
    directAnswer: graphAnswer.directAnswer,
    explanation: graphAnswer.explanation,
    graphPath: graphAnswer.graphPath,
    connectedConcepts: graphAnswer.connectedConcepts,
    source: graphAnswer.source
  };

  return {
    ...questionRoute,
    type: 'knowledge_graph_answer',
    confidence: 'strong',
    toolsUsed,
    notes: `${questionRoute.notes || ''} Answered relationship/comparison question from approved knowledge graph.`.trim(),
    directAnswer: graphAnswer.directAnswer,
    aiAllowed: false,
    graphAnswer,
    public: {
      ...(questionRoute.public || {}),
      type: 'knowledge_graph_answer',
      confidence: 'strong',
      toolsUsed,
      aiAllowed: false,
      graphAnswer: publicGraphAnswer
    }
  };
}

function buildGraphRoutingSupportQuestionRoute(questionRoute, graphRoutingSupportAnswer) {
  const toolsUsed = uniqueRouteTools([...(questionRoute.toolsUsed || []), 'knowledge_graph']);
  const publicGraphRoutingSupport = {
    type: graphRoutingSupportAnswer.type,
    aiAllowed: false,
    supportIntent: graphRoutingSupportAnswer.supportIntent,
    directAnswer: graphRoutingSupportAnswer.directAnswer,
    explanation: graphRoutingSupportAnswer.explanation,
    connectedConcepts: graphRoutingSupportAnswer.connectedConcepts,
    prerequisiteConcepts: graphRoutingSupportAnswer.prerequisiteConcepts,
    commonMisconceptions: graphRoutingSupportAnswer.commonMisconceptions,
    graphPath: graphRoutingSupportAnswer.graphPath,
    source: graphRoutingSupportAnswer.source
  };

  return {
    ...questionRoute,
    type: 'knowledge_graph_support',
    confidence: 'strong',
    toolsUsed,
    notes: `${questionRoute.notes || ''} Added graph routing support from approved knowledge graph.`.trim(),
    directAnswer: graphRoutingSupportAnswer.directAnswer,
    aiAllowed: false,
    graphRoutingSupportAnswer,
    public: {
      ...(questionRoute.public || {}),
      type: 'knowledge_graph_support',
      confidence: 'strong',
      toolsUsed,
      aiAllowed: false,
      graphRoutingSupportAnswer: publicGraphRoutingSupport
    }
  };
}

function uniqueRouteTools(tools) {
  return Array.from(new Set((tools || []).map(String).filter(Boolean)));
}

function answerCircuitDiagramCheckFollowUp(message, recentMessages = []) {
  const choice = normalizeYesNo(message);
  if (!choice) return null;

  const context = findLastCircuitDiagramCheck(recentMessages);
  if (!context) return null;

  const correct = choice === 'yes';
  const response = correct
    ? 'Good check. Yes, that matches the circuit drawing.'
    : context.type === 'parallel'
      ? 'Look again at the branches/paths in the drawing. In a parallel circuit, each bulb should have its own branch.'
      : 'Look again at the path in the drawing. In a series circuit, current should have only one complete path.';

  return {
    response,
    routeType: 'circuit_diagram_followup',
    confidence: 'strong',
    questionRoute: {
      type: 'circuit_diagram_followup',
      confidence: 'strong',
      toolsUsed: ['circuit_diagram_rules'],
      notes: `Answered immediate ${context.type} circuit drawing yes/no check.`,
      directAnswer: response,
      aiAllowed: false,
      public: {
        type: 'circuit_diagram_followup',
        confidence: 'strong'
      }
    },
    pendingClarification: null,
    isStandardsFollowUp: false
  };
}

function normalizeYesNo(message) {
  const text = String(message || '')
    .toLowerCase()
    .replace(/[?.!,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(?:yes|yeah|yep|yup|correct|right|it does|they do)$/.test(text)) return 'yes';
  if (/^(?:no|nope|nah|incorrect|wrong|it does not|it doesnt|they do not|they dont)$/.test(text)) return 'no';
  return '';
}

function findLastCircuitDiagramCheck(recentMessages = []) {
  if (!Array.isArray(recentMessages)) return null;

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const entry = recentMessages[index] || {};
    if (entry.routeType !== 'circuit_diagram') continue;
    const response = String(entry.response || '');
    if (/Check:\s*Does current have only one complete path\?/i.test(response)) {
      return { type: 'series' };
    }
    if (/Check:\s*Does each bulb have its own branch\/path\?/i.test(response)) {
      return { type: 'parallel' };
    }
  }

  return null;
}

function asksForDistanceAfterDisplacement(message) {
  const text = normalize(message);
  if (/\d/.test(text)) return false;
  return /\b(?:what\s+is|whats|find|calculate|how\s+far\s+did)\s+(?:the\s+)?(?:total\s+)?distance\b/.test(text) ||
    /\b(?:distance\s+traveled|total\s+distance)\b/.test(text);
}

function findRecentDisplacementProblemPrompt(recentMessages = []) {
  if (!Array.isArray(recentMessages)) return '';

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const entry = recentMessages[index] || {};
    if (entry.routeType !== 'science_formula') continue;
    const response = String(entry.response || '');
    const message = String(entry.message || '');
    if (!/\bdisplacement\b/i.test(response)) continue;
    if (!hasDirectedMovementOrSpecialDistanceCase(message)) continue;
    return message;
  }

  return '';
}

function hasDirectedMovementOrSpecialDistanceCase(message) {
  const text = normalize(message);
  if (/\b(?:around\s+(?:the\s+)?block|pool\s+length|spins?\s+in\s+place|spinning\s+in\s+place)\b/.test(text)) return true;
  const directionMatches = text.match(/\b(?:east|west|north|south|left|right|forward|back|backward|backwards|up|down)\b/g) || [];
  return directionMatches.length > 0 && /\d/.test(text);
}

const CONTEXT_TOPICS = [
  'kinetic energy',
  'potential energy',
  'acceleration',
  'resistance',
  'electric current',
  'current',
  'friction',
  'density',
  'gravity',
  'momentum',
  'velocity',
  'volume',
  'voltage',
  'force',
  'speed',
  'weight',
  'power',
  'work',
  'mass'
];

function resolveStudentContextCarryover(message, recentMessages = [], context = {}) {
  const original = String(message || '');
  const lower = normalize(original);
  if (isFillInTheBlankPrompt(original) && !hasExplicitBlankContextDependency(original)) {
    return { needsContext: false, topic: '', message: original };
  }

  if (!hasContextFollowUpLanguage(lower)) return { needsContext: false, topic: '', message: original };

  if (looksLikeSelfContainedFormulaQuestion(lower)) {
    return { needsContext: false, topic: '', message: original };
  }

  if (looksLikeSelfContainedTemperatureFormulaLookup(lower)) {
    return { needsContext: false, topic: '', message: original };
  }

  if (looksLikeSelfContainedNewtonLawQuestion(lower)) {
    return { needsContext: false, topic: '', message: original };
  }

  const fragmentTopic = findForTopicFragment(original);
  if (fragmentTopic && looksLikeFormulaFollowUp(context.lastAnsweredPrompt)) {
    return {
      needsContext: true,
      topic: fragmentTopic,
      message: `what is the formula for ${fragmentTopic}`
    };
  }

  if (findTopicInText(original)) return { needsContext: false, topic: '', message: original };

  if (asksAboutEachOrBoth(lower)) {
    const comparisonContext = findRecentComparisonContext(recentMessages) ||
      findComparisonContext(context.lastAnsweredPrompt) ||
      findComparisonContext(context.lastAnsweredAnswer);

    if (comparisonContext) {
      return {
        needsContext: true,
        topic: comparisonContext.topic,
        message: buildComparisonFollowUpMessage(original, comparisonContext)
      };
    }
  }

  const topic = findRecentContextTopic(recentMessages) ||
    findTopicInText(context.lastAnsweredPrompt) ||
    findTopicInText(context.lastAnsweredAnswer);
  if (!topic) return { needsContext: true, topic: '', message: original };

  return {
    needsContext: true,
    topic,
    message: buildContextualFollowUpMessage(original, topic)
  };
}

function hasContextFollowUpLanguage(lower) {
  const text = String(lower || '')
    .replace(/[?.!,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /^(?:it|that|this|they|them|those)\b/.test(text) ||
    /\bwhat\s+about\s+(?:it|that|this|them|those)\b/.test(text) ||
    /\b(?:it|that|this|they|them|those)\s+(?:formula|one|problem|question)\b/.test(text) ||
    /\b(?:that|this|the\s+same)\s+(?:formula|one|problem|question)\b/.test(text) ||
    /\bthe\s+same\s+one\b/.test(text) ||
    /\b(?:can\s+you\s+)?(?:give|show)\s+(?:me\s+)?(?:an|and|a)?\s*example\s+of\s+(?:each|both)\b/.test(text) ||
    /\bgive\s+(?:an|and|a)?\s*example\s+of\s+both\b/.test(text) ||
    /\bexample\s+of\s+(?:each|both)\b/.test(text) ||
    /\bexplain\s+each\b/.test(text) ||
    /\bwhat\s+about\s+both\b/.test(text) ||
    /^(?:what\s+is|whats)\s+the\s+formula\b/.test(text) ||
    /^for\s+[a-z0-9 -]+\b/.test(text) ||
    /^number\s+\d+\b/.test(text) ||
    /\b(?:solve\s+(?:for|fro)|find|calculate|determine)\s+(?:it|that|this|them|those)\b/.test(text);
}

function asksAboutEachOrBoth(normalized) {
  return /\b(?:each|both)\b/.test(String(normalized || ''));
}

function looksLikeSelfContainedFormulaQuestion(lower) {
  if (!/\d/.test(lower)) return false;
  return /\b(?:how\s+(?:far|long|fast|much)|what\s+is|what's|find|calculate|determine|solve\s+for)\b/.test(lower) &&
    /\b(?:m\/s|km\/h|km\/hr|mph|g\/ml|g\/cm|cm³|cm\^3|newtons?|kg|grams?|hours?|seconds?|meters?|miles?|kilometers?|milliliters?|ml)\b/.test(lower);
}

function looksLikeSelfContainedTemperatureFormulaLookup(lower) {
  return /^(?:what\s+is|whats)\s+(?:the\s+)?(?:formula|equation)\b/.test(lower) &&
    /\b(?:kelvin|celsius|celcius|fahrenheit|farenheit|farenhiet)\b/.test(lower) &&
    /\b(?:from|to)\b/.test(lower);
}

function looksLikeSelfContainedNewtonLawQuestion(lower) {
  return /\b(?:what|which)\s+(?:newton'?s?\s*)?law\b/.test(lower) ||
    /\bnewton'?s?\s+law\b/.test(lower);
}

function findRecentContextTopic(recentMessages) {
  if (!Array.isArray(recentMessages)) return '';

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const entry = recentMessages[index] || {};
    const topic = findTopicInText(entry.message) || findTopicInText(entry.response);
    if (topic) return topic;
  }

  return '';
}

const COMPARISON_CONTEXT_TOPICS = [
  {
    label: "Newton's First Law",
    routeTerm: 'newtons first law',
    aliases: ['newtons first law', 'newton first law', 'newton s first law', 'first law'],
    ordinalPattern: /\b(?:first|1st|one)\b/
  },
  {
    label: "Newton's Second Law",
    routeTerm: 'newtons second law',
    aliases: ['newtons second law', 'newton second law', 'newton s second law', 'second law'],
    ordinalPattern: /\b(?:second|2nd|two)\b/
  },
  {
    label: "Newton's Third Law",
    routeTerm: 'newtons third law',
    aliases: ['newtons third law', 'newton third law', 'newton s third law', 'third law'],
    ordinalPattern: /\b(?:third|3rd|three)\b/
  },
  {
    label: 'mass',
    routeTerm: 'mass',
    aliases: ['mass']
  },
  {
    label: 'weight',
    routeTerm: 'weight',
    aliases: ['weight']
  },
  {
    label: 'frequency',
    routeTerm: 'frequency',
    aliases: ['frequency']
  },
  {
    label: 'wavelength',
    routeTerm: 'wavelength',
    aliases: ['wavelength']
  }
];

function findRecentComparisonContext(recentMessages) {
  if (!Array.isArray(recentMessages)) return null;

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const entry = recentMessages[index] || {};
    const context = findComparisonContext(entry.message) || findComparisonContext(entry.response);
    if (context) return context;
  }

  return null;
}

function findComparisonContext(value) {
  const text = normalize(value);
  if (!text || !looksLikeComparisonContext(text)) return null;

  const topics = [];
  const hasNewtonLawContext = /\bnewtons?\b/.test(text) && /\blaws?\b/.test(text);

  for (const topic of COMPARISON_CONTEXT_TOPICS) {
    const mentionedByAlias = topic.aliases.some((alias) => hasContextPhrase(text, alias));
    const mentionedByOrdinal = hasNewtonLawContext && topic.ordinalPattern?.test(text);
    if (mentionedByAlias || mentionedByOrdinal) topics.push(topic);
  }

  if (topics.length < 2) return null;

  return {
    topics,
    topic: formatContextTopicList(topics.map((topic) => topic.label))
  };
}

function looksLikeComparisonContext(normalized) {
  return /\bdifference\s+between\b/.test(normalized) ||
    /\bcompare\b/.test(normalized) ||
    /\bvs\b/.test(normalized) ||
    /\bversus\b/.test(normalized) ||
    /\bhow\s+(?:is|are)\b.+\brelated\b/.test(normalized) ||
    /\bhow\s+are\b.+\bdifferent\b/.test(normalized) ||
    /\bthe\s+simple\s+difference\b/.test(normalized) ||
    /\bshort\s+comparison\b/.test(normalized);
}

function findTopicInText(value) {
  const text = normalize(value);
  for (const topic of CONTEXT_TOPICS) {
    const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`).test(text)) return topic;
  }

  return '';
}

function hasContextPhrase(text, phrase) {
  const escaped = String(phrase || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function replaceContextPronoun(message, topic) {
  return String(message || '').replace(/\b(it|that|this|they|them|those)\b/i, topic);
}

function buildContextualFollowUpMessage(message, topic) {
  const text = String(message || '').trim();
  const lower = text.toLowerCase();
  if (/^(?:what\s+is|whats)\s+the\s+formula\b/.test(lower) && !/\bfor\b/.test(lower)) {
    return `${text} for ${topic}`;
  }

  return replaceContextPronoun(text, topic);
}

function buildComparisonFollowUpMessage(message, comparisonContext) {
  const text = String(message || '').trim();
  const topicText = comparisonContext.topics.map((topic) => topic.routeTerm).join(' and ');
  const normalized = normalize(text);

  if (looksLikeExampleFollowUp(normalized)) {
    return `give an example of ${topicText}`;
  }

  if (/\bexplain\s+each\b/.test(normalized)) {
    return `explain ${topicText}`;
  }

  return `${text} ${topicText}`;
}

function looksLikeExampleFollowUp(normalized) {
  return /\bexample\b/.test(String(normalized || ''));
}

function findForTopicFragment(message) {
  const match = /^\s*for\s+([a-z0-9 -]+?)\s*[?.!]*\s*$/i.exec(String(message || ''));
  if (!match) return '';
  return findTopicInText(match[1]);
}

function looksLikeFormulaFollowUp(message) {
  return /\bformula\b/i.test(String(message || ''));
}

function buildContextClarificationResponse() {
  const response = 'What topic do you mean? Tell me the vocabulary word or formula you are asking about.';
  return {
    response,
    routeType: 'student_context_clarification',
    confidence: 'none',
    questionRoute: {
      type: 'student_context_clarification',
      confidence: 'none',
      directAnswer: response,
      aiAllowed: false,
      public: {
        type: 'student_context_clarification',
        confidence: 'none'
      }
    },
    pendingClarification: null,
    isStandardsFollowUp: false
  };
}

function formatContextTopicList(values = []) {
  const items = values.filter(Boolean);
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function withCarryoverPrefix(response, contextCarryover) {
  if (!contextCarryover?.topic || !response) return response;
  return `You were asking about ${contextCarryover.topic}. ${response}`;
}

function getRouteReviewInfo(questionRoute) {
  if (!questionRoute) {
    return { category: 'no_trusted_answer', reason: 'no_route' };
  }

  if (questionRoute.type === 'no_match') {
    if (looksLikeSafetyBlock(questionRoute)) {
      return { category: 'rejected_question', reason: 'rejected' };
    }

    return { category: 'no_trusted_answer', reason: 'no_trusted_answer' };
  }

  if (questionRoute.confidence === 'none') {
    return { category: 'no_trusted_answer', reason: 'no_trusted_answer' };
  }

  if (questionRoute.confidence === 'weak') {
    return { category: 'needs_review', reason: 'low_confidence' };
  }

  return null;
}

function looksLikeSafetyBlock(questionRoute) {
  const text = `${questionRoute.notes || ''} ${questionRoute.directAnswer || ''}`.toLowerCase();
  return /\bsafety\b|\beating\b|\btouching\b|\bsmelling\b|\bchemical\b/.test(text);
}

function getFormulaChosen(questionRoute) {
  return questionRoute?.formulaChosen
    || questionRoute?.public?.formulaChosen
    || questionRoute?.calculatorResult?.expression
    || '';
}

function isApprovedUploadedKnowledgeItem(item = {}) {
  return /^approved_/.test(String(item.category || '')) ||
    String(item.id || '').startsWith('approved-pack:');
}

module.exports = {
  createQuestionAnswerService,
  resolveStudentContextCarryover
};
