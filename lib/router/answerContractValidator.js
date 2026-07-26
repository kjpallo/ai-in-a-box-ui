const { isDeepStrictEqual } = require('node:util');

const {
  isApprovedKnowledgeItem,
  isReviewedApprovedKnowledgeItem
} = require('../knowledge/approvedKnowledgeIdentity');
const { tryScienceFormula } = require('../formulas/scienceFormulaTools');
const { buildKnowledgeAnswer, makeRoute } = require('./answerBuilder');
const { tryMathOnly } = require('./mathCalculator');
const { routeStudentQuestion: routeCanonicalStudentQuestion } = require('./questionRouter');
const { tryTeacherApprovedAnswer } = require('./teacherApprovedAnswerRules');

const VALID_CONFIDENCE = new Set(['none', 'weak', 'strong']);
const CANDIDATE_ORIGINS = new Set([
  'ai',
  'base_router',
  'contract_guard',
  'graph_builder',
  'resolved_followup',
  'untrusted'
]);

const TOPIC_ALIASES = Object.freeze({
  atomic: 'chemistry',
  atomic_structure: 'chemistry',
  circuit: 'electricity',
  circuits: 'electricity',
  electrical: 'electricity',
  electricity_and_magnetism: 'electricity',
  force: 'forces',
  motion_and_force: 'forces',
  motion_and_forces: 'forces',
  motion_force: 'forces',
  newton_laws: 'forces',
  newtons_law: 'forces',
  newtons_laws: 'forces',
  periodic_table: 'chemistry',
  physics_energy: 'energy'
});

const CONCEPT_ALIASES = Object.freeze({
  balanced_force: 'balanced_forces',
  current: 'electric_current',
  earth_gravity: 'earth_surface_gravity',
  electric_current_flow: 'electric_current',
  gpe: 'gravitational_potential_energy',
  heat: 'heat_energy',
  gravitational_acceleration: 'earth_surface_gravity',
  lunar_gravity: 'moon_gravity',
  moon_gravitation: 'moon_gravity',
  net_forces: 'net_force',
  newton_1st_law: 'newtons_first_law',
  newton_first_law: 'newtons_first_law',
  newton_2nd_law: 'newtons_second_law',
  newton_second_law: 'newtons_second_law',
  newton_3rd_law: 'newtons_third_law',
  newton_third_law: 'newtons_third_law',
  physical_property: 'physical_properties',
  unbalanced_force: 'unbalanced_forces',
  voltage_difference: 'voltage'
});

