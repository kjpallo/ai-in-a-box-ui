const concepts = [
  {
    "id": "concept_1_describing_motion",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "learningTarget": "Describe and measure motion using distance, displacement, speed, velocity, and reference points.",
    "studentFriendlyRule": "Motion means position changes compared with a reference point.",
    "needsRouterSupport": [
      "Classify distance vs displacement",
      "speed/velocity math",
      "graph interpretation",
      "direction words."
    ],
    "sourcePages": "1-10,18-19"
  },
  {
    "id": "concept_1_distance_vs_displacement",
    "unit": "Motion and Force",
    "concept": "Concept 1: Distance vs Displacement",
    "learningTarget": "Find total path distance and straight-line displacement.",
    "studentFriendlyRule": "Distance adds the path; displacement compares start to finish and needs direction.",
    "needsRouterSupport": [
      "Catch round-trip problems as displacement 0",
      "use Pythagorean theorem for perpendicular paths",
      "return compass direction when possible."
    ],
    "sourcePages": "2,6,18"
  },
  {
    "id": "concept_1_distance_time_graphs",
    "unit": "Motion and Force",
    "concept": "Concept 1: Distance-Time Graphs",
    "learningTarget": "Analyze distance vs time graphs.",
    "studentFriendlyRule": "On a distance-time graph, slope means speed.",
    "needsRouterSupport": [
      "Horizontal line = stopped",
      "straight upward line = constant speed",
      "curve getting steeper = speeding up",
      "curve flattening = slowing down."
    ],
    "sourcePages": "5,8-10,18-19"
  },
  {
    "id": "concept_2_acceleration",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "learningTarget": "Calculate and explain acceleration as change in velocity over time.",
    "studentFriendlyRule": "Acceleration happens when speed or direction changes.",
    "needsRouterSupport": [
      "Handle 'comes to a stop', 'from rest', 'final speed', negative acceleration, and unit consistency."
    ],
    "sourcePages": "11-14,18-19"
  },
  {
    "id": "concept_2_velocity_time_graphs",
    "unit": "Motion and Force",
    "concept": "Concept 2: Velocity-Time Graphs",
    "learningTarget": "Analyze velocity vs time graphs.",
    "studentFriendlyRule": "On a velocity-time graph, slope means acceleration.",
    "needsRouterSupport": [
      "Horizontal nonzero line = constant velocity/zero acceleration",
      "upward line = positive acceleration",
      "downward line = negative acceleration",
      "line at zero = not moving."
    ],
    "sourcePages": "12,14,18-19"
  },
  {
    "id": "concept_3_balanced_and_unbalanced_forces",
    "unit": "Motion and Force",
    "concept": "Concept 3: Balanced and Unbalanced Forces",
    "learningTarget": "Determine net force and explain how balanced/unbalanced forces affect motion.",
    "studentFriendlyRule": "Balanced forces make 0 N net force; unbalanced forces change motion.",
    "needsRouterSupport": [
      "Handle force diagrams and words like right/left/up/down",
      "add same-direction forces",
      "subtract opposite-direction forces."
    ],
    "sourcePages": "20,24,28,37"
  },
  {
    "id": "concept_3_newton_s_1st_law",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's 1st Law",
    "learningTarget": "Identify inertia examples and explain objects resisting changes in motion.",
    "studentFriendlyRule": "Objects keep doing what they are doing unless an unbalanced force acts.",
    "needsRouterSupport": [
      "Scenario classification for seatbelts, objects at rest, objects continuing forward, friction stopping motion."
    ],
    "sourcePages": "20,24-25,28,31,36"
  },
  {
    "id": "concept_3_friction_and_air_resistance",
    "unit": "Motion and Force",
    "concept": "Concept 3: Friction and Air Resistance",
    "learningTarget": "Explain friction types and air resistance effects.",
    "studentFriendlyRule": "Friction opposes motion; air resistance depends a lot on shape and surface area.",
    "needsRouterSupport": [
      "Classify static/sliding/rolling friction",
      "compare falling flat vs crumpled objects",
      "explain terminal velocity."
    ],
    "sourcePages": "21,25,31"
  },
  {
    "id": "concept_3_gravity_and_weight",
    "unit": "Motion and Force",
    "concept": "Concept 3: Gravity and Weight",
    "learningTarget": "Use gravity to explain falling objects and calculate weight.",
    "studentFriendlyRule": "Weight is the force of gravity on mass; near Earth use 9.8 m/s².",
    "needsRouterSupport": [
      "Do not overexplain mass vs weight unless asked",
      "calculate W=mg and m=W/g",
      "answer gravity-near-Earth as 9.8 m/s² when asked."
    ],
    "sourcePages": "22-23,27,31,37"
  },
  {
    "id": "concept_3_newton_s_2nd_law",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's 2nd Law",
    "learningTarget": "Use F=ma to solve for force, mass, or acceleration.",
    "studentFriendlyRule": "More force gives more acceleration; more mass gives less acceleration if force stays the same.",
    "needsRouterSupport": [
      "Formula router needs forward and rearranged versions of F=ma",
      "net force can come from diagram first, then acceleration = Fnet/m."
    ],
    "sourcePages": "22,27-28,31,34-37"
  },
  {
    "id": "concept_3_newton_s_3rd_law",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's 3rd Law",
    "learningTarget": "Identify equal and opposite action-reaction force pairs.",
    "studentFriendlyRule": "Forces come in pairs on different objects.",
    "needsRouterSupport": [
      "Scenario classification for trampoline, swimming, balloon rockets, hoses, collisions",
      "warn that paired forces act on different objects."
    ],
    "sourcePages": "23,26,28,31,34-36"
  },
  {
    "id": "concept_3_momentum",
    "unit": "Motion and Force",
    "concept": "Concept 3: Momentum",
    "learningTarget": "Calculate momentum and apply simple conservation of momentum.",
    "studentFriendlyRule": "Momentum equals mass times velocity, and it can transfer in collisions.",
    "needsRouterSupport": [
      "Formula router for p=mv",
      "scenario classification for collisions and pool balls",
      "simple transfer all momentum problems."
    ],
    "sourcePages": "23,31-32,37"
  }
];

module.exports = concepts;
