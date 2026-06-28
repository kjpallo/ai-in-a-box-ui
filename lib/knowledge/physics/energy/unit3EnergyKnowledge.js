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

  if (asksEndothermicExothermicDifference(text)) {
    return concept('endothermic_exothermic_difference', 'Endothermic processes absorb energy from the surroundings. Exothermic processes release energy to the surroundings.');
  }

  if (asksEndothermicExothermicExamples(text)) {
    return concept('endothermic_exothermic_examples', 'Examples of endothermic processes include melting ice, evaporation, and instant cold packs. Examples of exothermic processes include burning, freezing water, and hand warmers.');
  }

  if (asksEndothermicDefinition(text)) {
    return definition('endothermic', 'Endothermic means energy is absorbed from the surroundings, such as melting ice, evaporation, or an instant cold pack.');
  }

  if (asksExothermicDefinition(text)) {
    return definition('exothermic', 'Exothermic means energy is released to the surroundings, such as fire burning, freezing water, or a hand warmer.');
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

  const energyTypeAnswer = answerEnergyTypeQuestion(text);
  if (energyTypeAnswer) return energyTypeAnswer;

  const energyDefinitionAnswer = answerEnergyTypeDefinitionOrDifference(text);
  if (energyDefinitionAnswer) return energyDefinitionAnswer;

  if (asksMechanicalEnergy(text)) {
    return definition('mechanical_energy', 'Mechanical energy is the energy an object has because of motion and/or position. It is the total kinetic energy plus potential energy in a system: mechanical energy = KE + PE.');
  }

  if (asksPotentialEnergyDefinition(text)) {
    return definition('potential_energy', 'Potential energy is stored energy. Gravitational potential energy is stored energy because of height or position. Other examples include elastic potential energy and chemical potential energy.');
  }

  if (asksEnergyDefinition(text)) {
    return definition('energy_definition', 'Energy is the ability to cause change. Energy is measured in joules, written J.');
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
      'mechanical kinetic energy',
      'gravitational potential energy',
      'elastic potential energy',
      'chemical energy',
      'thermal energy',
      'electrical energy',
      'radiant energy',
      'optical energy',
      'light energy',
      'sound energy',
      'conservation of energy',
      'power',
      'work'
    ]);
}

