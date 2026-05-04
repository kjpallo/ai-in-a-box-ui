const {
  DISTANCE_UNITS,
  FREQUENCY_UNITS,
  SPEED_UNITS,
  convertDistance,
  findQuantity,
  mask,
  velocityToMS
} = require('./formulaParser');
const { answer, cleanNumber } = require('./formulaAnswerFormatter');

// ---------------- Waves: wave speed = frequency × wavelength ----------------
function tryWaves(text, lower) {
  if (!/\b(wave|waves|frequency|hertz|hz|wavelength|lambda)\b/.test(lower)) return null;

  const waveSpeed = findQuantity(text, ['wave speed', 'speed', 'velocity'], SPEED_UNITS, null);
  const maskedText = waveSpeed ? mask(text, waveSpeed.start, waveSpeed.end) : text;
  const frequency = findQuantity(maskedText, ['frequency', 'freq', 'f'], FREQUENCY_UNITS, null);
  const wavelength = findQuantity(maskedText, ['wavelength', 'wave length', 'lambda'], DISTANCE_UNITS, null);
  const target = wavesTarget(lower, { waveSpeed, frequency, wavelength });

  if (target === 'wave speed' && frequency && wavelength) {
    const meters = convertDistance(wavelength.value, wavelength.unit, 'm');
    if (meters == null) return null;
    const value = frequency.value * meters;
    return answer('Recognized wave problem: solving for wave speed.', [
      'Use the wave formula: wave speed = frequency × wavelength.',
      `wave speed = ${cleanNumber(frequency.value)} Hz × ${cleanNumber(meters)} m`,
      `wave speed = ${cleanNumber(value)} m/s`
    ]);
  }

  if (target === 'frequency' && waveSpeed && wavelength) {
    const speed = velocityToMS(waveSpeed);
    const meters = convertDistance(wavelength.value, wavelength.unit, 'm');
    if (speed == null || meters == null || meters === 0) return null;
    const value = speed / meters;
    return answer('Recognized wave problem: solving for frequency.', [
      'Use the wave formula: frequency = wave speed / wavelength.',
      `frequency = ${cleanNumber(speed)} m/s / ${cleanNumber(meters)} m`,
      `frequency = ${cleanNumber(value)} Hz`
    ]);
  }

  if (target === 'wavelength' && waveSpeed && frequency && frequency.value !== 0) {
    const speed = velocityToMS(waveSpeed);
    if (speed == null) return null;
    const value = speed / frequency.value;
    return answer('Recognized wave problem: solving for wavelength.', [
      'Use the wave formula: wavelength = wave speed / frequency.',
      `wavelength = ${cleanNumber(speed)} m/s / ${cleanNumber(frequency.value)} Hz`,
      `wavelength = ${cleanNumber(value)} m`
    ]);
  }

  return null;
}

function wavesTarget(lower, values) {
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(wave speed|speed|velocity)\b/.test(lower) || /\bhow fast\b/.test(lower)) return 'wave speed';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(frequency|freq|f)\b/.test(lower) || /\bhow many hertz\b/.test(lower)) return 'frequency';
  if (/\b(what is|what's|find|calculate|solve for|determine)\s+(?:the\s+)?(wavelength|wave length|lambda)\b/.test(lower)) return 'wavelength';

  if (values.frequency && values.wavelength && !values.waveSpeed) return 'wave speed';
  if (values.waveSpeed && values.wavelength && !values.frequency) return 'frequency';
  if (values.waveSpeed && values.frequency && !values.wavelength) return 'wavelength';
  return null;
}

module.exports = { tryWaves };
