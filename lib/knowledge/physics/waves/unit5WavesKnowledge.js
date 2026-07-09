const { buildUnit5WavesPacket } = require('./unit5WavesPacketAdapter');

const UNIT5_WAVE_FACTS = [
  waveFact('em_wave_speed', 'science_concept', 'electromagnetic wave speed', 'All electromagnetic waves travel at 3 × 10^8 m/s, or 300,000,000 m/s, in a vacuum.', { category: 'electromagnetic_spectrum', smokePrompt: 'What speed do all electromagnetic waves travel in a vacuum?' }),
  waveFact('electromagnetic_waves_vacuum', 'science_concept', 'electromagnetic waves', 'Electromagnetic waves can transfer energy through a vacuum or empty space. Mechanical waves need a medium, but electromagnetic waves do not.', { category: 'nature', smokePrompt: 'What type of wave can travel through a vacuum?' }),
  waveFact('astronauts_see_not_hear', 'science_concept', 'astronauts see but do not hear in space', 'Astronauts can see each other because light is an electromagnetic wave and can travel through the vacuum of space. They cannot hear each other talking through space because sound is a mechanical wave and needs a medium or matter.', { category: 'nature', examples: ['astronauts can see light in space but cannot hear sound through space'] }),
  waveFact('amplitude_wavelength_frequency_difference', 'science_concept', 'amplitude wavelength frequency difference', 'Amplitude is the height of a wave. Wavelength is the distance from one crest to the next crest or one trough to the next trough. Frequency is the number of waves that pass a point each second.', { category: 'properties', smokePrompt: 'What is the difference between amplitude, wavelength, and frequency?' }),
  waveFact('wave_amplitude_definition', 'definition', 'amplitude', 'Amplitude is the height of a wave, measured from the rest position to a crest or trough. Greater amplitude means more wave energy.', { category: 'properties', aliases: ['wave height'], smokePrompt: 'What is amplitude in waves?' }),
  waveFact('wavelength', 'definition', 'wavelength', 'Wavelength is the distance from one crest to the next crest or from one trough to the next trough.', { category: 'properties', aliases: ['crest-to-crest distance'], smokePrompt: 'What is wavelength?' }),
  waveFact('frequency', 'definition', 'frequency', 'Frequency is the number of waves that pass a point each second. It is measured in hertz, or Hz.', { category: 'properties', aliases: ['hertz', 'Hz'], smokePrompt: 'What is frequency in waves?' }),
  waveFact('period', 'definition', 'period', 'Period is the time for one wave, one cycle, or one wavelength to pass a point. Period is measured in seconds, or s.', { category: 'properties', smokePrompt: 'What is period in waves?' }),
  waveFact('wave_speed_definition', 'definition', 'wave speed', 'Wave speed tells how fast a wave travels. Wave speed is related to frequency and wavelength by v = wavelength × frequency, or v = f × λ.', { category: 'properties', aliases: ['speed of a wave'], smokePrompt: 'What is wave speed?' }),
  waveFact('wave_amplitude', 'definition', 'wave amplitude', 'Amplitude is related to a wave’s energy. For sound waves, greater amplitude means louder sound; it does not change the wave speed.', { category: 'properties', aliases: ['loudness'] }),
  waveFact('crest', 'definition', 'crest', 'The highest point of a transverse wave is the crest, or peak.', { category: 'properties', aliases: ['peak'] }),
  waveFact('trough', 'definition', 'trough', 'The lowest point of a transverse wave is the trough.', { category: 'properties' }),
  waveFact('compression', 'definition', 'compression', 'In a longitudinal wave, the place where particles are pushed together or crowded together is a compression.', { category: 'properties' }),
  waveFact('rarefaction', 'definition', 'rarefaction', 'In a longitudinal wave, the place where particles are spread apart is a rarefaction.', { category: 'properties' }),
  waveFact('sound_wave_type', 'definition', 'sound wave', 'Sound is a longitudinal, or compressional, mechanical wave. It needs a medium such as a solid, liquid, or gas to travel.', { category: 'nature', aliases: ['compressional wave'], examples: ['sound is a longitudinal mechanical wave'] }),
  waveFact('longitudinal_wave', 'definition', 'longitudinal wave', 'In a longitudinal wave, particles of the medium move parallel to the same direction the wave travels. Longitudinal waves are also called compressional waves because they have compressions and rarefactions.', { category: 'nature', aliases: ['compressional wave'], smokePrompt: 'What is a longitudinal wave?' }),
  waveFact('transverse_wavelength_measurement', 'science_concept', 'transverse wave wavelength', 'In a transverse wave, wavelength is measured from crest to crest or from trough to trough.', { category: 'properties', aliases: ['transverse wave'], smokePrompt: 'How is wavelength measured in a transverse wave?' }),
  waveFact('longitudinal_wavelength_measurement', 'science_concept', 'longitudinal wave wavelength', 'In a longitudinal wave, wavelength is measured from compression to compression or from rarefaction to rarefaction.', { category: 'properties' }),
  waveFact('frequency_period_relationship', 'science_concept', 'frequency period relationship', 'Frequency and period are inverse, or reciprocal, relationships. Period is T = 1/f, and frequency is f = 1/T.', { category: 'properties', smokePrompt: 'What is the relationship between frequency and period?' }),
  waveFact('wavelength_frequency_inverse', 'science_concept', 'wavelength frequency relationship', 'As wavelength increases, frequency decreases when wave speed stays the same.', { category: 'properties', smokePrompt: 'How are wavelength and frequency related?' }),
  waveFact('higher_frequency_shorter_wavelength', 'science_concept', 'higher frequency shorter wavelength', 'Higher frequency means a shorter wavelength when wave speed stays the same.', { category: 'properties' }),
  waveFact('sound_fastest_solid', 'science_concept', 'sound fastest in solids', 'Sound travels fastest through solids. The answer is solid because sound needs matter and particles are closest together in solids.', { category: 'sound_light_color' }),
  waveFact('warm_medium_wave_speed', 'science_concept', 'warm medium wave speed', 'Mechanical waves travel faster through warmer mediums because the particles move faster and collide more often, passing the vibration along more quickly.', { category: 'properties' }),
  waveFact('loudness_not_speed', 'science_concept', 'loudness does not change sound speed', 'No. Loud sounds do not travel faster than soft sounds in the same medium. Loudness or amplitude changes the wave’s energy, but wave speed depends mostly on the medium.', { category: 'properties' }),
  waveFact('pitch_not_sound_speed', 'science_concept', 'pitch does not change sound speed', 'No. Pitch does not change sound speed in the same medium. Pitch is related to frequency, while sound speed depends mostly on the medium.', { category: 'properties' }),
  waveFact('reflection_refraction_absorption_difference', 'science_concept', 'reflection refraction absorption difference', 'Reflection is when a wave or light bounces off a surface. Refraction is when it bends as it changes speed in a new material. Absorption is when a material takes in wave or light energy, often converting it to thermal energy.', { category: 'behaviors', smokePrompt: 'What is the difference between reflection, refraction, and absorption?' }),
  waveFact('law_of_reflection', 'definition', 'law of reflection', 'The law of reflection says the angle of incidence equals the angle of reflection.', { category: 'behaviors' }),
  waveFact('reflection', 'definition', 'reflection', 'Reflection happens when a wave or light strikes a surface and bounces off.', { category: 'behaviors', aliases: ['bounce'], smokePrompt: 'What happens when a wave reflects?' }),
  waveFact('refraction', 'definition', 'refraction', 'Refraction happens when a wave or light changes speed and bends as it enters a different material.', { category: 'behaviors', aliases: ['bending'], smokePrompt: 'What is refraction?' }),
  waveFact('absorption', 'definition', 'absorption', 'Absorption happens when wave or light energy is taken in by a material and can be converted to thermal energy.', { category: 'behaviors', smokePrompt: 'Absorption means what in waves?' }),
  waveFact('light', 'definition', 'light', 'Light is visible electromagnetic energy that travels as a wave and can move through empty space.', { category: 'electromagnetic_spectrum', aliases: ['visible light'], smokePrompt: 'What is light?' }),
  waveFact('normal_line', 'definition', 'normal line', 'The normal line is an imaginary line drawn perpendicular, or at 90 degrees, to the reflecting surface.', { category: 'behaviors' }),
  waveFact('object_water_refraction', 'science_concept', 'objects look bent in water', 'Objects like a finger, straw, spoon, or pencil can look bent, crooked, or broken in water because of refraction. Light changes speed and bends as it moves between air and water, so the object appears shifted or distorted.', { category: 'behaviors', examples: ['a pencil can look broken in water because of refraction'] }),
  waveFact('rainbow_refraction_dispersion', 'science_concept', 'rainbow refraction dispersion', 'A rainbow is caused by refraction and dispersion of light. White light separates into colors because different wavelengths bend different amounts in water droplets.', { category: 'behaviors', examples: ['a rainbow forms when white light separates into colors'] }),
  waveFact('radio_diffraction_long_wavelength', 'science_concept', 'radio wave diffraction', 'Radio waves diffract better than visible light because radio waves have longer wavelengths. Visible light has a shorter wavelength, so it bends around obstacles less.', { category: 'behaviors', smokePrompt: 'Why do radio waves diffract better than visible light?' }),
  waveFact('carpet_sound_absorption', 'science_concept', 'carpet sound absorption', 'Carpeted houses are quieter because carpet absorbs sound energy. Tile and hardwood reflect more sound, so rooms can sound louder.', { category: 'behaviors', examples: ['carpet absorbs sound energy'] }),
  waveFact('noise_canceling_destructive_interference', 'science_concept', 'noise canceling destructive interference', 'Noise-canceling headphones use destructive interference. They make out-of-phase sound waves that overlap and cancel part of the noise.', { category: 'behaviors', examples: ['noise-canceling headphones use destructive interference'] }),
  waveFact('destructive_interference', 'definition', 'destructive interference', 'Destructive interference happens when opposite parts of waves line up and subtract or cancel. The resulting amplitude decreases.', { category: 'behaviors' }),
  waveFact('node', 'definition', 'node', 'A node is a point in a standing wave where the waves cancel, so there is no vibration.', { category: 'behaviors' }),
  waveFact('standing_wave', 'definition', 'standing wave', 'A standing wave forms when waves with equal wavelength and amplitude travel in opposite directions and continuously interfere. The pattern appears not to move.', { category: 'behaviors' }),
  waveFact('resonance', 'definition', 'resonance', 'Resonance happens when an object vibrates at its natural frequency because another object is vibrating at the same frequency. A tuning fork can make another matching tuning fork vibrate.', { category: 'behaviors', examples: ['a tuning fork can make another matching tuning fork vibrate'] }),
  waveFact('em_spectrum_order', 'science_concept', 'electromagnetic spectrum order', 'From longest wavelength and lowest frequency to shortest wavelength and highest frequency, the electromagnetic spectrum is: radio, microwave, infrared, visible light, ultraviolet, X-ray, gamma ray.', { category: 'electromagnetic_spectrum', smokePrompt: 'Put the electromagnetic spectrum in order from longest wavelength to highest frequency.' }),
  waveFact('gamma_rays', 'definition', 'gamma rays', 'Gamma rays have the shortest wavelength, highest frequency, and very high energy. They are used to kill cancer cells, sterilize medical equipment, and in radioactive tracers, but they are dangerous because they can damage cells and break down molecules.', { category: 'electromagnetic_spectrum' }),
  waveFact('doppler_effect', 'definition', 'Doppler effect', 'The Doppler effect is a change in observed frequency or pitch because a wave source is moving toward or away from an observer.', { category: 'sound_light_color' }),
  waveFact('approaching_siren_doppler', 'science_concept', 'approaching siren Doppler effect', 'As a siren approaches, the waves are compressed. The wavelength gets shorter, with higher frequency and higher pitch.', { category: 'sound_light_color', examples: ['an approaching siren has higher pitch'] }),
  waveFact('moving_away_siren_doppler', 'science_concept', 'moving away siren Doppler effect', 'As a siren moves away, the waves spread out. The wavelength gets longer, with lower frequency and lower pitch.', { category: 'sound_light_color', examples: ['a siren moving away has lower pitch'] }),
  waveFact('red_shirt_color', 'science_concept', 'red shirt color', 'A red shirt appears red because it absorbs most colors of light and reflects red light to your eyes or retina.', { category: 'sound_light_color' }),
  waveFact('rods_and_cones', 'definition', 'rods and cones', 'Rods help you see in low light and at night. Cones allow color vision and work best in bright light.', { category: 'sound_light_color' }),
  waveFact('convex_lens', 'definition', 'convex lens', 'A convex lens is a converging lens with a thicker middle. It bends light inward to a focal point, can correct far-sightedness, and is used for magnification, reading glasses, and magnifying glasses.', { category: 'sound_light_color' }),
  waveFact('concave_lens', 'definition', 'concave lens', 'A concave lens is a diverging lens with thicker edges. It bends light outward, can correct near-sightedness, and is used in examples such as projectors, makeup mirrors, and dentist mirrors.', { category: 'sound_light_color' }),
  waveFact('amplitude_loudness', 'science_concept', 'amplitude loudness', 'Increasing the amplitude of a sound wave makes the sound louder. Greater amplitude means more wave energy.', { category: 'properties' }),
  waveFact('waves_transmit_energy', 'science_concept', 'waves transmit energy', 'X-rays, ultraviolet waves, and sound waves all transmit energy.', { category: 'nature' }),
  waveFact('sound_vacuum', 'science_concept', 'sound in vacuum', 'No. Sound cannot travel through empty space or a vacuum because sound is a mechanical wave and needs a medium.', { category: 'nature', smokePrompt: 'Can sound travel through empty space or a vacuum?' }),
  waveFact('gamma_cell_damage', 'science_concept', 'gamma rays cell damage', 'Gamma rays can break down molecules and damage cells because they have very high energy.', { category: 'electromagnetic_spectrum' }),
  waveFact('medium_resists_wave_absorption', 'science_concept', 'medium resists wave absorption', 'When a medium or material resists a wave, some wave energy can be absorbed and converted into thermal energy or heat.', { category: 'behaviors' }),
  waveFact('wave_tank_water_current', 'science_concept', 'wave tank water current', 'In a wave tank, current means moving water, not electrical current. The water current can carry or move water waves.', { category: 'nature' }),
  waveFact('light_longitudinal_electromagnetic_mixed_classification', 'science_concept', 'light longitudinal electromagnetic classification', 'Those choices come from different classification systems. Light is electromagnetic because it can travel through empty space, and it is not longitudinal; light is typically described as transverse.', { category: 'nature' }),
  waveFact('light_transverse_electromagnetic_mixed_classification', 'science_concept', 'light transverse electromagnetic classification', 'Those choices come from different classification systems. Light is electromagnetic because it can travel through empty space, and it is also usually described as transverse.', { category: 'nature' }),
  waveFact('sound_transverse_mechanical_mixed_classification', 'science_concept', 'sound transverse mechanical classification', 'Those choices come from different classification systems. Sound is mechanical because it needs a medium, and it is not transverse; sound is longitudinal because matter vibrates back and forth parallel to the direction the wave travels.', { category: 'nature' }),
  waveFact('sound_longitudinal_mechanical_mixed_classification', 'science_concept', 'sound longitudinal mechanical classification', 'Those choices come from different classification systems. Sound is mechanical because it needs a medium, and it is longitudinal because matter vibrates back and forth parallel to the direction the wave travels.', { category: 'nature' }),
  waveFact('water_longitudinal_mechanical_mixed_classification', 'science_concept', 'water longitudinal mechanical classification', 'Those choices come from different classification systems. Mechanical tells whether the wave needs a medium. Longitudinal tells how the matter moves. A water wave is mechanical, and surface water waves are often taught as transverse rather than purely longitudinal.', { category: 'nature' }),
  waveFact('water_transverse_mechanical_mixed_classification', 'science_concept', 'water transverse mechanical classification', 'Those choices come from different classification systems. A water wave is mechanical because it needs a medium, and surface water waves are often taught as transverse.', { category: 'nature' }),
  waveFact('light_wave_type', 'science_concept', 'light wave type', 'Light is an electromagnetic wave because it can travel through empty space. Light is also usually described as a transverse wave.', { category: 'nature', aliases: ['light as a wave'] }),
  waveFact('sound_wave_type_broad', 'science_concept', 'sound wave type', 'Sound is a mechanical wave because it needs a medium. It is also longitudinal because matter vibrates back and forth parallel to the direction the wave travels.', { category: 'nature' }),
  waveFact('water_wave_type', 'science_concept', 'water wave type', 'A water wave is mechanical because it needs water as a medium. Surface water waves are often taught as transverse, though real water-wave motion is more complex.', { category: 'nature' }),
  waveFact('radio_wave_type', 'science_concept', 'radio wave type', 'A radio wave is electromagnetic because it can travel through empty space.', { category: 'nature' }),
  waveFact('microwave_wave_type', 'science_concept', 'microwave wave type', 'A microwave is electromagnetic because it can travel through empty space.', { category: 'nature' }),
  waveFact('seismic_wave_type', 'science_concept', 'seismic wave type', 'A seismic wave is mechanical because it needs a medium such as rock or Earth materials to travel through.', { category: 'nature' }),
  waveFact('rope_wave_type', 'science_concept', 'rope wave type', 'A wave on a rope is mechanical because it needs the rope as a medium, and it is typically transverse.', { category: 'nature' })
];

