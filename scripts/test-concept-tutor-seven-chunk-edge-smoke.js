const assert = require('node:assert/strict');

const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const TUTOR_FINALS = {
  'matter.physical-chemical-change.identification': {
    physical: /This describes a physical change because the substance changes form, size, shape, or state but does not become a new substance\./i,
    chemical: /This describes a chemical change because a new substance is formed\./i
  },
  'waves.reflection-refraction-absorption.identification': {
    reflection: /This describes reflection because the wave or light bounces off a surface\./i,
    refraction: /This describes refraction because the wave or light bends when it enters a new material\./i,
    absorption: /This describes absorption because the material takes in the wave or light energy\./i
  },
  'waves.properties.amplitude-wavelength-frequency': {
    amplitude: /This describes amplitude because amplitude is the height of a wave\./i,
    wavelength: /This describes wavelength because wavelength is the distance from one crest to the next crest, or one trough to the next trough\./i,
    frequency: /This describes frequency because frequency is the number of waves that pass a point each second\./i
  },
  'electricity.circuits.open-closed.identification': {
    closed: /This describes a closed circuit because the path is complete, so current can flow\./i,
    open: /This describes an open circuit because the path is broken or open, so current cannot flow\./i
  },
  'electricity.circuits.series-parallel.identification': {
    series: /This describes a series circuit because current has only one path to follow\./i,
    parallel: /This describes a parallel circuit because current has more than one path to follow\./i
  },
  'energy.processes.endothermic-exothermic.identification': {
    endothermic: /This describes an endothermic process because energy is absorbed from the surroundings\./i,
    exothermic: /This describes an exothermic process because energy is released to the surroundings\./i
  },
  'energy.mechanical-types.kinetic-gpe-elastic.identification': {
    kinetic: /This describes kinetic energy because kinetic energy is the energy of motion\./i,
    gravitational: /This describes gravitational potential energy because it is stored energy due to height or position\./i,
    elastic: /This describes elastic potential energy because it is stored energy in something stretched or compressed\./i
  }
};

