const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const uiEntryPath = path.join(projectRoot, 'public', 'teacher-content-ui.js');
const uiIndexPath = path.join(projectRoot, 'public', 'teacher-content', 'index.js');
const uiConstantsPath = path.join(projectRoot, 'public', 'teacher-content', 'constants.js');
const uiRenderReviewPath = path.join(projectRoot, 'public', 'teacher-content', 'render-review.js');
const uiRenderApprovedPath = path.join(projectRoot, 'public', 'teacher-content', 'render-approved.js');
const uiReviewActionsPath = path.join(projectRoot, 'public', 'teacher-content', 'review-actions.js');
const stylePath = path.join(projectRoot, 'public', 'style.css');
const packagePath = path.join(projectRoot, 'package.json');
const routeTestPath = path.join(projectRoot, 'scripts', 'test-teacher-content-routes.js');

const uiEntry = read(uiEntryPath);
const reviewActions = read(uiReviewActionsPath);
const ui = `${read(uiConstantsPath)}\n${read(uiRenderReviewPath)}\n${read(uiRenderApprovedPath)}\n${read(uiReviewActionsPath)}\n${read(uiIndexPath)}`;
const style = read(stylePath);
const routeTest = read(routeTestPath);
const pkg = JSON.parse(read(packagePath));

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  assertCompatibilityEntryLoadsModules();
  assertTwoPrimaryScreens();
  assertUploadScreenIsSimple();
  assertReviewScreenIsSimpleList();
  assertReviewAggregatesAllQueuePacks();
  assertReviewScreenUsesReviewActionFooter();
  assertReviewAcceptanceRequiresApprovedCounterpart();
  assertFinalApproveUsesCombinedFinalPublish();
  assertAcceptSelectedUsesCombinedPackApproval();
  assertAcceptAllUsesCombinedPackApproval();
  assertDeleteMarksRejectedAndHidesRows();
  assertExcludeSelectedRoutesAcrossDraftPacks();
  assertEditActionKeepsDraftPackIdentity();
  assertEditUsesSafeFields();
  assertFocusedEditRefreshesBeforeApproval();
  assertSuccessReturnsToKnowledgeManager();
  assertPrimaryFlowHidesTechnicalImportControls();
  assertSavedKnowledgePackBulkDeleteUi();
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
  assert.match(style, /\.teacher-content-review-table-shell\[data-review-combined-table\] \.teacher-content-review-table-head,\s*\.teacher-content-review-table-shell\[data-review-combined-table\] \.teacher-content-review-table-row \{[\s\S]*grid-template-columns: 34px minmax\(170px, 1fr\) minmax\(120px, 0\.7fr\) minmax\(150px, 0\.8fr\) minmax\(250px, 1\.5fr\) minmax\(200px, 1\.1fr\) auto;/, 'Review rows should use combined table columns.');
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
  assert.match(actionBar, /const acceptSelectedDisabled = state\.reviewActionLoading \|\| state\.promotionActionLoading \|\| selectedRows\.length === 0 \|\| safeSelected === 0/, 'Accept Selected should stay disabled until at least one valid selected row is checked.');
  assert.match(actionBar, /const acceptAllDisabled = state\.reviewActionLoading \|\| state\.promotionActionLoading/, 'Accept All should only be disabled while actions are in progress.');
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
  assert.match(simpleVisibility, /status !== 'rejected'/, 'Rejected rows should be hidden from the simple review list.');
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
  assert.match(style, /\.teacher-content-simple-pack-row \{[\s\S]*grid-template-columns: 28px minmax\(180px, 1\.2fr\) minmax\(190px, 1fr\) auto;/, 'Approved rows should align checkbox, title, activation, and actions.');
  assert.match(routeTest, /assertDeleteSelectedRemovesApprovedAndDraftPacks/, 'Route tests should cover bulk deleting selected draft and approved packs.');
  assert.match(routeTest, /assertDeleteAllRemovesEveryVisiblePack/, 'Route tests should cover deleting all visible saved packs.');
  assert.match(routeTest, /assertDraftOnlyDeleteRemovesPackFromVisibleList/, 'Route tests should cover deleting draft-only rows.');
  assert.match(routeTest, /assertApprovedBulkDeletePathTraversalRejectedBeforeMutation/, 'Route tests should cover path traversal rejection before mutation.');
}

function assertSavedKnowledgePacksHideApprovedDraftDuplicates() {
  const renderSimpleRowsSource = extractFunctionSource(ui, 'renderSimpleKnowledgePackRows');
  const renderApprovedRowSource = extractFunctionSource(ui, 'renderApprovedPack');
  const renderDraftRowSource = extractFunctionSource(ui, 'renderDraftPack');
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
    `${renderApprovedRowSource}\n${renderDraftRowSource}\n${hasStrongSourceMetadataSource}\n${collectComparablePackSourceMetadataSource}\n${collectComparableSetSource}\n${matchesByComparableSourceMetadataSource}\n${hasComparableSetOverlapSource}\n${canFallbackToFileNameOverlapSource}\n${normalizeComparableTitleSource}\n${hiddenDraftMatcherSource}\n${renderSimpleRowsSource}\nreturn { renderSimpleKnowledgePackRows };`
  );

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const escapeAttr = (value) => escapeHtml(value);
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
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr);
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
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr);
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
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr);
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
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr);
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
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr);
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
    const harness = renderHarnessFactory(state, () => state.drafts, escapeHtml, escapeAttr);
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
