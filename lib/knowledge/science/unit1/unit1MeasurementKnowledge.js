const UNIT = 'Unit 1';
const CHUNK = 'measurement-data-quality';
const { buildUnit1MeasurementPacket } = require('./unit1MeasurementPacketAdapter');

const MEASUREMENT_FACTS = [
  fact({
    id: 'unit1.measurement.measurement',
    type: 'measurement_concept',
    canonicalTerm: 'measurement',
    aliases: ['measurements'],
    typoAliases: ['mesurement', 'mesurements'],
    studentWording: ['what is measurement', 'what does measurement mean'],
    definition: 'Measurement uses tools and units to describe an amount.',
    use: 'Use measurements for quantities such as length, mass, volume, time, and temperature.',
    examples: ['length in meters', 'mass in kilograms', 'volume in liters'],
    sourceRefs: ['unit1.corpus.0021', 'unit1.corpus.0025', 'unit1.corpus.0026', 'unit1.corpus.0027'],
    related: ['unit', 'tool', 'length', 'mass', 'volume'],
    answerTemplate: 'Measurement means using tools and units to describe an amount, such as length, mass, volume, time, or temperature.'
  }),
  fact({
    id: 'unit1.measurement.accuracy',
    type: 'data_quality',
    canonicalTerm: 'accuracy',
    aliases: ['accurate'],
    typoAliases: ['acuracy', 'accurite'],
    studentWording: ['what is accuracy', 'what does accurate mean'],
    definition: 'Accuracy is how close a measurement is to the accepted or correct value.',
    use: 'Use accuracy when comparing an experimental result to the accepted value.',
    examples: ['a measurement close to the true length'],
    sourceRefs: ['unit1.corpus.0021', 'unit1.corpus.0202'],
    related: ['accepted value', 'experimental result', 'precision'],
    answerTemplate: 'Accuracy is how close a measurement is to the accepted or true value.'
  }),
  fact({
    id: 'unit1.measurement.precision',
    type: 'data_quality',
    canonicalTerm: 'precision',
    aliases: ['precise'],
    typoAliases: ['precison', 'presision', 'percision'],
    studentWording: ['what is precision', 'what does precise mean'],
    definition: 'Precision is how close repeated measurements are to each other.',
    use: 'Use precision to describe consistency between repeated measurements.',
    examples: ['several trials that give nearly the same value'],
    sourceRefs: ['unit1.corpus.0022', 'unit1.corpus.0201'],
    related: ['accuracy', 'repeated trials'],
    answerTemplate: 'Precision is how close repeated measurements are to each other, or how consistent and specific measurements are.'
  }),
  fact({
    id: 'unit1.measurement.accepted_value',
    type: 'data_quality',
    canonicalTerm: 'accepted value',
    aliases: ['true value', 'correct value', 'accepted val'],
    typoAliases: [],
    studentWording: ['what is an accepted value'],
    definition: 'An accepted value is the value considered correct for comparison.',
    use: 'Compare experimental results to the accepted value to judge accuracy.',
    examples: ['the actual length used to judge a class data set'],
    sourceRefs: ['unit1.corpus.0021', 'unit1.corpus.0202'],
    related: ['accuracy', 'experimental result'],
    answerTemplate: 'An accepted value is the value considered correct for comparison.'
  }),
  fact({
    id: 'unit1.measurement.experimental_result',
    type: 'data_quality',
    canonicalTerm: 'experimental result',
    aliases: ['experimental results', 'measured result', 'measured value'],
    typoAliases: ['experamental result'],
    studentWording: ['what is an experimental result'],
    definition: 'An experimental result is the value measured or found during an experiment.',
    use: 'Compare it to the accepted value when thinking about accuracy.',
    examples: ['the length your group measured in a trial'],
    sourceRefs: ['unit1.corpus.0021', 'unit1.corpus.0202'],
    related: ['accepted value', 'accuracy'],
    answerTemplate: 'An experimental result is the value measured or found during an experiment.'
  }),
  fact({
    id: 'unit1.measurement.average',
    type: 'data_quality',
    canonicalTerm: 'average',
    aliases: [],
    typoAliases: ['avrage'],
    studentWording: ['what is an average', 'what does mean mean in data'],
    definition: 'An average is found by adding all values and dividing by the number of values.',
    use: 'Averages summarize repeated measurements.',
    examples: ['average of repeated length trials'],
    sourceRefs: ['unit1.corpus.0024', 'unit1.corpus.0199', 'unit1.corpus.0200'],
    related: ['repeated trials', 'reliability'],
    answerTemplate: 'An average is found by adding all values and dividing by the number of values.'
  }),
  fact({
    id: 'unit1.measurement.repeated_trials',
    type: 'data_quality',
    canonicalTerm: 'repeated trials',
    aliases: ['repeat trials', 'multiple trials', 'repeating trials'],
    typoAliases: [],
    studentWording: ['why do scientists repeat trials', 'why repeat trials'],
    definition: 'Repeated trials are doing the same test more than once.',
    use: 'Repeated trials improve reliability and help identify mistakes or inconsistent data.',
    examples: ['measuring the same object several times'],
    sourceRefs: ['unit1.corpus.0032', 'unit1.corpus.0187'],
    related: ['reliability', 'average', 'precision'],
    answerTemplate: 'Scientists repeat trials to make results more reliable and reduce the effect of mistakes or random error.'
  }),
  fact({
    id: 'unit1.measurement.reliability',
    type: 'data_quality',
    canonicalTerm: 'reliability',
    aliases: ['reliable', 'consistent results'],
    typoAliases: [],
    studentWording: ['what does reliability mean in science'],
    definition: 'Reliability means results are consistent and can be trusted more.',
    use: 'Results become more reliable when they are repeated or supported by enough data.',
    examples: ['repeated trials that show a consistent pattern'],
    sourceRefs: ['unit1.corpus.0032', 'unit1.corpus.0187'],
    related: ['repeated trials', 'precision'],
    answerTemplate: 'Reliability means results are consistent and can be trusted more because they are repeated or supported by enough data.'
  }),
  fact({
    id: 'unit1.measurement.standard',
    type: 'measurement_concept',
    canonicalTerm: 'standard',
    aliases: ['standard unit', 'standards'],
    typoAliases: ['standerd unit'],
    studentWording: ['what is a standard', 'what is a standard unit'],
    definition: 'A standard is an exact quantity people use for comparison.',
    use: 'Standard units let people compare measurements clearly.',
    examples: ['meter', 'kilogram', 'second'],
    sourceRefs: ['unit1.corpus.0025', 'unit1.corpus.0026', 'unit1.corpus.0028'],
    related: ['SI system', 'unit'],
    answerTemplate: 'A standard is an exact quantity people use for comparison. A standard unit is a shared unit used to report measurements clearly.'
  }),
  fact({
    id: 'unit1.measurement.si_system',
    type: 'measurement_concept',
    canonicalTerm: 'SI system',
    aliases: ['si units', 's i system', 'international system of units'],
    typoAliases: [],
    studentWording: ['what is the si system', 'why do scientists use si units'],
    definition: 'The SI system is the measurement system scientists use around the world.',
    use: 'SI units give scientists a common measurement system so data can be compared clearly.',
    examples: ['meter', 'kilogram', 'second', 'Kelvin'],
    sourceRefs: ['unit1.corpus.0025', 'unit1.corpus.0026', 'unit1.corpus.0028', 'unit1.corpus.0029'],
    related: ['standard unit', 'meter', 'kilogram', 'second', 'Kelvin'],
    answerTemplate: 'The SI system is the measurement system scientists use around the world. SI units give scientists a common system so data can be compared clearly.'
  }),
  quantityFact({
    id: 'unit1.measurement.length',
    canonicalTerm: 'length',
    definition: 'Length is the distance between two points.',
    unitAnswer: 'The SI base unit for length is the meter, symbol m.',
    toolAnswer: 'A ruler or meter stick measures length or distance.',
    sourceRefs: ['unit1.corpus.0025', 'unit1.corpus.0196', 'unit1.corpus.0198']
  }),
  quantityFact({
    id: 'unit1.measurement.mass',
    canonicalTerm: 'mass',
    definition: 'Mass is the amount of matter in an object.',
    unitAnswer: 'The SI base unit for mass is the kilogram, symbol kg. In class, smaller masses may often be measured in grams.',
    toolAnswer: 'A digital scale or balance measures mass.',
    sourceRefs: ['unit1.corpus.0026', 'unit1.corpus.0195']
  }),
  quantityFact({
    id: 'unit1.measurement.volume',
    canonicalTerm: 'volume',
    definition: 'Volume is the amount of space an object or substance takes up.',
    unitAnswer: 'Liquid volume is often measured in liters or milliliters.',
    toolAnswer: 'A graduated cylinder measures liquid volume more precisely.',
    sourceRefs: ['unit1.corpus.0012', 'unit1.corpus.0027', 'unit1.corpus.0128', 'unit1.corpus.0184']
  }),
  quantityFact({
    id: 'unit1.measurement.time',
    canonicalTerm: 'time',
    definition: 'Time is the interval between two events.',
    unitAnswer: 'The SI unit for time is the second, symbol s.',
    toolAnswer: 'A stopwatch measures time.',
    sourceRefs: ['unit1.corpus.0028']
  }),
  quantityFact({
    id: 'unit1.measurement.temperature',
    canonicalTerm: 'temperature',
    definition: 'Temperature tells how hot or cold something is and measures the average kinetic energy of particles.',
    unitAnswer: 'Kelvin is the SI unit for temperature.',
    toolAnswer: 'A thermometer measures temperature.',
    sourceRefs: ['unit1.corpus.0029', 'unit1.corpus.0197']
  }),
  fact({
    id: 'unit1.measurement.meniscus',
    type: 'measurement_practice',
    canonicalTerm: 'meniscus',
    aliases: ['curve in liquid', 'curve a liquid gets', 'bottom of the meniscus'],
    typoAliases: ['meniscis', 'miniscus'],
    studentWording: ['what is the meniscus', 'how do you read a graduated cylinder'],
    definition: 'The meniscus is the curve in the surface of a liquid in a container.',
    use: 'Read liquid volume at the bottom of the meniscus at eye level.',
    examples: ['reading a graduated cylinder'],
    sourceRefs: ['unit1.corpus.0030', 'unit1.corpus.0031', 'unit1.corpus.0175', 'unit1.corpus.0190'],
    related: ['graduated cylinder', 'liquid volume'],
    answerTemplate: 'The meniscus is the curve in the surface of a liquid in a container. In a graduated cylinder, read the bottom of the meniscus at eye level.'
  }),
  fact({
    id: 'unit1.measurement.measurement_parts',
    type: 'measurement_concept',
    canonicalTerm: 'measurement includes number and unit',
    aliases: ['number and unit', 'include a unit', 'units important'],
    typoAliases: [],
    studentWording: ['what should a measurement include', 'why are units important'],
    definition: 'A measurement should include a number and a unit.',
    use: 'Units tell what kind of quantity was measured and make measurements understandable.',
    examples: ['15 cm', '2.5 g', '30 s'],
    sourceRefs: ['unit1.corpus.0198', 'unit1.corpus.0175'],
    related: ['measurement', 'unit'],
    answerTemplate: 'A measurement should include a number and a unit. Units tell what kind of quantity was measured and make measurements understandable.'
  })
];

