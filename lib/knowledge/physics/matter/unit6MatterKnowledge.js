const { buildUnit6MatterPacket } = require('./unit6MatterPacketAdapter');

const UNIT6_MATTER_FACTS = [
  matterFact('matter_definition', 'definition', 'matter', 'Matter is anything that has mass and takes up space, or volume.', { category: 'classification', aliases: ['mass', 'volume'], smokePrompt: 'what is matter' }),
  matterFact('matter_classification', 'science_concept', 'classification of matter', 'Matter is classified as either a substance or a mixture. Substances have fixed composition, while mixtures are physically combined and can vary.', { category: 'classification', aliases: ['substance', 'mixture'], smokePrompt: 'matter is classified as what two main categories' }),
  matterFact('substance', 'definition', 'substance', 'A substance is matter with identical particles and a fixed, definite composition.', { category: 'classification', aliases: ['pure substance', 'fixed composition'], smokePrompt: 'what is a substance in matter' }),
  matterFact('mixture', 'definition', 'mixture', 'A mixture is two or more substances physically combined. It has variable composition because the parts are not chemically bonded in a fixed ratio.', { category: 'classification', aliases: ['physically combined', 'variable composition'], smokePrompt: 'what is a mixture in matter' }),
  matterFact('element_compound_difference', 'science_concept', 'element and compound difference', 'An element has one type of atom and is listed on the periodic table. A compound has two or more different elements chemically combined in a fixed proportion.', { category: 'classification', aliases: ['element vs compound'], smokePrompt: 'what is the difference between an element and a compound' }),
  matterFact('element', 'definition', 'element', 'An element is the simplest form of matter: one type of atom, listed on the periodic table.', { category: 'classification', aliases: ['atom', 'periodic table'], smokePrompt: 'what is an element' }),
  matterFact('compound', 'definition', 'compound', 'A compound is a substance made of two or more elements chemically combined in a fixed proportion.', { category: 'classification', aliases: ['chemically combined', 'molecule'], smokePrompt: 'what is a compound' }),
  matterFact('homogeneous_heterogeneous_difference', 'science_concept', 'homogeneous and heterogeneous mixture difference', 'A homogeneous mixture is uniform and the same throughout. A heterogeneous mixture is uneven, with different parts visible or able to separate.', { category: 'classification', aliases: ['homogeneous mixture', 'heterogeneous mixture'], smokePrompt: 'what is the difference between a homogeneous and heterogeneous mixture' }),
  matterFact('homogeneous_mixture', 'definition', 'homogeneous mixture', 'A homogeneous mixture is evenly distributed and the same throughout. A solution is a homogeneous mixture.', { category: 'classification', aliases: ['solution', 'uniform'], smokePrompt: 'what is a homogeneous mixture' }),
  matterFact('heterogeneous_mixture', 'definition', 'heterogeneous mixture', 'A heterogeneous mixture is unevenly distributed, with different parts visible or able to separate.', { category: 'classification', aliases: ['different parts', 'visible parts'], smokePrompt: 'what is a heterogeneous mixture' }),
  matterFact('colloid', 'definition', 'colloid', 'A colloid is a heterogeneous mixture with small dispersed particles. The particles are larger than solution particles and can scatter light.', { category: 'classification', aliases: ['Tyndall effect'], smokePrompt: 'what is a colloid' }),
  matterFact('suspension', 'definition', 'suspension', 'A suspension is a heterogeneous mixture with larger particles that settle out over time.', { category: 'classification', aliases: ['settle out'], smokePrompt: 'what is a suspension' }),
  matterFact('tyndall_effect', 'definition', 'Tyndall effect', 'The Tyndall effect is the scattering of light by colloids or suspensions. True solutions do not show the Tyndall effect.', { category: 'classification', aliases: ['light scattering'], smokePrompt: 'what is the tyndall effect' }),
  matterFact('physical_property', 'definition', 'physical property', 'A physical property can be observed or measured without changing the chemical identity of the substance.', { category: 'properties_changes', smokePrompt: 'what is a physical property' }),
  matterFact('chemical_property', 'definition', 'chemical property', 'A chemical property is observed during a chemical change or reaction, when chemical identity changes and a new substance can form.', { category: 'properties_changes', smokePrompt: 'what is a chemical property' }),
  matterFact('physical_chemical_change_difference', 'science_concept', 'physical and chemical change difference', 'Physical changes affect form, size, shape, or state, but the substance keeps the same identity. Chemical changes form a new substance.', { category: 'properties_changes', aliases: ['physical change vs chemical change'], smokePrompt: 'what is the difference between physical and chemical changes' }),
  matterFact('physical_chemical_change_examples', 'science_concept', 'physical and chemical change examples', 'Examples of physical changes include melting ice, freezing water, tearing paper, cutting wood, and dissolving sugar in water. Examples of chemical changes include burning wood, rust forming, baking a cake, and vinegar with baking soda fizzing.', { category: 'properties_changes', examples: ['melting ice is a physical change', 'burning wood is a chemical change'] }),
  matterFact('chemical_change_signs', 'science_concept', 'signs of chemical change', 'Signs of a chemical change include release of light, temperature change, odor change, sudden color change, gas or bubbles given off, and a precipitate forming.', { category: 'properties_changes', smokePrompt: 'what are signs of a chemical change' }),
  matterFact('physical_change', 'definition', 'physical change', 'A physical change affects physical properties such as size, shape, or state, but the substance keeps the same identity.', { category: 'properties_changes', smokePrompt: 'what is a physical change' }),
  matterFact('chemical_change', 'definition', 'chemical change', 'A chemical change is a chemical reaction: atoms rearrange and a new substance forms.', { category: 'properties_changes', smokePrompt: 'what is a chemical change' }),
  matterFact('conservation_of_mass', 'science_concept', 'conservation of mass', 'The law of conservation of mass or matter says matter is not created and not destroyed during a chemical change. In a closed system, total mass stays the same.', { category: 'properties_changes', aliases: ['conservation of matter'], smokePrompt: 'what is conservation of mass' }),
  matterFact('melting_boiling_physical_properties', 'science_concept', 'melting point and boiling point', 'Melting point and boiling point are physical properties because they can be measured without changing the substance’s identity.', { category: 'properties_changes', aliases: ['physical properties'] }),
  matterFact('density_property', 'definition', 'density', 'Density is mass per unit volume. Density tells how much mass is packed into a certain volume. Formula: density = mass / volume; D = m / V. Common units are g/cm3 and g/mL. Density is a physical property and does not change with sample size.', { category: 'density', aliases: ['mass per unit volume', 'D = m / V'], smokePrompt: 'what is density' }),
  matterFact('density_identifies_substance', 'science_concept', 'density identifies substance', 'Density helps identify a substance because it is a characteristic physical property. A pure substance has the same density no matter the sample size.', { category: 'density', aliases: ['characteristic physical property'], smokePrompt: 'Why does density help identify a substance?' }),
  matterFact('density_float_sink', 'science_concept', 'density float sink', 'Water has a density of about 1 g/mL. An object less dense than water floats, and an object more dense than water sinks.', { category: 'density', aliases: ['float', 'sink'], smokePrompt: 'why does density tell if something floats or sinks in water' }),
  matterFact('viscosity', 'definition', 'viscosity', 'Viscosity is a liquid’s resistance to flow, or thickness. Syrup has higher viscosity and is more viscous than water or alcohol, so it pours more slowly.', { category: 'density', aliases: ['viscous', 'resistance to flow'], smokePrompt: 'what is viscosity' }),
  matterFact('matter_small_particles', 'science_concept', 'kinetic molecular theory', 'Kinetic molecular theory says all matter is made of small particles.', { category: 'states_kmt', aliases: ['small particles'] }),
  matterFact('particles_constant_motion', 'science_concept', 'particles in matter', 'Particles in matter are in constant random motion.', { category: 'states_kmt', aliases: ['constant motion'] }),
  matterFact('temperature_average_ke', 'definition', 'temperature', 'Temperature measures the average kinetic energy of the particles in matter.', { category: 'states_kmt', aliases: ['average kinetic energy'], smokePrompt: 'what does temperature measure' }),
  matterFact('heating_particles', 'science_concept', 'heating particles', 'Heating matter makes its particles move faster and increases their kinetic energy.', { category: 'states_kmt', aliases: ['kinetic energy'] }),
  matterFact('solid_particles', 'science_concept', 'solid particles', 'In a solid, particles are tightly packed, have low kinetic energy, and vibrate in place.', { category: 'states_kmt', aliases: ['vibrate in place'], smokePrompt: 'how do solid particles move' }),
  matterFact('liquid_particles', 'science_concept', 'liquid particles', 'Liquid particles have more kinetic energy than solid particles and can slide or flow past each other.', { category: 'states_kmt', aliases: ['slide past each other'] }),
  matterFact('solid_shape_volume', 'science_concept', 'solid shape and volume', 'A solid has a definite, fixed shape and a definite, fixed volume.', { category: 'states_kmt', aliases: ['definite shape', 'definite volume'], smokePrompt: 'what shape and volume does a solid have' }),
  matterFact('liquid_shape_volume', 'science_concept', 'liquid shape and volume', 'A liquid has a definite volume but takes the shape of its container.', { category: 'states_kmt', aliases: ['container shape'] }),
  matterFact('gas_shape_volume', 'science_concept', 'gas shape and volume', 'A gas has no definite shape and no definite volume. It spreads out to fill its container.', { category: 'states_kmt', aliases: ['fills container'], smokePrompt: 'does a gas have fixed shape or volume' }),
  matterFact('gas_particles_far_apart', 'science_concept', 'gas particles', 'Gas particles are farthest apart among solids, liquids, and gases.', { category: 'states_kmt', aliases: ['farthest apart'] }),
  matterFact('gases_spread', 'science_concept', 'gases spread out', 'Gases spread out because their particles move freely with high kinetic energy and diffuse to fill the container.', { category: 'states_kmt', aliases: ['diffuse'] }),
  matterFact('diffusion', 'definition', 'diffusion', 'Diffusion is the spreading of particles from higher concentration to lower concentration until they are more evenly mixed.', { category: 'states_kmt', smokePrompt: 'what is diffusion' }),
  matterFact('plasma', 'definition', 'plasma', 'Plasma is a high-energy state of matter made of charged particles. It is found in stars, neon lights, lightning, and auroras, and it is common in the universe.', { category: 'states_kmt', aliases: ['charged particles'], examples: ['stars', 'neon lights', 'lightning', 'auroras'], smokePrompt: 'what is plasma' }),
  matterFact('bose_einstein_condensate', 'definition', 'Bose-Einstein condensate', 'A Bose-Einstein condensate is matter super-cooled near absolute zero so particles act like a “super atom.” It can be used to simulate black-hole conditions.', { category: 'states_kmt', aliases: ['BEC'] }),
  matterFact('heating_curve_0_flat', 'science_concept', 'heating curve flat part at 0°C', 'On a water heating curve, the flat part at 0°C is melting: solid ice and liquid water are both present, and added energy is heat of fusion.', { category: 'state_changes' }),
  matterFact('heating_curve_liquid', 'science_concept', 'heating curve liquid segment', 'On the common five-segment heating curve, segment 3 is liquid. For water, liquid water is between 0°C and 100°C.', { category: 'state_changes' }),
  matterFact('heating_curve_segment_1', 'science_concept', 'heating curve segment 1', 'Segment 1 on a heating curve is the solid state.', { category: 'state_changes', aliases: ['solid'] }),
  matterFact('heating_curve_segment_2', 'science_concept', 'heating curve segment 2', 'Segment 2 is the melting point, or heat of fusion, where solid and liquid are both present.', { category: 'state_changes', aliases: ['melting'] }),
  matterFact('heating_curve_segment_3', 'science_concept', 'heating curve segment 3', 'Segment 3 is the liquid state.', { category: 'state_changes', aliases: ['liquid'] }),
  matterFact('heating_curve_segment_4', 'science_concept', 'heating curve segment 4', 'Segment 4 is the boiling point, or heat of vaporization, where liquid and gas are both present.', { category: 'state_changes', aliases: ['boiling'] }),
  matterFact('heating_curve_segment_5', 'science_concept', 'heating curve segment 5', 'Segment 5 on a heating curve is the gas state.', { category: 'state_changes', aliases: ['gas'] }),
  matterFact('heating_curve', 'definition', 'heating curve', 'A heating curve is a diagram showing state or phase transitions as heat energy is added.', { category: 'state_changes' }),
  matterFact('heat_of_fusion', 'definition', 'heat of fusion', 'Heat of fusion is the energy needed to turn a solid into a liquid at its melting point.', { category: 'state_changes' }),
  matterFact('heat_of_vaporization', 'definition', 'heat of vaporization', 'Heat of vaporization is the energy needed to turn a liquid into a gas at its boiling point.', { category: 'state_changes' }),
  matterFact('boiling_evaporation_difference', 'science_concept', 'boiling and evaporation difference', 'Evaporation changes liquid to gas at the surface. Boiling changes liquid to gas throughout the liquid at the boiling point.', { category: 'state_changes', aliases: ['evaporation vs boiling'], smokePrompt: 'what is the difference between evaporation and boiling' }),
  matterFact('vaporization_evaporation_difference', 'science_concept', 'vaporization and evaporation difference', 'Vaporization is liquid changing to gas. Evaporation is vaporization at the surface of a liquid, while boiling happens throughout the liquid.', { category: 'state_changes' }),
  matterFact('melting_physical_change', 'science_concept', 'melting as a physical change', 'Melting ice is a physical change because it is still the same substance: water. Its identity stays the same; only the state changes.', { category: 'state_changes' }),
  matterFact('melting', 'definition', 'melting', 'Melting is the state change from solid to liquid.', { category: 'state_changes', smokePrompt: 'what is melting' }),
  matterFact('freezing', 'definition', 'freezing', 'Freezing is the state change from liquid to solid.', { category: 'state_changes' }),
  matterFact('vaporization', 'definition', 'vaporization', 'Vaporization is the state change from liquid to gas.', { category: 'state_changes' }),
  matterFact('condensation', 'definition', 'condensation', 'Condensation is the state change from gas to liquid.', { category: 'state_changes' }),
  matterFact('sublimation', 'definition', 'sublimation', 'Sublimation is the state change from solid directly to gas. Dry ice is a common example.', { category: 'state_changes', examples: ['dry ice sublimates'] }),
  matterFact('deposition', 'definition', 'deposition', 'Deposition is the state change from gas directly to solid. Frost forming is a common example.', { category: 'state_changes', examples: ['frost forming is deposition'] }),
  matterFact('solution', 'definition', 'solution', 'A solution is a homogeneous mixture with the same composition throughout, so it is uniform and the same throughout.', { category: 'solutions', aliases: ['homogeneous mixture'], smokePrompt: 'what is a solution' }),
  matterFact('solvent', 'definition', 'solvent', 'A solvent is the substance that does the dissolving in a solution.', { category: 'solutions', smokePrompt: 'what is a solvent' }),
  matterFact('solute', 'definition', 'solute', 'A solute is the substance that gets dissolved in a solution.', { category: 'solutions', smokePrompt: 'what is a solute' }),
  matterFact('solute_solvent_difference', 'science_concept', 'solute and solvent difference', 'The solute is the substance being dissolved. The solvent is the substance doing the dissolving.', { category: 'solutions', aliases: ['solute vs solvent'], smokePrompt: 'what is the difference between solute and solvent' }),
  matterFact('alloy', 'definition', 'alloy', 'An alloy is a solid solution made when metals are dissolved in other metals.', { category: 'solutions', examples: ['brass', 'bronze', 'sterling silver'] }),
  matterFact('solubility_curve', 'definition', 'solubility curve', 'A solubility curve shows how much solute a solvent can hold at different temperatures.', { category: 'solutions' }),
  matterFact('supersaturated', 'definition', 'supersaturated solution', 'A supersaturated solution contains more solute than it can normally hold at that temperature, so it is unstable and extra solute may collect.', { category: 'solutions' }),
  matterFact('unsaturated', 'definition', 'unsaturated solution', 'An unsaturated solution can dissolve more solute at that temperature.', { category: 'solutions' }),
  matterFact('saturated', 'definition', 'saturated solution', 'A saturated solution contains all the solute it can hold at that temperature.', { category: 'solutions' }),
  matterFact('solubility', 'definition', 'solubility', 'Solubility is the maximum amount of solute that can dissolve in a certain amount of solvent at a given temperature.', { category: 'solutions', smokePrompt: 'what is solubility' }),
  matterFact('dissociation', 'definition', 'dissociation', 'Dissociation is when ionic compounds separate into ions, and water molecules surround the ions.', { category: 'solutions', aliases: ['ions', 'molecules'] }),
  matterFact('solubility_physical_property', 'science_concept', 'solubility as a physical property', 'Solubility is a physical property. It describes how well a solute dissolves in a solvent.', { category: 'solutions' }),
  matterFact('matter_classification_quiz_prompt', 'science_concept', 'homogeneous heterogeneous quiz prompt', 'Quick check: homogeneous mixtures are uniform and the same throughout, while heterogeneous mixtures have different visible parts. Which one describes trail mix? 1. homogeneous 2. heterogeneous', { category: 'classification' }),
  matterFact('state_change_teach_prompt', 'science_concept', 'state changes teach prompt', 'Quick check: state changes are physical changes. Melting is solid to liquid, freezing is liquid to solid, vaporization is liquid to gas, and condensation is gas to liquid.', { category: 'state_changes' }),
  matterFact('solute_solvent_quiz_prompt', 'science_concept', 'solute solvent quiz prompt', 'Quick check: in a solution, the solute is dissolved and the solvent does the dissolving. In lemonade, sugar is a solute and water is the solvent.', { category: 'solutions' })
];

