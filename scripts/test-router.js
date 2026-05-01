const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { routeStudentQuestion } = require('../lib/router/questionRouter');

const teacherFactsPath = path.join(__dirname, '..', 'knowledge', 'teacher_facts.json');
const teacherFactsRaw = JSON.parse(fs.readFileSync(teacherFactsPath, 'utf8'));
const teacherFacts = Array.isArray(teacherFactsRaw) ? teacherFactsRaw : teacherFactsRaw.items;

function factById(id) {
  const item = teacherFacts.find((fact) => fact.id === id);
  assert.ok(item, `Missing teacher fact with id: ${id}`);

  return {
    id: item.id,
    category: item.category || 'reference',
    title: item.title || item.term || id,
    terms: Array.isArray(item.terms) ? item.terms : [],
    fact: item.fact || item.definition || item.text || '',
    formula: item.formula || '',
    examples: Array.isArray(item.examples) ? item.examples : [],
    source: item.source || 'Teacher-created local knowledge base',
    score: 30,
    exactTermMatch: true,
    exactTitleMatch: false,
    importantKeywordMatches: 1,
    strongEnoughMatch: true
  };
}

const weightFact = factById('weight-definition');
const gravityFact = factById('gravity-earth-acceleration');

const tests = [
  {
    name: 'acceleration starts from rest clean parser',
    question: 'A skateboarder starts from rest and reaches a speed of 12 m/s in 4 seconds. Question: What is the skateboarder acceleration?',
    type: 'science_formula',
    includes: ['a = (12 m/s - 0 m/s) / 4 s', '3 m/s²'],
    aiAllowed: false
  },
  {
    name: 'acceleration moving then reaches clean parser',
    question: 'A bicyclist is moving at 6 m/s. After pedaling harder, the bicyclist reaches 18 m/s in 6 seconds. Question: What is the bicyclist acceleration?',
    type: 'science_formula',
    includes: ['a = (18 m/s - 6 m/s) / 6 s', '2 m/s²'],
    aiAllowed: false
  },
  {
    name: 'acceleration starts at speed and speeds up clean parser',
    question: 'A runner starts at 2 m/s and speeds up to 14 m/s in 4 seconds. Question: What is the runner acceleration?',
    type: 'science_formula',
    includes: ['a = (14 m/s - 2 m/s) / 4 s', '3 m/s²'],
    aiAllowed: false
  },
  {
    name: 'acceleration from starts at speed and speeds up',
    question: 'A runner starts at 2 m/s and speeds up to 14 m/s in 4 seconds. What is the runner acceleration?',
    type: 'science_formula',
    includes: ['a = (14 m/s - 2 m/s) / 4 s', '3 m/s²'],
    aiAllowed: false
  },
  {
    name: 'acceleration from moving at speed to reached speed',
    question: 'A bicyclist is moving at 6 m/s. After pedaling harder, the bicyclist reaches 18 m/s in 6 seconds. What is the bicyclist acceleration?',
    type: 'science_formula',
    includes: ['a = (18 m/s - 6 m/s) / 6 s', '2 m/s²'],
    aiAllowed: false
  },
  {
    name: 'acceleration from sped up until running wording',
    question: 'During soccer practice, Maya was jogging at 3 m/s. She saw the ball coming toward her and sped up until she was running 15 m/s. It took her 6 seconds to reach that speed.',
    type: 'science_formula',
    includes: ['a = (15 m/s - 3 m/s) / 6 s', '2 m/s²'],
    aiAllowed: false
  },
  {
    name: 'acceleration from rest wording',
    question: 'A skateboarder starts from rest and reaches a speed of 12 m/s in 4 seconds. What is the skateboarder\'s acceleration?',
    type: 'science_formula',
    includes: ['a = (12 m/s - 0 m/s) / 4 s', '3 m/s²'],
    aiAllowed: false
  },
  {
    name: 'gravity force wording uses Earth gravity constant, not weight definition',
    question: 'What is the force of gravity?',
    matchedKnowledge: [weightFact, gravityFact],
    type: 'science_formula',
    includes: ['9.8 m/s²', 'Fg = m × g'],
    aiAllowed: false
  },
  {
    name: 'gravity near Earth constant',
    question: 'What is gravity near Earth?',
    matchedKnowledge: [gravityFact],
    type: 'science_formula',
    includes: ['9.8 m/s²'],
    aiAllowed: false
  },
  {
    name: 'g in the weight formula',
    question: 'What is g in the weight formula?',
    matchedKnowledge: [gravityFact, weightFact],
    type: 'science_formula',
    includes: ['9.8 m/s²', 'Fg = m × g'],
    aiAllowed: false
  },
  {
    name: 'weight definition stays a direct teacher fact',
    question: 'What is weight?',
    matchedKnowledge: [weightFact],
    type: 'definition',
    includes: ['Weight is the force of gravity', 'measured in newtons', 'Fg = m × g'],
    aiAllowed: false
  },
  {
    name: 'weight calculation from mass',
    question: 'What is weight if mass is 10 kg?',
    type: 'science_formula',
    includes: ['Fg = m × g', '9.8 m/s²', '98 N'],
    aiAllowed: false
  },
  {
    name: 'atomic number from protons',
    question: 'A carbon atom has 6 protons. Question: What is carbon’s atomic number?',
    type: 'science_formula',
    includes: ['atomic number = number of protons', 'Atomic number = 6'],
    excludes: ['every carbon atom has 6 protons'],
    aiAllowed: false
  },
  {
    name: 'periodic table atomic number for hydrogen',
    question: 'what is hydrogens atomic number',
    type: 'periodic_table',
    includes: ['Hydrogen (H) has atomic number 1', 'Hydrogen has 1 proton'],
    excludes: ['Carbon has atomic number 6', 'every carbon atom has 6 protons'],
    aiAllowed: false
  },
  {
    name: 'periodic table protons for oxygen',
    question: 'How many protons does oxygen have?',
    type: 'periodic_table',
    includes: ['Oxygen (O) has 8 protons', 'Number of protons = atomic number = 8'],
    aiAllowed: false
  },
  {
    name: 'periodic table neutral electrons handles misspelling',
    question: 'how many electons does sodium have in a neutral atom?',
    type: 'periodic_table',
    includes: ['For a neutral Sodium atom, electrons = protons', 'Sodium (Na) has 11 electrons'],
    aiAllowed: false
  },
  {
    name: 'periodic table neutrons estimates from atomic mass',
    question: 'How many newtrons does carbon have?',
    type: 'periodic_table',
    includes: ['Estimate mass number by rounding atomic mass: 12.011 -> 12', 'Neutrons = 12 - 6', 'Neutrons = 6'],
    excludes: ['Carbon has atomic number 6, so every carbon atom has 6 protons'],
    aiAllowed: false
  },
  {
    name: 'periodic table isotope neutrons',
    question: 'How many neutrons does Carbon-14 have?',
    type: 'periodic_table',
    includes: ['Mass number = 14', 'Neutrons = 14 - 6', 'Neutrons = 8'],
    aiAllowed: false
  },
  {
    name: 'periodic table group lookup',
    question: 'What group is chlorine in?',
    type: 'periodic_table',
    includes: ['Chlorine (Cl) is in group 17', 'Group block/family: Halogen'],
    aiAllowed: false
  },
  {
    name: 'periodic table period lookup',
    question: 'What period is magnesium in?',
    type: 'periodic_table',
    includes: ['Magnesium (Mg) is in period 3'],
    aiAllowed: false
  },
  {
    name: 'periodic table atomic mass lookup',
    question: 'What is hydrogen atomic mass?',
    type: 'periodic_table',
    includes: ['Hydrogen (H) has an average atomic mass of 1.008 u'],
    aiAllowed: false
  },
  {
    name: 'chemistry formula',
    question: 'What is NaCl?',
    type: 'chemistry_formula',
    includes: ['sodium chloride'],
    aiAllowed: false
  },
  {
    name: 'chemistry safety question rejects formula lookup',
    question: 'Is sodium chloride safe to eat?',
    type: 'no_match',
    includes: ['trusted local safety fact'],
    excludes: ['sodium chloride, also known as table salt'],
    aiAllowed: false
  },
  {
    name: 'math only',
    question: 'What is 8 times 12?',
    type: 'math_only',
    includes: ['96'],
    aiAllowed: false
  },
  {
    name: 'motion distance from speed and time',
    question: 'If I travel for five hours at a speed of 20 mph what is my distance?',
    type: 'science_formula',
    includes: ['distance = speed × time', '100 miles'],
    aiAllowed: false
  },
  {
    name: 'acceleration from velocity change',
    question: 'A car goes from 10 m/s to 30 m/s in 5 seconds. What is acceleration?',
    type: 'science_formula',
    includes: ['a = (30 m/s - 10 m/s) / 5 s', '4 m/s²'],
    aiAllowed: false
  },
  {
    name: 'force from mass and acceleration',
    question: 'What is force if mass is 10 kg and acceleration is 4 m/s^2?',
    type: 'science_formula',
    includes: ['F = m × a.', '40 N'],
    aiAllowed: false
  },
  {
    name: 'force target beats extra distance and time',
    question: 'A robot moves 10 meters in 2 seconds, but that is extra. Its mass is 5 kg and acceleration is 2 m/s^2. What is the force?',
    type: 'science_formula',
    includes: ['F = 5 kg × 2 m/s²', '10 N'],
    excludes: ['speed = 10 m / 2 s'],
    aiAllowed: false
  },
  {
    name: 'force does not route acceleration unit as potential energy height',
    question: 'A 10 kg object accelerates at 2 m/s² for 4 seconds. What force is needed?',
    type: 'science_formula',
    includes: ['F = 10 kg × 2 m/s²', '20 N'],
    excludes: ['potential energy', 'PE ='],
    aiAllowed: false
  },
  {
    name: 'acceleration after removed mass',
    question: 'A wagon has a mass of 28 kg when it is full of books. A student removes 10 kg of books from the wagon. Then the student pulls the wagon with a force of 54 N. Question: What is the wagon’s acelerashun after the books are removed?',
    type: 'science_formula',
    includes: ['mass = 28 kg - 10 kg', 'mass = 18 kg', 'a = 54 N / 18 kg', '3 m/s²'],
    aiAllowed: false
  },
  {
    name: 'acceleration after taking mass off',
    question: 'A sled has a mass of 35 kg when it is loaded with gear. A student takes 15 kg of gear off the sled. Then the student pulls the sled with a force of 80 N. Question: What is the sled’s acelerashun after the gear is removed?',
    type: 'science_formula',
    includes: ['mass = 35 kg - 15 kg', 'mass = 20 kg', 'a = 80 N / 20 kg', '4 m/s²'],
    aiAllowed: false
  },
  {
    name: 'force problem mentioning water does not route to H2O',
    question: 'A canoe has a mass of 42 kg when it is loaded with fishing gear. Before pushing it into the water, someone removes 14 kg of gear. Then the canoe is pushed with a force of 84 N. Question: What is the canoe’s acelerashun after the gear is removed?',
    type: 'science_formula',
    includes: ['mass = 42 kg - 14 kg', 'mass = 28 kg', 'a = 84 N / 28 kg', '3 m/s²'],
    aiAllowed: false
  },
  {
    name: 'acceleration after unloaded mass',
    question: 'A rolling cart has a mass of 64 kg when it is carrying equipment. A student unloads 24 kg of equipment. Then the student pushes the cart with a force of 120 N. Question: What is the cart’s acelerashun after the equipment is removed?',
    type: 'science_formula',
    includes: ['mass = 64 kg - 24 kg', 'mass = 40 kg', 'a = 120 N / 40 kg', '3 m/s²'],
    aiAllowed: false
  },
  {
    name: 'acceleration after dumped out mass',
    question: 'A wheelbarrow has a mass of 70 kg when it is filled with soil. A gardener dumps out 25 kg of soil. Then the gardener pushes the wheelbarrow with a force of 135 N. Question: What is the wheelbarrow’s acelerashun after the soil is removed?',
    type: 'science_formula',
    includes: ['mass = 70 kg - 25 kg', 'mass = 45 kg', 'a = 135 N / 45 kg', '3 m/s²'],
    aiAllowed: false
  },
  {
    name: 'acceleration after multiple removed masses with extra time trap',
    question: 'During a robotics test, a team is trying to figure out why their robot is not speeding up very quickly. At the start of the test, the robot has a total mass of 95 kg because it is carrying a battery pack, metal plates, and a small toolbox. Before the next run, the team removes 20 kg of metal plates and 15 kg of tools. During the test, the motor pulls the robot forward with a force of 240 N. The robot travels for 4 seconds, but you do not need the time to solve this question. Question: What is the robot’s acelerashun after the extra mass is removed?',
    type: 'science_formula',
    includes: ['mass removed = 20 kg + 15 kg', 'mass removed = 35 kg', 'mass = 95 kg - 35 kg', 'a = 240 N / 60 kg', '4 m/s²'],
    aiAllowed: false
  },
  {
    name: 'force from velocity change and mass',
    question: 'During a robotics test, a robot starts moving at 4 m/s. After the motors run for 5 seconds, the robot reaches a final velocity of 19 m/s. The robot has a mass of 12 kg. Question: What force did the motors apply to the robot?',
    type: 'science_formula',
    includes: ['a = (19 m/s - 4 m/s) / 5 s', 'a = 3 m/s²', 'F = 12 kg × 3 m/s²', 'F = 36 N'],
    aiAllowed: false
  },
  {
    name: 'multi-part kinetic energy at two speeds',
    question: 'During a robotics test, a robot has a mass of 10 kg. Part A: What is the robot’s kinetic energy when it is moving at 4 m/s? Part B: What is the robot’s kinetic energy when it speeds up to 8 m/s?',
    type: 'science_formula',
    includes: ['Part A:', 'KE = 1/2 × 10 kg × (4 m/s)²', 'KE = 80 J', 'Part B:', 'KE = 1/2 × 10 kg × (8 m/s)²', 'KE = 320 J', 'kinetic energy changes from 80 J to 320 J'],
    aiAllowed: false
  },
  {
    name: 'multi-part kinetic energy ignores repeated speeds',
    question: 'During a robotics lab challenge, a small robot is tested on the hallway floor. The robot has a mass of 12 kg. In the first run, it moves at 5 m/s. In the second run, the robot moves at 10 m/s. The robot rolls for 6 seconds and travels 30 meters during one of the tests, but that information is extra and not needed for kinetic energy. Part A: What is the robot’s kinetic energy when it moves at 5 m/s? Part B: What is the robot’s kinetic energy when it moves at 10 m/s?',
    type: 'science_formula',
    includes: ['Part A:', 'KE = 1/2 × 12 kg × (5 m/s)²', 'KE = 150 J', 'Part B:', 'KE = 1/2 × 12 kg × (10 m/s)²', 'KE = 600 J', 'kinetic energy changes from 150 J to 600 J'],
    excludes: ['Part C:', 'Part D:'],
    aiAllowed: false
  },
  {
    name: 'multi-part potential energy ignores extra distance and time',
    question: 'During a science lab challenge, students lift a crate onto different shelves. The crate has a mass of 8 kg. In the first test, the crate is lifted to a height of 2 meters. In the second test, the crate is lifted to a height of 5 meters. The crate is carried across the room for 12 meters and takes 6 seconds to move, but that information is extra and not needed for potential energy. Use gravity = 10 m/s². Part A: What is the crate’s potential energy at 2 meters? Part B: What is the crate’s potential energy at 5 meters?',
    type: 'science_formula',
    includes: ['Part A:', 'PE = 8 kg × 10 m/s² × 2 m', 'PE = 160 J', 'Part B:', 'PE = 8 kg × 10 m/s² × 5 m', 'PE = 400 J', 'potential energy changes from 160 J to 400 J'],
    excludes: ['Part C:', '12 m', '6 s'],
    aiAllowed: false
  },
  {
    name: 'ohms law handles hyphenated word numbers',
    question: 'A small buzzer is connected to a battery that provides twenty-four volts. The buzzer’s circuit has a resistance of eight ohms. Question: How much current flows through the buzzer in amps?',
    type: 'science_formula',
    includes: ['I = 24 V / 8 Ω', 'I = 3 A'],
    excludes: ['-4 V', '-0.5 A'],
    aiAllowed: false
  },
  {
    name: 'ohms law resistance beats electrical power',
    question: 'A small LED strip is connected to a battery that provides thirty volts. The circuit has a current of five amps flowing through it. Question: What is the resistance of the LED strip in ohms?',
    type: 'science_formula',
    includes: ['R = 30 V / 5 A', 'R = 6 Ω'],
    excludes: ['P = 30 V × 5 A', '150 W'],
    aiAllowed: false
  },
  {
    name: 'ohms law voltage ignores extra time and distance',
    question: 'During a circut lab challange, a student is testing a small robot motor. The motor has a resitance of seven ohms, and the current flowing through the motor is four amps. The robot runs for six seconds and travels twelve meters, but that information is extra and not needed to find voltage. Question: What voltage is being supplied to the motor?',
    type: 'science_formula',
    includes: ['V = 4 A × 7 Ω', 'V = 28 V'],
    excludes: ['R = 48 V / 6 A', 'R = 8 Ω', '6 s', '12 m'],
    aiAllowed: false
  },
  {
    name: 'ohms law current adds two battery voltages',
    question: 'During a circut lab, a student connects two batteries together to power a small motor. One battery provides twelve volts and the other battery provides six volts. The motor has a resitance of three ohms. Question: What current flows through the motor in amps?',
    type: 'science_formula',
    includes: ['voltage = 12 V + 6 V', 'voltage = 18 V', 'I = 18 V / 3 Ω', 'I = 6 A'],
    excludes: ['I = 12 V / 3 Ω', 'I = 4 A'],
    aiAllowed: false
  },
  {
    name: 'ohms law current adds two power supply voltages',
    question: 'During a circut test, a student uses two power supplies to run a small fan. The first power supply provides ten volts, and the second power supply provides 8 volts. The fan has a resitance of six ohms. Question: What current flows through the fan in amps?',
    type: 'science_formula',
    includes: ['voltage = 10 V + 8 V', 'voltage = 18 V', 'I = 18 V / 6 Ω', 'I = 3 A'],
    excludes: ['I = 10 V / 6 Ω', 'I = 1.6667 A'],
    aiAllowed: false
  },
  {
    name: 'motion speed ignores force and mass trap',
    question: 'During a phyics lab challange, a student is testing a small toy car on the hallway floor. The car has a mass of 2 kg and is pushed with a force of 10 N, but that information is extra. The car travels 72 meters in 12 seconds. Question: What is the car’s speeed?',
    type: 'science_formula',
    includes: ['speed = 72 m / 12 s', 'speed = 6 m/s'],
    excludes: ['PE = 10 N × 72 m', 'PE = 720 J', 'force × height'],
    aiAllowed: false
  },
  {
    name: 'multi-step acceleration from two distance time runs',
    question: 'During a phyics lab challange, a student is testing a small cart. At the start of the test, the cart travels 24 meters in 6 seconds. Later, after speeding up, the cart travels 60 meters in 5 seconds. The cart took 4 seconds to speed up from the first velocity to the second velocity. Question: What is the cart’s acelerashun?',
    type: 'science_formula',
    includes: ['starting velocity = 24 m / 6 s', 'starting velocity = 4 m/s', 'final velocity = 60 m / 5 s', 'final velocity = 12 m/s', 'a = (12 m/s - 4 m/s) / 4 s', 'a = 2 m/s²'],
    excludes: ['speed = 24 m / 6 s\nspeed = 4 m/s', 'a = (12 m/s - 4 m/s) / 6 s', 'a = 1.3333 m/s²'],
    aiAllowed: false
  },
  {
    name: 'final velocity from initial velocity acceleration and time',
    question: 'During a phyics lab, a small cart starts moving at an initial velocity of 6 m/s. The cart accelerates at 3 m/s² for 5 seconds. Question: What is the cart’s final velocity?',
    type: 'science_formula',
    includes: ['vf = vi + a × t', 'vf = 6 m/s + 3 m/s² × 5 s', 'vf = 6 m/s + 15 m/s', 'vf = 21 m/s'],
    excludes: ['distance = 6 m/s × 5 s', 'distance = 30 m'],
    aiAllowed: false
  },
  {
    name: 'final velocity supports feet per second squared',
    question: 'During a go-kart test, the go-kart is moving at an initial velocity of 10 ft/s. The go-kart accelerates at 4 ft/s² for 6 seconds. Question: What is the go-kart’s final velocity?',
    type: 'science_formula',
    includes: ['vf = 10 ft/s + 4 ft/s² × 6 s', 'vf = 10 ft/s + 24 ft/s', 'vf = 34 ft/s'],
    excludes: ['a = (3.048 m/s - 3.048 m/s) / 6 s', 'a = 0 m/s²'],
    aiAllowed: false
  },
  {
    name: 'specific heat finds heat energy from temperature change',
    question: 'During a science lab, a student heats a 200 g piece of aluminum. The aluminum’s temperature increases from 20°C to 50°C. Aluminum has a specific heat of 0.90 J/g°C. Question: How much heat energy was added to the aluminum?',
    type: 'science_formula',
    includes: ['q = m × c × ΔT', 'ΔT = 50°C - 20°C', 'ΔT = 30°C', 'q = 200 g × 0.9 J/g°C × 30°C', 'q = 5400 J'],
    excludes: ['Near Earth', 'gravity is about 9.8', 'Fg = m × g'],
    aiAllowed: false
  },
  {
    name: 'specific heat solves for mass',
    question: 'During a science lab, a metal sample absorbs 4,800 J of heat energy. Its temperature increases from 20°C to 60°C. The metal has a specific heat of 0.60 J/g°C. Question: What is the mass of the metal sample?',
    type: 'science_formula',
    includes: ['m = q / (c × ΔT)', 'ΔT = 60°C - 20°C', 'ΔT = 40°C', 'm = 4800 J / (0.6 J/g°C × 40°C)', 'm = 4800 J / 24 J/g', 'm = 200 g'],
    excludes: ['I do not have a trusted local science fact', 'Near Earth'],
    aiAllowed: false
  },
  {
    name: 'density uses water displacement for volume',
    question: 'During a science lab, a student measures a small rock. The rock has a mass of 180 g. The student places water in a graduated cylinder. The water starts at 50 mL. After the rock is dropped in, the water level rises to 80 mL. Question: What is the density of the rock?',
    type: 'science_formula',
    includes: ['volume = 80 mL - 50 mL', 'volume = 30 mL', 'D = 180 g / 30 mL', 'D = 6 g/mL'],
    excludes: ['D = 180 g / 50 mL', 'D = 3.6 g/mL'],
    aiAllowed: false
  },
  {
    name: 'density uses rectangular volume from dimensions',
    question: 'A rectangular block has a mass of 120 g. Its length is 5 cm, width is 4 cm, and height is 3 cm. Question: What is the density of the block?',
    type: 'science_formula',
    includes: ['V = L × W × H', 'V = 5 cm × 4 cm × 3 cm', 'V = 60 cm³', 'D = 120 g / 60 cm³', 'D = 2 g/cm³'],
    excludes: ['potential energy', 'PE ='],
    aiAllowed: false
  },
  {
    name: 'volume uses length width height',
    question: 'A rectangular box has a length of 5 cm, a width of 4 cm, and a height of 3 cm. Question: What is the volume of the box?',
    type: 'science_formula',
    includes: ['V = L × W × H', 'V = 5 cm × 4 cm × 3 cm', 'V = 60 cm³'],
    excludes: ['PE ='],
    aiAllowed: false
  },
  {
    name: 'density uses cube side volume',
    question: 'During a science lab, a student measures a small metal cube. The cube has a mass of 216 g. Each side of the cube is 3 cm long. Question: What is the density of the metal cube?',
    type: 'science_formula',
    includes: ['V = side × side × side', 'V = 3 cm × 3 cm × 3 cm', 'V = 27 cm³', 'D = 216 g / 27 cm³', 'D = 8 g/cm³'],
    excludes: ['I do not have a trusted local science fact', 'D = 216 g / 3 cm'],
    aiAllowed: false
  },
  {
    name: 'volume uses cube side',
    question: 'A cube has each side 3 cm long. Question: What is the volume of the cube?',
    type: 'science_formula',
    includes: ['V = side × side × side', 'V = 3 cm × 3 cm × 3 cm', 'V = 27 cm³'],
    excludes: ['PE ='],
    aiAllowed: false
  },
  {
    name: 'density handles misspelled box dimensions in meters',
    question: 'In science class, a student is trying to find the denisty of a box-shaped object but wrote the notes kind of fast. The object is 4 m long, 2 m wide, and 3 m hight. The mass of the object is 96 kg. Question: What is the denisty of the object?',
    type: 'science_formula',
    includes: ['V = 4 m × 2 m × 3 m', 'V = 24 m³', 'D = 96 kg / 24 m³', 'D = 4 kg/m³'],
    excludes: ['Mass is the amount of matter', 'D = 96000 g'],
    aiAllowed: false
  },
  {
    name: 'work from force and distance',
    question: 'During a science lab, a student pushes a box with a force of 50 N. The box moves 6 meters across the floor. Question: How much work did the student do on the box?',
    type: 'science_formula',
    includes: ['W = force × distance', 'W = 50 N × 6 m', 'W = 300 J'],
    excludes: ['work happens when', 'I do not have a trusted local science fact'],
    aiAllowed: false
  },
  {
    name: 'power from work and time remains work power time',
    question: 'During a science lab, a student does 600 J of work to move a box. It takes the student 20 seconds to do the work. Question: What is the student’s power?',
    type: 'science_formula',
    includes: ['P = W / t', 'P = 600 J / 20 s', 'P = 30 W'],
    excludes: ['W = 600 J × 20 s'],
    aiAllowed: false
  },
  {
    name: 'multi-step power from force distance and time',
    question: 'During a science lab, a student pushes a heavy box with a force of 60 N. The box moves 5 meters across the floor. It takes the student 10 seconds to move the box. Question: What is the student’s power?',
    type: 'science_formula',
    includes: ['W = force × distance', 'W = 60 N × 5 m', 'W = 300 J', 'P = W / t', 'P = 300 J / 10 s', 'P = 30 W'],
    excludes: ['speed = 5 m / 10 s', 'speed = 0.5 m/s'],
    aiAllowed: false
  },
  {
    name: 'multi-step power handles powr misspelling',
    question: 'During a phyics lab challange, a student pulls a sled with a force of 60 N. The sled moves 6 meters across the floor. It takes the student 12 seconds to pull it. Question: What is the student’s powr?',
    type: 'science_formula',
    includes: ['W = 60 N × 6 m', 'W = 360 J', 'P = 360 J / 12 s', 'P = 30 W'],
    excludes: ['speed = 6 m / 12 s', 'speed = 0.5 m/s'],
    aiAllowed: false
  }
];

let passed = 0;

for (const test of tests) {
  const route = routeStudentQuestion(test.question, test.matchedKnowledge || []);
  const answerText = String(route.directAnswer || '');

  try {
    assert.equal(route.type, test.type);
    assert.equal(route.aiAllowed, test.aiAllowed);

    for (const expected of test.includes) {
      assert.ok(
        answerText.includes(expected),
        `Expected answer to include "${expected}" but got:\n${answerText}`
      );
    }

    for (const unexpected of test.excludes || []) {
      assert.ok(
        !answerText.includes(unexpected),
        `Expected answer not to include "${unexpected}" but got:\n${answerText}`
      );
    }

    passed += 1;
    console.log(`✅ ${test.name}`);
  } catch (error) {
    console.error(`❌ ${test.name}`);
    console.error(`Question: ${test.question}`);
    console.error(`Route: ${JSON.stringify(route.public, null, 2)}`);
    console.error(`Answer:\n${answerText}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`\n${passed}/${tests.length} router tests passed.`);
process.exit(0);
