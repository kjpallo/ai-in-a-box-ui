const { buildUnit3EnergyPacket } = require('./unit3EnergyPacketAdapter');

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

  const broadEnergyTypeAnswer = answerBroadEnergyTypePrompt(text);
  if (broadEnergyTypeAnswer) return broadEnergyTypeAnswer;

  const energyTransformationAnswer = answerEnergyTransformationQuestion(text);
  if (energyTransformationAnswer) return energyTransformationAnswer;

  const energyDefinitionAnswer = answerEnergyTypeDefinitionOrDifference(text);
  if (energyDefinitionAnswer) return energyDefinitionAnswer;

  const energyTypeAnswer = answerEnergyTypeQuestion(text);
  if (energyTypeAnswer) return energyTypeAnswer;

  if (asksMechanicalEnergy(text)) {
    return definition('mechanical_energy', 'Mechanical energy is the energy an object has because of motion and/or position. It is the total kinetic energy plus potential energy in a system: mechanical energy = KE + PE.');
  }

  if (asksPotentialEnergyDefinition(text)) {
    return definition('potential_energy', 'Potential energy is stored energy. Gravitational potential energy is stored energy because of height or position, and for calculations GPE = m × g × h. Other examples include elastic potential energy and chemical potential energy.');
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
    return definition('heat', 'Heat is the transfer of energy from one object to another because of a temperature difference. Heat is energy transferred from a warmer object to a cooler object.');
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
    return definition('specific_heat', 'Specific heat is the amount of energy needed to raise the temperature of 1 gram of a substance by 1°C. Use q = m × c × ΔT.');
  }

  if (asksWorkHoldingStill(text)) {
    return concept('work_holding_still', 'No. In physics, no work is being done on the weight if the weightlifter holds it still, because the weight is not moving and displacement is 0.');
  }

  if (asksWorkDefinition(text)) {
    return definition('physics_work', 'In physics, work is the transfer of energy when a force makes an object move in the direction of the force.');
  }

  if (asksPowerDefinition(text)) {
    return definition('physics_power', 'Power is the rate at which work is done or energy is transferred. Power is measured in watts. power = work / time, or P = W / t.');
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

const UNIT3_DIRECT_ANSWER_FACTS = [
  {
    id: 'swinging_bat_kinetic_energy_point',
    type: 'science_concept',
    category: 'diagram_clarification',
    answer: 'For a swinging bat, I would need the diagram or point labels to name a specific point. In general, kinetic energy is greatest where speed is greatest; on a rotating bat, points farther from the hands, near the tip, usually move fastest.'
  },
  {
    id: 'roller_coaster_greatest_potential_energy',
    type: 'science_concept',
    category: 'diagram_answer',
    answer: 'A roller coaster has the greatest gravitational potential energy at the highest point, usually the top of the hill.'
  },
  {
    id: 'roller_coaster_top_potential_energy',
    type: 'science_concept',
    category: 'diagram_answer',
    answer: 'At the top of a hill, a roller coaster has more gravitational potential energy because it is highest above the ground. Kinetic energy increases later when the coaster moves faster lower on the track.'
  },
  {
    id: 'falling_object_energy_change',
    type: 'science_concept',
    category: 'energy_change',
    answer: 'As an object falls, gravitational potential energy, or GPE, decreases because height decreases. Kinetic energy, or KE, increases because the object speeds up.'
  },
  {
    id: 'bouncing_ball_energy_transfer',
    type: 'science_concept',
    category: 'energy_change',
    answer: 'When a bouncing ball stops, the energy is not destroyed or gone. It is converted or transferred into other forms, especially thermal energy, sound, and energy transferred to the ground and air.'
  },
  {
    id: 'cold_does_not_flow',
    type: 'science_concept',
    category: 'heat_transfer',
    answer: 'Cold does not flow from the ice into your hand. Heat transfers from the warmer hand to the colder ice, so your hand loses thermal energy and feels cold.'
  },
  {
    id: 'endothermic_exothermic_difference',
    type: 'science_concept',
    category: 'comparison',
    answer: 'Endothermic processes absorb energy from the surroundings. Exothermic processes release energy to the surroundings.'
  },
  {
    id: 'endothermic_exothermic_examples',
    type: 'science_concept',
    category: 'examples',
    answer: 'Examples of endothermic processes include melting ice, evaporation, and instant cold packs. Examples of exothermic processes include burning, freezing water, and hand warmers.'
  },
  {
    id: 'endothermic',
    type: 'definition',
    category: 'definition',
    answer: 'Endothermic means energy is absorbed from the surroundings, such as melting ice, evaporation, or an instant cold pack.'
  },
  {
    id: 'exothermic',
    type: 'definition',
    category: 'definition',
    answer: 'Exothermic means energy is released to the surroundings, such as fire burning, freezing water, or a hand warmer.'
  },
  {
    id: 'radiation_sun_to_solar_panel',
    type: 'definition',
    category: 'heat_transfer',
    answer: 'That heat transfer is radiation. Energy from the Sun travels by electromagnetic waves, which can move through space to the solar panel.'
  },
  {
    id: 'convection_liquids_gases',
    type: 'definition',
    category: 'heat_transfer',
    answer: 'That heat transfer is convection. Convection transfers heat by movement of heated particles in liquids and gases.'
  },
  {
    id: 'potential_energy_types',
    type: 'definition',
    category: 'definition',
    answer: 'The three classroom types of potential energy are gravitational potential energy, elastic potential energy, and chemical potential energy.'
  },
  {
    id: 'law_conservation_energy',
    type: 'definition',
    category: 'law',
    answer: 'The law of conservation of energy says energy cannot be created and cannot be destroyed. Energy only changes forms or is transferred.'
  },
  {
    id: 'broad_energy_type_list',
    type: 'science_concept',
    category: 'energy_types',
    answer: 'Common energy types include mechanical energy, kinetic energy, potential energy, thermal energy, chemical energy, electrical energy, radiant or light energy, and sound energy. Examples: moving objects have kinetic energy; food and batteries store chemical energy; a lamp gives off radiant/light and thermal energy; a speaker produces sound energy.'
  },
  {
    id: 'motion_energy_type',
    type: 'science_concept',
    category: 'energy_types',
    answer: 'Kinetic energy is most connected to motion because kinetic energy is energy of motion.'
  },
  {
    id: 'stored_energy_type',
    type: 'science_concept',
    category: 'energy_types',
    answer: 'Potential energy is stored energy. Depending on the example, stored energy can be chemical energy, gravitational potential energy, or elastic potential energy.'
  },
  {
    id: 'mechanical_energy_not_same_as_kinetic',
    type: 'definition',
    category: 'comparison',
    answer: 'No. Kinetic energy is one kind of mechanical energy. Mechanical energy includes kinetic energy and potential energy.'
  },
  {
    id: 'kinetic_potential_energy_difference',
    type: 'definition',
    category: 'comparison',
    answer: 'Kinetic energy is energy of motion. Potential energy is stored energy due to position, height, shape, or condition.'
  },
  {
    id: 'thermal_temperature_difference',
    type: 'definition',
    category: 'comparison',
    answer: 'Temperature measures the average motion, or average kinetic energy, of particles. Thermal energy depends on particle motion and the amount of matter present.'
  },
  {
    id: 'radiant_sound_energy_difference',
    type: 'definition',
    category: 'comparison',
    answer: 'Radiant energy travels as electromagnetic waves and can travel through empty space. Sound energy comes from vibrations and needs a medium.'
  },
  {
    id: 'radiant_thermal_energy_difference',
    type: 'definition',
    category: 'comparison',
    answer: 'Radiant energy is energy carried by light or electromagnetic waves. Thermal energy is heat-related energy from the motion of particles in matter.'
  },
  {
    id: 'chemical_electrical_energy_difference',
    type: 'definition',
    category: 'comparison',
    answer: 'Chemical energy is stored in chemical bonds, such as in food, fuel, batteries, and gasoline. Electrical energy is energy from moving electric charges or electricity.'
  },
  {
    id: 'kinetic_potential_energy_multi_definition',
    type: 'definition',
    category: 'comparison',
    answer: 'Kinetic energy and potential energy are related because energy can change between motion and stored energy. Kinetic Energy: energy an object has because it is moving; KE = 1/2 × m × v^2. Gravitational Potential Energy: stored energy because of height or position; GPE = m × g × h.'
  },
  {
    id: 'mechanical_kinetic_energy_alias',
    type: 'definition',
    category: 'definition',
    answer: 'Mechanical kinetic energy means kinetic energy: the energy of motion. It is not a separate classroom energy type; kinetic energy is a form of mechanical energy.'
  },
  {
    id: 'kinetic_mechanical_energy_relationship',
    type: 'definition',
    category: 'relationship_answer',
    answer: 'Yes. Kinetic energy is a form of mechanical energy because it is energy an object has from motion.'
  },
  {
    id: 'kinetic_energy',
    type: 'definition',
    category: 'definition',
    answer: 'Kinetic energy is energy of motion. It can be described as a form of mechanical energy, and for calculations KE = 1/2 x m x v^2.'
  },
  {
    id: 'gravitational_potential_energy',
    type: 'definition',
    category: 'definition',
    answer: 'Gravitational potential energy is stored energy due to height or position in a gravitational field. For calculations, GPE = m x g x h.'
  },
  {
    id: 'electrical_energy',
    type: 'definition',
    category: 'definition',
    answer: 'Electrical energy is energy from moving electric charges or current, such as energy in an electric current, lightning, or an outlet.'
  },
  {
    id: 'radiant_energy',
    type: 'definition',
    category: 'definition',
    answer: 'Radiant energy is energy carried by electromagnetic waves, including light. Sunlight and light from a lamp are common examples.'
  },
  {
    id: 'optical_light_energy',
    type: 'definition',
    category: 'definition',
    answer: 'Light energy is radiant energy that can travel as electromagnetic waves. In this class context, optical energy and light energy are usually treated as radiant energy.'
  },
  {
    id: 'moving_object_kinetic_or_mechanical_energy',
    type: 'science_concept',
    category: 'energy_type_identification',
    answer: 'Both wordings can be valid. The more specific answer is kinetic energy because the object is moving, and kinetic energy is part of mechanical energy.'
  },
  {
    id: 'elastic_or_potential_energy',
    type: 'science_concept',
    category: 'energy_type_identification',
    answer: 'A stretched or compressed object has elastic potential energy. It is a specific kind of potential energy.'
  },
  {
    id: 'sunlight_radiant_or_optical_energy',
    type: 'science_concept',
    category: 'energy_type_identification',
    answer: 'Both are acceptable in this class context. Radiant energy is the broader term, and optical or light energy means light energy.'
  },
  {
    id: 'battery_chemical_or_electrical_energy',
    type: 'science_concept',
    category: 'energy_type_identification',
    answer: 'Stored energy in a battery is chemical energy. When the battery is used in a circuit, that energy changes to electrical energy.'
  },
  {
    id: 'kinetic_energy_example',
    type: 'science_concept',
    category: 'energy_example',
    answer: 'That has kinetic energy because it is moving. Kinetic energy is energy of motion and is a form of mechanical energy.'
  },
  {
    id: 'gravitational_potential_energy_example',
    type: 'science_concept',
    category: 'energy_example',
    answer: 'That has gravitational potential energy because it has stored energy due to height or position.'
  },
  {
    id: 'elastic_potential_energy_example',
    type: 'science_concept',
    category: 'energy_example',
    answer: 'That has elastic potential energy because energy is stored in something stretched or compressed.'
  },
  {
    id: 'chemical_energy_example',
    type: 'science_concept',
    category: 'energy_example',
    answer: 'That is chemical energy, also called chemical potential energy, because the energy is stored in chemical bonds, such as in food, fuel, gasoline, or batteries.'
  },
  {
    id: 'thermal_energy_example',
    type: 'science_concept',
    category: 'energy_example',
    answer: 'That is thermal energy, which is heat-related energy from particle motion.'
  },
  {
    id: 'electrical_energy_example',
    type: 'science_concept',
    category: 'energy_example',
    answer: 'That is electrical energy, which is energy from moving electric charges or electricity.'
  },
  {
    id: 'lamp_radiant_energy',
    type: 'science_concept',
    category: 'energy_example',
    answer: 'A lamp gives off radiant energy, also called light energy. Some lamps also give off thermal energy as heat.'
  },
  {
    id: 'radiant_energy_example',
    type: 'science_concept',
    category: 'energy_example',
    answer: 'That is radiant energy because it is energy carried by light or electromagnetic waves. Optical energy and light energy are acceptable classroom wording for this.'
  },
  {
    id: 'sound_energy_example',
    type: 'science_concept',
    category: 'energy_example',
    answer: 'That is sound energy because it comes from vibrations traveling as sound waves through matter, which is the medium.'
  },
  {
    id: 'mechanical_energy',
    type: 'definition',
    category: 'definition',
    answer: 'Mechanical energy is the energy an object has because of motion and/or position. It is the total kinetic energy plus potential energy in a system: mechanical energy = KE + PE.'
  },
  {
    id: 'potential_energy',
    type: 'definition',
    category: 'definition',
    answer: 'Potential energy is stored energy. Gravitational potential energy is stored energy because of height or position. Other examples include elastic potential energy and chemical potential energy.'
  },
  {
    id: 'energy_definition',
    type: 'definition',
    category: 'definition',
    answer: 'Energy is the ability to cause change. Energy is measured in joules, written J.'
  },
  {
    id: 'elastic_potential_energy',
    type: 'definition',
    category: 'definition',
    answer: 'Elastic potential energy is stored in objects that are stretched or compressed, such as a spring, bow and arrow, or slingshot.'
  },
  {
    id: 'chemical_potential_energy',
    type: 'definition',
    category: 'definition',
    answer: 'Chemical potential energy is stored in chemical bonds. Food, batteries, and firewood store chemical potential energy.'
  },
  {
    id: 'food_chemical_potential_energy',
    type: 'definition',
    category: 'energy_example',
    answer: 'Food stores chemical potential energy in chemical bonds.'
  },
  {
    id: 'spring_elastic_potential_energy',
    type: 'definition',
    category: 'energy_example',
    answer: 'A stretched spring stores elastic potential energy.'
  },
  {
    id: 'outlets_power_plants_electrical_energy',
    type: 'definition',
    category: 'energy_example',
    answer: 'Outlets and power plants provide electrical energy, often called electricity.'
  },
  {
    id: 'photosynthesis_energy_conversion',
    type: 'science_concept',
    category: 'energy_transformation',
    answer: 'Green plants convert light or solar energy into chemical potential energy during photosynthesis.'
  },
  {
    id: 'appliance_thermal_energy_conversion',
    type: 'science_concept',
    category: 'energy_transformation',
    answer: 'Appliances such as toasters and heaters often convert electrical energy into thermal energy.'
  },
  {
    id: 'temperature',
    type: 'definition',
    category: 'definition',
    answer: 'Temperature is a measure of the average kinetic energy of the particles in an object or substance.'
  },
  {
    id: 'thermal_energy',
    type: 'definition',
    category: 'definition',
    answer: 'Thermal energy is the total kinetic and potential energy of the particles in an object.'
  },
  {
    id: 'heat',
    type: 'definition',
    category: 'definition',
    answer: 'Heat is the transfer of energy from one object to another because of a temperature difference. Heat flows from higher temperature to lower temperature.'
  },
  {
    id: 'heat_flow_direction',
    type: 'science_concept',
    category: 'heat_transfer',
    answer: 'Heat flows from a higher-temperature or warmer object to a lower-temperature or cooler object.'
  },
  {
    id: 'thermal_conduction',
    type: 'definition',
    category: 'heat_transfer',
    answer: 'Conduction is heat transfer by direct contact of particles, such as touching a hot pan. Solids are usually the best conductors.'
  },
  {
    id: 'thermal_convection',
    type: 'definition',
    category: 'heat_transfer',
    answer: 'Convection is heat transfer by the movement of heated particles. It occurs in liquids and gases.'
  },
  {
    id: 'thermal_radiation',
    type: 'definition',
    category: 'heat_transfer',
    answer: 'Radiation is heat transfer by electromagnetic waves. It can travel through space.'
  },
  {
    id: 'thermal_conductor',
    type: 'definition',
    category: 'heat_transfer',
    answer: 'A thermal conductor is a material that allows heat to flow or transfer easily. Metals and skin can act as conductors in this class context.'
  },
  {
    id: 'thermal_insulator',
    type: 'definition',
    category: 'heat_transfer',
    answer: 'A thermal insulator resists or limits heat flow. Air, wood, Styrofoam, plastic, and fiberglass are common examples.'
  },
  {
    id: 'specific_heat',
    type: 'definition',
    category: 'definition',
    answer: 'Specific heat is the amount of energy needed to raise the temperature of 1 kg of a substance by 1°C.'
  },
  {
    id: 'work_holding_still',
    type: 'science_concept',
    category: 'work_power',
    answer: 'No. In physics, no work is being done on the weight if the weightlifter holds it still, because the weight is not moving and displacement is 0.'
  },
  {
    id: 'physics_work',
    type: 'definition',
    category: 'work_power',
    answer: 'In physics, work is the transfer of energy when a force makes an object move in the direction of the force.'
  },
  {
    id: 'physics_power',
    type: 'definition',
    category: 'work_power',
    answer: 'Power is the rate at which work is done or energy is transferred. Power = work / time, or P = W / t.'
  },
  {
    id: 'energy_absorbed_positive_temperature_change',
    type: 'science_concept',
    category: 'thermal_formula_sign',
    answer: 'When energy is absorbed, the temperature change is positive.'
  },
  {
    id: 'heat_leaves_negative_change',
    type: 'science_concept',
    category: 'thermal_formula_sign',
    answer: 'When heat leaves an object, the heat change is negative.'
  }
];

const ENERGY_TYPE_FACTS = [
  {
    id: 'mechanical_energy',
    name: 'Mechanical energy',
    definition: 'energy of motion and position',
    example: 'a moving car, a falling ball, or an object held high',
    answer: 'Mechanical energy is energy of motion and position. It includes kinetic energy and potential energy.'
  },
  {
    id: 'kinetic_energy',
    name: 'Kinetic energy',
    definition: 'energy of motion',
    example: 'a moving car, rolling ball, running person, or moving bike',
    answer: 'Kinetic energy is energy of motion. Moving objects have kinetic energy.'
  },
  {
    id: 'potential_energy',
    name: 'Potential energy',
    definition: 'stored energy due to position, height, shape, or condition',
    example: 'a book on a shelf, stretched rubber band, compressed spring, food, or fuel',
    answer: 'Potential energy is stored energy due to position, height, shape, or condition.'
  },
  {
    id: 'gravitational_potential_energy',
    name: 'Gravitational potential energy',
    definition: 'stored energy due to height or position in a gravitational field',
    example: 'a book on a shelf, rock up high, or water behind a dam',
    answer: 'Gravitational potential energy is stored energy due to height or position in a gravitational field.'
  },
  {
    id: 'elastic_potential_energy',
    name: 'Elastic potential energy',
    definition: 'stored energy in something stretched or compressed',
    example: 'a stretched rubber band, compressed spring, or pulled-back bow',
    answer: 'Elastic potential energy is stored energy in something stretched or compressed.'
  },
  {
    id: 'chemical_energy',
    name: 'Chemical energy',
    definition: 'energy stored in the bonds of substances',
    example: 'food, gasoline, batteries, and fuel',
    answer: 'Chemical energy, also called chemical potential energy, is energy stored in chemical bonds. Food, gasoline, batteries, and fuel are common examples.'
  },
  {
    id: 'thermal_energy',
    name: 'Thermal energy',
    definition: 'energy related to particle motion and temperature',
    example: 'a hot cup of cocoa, hot soup, or a heater',
    answer: 'Thermal energy is energy related to the motion of particles and temperature. Warmer objects usually have more thermal energy, and the amount of matter also matters.'
  },
  {
    id: 'electrical_energy',
    name: 'Electrical energy',
    definition: 'energy from moving electric charges or current',
    example: 'a wall outlet, electric current, lightning, or a circuit',
    answer: 'Electrical energy is energy from moving electric charges or current.'
  },
  {
    id: 'radiant_energy',
    name: 'Radiant or light energy',
    definition: 'energy carried by electromagnetic waves, including light',
    example: 'sunlight, a lamp, a flashlight, or light bulb',
    answer: 'Radiant energy is energy carried by electromagnetic waves, including light. Light energy is radiant energy.'
  },
  {
    id: 'sound_energy',
    name: 'Sound energy',
    definition: 'energy carried by vibrations traveling through a medium',
    example: 'a speaker, ringing bell, or vibrating object',
    answer: 'Sound energy is energy carried by vibrations traveling as sound waves through a medium.'
  }
];

const ENERGY_EXAMPLE_FACTS = [
  {
    id: 'food_chemical_energy',
    match: (text) => /\bfood\b/.test(text),
    answer: 'Food stores chemical energy, also called chemical potential energy, in chemical bonds. Your body can transform that chemical energy into kinetic or mechanical energy and thermal energy.'
  },
  {
    id: 'gasoline_chemical_energy',
    match: (text) => /\b(?:gasoline|fuel)\b/.test(text),
    answer: 'Gasoline and fuel store chemical energy in chemical bonds.'
  },
  {
    id: 'battery_chemical_energy',
    match: (text) => /\bbatter(?:y|ies)\b/.test(text),
    answer: 'A battery stores chemical energy. When it is connected in a circuit, that chemical energy can be transformed into electrical energy.'
  },
  {
    id: 'outlet_electrical_energy',
    match: (text) => /\b(?:wall\s+outlet|outlet|outlets)\b/.test(text),
    answer: 'A wall outlet provides electrical energy, which is energy from moving electric charges.'
  },
  {
    id: 'speaker_sound_energy',
    match: (text) => /\bspeakers?\b/.test(text),
    answer: 'A speaker produces sound energy. Usually electrical energy changes into vibrations, which travel as sound energy.'
  },
  {
    id: 'lamp_radiant_thermal_energy',
    match: (text) => /\b(?:lamp|light\s+bulb|bulb)\b/.test(text),
    answer: 'A lamp or light bulb gives off radiant energy, or light energy, and also some thermal energy as heat.'
  },
  {
    id: 'sun_radiant_thermal_energy',
    match: (text) => /\b(?:sun|sunlight)\b/.test(text),
    answer: 'The Sun gives off radiant energy, including light, and thermal energy as heat.'
  },
  {
    id: 'moving_object_kinetic_energy',
    match: (text) => /\b(?:moving\s+(?:car|bike|object)|car\s+moving|bike\s+moving|rolling\s+ball|running\s+person)\b/.test(text),
    answer: 'A moving object has kinetic energy because it is moving. Kinetic energy is energy of motion and is a form of mechanical energy.'
  },
  {
    id: 'shelf_height_gpe',
    match: (text) => /\b(?:book\s+on\s+(?:a\s+)?shelf|rock\s+up\s+high|rock\s+on\s+a\s+hill|ball\s+held\s+above|water\s+behind\s+a\s+dam|high\s+shelf)\b/.test(text),
    answer: 'That has gravitational potential energy because it has stored energy due to height or position.'
  },
  {
    id: 'elastic_stored_energy',
    match: (text) => /\b(?:stretched\s+rubber\s+band|rubber\s+band\s+pulled\s+back|pulled\s+back\s+rubber\s+band|compressed\s+spring|squished\s+spring|pulled\s+back\s+bow|stretched\s+spring)\b/.test(text),
    answer: 'That has elastic potential energy because energy is stored in something stretched or compressed.'
  },
  {
    id: 'hot_object_thermal_energy',
    match: (text) => /\b(?:hot\s+(?:cup\s+of\s+)?cocoa|hot\s+soup|hot\s+thing|hot\s+object|heater)\b/.test(text),
    answer: 'A hot object has thermal energy from particle motion. If it is glowing or giving off light, it may also give off radiant energy.'
  },
  {
    id: 'ringing_bell_sound_energy',
    match: (text) => /\b(?:ringing\s+bell|bell\s+ringing)\b/.test(text),
    answer: 'A ringing bell has sound energy because it makes vibrations that travel through a medium.'
  },
  {
    id: 'lightning_energy',
    match: (text) => /\blightning\b/.test(text),
    answer: 'Lightning has electrical energy from moving charges. It also gives off radiant or light energy and thermal energy.'
  }
];

const ENERGY_TRANSFORMATION_FACTS = [
  {
    id: 'flashlight_energy_transformation',
    match: (text) => /\b(?:flashlight|flashlite|battery\s+to\s+bulb)\b/.test(text),
    answer: 'In a flashlight, chemical energy in the battery changes to electrical energy, then to radiant or light energy and some thermal energy.'
  },
  {
    id: 'lamp_energy_transformation',
    match: (text) => /\b(?:lamp|light\s+bulb|bulb)\b/.test(text),
    answer: 'In a lamp, electrical energy changes into radiant or light energy and thermal energy.'
  },
  {
    id: 'speaker_energy_transformation',
    match: (text) => /\bspeakers?\b/.test(text),
    answer: 'In a speaker, electrical energy changes into sound energy.'
  },
  {
    id: 'food_running_energy_transformation',
    match: (text) => /\bfood\b/.test(text) && /\b(?:run|running|eat|eating)\b/.test(text),
    answer: 'When you eat food and run, chemical energy in food changes into kinetic or mechanical energy and thermal energy.'
  },
  {
    id: 'toaster_energy_transformation',
    match: (text) => /\btoaster\b/.test(text),
    answer: 'In a toaster, electrical energy changes into thermal energy and some radiant or light energy.'
  },
  {
    id: 'gasoline_car_energy_transformation',
    match: (text) => /\b(?:gasoline|fuel)\b/.test(text) && /\b(?:burns?|burning|car)\b/.test(text),
    answer: 'When gasoline burns in a car, chemical energy changes into thermal energy and mechanical or kinetic energy.'
  },
  {
    id: 'solar_panel_energy_transformation',
    match: (text) => /\bsolar\s+panel\b/.test(text),
    answer: 'In a solar panel, radiant or light energy from the Sun changes into electrical energy.'
  },
  {
    id: 'falling_ball_energy_transformation',
    match: (text) => /\b(?:ball|object|rock)\b/.test(text) && /\bfalls?|falling\b/.test(text),
    answer: 'When a ball falls, gravitational potential energy changes into kinetic energy.'
  },
  {
    id: 'released_rubber_band_energy_transformation',
    match: (text) => /\b(?:stretched|pulled\s+back)\s+rubber\s+band\b/.test(text) && /\breleased?\b/.test(text),
    answer: 'When a stretched rubber band is released, elastic potential energy changes into kinetic energy.'
  },
  {
    id: 'hand_warmer_energy_transformation',
    match: (text) => /\bhand\s+warmer\b/.test(text),
    answer: 'In a hand warmer, chemical energy changes into thermal energy, and the process releases heat.'
  }
];

const UNIT3_ENERGY_PACKET = buildUnit3EnergyPacket({
  directAnswerFacts: UNIT3_DIRECT_ANSWER_FACTS,
  energyTypeFacts: ENERGY_TYPE_FACTS,
  energyExampleFacts: ENERGY_EXAMPLE_FACTS,
  energyTransformationFacts: ENERGY_TRANSFORMATION_FACTS,
  matcherName: 'tryUnit3EnergyKnowledge'
});

function answerBroadEnergyTypePrompt(text) {
  if (asksBroadEnergyTypeList(text)) {
    return concept('broad_energy_type_list', 'Common energy types include mechanical energy, kinetic energy, potential energy, thermal energy, chemical energy, electrical energy, radiant or light energy, and sound energy. Examples: moving objects have kinetic energy; food and batteries store chemical energy; a lamp gives off radiant/light and thermal energy; a speaker produces sound energy.');
  }

  if (asksMultiEnergyTypeExplanation(text)) {
    return concept('broad_energy_type_explanations', ENERGY_TYPE_FACTS
      .filter((fact) => /chemical|thermal|electrical|radiant|sound|mechanical/.test(fact.id))
      .map((fact) => `${fact.name}: ${fact.definition}.`)
      .join(' '));
  }

  if (asksMotionEnergyType(text)) {
    return concept('motion_energy_type', 'Kinetic energy is most connected to motion because kinetic energy is energy of motion.');
  }

  if (asksStoredEnergyType(text)) {
    return concept('stored_energy_type', 'Potential energy is stored energy. Depending on the example, stored energy can be chemical energy, gravitational potential energy, or elastic potential energy.');
  }

  return null;
}

function answerEnergyTransformationQuestion(text) {
  if (!asksEnergyTransformation(text)) return null;
  const fact = ENERGY_TRANSFORMATION_FACTS.find((item) => item.match(text));
  if (!fact) return null;
  return concept(fact.id, fact.answer);
}

function asksBroadEnergyTypeList(text) {
  return /\b(?:what\s+are|list|name)\s+(?:the\s+)?(?:main\s+|different\s+|common\s+)?types?\s+of\s+energy\b/.test(text) ||
    /\blist\s+energy\s+types?\s+with\s+examples?\b/.test(text) ||
    /\bgive\s+examples?\s+of\s+each\s+type\s+of\s+energy\b/.test(text);
}

function asksMultiEnergyTypeExplanation(text) {
  return /\bexplain\b/.test(text) &&
    /\bchemical\b/.test(text) &&
    /\bthermal\b/.test(text) &&
    /\belectrical\b/.test(text) &&
    /\b(?:radiant|light)\b/.test(text) &&
    /\bsound\b/.test(text) &&
    /\bmechanical\b/.test(text);
}

function asksMotionEnergyType(text) {
  return /\bwhat\s+type\s+of\s+energy\b/.test(text) &&
    /\b(?:most\s+)?connected\s+to\s+motion\b/.test(text);
}

function asksStoredEnergyType(text) {
  return /\bwhat\s+type\s+of\s+energy\b/.test(text) &&
    /\bstored\s+energy\b/.test(text);
}

function asksEnergyTransformation(text) {
  return /\b(?:energy\s+transformation|energy\s+change|energy\s+transform|energy\s+transformashun|energy\s+converted|energy\s+conversion|what\s+energy\s+transforms?|what\s+energy\s+changes?|what\s+energy\s+change\s+happens)\b/.test(text) ||
    /\bchanges?\s+(?:into|to)\b/.test(text) && /\benergy\b/.test(text) ||
    /\bbattery\s+to\s+bulb\b/.test(text);
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
  if (asksMechanicalSameAsKinetic(text)) {
    return definition('mechanical_energy_not_same_as_kinetic', 'No. Kinetic energy is one kind of mechanical energy. Mechanical energy includes kinetic energy and potential energy.');
  }

  if (asksKineticPotentialDifference(text)) {
    return definition('kinetic_potential_energy_difference', 'Kinetic energy and potential energy are related because energy can change between motion and stored energy. Kinetic Energy: energy an object has because it is moving; KE = 1/2 × m × v^2. Gravitational Potential Energy: stored energy because of height or position; GPE = m × g × h.');
  }

  if (asksThermalTemperatureDifference(text)) {
    return definition('thermal_temperature_difference', 'Temperature measures the average motion, or average kinetic energy, of particles. Thermal energy depends on particle motion and the amount of matter present.');
  }

  if (asksRadiantSoundDifference(text)) {
    return definition('radiant_sound_energy_difference', 'Radiant energy travels as electromagnetic waves and can travel through empty space. Sound energy comes from vibrations and needs a medium.');
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
    return definition('gravitational_potential_energy', 'Gravitational potential energy is stored energy due to height or position in a gravitational field. For calculations, GPE = m x g x h.');
  }

  if (asksElasticPotentialEnergy(text)) {
    return definition('elastic_potential_energy', 'Elastic potential energy is stored energy in something stretched or compressed, such as a rubber band, spring, bow, or slingshot.');
  }

  if (asksChemicalEnergyDefinition(text)) {
    return definition('chemical_energy', ENERGY_TYPE_FACTS.find((fact) => fact.id === 'chemical_energy').answer);
  }

  if (asksThermalEnergyDefinition(text)) {
    return definition('thermal_energy', `${ENERGY_TYPE_FACTS.find((fact) => fact.id === 'thermal_energy').answer} In this class, it can also be described as the total kinetic and potential energy of particles in an object.`);
  }

  if (asksElectricalEnergyDefinition(text)) {
    return definition('electrical_energy', 'Electrical energy is energy from moving electric charges or current, such as energy in an electric current, lightning, or an outlet.');
  }

  if (asksRadiantEnergyDefinition(text)) {
    return definition('radiant_energy', 'Radiant energy is energy carried by electromagnetic waves, including light. Sunlight and light from a lamp are common examples.');
  }

  if (asksOpticalOrLightEnergyDefinition(text)) {
    return definition('optical_light_energy', 'Light energy is radiant energy that can travel as electromagnetic waves. In this class context, optical energy and light energy are usually treated as radiant energy.');
  }

  if (asksSoundEnergyDefinition(text)) {
    return definition('sound_energy', ENERGY_TYPE_FACTS.find((fact) => fact.id === 'sound_energy').answer);
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

  const exampleFact = ENERGY_EXAMPLE_FACTS.find((item) => item.match(text));
  if (exampleFact) return concept(exampleFact.id, exampleFact.answer);

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
    return concept('sound_energy_example', 'That is sound energy because it comes from vibrations traveling as sound waves through matter, which is the medium.');
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

function asksMechanicalSameAsKinetic(text) {
  return hasPhrase(text, 'mechanical energy') &&
    hasPhrase(text, 'kinetic energy') &&
    /\b(?:same|same as|equal|only)\b/.test(text);
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

function asksThermalTemperatureDifference(text) {
  return /\b(?:difference|different|compare|contrast)\b/.test(text) &&
    hasPhrase(text, 'thermal') &&
    hasPhrase(text, 'temperature');
}

function asksRadiantSoundDifference(text) {
  return asksEnergyDifference(text) &&
    hasPhrase(text, 'radiant') &&
    hasPhrase(text, 'sound');
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
    /\bwhat\s+energy\s+(?:is|does|comes?|gives?|stored|in)\b/.test(text) ||
    /\bwhat\s+(?:energy|kind\s+of\s+energy)\s+is\b/.test(text) ||
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
  return /\b(?:hot\s+soup|hot\s+cocoa|hot\s+thing|heat|particles?\s+move\s+faster|particles?\s+moving\s+faster|particle\s+motion)\b/.test(text) &&
    !/\b(?:radiant|light|sound)\b/.test(text);
}

function hasElectricalEnergyExample(text) {
  return /\b(?:electric\s+current|electrical\s+current|lightning|outlet|outlets|electricity)\b/.test(text);
}

function hasRadiantEnergyExample(text) {
  return /\b(?:sunlight|sun\s+light|light\s+from\s+the\s+sun|lamp|light\s+energy|optical\s+energy|radiant\s+energy)\b/.test(text);
}

function hasSoundEnergyExample(text) {
  return /\b(?:sound|ringing\s+bell|vibrating\s+speaker|speaker\s+vibrating|speakers?|vibrations?\s+through\s+matter|travels?\s+as\s+vibrations?)\b/.test(text);
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
  return /\b(?:schoolwork|homework|job|labor|assignment|essay)\b/.test(text) ||
    /\bshow(?:ing)?\s+work\b/.test(text);
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
    .replace(/\bbatery\b/g, 'battery')
    .replace(/\benegy\b/g, 'energy')
    .replace(/\benery\b/g, 'energy')
    .replace(/\blite\b/g, 'light')
    .replace(/\bspeeker\b/g, 'speaker')
    .replace(/\bflashlite\b/g, 'flashlight')
    .replace(/\btransformashun\b/g, 'transformation')
    .replace(/[^a-z0-9µμ°/.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  tryUnit3EnergyKnowledge,
  UNIT3_DIRECT_ANSWER_FACTS,
  ENERGY_TYPE_FACTS,
  ENERGY_EXAMPLE_FACTS,
  ENERGY_TRANSFORMATION_FACTS,
  UNIT3_ENERGY_PACKET
};
