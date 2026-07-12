const UNIT = 'Unit 1';
const CHUNK = 'scientific-method-variables';
const { buildUnit1ScientificMethodPacket } = require('./unit1ScientificMethodPacketAdapter');

const FACTS = [
  fact({
    id: 'unit1.scientific_method.science',
    type: 'science_method',
    canonicalTerm: 'science',
    aliases: [],
    typoAliases: [],
    studentWording: ['what is science'],
    definition: 'Science is the study of the natural world through observation, evidence, and investigation.',
    use: 'Scientists gather information through observations and investigations.',
    examples: ['studying plant growth', 'testing how temperature affects dissolving'],
    sourceRefs: ['unit1.corpus.0043'],
    related: ['observation', 'investigation', 'evidence'],
    answerTemplate: 'Science is the study of the natural world through observation, evidence, and investigation.'
  }),
  fact({
    id: 'unit1.scientific_method.scientific_method',
    type: 'science_method',
    canonicalTerm: 'scientific method',
    aliases: ['scientific method steps', 'scientific investigation'],
    typoAliases: ['scientfic method', 'scientific methode'],
    studentWording: ['what is the scientific method', 'what are the steps of the scientific method'],
    definition: 'The scientific method is a process scientists use to ask questions, test ideas, collect data, and draw conclusions.',
    use: 'Use it to investigate testable questions with evidence.',
    examples: ['ask a question, form a hypothesis, test, collect data, conclude'],
    sourceRefs: ['unit1.corpus.0073', 'unit1.corpus.0107', 'unit1.corpus.0137'],
    related: ['hypothesis', 'experiment', 'data', 'conclusion'],
    answerTemplate: 'The scientific method is a process scientists use to ask questions, test ideas, collect data, and draw conclusions.'
  }),
  fact({
    id: 'unit1.scientific_method.scientific_question',
    type: 'science_method',
    canonicalTerm: 'scientific question',
    aliases: ['testable question', 'scientific questions'],
    typoAliases: [],
    studentWording: ['what is a scientific question', 'what does testable question mean'],
    definition: 'A scientific question is testable and can be investigated with evidence.',
    use: 'Good scientific questions can be tested with observations, measurements, or experiments.',
    examples: ['How does sunlight affect plant growth?'],
    sourceRefs: ['unit1.corpus.0115'],
    related: ['hypothesis', 'experiment', 'evidence'],
    answerTemplate: 'A scientific question is testable and can be investigated with evidence.'
  }),
  fact({
    id: 'unit1.scientific_method.background_research',
    type: 'science_method',
    canonicalTerm: 'background research',
    aliases: ['research', 'background information'],
    typoAliases: [],
    studentWording: ['what is background research'],
    definition: 'Background research is information gathered before the experiment to help understand the topic and form a hypothesis.',
    use: 'Use research to learn what is already known before testing.',
    examples: ['reading about plant growth before designing an experiment'],
    sourceRefs: ['unit1.corpus.0075'],
    related: ['hypothesis', 'scientific question'],
    answerTemplate: 'Background research is information gathered before the experiment to help understand the topic and form a hypothesis.'
  }),
  fact({
    id: 'unit1.scientific_method.hypothesis',
    type: 'science_method',
    canonicalTerm: 'hypothesis',
    aliases: ['testable prediction', 'prediction'],
    typoAliases: ['hypotheis', 'hypothisis', 'hypotesis'],
    studentWording: ['what is a hypothesis', 'what is the hypothesis format'],
    definition: 'A hypothesis is a testable prediction or possible answer to a scientific question.',
    use: 'A hypothesis predicts a cause-and-effect relationship between variables.',
    examples: ['If soil temperature increases, then plant growth will increase, because warmer soil may help seeds grow.'],
    sourceRefs: ['unit1.corpus.0048', 'unit1.corpus.0076', 'unit1.corpus.0120'],
    related: ['independent variable', 'dependent variable'],
    answerTemplate: 'A hypothesis is a testable prediction or possible answer to a scientific question.'
  }),
  fact({
    id: 'unit1.scientific_method.procedure',
    type: 'science_method',
    canonicalTerm: 'procedure',
    aliases: ['steps', 'directions', 'experiment steps'],
    typoAliases: [],
    studentWording: ['what is a procedure'],
    definition: 'A procedure is the step-by-step directions for an experiment.',
    use: 'A clear procedure helps someone repeat the experiment.',
    examples: ['measure water, add fertilizer, record plant height'],
    sourceRefs: ['unit1.corpus.0138'],
    related: ['experiment', 'trials'],
    answerTemplate: 'A procedure is the step-by-step directions for an experiment.'
  }),
  fact({
    id: 'unit1.scientific_method.repeated_trials',
    type: 'science_method',
    canonicalTerm: 'repeated trials',
    aliases: ['repeat trials', 'multiple trials'],
    typoAliases: [],
    studentWording: ['why repeat trials', 'why repeat an experiment'],
    definition: 'Repeated trials improve reliability, reduce the influence of random error, help identify unusual results, and may allow results to be averaged.',
    use: 'Repeating an experiment makes the overall result less dependent on any one trial.',
    examples: ['run the same test several times and compare or average the results'],
    sourceRefs: ['unit1.corpus.0032'],
    related: ['procedure', 'data', 'reliability'],
    answerTemplate: 'Scientists repeat trials to improve reliability and reduce the influence of random error. Repeated trials also help identify unusual results and may allow the results to be averaged.'
  }),
  fact({
    id: 'unit1.scientific_method.data',
    type: 'science_method',
    canonicalTerm: 'data',
    aliases: ['experiment data'],
    typoAliases: [],
    studentWording: ['what is data'],
    definition: 'Data are observations or measurements collected during an investigation.',
    use: 'Data are used as evidence when analyzing results.',
    examples: ['plant height measurements', 'color observations'],
    sourceRefs: ['unit1.corpus.0101'],
    related: ['evidence', 'analysis', 'qualitative data', 'quantitative data'],
    answerTemplate: 'Data are observations or measurements collected during an investigation.'
  }),
  fact({
    id: 'unit1.scientific_method.evidence',
    type: 'science_method',
    canonicalTerm: 'evidence',
    aliases: [],
    typoAliases: [],
    studentWording: ['what is evidence'],
    definition: 'Evidence is data or observations that support a claim or conclusion.',
    use: 'Use evidence to decide whether data support a hypothesis.',
    examples: ['trial results that show plants grew taller'],
    sourceRefs: ['unit1.corpus.0138'],
    related: ['data', 'claim', 'conclusion'],
    answerTemplate: 'Evidence is data or observations that support a claim or conclusion.'
  }),
  fact({
    id: 'unit1.scientific_method.analysis',
    type: 'science_method',
    canonicalTerm: 'analysis',
    aliases: ['analyze data', 'analyzing data'],
    typoAliases: [],
    studentWording: ['what is analysis'],
    definition: 'Analysis means examining data to find patterns, relationships, or meaning.',
    use: 'Analysis helps connect data to a conclusion.',
    examples: ['looking for a pattern in plant height data'],
    sourceRefs: ['unit1.corpus.0096'],
    related: ['data', 'conclusion'],
    answerTemplate: 'Analysis means examining data to find patterns, relationships, or meaning.'
  }),
  fact({
    id: 'unit1.scientific_method.conclusion',
    type: 'science_method',
    canonicalTerm: 'conclusion',
    aliases: [],
    typoAliases: ['conclushion'],
    studentWording: ['what is a conclusion', 'why should a conclusion not say proven'],
    definition: 'A conclusion explains what the data show and whether the data support the hypothesis.',
    use: 'Conclusions should use evidence from the investigation.',
    examples: ['The data support the hypothesis because plants with more sunlight grew taller.'],
    commonMisconceptions: ['A single experiment proves a hypothesis forever.'],
    sourceRefs: ['unit1.corpus.0055', 'unit1.corpus.0096'],
    related: ['data', 'evidence', 'hypothesis'],
    answerTemplate: 'A conclusion explains what the data show and whether the data support the hypothesis.'
  }),
  fact({
    id: 'unit1.scientific_method.independent_variable',
    type: 'variable',
    canonicalTerm: 'independent variable',
    aliases: ['iv', 'manipulated variable', 'changed variable'],
    typoAliases: ['independant variable', 'independent varible'],
    studentWording: ['what is an independent variable', 'what variable do i change'],
    definition: 'The independent variable is what the scientist changes on purpose.',
    use: 'It is the cause or tested change in the experiment.',
    examples: ['amount of sunlight', 'type of fertilizer', 'temperature'],
    sourceRefs: ['unit1.corpus.0050', 'unit1.corpus.0105', 'unit1.corpus.0123', 'unit1.corpus.0141'],
    related: ['dependent variable', 'constant', 'fair test'],
    conceptTutorCandidate: true,
    answerTemplate: 'The independent variable is what the scientist changes on purpose.'
  }),
  fact({
    id: 'unit1.scientific_method.dependent_variable',
    type: 'variable',
    canonicalTerm: 'dependent variable',
    aliases: ['dv', 'responding variable', 'measured variable'],
    typoAliases: ['dependent varible', 'dependant variable'],
    studentWording: ['what is a dependent variable', 'what variable do i measure'],
    definition: 'The dependent variable is what the scientist measures or observes as the result.',
    use: 'It is the effect or response to the independent variable.',
    examples: ['plant growth', 'plant height', 'time to dissolve'],
    sourceRefs: ['unit1.corpus.0051', 'unit1.corpus.0104', 'unit1.corpus.0122', 'unit1.corpus.0135'],
    related: ['independent variable'],
    conceptTutorCandidate: true,
    answerTemplate: 'The dependent variable is what the scientist measures or observes as the result.'
  }),
  fact({
    id: 'unit1.scientific_method.constant',
    type: 'variable',
    canonicalTerm: 'constant',
    aliases: ['constants', 'constant variable'],
    typoAliases: [],
    studentWording: ['what is a constant'],
    definition: 'A constant is something kept the same during an experiment.',
    use: 'Constants help keep the test fair.',
    examples: ['same type of plant', 'same amount of water', 'same soil'],
    sourceRefs: ['unit1.corpus.0054', 'unit1.corpus.0080', 'unit1.corpus.0110', 'unit1.corpus.0142'],
    related: ['controlled variable', 'fair test'],
    conceptTutorCandidate: true,
    answerTemplate: 'A constant is something kept the same during an experiment.'
  }),
  fact({
    id: 'unit1.scientific_method.controlled_variable',
    type: 'variable',
    canonicalTerm: 'controlled variable',
    aliases: ['controlled variables', 'control variable'],
    typoAliases: ['controled variable', 'controlled varible'],
    studentWording: ['what is a controlled variable'],
    definition: 'A controlled variable is something kept the same so the test is fair.',
    use: 'Controlled variables reduce other explanations for the results.',
    examples: ['same container', 'same soil', 'same amount of water'],
    sourceRefs: ['unit1.corpus.0054', 'unit1.corpus.0110', 'unit1.corpus.0142'],
    related: ['constant', 'fair test'],
    conceptTutorCandidate: true,
    answerTemplate: 'A controlled variable is something kept the same so the test is fair.'
  }),
  fact({
    id: 'unit1.scientific_method.control_group',
    type: 'experiment_group',
    canonicalTerm: 'control group',
    aliases: ['comparison group', 'standard for comparison', 'normal group'],
    typoAliases: [],
    studentWording: ['what is a control group', 'why is a control group useful', 'what is the purpose of a control group'],
    definition: 'A control group is the normal or comparison group that does not receive the tested change.',
    use: 'It provides a baseline for comparing the tested group with normal or unchanged conditions, helping show whether the independent variable caused the observed result.',
    examples: ['plants grown without the tested fertilizer'],
    sourceRefs: ['unit1.corpus.0052', 'unit1.corpus.0103', 'unit1.corpus.0119'],
    related: ['experimental group', 'independent variable'],
    conceptTutorCandidate: true,
    answerTemplate: 'A control group is the normal or comparison group that does not receive the tested change.'
  }),
  fact({
    id: 'unit1.scientific_method.experimental_group',
    type: 'experiment_group',
    canonicalTerm: 'experimental group',
    aliases: ['test group'],
    typoAliases: ['experamental group'],
    studentWording: ['what is an experimental group'],
    definition: 'An experimental group receives the tested change or independent variable.',
    use: 'Compare it with the control group.',
    examples: ['plants receiving the tested fertilizer'],
    sourceRefs: ['unit1.corpus.0053', 'unit1.corpus.0102'],
    related: ['control group', 'independent variable'],
    conceptTutorCandidate: true,
    answerTemplate: 'An experimental group receives the tested change or independent variable.'
  }),
  fact({
    id: 'unit1.scientific_method.fair_test',
    type: 'variable',
    canonicalTerm: 'fair test',
    aliases: ['one independent variable', 'one variable'],
    typoAliases: [],
    studentWording: ['what is a fair test', 'why only one independent variable'],
    definition: 'A fair test changes only one independent variable while keeping other variables constant.',
    use: 'Changing only one independent variable helps show what caused the results.',
    examples: ['change fertilizer type while keeping water and sunlight the same'],
    sourceRefs: ['unit1.corpus.0086', 'unit1.corpus.0141'],
    related: ['independent variable', 'controlled variable'],
    conceptTutorCandidate: true,
    answerTemplate: 'A fair test changes only one independent variable while keeping other variables constant.'
  }),
  fact({
    id: 'unit1.scientific_method.observation',
    type: 'data_type',
    canonicalTerm: 'observation',
    aliases: ['observations'],
    typoAliases: ['observashun'],
    studentWording: ['what is an observation'],
    definition: 'An observation is information gathered using the senses or tools.',
    use: 'Observations can be qualitative or quantitative.',
    examples: ['the plant is green', 'the plant is 12 cm tall'],
    sourceRefs: ['unit1.corpus.0044', 'unit1.corpus.0074', 'unit1.corpus.0099', 'unit1.corpus.0114'],
    related: ['inference', 'data'],
    answerTemplate: 'An observation is information gathered using the senses or tools.'
  }),
  fact({
    id: 'unit1.scientific_method.inference',
    type: 'data_type',
    canonicalTerm: 'inference',
    aliases: ['infer'],
    typoAliases: ['inferance'],
    studentWording: ['what is an inference'],
    definition: 'An inference is a logical explanation or conclusion based on observations and prior knowledge.',
    use: 'Use observations as evidence when making an inference.',
    examples: ['The plant may need more light because its leaves are pale.'],
    sourceRefs: ['unit1.corpus.0045'],
    related: ['observation'],
    answerTemplate: 'An inference is a logical explanation or conclusion based on observations and prior knowledge.'
  }),
  fact({
    id: 'unit1.scientific_method.qualitative_data',
    type: 'data_type',
    canonicalTerm: 'qualitative data',
    aliases: ['qualitative observation', 'descriptive data'],
    typoAliases: ['qualatative data'],
    studentWording: ['what is qualitative data'],
    definition: 'Qualitative data are descriptive observations, such as color, smell, texture, or appearance.',
    use: 'Qualitative data describe qualities without using measurements as the main evidence.',
    examples: ['red color', 'rough texture', 'strong smell'],
    sourceRefs: ['unit1.corpus.0056', 'unit1.corpus.0094'],
    related: ['quantitative data'],
    answerTemplate: 'Qualitative data are descriptive observations, such as color, smell, texture, or appearance.'
  }),
  fact({
    id: 'unit1.scientific_method.quantitative_data',
    type: 'data_type',
    canonicalTerm: 'quantitative data',
    aliases: ['numerical data', 'quantitative observation'],
    typoAliases: ['quantative data'],
    studentWording: ['what is quantitative data'],
    definition: 'Quantitative data are numerical measurements or counts.',
    use: 'Quantitative data use numbers.',
    examples: ['12 cm', '5 trials', '20 seconds'],
    sourceRefs: ['unit1.corpus.0057', 'unit1.corpus.0095', 'unit1.corpus.0151'],
    related: ['qualitative data'],
    answerTemplate: 'Quantitative data are numerical measurements or counts.'
  }),
  fact({
    id: 'unit1.scientific_method.scientific_law',
    type: 'science_method',
    canonicalTerm: 'scientific law',
    aliases: [],
    typoAliases: [],
    studentWording: ['what is a scientific law'],
    definition: 'A scientific law describes a pattern in nature.',
    use: 'A law describes what happens.',
    examples: ['a pattern observed repeatedly in nature'],
    sourceRefs: ['unit1.corpus.0046'],
    related: ['scientific theory'],
    answerTemplate: 'A scientific law describes a pattern in nature.'
  }),
  fact({
    id: 'unit1.scientific_method.scientific_theory',
    type: 'science_method',
    canonicalTerm: 'scientific theory',
    aliases: [],
    typoAliases: [],
    studentWording: ['what is a scientific theory'],
    definition: 'A scientific theory is a well-supported explanation for why something happens.',
    use: 'A theory explains why a natural pattern happens and is based on evidence.',
    examples: ['an evidence-based explanation for a natural process'],
    sourceRefs: ['unit1.corpus.0047'],
    related: ['scientific law'],
    answerTemplate: 'A scientific theory is a well-supported explanation for why something happens.'
  })
];