function asksPotentialEnergyDefinition(text) {
  return hasDefinitionIntent(text) &&
    hasPotentialEnergyTerm(text) &&
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

function answerEnergyTypeDefinitionOrDifference(text) {
  if (asksKineticPotentialDifference(text)) {
    return definition('kinetic_potential_energy_difference', 'Kinetic energy and potential energy are related because energy can change between motion and stored energy. Kinetic Energy: energy an object has because it is moving. Potential energy is stored energy. Gravitational Potential Energy: stored energy because of height or position.');
  }

  if (asksRadiantThermalDifference(text)) {
    return definition('radiant_thermal_energy_difference', 'Radiant energy is energy carried by light or electromagnetic waves. Thermal energy is heat-related energy from the motion of particles in matter.');
  }

  if (asksChemicalElectricalDifference(text)) {
    return definition('chemical_electrical_energy_difference', 'Chemical energy is stored in chemical bonds, such as in food, fuel, batteries, and gasoline. Electrical energy is energy from moving electric charges or electricity.');
  }

  if (asksKineticPotentialMultiDefinition(text)) {
    return definition('kinetic_potential_energy_multi_definition', 'Kinetic energy and potential energy are related because energy can change between motion and stored energy. Kinetic Energy: energy an object has because it is moving; KE = 1/2 × m × v^2. Gravitational Potential Energy: stored energy because of height or position; GPE = m × g × h.');
  }

  if (asksMechanicalKineticEnergyAlias(text)) {
    return definition('mechanical_kinetic_energy_alias', 'Mechanical kinetic energy means kinetic energy: the energy of motion. It is not a separate classroom energy type; kinetic energy is a form of mechanical energy.');
  }

  if (asksKineticMechanicalRelationship(text)) {
    return definition('kinetic_mechanical_energy_relationship', 'Yes. Kinetic energy is a form of mechanical energy because it is energy an object has from motion.');
  }

  if (asksKineticEnergyDefinition(text)) {
    return definition('kinetic_energy', 'Kinetic energy is energy of motion. It can be described as a form of mechanical energy, and for calculations KE = 1/2 x m x v^2.');
  }

  if (asksGravitationalPotentialEnergyDefinition(text)) {
    return definition('gravitational_potential_energy', 'Gravitational potential energy is stored energy because of height or position above the ground. For calculations, GPE = m x g x h.');
  }

  if (asksElasticPotentialEnergy(text)) {
    return definition('elastic_potential_energy', 'Elastic potential energy is stored energy in objects that are stretched or compressed, such as a rubber band, spring, bow, or slingshot.');
  }

  if (asksChemicalEnergyDefinition(text)) {
    return definition('chemical_energy', 'Chemical energy is energy stored in chemical bonds, such as in food, fuel, batteries, and gasoline.');
  }

  if (asksThermalEnergyDefinition(text)) {
    return definition('thermal_energy', 'Thermal energy is heat-related energy from particle motion. In this class, it can also be described as the total kinetic and potential energy of particles in an object.');
  }

  if (asksElectricalEnergyDefinition(text)) {
    return definition('electrical_energy', 'Electrical energy is energy from moving electric charges or electricity, such as energy in an electric current, lightning, or an outlet.');
  }

  if (asksRadiantEnergyDefinition(text)) {
    return definition('radiant_energy', 'Radiant energy is energy carried by light or electromagnetic waves. Sunlight and light from a lamp are common examples.');
  }

  if (asksOpticalOrLightEnergyDefinition(text)) {
    return definition('optical_light_energy', 'Optical energy means light energy. In this class context, optical energy and light energy are usually treated as radiant energy.');
  }

  if (asksSoundEnergyDefinition(text)) {
    return definition('sound_energy', 'Sound energy is energy from vibrations traveling as sound waves through matter.');
  }

  return null;
}

function answerEnergyTypeQuestion(text) {
  if (asksMovingObjectKineticOrMechanical(text)) {
    return concept('moving_object_kinetic_or_mechanical_energy', 'Both wordings can be valid. The more specific answer is kinetic energy because the object is moving, and kinetic energy is part of mechanical energy.');
  }

  if (asksStretchedElasticOrPotential(text)) {
    return concept('elastic_or_potential_energy', 'A stretched or compressed object has elastic potential energy. It is a specific kind of potential energy.');
  }

  if (asksSunlightRadiantOrOptical(text)) {
    return concept('sunlight_radiant_or_optical_energy', 'Both are acceptable in this class context. Radiant energy is the broader term, and optical or light energy means light energy.');
  }

  if (asksBatteryChemicalOrElectrical(text)) {
    return concept('battery_chemical_or_electrical_energy', 'Stored energy in a battery is chemical energy. When the battery is used in a circuit, that energy changes to electrical energy.');
  }

  if (!asksEnergyTypeIdentification(text)) return null;

  if (hasKineticEnergyExample(text)) {
    return concept('kinetic_energy_example', 'That has kinetic energy because it is moving. Kinetic energy is energy of motion and is a form of mechanical energy.');
  }

  if (hasGravitationalPotentialEnergyExample(text)) {
    return concept('gravitational_potential_energy_example', 'That has gravitational potential energy because it has stored energy due to height or position.');
  }

  if (hasElasticPotentialEnergyExample(text)) {
    return concept('elastic_potential_energy_example', 'That has elastic potential energy because energy is stored in something stretched or compressed.');
  }

  if (hasChemicalEnergyExample(text)) {
    if (/\bbatter(?:y|ies)\b/.test(text)) {
      return concept('battery_chemical_energy', 'The stored energy in a battery is chemical energy. When the battery is used in a circuit, it can change to electrical energy.');
    }
    return concept('chemical_energy_example', 'That is chemical energy, also called chemical potential energy, because the energy is stored in chemical bonds, such as in food, fuel, gasoline, or batteries.');
  }

  if (hasThermalEnergyExample(text)) {
    return concept('thermal_energy_example', 'That is thermal energy, which is heat-related energy from particle motion.');
  }

  if (hasElectricalEnergyExample(text)) {
    return concept('electrical_energy_example', 'That is electrical energy, which is energy from moving electric charges or electricity.');
  }

  if (hasRadiantEnergyExample(text)) {
    if (/\blamps?\b/.test(text)) {
      return concept('lamp_radiant_energy', 'A lamp gives off radiant energy, also called light energy. Some lamps also give off thermal energy as heat.');
    }
    return concept('radiant_energy_example', 'That is radiant energy because it is energy carried by light or electromagnetic waves. Optical energy and light energy are acceptable classroom wording for this.');
  }

  if (hasSoundEnergyExample(text)) {
    return concept('sound_energy_example', 'That is sound energy because it comes from vibrations traveling as sound waves through matter.');
  }

  return null;
}

function asksKineticEnergyDefinition(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'kinetic energy');
}

