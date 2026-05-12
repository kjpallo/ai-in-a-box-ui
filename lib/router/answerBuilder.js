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
  }

  return {
    type: route.type,
    confidence: route.confidence,
    toolsUsed: route.toolsUsed || [],
    notes: route.notes || '',
    directAnswer,
    calculatorResult: route.calculatorResult || null,
    formulaWork: route.formulaWork || null,
    diagramText,
    pendingClarification: route.pendingClarification || null,
    standardId: route.standardId || '',
    aiAllowed: Boolean(route.aiAllowed),
    public: publicRoute
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

function buildKnowledgeAnswer(item, isStrong) {
  const prefix = isStrong ? '' : 'I found something related. ';
  const lines = [];

  if (item.fact) {
    lines.push(`${prefix}In 9th-grade science, ${item.fact}`);
  } else {
    lines.push(`${prefix}I found ${item.title}, but the local fact is incomplete.`);
  }

  if (item.formula) {
    lines.push(`Formula: ${item.formula}`);
  }

  if (Array.isArray(item.examples) && item.examples.length > 0) {
    lines.push(`Example: ${item.examples[0]}`);
  }

  return lines.join('\n');
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
