function registerVoiceRoutes(app, { tts }) {
  app.get('/api/voices', (_req, res) => {
    res.json({
      backend: tts.getEffectiveTtsBackend(),
      ttsAudioMode: tts.getEffectiveAudioMode(),
      canStreamAudio: tts.canStreamAudio(),
      canSelectVoice: !tts.usingPiperHttp(),
      voices: tts.listVoices()
    });
  });
}

module.exports = {
  registerVoiceRoutes
};