function asksGravitationalPotentialEnergyDefinition(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'gravitational potential energy');
}

function asksChemicalEnergyDefinition(text) {
  return hasDefinitionIntent(text) && (
    hasPhrase(text, 'chemical energy') ||
    hasPhrase(text, 'chemical potential energy')
  );
}

function asksElectricalEnergyDefinition(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'electrical energy');
}

function asksRadiantEnergyDefinition(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'radiant energy');
}

function asksOpticalOrLightEnergyDefinition(text) {
  return hasDefinitionIntent(text) && (
    hasPhrase(text, 'optical energy') ||
    hasPhrase(text, 'light energy')
  );
}

function asksSoundEnergyDefinition(text) {
  return hasDefinitionIntent(text) && hasPhrase(text, 'sound energy');
}

function asksMechanicalKineticEnergyAlias(text) {
  return hasPhrase(text, 'mechanical kinetic energy') &&
    (hasDefinitionIntent(text) || /\b(?:same|separate|type|kind|form|mean|means)\b/.test(text));
}

function asksKineticMechanicalRelationship(text) {
  return hasPhrase(text, 'kinetic energy') &&
    hasPhrase(text, 'mechanical energy') &&
    /\b(?:is|are|same|form|part|type|kind)\b/.test(text);
}

function asksKineticPotentialDifference(text) {
  return asksEnergyDifference(text) &&
    hasPhrase(text, 'kinetic') &&
    hasPotentialTerm(text);
}

function asksRadiantThermalDifference(text) {
  return asksEnergyDifference(text) &&
    hasPhrase(text, 'radiant') &&
    hasPhrase(text, 'thermal');
}

function asksChemicalElectricalDifference(text) {
  return asksEnergyDifference(text) &&
    hasPhrase(text, 'chemical') &&
    hasPhrase(text, 'electrical');
}

function asksKineticPotentialMultiDefinition(text) {
  return hasDefinitionIntent(text) &&
    hasPhrase(text, 'kinetic energy') &&
    hasPotentialEnergyTerm(text);
}

function hasPotentialEnergyTerm(text) {
  return hasPotentialTerm(text) && hasPhrase(text, 'energy');
}

function hasPotentialTerm(text) {
  return /\b(?:potential|potetial|potietal)\b/.test(text);
}

function asksEnergyDifference(text) {
  return /\b(?:difference|different|compare|contrast)\b/.test(text) &&
    hasPhrase(text, 'energy');
}

function asksEnergyTypeIdentification(text) {
  if (!hasPhrase(text, 'energy')) return false;
  return /\b(?:what|which)\s+(?:type|kind|form)\s+of\s+energy\b/.test(text) ||
    /\b(?:what|which)\s+energy\s+(?:type|kind|form)\b/.test(text) ||
    /\bwhat\s+type\s+energy\b/.test(text) ||
    /\bis\b.+\b(?:energy)\b/.test(text) ||
    /\bdoes\b.+\b(?:have|store|give\s+off|come\s+from|comes\s+from)\b/.test(text);
}