const UNIT6_MATTER_PACKET = buildUnit6MatterPacket({
  facts: UNIT6_MATTER_FACTS,
  matcherName: 'tryUnit6MatterKnowledge'
});
const PACKET_FACTS_BY_ID = new Map(UNIT6_MATTER_PACKET.canonicalFacts.map((fact) => [fact.id, fact]));

function tryUnit6MatterKnowledge(message) {
  const text = normalize(message);
  if (!text) return null;

  if (looksLikeDensityCalculation(text) && !asksDensityFloatSinkConcept(text)) return null;

  const answer = answerMatterConcept(text);
  if (!answer) return null;

  return {
    type: answer.type || 'science_concept',
    confidence: 'strong',
    toolsUsed: ['unit6_matter_knowledge'],
    notes: `Answered Unit 6 Matter concept: ${answer.id}.`,
    directAnswer: answer.answer,
    aiAllowed: false
  };
}

function answerMatterConcept(text) {
  if (asksMatterDefinition(text)) {
    return definition('matter_definition');
  }

  if (asksMatterClassification(text)) {
    return concept('matter_classification');
  }

  if (asksSubstanceDefinition(text)) {
    return definition('substance');
  }

  if (asksMixtureDefinition(text)) {
    return definition('mixture');
  }

  if (asksElementCompoundDifference(text)) {
    return concept('element_compound_difference');
  }

  if (asksElementDefinition(text)) {
    return definition('element');
  }

  if (asksCompoundDefinition(text)) {
    return definition('compound');
  }

  if (asksHomogeneousHeterogeneousDifference(text)) {
    return concept('homogeneous_heterogeneous_difference');
  }

  if (asksHomogeneousDefinition(text)) {
    return definition('homogeneous_mixture');
  }

  if (asksHeterogeneousDefinition(text)) {
    return definition('heterogeneous_mixture');
  }

  if (asksColloidDefinition(text)) {
    return definition('colloid');
  }

  if (asksSuspensionDefinition(text)) {
    return definition('suspension');
  }

  if (asksTyndallEffect(text)) {
    return definition('tyndall_effect');
  }

  if (asksSolubilityPhysicalProperty(text)) {
    return concept('solubility_physical_property');
  }

  const solutionAnswer = answerSolutions(text);
  if (solutionAnswer) return solutionAnswer;

  const classification = classifyMatterExample(text);
  if (classification) return classification;

  if (asksPhysicalPropertyDefinition(text)) {
    return definition('physical_property');
  }

  if (asksChemicalPropertyDefinition(text)) {
    return definition('chemical_property');
  }

  if (asksPhysicalChemicalChangeDifference(text)) {
    return concept('physical_chemical_change_difference');
  }

  if (asksPhysicalChemicalChangeExamples(text)) {
    return concept('physical_chemical_change_examples');
  }

  if (asksChemicalChangeSigns(text)) {
    return concept('chemical_change_signs');
  }

  if (asksPhysicalChangeDefinition(text)) {
    return definition('physical_change');
  }

  if (asksChemicalChangeDefinition(text)) {
    return definition('chemical_change');
  }

  if (asksConservationMass(text)) {
    if (/\brust\b/.test(text)) {
      return concept('rust_conservation_mass', 'In a closed system, the mass of rust equals the mass of iron plus oxygen before the reaction because mass is conserved: matter is not created and not destroyed.');
    }
    return concept('conservation_of_mass');
  }

  if (asksMeltingBoilingPhysicalProperties(text)) {
    return concept('melting_boiling_physical_properties');
  }

  const stateChangeAnswer = answerStateChange(text);
  if (stateChangeAnswer) return stateChangeAnswer;

  const propertyChange = classifyPropertyOrChange(text);
  if (propertyChange) return propertyChange;

  if (asksDensityConcept(text)) {
    return definition('density_property');
  }

  if (asksDensityIdentifySubstance(text)) {
    return concept('density_identifies_substance');
  }

  if (asksDensityFloatSinkConcept(text)) {
    return concept('density_float_sink');
  }

  if (asksViscosity(text)) {
    return definition('viscosity');
  }

  if (asksKmtSmallParticles(text)) {
    return concept('matter_small_particles');
  }

  if (asksParticlesConstantMotion(text)) {
    return concept('particles_constant_motion');
  }

  if (asksTemperature(text)) {
    return definition('temperature_average_ke');
  }

  if (asksHeatingParticles(text)) {
    return concept('heating_particles');
  }

  const heatingCurveAnswer = answerHeatingCurve(text);
  if (heatingCurveAnswer) return heatingCurveAnswer;

  const stateAnswer = answerStateMatter(text);
  if (stateAnswer) return stateAnswer;

  const tutorPromptAnswer = answerMatterTutorPrompt(text);
  if (tutorPromptAnswer) return tutorPromptAnswer;

  return null;
}

