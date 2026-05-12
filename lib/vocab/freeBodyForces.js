const CASES = [
  {
    id: 'car_stopped_stop_light',
    matches: (text) => has(text, 'car') && hasAny(text, ['stopped', 'stop light', 'at rest']) && asksForForces(text),
    answer: [
      'Gravity/weight acts downward.',
      'The normal force from the road acts upward.',
      'The forces are balanced because the car is not accelerating.'
    ]
  },
  {
    id: 'skydiver_constant_velocity',
    matches: (text) => has(text, 'skydiver') && has(text, 'constant velocity') && asksForForces(text),
    answer: [
      'Gravity acts downward.',
      'Air resistance/drag acts upward.',
      'The forces are balanced because constant velocity means no acceleration.'
    ]
  },
  {
    id: 'balloon_accelerating_upward',
    matches: (text) => has(text, 'balloon') && hasAny(text, ['accelerating upward', 'accelerates upward']) && asksAboutVerticalForces(text),
    answer: [
      'The upward force is greater than weight/gravity.',
      'The net force is upward.',
      'The forces are unbalanced.'
    ]
  },
  {
    id: 'book_constant_velocity_with_friction',
    matches: (text) => has(text, 'book') && has(text, 'constant velocity') && has(text, 'friction'),
    answer: [
      'Net force is 0 N.',
      'The applied force and friction are balanced horizontally.',
      'The normal force and gravity are balanced vertically.'
    ]
  },
  {
    id: 'book_accelerates_right_with_friction',
    matches: (text) => has(text, 'book') && hasAny(text, ['accelerates right', 'accelerating right']) && has(text, 'friction'),
    answer: [
      'The applied force acts right.',
      'Friction acts left.',
      'Gravity acts down.',
      'The normal force acts up.',
      'The applied force is greater than friction because the book accelerates right.'
    ]
  },
  {
    id: 'car_coasting_right_slowing',
    matches: (text) => has(text, 'car') && has(text, 'right') && hasAny(text, ['slowing down', 'slows down']) && hasAny(text, ['coasting', 'moving']),
    answer: [
      'Friction/drag acts left, opposite the motion.',
      'Gravity acts down.',
      'The normal force acts up.',
      'The net force is left because the car is slowing down.'
    ]
  },
  {
    id: 'car_parked_on_slope',
    matches: (text) => has(text, 'car') && hasAny(text, ['parked', 'stopped', 'at rest']) && hasAny(text, ['sloped street', 'slope', 'incline', 'hill']) && asksForForces(text),
    answer: [
      'Gravity acts downward.',
      'The normal force acts perpendicular to the surface.',
      'Friction acts along the slope to prevent sliding.',
      'This is a sloped-surface case, so keep it conceptual and do not calculate components.'
    ]
  },
  {
    id: 'constant_velocity_net_force',
    matches: (text) => has(text, 'constant velocity') && has(text, 'net force'),
    answer: [
      'Net force is 0 N.',
      'The forces are balanced.',
      'The object is not accelerating.'
    ]
  },
  {
    id: 'accelerating_upward_meaning',
    matches: (text) => hasAny(text, ['accelerating upward', 'accelerates upward']) && !has(text, 'balloon'),
    answer: [
      'The net force is upward.',
      'The upward force is greater than the downward force.',
      'The forces are unbalanced.'
    ]
  }
];

function tryFreeBodyForces(message) {
  const text = normalize(message);
  if (!text || hasNumbers(text)) return null;

  const found = CASES.find((item) => item.matches(text));
  if (!found) return null;

  return {
    id: found.id,
    answer: found.answer.join('\n')
  };
}

function asksForForces(text) {
  return /\bwhat\s+forces?\s+act\b/.test(text) ||
    /\bforces?\s+acting\b/.test(text) ||
    /\bfree\s*-?\s*body\b/.test(text);
}

function asksAboutVerticalForces(text) {
  return asksForForces(text) ||
    /\bwhat\s+does\b/.test(text) ||
    /\btell\s+us\b/.test(text) ||
    (has(text, 'upward') && has(text, 'downward') && has(text, 'forces'));
}

function hasAny(text, phrases) {
  return phrases.some((phrase) => has(text, phrase));
}

function has(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function hasNumbers(text) {
  return /\d/.test(text);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  tryFreeBodyForces
};
