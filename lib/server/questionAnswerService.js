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

function createQuestionAnswerService({
  teacherFactsFile,
  maxKnowledgeItems,
  loadTeacherKnowledge,
  findRelevantKnowledge,
  routeStudentQuestion,
  ollama,
  logProblem,
  logStudentInteraction,
  initialTeacherKnowledge = []
}) {
  let teacherKnowledge = initialTeacherKnowledge;

  function reloadTeacherKnowledge() {
    teacherKnowledge = loadTeacherKnowledge(teacherFactsFile);
    return teacherKnowledge;
  }

  function getTeacherKnowledgeCount() {
    return teacherKnowledge.length;
  }

  function getRelevantKnowledge(message) {
    return findRelevantKnowledge(message, teacherKnowledge, maxKnowledgeItems);
  }

  function routeMessage(message) {
    reloadTeacherKnowledge();
    const matchedKnowledge = getRelevantKnowledge(message);
    const questionRoute = routeStudentQuestion(message, matchedKnowledge);
    return { matchedKnowledge, questionRoute };
  }

  async function answerStudentMessage(message, options = {}) {
    const contextCarryover = resolveStudentContextCarryover(message, options.recentMessages || [], {
      lastAnsweredPrompt: options.lastAnsweredPrompt || '',
      lastAnsweredAnswer: options.lastAnsweredAnswer || options.contextAnswer || ''
    });
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

    const { matchedKnowledge, questionRoute } = routeMessage(routedMessage);
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

const CONTEXT_TOPICS = [
  'kinetic energy',
  'potential energy',
  'acceleration',
  'resistance',
  'electric current',
  'current',
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
  const lower = original.toLowerCase();
  const hasPronoun = /\b(it|that|this|they|them|those)\b/.test(lower);
  if (!hasPronoun) return { needsContext: false, topic: '', message: original };

  if (looksLikeSelfContainedFormulaQuestion(lower)) {
    return { needsContext: false, topic: '', message: original };
  }

  if (findTopicInText(original)) return { needsContext: false, topic: '', message: original };

  const topic = findRecentContextTopic(recentMessages) ||
    findTopicInText(context.lastAnsweredPrompt) ||
    findTopicInText(context.lastAnsweredAnswer);
  if (!topic) return { needsContext: true, topic: '', message: original };

  return {
    needsContext: true,
    topic,
    message: replaceContextPronoun(original, topic)
  };
}

function looksLikeSelfContainedFormulaQuestion(lower) {
  if (!/\d/.test(lower)) return false;
  return /\b(?:how\s+(?:far|long|fast|much)|what\s+is|what's|find|calculate|determine|solve\s+for)\b/.test(lower) &&
    /\b(?:m\/s|km\/h|km\/hr|mph|g\/ml|g\/cm|cm³|cm\^3|newtons?|kg|grams?|hours?|seconds?|meters?|miles?|kilometers?|milliliters?|ml)\b/.test(lower);
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

function findTopicInText(value) {
  const text = String(value || '').toLowerCase();
  for (const topic of CONTEXT_TOPICS) {
    const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`).test(text)) return topic;
  }

  return '';
}

function replaceContextPronoun(message, topic) {
  return String(message || '').replace(/\b(it|that|this|they|them|those)\b/i, topic);
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

module.exports = {
  createQuestionAnswerService,
  resolveStudentContextCarryover
};
