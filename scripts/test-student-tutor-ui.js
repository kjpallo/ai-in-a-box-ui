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

const getCssBlocks = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...studentHtml.matchAll(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'g'))]
    .map((match) => match[1]);
};

const statusIndex = studentHtml.indexOf('class="student-status-bar"');
const timelineIndex = studentHtml.indexOf('id="studentTimeline"');
const formIndex = studentHtml.indexOf('id="studentMessageForm"');
const inputIndex = studentHtml.indexOf('id="studentMessageInput"');
const sendIndex = studentHtml.indexOf('id="studentSendButton"');
const askHighlightIndex = studentHtml.indexOf('id="studentAskHighlightButton"');
const energyIndex = studentHtml.indexOf('id="studentQuestionEnergy"');
const pointIndex = studentHtml.indexOf('id="studentPointButton"');
const clearIndex = studentHtml.indexOf('id="studentClearButton"');

assert.ok(statusIndex !== -1, 'Student page should keep a compact top status area.');
assert.ok(timelineIndex !== -1, 'Student page should render a single conversation timeline.');
assert.ok(formIndex !== -1, 'Student page should keep the question composer at the bottom.');
assert.ok(statusIndex < timelineIndex && timelineIndex < formIndex, 'Layout should be status, timeline, then input composer.');

[
  ['question input', inputIndex],
  ['Send button', sendIndex],
  ['Ask highlighted text button', askHighlightIndex],
  ['Question energy', energyIndex],
  ['Point button', pointIndex],
  ['Clear button', clearIndex]
].forEach(([label, index]) => {
  assert.ok(index !== -1, `${label} should remain available on the student page.`);
});

assert.ok(energyIndex > statusIndex && energyIndex < timelineIndex, 'Question energy should live in the top/status area.');
assert.ok(inputIndex > formIndex && sendIndex > formIndex && askHighlightIndex > formIndex, 'Input controls should live in the bottom composer.');

assert.doesNotMatch(studentHtml, /Latest Response/, 'Latest Response should not remain as a separate section.');
assert.doesNotMatch(studentHtml, /Chat History/, 'Chat History should not remain as a separate side panel.');
assert.doesNotMatch(studentHtml, /id="studentResponse"/, 'Separate latest response DOM should be removed.');
assert.doesNotMatch(studentHtml, /id="studentHistory"/, 'Separate chat history DOM should be removed.');
assert.doesNotMatch(studentHtml, /id="studentTutorCard"/, 'Tutor card should no longer be a standalone page panel.');
assert.doesNotMatch(studentHtml, /student-workspace|student-main-stack|student-action-column/, 'Old side-by-side workspace shell should be removed.');

const shellBlock = getCssBlock('.student-shell');
const timelineBlock = getCssBlock('.student-timeline');
const composerBlock = getCssBlocks('.student-composer').find((block) => /grid-template-columns:/u.test(block)) || '';
const sessionBlock = getCssBlock('.student-tutor-session');
const sessionHeaderBlock = getCssBlock('.student-tutor-session-header');
const sessionPanelBlock = getCssBlock('.student-tutor-session-panel');
const collapsedPanelBlock = getCssBlock('.student-tutor-session.is-collapsed .student-tutor-session-panel');
const sessionScrollBlock = getCssBlock('.student-tutor-session-scroll');
const sessionStepBlock = getCssBlock('.student-tutor-session-step');
const sessionSideAnswerStepBlock = getCssBlock('.student-tutor-session-step.has-side-answer');
const tutorBodyBlock = getCssBlock('.student-tutor-body');
const calculatorBlock = getCssBlock('.student-calculator');
const calculatorKeysBlock = getCssBlock('.student-calculator-keys');

assert.match(shellBlock, /grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;/, 'Student shell should reserve one central scroll lane plus bottom composer.');
assert.match(timelineBlock, /overflow-y:\s*auto;/, 'Conversation timeline should remain the main page scroll area.');
assert.match(timelineBlock, /overscroll-behavior:\s*contain;/, 'Timeline should contain scroll gestures.');
assert.match(composerBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/, 'Desktop composer should keep input beside actions.');