const EDGE_CASES = [
  {
    prompt: 'my ice cube meltng on the desk -- physical or chemical change?',
    expectedTutorId: 'matter.physical-chemical-change.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'physical'
  },
  {
    prompt: 'if i rip a sheet of paper in half is that physical or chemicle change',
    expectedTutorId: 'matter.physical-chemical-change.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'physical'
  },
  {
    prompt: 'sugar kinda dissapears in water but its still sugar, physical or chemical change?',
    expectedTutorId: 'matter.physical-chemical-change.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'physical'
  },
  {
    prompt: 'when water turns to ice in the freezer is it chemical or physical change',
    expectedTutorId: 'matter.physical-chemical-change.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'physical'
  },
  {
    prompt: 'cuting a log into smaller pieces would be physical or chemical change?',
    expectedTutorId: 'matter.physical-chemical-change.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'physical'
  },
  {
    prompt: 'a bike chain rusts outside, physical or chem change?',
    expectedTutorId: 'matter.physical-chemical-change.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'chemical'
  },
  {
    prompt: 'toast gets burnt black in the toaster, is that physical or chemical change',
    expectedTutorId: 'matter.physical-chemical-change.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'chemical'
  },
  {
    prompt: 'vineger and baking soda make bubbles/fizz, physical or chemical change?',
    expectedTutorId: 'matter.physical-chemical-change.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'chemical'
  },
  {
    prompt: 'which is chemical change: melting chocolate or a nail rusting',
    expectedTutorId: 'matter.physical-chemical-change.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'chemical'
  },
  {
    prompt: 'which one is physical: paper getting shredded or wood burning up',
    expectedTutorId: 'matter.physical-chemical-change.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'physical'
  },
  {
    prompt: 'lite bouncing of a shiny mirror is reflection refraction or absorption?',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'reflection'
  },
  {
    prompt: 'an echo in a hallway, is that reflecton refraction or absorption',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'reflection'
  },
  {
    prompt: 'when sound bounces back off a wall is it reflection, refraction, or absorption?',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'reflection'
  },
  {
    prompt: 'a pencil looks brokin in a cup of water reflection refraction absorption?',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'refraction'
  },
  {
    prompt: 'light bends when it goes thru glass, reflection refraction or absorption',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'refraction'
  },
  {
    prompt: 'my spoon looks crookid under water, is that reflection refraction or absorption',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'refraction'
  },
  {
    prompt: 'black pavement soaking up sunlight and getting hot is reflection refraction or absorption?',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification',
    expectedChoice: '3',
    expectedFinalIdea: 'absorption'
  },
  {
    prompt: 'a dark hoodie takes in light energy, reflection refraction absorption?',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification',
    expectedChoice: '3',
    expectedFinalIdea: 'absorption'
  },
  {
    prompt: 'which is refraction: echo, straw looks bent in water, or black shirt heats up',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'refraction'
  },
  {
    prompt: 'which is absorption: mirror bounce, glass bending light, or black paper warming',
    expectedTutorId: 'waves.reflection-refraction-absorption.identification',
    expectedChoice: '3',
    expectedFinalIdea: 'absorption'
  },
  {
    prompt: 'the tallness of a wave is amplitude wavelength or frequency?',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency',
    expectedChoice: '1',
    expectedFinalIdea: 'amplitude'
  },
  {
    prompt: 'big wave hieght means what property amplitude wavelength frequency',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency',
    expectedChoice: '1',
    expectedFinalIdea: 'amplitude'
  },
  {
    prompt: 'from crest to crest distance is amplitude wave length or frequency?',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency',
    expectedChoice: '2',
    expectedFinalIdea: 'wavelength'
  },
  {
    prompt: 'trouf to trouf spacing is amplitude, wavelength, or frequency?',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency',
    expectedChoice: '2',
    expectedFinalIdea: 'wavelength'
  },
  {
    prompt: 'space between one wave and the next is amplitude wavelength or frequincy',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency',
    expectedChoice: '2',
    expectedFinalIdea: 'wavelength'
  },
  {
    prompt: 'waves each second is amplitude wavelength or frequency',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency',
    expectedChoice: '3',
    expectedFinalIdea: 'frequency'
  },
  {
    prompt: 'cycles per sec means amplitude wavelength or frequency?',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency',
    expectedChoice: '3',
    expectedFinalIdea: 'frequency'
  },
  {
    prompt: 'hertz is measuring amplitude wavelength or frequncy',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency',
    expectedChoice: '3',
    expectedFinalIdea: 'frequency'
  },
  {
    prompt: 'which is wavelength: tall wave, crest-to-crest gap, or waves every second',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency',
    expectedChoice: '2',
    expectedFinalIdea: 'wavelength'
  },
  {
    prompt: 'which one is amplitude: waves per second, trough-to-trough distance, or wave height',
    expectedTutorId: 'waves.properties.amplitude-wavelength-frequency',
    expectedChoice: '1',
    expectedFinalIdea: 'amplitude'
  },
  {
    prompt: 'switch is shut and the bulb glows, open or closed circuit?',
    expectedTutorId: 'electricity.circuits.open-closed.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'closed'
  },
  {
    prompt: 'the wires make a full loop so current can go, is it open or closed',
    expectedTutorId: 'electricity.circuits.open-closed.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'closed'
  },
  {
    prompt: 'if current is flowing around the circut is it open or closed?',
    expectedTutorId: 'electricity.circuits.open-closed.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'closed'
  },
  {
    prompt: 'battery wire bulb all connected in one complete path, open or closed circuit',
    expectedTutorId: 'electricity.circuits.open-closed.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'closed'
  },
  {
    prompt: 'a lamp is lit because the path isnt broken open or closed?',
    expectedTutorId: 'electricity.circuits.open-closed.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'closed'
  },
  {
    prompt: 'the swich is up and current cant go, open or closed circuit?',
    expectedTutorId: 'electricity.circuits.open-closed.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'open'
  },
  {
    prompt: 'one wire is cut in the circuit so the bulb is off open or closed',
    expectedTutorId: 'electricity.circuits.open-closed.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'open'
  },
  {
    prompt: 'current cannot flow because there is a gap, is that open or closed?',
    expectedTutorId: 'electricity.circuits.open-closed.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'open'
  },
  {
    prompt: 'which is open: full loop or broken wire',
    expectedTutorId: 'electricity.circuits.open-closed.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'open'
  },
  {
    prompt: 'which one is closed circuit: broken path or complete path',
    expectedTutorId: 'electricity.circuits.open-closed.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'closed'
  },
  {
    prompt: 'all parts are on one single path is it series or parallel',
    expectedTutorId: 'electricity.circuits.series-parallel.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'series'
  },
  {
    prompt: 'one road for current only, series or paralell circuit?',
    expectedTutorId: 'electricity.circuits.series-parallel.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'series'
  },
  {
    prompt: 'if one lite bulb goes out and every bulb dies too, series or parallel',
    expectedTutorId: 'electricity.circuits.series-parallel.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'series'
  },
  {
    prompt: 'same current has to go through each part, series or parallel?',
    expectedTutorId: 'electricity.circuits.series-parallel.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'series'
  },
  {
    prompt: 'which is series: branch paths or only one path for current',
    expectedTutorId: 'electricity.circuits.series-parallel.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'series'
  },
  {
    prompt: 'a circut with branches is series or parallel?',
    expectedTutorId: 'electricity.circuits.series-parallel.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'parallel'
  },
  {
    prompt: 'more then one path for current is series or paralel',
    expectedTutorId: 'electricity.circuits.series-parallel.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'parallel'
  },
  {
    prompt: 'one bulb burns out but the other lights stay on, series or parallel circuit',
    expectedTutorId: 'electricity.circuits.series-parallel.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'parallel'
  },
  {
    prompt: 'current can split into two branches, series or parallel?',
    expectedTutorId: 'electricity.circuits.series-parallel.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'parallel'
  },
  {
    prompt: 'which is parallel: one path only or many branch paths',
    expectedTutorId: 'electricity.circuits.series-parallel.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'parallel'
  },
  {
    prompt: 'ice melting on my hand absorbs heat, endothermic or exothermic?',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'endothermic'
  },
  {
    prompt: 'evaporating sweat takes in energy, endothermic or exothermic',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'endothermic'
  },
  {
    prompt: 'instant cold pak gets cold because energy is absorbed endothermic exothermic?',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'endothermic'
  },
  {
    prompt: 'boiling water into vapor absorbs heat, endothermic or exothermic',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'endothermic'
  },
  {
    prompt: 'which is endothermic: freezing water or melting snow',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'endothermic'
  },
  {
    prompt: 'a fire gives off heat, endothermic or exothermic?',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'exothermic'
  },
  {
    prompt: 'water freezing releases energy to surroundings, endothermic or exothermic',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'exothermic'
  },
  {
    prompt: 'hand warmer packs releese heat, endothermic or exothermic?',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'exothermic'
  },
  {
    prompt: 'burning wood lets heat out, is that endo or exothermic',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'exothermic'
  },
  {
    prompt: 'which is exothermic: evaporation or a hand warmer heating up',
    expectedTutorId: 'energy.processes.endothermic-exothermic.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'exothermic'
  },
  {
    prompt: 'a skateboard rolling downhill is kinetic gravitational potential or elastic potential energy?',
    expectedTutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'kinetic'
  },
  {
    prompt: 'moving soccer ball energy is kinetic, gravitational potential, or elastic potential?',
    expectedTutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'kinetic'
  },
  {
    prompt: 'mechanical kinetic energy in a moving cart is kinetic gravitational potential or elastic potential?',
    expectedTutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
    expectedChoice: '1',
    expectedFinalIdea: 'kinetic'
  },
  {
    prompt: 'a rock sitting high on a cliff is kinetic, gravitational potential, or elastic potential energy?',
    expectedTutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'gravitational'
  },
  {
    prompt: 'a backpack up on a tall shelf is kinetic gravitional potential or elastic potential',
    expectedTutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'gravitational'
  },
  {
    prompt: 'ball held way above the floor is kinetic gravitational potental or elastic potential energy',
    expectedTutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'gravitational'
  },
  {
    prompt: 'a pulled back rubber band is kinetic gravitational potential or elastic potential',
    expectedTutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
    expectedChoice: '3',
    expectedFinalIdea: 'elastic'
  },
  {
    prompt: 'a squished spring stores what: kinetic gravitational potential or elastic potential energy',
    expectedTutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
    expectedChoice: '3',
    expectedFinalIdea: 'elastic'
  },
  {
    prompt: 'which is elastic potential: rolling ball, book high up, or compressed spring',
    expectedTutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
    expectedChoice: '3',
    expectedFinalIdea: 'elastic'
  },
  {
    prompt: 'which is gravitational potential: moving bike, rock on a hill, or stretched rubber band',
    expectedTutorId: 'energy.mechanical-types.kinetic-gpe-elastic.identification',
    expectedChoice: '2',
    expectedFinalIdea: 'gravitational'
  }
];

