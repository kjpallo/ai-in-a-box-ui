const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const studentHtml = fs.readFileSync(path.join(projectRoot, 'public', 'student.html'), 'utf8');
const studentUi = fs.readFileSync(path.join(projectRoot, 'public', 'student', 'student-ui.js'), 'utf8');

const getCssBlock = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = studentHtml.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  return match ? match[1] : '';
};

const tutorCardIndex = studentHtml.indexOf('id="studentTutorCard"');
const tutorBodyIndex = studentHtml.indexOf('<div class="student-tutor-body">', tutorCardIndex);
const tutorActionsIndex = studentHtml.indexOf('<div class="student-tutor-actions">', tutorCardIndex);
const consoleIndex = studentHtml.indexOf('id="studentInteractionConsole"');
const workspaceIndex = studentHtml.indexOf('<div class="student-workspace">');
const inputIndex = studentHtml.indexOf('id="studentMessageInput"');
const sendIndex = studentHtml.indexOf('id="studentSendButton"');
const askHighlightIndex = studentHtml.indexOf('id="studentAskHighlightButton"');
const energyIndex = studentHtml.indexOf('id="studentQuestionEnergy"');
const responseIndex = studentHtml.indexOf('id="studentResponse"');
const historyIndex = studentHtml.indexOf('id="studentHistory"');
const copyIndex = studentHtml.indexOf('id="studentCopyAnswerButton"');
const clearIndex = studentHtml.indexOf('id="studentClearButton"');

assert.equal(
  (studentHtml.match(/id="studentInteractionConsole"/g) || []).length,
  1,
  'Student page should render exactly one combined Student Interaction Console.'
);

assert.match(
  studentHtml,
  /<section id="studentInteractionConsole" class="panel student-panel student-interaction-console"[\s\S]*<h1 id="studentInteractionConsoleTitle">Student Interaction Console<\/h1>/,
  'Student page should render the combined interaction console as the top student panel.'
);

[
  ['question input', inputIndex],
  ['Send button', sendIndex],
  ['Ask about highlighted text button', askHighlightIndex],
  ['question energy', energyIndex],
  ['latest response', responseIndex],
  ['chat history', historyIndex],
  ['Copy Answer control', copyIndex],
  ['Clear control', clearIndex]
].forEach(([label, index]) => {
  assert.ok(
    consoleIndex !== -1 && index > consoleIndex && index < workspaceIndex,
    `${label} should live inside the combined interaction console.`
  );
});

assert.match(
  studentHtml,
  /<section id="studentTutorCard" class="panel student-panel student-tutor-card"/,
  'Student page should render the Guided Formula Tutor card.'
);

assert.match(
  studentHtml,
  /<div id="studentCalculatorDisplay" class="student-calculator-display" role="status" aria-live="polite">0<\/div>/,
  'Student page should render the calculator display above the calculator keys.'
);

assert.ok(
  tutorCardIndex !== -1 && tutorBodyIndex !== -1 && tutorActionsIndex !== -1 && tutorBodyIndex < tutorActionsIndex,
  'Tutor actions should appear after the tutor body in DOM order so they stay in normal layout flow.'
);

assert.match(
  studentHtml,
  /\.student-workspace\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 164px;/,
  'Student workspace should keep the right-side action column beside the tutor/work area on desktop.'
);

assert.ok(
  consoleIndex !== -1 && workspaceIndex !== -1 && consoleIndex < workspaceIndex && workspaceIndex < tutorCardIndex,
  'Formula tutor/work area should appear below the combined interaction console in DOM order.'
);

assert.ok(
  responseIndex !== -1 && responseIndex < workspaceIndex && responseIndex < tutorCardIndex,
  'Latest Response should stay above the tutor work area so it cannot hide tutor options.'
);

assert.match(
  studentHtml,
  /<aside class="student-action-column" aria-label="Student actions">[\s\S]*id="studentPointButton"[\s\S]*Point\?/,
  'The right-side action rail should preserve the Point? control.'
);

assert.doesNotMatch(
  studentHtml,
  /<section class="panel student-panel student-response-panel">/,
  'Latest Response should no longer be a separate page panel outside the interaction console.'
);

assert.doesNotMatch(
  studentHtml,
  /<section class="panel student-panel student-history-panel"/,
  'Chat History should no longer be a separate page panel outside the interaction console.'
);

const tutorActionsBlock = getCssBlock('.student-tutor-actions');
const tutorBodyBlock = getCssBlock('.student-tutor-body');
const tutorGridBlock = getCssBlock('.student-tutor-grid');
const tutorCardBlock = getCssBlock('.student-tutor-card');
const currentStepBlock = getCssBlock('.student-tutor-detail.student-tutor-current-step');
const calculatorBlock = getCssBlock('.student-calculator');
const calculatorKeysBlock = getCssBlock('.student-calculator-keys');
const calculatorButtonBlock = getCssBlock('.student-calculator-button');

