(() => {
  const CANONICAL_VOICE_INPUT_SRC = '/voice/voice-input.js';

  function canonicalInput() {
    return window.Charlemagne?.voice?.input || null;
  }

  function initCanonicalInput() {
    const input = canonicalInput();
    if (!input || typeof input.init !== 'function') return;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => input.init(), { once: true });
      return;
    }

    input.init();
  }

  function hasCanonicalScript() {
    return [...document.scripts].some((script) => {
      try {
        return new URL(script.src, window.location.href).pathname === CANONICAL_VOICE_INPUT_SRC;
      } catch {
        return false;
      }
    });
  }

  if (canonicalInput()) {
    initCanonicalInput();
    return;
  }

  if (hasCanonicalScript()) {
    initCanonicalInput();
    return;
  }

  const script = document.createElement('script');
  script.src = CANONICAL_VOICE_INPUT_SRC;
  script.onload = initCanonicalInput;
  script.onerror = () => {
    console.warn('[Voice Input] Could not load canonical voice input module.');
  };
  document.head.appendChild(script);
})();
