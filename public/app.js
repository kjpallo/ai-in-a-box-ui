const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const responseText = document.getElementById('responseText');
const sendButton = document.getElementById('sendButton');
const stopAudioButton = document.getElementById('stopAudioButton');
const connectionStatus = document.getElementById('connectionStatus');
const streamStatus = document.getElementById('streamStatus');
const voiceOrb = document.getElementById('voiceOrb');
const voiceStatus = document.getElementById('voiceStatus');
const voiceSelect = document.getElementById('voiceSelect');
const voiceHint = document.getElementById('voiceHint');
const voiceVisualizer = document.getElementById('voiceVisualizer');

let activeRequestController = null;
let currentAudio = null;
let currentPlaceholderTimer = null;
let isPlayingQueue = false;
let selectedVoice = '';
let audioContext = null;
let audioWorkletNode = null;
let activeSampleRate = null;
let isStreamingAudio = false;
let streamChunksReceived = 0;
const audioQueue = [];

let visualizerCtx = null;
let visualizerAnimationId = null;

async function boot() {
  await checkHealth();
  setupVoiceVisualizer();
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  stopAudioPlayback({ keepStatus: true });
  responseText.textContent = '';
  responseText.classList.add('streaming');
  setStreamStatus('Thinking…');
  setConnectionStatus('Thinking');
  setVoiceStatus('Preparing response...');

  sendButton.disabled = true;
  messageInput.disabled = true;
  voiceSelect.disabled = true;

  activeRequestController = new AbortController();

  try {
    await ensureAudioUnlocked();

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
      setStreamStatus('Stopped');
      setVoiceStatus('Audio stopped.');
    } else {
      responseText.textContent = 'The classroom assistant is not connected right now. Tell your teacher.';
      setStreamStatus('Voice problem');
      setConnectionStatus('Voice problem');
      setVoiceStatus('Voice problem');
    }
  } finally {
    responseText.classList.remove('streaming');
    sendButton.disabled = false;
    messageInput.disabled = false;
    await refreshVoiceOptions();
    activeRequestController = null;
  }
});

stopAudioButton.addEventListener('click', () => {
  if (activeRequestController) {
    activeRequestController.abort();
  }

  stopAudioPlayback();
  setOrbSpeaking(false);
});

voiceSelect.addEventListener('change', () => {
  selectedVoice = voiceSelect.value;
});

function setupVoiceVisualizer() {
  if (!voiceVisualizer) return;

  visualizerCtx = voiceVisualizer.getContext('2d');
  resizeVoiceVisualizer();
  window.addEventListener('resize', resizeVoiceVisualizer);

  if (!visualizerAnimationId) {
    drawVoiceVisualizer(0);
  }
}

