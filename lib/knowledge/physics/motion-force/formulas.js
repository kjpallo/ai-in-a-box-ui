const formulas = [
  {
    "id": "speed",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "name": "speed",
    "equation": "s = d / t",
    "solveFor": [
      "speed"
    ],
    "variables": [
      "s speed",
      "d distance",
      "t time"
    ],
    "units": [
      "m/s",
      "km/hr",
      "mi/hr",
      "etc."
    ],
    "rearrangements": [
      "d = s*t",
      "t = d/s"
    ],
    "triggerPhrases": [
      "speed",
      "how fast",
      "distance in time",
      "how long",
      "how far"
    ],
    "studentSteps": [
      "Identify distance and time",
      "divide distance by time",
      "include units."
    ],
    "sourcePages": "3-4,7,18"
  },
  {
    "id": "distance_from_speed_and_time",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "name": "distance from speed and time",
    "equation": "d = s*t",
    "solveFor": [
      "distance"
    ],
    "variables": [
      "d distance",
      "s speed",
      "t time"
    ],
    "units": [
      "m",
      "km",
      "mi"
    ],
    "rearrangements": [
      "s = d/t",
      "t = d/s"
    ],
    "triggerPhrases": [
      "how far",
      "travels at speed for time",
      "cover ground"
    ],
    "studentSteps": [
      "Multiply speed by time",
      "keep time units consistent with speed units."
    ],
    "sourcePages": "7,18"
  },
  {
    "id": "time_from_distance_and_speed",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "name": "time from distance and speed",
    "equation": "t = d / s",
    "solveFor": [
      "time"
    ],
    "variables": [
      "t time",
      "d distance",
      "s speed"
    ],
    "units": [
      "seconds",
      "hours",
      "minutes"
    ],
    "rearrangements": [
      "s = d/t",
      "d = s*t"
    ],
    "triggerPhrases": [
      "how long",
      "time it takes",
      "travel distance at speed"
    ],
    "studentSteps": [
      "Divide distance by speed",
      "include time units."
    ],
    "sourcePages": "3,7"
  },
  {
    "id": "velocity",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "name": "velocity",
    "equation": "v = d / t plus direction",
    "solveFor": [
      "velocity"
    ],
    "variables": [
      "v velocity",
      "d displacement/distance in a direction",
      "t time"
    ],
    "units": [
      "m/s north",
      "km/hr east",
      "etc."
    ],
    "rearrangements": [
      "d = v*t",
      "t = d/v"
    ],
    "triggerPhrases": [
      "velocity",
      "speed with direction",
      "north/south/east/west"
    ],
    "studentSteps": [
      "Find speed, then attach the correct direction."
    ],
    "sourcePages": "3,7,18"
  },
  {
    "id": "straight_line_displacement_by_pythagorean_theorem",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "name": "straight-line displacement by Pythagorean theorem",
    "equation": "c = sqrt(a^2 + b^2)",
    "solveFor": [
      "displacement magnitude"
    ],
    "variables": [
      "a one direction leg",
      "b perpendicular leg",
      "c straight-line displacement"
    ],
    "units": [
      "same as distance unit"
    ],
    "rearrangements": [
      "a = sqrt(c^2-b^2)",
      "b = sqrt(c^2-a^2)"
    ],
    "triggerPhrases": [
      "east then north",
      "west then south",
      "straight-line displacement",
      "resultant"
    ],
    "studentSteps": [
      "Add path for distance",
      "use Pythagorean theorem for displacement",
      "include compass direction."
    ],
    "sourcePages": "2,6,18"
  },
  {
    "id": "acceleration",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "name": "acceleration",
    "equation": "a = (v_f - v_i) / t",
    "solveFor": [
      "acceleration"
    ],
    "variables": [
      "a acceleration",
      "vf final velocity",
      "vi initial velocity",
      "t time"
    ],
    "units": [
      "m/s^2",
      "km/hr^2",
      "mi/hr^2"
    ],
    "rearrangements": [
      "vf = vi + a*t",
      "vi = vf - a*t",
      "t = (vf-vi)/a"
    ],
    "triggerPhrases": [
      "accelerates from",
      "speeds up from",
      "slows down from",
      "comes to a stop",
      "acceleration"
    ],
    "studentSteps": [
      "Subtract initial velocity from final velocity",
      "divide by time",
      "negative means slowing or opposite direction."
    ],
    "sourcePages": "11-14,18-19"
  },
  {
    "id": "final_velocity",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "name": "final velocity",
    "equation": "v_f = v_i + a*t",
    "solveFor": [
      "final velocity"
    ],
    "variables": [
      "vf final velocity",
      "vi initial velocity",
      "a acceleration",
      "t time"
    ],
    "units": [
      "m/s",
      "km/hr",
      "mi/hr"
    ],
    "rearrangements": [
      "a = (vf-vi)/t",
      "t = (vf-vi)/a",
      "vi = vf-a*t"
    ],
    "triggerPhrases": [
      "final speed",
      "reaches what speed",
      "starting from rest",
      "accelerates for"
    ],
    "studentSteps": [
      "Multiply acceleration by time",
      "add initial velocity."
    ],
    "sourcePages": "11,13,18-19"
  },
  {
    "id": "newton_s_2nd_law_force",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "name": "Newton's 2nd Law force",
    "equation": "F = m*a",
    "solveFor": [
      "force"
    ],
    "variables": [
      "F net force",
      "m mass",
      "a acceleration"
    ],
    "units": [
      "N = kg*m/s^2"
    ],
    "rearrangements": [
      "m = F/a",
      "a = F/m"
    ],
    "triggerPhrases": [
      "force",
      "net force",
      "mass and acceleration",
      "Newton's second law"
    ],
    "studentSteps": [
      "Multiply mass by acceleration",
      "answer in newtons."
    ],
    "sourcePages": "22,27,37"
  },
  {
    "id": "newton_s_2nd_law_mass",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "name": "Newton's 2nd Law mass",
    "equation": "m = F / a",
    "solveFor": [
      "mass"
    ],
    "variables": [
      "m mass",
      "F force",
      "a acceleration"
    ],
    "units": [
      "kg"
    ],
    "rearrangements": [
      "F = m*a",
      "a = F/m"
    ],
    "triggerPhrases": [
      "what mass",
      "force and acceleration",
      "object experiencing net force"
    ],
    "studentSteps": [
      "Divide force by acceleration",
      "answer in kilograms."
    ],
    "sourcePages": "27,37"
  },
  {
    "id": "newton_s_2nd_law_acceleration",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "name": "Newton's 2nd Law acceleration",
    "equation": "a = F / m",
    "solveFor": [
      "acceleration"
    ],
    "variables": [
      "a acceleration",
      "F net force",
      "m mass"
    ],
    "units": [
      "m/s^2"
    ],
    "rearrangements": [
      "F = m*a",
      "m = F/a"
    ],
    "triggerPhrases": [
      "what acceleration",
      "horizontal force applied",
      "mass and force"
    ],
    "studentSteps": [
      "Divide net force by mass",
      "answer in m/s^2."
    ],
    "sourcePages": "22,27,37"
  },
  {
    "id": "weight_near_earth",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "name": "weight near Earth",
    "equation": "W = m*g",
    "solveFor": [
      "weight"
    ],
    "variables": [
      "W weight",
      "m mass",
      "g gravitational field strength near Earth"
    ],
    "units": [
      "N"
    ],
    "rearrangements": [
      "m = W/g",
      "g = W/m"
    ],
    "triggerPhrases": [
      "weigh",
      "weight",
      "falling object",
      "force of gravity",
      "mass from weight"
    ],
    "studentSteps": [
      "Use g = 9.8 m/s^2 near Earth unless the problem gives another value",
      "multiply mass by 9.8."
    ],
    "sourcePages": "23,27,37"
  },
  {
    "id": "momentum",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "name": "momentum",
    "equation": "p = m*v",
    "solveFor": [
      "momentum"
    ],
    "variables": [
      "p momentum",
      "m mass",
      "v velocity"
    ],
    "units": [
      "kg*m/s"
    ],
    "rearrangements": [
      "m = p/v",
      "v = p/m"
    ],
    "triggerPhrases": [
      "momentum",
      "mass and velocity",
      "moving object",
      "collision"
    ],
    "studentSteps": [
      "Multiply mass by velocity",
      "include kg*m/s."
    ],
    "sourcePages": "23,32,37"
  },
  {
    "id": "momentum_mass",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "name": "momentum mass",
    "equation": "m = p / v",
    "solveFor": [
      "mass"
    ],
    "variables": [
      "m mass",
      "p momentum",
      "v velocity"
    ],
    "units": [
      "kg"
    ],
    "rearrangements": [
      "p = m*v",
      "v = p/m"
    ],
    "triggerPhrases": [
      "mass from momentum",
      "has momentum when thrown with velocity"
    ],
    "studentSteps": [
      "Divide momentum by velocity."
    ],
    "sourcePages": "32,37"
  },
  {
    "id": "momentum_velocity",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "name": "momentum velocity",
    "equation": "v = p / m",
    "solveFor": [
      "velocity"
    ],
    "variables": [
      "v velocity",
      "p momentum",
      "m mass"
    ],
    "units": [
      "m/s"
    ],
    "rearrangements": [
      "p = m*v",
      "m = p/v"
    ],
    "triggerPhrases": [
      "speed from momentum",
      "how fast",
      "momentum and mass"
    ],
    "studentSteps": [
      "Divide momentum by mass."
    ],
    "sourcePages": "32,37"
  },
  {
    "id": "simple_momentum_transfer",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "name": "simple momentum transfer",
    "equation": "m1*v1 = m2*v2",
    "solveFor": [
      "post-collision velocity in simple transfer problems"
    ],
    "variables": [
      "m1 first mass",
      "v1 first velocity",
      "m2 second mass",
      "v2 second velocity"
    ],
    "units": [
      "kg and m/s"
    ],
    "rearrangements": [
      "v2 = (m1*v1)/m2"
    ],
    "triggerPhrases": [
      "transfers all momentum",
      "collision",
      "stationary object",
      "conservation of momentum"
    ],
    "studentSteps": [
      "Find initial momentum",
      "set it equal to final momentum of second object",
      "solve for final velocity."
    ],
    "sourcePages": "31-32"
  },
  {
    "id": "net_force_from_opposite_directions",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "name": "net force from opposite directions",
    "equation": "F_net = F_right - F_left",
    "solveFor": [
      "net force with direction"
    ],
    "variables": [
      "forces in opposite directions"
    ],
    "units": [
      "N"
    ],
    "rearrangements": [
      "Use signed values or subtract smaller from larger and keep direction of larger force."
    ],
    "triggerPhrases": [
      "net force",
      "forces acting left and right",
      "balanced",
      "unbalanced",
      "diagram"
    ],
    "studentSteps": [
      "Add forces in the same direction",
      "subtract opposite directions",
      "direction points toward the greater force."
    ],
    "sourcePages": "24,27,37"
  },
  {
    "id": "average_velocity_in_runner_lab",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "name": "average velocity in runner lab",
    "equation": "v_avg = distance / average_time",
    "solveFor": [
      "average velocity at a marker"
    ],
    "variables": [
      "distance marker",
      "average time from trials"
    ],
    "units": [
      "yd/s or m/s"
    ],
    "rearrangements": [
      "average time = distance / v_avg"
    ],
    "triggerPhrases": [
      "runner lab",
      "average times",
      "distance marker",
      "velocity calculation"
    ],
    "studentSteps": [
      "Average trial times first",
      "divide distance by average time for each marker."
    ],
    "sourcePages": "15-17"
  },
  {
    "id": "balloon_rocket_force",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "name": "balloon rocket force",
    "equation": "F = m*a",
    "solveFor": [
      "force of balloon rocket"
    ],
    "variables": [
      "F force",
      "m rocket mass",
      "a acceleration"
    ],
    "units": [
      "N"
    ],
    "rearrangements": [
      "a = F/m",
      "m = F/a"
    ],
    "triggerPhrases": [
      "balloon rocket",
      "mass affects acceleration and force",
      "lab calculations"
    ],
    "studentSteps": [
      "Calculate speed and acceleration from data, then multiply mass by acceleration."
    ],
    "sourcePages": "34-36"
  }
];

module.exports = formulas;
