const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const profileUi = read(path.join(projectRoot, 'public', 'profile.js'));
const bladeUi = read(path.join(projectRoot, 'public', 'blade-ui.js'));
const exportHandler = between(profileUi, 'async function exportReportCsv()', 'function printReport()');

assert.match(
  profileUi,
  /QUESTIONS_STANDARDS_EXPORT_ENDPOINT = '\/api\/profile\/questions-standards\/export\.csv'/,
  'Questions & Standards CSV export should point to the server export endpoint.'
);
assert.match(
  exportHandler,
  /fetch\(buildQuestionsStandardsExportUrl\(selectedDate\), \{ cache: 'no-store' \}\)/,
  'Questions & Standards CSV export should download from the server endpoint.'
);
assert.match(
  profileUi,
  /params\.set\('date', selectedDate \|\| todayKey\(\)\)/,
  'Questions & Standards CSV export should preserve the selected date filter.'
);
assert.match(
  exportHandler,
  /filenameFromContentDisposition\(response\.headers\.get\('Content-Disposition'\)\)/,
  'Questions & Standards CSV export should respect the server download filename.'
);
assert.match(
  exportHandler,
  /response\.headers\.get\('X-Export-Id'\)/,
  'Questions & Standards CSV export should read the server export id.'
);
assert.match(
  exportHandler,
  /CSV exported\. Export ID saved for retention\./,
  'Questions & Standards CSV export should show retention-safe success feedback.'
);
assert.match(
  exportHandler,
  /Could not export CSV from the server\. No retention export was saved\./,
  'Questions & Standards CSV export should show clear server failure feedback.'
);
assert.doesNotMatch(
  exportHandler,
  /new Blob\(|csvRows|csvCell\(/,
  'Browser-only CSV construction should not be the primary Questions & Standards export path.'
);
assert.match(
  bladeUi,
  /id="reportExportCsv"[\s\S]*Export CSV/,
  'Questions & Standards should keep the Export CSV button.'
);
assert.match(
  bladeUi,
  /id="reportPrintReport"[\s\S]*Print/,
  'Questions & Standards should keep the Print button.'
);
assert.match(
  bladeUi,
  /id="reportCopySummary"[\s\S]*Copy Summary/,
  'Questions & Standards should keep the Copy Summary button.'
);
assert.match(
  profileUi,
  /byId\('reportPrintReport'\)\?\.addEventListener\('click', printReport\)/,
  'Print behavior should stay wired.'
);
assert.match(
  profileUi,
  /byId\('reportCopySummary'\)\?\.addEventListener\('click', copyReportSummary\)/,
  'Copy Summary behavior should stay wired.'
);
assert.match(
  profileUi,
  /fetchJson\('\/api\/profile\/live-student-activity'\)/,
  'Live Activity should remain on the teacher-only live activity endpoint.'
);
assert.doesNotMatch(
  profileUi + '\n' + bladeUi,
  /Export and delete|Delete raw history|purge confirmation|data-report-purge|reportPurge|deleteRawHistory/i,
  'Questions & Standards should not add purge/delete controls yet.'
);

const protectedDiff = spawnSync(
  'git',
  [
    'diff',
    '--name-only',
    '--',
    'public/student.html',
    'public/student/student-ui.js',
    'public/styles/student.css',
    'logs/student_interactions.json',
    'problem_questions.json'
  ],
  { cwd: projectRoot, encoding: 'utf8' }
);
assert.equal(protectedDiff.status, 0, protectedDiff.stderr || 'Could not inspect protected file diff.');
assert.equal(
  protectedDiff.stdout.trim(),
  '',
  'Student-facing files and raw history/problem logs should be untouched by this UI export change.'
);

console.log('Questions & Standards UI export checks passed.');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Expected to find ${start}.`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Expected to find ${end}.`);
  return source.slice(startIndex, endIndex);
}
