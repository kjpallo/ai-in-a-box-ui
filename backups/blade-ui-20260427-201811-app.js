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


// CHARLEMAGNE_TEACHER_CONSOLE_START
(() => {
  const STORAGE_KEY = "charlemagneTeacherConsoleSettings";

  const defaultSettings = {
    voiceMode: "open",
    teacherVoiceEnabled: false,
    commandsEnabled: true,
    activeTab: "voice"
  };

  function loadSettings() {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return { ...defaultSettings };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  let settings = loadSettings();

  const tabs = [
    { id: "voice", label: "Voice Setup" },
    { id: "profiles", label: "Profiles" },
    { id: "commands", label: "Commands" },
    { id: "modes", label: "Modes" },
    { id: "system", label: "System" }
  ];

  const commands = [
    "stop talking",
    "clear screen",
    "reload teacher facts",
    "lock classroom voice",
    "unlock classroom voice",
    "shutdown assistant"
  ];

  function makeConsoleHtml() {
    return `
      <button id="tcOpenButton" class="tc-open-button" type="button" aria-label="Open Teacher Console">
        Teacher Console
      </button>

      <div id="tcBackdrop" class="tc-backdrop" hidden></div>

      <aside id="tcShell" class="tc-shell" hidden aria-label="Teacher Console">
        <div class="tc-blades">
          ${tabs.map(tab => `
            <button class="tc-blade ${settings.activeTab === tab.id ? "active" : ""}" data-tc-tab="${tab.id}" type="button">
              ${tab.label}
            </button>
          `).join("")}
        </div>

        <section class="tc-panel">
          <div class="tc-panel-header">
            <div>
              <p class="tc-kicker">Charlemagne System</p>
              <h2>Teacher Console</h2>
            </div>
            <button id="tcCloseButton" class="tc-close-button" type="button" aria-label="Close Teacher Console">×</button>
          </div>

          <div class="tc-content">
            <div class="tc-tab-page" data-tc-page="voice">
              <h3>Voice Setup</h3>
              <p>
                This is the foundation for teacher-only voice training. Recording, voice matching,
                and Whisper routing will be wired in after this screen is stable.
              </p>

              <div class="tc-card-grid">
                <div class="tc-card">
                  <span class="tc-card-label">Mic</span>
                  <strong>MC1000 ready path</strong>
                  <p>Future step: test the Pi microphone and record teacher samples.</p>
                </div>

                <div class="tc-card">
                  <span class="tc-card-label">Training</span>
                  <strong>Teacher profiles only</strong>
                  <p>No student voice profiles or student identity tracking.</p>
                </div>

                <div class="tc-card">
                  <span class="tc-card-label">Next build</span>
                  <strong>Record samples</strong>
                  <p>Add teacher enrollment controls here in Phase 2.</p>
                </div>
              </div>

              <button class="tc-action-button" type="button" disabled>
                Train Teacher Voice Coming Next
              </button>
            </div>

            <div class="tc-tab-page" data-tc-page="profiles">
              <h3>Teacher Profiles</h3>
              <p>
                Enrolled teacher voices will appear here. Student profiles are intentionally not part of this system.
              </p>

              <div class="tc-empty-state">
                No teacher profiles have been created yet.
              </div>
            </div>

            <div class="tc-tab-page" data-tc-page="commands">
              <h3>Built-in Commands</h3>
              <p>
                These commands should eventually run through code after teacher voice verification,
                not through the AI model guessing.
              </p>

              <div class="tc-command-list">
                ${commands.map(command => `<span>${command}</span>`).join("")}
              </div>

              <label class="tc-toggle-row">
                <input id="tcCommandsToggle" type="checkbox" ${settings.commandsEnabled ? "checked" : ""}>
                <span>Enable built-in command layer when voice verification is added</span>
              </label>
            </div>

            <div class="tc-tab-page" data-tc-page="modes">
              <h3>Voice Modes</h3>
              <p>
                These options save locally for now. Later they will control how the listening pipeline behaves.
              </p>

              <div class="tc-mode-list">
                <label class="tc-mode-card">
                  <input type="radio" name="tcVoiceMode" value="open" ${settings.voiceMode === "open" ? "checked" : ""}>
                  <span>
                    <strong>Open Classroom Mode</strong>
                    <small>Normal mode. Voice system can be open later if you choose.</small>
                  </span>
                </label>

                <label class="tc-mode-card">
                  <input type="radio" name="tcVoiceMode" value="teacher" ${settings.voiceMode === "teacher" ? "checked" : ""}>
                  <span>
                    <strong>Teacher Voice Mode</strong>
                    <small>Only enrolled teacher voices can submit spoken questions.</small>
                  </span>
                </label>

                <label class="tc-mode-card">
                  <input type="radio" name="tcVoiceMode" value="locked" ${settings.voiceMode === "locked" ? "checked" : ""}>
                  <span>
                    <strong>Locked Teacher Mode</strong>
                    <small>Teacher-only voice and teacher settings. For when students are messing with it.</small>
                  </span>
                </label>
              </div>
            </div>

            <div class="tc-tab-page" data-tc-page="system">
              <h3>System Status</h3>

              <div class="tc-status-grid">
                <div>
                  <span>Teacher Console</span>
                  <strong>Installed</strong>
                </div>
                <div>
                  <span>Teacher Voice Training</span>
                  <strong>Phase 2</strong>
                </div>
                <div>
                  <span>Whisper Routing</span>
                  <strong>Not wired yet</strong>
                </div>
                <div>
                  <span>Student Voice Profiles</span>
                  <strong>Disabled by design</strong>
                </div>
              </div>
            </div>
          </div>
        </section>
      </aside>
    `;
  }

  function openConsole() {
    const shell = document.getElementById("tcShell");
    const backdrop = document.getElementById("tcBackdrop");
    if (!shell || !backdrop) return;
    shell.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => {
      shell.classList.add("open");
      backdrop.classList.add("open");
    });
  }

  function closeConsole() {
    const shell = document.getElementById("tcShell");
    const backdrop = document.getElementById("tcBackdrop");
    if (!shell || !backdrop) return;
    shell.classList.remove("open");
    backdrop.classList.remove("open");
    setTimeout(() => {
      shell.hidden = true;
      backdrop.hidden = true;
    }, 180);
  }

  function setActiveTab(tabId) {
    settings.activeTab = tabId;
    saveSettings(settings);

    document.querySelectorAll("[data-tc-tab]").forEach(button => {
      button.classList.toggle("active", button.dataset.tcTab === tabId);
    });

    document.querySelectorAll("[data-tc-page]").forEach(page => {
      page.classList.toggle("active", page.dataset.tcPage === tabId);
    });
  }

  function wireEvents() {
    document.getElementById("tcOpenButton")?.addEventListener("click", openConsole);
    document.getElementById("tcCloseButton")?.addEventListener("click", closeConsole);
    document.getElementById("tcBackdrop")?.addEventListener("click", closeConsole);

    document.querySelectorAll("[data-tc-tab]").forEach(button => {
      button.addEventListener("click", () => setActiveTab(button.dataset.tcTab));
    });

    document.querySelectorAll("input[name='tcVoiceMode']").forEach(input => {
      input.addEventListener("change", () => {
        settings.voiceMode = input.value;
        saveSettings(settings);
      });
    });

    document.getElementById("tcCommandsToggle")?.addEventListener("change", event => {
      settings.commandsEnabled = event.target.checked;
      saveSettings(settings);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeConsole();
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "t") openConsole();
    });
  }

  function init() {
    if (document.getElementById("tcOpenButton")) return;

    document.body.insertAdjacentHTML("beforeend", makeConsoleHtml());
    wireEvents();
    setActiveTab(settings.activeTab || "voice");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
// CHARLEMAGNE_TEACHER_CONSOLE_END

