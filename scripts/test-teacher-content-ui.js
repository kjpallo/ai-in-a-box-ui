const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const bladePath = path.join(projectRoot, 'public', 'blade-ui.js');
const uiPath = path.join(projectRoot, 'public', 'teacher-content-ui.js');
const apiClientPath = path.join(projectRoot, 'public', 'api-client.js');
const stylePath = path.join(projectRoot, 'public', 'style.css');
const indexPath = path.join(projectRoot, 'public', 'index.html');
const packagePath = path.join(projectRoot, 'package.json');

const routerStudentFilesBefore = snapshotRouterAndStudentFiles();

const blade = read(bladePath);
const ui = read(uiPath);
const apiClient = read(apiClientPath);
const style = read(stylePath);
const index = read(indexPath);
const pkg = JSON.parse(read(packagePath));

assertTeacherProfileEntry();
assertOverlayMarkupAndSelectors();
assertSafeImportWorkflowUi();
assertEndpointReferences();
assertUploadExtractionUi();
assertUploadAndPrepareFormDataContract();
assertBackendJsonErrorsAreDisplayed();
assertPrepareReviewHandoffUi();
assertSelectedDraftAndProgressUi();
assertStandardsTabWorkflowUi();
assertReviewCardPolishUi();
assertReviewPromotionButtonConditions();
assertImportReportPolishUi();
assertApprovedPacksPolishUi();
assertReviewActions();
assertPromotionAction();
assertDisabledPlaceholders();
assertNoForbiddenUiActions();
assertPackageScript();
assertNoRouterOrStudentFilesChanged();
assertTeacherContentRouteTestsStillPass();

console.log('Teacher content UI tests passed.');

function assertTeacherProfileEntry() {
  assert.match(blade, /teacher-content-entry-card/, 'Teacher Content entry card should exist in teacher profile blade.');
  assert.match(blade, /openTeacherContentOverlay/, 'Teacher Content open button should exist.');
  assert.match(blade, /Create New Knowledge/, 'Teacher Content card should include Create New Knowledge copy.');
  assert.match(blade, /Manage uploaded knowledge, standards, drafts, and approved packs/, 'Teacher Content card should explain its scope.');
  assert.match(index, /teacher-content-ui\.js/, 'Teacher Content UI script should be loaded by index.html.');
}

function assertOverlayMarkupAndSelectors() {
  [
    'teacherContentOverlay',
    'teacher-content-scrim',
    'teacher-content-blade',
    'teacherContentClose',
    'teacherContentTabs',
    'teacherContentDeck',
    'teacherContentBack',
    'teacherContentNext',
    'teacherContentDraftSelect',
    'teacher-content-card',
    'teacher-content-tab',
    'teacher-content-tab-index',
    'teacher-content-tab-copy',
    'teacher-content-preview-card',
    'renderDeckPreviewCard',
    'data-review-evidence',
    'data-review-evidence-card',
    'data-review-evidence-close'
  ].forEach((selector) => {
    assert.ok(ui.includes(selector) || style.includes(selector), `Expected selector or hook ${selector}.`);
  });

  ['Upload Source', 'Preview Import', 'Review Preview', 'Full Import', 'Review Content', 'Knowledge Packs'].forEach((label) => {
    assert.ok(ui.includes(label), `Expected tab/card label ${label}.`);
  });
  assert.doesNotMatch(ui.match(/const TABS = \[[\s\S]*?\n  \];/)?.[0] || '', /Define Knowledge Pack|Assign Standards|Import Report \/ Audit/, 'Teacher Content deck should use the new safe import step labels.');

  [
    '--deck-offset',
    '--deck-distance',
    'teacher-content-card.preview',
    'aria-hidden="${isActive ? \'false\' : \'true\'}"'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker) || style.includes(marker), `Expected card-deck visual marker ${marker}.`);
  });
}

