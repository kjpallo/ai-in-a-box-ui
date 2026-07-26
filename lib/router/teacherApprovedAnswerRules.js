const { normalize } = require('./classifyQuestion');

const SOURCE = 'Teacher-approved Phase 1 classroom expectations';
const TOOL = 'teacher_approved_answer_rules';

function tryTeacherApprovedAnswer(message, questionContract = null) {
  const text = normalize(message);
  if (!text) return null;

  const conductorChoice = resolveSingleConductorChoice(questionContract, text);
  if (conductorChoice) {
    return approvedAnswer({
      id: 'multiple_choice_conductor_material',
      type: 'multiple_choice',
      topics: ['circuits'],
      concepts: ['conductor'],
      answer: conductorChoice.negated
        ? `${conductorChoice.label}. ${conductorChoice.text} is not a conductor; it is an insulator.`
        : `${conductorChoice.label}. ${conductorChoice.text} is the conductor. Metals such as copper allow electric charge to move through them easily.`
    });
  }

  if (asksForCentimetersPerMinuteSpeedUnit(text)) {
    return approvedAnswer({
      id: 'speed_unit_centimeters_per_minute',
      type: 'units_only',
      topics: ['motion', 'measurement'],
      concepts: ['speed'],
      answer: 'The speed unit is centimeters per minute, written cm/min.'
    });
  }

  if (describesEqualNotOppositeForces(text)) {
    return approvedAnswer({
      id: 'unbalanced_forces_equal_not_opposite',
      type: 'cloze_completion',
      topics: ['forces'],
      concepts: ['unbalanced_forces'],
      answer: 'The answer is unbalanced forces. Equal forces do not cancel unless they act in opposite directions, so these forces leave a nonzero net force.'
    });
  }

  if (describesUnequalOppositeForces(text)) {
    return approvedAnswer({
      id: 'unbalanced_forces_unequal_opposite',
      type: 'cloze_completion',
      topics: ['forces'],
      concepts: ['unbalanced_forces'],
      answer: 'The answer is unbalanced forces. Unequal forces in opposite directions do not cancel, so the net force is not 0 N.'
    });
  }

  if (describesEqualOppositeForces(text)) {
    return approvedAnswer({
      id: 'balanced_forces_equal_opposite',
      type: 'cloze_completion',
      topics: ['forces'],
      concepts: ['balanced_forces'],
      answer: 'The answer is balanced forces. Equal forces in opposite directions cancel, so the net force is 0 N.'
    });
  }

  if (describesOverallForces(text)) {
    return approvedAnswer({
      id: 'net_force_overall_forces',
      type: 'cloze_completion',
      topics: ['forces'],
      concepts: ['net_force'],
      answer: 'The answer is net force. Net force is the overall force after all forces acting on an object are combined.'
    });
  }

  if (describesForcePushPull(text)) {
    return approvedAnswer({
      id: 'force_push_pull_motion_change',
      type: 'cloze_completion',
      topics: ['forces'],
      concepts: ['force'],
      answer: 'The answer is force. A force is a push or pull that can make an object start, stop, or change direction.'
    });
  }

  if (asksLampOnTableLaw(text)) {
    return approvedAnswer({
      id: 'lamp_table_newtons_first_law',
      type: 'law_identification',
      topics: ['forces', 'newtons_laws'],
      concepts: ['newtons_first_law', 'balanced_forces'],
      answer: 'This demonstrates Newton’s First Law. The object remains at rest because the upward support force and downward force of gravity are balanced, so the net force is 0 N.'
    });
  }

  if (asksWhyMoonGravityIsWeaker(text)) {
    return approvedAnswer({
      id: 'moon_gravity_lower_mass',
      type: 'science_concept',
      topics: ['gravity'],
      concepts: ['moon_gravity'],
      answer: 'Gravity on the Moon is about one-sixth of Earth’s because the Moon is much less massive than Earth, so its gravitational pull is weaker.'
    });
  }

  if (
    (!questionContract || questionContract.targetConcept === 'voltage_difference') &&
    !['calculation', 'definition'].includes(questionContract?.taskType) &&
    questionContract?.requiredAnswerForm !== 'formula' &&
    describesVoltagePush(text)
  ) {
    return approvedAnswer({
      id: 'voltage_pushes_charge_through_circuit',
      type: questionContract?.taskType === 'definition'
        ? 'definition'
        : 'science_concept',
      topics: ['circuits'],
      concepts: ['voltage_difference'],
      answer: 'Voltage difference is the push that causes electric charges to flow in a circuit. It is also called electric potential difference and provides energy per charge. Voltage is measured in volts, not newtons, because it is not a mechanical force.'
    });
  }

  if (describesWaveThroughMaterial(text)) {
    return approvedAnswer({
      id: 'wave_energy_not_matter',
      type: 'cloze_completion',
      topics: ['waves'],
      concepts: ['wave'],
      answer: 'The missing word is wave. A wave is a vibration or disturbance that carries energy through a material without carrying the matter along with it.'
    });
  }

  if (describesElectricCurrentFlow(text)) {
    return approvedAnswer({
      id: 'electric_current_flow_through_conductor',
      type: 'cloze_completion',
      topics: ['circuits'],
      concepts: ['electric_current'],
      answer: 'The missing term is electric current, or current. Electric current is the flow of electric charge through a conductor.'
    });
  }

  if (asksWhatSlowsElectricFlow(text)) {
    return approvedAnswer({
      id: 'resistance_slows_current',
      type: 'cloze_completion',
      topics: ['circuits'],
      concepts: ['resistance'],
      answer: 'The answer is resistance. Resistance opposes or slows the flow of electric current in a circuit.'
    });
  }

  const energyClassification = classifyClassroomEnergy(text);
  if (energyClassification) {
    return approvedAnswer({
      id: `${energyClassification.kind}_energy_classification`,
      type: 'science_concept',
      topics: ['energy'],
      concepts: [`${energyClassification.kind}_energy`, energyClassification.classification],
      answer: `${titleCase(energyClassification.kind)} energy is classified as ${energyClassification.classification} energy in this classroom curriculum.`
    });
  }

  if (describesElectricField(text)) {
    return approvedAnswer({
      id: 'electric_field_force_moves_charges',
      type: 'cloze_completion',
      topics: ['circuits'],
      concepts: ['electric_field'],
      answer: 'The answer is electric field. An electric field exerts a force that can cause other electric charges to move.'
    });
  }

  if (asksSilverTarnishingProperty(text)) {
    return approvedAnswer({
      id: 'silver_tarnishing_chemical_property',
      type: 'cloze_completion',
      topics: ['matter', 'chemistry'],
      concepts: ['tarnishing', 'chemical_property'],
      answer: 'The missing answer is tarnishing, or the ability to tarnish. That is a chemical property because silver forms new substances when it reacts with materials in air.'
    });
  }

  if (asksMalleabilityDuctilityProperty(text)) {
    return approvedAnswer({
      id: 'malleability_ductility_physical_properties',
      type: 'cloze_completion',
      topics: ['matter'],
      concepts: ['physical_properties'],
      answer: 'The missing word is physical. Malleability and ductility are physical properties.'
    });
  }

  return null;
}