function resizeVoiceVisualizer() {
  if (!voiceVisualizer || !visualizerCtx) return;

  const rect = voiceVisualizer.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  voiceVisualizer.width = Math.max(1, Math.floor(rect.width * dpr));
  voiceVisualizer.height = Math.max(1, Math.floor(rect.height * dpr));

  visualizerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawVoiceVisualizer(time) {
  if (!voiceVisualizer || !visualizerCtx) return;

  const ctx = visualizerCtx;
  const rect = voiceVisualizer.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const speaking = voiceOrb.classList.contains('speaking');

  ctx.clearRect(0, 0, width, height);

  const pulse = speaking
    ? 0.75 + Math.sin(time * 0.01) * 0.15
    : 0.22 + Math.sin(time * 0.002) * 0.03;

  const coreRadius = Math.min(width, height) * (0.16 + pulse * 0.02);
  const ringRadius = Math.min(width, height) * 0.28;
  const barCount = 56;

  const glow = ctx.createRadialGradient(centerX, centerY, coreRadius * 0.2, centerX, centerY, ringRadius * 1.35);
  glow.addColorStop(0, speaking ? 'rgba(84,255,179,0.35)' : 'rgba(84,255,179,0.12)');
  glow.addColorStop(0.45, speaking ? 'rgba(255,138,61,0.16)' : 'rgba(255,138,61,0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, ringRadius * 1.45, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < barCount; i += 1) {
    const angle = (i / barCount) * Math.PI * 2;
    const waveA = Math.sin(time * 0.01 + i * 0.45);
    const waveB = Math.sin(time * 0.006 - i * 0.32);
    const motion = speaking
      ? ((waveA + waveB + 2) / 4)
      : ((waveB + 1) / 2) * 0.18;

    const inner = ringRadius;
    const outer = ringRadius + 8 + motion * 28;

    const x1 = centerX + Math.cos(angle) * inner;
    const y1 = centerY + Math.sin(angle) * inner;
    const x2 = centerX + Math.cos(angle) * outer;
    const y2 = centerY + Math.sin(angle) * outer;

    ctx.strokeStyle = speaking
      ? `rgba(84,255,179,${0.28 + motion * 0.65})`
      : `rgba(84,255,179,${0.10 + motion * 0.22})`;

    ctx.lineWidth = speaking ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const innerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
  innerGlow.addColorStop(0, speaking ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)');
  innerGlow.addColorStop(0.15, speaking ? 'rgba(84,255,179,0.95)' : 'rgba(84,255,179,0.45)');
  innerGlow.addColorStop(0.65, speaking ? 'rgba(255,138,61,0.26)' : 'rgba(255,138,61,0.14)');
  innerGlow.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = innerGlow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
  ctx.fill();

  visualizerAnimationId = requestAnimationFrame(drawVoiceVisualizer);
}

async function handleServerEvent(eventData) {
  switch (eventData.type) {
    case 'start':
      responseText.textContent = '';
      setStreamStatus('Thinking…');
      setConnectionStatus('Ready');
      break;

    case 'text_delta':
      responseText.textContent += eventData.chunk;
      break;

    case 'audio':
      enqueueAudio(eventData);
      break;

    case 'audio_stream_start':
      await startStreamingSentence(eventData);
      break;

    case 'audio_chunk':
      pushStreamingChunk(eventData);
      break;

    case 'audio_stream_end':
      finishStreamingSentence(eventData);
      break;

    case 'audio_error':
      console.warn('Audio error:', eventData.message);
      setVoiceStatus('Audio issue on one sentence.');
      setOrbSpeaking(false);
      isStreamingAudio = false;
      break;

    case 'done':
      setStreamStatus('Ready');
      setConnectionStatus('Ready');
      if (!audioQueue.length && !isPlayingQueue && !isStreamingAudio) {
        setVoiceStatus('Response finished.');
      }
      break;

    case 'error':
      responseText.textContent += `\n\n[Server error] ${eventData.message}`;
      setStreamStatus('Voice problem');
      setConnectionStatus('Voice problem');
      setVoiceStatus('Server returned an error.');
      break;

    default:
      break;
  }
}

function enqueueAudio(item) {
  audioQueue.push(item);
  setVoiceStatus('Speaking…');
  playNextAudio();
}

function playNextAudio() {
  if (isPlayingQueue || isStreamingAudio) return;
  const nextItem = audioQueue.shift();
  if (!nextItem) {
    setOrbSpeaking(false);
    setVoiceStatus('Listening for the next response...');
    return;
  }

  isPlayingQueue = true;
  setOrbSpeaking(true);
  setVoiceStatus('Speaking…');

  if (nextItem.mode === 'file' && nextItem.url) {
  const audioUrl = `${nextItem.url}?v=${Date.now()}`;
  console.log('Playing audio file:', audioUrl, nextItem.wavInfo || null);

  currentAudio = new Audio(audioUrl);
  currentAudio.preload = 'auto';
  currentAudio.defaultPlaybackRate = 1.0;
  currentAudio.playbackRate = 1.0;

  currentAudio.addEventListener('ended', handleAudioFinished, { once: true });
  currentAudio.addEventListener('error', handleAudioFinished, { once: true });

  currentAudio.play().catch((error) => {
    console.error('Audio play error:', error);
    handleAudioFinished();
  });
  return;
}

  const duration = nextItem.durationMs || 1200;
  currentPlaceholderTimer = window.setTimeout(() => {
    handleAudioFinished();
  }, duration);
}

function handleAudioFinished() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }

  if (currentPlaceholderTimer) {
    clearTimeout(currentPlaceholderTimer);
    currentPlaceholderTimer = null;
  }

  isPlayingQueue = false;
  setOrbSpeaking(false);
  playNextAudio();
}

