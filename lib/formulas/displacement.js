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
  const distanceLine = `distance = ${formatPathSum(moves, ctx, { omitUnits: moves.some((move) => move.inferredDirection) })} = ${formatDistanceValue(distance, unit, ctx)}`;
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
  const displacementRadicand = (xMagnitude ** 2) + (yMagnitude ** 2);
  const compassDirection = formatResultDirection({ xMagnitude, yMagnitude, xDirection, yDirection });
  const directionDetail = formatDirectionDetail({ xMagnitude, yMagnitude, xDirection, yDirection, compassDirection });
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
  if (Number.isFinite(displacementRadicand)) {
    lines.push(`displacement = √${ctx.cleanNumber(displacementRadicand)} ${pluralDisplayUnit(displayDistanceUnit(unit), displacementRadicand)}`);
  }
  lines.push(`d = ${formatApproxDistanceValue(displacement, unit)}`);
  if (directionDetail) lines.push(`direction = ${directionDetail}`);
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
  const numberPattern = '-?\\d+(?:\\.\\d+)?';
  const numberThenDirectionRegex = new RegExp(`(${numberPattern})\\s*(${unitPattern})${ctx.unitEndBoundary()}\\s+(${directionPattern})\\b`, 'gi');
  const movementVerbPattern = '(?:heads?|go(?:es)?|went|walks?|runs?|drives?|travels?|moves?|rides?|continues?|proceeds?)';
  const directionThenNumberRegex = new RegExp(`\\b(?:${movementVerbPattern}\\s+)?(${directionPattern})\\s+(?:for\\s+)?(${numberPattern})\\s*(${unitPattern})${ctx.unitEndBoundary()}`, 'gi');
  const bareDistanceRegex = new RegExp(`(${numberPattern})\\s*(${unitPattern})${ctx.unitEndBoundary()}`, 'gi');
  const moves = [];

  for (const match of text.matchAll(numberThenDirectionRegex)) {
    const direction = normalizeDirectionWord(match[3]);
    addDirectedMove(moves, {
      value: Number(match[1]),
      unit: canonicalDistanceUnit(match[2]),
      direction,
      start: match.index,
      end: match.index + match[0].length
    });
  }

  for (const match of text.matchAll(directionThenNumberRegex)) {
    const direction = normalizeDirectionWord(match[1]);
    addDirectedMove(moves, {
      value: Number(match[2]),
      unit: canonicalDistanceUnit(match[3]),
      direction,
      start: match.index,
      end: match.index + match[0].length
    });
  }

  for (const match of text.matchAll(bareDistanceRegex)) {
    const start = match.index;
    const end = match.index + match[0].length;
    const overlapsExistingMove = moves.some((move) => start < move.end && end > move.start);
    if (overlapsExistingMove) continue;

    const previousMove = findPreviousDirectedMove(moves, start);
    if (!previousMove || !OPPOSITE_DIRECTIONS[previousMove.direction]) continue;

    const bridgeText = text.slice(Math.max(previousMove.end, start - 160), start);
    if (!hasReturnTripCue(bridgeText)) continue;

    addDirectedMove(moves, {
      value: Number(match[1]),
      unit: canonicalDistanceUnit(match[2]),
      direction: OPPOSITE_DIRECTIONS[previousMove.direction],
      inferredDirection: true,
      start,
      end
    });
  }

  return moves
    .sort((a, b) => a.start - b.start)
    .map(({ value, unit, direction, inferredDirection }) => ({
      value,
      unit,
      direction,
      ...(inferredDirection ? { inferredDirection: true } : {})
    }));
}

function addDirectedMove(moves, candidate) {
  const overlapsExistingMove = moves.some((move) => candidate.start < move.end && candidate.end > move.start);
  if (!overlapsExistingMove) moves.push(candidate);
}

function findPreviousDirectedMove(moves, start) {
  return moves.reduce((previous, move) => {
    if (move.end > start) return previous;
    if (!previous || move.end > previous.end) return move;
    return previous;
  }, null);
}