function asksMovingObjectKineticOrMechanical(text) {
  return hasPhrase(text, 'energy') &&
    hasPhrase(text, 'kinetic') &&
    hasPhrase(text, 'mechanical') &&
    /\b(?:moving|motion|car|ball|running|rolling)\b/.test(text) &&
    /\bor\b/.test(text);
}

function asksStretchedElasticOrPotential(text) {
  return hasPhrase(text, 'energy') &&
    hasPhrase(text, 'elastic') &&
    hasPhrase(text, 'potential') &&
    /\b(?:stretched|compressed|rubber\s+band|spring|bow)\b/.test(text);
}

function asksSunlightRadiantOrOptical(text) {
  return hasPhrase(text, 'energy') &&
    /\b(?:sunlight|sun)\b/.test(text) &&
    hasPhrase(text, 'radiant') &&
    (hasPhrase(text, 'optical') || hasPhrase(text, 'light'));
}

function asksBatteryChemicalOrElectrical(text) {
  return hasPhrase(text, 'energy') &&
    /\bbatter(?:y|ies)\b/.test(text) &&
    hasPhrase(text, 'chemical') &&
    (hasPhrase(text, 'electrical') || hasPhrase(text, 'electric'));
}

function hasKineticEnergyExample(text) {
  return /\b(?:moving\s+car|rolling\s+ball|running\s+person|moving\s+object|object\s+moving|car\s+moving|ball\s+rolling|person\s+running)\b/.test(text);
}

function hasGravitationalPotentialEnergyExample(text) {
  return /\b(?:book\s+on\s+(?:a\s+)?shelf|ball\s+held\s+above|held\s+above\s+the\s+ground|water\s+behind\s+a\s+dam|behind\s+a\s+dam|high\s+shelf)\b/.test(text);
}

function hasElasticPotentialEnergyExample(text) {
  return /\b(?:stretched\s+rubber\s+band|rubber\s+band\s+stretched|compressed\s+spring|spring\s+compressed|pulled-back\s+bow|pulled\s+back\s+bow|stretched\s+spring|spring\s+stretched)\b/.test(text);
}

function hasChemicalEnergyExample(text) {
  return /\b(?:stored\s+in\s+food|energy\s+in\s+food|stored\s+in\s+(?:a\s+)?batter(?:y|ies)|stored\s+energy\s+in\s+(?:a\s+)?batter(?:y|ies)|stored\s+in\s+gasoline|stored\s+in\s+fuel|food|gasoline|fuel|batter(?:y|ies))\b/.test(text) &&
    !hasPhrase(text, 'electric current');
}

function hasThermalEnergyExample(text) {
  return /\b(?:hot\s+soup|heat|particles?\s+move\s+faster|particles?\s+moving\s+faster|particle\s+motion)\b/.test(text) &&
    !/\b(?:radiant|light|sound)\b/.test(text);
}

function hasElectricalEnergyExample(text) {
  return /\b(?:electric\s+current|electrical\s+current|lightning|outlet|outlets|electricity)\b/.test(text);
}

function hasRadiantEnergyExample(text) {
  return /\b(?:sunlight|sun\s+light|light\s+from\s+the\s+sun|lamp|light\s+energy|optical\s+energy|radiant\s+energy)\b/.test(text);
}

function hasSoundEnergyExample(text) {
  return /\b(?:sound|vibrating\s+speaker|speaker\s+vibrating|vibrations?\s+through\s+matter|travels?\s+as\s+vibrations?)\b/.test(text);
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

function asksEndothermicExothermicDifference(text) {
  return /\bendothermic\b/.test(text) &&
    /\bexothermic\b/.test(text) &&
    /\b(?:difference|different|vs|versus|compare|explain)\b/.test(text);
}

function asksEndothermicExothermicExamples(text) {
  return /\b(?:give|list|show)\s+examples?\s+of\s+endothermic\s+and\s+exothermic\s+processes?\b/.test(text);
}

function asksEndothermicDefinition(text) {
  return hasDefinitionIntent(text) && /\bendothermic\b/.test(text);
}

function asksExothermicDefinition(text) {
  return hasDefinitionIntent(text) && /\bexothermic\b/.test(text);
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
