(() => {
  const elements = {
    chatForm: document.getElementById('chatForm'),
    messageInput: document.getElementById('messageInput'),
    responseText: document.getElementById('responseText'),
    sendButton: document.getElementById('sendButton'),
    stopAudioButton: document.getElementById('stopAudioButton'),
    connectionStatus: document.getElementById('connectionStatus'),
    streamStatus: document.getElementById('streamStatus'),
    voiceOrb: document.getElementById('voiceOrb'),
    voiceStatus: document.getElementById('voiceStatus'),
    voiceSelect: document.getElementById('voiceSelect'),
    voiceHint: document.getElementById('voiceHint'),
    voiceVisualizer: document.getElementById('voiceVisualizer'),
    copyButton: document.getElementById('copyAnswerButton'),
    flagAnswerButton: document.getElementById('flagAnswerButton'),
    clearButton: document.getElementById('clearButton'),
    teacherToggle: document.getElementById('teacherModeToggle'),
    historyList: document.getElementById('historyList'),
    chipButtons: document.querySelectorAll('.chip-button')
  };

  const audio = window.CharlemagneAudio;
  const teacherUi = window.CharlemagneTeacherUi;

  let activeRequestController = null;
  let selectedVoice = '';
  let currentQuestion = '';
  let lastRouter = null;
  let lastInteraction = null;

  async function boot() {
    teacherUi.init({ elements, audio });
    audio.init({
      voiceOrb: elements.voiceOrb,
      voiceVisualizer: elements.voiceVisualizer,
      setStreamStatus: teacherUi.setStreamStatus,
      setVoiceStatus: teacherUi.setVoiceStatus
    });

    bindStudentEvents();
    await checkHealth();
  }

  function bindStudentEvents() {
    elements.chatForm.addEventListener('submit', handleSubmit);

    elements.stopAudioButton.addEventListener('click', () => {
      if (activeRequestController) {
        activeRequestController.abort();
      }

      audio.stop();
      audio.setOrbSpeaking(false);
    });

    elements.voiceSelect.addEventListener('change', () => {
      selectedVoice = elements.voiceSelect.value;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const message = elements.messageInput.value.trim();
    if (!message) return;

    currentQuestion = message;
    lastRouter = null;
    teacherUi.recordQuestion(message);
    elements.messageInput.value = '';

    audio.stop({ keepStatus: true });
    elements.responseText.textContent = '';
    elements.responseText.classList.add('streaming');
    teacherUi.clearPendingAnswer();
    teacherUi.setStreamStatus('Thinking…');
    teacherUi.setConnectionStatus('Thinking');
    teacherUi.setVoiceStatus('Preparing response...');

    elements.sendButton.disabled = true;
    elements.messageInput.disabled = true;
    elements.voiceSelect.disabled = true;

    activeRequestController = new AbortController();

    try {
      await audio.ensureAudioUnlocked();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, voice: selectedVoice }),
        signal: activeRequestController.signal
      });

      if (!response.ok || !response.body) {
        throw new Error('The classroom assistant is not connected right now. Tell your teacher.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const eventData = JSON.parse(line);
          await handleServerEvent(eventData);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        teacherUi.setStreamStatus('Stopped');
        teacherUi.setVoiceStatus('Audio stopped.');
      } else {
        elements.responseText.textContent = 'The classroom assistant is not connected right now. Tell your teacher.';
        teacherUi.setStreamStatus('Voice problem');
        teacherUi.setConnectionStatus('Voice problem');
        teacherUi.setVoiceStatus('Voice problem');
      }
    } finally {
      elements.responseText.classList.remove('streaming');
      elements.sendButton.disabled = false;
      elements.messageInput.disabled = false;
      await refreshVoiceOptions();
      activeRequestController = null;
    }
  }

  async function handleServerEvent(eventData) {
    switch (eventData.type) {
      case 'start':
        elements.responseText.textContent = '';
        teacherUi.clearPendingAnswer();
        lastRouter = null;
        teacherUi.setStreamStatus('Thinking…');
        teacherUi.setConnectionStatus('Thinking…');
        teacherUi.setVoiceStatus('Thinking…');
        break;

      case 'router':
        lastRouter = eventData.router || null;
        break;

      case 'text_delta':
        elements.responseText.textContent += eventData.chunk;
        break;

      case 'audio':
        audio.enqueue(eventData);
        break;

      case 'audio_stream_start':
        await audio.startStreamingSentence(eventData);
        break;

      case 'audio_chunk':
        audio.pushStreamingChunk(eventData);
        break;

      case 'audio_stream_end':
        audio.finishStreamingSentence(eventData);
        break;

      case 'audio_error':
        console.warn('Audio error:', eventData.message);
        teacherUi.setVoiceStatus('Voice problem');
        teacherUi.setStreamStatus('Voice problem');
        audio.setOrbSpeaking(false);
        break;

      case 'done':
        teacherUi.setStreamStatus('Ready');
        teacherUi.setConnectionStatus('Ready');
        teacherUi.finishAnswer(elements.responseText.textContent);
        rememberLastInteraction(elements.responseText.textContent);

        if (audio.isIdle()) {
          teacherUi.setVoiceStatus('Ready');
        }
        break;

      case 'error':
        elements.responseText.textContent = eventData.message || 'The classroom assistant is not connected right now. Tell your teacher.';
        teacherUi.setStreamStatus('Voice problem');
        teacherUi.setConnectionStatus('Voice problem');
        teacherUi.setVoiceStatus('Voice problem');
        teacherUi.recordError(elements.responseText.textContent);
        rememberLastInteraction(elements.responseText.textContent);
        break;

      default:
        break;
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
  }

  window.CharlemagneGetLastInteraction = () => lastInteraction;

  async function checkHealth() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();

      if (data.ok) {
        teacherUi.setConnectionStatus(data.hasVoice ? 'Ready + Voice' : 'Ready');
        populateVoiceSelect(data.voices || [], data.canSelectVoice, data.canStreamAudio);
        return;
      }
    } catch {
      // Ignore and fall through.
    }

    teacherUi.setConnectionStatus('Voice problem');
    populateVoiceSelect([], false, false);
  }

  async function refreshVoiceOptions() {
    try {
      const response = await fetch('/api/voices');
      const data = await response.json();
      populateVoiceSelect(data.voices || [], data.canSelectVoice, data.canStreamAudio);
    } catch {
      populateVoiceSelect([], false, false);
    }
  }

  function populateVoiceSelect(voices, canSelectVoice, canStreamAudio) {
    elements.voiceSelect.innerHTML = '';

    if (!voices.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = canSelectVoice ? 'Drop a Piper voice into /voices' : 'Voice is controlled by the Piper server';
      elements.voiceSelect.appendChild(option);
      elements.voiceSelect.disabled = true;
      elements.voiceHint.textContent = canSelectVoice
        ? 'No local voice model found yet. Add both the .onnx voice and its .onnx.json metadata file to the voices folder.'
        : 'The local Piper HTTP server decides the voice.';
      selectedVoice = '';
      return;
    }

    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = voice.id;
      const sampleInfo = voice.sampleRate ? ` (${voice.sampleRate} Hz)` : '';
      option.textContent = `${voice.name}${sampleInfo}`;
      elements.voiceSelect.appendChild(option);
    }

    if (selectedVoice && voices.some((voice) => voice.id === selectedVoice)) {
      elements.voiceSelect.value = selectedVoice;
    } else {
      selectedVoice = voices[0].id;
      elements.voiceSelect.value = selectedVoice;
    }

    elements.voiceSelect.disabled = !canSelectVoice;
    if (canSelectVoice) {
      elements.voiceHint.textContent = canStreamAudio
        ? 'Pick a local Piper voice. Streaming mode needs the matching .onnx.json metadata file so the browser knows the sample rate.'
        : 'Pick a local Piper voice. File mode is enabled right now.';
    } else {
      elements.voiceHint.textContent = 'Voice changes happen on the Piper server side.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
