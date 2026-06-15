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
  back: 'backward',
  backwards: 'backward',
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
  const intent = getDistanceDisplacementIntent(lower);
  if (!intent.any) return null;

  const spinningResult = trySpinningInPlaceDistanceDisplacement(lower, ctx);
  if (spinningResult) return spinningResult;

  const poolResult = tryPoolLengthDistanceDisplacement(text, lower, ctx);
  if (poolResult) return poolResult;

  const closedLoopResult = tryClosedLoopDistanceDisplacement(text, lower, ctx);
  if (closedLoopResult) return closedLoopResult;

  const positionResult = tryPositionDisplacement(text, lower, ctx);
  if (positionResult) return positionResult;

  const movementResult = tryMovementDisplacement(text, lower, ctx, intent);
  if (movementResult) return movementResult;

  if (intent.distance && !intent.displacement) return null;

  return ctx.answer('Recognized displacement question: missing needed values.', [
    intent.distance && !intent.displacement
      ? 'To find distance traveled, I need the path lengths.'
      : 'To find displacement, I need the starting position and ending position, or movements with directions.',
    intent.distance && !intent.displacement
      ? 'Distance adds the path.'
      : 'Displacement is start-to-finish.'
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

function tryMovementDisplacement(text, lower, ctx, intent = getDistanceDisplacementIntent(lower)) {
  const moves = findDirectedMoves(text, ctx);
  if (moves.length === 0) return null;

  const unit = moves[0].unit;
  if (moves.some((move) => move.unit !== unit)) {
    return ctx.answer('Recognized displacement question: units need clarification.', [
      'The movement distances use different units.',
      'Please give the movements in the same unit.'
    ]);
  }

  const twoDimensionalResult = tryTwoDimensionalMovementDisplacement(moves, ctx, intent);
  if (twoDimensionalResult) return twoDimensionalResult;

  const firstAxis = DIRECTION_AXIS[moves[0].direction];
  if (moves.some((move) => DIRECTION_AXIS[move.direction] !== firstAxis)) {
    return ctx.answer('Recognized displacement question: mixed direction systems.', [
      'This mixes direction words from different systems.',
      'Use one direction system, like north/south/east/west or left/right/up/down.'
    ]);
  }

  const positiveDirection = POSITIVE_DIRECTIONS[moves[0].direction] || OPPOSITE_DIRECTIONS[moves[0].direction];
  const distance = moves.reduce((sum, move) => sum + move.value, 0);
  const total = moves.reduce((sum, move) => {
    const sign = move.direction === positiveDirection ? 1 : -1;
    return sum + (move.value * sign);
  }, 0);
  const magnitude = Math.abs(total);
  const resultDirection = total >= 0 ? positiveDirection : OPPOSITE_DIRECTIONS[positiveDirection];
  const displayUnit = displayDistanceUnit(unit);
  const distanceLine = `distance = ${formatPathSum(moves, ctx)} = ${formatDistanceValue(distance, unit, ctx)}`;
  const displacementExpression = formatOneDimensionalDisplacementExpression(moves, positiveDirection, magnitude, resultDirection, unit, ctx);
  const finalLine = magnitude === 0
    ? `displacement = 0 ${displayUnit}, starting point / no net displacement`
    : `displacement = ${ctx.cleanNumber(magnitude)} ${displayUnit} ${resultDirection}`;

  if (intent.distance && !intent.displacement) {
    return ctx.answer('Recognized path distance problem: adding directed movement.', [
      'Distance adds the path.',
      distanceLine,
      `distance = ${formatDistanceValue(distance, unit, ctx)}`
    ], buildMovementFormulaWork({ moves, total, magnitude, distance, unit, resultDirection, ctx }));
  }

  if (intent.distance && intent.displacement) {
    return ctx.answer('Recognized distance and displacement problem: combining path and start-to-finish change.', [
      'Distance adds the path.',
      distanceLine,
      'Displacement is start-to-finish.',
      displacementExpression,
      finalLine,
      `Answer: distance = ${formatDistanceValue(distance, unit, ctx)}; displacement = ${formatDisplacementValue(magnitude, unit, resultDirection, ctx)}`
    ], buildMovementFormulaWork({ moves, total, magnitude, distance, unit, resultDirection, ctx }));
  }

  return ctx.answer('Recognized one-dimensional displacement problem: combining same-axis moves.', [
    'displacement = final position - initial position',
    displacementExpression,
    finalLine
  ], buildMovementFormulaWork({ moves, total, magnitude, distance, unit, resultDirection, ctx }));
}

function tryTwoDimensionalMovementDisplacement(moves, ctx, intent = {}) {
  const system = findTwoDimensionalSystem(moves);
  if (!system) return null;

  const unit = moves[0].unit;
  const distance = moves.reduce((sum, move) => sum + move.value, 0);
  const horizontalTotal = signedAxisTotal(moves, system.horizontalAxis, system.horizontalPositive);
  const verticalTotal = signedAxisTotal(moves, system.verticalAxis, system.verticalPositive);
  const xMagnitude = Math.abs(horizontalTotal);
  const yMagnitude = Math.abs(verticalTotal);
  const xDirection = horizontalTotal >= 0 ? system.horizontalPositive : OPPOSITE_DIRECTIONS[system.horizontalPositive];
  const yDirection = verticalTotal >= 0 ? system.verticalPositive : OPPOSITE_DIRECTIONS[system.verticalPositive];
  const displacement = Math.sqrt((xMagnitude ** 2) + (yMagnitude ** 2));
  const compassDirection = formatResultDirection({ xMagnitude, yMagnitude, xDirection, yDirection });
  const displacementDisplay = formatDisplacementValue(displacement, unit, compassDirection, ctx);
  const distanceDisplay = formatDistanceValue(distance, unit, ctx);
  const lines = [];

  if (intent.distance) {
    lines.push('Distance adds the path.');
    lines.push(`distance = ${formatPathSum(moves, ctx)} = ${distanceDisplay}`);
  }

  lines.push('Displacement is start-to-finish.');
  lines.push(`x = ${formatDistanceValue(xMagnitude, unit, ctx)} ${xDirection}`);
  lines.push(`y = ${formatDistanceValue(yMagnitude, unit, ctx)} ${yDirection}`);
  lines.push('d = √(x² + y²)');
  lines.push(`d = √(${ctx.cleanNumber(xMagnitude)}² + ${ctx.cleanNumber(yMagnitude)}²)`);
  lines.push(`d = ${formatDistanceValue(displacement, unit, ctx)}`);
  lines.push(`displacement = ${displacementDisplay}`);

  if (intent.distance) {
    lines.push(`Answer: distance = ${distanceDisplay}; displacement = ${displacementDisplay}`);
  } else {
    lines.push(`The displacement is ${displacementDisplay} from the starting point.`);
    if (compassDirection) lines.push(`The displacement is ${formatApproxNumber(displacement)} ${displayDistanceUnit(unit)} from the starting point.`);
  }

  return ctx.answer('Recognized two-dimensional displacement problem: using the Pythagorean theorem.', [
    ...lines
  ], buildTwoDimensionalFormulaWork({
    displacement,
    distance,
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

function getDistanceDisplacementIntent(lower) {
  const distanceAndDisplacement = asksForDistanceAndDisplacement(lower);
  const displacement = distanceAndDisplacement || asksForDisplacement(lower);
  const distance = distanceAndDisplacement || asksForPathDistance(lower);
  return {
    any: displacement || distance || looksLikeSpecialDistanceDisplacementCase(lower),
    distance,
    displacement
  };
}

function asksForDistanceAndDisplacement(lower) {
  return /\bdistance\b.{0,40}\bdisplacement\b/.test(lower) ||
    /\bdisplacement\b.{0,40}\bdistance\b/.test(lower);
}

function asksForPathDistance(lower) {
  if (/\bdistance\s+from\s+(?:the\s+)?(?:start|starting\s+point)\b/.test(lower)) return false;
  return /\bdistance\s+traveled\b/.test(lower) ||
    /\btotal\s+distance\b/.test(lower) ||
    /\bpath\s+length\b/.test(lower) ||
    /\bhow\s+far\s+(?:did|does|do|has|have|will)\b/.test(lower) ||
    /\bwhat\s+is\s+(?:the\s+)?distance\b/.test(lower) ||
    /\bfind\s+(?:the\s+)?distance\b/.test(lower);
}

function looksLikeSpecialDistanceDisplacementCase(lower) {
  return looksLikeSpinningInPlace(lower) ||
    looksLikePoolLengthCase(lower) ||
    looksLikeClosedLoopCase(lower);
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
  const directionPattern = 'back\\s+(?:east|west|left|right|north|south|up|down)|east|west|left|right|rght|rite|forward|backwards|backward|back|north|south|up|down';
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
  const normalized = String(word || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const backToward = /^back\s+(east|west|left|right|north|south|up|down)$/.exec(normalized);
  if (backToward) return backToward[1];
  return DIRECTION_ALIASES[normalized] || normalized;
}

function canonicalDistanceUnit(rawUnit) {
  const normalized = String(rawUnit || '').toLowerCase();
  if (['meters', 'meter', 'm'].includes(normalized)) return 'm';
  if (['kilometers', 'kilometer', 'km'].includes(normalized)) return 'km';
  if (['centimeters', 'centimeter', 'cm'].includes(normalized)) return 'cm';
  if (['feet', 'foot', 'ft'].includes(normalized)) return 'ft';
  if (['miles', 'mile', 'mi'].includes(normalized)) return 'mile';
  if (['blocks', 'block'].includes(normalized)) return 'block';
  return rawUnit;
}

function trySpinningInPlaceDistanceDisplacement(lower, ctx) {
  if (!looksLikeSpinningInPlace(lower)) return null;
  return ctx.answer('Recognized spinning-in-place distance and displacement problem.', [
    'Distance adds the path.',
    'distance = 0',
    'Displacement is start-to-finish.',
    'displacement = 0',
    'Answer: distance = 0; displacement = 0'
  ], buildSpecialDistanceDisplacementFormulaWork({
    formulaId: 'distance_displacement_special_case',
    solveFor: 'distance and displacement',
    distanceDisplay: '0',
    displacementDisplay: '0'
  }));
}

function tryPoolLengthDistanceDisplacement(text, lower, ctx) {
  if (!looksLikePoolLengthCase(lower)) return null;
  const length = ctx.findNumberWithUnit(text, ctx.DISTANCE_UNITS);
  const timesMatch = /\b(\d+(?:\.\d+)?)\s+times?\b/i.exec(text);
  if (!length || !timesMatch) return null;

  const times = Number(timesMatch[1]);
  if (!Number.isFinite(times) || times <= 0) return null;

  const distance = length.value * times;
  const displacement = Math.round(times) % 2 === 0 ? 0 : length.value;
  const distanceDisplay = formatDistanceValue(distance, length.unit, ctx);
  const displacementDisplay = displacement === 0
    ? `0 ${displayDistanceUnit(length.unit)}`
    : `${formatApproxNumber(displacement)} ${displayDistanceUnit(length.unit)} away from the side started on`;

  return ctx.answer('Recognized pool-length distance and displacement problem.', [
    'Distance adds the path.',
    `distance = ${ctx.cleanNumber(length.value)} ${displayDistanceUnit(length.unit)} × ${ctx.cleanNumber(times)} = ${distanceDisplay}`,
    'Displacement is start-to-finish.',
    `displacement = ${displacementDisplay}`,
    `Answer: distance = ${distanceDisplay}; displacement = ${displacementDisplay}`
  ], buildSpecialDistanceDisplacementFormulaWork({
    formulaId: 'distance_displacement_pool_lengths',
    solveFor: 'distance and displacement',
    distanceDisplay,
    displacementDisplay
  }));
}

function tryClosedLoopDistanceDisplacement(text, lower, ctx) {
  if (!looksLikeClosedLoopCase(lower)) return null;
  const distance = ctx.findNumberWithUnit(text, ctx.DISTANCE_UNITS);
  if (!distance) return null;

  const distanceDisplay = formatDistanceValue(distance.value, distance.unit, ctx);
  const displacementDisplay = `0 ${displayDistanceUnit(distance.unit)}`;

  return ctx.answer('Recognized closed-loop distance and displacement problem.', [
    'Distance adds the path.',
    `distance = ${distanceDisplay}`,
    'Displacement is start-to-finish.',
    `displacement = ${displacementDisplay}`,
    `Answer: distance = ${distanceDisplay}; displacement = ${displacementDisplay}`
  ], buildSpecialDistanceDisplacementFormulaWork({
    formulaId: 'distance_displacement_closed_loop',
    solveFor: 'distance and displacement',
    distanceDisplay,
    displacementDisplay
  }));
}

function looksLikeSpinningInPlace(lower) {
  return /\b(?:spin|spins|spinning|turns?|twirls?)\b/.test(lower) &&
    (/\bin\s+place\b/.test(lower) || /\bwhere\s+(?:he|she|they|it|mali)\s+(?:started|was\s+standing|stood|is\s+standing)\b/.test(lower));
}

function looksLikePoolLengthCase(lower) {
  return /\b(?:swim|swims|swam|swimming)\b/.test(lower) &&
    /\bpool\b/.test(lower) &&
    /\blength\b/.test(lower) &&
    /\btimes?\b/.test(lower);
}

function looksLikeClosedLoopCase(lower) {
  return /\baround\s+(?:the\s+)?block\b/.test(lower) &&
    /\b(?:back|returns?|returned|ends?|ended)\b/.test(lower) &&
    /\b(?:home|start|starting|started|doorstep|where\s+(?:he|she|they|it)\s+started)\b/.test(lower);
}

function formatOneDimensionalDisplacementExpression(moves, positiveDirection, magnitude, resultDirection, unit, ctx) {
  const expression = moves.map((move, index) => {
    const operator = move.direction === moves[0].direction ? '+' : '-';
    const term = `${ctx.cleanNumber(move.value)} ${displayDistanceUnit(unit)} ${move.direction}`;
    return index === 0 ? term : `${operator} ${term}`;
  }).join(' ');
  return `${expression} = ${formatDisplacementValue(magnitude, unit, resultDirection, ctx)}`;
}

function formatPathSum(moves, ctx) {
  if (moves.length === 0) return '';
  const unit = moves[0].unit;
  return moves
    .map((move) => `${ctx.cleanNumber(move.value)} ${pluralDisplayUnit(displayDistanceUnit(unit), move.value)}`)
    .join(' + ');
}

function formatDistanceValue(value, unit, ctx) {
  const displayUnit = displayDistanceUnit(unit);
  return `${ctx.cleanNumber(value)} ${pluralDisplayUnit(displayUnit, value)}`;
}

function formatDisplacementValue(value, unit, direction, ctx) {
  const displayUnit = displayDistanceUnit(unit);
  if (!Number.isFinite(value) || value === 0 || !direction) return `0 ${displayUnit}`;
  const prefix = Number.isInteger(value) ? '' : 'about ';
  return `${prefix}${formatApproxNumber(value)} ${pluralDisplayUnit(displayUnit, value)} ${direction}`;
}

function formatApproxNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  const decimals = Math.abs(value) >= 10 ? 1 : 2;
  return String(Number(value.toFixed(decimals))).replace(/\.0+$/, '');
}

function displayDistanceUnit(unit) {
  if (unit === 'mile') return 'mi';
  return unit;
}

function pluralDisplayUnit(unit, value) {
  if (unit === 'block' && Math.abs(value) !== 1) return 'blocks';
  return unit;
}

function formatResultDirection({ xMagnitude, yMagnitude, xDirection, yDirection }) {
  if (xMagnitude === 0 && yMagnitude === 0) return '';
  if (xMagnitude === 0) return yDirection;
  if (yMagnitude === 0) return xDirection;
  return `${yDirection[0]}${xDirection[0]}`.toUpperCase();
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

function buildMovementFormulaWork({ moves, total, magnitude, distance, unit, resultDirection, ctx }) {
  return {
    formulaId: 'distance_displacement',
    family: 'motion',
    solveFor: 'distance and displacement',
    formula: 'distance = total path; displacement = final position - initial position',
    finalAnswer: {
      value: total,
      unit,
      direction: magnitude === 0 ? null : resultDirection,
      display: magnitude === 0 ? `0 ${displayDistanceUnit(unit)}` : `${ctx.cleanNumber(magnitude)} ${displayDistanceUnit(unit)} ${resultDirection}`
    },
    variables: {
      distance: {
        value: Number.isFinite(distance) ? distance : moves.reduce((sum, move) => sum + move.value, 0),
        unit,
        display: formatDistanceValue(Number.isFinite(distance) ? distance : moves.reduce((sum, move) => sum + move.value, 0), unit, ctx)
      },
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

function buildTwoDimensionalFormulaWork({ displacement, distance, horizontalTotal, verticalTotal, xMagnitude, yMagnitude, xDirection, yDirection, unit, moves, ctx }) {
  const compassDirection = formatResultDirection({ xMagnitude, yMagnitude, xDirection, yDirection });
  return {
    formulaId: 'distance_displacement_2d',
    family: 'motion',
    solveFor: 'distance and displacement',
    formula: 'distance = total path; displacement = √(x² + y²)',
    finalAnswer: {
      value: displacement,
      unit,
      direction: compassDirection || null,
      display: formatDisplacementValue(displacement, unit, compassDirection, ctx)
    },
    variables: {
      distance: {
        value: distance,
        unit,
        display: formatDistanceValue(distance, unit, ctx)
      },
      x: {
        value: horizontalTotal,
        unit,
        direction: xMagnitude === 0 ? null : xDirection,
        display: `${formatDistanceValue(xMagnitude, unit, ctx)} ${xDirection}`
      },
      y: {
        value: verticalTotal,
        unit,
        direction: yMagnitude === 0 ? null : yDirection,
        display: `${formatDistanceValue(yMagnitude, unit, ctx)} ${yDirection}`
      },
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

function buildSpecialDistanceDisplacementFormulaWork({ formulaId, solveFor, distanceDisplay, displacementDisplay }) {
  return {
    formulaId,
    family: 'motion',
    solveFor,
    formula: 'distance = total path; displacement = final position - initial position',
    finalAnswer: {
      display: `distance = ${distanceDisplay}; displacement = ${displacementDisplay}`
    },
    variables: {},
    steps: []
  };
}

module.exports = { tryDisplacement };
