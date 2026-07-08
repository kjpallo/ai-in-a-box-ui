const UNIT = 'Unit 1';
const CHUNK = 'dimensional-analysis-conversions-notation';
const { buildUnit1ConversionsNotationPacket } = require('./unit1ConversionsNotationPacketAdapter');

const FACTS = [
  fact({
    id: 'unit1.conversions.dimensional_analysis',
    type: 'method_definition',
    canonicalTerm: 'dimensional analysis',
    aliases: ['unit conversion method'],
    typoAliases: ['dimentional analysis', 'dimensional analisis', 'demensional analysis'],
    definition: 'Dimensional analysis is a method for converting numbers into different units without changing their value.',
    use: 'Start with the given number and unit, multiply by conversion factors, cancel matching units, then multiply and divide.',
    sourceRefs: ['unit1.corpus.0033', 'unit1.corpus.0065'],
    related: ['conversion factor', 'picket fence method'],
    tutorCandidate: true,
    answerTemplate: 'Dimensional analysis is a method for converting numbers into different units without changing their value.'
  }),
  fact({
    id: 'unit1.conversions.conversion_factor',
    type: 'method_definition',
    canonicalTerm: 'conversion factor',
    aliases: ['conversion factors'],
    typoAliases: ['conversion facter', 'convertion factor'],
    definition: 'A conversion factor is a ratio of equivalent values used to change units.',
    use: 'The top and bottom represent equal amounts, so the ratio changes the unit but not the value.',
    examples: ['12 inches / 1 foot', '1000 mL / 1 L'],
    sourceRefs: ['unit1.corpus.0034', 'unit1.corpus.0065'],
    related: ['dimensional analysis'],
    tutorCandidate: true,
    answerTemplate: 'A conversion factor is a ratio of equivalent values used to change units.'
  }),
  fact({
    id: 'unit1.conversions.picket_fence',
    type: 'method_definition',
    canonicalTerm: 'picket fence method',
    aliases: ['picket fence'],
    typoAliases: ['picket fense'],
    definition: 'The picket fence method is a setup for dimensional analysis where conversion factors are arranged so units cancel.',
    use: 'Put the unit you want to cancel on the opposite side of the fraction.',
    sourceRefs: ['unit1.corpus.0035', 'unit1.corpus.0065'],
    related: ['conversion factor', 'unit cancellation'],
    tutorCandidate: true,
    answerTemplate: 'The picket fence method is a setup for dimensional analysis where conversion factors are arranged so units cancel.'
  }),
  fact({
    id: 'unit1.conversions.metric_prefix',
    type: 'vocabulary',
    canonicalTerm: 'metric prefix',
    aliases: ['metric prefixes'],
    typoAliases: ['metrick prefix'],
    definition: 'A metric prefix is a word part added to a base unit to show a power-of-ten amount.',
    use: 'Prefixes such as kilo, centi, and milli tell how many base units are represented.',
    examples: ['kilometer', 'centimeter', 'milligram'],
    sourceRefs: ['unit1.corpus.0062', 'unit1.corpus.0065'],
    related: ['SI system', 'metric stair-step'],
    tutorCandidate: true,
    answerTemplate: 'A metric prefix is a word part added to a base unit to show a power-of-ten amount.'
  }),
  fact({
    id: 'unit1.conversions.common_metric_prefixes',
    type: 'vocabulary',
    canonicalTerm: 'common metric prefixes',
    aliases: ['common prefixes', 'metric staircase'],
    typoAliases: [],
    definition: 'Common metric prefixes include mega, kilo, hecto, deka, deci, centi, milli, micro, and nano.',
    use: 'Use them with a base unit such as meter, gram, liter, or second.',
    sourceRefs: ['unit1.corpus.0062', 'unit1.corpus.0065'],
    related: ['metric prefix'],
    tutorCandidate: true,
    answerTemplate: 'Common metric prefixes include mega, kilo, hecto, deka, deci, centi, milli, micro, and nano.'
  }),
  prefixFact('kilo', 'kilo means 1,000 base units.', ['kilo means what']),
  prefixFact('centi', 'centi means one hundredth of a base unit.', ['centi means what']),
  prefixFact('milli', 'milli means one thousandth of a base unit.', ['mili means what', 'milli means what']),
  fact({
    id: 'unit1.conversions.scientific_notation',
    type: 'notation_definition',
    canonicalTerm: 'scientific notation',
    aliases: ['sci notation'],
    typoAliases: ['scintific notation', 'scientific notaton'],
    definition: 'Scientific notation writes very large or very small numbers as a number from 1 to less than 10 times a power of 10.',
    use: 'It makes very large or very small numbers easier to write, read, and calculate with.',
    sourceRefs: ['unit1.corpus.0039', 'unit1.corpus.0068'],
    related: ['standard notation', 'power of 10'],
    tutorCandidate: true,
    answerTemplate: 'Scientific notation writes very large or very small numbers as a number from 1 to less than 10 times a power of 10.'
  }),
  fact({
    id: 'unit1.conversions.standard_notation',
    type: 'notation_definition',
    canonicalTerm: 'standard notation',
    aliases: ['standard form', 'ordinary decimal form'],
    typoAliases: ['standard notaton'],
    definition: 'Standard notation is the ordinary decimal form of a number.',
    use: 'Convert from scientific notation by moving the decimal right for a positive exponent and left for a negative exponent.',
    sourceRefs: ['unit1.corpus.0042', 'unit1.corpus.0162', 'unit1.corpus.0163'],
    related: ['scientific notation'],
    tutorCandidate: true,
    answerTemplate: 'Standard notation is the ordinary decimal form of a number.'
  }),
  fact({
    id: 'unit1.conversions.temperature_formulas',
    type: 'formula_lookup',
    canonicalTerm: 'temperature conversion formulas',
    aliases: ['kelvin formula', 'celsius formula', 'fahrenheit formula'],
    typoAliases: ['celcius formula', 'farenheit formula', 'farenhiet formula'],
    definition: 'Temperature conversion formulas change a temperature from one unit to another.',
    use: 'Use K = °C + 273, °C = 5/9(°F - 32), and °F = (°C × 9/5) + 32.',
    sourceRefs: ['unit1.corpus.0036', 'unit1.corpus.0037', 'unit1.corpus.0038'],
    related: ['Kelvin', 'Celsius', 'Fahrenheit'],
    tutorCandidate: true,
    answerTemplate: 'Temperature conversion formulas: K = °C + 273; °C = 5/9(°F - 32); °F = (°C × 9/5) + 32.'
  }),
  fact({
    id: 'unit1.conversions.common_conversion_factors',
    type: 'method_definition',
    canonicalTerm: 'common conversion factors',
    aliases: ['conversion factors list'],
    typoAliases: [],
    definition: 'Common conversion factors are equivalent ratios used to change units.',
    use: 'Examples include 24 hours = 1 day, 12 inches = 1 foot, 1 inch = 2.54 cm, 1000 mL = 1 L, and 1000 g = 1 kg.',
    sourceRefs: ['unit1.corpus.0065', 'unit1.corpus.0166', 'unit1.corpus.0167'],
    related: ['conversion factor', 'dimensional analysis'],
    tutorCandidate: true,
    answerTemplate: 'Common conversion factors include 24 hours = 1 day, 12 inches = 1 foot, 1 inch = 2.54 cm, 1000 mL = 1 L, and 1000 g = 1 kg.'
  })
];

