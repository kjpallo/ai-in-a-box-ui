function registerHealthRoutes(app, {
  buildSystemHealthReport,
  getTeacherKnowledgeCount,
  knowledgeDir,
  model,
  port,
  projectDir,
  teacherFactsFile,
  tts,
  voicesDir
}) {
  app.get('/api/health', (_req, res) => {
    const voices = tts.listVoices();
    res.json({
      ok: true,
      model,
      conciseMode: true,
      ttsBackend: tts.getEffectiveTtsBackend(),
      piperHttpConfigured: tts.usingPiperHttp(),
      ttsAudioMode: tts.getEffectiveAudioMode(),
      canStreamAudio: tts.canStreamAudio(),
      canSelectVoice: !tts.usingPiperHttp(),
      hasVoice: tts.usingPiperHttp() || voices.length > 0,
      knowledgeItems: getTeacherKnowledgeCount(),
      voices
    });
  });

  app.get('/api/system-health', async (_req, res) => {
    try {
      const report = await buildSystemHealthReport({
        projectDir,
        port,
        tts,
        voicesDir,
        knowledgeDir,
        teacherFactsFile,
        getTeacherKnowledgeCount
      });
      res.json(report);
    } catch (error) {
      res.status(500).json({
        ok: false,
        generatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

module.exports = {
  registerHealthRoutes
};
