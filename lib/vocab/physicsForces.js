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

function longestName(term) {
  return Math.max(...term.names.map((name) => name.length));
}

function asksDistanceDisplacementDifference(text) {
  return /\bdifference\b/.test(text) &&
    hasPhrase(text, 'distance') &&
    hasPhrase(text, 'displacement');
}

function hasDefinitionIntent(text) {
  return /\b(?:what\s+is|what's|define|meaning\s+of|what\s+does)\b/.test(text) ||
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