const UNIT1_CONVERSIONS_NOTATION_PACKET = buildUnit1ConversionsNotationPacket({
  facts: FACTS,
  matcherName: 'tryUnit1ConversionsNotationKnowledge'
});

function tryUnit1ConversionsNotationKnowledge(message) {
  const text = normalize(message);
  if (!text) return null;
  if (looksLikeCalculationPrompt(text) || looksLikeOtherUnitPrompt(text)) return null;

  const fact = findMatchingFact(text);
  if (!fact) return null;

  return {
    type: 'definition',
    confidence: 'strong',
    toolsUsed: ['unit1_conversions_notation_knowledge'],
    notes: `Answered Unit 1 conversions/notation fact: ${fact.id}.`,
    directAnswer: answerFor(text, fact),
    aiAllowed: false,
    knowledgeRefs: fact.sourceRefs
  };
}

function findMatchingFact(text) {
  if (/\bwhy\b/.test(text) && /\bconversion factor\b/.test(text) && /\bequal|equals|1|one\b/.test(text)) {
    return responseFact('unit1.conversions.factor_equals_one', 'A conversion factor equals 1 because the top and bottom represent equal amounts, so it changes the unit but not the value.', ['unit1.corpus.0034', 'unit1.corpus.0065']);
  }
  if (/\bhow\b/.test(text) && /\buse\b/.test(text) && /\bdimensional analysis\b/.test(text)) {
    return responseFact('unit1.conversions.how_to_use_da', 'Start with the given number and unit, multiply by conversion factors, cancel matching units, then multiply and divide.', ['unit1.corpus.0033', 'unit1.corpus.0035', 'unit1.corpus.0065']);
  }
  if (/\bwhy\b/.test(text) && /\bunits?\b/.test(text) && /\bcancel\b/.test(text)) {
    return responseFact('unit1.conversions.units_cancel', 'Matching units on opposite sides of the fraction cancel, leaving the desired unit.', ['unit1.corpus.0035', 'unit1.corpus.0065']);
  }
  if (/\bwhy\b/.test(text) && /\bscientists?\b/.test(text) && /\bscientific notation\b/.test(text)) {
    return responseFact('unit1.conversions.why_scientific_notation', 'Scientists use scientific notation because it makes very large or very small numbers easier to write, read, and calculate with.', ['unit1.corpus.0039', 'unit1.corpus.0068']);
  }
  if (/\blarge number\b/.test(text) && /\bscientific notation\b/.test(text)) {
    return responseFact('unit1.conversions.large_to_scientific', 'For a large number, move the decimal until one digit is to the left, then use a positive power of 10 for the number of places moved.', ['unit1.corpus.0039', 'unit1.corpus.0068']);
  }
  if (/\bsmall decimal\b/.test(text) && /\bscientific notation\b/.test(text)) {
    return responseFact('unit1.conversions.small_to_scientific', 'For a small decimal, move the decimal until one nonzero digit is to the left, then use a negative power of 10 for the number of places moved.', ['unit1.corpus.0039', 'unit1.corpus.0068']);
  }
  if (/\bconvert\b/.test(text) && /\bscientific notation\b/.test(text) && /\bstandard notation\b/.test(text)) {
    return responseFact('unit1.conversions.scientific_to_standard', 'To convert scientific notation to standard notation, move the decimal right for a positive exponent and left for a negative exponent.', ['unit1.corpus.0042', 'unit1.corpus.0162', 'unit1.corpus.0163']);
  }
  if (/\bcommon\b/.test(text) && /\bmetric prefixes\b/.test(text)) return factById('unit1.conversions.common_metric_prefixes');
  if (/\bcommon\b/.test(text) && /\bconversion factors\b/.test(text)) return factById('unit1.conversions.common_conversion_factors');
  if (/\b(kelvin|celsius|celcius|fahrenheit|farenheit|farenhiet)\b/.test(text) && /\bformula\b/.test(text)) return factById('unit1.conversions.temperature_formulas');

  for (const fact of FACTS) {
    if (matchesFact(text, fact)) return fact;
  }
  return null;
}

