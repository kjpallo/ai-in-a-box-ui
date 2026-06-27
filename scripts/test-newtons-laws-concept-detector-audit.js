const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const {
  buildNewtonsLawsConceptTutorPattern,
  detectNewtonsLawsConceptTutorAudit
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');

const NEWTONS_LAWS_CONCEPT_TUTOR_CASES = [
  {
    prompt: "Which Newton's law is shown when a soccer ball stays still until kicked?",
    law: 'first',
    triggerGroup: '1st Law / inertia',
    triggerPrompt: /Which Newton's law best matches the clue\?/i
  },
  {
    prompt: "Which Newton's law is a rocket launching?",
    law: 'third',
    triggerGroup: '3rd Law / action-reaction',
    triggerPrompt: /Which Newton's law best matches the clue\?/i
  },
  {
    prompt: "Which Newton's law is a swimmer pushing water backward and moving forward?",
    law: 'third',
    triggerGroup: '3rd Law / action-reaction',
    triggerPrompt: /Which Newton's law best matches the clue\?/i
  },
  {
    prompt: "Which Newton's law is force equals mass times acceleration?",
    law: 'second',
    triggerGroup: '2nd Law / F = ma',
    triggerPrompt: /Which Newton's law best matches the clue\?/i
  },
  {
    prompt: "Which Newton's law is about action and reaction?",
    law: 'third',
    triggerGroup: '3rd Law / action-reaction',
    triggerPrompt: /Which Newton's law best matches the clue\?/i
  },
  {
    prompt: "Which Newton's law is about inertia?",
    law: 'first',
    triggerGroup: '1st Law / inertia',
    triggerPrompt: /Which Newton's law best matches the clue\?/i
  },
  {
    prompt: "Which Newton's law is shown when a seatbelt stops you in a car?",
    law: 'first',
    triggerGroup: '1st Law / inertia',
    triggerPrompt: /Which Newton's law best matches the clue\?/i
  },
  {
    prompt: "Which Newton's law is shown when pushing a shopping cart harder makes it accelerate more?",
    law: 'second',
    triggerGroup: '2nd Law / F = ma',
    triggerPrompt: /Which Newton's law best matches the clue\?/i
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  {
    prompt: "What is Newton's first law?",
    includes: /Newton/i
  },
  {
    prompt: "Define Newton's second law.",
    includes: /force|mass|acceleration/i
  },
  {
    prompt: "Explain Newton's third law.",
    includes: /action|reaction|equal|opposite/i
  },
  {
    prompt: "What are Newton's laws?",
    includes: /First Law|Second Law|Third Law/i
  },
  {
    prompt: 'What is inertia?',
    includes: /resist|motion|change/i
  }
];

const FORMULA_TUTOR_CASES_TO_PRESERVE = [
  {
    prompt: 'A 4 kg object accelerates at 3 m/s^2. What force is needed?',
    formulaId: 'force_mass_acceleration'
  },
  {
    prompt: 'Calculate force if mass is 4 kg and acceleration is 3 m/s^2.',
    formulaId: 'force_mass_acceleration'
  },
  {
    prompt: 'What is the acceleration of a 10 kg object with a 20 N force?',
    formulaId: 'force_mass_acceleration'
  },
  {
    prompt: 'A 2 N and an 8 N force pull right and a 4 N force pulls left. What is the acceleration of a 0.5 kg object?',
    formulaId: 'net_force_newton_second_law'
  }
];

function main() {
  testNewtonLawConceptTutorPatternCandidates();
  testPureDefinitionAndExplanationPromptsDoNotStartConceptTutor();
  testFormulaTutorPromptsKeepPriority();

  console.log('PASS Newtons laws detector audit: identification candidates, controlled pattern shape, and definition/formula boundaries are preserved');
}

function testNewtonLawConceptTutorPatternCandidates() {
  for (const testCase of NEWTONS_LAWS_CONCEPT_TUTOR_CASES) {
    const audit = detectNewtonsLawsConceptTutorAudit(testCase.prompt);
    assert.equal(audit.shouldStartConceptTutor, true, `${testCase.prompt} should be a Concept Tutor candidate`);
    assert.equal(audit.law, testCase.law);
    assert.equal(audit.triggerGroup, testCase.triggerGroup);
    assert.equal(audit.blockedReason, '');

    const pattern = buildNewtonsLawsConceptTutorPattern(testCase.prompt);
    assert.equal(pattern.id, 'motion-force.newtons-laws.identification');
    assert.match(pattern.steps[0].prompt, testCase.triggerPrompt);
    assert.equal(pattern.steps.length, 1);
    assert.equal(pattern.steps[0].type, 'choice');
    assert.deepEqual(
      pattern.steps[0].choices.map((choice) => choice.number),
      [1, 2, 3],
      'Newton law tutor must stay numbered-choice only'
    );

    const route = routeStudentQuestion(testCase.prompt, []);
    assert.notEqual(route.type, 'concept_tutor', `${testCase.prompt} should stay out of the old broad router`);
  }
}

function testPureDefinitionAndExplanationPromptsDoNotStartConceptTutor() {
  for (const { prompt } of DIRECT_ANSWER_CASES_TO_PRESERVE) {
    const audit = detectNewtonsLawsConceptTutorAudit(prompt);
    assert.equal(audit.shouldStartConceptTutor, false, `${prompt} should stay out of the scenario Concept Tutor detector`);
    assert.equal(audit.blockedReason, 'pure_definition_or_explanation');
    assert.equal(buildNewtonsLawsConceptTutorPattern(prompt), null);
  }
}

function testFormulaTutorPromptsKeepPriority() {
  for (const testCase of FORMULA_TUTOR_CASES_TO_PRESERVE) {
    const audit = detectNewtonsLawsConceptTutorAudit(testCase.prompt);
    assert.equal(audit.shouldStartConceptTutor, false, `${testCase.prompt} should not be a Concept Tutor candidate`);
    assert.equal(audit.blockedReason, 'formula_or_calculation_prompt');

    const route = routeStudentQuestion(testCase.prompt, []);
    assert.equal(route.type, 'science_formula', `${testCase.prompt} should route as formula work before Concept Tutor`);
    assert.equal(route.formulaWork?.formulaId, testCase.formulaId);
  }
}

main();
