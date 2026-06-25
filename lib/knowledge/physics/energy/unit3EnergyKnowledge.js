function tryUnit3EnergyKnowledge(message) {
  const text = normalize(message);
  if (!text) return null;
  if (looksLikeNumericFormulaPrompt(text) && !allowsConceptualNumericEnergyPrompt(text)) return null;

  const answer = answerEnergyConcept(text);
  if (!answer) return null;

  return {
    type: answer.type || 'science_concept',
    confidence: 'strong',
    toolsUsed: ['unit3_energy_knowledge'],
    notes: `Answered Unit 3 Energy concept: ${answer.id}.`,
    directAnswer: answer.answer,
    aiAllowed: false
  };
}

function answerEnergyConcept(text) {
  if (asksSwingingBatPoint(text)) {
    return concept('swinging_bat_kinetic_energy_point', 'For a swinging bat, I would need the diagram or point labels to name a specific point. In general, kinetic energy is greatest where speed is greatest; on a rotating bat, points farther from the hands, near the tip, usually move fastest.');
  }

  if (asksRollerCoasterGreatestPotentialEnergy(text)) {
    return concept('roller_coaster_greatest_potential_energy', 'A roller coaster has the greatest gravitational potential energy at the highest point, usually the top of the hill.');
  }

  if (asksRollerCoasterTopEnergy(text)) {
    return concept('roller_coaster_top_potential_energy', 'At the top of a hill, a roller coaster has more gravitational potential energy because it is highest above the ground. Kinetic energy increases later when the coaster moves faster lower on the track.');
  }

  if (asksFallingObjectEnergyChange(text)) {
    return concept('falling_object_energy_change', 'As an object falls, gravitational potential energy, or GPE, decreases because height decreases. Kinetic energy, or KE, increases because the object speeds up.');
  }

  if (asksBouncingBallEnergyLoss(text)) {
    return concept('bouncing_ball_energy_transfer', 'When a bouncing ball stops, the energy is not destroyed or gone. It is converted or transferred into other forms, especially thermal energy, sound, and energy transferred to the ground and air.');
  }

  if (asksColdFlowOrIceHand(text)) {
    return concept('cold_does_not_flow', 'Cold does not flow from the ice into your hand. Heat transfers from the warmer hand to the colder ice, so your hand loses thermal energy and feels cold.');
  }

  if (asksSunSolarPanelHeatTransfer(text)) {
    return definition('radiation_sun_to_solar_panel', 'That heat transfer is radiation. Energy from the Sun travels by electromagnetic waves, which can move through space to the solar panel.');
  }

  if (asksLiquidsGasesHeatTransfer(text)) {
    return definition('convection_liquids_gases', 'That heat transfer is convection. Convection transfers heat by movement of heated particles in liquids and gases.');
  }

  if (asksPotentialEnergyTypes(text)) {
    return definition('potential_energy_types', 'The three classroom types of potential energy are gravitational potential energy, elastic potential energy, and chemical potential energy.');
  }

  if (asksConservationOfEnergy(text)) {
    return definition('law_conservation_energy', 'The law of conservation of energy says energy cannot be created and cannot be destroyed. Energy only changes forms or is transferred.');
  }

  if (asksMechanicalEnergy(text)) {
    return definition('mechanical_energy', 'Mechanical energy is the total kinetic energy plus potential energy in a system: mechanical energy = KE + PE.');
  }

  if (asksEnergyDefinition(text)) {
    return definition('energy_definition', 'Energy is the ability to cause change. Energy is measured in joules, written J.');
  }

  if (asksPotentialEnergyDefinition(text)) {
    return definition('potential_energy', 'Potential energy is stored energy. Examples include gravitational potential energy, elastic potential energy, and chemical potential energy.');
  }

  if (asksElasticPotentialEnergy(text)) {
    return definition('elastic_potential_energy', 'Elastic potential energy is stored in objects that are stretched or compressed, such as a spring, bow and arrow, or slingshot.');
  }

  if (asksChemicalPotentialEnergy(text)) {
    return definition('chemical_potential_energy', 'Chemical potential energy is stored in chemical bonds. Food, batteries, and firewood store chemical potential energy.');
  }

  if (asksFoodStoredEnergy(text)) {
    return definition('food_chemical_potential_energy', 'Food stores chemical potential energy in chemical bonds.');
  }

  if (asksStretchedSpringEnergy(text)) {
    return definition('spring_elastic_potential_energy', 'A stretched spring stores elastic potential energy.');
  }

  if (asksOutletsPowerPlantsEnergy(text)) {
    return definition('outlets_power_plants_electrical_energy', 'Outlets and power plants provide electrical energy, often called electricity.');
  }

  if (asksGreenPlantEnergyConversion(text)) {
    return concept('photosynthesis_energy_conversion', 'Green plants convert light or solar energy into chemical potential energy during photosynthesis.');
  }

  if (asksApplianceThermalConversion(text)) {
    return concept('appliance_thermal_energy_conversion', 'Appliances such as toasters and heaters often convert electrical energy into thermal energy.');
  }

  if (asksTemperatureDefinition(text)) {
    return definition('temperature', 'Temperature is a measure of the average kinetic energy of the particles in an object or substance.');
  }

  if (asksThermalEnergyDefinition(text)) {
    return definition('thermal_energy', 'Thermal energy is the total kinetic and potential energy of the particles in an object.');
  }

  if (asksHeatDefinition(text)) {
    return definition('heat', 'Heat is the transfer of energy from one object to another because of a temperature difference. Heat flows from higher temperature to lower temperature.');
  }

  if (asksHeatFlowDirection(text)) {
    return concept('heat_flow_direction', 'Heat flows from a higher-temperature or warmer object to a lower-temperature or cooler object.');
  }

  if (asksConductionDefinition(text)) {
    return definition('thermal_conduction', 'Conduction is heat transfer by direct contact of particles, such as touching a hot pan. Solids are usually the best conductors.');
  }

  if (asksConvectionDefinition(text)) {
    return definition('thermal_convection', 'Convection is heat transfer by the movement of heated particles. It occurs in liquids and gases.');
  }

  if (asksRadiationDefinition(text)) {
    return definition('thermal_radiation', 'Radiation is heat transfer by electromagnetic waves. It can travel through space.');
  }

  if (asksThermalConductor(text)) {
    return definition('thermal_conductor', 'A thermal conductor is a material that allows heat to flow or transfer easily. Metals and skin can act as conductors in this class context.');
  }

  if (asksThermalInsulator(text)) {
    return definition('thermal_insulator', 'A thermal insulator resists or limits heat flow. Air, wood, Styrofoam, plastic, and fiberglass are common examples.');
  }

  if (asksSpecificHeatDefinition(text)) {
    return definition('specific_heat', 'Specific heat is the amount of energy needed to raise the temperature of 1 kg of a substance by 1°C.');
  }

  if (asksWorkHoldingStill(text)) {
    return concept('work_holding_still', 'No. In physics, no work is being done on the weight if the weightlifter holds it still, because the weight is not moving and displacement is 0.');
  }

  if (asksWorkDefinition(text)) {
    return definition('physics_work', 'In physics, work is the transfer of energy when a force makes an object move in the direction of the force.');
  }

  if (asksPowerDefinition(text)) {
    return definition('physics_power', 'Power is the rate at which work is done or energy is transferred. Power = work / time, or P = W / t.');
  }

  if (asksEnergyAbsorbedTemperatureChange(text)) {
    return concept('energy_absorbed_positive_temperature_change', 'When energy is absorbed, the temperature change is positive.');
  }

  if (asksHeatLeavesNegativeChange(text)) {
    return concept('heat_leaves_negative_change', 'When heat leaves an object, the heat change is negative.');
  }

  return null;
}

