const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const DIRECT_CASES = [
  {
    name: 'define-chemical-energy',
    prompt: 'What is chemical energy?',
    includes: [/chemical energy/i, /stored/i, /bonds/i, /food|gasoline|batter/i]
  },
  {
    name: 'define-thermal-energy',
    prompt: 'What is thermal energy?',
    includes: [/thermal energy/i, /particles?/i, /temperature/i, /warmer/i]
  },
  {
    name: 'define-electrical-energy',
    prompt: 'What is electrical energy?',
    includes: [/electrical energy/i, /moving electric charges|current/i]
  },
  {
    name: 'define-radiant-energy',
    prompt: 'What is radiant energy?',
    includes: [/radiant energy/i, /electromagnetic waves/i, /light/i]
  },
  {
    name: 'define-light-energy',
    prompt: 'What is light energy?',
    includes: [/light energy/i, /radiant energy/i, /electromagnetic waves/i]
  },
  {
    name: 'define-sound-energy',
    prompt: 'What is sound energy?',
    includes: [/sound energy/i, /vibrations/i, /medium/i]
  },
  {
    name: 'define-mechanical-energy',
    prompt: 'What is mechanical energy?',
    includes: [/mechanical energy/i, /motion/i, /position/i, /kinetic/i, /potential/i]
  },
  {
    name: 'define-kinetic-energy',
    prompt: 'What is kinetic energy?',
    includes: [/kinetic energy/i, /motion/i]
  },
  {
    name: 'define-potential-energy',
    prompt: 'What is potential energy?',
    includes: [/potential energy/i, /stored/i, /position|height|shape|condition/i]
  },
  {
    name: 'define-elastic-potential-energy',
    prompt: 'What is elastic potential energy?',
    includes: [/elastic potential energy/i, /stretched|compressed/i]
  },
  {
    name: 'define-gravitational-potential-energy',
    prompt: 'What is gravitational potential energy?',
    includes: [/gravitational potential energy/i, /stored/i, /height|position/i, /gravitational field/i]
  },
  {
    name: 'food-chemical-energy',
    prompt: 'What type of energy is stored in food?',
    includes: [/chemical energy/i, /chemical bonds/i]
  },
  {
    name: 'gasoline-chemical-energy',
    prompt: 'What type of energy is in gasoline?',
    includes: [/chemical energy/i, /chemical bonds/i]
  },
  {
    name: 'battery-stored-chemical-to-electrical',
    prompt: 'What type of energy is stored in a battery?',
    includes: [/chemical energy/i, /electrical energy/i, /circuit/i]
  },
  {
    name: 'wall-outlet-electrical',
    prompt: 'What type of energy comes from a wall outlet?',
    includes: [/electrical energy/i, /moving electric charges/i]
  },
  {
    name: 'speaker-sound-energy',
    prompt: 'What type of energy does a speaker make?',
    includes: [/sound energy/i, /electrical energy/i, /vibrations/i]
  },
  {
    name: 'lamp-radiant-thermal',
    prompt: 'What type of energy does a lamp give off?',
    includes: [/radiant energy|light energy/i, /thermal energy/i]
  },
  {
    name: 'sun-radiant-thermal',
    prompt: 'What type of energy does the Sun give off?',
    includes: [/radiant energy|light/i, /thermal energy|heat/i]
  },
  {
    name: 'moving-car-kinetic-mechanical',
    prompt: 'What energy does a moving car have?',
    includes: [/kinetic energy/i, /mechanical energy/i]
  },
  {
    name: 'book-shelf-gpe',
    prompt: 'What energy does a book on a shelf have?',
    includes: [/gravitational potential energy/i, /height|position/i]
  },
  {
    name: 'stretched-rubber-band-elastic',
    prompt: 'What energy does a stretched rubber band have?',
    includes: [/elastic potential energy/i, /stretched|compressed/i]
  },
  {
    name: 'compressed-spring-elastic',
    prompt: 'What energy does a compressed spring have?',
    includes: [/elastic potential energy/i, /stretched|compressed/i]
  },
  {
    name: 'hot-cocoa-thermal',
    prompt: 'What energy is in a hot cup of cocoa?',
    includes: [/thermal energy/i]
  },
  {
    name: 'ringing-bell-sound',
    prompt: 'What energy is in a ringing bell?',
    includes: [/sound energy/i, /vibrations/i]
  },
  {
    name: 'lightning-electrical-radiant',
    prompt: 'What energy is in lightning?',
    includes: [/electrical energy/i, /radiant|light/i]
  },
  {
    name: 'flashlight-transformation',
    prompt: 'What energy transformation happens in a flashlight?',
    includes: [/chemical energy/i, /electrical energy/i, /radiant|light/i, /thermal energy/i]
  },
  {
    name: 'lamp-transformation',
    prompt: 'What energy transformation happens in a lamp?',
    includes: [/electrical energy/i, /radiant|light/i, /thermal energy/i]
  },
  {
    name: 'speaker-transformation',
    prompt: 'What energy transformation happens in a speaker?',
    includes: [/electrical energy/i, /sound energy/i]
  },
  {
    name: 'food-run-transformation',
    prompt: 'What energy transformation happens when you eat food and run?',
    includes: [/chemical energy/i, /kinetic|mechanical/i, /thermal energy/i]
  },
  {
    name: 'toaster-transformation',
    prompt: 'What energy transformation happens in a toaster?',
    includes: [/electrical energy/i, /thermal energy/i, /radiant|light/i]
  },
  {
    name: 'gasoline-car-transformation',
    prompt: 'What energy transformation happens when gasoline burns in a car?',
    includes: [/chemical energy/i, /thermal energy/i, /mechanical|kinetic/i]
  },
  {
    name: 'solar-panel-transformation',
    prompt: 'What energy transformation happens in a solar panel?',
    includes: [/radiant|light/i, /Sun/i, /electrical energy/i]
  },
  {
    name: 'falling-ball-transformation',
    prompt: 'What energy transformation happens when a ball falls?',
    includes: [/gravitational potential energy/i, /kinetic energy/i]
  },
  {
    name: 'rubber-band-release-transformation',
    prompt: 'What energy transformation happens when a stretched rubber band is released?',
    includes: [/elastic potential energy/i, /kinetic energy/i]
  },
  {
    name: 'hand-warmer-transformation',
    prompt: 'What energy transformation happens in a hand warmer?',
    includes: [/chemical energy/i, /thermal energy/i, /releases heat|heat/i]
  },
  {
    name: 'kinetic-potential-difference',
    prompt: 'What is the difference between kinetic and potential energy?',
    includes: [/kinetic energy/i, /motion/i, /potential energy/i, /stored/i]
  },
  {
    name: 'thermal-temperature-difference',
    prompt: 'What is the difference between thermal and temperature?',
    includes: [/temperature/i, /average/i, /particle/i, /thermal energy/i, /amount of matter/i]
  },
  {
    name: 'radiant-sound-difference',
    prompt: 'What is the difference between radiant energy and sound energy?',
    includes: [/radiant energy/i, /electromagnetic waves/i, /empty space/i, /sound energy/i, /vibrations/i, /medium/i]
  },
  {
    name: 'chemical-electrical-difference',
    prompt: 'What is the difference between chemical and electrical energy?',
    includes: [/chemical energy/i, /bonds/i, /electrical energy/i, /moving electric charges|moving charges|current/i]
  },
  {
    name: 'mechanical-not-same-as-kinetic',
    prompt: 'Is mechanical energy the same as kinetic energy?',
    includes: [/no/i, /kinetic energy/i, /one kind|kind of/i, /mechanical energy/i, /potential energy/i]
  },
  {
    name: 'typo-batery',
    prompt: 'what energy is in a batery',
    includes: [/chemical energy/i, /electrical energy/i]
  },
  {
    name: 'typo-enegy-food',
    prompt: 'what kind of enegy does food have',
    includes: [/chemical energy/i]
  },
  {
    name: 'typo-lite-radiant',
    prompt: 'is lite energy radiant energy',
    includes: [/yes|radiant energy/i, /light energy/i]
  },
  {
    name: 'typo-speeker-sound',
    prompt: 'what energy is a sound from a speeker',
    includes: [/sound energy/i]
  },
  {
    name: 'hot-thing-thermal',
    prompt: 'what energy is a hot thing giving off',
    includes: [/thermal energy/i]
  },
  {
    name: 'typo-enery-moving-bike',
    prompt: 'what enery is a moving bike',
    includes: [/kinetic energy/i, /mechanical energy/i]
  },
  {
    name: 'rubber-band-pulled-back',
    prompt: 'what energy is a rubber band pulled back',
    includes: [/elastic potential energy/i]
  },
  {
    name: 'rock-up-high-gpe',
    prompt: 'what energy is a rock up high',
    includes: [/gravitational potential energy/i]
  },
  {
    name: 'typo-flashlite-transformation',
    prompt: 'what energy change happens in a flashlite',
    includes: [/chemical energy/i, /electrical energy/i, /radiant|light/i, /thermal energy/i]
  },
  {
    name: 'typo-transformashun-battery-bulb',
    prompt: 'battery to bulb is what energy transformashun',
    includes: [/chemical energy/i, /electrical energy/i, /radiant|light/i, /thermal energy/i]
  },
  {
    name: 'main-types-energy',
    prompt: 'What are the main types of energy?',
    includes: [/mechanical/i, /kinetic/i, /potential/i, /thermal/i, /chemical/i, /electrical/i, /radiant|light/i, /sound/i]
  },
  {
    name: 'list-energy-types-examples',
    prompt: 'List energy types with examples.',
    includes: [/mechanical/i, /moving/i, /chemical/i, /food|batter/i, /speaker|sound/i]
  },
  {
    name: 'explain-six-energy-types',
    prompt: 'Explain chemical, thermal, electrical, radiant, sound, and mechanical energy.',
    includes: [/Chemical energy/i, /Thermal energy/i, /Electrical energy/i, /Radiant|light/i, /Sound energy/i, /Mechanical energy/i]
  },
  {
    name: 'examples-each-energy-type',
    prompt: 'Give examples of each type of energy.',
    includes: [/mechanical/i, /kinetic/i, /potential/i, /thermal/i, /chemical/i, /electrical/i, /radiant|light/i, /sound/i]
  },
  {
    name: 'motion-energy-type',
    prompt: 'What type of energy is most connected to motion?',
    includes: [/kinetic energy/i, /motion/i]
  },
  {
    name: 'stored-energy-type',
    prompt: 'What type of energy is stored energy?',
    includes: [/potential energy/i, /chemical energy/i, /gravitational potential energy/i, /elastic potential energy/i]
  }
];

