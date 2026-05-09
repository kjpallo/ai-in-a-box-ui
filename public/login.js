(() => {
  const state = {
    mode: 'login'
  };

  const shell = document.querySelector('.login-unlock-shell');
  const form = document.getElementById('teacherLoginForm');
  const copy = document.getElementById('loginCopy');
  const message = document.getElementById('teacherLoginMessage');
  const button = document.getElementById('teacherLoginButton');
  const username = document.getElementById('teacherUsername');
  const pin = document.getElementById('teacherPin');
  const confirmField = document.getElementById('confirmPinField');
  const confirmPin = document.getElementById('teacherConfirmPin');

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

    confirmField.hidden = !isSetup;
    confirmPin.required = isSetup;
    pin.autocomplete = isSetup ? 'new-password' : 'current-password';
    button.textContent = isSetup ? 'Create and Unlock' : 'Unlock Teacher Mode';

    copy.innerHTML = isSetup
      ? `
        <h2>First-time setup</h2>
        <p>Create the local teacher login for this Charlemagne box.</p>
        <small>Google can be connected later for email and identity features.</small>
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

    if (state.mode === 'setup') {
      payload.confirmPin = confirmPin.value;
    }

    try {
      await fetchJson(state.mode === 'setup' ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

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

  form.addEventListener('submit', handleSubmit);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