function answerFor(text, fact) {
  if (fact.id === 'unit1.conversions.temperature_formulas') {
    if (/\b(?:fahrenheit|farenheit|farenhiet)\b.+\bfrom\b.+\b(?:celsius|celcius)\b/.test(text)) return 'The Fahrenheit from Celsius formula is °F = (°C × 9/5) + 32.';
    if (/\b(?:celsius|celcius)\b.+\bfrom\b.+\b(?:fahrenheit|farenheit|farenhiet)\b/.test(text)) return 'The Celsius from Fahrenheit formula is °C = 5/9(°F - 32).';
    if (/\bkelvin\b/.test(text) && /\b(?:celsius|celcius)\b/.test(text)) return 'The Kelvin from Celsius formula is K = °C + 273.';
    if (/\b(?:celsius|celcius)\b/.test(text) && /\b(?:fahrenheit|farenheit|farenhiet)\b/.test(text)) return 'The Celsius from Fahrenheit formula is °C = 5/9(°F - 32).';
    if (/\b(?:fahrenheit|farenheit|farenhiet)\b/.test(text) && /\b(?:celsius|celcius)\b/.test(text)) return 'The Fahrenheit from Celsius formula is °F = (°C × 9/5) + 32.';
  }
  return fact.answerTemplate;
}

