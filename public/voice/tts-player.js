(() => {
  let voiceOrb = null;
  let voiceVisualizer = null;
  let visualizerCtx = null;
  let visualizerAnimationId = null;

  let currentAudio = null;
  let currentPlaceholderTimer = null;
  let isPlayingQueue = false;
  let audioContext = null;
  let audioWorkletNode = null;
  let activeSampleRate = null;
  let isStreamingAudio = false;
  let streamChunksReceived = 0;
  const audioQueue = [];

  const callbacks = {
    setStreamStatus: () => {},
    setVoiceStatus: () => {}
  };

  function init(options = {}) {
    voiceOrb = options.voiceOrb || voiceOrb;
    voiceVisualizer = options.voiceVisualizer || voiceVisualizer;
    callbacks.setStreamStatus = options.setStreamStatus || callbacks.setStreamStatus;
    callbacks.setVoiceStatus = options.setVoiceStatus || callbacks.setVoiceStatus;

    setupVoiceVisualizer();
  }

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
    const speaking = Boolean(voiceOrb && voiceOrb.classList.contains('speaking'));

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

  function enqueue(item) {
    if (isStreamingAudio) return;
    audioQueue.push(item);
    callbacks.setVoiceStatus('Speaking…');
    playNext();
  }

  function playNext() {
    if (isPlayingQueue || isStreamingAudio) return;
    const nextItem = audioQueue.shift();
    if (!nextItem) {
      setOrbSpeaking(false);
      callbacks.setVoiceStatus('Listening for the next response...');
      return;
    }

    isPlayingQueue = true;
    setOrbSpeaking(true);
    callbacks.setVoiceStatus('Speaking…');

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
    playNext();
  }

  async function startStreamingSentence(eventData) {
    stop({ keepStatus: true });
    await ensureStreamingNode(eventData.sampleRate);
    isStreamingAudio = true;
    streamChunksReceived = 0;
    setOrbSpeaking(true);
    callbacks.setVoiceStatus('Speaking…');
  }

  function pushStreamingChunk(eventData) {
    if (!isStreamingAudio || !audioWorkletNode || !eventData.data) return;

    const samples = decodePcmChunkToFloat32(eventData.data);
    if (!samples.length) return;

    audioWorkletNode.port.postMessage({ type: 'push', samples }, [samples.buffer]);
    streamChunksReceived += 1;
  }

  function finishStreamingSentence() {
    isStreamingAudio = false;
    setOrbSpeaking(false);
    if (!audioQueue.length && !isPlayingQueue) {
      callbacks.setVoiceStatus('Waiting for the next sentence...');
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

  function stop({ keepStatus = false } = {}) {
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
    streamChunksReceived = 0;
    setOrbSpeaking(false);

    if (!keepStatus) {
      callbacks.setStreamStatus('Stopped');
      callbacks.setVoiceStatus('Audio stopped.');
    }
  }

  function setOrbSpeaking(isSpeaking) {
    const speaking = Boolean(isSpeaking);
    document.body.classList.toggle('tts-speaking', speaking);
    window.Charlemagne?.state?.set?.({ isSpeaking: speaking });
    window.dispatchEvent(new CustomEvent('charlemagne:tts-speaking', {
      detail: { speaking }
    }));

    if (!voiceOrb) return;
    voiceOrb.classList.toggle('speaking', speaking);
    voiceOrb.classList.toggle('idle', !speaking);
  }

  function isIdle() {
    return !audioQueue.length && !isPlayingQueue && !isStreamingAudio;
  }

  const ttsPlayer = {
    init,
    enqueue,
    startStreamingSentence,
    pushStreamingChunk,
    finishStreamingSentence,
    ensureAudioUnlocked,
    stop,
    setOrbSpeaking,
    isIdle
  };

  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.tts = ttsPlayer;

  // Compatibility wrapper. Prefer window.Charlemagne.tts.
  window.CharlemagneAudio = ttsPlayer;

  // Compatibility wrapper. Prefer window.Charlemagne.tts.stop().
  window.CharlemagneStopSpeaking = () => {
    stop();
    setOrbSpeaking(false);
  };
})();