function classifyMatterExample(text) {
  if (/\b(?:salt|nacl|sodium chloride)\b/.test(text)) {
    return concept('salt_compound', 'Salt, or NaCl, is a compound because sodium and chlorine are chemically combined in a fixed proportion.');
  }
  if (/\b(?:carbon dioxide|co2)\b/.test(text)) {
    return concept('carbon_dioxide_compound', 'Carbon dioxide, CO2, is a compound because carbon and oxygen are chemically combined.');
  }
  if (/\bhcl\b|hydrogen chloride|hydrochloric/.test(text)) {
    return concept('hcl_compound', 'HCl is a compound because hydrogen and chlorine are chemically combined.');
  }
  if (/\b(?:oxygen|chlorine|hydrogen|gold|iron)\b/.test(text) && /\belements?\b|element or compound|are\b/.test(text)) {
    const names = [];
    if (/\bhydrogen\b/.test(text)) names.push('hydrogen');
    if (/\bgold\b/.test(text)) names.push('gold');
    if (/\biron\b/.test(text)) names.push('iron');
    if (/\boxygen\b/.test(text)) names.push('oxygen');
    if (/\bchlorine\b/.test(text)) names.push('chlorine');
    const subject = names.length ? sentenceList(names) : 'Those substances';
    return concept('elements_examples', `${capitalize(subject)} ${names.length > 1 ? 'are' : 'is'} elements. An element has one type of atom and is listed on the periodic table.`);
  }
  const classification = classifyKnownMixtureExample(text);
  if (classification) return classification;

  if (/\bhot chocolate\b/.test(text) && /\b(?:marshmallows?|whipped cream)\b/.test(text)) {
    return concept('hot_chocolate_heterogeneous', 'Hot chocolate with marshmallows or whipped cream is a heterogeneous mixture because it has different visible parts.');
  }
  if (/\biron\b/.test(text) && /\bsand\b/.test(text)) {
    return concept('iron_sand_heterogeneous', 'Iron and sand form a heterogeneous mixture because the parts are different and can be separated physically, such as with a magnet.');
  }
  if (/\bair\b/.test(text) && /\bsolution\b|classify|mixture/.test(text)) {
    return concept('air_solution', 'Air is a gaseous solution and a homogeneous mixture because its gases are evenly mixed.');
  }
  return null;
}

