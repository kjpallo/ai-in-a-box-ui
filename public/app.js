(() => {
  function byId(id) {
    return document.getElementById(id);
  }

  function collectElements() {
    return {
      chatForm: byId('chatForm'),
      messageInput: byId('messageInput'),
      responseText: byId('responseText'),
      sendButton: byId('sendButton'),
      stopAudioButton: byId('stopAudioButton'),
      connectionStatus: byId('connectionStatus'),
      streamStatus: byId('streamStatus'),
      voiceOrb: byId('voiceOrb'),
      voiceStatus: byId('voiceStatus'),
      voiceInputStatus: byId('voiceInputStatus'),
      voiceSelect: byId('voiceSelect'),
      voiceHint: byId('voiceHint'),
      voiceVisualizer: byId('voiceVisualizer'),
      copyButton: byId('copyAnswerButton'),
      clearButton: byId('clearButton'),
      historyList: byId('historyList')
    };
  }

  async function boot() {
    const elements = collectElements();
    const app = window.Charlemagne || {};

    const authReady = await checkTeacherAuth();
    if (!authReady) return;

    bindTeacherLogout();

    app.voiceStatus?.init?.(elements);
    app.tts?.init?.({
      voiceOrb: elements.voiceOrb,
      voiceVisualizer: elements.voiceVisualizer,
      setStreamStatus: app.voiceStatus?.setStreamStatus,
      setVoiceStatus: app.voiceStatus?.setVoiceStatus
    });

    app.ui?.answer?.init?.({
      responseText: elements.responseText,
      copyButton: elements.copyButton,
      clearButton: elements.clearButton,
      messageInput: elements.messageInput,
      onClear() {
        app.tts?.stop?.({ keepStatus: true });
        app.tts?.setOrbSpeaking?.(false);
        app.voiceStatus?.setStreamStatus?.('Ready');
        app.voiceStatus?.setConnectionStatus?.('Ready');
        app.voiceStatus?.setVoiceStatus?.('ready');
      }
    });
    app.ui?.recentQuestions?.init?.({ historyList: elements.historyList });
    app.ui?.questionInput?.init?.(elements);
    app.voice?.input?.init?.();

    await app.ui?.questionInput?.checkHealth?.();
  }

  async function checkTeacherAuth() {
    try {
      const response = await fetch('/api/auth/status', { cache: 'no-store' });
      const status = await response.json().catch(() => ({}));

      if (!response.ok || status.setupRequired || !status.authenticated) {
        window.location.replace('/login.html');
        return false;
      }

      try {
        if (sessionStorage.getItem('charlemagneJustUnlocked') === 'true') {
          localStorage.setItem('charlemagneBladeActive', 'main');
          sessionStorage.removeItem('charlemagneJustUnlocked');
        }
      } catch (_) {}

      return true;
    } catch (_) {
      window.location.replace('/login.html');
      return false;
    }
  }

  function bindTeacherLogout() {
    const button = byId('lockTeacherModeButton');
    if (!button || button.dataset.bound === 'true') return;

    button.dataset.bound = 'true';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Locking...';

      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
      } finally {
        window.location.href = '/login.html';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
