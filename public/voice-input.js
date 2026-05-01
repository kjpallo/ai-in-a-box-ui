(() => {
  const state = {
    pushToTalkActive: false,
    alwaysListeningActive: false,
    selectedMicId: localStorage.getItem('charlemagneMicDeviceId') || '',
    selectedSpeakerId: localStorage.getItem('charlemagneSpeakerDeviceId') || '',
    deviceLoadAttempted: false,
    mediaRecorder: null,
    mediaStream: null,
    audioChunks: [],
    recordingMimeType: '',
    maxRecordingTimer: null,
    transcribing: false,
    alwaysListeningRecorder: null,
    alwaysListeningStream: null,
    alwaysListeningChunks: [],
    alwaysListeningMimeType: '',
    alwaysListeningTimer: null,
    alwaysListeningBusy: false,
    alwaysListeningCooldownUntil: 0,
    pendingConfirmation: null
  };

  const MAX_RECORDING_MS = 30_000;
  const ALWAYS_LISTENING_CHUNK_MS = 4_000;
  const ALWAYS_LISTENING_MIN_BYTES = 1_500;
  const ALWAYS_LISTENING_COMMAND_COOLDOWN_MS = 1_800;
  const WAKE_WORD_PATTERN = /\b(?:hey\s+)?(?:charlemagne|charlemain|charlemaine)\b/i;

  const elements = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(message) {
    if (elements.status) elements.status.textContent = message;
  }

  function setButtonActive(button, active) {
    if (!button) return;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  function setButtonsActive(buttons, active) {
    buttons.forEach((button) => setButtonActive(button, active));
  }

  function setPushToTalk(active, options = {}) {
    state.pushToTalkActive = Boolean(active);
    setButtonsActive(elements.pushToTalkButtons, state.pushToTalkActive);
    elements.pushToTalkButtons.forEach((button) => {
      button.classList.toggle('is-recording', state.pushToTalkActive);
    });
    elements.alwaysListeningButtons.forEach((button) => {
      button.disabled = state.pushToTalkActive;
    });
    document.body.classList.toggle('voice-push-to-talk-on', state.pushToTalkActive);

    if (options.quiet) return;

    if (state.pushToTalkActive) {
      if (state.alwaysListeningActive) {
        setAlwaysListening(false, { quiet: true }).catch((error) => {
          console.warn('[Always Listening] could not stop for Push to Talk:', error);
        });
      }
      setStatus('Recording... click Push to Talk again to transcribe.');
    } else {
      setStatus('Push to Talk is ready.');
    }
  }

  async function setAlwaysListening(active, options = {}) {
    if (active === state.alwaysListeningActive && !options.force) return;

    if (active) {
      await startAlwaysListening(options);
      return;
    }

    await stopAlwaysListening(options);
  }

  async function startAlwaysListening(options = {}) {
    if (state.alwaysListeningActive) return;

    if (state.pushToTalkActive) {
      await cancelRecording('Push to Talk stopped so Always Listening can start.');
    }

    if (state.transcribing || state.alwaysListeningBusy) {
      setStatus('Already transcribing. Please wait a moment.');
      return;
    }

    if (!window.MediaRecorder) {
      setStatus('This browser does not support MediaRecorder, so Always Listening cannot record here.');
      return;
    }

    try {
      state.alwaysListeningActive = true;
      setButtonsActive(elements.alwaysListeningButtons, true);
      elements.pushToTalkButtons.forEach((button) => {
        button.disabled = true;
      });
      document.body.classList.add('voice-always-listening-on');
      setStatus('Always Listening is on. Say Charlemagne before a question.');
      console.info('[Always Listening] started');

      await startAlwaysListeningChunk();
      loadDevices();
    } catch (error) {
      console.warn('[Always Listening] could not start:', error);
      await stopAlwaysListening({ quiet: true });

      if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
        setStatus('Microphone is blocked. Allow microphone permission in the browser.');
      } else {
        setStatus('Could not access the microphone. Check browser permission and try again.');
      }
    }
  }

  async function stopAlwaysListening(options = {}) {
    state.alwaysListeningActive = false;
    state.pendingConfirmation = null;
    setButtonsActive(elements.alwaysListeningButtons, false);
    elements.alwaysListeningButtons.forEach((button) => button.classList.remove('is-paused'));
    elements.pushToTalkButtons.forEach((button) => {
      button.disabled = state.transcribing;
    });
    document.body.classList.remove('voice-always-listening-on');

    if (state.alwaysListeningTimer) {
      window.clearTimeout(state.alwaysListeningTimer);
      state.alwaysListeningTimer = null;
    }

    await cleanupAlwaysListeningRecorder();

    console.info('[Always Listening] stopped');
    if (!options.quiet) setStatus(options.message || 'Always Listening is off.');
  }

  function setTranscribing(active) {
    state.transcribing = Boolean(active);
    elements.pushToTalkButtons.forEach((button) => {
      button.disabled = state.transcribing || state.alwaysListeningActive;
      button.classList.toggle('is-transcribing', state.transcribing);
    });
    elements.alwaysListeningButtons.forEach((button) => {
      button.disabled = state.transcribing && !state.alwaysListeningActive;
    });
  }

  function optionLabel(device, fallback, index) {
    return device.label || `${fallback} ${index + 1}`;
  }

  function fillSelect(select, devices, fallbackLabel, savedId) {
    if (!select) return;

    const currentValue = savedId || select.value || '';
    select.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = fallbackLabel;
    select.appendChild(defaultOption);

    devices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = optionLabel(device, fallbackLabel.replace('Default ', ''), index);
      select.appendChild(option);
    });

    if ([...select.options].some((option) => option.value === currentValue)) {
      select.value = currentValue;
    }
  }

  async function loadDevices() {
    state.deviceLoadAttempted = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      setStatus('This browser does not support device discovery. The app will use system defaults.');
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((device) => device.kind === 'audioinput');
      const speakers = devices.filter((device) => device.kind === 'audiooutput');

      fillSelect(elements.micSelect, mics, 'Default microphone', state.selectedMicId);
      fillSelect(elements.speakerSelect, speakers, 'Default speaker', state.selectedSpeakerId);

      const micText = mics.length ? `${mics.length} mic option${mics.length === 1 ? '' : 's'} found` : 'Using default mic';
      const speakerText = speakers.length ? `${speakers.length} speaker option${speakers.length === 1 ? '' : 's'} found` : 'Using default speaker';

      setStatus(`${micText}. ${speakerText}. Push to Talk will use local Whisper when configured.`);
    } catch (error) {
      console.warn('Device discovery failed:', error);
      setStatus('Could not list devices yet. This may need HTTPS or browser permission later.');
    }
  }

  function isTtsSpeaking() {
    const orb = byId('voiceOrb');
    return document.body.classList.contains('tts-speaking')
      || Boolean(orb && orb.classList.contains('speaking'));
  }

  function chooseRecordingMimeType() {
    if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== 'function') return '';

    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];

    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  async function requestMicStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('This browser does not support microphone recording.');
    }

    const selectedMicId = elements.micSelect?.value || state.selectedMicId || '';
    const defaultAudioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };

    if (!selectedMicId) {
      return navigator.mediaDevices.getUserMedia({ audio: defaultAudioConstraints });
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          ...defaultAudioConstraints,
          deviceId: { exact: selectedMicId }
        }
      });
    } catch (error) {
      console.warn('Selected microphone was unavailable. Falling back to default microphone.', error);
      return navigator.mediaDevices.getUserMedia({ audio: defaultAudioConstraints });
    }
  }

  async function startRecording() {
    if (state.transcribing || state.alwaysListeningBusy) {
      setStatus('Already transcribing. Please wait a moment.');
      return;
    }

    if (isTtsSpeaking()) {
      setStatus('Wait until Charlemagne stops speaking.');
      return;
    }

    if (!window.MediaRecorder) {
      setStatus('This browser does not support MediaRecorder, so Push to Talk cannot record here.');
      return;
    }

    try {
      if (state.alwaysListeningActive) setAlwaysListening(false, { quiet: true });

      const stream = await requestMicStream();
      const mimeType = chooseRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      state.mediaStream = stream;
      state.mediaRecorder = recorder;
      state.recordingMimeType = recorder.mimeType || mimeType || 'application/octet-stream';
      state.audioChunks = [];

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) state.audioChunks.push(event.data);
      });

      recorder.addEventListener('error', (event) => {
        console.warn('MediaRecorder error:', event.error || event);
        cancelRecording('Recording stopped because the microphone had an issue.');
      });

      recorder.start(1000);
      setPushToTalk(true);

      state.maxRecordingTimer = window.setTimeout(() => {
        if (state.pushToTalkActive) {
          stopRecordingAndTranscribe('Recording stopped at 30 seconds. Transcribing...');
        }
      }, MAX_RECORDING_MS);

      loadDevices();
    } catch (error) {
      console.warn('Could not start microphone recording:', error);
      cleanupRecording();
      setPushToTalk(false, { quiet: true });
      setStatus('Could not access the microphone. Check browser permission and try again.');
    }
  }

  async function stopRecordingAndTranscribe(statusMessage = 'Transcribing...') {
    if (state.transcribing) return;

    const recorder = state.mediaRecorder;
    if (!recorder) {
      cleanupRecording();
      setPushToTalk(false, { quiet: true });
      return;
    }

    setStatus(statusMessage);

    try {
      const blob = await stopRecorder();
      cleanupRecording();
      setPushToTalk(false, { quiet: true });

      if (!blob || blob.size === 0) {
        setStatus('No audio was captured. Try Push to Talk again.');
        return;
      }

      await transcribeBlob(blob);
    } catch (error) {
      console.warn('Could not stop/transcribe recording:', error);
      cleanupRecording();
      setPushToTalk(false, { quiet: true });
      setStatus('Could not transcribe that recording. Check Whisper setup and try again.');
    }
  }

  function stopRecorder() {
    return new Promise((resolve) => {
      const recorder = state.mediaRecorder;
      const mimeType = state.recordingMimeType || 'application/octet-stream';

      if (!recorder || recorder.state === 'inactive') {
        resolve(new Blob(state.audioChunks, { type: mimeType }));
        return;
      }

      recorder.addEventListener('stop', () => {
        resolve(new Blob(state.audioChunks, { type: mimeType }));
      }, { once: true });

      recorder.stop();
    });
  }

  async function cancelRecording(message) {
    const recorder = state.mediaRecorder;
    try {
      if (recorder && recorder.state !== 'inactive') await stopRecorder();
    } catch (error) {
      console.warn('Recording cancel failed:', error);
    }

    cleanupRecording();
    setPushToTalk(false, { quiet: true });
    setStatus(message);
  }

  function cleanupRecording() {
    if (state.maxRecordingTimer) {
      window.clearTimeout(state.maxRecordingTimer);
      state.maxRecordingTimer = null;
    }

    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach((track) => track.stop());
    }

    state.mediaRecorder = null;
    state.mediaStream = null;
    state.audioChunks = [];
    state.recordingMimeType = '';
  }

  async function startAlwaysListeningChunk() {
    if (!state.alwaysListeningActive || state.alwaysListeningBusy || state.alwaysListeningRecorder) return;

    const stream = await requestMicStream();
    const mimeType = chooseRecordingMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    state.alwaysListeningStream = stream;
    state.alwaysListeningRecorder = recorder;
    state.alwaysListeningMimeType = recorder.mimeType || mimeType || 'application/octet-stream';
    state.alwaysListeningChunks = [];

    console.info('[Always Listening] selected mime type:', state.alwaysListeningMimeType);

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) state.alwaysListeningChunks.push(event.data);
    });

    recorder.addEventListener('error', (event) => {
      console.warn('[Always Listening] MediaRecorder error:', event.error || event);
      stopAlwaysListening({ message: 'Recording stopped because the microphone had an issue.' });
    });

    recorder.start(1000);
    state.alwaysListeningTimer = window.setTimeout(() => {
      finishAlwaysListeningChunk();
    }, ALWAYS_LISTENING_CHUNK_MS);
  }

  async function finishAlwaysListeningChunk() {
    if (!state.alwaysListeningActive || state.alwaysListeningBusy) return;

    state.alwaysListeningBusy = true;

    try {
      const blob = await stopAlwaysListeningRecorder();
      console.info('[Always Listening] blob size/type:', blob ? blob.size : 0, blob ? blob.type : '');

      if (!state.alwaysListeningActive) return;

      if (!blob || blob.size < ALWAYS_LISTENING_MIN_BYTES) {
        console.info('[Always Listening] ignored transcript reason: empty or too small audio chunk');
        setStatus('No voice was recorded. Check microphone input.');
        return;
      }

      if (Date.now() < state.alwaysListeningCooldownUntil) {
        console.info('[Always Listening] ignored transcript reason: command cooldown active');
        return;
      }

      await transcribeAlwaysListeningBlob(blob);
    } catch (error) {
      console.warn('[Always Listening] chunk failed:', error);
      if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
        setStatus('Microphone is blocked. Allow microphone permission in the browser.');
      }
    } finally {
      state.alwaysListeningBusy = false;
      await cleanupAlwaysListeningRecorder();

      if (state.alwaysListeningActive) {
        window.setTimeout(() => {
          startAlwaysListeningChunk().catch((error) => {
            console.warn('[Always Listening] restart failed:', error);
            stopAlwaysListening({ message: 'Microphone is blocked. Allow microphone permission in the browser.' });
          });
        }, 150);
      }
    }
  }

  function stopAlwaysListeningRecorder() {
    return new Promise((resolve) => {
      const recorder = state.alwaysListeningRecorder;
      const mimeType = state.alwaysListeningMimeType || 'application/octet-stream';

      if (!recorder || recorder.state === 'inactive') {
        resolve(new Blob(state.alwaysListeningChunks, { type: mimeType }));
        return;
      }

      recorder.addEventListener('stop', () => {
        resolve(new Blob(state.alwaysListeningChunks, { type: mimeType }));
      }, { once: true });

      recorder.stop();
    });
  }

  async function cleanupAlwaysListeningRecorder() {
    if (state.alwaysListeningTimer) {
      window.clearTimeout(state.alwaysListeningTimer);
      state.alwaysListeningTimer = null;
    }

    const recorder = state.alwaysListeningRecorder;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (error) {
        console.warn('[Always Listening] recorder cleanup failed:', error);
      }
    }

    if (state.alwaysListeningStream) {
      state.alwaysListeningStream.getTracks().forEach((track) => track.stop());
    }

    state.alwaysListeningRecorder = null;
    state.alwaysListeningStream = null;
    state.alwaysListeningChunks = [];
    state.alwaysListeningMimeType = '';
  }

  async function transcribeAlwaysListeningBlob(blob) {
    console.info('[Always Listening] sending chunk to Whisper');

    const response = await fetch('/api/whisper/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': blob.type || 'application/octet-stream'
      },
      body: blob
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Whisper transcription failed.');
    }

    const rawTranscript = String(data.text || '').trim();
    const normalizedTranscript = normalizeTranscript(rawTranscript);
    console.info('[Always Listening] raw transcript:', rawTranscript);
    console.info('[Always Listening] normalized transcript:', normalizedTranscript);

    if (!normalizedTranscript) {
      console.info('[Always Listening] ignored transcript reason: empty transcript');
      return;
    }

    const wakeResult = extractWakeCommand(rawTranscript);
    console.info('[Always Listening] detected wake word:', wakeResult.detected ? wakeResult.wakeWord : 'none');

    if (!wakeResult.detected) {
      console.info('[Always Listening] ignored transcript reason: wake word missing near beginning');
      return;
    }

    await handleAlwaysListeningCommand(wakeResult.payload);
  }

  function normalizeTranscript(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractWakeCommand(text) {
    const raw = String(text || '').trim();
    const normalized = normalizeTranscript(raw);
    const match = normalized.match(WAKE_WORD_PATTERN);

    if (!match || match.index > 24) {
      return { detected: false, wakeWord: '', payload: '' };
    }

    const payload = normalized.slice(match.index + match[0].length).trim();
    return { detected: true, wakeWord: match[0], payload };
  }

  async function handleAlwaysListeningCommand(payload) {
    const commandText = normalizeTranscript(payload);

    if (!commandText) {
      console.info('[Always Listening] ignored transcript reason: wake word heard without command');
      setStatus('Heard Charlemagne. Say a question after the wake word.');
      return;
    }

    const command = parseAlwaysListeningCommand(commandText);
    console.info('[Always Listening] command/payload:', command.type, command.payload || '');

    if (command.type === 'stop_listening') {
      await stopAlwaysListening({ message: 'Listening stopped.' });
      return;
    }

    state.alwaysListeningCooldownUntil = Date.now() + ALWAYS_LISTENING_COMMAND_COOLDOWN_MS;

    if (command.type === 'cancel') {
      state.pendingConfirmation = null;
      setStatus('Confirmation canceled.');
      return;
    }

    if (command.type === 'confirm') {
      if (!state.pendingConfirmation) {
        setStatus('Nothing is waiting for confirmation.');
        return;
      }

      const pending = state.pendingConfirmation;
      state.pendingConfirmation = null;
      await pending.run();
      return;
    }

    if (command.requiresConfirmation) {
      state.pendingConfirmation = command;
      setStatus('Please say Charlemagne confirm or Charlemagne cancel.');
      return;
    }

    if (command.type === 'stop_talking') {
      stopCurrentSpeech();
      setStatus('Stopped talking.');
      return;
    }

    if (command.type === 'clear_screen') {
      clearScreenFromVoice();
      return;
    }

    if (command.payload) {
      setStatus('Heard Charlemagne. Sending question...');
      submitTeacherQuestion(command.payload);
    }
  }

  function parseAlwaysListeningCommand(text) {
    if (/^stop listening\b/.test(text)) return { type: 'stop_listening' };
    if (/^stop talking\b/.test(text)) return { type: 'stop_talking' };
    if (/^clear screen\b/.test(text)) return { type: 'clear_screen' };
    if (/^cancel\b/.test(text)) return { type: 'cancel' };
    if (/^confirm\b/.test(text)) return { type: 'confirm' };

    const askMatch = text.match(/^ask\s+(.+)/);
    if (askMatch) return { type: 'ask', payload: askMatch[1].trim() };

    const calculateMatch = text.match(/^calculate\s+(.+)/);
    if (calculateMatch) return { type: 'calculate', payload: `Calculate: ${calculateMatch[1].trim()}` };

    const defineMatch = text.match(/^define\s+(.+)/);
    if (defineMatch) return { type: 'define', payload: `Define: ${defineMatch[1].trim()}` };

    const formulaMatch = text.match(/^show formula for\s+(.+)/);
    if (formulaMatch) return { type: 'show_formula', payload: `Show formula for ${formulaMatch[1].trim()}` };

    return { type: 'question', payload: text };
  }

  function stopCurrentSpeech() {
    const audio = window.CharlemagneAudio;
    if (audio && typeof audio.stop === 'function') audio.stop();
    if (audio && typeof audio.setOrbSpeaking === 'function') audio.setOrbSpeaking(false);
  }

  function clearScreenFromVoice() {
    const clearButton = byId('clearButton');
    if (clearButton) {
      clearButton.click();
      setStatus('Screen cleared.');
      return;
    }

    setStatus('I heard clear screen, but this view does not have a clear button.');
  }

  function submitTeacherQuestion(question) {
    const input = byId('messageInput');
    const form = byId('chatForm');
    const cleanQuestion = String(question || '').trim();

    if (!input || !form || !cleanQuestion) {
      setStatus('I heard the wake word, but there is no question to send.');
      return;
    }

    input.value = cleanQuestion;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }

  async function transcribeBlob(blob) {
    setTranscribing(true);
    setStatus('Transcribing with local Whisper...');

    try {
      const response = await fetch('/api/whisper/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': blob.type || 'application/octet-stream'
        },
        body: blob
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Whisper transcription failed.');
      }

      const text = String(data.text || '').trim();
      if (!text) {
        setStatus('Whisper did not detect speech in that recording.');
        return;
      }

      insertTranscript(text);
      setStatus('Transcription added to the text box. Press Send when ready.');
    } catch (error) {
      console.warn('Whisper transcription request failed:', error);
      setStatus('Whisper could not transcribe that recording yet. Check local setup and try again.');
    } finally {
      setTranscribing(false);
    }
  }

  function insertTranscript(text) {
    const input = byId('messageInput');
    if (!input) return;

    const existing = input.value || '';
    const separator = existing.trim() ? (existing.endsWith('\n') ? '' : '\n') : '';
    input.value = `${existing}${separator}${text}`;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    input.selectionStart = input.value.length;
    input.selectionEnd = input.value.length;
  }

  function patchAudioOutputSink() {
    if (window.__charlemagneVoiceSinkPatchInstalled) return;
    window.__charlemagneVoiceSinkPatchInstalled = true;

    window.CharlemagneVoiceOutput = window.CharlemagneVoiceOutput || {};
    window.CharlemagneVoiceOutput.getSelectedSinkId = () => state.selectedSpeakerId;

    if (!window.HTMLMediaElement || !HTMLMediaElement.prototype.play) return;

    const originalPlay = HTMLMediaElement.prototype.play;

    HTMLMediaElement.prototype.play = function patchedPlay(...args) {
      const sinkId = state.selectedSpeakerId;

      if (sinkId && typeof this.setSinkId === 'function') {
        this.setSinkId(sinkId).catch((error) => {
          console.warn('Could not set speaker output. Falling back to default speaker.', error);
        });
      }

      return originalPlay.apply(this, args);
    };
  }

  function watchTtsSpeaking() {
    const updateFromOrb = () => {
      const orb = byId('voiceOrb');
      const speaking = Boolean(orb && orb.classList.contains('speaking'));
      document.body.classList.toggle('tts-speaking', speaking);

      if (speaking && state.alwaysListeningActive) {
        elements.alwaysListeningButtons.forEach((button) => button.classList.remove('is-paused'));
        setStatus('Always Listening is on. Say Charlemagne before a question.');
      } else {
        elements.alwaysListeningButtons.forEach((button) => button.classList.remove('is-paused'));
      }

      if (speaking && state.pushToTalkActive) {
        cancelRecording('Recording stopped because Charlemagne started speaking.');
      }
    };

    const orb = byId('voiceOrb');
    if (orb && window.MutationObserver) {
      const observer = new MutationObserver(updateFromOrb);
      observer.observe(orb, { attributes: true, attributeFilter: ['class'] });
      updateFromOrb();
    }

    window.addEventListener('charlemagne:tts-speaking', (event) => {
      const speaking = Boolean(event.detail && event.detail.speaking);
      document.body.classList.toggle('tts-speaking', speaking);

      if (speaking && state.alwaysListeningActive) {
        elements.alwaysListeningButtons.forEach((button) => button.classList.remove('is-paused'));
        setStatus('Always Listening is on. Say Charlemagne before a question.');
      } else {
        elements.alwaysListeningButtons.forEach((button) => button.classList.remove('is-paused'));
      }

      if (speaking && state.pushToTalkActive) {
        cancelRecording('Recording stopped because Charlemagne started speaking.');
      }
    });
  }

  function init() {
    elements.panel = byId('voiceInputPanel');
    elements.pushToTalk = byId('pushToTalkButton');
    elements.alwaysListening = byId('alwaysListeningButton');
    elements.pushToTalkButtons = [...document.querySelectorAll('#pushToTalkButton')];
    elements.alwaysListeningButtons = [...document.querySelectorAll('#alwaysListeningButton')];
    elements.micSelect = byId('micDeviceSelect');
    elements.speakerSelect = byId('speakerDeviceSelect');
    elements.status = byId('voiceInputStatus');

    if (!elements.panel) return;

    elements.pushToTalkButtons.forEach((button) => button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (state.pushToTalkActive) {
        stopRecordingAndTranscribe();
      } else {
        startRecording();
      }
    }));

    elements.alwaysListeningButtons.forEach((button) => button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      setAlwaysListening(!state.alwaysListeningActive).catch((error) => {
        console.warn('[Always Listening] toggle failed:', error);
        setStatus('Could not access the microphone. Check browser permission and try again.');
      });
    }));

    elements.micSelect?.addEventListener('change', () => {
      state.selectedMicId = elements.micSelect.value;
      localStorage.setItem('charlemagneMicDeviceId', state.selectedMicId);
      setStatus('Mic choice saved. Push to Talk will use it when possible.');
    });

    elements.speakerSelect?.addEventListener('change', () => {
      state.selectedSpeakerId = elements.speakerSelect.value;
      localStorage.setItem('charlemagneSpeakerDeviceId', state.selectedSpeakerId);
      setStatus(state.selectedSpeakerId
        ? 'Speaker choice saved. Piper audio will try to use it when the browser supports speaker routing.'
        : 'Speaker reset to system default.');
    });

    patchAudioOutputSink();
    watchTtsSpeaking();
    loadDevices();

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
