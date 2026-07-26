const assert = require('node:assert/strict');
const path = require('node:path');

const {
  findRelevantKnowledge,
  loadTeacherKnowledge
} = require('../lib/knowledge/teacherKnowledge');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const {
  buildFormulaTutorPrompt,
  canStartFormulaTutor,
  startFormulaTutor
} = require('../lib/tutor/formulaTutor');
const { getUnsafeStudentTutorStepReasons } = require('../lib/tutor/studentTutorSafety');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');

const teacherFactsPath = path.join(__dirname, '..', 'knowledge', 'teacher_facts.json');
const teacherKnowledge = loadTeacherKnowledge(teacherFactsPath);

const GOLDEN_CASES = [
  {
    name: 'speed from distance and time',
    question: 'A car travels 100 m in 20 s. What is its speed?',
    expected: {
      formulaId: 'speed_distance_time',
      family: 'motion',
      solveFor: 'speed',
      formula: 'speed = distance / time',
      variables: {
        distance: { value: 100, unit: 'm' },
        time: { value: 20, unit: 's' },
        speed: { value: 5, unit: 'm/s' }
      },
      finalAnswer: { value: 5, unit: 'm/s', display: '5 m/s' },
      stepIds: [
        'identify_solve_target',
        'choose_formula',
        'identify_distance',
        'identify_time',
        'calculate'
      ],
      firstPrompt: buildExpectedChoicePrompt({
        solveFor: 'speed',
        stepCount: 5,
        choices: [
          'speed — how fast something moves',
          'distance — how far something travels',
          'time — how long it takes'
        ],
        cue: 'What is its speed'
      })
    }
  },
  {
    name: 'distance from speed and time',
    question: 'A runner moves at 6 m/s for 8 s. What distance does the runner travel?',
    expected: {
      formulaId: 'speed_distance_time',
      family: 'motion',
      solveFor: 'distance',
      formula: 'distance = speed × time',
      variables: {
        distance: { value: 48, unit: 'm' },
        time: { value: 8, unit: 's' },
        speed: { value: 6, unit: 'm/s' }
      },
      finalAnswer: { value: 48, unit: 'm', display: '48 m' },
      stepIds: [
        'identify_solve_target',
        'choose_formula',
        'identify_time',
        'identify_speed',
        'calculate'
      ],
      firstPrompt: buildExpectedChoicePrompt({
        solveFor: 'distance',
        stepCount: 5,
        choices: [
          'speed — how fast something moves',
          'distance — how far something travels',
          'time — how long it takes'
        ],
        cue: 'What distance'
      })
    }
  },
  {
    name: 'force from mass and acceleration',
    question: 'A 3 kg cart accelerates at 2 m/s^2. What force is needed?',
    expected: {
      formulaId: 'force_mass_acceleration',
      family: 'force',
      solveFor: 'force',
      formula: 'F = m × a',
      variables: {
        mass: { value: 3, unit: 'kg' },
        acceleration: { value: 2, unit: 'm/s²' },
        force: { value: 6, unit: 'N' }
      },
      finalAnswer: { value: 6, unit: 'N', display: '6 N' },
      stepIds: [
        'identify_solve_target',
        'choose_formula',
        'identify_mass',
        'identify_acceleration',
        'calculate'
      ],
      firstPrompt: buildExpectedChoicePrompt({
        solveFor: 'force',
        stepCount: 5,
        choices: ['force', 'acceleration', 'mass']
      })
    }
  },
  {
    name: 'mass from force and acceleration',
    question: 'A net force of 24 N accelerates an object at 3 m/s^2. What is the mass?',
    expected: {
      formulaId: 'force_mass_acceleration',
      family: 'force',
      solveFor: 'mass',
      formula: 'm = F / a',
      variables: {
        mass: { value: 8, unit: 'kg' },
        acceleration: { value: 3, unit: 'm/s²' },
        force: { value: 24, unit: 'N' }
      },
      finalAnswer: { value: 8, unit: 'kg', display: '8 kg' },
      stepIds: [
        'identify_solve_target',
        'choose_formula',
        'identify_force',
        'identify_acceleration',
        'calculate'
      ],
      firstPrompt: buildExpectedChoicePrompt({
        solveFor: 'mass',
        stepCount: 5,
        choices: ['force', 'acceleration', 'mass']
      })
    }
  },
  {
    name: 'Ohm voltage from current and resistance',
    question: 'A circuit has a current of 2 A and a resistance of 6 ohms. What is the voltage?',
    expected: {
      formulaId: 'voltage_current_resistance',
      family: 'electricity',
      solveFor: 'voltage',
      formula: 'V = I × R',
      variables: {
        current: { value: 2, unit: 'A' },
        resistance: { value: 6, unit: 'Ω' },
        voltage: { value: 12, unit: 'V' }
      },
      finalAnswer: { value: 12, unit: 'V', display: '12 V' },
      stepIds: [
        'identify_solve_target',
        'choose_formula',
        'identify_current',
        'identify_resistance',
        'calculate'
      ],
      firstPrompt: buildExpectedChoicePrompt({
        solveFor: 'voltage',
        stepCount: 5,
        choices: ['voltage', 'current', 'resistance']
      })
    }
  },
  {
    name: 'Ohm current from voltage and resistance',
    question: 'A 12 V battery is connected to a 4 ohm resistor. What is the current?',
    expected: {
      formulaId: 'voltage_current_resistance',
      family: 'electricity',
      solveFor: 'current',
      formula: 'I = V / R',
      variables: {
        voltage: { value: 12, unit: 'V' },
        current: { value: 3, unit: 'A' },
        resistance: { value: 4, unit: 'Ω' }
      },
      finalAnswer: { value: 3, unit: 'A', display: '3 A' },
      stepIds: [
        'identify_solve_target',
        'choose_formula',
        'identify_voltage',
        'identify_resistance',
        'calculate'
      ],
      firstPrompt: buildExpectedChoicePrompt({
        solveFor: 'current',
        stepCount: 5,
        choices: ['voltage', 'current', 'resistance']
      })
    }
  },
  {
    name: 'kinetic energy',
    question: 'What is the kinetic energy of a 2 kg object moving at 3 m/s?',
    expected: {
      formulaId: 'kinetic_energy',
      family: 'kinetic_energy',
      solveFor: 'kinetic energy',
      formula: 'KE = 1/2 × m × v²',
      variables: {
        'kinetic energy': { value: 9, unit: 'J' },
        mass: { value: 2, unit: 'kg' },
        velocity: { value: 3, unit: 'm/s' }
      },
      finalAnswer: { value: 9, unit: 'J', display: '9 J' },
      stepIds: [
        'identify_solve_target',
        'choose_formula',
        'identify_mass',
        'identify_velocity',
        'calculate'
      ],
      firstPrompt: buildExpectedChoicePrompt({
        solveFor: 'kinetic energy',
        stepCount: 5,
        choices: ['kinetic energy', 'mass', 'velocity']
      })
    }
  },
  {
    name: 'gravitational potential energy',
    question: 'What is the gravitational potential energy of a 5 kg object at a height of 2 m?',
    expected: {
      formulaId: 'potential_energy',
      family: 'potential_energy',
      solveFor: 'potential energy',
      formula: 'PE = m × g × h',
      variables: {
        'potential energy': { value: 98, unit: 'J' },
        mass: { value: 5, unit: 'kg' },
        gravity: { value: 9.8, unit: 'm/s²' },
        height: { value: 2, unit: 'm' }
      },
      finalAnswer: { value: 98, unit: 'J', display: '98 J' },
      stepIds: [
        'identify_solve_target',
        'choose_formula',
        'identify_mass',
        'identify_gravity',
        'identify_height',
        'calculate'
      ],
      firstPrompt: buildExpectedChoicePrompt({
        solveFor: 'potential energy',
        stepCount: 6,
        choices: ['potential energy', 'height', 'mass', 'gravity']
      })
    }
  },
  {
    name: 'metric prefix conversion',
    question: 'Convert 3 km to mm.',
    expected: {
      formulaId: 'unit1_metric_stair_step_conversion',
      family: 'unit1_conversions',
      solveFor: 'converted value',
      formula: 'metric stair-step conversion',
      variables: {
        startValue: { value: 3, unit: 'km' },
        targetUnit: { value: 'mm', unit: '' }
      },
      finalAnswer: { value: 3000000, unit: 'mm', display: '3 km = 3,000,000 mm' },
      stepIds: ['choose_method'],
      firstPrompt: buildExpectedChoicePrompt({
        solveFor: 'converted value',
        stepCount: 1,
        prompt: 'Which method do you want to use?',
        choices: ['Stair-step conversion', 'Picket fence / dimensional analysis']
      })
    }
  },
  {
    name: 'mixed-unit picket-fence conversion',
    question: 'Convert 250.4 cm to feet.',
    expected: {
      formulaId: 'unit1_picket_fence_conversion',
      family: 'unit1_conversions',
      solveFor: 'converted value',
      formula: 'dimensional analysis / picket fence',
      variables: {
        given: { value: 250.4, unit: 'cm' },
        targetUnit: { value: 'ft', unit: '' }
      },
      finalAnswer: { value: 8.22, unit: 'ft', display: '8.22 ft' },
      stepIds: [
        'identify_given_quantity',
        'fill_conversion_factor_0_top',
        'fill_conversion_factor_0_bottom',
        'fill_conversion_factor_1_top',
        'fill_conversion_factor_1_bottom',
        'cancel_units_cm',
        'cancel_units_in',
        'calculate_result'
      ],
      firstPrompt: buildExpectedEntryPrompt({
        solveFor: 'converted value',
        stepCount: 8,
        prompt: 'Type the given number.'
      })
    }
  },
  {
    name: 'multi-factor time conversion',
    question: 'How many seconds are in one year?',
    expected: {
      formulaId: 'unit1_picket_fence_conversion',
      family: 'unit1_conversions',
      solveFor: 'converted value',
      formula: 'dimensional analysis / picket fence',
      variables: {
        given: { value: 1, unit: 'year' },
        targetUnit: { value: 's', unit: '' }
      },
      finalAnswer: { value: 31536000, unit: 's', display: '31,536,000 s' },
      stepIds: [
        'identify_given_quantity',
        'fill_conversion_factor_0_top',
        'fill_conversion_factor_0_bottom',
        'fill_conversion_factor_1_top',
        'fill_conversion_factor_1_bottom',
        'fill_conversion_factor_2_top',
        'fill_conversion_factor_2_bottom',
        'fill_conversion_factor_3_top',
        'fill_conversion_factor_3_bottom',
        'cancel_units_year',
        'cancel_units_days',
        'cancel_units_hr',
        'cancel_units_min',
        'calculate_result'
      ],
      firstPrompt: buildExpectedEntryPrompt({
        solveFor: 'converted value',
        stepCount: 14,
        prompt: 'Type the given number.'
      })
    }
  }
];

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

