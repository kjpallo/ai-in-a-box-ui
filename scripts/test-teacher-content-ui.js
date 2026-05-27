const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const uiPath = path.join(projectRoot, 'public', 'teacher-content-ui.js');
const stylePath = path.join(projectRoot, 'public', 'style.css');
const packagePath = path.join(projectRoot, 'package.json');
const routeTestPath = path.join(projectRoot, 'scripts', 'test-teacher-content-routes.js');

const ui = read(uiPath);
const style = read(stylePath);
const routeTest = read(routeTestPath);
const pkg = JSON.parse(read(packagePath));

assertTwoPrimaryScreens();
assertUploadScreenIsSimple();
assertReviewScreenIsSimpleList();
assertReviewScreenUsesReviewActionFooter();
assertReviewAcceptanceRequiresApprovedCounterpart();
assertAcceptSelectedCreatesSelectedOnlyPack();
assertAcceptAllCreatesApprovedOnlyPack();
assertDeleteMarksRejectedAndHidesRows();
assertEditUsesSafeFields();
assertFocusedEditRefreshesBeforeApproval();
assertSuccessReturnsToKnowledgeManager();
assertPrimaryFlowHidesTechnicalImportControls();
assertRouterAndFormulaGuardsRemainInRouteTests();
assertPackageScript();
assertTeacherContentRouteTestsStillPass();

console.log('Teacher content UI tests passed.');

function assertTwoPrimaryScreens() {
  const tabsBlock = ui.match(/const TABS = \[([\s\S]*?)\n  \];/);
  assert.ok(tabsBlock, 'Expected TABS definition.');
  assert.match(tabsBlock[1], /id: 'upload', label: 'Upload'/, 'Screen 1 should be Upload.');
  assert.match(tabsBlock[1], /id: 'review', label: 'Review'/, 'Screen 2 should be Review.');
  assert.doesNotMatch(tabsBlock[1], /complete|previewImport|reviewPreview|fullImport|approvedPacks/, 'Primary import screens should only be Upload and Review.');
  assert.match(ui, /Import workflow: Upload, then Review\./, 'Modal copy should describe the two-step workflow.');
}

function assertUploadScreenIsSimple() {
  const uploadCard = extractFunctionSource(ui, 'renderUploadSourceCard');
  assert.match(uploadCard, /teacherContentUploadFile/, 'Upload screen should include file input.');
  assert.match(uploadCard, /multiple/, 'Upload input should support one or more files.');
  assert.match(uploadCard, /teacherContentImportProfile/, 'Upload screen should include import profile selector.');
  assert.match(uploadCard, /teacherContentKnowledgeName/, 'Upload screen should include optional pack name field.');
  assert.match(uploadCard, /Analyze Upload/, 'Upload screen should include Analyze Upload action.');
  assert.match(uploadCard, /data-upload-technical-details/, 'Technical upload details may remain collapsed.');
}

