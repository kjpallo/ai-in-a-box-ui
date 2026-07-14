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
  coefficientReduction: {
    factor: 2,
    originalCoefficients: { nitrogen: 2, hydrogen: 6, ammonia: 4 },
    reducedCoefficients: { nitrogen: 1, hydrogen: 3, ammonia: 2 }
  },
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
    reducedCompoundIds: [],
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
    case 'reduce_coefficient':
      return reduceCoefficient(problem, state, action);
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
    reduce_coefficient: ['type', 'activityId', 'compoundId', 'divisor'],
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
  if (action.type === 'reduce_coefficient') {
    return typeof action.compoundId === 'string' && Number.isInteger(action.divisor);
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
  if (state.phase === 'reduction') {
    return activityResult(problem, state, 'Finish the divide-by-2 reduction or reset before changing coefficients.');
  }
  if (!findCompound(action.compoundId)) return activityResult(problem, state, 'That compound ID is not recognized. The workspace was not changed.');
  if (!Number.isInteger(action.value) || !AMMONIA_BALANCING_ACTIVITY.coefficientOptions.includes(action.value)) {
    return activityResult(problem, state, 'Coefficients must be whole numbers from 1 through 8. The workspace was not changed.');
  }
  const next = clone(state);
  next.coefficients[action.compoundId] = action.value;
  next.latestCheck = null;
  next.balancedNotSimplified = null;
  next.reducedCompoundIds = [];
  next.lastActionFeedback = `Coefficient for ${findCompound(action.compoundId).accessibleName} is now ${action.value}.`;
  return activityResult(problem, next, next.lastActionFeedback);
}

function checkBalance(problem, state) {
  if (!state.tableComplete) return activityResult(problem, state, 'Complete the element table before checking the balance.');
  if (state.phase === 'reduction') {
    return activityResult(problem, state, 'The equation is already atom-balanced. Divide each coefficient by 2 to finish.');
  }
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
    const reduction = AMMONIA_BALANCING_ACTIVITY.coefficientReduction;
    if (!sameCoefficients(state.coefficients, reduction.originalCoefficients)) {
      return activityResult(problem, state, 'This balanced coefficient set is not supported by the trusted reduction step. The workspace was not changed.');
    }
    const factor = reduction.factor;
    next.phase = 'reduction';
    next.latestCheck = { status: 'balanced_not_simplified', counts };
    next.balancedNotSimplified = {
      factor,
      selectedCoefficients: coefficientVector(state.coefficients),
      reducedCoefficients: coefficientVector(reduction.reducedCoefficients)
    };
    next.reducedCompoundIds = [];
    next.lastActionFeedback = `The atom totals match, so the equation is balanced, but the coefficients are not in the smallest whole-number ratio. All three coefficients can be divided by the trusted common factor of ${factor}.`;
    return activityResult(problem, next, next.lastActionFeedback);
  }

  next.phase = 'complete';
  next.latestCheck = { status: 'balanced_simplest', counts };
  next.balancedNotSimplified = null;
  next.reducedCompoundIds = [];
  next.lastActionFeedback = 'Balanced in the smallest whole-number ratio. N = 2 on both sides and H = 6 on both sides. N2 + 3H2 → 2NH3. The coefficients changed; the subscripts did not.';
  return activityResult(problem, next, next.lastActionFeedback, { completed: true });
}

function reduceCoefficient(problem, state, action) {
  const reduction = AMMONIA_BALANCING_ACTIVITY.coefficientReduction;
  if (!isTrustedReductionActive(state)) {
    return activityResult(problem, state, 'The trusted coefficient-reduction step is not active. Check the balanced equation first.');
  }
  const compound = findCompound(action.compoundId);
  if (!compound || !coefficientIds().includes(action.compoundId)) {
    return activityResult(problem, state, 'That coefficient is not part of this trusted reduction. The workspace was not changed.');
  }
  if (action.divisor !== reduction.factor) {
    return activityResult(problem, state, `Use the trusted common factor of ${reduction.factor}. The workspace was not changed.`);
  }
  if (state.reducedCompoundIds.includes(action.compoundId)) {
    return activityResult(problem, state, `The ${compound.formula} coefficient has already been reduced. Choose a remaining coefficient.`);
  }

  const original = reduction.originalCoefficients[action.compoundId];
  const reduced = reduction.reducedCoefficients[action.compoundId];
  if (!Number.isInteger(original) || !Number.isInteger(reduced) || original / action.divisor !== reduced) {
    return activityResult(problem, state, 'That coefficient reduction is not supported. The workspace was not changed.');
  }

  const next = clone(state);
  next.reducedCompoundIds.push(action.compoundId);
  const completedCount = next.reducedCompoundIds.length;
  if (completedCount < coefficientIds().length) {
    next.lastActionFeedback = `${original} ÷ ${reduction.factor} = ${reduced}. ${completedCount} of 3 coefficients reduced. The activity is not complete yet.`;
    return activityResult(problem, next, next.lastActionFeedback);
  }

  next.phase = 'complete';
  next.coefficients = { ...reduction.reducedCoefficients };
  const counts = calculateCounts(next.coefficients);
  next.latestCheck = { status: 'balanced_simplest', counts };
  next.balancedNotSimplified = null;
  next.lastActionFeedback = `${original} ÷ ${reduction.factor} = ${reduced}. All 3 coefficients are reduced. N2 + 3H2 → 2NH3.`;
  return activityResult(problem, next, next.lastActionFeedback, { completed: true });
}

