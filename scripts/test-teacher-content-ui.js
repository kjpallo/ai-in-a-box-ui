const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const uiEntryPath = path.join(projectRoot, 'public', 'teacher-content-ui.js');
const uiConstantsPath = path.join(projectRoot, 'public', 'teacher-content', 'constants.js');
const uiReviewActionsPath = path.join(projectRoot, 'public', 'teacher-content', 'review-actions.js');
const teacherContentModulePaths = [
  uiConstantsPath,
  path.join(projectRoot, 'public', 'teacher-content', 'state.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'utils.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'api.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'upload-queue.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'render-upload.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'render-review.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'render-approved.js'),
  uiReviewActionsPath,
  path.join(projectRoot, 'public', 'teacher-content', 'overlay.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'tabs.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'status.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'standards-panel.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'upload-controller.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'review-controller.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'approved-controller.js'),
  path.join(projectRoot, 'public', 'teacher-content', 'index.js')
];
const stylePath = path.join(projectRoot, 'public', 'style.css');
const packagePath = path.join(projectRoot, 'package.json');
const routeTestPath = path.join(projectRoot, 'scripts', 'test-teacher-content-routes.js');
const requiredStyleImports = [
  'base.css',
  'app-shell.css',
  'login.css',
  'blades.css',
  'teacher-content.css',
  'teacher-content-import.css',
  'teacher-content-review.css',
  'teacher-content-approved.css',
  'student.css',
  'teacher-dashboard.css',
  'responsive.css',
  'teacher-content-management.css',
  'voice.css'
];

const uiEntry = read(uiEntryPath);
const reviewActions = read(uiReviewActionsPath);
const ui = teacherContentModulePaths.map(read).join('\n');
const styleManifest = read(stylePath);
const style = readCssBundle(stylePath);
const routeTest = read(routeTestPath);
const pkg = JSON.parse(read(packagePath));

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  assertCompatibilityEntryLoadsModules();
  assertCssSplitReferencesRequiredFiles();
  assertTwoPrimaryScreens();
  assertUploadScreenIsSimple();
  assertReviewScreenIsSimpleList();
  assertReviewAggregatesAllQueuePacks();
  assertReviewScreenUsesReviewActionFooter();
  assertReviewSelectionPreservesScroll();
  assertSelectedLowConfidenceRowsCanBeAccepted();
  assertReviewAcceptanceRequiresApprovedCounterpart();
  assertFinalApproveUsesCombinedFinalPublish();
  assertAcceptSelectedUsesCombinedPackApproval();
  assertAcceptAllUsesCombinedPackApproval();
  assertDeleteMarksRejectedAndHidesRows();
  assertPostApprovalTeacherFriendlyCopy();
  assertTeacherFriendlyModelFailureUi();
  assertExcludeSelectedRoutesAcrossDraftPacks();
  assertEditActionKeepsDraftPackIdentity();
  assertEditUsesSafeFields();
  assertFocusedEditRefreshesBeforeApproval();
  assertSuccessReturnsToKnowledgeManager();
  assertPrimaryFlowHidesTechnicalImportControls();
  assertTeacherContentLayoutUsesWideReviewSpace();
  assertSavedKnowledgePackBulkDeleteUi();
  assertSavedKnowledgePacksShowEnabledStatus();
  assertSavedKnowledgePackItemEditUi();
  assertSavedKnowledgePacksHideApprovedDraftDuplicates();
  await assertSavedKnowledgePackBulkDeleteBehavior();
  assertRouterAndFormulaGuardsRemainInRouteTests();
  assertPackageScript();
  assertTeacherContentRouteTestsStillPass();

  console.log('Teacher content UI tests passed.');
}

