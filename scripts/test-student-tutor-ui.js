const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createStudentRouteHarness } = require('./test-helpers/studentRouteHarness');
const {
  buildMotionForceKnowledgeTutorMetadata,
  buildMotionForceKnowledgeTutorPrompt,
  continueMotionForceKnowledgeTutor,
  startMotionForceKnowledgeTutor
} = require('../lib/tutor/motionForceKnowledgeTutor');

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
const tutorChoicesBlock = getCssBlock('.student-tutor-choices');
const tutorChoiceButtonBlock = getCssBlock('.student-tutor-choice-button');
const composerTutorChoicesBlock = getCssBlock('.student-composer-tutor-choices');
const composerTutorChoicesHiddenBlock = getCssBlock('.student-composer-tutor-choices[hidden]');
const composerChoiceButtonBlock = getCssBlock('.student-composer-choice-button');
const flashcardCardBlock = getCssBlock('.flashcard-session-card');
const flashcardTitleBlock = getCssBlock('.flashcard-session-title');
const flashcardProgressBlock = getCssBlock('.flashcard-session-progress');
const flashcardFrontBlock = getCssBlock('.flashcard-session-front');
const flashcardBackBlock = getCssBlock('.flashcard-session-back');
const flashcardActionsBlock = getCssBlock('.flashcard-session-actions');
const flashcardActionBlock = getCssBlock('.flashcard-session-action');
const fireworksBlock = getCssBlock('.student-fireworks');