const UNIT1_SCIENTIFIC_METHOD_PACKET = buildUnit1ScientificMethodPacket({
  facts: FACTS,
  matcherName: 'tryUnit1ScientificMethodKnowledge'
});

function tryUnit1ScientificMethodKnowledge(message) {
  const text = normalize(message);
  if (!text) return null;
  if (looksLikeCalculationOrOtherUnitPrompt(text)) return null;
  if (looksLikeMotionContextPrompt(text)) return null;
  if (looksLikeChemicalChangeEvidencePrompt(text)) return null;

  const fact = findMatchingFact(text);
  if (!fact) return null;

  return {
    type: fact.type === 'science_method' ? 'definition' : 'science_concept',
    confidence: 'strong',
    toolsUsed: ['unit1_scientific_method_knowledge'],
    notes: `Answered Unit 1 Scientific Method/Variables fact: ${fact.id}.`,
    directAnswer: fact.answerTemplate,
    aiAllowed: false,
    knowledgeRefs: fact.sourceRefs
  };
}

function findMatchingFact(text) {
  const scenario = matchNarrowScenario(text);
  if (scenario) return scenario;

  if (isControlGroupUsefulnessQuestion(text)) {
    return responseFact(
      'unit1.scientific_method.control_group_usefulness',
      'A control group provides a baseline for comparison. Comparing the tested group with normal or unchanged conditions helps the experimenter determine whether the independent variable caused the observed result.',
      ['unit1.corpus.0052', 'unit1.corpus.0103', 'unit1.corpus.0119']
    );
  }

  if (
    /\brepeat(?:ed|ing)?\b.*\b(?:trials?|experiments?)\b/.test(text) ||
    /\b(?:multiple|several)\s+(?:trials?|experiments?)\b/.test(text)
  ) {
    return factById('unit1.scientific_method.repeated_trials');
  }

  if (/\bsteps?\b/.test(text) && /\bscientific method\b/.test(text)) {
    return responseFact(
      'unit1.scientific_method.steps',
      'The main steps of the scientific method are: ask a question, do background research, form a hypothesis, test with an experiment, collect and analyze data, draw a conclusion, and communicate results.',
      ['unit1.corpus.0073', 'unit1.corpus.0107', 'unit1.corpus.0137']
    );
  }
  if (/\bhypothesis\b/.test(text) && /\b(format|formula)\b/.test(text)) {
    return responseFact(
      'unit1.scientific_method.hypothesis_format',
      'A common hypothesis format is: If the independent variable changes, then the dependent variable will change, because...',
      ['unit1.corpus.0049', 'unit1.corpus.0111']
    );
  }
  if (/\bconclusion\b/.test(text) && /\b(proven|disproven|prove|disprove)\b/.test(text)) {
    return responseFact(
      'unit1.scientific_method.conclusion_not_proven',
      'A conclusion should not say proven or disproven because experiments support or do not support a hypothesis; they do not prove it forever.',
      ['unit1.corpus.0055']
    );
  }
  if (/\bindependent\b/.test(text) && /\bdependent\b/.test(text) && /\bvariables?\b/.test(text) && /\bdifference\b/.test(text)) {
    return responseFact(
      'unit1.scientific_method.iv_dv_difference',
      'The independent variable is changed on purpose; the dependent variable is measured or observed as the response.',
      ['unit1.corpus.0050', 'unit1.corpus.0051', 'unit1.corpus.0104', 'unit1.corpus.0105']
    );
  }
  if (/\bcontrol group\b/.test(text) && /\b(constants?|controlled variables?)\b/.test(text) && /\bdifference\b/.test(text)) {
    return responseFact(
      'unit1.scientific_method.control_group_constants_difference',
      'A control group is a comparison group. Constants or controlled variables are conditions kept the same across groups.',
      ['unit1.corpus.0052', 'unit1.corpus.0054', 'unit1.corpus.0103', 'unit1.corpus.0110']
    );
  }
  if (/\bwhy\b/.test(text) && /\b(one independent variable|only one independent variable|one variable)\b/.test(text)) {
    return responseFact(
      'unit1.scientific_method.why_one_iv',
      'An experiment should have only one independent variable because changing one thing at a time helps show what caused the results.',
      ['unit1.corpus.0086', 'unit1.corpus.0141']
    );
  }
  if (/\bobservation\b/.test(text) && /\binference\b/.test(text) && /\bdifference\b/.test(text)) {
    return responseFact(
      'unit1.scientific_method.observation_inference_difference',
      'An observation is what you notice directly using senses or tools. An inference is what you think it means based on observations and prior knowledge.',
      ['unit1.corpus.0044', 'unit1.corpus.0045']
    );
  }
  if (/\bqualitative\b/.test(text) && /\bquantitative\b/.test(text) && /\bdata\b/.test(text) && /\bdifference\b/.test(text)) {
    return responseFact(
      'unit1.scientific_method.qual_quant_difference',
      'Qualitative data describe qualities, such as color or texture. Quantitative data use numbers, measurements, or counts.',
      ['unit1.corpus.0056', 'unit1.corpus.0057', 'unit1.corpus.0094', 'unit1.corpus.0095']
    );
  }
  if (/\bqualitative data\b/.test(text)) return factById('unit1.scientific_method.qualitative_data');
  if (/\bquantitative data\b/.test(text)) return factById('unit1.scientific_method.quantitative_data');
  if (/\b(law vs theory|theory vs law)\b/.test(text) || (/\blaw\b/.test(text) && /\btheory\b/.test(text) && /\bdifference\b/.test(text))) {
    return responseFact(
      'unit1.scientific_method.law_theory_difference',
      'A scientific law describes what happens or a pattern in nature. A scientific theory explains why something happens and is supported by evidence.',
      ['unit1.corpus.0046', 'unit1.corpus.0047']
    );
  }

  for (const fact of FACTS) {
    if (matchesFact(text, fact)) return fact;
  }
  return null;
}

