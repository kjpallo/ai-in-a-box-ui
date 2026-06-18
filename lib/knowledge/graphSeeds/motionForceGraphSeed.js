const MOTION_FORCE_SEED_SOURCE = 'seed:motion-force';
const MOTION_FORCE_SEED_PACK_ID = 'seed-motion-force';
const MOTION_FORCE_SEED_NAME = 'motion-force';

const MOTION_FORCE_SEED_RELATIONSHIPS = [
  ['motion', 'position', 'uses_concept'],
  ['motion', 'reference point', 'uses_concept'],
  ['distance', 'displacement', 'commonly_confused_with'],
  ['displacement', 'direction', 'related_to'],
  ['speed', 'velocity', 'related_to'],
  ['velocity', 'displacement', 'uses_concept'],
  ['velocity', 'time', 'uses_concept'],
  ['acceleration', 'velocity', 'uses_concept'],
  ['acceleration', 'time', 'uses_concept'],
  ['negative acceleration', 'deceleration', 'related_to'],
  ['negative acceleration', 'acceleration', 'related_to'],
  ['balanced forces', 'net force', 'uses_concept'],
  ['unbalanced forces', 'net force', 'uses_concept'],
  ['balanced forces', 'object at rest', 'related_to'],
  ['unbalanced forces', 'motion', 'related_to'],
  ['net force', "Newton's second law", 'uses_concept'],
  ["Newton's first law", 'inertia', 'related_to'],
  ["Newton's first law", 'unbalanced forces', 'uses_concept'],
  ["Newton's second law", 'F = ma', 'uses_formula'],
  ['unbalanced force', "Newton's second law", 'prerequisite_for'],
  ['distance-time graph', 'speed', 'related_to'],
  ['velocity-time graph', 'acceleration', 'related_to']
];

const MOTION_FORCE_SEED_NODE_TYPES = {
  distance: 'vocabulary',
  displacement: 'vocabulary',
  direction: 'concept',
  motion: 'vocabulary',
  position: 'concept',
  'reference point': 'vocabulary',
  speed: 'vocabulary',
  velocity: 'vocabulary',
  time: 'concept',
  acceleration: 'concept',
  'negative acceleration': 'vocabulary',
  deceleration: 'vocabulary',
  'balanced forces': 'vocabulary',
  'unbalanced forces': 'vocabulary',
  'net force': 'vocabulary',
  'object at rest': 'concept',
  'newtons first law': 'concept',
  inertia: 'vocabulary',
  'newtons second law': 'concept',
  'f ma': 'formula',
  'unbalanced force': 'concept',
  'distance time graph': 'concept',
  'velocity time graph': 'concept'
};

module.exports = {
  MOTION_FORCE_SEED_SOURCE,
  MOTION_FORCE_SEED_PACK_ID,
  MOTION_FORCE_SEED_NAME,
  MOTION_FORCE_SEED_RELATIONSHIPS,
  MOTION_FORCE_SEED_NODE_TYPES
};
