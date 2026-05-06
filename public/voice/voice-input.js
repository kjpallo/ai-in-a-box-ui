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
    alwaysListeningAudioContext: null,
    alwaysListeningAnalyser: null,
    alwaysListeningVolumeData: null,
    alwaysListeningMonitorId: null,
    alwaysListeningMonitorTimer: null,
    alwaysListeningState: 'off',
    alwaysListeningStartedAt: 0,
    alwaysListeningRecordingStartedAt: 0,
    alwaysListeningLastVoiceAt: 0,
    alwaysListeningSpeechFrames: 0,
    alwaysListeningRms: 0,
    alwaysListeningPeakRms: 0,
    alwaysListeningTranscriptStartedAt: 0,
    alwaysListeningRecordingMeta: null,
    pendingConfirmation: null
  };

  const MAX_RECORDING_MS = 30_000;
  const ALWAYS_LISTENING_SPEECH_THRESHOLD = 0.026;
  const ALWAYS_LISTENING_SILENCE_THRESHOLD = 0.014;
  const ALWAYS_LISTENING_SPEECH_FRAMES_TO_START = 2;
  const ALWAYS_LISTENING_SILENCE_MS = 1_100;
  const ALWAYS_LISTENING_MAX_RECORDING_MS = 6_000;
  const ALWAYS_LISTENING_MIN_RECORDING_MS = 400;
  const ALWAYS_LISTENING_MIN_BYTES = 1_500;
  const ALWAYS_LISTENING_COMMAND_COOLDOWN_MS = 1_800;
  const WAKE_MAX_PREFIX_WORDS = 3;
  const WAKE_MAX_INDEX = 32;
  const DANGEROUS_COMMAND_PATTERN = /^(?:shutdown|clear logs|reload teacher facts|unlock student mode)\b/;
  const WAKE_NAME_VARIANTS = [
    'hey charlemagne',
    'okay charlemagne',
    'ok charlemagne',
    'charlemagne',
    'charlimain',
    'charlemain',
    'charlemaine'
  ];
  const COMMAND_STATE_LABELS = {
    off: 'Command Listening: Off',
    mic_ready: 'Command Listening: Listening...',
    listening_for_speech: 'Command Listening: Listening...',
    recording: 'Command Listening: Recording...',
    waiting_for_silence: 'Command Listening: Recording...',
    transcribing: 'Command Listening: Thinking...',
    wake_word_detected: 'Command Listening: Heard Charlemagne',
    command_detected: 'Command Listening: Heard command',
    sending_question: 'Command Listening: Sending question...',
    ignored: 'Command Listening: Ignored',
    error: 'Command Listening: Error - check microphone'
  };

  const elements = {};
  let initialized = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(message) {
    if (elements.status) elements.status.textContent = message;
  }

  function setCommandState(nextState, detail = '') {
    state.alwaysListeningState = nextState;
    const baseLabel = COMMAND_STATE_LABELS[nextState] || 'Command Listening: Listening...';
    setStatus(detail ? `${baseLabel} - ${detail}` : baseLabel);
    document.body.dataset.commandListeningState = nextState;
  }

  function setIgnoredStatus(reason) {
    setCommandState('ignored', reason);
  }

  function recordCommandLog(entry = {}) {
    if (!elements.commandLog) return;

    const transcript = String(entry.transcript || '').trim();
    const decision = String(entry.decision || '').trim() || 'listening';
    const reason = String(entry.reason || '').trim();
    const recordingMs = Number(entry.recordingMs || 0);
    const whisperMs = Number(entry.whisperMs || 0);
    const level = Number(entry.level || 0);

    elements.commandLog.hidden = false;
    elements.commandLog.innerHTML = `
      <div class="command-log-row">
        <span>Last heard</span>
        <strong>${escapeHtml(transcript || 'Nothing yet')}</strong>
      </div>
      <div class="command-log-row">
        <span>Decision</span>
        <strong>${escapeHtml(reason ? `${decision} - ${reason}` : decision)}</strong>
      </div>
      <div class="command-log-meta">
        ${recordingMs ? `<span>${Math.round(recordingMs)} ms recording</span>` : ''}
        ${whisperMs ? `<span>${Math.round(whisperMs)} ms Whisper</span>` : ''}
        ${level ? `<span>level ${level.toFixed(3)}</span>` : ''}
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
    window.Charlemagne?.state?.set?.({ isRecording: state.pushToTalkActive });
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
      window.Charlemagne?.state?.set?.({ isListening: true });
      state.alwaysListeningStartedAt = Date.now();
      state.alwaysListeningCooldownUntil = 0;
      setButtonsActive(elements.alwaysListeningButtons, true);
      elements.pushToTalkButtons.forEach((button) => {
        button.disabled = true;
      });
      document.body.classList.add('voice-always-listening-on');
      setCommandState('mic_ready');
      recordCommandLog({ decision: 'listening', reason: 'waiting for speech' });
      console.info('[Always Listening] started');

      await startAlwaysListeningMonitor();
      loadDevices();
    } catch (error) {
      console.warn('[Always Listening] could not start:', error);
      await stopAlwaysListening({ quiet: true });

      if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
        setCommandState('error', 'microphone blocked');
      } else {
        setCommandState('error', 'check microphone');
      }
    }
  }

  async function stopAlwaysListening(options = {}) {
    state.alwaysListeningActive = false;
    window.Charlemagne?.state?.set?.({ isListening: false });
    state.pendingConfirmation = null;
    state.alwaysListeningSpeechFrames = 0;
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
    await cleanupAlwaysListeningMonitor();

    console.info('[Always Listening] stopped');
    if (!options.quiet) setCommandState('off', options.message || '');
    else setCommandState('off');
  }

  function setTranscribing(active) {
    state.transcribing = Boolean(active);
    window.Charlemagne?.state?.set?.({ isThinking: state.transcribing });
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

      if (state.pushToTalkActive) {
        setStatus(`${micText}. ${speakerText}. Recording...`);
      } else if (state.alwaysListeningActive) {
        setStatus(`${COMMAND_STATE_LABELS[state.alwaysListeningState] || 'Command Listening: Listening...'}. ${micText}. ${speakerText}.`);
      } else {
        setStatus(`Command Listening: Off. ${micText}. ${speakerText}.`);
      }
    } catch (error) {
      console.warn('Device discovery failed:', error);
      setStatus('Could not list devices yet. This may need HTTPS or browser permission later.');
    }
  }

  function isTtsSpeaking() {
    const appState = window.Charlemagne?.state?.get?.();
    if (appState?.isSpeaking) return true;

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

  async function startAlwaysListeningMonitor() {
    if (!state.alwaysListeningActive || state.alwaysListeningStream) return;

    const stream = await requestMicStream();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    state.alwaysListeningStream = stream;

    if (AudioContextClass) {
      const audioContext = new AudioContextClass();
      if (audioContext.state === 'suspended') {
        await audioContext.resume().catch(() => {});
      }
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.18;
      source.connect(analyser);

      state.alwaysListeningAudioContext = audioContext;
      state.alwaysListeningAnalyser = analyser;
      state.alwaysListeningVolumeData = new Uint8Array(analyser.fftSize);
    }

    setCommandState('listening_for_speech');
    scheduleAlwaysListeningMonitor();
  }

  function scheduleAlwaysListeningMonitor() {
    if (!state.alwaysListeningActive) return;

    if (window.requestAnimationFrame && state.alwaysListeningAnalyser) {
      state.alwaysListeningMonitorId = window.requestAnimationFrame(monitorAlwaysListeningVolume);
      return;
    }

    state.alwaysListeningMonitorTimer = window.setTimeout(monitorAlwaysListeningVolume, 80);
  }

  function monitorAlwaysListeningVolume() {
    state.alwaysListeningMonitorId = null;
    state.alwaysListeningMonitorTimer = null;

    if (!state.alwaysListeningActive) return;

    const now = Date.now();
    const rms = readAlwaysListeningRms();
    state.alwaysListeningRms = rms;

    if (isTtsSpeaking()) {
      state.alwaysListeningSpeechFrames = 0;
      if (!state.alwaysListeningRecorder && !state.alwaysListeningBusy) {
        setCommandState('mic_ready', 'waiting while Charlemagne speaks');
      }
      scheduleAlwaysListeningMonitor();
      return;
    }

    if (state.alwaysListeningBusy || now < state.alwaysListeningCooldownUntil) {
      scheduleAlwaysListeningMonitor();
      return;
    }

    if (!state.alwaysListeningRecorder) {
      if (rms >= ALWAYS_LISTENING_SPEECH_THRESHOLD) {
        state.alwaysListeningSpeechFrames += 1;
      } else {
        state.alwaysListeningSpeechFrames = 0;
      }

      if (state.alwaysListeningSpeechFrames >= ALWAYS_LISTENING_SPEECH_FRAMES_TO_START) {
        startAlwaysListeningRecording().catch((error) => {
          console.warn('[Always Listening] recording start failed:', error);
          setCommandState('error', 'check microphone');
          recordCommandLog({ decision: 'error', reason: 'recording could not start' });
        });
      } else if (state.alwaysListeningState !== 'listening_for_speech') {
        setCommandState('listening_for_speech');
      }

      scheduleAlwaysListeningMonitor();
      return;
    }

    if (rms > state.alwaysListeningPeakRms) state.alwaysListeningPeakRms = rms;

    if (rms >= ALWAYS_LISTENING_SILENCE_THRESHOLD) {
      state.alwaysListeningLastVoiceAt = now;
      if (state.alwaysListeningState !== 'recording') setCommandState('recording');
    } else if (now - state.alwaysListeningLastVoiceAt >= ALWAYS_LISTENING_SILENCE_MS) {
      setCommandState('waiting_for_silence');
      finishAlwaysListeningRecording('silence').catch((error) => {
        console.warn('[Always Listening] recording finish failed:', error);
        setCommandState('error', 'check microphone');
      });
      return;
    }

    if (now - state.alwaysListeningRecordingStartedAt >= ALWAYS_LISTENING_MAX_RECORDING_MS) {
      finishAlwaysListeningRecording('max_length').catch((error) => {
        console.warn('[Always Listening] max-length finish failed:', error);
        setCommandState('error', 'check microphone');
      });
      return;
    }

    scheduleAlwaysListeningMonitor();
  }

  function readAlwaysListeningRms() {
    const analyser = state.alwaysListeningAnalyser;
    const data = state.alwaysListeningVolumeData;
    if (!analyser || !data) return 0;

    analyser.getByteTimeDomainData(data);

    let sum = 0;
    for (let index = 0; index < data.length; index += 1) {
      const centered = (data[index] - 128) / 128;
      sum += centered * centered;
    }

    return Math.sqrt(sum / data.length);
  }

  async function startAlwaysListeningRecording() {
    if (!state.alwaysListeningActive || state.alwaysListeningRecorder || state.alwaysListeningBusy) return;
    if (!state.alwaysListeningStream) await startAlwaysListeningMonitor();
    if (!state.alwaysListeningStream) return;

    const mimeType = chooseRecordingMimeType();
    const recorder = mimeType
      ? new MediaRecorder(state.alwaysListeningStream, { mimeType })
      : new MediaRecorder(state.alwaysListeningStream);

    state.alwaysListeningRecorder = recorder;
    state.alwaysListeningMimeType = recorder.mimeType || mimeType || 'application/octet-stream';
    state.alwaysListeningChunks = [];
    state.alwaysListeningRecordingStartedAt = Date.now();
    state.alwaysListeningLastVoiceAt = state.alwaysListeningRecordingStartedAt;
    state.alwaysListeningPeakRms = state.alwaysListeningRms;
    state.alwaysListeningRecordingMeta = null;

    console.info('[Always Listening] selected mime type:', state.alwaysListeningMimeType);

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) state.alwaysListeningChunks.push(event.data);
    });

    recorder.addEventListener('error', (event) => {
      console.warn('[Always Listening] MediaRecorder error:', event.error || event);
      setCommandState('error', 'microphone issue');
      stopAlwaysListening({ message: 'Recording stopped because the microphone had an issue.' });
    });

    recorder.start(250);
    setCommandState('recording');
  }

  async function finishAlwaysListeningRecording(reason) {
    if (!state.alwaysListeningRecorder || state.alwaysListeningBusy) return;

    state.alwaysListeningBusy = true;

    const recordingMs = Date.now() - state.alwaysListeningRecordingStartedAt;
    const peakRms = state.alwaysListeningPeakRms;

    try {
      const blob = await stopAlwaysListeningRecorder();
      state.alwaysListeningRecordingMeta = { recordingMs, peakRms, stopReason: reason };
      state.alwaysListeningCooldownUntil = Date.now() + ALWAYS_LISTENING_COMMAND_COOLDOWN_MS;
      console.info('[Always Listening] blob size/type:', blob ? blob.size : 0, blob ? blob.type : '');

      if (!state.alwaysListeningActive) return;

      if (recordingMs < ALWAYS_LISTENING_MIN_RECORDING_MS) {
        console.info('[Always Listening] ignored transcript reason: transcript too short');
        setIgnoredStatus('transcript too short');
        recordCommandLog({
          decision: 'ignored',
          reason: 'transcript too short',
          recordingMs,
          level: peakRms
        });
        return;
      }

      if (peakRms < ALWAYS_LISTENING_SPEECH_THRESHOLD) {
        console.info('[Always Listening] ignored transcript reason: recording too quiet');
        setIgnoredStatus('recording too quiet');
        recordCommandLog({
          decision: 'ignored',
          reason: 'recording too quiet',
          recordingMs,
          level: peakRms
        });
        return;
      }

      if (!blob || blob.size < ALWAYS_LISTENING_MIN_BYTES) {
        console.info('[Always Listening] ignored transcript reason: transcript too short');
        setIgnoredStatus('transcript too short');
        recordCommandLog({
          decision: 'ignored',
          reason: 'transcript too short',
          recordingMs,
          level: peakRms
        });
        return;
      }

      await transcribeAlwaysListeningBlob(blob, state.alwaysListeningRecordingMeta);
    } catch (error) {
      console.warn('[Always Listening] recording failed:', error);
      if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
        setCommandState('error', 'microphone blocked');
      } else {
        setCommandState('error', 'check microphone');
      }
      recordCommandLog({ decision: 'error', reason: 'microphone or Whisper issue', recordingMs, level: peakRms });
    } finally {
      state.alwaysListeningBusy = false;
      await cleanupAlwaysListeningRecorder();

      if (state.alwaysListeningActive) {
        state.alwaysListeningSpeechFrames = 0;
        window.setTimeout(() => {
          if (state.alwaysListeningActive && !state.alwaysListeningBusy) {
            setCommandState('listening_for_speech');
            scheduleAlwaysListeningMonitor();
          }
        }, Math.max(150, state.alwaysListeningCooldownUntil - Date.now()));
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

    state.alwaysListeningRecorder = null;
    state.alwaysListeningChunks = [];
    state.alwaysListeningMimeType = '';
    state.alwaysListeningRecordingStartedAt = 0;
    state.alwaysListeningLastVoiceAt = 0;
    state.alwaysListeningPeakRms = 0;
  }

  async function cleanupAlwaysListeningMonitor() {
    if (state.alwaysListeningMonitorId && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(state.alwaysListeningMonitorId);
    }

    if (state.alwaysListeningMonitorTimer) {
      window.clearTimeout(state.alwaysListeningMonitorTimer);
    }

    if (state.alwaysListeningStream) {
      state.alwaysListeningStream.getTracks().forEach((track) => track.stop());
    }

    if (state.alwaysListeningAudioContext) {
      await state.alwaysListeningAudioContext.close().catch(() => {});
    }

    state.alwaysListeningMonitorId = null;
    state.alwaysListeningMonitorTimer = null;
    state.alwaysListeningStream = null;
    state.alwaysListeningAudioContext = null;
    state.alwaysListeningAnalyser = null;
    state.alwaysListeningVolumeData = null;
  }

  async function transcribeAlwaysListeningBlob(blob, meta = {}) {
    console.info('[Always Listening] sending chunk to Whisper');
    setCommandState('transcribing');
    state.alwaysListeningTranscriptStartedAt = performance.now();

    const data = await window.Charlemagne.api.sendVoiceTranscript(blob);
    if (!data.ok) {
      throw new Error(data.error || 'Whisper transcription failed.');
    }

    const whisperMs = performance.now() - state.alwaysListeningTranscriptStartedAt;
    const rawTranscript = String(data.text || '').trim();
    const normalizedTranscript = normalizeTranscript(rawTranscript);
    console.info('[Always Listening] raw transcript:', rawTranscript);
    console.info('[Always Listening] normalized transcript:', normalizedTranscript);

    if (!normalizedTranscript) {
      console.info('[Always Listening] ignored transcript reason: empty transcript');
      setIgnoredStatus('transcript too short');
      recordCommandLog({
        transcript: rawTranscript,
        decision: 'ignored',
        reason: 'transcript too short',
        recordingMs: meta.recordingMs,
        whisperMs,
        level: meta.peakRms
      });
      return;
    }

    const wakeResult = extractWakeCommand(rawTranscript);
    console.info('[Always Listening] detected wake word:', wakeResult.detected ? wakeResult.wakeWord : 'none');

    if (!wakeResult.detected) {
      console.info('[Always Listening] ignored transcript reason:', wakeResult.reason || 'wake name missing');
      setIgnoredStatus(wakeResult.reason || 'wake name missing');
      recordCommandLog({
        transcript: rawTranscript,
        decision: 'ignored',
        reason: wakeResult.reason || 'wake name missing',
        recordingMs: meta.recordingMs,
        whisperMs,
        level: meta.peakRms
      });
      return;
    }

    setCommandState('wake_word_detected');
    recordCommandLog({
      transcript: rawTranscript,
      decision: 'wake name heard',
      recordingMs: meta.recordingMs,
      whisperMs,
      level: meta.peakRms
    });
    await handleAlwaysListeningCommand(wakeResult.payload, {
      transcript: rawTranscript,
      recordingMs: meta.recordingMs,
      whisperMs,
      level: meta.peakRms
    });
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
    if (!normalized) return { detected: false, wakeWord: '', payload: '', reason: 'transcript too short' };

    const words = normalized.split(' ').filter(Boolean);
    let bestMatch = null;

    for (const variant of WAKE_NAME_VARIANTS) {
      const variantWords = variant.split(' ');

      for (let index = 0; index <= Math.min(WAKE_MAX_PREFIX_WORDS, words.length - variantWords.length); index += 1) {
        const slice = words.slice(index, index + variantWords.length).join(' ');
        if (slice === variant) {
          bestMatch = {
            wordIndex: index,
            wordLength: variantWords.length,
            charIndex: words.slice(0, index).join(' ').length + (index > 0 ? 1 : 0),
            wakeWord: variant
          };
          break;
        }
      }

      if (bestMatch) break;
    }

    if (!bestMatch) {
      const lateWake = WAKE_NAME_VARIANTS.some((variant) => normalized.includes(variant));
      return {
        detected: false,
        wakeWord: '',
        payload: '',
        reason: lateWake ? 'wake name too late' : 'wake name missing'
      };
    }

    if (bestMatch.wordIndex > WAKE_MAX_PREFIX_WORDS || bestMatch.charIndex > WAKE_MAX_INDEX) {
      return { detected: false, wakeWord: bestMatch.wakeWord, payload: '', reason: 'wake name too late' };
    }

    const payload = words.slice(bestMatch.wordIndex + bestMatch.wordLength).join(' ').trim();
    return { detected: true, wakeWord: bestMatch.wakeWord, payload, reason: '' };
  }

  async function handleAlwaysListeningCommand(payload, meta = {}) {
    const commandText = normalizeTranscript(payload);

    if (!commandText) {
      console.info('[Always Listening] ignored transcript reason: wake word heard without command');
      setCommandState('wake_word_detected', 'say a question after the wake name');
      recordCommandLog({ ...meta, decision: 'ignored', reason: 'transcript too short' });
      return;
    }

    const command = window.Charlemagne?.voiceCommands?.parse
      ? window.Charlemagne.voiceCommands.parse(commandText)
      : parseAlwaysListeningCommand(commandText);
    console.info('[Always Listening] command/payload:', command.type, command.payload || '');
    setCommandState('command_detected');

    if (command.type === 'stop_listening') {
      recordCommandLog({ ...meta, decision: 'command executed', reason: 'stop listening' });
      await stopAlwaysListening({ message: 'Listening stopped.' });
      return;
    }

    state.alwaysListeningCooldownUntil = Date.now() + ALWAYS_LISTENING_COMMAND_COOLDOWN_MS;

    if (command.type === 'cancel') {
      state.pendingConfirmation = null;
      recordCommandLog({ ...meta, decision: 'command executed', reason: 'cancel' });
      setCommandState('command_detected', 'canceled');
      return;
    }

    if (command.type === 'confirm') {
      if (!state.pendingConfirmation) {
        recordCommandLog({ ...meta, decision: 'ignored', reason: 'nothing to confirm' });
        setIgnoredStatus('nothing to confirm');
        return;
      }

      const pending = state.pendingConfirmation;
      state.pendingConfirmation = null;
      await pending.run();
      return;
    }

    if (command.requiresConfirmation) {
      state.pendingConfirmation = command;
      setCommandState('command_detected', 'say confirm or cancel');
      return;
    }

    if (command.type === 'not_enabled') {
      recordCommandLog({ ...meta, decision: 'ignored', reason: 'command not enabled' });
      setIgnoredStatus('That command is not enabled yet.');
      return;
    }

    if (command.type === 'stop_talking') {
      stopCurrentSpeech();
      recordCommandLog({ ...meta, decision: 'command executed', reason: 'stop talking' });
      setCommandState('command_detected', 'stopped talking');
      return;
    }

    if (command.type === 'clear_screen') {
      clearScreenFromVoice();
      recordCommandLog({ ...meta, decision: 'command executed', reason: 'clear screen' });
      return;
    }

    if (command.type === 'read_answer') {
      recordCommandLog({ ...meta, decision: 'command executed', reason: 'read answer' });
      readAnswerFromVoice();
      return;
    }

    if (command.type === 'lock_student_mode') {
      recordCommandLog({ ...meta, decision: 'command executed', reason: 'lock student mode' });
      lockStudentModeFromVoice();
      return;
    }

    if (command.payload) {
      setCommandState('sending_question');
      recordCommandLog({ ...meta, decision: 'sent', reason: command.type });
      submitTeacherQuestion(command.payload);
      window.setTimeout(() => {
        if (state.alwaysListeningActive) setCommandState('sending_question', 'sent question');
      }, 250);
    }
  }

  function parseAlwaysListeningCommand(text) {
    if (DANGEROUS_COMMAND_PATTERN.test(text)) return { type: 'not_enabled' };
    if (/^stop listening\b/.test(text)) return { type: 'stop_listening' };
    if (/^stop talking\b/.test(text)) return { type: 'stop_talking' };
    if (/^clear screen\b/.test(text)) return { type: 'clear_screen' };
    if (/^read answer\b/.test(text)) return { type: 'read_answer' };
    if (/^lock student mode\b/.test(text)) return { type: 'lock_student_mode' };
    if (/^cancel\b/.test(text)) return { type: 'cancel' };
    if (/^confirm\b/.test(text)) return { type: 'confirm' };

    const askMatch = text.match(/^ask\s+(.+)/);
    if (askMatch) return { type: 'ask', payload: askMatch[1].trim() };

    const calculateMatch = text.match(/^calculate\s+(.+)/);
    if (calculateMatch) return { type: 'calculate', payload: `calculate ${calculateMatch[1].trim()}` };

    const defineMatch = text.match(/^define\s+(.+)/);
    if (defineMatch) return { type: 'define', payload: `define ${defineMatch[1].trim()}` };

    const formulaMatch = text.match(/^show formula for\s+(.+)/);
    if (formulaMatch) return { type: 'show_formula', payload: `show formula for ${formulaMatch[1].trim()}` };

    return { type: 'question', payload: text };
  }

  function stopCurrentSpeech() {
    const audio = window.Charlemagne?.tts || window.CharlemagneAudio;
    if (audio && typeof audio.stop === 'function') audio.stop();
    if (audio && typeof audio.setOrbSpeaking === 'function') audio.setOrbSpeaking(false);
  }

  function clearScreenFromVoice() {
    const clearButton = byId('clearButton');
    if (clearButton) {
      clearButton.click();
      setCommandState('command_detected', 'screen cleared');
      return;
    }

    setCommandState('error', 'clear button missing');
  }

  function readAnswerFromVoice() {
    const response = byId('responseText');
    const text = String(response ? response.textContent || '' : '').trim();
    if (!text || response.classList.contains('response-empty')) {
      setIgnoredStatus('no answer to read');
      return;
    }

    submitTeacherQuestion(`Read this answer aloud: ${text}`);
  }

  function lockStudentModeFromVoice() {
    const toggle = byId('teacherModeToggle');
    if (toggle && toggle.checked) {
      toggle.click();
      setCommandState('command_detected', 'student mode locked');
      return;
    }

    setCommandState('command_detected', 'student mode locked');
  }

  function submitTeacherQuestion(question) {
    const cleanQuestion = String(question || '').trim();

    if (!cleanQuestion) {
      setStatus('I heard the wake word, but there is no question to send.');
      return;
    }

    const questionInput = window.Charlemagne?.ui?.questionInput;
    if (questionInput && typeof questionInput.submitQuestion === 'function') {
      questionInput.submitQuestion(cleanQuestion);
      return;
    }

    const input = byId('messageInput');
    const form = byId('chatForm');
    if (!input || !form) {
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
      const data = await window.Charlemagne.api.sendVoiceTranscript(blob);
      if (!data.ok) {
        const error = new Error(data.error || 'Whisper transcription failed.');
        error.code = data.code || '';
        throw error;
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
      setStatus(error && error.code === 'WHISPER_SETUP_INCOMPLETE'
        ? 'Voice setup is incomplete. Check Whisper setup on the teacher computer.'
        : 'Whisper could not transcribe that recording yet. Check local setup and try again.');
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
        setCommandState('mic_ready', 'waiting while Charlemagne speaks');
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
        setCommandState('mic_ready', 'waiting while Charlemagne speaks');
      } else {
        elements.alwaysListeningButtons.forEach((button) => button.classList.remove('is-paused'));
      }

      if (speaking && state.pushToTalkActive) {
        cancelRecording('Recording stopped because Charlemagne started speaking.');
      }
    });
  }

  function init() {
    if (initialized) return;
    elements.panel = byId('voiceInputPanel');
    elements.pushToTalk = byId('pushToTalkButton');
    elements.alwaysListening = byId('alwaysListeningButton');
    elements.pushToTalkButtons = [...document.querySelectorAll('#pushToTalkButton')];
    elements.alwaysListeningButtons = [...document.querySelectorAll('#alwaysListeningButton')];
    elements.micSelect = byId('micDeviceSelect');
    elements.speakerSelect = byId('speakerDeviceSelect');
    elements.status = byId('voiceInputStatus');
    elements.commandLog = byId('commandListeningLog');

    if (!elements.panel) return;
    initialized = true;

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

  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.voice = window.Charlemagne.voice || {};
  window.Charlemagne.voice.input = {
    init,
    setAlwaysListening,
    startRecording,
    stopAlwaysListening,
    stopRecordingAndTranscribe
  };
})();