const ALL_FACTS = MEASUREMENT_FACTS;

const UNIT1_MEASUREMENT_PACKET = buildUnit1MeasurementPacket({
  facts: ALL_FACTS,
  matcherName: 'tryUnit1MeasurementKnowledge'
});

function tryUnit1MeasurementKnowledge(message) {
  const text = normalize(message);
  if (!text) return null;
  if (looksLikeAtomicStructurePrompt(text)) return null;
  if (
    looksLikeCalculationOrChunk3Prompt(text) ||
    looksLikeGraphingPrompt(text) ||
    looksLikeScientificMethodStandardPrompt(text) ||
    looksLikeOtherUnitSciencePrompt(text)
  ) return null;

  const fact = findMatchingFact(text);
  if (!fact) return null;

  return {
    type: fact.type === 'measurement_concept' ? 'definition' : 'science_concept',
    confidence: 'strong',
    toolsUsed: ['unit1_measurement_knowledge'],
    notes: `Answered Unit 1 Measurement/Data Quality fact: ${fact.id}.`,
    directAnswer: fact.answerTemplate,
    aiAllowed: false,
    knowledgeRefs: fact.sourceRefs
  };
}

function looksLikeAtomicStructurePrompt(text) {
  return /\b(?:atomic\s+number|atomic\s+mass|mass\s+number|isotopes?|protons?|neutrons?|nuetrons?|newtrons?|electrons?|bohr\s+model|electron\s+cloud|valence\s+electrons?)\b/.test(text);
}