assert.match(shellBlock, /grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;/, 'Student shell should reserve one central scroll lane plus bottom composer.');
assert.match(timelineBlock, /overflow-y:\s*auto;/, 'Conversation timeline should remain the main page scroll area.');
assert.match(timelineBlock, /overscroll-behavior:\s*contain;/, 'Timeline should contain scroll gestures.');
assert.match(composerBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/, 'Desktop composer should keep input beside actions.');
assert.ok(studentHtml.includes('id="studentComposerTutorChoices"'), 'Composer should include a near-input Formula Tutor choice strip.');
assert.ok(studentHtml.indexOf('id="studentComposerTutorChoices"') > formIndex && studentHtml.indexOf('id="studentComposerTutorChoices"') < inputIndex, 'Composer tutor choices should sit immediately above the answer input.');
assert.match(composerTutorChoicesBlock, /grid-column:\s*1 \/ -1;/, 'Composer tutor choices should span the input row.');
assert.match(composerTutorChoicesHiddenBlock, /display:\s*none;/, 'Composer tutor choices should hide when no choice step is active.');
assert.match(composerChoiceButtonBlock, /min-height:\s*42px;/, 'Composer tutor choice buttons should be prominent tap targets.');
assert.match(tutorChoicesBlock, /align-items:\s*stretch;/, 'Formula Tutor choices inside work should render as primary controls.');
assert.match(tutorChoiceButtonBlock, /min-height:\s*40px;/, 'Formula Tutor choice buttons should be prominent.');
assert.ok(flashcardCardBlock, 'Interactive flashcards should have a compact card style.');
assert.match(flashcardCardBlock, /border-radius:\s*8px;/, 'Flashcard cards should stay compact in the chat timeline.');
assert.match(flashcardTitleBlock, /font-weight:\s*850;/, 'Flashcard card titles should be visually prominent.');
assert.match(flashcardProgressBlock, /text-transform:\s*uppercase;/, 'Flashcard card progress should scan like session metadata.');
assert.match(flashcardFrontBlock, /overflow-wrap:\s*anywhere;/, 'Flashcard fronts should wrap safely on small screens.');
assert.match(flashcardBackBlock, /font-weight:\s*760;/, 'Flashcard backs should read as the revealed answer.');
assert.match(flashcardActionsBlock, /flex-wrap:\s*wrap;/, 'Flashcard controls should wrap inside one-column chat.');
assert.match(flashcardActionBlock, /min-height:\s*38px;/, 'Flashcard action buttons should be easy tap targets.');

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
  /turn\.flashcardSession = data\.flashcardSession[\s\S]*data\.flashcards[\s\S]*clonePlain/,
  'Student messages should store flashcard session metadata from the backend.'
);
assert.match(
  studentUi,
  /function renderChatTurn\(turn, copyableTurnId\)[\s\S]*has-flashcard-session[\s\S]*renderFlashcardSessionCard\(turn\.flashcardSession\)[\s\S]*renderTutorCardHtml\(turn\)/,
  'Flashcard session cards should render in normal chat turns separately from Formula Tutor cards.'
);
assert.match(
  studentUi,
  /function renderAssistantResponseHtml\(turn\)[\s\S]*if \(isRenderableFlashcardSession\(turn\?\.flashcardSession\)\) return '';/,
  'Interactive flashcard cards should not duplicate the plain text response in the browser UI.'
);
assert.match(
  studentUi,
  /function renderFlashcardSessionCard\(session\)[\s\S]*const progress = totalCards > 0 && cardNumber > 0 \? `Card \$\{cardNumber\} of \$\{totalCards\}` : '';[\s\S]*Flashcards: \$\{escapeHtml\(session\.title \|\| 'Flashcards'\)\}[\s\S]*flashcard-session-progress[\s\S]*flashcard-session-front[\s\S]*flashcard-session-back[\s\S]*flashcard-session-actions/,
  'Flashcard cards should render title, progress, front, optional back, and local controls.'
);
assert.match(
  studentUi,
  /function renderFlashcardSessionCard\(session\)[\s\S]*Flashcard deck complete: \$\{escapeHtml\(title\)\}[\s\S]*You reviewed \$\{escapeHtml\(String\(reviewedCount\)\)\} cards\.[\s\S]*renderFlashcardActionButton\('restart', 'Restart deck'\)/,
  'Completed flashcard decks should render reviewed count and Restart deck control.'
);
assert.match(
  studentUi,
  /function renderFlashcardActionButton\(command, overrideLabel = ''\)[\s\S]*data-flashcard-action="\$\{escapeAttr\(action\)\}"[\s\S]*getFlashcardActionLabel\(action\)/,
  'Flashcard buttons should expose the backend text command as data-flashcard-action.'
);
assert.match(
  studentUi,
  /function getFlashcardActionLabel\(command\)[\s\S]*command === 'show'[\s\S]*Show answer[\s\S]*command === 'again'[\s\S]*Again[\s\S]*command === 'next'[\s\S]*Next[\s\S]*command === 'stop'[\s\S]*Stop[\s\S]*command === 'restart'[\s\S]*Restart deck/,
  'Flashcard action labels should map to existing text commands.'
);
assert.match(
  studentUi,
  /const flashcardButton = event\.target\.closest\('\[data-flashcard-action\]'\);[\s\S]*sendFlashcardCommand\(flashcardButton\.getAttribute\('data-flashcard-action'\) \|\| ''\)/,
  'Flashcard action buttons should submit their command payloads.'
);
assert.match(
  studentUi,
  /async function sendFlashcardCommand\(command\)[\s\S]*const turnId = addPendingTurn\(command\)[\s\S]*const data = await sendStudentMessage\(command\)[\s\S]*renderStudentMessageResult\(data, command, \{ turnId \}\)/,
  'Flashcard buttons should use the normal student-message pipeline.'
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
  /function renderTutorChoiceButtons\(tutor, work = \{\}\)[\s\S]*data-tutor-choice="\$\{escapeAttr\(choice\.number\)\}"[\s\S]*\$\{escapeHtml\(`\$\{choice\.number\}\. \$\{choice\.label\}`\)\}/,
  'Formula tutor choices should render as clickable numbered buttons.'
);
assert.match(
  studentUi,
  /const tutorChoiceButton = event\.target\.closest\('\[data-tutor-choice\]'\);[\s\S]*sendTutorCommand\(tutorChoiceButton\.getAttribute\('data-tutor-choice'\) \|\| ''\)/,
  'Choice buttons should submit the numeric choice value.'
);
assert.match(
  studentUi,
  /function updateComposerTutorChoices\(\)[\s\S]*getActiveTutorChoiceState\(\)[\s\S]*class="student-composer-choice-button"[\s\S]*data-tutor-choice="\$\{escapeAttr\(choice\.number\)\}"/,
  'Active Formula Tutor choices should render above the input.'
);
assert.match(
  studentUi,
  /function updateInputPlaceholder\(hasChoiceStep\)[\s\S]*input\.placeholder = hasChoiceStep \? 'Type choice number only' : defaultInputPlaceholder;/,
  'Input placeholder should switch on multiple-choice tutor steps.'
);
assert.match(
  studentUi,
  /function handleComposerTutorChoiceClick\(event\)[\s\S]*sendTutorCommand\(tutorChoiceButton\.getAttribute\('data-tutor-choice'\) \|\| ''\)/,
  'Composer choice buttons should submit the numeric choice value.'
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
  /function resetCalculatorForTutorStepChange\(tutor\)[\s\S]*getActiveTutorStepKey\(tutor\)[\s\S]*resetCalculator\(\{ silent: true \}\)/,
  'Calculator display state should reset when the active tutor problem or step changes.'
);
assert.match(
  studentUi,
  /data-calculator-use-result[\s\S]*function useCalculatorResult\(\)[\s\S]*input\.value = value[\s\S]*input\.focus\(\)/,
  'Calculator should expose a Use result path that fills the answer input without submitting.'
);
assert.match(
  studentUi,
  /if \(key === 'equals'\)[\s\S]*calculateExpression\(\)[\s\S]*function calculateExpression\(\)[\s\S]*useCalculatorResult\(\)[\s\S]*updateCalculatorDisplay\(\)/,
  'Calculator equals should place the result in the answer input without auto-submitting.'
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

assert.ok(studentHtml.includes('id="studentTutorFireworks" class="student-fireworks" aria-hidden="true" hidden'), 'Tutor completion fireworks overlay should stay hidden until completion.');
assert.match(fireworksBlock, /pointer-events:\s*none;/, 'Tutor completion fireworks should not block student input.');
assert.match(fireworksBlock, /contain:\s*layout paint;/, 'Tutor completion fireworks should isolate layout and paint work.');
assert.match(studentHtml, /student-firework-particle[\s\S]*student-firework-ring[\s\S]*student-firework-rain/, 'Tutor completion fireworks should include burst particles, rings, and sparkle rain styles.');
assert.match(studentUi, /const FIREWORKS_MAX_PARTICLES = 170;/, 'Tutor completion fireworks should cap active particles.');
assert.match(studentUi, /const FIREWORKS_DURATION_MS = 3600;/, 'Tutor completion fireworks should clean up after a short finale.');
assert.match(
  studentUi,
  /function maybeCelebrateTutorCompletion\(tutor, work, context = \{\}\)[\s\S]*tutor\?\.completed[\s\S]*tutor\?\.stopped[\s\S]*getTutorFinalAnswer\(tutor, work\)[\s\S]*completedCelebrationKey[\s\S]*showTutorFireworks\(\)/,
  'Tutor completion fireworks should trigger only for completed tutor work with a final answer and a fresh completion key.'
);
assert.match(
  studentUi,
  /function getTutorFinalAnswer\(tutor, work = \{\}\)[\s\S]*work\.finalAnswer[\s\S]*work\.answer[\s\S]*tutor\?\.finalAnswerDisplay/,
  'Tutor completion fireworks should use the shared final-answer shape used by Formula and General Tutor metadata.'
);
assert.match(
  studentUi,
  /function showTutorFireworks\(\)[\s\S]*fireworks\.replaceChildren\(\);[\s\S]*prefersReducedMotion\(\)[\s\S]*createTutorFireworkFinale\(\)[\s\S]*fireworks\.replaceChildren\(\);/,
  'Tutor completion fireworks should respect reduced motion and clean up generated DOM.'
);
assert.match(
  studentUi,
  /megaBurst[\s\S]*sideBurstLeft[\s\S]*sideBurstRight[\s\S]*sparkleRain[\s\S]*ringShockwave[\s\S]*finalePop/,
  'Tutor completion fireworks should include the expected finale burst presets.'
);

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
assert.match(reducedMotionCss, /\.student-fireworks\s*\{[\s\S]*display:\s*none;/, 'Reduced motion should skip tutor completion fireworks.');

async function testGuidedFormulaTutorStartup() {
  const cases = [
    {
      name: 'roller-coaster-acceleration',
      question: 'A roller coaster car rapidly picks up speed as it rolls down a slope. As it starts down the slope, its speed is 4 m/s. 3 seconds later, at the bottom of the slope, its speed is 22 m/s. Find its acceleration.',
      formulaId: 'acceleration_velocity_time',
      solveFor: 'acceleration',
      finalAnswer: /acceleration = 6 m\/s²/i,
      directAnswer: /a = 6 m\/s²/i,
      steps: ['acceleration', '1', '4 m/s', '22 m/s', '3 s', '6']
    },
    {
      name: 'from-rest-kmhr-acceleration',
      question: 'calculate acceleration from rest to 70 km/hr in 7 seconds',
      formulaId: 'acceleration_velocity_time',
      solveFor: 'acceleration',
      finalAnswer: /acceleration = about 2\.78 m\/s²/i,
      directAnswer: /a = about 2\.78 m\/s²/i,
      steps: ['1', '1', '0', '70', '7', '2.78']
    },
    {
      name: 'skateboarder-final-speed',
      question: 'A skateboarder has an acceleration of 1.5 m/s2. Starting from rest, if he accelerates for 2 s, what speed will he reach?',
      formulaId: 'acceleration_velocity_time',
      solveFor: 'final velocity',
      finalAnswer: /final velocity = 3 m\/s/i,
      directAnswer: /vf = 3 m\/s/i,
      steps: ['final velocity', '1', '0 m/s', '1.5 m/s2', '2 s', '3']
    },
    {
      name: 'cart-final-speed',
      question: 'Challenge: A cart rolling down an incline for 5.0 seconds has an acceleration of 4.0 m/s2. If the cart has an initial speed of 2.0 m/s, what is its final speed?',
      formulaId: 'acceleration_velocity_time',
      solveFor: 'final velocity',
      formula: 'vf = vi + a × t',
      finalAnswer: /final velocity = 22 m\/s/i,
      directAnswer: /vf = 22 m\/s/i,
      steps: ['final velocity', '1', '2 m/s', '4 m/s2', '5 s', '22']
    },
    {
      name: 'school-bus-distance-displacement',
      question: 'A school bus leaves school and heads east for 2 miles before making its first stop. It then turns left and heads north 3 miles before making another stop. Find the distance and displacement of the school bus after completing its first two stops.',
      formulaId: 'distance_displacement_2d',
      solveFor: 'distance and displacement',
      finalAnswer: /Distance = 5 miles[\s\S]*Displacement = about 3\.61 miles northeast/i,
      directAnswer: /Answer: distance = 5 miles; displacement = about 3\.61 miles NE/i,
      steps: ['1', '1', '2 miles east', '3 miles north', '5', '3.61']
    },
    {
      name: 'grouped-net-force',
      question: 'Two students push on a box in the same direction and a third student pushes in the opposite direction. What is the net force on the box if each push with a force of 50 N?',
      formulaId: 'net_force',
      solveFor: 'net force',
      finalAnswer: /net force = 50 N in the direction of the two students/i,
      directAnswer: /The net force is 50 N in the direction of the two students/i,
      steps: ['2', '1', '50 N', '1', '100', '50']
    },
    {
      name: 'prompt-3c-lunch-table-box-acceleration',
      question: 'A 5.5 kg box is pushed across the lunch table. The net force applied to the box is 9.7 N. What is the acceleration of the box?',
      formulaId: 'force_mass_acceleration',
      solveFor: 'acceleration',
      formula: 'a = F / m',
      finalAnswer: /acceleration = 1\.7636 m\/s²/i,
      directAnswer: /The acceleration is about 1\.76 m\/s²/i,
      steps: ['2', '1', '9.7 N', '5.5 kg', '1.76']
    },
    {
      name: 'prompt-3c-mass-from-unbalanced-force',
      question: 'What is the mass of an object that has an acceleration of 2.63 m/s² when an unbalanced force of 112 N is applied to it?',
      formulaId: 'force_mass_acceleration',
      solveFor: 'mass',
      formula: 'm = F / a',
      finalAnswer: /mass = 42\.5856 kg/i,
      directAnswer: /The mass is about 42\.59 kg/i,
      steps: ['3', '1', '112 N', '2.63 m/s²', '42.6']
    },
    {
      name: 'prompt-3c-bicyclist-momentum',
      question: 'If a bicyclist has a mass of 70 kg and a velocity of 25 m/s, what is the momentum of the bicyclist?',
      formulaId: 'momentum_mass_velocity',
      solveFor: 'momentum',
      formula: 'p = m × v',
      finalAnswer: /momentum = 1750 kg·m\/s/i,
      directAnswer: /p = 1750 kg·m\/s/i,
      steps: ['1', '1', '70 kg', '25 m/s', '1750']
    },
    {
      name: 'prompt-3c-truck-mass-from-momentum',
      question: 'If a truck has 40,500 kg*m/s of momentum and is moving with a velocity of 90 m/s, what is the truck’s mass?',
      formulaId: 'momentum_mass_velocity',
      solveFor: 'mass',
      formula: 'm = p / v',
      finalAnswer: /mass = 450 kg/i,
      directAnswer: /m = 450 kg/i,
      steps: ['2', '1', '40500 kg*m/s', '90 m/s', '450']
    },
    {
      name: 'prompt-3c-suitcase-weight',
      question: 'Find the weight of a suitcase that has a mass of 42 kg.',
      formulaId: 'weight_mass_gravity',
      solveFor: 'weight',
      formula: 'Fg = m × g',
      finalAnswer: /weight = 411\.6 N/i,
      directAnswer: /Fg = 411\.6 N/i,
      steps: ['1', '1', '42 kg', '9.8 m/s²', '411.6']
    },
    {
      name: 'prompt-3c-rock-thrown-force',
      question: 'A rock is skipped into a lake at 24 m/s², with what force was the rock thrown if it was 1.75 kg?',
      formulaId: 'force_mass_acceleration',
      solveFor: 'force',
      formula: 'F = m × a',
      finalAnswer: /force = 42 N/i,
      directAnswer: /F = 42 N/i,
      steps: ['1', '1', '1.75 kg', '24 m/s²', '42']
    },
    {
      name: 'prompt-3c-mass-from-force-and-acceleration',
      question: 'Calculate the mass of an object accelerating at 14 m/s² with a force of 280 N.',
      formulaId: 'force_mass_acceleration',
      solveFor: 'mass',
      formula: 'm = F / a',
      finalAnswer: /mass = 20 kg/i,
      directAnswer: /m = 20 kg/i,
      steps: ['3', '1', '280 N', '14 m/s²', '20']
    },
    {
      name: 'prompt-3c-exact-cart-final-speed',
      question: 'A cart rolling down an incline for 5.0 seconds has an acceleration of 4.0 m/s2. If the cart has an initial speed of 2.0 m/s, what is its final speed?',
      formulaId: 'acceleration_velocity_time',
      solveFor: 'final velocity',
      formula: 'vf = vi + a × t',
      finalAnswer: /final velocity = 22 m\/s/i,
      directAnswer: /vf = 22 m\/s/i,
      steps: ['final velocity', '1', '2 m/s', '4 m/s2', '5 s', '22']
    }
  ];

  for (const testCase of cases) {
    await assertGuidedTutorStartsAndCompletes(testCase);
    await assertDirectAnswerWhenGuidedTutorDisabled(testCase);
  }
}

async function assertGuidedTutorStartsAndCompletes(testCase) {
  const harness = createStudentRouteHarness({ studentGuidedFormulaTutoringEnabled: true });
  const create = await harness.request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201, `${testCase.name} create enabled session`);

  const start = await harness.request('POST', '/api/student/message', {
    sessionId: create.body.sessionId,
    studentHubId: testCase.name,
    message: testCase.question
  });

  assert.equal(start.statusCode, 200, `${testCase.name} guided start status`);
  assert.equal(start.body.routeType, 'formula_tutor', `${testCase.name} should start formula tutor`);
  assert.equal(start.body.tutor.active, true, `${testCase.name} tutor should be active`);
  assert.equal(start.body.tutor.formulaId, testCase.formulaId, `${testCase.name} formula id`);
  assert.equal(start.body.tutor.solveFor, testCase.solveFor, `${testCase.name} solve target`);
  assert.equal(start.body.tutor.originalQuestion, testCase.question, `${testCase.name} keeps original question`);
  assert.ok(start.body.tutor.totalSteps > 0, `${testCase.name} should expose tutor steps`);
  assert.equal(start.body.tutor.work.originalQuestion, testCase.question, `${testCase.name} work keeps original question`);
  assert.doesNotMatch(start.body.response, testCase.directAnswer, `${testCase.name} should not give direct final answer at tutor start`);
  if (testCase.formula) assert.equal(start.body.tutor.formula, testCase.formula, `${testCase.name} formula`);

  let latest = start;
  for (const message of testCase.steps) {
    latest = await harness.request('POST', '/api/student/message', {
      sessionId: create.body.sessionId,
      studentHubId: testCase.name,
      message
    });
    assert.equal(latest.statusCode, 200, `${testCase.name} step ${message} status`);
    assert.equal(latest.body.routeType, 'formula_tutor', `${testCase.name} step ${message} route`);
    assert.equal(latest.body.tutor.originalQuestion, testCase.question, `${testCase.name} step ${message} keeps original question`);
  }

  assert.equal(latest.body.tutor.completed, true, `${testCase.name} should complete tutor`);
  assert.equal(latest.body.tutor.active, false, `${testCase.name} should stop active tutor after completion`);
  assert.match(latest.body.response, testCase.finalAnswer, `${testCase.name} final guided answer`);
  assert.equal(
    harness.studentSessions[create.body.sessionId].anonymousHubs[testCase.name].currentTutorProblem,
    null,
    `${testCase.name} should clear tutor state after completion`
  );
}

async function assertDirectAnswerWhenGuidedTutorDisabled(testCase) {
  const harness = createStudentRouteHarness({ studentGuidedFormulaTutoringEnabled: false });
  const create = await harness.request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201, `${testCase.name} create disabled session`);

  const direct = await harness.request('POST', '/api/student/message', {
    sessionId: create.body.sessionId,
    studentHubId: `${testCase.name}-direct`,
    message: testCase.question
  });

  assert.equal(direct.statusCode, 200, `${testCase.name} direct status`);
  assert.notEqual(direct.body.routeType, 'formula_tutor', `${testCase.name} should not start formula tutor when disabled`);
  assert.match(direct.body.response, testCase.directAnswer, `${testCase.name} direct answer`);
  assert.equal(
    harness.studentSessions[create.body.sessionId].anonymousHubs[`${testCase.name}-direct`].currentTutorProblem,
    null,
    `${testCase.name} should not store tutor state when disabled`
  );
}

