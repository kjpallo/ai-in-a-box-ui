const DIRECTION_AXIS = {
  east: 'east-west',
  west: 'east-west',
  north: 'north-south',
  south: 'north-south',
  left: 'left-right',
  right: 'left-right',
  up: 'up-down',
  down: 'up-down',
  forward: 'forward-backward',
  backward: 'forward-backward'
};

const POSITIVE_DIRECTIONS = {
  east: 'east',
  right: 'right',
  forward: 'forward'
};

const OPPOSITE_DIRECTIONS = {
  east: 'west',
  west: 'east',
  north: 'south',
  south: 'north',
  left: 'right',
  right: 'left',
  up: 'down',
  down: 'up',
  forward: 'backward',
  backward: 'forward'
};

const DIRECTION_ALIASES = {
  rght: 'right',
  rite: 'right'
};

const TWO_DIMENSION_SYSTEMS = [
  {
    horizontalAxis: 'east-west',
    verticalAxis: 'north-south',
    horizontalPositive: 'east',
    verticalPositive: 'north',
    directions: new Set(['east', 'west', 'north', 'south'])
  },
  {
    horizontalAxis: 'left-right',
    verticalAxis: 'up-down',
    horizontalPositive: 'right',
    verticalPositive: 'up',
    directions: new Set(['left', 'right', 'up', 'down'])
  }
];

function tryDisplacement(text, lower, ctx) {
  if (!asksForDisplacement(lower)) return null;

  const positionResult = tryPositionDisplacement(text, lower, ctx);
  if (positionResult) return positionResult;

  const movementResult = tryMovementDisplacement(text, lower, ctx);
  if (movementResult) return movementResult;

  if (hasAnyDirection(lower) && countDirectionAxes(lower) > 1) {
    return ctx.answer('Recognized 2D displacement question: asking for clarification.', [
      'This has directions on different axes, so it needs 2D displacement.',
      'Phase 6A only handles one-dimensional displacement. 2D displacement will be handled separately.'
    ]);
  }

  return ctx.answer('Recognized displacement question: missing needed values.', [
    'To find displacement, I need the starting position and ending position, or two same-axis moves with directions.',
    'Displacement = final position - initial position.'
  ]);
}

function tryPositionDisplacement(text, lower, ctx) {
  const start = findPositionValue(text, lower, ['starts at', 'start at', 'started at', 'initial position is', 'initial position']);
  const end = findPositionValue(text, lower, ['ends at', 'end at', 'ended at', 'final position is', 'final position']);

  if (!start && !end) return null;
  if (!start || !end) {
    const missing = start ? 'ending position' : 'starting position';
    return ctx.answer('Recognized displacement question: missing position value.', [
      `I need the ${missing} to find displacement.`,
      'Displacement = final position - initial position.'
    ]);
  }

  if (start.unit !== end.unit) {
    return ctx.answer('Recognized displacement question: units need clarification.', [
      `The starting position is in ${start.unit}, but the ending position is in ${end.unit}.`,
      'Please give both positions in the same unit for this one-dimensional displacement.'
    ]);
  }

  const value = end.value - start.value;
  return ctx.answer('Recognized displacement problem: solving from final and initial position.', [
    'displacement = final position - initial position',
    `displacement = ${ctx.cleanNumber(end.value)} ${end.unit} - ${ctx.cleanNumber(start.value)} ${start.unit}`,
    `displacement = ${ctx.cleanNumber(value)} ${end.unit}`
  ], buildPositionFormulaWork({ start, end, value, ctx }));
}

