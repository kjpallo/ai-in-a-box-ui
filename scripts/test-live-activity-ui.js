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
  bladeUi,
  /<h4>Students Live Now<\/h4>/,
  'Live Activity should make the live student grid the main panel.'
);
assert.match(
  bladeUi,
  /id="liveStudentGrid"/,
  'Live Activity should include a live student grid target.'
);
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
  /\.live-student-card\b/,
  'Live Activity should style anonymous student monitoring cards.'
);
assert.match(
  teacherDashboardCss,
  /\.live-student-alerts span\b/,
  'Live Activity alerts should be rendered as text badges.'
);
assert.match(
  profileUi,
  /data-archive-student-session/,
  'Live Activity should include a teacher End Session & Archive action.'
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