const CONCEPT_TUTOR_BOUNDARY_CASES = [
  {
    prompt: 'Is melting ice endothermic or exothermic?',
    tutorId: 'energy.processes.endothermic-exothermic.identification'
  },
  {
    prompt: 'Is fire burning endothermic or exothermic?',
    tutorId: 'energy.processes.endothermic-exothermic.identification'
  },
  {
    prompt: 'Is heat from the Sun conduction, convection, or radiation?',
    tutorId: 'energy.transfer.conduction-convection-radiation'
  },
  {
    prompt: 'Is a moving car kinetic, gravitational potential, or elastic potential energy?',
    tutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification'
  },
  {
    prompt: 'Is a book on a shelf kinetic, gravitational potential, or elastic potential energy?',
    tutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification'
  },
  {
    prompt: 'Is a stretched rubber band kinetic, gravitational potential, or elastic potential energy?',
    tutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification'
  }
];

const FORMULA_BOUNDARY_CASES = [
  'Calculate kinetic energy if mass is 2 kg and velocity is 3 m/s.',
  'Find kinetic energy for a 4 kg object moving 5 m/s.',
  'Calculate gravitational potential energy if mass is 2 kg, gravity is 9.8 m/s^2, and height is 3 m.',
  'Find potential energy if mass is 5 kg and height is 10 m.',
  'Calculate thermal energy if mass is 2 kg, specific heat is 4 J/g°C, and temperature change is 5°C.',
  'Calculate work if force is 10 N and distance is 3 m.',
  'Calculate power if work is 100 J and time is 5 s.'
];

