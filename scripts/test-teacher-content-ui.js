const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const bladePath = path.join(projectRoot, 'public', 'blade-ui.js');
const uiPath = path.join(projectRoot, 'public', 'teacher-content-ui.js');
const stylePath = path.join(projectRoot, 'public', 'style.css');
const indexPath = path.join(projectRoot, 'public', 'index.html');
const packagePath = path.join(projectRoot, 'package.json');

const routerStudentFilesBefore = snapshotRouterAndStudentFiles();

const blade = read(bladePath);
const ui = read(uiPath);
const style = read(stylePath);
const index = read(indexPath);
const pkg = JSON.parse(read(packagePath));

assertTeacherProfileEntry();
assertOverlayMarkupAndSelectors();
assertEndpointReferences();
assertUploadExtractionUi();
assertPrepareReviewHandoffUi();
assertSelectedDraftAndProgressUi();
assertStandardsTabWorkflowUi();
assertReviewCardPolishUi();
assertImportReportPolishUi();
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
    'teacher-content-tab'
  ].forEach((selector) => {
    assert.ok(ui.includes(selector) || style.includes(selector), `Expected selector or hook ${selector}.`);
  });

  ['Upload', 'Standards', 'Draft Pack', 'Review', 'Import Report', 'Approved Packs'].forEach((label) => {
    assert.ok(ui.includes(label), `Expected tab/card label ${label}.`);
  });
}

function assertEndpointReferences() {
  const expectedEndpoints = [
    '/api/teacher-content/dashboard',
    '/api/teacher-content/uploads/extract',
    '/api/teacher-content/uploads/${encodeURIComponent(uploadId)}/prepare-review',
    '/api/teacher-content/drafts',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/report${query}',
    '/api/teacher-content/standards-banks',
    '/api/teacher-content/standards-banks/${encodeURIComponent(standardsBankId)}',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/promote',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}/status',
    '/api/teacher-content/approved'
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
      'dashboard',
      'draftItem',
      'draftItemStatus',
      'draftReport',
      'drafts',
      'promoteDraft',
      'standardsBank',
      'standardsBanks',
      'uploadExtract',
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
    '!state.report?.promotionReadiness?.ready',
    "method: 'POST'",
    'Promotion copies reviewed draft content into approved knowledge packs.',
    'It will not change student answering yet.'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected promotion marker ${marker}.`);
  });

  assert.equal((ui.match(/data-promote-draft/g) || []).length, 2, 'Promote hook should remain limited to one event handler and one Import Report button.');
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
    'data-coming-soon="pack-toggle"',
    'Visual Only'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected placeholder marker ${marker}.`);
  });
}

function assertUploadExtractionUi() {
  [
    'teacherContentUploadFile',
    'type="file"',
    'accept=".txt,.csv,.json,.docx,.xlsx,.pdf"',
    'data-upload-file-input',
    'data-upload-browse',
    'data-upload-extract',
    'data-upload-content-name',
    'data-upload-prepare-review',
    'data-upload-prepare-review-status',
    'Extract Text',
    'Prepare Review',
    'Preparing your review draft',
    'Charlemagne is preparing your review draft...',
    'Review draft prepared.',
    'FormData',
    "method: 'POST'",
    'Prepare Review becomes available after text extraction succeeds.',
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
}

function assertPrepareReviewHandoffUi() {
  [
    'data-prepare-review-handoff',
    'Review draft prepared.',
    'Next step: review pending items before this knowledge can go live.',
    'Draft packs are not live until approved and promoted.',
    'Review draft prepared, but the latest report could not be refreshed.',
    'data-handoff-tab="review"',
    'data-handoff-tab="importReport"',
    'Go to Review',
    'View Import Report'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected Prepare Review handoff marker ${marker}.`);
  });
}

function assertSelectedDraftAndProgressUi() {
  [
    'data-selected-draft-summary',
    'data-selected-draft-title',
    'data-selected-draft-pack-id',
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
    'No draft pack is selected yet. Prepare Review from an upload or choose a draft pack to see its review summary.',
    'No draft report selected. Prepare Review from an upload or choose a draft pack to see whether it is ready to promote.'
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
    'All standards',
    'Used in this draft',
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
    'No draft selected. Prepare Review from an upload or choose a draft pack to see its standards alignment.',
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
    'No pending items in this section.',
    'data-review-item-card',
    'data-review-item-label',
    'data-review-item-confidence',
    'data-review-item-source',
    'data-review-item-snippet',
    'High confidence',
    'Medium confidence',
    'Low confidence',
    'No pending review items.',
    'Check the Import Report to see if this draft is ready to promote.',
    'data-review-empty-state',
    'data-review-empty-tab="importReport"',
    'View Import Report',
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
    'Extraction',
    'Draft validation',
    'Warnings',
    'Errors',
    'Passed',
    'Failed',
    'Unknown',
    'No draft report selected. Prepare Review from an upload or choose a draft pack to see whether it is ready to promote.',
    'Report failed to load or is still unavailable. Refresh the selected draft before promoting.',
    'Draft not ready. Finish teacher review before promoting.'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected Import Report polish marker ${marker}.`);
  });
}

function assertNoForbiddenUiActions() {
  assert.doesNotMatch(ui, /Ollama|Gemma|ocr/i, 'Teacher Content UI should not expose forbidden generation/OCR actions.');
  assert.doesNotMatch(style, /Ollama|Gemma|ocr/i, 'Teacher Content styles should not add forbidden generation/OCR references.');
  assert.doesNotMatch(ui, />\s*Generate Draft\s*</i, 'Teacher Content UI should not use Generate Draft as a visible button label.');
  assert.doesNotMatch(ui, /\/api\/student|\/api\/chat|\/api\/router-test/, 'Teacher Content UI should not reference student/router endpoints.');
  assert.doesNotMatch(ui, /\/api\/teacher-content\/drafts\/generate|\/api\/generate-draft|generateDraft/i, 'Teacher Content UI should not reference draft generation endpoints.');
  assert.doesNotMatch(ui, /data-upload-action|data-pack-toggle-action/, 'Teacher Content UI should not implement old placeholder upload/toggle actions.');
  assert.equal((ui.match(/data-promote-draft/g) || []).length, 2, 'Promotion should remain limited to Import Report action wiring.');
  assert.doesNotMatch(ui, /approved-pack-switch(?![\s\S]{0,120}disabled)|data-approved-pack-toggle-action/i, 'Approved-pack switches should remain disabled/placeholders.');
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
