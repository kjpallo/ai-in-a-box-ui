const ACTIVITY_ACTION_PREFIX = 'balance_activity:';

const AMMONIA_BALANCING_ACTIVITY = deepFreeze({
  id: 'unit9.balance-ammonia',
  version: '1.0.0',
  title: 'Balance ammonia formation',
  reactants: [
    compound('nitrogen', 'N2', 'nitrogen gas', [formulaPart('N', 2)], { N: 2 }),
    compound('hydrogen', 'H2', 'hydrogen gas', [formulaPart('H', 2)], { H: 2 })
  ],
  products: [
    compound('ammonia', 'NH3', 'ammonia', [formulaPart('N', 1), formulaPart('H', 3)], { N: 1, H: 3 })
  ],
  protectedFormulaParts: {
    nitrogen: ['N', '2'],
    hydrogen: ['H', '2'],
    ammonia: ['N', 'H', '3']
  },
  validElements: ['N', 'H'],
  coefficientOptions: [1, 2, 3, 4, 5, 6, 7, 8],
  initialCoefficients: { nitrogen: 1, hydrogen: 1, ammonia: 1 },
  simplestCoefficients: { nitrogen: 1, hydrogen: 3, ammonia: 2 },
  finalConventionalEquation: 'N2 + 3H2 → 2NH3',
  provenance: {
    kind: 'user_approved_trusted_fact',
    reference: 'Unit 9 bounded ammonia-equation balancing request, Patch 1'
  }
});

function tryAmmoniaBalancingActivity(message) {
  if (!hasGenuineBalancingIntent(message)) return null;
  if (hasReactionClassificationIntent(message)) return null;
  if (!hasApprovedEquation(message)) return null;

  const activityState = createInitialActivityState();
  return {
    type: 'chemical_equation_balancing',
    confidence: 'strong',
    toolsUsed: ['unit9_trusted_balancing_activity'],
    notes: `Started trusted activity ${AMMONIA_BALANCING_ACTIVITY.id}@${AMMONIA_BALANCING_ACTIVITY.version}.`,
    directAnswer: 'Build the element table first, then adjust the coefficients to balance the equation.',
    formulaWork: {
      formulaId: AMMONIA_BALANCING_ACTIVITY.id,
      family: 'chemistry_balancing_activity',
      solveFor: 'coefficients',
      formula: 'N2 + H2 → NH3',
      activityId: AMMONIA_BALANCING_ACTIVITY.id,
      activityVersion: AMMONIA_BALANCING_ACTIVITY.version,
      activityState,
      visualMetadata: buildBalancingVisualMetadata(activityState),
      finalAnswer: { display: AMMONIA_BALANCING_ACTIVITY.finalConventionalEquation },
      finalExplanation: 'The coefficients changed to 1, 3, and 2. The subscripts did not change.',
      steps: [{
        id: 'balance_equation_workspace',
        type: 'activity_workspace',
        prompt: 'First, place N and H in both sides of the element table.',
        studentFacing: false
      }]
    },
    aiAllowed: false
  };
}

function hasGenuineBalancingIntent(message) {
  const text = normalizeWords(message);
  return /\bbalance(?:s|d|ing)?\b/.test(text) || /\bcoefficients?\b/.test(text);
}

function hasReactionClassificationIntent(message) {
  const text = normalizeWords(message);
  return /\b(?:classify|classification|reaction type|type of reaction|synthesis|decomposition|combustion|single replacement|double replacement)\b/.test(text);
}

function shouldRejectUnsupportedBalancingPrompt(message) {
  return hasGenuineBalancingIntent(message) &&
    !hasReactionClassificationIntent(message) &&
    hasChemistryEquationLikeStructure(message) &&
    !hasApprovedEquation(message);
}

function hasChemistryEquationLikeStructure(message) {
  const text = String(message || '');
  const formulaTokens = text.match(/\b[A-Za-z][A-Za-z0-9]*\b/g) || [];
  const chemicalTokens = formulaTokens.filter(looksLikeChemicalFormulaToken);
  const hasChemicalNotation = chemicalTokens.some((token) =>
    /\d/.test(token) || token.length > 1
  );
  if (!hasChemicalNotation) return false;

  const hasEquationSeparator = /(?:-{1,2}>|→|⇒|⟶|=>|=)/.test(text);
  const hasIncompleteEquationShape = /\+/.test(text) && chemicalTokens.length >= 1;
  return hasEquationSeparator || hasIncompleteEquationShape;
}