function classifyKnownMixtureExample(text) {
  const asksClassification = /\bhomo\b|\bhetero\b|\bhomogeneous\b|\bhomogenous\b|\bheterogeneous\b|\bheterogenous\b|\bclassify\b|\bmixture\b|\bsolution\b|\bsuspension\b|\bcolloid\b/.test(text);

  if (/\b(?:olive oil|oil)\b/.test(text) && /\bwater\b/.test(text)) {
    return concept('oil_water_suspension', 'Olive oil in water is a heterogeneous mixture, like the Unit 6 oil-in-water suspension example. The oil droplets do not form a true homogeneous solution and can separate.');
  }

  const colloidMatch = matchExample(text, [
    ['milk', 'Milk'],
    ['paint|pant', 'Paint'],
    ['mayonnaise|mayo', 'Mayonnaise'],
    ['toothpaste', 'Toothpaste']
  ]);
  if (colloidMatch && (asksClassification || colloidMatch.label !== 'Paint' || /\bpaint\b/.test(text))) {
    if (colloidMatch.label === 'Toothpaste') {
      return concept('toothpaste_colloid', 'Toothpaste is usually treated as a colloid, so in this unit it fits best as a heterogeneous mixture even if it looks smooth.');
    }
    return concept('colloid_examples', `${colloidMatch.label} is a colloid, which is a heterogeneous mixture with small dispersed particles. It is not a homogeneous solution.`);
  }

  const homogeneousMatch = matchExample(text, [
    ['lemonade', 'Lemonade'],
    ['sugar water', 'Sugar water'],
    ['saltwater|salt water', 'Saltwater'],
    ['black coffee|coffee', 'Black coffee'],
    ['mineral water', 'Mineral water'],
    ['bleach', 'Bleach'],
    ['vinegar', 'Vinegar'],
    ['pure maple syrup', 'Pure maple syrup'],
    ['distilled water', 'Distilled water']
  ]);
  if (homogeneousMatch) {
    const usually = /mineral water|vinegar|pure maple syrup|distilled water/.test(homogeneousMatch.pattern) ? 'usually ' : '';
    return concept('homogeneous_examples', `${homogeneousMatch.label} is ${usually}a homogeneous mixture, or solution, because its particles are evenly mixed and the same throughout.`);
  }

  if (/\bair\b/.test(text) && /\bsolution|classify|mixture|homo|hetero\b/.test(text)) {
    return concept('air_solution', 'Air is a gaseous solution and a homogeneous mixture because its gases are evenly mixed.');
  }

  const heterogeneousMatch = matchExample(text, [
    ['trail mix', 'Trail mix'],
    ['fruit salad', 'Fruit salad'],
    ['mixed nuts', 'Mixed nuts'],
    ['vegetable soup', 'Vegetable soup'],
    ['pizza', 'Pizza'],
    ['salad dressing', 'Salad dressing'],
    ['dirt|soil', 'Dirt'],
    ['skittles', 'Skittles'],
    ['asphalt', 'Asphalt'],
    ['iron.*sand|sand.*iron', 'Iron and sand'],
    ['sand in water', 'Sand in water'],
    ['muddy water', 'Muddy water']
  ]);
  if (heterogeneousMatch) {
    if (heterogeneousMatch.label === 'Iron and sand') {
      return concept('iron_sand_heterogeneous', 'Iron and sand form a heterogeneous mixture because the parts are different and can be separated physically, such as with a magnet.');
    }
    if (heterogeneousMatch.label === 'Dirt') {
      return concept('dirt_heterogeneous', 'Dirt or soil is usually heterogeneous because it has different visible parts or particles.');
    }
    if (heterogeneousMatch.label === 'Skittles') {
      return concept('skittles_heterogeneous', 'Skittles are heterogeneous because the different pieces and colors are visible instead of being evenly distributed as one uniform substance.');
    }
    if (heterogeneousMatch.label === 'Asphalt') {
      return concept('asphalt_heterogeneous', 'Asphalt is usually heterogeneous because it is made of different materials, such as aggregate or stone and binder, mixed together.');
    }
    return concept('heterogeneous_examples', `${heterogeneousMatch.label} is a heterogeneous mixture because the parts are unevenly distributed, visible, or able to separate.`);
  }

  if (asksClassification && /\b(?:is|are|ar)\b/.test(text)) {
    return concept('unknown_mixture_classification', 'I need more information about whether the parts are evenly distributed or visible/separating. If it looks uniform throughout, it is homogeneous; if you can see different parts or they separate, it is heterogeneous.');
  }

  return null;
}

