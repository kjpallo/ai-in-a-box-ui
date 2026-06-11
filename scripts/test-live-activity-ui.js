const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const bladeUi = fs.readFileSync(path.join(projectRoot, 'public', 'blade-ui.js'), 'utf8');
const profileUi = fs.readFileSync(path.join(projectRoot, 'public', 'profile.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(projectRoot, 'server.js'), 'utf8');
const teacherDashboardCss = fs.readFileSync(path.join(projectRoot, 'public', 'styles', 'teacher-dashboard.css'), 'utf8');

assert.match(
  profileUi,
  /fetchJson\('\/api\/profile\/live-student-activity'\)/,
  'Live Activity should fetch the teacher-only live student activity endpoint.'
);
assert.doesNotMatch(
  profileUi,
  /fetchJson\('\/api\/profile\/student-sessions'\)/,
  'Live Activity should not use the older student-session summary endpoint.'
);
assert.match(
  profileUi,
  /fetchJson\('\/api\/profile\/create-student-session'[\s\S]*renderStudentLink\(result\.studentUrl \|\| ''\)/,
  'Create Student Link should display the backend-provided studentUrl.'
);
assert.doesNotMatch(
  profileUi,
  /window\.location\.origin/,
  'Create Student Link should not rebuild shareable links from window.location.origin.'
);
assert.match(
  bladeUi,
  /<h4>Students Live Now<\/h4>/,
  'Live Activity should make the live student grid the main panel.'
);
assert.match(
  bladeUi,
  /<strong>Active Sessions<\/strong>/,
  'Live Activity should render an Active Sessions board in the right rail.'
);
assert.match(
  bladeUi,
  /id="liveStudentGrid"/,
  'Live Activity should include a live student grid target.'
);
assert.match(
  bladeUi,
  /id="profileStudentSessions"/,
  'Live Activity should include a running sessions render target.'
);
[
  'liveRunningSessionsValue',
  'liveSessionDurationValue',
  'liveStudentPresenceBreakdown',
  'liveMessageCountValue',
  'liveRecentQuestionCountValue',
  'liveTopStandardValue',
  'liveTopTopicValue'
].forEach((id) => {
  assert.match(
    bladeUi,
    new RegExp(`id="${id}"`),
    `Live Activity should include the ${id} summary target.`
  );
});
assert.doesNotMatch(
  bladeUi,
  /id="profileQuestionRows" class="live-feed-list"/,
  'Live Activity should not render the old question feed as its main content.'
);
assert.doesNotMatch(
  bladeUi,
  /<h4>Needs Teacher Attention<\/h4>/,
  'Live Activity should not duplicate the Questions & Standards review panel.'
);
assert.match(
  teacherDashboardCss,
  /\.live-student-tile\b/,
  'Live Activity should style compact anonymous student tiles.'
);
assert.match(
  teacherDashboardCss,
  /\.live-student-grid[\s\S]*grid-template-columns: repeat\(auto-fill, minmax\(138px, 1fr\)\)/,
  'Live Activity student grid should render compact tile buttons.'
);
assert.match(
  bladeUi,
  /id="liveStudentDetailsModal"[\s\S]*data-live-student-modal-close[\s\S]*id="liveStudentDetailsBody"/,
  'Live Activity should include a teacher-only student details modal with close controls.'
);
assert.match(
  profileUi,
  /function renderActiveSessionCard[\s\S]*data-active-session-card[\s\S]*data-copy-student-url="\$\{escapeAttr\(studentUrl\)\}"[\s\S]*Open Student View[\s\S]*data-archive-student-session="\$\{escapeAttr\(sessionId\)\}"/,
  'Active Sessions cards should include per-session copy, open, and archive actions using that session URL/id.'
);
assert.match(
  profileUi,
  /rows\.innerHTML = sortedSessions\.map\(renderActiveSessionCard\)\.join\(''\)/,
  'Active Sessions board should render every running session instead of replacing older sessions.'
);
assert.match(
  profileUi,
  /function normalizeLiveSessions[\s\S]*sort\(\(a, b\) => String\(b\.createdAt \|\| ''\)\.localeCompare\(String\(a\.createdAt \|\| ''\)\)\)/,
  'Active Sessions should sort sessions newest first before rendering.'
);
const liveStudentCardBody = profileUi.match(/function renderLiveStudentCard[\s\S]*?(?=\n  async function archiveStudentSession)/)?.[0] || '';
assert.doesNotMatch(
  liveStudentCardBody,
  /data-archive-student-session|End Session &amp; Archive/,
  'End Session & Archive should not be rendered inside student cards.'
);
assert.match(
  liveStudentCardBody,
  /<button[\s\S]*data-live-student-modal-open[\s\S]*data-live-student-index="\$\{escapeAttr\(tile\.index\)\}"[\s\S]*data-student-display-name="\$\{escapeAttr\(tile\.displayName\)\}"[\s\S]*data-session-name="\$\{escapeAttr\(tile\.sessionName\)\}"/,
  'Student grid should render compact tile buttons with modal-open data attributes.'
);
assert.match(
  profileUi,
  /const LIVE_STUDENT_STATUS_TAGS = \[[\s\S]*'active'[\s\S]*'idle'[\s\S]*'no-question'[\s\S]*'needs-review'[\s\S]*'out-of-questions'[\s\S]*'formula-tutor'[\s\S]*\]/,
  'Live Activity should define every student tile status tag.'
);
[
  'active',
  'idle',
  'no-question',
  'needs-review',
  'out-of-questions',
  'formula-tutor'
].forEach((status) => {
  assert.match(
    profileUi,
    new RegExp(`data-status-${status}`),
    `Student tiles should expose data-status-${status}.`
  );
  assert.match(
    teacherDashboardCss,
    new RegExp(`\\.live-student-tile\\.${status.replace('-', '\\-')}`),
    `Student tile CSS should include the ${status} status class.`
  );
});
assert.match(
  profileUi,
  /currentLiveStudentTiles = liveHubs\.map\(\(item, index\) => buildLiveStudentTile\(item\.hub, item\.session, index\)\)/,
  'Live Activity should render exactly one tile per returned anonymous hub.'
);
assert.match(
  profileUi,
  /safeRecentLiveMessages\(hub\?\.recentMessages\)/,
  'Student modal should use the safe serialized recentMessages payload.'
);
assert.match(
  profileUi,
  /function buildLiveSummaryStats[\s\S]*totalMessageCount[\s\S]*recentQuestionCount[\s\S]*topStandardId[\s\S]*topTopic/,
  'Live Activity should derive safe aggregate summary stats for running sessions.'
);
assert.doesNotMatch(
  profileUi,
  /addOptionalSafeObject\(serialized, 'debug'|addOptionalSafeObject\(serialized, 'sourceMetadata'/,
  'Live Activity serialization should not include raw debug or source metadata objects.'
);
const liveStudentRecentMessagesBody = profileUi.match(/function renderLiveStudentRecentMessages[\s\S]*?(?=\n  async function archiveStudentSession)/)?.[0] || '';
['Student', 'Charlemagne', 'Standard', 'Topic', 'Source'].forEach((label) => {
  assert.match(
    liveStudentRecentMessagesBody,
    new RegExp(label),
    `Student modal should display ${label} in recent safe message history.`
  );
});
const liveStudentModalBody = profileUi.match(/function safeRecentLiveMessages[\s\S]*?(?=\n  async function archiveStudentSession)/)?.[0] || '';
assert.doesNotMatch(
  liveStudentModalBody,
  /debug|sourceMetadata|currentTutorProblem|pendingClarification|finalAnswer/,
  'Student modal rendering should not expose hidden debug or runtime fields.'
);
assert.match(
  profileUi,
  /byId\('liveStudentDetailsModal'\)\?\.addEventListener\('click'[\s\S]*data-live-student-modal-close[\s\S]*closeLiveStudentDetailsModal/,
  'Student modal should close from backdrop and close button clicks.'
);
assert.match(
  profileUi,
  /event\.key !== 'Escape'[\s\S]*!byId\('liveStudentDetailsModal'\)\?\.hidden[\s\S]*closeLiveStudentDetailsModal/,
  'Student modal should close when Escape is pressed.'
);
assert.doesNotMatch(
  bladeUi,
  /id="profileStudentLinkPanel"|id="profileCopyStudentLink"|id="profileStudentUrl"/,
  'Copy/open session controls should live on Active Sessions cards, not the create-link panel.'
);
assert.match(
  profileUi,
  /\/api\/profile\/student-sessions\/\$\{encodeURIComponent\(sessionId\)\}\/archive/,
  'End Session & Archive should call the teacher session archive endpoint.'
);
assert.match(
  profileUi,
  /This will save this session to CSV\.[\s\S]*The session will remain available in Questions & Standards\.[\s\S]*Raw JSON history for this session will be deleted after the CSV is verified\.[\s\S]*This cannot be undone from the app\./,
  'End Session & Archive confirmation should clearly explain retention and deletion.'
);
assert.match(
  bladeUi,
  /Phones\/tablets must be on the same local network as this teacher device\./,
  'Live Activity should tell teachers student devices must use the same local network.'
);
assert.match(
  profileUi,
  /suggestedBaseUrls/,
  'Live Activity should render LAN URL suggestions returned by classroom controls.'
);
assert.match(
  teacherDashboardCss,
  /\.profile-student-lan-hint\b/,
  'Live Activity should style the LAN student-link hint.'
);
assert.match(
  teacherDashboardCss,
  /\.active-session-card\b/,
  'Active Sessions cards should have dedicated board styling.'
);
assert.match(
  teacherDashboardCss,
  /\.profile-student-session-rows[\s\S]*overflow-y: auto/,
  'Active Sessions board should allow multiple visible running sessions.'
);
assert.match(
  serverJs,
  /const HOST = process\.env\.HOST \|\| '';/,
  'Server should allow HOST to configure LAN binding.'
);
assert.match(
  serverJs,
  /app\.listen\(PORT, HOST \|\| undefined,/,
  'Server should pass HOST to app.listen while preserving the default local dev start.'
);

console.log('live activity UI: teacher grid uses live endpoint and avoids report feed layout');
