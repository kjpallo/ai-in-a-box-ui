function tryUnit5WavesKnowledge(message) {
  const text = normalize(message);
  if (!text) return null;
  if (looksLikeWaveFormulaPrompt(text) && !looksLikeReflectionAnglePrompt(text)) return null;

  const answer = answerWaveConcept(text);
  if (!answer) return null;

  return {
    type: answer.type || 'science_concept',
    confidence: 'strong',
    toolsUsed: ['unit5_waves_knowledge'],
    notes: `Answered Unit 5 Waves concept: ${answer.id}.`,
    directAnswer: answer.answer,
    aiAllowed: false
  };
}

function answerWaveConcept(text) {
  if (asksElectromagneticSpeed(text)) {
    return concept('em_wave_speed', 'All electromagnetic waves travel at 3 × 10^8 m/s, or 300,000,000 m/s, in a vacuum.');
  }

  if (asksVacuumWaveType(text)) {
    return concept('electromagnetic_waves_vacuum', 'Electromagnetic waves can transfer energy through a vacuum or empty space. Mechanical waves need a medium, but electromagnetic waves do not.');
  }

  if (asksAstronautsSeeNotHear(text)) {
    return concept('astronauts_see_not_hear', 'Astronauts can see each other because light is an electromagnetic wave and can travel through the vacuum of space. They cannot hear each other talking through space because sound is a mechanical wave and needs a medium or matter.');
  }

  if (asksAmplitudeMeaning(text)) {
    return definition('wave_amplitude', 'Amplitude is related to a wave’s energy. For sound waves, greater amplitude means louder sound; it does not change the wave speed.');
  }

  if (asksCrest(text)) {
    return definition('crest', 'The highest point of a transverse wave is the crest, or peak.');
  }

  if (asksTrough(text)) {
    return definition('trough', 'The lowest point of a transverse wave is the trough.');
  }

  if (asksCompression(text)) {
    return definition('compression', 'In a longitudinal wave, the place where particles are pushed together or crowded together is a compression.');
  }

  if (asksRarefaction(text)) {
    return definition('rarefaction', 'In a longitudinal wave, the place where particles are spread apart is a rarefaction.');
  }

  if (asksSoundWaveType(text)) {
    return definition('sound_wave_type', 'Sound is a longitudinal, or compressional, mechanical wave. It needs a medium such as a solid, liquid, or gas to travel.');
  }

  if (asksLongitudinalWave(text)) {
    return definition('longitudinal_wave', 'In a longitudinal wave, particles of the medium move parallel to the same direction the wave travels. Longitudinal waves are also called compressional waves because they have compressions and rarefactions.');
  }

  if (asksTransverseWavelength(text)) {
    return concept('transverse_wavelength_measurement', 'In a transverse wave, wavelength is measured from crest to crest or from trough to trough.');
  }

  if (asksLongitudinalWavelength(text)) {
    return concept('longitudinal_wavelength_measurement', 'In a longitudinal wave, wavelength is measured from compression to compression or from rarefaction to rarefaction.');
  }

  if (asksFrequencyPeriodRelationship(text)) {
    return concept('frequency_period_relationship', 'Frequency and period are inverse, or reciprocal, relationships. Period is T = 1/f, and frequency is f = 1/T.');
  }

  if (asksWavelengthFrequencyInverse(text)) {
    return concept('wavelength_frequency_inverse', 'As wavelength increases, frequency decreases when wave speed stays the same.');
  }

  if (asksHigherFrequencyWavelength(text)) {
    return concept('higher_frequency_shorter_wavelength', 'Higher frequency means a shorter wavelength when wave speed stays the same.');
  }

  if (asksSoundFastestSolid(text)) {
    return concept('sound_fastest_solid', 'Sound travels fastest through solids. The answer is solid because sound needs matter and particles are closest together in solids.');
  }

  if (asksWarmMediumSpeed(text)) {
    return concept('warm_medium_wave_speed', 'Mechanical waves travel faster through warmer mediums because the particles move faster and collide more often, passing the vibration along more quickly.');
  }

  if (asksLoudSoundSpeed(text)) {
    return concept('loudness_not_speed', 'No. Loud sounds do not travel faster than soft sounds in the same medium. Loudness or amplitude changes the wave’s energy, but wave speed depends mostly on the medium.');
  }

  if (asksPitchSoundSpeed(text)) {
    return concept('pitch_not_sound_speed', 'No. Pitch does not change sound speed in the same medium. Pitch is related to frequency, while sound speed depends mostly on the medium.');
  }

  if (asksReflectionAngle(text, 'reflection')) {
    const degrees = extractFirstNumber(text);
    return concept('angle_of_reflection', `The angle of reflection is ${degrees} degrees. By the law of reflection, the angle of reflection equals the angle of incidence.`);
  }

  if (asksReflectionAngle(text, 'incidence')) {
    const degrees = extractFirstNumber(text);
    return concept('angle_of_incidence', `The angle of incidence is ${degrees} degrees. By the law of reflection, the angle of incidence equals the angle of reflection.`);
  }

  if (asksNormalLine(text)) {
    return definition('normal_line', 'The normal line is an imaginary line drawn perpendicular, or at 90 degrees, to the reflecting surface.');
  }

  if (asksObjectWaterRefraction(text)) {
    return concept('object_water_refraction', 'Objects like a finger, straw, spoon, or pencil can look bent, crooked, or broken in water because of refraction. Light changes speed and bends as it moves between air and water, so the object appears shifted or distorted.');
  }

  if (asksRainbow(text)) {
    return concept('rainbow_refraction_dispersion', 'A rainbow is caused by refraction and dispersion of light. White light separates into colors because different wavelengths bend different amounts in water droplets.');
  }

  if (asksRadioDiffraction(text)) {
    return concept('radio_diffraction_long_wavelength', 'Radio waves diffract better than visible light because radio waves have longer wavelengths. Visible light has a shorter wavelength, so it bends around obstacles less.');
  }

  if (asksCarpetAbsorption(text)) {
    return concept('carpet_sound_absorption', 'Carpeted houses are quieter because carpet absorbs sound energy. Tile and hardwood reflect more sound, so rooms can sound louder.');
  }

  if (asksNoiseCanceling(text)) {
    return concept('noise_canceling_destructive_interference', 'Noise-canceling headphones use destructive interference. They make out-of-phase sound waves that overlap and cancel part of the noise.');
  }

  if (asksDestructiveInterference(text)) {
    return definition('destructive_interference', 'Destructive interference happens when opposite parts of waves line up and subtract or cancel. The resulting amplitude decreases.');
  }

  if (asksNode(text)) {
    return definition('node', 'A node is a point in a standing wave where the waves cancel, so there is no vibration.');
  }

  if (asksStandingWave(text)) {
    return definition('standing_wave', 'A standing wave forms when waves with equal wavelength and amplitude travel in opposite directions and continuously interfere. The pattern appears not to move.');
  }

  if (asksResonance(text)) {
    return definition('resonance', 'Resonance happens when an object vibrates at its natural frequency because another object is vibrating at the same frequency. A tuning fork can make another matching tuning fork vibrate.');
  }

  if (asksElectromagneticSpectrumOrder(text)) {
    return concept('em_spectrum_order', 'From longest wavelength and lowest frequency to shortest wavelength and highest frequency, the electromagnetic spectrum is: radio, microwave, infrared, visible light, ultraviolet, X-ray, gamma ray.');
  }

  if (asksGammaRays(text)) {
    return definition('gamma_rays', 'Gamma rays have the shortest wavelength, highest frequency, and very high energy. They are used to kill cancer cells, sterilize medical equipment, and in radioactive tracers, but they are dangerous because they can damage cells and break down molecules.');
  }

  if (asksDopplerEffect(text)) {
    return definition('doppler_effect', 'The Doppler effect is a change in observed frequency or pitch because a wave source is moving toward or away from an observer.');
  }

  if (asksApproachingSiren(text)) {
    return concept('approaching_siren_doppler', 'As a siren approaches, the waves are compressed. The wavelength gets shorter, with higher frequency and higher pitch.');
  }

  if (asksMovingAwaySiren(text)) {
    return concept('moving_away_siren_doppler', 'As a siren moves away, the waves spread out. The wavelength gets longer, with lower frequency and lower pitch.');
  }

  if (asksRedShirt(text)) {
    return concept('red_shirt_color', 'A red shirt appears red because it absorbs most colors of light and reflects red light to your eyes or retina.');
  }

  if (asksRodsCones(text)) {
    return definition('rods_and_cones', 'Rods help you see in low light and at night. Cones allow color vision and work best in bright light.');
  }

  if (asksConvexLens(text)) {
    return definition('convex_lens', 'A convex lens is a converging lens with a thicker middle. It bends light inward to a focal point, can correct far-sightedness, and is used for magnification, reading glasses, and magnifying glasses.');
  }

  if (asksConcaveLens(text)) {
    return definition('concave_lens', 'A concave lens is a diverging lens with thicker edges. It bends light outward, can correct near-sightedness, and is used in examples such as projectors, makeup mirrors, and dentist mirrors.');
  }

  if (asksAmplitudeLoudness(text)) {
    return concept('amplitude_loudness', 'Increasing the amplitude of a sound wave makes the sound louder. Greater amplitude means more wave energy.');
  }

  if (asksTransmitEnergy(text)) {
    return concept('waves_transmit_energy', 'X-rays, ultraviolet waves, and sound waves all transmit energy.');
  }

  if (asksSoundVacuum(text)) {
    return concept('sound_vacuum', 'No. Sound cannot travel through empty space or a vacuum because sound is a mechanical wave and needs a medium.');
  }

  if (asksGammaCellDamage(text)) {
    return concept('gamma_cell_damage', 'Gamma rays can break down molecules and damage cells because they have very high energy.');
  }

  if (asksMediumResistsWave(text)) {
    return concept('medium_resists_wave_absorption', 'When a medium or material resists a wave, some wave energy can be absorbed and converted into thermal energy or heat.');
  }

  if (asksWaveTankCurrent(text)) {
    return concept('wave_tank_water_current', 'In a wave tank, current means moving water, not electrical current. The water current can carry or move water waves.');
  }

  return null;
}

