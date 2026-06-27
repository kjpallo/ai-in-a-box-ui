const { isFillInTheBlankPrompt } = require('../../../router/fillInBlank');
const {
  buildFlashcardDeck,
  buildLearningShapeAnswer
} = require('../../learningShapeBuilder');
const {
  buildImageRequestMetadata,
  detectAnswerRepresentationIntent
} = require('../../../router/answerIntent');
const vocabulary = require('./vocabulary');

const GENERAL_VOCAB_TERMS = [
  'balanced force',
  'balanced forces',
  'coefficient of friction',
  'displacement',
  'distance',
  'free-body diagram',
  'free body diagram',
  'friction',
  'frictional force',
  'gravity',
  'inertia',
  'net force',
  'normal force',
  'scalar',
  'unbalanced force',
  'unbalanced forces',
  'vector',
  'weight'
];

function tryMotionForceKnowledge(message, options = {}) {
  const raw = String(message || '');
  const text = normalize(message);
  if (!text || (looksNumericOrFormulaBased(text) && !allowsConceptualNumberedForceQuestion(text))) return null;

  const clozeAnswer = answerClozeQuestion(text, raw);
  if (clozeAnswer) return clozeAnswer;

  const learningShapeAnswer = answerLearningShapeQuestion(text);
  if (learningShapeAnswer) return learningShapeAnswer;

  const graphAnswer = answerGraphQuestion(text);
  if (graphAnswer) return graphAnswer;

  const localCueAnswer = answerLocalCueQuestion(text);
  if (localCueAnswer) return localCueAnswer;

  const lawAnswer = answerNewtonLawQuestion(text);
  if (lawAnswer) return lawAnswer;

  const conceptAnswer = answerConceptQuestion(text);
  if (conceptAnswer) return conceptAnswer;

  const vocabAnswer = answerVocabQuestion(text, options);
  if (vocabAnswer) return vocabAnswer;

  return null;
}

function buildMotionForceFlashcardDeck(message) {
  return buildFlashcardDeck(message, {
    topics: buildMotionForceLearningTopics()
  });
}

function answerLearningShapeQuestion(text) {
  const representationIntent = detectAnswerRepresentationIntent(text);
  if (!representationIntent.requestedLearningShape) return null;
  if (shouldPreserveExistingMotionForceAnswer(text, representationIntent.requestedLearningShape)) return null;

  const shapeAnswer = buildLearningShapeAnswer(text, {
    requestedLearningShape: representationIntent.requestedLearningShape,
    topics: buildMotionForceLearningTopics()
  });
  if (!shapeAnswer) return null;

  return response(
    shapeAnswer.responseType || 'science_concept',
    shapeAnswer.topicId ? `learning_shape_${shapeAnswer.topicId}_${shapeAnswer.requestedLearningShape}` : `learning_shape_${shapeAnswer.requestedLearningShape}`,
    shapeAnswer.directAnswer,
    { representationIntent }
  );
}

function shouldPreserveExistingMotionForceAnswer(text, requestedLearningShape) {
  if (requestedLearningShape === 'compare_contrast' && isMotionGraphAxisVs(text)) return true;
  if (requestedLearningShape === 'examples_non_examples' && (asksNewtonFirstLawExamples(text) || asksNewtonThirdLawExamples(text))) return true;
  return false;
}

function isMotionGraphAxisVs(text) {
  return /\b(?:distance|position|velocity|speed)\s+(?:vs\.?|versus)\s+time\s+graph\b/.test(text) ||
    (/\b(?:distance|position|velocity|speed)\s+(?:vs\.?|versus)\s*time\b/.test(text) && /\bgraph\b/.test(text));
}

function answerClozeQuestion(text, rawMessage = '') {
  const isBlankPrompt = isFillInTheBlankPrompt(rawMessage);

  if (asksAmbiguousMotionGraphSlopeFragment(text)) {
    return response('cloze_completion', 'ambiguous_motion_graph_slope_cloze', 'If this is a position-time or distance-time graph, the slope equals the object\'s speed or velocity. If this is a velocity-time or speed-time graph, the slope equals acceleration.');
  }

  if (asksSpeedometerInstantaneousSpeed(text)) {
    return response('cloze_completion', 'speedometer_instantaneous_speed_cloze', 'The missing phrase is instantaneous speed. A speedometer shows speed at that moment.');
  }

  if (asksVelocityExampleSpeedDirection(text)) {
    return response('cloze_completion', 'velocity_speed_direction_example_cloze', 'The answer is velocity, because 3 m/s north includes speed and direction.');
  }

  if (asksConstantSpeedAroundTurn(text)) {
    return response('cloze_completion', 'constant_speed_around_turn_cloze', 'The car has a constant speed. Its velocity changes because its direction changes around the turn.');
  }

  if (asksRoundTripDistanceGreaterThanDisplacement(text)) {
    return response('cloze_completion', 'round_trip_distance_greater_than_displacement_cloze', 'Distance is greater than displacement. Riding out and back adds distance, but ending at the starting point makes displacement 0.');
  }

  if (asksObjectInMotionChangePosition(text)) {
    return response('cloze_completion', 'motion_change_position_cloze', 'The missing word is position. An object in motion is changing position compared with a reference point.');
  }

  if (asksRedLightAccelerationSigns(text)) {
    return response('cloze_completion', 'red_light_acceleration_signs_cloze', 'The car slowing down has negative acceleration; when it speeds up after the light turns green, its acceleration is positive.');
  }

  if (isBlankPrompt && asksConstantSpeedChangingDirectionBlank(text)) {
    return response('cloze_completion', 'constant_speed_accelerating_changing_direction_cloze', 'The missing word is direction. An object can move at a constant speed and still accelerate if it is changing direction.');
  }

  if (isBlankPrompt && asksReferencePointBlank(text)) {
    return response('cloze_completion', 'reference_point_cloze', 'The missing phrase is reference point.');
  }

  if (isBlankPrompt && asksVelocityDirectionBlank(text)) {
    return response('cloze_completion', 'velocity_specific_direction_cloze', 'The missing word is direction. Velocity is speed in a specific direction.');
  }

  if (/\bmotion\s+occurs\b.*\bchanges?\s+its\b/.test(text) ||
    /\bobject\s+changes?\s+its\b/.test(text) && has(text, 'motion')) {
    return response('cloze_completion', 'motion_change_in_position_cloze', 'Motion occurs when an object changes its position.');
  }

  if (/\b(?:object|it)\s+slows?\s+down\b.*\bhas\s+a\b/.test(text) ||
    /\bwhen\s+an?\s+object\s+slows?\s+down\b/.test(text)) {
    return response('cloze_completion', 'slowing_down_negative_acceleration_cloze', 'When an object slows down, it has negative acceleration, often called deceleration.');
  }

  if (asksWhyFirstLawIsLawOfInertia(text)) {
    return response('science_concept', 'newtons_first_law_inertia_name_reason', 'Newton’s 1st Law is called the Law of Inertia because inertia is an object’s tendency to resist changes in motion. The law says objects keep doing what they are doing unless an unbalanced force acts on them.');
  }

  if (/\bknown\s+as\s+(?:the\s+)?law\s+of\s+inertia\b/.test(text) ||
    /\blaw\s+of\s+inertia\b/.test(text) && !hasDefinitionIntent(text)) {
    return response('cloze_completion', 'law_of_inertia_newtons_first_law_cloze', 'Newton’s First Law is known as the Law of Inertia.');
  }

  return null;
}

function asksAmbiguousMotionGraphSlopeFragment(text) {
  if (mentionsSpecificMotionGraph(text)) return false;

  return /\bslope\s+of\s+(?:the\s+)?line\s+equals\s+(?:the\s+)?objects?\b/.test(text) ||
    /\bslope\s+equals\s+(?:the\s+)?objects?\b/.test(text);
}

function asksConstantSpeedChangingDirectionBlank(text) {
  return hasAll(text, ['constant speed', 'accelerating']) &&
    /\bchang(?:e|es|ing)\b/.test(text) &&
    !has(text, 'direction');
}

function asksReferencePointBlank(text) {
  return /\b(?:dependent|depends?|compared|relative)\b.*\bpoint\b/.test(text) &&
    !has(text, 'reference point');
}

function asksVelocityDirectionBlank(text) {
  return has(text, 'velocity') &&
    has(text, 'speed') &&
    /\bspecific\b|\bwith\b|\bincludes?\b/.test(text) &&
    !has(text, 'direction');
}

