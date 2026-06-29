const UNIT = 'Unit 1';
const CHUNK = 'graphing-data-analysis';

const FACTS = [
  fact({
    id: 'unit1.graphing.graph',
    type: 'graph_basics',
    canonicalTerm: 'graph',
    aliases: ['graphs', 'graf', 'grap'],
    typoAliases: ['graf', 'grap'],
    studentWording: ['what is a graph'],
    definition: 'A graph is a visual way to organize and display data.',
    use: 'Graphs make data easier to read, compare, and analyze for patterns or trends.',
    examples: ['line graph', 'bar graph', 'pie chart'],
    sourceRefs: ['unit1.corpus.0153'],
    related: ['data table', 'trend', 'axis'],
    answerTemplate: 'A graph is a visual way to organize and display data.'
  }),
  fact({
    id: 'unit1.graphing.data_table',
    type: 'graph_basics',
    canonicalTerm: 'data table',
    aliases: ['data tables'],
    typoAliases: ['data tabel'],
    studentWording: ['what is a data table'],
    definition: 'A data table organizes measurements or observations in rows and columns.',
    use: 'Use a table to list exact data values before graphing or analyzing them.',
    examples: ['trial number, time, and plant height in columns'],
    sourceRefs: ['unit1.corpus.0073', 'unit1.corpus.0153'],
    related: ['graph', 'data'],
    answerTemplate: 'A data table organizes measurements or observations in rows and columns.'
  }),
  fact({
    id: 'unit1.graphing.graph_title',
    type: 'graph_setup',
    canonicalTerm: 'graph title',
    aliases: ['title'],
    typoAliases: [],
    studentWording: ['what is a graph title', 'what should a good graph title include'],
    definition: 'A graph title tells what the graph is about.',
    use: 'A good title usually names both variables or describes the relationship being shown.',
    examples: ['Effect of Sunlight on Plant Growth'],
    sourceRefs: ['unit1.corpus.0153'],
    related: ['x-axis', 'y-axis', 'variables'],
    answerTemplate: 'A graph title tells what the graph is about. A good graph title usually includes both variables or describes the relationship being shown.'
  }),
  fact({
    id: 'unit1.graphing.axis',
    type: 'graph_setup',
    canonicalTerm: 'axis',
    aliases: ['axes'],
    typoAliases: [],
    studentWording: ['what is an axis', 'what are axes'],
    definition: 'An axis is a reference line on a graph used to show values or categories.',
    use: 'Graphs usually use an x-axis and a y-axis.',
    examples: ['horizontal x-axis', 'vertical y-axis'],
    sourceRefs: ['unit1.corpus.0058', 'unit1.corpus.0059', 'unit1.corpus.0153'],
    related: ['x-axis', 'y-axis'],
    answerTemplate: 'An axis is a reference line on a graph used to show values or categories. Axes are the reference lines on a graph, usually the x-axis and y-axis.'
  }),
  fact({
    id: 'unit1.graphing.x_axis',
    type: 'graph_setup',
    canonicalTerm: 'x-axis',
    aliases: ['x axis', 'xaxis'],
    typoAliases: [],
    studentWording: ['what is the x-axis', 'what goes on the x-axis'],
    definition: 'The x-axis is the horizontal axis.',
    use: 'The independent variable usually goes on the x-axis.',
    examples: ['amount of sunlight on the x-axis'],
    sourceRefs: ['unit1.corpus.0058', 'unit1.corpus.0147'],
    related: ['independent variable', 'axis'],
    answerTemplate: 'The x-axis is the horizontal axis. The independent variable usually goes on the x-axis.'
  }),
  fact({
    id: 'unit1.graphing.y_axis',
    type: 'graph_setup',
    canonicalTerm: 'y-axis',
    aliases: ['y axis', 'yaxis'],
    typoAliases: [],
    studentWording: ['what is the y-axis', 'what goes on the y-axis'],
    definition: 'The y-axis is the vertical axis.',
    use: 'The dependent variable usually goes on the y-axis.',
    examples: ['plant growth on the y-axis'],
    sourceRefs: ['unit1.corpus.0059', 'unit1.corpus.0121', 'unit1.corpus.0172'],
    related: ['dependent variable', 'axis'],
    answerTemplate: 'The y-axis is the vertical axis. The dependent variable usually goes on the y-axis.'
  }),
  fact({
    id: 'unit1.graphing.axis_labels',
    type: 'graph_setup',
    canonicalTerm: 'axis labels',
    aliases: ['axes labels', 'axis label', 'axes label', 'labels on graph'],
    typoAliases: [],
    studentWording: ['why do graph axes need labels'],
    definition: 'Axis labels tell what variable is being shown.',
    use: 'Labels make it clear what the x-axis and y-axis represent.',
    examples: ['Time (days)', 'Plant height (cm)'],
    sourceRefs: ['unit1.corpus.0153'],
    related: ['units', 'axis'],
    answerTemplate: 'Graph axes need labels because axis labels tell what variable is being shown.'
  }),
  fact({
    id: 'unit1.graphing.units',
    type: 'graph_setup',
    canonicalTerm: 'graph units',
    aliases: ['units on graph', 'axis units'],
    typoAliases: [],
    studentWording: ['why do graph axes need units'],
    definition: 'Units tell what measurement scale is being used.',
    use: 'Units make graph values understandable.',
    examples: ['centimeters', 'seconds', 'degrees Celsius'],
    sourceRefs: ['unit1.corpus.0153'],
    related: ['axis labels', 'scale'],
    answerTemplate: 'Graph axes need units because units tell what measurement scale is being used.'
  }),
  fact({
    id: 'unit1.graphing.scale',
    type: 'graph_setup',
    canonicalTerm: 'graph scale',
    aliases: ['scale on graph', 'axis scale'],
    typoAliases: [],
    studentWording: ['what is a graph scale'],
    definition: 'A graph scale is the set of numbers used on an axis.',
    use: 'Choose a scale that fits the data and is easy to read.',
    examples: ['counting by 1, 2, 5, or 10 on an axis'],
    sourceRefs: ['unit1.corpus.0087', 'unit1.corpus.0145', 'unit1.corpus.0153'],
    related: ['interval', 'axis'],
    answerTemplate: 'A graph scale is the set of numbers used on an axis.'
  }),
  fact({
    id: 'unit1.graphing.interval',
    type: 'graph_setup',
    canonicalTerm: 'interval',
    aliases: ['graph interval', 'interval on a graph'],
    typoAliases: ['intervel'],
    studentWording: ['what is an interval on a graph', 'why should graph intervals be equal'],
    definition: 'An interval is the amount between each numbered mark on an axis.',
    use: 'Equal intervals keep the graph accurate and easy to interpret.',
    examples: ['0, 2, 4, 6, 8 uses intervals of 2'],
    sourceRefs: ['unit1.corpus.0087', 'unit1.corpus.0145', 'unit1.corpus.0153'],
    related: ['scale', 'axis'],
    answerTemplate: 'An interval is the amount between each numbered mark on an axis. Graph intervals should be equal to keep the graph accurate and easy to interpret.'
  }),
  graphTypeFact({
    id: 'unit1.graphing.line_graph',
    canonicalTerm: 'line graph',
    answerTemplate: 'A line graph is used to show change over time or a continuous relationship. Use a line graph when the data are continuous or show change over time.',
    sourceRefs: ['unit1.corpus.0090', 'unit1.corpus.0148', 'unit1.corpus.0186']
  }),
  graphTypeFact({
    id: 'unit1.graphing.bar_graph',
    canonicalTerm: 'bar graph',
    answerTemplate: 'A bar graph is used to compare categories or groups. Use a bar graph when comparing separate categories.',
    sourceRefs: ['unit1.corpus.0090', 'unit1.corpus.0182']
  }),
  graphTypeFact({
    id: 'unit1.graphing.pie_chart',
    canonicalTerm: 'pie chart',
    aliases: ['pie graph', 'circle graph'],
    answerTemplate: 'A pie chart shows parts or percentages of a whole.',
    sourceRefs: ['unit1.corpus.0090', 'unit1.corpus.0127', 'unit1.corpus.0178']
  }),
  graphTypeFact({
    id: 'unit1.graphing.scatter_plot',
    canonicalTerm: 'scatter plot',
    answerTemplate: 'A scatter plot shows the relationship between two numerical variables.',
    sourceRefs: ['unit1.corpus.0148', 'unit1.corpus.0186']
  }),
  fact({
    id: 'unit1.graphing.best_fit_line',
    type: 'graph_type',
    canonicalTerm: 'best-fit line',
    aliases: ['best fit line', 'line of best fit'],
    typoAliases: [],
    studentWording: ['what is a best-fit line'],
    definition: 'A best-fit line is a line that shows the general trend of scattered data points.',
    use: 'Use it to summarize the pattern in a scatter plot.',
    examples: ['a line through the middle of scattered points'],
    sourceRefs: ['unit1.corpus.0148', 'unit1.corpus.0186'],
    related: ['scatter plot', 'trend'],
    answerTemplate: 'A best-fit line is a line that shows the general trend of scattered data points.'
  }),
  fact({
    id: 'unit1.graphing.trend',
    type: 'data_analysis',
    canonicalTerm: 'trend',
    aliases: ['trand'],
    typoAliases: ['trand'],
    studentWording: ['what is a trend'],
    definition: 'A trend is the general pattern or direction in data.',
    use: 'Trends help describe what the data show overall.',
    examples: ['plant height increases over time'],
    sourceRefs: ['unit1.corpus.0090', 'unit1.corpus.0153', 'unit1.corpus.0186'],
    related: ['pattern', 'relationship'],
    answerTemplate: 'A trend is the general pattern or direction in data.'
  }),
  fact({
    id: 'unit1.graphing.pattern',
    type: 'data_analysis',
    canonicalTerm: 'pattern in data',
    aliases: ['pattern', 'data pattern'],
    typoAliases: [],
    studentWording: ['what is a pattern in data'],
    definition: 'A pattern is something that repeats or a relationship that appears in the data.',
    use: 'Patterns help scientists interpret results.',
    examples: ['as sunlight increases, plant growth increases'],
    sourceRefs: ['unit1.corpus.0153'],
    related: ['trend', 'relationship'],
    answerTemplate: 'A pattern in data is something that repeats or a relationship that appears in the data.'
  }),
  fact({
    id: 'unit1.graphing.relationship',
    type: 'data_analysis',
    canonicalTerm: 'relationship between variables',
    aliases: ['relationship', 'variable relationship'],
    typoAliases: [],
    studentWording: ['what is a relationship between variables'],
    definition: 'A relationship describes how one variable changes as another variable changes.',
    use: 'Relationships can be positive, negative, direct, inverse, or show no clear pattern.',
    examples: ['temperature increases while dissolving time decreases'],
    sourceRefs: ['unit1.corpus.0153'],
    related: ['positive relationship', 'negative relationship'],
    answerTemplate: 'A relationship between variables describes how one variable changes as another variable changes.'
  }),
  relationshipFact('positive relationship', 'A positive relationship means both variables increase together.', ['positve relationship']),
  relationshipFact('negative relationship', 'A negative relationship means one variable increases while the other decreases.', ['negitive relationship']),
  relationshipFact('no relationship', 'No relationship means one variable does not show a clear pattern with the other.', []),
  relationshipFact('direct relationship', 'A direct relationship means both variables increase together or decrease together.', []),
  relationshipFact('inverse relationship', 'An inverse relationship means one variable increases while the other decreases.', []),
  fact({
    id: 'unit1.graphing.analyze_data',
    type: 'data_analysis',
    canonicalTerm: 'analyze data',
    aliases: ['analyzing data', 'data analysis'],
    typoAliases: [],
    studentWording: ['what does it mean to analyze data'],
    definition: 'Analyzing data means looking for patterns, trends, relationships, and meaning.',
    use: 'Analysis helps connect data to a conclusion.',
    examples: ['using a graph to decide whether plant growth changed'],
    sourceRefs: ['unit1.corpus.0096', 'unit1.corpus.0153'],
    related: ['conclusion', 'trend'],
    answerTemplate: 'Analyzing data means looking for patterns, trends, relationships, and meaning.'
  }),
  fact({
    id: 'unit1.graphing.graphs_help_conclusions',
    type: 'data_analysis',
    canonicalTerm: 'graphs help conclusions',
    aliases: ['graphs and conclusions', 'data supports hypothesis'],
    typoAliases: [],
    studentWording: ['how do graphs help with conclusions'],
    definition: 'Graphs help show whether data support or do not support a hypothesis.',
    use: 'Use graph patterns as evidence in a conclusion.',
    examples: ['a line graph showing plant growth increased with sunlight'],
    sourceRefs: ['unit1.corpus.0117', 'unit1.corpus.0153'],
    related: ['conclusion', 'evidence'],
    answerTemplate: 'Graphs help show whether data support or do not support a hypothesis.'
  }),
  fact({
    id: 'unit1.graphing.cer',
    type: 'cer',
    canonicalTerm: 'claim evidence reasoning',
    aliases: ['CER', 'cer'],
    typoAliases: ['clame evidence resonig', 'claim evidence resonig'],
    studentWording: ['what is claim evidence reasoning', 'what is CER'],
    definition: 'Claim-evidence-reasoning is a way to explain an answer using a claim, data or evidence, and reasoning.',
    use: 'Use CER to connect data to an explanation.',
    examples: ['claim, evidence from a graph, reasoning that links the evidence to the claim'],
    sourceRefs: ['unit1.corpus.0153'],
    related: ['claim', 'evidence', 'reasoning'],
    answerTemplate: 'Claim-evidence-reasoning, or CER, is a way to explain an answer using a claim, data or evidence, and reasoning.'
  }),
  cerPartFact('claim', 'A claim is the answer or statement you are trying to support.', ['clame']),
  cerPartFact('evidence in CER', 'Evidence in CER is the data or observations that support the claim.', ['evidense']),
  cerPartFact('reasoning in CER', 'Reasoning in CER explains why the evidence supports the claim.', ['resonig'])
];