async function startStreamingSentence(eventData) {
  await ensureStreamingNode(eventData.sampleRate);
  isStreamingAudio = true;
  streamChunksReceived = 0;
  setOrbSpeaking(true);
  setVoiceStatus('Speaking…');
}

function pushStreamingChunk(eventData) {
  if (!audioWorkletNode || !eventData.data) return;

  const samples = decodePcmChunkToFloat32(eventData.data);
  if (!samples.length) return;

  audioWorkletNode.port.postMessage({ type: 'push', samples }, [samples.buffer]);
  streamChunksReceived += 1;
}

function finishStreamingSentence() {
  isStreamingAudio = false;
  setOrbSpeaking(false);
  if (!audioQueue.length && !isPlayingQueue) {
    setVoiceStatus('Waiting for the next sentence...');
  }
}

async function ensureAudioUnlocked(sampleRate) {
  const needNewContext =
    !audioContext ||
    (sampleRate && Math.round(audioContext.sampleRate) !== Math.round(sampleRate));

  if (needNewContext) {
    if (audioContext) {
      await audioContext.close();
    }

    audioContext = new AudioContext(
      sampleRate ? { sampleRate } : undefined
    );
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

async function ensureStreamingNode(sampleRate) {
await ensureAudioUnlocked(sampleRate);

  if (!sampleRate) {
    throw new Error('Missing Piper sample rate for streaming audio.');
  }

  if (audioWorkletNode && activeSampleRate === sampleRate) {
    return;
  }

  if (audioWorkletNode) {
    audioWorkletNode.port.postMessage({ type: 'clear' });
    audioWorkletNode.disconnect();
    audioWorkletNode = null;
  }

  const workletUrl = '/audio-stream-processor.js';
  await audioContext.audioWorklet.addModule(workletUrl);
  audioWorkletNode = new AudioWorkletNode(audioContext, 'pcm-stream-processor', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2]
  });
  audioWorkletNode.connect(audioContext.destination);
  activeSampleRate = sampleRate;
}

function decodePcmChunkToFloat32(base64Data) {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(bytes.byteLength / 2);

  for (let index = 0; index < samples.length; index += 1) {
    const int16 = view.getInt16(index * 2, true);
    samples[index] = int16 / 32768;
  }

  return samples;
}

function stopAudioPlayback({ keepStatus = false } = {}) {
  audioQueue.length = 0;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }

  if (currentPlaceholderTimer) {
    clearTimeout(currentPlaceholderTimer);
    currentPlaceholderTimer = null;
  }

  if (audioWorkletNode) {
    audioWorkletNode.port.postMessage({ type: 'clear' });
  }

  isPlayingQueue = false;
  isStreamingAudio = false;

  if (!keepStatus) {
    setStreamStatus('Stopped');
    setVoiceStatus('Audio stopped.');
  }
}

function setOrbSpeaking(isSpeaking) {
  voiceOrb.classList.toggle('speaking', isSpeaking);
  voiceOrb.classList.toggle('idle', !isSpeaking);
}

function setConnectionStatus(text) {
  connectionStatus.textContent = text;
}

function setStreamStatus(text) {
  streamStatus.textContent = text;
}

function setVoiceStatus(text) {
  voiceStatus.textContent = text;
}