function assertCompatibilityEntryLoadsModules() {
  assert.match(uiEntry, /const MODULE_SCRIPTS = \[/, 'Compatibility entry should define ordered teacher-content module scripts.');
  assert.match(uiEntry, /'\/teacher-content\/constants\.js'/, 'Compatibility entry should load constants module first.');
  assert.match(uiEntry, /'\/teacher-content\/index\.js'/, 'Compatibility entry should load index module.');
  [
    '/teacher-content/overlay.js',
    '/teacher-content/tabs.js',
    '/teacher-content/status.js',
    '/teacher-content/standards-panel.js',
    '/teacher-content/upload-controller.js',
    '/teacher-content/review-controller.js',
    '/teacher-content/approved-controller.js'
  ].forEach((modulePath) => {
    assert.match(uiEntry, new RegExp(`'${escapeRegExp(modulePath)}'`), `Compatibility entry should load ${modulePath}.`);
    assert.ok(uiEntry.indexOf(`'${modulePath}'`) < uiEntry.indexOf("'/teacher-content/index.js'"), `${modulePath} should load before index.js.`);
  });
  [
    'createOverlayModule',
    'createTabsModule',
    'createStatusModule',
    'createStandardsPanelModule',
    'createUploadControllerModule',
    'createReviewControllerModule',
    'createApprovedControllerModule'
  ].forEach((factoryName) => {
    assert.match(ui, new RegExp(`ns\\.${factoryName}\\s*=\\s*${factoryName}`), `Expected ${factoryName} to be exported on the teacher-content namespace.`);
  });
}

function assertCssSplitReferencesRequiredFiles() {
  const importPattern = /@import\s+url\("\.\/styles\/([^"]+)"\);/g;
  const imports = [...styleManifest.matchAll(importPattern)].map((match) => match[1]);
  assert.deepEqual(imports, requiredStyleImports, 'public/style.css should reference the split CSS files in cascade order.');

  for (const fileName of requiredStyleImports) {
    const filePath = path.join(projectRoot, 'public', 'styles', fileName);
    assert.ok(fs.existsSync(filePath), `Expected public/styles/${fileName} to exist.`);
  }
}

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
  const reviewTable = extractFunctionSource(ui, 'renderReviewTable');
  const sortControl = extractFunctionSource(ui, 'renderReviewSortControl');
  const rowRenderer = extractFunctionSource(ui, 'renderReviewTableRow');
  const actionBar = extractFunctionSource(ui, 'renderReviewActionBar');

  assert.match(reviewCard, /renderReviewTable\(filteredItems\)/, 'Review screen should render a single list immediately.');
  assert.match(reviewCard, /renderReviewTable\(filteredItems\)[\s\S]*renderReviewActionBar\(filteredItems, reviewState\)/, 'Review action bar should render after visible rows as the review footer.');
  assert.doesNotMatch(reviewCard, /renderReviewFilters\(\)|renderReviewIssuesToFix\(/, 'Review screen should not show competing filter or issue panels in the primary path.');
  assert.match(reviewTable, /data-review-combined-table/, 'Review should render one combined table shell.');
  assert.match(reviewTable, /renderReviewSortControl\('source', 'Source'\)/, 'Review table should include source sorting.');
  assert.match(reviewTable, /renderReviewSortControl\('itemType', 'Item Type'\)/, 'Review table should include item-type sorting.');
  assert.match(reviewTable, /renderReviewSortControl\('title', 'Title'\)/, 'Review table should include title sorting.');
  assert.match(reviewTable, /renderReviewSortControl\('status', 'Status \/ Warning'\)/, 'Review table should include status sorting.');
  assert.match(sortControl, /data-review-sort="\$\{escapeAttr\(sortKey\)\}"/, 'Sort controls should render with data-review-sort attributes.');
  assert.match(rowRenderer, /data-review-selection-checkbox/, 'Each row should include a checkbox.');
  assert.match(rowRenderer, /data-review-item-source/, 'Each row should show source pack or file.');
  assert.match(rowRenderer, /data-review-item-category/, 'Each row should show an item type label.');
  assert.match(rowRenderer, /data-review-item-title/, 'Each row should show title/term/name.');
  assert.match(rowRenderer, /data-review-item-wording/, 'Each row should show a main content preview.');
  assert.match(rowRenderer, /data-review-item-status-warning/, 'Each row should show status/warning details.');
  assert.match(rowRenderer, /data-review-edit/, 'Each row should include Edit.');
  assert.match(rowRenderer, /Delete/, 'Each row should include Delete.');
  assert.doesNotMatch(rowRenderer, /Approve item|Reject \/ Exclude/, 'Rows should not expose extra competing approve/reject actions.');
  assert.match(actionBar, /data-review-select-all/, 'Bottom bar should include Select all visible.');
  assert.match(actionBar, /data-review-clear-selection/, 'Bottom bar should include Clear selection.');
  assert.match(actionBar, /data-review-exclude-selected/, 'Bottom bar should include Exclude selected.');
  assert.match(actionBar, /data-review-accept-selected/, 'Bottom bar should include Accept Selected.');
  assert.match(actionBar, /data-review-accept-all/, 'Bottom bar should include Accept All.');
  assert.match(actionBar, /Accept All Valid/, 'Bottom bar should include Accept All Valid copy.');
  assert.doesNotMatch(actionBar, /data-review-exclude-selected-flagged|data-review-reject-blockers-promote/, 'Bottom bar should not show old bulk technical actions.');
  assert.match(style, /\.teacher-content-review-table-shell\[data-review-combined-table\] \.teacher-content-review-table-head,\s*\.teacher-content-review-table-shell\[data-review-combined-table\] \.teacher-content-review-table-row \{[\s\S]*grid-template-columns: 32px minmax\(140px, 0\.95fr\) minmax\(96px, 0\.55fr\) minmax\(140px, 0\.85fr\) minmax\(220px, 1\.3fr\) minmax\(170px, 1fr\) minmax\(120px, 0\.62fr\);/, 'Review rows should use wide but shrinkable combined table columns.');
  assert.match(style, /\.teacher-content-review-table-body \{[\s\S]*max-height: min\(64vh, 760px\);/, 'Review list should show multiple rows with a taller scroll area.');
  assert.match(style, /\.teacher-content-review-table-body \{[\s\S]*overflow-x: hidden;/, 'Review list should not force horizontal scrolling inside the table body.');
  assert.match(style, /@media \(max-width: 980px\) \{[\s\S]*\.teacher-content-review-table-shell\[data-review-combined-table\] \.teacher-content-review-table-row \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/, 'Review rows should stack before tablet widths can overflow sideways.');
}

function assertReviewAggregatesAllQueuePacks() {
  const queueList = extractFunctionSource(ui, 'renderReviewQueueList');
  const summaryLine = extractFunctionSource(ui, 'renderReviewSummaryLine');
  const allItems = extractFunctionSource(ui, 'getAllReviewItems');
  const itemsForPack = extractFunctionSource(ui, 'getReviewItemsForPack');
  const enrichIdentity = extractFunctionSource(ui, 'enrichReviewItemWithPackIdentity');
  const queueReports = extractFunctionSource(ui, 'refreshReviewQueueReports');
  const sortState = extractFunctionSource(ui, 'getSortedReviewItems');

  assert.match(queueList, /Reviewing .*draft packs together/i, 'Review queue copy should communicate queue-wide review context.');
  assert.match(summaryLine, /candidate items from .*sources/, 'Review summary should describe candidate rows across queue sources.');
  assert.match(allItems, /getReviewQueuePackIds\(\)/, 'Visible review rows should aggregate every queue pack.');
  assert.match(allItems, /flatMap\(\(packId\) => getAllReviewItemsForPack\(packId\)\)/, 'Aggregated review rows should flatten all queue pack rows.');
  assert.match(itemsForPack, /draftPackId/, 'Aggregated rows should preserve draft pack id identity.');
  assert.match(itemsForPack, /sourcePackName/, 'Aggregated rows should preserve source pack/file identity.');
  assert.match(enrichIdentity, /originalItemData/, 'Aggregated rows should preserve the original item data payload.');
  assert.match(queueReports, /ENDPOINTS\.draftReport\(packId, state\.selectedStandardsBankId\)/, 'Queue aggregation should fetch report data for every visible draft pack.');
  assert.match(queueReports, /activeDraftPackIds/, 'Queue report refresh should build an active draft pack id set.');
  assert.match(queueReports, /\.filter\(\(packId\) => activeDraftPackIds\.has\(packId\)\)/, 'Queue report refresh should only request draft reports for active draft pack ids.');
  assert.match(sortState, /reviewItemKeyForItem\(left\)\.localeCompare\(reviewItemKeyForItem\(right\)\)/, 'Sorting tie-breakers should use queue-wide row identity.');
}

function assertFinalApproveUsesCombinedFinalPublish() {
  const promoteSelectedDraft = extractFunctionSource(ui, 'promoteSelectedDraft');
  const requestDraftPromotion = extractFunctionSource(ui, 'requestDraftPromotion');
  const acceptAllReviewItems = extractFunctionSource(reviewActions, 'acceptAllReviewItems');
  const requestCombined = extractFunctionSource(reviewActions, 'requestCombinedReviewApproval');

  assert.match(requestDraftPromotion, /ENDPOINTS\.approveCombinedReview/, 'Final approve should use the combined review approval endpoint.');
  assert.match(requestDraftPromotion, /mode: 'final_publish'/, 'Final approve request should send final_publish mode.');
  assert.match(requestDraftPromotion, /draftPackId: safePackId/, 'Final approve request should send draftPackId.');
  assert.doesNotMatch(requestDraftPromotion, /selectedItems|rows:\s*\[|index:/, 'Final approve request should not send stale selected row indexes.');
  assert.match(promoteSelectedDraft, /state\.selectedReviewItemKeys = \[\]/, 'Final approve success should clear selected review item keys.');
  assert.match(promoteSelectedDraft, /archivedDrafts/, 'Final approve success should read archived draft metadata from combined approval response.');
  assert.match(promoteSelectedDraft, /state\.selectedDraftPackId = ''/, 'Final approve success should clear selected draft when archived.');
  assert.match(promoteSelectedDraft, /applyApprovedSummary\(data\.approvedSummary\)/, 'Final approve success should refresh approved summary.');
  assert.match(promoteSelectedDraft, /await refreshTeacherContentSummaries\(\)/, 'Final approve success should refresh draft and approved summaries.');
  assert.match(acceptAllReviewItems, /acceptReviewItems\(\[\], \{[\s\S]*mode: 'final_publish'/, 'Final review-screen Accept All should call combined approval using final_publish mode.');
  assert.match(acceptAllReviewItems, /draftPackId/, 'Final review-screen Accept All should pass draftPackId.');
  assert.match(requestCombined, /if \(mode === 'final_publish'\)[\s\S]*mode: 'final_publish'/, 'Review actions combined approval should branch for final_publish mode.');
  assert.match(requestCombined, /body: JSON\.stringify\(\{\s*mode: 'final_publish',\s*draftPackId: safeDraftPackId\s*\}\)/, 'Final publish payload should only include mode and draftPackId.');
  assert.doesNotMatch(acceptAllReviewItems, /safeItems|rows:\s*\[|selectedReviewItemKeys\.includes/, 'Final review-screen Accept All should not depend on selected row indexes.');
}

function assertReviewScreenUsesReviewActionFooter() {
  const renderFooter = extractFunctionSource(ui, 'renderFooter');
  const actionBar = extractFunctionSource(ui, 'renderReviewActionBar');
  const selectAllVisible = extractFunctionSource(ui, 'toggleSelectAllVisibleReviewItems');
  const setSort = extractFunctionSource(ui, 'setReviewSort');
  const clearSelection = extractFunctionSource(ui, 'clearReviewSelection');

  assert.match(renderFooter, /footer\.hidden = state\.activeTab === 'review'/, 'The old Back/Next wizard footer should be hidden on the Review screen.');
  assert.match(selectAllVisible, /const visible = getFilteredReviewItems\(getVisibleReviewItems\(\)\)/, 'Select all visible should use visible filtered rows.');
  assert.match(selectAllVisible, /if \(allSelected\) selected\.delete\(key\)/, 'Select all visible should toggle off when everything visible is selected.');
  assert.match(selectAllVisible, /else selected\.add\(key\)/, 'Select all visible should add all visible row keys when needed.');
  assert.match(setSort, /state\.reviewSortDirection = state\.reviewSortDirection === 'asc' \? 'desc' : 'asc'/, 'Sort controls should toggle direction when the same column is selected.');
  assert.match(clearSelection, /state\.selectedReviewItemKeys = \[\]/, 'Clear selection should clear selected row keys.');
  assert.match(actionBar, /const acceptSelectedDisabled = state\.reviewActionLoading \|\| state\.promotionActionLoading \|\| selectedRows\.length === 0 \|\| selectedReady === 0/, 'Accept Selected should stay disabled until at least one selected row is ready.');
  assert.match(actionBar, /const acceptAllDisabled = state\.reviewActionLoading \|\| state\.promotionActionLoading/, 'Accept All should only be disabled while actions are in progress.');
  assert.match(actionBar, /data-review-selected-needs-edit-count/, 'Review footer should include selected rows that still need edits/exclusion.');
}

function assertReviewSelectionPreservesScroll() {
  const updateSelection = extractFunctionSource(reviewActions, 'updateReviewSelection');
  const selectAllVisible = extractFunctionSource(reviewActions, 'toggleSelectAllVisibleReviewItems');
  const clearSelection = extractFunctionSource(reviewActions, 'clearReviewSelection');
  const renderPreservingScroll = extractFunctionSource(reviewActions, 'renderPreservingReviewScroll');
  const captureSnapshot = extractFunctionSource(reviewActions, 'captureReviewScrollSnapshot');
  const restoreSnapshot = extractFunctionSource(reviewActions, 'restoreReviewScrollSnapshot');

  assert.match(updateSelection, /renderPreservingReviewScroll\(\{ focusItemKey: itemKey \}\)/, 'Checkbox toggles should preserve review scroll position.');
  assert.match(selectAllVisible, /renderPreservingReviewScroll\(\)/, 'Select all visible should preserve review scroll position.');
  assert.match(clearSelection, /renderPreservingReviewScroll\(\)/, 'Clear selection should preserve review scroll position.');
  assert.match(captureSnapshot, /teacher-content-review-table-body/, 'Scroll snapshot should include review table body position.');
  assert.match(restoreSnapshot, /tableBody\.scrollTop = snapshot\.tableBodyScrollTop/, 'Scroll restore should reset review table body position.');
  assert.match(restoreSnapshot, /window\.scrollTo\(\{ top: snapshot\.windowY/, 'Scroll-preserving render should restore window scroll position.');
}

function assertSelectedLowConfidenceRowsCanBeAccepted() {
  const acceptSelected = extractFunctionSource(reviewActions, 'acceptSelectedReviewItems');
  const acceptReviewItems = extractFunctionSource(reviewActions, 'acceptReviewItems');
  const explainDisabled = extractFunctionSource(reviewActions, 'explainDisabledAcceptSelected');
  const selectableHelper = extractFunctionSource(ui, 'isReviewItemSelectableForAcceptSelected');
  const blockersHelper = extractFunctionSource(ui, 'getAcceptSelectedBlockersForItem');

  assert.match(acceptSelected, /selected\.filter\(isReviewItemSelectableForAcceptSelected\)/, 'Accept Selected should treat selected low-confidence-only rows as ready after teacher selection.');
  assert.match(acceptReviewItems, /\.filter\(isReviewItemSelectableForAcceptSelected\)/, 'Combined selected acceptance should use the selected-row readiness helper.');
  assert.match(blockersHelper, /isLowConfidenceOnlyPromotionBlockers\(approvalTargetBlockers\)/, 'Accept-selected blockers should clear low-confidence-only rows for teacher-verified selection.');
  assert.match(selectableHelper, /return getAcceptSelectedBlockersForItem\(item\)\.length === 0/, 'Row readiness for Accept Selected should depend on selected-row blocker helper.');
  assert.match(explainDisabled, /Blocking selected rows:/, 'Disabled Accept Selected message should name the selected blocking rows.');
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

function assertAcceptSelectedUsesCombinedPackApproval() {
  const acceptSelected = extractFunctionSource(ui, 'acceptSelectedReviewItems');
  const acceptReview = extractFunctionSource(ui, 'acceptReviewItems');
  const requestCombined = extractFunctionSource(ui, 'requestCombinedReviewApproval');

  assert.match(acceptSelected, /getFilteredReviewItems\(getVisibleReviewItems\(\)\)/, 'Accept Selected should operate on the aggregated visible review rows.');
  assert.match(acceptSelected, /state\.selectedReviewItemKeys\.includes/, 'Accept Selected should only use checked rows.');
  assert.match(acceptSelected, /one combined knowledge pack/i, 'Accept Selected confirmation should mention one combined knowledge pack.');
  assert.match(acceptReview, /requestCombinedReviewApproval\(readyItems, \{[\s\S]*mode[\s\S]*draftPackId: options\.draftPackId/, 'Accept flow should call combined approval with explicit mode and draftPackId options.');
  assert.match(requestCombined, /ENDPOINTS\.approveCombinedReview/, 'Combined approval request should use the combined review endpoint.');
  assert.match(requestCombined, /reviewBatchPackIds: getReviewQueuePackIds\(\)/, 'Combined approval should send queue pack ids so repeated accepts update one pack for the batch.');
  assert.match(requestCombined, /itemRef: buildReviewItemRef\(item\)/, 'Combined approval should send stable per-row refs.');
}

function assertAcceptAllUsesCombinedPackApproval() {
  const acceptAll = extractFunctionSource(ui, 'acceptAllReviewItems');
  assert.match(acceptAll, /const draftPackId = String\(state\.selectedDraftPackId \|\| ''\)\.trim\(\)/, 'Accept All should resolve the selected draft pack id before publishing.');
  assert.doesNotMatch(acceptAll, /getPromotableApprovedReviewItemCount\(\)/, 'Accept All should not require promotable approved item counts before final publish.');
  assert.match(acceptAll, /acceptReviewItems\(\[\], \{[\s\S]*mode: 'final_publish'[\s\S]*draftPackId/, 'Accept All should trigger final_publish without selected row payload.');
  assert.match(acceptAll, /Publish this draft now\?/, 'Accept All confirmation should communicate draft publish behavior.');
}

function assertDeleteMarksRejectedAndHidesRows() {
  const rowRenderer = extractFunctionSource(ui, 'renderReviewTableRow');
  const visibleItems = extractFunctionSource(ui, 'getVisibleReviewItems');
  const simpleVisibility = extractFunctionSource(ui, 'isItemVisibleInSimpleReviewList');
  const excludeSelected = extractFunctionSource(ui, 'excludeSelectedReviewItems');

  assert.match(rowRenderer, /data-review-status="rejected"[\s\S]*>Delete</, 'Delete should send rejected reviewStatus.');
  assert.match(excludeSelected, /reviewStatus: 'rejected'/, 'Exclude selected should set selected rows to rejected.');
  assert.match(excludeSelected, /const selected = getSelectedReviewItems\(\)/, 'Exclude selected should use selected rows.');
  assert.match(visibleItems, /isItemVisibleInSimpleReviewList/, 'Visible review rows should use simple visibility filtering.');
  assert.match(simpleVisibility, /status === 'rejected'[\s\S]*return false/, 'Rejected rows should be hidden from the simple review list.');
  assert.match(simpleVisibility, /status === 'approved'[\s\S]*getReviewItemPromotionBlockers\(item\)\.length > 0/, 'Accepted promotion-ready rows should leave the active review list while blocked approved rows remain visible.');
}

function assertPostApprovalTeacherFriendlyCopy() {
  const acceptReview = extractFunctionSource(ui, 'acceptReviewItems');
  const promoteSelectedDraft = extractFunctionSource(ui, 'promoteSelectedDraft');
  const rejectBlockersPromote = extractFunctionSource(ui, 'rejectBlockingItemsAndPromote');
  const doneCard = extractFunctionSource(ui, 'renderReviewDoneCard');
  const emptyActionBar = extractFunctionSource(ui, 'renderReviewEmptyQueueActionBar');
  const queueList = extractFunctionSource(ui, 'renderReviewQueueList');
  const routeSource = routeTest;

  assert.match(acceptReview, /Saved and enabled for student answers/, 'Accept Selected/Accept All success should say saved and enabled for student answers.');
  assert.match(acceptReview, /formatNumber\(acceptedCount\)/, 'Combined approval success should include accepted item count.');
  assert.match(acceptReview, /View it in Saved Knowledge Packs/, 'Combined approval success should point teachers to Saved Knowledge Packs.');
  assert.match(promoteSelectedDraft, /Saved and enabled for student answers/, 'Final approve success should say saved and enabled for student answers.');
  assert.match(promoteSelectedDraft, /focusKnowledgeManager\(`Saved and enabled for student answers/, 'Final approve should return teachers to Saved Knowledge Packs with success copy.');
  assert.match(rejectBlockersPromote, /Saved and enabled for student answers/, 'Approve valid items only success should use the same teacher-friendly copy.');
  assert.match(doneCard, /Saved and enabled for student answers/, 'Done state should confirm the pack is enabled for student answers.');
  assert.doesNotMatch(doneCard, /Enable it for student answers from the Knowledge blade when you are ready/, 'Done state should not use stale enable-later wording.');
  assert.match(emptyActionBar, /data-review-empty-approved-state[\s\S]*Saved and enabled for student answers/, 'Approved empty queue should show a completion message.');
  assert.match(emptyActionBar, /View in Saved Knowledge Packs/, 'Approved empty queue should offer Saved Knowledge Packs as the next action.');
  assert.match(queueList, /data-review-accepted-pack-state[\s\S]*Saved and enabled for student answers/, 'Accepted queue state should not look like active review.');
  assert.match(queueList, /View in Saved Knowledge Packs/, 'Accepted queue state should expose the saved-pack destination.');
  assert.doesNotMatch(ui, /does not change student answers yet/i, 'Teacher UI should not contain stale not-live wording.');
  assert.doesNotMatch(ui, /activation registry/i, 'Teacher UI should avoid technical activation-registry wording.');
  assert.match(read(path.join(projectRoot, 'routes', 'teacherContentRoutes.js')), /message: 'Saved and enabled for student answers\.'/, 'Promotion and combined route responses should include teacher-facing success copy.');
  assert.doesNotMatch(routeSource, /does not change student answers yet/i, 'Route tests should not preserve stale activation wording.');
}

function assertTeacherFriendlyModelFailureUi() {
  const progressMessage = extractFunctionSource(ui, 'makeUploadProgressTeacherMessage');
  const normalizeFailure = extractFunctionSource(ui, 'normalizePrepareReviewFailureMessage');
  const suggestions = extractFunctionSource(ui, 'makePrepareReviewRecoverySuggestions');
  const failureView = extractFunctionSource(ui, 'buildTeacherContentUploadFailureView');
  const progressPanel = extractFunctionSource(ui, 'renderUploadProgressErrorPanel');
  const preparePanel = extractFunctionSource(ui, 'renderPrepareReviewFailurePanel');
  const analysisPredicate = extractFunctionSource(ui, 'isTeacherContentAnalysisFailurePayload');
  const invalidPredicate = extractFunctionSource(ui, 'isInvalidModelResponsePayload');
  const unavailablePredicate = extractFunctionSource(ui, 'isModelUnavailablePayload');
  const crashPredicate = extractFunctionSource(ui, 'isModelRuntimeCrashPayload');
  const timeoutPredicate = extractFunctionSource(ui, 'isModelRuntimeTimeoutPayload');

  assert.match(progressMessage, /Charlemagne had trouble analyzing this file\./, 'Upload progress should use friendly model-analysis failure copy.');
  assert.doesNotMatch(progressMessage, /Local Gemma took too long while reading this batch|Local Gemma crashed while reading this batch/, 'Technical model runtime detail should not be the primary progress message.');
  assert.match(normalizeFailure, /model response was not valid json/, 'Prepare-review failures should recognize invalid model JSON.');
  assert.match(normalizeFailure, /Charlemagne had trouble analyzing this file\./, 'Prepare-review failures should normalize model issues to friendly copy.');
  assert.match(suggestions, /Try a smaller file, fewer pages, or text-only notes\./, 'Recovery guidance should suggest smaller/text-only content.');
  assert.match(suggestions, /retry analysis or remove this file from the queue/, 'Recovery guidance should explain retry/remove options.');
  assert.match(analysisPredicate, /isModelUnavailablePayload/, 'Teacher-friendly analysis failure detection should include unavailable Ollama.');
  assert.match(analysisPredicate, /isInvalidModelResponsePayload/, 'Teacher-friendly analysis failure detection should include bad model output.');
  assert.match(invalidPredicate, /model response was empty/, 'UI should recognize empty model results.');
  assert.match(unavailablePredicate, /econnrefused/, 'UI should recognize local Ollama connection failures.');
  assert.match(crashPredicate, /ama returned http 500/, 'UI should recognize Ollama HTTP 500 model-runner crashes.');
  assert.match(crashPredicate, /ggml_assert/, 'UI should recognize ggml crash details.');
  assert.match(timeoutPredicate, /local gemma took too long while reading this batch/, 'UI should recognize local Gemma timeout details.');
  assert.match(timeoutPredicate, /request timed out/, 'UI should recognize Ollama request timeout details.');
  assert.match(failureView, /Charlemagne could not finish analyzing this file\./, 'Failure panel should show one calm teacher-friendly headline.');
  assert.match(failureView, /The local model stopped, timed out, or returned an error/, 'Failure panel should show one concise teacher-facing explanation.');
  assert.match(failureView, /formatFailedBatchPageNotice\(failure\.failedBatches\)/, 'Partial imports should keep failed batch/page context in the teacher-facing explanation.');
  assert.match(failureView, /uniqueStrings\(\[[\s\S]*progressError\?\.backendDetails[\s\S]*makePrepareReviewBackendDetails\(failure\)[\s\S]*failure\?\.technicalErrors[\s\S]*formatFailedBatchDetail/, 'Backend, prepare-review, and failed-batch details should be deduped into one technical list.');
  assert.match(failureView, /\.slice\(0, 2\)/, 'Failure panel should show at most two action suggestions.');
  assert.match(progressPanel, /data-teacher-content-upload-failure-panel/, 'Upload progress failures should use the shared calm failure panel.');
  assert.match(preparePanel, /data-teacher-content-upload-failure-panel/, 'Prepare-review failures should use the shared calm failure panel.');
  assert.doesNotMatch(progressPanel, /data-upload-progress-error-failed/, 'Progress panel should not render a second teacher-facing failed-step line.');
}

function assertExcludeSelectedRoutesAcrossDraftPacks() {
  const excludeSelected = extractFunctionSource(ui, 'excludeSelectedReviewItems');
  assert.match(excludeSelected, /const draftPackId = String\(item\?\.draftPackId \|\| state\.selectedDraftPackId \|\| ''\)\.trim\(\)/, 'Exclude selected should route each row to its own draft pack.');
  assert.match(excludeSelected, /ENDPOINTS\.draftItemStatus\(draftPackId, item\.section, item\.index\)/, 'Exclude selected should PATCH the matching item in the matching source pack.');
  assert.match(excludeSelected, /await refreshReviewQueueReports\(\{ force: true, packIds: getReviewQueuePackIds\(\) \}\)/, 'Exclude selected should refresh queue-wide aggregated rows after multi-pack updates.');
}

function assertEditActionKeepsDraftPackIdentity() {
  const rowRenderer = extractFunctionSource(ui, 'renderReviewTableRow');
  const openFocused = extractFunctionSource(ui, 'openFocusedReviewItemFixFromButton');
  const findFromButton = extractFunctionSource(ui, 'findReviewItemFromButton');
  const identityAttrs = extractFunctionSource(ui, 'renderReviewItemIdentityDataAttrs');

  assert.match(rowRenderer, /data-draft-pack-id="\$\{escapeAttr\(item\.draftPackId \|\| state\.selectedDraftPackId \|\| ''\)\}"/, 'Each row should keep draft pack id in DOM identity attributes.');
  assert.match(identityAttrs, /data-draft-pack-id/, 'Identity attributes should include draft pack id.');
  assert.match(findFromButton, /const draftPackId = String\(button\?\.dataset\?\.draftPackId/, 'Find-from-button should resolve item identity with draft pack id.');
  assert.match(openFocused, /if \(targetDraftPackId && targetDraftPackId !== state\.selectedDraftPackId\)/, 'Edit should switch to the correct source draft pack before opening focused edit.');
  assert.match(openFocused, /await loadSelectedDraftReport\(\)/, 'Edit should load the selected draft pack report before opening.');
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
  assert.match(acceptReview, /combined knowledge pack/i, 'Success copy should mention combined knowledge pack output.');
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

function assertTeacherContentLayoutUsesWideReviewSpace() {
  assert.match(style, /\.teacher-content-overlay \{[\s\S]*align-items: stretch;/, 'Teacher content overlay should stretch the workspace vertically instead of centering a modal-sized card.');
  assert.match(style, /\.teacher-content-blade \{[\s\S]*width: min\(96vw, 1700px\);/, 'Teacher content blade should use substantially more browser width.');
  assert.match(style, /\.teacher-content-blade \{[\s\S]*height: calc\(100vh - 24px\);/, 'Teacher content blade should use the available browser height.');
  assert.doesNotMatch(style, /\.teacher-content-blade \{[\s\S]*width: min\(980px, calc\(100vw - 28px\)\);/, 'Teacher content blade should not force the old narrow modal width.');
  assert.doesNotMatch(style, /\.teacher-content-blade \{[\s\S]*width: min\(1560px, calc\(100vw - 28px\)\);/, 'Teacher content blade should not keep the previous smaller cap.');
  assert.match(style, /\.teacher-content-deck \{[\s\S]*display: grid;[\s\S]*padding: 10px 4px 12px;/, 'Teacher content deck should fill available space without burning horizontal padding.');
  assert.match(style, /\.teacher-content-card \{[\s\S]*min-height: 0;/, 'Teacher content cards should not reserve old modal-like minimum heights.');
  assert.match(style, /\.teacher-content-card\.active \{[\s\S]*height: 100%;[\s\S]*max-height: none;/, 'Active teacher content cards should fill and scroll inside the workspace.');
  assert.match(style, /\.teacher-content-upload-row \{[\s\S]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/, 'Upload controls should spread across the full workspace grid.');
  assert.match(style, /\.teacher-content-file-placeholder \{[\s\S]*grid-column: span 8;/, 'Upload file label should use the wide row instead of being squeezed between buttons.');
  assert.match(style, /\.teacher-content-card\.active > \.teacher-content-card-head \{[\s\S]*position: sticky;/, 'Teacher workflow headers should stay reachable while cards scroll.');
}

function assertSavedKnowledgePackBulkDeleteUi() {
  const manager = extractFunctionSource(ui, 'renderKnowledgeManager');
  const approvedRow = extractFunctionSource(ui, 'renderApprovedPack');
  const draftRow = extractFunctionSource(ui, 'renderDraftPack');
  const bulkActions = extractFunctionSource(ui, 'renderApprovedBulkActions');
  const singleDelete = extractFunctionSource(ui, 'deleteApprovedPack');
  const selectOne = extractFunctionSource(ui, 'toggleApprovedPackSelection');
  const selectAll = extractFunctionSource(ui, 'toggleApprovedPackSelectAll');
  const bulkDelete = extractFunctionSource(ui, 'deleteApprovedPacksById');
  const deleteSelected = extractFunctionSource(ui, 'deleteSelectedApprovedPacks');
  const deleteAll = extractFunctionSource(ui, 'deleteAllApprovedPacks');
  const visibleRows = extractFunctionSource(ui, 'getVisibleKnowledgePackRows');

  assert.match(manager, /teacher-content-simple-pack-shell/, 'Saved Knowledge Packs should wrap rows and bottom actions in a shared shell.');
  assert.match(manager, /teacher-content-simple-pack-list[\s\S]*renderApprovedBulkActions/, 'Bulk actions should render after the list so controls stay at the bottom.');
  assert.match(approvedRow, /data-approved-pack-select-checkbox/, 'Approved pack rows should render deletion selection checkboxes.');
  assert.match(draftRow, /data-approved-pack-select-checkbox/, 'Draft pack rows should render deletion selection checkboxes.');
  assert.match(draftRow, /data-approved-pack-delete-action/, 'Draft pack rows should support single delete actions.');
  assert.match(approvedRow, /data-approved-pack-activation-checkbox/, 'Approved pack rows should preserve activation checkboxes.');
  assert.match(bulkActions, /data-approved-pack-select-all-checkbox/, 'Bottom bulk controls should include Select all.');
  assert.match(bulkActions, /data-approved-pack-bulk-delete-action[\s\S]*Delete selected/, 'Bulk controls should include Delete selected.');
  assert.match(bulkActions, /selectedDisabled \? 'disabled'/, 'Delete selected should be disabled with no selected approved packs.');
  assert.match(bulkActions, /data-approved-pack-delete-all-action[\s\S]*Delete all/, 'Bulk controls should include Delete all.');
  assert.match(selectOne, /selected\.add\(packId\)/, 'Selecting one approved pack should add it to selection state.');
  assert.match(selectOne, /selected\.delete\(packId\)/, 'Unselecting one approved pack should remove it from selection state.');
  assert.match(visibleRows, /kind: 'draft'/, 'Visible pack rows should include draft rows.');
  assert.match(selectAll, /checkbox\.checked \? visiblePackIds : \[\]/, 'Select all should select or clear all visible pack IDs.');
  assert.match(singleDelete, /window\.confirm\('Are you sure you want to delete this knowledge pack\?'\)/, 'Single delete should use a simple browser confirmation.');
  assert.match(singleDelete, /if \(!confirmed\) return;/, 'Single delete cancel should skip backend delete.');
  assert.match(singleDelete, /body: JSON\.stringify\(\{ confirmed \}\)/, 'Single delete should send confirmed=true to backend.');
  assert.match(bulkDelete, /window\.confirm\(/, 'Bulk delete should use browser confirm instead of typed prompt.');
  assert.match(bulkDelete, /delete these selected knowledge packs/, 'Delete selected should use the required confirmation copy.');
  assert.match(bulkDelete, /delete all saved knowledge packs/, 'Delete all should use the required confirmation copy.');
  assert.match(bulkDelete, /if \(!confirmed\) return;/, 'Bulk delete cancel should skip backend delete.');
  assert.match(bulkDelete, /const count = selectedPacks\.length;/, 'Bulk delete should derive count from selected packs before using it.');
  assert.match(bulkDelete, /Deleting \$\{count\} knowledge pack/, 'Bulk delete should use defined count in status copy.');
  assert.match(bulkDelete, /confirmed: true/, 'Bulk delete should send confirmed=true to backend.');
  assert.match(bulkDelete, /packIds: selectedPacks\.map\(\(pack\) => pack\.packId\)/, 'Bulk delete should send selected/visible pack IDs based on helper input.');
  assert.match(bulkDelete, /console\.log\('\[knowledge-delete\] request'/, 'Bulk delete should log request details.');
  assert.match(bulkDelete, /console\.log\('\[knowledge-delete\] response'/, 'Bulk delete should log response details.');
  assert.match(bulkDelete, /console\.log\('\[knowledge-delete\] error'/, 'Bulk delete should log error details.');
  assert.match(bulkDelete, /ENDPOINTS\.approvedBulkDelete/, 'Bulk delete should call the approved bulk delete endpoint.');
  assert.match(bulkDelete, /state\.selectedApprovedPackIds = \[\]/, 'Bulk delete success should clear selected approved pack IDs.');
  assert.match(bulkDelete, /state\.approvedBulkDeleteMessage = 'Deleted pack from saved knowledge\.'/, 'Bulk delete success should use the required status message.');
  assert.match(bulkDelete, /await refreshTeacherContentSummaries\(\)/, 'Bulk delete should refresh teacher-content summaries after deletion.');
  assert.match(singleDelete, /console\.log\('\[knowledge-delete\] request'/, 'Single delete should log the delete request for debugging.');
  assert.match(singleDelete, /console\.log\('\[knowledge-delete\] response'/, 'Single delete should log the delete response for debugging.');
  assert.match(singleDelete, /Deleted pack from saved knowledge\./, 'Single delete success should use the required status message.');
  assert.match(singleDelete, /Delete failed\. Check console\/server logs\./, 'Single delete failures should use the required message.');
  assert.match(deleteSelected, /state\.selectedApprovedPackIds/, 'Delete selected should delete only selected approved pack IDs.');
  assert.match(deleteAll, /getVisibleKnowledgePackRows\(\)\.map/, 'Delete all should use the visible packs in this section.');
  assert.match(style, /\.teacher-content-blade-manager-shell \{[\s\S]*max-height: none;[\s\S]*overflow: hidden;/, 'Saved Knowledge Packs manager should stretch inside the blade.');
  assert.match(style, /\.teacher-content-simple-pack-shell \{[\s\S]*grid-template-rows: minmax\(0, 1fr\) auto;/, 'Saved Knowledge Packs should reserve bottom space for bulk controls.');
  assert.match(style, /\.teacher-content-simple-pack-list \{[\s\S]*overflow-y: auto;/, 'Saved Knowledge Packs rows should scroll inside the card.');
  assert.match(style, /\.teacher-content-simple-pack-row \{[\s\S]*grid-template-columns: 28px minmax\(0, 1\.35fr\) minmax\(180px, 0\.9fr\) minmax\(160px, auto\);/, 'Approved rows should align checkbox, title, activation, and actions without forcing wide minimum columns.');
  assert.match(style, /@media \(max-width: 980px\) \{[\s\S]*\.teacher-content-simple-pack-row \{[\s\S]*grid-template-columns: 28px minmax\(0, 1fr\);/, 'Saved Knowledge rows should stack before they can cause horizontal scrolling.');
  assert.match(routeTest, /assertDeleteSelectedRemovesApprovedAndDraftPacks/, 'Route tests should cover bulk deleting selected draft and approved packs.');
  assert.match(routeTest, /assertDeleteAllRemovesEveryVisiblePack/, 'Route tests should cover deleting all visible saved packs.');
  assert.match(routeTest, /assertDraftOnlyDeleteRemovesPackFromVisibleList/, 'Route tests should cover deleting draft-only rows.');
  assert.match(routeTest, /assertApprovedBulkDeletePathTraversalRejectedBeforeMutation/, 'Route tests should cover path traversal rejection before mutation.');
}

function assertSavedKnowledgePacksShowEnabledStatus() {
  const manager = extractFunctionSource(ui, 'renderKnowledgeManager');
  const approvedRow = extractFunctionSource(ui, 'renderApprovedPack');
  const draftRow = extractFunctionSource(ui, 'renderDraftPack');
  const countItems = extractFunctionSource(ui, 'countPackItems');
  const updatedAt = extractFunctionSource(ui, 'formatPackUpdatedAt');
  const activationToggle = extractFunctionSource(ui, 'toggleApprovedPackActivation');
  const routeSource = read(path.join(projectRoot, 'routes', 'teacherContentRoutes.js'));

  assert.match(manager, /Approved packs here can be available to student answers/, 'Saved Knowledge Packs header should explain student-answer availability.');
  assert.match(approvedRow, /data-approved-pack-enabled-badge/, 'Approved rows should show an enabled/disabled badge.');
  assert.match(approvedRow, /data-approved-pack-item-count/, 'Approved rows should show item count.');
  assert.match(approvedRow, /data-approved-pack-updated/, 'Approved rows should show last updated when available.');
  assert.match(approvedRow, /Available to student answers/, 'Enabled approved rows should say available to student answers.');
  assert.match(approvedRow, /Not available to student answers/, 'Disabled approved rows should say not available to student answers.');
  assert.match(draftRow, /data-draft-pack-item-count/, 'Draft rows should show item count.');
  assert.match(draftRow, /data-draft-pack-enabled-status/, 'Draft rows should show that they are not available to student answers.');
  assert.match(countItems, /Object\.values\(counts\)/, 'Saved pack item count helper should use itemCounts when available.');
  assert.match(updatedAt, /pack\.updatedAt \|\| pack\.activationUpdatedAt \|\| pack\.createdAt/, 'Saved pack updated helper should use existing timestamps.');
  assert.match(activationToggle, /Enabled for student answers\./, 'Enable route status should use teacher-facing enabled wording.');
  assert.match(activationToggle, /Disabled for student answers\./, 'Disable route status should use teacher-facing disabled wording.');
  assert.match(routeSource, /message: activation\.activationEnabled[\s\S]*Enabled for student answers\.[\s\S]*Disabled for student answers\./, 'Activation route response should avoid technical activation-setting success copy.');
}

function assertSavedKnowledgePackItemEditUi() {
  const endpoints = read(uiConstantsPath);
  const manager = extractFunctionSource(ui, 'renderKnowledgeManager');
  const approvedRow = extractFunctionSource(ui, 'renderApprovedPack');
  const editor = extractFunctionSource(ui, 'renderApprovedPackEditor');
  const editableItem = extractFunctionSource(ui, 'renderApprovedEditableItem');
  const editableField = extractFunctionSource(ui, 'renderApprovedEditableField');
  const openDetails = extractFunctionSource(ui, 'toggleApprovedPackDetails');
  const saveItem = extractFunctionSource(ui, 'saveApprovedPackItem');
  const closeEditor = extractFunctionSource(ui, 'closeApprovedPackEditor');
  const routeSource = read(path.join(projectRoot, 'routes', 'teacherContentRoutes.js'));

  assert.match(endpoints, /approvedPack: \(packId\) =>/, 'Approved pack detail endpoint should be available to the UI.');
  assert.match(endpoints, /approvedItem: \(packId, section, index\) =>/, 'Approved item edit endpoint should be available to the UI.');
  assert.match(manager, /state\.activeApprovedPackId \|\| state\.activeApprovedPackDetail \|\| state\.approvedPackLoading/, 'Saved manager should switch into approved-pack editor mode.');
  assert.match(approvedRow, /View \/ Edit Items/, 'Approved pack action should clearly say View / Edit Items.');
  assert.match(approvedRow, /data-approved-pack-view-edit-action/, 'Approved rows should include the view/edit action.');
  assert.match(openDetails, /ENDPOINTS\.approvedPack\(packId\)/, 'Approved view/edit action should load actual saved approved pack details.');
  assert.doesNotMatch(openDetails, /view-only here/, 'Approved view/edit action should not show the old view-only message.');
  assert.match(editor, /data-approved-pack-editor-empty/, 'Approved editor should have an explicit empty state if a pack has no items.');
  assert.match(editor, /sections\.map\(renderApprovedEditableSection\)/, 'Approved editor should render actual saved item sections.');
  assert.match(editableItem, /data-approved-pack-edit-item/, 'Approved editor should render editable item cards.');
  assert.match(editableItem, /data-approved-pack-item-save/, 'Approved editor should include per-item save actions.');
  assert.match(editableField, /data-approved-pack-edit-field/, 'Approved editor fields should use editable field data attributes.');
  assert.match(editableField, /formatApprovedFieldValue/, 'Approved editor should render saved field values, including arrays.');
  assert.match(style, /\.teacher-content-approved-edit-fields \{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 360px\), 1fr\)\);/, 'Approved item editor fields should remain readable while wrapping to available width.');
  assert.match(style, /\.teacher-content-approved-edit-field textarea \{[\s\S]*max-width: 100%;[\s\S]*overflow-wrap: anywhere;/, 'Approved editor textareas should not force horizontal overflow with long metadata.');
  assert.match(saveItem, /ENDPOINTS\.approvedItem\(packId, section, index\)/, 'Approved item save should patch the approved pack item endpoint.');
  assert.match(saveItem, /Saved changes to approved knowledge\. This pack remains enabled for student answers\./, 'Approved item save should show teacher-friendly enabled confirmation.');
  assert.match(closeEditor, /state\.activeApprovedPackDetail = null/, 'Approved editor close should return to saved pack list.');
  assert.match(routeSource, /app\.get\('\/approved\/:packId'/, 'Routes should expose approved pack detail loading.');
  assert.match(routeSource, /app\.patch\('\/approved\/:packId\/items\/:section\/:index'/, 'Routes should expose approved pack item editing.');
  assert.match(routeSource, /Saved changes to approved knowledge\. This pack remains enabled for student answers\./, 'Route response should use teacher-friendly approved edit confirmation.');
  assert.match(routeTest, /assertApprovedPackDetailEndpointShowsSavedItems/, 'Route tests should cover approved edit opening actual saved items.');
  assert.match(routeTest, /assertApprovedPackItemEditPersistsAndKeepsEnabled/, 'Route tests should cover approved item edit persistence and enabled state.');
  assert.match(routeTest, /loadEnabledApprovedKnowledgeItems/, 'Route tests should verify student approved-knowledge loader sees edited wording.');
}

function assertSavedKnowledgePacksHideApprovedDraftDuplicates() {
  const renderSimpleRowsSource = extractFunctionSource(ui, 'renderSimpleKnowledgePackRows');
  const renderApprovedRowSource = extractFunctionSource(ui, 'renderApprovedPack');
  const renderDraftRowSource = extractFunctionSource(ui, 'renderDraftPack');
  const countPackItemsSource = extractFunctionSource(ui, 'countPackItems');
  const formatPackUpdatedAtSource = extractFunctionSource(ui, 'formatPackUpdatedAt');
  const hiddenDraftMatcherSource = extractFunctionSource(ui, 'buildHiddenDraftPackIdSetForSavedList');
  const hasStrongSourceMetadataSource = extractFunctionSource(ui, 'hasStrongSourceMetadata');
  const collectComparablePackSourceMetadataSource = extractFunctionSource(ui, 'collectComparablePackSourceMetadata');
  const collectComparableSetSource = extractFunctionSource(ui, 'collectComparableSet');
  const matchesByComparableSourceMetadataSource = extractFunctionSource(ui, 'matchesByComparableSourceMetadata');
  const hasComparableSetOverlapSource = extractFunctionSource(ui, 'hasComparableSetOverlap');
  const canFallbackToFileNameOverlapSource = extractFunctionSource(ui, 'canFallbackToFileNameOverlap');
  const normalizeComparableTitleSource = extractFunctionSource(ui, 'normalizeComparableTitle');

  const renderHarnessFactory = new Function(
    'state',
    'getVisibleDraftPacks',
    'escapeHtml',
    'escapeAttr',
    'formatNumber',
    'formatDate',
    `${countPackItemsSource}\n${formatPackUpdatedAtSource}\n${renderApprovedRowSource}\n${renderDraftRowSource}\n${hasStrongSourceMetadataSource}\n${collectComparablePackSourceMetadataSource}\n${collectComparableSetSource}\n${matchesByComparableSourceMetadataSource}\n${hasComparableSetOverlapSource}\n${canFallbackToFileNameOverlapSource}\n${normalizeComparableTitleSource}\n${hiddenDraftMatcherSource}\n${renderSimpleRowsSource}\nreturn { renderSimpleKnowledgePackRows };`
  );

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const escapeAttr = (value) => escapeHtml(value);
  const formatNumber = (value) => String(Number(value || 0));
  const formatDate = (value) => String(value || '').slice(0, 10);
  const countMatches = (text, pattern) => (String(text || '').match(pattern) || []).length;

  {
    const state = {
      approved: [{ packId: 'pack-approved', title: 'Approved Pack', activationEnabled: false }],
      drafts: [{ packId: 'pack-approved', title: 'Draft copy that should hide' }],
      selectedApprovedPackIds: [],
      approvedActivationSaving: {},
      approvedDeleteSaving: {},
      approvedBulkDeleteSaving: false
    };
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr, formatNumber, formatDate);
    const html = harness.renderSimpleKnowledgePackRows();
    assert.equal(countMatches(html, /data-approved-pack-card/g), 1, 'Matching approved+draft packId should render one approved row.');
    assert.equal(countMatches(html, /data-draft-pack-card/g), 0, 'Matching approved+draft packId should not render a duplicate draft row.');
  }

  {
    const state = {
      approved: [{ packId: 'pack-approved', title: 'Approved Pack', activationEnabled: false }],
      drafts: [
        { packId: ' pack-approved ', title: 'Whitespace draft duplicate should hide' },
        { packId: 'pack-draft-only', title: 'Draft Only' }
      ],
      selectedApprovedPackIds: [],
      approvedActivationSaving: {},
      approvedDeleteSaving: {},
      approvedBulkDeleteSaving: false
    };
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr, formatNumber, formatDate);
    const html = harness.renderSimpleKnowledgePackRows();
    assert.equal(countMatches(html, /data-approved-pack-card/g), 1, 'Approved row should still render once when duplicate draft has padded packId.');
    assert.equal(countMatches(html, /data-draft-pack-card/g), 1, 'Unapproved draft rows should still render as Draft.');
    assert.match(html, /data-draft-pack-id="pack-draft-only"/, 'Draft-only pack should remain visible in Saved Knowledge list.');
  }

  {
    const sharedUploadId = 'b00953c3-5437-4226-a4b1-54b1afa28d20';
    const state = {
      approved: [{
        packId: 'charlemagne-test-02-medium-10-slide-motion-forces-0308ba7ee8',
        title: 'Charlemagne Test 02 Medium 10 Slide Motion Forces',
        activationEnabled: false,
        sourceFileNames: ['Charlemagne Test 02 Medium 10 Slide Motion Forces.pdf'],
        sourceUploadIds: [sharedUploadId]
      }],
      drafts: [{
        packId: 'draft-charlemagne-test-02-medium-10-slide-motion-forces-b00953c3-5437-4226-a4b1-54b1afa28d20',
        title: 'Charlemagne Test 02 Medium 10 Slide Motion Forces',
        sourceFileNames: ['Charlemagne Test 02 Medium 10 Slide Motion Forces.pdf'],
        sourceUploadIds: [sharedUploadId]
      }],
      selectedApprovedPackIds: [],
      approvedActivationSaving: {},
      approvedDeleteSaving: {},
      approvedBulkDeleteSaving: false
    };
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr, formatNumber, formatDate);
    const html = harness.renderSimpleKnowledgePackRows();
    assert.equal(countMatches(html, /data-approved-pack-card/g), 1, 'Approved row should render for real uploadId overlap cases.');
    assert.equal(countMatches(html, /data-draft-pack-card/g), 0, 'Draft row should hide when approved and draft share source uploadId even with different pack IDs.');
  }

  {
    const state = {
      approved: [{
        packId: 'approved-source-file-overlap',
        title: 'Shared Source File Name',
        activationEnabled: false,
        sourceFileNames: ['shared_motion_forces.pdf'],
        sourceUploadIds: ['approved-upload-has-id']
      }],
      drafts: [{
        packId: 'draft-source-file-overlap',
        title: 'Shared Source File Name',
        sourceFileNames: ['shared_motion_forces.pdf'],
        sourceUploadIds: ['']
      }],
      selectedApprovedPackIds: [],
      approvedActivationSaving: {},
      approvedDeleteSaving: {},
      approvedBulkDeleteSaving: false
    };
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr, formatNumber, formatDate);
    const html = harness.renderSimpleKnowledgePackRows();
    assert.equal(countMatches(html, /data-approved-pack-card/g), 1, 'Approved row should render for filename fallback cases.');
    assert.equal(countMatches(html, /data-draft-pack-card/g), 0, 'Draft row should hide when one side is missing upload IDs but source file names overlap.');
  }

  {
    const state = {
      approved: [{
        packId: 'charlemagne-test-02-medium-10-slide-motion-forces-0308ba7ee8',
        title: 'Charlemagne Test 02 Medium 10 Slide Motion Forces',
        activationEnabled: false,
        sourceFileNames: [],
        sourceUploadIds: []
      }],
      drafts: [{
        packId: 'draft-charlemagne-test-02-medium-10-slide-motion-forces-b00953c3-5437-4226-a4b1-54b1afa28d20',
        title: 'Charlemagne Test 02 Medium 10 Slide Motion Forces',
        sourceFileNames: [],
        sourceUploadIds: []
      }],
      selectedApprovedPackIds: [],
      approvedActivationSaving: {},
      approvedDeleteSaving: {},
      approvedBulkDeleteSaving: false
    };
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr, formatNumber, formatDate);
    const html = harness.renderSimpleKnowledgePackRows();
    assert.equal(countMatches(html, /data-approved-pack-card/g), 1, 'Approved row should render for the accepted pack.');
    assert.equal(countMatches(html, /data-draft-pack-card/g), 0, 'Same-title blank-source draft duplicates should be hidden even when pack IDs differ.');
  }

  {
    const state = {
      approved: [{
        packId: 'pack-title-source-approved',
        title: 'Shared Title',
        activationEnabled: false,
        sourceFileNames: ['teacher-force.pdf'],
        sourceUploadIds: ['upload-approved-1']
      }],
      drafts: [{
        packId: 'pack-title-source-draft',
        title: 'Shared Title',
        sourceFileNames: ['another-file.pdf'],
        sourceUploadIds: ['upload-draft-2']
      }],
      selectedApprovedPackIds: [],
      approvedActivationSaving: {},
      approvedDeleteSaving: {},
      approvedBulkDeleteSaving: false
    };
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr, formatNumber, formatDate);
    const html = harness.renderSimpleKnowledgePackRows();
    assert.equal(countMatches(html, /data-approved-pack-card/g), 1, 'Approved row should render.');
    assert.equal(countMatches(html, /data-draft-pack-card/g), 1, 'Draft with stronger distinct source metadata should remain visible even with same normalized title.');
    assert.match(html, /data-draft-pack-id="pack-title-source-draft"/, 'Unrelated same-title draft should still render as Draft when stronger metadata exists.');
  }
}

async function assertSavedKnowledgePackBulkDeleteBehavior() {
  const bulkDeleteSource = extractFunctionSource(ui, 'deleteApprovedPacksById');
  const deleteSelectedSource = extractFunctionSource(ui, 'deleteSelectedApprovedPacks');
  const deleteAllSource = extractFunctionSource(ui, 'deleteAllApprovedPacks');
  const createHarness = () => {
    const state = {
      selectedApprovedPackIds: ['pack-a', 'pack-c'],
      approvedBulkDeleteSaving: false,
      approvedBulkDeleteMessage: '',
      approvedDeleteMessages: {},
      appliedSummary: null
    };
    const visibleRows = [
      { packId: 'pack-a' },
      { packId: 'pack-b' },
      { packId: 'pack-c' }
    ];
    const calls = {
      fetch: [],
      confirm: [],
      refresh: 0,
      render: 0,
      status: [],
      summary: []
    };
    const envFactory = new Function(
      'state',
      'window',
      'fetchJson',
      'ENDPOINTS',
      'unwrap',
      'applyApprovedSummary',
      'refreshTeacherContentSummaries',
      'setStatus',
      'render',
      'getVisibleKnowledgePackRows',
      `${bulkDeleteSource}\n${deleteSelectedSource}\n${deleteAllSource}\nreturn { deleteApprovedPacksById, deleteSelectedApprovedPacks, deleteAllApprovedPacks };`
    );
    const windowMock = {
      confirm(message) {
        calls.confirm.push(message);
        return true;
      }
    };
    const fetchJson = async (url, options) => {
      calls.fetch.push({ url, options });
      return { ok: true, approvedSummary: { approvedPacks: [] } };
    };
    const bound = envFactory(
      state,
      windowMock,
      fetchJson,
      { approvedBulkDelete: '/teacher-content/approved/bulk-delete' },
      (payload) => payload,
      (summary) => {
        state.appliedSummary = summary;
        calls.summary.push(summary);
      },
      async () => {
        calls.refresh += 1;
      },
      (message) => {
        calls.status.push(message);
      },
      () => {
        calls.render += 1;
      },
      () => visibleRows
    );
    return { state, visibleRows, calls, windowMock, bound };
  };

  {
    const harness = createHarness();
    harness.windowMock.confirm = () => false;
    await harness.bound.deleteSelectedApprovedPacks();
    assert.equal(harness.calls.fetch.length, 0, 'Delete selected Cancel should not call fetch.');
    assert.deepEqual(harness.state.selectedApprovedPackIds, ['pack-a', 'pack-c'], 'Delete selected Cancel should not change row selection.');
  }

  {
    const harness = createHarness();
    await harness.bound.deleteSelectedApprovedPacks();
    assert.equal(harness.calls.fetch.length, 1, 'Delete selected OK should call fetch once.');
    const request = harness.calls.fetch[0];
    assert.equal(request.url, '/teacher-content/approved/bulk-delete');
    assert.equal(request.options.method, 'DELETE');
    const body = JSON.parse(request.options.body);
    assert.equal(body.confirmed, true, 'Delete selected OK should send confirmed: true.');
    assert.deepEqual(body.packIds, ['pack-a', 'pack-c'], 'Delete selected OK should send selected pack IDs.');
    assert.deepEqual(harness.state.selectedApprovedPackIds, [], 'Successful bulk delete should clear selection.');
    assert.equal(harness.calls.refresh, 1, 'Successful bulk delete should refresh summaries.');
  }

  {
    const harness = createHarness();
    await harness.bound.deleteAllApprovedPacks();
    assert.equal(harness.calls.fetch.length, 1, 'Delete all OK should call fetch once.');
    const request = harness.calls.fetch[0];
    const body = JSON.parse(request.options.body);
    assert.equal(body.confirmed, true, 'Delete all OK should send confirmed: true.');
    assert.deepEqual(body.packIds, ['pack-a', 'pack-b', 'pack-c'], 'Delete all OK should send visible pack IDs.');
  }
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

function readCssBundle(entryPath, seen = new Set()) {
  assert.ok(!seen.has(entryPath), `CSS import cycle detected at ${entryPath}.`);
  seen.add(entryPath);

  const source = read(entryPath);
  const importPattern = /@import\s+url\("([^"]+)"\);/g;
  let output = '';
  let lastIndex = 0;

  for (const match of source.matchAll(importPattern)) {
    output += source.slice(lastIndex, match.index);
    const importedPath = path.resolve(path.dirname(entryPath), match[1]);
    output += readCssBundle(importedPath, seen);
    lastIndex = match.index + match[0].length;
  }

  output += source.slice(lastIndex);
  seen.delete(entryPath);
  return output;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractFunctionSource(source, functionName) {
  const asyncStartToken = `async function ${functionName}(`;
  const plainStartToken = `function ${functionName}(`;
  const asyncStart = source.indexOf(asyncStartToken);
  const plainStart = source.indexOf(plainStartToken);
  const start = asyncStart >= 0 ? asyncStart : plainStart;
  assert.ok(start >= 0, `Expected function ${functionName} in teacher-content-ui.js.`);
  let braceIndex = -1;
  let parenDepth = 0;
  let sawSignatureParen = false;
  for (let index = start + `${asyncStart >= 0 ? 'async function' : 'function'} ${functionName}`.length; index < source.length; index += 1) {
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
