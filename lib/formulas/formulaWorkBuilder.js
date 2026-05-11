function buildFormulaWork({
  formulaId,
  family,
  solveFor,
  formula,
  finalAnswer,
  variables,
  choices,
  formulaDistractors = ['D = m / V', 'speed = distance / time'],
  calculation
}) {
  const variableEntries = variables.map((variable) => ({
    ...variable,
    display: variable.display || `${cleanNumber(variable.value)} ${variable.unit}`.trim()
  }));
  const variableMap = Object.fromEntries(variableEntries.map((variable) => [
    variable.key,
    {
      symbol: variable.symbol || '',
      value: variable.value,
      unit: variable.unit || '',
      display: variable.display
    }
  ]));
  const targetChoices = (choices || variableEntries.map((variable) => variable.key)).map((choice, index) => ({
    number: index + 1,
    label: choice,
    correct: choice === solveFor
  }));
  const formulaChoices = [
    { number: 1, label: formula, correct: true },
    ...formulaDistractors.slice(0, 2).map((label, index) => ({
      number: index + 2,
      label,
      correct: false
    }))
  ];
  const knownValueSteps = variableEntries
    .filter((variable) => variable.key !== solveFor && variable.input !== false)
    .map((variable) => ({
      id: `identify_${variable.key.replace(/\s+/g, '_')}`,
      type: 'quantity',
      prompt: variable.prompt || `What number should go in for ${variable.key}${variable.symbol ? `, ${variable.symbol}` : ''}?`,
      expectedValue: variable.value,
      expectedUnit: variable.unit,
      expectedDisplay: variable.display,
      hints: variable.hints || [`Look for ${variable.display} in the problem.`]
    }));

  return {
    formulaId,
    family,
    solveFor,
    formula,
    finalAnswer,
    variables: variableMap,
    steps: [
      {
        id: 'identify_solve_target',
        type: 'multiple_choice',
        prompt: 'What variable are we solving for?',
        choices: targetChoices,
        expected: solveFor,
        hints: [`The question asks for ${solveFor}.`]
      },
      {
        id: 'choose_formula',
        type: 'multiple_choice',
        prompt: 'Which formula should we use?',
        choices: formulaChoices,
        expected: formula,
        hints: [`This problem gives the values needed to solve for ${solveFor}.`]
      },
      ...knownValueSteps,
      {
        id: 'calculate',
        type: 'calculation',
        prompt: calculation.prompt,
        expectedValue: calculation.expectedValue,
        expectedUnit: finalAnswer.unit,
        expectedDisplay: finalAnswer.display,
        hints: calculation.hints || ['Calculate the expression after substitution.']
      }
    ]
  };
}

function cleanNumber(value) {
  if (!Number.isFinite(Number(value))) return String(value);
  return Number(value).toLocaleString('en-US', {
    maximumFractionDigits: 4,
    useGrouping: false
  });
}

module.exports = { buildFormulaWork };