function tryUnit1GraphingDataKnowledge(message) {
  const text = normalize(message);
  if (!text) return null;
  if (looksLikeFormulaOrOtherUnitPrompt(text)) return null;

  const fact = findMatchingFact(text);
  if (!fact) return null;

  return {
    type: fact.type === 'data_analysis' || fact.type === 'cer' ? 'science_concept' : 'definition',
    confidence: 'strong',
    toolsUsed: ['unit1_graphing_data_knowledge'],
    notes: `Answered Unit 1 Graphing/Data Analysis fact: ${fact.id}.`,
    directAnswer: fact.answerTemplate,
    aiAllowed: false,
    knowledgeRefs: fact.sourceRefs
  };
}

function findMatchingFact(text) {
  const scenario = matchNarrowAxisScenario(text);
  if (scenario) return scenario;

  if (/\bwhy\b/.test(text) && /\bscientists?\b/.test(text) && /\bgraphs?\b/.test(text)) {
    return responseFact('unit1.graphing.why_graphs', 'Scientists use graphs because graphs make data easier to read, compare, and analyze for patterns or trends.', ['unit1.corpus.0153']);
  }
  if (/\bdata table\b/.test(text) && /\bgraph\b/.test(text) && /\bdifference\b/.test(text)) {
    return responseFact('unit1.graphing.table_graph_difference', 'A data table lists exact values. A graph shows patterns, trends, and comparisons visually.', ['unit1.corpus.0073', 'unit1.corpus.0153']);
  }
  if (/\bgraph title\b/.test(text) || (/\btitle\b/.test(text) && /\bgraph\b/.test(text))) return factById('unit1.graphing.graph_title');
  if (/\btitle\b/.test(text) && /\b(include|good)\b/.test(text)) return factById('unit1.graphing.graph_title');
  if (/\bwhat\s+are\s+axes\b/.test(text)) return factById('unit1.graphing.axis');
  if (/\bwhat\s+is\s+(?:the\s+)?x\s*axis\b/.test(text)) return factById('unit1.graphing.x_axis');
  if (/\bwhat\s+is\s+(?:the\s+)?y\s*axis\b/.test(text)) return factById('unit1.graphing.y_axis');
  if (/\bwhat\s+goes\s+on\s+(?:the\s+)?x\s*axis\b/.test(text) || /\bindependent variable\b.*\bx\s*axis\b/.test(text)) {
    return responseFact('unit1.graphing.x_axis_independent_variable', 'The independent variable usually goes on the x-axis.', ['unit1.corpus.0058', 'unit1.corpus.0147']);
  }
  if (/\bwhat\s+goes\s+on\s+(?:the\s+)?y\s*axis\b/.test(text) || /\bdependent variable\b.*\by\s*axis\b/.test(text)) {
    return responseFact('unit1.graphing.y_axis_dependent_variable', 'The dependent variable usually goes on the y-axis.', ['unit1.corpus.0059', 'unit1.corpus.0121', 'unit1.corpus.0172']);
  }
  if (/\bwhy\b/.test(text) && /\baxes?\b/.test(text) && /\blabels?\b/.test(text)) return factById('unit1.graphing.axis_labels');
  if (/\bwhy\b/.test(text) && /\baxes?\b/.test(text) && /\bunits?\b/.test(text)) return factById('unit1.graphing.units');
  if (/\bwhy\b/.test(text) && /\bintervals?\b/.test(text) && /\bequal\b/.test(text)) return factById('unit1.graphing.interval');
  if (/\bgraph scale\b/.test(text) || /\bscale on graph\b/.test(text)) return factById('unit1.graphing.scale');
  if (/\binterval\b/.test(text) && /\bgraph\b/.test(text)) return factById('unit1.graphing.interval');
  if (/\bwhen\b/.test(text) && /\buse\b/.test(text) && /\bline graph\b/.test(text)) return factById('unit1.graphing.line_graph');
  if (/\bline graph\b/.test(text)) return factById('unit1.graphing.line_graph');
  if (/\bwhen\b/.test(text) && /\buse\b/.test(text) && /\bbar graph\b/.test(text)) return factById('unit1.graphing.bar_graph');
  if (/\bbar graph\b/.test(text)) return factById('unit1.graphing.bar_graph');
  if (/\b(?:pie chart|pie graph|circle graph)\b/.test(text)) return factById('unit1.graphing.pie_chart');
  if (/\bscatter plot\b/.test(text)) return factById('unit1.graphing.scatter_plot');
  if (/\bbest(?:-|\s+)fit line\b|\bline of best fit\b/.test(text)) return factById('unit1.graphing.best_fit_line');
  if (/\bhow\b/.test(text) && /\bgraphs?\b/.test(text) && /\bconclusions?\b/.test(text)) return factById('unit1.graphing.graphs_help_conclusions');
  if (/\bpositive relationship\b/.test(text)) return factById('unit1.graphing.positive_relationship');
  if (/\bnegative relationship\b/.test(text)) return factById('unit1.graphing.negative_relationship');
  if (/\bno relationship\b/.test(text)) return factById('unit1.graphing.no_relationship');
  if (/\bdirect relationship\b/.test(text)) return factById('unit1.graphing.direct_relationship');
  if (/\binverse relationship\b/.test(text)) return factById('unit1.graphing.inverse_relationship');
  if (/\bpattern\b/.test(text) && /\bdata\b/.test(text)) return factById('unit1.graphing.pattern');
  if (/\banalyz(?:e|ing) data\b|\bdata analysis\b/.test(text)) return factById('unit1.graphing.analyze_data');
  if (/\bwhat\s+is\s+cer\b/.test(text) || /\bclaim evidence reasoning\b/.test(text)) return factById('unit1.graphing.cer');
  if (/\bwhat\s+is\s+evidence\b/.test(text) && /\bcer\b/.test(text)) return factById('unit1.graphing.evidence_in_cer');
  if (/\bwhat\s+is\s+reasoning\b/.test(text) && /\bcer\b/.test(text)) return factById('unit1.graphing.reasoning_in_cer');
  if (/\bwhat\s+is\s+a\s+claim\b/.test(text)) return factById('unit1.graphing.claim');

  for (const fact of FACTS) {
    if (matchesFact(text, fact)) return fact;
  }
  return null;
}