function matchExample(text, entries) {
  for (const [pattern, label] of entries) {
    if (new RegExp(`\\b(?:${pattern})\\b`).test(text)) return { pattern, label };
  }
  return null;
}

function classifyPropertyOrChange(text) {
  if (/\b(?:color|density|fragrance|odor|state)\b/.test(text) && /\bproperty\b|physical or chemical/.test(text)) {
    const term = matchLabel(text, [
      ['fragrance', 'Fragrance of a flower'],
      ['odor', 'Odor'],
      ['color', 'Color'],
      ['density', 'Density'],
      ['state', 'State']
    ]);
    return concept('physical_property_examples', `${term} is a physical property because it can be observed or measured without changing chemical identity.`);
  }
  if (/\b(?:flammability|flammable|combustibility|rot|reactivity|reacts?|oxygen|oxidation)\b/.test(text) && /\bproperty\b|physical or chemical|chemical\b/.test(text)) {
    if (/\b(?:rot|ability to rot)\b/.test(text)) {
      return concept('rot_chemical_property', 'Ability to rot is a chemical property because rotting changes chemical identity and forms new substances.');
    }
    if (/\boxygen|oxidation|reactivity|reacts?\b/.test(text)) {
      return concept('reactivity_chemical_property', 'Reactivity with oxygen, or oxidation, is a chemical property because it can form a new substance.');
    }
    return concept('flammability_chemical_property', 'Flammability or combustibility is a chemical property because burning forms new substances.');
  }
  if (/\b(?:boiling|melting|inflating|inflate|sharpening|sharpen|chopping|cutting|crushing|broken glass)\b/.test(text)) {
    const item = matchLabel(text, [
      ['boiling', 'Boiling water'],
      ['melting', 'Melting ice'],
      ['inflating|inflate', 'Inflating a tire'],
      ['sharpening|sharpen', 'Sharpening a pencil'],
      ['chopping|cutting', 'Chopping or cutting wood'],
      ['crushing', 'Crushing'],
      ['broken glass', 'Broken glass']
    ]);
    return concept('physical_change_examples', `${item} is a physical change because the substance keeps the same chemical identity.`);
  }
  if (/\b(?:burning|burnt|rusting|rust|decomposing|decompose|rotting|rot)\b/.test(text)) {
    if (/\bpopcorn\b/.test(text)) {
      return concept('burning_popcorn_chemical', 'Burning popcorn is a chemical change because new substances form, often with odor, color change, gas, or temperature change as evidence.');
    }
    if (/\bfishing pole|pole\b/.test(text)) {
      return concept('rusting_pole_chemical', 'Rusting a fishing pole is a chemical change because iron reacts with oxygen to form rust, a new substance.');
    }
    const item = /\bwood\b/.test(text) ? 'Burning wood' : /\brust/.test(text) ? 'Rusting' : 'Rotting or decomposing';
    return concept('chemical_change_examples', `${item} is a chemical change because atoms rearrange and a new substance forms.`);
  }
  return null;
}

