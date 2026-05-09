function registerClassroomControlsRoutes(app, {
  getClassroomControls,
  updateClassroomControls
}) {
  app.get('/api/classroom-controls', (_req, res) => {
    res.json({
      ok: true,
      controls: getClassroomControls()
    });
  });

  app.post('/api/classroom-controls', async (req, res) => {
    try {
      const controls = await updateClassroomControls(pickAllowedSettings(req.body || {}));
      res.json({ ok: true, controls });
    } catch (error) {
      res.status(error.statusCode || 500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

function pickAllowedSettings(body) {
  const allowedKeys = [
    'studentCopyInspectLockEnabled',
    'studentGuidedFormulaTutoringEnabled',
    'studentQuestionRateLimitEnabled',
    'studentQuestionsPerMinute'
  ];
  const unknownKey = Object.keys(body).find((key) => !allowedKeys.includes(key));
  if (unknownKey) {
    const error = new Error(`Unsupported classroom control setting: ${unknownKey}`);
    error.statusCode = 400;
    throw error;
  }

  return allowedKeys.reduce((settings, key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) settings[key] = body[key];
    return settings;
  }, {});
}

module.exports = {
  pickAllowedSettings,
  registerClassroomControlsRoutes
};
