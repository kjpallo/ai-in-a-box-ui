const vocabulary = [
  {
    "id": "motion",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "term": "motion",
    "aliases": [
      "movement",
      "change in position"
    ],
    "definition": "A change in an object's position compared with a reference point.",
    "commonMisconception": "Thinking an object is moving without saying what it is moving compared to.",
    "exampleCue": "The car changed position compared with the school.",
    "sourcePages": "1-2,18"
  },
  {
    "id": "reference_point",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "term": "reference point",
    "aliases": [
      "starting point",
      "comparison point"
    ],
    "definition": "The place or object used to tell whether something has changed position.",
    "commonMisconception": "Forgetting that motion depends on what you compare it to.",
    "exampleCue": "The locker room can be the reference point for a runner.",
    "sourcePages": "1-2,18"
  },
  {
    "id": "distance",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "term": "distance",
    "aliases": [
      "total path",
      "total ground covered"
    ],
    "definition": "The total length of the path traveled, no matter what direction the object moved.",
    "commonMisconception": "Using the straight-line change instead of adding the whole path.",
    "commonMistakes": [
      "Do not use total path as displacement.",
      "Do not assume distance and displacement are always the same."
    ],
    "exampleCue": "Walk 20 m north and 20 m south: distance is 40 m.",
    "examples": [
      "Walking around a block and returning home: distance is the path length.",
      "Swimming three pool lengths in a 50 m pool: distance is 150 m."
    ],
    "sourcePages": "1-2,6,18"
  },
  {
    "id": "displacement",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "term": "displacement",
    "aliases": [
      "change in position",
      "straight-line change"
    ],
    "definition": "How far and in what direction an object ends from where it started.",
    "commonMisconception": "Treating displacement like total distance; leaving off direction.",
    "commonMistakes": [
      "Do not use total path as displacement.",
      "Do not forget direction for displacement.",
      "Do not assume distance and displacement are always the same."
    ],
    "exampleCue": "Walk 20 m north and 20 m south: displacement is 0 m.",
    "examples": [
      "Walking around a block and returning home: displacement is 0.",
      "Swimming three pool lengths in a 50 m pool: displacement is 50 m."
    ],
    "sourcePages": "1-2,6,18"
  },
  {
    "id": "speed",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "term": "speed",
    "aliases": [
      "rate of motion"
    ],
    "definition": "How fast something moves; distance divided by time.",
    "commonMisconception": "Adding direction to speed; confusing speed with velocity.",
    "commonMistakes": [
      "Do not treat speed and velocity as identical in every problem.",
      "Do not add direction to speed unless the question asks for velocity."
    ],
    "exampleCue": "A runner travels 100 m in 20 s, so speed is 5 m/s.",
    "sourcePages": "1,3-4,7,18"
  },
  {
    "id": "average_speed",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "term": "average speed",
    "aliases": [
      "overall speed"
    ],
    "definition": "The total distance traveled divided by the total time for the whole trip.",
    "commonMisconception": "Using only one short part of a trip instead of the whole trip.",
    "exampleCue": "Average speed over a trip = total distance ÷ total time.",
    "sourcePages": "1,3,7,10"
  },
  {
    "id": "instantaneous_speed",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "term": "instantaneous speed",
    "aliases": [
      "speed right now"
    ],
    "definition": "The speed of an object at one specific moment.",
    "commonMisconception": "Thinking it must match the average speed for the whole trip.",
    "exampleCue": "A speedometer shows instantaneous speed.",
    "sourcePages": "1,3"
  },
  {
    "id": "velocity",
    "unit": "Motion and Force",
    "concept": "Concept 1: Describing Motion",
    "term": "velocity",
    "aliases": [
      "speed with direction"
    ],
    "definition": "Speed in a specific direction.",
    "commonMisconception": "Leaving off direction; treating velocity as only speed.",
    "commonMistakes": [
      "Do not forget direction for velocity.",
      "Do not treat speed and velocity as identical in every problem."
    ],
    "exampleCue": "20 m/s north is a velocity.",
    "sourcePages": "1,3,7,18"
  },
  {
    "id": "acceleration",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "term": "acceleration",
    "aliases": [
      "change in velocity over time"
    ],
    "definition": "The rate that velocity changes over time. It can happen by speeding up, slowing down, or changing direction.",
    "commonMisconception": "Thinking acceleration only means speeding up.",
    "exampleCue": "A car going from 10 m/s to 30 m/s in 5 s accelerates.",
    "sourcePages": "1,11-14,18-19"
  },
  {
    "id": "positive_acceleration",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "term": "positive acceleration",
    "aliases": [
      "speeding up",
      "increasing velocity"
    ],
    "definition": "Acceleration in the positive direction, often shown as speeding up in classroom examples.",
    "commonMisconception": "Thinking positive always means good or upward instead of direction/sign.",
    "exampleCue": "Velocity increases from 2 m/s to 8 m/s.",
    "sourcePages": "11-14,18-19"
  },
  {
    "id": "negative_acceleration",
    "unit": "Motion and Force",
    "concept": "Concept 2: Acceleration",
    "term": "negative acceleration",
    "aliases": [
      "deceleration",
      "slowing down"
    ],
    "definition": "Acceleration in the negative direction; in basic examples this often means slowing down.",
    "commonMisconception": "Forgetting negative values are expected when an object slows down.",
    "exampleCue": "Velocity decreases from 20 m/s to 0 m/s.",
    "sourcePages": "11-14,18-19"
  },
  {
    "id": "force",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "force",
    "aliases": [
      "push",
      "pull"
    ],
    "definition": "A push or pull one object exerts on another, measured in newtons, that can change an object's motion.",
    "commonMisconception": "Thinking a force is needed to keep motion going when no friction exists.",
    "exampleCue": "Pushing a box applies a force.",
    "sourcePages": "1,20-24,28"
  },
  {
    "id": "net_force",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "net force",
    "aliases": [
      "total force",
      "combined force"
    ],
    "definition": "The combined or overall force on an object after all forces are added together.",
    "commonMisconception": "Adding opposite forces instead of subtracting them; ignoring direction.",
    "exampleCue": "7 N right and 3 N left gives 4 N right.",
    "sourcePages": "1,20,24,27,37"
  },
  {
    "id": "balanced_forces",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "balanced forces",
    "aliases": [
      "zero net force"
    ],
    "definition": "Forces that are equal in size and opposite in direction, so net force is 0 N and motion does not change.",
    "commonMisconception": "Thinking no forces are acting just because the object is not accelerating.",
    "exampleCue": "A book resting on a table has balanced forces.",
    "examples": [
      "A book resting on a table has balanced forces."
    ],
    "sourcePages": "20,24,28"
  },
  {
    "id": "unbalanced_forces",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "unbalanced forces",
    "aliases": [
      "nonzero net force"
    ],
    "definition": "Forces that do not cancel; net force is not 0, so speed, direction, or motion can change.",
    "commonMisconception": "Forgetting that direction matters when finding net force.",
    "exampleCue": "A stronger push to the right than left makes the object accelerate right.",
    "examples": [
      "Pushing a cart so it speeds up is an unbalanced-force example."
    ],
    "sourcePages": "20,24,28"
  },
  {
    "id": "inertia",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "inertia",
    "aliases": [
      "resistance to motion change"
    ],
    "definition": "An object's tendency to resist a change in motion.",
    "commonMisconception": "Thinking faster objects always have more inertia; inertia mainly depends on mass.",
    "exampleCue": "A heavy truck is harder to start or stop than a bicycle.",
    "sourcePages": "1,20,24-25,28,31,37"
  },
  {
    "id": "friction",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "friction",
    "aliases": [
      "opposing force",
      "surface resistance"
    ],
    "definition": "A force that resists motion when surfaces rub, slide, or roll against each other.",
    "commonMisconception": "Thinking friction always stops motion instantly or only happens when an object is moving.",
    "commonMistakes": [
      "Do not confuse friction with electrical resistance.",
      "Do not say friction always stops motion instantly; it resists motion.",
      "Do not confuse air resistance with surface friction."
    ],
    "exampleCue": "Grass slows down a kicked soccer ball.",
    "examples": [
      "Static friction: a book staying still on a desk or shoes gripping the floor before slipping.",
      "Sliding friction: a box sliding across the floor.",
      "Rolling friction: a wheel or ball rolling over a surface."
    ],
    "nonExamples": [
      "Gravity pulling downward is not friction.",
      "A magnet pulling metal is not friction.",
      "Air resistance is drag, related but not surface friction."
    ],
    "sourcePages": "1,21,24-26,31,36"
  },
  {
    "id": "static_friction",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "static friction",
    "aliases": [
      "no-motion friction"
    ],
    "definition": "Friction that keeps an object from starting to move.",
    "commonMisconception": "Forgetting that friction can act before an object slides.",
    "exampleCue": "A box does not move when a small push is applied.",
    "examples": [
      "A book staying still on a desk.",
      "Shoes gripping the floor before slipping."
    ],
    "sourcePages": "21,25"
  },
  {
    "id": "sliding_friction",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "sliding friction",
    "aliases": [
      "kinetic friction in sliding examples"
    ],
    "definition": "Friction between surfaces that are sliding past each other.",
    "commonMisconception": "Confusing sliding friction with rolling friction.",
    "exampleCue": "A book sliding across a desk slows down.",
    "examples": [
      "A box sliding across the floor."
    ],
    "sourcePages": "21,25"
  },
  {
    "id": "rolling_friction",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "rolling friction",
    "aliases": [
      "wheel friction"
    ],
    "definition": "Friction on an object that rolls over a surface.",
    "commonMisconception": "Thinking rolling friction is usually stronger than sliding friction in basic examples.",
    "exampleCue": "A ball rolling across the floor slows down.",
    "examples": [
      "A wheel rolling over a surface.",
      "A ball rolling across the floor."
    ],
    "sourcePages": "21,25"
  },
  {
    "id": "air_resistance",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "air resistance",
    "aliases": [
      "drag"
    ],
    "definition": "Drag, a force that resists motion through air and acts opposite the object's motion.",
    "commonMisconception": "Ignoring shape and surface area when comparing falling objects.",
    "exampleCue": "A flat sheet of paper falls slower than a crumpled paper ball.",
    "sourcePages": "1,21,25,31"
  },
  {
    "id": "gravity",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "gravity",
    "aliases": [
      "gravitational force"
    ],
    "definition": "The attraction between masses.",
    "commonMisconception": "Thinking heavier objects fall faster when air resistance is ignored.",
    "exampleCue": "Earth pulls objects downward.",
    "sourcePages": "22,25,31"
  },
  {
    "id": "law_of_universal_gravitation",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "Law of Universal Gravitation",
    "aliases": [
      "universal gravity law"
    ],
    "definition": "Any two masses attract each other; more mass and less distance make gravitational attraction stronger.",
    "commonMisconception": "Thinking gravity only exists on Earth.",
    "exampleCue": "A satellite stays in orbit because of Earth's gravity.",
    "sourcePages": "1,22-23,31"
  },
  {
    "id": "terminal_velocity",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "terminal velocity",
    "aliases": [
      "maximum falling speed in air"
    ],
    "definition": "The maximum velocity a falling object reaches when gravity and air resistance balance, so net force and acceleration are 0.",
    "commonMisconception": "Thinking the object stops falling when forces balance; it keeps moving at constant speed.",
    "exampleCue": "A skydiver eventually falls at constant speed before opening the parachute.",
    "sourcePages": "1,22"
  },
  {
    "id": "weight",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "weight",
    "aliases": [
      "gravitational force on mass"
    ],
    "definition": "The force of gravity on an object; it can change when location or gravity changes.",
    "commonMisconception": "Confusing weight with mass; weight is measured in newtons.",
    "exampleCue": "A 10 kg object weighs about 98 N on Earth.",
    "sourcePages": "1,23,27,37"
  },
  {
    "id": "mass",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "mass",
    "aliases": [
      "amount of matter"
    ],
    "definition": "The amount of matter in an object; mass is different from weight.",
    "commonMisconception": "Treating mass and weight as the same measurement.",
    "exampleCue": "Mass is measured in kilograms.",
    "sourcePages": "23-24,27,28,32,37"
  },
  {
    "id": "momentum",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "momentum",
    "aliases": [
      "mass times velocity"
    ],
    "definition": "Mass in motion, found by multiplying mass by velocity.",
    "commonMisconception": "Thinking only speed matters; mass matters too.",
    "exampleCue": "A heavy truck moving fast has a lot of momentum.",
    "sourcePages": "1,23,31-32,37"
  },
  {
    "id": "law_of_conservation_of_momentum",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "Law of Conservation of Momentum",
    "aliases": [
      "momentum conservation"
    ],
    "definition": "In a collision, momentum is conserved; it is transferred between objects, not created or destroyed.",
    "commonMisconception": "Thinking momentum disappears in a collision instead of transferring or changing forms with outside effects.",
    "exampleCue": "A cue ball transfers momentum to an 8 ball.",
    "sourcePages": "1,23,31-32"
  },
  {
    "id": "newton_s_1st_law",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "Newton's 1st Law",
    "aliases": [
      "law of inertia"
    ],
    "definition": "An object at rest stays at rest and an object in motion stays in motion unless acted on by an unbalanced force.",
    "commonMisconception": "Thinking moving objects need a continued force even without friction.",
    "exampleCue": "A passenger keeps moving forward when a bike stops suddenly.",
    "examples": [
      "A soccer ball stays still until kicked."
    ],
    "sourcePages": "20,24-25,28,31,36"
  },
  {
    "id": "newton_s_2nd_law",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "Newton's 2nd Law",
    "aliases": [
      "F=ma"
    ],
    "definition": "Force equals mass times acceleration: F = m × a.",
    "commonMisconception": "Forgetting that more mass means less acceleration if force stays the same.",
    "exampleCue": "A lighter object accelerates more than a heavier object with the same force.",
    "examples": [
      "The same push accelerates a lighter cart more than a heavier cart."
    ],
    "sourcePages": "22,27-28,31,34-37"
  },
  {
    "id": "newton_s_3rd_law",
    "unit": "Motion and Force",
    "concept": "Concept 3: Newton's Laws and Force",
    "term": "Newton's 3rd Law",
    "aliases": [
      "action-reaction law"
    ],
    "definition": "For every action force, there is an equal and opposite reaction force.",
    "commonMisconception": "Thinking action and reaction forces act on the same object; they act on different objects.",
    "commonMistakes": [
      "Third-law force pairs act on different objects.",
      "Balanced forces are not the same thing as third-law pairs.",
      "More mass means less acceleration for the same force."
    ],
    "exampleCue": "Air moves backward from a balloon, and the balloon moves forward.",
    "examples": [
      "A swimmer pushes water backward and the water pushes the swimmer forward."
    ],
    "sourcePages": "23,26,28,31,34-36"
  }
];

module.exports = vocabulary;
