const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  createTeacherAuthStore,
  generateRecoveryCode,
  hashRecoveryCode,
  hashPin,
  sanitizeTeacherProfileStatus,
  verifyRecoveryCode,
  verifyPin
} = require('../lib/auth/teacherAuth');

async function run() {
  const pin = 'lesson-123';
  const wrongPin = 'lesson-999';
  const pinHash = hashPin(pin);

  assert(pinHash.hash && pinHash.salt, 'hashPin should return a hash and salt');
  assert(pinHash.hash !== pin, 'hashPin should not store the raw PIN/password');
  assert(verifyPin(pin, pinHash), 'verifyPin should accept the correct PIN/password');
  assert(!verifyPin(wrongPin, pinHash), 'verifyPin should reject the wrong PIN/password');
  const standaloneRecoveryCode = generateRecoveryCode();
  const standaloneRecoveryHash = hashRecoveryCode(standaloneRecoveryCode);
  assert(standaloneRecoveryCode.length >= 12, 'generateRecoveryCode should return a long recovery code');
  assert(standaloneRecoveryHash.hash !== standaloneRecoveryCode, 'hashRecoveryCode should not store the raw recovery code');
  assert(verifyRecoveryCode(standaloneRecoveryCode, standaloneRecoveryHash), 'verifyRecoveryCode should accept the correct recovery code');
  assert(!verifyRecoveryCode('WRONG-RECOVERY', standaloneRecoveryHash), 'verifyRecoveryCode should reject the wrong recovery code');

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'teacher-auth-test-'));
  const authFile = path.join(tempDir, 'teacher_auth.json');
  const gmailFile = path.join(tempDir, 'teacher_gmail_auth.json');
  const store = createTeacherAuthStore(authFile);

  try {
    assert(!store.exists(), 'auth store should start without an account');

    const setupResult = await store.createTeacher({
      username: 'teacher',
      pin,
      linkedGoogleEmail: 'teacher@example.com'
    });
    const teacher = setupResult.teacher;
    const firstRecoveryCode = setupResult.recoveryCode;

    assert(teacher.username === 'teacher', 'created teacher should include the username');
    assert(teacher.linkedGoogleEmail === 'teacher@example.com', 'created teacher should include optional linked Google email');
    assert(firstRecoveryCode && firstRecoveryCode.length >= 12, 'setup should return a one-time recovery code');
    assert(store.exists(), 'auth store should create teacher_auth.json');

    const raw = await fsp.readFile(authFile, 'utf8');
    assert(!raw.includes(pin), 'teacher_auth.json should not contain the raw PIN/password');
    assert(!raw.includes(firstRecoveryCode), 'teacher_auth.json should not contain the raw recovery code');

    const saved = store.read();
    assert(saved.username === 'teacher', 'auth store should read the saved username');
    assert(saved.pinHash && saved.pinHash.algorithm === 'scrypt', 'auth store should save a scrypt PIN/password hash');
    assert(saved.recoveryCodeHash && saved.recoveryCodeHash.algorithm === 'scrypt', 'auth store should save a scrypt recovery code hash');
    assert(store.verifyRecovery({ username: 'teacher', recoveryCode: firstRecoveryCode }), 'auth store should verify the correct recovery code');
    assert(!store.verifyRecovery({ username: 'teacher', recoveryCode: 'WRONG-RECOVERY' }), 'auth store should reject the wrong recovery code');
    const originalPinHash = JSON.stringify(saved.pinHash);

    const linkedTeacher = await store.updateGoogleIdentity({
      email: 'teacher.google@example.com',
      name: 'Teacher Google'
    });
    assert(linkedTeacher.linkedGoogleEmail === 'teacher.google@example.com', 'auth store should update linked Google email');
    assert(linkedTeacher.linkedGoogleName === 'Teacher Google', 'auth store should update linked Google name');

    const linkedSaved = store.read();
    assert(JSON.stringify(linkedSaved.pinHash) === originalPinHash, 'updating Google identity should not change the PIN/password hash');
    assert(linkedSaved.googleLinkedAt, 'auth store should record when Google was linked');
    const linkedRaw = await fsp.readFile(authFile, 'utf8');
    assert(!linkedRaw.includes('accessToken'), 'teacher_auth.json should not store Gmail access tokens');
    assert(!linkedRaw.includes('refreshToken'), 'teacher_auth.json should not store Gmail refresh tokens');

    const profileStatus = sanitizeTeacherProfileStatus({
      authStore: store,
      authenticated: true,
      gmailStatus: {
        googleConfigured: true,
        googleConnected: true,
        gmailConnected: true,
        canSendEmail: true,
        accessToken: 'secret-access-token',
        refreshToken: 'secret-refresh-token'
      }
    });
    assert(profileStatus.localTeacherAuthExists, 'profile status should report that local teacher auth exists');
    assert(profileStatus.teacherAuthenticated, 'profile status should report authenticated teacher state');
    assert(profileStatus.gmailConnected, 'profile status should report connected Gmail state');
    assert(profileStatus.linkedGoogleEmail === 'teacher.google@example.com', 'profile status should expose linked Google email');
    const statusRaw = JSON.stringify(profileStatus);
    assert(!statusRaw.includes('secret-access-token'), 'profile status should not expose access tokens');
    assert(!statusRaw.includes('secret-refresh-token'), 'profile status should not expose refresh tokens');
    assert(!statusRaw.includes('pinHash'), 'profile status should not expose PIN/password hashes');

    const verified = store.verifyLogin({ username: 'teacher', pin });
    assert(verified && verified.username === 'teacher', 'auth store should verify the saved teacher login');
    assert(!store.verifyLogin({ username: 'teacher', pin: wrongPin }), 'auth store should reject the wrong PIN/password');

    const newPin = 'reset-456';
    const resetResult = await store.resetPinWithRecovery({
      username: 'teacher',
      newPin
    });
    assert(resetResult.recoveryCode && resetResult.recoveryCode !== firstRecoveryCode, 'successful recovery reset should return a rotated recovery code');
    assert(!store.verifyLogin({ username: 'teacher', pin }), 'successful recovery reset should change the PIN/password');
    assert(store.verifyLogin({ username: 'teacher', pin: newPin }), 'new PIN/password should verify after recovery reset');
    assert(!store.verifyRecovery({ username: 'teacher', recoveryCode: firstRecoveryCode }), 'old recovery code should no longer work');
    assert(store.verifyRecovery({ username: 'teacher', recoveryCode: resetResult.recoveryCode }), 'new recovery code should work after reset');

    const mode = fs.statSync(authFile).mode & 0o777;
    assert(mode === 0o600, `teacher_auth.json should be chmod 600 when possible; saw ${mode.toString(8)}`);

    let overwriteBlocked = false;
    try {
      await store.createTeacher({ username: 'other', pin: 'another-123' });
    } catch (error) {
      overwriteBlocked = error.statusCode === 409;
    }
    assert(overwriteBlocked, 'setup should not overwrite an existing teacher account');

    const gmailAuth = JSON.stringify({ accessToken: 'gmail-token', refreshToken: 'gmail-refresh' });
    await fsp.writeFile(gmailFile, gmailAuth, 'utf8');
    const resetScriptResult = spawnSync(process.execPath, [path.join(__dirname, 'reset-teacher-auth.js'), '--confirm'], {
      env: { ...process.env, TEACHER_AUTH_LOGS_DIR: tempDir },
      encoding: 'utf8'
    });
    assert(resetScriptResult.status === 0, `reset script should exit cleanly: ${resetScriptResult.stderr}`);
    assert(!fs.existsSync(authFile), 'reset script should move teacher_auth.json out of the active path');
    const backups = fs.readdirSync(tempDir).filter((file) => /^teacher_auth\..+\.backup\.json$/.test(file));
    assert(backups.length === 1, 'reset script should create one timestamped teacher auth backup');
    assert(await fsp.readFile(gmailFile, 'utf8') === gmailAuth, 'reset script should not touch Gmail token file');
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }

  console.log('Teacher auth tests passed.');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