function matchNarrowScenario(text) {
  const asksIndependent = /\bindependent(?:\s+variables?|\s+and\s+dependent\s+variables?)\b/.test(text);
  const asksDependent = /\bdependent\s+variables?\b/.test(text);
  if (!asksIndependent && !asksDependent) return null;

  if (/\bsunlight\b/.test(text) && /\bplants?\b/.test(text) && /\b(?:height|tall(?:er|est)?|grow(?:s|th)?)\b/.test(text)) {
    if (asksIndependent && asksDependent) {
      return responseFact(
        'unit1.scenario.sunlight_plant_growth.iv_dv',
        /\b(?:height|tall(?:er|est)?)\b/.test(text)
          ? 'The independent variable is the amount of sunlight. The dependent variable is plant height.'
          : 'The independent variable is the amount of sunlight. The dependent variable is plant growth.',
        ['unit1.corpus.0084', 'unit1.corpus.0116']
      );
    }
    return responseFact(
      asksIndependent ? 'unit1.scenario.sunlight_plant_growth.iv' : 'unit1.scenario.sunlight_plant_growth.dv',
      asksIndependent
        ? 'The independent variable is the amount of sunlight.'
        : /\b(?:height|tall(?:er|est)?)\b/.test(text)
          ? 'The dependent variable is plant height.'
          : 'The dependent variable is plant growth.',
      ['unit1.corpus.0084', 'unit1.corpus.0116']
    );
  }

  const explicitChangedAndMeasured = matchExplicitChangedAndMeasuredScenario(text, {
    asksIndependent,
    asksDependent
  });
  if (explicitChangedAndMeasured) return explicitChangedAndMeasured;

  if (/\bfertilizer\b/.test(text) && /\bplants?\b/.test(text) && /\b(taller|height|grow|growth)\b/.test(text)) {
    return responseFact(
      asksIndependent ? 'unit1.scenario.fertilizer_plant_height.iv' : 'unit1.scenario.fertilizer_plant_height.dv',
      asksIndependent
        ? 'The independent variable is the type of fertilizer.'
        : 'The dependent variable is plant height or growth.',
      ['unit1.corpus.0134']
    );
  }
  if (/\btemperature\b/.test(text) && /\bdissolv/.test(text)) {
    return responseFact(
      asksIndependent ? 'unit1.scenario.temperature_dissolving.iv' : 'unit1.scenario.temperature_dissolving.dv',
      asksIndependent
        ? 'The independent variable is temperature.'
        : 'The dependent variable is how fast or how much dissolves.',
      ['unit1.corpus.0139']
    );
  }
  return null;
}

