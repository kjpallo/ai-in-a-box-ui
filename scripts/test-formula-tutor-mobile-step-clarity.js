const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');
const { buildFormulaTutorMetadata } = require('../lib/tutor/formulaTutor');

const projectRoot = path.join(__dirname, '..');
const studentHtml = fs.readFileSync(path.join(projectRoot, 'public', 'student.html'), 'utf8');
const studentUi = fs.readFileSync(path.join(projectRoot, 'public', 'student', 'student-ui.js'), 'utf8');
const renderHarness = loadStudentUiRenderHooks();
const renderHooks = renderHarness.hooks;
const disclosureFocus = renderHarness.disclosureFocus;

function loadStudentUiRenderHooks() {
  const disclosureFocus = {
    count: 0,
    lastSelector: ''
  };
  const timeline = {
    innerHTML: '',
    querySelector(selector) {
      return {
        focus() {
          disclosureFocus.count += 1;
          disclosureFocus.lastSelector = selector;
        }
      };
    }
  };
  const sandbox = {
    console,
    URLSearchParams,
    window: {
      __CHARLEMAGNE_ENABLE_STUDENT_UI_TEST_HOOKS__: true,
      location: { search: '' },
      CSS: {
        escape(value) {
          return String(value || '').replace(/["\\]/g, '\\$&');
        }
      },
      setInterval() {},
      clearInterval() {}
    },
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById(id) {
        return id === 'studentTimeline' ? timeline : null;
      }
    }
  };
  vm.runInNewContext(studentUi, sandbox, { filename: 'student-ui.js' });
  return {
    hooks: sandbox.window.CharlemagneStudentUiTestHooks || {},
    disclosureFocus
  };
}

async function createHarnessSession() {
  const harness = createStudentRouteHarness({ studentGuidedFormulaTutoringEnabled: true });
  const create = await harness.request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201, 'Focused clarity test should create a student session.');
  return { ...harness, sessionId: create.body.sessionId };
}

async function sendHarnessMessage(harness, studentHubId, message) {
  const response = await harness.request('POST', '/api/student/message', {
    sessionId: harness.sessionId,
    studentHubId,
    message
  });
  assert.equal(response.statusCode, 200, `${studentHubId}: ${message}`);
  return response;
}