function looksLikeChemicalFormulaToken(token) {
  return /\d/.test(token) || /^(?:[A-Z][a-z]?){1,6}$/.test(token);
}

function hasApprovedEquation(message) {
  let text = String(message || '').toLowerCase().trim();
  text = text.replace(/→/g, '->').replace(/[.!?]+$/g, '').trim();
  text = text.replace(/\bplease\b/g, ' ');
  text = text.replace(/\bwhat\s+coefficients?\s+balance\b/g, ' ');
  text = text.replace(/\bbalance\s+this\s+equation\b/g, ' ');
  text = text.replace(/\bbalance\s+the\s+equation\b/g, ' ');
  text = text.replace(/\bbalance\b/g, ' ');
  text = text.replace(/__/g, ' ').replace(/:/g, ' ').replace(/\s+/g, ' ').trim();
  return text.replace(/\s+/g, '') === 'n2+h2->nh3';
}

function createInitialActivityState() {
  return {
    activityId: AMMONIA_BALANCING_ACTIVITY.id,
    phase: 'element_table',
    placements: { reactants: [], products: [] },
    tableComplete: false,
    coefficients: { ...AMMONIA_BALANCING_ACTIVITY.initialCoefficients },
    latestCheck: null,
    balancedNotSimplified: null,
    lastActionFeedback: ''
  };
}

function isAmmoniaBalancingProblem(problem) {
  return problem?.activityId === AMMONIA_BALANCING_ACTIVITY.id ||
    problem?.activityState?.activityId === AMMONIA_BALANCING_ACTIVITY.id;
}

function handleAmmoniaBalancingAction(problem, studentMessage) {
  const parsed = parseActivityAction(studentMessage);
  const state = normalizeActivityState(problem?.activityState);
  if (!parsed.ok) return activityResult(problem, state, parsed.error);

  const action = parsed.action;
  if (action.activityId !== AMMONIA_BALANCING_ACTIVITY.id) {
    return activityResult(problem, state, 'That activity ID is not recognized. The workspace was not changed.');
  }
  if (!hasValidActionShape(action)) {
    return activityResult(problem, state, 'That balancing action was malformed. The workspace was not changed.');
  }

  switch (action.type) {
    case 'place_element':
      return placeElement(problem, state, action);
    case 'remove_element':
      return removeElement(problem, state, action);
    case 'set_coefficient':
      return setCoefficient(problem, state, action);
    case 'check_balance':
      return checkBalance(problem, state, action);
    case 'reset':
      return resetActivity(problem, state, action);
    default:
      return activityResult(problem, state, 'That balancing action is not recognized. The workspace was not changed.');
  }
}

function hasValidActionShape(action) {
  const allowedKeys = {
    place_element: ['type', 'activityId', 'side', 'element', 'compoundId'],
    remove_element: ['type', 'activityId', 'side', 'element'],
    set_coefficient: ['type', 'activityId', 'compoundId', 'value'],
    check_balance: ['type', 'activityId'],
    reset: ['type', 'activityId']
  };
  const allowed = allowedKeys[action.type];
  if (!allowed) return true;
  if (Object.keys(action).some((key) => !allowed.includes(key))) return false;
  if (action.type === 'place_element') {
    return typeof action.side === 'string' && typeof action.element === 'string' && typeof action.compoundId === 'string';
  }
  if (action.type === 'remove_element') {
    return typeof action.side === 'string' && typeof action.element === 'string';
  }
  if (action.type === 'set_coefficient') {
    return typeof action.compoundId === 'string' && Number.isInteger(action.value);
  }
  return true;
}

