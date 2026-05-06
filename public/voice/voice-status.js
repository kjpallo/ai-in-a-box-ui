(() => {
  const STATUS_TEXT = {
    ready: 'Ready for the next question.',
    listening: 'Listening...',
    recording: 'Recording...',
    thinking: 'Thinking...',
    speaking: 'Speaking...',
    stopped: 'Voice stopped.',
    problem: 'Voice problem'
  };

  let elements = {};

  function init(options = {}) {
    elements = {
      voiceStatus: options.voiceStatus || document.getElementById('voiceStatus'),
      voiceInputStatus: options.voiceInputStatus || document.getElementById('voiceInputStatus'),
      streamStatus: options.streamStatus || document.getElementById('streamStatus'),
      connectionStatus: options.connectionStatus || document.getElementById('connectionStatus')
    };
  }

  function setVoiceStatus(status, detail = '') {
    const key = normalizeStatusKey(status);
    const text = detail || STATUS_TEXT[key] || STATUS_TEXT.ready;
    const state = window.Charlemagne?.state;

    if (elements.voiceStatus) elements.voiceStatus.textContent = text;

    if (state?.set) {
      state.set({
        isListening: key === 'listening',
        isRecording: key === 'recording',
        isThinking: key === 'thinking',
        isSpeaking: key === 'speaking'
      });
    }
  }

  function setVoiceInputStatus(status, detail = '') {
    const key = normalizeStatusKey(status);
    if (elements.voiceInputStatus) {
      elements.voiceInputStatus.textContent = detail || commandStatusText(key);
    }
    setVoiceStatus(key, key === 'ready' ? STATUS_TEXT.ready : detail);
  }

  function setStreamStatus(status) {
    setStatusPill(elements.streamStatus, status);
  }

  function setConnectionStatus(status) {
    setStatusPill(elements.connectionStatus, status);
  }

  function setStatusPill(element, status) {
    if (!element) return;

    const friendly = normalizePillText(status);
    element.textContent = friendly;
    element.classList.remove('status-ready', 'status-thinking', 'status-speaking', 'status-error');

    if (friendly === 'Ready') element.classList.add('status-ready');
    if (friendly === 'Thinking...') element.classList.add('status-thinking');
    if (friendly === 'Speaking...') element.classList.add('status-speaking');
    if (friendly === 'Voice problem') element.classList.add('status-error');
  }

  function normalizeStatusKey(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('record')) return 'recording';
    if (value.includes('listen')) return 'listening';
    if (value.includes('speak') || value.includes('talk') || value.includes('stream') || value.includes('queued')) return 'speaking';
    if (value.includes('think') || value.includes('prepar') || value.includes('transcrib')) return 'thinking';
    if (value.includes('stop')) return 'stopped';
    if (value.includes('error') || value.includes('offline') || value.includes('failed') || value.includes('problem')) return 'problem';
    return 'ready';
  }

  function normalizePillText(status) {
    const key = normalizeStatusKey(status);
    if (key === 'thinking') return 'Thinking...';
    if (key === 'speaking') return 'Speaking...';
    if (key === 'problem') return 'Voice problem';
    return 'Ready';
  }

  function commandStatusText(key) {
    if (key === 'recording') return 'Command Listening: Recording...';
    if (key === 'listening') return 'Command Listening: Listening...';
    if (key === 'thinking') return 'Command Listening: Thinking...';
    if (key === 'problem') return 'Command Listening: Error - check microphone';
    return 'Command Listening: Off';
  }

  const voiceStatus = {
    init,
    setConnectionStatus,
    setStreamStatus,
    setVoiceInputStatus,
    setVoiceStatus
  };

  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.voiceStatus = voiceStatus;
})();
