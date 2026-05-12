const VOCAB_TERMS = [
  {
    id: 'net_force',
    names: ['net force'],
    answer: 'Net force is the overall force on an object after all the pushes and pulls are combined.'
  },
  {
    id: 'balanced_force',
    names: ['balanced force', 'balanced forces'],
    answer: 'Balanced forces are equal forces in opposite directions, so the net force is 0 N and the motion does not change.'
  },
  {
    id: 'unbalanced_force',
    names: ['unbalanced force', 'unbalanced forces'],
    answer: 'Unbalanced forces do not cancel out, so they can change an object\'s speed or direction.'
  },
  {
    id: 'friction',
    names: ['friction'],
    answer: 'Friction is a force that resists motion when surfaces rub or slide against each other.'
  },
  {
    id: 'frictional_force',
    names: ['frictional force', 'friction force', 'force of friction'],
    answer: 'Frictional force is the force from friction that acts against motion between surfaces.'
  },
  {
    id: 'coefficient_of_friction',
    names: ['coefficient of friction'],
    answer: 'The coefficient of friction tells how strongly two surfaces grip each other. A bigger value means more friction.'
  },
  {
    id: 'normal_force',
    names: ['normal force'],
    answer: 'Normal force is the support force a surface pushes back with, usually perpendicular to the surface.'
  },
  {
    id: 'normal_force_direction',
    names: ['normal force direction', 'direction normal force'],
    answer: 'The normal force is drawn perpendicular to the surface.'
  },
  {
    id: 'contact_field_forces',
    names: ['contact vs field forces', 'contact and field forces', 'contact forces and field forces'],
    answer: 'Contact forces require touching, like friction or normal force. Field forces act at a distance, like gravity, electric force, or magnetic force.'
  },
  {
    id: 'newtons_first_law',
    names: ['newton’s first law', 'newton\'s first law', 'newtons first law', 'newton s first law'],
    answer: 'Newton’s First Law says an object at rest stays at rest, and an object in motion stays in motion, unless acted on by an unbalanced force.'
  },
  {
    id: 'newtons_third_law',
    names: ['newton’s third law', 'newton\'s third law', 'newtons third law', 'newton s third law'],
    answer: 'Newton’s Third Law says forces come in equal and opposite action-reaction pairs.'
  },
  {
    id: 'inertia',
    names: ['inertia'],
    answer: 'Inertia is an object’s resistance to a change in motion.'
  },
  {
    id: 'equilibrium',
    names: ['equilibrium'],
    answer: 'An object is in equilibrium when the net force is zero and the forces are balanced.'
  },
  {
    id: 'equilibrium_motion',
    names: ['types of motion in equilibrium', 'motion in equilibrium'],
    answer: 'An object in equilibrium can be at rest or moving with constant velocity.'
  },
  {
    id: 'unbalanced_forces_motion',
    names: ['motion change if forces are unbalanced', 'motion changes if forces are unbalanced'],
    answer: 'If forces are unbalanced, the object accelerates: it can speed up, slow down, or change direction.'
  },
  {
    id: 'gravity_field_force',
    names: ['gravity contact or field force', 'gravity a contact or field force'],
    answer: 'Gravity is a field force because it can act at a distance.'
  },
  {
    id: 'weight_changes_by_location',
    names: ['mass or weight changes depending on location', 'weight changes depending on location'],
    answer: 'Weight changes depending on location because gravity changes. Mass stays the same.'
  },
  {
    id: 'weight_vector_direction',
    names: ['weight vector direction', 'direction weight vector'],
    answer: 'The weight vector is always drawn downward, toward gravity.'
  },
  {
    id: 'displacement',
    names: ['displacement'],
    answer: 'Displacement is how far and in what direction something is from where it started.'
  },
  {
    id: 'distance',
    names: ['distance'],
    answer: 'Distance is the total length traveled, no matter which direction something moves.'
  },
  {
    id: 'vector',
    names: ['vector'],
    answer: 'A vector is a quantity with both size and direction, like 5 m east or 10 N left.'
  },
  {
    id: 'scalar',
    names: ['scalar'],
    answer: 'A scalar is a quantity with size only and no direction, like distance, time, or mass.'
  },
  {
    id: 'resultant',
    names: ['resultant'],
    answer: 'A resultant is the single overall vector you get after combining two or more vectors.'
  },
  {
    id: 'free_body_diagram',
    names: ['free-body diagram', 'free body diagram', 'fbd'],
    answer: 'A free-body diagram is a simple drawing that shows an object and the forces acting on it with arrows.'
  }
];

function tryPhysicsForcesVocab(message) {
  const text = normalize(message);
  if (!text || !hasDefinitionIntent(text)) return null;

  const directionTerm = findDirectionTerm(text);
  if (directionTerm) {
    return {
      id: directionTerm.id,
      answer: directionTerm.answer
    };
  }

  const worksheetConcept = findWorksheetConcept(text);
  if (worksheetConcept) {
    return {
      id: worksheetConcept.id,
      answer: worksheetConcept.answer
    };
  }

  if (asksDistanceDisplacementDifference(text)) {
    return {
      id: 'distance_displacement_difference',
      answer: 'Distance is the total path traveled. Displacement is the straight-line change from start to finish, including direction.'
    };
  }

  const term = findTerm(text);
  if (!term) return null;

  return {
    id: term.id,
    answer: term.answer
  };
}

function findTerm(text) {
  return VOCAB_TERMS
    .slice()
    .sort((a, b) => longestName(b) - longestName(a))
    .find((term) => term.names.some((name) => hasPhrase(text, name)));
}

function findDirectionTerm(text) {
  if (!/\bdirection\b/.test(text)) return null;
  if (hasPhrase(text, 'normal force')) {
    return VOCAB_TERMS.find((term) => term.id === 'normal_force_direction');
  }
  if (hasPhrase(text, 'weight vector')) {
    return VOCAB_TERMS.find((term) => term.id === 'weight_vector_direction');
  }
  return null;
}

function findWorksheetConcept(text) {
  if (hasPhrase(text, 'equilibrium') && /\bwhat\s+types?\s+of\s+motion\b/.test(text)) {
    return VOCAB_TERMS.find((term) => term.id === 'equilibrium_motion');
  }
  if (hasPhrase(text, 'unbalanced') && /\bmotion\s+change\b/.test(text)) {
    return VOCAB_TERMS.find((term) => term.id === 'unbalanced_forces_motion');
  }
  if (hasPhrase(text, 'mass') && hasPhrase(text, 'weight') && /\bchanges?\b/.test(text) && /\blocation\b/.test(text)) {
    return VOCAB_TERMS.find((term) => term.id === 'weight_changes_by_location');
  }
  return null;
}

function longestName(term) {
  return Math.max(...term.names.map((name) => name.length));
}

function asksDistanceDisplacementDifference(text) {
  return /\bdifference\b/.test(text) &&
    hasPhrase(text, 'distance') &&
    hasPhrase(text, 'displacement');
}

function hasDefinitionIntent(text) {
  return /\b(?:what\s+is|what's|define|meaning\s+of|what\s+does|compare|contrast|in\s+what\s+direction|what\s+types|how\s+does|what\s+changes|is\s+gravity)\b/.test(text) ||
    asksDistanceDisplacementDifference(text);
}

function hasPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9µμ.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  tryPhysicsForcesVocab
};
