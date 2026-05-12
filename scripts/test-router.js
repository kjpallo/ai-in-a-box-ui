const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const {
  nextPendingClarification,
  resolvePendingClarification
} = require('../lib/router/pendingClarification');

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
const densityFact = factById('density');
const massFact = factById('mass-definition');

const tests = [
  {
    name: 'phase 7a vocab net force',
    question: 'what is net force',
    type: 'definition',
    includes: ['Net force is the overall force', 'combined'],
    aiAllowed: false
  },
  {
    name: 'phase 7a vocab balanced force',
    question: 'define balanced force',
    type: 'definition',
    includes: ['Balanced forces are equal forces in opposite directions', 'net force is 0 N'],
    aiAllowed: false
  },
  {
    name: 'phase 7a vocab friction',
    question: 'what is friction',
    type: 'definition',
    includes: ['Friction is a force that resists motion'],
    aiAllowed: false
  },
  {
    name: 'phase 7a vocab coefficient of friction',
    question: 'what is coefficient of friction',
    type: 'definition',
    includes: ['coefficient of friction tells how strongly two surfaces grip each other'],
    aiAllowed: false
  },
  {
    name: 'phase 7a vocab normal force',
    question: 'what is normal force',
    type: 'definition',
    includes: ['Normal force is the support force', 'perpendicular'],
    aiAllowed: false
  },
  {
    name: 'phase 7a vocab displacement',
    question: 'what is displacement',
    type: 'definition',
    includes: ['Displacement is how far and in what direction', 'where it started'],
    aiAllowed: false
  },
  {
    name: 'phase 7a vocab distance displacement difference',
    question: 'what is the difference between distance and displacement',
    type: 'definition',
    includes: ['Distance is the total path traveled', 'Displacement is the straight-line change'],
    aiAllowed: false
  },
  {
    name: 'phase 7a vocab free-body diagram',
    question: 'what is a free-body diagram',
    type: 'definition',
    includes: ['A free-body diagram is a simple drawing', 'forces acting on it with arrows'],
    aiAllowed: false
  },
  {
    name: 'phase 8a vocab guard unbalanced force',
    question: 'What is an unbalanced force?',
    type: 'definition',
    includes: ['Unbalanced forces do not cancel out', 'change an object\'s speed or direction'],
    excludes: ['Use Newton’s second law', 'Recognized net force problem'],
    aiAllowed: false
  },
  {
    name: 'phase 8a vocab guard scalar',
    question: 'What is a scalar?',
    type: 'definition',
    includes: ['A scalar is a quantity with size only and no direction'],
    excludes: ['Use Newton’s second law', 'Recognized net force problem'],
    aiAllowed: false
  },
  {
    name: 'phase 8a vocab guard free-body diagram',
    question: 'What is a free-body diagram?',
    type: 'definition',
    includes: ['A free-body diagram is a simple drawing', 'forces acting on it with arrows'],
    excludes: ['Use Newton’s second law', 'Recognized net force problem'],
    aiAllowed: false
  },
  {
    name: 'phase 8a vocab guard distance displacement difference',
    question: 'What is the difference between distance and displacement?',
    type: 'definition',
    includes: ['Distance is the total path traveled', 'Displacement is the straight-line change'],
    excludes: ['Recognized displacement problem', 'displacement = final position - initial position'],
    aiAllowed: false
  },
  {
    name: 'phase 7a guard friction formula still routes',
    question: 'What is the frictional force if μ = 0.3 and normal force is 100 N?',
    type: 'science_formula',
    includes: ['Use the friction formula: Ff = μ × Fn.', 'Ff = 0.3 × 100 N', 'Ff = 30 N'],
    aiAllowed: false
  },
  {
    name: 'phase 7a guard 2D displacement formula still routes',
    question: 'A person walks 3 m east and 4 m north. What is the displacement?',
    type: 'science_formula',
    includes: ['x = 3 m east', 'y = 4 m north', 'd = √(3² + 4²)', 'd = 5 m'],
    aiAllowed: false
  },
  {
    name: 'phase 7a guard net force formula still routes',
    question: 'A student pushes a box with 10 N east and 4 N west. What is the net force?',
    type: 'science_formula',
    includes: ['10 N east - 4 N west = 6 N east', 'The net force is 6 N east.'],
    aiAllowed: false
  },
  {
    name: 'displacement from initial and final position',
    question: 'An object starts at 2 m and ends at 10 m. What is its displacement?',
    type: 'science_formula',
    includes: ['displacement = final position - initial position', 'displacement = 10 m - 2 m', 'displacement = 8 m'],
    aiAllowed: false
  },
  {
    name: 'phase 8a displacement worksheet initial final negative',
    question: 'A student starts at 20 m and ends at 7 m. What is the displacement?',
    type: 'science_formula',
    includes: ['displacement = final position - initial position', 'displacement = 7 m - 20 m', 'displacement = -13 m'],
    aiAllowed: false
  },
  {
    name: 'displacement same direction east',
    question: 'A person walks 5 m east, then 3 m east. What is the displacement?',
    type: 'science_formula',
    includes: ['5 m east + 3 m east = 8 m east'],
    aiAllowed: false
  },
  {
    name: 'displacement opposite direction east west',
    question: 'A person walks 10 m east, then 4 m west. What is the displacement?',
    type: 'science_formula',
    includes: ['10 m east - 4 m west = 6 m east'],
    aiAllowed: false
  },
  {
    name: 'displacement opposite direction left right',
    question: 'A robot moves 7 m left and then 2 m right. What is its displacement?',
    type: 'science_formula',
    includes: ['7 m left - 2 m right = 5 m left'],
    aiAllowed: false
  },
  {
    name: 'displacement returns to start',
    question: 'A student walks 6 m forward then 6 m backward. What is the displacement?',
    type: 'science_formula',
    includes: ['6 m forward - 6 m backward = 0 m', 'displacement = 0 m, starting point / no net displacement'],
    aiAllowed: false
  },
  {
    name: '2D displacement east north pythagorean',
    question: 'A person walks 3 m east and 4 m north. What is the displacement?',
    type: 'science_formula',
    includes: ['x = 3 m east', 'y = 4 m north', 'd = √(x² + y²)', 'd = √(3² + 4²)', 'd = 5 m', 'The displacement is 5 m from the starting point.'],
    formulaWork: {
      formulaId: 'two_dimensional_displacement',
      finalAnswerValue: 5,
      finalAnswerDisplay: '5 m',
      minStepCount: 5
    },
    aiAllowed: false
  },
  {
    name: '2D displacement resultant wording',
    question: 'A person walks 3 m east and 4 m north. What is the resultant displacement?',
    type: 'science_formula',
    includes: ['x = 3 m east', 'y = 4 m north', 'd = √(3² + 4²)', 'd = 5 m'],
    aiAllowed: false
  },
  {
    name: 'displacement net wording',
    question: 'A robot moves 10 m east and 4 m west. What is the net displacement?',
    type: 'science_formula',
    includes: ['10 m east - 4 m west = 6 m east', 'displacement = 6 m east'],
    aiAllowed: false
  },
  {
    name: 'phase 8a displacement worksheet robot east west',
    question: 'A robot drives 14 m east and 6 m west. What is the net displacement?',
    type: 'science_formula',
    includes: ['14 m east - 6 m west = 8 m east', 'displacement = 8 m east'],
    aiAllowed: false
  },
  {
    name: '2D displacement right up pythagorean',
    question: 'A robot moves 6 m right and 8 m up. What is its displacement?',
    type: 'science_formula',
    includes: ['x = 6 m right', 'y = 8 m up', 'd = √(6² + 8²)', 'd = 10 m'],
    aiAllowed: false
  },
  {
    name: 'phase 8a messy displacement typo right up',
    question: 'a robot moves 6 m rght and 8 m up what is its displacement',
    type: 'science_formula',
    includes: ['x = 6 m right', 'y = 8 m up', 'd = √(6² + 8²)', 'd = 10 m'],
    aiAllowed: false
  },
  {
    name: 'phase 8a displacement worksheet north east',
    question: 'A person walks 8 m north and 15 m east. What is the displacement?',
    type: 'science_formula',
    includes: ['x = 15 m east', 'y = 8 m north', 'd = √(15² + 8²)', 'd = 17 m'],
    aiAllowed: false
  },
  {
    name: '2D displacement west south pythagorean',
    question: 'A student walks 5 m west and 12 m south. What is the displacement?',
    type: 'science_formula',
    includes: ['x = 5 m west', 'y = 12 m south', 'd = √(5² + 12²)', 'd = 13 m'],
    aiAllowed: false
  },
  {
    name: '2D displacement how far from started wording',
    question: 'A drone travels 9 m east then 12 m north. How far is it from where it started?',
    type: 'science_formula',
    includes: ['x = 9 m east', 'y = 12 m north', 'd = √(9² + 12²)', 'd = 15 m'],
    aiAllowed: false
  },
  {
    name: '2D displacement straight-line distance from start wording',
    question: 'A drone travels 9 m east then 12 m north. What is the straight-line distance from the start?',
    type: 'science_formula',
    includes: ['x = 9 m east', 'y = 12 m north', 'd = √(9² + 12²)', 'd = 15 m'],
    aiAllowed: false
  },
  {
    name: 'displacement total wording returns to start',
    question: 'A student walks 6 m forward then 6 m backward. What is the total displacement?',
    type: 'science_formula',
    includes: ['6 m forward - 6 m backward = 0 m', 'displacement = 0 m, starting point / no net displacement'],
    aiAllowed: false
  },
  {
    name: 'phase 8a displacement worksheet left right cancel',
    question: 'A person walks 9 m left and 9 m right. What is the total displacement?',
    type: 'science_formula',
    includes: ['9 m left - 9 m right = 0 m', 'displacement = 0 m, starting point / no net displacement'],
    aiAllowed: false
  },
  {
    name: 'displacement final wording from initial and final position',
    question: 'A person starts at 12 m and ends at 5 m. What is the final displacement?',
    type: 'science_formula',
    includes: ['displacement = final position - initial position', 'displacement = 5 m - 12 m', 'displacement = -7 m'],
    aiAllowed: false
  },
  {
    name: '2D displacement how far away from where it started wording',
    question: 'A person walks 3 m east and 4 m north. How far away from where it started?',
    type: 'science_formula',
    includes: ['x = 3 m east', 'y = 4 m north', 'd = √(3² + 4²)', 'd = 5 m'],
    aiAllowed: false
  },
  {
    name: 'motion distance remains speed distance time',
    question: 'A runner moves at 4 m/s for 6 seconds. What distance does the runner travel?',
    type: 'science_formula',
    includes: ['distance = speed × time', 'distance = 4 m/s × 6 s', 'distance = 24 m'],
    excludes: ['Recognized displacement'],
    aiAllowed: false
  },
  {
    name: 'Newton second law mass from failed student wording',
    question: 'what is the mass of an object has an acceleration of 3m/sec/sec and a force of 2n',
    matchedKnowledge: [massFact],
    type: 'science_formula',
    includes: ['Use Newton’s second law: F = m × a.', 'Solve for mass: m = F / a.', 'm = 2 N / 3 m/s²', 'm = 0.67 kg', 'The mass is about 0.67 kg.'],
    excludes: ['Mass is the amount of matter'],
    aiAllowed: false
  },
  {
    name: 'Newton second law mass from clean force acceleration wording',
    question: 'what is the mass if force is 2 N and acceleration is 3 m/s²',
    matchedKnowledge: [massFact],
    type: 'science_formula',
    includes: ['Use Newton’s second law: F = m × a.', 'Solve for mass: m = F / a.', 'm = 2 N / 3 m/s²', 'm = 0.67 kg', 'The mass is about 0.67 kg.'],
    excludes: ['Mass is the amount of matter'],
    aiAllowed: false
  },
  {
    name: 'mass definition remains teacher fact',
    question: 'what is mass',
    matchedKnowledge: [massFact],
    type: 'definition',
    includes: ['Mass is the amount of matter in an object', 'Formula: mass can be found from m = F/a'],
    aiAllowed: false
  },
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
    name: 'density rearranges for mass without numbers',
    question: 'how would I solve for mass if I had volume and density?',
    matchedKnowledge: [densityFact],
    type: 'science_formula',
    includes: ['mass = density × volume', 'Start with D = m / V', 'm = D × V'],
    excludes: ['Use the density formula: D = m / V.\nExample'],
    aiAllowed: false
  },
  {
    name: 'density rearranges for volume without numbers',
    question: 'How do I solve for volume if I have mass and density?',
    matchedKnowledge: [densityFact],
    type: 'science_formula',
    includes: ['volume = mass / density', 'V = m / D'],
    aiAllowed: false
  },
  {
    name: 'density formula for density from mass and volume without numbers',
    question: 'How do I solve for density if I have mass and volume?',
    matchedKnowledge: [densityFact],
    type: 'science_formula',
    includes: ['density = mass / volume', 'D = m / V'],
    aiAllowed: false
  },
  {
    name: 'density definition stays teacher fact',
    question: 'What is density?',
    matchedKnowledge: [densityFact],
    type: 'definition',
    includes: ['Density tells how much mass is packed', 'density = mass / volume; D = m / V'],
    aiAllowed: false
  },
  {
    name: 'volume definition stays volume-specific',
    question: 'what is volume',
    matchedKnowledge: [densityFact],
    type: 'definition',
    includes: ['Volume is the amount of space an object or substance takes up.', 'mL, L, cm³, or m³', 'density = mass / volume'],
    excludes: ['Density tells how much mass is packed'],
    aiAllowed: false
  },
  {
    name: 'time formula search lists multiple formulas',
    question: 'what formulas have time',
    type: 'formula_collection',
    includes: ['Speed = distance / time', 'Acceleration = change in velocity / time', 'Power = work / time', 'Final velocity = initial velocity + acceleration × time'],
    excludes: ['Speed tells how fast'],
    aiAllowed: false
  },
  {
    name: 'velocity formula search lists multiple formulas',
    question: 'what formulas have velocity',
    type: 'formula_collection',
    includes: ['Acceleration = (final velocity - initial velocity) / time', 'Kinetic energy = 1/2 × mass × velocity²', 'Momentum = mass × velocity', 'Speed or velocity = distance / time'],
    excludes: ['Velocity is speed in a specific direction'],
    aiAllowed: false
  },
  {
    name: 'mass units stays narrow',
    question: 'What are the units for mass?',
    type: 'units_only',
    includes: ['Mass is measured in g or kg.'],
    excludes: ['amount of matter', 'Formula:'],
    aiAllowed: false
  },
  {
    name: 'volume units stays narrow',
    question: 'What are the units for volume?',
    type: 'units_only',
    includes: ['Volume is measured in mL, L, cm³, or m³.'],
    excludes: ['density', 'D = m / V'],
    aiAllowed: false
  },
  {
    name: 'density units stays narrow',
    question: 'What are the units for density?',
    type: 'units_only',
    includes: ['Density is measured in g/mL, g/cm³, or kg/m³.'],
    excludes: ['Use the density formula', 'Example:'],
    aiAllowed: false
  },
  {
    name: 'density units handles dinsity misspelling',
    question: 'what are the units for dinsity',
    type: 'units_only',
    includes: ['Density is measured in g/mL, g/cm³, or kg/m³.'],
    excludes: ['I do not have a trusted local fact'],
    aiAllowed: false
  },
  {
    name: 'density units handles densitty misspelling',
    question: 'what are the units for densitty',
    type: 'units_only',
    includes: ['Density is measured in g/mL, g/cm³, or kg/m³.'],
    excludes: ['I do not have a trusted local fact'],
    aiAllowed: false
  },
  {
    name: 'speed units handles messy singular phrasing',
    question: 'what is the units for speed',
    type: 'units_only',
    includes: ['Speed is measured in m/s, km/h, or mph.'],
    aiAllowed: false
  },
  {
    name: 'mass units handles use phrasing',
    question: 'what unit do you use for mass',
    type: 'units_only',
    includes: ['Mass is measured in g or kg.'],
    aiAllowed: false
  },
  {
    name: 'density units handles use phrasing',
    question: 'what units do you use for density',
    type: 'units_only',
    includes: ['Density is measured in g/mL, g/cm³, or kg/m³.'],
    aiAllowed: false
  },
  {
    name: 'mass symbol stays narrow',
    question: 'What is the symbol for mass?',
    type: 'symbol_only',
    includes: ['The symbol for mass is m.'],
    excludes: ['amount of matter', 'Formula:'],
    aiAllowed: false
  },
  {
    name: 'density formula stays narrow',
    question: 'What is the formula for density?',
    type: 'formula_only',
    includes: ['D = m / V.'],
    excludes: ['Example:', 'Use the density formula'],
    aiAllowed: false
  },
  {
    name: 'force formula stays narrow',
    question: 'Formula for force',
    type: 'formula_only',
    includes: ['F = m × a.'],
    excludes: ['Use Newton’s second law', 'Example:'],
    aiAllowed: false
  },
  {
    name: 'resistance units stays narrow',
    question: 'What unit is resistance measured in?',
    type: 'units_only',
    includes: ['Resistance is measured in Ω.'],
    excludes: ['R = V / I', 'Ohm’s law'],
    aiAllowed: false
  },
  {
    name: 'electrical power formula stays narrow',
    question: 'What is the formula for electrical power?',
    type: 'formula_only',
    includes: ['P = V × I.'],
    excludes: ['Use the electrical power formula', 'Example:'],
    aiAllowed: false
  },
  {
    name: 'ambiguous power formula asks clarification',
    question: 'What is the formula for power?',
    type: 'formula_only',
    includes: ['There are two common power formulas:', '1. Work/time power: P = W / t', '2. Electrical power: P = V × I', 'Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'ambiguous power solve asks clarification',
    question: 'how do I solve for power',
    type: 'formula_only',
    includes: ['There are two common power formulas:', '1. Work/time power: P = W / t', '2. Electrical power: P = V × I', 'Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'work time power formula direct',
    question: 'What is the formula for power using work and time?',
    type: 'formula_only',
    includes: ['P = W / t.'],
    excludes: ['Which one are you working on?', 'P = V × I'],
    aiAllowed: false
  },
  {
    name: 'work time power solve direct',
    question: 'how do I solve for power using work and time',
    type: 'formula_only',
    includes: ['P = W / t.'],
    excludes: ['Which one are you working on?', 'P = V × I'],
    aiAllowed: false
  },
  {
    name: 'work time power solve with direct',
    question: 'how do I solve for power with work and time',
    type: 'formula_only',
    includes: ['P = W / t.'],
    excludes: ['Which one are you working on?', 'P = V × I'],
    aiAllowed: false
  },
  {
    name: 'electrical power solve direct',
    question: 'how do I solve for electrical power',
    type: 'formula_only',
    includes: ['P = V × I.'],
    excludes: ['Which one are you working on?', 'P = W / t'],
    aiAllowed: false
  },
  {
    name: 'voltage current power solve direct',
    question: 'how do I solve for power with voltage and current',
    type: 'formula_only',
    includes: ['P = V × I.'],
    excludes: ['Which one are you working on?', 'P = W / t'],
    aiAllowed: false
  },
  {
    name: 'ambiguous acceleration formula asks clarification',
    question: 'Formula for acceleration',
    type: 'formula_only',
    includes: ['There are two common acceleration formulas:', '1. Change in velocity over time: a = (vf - vi) / t', '2. From force and mass: a = F / m', 'Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'ambiguous volume formula asks clarification',
    question: 'What is the formula for volume?',
    type: 'formula_only',
    includes: ['There is more than one volume formula:', '1. Density volume: V = m / D', '2. Rectangular volume: V = l × w × h', '3. Cube volume: V = s³', 'Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'misspelled volume formula asks clarification',
    question: 'What is the formula for vloume?',
    type: 'formula_only',
    includes: ['There is more than one volume formula:', '1. Density volume: V = m / D', '2. Rectangular volume: V = l × w × h', '3. Cube volume: V = s³', 'Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'ambiguous V meaning asks clarification',
    question: 'What does V mean?',
    type: 'symbol_only',
    includes: ['v or V can mean more than one thing:', '1. v — velocity or speed', '2. V — volume', '3. V — voltage', 'Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'what is v asks symbol clarification',
    question: 'what is v',
    type: 'symbol_only',
    includes: ['v or V can mean more than one thing:', '1. v — velocity or speed', '2. V — volume', '3. V — voltage', 'Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'what is uppercase V asks symbol clarification',
    question: 'what is V',
    type: 'symbol_only',
    includes: ['v or V can mean more than one thing:', '1. v — velocity or speed', '2. V — volume', '3. V — voltage', 'Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'V meaning in density direct',
    question: 'what is V in density',
    type: 'symbol_only',
    includes: ['In density, V means volume.'],
    excludes: ['Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'V meaning in electricity direct',
    question: 'what is V in electricity',
    type: 'symbol_only',
    includes: ['In electricity, V means voltage.'],
    excludes: ['Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'v meaning in speed direct',
    question: 'what is v in speed',
    type: 'symbol_only',
    includes: ['In speed problems, v means velocity or speed.'],
    excludes: ['Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'ambiguous m meaning asks clarification',
    question: 'What does m mean?',
    type: 'symbol_only',
    includes: ['m can mean more than one thing:', '1. Mass', '2. Meter', 'Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'm meaning in F equals ma direct',
    question: 'What does m mean in F = ma?',
    type: 'symbol_only',
    includes: ['In F = ma, m means mass.'],
    excludes: ['Which one are you working on?'],
    aiAllowed: false
  },
  {
    name: 'density numeric mass from density and volume',
    question: 'If density is 4 g/cm^3 and volume is 5 cm^3, what is the mass?',
    matchedKnowledge: [densityFact],
    type: 'science_formula',
    includes: ['mass = density × volume', 'm = 20 g'],
    aiAllowed: false
  },
  {
    name: 'ohms law formula for volts',
    question: 'what is the formula for volts',
    type: 'science_formula',
    includes: ['Voltage = current × resistance', 'V = I × R'],
    aiAllowed: false
  },
  {
    name: 'ohms law resistance handles oms misspelling',
    question: 'how do I solve for oms',
    type: 'science_formula',
    includes: ['Resistance = voltage / current', 'R = V / I', 'Ohms are the unit for resistance'],
    aiAllowed: false
  },
  {
    name: 'ohms law resistance handles ohms',
    question: 'how do I solve for ohms',
    type: 'science_formula',
    includes: ['Resistance = voltage / current', 'R = V / I', 'Ohms are the unit for resistance'],
    aiAllowed: false
  },
  {
    name: 'ohms law electrical resistance formula',
    question: 'how do I solve for electrical resistance',
    type: 'science_formula',
    includes: ['Resistance = voltage / current', 'R = V / I'],
    aiAllowed: false
  },
  {
    name: 'ohms law current formula from voltage and resistance',
    question: 'how do I solve for current if I have voltage and resistance',
    type: 'science_formula',
    includes: ['Current = voltage / resistance', 'I = V / R'],
    aiAllowed: false
  },
  {
    name: 'ohms law voltage formula from current and resistance',
    question: 'how do I solve for voltage if I have current and resistance',
    type: 'science_formula',
    includes: ['Voltage = current × resistance', 'V = I × R'],
    aiAllowed: false
  },
  {
    name: 'ambiguous mass formula asks for values',
    question: 'how do I solve for mass',
    type: 'science_formula',
    includes: ['Which values do you have?', 'mass = density × volume', 'mass = force ÷ acceleration', 'mass = 2KE ÷ velocity²'],
    aiAllowed: false
  },
  {
    name: 'mass formula from density and volume',
    question: 'How do I solve for mass if I have density and volume?',
    type: 'science_formula',
    includes: ['mass = density × volume'],
    aiAllowed: false
  },
  {
    name: 'mass formula from force and acceleration',
    question: 'How do I solve for mass if I have force and acceleration?',
    type: 'science_formula',
    includes: ['mass = force / acceleration', 'm = F / a'],
    aiAllowed: false
  },
  {
    name: 'mass formula from kinetic energy and velocity',
    question: 'How do I solve for mass if I have kinetic energy and velocity?',
    type: 'science_formula',
    includes: ['mass = 2KE / velocity²', 'm = 2KE / v²'],
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
    name: 'hydrogen definition prefers element over gas formula',
    question: 'What is hydrogen?',
    type: 'periodic_table',
    includes: ['Hydrogen is an element with symbol H and atomic number 1', 'hydrogen gas is usually H2'],
    excludes: ['H2 is hydrogen gas'],
    aiAllowed: false
  },
  {
    name: 'element symbol H routes to hydrogen',
    question: 'What is H?',
    type: 'periodic_table',
    includes: ['Hydrogen is an element with symbol H and atomic number 1'],
    excludes: ['can mean more than one thing', 'trusted local fact'],
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
    name: 'conceptual force energy motion relation',
    question: 'How are force and energy related to motion?',
    type: 'science_concept',
    includes: ['Force can change an object’s motion', 'moving objects have kinetic energy', 'forces can transfer energy'],
    excludes: ['trusted local science fact'],
    aiAllowed: false
  },
  {
    name: 'conceptual work energy relation',
    question: 'How are work and energy related?',
    type: 'science_concept',
    includes: ['Work is energy transferred when a force moves an object over a distance'],
    excludes: ['trusted local science fact'],
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
    name: 'friction solves for frictional force',
    question: 'What is the frictional force if the coefficient of friction is 0.3 and the normal force is 100 N?',
    type: 'science_formula',
    includes: ['Ff = μ × Fn', 'Ff = 0.3 × 100 N', 'Ff = 30 N'],
    formulaWork: {
      formulaId: 'friction_coefficient_normal_force',
      finalAnswerValue: 30,
      finalAnswerDisplay: '30 N',
      minStepCount: 5
    },
    aiAllowed: false
  },
  {
    name: 'phase 8a friction worksheet force of friction',
    question: 'Find the force of friction when mu is 0.4 and the normal force is 150 N.',
    type: 'science_formula',
    includes: ['Ff = μ × Fn', 'Ff = 0.4 × 150 N', 'Ff = 60 N'],
    aiAllowed: false
  },
  {
    name: 'friction solves for coefficient',
    question: 'What is the coefficient of friction if friction is 20 N and normal force is 50 N?',
    type: 'science_formula',
    includes: ['μ = Ff / Fn', 'μ = 20 N / 50 N', 'μ = 0.4'],
    formulaWork: {
      formulaId: 'friction_coefficient_normal_force',
      finalAnswerValue: 0.4,
      finalAnswerDisplay: '0.4',
      minStepCount: 5
    },
    aiAllowed: false
  },
  {
    name: 'phase 8a friction worksheet coefficient',
    question: 'If the friction force is 24 N and the normal force is 80 N, what is the coefficient of friction?',
    type: 'science_formula',
    includes: ['μ = Ff / Fn', 'μ = 24 N / 80 N', 'μ = 0.3'],
    aiAllowed: false
  },
  {
    name: 'friction solves for normal force',
    question: 'What normal force is needed if friction is 45 N and the coefficient of friction is 0.5?',
    type: 'science_formula',
    includes: ['Fn = Ff / μ', 'Fn = 45 N / 0.5', 'Fn = 90 N'],
    formulaWork: {
      formulaId: 'friction_coefficient_normal_force',
      finalAnswerValue: 90,
      finalAnswerDisplay: '90 N',
      minStepCount: 5
    },
    aiAllowed: false
  },
  {
    name: 'phase 8a friction worksheet normal force symbols',
    question: 'If Ff is 45 N and μ is 0.5, what is Fn?',
    type: 'science_formula',
    includes: ['Fn = Ff / μ', 'Fn = 45 N / 0.5', 'Fn = 90 N'],
    aiAllowed: false
  },
  {
    name: 'friction messy force of friction with mu',
    question: 'find force of friction when mu is .25 and normal force is 80 N',
    type: 'science_formula',
    includes: ['Ff = μ × Fn', 'Ff = 0.25 × 80 N', 'Ff = 20 N'],
    aiAllowed: false
  },
  {
    name: 'phase 8a messy friction force with lowercase units',
    question: 'find friction force when mu is .25 and normal force is 80 n',
    type: 'science_formula',
    includes: ['Ff = μ × Fn', 'Ff = 0.25 × 80 N', 'Ff = 20 N'],
    aiAllowed: false
  },
  {
    name: 'friction messy symbols solve mu',
    question: 'if Ff is 12 N and Fn is 40 N what is mu?',
    type: 'science_formula',
    includes: ['μ = Ff / Fn', 'μ = 12 N / 40 N', 'μ = 0.3'],
    aiAllowed: false
  },
  {
    name: 'phase 8a messy friction coefficient typo',
    question: 'what is the coefficent of friction if friction is 10 N and normal force is 50 N',
    type: 'science_formula',
    includes: ['μ = Ff / Fn', 'μ = 10 N / 50 N', 'μ = 0.2'],
    aiAllowed: false
  },
  {
    name: 'friction missing values asks safely',
    question: 'What is the frictional force if the coefficient of friction is 0.3?',
    type: 'science_formula',
    includes: ['Use the friction formula: Ff = μ × Fn.', 'I need the normal force, Fn'],
    excludes: ['Ff = 0.3 ×'],
    aiAllowed: false
  },
  {
    name: 'net force opposite directions right wins',
    question: 'Kenny pushes a box with 10 N to the left. Michael pushes with 15 N to the right. What is the net force? Is it balanced or unbalanced?',
    type: 'science_formula',
    includes: ['15 N right - 10 N left = 5 N right', 'The net force is 5 N right.', 'Diagram:', '[box]', 'Net force = 5 N right', 'Unbalanced'],
    diagramIncludes: ['[box]', '10 N left', '15 N right', 'Net force = 5 N right', 'Unbalanced'],
    aiAllowed: false
  },
  {
    name: 'net force opposite directions balanced',
    question: 'Abby applies 100 N to the left while Thomas applies 100 N to the right. What is the net force?',
    type: 'science_formula',
    includes: ['100 N left and 100 N right cancel out.', 'Net force = 0 N.', 'balanced'],
    diagramIncludes: ['[box]', '100 N left', '100 N right', 'Net force = 0 N', 'Balanced'],
    aiAllowed: false
  },
  {
    name: 'phase 8a net force worksheet tug of war balanced',
    question: 'A tug of war has 25 N left and 25 N right. What is the net force?',
    type: 'science_formula',
    includes: ['25 N left and 25 N right cancel out.', 'Net force = 0 N.', 'balanced'],
    aiAllowed: false
  },
  {
    name: 'net force opposite directions left wins',
    question: 'Abby applies 150 N left while Thomas applies 100 N right.',
    type: 'science_formula',
    includes: ['150 N left - 100 N right = 50 N left', 'The net force is 50 N left.', 'unbalanced'],
    aiAllowed: false
  },
  {
    name: 'phase 8a net force worksheet right wins',
    question: 'A box has 70 N pushing right and 30 N pushing left. What is the net force?',
    type: 'science_formula',
    includes: ['70 N right - 30 N left = 40 N right', 'The net force is 40 N right.', 'unbalanced'],
    aiAllowed: false
  },
  {
    name: 'net force same direction adds',
    question: 'A boy pulls a wagon with 6 N east and another boy pushes it with 4 N east.',
    type: 'science_formula',
    includes: ['6 N east + 4 N east = 10 N east', 'The net force is 10 N east.', 'unbalanced'],
    aiAllowed: false
  },
  {
    name: 'phase 8a net force worksheet same direction east',
    question: 'Two students push a desk with 12 N east and 8 N east. What is the net force?',
    type: 'science_formula',
    includes: ['12 N east + 8 N east = 20 N east', 'The net force is 20 N east.'],
    aiAllowed: false
  },
  {
    name: 'phase 8a messy net force typo right',
    question: 'whats the net force if 10 n push rite and 5 n push left',
    type: 'science_formula',
    includes: ['10 N right - 5 N left = 5 N right', 'The net force is 5 N right.'],
    aiAllowed: false
  },
  {
    name: 'net force opposite direction with first class label',
    question: 'Mrs. Larson’s class pulls with 50 N. Ms. Mitko’s class pulls with 45 N in the opposite direction.',
    type: 'science_formula',
    includes: ['50 N toward Mrs. Larson’s class - 45 N opposite direction = 5 N toward Mrs. Larson’s class', 'The net force is 5 N toward Mrs. Larson’s class.', 'unbalanced'],
    aiAllowed: false
  },
  {
    name: 'two-step net force acceleration right',
    question: 'A box has 15 N pushing right and 10 N pushing left. If the box has a mass of 5 kg, what is its acceleration?',
    type: 'science_formula',
    includes: ['First find the net force.', '15 N right - 10 N left = 5 N right', 'Net force = 5 N right.', 'Solve for acceleration: a = Fnet / m.', 'a = 5 N / 5 kg', 'a = 1 m/s²', 'The acceleration is 1 m/s² right.'],
    aiAllowed: false
  },
  {
    name: 'phase 8a net force acceleration worksheet cart',
    question: 'A 4 kg cart has 18 N right and 6 N left acting on it. What is its acceleration?',
    type: 'science_formula',
    includes: ['First find the net force.', '18 N right - 6 N left = 12 N right', 'Net force = 12 N right.', 'a = 12 N / 4 kg', 'a = 3 m/s²', 'The acceleration is 3 m/s² right.'],
    aiAllowed: false
  },
  {
    name: 'phase 8a net force acceleration worksheet forward',
    question: 'A 12 kg object has 50 N forward and 14 N backward. What is its acceleration?',
    type: 'science_formula',
    includes: ['First find the net force.', '50 N forward - 14 N backward = 36 N forward', 'Net force = 36 N forward.', 'a = 36 N / 12 kg', 'a = 3 m/s²', 'The acceleration is 3 m/s² forward.'],
    aiAllowed: false
  },
  {
    name: 'two-step net force acceleration east',
    question: 'A cart has 40 N east and 10 N west acting on it. The mass is 10 kg. What is the acceleration?',
    type: 'science_formula',
    includes: ['First find the net force.', '40 N east - 10 N west = 30 N east', 'Net force = 30 N east.', 'a = 30 N / 10 kg', 'The acceleration is 3 m/s² east.'],
    aiAllowed: false
  },
  {
    name: 'two-step direct friction acceleration right',
    question: 'A 10 kg box is pushed with 50 N to the right. Friction is 20 N to the left. What is its acceleration?',
    type: 'science_formula',
    includes: ['First find the net force.', '50 N right - 20 N left = 30 N right', 'Net force = 30 N right.', 'Use Newton’s second law: Fnet = m × a.', 'Solve for acceleration: a = Fnet / m.', 'a = 30 N / 10 kg', 'a = 3 m/s²', 'The acceleration is 3 m/s² right.'],
    aiAllowed: false
  },
  {
    name: 'phase 8a friction acceleration worksheet direct friction',
    question: 'A 6 kg box is pushed with 42 N right. Friction is 12 N left. What is its acceleration?',
    type: 'science_formula',
    includes: ['First find the net force.', '42 N right - 12 N left = 30 N right', 'Net force = 30 N right.', 'a = 30 N / 6 kg', 'a = 5 m/s²', 'The acceleration is 5 m/s² right.'],
    aiAllowed: false
  },
  {
    name: 'two-step direct friction acceleration forward',
    question: 'A 5 kg object is pulled forward with 40 N. The friction force is 15 N backward. What is the acceleration?',
    type: 'science_formula',
    includes: ['First find the net force.', '40 N forward - 15 N backward = 25 N forward', 'Net force = 25 N forward.', 'a = 25 N / 5 kg', 'a = 5 m/s²', 'The acceleration is 5 m/s² forward.'],
    aiAllowed: false
  },
  {
    name: 'two-step direct friction acceleration balanced',
    question: 'A 10 kg box is pushed with 30 N right and friction is 30 N left. What is the acceleration?',
    type: 'science_formula',
    includes: ['First find the net force.', '30 N right and 30 N left cancel out.', 'Net force = 0 N.', 'The forces are balanced.', 'a = 0 N / 10 kg', 'The acceleration is 0 m/s².'],
    aiAllowed: false
  },
  {
    name: 'three-step coefficient friction acceleration crate',
    question: 'A 20 kg crate is pushed with 100 N. The coefficient of friction is 0.25 and the normal force is 200 N. What is the acceleration?',
    type: 'science_formula',
    includes: ['First calculate friction force.', 'Ff = μ × Fn', 'Ff = 0.25 × 200 N', 'Ff = 50 N', 'Then calculate net force.', 'Fnet = 100 N - 50 N = 50 N', 'Solve for acceleration: a = Fnet / m.', 'a = 50 N / 20 kg', 'a = 2.5 m/s²', 'The acceleration is 2.5 m/s².'],
    aiAllowed: false
  },
  {
    name: 'three-step coefficient friction acceleration sled symbols',
    question: 'A 10 kg sled is pulled with 60 N. μ = 0.2 and Fn = 100 N. What is the acceleration?',
    type: 'science_formula',
    includes: ['Ff = 0.2 × 100 N', 'Ff = 20 N', 'Fnet = 60 N - 20 N = 40 N', 'a = 40 N / 10 kg', 'The acceleration is 4 m/s².'],
    aiAllowed: false
  },
  {
    name: 'phase 8a friction acceleration worksheet coefficient',
    question: 'A 10 kg crate is pushed with 80 N. μ = 0.3 and Fn = 100 N. What is the acceleration?',
    type: 'science_formula',
    includes: ['Ff = 0.3 × 100 N', 'Ff = 30 N', 'Fnet = 80 N - 30 N = 50 N', 'a = 50 N / 10 kg', 'The acceleration is 5 m/s².'],
    aiAllowed: false
  },
  {
    name: 'three-step coefficient friction acceleration balanced',
    question: 'A 5 kg object is pushed with 25 N. The coefficient of friction is 0.5 and the normal force is 50 N. What is the acceleration?',
    type: 'science_formula',
    includes: ['Ff = 0.5 × 50 N', 'Ff = 25 N', 'Fnet = 25 N - 25 N = 0 N', 'The forces are balanced.', 'a = 0 N / 5 kg', 'The acceleration is 0 m/s².'],
    aiAllowed: false
  },
  {
    name: 'two-step balanced forces acceleration zero',
    question: 'A 20 kg object has balanced forces acting on it. What is its acceleration?',
    type: 'science_formula',
    includes: ['First find the net force.', 'Net force = 0 N.', 'a = 0 N / 20 kg', 'The acceleration is 0 m/s².'],
    aiAllowed: false
  },
  {
    name: 'two-step net force mass',
    question: 'A sled has 50 N pulling forward and 20 N pulling backward. It accelerates at 3 m/s². What is its mass?',
    type: 'science_formula',
    includes: ['First find the net force.', '50 N forward - 20 N backward = 30 N forward', 'Net force = 30 N forward.', 'Solve for mass: m = Fnet / a.', 'm = 30 N / 3 m/s²', 'The mass is 10 kg.'],
    aiAllowed: false
  },
  {
    name: 'force from work and distance',
    question: 'What is the force if work is 100 J and distance is 5 m?',
    type: 'science_formula',
    includes: ['Use the work formula: W = F × d.', 'Rearrange to solve for force: F = W / d.', 'F = 100 J / 5 m', 'F = 20 N'],
    aiAllowed: false
  },
  {
    name: 'work formula rearranges for force without numbers',
    question: 'Can you solve W = Fd for force?',
    type: 'science_formula',
    includes: ['Start with the work formula: W = F × d.', 'F = W / d.'],
    aiAllowed: false
  },
  {
    name: 'force answer text unchanged with formula work',
    question: 'A box has a mass of 10 kg and accelerates at 3 m/s². What force is needed?',
    type: 'science_formula',
    includes: [
      'Use Newton’s second law: F = m × a.',
      'F = 10 kg × 3 m/s²',
      'F = 30 N'
    ],
    excludes: ['Diagram:', '[box]'],
    formulaWork: {
      formulaId: 'force_mass_acceleration',
      massValue: 10,
      accelerationValue: 3,
      finalAnswerValue: 30,
      minStepCount: 4
    },
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
    name: 'electrical power beats ohms law when asking for watts',
    question: 'A small lamp is connected to a 12 volt battery and has a current of 3 amps. Question: What electrical power does the lamp use in watts?',
    type: 'science_formula',
    includes: ['P = 12 V × 3 A', 'P = 36 W'],
    excludes: ['R = 12 V / 3 A', 'R = 4 Ω'],
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
    name: 'ohms law voltage returns formula work',
    question: 'A circuit has a current of 2 A and a resistance of 5 ohms. What is the voltage?',
    type: 'science_formula',
    includes: ['V = 2 A × 5 Ω', 'V = 10 V'],
    formulaWork: {
      formulaId: 'voltage_current_resistance',
      finalAnswerDisplay: '10 V',
      minStepCount: 4
    },
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
    name: 'motion speed returns formula work',
    question: 'A car travels 72 meters in 12 seconds. What is its speed?',
    type: 'science_formula',
    includes: ['speed = 72 m / 12 s', 'speed = 6 m/s'],
    formulaWork: {
      formulaId: 'speed_distance_time',
      finalAnswerDisplay: '6 m/s',
      minStepCount: 4
    },
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
    name: 'manual smoke final velocity from rest beats definition',
    question: 'A car starts from rest and accelerates at 3 m/s² for 8 seconds. What is its final velocity?',
    matchedKnowledge: [
      { title: 'Velocity', answer: 'Velocity is speed in a direction.', exactTermMatch: true, score: 30 }
    ],
    type: 'science_formula',
    includes: ['vf = vi + a × t', 'vf = 0 m/s + 3 m/s² × 8 s', 'vf = 24 m/s'],
    excludes: ['Velocity is', 'speed in a direction', 'speed = distance / time'],
    formulaWork: {
      formulaId: 'acceleration_velocity_time',
      finalAnswerDisplay: '24 m/s',
      minStepCount: 4
    },
    aiAllowed: false
  },
  {
    name: 'plain velocity definition still uses definition lookup',
    question: 'What is velocity?',
    matchedKnowledge: [
      { title: 'Velocity', answer: 'Velocity is speed in a direction.', exactTermMatch: true, score: 30 }
    ],
    type: 'definition',
    includes: ['Velocity'],
    excludes: ['vf =', 'final velocity'],
    aiAllowed: false
  },
  {
    name: 'manual smoke distance from work stays work distance',
    question: 'A machine does 240 J of work using 60 N of force. How far did it move the object?',
    type: 'science_formula',
    includes: ['distance = work / force', 'distance = 240 J / 60 N', 'distance = 4 m'],
    excludes: ['potential energy', 'height =', 'PE ='],
    formulaWork: {
      formulaId: 'work_force_distance',
      finalAnswerDisplay: '4 m',
      minStepCount: 4
    },
    aiAllowed: false
  },
  {
    name: 'manual smoke height from potential energy beats kinetic energy',
    question: 'A 10 kg object has 196 J of gravitational potential energy. How high is it?',
    type: 'science_formula',
    includes: ['height = PE / (mass × gravity)', 'height = 196 J / (10 kg × 9.8 m/s²)', 'height = 2 m'],
    excludes: ['kinetic energy', 'KE =', 'velocity =', 'v = √'],
    formulaWork: {
      formulaId: 'potential_energy',
      finalAnswerDisplay: '2 m',
      minStepCount: 4
    },
    aiAllowed: false
  },
  {
    name: 'manual smoke specific heat energy beats water chemistry',
    question: 'How much heat is needed to raise 2 kg of water by 4°C if water’s specific heat is 4,184 J/kg°C?',
    matchedKnowledge: [
      { title: 'H2O', answer: 'H2O is water.', exactTermMatch: true, score: 30 }
    ],
    type: 'science_formula',
    includes: ['q = m × c × ΔT', 'q = 2 kg × 4184 J/kg°C × 4°C', 'q = 33472 J'],
    excludes: ['H2O is water', 'compound'],
    formulaWork: {
      formulaId: 'specific_heat',
      finalAnswerDisplay: '33472 J',
      minStepCount: 4
    },
    aiAllowed: false
  },
  {
    name: 'manual smoke specific heat capacity beats kinetic energy',
    question: 'A substance absorbs 900 J of heat. Its mass is 3 kg and its temperature increases by 5°C. What is its specific heat?',
    type: 'science_formula',
    includes: ['c = q / (m × ΔT)', 'c = 900 J / (3 kg × 5°C)', 'c = 60 J/kg°C'],
    excludes: ['kinetic energy', 'KE =', 'velocity =', 'v = √'],
    formulaWork: {
      formulaId: 'specific_heat',
      finalAnswerDisplay: '60 J/kg°C',
      minStepCount: 4
    },
    aiAllowed: false
  },
  {
    name: 'plain H2O chemistry still works',
    question: 'What is H2O?',
    type: 'chemistry_formula',
    includes: ['H2O is water', 'hydrogen and oxygen'],
    excludes: ['q = m × c × ΔT'],
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
    name: 'density mass volume returns formula work',
    question: 'A rock has a mass of 180 g and a volume of 30 mL. What is its density?',
    type: 'science_formula',
    includes: ['D = 180 g / 30 mL', 'D = 6 g/mL'],
    formulaWork: {
      formulaId: 'density_mass_volume',
      finalAnswerDisplay: '6 g/mL',
      minStepCount: 4
    },
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
  },
  {
    name: 'phase 1b work from push force and distance',
    question: 'If I push with 10 N for 5 m, how much work is done?',
    type: 'science_formula',
    includes: ['W = force × distance', 'W = 10 N × 5 m', 'W = 50 J'],
    aiAllowed: false
  },
  {
    name: 'phase 1b power from work and time',
    question: 'A student does 200 J of work in 10 seconds. What is the power?',
    type: 'science_formula',
    includes: ['P = W / t', 'P = 200 J / 10 s', 'P = 20 W'],
    aiAllowed: false
  },
  {
    name: 'phase 1b time from work and power',
    question: 'How much time if power is 50 W and work is 200 J?',
    type: 'science_formula',
    includes: ['t = W / P', 't = 200 J / 50 W', 't = 4 s'],
    aiAllowed: false
  },
  {
    name: 'phase 1b distance from work and force',
    question: 'What distance if work is 120 J and force is 30 N?',
    type: 'science_formula',
    includes: ['distance = work / force', 'distance = 120 J / 30 N', 'distance = 4 m'],
    aiAllowed: false
  },
  {
    name: 'phase 1b distance from mph and hours',
    question: 'If I travel 20 mph for 5 hours how far did I go?',
    type: 'science_formula',
    includes: ['distance = speed × time', 'distance = 20 mile/hr × 5 hr', 'distance = 100 miles'],
    excludes: ['speed ='],
    aiAllowed: false
  },
  {
    name: 'phase 1b acceleration from velocity change',
    question: 'A car goes from 10 m/s to 30 m/s in 5 seconds. What is acceleration?',
    type: 'science_formula',
    includes: ['a = (30 m/s - 10 m/s) / 5 s', 'a = 4 m/s²'],
    aiAllowed: false
  },
  {
    name: 'phase 1b speed from distance and time',
    question: 'What is the speed if distance is 100 m and time is 20 s?',
    type: 'science_formula',
    includes: ['speed = distance / time', 'speed = 100 m / 20 s', 'speed = 5 m/s'],
    aiAllowed: false
  },
  {
    name: 'phase 1b time from distance and speed',
    question: 'How long does it take to go 100 meters at 5 m/s?',
    type: 'science_formula',
    includes: ['time = distance / speed', 'time = 100 m / 5 m/s', 'time = 20 s'],
    aiAllowed: false
  },
  {
    name: 'phase 1b density units',
    question: 'What are the units for density?',
    type: 'units_only',
    includes: ['Density is measured in g/mL, g/cm³, or kg/m³.'],
    aiAllowed: false
  },
  {
    name: 'phase 1b density from mass and volume',
    question: 'What is density if mass is 20 g and volume is 4 mL?',
    type: 'science_formula',
    includes: ['D = m / V', 'D = 20 g / 4 mL', 'D = 5 g/mL'],
    aiAllowed: false
  },
  {
    name: 'phase 1b mass from density and volume',
    question: 'What is the mass if density is 5 g/mL and volume is 4 mL?',
    type: 'science_formula',
    includes: ['mass = density × volume', 'm = 5 g/mL × 4 mL', 'm = 20 g'],
    aiAllowed: false
  },
  {
    name: 'phase 1b volume from mass and density',
    question: 'What is the volume if mass is 20 g and density is 5 g/mL?',
    type: 'science_formula',
    includes: ['volume = mass / density', 'V = 20 g / 5 g/mL', 'V = 4 mL'],
    aiAllowed: false
  },
  {
    name: 'phase 1b gravity on Earth',
    question: 'What is gravity on Earth?',
    type: 'science_formula',
    includes: ['gravity is about 9.8 m/s²', 'g = 9.8 m/s²'],
    aiAllowed: false
  },
  {
    name: 'phase 1b force of gravity on mass',
    question: 'What is the force of gravity on a 10 kg object?',
    type: 'science_formula',
    includes: ['Fg = m × g', 'Fg = 10 kg × 9.8 m/s²', 'Fg = 98 N'],
    aiAllowed: false
  },
  {
    name: 'phase 1b weight on Earth',
    question: 'What is the weight of a 10 kg object on Earth?',
    type: 'science_formula',
    includes: ['Fg = m × g', 'For Earth, use g = 9.8 m/s².', 'Fg = 98 N'],
    aiAllowed: false
  },
  {
    name: 'phase 1b formula for volts',
    question: 'How do you solve for volts?',
    type: 'science_formula',
    includes: ['Voltage = current × resistance', 'V = I × R'],
    aiAllowed: false
  },
  {
    name: 'phase 1b voltage from current and resistance',
    question: 'What is voltage if current is 2 A and resistance is 5 ohms?',
    type: 'science_formula',
    includes: ['V = I × R', 'V = 2 A × 5 Ω', 'V = 10 V'],
    aiAllowed: false
  },
  {
    name: 'phase 1b resistance from voltage and current',
    question: 'What is resistance if voltage is 12 V and current is 3 A?',
    type: 'science_formula',
    includes: ['R = V / I', 'R = 12 V / 3 A', 'R = 4 Ω'],
    aiAllowed: false
  },
  {
    name: 'phase 1b oxygen element identity',
    question: 'What is oxygen?',
    type: 'periodic_table',
    includes: ['Oxygen is an element with symbol O and atomic number 8'],
    aiAllowed: false
  },
  {
    name: 'phase 1b carbon protons',
    question: 'How many protons does carbon have?',
    type: 'periodic_table',
    includes: ['Carbon (C) has 6 protons', 'Number of protons = atomic number = 6'],
    aiAllowed: false
  },
  {
    name: 'phase 1b conceptual mass and acceleration',
    question: 'Why does more mass make it harder to accelerate?',
    type: 'science_concept',
    includes: ['more inertia', 'more force is needed', 'change its motion'],
    aiAllowed: false
  },
  {
    name: 'phase 1b conceptual ohms law relationship',
    question: 'How are voltage current and resistance related?',
    type: 'science_concept',
    includes: ['Ohm’s Law', 'voltage pushes current', 'resistance opposes current', 'V = I × R'],
    aiAllowed: false
  },
  {
    name: 'phase 1b conceptual wave relationship',
    question: 'How are wavelength frequency and wave speed related?',
    type: 'science_concept',
    includes: ['v = f × λ', 'higher frequency means shorter wavelength'],
    aiAllowed: false
  },
  {
    name: 'phase 1b misspelled density units',
    question: 'what are the units for dinsity',
    type: 'units_only',
    includes: ['Density is measured in g/mL, g/cm³, or kg/m³.'],
    aiAllowed: false
  },
  {
    name: 'phase 1b misspelled acceleration formula',
    question: 'how do I find acceration',
    type: 'formula_only',
    includes: ['a = (vf - vi) / t', 'a = F / m'],
    aiAllowed: false
  },

  // Phase 8B worksheet smoke tests: net force
  {
    name: 'phase 8b net force Cole Blayne same direction left',
    question: 'Cole applies 20 N to the left and Blayne applies 15 N to the left. What is the net force?',
    type: 'science_formula',
    includes: ['20 N left + 15 N left = 35 N left', 'The net force is 35 N left.'],
    aiAllowed: false
  },
  {
    name: 'phase 8b net force boys girls right wins',
    question: 'The boys pull with 30 N to the left and the girls pull with 50 N to the right. What is the net force?',
    type: 'science_formula',
    includes: ['50 N right - 30 N left = 20 N right', 'The net force is 20 N right.'],
    aiAllowed: false
  },
  {
    name: 'phase 8b net force same direction east car',
    question: 'A car has 200 N east and 150 N east acting on it. What is the net force?',
    type: 'science_formula',
    includes: ['200 N east + 150 N east = 350 N east', 'The net force is 350 N east.'],
    aiAllowed: false
  },
  {
    name: 'phase 8b net force opposite sides uses relative direction',
    question: 'Two players kick a ball from opposite sides. Red kicks with 50 N and Blue kicks with 63 N. What is the net force?',
    type: 'science_formula',
    includes: ['63 N opposite direction - 50 N toward the first force = 13 N opposite direction', 'The net force is 13 N opposite direction.'],
    aiAllowed: false
  },

  // TODO Phase 8C: support "does not move" / balanced-with-single-mentioned-force net force questions.
  // "Five people apply a total force of 95 N to the right and Alex does not move. What is the net force?" -> 0 N, balanced.

  // Phase 8B worksheet smoke tests: weight / gravity force
  {
    name: 'phase 8b weight 40 kg on Earth',
    question: 'What is the weight of a 40 kg object on Earth?',
    type: 'science_formula',
    includes: ['Fg = m × g', 'For Earth, use g = 9.8 m/s².', 'Fg = 392 N'],
    aiAllowed: false
  },
  {
    name: 'phase 8b weight formula from teacher fact',
    question: 'How do we calculate the weight of an object?',
    matchedKnowledge: [weightFact],
    type: 'class_fact',
    includes: ['Weight is the force of gravity', 'Fg = m × g'],
    aiAllowed: false
  },
  {
    name: 'phase 8b weight changes with location',
    question: 'What changes depending on location in the universe, mass or weight?',
    type: 'definition',
    includes: ['Weight changes depending on location', 'gravity changes', 'Mass stays the same'],
    aiAllowed: false
  },
  {
    name: 'phase 8b weight vector direction',
    question: 'In what direction is the weight vector always drawn?',
    type: 'definition',
    includes: ['weight vector', 'downward', 'toward gravity'],
    aiAllowed: false
  },

  // TODO Later phase: moon gravity calculation. "What would be the weight of a 40 kg object on the moon?" -> 64 N with g = 1.6 m/s².

  // Phase 8B worksheet smoke tests: friction
  {
    name: 'phase 8b friction leaves direct normal force wording',
    question: 'A wrapped pile of leaves has a normal force of 580 N. The coefficient of friction is 0.55. How much frictional force is required to start sliding it?',
    type: 'science_formula',
    includes: ['Ff = μ × Fn', 'Ff = 0.55 × 580 N', 'Ff = 319 N'],
    aiAllowed: false
  },
  {
    name: 'phase 8b friction sled direct normal force wording',
    question: 'A sled and rider have a normal force of 490 N. The coefficient of friction is 0.15. How much frictional force is needed to slide it?',
    type: 'science_formula',
    includes: ['Ff = μ × Fn', 'Ff = 0.15 × 490 N', 'Ff = 73.5 N'],
    aiAllowed: false
  },
  {
    name: 'phase 8b friction coefficient car direct labels',
    question: 'A car has friction of 804 N and normal force is 1340 N. What is the coefficient of friction?',
    type: 'science_formula',
    includes: ['μ = Ff / Fn', 'μ = 804 N / 1340 N', 'μ = 0.6'],
    aiAllowed: false
  },
  {
    name: 'phase 8b friction normal force boulder direct labels',
    question: 'A boulder begins to slide with friction of 530 N. The coefficient of friction is 0.65. What normal force acts on the boulder?',
    type: 'science_formula',
    includes: ['Fn = Ff / μ', 'Fn = 530 N / 0.65', 'Fn = 815.3846 N'],
    aiAllowed: false
  },
  {
    name: 'phase 8b sliding friction coefficient leaves direct labels',
    question: 'A pile of leaves has friction force of 93 N and normal force is 580 N. What is the coefficient of sliding friction?',
    type: 'science_formula',
    includes: ['μ = Ff / Fn', 'μ = 93 N / 580 N', 'μ = 0.1603'],
    aiAllowed: false
  },
  {
    name: 'phase 8b sliding friction coefficient symbols',
    question: 'If Ff is 265 N and Fn is 815.4 N, what is the coefficient of sliding friction?',
    type: 'science_formula',
    includes: ['μ = Ff / Fn', 'μ = 265 N / 815.4 N', 'μ = 0.325'],
    aiAllowed: false
  },

  // Phase 8B worksheet smoke tests: friction + net force + acceleration
  {
    name: 'phase 8b block pushed friction net force',
    question: 'A 4.0 kg block is pushed with 10 N to the right. The frictional force is 7.84 N to the left. What is the net force?',
    type: 'science_formula',
    includes: ['10 N right - 7.84 N left = 2.16 N right', 'The net force is 2.16 N right.'],
    aiAllowed: false
  },
  {
    name: 'phase 8b block acceleration from net force',
    question: 'A 4.0 kg block has a net force of 2.16 N to the right. What is the acceleration?',
    type: 'science_formula',
    includes: ['a = 2.16 N / 4 kg', 'a = 0.54 m/s²'],
    aiAllowed: false
  },
  {
    name: 'phase 8b racecar acceleration from braking force',
    question: 'A 500 kg racecar has a braking force of 8820 N. What is its acceleration?',
    type: 'science_formula',
    includes: ['a = 8820 N / 500 kg', 'a = 17.64 m/s²'],
    aiAllowed: false
  },

  // Phase 8B worksheet smoke tests: concept / vocab
  {
    name: 'phase 8b vocab contact vs field forces',
    question: 'Compare and contrast contact vs field forces.',
    type: 'definition',
    includes: ['Contact forces require touching', 'Field forces act at a distance'],
    aiAllowed: false
  },
  {
    name: 'phase 8b vocab Newton first law',
    question: 'What is Newton’s First Law?',
    type: 'definition',
    includes: ['object at rest stays at rest', 'object in motion stays in motion', 'unbalanced force'],
    aiAllowed: false
  },
  {
    name: 'phase 8b vocab inertia',
    question: 'What is inertia?',
    type: 'definition',
    includes: ['resistance to a change in motion'],
    aiAllowed: false
  },
  {
    name: 'phase 8b vocab normal force',
    question: 'What is the normal force?',
    type: 'definition',
    includes: ['support force', 'perpendicular'],
    aiAllowed: false
  },
  {
    name: 'phase 8b vocab normal force direction',
    question: 'In what direction is the normal force drawn?',
    type: 'definition',
    includes: ['normal force', 'perpendicular to the surface'],
    aiAllowed: false
  },
  {
    name: 'phase 8b vocab equilibrium',
    question: 'What does it mean for an object to be in equilibrium?',
    type: 'definition',
    includes: ['net force is zero', 'forces are balanced'],
    aiAllowed: false
  },
  {
    name: 'phase 8b vocab equilibrium motion',
    question: 'What types of motion can an object in equilibrium have?',
    type: 'definition',
    includes: ['at rest', 'constant velocity'],
    aiAllowed: false
  },
  {
    name: 'phase 8b vocab unbalanced motion change',
    question: 'How does motion change if forces are unbalanced?',
    type: 'definition',
    includes: ['accelerates', 'speed up', 'slow down', 'change direction'],
    aiAllowed: false
  },
  {
    name: 'phase 8b vocab Newton third law',
    question: 'What is Newton’s Third Law?',
    type: 'definition',
    includes: ['equal and opposite', 'action-reaction pairs'],
    aiAllowed: false
  },
  {
    name: 'phase 8b vocab gravity field force',
    question: 'Is gravity a contact or field force?',
    type: 'definition',
    includes: ['Gravity is a field force', 'act at a distance'],
    aiAllowed: false
  },

  // Phase 9A free-body diagram concept inference, without drawing generation.
  {
    name: 'phase 9a fbd stopped car at light',
    question: 'A car is stopped at a stop light. What forces act on it?',
    type: 'science_concept',
    includes: ['Gravity/weight acts downward', 'normal force from the road acts upward', 'balanced because the car is not accelerating'],
    aiAllowed: false
  },
  {
    name: 'phase 9a fbd skydiver constant velocity',
    question: 'A skydiver is descending with constant velocity. What forces act on the skydiver?',
    type: 'science_concept',
    includes: ['Gravity acts downward', 'Air resistance/drag acts upward', 'balanced because constant velocity means no acceleration'],
    aiAllowed: false
  },
  {
    name: 'phase 9a fbd balloon accelerating upward',
    question: 'A hot air balloon is accelerating upward. What does that tell us about the upward and downward forces?',
    type: 'science_concept',
    includes: ['upward force is greater than weight/gravity', 'net force is upward', 'forces are unbalanced'],
    aiAllowed: false
  },
  {
    name: 'phase 9a fbd book constant velocity with friction',
    question: 'A book moves across a desk at constant velocity with friction. What does constant velocity tell us about the forces?',
    type: 'science_concept',
    includes: ['Net force is 0 N', 'applied force and friction are balanced horizontally', 'normal force and gravity are balanced vertically'],
    aiAllowed: false
  },
  {
    name: 'phase 9a fbd book accelerates right with friction',
    question: 'A rightward force is applied to a book and it accelerates right. Friction acts on the book. What forces act on it?',
    type: 'science_concept',
    includes: ['applied force acts right', 'Friction acts left', 'Gravity acts down', 'normal force acts up', 'applied force is greater than friction'],
    aiAllowed: false
  },
  {
    name: 'phase 9a fbd car coasting right slowing down',
    question: 'A car is coasting to the right and slowing down. What forces act on it?',
    type: 'science_concept',
    includes: ['Friction/drag acts left', 'Gravity acts down', 'normal force acts up', 'net force is left'],
    aiAllowed: false
  },
  {
    name: 'phase 9a fbd car parked on slope',
    question: 'A car is parked on a sloped street. What forces act on it?',
    type: 'science_concept',
    includes: ['Gravity acts downward', 'normal force acts perpendicular to the surface', 'Friction acts along the slope', 'do not calculate components'],
    aiAllowed: false
  },
  {
    name: 'phase 9a fbd constant velocity net force',
    question: 'What does constant velocity mean about net force?',
    type: 'science_concept',
    includes: ['Net force is 0 N', 'forces are balanced', 'object is not accelerating'],
    aiAllowed: false
  },
  {
    name: 'phase 9a fbd accelerating upward meaning',
    question: 'What does it mean if an object is accelerating upward?',
    type: 'science_concept',
    includes: ['net force is upward', 'upward force is greater than the downward force', 'forces are unbalanced'],
    aiAllowed: false
  },
  {
    name: 'phase 9a guard numeric friction formula still routes',
    question: 'What is the frictional force if μ = 0.25 and normal force is 80 N?',
    type: 'science_formula',
    includes: ['Use the friction formula: Ff = μ × Fn.', 'Ff = 0.25 × 80 N', 'Ff = 20 N'],
    excludes: ['free-body forces concept'],
    aiAllowed: false
  },

  // TODO Later phase: unsupported advanced vector magnitude plus angle/bearing cases.
  // airplane north with crosswind west resultant velocity
  // plane east with crosswind south magnitude and direction
  // hiker 25 km west and 35 km south with direction angle
  // boat crossing river resultant velocity
  // bearing relative to north
  // symbolic package/pilot relative velocity problem

  // Phase 8B worksheet smoke tests: more friction / normal force / weight
  {
    name: 'phase 8b weight 10 kg box',
    question: 'A 10 kg box rests on the ground. What is the weight of the box?',
    type: 'science_formula',
    includes: ['Fg = m × g', 'Fg = 10 kg × 9.8 m/s²', 'Fg = 98 N'],
    aiAllowed: false
  },
  {
    name: 'phase 8b static friction coefficient direct labels',
    question: 'A 10 kg box has a maximum static friction force of 40 N and a normal force of 98 N. What is the coefficient of static friction?',
    type: 'science_formula',
    includes: ['μ = Ff / Fn', 'μ = 40 N / 98 N', 'μ = 0.4082'],
    aiAllowed: false
  },
  {
    name: 'phase 8b kinetic friction coefficient sled direct labels',
    question: 'A sled has a normal force of 200 N and the kinetic friction force is 40 N. What is the coefficient of kinetic friction?',
    type: 'science_formula',
    includes: ['μ = Ff / Fn', 'μ = 40 N / 200 N', 'μ = 0.2'],
    aiAllowed: false
  },
  {
    name: 'phase 8b racecar skidding braking force direct labels',
    question: 'A racecar has a kinetic friction coefficient of 1.2 and a normal force of 4900 N. What is the braking force during skidding?',
    type: 'science_formula',
    includes: ['Ff = μ × Fn', 'Ff = 1.2 × 4900 N', 'Ff = 5880 N'],
    aiAllowed: false
  },
  {
    name: 'phase 8b sculpture friction direct normal force wording',
    question: 'A 1470 N sculpture is pulled across the floor. The coefficient of friction is 0.57 and the normal force is 1470 N. What is the force of friction?',
    type: 'science_formula',
    includes: ['Ff = μ × Fn', 'Ff = 0.57 × 1470 N', 'Ff = 837.9 N'],
    aiAllowed: false
  }

  // TODO Phase 8C: derive normal force from weight/mass for level surfaces.
  // "A 10 kg box rests on the ground. What is the normal force on the box?" -> 98 N upward.
  // "A 500 kg racecar has a coefficient of static friction of 1.8. What is the maximum braking force?" -> 8820 N.
  // "A 12 kg box is pushed at constant velocity with a horizontal force of 96 N. What is the normal force?" -> 117.6 N.
  // "A 12 kg box is pushed at constant velocity with a horizontal force of 96 N. What is the weight of the box?" -> 117.6 N.
  // "A 12 kg box is pushed at constant velocity with a horizontal force of 96 N. What is the coefficient of friction?" -> about 0.82.
  // "A 1470 N sculpture is pulled across the floor with an acceleration of 0.5 m/s². The coefficient of sliding friction is 0.57. What is the mass?" -> 150 kg.
  //
  // TODO Phase 8C: support equilibrium/static/kinetic friction from motion wording.
  // "A box is pushed left with 20 N but does not move. What is the static friction force?" -> 20 N opposite the push.
  // "A box just begins to move when the pushing force is increased to 40 N. What is the maximum static friction force?" -> 40 N.
  // "A sled is pulled across snow at constant velocity with a pulling force of 40 N. What is the kinetic friction force?" -> 40 N.
  // "A 12 kg box is pushed at constant velocity with a horizontal force of 96 N. What is the frictional force?" -> 96 N.
  //
  // TODO Later phase: multi-step friction/normal/applied force chains.
  // "A sled weighs 200 N. Then 30 kg of wood is placed in the sled. If μk = 0.2, what pulling force is needed to move it at constant velocity?" -> 98.8 N.
  // "A 500 kg racecar has wings that increase the downward force by 4000 N. If μs = 1.8, what is the maximum braking force?" -> 16020 N.
  // "A 1470 N sculpture is pulled across the floor with an acceleration of 0.5 m/s². The coefficient of sliding friction is 0.57. What applied force is needed?" -> 912.9 N.
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

    if (test.diagramIncludes) {
      const diagramText = normalizeDiagramText(route.diagramText);
      assert.ok(diagramText, 'Expected questionRoute.diagramText to exist');
      for (const expected of test.diagramIncludes) {
        assert.ok(
          diagramText.includes(normalizeDiagramText(expected)),
          `Expected diagramText to include "${expected}" but got:\n${route.diagramText}`
        );
      }
    }

    if (test.formulaWork) {
      assert.ok(route.formulaWork, 'Expected questionRoute.formulaWork to exist');
      assert.equal(route.formulaWork.formulaId, test.formulaWork.formulaId);
      if (Object.prototype.hasOwnProperty.call(test.formulaWork, 'massValue')) {
        assert.equal(route.formulaWork.variables.mass.value, test.formulaWork.massValue);
      }
      if (Object.prototype.hasOwnProperty.call(test.formulaWork, 'accelerationValue')) {
        assert.equal(route.formulaWork.variables.acceleration.value, test.formulaWork.accelerationValue);
      }
      if (Object.prototype.hasOwnProperty.call(test.formulaWork, 'finalAnswerValue')) {
        assert.equal(route.formulaWork.finalAnswer.value, test.formulaWork.finalAnswerValue);
      }
      if (Object.prototype.hasOwnProperty.call(test.formulaWork, 'finalAnswerDisplay')) {
        assert.equal(route.formulaWork.finalAnswer.display, test.formulaWork.finalAnswerDisplay);
      }
      assert.ok(
        Array.isArray(route.formulaWork.steps) && route.formulaWork.steps.length >= test.formulaWork.minStepCount,
        `Expected formulaWork.steps to have at least ${test.formulaWork.minStepCount} steps`
      );
      assert.deepEqual(route.public.formulaWork, {
        formulaId: route.formulaWork.formulaId,
        family: route.formulaWork.family,
        solveFor: route.formulaWork.solveFor,
        formula: route.formulaWork.formula,
        hasGuidedSteps: true
      });
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

function normalizeDiagramText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

runPendingClarificationTests();

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`\n${passed}/${tests.length} router tests passed.`);
process.exit(0);

function runPendingClarificationTests() {
  const powerClarificationRoute = routeStudentQuestion('how do I solve for power', []);
  const pendingPowerClarification = nextPendingClarification(powerClarificationRoute);

  try {
    assert.ok(pendingPowerClarification, 'power clarification should expose pending choices');
    assert.equal(pendingPowerClarification.id, 'power_formula');
    assert.equal(pendingPowerClarification.choices.length, 2);

    const workChoice = resolvePendingClarification('1', pendingPowerClarification);
    assert.equal(workChoice.handled, true);
    assert.equal(workChoice.pendingClarification, null);
    assert.equal(workChoice.questionRoute.type, 'formula_only');
    assert.ok(workChoice.questionRoute.directAnswer.includes('Power = work ÷ time'));
    assert.ok(workChoice.questionRoute.directAnswer.includes('P = W / t'));
    assert.ok(!workChoice.questionRoute.directAnswer.includes('Which one are you working on?'));

    const electricalChoice = resolvePendingClarification('2', pendingPowerClarification);
    assert.equal(electricalChoice.handled, true);
    assert.equal(electricalChoice.pendingClarification, null);
    assert.equal(electricalChoice.questionRoute.type, 'formula_only');
    assert.ok(electricalChoice.questionRoute.directAnswer.includes('Power = voltage × current'));
    assert.ok(electricalChoice.questionRoute.directAnswer.includes('P = V × I'));
    assert.ok(!electricalChoice.questionRoute.directAnswer.includes('Which one are you working on?'));

    const standaloneNumberRoute = routeStudentQuestion('2', []);
    assert.ok(
      !String(standaloneNumberRoute.directAnswer || '').includes('Power = voltage × current'),
      'standalone 2 without pending clarification should not answer electrical power'
    );

    const invalidChoice = resolvePendingClarification('3', pendingPowerClarification);
    assert.equal(invalidChoice.handled, true);
    assert.equal(invalidChoice.pendingClarification, pendingPowerClarification);
    assert.equal(invalidChoice.questionRoute.directAnswer, 'Please type one of the choices listed, like 1 or 2.');

    const normalQuestion = resolvePendingClarification('What is the formula for force?', pendingPowerClarification);
    assert.equal(normalQuestion, null);
    const normalQuestionRoute = routeStudentQuestion('What is the formula for force?', []);
    assert.equal(normalQuestionRoute.type, 'formula_only');
    assert.ok(normalQuestionRoute.directAnswer.includes('F = m × a.'));

    console.log('✅ pending clarification: power choices resolve by number');
  } catch (error) {
    console.error('❌ pending clarification: power choices resolve by number');
    console.error(error.message);
    process.exitCode = 1;
  }
}