const UNIT5_WAVES_PACKET = buildUnit5WavesPacket({
  facts: UNIT5_WAVE_FACTS,
  matcherName: 'tryUnit5WavesKnowledge'
});
const PACKET_FACTS_BY_ID = new Map(UNIT5_WAVES_PACKET.canonicalFacts.map((fact) => [fact.id, fact]));

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
  const mixedClassificationAnswer = answerMixedWaveClassificationQuestion(text);
  if (mixedClassificationAnswer) return mixedClassificationAnswer;

  if (asksTransverseLongitudinalDifference(text)) {
    return {
      id: 'transverse_longitudinal_difference',
      answer: 'Transverse and longitudinal waves are different in how particles move. In a transverse wave, particles move perpendicular, or at right angles, to the direction the wave travels. In a longitudinal wave, particles move parallel to the direction the wave travels.',
      type: 'definition'
    };
  }

  const waveTypeAnswer = answerSpecificWaveTypeQuestion(text);
  if (waveTypeAnswer) return waveTypeAnswer;

  if (asksElectromagneticSpeed(text)) {
    return concept('em_wave_speed', 'The speed of light is about 3.0 × 10^8 m/s, or 300,000,000 m/s, in a vacuum.');
  }

  if (asksWaveSpeedDefinition(text)) {
    return definition('wave_speed_definition');
  }

  if (asksVacuumWaveType(text)) {
    return concept('electromagnetic_waves_vacuum');
  }

  if (asksAstronautsSeeNotHear(text)) {
    return concept('astronauts_see_not_hear');
  }

  if (asksAmplitudeWavelengthFrequencyDifference(text)) {
    return concept('amplitude_wavelength_frequency_difference');
  }

  if (asksAmplitudeDefinition(text)) {
    return definition('wave_amplitude_definition');
  }

  if (asksWavelengthDefinition(text)) {
    return definition('wavelength');
  }

  if (asksFrequencyDefinition(text)) {
    return definition('frequency');
  }

  if (asksPeriodDefinition(text)) {
    return definition('period');
  }

  if (asksAmplitudeMeaning(text)) {
    return definition('wave_amplitude');
  }

  if (asksCrest(text)) {
    return definition('crest');
  }

  if (asksTrough(text)) {
    return definition('trough');
  }

  if (asksCompression(text)) {
    return definition('compression');
  }

  if (asksRarefaction(text)) {
    return definition('rarefaction');
  }

  if (asksSoundWaveType(text)) {
    return definition('sound_wave_type');
  }

  if (asksLongitudinalWave(text)) {
    return definition('longitudinal_wave');
  }

  if (asksTransverseWavelength(text)) {
    return concept('transverse_wavelength_measurement');
  }

  if (asksLongitudinalWavelength(text)) {
    return concept('longitudinal_wavelength_measurement');
  }

  if (asksFrequencyPeriodRelationship(text)) {
    return concept('frequency_period_relationship');
  }

  if (asksWaveSpeedFrequencyWavelengthRelationship(text)) {
    return {
      id: 'wave_speed_frequency_wavelength_relationship',
      answer: 'Wave speed, frequency, and wavelength are related by v = f × λ. If wave speed stays the same, higher frequency means shorter wavelength.',
      type: 'science_concept'
    };
  }

  if (asksWavelengthFrequencyInverse(text)) {
    return {
      id: 'wavelength_frequency_inverse',
      answer: 'Frequency and wavelength have an inverse relationship. Higher frequency means shorter wavelength. Lower frequency means longer wavelength.',
      type: 'class_fact'
    };
  }

  if (asksHigherFrequencyWavelength(text)) {
    return concept('higher_frequency_shorter_wavelength');
  }

  if (asksSoundFastestSolid(text)) {
    return concept('sound_fastest_solid');
  }

  if (asksWarmMediumSpeed(text)) {
    return concept('warm_medium_wave_speed');
  }

  if (asksLoudSoundSpeed(text)) {
    return concept('loudness_not_speed');
  }

  if (asksPitchSoundSpeed(text)) {
    return concept('pitch_not_sound_speed');
  }

  if (asksReflectionRefractionAbsorptionDifference(text)) {
    return concept('reflection_refraction_absorption_difference');
  }

  if (asksLawOfReflection(text)) {
    return definition('law_of_reflection');
  }

  if (asksReflectionDefinition(text)) {
    return definition('reflection');
  }

  if (asksRefractionDefinition(text)) {
    return definition('refraction');
  }

  if (asksAbsorptionDefinition(text)) {
    return definition('absorption');
  }

  if (asksLightDefinition(text)) {
    return definition('light');
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
    return definition('normal_line');
  }

  if (asksObjectWaterRefraction(text)) {
    return concept('object_water_refraction');
  }

  if (asksRainbow(text)) {
    return concept('rainbow_refraction_dispersion');
  }

  if (asksRadioDiffraction(text)) {
    return concept('radio_diffraction_long_wavelength');
  }

  if (asksCarpetAbsorption(text)) {
    return concept('carpet_sound_absorption');
  }

  if (asksNoiseCanceling(text)) {
    return concept('noise_canceling_destructive_interference');
  }

  if (asksDestructiveInterference(text)) {
    return definition('destructive_interference');
  }

  if (asksNode(text)) {
    return definition('node');
  }

  if (asksStandingWave(text)) {
    return definition('standing_wave');
  }

  if (asksResonance(text)) {
    return definition('resonance');
  }

  if (asksElectromagneticSpectrumOrder(text)) {
    return concept('em_spectrum_order');
  }

  if (asksMicrowaveUses(text)) {
    return concept('microwave_uses', 'Microwaves are the electromagnetic radiation used for cooking, Doppler radar, GPS, and mobile phone signals.');
  }

  if (asksGammaRays(text)) {
    return definition('gamma_rays');
  }

  if (asksDopplerEffect(text)) {
    return definition('doppler_effect');
  }

  if (asksApproachingSiren(text)) {
    return concept('approaching_siren_doppler');
  }

  if (asksMovingAwaySiren(text)) {
    return concept('moving_away_siren_doppler');
  }

  if (asksRedShirt(text)) {
    return concept('red_shirt_color');
  }

  if (asksRodsCones(text)) {
    return definition('rods_and_cones');
  }

  if (asksConvexLens(text)) {
    return definition('convex_lens');
  }

  if (asksConcaveLens(text)) {
    return definition('concave_lens');
  }

  if (asksAmplitudeLoudness(text)) {
    return concept('amplitude_loudness');
  }

  if (asksTransmitEnergy(text)) {
    return concept('waves_transmit_energy');
  }

  if (asksSoundVacuum(text)) {
    return concept('sound_vacuum');
  }

  if (asksGammaCellDamage(text)) {
    return concept('gamma_cell_damage');
  }

  if (asksMediumResistsWave(text)) {
    return concept('medium_resists_wave_absorption');
  }

  if (asksWaveTankCurrent(text)) {
    return concept('wave_tank_water_current');
  }

  return null;
}