function assertSafeImportWorkflowUi() {
  const tabsBlock = ui.match(/const TABS = \[([\s\S]*?)\n  \];/);
  assert.ok(tabsBlock, 'Expected TABS block.');
  [
    "id: 'upload', label: 'Upload Source'",
    "id: 'previewImport', label: 'Preview Import'",
    "id: 'reviewPreview', label: 'Review Preview'",
    "id: 'fullImport', label: 'Full Import'",
    "id: 'review', label: 'Review Content'",
    "id: 'approvedPacks', label: 'Knowledge Packs'"
  ].forEach((marker) => {
    assert.ok(tabsBlock[1].includes(marker), `Expected safe import tab marker ${marker}.`);
  });

  [
    'renderUploadSourceCard',
    'renderPreviewImportCard',
    'renderReviewPreviewCard',
    'renderFullImportCard',
    "state.activeTab = 'previewImport'",
    "state.activeTab = 'reviewPreview'",
    "state.activeTab = 'review'",
    'ESTIMATE READY',
    'PREVIEW READY',
    'PENDING REVIEW',
    'No preview yet. Run Preview Draft first.',
    'Run Preview Draft first.',
    'Gemma has not run yet.',
    'Gemma returned draft items, but validation found fields that need repair.',
    'Gemma returned draft items. Charlemagne normalized IDs/titles and kept items pending review.',
    'getPreviewImportNote',
    "entry.type === 'batch_received'",
    "entry.type === 'normalization_complete'",
    'Normalized concept IDs',
    'Normalized concept titles',
    'Review-needed items',
    'Preview Draft uses a small sample',
    'PARTIAL PREVIEW',
    'data-preview-repair-needed',
    'data-preview-validation-errors',
    'data-preview-invalid-items',
    'data-preview-valid-items',
    'Repair-needed items',
    'Validation errors',
    'Valid preview items kept',
    'PREVIEW READY',
    'Import is running, do not close this window.'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected safe import workflow marker ${marker}.`);
  });

  [
    'Import Selected Pages/Sections',
    'data-selected-import-panel',
    'data-selected-import-recommendation',
    'Full Document Import defaults to all text-bearing pages from the upload, not the preview page.',
    'For large packets, selected range import remains available when you intentionally want only part of the document.',
    'Import first 3 pages',
    'Import next 3 pages',
    'Import first detected section',
    'Import page range',
    'teacherContentSelectedPageStart',
    'teacherContentSelectedPageEnd',
    'data-selected-import-partial-note',
    'Rerun preview range as strict draft',
    'data-full-import-advanced',
    'Full document import confirmation',
    'teacherContentFullImportConfirm',
    'Type CONFIRM',
    'Run Full Document Import',
    'data-full-import-failure-message',
    'Full import failed',
    'data-full-import-technical-details',
    'data-full-import-failed-batches',
    'data-prepare-review-failure-message',
    'Preview failed',
    'data-preview-retry-panel',
    'Backend details',
    'Suggested next steps',
    'Retry Preview Draft',
    'Return to Upload Source',
    'Gemma did not return any usable preview items from this range.',
    'If the selected text is short or mostly a title page, try pages 2-4 or increase max preview chars.',
    'Selected pages:',
    'Selected chunks:'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected selected import / gated full import marker ${marker}.`);
  });

  const uploadSourceFunction = ui.match(/function renderUploadSourceCard\(\) \{([\s\S]*?)\n  function renderPreviewImportCard/);
  assert.ok(uploadSourceFunction, 'Expected renderUploadSourceCard function.');
  assert.ok(uploadSourceFunction[1].includes('Create Review Draft'), 'Upload Source should keep Create Review Draft.');
  assert.doesNotMatch(uploadSourceFunction[1], /Run Preview Draft|Run Full Import|renderImportEstimatePanel|renderPreviewReportPanel/, 'Upload Source should not own preview/full import controls or reports.');

  const previewImportFunction = ui.match(/function renderPreviewImportCard\(\) \{([\s\S]*?)\n  function renderReviewPreviewCard/);
  assert.ok(previewImportFunction, 'Expected renderPreviewImportCard function.');
  assert.match(previewImportFunction[1], /renderImportEstimatePanel\(\)/, 'Preview Import should show the import estimate.');
  assert.match(previewImportFunction[1], /data-upload-run-preview/, 'Preview Import should expose Run Preview Draft.');
  assert.match(previewImportFunction[1], /data-upload-run-full-import[\s\S]*?disabled/, 'Preview Import should keep Full Import secondary/disabled until preview succeeds.');

  const reviewPreviewFunction = ui.match(/function renderReviewPreviewCard\(\) \{([\s\S]*?)\n  function renderFullImportCard/);
  assert.ok(reviewPreviewFunction, 'Expected renderReviewPreviewCard function.');
  assert.match(reviewPreviewFunction[1], /renderPreviewReportPanel\(\)/, 'Review Preview should show preview report output.');
  assert.match(reviewPreviewFunction[1], /renderPrepareReviewFailurePanel\('preview'\)/, 'Review Preview should show preview failures with backend details.');
  assert.match(reviewPreviewFunction[1], /data-selected-import-preset="preview"/, 'Review Preview should allow importing the preview range as a draft.');
  assert.doesNotMatch(reviewPreviewFunction[1], /Import valid preview items as partial draft/, 'Review Preview should not imply selected import saves already-salvaged preview items.');

  const fullImportFunction = ui.match(/function renderFullImportCard\(\) \{([\s\S]*?)\n  function renderStandardsCard/);
  assert.ok(fullImportFunction, 'Expected renderFullImportCard function.');
  assert.match(fullImportFunction[1], /renderPrepareReviewFailurePanel\('full'\)/, 'Full Import card should show clear failure details.');
  assert.match(fullImportFunction[1], /renderSelectedImportControls/, 'Full Import card should recommend selected imports.');
  assert.match(fullImportFunction[1], /renderWholeImportAdvanced/, 'Whole full import should live behind advanced disclosure.');

  assert.match(ui, /data-upload-run-full-import/, 'Full Import should expose Run Full Import.');
  assert.match(fullImportFunction[1], /canRunFullImport[\s\S]*?state\.uploadPreviewComplete/, 'Full Import should require a successful preview.');

  assert.equal((ui.match(/overload local Gemma/g) || []).length, 1, 'Local Gemma range warning copy should appear once.');
}

function assertEndpointReferences() {
  const expectedEndpoints = [
    '/api/teacher-content/dashboard',
    '/api/teacher-content/uploads/extract',
    '/api/teacher-content/uploads/upload-and-prepare',
    '/api/teacher-content/uploads/${encodeURIComponent(uploadId)}/prepare-review',
    '/api/teacher-content/uploads/history',
    '/api/teacher-content/drafts',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/report${query}',
    '/api/teacher-content/standards-banks',
    '/api/teacher-content/standards-banks/${encodeURIComponent(standardsBankId)}',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/promote',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}/status',
    '/api/teacher-content/approved',
    '/api/teacher-content/approved/${encodeURIComponent(packId)}/activation',
    '/api/teacher-content/approved/${encodeURIComponent(packId)}'
  ];

  expectedEndpoints.forEach((endpoint) => {
    assert.ok(ui.includes(endpoint), `Expected endpoint reference ${endpoint}.`);
  });

  const endpointBlock = ui.match(/const ENDPOINTS = \{([\s\S]*?)\n  \};/);
  assert.ok(endpointBlock, 'Expected ENDPOINTS block in Teacher Content UI.');
  const endpointKeys = Array.from(endpointBlock[1].matchAll(/^\s+([a-zA-Z0-9_]+):/gm), (match) => match[1]);
  assert.deepEqual(
    endpointKeys.sort(),
    [
      'approved',
      'approvedActivation',
      'approvedBulkDelete',
      'approvedDelete',
      'dashboard',
      'draftItem',
      'draftItemStatus',
      'draftReport',
      'drafts',
      'promoteDraft',
      'standardsBank',
      'standardsBanks',
      'uploadAndPrepare',
      'uploadExtract',
      'uploadHistory',
      'uploadPrepareReview'
    ].sort(),
    'Teacher Content UI should keep endpoint helpers limited to teacher content read/review/promotion routes.'
  );
}

function assertPromotionAction() {
  [
    'data-promote-draft',
    'promotionReadiness',
    'Ready to promote',
    'Needs teacher review',
    'Blocked',
    'Promoted successfully',
    'summary.pending > 0 || summary.approved < 1',
    'Create Approved Pack from Approved Items',
    'data-review-create-approved-pack',
    'data-import-scope-warning',
    'Run Full Document Import before approving this as your main pack.',
    "method: 'POST'",
    'Promotion copies reviewed draft content into approved knowledge packs.',
    'It will not change student answering yet.'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected promotion marker ${marker}.`);
  });

  assert.equal((ui.match(/data-promote-draft/g) || []).length, 3, 'Promote hook should remain limited to one event handler, one Review Content button, and one Import Report button.');
  assert.ok(
    ui.indexOf('function renderImportReportCard') < ui.lastIndexOf('data-promote-draft'),
    'Promote button should remain in the Import Report card.'
  );
}

function assertReviewActions() {
  [
    'data-review-edit',
    'data-review-status="approved"',
    'data-review-status="rejected"',
    'data-review-detail',
    'data-review-field',
    'data-review-save',
    'data-review-close',
    "method: 'PATCH'"
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected review action marker ${marker}.`);
  });
}

function assertDisabledPlaceholders() {
  const disabledCount = (ui.match(/disabled/g) || []).length;
  assert.ok(disabledCount >= 5, 'Expected disabled placeholder controls.');
  [
    'data-standards-bank-select',
    'data-coming-soon="standards-upload"',
    'data-coming-soon="standards-replace"'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected placeholder marker ${marker}.`);
  });
}

function assertUploadExtractionUi() {
  [
    'teacherContentUploadFile',
    'type="file"',
    'accept=".txt,.csv,.json,.docx,.xlsx,.pptx,.pdf"',
    'data-upload-file-input',
    'data-upload-browse',
    'data-upload-content-name',
    'data-upload-create-review',
    'data-upload-create-progress',
    'data-upload-create-stage',
    'data-upload-advanced-details',
    'data-source-match-metadata',
    'data-source-match-uploaded-file',
    'data-source-match-draft-id',
    'data-source-match-draft-title',
    'data-source-match-draft-source-files',
    'data-source-match-character-count',
    'data-source-match-page-chunk-count',
    'data-source-match-status',
    'data-source-match-warning',
    'Source mismatch warning',
    'Create Review Draft',
    'Uploading file...',
    'Extracting text...',
    'Building import estimate...',
    'Import Estimate',
    'Recommended: Full document import',
    'Estimated batches',
    'Reason:',
    'You can override this if needed.',
    'Generate Draft',
    'data-auto-import-plan-panel',
    'data-auto-import-plan-warnings',
    'data-upload-run-recommended-import',
    'data-import-override-controls',
    'Run Preview Draft',
    'Run Full Import',
    'Preview Draft',
    'Temporary sample only. No final approved pack was created.',
    'data-preview-scope',
    'Sample draft',
    'data-preview-deduplication-counts',
    'raw ${formatNumber(entry.stats.raw)} | duplicates ${formatNumber(entry.stats.duplicatesRemoved)} | final ${formatNumber(entry.stats.final)}',
    'Import is running, do not close this window.',
    'Gemma Draft Activity',
    'data-import-activity-panel',
    'data-import-activity-event',
    'Operational import progress for this teacher draft.',
    'Building draft packet wrapper',
    'Running validation',
    'Draft ready for review',
    'Review draft prepared.',
    'Advanced details',
    'FormData',
    "method: 'POST'",
    'Review the recommended plan, then click Generate Draft.',
    'Preview Size',
    'Ultra-safe',
    'Page 1 only',
    'Next page',
    'Custom page range - more demanding',
    'Partial preview created. Some pages/chunks failed.',
    'Original File',
    'File Type',
    'Extraction Status',
    'Character Count',
    'Sections Found',
    'Tables Found',
    'Warnings',
    'Errors'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected upload extraction UI marker ${marker}.`);
  });

  assert.doesNotMatch(ui, /data-upload-extract|data-upload-prepare-review/, 'Upload card should expose one teacher-facing create action.');
  assert.doesNotMatch(ui, /chain-of-thought|hidden reasoning|Gemma's thoughts|Gemma’s thoughts/i, 'Import activity should not claim to show hidden reasoning.');
  assert.equal((ui.match(/data-upload-create-review/g) || []).length, 2, 'Create Review Draft hook should be one handler and one button.');
  assert.match(ui, /function makePreviewImportPayload\(\)/, 'Run Preview Draft should build an explicit preview selection payload.');
  assert.match(ui, /function getTextBearingPages\(\)/, 'Preview UI should read text-bearing page metadata.');
  assert.match(ui, /function applyDefaultPreviewTextPage\(\)/, 'Preview UI should default to the first text-bearing page when needed.');
  assert.match(ui, /async function runRecommendedImport\(\)/, 'Teacher UI should run the automatic recommendation as the default Generate Draft action.');
  assert.match(ui, /function renderAutoImportPlanPanel\(\)/, 'Teacher UI should render the automatic import plan.');
  assert.match(ui, /function makeRecommendedImportPayload\(plan\)/, 'Teacher UI should build selected-range payloads from the recommended plan.');
  assert.match(ui, /useAutoImportPlan:\s*true/, 'Generate Draft should mark the recommended plan as accepted.');
  assert.match(ui, /state\.uploadAutoImportPlan = data\?\.autoImportPlan/, 'Teacher UI should store the route-provided automatic import plan.');
  assert.match(ui, /state\.uploadPreviewAutoTextPage/, 'Preview UI should distinguish automatic first-text-page defaults from explicit page choices.');
  assert.match(ui, /importSelection:\s*\{\s*pageStart,\s*pageEnd/s, 'Run Preview Draft should send selected preview pages.');
  assert.match(ui, /previewMaxPages:\s*size === 'range'[\s\S]*?: 1/, 'Run Preview Draft should default to one preview page outside custom ranges.');
  assert.match(ui, /previewMode:\s*size === 'ultraSafe' \? 'ultra-safe'/, 'Run Preview Draft should send ultra-safe preview mode.');
  assert.match(ui, /previewMaxCharacters:\s*maxChars/, 'Run Preview Draft should send the preview character limit.');
  assert.match(ui, /data-use-first-text-page/, 'Preview UI should expose a Use first text page action.');
  assert.match(ui, /Page 1 has no extractable text\. Try Page/, 'Preview UI should explain empty Page 1 recovery.');
  assert.match(ui, /data-import-estimate-first-text-page/, 'Import estimate should display first text page metadata.');
  assert.match(ui, /data-import-estimate-pages-with-text/, 'Import estimate should display pages with text metadata.');
  assert.match(ui, /knowledgeName: state\.uploadContentName/, 'Run Preview Draft should send the teacher knowledge name.');
  assert.match(ui, /previewOnly: importMode === 'preview'/, 'Run Preview Draft should mark previewOnly.');
  assert.match(ui, /appendImportActivity\('error'/, 'Prepare Review failures should be appended to Gemma Draft Activity.');
  assert.match(ui, /state\.uploadPrepareReviewFailedMode = importMode/, 'Prepare Review failure should keep the failing step marked failed.');
  assert.match(ui, /state\.uploadPreviewComplete = !state\.uploadPreviewPartial/, 'Only successful preview responses should mark Review Preview ready.');
  const prepareReviewFunction = ui.match(/async function prepareReviewFromUpload\(importMode = 'preview', extraBody = \{\}\) \{([\s\S]*?)\n  function makeSelectedImportPayload/);
  assert.ok(prepareReviewFunction, 'Expected prepareReviewFromUpload function.');
  const prepareReviewCatch = prepareReviewFunction[1].match(/catch \(error\) \{([\s\S]*?)\n    \} finally \{/);
  assert.ok(prepareReviewCatch, 'Expected prepareReviewFromUpload catch block.');
  assert.doesNotMatch(prepareReviewCatch[1], /uploadPreviewComplete\s*=\s*true/, 'Failed Prepare Review should not mark preview ready.');
}

function assertUploadAndPrepareFormDataContract() {
  const createReviewFunction = ui.match(/async function createReviewDraftFromUpload\(\) \{([\s\S]*?)\n  async function runPreviewImport/);
  assert.ok(createReviewFunction, 'Expected createReviewDraftFromUpload function.');
  assert.ok(
    createReviewFunction[1].includes("formData.append('sourceFile', state.selectedUploadFile)"),
    'Create Review Draft should send the source file under the route upload field.'
  );
  assert.ok(
    createReviewFunction[1].includes("formData.append('knowledgeName', state.uploadContentName || makeContentNameFromFileName(state.selectedUploadFile.name || ''))"),
    'Create Review Draft should send the teacher-entered name as knowledgeName.'
  );
  assert.doesNotMatch(
    createReviewFunction[1],
    /formData\.append\('packName'/,
    'Create Review Draft should not send the old packName field from the one-button upload form.'
  );
}

function assertBackendJsonErrorsAreDisplayed() {
  [
    'data.error',
    'data.message',
    'Array.isArray(data.errors) && data.errors.length > 0 ? data.errors.join',
    'data.details',
    'error.errors = Array.isArray(data.errors) ? data.errors : []'
  ].forEach((marker) => {
    assert.ok(apiClient.includes(marker), `Expected API client to preserve backend JSON error marker ${marker}.`);
  });
  assert.ok(apiClient.includes('error.timeline = Array.isArray(data.timeline) ? data.timeline : []'));
  assert.ok(apiClient.includes('error.data = data'));

  assert.ok(
    ui.includes("state.uploadCreateReviewError = error.message || 'Create Review Draft failed.'"),
    'Teacher Content upload failure should render the backend error message surfaced by the API client.'
  );
  [
    'error?.data?.validationErrors',
    'error?.data?.invalidItems',
    'error?.data?.repairNeeded',
    'error?.data?.failedBatches',
    'error?.data?.rawModelResponsePath',
    'error?.data?.extractionCounts',
    'data-prepare-review-backend-details',
    'data-prepare-review-retry-guidance',
    'data-prepare-review-repair-details'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected prepare-review 400 recovery marker ${marker}.`);
  });
}

function assertPrepareReviewHandoffUi() {
  [
    'data-prepare-review-handoff',
    'Review draft prepared.',
    'Next step: review pending items before this knowledge can go live.',
    'Draft packs are not live until approved and promoted.',
    'Review draft prepared, but the latest report could not be refreshed.',
    'data-handoff-tab="review"',
    'Go to Review',
    'Review Content',
    'state.selectedDraftPackId = data.packId',
    'await refreshDraftLists()',
    "state.activeTab = 'review'",
    'state.latestPrepareReviewSourceMatch'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected Prepare Review handoff marker ${marker}.`);
  });
}

function assertSelectedDraftAndProgressUi() {
  [
    'data-selected-draft-summary',
    'data-selected-draft-title',
    'data-selected-draft-pack-id',
    'data-selected-draft-import-scope',
    'data-selected-draft-pending',
    'data-selected-draft-validation',
    'data-review-progress-summary',
    'data-review-progress-pending',
    'data-review-progress-approved',
    'data-review-progress-rejected',
    'data-review-progress-total',
    'data-review-progress-percent',
    'Review progress',
    'Pending Items',
    'Approved Items',
    'Rejected Items',
    'Total Reviewable Items',
    'No draft pack is selected yet. Create Review Draft from an upload or choose a draft pack to see its review summary.',
    'No draft report selected. Create Review Draft from an upload or choose a draft pack to see whether it is ready to promote.'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected selected draft/progress marker ${marker}.`);
  });
}

function assertStandardsTabWorkflowUi() {
  [
    'Standards',
    'Connect this knowledge pack to the standards students are expected to learn.',
    'data-standards-map-count',
    'data-standards-id-count',
    'data-standards-missing-count',
    'data-standards-unknown-count',
    'teacherContentStandardsBankSelect',
    'Select Saved Standards Set',
    'data-standards-bank-select',
    '/api/teacher-content/standards-banks',
    'standardsBankId=${encodeURIComponent(standardsBankId)}',
    'No saved standards sets found. Standards upload will be added later.',
    'data-selected-standards-bank-summary',
    'data-selected-standards-bank-title',
    'data-selected-standards-bank-id',
    'data-selected-standards-bank-subject',
    'data-selected-standards-bank-grade',
    'data-selected-standards-bank-jurisdiction',
    'data-selected-standards-bank-count',
    'data-selected-standards-bank-validation',
    'No saved standards set selected. Draft standard IDs are shown without saved-bank enrichment.',
    'Selected standards set failed to load',
    'data-standard-id-list',
    'data-standard-card',
    'data-standard-card-id',
    'data-standard-id',
    'data-standard-code',
    'data-standard-title',
    'data-standard-description',
    'data-standard-official-text',
    'data-standard-student-friendly-text',
    'data-standard-strand',
    'data-standard-topic',
    'data-standard-keywords',
    'data-standard-bank-match',
    'data-standard-confidence',
    'data-standard-vocabulary',
    'data-standard-concepts',
    'data-standard-review-status',
    'teacherContentStandardsSearch',
    'Search standards in this set',
    'data-standards-search',
    'teacherContentStandardsStrandFilter',
    'data-standards-strand-filter',
    'teacherContentStandardsTopicFilter',
    'data-standards-topic-filter',
    'teacherContentStandardsMatchFilter',
    'Draft match status',
    'data-standards-match-filter',
    'Used in this draft',
    'All standards',
    'Default view: Used in this draft',
    'data-standards-default-used',
    'Not used in this draft',
    'Unknown in selected bank / unmatched',
    'data-standards-filter-controls',
    'data-standard-match-status',
    'data-standard-detail-panel',
    'data-standard-detail-id',
    'data-standard-detail-code',
    'data-standard-detail-title',
    'data-standard-detail-official-text',
    'data-standard-detail-student-friendly-text',
    'data-standard-detail-strand',
    'data-standard-detail-topic',
    'data-standard-detail-keywords',
    'data-standard-detail-vocabulary',
    'data-standard-detail-concepts',
    'data-standard-detail-confidence',
    'data-standard-detail-review-status',
    'No draft selected. Create Review Draft from an upload or choose a draft pack to see its standards alignment.',
    'No standardsMap entries or standard IDs were found for this draft.',
    'Selected standards set has no standards to preview.',
    'No standards match search/filter.',
    'Selected draft standard IDs are unknown in this bank.',
    'Standards bank not loaded. Existing draft IDs are shown without bank details.',
    'Unknown standards found',
    'Upload standards file',
    'Replace standard - coming soon',
    'Edit standard',
    'Vocab',
    'Content/Concept',
    'Source',
    'data-standards-placeholder-controls',
    'data-coming-soon="standards-upload"',
    'data-coming-soon="standards-replace"',
    'data-coming-soon="standards-edit"',
    'data-coming-soon="standards-vocab"',
    'data-coming-soon="standards-content-concept"',
    'data-coming-soon="standards-source"'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected Standards tab workflow marker ${marker}.`);
  });

  [
    /data-coming-soon="standards-upload"[\s\S]*?disabled|disabled[\s\S]*?data-coming-soon="standards-upload"/,
    /data-coming-soon="standards-replace"[\s\S]*?disabled|disabled[\s\S]*?data-coming-soon="standards-replace"/,
    /data-coming-soon="standards-edit"[\s\S]*?disabled|disabled[\s\S]*?data-coming-soon="standards-edit"/,
    /data-coming-soon="standards-vocab"[\s\S]*?disabled|disabled[\s\S]*?data-coming-soon="standards-vocab"/,
    /data-coming-soon="standards-content-concept"[\s\S]*?disabled|disabled[\s\S]*?data-coming-soon="standards-content-concept"/,
    /data-coming-soon="standards-source"[\s\S]*?disabled|disabled[\s\S]*?data-coming-soon="standards-source"/
  ].forEach((pattern) => {
    assert.match(ui, pattern, `Expected disabled placeholder control matching ${pattern}.`);
  });

  assert.match(ui, /id="teacherContentStandardsBankSelect"[\s\S]*?data-standards-bank-select/, 'Saved standards selector should be real and enabled when not loading.');
  assert.doesNotMatch(ui, /data-coming-soon="standards-select"/, 'Saved standards selector should no longer be a disabled placeholder.');
  assert.doesNotMatch(ui, /standardsUpload|uploadStandards|data-standards-upload-action|\/api\/teacher-content\/standards-upload|\/api\/teacher-content\/standards-banks\/upload/i, 'Standards upload POST should remain absent.');
  assert.doesNotMatch(ui, /standardsBankUpload|postStandardsBank|createStandardsBank/i, 'Standards upload POST helpers should remain absent.');
}

function assertReviewCardPolishUi() {
  [
    'Review Draft Items',
    'Check each pending item before this knowledge can go live.',
    'data-review-section=',
    'vocabulary',
    'concepts',
    'referenceFormulas',
    'problemBank',
    'standardsMap',
    'smokeTests',
    'data-review-section-pending',
    'data-review-section-approved',
    'data-review-section-rejected',
    'No pending items in this section.',
    'data-review-item-card',
    'data-review-item-label',
    'data-review-item-confidence',
    'data-review-item-source',
    'data-review-item-snippet',
    'data-review-item-evidence',
    'View Evidence',
    'High confidence',
    'Medium confidence',
    'Low confidence',
    'No pending review items.',
    'This draft is ready to create an approved pack from approved items only.',
    'This draft has no approved items to promote yet.',
    'Promotion Validation Errors',
    'data-review-create-approved-pack',
    'Create Approved Pack from Approved Items',
    'data-review-empty-state',
    'data-review-empty-tab="approvedPacks"',
    'View Approved Packs',
    'Source evidence',
    'Editable fields',
    'Save changes',
    'Approve item',
    'Reject item',
    'Cancel'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected review polish marker ${marker}.`);
  });
}

function assertReviewPromotionButtonConditions() {
  const reviewFunction = ui.match(/function renderReviewCard\(\) \{([\s\S]*?)\n  function renderReviewGroup/);
  assert.ok(reviewFunction, 'Expected renderReviewCard function.');
  assert.match(
    reviewFunction[1],
    /canCreateApprovedPack\s*=\s*summary\.pending\s*===\s*0\s*&&\s*summary\.approved\s*>\s*0/,
    'Review Content should show Create Approved Pack only when pending is 0 and approved is greater than 0.'
  );
  assert.match(
    reviewFunction[1],
    /canCreateApprovedPack \?[\s\S]*data-review-create-approved-pack/,
    'Review Content promotion button should be conditional.'
  );
}

function assertImportReportPolishUi() {
  [
    'Import Report',
    'This report checks whether the reviewed draft is ready to become an approved knowledge pack.',
    'data-import-report-readiness-status',
    'data-import-report-readiness-card',
    'Needs teacher review',
    'Ready to promote',
    'Blocked',
    'Promoted successfully',
    'Promotion copies reviewed draft content into approved knowledge packs.',
    'It will not change student answering yet.',
    'data-import-report-blocked-reasons',
    'data-import-report-blocked-reason',
    'Blocked reasons',
    'data-import-report-review-summary',
    'data-import-report-pending',
    'data-import-report-approved',
    'data-import-report-rejected',
    'data-import-report-total-reviewable',
    'Pending',
    'Approved',
    'Rejected',
    'Total reviewable',
    'data-import-report-validation-summary',
    'data-import-report-extraction',
    'data-import-report-validation',
    'data-import-report-warnings',
    'data-import-report-errors',
    'data-import-coverage-report',
    'data-import-coverage-total-pages',
    'data-import-coverage-total-chunks',
    'data-import-coverage-processed-chunks',
    'data-import-coverage-chunks-with-items',
    'data-import-coverage-empty-chunks',
    'data-import-coverage-sections-detected',
    'data-import-coverage-empty-chunk-list',
    'data-import-coverage-failed-batches',
    'Failed model batches',
    'Retry limit:',
    'Coverage report',
    'Draft item counts by section',
    'Chunks with no extracted knowledge',
    'Extraction',
    'Draft validation',
    'Warnings',
    'Errors',
    'Passed',
    'Failed',
    'Unknown',
    'No draft report selected. Create Review Draft from an upload or choose a draft pack to see whether it is ready to promote.',
    'Report failed to load or is still unavailable. Refresh the selected draft before promoting.',
    'Draft not ready. Finish teacher review before promoting.'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected Import Report polish marker ${marker}.`);
  });
}

