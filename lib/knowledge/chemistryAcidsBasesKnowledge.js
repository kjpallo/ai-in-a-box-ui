function tryAcidsBasesKnowledge(message) {
  const text = normalize(message);
  if (!text || looksLikePhCalculation(text)) return null;

  const answer = answerAcidsBasesConcept(text);
  if (!answer) return null;

  return {
    type: answer.type || 'science_concept',
    confidence: 'strong',
    toolsUsed: ['acids_bases_knowledge'],
    notes: `Answered local acids/bases knowledge question: ${answer.id}.`,
    directAnswer: answer.answer,
    aiAllowed: false
  };
}

function answerAcidsBasesConcept(text) {
  if (asksAcidDefinition(text)) {
    return definition('acid_definition', 'An acid is a substance with a pH below 7. Acids often taste sour in classroom examples and turn blue litmus paper red.');
  }

  if (asksBaseDefinition(text)) {
    return definition('base_definition', 'A base is a substance with a pH above 7. Bases are also called basic substances and often feel slippery in classroom examples.');
  }

  if (asksPhDefinition(text)) {
    return definition('ph_definition', 'pH measures how acidic or basic a substance is. A pH below 7 is acidic, pH 7 is neutral, and pH above 7 is basic.');
  }

  if (asksNeutralSubstance(text)) {
    return definition('neutral_substance', 'A neutral substance has a pH of 7. Pure water and distilled water are common neutral examples.');
  }

  if (asksAcidsBasesDifference(text)) {
    return concept('acids_bases_difference', 'Acids and bases are different because acids have pH below 7, while bases have pH above 7. A neutral substance has pH 7.');
  }

  if (asksAcidsBasesExamples(text)) {
    return concept('acids_bases_examples', 'Examples of acids include vinegar, lemon juice, and stomach acid. Examples of bases include soap, baking soda, bleach, and ammonia.');
  }

  if (asksAceticAcid(text)) {
    return definition('acetic_acid', 'Acetic acid is the acid found in vinegar. Do not confuse “acetic acid” with the classification word “acidic.”');
  }

  if (asksAceticAcidVsAcidic(text)) {
    return concept('acetic_acid_vs_acidic', 'No. Acetic acid is a specific acid found in vinegar. Acidic is the classification word for substances with pH below 7.');
  }

  if (asksWhyVinegarAcidic(text)) {
    return concept('vinegar_acidic_reason', 'Vinegar is acidic because it contains acetic acid and has a pH below 7.');
  }

  if (asksWhySoapBasic(text)) {
    return concept('soap_basic_reason', 'Soap is basic because it has a pH above 7.');
  }

  if (asksWhyWaterNeutral(text)) {
    return concept('water_neutral_reason', 'Pure water is neutral because its pH is 7.');
  }

  if (asksHowTellAcidicBasic(text)) {
    return concept('acidic_basic_identification', 'You can tell whether something is acidic or basic by its pH: below 7 is acidic, 7 is neutral, and above 7 is basic.');
  }

  if (asksAcidBaseReaction(text)) {
    return concept('acid_base_reaction', 'When an acid and a base react, they can neutralize each other. In a basic classroom model, neutralization forms water and a salt.');
  }

  if (asksNeutralization(text)) {
    return definition('neutralization', 'Neutralization is a reaction between an acid and a base that makes the solution closer to neutral, often forming water and a salt.');
  }

  return null;
}

function asksAcidDefinition(text) {
  return hasDefinitionIntent(text) && /\bacid\b/.test(text) && !/\bacetic\s+acid\b/.test(text) && !/\bbase\b/.test(text);
}

function asksBaseDefinition(text) {
  return hasDefinitionIntent(text) && /\bbase\b/.test(text) && !/\bacid\b/.test(text);
}

function asksPhDefinition(text) {
  return (hasDefinitionIntent(text) || /\bwhat\s+does\b/.test(text)) &&
    /\bph\b/.test(text) &&
    /\b(?:measure|measures|mean|means|scale)?\b/.test(text);
}

function asksNeutralSubstance(text) {
  return hasDefinitionIntent(text) &&
    /\bneutral\s+substance\b/.test(text);
}

function asksAcidsBasesDifference(text) {
  return /\b(?:explain|how)\b/.test(text) &&
    /\bacids?\b/.test(text) &&
    /\bbases?\b/.test(text) &&
    /\b(?:different|difference)\b/.test(text);
}

function asksAcidsBasesExamples(text) {
  return /\b(?:give|list|show)\s+examples?\s+of\s+acids?\s+and\s+bases?\b/.test(text);
}

function asksAceticAcid(text) {
  return hasDefinitionIntent(text) && /\bacetic\s+acid\b/.test(text);
}

function asksAceticAcidVsAcidic(text) {
  return /\bacetic\s+acid\b/.test(text) &&
    /\bacidic\b/.test(text) &&
    /\bsame\b/.test(text);
}

function asksWhyVinegarAcidic(text) {
  return /\bwhy\b/.test(text) && /\bvinegar\b/.test(text) && /\bacidic\b/.test(text);
}

function asksWhySoapBasic(text) {
  return /\bwhy\b/.test(text) && /\bsoap\b/.test(text) && /\bbasic\b/.test(text);
}

function asksWhyWaterNeutral(text) {
  return /\bwhy\b/.test(text) && /\b(?:pure|distilled)?\s*water\b/.test(text) && /\bneutral\b/.test(text);
}

function asksHowTellAcidicBasic(text) {
  return /\bhow\s+can\s+you\s+tell\b/.test(text) &&
    /\bacidic\b/.test(text) &&
    /\bbasic\b/.test(text);
}

function asksAcidBaseReaction(text) {
  return /\bwhat\s+happens\b/.test(text) &&
    /\bacid\b/.test(text) &&
    /\bbase\b/.test(text) &&
    /\breact\b/.test(text);
}

function asksNeutralization(text) {
  return hasDefinitionIntent(text) && /\bneutralization\b/.test(text);
}

function looksLikePhCalculation(text) {
  return /\bph\b/.test(text) &&
    /\b(?:hydrogen\s+ion|h\+|concentration|given|calculate|find|solve|determine)\b/.test(text);
}

function hasDefinitionIntent(text) {
  return /\b(?:what\s+is|whats|define|definition\s+of|explain|describe|meaning|means?)\b/.test(text);
}

function concept(id, answer) {
  return { id, answer, type: 'science_concept' };
}

function definition(id, answer) {
  return { id, answer, type: 'definition' };
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+°\/\s.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { tryAcidsBasesKnowledge };