function waveFact(id, type, term, answer, options = {}) {
  return {
    id,
    type,
    term,
    answer,
    category: options.category || 'waves',
    aliases: options.aliases || [],
    examples: options.examples || [],
    sourceRefs: [],
    smokePrompt: options.smokePrompt || ''
  };
}

function concept(id, answer) {
  if (answer !== undefined) return { id, answer, type: 'science_concept' };
  return answerFromPacket(id, 'science_concept');
}

function definition(id, answer) {
  if (answer !== undefined) return { id, answer, type: 'definition' };
  return answerFromPacket(id, 'definition');
}

function answerFromPacket(id, fallbackType) {
  const fact = PACKET_FACTS_BY_ID.get(id);
  if (!fact) {
    throw new Error(`Missing Unit 5 Waves packet fact: ${id}`);
  }
  return {
    id,
    answer: fact.answer,
    type: fact.type || fallbackType
  };
}

function answerMixedWaveClassificationQuestion(text) {
  if (!hasMixedWaveClassificationPair(text)) return null;

  if (/\blight\b/.test(text)) {
    if (/\blongitudinal\b/.test(text)) {
      return concept('light_longitudinal_electromagnetic_mixed_classification');
    }
    return concept('light_transverse_electromagnetic_mixed_classification');
  }

  if (/\bsound\b/.test(text)) {
    if (/\btransverse\b/.test(text)) {
      return concept('sound_transverse_mechanical_mixed_classification');
    }
    return concept('sound_longitudinal_mechanical_mixed_classification');
  }

  if (/\bwater\s+waves?\b/.test(text)) {
    if (/\blongitudinal\b/.test(text)) {
      return concept('water_longitudinal_mechanical_mixed_classification');
    }
    return concept('water_transverse_mechanical_mixed_classification');
  }

  return null;
}

