(() => {
  const DANGEROUS_COMMAND_PATTERN = /^(?:shutdown|clear logs|reload teacher facts|unlock student mode)\b/;

  function normalizeTranscript(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parse(text) {
    const commandText = normalizeTranscript(text);

    if (DANGEROUS_COMMAND_PATTERN.test(commandText)) return { type: 'not_enabled' };
    if (/^stop listening\b/.test(commandText)) return { type: 'stop_listening' };
    if (/^stop talking\b/.test(commandText)) return { type: 'stop_talking' };
    if (/^clear screen\b/.test(commandText)) return { type: 'clear_screen' };
    if (/^read answer\b/.test(commandText)) return { type: 'read_answer' };
    if (/^lock student mode\b/.test(commandText)) return { type: 'lock_student_mode' };
    if (/^cancel\b/.test(commandText)) return { type: 'cancel' };
    if (/^confirm\b/.test(commandText)) return { type: 'confirm' };

    const askMatch = commandText.match(/^ask\s+(.+)/);
    if (askMatch) return { type: 'ask', payload: askMatch[1].trim() };

    const calculateMatch = commandText.match(/^calculate\s+(.+)/);
    if (calculateMatch) return { type: 'calculate', payload: `calculate ${calculateMatch[1].trim()}` };

    const defineMatch = commandText.match(/^define\s+(.+)/);
    if (defineMatch) return { type: 'define', payload: `define ${defineMatch[1].trim()}` };

    const formulaMatch = commandText.match(/^show formula for\s+(.+)/);
    if (formulaMatch) return { type: 'show_formula', payload: `show formula for ${formulaMatch[1].trim()}` };

    return { type: 'question', payload: commandText };
  }

  function stopTalking() {
    const tts = window.Charlemagne?.tts;
    tts?.stop?.();
    tts?.setOrbSpeaking?.(false);
  }

  function clearScreen() {
    const clearButton = document.getElementById('clearButton');
    if (clearButton) {
      clearButton.click();
      return true;
    }
    return false;
  }

  function readAnswer() {
    const response = document.getElementById('responseText');
    const text = String(response ? response.textContent || '' : '').trim();

    if (!text || response?.classList.contains('response-empty')) {
      return false;
    }

    window.Charlemagne?.ui?.questionInput?.submitQuestion?.(`Read this answer aloud: ${text}`);
    return true;
  }

  function lockStudentMode() {
    window.Charlemagne?.state?.set?.({ studentModeLocked: true });
    return true;
  }

  function submitQuestion(question) {
    window.Charlemagne?.ui?.questionInput?.submitQuestion?.(question);
  }

  const voiceCommands = {
    clearScreen,
    lockStudentMode,
    normalizeTranscript,
    parse,
    readAnswer,
    stopTalking,
    submitQuestion
  };

  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.voice = window.Charlemagne.voice || {};
  window.Charlemagne.voice.commands = voiceCommands;
  window.Charlemagne.voiceCommands = voiceCommands;
})();