const CONCEPT_PATTERNS = Object.freeze({
  acceleration: /\bacceleration\b/i,
  air_resistance: /\b(?:air resistance|drag)\b/i,
  balanced_forces: /\bbalanced forces?\b/i,
  chemical_energy: /\bchemical energy\b/i,
  chemical_property: /\bchemical propert(?:y|ies)\b/i,
  circuit_diagram: /\bcircuit diagram\b|\b(?:battery|cell)\b[\s\S]*\b(?:switch|bulb|lamp)\b/i,
  circuit_state: /\b(?:bulb|lamp)\b[\s\S]*\b(?:light|lit|on|off)\b/i,
  compression: /\bcompressions?\b/i,
  conductor: /\bconductors?\b/i,
  constructive_interference: /\bconstructive interference\b/i,
  distance: /\bdistance\b/i,
  earth_surface_gravity: /\b(?:Earth(?:'s)? surface gravity|gravity near Earth)\b|9\.?8\s*m\s*\/\s*s(?:²|\^?2)/i,
  electric_current: /\b(?:electric )?current\b/i,
  electric_field: /\belectric fields?\b/i,
  energy_type: /\b(?:chemical|electrical|elastic(?: potential)?|gravitational potential|kinetic|mechanical|potential|radiant|light|optical|sound|thermal)\s+energy\b/i,
  electrical_material: /\b(?:conductors?|insulators?)\b/i,
  electrical_power: /\b(?:electric(?:al)? )?power\b/i,
  force: /\bforces?\b/i,
  friction: /\bfriction\b/i,
  gravitational_potential_energy: /\bgravitational potential energy\b|\bGPE\b/i,
  height: /\bheight\b|\bhigh\b/i,
  heat_energy: /\bheat(?: energy)?\b|(?:^|[^A-Za-z])q(?:$|[^A-Za-z])/i,
  kinetic_energy: /\bkinetic energy\b|\bKE\b/i,
  loudness: /\bloud(?:er|ness)?\b/i,
  mass: /\bmass\b|\bamount of matter\b/i,
  mass_number: /\bmass number\b/i,
  average_atomic_mass: /\baverage atomic mass\b/i,
  magnetic_repulsion: /\brepel(?:s|led|ling)?\b|\bmagnetic repulsion\b/i,
  magnetic_field: /\bmagnetic fields?\b/i,
  generator: /\bgenerators?\b/i,
  convection: /\bconvection\b/i,
  moon_gravity: /\b(?:Moon|lunar)\b[\s\S]*\bgravit/i,
  net_force: /\bnet force\b/i,
  newtons_first_law: /\bNewton(?:'s|s|’s)?\s+(?:First|1st)\s+Law\b|\blaw of inertia\b/i,
  newtons_second_law: /\bNewton(?:'s|s|’s)?\s+(?:Second|2nd)\s+Law\b/i,
  newtons_third_law: /\bNewton(?:'s|s|’s)?\s+(?:Third|3rd)\s+Law\b|\bequal and opposite\b/i,
  periodic_table: /\bperiodic table\b/i,
  periodic_group: /\bgroups?\b/i,
  periodic_period: /\bperiods?\b/i,
  physical_properties: /\bphysical propert(?:y|ies)\b|\bphysical\b/i,
  position: /\bposition\b/i,
  protons_and_electrons: /\bprotons?\b[\s\S]*\belectrons?\b|\belectrons?\b[\s\S]*\bprotons?\b/i,
  radiant_energy: /\bradiant energy\b/i,
  rarefaction: /\brarefactions?\b/i,
  reflection: /\breflection\b|\breflect(?:s|ed|ing)?\b/i,
  resistance: /\bresistance\b/i,
  series_circuit: /\bseries(?: circuit)?\b/i,
  sound_energy: /\bsound energy\b/i,
  speed: /\bspeed\b/i,
  specific_heat: /\bspecific heat\b/i,
  tarnishing: /\btarnish(?:es|ed|ing)?\b/i,
  thermal_energy: /\bthermal energy\b|\bheat\b/i,
  time: /\btime\b/i,
  unbalanced_forces: /\bunbalanced forces?\b/i,
  velocity: /\bvelocity\b/i,
  voltage: /\bvoltage(?: difference)?\b|\belectric potential difference\b/i,
  valence_electrons: /\bvalence electrons?\b/i,
  wave: /\bwaves?\b/i,
  wave_speed: /\bwave speed\b|\bspeed of (?:a |the )?wave\b/i,
  frequency: /\bfrequency\b/i,
  wavelength: /\bwavelength\b/i,
  period: /\bperiod\b/i,
  work: /\bwork\b/i,
  power: /\bpower\b/i
});

const FORMULA_TARGET_PATTERNS = Object.freeze({
  acceleration: /\ba\s*=\s*(?:\(\s*v[fi]\s*-\s*v[if]\s*\)\s*\/\s*t|F\s*\/\s*m)\b/i,
  density: /\bD\s*=\s*m\s*\/\s*V\b/,
  electric_current: /\bI\s*=\s*V\s*\/\s*R\b/,
  electrical_power: /\bP\s*=\s*V\s*[×*x]\s*I\b/,
  force: /\bF\s*=\s*m\s*[×*x]\s*a\b/,
  resistance: /\bR\s*=\s*V\s*\/\s*I\b/,
  speed: /\bspeed\s*=\s*distance\s*\/\s*time\b/i,
  voltage: /\bV\s*=\s*I\s*[×*x]\s*R\b/,
  volume: /\bV\s*=\s*(?:m\s*\/\s*D|l\s*[×*x]\s*w\s*[×*x]\s*h|s(?:³|\^3))\b/,
  wave: /\bv\s*=\s*f\s*[×*x]\s*λ\b/i,
  work: /\bW\s*=\s*F\s*[×*x]\s*d\b/
});

const TARGET_CONFLICTS = Object.freeze({
  force: ['voltage', 'electric_field', 'mass'],
  mass: ['force'],
  voltage: ['force', 'electric_field'],
  electric_field: ['voltage'],
  electric_current: ['conductor'],
  conductor: ['electric_current'],
  thermal_energy: ['gravitational_potential_energy'],
  gravitational_potential_energy: ['thermal_energy'],
  moon_gravity: ['earth_surface_gravity'],
  earth_surface_gravity: ['moon_gravity'],
  newtons_first_law: ['periodic_table'],
  periodic_table: ['newtons_first_law'],
  physical_properties: ['chemical_property'],
  chemical_property: ['physical_properties']
});

const TRUSTED_EVIDENCE_CLASSES = new Set([
  'approved_knowledge_graph',
  'local_rule',
  'local_teacher_fact',
  'question_contract_guard',
  'safety_validator'
]);

const TRUSTED_TOOLS = new Set([
  'acids_bases_knowledge',
  'ambiguous_vocab_rules',
  'answer_contract_validator',
  'answer_intent_rules',
  'approved_teacher_content',
  'calculator',
  'chemistry_compounds',
  'circuit_diagram_rules',
  'comparison_rules',
  'electricity_magnetism_knowledge_pack',
  'fallback_calculator',
  'free_body_forces_concepts',
  'knowledge_graph',
  'local_periodic_table',
  'mathjs',
  'mathjs_calculator',
  'motion_force_knowledge',
  'physics_forces_vocab',
  'question_contract_guard',
  'resolved_followup_rules',
  'router_clarification_guard',
  'router_fragment_guard',
  'science_formula_rules',
  'standards_followup_rules',
  'teacher_approved_answer_rules',
  'teacher_facts',
  'unit1_conversions_notation_knowledge',
  'unit1_graphing_data_knowledge',
  'unit1_measurement_knowledge',
  'unit1_safety_equipment_knowledge',
  'unit1_scientific_method_knowledge',
  'unit3_energy_knowledge',
  'unit5_waves_knowledge',
  'unit6_matter_knowledge',
  'unit7_atomic_structure_knowledge',
  'unit8_bonding_knowledge',
  'unit9_balancing_boundary',
  'unit9_reactions_knowledge',
  'unit9_trusted_balancing_activity'
]);

const TEACHER_APPROVED_RULE_IDS = new Set([
  'multiple_choice_conductor_material',
  'speed_unit_centimeters_per_minute',
  'unbalanced_forces_equal_not_opposite',
  'unbalanced_forces_unequal_opposite',
  'balanced_forces_equal_opposite',
  'net_force_overall_forces',
  'force_push_pull_motion_change',
  'lamp_table_newtons_first_law',
  'moon_gravity_lower_mass',
  'voltage_pushes_charge_through_circuit',
  'wave_energy_not_matter',
  'electric_current_flow_through_conductor',
  'resistance_slows_current',
  'chemical_energy_classification',
  'sound_energy_classification',
  'thermal_energy_classification',
  'radiant_energy_classification',
  'electric_field_force_moves_charges',
  'silver_tarnishing_chemical_property',
  'malleability_ductility_physical_properties'
]);

const UNIT_PATTERNS = Object.freeze({
  'm/s²': /(?:^|[^A-Za-z])m\s*\/\s*s(?:²|\^?\s*2)(?![A-Za-z])|\bmeters?\s+per\s+second\s+squared\b/i,
  'cm/s²': /(?:^|[^A-Za-z])cm\s*\/\s*s(?:²|\^?\s*2)(?![A-Za-z])|\bcentimeters?\s+per\s+second\s+squared\b/i,
  'km/h²': /(?:^|[^A-Za-z])km\s*\/\s*h(?:r|our)?s?(?:²|\^?\s*2)(?![A-Za-z])|\bkilometers?\s+per\s+hour\s+squared\b/i,
  'cm/min': /(?:^|[^A-Za-z])cm\s*(?:\/|\bper\b)\s*min(?:ute)?s?(?![A-Za-z])|\bcentimeters?\s+per\s+minutes?\b/i,
  'km/h': /(?:^|[^A-Za-z])km\s*(?:\/|\bper\b)\s*(?:h|hr|hour)s?(?![A-Za-z])|\bkilometers?\s+per\s+hours?\b/i,
  'm/s': /(?:^|[^A-Za-z])m\s*(?:\/|\bper\b)\s*s(?:ec(?:ond)?s?)?(?![A-Za-z])|\bmeters?\s+per\s+seconds?\b/i,
  'ft/s': /(?:^|[^A-Za-z])ft\s*(?:\/|\bper\b)\s*s(?:ec(?:ond)?s?)?(?![A-Za-z])|\bfeet\s+per\s+seconds?\b/i,
  mph: /\bmph\b|\bmi\s*\/\s*h(?:r|our)?s?\b|\bmiles?\s+per\s+hour\b/i,
  'kg·m/s': /\bkg\s*[·*x×]?\s*m\s*\/\s*s\b|\bkilogram[- ]meters?\s+per\s+second\b/i,
  kg: /\bkg\b|\bkilograms?\b/i,
  mg: /\bmg\b|\bmilligrams?\b/i,
  g: /\bgrams?\b|(?:^|\s)g(?:$|\s|[.,;:])/i,
  km: /\bkm\b|\bkilometers?\b/i,
  cm: /\bcm\b|\bcentimeters?\b/i,
  mm: /\bmm\b|\bmillimeters?\b/i,
  m: /\bmeters?\b|(?:^|\s)m(?:$|\s|[.,;:])/i,
  ft: /\b(?:feet|foot|ft)\b/i,
  in: /\binches?\b/i,
  mi: /\b(?:miles?|mi)\b/i,
  ms: /\b(?:milliseconds?|ms)\b/i,
  min: /\b(?:minutes?|mins?|min)\b/i,
  h: /\b(?:hours?|hrs?|hr)\b|(?:^|\s)h(?:$|\s|[.,;:])/i,
  s: /\b(?:seconds?|secs?|sec)\b|(?:^|\s)s(?:$|\s|[.,;:])/i,
  year: /\b(?:years?|yrs?|yr)\b/i,
  N: /(?:^|[^A-Za-z])N(?:$|[^A-Za-z])|\bnewtons?\b/,
  V: /(?:^|[^A-Za-z])V(?:$|[^A-Za-z])|\bvolts?\b/,
  A: /(?:^|[^A-Za-z])A(?:$|[^A-Za-z])|\b(?:amperes?|amps?)\b/,
  Ω: /Ω|\bohms?\b/i,
  J: /(?:^|[^A-Za-z])J(?:$|[^A-Za-z])|\bjoules?\b/,
  W: /(?:^|[^A-Za-z])W(?:$|[^A-Za-z])|\bwatts?\b/,
  Hz: /\b(?:hertz|Hz)\b/,
  '°C': /°\s*C\b|\bdegrees?\s+celsius\b|\bcelsius\b/i,
  '°F': /°\s*F\b|\bdegrees?\s+fahrenheit\b|\bfahrenheit\b/i,
  K: /(?:^|[^A-Za-z])K(?:$|[^A-Za-z])|\bkelvins?\b/
});

/**
 * Validate one fully drafted deterministic route. This function never mutates
 * the route, contract, Formula Tutor work, or matched knowledge.
 */
function validateRouteAgainstContract({
  message = '',
  contract = {},
  route = null,
  matchedKnowledge = [],
  stage = 'router',
  candidateOrigin = 'untrusted',
  graphContext = null
} = {}) {
  const safeRoute = route && typeof route === 'object' ? route : {};
  const trustedOrigin = normalizeCandidateOrigin(candidateOrigin);
  const taskType = normalizeIdentifier(contract.taskType || 'unsupported');
  const answer = getDirectAnswer(safeRoute);
  const missingContext = getMissingContext(contract);
  const requiresClarification = missingContext.length > 0;
  const routeType = normalizeIdentifier(safeRoute.type || safeRoute.public?.type || 'unknown');

  if (requiresClarification) {
    const clarificationOriginBound = [
      'contract_guard',
      'resolved_followup'
    ].includes(trustedOrigin);
    const clarificationMatches =
      clarificationOriginBound &&
      clarificationMatchesMissingContext(answer, missingContext);
    const clarificationFailureReason = !clarificationOriginBound
      ? 'missing_context_candidate_origin_not_bound'
      : 'missing_context_not_requested';
    return freezeValidation({
      valid: clarificationMatches,
      accepted: clarificationMatches,
      status: clarificationMatches ? 'clarification' : 'rejected',
      reason: clarificationMatches
        ? 'required_clarification_provided'
        : clarificationFailureReason,
      reasons: clarificationMatches ? [] : [clarificationFailureReason],
      confidence: 'none',
      requiresClarification: true,
      missingContext,
      stage: normalizeStage(stage),
      candidateOrigin: trustedOrigin,
      taskType,
      routeType,
      checks: {
        directAnswerPresent: Boolean(answer),
        taskFormValid: clarificationMatches,
        topicCompatible: false,
        targetConceptSupported: false,
        trustedEvidence: false,
        safeNoMatch: isSafeNoMatchRoute(safeRoute)
      }
    });
  }

  const canonicalBaseRouteCheck = trustedOrigin === 'base_router'
    ? verifyCanonicalBaseRoute({
      message,
      contract,
      route: safeRoute,
      matchedKnowledge
    })
    : validCheck();

  if (
    canonicalBaseRouteCheck.valid &&
    isTrustedPartialAnswerCandidate(safeRoute, trustedOrigin)
  ) {
    return freezeValidation({
      valid: true,
      accepted: true,
      status: 'incomplete',
      reason: 'trusted_partial_answer_requests_missing_information',
      reasons: [],
      confidence: 'weak',
      requiresClarification: true,
      missingContext: ['calculation_values'],
      stage: normalizeStage(stage),
      candidateOrigin: trustedOrigin,
      taskType,
      routeType,
      checks: {
        directAnswerPresent: Boolean(answer),
        taskFormValid: true,
        topicCompatible: true,
        targetConceptSupported: false,
        trustedEvidence: true,
        safeNoMatch: false
      }
    });
  }

  if (
    canonicalBaseRouteCheck.valid &&
    isTrustedClarificationCandidate(safeRoute, trustedOrigin)
  ) {
    return freezeValidation({
      valid: true,
      accepted: true,
      status: 'clarification',
      reason: 'trusted_route_requests_required_information',
      reasons: [],
      confidence: 'none',
      requiresClarification: true,
      missingContext: ['calculation_values'],
      stage: normalizeStage(stage),
      candidateOrigin: trustedOrigin,
      taskType,
      routeType,
      checks: {
        directAnswerPresent: Boolean(answer),
        taskFormValid: true,
        topicCompatible: true,
        targetConceptSupported: true,
        trustedEvidence: true,
        safeNoMatch: false
      }
    });
  }

  if (isSafeNoMatchRoute(safeRoute)) {
    return freezeValidation({
      valid: true,
      accepted: true,
      status: 'safe_no_match',
      reason: 'safe_no_match',
      reasons: [],
      confidence: 'none',
      requiresClarification: false,
      missingContext: [],
      stage: normalizeStage(stage),
      candidateOrigin: trustedOrigin,
      taskType,
      routeType,
      checks: {
        directAnswerPresent: Boolean(answer),
        taskFormValid: true,
        topicCompatible: false,
        targetConceptSupported: false,
        trustedEvidence: true,
        safeNoMatch: true
      }
    });
  }

  const failures = [];
  const taskCheck = validateTaskForm({
    message,
    contract,
    route: safeRoute,
    answer
  });
  const topicCheck = evaluateTopicCompatibility({
    message,
    contract,
    route: safeRoute,
    matchedKnowledge,
    answer
  });
  const targetCheck = evaluateTargetConcept({
    contract,
    route: safeRoute,
    answer
  });
  const evidenceCheck = evaluateTrustedEvidence({
    message,
    contract,
    route: safeRoute,
    matchedKnowledge,
    candidateOrigin: trustedOrigin,
    graphContext,
    canonicalBaseRouteCheck
  });
  const graphAllowed = evaluateGraphUse(
    contract,
    safeRoute,
    trustedOrigin,
    graphContext
  );

  if (!answer) failures.push('missing_direct_answer');
  if (!taskCheck.valid) failures.push(taskCheck.reason);
  if (!topicCheck.valid) failures.push(topicCheck.reason);
  if (!targetCheck.valid) failures.push(targetCheck.reason);
  if (!evidenceCheck.valid) failures.push(evidenceCheck.reason);
  if (!graphAllowed.valid) failures.push(graphAllowed.reason);

  const valid = failures.length === 0;
  const confidence = valid
    ? computeCentralConfidence({ route: safeRoute, evidenceCheck, taskCheck })
    : 'none';

  return freezeValidation({
    valid,
    accepted: valid,
    status: valid ? 'accepted' : 'rejected',
    reason: valid ? 'contract_satisfied' : failures[0],
    reasons: failures,
    confidence,
    requiresClarification: false,
    missingContext: [],
    stage: normalizeStage(stage),
    candidateOrigin: trustedOrigin,
    taskType,
    routeType,
    checks: {
      directAnswerPresent: Boolean(answer),
      taskFormValid: taskCheck.valid,
      topicCompatible: topicCheck.valid,
      targetConceptSupported: targetCheck.valid,
      trustedEvidence: evidenceCheck.trusted,
      graphUseAllowed: graphAllowed.valid,
      safeNoMatch: false
    },
    evidence: {
      source: evidenceCheck.source,
      quality: evidenceCheck.quality,
      trusted: evidenceCheck.trusted,
      answerTopics: topicCheck.answerTopics,
      contractTopics: topicCheck.contractTopics
    }
  });
}

/**
 * Apply validation without mutating the candidate. Accepted routes receive a
 * centrally computed confidence while retaining the exact Formula Tutor work
 * object. Rejected candidates are returned separately from a safe replacement.
 */
function applyRouteValidation(options = {}) {
  const validation = validateRouteAgainstContract(options);
  const originalRoute = options.route && typeof options.route === 'object'
    ? options.route
    : null;

  if (validation.valid) {
    const acceptedRoute = [
      'clarification',
      'incomplete',
      'safe_no_match'
    ].includes(validation.status)
      ? sanitizeAcceptedSafetyRoute(originalRoute || {}, validation)
      : withValidationMetadata(originalRoute || {}, validation);
    return {
      route: acceptedRoute,
      validation,
      rejectedRoute: null
    };
  }

  return {
    route: buildSafeValidationRoute({
      contract: options.contract || {},
      validation,
      stage: options.stage
    }),
    validation,
    rejectedRoute: originalRoute
  };
}

function validateTaskForm({ message, contract, route, answer }) {
  const taskType = normalizeIdentifier(contract.taskType || 'unsupported');

  if (taskType === 'calculation') {
    const numeric = hasStructuredNumericResult(route) || hasNumericText(answer);
    if (!numeric) return invalidCheck('calculation_missing_numeric_result');

    const requiredUnits = getRequiredUnits(contract);
    if (
      (contract.requiredAnswerForm === 'numeric_with_unit' || requiredUnits.length > 0) &&
      !requiredUnits.every((unit) => routeContainsUnit(route, answer, unit))
    ) {
      return invalidCheck('calculation_missing_requested_unit');
    }
    return validCheck();
  }

  if (taskType === 'unit_only') {
    const requiredUnits = getRequiredUnits(contract);
    if (requiredUnits.length === 0) {
      return hasAnyRecognizedUnit(answer)
        ? validCheck()
        : invalidCheck('unit_answer_missing_unit');
    }
    return requiredUnits.every((unit) => routeContainsUnit(route, answer, unit))
      ? validCheck()
      : invalidCheck('unit_answer_does_not_match_requested_unit');
  }

  if (taskType === 'binary_classification') {
    const categories = getAllowedCategories(contract, message);
    if (categories.length === 0) return invalidCheck('binary_categories_are_undefined');
    return resolveExplicitCategory(answer, categories)
      ? validCheck()
      : invalidCheck('binary_answer_does_not_resolve_a_category');
  }

  if (taskType === 'law_identification') {
    return hasLawName(answer, contract.targetConcept)
      ? validCheck()
      : invalidCheck('law_answer_missing_law_name');
  }

  if (taskType === 'cloze') {
    return hasClozeTarget(answer, contract.targetConcept, route)
      ? validCheck()
      : invalidCheck('cloze_answer_missing_target_term');
  }

  if (taskType === 'definition') {
    if (normalizeIdentifier(contract.requiredAnswerForm) === 'formula') {
      if (
        normalizeIdentifier(route.type || route.public?.type) === 'ambiguous_vocab' &&
        hasValidPendingClarification(route) &&
        hasUsefulInformationalAnswer(answer)
      ) {
        return validCheck();
      }
      return hasFormulaAnswerForm(answer)
        ? validCheck()
        : invalidCheck('formula_lookup_missing_formula');
    }
    return hasDefinitionForm(answer, contract.targetConcept)
      ? validCheck()
      : invalidCheck('definition_answer_missing_target_definition');
  }

  if (taskType === 'multiple_choice') {
    if (contract.missingAnswerChoices) {
      return invalidCheck('multiple_choice_options_missing');
    }
    return resolvesSuppliedChoice(answer, contract.suppliedChoices)
      ? validCheck()
      : invalidCheck('multiple_choice_answer_does_not_resolve_supplied_choice');
  }

  if (taskType === 'diagram_required') {
    return clarificationMatchesMissingContext(answer, ['diagram'])
      ? validCheck()
      : invalidCheck('referenced_diagram_is_missing');
  }

  if (taskType === 'draw_diagram') {
    return String(route.diagramText || '').trim() || /\b(?:diagram|battery|switch|bulb)\b/i.test(answer)
      ? validCheck()
      : invalidCheck('requested_diagram_not_provided');
  }

  if (taskType === 'explanation') {
    return (hasCausalExplanation(answer) || hasUsefulInformationalAnswer(answer)) &&
      (!contract.targetConcept || answerMatchesConcept(answer, contract.targetConcept))
      ? validCheck()
      : invalidCheck('explanation_missing_target_or_causal_reason');
  }

  if (taskType === 'contextual_followup') {
    return String(answer || '').trim()
      ? validCheck()
      : invalidCheck('contextual_followup_missing_direct_answer');
  }

  return invalidCheck('unsupported_task_requires_safe_no_match');
}

function evaluateTopicCompatibility({ message, contract, route, matchedKnowledge, answer }) {
  const requirements = contract.evidenceRequirements || {};
  const contractTopics = uniqueStrings(contract.candidateTopics)
    .map(normalizeTopic)
    .filter((topic) => topic && topic !== 'unknown');
  const compatibleTopicRequired =
    requirements.compatibleTopicRequired === true ||
    contractTopics.length > 0;

  if (!compatibleTopicRequired) {
    return {
      valid: true,
      reason: '',
      answerTopics: [],
      contractTopics
    };
  }

  const answerTopics = collectAnswerTopics(route, matchedKnowledge, answer);
  const answerTextTopics = inferTopicsFromText(answer);
  const textSupportsQuestionTopic =
    normalizeIdentifier(contract.taskType) === 'contextual_followup' ||
    answerTextTopics.length === 0 ||
    answerTextTopics.some((topic) => contractTopics.includes(topic));
  const requiresExplicitComparisonCoverage =
    contractTopics.length > 1 &&
    /\b(?:compare|comparison|difference between)\b/i.test(String(message || ''));
  const coversExplicitComparisonTopics =
    !requiresExplicitComparisonCoverage ||
    contractTopics.every((topic) => answerTextTopics.includes(topic));
  const valid =
    answerTopics.some((topic) => contractTopics.includes(topic)) &&
    textSupportsQuestionTopic &&
    coversExplicitComparisonTopics;
  return {
    valid,
    reason: valid
      ? ''
      : !coversExplicitComparisonTopics
        ? 'comparison_answer_missing_question_topic'
        : isGraphRoute(route) && !textSupportsQuestionTopic
        ? 'graph_answer_text_topic_incompatible_with_question'
        : !textSupportsQuestionTopic
          ? 'answer_text_topic_incompatible_with_question'
        : 'answer_topic_incompatible_with_question',
    answerTopics,
    contractTopics
  };
}

function evaluateTargetConcept({ contract, route, answer }) {
  const requirements = contract.evidenceRequirements || {};
  const target = normalizeConcept(contract.targetConcept);
  const required =
    requirements.targetConceptSupportRequired === true ||
    Boolean(target);

  if (!required) return { valid: true, reason: '' };

  const supportedConcepts = uniqueStrings([
    ...asArray(route.answerConcepts),
    ...asArray(route.evidence?.concepts)
  ]).map(normalizeConcept);
  const conflict = findLeadingTargetConflict(answer, target);
  if (conflict) {
    return {
      valid: false,
      reason: `answer_resolves_conflicting_concept_${conflict}`
    };
  }

  const formulaTarget = normalizeConcept(route.formulaWork?.solveFor);
  const metadataMatch =
    supportedConcepts.includes(target) ||
    (formulaTarget && conceptsAreCompatible(formulaTarget, target)) ||
    structuredRouteSupportsTarget(route, target);
  const textMatch = answerMatchesConcept(answer, target);
  const valid = isGraphRoute(route)
    ? textMatch
    : metadataMatch || textMatch;

  return {
    valid,
    reason: valid ? '' : 'answer_does_not_support_target_concept'
  };
}

function evaluateTrustedEvidence({
  message,
  contract,
  route,
  matchedKnowledge,
  candidateOrigin,
  graphContext,
  canonicalBaseRouteCheck
}) {
  const requirements = contract.evidenceRequirements || {};
  const trustedRequired = requirements.trustedEvidenceRequired === true;
  const evidence = route.evidence && typeof route.evidence === 'object'
    ? route.evidence
    : {};
  const evidenceTrust = normalizeIdentifier(evidence.trust);
  const evidenceQuality = normalizeIdentifier(evidence.quality);

  const claimsScienceFormula =
    normalizeIdentifier(route.type || route.public?.type) === 'science_formula' ||
    routeUsesTool(route, 'science_formula_rules');
  if (claimsScienceFormula) {
    const formulaEvidence = route.formulaWork
      ? verifyStructuredFormulaEvidence(message, route, candidateOrigin)
      : verifyUnstructuredScienceFormulaEvidence(message, route, candidateOrigin);
    return requireCanonicalBaseRoute(
      formulaEvidence,
      candidateOrigin,
      canonicalBaseRouteCheck
    );
  }
  if (hasStructuredFormulaEvidence(route)) {
    return requireCanonicalBaseRoute(
      verifyStructuredFormulaEvidence(message, route, candidateOrigin),
      candidateOrigin,
      canonicalBaseRouteCheck
    );
  }
  if (
    route.formulaWork &&
    !routeUsesTool(route, 'unit9_trusted_balancing_activity')
  ) {
    return invalidEvidence('structured_formula_route_not_verified');
  }

  if (
    (route.calculatorResult || route.public?.calculator) &&
    !hasStructuredCalculatorEvidence(route)
  ) {
    return invalidEvidence('calculator_evidence_incomplete');
  }
  if (hasStructuredCalculatorEvidence(route)) {
    return requireCanonicalBaseRoute(
      verifyStructuredCalculatorEvidence(message, route, candidateOrigin),
      candidateOrigin,
      canonicalBaseRouteCheck
    );
  }

  if (
    candidateOrigin === 'base_router' &&
    !canonicalBaseRouteCheck?.valid
  ) {
    return invalidEvidence(
      canonicalBaseRouteCheck?.reason || 'base_router_candidate_not_canonical'
    );
  }

  if (isGraphRoute(route)) {
    const graphVerification = verifyApprovedGraphCandidate(route, graphContext);
    const graphTrusted =
      candidateOrigin === 'graph_builder' &&
      hasOnlyTrustedRouteTools(route) &&
      graphVerification.valid;
    return graphTrusted
      ? {
        valid: true,
        trusted: true,
        quality: evidenceQuality || 'high',
        source: 'approved_knowledge_graph'
      }
      : {
        valid: false,
        trusted: false,
        quality: 'none',
        source: '',
        reason: candidateOrigin !== 'graph_builder'
          ? 'graph_candidate_origin_not_bound'
          : graphVerification.reason || 'graph_evidence_not_verified'
      };
  }

  if (evidenceTrust === 'teacher_approved' || evidenceTrust === 'approved_teacher_content') {
    const ruleId = normalizeIdentifier(evidence.ruleId);
    const internalExpectation =
      candidateOrigin === 'base_router' &&
      normalizeIdentifier(evidence.source) === 'teacher_approved_phase_1_classroom_expectations' &&
      TEACHER_APPROVED_RULE_IDS.has(ruleId) &&
      routeUsesTool(route, 'teacher_approved_answer_rules') &&
      verifyTeacherApprovedRuleBinding(message, contract, route);
    const selectedKnowledge = findSelectedKnowledgeByExactId(route, matchedKnowledge);
    const approvedPackEvidence =
      candidateOrigin === 'base_router' &&
      approvedEvidenceMatchesKnowledge(evidence, selectedKnowledge) &&
      verifyKnowledgeRowBinding(message, route, selectedKnowledge);
    const approved = internalExpectation || approvedPackEvidence;
    if (!approved) {
      return {
        valid: false,
        trusted: false,
        quality: 'none',
        source: String(evidence.source || ''),
        reason: 'approved_evidence_missing_review_provenance'
      };
    }
    return {
      valid: true,
      trusted: approved,
      quality: approved ? (evidenceQuality || 'low') : 'none',
      source: String(evidence.source || evidenceTrust)
    };
  }

  if (TRUSTED_EVIDENCE_CLASSES.has(evidenceTrust)) {
    const selectedKnowledge = findSelectedKnowledgeByExactId(route, matchedKnowledge);
    const selectedKnowledgeTrusted =
      Boolean(selectedKnowledge) &&
      !isApprovedKnowledgeItem(selectedKnowledge) &&
      verifyKnowledgeRowBinding(message, route, selectedKnowledge);
    const classTrusted =
      evidenceTrust === 'approved_knowledge_graph'
        ? false
        : evidenceTrust === 'local_rule'
          ? (
            candidateOrigin === 'base_router' &&
            hasOnlyTrustedRouteTools(route)
          ) || (
            candidateOrigin === 'resolved_followup' &&
            routeUsesTool(route, 'resolved_followup_rules') &&
            hasOnlyTrustedRouteTools(route)
          )
          : evidenceTrust === 'local_teacher_fact'
            ? candidateOrigin === 'base_router' &&
              hasOnlyTrustedRouteTools(route) &&
              selectedKnowledgeTrusted
            : evidenceTrust === 'question_contract_guard'
              ? candidateOrigin === 'contract_guard' &&
                normalizeIdentifier(route.type || route.public?.type) === 'missing_context' &&
                hasOnlyTrustedRouteTools(route)
              : evidenceTrust === 'safety_validator'
                ? candidateOrigin === 'contract_guard' &&
                  normalizeIdentifier(route.type || route.public?.type) === 'no_match' &&
                  hasOnlyTrustedRouteTools(route)
                : false;
    if (!classTrusted) {
      return {
        valid: false,
        trusted: false,
        quality: 'none',
        source: String(evidence.source || evidenceTrust),
        reason: 'trusted_evidence_required'
      };
    }
    return {
      valid: true,
      trusted: classTrusted,
      quality: classTrusted ? (evidenceQuality || 'medium') : 'none',
      source: String(evidence.source || evidenceTrust)
    };
  }

  const tools = uniqueStrings([
    ...asArray(route.toolsUsed),
    ...asArray(route.public?.toolsUsed)
  ]);
  const hasAiTool = tools.some((tool) =>
    /(?:ollama|language[_ -]?model|ai[_ -]?fallback|generative[_ -]?ai)/i.test(tool)
  );
  const deterministicTools = tools
    .map(normalizeIdentifier)
    .filter((tool) => TRUSTED_TOOLS.has(tool));
  const usesTeacherFacts = deterministicTools.some((tool) =>
    /teacher[_ -]?facts|approved[_ -]?teacher[_ -]?content/i.test(tool)
  );
  const selectedKnowledge = findSelectedKnowledgeByExactId(route, matchedKnowledge);
  const selectedApprovedKnowledge = isApprovedKnowledgeItem(selectedKnowledge);
  const selectedKnowledgeTrusted =
    Boolean(selectedKnowledge) &&
    (
      !selectedApprovedKnowledge ||
      isReviewedApprovedKnowledgeItem(selectedKnowledge)
    ) &&
    (
      !selectedApprovedKnowledge ||
      approvedEvidenceMatchesKnowledge(evidence, selectedKnowledge)
    ) &&
    verifyKnowledgeRowBinding(message, route, selectedKnowledge);
  const verifiedComparisonEvidence =
    candidateOrigin === 'base_router' &&
    routeUsesTool(route, 'comparison_rules') &&
    verifyCompositeComparisonEvidence(route, matchedKnowledge);
  const trusted =
    candidateOrigin === 'base_router' &&
    !hasAiTool &&
    route.aiAllowed !== true &&
    (
      deterministicTools.length > 0 ||
      selectedKnowledgeTrusted
    ) &&
    (!usesTeacherFacts || selectedKnowledgeTrusted || verifiedComparisonEvidence);

  if (!trusted && trustedRequired) {
    return {
      valid: false,
      trusted: false,
      quality: 'none',
      source: '',
      reason: 'trusted_evidence_required'
    };
  }

  return {
    valid: true,
    trusted,
    quality: trusted
      ? (usesTeacherFacts && !selectedKnowledge && !verifiedComparisonEvidence ? 'low' : 'medium')
      : 'none',
    source: selectedKnowledge?.source ||
      (verifiedComparisonEvidence ? 'verified_comparison_rules' : deterministicTools[0]) ||
      ''
  };
}

function verifyCompositeComparisonEvidence(route, matchedKnowledge) {
  if (
    !routeUsesTool(route, 'teacher_facts') ||
    !routeUsesTool(route, 'comparison_rules') ||
    !hasOnlyTrustedRouteTools(route)
  ) {
    return false;
  }

  const answer = normalizeVerificationText(getDirectAnswer(route)).toLowerCase();
  const groundedRows = asArray(matchedKnowledge)
    .filter((item) => (
      item &&
      (!isApprovedKnowledgeItem(item) || isReviewedApprovedKnowledgeItem(item))
    ))
    .filter((item) => {
      const title = normalizeVerificationText(item.title).toLowerCase();
      const fact = normalizeVerificationText(item.fact).toLowerCase();
      if (!title || !fact || !answer.includes(title)) return false;
      return answer.includes(fact) ||
        answer.includes(firstSentenceText(fact)) ||
        (
          String(item.formula || '').trim() &&
          answer.includes(normalizeVerificationText(item.formula).toLowerCase())
        );
    });
  const notes = normalizeVerificationText(route.notes).toLowerCase();
  const requiredRows = /ohm|voltage\/current/.test(notes) ? 1 : 2;
  return groundedRows.length >= requiredRows;
}

function firstSentenceText(value) {
  return String(value || '').split(/[.!?](?:\s|$)/)[0].trim();
}

function verifyCanonicalBaseRoute({
  message,
  contract,
  route,
  matchedKnowledge
}) {
  try {
    const expectedRoute = routeCanonicalStudentQuestion(
      message,
      matchedKnowledge,
      contract
    );
    return isDeepStrictEqual(
      canonicalRouteSnapshot(route),
      canonicalRouteSnapshot(expectedRoute)
    )
      ? validCheck()
      : invalidCheck('base_router_candidate_not_canonical');
  } catch (error) {
    return invalidCheck('base_router_candidate_verification_failed');
  }
}

function canonicalRouteSnapshot(route = {}) {
  const {
    confidence,
    graphContext,
    questionContract,
    answerValidation,
    public: publicRoute,
    ...coreRoute
  } = route && typeof route === 'object' ? route : {};
  const {
    confidence: publicConfidence,
    graphContext: publicGraphContext,
    questionContract: publicQuestionContract,
    answerValidation: publicAnswerValidation,
    ...corePublicRoute
  } = publicRoute && typeof publicRoute === 'object' ? publicRoute : {};

  return {
    ...coreRoute,
    public: corePublicRoute
  };
}

function requireCanonicalBaseRoute(
  evidenceResult,
  candidateOrigin,
  canonicalBaseRouteCheck
) {
  if (!evidenceResult?.valid || candidateOrigin !== 'base_router') {
    return evidenceResult;
  }
  return canonicalBaseRouteCheck?.valid
    ? evidenceResult
    : invalidEvidence(
      canonicalBaseRouteCheck?.reason || 'base_router_candidate_not_canonical'
    );
}

function verifyStructuredFormulaEvidence(message, route, candidateOrigin) {
  if (candidateOrigin !== 'base_router') {
    return invalidEvidence('structured_formula_origin_not_bound');
  }
  if (
    normalizeIdentifier(route.type || route.public?.type) !== 'science_formula' ||
    !routeUsesTool(route, 'science_formula_rules')
  ) {
    return invalidEvidence('structured_formula_route_not_verified');
  }

  const expected = tryScienceFormula(message);
  if (
    !expected ||
    !expected.formulaWork ||
    !isDeepStrictEqual(route.formulaWork, expected.formulaWork)
  ) {
    return invalidEvidence('structured_formula_does_not_match_question');
  }

  const actualAnswer = normalizeVerificationText(getDirectAnswer(route));
  const expectedAnswer = normalizeVerificationText(expected.answer);
  const expectedDiagram = normalizeVerificationText(expected.diagramText);
  const exactAnswer = actualAnswer === expectedAnswer;
  const answerWithDiagram = Boolean(expectedDiagram) &&
    actualAnswer === `${expectedAnswer} Diagram: ${expectedDiagram}`;
  if (!exactAnswer && !answerWithDiagram) {
    return invalidEvidence('structured_formula_answer_does_not_match_recalculation');
  }

  return {
    valid: true,
    trusted: true,
    quality: 'high',
    source: 'verified_science_formula'
  };
}

function verifyUnstructuredScienceFormulaEvidence(message, route, candidateOrigin) {
  if (candidateOrigin !== 'base_router') {
    return invalidEvidence('structured_formula_origin_not_bound');
  }
  if (
    normalizeIdentifier(route.type || route.public?.type) !== 'science_formula' ||
    !routeUsesTool(route, 'science_formula_rules') ||
    route.formulaWork
  ) {
    return invalidEvidence('structured_formula_evidence_incomplete');
  }

  const expected = tryScienceFormula(message);
  if (
    !expected ||
    expected.formulaWork ||
    normalizeVerificationText(getDirectAnswer(route)) !==
      normalizeVerificationText(expected.answer)
  ) {
    return invalidEvidence('unstructured_formula_answer_does_not_match_question');
  }

  return {
    valid: true,
    trusted: true,
    quality: 'high',
    source: 'verified_science_formula'
  };
}

function verifyStructuredCalculatorEvidence(message, route, candidateOrigin) {
  if (candidateOrigin !== 'base_router') {
    return invalidEvidence('calculator_origin_not_bound');
  }
  if (
    normalizeIdentifier(route.type || route.public?.type) !== 'math_only' ||
    !routeUsesTool(route, 'calculator')
  ) {
    return invalidEvidence('calculator_route_not_verified');
  }

  const expected = tryMathOnly(message);
  if (
    !expected ||
    !isDeepStrictEqual(route.calculatorResult, expected) ||
    normalizeVerificationText(getDirectAnswer(route)) !==
      normalizeVerificationText(expected.answer)
  ) {
    return invalidEvidence('calculator_result_does_not_match_question');
  }

  return {
    valid: true,
    trusted: true,
    quality: 'high',
    source: 'verified_local_calculator'
  };
}

function verifyTeacherApprovedRuleBinding(message, contract, route) {
  const expected = tryTeacherApprovedAnswer(message, contract);
  if (!expected) return false;
  return isDeepStrictEqual(
    canonicalRouteSnapshot(route),
    canonicalRouteSnapshot(makeRoute(expected))
  );
}

function verifyKnowledgeRowBinding(message, route, selectedKnowledge) {
  if (!selectedKnowledge || typeof selectedKnowledge !== 'object') return false;
  const strong = Boolean(
    selectedKnowledge.exactTermMatch ||
    selectedKnowledge.exactTitleMatch ||
    Number(selectedKnowledge.score || 0) >= 18 ||
    Number(selectedKnowledge.strongestPhraseWordCount || 0) >= 3
  );
  const expectedAnswers = [
    buildKnowledgeAnswer(selectedKnowledge, strong, { preferExample: false }),
    buildKnowledgeAnswer(selectedKnowledge, strong, { preferExample: true })
  ].map(normalizeVerificationText);
  const expectedQuality = resolveKnowledgeEvidenceQuality(
    selectedKnowledge,
    strong,
    isApprovedKnowledgeItem(selectedKnowledge)
  );
  const actualQuality = normalizeIdentifier(route.evidence?.quality);
  const tools = uniqueStrings([
    ...asArray(route.toolsUsed),
    ...asArray(route.public?.toolsUsed)
  ]).map(normalizeIdentifier);
  const expectedTools = isApprovedKnowledgeItem(selectedKnowledge)
    ? ['teacher_facts', 'approved_teacher_content']
    : ['teacher_facts'];

  return expectedAnswers.includes(
    normalizeVerificationText(getDirectAnswer(route))
  ) &&
    actualQuality === expectedQuality &&
    tools.length === expectedTools.length &&
    expectedTools.every((tool) => tools.includes(tool));
}

function resolveKnowledgeEvidenceQuality(item, isStrongMatch, approvedKnowledge) {
  if (!approvedKnowledge) return isStrongMatch ? 'high' : 'low';

  const declared = String(item?.sourceQuality || item?.confidence || '')
    .trim()
    .toLowerCase();
  if (/^(?:high|strong|verified|authoritative)$/.test(declared)) {
    return isStrongMatch ? 'high' : 'medium';
  }
  if (/^(?:medium|moderate)$/.test(declared)) {
    return isStrongMatch ? 'medium' : 'low';
  }
  return 'low';
}

function approvedEvidenceMatchesKnowledge(evidence, selectedKnowledge) {
  if (
    !selectedKnowledge ||
    !isReviewedApprovedKnowledgeItem(selectedKnowledge)
  ) {
    return false;
  }

  const evidenceKnowledgeId = String(evidence.knowledgeId || '').trim();
  const selectedKnowledgeId = String(selectedKnowledge.id || '').trim();
  const evidencePackId = String(evidence.provenance?.packId || '').trim();
  const selectedPackId = String(
    selectedKnowledge.provenance?.packId ||
    selectedKnowledge.packId ||
    ''
  ).trim();

  return Boolean(evidenceKnowledgeId) &&
    evidenceKnowledgeId === selectedKnowledgeId &&
    normalizeIdentifier(evidence.reviewStatus) === 'approved' &&
    normalizeIdentifier(evidence.provenance?.type) === 'approved_knowledge_pack' &&
    Boolean(evidencePackId) &&
    evidencePackId === selectedPackId;
}

function verifyApprovedGraphCandidate(route, graphContext) {
  const payload = route.graphAnswer || route.graphRoutingSupportAnswer;
  if (
    !payload ||
    typeof payload !== 'object' ||
    !String(payload.directAnswer || '').trim() ||
    normalizeIdentifier(payload.source) !== 'approved_knowledge_graph'
  ) {
    return invalidCheck('graph_payload_is_not_approved');
  }
  if (
    normalizeVerificationText(getDirectAnswer(route)) !==
    normalizeVerificationText(payload.directAnswer)
  ) {
    return invalidCheck('graph_route_answer_does_not_match_payload');
  }
  if (!hasGraphEvidenceContext(graphContext)) {
    return invalidCheck('graph_evidence_context_missing');
  }

  const nodes = [
    graphContext.matchedNodes,
    graphContext.relatedNodes,
    ...asArray(graphContext.possiblePaths).map((path) => path?.nodes)
  ].flatMap(asArray);
  const nodeIds = new Set(nodes.map((node) => String(node?.id || '').trim()).filter(Boolean));
  const nodeLabels = new Set(nodes
    .map((node) => normalizeGraphLabel(node?.label))
    .filter(Boolean));
  const contextEdges = [
    graphContext.edges,
    ...asArray(graphContext.possiblePaths).map((path) => path?.edges)
  ].flatMap(asArray);
  contextEdges.forEach((edge) => {
    const from = String(edge?.from || '').trim();
    const to = String(edge?.to || '').trim();
    if (from) nodeIds.add(from);
    if (to) nodeIds.add(to);
  });

  const graphPath = payload.graphPath && typeof payload.graphPath === 'object'
    ? payload.graphPath
    : null;
  const claimedIds = uniqueStrings([
    payload.sourceNodeId,
    payload.targetNodeId,
    graphPath?.from,
    graphPath?.to,
    ...asArray(graphPath?.nodes).map((node) => node?.id)
  ]);
  if (claimedIds.some((id) => !nodeIds.has(id))) {
    return invalidCheck('graph_payload_node_not_in_context');
  }

  const claimedEdges = asArray(graphPath?.edges);
  if (claimedEdges.some((edge) => !graphEdgeExistsInContext(edge, contextEdges))) {
    return invalidCheck('graph_payload_edge_not_in_context');
  }

  const claimedLabels = uniqueStrings([
    ...asArray(payload.connectedConcepts),
    ...asArray(payload.prerequisiteConcepts)
  ]).map(normalizeGraphLabel).filter(Boolean);
  const resolvedLabelCount = claimedLabels
    .filter((label) => nodeLabels.has(label)).length;
  if (claimedIds.length === 0 && claimedEdges.length === 0 && resolvedLabelCount === 0) {
    return invalidCheck('graph_payload_not_bound_to_context');
  }

  return validCheck();
}

function hasGraphEvidenceContext(graphContext) {
  if (!graphContext || typeof graphContext !== 'object') return false;
  return [
    graphContext.matchedNodes,
    graphContext.relatedNodes,
    graphContext.edges,
    graphContext.possiblePaths
  ].some((items) => Array.isArray(items) && items.length > 0);
}

function graphEdgeExistsInContext(claimedEdge, contextEdges) {
  const claimedFrom = String(claimedEdge?.from || '').trim();
  const claimedTo = String(claimedEdge?.to || '').trim();
  const claimedType = normalizeIdentifier(claimedEdge?.type);
  if (!claimedFrom || !claimedTo) return false;

  return contextEdges.some((contextEdge) => {
    const contextFrom = String(contextEdge?.from || '').trim();
    const contextTo = String(contextEdge?.to || '').trim();
    const contextType = normalizeIdentifier(contextEdge?.type);
    const sameEndpoints =
      (claimedFrom === contextFrom && claimedTo === contextTo) ||
      (claimedFrom === contextTo && claimedTo === contextFrom);
    if (!sameEndpoints) return false;
    if (claimedType === contextType) return true;
    return claimedType === 'used_by' &&
      ['uses_concept', 'prerequisite_for'].includes(contextType);
  });
}

function normalizeGraphLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function invalidEvidence(reason) {
  return {
    valid: false,
    trusted: false,
    quality: 'none',
    source: '',
    reason
  };
}

function normalizeVerificationText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function routeUsesTool(route, expectedTool) {
  const expected = normalizeIdentifier(expectedTool);
  return uniqueStrings([
    ...asArray(route?.toolsUsed),
    ...asArray(route?.public?.toolsUsed)
  ]).some((tool) => normalizeIdentifier(tool) === expected);
}

function evaluateGraphUse(contract, route) {
  const tools = uniqueStrings([
    ...asArray(route.toolsUsed),
    ...asArray(route.public?.toolsUsed)
  ]);
  const usesGraph =
    /^knowledge_graph_(?:answer|support)$/i.test(String(route.type || '')) ||
    tools.some((tool) => /^knowledge_graph$/i.test(tool)) ||
    Boolean(route.graphAnswer || route.graphRoutingSupportAnswer);

  if (!usesGraph) return validCheck();

  const requirements = contract.evidenceRequirements || {};
  return requirements.graphEvidenceAllowed === true ||
    requirements.graphReplacementAllowed === true
    ? validCheck()
    : invalidCheck('graph_evidence_not_allowed_for_task');
}

function isGraphRoute(route = {}) {
  const type = normalizeIdentifier(route.type || route.public?.type);
  return /^knowledge_graph_(?:answer|support)$/.test(type) ||
    Boolean(route.graphAnswer || route.graphRoutingSupportAnswer);
}

function findLeadingTargetConflict(answer, targetConcept) {
  const target = normalizeConcept(targetConcept);
  const conflicts = TARGET_CONFLICTS[target] || [];
  if (conflicts.length === 0) return '';

  const targetIndex = conceptMentionIndex(answer, target);
  for (const conflictingConcept of conflicts) {
    const conflictIndex = conceptMentionIndex(answer, conflictingConcept);
    if (
      conflictIndex >= 0 &&
      (
        targetIndex < 0 ||
        conflictIndex < targetIndex ||
        answerEquatesConcepts(answer, target, conflictingConcept)
      )
    ) {
      return conflictingConcept;
    }
  }
  return '';
}

function answerEquatesConcepts(value, leftConcept, rightConcept) {
  const left = conceptPatternSource(leftConcept);
  const right = conceptPatternSource(rightConcept);
  if (!left || !right) return false;
  const linkingVerb = '(?:is|means|equals|refers\\s+to)';
  const article = '(?:(?:a|an|the)\\s+)?';
  return new RegExp(
    `(?:${left})\\s+${linkingVerb}\\s+${article}(?:${right})(?=$|[\\s,.;!?])|` +
    `(?:${right})\\s+${linkingVerb}\\s+${article}(?:${left})(?=$|[\\s,.;!?])`,
    'i'
  ).test(String(value || ''));
}

function conceptPatternSource(concept) {
  const normalized = normalizeConcept(concept);
  const pattern = conceptPattern(normalized);
  return pattern ? pattern.source.replace(/^\^|\$$/g, '') : '';
}

function conceptMentionIndex(value, concept) {
  const pattern = conceptPattern(normalizeConcept(concept));
  if (!pattern) return -1;
  pattern.lastIndex = 0;
  const match = pattern.exec(String(value || ''));
  return match ? match.index : -1;
}

function computeCentralConfidence({ route, evidenceCheck, taskCheck }) {
  if (!taskCheck.valid || !evidenceCheck.valid) return 'none';
  if (!evidenceCheck.trusted) return 'weak';
  if (route?.pendingClarification) return 'weak';
  return evidenceCheck.quality === 'low' ? 'weak' : 'strong';
}

function buildSafeValidationRoute({ contract = {}, validation = {}, stage = 'router' } = {}) {
  const missingContext = validation.missingContext?.length
    ? validation.missingContext
    : getMissingContext(contract);
  const directAnswer = buildSafeFallbackAnswer(missingContext);
  const notes = `Answer contract rejected the candidate at ${normalizeStage(stage)}: ${validation.reason || 'contract_mismatch'}.`;

  return {
    type: 'no_match',
    confidence: 'none',
    toolsUsed: ['answer_contract_validator'],
    notes,
    directAnswer,
    calculatorResult: null,
    formulaWork: null,
    motionForceTutor: null,
    diagramText: '',
    pendingClarification: null,
    standardId: '',
    representationIntent: null,
    imageRequest: null,
    answerTopics: [],
    answerConcepts: [],
    evidence: {
      quality: 'high',
      trust: 'safety_validator',
      source: 'answer_contract_validator',
      topics: [],
      concepts: []
    },
    aiAllowed: false,
    answerValidation: validation,
    public: {
      type: 'no_match',
      confidence: 'none',
      toolsUsed: ['answer_contract_validator'],
      aiAllowed: false
    }
  };
}

function buildSafeFallbackAnswer(missingContext) {
  if (missingContext.includes('answer_choices')) {
    return 'I need the answer choices before I can choose safely. Please provide all of the choices.';
  }
  if (missingContext.includes('diagram')) {
    return 'I need to see the referenced diagram before I can answer safely. Please upload or share the diagram, or describe the circuit and its labels.';
  }
  if (missingContext.includes('cloze_context')) {
    return 'I need the full sentence or topic before I can fill in the blank safely. Please provide that context.';
  }
  if (missingContext.length > 0) {
    return 'I need more information before I can answer safely. Please provide the missing context.';
  }
  return 'I do not have a trusted answer that matches this question yet. Please check with your teacher.';
}

function isSafeNoMatchRoute(route) {
  if (!route || typeof route !== 'object') return false;
  const type = normalizeIdentifier(route.type || route.public?.type);
  if (!['no_match', 'clarification', 'missing_context'].includes(type)) return false;
  if (route.formulaWork) return false;

  const answer = getDirectAnswer(route);
  if (!answer) return false;

  const safePatterns = [
    /^I do not have a trusted answer that matches this question yet\. Please check with your teacher\.$/i,
    /^I do not have a trusted answer for that yet\. Please ask your teacher\.$/i,
    /^I do not have a trusted balancing activity or approved answer for that equation yet\. Please check the equation with your teacher\.$/i,
    /^I do not have a trusted local safety fact for that yet\. Please ask your teacher or another trusted adult before eating, touching, smelling, or using a chemical\.$/i,
    /^I do not have a trusted local fact that explains that relationship yet\. Please ask your teacher to add that relationship to the knowledge pack\.$/i,
    /^I do not have a trusted local (?:science )?fact for that yet\. Please reword the question(?: with the vocabulary word, formula, or numbers you are asking about, or ask your teacher| or ask your teacher)\.$/i,
    /^I do not have a trusted local fact for that person yet\. Ask your teacher to add one to the knowledge pack\.$/i,
    /^I do not have a trusted local fact for the point or purpose of that yet\. Ask your teacher or reword with a specific class topic\.$/i,
    /^I do not have a trusted local science fact for (?:living cell|spreadsheet cell) yet\. Please ask your teacher or reword with a vocabulary term from your local class notes\.$/i,
    /^I do not have a trusted local problem to answer exactly\. Please send the full question, and I can help using the local rules\.$/i,
    /^I need the answer choices before I can choose safely\. Please provide all of the choices\.$/i,
    /^I need to see the referenced diagram before I can answer safely\. Please upload or share the diagram, or describe the circuit and its labels\.$/i,
    /^I need the full sentence or topic before I can fill in the blank safely\. Please provide that context\.$/i,
    /^I need more information before I can answer safely\. Please provide the missing context\.$/i,
    /^That looks like an incomplete question or sentence fragment\. Please send the full question, including the missing blank or answer choices if there are any\.$/i,
    /^I do not have enough values to find (?:power|density|wave speed|acceleration) from (?:only time|only one value|"moves fast")\. (?:For [^.]+, )?I need (?:work or energy and time|mass and volume|frequency and wavelength|the change in velocity and the time, or force and mass)\.$/i,
    /^Did you mean Ohm[’']s Law\? If so, ask [“"]What is Ohm[’']s Law\?[”"] or [“"]What is oms law\?[”"]$/i,
    /^There is not enough information(?: to answer safely)?\.$/i
  ];
  return safePatterns.some((pattern) => pattern.test(answer));
}

function isTrustedClarificationCandidate(route, candidateOrigin) {
  if (!route || typeof route !== 'object' || route.aiAllowed === true) return false;
  if (!['base_router', 'resolved_followup'].includes(candidateOrigin)) return false;
  if (route.formulaWork || route.calculatorResult) return false;
  if (!hasOnlyTrustedRouteTools(route)) return false;
  if (
    candidateOrigin === 'resolved_followup' &&
    !routeUsesTool(route, 'resolved_followup_rules')
  ) {
    return false;
  }

  const answer = getDirectAnswer(route);
  const requestsMissingValue =
    /^(?:to (?:calculate|solve|determine|find)[^.!?]*,\s*)?i need\b/i.test(answer) &&
    /\b(?:starting|initial|ending|final|another|which|what|value|values|information|current|voltage|resistance|mass|distance|time|temperature|height|energy|work|force)\b/i.test(answer);
  const requestsTargetChoice =
    /^i see\b[^.!?]*[.!?]\s*are you trying to (?:find|calculate|determine|solve for)\b[^?]*\bor\b[^?]*\?$/i.test(answer);

  return requestsMissingValue || requestsTargetChoice;
}

function isTrustedPartialAnswerCandidate(route, candidateOrigin) {
  if (!route || typeof route !== 'object' || route.aiAllowed === true) return false;
  if (candidateOrigin !== 'base_router') return false;
  if (route.formulaWork || route.calculatorResult) return false;
  if (!hasOnlyTrustedRouteTools(route)) return false;

  const answer = getDirectAnswer(route);
  const reportsPartialNumericResult = hasNumericText(answer) &&
    hasAnyRecognizedUnit(answer) &&
    /\b(?:cannot|can not|can’t|can't)\b[^.!?]*\b(?:because|without)\b/i.test(answer) &&
    /\bi need\b[^.!?]*\b(?:value|voltage|current|resistance|mass|distance|time|temperature|height)\b/i.test(answer);
  const requestsWaveSpeedForWavelength =
    normalizeIdentifier(route.type || route.public?.type) === 'science_formula' &&
    /^Use wavelength = wave speed \/ frequency\.\s+You gave frequency = [-+]?(?:\d+(?:\.\d+)?|\.\d+) Hz, but I need wave speed to calculate wavelength\.$/i.test(answer);

  return reportsPartialNumericResult || requestsWaveSpeedForWavelength;
}

function hasOnlyTrustedRouteTools(route) {
  const tools = uniqueStrings([
    ...asArray(route?.toolsUsed),
    ...asArray(route?.public?.toolsUsed)
  ]);
  return tools.length > 0 &&
    tools.every((tool) => TRUSTED_TOOLS.has(normalizeIdentifier(tool)));
}

function withValidationMetadata(route, validation) {
  const confidence = VALID_CONFIDENCE.has(validation.confidence)
    ? validation.confidence
    : 'none';
  const {
    answerValidation: _publicAnswerValidation,
    questionContract: _publicQuestionContract,
    ...candidatePublicRoute
  } = route.public && typeof route.public === 'object'
    ? route.public
    : {};
  const publicRoute = route.public && typeof route.public === 'object'
    ? {
      ...candidatePublicRoute,
      confidence
    }
    : {
      type: route.type || 'unknown',
      confidence,
      toolsUsed: asArray(route.toolsUsed),
      notes: String(route.notes || ''),
      aiAllowed: Boolean(route.aiAllowed)
    };

  return {
    ...route,
    confidence,
    answerValidation: validation,
    public: publicRoute
  };
}

function sanitizeAcceptedSafetyRoute(route, validation) {
  const confidence = VALID_CONFIDENCE.has(validation.confidence)
    ? validation.confidence
    : 'none';
  const candidateSafeTools = uniqueStrings([
    ...asArray(route.toolsUsed),
    ...asArray(route.public?.toolsUsed)
  ]).filter((tool) => TRUSTED_TOOLS.has(normalizeIdentifier(tool)));
  const safeTools = validation.status === 'safe_no_match'
    ? ['answer_contract_validator']
    : validation.candidateOrigin === 'contract_guard'
      ? ['question_contract_guard']
      : candidateSafeTools;
  const keepPendingClarification =
    validation.status !== 'safe_no_match' &&
    hasValidPendingClarification(route);
  const pendingClarification = keepPendingClarification
    ? route.pendingClarification
    : null;
  const publicPendingClarification = pendingClarification
    ? {
      id: String(pendingClarification.id || ''),
      choices: asArray(pendingClarification.choices).map((choice) => ({
        number: choice.number,
        label: choice.label
      }))
    }
    : undefined;
  const type = normalizeIdentifier(route.type || route.public?.type) ||
    (validation.status === 'safe_no_match' ? 'no_match' : 'clarification');
  const standardId = String(route.standardId || route.public?.standardId || '');
  const publicRoute = {
    type,
    confidence,
    toolsUsed: safeTools,
    aiAllowed: Boolean(route.aiAllowed)
  };
  if (standardId) publicRoute.standardId = standardId;
  if (publicPendingClarification) {
    publicRoute.pendingClarification = publicPendingClarification;
  }

  return {
    type,
    confidence,
    toolsUsed: safeTools,
    notes: validation.status === 'safe_no_match'
      ? 'Returned an exact safe no-match response.'
      : 'Returned a validated request for missing information.',
    directAnswer: getDirectAnswer(route),
    calculatorResult: null,
    formulaWork: null,
    motionForceTutor: null,
    diagramText: '',
    pendingClarification,
    standardId,
    representationIntent: null,
    imageRequest: null,
    answerTopics: [],
    answerConcepts: [],
    evidence: {
      quality: 'high',
      trust: validation.status === 'safe_no_match'
        ? 'safety_validator'
        : 'question_contract_guard',
      source: 'answer_contract_validator',
      topics: [],
      concepts: []
    },
    aiAllowed: Boolean(route.aiAllowed),
    answerValidation: validation,
    public: publicRoute
  };
}

function getMissingContext(contract) {
  const missing = uniqueStrings(contract.missingContext);
  if (contract.missingAnswerChoices) missing.push('answer_choices');
  if (contract.unseenDiagramRequired) missing.push('diagram');
  return uniqueStrings(missing);
}

function clarificationMatchesMissingContext(answer, missingContext) {
  if (!answer) return false;
  for (const item of missingContext) {
    if (item === 'answer_choices') {
      if (!/\b(?:provide|share|send|include|list|need|what are)\b[\s\S]*\b(?:choices?|options?)\b/i.test(answer)) {
        return false;
      }
      continue;
    }
    if (item === 'diagram') {
      if (!/\b(?:provide|share|send|upload|show|need|see|describe)\b[\s\S]*\b(?:diagram|image|figure|circuit|graph|chart)\b/i.test(answer)) {
        return false;
      }
      continue;
    }
    if (!/\b(?:provide|share|send|include|need|ask|tell|type|choose|more information|context)\b/i.test(answer)) {
      return false;
    }
  }
  return missingContext.length > 0;
}

function hasStructuredNumericResult(route) {
  const finalAnswer = route.formulaWork?.finalAnswer;
  if (finalAnswer && Number.isFinite(Number(finalAnswer.value))) return true;

  const calculator = route.calculatorResult || route.public?.calculator;
  return Number.isFinite(Number(
    calculator?.value ??
    calculator?.displayValue ??
    calculator?.answer
  ));
}

function hasStructuredFormulaEvidence(route) {
  const formulaWork = route.formulaWork;
  return Boolean(
    formulaWork &&
    String(formulaWork.formulaId || '').trim() &&
    String(formulaWork.solveFor || '').trim() &&
    Array.isArray(formulaWork.steps) &&
    formulaWork.steps.length > 0 &&
    Number.isFinite(Number(formulaWork.finalAnswer?.value))
  );
}

function hasStructuredCalculatorEvidence(route) {
  const calculator = route.calculatorResult;
  return Boolean(
    calculator &&
    String(calculator.expression || calculator.displayExpression || '').trim() &&
    Number.isFinite(Number(calculator.value ?? calculator.displayValue ?? calculator.answer))
  );
}

function hasNumericText(value) {
  return /(?:^|[^\w])[-+]?(?:\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)(?:$|[^\w])/i.test(
    String(value || '')
  );
}

function getRequiredUnits(contract) {
  return uniqueStrings([
    ...asArray(contract.requestedUnits),
    ...asArray(contract.evidenceRequirements?.requiredUnits)
  ]).map(canonicalizeUnit);
}

function routeContainsUnit(route, answer, requestedUnit) {
  const unit = canonicalizeUnit(requestedUnit);
  const finalAnswer = route.formulaWork?.finalAnswer || {};
  if (unitsEquivalent(finalAnswer.unit, unit)) return true;

  const haystack = [
    answer,
    finalAnswer.display,
    route.formulaWork?.resultUnit,
    route.formulaWork?.requestedUnit,
    route.calculatorResult?.unit
  ].filter(Boolean).join('\n');
  return textContainsUnit(haystack, unit);
}

function hasAnyRecognizedUnit(value) {
  return Object.keys(UNIT_PATTERNS).some((unit) => textContainsUnit(value, unit));
}

function textContainsUnit(value, unit) {
  const canonical = canonicalizeUnit(unit);
  const pattern = UNIT_PATTERNS[canonical];
  if (pattern) {
    pattern.lastIndex = 0;
    return pattern.test(String(value || ''));
  }
  return new RegExp(`(?:^|\\W)${escapeRegExp(canonical)}(?:$|\\W)`, 'i')
    .test(String(value || ''));
}

function unitsEquivalent(left, right) {
  return canonicalizeUnit(left) === canonicalizeUnit(right);
}

function canonicalizeUnit(value) {
  const unit = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\^2/g, '²')
    .replace(/ohms?/i, 'Ω')
    .replace(/°?celsius/i, '°C')
    .replace(/°?fahrenheit/i, '°F');
  const aliases = {
    amp: 'A',
    amps: 'A',
    ampere: 'A',
    amperes: 'A',
    hour: 'h',
    hours: 'h',
    'km/hr²': 'km/h²',
    'km/hour²': 'km/h²',
    joule: 'J',
    joules: 'J',
    kilometer: 'km',
    kilometers: 'km',
    meter: 'm',
    meters: 'm',
    minute: 'min',
    minutes: 'min',
    'mi/hr': 'mph',
    'mi/hour': 'mph',
    newton: 'N',
    newtons: 'N',
    ohm: 'Ω',
    second: 's',
    seconds: 's',
    volt: 'V',
    volts: 'V',
    watt: 'W',
    watts: 'W'
  };
  return aliases[unit.toLowerCase()] || unit;
}

function getAllowedCategories(contract, message) {
  const configured = uniqueStrings(contract.evidenceRequirements?.allowedCategories);
  if (configured.length > 0) return configured.map(normalizeIdentifier);
  const text = String(message || '');
  if (/\bkinetic\b[\s\S]*\bpotential\b|\bpotential\b[\s\S]*\bkinetic\b/i.test(text)) {
    return ['kinetic', 'potential'];
  }
  if (/\bphysical\b[\s\S]*\bchemical\b|\bchemical\b[\s\S]*\bphysical\b/i.test(text)) {
    return ['physical', 'chemical'];
  }
  if (/\bbalanced\b[\s\S]*\bunbalanced\b|\bunbalanced\b[\s\S]*\bbalanced\b/i.test(text)) {
    return ['balanced', 'unbalanced'];
  }
  if (/\btrue\b[\s\S]*\bfalse\b|\bfalse\b[\s\S]*\btrue\b/i.test(text)) {
    return ['true', 'false'];
  }
  if (/\bconductor\b[\s\S]*\binsulator\b|\binsulator\b[\s\S]*\bconductor\b/i.test(text)) {
    return ['conductor', 'insulator'];
  }
  return [];
}

function resolveExplicitCategory(answer, categories) {
  const text = String(answer || '');
  const positive = [];

  for (const category of categories) {
    const escaped = escapeRegExp(category).replace(/_/g, '[ _-]+');
    const positivePattern = new RegExp(
      `\\b(?:answer|classification|category)\\s+(?:is|would be|:)\\s+(?:an?\\s+)?${escaped}\\b`
      + `|\\b(?:is|are|classified as|counts as|would be|is treated as|are treated as)\\s+(?:an?\\s+)?${escaped}(?:\\s+(?:energy|property|forces?))?\\b`,
      'i'
    );
    const negativePattern = new RegExp(`\\b(?:not|isn'?t|is not)\\s+(?:an?\\s+)?${escaped}\\b`, 'i');
    if (positivePattern.test(text) && !negativePattern.test(text)) positive.push(category);
  }

  if (positive.length === 1) return positive[0];

  const comparative = categories.filter((category) => {
    const escaped = escapeRegExp(category).replace(/_/g, '[ _-]+');
    return new RegExp(
      `\\b(?:has|have|shows?|contains?)\\s+(?:the\\s+)?(?:more|greater|most|greatest)\\s+(?:gravitational\\s+)?${escaped}(?:\\s+energy)?\\b`,
      'i'
    ).test(text);
  });
  if (comparative.length === 1) return comparative[0];

  const mentioned = categories.filter((category) =>
    new RegExp(`\\b${escapeRegExp(category).replace(/_/g, '[ _-]+')}\\b`, 'i').test(text)
  );
  return mentioned.length === 1 ? mentioned[0] : '';
}

function hasLawName(answer, targetConcept) {
  const target = normalizeConcept(targetConcept);
  if (target && /newtons_(?:first|second|third)_law/.test(target)) {
    return answerMatchesConcept(answer, target);
  }
  return /\b(?:Newton(?:'s|s|’s)?\s+(?:First|Second|Third|1st|2nd|3rd)|law of [A-Za-z][A-Za-z -]+)\s+Law\b|\blaw of inertia\b/i.test(
    String(answer || '')
  );
}

function hasClozeTarget(answer, targetConcept, route) {
  const target = normalizeConcept(targetConcept);
  if (!target) {
    return normalizeIdentifier(route.type || route.public?.type) === 'cloze_completion' &&
      Boolean(String(answer || '').trim());
  }
  if (!answerMatchesConcept(answer, target)) return false;

  const supportedConcepts = uniqueStrings([
    ...asArray(route.answerConcepts),
    ...asArray(route.evidence?.concepts)
  ]).map(normalizeConcept);
  if (supportedConcepts.includes(target)) return true;

  const pattern = conceptPattern(target);
  if (!pattern) return false;
  const firstSentence = String(answer || '').split(/[.!?](?:\s|$)/)[0];
  pattern.lastIndex = 0;
  return pattern.test(firstSentence);
}

function hasDefinitionForm(answer, targetConcept) {
  const target = normalizeConcept(targetConcept);
  if (target && !answerMatchesConcept(answer, target)) return false;
  const text = String(answer || '').trim();
  const wordCount = (text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []).length;
  const definitionVerb =
    /\b(?:is|are|was|were|means?|refers? to|defined as|describes?|described|depends?|allows?|measured in|can be (?:observed|measured)|has|have|contains?|affects?|occurs?|consists?|tells?|says?|should|places?|writes?|uses?|shows?|gives?|organizes?|includes?|emits?|stores?|flows?|transfers?|converts?|produces?|comes?|travels?|needs?|opens?|closes?|can dissolve)\b/i.test(text);
  const structuredList =
    /(?:^|\n)\s*1[.)]\s+\S+/m.test(text) &&
    /(?:^|\n)\s*2[.)]\s+\S+/m.test(text);
  return wordCount >= 4 && (definitionVerb || structuredList);
}

function hasFormulaAnswerForm(answer) {
  return /(?:^|\n)[^\n=]{0,120}=[^\n]+(?:$|\n)/m.test(String(answer || ''));
}

function resolvesSuppliedChoice(answer, suppliedChoices) {
  const choices = asArray(suppliedChoices)
    .map((choice, index) => normalizeChoice(choice, index))
    .filter((choice) => choice.text);
  if (choices.length < 2) return false;

  const explicitLabels = choices.filter((choice) => {
    if (!choice.label) return false;
    const escapedLabel = escapeRegExp(choice.label);
    return new RegExp(
      `(?:^|\\b(?:answer|choice|option)\\s*(?:is|:)?\\s*)${escapedLabel}(?:\\b|[.):,-])`,
      'i'
    ).test(String(answer || ''));
  });
  if (explicitLabels.length === 1) return true;

  const textMatches = choices.filter((choice) => containsPhrase(answer, choice.text));
  return textMatches.length === 1;
}

function normalizeChoice(choice, index) {
  if (choice && typeof choice === 'object') {
    return {
      label: String(choice.label || choice.id || choice.key || index + 1).trim(),
      text: String(choice.text || choice.value || choice.answer || '').trim()
    };
  }
  return {
    label: String(index + 1),
    text: String(choice || '').trim()
  };
}

function hasCausalExplanation(answer) {
  return /\b(?:because|since|due to|caused by|results? from|which means|therefore|so that|so its?|as a result)\b/i.test(
    String(answer || '')
  );
}

function hasUsefulInformationalAnswer(answer) {
  const text = String(answer || '').trim();
  const wordCount = (text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []).length;
  return wordCount >= 6;
}

function hasValidPendingClarification(route) {
  const pending = route?.pendingClarification;
  if (!pending || typeof pending !== 'object' || !String(pending.id || '').trim()) {
    return false;
  }
  const choices = asArray(pending.choices);
  return choices.length >= 2 && choices.every((choice) => (
    choice &&
    typeof choice === 'object' &&
    (String(choice.number || '').trim() || String(choice.label || '').trim()) &&
    String(choice.answer || '').trim()
  ));
}

function collectAnswerTopics(route, matchedKnowledge, answer) {
  const explicitTopics = uniqueStrings([
    ...asArray(route.answerTopics),
    ...asArray(route.evidence?.topics)
  ]).map(normalizeTopic);
  if (explicitTopics.length > 0) return explicitTopics;

  const topics = new Set();
  const tools = uniqueStrings([
    ...asArray(route.toolsUsed),
    ...asArray(route.public?.toolsUsed)
  ]).map(normalizeIdentifier);
  for (const tool of tools) {
    if (/electricity_magnetism|circuit/.test(tool)) topics.add('electricity');
    if (/unit7_atomic_structure|local_periodic_table/.test(tool)) topics.add('chemistry');
    if (/motion_force|physics_forces|free_body/.test(tool)) topics.add('forces');
    if (/unit3_energy/.test(tool)) topics.add('energy');
    if (/unit5_waves?/.test(tool)) topics.add('waves');
    if (/unit6_matter/.test(tool)) topics.add('matter');
    if (/unit1_(?:variables|conversions)|measurement/.test(tool)) topics.add('measurement');
  }

  const family = normalizeIdentifier(route.formulaWork?.family || route.formulaWork?.formulaId);
  if (/motion|speed_distance_time|displacement|acceleration|velocity|momentum/.test(family)) topics.add('motion');
  if (/force|friction|net_force/.test(family)) topics.add('forces');
  if (/weight|gravity/.test(family)) topics.add('gravity');
  if (/electric|voltage|resistance/.test(family)) topics.add('electricity');
  if (/energy|work_power|specific_heat/.test(family)) topics.add('energy');
  if (/wave/.test(family)) topics.add('waves');
  if (/conversion|measurement|scientific_notation|temperature/.test(family)) topics.add('measurement');
  if (/density|matter/.test(family)) topics.add('matter');
  if (/atomic_structure|mass_number|protons?|electrons?|neutrons?/.test(family)) topics.add('chemistry');

  for (const inferred of inferTopicsFromFormulaText(answer)) topics.add(inferred);

  const selectedKnowledge = findSelectedKnowledge(route, matchedKnowledge);
  uniqueStrings([
    ...asArray(selectedKnowledge?.knowledgeTopics),
    ...asArray(selectedKnowledge?.topics),
    selectedKnowledge?.subject,
    selectedKnowledge?.category
  ]).forEach((topic) => {
    const normalized = normalizeTopic(topic);
    if (normalized) topics.add(normalized);
  });

  for (const inferred of inferTopicsFromText(answer)) topics.add(inferred);
  return [...topics];
}

function inferTopicsFromText(value) {
  const text = String(value || '');
  const topics = [];
  const rules = [
    ['electricity', /\b(?:electric(?:al|ity)?|circuits?|current|voltage|resistance|conductor|ohm|charge|magnet(?:ic|ism)?|generator)\b/i],
    ['forces', /\b(?:force|balanced|unbalanced|Newton(?:'s|s|’s)?\s+(?:First|Second|Third)\s+Law|friction|inertia)\b/i],
    ['gravity', /\b(?:gravity|gravitational|Moon|lunar|weight)\b/i],
    ['energy', /\b(?:energy|heat|kinetic|potential|thermal|radiant|work|power)\b/i],
    ['waves', /\b(?:waves?|vibrations?|frequency|wavelength|sound|light|vacuum|electromagnetic|gamma rays?|x-rays?|ultraviolet|infrared|microwaves?|radio waves?)\b/i],
    ['matter', /\b(?:matter|physical propert(?:y|ies)|chemical propert(?:y|ies)|physical changes?|chemical changes?|substances?|mixtures?|homogeneous|heterogeneous|colloids?|suspensions?|solutions?|solutes?|solvents?|solubility|saturated|unsaturated|supersaturated|density|viscosity|solids?|liquids?|gases?|plasma|state of matter|phase change|heating curve|melting|freezing|vaporization|evaporation|condensation|sublimation|deposition|tarnish|malleability|ductility)\b/i],
    ['chemistry', /\b(?:periodic table|atoms?|elements?|chemical reactions?|bonds?|bonding|molecules?|protons?|neutrons?|electrons?|nucleus|atomic number|mass number|isotopes?|ions?|valence electrons?|electron cloud|energy levels?|bohr model|quarks?)\b/i],
    ['motion', /\b(?:speed|velocity|acceleration|displacement|distance-time|motion)\b/i],
    ['measurement', /\b(?:unit conversion|metric|scientific notation|measurement|temperature)\b/i]
  ];
  for (const [topic, pattern] of rules) {
    if (pattern.test(text)) topics.push(topic);
  }
  return topics;
}

function inferTopicsFromFormulaText(value) {
  const answer = String(value || '');
  const topics = new Set();
  if (
    FORMULA_TARGET_PATTERNS.force.test(answer) ||
    FORMULA_TARGET_PATTERNS.acceleration.test(answer)
  ) {
    topics.add('forces');
  }
  if (FORMULA_TARGET_PATTERNS.speed.test(answer)) topics.add('motion');
  if (
    FORMULA_TARGET_PATTERNS.electric_current.test(answer) ||
    FORMULA_TARGET_PATTERNS.electrical_power.test(answer) ||
    FORMULA_TARGET_PATTERNS.resistance.test(answer) ||
    FORMULA_TARGET_PATTERNS.voltage.test(answer)
  ) {
    topics.add('electricity');
  }
  if (FORMULA_TARGET_PATTERNS.work.test(answer)) topics.add('energy');
  if (FORMULA_TARGET_PATTERNS.wave.test(answer)) topics.add('waves');
  if (
    FORMULA_TARGET_PATTERNS.density.test(answer) ||
    FORMULA_TARGET_PATTERNS.volume.test(answer)
  ) {
    topics.add('matter');
  }
  return [...topics];
}

function findSelectedKnowledge(route, matchedKnowledge) {
  const items = asArray(matchedKnowledge);
  const knowledgeId = String(route.evidence?.knowledgeId || '');
  if (knowledgeId) {
    return items.find((item) => String(item?.id || '') === knowledgeId) || null;
  }
  const usesTeacherFacts = asArray(route.toolsUsed)
    .some((tool) => /teacher[_ -]?facts/i.test(String(tool || '')));
  return usesTeacherFacts && items.length > 0 ? items[0] : null;
}

function findSelectedKnowledgeByExactId(route, matchedKnowledge) {
  const knowledgeId = String(route?.evidence?.knowledgeId || '').trim();
  if (!knowledgeId) return null;
  return asArray(matchedKnowledge)
    .find((item) => String(item?.id || '').trim() === knowledgeId) || null;
}

function answerMatchesConcept(answer, concept) {
  const pattern = conceptPattern(normalizeConcept(concept));
  if (!pattern) return false;
  pattern.lastIndex = 0;
  return pattern.test(String(answer || ''));
}

function conceptPattern(concept) {
  if (CONCEPT_PATTERNS[concept]) return CONCEPT_PATTERNS[concept];
  if (!concept) return null;
  const words = concept.split('_').filter(Boolean).map(escapeRegExp);
  if (words.length === 0) return null;
  return new RegExp(`\\b${words.join('[ -]+')}s?\\b`, 'i');
}

function conceptsAreCompatible(left, right) {
  const normalizedLeft = normalizeConcept(left);
  const normalizedRight = normalizeConcept(right);
  if (normalizedLeft === normalizedRight) return true;
  const compatible = new Set([
    'electric_current|current',
    'earth_surface_gravity|gravitational_acceleration',
    'speed|final_velocity',
    'velocity|final_velocity',
    'speed|wave_speed',
    'velocity|wave_speed',
    'heat_energy|thermal_energy',
    'physical_properties|physical_property',
    'voltage|voltage_difference'
  ]);
  return compatible.has(`${normalizedLeft}|${normalizedRight}`) ||
    compatible.has(`${normalizedRight}|${normalizedLeft}`);
}

function structuredRouteSupportsTarget(route, targetConcept) {
  const formulaId = normalizeIdentifier(route.formulaWork?.formulaId);
  const family = normalizeIdentifier(route.formulaWork?.family);
  const solveFor = normalizeConcept(route.formulaWork?.solveFor);
  const target = normalizeConcept(targetConcept);
  const directAnswer = String(route.directAnswer || '');
  const routeTools = uniqueStrings([
    ...asArray(route.toolsUsed),
    ...asArray(route.public?.toolsUsed)
  ]).map(normalizeIdentifier);

  if (
    normalizeIdentifier(route.type || route.public?.type) === 'formula_only' &&
    FORMULA_TARGET_PATTERNS[target]?.test(directAnswer)
  ) {
    return true;
  }

  if (
    target === 'gravitational_potential_energy' &&
    normalizeIdentifier(route.type || route.public?.type) === 'science_formula' &&
    routeTools.includes('science_formula_rules') &&
    /\b(?:G?PE)\s*=\s*(?:force|weight|\d+(?:\.\d+)?\s*N)\s*[×*x]\s*(?:height|\d+(?:\.\d+)?\s*m)\b/i.test(directAnswer)
  ) {
    return true;
  }

  if (
    target === 'electric_current' &&
    normalizeIdentifier(route.type || route.public?.type) === 'science_formula' &&
    (
      /\bI(?:branch)?\s*=/i.test(String(route.directAnswer || '')) ||
      /\bamps?\b|\bamperes?\b/i.test(String(route.directAnswer || ''))
    )
  ) {
    return true;
  }

  if (!formulaId && !family) return false;

  if (target === 'electric_current' && solveFor.includes('current')) return true;
  if (target === 'resistance' && solveFor.includes('resistance')) return true;
  if (target === 'electrical_power' && solveFor.includes('power')) return true;

  if (
    target === 'gravitational_potential_energy' &&
    (formulaId === 'potential_energy' || family === 'potential_energy')
  ) {
    return solveFor === 'potential_energy' ||
      solveFor === 'gravitational_potential_energy';
  }
  if (
    target === 'unit_conversion' &&
    (formulaId.includes('conversion') || family === 'unit1_conversions')
  ) {
    return true;
  }
  if (
    target === 'scientific_notation' &&
    /scientific_notation|standard_notation/.test(formulaId)
  ) {
    return true;
  }
  if (
    target === 'temperature' &&
    /temperature_conversion/.test(formulaId)
  ) {
    return true;
  }
  if (
    target === 'bohr_model' &&
    /bohr_model/.test(formulaId)
  ) {
    return true;
  }
  return false;
}

function normalizeTopic(value) {
  const normalized = normalizeIdentifier(value);
  return TOPIC_ALIASES[normalized] || normalized;
}

function normalizeConcept(value) {
  const normalized = normalizeIdentifier(value);
  return CONCEPT_ALIASES[normalized] || normalized;
}

function normalizeIdentifier(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeStage(value) {
  return String(value || 'router').trim() || 'router';
}

function normalizeCandidateOrigin(value) {
  const normalized = normalizeIdentifier(value || 'untrusted');
  return CANDIDATE_ORIGINS.has(normalized) ? normalized : 'untrusted';
}

function getDirectAnswer(route) {
  return String(route?.directAnswer || route?.response || '').trim();
}

function containsPhrase(value, phrase) {
  const normalizedValue = normalizeText(value);
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return false;
  return new RegExp(`(?:^|\\b)${escapeRegExp(normalizedPhrase).replace(/\\ /g, '\\s+')}(?:$|\\b)`, 'i')
    .test(normalizedValue);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values) {
  return [...new Set(asArray(values)
    .map((value) => String(value || '').trim())
    .filter(Boolean))];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function validCheck() {
  return { valid: true, reason: '' };
}

function invalidCheck(reason) {
  return { valid: false, reason };
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function freezeValidation(validation) {
  deepFreeze(validation);
  return validation;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

module.exports = {
  applyRouteValidation,
  buildSafeValidationRoute,
  isSafeNoMatchRoute,
  normalizeConcept,
  normalizeTopic,
  validateRouteAgainstContract
};