assert.ok(tutorActionsBlock, 'Tutor actions should have a CSS rule.');
assert.doesNotMatch(
  tutorActionsBlock,
  /position\s*:\s*(?:absolute|fixed)\b/,
  'Tutor actions should not use absolute or fixed positioning.'
);

['Hint', 'Restart', 'Stop'].forEach((label) => {
  assert.match(
    studentHtml,
    new RegExp(`<button type="button" class="panel-action-button" data-tutor-action="[a-z]+">${label}<\\/button>`),
    `Tutor actions should include ${label}.`
  );
});

[
  'Original question',
  'Solving for',
  'Formula',
  'Known values',
  'Current step',
  'Substitution',
  'Hint',
  'Answer'
].forEach((label) => {
  assert.match(
    studentHtml,
    new RegExp(`<strong>${label}<\\/strong>`),
    `Tutor work area should include ${label}.`
  );
});

assert.match(
  studentHtml,
  /body:has\(\.student-tutor-card:not\(\[hidden\]\)\)\s*\{[\s\S]*overflow-y: auto;[\s\S]*\}/,
  'Tutor-visible desktop layout should allow page scrolling instead of clamping the tutor inside the viewport.'
);

assert.match(
  studentHtml,
  /body:has\(\.student-tutor-card:not\(\[hidden\]\)\) \.student-shell\s*\{[\s\S]*height: auto;[\s\S]*min-height: 100dvh;[\s\S]*\}/,
  'Tutor-visible student shell should grow naturally while keeping the page at least viewport height.'
);

assert.match(
  studentHtml,
  /\.student-main-stack:has\(\.student-tutor-card:not\(\[hidden\]\)\)\s*\{[\s\S]*grid-template-rows: auto;[\s\S]*align-content: start;[\s\S]*\}/,
  'Tutor-visible main stack should use natural tutor height below the interaction console.'
);

assert.doesNotMatch(
  studentHtml,
  /\.student-main-stack:has\(\.student-tutor-card:not\(\[hidden\]\)\)\s*\{[\s\S]*grid-template-rows: auto minmax\(0, 1fr\) minmax\(96px, 0\.34fr\) minmax\(126px, 0\.46fr\);[\s\S]*\}/,
  'Old cramped tutor-visible viewport row split should not be the active layout.'
);

assert.match(
  studentHtml,
  /\.student-tutor-card\s*\{[\s\S]*grid-template-rows: auto auto auto;[\s\S]*overflow: visible;[\s\S]*\}/,
  'Tutor card should keep header, body, and actions in normal flow instead of clipping the body.'
);
assert.ok(tutorCardBlock, 'Tutor card should have a CSS rule.');
assert.doesNotMatch(
  tutorCardBlock,
  /overflow\s*:\s*(?:hidden|auto|scroll)\b/,
  'Tutor card should not clip or create a small nested scroll region.'
);

assert.match(
  studentHtml,
  /\.student-main-stack:has\(\.student-tutor-card:not\(\[hidden\]\)\) \.student-tutor-card\s*\{[\s\S]*min-height: clamp\(430px, 58dvh, 620px\);[\s\S]*\}/,
  'Tutor-visible card should receive moderate extra height without becoming full-screen.'
);

assert.match(
  studentHtml,
  /\.student-tutor-body\s*\{[\s\S]*min-height: 0;[\s\S]*overflow-y: visible;[\s\S]*\}/,
  'Tutor body should not rely on a tiny nested scroller as the primary way to use the tutor.'
);
assert.ok(tutorBodyBlock, 'Tutor body should have a CSS rule.');
assert.match(
  tutorBodyBlock,
  /grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(320px,\s*360px\);/,
  'Desktop tutor body should use a wide work lane beside a readable calculator lane.'
);
assert.doesNotMatch(
  tutorBodyBlock,
  /(?:max-height|overflow-y\s*:\s*(?:auto|scroll)|overflow\s*:\s*(?:hidden|auto|scroll))/,
  'Tutor body should avoid clipped or tiny nested scroll bands.'
);

assert.ok(tutorGridBlock, 'Tutor grid should have a CSS rule.');
assert.match(
  tutorGridBlock,
  /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  'Tutor state cards should share the available left-side width on desktop.'
);
assert.doesNotMatch(
  tutorGridBlock,
  /(?:max-height|overflow-y\s*:\s*(?:auto|scroll)|overflow\s*:\s*(?:hidden|auto|scroll))/,
  'Tutor state cards should not be placed inside a tiny nested scroller.'
);