function answerGraphQuestion(text) {
  if (!has(text, 'graph')) return null;

  if (has(text, 'distance time') || has(text, 'distance-time') || (has(text, 'distance') && has(text, 'time'))) {
    if (hasAny(text, ['flat line', 'horizontal line'])) {
      return response('graph_concept', 'distance_time_flat_line', 'On a distance-time graph, a flat line means the distance is not changing, so the object is stopped.');
    }
    if (has(text, 'constant slope') || (has(text, 'straight line') && has(text, 'slope'))) {
      return response('graph_concept', 'distance_time_constant_slope', 'On a distance-time graph, a straight line with constant slope means constant speed. The speed stays the same.');
    }
    if (has(text, 'slope')) {
      return response('graph_concept', 'distance_time_slope', 'On a distance-time graph, slope means speed. A steeper slope means a greater speed.');
    }
    if (hasAny(text, ['steeper', 'getting steeper'])) {
      return response('graph_concept', 'distance_time_steeper', 'On a distance-time graph, getting steeper means the object is speeding up.');
    }
    if (hasAny(text, ['flattening', 'less steep'])) {
      return response('graph_concept', 'distance_time_flattening', 'On a distance-time graph, flattening means the object is slowing down.');
    }
  }

  if (has(text, 'velocity time') || has(text, 'velocity-time') || has(text, 'speed time') || has(text, 'speed-time') ||
    ((has(text, 'velocity') || has(text, 'speed')) && has(text, 'time'))) {
    if (hasAll(text, ['greatest rate of change', 'velocity']) || hasAll(text, ['greatest', 'slope']) || hasAll(text, ['steepest', 'section'])) {
      return response('graph_concept', 'velocity_time_greatest_rate_of_change', 'On a velocity-time graph, the greatest rate of change of velocity is the steepest section, the section with the greatest slope.');
    }
    if (has(text, 'zero acceleration') && hasAny(text, ['which car', 'which object', 'which line'])) {
      return response('graph_concept', 'velocity_time_zero_acceleration_line', 'The car with zero acceleration is the one with the horizontal line or flat line, because its velocity is constant.');
    }
    if (has(text, 'positive acceleration') || hasAny(text, ['upward line', 'increasing line', 'line going up'])) {
      return response('graph_concept', 'speed_velocity_time_positive_acceleration', 'On a speed-time or velocity-time graph, positive acceleration is shown by an upward or increasing line.');
    }
    if (has(text, 'negative acceleration') || hasAny(text, ['downward line', 'decreasing line', 'line going down'])) {
      return response('graph_concept', 'speed_velocity_time_negative_acceleration', 'On a speed-time or velocity-time graph, negative acceleration is shown by a downward or decreasing line.');
    }
    if (has(text, 'slope')) {
      return response('graph_concept', 'velocity_time_slope', 'On a velocity-time graph, slope means acceleration.');
    }
    if (hasAny(text, ['flat line', 'horizontal line'])) {
      return response('graph_concept', 'velocity_time_flat_line', 'On a velocity-time graph, a flat line means constant velocity, so acceleration is 0.');
    }
  }

  return null;
}

function answerLocalCueQuestion(text) {
  if (asksAirResistanceFactorsQuestion(text)) {
    return response('science_concept', 'air_resistance_factors', 'Air resistance is affected by speed, shape/frontal area/surface area, and air or fluid conditions such as density. A factor outside those, such as mass by itself, would not be the best answer for “does not affect air resistance” unless your answer choices say otherwise.');
  }

  if (asksFreeFallConstantAcceleration(text)) {
    return response('cloze_completion', 'free_fall_constant_acceleration_cloze', 'The answer is acceleration. An object in free fall has constant acceleration due to gravity, about 9.8 m/s² downward near Earth.');
  }

  if (asksNewtonFirstLawConstantVelocityCue(text)) {
    return response('law_identification', 'newton_first_law_constant_velocity_cue', 'That is Newton’s First Law, also called the law of inertia: an object keeps a constant velocity unless an unbalanced force acts on it.');
  }

  if (asksMomentumClassroomForceNeededCue(text)) {
    return response('definition', 'momentum_classroom_force_needed_cue', 'For this classroom matching key, the answer is momentum. Momentum is related to how much force is needed to change an object’s motion because it depends on mass and velocity. Keep the distinction: “tendency to resist changes in motion” is inertia.');
  }

  if (asksBowlingBallAccelerationExplanation(text)) {
    return response('law_identification', 'newton_second_law_bowling_ball_acceleration', 'Newton’s Second Law explains this. For the same acceleration, force = mass × acceleration, so the bowling ball needs more force than the tennis ball because the bowling ball has more mass.');
  }

  if (asksTrampolineThirdLawExplanation(text)) {
    return response('law_identification', 'newton_third_law_trampoline', 'A trampoline works by Newton’s Third Law. The person pushes down on the trampoline, and the trampoline pushes up on the person with an equal and opposite force.');
  }

  if (asksChairSupportNormalForce(text)) {
    return response('science_concept', 'chair_support_normal_force', 'The chair exerts an 800 N upward normal force, also called a support force, to balance the man’s 800 N weight downward.');
  }

  if (asksFrictionFactorsAndTypes(text)) {
    return response('science_concept', 'friction_factors_and_types', [
      'Friction depends on the roughness or type of surface, the force pressing the surfaces together (normal force), and, for this class key, the amount of surface area in contact.',
      frictionTypesListAnswer()
    ].join('\n'));
  }

  if (asksNewtonSecondLawRelationshipCloze(text)) {
    return response('law_identification', 'newton_second_law_relationship_cloze', 'The missing answer is Newton’s Second Law. It explains the relationship among force, mass, and acceleration: F = m × a.');
  }

  if (asksFallingObjectUpwardForceCloze(text)) {
    return response('cloze_completion', 'air_resistance_upward_falling_object_cloze', 'The missing phrase is air resistance.');
  }

  if (asksGreaterForceGreaterAccelerationCloze(text)) {
    return response('cloze_completion', 'greater_force_greater_acceleration_cloze', 'The missing word is acceleration.');
  }

  if (asksGravityDependsOnMassesAndDistanceCloze(text)) {
    return response('cloze_completion', 'gravity_depends_on_masses_distance_cloze', 'The missing phrase is masses and distance between them.');
  }

  if (asksBalancedForcesEqualOppositeCloze(text)) {
    return response('cloze_completion', 'balanced_forces_equal_opposite_cloze', 'The missing word is balanced. Equal and opposite forces on the same object are balanced forces.');
  }

  if (asksForceCueDefinition(text)) {
    return response('definition', 'force_cue_definition', 'A force is a push or pull one body exerts on another.');
  }

  if (asksTerminalVelocityCueDefinition(text)) {
    return response('definition', 'terminal_velocity_cue_definition', 'Terminal velocity is the highest velocity a falling object reaches when air resistance balances gravity.');
  }

  if (asksInertiaCueDefinition(text)) {
    return response('definition', 'inertia_cue_definition', 'Inertia is the tendency of an object to resist changes in motion.');
  }

  if (asksGravityCueDefinition(text)) {
    return response('definition', 'gravity_cue_definition', 'Gravity is the attraction any two objects with mass have on one another.');
  }

  return null;
}

function asksNewtonSecondLawRelationshipCloze(text) {
  return hasAll(text, ['relationship', 'mass', 'force', 'acceleration']) &&
    /\bexplained\s+by\b/.test(text);
}

function asksFallingObjectUpwardForceCloze(text) {
  return hasAll(text, ['upward force', 'falling', 'air']);
}

function asksGreaterForceGreaterAccelerationCloze(text) {
  return has(text, 'force') &&
    /\bgreater\b.*\bforce\b.*\bgreater\b/.test(text) &&
    /\bappl(?:y|ied|ies|i?ed)\b/.test(text);
}

function asksGravityDependsOnMassesAndDistanceCloze(text) {
  return has(text, 'gravitational force') &&
    has(text, 'between two objects') &&
    /\bdepends?\s+on\b/.test(text);
}

function asksBalancedForcesEqualOppositeCloze(text) {
  return hasAll(text, ['two forces', 'same object', 'equal', 'opposite']) &&
    /\bcalled\b.*\bforces\b/.test(text);
}

function asksForceCueDefinition(text) {
  return /\bpush\s+or\s+pull\b.*\b(?:body|object)\s+exerts?\s+on\s+another\b/.test(text);
}