async function testConceptualFormulaTutorChoices() {
  await assertConceptualStepShowsChoices({
    name: 'mali-spin-choice',
    question: 'Mali spins in place and falls down where she started. What are her distance and displacement?',
    stepId: 'identify_spin_in_place',
    setupAnswers: ['1', '1'],
    expectedChoices: [
      /1\. She spun\/stayed in place/i,
      /2\. She moved to a different location/i,
      /3\. She traveled 7 meters/i
    ],
    correctAnswer: '1'
  });

  await assertConceptualStepShowsChoices({
    name: 'kai-pool-choice',
    question: 'Kai swims the length of a 50 m pool three times. What are his distance and displacement?',
    stepId: 'identify_finish_side',
    setupAnswers: ['1', '1', '50 m', '3', '150'],
    expectedChoices: [
      /1\. Back where he started/i,
      /2\. Opposite side of the pool/i,
      /3\. 150 m away from the start/i
    ],
    correctAnswer: '2'
  });

  await assertConceptualStepShowsChoices({
    name: 'pj-closed-loop-choice',
    question: 'PJ walks 0.35 miles around the block and returns to his doorstep. What are his distance and displacement?',
    stepId: 'identify_finish_location',
    setupAnswers: ['1', '1', '0.35'],
    expectedChoices: [
      /1\. Same place \/ back where he started/i,
      /2\. Opposite side \/ away from where he started/i,
      /3\. 0\.35 miles north/i
    ],
    correctAnswer: '1'
  });
}

