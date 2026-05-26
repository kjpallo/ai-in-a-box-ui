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
assertAcceptSelectedCreatesSelectedOnlyPack();
assertAcceptAllCreatesApprovedOnlyPack();
assertDeleteMarksRejectedAndHidesRows();
assertEditUsesSafeFields();
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
  assert.doesNotMatch(actionBar, /data-review-select-all|data-review-exclude-selected-flagged|data-review-reject-blockers-promote/, 'Bottom bar should not show old bulk technical actions.');
  assert.match(style, /\.teacher-content-review-card\.teacher-content-review-table-row \{[\s\S]*grid-template-columns: 36px minmax\(110px, 0\.42fr\) minmax\(220px, 1fr\) auto;/, 'Review rows should be laid out as checkbox, type, preview, actions.');
}

function assertAcceptSelectedCreatesSelectedOnlyPack() {
  const acceptSelected = extractFunctionSource(ui, 'acceptSelectedReviewItems');
  const acceptReview = extractFunctionSource(ui, 'acceptReviewItems');
  const requestPromotion = extractFunctionSource(ui, 'requestDraftPromotion');

  assert.match(acceptSelected, /state\.selectedReviewItemKeys\.includes/, 'Accept Selected should only use checked rows.');
  assert.match(acceptSelected, /promotionMode: 'selectedOnly'/, 'Accept Selected should use selectedOnly promotion mode.');
  assert.match(acceptSelected, /selectedItems: safeItems\.map\(makePromotionSelectionItem\)/, 'Accept Selected should send explicit selected rows to promotion.');
  assert.match(acceptSelected, /autoPromoteAfterAccept: true/, 'Accept Selected should create the approved JSON pack after approving rows.');
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