function assertApprovedPacksPolishUi() {
  [
    'Knowledge Packs',
    'Dedicated management blade for approved packs and uploaded source history.',
    'data-knowledge-packs-blade',
    'data-approved-pack-card',
    'data-approved-pack-title',
    'data-approved-pack-pack-id',
    'data-approved-pack-metadata',
    'data-approved-pack-status',
    'data-approved-pack-subject',
    'data-approved-pack-grade-level',
    'data-approved-pack-version',
    'data-approved-pack-validation-status',
    'data-approved-pack-import-scope',
    'data-approved-pack-source-range',
    'data-approved-pack-source-file-names',
    'data-approved-pack-created-date',
    'data-approved-pack-updated-date',
    'data-approved-pack-vocabulary-count',
    'data-approved-pack-concept-count',
    'data-approved-pack-reference-formula-count',
    'data-approved-pack-problem-bank-count',
    'data-approved-pack-standards-count',
    'data-approved-pack-smoke-test-count',
    'data-approved-pack-indexed-total',
    'data-approved-pack-activation-toggle',
    'data-approved-pack-toggle-action',
    'data-approved-pack-activation-checkbox',
    'data-approved-pack-activation-status',
    'data-approved-pack-activation-status-meta',
    'data-approved-pack-activation-badge',
    'data-approved-pack-activation-note',
    'data-approved-pack-activation-message',
    'data-approved-pack-delete-action',
    'data-approved-pack-delete-message',
    'data-approved-pack-select-checkbox',
    'data-approved-pack-select-for-delete',
    'data-approved-pack-bulk-delete-panel',
    'data-approved-pack-bulk-delete-action',
    'data-approved-pack-bulk-delete-message',
    'data-approved-pack-selected-count',
    'data-approved-pack-view-edit-action',
    'data-approved-searchable-summary',
    'data-approved-searchable-vocabulary-terms',
    'data-approved-searchable-concepts',
    'data-approved-searchable-problem-questions',
    'data-approved-searchable-standards',
    'Searchable vocabulary terms',
    'Searchable concepts',
    'Searchable problem questions',
    'Searchable standards',
    'Saving activation setting...',
    'Activation setting saved',
    'Enable for future student router use',
    'Enabled',
    'Disabled',
    'Delete Pack',
    'Delete selected knowledge packs',
    'Selected for deletion',
    'Select approved pack for deletion',
    'Selection checkboxes only choose approved packs to archive. Activation checkboxes only save future router activation settings.',
    'Deleting selected approved packs...',
    'Type DELETE to archive these approved knowledge packs:',
    'Deleting approved pack...',
    'Type DELETE',
    'Uploaded source files and draft packs will not be deleted.',
    "method: 'DELETE'",
    'Saved for later. Not connected to student answers yet.',
    'data-approved-pack-sample-badge',
    'data-approved-pack-range-limited',
    'data-no-approved-packs-empty-state',
    'No approved knowledge packs yet.',
    'Review imported draft content before creating approved packs.',
    'data-approved-empty-tab="review"',
    'View Review Content',
    'View / Edit Pack',
    'Uploaded Sources',
    'Upload History',
    'data-uploaded-sources-history',
    'data-upload-history-blade',
    'data-uploaded-source-card',
    'data-uploaded-source-original-filename',
    'data-uploaded-source-upload-id',
    'data-uploaded-source-file-type',
    'data-uploaded-source-extracted-count',
    'data-uploaded-source-text-bearing-count',
    'data-uploaded-source-first-text-bearing',
    'data-uploaded-source-draft-exists',
    'data-uploaded-source-approved-exists',
    'data-uploaded-source-draft-packs',
    'data-uploaded-source-approved-packs',
    'data-uploaded-source-warnings',
    'data-no-uploaded-sources-empty-state',
    'Draft pack exists',
    'Approved pack exists',
    'Source files, draft packs, and approved packs are preserved.',
    'formatDate'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected Approved Packs polish marker ${marker}.`);
  });

  assert.doesNotMatch(ui, /data-approved-pack-switch-placeholder/, 'Approved pack switch should no longer be a disabled placeholder.');
  assert.ok(ui.includes("method: 'PATCH'"), 'Approved pack activation should save with PATCH.');
  assert.ok(ui.includes('approvedActivation'), 'Approved pack activation endpoint helper should exist.');
  assert.ok(ui.includes('approvedDelete'), 'Approved pack delete endpoint helper should exist.');
  assert.ok(ui.includes('approvedBulkDelete'), 'Approved pack bulk delete endpoint helper should exist.');
  assert.match(ui, /window\.prompt/, 'Approved pack delete should require typed confirmation in the UI.');
}

function assertNoForbiddenUiActions() {
  assert.doesNotMatch(ui, /Ollama/i, 'Teacher Content UI should not expose forbidden generation actions.');
  assert.doesNotMatch(style, /Ollama|Gemma|ocr/i, 'Teacher Content styles should not add forbidden generation/OCR references.');
  assert.doesNotMatch(ui, />\s*Generate Draft\s*</i, 'Teacher Content UI should not use Generate Draft as a visible button label.');
  assert.doesNotMatch(ui, /\/api\/student|\/api\/chat|\/api\/router-test/, 'Teacher Content UI should not reference student/router endpoints.');
  assert.doesNotMatch(ui, /\/api\/teacher-content\/drafts\/generate|\/api\/generate-draft|generateDraft/i, 'Teacher Content UI should not reference draft generation endpoints.');
  assert.doesNotMatch(ui, /data-upload-action|data-pack-toggle-action/, 'Teacher Content UI should not implement old placeholder upload/toggle actions.');
  assert.equal((ui.match(/data-promote-draft/g) || []).length, 3, 'Promotion should remain limited to Review Content and Import Report action wiring.');
  assert.ok(ui.includes('data-approved-pack-toggle-action'), 'Approved-pack switches should be real activation controls.');
}

function assertPackageScript() {
  assert.equal(pkg.scripts['test:teacher-content-ui'], 'node scripts/test-teacher-content-ui.js');
}

function assertNoRouterOrStudentFilesChanged() {
  assert.deepEqual(
    snapshotRouterAndStudentFiles(),
    routerStudentFilesBefore,
    'teacher content UI tests should not change router/student files'
  );
}

function assertTeacherContentRouteTestsStillPass() {
  const result = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'test-teacher-content-routes.js')], {
    cwd: projectRoot,
    encoding: 'utf8'
  });

  assert.equal(
    result.status,
    0,
    `teacher-content route tests should pass.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function snapshotRouterAndStudentFiles() {
  const files = walkFiles(projectRoot).filter((filePath) => {
    const relativePath = path.relative(projectRoot, filePath);
    return relativePath.startsWith('lib/router/')
      || relativePath === 'lib/questionRouter.js'
      || relativePath.startsWith('routes/student')
      || relativePath === 'lib/server/questionAnswerService.js';
  });

  const snapshot = {};
  files.forEach((filePath) => {
    const stat = fs.statSync(filePath);
    snapshot[path.relative(projectRoot, filePath)] = {
      size: stat.size,
      mtimeMs: stat.mtimeMs
    };
  });
  return snapshot;
}

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const results = [];
  fs.readdirSync(rootDir, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git') return;
    if (entry.isDirectory()) {
      results.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      results.push(entryPath);
    }
  });
  return results.sort();
}