function hasReturnTripCue(text) {
  const lower = String(text || '').toLowerCase();
  return /\bon\s+(?:his|her|their|the)\s+way\s+back\b/.test(lower) ||
    /\bback\s+to\s+(?:his|her|their|the)\s+(?:car|vehicle|start|starting\s+point)\b/.test(lower) ||
    /\bback\s+towards?\s+(?:where\s+(?:he|she|they|it)\s+started|(?:the\s+)?start|(?:the\s+)?starting\s+point)\b/.test(lower);
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
    specialCase: 'spin_in_place',
    solveFor: 'distance and displacement',
    distanceDisplay: '0',
    displacementDisplay: '0',
    finalExplanation: 'She spun in place, so her position did not change.'
  }));
}

function tryPoolLengthDistanceDisplacement(text, lower, ctx) {
  if (!looksLikePoolLengthCase(lower)) return null;
  const length = ctx.findNumberWithUnit(text, ctx.DISTANCE_UNITS);
  const timesMatch = /\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+times?\b/i.exec(text);
  if (!length || !timesMatch) return null;

  const times = parseSmallNumber(timesMatch[1]);
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
    specialCase: 'pool_lengths',
    solveFor: 'distance and displacement',
    distanceDisplay,
    displacementDisplay,
    length,
    times,
    distance,
    displacement,
    ctx
  }));
}