function findMatchingFact(text) {
  if (/\b(close to each other|consistent|same)\b/.test(text) && /\b(far from|not close to)\b/.test(text) && /\baccepted value|true value|correct value\b/.test(text)) {
    return responseFact('unit1.measurement.precise_not_accurate_scenario', 'Those measurements are precise but not accurate. They are close to each other, but far from the accepted value.', ['unit1.corpus.0021', 'unit1.corpus.0022', 'unit1.corpus.0201', 'unit1.corpus.0202']);
  }
  if (/\baccuracy\b/.test(text) && /\bprecision\b/.test(text) && /\bdifference\b/.test(text)) {
    return responseFact('unit1.measurement.accuracy_precision_difference', 'Accuracy means close to the correct or accepted value. Precision means repeated measurements are close to each other.', ['unit1.corpus.0021', 'unit1.corpus.0022']);
  }
  if (/\baccurate\b.*\bnot\b.*\bprecise\b/.test(text)) {
    return responseFact('unit1.measurement.accurate_not_precise', 'Yes. Measurements can average near the true value but still be spread out from each other, so they are accurate but not precise.', ['unit1.corpus.0021', 'unit1.corpus.0022', 'unit1.corpus.0201', 'unit1.corpus.0202']);
  }
  if (/\bprecise\b.*\bnot\b.*\baccurate\b/.test(text)) {
    return responseFact('unit1.measurement.precise_not_accurate', 'Yes. Measurements can be very close to each other but still far from the accepted value, so they are precise but not accurate.', ['unit1.corpus.0021', 'unit1.corpus.0022', 'unit1.corpus.0201', 'unit1.corpus.0202']);
  }
  if (/\bwhy\b/.test(text) && /\baverage|averages|mean\b/.test(text)) {
    return responseFact('unit1.measurement.average_why', 'Scientists calculate averages to summarize repeated measurements and reduce the effect of random variation.', ['unit1.corpus.0024', 'unit1.corpus.0199', 'unit1.corpus.0200']);
  }
  if (/\breliability|reliable\b/.test(text)) {
    return factById('unit1.measurement.reliability');
  }
  if (/\bwhy\b/.test(text) && /\bsi\b/.test(text)) {
    return factById('unit1.measurement.si_system');
  }
  if (/\bwhy\b/.test(text) && /\bmeniscus\b/.test(text) && /\beye\b/.test(text)) {
    return responseFact('unit1.measurement.meniscus_eye_level', 'Read the meniscus at eye level because it helps avoid measurement error.', ['unit1.corpus.0031', 'unit1.corpus.0175']);
  }
  if (/\bhow\b/.test(text) && /\bread\b/.test(text) && /\bgraduated cylinder\b/.test(text)) {
    return factById('unit1.measurement.meniscus');
  }
  if (/\bwhy\b/.test(text) && /\bgraduated cylinder\b/.test(text) && /\bbeaker\b/.test(text)) {
    return responseFact('unit1.measurement.graduated_cylinder_vs_beaker', 'A graduated cylinder is better than a beaker for measuring volume because it measures liquid volume more precisely.', ['unit1.corpus.0012', 'unit1.corpus.0128', 'unit1.corpus.0184']);
  }
  if (/\bmeasurements?\b/.test(text) && /\b(include|number|unit)\b/.test(text)) {
    return factById('unit1.measurement.measurement_parts');
  }
  if (/\bunits?\b/.test(text) && /\bimportant|matter|include|understandable\b/.test(text)) {
    return factById('unit1.measurement.measurement_parts');
  }

  const toolFact = matchToolQuestion(text);
  if (toolFact) return toolFact;

  const unitFact = matchUnitQuestion(text);
  if (unitFact) return unitFact;

  for (const fact of ALL_FACTS) {
    if (matchesFact(text, fact)) return fact;
  }
  return null;
}