assert.ok(currentStepBlock, 'Current step should have a CSS rule.');
assert.match(
  currentStepBlock,
  /grid-column:\s*1\s*\/\s*-1;/,
  'Current step should span the tutor work lane so it remains prominent.'
);
assert.match(
  currentStepBlock,
  /padding:\s*0\.82rem 0\.88rem;/,
  'Current step should have enough padding to read as the active learning prompt.'
);

assert.ok(calculatorBlock, 'Calculator should have a CSS rule.');
assert.match(
  calculatorBlock,
  /min-width:\s*0;/,
  'Calculator should be allowed to shrink within its lane instead of clipping.'
);
assert.doesNotMatch(
  calculatorBlock,
  /(?:max-height|overflow\s*:\s*hidden|overflow-y\s*:\s*(?:auto|scroll|hidden))/,
  'Calculator should not be clipped by its own container.'
);
assert.ok(calculatorKeysBlock, 'Calculator keys should have a CSS rule.');
assert.match(
  calculatorKeysBlock,
  /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
  'Calculator keys should fit inside the calculator without forcing horizontal clipping.'
);
assert.ok(calculatorButtonBlock, 'Calculator buttons should have a CSS rule.');
assert.match(
  calculatorButtonBlock,
  /min-width:\s*0;/,
  'Calculator buttons should not force the calculator wider than its lane.'
);

assert.match(
  studentUi,
  /setTutorFinal\('', \{ showPending: true \}\);/,
  'Active tutoring should keep the answer area visible as a subdued pending state.'
);

assert.match(
  studentHtml,
  /@media \(max-width: 980px\)[\s\S]*\.student-tutor-body\s*\{[\s\S]*grid-template-columns: 1fr;[\s\S]*\}/,
  'Narrow screens should stack the tutor cards and calculator before they become cramped.'
);

assert.match(
  studentHtml,
  /@media \(max-width: 900px\)[\s\S]*\.student-console-grid\s*\{[\s\S]*grid-template-columns: 1fr;[\s\S]*\}/,
  'Tablet screens should stack the interaction console before the question input becomes cramped.'
);

assert.match(
  studentHtml,
  /@media \(max-width: 900px\)[\s\S]*\.student-history\s*\{[\s\S]*max-height: 240px;[\s\S]*min-height: 170px;[\s\S]*\}/,
  'Tablet screens should keep history visible but secondary after the console stacks.'
);

assert.match(
  studentHtml,
  /\.student-response\s*\{[\s\S]*min-height: 154px;[\s\S]*max-height: none;[\s\S]*overflow: visible;[\s\S]*\}/,
  'Latest Response should have readable height and should not be clipped.'
);

assert.match(
  studentHtml,
  /\.student-response-wrap\s*\{[\s\S]*overflow: visible;[\s\S]*\}/,
  'Latest Response wrapper should not clip long answers.'
);

assert.match(
  studentHtml,
  /\.student-history\s*\{[\s\S]*max-height: clamp\(210px, 34dvh, 340px\);[\s\S]*min-height: 210px;[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain;[\s\S]*scrollbar-gutter: stable;[\s\S]*\}/,
  'Chat History should remain compact and internally scrollable inside the interaction console.'
);

assert.match(
  studentUi,
  /historyBox\.scrollTop = historyBox\.scrollHeight;/,
  'Chat History should keep the newest exchange visible by default.'
);

const mobileMediaIndex = studentHtml.indexOf('@media (max-width: 760px)');
const reducedMotionMediaIndex = studentHtml.indexOf('@media (prefers-reduced-motion: reduce)', mobileMediaIndex);
const mobileCss = mobileMediaIndex === -1
  ? ''
  : studentHtml.slice(mobileMediaIndex, reducedMotionMediaIndex === -1 ? undefined : reducedMotionMediaIndex);
assert.match(
  mobileCss,
  /\.student-console-grid\s*\{[\s\S]*grid-template-columns: 1fr;[\s\S]*\}/,
  'Mobile layout should collapse the interaction console to one column.'
);
assert.match(
  mobileCss,
  /\.student-main-stack:has\(\.student-tutor-card:not\(\[hidden\]\)\)\s*\{[\s\S]*grid-template-rows: none;[\s\S]*\}/,
  'Mobile layout should keep the tutor/work area in natural page flow.'
);
assert.match(
  mobileCss,
  /\.student-tutor-body\s*\{[\s\S]*grid-template-columns: 1fr;[\s\S]*overflow-y: visible;[\s\S]*scrollbar-gutter: auto;[\s\S]*\}/,
  'Mobile layout should avoid a cramped tutor body scroller.'
);

console.log('student tutor UI: interaction console combines input, latest response, and usable history above the tutor work area');