function concept(id, answer) {
  return { id, answer, type: 'science_concept' };
}

function definition(id, answer) {
  return { id, answer, type: 'definition' };
}

function asksVacuumWaveType(text) {
  return hasAll(text, ['wave', 'vacuum']) &&
    /\b(?:what|which|type|kind|transfer|through)\b/.test(text) &&
    !/\bsound\b/.test(text);
}

function asksElectromagneticSpeed(text) {
  return /\b(?:speed|fast)\b/.test(text) &&
    /\belectromagnetic\s+waves?\b/.test(text) &&
    /\bvacuum\b/.test(text);
}

function asksAstronautsSeeNotHear(text) {
  return /\bastronauts?\b/.test(text) &&
    /\bsee\b/.test(text) &&
    /\bhear\b/.test(text) &&
    /\bspace\b/.test(text);
}

function asksSoundWaveType(text) {
  return /\bsound\b/.test(text) &&
    /\b(?:what|which|type|kind)\b/.test(text) &&
    /\bwave\b/.test(text);
}

function asksAmplitudeMeaning(text) {
  return hasDefinitionIntent(text) &&
    /\bamplitude\b/.test(text) &&
    /\bwave|sound\b/.test(text);
}

function asksLongitudinalWave(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'longitudinal wave');
}