function resetActivity(problem, state) {
  if (!state.tableComplete) return activityResult(problem, state, 'Complete the element table before resetting the coefficient workspace.');
  const next = clone(state);
  next.phase = 'coefficients';
  next.coefficients = { ...AMMONIA_BALANCING_ACTIVITY.initialCoefficients };
  next.latestCheck = null;
  next.balancedNotSimplified = null;
  next.reducedCompoundIds = [];
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
    reductionProgress: buildReductionProgress(state),
    completionEligible: state.phase === 'complete',
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
    reductionProgress: buildReductionProgress(state),
    completionEligible: state.phase === 'complete',
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
  const reductionPhase = tableComplete &&
    value.phase === 'reduction' &&
    sameCoefficients(coefficients, AMMONIA_BALANCING_ACTIVITY.coefficientReduction.originalCoefficients);
  const completePhase = tableComplete && value.phase === 'complete';
  const reducedCompoundIds = [];
  if (reductionPhase || completePhase) {
    for (const compoundId of Array.isArray(value.reducedCompoundIds) ? value.reducedCompoundIds : []) {
      if (coefficientIds().includes(compoundId) && !reducedCompoundIds.includes(compoundId)) reducedCompoundIds.push(compoundId);
    }
  }
  return {
    activityId: initial.activityId,
    phase: completePhase ? 'complete' : reductionPhase ? 'reduction' : tableComplete ? 'coefficients' : 'element_table',
    placements,
    tableComplete,
    coefficients,
    latestCheck: value.latestCheck && typeof value.latestCheck === 'object' ? clone(value.latestCheck) : null,
    balancedNotSimplified: reductionPhase ? trustedBalancedNotSimplified() : null,
    reducedCompoundIds,
    lastActionFeedback: String(value.lastActionFeedback || '')
  };
}

function isTrustedReductionActive(state) {
  const reduction = AMMONIA_BALANCING_ACTIVITY.coefficientReduction;
  return state.phase === 'reduction' &&
    state.tableComplete === true &&
    state.balancedNotSimplified?.factor === reduction.factor &&
    sameCoefficients(state.coefficients, reduction.originalCoefficients);
}

function trustedBalancedNotSimplified() {
  const reduction = AMMONIA_BALANCING_ACTIVITY.coefficientReduction;
  return {
    factor: reduction.factor,
    selectedCoefficients: coefficientVector(reduction.originalCoefficients),
    reducedCoefficients: coefficientVector(reduction.reducedCoefficients)
  };
}

function buildReductionProgress(state) {
  if (state.phase !== 'reduction' && state.reducedCompoundIds.length === 0) return null;
  const reduction = AMMONIA_BALANCING_ACTIVITY.coefficientReduction;
  const reducedIds = new Set(state.reducedCompoundIds);
  const items = coefficientIds().map((compoundId) => ({
    compoundId,
    formula: findCompound(compoundId).formula,
    accessibleName: findCompound(compoundId).accessibleName,
    originalCoefficient: reduction.originalCoefficients[compoundId],
    divisor: reduction.factor,
    reducedCoefficient: reduction.reducedCoefficients[compoundId],
    reduced: reducedIds.has(compoundId)
  }));
  return {
    factor: reduction.factor,
    items,
    completedCount: items.filter((item) => item.reduced).length,
    totalCount: items.length,
    complete: items.every((item) => item.reduced)
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
    state.phase === 'coefficients' &&
    findCompound(action.compoundId) &&
    AMMONIA_BALANCING_ACTIVITY.coefficientOptions.includes(action.value)) {
    return `Changed the ${findCompound(action.compoundId).formula} coefficient to ${action.value}`;
  }
  if (action.type === 'reduce_coefficient' &&
    isTrustedReductionActive(state) &&
    coefficientIds().includes(action.compoundId) &&
    action.divisor === AMMONIA_BALANCING_ACTIVITY.coefficientReduction.factor &&
    !state.reducedCompoundIds.includes(action.compoundId)) {
    return `Reduced the ${findCompound(action.compoundId).formula} coefficient by 2`;
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
  return coefficientIds().map((id) => coefficients[id]);
}

function coefficientIds() {
  return ['nitrogen', 'hydrogen', 'ammonia'];
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
