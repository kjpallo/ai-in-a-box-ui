const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const uiPath = path.join(projectRoot, 'public', 'teacher-content-ui.js');
const stylePath = path.join(projectRoot, 'public', 'style.css');
const bladeUiPath = path.join(projectRoot, 'public', 'blade-ui.js');
const packagePath = path.join(projectRoot, 'package.json');

const ui = read(uiPath);
const style = read(stylePath);
const bladeUi = read(bladeUiPath);
const pkg = JSON.parse(read(packagePath));

assertPageFlow();
assertUploadPage();
assertSavedPackManagerNotInModal();
assertSavedPackManagementOnMainBlade();
assertBulkUploadQueuePage();
assertBulkQueueNamingRules();
assertReviewListTableLayout();
assertReviewBulkPackSummary();
assertReviewControlsAndSelectionBehavior();
assertFallbackRowsFromDraftPacketArrays();
assertNeedsReviewIsReviewableAndSelectable();
assertNeedsReviewCopyIsNotUnsafe();
assertSummaryAndEmptyMessageUseDraftArrays();
assertFailedSectionMessaging();
assertTechnicalReportErrorsStayInAdvancedDetails();
assertPrimaryFlowDoesNotShowManualPreviewOrBatchSizeInstructions();
assertReviewCanceledMessageClearsOnSuccessfulDraftLoad();
assertAcceptBehavior();
assertCollapsedDetails();
assertPausedStandardsWarningsAreDeemphasized();
assertDonePage();
assertTeacherContentEntryPointVisible();
assertPackageScript();
assertTeacherContentAdapterAndRouteTestsStillPass();

console.log('Teacher content UI tests passed.');

function assertPageFlow() {
  const tabsBlock = ui.match(/const TABS = \[([\s\S]*?)\n  \];/);
  assert.ok(tabsBlock, 'Expected TABS definition.');
  assert.match(tabsBlock[1], /id: 'upload', label: 'Upload \/ Start'/, 'Page 1 should be Upload / Start.');
  assert.match(tabsBlock[1], /id: 'review', label: 'Review Draft Content'/, 'Page 2 should be Review Draft Content.');
  assert.match(tabsBlock[1], /id: 'complete', label: 'Done'/, 'Page 3 should be Done.');
  assert.doesNotMatch(tabsBlock[1], /approvedPacks|Knowledge Packs/, 'Page 3 should not be the old Knowledge Packs blade.');
}

