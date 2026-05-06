(() => {
  let elements = {};
  let activeRequestController = null;
  let selectedVoice = '';
  let currentQuestion = '';
  let lastRouter = null;
  let lastInteraction = null;

  function init(options = {}) {
    elements = {
      chatForm: options.chatForm || document.getElementById('chatForm'),
      messageInput: options.messageInput || document.getElementById('messageInput'),
      sendButton: options.sendButton || document.getElementById('sendButton'),
      stopAudioButton: options.stopAudioButton || document.getElementById('stopAudioButton'),
      voiceSelect: options.voiceSelect || document.getElementById('voiceSelect'),
      voiceHint: options.voiceHint || document.getElementById('voiceHint')
    };

    if (!elements.chatForm || elements.chatForm.dataset.charlemagneBound === 'true') return;

    elements.chatForm.dataset.charlemagneBound = 'true';
    elements.chatForm.addEventListener('submit', handleSubmit);
    elements.messageInput?.addEventListener('keydown', handleInputKeydown);
    elements.stopAudioButton?.addEventListener('click', stopActiveWork);
    elements.voiceSelect?.addEventListener('change', () => {
      selectedVoice = elements.voiceSelect.value;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await submitQuestion(elements.messageInput?.value || '');
  }

  function handleInputKeydown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return;

    event.preventDefault();
    if (typeof elements.chatForm.requestSubmit === 'function') {
      elements.chatForm.requestSubmit();
    } else {
      elements.chatForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }

  async function submitQuestion(question) {
    const message = String(question || '').trim();
    if (!message) return;

    const api = window.Charlemagne?.api;
    const answer = window.Charlemagne?.ui?.answer;
    const recentQuestions = window.Charlemagne?.ui?.recentQuestions;
    const tts = window.Charlemagne?.tts;
    const voiceStatus = window.Charlemagne?.voiceStatus;
    const state = window.Charlemagne?.state;

    currentQuestion = message;
    lastRouter = null;
    answer?.startStreaming();
    if (elements.messageInput) elements.messageInput.value = '';

    tts?.stop?.({ keepStatus: true });
    voiceStatus?.setStreamStatus('Thinking...');
    voiceStatus?.setConnectionStatus('Thinking...');
    voiceStatus?.setVoiceStatus('thinking', 'Preparing response...');
    state?.set?.({ isThinking: true, lastQuestion: message });

    setFormDisabled(true);
    activeRequestController = new AbortController();

    try {
      await tts?.ensureAudioUnlocked?.();
      await api.askQuestion(message, {
        voice: selectedVoice,
        signal: activeRequestController.signal,
        onEvent: handleServerEvent
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        voiceStatus?.setStreamStatus('Stopped');
        voiceStatus?.setVoiceStatus('stopped');
      } else {
        answer?.renderError('The classroom assistant is not connected right now. Tell your teacher.');
        voiceStatus?.setStreamStatus('Voice problem');
        voiceStatus?.setConnectionStatus('Voice problem');
        voiceStatus?.setVoiceStatus('problem');
        recentQuestions?.add(currentQuestion, answer?.getAnswerText?.() || '');
        rememberLastInteraction(answer?.getAnswerText?.() || '');
      }
    } finally {
      answer?.finish();
      setFormDisabled(false);
      await refreshVoiceOptions();
      activeRequestController = null;
      state?.set?.({ isThinking: false });
    }
  }

  async function handleServerEvent(eventData) {
    const answer = window.Charlemagne?.ui?.answer;
    const recentQuestions = window.Charlemagne?.ui?.recentQuestions;
    const tts = window.Charlemagne?.tts;
    const voiceStatus = window.Charlemagne?.voiceStatus;

    switch (eventData.type) {
      case 'start':
        answer?.startStreaming();
        lastRouter = null;
        voiceStatus?.setStreamStatus('Thinking...');
        voiceStatus?.setConnectionStatus('Thinking...');
        voiceStatus?.setVoiceStatus('thinking');
        break;

      case 'router':
        lastRouter = eventData.router || null;
        break;

      case 'text_delta':
        answer?.appendText(eventData.chunk);
        break;

      case 'audio':
        tts?.enqueue?.(eventData);
        break;

      case 'audio_stream_start':
        await tts?.startStreamingSentence?.(eventData);
        break;

      case 'audio_chunk':
        tts?.pushStreamingChunk?.(eventData);
        break;

      case 'audio_stream_end':
        tts?.finishStreamingSentence?.(eventData);
        break;

      case 'audio_error':
        console.warn('Audio error:', eventData.message);
        voiceStatus?.setVoiceStatus('problem');
        voiceStatus?.setStreamStatus('Voice problem');
        tts?.setOrbSpeaking?.(false);
        break;

      case 'done': {
        const text = answer?.getAnswerText?.() || '';
        voiceStatus?.setStreamStatus('Ready');
        voiceStatus?.setConnectionStatus('Ready');
        recentQuestions?.add(currentQuestion, text);
        rememberLastInteraction(text);

        if (tts?.isIdle?.()) {
          voiceStatus?.setVoiceStatus('ready');
        }
        break;
      }

      case 'error':
        answer?.renderError(eventData.message || 'The classroom assistant is not connected right now. Tell your teacher.');
        voiceStatus?.setStreamStatus('Voice problem');
        voiceStatus?.setConnectionStatus('Voice problem');
        voiceStatus?.setVoiceStatus('problem');
        recentQuestions?.add(currentQuestion, answer?.getAnswerText?.() || '');
        rememberLastInteraction(answer?.getAnswerText?.() || '');
        break;

      default:
        break;
    }
  }

  function stopActiveWork() {
    const tts = window.Charlemagne?.tts;

    if (activeRequestController) {
      activeRequestController.abort();
    }

    tts?.stop?.();
    tts?.setOrbSpeaking?.(false);
  }

  function setFormDisabled(disabled) {
    if (elements.sendButton) elements.sendButton.disabled = disabled;
    if (elements.messageInput) elements.messageInput.disabled = disabled;
    if (elements.voiceSelect) elements.voiceSelect.disabled = disabled;
  }

  async function refreshVoiceOptions() {
    const api = window.Charlemagne?.api;
    if (!api) return;

    try {
      const data = await api.fetchVoices();
      populateVoiceSelect(data.voices || [], data.canSelectVoice, data.canStreamAudio);
    } catch {
      populateVoiceSelect([], false, false);
    }
  }

  async function checkHealth() {
    const api = window.Charlemagne?.api;
    const voiceStatus = window.Charlemagne?.voiceStatus;
    if (!api) return;

    try {
      const data = await api.fetchHealth();
      if (data.ok) {
        voiceStatus?.setConnectionStatus(data.hasVoice ? 'Ready + Voice' : 'Ready');
        populateVoiceSelect(data.voices || [], data.canSelectVoice, data.canStreamAudio);
        return;
      }
    } catch {
      // Fall through to the visible offline state.
    }

    voiceStatus?.setConnectionStatus('Voice problem');
    populateVoiceSelect([], false, false);
  }

  function populateVoiceSelect(voices, canSelectVoice, canStreamAudio) {
    if (!elements.voiceSelect) return;

    elements.voiceSelect.innerHTML = '';

    if (!voices.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = canSelectVoice ? 'Drop a Piper voice into /voices' : 'Voice is controlled by the Piper server';
      elements.voiceSelect.appendChild(option);
      elements.voiceSelect.disabled = true;
      if (elements.voiceHint) {
        elements.voiceHint.textContent = canSelectVoice
          ? 'No local voice model found yet. Add both the .onnx voice and its .onnx.json metadata file to the voices folder.'
          : 'The local Piper HTTP server decides the voice.';
      }
      selectedVoice = '';
      return;
    }

    voices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.id;
      const sampleInfo = voice.sampleRate ? ` (${voice.sampleRate} Hz)` : '';
      option.textContent = `${voice.name}${sampleInfo}`;
      elements.voiceSelect.appendChild(option);
    });

    if (selectedVoice && voices.some((voice) => voice.id === selectedVoice)) {
      elements.voiceSelect.value = selectedVoice;
    } else {
      selectedVoice = voices[0].id;
      elements.voiceSelect.value = selectedVoice;
    }

    elements.voiceSelect.disabled = !canSelectVoice;
    if (elements.voiceHint) {
      elements.voiceHint.textContent = canSelectVoice
        ? (canStreamAudio
          ? 'Pick a local Piper voice. Streaming mode needs the matching .onnx.json metadata file so the browser knows the sample rate.'
          : 'Pick a local Piper voice. File mode is enabled right now.')
        : 'Voice changes happen on the Piper server side.';
    }
  }

  function rememberLastInteraction(answer) {
    lastInteraction = {
      studentQuestion: currentQuestion,
      answerGiven: String(answer || '').trim(),
      routerType: lastRouter && lastRouter.type ? lastRouter.type : '',
      formulaChosen: lastRouter && lastRouter.formulaChosen ? lastRouter.formulaChosen : '',
      confidence: lastRouter && lastRouter.confidence ? lastRouter.confidence : '',
      debug: lastRouter ? { router: lastRouter } : {}
    };

    window.CharlemagneLastInteraction = lastInteraction;
    window.Charlemagne?.state?.set?.({ lastAnswer: lastInteraction.answerGiven });
  }

  function getLastInteraction() {
    return lastInteraction;
  }

  const questionInput = {
    checkHealth,
    getLastInteraction,
    init,
    refreshVoiceOptions,
    stopActiveWork,
    submitQuestion
  };

  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.ui = window.Charlemagne.ui || {};
  window.Charlemagne.ui.questionInput = questionInput;

  // Compatibility wrapper. Prefer window.Charlemagne.ui.questionInput.getLastInteraction().
  window.CharlemagneGetLastInteraction = getLastInteraction;
})();