function matchExplicitChangedAndMeasuredScenario(text, { asksIndependent, asksDependent }) {
  const changedAndMeasured = text.match(
    /\b(?:changes?|changed|varies?|varied)\s+(?:the\s+)?(.+?)\s+(?:and|then)\s+(records?|recorded|measures?|measured|observes?|observed)\s+(?:the\s+)?(.+?)(?=\s+(?:while|identify|name|what|which)\b|$)/
  );
  const differentAmountsAndMeasured = text.match(
    /\b(?:gives?|gave)\s+.+?\s+(?:different|varying)\s+(amounts?\s+of\s+.+?)\s+and\s+(records?|recorded|measures?|measured|observes?|observed)\s+(?:the\s+)?(.+?)(?=\s+(?:while|identify|name|what|which)\b|$)/
  );
  const match = changedAndMeasured || differentAmountsAndMeasured;
  if (!match) return null;

  const independent = cleanChangedQuantity(match[1]);
  const dependent = cleanMeasuredQuantity(match[3], text);
  if (!independent || !dependent || isGenericMeasuredPlaceholder(dependent)) return null;

  const answers = [];
  if (asksIndependent) answers.push(`The independent variable is ${independent}.`);
  if (asksDependent) answers.push(`The dependent variable is ${dependent}.`);

  return responseFact(
    'unit1.scenario.explicit_changed_measured_variables',
    answers.join(' '),
    ['unit1.corpus.0050', 'unit1.corpus.0051', 'unit1.corpus.0104', 'unit1.corpus.0105']
  );
}

