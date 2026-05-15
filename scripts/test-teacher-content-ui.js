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
  [
    '/api/teacher-content/dashboard',
    '/api/teacher-content/uploads/extract',
    '/api/teacher-content/uploads/${encodeURIComponent(uploadId)}/prepare-review',
    '/api/teacher-content/drafts',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/report',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/promote',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}',
    '/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}/status',
    '/api/teacher-content/approved'
  ].forEach((endpoint) => {
    assert.ok(ui.includes(endpoint), `Expected endpoint reference ${endpoint}.`);
  });
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
    'This will copy reviewed draft content into approved knowledge packs. It will not change student answering yet.'
  ].forEach((marker) => {
    assert.ok(ui.includes(marker), `Expected promotion marker ${marker}.`);
  });
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