function matchNarrowAxisScenario(text) {
  const axis = detectAxisRequest(text);
  if (!axis || !/\bgraph\b/.test(text)) return null;

  if (/\bsunlight\b/.test(text) && /\bplant growth|plants? grow|growth\b/.test(text)) {
    return axisScenarioResponse(
      'sunlight_plant_growth',
      axis,
      axis === 'x'
        ? 'Amount of sunlight goes on the x-axis because it is the independent variable.'
        : 'Plant growth goes on the y-axis because it is the dependent variable.',
      ['unit1.corpus.0058', 'unit1.corpus.0059']
    );
  }
  if (/\bfertilizer\b/.test(text) && /\bplant\b/.test(text) && /\b(height|growth|taller)\b/.test(text)) {
    return axisScenarioResponse(
      'fertilizer_plant_height',
      axis,
      axis === 'x'
        ? 'Type of fertilizer goes on the x-axis because it is the independent variable.'
        : 'Plant height or growth goes on the y-axis because it is the dependent variable.',
      ['unit1.corpus.0058', 'unit1.corpus.0059']
    );
  }
  if (/\btemperature\b/.test(text) && /\bdissolv/.test(text)) {
    return axisScenarioResponse(
      'temperature_dissolving',
      axis,
      axis === 'x'
        ? 'Temperature goes on the x-axis because it is the independent variable.'
        : 'Dissolving rate, or how fast it dissolves, goes on the y-axis because it is the dependent variable.',
      ['unit1.corpus.0058', 'unit1.corpus.0059']
    );
  }
  return null;
}