async function testMultipleChoiceNormalizationRegressions() {
  await assertConceptualChoiceAnswerAccepted({
    name: 'mc-normalization-one-backslash',
    question: 'Mali loves to make herself dizzy. She spins around in place 7 times before falling down right where she was standing. Find her distance and displacement.',
    setupAnswers: ['1', '1'],
    stepId: 'identify_spin_in_place',
    answer: '1\\'
  });

  await assertConceptualChoiceAnswerAccepted({
    name: 'mc-normalization-one-period',
    question: 'PJ likes to ride his bike around the block. If he rides out of his house west, the sidewalk circles his block, and brings him back to his doorstep 0.35 miles later. Find his distance and displacement.',
    setupAnswers: ['1', '1', '0.35'],
    stepId: 'identify_finish_location',
    answer: '1.'
  });

  await assertConceptualChoiceAnswerAccepted({
    name: 'mc-normalization-two-paren',
    question: 'Kai swims for the school swim team. He specializes in a backstroke event where he has to swim the 50-m length of the pool three times. Find his distance and displacement.',
    setupAnswers: ['1', '1', '50 m', '3', '150'],
    stepId: 'identify_finish_side',
    answer: '2)'
  });
}

async function testSpecialDistanceDisplacementTutorRegressions() {
  await testPjLoopTutorRegression();
  await testMaliSpinTutorRegression();
  await testKaiPoolTutorRegression();
}