function answerSpecificWaveTypeQuestion(text) {
  if (!asksSpecificWaveTypeQuestion(text)) return null;

  if (/\blight\b/.test(text)) {
    return concept('light_wave_type');
  }

  if (/\bsound\b/.test(text)) {
    return concept('sound_wave_type_broad');
  }

  if (/\bwater\s+waves?\b/.test(text) || /\bwhat\s+(?:type|kind)\s+of\s+wave\s+is\s+water\b/.test(text)) {
    return concept('water_wave_type');
  }

  if (/\bradio\s+waves?\b/.test(text)) {
    return concept('radio_wave_type');
  }

  if (/\bmicrowaves?\b/.test(text)) {
    return concept('microwave_wave_type');
  }

  if (/\bseismic\s+waves?\b/.test(text)) {
    return concept('seismic_wave_type');
  }

  if (/\bwave\s+on\s+a\s+rope\b|\brope\s+waves?\b/.test(text)) {
    return concept('rope_wave_type');
  }

  return null;
}

function hasMixedWaveClassificationPair(text) {
  return /\b(?:longitudinal|transverse)\s+or\s+(?:mechanical|electromagnetic)\b/.test(text) ||
    /\b(?:mechanical|electromagnetic)\s+or\s+(?:longitudinal|transverse)\b/.test(text);
}