function concept(id, answer) {
  return { id, answer, type: 'science_concept' };
}

function definition(id, answer) {
  return { id, answer, type: 'definition' };
}

function asksEnergyDefinition(text) {
  return hasDefinitionIntent(text) &&
    hasPhrase(text, 'energy') &&
    !hasAnyPhrase(text, [
      'kinetic energy',
      'potential energy',
      'mechanical energy',
      'chemical energy',
      'thermal energy',
      'electrical energy',
      'conservation of energy',
      'power',
      'work'
    ]);
}

function asksPotentialEnergyDefinition(text) {
  return hasDefinitionIntent(text) &&
    hasPhrase(text, 'potential energy') &&
    !hasPhrase(text, 'gravitational potential energy') &&
    !asksPotentialEnergyTypes(text);
}

function asksPotentialEnergyTypes(text) {
  return hasPhrase(text, 'potential energy') &&
    /\b(?:three|3|types?|kinds?)\b/.test(text);
}

function asksElasticPotentialEnergy(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'elastic potential energy');
}

function asksChemicalPotentialEnergy(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'chemical potential energy');
}

function asksConservationOfEnergy(text) {
  return hasPhrase(text, 'law of conservation of energy') ||
    hasPhrase(text, 'conservation of energy') && hasDefinitionIntent(text);
}

