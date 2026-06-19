const assert = require('node:assert/strict');

function assertRouterCase(route, test) {
  const answerText = String(route.directAnswer || '');

  assert.equal(route.type, test.type);
  assert.equal(route.aiAllowed, test.aiAllowed);

  for (const expected of test.includes) {
    assert.ok(
      answerText.includes(expected),
      `Expected answer to include "${expected}" but got:\n${answerText}`
    );
  }

  for (const unexpected of test.excludes || []) {
    assert.ok(
      !answerText.includes(unexpected),
      `Expected answer not to include "${unexpected}" but got:\n${answerText}`
    );
  }

  if (test.diagramIncludes) {
    const diagramText = normalizeDiagramText(route.diagramText);
    assert.ok(diagramText, 'Expected questionRoute.diagramText to exist');
    for (const expected of test.diagramIncludes) {
      assert.ok(
        diagramText.includes(normalizeDiagramText(expected)),
        `Expected diagramText to include "${expected}" but got:\n${route.diagramText}`
      );
    }
  }

  if (test.formulaWork) {
    assert.ok(route.formulaWork, 'Expected questionRoute.formulaWork to exist');
    assert.equal(route.formulaWork.formulaId, test.formulaWork.formulaId);
    if (Object.prototype.hasOwnProperty.call(test.formulaWork, 'solveFor')) {
      assert.equal(route.formulaWork.solveFor, test.formulaWork.solveFor);
    }
    if (Object.prototype.hasOwnProperty.call(test.formulaWork, 'formula')) {
      assert.equal(route.formulaWork.formula, test.formulaWork.formula);
    }
    if (Object.prototype.hasOwnProperty.call(test.formulaWork, 'massValue')) {
      assert.equal(route.formulaWork.variables.mass.value, test.formulaWork.massValue);
    }
    if (Object.prototype.hasOwnProperty.call(test.formulaWork, 'accelerationValue')) {
      assert.equal(route.formulaWork.variables.acceleration.value, test.formulaWork.accelerationValue);
    }
    for (const [key, expected] of Object.entries(test.formulaWork.variables || {})) {
      assert.ok(route.formulaWork.variables[key], `Expected formulaWork.variables.${key} to exist`);
      if (Object.prototype.hasOwnProperty.call(expected, 'value')) {
        assert.equal(route.formulaWork.variables[key].value, expected.value);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'unit')) {
        assert.equal(route.formulaWork.variables[key].unit, expected.unit);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'display')) {
        assert.equal(route.formulaWork.variables[key].display, expected.display);
      }
    }
    if (Object.prototype.hasOwnProperty.call(test.formulaWork, 'finalAnswerValue')) {
      assert.equal(route.formulaWork.finalAnswer.value, test.formulaWork.finalAnswerValue);
    }
    if (Object.prototype.hasOwnProperty.call(test.formulaWork, 'finalAnswerDisplay')) {
      assert.equal(route.formulaWork.finalAnswer.display, test.formulaWork.finalAnswerDisplay);
    }
    assert.ok(
      Array.isArray(route.formulaWork.steps) && route.formulaWork.steps.length >= test.formulaWork.minStepCount,
      `Expected formulaWork.steps to have at least ${test.formulaWork.minStepCount} steps`
    );
    assert.deepEqual(route.public.formulaWork, {
      formulaId: route.formulaWork.formulaId,
      family: route.formulaWork.family,
      solveFor: route.formulaWork.solveFor,
      formula: route.formulaWork.formula,
      hasGuidedSteps: true
    });
  }

  if (test.noFormulaWork) {
    assert.ok(!route.formulaWork, 'Expected questionRoute.formulaWork to be absent');
  }
}

function normalizeDiagramText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  assertRouterCase,
  normalizeDiagramText
};