function answerStateMatter(text) {
  if (/\bsolid\b/.test(text) && /\bparticles?\b|move|vibrate/.test(text)) {
    return concept('solid_particles');
  }
  if (/\bliquid\b/.test(text) && /\bparticles?\b|move|slide/.test(text)) {
    return concept('liquid_particles');
  }
  if (/\bdefinite\s+shape\b/.test(text) && /\bdefinite\s+volume\b/.test(text)) {
    return concept('solid_shape_volume');
  }
  if (/\bdefinite\s+volume\b/.test(text) && /\b(?:shape of|takes shape|container)\b/.test(text)) {
    return concept('liquid_shape_volume');
  }
  if (/\bno\s+(?:fixed|definite)\s+volume\b|\bno\s+(?:fixed|definite)\s+.*shape\b/.test(text)) {
    return concept('gas_shape_volume');
  }
  if (/\bfarthest apart\b/.test(text) || /\bphase\b.*\bparticles?\b.*\bfar/.test(text)) {
    return concept('gas_particles_far_apart');
  }
  if (/\bgases?\b/.test(text) && /\bspread|fill|container/.test(text)) {
    return concept('gases_spread');
  }
  if (/\bdiffusion\b/.test(text)) {
    return definition('diffusion');
  }
  if (/\bplasma\b/.test(text) || /\btwo places\b.*\bplasma\b/.test(text)) {
    return definition('plasma');
  }
  if (/\bbose\b|\beinstein\b|\bcondensate\b|\bbec\b/.test(text)) {
    return definition('bose_einstein_condensate');
  }
  return null;
}

function answerHeatingCurve(text) {
  if (/\bflat part\b/.test(text) && /\b0\b/.test(text)) {
    return concept('heating_curve_0_flat');
  }
  if (/\bpart\b.*\bliquid\b|\bliquid\b.*\bheating curve\b/.test(text)) {
    return concept('heating_curve_liquid');
  }
  if (/\bsegment\s*[1-5]\b/.test(text) && !hasStandardHeatingCurveContext(text)) {
    const segment = (/\bsegment\s*([1-5])\b/.exec(text) || [])[1];
    const standard = standardHeatingCurveSegmentAnswer(segment);
    return concept('heating_curve_segment_needs_context', `I need the heating-curve diagram to know for sure. On the standard Unit 6 water heating curve, ${standard}`);
  }
  if (/\bsegment\s*1\b/.test(text)) {
    return concept('heating_curve_segment_1');
  }
  if (/\bsegment\s*2\b/.test(text)) {
    return concept('heating_curve_segment_2');
  }
  if (/\bsegment\s*3\b/.test(text)) {
    return concept('heating_curve_segment_3');
  }
  if (/\bsegment\s*4\b/.test(text)) {
    return concept('heating_curve_segment_4');
  }
  if (/\bsegment\s*5\b/.test(text)) {
    return concept('heating_curve_segment_5');
  }
  if (/\bheating curve\b/.test(text) && /\bwhat is\b/.test(text)) {
    return definition('heating_curve');
  }
  if (/\bwater\b/.test(text) && /\b120\s*(?:c|°c|degrees?)\b/.test(text)) {
    return concept('water_120_gas', 'Water at 120°C is a gas, or water vapor, because it is above water’s boiling point.');
  }
  if (/\bwater\b/.test(text) && /-\s*10\s*(?:c|°c|degrees?)\b/.test(text)) {
    return concept('water_negative_10_solid', 'Water at -10°C is solid ice because it is below 0°C.');
  }
  return null;
}

function hasStandardHeatingCurveContext(text) {
  return /\bstandard\b|\bunit\s*6\b|\bfive[-\s]?segment\b|\bwater heating curve\b|\bour\b/.test(text);
}

function standardHeatingCurveSegmentAnswer(segment) {
  switch (String(segment || '')) {
    case '1':
      return 'segment 1 is the solid section.';
    case '2':
      return 'segment 2 is the flat melting section, where solid and liquid are present and heat of fusion is added.';
    case '3':
      return 'segment 3 is the liquid section.';
    case '4':
      return 'segment 4 is usually the flat boiling section, where liquid water changes to gas and heat of vaporization is added.';
    case '5':
      return 'segment 5 is the gas section.';
    default:
      return 'the segment depends on the diagram labels.';
  }
}