async function testPjLoopTutorRegression() {
  const question = 'PJ likes to ride his bike around the block. If he rides out of his house west, the sidewalk circles his block, and brings him back to his doorstep 0.35 miles later. Find his distance and displacement.';

  for (const answer of ['1', 'same', 'same place', 'the same place', 'same place (he returns home)', 'back where he started', 'back home', 'doorstep']) {
    const harness = await createHarnessSession();
    let latest = await sendHarnessMessage(harness, `pj-loop-${answer.replace(/\W/g, '') || 'one'}`, question);
    assert.equal(latest.body.routeType, 'formula_tutor', 'PJ loop should start Formula Tutor');
    for (const setupAnswer of ['1', '1', '0.35']) {
      latest = await sendHarnessMessage(harness, `pj-loop-${answer.replace(/\W/g, '') || 'one'}`, setupAnswer);
    }
    assert.equal(latest.body.tutor.stepId, 'identify_finish_location', 'PJ should ask finish location');
    assertFormulaTutorChoices(latest.body, {
      name: `PJ ${answer}`,
      expectedChoices: [
        /1\. Same place \/ back where he started/i,
        /2\. Opposite side \/ away from where he started/i,
        /3\. 0\.35 miles north/i
      ]
    });

    latest = await sendHarnessMessage(harness, `pj-loop-${answer.replace(/\W/g, '') || 'one'}`, answer);
    assert.equal(latest.body.tutor.stepId, 'calculate_displacement', `PJ should accept ${answer}`);
    latest = await sendHarnessMessage(harness, `pj-loop-${answer.replace(/\W/g, '') || 'one'}`, '1');
    assert.equal(latest.body.tutor.completed, true, `PJ should complete after ${answer}`);
    assert.match(latest.body.response, /Distance = 0\.35 miles/i);
    assert.match(latest.body.response, /Displacement = 0 miles/i);
    assert.equal(latest.body.tutor.work.finalAnswer, 'distance = 0.35 miles; displacement = 0 miles');
  }

  const rejectHarness = await createHarnessSession();
  let rejected = await sendHarnessMessage(rejectHarness, 'pj-loop-reject-zero', question);
  for (const setupAnswer of ['1', '1', '0.35']) {
    rejected = await sendHarnessMessage(rejectHarness, 'pj-loop-reject-zero', setupAnswer);
  }
  rejected = await sendHarnessMessage(rejectHarness, 'pj-loop-reject-zero', '0');
  assert.equal(rejected.body.tutor.completed, false, 'PJ finish-location step should reject 0');
  assert.equal(rejected.body.tutor.stepId, 'identify_finish_location', 'PJ should remain on finish-location step after 0');
  assert.match(rejected.body.response, /Try 1, or click “1\. Same place \/ back where he started\.”/i);
}

async function testMaliSpinTutorRegression() {
  const name = 'mali-spin-full-regression';
  const question = 'Mali loves to make herself dizzy. She spins around in place 7 times before falling down right where she was standing. Find her distance and displacement.';
  const harness = await createHarnessSession();
  let latest = await sendHarnessMessage(harness, name, question);
  assert.equal(latest.body.routeType, 'formula_tutor', `${name} should start Formula Tutor`);
  for (const setupAnswer of ['1', '1']) {
    latest = await sendHarnessMessage(harness, name, setupAnswer);
  }
  assert.equal(latest.body.tutor.stepId, 'identify_spin_in_place', `${name} should ask spin-in-place step`);
  assertFormulaTutorChoices(latest.body, {
    name,
    expectedChoices: [
      /1\. She spun\/stayed in place/i,
      /2\. She moved to a different location/i,
      /3\. She traveled 7 meters/i
    ]
  });

  latest = await sendHarnessMessage(harness, name, '1\\');
  assert.equal(latest.body.tutor.stepId, 'calculate_distance', `${name} should accept 1\\`);
  latest = await sendHarnessMessage(harness, name, '0');
  latest = await sendHarnessMessage(harness, name, '0');
  assert.equal(latest.body.tutor.completed, true, `${name} should complete`);
  assert.match(latest.body.response, /Distance = 0/i);
  assert.match(latest.body.response, /Displacement = 0/i);
  assert.equal(latest.body.tutor.work.finalAnswer, 'distance = 0; displacement = 0');
}

async function testKaiPoolTutorRegression() {
  const question = 'Kai swims for the school swim team. He specializes in a backstroke event where he has to swim the 50-m length of the pool three times. Find his distance and displacement.';

  for (const answer of ['2', 'opposite side', 'opposition side', 'different side']) {
    const name = `kai-pool-${answer.replace(/\W/g, '-')}`;
    const harness = await createHarnessSession();
    let latest = await sendHarnessMessage(harness, name, question);
    assert.equal(latest.body.routeType, 'formula_tutor', `${name} should start Formula Tutor`);
    for (const setupAnswer of ['1', '1', '50 m', '3', '150']) {
      latest = await sendHarnessMessage(harness, name, setupAnswer);
    }
    assert.equal(latest.body.tutor.stepId, 'identify_finish_side', `${name} should ask finish-side step`);
    assertFormulaTutorChoices(latest.body, {
      name,
      expectedChoices: [
        /1\. Back where he started/i,
        /2\. Opposite side of the pool/i,
        /3\. 150 m away from the start/i
      ]
    });

    latest = await sendHarnessMessage(harness, name, answer);
    assert.equal(latest.body.tutor.stepId, 'calculate_displacement', `${name} should accept ${answer}`);
    latest = await sendHarnessMessage(harness, name, '1');
    assert.equal(latest.body.tutor.completed, true, `${name} should complete`);
    assert.match(latest.body.response, /Distance = 150 m/i);
    assert.match(latest.body.response, /Displacement = 50 m/i);
    assert.equal(latest.body.tutor.work.finalAnswer, 'distance = 150 m; displacement = 50 m');
  }
}

