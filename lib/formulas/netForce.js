const DIRECTIONS = {
  right: { axis: 'x', sign: 1, opposite: 'left' },
  east: { axis: 'x', sign: 1, opposite: 'west' },
  left: { axis: 'x', sign: -1, opposite: 'right' },
  west: { axis: 'x', sign: -1, opposite: 'east' },
  up: { axis: 'y', sign: 1, opposite: 'down' },
  north: { axis: 'y', sign: 1, opposite: 'south' },
  down: { axis: 'y', sign: -1, opposite: 'up' },
  south: { axis: 'y', sign: -1, opposite: 'north' },
  forward: { axis: 'relative', sign: 1, opposite: 'backward' },
  backward: { axis: 'relative', sign: -1, opposite: 'forward' }
};

const DIRECTION_WORDS = Object.keys(DIRECTIONS);
const NUMBER_PATTERN = '-?(?:(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)';
const DIRECTION_ALIASES = {
  rite: 'right',
  rght: 'right',
  upward: 'up',
  upwards: 'up',
  downward: 'down',
  downwards: 'down'
};
const DIRECTION_PATTERN_WORDS = [...DIRECTION_WORDS, ...Object.keys(DIRECTION_ALIASES)];

function tryNetForce(text, lower, ctx) {
  if (!looksLikeNetForceProblem(lower)) return null;

  const groupedEachPush = tryGroupedEachPushNetForce(text, lower, ctx);
  if (groupedEachPush) return groupedEachPush;

  const forces = findForces(text, ctx);
  if (forces.length < 2) return null;

  const prepared = prepareDirections(text, lower, forces);
  if (!prepared) return null;

  const { resolvedForces, axis, canceledAxes = [] } = prepared;
  const total = resolvedForces
    .filter((force) => force.direction.axis === axis)
    .reduce((sum, force) => sum + force.value * force.direction.sign, 0);

  if (!Number.isFinite(total)) return null;

  const net = Math.abs(total);
  const balanced = net === 0;
  const finalDirection = balanced ? null : directionForTotal(total, resolvedForces, axis);
  if (!balanced && !finalDirection) return null;

  const answerLines = buildNetForceLines({
    forces: resolvedForces,
    net,
    total,
    finalDirection,
    balanced,
    canceledAxes,
    axis,
    ctx
  });
  const diagramText = buildDiagramText({ forces: resolvedForces, net, total, finalDirection, balanced, axis, ctx });
  const result = ctx.answer('Recognized net force problem.', answerLines);
  result.diagramText = diagramText;
  result.formulaWork = buildNetForceFormulaWork({
    forces: resolvedForces,
    net,
    total,
    finalDirection,
    balanced,
    canceledAxes,
    axis,
    answerLines,
    diagramText,
    ctx
  });

  return result;
}