async function checkHealth() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();

    if (data.ok) {
      setConnectionStatus(data.hasVoice ? 'Ready + Voice' : 'Ready');
      populateVoiceSelect(data.voices || [], data.canSelectVoice, data.canStreamAudio);
      return;
    }
  } catch {
    // Ignore and fall through.
  }

  setConnectionStatus('Voice problem');
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
  voiceSelect.innerHTML = '';

  if (!voices.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = canSelectVoice ? 'Drop a Piper voice into /voices' : 'Voice is controlled by the Piper server';
    voiceSelect.appendChild(option);
    voiceSelect.disabled = true;
    voiceHint.textContent = canSelectVoice
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
    voiceSelect.appendChild(option);
  }

  if (selectedVoice && voices.some((voice) => voice.id === selectedVoice)) {
    voiceSelect.value = selectedVoice;
  } else {
    selectedVoice = voices[0].id;
    voiceSelect.value = selectedVoice;
  }

  voiceSelect.disabled = !canSelectVoice;
  if (canSelectVoice) {
    voiceHint.textContent = canStreamAudio
      ? 'Pick a local Piper voice. Streaming mode needs the matching .onnx.json metadata file so the browser knows the sample rate.'
      : 'Pick a local Piper voice. File mode is enabled right now.';
  } else {
    voiceHint.textContent = 'Voice changes happen on the Piper server side.';
  }
}

boot();


// CHARLEMAGNE_UI_PATCH_START
const charlemagneCopyButton = document.getElementById('copyAnswerButton');
const charlemagneClearButton = document.getElementById('clearButton');
const charlemagneTeacherToggle = document.getElementById('teacherModeToggle');
const charlemagneHistoryList = document.getElementById('historyList');
const charlemagneChipButtons = document.querySelectorAll('.chip-button');

let charlemagneLastQuestion = '';
let charlemagneHistoryAnswer = '';

chatForm.addEventListener('submit', () => {
  charlemagneLastQuestion = messageInput.value.trim();

  window.setTimeout(() => {
    messageInput.value = '';
  }, 0);
});

if (charlemagneTeacherToggle) {
  charlemagneTeacherToggle.addEventListener('change', () => {
    document.body.classList.toggle('teacher-mode', charlemagneTeacherToggle.checked);
  });
}

charlemagneChipButtons.forEach((button) => {
  button.addEventListener('click', () => {
    messageInput.value = button.dataset.prompt || button.textContent.trim();
    messageInput.focus();
  });
});

if (charlemagneCopyButton) {
  charlemagneCopyButton.addEventListener('click', async () => {
    const text = responseText.textContent.trim();

    if (!text || text === 'Ask a question to see the answer here.') return;

    try {
      await navigator.clipboard.writeText(text);
      charlemagneCopyButton.textContent = 'Copied';
    } catch {
      charlemagneCopyButton.textContent = 'Copy failed';
    }

    window.setTimeout(() => {
      charlemagneCopyButton.textContent = 'Copy Answer';
    }, 1200);
  });
}

if (charlemagneClearButton) {
  charlemagneClearButton.addEventListener('click', () => {
    stopAudioPlayback({ keepStatus: true });

    responseText.textContent = 'Ask a question to see the answer here.';
    responseText.classList.remove('streaming');

    messageInput.value = '';
    messageInput.focus();

    setStreamStatus('Ready');
    setConnectionStatus('Ready');
    setVoiceStatus('Ready');
    setOrbSpeaking(false);
  });
}

function setConnectionStatus(text) {
  setCharlemagneStatus(connectionStatus, text);
}

function setStreamStatus(text) {
  setCharlemagneStatus(streamStatus, text);
}

function setCharlemagneStatus(element, text) {
  if (!element) return;

  const friendly = normalizeCharlemagneStatus(text);

  element.textContent = friendly;
  element.classList.remove('status-ready', 'status-thinking', 'status-speaking', 'status-error');

  if (friendly === 'Ready') element.classList.add('status-ready');
  if (friendly === 'Thinking…') element.classList.add('status-thinking');
  if (friendly === 'Speaking…') element.classList.add('status-speaking');
  if (friendly === 'Voice problem') element.classList.add('status-error');
}

function normalizeCharlemagneStatus(text) {
  const value = String(text || '').toLowerCase();

  if (
    value.includes('speak') ||
    value.includes('talk') ||
    value.includes('stream') ||
    value.includes('queued')
  ) {
    return 'Speaking…';
  }

  if (value.includes('think') || value.includes('prepar')) {
    return 'Thinking…';
  }

  if (
    value.includes('error') ||
    value.includes('offline') ||
    value.includes('failed') ||
    value.includes('problem')
  ) {
    return 'Voice problem';
  }

  return 'Ready';
}