async function testConcept3GeneralTutorVocabularyChoices() {
  await assertDirectDefinitionOrGeneralTutorChoices({
    name: 'concept3-inertia-vocab-choice',
    question: 'what is Inertia',
    expectedDefinition: /Inertia is an object’s resistance to a change in motion/i,
    expectedPrompt: /Is inertia about changing motion easily or resisting a change in motion\?/i,
    expectedChoices: [
      /1\. Resisting a change in motion/i,
      /2\. Changing motion easily/i,
      /3\. Measuring speed/i
    ],
    correctAnswer: '1',
    expectComplete: false
  });

  await assertDirectDefinitionOrGeneralTutorChoices({
    name: 'concept3-air-resistance-vocab-choice',
    question: 'what is air resistance',
    expectedDefinition: /Air resistance is .*opposite/i,
    expectedPrompt: /Air resistance acts in what direction compared with motion\?/i,
    expectedChoices: [
      /1\. Opposite the motion/i,
      /2\. Same direction as the motion/i,
      /3\. Straight down because of gravity/i
    ],
    correctAnswer: '1',
    expectComplete: true
  });

  [
    {
      id: 'balanced_force_concept_3_vocab',
      topic: 'balanced force',
      finalAnswer: 'Balanced forces are equal in size and opposite in direction, so net force is 0 and motion does not change.',
      guidingQuestions: ['What is the net force when forces are balanced?'],
      expectedChoices: [/1\. 0/i, /2\. Greater than 0/i, /3\. Always negative/i]
    },
    {
      id: 'unbalanced_force_concept_3_vocab',
      topic: 'unbalanced force',
      finalAnswer: 'Unbalanced forces do not cancel. Net force is not 0, so they can change speed, direction, or motion.',
      guidingQuestions: ['What can unbalanced forces do?'],
      expectedChoices: [/1\. Change an object’s motion/i, /2\. Make net force equal 0/i, /3\. Stop all forces from acting/i]
    },
    {
      id: 'friction_concept_3_vocab',
      topic: 'friction',
      finalAnswer: 'Friction is a force that resists motion when surfaces rub, slide, or roll against each other.',
      guidingQuestions: ['What does friction do?'],
      expectedChoices: [/1\. Resists motion when surfaces touch/i, /2\. Measures how fast an object moves/i, /3\. Makes net force always equal 0/i]
    },
    {
      id: 'inertia_vocab',
      topic: 'inertia',
      finalAnswer: 'Inertia is an object’s resistance to a change in motion. More mass means more inertia.',
      guidingQuestions: ['What does inertia mean?'],
      expectedChoices: [/1\. Resisting a change in motion/i, /2\. Changing motion easily/i, /3\. Measuring speed/i]
    },
    {
      id: 'air_resistance_vocab',
      topic: 'air resistance',
      finalAnswer: 'Air resistance is drag, a force that resists motion through air and acts opposite the object’s motion.',
      guidingQuestions: ['Air resistance acts in what direction compared with motion?'],
      expectedChoices: [/1\. Opposite the motion/i, /2\. Same direction as the motion/i, /3\. Straight down because of gravity/i]
    },
    {
      id: 'newton_first_law_scenario',
      topic: 'Newton’s 1st Law / inertia',
      finalAnswer: 'Newton’s first law says objects resist changes in motion unless an unbalanced force acts.',
      guidingQuestions: ['What does inertia mean?'],
      expectedChoices: [/1\. An object resists changes in motion/i, /2\. An object always speeds up/i, /3\. An object has no mass/i]
    }
  ].forEach(assertSyntheticGeneralTutorStartsWithChoices);
}

async function assertDirectDefinitionOrGeneralTutorChoices({
  name,
  question,
  expectedDefinition,
  expectedPrompt,
  expectedChoices,
  correctAnswer,
  expectComplete
}) {
  const harness = await createHarnessSession();
  const start = await sendHarnessMessage(harness, name, question);

  if (start.body.routeType !== 'motion_force_knowledge_tutor') {
    assert.notEqual(start.body.routeType, 'formula_tutor', `${name} should not route to formula tutor`);
    assert.match(start.body.response, expectedDefinition, `${name} should answer directly from trusted facts`);
    return;
  }

  assertGeneralTutorChoices(start.body, { name, expectedPrompt, expectedChoices });
  const answered = await sendHarnessMessage(harness, name, correctAnswer);
  assert.equal(answered.body.routeType, 'motion_force_knowledge_tutor', `${name} correct number should stay in General Tutor`);
  if (expectComplete) {
    assert.equal(answered.body.tutor.completed, true, `${name} correct number should complete one-step tutor`);
  } else {
    assert.equal(answered.body.tutor.currentStepIndex, 1, `${name} correct number should advance to the next tutor step`);
  }
}