function approvedAnswer({ id, type, topics, concepts, answer }) {
  return {
    type,
    confidence: 'strong',
    toolsUsed: [TOOL],
    notes: `Answered teacher-approved Phase 1 expectation: ${id}.`,
    directAnswer: answer,
    aiAllowed: false,
    answerTopics: topics,
    answerConcepts: concepts,
    evidence: {
      quality: 'high',
      trust: 'teacher_approved',
      source: SOURCE,
      ruleId: id,
      topics,
      concepts
    }
  };
}

function asksForCentimetersPerMinuteSpeedUnit(text) {
  return /\b(?:unit|units)\b/.test(text) &&
    /\bspeed\b/.test(text) &&
    /\bcentimeters?\b|\bcm\b/.test(text) &&
    /\bminutes?\b|\bmin\b/.test(text);
}

function describesEqualOppositeForces(text) {
  const explicitlyEqualAndOpposite = /\b(?:forces?|push(?:es)?|pull(?:s)?)\b/.test(text) &&
    (
      /\bequal(?:ly)?\b/.test(text) ||
      /\bsame\s+(?:size|magnitude|strength)\b/.test(text)
    ) &&
    (
      /\bopposite\b/.test(text) ||
      hasOpposingDirectionWords(text)
    ) &&
    !/\b(?:unequal|not equal|different|not opposite)\b/.test(text);
  const allForcesCancel =
    /\b(?:every|all)\b[\s\S]{0,35}\bforces?\b/.test(text) &&
    /\bcancel(?:s|ed|ing)?\b/.test(text);
  return explicitlyEqualAndOpposite || allForcesCancel;
}