function setVoiceStatus(text) {
  if (!voiceStatus) return;

  voiceStatus.textContent = normalizeVoiceText(text);
}

function normalizeVoiceText(text) {
  const value = String(text || '').toLowerCase();

  if (value.includes('problem') || value.includes('error') || value.includes('issue')) {
    return 'Voice problem';
  }

  if (
    value.includes('speak') ||
    value.includes('talk') ||
    value.includes('stream') ||
    value.includes('queued')
  ) {
    return 'Speaking…';
  }

  if (value.includes('think') || value.includes('prepar')) {
    return 'Thinking…';
  }

  if (value.includes('stopped')) {
    return 'Voice stopped.';
  }

  return 'Ready for the next question.';
}

async function handleServerEvent(eventData) {
  switch (eventData.type) {
    case 'start':
      responseText.textContent = '';
      charlemagneHistoryAnswer = '';
      setStreamStatus('Thinking…');
      setConnectionStatus('Thinking…');
      setVoiceStatus('Thinking…');
      break;

    case 'text_delta':
      responseText.textContent += eventData.chunk;
      charlemagneHistoryAnswer = responseText.textContent.trim();
      break;

    case 'audio':
      enqueueAudio(eventData);
      break;

    case 'audio_stream_start':
      await startStreamingSentence(eventData);
      break;

    case 'audio_chunk':
      pushStreamingChunk(eventData);
      break;

    case 'audio_stream_end':
      finishStreamingSentence(eventData);
      break;

    case 'audio_error':
      console.warn('Audio error:', eventData.message);
      setVoiceStatus('Voice problem');
      setStreamStatus('Voice problem');
      setOrbSpeaking(false);
      isStreamingAudio = false;
      break;

    case 'done':
      setStreamStatus('Ready');
      setConnectionStatus('Ready');

      charlemagneHistoryAnswer = responseText.textContent.trim();

      if (charlemagneLastQuestion && charlemagneHistoryAnswer) {
        addCharlemagneHistoryItem(charlemagneLastQuestion, charlemagneHistoryAnswer);
      }

      if (!audioQueue.length && !isPlayingQueue && !isStreamingAudio) {
        setVoiceStatus('Ready');
      }

      break;

    case 'error':
      responseText.textContent = 'The classroom assistant is not connected right now. Tell your teacher.';
      setStreamStatus('Voice problem');
      setConnectionStatus('Voice problem');
      setVoiceStatus('Voice problem');

      if (charlemagneLastQuestion) {
        addCharlemagneHistoryItem(charlemagneLastQuestion, responseText.textContent);
      }

      break;

    default:
      break;
  }
}

function addCharlemagneHistoryItem(question, answer) {
  if (!charlemagneHistoryList || !question || !answer) return;

  const empty = charlemagneHistoryList.querySelector('.history-empty');
  if (empty) empty.remove();

  const card = document.createElement('article');
  card.className = 'history-card';

  const q = document.createElement('p');
  q.className = 'history-question';
  q.textContent = `Student: ${question}`;

  const a = document.createElement('p');
  a.className = 'history-answer';

  const shortAnswer = answer.replace(/\s+/g, ' ').trim();
  a.textContent = `Charlemagne: ${
    shortAnswer.length > 180 ? shortAnswer.slice(0, 177) + '...' : shortAnswer
  }`;

  card.appendChild(q);
  card.appendChild(a);
  charlemagneHistoryList.prepend(card);

  charlemagneHistoryList.querySelectorAll('.history-card').forEach((item, index) => {
    if (index >= 6) item.remove();
  });
}
// CHARLEMAGNE_UI_PATCH_END