function asksCrest(text) {
  return /\bhighest\s+point\b/.test(text) && /\btransverse\s+wave\b/.test(text);
}

function asksTrough(text) {
  return /\blowest\s+point\b/.test(text) && /\btransverse\s+wave\b/.test(text);
}

function asksCompression(text) {
  return /\bparticles?\b/.test(text) &&
    /\bpushed\s+together|close together|crowded\b/.test(text) &&
    /\blongitudinal\s+wave\b/.test(text);
}

function asksRarefaction(text) {
  return /\bparticles?\b/.test(text) &&
    /\bspread\s+apart|farther apart\b/.test(text) &&
    /\blongitudinal\s+wave\b/.test(text);
}

function asksTransverseWavelength(text) {
  return /\bhow\b/.test(text) &&
    /\bwavelength\b/.test(text) &&
    /\bmeasured\b/.test(text) &&
    /\btransverse\s+wave\b/.test(text);
}

function asksLongitudinalWavelength(text) {
  return /\bhow\b/.test(text) &&
    /\bwavelength\b/.test(text) &&
    /\bmeasured\b/.test(text) &&
    /\blongitudinal\s+wave\b/.test(text);
}

function asksFrequencyPeriodRelationship(text) {
  return /\brelationship\s+between\b/.test(text) &&
    /\bfrequency\b/.test(text) &&
    /\bperiod\b/.test(text);
}

