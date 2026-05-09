const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const {
  createTeacherAuthStore,
  hashPin,
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

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'teacher-auth-test-'));
  const authFile = path.join(tempDir, 'teacher_auth.json');
  const store = createTeacherAuthStore(authFile);

  try {
    assert(!store.exists(), 'auth store should start without an account');

    const teacher = await store.createTeacher({
      username: 'teacher',
      pin,
      linkedGoogleEmail: 'teacher@example.com'
    });

    assert(teacher.username === 'teacher', 'created teacher should include the username');
    assert(teacher.linkedGoogleEmail === 'teacher@example.com', 'created teacher should include optional linked Google email');
    assert(store.exists(), 'auth store should create teacher_auth.json');

    const raw = await fsp.readFile(authFile, 'utf8');
    assert(!raw.includes(pin), 'teacher_auth.json should not contain the raw PIN/password');

    const saved = store.read();
    assert(saved.username === 'teacher', 'auth store should read the saved username');
    assert(saved.pinHash && saved.pinHash.algorithm === 'scrypt', 'auth store should save a scrypt PIN/password hash');

    const verified = store.verifyLogin({ username: 'teacher', pin });
    assert(verified && verified.username === 'teacher', 'auth store should verify the saved teacher login');
    assert(!store.verifyLogin({ username: 'teacher', pin: wrongPin }), 'auth store should reject the wrong PIN/password');

    const mode = fs.statSync(authFile).mode & 0o777;
    assert(mode === 0o600, `teacher_auth.json should be chmod 600 when possible; saw ${mode.toString(8)}`);

    let overwriteBlocked = false;
    try {
      await store.createTeacher({ username: 'other', pin: 'another-123' });
    } catch (error) {
      overwriteBlocked = error.statusCode === 409;
    }
    assert(overwriteBlocked, 'setup should not overwrite an existing teacher account');
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