function tryGroupedEachPushNetForce(text, lower, ctx) {
  if (!/\bnet\s+force\b/.test(lower)) return null;
  if (!/\b(?:same\s+direction|one\s+direction)\b/.test(lower)) return null;
  if (!/\bopposite\s+direction\b/.test(lower)) return null;
  if (!/\beach\s+(?:push(?:es)?|pull(?:s)?|with)\b/.test(lower)) return null;

  const force = findEachForce(text, ctx);
  if (!force) return null;

  const sameDirectionCount = findSameDirectionGroupCount(lower);
  const oppositeDirectionCount = findOppositeDirectionGroupCount(lower);
  if (!sameDirectionCount || !oppositeDirectionCount) return null;

  const sameDirectionTotal = sameDirectionCount * force.value;
  const oppositeDirectionTotal = oppositeDirectionCount * force.value;
  const net = Math.abs(sameDirectionTotal - oppositeDirectionTotal);
  if (net === 0) {
    const answerLines = [
      `${sameDirectionCount} pushes one way: ${formatRepeatedForce(force.value, sameDirectionCount, ctx)} = ${ctx.cleanNumber(sameDirectionTotal)} N.`,
      `${oppositeDirectionCount} push opposite: ${formatRepeatedForce(force.value, oppositeDirectionCount, ctx)} = ${ctx.cleanNumber(oppositeDirectionTotal)} N.`,
      `Net force = ${ctx.cleanNumber(sameDirectionTotal)} N - ${ctx.cleanNumber(oppositeDirectionTotal)} N = 0 N.`,
      'The forces are balanced.'
    ];
    return ctx.answer(
      'Recognized grouped net force problem with equal pushes.',
      answerLines,
      buildGroupedNetForceFormulaWork({
        sameDirectionCount,
        oppositeDirectionCount,
        force,
        sameDirectionTotal,
        oppositeDirectionTotal,
        net,
        finalDirection: '',
        balanced: true,
        answerLines,
        ctx
      })
    );
  }

  const finalDirection = sameDirectionTotal > oppositeDirectionTotal
    ? `in the direction of the ${sameDirectionCount === 2 ? 'two students' : `${sameDirectionCount} same-direction pushes`}`
    : 'in the opposite direction';

  const answerLines = [
    `${capitalizeNumberWord(sameDirectionCount)} students push one way: ${formatRepeatedForce(force.value, sameDirectionCount, ctx)} = ${ctx.cleanNumber(sameDirectionTotal)} N.`,
    `${capitalizeNumberWord(oppositeDirectionCount)} student pushes opposite: ${formatGroupedForceTotal(force.value, oppositeDirectionCount, ctx)}.`,
    `Net force = ${ctx.cleanNumber(sameDirectionTotal)} N - ${ctx.cleanNumber(oppositeDirectionTotal)} N = ${ctx.cleanNumber(net)} N ${finalDirection}.`,
    `The net force is ${ctx.cleanNumber(net)} N ${finalDirection}.`
  ];
  return ctx.answer(
    'Recognized grouped net force problem with same-direction and opposite-direction pushes.',
    answerLines,
    buildGroupedNetForceFormulaWork({
      sameDirectionCount,
      oppositeDirectionCount,
      force,
      sameDirectionTotal,
      oppositeDirectionTotal,
      net,
      finalDirection,
      balanced: false,
      answerLines,
      ctx
    })
  );
}

