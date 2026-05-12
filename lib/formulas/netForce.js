const DIRECTIONS = {
  right: { axis: 'x', sign: 1, opposite: 'left' },
  east: { axis: 'x', sign: 1, opposite: 'west' },
  left: { axis: 'x', sign: -1, opposite: 'right' },
  west: { axis: 'x', sign: -1, opposite: 'east' },
  up: { axis: 'y', sign: 1, opposite: 'down' },
  north: { axis: 'y', sign: 1, opposite: 'south' },
  down: { axis: 'y', sign: -1, opposite: 'up' },
  south: { axis: 'y', sign: -1, opposite: 'north' }
};

const DIRECTION_WORDS = Object.keys(DIRECTIONS);

function tryNetForce(text, lower, ctx) {
  if (!looksLikeNetForceProblem(lower)) return null;

  const forces = findForces(text, ctx);
  if (forces.length < 2) return null;

  const prepared = prepareDirections(text, lower, forces);
  if (!prepared) return null;

  const { resolvedForces, axis } = prepared;
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
    ctx
  });
  const diagramText = buildDiagramText({ forces: resolvedForces, net, total, finalDirection, balanced, ctx });
  const result = ctx.answer('Recognized net force problem.', answerLines);
  result.diagramText = diagramText;
  result.formulaWork = buildNetForceFormulaWork({
    forces: resolvedForces,
    net,
    finalDirection,
    balanced,
    answerLines,
    diagramText,
    ctx
  });

  return result;
}

function looksLikeNetForceProblem(lower) {
  if (/\bnet\s+force\b/.test(lower)) return true;
  if (!/\b(?:push(?:es|ed|ing)?|pull(?:s|ed|ing)?|appl(?:y|ies|ied)|force|forces|newtons?)\b/.test(lower)) return false;

  const forceCount = (lower.match(/\b\d+(?:\.\d+)?\s*(?:n|newton|newtons)\b/g) || []).length;
  const directionCount = (lower.match(new RegExp(`\\b(?:${DIRECTION_WORDS.join('|')}|opposite direction)\\b`, 'g')) || []).length;

  return forceCount >= 2 && directionCount >= 1;
}

function findForces(text, ctx) {
  const unitPattern = ctx.FORCE_UNITS
    .flatMap((def) => [...def.names, def.canonical])
    .map(ctx.escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join('|');
  const regex = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, 'gi');
  const forces = [];

  for (const match of text.matchAll(regex)) {
    const start = match.index;
    const end = start + match[0].length;
    forces.push({
      value: Number(match[1]),
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
  const after = text.slice(end, Math.min(text.length, end + 55)).toLowerCase();
  const before = text.slice(Math.max(0, start - 45), start).toLowerCase();

  let match = new RegExp(`\\b(?:to\\s+the\\s+|toward\\s+the\\s+|towards\\s+the\\s+|in\\s+the\\s+direction\\s+of\\s+)?(${DIRECTION_WORDS.join('|')})\\b`).exec(after);
  if (match) return match[1];

  match = new RegExp(`\\b(${DIRECTION_WORDS.join('|')})\\b(?:\\s+with)?\\s*$`).exec(before);
  if (match) return match[1];

  return null;
}

function prepareDirections(text, lower, forces) {
  const resolvedForces = forces.map((force) => ({ ...force }));

  for (const force of resolvedForces) {
    if (force.explicitDirection) {
      force.directionName = force.explicitDirection;
      force.direction = DIRECTIONS[force.explicitDirection];
      force.directionLabel = force.explicitDirection;
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
  if (axes.size !== 1) return null;

  return { resolvedForces, axis: [...axes][0] };
}

function hasOppositeDirectionCue(lower, force, index, forces) {
  const nextStart = forces[index + 1] ? forces[index + 1].start : lower.length;
  const segment = lower.slice(force.start, Math.min(lower.length, nextStart + 40));
  const before = lower.slice(Math.max(0, force.start - 60), force.start);

  return /\bopposite\s+direction\b/.test(segment) ||
    /\bopposite\s+direction\b/.test(before) ||
    /\banother\b[\s\S]{0,80}\bopposite\s+direction\b/.test(segment);
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

function buildNetForceLines({ forces, net, total, finalDirection, balanced, ctx }) {
  if (balanced) {
    return [
      `${formatForce(forces[0], ctx)} and ${formatForce(forces[1], ctx)} cancel out.`,
      'Net force = 0 N.',
      'The forces are balanced.'
    ];
  }

  const sameDirection = forces.every((force) => force.direction.sign === forces[0].direction.sign);
  const workLine = sameDirection
    ? `${forces.map((force) => formatForce(force, ctx)).join(' + ')} = ${ctx.cleanNumber(net)} N ${finalDirection}`
    : subtractionLine(forces, total, finalDirection, ctx);

  return [
    workLine,
    `The net force is ${ctx.cleanNumber(net)} N ${finalDirection}.`,
    'The forces are unbalanced.'
  ];
}

function buildDiagramText({ forces, net, total, finalDirection, balanced, ctx }) {
  const sameDirection = forces.every((force) => force.direction.sign === forces[0].direction.sign);
  const forceLabels = forces.map((force) => formatForce(force, ctx));
  const status = balanced ? 'Balanced' : 'Unbalanced';
  const netLine = balanced
    ? 'Net force = 0 N'
    : `Net force = ${ctx.cleanNumber(net)} N ${finalDirection}`;

  if (sameDirection) {
    return [
      `[box] ${arrowForSign(forces[0].direction.sign)} ${forceLabels.join(' + ')}`,
      netLine,
      status
    ].join('\n');
  }

  const negativeForces = forces.filter((force) => force.direction.sign < 0);
  const positiveForces = forces.filter((force) => force.direction.sign > 0);
  const leftSide = negativeForces.map((force) => formatForce(force, ctx)).join(' + ');
  const rightSide = positiveForces.map((force) => formatForce(force, ctx)).join(' + ');

  return [
    `${leftSide} ← [box] → ${rightSide}`,
    netLine,
    status
  ].join('\n');
}

function arrowForSign(sign) {
  return sign < 0 ? '←' : '→';
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

function formatForce(force, ctx) {
  return `${ctx.cleanNumber(force.value)} N ${force.directionLabel}`;
}

function buildNetForceFormulaWork({ forces, net, finalDirection, balanced, answerLines, diagramText, ctx }) {
  const forceList = forces.map((force) => formatForce(force, ctx));
  const relation = forces.every((force) => force.direction.sign === forces[0].direction.sign)
    ? 'same direction'
    : 'opposite directions';
  const operation = relation === 'same direction' ? 'add' : 'subtract';
  const finalDisplay = balanced ? '0 N' : `${ctx.cleanNumber(net)} N ${finalDirection}`;

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
    steps: [
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
        hints: [operation === 'add' ? 'Forces in the same direction combine.' : 'Forces in opposite directions work against each other.']
      },
      {
        id: 'calculate_net_force',
        type: 'calculation',
        prompt: 'What is the net force?',
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
    ]
  };
}

module.exports = { tryNetForce };
