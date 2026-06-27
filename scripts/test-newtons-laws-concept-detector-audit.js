const assert = require('node:assert/strict');

const { routeStudentQuestion } = require('../lib/router/questionRouter');
const {
  detectNewtonsLawsConceptTutorAudit
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');

const FUTURE_CONCEPT_TUTOR_CANDIDATES = [
  {
    prompt: "Which Newton's law is shown when a soccer ball stays still until kicked?",
    law: 'first',
    triggerGroup: '1st Law / inertia'
  },
  {
    prompt: "Which Newton's law is a rocket launching?",
    law: 'third',
    triggerGroup: '3rd Law / action-reaction'
  },
  {
    prompt: "Which Newton's law is a swimmer pushing water backward and moving forward?",
    law: 'third',
    triggerGroup: '3rd Law / action-reaction'
  },
  {
    prompt: "Which Newton's law is force equals mass times acceleration?",
    law: 'second',
    triggerGroup: '2nd Law / F = ma'
  },
  {
    prompt: "Which Newton's law is about action and reaction?",
    law: 'third',
    triggerGroup: '3rd Law / action-reaction'
  },
  {
    prompt: "Which Newton's law is about inertia?",
    law: 'first',
    triggerGroup: '1st Law / inertia'
  },
  {
    prompt: "Which Newton's law is shown when a seatbelt stops you in a car?",
    law: 'first',
    triggerGroup: '1st Law / inertia'
  },
  {
    prompt: "Which Newton's law is shown when pushing a shopping cart harder makes it accelerate more?",
    law: 'second',
    triggerGroup: '2nd Law / F = ma'
  }
];

const DIRECT_ANSWER_CASES_TO_PRESERVE = [
  "What is Newton's first law?",
  "Define Newton's second law.",
  "Explain Newton's third law.",
  "What are Newton's laws?",
  'What is inertia?'
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
  testFutureNewtonLawConceptTutorCandidates();
  testPureDefinitionAndExplanationPromptsDoNotStartConceptTutor();
  testFormulaTutorPromptsKeepPriority();

  console.log('PASS Newtons laws detector audit: future concept candidates documented without live routing and definition/formula boundaries preserved');
}

function testFutureNewtonLawConceptTutorCandidates() {
  for (const testCase of FUTURE_CONCEPT_TUTOR_CANDIDATES) {
    const audit = detectNewtonsLawsConceptTutorAudit(testCase.prompt);
    assert.equal(audit.shouldStartConceptTutor, true, `${testCase.prompt} should be a future Concept Tutor candidate`);
    assert.equal(audit.law, testCase.law);
    assert.equal(audit.triggerGroup, testCase.triggerGroup);
    assert.equal(audit.blockedReason, '');

    const route = routeStudentQuestion(testCase.prompt, []);
    assert.notEqual(route.type, 'concept_tutor', `${testCase.prompt} should not be live-wired to Concept Tutor in this audit chunk`);
  }
}

function testPureDefinitionAndExplanationPromptsDoNotStartConceptTutor() {
  for (const prompt of DIRECT_ANSWER_CASES_TO_PRESERVE) {
    const audit = detectNewtonsLawsConceptTutorAudit(prompt);
    assert.equal(audit.shouldStartConceptTutor, false, `${prompt} should stay out of the scenario Concept Tutor detector`);
    assert.equal(audit.blockedReason, 'pure_definition_or_explanation');
  }
}

function testFormulaTutorPromptsKeepPriority() {
  for (const testCase of FORMULA_TUTOR_CASES_TO_PRESERVE) {
    const audit = detectNewtonsLawsConceptTutorAudit(testCase.prompt);
    assert.equal(audit.shouldStartConceptTutor, false, `${testCase.prompt} should not be a Concept Tutor candidate`);
    assert.equal(audit.blockedReason, 'formula_or_calculation_prompt');

    const route = routeStudentQuestion(testCase.prompt, []);
    assert.equal(route.type, 'science_formula', `${testCase.prompt} should route as formula work before any future Concept Tutor`);
    assert.equal(route.formulaWork?.formulaId, testCase.formulaId);
  }
}

main();
