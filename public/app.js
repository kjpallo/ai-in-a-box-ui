const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const responseText = document.getElementById('responseText');
const sendButton = document.getElementById('sendButton');
const stopAudioButton = document.getElementById('stopAudioButton');
const connectionStatus = document.getElementById('connectionStatus');
const streamStatus = document.getElementById('streamStatus');
const voiceOrb = document.getElementById('voiceOrb');
const voiceStatus = document.getElementById('voiceStatus');
const foxVideo = document.getElementById('foxVideo');

let activeRequestController = null;
let currentAudio = null;
let currentPlaceholderTimer = null;
let isPlayingQueue = false;
const audioQueue = [];

async function boot() {
  await checkHealth();

  try {
    await foxVideo.play();
  } catch {
    // Browser autoplay policies can block this until user interaction.
  }
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

  activeRequestController = new AbortController();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
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
        handleServerEvent(eventData);
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

function handleServerEvent(eventData) {
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

    case 'audio_error':
      console.warn('Audio error:', eventData.message);
      break;

    case 'done':
      setStreamStatus('Complete');
      setConnectionStatus('Ready');
      if (!audioQueue.length && !isPlayingQueue) {
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
  if (isPlayingQueue) return;
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
    currentAudio = new Audio(nextItem.url);

    currentAudio.addEventListener('ended', handleAudioFinished, { once: true });
    currentAudio.addEventListener('error', handleAudioFinished, { once: true });

    currentAudio.play().catch(() => {
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

  isPlayingQueue = false;

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
      return;
    }
  } catch {
    // Ignore and fall through.
  }

  setConnectionStatus('Server check failed');
}

boot();
