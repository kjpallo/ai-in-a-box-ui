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
    transcribing: false
  };

  const MAX_RECORDING_MS = 30_000;

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
      if (state.alwaysListeningActive) setAlwaysListening(false, { quiet: true });
      setStatus('Recording... click Push to Talk again to transcribe.');
    } else {
      setStatus('Push to Talk is ready.');
    }
  }

  function setAlwaysListening(active, options = {}) {
    state.alwaysListeningActive = Boolean(active);
    setButtonsActive(elements.alwaysListeningButtons, state.alwaysListeningActive);
    document.body.classList.toggle('voice-always-listening-on', state.alwaysListeningActive);

    if (state.alwaysListeningActive) {
      if (state.pushToTalkActive) setPushToTalk(false);
      if (!options.quiet) {
        setStatus('Always Listening is a Phase 3 placeholder. No microphone is active.');
      }
    } else if (!options.quiet) {
      setStatus('Always Listening is off. Push to Talk is available.');
    }
  }

  function setTranscribing(active) {
    state.transcribing = Boolean(active);
    elements.pushToTalkButtons.forEach((button) => {
      button.disabled = state.transcribing;
      button.classList.toggle('is-transcribing', state.transcribing);
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
    if (state.transcribing) {
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
        elements.alwaysListeningButtons.forEach((button) => button.classList.add('is-paused'));
        setStatus('Always Listening is paused while Charlemagne is speaking.');
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
        elements.alwaysListeningButtons.forEach((button) => button.classList.add('is-paused'));
        setStatus('Always Listening is paused while Charlemagne is speaking.');
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
      setAlwaysListening(!state.alwaysListeningActive);
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