async function main() {
  const { questionAnswer } = createStudentRouteHarness();
  for (const testCase of GOLDEN_CASES) {
    await runGoldenCase(testCase, questionAnswer);
    console.log(`✅ ${testCase.name}`);
  }

  console.log(`Formula Tutor golden summary: ${GOLDEN_CASES.length}/${GOLDEN_CASES.length} passed`);
}

async function runGoldenCase(testCase, questionAnswer) {
  const { name, question, expected } = testCase;
  const matchedKnowledge = findRelevantKnowledge(question, teacherKnowledge, 8);
  const rawRoute = routeStudentQuestion(question, matchedKnowledge);
  const validatedResult = questionAnswer.routeMessage(question);
  const studentResult = await questionAnswer.answerStudentMessage(question, {
    recentMessages: [],
    pendingClarification: null,
    lastAnsweredPrompt: '',
    lastAnsweredAnswer: ''
  });
  const route = studentResult.questionRoute;

  assert.equal(rawRoute.type, 'science_formula', `${name}: expected a raw science formula route`);
  assert.equal(route.type, 'science_formula', `${name}: expected a science formula route`);
  assert.equal(
    validatedResult.questionRoute.type,
    'science_formula',
    `${name}: central validation changed the route type`
  );
  assert.equal(
    validatedResult.answerValidation?.valid,
    true,
    `${name}: central validation rejected the golden route`
  );
  assert.equal(
    studentResult.answerValidation?.valid,
    true,
    `${name}: student service rejected the golden route`
  );
  assert.ok(route.formulaWork, `${name}: expected semantic formula work`);
  assert.deepEqual(
    validatedResult.questionRoute.formulaWork,
    rawRoute.formulaWork,
    `${name}: central validation changed formula work`
  );
  assert.deepEqual(
    route.formulaWork,
    rawRoute.formulaWork,
    `${name}: student service changed formula work`
  );

  const formulaWork = route.formulaWork;
  assert.equal(formulaWork.formulaId, expected.formulaId, `${name}: formula identity changed`);
  assert.equal(formulaWork.family, expected.family, `${name}: formula family changed`);
  assert.equal(formulaWork.solveFor, expected.solveFor, `${name}: solve target changed`);
  assert.equal(formulaWork.formula, expected.formula, `${name}: rearranged formula changed`);

  assertParsedVariables(name, formulaWork.variables, expected.variables);
  assertFinalAnswer(name, formulaWork.finalAnswer, expected.finalAnswer);
  assert.deepEqual(
    formulaWork.steps.map((step) => step.id),
    expected.stepIds,
    `${name}: tutor step sequence changed`
  );
  assert.deepEqual(
    getUnsafeStudentTutorStepReasons(formulaWork.steps),
    [],
    `${name}: formula work contains an unsafe student-facing step`
  );

  assert.equal(canStartFormulaTutor(route), true, `${name}: Formula Tutor should remain eligible`);
  const tutorProblem = startFormulaTutor({
    questionRoute: route,
    originalQuestion: question
  });
  assert.ok(tutorProblem, `${name}: Formula Tutor should start`);
  assert.equal(tutorProblem.formulaId, expected.formulaId, `${name}: tutor formula identity changed`);
  assert.equal(tutorProblem.family, expected.family, `${name}: tutor family changed`);
  assert.equal(tutorProblem.solveFor, expected.solveFor, `${name}: tutor solve target changed`);
  assert.deepEqual(tutorProblem.variables, formulaWork.variables, `${name}: tutor parsed variables changed`);
  assert.deepEqual(tutorProblem.finalAnswer, formulaWork.finalAnswer, `${name}: tutor final answer changed`);
  assert.deepEqual(tutorProblem.steps, formulaWork.steps, `${name}: tutor did not preserve safe steps`);
  assert.equal(tutorProblem.currentStepIndex, 0, `${name}: tutor should begin at the first step`);
  assert.equal(tutorProblem.originalQuestion, question, `${name}: tutor should retain the source question`);
  assert.equal(
    buildFormulaTutorPrompt(tutorProblem),
    expected.firstPrompt,
    `${name}: first tutor prompt changed`
  );
}