function asksTerminalVelocityCueDefinition(text) {
  return hasAll(text, ['highest velocity', 'falling object']) ||
    hasAll(text, ['maximum velocity', 'falling object']);
}

function asksInertiaCueDefinition(text) {
  return /\btendency\b.*\b(?:object|body)\b.*\bresist\b.*\bchanges?\s+in\s+motion\b/.test(text);
}

function asksGravityCueDefinition(text) {
  return /\battraction\b.*\b(?:any\s+)?two\s+objects\b.*\bone\s+another\b/.test(text);
}

function asksSpeedometerInstantaneousSpeed(text) {
  return has(text, 'speedometer') && has(text, 'speed');
}

function asksVelocityExampleSpeedDirection(text) {
  return /\b\d+(?:\.\d+)?\s*(?:m\/s|meters?\s+per\s+second|mi\/hr|mph|km\/hr|km\/h)\s+(?:north|south|east|west|northeast|northwest|southeast|southwest)\b/.test(text) &&
    hasAny(text, ['example of', 'is an example', 'is a']);
}

function asksConstantSpeedAroundTurn(text) {
  return has(text, 'turn') &&
    hasAny(text, ['constant', 'whole time', 'same speed']) &&
    /\b\d+(?:\.\d+)?\s*(?:mi\/hr|mph|km\/hr|km\/h|m\/s)\b/.test(text);
}

function asksRoundTripDistanceGreaterThanDisplacement(text) {
  return has(text, 'distance') &&
    has(text, 'displacement') &&
    hasAny(text, ['turn around', 'starting point', 'start point', 'back to your start']);
}

function asksObjectInMotionChangePosition(text) {
  return /\bobject\s+in\s+motion\b/.test(text) &&
    /\bchange\s+of\b/.test(text);
}

function asksRedLightAccelerationSigns(text) {
  return has(text, 'red traffic light') &&
    has(text, 'acceleration') &&
    hasAny(text, ['slowing down', 'slows down']) &&
    hasAny(text, ['green', 'speeds up']);
}

function asksAirResistanceFactorsQuestion(text) {
  return has(text, 'air resistance') &&
    hasAny(text, ['factor', 'factors', 'affect', 'affects']) &&
    (/\bdoes\s+not\s+affect\b/.test(text) || /\bdo(?:es)?\s+affect\b/.test(text) || /\bwhat\s+affects\b/.test(text));
}

function asksFreeFallConstantAcceleration(text) {
  return /\bobject\b.*\bfalling\s+freely\b.*\bconstant\s+what\b/.test(text) ||
    /\bfalling\s+freely\b.*\bhas\s+a\s+constant\b/.test(text) ||
    /\bfree\s+fall\b.*\bconstant\s+(?:what|is)\b/.test(text);
}

function asksNewtonFirstLawConstantVelocityCue(text) {
  return /\bobject\b.*\b(?:move|moves|moving)\b.*\bconstant\s+velocity\b.*\bunless\b.*\bunbalanced\s+force\b/.test(text);
}

function asksMomentumClassroomForceNeededCue(text) {
  return /\brelated\s+to\s+the\s+amount\s+of\s+force\s+needed\s+to\s+change\b/.test(text) &&
    /\bobject(?:\s+s|s)?\s+motion\b/.test(text);
}

function asksBowlingBallAccelerationExplanation(text) {
  return hasAll(text, ['bowling ball', 'tennis ball']) &&
    /\baccelerat(?:e|es|ing|ion)\b/.test(text) &&
    hasAny(text, ['why', 'more effort', 'more force', 'which law', 'law explains']);
}

function asksTrampolineThirdLawExplanation(text) {
  return has(text, 'trampoline') &&
    hasAny(text, ['how does', 'how do', 'work', 'works', 'which law', 'law explains', 'include which law']);
}

function asksChairSupportNormalForce(text) {
  return has(text, 'chair') &&
    hasAny(text, ['support', 'supporting']) &&
    hasAny(text, ['weighing', 'weight', '800 n', '800 newtons']) &&
    hasAny(text, ['what force', 'force is the chair', 'chair exerting']);
}

function asksFrictionFactorsAndTypes(text) {
  return has(text, 'friction') &&
    hasAny(text, ['factor', 'factors', 'affect', 'depends']) &&
    hasAny(text, ['3 types', 'three types', 'types of friction', 'list the']);
}