function asksMechanicalEnergy(text) {
  return hasPhrase(text, 'mechanical energy') && (hasDefinitionIntent(text) || hasPhrase(text, 'energy class'));
}

function asksFallingObjectEnergyChange(text) {
  return (/\b(?:falls?|falling|as\s+a\s+ball\s+falls|as\s+an?\s+object\s+falls)\b/.test(text) &&
    (hasPhrase(text, 'potential energy') || hasPhrase(text, 'gravitational potential energy') || /\bgpe\b/.test(text)) &&
    (hasPhrase(text, 'kinetic energy') || /\bke\b/.test(text))) ||
    (/\bgpe\b/.test(text) && /\bke\b/.test(text) && /\bfalls?\b/.test(text));
}

function asksBouncingBallEnergyLoss(text) {
  return hasPhrase(text, 'bouncing ball') &&
    (/\b(?:stops?|eventually|lost|gone|destroyed)\b/.test(text) || hasPhrase(text, 'energy lost'));
}

function asksFoodStoredEnergy(text) {
  return hasPhrase(text, 'food') && hasPhrase(text, 'stored') && hasPhrase(text, 'energy');
}

function asksStretchedSpringEnergy(text) {
  return hasPhrase(text, 'spring') &&
    (hasPhrase(text, 'stretched') || hasPhrase(text, 'compressed')) &&
    hasPhrase(text, 'energy');
}

function asksOutletsPowerPlantsEnergy(text) {
  return (hasPhrase(text, 'outlets') || hasPhrase(text, 'power plants')) &&
    hasPhrase(text, 'energy');
}

function asksGreenPlantEnergyConversion(text) {
  return /\bplants?\b/.test(text) &&
    (hasPhrase(text, 'photosynthesis') || hasPhrase(text, 'convert')) &&
    hasPhrase(text, 'energy');
}

function asksApplianceThermalConversion(text) {
  return /\b(?:toaster|heater|appliance|appliances)\b/.test(text) &&
    hasPhrase(text, 'electrical energy') &&
    (hasPhrase(text, 'thermal energy') || /\b(?:heat|warms?|hot)\b/.test(text) || hasPhrase(text, 'convert'));
}

function asksTemperatureDefinition(text) {
  return hasDefinitionIntent(text) &&
    hasPhrase(text, 'temperature') ||
    /^what\s+is\s+temperature\s+measur/.test(text) ||
    hasPhrase(text, 'temperature measuring');
}

function asksThermalEnergyDefinition(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'thermal energy');
}

function asksHeatDefinition(text) {
  return hasDefinitionIntent(text) && /^what\s+is\s+heat\b/.test(text);
}

function asksHeatFlowDirection(text) {
  return hasPhrase(text, 'heat flow') ||
    hasPhrase(text, 'which way does heat flow') ||
    (hasPhrase(text, 'heat') && /\b(?:from|to|warmer|cooler|hotter|colder|higher temperature|lower temperature)\b/.test(text));
}

function asksColdFlowOrIceHand(text) {
  return hasPhrase(text, 'cold flow') ||
    hasPhrase(text, 'cold flows') ||
    (hasPhrase(text, 'ice') && hasPhrase(text, 'hand') && (/\bcold\b/.test(text) || hasPhrase(text, 'heat flow')));
}

function asksConductionDefinition(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'conduction') && !hasElectricalContext(text);
}

function asksConvectionDefinition(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'convection');
}

function asksRadiationDefinition(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'radiation') &&
    !/\b(?:radioactive|nuclear|alpha|beta|gamma|decay)\b/.test(text);
}

function asksThermalConductor(text) {
  return hasDefinitionIntent(text) &&
    /\bconductors?\b/.test(text) &&
    !hasElectricalContext(text);
}