const overflowMatches = [...studentHtml.matchAll(/overflow-y:\s*auto;/g)];
assert.equal(overflowMatches.length, 2, 'Student page should expose the timeline scroll plus one scoped formula-session scroll.');

assert.ok(sessionBlock, 'Formula tutor sessions should have a CSS rule.');
assert.match(sessionHeaderBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/, 'Session header should keep summary beside controls on desktop.');
assert.match(sessionPanelBlock, /transition:\s*max-height 220ms ease, opacity 180ms ease, visibility 180ms ease;/, 'Session panel should animate expand/collapse.');
assert.match(collapsedPanelBlock, /max-height:\s*0;/, 'Collapsed formula sessions should hide the panel.');
assert.match(collapsedPanelBlock, /visibility:\s*hidden;/, 'Collapsed formula sessions should remove hidden controls from focus.');
assert.match(sessionPanelBlock, /max-height:\s*min\(980px,\s*calc\(100dvh - 11rem\)\);/, 'Expanded formula sessions should grow with content before hitting a panel limit.');
assert.match(sessionScrollBlock, /max-height:\s*min\(760px,\s*calc\(100dvh - 15rem\)\);/, 'Expanded formula sessions should use a larger bounded inner step area.');
assert.match(sessionScrollBlock, /overflow-y:\s*auto;/, 'Expanded formula sessions should use a scoped inner scroller.');
assert.match(sessionScrollBlock, /overscroll-behavior:\s*contain;/, 'Formula session scroller should contain scroll gestures.');
assert.match(sessionScrollBlock, /scrollbar-gutter:\s*stable;/, 'Formula session scroller should reserve stable scrollbar space.');
assert.match(sessionStepBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\);/, 'Tutor steps without a student-answer side panel should use the full work width.');
assert.match(sessionSideAnswerStepBlock, /grid-template-columns:\s*minmax\(7\.4rem,\s*0\.2fr\) minmax\(0,\s*1fr\);/, 'Tutor steps with actual student answers should keep a compact side answer column.');

assert.match(
  studentUi,
  /function renderTimeline\(\)[\s\S]*buildTimelineItems\(\)\.map[\s\S]*renderTutorSession\(item, copyableTurnId\)/,
  'Timeline rendering should pass through grouped tutor session items.'
);
assert.match(
  studentUi,
  /function buildTimelineItems\(\)[\s\S]*const sessionsByKey = new Map\(\);[\s\S]*getTutorSessionKey\(turn\)[\s\S]*items\.push\(session\)/,
  'Timeline rendering should group formula tutor turns before mapping to HTML.'
);
assert.match(
  studentUi,
  /function getTutorSessionKey\(turn\)[\s\S]*work\.originalQuestion[\s\S]*tutor\.originalQuestion[\s\S]*tutor\.formulaId[\s\S]*solveFor[\s\S]*join\('\|'\)/,
  'Formula session keys should use original question, formula id, and solve-for target.'
);
assert.match(
  studentUi,
  /function getTutorSessionKey\(turn\)[\s\S]*if \(!isStructuredFormulaTutor\(tutor, work\)\) return '';/,
  'Normal chat and non-formula tutor turns should not be grouped as formula sessions.'
);
assert.match(
  studentUi,
  /function normalizeTutorSessionPart\(value\)[\s\S]*toLowerCase\(\)[\s\S]*replace\(\/\\s\+\/g, ' '\);/,
  'Formula session keys should normalize whitespace and casing.'
);