function answerNewtonLawQuestion(text) {
  if (asksNewtonThreeLawsList(text)) {
    return response('science_concept', 'newtons_three_laws', [
      '1. First law / inertia — An object at rest stays at rest and an object in motion stays in motion unless acted on by an unbalanced force.',
      '2. Second law — Force equals mass times acceleration, F = m × a.',
      '3. Third law — For every action force, there is an equal and opposite reaction force.'
    ].join('\n'), representationOptions(text));
  }

  if (!/\b(?:what|which)\s+(?:newton\s*)?law\b/.test(text) && !/\bnewton(?:\s*s|'s|s)?\s+law\b/.test(text)) return null;

  if (has(text, 'trampoline')) {
    return response('law_identification', 'newton_third_law_trampoline', 'That is Newton’s Third Law: the person pushes down on the trampoline, and the trampoline pushes up on the person with an equal and opposite force.');
  }

  if (hasThirdLawActionReactionPhrase(text)) {
    return response('law_identification', 'newton_third_law_action_reaction_phrase', 'That statement is Newton’s Third Law: for every action force, there is an equal and opposite reaction force.');
  }

  if (hasAny(text, ['pushes water back', 'moves forward', 'action reaction', 'equal and opposite', 'balloon', 'rocket'])) {
    return response('law_identification', 'newton_third_law_scenario', 'That is Newton\'s third law: the swimmer pushes water backward, and the water pushes the swimmer forward.');
  }

  if (hasAny(text, ['seatbelt', 'keeps moving', 'stays at rest', 'stays in motion', 'stays on the floor', 'until someone picks', 'inertia'])) {
    return response('law_identification', 'newton_first_law_scenario', 'That is Newton\'s first law: objects resist changes in motion unless an unbalanced force acts.');
  }

  if (hasAll(text, ['force', 'mass', 'acceleration'])) {
    return response('law_identification', 'newton_second_law_concept', 'That is Newton\'s second law: acceleration depends on net force and mass.');
  }

  return null;
}

function answerConceptQuestion(text) {
  const concept3Answer = answerConcept3Question(text);
  if (concept3Answer) return concept3Answer;

  if (asksCarouselAccelerationDirection(text)) {
    return response('science_concept', 'carousel_acceleration_direction_change', 'The horses are accelerating because their direction is constantly changing, even if their speed stays the same.');
  }

  if (asksZeroAccelerationConstantMotion(text)) {
    return response('science_concept', 'zero_acceleration_constant_motion', 'An object with zero acceleration could be moving at a constant speed or constant velocity. Zero acceleration means velocity is not changing.');
  }

  if (asksVelocityCanChangeAtConstantSpeed(text)) {
    return response('science_concept', 'velocity_changes_constant_speed_direction', 'Yes. Velocity includes speed and direction, so a car’s velocity can change at constant speed if it is changing direction.');
  }

  if (asksThreeWaysToAccelerate(text)) {
    return response('science_concept', 'three_ways_to_accelerate', 'An object can accelerate in three ways: speed up, slow down, or change direction.');
  }

  if (asksMotionDescriptionSummary(text)) {
    return response('science_concept', 'motion_description_measurement_summary', 'Motion is described by comparing an object’s position to a reference point. Distance is the total path traveled, while displacement is the straight-line change from start to finish with direction. Speed tells how fast something moves; average speed is total distance divided by total time, and instantaneous speed is speed at one moment. Velocity is speed in a specific direction. Acceleration means velocity changes by speeding up, slowing down, or changing direction. Motion graphs help measure motion: slope on a distance-time graph shows speed, and slope on a speed-time or velocity-time graph shows acceleration.');
  }

  if (has(text, 'law of universal gravitation') || has(text, 'universal gravity law') || has(text, 'universal gravitation')) {
    return response('definition', 'law_of_universal_gravitation', 'Newton’s Law of Universal Gravitation says every object with mass attracts every other object with mass. The force of gravity gets stronger when masses are larger and weaker when objects are farther apart. Formula: F = G(m1 × m2) / r².');
  }

  if (has(text, 'law of conservation of momentum') || has(text, 'conservation of momentum') || has(text, 'momentum conservation')) {
    return response('definition', 'law_of_conservation_of_momentum', 'The law of conservation of momentum says the total momentum of a system stays the same unless an outside force acts on it. In a collision, momentum before = momentum after, if outside forces are ignored.');
  }

  if (asksConservationLawsList(text)) {
    return response('science_concept', 'conservation_laws_common_list', [
      'The main conservation laws you may see are listed below. The one this class currently has the strongest local fact for is conservation of momentum.',
      '',
      '1. Conservation of momentum — total momentum stays the same in a closed system.',
      '2. Conservation of energy — energy is not created or destroyed, only transferred or transformed.',
      '3. Conservation of mass/matter — matter is not created or destroyed in a closed system.'
    ].join('\n'), representationOptions(text));
  }

  if (has(text, 'air resistance') || has(text, 'air drag') || has(text, 'drag')) {
    return response('definition', 'air_resistance_vocab', 'Air resistance is a force that opposes the motion of an object moving through air. It acts opposite the object’s motion and gets larger when speed or surface area increases. As an object falls faster, air resistance increases until it can balance gravity at terminal velocity.');
  }

  if (hasBalancedUnbalancedComparisonIntent(text)) {
    return response('science_concept', 'balanced_unbalanced_forces_comparison', 'Balanced forces have a net force of 0 N and do not change an object’s motion. Unbalanced forces have a nonzero net force and can change an object’s speed, direction, or both.');
  }

  if (asksForForcesOnObjectAtRest(text)) {
    return response('science_concept', 'object_at_rest_balanced_forces', 'Yes. An object at rest can have forces acting on it if the forces are balanced. The net force is 0 N, so its motion does not change.');
  }

  if (asksNetForceFromBalancedForces(text)) {
    return response('science_concept', 'balanced_forces_net_force_zero', 'The net force is 0 N when forces are balanced.');
  }

  if ((has(text, 'acceleration') || /\baccelerat(?:e|es|ing)\b/.test(text)) && hasAny(text, ['what is', 'mean', 'explain', 'concept'])) {
    return response('science_concept', 'acceleration_concept', 'An object accelerates when its velocity changes. That can happen when it speeds up, slows down, or changes direction.');
  }

  if (has(text, 'motion') && hasDefinitionIntent(text)) {
    return response('definition', 'motion_change_in_position', 'Motion is a change in an object’s position compared with a reference point.');
  }

  if (asksReferencePointImportance(text)) {
    return response('science_concept', 'reference_point_importance', 'Reference points are important because they let you describe position and motion by comparing an object to a place or object. If the object’s position changes compared with the reference point, you can tell it moved.');
  }

  if (asksReferencePointExample(text)) {
    return response('science_concept', 'reference_point_example', 'A reference point could be a tree, door, desk, or sign. For example, you can say a student moved if their position changed compared with the classroom door.');
  }

  if (has(text, 'reference point') && hasReferencePointDefinitionIntent(text)) {
    return response('definition', 'reference_point_vocab', 'A reference point is the place or object used to tell whether something has changed position.');
  }

  if (has(text, 'negative acceleration') || has(text, 'deceleration')) {
    return response('science_concept', 'negative_acceleration_deceleration', 'Negative acceleration often means an object is slowing down. This is commonly called deceleration.');
  }

  if (has(text, 'inertia') && hasDefinitionIntent(text)) {
    return response('definition', 'inertia_vocab', 'Inertia is an object’s resistance to a change in motion. More mass means more inertia.');
  }

  if (has(text, 'speed') && has(text, 'velocity') && hasAny(text, ['difference', 'different', 'compare'])) {
    return response('science_concept', 'speed_velocity_difference', 'Speed tells how fast something moves. Velocity tells speed plus direction, like 10 m/s north.');
  }

  if (has(text, 'distance') && has(text, 'displacement') && hasAny(text, ['difference', 'different', 'compare'])) {
    return response('definition', 'distance_displacement_difference', 'Distance is the total path traveled. Displacement is the straight-line change from start to finish and includes direction.');
  }

  if (has(text, 'terminal velocity')) {
    return response('science_concept', 'terminal_velocity', 'Terminal velocity is the constant falling speed reached when air resistance balances gravity.');
  }

  if (hasAny(text, ['flat paper', 'crumpled paper', 'paper fall']) && hasAny(text, ['slower', 'faster', 'fall'])) {
    return response('science_concept', 'air_resistance_paper_shape', 'A flat paper falls slower because it has more surface area, so air resistance pushes up on it more than on a crumpled paper.');
  }

  if (has(text, 'grass') && hasAny(text, ['slow', 'slows']) && hasAny(text, ['soccer ball', 'ball'])) {
    return response('science_concept', 'grass_slows_ball', 'Grass slows a soccer ball because friction acts opposite the ball\'s motion.');
  }

  if (has(text, 'book') && has(text, 'sliding') && hasAny(text, ['friction type', 'type of friction', 'what friction'])) {
    return response('science_concept', 'sliding_friction_book', 'A book sliding on a desk has sliding friction, because the surfaces are sliding past each other.');
  }

  if (asksFrictionSubtypeDefinition(text)) {
    return answerFrictionSubtypeDefinition(text);
  }

  if (asksFrictionTypes(text)) {
    return response('science_concept', 'friction_types', frictionTypesListAnswer(), representationOptions(text));
  }

  if (has(text, 'rank') && has(text, 'inertia')) {
    return response('science_concept', 'rank_by_inertia', 'Rank inertia by mass. From least to greatest for those objects: feather, baseball, bicycle, car.');
  }

  if (has(text, 'momentum') && hasAny(text, ['concept', 'mean', 'what is']) && !hasSimpleGeneralVocabQuestion(text, 'momentum')) {
    return response('science_concept', 'momentum_concept', 'Momentum depends on mass and velocity. A heavier or faster moving object is harder to stop.');
  }

  return null;
}

function answerConcept3Question(text) {
  if (hasBalancedUnbalancedComparisonIntent(text)) {
    return response('science_concept', 'balanced_unbalanced_forces_comparison', 'Balanced forces cancel to net force 0 and do not change motion; unbalanced forces create a nonzero net force and can change motion.');
  }

  if (asksNetForceFromBalancedForces(text)) {
    return response('science_concept', 'balanced_forces_net_force_zero', 'The net force is 0 N when forces are balanced.');
  }

  if (asksForceDefinition(text)) {
    return response('definition', 'force_concept_3_vocab', 'A force is a push or pull one object exerts on another. It is measured in newtons and can change an object’s motion.');
  }

  if (asksNetForceDefinition(text)) {
    return response('definition', 'net_force_concept_3_vocab', 'Net force is the combined/overall force on an object after all forces are added together.');
  }

  if (asksBalancedForceDefinition(text)) {
    return response('definition', 'balanced_force_concept_3_vocab', 'Balanced forces are equal in size and opposite in direction, so net force is 0 and motion does not change.');
  }

  if (asksUnbalancedForceDefinition(text)) {
    return response('definition', 'unbalanced_force_concept_3_vocab', 'Unbalanced forces do not cancel. Net force is not 0, so they can change speed, direction, or motion.');
  }

  if (asksForForcesThatChangeMotion(text)) {
    return response('science_concept', 'unbalanced_net_forces_change_motion', 'Unbalanced or net forces change motion. They can make an object start moving, stop, speed up, slow down, or change direction.');
  }

  if (asksFrictionSubtypeDefinition(text)) {
    return answerFrictionSubtypeDefinition(text);
  }

  if (asksFrictionDefinition(text)) {
    return response('definition', 'friction_concept_3_vocab', 'Friction is a force that resists motion when surfaces rub, slide, or roll against each other.');
  }

  if (asksFrictionFactors(text)) {
    return response('science_concept', 'friction_factors', 'Friction depends on the roughness of the surfaces, the force pressing the surfaces together, and the surface area or contact area.');
  }

  if (asksFrictionTypes(text)) {
    return response('science_concept', 'friction_types', frictionTypesListAnswer(), representationOptions(text));
  }

  if (has(text, 'air resistance') || has(text, 'air drag') || has(text, 'drag')) {
    return response('definition', 'air_resistance_vocab', 'Air resistance is drag, a force that resists motion through air and acts opposite the object’s motion.');
  }

  if (has(text, 'law of universal gravitation') || has(text, 'universal gravity law') || has(text, 'universal gravitation')) {
    return response('definition', 'law_of_universal_gravitation', 'Newton’s Law of Universal Gravitation says any two masses attract each other. More mass means more gravity, and less distance means stronger gravitational attraction.');
  }

  if (has(text, 'terminal velocity')) {
    return response('science_concept', 'terminal_velocity', 'Terminal velocity is the maximum velocity a falling object reaches when gravity and air resistance balance, so net force is 0 and acceleration is 0.');
  }

  if (asksMassWeightComparison(text)) {
    return response('definition', 'mass_weight_difference_concept_3', 'Mass is the amount of matter in an object. Weight is the force of gravity on an object, so weight can change based on location or gravity.');
  }

  if (asksNewtonFirstLawExamples(text)) {
    return response('science_concept', 'newtons_first_law_examples', 'Newton’s 1st Law is the law of inertia: objects resist changes in motion unless an unbalanced force acts. Examples: a seatbelt stops you from continuing forward when a car stops suddenly, a book stays still until pushed, and a moving object keeps moving until friction or another force slows it.');
  }

  if (asksNewtonThirdLawExamples(text)) {
    return response('science_concept', 'newtons_third_law_examples', 'Newton’s 3rd Law says every action has an equal and opposite reaction. Examples: when you jump on a trampoline, you push down and the trampoline pushes you up; a paddle pushes water backward and the board moves forward; a hose can push backward as water shoots out.');
  }

  if (asksMomentumNewtonThirdLawRelationship(text)) {
    return response('science_concept', 'momentum_newtons_third_law_relationship', 'In a collision, forces between objects are equal and opposite, so momentum is transferred between objects. Momentum is conserved in a collision; it is not created or destroyed, only transferred.');
  }

  return null;
}

function hasBalancedUnbalancedComparisonIntent(text) {
  return has(text, 'balanced') &&
    has(text, 'unbalanced') &&
    (hasAny(text, ['affect', 'effect', 'different', 'differently', 'compare', 'contrast', 'explain', 'vs', 'versus']) || has(text, 'motion'));
}

function asksMotionDescriptionSummary(text) {
  return hasAny(text, ['summarize', 'summary']) &&
    has(text, 'motion') &&
    hasAny(text, ['describe', 'described']) &&
    hasAny(text, ['measure', 'measured']);
}

function asksCarouselAccelerationDirection(text) {
  return hasAny(text, ['carousel', 'merry go round']) &&
    /\baccelerat(?:e|es|ing|ion)\b/.test(text);
}

function asksZeroAccelerationConstantMotion(text) {
  return has(text, 'zero acceleration') &&
    hasAny(text, ['could be true', 'which statement', 'what could']);
}

function asksVelocityCanChangeAtConstantSpeed(text) {
  return has(text, 'velocity') &&
    has(text, 'speed') &&
    hasAny(text, ['constant', 'same']) &&
    /\bcan\b.*\bvelocity\b.*\bchange\b|\bvelocity\b.*\bchange\b/.test(text);
}

function asksThreeWaysToAccelerate(text) {
  return /\b(?:3|three)\b/.test(text) &&
    hasAny(text, ['ways', 'specific ways']) &&
    /\baccelerat(?:e|es|ing|ion)\b/.test(text);
}

function asksForForcesOnObjectAtRest(text) {
  return /\bcan\s+there\s+be\s+forces?\s+acting\s+on\s+an?\s+object\s+at\s+rest\b/.test(text) ||
    /\bforces?\s+acting\s+on\s+an?\s+object\s+at\s+rest\b/.test(text);
}

function asksNetForceFromBalancedForces(text) {
  return has(text, 'net force') &&
    has(text, 'balanced forces') &&
    /\b(?:what|find|determine|calculate)\b/.test(text);
}

function answerVocabQuestion(text) {
  if (!hasDefinitionIntent(text)) return null;
  if (GENERAL_VOCAB_TERMS.some((term) => has(text, term))) return null;

  if (has(text, 'terminal velocity')) {
    return response('definition', 'terminal_velocity_vocab', 'Terminal velocity is the constant falling speed reached when air resistance balances gravity.');
  }

  if (hasSimpleGeneralVocabQuestion(text, 'speed')) {
    return response('definition', 'speed_vocab', 'Speed tells how fast something moves; it is distance divided by time.');
  }

  if (hasSimpleGeneralVocabQuestion(text, 'velocity')) {
    return response('definition', 'velocity_vocab', 'Velocity is speed in a specific direction.');
  }

  if (has(text, 'air resistance') || has(text, 'drag')) {
    return response('definition', 'air_resistance_vocab', 'Air resistance is a force that opposes the motion of an object moving through air. It acts opposite the object’s motion and gets larger when speed or surface area increases. As an object falls faster, air resistance increases until it can balance gravity at terminal velocity.');
  }

  if (has(text, 'sliding friction')) {
    return response('definition', 'sliding_friction_vocab', 'Sliding friction is friction between surfaces that are sliding past each other.');
  }

  if (has(text, 'rolling friction')) {
    return response('definition', 'rolling_friction_vocab', 'Rolling friction is friction on an object that rolls over a surface.');
  }

  if (has(text, 'static friction')) {
    return response('definition', 'static_friction_vocab', 'Static friction is friction that keeps an object from starting to move.');
  }

  return null;
}

function looksNumericOrFormulaBased(text) {
  return /\d/.test(text) ||
    /\bacceleration\s+due\s+to\s+gravity\b/.test(text) ||
    /\b(?:find|calculate|solve|determine|formula|equation|how much|how many|from rest|comes to a stop)\b/.test(text) ||
    /\b(?:meters?|miles?|kilometers?|feet|seconds?|hours?|newtons?|kg|grams?|m\/s|m\/s2|m\/s\^2|m\/s²|n|joules?)\b/.test(text) ||
    /(?:=|μ|µ|\bf\s*=|\ba\s*=|\bv\s*=|\bp\s*=|\bw\s*=)/.test(text);
}

function allowsConceptualNumberedForceQuestion(text) {
  return asksWhyFirstLawIsLawOfInertia(text) ||
    asksVelocityExampleSpeedDirection(text) ||
    asksConstantSpeedAroundTurn(text) ||
    asksRoundTripDistanceGreaterThanDisplacement(text) ||
    asksThreeWaysToAccelerate(text) ||
    asksFrictionFactors(text) ||
    asksFrictionFactorsAndTypes(text) ||
    asksNewtonThreeLawsList(text) ||
    asksConservationLawsList(text) ||
    asksNewtonFirstLawExamples(text) ||
    asksNewtonThirdLawExamples(text) ||
    asksMomentumNewtonThirdLawRelationship(text) ||
    asksBowlingBallAccelerationExplanation(text) ||
    asksChairSupportNormalForce(text);
}

function asksWhyFirstLawIsLawOfInertia(text) {
  return /\bwhy\b.*\b(?:newton(?:\s*s|'s|s)?\s*)?(?:1st|first)\s+law\b.*\bknown\s+as\s+(?:the\s+)?law\s+of\s+inertia\b/.test(text);
}

function hasDefinitionIntent(text) {
  return /\b(?:what is|what's|define|meaning of|what does|explain)\b/.test(text);
}

function hasReferencePointDefinitionIntent(text) {
  return hasDefinitionIntent(text) || /\b(?:describe|summarize|definition of)\b/.test(text);
}

function asksReferencePointImportance(text) {
  return hasReferencePointTerm(text) &&
    /\bwhy\b.*\b(?:important|matter|useful|needed)\b/.test(text);
}

function asksReferencePointExample(text) {
  return hasReferencePointTerm(text) &&
    /\b(?:example|for example)\b/.test(text);
}

function hasReferencePointTerm(text) {
  return has(text, 'reference point') || has(text, 'reference points');
}

function hasSimpleGeneralVocabQuestion(text, term) {
  return has(text, term) && /^(?:what is|what's|define|meaning of)\s+/.test(text);
}

function asksForceDefinition(text) {
  return hasDefinitionIntent(text) &&
    has(text, 'force') &&
    !hasAny(text, ['net force', 'balanced force', 'unbalanced force', 'friction', 'normal force', 'force of gravity']);
}

function asksNetForceDefinition(text) {
  return hasDefinitionIntent(text) && has(text, 'net force');
}

function asksBalancedForceDefinition(text) {
  return (hasDefinitionIntent(text) || /\bwhat\s+are\b/.test(text)) &&
    (hasAny(text, ['balanced force', 'balanced forces']) ||
      /\bwhat\s+does\s+balanced\s+mean\s+in\s+science\b/.test(text));
}

function asksUnbalancedForceDefinition(text) {
  return (hasDefinitionIntent(text) || /\bwhat\s+are\b/.test(text)) &&
    hasAny(text, ['unbalanced force', 'unbalanced forces']);
}

function asksForForcesThatChangeMotion(text) {
  return hasAny(text, ['force', 'forces']) &&
    has(text, 'change') &&
    has(text, 'motion') &&
    hasAny(text, ['what kinds', 'what type', 'what types', 'which']);
}

function asksFrictionDefinition(text) {
  return hasDefinitionIntent(text) &&
    has(text, 'friction') &&
    !has(text, 'coefficient of friction') &&
    !hasAny(text, ['charge', 'charging', 'electron', 'electrons', 'electric', 'electricity', 'static electricity']);
}

function asksFrictionFactors(text) {
  return has(text, 'friction') &&
    hasAny(text, ['factor', 'factors', 'depend', 'depends']);
}

function asksFrictionTypes(text) {
  return has(text, 'friction') && hasAny(text, ['type', 'types']);
}

function asksFrictionSubtypeDefinition(text) {
  return hasDefinitionIntent(text) &&
    (has(text, 'rolling friction') || has(text, 'sliding friction') || has(text, 'static friction'));
}

function answerFrictionSubtypeDefinition(text) {
  if (has(text, 'rolling friction')) {
    return response('definition', 'rolling_friction_vocab', 'Rolling friction is friction that resists motion when an object rolls over a surface, like a wheel or ball rolling.', representationOptions(text));
  }

  if (has(text, 'sliding friction')) {
    return response('definition', 'sliding_friction_vocab', 'Sliding friction is friction that resists motion when two surfaces slide past each other.', representationOptions(text));
  }

  if (has(text, 'static friction')) {
    return response('definition', 'static_friction_vocab', 'Static friction is friction that prevents surfaces from starting to slide.', representationOptions(text));
  }

  return null;
}

function frictionTypesListAnswer() {
  return [
    '1. Static friction — keeps objects from starting to slide.',
    '2. Sliding friction — resists surfaces sliding past each other.',
    '3. Rolling friction — resists rolling motion.'
  ].join('\n');
}

function buildMotionForceLearningTopics() {
  const vocab = buildVocabularyIndex();
  const friction = vocab.get('friction');
  const staticFriction = vocab.get('static_friction');
  const slidingFriction = vocab.get('sliding_friction');
  const rollingFriction = vocab.get('rolling_friction');
  const distance = vocab.get('distance');
  const displacement = vocab.get('displacement');
  const speed = vocab.get('speed');
  const velocity = vocab.get('velocity');
  const balanced = vocab.get('balanced_forces');
  const unbalanced = vocab.get('unbalanced_forces');
  const firstLaw = vocab.get('newton_s_1st_law');
  const secondLaw = vocab.get('newton_s_2nd_law');
  const thirdLaw = vocab.get('newton_s_3rd_law');

  return [
    {
      id: 'static_friction',
      title: 'static friction',
      aliases: ['static friction'],
      priority: 8,
      examples: staticFriction?.examples || [staticFriction?.exampleCue].filter(Boolean),
      commonMistakes: compact([staticFriction?.commonMisconception])
    },
    {
      id: 'sliding_friction',
      title: 'sliding friction',
      aliases: ['sliding friction'],
      priority: 8,
      examples: slidingFriction?.examples || [slidingFriction?.exampleCue].filter(Boolean),
      commonMistakes: compact([slidingFriction?.commonMisconception])
    },
    {
      id: 'rolling_friction',
      title: 'rolling friction',
      aliases: ['rolling friction'],
      priority: 8,
      examples: rollingFriction?.examples || [rollingFriction?.exampleCue].filter(Boolean),
      commonMistakes: compact([rollingFriction?.commonMisconception])
    },
    {
      id: 'friction_types',
      title: 'friction',
      displayTitle: 'Types of friction',
      aliases: ['types of friction', 'friction types'],
      priority: 3,
      flashcards: [
        withFlashcardQuestion(staticFriction, 'What type of friction keeps objects from starting to slide?'),
        withFlashcardQuestion(slidingFriction, 'What type of friction resists surfaces sliding past each other?'),
        withFlashcardQuestion(rollingFriction, 'What type of friction resists rolling motion?')
      ].filter(Boolean),
      examples: friction?.examples || [],
      nonExamples: friction?.nonExamples || [],
      commonMistakes: friction?.commonMistakes || compact([friction?.commonMisconception])
    },
    {
      id: 'distance_displacement',
      title: 'distance and displacement',
      aliases: ['distance', 'displacement', 'distance vs displacement', 'distance versus displacement', 'distance displacement', 'distance and displacement', 'displacement and distance'],
      priority: 4,
      examples: [
        'Walking around a block and returning home: distance is the path length, displacement is 0.',
        'Swimming three pool lengths in a 50 m pool: distance is 150 m, displacement is 50 m.'
      ],
      nonExamples: [
        'Distance is not the same as the straight-line change with direction.',
        'Displacement is not the total path length if the path turns or loops.'
      ],
      commonMistakes: unique([...(distance?.commonMistakes || []), ...(displacement?.commonMistakes || [])]),
      compareContrast: {
        left: { term: 'Distance', definition: distance?.definition || 'Distance is the total path traveled.' },
        right: { term: 'Displacement', definition: displacement?.definition || 'Displacement is the straight-line change from start to finish with direction.' },
        keyPoint: 'Returning to the starting point can mean displacement is 0 even when distance is not 0.'
      }
    },
    {
      id: 'speed_velocity',
      title: 'speed and velocity',
      aliases: ['speed', 'velocity', 'speed vs velocity', 'speed versus velocity', 'speed velocity', 'speed and velocity', 'velocity and speed'],
      priority: 4,
      commonMistakes: unique([...(speed?.commonMistakes || []), ...(velocity?.commonMistakes || [])]),
      compareContrast: {
        left: { term: 'Speed', definition: 'Speed tells how fast something moves.' },
        right: { term: 'Velocity', definition: 'Velocity is speed with direction. Velocity tells speed plus direction, like 10 m/s north.' },
        keyPoint: 'The same speed can have different velocity if direction changes.'
      }
    },
    {
      id: 'balanced_unbalanced_forces',
      title: 'balanced and unbalanced force',
      aliases: ['balanced force', 'balanced forces', 'unbalanced force', 'unbalanced forces', 'balanced vs unbalanced force', 'balanced versus unbalanced force', 'balanced and unbalanced forces', 'balanced forces and unbalanced forces'],
      priority: 4,
      examples: compact([
        ...(balanced?.examples || []),
        ...(unbalanced?.examples || [])
      ]),
      commonMistakes: compact([balanced?.commonMisconception, unbalanced?.commonMisconception]),
      compareContrast: {
        left: { term: 'Balanced forces', definition: 'Balanced forces cancel to net force 0 and do not change motion.' },
        right: { term: 'Unbalanced forces', definition: 'Unbalanced forces create a nonzero net force and can change motion.' },
        keyPoint: 'Balanced forces cancel to net force 0 and do not change motion; unbalanced forces create a nonzero net force and can change motion.'
      }
    },
    {
      id: 'contact_field_forces',
      title: 'contact and field forces',
      aliases: ['contact force', 'contact forces', 'field force', 'field forces', 'contact vs field forces', 'contact versus field forces', 'contact and field forces', 'contact forces and field forces'],
      priority: 4,
      responseType: 'definition',
      examples: [
        'Contact force examples: friction, normal force, applied force, tension.',
        'Field force examples: gravity, magnetic force, electric force.'
      ],
      compareContrast: {
        left: { term: 'Contact forces', definition: 'Contact forces require touching; they happen when objects touch.' },
        right: { term: 'Field forces', definition: 'Field forces act at a distance without direct contact.' },
        keyPoint: 'Contact forces happen when objects touch, while field forces act without direct contact.'
      }
    },
    {
      id: 'newtons_laws',
      title: 'Newton\'s laws',
      displayTitle: 'Newton\'s laws',
      aliases: ['newtons laws', 'newton laws', 'newton\'s laws', 'newtons 3 laws', 'newton three laws'],
      priority: 4,
      flashcards: [
        { term: 'First law / inertia', definition: firstLaw?.definition },
        { term: 'Second law / F = m × a', definition: secondLaw?.definition },
        { term: 'Third law / equal and opposite forces', definition: thirdLaw?.definition }
      ],
      examples: compact([
        ...(firstLaw?.examples || []),
        ...(secondLaw?.examples || []),
        ...(thirdLaw?.examples || [])
      ]),
      commonMistakes: [
        'Third-law force pairs act on different objects.',
        'Balanced forces are not the same thing as third-law pairs.',
        'More mass means less acceleration for the same force.'
      ]
    },
    {
      id: 'motion_graphs',
      title: 'motion graphs',
      displayTitle: 'Motion graphs',
      aliases: ['motion graphs', 'motion graph', 'distance time graph', 'distance-time graph', 'velocity time graph', 'velocity-time graph', 'speed time graph', 'speed-time graph'],
      priority: 4,
      flashcards: [
        { term: 'Distance-time graph slope', definition: 'Distance-time graph slope = speed.' },
        { term: 'Velocity-time or speed-time graph slope', definition: 'Velocity-time or speed-time graph slope = acceleration.' },
        { term: 'Upward slope on a speed-time graph', definition: 'Upward slope on a speed-time graph = positive acceleration.' },
        { term: 'Downward slope on a speed-time graph', definition: 'Downward slope on a speed-time graph = negative acceleration.' }
      ],
      examples: [
        'A distance-time graph with a steeper slope shows greater speed.',
        'A speed-time graph with an upward line shows positive acceleration.',
        'A speed-time graph with a downward line shows negative acceleration.'
      ],
      commonMistakes: [
        'Do not mix up position/distance-time graphs with velocity-time graphs.',
        'Do not call the slope of a velocity-time graph speed; it is acceleration.'
      ]
    }
  ];
}

function buildVocabularyIndex() {
  return new Map(vocabulary.map((entry) => [entry.id, entry]));
}

function toFlashcard(entry) {
  if (!entry?.term || !entry?.definition) return null;
  return {
    term: titleCaseText(entry.term),
    definition: entry.definition
  };
}

function withFlashcardQuestion(entry, front) {
  const card = toFlashcard(entry);
  if (!card) return null;
  return {
    ...card,
    front,
    back: card.term
  };
}

function compact(values) {
  return values.filter((value) => String(value || '').trim());
}

function unique(values) {
  return Array.from(new Set(compact(values)));
}

function titleCaseText(value) {
  return String(value || '').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function asksNewtonThreeLawsList(text) {
  return /\bnewton(?:\s*s|'s|s)?\s+(?:3|three)\s+laws?\b/.test(text) ||
    /\bnewton(?:\s*s|'s|s)?\s+laws?\b/.test(text) && hasAny(text, ['what are', 'list', 'laws']);
}

function asksConservationLawsList(text) {
  return has(text, 'laws of conservation') ||
    has(text, 'conservation laws') ||
    /\blist\b.*\bconservation\b.*\blaws?\b/.test(text);
}

function asksMassWeightComparison(text) {
  return has(text, 'mass') &&
    has(text, 'weight') &&
    hasAny(text, ['vs', 'versus', 'difference', 'different', 'compare']);
}

function asksNewtonFirstLawExamples(text) {
  return mentionsNewtonLaw(text, ['1st', 'first']) && hasAny(text, ['example', 'examples']);
}

function asksNewtonThirdLawExamples(text) {
  return mentionsNewtonLaw(text, ['3rd', 'third']) && hasAny(text, ['example', 'examples']);
}

function asksMomentumNewtonThirdLawRelationship(text) {
  return has(text, 'momentum') &&
    mentionsNewtonLaw(text, ['3rd', 'third']) &&
    hasAny(text, ['related', 'relate', 'relationship']);
}

function hasThirdLawActionReactionPhrase(text) {
  return /\bevery\s+action\b/.test(text) &&
    /\bequal\b[\s\S]{0,60}\bopposite\b/.test(text) &&
    /\breaction\b/.test(text);
}

function mentionsNewtonLaw(text, ordinals) {
  const ordinalPattern = ordinals.map((ordinal) => ordinal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\bnewton(?:\\s*s|'s|s)?\\s+(?:${ordinalPattern})\\s+law\\b`).test(text) ||
    new RegExp(`\\b(?:${ordinalPattern})\\s+law\\b`).test(text);
}

function response(type, id, directAnswer, options = {}) {
  const representation = options.representationIntent || null;
  const imageRequest = options.imageRequest || null;

  return {
    id,
    type,
    confidence: 'strong',
    toolsUsed: ['motion_force_knowledge'],
    notes: `Answered local Motion/Force knowledge question: ${id}.`,
    directAnswer,
    motionForceTutor: buildMotionForceTutorMetadata(type, id, directAnswer),
    requestedRepresentation: representation?.requestedRepresentation || '',
    requestedLearningShape: representation?.requestedLearningShape || null,
    requestedInteractionMode: representation?.requestedInteractionMode || '',
    shouldAskRepresentationFollowup: Boolean(representation?.shouldAskRepresentationFollowup),
    needsImageAsset: Boolean(imageRequest?.needsImageAsset),
    imageQuery: imageRequest?.imageQuery || null,
    aiAllowed: false
  };
}

function representationOptions(text, topic = '') {
  return {
    representationIntent: detectAnswerRepresentationIntent(text),
    imageRequest: buildImageRequestMetadata(text, topic)
  };
}

function buildMotionForceTutorMetadata(type, id, directAnswer) {
  const metadataById = {
    distance_time_flat_line: {
      topic: 'distance-time flat line',
      category: 'graph_interpretation',
      expectedAnswer: 'stopped',
      guidingQuestions: [
        'On a distance-time graph, what does the distance value do if the line is flat?',
        'If distance stays the same while time passes, is the object moving or stopped?'
      ],
      finalAnswer: directAnswer,
      misconceptionNote: 'A flat distance-time line does not mean constant speed; it means no change in distance.'
    },
    distance_time_slope: {
      topic: 'distance-time slope',
      category: 'graph_interpretation',
      expectedAnswer: 'speed',
      guidingQuestions: [
        'On a distance-time graph, which two quantities are being compared?',
        'If slope means change in distance over change in time, what motion idea is that?'
      ],
      finalAnswer: directAnswer
    },
    distance_time_steeper: {
      topic: 'steeper distance-time graph',
      category: 'graph_interpretation',
      expectedAnswer: 'speeding up',
      guidingQuestions: [
        'On a distance-time graph, what does a steeper line tell you about speed?',
        'If the line keeps getting steeper, is the speed increasing or decreasing?'
      ],
      finalAnswer: directAnswer
    },
    distance_time_flattening: {
      topic: 'flattening distance-time graph',
      category: 'graph_interpretation',
      expectedAnswer: 'slowing down',
      guidingQuestions: [
        'On a distance-time graph, what happens to speed when the line gets less steep?',
        'If the graph is flattening, is the object speeding up or slowing down?'
      ],
      finalAnswer: directAnswer
    },
    velocity_time_slope: {
      topic: 'velocity-time slope',
      category: 'graph_interpretation',
      expectedAnswer: 'acceleration',
      guidingQuestions: [
        'On a velocity-time graph, which quantity is changing as time passes?',
        'A change in velocity over time is called what?'
      ],
      finalAnswer: directAnswer
    },
    velocity_time_flat_line: {
      topic: 'velocity-time flat line',
      category: 'graph_interpretation',
      expectedAnswer: 'constant velocity',
      guidingQuestions: [
        'On a velocity-time graph, what does it mean if velocity stays at the same value?',
        'If velocity is not changing, what is the acceleration?'
      ],
      finalAnswer: directAnswer,
      misconceptionNote: 'A flat velocity-time line can still mean motion; it means constant velocity.'
    },
    newton_third_law_scenario: {
      topic: 'Newton law identification',
      category: 'newton_law_identification',
      expectedAnswer: 'Newton’s third law',
      guidingQuestions: [
        'In this situation, what are the two objects pushing on each other?',
        'When forces come in equal and opposite pairs, which Newton law is that?'
      ],
      finalAnswer: directAnswer
    },
    newton_first_law_scenario: {
      topic: 'Newton law identification',
      category: 'newton_law_identification',
      expectedAnswer: 'Newton’s first law',
      guidingQuestions: [
        'Is this situation about an object resisting a change in motion?',
        'The idea that objects keep their motion unless an unbalanced force acts is which Newton law?'
      ],
      finalAnswer: directAnswer
    },
    newton_second_law_concept: {
      topic: 'Newton law identification',
      category: 'newton_law_identification',
      expectedAnswer: 'Newton’s second law',
      guidingQuestions: [
        'Which motion law connects force, mass, and acceleration?',
        'If force or mass changes acceleration, which Newton law explains that?'
      ],
      finalAnswer: directAnswer
    },
    speed_velocity_difference: {
      topic: 'speed vs velocity',
      category: 'concept',
      expectedAnswer: 'velocity includes direction',
      guidingQuestions: [
        'Does speed need a direction, or only how fast something moves?',
        'What extra information does velocity include besides speed?'
      ],
      finalAnswer: directAnswer
    },
    distance_displacement_difference: {
      topic: 'distance vs displacement',
      category: 'concept',
      expectedAnswer: 'displacement includes direction from start to finish',
      guidingQuestions: [
        'If you walk around a path, is distance the whole path or just start to finish?',
        'Which one cares about the straight-line change and direction from start to finish?'
      ],
      finalAnswer: directAnswer
    },
    acceleration_concept: {
      topic: 'acceleration',
      category: 'concept',
      expectedAnswer: 'change in velocity',
      guidingQuestions: [
        'Acceleration is about a change in what quantity?',
        'Can velocity change by speeding up, slowing down, or changing direction?'
      ],
      finalAnswer: directAnswer
    },
    terminal_velocity: {
      topic: 'terminal velocity',
      category: 'concept',
      expectedAnswer: 'air resistance balances gravity',
      guidingQuestions: [
        'When something falls, which force pulls down?',
        'At terminal velocity, what force balances gravity so the speed stops increasing?'
      ],
      finalAnswer: directAnswer
    },
    air_resistance_paper_shape: {
      topic: 'air resistance',
      category: 'concept',
      expectedAnswer: 'more surface area causes more air resistance',
      guidingQuestions: [
        'Which paper shape has more surface area pushing against the air?',
        'More surface area usually means more or less air resistance?'
      ],
      finalAnswer: directAnswer
    },
    grass_slows_ball: {
      topic: 'friction',
      category: 'concept',
      expectedAnswer: 'friction opposes motion',
      guidingQuestions: [
        'When the ball rolls on grass, what contact force acts against its motion?',
        'If a force acts opposite motion, will it speed the ball up or slow it down?'
      ],
      finalAnswer: directAnswer
    },
    sliding_friction_book: {
      topic: 'friction type',
      category: 'concept',
      expectedAnswer: 'sliding friction',
      guidingQuestions: [
        'Are the book and desk surfaces sliding past each other?',
        'When surfaces slide past each other, what type of friction is that?'
      ],
      finalAnswer: directAnswer
    },
    friction_types: {
      topic: 'friction types',
      category: 'concept',
      expectedAnswer: 'static, sliding, and rolling friction',
      guidingQuestions: [
        'Which friction keeps an object from starting to move?',
        'Which friction acts when surfaces slide or when an object rolls?'
      ],
      finalAnswer: directAnswer
    },
    rank_by_inertia: {
      topic: 'inertia',
      category: 'concept',
      expectedAnswer: 'more mass means more inertia',
      guidingQuestions: [
        'Inertia depends mostly on what property of an object?',
        'Which object has the most mass, so the most inertia?'
      ],
      finalAnswer: directAnswer
    },
    momentum_concept: {
      topic: 'momentum',
      category: 'concept',
      expectedAnswer: 'mass and velocity',
      guidingQuestions: [
        'Momentum depends on an object’s mass and what motion quantity?',
        'Would a heavier or faster object be harder to stop?'
      ],
      finalAnswer: directAnswer
    },
    terminal_velocity_vocab: {
      topic: 'terminal velocity',
      category: 'vocab',
      expectedAnswer: 'constant falling speed',
      guidingQuestions: [
        'If a falling object reaches terminal velocity, is its speed still increasing?',
        'What balances gravity at terminal velocity?'
      ],
      finalAnswer: directAnswer
    },
    air_resistance_vocab: {
      topic: 'air resistance',
      category: 'vocab',
      expectedAnswer: 'force from air opposite motion',
      guidingQuestions: [
        'Air resistance acts in what direction compared with motion?'
      ],
      finalAnswer: directAnswer
    },
    sliding_friction_vocab: {
      topic: 'sliding friction',
      category: 'vocab',
      expectedAnswer: 'surfaces sliding past each other',
      guidingQuestions: [
        'What are the two surfaces doing during sliding friction?',
        'If surfaces are sliding past each other, what kind of friction is acting?'
      ],
      finalAnswer: directAnswer
    },
    rolling_friction_vocab: {
      topic: 'rolling friction',
      category: 'vocab',
      expectedAnswer: 'friction on rolling objects',
      guidingQuestions: [
        'What kind of motion is happening when a wheel moves across a surface?',
        'What friction acts on an object that rolls?'
      ],
      finalAnswer: directAnswer
    },
    static_friction_vocab: {
      topic: 'static friction',
      category: 'vocab',
      expectedAnswer: 'keeps an object from starting to move',
      guidingQuestions: [
        'Is static friction acting before or after an object starts sliding?',
        'What does static friction prevent an object from doing?'
      ],
      finalAnswer: directAnswer
    },
    inertia_vocab: {
      topic: 'inertia',
      category: 'vocab',
      expectedAnswer: 'resistance to a change in motion',
      guidingQuestions: [
        'Is inertia about changing motion easily or resisting a change in motion?',
        'What property usually gives an object more inertia?'
      ],
      finalAnswer: directAnswer,
      misconceptionNote: 'Inertia is not the same as speed. It mostly depends on mass.'
    },
    speed_velocity_time_positive_acceleration: {
      topic: 'positive acceleration on speed-time graph',
      category: 'graph_interpretation',
      expectedAnswer: 'upward or increasing line',
      guidingQuestions: [
        'On a speed-time graph, what happens to speed if acceleration is positive?',
        'If the speed values increase as time passes, which way does the line go?'
      ],
      finalAnswer: directAnswer
    },
    speed_velocity_time_negative_acceleration: {
      topic: 'negative acceleration on speed-time graph',
      category: 'graph_interpretation',
      expectedAnswer: 'downward or decreasing line',
      guidingQuestions: [
        'On a speed-time graph, what happens to speed if acceleration is negative?',
        'If the speed values decrease as time passes, which way does the line go?'
      ],
      finalAnswer: directAnswer
    },
    reference_point_vocab: {
      topic: 'reference point',
      category: 'vocab',
      expectedAnswer: 'place or object used for comparison',
      guidingQuestions: [
        'What do you compare an object’s position to?',
        'How can you tell whether the object changed position?'
      ],
      finalAnswer: directAnswer
    },
    motion_description_measurement_summary: {
      topic: 'describing and measuring motion',
      category: 'concept',
      expectedAnswer: 'reference point, distance, displacement, speed, velocity, acceleration, and graphs',
      guidingQuestions: [
        'What point or object do you compare position to?',
        'Which quantities tell path length, direction, speed, and changes in velocity?'
      ],
      finalAnswer: directAnswer
    }
  };

  const metadata = metadataById[id] || null;
  if (!metadata) return null;

  return {
    id,
    type,
    ...metadata
  };
}

function hasAll(text, phrases) {
  return phrases.every((phrase) => has(text, phrase));
}

function hasAny(text, phrases) {
  return phrases.some((phrase) => has(text, phrase));
}

function has(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9µμ.=^/\s-]/g, ' ')
    .replace(/\bslop\b/g, 'slope')
    .replace(/\bvers\b/g, 'versus')
    .replace(/\bwhat\s+is(?=(?:acceleration|friction|force|reference|motion|speed|velocity|distance|displacement|inertia)\b)/g, 'what is ')
    .replace(/\bundlanced\b/g, 'unbalanced')
    .replace(/\bfrictions\b/g, 'friction')
    .replace(/\bdistance\s+(?:versus|vs)\s+time\s+graph\b/g, 'distance time graph')
    .replace(/\bvelocity\s+(?:versus|vs)\s+time\s+graph\b/g, 'velocity time graph')
    .replace(/\bspeed\s+(?:versus|vs)\s+time\s+graph\b/g, 'speed time graph')
    .replace(/\s+/g, ' ')
    .trim();
}

function mentionsSpecificMotionGraph(text) {
  return has(text, 'distance time') ||
    has(text, 'distance-time') ||
    has(text, 'velocity time') ||
    has(text, 'velocity-time') ||
    has(text, 'speed time') ||
    has(text, 'speed-time') ||
    ((has(text, 'distance') || has(text, 'velocity') || has(text, 'speed')) && has(text, 'time') && has(text, 'graph'));
}

module.exports = {
  buildMotionForceFlashcardDeck,
  tryMotionForceKnowledge
};