function describesEqualNotOppositeForces(text) {
  return /\b(?:forces?|push(?:es)?|pull(?:s)?)\b/.test(text) &&
    /\b(?:equal(?:ly)?|same)\b/.test(text) &&
    /\b(?:size|magnitude|strength|strong)\b/.test(text) &&
    /\b(?:not opposite|same direction|point(?:s|ing)? (?:in )?the same (?:way|direction))\b/.test(text);
}

function describesUnequalOppositeForces(text) {
  const numericForces = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*n\b/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const unequalNumericForces =
    numericForces.length >= 2 &&
    new Set(numericForces).size > 1;
  if (
    numericForces.length >= 2 &&
    !/\b(?:balanced|unbalanced)\b/.test(text)
  ) {
    return false;
  }
  if (
    numericForces.length >= 2 &&
    /\b(?:net force|acceleration)\b|\b(?:find|calculate|compute|determine)\b/.test(text)
  ) {
    return false;
  }
  return /\b(?:forces?|push(?:es)?|pull(?:s)?)\b/.test(text) &&
    (
      (
        /\b(?:unequal|not equal|different)\b/.test(text) &&
        /\b(?:size|magnitude|strength|strong)\b/.test(text)
      ) ||
      unequalNumericForces
    ) &&
    (
      /\bopposite\b/.test(text) ||
      hasOpposingDirectionWords(text)
    );
}

function hasOpposingDirectionWords(text) {
  return (
    /\bleft\b/.test(text) && /\bright\b/.test(text) ||
    /\beast\b/.test(text) && /\bwest\b/.test(text) ||
    /\bup(?:ward)?\b/.test(text) && /\bdown(?:ward)?\b/.test(text)
  );
}

function describesOverallForces(text) {
  return /\b(?:overall|combined|total|vector sum)\b/.test(text) &&
    /\bforces?\b/.test(text) &&
    (
      /\b(?:acting|act)\b/.test(text) &&
      /\bobject\b/.test(text) ||
      /\b(?:every|all)\b/.test(text)
    );
}

function describesForcePushPull(text) {
  return /\bpush\s+or\s+pull\b/.test(text) &&
    /\bobject\b/.test(text) &&
    /\b(?:stop|move|change direction)\b/.test(text);
}

function asksLampOnTableLaw(text) {
  const stationary =
    /\b(?:sits?|sitting|rests?|resting|remains? still|stays? (?:still|motionless)|motionless|at rest)\b/.test(text);
  const equilibriumContext =
    /\b(?:table|desk|shelf|countertop|counter|level surface|surface)\b/.test(text) ||
    /\bhang(?:s|ing)?\b/.test(text) ||
    /\bnet force\b[\s\S]{0,20}\b(?:zero|0)\b|\b(?:zero|0)\b[\s\S]{0,20}\bnet force\b/.test(text) ||
    (/\bgravity\b/.test(text) && /\b(?:support|normal)\s+force\b/.test(text));
  return stationary &&
    equilibriumContext &&
    (
      /\blaw\b/.test(text) ||
      /\b(?:why|how|explain|related|relationship)\b/.test(text)
    );
}

