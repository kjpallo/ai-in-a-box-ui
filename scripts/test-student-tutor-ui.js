const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const studentHtml = fs.readFileSync(path.join(projectRoot, 'public', 'student.html'), 'utf8');

assert.match(
  studentHtml,
  /<section id="studentTutorCard" class="panel student-panel student-tutor-card"[\s\S]*<div class="student-tutor-body">[\s\S]*id="studentTutorCalculator"[\s\S]*<div class="student-tutor-actions">/,
  'Student page should render the Guided Formula Tutor card with body, calculator, and actions in one card.'
);

assert.match(
  studentHtml,
  /\.student-workspace\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 164px;/,
  'Student workspace should keep the right-side action column beside the main tutor area on desktop.'
);

assert.match(
  studentHtml,
  /\.student-main-stack:has\(\.student-tutor-card:not\(\[hidden\]\)\)\s*\{[\s\S]*grid-template-rows: auto minmax\(0, 1fr\) minmax\(96px, 0\.34fr\) minmax\(126px, 0\.46fr\);[\s\S]*\}/,
  'When the tutor is visible, the student main stack should bound the tutor row inside the viewport grid.'
);

assert.match(
  studentHtml,
  /\.student-tutor-card\s*\{[\s\S]*grid-template-rows: auto minmax\(0, 1fr\) auto;[\s\S]*overflow: hidden;[\s\S]*\}/,
  'Tutor card should keep its header/actions visible while its body takes the scrollable middle row.'
);

assert.match(
  studentHtml,
  /\.student-tutor-body\s*\{[\s\S]*min-height: 0;[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain;[\s\S]*scrollbar-gutter: stable;[\s\S]*\}/,
  'Tutor body should scroll internally instead of letting calculator content clip below the card.'
);

assert.match(
  studentHtml,
  /@media \(max-width: 760px\)[\s\S]*\.student-main-stack:has\(\.student-tutor-card:not\(\[hidden\]\)\)\s*\{[\s\S]*grid-template-rows: none;[\s\S]*\}[\s\S]*\.student-tutor-body\s*\{[\s\S]*grid-template-columns: 1fr;[\s\S]*overflow-y: visible;[\s\S]*scrollbar-gutter: auto;[\s\S]*\}/,
  'Mobile layout should keep its single-column natural page flow instead of forcing the desktop tutor scroller.'
);

console.log('student tutor UI: formula tutor card uses a bounded desktop row with internal body scrolling');