function detectAxisRequest(text) {
  if (/\bx\s*axis\b/.test(text)) return 'x';
  if (/\by\s*axis\b/.test(text)) return 'y';
  return '';
}

function axisScenarioResponse(id, axis, answerTemplate, sourceRefs) {
  return responseFact(`unit1.graphing.scenario.${id}.${axis}_axis`, answerTemplate, sourceRefs);
}

function matchesFact(text, fact) {
  const terms = [fact.canonicalTerm, ...(fact.aliases || []), ...(fact.typoAliases || [])]
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!terms.some((term) => hasTerm(text, term))) return false;
  if (fact.id === 'unit1.graphing.claim') return /\bwhat\s+is\s+a\s+claim\b/.test(text);
  if (fact.id === 'unit1.graphing.evidence_in_cer') return /\bcer\b/.test(text) || /\bclaim evidence reasoning\b/.test(text);
  if (fact.id === 'unit1.graphing.reasoning_in_cer') return /\bcer\b/.test(text) || /\bclaim evidence reasoning\b/.test(text);
  return /\b(what|why|when|how|does|mean|means|is|are|used|use|goes|axis|axes|graph|data|trend|pattern|relationship|cer|claim|evidence|reasoning)\b/.test(text);
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

function graphTypeFact({ id, canonicalTerm, answerTemplate, sourceRefs, aliases = [] }) {
  return fact({
    id,
    type: 'graph_type',
    canonicalTerm,
    aliases,
    typoAliases: [],
    studentWording: [`what is a ${canonicalTerm} used for`, `when should you use a ${canonicalTerm}`],
    definition: answerTemplate,
    use: answerTemplate,
    sourceRefs,
    related: ['graph types'],
    answerTemplate
  });
}