function asksWhyMoonGravityIsWeaker(text) {
  return /\b(?:moon|lunar)\b/.test(text) &&
    (
      /\bgravit/.test(text) ||
      /\bweigh(?:s|t|ing)?\b|\bweight\b/.test(text) ||
      /\bjump(?:s|ed|ing)?\s+higher\b/.test(text) ||
      /\b(?:fall|falls|falling|drop|drops|dropping)\b/.test(text)
    ) &&
    (
      /\b(?:why|how|compare|explain|weaker|less|smaller|one\s+sixth|1\s*\/\s*6|1\/6th)\b/.test(text) ||
      /\bearth\b/.test(text)
    );
}

function describesVoltagePush(text) {
  if (/\belectric(?:al)? fields?\b/.test(text)) return false;
  if (/\bsolve for\b/.test(text)) return false;
  if (
    /\bvoltage\b/.test(text) &&
    /\bcurrent\b/.test(text) &&
    (
      /\bresistance\b/.test(text) ||
      /\bpower\b/.test(text)
    ) &&
    !/\b(?:related|relationship|relate)\b/.test(text)
  ) {
    return false;
  }
  const electricalGivens =
    [...text.matchAll(/\b\d+(?:\.\d+)?\s*(?:a|v|ohms?|Ω)\b/g)].length;
  if (
    electricalGivens >= 2 &&
    /\b(?:what is|find|calculate|compute|determine)\b[\s\S]{0,35}\b(?:voltage|current|resistance)\b/.test(text)
  ) {
    return false;
  }
  if (
    /\bvoltage\b/.test(text) &&
    /\bcurrent\b/.test(text) &&
    /\bresistance\b/.test(text) &&
    /\b(?:related|relationship|relate)\b/.test(text)
  ) {
    return false;
  }
  if (
    /\b\d+(?:\.\d+)?\s*a\b/.test(text) &&
    /\b\d+(?:\.\d+)?\s*(?:ohms?|Ω)\b/.test(text)
  ) {
    return false;
  }
  return (
    /\bvoltage\b/.test(text) &&
    (
      /\b(?:what is|define|explain)\s+(?:the\s+)?voltage\b/.test(text) ||
      /\b(?:force|newtons?)\b/.test(text)
    )
  ) || (
    /\b(?:electrical|electric|battery|force-like)\b[\s\S]{0,35}\bpush\b/.test(text) &&
    /\b(?:charges?|current|circuit)\b/.test(text)
  ) || /\bwhat push(?:es)?\b[\s\S]{0,35}\b(?:electric )?charges?\b[\s\S]{0,35}\bcircuit\b/.test(text);
}

function describesWaveThroughMaterial(text) {
  const canonicalClue = /\bvibrat/.test(text) &&
    /\bmaterial\b/.test(text) &&
    /\benergy\b/.test(text) &&
    (
      /\bnot\s+matter\b/.test(text) ||
      /\bwithout\s+(?:moving|carrying)\s+matter\b/.test(text)
    );
  const explicitWaveQuestion =
    /\b(?:sound\s+)?waves?\b/.test(text) &&
    /\b(?:carry|carries|carrying|transfer|transfers|transmit|transmits)\b/.test(text) &&
    /\benergy\b/.test(text) &&
    /\b(?:matter|material|medium)\b/.test(text);
  return canonicalClue || explicitWaveQuestion;
}

