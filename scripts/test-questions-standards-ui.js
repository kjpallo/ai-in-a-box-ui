const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const profileUi = read(path.join(projectRoot, 'public', 'profile.js'));
const bladeUi = read(path.join(projectRoot, 'public', 'blade-ui.js'));
const teacherDashboardCss = read(path.join(projectRoot, 'public', 'styles', 'teacher-dashboard.css'));
const responsiveCss = read(path.join(projectRoot, 'public', 'styles', 'responsive.css'));
const exportHandler = between(profileUi, 'async function exportReportCsv()', 'function printReport()');
const purgeHandler = between(profileUi, 'async function purgeQuestionsStandardsExport()', 'function printReport()');
const archiveHandler = between(profileUi, 'async function archiveStudentSession(button)', 'async function restartStudentSessionFromReport(button)');
const restartHandler = between(profileUi, 'async function restartStudentSessionFromReport(button)', 'function formatLiveQuestionsLeft');

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
  /questionsStandardsExportState = \{\s*exportId,\s*date: selectedDate,\s*filter: reportQuestionFilter\s*\}/,
  'Questions & Standards CSV export should store the export id for the current date and filter.'
);
assert.match(
  profileUi,
  /let currentReportQuestions = \[\]/,
  'Questions & Standards should keep report rows separate from Live Activity questions.'
);
assert.match(
  profileUi,
  /currentReportQuestions = safeSummary\.questions/,
  'Questions & Standards report rows should come from the archive-aware standards summary.'
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
  /id="reportPurgeRawHistory"[^>]*hidden[^>]*disabled[^>]*>Delete raw history used for this CSV/,
  'Questions & Standards purge UI should be unavailable before a successful export.'
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
  bladeUi,
  /id="reportSessionGroups"/,
  'Questions & Standards should render archived/completed session groups.'
);
assert.match(
  bladeUi,
  /id="reportSessionGroupCount"/,
  'Questions & Standards should show an archived session group count.'
);
assert.match(
  teacherDashboardCss,
  /\.reports-panel\s*\{[\s\S]*grid-template-rows:\s*auto auto auto auto minmax\(0,\s*1fr\)/,
  'Questions & Standards should reserve a real row for Archived Sessions above Student Questions.'
);
assert.match(
  teacherDashboardCss,
  /\.report-session-groups\s*\{[\s\S]*max-height:[\s\S]*overflow-y:\s*auto[\s\S]*padding:/,
  'Archived Sessions should render in a readable list area instead of a clipped band.'
);
assert.doesNotMatch(
  teacherDashboardCss,
  /\.report-session-groups-card\s*\{[^}]*overflow:\s*hidden/,
  'Archived Sessions card should not clip session details or restart actions.'
);
assert.match(
  responsiveCss,
  /\.report-session-group\s*\{[\s\S]*grid-template-columns:\s*1fr[\s\S]*\.report-session-restart-button,\s*\.report-session-archive-button\s*\{[\s\S]*width:\s*100%/,
  'Archived and current session cards should stack cleanly with full-width action buttons on small screens.'
);
assert.match(
  bladeUi,
  /Ask questions from a student link first\. Saved sessions will appear here after you archive them\./,
  'Archived Sessions empty state should explain how to save a restartable session.'
);
assert.match(
  profileUi,
  /function buildArchiveableReportSessionGroups[\s\S]*if \(isArchivedReportQuestion\(question\)\) return;[\s\S]*question\?\.sessionKey[\s\S]*question\?\.sessionId[\s\S]*question\?\.classSessionId/,
  'Questions & Standards should build save actions from current unarchived session groups.'
);
assert.match(
  profileUi,
  /function renderArchiveableReportSessionGroup[\s\S]*data-report-current-session-group[\s\S]*data-archive-student-session="\$\{escapeAttr\(group\.sessionKey \|\| ''\)\}"[\s\S]*Save as Restartable Session/,
  'Unarchived Questions & Standards session groups should render a clear archive/save action.'
);
assert.match(
  profileUi,
  /These current questions are missing a session key, so they cannot be saved as restartable sessions yet\.|Save is unavailable because this question set is missing a session key\./,
  'Questions & Standards should explain when a current question set cannot be archived or restarted.'
);
assert.match(
  profileUi,
  /byId\('reportSessionGroups'\)\?\.addEventListener\('click'[\s\S]*data-archive-student-session[\s\S]*archiveStudentSession\(archiveButton\)/,
  'Questions & Standards Archived Sessions area should wire save actions to the existing archive endpoint.'
);
assert.match(
  profileUi,
  /function buildReportSessionGroups[\s\S]*sessionKey[\s\S]*archive:\$\{question\.archiveId\}[\s\S]*normalizeRestartedSessionTitle/,
  'Questions & Standards should group archived questions by session id or safe fallback key.'
);
assert.match(
  profileUi,
  /needsReviewCount[\s\S]*missingStandardCount[\s\S]*reviewStatusForQuestion\(question\)[\s\S]*hasQuestionStandard\(question\)/,
  'Archived session groups should track needs-review and missing-standard counts.'
);
assert.match(
  profileUi,
  /Matched standards[\s\S]*Needs review[\s\S]*Missing standards[\s\S]*Status/,
  'Archived session cards should show readable metadata for questions, standards, review state, and status.'
);
assert.match(
  profileUi,
  /data-restart-student-session="\$\{escapeAttr\(group\.restartKey\)\}"/,
  'Archived session groups should render Restart Session buttons with the correct session key.'
);
assert.match(
  profileUi,
  /Restart Session[\s\S]*Restart unavailable/,
  'Archived session groups should show a visible restart button or a disabled unavailable state.'
);
assert.match(
  profileUi,
  /data-restart-session-class-name="\$\{escapeAttr\(group\.restartClassName \|\| ''\)\}"/,
  'Archived session restart buttons should only send a clean stored class name when one exists.'
);
assert.match(
  profileUi,
  /function renderRestartedReportSessionLink[\s\S]*Session restarted[\s\S]*New student link is ready:[\s\S]*data-copy-restarted-student-url[\s\S]*Open Student Link/,
  'Restart success should render the new student link and actions inline with Archived Sessions.'
);
assert.match(
  profileUi,
  /byId\('reportSessionGroups'\)\?\.addEventListener\('click'[\s\S]*data-restart-student-session[\s\S]*restartStudentSessionFromReport/,
  'Restart buttons should be wired from the Questions & Standards session group area.'
);
assert.match(
  restartHandler,
  /\/api\/profile\/student-sessions\/\$\{encodeURIComponent\(sessionKey\)\}\/restart/,
  'Restart Session should call the teacher-only restart route.'
);
assert.match(
  restartHandler,
  /body: JSON\.stringify\(sessionClassName \? \{ className: sessionClassName \} : \{\}\)/,
  'Restart Session should not send fallback-only labels as className.'
);
assert.match(
  restartHandler,
  /if \(!result\?\.ok \|\| !studentUrl \|\| !restartSessionLinkMatchesResponse\(studentUrl, result\)\)[\s\S]*Restart did not return a joinable student link\./,
  'Restart Session should reject malformed restart responses instead of rendering a broken link.'
);
assert.match(
  profileUi,
  /function restartSessionLinkMatchesResponse\(studentUrl, result\)[\s\S]*searchParams\.get\('sessionId'\)[\s\S]*searchParams\.get\('classSessionId'\)[\s\S]*linkedSessionId === expectedSessionId/,
  'Restart Session should verify the returned studentUrl contains the returned live session id.'
);
assert.match(
  restartHandler,
  /restartedReportSessions\.set\(sessionKey[\s\S]*renderStudentLink\(studentUrl\)/,
  'Restart Session should use the returned studentUrl and keep it visible in Archived Sessions.'
);
assert.match(
  profileUi,
  /function stripRestartedPrefixes[\s\S]*function cleanRestartSessionBaseName[\s\S]*function normalizeRestartedSessionTitle/,
  'Restart Session should normalize repeated Restarted prefixes on the frontend.'
);
assert.doesNotMatch(
  restartHandler,
  /Restarted \$\{result|result\?\.message \|\| 'Session restarted/,
  'Restart Session should use safe local success copy instead of trusting confusing doubled backend copy.'
);
assert.match(
  restartHandler,
  /loadStudentSessions\(\)[\s\S]*loadStandardsSummaryReport\(\)/,
  'Restart Session should refresh Live Activity and keep Questions & Standards refreshed.'
);
assert.match(
  archiveHandler,
  /const statusId = button\?\.closest\('#reportSessionGroups'\) \? 'reportExportStatus' : 'profileStudentLinkStatus'/,
  'Archive failures from Questions & Standards should be shown in the teacher report UI.'
);
assert.match(
  archiveHandler,
  /body: JSON\.stringify\(className \? \{ confirm: true, className \} : \{ confirm: true \}\)/,
  'Questions & Standards archive actions should send the stored class label when available.'
);
assert.match(
  archiveHandler,
  /loadStudentSessions\(\)[\s\S]*loadStandardsSummaryReport\(\)/,
  'Archive success should refresh Live Activity and Questions & Standards immediately.'
);
assert.doesNotMatch(
  restartHandler,
  /purgeQuestionsStandardsExport|reportPurgeRawHistory|archiveStudentSession/,
  'Restart Session should not purge, archive, or mutate old Questions & Standards history.'
);
assert.match(
  profileUi,
  /byId\('reportExportCsv'\)\?\.addEventListener\('click', exportReportCsv\)/,
  'Export behavior should stay wired.'
);
assert.match(
  profileUi,
  /byId\('reportPurgeRawHistory'\)\?\.addEventListener\('click', purgeQuestionsStandardsExport\)/,
  'Delete raw history should be wired only to the explicit purge action.'
);
assert.match(
  purgeHandler,
  /const exportId = validQuestionsStandardsExportId\(\);[\s\S]*if \(!exportId\)/,
  'Purge should require a valid stored export id before it can call the server.'
);
assert.match(
  purgeHandler,
  /window\.confirm\(\[/,
  'Purge should require explicit teacher confirmation.'
);
assert.match(
  purgeHandler,
  /The CSV has already been exported\.[\s\S]*delete only the raw JSON history records used to make that CSV[\s\S]*It will not delete the CSV\.[\s\S]*It will not delete problem\/question review logs\.[\s\S]*It cannot be undone from the app\./,
  'Purge confirmation should explain exactly what will and will not be deleted.'
);
assert.match(
  purgeHandler,
  /if \(!confirmed\) return;[\s\S]*fetch\(\s*`\/api\/profile\/questions-standards\/export\/\$\{encodeURIComponent\(exportId\)\}\/purge`/,
  'Purge endpoint should be called only after confirmation.'
);
assert.match(
  purgeHandler,
  /method: 'POST'[\s\S]*body: JSON\.stringify\(\{ confirm: true \}\)/,
  'Purge should send confirm true to the backend.'
);
assert.match(
  purgeHandler,
  /Raw history deleted for this export\. Deleted records: \$\{deletedCount\}/,
  'Purge success should report deleted record count.'
);
assert.match(
  purgeHandler,
  /loadSummary\(selectedReportDate\(\)\)[\s\S]*loadStandardsSummaryReport\(\)/,
  'Purge success should refresh Questions & Standards data.'
);
assert.match(
  exportHandler,
  /exportButton\) exportButton\.disabled = currentReportQuestions\.length === 0/,
  'Export button state should use archive-aware report question rows.'
);
assert.match(
  purgeHandler,
  /Could not delete raw history for this export\./,
  'Purge failure should show a clear error.'
);
assert.match(
  profileUi,
  /function validQuestionsStandardsExportId\(\)[\s\S]*questionsStandardsExportState\.date !== selectedReportDate\(\)[\s\S]*questionsStandardsExportState\.filter !== reportQuestionFilter/,
  'Stored export ids should only be valid for the same date and filter.'
);
assert.match(
  profileUi,
  /reportQuestionFilter = button\.getAttribute\('data-report-filter'\) \|\| 'all';\s*clearQuestionsStandardsExportState\(\);/,
  'Changing the Questions & Standards filter should clear the stored export id.'
);
assert.match(
  profileUi,
  /function syncDateSelectValue\(value\)[\s\S]*clearQuestionsStandardsExportState\(\);/,
  'Changing the Questions & Standards date should clear the stored export id.'
);
assert.doesNotMatch(
  profileUi,
  /purgeQuestionsStandardsExport\(\);|await purgeQuestionsStandardsExport\(/,
  'Purge should not run automatically.'
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