function tryMovementDisplacement(text, lower, ctx) {
  const moves = findDirectedMoves(text, ctx);
  if (moves.length === 0) return null;

  if (moves.length < 2) {
    return ctx.answer('Recognized displacement question: missing movement value.', [
      'I need two same-axis movements to find the net displacement.',
      'For example: 5 m east then 3 m west.'
    ]);
  }

  const twoDimensionalResult = tryTwoDimensionalMovementDisplacement(moves, ctx);
  if (twoDimensionalResult) return twoDimensionalResult;

  const firstAxis = DIRECTION_AXIS[moves[0].direction];
  if (moves.some((move) => DIRECTION_AXIS[move.direction] !== firstAxis)) {
    return ctx.answer('Recognized 2D displacement question: asking for clarification.', [
      'This mixes directions in a way I should not guess about yet.',
      'Please give either one-dimensional movement on one axis, or two perpendicular movements like east/north or right/up.'
    ]);
  }

  const unit = moves[0].unit;
  if (moves.some((move) => move.unit !== unit)) {
    return ctx.answer('Recognized displacement question: units need clarification.', [
      'The movement distances use different units.',
      'Please give the one-dimensional movements in the same unit.'
    ]);
  }

  const positiveDirection = POSITIVE_DIRECTIONS[moves[0].direction] || OPPOSITE_DIRECTIONS[moves[0].direction];
  const total = moves.reduce((sum, move) => {
    const sign = move.direction === positiveDirection ? 1 : -1;
    return sum + (move.value * sign);
  }, 0);
  const magnitude = Math.abs(total);
  const resultDirection = total >= 0 ? positiveDirection : OPPOSITE_DIRECTIONS[positiveDirection];
  const sameDirection = moves.every((move) => move.direction === moves[0].direction);
  const operator = sameDirection ? '+' : '-';
  const finalLine = magnitude === 0
    ? `displacement = 0 ${unit}, starting point / no net displacement`
    : `displacement = ${ctx.cleanNumber(magnitude)} ${unit} ${resultDirection}`;

  return ctx.answer('Recognized one-dimensional displacement problem: combining same-axis moves.', [
    'displacement = final position - initial position',
    `${ctx.cleanNumber(moves[0].value)} ${unit} ${moves[0].direction} ${operator} ${ctx.cleanNumber(moves[1].value)} ${unit} ${moves[1].direction} = ${formatMovementAnswer(magnitude, unit, resultDirection)}`,
    finalLine
  ], buildMovementFormulaWork({ moves, total, magnitude, unit, resultDirection, ctx }));
}

function tryTwoDimensionalMovementDisplacement(moves, ctx) {
  const system = findTwoDimensionalSystem(moves);
  if (!system) return null;

  const unit = moves[0].unit;
  if (moves.some((move) => move.unit !== unit)) {
    return ctx.answer('Recognized 2D displacement question: units need clarification.', [
      'The movement distances use different units.',
      'Please give the perpendicular movements in the same unit.'
    ]);
  }

  const horizontalTotal = signedAxisTotal(moves, system.horizontalAxis, system.horizontalPositive);
  const verticalTotal = signedAxisTotal(moves, system.verticalAxis, system.verticalPositive);
  const xMagnitude = Math.abs(horizontalTotal);
  const yMagnitude = Math.abs(verticalTotal);
  const xDirection = horizontalTotal >= 0 ? system.horizontalPositive : OPPOSITE_DIRECTIONS[system.horizontalPositive];
  const yDirection = verticalTotal >= 0 ? system.verticalPositive : OPPOSITE_DIRECTIONS[system.verticalPositive];
  const displacement = Math.sqrt((xMagnitude ** 2) + (yMagnitude ** 2));

  return ctx.answer('Recognized two-dimensional displacement problem: using the Pythagorean theorem.', [
    `x = ${ctx.cleanNumber(xMagnitude)} ${unit} ${xDirection}`,
    `y = ${ctx.cleanNumber(yMagnitude)} ${unit} ${yDirection}`,
    'd = √(x² + y²)',
    `d = √(${ctx.cleanNumber(xMagnitude)}² + ${ctx.cleanNumber(yMagnitude)}²)`,
    `d = ${ctx.cleanNumber(displacement)} ${unit}`,
    `The displacement is ${ctx.cleanNumber(displacement)} ${unit} from the starting point.`
  ], buildTwoDimensionalFormulaWork({
    displacement,
    horizontalTotal,
    verticalTotal,
    xMagnitude,
    yMagnitude,
    xDirection,
    yDirection,
    unit,
    moves,
    ctx
  }));
}