function cleanChangedQuantity(value) {
  const quantity = String(value || '')
    .replace(/\s+(?:given|applied|provided)\s+to\s+.+$/, '')
    .replace(/^amounts\s+of\b/, 'amount of')
    .replace(/\s+/g, ' ')
    .trim();
  return /^(?:amount|type)\s+of\b/.test(quantity) ? `the ${quantity}` : quantity;
}

function cleanMeasuredQuantity(value, text) {
  let quantity = String(value || '')
    .replace(/\s+(?:and\s+)?(?:keeps?|kept)\s+.+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/^their\b/.test(quantity)) return quantity;

  const plantDescription = findPlantDescription(text);
  return quantity.replace(/^their\b/, plantDescription ? `the ${plantDescription}'` : 'the subjects\'');
}

function isGenericMeasuredPlaceholder(value) {
  return /^(?:data|results?|information|observations?|findings?|outcomes?|measurements?|readings?)$/.test(value);
}

function findPlantDescription(text) {
  const match = String(text || '').match(/\b([a-z]+)\s+plants?\b/);
  if (!match) return '';
  if (/^(?:identical|same|the)$/.test(match[1])) return 'plants';
  return `${match[1]} plants`;
}

function isControlGroupUsefulnessQuestion(text) {
  if (!/\bcontrol group\b/.test(text)) return false;
  return /\b(?:why|useful|usefulness|purpose|important|importance|matter|matters|baseline|used for)\b/.test(text) ||
    /\b(?:provide|provides|providing|serve|serves|serving|allow|allows|allowing)\b.*\bcomparison\b/.test(text);
}

