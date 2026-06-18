const MOTION_FORCE_SEED_SOURCE = 'seed:motion-force';
const MOTION_FORCE_SEED_PACK_ID = 'seed-motion-force';
const MOTION_FORCE_SEED_NAME = 'motion-force';

const MOTION_FORCE_SEED_RELATIONSHIPS = [
  ['distance', 'displacement', 'commonly_confused_with'],
  ['displacement', 'direction', 'related_to'],
  ['speed', 'velocity', 'related_to'],
  ['velocity', 'displacement', 'uses_concept'],
  ['velocity', 'time', 'uses_concept'],
  ['acceleration', 'velocity', 'uses_concept'],
  ['acceleration', 'time', 'uses_concept'],
  ["Newton's second law", 'F = ma', 'uses_formula'],
  ['unbalanced force', "Newton's second law", 'prerequisite_for'],
  ['distance-time graph', 'speed', 'related_to'],
  ['velocity-time graph', 'acceleration', 'related_to']
];

const MOTION_FORCE_SEED_NODE_TYPES = {
  distance: 'vocabulary',
  displacement: 'vocabulary',
  direction: 'concept',
  speed: 'vocabulary',
  velocity: 'vocabulary',
  time: 'concept',
  acceleration: 'concept',
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