function answerStateChange(text) {
  if (/\bheat of fusion\b/.test(text)) {
    return definition('heat_of_fusion');
  }
  if (/\bheat of vaporization\b/.test(text)) {
    return definition('heat_of_vaporization');
  }
  if (/\bboiling\b/.test(text) && /\bevaporation\b/.test(text)) {
    return concept('boiling_evaporation_difference');
  }
  if (/\bvaporization\b/.test(text) && /\bevaporation\b/.test(text)) {
    return concept('vaporization_evaporation_difference');
  }
  if (/\bmelting\b/.test(text) && /\b(?:physical|chemical|why|ice)\b/.test(text)) {
    return concept('melting_physical_change');
  }
  if (/\bmelting\b|\bwhat is melt/.test(text)) {
    return definition('melting');
  }
  if (/\bfreezing\b/.test(text)) {
    return definition('freezing');
  }
  if (/\bvaporization\b/.test(text)) {
    return definition('vaporization');
  }
  if (/\bcondensation\b/.test(text)) {
    return definition('condensation');
  }
  if (/\bsublimation\b/.test(text)) {
    return definition('sublimation');
  }
  if (/\bdeposition\b/.test(text)) {
    return definition('deposition');
  }
  return null;
}

function answerSolutions(text) {
  if (/\bsolute\b/.test(text) && /\blemonade\b/.test(text)) {
    return concept('lemonade_solute', 'In lemonade, sugar and lemon flavor are solutes because they are dissolved.');
  }
  if (/\bsolvent|solvnet\b/.test(text) && /\blemonade\b/.test(text)) {
    return concept('lemonade_solvent', 'In lemonade, water is the solvent because it does the dissolving.');
  }
  if (/\bsalt\b/.test(text) && /\bdissolve/.test(text) && /\bwater\b/.test(text)) {
    return concept('salt_dissolves_water', 'Salt dissolves in water because polar water molecules attract the opposite charges of the ions.');
  }
  if (/\bdissolv/.test(text) && /\b(?:faster|rate|speed)\b/.test(text)) {
    if (/\bstir/.test(text)) {
      return concept('stirring_dissolving', 'Stirring makes dissolving faster by bringing fresh solvent into contact with undissolved solute.');
    }
    if (/\bcrush|smaller|surface area/.test(text)) {
      return concept('crushing_dissolving', 'Crushing a solute makes the solute dissolve faster by making smaller pieces with more surface area.');
    }
    if (/\bheat|heating|temperature/.test(text)) {
      return concept('heating_dissolving', 'Heating the solvent makes dissolving faster because particles have more kinetic energy and collide more often.');
    }
    return concept('dissolving_faster', 'To make sugar or another solute dissolve faster, heat the solvent, stir it, and crush the solute into smaller pieces to increase surface area.');
  }
  if (/\bsolute\b/.test(text) && /\bsolvent\b/.test(text) && /\bdifference\b|^solute solvent/.test(text)) {
    return concept('solute_solvent_difference');
  }
  if (/\bsolution\b/.test(text) && /\bwhat is|define|mean/.test(text)) {
    return definition('solution');
  }
  if (/\bsolvnet\b/.test(text) || (/\bsolvent\b/.test(text) && /\bwhat|mean|define/.test(text))) {
    return definition('solvent');
  }
  if (/\bsolute\b/.test(text) && /\bwhat|mean|define/.test(text)) {
    return definition('solute');
  }
  if (/\bair\b/.test(text) && /\bgas\b/.test(text) && /\bsolution\b/.test(text)) {
    return concept('air_gas_solution', 'Air is a gas-in-gas solution because gases are evenly mixed in it.');
  }
  if (/\bsoda\b/.test(text)) {
    return concept('soda_solution', 'Soda is a gas-in-liquid solution because carbon dioxide gas is dissolved in water.');
  }
  if (/\brubbing alcohol\b/.test(text)) {
    return concept('rubbing_alcohol_solution', 'Rubbing alcohol is a liquid-in-liquid solution.');
  }
  if (/\balloy|brass|bronze|sterling silver\b/.test(text)) {
    if (/\bbrass|bronze|sterling silver\b/.test(text)) {
      return concept('alloy_examples', 'Brass, bronze, and sterling silver are alloys, which are solid solutions of metals.');
    }
    return definition('alloy');
  }
  if (/\bsolubility curve\b/.test(text)) {
    return definition('solubility_curve');
  }
  if (/\bsupersaturated\b/.test(text)) {
    return definition('supersaturated');
  }
  if (/\bunsaturated\b/.test(text)) {
    return definition('unsaturated');
  }
  if (/\bsaturated\b/.test(text) && /\bsolutions?\b|solute|mean/.test(text)) {
    return definition('saturated');
  }
  if (/\bsolubility\b/.test(text)) {
    return definition('solubility');
  }
  if (/\bwater\b/.test(text) && /\bpolar\b/.test(text)) {
    return concept('water_polar', 'Water is polar because it has slightly positive and slightly negative sides.');
  }
  if (/\bdissociation\b/.test(text)) {
    return definition('dissociation');
  }
  return null;
}

function answerMatterTutorPrompt(text) {
  if (/\bquiz me\b/.test(text) && /\bhomogeneous|homogenous|heterogeneous|heterogenous|mixtures?\b/.test(text)) {
    return concept('matter_classification_quiz_prompt');
  }
  if (/\bteach me\b/.test(text) && /\bchanges? of state|state changes?\b/.test(text)) {
    return concept('state_change_teach_prompt');
  }
  if (/\bquiz me\b/.test(text) && /\bsolute|solvent|solution\b/.test(text)) {
    return concept('solute_solvent_quiz_prompt');
  }
  return null;
}

function asksMatterDefinition(text) {
  return /\bwhat is matter\b/.test(text) || /\bmatter in unit 6\b/.test(text);
}

function asksMatterClassification(text) {
  return /\bmatter\b/.test(text) && /\bclassified|categories|types\b/.test(text);
}

function asksSubstanceDefinition(text) {
  return /\bsubstance\b/.test(text) && hasDefinitionIntent(text);
}

function asksMixtureDefinition(text) {
  return /\bmixture\b/.test(text) && hasDefinitionIntent(text) && !/\bhomogeneous|heterogeneous|colloid|suspension\b/.test(text);
}

