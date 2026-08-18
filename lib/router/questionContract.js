const TASK_TYPES = Object.freeze({
  CALCULATION: 'calculation',
  UNIT_ONLY: 'unit_only',
  DEFINITION: 'definition',
  CLOZE: 'cloze',
  MULTIPLE_CHOICE: 'multiple_choice',
  BINARY_CLASSIFICATION: 'binary_classification',
  LAW_IDENTIFICATION: 'law_identification',
  DIAGRAM_REQUIRED: 'diagram_required',
  DRAW_DIAGRAM: 'draw_diagram',
  EXPLANATION: 'explanation',
  CONTEXTUAL_FOLLOWUP: 'contextual_followup',
  UNSUPPORTED: 'unsupported'
});

const UNIT_ALIASES = Object.freeze([
  { canonical: 'm/s²', source: '\\b(?:m\\s*\\/\\s*s(?:\\^?2|²)|meters?\\s+per\\s+second\\s+squared)(?=$|\\s|[,.?;:)])' },
  { canonical: 'cm/s²', source: '\\b(?:cm\\s*\\/\\s*s(?:\\^?2|²)|centimeters?\\s+per\\s+second\\s+squared)(?=$|\\s|[,.?;:)])' },
  { canonical: 'km/h', source: '\\b(?:km\\s*\\/\\s*h(?:r|our)?s?|kilometers?\\s+per\\s+hours?)\\b' },
  { canonical: 'cm/min', source: '\\b(?:cm\\s*\\/\\s*min|centimeters?\\s+per\\s+minutes?)\\b' },
  { canonical: 'm/s', source: '\\b(?:m\\s*\\/\\s*s|meters?\\s+per\\s+seconds?)\\b' },
  { canonical: 'ft/s', source: '\\b(?:ft\\s*\\/\\s*s|feet\\s+per\\s+seconds?)\\b' },
  { canonical: 'mph', source: '\\b(?:mph|mi\\s*\\/\\s*h(?:r|our)?s?|miles?\\s+per\\s+hour)\\b' },
  { canonical: 'kg·m/s', source: '\\b(?:kg\\s*[·*x×]?\\s*m\\s*\\/\\s*s|kilogram[- ]meters?\\s+per\\s+second)\\b' },
  { canonical: 'kg', source: '(?<![A-Za-z])(?:kg|kilograms?)\\b' },
  { canonical: 'mg', source: '(?<![A-Za-z])(?:mg|milligrams?)\\b' },
  { canonical: 'cg', source: '(?<![A-Za-z])(?:cg|centigrams?)\\b' },
  { canonical: 'g', source: '(?<![A-Za-z])(?:grams?|g)\\b' },
  { canonical: 'km', source: '(?<![A-Za-z])(?:km|kilometers?)\\b' },
  { canonical: 'cm', source: '(?<![A-Za-z])(?:cm|centimeters?)\\b' },
  { canonical: 'mm', source: '(?<![A-Za-z])(?:mm|millimeters?)\\b' },
  { canonical: 'm', source: '(?<![A-Za-z])(?:meters?|metres?|m)\\b' },
  { canonical: 'kL', source: '(?<![A-Za-z])(?:kl|kiloliters?|kilolitres?)\\b' },
  { canonical: 'mL', source: '(?<![A-Za-z])(?:ml|milliliters?|millilitres?)\\b' },
  { canonical: 'L', source: '(?<![A-Za-z])(?:l|liters?|litres?)\\b' },
  { canonical: 'ft', source: '\\b(?:feet|foot|ft)\\b' },
  { canonical: 'in', source: '\\binches?\\b' },
  { canonical: 'mi', source: '\\b(?:miles?|mi)\\b' },
  { canonical: 'ms', source: '\\b(?:milliseconds?|ms)\\b' },
  { canonical: 'ks', source: '(?<![A-Za-z])(?:ks|kiloseconds?)\\b' },
  { canonical: 'min', source: '\\b(?:minutes?|mins?|min|minets)\\b' },
  { canonical: 'h', source: '\\b(?:hours?|hrs?|hr|h)\\b' },
  { canonical: 's', source: '\\b(?:seconds?|secs?|sec|s)\\b' },
  { canonical: 'year', source: '\\b(?:years?|yrs?|yr)\\b' },
  { canonical: 'N', source: '\\b(?:newtons?|n)\\b' },
  { canonical: 'V', source: '\\b(?:volts?|v)\\b' },
  { canonical: 'A', source: '\\b(?:amperes?|amps?|a)\\b' },
  { canonical: 'Ω', source: '(?:\\b(?:ohms?|omega)\\b|Ω)' },
  { canonical: 'J', source: '\\b(?:joules?|j)\\b' },
  { canonical: 'W', source: '\\b(?:watts?|w)\\b' },
  { canonical: 'Hz', source: '\\b(?:hertz|hz)\\b' },
  { canonical: '°C', source: '(?:°\\s*c\\b|\\bdegrees?\\s+celsius\\b|\\bcelsius\\b)' },
  { canonical: '°F', source: '(?:°\\s*f\\b|\\bdegrees?\\s+fahrenheit\\b|\\bfahrenheit\\b)' },
  { canonical: 'K', source: '\\b(?:kelvins?|k)\\b' }
]);

const CONCEPT_TOPICS = Object.freeze({
  unit_conversion: 'measurement',
  scientific_notation: 'measurement',
  temperature: 'measurement',
  speed: 'motion',
  position: 'motion',
  distance: 'motion',
  time: 'motion',
  velocity: 'motion',
  acceleration: 'motion',
  displacement: 'motion',
  height: 'energy',
  heat_energy: 'energy',
  specific_heat: 'energy',
  energy_type: 'energy',
  density: 'matter',
  volume: 'matter',
  mixture: 'matter',
  mixture_classification: 'matter',
  matter_classification: 'matter',
  element_group_classification: 'matter',
  property: 'matter',
  property_classification: 'matter',
  change: 'matter',
  change_classification: 'matter',
  state: 'matter',
  state_change: 'matter',
  heating_curve: 'matter',
  conservation_of_mass: 'matter',
  dissolve: 'matter',
  salt: 'matter',
  polar: 'matter',
  atom: 'atomic_structure',
  atomic_number: 'atomic_structure',
  mass_number: 'atomic_structure',
  average_atomic_mass: 'atomic_structure',
  periodic_group: 'atomic_structure',
  periodic_period: 'atomic_structure',
  proton: 'atomic_structure',
  protons: 'atomic_structure',
  neutron: 'atomic_structure',
  neutrons: 'atomic_structure',
  electron: 'atomic_structure',
  electrons: 'atomic_structure',
  valence_electrons: 'atomic_structure',
  isotope: 'atomic_structure',
  ion: 'atomic_structure',
  bohr_model: 'atomic_structure',
  protons_and_electrons: 'atomic_structure',
  balanced_forces: 'forces',
  unbalanced_forces: 'forces',
  net_force: 'forces',
  force: 'forces',
  friction: 'forces',
  air_resistance: 'forces',
  mass: 'forces',
  weight: 'gravity',
  momentum: 'motion',
  newtons_first_law: 'newtons_laws',
  newtons_second_law: 'newtons_laws',
  newtons_third_law: 'newtons_laws',
  lunar_gravity: 'gravity',
  moon_gravity: 'gravity',
  gravitational_acceleration: 'gravity',
  earth_surface_gravity: 'gravity',
  gravitational_potential_energy: 'energy',
  kinetic_energy: 'energy',
  chemical_energy: 'energy',
  sound_energy: 'energy',
  thermal_energy: 'energy',
  radiant_energy: 'energy',
  work: 'energy',
  power: 'energy',
  electric_current: 'circuits',
  electrical_power: 'circuits',
  voltage: 'circuits',
  voltage_difference: 'circuits',
  resistance: 'circuits',
  conductor: 'circuits',
  electrical_material: 'circuits',
  electric_field: 'circuits',
  magnetic_repulsion: 'circuits',
  magnetic_field: 'circuits',
  generator: 'circuits',
  series_circuit: 'circuits',
  circuit_state: 'circuits',
  circuit_diagram: 'circuits',
  wave: 'waves',
  electromagnetic_wave: 'waves',
  wave_speed: 'waves',
  frequency: 'waves',
  wavelength: 'waves',
  period: 'waves',
  compression: 'waves',
  rarefaction: 'waves',
  loudness: 'waves',
  reflection: 'waves',
  refraction: 'waves',
  constructive_interference: 'waves',
  convection: 'energy',
  periodic_table: 'atomic_structure',
  tarnishing: 'matter',
  physical_property: 'matter',
  physical_properties: 'matter',
  chemical_property: 'matter'
});

