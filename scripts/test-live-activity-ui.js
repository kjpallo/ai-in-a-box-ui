const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const bladeUi = fs.readFileSync(path.join(projectRoot, 'public', 'blade-ui.js'), 'utf8');
const profileUi = fs.readFileSync(path.join(projectRoot, 'public', 'profile.js'), 'utf8');
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

console.log('live activity UI: teacher grid uses live endpoint and avoids report feed layout');