function assertParsedVariables(name, actualVariables, expectedVariables) {
  assert.ok(actualVariables && typeof actualVariables === 'object', `${name}: missing parsed variables`);
  assert.deepEqual(
    Object.keys(actualVariables).sort(),
    Object.keys(expectedVariables).sort(),
    `${name}: parsed variable identity changed`
  );

  for (const [variableName, expectedVariable] of Object.entries(expectedVariables)) {
    const actualVariable = actualVariables[variableName];
    assert.ok(actualVariable, `${name}: missing parsed variable ${variableName}`);
    assertValueEqual(
      actualVariable.value,
      expectedVariable.value,
      `${name}: parsed ${variableName} value changed`
    );
    assert.equal(
      actualVariable.unit,
      expectedVariable.unit,
      `${name}: parsed ${variableName} unit changed`
    );
  }
}

function assertFinalAnswer(name, actual, expected) {
  assert.ok(actual && typeof actual === 'object', `${name}: missing final answer`);
  assertValueEqual(actual.value, expected.value, `${name}: final numeric value changed`);
  assert.equal(actual.unit, expected.unit, `${name}: final unit changed`);
  assert.equal(actual.display, expected.display, `${name}: final display changed`);
}

function assertValueEqual(actual, expected, message) {
  if (typeof expected === 'number') {
    assert.equal(typeof actual, 'number', `${message}: expected a numeric value`);
    const tolerance = Math.max(1, Math.abs(expected)) * 1e-12;
    assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`);
    return;
  }
  assert.equal(actual, expected, message);
}

function buildExpectedChoicePrompt({
  solveFor,
  stepCount,
  prompt = 'What variable are we solving for?',
  choices,
  cue = ''
}) {
  const lines = [
    `We are solving for ${solveFor}.`,
    '',
    `Step 1 of ${stepCount}:`,
    prompt,
    '',
    'Choose one:',
    ...choices.map((choice, index) => `${index + 1}. ${choice}`),
    '',
    'Click a choice or type only the number.'
  ];
  if (cue) {
    lines.push('', `The question says “${cue},” so we are solving for ${solveFor}.`);
  }
  return lines.join('\n');
}

function buildExpectedEntryPrompt({ solveFor, stepCount, prompt }) {
  return [
    `We are solving for ${solveFor}.`,
    '',
    `Step 1 of ${stepCount}:`,
    prompt
  ].join('\n');
}