function parseActivityAction(message) {
  const text = String(message || '');
  if (!text.startsWith(ACTIVITY_ACTION_PREFIX) || text.length > 800) {
    return { ok: false, error: 'Use the controls in the balancing workspace to continue.' };
  }

  try {
    const action = JSON.parse(text.slice(ACTIVITY_ACTION_PREFIX.length));
    if (!action || typeof action !== 'object' || Array.isArray(action)) throw new Error('invalid');
    if (typeof action.type !== 'string' || typeof action.activityId !== 'string') throw new Error('invalid');
    return { ok: true, action };
  } catch (_error) {
    return { ok: false, error: 'That balancing action was malformed. The workspace was not changed.' };
  }
}

function placeElement(problem, state, action) {
  const validationError = validatePlacementAction(action, state);
  if (validationError) return activityResult(problem, state, validationError);

  const next = clone(state);
  next.placements[action.side].push({ element: action.element, sourceCompoundId: action.compoundId });
  next.placements[action.side].sort(sortPlacement);
  next.tableComplete = tableIsComplete(next.placements);
  next.phase = next.tableComplete ? 'coefficients' : 'element_table';
  next.lastActionFeedback = next.tableComplete
    ? 'Element table complete. Coefficient controls are now available.'
    : `${action.element} was copied to ${sideLabel(action.side)}.`;
  return activityResult(problem, next, next.lastActionFeedback);
}

function removeElement(problem, state, action) {
  if (!validSide(action.side)) return activityResult(problem, state, 'That table side is not recognized. The workspace was not changed.');
  if (!validElement(action.element)) return activityResult(problem, state, 'That element is not part of this trusted activity.');
  if (state.tableComplete) return activityResult(problem, state, 'The completed element table is locked. Use the coefficient controls.');
  const next = clone(state);
  const before = next.placements[action.side].length;
  next.placements[action.side] = next.placements[action.side].filter((placement) => placement.element !== action.element);
  if (before === next.placements[action.side].length) {
    return activityResult(problem, state, `${action.element} is not currently in ${sideLabel(action.side)}.`);
  }
  next.lastActionFeedback = `${action.element} was removed from ${sideLabel(action.side)}.`;
  return activityResult(problem, next, next.lastActionFeedback);
}

function setCoefficient(problem, state, action) {
  if (!state.tableComplete) return activityResult(problem, state, 'Complete the element table before changing coefficients.');
  if (!findCompound(action.compoundId)) return activityResult(problem, state, 'That compound ID is not recognized. The workspace was not changed.');
  if (!Number.isInteger(action.value) || !AMMONIA_BALANCING_ACTIVITY.coefficientOptions.includes(action.value)) {
    return activityResult(problem, state, 'Coefficients must be whole numbers from 1 through 8. The workspace was not changed.');
  }
  const next = clone(state);
  next.coefficients[action.compoundId] = action.value;
  next.latestCheck = null;
  next.balancedNotSimplified = null;
  next.lastActionFeedback = `Coefficient for ${findCompound(action.compoundId).accessibleName} is now ${action.value}.`;
  return activityResult(problem, next, next.lastActionFeedback);
}

function checkBalance(problem, state) {
  if (!state.tableComplete) return activityResult(problem, state, 'Complete the element table before checking the balance.');
  const counts = calculateCounts(state.coefficients);
  const atomTotalsMatch = counts.reactants.N === counts.products.N && counts.reactants.H === counts.products.H;
  const simplest = sameCoefficients(state.coefficients, AMMONIA_BALANCING_ACTIVITY.simplestCoefficients);
  const next = clone(state);

  if (!atomTotalsMatch) {
    next.latestCheck = { status: 'not_balanced', counts };
    next.balancedNotSimplified = null;
    next.lastActionFeedback = `Not balanced yet. Reactants have N = ${counts.reactants.N} and H = ${counts.reactants.H}; products have N = ${counts.products.N} and H = ${counts.products.H}. Your coefficients were not changed.`;
    return activityResult(problem, next, next.lastActionFeedback);
  }

  if (!simplest) {
    const factor = sharedFactor(state.coefficients);
    next.latestCheck = { status: 'balanced_not_simplified', counts };
    next.balancedNotSimplified = {
      factor,
      selectedCoefficients: coefficientVector(state.coefficients),
      reducedCoefficients: coefficientVector(AMMONIA_BALANCING_ACTIVITY.simplestCoefficients)
    };
    next.lastActionFeedback = `The atom totals match, so this is balanced, but it is not the smallest whole-number ratio. All coefficients share a factor of ${factor}; they reduce to 1, 3, and 2.`;
    return activityResult(problem, next, next.lastActionFeedback);
  }

  next.phase = 'complete';
  next.latestCheck = { status: 'balanced_simplest', counts };
  next.balancedNotSimplified = null;
  next.lastActionFeedback = 'Balanced in the smallest whole-number ratio. N = 2 on both sides and H = 6 on both sides. N2 + 3H2 → 2NH3. The coefficients changed; the subscripts did not.';
  return activityResult(problem, next, next.lastActionFeedback, { completed: true });
}