function tryClosedLoopDistanceDisplacement(text, lower, ctx) {
  if (!looksLikeClosedLoopCase(lower)) return null;
  const distance = ctx.findNumberWithUnit(text, ctx.DISTANCE_UNITS);
  if (!distance) return null;

  const distanceDisplay = formatDistanceValue(distance.value, distance.unit, ctx);
  const displacementDisplay = `0 ${pluralDisplayUnit(displayDistanceUnit(distance.unit), 0)}`;

  return ctx.answer('Recognized closed-loop distance and displacement problem.', [
    'Distance adds the path.',
    `distance = ${distanceDisplay}`,
    'Displacement is start-to-finish.',
    `displacement = ${displacementDisplay}`,
    `Answer: distance = ${distanceDisplay}; displacement = ${displacementDisplay}`
  ], buildSpecialDistanceDisplacementFormulaWork({
    formulaId: 'distance_displacement_closed_loop',
    specialCase: 'closed_loop',
    solveFor: 'distance and displacement',
    distanceDisplay,
    displacementDisplay,
    distance,
    ctx
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

function parseSmallNumber(value) {
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  const words = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12
  };
  return words[String(value || '').toLowerCase()] || NaN;
}

function formatOneDimensionalDisplacementExpression(moves, positiveDirection, magnitude, resultDirection, unit, ctx) {
  const expression = moves.map((move, index) => {
    const operator = move.direction === moves[0].direction ? '+' : '-';
    const term = `${formatDistanceValue(move.value, unit, ctx)} ${move.direction}`;
    return index === 0 ? term : `${operator} ${term}`;
  }).join(' ');
  return `${expression} = ${formatDisplacementValue(magnitude, unit, resultDirection, ctx)}`;
}

function formatPathSum(moves, ctx, options = {}) {
  if (moves.length === 0) return '';
  const unit = moves[0].unit;
  return moves
    .map((move) => {
      if (options.omitUnits) return ctx.cleanNumber(move.value);
      return `${ctx.cleanNumber(move.value)} ${pluralDisplayUnit(displayDistanceUnit(unit), move.value)}`;
    })
    .join(' + ');
}

function formatDistanceValue(value, unit, ctx) {
  const displayUnit = displayDistanceUnit(unit);
  return `${ctx.cleanNumber(value)} ${pluralDisplayUnit(displayUnit, value)}`;
}

function formatApproxDistanceValue(value, unit) {
  const displayUnit = displayDistanceUnit(unit);
  const prefix = Number.isInteger(value) ? '' : 'about ';
  return `${prefix}${formatApproxNumber(value)} ${pluralDisplayUnit(displayUnit, value)}`;
}

function formatDisplacementValue(value, unit, direction, ctx) {
  const displayUnit = displayDistanceUnit(unit);
  if (!Number.isFinite(value) || value === 0 || !direction) return `0 ${pluralDisplayUnit(displayUnit, 0)}`;
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
  return unit;
}

function pluralDisplayUnit(unit, value) {
  if (unit === 'mile' && Math.abs(value) !== 1) return 'miles';
  if (unit === 'block' && Math.abs(value) !== 1) return 'blocks';
  return unit;
}

function formatResultDirection({ xMagnitude, yMagnitude, xDirection, yDirection }) {
  if (xMagnitude === 0 && yMagnitude === 0) return '';
  if (xMagnitude === 0) return yDirection;
  if (yMagnitude === 0) return xDirection;
  return `${yDirection[0]}${xDirection[0]}`.toUpperCase();
}

function formatDirectionDetail({ xMagnitude, yMagnitude, xDirection, yDirection, compassDirection }) {
  if (!compassDirection || xMagnitude === 0 || yMagnitude === 0) return '';

  const longCompassDirection = {
    NE: 'northeast',
    NW: 'northwest',
    SE: 'southeast',
    SW: 'southwest'
  }[compassDirection] || compassDirection;

  if (!['east', 'west'].includes(xDirection) || !['north', 'south'].includes(yDirection)) {
    return longCompassDirection;
  }

  const angle = Math.atan2(yMagnitude, xMagnitude) * (180 / Math.PI);
  return `${longCompassDirection}, about ${formatApproxNumber(angle)}° ${yDirection} of ${xDirection}`;
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
  const distanceValue = Number.isFinite(distance) ? distance : moves.reduce((sum, move) => sum + move.value, 0);
  const distanceDisplay = formatDistanceValue(distanceValue, unit, ctx);
  const displacementDisplay = formatDisplacementValue(magnitude, unit, resultDirection, ctx);
  return {
    formulaId: 'distance_displacement',
    family: 'motion',
    solveFor: 'distance and displacement',
    formula: 'distance = total path; displacement = final position - initial position',
    finalAnswer: {
      value: total,
      unit,
      direction: magnitude === 0 ? null : resultDirection,
      distance: distanceDisplay,
      displacement: displacementDisplay,
      display: `distance = ${distanceDisplay}; displacement = ${displacementDisplay}`
    },
    variables: {
      distance: {
        value: distanceValue,
        unit,
        display: distanceDisplay
      },
      displacement: {
        value: magnitude,
        unit,
        direction: magnitude === 0 ? null : resultDirection,
        display: displacementDisplay
      },
      ...buildMovementVariables(moves, ctx)
    },
    steps: buildOneDimensionalDistanceDisplacementSteps({ moves, distance: distanceValue, magnitude, unit, resultDirection, ctx })
  };
}

function buildTwoDimensionalFormulaWork({ displacement, distance, horizontalTotal, verticalTotal, xMagnitude, yMagnitude, xDirection, yDirection, unit, moves, ctx }) {
  const compassDirection = formatResultDirection({ xMagnitude, yMagnitude, xDirection, yDirection });
  const distanceDisplay = formatDistanceValue(distance, unit, ctx);
  const displacementDisplay = formatDisplacementValue(displacement, unit, compassDirection, ctx);
  return {
    formulaId: 'distance_displacement_2d',
    family: 'motion',
    solveFor: 'distance and displacement',
    formula: 'distance = total path; displacement = √(x² + y²)',
    finalAnswer: {
      value: displacement,
      unit,
      direction: compassDirection || null,
      distance: distanceDisplay,
      displacement: displacementDisplay,
      display: `distance = ${distanceDisplay}; displacement = ${displacementDisplay}`
    },
    variables: {
      distance: {
        value: distance,
        unit,
        display: distanceDisplay
      },
      displacement: {
        value: displacement,
        unit,
        direction: compassDirection || null,
        display: displacementDisplay
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
      ...buildMovementVariables(moves, ctx)
    },
    steps: buildTwoDimensionalDistanceDisplacementSteps({
      moves,
      distance,
      displacement,
      xMagnitude,
      yMagnitude,
      xDirection,
      yDirection,
      unit,
      ctx
    })
  };
}

function buildMovementVariables(moves, ctx) {
  const variables = {
    movements: moves.map((move) => ({
      value: move.value,
      unit: move.unit,
      direction: move.direction,
      display: `${formatDistanceValue(move.value, move.unit, ctx)} ${move.direction}`
    }))
  };

  moves.forEach((move, index) => {
    variables[`movement${index + 1}`] = {
      symbol: `path ${index + 1}`,
      value: move.value,
      unit: move.unit,
      direction: move.direction,
      display: `${formatDistanceValue(move.value, move.unit, ctx)} ${move.direction}`
    };
  });

  return variables;
}

function buildTargetStep() {
  return {
    id: 'identify_solve_target',
    type: 'multiple_choice',
    prompt: 'What quantities are we solving for?',
    choices: [
      { number: 1, label: 'distance and displacement', correct: true },
      { number: 2, label: 'speed and time', correct: false },
      { number: 3, label: 'mass and force', correct: false }
    ],
    expected: 'distance and displacement',
    acceptedAnswers: ['both', 'distance displacement', 'distance and displacement'],
    hints: ['The question asks for both the total path and the start-to-finish change.']
  };
}

function buildConceptStep(formula, hint) {
  return {
    id: 'choose_formula',
    type: 'multiple_choice',
    prompt: 'Which idea should we use?',
    choices: [
      { number: 1, label: formula, correct: true },
      { number: 2, label: 'speed = distance / time', correct: false },
      { number: 3, label: 'force = mass × acceleration', correct: false }
    ],
    expected: formula,
    hints: [hint]
  };
}

function buildMovementQuantityStep(move, index, ctx) {
  const display = `${formatDistanceValue(move.value, move.unit, ctx)} ${move.direction}`;
  return {
    id: `identify_movement${index + 1}`,
    type: 'quantity',
    prompt: `What is movement ${index + 1}?`,
    expectedValue: move.value,
    expectedUnit: move.unit,
    expectedDisplay: display,
    hints: [`Look for the ${ordinal(index + 1)} path length and its direction.`]
  };
}

function buildOneDimensionalDistanceDisplacementSteps({ moves, distance, magnitude, unit, resultDirection, ctx }) {
  const first = moves[0];
  const distanceExpression = moves.map((move) => ctx.cleanNumber(move.value)).join(' + ');
  const displacementExpression = moves.map((move, index) => {
    const sign = index === 0 || move.direction === first.direction ? '' : '-';
    return `${sign}${ctx.cleanNumber(move.value)}`;
  }).join(' + ').replace('+ -', '- ');
  const distanceSubstitution = moves.some((move) => move.inferredDirection)
    ? `distance = (${distanceExpression})`
    : `distance = ${distanceExpression}`;
  const displacementSubstitution = `displacement = ${displacementExpression}`;

  return [
    buildTargetStep(),
    buildConceptStep(
      'distance = total path; displacement = start-to-finish change',
      'Distance adds every path length. Displacement subtracts opposite directions on the same line.'
    ),
    ...moves.map((move, index) => buildMovementQuantityStep(move, index, ctx)),
    {
      id: 'calculate_distance',
      type: 'calculation',
      prompt: `What is the total distance? Use ${distanceSubstitution}.`,
      substitution: distanceSubstitution,
      calculationExpression: distanceExpression,
      acceptAnyNumberInAnswer: true,
      expectedValue: distance,
      expectedUnit: unit,
      expectedDisplay: formatDistanceValue(distance, unit, ctx),
      hints: [
        'Distance is the total path, so add the path lengths.',
        `Add ${formatPathSum(moves, ctx)}.`
      ]
    },
    {
      id: 'calculate_displacement',
      type: 'calculation',
      prompt: `What is the displacement? Use ${displacementSubstitution}.`,
      substitution: displacementSubstitution,
      calculationExpression: displacementExpression,
      acceptAnyNumberInAnswer: true,
      expectedValue: magnitude,
      expectedUnit: unit,
      expectedDisplay: formatDisplacementValue(magnitude, unit, resultDirection, ctx),
      hints: [
        'For displacement, subtract movement in the opposite direction.',
        `${moves[0].direction} and ${moves[1]?.direction || 'the opposite direction'} are opposite directions, so use ${displacementExpression}.`
      ]
    }
  ].filter(Boolean);
}

function buildTwoDimensionalDistanceDisplacementSteps({ moves, distance, displacement, xMagnitude, yMagnitude, xDirection, yDirection, unit, ctx }) {
  const compassDirection = formatResultDirection({ xMagnitude, yMagnitude, xDirection, yDirection });
  const displacementDisplay = formatDisplacementValue(displacement, unit, compassDirection, ctx);
  const distanceExpression = moves.map((move) => ctx.cleanNumber(move.value)).join(' + ');
  const distanceSubstitution = `distance = ${distanceExpression}`;
  const displacementExpression = `sqrt(${ctx.cleanNumber(xMagnitude)}^2 + ${ctx.cleanNumber(yMagnitude)}^2)`;
  const displacementSubstitution = `displacement = ${displacementExpression}`;

  return [
    buildTargetStep(),
    buildConceptStep(
      'distance = total path; displacement = √(x² + y²)',
      'Distance adds the path. Displacement is the straight-line start-to-finish distance.'
    ),
    ...moves.map((move, index) => buildMovementQuantityStep(move, index, ctx)),
    {
      id: 'calculate_distance',
      type: 'calculation',
      prompt: `What is the total distance? Use ${distanceSubstitution}.`,
      substitution: distanceSubstitution,
      calculationExpression: distanceExpression,
      acceptAnyNumberInAnswer: true,
      expectedValue: distance,
      expectedUnit: unit,
      expectedDisplay: formatDistanceValue(distance, unit, ctx),
      hints: [
        'Distance is the total path, so add the path lengths.',
        `Add ${formatPathSum(moves, ctx)}.`
      ]
    },
    {
      id: 'calculate_displacement',
      type: 'calculation',
      prompt: `What is the displacement? Use ${displacementSubstitution}.`,
      substitution: displacementSubstitution,
      calculationExpression: displacementExpression,
      acceptAnyNumberInAnswer: true,
      expectedValue: displacement,
      expectedUnit: unit,
      expectedDisplay: displacementDisplay,
      hints: [
        'For displacement, use the straight-line start-to-finish change.',
        `The x leg is ${formatDistanceValue(xMagnitude, unit, ctx)} ${xDirection}, and the y leg is ${formatDistanceValue(yMagnitude, unit, ctx)} ${yDirection}.`
      ]
    }
  ];
}

function ordinal(value) {
  if (value === 1) return 'first';
  if (value === 2) return 'second';
  if (value === 3) return 'third';
  return `${value}th`;
}

function buildSpecialDistanceDisplacementFormulaWork({
  formulaId,
  specialCase,
  solveFor,
  distanceDisplay,
  displacementDisplay,
  distance,
  displacement,
  length,
  times,
  finalExplanation,
  ctx
}) {
  return {
    formulaId,
    family: 'motion',
    solveFor,
    formula: 'distance = total path; displacement = final position - initial position',
    finalAnswer: {
      distance: distanceDisplay,
      displacement: displacementDisplay,
      display: `distance = ${distanceDisplay}; displacement = ${displacementDisplay}`
    },
    finalExplanation: finalExplanation || '',
    variables: buildSpecialDistanceDisplacementVariables({ specialCase, distance, displacement, length, times, ctx }),
    steps: buildSpecialDistanceDisplacementSteps({
      specialCase,
      distanceDisplay,
      displacementDisplay,
      distance,
      displacement,
      length,
      times,
      ctx
    })
  };
}

function buildSpecialDistanceDisplacementVariables({ specialCase, distance, displacement, length, times, ctx }) {
  if (specialCase === 'closed_loop' && distance && ctx) {
    return {
      distance: {
        value: distance.value,
        unit: distance.unit,
        display: formatDistanceValue(distance.value, distance.unit, ctx)
      },
      displacement: {
        value: 0,
        unit: distance.unit,
        display: `0 ${displayDistanceUnit(distance.unit)}`
      }
    };
  }

  if (specialCase === 'pool_lengths' && length && ctx) {
    return {
      poolLength: {
        value: length.value,
        unit: length.unit,
        display: formatDistanceValue(length.value, length.unit, ctx)
      },
      lengthCount: {
        value: times,
        display: ctx.cleanNumber(times)
      },
      distance: {
        value: distance,
        unit: length.unit,
        display: formatDistanceValue(distance, length.unit, ctx)
      },
      displacement: {
        value: displacement,
        unit: length.unit,
        display: displacement === 0
          ? `0 ${displayDistanceUnit(length.unit)}`
          : `${formatApproxNumber(displacement)} ${displayDistanceUnit(length.unit)} away from the side started on`
      }
    };
  }

  return {
    distance: { value: 0, display: '0' },
    displacement: { value: 0, display: '0' }
  };
}

function buildSpecialDistanceDisplacementSteps(options) {
  const { specialCase } = options;
  if (specialCase === 'closed_loop') return buildClosedLoopDistanceDisplacementSteps(options);
  if (specialCase === 'pool_lengths') return buildPoolLengthDistanceDisplacementSteps(options);
  if (specialCase === 'spin_in_place') return buildSpinInPlaceDistanceDisplacementSteps();
  return [];
}

function buildClosedLoopDistanceDisplacementSteps({ distance, ctx }) {
  if (!distance || !ctx) return [];
  const distanceDisplay = formatDistanceValue(distance.value, distance.unit, ctx);
  const displacementDisplay = `0 ${displayDistanceUnit(distance.unit)}`;

  return [
    buildTargetStep(),
    buildConceptStep(
      'distance = total path; displacement = start-to-finish change',
      'Distance is the full path around the block. Displacement only compares the start and finish.'
    ),
    {
      id: 'calculate_distance',
      type: 'calculation',
      prompt: 'What is the total path distance around the block?',
      substitution: `distance = ${ctx.cleanNumber(distance.value)}`,
      calculationExpression: ctx.cleanNumber(distance.value),
      acceptAnyNumberInAnswer: true,
      expectedValue: distance.value,
      expectedUnit: distance.unit,
      expectedDisplay: distanceDisplay,
      hints: ['The problem gives the path around the block as 0.35 miles.']
    },
    {
      id: 'identify_finish_location',
      prompt: 'Where does PJ finish compared to where he started?',
      expected: 'back at his doorstep',
      acceptedAnswers: [
        'back at his doorstep',
        'at his doorstep',
        'his doorstep',
        'same place',
        'the same place',
        'where he started',
        'back where he started',
        'back at the start',
        'starting point',
        'the starting point'
      ],
      hints: ['The sidewalk brings him back to his doorstep.']
    },
    {
      id: 'calculate_displacement',
      type: 'calculation',
      prompt: 'What is his displacement?',
      substitution: 'displacement = 0',
      calculationExpression: '0',
      acceptAnyNumberInAnswer: true,
      expectedValue: 0,
      expectedUnit: distance.unit,
      expectedDisplay: displacementDisplay,
      hints: ['If the start and finish are the same place, displacement is 0.']
    }
  ];
}

function buildSpinInPlaceDistanceDisplacementSteps() {
  return [
    buildTargetStep(),
    buildConceptStep(
      'distance = total path; displacement = start-to-finish change',
      'She spins in place, so there is no path from one location to another and no start-to-finish position change.'
    ),
    {
      id: 'identify_spin_in_place',
      prompt: 'Did Mali move to a different location, or did she spin in place?',
      expected: 'spin in place',
      acceptedAnswers: [
        'spin in place',
        'spun in place',
        'spins in place',
        'spain in place',
        'same place',
        'the same place',
        'same spot',
        'the same spot',
        'stayed in place',
        "didn't move",
        'did not move',
        'no movement',
        'no',
        'no change in position',
        'no different location',
        'right where she started',
        'right where she was standing'
      ],
      hints: ['She fell down right where she was standing.']
    },
    {
      id: 'calculate_distance',
      type: 'calculation',
      prompt: 'What is her distance traveled from place to place?',
      substitution: 'distance = 0',
      calculationExpression: '0',
      acceptAnyNumberInAnswer: true,
      expectedValue: 0,
      expectedDisplay: '0',
      hints: ['She spun in place, so her position did not change.']
    },
    {
      id: 'calculate_displacement',
      type: 'calculation',
      prompt: 'What is her displacement?',
      substitution: 'displacement = 0',
      calculationExpression: '0',
      acceptAnyNumberInAnswer: true,
      expectedValue: 0,
      expectedDisplay: '0',
      hints: ['Her start and finish are the same place, so displacement is 0.']
    }
  ];
}

function buildPoolLengthDistanceDisplacementSteps({ length, times, distance, displacement, ctx }) {
  if (!length || !ctx) return [];
  const lengthDisplay = formatDistanceValue(length.value, length.unit, ctx);
  const distanceDisplay = formatDistanceValue(distance, length.unit, ctx);
  const displacementDisplay = displacement === 0
    ? `0 ${displayDistanceUnit(length.unit)}`
    : `${formatApproxNumber(displacement)} ${displayDistanceUnit(length.unit)} away from the side started on`;

  return [
    buildTargetStep(),
    buildConceptStep(
      'distance = total path; displacement = start-to-finish change',
      'Distance adds each pool length. Displacement compares the side where Kai starts to the side where Kai finishes.'
    ),
    {
      id: 'identify_pool_length',
      type: 'quantity',
      prompt: 'What is one pool length?',
      expectedValue: length.value,
      expectedUnit: length.unit,
      expectedDisplay: lengthDisplay,
      hints: ['The problem says the pool length is 50 m.']
    },
    {
      id: 'identify_length_count',
      type: 'calculation',
      prompt: 'How many lengths does Kai swim?',
      substitution: `lengths = ${ctx.cleanNumber(times)}`,
      calculationExpression: ctx.cleanNumber(times),
      acceptAnyNumberInAnswer: true,
      expectedValue: times,
      expectedDisplay: ctx.cleanNumber(times),
      hints: ['The problem says Kai swims the length three times.']
    },
    {
      id: 'calculate_distance',
      type: 'calculation',
      prompt: `What is the total distance? Use distance = ${ctx.cleanNumber(length.value)} × ${ctx.cleanNumber(times)}.`,
      substitution: `distance = ${ctx.cleanNumber(length.value)} × ${ctx.cleanNumber(times)}`,
      calculationExpression: `${ctx.cleanNumber(length.value)} * ${ctx.cleanNumber(times)}`,
      acceptAnyNumberInAnswer: true,
      expectedValue: distance,
      expectedUnit: length.unit,
      expectedDisplay: distanceDisplay,
      hints: ['Distance is the total path, so multiply one pool length by the number of lengths.']
    },
    {
      id: 'identify_finish_side',
      prompt: `After ${ctx.cleanNumber(times)} lengths, is Kai back where he started or at the opposite side?`,
      expected: 'opposite side',
      acceptedAnswers: [
        'opposite side',
        'the opposite side',
        'other side',
        'the other side',
        'away from the side started on',
        'not back where he started'
      ],
      hints: ['An odd number of lengths ends at the opposite side of the pool.']
    },
    {
      id: 'calculate_displacement',
      type: 'calculation',
      prompt: 'What is his displacement?',
      substitution: `displacement = ${ctx.cleanNumber(displacement)}`,
      calculationExpression: ctx.cleanNumber(displacement),
      acceptAnyNumberInAnswer: true,
      expectedValue: displacement,
      expectedUnit: length.unit,
      expectedDisplay: displacementDisplay,
      hints: ['After 3 lengths, he is one pool length away from the side where he started.']
    }
  ];
}

module.exports = { tryDisplacement };
