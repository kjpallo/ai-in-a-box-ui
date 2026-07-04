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

const getFunctionBlock = (name) => {
  const start = studentUi.indexOf(`function ${name}(`);
  if (start < 0) return '';
  const next = studentUi.indexOf('\n  function ', start + 1);
  return next < 0 ? studentUi.slice(start) : studentUi.slice(start, next);
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
const sessionQuestionBlock = getCssBlock('.student-tutor-session-question');
const collapsedPanelBlock = getCssBlock('.student-tutor-session.is-collapsed .student-tutor-session-panel');
const sessionScrollBlock = getCssBlock('.student-tutor-session-scroll');
const sessionStepBlock = getCssBlock('.student-tutor-session-step');
const sessionSideAnswerStepBlock = getCssBlock('.student-tutor-session-step.has-side-answer');
const sessionCompactStepBlock = getCssBlock('.student-tutor-session-step-compact');
const tutorInstructionBlock = getCssBlock('.student-tutor-instruction');
const tutorInstructionPromptBlock = getCssBlock('.student-tutor-instruction-prompt');
const tutorHistoryRowBlock = getCssBlock('.student-tutor-history-row');
const tutorHistoryExpandedBlock = getCssBlock('.student-tutor-history-expanded');
const tutorJustAnsweredRowBlock = getCssBlock('.student-tutor-just-answered-row .student-tutor-history-row');
const tutorBodyBlock = getCssBlock('.student-tutor-body');
const tutorOriginalQuestionBlock = getCssBlock('.student-tutor-detail.student-tutor-original-question');
const tutorOriginalQuestionTextBlock = getCssBlock('.student-tutor-detail.student-tutor-original-question p');
const calculatorBlock = getCssBlock('.student-calculator');
const calculatorKeysBlock = getCssBlock('.student-calculator-keys');
const tutorControlBlock = getCssBlock('.student-tutor-control');
const tutorControlChoiceBlock = getCssBlock('.student-tutor-control--choice');
const tutorControlHelperBlock = getCssBlock('.student-tutor-control--helper');
const tutorControlWorkspaceBlock = getCssBlock('.student-tutor-control--workspace');
const tutorControlToolBlock = getCssBlock('.student-tutor-control--tool');
const tutorControlDangerBlock = getCssBlock('.student-tutor-control--danger');
const tutorAnswerControlsBlock = getCssBlock('.student-tutor-answer-controls');
const tutorChoicesBlock = getCssBlock('.student-tutor-choices');
const tutorChoiceButtonBlock = getCssBlock('.student-tutor-choice-button');
const tutorAnswerChipsBlock = getCssBlock('.student-tutor-answer-chips');
const tutorAnswerChipBlock = getCssBlock('.student-tutor-answer-chip');
const metricStairStepVisualBlock = getCssBlock('.metric-stair-step-visual');
const metricStairStepTrackBlock = getCssBlock('.metric-stair-step-track');
const metricStairStepButtonBlock = getCssBlock('.metric-stair-step-button');
const metricStairStepCurrentButtonBlock = getCssBlock('.metric-stair-step-button.is-current');
const metricStairStepPreviewButtonBlock = getCssBlock('.metric-stair-step-button.is-preview');
const metricStairStepControlBlock = getCssBlock('.metric-stair-step-control');
const metricStairStepCurrentDisplayBlock = getCssBlock('.metric-stair-step-current-display');
const picketFenceVisualBlock = getCssBlock('.picket-fence-visual');
const picketFenceCellBlock = getCssBlock('.picket-fence-cell');
const picketFenceCancelledBlock = getCssBlock('.picket-fence-cancelled');
const picketFenceControlBlock = getCssBlock('.picket-fence-control');
const picketFencePlaceholderBlock = getCssBlock('.picket-fence-placeholder');
const scientificNotationVisualBlock = getCssBlock('.scientific-notation-visual');
const scientificNotationNumberBlock = getCssBlock('.scientific-notation-number');
const scientificNotationDecimalBlock = getCssBlock('.scientific-notation-decimal');
const scientificNotationControlBlock = getCssBlock('.scientific-notation-control');
const scientificNotationMoveBlock = getCssBlock('.scientific-notation-move');
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
assert.match(tutorControlBlock, /cursor:\s*pointer;/, 'Shared Formula Tutor controls should inherit a common interactive base.');
assert.match(tutorControlChoiceBlock, /border-color:\s*rgba\(126,233,255,0\.52\);/, 'Choice controls should inherit the shared choice variant.');
assert.match(tutorControlHelperBlock, /border-color:\s*rgba\(255,214,102,0\.62\);/, 'Helper chips should inherit the shared helper variant.');
assert.match(tutorControlWorkspaceBlock, /border-color:\s*rgba\(126,233,255,0\.32\);/, 'Workspace controls should inherit the shared workspace variant.');
assert.match(tutorControlToolBlock, /border-color:\s*rgba\(126,233,255,0\.42\);/, 'Tutor tools should inherit the shared tool variant.');
assert.match(tutorControlDangerBlock, /border-color:\s*rgba\(255,150,126,0\.64\);/, 'Only truly destructive tutor tools should use the shared danger variant.');
assert.match(tutorAnswerControlsBlock, /display:\s*grid;/, 'Active Formula Tutor answer controls should render in one shared in-card zone.');
assert.match(tutorChoicesBlock, /align-items:\s*stretch;/, 'Formula Tutor choices inside work should render as primary controls.');
assert.match(tutorChoiceButtonBlock, /min-height:\s*40px;/, 'Formula Tutor choice buttons should be prominent.');
assert.match(tutorAnswerChipsBlock, /display:\s*flex;/, 'Formula Tutor answer chips should render as a compact chip row.');
assert.match(tutorAnswerChipsBlock, /rgba\(255,214,102,0\.36\)/, 'Formula Tutor answer chips should use a distinct helper-chip theme.');
assert.match(studentUi, /student-tutor-answer-chip-label[\s\S]*(Suggested answer:|Use given number:|Choose or type:)/, 'Formula Tutor answer chips should include a clear helper label.');
assert.match(tutorAnswerChipBlock, /border-radius:\s*999px;/, 'Formula Tutor answer chips should use compact pill controls.');
assert.match(tutorAnswerChipBlock, /linear-gradient\(180deg,\s*rgba\(109,72,8,0\.98\)/, 'Formula Tutor answer chips should not blend into normal tutor buttons.');
assert.ok(metricStairStepVisualBlock, 'Metric stair-step tutor visual should have a card style.');
assert.match(metricStairStepVisualBlock, /border-radius:\s*8px;/, 'Metric stair-step visual should stay compact inside Formula Tutor cards.');
assert.match(metricStairStepTrackBlock, /grid-template-columns:\s*repeat\(10,\s*minmax\(3rem,\s*1fr\)\);/, 'Metric stair-step visual should render ten stable stair positions.');
assert.match(metricStairStepTrackBlock, /align-items:\s*start;/, 'Metric stair-step visual should support a ladder-style stepped layout.');
assert.match(metricStairStepTrackBlock, /overflow-x:\s*auto;/, 'Metric stair-step visual should scroll horizontally on small screens.');
assert.match(metricStairStepButtonBlock, /min-height:\s*68px;/, 'Metric stair-step buttons should keep stable dimensions.');
assert.match(metricStairStepButtonBlock, /margin-top:\s*calc\(var\(--metric-step-offset,\s*0\) \* 0\.34rem\);/, 'Metric stair-step buttons should stagger into a staircase/ladder.');
assert.match(metricStairStepCurrentButtonBlock, /box-shadow:\s*inset 0 0 0 1px rgba\(102,247,209,0\.42\);/, 'Current metric stair step should be visibly marked.');
assert.match(metricStairStepPreviewButtonBlock, /box-shadow:\s*inset 0 0 0 1px rgba\(255,214,102,0\.34\);/, 'Previewed metric stair step should be visibly marked while hovering or focusing.');
assert.match(metricStairStepControlBlock, /min-height:\s*34px;/, 'Metric stair-step controls should be usable tap targets.');
assert.match(metricStairStepCurrentDisplayBlock, /background:\s*rgba\(255,214,102,0\.14\);/, 'Metric stair-step current value display should be visually separated from the ladder.');
assert.ok(picketFenceVisualBlock, 'Picket fence tutor visual should have a card style.');
assert.match(picketFenceVisualBlock, /border-radius:\s*8px;/, 'Picket fence visual should stay compact inside Formula Tutor cards.');
assert.match(picketFenceCellBlock, /min-width:\s*6\.8rem;/, 'Picket fence cells should keep stable dimensions.');
assert.match(picketFenceCancelledBlock, /text-decoration:\s*line-through;/, 'Picket fence visual should visibly mark cancelled units.');
assert.doesNotMatch(getCssBlock('.picket-fence-cancel-unit'), /text-decoration:\s*line-through/, 'Active picket-fence cancellation buttons should not look crossed out before the student clicks them.');
assert.match(getCssBlock('.picket-fence-cancellation-state'), /text-decoration:\s*line-through;/, 'Read-only canceled picket-fence state should use crossed-out styling after cancellation.');
assert.doesNotMatch(getCssBlock('.picket-fence-cancel-unit'), /255,150,126|84,33,26|39,15,16/, 'Picket fence cancellation buttons should not use danger/destructive styling.');
assert.match(picketFenceControlBlock, /min-height:\s*34px;/, 'Picket fence cancellation tap targets should be usable.');
assert.match(picketFencePlaceholderBlock, /font-style:\s*italic;/, 'Picket fence pending sections should render as explicit placeholders.');
assert.ok(scientificNotationVisualBlock, 'Scientific notation tutor visual should have a card style.');
assert.match(scientificNotationVisualBlock, /border-radius:\s*8px;/, 'Scientific notation visual should stay compact inside Formula Tutor cards.');
assert.match(scientificNotationNumberBlock, /font-family:\s*ui-monospace/, 'Scientific notation number should use a stable numeric font.');
assert.match(scientificNotationDecimalBlock, /box-shadow:\s*0 0 0 3px rgba\(102,247,209,0\.1\);/, 'Scientific notation decimal marker should be visibly highlighted.');
assert.match(scientificNotationControlBlock, /min-height:\s*34px;/, 'Scientific notation controls should be usable tap targets.');
assert.match(scientificNotationMoveBlock, /flex-wrap:\s*wrap;/, 'Scientific notation move summary should wrap on small screens.');
assert.ok(flashcardCardBlock, 'Interactive flashcards should have a compact card style.');
assert.match(flashcardCardBlock, /border-radius:\s*8px;/, 'Flashcard cards should stay compact in the chat timeline.');
assert.match(flashcardTitleBlock, /font-weight:\s*850;/, 'Flashcard card titles should be visually prominent.');
assert.match(flashcardProgressBlock, /text-transform:\s*uppercase;/, 'Flashcard card progress should scan like session metadata.');
assert.match(flashcardFrontBlock, /overflow-wrap:\s*anywhere;/, 'Flashcard fronts should wrap safely on small screens.');
assert.match(flashcardBackBlock, /font-weight:\s*760;/, 'Flashcard backs should read as the revealed answer.');
assert.match(flashcardActionsBlock, /flex-wrap:\s*wrap;/, 'Flashcard controls should wrap inside one-column chat.');
assert.match(flashcardActionBlock, /min-height:\s*38px;/, 'Flashcard action buttons should be easy tap targets.');

const overflowMatches = [...studentHtml.matchAll(/overflow-y:\s*auto;/g)];
assert.equal(overflowMatches.length, 3, 'Student page should expose timeline, formula-session, and original-question scoped scroll areas.');

assert.ok(sessionBlock, 'Formula tutor sessions should have a CSS rule.');
assert.match(sessionHeaderBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/, 'Session header should keep summary beside controls on desktop.');
assert.match(sessionPanelBlock, /transition:\s*max-height 220ms ease, opacity 180ms ease, visibility 180ms ease;/, 'Session panel should animate expand/collapse.');
assert.match(collapsedPanelBlock, /max-height:\s*0;/, 'Collapsed formula sessions should hide the panel.');
assert.match(collapsedPanelBlock, /visibility:\s*hidden;/, 'Collapsed formula sessions should remove hidden controls from focus.');
assert.match(sessionPanelBlock, /max-height:\s*min\(980px,\s*calc\(100dvh - 11rem\)\);/, 'Expanded formula sessions should grow with content before hitting a panel limit.');
assert.match(sessionQuestionBlock, /margin:\s*0\.44rem 0\.5rem 0\.46rem;/, 'Original Question should keep spacing before the active Formula Tutor instruction area.');
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
  /function renderTutorSession\(session, copyableTurnId\)[\s\S]*student-tutor-session-question[\s\S]*Original Question[\s\S]*student-tutor-session-scroll[\s\S]*student-tutor-session-steps/,
  'Expanded formula sessions should show the original question once at the problem level and render chronological steps inside the bounded scroll area.'
);
assert.match(
  studentUi,
  /function renderTutorSessionStep\(turn, options = \{\}\)[\s\S]*const instructionHtml = isFormulaTutor[\s\S]*renderTutorInstructionBlock[\s\S]*student-tutor-grid[\s\S]*!\s*isFormulaTutor \? renderTutorDetail\('Current Step'[\s\S]*showFormulaDetails[\s\S]*renderKnownValuesDetail[\s\S]*Calculator check[\s\S]*Final answer/,
  'Grouped Formula Tutor steps should use one instruction block and suppress duplicate Current Step detail rows while preserving optional formula work fields.'
);
assert.doesNotMatch(
  getFunctionBlock('renderTutorSessionStep'),
  /renderTutorDetail\('Original Question'/,
  'Grouped Formula Tutor steps should not repeat Original Question inside every step.'
);
assert.match(
  studentUi,
  /function renderTutorInstructionBlock\(\{ tutor, work, currentStep, responseText, stepStatus, isCurrentStep \}\)[\s\S]*formatTutorInstructionProgress\(tutor, work, stepStatus\)[\s\S]*getTutorFeedbackLine\(responseText, prompt\)[\s\S]*student-tutor-instruction-head[\s\S]*student-tutor-instruction-feedback[\s\S]*student-tutor-instruction-prompt[\s\S]*student-tutor-instruction-hint/,
  'Formula Tutor instruction block should own progress, compact feedback, current prompt, and hint display.'
);
assert.match(
  studentUi,
  /function renderTutorSessionStep\(turn, options = \{\}\)[\s\S]*if \(isFormulaTutor && !isCurrentStep\)[\s\S]*return renderCompactTutorSessionStep[\s\S]*renderJustAnsweredTutorSessionRow[\s\S]*isCurrentStep && isFormulaTutor \? renderFormulaVisualMetadata/,
  'Saved Formula Tutor history steps should render compactly, just-answered rows should appear before the active step, and only the active step should render the full visual workspace.'
);
assert.match(
  studentUi,
  /session\.turns\.map\(\(turn, index\) => renderTutorSessionStep\(turn,[\s\S]*previousTurn: index > 0 \? session\.turns\[index - 1\] : null/,
  'Grouped Formula Tutor rendering should pass the prior turn so saved rows can label the step that was just answered.'
);
assert.match(
  studentUi,
  /function renderCompactTutorSessionStep\(turn, context = \{\}\)[\s\S]*const submitted = getTutorSubmittedMessage\(turn, context\.stepIndex\)[\s\S]*const answeredStep = getAnsweredTutorStepContext[\s\S]*formatTutorInstructionProgress\(answeredStep\.tutor, answeredStep\.work[\s\S]*summarizeTutorStepPrompt\(answeredStep\.currentStep\)[\s\S]*student-tutor-session-step-compact[\s\S]*student-tutor-history-answer[\s\S]*student-tutor-history-final/,
  'Compact Formula Tutor history rows should pair student answers with the answered step, not the next prompt.'
);
assert.match(
  studentUi,
  /function renderJustAnsweredTutorSessionRow\(turn, context = \{\}\)[\s\S]*getTutorSubmittedMessage\(turn, context\.stepIndex\)[\s\S]*doesSubmittedAnswerBelongToAnsweredFormulaStep\(context\)[\s\S]*if \(tutor\.completed === true \|\| work\.isComplete === true\) return '';[\s\S]*getAnsweredTutorStepContext\(turn,[\s\S]*formatTutorInstructionProgress\(answeredStep\.tutor, answeredStep\.work, 'Saved'\)[\s\S]*summarizeTutorStepPrompt\(answeredStep\.currentStep\)[\s\S]*student-tutor-just-answered-row[\s\S]*Student answer:/,
  'Correct active Formula Tutor advancement should render the just-answered step as a compact row before the new prompt.'
);
assert.match(
  studentUi,
  /function getAnsweredTutorStepContext\(turn, context = \{\}\)[\s\S]*if \(!context\.submitted\) return fallback;[\s\S]*previousTurn\?\.tutor[\s\S]*return \{[\s\S]*tutor: previousTutor,[\s\S]*work: previousWork,[\s\S]*currentStep: getCurrentTutorPrompt\(previousTutor, previousWork\)/,
  'Answered-step context should use the prior tutor turn for submitted answers and stay on the current step for unanswered/wrong-state rows.'
);
assert.match(
  getFunctionBlock('summarizeTutorStepPrompt'),
  /Method choice[\s\S]*Given number[\s\S]*Top number[\s\S]*Bottom number[\s\S]*Canceling unit[\s\S]*Final number/,
  'Compact history labels should cover method choice, given number, top number, bottom number, canceling unit, and final number steps.'
);
assert.match(
  studentUi,
  /function renderCompactTutorSessionStep\(turn, context = \{\}\)[\s\S]*tutorStepExpandedState\.get\(turn\.id\)[\s\S]*data-toggle-tutor-step-id="\$\{escapeAttr\(turn\.id\)\}"[\s\S]*aria-expanded="\$\{expanded \? 'true' : 'false'\}"[\s\S]*renderTutorStepReviewDetails/,
  'Compact saved Formula Tutor rows should be independently expandable by tutor turn id.'
);
assert.doesNotMatch(
  getFunctionBlock('renderCompactTutorSessionStep'),
  /renderFormulaVisualMetadata|picket-fence-visual|metric-stair-step-visual|renderTutorDetail\('Hint'|data-tutor-choice|data-tutor-answer-chip|data-calculator-key|data-tutor-action|data-picket-fence-cancel-answer|data-metric-stair-step-index/,
  'Compact saved Formula Tutor rows should not render full visual workspaces or active command controls.'
);
assert.match(
  studentUi,
  /function renderTutorStepReviewDetails\(turn, context = \{\}\)[\s\S]*\['Prompt'[\s\S]*\['Feedback'[\s\S]*\['Student answer'[\s\S]*\['Hint'[\s\S]*\['Formula'[\s\S]*\['Known values'[\s\S]*\['Calculator check'[\s\S]*student-tutor-history-expanded[\s\S]*student-tutor-history-detail/,
  'Expanded saved Formula Tutor rows should render review-only structured details.'
);
assert.doesNotMatch(
  getFunctionBlock('renderTutorStepReviewDetails'),
  /data-tutor-choice|data-tutor-answer-chip|data-calculator-key|data-tutor-action|data-picket-fence-cancel-answer|data-metric-stair-step-index|renderFormulaVisualMetadata/,
  'Expanded saved Formula Tutor review details should not expose live tutor command controls.'
);
assert.match(
  studentUi,
  /function formatTutorInstructionProgress\(tutor, work = \{\}, stepStatus = ''\)[\s\S]*stepId === 'choose_method'[\s\S]*return 'Choose method'[\s\S]*formatTutorProgress/,
  'Branch-selection steps should display as Choose method instead of a confusing Step 1 of 1 label.'
);
assert.match(
  studentUi,
  /const tutorStepExpandedState = new Map\(\);/,
  'Saved Formula Tutor row expansion should use independent step-level state.'
);
assert.match(
  studentUi,
  /function toggleTutorStepReview\(turnId\)[\s\S]*tutorStepExpandedState\.set\(turnId, tutorStepExpandedState\.get\(turnId\) !== true\)[\s\S]*renderTimeline\(\)/,
  'Saved Formula Tutor row toggles should be independent from whole-session collapse state.'
);
assert.match(
  studentUi,
  /function compactTutorFeedback\(response, currentPrompt = ''\)[\s\S]*step\\s\+\\d\+\\s\+of\\s\+\\d\+[\s\S]*line !== prompt[\s\S]*lines\.slice\(0, 2\)\.join\(' '\)/,
  'Wrong-answer feedback should remove repeated Step X of Y and current prompt text before display.'
);
assert.match(
  studentUi,
  /function renderTutorSessionStep\(turn, options = \{\}\)[\s\S]*renderTutorAnswerControls\(tutor, work\)[\s\S]*renderFormulaVisualMetadata/,
  'Active Formula Tutor answer controls should render in the card before the workspace visual.'
);
assert.match(
  studentUi,
  /function renderFormulaVisualMetadata\(visual, turnId, context = \{\}\)[\s\S]*currentStep\?\.id === 'choose_method'[\s\S]*return '';[\s\S]*isComplete === true[\s\S]*selectedMethod === 'stair_step'[\s\S]*return '';[\s\S]*visual\.visualType === 'metric_stair_step'[\s\S]*renderMetricStairStepVisual\(visual, turnId, context\)[\s\S]*visual\.visualType === 'picket_fence'[\s\S]*renderPicketFenceVisual\(visual, turnId, context\)[\s\S]*visual\.visualType === 'scientific_notation_decimal_move'[\s\S]*renderScientificNotationVisual\(visual, turnId\)/,
  'Formula Tutor visual metadata should hide method visuals before method selection, keep completed stair-step turns compact, and route selected visuals to renderers.'
);
assert.match(
  studentUi,
  /function shouldShowFormulaStepDetails\(work = \{\}\)[\s\S]*isComplete === true[\s\S]*selectedMethod === 'stair_step'[\s\S]*return false[\s\S]*isComplete === true[\s\S]*isUnit1ConversionVisual/,
  'Completed Unit 1 conversion visual turns should suppress bulky formula detail rows.'
);
assert.match(
  studentUi,
  /function renderMetricStairStepVisual\(visual, turnId, context = \{\}\)[\s\S]*metricStairStepPreviewState[\s\S]*const previewIndex[\s\S]*getMetricStairStepValue\(visual, displayStep, previewIndex\)[\s\S]*const completed = context\?\.tutor\?\.completed[\s\S]*Metric stair-step[\s\S]*metric-stair-step-status-panel[\s\S]*metric-stair-step-current-display[\s\S]*Current[\s\S]*metric-stair-step-ladder[\s\S]*data-metric-stair-step-move="decimal-left"[\s\S]*Move decimal left[\s\S]*data-metric-stair-step-move="decimal-right"[\s\S]*Move decimal right[\s\S]*Preview: hover over a step to see the value change[\s\S]*Click or tap the target unit to check it[\s\S]*Answer appears when the marker reaches/,
  'Metric stair-step renderer should show title, central live preview current value display, ladder structure, decimal movement controls, helper text, and hide the answer until target completion.'
);
assert.match(
  studentUi,
  /function renderMetricStairStepVisual\(visual, turnId, context = \{\}\)[\s\S]*metric-stair-step-control student-tutor-control student-tutor-control--workspace[\s\S]*data-metric-stair-step-move="decimal-left"[\s\S]*metric-stair-step-control student-tutor-control student-tutor-control--workspace[\s\S]*data-metric-stair-step-move="decimal-right"/,
  'Metric stair-step movement controls should inherit shared workspace control styling.'
);
assert.match(
  studentUi,
  /function getMetricStairStepValue\(visual, step, index\)[\s\S]*visual\?\.stepValues[\s\S]*return values\.find/,
  'Metric stair-step renderer should read current values from per-step visual metadata as the marker moves.'
);
assert.match(
  studentUi,
  /function renderMetricStairStepButton\(step, index, context\)[\s\S]*'metric-stair-step-button',[\s\S]*'student-tutor-control',[\s\S]*'student-tutor-control--workspace'[\s\S]*Start[\s\S]*Target[\s\S]*data-metric-stair-step-index="\$\{escapeAttr\(index\)\}"[\s\S]*--metric-step-offset:/,
  'Metric stair-step buttons should expose clickable stair labels with start/target badges, stagger offsets, and shared workspace control styling.'
);
assert.match(
  studentUi,
  /function handleTimelineClick\(event\)[\s\S]*data-metric-stair-step-index[\s\S]*handleMetricStairStepClick\(metricStairStepControl\)/,
  'Metric stair-step controls should be handled by the timeline click pipeline.'
);
assert.match(
  studentUi,
  /function handleMetricStairStepClick\(control\)[\s\S]*const clampedIndex = clampMetricStepIndex\(nextIndex, steps\)[\s\S]*metricStairStepState\.set\(stateKey, clampedIndex\)[\s\S]*renderTimeline\(\)/,
  'Metric stair-step controls should update local marker state and rerender the visual.'
);
assert.match(
  studentUi,
  /function handleTimelinePreview\(event\)[\s\S]*data-metric-stair-step-index[\s\S]*metricStairStepPreviewState\.set\(stateKey, previewIndex\)[\s\S]*updateMetricStairStepPreviewInPlace\(stateKey, visual, previewIndex\)/,
  'Metric stair-step hover/focus preview should update the stationary current value display in place.'
);
assert.match(
  studentUi,
  /function handleTimelinePreviewClear\(event\)[\s\S]*metric-stair-step-visual[\s\S]*metricStairStepPreviewState\.delete\(stateKey\)[\s\S]*updateMetricStairStepPreviewInPlace/,
  'Metric stair-step preview should reset in place when leaving the ladder visual.'
);
assert.doesNotMatch(
  getFunctionBlock('handleTimelinePreview'),
  /renderTimeline\(\)/,
  'Metric stair-step hover/focus preview should not rerender the whole timeline.'
);
assert.doesNotMatch(
  getFunctionBlock('handleTimelinePreviewClear'),
  /renderTimeline\(\)/,
  'Metric stair-step preview clear should not rerender the whole timeline.'
);
assert.match(
  studentUi,
  /function updateMetricStairStepPreviewInPlace\(stateKey, visual, previewIndex\)[\s\S]*data-metric-stair-step-current-value[\s\S]*classList\.toggle\('is-preview'/,
  'Metric stair-step in-place preview should update the Current display and marker preview class.'
);
assert.match(
  studentUi,
  /function shouldAutoCompleteMetricStairStep\(control, visual, stateKey, currentIndex, targetIndex\)[\s\S]*currentIndex !== targetIndex[\s\S]*selectedMethod === 'stair_step'[\s\S]*move_marker_to_target/,
  'Metric stair-step visual should complete only when the live stair-step marker reaches the target unit.'
);
assert.match(
  studentUi,
  /sendTutorCommand\(getMetricStairStepCompletionAnswer\(visual\)\)/,
  'Metric stair-step visual should submit the final answer through the normal tutor command path.'
);
assert.match(
  studentUi,
  /function metricUnitForStep\(step, baseUnit\)[\s\S]*if \(label === 'UNIT'\) return base;[\s\S]*return `\$\{label\}\$\{base\}`;/,
  'Metric stair-step labels should combine prefixes with the problem base unit.'
);
assert.match(
  studentUi,
  /function renderPicketFenceVisual\(visual, turnId, context = \{\}\)[\s\S]*buildPicketFenceFillContext\(visual, context, progress\)[\s\S]*cancellationStepActive = isPicketFenceCancellationStep\(context\)[\s\S]*getPicketFenceHelperText\(visual[\s\S]*Picket fence method[\s\S]*Target:[\s\S]*Start:[\s\S]*Goal:[\s\S]*Answer:[\s\S]*renderPicketFenceCancellations\(cancellations/,
  'Picket fence renderer should show title, Start/Goal/Answer summary, gated helper text, gated cancellations, and an answer slot that stays hidden until completion.'
);
assert.match(
  studentUi,
  /function renderPicketFenceCancellations\(cancellations, state = \{\}\)[\s\S]*if \(state\.cancellationStepActive\)[\s\S]*picket-fence-cancel-unit student-tutor-control student-tutor-control--workspace[\s\S]*data-picket-fence-cancel-answer="\$\{escapeAttr\(step\.unit \|\| ''\)\}"[\s\S]*Cancel matching \$\{escapeHtml\(step\.unit \|\| ''\)\}[\s\S]*if \(state\.cancellationFilled\)[\s\S]*picket-fence-cancellation-state[\s\S]*canceled[\s\S]*return '';/,
  'Picket fence cancellation controls should render only on the cancellation step, then become read-only canceled state.'
);
assert.match(
  studentUi,
  /function isPicketFenceCancellationStep\(context = \{\}\)[\s\S]*stepId\.includes\('cancel'\)[\s\S]*unit[\s\S]*cancel/,
  'Picket fence cancellation controls should be gated by the active cancellation step.'
);
assert.match(
  studentUi,
  /function getPicketFenceHelperText\(visual, state = \{\}\)[\s\S]*Click the matching[\s\S]*units to cancel them[\s\S]*cancels with[\s\S]*remains[\s\S]*Fill the fence from left to right/,
  'Picket fence helper text should only mention cancellation during or after the cancellation step.'
);
assert.doesNotMatch(
  getFunctionBlock('renderPicketFenceVisual'),
  /given value \+ unit/,
  'Picket fence summary should not expose raw placeholder wording like given value + unit.'
);
assert.match(
  studentUi,
  /function renderPicketFenceCell\(cell, index, context\)[\s\S]*isGivenCell \? 'enter given value' : 'top number'[\s\S]*'bottom number'[\s\S]*isGivenCell \? 'Start' : '&times;'/,
  'Picket fence cells should use clearer Start, top number, and bottom number wording.'
);
assert.match(
  studentUi,
  /function renderPicketFenceCell\(cell, index, context\)[\s\S]*renderPicketFenceTerm\(cell\?\.numerator[\s\S]*<div[\s\S]*picket-fence-fraction[\s\S]*<\/div>/,
  'Picket fence cells should render as display cells, not separate clickable reveal controls.'
);
assert.match(
  studentUi,
  /function renderPicketFenceTerm\(value, visual, options = \{\}\)[\s\S]*picket-fence-placeholder[\s\S]*options\.cancelledUnitsRevealed[\s\S]*picket-fence-cancelled[\s\S]*picket-fence-final-unit/,
  'Picket fence terms should show pending placeholders, mark cancelled units only after cancellation, and leave final units uncancelled.'
);
assert.match(
  studentUi,
  /function isPicketFenceSectionFilled\(section, fillContext = \{\}\)[\s\S]*completedSteps[\s\S]*unlockAfterStepIds/,
  'Picket fence fillable sections should be tied to completed Formula Tutor steps.'
);
assert.doesNotMatch(
  studentUi,
  /data-picket-fence-action="next"|data-picket-fence-action="reset"|data-picket-fence-cell="\$\{escapeAttr\(index\)\}"/,
  'Picket fence visual should fill from typed tutor answers instead of local reveal controls.'
);
assert.match(
  studentUi,
  /function handleTimelineClick\(event\)[\s\S]*data-picket-fence-cancel-answer[\s\S]*sendTutorCommand\(picketFenceCancelAnswer\.getAttribute\('data-picket-fence-cancel-answer'\)/,
  'Picket fence cancellation buttons should submit the known cancelling unit through the normal tutor command path.'
);
assert.match(
  studentUi,
  /function renderTutorAnswerControls\(tutor, work = \{\}\)[\s\S]*student-tutor-answer-controls[\s\S]*renderTutorChoiceButtons[\s\S]*renderTutorAnswerChips/,
  'Choices and quick chips should share one active answer-control zone.'
);
assert.match(
  studentUi,
  /function renderTutorAnswerChips\(tutor, work = \{\}\)[\s\S]*singleChip[\s\S]*getSingleAnswerChipLabel[\s\S]*student-tutor-answer-chips[\s\S]*student-tutor-answer-chip student-tutor-control student-tutor-control--helper[\s\S]*data-tutor-answer-chip/,
  'Picket fence fill-in steps should render labeled bounded answer chips that submit through tutor commands.'
);
assert.match(
  studentUi,
  /function getSingleAnswerChipLabel\(work = \{\}, chip = \{\}\)[\s\S]*given number[\s\S]*Use given number:[\s\S]*Suggested answer:/,
  'Single quick-choice chips should use explicit suggested-answer wording.'
);
assert.match(
  studentUi,
  /function handleTimelineClick\(event\)[\s\S]*data-tutor-answer-chip[\s\S]*sendTutorCommand\(tutorAnswerChip\.getAttribute\('data-tutor-answer-chip'\)/,
  'Answer chip clicks should use the same tutor command path as typed answers.'
);
assert.match(
  studentUi,
  /function renderScientificNotationVisual\(visual, turnId\)[\s\S]*visual\.decimalMove[\s\S]*Scientific notation decimal mover[\s\S]*Final result:[\s\S]*data-scientific-notation-action="left"[\s\S]*data-scientific-notation-action="right"[\s\S]*data-scientific-notation-action="next"[\s\S]*data-scientific-notation-action="reset"/,
  'Scientific notation renderer should show title, decimal move details, local controls, and final result.'
);
assert.match(
  studentUi,
  /function renderScientificNotationVisual\(visual, turnId\)[\s\S]*scientific-notation-control student-tutor-control student-tutor-control--workspace[\s\S]*data-scientific-notation-action="left"[\s\S]*scientific-notation-control student-tutor-control student-tutor-control--workspace[\s\S]*data-scientific-notation-action="reset"/,
  'Scientific notation local controls should inherit shared workspace control styling.'
);
assert.match(
  studentUi,
  /function renderScientificNotationNumber\(value\)[\s\S]*scientific-notation-decimal/,
  'Scientific notation renderer should mark the current decimal position.'
);
assert.match(
  studentUi,
  /function handleTimelineClick\(event\)[\s\S]*data-scientific-notation-action[\s\S]*handleScientificNotationVisualClick\(scientificNotationControl\)/,
  'Scientific notation controls should be handled by the timeline click pipeline.'
);
assert.match(
  studentUi,
  /function handleScientificNotationVisualClick\(control\)[\s\S]*scientificNotationState\.set\(stateKey, clampScientificNotationSignedMoves\(nextSignedMoves, finalSignedMoves\)\)[\s\S]*renderTimeline\(\)/,
  'Scientific notation controls should update local decimal state and rerender the visual.'
);
assert.match(
  studentUi,
  /function renderTutorCardHtml\(turn\)[\s\S]*const originalQuestion = work\.originalQuestion \|\| tutor\.originalQuestion \|\| '';[\s\S]*renderTutorDetail\('Original Question', originalQuestion, 'student-tutor-original-question is-wide'\)[\s\S]*renderTutorDetail\('Current Step', currentStep/,
  'Active tutor cards should show original question context above the current step for formula and concept tutors.'
);
assert.match(
  studentUi,
  /function renderTutorSessionStep\(turn, options = \{\}\)[\s\S]*renderTutorSessionAnswer\(turn, \{[\s\S]*stepIndex: options\.stepIndex,[\s\S]*isCurrentStep,[\s\S]*isFormulaTutor,[\s\S]*responseText[\s\S]*\}\)/,
  'Active Formula Tutor answer display should receive current-step context before rendering side answers.'
);
assert.match(
  studentUi,
  /function renderTutorSessionAnswer\(turn, context = \{\}\)[\s\S]*getTutorSubmittedMessage\(turn, context\.stepIndex\)[\s\S]*shouldRenderTutorSessionAnswer\(message, context\)/,
  'Student answer side panels should use a display guard before rendering submitted tutor messages.'
);
assert.match(
  studentUi,
  /function shouldRenderTutorSessionAnswer\(message, context = \{\}\)[\s\S]*context\.isFormulaTutor && context\.isCurrentStep && doesSubmittedAnswerBelongToAnsweredFormulaStep\(context\)[\s\S]*return false;[\s\S]*return true;/,
  'Active Formula Tutor steps should not show the previous correct answer beside the next prompt.'
);
assert.match(
  studentUi,
  /function doesSubmittedAnswerBelongToAnsweredFormulaStep\(context = \{\}\)[\s\S]*if \(!\/\^correct\\b\/i\.test\(responseText\)\) return false;[\s\S]*tutor\.completed === true \|\| work\.isComplete === true[\s\S]*return tutor\.active === true;/,
  'Only correct advancement/completion responses should suppress stale active side answers; wrong-answer retries should keep the submitted answer visible.'
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
  /function renderTutorActions\(turn, tutor, options = \{\}\)[\s\S]*options\.hideCompletedAction[\s\S]*student-tutor-control--tool[\s\S]*data-tutor-action="hint"[\s\S]*student-tutor-control--tool[\s\S]*data-tutor-action="restart"[\s\S]*student-tutor-control--tool student-tutor-control--danger[\s\S]*data-tutor-action="stop"/,
  'Hint, Restart, and Stop controls should remain available for the active step with Stop as the only danger-styled tutor action.'
);
assert.match(
  studentUi,
  /function renderCalculatorArea\(turnId, showCalculator\)[\s\S]*student-calculator-toggle student-tutor-control student-tutor-control--tool[\s\S]*data-calculator-toggle-id/,
  'Calculator toggle should inherit shared tool control styling.'
);
assert.match(
  studentUi,
  /function renderCalculatorHtml\(\)[\s\S]*student-calculator-button student-tutor-control student-tutor-control--tool[\s\S]*data-calculator-key="7"[\s\S]*student-calculator-use-result student-tutor-control student-tutor-control--tool/,
  'Calculator keys and Use result should inherit shared tool control styling while preserving calculator data attributes.'
);
assert.match(
  studentUi,
  /function renderTutorChoiceButtons\(tutor, work = \{\}\)[\s\S]*student-tutor-choice-button student-tutor-control student-tutor-control--choice[\s\S]*data-tutor-choice="\$\{escapeAttr\(choice\.number\)\}"[\s\S]*\$\{escapeHtml\(`\$\{choice\.number\}\. \$\{choice\.label\}`\)\}/,
  'Formula tutor choices should render as clickable numbered buttons with shared choice control styling.'
);
assert.match(
  studentUi,
  /function getTutorBaseTitle\(tutor, work = \{\}\)[\s\S]*category === 'formula'[\s\S]*'Formula Tutor'[\s\S]*category === 'concept'[\s\S]*'Concept Tutor'[\s\S]*category === 'general'[\s\S]*'General Tutor'[\s\S]*return label \|\| 'Tutor';/,
  'Tutor card titles should distinguish formula, concept, and general tutors.'
);
assert.match(
  studentUi,
  /const tutorChoiceButton = event\.target\.closest\('\[data-tutor-choice\]'\);[\s\S]*if \(!isLiveTutorControl\(tutorChoiceButton\)\) return;[\s\S]*sendTutorCommand\(tutorChoiceButton\.getAttribute\('data-tutor-choice'\) \|\| ''\)/,
  'Choice buttons should submit the numeric choice value.'
);
assert.match(
  studentUi,
  /function updateComposerTutorChoices\(\)[\s\S]*shouldRenderChoicesInTutorCard\(activeChoiceState\?\.tutor, activeChoiceState\?\.work\)[\s\S]*composerTutorChoices\.hidden = true[\s\S]*class="student-composer-choice-button student-tutor-control student-tutor-control--choice"[\s\S]*data-tutor-choice="\$\{escapeAttr\(choice\.number\)\}"/,
  'Formula Tutor choices should render in-card while preserving composer choice markup as a fallback.'
);
assert.match(
  studentUi,
  /function shouldRenderInlineTutorChoices\(tutor = \{\}, work = \{\}\)[\s\S]*getCurrentTutorChoices\(tutor, work\)[\s\S]*isStructuredFormulaTutor\(tutor, work\)[\s\S]*return true[\s\S]*suppressInlineChoices/,
  'Formula Tutor method-choice steps should render choices in the active card even when composer duplicate choices are suppressed.'
);
assert.match(
  studentUi,
  /function shouldRenderChoicesInTutorCard\(tutor = \{\}, work = \{\}\)[\s\S]*isStructuredFormulaTutor\(tutor, work\) && shouldRenderInlineTutorChoices\(tutor, work\)/,
  'Composer choices should hide when structured Formula Tutor choices are rendered inside the card.'
);
assert.match(
  studentUi,
  /function updateInputPlaceholder\(hasChoiceStep\)[\s\S]*input\.placeholder = hasChoiceStep \? 'Type choice number only' : defaultInputPlaceholder;/,
  'Input placeholder should switch on multiple-choice tutor steps.'
);
assert.match(
  studentUi,
  /function handleComposerTutorChoiceClick\(event\)[\s\S]*const choiceNumber = tutorChoiceButton\.getAttribute\('data-tutor-choice'\) \|\| '';[\s\S]*if \(!isActiveTutorChoiceNumber\(choiceNumber\)\) return;[\s\S]*sendTutorCommand\(choiceNumber\)/,
  'Composer choice buttons should submit only the current active numeric choice value.'
);
assert.match(
  studentUi,
  /function getCurrentActiveTutorTurn\(\)[\s\S]*const latestTurn = chatTurns\[chatTurns\.length - 1\][\s\S]*tutor\.active !== true \|\| tutor\.completed \|\| tutor\.stopped[\s\S]*return latestTurn;/,
  'Only the latest completed interaction should be treated as the active tutor turn.'
);
assert.match(
  studentUi,
  /function getActiveTutorChoiceState\(\)[\s\S]*const activeTurn = getCurrentActiveTutorTurn\(\)[\s\S]*return choices\.length > 0 \? \{ tutor, work, choices \} : null;/,
  'Composer choices should clear after tutor completion, tutor stop, pending turns, or normal non-tutor responses.'
);
assert.match(
  studentUi,
  /function buildTimelineItems\(\)[\s\S]*activeTutorSessionKey = getTutorSessionKey\(getCurrentActiveTutorTurn\(\)\)[\s\S]*session\.isActive = Boolean\(activeTutorSessionKey && session\.key === activeTutorSessionKey\);/,
  'Grouped formula session controls should only remain live for the current active tutor session.'
);
assert.match(
  studentUi,
  /function isLiveTutorControl\(control\)[\s\S]*closest\?\.\('\[data-tutor-turn-id\]'\)[\s\S]*getCurrentActiveTutorTurn\(\)\?\.id === turnId/,
  'Old tutor transcript controls should be blocked from submitting stale tutor commands.'
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
  /function handleTimelineClick\(event\)[\s\S]*data-toggle-tutor-step-id[\s\S]*toggleTutorStepReview[\s\S]*data-metric-stair-step-index/,
  'Saved Formula Tutor row toggles should be handled before live workspace controls.'
);

assert.match(sessionQuestionBlock, /border:\s*1px solid rgba\(255,214,102,0\.3\);/, 'Formula tutor sessions should show one compact problem-level Original Question block.');
assert.match(sessionCompactStepBlock, /padding:\s*0\.36rem 0\.44rem;/, 'Saved Formula Tutor steps should use compact history-row spacing.');
assert.match(studentHtml, /\.student-tutor-history-row,\s*\.student-tutor-history-final\s*\{[\s\S]*flex-wrap:\s*wrap;/, 'Saved Formula Tutor history rows should keep progress, feedback, prompt, and answer compact.');
assert.match(tutorHistoryRowBlock, /cursor:\s*pointer;/, 'Saved Formula Tutor history rows should look tappable/clickable.');
assert.match(tutorJustAnsweredRowBlock, /cursor:\s*default;/, 'Just-answered Formula Tutor rows should read as passive summaries, not expandable controls.');
assert.match(tutorHistoryExpandedBlock, /display:\s*grid;/, 'Expanded saved Formula Tutor review details should render in a structured panel.');
assert.match(tutorInstructionBlock, /display:\s*grid;/, 'Formula Tutor instruction block should be a compact shared prompt region.');
assert.match(tutorInstructionPromptBlock, /font-weight:\s*760;/, 'Formula Tutor active prompt should be prominent in the instruction block.');

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
assert.match(
  studentUi,
  /function getTutorSessionKey\(turn\)[\s\S]*tutorProblemId[\s\S]*if \(tutorProblemId\) return \['formula-session', tutorProblemId\]\.join\('\|'\);[\s\S]*originalQuestion[\s\S]*formulaId[\s\S]*solveFor[\s\S]*return \['formula-session', originalQuestion, formulaId, solveFor\]\.join\('\|'\)/,
  'Formula tutor session grouping should prefer unique tutor problem ids and fall back to original question, formula, and solve-for target for old turns.'
);

assert.match(tutorBodyBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\);/, 'Non-formula tutor cards should stay in one timeline column without reserving a blank side panel.');
assert.match(tutorOriginalQuestionBlock, /align-items:\s*start;/, 'Original Question labels should stay aligned with compact scrollable text.');
assert.match(tutorOriginalQuestionTextBlock, /max-height:\s*4\.8rem;/, 'Original Question text should stay compact when a long pasted prompt is shown.');
assert.match(tutorOriginalQuestionTextBlock, /overflow-y:\s*auto;/, 'Original Question text should scroll internally instead of stretching the tutor card.');
assert.match(tutorOriginalQuestionTextBlock, /overscroll-behavior:\s*contain;/, 'Original Question scrolling should not fight the main timeline scroll.');
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
      steps: ['1', '1', '0', '70', '19.4444', '7', '2.78']
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
      name: 'patch-3-net-force-acceleration-leading-dot',
      question: 'A 2 N and an 8 N force pull on an object to the right and a 4 N force pulls on the object to the left. If the object has a mass of .5 kg what is its acceleration?',
      formulaId: 'net_force_newton_second_law',
      solveFor: 'acceleration',
      formula: 'a = Fnet / m',
      finalAnswer: /acceleration = 12 m\/s² right/i,
      directAnswer: /The acceleration is 12 m\/s² right/i,
      steps: ['2', '6', '1', '.5 kg', '12']
    },
    {
      name: 'patch-3-boulder-weight-force',
      question: 'If a 53 kg boulder falls off a cliff, what is the force with which it will hit the ground?',
      formulaId: 'weight_mass_gravity',
      solveFor: 'weight',
      formula: 'Fg = m × g',
      finalAnswer: /weight = 519\.4 N/i,
      directAnswer: /Fg = 519\.4 N downward/i,
      steps: ['1', '1', '53 kg', '9.8 m/s²', '519.4']
    },
    {
      name: 'patch-3-runner-velocity-change-force',
      question: 'A runner has a speed of 25 m/s. They see the finish line and speed up to 30 m/s. This happens in 5 seconds. If the runner has a mass of 75 kg, with what force did the runner cross the finish line? Show all work to receive full credit.',
      formulaId: 'force_from_velocity_change',
      solveFor: 'force',
      formula: 'a = (vf - vi) / t, then F = m × a',
      finalAnswer: /force = 75 N/i,
      directAnswer: /F = 75 N/i,
      steps: ['1', '1', '25 m/s', '30 m/s', '5 s', '1', '1', '75 kg', '75']
    },
    {
      name: 'patch-3-truck-mass-momentum-comma',
      question: 'What is the mass of a truck that has a momentum of 10,000 kg*m/s and a velocity of 4 m/s North?',
      formulaId: 'momentum_mass_velocity',
      solveFor: 'mass',
      formula: 'm = p / v',
      finalAnswer: /mass = 2500 kg/i,
      directAnswer: /m = 2500 kg/i,
      steps: ['2', '1', '10000', '4 m/s', '2500']
    },
    {
      name: 'patch-3-collision-momentum-transfer',
      question: 'In a collision, a 25 kg ball moving at 3 m/s transfers all of its momentum to a 5 kg ball. What is the velocity of the 5 kg ball after the collision?',
      formulaId: 'momentum_transfer_velocity',
      solveFor: 'velocity',
      formula: 'p = m × v, then v = p / m',
      finalAnswer: /velocity = 15 m\/s forward/i,
      directAnswer: /v = 15 m\/s forward/i,
      steps: ['1', '1', '25 kg', '3 m/s', '75', '1', '5 kg', '15']
    },
    {
      name: 'patch-3-bike-force-final-momentum',
      question: 'A man and his bike are 95 kg. His instantaneous speed at one point is 14m/s. The next time his speed is checked he is going 28m/s. If the second speed was taken 7 seconds later, what force must the man have given his bike to change the speed? What was the bicyclist\'s final momentum?',
      formulaId: 'force_and_final_momentum',
      solveFor: 'force',
      formula: 'a = (vf - vi) / t, then F = m × a',
      finalAnswer: /Force = 190 N[\s\S]*Final momentum = 2660 kg·m\/s/i,
      directAnswer: /F = 190 N[\s\S]*p = 2660 kg·m\/s/i,
      steps: ['1', '1', '14 m/s', '28 m/s', '7 s', '2', '1', '95 kg', '190']
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

async function testPatch4NetForceOnlyDirectAnswerWithTutorOn() {
  const harness = await createHarnessSession();
  const question = 'An object has 16 N of force being applied to the right, 16 N of force being applied to the left, and 4 N of force being applied downward. What is the net force on the object?';
  const direct = await sendHarnessMessage(harness, 'patch-4-net-force-direct', question);

  assert.equal(direct.body.routeType, 'science_formula', 'net-force-only prompt should stay a formula answer');
  assert.ok(!direct.body.tutor, 'net-force-only prompt should not start Formula Tutor with an open-ended first step');
  assert.match(direct.body.response, /16 N right and 16 N left cancel out/i);
  assert.match(direct.body.response, /net force is 4 N downward/i);
  assert.doesNotMatch(direct.body.response, /← 4 N downward/i);
  assert.match(direct.body.response, /\[box\] ↓ 4 N downward/i);
  assert.equal(
    harness.studentSessions[harness.sessionId].anonymousHubs['patch-4-net-force-direct'].currentTutorProblem,
    null,
    'net-force-only direct answer should not leave tutor state'
  );
}

async function testMetricStairStepFormulaTutorVisualMetadata() {
  const harness = await createHarnessSession();
  const metricCases = [
    {
      name: 'metric-stair-step-km-to-m',
      prompt: 'Convert 48 km to meters.',
      startUnit: 'km',
      targetUnit: 'm',
      resultUnit: 'm',
      resultValue: 48000,
      decimalDirection: 'right',
      decimalPlaces: 3
    },
    {
      name: 'metric-stair-step-km-to-cm',
      prompt: 'Convert 7.5 km to cm.',
      startUnit: 'km',
      targetUnit: 'cm',
      resultUnit: 'cm',
      resultValue: 750000,
      decimalDirection: 'right',
      decimalPlaces: 5
    },
    {
      name: 'metric-stair-step-mg-to-kg',
      prompt: 'Convert 45,456 mg to kilograms.',
      startUnit: 'mg',
      targetUnit: 'kg',
      resultUnit: 'kg',
      resultValue: 0.045456,
      decimalDirection: 'left',
      decimalPlaces: 6
    }
  ];

  for (const testCase of metricCases) {
    const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
    assert.equal(response.body.routeType, 'formula_tutor', `${testCase.name} should start Formula Tutor`);
    assert.equal(response.body.tutor?.formulaId, 'unit1_metric_stair_step_conversion', `${testCase.name} formula id`);
    assert.match(response.body.response, /Stair-step conversion/i, `${testCase.name} should offer stair-step method`);
    assert.match(response.body.response, /Picket fence|dimensional analysis/i, `${testCase.name} should offer picket fence method`);
    assert.doesNotMatch(response.body.response, /Density formula/i, `${testCase.name} should not offer density formula`);
    assert.doesNotMatch(response.body.response, /Metric stair-step|Picket fence method|Move decimal left|Move decimal right/i, `${testCase.name} should not render method visuals before method choice`);
    assert.doesNotMatch(response.body.response, /\bdraw\b/i, `${testCase.name} should not ask students to draw a picket fence`);
    assert.equal(response.body.tutor?.currentStep?.choices?.length, 2, `${testCase.name} should expose exactly two method choices`);
    assertMetricStairStepVisual(response.body.tutor?.work?.visualMetadata, testCase);
    assertMetricStairStepVisual(response.body.tutor?.visualMetadata, testCase);
  }

  await assertMetricMethodBranchVisuals(harness);

  const boundaryCases = [
    {
      name: 'picket-fence-no-metric-stair-step',
      prompt: 'Convert 250.4 cm to feet.',
      visualType: 'picket_fence'
    },
    {
      name: 'temperature-no-metric-stair-step',
      prompt: 'Convert 23 C to F.',
      visualType: 'temperature_conversion'
    },
    {
      name: 'scientific-notation-no-metric-stair-step',
      prompt: 'Write 354,000,000 in scientific notation.',
      visualType: 'scientific_notation_decimal_move'
    }
  ];

  for (const testCase of boundaryCases) {
    const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
    assert.equal(response.body.routeType, 'formula_tutor', `${testCase.name} should still start Formula Tutor`);
    assert.equal(response.body.tutor?.work?.visualMetadata?.visualType, testCase.visualType, `${testCase.name} visual type`);
    assert.notEqual(response.body.tutor?.work?.visualMetadata?.visualType, 'metric_stair_step', `${testCase.name} should not use metric stair-step visual`);
  }
}

async function assertMetricMethodBranchVisuals(harness) {
  const stairStart = await sendHarnessMessage(harness, 'metric-method-branch-stair-ui', 'Convert 48 km to meters.');
  assert.equal(stairStart.body.tutor?.currentStep?.choices?.length, 2, 'method choice should expose exactly two choices');
  const stair = await sendHarnessMessage(harness, 'metric-method-branch-stair-ui', '1');
  assert.equal(stair.body.tutor?.work?.selectedMethod, 'stair_step', 'stair-step branch selected method');
  assert.equal(stair.body.tutor?.totalSteps, 2, 'stair-step branch total steps');
  assert.match(stair.body.response, /Step 2 of 2/i, 'stair-step branch response step count');
  assert.match(stair.body.response, /Move the marker to the target unit/i, 'stair-step branch should ask students to move the marker');
  assert.doesNotMatch(stair.body.response, /What value and unit are we starting with|Which direction does the decimal move|How many metric steps|What is the final answer/i, 'stair-step branch should not ask extra text questions');
  assert.equal(stair.body.tutor?.work?.currentStep?.suppressFormulaDetails, true, 'stair-step branch should suppress formula detail rows');
  assert.equal(stair.body.tutor?.work?.currentStep?.suppressKnownValues, true, 'stair-step branch should suppress known values row');
  assert.equal(stair.body.tutor?.work?.visualMetadata?.visualType, 'metric_stair_step', 'stair-step branch visual type');
  assert.notEqual(stair.body.tutor?.work?.visualMetadata?.visualType, 'picket_fence', 'stair-step branch should not show picket-fence visual');
  assert.equal(stair.body.tutor?.work?.visualMetadata?.autoCompleteAnswer, '48,000 m', 'stair-step branch auto-complete answer');
  assertMetricStepValueDisplays(stair.body.tutor?.work?.visualMetadata, ['48 km', '480 hm', '4,800 dam', '48,000 m']);
  const completedStair = await sendHarnessMessage(harness, 'metric-method-branch-stair-ui', '48,000 m');
  assert.equal(completedStair.body.tutor?.completed, true, 'stair-step marker target answer should complete tutor');
  assert.equal(completedStair.body.tutor?.active, false, 'stair-step marker target answer should deactivate tutor');
  assert.match(completedStair.body.response, /Correct/i, 'stair-step marker target answer should be correct');
  assert.match(completedStair.body.response, /48 km\s*=\s*48,?000 m/i, 'stair-step marker target answer should show clean equation final answer');

  const picketStart = await sendHarnessMessage(harness, 'metric-method-branch-picket-ui', 'Convert 48 km to meters.');
  assert.equal(picketStart.body.tutor?.currentStep?.choices?.length, 2, 'method choice should expose exactly two choices for picket path');
  const picket = await sendHarnessMessage(harness, 'metric-method-branch-picket-ui', '2');
  assert.equal(picket.body.tutor?.work?.selectedMethod, 'picket_fence', 'picket-fence branch selected method');
  assert.equal(picket.body.tutor?.totalSteps, 6, 'picket-fence branch total steps');
  assert.match(picket.body.response, /Step 2 of 6/i, 'picket-fence branch response step count');
  assert.match(picket.body.response, /Type the given number/i, 'picket-fence branch short fill prompt');
  assert.equal((picket.body.tutor?.currentStep?.choices || []).length, 0, 'picket-fence fill step should not use choices');
  assert.deepEqual(
    (picket.body.tutor?.currentStep?.answerChips || []).map((chip) => chip.value),
    ['48'],
    'picket-fence given number should expose a bounded answer chip'
  );
  assert.equal(picket.body.tutor?.work?.currentStep?.suppressFormulaDetails, true, 'picket-fence fill step should suppress formula detail rows');
  assert.equal(picket.body.tutor?.work?.currentStep?.suppressKnownValues, true, 'picket-fence fill step should suppress known values row');
  assert.equal(picket.body.tutor?.work?.visualMetadata?.visualType, 'picket_fence', 'picket-fence branch visual type');
  assert.notEqual(picket.body.tutor?.work?.visualMetadata?.visualType, 'metric_stair_step', 'picket-fence branch should not show stair-step visual');
  assertPicketFenceFillableSections(picket.body.tutor?.work?.visualMetadata, { name: 'metric-method-branch-picket-ui' });
  assert.doesNotMatch(picket.body.response, /\bdraw\b/i, 'picket-fence branch should not use draw language');
  assert.doesNotMatch(picket.body.response, /Which conversion factor belongs|Choose one|1\.\s*1,?000 m/i, 'picket-fence branch should not show multiple-choice fill options');
  const given = await sendHarnessMessage(harness, 'metric-method-branch-picket-ui', '48');
  assertCompletedStep(given.body, 'identify_given_quantity');
  assert.match(given.body.response, /Choose or type the top number for the conversion factor/i, 'picket-fence branch should ask for the numerator number');
  assert.equal((given.body.tutor?.currentStep?.choices || []).length, 0, 'picket-fence numerator should be typed');
  assert.deepEqual(
    (given.body.tutor?.currentStep?.answerChips || []).map((chip) => chip.value),
    ['1,000', '1'],
    'picket-fence top number should expose bounded chips'
  );
  const top = await sendHarnessMessage(harness, 'metric-method-branch-picket-ui', '1000');
  assertCompletedStep(top.body, 'fill_conversion_factor_top');
  assert.match(top.body.response, /Choose or type the bottom number for the conversion factor/i, 'picket-fence branch should ask for the denominator number');
  assert.deepEqual(
    (top.body.tutor?.currentStep?.answerChips || []).map((chip) => chip.value),
    ['1,000', '1'],
    'picket-fence bottom number should expose bounded chips'
  );
  const bottom = await sendHarnessMessage(harness, 'metric-method-branch-picket-ui', '1');
  assertCompletedStep(bottom.body, 'fill_conversion_factor_bottom');
  assert.match(bottom.body.response, /Click a unit that cancels, or type one/i, 'picket-fence branch should ask for clickable or typed cancellation');
  const cancelled = await sendHarnessMessage(harness, 'metric-method-branch-picket-ui', 'km');
  assertCompletedStep(cancelled.body, 'cancel_units');
  assert.match(cancelled.body.response, /Type the final number only\. Do not include the unit/i, 'picket-fence branch should ask for the final number only');
  assert.equal((cancelled.body.tutor?.currentStep?.answerChips || []).length, 0, 'final-number step should not expose the final answer as a chip');
  const completedPicket = await sendHarnessMessage(harness, 'metric-method-branch-picket-ui', '48000');
  assert.equal(completedPicket.body.tutor?.completed, true, 'picket-fence typed final answer should complete tutor');
  assert.equal(completedPicket.body.tutor?.active, false, 'picket-fence typed final answer should deactivate tutor');
}

function assertMetricStepValueDisplays(visual, expectedDisplays) {
  const displays = (visual?.stepValues || []).map((item) => item.display);
  for (const expected of expectedDisplays) {
    assert.ok(displays.includes(expected), `metric stair-step values should include ${expected}`);
  }
}

function assertCompletedStep(body, stepId) {
  const completedSteps = body.tutor?.work?.completedSteps || body.tutor?.completedSteps || [];
  assert.ok(completedSteps.includes(stepId), `completed steps should include ${stepId}`);
}

function assertMetricStairStepVisual(visual, testCase) {
  assert.ok(visual, `${testCase.name} should expose visual metadata`);
  assert.equal(visual.visualType, 'metric_stair_step', `${testCase.name} visual type`);
  assert.equal(visual.startUnit, testCase.startUnit, `${testCase.name} start unit`);
  assert.equal(visual.targetUnit, testCase.targetUnit, `${testCase.name} target unit`);
  assert.equal(visual.resultUnit, testCase.resultUnit, `${testCase.name} result unit`);
  assert.equal(visual.decimalMove?.direction, testCase.decimalDirection, `${testCase.name} decimal direction`);
  assert.equal(visual.decimalMove?.places, testCase.decimalPlaces, `${testCase.name} decimal places`);
  assert.ok(Array.isArray(visual.steps) && visual.steps.length === 10, `${testCase.name} should expose ten metric stair steps`);
  assert.ok(Array.isArray(visual.stepValues) && visual.stepValues.length === 10, `${testCase.name} should expose live value displays for each metric stair step`);
  assert.ok(visual.stepValues.some((item) => item.unit === testCase.startUnit), `${testCase.name} should include start-unit current value`);
  assert.ok(visual.stepValues.some((item) => item.unit === testCase.targetUnit), `${testCase.name} should include target-unit current value`);
  assert.ok(Math.abs(Number(visual.resultValue) - testCase.resultValue) < 1e-9, `${testCase.name} result value`);
  const methodLabels = (visual.methodChoices || []).map((choice) => choice.label || '').join(' ');
  assert.match(methodLabels, /Stair-step conversion/i, `${testCase.name} should expose stair-step method choice`);
  assert.match(methodLabels, /Picket fence|dimensional analysis/i, `${testCase.name} should expose picket-fence method choice`);
  assertPicketFenceFillableSections(visual.methodVisuals?.picketFence, testCase);
}

async function testPicketFenceFormulaTutorVisualMetadata() {
  const harness = await createHarnessSession();
  const picketFenceCases = [
    {
      name: 'picket-fence-cm-to-feet',
      prompt: 'Convert 250.4 cm to feet.',
      givenUnit: 'cm',
      targetUnit: 'ft',
      resultUnit: 'ft',
      resultValue: 8.22,
      minFactors: 2,
      expectedCancelUnits: ['cm', 'in']
    },
    {
      name: 'picket-fence-seconds-in-year',
      prompt: 'How many seconds are in one year?',
      givenUnit: 'year',
      targetUnit: 's',
      resultUnit: 's',
      resultValue: 31536000,
      minFactors: 4,
      expectedCancelUnits: ['year', 'days', 'hr', 'min']
    }
  ];

  for (const testCase of picketFenceCases) {
    const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
    assert.equal(response.body.routeType, 'formula_tutor', `${testCase.name} should start Formula Tutor`);
    assert.equal(response.body.tutor?.formulaId, 'unit1_picket_fence_conversion', `${testCase.name} formula id`);
    assertPicketFenceVisual(response.body.tutor?.work?.visualMetadata, testCase);
    assertPicketFenceVisual(response.body.tutor?.visualMetadata, testCase);
  }

  const boundaryCases = [
    {
      name: 'metric-no-picket-fence-km-to-m',
      prompt: 'Convert 48 km to meters.',
      visualType: 'metric_stair_step'
    },
    {
      name: 'metric-no-picket-fence-mg-to-kg',
      prompt: 'Convert 45,456 mg to kilograms.',
      visualType: 'metric_stair_step'
    },
    {
      name: 'temperature-no-picket-fence',
      prompt: 'Convert 23 C to F.',
      visualType: 'temperature_conversion'
    },
    {
      name: 'scientific-notation-no-picket-fence',
      prompt: 'Write 354,000,000 in scientific notation.',
      visualType: 'scientific_notation_decimal_move'
    }
  ];

  for (const testCase of boundaryCases) {
    const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
    assert.equal(response.body.routeType, 'formula_tutor', `${testCase.name} should still start Formula Tutor`);
    assert.equal(response.body.tutor?.work?.visualMetadata?.visualType, testCase.visualType, `${testCase.name} visual type`);
    assert.notEqual(response.body.tutor?.work?.visualMetadata?.visualType, 'picket_fence', `${testCase.name} should not use picket-fence visual`);
  }
}

function assertPicketFenceVisual(visual, testCase) {
  assert.ok(visual, `${testCase.name} should expose visual metadata`);
  assert.equal(visual.visualType, 'picket_fence', `${testCase.name} visual type`);
  assert.equal(visual.given?.unit, testCase.givenUnit, `${testCase.name} given unit`);
  assert.equal(visual.targetUnit, testCase.targetUnit, `${testCase.name} target unit`);
  assert.equal(visual.arithmetic?.resultUnit, testCase.resultUnit, `${testCase.name} result unit`);
  assert.ok(Math.abs(Number(visual.arithmetic?.resultValue) - testCase.resultValue) < 1e-9, `${testCase.name} result value`);
  assert.ok(Array.isArray(visual.conversionFactors) && visual.conversionFactors.length >= testCase.minFactors, `${testCase.name} should include conversion factors`);
  assert.ok(Array.isArray(visual.cancellationSteps) && visual.cancellationSteps.length >= testCase.expectedCancelUnits.length, `${testCase.name} should include cancellation steps`);
  assert.ok(Array.isArray(visual.cells) && visual.cells.length >= testCase.minFactors + 1, `${testCase.name} should include fraction cells`);
  assertPicketFenceFillableSections(visual, testCase);
  const cancellationUnits = visual.cancellationSteps.map((step) => String(step.unit || '').toLowerCase());
  for (const unit of testCase.expectedCancelUnits) {
    assert.ok(cancellationUnits.includes(unit.toLowerCase()), `${testCase.name} should cancel ${unit}`);
  }
}

function assertPicketFenceFillableSections(visual, testCase) {
  assert.ok(visual, `${testCase.name} should expose picket-fence metadata`);
  assert.equal(visual.visualType, 'picket_fence', `${testCase.name} picket-fence visual type`);
  const sectionIds = (visual.fillableSections || []).map((section) => section.id);
  for (const id of [
    'given_value',
    'conversion_factor_0_numerator',
    'conversion_factor_0_denominator',
    'canceled_units',
    'top_product',
    'bottom_product',
    'final_answer'
  ]) {
    assert.ok(sectionIds.includes(id), `${testCase.name} should expose fillable section ${id}`);
  }
}

async function testScientificNotationFormulaTutorVisualMetadata() {
  const harness = await createHarnessSession();
  const scientificCases = [
    {
      name: 'scientific-notation-large-number',
      prompt: 'Write 354,000,000 in scientific notation.',
      formulaId: 'unit1_scientific_notation',
      exponent: 8,
      coefficient: 3.54,
      decimalDirection: 'left',
      decimalPlaces: 8
    },
    {
      name: 'scientific-notation-small-decimal',
      prompt: 'Write 0.000096 in scientific notation.',
      formulaId: 'unit1_scientific_notation',
      exponent: -5,
      coefficient: 9.6,
      decimalDirection: 'right',
      decimalPlaces: 5
    },
    {
      name: 'standard-notation-negative-exponent',
      prompt: 'Write 2.76 x 10-3 in standard notation.',
      formulaId: 'unit1_standard_notation',
      exponent: -3,
      resultValue: 0.00276,
      decimalDirection: 'left',
      decimalPlaces: 3
    },
    {
      name: 'standard-notation-positive-exponent',
      prompt: 'Write 4.011 x 10^4 in standard notation.',
      formulaId: 'unit1_standard_notation',
      exponent: 4,
      resultValue: 40110,
      decimalDirection: 'right',
      decimalPlaces: 4
    }
  ];

  for (const testCase of scientificCases) {
    const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
    assert.equal(response.body.routeType, 'formula_tutor', `${testCase.name} should start Formula Tutor`);
    assert.equal(response.body.tutor?.formulaId, testCase.formulaId, `${testCase.name} formula id`);
    assertScientificNotationVisual(response.body.tutor?.work?.visualMetadata, testCase);
    assertScientificNotationVisual(response.body.tutor?.visualMetadata, testCase);
  }

  const boundaryCases = [
    {
      name: 'metric-no-scientific-notation-km-to-m',
      prompt: 'Convert 48 km to meters.',
      visualType: 'metric_stair_step'
    },
    {
      name: 'metric-no-scientific-notation-mg-to-kg',
      prompt: 'Convert 45,456 mg to kilograms.',
      visualType: 'metric_stair_step'
    },
    {
      name: 'picket-fence-no-scientific-notation-cm-to-feet',
      prompt: 'Convert 250.4 cm to feet.',
      visualType: 'picket_fence'
    },
    {
      name: 'picket-fence-no-scientific-notation-seconds-year',
      prompt: 'How many seconds are in one year?',
      visualType: 'picket_fence'
    },
    {
      name: 'temperature-no-scientific-notation',
      prompt: 'Convert 23 C to F.',
      visualType: 'temperature_conversion'
    }
  ];

  for (const testCase of boundaryCases) {
    const response = await sendHarnessMessage(harness, testCase.name, testCase.prompt);
    assert.equal(response.body.routeType, 'formula_tutor', `${testCase.name} should still start Formula Tutor`);
    assert.equal(response.body.tutor?.work?.visualMetadata?.visualType, testCase.visualType, `${testCase.name} visual type`);
    assert.notEqual(response.body.tutor?.work?.visualMetadata?.visualType, 'scientific_notation_decimal_move', `${testCase.name} should not use scientific notation visual`);
  }
}

function assertScientificNotationVisual(visual, testCase) {
  assert.ok(visual, `${testCase.name} should expose visual metadata`);
  assert.equal(visual.visualType, 'scientific_notation_decimal_move', `${testCase.name} visual type`);
  assert.equal(visual.exponent, testCase.exponent, `${testCase.name} exponent`);
  assert.equal(visual.decimalMove?.direction, testCase.decimalDirection, `${testCase.name} decimal direction`);
  assert.equal(visual.decimalMove?.places, testCase.decimalPlaces, `${testCase.name} decimal places`);
  if (testCase.coefficient != null) {
    assert.ok(Math.abs(Number(visual.coefficient) - testCase.coefficient) < 1e-9, `${testCase.name} coefficient`);
  }
  if (testCase.resultValue != null) {
    assert.ok(Math.abs(Number(visual.resultValue) - testCase.resultValue) < 1e-9, `${testCase.name} result value`);
  }
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
  .then(testPatch4NetForceOnlyDirectAnswerWithTutorOn)
  .then(testMetricStairStepFormulaTutorVisualMetadata)
  .then(testPicketFenceFormulaTutorVisualMetadata)
  .then(testScientificNotationFormulaTutorVisualMetadata)
  .then(testInteractiveFlashcardUiMetadata)
  .then(() => {
    console.log('student tutor UI: formula tutor turns group into collapsible problem sessions');
    console.log('student tutor UI: guided formula startup preserves direct-answer mode when disabled');
    console.log('student tutor UI: conceptual formula tutor steps show numbered choices immediately');
    console.log('student tutor UI: Concept 3 General Tutor vocab steps show numbered choices immediately');
    console.log('student tutor UI: velocity and acceleration tutor regressions passed');
    console.log('student tutor UI: Patch 4 stale tutor controls and net-force direct-answer regressions passed');
    console.log('student tutor UI: metric stair-step Formula Tutor visual metadata passed');
    console.log('student tutor UI: picket fence Formula Tutor visual metadata passed');
    console.log('student tutor UI: scientific notation Formula Tutor visual metadata passed');
    console.log('student tutor UI: interactive flashcard cards use backend session metadata');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
