function makeRoute(route) {
  const diagramText = String(route.diagramText || '').trim();
  const directAnswer = appendNetForceDiagram(route.directAnswer || '', route, diagramText);
  const publicRoute = {
    type: route.type,
    confidence: route.confidence,
    toolsUsed: route.toolsUsed || [],
    notes: route.notes || '',
    aiAllowed: Boolean(route.aiAllowed)
  };

  if (route.calculatorResult) {
    publicRoute.calculator = {
      expression: route.calculatorResult.expression,
      displayExpression: route.calculatorResult.displayExpression,
      answer: route.calculatorResult.displayValue
    };
  }

  if (route.pendingClarification) {
    publicRoute.pendingClarification = {
      id: route.pendingClarification.id,
      choices: route.pendingClarification.choices.map((choice) => ({
        number: choice.number,
        label: choice.label
      }))
    };
  }

  if (route.standardId) {
    publicRoute.standardId = route.standardId;
  }

  if (route.formulaWork) {
    // Public route metadata only identifies the guided tutor shape; expected answers stay server-side.
    publicRoute.formulaWork = {
      formulaId: route.formulaWork.formulaId,
      family: route.formulaWork.family,
      solveFor: route.formulaWork.solveFor,
      formula: route.formulaWork.formula,
      hasGuidedSteps: Array.isArray(route.formulaWork.steps) && route.formulaWork.steps.length > 0
    };
    if (route.formulaWork.activityId) {
      publicRoute.formulaWork.activityId = route.formulaWork.activityId;
      publicRoute.formulaWork.activityVersion = route.formulaWork.activityVersion || '';
    }
  }

  if (route.motionForceTutor) {
    publicRoute.motionForceTutor = {
      id: route.motionForceTutor.id,
      topic: route.motionForceTutor.topic,
      category: route.motionForceTutor.category,
      hasGuidedSteps: Array.isArray(route.motionForceTutor.guidingQuestions) && route.motionForceTutor.guidingQuestions.length > 0
    };
  }

  const representationIntent = buildRepresentationIntent(route);
  if (representationIntent) {
    publicRoute.representationIntent = representationIntent;
  }

  const imageRequest = buildImageRequest(route);
  if (imageRequest) {
    publicRoute.imageRequest = imageRequest;
  }

  return {
    type: route.type,
    confidence: route.confidence,
    toolsUsed: route.toolsUsed || [],
    notes: route.notes || '',
    directAnswer,
    calculatorResult: route.calculatorResult || null,
    formulaWork: route.formulaWork || null,
    motionForceTutor: route.motionForceTutor || null,
    diagramText,
    pendingClarification: route.pendingClarification || null,
    standardId: route.standardId || '',
    representationIntent,
    imageRequest,
    answerTopics: uniqueStrings(route.answerTopics || route.evidence?.topics),
    answerConcepts: uniqueStrings(route.answerConcepts || route.evidence?.concepts),
    evidence: clonePlainObject(route.evidence),
    aiAllowed: Boolean(route.aiAllowed),
    public: publicRoute
  };
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)));
}

function clonePlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return JSON.parse(JSON.stringify(value));
}

function buildRepresentationIntent(route = {}) {
  const requestedRepresentation = String(route.requestedRepresentation || '').trim();
  const requestedLearningShape = route.requestedLearningShape || null;
  const requestedInteractionMode = String(route.requestedInteractionMode || '').trim();
  if (!requestedRepresentation && !requestedLearningShape) return null;

  const intent = {
    requestedRepresentation: requestedRepresentation || 'default',
    requestedLearningShape,
    shouldAskRepresentationFollowup: Boolean(route.shouldAskRepresentationFollowup)
  };

  if (requestedInteractionMode) intent.requestedInteractionMode = requestedInteractionMode;
  return intent;
}

function buildImageRequest(route = {}) {
  if (!route.needsImageAsset && !route.imageQuery) return null;

  return {
    needsImageAsset: Boolean(route.needsImageAsset),
    imageQuery: route.imageQuery || null
  };
}

function appendNetForceDiagram(answer, route, diagramText) {
  const answerText = String(answer || '');
  if (!diagramText || !isNetForceRoute(route)) return answerText;

  if (normalizeDiagramForComparison(answerText).includes(normalizeDiagramForComparison(diagramText))) {
    return answerText;
  }

  return [answerText.trimEnd(), `Diagram:\n${diagramText}`]
    .filter(Boolean)
    .join('\n\n');
}

function isNetForceRoute(route) {
  if (route.type !== 'science_formula') return false;

  return /\bnet\s+force\b/i.test([
    route.notes || '',
    route.directAnswer || '',
    route.diagramText || ''
  ].join(' '));
}

function normalizeDiagramForComparison(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function buildKnowledgeAnswer(item, isStrong, options = {}) {
  const prefix = isStrong ? '' : 'I found something related. ';
  const contextPrefix = getKnowledgeAnswerContextPrefix(item);
  const lines = [];
  const examples = Array.isArray(item.examples) ? item.examples : [];

  if (options.preferExample && examples.length > 0) {
    return [
      `${prefix}Example: ${examples[0]}`,
      buildExampleConnectionSentence(item)
    ].filter(Boolean).join('\n');
  }

  if (item.fact) {
    lines.push(`${prefix}${contextPrefix}${item.fact}`);
  } else {
    lines.push(`${prefix}I found ${item.title}, but the local fact is incomplete.`);
  }

  if (item.formula) {
    lines.push(`Formula: ${item.formula}`);
  }

  if (item.answerContext !== 'plain' && examples.length > 0) {
    lines.push(`Example: ${examples[0]}`);
  }

  return lines.join('\n');
}

function buildExampleConnectionSentence(item = {}) {
  const title = String(item.title || 'the concept').trim();

  if (item.formula) {
    return `This shows ${title} because ${item.formula}.`;
  }

  const factSentence = firstSentence(item.fact);
  if (factSentence) {
    return `This connects to ${title}: ${factSentence}`;
  }

  return `This is an example of ${title}.`;
}

function firstSentence(value) {
  const text = String(value || '').trim();
  const match = /^.*?[.!?](?:\s|$)/.exec(text);
  return (match ? match[0] : text).trim();
}

function getKnowledgeAnswerContextPrefix(item = {}) {
  if (item.answerContext === 'plain') return '';

  return 'In 9th-grade science, ';
}

function cleanNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4))).replace(/\.0+$/, '');
}

module.exports = {
  buildKnowledgeAnswer,
  cleanNumber,
  makeRoute
};
