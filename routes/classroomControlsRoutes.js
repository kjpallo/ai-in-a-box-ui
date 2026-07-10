const os = require('os');

function registerClassroomControlsRoutes(app, {
  getClassroomControls,
  port,
  updateClassroomControls
}) {
  app.get('/api/classroom-controls', (_req, res) => {
    const localIpv4Addresses = getLocalIpv4Addresses();
    res.json({
      ok: true,
      controls: getClassroomControls(),
      network: {
        localIpv4Addresses,
        suggestedBaseUrls: localIpv4Addresses.map((address) => `http://${address}:${port || process.env.PORT || 3000}`)
      }
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
    'studentNewJoinsLocked',
    'studentCopyInspectLockEnabled',
    'studentGuidedFormulaTutoringEnabled',
    'studentQuestionRateLimitEnabled',
    'studentQuestionsPerMinute',
    'questionsStandardsAutoArchiveEnabled',
    'questionsStandardsAutoArchiveInactiveMinutes'
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
  getLocalIpv4Addresses,
  pickAllowedSettings,
  registerClassroomControlsRoutes
};

function getLocalIpv4Addresses(networkInterfaces = os.networkInterfaces()) {
  return Object.values(networkInterfaces)
    .flat()
    .filter((item) => item && (item.family === 'IPv4' || item.family === 4) && !item.internal && item.address)
    .map((item) => item.address)
    .filter((address, index, addresses) => addresses.indexOf(address) === index);
}