function assertUploadPage() {
  const uploadCard = ui.match(/function renderUploadSourceCard\(\) \{([\s\S]*?)\n  function renderUploadStartPlanShell/);
  const importProfilesBlock = ui.match(/const IMPORT_PROFILES = \[([\s\S]*?)\n  \];/);
  assert.ok(uploadCard, 'Expected renderUploadSourceCard function.');
  assert.ok(importProfilesBlock, 'Expected import profile list.');
  assert.match(uploadCard[1], /teacherContentUploadFile/, 'Upload page should include upload input.');
  assert.match(uploadCard[1], /teacherContentKnowledgeName/, 'Upload page should include knowledge packet name field.');
  assert.match(uploadCard[1], /teacherContentImportProfile/, 'Upload page should include import profile selector.');
  assert.match(uploadCard[1], /Choose import profile\.\.\./, 'Upload page should require selecting an import profile.');
  [
    'General',
    'Science',
    'Math',
    'English / Reading',
    'History / Social Studies',
    'Art',
    'Computer Science',
    'Robotics',
    'Class Info / Procedures'
  ].forEach((label) => {
    assert.match(importProfilesBlock[1], new RegExp(label.replaceAll('/', '\\/')), `Upload page should include ${label} profile option.`);
  });
  [
    'Physical Science',
    'Biology',
    'Chemistry',
    'Earth and Space Science'
  ].forEach((legacyScienceLabel) => {
    assert.doesNotMatch(importProfilesBlock[1], new RegExp(legacyScienceLabel.replaceAll('/', '\\/')), `${legacyScienceLabel} should not be visible in the main import profile dropdown.`);
  });
  assert.match(uploadCard[1], /Analyze Upload/, 'Upload page should include Analyze Upload action.');
  assert.match(uploadCard[1], /const canAttemptCreateReview = state\.selectedUploadFiles\.length > 0 && !uploadBusy;/, 'Analyze button should stay clickable after file selection so missing-profile validation can glow.');
  assert.match(uploadCard[1], /teacher-content-required-glow/, 'Upload page should apply glow class when import profile is missing.');
  assert.match(uploadCard[1], /data-upload-import-profile-validation/, 'Upload page should show import-profile validation copy.');
  assert.match(ui, /if \(!state\.uploadImportProfile\) \{[\s\S]*Select an import profile before analyzing the upload\./, 'Analyze should be blocked when no import profile is selected.');
  assert.match(ui, /data-upload-create-progress/, 'Upload page should include simple progress UI.');
  assert.match(ui, /importProfile:\s*normalizeImportProfileForPayload\(state\.uploadImportProfile\)/, 'Prepare-review payload should include explicit importProfile.');
  assert.match(ui, /function normalizeImportProfileForPayload\(value\)/, 'Import profile helper should keep room for future profiles.');
}

function assertSavedPackManagerNotInModal() {
  const overlay = ui.match(/function buildOverlay\(\) \{([\s\S]*?)\n  function init/);
  assert.ok(overlay, 'Expected buildOverlay function.');
  assert.doesNotMatch(overlay[1], /teacherContentKnowledgeManager|data-main-knowledge-pack-manager/, 'Create New Knowledge modal should not render saved-pack manager shell.');
  assert.doesNotMatch(overlay[1], /Manage saved knowledge packs|Knowledge Packs/, 'Create New Knowledge modal should stay focused on import workflow states.');
}

function assertSavedPackManagementOnMainBlade() {
  const manager = ui.match(/function renderKnowledgeManager\(\) \{([\s\S]*?)\n  function renderDeckPreviewCard/);
  assert.ok(manager, 'Expected renderKnowledgeManager function.');
  assert.match(manager[1], /<h4>Knowledge Packs<\/h4>/, 'Main blade should include a Knowledge Packs heading.');
  assert.match(manager[1], /Upload class notes, slides, readings, and review them before student use\./, 'Main blade should include teacher-friendly knowledge-pack description.');
  assert.match(manager[1], /data-main-knowledge-pack-manager|teacherContentKnowledgeManager/, 'Main blade should include a dedicated saved-pack manager container.');
  assert.match(manager[1], /data-manager-draft-count/, 'Main blade should show draft-pack count.');
  assert.match(manager[1], /data-manager-approved-count/, 'Main blade should show approved-pack count.');
  assert.match(manager[1], /teacherContentDraftSelect/, 'Main blade should include draft dropdown for selecting review pack.');
  assert.match(manager[1], /renderDraftPacksCard\(\)/, 'Main blade should render draft packs by name.');
  assert.match(manager[1], /renderApprovedPacksCard\(\)/, 'Main blade should render approved-pack management controls.');
  assert.match(ui, /data-draft-pack-list/, 'Main blade should include draft pack list container.');
  assert.match(ui, /data-draft-pack-card/, 'Main blade should render draft pack cards.');
  assert.match(ui, /data-draft-pack-title/, 'Draft pack cards should render actual pack names.');
  assert.match(ui, /data-draft-pack-view-edit-action/, 'Draft pack cards should include View\\/Edit control.');
  assert.match(ui, /data-approved-pack-title/, 'Approved pack cards should render actual pack names.');
  assert.match(ui, /data-approved-pack-select-checkbox/, 'Approved pack cards should include deletion checkboxes.');
  assert.match(ui, /data-approved-pack-activation-checkbox/, 'Approved pack cards should include enable\\/disable toggles.');
  assert.match(ui, /Enabled for student answers|Disabled for student answers/, 'Approved-pack toggles should clearly label student-answer enable state.');
  assert.match(ui, /View \/ Edit Pack/, 'Approved-pack management should still include View\\/Edit action.');
  assert.match(ui, /Delete Pack|Delete selected knowledge packs/, 'Approved-pack management should still include delete/archive actions.');
}

function assertBulkUploadQueuePage() {
  assert.match(ui, /type="file"[\s\S]*multiple/, 'Upload input should allow selecting multiple files.');
  assert.match(ui, /data-upload-folder-input/, 'Upload page should include folder-capable upload input.');
  assert.match(ui, /data-upload-browse-folder/, 'Upload page should include Upload Folder action.');
  assert.match(ui, /function renderUploadQueueList\(\)/, 'Upload page should render a queue list for bulk files.');
  assert.match(ui, /data-upload-queue/, 'Bulk queue container should be present.');
  assert.match(ui, /data-upload-queue-file/, 'Queue rows should show file names.');
  assert.match(ui, /data-upload-queue-pack-name/, 'Queue rows should show proposed pack names.');
  assert.match(ui, /data-upload-queue-status-label/, 'Queue rows should show status labels.');
  assert.match(ui, /data-upload-queue-visibility/, 'Queue should show visible-row count and scroll hint copy.');
  assert.match(ui, /draft ready/, 'Queue status should include draft ready.');
  assert.match(ui, /waiting/, 'Queue status should include waiting.');
  assert.match(ui, /extracting/, 'Queue status should include extracting.');
  assert.match(ui, /processing/, 'Queue status should include processing.');
  assert.match(ui, /failed/, 'Queue status should include failed.');
  assert.match(ui, /canceled/, 'Queue status should include canceled.');
  assert.match(ui, /data-upload-cancel-remaining/, 'Upload page should include cancel remaining action.');
  assert.match(ui, /function cancelRemainingUploadQueue\(\)/, 'Upload queue should implement cancel-remaining behavior.');
  assert.match(ui, /for \(let index = 0; index < queue\.length; index \+= 1\) \{[\s\S]*await processUploadQueueItem\(queueItem, index, queueTotal, completedPackIds\);/, 'Upload queue should continue processing files sequentially.');
  assert.match(
    ui,
    /const singleDefaultName = files\.length === 1 && files\[0\][\s\S]*state\.uploadContentName = singleDefaultName;[\s\S]*state\.uploadQueue = buildUploadQueueFromFiles\(files, singleDefaultName\);/,
    'Selected-file handler should compute single-file default name before queue build to avoid stale queue names.'
  );
  assert.match(
    ui,
    /state\.uploadQueue\.length === 1[\s\S]*proposedPackName: state\.uploadContentName \|\| state\.uploadQueue\[0\]\.proposedPackName/,
    'Editing Knowledge Pack Name should continue updating the single queue item.'
  );
  assert.match(ui, /Pack names default from folder and file names when available\./, 'Teacher copy should describe folder-aware default naming.');
  assert.match(ui, /Folder path data was not available from this browser, so pack names used file names only\./, 'Upload queue should explain when browser folder-path metadata is unavailable.');
}

function assertBulkQueueNamingRules() {
  const queueBuilder = compileUiFunction('buildUploadQueueFromFiles', ['titleCase', 'makeContentNameFromFileName', 'buildDefaultPackNameFromFile', 'extractNearestMeaningfulParentFolder', 'makeQueuePackNamesCollisionSafe']);
  const namingFromFile = compileUiFunction('buildDefaultPackNameFromFile', ['titleCase', 'makeContentNameFromFileName', 'extractNearestMeaningfulParentFolder']);

  const noPathQueue = queueBuilder([
    { name: 'Energy.pptx' },
    { name: 'Moon Notes.pdf' }
  ]);
  assert.equal(noPathQueue[0].proposedPackName, 'Energy', 'Multi-file upload without folder path should use file-name pack names.');
  assert.equal(noPathQueue[1].proposedPackName, 'Moon Notes', 'File-name naming should remain unchanged when no folder path exists.');

  const folderPathQueue = queueBuilder([
    { name: 'Energy.pptx', webkitRelativePath: 'Science/Energy.pptx' },
    { name: 'Moon Notes.pdf', webkitRelativePath: 'Science/Moon Notes.pdf' }
  ]);
  assert.equal(folderPathQueue[0].proposedPackName, 'Science - Energy', 'Folder path should default to "Folder - File Name".');
  assert.equal(folderPathQueue[1].proposedPackName, 'Science - Moon Notes', 'Folder path should use clean file names without extensions.');

  const nestedPathQueue = queueBuilder([
    { name: 'Energy.pptx', webkitRelativePath: 'Charlemagne Tests/Science/Energy.pptx' }
  ]);
  assert.equal(nestedPathQueue[0].proposedPackName, 'Science - Energy', 'Nested folder path should use nearest meaningful parent folder.');
  assert.equal(namingFromFile({ name: 'Energy.pptx', webkitRelativePath: 'Charlemagne Tests/Science/Energy.pptx' }), 'Science - Energy', 'Single-file naming should match queue naming helper.');
  assert.equal(
    namingFromFile({ name: 'Energy.pptx', relativePath: 'Charlemagne Tests/Science/Energy.pptx' }),
    'Science - Energy',
    'Single-file naming should support relativePath fallback for non-browser adapters/tests.'
  );

  const duplicateQueue = queueBuilder([
    { name: 'Energy.pptx', webkitRelativePath: 'Science/Energy.pptx' },
    { name: 'Energy.pptx', webkitRelativePath: 'Science/Energy.pptx' }
  ]);
  assert.equal(duplicateQueue[0].proposedPackName, 'Science - Energy', 'First duplicate should keep base name.');
  assert.equal(duplicateQueue[1].proposedPackName, 'Science - Energy (2)', 'Duplicate names should remain collision-safe.');
  assert.equal(duplicateQueue.length, 2, 'Each uploaded file should remain one separate queue item.');

  const staleSingleNameQueue = queueBuilder(
    [{ name: 'New File.pptx', webkitRelativePath: 'Science/New File.pptx' }],
    'Old Proposed Name'
  );
  assert.equal(
    staleSingleNameQueue[0].proposedPackName,
    'Old Proposed Name',
    'Single-file queue respects an explicit singleName override; selected-file handler must pass freshly computed defaults.'
  );
}

function assertReviewListTableLayout() {
  const reviewCard = ui.match(/function renderReviewCard\(\) \{([\s\S]*?)\n  function renderReviewDoneCard/);
  assert.ok(reviewCard, 'Expected renderReviewCard function.');

  assert.match(reviewCard[1], /Review Knowledge Packet/, 'Page 2 should show Review Knowledge Packet heading.');
  assert.match(reviewCard[1], /data-review-summary-line/, 'Page 2 should show compact summary line.');
  assert.match(ui, /data-review-filter-tabs/, 'Page 2 should expose simple filter chips/tabs.');
  assert.match(reviewCard[1], /renderReviewTable\(filteredItems\)/, 'Page 2 should render list/table rows immediately.');
  assert.match(ui, /No draft items were created from this upload\./, 'Page 2 should show a clear no-draft-items message when none were generated.');
  assert.match(ui, /section\$\{summaryCount === 1 \? '' : 's'\} could not be processed\. You can still review and accept the items that were created\./, 'Page 2 should show simple teacher-facing failed-section copy.');

  assert.match(ui, /function renderReviewTable\(/, 'Table/list renderer should exist.');
  assert.match(ui, /data-review-table-row/, 'Each review item should render as a table/list row marker.');
  assert.match(ui, /teacher-content-review-table-row/, 'Row styling should use list/table rows.');

  assert.doesNotMatch(reviewCard[1], /renderReviewGroup\(/, 'Page 2 should not render large section card groups by default.');
}

function assertReviewBulkPackSummary() {
  assert.match(ui, /Use this Draft dropdown to switch review packs\./, 'Draft selector should explain that it switches between draft packs.');
  assert.match(ui, /function renderBulkReviewSummary\(\)/, 'Review page should define a dedicated bulk-summary renderer.');
  assert.match(ui, /data-review-bulk-summary/, 'Review page should render a bulk-summary panel when multiple files create multiple packs.');
  assert.match(ui, /Reviewing .* draft packs\. Use the pack list to switch packs\./, 'Bulk summary should explain queue position and pack-list switching.');
  assert.match(ui, /data-review-bulk-summary-list/, 'Bulk summary should show a compact list of created draft pack names.');
  assert.match(ui, /data-review-pack-select/, 'Bulk summary should expose clickable draft-pack queue cards.');
  assert.match(ui, /function buildReviewQueuePacks\(\)/, 'Review queue should be built from draft/queue metadata.');
  assert.match(ui, /needs review|partially reviewed|accepted|empty|failed/, 'Queue should label pack review status.');
  assert.match(ui, /renderReviewTable\(filteredItems\)/, 'Review page should still render only selected-draft rows.');
}

function assertReviewControlsAndSelectionBehavior() {
  assert.match(ui, /data-review-selection-checkbox/, 'Each review row should have a checkbox.');
  assert.match(ui, /data-review-select-all/, 'Page 2 should include Select All control.');
  assert.match(ui, /data-review-accept-selected/, 'Page 2 should include Accept Selected control.');
  assert.match(ui, /data-review-accept-all/, 'Page 2 should include Accept All control.');
  assert.match(ui, /data-review-cancel/, 'Page 2 should include Cancel control.');

  const selectAll = ui.match(/function toggleSelectAllVisibleReviewItems\(\) \{([\s\S]*?)\n  function formatReviewTypeStatus/);
  assert.ok(selectAll, 'Expected toggleSelectAllVisibleReviewItems function.');
  assert.match(selectAll[1], /getFilteredReviewItems\(getVisibleReviewItems\(\)\)/, 'Select All should target visible/reviewable rows.');
  assert.match(selectAll[1], /keys\.forEach/, 'Select All should iterate all visible item keys.');
}

function assertFallbackRowsFromDraftPacketArrays() {
  assert.match(ui, /function getReviewItemGroups\(\)/, 'UI should define a shared review-row group resolver.');
  assert.match(ui, /buildFallbackReviewGroupsFromDraftPacket\(state\.report\?\.draftPacketItems \|\| \{\}\)/, 'UI should fallback to draft packet arrays when report metadata groups are missing.');
  assert.match(ui, /REVIEW_PRIMARY_DRAFT_SECTIONS = \[[\s\S]*'vocabulary'[\s\S]*'concepts'[\s\S]*'referenceFormulas'[\s\S]*\]/, 'Fallback rows should be sourced from vocabulary/concepts/referenceFormulas arrays.');
}

function assertNeedsReviewIsReviewableAndSelectable() {
  assert.match(ui, /function getItemReviewWorkflowStatus\(item\)/, 'UI should resolve review workflow status from reviewStatus\\/status fields.');
  assert.match(ui, /function isItemNeedingTeacherReview\(item\) \{\s*return isPendingReviewStatus\(getItemReviewWorkflowStatus\(item\)\);\s*\}/, 'Reviewable-row checks should use shared status normalization.');
  assert.match(ui, /function isPendingReviewStatus\(reviewStatus\) \{[\s\S]*normalized === 'pending'[\s\S]*normalized === 'needs_review'[\s\S]*normalized === 'needs-review'/, 'pending and needs_review status variants should be reviewable.');
  assert.match(ui, /if \(filterId === 'needsReview'\) \{\s*return isItemNeedingTeacherReview\(item\);\s*\}/, 'Needs Review filter should use the same reviewable-status rule as row counting.');
  assert.match(ui, /function getVisibleReviewItems\(\) \{[\s\S]*\.filter\(\(item\) => isItemNeedingTeacherReview\(item\)\)/, 'Visible review rows should include pending\\/needs_review items consistently.');
  assert.match(ui, /function isReviewItemSafeToAccept\(item\) \{[\s\S]*!isItemNeedingTeacherReview\(item\)/, 'needs_review rows should remain valid/selectable in action bar counts.');
  assert.match(ui, /function hasMissingRequiredReviewFields\(item\)/, 'review acceptance should only skip rows missing required fields.');
}

function assertNeedsReviewCopyIsNotUnsafe() {
  assert.match(ui, /unreviewable item/, 'UI copy should describe blocked rows as unreviewable.');
  assert.doesNotMatch(ui, /unsafe selected item/, 'UI copy should avoid calling normal needs_review rows unsafe.');
  assert.match(ui, /repair-failed, or missing-required-field/, 'Skip reasons should match true invalid\\/quarantine\\/repair-failed cases.');
  assert.match(ui, /function countFailedAfterRetrySections\(coverage = \{\}\)/, 'Failed-after-retry summary should be derived from coverage summary/sourceManifest.');
}

function assertSummaryAndEmptyMessageUseDraftArrays() {
  assert.match(ui, /function hasAnyPrimaryDraftItems\(\)/, 'UI should explicitly check draft packet arrays before showing no-draft copy.');
  assert.match(ui, /if \(state\.reviewListFilter === 'all' && !hasAnyPrimaryDraftItems\(\)\)/, 'No-draft message should only appear when primary arrays are truly empty.');
  assert.match(ui, /All items in this draft have already been reviewed\./, 'When no pending rows remain, Page 2 should show a current-draft completion message.');
  assert.match(ui, /draft items found • .* need review/, 'Summary line should report item counts needing review.');
  assert.match(ui, /const processedChunks = Number\(coverage\.processedChunks \|\| 0\);[\s\S]*if \(processedChunks > 0\) return processedChunks;/, 'Sections checked should reflect processed chunks/pages when coverage metadata is present.');
}

function assertFailedSectionMessaging() {
  const summaryRenderer = ui.match(/function renderReviewNeedsReviewSummary\(draft = \{\}\) \{([\s\S]*?)\n  function renderReviewTable/);
  assert.ok(summaryRenderer, 'Expected renderReviewNeedsReviewSummary function.');
  assert.match(summaryRenderer[1], /buildTeacherFriendlyFailedSections\(coverage\)/, 'Main failed-section box should use teacher-friendly failed section summaries.');
  assert.match(summaryRenderer[1], /section\.sourceLocation\)\}: \$\{escapeHtml\(section\.reason\)\}/, 'Main failed-section list should only show source location and short reason.');
  assert.doesNotMatch(summaryRenderer[1], /Backend error JSON/, 'Main failed-section box should not show backend JSON errors.');
  assert.doesNotMatch(summaryRenderer[1], /rawModelResponsePath/, 'Main failed-section box should not show raw model response paths.');
  assert.doesNotMatch(summaryRenderer[1], /formatFailedBatchDetail/, 'Main failed-section box should not render technical failed-batch details directly.');

  assert.match(ui, /function summarizeTeacherFailedSectionReason\(errors\)/, 'Failed section reason should be translated to short teacher-friendly copy.');
  assert.match(ui, /The local model returned incomplete output\./, 'Teacher-friendly fallback reason should be available for incomplete local-model output.');
}

function assertTechnicalReportErrorsStayInAdvancedDetails() {
  assert.match(ui, /state\.report\?\.technicalErrors/, 'Report technical errors should be captured for Advanced details.');
  assert.match(ui, /state\.report\?\.errors/, 'Report route errors should be shown under Advanced details.');
  assert.match(ui, /renderIssueList\('Technical warnings', technicalWarnings\)/, 'Technical issues should remain in Advanced details.');
}

function assertPrimaryFlowDoesNotShowManualPreviewOrBatchSizeInstructions() {
  assert.doesNotMatch(ui, /Run preview first/i, 'Primary teacher flow should not require running preview first.');
  assert.doesNotMatch(ui, /lower batch size/i, 'Primary teacher flow should not ask teachers to lower batch size.');
  assert.doesNotMatch(ui, /Adjust the preview page range/i, 'Primary teacher flow should not direct manual preview range tuning.');
}

function assertReviewCanceledMessageClearsOnSuccessfulDraftLoad() {
  assert.match(ui, /function clearStaleReviewCanceledMessage\(\)/, 'UI should define a stale cancel-message cleaner.');
  assert.match(ui, /function clearDraftScopedReviewUiState\(\)/, 'UI should define draft-scoped review-state reset helper.');
  assert.match(ui, /clearDraftScopedReviewUiState\(\);[\s\S]*await loadSelectedDraftReport\(\);/, 'Draft switching should clear stale draft-scoped review messages before loading next report.');
  assert.match(ui, /clearDraftScopedReviewUiState\(\);[\s\S]*setStatus\('Loading selected draft report\.\.\.'\);/, 'Draft report reload should clear stale draft-scoped state and set a neutral loading status.');
  assert.match(ui, /clearStaleReviewCanceledMessage\(\);[\s\S]*reconcileSelectedReviewItem\(\)/, 'Successful draft report loads should clear stale cancel copy.');
}

function assertAcceptBehavior() {
  const acceptSelected = ui.match(/async function acceptSelectedReviewItems\(\) \{([\s\S]*?)\n  async function acceptAllReviewItems/);
  assert.ok(acceptSelected, 'Expected acceptSelectedReviewItems function.');
  assert.match(acceptSelected[1], /state\.selectedReviewItemKeys\.includes/, 'Accept Selected should only use checked rows.');

  const acceptAll = ui.match(/async function acceptAllReviewItems\(\) \{([\s\S]*?)\n  async function acceptReviewItems/);
  assert.ok(acceptAll, 'Expected acceptAllReviewItems function.');
  assert.match(acceptAll[1], /const items = getVisibleReviewItems\(\)/, 'Accept All should use all generated reviewable rows.');
  assert.match(ui, /moveToNextDraftNeedingReview/, 'Accept actions should auto-advance to the next draft pack needing review.');
}

function assertCollapsedDetails() {
  assert.match(ui, /<details class="teacher-content-review-advanced-details" data-review-advanced-details>/, 'Technical details should be collapsed behind Advanced details.');
  assert.match(ui, /<summary>Advanced details<\/summary>/, 'Advanced details summary should be explicit.');
  assert.match(ui, /renderIssueList\('Technical warnings', technicalWarnings\)/, 'Technical warnings should be moved under Advanced details.');

  const rowRenderer = ui.match(/function renderReviewTableRow\(item\) \{([\s\S]*?)\n  function renderReviewAdvancedDetails/);
  assert.ok(rowRenderer, 'Expected renderReviewTableRow function.');
  assert.match(rowRenderer[1], /<details class="teacher-content-review-source-details" data-review-source-details>/, 'Source snippet should be collapsed by default.');
  assert.match(rowRenderer[1], /<summary>Show source<\/summary>/, 'Source snippet should use Show source toggle.');
}

function assertPausedStandardsWarningsAreDeemphasized() {
  assert.match(ui, /PAUSED_STANDARDS_WARNING_PATTERNS/, 'UI should define paused-standards warning filters.');
  assert.match(ui, /function isPausedStandardsWarning\(/, 'UI should filter paused-standards warning clutter.');
  assert.doesNotMatch(ui, /state\.errors\.push\(`Warning:/, 'Warnings should not be pushed into the main warning\\/error banner list.');
}

function assertDonePage() {
  const doneCard = ui.match(/function renderReviewDoneCard\(\) \{([\s\S]*?)\n  function renderReviewSummaryLine/);
  assert.ok(doneCard, 'Expected renderReviewDoneCard function.');
  assert.match(doneCard[1], /Import review is complete for this draft session\./, 'Page 3 should contain completion message.');
  assert.match(doneCard[1], /data-review-done-pack-name/, 'Page 3 should show the saved pack name.');
  assert.match(doneCard[1], /Manage Knowledge Packs/, 'Page 3 should include a link/button to open saved-pack management.');
  assert.doesNotMatch(doneCard[1], /data-knowledge-pack-manager|renderApprovedPacksCard\(\)/, 'Done page should not render full saved-pack management cards.');

  assert.doesNotMatch(doneCard[1], /data-review-table-row|data-review-selection-checkbox|data-review-selection-item-key|Accept Selected|Accept All/, 'Page 3 should not contain review rows or selection controls.');

  const acceptReview = ui.match(/async function acceptReviewItems\(items, options = \{\}\) \{([\s\S]*?)\n  function closeReviewItem/);
  assert.ok(acceptReview, 'Expected acceptReviewItems function.');
  assert.match(acceptReview[1], /moveToNextDraftNeedingReview/, 'Successful accept should try to move to next pending draft before Done.');
}

function assertTeacherContentEntryPointVisible() {
  assert.match(bladeUi, /Knowledge Packs/, 'Teacher-content entry label should be visible and direct.');
  assert.match(bladeUi, /Build Knowledge Pack/, 'Teacher-content entry should include a clear create button.');
  assert.match(bladeUi, /Upload class notes, slides, readings, and review them before student use\./, 'Teacher-content entry should include clear subtext.');
  assert.match(bladeUi, /data-main-knowledge-pack-manager/, 'Teacher Profile blade should include the saved knowledge-pack manager shell.');
  assert.match(style, /\.teacher-content-entry-card \.small-button \{[\s\S]*border:/, 'Teacher-content entry CTA should be visible without hover.');
  assert.match(style, /\.teacher-content-required-glow/, 'Neon glow class should exist for import-profile validation.');
}

function assertPackageScript() {
  assert.equal(pkg.scripts['test:teacher-content-ui'], 'node scripts/test-teacher-content-ui.js');
}

function assertTeacherContentAdapterAndRouteTestsStillPass() {
  const adapter = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'test-teacher-content-adapter.js')], {
    cwd: projectRoot,
    encoding: 'utf8'
  });
  assert.equal(adapter.status, 0, `teacher-content adapter tests should pass.\nstdout:\n${adapter.stdout}\nstderr:\n${adapter.stderr}`);

  const routes = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'test-teacher-content-routes.js')], {
    cwd: projectRoot,
    encoding: 'utf8'
  });
  assert.equal(routes.status, 0, `teacher-content route tests should pass.\nstdout:\n${routes.stdout}\nstderr:\n${routes.stderr}`);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function compileUiFunction(functionName, dependencyNames = []) {
  const source = extractFunctionSource(ui, functionName);
  const dependencySources = dependencyNames.map((name) => extractFunctionSource(ui, name)).join('\n');
  const factory = new Function(`\n${dependencySources}\n${source}\nreturn ${functionName};\n`);
  return factory();
}

function extractFunctionSource(source, functionName) {
  const startToken = `function ${functionName}(`;
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `Expected function ${functionName} in teacher-content-ui.js.`);
  let braceIndex = source.indexOf('{', start);
  assert.ok(braceIndex >= 0, `Expected opening brace for ${functionName}.`);
  let depth = 0;
  for (let index = braceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error(`Unable to extract function ${functionName}.`);
}