// CHARLEMAGNE_BLADE_UI_START
(() => {
  const BLADE_KEY = "charlemagneBladeActive";
  const bladeDefs = [
    {
      id: "voice",
      label: "Voice Setup",
      short: "VOICE SETUP",
      icon: "🎙",
      body: `
        <div class="blade-placeholder-card">
          <h3>Voice Setup</h3>
          <p>Teacher voice training will live here.</p>
          <p>For now this is a placeholder blade so the blade UI and sliding mechanic are in place.</p>
        </div>
      `
    },
    {
      id: "profiles",
      label: "Profiles",
      short: "PROFILES",
      icon: "👤",
      body: `
        <div class="blade-placeholder-card">
          <h3>Profiles</h3>
          <p>Teacher profiles will live here.</p>
          <p>No student voice tracking. Teacher profiles only.</p>
        </div>
      `
    },
    {
      id: "main",
      label: "Main",
      short: "MAIN",
      icon: "⌂",
      body: ""
    },
    {
      id: "commands",
      label: "Commands",
      short: "COMMANDS",
      icon: ">_",
      body: `
        <div class="blade-placeholder-card">
          <h3>Commands</h3>
          <p>Built-in assistant commands will live here.</p>
          <ul>
            <li>stop talking</li>
            <li>clear screen</li>
            <li>reload teacher facts</li>
            <li>lock classroom voice</li>
            <li>unlock classroom voice</li>
            <li>shutdown assistant</li>
          </ul>
        </div>
      `
    },
    {
      id: "modes",
      label: "Modes",
      short: "MODES",
      icon: "◧",
      body: `
        <div class="blade-placeholder-card">
          <h3>Modes</h3>
          <p>Voice mode switching will live here.</p>
          <ul>
            <li>Open Classroom Mode</li>
            <li>Teacher Voice Mode</li>
            <li>Locked Teacher Mode</li>
          </ul>
        </div>
      `
    },
    {
      id: "system",
      label: "System",
      short: "SYSTEM",
      icon: "⚙",
      body: `
        <div class="blade-placeholder-card">
          <h3>System</h3>
          <p>System settings and diagnostics will live here.</p>
        </div>
      `
    }
  ];

  function getActiveIndex() {
    const saved = localStorage.getItem(BLADE_KEY);
    const idx = bladeDefs.findIndex(b => b.id === saved);
    return idx >= 0 ? idx : 2; // default = Main
  }

  function setActiveIndex(idx) {
    localStorage.setItem(BLADE_KEY, bladeDefs[idx].id);
  }

  function buildShell(appRoot) {
    const shell = document.createElement("div");
    shell.id = "bladeUiShell";
    shell.className = "blade-ui-shell";

    shell.innerHTML = `
      <div class="blade-stage-shell">
        <div class="blade-side-frame blade-side-frame-left"></div>
        <div class="blade-side-frame blade-side-frame-right"></div>

        <button class="blade-arrow blade-arrow-left" type="button" aria-label="Previous blade">‹</button>

        <div class="blade-preview-rail blade-preview-rail-left" id="bladeLeftRail"></div>

        <div class="blade-center-stage">
          <div class="blade-center-halo"></div>
          <div class="blade-center-panel" id="bladeCenterPanel"></div>
        </div>

        <div class="blade-preview-rail blade-preview-rail-right" id="bladeRightRail"></div>

        <button class="blade-arrow blade-arrow-right" type="button" aria-label="Next blade">›</button>
      </div>

      <nav class="blade-bottom-nav" id="bladeBottomNav"></nav>
    `;

    const center = shell.querySelector("#bladeCenterPanel");

    bladeDefs.forEach(def => {
      const page = document.createElement("section");
      page.className = "blade-page";
      page.dataset.bladePage = def.id;

      if (def.id === "main") {
        const header = document.createElement("div");
        header.className = "blade-page-title";
        header.textContent = "Main";
        page.appendChild(header);

        const contentWrap = document.createElement("div");
        contentWrap.className = "blade-main-content-wrap";
        contentWrap.appendChild(appRoot);
        page.appendChild(contentWrap);
      } else {
        page.innerHTML = `
          <div class="blade-page-title">${def.label}</div>
          <div class="blade-page-body">${def.body}</div>
        `;
      }

      center.appendChild(page);
    });

    document.body.innerHTML = "";
    document.body.appendChild(shell);
  }

  function buildBottomNav(activeIndex) {
    const nav = document.getElementById("bladeBottomNav");
    if (!nav) return;

    nav.innerHTML = `
      <button class="blade-nav-arrow" data-blade-shift="-1" type="button">‹</button>
      ${bladeDefs.map((def, index) => `
        <button
          class="blade-nav-item ${index === activeIndex ? "active" : ""}"
          data-blade-index="${index}"
          type="button"
        >
          <span class="blade-nav-icon">${def.icon}</span>
          <span class="blade-nav-label">${def.label}</span>
        </button>
      `).join("")}
      <button class="blade-nav-arrow" data-blade-shift="1" type="button">›</button>
    `;
  }

  function makePreviewBlade(def, index, activeIndex, side) {
    const btn = document.createElement("button");
    btn.className = `blade-preview ${side}`;
    btn.dataset.bladeIndex = index;

    const distance = Math.abs(index - activeIndex);
    btn.style.setProperty("--preview-depth", String(distance));

    btn.innerHTML = `
      <div class="blade-preview-inner">
        <div class="blade-preview-title">${def.short}</div>
        <div class="blade-preview-icon">${def.icon}</div>
        <div class="blade-preview-accent ${def.id}"></div>
      </div>
    `;
    return btn;
  }

  function render(activeIndex) {
    setActiveIndex(activeIndex);

    document.querySelectorAll(".blade-page").forEach((page, idx) => {
      page.classList.toggle("active", idx === activeIndex);
    });

    const leftRail = document.getElementById("bladeLeftRail");
    const rightRail = document.getElementById("bladeRightRail");
    if (leftRail) leftRail.innerHTML = "";
    if (rightRail) rightRail.innerHTML = "";

    const leftItems = bladeDefs
      .map((def, idx) => ({ def, idx }))
      .filter(item => item.idx < activeIndex);

    const rightItems = bladeDefs
      .map((def, idx) => ({ def, idx }))
      .filter(item => item.idx > activeIndex);

    leftItems.forEach(item => {
      leftRail.appendChild(makePreviewBlade(item.def, item.idx, activeIndex, "left"));
    });

    rightItems.forEach(item => {
      rightRail.appendChild(makePreviewBlade(item.def, item.idx, activeIndex, "right"));
    });

    buildBottomNav(activeIndex);

    document.querySelectorAll("[data-blade-index]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.bladeIndex);
        if (!Number.isNaN(idx)) render(idx);
      });
    });

    document.querySelectorAll("[data-blade-shift]").forEach(btn => {
      btn.addEventListener("click", () => {
        const shift = Number(btn.dataset.bladeShift);
        const next = Math.max(0, Math.min(bladeDefs.length - 1, activeIndex + shift));
        render(next);
      });
    });

    document.querySelector(".blade-arrow-left")?.addEventListener("click", () => {
      const next = Math.max(0, activeIndex - 1);
      render(next);
    });

    document.querySelector(".blade-arrow-right")?.addEventListener("click", () => {
      const next = Math.min(bladeDefs.length - 1, activeIndex + 1);
      render(next);
    });
  }

  function initBladeUi() {
    if (document.getElementById("bladeUiShell")) return;

    const appRoot =
      document.querySelector("main") ||
      document.querySelector(".app-shell") ||
      document.querySelector(".container") ||
      document.querySelector(".page-shell") ||
      document.body.firstElementChild;

    if (!appRoot) return;

    buildShell(appRoot);
    render(getActiveIndex());

    document.addEventListener("keydown", (event) => {
      const current = getActiveIndex();
      if (event.key === "ArrowLeft") {
        render(Math.max(0, current - 1));
      }
      if (event.key === "ArrowRight") {
        render(Math.min(bladeDefs.length - 1, current + 1));
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBladeUi);
  } else {
    initBladeUi();
  }
})();
// CHARLEMAGNE_BLADE_UI_END