function assertReviewScreenIsSimpleList() {
  const reviewCard = extractFunctionSource(ui, 'renderReviewCard');
  const rowRenderer = extractFunctionSource(ui, 'renderReviewTableRow');
  const actionBar = extractFunctionSource(ui, 'renderReviewActionBar');

  assert.match(reviewCard, /renderReviewTable\(filteredItems\)/, 'Review screen should render a single list immediately.');
  assert.match(reviewCard, /renderReviewTable\(filteredItems\)[\s\S]*renderReviewActionBar\(filteredItems, reviewState\)/, 'Review action bar should render after visible rows as the review footer.');
  assert.doesNotMatch(reviewCard, /renderReviewFilters\(\)|renderReviewIssuesToFix\(/, 'Review screen should not show competing filter or issue panels in the primary path.');
  assert.match(rowRenderer, /data-review-selection-checkbox/, 'Each row should include a checkbox.');
  assert.match(rowRenderer, /data-review-item-category/, 'Each row should show an item type label.');
  assert.match(rowRenderer, /data-review-item-wording/, 'Each row should show a main content preview.');
  assert.match(rowRenderer, /data-review-edit/, 'Each row should include Edit.');
  assert.match(rowRenderer, /Delete/, 'Each row should include Delete.');
  assert.doesNotMatch(rowRenderer, /Approve item|Reject \/ Exclude/, 'Rows should not expose extra competing approve/reject actions.');
  assert.match(actionBar, /data-review-accept-selected/, 'Bottom bar should include Accept Selected.');
  assert.match(actionBar, /data-review-accept-all/, 'Bottom bar should include Accept All.');
  assert.match(actionBar, /data-review-cancel/, 'Bottom bar should include Cancel.');
  assert.match(actionBar, /data-review-cancel[\s\S]*data-review-accept-selected[\s\S]*data-review-accept-all/, 'Review footer actions should be ordered Cancel, Accept Selected, Accept All.');
  assert.doesNotMatch(actionBar, /data-review-select-all|data-review-exclude-selected-flagged|data-review-reject-blockers-promote/, 'Bottom bar should not show old bulk technical actions.');
  assert.match(style, /\.teacher-content-review-card\.teacher-content-review-table-row \{[\s\S]*grid-template-columns: 36px minmax\(110px, 0\.42fr\) minmax\(220px, 1fr\) auto;/, 'Review rows should be laid out as checkbox, type, preview, actions.');
}

function assertReviewScreenUsesReviewActionFooter() {
  const renderFooter = extractFunctionSource(ui, 'renderFooter');
  const actionBar = extractFunctionSource(ui, 'renderReviewActionBar');

  assert.match(renderFooter, /footer\.hidden = state\.activeTab === 'review'/, 'The old Back/Next wizard footer should be hidden on the Review screen.');
  assert.match(actionBar, /const acceptSelectedDisabled = state\.reviewActionLoading \|\| state\.promotionActionLoading \|\| totalSelected === 0 \|\| safeSelected === 0/, 'Accept Selected should be disabled until at least one valid visible row is checked.');
  assert.match(actionBar, /const acceptAllDisabled = state\.reviewActionLoading \|\| state\.promotionActionLoading \|\| safeAll === 0/, 'Accept All should be enabled when at least one visible valid row exists.');
}

function assertReviewAcceptanceRequiresApprovedCounterpart() {
  const queueList = extractFunctionSource(ui, 'renderReviewQueueList');
  const queueBuilder = extractFunctionSource(ui, 'buildReviewQueuePacks');
  const acceptedCheck = extractFunctionSource(ui, 'isCurrentSelectedDraftAccepted');
  const emptyActionBar = extractFunctionSource(ui, 'renderReviewEmptyQueueActionBar');
  const cleanupDraft = extractFunctionSource(ui, 'cleanupDraftPackFromReviewQueue');

  assert.match(queueBuilder, /hasApproved: Boolean\(approved\)/, 'Draft queue cards should explicitly track whether an approved counterpart exists.');
  assert.match(queueBuilder, /summary\.pending === 0 && reviewed > 0\) statusLabel = 'reviewed'/, 'Fully reviewed drafts without approved counterparts should not be labeled accepted.');
  assert.match(acceptedCheck, /pack\.hasApproved === true/, 'Accepted UI state should require a matching approved pack.');
  assert.match(queueList, /pack\.hasApproved \?[\s\S]*data-review-pack-open-approved/, 'Open approved pack should only render when an approved counterpart exists.');
  assert.match(queueList, /pack\.hasApproved && pack\.packId \?[\s\S]*data-review-pack-remove/, 'Remove accepted draft copy should only render when an approved counterpart exists.');
  assert.match(emptyActionBar, /No approved pack exists for this draft/, 'Empty stale drafts should not claim they were accepted.');
  assert.match(emptyActionBar, /data-review-pack-cleanup/, 'Empty stale drafts should offer cleanup from the review queue.');
  assert.match(cleanupDraft, /ENDPOINTS\.draftReviewQueue\(safePackId\)/, 'Stale draft cleanup should use the review-queue cleanup endpoint, not accepted-copy archive.');
}

function assertAcceptSelectedCreatesSelectedOnlyPack() {
  const acceptSelected = extractFunctionSource(ui, 'acceptSelectedReviewItems');
  const acceptReview = extractFunctionSource(ui, 'acceptReviewItems');
  const requestPromotion = extractFunctionSource(ui, 'requestDraftPromotion');

  assert.match(acceptSelected, /state\.selectedReviewItemKeys\.includes/, 'Accept Selected should only use checked rows.');
  assert.match(acceptSelected, /promotionMode: 'selectedOnly'/, 'Accept Selected should use selectedOnly promotion mode.');
  assert.match(acceptSelected, /selectedItems: safeItems\.map\(makePromotionSelectionItem\)/, 'Accept Selected should send explicit selected rows to promotion.');
  assert.match(acceptSelected, /autoPromoteAfterAccept: true/, 'Accept Selected should create the approved JSON pack after approving rows.');
  assert.match(acceptSelected, /if \(skipped > 0\) \{[\s\S]*Accept Selected is blocked/, 'Unsafe selected rows should block Accept Selected with a clear message.');
  assert.match(acceptReview, /requestDraftPromotion\(draftPackIdAtStart, \{[\s\S]*promotionMode: options\.promotionMode \|\| 'approvedOnly'[\s\S]*selectedItems/, 'Accept flow should pass promotion mode and selected items to the backend.');
  assert.match(requestPromotion, /promotionMode: options\.promotionMode \|\| options\.mode/, 'Promotion request should include a safe promotion mode.');
  assert.match(requestPromotion, /selectedItems: Array\.isArray\(options\.selectedItems\)/, 'Promotion request should include selected row refs when provided.');
}

function assertAcceptAllCreatesApprovedOnlyPack() {
  const acceptAll = extractFunctionSource(ui, 'acceptAllReviewItems');
  assert.match(acceptAll, /const items = getVisibleReviewItems\(\)/, 'Accept All should use visible review rows.');
  assert.match(acceptAll, /items\.filter\(isReviewItemReadyForPack\)/, 'Accept All should only include valid visible rows.');
  assert.match(acceptAll, /promotionMode: 'approvedOnly'/, 'Accept All should use approvedOnly promotion mode.');
  assert.match(acceptAll, /autoPromoteAfterAccept: true/, 'Accept All should create the approved JSON pack.');
}

function assertDeleteMarksRejectedAndHidesRows() {
  const rowRenderer = extractFunctionSource(ui, 'renderReviewTableRow');
  const visibleItems = extractFunctionSource(ui, 'getVisibleReviewItems');
  const simpleVisibility = extractFunctionSource(ui, 'isItemVisibleInSimpleReviewList');

  assert.match(rowRenderer, /data-review-status="rejected"[\s\S]*>Delete</, 'Delete should send rejected reviewStatus.');
  assert.match(visibleItems, /isItemVisibleInSimpleReviewList/, 'Visible review rows should use simple visibility filtering.');
  assert.match(simpleVisibility, /status !== 'rejected'/, 'Rejected rows should be hidden from the simple review list.');
}

function assertEditUsesSafeFields() {
  const editableFields = ui.match(/const EDITABLE_FIELDS = \{([\s\S]*?)\n  \};/);
  const focusedEditor = extractFunctionSource(ui, 'renderFocusedReviewItemFix');
  assert.ok(editableFields, 'Expected editable field map.');
  assert.match(focusedEditor, /EDITABLE_FIELDS\[item\.section\]/, 'Focused editor should use the UI mirror of SAFE_EDIT_FIELDS.');
  assert.doesNotMatch(editableFields[1], /solverStatus/, 'Formula solverStatus should not be teacher-editable.');
}

function assertFocusedEditRefreshesBeforeApproval() {
  const focusedEditor = extractFunctionSource(ui, 'renderFocusedReviewItemFix');
  const saveEdits = extractFunctionSource(ui, 'saveFocusedReviewItemEditsFromButton');
  const statusButton = extractFunctionSource(ui, 'updateReviewStatusFromButton');
  const reconcile = extractFunctionSource(ui, 'reconcileSelectedReviewItem');
  const conflictRefresh = extractFunctionSource(ui, 'refreshFocusedReviewItemAfterConflict');
  const approveWithEdits = extractFunctionSource(ui, 'approveSelectedReviewItemWithCurrentEdits');

  assert.match(focusedEditor, /data-review-save-edits[\s\S]*Save changes/, 'Focused editor should expose Save changes as a primary item action.');
  assert.match(focusedEditor, /Approve item[\s\S]*Delete item[\s\S]*Return to review list/, 'Focused editor should expose approve, delete, and return actions together.');
  assert.match(saveEdits, /collectReviewFieldEdits\(item, scope\)/, 'Focused save should collect safe editable field changes from the focused panel.');
  assert.match(saveEdits, /ENDPOINTS\.draftItem\(state\.selectedDraftPackId, refreshedItem\.section, refreshedItem\.index\)/, 'Focused save should use the draft item edit endpoint.');
  assert.match(saveEdits, /await refreshSelectedDraftReportFromBackend\(\)/, 'Focused save should refresh the selected draft report after edit.');
  assert.match(saveEdits, /refreshedItem = refreshFocusedReviewItemState\(refreshedItem, itemRef\)/, 'Focused save should replace active focused item state with the refreshed item.');
  assert.match(statusButton, /const currentItemRef = buildReviewItemRef\(matchedItem\)/, 'Focused approve should rebuild the item ref from the latest matched item.');
  assert.match(statusButton, /\(detailPanel \|\| focusedPanel\) && currentItemRef \? currentItemRef/, 'Focused approve should prefer the refreshed item ref over stale button attrs.');
  assert.match(reconcile, /state\.activeFixItem = makeActiveFixItem\(nextFix/, 'Reconcile should refresh active focused item identity after report updates.');
  assert.match(conflictRefresh, /await refreshSelectedDraftReportFromBackend\(\)/, '409 conflict recovery should refresh the selected draft report.');
  assert.match(conflictRefresh, /This item was refreshed\. Try the action again\./, 'Conflict recovery should have a helpful refreshed-item fallback message.');
  assert.match(approveWithEdits, /This item was refreshed\. Try approving again\./, 'Approve conflicts should ask the teacher to retry after automatic refresh.');
}

function assertSuccessReturnsToKnowledgeManager() {
  const acceptReview = extractFunctionSource(ui, 'acceptReviewItems');
  const focusManager = extractFunctionSource(ui, 'focusKnowledgeManager');
  assert.match(acceptReview, /focusKnowledgeManager\(state\.reviewBulkMessage\)/, 'Successful approval should return to saved knowledge pack manager.');
  assert.match(acceptReview, /stays Disabled for student answers until you enable it/, 'Success copy should preserve activation safety.');
  assert.match(focusManager, /window\.Charlemagne\?\.blades\?\.open\?\.\('ai-improvement'/, 'Saved manager focus should open the Knowledge blade.');
}

function assertPrimaryFlowHidesTechnicalImportControls() {
  const tabsBlock = ui.match(/const TABS = \[([\s\S]*?)\n  \];/)[1];
  const uploadCard = extractFunctionSource(ui, 'renderUploadSourceCard');
  const reviewCard = extractFunctionSource(ui, 'renderReviewCard');

  assert.doesNotMatch(tabsBlock, /Preview|Full Import|Selected Range|Batch/i, 'Preview/full/batch concepts should not be primary screens.');
  assert.doesNotMatch(uploadCard, /Run Preview Draft|Run Full Document Import|Import page range|Max preview chars/, 'Preview/full/range controls should not be shown in the primary upload screen.');
  assert.doesNotMatch(reviewCard, /Preview Draft|Full Import|batch size|selected range/i, 'Review screen should not expose preview/full-import controls.');
  assert.match(uploadCard, /<details class="teacher-content-upload-details" data-upload-technical-details>/, 'Technical details should remain collapsed.');
}

function assertRouterAndFormulaGuardsRemainInRouteTests() {
  assert.match(routeTest, /lib\/router\//, 'Route tests should guard router files.');
  assert.match(routeTest, /lib\/formulas\//, 'Route tests should guard formula files.');
  assert.match(routeTest, /router\/student\/formula files should not be touched/, 'Route tests should assert protected files are not modified.');
  assert.match(routeTest, /teacher content routes should not import router\/student\/formula modules/, 'Route tests should assert protected modules are not imported.');
}

function assertPackageScript() {
  assert.equal(pkg.scripts['test:teacher-content-ui'], 'node scripts/test-teacher-content-ui.js');
}

function assertTeacherContentRouteTestsStillPass() {
  const routes = spawnSync(process.execPath, [routeTestPath], {
    cwd: projectRoot,
    encoding: 'utf8'
  });
  assert.equal(routes.status, 0, `teacher-content route tests should pass.\nstdout:\n${routes.stdout}\nstderr:\n${routes.stderr}`);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractFunctionSource(source, functionName) {
  const startToken = `function ${functionName}(`;
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `Expected function ${functionName} in teacher-content-ui.js.`);
  let braceIndex = -1;
  let parenDepth = 0;
  let sawSignatureParen = false;
  for (let index = start + `function ${functionName}`.length; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      parenDepth += 1;
      sawSignatureParen = true;
    } else if (char === ')') {
      parenDepth -= 1;
    } else if (char === '{' && sawSignatureParen && parenDepth === 0) {
      braceIndex = index;
      break;
    }
  }
  assert.ok(braceIndex >= 0, `Expected opening brace for ${functionName}.`);
  let depth = 0;
  for (let index = braceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract function ${functionName}.`);
}
