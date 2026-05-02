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

  async function answerStudentMessage(message) {
    const { matchedKnowledge, questionRoute } = routeMessage(message);
    let response = questionRoute.directAnswer || '';
    let usedAiFallback = false;

    maybeLogReviewQuestion({
      message,
      questionRoute,
      matchedKnowledge,
      answerGiven: response
    });

    if (!response || questionRoute.aiAllowed) {
      usedAiFallback = true;
      response = '';
      await ollama.stream({
        prompt: ollama.buildTeacherPrompt({ message, matchedKnowledge, questionRoute }),
        onText(textChunk) {
          response += textChunk || '';
        }
      });
    }

    if (usedAiFallback) {
      logAiImprovementProblem({
        message,
        questionRoute,
        matchedKnowledge,
        answerGiven: response,
        category: 'fallback_review',
        reason: 'fallback',
        source: 'student_session'
      });
    }

    return {
      response: response || 'I do not have a trusted answer for that yet. Please ask your teacher.',
      routeType: questionRoute?.public?.type || questionRoute?.type || 'unknown',
      confidence: questionRoute?.confidence || 'unknown',
      questionRoute
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
    getTeacherKnowledgeCount,
    logAiImprovementProblem,
    logCompletedInteraction,
    maybeLogReviewQuestion,
    routeMessage
  };
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
  createQuestionAnswerService
};