function describesElectricCurrentFlow(text) {
  if (/\b(?:slow|slows|slowing|resist|resists|opposes)\b/.test(text)) {
    return false;
  }
  const movingCharge =
    /\b(?:movement|flow|rate)\b[\s\S]{0,45}\b(?:electricity|electric\s+charge|charge|electrons?)\b/.test(text) ||
    /\b(?:electricity|electric\s+charge|charge|electrons?)\b[\s\S]{0,45}\b(?:moves?|moving|flows?|movement|flow)\b/.test(text);
  return movingCharge &&
    /\b(?:conductor|wire|conducting material|metal|circuit)\b/.test(text);
}

function asksWhatSlowsElectricFlow(text) {
  return /\b(?:slow|slows|slowing|resist|resists|opposes)\b/.test(text) &&
    /\bflow\b/.test(text) &&
    /\b(?:electricity|electric\s+current|current)\b/.test(text) &&
    /\bcircuit\b/.test(text);
}

function classifyClassroomEnergy(text) {
  if (!/\b(?:kinetic|potential)\b/.test(text)) return null;
  if (!/\b(?:or|versus|vs)\b/.test(text)) return null;

  const classroomClassifications = {
    chemical: 'potential',
    sound: 'kinetic',
    thermal: 'kinetic',
    radiant: 'kinetic'
  };

  for (const [kind, classification] of Object.entries(classroomClassifications)) {
    if (new RegExp(`\\b${kind}\\s+energy\\b`).test(text)) {
      return { kind, classification };
    }
  }

  return null;
}

function describesElectricField(text) {
  if (
    /\bdifference between\b/.test(text) &&
    /\bvoltage\b/.test(text)
  ) {
    return false;
  }
  if (
    /\b(?:compare|comparison|difference between)\b/.test(text) &&
    /\bgravity\b/.test(text)
  ) {
    return false;
  }
  return (
    /\bexerts?\s+(?:a\s+)?force\b/.test(text) &&
    /\bother\s+electric\s+charges?\b/.test(text) &&
    /\bmove\b/.test(text)
  ) || (
    /\belectric(?:al)? fields?\b/.test(text) &&
    /\b(?:force|push|pull|test charge)\b/.test(text)
  ) || (
    /\b(?:what|which)(?:\s+(?:electric|electrical))?\s+field\b[\s\S]{0,45}\bcharge\b/.test(text) &&
    /\b(?:force|push|pull)\b/.test(text)
  );
}

function asksSilverTarnishingProperty(text) {
  return /\bsilver\b/.test(text) &&
    /\btarnish/.test(text) &&
    /\bchemical\s+propert/.test(text);
}

function asksMalleabilityDuctilityProperty(text) {
  return /\bmalleability\b/.test(text) &&
    /\bductility\b/.test(text) &&
    /\bpropert/.test(text);
}

function resolveSingleConductorChoice(questionContract, normalizedQuestion = '') {
  if (
    questionContract?.taskType !== 'multiple_choice' ||
    questionContract?.targetConcept !== 'conductor' ||
    !Array.isArray(questionContract.suppliedChoices)
  ) {
    return null;
  }

  const knownConductors = /\b(?:copper|aluminum|aluminium|silver|gold|iron|steel|metal)\b/i;
  const knownInsulators = /\b(?:rubber|plastic|glass|wood|ceramic|air)\b/i;
  const negated = /\b(?:not|except|least likely)\b/.test(normalizedQuestion);
  const choicePattern = negated ? knownInsulators : knownConductors;
  const matches = questionContract.suppliedChoices.filter((choice) =>
    choicePattern.test(String(choice?.text || ''))
  );
  if (matches.length !== 1) return null;

  return {
    label: String(matches[0].label || '').trim(),
    text: String(matches[0].text || '').trim(),
    negated
  };
}

function titleCase(value) {
  const text = String(value || '');
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : '';
}

module.exports = {
  SOURCE,
  TOOL,
  tryTeacherApprovedAnswer
};