function findTwoDimensionalSystem(moves) {
  for (const system of TWO_DIMENSION_SYSTEMS) {
    if (!moves.every((move) => system.directions.has(move.direction))) continue;

    const axes = new Set(moves.map((move) => DIRECTION_AXIS[move.direction]));
    if (axes.size === 2 && axes.has(system.horizontalAxis) && axes.has(system.verticalAxis)) {
      return system;
    }
  }

  return null;
}

function signedAxisTotal(moves, axis, positiveDirection) {
  return moves
    .filter((move) => DIRECTION_AXIS[move.direction] === axis)
    .reduce((sum, move) => {
      const sign = move.direction === positiveDirection ? 1 : -1;
      return sum + (move.value * sign);
    }, 0);
}

function asksForDisplacement(lower) {
  return /\bdisplacement\b/.test(lower) ||
    /\bstraight[-\s]?line\s+distance\b.*\bfrom\s+(?:the\s+)?(?:start|starting\s+point)\b/.test(lower) ||
    /\bdistance\s+from\s+(?:the\s+)?(?:start|starting\s+point)\b/.test(lower) ||
    /\bhow\s+far\s+(?:is|are|was|were)\b.*\bfrom\s+(?:the\s+)?starting\s+point\b/.test(lower) ||
    /\bhow\s+far\s+(?:is|are|was|were)\b.*\bfrom\s+(?:where\s+)?(?:it|they|he|she|the\s+\w+)\s+started\b/.test(lower) ||
    /\bhow\s+far\s+away\s+from\s+(?:where\s+)?(?:it|they|he|she|the\s+\w+)\s+started\b/.test(lower);
}

function hasAnyDirection(lower) {
  return /\b(?:east|west|left|right|forward|backward|north|south|up|down)\b/.test(lower);
}

function countDirectionAxes(lower) {
  const axes = new Set();
  for (const direction of Object.keys(DIRECTION_AXIS)) {
    if (new RegExp(`\\b${direction}\\b`).test(lower)) axes.add(DIRECTION_AXIS[direction]);
  }
  return axes.size;
}

function findPositionValue(text, lower, phrases) {
  const unitPattern = '(m|meters|meter|km|kilometers|kilometer|cm|centimeters|centimeter|ft|feet|foot|miles|mile|mi)';
  for (const phrase of phrases) {
    const match = new RegExp(`\\b${phrase}\\s+(-?\\d+(?:\\.\\d+)?)\\s*${unitPattern}\\b`, 'i').exec(lower);
    if (match) {
      return {
        value: Number(match[1]),
        unit: canonicalDistanceUnit(match[2])
      };
    }
  }
  return null;
}