function asksSpecificWaveTypeQuestion(text) {
  if (!/\bwave\b/.test(text)) return false;
  const mentionsSpecificWave = /\blight\b|\bsound\b|\bwater\b|\bradio\s+waves?\b|\bmicrowaves?\b|\bseismic\s+waves?\b|\bwave\s+on\s+a\s+rope\b|\brope\s+waves?\b/.test(text);
  if (!mentionsSpecificWave) return false;

  return /\bwhat\s+(?:type|kind)\s+of\s+wave\b/.test(text) ||
    /\bis\s+(?:light|sound)\s+a\s+wave\b/.test(text) ||
    /\bis\s+(?:light|sound)\s+a\s+mechanical\s+or\s+electromagnetic\s+wave\b/.test(text) ||
    /\bis\s+(?:a\s+)?water\s+wave\s+mechanical\s+or\s+electromagnetic\b/.test(text);
}

function asksVacuumWaveType(text) {
  return hasAll(text, ['wave', 'vacuum']) &&
    /\b(?:what|which|type|kind|transfer|through)\b/.test(text) &&
    !/\bsound\b/.test(text);
}

function asksElectromagneticSpeed(text) {
  return /\bspeed\s+of\s+light\b/.test(text) ||
    /\b(?:speed|fast)\b/.test(text) &&
      /\belectromagnetic\s+waves?\b/.test(text) &&
      /\bvacuum\b/.test(text);
}

