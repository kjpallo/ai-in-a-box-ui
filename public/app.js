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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