const TOPIC_RULES = Object.freeze([
  {
    topic: 'measurement',
    patterns: [
      /\bunits?\b/i,
      /\bconvert(?:ed|ing|s)?\b/i,
      /\bmetric\b/i,
      /\bscientific notation\b/i,
      /\bstandard notation\b/i,
      /\btemperature\b/i
    ]
  },
  {
    topic: 'motion',
    patterns: [
      /\bspeed\b/i,
      /\bvelocity\b/i,
      /\bacceleration\b/i,
      /\bdisplacement\b/i,
      /\bdistance(?:[- ]time)?\b/i,
      /\bmotion\b/i
    ]
  },
  {
    topic: 'forces',
    patterns: [
      /\bforces?\b/i,
      /\bpush(?:es|ed|ing)?\b/i,
      /\bpull(?:s|ed|ing)?\b/i,
      /\bbalanced\b/i,
      /\bunbalanced\b/i,
      /\bnet force\b/i,
      /\bnewton(?:'s|s)?\s+(?:first|second|third|1st|2nd|3rd)\s+law\b/i,
      /\binertia\b/i,
      /\bfriction\b/i,
      /\bfree[- ]body\b/i
    ]
  },
  {
    topic: 'gravity',
    patterns: [
      /\bgravit(?:y|ational)\b/i,
      /\bmoon\b/i,
      /\bweight\b/i,
      /\bfree fall\b/i
    ]
  },
  {
    topic: 'energy',
    patterns: [
      /\benergy\b/i,
      /\bheat\b/i,
      /\bcold\b/i,
      /\btemperature\b/i,
      /\bconduction\b/i,
      /\bconvection\b/i,
      /\bradiation\b/i,
      /\bkinetic\b/i,
      /\bpotential\b/i,
      /\bthermal\b/i,
      /\bradiant\b/i,
      /\bwork\b/i,
      /\bpower\b/i
    ]
  },
  {
    topic: 'electricity',
    patterns: [
      /\belectric(?:al|ity)?\b/i,
      /\bcircuits?\b/i,
      /\bcurrent\b/i,
      /\bvoltage\b/i,
      /\bresistan(?:ce|t)\b/i,
      /\bresistors?\b/i,
      /\bconductors?\b/i,
      /\bcharges?\b/i,
      /\bcharg(?:e|es|ed|ing)\b/i,
      /\binduction\b/i,
      /\bohm(?:'s|s)?\b/i,
      /\bbatter(?:y|ies)\b/i,
      /\bmagnet(?:s|ism|ic)?\b/i,
      /\bmagnetic\b/i,
      /\belectromagnets?\b/i,
      /\bgenerators?\b/i,
      /\belectric motors?\b/i
    ]
  },
  {
    topic: 'waves',
    patterns: [
      /\bwaves?\b/i,
      /\bvibrat(?:e|es|ed|ing|ion|ions)\b/i,
      /\bfrequency\b/i,
      /\bwavelength\b/i,
      /\btransverse\b/i,
      /\blongitudinal\b/i,
      /\belectromagnetic\b|\bEM spectrum\b/i,
      /\bmechanical waves?\b/i,
      /\bsound\b|\becho\b|\bpitch\b/i,
      /\blight\b|\boptical\b|\bvisible spectrum\b/i,
      /\bamplitude\b|\bperiod\b|\bmedium\b|\bvacuum\b/i,
      /\bcrest\b|\btrough\b|\bcompression\b|\brarefaction\b/i,
      /\breflection\b|\brefraction\b|\bdiffraction\b|\babsorption\b|\binterference\b|\bresonance\b/i,
      /\bdoppler\b|\blenses?\b|\brods?\b|\bcones?\b/i,
      /\bnoise[- ]cancel(?:ing|ling)?\b|\bheadphones?\b/i
    ]
  },
  {
    topic: 'matter',
    patterns: [
      /\bmatter\b/i,
      /\bphysical propert(?:y|ies)\b/i,
      /\bchemical propert(?:y|ies)\b/i,
      /\bmalleab(?:le|ility)\b/i,
      /\bductil(?:e|ity)\b/i,
      /\btarnish(?:es|ed|ing)?\b/i,
      /\bmixtures?\b/i,
      /\bcompounds?\b/i,
      /\b(?:substances?|homogeneous|heterogeneous|colloids?|suspensions?)\b/i,
      /\b(?:solutions?|solutes?|solvents?|solubility|saturated|unsaturated|supersaturated)\b/i,
      /\b(?:density|viscosity|states? of matter|phase changes?|heating curves?)\b/i,
      /\b(?:solids?|liquids?|gases?|plasma|melting|freezing|vaporization|evaporation|condensation|sublimation|deposition)\b/i,
      /\b(?:physical changes?|chemical changes?|conservation of (?:mass|matter))\b/i
    ]
  },
  {
    topic: 'chemistry',
    patterns: [
      /\bperiodic table\b/i,
      /\batoms?\b/i,
      /\belements?\b/i,
      /\b(?:protons?|protone|neutrons?|nuetrons?|electrons?|nucleus|atomic number|mass number|isotopes?|ions?|valence electrons?|electron cloud|bohr model)\b/i,
      /\bchemical reactions?\b/i,
      /\bbond(?:s|ing)?\b/i,
      /\bmolecules?\b/i
    ]
  }
]);

function buildQuestionContract(message, options = {}) {
  const text = String(message || '').trim();
  const suppliedChoices = extractSuppliedChoices(text, options);
  const targetConcept = inferTargetConcept(text);
  const classificationTarget = inferClassificationTarget(text);
  const numericalGivens = extractNumericalGivens(text, { targetConcept });
  const diagramProvided = hasProvidedDiagram(options);
  const diagramDependency = dependsOnReferencedDiagram(text);
  const unseenDiagramRequired = diagramDependency && !diagramProvided;
  const missingAnswerChoices =
    referencesAnswerChoices(text) && suppliedChoices.length < 2;

  const taskType = classifyTaskType(text, {
    suppliedChoices,
    targetConcept,
    numericalGivens,
    unseenDiagramRequired
  });
  const formulaLookup = looksLikeFormulaLookup(text);
  const candidateTopics = inferCandidateTopics(text, {
    targetConcept,
    classificationTarget,
    taskType
  });
  const requestedUnits = inferRequestedUnits(text, {
    ...options,
    targetConcept,
    taskType,
    numericalGivens
  });
  const missingContext = [];

  if (missingAnswerChoices) missingContext.push('answer_choices');
  if (unseenDiagramRequired) missingContext.push('diagram');
  if (
    taskType === TASK_TYPES.CLOZE &&
    !targetConcept &&
    candidateTopics.includes('unknown') &&
    normalizeForMatching(text).split(/\s+/).filter(Boolean).length <= 4
  ) {
    missingContext.push('cloze_context');
  }

  const requiredAnswerForm = inferRequiredAnswerForm(taskType, {
    formulaLookup,
    missingAnswerChoices,
    requestedUnits
  });
  const contract = {
    taskType,
    candidateTopics,
    targetConcept,
    classificationTarget,
    suppliedChoices,
    missingAnswerChoices,
    numericalGivens,
    requestedUnits,
    requiredAnswerForm,
    unseenDiagramRequired,
    missingContext,
    evidenceRequirements: buildEvidenceRequirements({
      taskType,
      candidateTopics,
      targetConcept,
      classificationTarget,
      suppliedChoices,
      missingAnswerChoices,
      requestedUnits,
      requiredAnswerForm,
      unseenDiagramRequired,
      missingContext
    })
  };

  return deepFreeze(contract);
}

function classifyTaskType(message, details = {}) {
  const text = String(message || '').trim();

  if (details.unseenDiagramRequired) return TASK_TYPES.DIAGRAM_REQUIRED;
  if (looksLikeDrawDiagramRequest(text)) return TASK_TYPES.DRAW_DIAGRAM;
  if (referencesAnswerChoices(text) || details.suppliedChoices?.length >= 2) {
    return TASK_TYPES.MULTIPLE_CHOICE;
  }
  if (looksLikeLawIdentification(text)) return TASK_TYPES.LAW_IDENTIFICATION;
  if (
    details.targetConcept === 'newtons_first_law' &&
    /\b(?:why|how|explain|related|relationship)\b/i.test(text)
  ) {
    return TASK_TYPES.EXPLANATION;
  }
  if (looksLikeUnitOnlyQuestion(text)) return TASK_TYPES.UNIT_ONLY;
  if (looksLikeFormulaLookup(text)) return TASK_TYPES.DEFINITION;
  if (
    details.targetConcept === 'energy_type' &&
    looksLikeEnergyTypeIdentification(text)
  ) {
    return TASK_TYPES.DEFINITION;
  }
  if (
    ['periodic_group', 'periodic_period'].includes(details.targetConcept) &&
    /\b(?:what|which|where|identify|find|tell|row|column|group|period)\b/i.test(text)
  ) {
    return TASK_TYPES.DEFINITION;
  }
  if (
    details.targetConcept === 'state_change' &&
    looksLikeChangesOfStateTeachingRequest(text)
  ) {
    return TASK_TYPES.EXPLANATION;
  }
  if (looksLikeEnergyTransformationQuestion(text)) return TASK_TYPES.EXPLANATION;
  if (looksLikeLearningShapeRequest(text)) return TASK_TYPES.EXPLANATION;
  if (looksLikeWhyQuestion(text)) return TASK_TYPES.EXPLANATION;
  if (looksLikeBinaryClassification(text)) return TASK_TYPES.BINARY_CLASSIFICATION;
  if (looksLikeCalculation(text, details)) return TASK_TYPES.CALCULATION;
  if (looksLikeComparisonOrClassificationQuestion(text)) return TASK_TYPES.EXPLANATION;
  if (looksLikeCloze(text) || looksLikeKnownConceptClue(text, details.targetConcept)) {
    return TASK_TYPES.CLOZE;
  }
  if (looksLikeDefinitionQuestion(text)) return TASK_TYPES.DEFINITION;
  if (looksLikeWaveConceptQuestion(text)) return TASK_TYPES.EXPLANATION;
  return TASK_TYPES.UNSUPPORTED;
}

function inferTargetConcept(message) {
  const text = normalizeForMatching(message);

  if (looksLikeFirstLawRestCondition(text)) return 'newtons_first_law';
  const numericForceTarget = inferNumericForceCalculationTarget(text);
  if (numericForceTarget) return numericForceTarget;
  const explicitSolveForTarget = inferExplicitSolveForTarget(text);
  if (explicitSolveForTarget) return explicitSolveForTarget;
  const forceBalanceTarget = inferForceBalanceTarget(text);
  if (forceBalanceTarget) return forceBalanceTarget;
  if (looksLikeRestingObjectOnSurface(text)) return 'newtons_first_law';
  if (looksLikeMoonGravityContext(text)) return 'moon_gravity';
  if (looksLikeWaveEnergyThroughMatter(text)) return 'wave';
  if (looksLikeElectricCurrentDescription(text)) return 'electric_current';
  if (looksLikeConductorMaterialQuestion(text)) return 'conductor';
  if (looksLikeElectricFieldDescription(text)) return 'electric_field';
  if (looksLikeVoltagePushDescription(text)) return 'voltage_difference';
  if (
    /\b(?:row|rows)\b/.test(text) &&
    /\bperiodic table\b/.test(text)
  ) {
    return 'periodic_period';
  }

  if (looksLikeWorkTransferCalculation(text)) return 'work';
  if (looksLikeExplicitWorkCalculation(text)) return 'work';
  if (looksLikeExplicitPowerCalculation(text)) return 'power';
  if (looksLikeConservationOfMassQuestion(text)) return 'conservation_of_mass';
  if (looksLikeBoundedDensityCalculation(text)) return 'density';
  if (looksLikeDensityFloatSinkQuestion(text)) return 'density';
  if (looksLikePropertyClassification(text)) return 'property';
  if (looksLikeChangeClassification(text)) return 'change';
  if (looksLikeElementCompoundMixtureClassification(text)) {
    return 'matter_classification';
  }
  if (looksLikeNamedElementGroupClassification(text)) {
    return 'element_group_classification';
  }
  if (looksLikeExplicitMixtureTarget(text)) return 'mixture';
  if (looksLikeWaterStateQuestion(text)) return 'state';
  if (looksLikeHeatingCurveQuestion(text)) return 'heating_curve';
  if (looksLikeChangesOfStateTeachingRequest(text)) return 'state_change';
  if (looksLikeWaterPolarityQuestion(text)) return 'polar';
  if (looksLikeSaltDissolutionQuestion(text)) return 'salt';
  if (looksLikeDissolvingRateQuestion(text)) return 'dissolve';
  if (looksLikeEnergyTypeIdentification(text)) return 'energy_type';

  const boundaryRules = [
    [
      /\bhow many\s+(?:neutrons?|nuetrons?)\b|\b(?:neutrons?|nuetrons?)\b[^?.]{0,40}\bhow many\b/,
      'neutrons'
    ],
    [
      /\bhow many\s+electrons?\b|\belectrons?\b[^?.]{0,40}\bhow many\b/,
      'electrons'
    ],
    [
      /\bhow many\s+valence electrons?\b|\bvalence electrons?\b[^?.]{0,40}\bhow many\b/,
      'valence_electrons'
    ],
    [
      /\bhow many\s+protons?\b|\bprotons?\b[^?.]{0,40}\bhow many\b/,
      'protons'
    ],
    [
      /\b(?:what is|what|find|calculate|compute|determine)\b[^?.]{0,36}\batomic number\b|\bhas what atomic number\b/,
      'atomic_number'
    ],
    [
      /\b(?:what is|what|find|calculate|compute|determine)\b[^?.]{0,36}\bmass number\b|\bmass number\s*\?/,
      'mass_number'
    ],
    [
      /\baverage atomic mass\b/,
      'average_atomic_mass'
    ],
    [
      /\bgroup\b[^?.]{0,40}\bperiodic table\b|\bperiodic table\b[^?.]{0,40}\bgroup\b/,
      'periodic_group'
    ],
    [
      /\bperiod\b[^?.]{0,40}\bperiodic table\b|\bperiodic table\b[^?.]{0,40}\bperiod\b/,
      'periodic_period'
    ],
    [
      /\bwrite\b[^?.]{0,36}\bisotope(?: notation)?\b|\bwrite isotope\b/,
      'isotope'
    ],
    [
      /\b(?:set up|draw|make|build)\b[^?.]{0,36}\bbohr model\b/,
      'bohr_model'
    ],
    [
      /\b(?:what is|what|find|calculate|compute|determine)\b[^?.]{0,36}\bdensity\b|\bwhat density\b/,
      'density'
    ],
    [
      /\b(?:what is|what|find|calculate|compute|determine)\b[^?.]{0,36}\bvolume\b/,
      'volume'
    ],
    [
      /\bdetermine the unit for speed\b|\bunit for speed\b.*\bdistance\b.*\btime\b/,
      'speed'
    ],
    [
      /\bwith what speed\b/,
      'speed'
    ],
    [
      /\bwhat speed\b.*\b(?:reach|attain)\b/,
      'speed'
    ],
    [
      /\bgravitational acceleration\b.*\bearth\b|\bearth'?s surface\b.*\bgravitational acceleration\b|\bgravity near earth\b/,
      'earth_surface_gravity'
    ],
    [
      /\b(?:what is|what|find|calculate|compute|determine|solve for)\s+(?:the\s+)?acceleration\b(?!\s+due to gravity)/,
      'acceleration'
    ],
    [
      /\b(?:what is|what|find|calculate|compute|determine|solve for)\s+(?:the\s+)?mass\b/,
      'mass'
    ],
    [
      /\b(?:how long|what is (?:the )?time|find (?:the )?time|calculate (?:the )?time)\b/,
      'time'
    ],
    [
      /\b(?:at )?what height\b|\bhow high\b|\b(?:find|calculate|determine)\b[^?.]{0,24}\bheight\b/,
      'height'
    ],
    [
      /\bhow much work\b|\bwhat is (?:its|the) work\b/,
      'work'
    ],
    [
      /\bhow much power\b|\bwhat is (?:its|the) power\b/,
      'power'
    ],
    [
      /\bhow high is\b|\b(?:find|calculate|determine)\b[^?.]{0,24}\bheight\b/,
      'height'
    ],
    [
      /\bhow much heat\b.*\b(?:needed|required|absorbed|released)\b/,
      'heat_energy'
    ],
    [
      /\bwhat is (?:its|the)\s+specific heat\b|\b(?:find|calculate|determine)\b[^?.]{0,32}\bspecific heat\b/,
      'specific_heat'
    ],
    [
      /\batomic number\b.*\bhow many\b.*\bprotons?\b.*\belectrons?\b/,
      'protons_and_electrons'
    ],
    [
      /\bconvert\b[^?.]*\b(?:c|f|k)\b[^?.]*\b(?:to|into)\s+(?:c|f|k)\b/,
      'temperature'
    ],
    [
      /\bhow many\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+are in\s+(?:one|an?|[\d,.]+)\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/,
      'unit_conversion'
    ],
    [
      /\bwhat type of energy\b/,
      'energy_type'
    ],
    [
      /\b(?:find|calculate|determine)\b[^?.]{0,28}\bthermal energy\b|\bwhat is\b[^?.]{0,32}\bchange in thermal energy\b/,
      'heat_energy'
    ],
    [
      /\bmotion occurs\b.*\bobject changes its\b/,
      'position'
    ],
    [
      /\btwo forces?\b.*\bequal in (?:size|magnitude)\b.*\b(?:not opposite|same direction)\b/,
      'unbalanced_forces'
    ],
    [
      /\btwo forces?\b.*\bequal in (?:size|magnitude)\b.*\bopposite (?:in )?direction/,
      'balanced_forces'
    ],
    [
      /\btwo forces?\b.*\bunequal in (?:size|magnitude)\b.*\bopposite (?:in )?direction/,
      'unbalanced_forces'
    ],
    [
      /\b(?:overall|combined|total|sum of (?:all )?) forces?\b.*\b(?:acting|on an? object)\b|\bnet force\b/,
      'net_force'
    ],
    [
      /\bair resistance\b|\bdrag\b/,
      'air_resistance'
    ],
    [
      /\ba push or pull\b.*\b(?:stop|move|change direction|change(?:s)? (?:an? )?object'?s motion)\b/,
      'force'
    ],
    [
      /\blamp\b.*\b(?:sitting|resting|at rest)\b.*\btable\b|\btable\b.*\blamp\b.*\b(?:sitting|resting|at rest)\b/,
      'newtons_first_law'
    ],
    [
      /\btrampoline\b.*\b(?:which|what)\s+law\b|\b(?:which|what)\s+law\b.*\btrampoline\b/,
      'newtons_third_law'
    ],
    [
      /\b(?:why|how come)\b.*\bgravity\b.*\bmoon\b|\bmoon'?s gravity\b|\bgravity on the moon\b/,
      'moon_gravity'
    ],
    [
      /\bgravitational potential energy\b|\bgpe\b|\bpotential energy\b.*\b(?:ground|height|above|floor)\b|\b(?:ground|height|above|floor)\b.*\bpotential energy\b/,
      'gravitational_potential_energy'
    ],
    [
      /\bgravitational acceleration\b.*\bearth\b|\bearth'?s surface\b.*\bgravitational acceleration\b|\bgravity near earth\b/,
      'earth_surface_gravity'
    ],
    [
      /\bvibration\b.*\b(?:through|in)\b.*\bmaterial\b.*\benergy\b.*\bnot matter\b/,
      'wave'
    ],
    [
      /\bparticles?\b.*\bpushed together\b.*\blongitudinal wave\b|\blongitudinal wave\b.*\bparticles?\b.*\bpushed together\b/,
      'compression'
    ],
    [
      /\bparticles?\b.*\bspread apart\b.*\blongitudinal wave\b|\blongitudinal wave\b.*\bparticles?\b.*\bspread apart\b/,
      'rarefaction'
    ],
    [
      /\bincreasing\b.*\bamplitude\b.*\bsound\b.*\b(?:blank|_+)\b|\bamplitude of sound\b.*\bmakes?\b.*\b(?:blank|_+)\b/,
      'loudness'
    ],
    [
      /\breflection\b.*\bwave\b.*\b(?:blank|_+)\b/,
      'reflection'
    ],
    [
      /\b(?:pencil|finger|objects?)\b[^?.]{0,120}\blook(?:s|ed|ing)?\b[^?.]{0,60}\b(?:bent|broken|crooked|crocket|distorted)\b[^?.]{0,80}\bwater\b/,
      'refraction'
    ],
    [
      /\bx-rays?\b.*\buv\b.*\bsound waves?\b.*\btransmit\b/,
      'energy'
    ],
    [
      /\bconstructive interference\b.*\b(?:two )?crests?\b/,
      'constructive_interference'
    ],
    [
      /\bflow of electricity\b.*\b(?:through|in)\b.*\bconductor\b|\belectricity flowing\b.*\bconductor\b/,
      'electric_current'
    ],
    [
      /\bwhat slows\b.*\bflow of electricity\b|\bslows? down\b.*\belectric current\b/,
      'resistance'
    ],
    [
      /\bexerts? (?:a )?force\b.*\b(?:other )?electric charges?\b.*\bmove\b/,
      'electric_field'
    ],
    [
      /\bmagnetic fields?\b|\bfield around a magnet\b/,
      'magnetic_field'
    ],
    [
      /\bwhat does a generator convert\b/,
      'generator'
    ],
    [
      /\bheat transfer\b.*\bliquids?\b.*\bgases?\b.*\b(?:heated particles?|movement)\b|\bliquids?\b.*\bgases?\b.*\bheated particles?\b/,
      'convection'
    ],
    [
      /\b(?:force|push)\b.*\belectric charges?\b.*\bmove\b.*\bcircuit\b/,
      'voltage_difference'
    ],
    [
      /\bcircuit\b.*\bone path\b.*\bcurrent\b|\bone path\b.*\bcurrent\b.*\bcircuit\b/,
      'series_circuit'
    ],
    [
      /\btwo\b.*\b(?:north|south)\b.*\bmagnetic poles?\b.*\b(?:each other|blank|_)/,
      'magnetic_repulsion'
    ],
    [
      /\bsilver\b.*\btarnish(?:es|ed|ing)?\b.*\bchemical propert(?:y|ies)\b/,
      'tarnishing'
    ],
    [
      /\bmalleability\b.*\bductility\b.*\bpropert(?:y|ies)\b/,
      'physical_properties'
    ],
    [
      /\b(?:diagram|figure|image|picture)\b.*\bbulbs?\b.*\blight\b|\bwhich bulbs?\b.*\blight\b/,
      'circuit_state'
    ],
    [
      /\b(?:draw|sketch|create|make|show)\b.*\b(?:circuit diagram|(?:series|parallel)?\s*circuit)\b/,
      'circuit_diagram'
    ],
    [
      /\bions?\b.*\bprotons?\b.*\belectrons?\b.*\bmass number\b/,
      'mass_number'
    ],
    [
      /\bconductors?\b.*\b(?:or|versus|vs\.?)\b.*\binsulators?\b|\binsulators?\b.*\b(?:or|versus|vs\.?)\b.*\bconductors?\b/,
      'electrical_material'
    ],
    [
      /\bvelocity\b.*\btime graph\b.*\bslope\b|\bslope\b.*\bvelocity\b.*\btime graph\b/,
      'acceleration'
    ],
    [
      /\b(?:distance|position)\b.*\btime graph\b.*\bslope\b|\bslope\b.*\b(?:distance|position)\b.*\btime graph\b/,
      'speed'
    ],
    [
      /\b(?:falling freely|free fall)\b.*\bconstant what\b/,
      'acceleration'
    ],
    [
      /\bhow much ground\b.*\bcover\b|\bground\b.*\bhow (?:far|much)\b.*\bcover\b/,
      'distance'
    ],
    [
      /\brelated to the amount of force needed to change an object'?s motion\b/,
      'momentum'
    ]
  ];

  for (const [pattern, concept] of boundaryRules) {
    if (pattern.test(text)) return concept;
  }

  const leadingRequestedConcept = /^(?:what(?: is|s)?|find|calculate|compute|determine|solve for)\s+(?:the\s+)?(gravitational potential energy|kinetic energy|electrical power|electric current|voltage difference|wave speed|net force|acceleration|displacement|velocity|resistance|momentum|wavelength|frequency|distance|current|speed|force|mass|weight|period|power|work|time|voltage)\b/.exec(text);
  if (leadingRequestedConcept) {
    const conceptByPhrase = {
      'gravitational potential energy': 'gravitational_potential_energy',
      'kinetic energy': 'kinetic_energy',
      'electrical power': 'electrical_power',
      'electric current': 'electric_current',
      current: 'electric_current',
      'voltage difference': 'voltage_difference',
      'net force': 'net_force',
      'wave speed': 'wave_speed'
    };
    return conceptByPhrase[leadingRequestedConcept[1]] ||
      leadingRequestedConcept[1].replace(/\s+/g, '_');
  }

  if (/\bperiodic table\b/.test(text)) return 'periodic_table';
  if (/\bwhat\s+isfriction\b/.test(text)) return 'friction';
  if (/\b(?:find|calculate|compute|determine|what is|what)\b[^?.]{0,28}\bweight\b/.test(text)) {
    return 'weight';
  }
  if (/\belectric fields?\b/.test(text)) return 'electric_field';
  if (/\bchemical energy\b/.test(text)) return 'chemical_energy';
  if (/\bsound energy\b/.test(text)) return 'sound_energy';
  if (/\bthermal energy\b/.test(text)) return 'thermal_energy';
  if (/\bradiant energy\b/.test(text)) return 'radiant_energy';
  if (/\bkinetic energy\b/.test(text)) return 'kinetic_energy';
  if (/\bgravitational potential energy\b|\bgpe\b/.test(text)) {
    return 'gravitational_potential_energy';
  }

  const requestedConceptRules = [
    [/\b(?:what is|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\bfinal velocity\b/, 'velocity'],
    [/\b(?:what is|what|find|calculate|compute|determine|solve for)\b[^?.]{0,36}\bvelocity\b/, 'velocity'],
    [/\b(?:what is|what|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\bacceleration\b/, 'acceleration'],
    [/\b(?:what is|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\bdisplacement\b/, 'displacement'],
    [/\b(?:what is|what|find|calculate|compute|determine|solve for)\b[^?.]{0,36}\bfrequency\b/, 'frequency'],
    [/\b(?:what is|what|find|calculate|compute|determine|solve for)\b[^?.]{0,36}\bwavelength\b/, 'wavelength'],
    [/\b(?:what is|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\bspeed\b|\bhow fast\b/, 'speed'],
    [/\b(?:what is|what|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\bdistance\b|\bhow far\b/, 'distance'],
    [/\b(?:what is|what|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\btime\b|\bhow long\b/, 'time'],
    [/\b(?:what is|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\bnet force\b/, 'net_force'],
    [/\b(?:what is|what|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\bforce\b/, 'force'],
    [/\b(?:what is|what|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\bmass\b/, 'mass'],
    [/\b(?:what is|what|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\bmomentum\b/, 'momentum'],
    [/\b(?:what is|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\bvoltage(?: difference)?\b/, 'voltage_difference'],
    [/\b(?:what is|what|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\b(?:electric )?current\b/, 'electric_current'],
    [/\b(?:what is|what|find|calculate|compute|determine|solve for)\b[^?.]{0,28}\bresistance\b/, 'resistance'],
    [/\b(?:what is|what|find|calculate|compute|determine)\b[^?.]{0,36}\belectrical power\b/, 'electrical_power'],
    [/\b(?:what|which)\b[^?.]{0,45}\bconductor\b|\bdefine\b[^?.]{0,20}\bconductor\b/, 'conductor'],
    [/\bacceleration due to gravity\b|\bgravitational acceleration\b/, 'earth_surface_gravity'],
    [/\bwhat is\b[^?.]{0,20}\belectromagnetic\s+wave\b|\bdefine\b[^?.]{0,20}\belectromagnetic\s+wave\b/, 'electromagnetic_wave'],
    [/\bwhat is\b[^?.]{0,20}\bwave\b|\bdefine\b[^?.]{0,20}\bwave\b/, 'wave'],
    [/\bphysical propert(?:y|ies)\b/, 'physical_properties'],
    [/\bchemical propert(?:y|ies)\b/, 'chemical_property']
  ];

  for (const [pattern, concept] of requestedConceptRules) {
    if (pattern.test(text)) return concept;
  }

  if (/\bnewton(?:'s|s)?\s+(?:first|1st)\s+law\b/.test(text)) return 'newtons_first_law';
  if (/\bnewton(?:'s|s)?\s+(?:second|2nd)\s+law\b/.test(text)) return 'newtons_second_law';
  if (/\bnewton(?:'s|s)?\s+(?:third|3rd)\s+law\b/.test(text)) return 'newtons_third_law';
  if (/\bbalanced forces?\b/.test(text)) return 'balanced_forces';
  if (/\bunbalanced forces?\b/.test(text)) return 'unbalanced_forces';
  if (looksLikeUnitConversionRequest(text)) return 'unit_conversion';
  if (
    /\b(?:convert|conversion)\b/.test(text) &&
    /\b(?:units?|metric|measurement|cm|mm|km|mg|kg|centimeters?|meters?|kilometers?|grams?|kilograms?|seconds?|minutes?|hours?|celsius|fahrenheit)\b/.test(text)
  ) {
    return 'unit_conversion';
  }
  if (/\bscientific notation\b|\bstandard notation\b/.test(text)) return 'scientific_notation';
  if (/\btemperature\b|\bcelsius\b|\bfahrenheit\b/.test(text)) return 'temperature';

  return '';
}

function inferCandidateTopics(message, options = {}) {
  const text = String(message || '');
  const targetConcept = String(options.targetConcept || inferTargetConcept(text));
  const conceptTopic = CONCEPT_TOPICS[targetConcept] || '';
  const classificationTopic =
    CONCEPT_TOPICS[String(options.classificationTarget || '')] || '';

  if (
    /\b(?:protons?|protone|neutrons?|nuetrons?|electrons?|nucleus|atomic number|mass number|isotopes?|ions?|valence electrons?|electron cloud|bohr model|quarks?)\b/i.test(text) &&
    !/\b(?:circuit|electric current|static electricity|charging|conductor|wire|electrical)\b/i.test(text)
  ) {
    return ['atomic_structure'];
  }
  if (
    /\b(?:group|period)\b/i.test(text) &&
    /\b(?:group|period|energy levels?|valence electrons?|periodic table)\b/i.test(text) &&
    !/\b(?:waves?|frequency|wavelength|oscillation)\b/i.test(text)
  ) {
    return ['atomic_structure'];
  }

  if (conceptTopic) {
    if (/\b(?:compare|comparison|difference between)\b/i.test(text)) {
      const comparisonTopics = [conceptTopic];
      for (const rule of TOPIC_RULES) {
        if (rule.patterns.some((pattern) => pattern.test(text))) {
          comparisonTopics.push(rule.topic);
        }
      }
      return [...new Set(comparisonTopics)].slice(0, 3);
    }
    if (
      targetConcept === 'distance' &&
      /\b(?:work|joules?|force)\b/i.test(text)
    ) {
      return ['energy', 'forces'];
    }
    if (targetConcept === 'mass' && /\bmomentum\b/i.test(text)) {
      return ['motion', 'forces'];
    }
    if (
      targetConcept === 'mass' &&
      (
        /\b(?:kinetic energy|potential energy|thermal energy|specific heat|joules?|J\/kg)\b/i.test(text) ||
        (/\bJ\b/.test(text) && /\b(?:speed|velocity|height)\b/i.test(text))
      )
    ) {
      return ['energy'];
    }
    if (
      targetConcept === 'mass' &&
      /\b(?:density|volume|g\s*\/\s*(?:mL|cm(?:³|\^?3)))\b/i.test(text)
    ) {
      return ['matter'];
    }
    if (
      targetConcept === 'mass' &&
      /\b(?:kinetic energy|gravitational potential energy|GPE)\b/i.test(text)
    ) {
      return ['energy'];
    }
    if (
      targetConcept === 'time' &&
      /\b(?:work|power|watts?|joules?|J|W)\b/i.test(text)
    ) {
      return ['energy'];
    }
    if (
      targetConcept === 'speed' &&
      options.taskType === TASK_TYPES.UNIT_ONLY
    ) {
      return ['motion', 'measurement'];
    }
    if (
      ['speed', 'velocity'].includes(targetConcept) &&
      /\b(?:waves?|wavelength|frequency|hertz|Hz|vacuum|electromagnetic)\b/i.test(text)
    ) {
      return ['waves'];
    }
    return [conceptTopic];
  }
  if (classificationTopic) return [classificationTopic];

  const scores = new Map();
  for (const rule of TOPIC_RULES) {
    let score = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) score += 2;
    }
    if (score > 0) scores.set(rule.topic, score);
  }

  if (scores.size === 0) return ['unknown'];

  const ranked = [...scores.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  });
  const bestScore = ranked[0][1];
  const topics = ranked
    .filter(([, score]) => score >= Math.max(2, bestScore - 2))
    .slice(0, 3)
    .map(([topic]) => topic);

  return topics.length ? topics : ['unknown'];
}

function extractSuppliedChoices(message, options = {}) {
  const structuredChoices =
    options.suppliedChoices || options.answerChoices || options.choices;
  if (Array.isArray(structuredChoices) && structuredChoices.length > 0) {
    return structuredChoices
      .map((choice, index) => normalizeChoice(choice, index))
      .filter((choice) => choice.text);
  }

  const text = String(message || '');
  const markerPattern =
    /(?:^|\s)(?:\(([A-H]|\d{1,2})\)|([A-H]|\d{1,2})[.)])\s+/gim;
  const markers = [];
  let match;

  while ((match = markerPattern.exec(text)) !== null) {
    markers.push({
      markerStart: match.index,
      textStart: markerPattern.lastIndex,
      label: String(match[1] || match[2] || '').toUpperCase()
    });
  }

  if (markers.length < 2) return [];

  return markers
    .map((marker, index) => {
      const next = markers[index + 1];
      const choiceText = text
        .slice(marker.textStart, next ? next.markerStart : text.length)
        .replace(/[\s,;]+$/g, '')
        .trim();
      return {
        label: marker.label,
        text: choiceText
      };
    })
    .filter((choice) => choice.text);
}

function normalizeChoice(choice, index) {
  if (choice && typeof choice === 'object') {
    return {
      label: String(choice.label || choice.id || choice.key || index + 1).trim(),
      text: String(choice.text || choice.value || choice.answer || '').trim()
    };
  }
  return {
    label: String(index + 1),
    text: String(choice || '').trim()
  };
}

function extractNumericalGivens(message, options = {}) {
  const text = String(message || '');
  const unitMentions = findUnitMentions(text);
  const numberPattern =
    /[-+]?(?:\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)(?:\s*\/\s*\d+(?:\.\d+)?)?/g;
  const givens = [];
  let match;

  while ((match = numberPattern.exec(text)) !== null) {
    const start = match.index;
    const end = numberPattern.lastIndex;
    const containingUnit = unitMentions.find(
      (unit) => start >= unit.index && end <= unit.end
    );
    if (containingUnit) continue;

    const nextCharacter = text.slice(end, end + 1);
    const previousText = text.slice(Math.max(0, start - 3), start);
    if (
      /[.)]/.test(nextCharacter) &&
      (start === 0 || /(?:^|\n)\s*$/.test(previousText))
    ) {
      continue;
    }

    const followingUnit = unitMentions.find((unit) => {
      if (unit.index < end) return false;
      return /^\s*$/.test(text.slice(end, unit.index));
    });
    const raw = followingUnit
      ? text.slice(start, followingUnit.end).trim()
      : match[0].trim();
    const unit = followingUnit?.canonical || '';
    const value = parseNumericValue(match[0]);

    if (!Number.isFinite(value)) continue;

    givens.push({
      value,
      raw,
      unit,
      role: inferNumericalRole(text, start, end, unit),
      inferred: false
    });
  }

  if (/\bone[- ]sixth\b/i.test(text)) {
    givens.push({
      value: 1 / 6,
      raw: text.match(/\bone[- ]sixth\b/i)[0],
      unit: 'ratio',
      role: 'comparison',
      inferred: false
    });
  }

  if (
    options.targetConcept === 'gravitational_potential_energy' &&
    /\b(?:on|at)\s+(?:the\s+)?ground(?:\s+level)?\b|\bground level\b/i.test(text) &&
    !givens.some((given) => given.role === 'height')
  ) {
    givens.push({
      value: 0,
      raw: 'ground level',
      unit: 'm',
      role: 'height',
      inferred: true
    });
  }

  return givens;
}

function inferRequestedUnits(message, options = {}) {
  if (Array.isArray(options.requestedUnits) && options.requestedUnits.length > 0) {
    return uniqueStrings(
      options.requestedUnits
        .map((unit) => canonicalizeUnit(unit))
        .filter(Boolean)
    );
  }

  const text = String(message || '');
  const targetConcept = String(options.targetConcept || inferTargetConcept(text));
  const mentions = findUnitMentions(text);
  const explicitAnswerUnit = findExplicitAnswerUnit(text, mentions);
  if (explicitAnswerUnit) return [explicitAnswerUnit];

  if (targetConcept === 'unit_conversion') {
    const countedUnit = /\bhow many\s+([A-Za-z°²^/]+)\s+(?:(?:is|are)\s+)?in\b/i.exec(text);
    const canonicalCountedUnit = canonicalizeUnit(countedUnit?.[1]);
    if (canonicalCountedUnit) return [canonicalCountedUnit];
  }

  if (targetConcept === 'temperature') {
    const temperatureTarget = /\b(?:to|into)\s+°?\s*([CFK])\b/i.exec(text);
    if (temperatureTarget) return [temperatureTarget[1].toUpperCase()];
  }

  if (targetConcept === 'unit_conversion') {
    const conversionTarget = findConversionTargetUnit(text, mentions);
    if (conversionTarget) return [conversionTarget];
  }

  if (targetConcept === 'speed' || targetConcept === 'velocity') {
    const compositeSpeedUnits = uniqueStrings(
      mentions
        .filter((mention) =>
          ['m/s', 'cm/min', 'km/h', 'ft/s', 'mph'].includes(mention.canonical)
        )
        .map((mention) => mention.canonical)
    );
    const compositeSpeedUnit = mentions.find((mention) =>
      ['m/s', 'cm/min', 'km/h', 'ft/s', 'mph'].includes(mention.canonical)
    );
    const lengthUnit = mentions.find((mention) => isLengthUnit(mention.canonical));
    const timeUnit = mentions.find((mention) => isTimeUnit(mention.canonical));

    if (compositeSpeedUnits.length > 1) return compositeSpeedUnits;
    if (lengthUnit && timeUnit) {
      const composedUnit = `${lengthUnit.canonical}/${timeUnit.canonical}`;
      return [composedUnit === 'mi/h' ? 'mph' : composedUnit];
    }
    if (compositeSpeedUnit) return [compositeSpeedUnit.canonical];
    if (
      options.taskType === TASK_TYPES.CALCULATION ||
      options.taskType === TASK_TYPES.UNIT_ONLY
    ) {
      return ['m/s'];
    }
  }

  if (targetConcept === 'distance') {
    const speedUnit = mentions.find((mention) =>
      ['m/s', 'cm/min', 'km/h', 'ft/s', 'mph'].includes(mention.canonical)
    );
    if (speedUnit) return [speedUnitNumerator(speedUnit.canonical)];
    const lengthUnit = mentions.find((mention) => isLengthUnit(mention.canonical));
    if (lengthUnit) return [lengthUnit.canonical];
    if (options.taskType === TASK_TYPES.CALCULATION) return ['m'];
  }

  if (targetConcept === 'time') {
    const speedUnit = mentions.find((mention) =>
      ['m/s', 'cm/min', 'km/h', 'ft/s', 'mph'].includes(mention.canonical)
    );
    if (speedUnit) return [speedUnitDenominator(speedUnit.canonical)];
    if (options.taskType === TASK_TYPES.CALCULATION) return ['s'];
  }

  if (
    targetConcept === 'acceleration' &&
    options.taskType === TASK_TYPES.CALCULATION
  ) {
    if (
      mentions.some((mention) => mention.canonical === 'km/h') &&
      /\b(?:convert(?:ed|ing)?\s+(?:the\s+)?time\s+to\s+hours?|hours?\s+first)\b/i.test(text)
    ) {
      return ['km/h²'];
    }
    return ['m/s²'];
  }

  if (
    targetConcept === 'mass' &&
    options.taskType === TASK_TYPES.CALCULATION &&
    /\bdensity\b/i.test(text) &&
    /\bg\s*\/\s*(?:mL|cm(?:³|\^?\s*3))(?=$|[\s,.;)])/i.test(text)
  ) {
    return ['g'];
  }

  const expectedUnitByConcept = {
    force: 'N',
    net_force: 'N',
    mass: 'kg',
    weight: 'N',
    momentum: 'kg·m/s',
    work: 'J',
    power: 'W',
    height: 'm',
    heat_energy: 'J',
    specific_heat: 'J/kg°C',
    voltage: 'V',
    voltage_difference: 'V',
    electric_current: 'A',
    resistance: 'Ω',
    electrical_power: 'W',
    kinetic_energy: 'J',
    gravitational_potential_energy: 'J',
    wave_speed: 'm/s',
    frequency: 'Hz',
    wavelength: 'm',
    period: 's',
    earth_surface_gravity: 'm/s²'
  };
  const expectedUnit = expectedUnitByConcept[targetConcept];
  if (expectedUnit && options.taskType === TASK_TYPES.CALCULATION) {
    return [expectedUnit];
  }

  return [];
}

function inferRequiredAnswerForm(taskType, details = {}) {
  if (taskType === TASK_TYPES.DIAGRAM_REQUIRED) return 'clarification_for_visual';
  if (taskType === TASK_TYPES.DRAW_DIAGRAM) return 'diagram';
  if (taskType === TASK_TYPES.MULTIPLE_CHOICE) {
    return details.missingAnswerChoices ? 'clarification_for_choices' : 'choice';
  }
  if (taskType === TASK_TYPES.CALCULATION) {
    return details.requestedUnits?.length ? 'numeric_with_unit' : 'numeric_result';
  }
  if (taskType === TASK_TYPES.UNIT_ONLY) return 'unit';
  if (taskType === TASK_TYPES.DEFINITION && details.formulaLookup) return 'formula';
  if (taskType === TASK_TYPES.DEFINITION) return 'definition';
  if (taskType === TASK_TYPES.CLOZE) return 'term';
  if (taskType === TASK_TYPES.BINARY_CLASSIFICATION) return 'category';
  if (taskType === TASK_TYPES.LAW_IDENTIFICATION) return 'law_name';
  if (taskType === TASK_TYPES.EXPLANATION) return 'causal_explanation';
  return 'safe_no_match';
}

function buildEvidenceRequirements(details) {
  const blockedByMissingContext = details.missingContext.length > 0;
  const requiredCategories =
    details.taskType === TASK_TYPES.BINARY_CLASSIFICATION
      ? inferBinaryCategories(
        details.classificationTarget || details.targetConcept
      )
      : [];
  const supportedAnswerTask = ![
    TASK_TYPES.DIAGRAM_REQUIRED,
    TASK_TYPES.DRAW_DIAGRAM,
    TASK_TYPES.UNSUPPORTED
  ].includes(details.taskType);

  return {
    minimumEvidenceItems:
      blockedByMissingContext || !supportedAnswerTask ? 0 : 1,
    trustedEvidenceRequired: supportedAnswerTask && !blockedByMissingContext,
    compatibleTopicRequired:
      supportedAnswerTask &&
      !details.candidateTopics.includes('unknown'),
    targetConceptSupportRequired:
      supportedAnswerTask && Boolean(details.targetConcept),
    requiredConcepts: details.targetConcept
      ? [details.targetConcept]
      : details.classificationTarget
        ? [details.classificationTarget]
        : [],
    requiredUnits: [...details.requestedUnits],
    allowedCategories: requiredCategories,
    numericalResultRequired: details.taskType === TASK_TYPES.CALCULATION,
    explicitCategoryResolutionRequired:
      details.taskType === TASK_TYPES.BINARY_CLASSIFICATION,
    suppliedChoiceResolutionRequired:
      details.taskType === TASK_TYPES.MULTIPLE_CHOICE &&
      !details.missingAnswerChoices,
    lawNameRequired: details.taskType === TASK_TYPES.LAW_IDENTIFICATION,
    definitionRequired:
      details.taskType === TASK_TYPES.DEFINITION &&
      details.requiredAnswerForm !== 'formula',
    causalExplanationRequired: details.taskType === TASK_TYPES.EXPLANATION,
    shortTargetTermRequired: details.taskType === TASK_TYPES.CLOZE,
    visualContextRequired: details.unseenDiagramRequired,
    clarificationRequired: blockedByMissingContext,
    graphEvidenceAllowed:
      !blockedByMissingContext &&
      [TASK_TYPES.DEFINITION, TASK_TYPES.EXPLANATION].includes(details.taskType),
    graphReplacementAllowed:
      !blockedByMissingContext &&
      [TASK_TYPES.DEFINITION, TASK_TYPES.EXPLANATION].includes(details.taskType)
  };
}

function referencesAnswerChoices(message) {
  return /\b(?:which of (?:the following|these|those)|which (?:answer|choice|option) is correct|select (?:one|the best|an answer|the correct)|choose (?:one|the best|from|the correct)|pick (?:one|the best|the correct|[A-D](?:\s*,\s*[A-D]){1,3}\s*,?\s*or\s*[A-D])|answer choices?|choices? (?:are|below|above|provided|shown)|options? (?:are|below|above|provided|shown)|multiple[- ]choice)\b/i.test(
    String(message || '')
  );
}

function looksLikeLawIdentification(message) {
  return /\b(?:what|which)\s+(?:(?:scientific|newton(?:['’]s)?)\s+)?law\b|\b(?:identify|name)\s+(?:the\s+)?law\b|\bdemonstrat(?:e|es|ing)\s+(?:what|which)\s+law\b/i.test(
    String(message || '')
  );
}

function looksLikeUnitOnlyQuestion(message) {
  return /\b(?:determine|identify|state|give|find|what|which)\s+(?:is|are|would be|should be)?\s*(?:the\s+)?units?\b|\bunits?\s+(?:would|should|do|does|is|are)\b|\bunit\s+for\b|\bmeasured in what units?\b/i.test(
    String(message || '')
  );
}

function looksLikeWhyQuestion(message) {
  const text = String(message || '').trim();
  if (/^how\s+(?:is|are)\b.*\b(?:organized|arranged|structured|defined)\b/i.test(text)) {
    return false;
  }
  return /^(?:why|how come)\b|^(?:does|do)\b|^when\b.*\b(?:is|are|does|do)\b|^explain\b|^summarize\b|^list\b|^what did\b|^what do\b(?!\s+i\s+need\s+to\s+know\b)|^who\b|^(?:give|show)\s+(?:me\s+)?(?:an?\s+|examples?\s+)?\b|^(?:can|could|would)\s+you\s+(?:explain|summarize|list|describe|give|show)\b|^what\s+do\s+i\s+need\s+to\s+know\b|^what\s+should\s+i\s+(?:understand|know)\b|^i\s+(?:keep\s+mixing\s+up|am\s+confused\s+about|do\s+not\s+get|don'?t\s+get)\b|^what happens?\b|^how\s+(?:does|do|did|can|could|would|will)\b|^how\s+(?:is|are)\b.*\brelated\b|\bexplain (?:why|how)\b|\bwhat causes?\b|\bwhy (?:is|are|does|do|did|can|could|would)\b/i.test(
    text
  );
}

function looksLikeBinaryClassification(message) {
  return /\b(?:kinetic|potential)(?:\s+energy)?\s+(?:or|versus|vs\.?)\s+(?:kinetic|potential)(?:\s+energy)?\b|\b(?:physical|chem(?:ical)?)\s+(?:or|versus|vs\.?)\s+(?:physical|chem(?:ical)?)\b|\b(?:homogeneous|heterogeneous|homo|hetero)\s+(?:or|versus|vs\.?)\s+(?:homogeneous|heterogeneous|homo|hetero)\b|\bwhat\s+(?:kind|type)\s+of\s+mixture\b|\b(?:balanced|unbalanced)\s+(?:or|versus|vs\.?)\s+(?:balanced|unbalanced)\b|\b(?:conductors?|insulators?)\s+(?:or|versus|vs\.?)\s+(?:an?\s+)?(?:conductors?|insulators?)\b|\b(?:true|false)\s+(?:or|versus|vs\.?)\s+(?:true|false)\b|\b(?:increase|decrease|stay(?:s)? the same)\s+(?:or|versus|vs\.?)\s+(?:increase|decrease|stay(?:s)? the same)\b/i.test(
    String(message || '')
  );
}

function looksLikeFormulaLookup(message) {
  const text = String(message || '');
  return (
    /\b(?:formula|formulas|equation|equations)\b/i.test(text) &&
    /\b(?:what|which|show|give|list|have|use|solve for)\b/i.test(text) ||
    /\b(?:how do i\s+)?solve for\s+(?:the\s+)?[a-z][a-z ]{0,30}\b/i.test(text)
  ) &&
    !/\b(?:calculate|compute|evaluate)\b/i.test(text);
}

function looksLikeEnergyTypeIdentification(message) {
  const text = normalizeForMatching(message);
  if (!/\benergy\b/.test(text)) return false;
  return /\b(?:what|which)\s+(?:type|kind|form)\s+of\s+energy\b/.test(text) ||
    /\b(?:what|which)\s+energy\s+(?:type|kind|form)\b/.test(text) ||
    /\bwhat\s+type\s+energy\b/.test(text) ||
    /\bwhat\s+energy\s+(?:is|does|comes?|gives?|stored|in)\b/.test(text) ||
    /\bwhat\s+(?:energy|kind\s+of\s+energy)\s+is\b/.test(text);
}

function looksLikeWorkTransferCalculation(message) {
  const text = normalizeForMatching(message);
  return /\bwhat\s+energy\s+is\s+transferred\b/.test(text) &&
    /\bforces?\b/.test(text) &&
    /\b(?:moves?|moving|distance|displacement)\b/.test(text) &&
    /\d/.test(text);
}

function looksLikeExplicitWorkCalculation(message) {
  return /\b(?:calculate|compute|find|determine|solve for)\s+(?:the\s+)?work\b/i.test(
    String(message || '')
  );
}

function looksLikeExplicitPowerCalculation(message) {
  return /\b(?:calculate|compute|find|determine|solve for)\s+(?:the\s+)?power\b/i.test(
    String(message || '')
  );
}

function looksLikeConservationOfMassQuestion(message) {
  const text = normalizeForMatching(message);
  return /\bconservation of (?:mass|matter)\b/.test(text) ||
    (
      /\bmass\b/.test(text) &&
      /\b(?:disappear|created|destroyed|conserved|stays? the same|equal)\b/.test(text) &&
      /\b(?:chemical (?:change|reaction)|reaction|closed system|rust)\b/.test(text)
    );
}

function looksLikeBoundedDensityCalculation(message) {
  const text = normalizeForMatching(message);
  const hasNumber = /\d/.test(text);
  const hasMass = /\bmass\b|\bweigh(?:s|ed|ing)?\b/.test(text);
  const hasThreeDimensions =
    /\b(?:measures?|measuring|box|cube)\b/.test(text) &&
    /\d+(?:\.\d+)?\s*(?:cm|m)?\s+by\s+\d+(?:\.\d+)?\s*(?:cm|m)?\s+by\s+\d+(?:\.\d+)?/.test(text);

  if (!hasNumber || !hasMass) return false;
  if (/\bdensity if\b/.test(text) && /\bbox\b|\bby\b/.test(text)) return true;
  if (/\bdensity table\b/.test(text) && /\b(?:cube|side|measures?)\b/.test(text)) {
    return true;
  }
  return hasThreeDimensions && (
    /\bdensity\b/.test(text) ||
    /\bfloat\b.*\bsink\b|\bsink\b.*\bfloat\b/.test(text)
  );
}

function looksLikeDensityFloatSinkQuestion(message) {
  const text = normalizeForMatching(message);
  return /\bdensity\b/.test(text) &&
    /\bfloat\b.*\bsink\b|\bsink\b.*\bfloat\b/.test(text);
}

function looksLikePropertyClassification(message) {
  const text = normalizeForMatching(message);
  return /\bphysical\b.*\bchemical propert(?:y|ies)\b|\bchemical\b.*\bphysical propert(?:y|ies)\b/.test(text) ||
    (
      /\bpropert(?:y|ies)\b/.test(text) &&
      /\bphysical\b/.test(text) &&
      /\bchemical\b/.test(text)
    ) ||
    (
      /\breactivity with oxygen\b/.test(text) &&
      /\bphysical propert(?:y|ies)\b/.test(text)
    );
}

function looksLikeChangeClassification(message) {
  const text = normalizeForMatching(message);
  const offersPhysicalChemical =
    /\bphysical\b.*\bchem(?:ical)?\b|\bchem(?:ical)?\b.*\bphysical\b/.test(text);
  if (!offersPhysicalChemical || /\bpropert(?:y|ies)\b/.test(text)) return false;
  return /\b(?:boiling|melting|freezing|burning|rusting|inflating|sharpening|chopping|broken)\b/.test(text);
}

function looksLikeElementCompoundMixtureClassification(message) {
  const text = normalizeForMatching(message);
  return /\bhcl\b/.test(text) &&
    /\belement\b/.test(text) &&
    /\bcompound\b/.test(text) &&
    /\bmixture\b/.test(text);
}

function looksLikeNamedElementGroupClassification(message) {
  const text = normalizeForMatching(message);
  return /\bhydrogen\b/.test(text) &&
    /\bgold\b/.test(text) &&
    /\biron\b/.test(text) &&
    /\belements?\b/.test(text);
}

function looksLikeExplicitMixtureTarget(message) {
  const text = normalizeForMatching(message);
  if (/\bwhat\s+(?:kind|type)\s+of\s+mixture\b/.test(text)) return true;
  if (/\bclassify\s+sugar water\b/.test(text)) return true;
  return (
    /\b(?:olive oil(?: in)? water|olive oil in water|mineral water)\b/.test(text) &&
    /\b(?:homogeneous|heterogeneous|homo|hetero)\b/.test(text)
  );
}

function looksLikeWaterStateQuestion(message) {
  const text = normalizeForMatching(message);
  return /\bwhat state is water at\b/.test(text) &&
    /[-+]?\d+(?:\.\d+)?\s*(?:°\s*)?(?:c|celsius)\b/.test(text);
}

function looksLikeHeatingCurveQuestion(message) {
  const text = normalizeForMatching(message);
  return /\bheating curve\b/.test(text) &&
    (
      /\bwhat is\b/.test(text) ||
      /\bsegment\s+\d+\b/.test(text) ||
      /\bteach|explain|describe\b/.test(text)
    );
}

function looksLikeChangesOfStateTeachingRequest(message) {
  const text = normalizeForMatching(message);
  return /\b(?:teach|quiz)\s+me\s+(?:about\s+|on\s+)?changes? of state\b/.test(text);
}

function looksLikeWaterPolarityQuestion(message) {
  const text = normalizeForMatching(message);
  return /\bwhy is water (?:called )?polar\b/.test(text);
}

function looksLikeSaltDissolutionQuestion(message) {
  const text = normalizeForMatching(message);
  return /\bwhy does salt dissolve in water\b/.test(text);
}

function looksLikeDissolvingRateQuestion(message) {
  const text = normalizeForMatching(message);
  return /\bhow can i make sugar dissolve faster\b/.test(text);
}

function inferClassificationTarget(message) {
  const text = normalizeForMatching(message);
  if (
    /\b(?:homogeneous|heterogeneous|homo|hetero)\s+(?:or|versus|vs\.?)\s+(?:homogeneous|heterogeneous|homo|hetero)\b/.test(text) ||
    /\bwhat\s+(?:kind|type)\s+of\s+mixture\b/.test(text)
  ) {
    return 'mixture_classification';
  }
  if (
    /\bphysical\b.*\bchem(?:ical)?\b|\bchem(?:ical)?\b.*\bphysical\b/.test(text)
  ) {
    return /\bpropert(?:y|ies)\b/.test(text)
      ? 'property_classification'
      : 'change_classification';
  }
  if (looksLikeElementCompoundMixtureClassification(text)) {
    return 'matter_classification';
  }
  return '';
}

function looksLikeEnergyTransformationQuestion(message) {
  const text = normalizeForMatching(message);
  return /\b(?:energy\s+transformation|energy\s+change|energy\s+transform|energy\s+converted|energy\s+conversion|what\s+energy\s+transforms?|what\s+energy\s+changes?|what\s+energy\s+change\s+happens)\b/.test(text) ||
    (/\bchanges?\s+(?:into|to)\b/.test(text) && /\benergy\b/.test(text)) ||
    /\bbattery\s+to\s+bulb\b/.test(text);
}

function looksLikeLearningShapeRequest(message) {
  return /\b(?:make|create|give|show|list)\b[^?.]{0,30}\b(?:flash\s*cards?|study\s+cards?|examples?|non[-\s]?examples?|common mistakes?)\b|\b(?:teach|quiz)\s+(?:me\s+)?(?:on|about)\b/i.test(
    String(message || '')
  );
}

function looksLikeComparisonOrClassificationQuestion(message) {
  const text = String(message || '').trim();
  return /^(?:compare|classify|identify)\b/i.test(text) ||
    /\b(?:difference|comparison)\s+between\b/i.test(text) ||
    /\bclassified as what\b/i.test(text) ||
    /\b(?:solute|solvent)\s+(?:versus|vs\.?|difference)\b/i.test(text);
}

function looksLikeWaveConceptQuestion(message) {
  const text = normalizeForMatching(message);
  const hasWaveEvidence =
    /\b(?:waves?|wavelength|frequency|amplitude|hertz|transverse|longitudinal|electromagnetic|mechanical wave|sound|echo|pitch|light|optical|medium|vacuum|crest|trough|compression|rarefaction|reflection|refraction|diffraction|absorption|interference|resonance|doppler|spectrum|lenses?|rods?|cones?|noise[- ]cancel(?:ing|ling)?|headphones?)\b/.test(text);
  if (!hasWaveEvidence) return false;
  return /\?/.test(String(message || '')) ||
    /^(?:what|which|where|when|how|why|can|does|do|is|are|as|in order|put|name|list|teach|quiz)\b/.test(text) ||
    /\b(?:what happens|is called what|means what|example of what|travel through what)\b/.test(text);
}

function looksLikeCalculation(message, details = {}) {
  const text = String(message || '');
  if (/\b(?:calculate|compute|solve|evaluate)\b/i.test(text)) return true;
  if (
    details.targetConcept === 'density' &&
    looksLikeBoundedDensityCalculation(text)
  ) {
    return true;
  }
  if (
    details.targetConcept === 'unit_conversion' &&
    looksLikeUnitConversionRequest(text)
  ) {
    return true;
  }
  if (
    /\bconvert(?:ed|ing|s)?\b/i.test(text) &&
    (
      details.targetConcept === 'unit_conversion' ||
      details.targetConcept === 'temperature' ||
      /\b(?:units?|metric|centimeters?|meters?|kilometers?|grams?|kilograms?|seconds?|minutes?|hours?|celsius|fahrenheit)\b/i.test(text)
    )
  ) {
    return true;
  }
  if (
    /\bwrite\b.*\b(?:scientific|standard)\s+notation\b/i.test(text)
  ) {
    return true;
  }

  const calculationConcepts = new Set([
    'speed',
    'distance',
    'time',
    'velocity',
    'acceleration',
    'displacement',
    'height',
    'heat_energy',
    'specific_heat',
    'density',
    'volume',
    'unit_conversion',
    'protons_and_electrons',
    'atomic_number',
    'mass_number',
    'proton',
    'protons',
    'neutron',
    'neutrons',
    'electron',
    'electrons',
    'valence_electrons',
    'isotope',
    'bohr_model',
    'force',
    'net_force',
    'mass',
    'weight',
    'momentum',
    'work',
    'power',
    'voltage',
    'voltage_difference',
    'electric_current',
    'resistance',
    'electrical_power',
    'mass_number',
    'kinetic_energy',
    'gravitational_potential_energy',
    'wave_speed',
    'frequency',
    'wavelength',
    'period',
    'temperature'
  ]);
  const hasGiven =
    Array.isArray(details.numericalGivens) &&
    details.numericalGivens.length > 0;
  const hasGroundHeight =
    details.targetConcept === 'gravitational_potential_energy' &&
    /\bground(?:\s+level)?\b/i.test(text);
  const hasAtomicConstructionRequest =
    ['isotope', 'bohr_model'].includes(details.targetConcept) &&
    /\b(?:write|set up|draw|make|build)\b/i.test(text);
  const hasAtomicCountRequest =
    ['atomic_number', 'mass_number', 'proton', 'protons', 'neutron', 'neutrons', 'electron', 'electrons']
      .includes(details.targetConcept) &&
    /\b(?:how many|what is|what|has what|mass number|atomic number)\b/i.test(text);

  return (
    calculationConcepts.has(details.targetConcept) &&
    (hasGiven || hasGroundHeight) &&
    (
      /\b(?:what is|what|find|determine|how much|how many|how far|how fast|how long|how high)\b/i.test(text) ||
      hasAtomicConstructionRequest ||
      hasAtomicCountRequest
    )
  );
}

function looksLikeCloze(message) {
  return /_{2,}|\[(?:the\s+)?blank\]|\bfill in (?:the )?blank\b|\bblank\s*[:=]|\bis called\s+(?:what|_{2,})\b|\bis (?:an? |the )?_{2,}/i.test(
    String(message || '')
  );
}

function looksLikeKnownConceptClue(message, targetConcept) {
  if (!targetConcept) return false;
  const text = String(message || '').trim();
  if (/^(?:what|which|why|how|define|explain|calculate|compute|find|determine)\b/i.test(text)) {
    return /\bwhat (?:term|concept|word|name|quantity|field|electrical push)\b|\bwhat is this called\b|\bwhat (?:slows|prevents|opposes)\b|\bwhat push(?:es)?\b[\s\S]{0,35}\b(?:electric )?charges?\b|\bwhat creates?\b[\s\S]{0,35}\bforce\b[\s\S]{0,35}\bcharge\b/i.test(text);
  }

  return [
    'balanced_forces',
    'unbalanced_forces',
    'net_force',
    'force',
    'position',
    'speed',
    'acceleration',
    'momentum',
    'wave',
    'energy_type',
    'convection',
    'magnetic_field',
    'generator',
    'electric_current',
    'electric_field',
    'voltage_difference',
    'gravitational_potential_energy',
    'tarnishing',
    'physical_properties'
  ].includes(targetConcept);
}

function inferForceBalanceTarget(message) {
  const text = normalizeForMatching(message);
  const mentionsForce = /\b(?:forces?|push(?:es)?|pull(?:s)?)\b/.test(text);
  if (!mentionsForce) return '';

  if (
    /\b(?:vector sum|combined|overall|total)\b/.test(text) &&
    /\b(?:every|all|forces?)\b/.test(text)
  ) {
    return 'net_force';
  }
  if (
    /\b(?:every|all)\b[\s\S]{0,35}\bforces?\b/.test(text) &&
    /\bcancel(?:s|ed|ing)?\b/.test(text)
  ) {
    return 'balanced_forces';
  }

  const equal = /\b(?:equal(?:ly)?|same)\b/.test(text);
  const unequal = /\b(?:unequal|different|not equal)\b/.test(text);
  const sameDirection =
    /\b(?:same direction|point(?:s|ing)? (?:in )?the same (?:way|direction))\b/.test(text);
  const oppositeDirection =
    /\bopposite\b/.test(text) ||
    /\b(?:left and right|right and left|east and west|west and east|up and down|down and up)\b/.test(text);
  const numericForces = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*n\b/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const unequalNumericForces =
    numericForces.length >= 2 &&
    new Set(numericForces).size > 1;

  if (equal && oppositeDirection && !unequal) return 'balanced_forces';
  if (
    unequal ||
    unequalNumericForces ||
    sameDirection
  ) {
    return 'unbalanced_forces';
  }
  return '';
}

function inferNumericForceCalculationTarget(message) {
  const text = normalizeForMatching(message);
  const forceCount = [...text.matchAll(/\b\d+(?:\.\d+)?\s*n\b/g)].length;
  if (forceCount < 2) return '';
  if (/\b(?:what is|find|calculate|compute|determine)\b[\s\S]{0,35}\bnet force\b|\bnet force\b\s*\??$/.test(text)) {
    return 'net_force';
  }
  if (
    /\b(?:what is|find|calculate|compute|determine)\b[\s\S]{0,35}\bacceleration\b/.test(text) &&
    /\bmass\b|\bkg\b/.test(text)
  ) {
    return 'acceleration';
  }
  return '';
}

function inferExplicitSolveForTarget(message) {
  const text = normalizeForMatching(message);
  const match = /\bsolve for\s+(?:the\s+)?(electrical power|power|voltage|current|resistance)\b/.exec(text);
  if (!match) return '';
  if (
    match[1] === 'power' &&
    /\bvoltage\b/.test(text) &&
    /\bcurrent\b/.test(text)
  ) {
    return 'electrical_power';
  }
  return {
    'electrical power': 'electrical_power',
    power: 'power',
    voltage: 'voltage_difference',
    current: 'electric_current',
    resistance: 'resistance'
  }[match[1]] || '';
}

function looksLikeRestingObjectOnSurface(message) {
  const text = normalizeForMatching(message);
  const resting =
    /\b(?:sits?|sitting|rests?|resting|remains? still|stays? (?:still|motionless)|motionless|at rest)\b/;
  const surface =
    /\b(?:table|desk|shelf|countertop|counter|level surface|surface)\b/;
  return resting.test(text) && (
    surface.test(text) ||
    /\bhang(?:s|ing)?\b/.test(text)
  );
}

function looksLikeFirstLawRestCondition(message) {
  const text = normalizeForMatching(message);
  if (!/\b(?:what|which)\b[\s\S]{0,20}\bnewton(?:'s|s)?\s+law\b|\bnewton(?:'s|s)?\s+law\b/.test(text)) {
    return false;
  }
  return (
    /\b(?:stay(?:s|ing)?|remain(?:s|ing)?|at)\s+(?:at\s+)?rest\b/.test(text) ||
    /\bnet force\b[\s\S]{0,20}\b(?:zero|0)\b/.test(text) ||
    /\b(?:zero|0)\b[\s\S]{0,20}\bnet force\b/.test(text) ||
    /\bnot accelerat(?:e|ing)\b/.test(text)
  );
}

function looksLikeMoonGravityContext(message) {
  const text = normalizeForMatching(message);
  return /\b(?:moon|lunar)\b/.test(text) &&
    (
      /\bgravit/.test(text) ||
      /\bweigh(?:s|t|ing)?\b|\bweight\b/.test(text) ||
      /\bjump(?:s|ed|ing)?\s+higher\b/.test(text) ||
      /\b(?:fall|falls|falling|drop|drops|dropping)\b/.test(text) ||
      /\bmass\b[\s\S]{0,25}\bweight\b|\bweight\b[\s\S]{0,25}\bmass\b/.test(text)
    );
}

function looksLikeWaveEnergyThroughMatter(message) {
  const text = normalizeForMatching(message);
  return /\b(?:sound\s+)?waves?\b/.test(text) &&
    /\b(?:carry|carries|carrying|transfer|transfers|transmit|transmits)\b/.test(text) &&
    /\benergy\b/.test(text) &&
    /\b(?:matter|material|medium)\b/.test(text);
}

function looksLikeElectricCurrentDescription(message) {
  const text = normalizeForMatching(message);
  if (/\b(?:slow|slows|slowing|resist|resists|opposes)\b/.test(text)) {
    return false;
  }
  const movingCharge =
    /\b(?:movement|flow|rate)\b[\s\S]{0,45}\b(?:electric charge|charge|electrons?|electricity)\b/.test(text) ||
    /\b(?:electric charge|charge|electrons?|electricity)\b[\s\S]{0,45}\b(?:moves?|moving|flows?|movement|flow)\b/.test(text);
  const electricalPath =
    /\b(?:wire|conductor|conducting material|metal|circuit)\b/.test(text);
  return movingCharge && electricalPath;
}

function looksLikeConductorMaterialQuestion(message) {
  const text = normalizeForMatching(message);
  return /\b(?:which|what)\b[\s\S]{0,45}\b(?:material|one)\b[\s\S]{0,45}\bconduct/.test(text) ||
    /\b(?:which|what)\b[\s\S]{0,45}\b(?:lets?|allows?)\b[\s\S]{0,30}\bcharge\b[\s\S]{0,20}\bflow\b/.test(text);
}

function looksLikeElectricFieldDescription(message) {
  const text = normalizeForMatching(message);
  if (
    /\bdifference between\b/.test(text) &&
    /\bvoltage\b/.test(text)
  ) {
    return false;
  }
  return (
    /\belectric(?:al)? fields?\b/.test(text) &&
    /\b(?:force|push|pull|charge)\b/.test(text)
  ) || (
    /\b(?:what|which)(?:\s+(?:electric|electrical))?\s+field\b[\s\S]{0,45}\bcharge\b/.test(text) &&
    /\b(?:force|push|pull)\b/.test(text)
  );
}

function looksLikeVoltagePushDescription(message) {
  const text = normalizeForMatching(message);
  if (/\belectric(?:al)? fields?\b/.test(text)) return false;
  if (
    /\bvoltage\b/.test(text) &&
    (
      /\b(?:what is|define|explain)\s+(?:the\s+)?voltage\b/.test(text) ||
      /\b(?:mechanical\s+)?force\b|\bnewtons?\b/.test(text)
    )
  ) {
    return true;
  }
  return /\b(?:electrical|electric|battery|force-like)\b[\s\S]{0,35}\bpush\b/.test(text) &&
    /\b(?:charges?|current|circuit)\b/.test(text) ||
    /\bwhat push(?:es)?\b[\s\S]{0,35}\b(?:electric )?charges?\b[\s\S]{0,35}\bcircuit\b/.test(text);
}

function looksLikeDefinitionQuestion(message) {
  const text = String(message || '').trim();
  return /\bwhat\s+is(?=[A-Z])/.test(text) ||
    /\b(?:what|who)\s+(?:is|are|was|were)\b|^(?:is|are|was|were)\b|^how many\s+(?:protons?|neutrons?|nuetrons?|electrons?|valence electrons?)\b|^(?:what|which)\s+(?:one|charge|kind|type|state|phase|part|field|direction|way|material|component|particles?|number|factors?|heat transfer)\b|^what\s+(?:can|has)\b|^where\s+(?:is|are|should|does|do|can)\b|^how\s+(?:is|are)\b.*\b(?:organized|arranged|structured|different|compare|related)\b|\blook(?:s)? like\b|\bdefine\b|\bdefinition of\b|\bwhat does\b|\bdescribe\b|\bclassified as what\b|\btwo places?\b.*\bplasma\b/i.test(text);
}

function looksLikeDrawDiagramRequest(message) {
  return /\b(?:draw|sketch|create|make|generate|provide|show)\b[^?.]{0,70}\b(?:(?:series|parallel)?\s*circuit|diagram|graph|chart|model|free[- ]body)\b/i.test(
    String(message || '')
  );
}

function dependsOnReferencedDiagram(message) {
  const text = String(message || '');
  return /\bwhich point\b[^?.]{0,80}\b(?:greatest|least|highest|lowest)\b|\b(?:diagram|figure|image|picture|graph|chart|data table|table)\b[^?.]{0,20}\b(?:above|below|shown|provided|attached|pictured|displayed)\b|\b(?:according to|based on|using|use|refer to|look at|from)\s+(?:the|this|that)?\s*(?:(?:circuit|wave|free[- ]body)\s+)?(?:diagram|figure|image|picture|graph|chart|data table|table)\b|\b(?:shown|labeled|pictured|displayed)\s+(?:in|on)\s+(?:the|this|that)?\s*(?:(?:circuit|wave|free[- ]body)\s+)?(?:diagram|figure|image|picture|graph|chart|data table|table)\b|\b(?:circuit|graph|chart|table)\s+(?:shown|above|below|provided|attached|displayed)\b/i.test(
    text
  );
}

function hasProvidedDiagram(options) {
  if (
    options.diagramProvided === true ||
    options.hasDiagram === true ||
    options.visualContext
  ) {
    return true;
  }

  if (!Array.isArray(options.attachments)) return false;
  return options.attachments.some((attachment) => {
    const type = String(
      attachment?.type || attachment?.mimeType || attachment?.kind || ''
    );
    return /image|diagram|figure|graph|chart/i.test(type);
  });
}

function inferBinaryCategories(targetConcept) {
  if (
    ['chemical_energy', 'sound_energy', 'thermal_energy', 'radiant_energy'].includes(
      targetConcept
    )
  ) {
    return ['kinetic', 'potential'];
  }
  if (
    [
      'physical_property',
      'physical_properties',
      'chemical_property',
      'tarnishing',
      'property',
      'property_classification',
      'change',
      'change_classification'
    ].includes(targetConcept)
  ) {
    return ['physical', 'chemical'];
  }
  if (
    ['mixture', 'mixture_classification'].includes(targetConcept)
  ) {
    return ['homogeneous', 'heterogeneous'];
  }
  if (['balanced_forces', 'unbalanced_forces'].includes(targetConcept)) {
    return ['balanced', 'unbalanced'];
  }
  if (targetConcept === 'electrical_material') {
    return ['conductor', 'insulator'];
  }
  return [];
}

function findUnitMentions(message) {
  const text = String(message || '');
  const candidates = [];

  for (const alias of UNIT_ALIASES) {
    const pattern = new RegExp(alias.source, 'gi');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      candidates.push({
        canonical: alias.canonical,
        index: match.index,
        end: pattern.lastIndex,
        raw: match[0]
      });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }

  candidates.sort((left, right) => {
    if (left.index !== right.index) return left.index - right.index;
    return (right.end - right.index) - (left.end - left.index);
  });

  const selected = [];
  for (const candidate of candidates) {
    if (
      selected.some(
        (existing) =>
          candidate.index < existing.end && candidate.end > existing.index
      )
    ) {
      continue;
    }
    selected.push(candidate);
  }
  return selected.sort((left, right) => left.index - right.index);
}

function findExplicitAnswerUnit(text, mentions) {
  const cuePattern =
    /\b(?:answer|express|report|give(?:\s+the\s+answer)?|write)\s+(?:it\s+)?(?:in|using)\b/gi;
  let match;
  let lastCueEnd = -1;
  while ((match = cuePattern.exec(text)) !== null) lastCueEnd = cuePattern.lastIndex;
  if (lastCueEnd < 0) return '';

  return (
    mentions.find(
      (mention) => mention.index >= lastCueEnd && mention.index - lastCueEnd < 30
    )?.canonical || ''
  );
}

function findConversionTargetUnit(text, mentions) {
  const targetCue = /\b(?:to|into)\b/gi;
  let match;
  let lastCueEnd = -1;
  while ((match = targetCue.exec(text)) !== null) lastCueEnd = targetCue.lastIndex;
  if (lastCueEnd < 0) return '';
  return (
    mentions.find(
      (mention) => mention.index >= lastCueEnd && mention.index - lastCueEnd < 35
    )?.canonical || ''
  );
}

function looksLikeUnitConversionRequest(message) {
  const text = String(message || '');
  const conversionUnitMentions = findUnitMentions(text).filter((mention) =>
    isSupportedConversionUnit(mention.canonical)
  );
  if (conversionUnitMentions.length < 2) return false;

  if (/\bconvert(?:ed|ing|s)?\b/i.test(text)) return true;
  if (/\bhow many\b[^?.]{0,50}\bin\b/i.test(text)) return true;

  const [startUnit, targetUnit] = conversionUnitMentions;
  const quantityBeforeStart = text.slice(0, startUnit.index);
  const connector = text.slice(startUnit.end, targetUnit.index);
  return /(?:\d(?:[\d,.]*\d)?|\.\d+)\s*$/i.test(quantityBeforeStart) &&
    /^\s*(?:to|into|in\s+to)\s*$/i.test(connector);
}

function isSupportedConversionUnit(unit) {
  return ['km', 'cm', 'mm', 'm', 'kg', 'g', 'mg', 'cg', 'kL', 'L', 'mL', 'ks', 's', 'year'].includes(unit);
}

function inferNumericalRole(text, start, end, unit) {
  if (['kg', 'g', 'mg', 'cg'].includes(unit)) return 'mass';
  if (['kL', 'L', 'mL'].includes(unit)) return 'volume';
  if (['m/s²', 'cm/s²'].includes(unit)) return 'acceleration';
  if (['m/s', 'cm/min', 'km/h', 'ft/s', 'mph'].includes(unit)) return 'speed';
  if (['ks', 'ms', 's', 'min', 'h', 'year'].includes(unit)) return 'time';
  if (unit === 'N') return 'force';
  if (unit === 'V') return 'voltage';
  if (unit === 'A') return 'current';
  if (unit === 'Ω') return 'resistance';
  if (unit === 'J') return 'energy';

  const nearby = normalizeForMatching(
    text.slice(Math.max(0, start - 35), Math.min(text.length, end + 35))
  );
  if (['km', 'cm', 'mm', 'm', 'ft', 'in', 'mi'].includes(unit)) {
    return /\bheight\b|\babove (?:the )?ground\b/.test(nearby)
      ? 'height'
      : 'distance';
  }

  const roleRules = [
    [/\bheight\b|\babove (?:the )?ground\b/, 'height'],
    [/\bmass\b|\bweighing\b/, 'mass'],
    [/\bacceleration\b/, 'acceleration'],
    [/\b(?:initial|final )?velocity\b|\bspeed\b/, 'speed'],
    [/\bdistance\b|\btravels?\b|\bfar\b/, 'distance'],
    [/\btime\b|\bseconds?\b|\bminutes?\b|\bhours?\b/, 'time'],
    [/\bforce\b/, 'force'],
    [/\bvoltage\b/, 'voltage'],
    [/\bcurrent\b/, 'current'],
    [/\bresistance\b/, 'resistance'],
    [/\benergy\b/, 'energy']
  ];
  for (const [pattern, role] of roleRules) {
    if (pattern.test(nearby)) return role;
  }

  return '';
}

function parseNumericValue(raw) {
  const normalized = String(raw || '').replace(/,/g, '').replace(/\s/g, '');
  if (normalized.includes('/')) {
    const [numerator, denominator] = normalized.split('/').map(Number);
    return denominator ? numerator / denominator : Number.NaN;
  }
  return Number(normalized);
}

function canonicalizeUnit(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const exact = UNIT_ALIASES.find(
    (alias) => alias.canonical.toLowerCase() === text.toLowerCase()
  );
  if (exact) return exact.canonical;
  return findUnitMentions(text)[0]?.canonical || '';
}

function isLengthUnit(unit) {
  return ['km', 'cm', 'mm', 'm', 'ft', 'in', 'mi'].includes(unit);
}

function isTimeUnit(unit) {
  return ['ms', 's', 'min', 'h', 'year'].includes(unit);
}

function speedUnitNumerator(unit) {
  if (unit === 'mph') return 'mi';
  return String(unit || '').split('/')[0] || '';
}

function speedUnitDenominator(unit) {
  if (unit === 'mph') return 'h';
  return String(unit || '').split('/')[1] || '';
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeForMatching(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\b(?:enegy|enery)\b/g, 'energy')
    .replace(/\btransformashun\b/g, 'transformation')
    .replace(/\s+/g, ' ')
    .trim();
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(value[key], seen);
  }
  return Object.freeze(value);
}

module.exports = {
  TASK_TYPES,
  buildQuestionContract,
  classifyTaskType,
  deepFreeze,
  dependsOnReferencedDiagram,
  extractNumericalGivens,
  extractSuppliedChoices,
  inferCandidateTopics,
  inferRequestedUnits,
  inferTargetConcept,
  looksLikeDrawDiagramRequest
};