function assertSyntheticGeneralTutorStartsWithChoices(testCase) {
  const tutor = startMotionForceKnowledgeTutor({
    questionRoute: {
      type: 'definition',
      directAnswer: testCase.finalAnswer,
      motionForceTutor: {
        id: testCase.id,
        topic: testCase.topic,
        category: 'vocab',
        expectedAnswer: testCase.finalAnswer,
        guidingQuestions: testCase.guidingQuestions,
        finalAnswer: testCase.finalAnswer
      }
    },
    originalQuestion: `what is ${testCase.topic}`
  });

  assert.ok(tutor, `${testCase.id} synthetic General Tutor should start`);
  const response = buildMotionForceKnowledgeTutorPrompt(tutor);
  const metadata = buildMotionForceKnowledgeTutorMetadata(tutor);
  assertGeneralTutorChoices({ response, tutor: metadata }, {
    name: testCase.id,
    expectedPrompt: new RegExp(testCase.guidingQuestions[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    expectedChoices: testCase.expectedChoices
  });

  const answered = continueMotionForceKnowledgeTutor(tutor, '1');
  assert.equal(answered.completed, true, `${testCase.id} correct number should complete one-step tutor`);
  assert.match(answered.response, /Yes\./i, `${testCase.id} completion should give the final answer`);
}

function assertGeneralTutorChoices(body, { name, expectedPrompt, expectedChoices }) {
  assert.match(body.response, expectedPrompt, `${name} should show the vocab tutor question`);
  for (const expectedChoice of expectedChoices) {
    assert.match(body.response, expectedChoice, `${name} should display numbered choices immediately`);
  }
  assert.equal(body.tutor?.tutorLabel, 'General Tutor', `${name} should be General Tutor`);
  assert.match(body.tutor?.currentStepPrompt || '', expectedPrompt, `${name} metadata should include current prompt`);
  for (const expectedChoice of expectedChoices) {
    assert.match(body.tutor?.work?.currentStep?.prompt || '', expectedChoice, `${name} work prompt should include numbered choices`);
  }
}

async function assertConceptualStepShowsChoices({ name, question, stepId, setupAnswers, expectedChoices, correctAnswer }) {
  const harness = await createHarnessSession();
  let latest = await sendHarnessMessage(harness, name, question);
  assert.equal(latest.body.routeType, 'formula_tutor', `${name} should start formula tutor`);

  for (const answer of setupAnswers) {
    latest = await sendHarnessMessage(harness, name, answer);
  }

  assert.equal(latest.body.tutor.stepId, stepId, `${name} should prompt the conceptual step`);
  for (const expectedChoice of expectedChoices) {
    assert.match(latest.body.response, expectedChoice, `${name} should display numbered choices immediately`);
  }

  const accepted = await sendHarnessMessage(harness, name, correctAnswer);
  assert.equal(accepted.body.routeType, 'formula_tutor', `${name} correct number should stay in tutor`);
  assert.notEqual(accepted.body.tutor.stepId, stepId, `${name} correct number should advance`);
}

async function assertConceptualChoiceAnswerAccepted({ name, question, setupAnswers, stepId, answer }) {
  const harness = await createHarnessSession();
  let latest = await sendHarnessMessage(harness, name, question);
  assert.equal(latest.body.routeType, 'formula_tutor', `${name} should start formula tutor`);

  for (const setupAnswer of setupAnswers) {
    latest = await sendHarnessMessage(harness, name, setupAnswer);
  }

  assert.equal(latest.body.tutor.stepId, stepId, `${name} should reach conceptual choice step`);
  latest = await sendHarnessMessage(harness, name, answer);
  assert.equal(latest.body.routeType, 'formula_tutor', `${name} should remain in formula tutor after ${answer}`);
  assert.notEqual(latest.body.tutor.stepId, stepId, `${name} should accept ${answer} and advance`);
}

function assertFormulaTutorChoices(body, { name, expectedChoices }) {
  assert.match(body.response, /Choose one:/, `${name} response should label choices`);
  assert.match(body.response, /Click a choice or type only the number\./, `${name} response should invite number or click`);
  const choices = body.tutor?.currentStep?.choices || body.tutor?.work?.currentStep?.choices || [];
  assert.ok(Array.isArray(choices) && choices.length >= expectedChoices.length, `${name} metadata should expose current-step choices`);
  for (const expectedChoice of expectedChoices) {
    assert.match(body.response, expectedChoice, `${name} response should display choice`);
    assert.match(
      choices.map((choice) => `${choice.number}. ${choice.label}`).join('\n'),
      expectedChoice,
      `${name} metadata should include choice`
    );
  }
}

async function testTwoUnitVelocityTutor() {
  const name = 'velocity-mihr-ms';
  const question = 'A car travels 240 miles south in 3 hours. Find its velocity in mi/hr and m/s.';

  for (const conversionAnswer of ['35.7', '35.76', '35.8', '35.7632']) {
    const caseName = `${name}-${conversionAnswer.replace(/\W/g, '')}`;
    const harness = await createHarnessSession();
    const start = await sendHarnessMessage(harness, caseName, question);
    assert.equal(start.body.routeType, 'formula_tutor', `${caseName} should start formula tutor`);
    assert.equal(start.body.tutor.formulaId, 'speed_distance_time', `${caseName} formula id`);
    assert.equal(start.body.tutor.solveFor, 'velocity', `${caseName} solve target`);

    await sendHarnessMessage(harness, caseName, '1');
    await sendHarnessMessage(harness, caseName, '1');
    await sendHarnessMessage(harness, caseName, '240 miles');
    await sendHarnessMessage(harness, caseName, '3 hours');
    const conversionPrompt = await sendHarnessMessage(harness, caseName, '80');
    assert.equal(conversionPrompt.body.tutor.stepId, 'convert_velocity_to_mps', `${caseName} should ask for m/s conversion`);
    assert.match(conversionPrompt.body.response, /Convert 80 mi\/hr south to m\/s/i);

    const final = await sendHarnessMessage(harness, caseName, conversionAnswer);
    assert.equal(final.body.tutor.completed, true, `${caseName} should auto-complete from m/s answer`);
    assert.match(final.body.tutor.finalAnswerDisplay, /80 mi\/hr south and about 35\.76 m\/s south/i);
    assert.match(final.body.response, /80 mi\/hr south/i);
    assert.match(final.body.response, /35\.76 m\/s south/i);
    assert.doesNotMatch(final.body.tutor.work.calculatorCheck?.display || '', /80 × 0\.447 = 80/i);
    assert.match(final.body.tutor.work.calculatorCheck?.display || '', /80 × 0\.44704 = 35\.76/i);
  }
}

async function testAccelerationClassroomRoundedFinalAcceptance() {
  const choiceRun = await completeCarAdAccelerationAfterConversion('car-ad-choice-2', '2', '36000');
  assert.equal(choiceRun.body.tutor.completed, true, 'car ad should solve after choosing conversion choice 2');

  const decimalRun = await completeCarAdAccelerationAfterConversion('car-ad-decimal-conversion', '.001944', '36000');
  assert.equal(decimalRun.body.tutor.completed, true, 'car ad should solve after decimal conversion input');

  for (const answer of ['36842', '36,842', '36000']) {
    const final = await completeCarAdAccelerationWithEarlyFinalAnswer(`car-ad-early-${answer.replace(/\W/g, '')}`, answer);
    assert.equal(final.body.tutor.completed, true, `car ad should accept ${answer}`);
    assert.match(final.body.response, /36000 km\/hr²/i, `car ad final should show exact conversion answer for ${answer}`);
    assert.match(final.body.response, /36,842 km\/hr² using 0\.0019 hr/i, `car ad final should explain rounded path for ${answer}`);
  }

  const rejected = await rejectCarAdAccelerationAtConversion('car-ad-reject-small-time', '0.00277778');
  assert.equal(rejected.body.tutor.completed, false, 'car ad should not accept a time conversion value as final acceleration');
  assert.equal(rejected.body.tutor.stepId, 'convert_time', 'car ad should stay on conversion after bad early final answer');
  assert.match(rejected.body.response, /Not quite yet/i);
}

async function parkCarAdAccelerationAtConversion(name) {
  const harness = await createHarnessSession();
  const question =
    'A car advertisement claims that a certain car can accelerate from rest to 70 km/hr in 7 seconds (hint: convert to hours first!!) Find the car’s acceleration.';

  await sendHarnessMessage(harness, name, question);
  await sendHarnessMessage(harness, name, '1');
  await sendHarnessMessage(harness, name, '1');
  await sendHarnessMessage(harness, name, '0 km/hr');
  await sendHarnessMessage(harness, name, '70 km/hr');
  const conversionPrompt = await sendHarnessMessage(harness, name, '7');
  assert.equal(conversionPrompt.body.tutor.stepId, 'convert_time', `${name} should reach conversion step`);
  assert.match(conversionPrompt.body.response, /Which time value should we use before dividing\?/i);
  assert.match(conversionPrompt.body.response, /2\. 7 \/ 3600 hr ≈ 0\.001944 hr/i);
  return { harness, name };
}

async function completeCarAdAccelerationAfterConversion(name, conversionAnswer, finalAnswer) {
  const parked = await parkCarAdAccelerationAtConversion(name);
  const calculationPrompt = await sendHarnessMessage(parked.harness, parked.name, conversionAnswer);
  assert.equal(calculationPrompt.body.tutor.stepId, 'calculate', `${name} should reach final acceleration calculation`);
  return sendHarnessMessage(parked.harness, parked.name, finalAnswer);
}

async function completeCarAdAccelerationWithEarlyFinalAnswer(name, finalAnswer) {
  const parked = await parkCarAdAccelerationAtConversion(name);
  return sendHarnessMessage(parked.harness, parked.name, finalAnswer);
}

async function rejectCarAdAccelerationAtConversion(name, answer) {
  const parked = await parkCarAdAccelerationAtConversion(name);
  return sendHarnessMessage(parked.harness, parked.name, answer);
}

async function testInteractiveFlashcardUiMetadata() {
  const harness = await createHarnessSession();

  const start = await sendHarnessMessage(harness, 'flashcard-ui', 'start flashcards for types of friction');
  assert.equal(start.body.routeType, 'flashcard_session');
  assert.equal(start.body.flashcardSession.title, 'Types of friction');
  assert.equal(start.body.flashcardSession.front, 'What type of friction keeps objects from starting to slide?');
  assert.equal(start.body.flashcardSession.back, null);
  assert.deepEqual(start.body.flashcardSession.controls, ['show', 'next', 'stop']);

  const show = await sendHarnessMessage(harness, 'flashcard-ui', 'show');
  assert.equal(show.body.flashcardSession.showingBack, true);
  assert.equal(show.body.flashcardSession.back, 'Static Friction.');
  assert.deepEqual(show.body.flashcardSession.controls, ['again', 'next', 'stop']);

  await sendHarnessMessage(harness, 'flashcard-ui', 'next');
  await sendHarnessMessage(harness, 'flashcard-ui', 'next');
  const complete = await sendHarnessMessage(harness, 'flashcard-ui', 'next');
  assert.equal(complete.body.flashcardSession.active, false);
  assert.equal(complete.body.flashcardSession.isComplete, true);
  assert.equal(complete.body.flashcardSession.reviewedCount, 3);
  assert.deepEqual(complete.body.flashcardSession.controls, ['restart']);

  const staticCards = await sendHarnessMessage(harness, 'flashcard-static-ui', 'make flashcards for types of friction');
  assert.notEqual(staticCards.body.routeType, 'flashcard_session');
  assert.equal(staticCards.body.flashcardSession, undefined);
  assert.match(staticCards.body.response, /1\. Static Friction/i);
  assert.match(staticCards.body.response, /Answer: Friction that keeps an object from starting to move\./i);

  const motionGraphInteractive = await sendHarnessMessage(harness, 'flashcard-motion-graphs-ui', 'go through flashcards for motion graphs one at a time');
  assert.equal(motionGraphInteractive.body.routeType, 'flashcard_session');
  assert.equal(motionGraphInteractive.body.flashcardSession.title, 'Motion graphs');
  assert.deepEqual(motionGraphInteractive.body.flashcardSession.controls, ['show', 'next', 'stop']);
}

async function createHarnessSession() {
  const harness = createStudentRouteHarness({ studentGuidedFormulaTutoringEnabled: true });
  const create = await harness.request('POST', '/api/profile/create-student-session');
  assert.equal(create.statusCode, 201, 'focused tutor test should create student session');
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

Promise.resolve()
  .then(testGuidedFormulaTutorStartup)
  .then(testConceptualFormulaTutorChoices)
  .then(testMultipleChoiceNormalizationRegressions)
  .then(testSpecialDistanceDisplacementTutorRegressions)
  .then(testConcept3GeneralTutorVocabularyChoices)
  .then(testTwoUnitVelocityTutor)
  .then(testAccelerationClassroomRoundedFinalAcceptance)
  .then(testInteractiveFlashcardUiMetadata)
  .then(() => {
    console.log('student tutor UI: formula tutor turns group into collapsible problem sessions');
    console.log('student tutor UI: guided formula startup preserves direct-answer mode when disabled');
    console.log('student tutor UI: conceptual formula tutor steps show numbered choices immediately');
    console.log('student tutor UI: Concept 3 General Tutor vocab steps show numbered choices immediately');
    console.log('student tutor UI: velocity and acceleration tutor regressions passed');
    console.log('student tutor UI: interactive flashcard cards use backend session metadata');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