function resetActivity(problem, state) {
  if (!state.tableComplete) return activityResult(problem, state, 'Complete the element table before resetting the coefficient workspace.');
  const next = clone(state);
  next.phase = 'coefficients';
  next.coefficients = { ...AMMONIA_BALANCING_ACTIVITY.initialCoefficients };
  next.latestCheck = null;
  next.balancedNotSimplified = null;
  next.lastActionFeedback = 'Coefficients reset to 1, 1, and 1. The completed element table was preserved.';
  return activityResult(problem, next, next.lastActionFeedback);
}

function activityResult(problem, state, response, options = {}) {
  const nextProblem = {
    ...clone(problem),
    activityId: AMMONIA_BALANCING_ACTIVITY.id,
    activityVersion: AMMONIA_BALANCING_ACTIVITY.version,
    activityState: clone(state),
    visualMetadata: buildBalancingVisualMetadata(state),
    updatedAt: new Date().toISOString()
  };
  if (options.completed) {
    nextProblem.currentStepIndex = Array.isArray(nextProblem.steps) ? nextProblem.steps.length : 1;
  }
  return {
    response,
    currentTutorProblem: options.completed ? null : nextProblem,
    completedTutorProblem: options.completed ? nextProblem : null,
    completed: Boolean(options.completed),
    stopped: false
  };
}

function buildBalancingActivityMetadata(problem) {
  if (!isAmmoniaBalancingProblem(problem)) return null;
  const state = normalizeActivityState(problem.activityState);
  return {
    id: AMMONIA_BALANCING_ACTIVITY.id,
    version: AMMONIA_BALANCING_ACTIVITY.version,
    phase: state.phase,
    tableComplete: state.tableComplete,
    placements: clone(state.placements),
    coefficients: clone(state.coefficients),
    counts: calculateCounts(state.coefficients),
    latestCheck: clone(state.latestCheck),
    balancedNotSimplified: clone(state.balancedNotSimplified),
    source: clone(AMMONIA_BALANCING_ACTIVITY.provenance)
  };
}

function buildBalancingVisualMetadata(stateInput) {
  const state = normalizeActivityState(stateInput);
  return {
    visualType: 'chemical_equation_balancing',
    activityId: AMMONIA_BALANCING_ACTIVITY.id,
    activityVersion: AMMONIA_BALANCING_ACTIVITY.version,
    phase: state.phase,
    tableComplete: state.tableComplete,
    reactants: clone(AMMONIA_BALANCING_ACTIVITY.reactants),
    products: clone(AMMONIA_BALANCING_ACTIVITY.products),
    validElements: [...AMMONIA_BALANCING_ACTIVITY.validElements],
    coefficientOptions: [...AMMONIA_BALANCING_ACTIVITY.coefficientOptions],
    placements: clone(state.placements),
    coefficients: clone(state.coefficients),
    counts: calculateCounts(state.coefficients),
    latestCheck: clone(state.latestCheck),
    balancedNotSimplified: clone(state.balancedNotSimplified),
    feedback: state.lastActionFeedback,
    finalConventionalEquation: state.phase === 'complete' ? AMMONIA_BALANCING_ACTIVITY.finalConventionalEquation : ''
  };
}