function matchesFact(text, fact) {
  const terms = [fact.canonicalTerm, ...(fact.aliases || []), ...(fact.typoAliases || [])]
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!terms.some((term) => hasTerm(text, term))) return false;
  return /\b(what|why|how|does|mean|means|is|are|formula|method|prefix|notation|factor)\b/.test(text);
}

function fact(input) {
  return {
    unit: UNIT,
    chunk: CHUNK,
    examples: [],
    nonExamples: [],
    commonMisconceptions: [],
    route: 'direct_answer',
    ...input
  };
}

function prefixFact(term, answerTemplate, typoAliases = []) {
  return fact({
    id: `unit1.conversions.prefix.${term}`,
    type: 'vocabulary',
    canonicalTerm: term,
    aliases: [`${term} prefix`],
    typoAliases,
    definition: answerTemplate,
    use: 'Metric prefixes tell how the unit compares with the base unit.',
    sourceRefs: ['unit1.corpus.0062', 'unit1.corpus.0065'],
    related: ['metric prefix'],
    tutorCandidate: true,
    answerTemplate
  });
}

function responseFact(id, answerTemplate, sourceRefs) {
  return fact({
    id,
    type: 'method_definition',
    canonicalTerm: id,
    aliases: [],
    typoAliases: [],
    definition: answerTemplate,
    use: answerTemplate,
    sourceRefs,
    related: [],
    tutorCandidate: false,
    answerTemplate
  });
}

function factById(id) {
  return FACTS.find((fact) => fact.id === id);
}

function looksLikeCalculationPrompt(text) {
  if (/\d/.test(text) && /\b(convert|write|scientific notation|standard notation|to|into|seconds|year|km|ks|mg|cg|mm|cm|feet|kelvin|celsius|fahrenheit|farenheit|farenhiet)\b/.test(text)) return true;
  return /^([0-9.,]+)\s*[a-zµ]+\s+to\s+[a-zµ]+$/.test(text);
}

function looksLikeOtherUnitPrompt(text) {
  return /\b(density|speed|velocity|current|voltage|resistance|wave|waves|conservation of mass|matter|endothermic|exothermic|circuit|pass stand|beaker|goggles|accuracy|precision|si system|meniscus|tool measures)\b/.test(text);
}

function hasTerm(text, term) {
  if (!term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[-‐‑‒–—]/g, ' ')
    .replace(/\bdimentional\b/g, 'dimensional')
    .replace(/\bdemensional\b/g, 'dimensional')
    .replace(/\banalisis\b/g, 'analysis')
    .replace(/\bfacter\b/g, 'factor')
    .replace(/\bconvertion\b/g, 'conversion')
    .replace(/\bfense\b/g, 'fence')
    .replace(/\bmetrick\b/g, 'metric')
    .replace(/\bmili\b/g, 'milli')
    .replace(/\bscintific\b/g, 'scientific')
    .replace(/\bnotaton\b/g, 'notation')
    .replace(/\bcelcius\b/g, 'celsius')
    .replace(/\bfarenheit\b/g, 'fahrenheit')
    .replace(/\bfarenhiet\b/g, 'fahrenheit')
    .replace(/[^a-z0-9µ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  ALL_UNIT1_CONVERSIONS_NOTATION_FACTS: FACTS,
  UNIT1_CONVERSIONS_NOTATION_PACKET,
  tryUnit1ConversionsNotationKnowledge
};