function asksWaveSpeedDefinition(text) {
  return hasDefinitionIntent(text) && /\bwave\s+speed\b/.test(text);
}

function asksAstronautsSeeNotHear(text) {
  return /\bastronauts?\b/.test(text) &&
    /\bsee\b/.test(text) &&
    /\bhear\b/.test(text) &&
    /\bspace\b/.test(text);
}

function asksAmplitudeWavelengthFrequencyDifference(text) {
  return /\bamplitude\b/.test(text) &&
    /\bwavelength\b/.test(text) &&
    /\bfrequency\b/.test(text) &&
    /\b(?:difference|different|vs|versus|compare|explain)\b/.test(text);
}

function asksTransverseLongitudinalDifference(text) {
  return /\btransverse\b/.test(text) &&
    /\blongitudinal\b/.test(text) &&
    /\b(?:difference|different|vs|versus|compare|explain)\b/.test(text);
}

function asksAmplitudeDefinition(text) {
  return hasDefinitionIntent(text) && /\bamplitude\b/.test(text);
}

function asksWavelengthDefinition(text) {
  return hasDefinitionIntent(text) &&
    /\bwavelength\b/.test(text) &&
    !/\bhigher\s+frequency\b/.test(text) &&
    !/\bfrequency\b/.test(text);
}

