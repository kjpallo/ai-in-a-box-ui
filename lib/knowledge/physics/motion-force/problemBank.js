const problemBank = [
  {
    "id": "distance_vs_displacement_1",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "skill": "distance_vs_displacement",
    "question": "A student walks 40 m east, then 15 m west. Find the distance and displacement.",
    "expectedAnswer": "distance = 55 m; displacement = 25 m east",
    "workedSteps": "Distance adds the path: 40 + 15 = 55 m. Displacement compares start to finish: 40 east - 15 west = 25 m east.",
    "answerType": "numeric_with_direction",
    "tags": [
      "distance",
      "displacement",
      "opposite directions"
    ],
    "sourcePages": "2,6"
  },
  {
    "id": "distance_vs_displacement_2",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "skill": "distance_vs_displacement",
    "question": "A runner completes one full lap around a 400 m track and ends where she started. Find distance and displacement.",
    "expectedAnswer": "distance = 400 m; displacement = 0 m",
    "workedSteps": "Distance is the full path traveled. Since start and finish are the same point, displacement is 0 m.",
    "answerType": "numeric",
    "tags": [
      "round trip",
      "displacement zero"
    ],
    "sourcePages": "6"
  },
  {
    "id": "distance_vs_displacement_3",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "skill": "distance_vs_displacement",
    "question": "A robot drives 6 m north and then 8 m east. Find distance and straight-line displacement.",
    "expectedAnswer": "distance = 14 m; displacement = 10 m northeast",
    "workedSteps": "Distance = 6 + 8 = 14 m. Displacement = sqrt(6^2 + 8^2) = 10 m toward northeast.",
    "answerType": "numeric_with_direction",
    "tags": [
      "pythagorean",
      "perpendicular paths"
    ],
    "sourcePages": "2,6,18"
  },
  {
    "id": "speed_4",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "skill": "speed",
    "question": "A cart travels 36 m in 6 s. What is its speed?",
    "expectedAnswer": "6 m/s",
    "workedSteps": "s = d/t = 36 m / 6 s = 6 m/s.",
    "answerType": "numeric",
    "tags": [
      "speed",
      "distance",
      "time"
    ],
    "sourcePages": "3-4,7"
  },
  {
    "id": "velocity_5",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "skill": "velocity",
    "question": "A bike travels 18 km north in 0.5 hr. What is its velocity?",
    "expectedAnswer": "36 km/hr north",
    "workedSteps": "v = d/t = 18 km / 0.5 hr = 36 km/hr, then include north.",
    "answerType": "numeric_with_direction",
    "tags": [
      "velocity",
      "direction"
    ],
    "sourcePages": "3,7"
  },
  {
    "id": "distance_from_speed_6",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "skill": "distance_from_speed",
    "question": "A car moves at 55 mi/hr for 2 hours. How far does it travel?",
    "expectedAnswer": "110 mi",
    "workedSteps": "d = s*t = 55 mi/hr * 2 hr = 110 mi.",
    "answerType": "numeric",
    "tags": [
      "distance",
      "speed",
      "time"
    ],
    "sourcePages": "7,18"
  },
  {
    "id": "time_from_speed_7",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "skill": "time_from_speed",
    "question": "Sound travels about 343 m/s. About how long does it take sound to travel 686 m?",
    "expectedAnswer": "2 s",
    "workedSteps": "t = d/s = 686 m / 343 m/s = 2 s.",
    "answerType": "numeric",
    "tags": [
      "time",
      "distance",
      "speed",
      "sound"
    ],
    "sourcePages": "3,7"
  },
  {
    "id": "average_speed_graph_8",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "skill": "average_speed_graph",
    "question": "On a distance-time graph, an object moves from 0 m at 0 s to 20 m at 5 s in a straight line. What is its speed?",
    "expectedAnswer": "4 m/s",
    "workedSteps": "Speed is slope on a distance-time graph: rise/run = 20 m / 5 s = 4 m/s.",
    "answerType": "numeric",
    "tags": [
      "graph",
      "slope",
      "distance-time"
    ],
    "sourcePages": "8-10,18-19"
  },
  {
    "id": "graph_interpretation_9",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "skill": "graph_interpretation",
    "question": "A distance-time graph has a horizontal line. What does that show?",
    "expectedAnswer": "The object is stopped/not moving; speed is 0.",
    "workedSteps": "Distance does not change while time passes, so the object is not moving.",
    "answerType": "conceptual",
    "tags": [
      "graph",
      "horizontal line",
      "stopped"
    ],
    "sourcePages": "5,8-10"
  },
  {
    "id": "graph_interpretation_10",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "skill": "graph_interpretation",
    "question": "A distance-time graph curves upward and gets steeper over time. What does that show?",
    "expectedAnswer": "The object is speeding up.",
    "workedSteps": "On a distance-time graph, slope means speed. If the slope gets steeper, speed increases.",
    "answerType": "conceptual",
    "tags": [
      "graph",
      "speeding up",
      "distance-time"
    ],
    "sourcePages": "5,8-10,18-19"
  },
  {
    "id": "acceleration_11",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "skill": "acceleration",
    "question": "A scooter speeds up from 4 m/s to 16 m/s in 3 s. What is its acceleration?",
    "expectedAnswer": "4 m/s^2",
    "workedSteps": "a = (vf - vi)/t = (16 - 4)/3 = 4 m/s^2.",
    "answerType": "numeric",
    "tags": [
      "acceleration",
      "speeding up"
    ],
    "sourcePages": "11,13,18-19"
  },
  {
    "id": "negative_acceleration_12",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "skill": "negative_acceleration",
    "question": "A skateboarder slows from 12 m/s to 0 m/s in 4 s. What is the acceleration?",
    "expectedAnswer": "-3 m/s^2",
    "workedSteps": "a = (0 - 12)/4 = -3 m/s^2. Negative shows the velocity decreased.",
    "answerType": "numeric",
    "tags": [
      "acceleration",
      "slowing down",
      "stop"
    ],
    "sourcePages": "11,13,18-19"
  },
  {
    "id": "final_velocity_13",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "skill": "final_velocity",
    "question": "A cart starts at 3 m/s and accelerates at 2 m/s^2 for 5 s. What final velocity does it reach?",
    "expectedAnswer": "13 m/s",
    "workedSteps": "vf = vi + a*t = 3 + 2*5 = 13 m/s.",
    "answerType": "numeric",
    "tags": [
      "final velocity",
      "acceleration"
    ],
    "sourcePages": "11,13,18-19"
  },
  {
    "id": "from_rest_14",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "skill": "from_rest",
    "question": "A toy car starts from rest and reaches 9 m/s in 3 s. What is its acceleration?",
    "expectedAnswer": "3 m/s^2",
    "workedSteps": "From rest means vi = 0. a = (9 - 0)/3 = 3 m/s^2.",
    "answerType": "numeric",
    "tags": [
      "from rest",
      "acceleration"
    ],
    "sourcePages": "11,13"
  },
  {
    "id": "velocity_time_graph_15",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "skill": "velocity_time_graph",
    "question": "On a velocity-time graph, velocity increases from 0 m/s to 30 m/s in 10 s. What is the acceleration?",
    "expectedAnswer": "3 m/s^2",
    "workedSteps": "Acceleration is slope on a velocity-time graph: (30 - 0)/10 = 3 m/s^2.",
    "answerType": "numeric",
    "tags": [
      "graph",
      "velocity-time",
      "slope"
    ],
    "sourcePages": "12,14,18-19"
  },
  {
    "id": "velocity_time_graph_16",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "skill": "velocity_time_graph",
    "question": "A velocity-time graph is a flat horizontal line at 6 m/s. What is the acceleration?",
    "expectedAnswer": "0 m/s^2",
    "workedSteps": "Velocity is constant, so the slope is 0. Acceleration is 0 m/s^2.",
    "answerType": "conceptual_numeric",
    "tags": [
      "graph",
      "constant velocity",
      "zero acceleration"
    ],
    "sourcePages": "12,14,18-19"
  },
  {
    "id": "ways_to_accelerate_17",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "skill": "ways_to_accelerate",
    "question": "List three ways an object can accelerate.",
    "expectedAnswer": "It can speed up, slow down, or change direction.",
    "workedSteps": "Acceleration is any change in velocity. Velocity includes speed and direction.",
    "answerType": "conceptual",
    "tags": [
      "acceleration",
      "velocity",
      "direction"
    ],
    "sourcePages": "1,11,18"
  },
  {
    "id": "net_force_opposite_18",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "net_force_opposite",
    "question": "Two forces act on a box: 12 N right and 5 N left. What is the net force?",
    "expectedAnswer": "7 N right",
    "workedSteps": "Opposite directions subtract: 12 - 5 = 7 N. Direction is right because 12 N is larger.",
    "answerType": "numeric_with_direction",
    "tags": [
      "net force",
      "force diagram"
    ],
    "sourcePages": "24,37"
  },
  {
    "id": "net_force_same_opposite_19",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "net_force_same_opposite",
    "question": "Two students push a cart to the right with 20 N each. Another student pushes left with 15 N. What is the net force?",
    "expectedAnswer": "25 N right",
    "workedSteps": "Add same direction first: 20 + 20 = 40 N right. Subtract the opposite force: 40 - 15 = 25 N right.",
    "answerType": "numeric_with_direction",
    "tags": [
      "net force",
      "same direction",
      "opposite direction"
    ],
    "sourcePages": "24"
  },
  {
    "id": "balanced_forces_20",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "balanced_forces",
    "question": "A box has 10 N pushing right and 10 N pushing left. Are the forces balanced or unbalanced? What is the net force?",
    "expectedAnswer": "Balanced; net force = 0 N.",
    "workedSteps": "Equal opposite forces cancel out, so the net force is 0 N and motion does not change.",
    "answerType": "conceptual_numeric",
    "tags": [
      "balanced forces",
      "net force"
    ],
    "sourcePages": "20,24"
  },
  {
    "id": "newton_1st_law_21",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "newton_1st_law",
    "question": "A backpack left on the floor stays there until someone picks it up. Which law does this show?",
    "expectedAnswer": "Newton's 1st Law / law of inertia.",
    "workedSteps": "An object at rest stays at rest unless an unbalanced force acts on it.",
    "answerType": "law_identification",
    "tags": [
      "Newton 1",
      "inertia",
      "rest"
    ],
    "sourcePages": "24-25,28,31"
  },
  {
    "id": "inertia_ranking_22",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "inertia_ranking",
    "question": "Rank these from least inertia to most inertia: feather, baseball, bicycle, car.",
    "expectedAnswer": "feather, baseball, bicycle, car",
    "workedSteps": "Inertia depends mainly on mass. Rank from smallest mass to largest mass.",
    "answerType": "ranking",
    "tags": [
      "inertia",
      "mass"
    ],
    "sourcePages": "24,37"
  },
  {
    "id": "friction_types_23",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "friction_types",
    "question": "A book is sliding across a table and slows down. What type of friction is acting?",
    "expectedAnswer": "Sliding friction.",
    "workedSteps": "The surfaces are moving/sliding past each other, so it is sliding friction.",
    "answerType": "conceptual",
    "tags": [
      "friction",
      "sliding friction"
    ],
    "sourcePages": "21,25"
  },
  {
    "id": "air_resistance_24",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "air_resistance",
    "question": "A flat paper and a crumpled paper with the same mass are dropped. Which usually lands first and why?",
    "expectedAnswer": "The crumpled paper usually lands first because it has less air resistance.",
    "workedSteps": "Shape changes how much air pushes against the paper. Less air resistance means it falls more like other objects near Earth.",
    "answerType": "conceptual",
    "tags": [
      "air resistance",
      "falling objects"
    ],
    "sourcePages": "21,25"
  },
  {
    "id": "newton_2nd_force_25",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "newton_2nd_force",
    "question": "A 12 kg object accelerates at 4 m/s^2. What net force acts on it?",
    "expectedAnswer": "48 N",
    "workedSteps": "F = m*a = 12 kg * 4 m/s^2 = 48 N.",
    "answerType": "numeric",
    "tags": [
      "F=ma",
      "force"
    ],
    "sourcePages": "22,27,37"
  },
  {
    "id": "newton_2nd_acceleration_26",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "newton_2nd_acceleration",
    "question": "A 40 N net force acts on a 10 kg cart. What is the acceleration?",
    "expectedAnswer": "4 m/s^2",
    "workedSteps": "a = F/m = 40 N / 10 kg = 4 m/s^2.",
    "answerType": "numeric",
    "tags": [
      "F=ma",
      "acceleration"
    ],
    "sourcePages": "22,27,37"
  },
  {
    "id": "newton_2nd_mass_27",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "newton_2nd_mass",
    "question": "An object experiences a 90 N net force and accelerates at 3 m/s^2. What is its mass?",
    "expectedAnswer": "30 kg",
    "workedSteps": "m = F/a = 90 N / 3 m/s^2 = 30 kg.",
    "answerType": "numeric",
    "tags": [
      "F=ma",
      "mass"
    ],
    "sourcePages": "27,37"
  },
  {
    "id": "two_step_force_28",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "two_step_force",
    "question": "A 5 kg drone speeds up from 2 m/s to 14 m/s in 4 s. What net force caused the change?",
    "expectedAnswer": "15 N",
    "workedSteps": "First find acceleration: a = (14 - 2)/4 = 3 m/s^2. Then F = m*a = 5*3 = 15 N.",
    "answerType": "numeric",
    "tags": [
      "two-step",
      "acceleration",
      "F=ma"
    ],
    "sourcePages": "27,37"
  },
  {
    "id": "weight_29",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "weight",
    "question": "What is the weight of a 25 kg object on Earth?",
    "expectedAnswer": "245 N",
    "workedSteps": "W = m*g = 25 kg * 9.8 m/s^2 = 245 N.",
    "answerType": "numeric",
    "tags": [
      "weight",
      "gravity",
      "9.8"
    ],
    "sourcePages": "23,27,37"
  },
  {
    "id": "mass_from_weight_30",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "mass_from_weight",
    "question": "A falling object has a weight of 196 N near Earth. What is its mass?",
    "expectedAnswer": "20 kg",
    "workedSteps": "m = W/g = 196 N / 9.8 m/s^2 = 20 kg.",
    "answerType": "numeric",
    "tags": [
      "weight",
      "mass",
      "gravity"
    ],
    "sourcePages": "27,37"
  },
  {
    "id": "newton_3rd_law_31",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "newton_3rd_law",
    "question": "A swimmer pushes water backward and moves forward. Which law does this show?",
    "expectedAnswer": "Newton's 3rd Law.",
    "workedSteps": "The swimmer pushes water backward; the water pushes the swimmer forward with an equal and opposite force.",
    "answerType": "law_identification",
    "tags": [
      "Newton 3",
      "action reaction"
    ],
    "sourcePages": "23,26,28,31,36"
  },
  {
    "id": "newton_3rd_law_32",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "newton_3rd_law",
    "question": "In a balloon rocket, air rushes backward out of the balloon and the balloon moves forward. Which force is the reaction force?",
    "expectedAnswer": "The balloon moving forward is the reaction to the air being pushed backward.",
    "workedSteps": "Action: balloon pushes air backward. Reaction: air pushes balloon forward.",
    "answerType": "conceptual",
    "tags": [
      "Newton 3",
      "balloon rocket"
    ],
    "sourcePages": "26,34-36"
  },
  {
    "id": "momentum_33",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "momentum",
    "question": "Find the momentum of a 60 kg skateboarder moving at 5 m/s.",
    "expectedAnswer": "300 kg*m/s",
    "workedSteps": "p = m*v = 60 kg * 5 m/s = 300 kg*m/s.",
    "answerType": "numeric",
    "tags": [
      "momentum",
      "p=mv"
    ],
    "sourcePages": "23,32,37"
  },
  {
    "id": "velocity_from_momentum_34",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "velocity_from_momentum",
    "question": "An 8 kg object has 40 kg*m/s of momentum. How fast is it moving?",
    "expectedAnswer": "5 m/s",
    "workedSteps": "v = p/m = 40 / 8 = 5 m/s.",
    "answerType": "numeric",
    "tags": [
      "momentum",
      "velocity"
    ],
    "sourcePages": "32,37"
  },
  {
    "id": "mass_from_momentum_35",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "mass_from_momentum",
    "question": "A ball has 18 kg*m/s of momentum and moves at 6 m/s. What is its mass?",
    "expectedAnswer": "3 kg",
    "workedSteps": "m = p/v = 18 / 6 = 3 kg.",
    "answerType": "numeric",
    "tags": [
      "momentum",
      "mass"
    ],
    "sourcePages": "32,37"
  },
  {
    "id": "momentum_transfer_36",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "momentum_transfer",
    "question": "A 10 kg cart moving at 2 m/s transfers all its momentum to a 5 kg cart. What is the 5 kg cart's speed after?",
    "expectedAnswer": "4 m/s",
    "workedSteps": "Initial momentum = 10*2 = 20 kg*m/s. Set 20 = 5*v, so v = 4 m/s.",
    "answerType": "numeric",
    "tags": [
      "conservation of momentum",
      "collision"
    ],
    "sourcePages": "31-32"
  },
  {
    "id": "law_identification_37",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "law_identification",
    "question": "A motorcycle accelerates faster than a loaded truck when the same size force is applied. Which law best explains this?",
    "expectedAnswer": "Newton's 2nd Law.",
    "workedSteps": "With the same force, the lower-mass object has greater acceleration.",
    "answerType": "law_identification",
    "tags": [
      "Newton 2",
      "mass",
      "acceleration"
    ],
    "sourcePages": "28,31,34-36"
  },
  {
    "id": "law_identification_38",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "law_identification",
    "question": "A soccer ball rolls across grass and eventually stops. Which law and force are involved?",
    "expectedAnswer": "Newton's 1st Law with friction acting as the unbalanced force.",
    "workedSteps": "The ball would keep moving, but friction from the grass changes its motion and slows it down.",
    "answerType": "law_identification",
    "tags": [
      "Newton 1",
      "friction"
    ],
    "sourcePages": "24-25,28,31,36"
  },
  {
    "id": "gravity_39",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "skill": "gravity",
    "question": "Ignoring air resistance, what acceleration should a dropped apple and tennis ball have near Earth?",
    "expectedAnswer": "Both accelerate at about 9.8 m/s^2 downward.",
    "workedSteps": "Near Earth, falling objects have the same acceleration due to gravity if air resistance is ignored.",
    "answerType": "conceptual_numeric",
    "tags": [
      "gravity",
      "9.8",
      "falling objects"
    ],
    "sourcePages": "25,31"
  }
];

module.exports = problemBank;