function asksWavelengthFrequencyInverse(text) {
  return /\bwavelength\b/.test(text) &&
    /\bincreases?\b/.test(text) &&
    /\bfrequency\b/.test(text);
}

function asksHigherFrequencyWavelength(text) {
  return /\bhigher\s+frequency\b/.test(text) &&
    /\bwavelength\b/.test(text);
}

function asksSoundFastestSolid(text) {
  return /\bsound\b/.test(text) &&
    /\bfastest\b/.test(text) &&
    /\bsolid\b/.test(text) &&
    /\bliquid\b/.test(text) &&
    /\bgas\b/.test(text);
}

function asksWarmMediumSpeed(text) {
  return /\bmechanical\s+waves?\b/.test(text) &&
    /\bfaster\b/.test(text) &&
    /\bwarmer\s+mediums?\b/.test(text);
}

function asksLoudSoundSpeed(text) {
  return /\bloud\s+sounds?\b/.test(text) &&
    /\bsoft\s+sounds?\b/.test(text) &&
    /\bfaster|speed\b/.test(text);
}

function asksPitchSoundSpeed(text) {
  return /\bpitch\b/.test(text) &&
    /\bsound\s+speed|speed\b/.test(text);
}

function looksLikeReflectionAnglePrompt(text) {
  return /\bangle\s+of\s+(?:incidence|reflection)\b/.test(text) &&
    /\b\d+(?:\.\d+)?\s*(?:degrees?|°)?\b/.test(text);
}

function asksReflectionAngle(text, target) {
  if (!looksLikeReflectionAnglePrompt(text)) return false;
  if (target === 'reflection') {
    return /\bangle\s+of\s+incidence\b/.test(text) &&
      /\bwhat\s+is\s+the\s+angle\s+of\s+reflection\b/.test(text);
  }
  return /\bangle\s+of\s+reflection\b/.test(text) &&
    /\bwhat\s+is\s+the\s+angle\s+of\s+incidence\b/.test(text);
}

function asksNormalLine(text) {
  return hasDefinitionIntent(text) && /\bnormal\s+line\b/.test(text);
}

function asksObjectWaterRefraction(text) {
  return /\bwater\b/.test(text) &&
    /\b(?:object|objects|thing|things|straw|straws|pencil|pencils|finger|fingers|spoon|spoons)\b/.test(text) &&
    /\b(?:look|looks|looked|appear|appears|appeared)\b/.test(text) &&
    /\b(?:bent|broken|crooked|crocket|shifted|distorted)\b/.test(text);
}

function asksRainbow(text) {
  return /\bwhat\s+causes?\s+a\s+rainbow\b/.test(text) || /\bwhy\b.*\brainbow\b/.test(text);
}

function asksRadioDiffraction(text) {
  return /\bradio\s+waves?\b/.test(text) &&
    /\bdiffract|diffraction\b/.test(text) &&
    /\bvisible\s+light\b/.test(text);
}

function asksCarpetAbsorption(text) {
  return /\bcarpet|carpeted\b/.test(text) &&
    /\bquieter|quiet|sound\b/.test(text) &&
    /\btile|hardwood\b/.test(text);
}

function asksNoiseCanceling(text) {
  return /\bnoise[-\s]?canceling\s+headphones?\b/.test(text) ||
    /\bnoise\s+canceling\b/.test(text);
}

function asksDestructiveInterference(text) {
  return hasDefinitionIntent(text) && /\bdestructive\s+interference\b/.test(text);
}

function asksStandingWave(text) {
  return hasDefinitionIntent(text) && /\bstanding\s+wave\b/.test(text);
}

function asksNode(text) {
  return hasDefinitionIntent(text) && /\bnode\b/.test(text) && /\bstanding\s+wave\b/.test(text);
}

function asksResonance(text) {
  return hasDefinitionIntent(text) && /\bresonance\b/.test(text) ||
    /\btuning\s+fork\b/.test(text) && /\bpiano\s+note\b/.test(text);
}

