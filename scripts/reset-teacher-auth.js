const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const projectDir = path.join(__dirname, '..');
const logsDir = process.env.TEACHER_AUTH_LOGS_DIR || path.join(projectDir, 'logs');
const authFile = path.join(logsDir, 'teacher_auth.json');

async function run() {
  if (!process.argv.includes('--confirm')) {
    console.error('This clears the local teacher login so first-time setup can run again.');
    console.error('Run with: node scripts/reset-teacher-auth.js --confirm');
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(authFile)) {
    console.log('No logs/teacher_auth.json file was found. First-time setup is already required.');
    return;
  }

  await fsp.mkdir(logsDir, { recursive: true });
  const backupFile = path.join(logsDir, `teacher_auth.${timestampForFile()}.backup.json`);
  await fsp.rename(authFile, backupFile);

  console.log(`Moved logs/teacher_auth.json to ${path.relative(projectDir, backupFile)}.`);
  console.log('The teacher will need to run first-time setup again.');
  console.log('Gmail tokens in logs/teacher_gmail_auth.json were not touched.');
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