function matchToolQuestion(text) {
  if (!/\b(tool|measure|measures|mesure|mesures|use)\b/.test(text)) return null;
  if (/\b(length|distance|ruler|meter stick)\b/.test(text)) return toolResponse('length');
  if (/\b(mass|digital scale|balance)\b/.test(text)) return toolResponse('mass');
  if (/\b(liquid volume|volume|graduated cylinder|grad cylinder)\b/.test(text)) return toolResponse('volume');
  if (/\b(time|stopwatch)\b/.test(text)) return toolResponse('time');
  if (/\b(temperature|thermometer)\b/.test(text)) return toolResponse('temperature');
  return null;
}

function matchUnitQuestion(text) {
  if (!/\b(unit|si)\b/.test(text)) return null;
  if (/\blength\b/.test(text)) return unitResponse('length');
  if (/\bmass\b/.test(text)) return unitResponse('mass');
  if (/\bliquid volume|volume\b/.test(text)) return unitResponse('volume');
  if (/\btime\b/.test(text)) return unitResponse('time');
  if (/\btemperature\b/.test(text)) return unitResponse('temperature');
  return null;
}

function matchesFact(text, fact) {
  const terms = [fact.canonicalTerm, ...(fact.aliases || []), ...(fact.typoAliases || [])]
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!terms.some((term) => hasTerm(text, term))) return false;
  if (fact.type === 'quantity') {
    return new RegExp(`\\bwhat\\s+is\\s+(?:the\\s+)?${fact.canonicalTerm}\\b`).test(text);
  }
  return /\b(what|why|when|where|how|should|do|does|mean|means|is|are|can|unit|tool|measure|measures|mesure|mesures|read|repeat|trials|scientists|science)\b/.test(text);
}

