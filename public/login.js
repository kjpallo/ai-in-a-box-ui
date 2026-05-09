(() => {
  const state = {
    mode: 'login'
  };

  const shell = document.querySelector('.login-unlock-shell');
  const form = document.getElementById('teacherLoginForm');
  const copy = document.getElementById('loginCopy');
  const message = document.getElementById('teacherLoginMessage');
  const button = document.getElementById('teacherLoginButton');
  const forgotButton = document.getElementById('teacherForgotButton');
  const backButton = document.getElementById('teacherBackButton');
  const username = document.getElementById('teacherUsername');
  const pin = document.getElementById('teacherPin');
  const confirmField = document.getElementById('confirmPinField');
  const confirmPin = document.getElementById('teacherConfirmPin');
  const recoveryCodeField = document.getElementById('recoveryCodeField');
  const recoveryCode = document.getElementById('teacherRecoveryCode');

  async function boot() {
    try {
      const status = await fetchJson('/api/auth/status');

      if (status.authenticated) {
        openBlades();
        return;
      }

      setMode(status.setupRequired ? 'setup' : 'login');
      form.hidden = false;
      username.focus();
    } catch (error) {
      setMessage(error.message || 'Could not check teacher login.', true);
      setMode('login');
      form.hidden = false;
    }
  }

  function setMode(mode) {
    state.mode = mode;
    const isSetup = mode === 'setup';
    const isRecovery = mode === 'recovery';

    confirmField.hidden = !(isSetup || isRecovery);
    confirmPin.required = isSetup || isRecovery;
    recoveryCodeField.hidden = !isRecovery;
    recoveryCode.required = isRecovery;
    pin.autocomplete = isSetup || isRecovery ? 'new-password' : 'current-password';
    pin.previousElementSibling.textContent = isRecovery ? 'New PIN/password' : 'PIN/password';
    button.textContent = isSetup ? 'Create and Unlock' : isRecovery ? 'Reset PIN/password' : 'Unlock Teacher Mode';
    forgotButton.hidden = mode !== 'login';
    backButton.hidden = !isRecovery;

    copy.innerHTML = isSetup
      ? `
        <h2>First-time setup</h2>
        <p>Create the local teacher login for this Charlemagne box.</p>
        <small>Google can be connected later for email and identity features.</small>
      `
      : isRecovery
        ? `
          <h2>Recover access</h2>
          <p>Enter the local username, saved recovery code, and a new PIN/password.</p>
          <small>The code works once; a new one will be shown after reset.</small>
        `
      : `
        <h2>Teacher login</h2>
        <p>Enter the local teacher PIN/password to unlock the classroom console.</p>
      `;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('', false);
    button.disabled = true;

    const payload = {
      username: username.value.trim(),
      pin: pin.value
    };

    if (state.mode === 'setup' || state.mode === 'recovery') {
      payload.confirmPin = confirmPin.value;
    }

    try {
      if (state.mode === 'recovery') {
        await submitRecovery();
        return;
      }

      const result = await fetchJson(state.mode === 'setup' ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (state.mode === 'setup') {
        showRecoveryCode({
          title: 'Recovery code',
          body: 'Save this recovery code. It is the only way to reset your PIN/password if Google recovery is not connected yet.',
          recoveryCode: result.recoveryCode,
          actionText: 'Continue to Charlemagne',
          onContinue: openBlades
        });
        return;
      }

      const status = await fetchJson('/api/auth/status');
      if (status.authenticated) {
        setMessage('Teacher mode unlocked.', false);
        openBlades();
        return;
      }

      setMode('login');
      pin.value = '';
      confirmPin.value = '';
      setMessage('Teacher login created. Sign in to continue.', false);
    } catch (error) {
      setMessage(error.message || 'Could not unlock teacher mode.', true);
      pin.select();
    } finally {
      button.disabled = false;
    }
  }

  async function submitRecovery() {
    if (pin.value !== confirmPin.value) {
      throw new Error('PIN/password confirmation does not match.');
    }

    const verifyResult = await fetchJson('/api/auth/recover/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value.trim(),
        recoveryCode: recoveryCode.value
      })
    });

    const resetResult = await fetchJson('/api/auth/recover/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recoveryToken: verifyResult.recoveryToken,
        newPin: pin.value,
        confirmPin: confirmPin.value
      })
    });

    showRecoveryCode({
      title: 'PIN/password reset',
      body: 'Save this new recovery code. The old recovery code no longer works.',
      recoveryCode: resetResult.recoveryCode,
      actionText: 'Return to login',
      onContinue: () => {
        clearInputs();
        setMode('login');
        form.hidden = false;
        username.focus();
      }
    });
  }

  function showRecoveryCode({ title, body, recoveryCode, actionText, onContinue }) {
    form.hidden = true;
    copy.innerHTML = `
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(body)}</p>
      <div class="teacher-recovery-code" aria-label="Recovery code">${escapeHtml(recoveryCode || '')}</div>
      <button id="teacherRecoveryContinue" class="teacher-recovery-continue" type="button">${escapeHtml(actionText)}</button>
    `;

    document.getElementById('teacherRecoveryContinue').addEventListener('click', onContinue, { once: true });
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    return data;
  }

  function setMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle('is-error', Boolean(isError));
  }

  function openBlades() {
    try {
      localStorage.setItem('charlemagneBladeActive', 'main');
      sessionStorage.setItem('charlemagneJustUnlocked', 'true');
    } catch (_) {}

    shell.classList.add('is-unlocking');
    form.hidden = true;
    copy.innerHTML = `
      <h2>Unlocking</h2>
      <p>Main blade coming online.</p>
    `;

    window.setTimeout(() => {
      window.location.href = '/';
    }, 980);
  }

  function clearInputs() {
    pin.value = '';
    confirmPin.value = '';
    recoveryCode.value = '';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  }

  form.addEventListener('submit', handleSubmit);
  forgotButton.addEventListener('click', () => {
    clearInputs();
    setMessage('', false);
    setMode('recovery');
    recoveryCode.focus();
  });
  backButton.addEventListener('click', () => {
    clearInputs();
    setMessage('', false);
    setMode('login');
    pin.focus();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