function asksElectromagneticSpectrumOrder(text) {
  return /\b(?:em|electromagnetic)\s+spectrum\b/.test(text) &&
    /\border\b/.test(text) &&
    /\blongest\s+wavelength\b/.test(text);
}

function asksGammaRays(text) {
  return /\bgamma\s+rays?\b/.test(text) &&
    /\bused\s+for|uses?\b/.test(text);
}

function asksDopplerEffect(text) {
  return hasDefinitionIntent(text) && /\bdoppler\s+effect\b/.test(text);
}

function asksApproachingSiren(text) {
  return /\bsiren\b/.test(text) &&
    /\bapproaches?|toward\b/.test(text) &&
    /\bwavelength\b/.test(text) &&
    /\bfrequency\b/.test(text) &&
    /\bpitch\b/.test(text);
}

function asksMovingAwaySiren(text) {
  return /\bsiren\b/.test(text) &&
    /\bmoves?\s+away|moving\s+away|away\b/.test(text) &&
    /\bwavelength\b/.test(text) &&
    /\bfrequency\b/.test(text) &&
    /\bpitch\b/.test(text);
}

function asksRedShirt(text) {
  return /\bred\s+shirt\b/.test(text) &&
    /\b(?:appear|appears|look|looks)\s+red\b/.test(text);
}

function asksRodsCones(text) {
  return (hasDefinitionIntent(text) || /\bwhat\s+do\b/.test(text)) &&
    /\brods?\b/.test(text) &&
    /\bcones?\b/.test(text);
}

function asksConvexLens(text) {
  return /\bconvex\s+lens\b/.test(text) && (hasDefinitionIntent(text) || /\bdescribe\b/.test(text));
}

function asksConcaveLens(text) {
  return /\bconcave\s+lens\b/.test(text) && (hasDefinitionIntent(text) || /\bdescribe\b/.test(text));
}

function asksAmplitudeLoudness(text) {
  return /\bincreasing\s+amplitude\b/.test(text) &&
    /\bsound\b/.test(text);
}

function asksTransmitEnergy(text) {
  return /\bx[-\s]?rays?\b/.test(text) &&
    /\buv\b|ultraviolet/.test(text) &&
    /\bsound\s+waves?\b/.test(text) &&
    /\btransmit\b/.test(text);
}

function asksSoundVacuum(text) {
  return /\bsound\b/.test(text) &&
    /\b(?:travel|through)\b/.test(text) &&
    /\bempty\s+space|vacuum\b/.test(text);
}

function asksGammaCellDamage(text) {
  return /\bwaves?\b/.test(text) &&
    /\bbreak\s+down\b/.test(text) &&
    /\bmolecules?\b/.test(text) &&
    /\bcells?\b/.test(text);
}

function asksMediumResistsWave(text) {
  return /\bmedium\b/.test(text) &&
    /\bresists?\b/.test(text) &&
    /\bwave\b/.test(text) &&
    /\benergy\b/.test(text);
}

function asksWaveTankCurrent(text) {
  return /\bwave\s+tank\b/.test(text) &&
    /\bcurrent\b/.test(text) &&
    /\bwater\s+waves?\b/.test(text);
}

function looksLikeWaveFormulaPrompt(text) {
  if (!hasNumber(text)) return false;
  return /\b(?:find|calculate|solve|determine|what\s+is)\b/.test(text) &&
    /\b(?:wave|waves|wavelength|frequency|period|hertz|hz|speed|velocity)\b/.test(text);
}

function hasDefinitionIntent(text) {
  return /\b(?:what\s+is|what\s+are|whats|define|describe|meaning|means?|called)\b/.test(text);
}

function extractFirstNumber(text) {
  const match = String(text || '').match(/\b\d+(?:\.\d+)?\b/);
  return match ? match[0] : '';
}

function hasAll(text, phrases) {
  return phrases.every((phrase) => hasPhrase(text, phrase));
}

function hasPhrase(text, phrase) {
  return String(text || '').includes(normalize(phrase));
}

function hasNumber(text) {
  return /\b\d+(?:\.\d+)?\b/.test(text);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9°\/\s.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { tryUnit5WavesKnowledge };