function matchesFact(text, fact) {
  const terms = [fact.canonicalTerm, ...(fact.aliases || []), ...(fact.typoAliases || [])]
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!terms.some((term) => hasTerm(text, term))) return false;
  if (fact.canonicalTerm === 'science') return /\bwhat\s+is\s+science\b/.test(text);
  if (fact.canonicalTerm === 'law') return /\bscientific law\b|\blaw vs theory\b|\btheory vs law\b/.test(text);
  if (fact.canonicalTerm === 'theory') return /\bscientific theory\b|\blaw vs theory\b|\btheory vs law\b/.test(text);
  return /\b(what|why|how|does|mean|means|is|are|difference|format|formula|steps?|scientific|experiment|variable|data|law|theory)\b/.test(text);
}

function fact(input) {
  return {
    unit: UNIT,
    chunk: CHUNK,
    examples: [],
    nonExamples: [],
    commonMisconceptions: [],
    route: 'direct_answer',
    conceptTutorCandidate: false,
    ...input
  };
}

function responseFact(id, answerTemplate, sourceRefs) {
  return fact({
    id,
    type: 'science_method',
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

function factById(id) {
  return FACTS.find((fact) => fact.id === id);
}

function looksLikeCalculationOrOtherUnitPrompt(text) {
  if (/\d/.test(text) && /\b(calculate|convert|write|solve|determine|density|mass|volume|speed|period|frequency|wavelength|velocity|distance|current|voltage|resistance|power|work|energy|scientific notation|standard notation|km|meters?|grams?|seconds?|celsius|fahrenheit|kelvin)\b/.test(text)) return true;
  return /\b(beaker|bunsen burner|pass stand|safety goggles|goggles|waft|hot glass|broken glass|accuracy|precision|si system|meniscus|measurement|dimensional analysis|conversion factor|picket fence|metric prefix|scientific notation|standard notation|temperature formula|density|wave speed|conservation of mass|what is matter|matter|endothermic|exothermic|series or parallel|open or closed|acceleration|speeding up|circuit|newton|momentum|force|motion|air resistance|electricity|current|falling freely|free fall)\b/.test(text);
}

function looksLikeChemicalChangeEvidencePrompt(text) {
  return /\bevidence\b/.test(text) && /\bchemical change\b/.test(text);
}

function looksLikeMotionContextPrompt(text) {
  if (/\bconstant\s+(?:speed|velocity|slope|acceleration)\b/.test(text)) return true;
  if (/\b(?:speed|velocity)\s+(?:is|stays?|remains?)\s+constant\b/.test(text)) return true;
  if (/\b(?:distance|position|speed|velocity)\s+(?:vs|versus|over|against)\s+time\b/.test(text)) return true;
  if (/\b(?:distance|position|speed|velocity)\s+time\s+graph\b/.test(text)) return true;
  if (/\b(?:distance|position|speed|velocity)\b/.test(text) && /\bgraph\b/.test(text)) return true;
  return false;
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
    .replace(/\bscientfic\b/g, 'scientific')
    .replace(/\bmethode\b/g, 'method')
    .replace(/\bhypotheis\b/g, 'hypothesis')
    .replace(/\bhypothisis\b/g, 'hypothesis')
    .replace(/\bhypotesis\b/g, 'hypothesis')
    .replace(/\bindependant\b/g, 'independent')
    .replace(/\bdependant\b/g, 'dependent')
    .replace(/\bvarible\b/g, 'variable')
    .replace(/\bcontroled\b/g, 'controlled')
    .replace(/\bexperamental\b/g, 'experimental')
    .replace(/\bobservashun\b/g, 'observation')
    .replace(/\binferance\b/g, 'inference')
    .replace(/\bqualatative\b/g, 'qualitative')
    .replace(/\bquantative\b/g, 'quantitative')
    .replace(/\bconclushion\b/g, 'conclusion')
    .replace(/\bsuport\b/g, 'support')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  ALL_UNIT1_SCIENTIFIC_METHOD_FACTS: FACTS,
  UNIT1_SCIENTIFIC_METHOD_PACKET,
  tryUnit1ScientificMethodKnowledge
};