async function run() {
  assert.equal(typeof renderHooks.renderTutorSessionStep, 'function', 'Focused UI tests require the test-only tutor step renderer.');
  assert.equal(typeof renderHooks.toggleTutorStepReview, 'function', 'Focused UI tests require the saved-step disclosure hook.');

  const harness = await createHarnessSession();
  const studentHubId = 'formula-tutor-mobile-step-clarity';
  const question = 'An ostrich can run at a speed of 43 mi/hr. How much ground can an ostrich cover if it runs at this speed for 15 minutes?';
  const start = await sendHarnessMessage(harness, studentHubId, question);
  const solveTarget = await sendHarnessMessage(harness, studentHubId, 'distance');
  const formula = await sendHarnessMessage(harness, studentHubId, '1');
  const time = await sendHarnessMessage(harness, studentHubId, '15');
  const active = await sendHarnessMessage(harness, studentHubId, '0.25');

  assert.equal(active.body.tutor?.currentStep?.id, 'identify_speed', 'The fixture should reach the speed value-entry step.');
  assert.equal(
    active.body.tutor?.currentStep?.displayEquation,
    'distance = {{blank}} × 0.25',
    'Active tutor metadata should expose the authored presentation-only equation template.'
  );
  assert.equal(
    active.body.tutor?.work?.currentStep?.displayEquation,
    'distance = {{blank}} × 0.25',
    'Tutor work metadata should preserve the same optional equation template.'
  );
  assertDisplayEquationMetadataValidation();

  const activeHtml = renderHooks.renderTutorSessionStep({
    id: 'clarity-current',
    tutor: active.body.tutor,
    response: active.body.response,
    message: '0.25',
    tutorSubmittedMessage: '0.25'
  }, {
    isLatestActiveStep: true,
    stepIndex: 4,
    previousTurn: {
      id: 'clarity-conversion',
      tutor: time.body.tutor,
      response: time.body.response,
      message: '15',
      tutorSubmittedMessage: '15'
    }
  });

  assert.match(activeHtml, /student-tutor-session-step is-current/, 'The active Formula Tutor step should render expanded and visually identified.');
  assert.match(activeHtml, /aria-current="step"/, 'The active Formula Tutor step should expose semantic current-step state.');
  assert.match(activeHtml, /Step 5 of 6/, 'The active Formula Tutor step should show its step number.');
  assert.match(activeHtml, />Current step</, 'The active Formula Tutor step should have an explicit visible label.');
  assert.match(activeHtml, /What number should go in for speed\?/, 'The active Formula Tutor instruction should remain visible.');
  assert.match(
    activeHtml,
    /distance = <span class="student-tutor-equation-blank" aria-hidden="true">____<\/span> × 0\.25/,
    'The equation should place a visible blank at the exact requested value.'
  );
  assert.match(activeHtml, /Enter only the missing number\./, 'The numeric step should state its response expectation.');

  const priorTurn = {
    id: 'clarity-prior',
    tutor: formula.body.tutor,
    response: formula.body.response,
    message: '1',
    tutorSubmittedMessage: '1'
  };
  const priorOptions = {
    isLatestActiveStep: false,
    stepIndex: 2,
    previousTurn: {
      id: 'clarity-formula-choice',
      tutor: solveTarget.body.tutor,
      response: solveTarget.body.response,
      message: 'distance',
      tutorSubmittedMessage: 'distance'
    }
  };
  const collapsedPriorHtml = renderHooks.renderTutorSessionStep(priorTurn, priorOptions);

  assert.match(collapsedPriorHtml, /student-tutor-session-step-compact/, 'Previous Formula Tutor steps should render compactly.');
  assert.match(collapsedPriorHtml, /aria-expanded="false"/, 'Previous Formula Tutor steps should default collapsed.');
  assert.match(collapsedPriorHtml, /Step 2 of 6/, 'Collapsed previous steps should show their step number.');
  assert.match(collapsedPriorHtml, />Correct</, 'Collapsed previous steps should show their result status.');
  assert.match(collapsedPriorHtml, /aria-controls="student-tutor-step-review-clarity-prior"/, 'Collapsed previous steps should identify their controlled review panel.');
  assert.match(
    collapsedPriorHtml,
    /<div id="student-tutor-step-review-clarity-prior" class="student-tutor-history-expanded" aria-label="Saved step review details" hidden>/,
    'The controlled review panel should stay mounted and hidden while collapsed.'
  );
  assert.match(
    studentHtml,
    /\.student-tutor-history-expanded\[hidden\]\s*\{[\s\S]*?display:\s*none;/,
    'Collapsed mounted review panels should be hidden despite the expanded-panel display rule.'
  );
  assert.equal(
    countOccurrences(collapsedPriorHtml, 'id="student-tutor-step-review-clarity-prior"'),
    1,
    'A collapsed previous step should mount exactly one controlled review panel.'
  );

  renderHooks.toggleTutorStepReview('clarity-prior');
  assert.equal(disclosureFocus.count, 1, 'Expanding a previous step should restore focus to its replacement disclosure.');
  assert.equal(
    disclosureFocus.lastSelector,
    '[data-toggle-tutor-step-id="clarity-prior"]',
    'Expansion focus restoration should use the stable saved-step identifier.'
  );
  const expandedPriorHtml = renderHooks.renderTutorSessionStep(priorTurn, priorOptions);
  assert.match(expandedPriorHtml, /aria-expanded="true"/, 'Students should be able to expand a previous step for review.');
  assert.match(expandedPriorHtml, /aria-controls="student-tutor-step-review-clarity-prior"/, 'Expanded state should preserve the matching controlled-panel id.');
  assert.doesNotMatch(
    getReviewPanelTag(expandedPriorHtml, 'student-tutor-step-review-clarity-prior'),
    /\shidden(?:\s|>)/,
    'The controlled review panel should be visible while expanded.'
  );
  assert.match(expandedPriorHtml, /Saved step review details/, 'Expanded previous steps should expose their review panel.');
  assert.match(expandedPriorHtml, /Which formula should we use\?/, 'Expanded previous steps should restore the saved prompt.');
  assert.match(expandedPriorHtml, /Student answer[\s\S]*>1</, 'Expanded previous steps should restore the submitted answer.');

  renderHooks.toggleTutorStepReview('clarity-prior');
  assert.equal(disclosureFocus.count, 2, 'Collapsing a previous step should restore focus to its replacement disclosure.');
  assert.equal(
    disclosureFocus.lastSelector,
    '[data-toggle-tutor-step-id="clarity-prior"]',
    'Collapse focus restoration should keep the same saved-step identifier.'
  );
  const collapsedAgainHtml = renderHooks.renderTutorSessionStep(priorTurn, priorOptions);
  assert.match(collapsedAgainHtml, /aria-expanded="false"/, 'Collapsing again should synchronize aria-expanded.');
  assert.match(
    collapsedAgainHtml,
    /<div id="student-tutor-step-review-clarity-prior" class="student-tutor-history-expanded" aria-label="Saved step review details" hidden>/,
    'Collapsing again should keep the controlled panel mounted and hidden.'
  );

  assertDisplayEquationRenderingValidation(active.body.tutor);

  const conceptHtml = renderHooks.renderTutorSessionStep({
    id: 'concept-current',
    tutor: {
      active: true,
      tutorCategory: 'concept',
      currentStep: { prompt: 'Which idea best explains the observation?' },
      work: {
        currentStep: { prompt: 'Which idea best explains the observation?' },
        stepNumber: 1,
        totalSteps: 2
      }
    },
    response: 'Choose the best explanation.'
  }, {
    isLatestActiveStep: true,
    stepIndex: 0
  });
  assert.doesNotMatch(conceptHtml, /Enter only the missing number|student-tutor-equation/, 'Non-Formula Tutor interfaces should remain unaffected.');

  const calculation = await sendHarnessMessage(harness, studentHubId, '43 mi/hr');
  assert.equal(calculation.body.tutor?.currentStep?.id, 'calculate', 'The existing accepted speed answer should still advance normally.');
  const completed = await sendHarnessMessage(harness, studentHubId, '10.75');
  assert.equal(completed.body.tutor?.completed, true, 'The existing calculation answer should still complete the tutor.');
  assert.match(completed.body.response, /distance = 10\.75 miles/i, 'The existing final answer should remain unchanged.');
  assert.equal(start.body.tutor?.formulaId, 'speed_distance_time', 'The fixture should remain in the existing Formula Tutor route.');

  console.log('formula tutor mobile step clarity: active hierarchy, equation blank, saved-step disclosure, and unchanged evaluation passed');
}

function assertDisplayEquationMetadataValidation() {
  const valid = buildMetadataForDisplayEquation('distance = {{blank}} × 0.25');
  assert.equal(valid.currentStep?.displayEquation, 'distance = {{blank}} × 0.25', 'Exactly one blank marker should pass the trusted metadata boundary.');
  assert.equal(valid.work?.currentStep?.displayEquation, 'distance = {{blank}} × 0.25', 'Tutor work should preserve one valid blank marker.');

  for (const invalid of ['distance = 43 × 0.25', '{{blank}} + {{blank}}']) {
    const metadata = buildMetadataForDisplayEquation(invalid);
    assert.equal(Object.hasOwn(metadata.currentStep || {}, 'displayEquation'), false, `Trusted metadata should omit malformed template: ${invalid}`);
    assert.equal(Object.hasOwn(metadata.work?.currentStep || {}, 'displayEquation'), false, `Tutor work should omit malformed template: ${invalid}`);
  }
}

function buildMetadataForDisplayEquation(displayEquation) {
  return buildFormulaTutorMetadata({
    tutorProblemId: 'display-equation-validation',
    formulaId: 'speed_distance_time',
    family: 'motion',
    solveFor: 'distance',
    formula: 'distance = speed × time',
    originalQuestion: 'Validation fixture',
    variables: {},
    finalAnswer: { value: 1, display: '1 mile' },
    steps: [{
      id: 'display_equation',
      type: 'quantity',
      prompt: 'Enter the missing number.',
      displayEquation,
      expectedValue: 1
    }],
    currentStepIndex: 0,
    attempts: {},
    completedSteps: []
  });
}

function assertDisplayEquationRenderingValidation(tutor) {
  const validHtml = renderDisplayEquationTemplate(tutor, 'distance = {{blank}} × 0.25');
  assert.match(validHtml, /student-tutor-equation-blank/, 'Exactly one blank marker should render.');

  for (const invalid of ['distance = 43 × 0.25', '{{blank}} + {{blank}}']) {
    const invalidHtml = renderDisplayEquationTemplate(tutor, invalid);
    assert.doesNotMatch(invalidHtml, /student-tutor-equation(?:-blank)?|Enter only the missing number\./, `Malformed template should fall back safely: ${invalid}`);
  }

  const unsafeHtml = renderDisplayEquationTemplate(tutor, '<img src=x onerror="alert(1)"> = {{blank}}');
  assert.match(unsafeHtml, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/, 'Unsafe template content should remain escaped.');
  assert.doesNotMatch(unsafeHtml, /<img src=x/, 'Unsafe template content should not become HTML.');
}

function renderDisplayEquationTemplate(tutor, displayEquation) {
  const currentStep = {
    prompt: 'Enter the missing number.',
    displayEquation
  };
  return renderHooks.renderTutorSessionStep({
    id: 'display-equation-render',
    tutor: {
      ...tutor,
      active: true,
      completed: false,
      currentStep,
      work: {
        ...tutor.work,
        currentStep,
        stepNumber: 1,
        totalSteps: 1
      }
    },
    response: ''
  }, {
    isLatestActiveStep: true,
    stepIndex: 0
  });
}

function getReviewPanelTag(html, panelId) {
  const match = html.match(new RegExp(`<div id="${panelId}"[^>]*>`));
  assert.ok(match, `Expected mounted review panel ${panelId}.`);
  return match[0];
}

function countOccurrences(text, value) {
  return String(text).split(value).length - 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