assert.match(
  studentUi,
  /function renderTutorSession\(session, copyableTurnId\)[\s\S]*class="student-chat-turn student-tutor-session[\s\S]*student-tutor-session-header[\s\S]*student-tutor-session-summary[\s\S]*student-tutor-session-meta[\s\S]*data-toggle-tutor-session-id[\s\S]*aria-expanded/,
  'Formula sessions should render a compact header with summary, meta, progress, and an accessible toggle.'
);
assert.match(
  studentUi,
  /function renderTutorSession\(session, copyableTurnId\)[\s\S]*student-tutor-session-scroll[\s\S]*student-tutor-session-steps/,
  'Expanded formula sessions should render chronological steps inside the bounded scroll area.'
);
assert.doesNotMatch(
  studentUi,
  /student-tutor-session-question/,
  'Expanded formula sessions should not render a duplicate pinned Original Question block.'
);
assert.match(
  studentUi,
  /function renderTutorSessionStep\(turn, options = \{\}\)[\s\S]*renderTutorDetail\('Original Question'[\s\S]*Current Step[\s\S]*Solving For[\s\S]*Formula[\s\S]*renderKnownValuesDetail[\s\S]*Calculator check[\s\S]*Final answer/,
  'Each grouped tutor step should include original question context above the current step and formula work fields.'
);
assert.match(
  studentUi,
  /function renderTutorSessionAnswer\(turn, stepIndex\)[\s\S]*if \(stepIndex === 0\) return '';/,
  'The first step should not show a side Original Question panel.'
);
assert.doesNotMatch(
  studentUi,
  /Original question/,
  'Side answer panels should not label any row as Original question.'
);
assert.match(
  studentUi,
  /const canUseCalculator = isCurrentStep[\s\S]*renderCalculatorArea\(turn\.id, showCalculator\)[\s\S]*renderTutorActions\(turn, tutor, \{ hideCompletedAction: true \}\)/,
  'Only the latest active tutor step should own calculator and tutor controls.'
);
assert.match(
  studentUi,
  /function renderTutorActions\(turn, tutor, options = \{\}\)[\s\S]*options\.hideCompletedAction[\s\S]*data-tutor-action="hint"[\s\S]*data-tutor-action="restart"[\s\S]*data-tutor-action="stop"/,
  'Hint, Restart, and Stop controls should remain available for the active step.'
);
assert.match(
  studentUi,
  /function shouldShowCalculator\(turnId, tutor, work, currentStepText\)[\s\S]*calculatorOpenTurnIds\.has\(turnId\)/,
  'Calculator open state should remain tied to turn ids.'
);
assert.match(
  studentUi,
  /data-calculator-key="7"[\s\S]*data-calculator-key="sqrt"[\s\S]*data-calculator-key="equals"/,
  'The tutor calculator should remain available inside active tutor work.'
);

assert.match(
  studentUi,
  /function getTutorSessionExpandedState\(session\)[\s\S]*tutorSessionExpandedState\.has\(session\.key\)[\s\S]*return session\.isActive \|\| session\.isCurrent;/,
  'Active/current formula sessions should default expanded.'
);
assert.match(
  studentUi,
  /function collapsePriorTutorCards\(currentTurnId\)[\s\S]*currentSessionKey[\s\S]*collapsePriorTutorSessions\(currentSessionKey\)[\s\S]*tutorSessionExpandedState\.set\(currentSessionKey, true\)/,
  'Starting a new formula session should expand the current session and consider collapsing prior sessions.'
);
assert.match(
  studentUi,
  /function collapsePriorTutorSessions\(currentSessionKey\)[\s\S]*sessionKey !== currentSessionKey[\s\S]*tutorSessionExpandedState\.set\(sessionKey, false\)/,
  'Previous formula sessions should collapse automatically when a different formula problem begins.'
);
assert.match(
  studentUi,
  /function toggleTutorSession\(sessionKey\)[\s\S]*tutorSessionExpandedState\.set\(sessionKey, !expanded\)[\s\S]*renderTimeline\(\)/,
  'Collapsed formula sessions should be reopenable by students.'
);
assert.match(
  studentUi,
  /function handleTimelineClick\(event\)[\s\S]*data-toggle-tutor-session-id[\s\S]*toggleTutorSession/,
  'Timeline click handling should support session-level toggles.'
);

assert.match(
  studentUi,
  /data-copy-turn-id/,
  'Copy Answer should remain near assistant/session messages in the timeline.'
);
assert.match(
  studentUi,
  /function findLatestCopyableTurnId\(\)[\s\S]*isCopyableAnswerTurn\(turn\)/,
  'Only the newest final or direct answer should expose Copy Answer.'
);
assert.match(
  studentUi,
  /turn\.tutor\.completed === true[\s\S]*finalAnswer/,
  'Tutor steps should only become copyable once a final answer exists.'
);
assert.match(
  studentUi,
  /function selectionTouchesStudentAnswerArea\(range\)[\s\S]*range\.intersectsNode\(timeline\)/,
  'Ask highlighted text should read from the unified timeline, including formula sessions.'
);
assert.match(
  studentUi,
  /function scrollTimelineToBottom\(\)[\s\S]*student-tutor-session\.is-expanded\.is-active \.student-tutor-session-scroll[\s\S]*timeline\.scrollTop = timeline\.scrollHeight;/,
  'Newest active tutor work should stay visible in both the session scroller and timeline.'
);

assert.match(tutorBodyBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\);/, 'Non-formula tutor cards should stay in one timeline column without reserving a blank side panel.');
assert.match(calculatorBlock, /min-width:\s*0;/, 'Calculator should shrink within its timeline card.');
assert.match(calculatorBlock, /width:\s*min\(100%,\s*320px\);/, 'Calculator should remain compact inside active tutor work.');
assert.match(calculatorKeysBlock, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/, 'Calculator keys should fit inside the tutor card.');