const WRONG_CHOICE_CASES = [
  { index: 0, wrongChoice: '2' },
  { index: 10, wrongChoice: '2' },
  { index: 20, wrongChoice: '2' },
  { index: 30, wrongChoice: '2' },
  { index: 40, wrongChoice: '2' },
  { index: 50, wrongChoice: '2' },
  { index: 60, wrongChoice: '2' }
];

async function main() {
  assert.equal(EDGE_CASES.length, 70, 'expected exactly 70 edge smoke prompts');
  const { request } = createStudentRouteHarness();
  const create = await request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201);
  const classSessionId = create.body.sessionId;

  for (const [index, testCase] of EDGE_CASES.entries()) {
    await assertStartsAndCompletes({
      request,
      classSessionId,
      testCase,
      index
    });
  }

  for (const retryCase of WRONG_CHOICE_CASES) {
    await assertWrongChoiceRetries({
      request,
      classSessionId,
      testCase: EDGE_CASES[retryCase.index],
      wrongChoice: retryCase.wrongChoice,
      index: retryCase.index
    });
  }

  console.log('PASS concept tutor seven-chunk edge smoke: 70/70 prompts start, complete, and retry with controlled choices');
}

async function assertStartsAndCompletes({ request, classSessionId, testCase, index }) {
  const studentHubId = `seven-chunk-edge-${index + 1}`;
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: testCase.prompt
  });

  assert.equal(start.statusCode, 200, `start status for ${testCase.prompt}`);
  assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start Concept Tutor`);
  assert.equal(start.body.tutor.id, testCase.expectedTutorId, `${testCase.prompt} tutor id`);
  assert.equal(start.body.tutor.active, true, `${testCase.prompt} active tutor`);
  assert.equal(start.body.tutor.originalQuestion, testCase.prompt, `${testCase.prompt} original question`);
  assert.equal(start.body.tutor.currentStepIndex, 0, `${testCase.prompt} first step index`);
  assertControlledNumberedChoicePrompt(start.body.response, start.body.tutor, testCase.prompt);

  const finalPattern = getFinalPattern(testCase);
  assert.doesNotMatch(start.body.response, finalPattern, `${testCase.prompt} should not show final answer on first prompt`);
  assert.equal(start.body.tutor.finalAnswer, undefined, `${testCase.prompt} active tutor metadata should hide final answer`);
  assert.equal(start.body.tutor.work.finalAnswer, '', `${testCase.prompt} active tutor work should hide final answer`);

  const complete = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: testCase.expectedChoice
  });

  assert.equal(complete.statusCode, 200, `complete status for ${testCase.prompt}`);
  assert.equal(complete.body.routeType, 'concept_tutor', `${testCase.prompt} completion route`);
  assert.equal(complete.body.tutor.id, testCase.expectedTutorId, `${testCase.prompt} completion tutor id`);
  assert.equal(complete.body.tutor.completed, true, `${testCase.prompt} should complete`);
  assert.equal(complete.body.tutor.active, false, `${testCase.prompt} should not stay active after correct answer`);
  assert.match(complete.body.response, finalPattern, `${testCase.prompt} final response`);
  assert.match(complete.body.tutor.finalAnswer, finalPattern, `${testCase.prompt} final metadata`);
}

async function assertWrongChoiceRetries({ request, classSessionId, testCase, wrongChoice, index }) {
  const studentHubId = `seven-chunk-edge-wrong-${index + 1}`;
  const start = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: testCase.prompt
  });
  assert.equal(start.statusCode, 200);
  assert.equal(start.body.routeType, 'concept_tutor', `${testCase.prompt} should start for retry`);

  const wrong = await request('POST', '/api/student/message', {
    sessionId: classSessionId,
    studentHubId,
    message: wrongChoice
  });
  assert.equal(wrong.statusCode, 200, `wrong status for ${testCase.prompt}`);
  assert.equal(wrong.body.routeType, 'concept_tutor', `${testCase.prompt} wrong-answer route`);
  assert.equal(wrong.body.tutor.id, testCase.expectedTutorId, `${testCase.prompt} wrong-answer tutor id`);
  assert.equal(wrong.body.tutor.active, true, `${testCase.prompt} should stay active after wrong answer`);
  assert.equal(wrong.body.tutor.currentStepIndex, 0, `${testCase.prompt} should stay on first step after wrong answer`);
  assert.match(wrong.body.response, /Not quite|not the best fit/i, `${testCase.prompt} should give retry feedback`);
  assert.doesNotMatch(wrong.body.response, getFinalPattern(testCase), `${testCase.prompt} wrong retry should not leak final answer`);
}

function assertControlledNumberedChoicePrompt(response, tutor, prompt) {
  assert.match(response, /type only the number/i, `${prompt} should ask for number-only response`);
  assert.ok(Array.isArray(tutor?.currentStep?.choices), `${prompt} should expose controlled choices`);
  assert.ok(tutor.currentStep.choices.length >= 2, `${prompt} should have controlled choices`);
  tutor.currentStep.choices.forEach((choice, index) => {
    assert.equal(String(choice.number), String(index + 1), `${prompt} choice ${index + 1} should be numbered`);
    assert.match(response, new RegExp(`\\b${index + 1}\\.`), `${prompt} response should show choice ${index + 1}`);
  });
  assert.doesNotMatch(response, /what do you think|explain in your own words|type your answer/i, `${prompt} should not be open-ended`);
}

function getFinalPattern(testCase) {
  const finalPatterns = TUTOR_FINALS[testCase.expectedTutorId];
  assert.ok(finalPatterns, `${testCase.expectedTutorId} should have final patterns`);
  const pattern = finalPatterns[testCase.expectedFinalIdea];
  assert.ok(pattern, `${testCase.expectedFinalIdea} should have a final pattern`);
  return pattern;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
