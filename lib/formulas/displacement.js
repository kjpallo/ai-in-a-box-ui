const DIRECTION_AXIS = {
  east: 'east-west',
  west: 'east-west',
  left: 'left-right',
  right: 'left-right',
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
  left: 'right',
  right: 'left',
  forward: 'backward',
  backward: 'forward'
};

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

  const firstAxis = DIRECTION_AXIS[moves[0].direction];
  if (moves.some((move) => DIRECTION_AXIS[move.direction] !== firstAxis)) {
    return ctx.answer('Recognized 2D displacement question: asking for clarification.', [
      'This has perpendicular or different-axis directions, so it needs 2D displacement.',
      'Phase 6A only handles one-dimensional displacement. 2D displacement will be handled separately.'
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

function asksForDisplacement(lower) {
  return /\bdisplacement\b/.test(lower);
}

function hasAnyDirection(lower) {
  return /\b(?:east|west|left|right|forward|backward|north|south)\b/.test(lower);
}

function countDirectionAxes(lower) {
  const axes = new Set();
  for (const direction of Object.keys(DIRECTION_AXIS)) {
    if (new RegExp(`\\b${direction}\\b`).test(lower)) axes.add(DIRECTION_AXIS[direction]);
  }
  if (/\b(?:north|south)\b/.test(lower)) axes.add('north-south');
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
  const directionPattern = 'east|west|left|right|forward|backward|north|south';
  const regex = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*(${unitPattern})${ctx.unitEndBoundary()}\\s+(${directionPattern})\\b`, 'gi');
  const moves = [];

  for (const match of text.matchAll(regex)) {
    moves.push({
      value: Number(match[1]),
      unit: canonicalDistanceUnit(match[2]),
      direction: match[3].toLowerCase()
    });
  }

  return moves;
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

module.exports = { tryDisplacement };