function normalizeActivityState(value) {
  const initial = createInitialActivityState();
  if (!value || value.activityId !== AMMONIA_BALANCING_ACTIVITY.id) return initial;
  const placements = { reactants: [], products: [] };
  for (const side of Object.keys(placements)) {
    const seen = new Set();
    for (const placement of Array.isArray(value.placements?.[side]) ? value.placements[side] : []) {
      const source = findCompoundOnSide(side, placement?.sourceCompoundId);
      if (!validElement(placement?.element) ||
        !source ||
        !elementRequiredOnSide(side, placement.element) ||
        !Object.prototype.hasOwnProperty.call(source.atomMap, placement.element) ||
        seen.has(placement.element)) continue;
      placements[side].push({ element: placement.element, sourceCompoundId: placement.sourceCompoundId });
      seen.add(placement.element);
    }
    placements[side].sort(sortPlacement);
  }
  const tableComplete = tableIsComplete(placements);
  const coefficients = { ...initial.coefficients };
  for (const compoundId of Object.keys(coefficients)) {
    const candidate = value.coefficients?.[compoundId];
    if (Number.isInteger(candidate) && AMMONIA_BALANCING_ACTIVITY.coefficientOptions.includes(candidate)) coefficients[compoundId] = candidate;
  }
  return {
    activityId: initial.activityId,
    phase: value.phase === 'complete' && tableComplete ? 'complete' : tableComplete ? 'coefficients' : 'element_table',
    placements,
    tableComplete,
    coefficients,
    latestCheck: value.latestCheck && typeof value.latestCheck === 'object' ? clone(value.latestCheck) : null,
    balancedNotSimplified: value.balancedNotSimplified && typeof value.balancedNotSimplified === 'object' ? clone(value.balancedNotSimplified) : null,
    lastActionFeedback: String(value.lastActionFeedback || '')
  };
}

function validatePlacementAction(action, state) {
  if (!validSide(action.side)) return 'That table side is not recognized. The workspace was not changed.';
  const source = findCompound(action.compoundId);
  if (!source) return 'That compound ID is not recognized. The workspace was not changed.';
  if (!findCompoundOnSide(action.side, action.compoundId)) {
    return `${source.accessibleName} does not belong on the ${sideLabel(action.side)} side of this equation. The workspace was not changed.`;
  }
  if (!validElement(action.element)) return 'That element is not part of this trusted activity. The workspace was not changed.';
  if (!Object.prototype.hasOwnProperty.call(source.atomMap, action.element)) {
    return `${source.accessibleName} does not contain ${action.element}. The workspace was not changed.`;
  }
  if (!elementRequiredOnSide(action.side, action.element)) {
    return `${action.element} is not required on the ${sideLabel(action.side)} side. The workspace was not changed.`;
  }
  if (state.phase !== 'element_table' || state.tableComplete) {
    return 'The completed element table is locked. Use the coefficient controls.';
  }
  if (state.placements[action.side].some((placement) => placement.element === action.element)) {
    return `${action.element} is already in ${sideLabel(action.side)}. Remove it first if you need to correct the table.`;
  }
  return '';
}

function calculateCounts(coefficients) {
  const counts = { reactants: { N: 0, H: 0 }, products: { N: 0, H: 0 } };
  for (const side of ['reactants', 'products']) {
    for (const item of AMMONIA_BALANCING_ACTIVITY[side]) {
      const coefficient = Number(coefficients?.[item.id]) || 0;
      for (const element of AMMONIA_BALANCING_ACTIVITY.validElements) {
        counts[side][element] += coefficient * (Number(item.atomMap[element]) || 0);
      }
    }
  }
  return counts;
}

function findCompound(id) {
  return [...AMMONIA_BALANCING_ACTIVITY.reactants, ...AMMONIA_BALANCING_ACTIVITY.products]
    .find((item) => item.id === id) || null;
}

function findCompoundOnSide(side, id) {
  if (!validSide(side)) return null;
  return AMMONIA_BALANCING_ACTIVITY[side].find((item) => item.id === id) || null;
}

function elementRequiredOnSide(side, element) {
  if (!validSide(side) || !validElement(element)) return false;
  return AMMONIA_BALANCING_ACTIVITY[side].some((item) =>
    Object.prototype.hasOwnProperty.call(item.atomMap, element)
  );
}