function relationshipFact(canonicalTerm, answerTemplate, typoAliases) {
  return fact({
    id: `unit1.graphing.${canonicalTerm.replace(/\s+/g, '_')}`,
    type: 'data_analysis',
    canonicalTerm,
    aliases: [],
    typoAliases,
    studentWording: [`what is a ${canonicalTerm}`],
    definition: answerTemplate,
    use: 'Use relationship words to describe the pattern between variables.',
    sourceRefs: ['unit1.corpus.0153'],
    related: ['relationship between variables'],
    answerTemplate
  });
}

function cerPartFact(canonicalTerm, answerTemplate, typoAliases) {
  return fact({
    id: `unit1.graphing.${canonicalTerm.toLowerCase().replace(/\s+/g, '_')}`,
    type: 'cer',
    canonicalTerm,
    aliases: canonicalTerm === 'claim' ? [] : [canonicalTerm.replace(' in CER', '')],
    typoAliases,
    studentWording: [`what is ${canonicalTerm}`],
    definition: answerTemplate,
    use: 'Use CER to explain answers with evidence.',
    sourceRefs: ['unit1.corpus.0153'],
    related: ['claim evidence reasoning'],
    answerTemplate
  });
}

function responseFact(id, answerTemplate, sourceRefs) {
  return fact({
    id,
    type: 'graph_basics',
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

function looksLikeFormulaOrOtherUnitPrompt(text) {
  if (/\d/.test(text) && /\b(calculate|convert|write|solve|determine|density|mass|volume|speed|period|frequency|wavelength|velocity|distance|current|voltage|resistance|power|work|energy|scientific notation|standard notation|km|meters?|grams?|seconds?|celsius|fahrenheit|kelvin)\b/.test(text)) return true;
  return /\b(beaker|bunsen burner|pass stand|safety goggles|goggles|waft|hot glass|broken glass|accuracy|precision|si system|meniscus|measurement|dimensional analysis|conversion factor|picket fence|metric prefix|scientific notation|standard notation|temperature formula|density|wave speed|conservation of mass|what is matter|matter|endothermic|exothermic|series or parallel|open or closed|acceleration|speeding up|circuit|newton|momentum|force|air resistance|electricity|current|night vision|remote controls|electromagnetic|slope|velocity time|position time|distance time|frequency|period|wavelength)\b/.test(text);
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
    .replace(/\bgraf\b/g, 'graph')
    .replace(/\bgrap\b/g, 'graph')
    .replace(/\bgraffing\b/g, 'graphing')
    .replace(/\btabel\b/g, 'table')
    .replace(/\bxaxis\b/g, 'x axis')
    .replace(/\byaxis\b/g, 'y axis')
    .replace(/\bindependant\b/g, 'independent')
    .replace(/\bdependant\b/g, 'dependent')
    .replace(/\bintervel\b/g, 'interval')
    .replace(/\btrand\b/g, 'trend')
    .replace(/\bpositve\b/g, 'positive')
    .replace(/\bnegitive\b/g, 'negative')
    .replace(/\bclame\b/g, 'claim')
    .replace(/\bevidense\b/g, 'evidence')
    .replace(/\bresonig\b/g, 'reasoning')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  ALL_UNIT1_GRAPHING_DATA_FACTS: FACTS,
  tryUnit1GraphingDataKnowledge
};
