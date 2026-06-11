const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const studentHtml = fs.readFileSync(path.join(projectRoot, 'public', 'student.html'), 'utf8');

const getCssBlock = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = studentHtml.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  return match ? match[1] : '';
};

const tutorCardIndex = studentHtml.indexOf('id="studentTutorCard"');
const tutorBodyIndex = studentHtml.indexOf('<div class="student-tutor-body">', tutorCardIndex);
const tutorActionsIndex = studentHtml.indexOf('<div class="student-tutor-actions">', tutorCardIndex);

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
  'Student workspace should keep the right-side action column beside the main tutor area on desktop.'
);

const tutorActionsBlock = getCssBlock('.student-tutor-actions');

assert.ok(tutorActionsBlock, 'Tutor actions should have a CSS rule.');
assert.doesNotMatch(
  tutorActionsBlock,
  /position\s*:\s*(?:absolute|fixed)\b/,
  'Tutor actions should not use absolute or fixed positioning.'
);

assert.match(
  studentHtml,
  /<section class="panel student-panel student-response-panel">[\s\S]*<h2>Response<\/h2>[\s\S]*<div id="studentResponse"/,
  'Response container should still exist below the tutor.'
);

assert.match(
  studentHtml,
  /<section class="panel student-panel student-history-panel"[\s\S]*<h2 id="studentHistoryTitle">Chat History<\/h2>[\s\S]*<div id="studentHistory"/,
  'Chat History container should still exist below the tutor.'
);

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
  /\.student-main-stack:has\(\.student-tutor-card:not\(\[hidden\]\)\)\s*\{[\s\S]*grid-template-rows: auto auto minmax\(104px, auto\) minmax\(150px, auto\);[\s\S]*align-content: start;[\s\S]*\}/,
  'Tutor-visible main stack should use natural tutor height while keeping Response and Chat History rows below it.'
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

assert.match(
  studentHtml,
  /@media \(max-width: 760px\)[\s\S]*\.student-main-stack:has\(\.student-tutor-card:not\(\[hidden\]\)\)\s*\{[\s\S]*grid-template-rows: none;[\s\S]*\}[\s\S]*\.student-tutor-body\s*\{[\s\S]*grid-template-columns: 1fr;[\s\S]*overflow-y: visible;[\s\S]*scrollbar-gutter: auto;[\s\S]*\}/,
  'Mobile layout should keep its single-column natural page flow instead of forcing the desktop tutor scroller.'
);

console.log('student tutor UI: formula tutor card uses page flow with visible calculator output and in-flow actions');