const tabletMediaIndex = studentHtml.indexOf('@media (max-width: 820px)');
const phoneMediaIndex = studentHtml.indexOf('@media (max-width: 520px)');
const reducedMotionMediaIndex = studentHtml.indexOf('@media (prefers-reduced-motion: reduce)');
const tabletCss = tabletMediaIndex === -1
  ? ''
  : studentHtml.slice(tabletMediaIndex, phoneMediaIndex === -1 ? undefined : phoneMediaIndex);
const phoneCss = phoneMediaIndex === -1
  ? ''
  : studentHtml.slice(phoneMediaIndex, reducedMotionMediaIndex === -1 ? undefined : reducedMotionMediaIndex);
const reducedMotionCss = reducedMotionMediaIndex === -1
  ? ''
  : studentHtml.slice(reducedMotionMediaIndex);

assert.match(tabletCss, /\.student-composer\s*\{[\s\S]*grid-template-columns:\s*1fr;[\s\S]*\}/, 'Chromebook/iPad-sized screens should stack the composer.');
assert.match(tabletCss, /\.student-tutor-session-header\s*\{[\s\S]*grid-template-columns:\s*1fr;[\s\S]*\}/, 'Chromebook/iPad-sized screens should stack session headers.');
assert.match(tabletCss, /\.student-tutor-body,[\s\S]*\.student-tutor-grid,[\s\S]*\.student-tutor-session-step\s*\{[\s\S]*grid-template-columns:\s*1fr;[\s\S]*\}/, 'Narrow screens should keep tutor work in one column.');
assert.match(phoneCss, /\.student-tutor-session-scroll\s*\{[\s\S]*max-height:\s*min\(620px,\s*calc\(100dvh - 14rem\)\);[\s\S]*\}/, 'Phone layout should keep formula session scroll usable while allowing more content to fit.');
assert.match(reducedMotionCss, /\.student-tutor-session-panel,[\s\S]*\.student-tutor-session-toggle\s*\{[\s\S]*transition:\s*none;[\s\S]*\}/, 'Reduced motion should disable session expand/collapse animation.');

console.log('student tutor UI: formula tutor turns group into collapsible problem sessions');