function sanitizeBalancingActivityTranscriptMessage(problem, message) {
  const text = String(message || '').trim();
  if (!isAmmoniaBalancingProblem(problem) || !text.startsWith(ACTIVITY_ACTION_PREFIX)) return text;

  const parsed = parseActivityAction(text);
  if (!parsed.ok || parsed.action.activityId !== AMMONIA_BALANCING_ACTIVITY.id) {
    return 'Used the balancing workspace controls';
  }

  const action = parsed.action;
  const state = normalizeActivityState(problem.activityState);
  if (!hasValidActionShape(action)) return 'Used the balancing workspace controls';
  if (action.type === 'place_element' && !validatePlacementAction(action, state)) {
    return `Placed ${elementName(action.element)} under ${sideLabel(action.side)}`;
  }
  if (action.type === 'remove_element' &&
    validSide(action.side) &&
    validElement(action.element) &&
    state.phase === 'element_table' &&
    state.placements[action.side].some((placement) => placement.element === action.element)) {
    return `Removed ${elementName(action.element)} from ${sideLabel(action.side)}`;
  }
  if (action.type === 'set_coefficient' &&
    state.tableComplete &&
    findCompound(action.compoundId) &&
    AMMONIA_BALANCING_ACTIVITY.coefficientOptions.includes(action.value)) {
    return `Changed the ${findCompound(action.compoundId).formula} coefficient to ${action.value}`;
  }
  if (action.type === 'check_balance' && state.tableComplete) return 'Checked the equation balance';
  if (action.type === 'reset' && state.tableComplete) return 'Reset the coefficients';
  return 'Used the balancing workspace controls';
}

function elementName(element) {
  return element === 'N' ? 'nitrogen' : element === 'H' ? 'hydrogen' : 'element';
}

function tableIsComplete(placements) {
  return ['reactants', 'products'].every((side) => {
    const elements = new Set((placements?.[side] || []).map((placement) => placement.element));
    return AMMONIA_BALANCING_ACTIVITY.validElements.every((element) => elements.has(element)) && elements.size === 2;
  });
}

function validSide(side) {
  return side === 'reactants' || side === 'products';
}

function validElement(element) {
  return AMMONIA_BALANCING_ACTIVITY.validElements.includes(element);
}

function sideLabel(side) {
  return side === 'products' ? 'PRODUCTS' : 'REACTANTS';
}

function sameCoefficients(left, right) {
  return ['nitrogen', 'hydrogen', 'ammonia'].every((id) => left?.[id] === right?.[id]);
}

function coefficientVector(coefficients) {
  return ['nitrogen', 'hydrogen', 'ammonia'].map((id) => coefficients[id]);
}

function sharedFactor(coefficients) {
  return coefficientVector(coefficients).reduce(gcd);
}

function gcd(left, right) {
  let a = Math.abs(Number(left) || 0);
  let b = Math.abs(Number(right) || 0);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function sortPlacement(left, right) {
  return AMMONIA_BALANCING_ACTIVITY.validElements.indexOf(left.element) -
    AMMONIA_BALANCING_ACTIVITY.validElements.indexOf(right.element);
}

function compound(id, formula, accessibleName, formulaParts, atomMap) {
  return { id, formula, accessibleName, formulaParts, atomMap, formulaProtected: true };
}

function formulaPart(element, subscript) {
  return { kind: 'element', element, subscript, protected: true };
}

function normalizeWords(value) {
  return String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

module.exports = {
  ACTIVITY_ACTION_PREFIX,
  AMMONIA_BALANCING_ACTIVITY,
  buildBalancingActivityMetadata,
  buildBalancingVisualMetadata,
  createInitialActivityState,
  handleAmmoniaBalancingAction,
  hasApprovedEquation,
  hasGenuineBalancingIntent,
  isAmmoniaBalancingProblem,
  sanitizeBalancingActivityTranscriptMessage,
  shouldRejectUnsupportedBalancingPrompt,
  tryAmmoniaBalancingActivity
};
