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
  const text = normalize(message);
  if (!text || looksNumericOrFormulaBased(text)) return null;

  const graphAnswer = answerGraphQuestion(text);
  if (graphAnswer) return graphAnswer;

  const lawAnswer = answerNewtonLawQuestion(text);
  if (lawAnswer) return lawAnswer;

  const conceptAnswer = answerConceptQuestion(text);
  if (conceptAnswer) return conceptAnswer;

  const vocabAnswer = answerVocabQuestion(text, options);
  if (vocabAnswer) return vocabAnswer;

  return null;
}

function answerGraphQuestion(text) {
  if (!has(text, 'graph')) return null;

  if (has(text, 'distance time') || has(text, 'distance-time') || (has(text, 'distance') && has(text, 'time'))) {
    if (hasAny(text, ['flat line', 'horizontal line'])) {
      return response('graph_concept', 'distance_time_flat_line', 'On a distance-time graph, a flat line means the distance is not changing, so the object is stopped.');
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

  if (has(text, 'velocity time') || has(text, 'velocity-time') || (has(text, 'velocity') && has(text, 'time'))) {
    if (has(text, 'slope')) {
      return response('graph_concept', 'velocity_time_slope', 'On a velocity-time graph, slope means acceleration.');
    }
    if (hasAny(text, ['flat line', 'horizontal line'])) {
      return response('graph_concept', 'velocity_time_flat_line', 'On a velocity-time graph, a flat line means constant velocity, so acceleration is 0.');
    }
  }

  return null;
}

function answerNewtonLawQuestion(text) {
  if (!/\b(?:what|which)\s+(?:newton\s*)?law\b/.test(text) && !/\bnewton'?s?\s+law\b/.test(text)) return null;

  if (hasAny(text, ['pushes water back', 'moves forward', 'action reaction', 'equal and opposite', 'balloon', 'rocket', 'trampoline'])) {
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
  if (has(text, 'speed') && has(text, 'velocity') && hasAny(text, ['difference', 'different', 'compare'])) {
    return response('science_concept', 'speed_velocity_difference', 'Speed tells how fast something moves. Velocity tells speed plus direction, like 10 m/s north.');
  }

  if (has(text, 'distance') && has(text, 'displacement') && hasAny(text, ['difference', 'different', 'compare'])) {
    return response('definition', 'distance_displacement_difference', 'Distance is the total path traveled. Displacement is the straight-line change from start to finish and includes direction.');
  }

  if (has(text, 'acceleration') && hasAny(text, ['what is', 'mean', 'explain', 'concept'])) {
    return response('science_concept', 'acceleration_concept', 'Acceleration means velocity is changing. An object can accelerate by speeding up, slowing down, or changing direction.');
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

  if (has(text, 'friction') && hasAny(text, ['type', 'types']) && hasAny(text, ['sliding', 'rolling', 'static'])) {
    return response('science_concept', 'friction_types', 'Static friction keeps something from starting to move, sliding friction acts while surfaces slide, and rolling friction acts on rolling objects.');
  }

  if (has(text, 'rank') && has(text, 'inertia')) {
    return response('science_concept', 'rank_by_inertia', 'Rank inertia by mass. From least to greatest for those objects: feather, baseball, bicycle, car.');
  }

  if (has(text, 'momentum') && hasAny(text, ['concept', 'mean', 'what is']) && !hasSimpleGeneralVocabQuestion(text, 'momentum')) {
    return response('science_concept', 'momentum_concept', 'Momentum depends on mass and velocity. A heavier or faster moving object is harder to stop.');
  }

  return null;
}

function answerVocabQuestion(text) {
  if (!hasDefinitionIntent(text)) return null;
  if (GENERAL_VOCAB_TERMS.some((term) => has(text, term))) return null;

  if (has(text, 'terminal velocity')) {
    return response('definition', 'terminal_velocity_vocab', 'Terminal velocity is the constant falling speed reached when air resistance balances gravity.');
  }

  if (has(text, 'air resistance') || has(text, 'drag')) {
    return response('definition', 'air_resistance_vocab', 'Air resistance is a friction-like force from air that pushes opposite an object\'s motion.');
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

function hasDefinitionIntent(text) {
  return /\b(?:what is|what's|define|meaning of|what does|explain)\b/.test(text);
}

function hasSimpleGeneralVocabQuestion(text, term) {
  return has(text, term) && /^(?:what is|what's|define|meaning of)\s+/.test(text);
}

function response(type, id, directAnswer) {
  return {
    id,
    type,
    confidence: 'strong',
    toolsUsed: ['motion_force_knowledge'],
    notes: `Answered local Motion/Force knowledge question: ${id}.`,
    directAnswer,
    motionForceTutor: buildMotionForceTutorMetadata(type, id, directAnswer),
    aiAllowed: false
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
        'Air resistance comes from moving through what material?',
        'Does air resistance push with the motion or opposite the motion?'
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
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  tryMotionForceKnowledge
};
