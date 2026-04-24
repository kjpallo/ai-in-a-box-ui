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
  setStreamStatus('Streaming');
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
      throw new Error('Could not reach the local server.');
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
      responseText.textContent = `Error: ${error.message}`;
      setStreamStatus('Error');
      setConnectionStatus('Offline');
      setVoiceStatus('There was a problem talking to the backend.');
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
      setStreamStatus('Streaming');
      setConnectionStatus('Connected');
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
      setStreamStatus('Complete');
      setConnectionStatus('Ready');
      if (!audioQueue.length && !isPlayingQueue && !isStreamingAudio) {
        setVoiceStatus('Response finished.');
      }
      break;

    case 'error':
      responseText.textContent += `\n\n[Server error] ${eventData.message}`;
      setStreamStatus('Error');
      setConnectionStatus('Offline');
      setVoiceStatus('Server returned an error.');
      break;

    default:
      break;
  }
}

function enqueueAudio(item) {
  audioQueue.push(item);
  setVoiceStatus('Voice queued...');
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
  setVoiceStatus('Piper is talking...');

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
  setVoiceStatus(`Piper is streaming${eventData.voiceName ? ` (${eventData.voiceName})` : ''}...`);
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

  setConnectionStatus('Server check failed');
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