function findDirectedMoves(text, ctx) {
  const unitPattern = ctx.unitPatternFor(ctx.DISTANCE_UNITS);
  const directionPattern = 'east|west|left|right|rght|rite|forward|backward|north|south|up|down';
  const regex = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})${ctx.unitEndBoundary()}\\s+(${directionPattern})\\b`, 'gi');
  const moves = [];

  for (const match of text.matchAll(regex)) {
    const direction = normalizeDirectionWord(match[3]);
    moves.push({
      value: Number(match[1]),
      unit: canonicalDistanceUnit(match[2]),
      direction
    });
  }

  return moves;
}

function normalizeDirectionWord(word) {
  const normalized = String(word || '').toLowerCase();
  return DIRECTION_ALIASES[normalized] || normalized;
}

function canonicalDistanceUnit(rawUnit) {
  const normalized = String(rawUnit || '').toLowerCase();
  if (['meters', 'meter', 'm'].includes(normalized)) return 'm';
  if (['kilometers', 'kilometer', 'km'].includes(normalized)) return 'km';
  if (['centimeters', 'centimeter', 'cm'].includes(normalized)) return 'cm';
  if (['feet', 'foot', 'ft'].includes(normalized)) return 'ft';
  if (['miles', 'mile', 'mi'].includes(normalized)) return 'mile';
  return rawUnit;
}

function formatMovementAnswer(magnitude, unit, direction) {
  if (magnitude === 0) return `0 ${unit}`;
  return `${magnitude} ${unit} ${direction}`;
}

function buildPositionFormulaWork({ start, end, value, ctx }) {
  return {
    formulaId: 'one_dimensional_displacement',
    family: 'motion',
    solveFor: 'displacement',
    formula: 'displacement = final position - initial position',
    finalAnswer: {
      value,
      unit: end.unit,
      display: `${ctx.cleanNumber(value)} ${end.unit}`
    },
    variables: {
      initialPosition: { symbol: 'xi', value: start.value, unit: start.unit, display: `${ctx.cleanNumber(start.value)} ${start.unit}` },
      finalPosition: { symbol: 'xf', value: end.value, unit: end.unit, display: `${ctx.cleanNumber(end.value)} ${end.unit}` }
    },
    steps: []
  };
}

function buildMovementFormulaWork({ moves, total, magnitude, unit, resultDirection, ctx }) {
  return {
    formulaId: 'one_dimensional_displacement',
    family: 'motion',
    solveFor: 'displacement',
    formula: 'displacement = final position - initial position',
    finalAnswer: {
      value: total,
      unit,
      direction: magnitude === 0 ? null : resultDirection,
      display: magnitude === 0 ? `0 ${unit}` : `${ctx.cleanNumber(magnitude)} ${unit} ${resultDirection}`
    },
    variables: {
      movements: moves.map((move) => ({
        value: move.value,
        unit: move.unit,
        direction: move.direction,
        display: `${ctx.cleanNumber(move.value)} ${move.unit} ${move.direction}`
      }))
    },
    steps: []
  };
}

function buildTwoDimensionalFormulaWork({ displacement, horizontalTotal, verticalTotal, xMagnitude, yMagnitude, xDirection, yDirection, unit, moves, ctx }) {
  return {
    formulaId: 'two_dimensional_displacement',
    family: 'motion',
    solveFor: 'displacement',
    formula: 'd = √(x² + y²)',
    finalAnswer: {
      value: displacement,
      unit,
      display: `${ctx.cleanNumber(displacement)} ${unit}`
    },
    variables: {
      x: {
        value: horizontalTotal,
        unit,
        direction: xMagnitude === 0 ? null : xDirection,
        display: `${ctx.cleanNumber(xMagnitude)} ${unit} ${xDirection}`
      },
      y: {
        value: verticalTotal,
        unit,
        direction: yMagnitude === 0 ? null : yDirection,
        display: `${ctx.cleanNumber(yMagnitude)} ${unit} ${yDirection}`
      },
      movements: moves.map((move) => ({
        value: move.value,
        unit: move.unit,
        direction: move.direction,
        display: `${ctx.cleanNumber(move.value)} ${move.unit} ${move.direction}`
      }))
    },
    steps: [
      { label: 'Identify x movement', expression: `x = ${ctx.cleanNumber(xMagnitude)} ${unit} ${xDirection}` },
      { label: 'Identify y movement', expression: `y = ${ctx.cleanNumber(yMagnitude)} ${unit} ${yDirection}` },
      { label: 'Formula', expression: 'd = √(x² + y²)' },
      { label: 'Substitute', expression: `d = √(${ctx.cleanNumber(xMagnitude)}² + ${ctx.cleanNumber(yMagnitude)}²)` },
      { label: 'Solve', expression: `d = ${ctx.cleanNumber(displacement)} ${unit}` }
    ]
  };
}

module.exports = { tryDisplacement };