function asksThermalInsulator(text) {
  return hasDefinitionIntent(text) &&
    /\binsulators?\b/.test(text) &&
    !hasElectricalContext(text);
}

function asksSpecificHeatDefinition(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'specific heat') && !looksLikeNumericFormulaPrompt(text);
}

function asksWorkDefinition(text) {
  return hasDefinitionIntent(text) &&
    hasPhrase(text, 'work') &&
    (hasPhrase(text, 'physics') || !hasGeneralWorkContext(text));
}

function asksWorkHoldingStill(text) {
  return /\bwork\b/.test(text) &&
    (hasPhrase(text, 'holds a weight still') || hasPhrase(text, 'holding a weight still') || hasPhrase(text, 'holds weight still') || hasPhrase(text, 'holding weight still') || hasPhrase(text, 'weightlifter')) &&
    /\b(?:still|not moving|motionless)\b/.test(text);
}

function asksPowerDefinition(text) {
  return hasDefinitionIntent(text) &&
    hasPhrase(text, 'power') &&
    !hasElectricalContext(text) &&
    !/\b(?:political|government|authority|control)\b/.test(text);
}

function asksRollerCoasterGreatestPotentialEnergy(text) {
  return hasPhrase(text, 'roller coaster') &&
    /\bgreatest|most|maximum\b/.test(text) &&
    hasPhrase(text, 'potential energy');
}

function asksRollerCoasterTopEnergy(text) {
  return hasPhrase(text, 'roller coaster') &&
    (hasPhrase(text, 'top of a hill') || hasPhrase(text, 'top of the hill')) &&
    hasPhrase(text, 'potential energy') &&
    hasPhrase(text, 'kinetic energy');
}

function asksSunSolarPanelHeatTransfer(text) {
  return hasPhrase(text, 'sun') &&
    hasPhrase(text, 'solar panel') &&
    (hasPhrase(text, 'heat transfer') || hasPhrase(text, 'energy travels') || hasPhrase(text, 'energy travel'));
}

function asksLiquidsGasesHeatTransfer(text) {
  return /\bliquids?\b/.test(text) &&
    /\bgases\b/.test(text) &&
    (hasPhrase(text, 'heated particles move') || hasPhrase(text, 'particles move') || hasPhrase(text, 'heat transfer'));
}

function asksSwingingBatPoint(text) {
  return hasPhrase(text, 'swinging bat') &&
    hasPhrase(text, 'kinetic energy') &&
    /\b(?:which point|point)\b/.test(text);
}

function asksEnergyAbsorbedTemperatureChange(text) {
  return hasPhrase(text, 'energy is absorbed') && hasPhrase(text, 'temperature change');
}

function asksHeatLeavesNegativeChange(text) {
  return (hasPhrase(text, 'heat leaves') || hasPhrase(text, 'heat leave')) &&
    (hasPhrase(text, 'negative') || hasPhrase(text, 'heat change'));
}

function hasElectricalContext(text) {
  return /\b(?:electric|electrical|electricity|circuit|circuits|charge|charges|charged|current|electron|electrons|wire|wires|battery|batteries|voltage|resistance|static|grounding|induction)\b/.test(text);
}

function hasGeneralWorkContext(text) {
  return /\b(?:schoolwork|homework|job|labor|assignment|essay)\b/.test(text);
}

function hasDefinitionIntent(text) {
  return /\b(?:what\s+is|whats|what\s+are|define|meaning\s+of|what\s+does|in\s+.*\s+what\s+does|in\s+.*\s+what\s+is)\b/.test(text);
}

function hasAnyPhrase(text, phrases) {
  return phrases.some((phrase) => hasPhrase(text, phrase));
}

function hasPhrase(text, phrase) {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function looksLikeNumericFormulaPrompt(text) {
  return /\d/.test(text) &&
    /\b(?:find|calculate|solve|determine|what\s+is|how\s+much|how\s+many|how\s+high|at\s+what\s+height)\b/.test(text) &&
    /\b(?:j|joules?|kg|g|grams?|n|newtons?|m|meters?|seconds?|s|watts?|w|m\/s|celsius|°\s*c)\b/.test(text);
}

function allowsConceptualNumericEnergyPrompt(text) {
  return asksPotentialEnergyTypes(text);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9µμ°/.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  tryUnit3EnergyKnowledge
};