async function main() {
  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const sessionId = create.body.sessionId;

  for (const testCase of DIRECT_CASES) {
    const response = await ask(request, sessionId, `direct-${slug(testCase.name)}`, testCase.prompt);
    assert.notEqual(response.routeType, 'concept_tutor', `${testCase.name} should stay Direct Answer, not Concept Tutor`);
    assert.notEqual(response.routeType, 'formula_tutor', `${testCase.name} should stay Direct Answer, not Formula Tutor`);
    assertAnswer(response.response, testCase);
  }

  for (const testCase of CONCEPT_TUTOR_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `concept-${slug(testCase.prompt)}`, testCase.prompt);
    assert.equal(response.routeType, 'concept_tutor', `${testCase.prompt} should still start Concept Tutor`);
    assert.equal(response.tutor?.id, testCase.tutorId, `${testCase.prompt} tutor id`);
  }

  for (const prompt of FORMULA_BOUNDARY_CASES) {
    const response = await ask(request, sessionId, `formula-${slug(prompt)}`, prompt);
    assert.match(response.routeType, /formula/i, `${prompt} should stay Formula Tutor or formula route`);
  }

  console.log('PASS Unit 3 broad energy type direct answers: definitions, examples, transformations, typos, and route boundaries');
}

async function ask(request, sessionId, studentHubId, message) {
  const response = await request('POST', '/api/student/message', {
    sessionId,
    studentHubId,
    message
  });
  assert.equal(response.statusCode, 200, `${studentHubId}: ${message}`);
  return response.body;
}

function assertAnswer(answer, testCase) {
  const answerText = String(answer || '');
  assert.ok(answerText.trim(), `${testCase.name} should produce an answer`);
  for (const expected of testCase.includes || []) {
    assert.match(answerText, expected, `${testCase.name} should include ${expected} but got:\n${answerText}`);
  }
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