function asksFrequencyDefinition(text) {
  return hasDefinitionIntent(text) &&
    /\bfrequency\b/.test(text) &&
    !/\bperiod\b/.test(text) &&
    !/\bwavelength\b/.test(text) &&
    !/\brelationship\b/.test(text);
}

function asksPeriodDefinition(text) {
  return hasDefinitionIntent(text) &&
    /\bperiod\b/.test(text) &&
    /\bwaves?\b/.test(text);
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

function asksWaveSpeedFrequencyWavelengthRelationship(text) {
  return /\bwave\s+speed\b/.test(text) &&
    /\bfrequency\b/.test(text) &&
    /\bwavelength\b/.test(text) &&
    /\b(?:related|relationship)\b/.test(text);
}

function asksWavelengthFrequencyInverse(text) {
  return /\bwavelength\b/.test(text) &&
    /\bfrequency\b/.test(text) &&
    (/\bincreases?\b/.test(text) || /\b(?:related|relationship)\b/.test(text));
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

function asksReflectionRefractionAbsorptionDifference(text) {
  return /\breflection\b/.test(text) &&
    /\brefraction\b/.test(text) &&
    /\babsorption\b/.test(text) &&
    /\b(?:difference|different|vs|versus|compare|explain)\b/.test(text);
}

function asksReflectionDefinition(text) {
  return (hasDefinitionIntent(text) || /\bwhat\s+happens\b/.test(text)) &&
    /\b(?:reflection|reflects?|reflected)\b/.test(text) &&
    !/\bangle\s+of\s+(?:incidence|reflection)\b/.test(text) &&
    !/\blaw\s+of\s+reflection\b/.test(text);
}

function asksRefractionDefinition(text) {
  return hasDefinitionIntent(text) && /\brefraction\b/.test(text);
}

function asksAbsorptionDefinition(text) {
  return hasDefinitionIntent(text) && /\babsorption\b/.test(text);
}

function asksLightDefinition(text) {
  return hasDefinitionIntent(text) &&
    !/\blight\s+energy\b/.test(text) &&
    (/^what\s+is\s+light\b/.test(text) || /^define\s+light\b/.test(text));
}

function asksLawOfReflection(text) {
  return /\blaw\s+of\s+reflection\b/.test(text);
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

function asksMicrowaveUses(text) {
  return /\b(?:em|electromagnetic)\s+radiation\b/.test(text) &&
    /\b(?:cooking|doppler|radar|gps|mobile phone|signals?)\b/.test(text);
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

module.exports = {
  tryUnit5WavesKnowledge,
  UNIT5_WAVE_FACTS,
  UNIT5_WAVES_PACKET
};