function asksElementDefinition(text) {
  return /\belement\b/.test(text) && hasDefinitionIntent(text) && !/\bcompound\b/.test(text);
}

function asksCompoundDefinition(text) {
  return /\bcompound\b/.test(text) && hasDefinitionIntent(text) && !/\belement and a compound|element vs compound|difference\b/.test(text);
}

function asksElementCompoundDifference(text) {
  return /\belement\b/.test(text) && /\bcompound\b/.test(text) && /\bdifference|vs|compare\b/.test(text);
}

function asksHomogeneousDefinition(text) {
  return /\bhomogeneous|homogenous\b/.test(text) && hasDefinitionIntent(text) && !/\bheterogeneous|heterogenous\b/.test(text);
}

function asksHeterogeneousDefinition(text) {
  return /\bheterogeneous|heterogenous\b/.test(text) && hasDefinitionIntent(text) && !/\bhomogeneous|homogenous\b/.test(text);
}

function asksHomogeneousHeterogeneousDifference(text) {
  return /\bhomogeneous|homogenous\b/.test(text) &&
    /\bheterogeneous|heterogenous\b/.test(text) &&
    /\bdifference|vs|compare|explain\b/.test(text);
}

function asksColloidDefinition(text) {
  return /\bcolloid\b/.test(text) && hasDefinitionIntent(text);
}

function asksSuspensionDefinition(text) {
  return /\bsuspension\b/.test(text) && hasDefinitionIntent(text);
}

function asksTyndallEffect(text) {
  return /\btyndall\b/.test(text);
}

function asksPhysicalPropertyDefinition(text) {
  return /\bphysical property\b/.test(text) && hasDefinitionIntent(text);
}

function asksChemicalPropertyDefinition(text) {
  return /\bchemical property\b/.test(text) && hasDefinitionIntent(text);
}

function asksPhysicalChemicalChangeDifference(text) {
  return /\bphysical\b/.test(text) &&
    /\bchemical\b/.test(text) &&
    /\bchanges?\b/.test(text) &&
    /\b(?:difference|different|vs|versus|compare|explain)\b/.test(text);
}

function asksPhysicalChemicalChangeExamples(text) {
  return /\b(?:give|list|show)\s+examples?\s+of\s+physical\s+and\s+chemical\s+changes?\b/.test(text);
}

function asksPhysicalChangeDefinition(text) {
  return /\bphysical change\b/.test(text) && hasDefinitionIntent(text);
}

function asksChemicalChangeDefinition(text) {
  return /\bchemical change\b/.test(text) && hasDefinitionIntent(text);
}

function asksChemicalChangeSigns(text) {
  return /\bsigns?\b/.test(text) && /\bchemical change\b/.test(text);
}

function asksConservationMass(text) {
  return /\bconservation of (?:mass|matter)\b/.test(text) || /\bmass\b.*\b(?:disappear|closed system|chemical reaction)\b/.test(text) || /\brust\b.*\bclosed system\b/.test(text);
}

function asksDensityConcept(text) {
  return /\bdensity\b/.test(text) && (hasDefinitionIntent(text) || /\bphysical property\b/.test(text) || /\bsample size\b/.test(text));
}

function asksDensityIdentifySubstance(text) {
  return /\bdensity\b/.test(text) &&
    /\b(?:identify|identifies|identifying|characteristic)\b/.test(text) &&
    /\bsubstances?\b/.test(text);
}

function asksDensityFloatSinkConcept(text) {
  return /\bdens/.test(text) && /\bwater\b/.test(text) && /\bfloat|sink|less than|greater than|more than\b/.test(text);
}

function asksViscosity(text) {
  return /\bviscosity|viscosty|viscous\b/.test(text) || /\bsyrup\b.*\b(?:slow|slower|pour|move)\b/.test(text);
}

function asksSolubilityPhysicalProperty(text) {
  return /\bsolubility\b/.test(text) && /\bphysical property\b/.test(text);
}

function asksMeltingBoilingPhysicalProperties(text) {
  return /\bmelting point\b/.test(text) && /\bboiling point\b/.test(text) && /\bphysical propert/.test(text);
}

function asksKmtSmallParticles(text) {
  return /\bkinetic molecular theory\b/.test(text) && /\bmatter\b/.test(text);
}

function asksParticlesConstantMotion(text) {
  return /\bparticles?\b/.test(text) && /\bmatter\b/.test(text) && /\b(?:always|constant)\b/.test(text) && /\bmoving|motion\b/.test(text);
}

function asksTemperature(text) {
  return /\btemperature\b/.test(text) && /\bmeasur/.test(text);
}

function asksHeatingParticles(text) {
  if (/\bheat transfer\b|\bconvection\b/.test(text)) return false;
  return /\bparticles?\b/.test(text) && /\bheated|heating\b/.test(text);
}

function looksLikeDensityCalculation(text) {
  if (!/\bdensity\b/.test(text)) return false;
  const numbers = text.match(/-?\d+(?:\.\d+)?/g) || [];
  return numbers.length >= 2 || /\bmass\b.*\bvolume\b|\bbox\b|\bcube\b|\bmeasures?\b|\bgraduated cylinder\b|\brises?\b|\bwater goes\b|\bdensity table\b/.test(text);
}

function hasDefinitionIntent(text) {
  return /\bwhat is|what are|define|definition|what does|mean|means\b/.test(text);
}

function matterFact(id, type, term, answer, options = {}) {
  return {
    id,
    type,
    term,
    answer,
    category: options.category || 'matter',
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
  if (!fact) return { id, answer: '', type: fallbackType };
  return { id, answer: fact.answer, type: fact.type || fallbackType };
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/co₂/g, 'co2')
    .replace(/h₂o/g, 'h2o')
    .replace(/nacl/g, 'nacl')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchLabel(text, entries) {
  for (const [pattern, label] of entries) {
    if (new RegExp(`\\b(?:${pattern})\\b`).test(text)) return label;
  }
  return 'That example';
}

function sentenceList(items) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

module.exports = {
  tryUnit6MatterKnowledge,
  UNIT6_MATTER_FACTS,
  UNIT6_MATTER_PACKET
};