function unitResponse(quantity) {
  const fact = factById(`unit1.measurement.${quantity}`);
  return responseFact(`${fact.id}.unit`, fact.unitAnswer, fact.sourceRefs);
}

function toolResponse(quantity) {
  const fact = factById(`unit1.measurement.${quantity}`);
  return responseFact(`${fact.id}.tool`, fact.toolAnswer, fact.sourceRefs);
}

function factById(id) {
  return ALL_FACTS.find((fact) => fact.id === id);
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

function quantityFact({ id, canonicalTerm, definition, unitAnswer, toolAnswer, sourceRefs }) {
  return fact({
    id,
    type: 'quantity',
    canonicalTerm,
    aliases: [],
    typoAliases: [],
    studentWording: [`what is ${canonicalTerm}`, `what unit is used for ${canonicalTerm}`, `what tool measures ${canonicalTerm}`],
    definition,
    use: `Use ${canonicalTerm} to describe a measured quantity.`,
    sourceRefs,
    related: ['SI system', 'measurement'],
    unitAnswer,
    toolAnswer,
    answerTemplate: definition
  });
}

function responseFact(id, answerTemplate, sourceRefs) {
  return fact({
    id,
    type: 'data_quality',
    canonicalTerm: id,
    aliases: [],
    typoAliases: [],
    studentWording: [],
    definition: answerTemplate,
    use: answerTemplate,
    sourceRefs,
    related: [],
    answerTemplate
  });
}

function looksLikeCalculationOrChunk3Prompt(text) {
  if (/\b(formula|formulas|solve for|how do i solve|equation)\b/.test(text)) return true;
  if (/\b(force|acceleration|newtons?|newton s|fnet)\b/.test(text)) return true;
  if (/\b(convert|conversion|dimensional analysis|picket fence|scientific notation|scientific notaton|standard notation|standard notaton)\b/.test(text)) return true;
  if (/\d/.test(text) && /\b(calculate|find|solve|determine|density|mass|volume|speed|period|frequency|wavelength|velocity|distance|displacement|current|voltage|resistance|power|work|energy|average|mean|temperature|kelvin|celsius|fahrenheit|meters?|grams?|liters?|seconds?|miles?|feet|yards?|inches?|centimeters?|millimeters?|kilometers?)\b/.test(text)) return true;
  return false;
}

function looksLikeOtherUnitSciencePrompt(text) {
  return /\b(refraction|reflection|absorption|wave|waves|light|sound|conservation of mass|conservation of matter|chemical reaction|reaction|rust|heating curve|segment|unit 6|chemistry|what is matter|state|shape|solid|gas|definite|fixed|container)\b/.test(text);
}

function looksLikeGraphingPrompt(text) {
  return /\b(graph|x axis|y axis|axis|scale|line graph|bar graph|circle graph|pie graph)\b/.test(text);
}

function looksLikeScientificMethodStandardPrompt(text) {
  return /\b(control group|experimental group|independent variable|dependent variable|hypothesis|experiment|serves as a standard for comparison|standard for comparison)\b/.test(text);
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
    .replace(/\bacuracy\b/g, 'accuracy')
    .replace(/\baccurite\b/g, 'accurate')
    .replace(/\bprecison\b/g, 'precision')
    .replace(/\bpresision\b/g, 'precision')
    .replace(/\bpercision\b/g, 'precision')
    .replace(/\bavrage\b/g, 'average')
    .replace(/\bexperamental\b/g, 'experimental')
    .replace(/\bstanderd\b/g, 'standard')
    .replace(/\bmeniscis\b/g, 'meniscus')
    .replace(/\bminiscus\b/g, 'meniscus')
    .replace(/\bcylender\b/g, 'cylinder')
    .replace(/\bmesurement\b/g, 'measurement')
    .replace(/\bmeasurments\b/g, 'measurements')
    .replace(/\bmesure\b/g, 'measure')
    .replace(/\bmesures\b/g, 'measures')
    .replace(/\bmesuring\b/g, 'measuring')
    .replace(/\bsciencetists\b/g, 'scientists')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bs\s+i\s+system\b/g, 'si system')
    .replace(/\bgrad cylinder\b/g, 'graduated cylinder')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  ALL_UNIT1_MEASUREMENT_FACTS: ALL_FACTS,
  UNIT1_MEASUREMENT_PACKET,
  tryUnit1MeasurementKnowledge
};
