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
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/report',
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
      'uploadExtract',
      'uploadPrepareReview'
    ].sort(),
    'Teacher Content UI should not add endpoint helpers beyond the existing dashboard, extract, prepare-review, drafts, report, review PATCH, promote, and approved helpers.'
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
    'data-coming-soon="standards-select"',
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
  assert.doesNotMatch(ui, />\s*Generate Draft\s*</i, 'Teacher Content UI should not use Generate Draft as a visible button label.');
  assert.doesNotMatch(ui, /\/api\/student|\/api\/chat|\/api\/router-test/, 'Teacher Content UI should not reference student/router endpoints.');
  assert.doesNotMatch(ui, /\/api\/teacher-content\/drafts\/generate|\/api\/generate-draft|generateDraft/i, 'Teacher Content UI should not reference draft generation endpoints.');
  assert.doesNotMatch(ui, /data-upload-action|data-pack-toggle-action/, 'Teacher Content UI should not implement old placeholder upload/toggle actions.');
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