function findEachForce(text, ctx) {
  const unitPattern = ctx.FORCE_UNITS
    .flatMap((def) => [...def.names, def.canonical])
    .map(ctx.escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join('|');
  const match = new RegExp(`\\beach\\s+(?:push(?:es)?|pull(?:s)?|with|using)?(?:\\s+with)?(?:\\s+a)?(?:\\s+force\\s+of)?\\s*(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, 'i').exec(text);
  if (!match) return null;
  return { value: Number(match[1]), unit: 'N' };
}

function findSameDirectionGroupCount(lower) {
  if (/\btwo\s+students?\b|\b2\s+students?\b/.test(lower)) return 2;
  if (/\bthree\s+students?\b|\b3\s+students?\b/.test(lower)) return 3;
  return null;
}

function findOppositeDirectionGroupCount(lower) {
  if (/\b(?:a\s+)?third\s+students?\b|\banother\s+students?\b|\bone\s+students?\b|\b1\s+students?\b/.test(lower)) return 1;
  if (/\btwo\s+students?\b|\b2\s+students?\b/.test(lower) && /\bopposite\s+direction\b/.test(lower)) return 2;
  return null;
}

function formatRepeatedForce(value, count, ctx) {
  return Array.from({ length: count }, () => `${ctx.cleanNumber(value)} N`).join(' + ');
}

function formatGroupedForceTotal(value, count, ctx) {
  const expression = formatRepeatedForce(value, count, ctx);
  if (count === 1) return expression;
  return `${expression} = ${ctx.cleanNumber(value * count)} N`;
}

function capitalizeNumberWord(value) {
  const words = {
    1: 'One',
    2: 'Two',
    3: 'Three'
  };
  return words[value] || String(value);
}

function buildGroupedNetForceFormulaWork({
  sameDirectionCount,
  oppositeDirectionCount,
  force,
  sameDirectionTotal,
  oppositeDirectionTotal,
  net,
  finalDirection,
  balanced,
  answerLines,
  ctx
}) {
  const forceDisplay = `${ctx.cleanNumber(force.value)} N`;
  const sameTotalDisplay = `${ctx.cleanNumber(sameDirectionTotal)} N`;
  const oppositeTotalDisplay = `${ctx.cleanNumber(oppositeDirectionTotal)} N`;
  const finalDisplay = balanced ? '0 N' : `${ctx.cleanNumber(net)} N ${finalDirection}`;
  const sameExpression = Array.from({ length: sameDirectionCount }, () => ctx.cleanNumber(force.value)).join(' + ');
  const netExpression = `${ctx.cleanNumber(sameDirectionTotal)} - ${ctx.cleanNumber(oppositeDirectionTotal)}`;

  return {
    formulaId: 'net_force',
    family: 'forces',
    solveFor: 'net force',
    formula: 'net force = same-direction forces - opposite-direction forces',
    finalAnswer: {
      value: net,
      unit: 'N',
      display: finalDisplay
    },
    variables: {
      sameDirectionPushes: {
        symbol: '',
        value: sameDirectionCount,
        unit: '',
        display: `${sameDirectionCount} same-direction pushes`
      },
      oppositeDirectionPushes: {
        symbol: '',
        value: oppositeDirectionCount,
        unit: '',
        display: `${oppositeDirectionCount} opposite-direction push${oppositeDirectionCount === 1 ? '' : 'es'}`
      },
      forcePerPush: {
        symbol: 'F',
        value: force.value,
        unit: 'N',
        display: forceDisplay
      },
      sameDirectionTotal: {
        symbol: '',
        value: sameDirectionTotal,
        unit: 'N',
        display: sameTotalDisplay
      },
      oppositeDirectionTotal: {
        symbol: '',
        value: oppositeDirectionTotal,
        unit: 'N',
        display: oppositeTotalDisplay
      },
      netForce: {
        symbol: 'Fnet',
        value: net,
        unit: 'N',
        display: finalDisplay
      }
    },
    finalExplanation: answerLines.join('\n'),
    steps: [
      {
        id: 'identify_same_direction_pushes',
        type: 'quantity',
        prompt: 'How many students push in the same direction?',
        expectedValue: sameDirectionCount,
        expectedUnit: '',
        expectedDisplay: String(sameDirectionCount),
        hints: ['Look for the group described as pushing in the same direction.']
      },
      {
        id: 'identify_opposite_direction_pushes',
        type: 'quantity',
        prompt: 'How many students push in the opposite direction?',
        expectedValue: oppositeDirectionCount,
        expectedUnit: '',
        expectedDisplay: String(oppositeDirectionCount),
        hints: ['Look for the group described as pushing in the opposite direction.']
      },
      {
        id: 'identify_force_per_push',
        type: 'quantity',
        prompt: 'How much force does each student push with?',
        expectedValue: force.value,
        expectedUnit: 'N',
        expectedDisplay: forceDisplay,
        hints: ['Look for the force amount after the word each.']
      },
      {
        id: 'choose_operation',
        type: 'multiple_choice',
        prompt: 'Should we add same-direction pushes and subtract opposite-direction pushes?',
        choices: [
          { number: 1, label: 'yes, add the same-direction pushes and subtract the opposite push', correct: true },
          { number: 2, label: 'no, use mass × acceleration', correct: false },
          { number: 3, label: 'no, ignore the opposite push', correct: false }
        ],
        expected: 'yes, add the same-direction pushes and subtract the opposite push',
        acceptedAnswers: ['yes', 'add then subtract', 'subtract opposite', 'same direction minus opposite direction'],
        hints: ['Forces in the same direction combine. Forces in the opposite direction work against that total.']
      },
      {
        id: 'calculate_same_direction_total',
        type: 'calculation',
        prompt: `What is the total force from the same-direction pushes? Use ${sameExpression}.`,
        substitution: `same-direction total = ${sameExpression}`,
        calculationExpression: sameExpression,
        expectedValue: sameDirectionTotal,
        expectedUnit: 'N',
        expectedDisplay: sameTotalDisplay,
        hints: ['Add the forces from the students pushing the same way.']
      },
      {
        id: 'calculate_net_force',
        type: 'calculation',
        prompt: `What is the net force? Use ${netExpression}.`,
        substitution: `net force = ${netExpression}`,
        calculationExpression: netExpression,
        expectedValue: net,
        expectedUnit: 'N',
        expectedDisplay: finalDisplay,
        hints: ['Subtract the opposite-direction total from the same-direction total.']
      }
    ]
  };
}

function looksLikeNetForceProblem(lower) {
  if (/\bnet\s+force\b/.test(lower)) return true;

  const forceCount = (lower.match(new RegExp(`(?:^|[^\\d.])${NUMBER_PATTERN}\\s*(?:n|newton|newtons)\\b`, 'g')) || []).length;
  const directionCount = (lower.match(new RegExp(`\\b(?:${DIRECTION_PATTERN_WORDS.join('|')}|opposite direction)\\b`, 'g')) || []).length;
  if (forceCount >= 2 && directionCount >= 2) return true;
  if (!/\b(?:push(?:es|ed|ing)?|pull(?:s|ed|ing)?|appl(?:y|ies|ied)|force|forces|newtons?)\b/.test(lower)) return false;

  return forceCount >= 2 && directionCount >= 1;
}

function findForces(text, ctx) {
  const unitPattern = ctx.FORCE_UNITS
    .flatMap((def) => [...def.names, def.canonical])
    .map(ctx.escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join('|');
  const regex = new RegExp(`(${NUMBER_PATTERN})\\s*(${unitPattern})\\b`, 'gi');
  const forces = [];

  for (const match of text.matchAll(regex)) {
    const start = match.index;
    const end = start + match[0].length;
    forces.push({
      value: Number(String(match[1]).replace(/,/g, '')),
      unit: 'N',
      text: match[0],
      start,
      end,
      explicitDirection: findExplicitDirection(text, start, end)
    });
  }

  return forces;
}

function findExplicitDirection(text, start, end) {
  const after = text
    .slice(end, Math.min(text.length, end + 55))
    .split(/[.!?]|\b(?:friction|frictional)\b/i)[0]
    .toLowerCase();
  const before = text.slice(Math.max(0, start - 45), start).toLowerCase();

  let match = new RegExp(`\\b(?:(?:push(?:es|ed|ing)?|pull(?:s|ed|ing)?|acting|acts|pointing|points)\\s+)?(?:to\\s+the\\s+|toward\\s+the\\s+|towards\\s+the\\s+|in\\s+the\\s+direction\\s+of\\s+)?(${DIRECTION_PATTERN_WORDS.join('|')})\\b`).exec(after);
  if (match) return normalizeDirectionWord(match[1]);

  match = new RegExp(`\\b(${DIRECTION_PATTERN_WORDS.join('|')})\\b(?:\\s+with)?\\s*$`).exec(before);
  if (match) return normalizeDirectionWord(match[1]);

  return null;
}

function normalizeDirectionWord(word) {
  const normalized = String(word || '').toLowerCase();
  return DIRECTION_ALIASES[normalized] || normalized;
}

function prepareDirections(text, lower, forces) {
  const resolvedForces = forces.map((force) => ({ ...force }));

  for (const force of resolvedForces) {
    if (force.explicitDirection) {
      force.directionName = force.explicitDirection;
      force.direction = DIRECTIONS[force.explicitDirection];
      force.directionLabel = displayDirectionWord(force.explicitDirection);
    }
  }

  for (let index = 0; index < resolvedForces.length; index += 1) {
    const force = resolvedForces[index];
    if (force.direction) continue;
    if (!hasOppositeDirectionCue(lower, force, index, resolvedForces)) continue;

    const previous = resolvedForces.slice(0, index).reverse().find((item) => item.direction);
    if (previous) {
      force.directionName = previous.direction.opposite;
      force.direction = DIRECTIONS[force.directionName];
      force.directionLabel = `opposite ${previous.directionLabel}`;
    }
  }

  const firstKnown = resolvedForces.find((force) => force.direction);
  const allHaveDirections = resolvedForces.every((force) => force.direction);
  if (!allHaveDirections && firstKnown) return null;

  if (!allHaveDirections) {
    const firstLabel = findFirstForceLabel(text, resolvedForces[0]) || 'the first force';
    resolvedForces[0].direction = { axis: 'relative', sign: 1, opposite: 'opposite direction' };
    resolvedForces[0].directionName = firstLabel;
    resolvedForces[0].directionLabel = `toward ${firstLabel}`;

    for (let index = 1; index < resolvedForces.length; index += 1) {
      const force = resolvedForces[index];
      if (!hasOppositeDirectionCue(lower, force, index, resolvedForces)) return null;
      force.direction = { axis: 'relative', sign: -1, opposite: resolvedForces[0].directionName };
      force.directionName = 'opposite direction';
      force.directionLabel = 'opposite direction';
    }
  }

  const axes = new Set(resolvedForces.map((force) => force.direction.axis));
  if (axes.size === 1) return { resolvedForces, axis: [...axes][0] };

  const totalsByAxis = [...axes].map((candidateAxis) => ({
    axis: candidateAxis,
    total: resolvedForces
      .filter((force) => force.direction.axis === candidateAxis)
      .reduce((sum, force) => sum + force.value * force.direction.sign, 0)
  }));
  const activeAxes = totalsByAxis.filter((item) => Math.abs(item.total) > 1e-9);
  const canceledAxes = totalsByAxis
    .filter((item) => Math.abs(item.total) <= 1e-9)
    .map((item) => item.axis);

  if (activeAxes.length === 1) {
    return { resolvedForces, axis: activeAxes[0].axis, canceledAxes };
  }
  if (activeAxes.length === 0) {
    return { resolvedForces, axis: totalsByAxis[0].axis, canceledAxes };
  }

  return null;
}

function hasOppositeDirectionCue(lower, force, index, forces) {
  const nextStart = forces[index + 1] ? forces[index + 1].start : lower.length;
  const segment = lower.slice(force.start, Math.min(lower.length, nextStart + 40));
  const before = lower.slice(Math.max(0, force.start - 60), force.start);

  return /\bopposite(?:\s+direction)?\b/.test(segment) ||
    /\bopposite(?:\s+direction)?\b/.test(before) ||
    /\banother\b[\s\S]{0,80}\bopposite(?:\s+direction)?\b/.test(segment);
}

function findFirstForceLabel(text, force) {
  const before = text.slice(0, force.start);
  const protectedBefore = before.replace(/\b(Mr|Mrs|Ms|Dr)\./g, '$1<dot>');
  const match = /(?:^|[.!?]\s*)([^.!?]{1,80}?)\s+(?:push(?:es|ed|ing)?|pull(?:s|ed|ing)?|appl(?:y|ies|ied)|exerts?)\s+(?:with\s+)?$/i.exec(protectedBefore);
  if (!match) return '';

  return match[1]
    .replace(/<dot>/g, '.')
    .replace(/\b(?:a|an|the)\b\s*/gi, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function directionForTotal(total, forces, axis) {
  const sign = total > 0 ? 1 : -1;
  const winner = forces
    .filter((force) => force.direction.axis === axis && force.direction.sign === sign)
    .sort((a, b) => b.value - a.value)[0];

  if (!winner) return null;
  return winner.directionLabel;
}

function buildNetForceLines({ forces, net, total, finalDirection, balanced, canceledAxes = [], axis, ctx }) {
  const cancellationLines = canceledAxes
    .map((axis) => cancellationLineForAxis(forces, axis, ctx))
    .filter(Boolean);
  const activeForces = axis ? forces.filter((force) => force.direction.axis === axis) : forces;

  if (balanced) {
    return [
      ...cancellationLines,
      ...(cancellationLines.length ? [] : [`${formatForce(forces[0], ctx)} and ${formatForce(forces[1], ctx)} cancel out.`]),
      'Net force = 0 N.',
      'The forces are balanced.'
    ];
  }

  const sameDirection = activeForces.every((force) => force.direction.sign === activeForces[0].direction.sign);
  const workLine = sameDirection
    ? `${activeForces.map((force) => formatForce(force, ctx)).join(' + ')} = ${ctx.cleanNumber(net)} N ${finalDirection}`
    : subtractionLine(activeForces, total, finalDirection, ctx);
  const subtotalLines = sameDirection ? [] : subtotalLinesForOpposingGroups(activeForces, ctx);

  return [
    ...cancellationLines,
    ...subtotalLines,
    workLine,
    `The net force is ${ctx.cleanNumber(net)} N ${finalDirection}.`,
    'The forces are unbalanced.'
  ];
}

function buildDiagramText({ forces, net, total, finalDirection, balanced, axis, ctx }) {
  const canceledAxes = [...new Set(forces.map((force) => force.direction.axis))]
    .filter((candidateAxis) => candidateAxis !== axis)
    .map((candidateAxis) => cancellationLineForAxis(forces, candidateAxis, ctx))
    .filter(Boolean);
  const activeForces = axis ? forces.filter((force) => force.direction.axis === axis) : forces;
  const sameDirection = activeForces.every((force) => force.direction.sign === activeForces[0].direction.sign);
  const forceLabels = activeForces.map((force) => formatForce(force, ctx));
  const status = balanced ? 'Balanced' : 'Unbalanced';
  const netLine = balanced
    ? 'Net force = 0 N'
    : `Net force = ${ctx.cleanNumber(net)} N ${finalDirection}`;

  if (sameDirection) {
    return [
      ...canceledAxes,
      `[box] ${arrowForForce(activeForces[0])} ${forceLabels.join(' + ')}`,
      netLine,
      status
    ].join('\n');
  }

  const negativeForces = activeForces.filter((force) => force.direction.sign < 0);
  const positiveForces = activeForces.filter((force) => force.direction.sign > 0);
  const leftSide = negativeForces.map((force) => formatForce(force, ctx)).join(' + ');
  const rightSide = positiveForces.map((force) => formatForce(force, ctx)).join(' + ');

  return [
    ...canceledAxes,
    `${leftSide} ← [box] → ${rightSide}`,
    netLine,
    status
  ].join('\n');
}

function arrowForSign(sign) {
  return sign < 0 ? '←' : '→';
}

function arrowForForce(force) {
  if (force?.direction?.axis === 'y') return force.direction.sign < 0 ? '↓' : '↑';
  return arrowForSign(force?.direction?.sign || 1);
}

function subtractionLine(forces, total, finalDirection, ctx) {
  const winningSign = total > 0 ? 1 : -1;
  const winningForces = forces.filter((force) => force.direction.sign === winningSign);
  const losingForces = forces.filter((force) => force.direction.sign !== winningSign);
  const winningTotal = winningForces.reduce((sum, force) => sum + force.value, 0);
  const losingTotal = losingForces.reduce((sum, force) => sum + force.value, 0);
  const winningLabel = winningForces.length === 1 ? formatForce(winningForces[0], ctx) : `${ctx.cleanNumber(winningTotal)} N ${finalDirection}`;
  const losingLabel = losingForces.length === 1 ? formatForce(losingForces[0], ctx) : `${ctx.cleanNumber(losingTotal)} N opposite direction`;

  return `${winningLabel} - ${losingLabel} = ${ctx.cleanNumber(Math.abs(total))} N ${finalDirection}`;
}

function subtotalLinesForOpposingGroups(forces, ctx) {
  const signs = [...new Set(forces.map((force) => force.direction.sign))];
  return signs
    .map((sign) => forces.filter((force) => force.direction.sign === sign))
    .filter((group) => group.length > 1)
    .map((group) => {
      const total = group.reduce((sum, force) => sum + force.value, 0);
      const directionLabel = group[0].directionLabel;
      return `${group.map((force) => formatForce(force, ctx)).join(' + ')} = ${ctx.cleanNumber(total)} N ${directionLabel}`;
    });
}

function formatForce(force, ctx) {
  return `${ctx.cleanNumber(force.value)} N ${force.directionLabel}`;
}

function buildNetForceFormulaWork({ forces, net, total, finalDirection, balanced, canceledAxes = [], axis, answerLines, diagramText, ctx }) {
  const activeForces = axis ? forces.filter((force) => force.direction.axis === axis) : forces;
  const forceList = forces.map((force) => formatForce(force, ctx));
  const forceAmountList = forces.map((force) => `${ctx.cleanNumber(force.value)} N`).join(' and ');
  const relation = activeForces.every((force) => force.direction.sign === activeForces[0].direction.sign)
    ? 'same direction'
    : 'opposite directions';
  const operation = relation === 'same direction' ? 'add' : 'subtract';
  const finalDisplay = balanced ? '0 N' : `${ctx.cleanNumber(net)} N ${finalDirection}`;
  const calculationExpression = buildNetForceCalculationExpression(activeForces, total, ctx);
  const safeGuidedNetForce = canceledAxes.length === 0 && activeForces.length >= 2;

  return {
    formulaId: 'net_force',
    family: 'forces',
    solveFor: 'net force',
    formula: 'net force = forces in one direction - forces in the opposite direction',
    finalAnswer: {
      value: net,
      unit: 'N',
      display: finalDisplay
    },
    variables: {
      forces: {
        symbol: '',
        value: forceList.length,
        unit: '',
        display: forceList.join(' and ')
      },
      relation: {
        symbol: '',
        value: relation,
        unit: '',
        display: relation
      },
      operation: {
        symbol: '',
        value: operation,
        unit: '',
        display: operation
      },
      netForce: {
        symbol: 'Fnet',
        value: net,
        unit: 'N',
        display: finalDisplay
      },
      balance: {
        symbol: '',
        value: balanced ? 'balanced' : 'unbalanced',
        unit: '',
        display: balanced ? 'balanced' : 'unbalanced'
      }
    },
    finalExplanation: answerLines.join('\n'),
    diagramText,
    steps: safeGuidedNetForce ? [
      {
        id: 'identify_forces',
        type: 'multiple_choice',
        prompt: 'Which force amounts are given?',
        choices: buildForceAmountChoices(forces, ctx),
        expected: forceAmountList,
        acceptedAnswers: [forceAmountList],
        hints: ['Look for each number measured in N or newtons.']
      },
      {
        id: 'identify_directions',
        type: 'multiple_choice',
        prompt: 'Which directions match the force amounts?',
        choices: buildDirectionMatchChoices(forces, ctx),
        expected: forceList.join(' and '),
        acceptedAnswers: [forceList.join(' and ')],
        hints: ['Match each force with its direction word, like left, right, east, or west.']
      },
      {
        id: 'compare_directions',
        type: 'multiple_choice',
        prompt: 'Are the forces in the same direction or opposite directions?',
        choices: [
          { number: 1, label: 'same direction', correct: relation === 'same direction' },
          { number: 2, label: 'opposite directions', correct: relation === 'opposite directions' }
        ],
        expected: relation,
        acceptedAnswers: relation === 'same direction' ? ['same', 'same direction'] : ['opposite', 'opposite directions'],
        hints: ['Compare the direction words for the forces.']
      },
      {
        id: 'choose_operation',
        type: 'multiple_choice',
        prompt: 'Should we add or subtract?',
        choices: [
          { number: 1, label: 'add', correct: operation === 'add' },
          { number: 2, label: 'subtract', correct: operation === 'subtract' }
        ],
        expected: operation,
        hints: [canceledAxes.length
          ? 'Cancel equal opposite forces first, then use the remaining force.'
          : operation === 'add'
            ? 'Forces in the same direction combine.'
            : 'Forces in opposite directions work against each other.']
      },
      {
        id: 'calculate_net_force',
        type: 'calculation',
        prompt: calculationExpression
          ? `What is the net force? Use ${calculationExpression}.`
          : 'What is the net force?',
        calculationExpression,
        expectedValue: net,
        expectedUnit: 'N',
        expectedDisplay: finalDisplay,
        hints: [operation === 'add' ? 'Add the force amounts.' : 'Subtract the smaller force from the larger force.']
      },
      {
        id: 'identify_balance',
        type: 'multiple_choice',
        prompt: 'Are the forces balanced or unbalanced?',
        choices: [
          { number: 1, label: 'balanced', correct: balanced },
          { number: 2, label: 'unbalanced', correct: !balanced }
        ],
        expected: balanced ? 'balanced' : 'unbalanced',
        hints: ['If the net force is 0 N, the forces are balanced. If it is not 0 N, they are unbalanced.']
      }
    ] : buildOpenEndedNetForceSteps({
      forceList,
      relation,
      operation,
      net,
      finalDisplay
    })
  };
}

function buildOpenEndedNetForceSteps({ forceList, relation, operation, net, finalDisplay }) {
  return [
    {
      id: 'identify_forces',
      type: 'text',
      prompt: 'What forces are given?',
      expected: forceList.join(' and '),
      acceptedAnswers: [
        forceList.join(' and '),
        forceList.join(', ')
      ],
      hints: ['Look for each number measured in N or newtons.']
    },
    {
      id: 'identify_directions',
      type: 'text',
      prompt: 'What direction is each force?',
      expected: forceList.join(' and '),
      acceptedAnswers: [
        forceList.join(' and '),
        forceList.map((force) => force.replace(/^\d+(?:\.\d+)?\s*N\s+/, '')).join(' and ')
      ],
      hints: ['Match each force with its direction word, like left, right, east, or west.']
    },
    {
      id: 'compare_directions',
      type: 'multiple_choice',
      prompt: 'Are the forces in the same direction or opposite directions?',
      choices: [
        { number: 1, label: 'same direction', correct: relation === 'same direction' },
        { number: 2, label: 'opposite directions', correct: relation === 'opposite directions' }
      ],
      expected: relation,
      acceptedAnswers: relation === 'same direction' ? ['same', 'same direction'] : ['opposite', 'opposite directions'],
      hints: ['Compare the direction words for the forces.']
    },
    {
      id: 'choose_operation',
      type: 'multiple_choice',
      prompt: 'Should we add or subtract?',
      choices: [
        { number: 1, label: 'add', correct: operation === 'add' },
        { number: 2, label: 'subtract', correct: operation === 'subtract' }
      ],
      expected: operation,
      hints: [operation === 'add'
        ? 'Forces in the same direction combine.'
        : 'Forces in opposite directions work against each other.']
    },
    {
      id: 'calculate_net_force',
      type: 'calculation',
      prompt: 'What is the net force?',
      expectedValue: net,
      expectedUnit: 'N',
      expectedDisplay: finalDisplay,
      hints: [operation === 'add' ? 'Add the force amounts.' : 'Subtract the smaller force from the larger force.']
    }
  ];
}

function buildForceAmountChoices(forces, ctx) {
  const correct = forces.map((force) => `${ctx.cleanNumber(force.value)} N`).join(' and ');
  const choices = [correct];
  if (forces.length > 1) {
    choices.push(forces.slice(0, -1).map((force) => `${ctx.cleanNumber(force.value)} N`).join(' and '));
    choices.push(forces.slice(1).map((force) => `${ctx.cleanNumber(force.value)} N`).join(' and '));
  }
  choices.push('not enough force amounts are given');
  return numberUniqueChoices(choices, correct);
}

function buildDirectionMatchChoices(forces, ctx) {
  const correct = forces.map((force) => formatForce(force, ctx)).join(' and ');
  const choices = [correct];
  const reversed = forces.map((force) => {
    const opposite = displayOppositeDirection(force);
    return `${ctx.cleanNumber(force.value)} N ${opposite || force.directionLabel}`;
  }).join(' and ');
  choices.push(reversed);

  if (forces.length > 1) {
    const firstDirection = forces[0].directionLabel;
    choices.push(forces.map((force) => `${ctx.cleanNumber(force.value)} N ${firstDirection}`).join(' and '));
  }

  choices.push('not enough direction information is given');
  return numberUniqueChoices(choices, correct);
}

function numberUniqueChoices(labels, correctLabel) {
  const seen = new Set();
  return labels
    .filter((label) => {
      const normalized = String(label || '').trim().toLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 4)
    .map((label, index) => ({
      number: index + 1,
      label,
      correct: label === correctLabel
    }));
}

function displayOppositeDirection(force) {
  const directionName = force?.directionName || '';
  const opposite = DIRECTIONS[directionName]?.opposite || force?.direction?.opposite || '';
  if (!opposite || opposite === directionName) return '';
  return displayDirectionWord(opposite);
}

function buildNetForceCalculationExpression(forces, total, ctx) {
  if (!Array.isArray(forces) || forces.length === 0) return '';
  const groups = [...new Set(forces.map((force) => force.direction.sign))]
    .map((sign) => ({
      sign,
      total: forces
        .filter((force) => force.direction.sign === sign)
        .reduce((sum, force) => sum + force.value, 0)
    }));

  if (groups.length === 1) {
    return forces.map((force) => ctx.cleanNumber(force.value)).join(' + ');
  }

  const winningSign = total > 0 ? 1 : total < 0 ? -1 : groups[0].sign;
  const winning = groups.find((group) => group.sign === winningSign) || groups[0];
  const losing = groups.find((group) => group.sign !== winning.sign);
  if (!losing) return ctx.cleanNumber(winning.total);
  return `${ctx.cleanNumber(winning.total)} - ${ctx.cleanNumber(losing.total)}`;
}

function cancellationLineForAxis(forces, axis, ctx) {
  const axisForces = forces.filter((force) => force.direction.axis === axis);
  if (axisForces.length < 2) return '';

  const positive = axisForces.filter((force) => force.direction.sign > 0);
  const negative = axisForces.filter((force) => force.direction.sign < 0);
  const positiveTotal = positive.reduce((sum, force) => sum + force.value, 0);
  const negativeTotal = negative.reduce((sum, force) => sum + force.value, 0);
  if (Math.abs(positiveTotal - negativeTotal) > 1e-9) return '';

  const positiveLabel = positive.map((force) => formatForce(force, ctx)).join(' + ');
  const negativeLabel = negative.map((force) => formatForce(force, ctx)).join(' + ');
  return `${positiveLabel} and ${negativeLabel} cancel out.`;
}

function displayDirectionWord(direction) {
  if (direction === 'up') return 'upward';
  if (direction === 'down') return 'downward';
  return direction;
}

module.exports = { tryNetForce };
