const fs = require('node:fs');
const path = require('node:path');
const {
  loadMissouriStandardsBank,
  matchQuestionToStandards
} = require('./standardsMatcher');

const DEFAULT_CONTEXT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'knowledge',
  'standards',
  'standards_student_context.json'
);

const NO_CONTEXT_MESSAGE = 'Ask a science question first, then I can connect that answer to a standard.';
const NO_FULL_STANDARD_CONTEXT_MESSAGE = 'Ask a science question first, then I can read the full standard connected to it.';
const NO_WHY_CONTEXT_MESSAGE = 'Ask a science question first, then I can explain why it matters.';
const NO_STRONG_MATCH_MESSAGE = 'I do not have a strong standard match for that yet.';
const STANDARDS_CLARIFICATION_LIMIT = 3;

const STANDARD_CATEGORY_CLUES = {
  forces: {
    keywords: [
      'force', 'forces', 'motion', 'acceleration', 'mass', 'newton', 'speed',
      'collision', 'momentum', 'net force', 'velocity', 'inertia', 'gravity',
      'weight', 'falling', 'fall', 'g', 'force of gravity', 'fg'
    ],
    whyThisMatters: 'This matters because it helps explain car crashes, seatbelts, sports, ramps, falling objects, weight, satellites, and why objects speed up, slow down, or change direction.'
  },
  energy: {
    keywords: [
      'energy', 'kinetic', 'potential', 'thermal', 'transfer', 'work', 'power',
      'heat', 'fuel', 'electricity'
    ],
    whyThisMatters: 'This matters because energy explains everyday things like why moving objects can cause damage, why machines need fuel or electricity, and why some things heat up when they move or rub together.'
  },
  waves: {
    keywords: [
      'wave', 'waves', 'frequency', 'wavelength', 'amplitude', 'sound', 'light',
      'signal', 'radio', 'wifi', 'bluetooth'
    ],
    whyThisMatters: 'This matters because waves are how sound, light, phones, Wi-Fi, Bluetooth, radios, and medical imaging move information or energy.'
  },
  matter: {
    keywords: [
      'atom', 'atoms', 'element', 'periodic table', 'electron', 'proton',
      'neutron', 'bond', 'reaction', 'chemistry', 'matter', 'molecule',
      'compound', 'substance', 'density', 'volume', 'mass', 'measurement',
      'measure'
    ],
    whyThisMatters: 'This matters because matter and measurement explain real things like why some objects float or sink, why materials behave differently, why metals conduct electricity, how recipes and mixtures work, and how scientists compare substances.'
  },
  life: {
    keywords: [
      'life', 'cell', 'cells', 'organism', 'organisms', 'body system',
      'photosynthesis', 'cellular respiration', 'ecosystem', 'genetics',
      'inheritance', 'trait', 'traits', 'dna', 'evolution', 'natural selection'
    ],
    whyThisMatters: 'This matters because life science explains how living things work, grow, pass on traits, get energy, and interact with the environment.'
  },
  earthSpace: {
    keywords: [
      'gravity', 'orbit', 'planet', 'solar system', 'earth', 'space', 'weather',
      'climate', 'season', 'storm', 'satellite', 'tide'
    ],
    whyThisMatters: 'This matters because gravity, Earth systems, weather, and space patterns affect real things like seasons, storms, satellites, tides, and climate.'
  },
  engineering: {
    keywords: [
      'engineering', 'design', 'test', 'solution', 'criteria', 'constraints',
      'prototype', 'optimize', 'improve', 'model'
    ],
    whyThisMatters: 'This matters because engineering is how people design, test, and improve real solutions, from bridges and helmets to robots and phone apps.'
  }
};

const STANDARD_CHOICE_LABEL_RULES = {
  forces: [
    {
      topic: 'Forces and motion',
      clue: 'how force, mass, and acceleration explain why objects speed up or slow down',
      patterns: ['9-12.ps2.a.1', 'ps2.a.1']
    },
    {
      topic: 'Momentum',
      clue: 'how moving objects transfer motion during collisions or impacts',
      patterns: ['9-12.ps2.a.2', 'ps2.a.2']
    },
    {
      topic: 'Momentum',
      clue: 'how moving objects transfer motion during collisions or impacts',
      patterns: ['momentum', 'collision', 'colliding', 'impact']
    },
    {
      topic: 'Collisions',
      clue: 'how crashes, impacts, and safety designs depend on forces and motion',
      patterns: ['crash', 'bumper', 'seatbelt', 'impact', 'collision safety']
    },
    {
      topic: "Newton's laws",
      clue: 'why forces make objects speed up, slow down, or change direction',
      patterns: ['newton', 'net force', 'force equals mass', 'f = ma', 'mass and acceleration']
    },
    {
      topic: 'Forces and motion',
      clue: 'how force, mass, and acceleration explain why objects speed up or slow down',
      patterns: ['force', 'forces', 'motion', 'acceleration', 'mass', 'speed', 'velocity']
    }
  ],
  energy: [
    {
      topic: 'Energy and forces',
      clue: 'how energy changes when objects push, pull, attract, or repel each other',
      patterns: ['9-12.ps3.c.1', 'ps3.c.1']
    },
    {
      topic: 'Energy transfer',
      clue: 'how energy moves from one object or system to another',
      patterns: ['9-12.ps3.b.1', 'ps3.b.1']
    },
    {
      topic: 'Kinetic and potential energy',
      clue: 'how motion and position store or change energy',
      patterns: ['9-12.ps3.a.1', '9-12.ps3.a.2', 'ps3.a.1', 'ps3.a.2']
    },
    {
      topic: 'Energy and forces',
      clue: 'how energy changes when objects push, pull, attract, or repel each other',
      patterns: ['relationship between energy and forces', 'field interactions', 'forces between objects', 'electric field', 'magnetic field', 'charged objects']
    },
    {
      topic: 'Energy transfer',
      clue: 'how energy moves from one object or system to another',
      patterns: ['energy transfer', 'thermal energy transfer', 'heat transfer', 'different temperatures', 'uniform energy distribution', 'second law']
    },
    {
      topic: 'Power',
      clue: 'how the rate of energy transfer tells how quickly work gets done',
      patterns: ['power', 'work per time', 'energy per time']
    },
    {
      topic: 'Kinetic and potential energy',
      clue: 'how motion and position store or change energy',
      patterns: ['definitions of energy', 'kinetic', 'potential', 'ke =', 'pe =', 'motion', 'position', 'gravitational']
    }
  ],
  waves: [
    {
      topic: 'Wave properties',
      clue: 'how frequency, wavelength, and speed describe waves like sound and light',
      patterns: ['9-12.ps4.a.1', 'ps4.a.1']
    },
    {
      topic: 'Electromagnetic radiation',
      clue: 'how light, radio waves, phones, Wi-Fi, and medical imaging use waves',
      patterns: ['electromagnetic', 'radiation', 'radio', 'wifi', 'wi-fi', 'bluetooth', 'medical imaging', 'x-ray']
    },
    {
      topic: 'Light and sound',
      clue: 'how sound and light move energy or information through different materials',
      patterns: ['light', 'sound', 'medium', 'media']
    },
    {
      topic: 'Wave properties',
      clue: 'how frequency, wavelength, and speed describe waves like sound and light',
      patterns: ['wave properties', 'frequency', 'wavelength', 'wave speed', 'v = f', 'amplitude']
    }
  ],
  matter: [
    {
      topic: 'Atoms and the periodic table',
      clue: 'how electron patterns help predict how elements behave',
      patterns: ['9-12.ps1.a.1', 'ps1.a.1']
    },
    {
      topic: 'Conservation of matter',
      clue: 'how balanced equations show atoms are not lost during reactions',
      patterns: ['9-12.ps1.b.3', 'ps1.b.3']
    },
    {
      topic: 'Conservation of matter',
      clue: 'how balanced equations show atoms are not lost during reactions',
      patterns: ['conservation of mass', 'conservation of matter', 'balanced equations', 'balance chemical equations', 'atoms are conserved', 'stoichiometry']
    },
    {
      topic: 'Chemical reactions',
      clue: 'why substances react and how atoms rearrange into new substances',
      patterns: ['chemical reactions', 'reaction', 'reactants', 'products', 'chemical equation', 'equilibrium']
    },
    {
      topic: 'Atoms and the periodic table',
      clue: 'how electron patterns help predict how elements behave',
      patterns: ['periodic table', 'periodic trends', 'electron patterns', 'valence electrons', 'element properties', 'atomic number']
    },
    {
      topic: 'Bonding and materials',
      clue: 'why atoms connect in different ways and why materials behave differently',
      patterns: ['bond', 'bonding', 'materials', 'molecule', 'compound', 'properties of matter']
    }
  ],
  life: [
    {
      topic: 'Photosynthesis',
      clue: 'how plants turn light into stored chemical energy',
      patterns: ['9-12.ls1.c.1', 'ls1.c.1']
    },
    {
      topic: 'Photosynthesis',
      clue: 'how plants turn light into stored chemical energy',
      patterns: ['photosynthesis', 'light energy', 'stored chemical energy']
    },
    {
      topic: 'Cellular respiration',
      clue: 'how living things release energy from food',
      patterns: ['cellular respiration', 'release energy', 'food energy']
    },
    {
      topic: 'Genetics',
      clue: 'how living things pass traits from parents to offspring',
      patterns: ['genetics', 'inheritance', 'trait', 'traits', 'dna', 'chromosome']
    },
    {
      topic: 'Evolution',
      clue: 'how populations change over time when traits affect survival and reproduction',
      patterns: ['evolution', 'natural selection', 'adaptation', 'population']
    },
    {
      topic: 'Ecosystems',
      clue: 'how living things get energy and interact with the environment',
      patterns: ['ecosystem', 'food web', 'food chain', 'population', 'community', 'environment']
    },
    {
      topic: 'Cells',
      clue: 'how cell parts help living things work, grow, and stay alive',
      patterns: ['cell', 'cells', 'cell structure', 'mitosis']
    },
    {
      topic: 'Body systems',
      clue: 'how organs and systems work together to keep organisms alive',
      patterns: ['body system', 'organ', 'homeostasis']
    }
  ],
  earthSpace: [
    {
      topic: 'Gravity and space',
      clue: 'how gravity helps explain orbits, moons, planets, and satellites',
      patterns: ['9-12.ess1.a.3', '9-12.ess1.b.1', 'ess1.a.3', 'ess1.b.1']
    },
    {
      topic: 'Gravity and space',
      clue: 'how gravity helps explain orbits, moons, planets, and satellites',
      patterns: ['gravity', 'orbit', 'orbital', 'moon', 'planet', 'satellite', 'kepler', 'solar system']
    },
    {
      topic: 'Weather and climate',
      clue: 'how storms, climate patterns, air, and water affect daily life',
      patterns: ['weather', 'climate', 'storm', 'air mass', 'atmosphere', 'precipitation']
    },
    {
      topic: 'Plate tectonics',
      clue: 'how moving plates explain earthquakes, volcanoes, mountains, and ocean floors',
      patterns: ['plate tectonics', 'plate boundary', 'earthquake', 'volcano', 'mountain', 'ocean floor']
    },
    {
      topic: 'Natural resources',
      clue: 'how people use Earth materials and how those choices affect the environment',
      patterns: ['natural resources', 'resource', 'mineral', 'fossil fuel', 'water supply']
    },
    {
      topic: 'Earth systems',
      clue: 'how rocks, water, air, life, and energy interact on Earth',
      patterns: ['earth systems', 'geosphere', 'hydrosphere', 'biosphere', 'atmosphere', 'water cycle']
    }
  ],
  engineering: [
    {
      topic: 'Engineering design',
      clue: 'how people define problems, test ideas, and improve real solutions',
      patterns: ['9-12.ets1.a', 'ets1.a']
    },
    {
      topic: 'Testing solutions',
      clue: 'how people compare designs using evidence, trade-offs, cost, safety, and reliability',
      patterns: ['evaluate', 'test', 'testing', 'trade-offs', 'criteria', 'cost', 'safety', 'reliability']
    },
    {
      topic: 'Improving designs',
      clue: 'how people use results to make designs work better',
      patterns: ['optimize', 'improve', 'improving', 'prototype', 'redesign']
    },
    {
      topic: 'Engineering design',
      clue: 'how people define problems, test ideas, and improve real solutions',
      patterns: ['engineering', 'design', 'solution', 'constraints', 'criteria', 'problem']
    }
  ]
};

const GENERIC_WHY_THIS_MATTERS =
  'This matters because it connects the question to real situations you can observe, test, or explain outside of class.';

function isStandardsFollowUp(message) {
  const text = normalizeText(message).toLowerCase();
  if (!text) return false;

  return [
    /\bstandards?\b/,
    /\bstandereds?\b/,
    /\bstanderds?\b/,
    /\bstanders?\b/,
    /^what standard is (this|that)\??$/,
    /^what standard does (this|that) belong to\??$/,
    /^what standard does (this|that) match\??$/,
    /^what is this over\??$/,
    /^what is this about\??$/,
    /^what topic is this\??$/,
    /^what learning target\b/,
    /^what objective\b/,
    /^what skill is this\??$/,
    /^what are we learning\??$/,
    /\bi can statement\b/,
    /\blearning goal\b/,
    /^what is the i can statement\??$/,
    /^what learning target is (this|that)\??$/
  ].some((pattern) => pattern.test(text));
}

function isFullStandardFollowUp(message) {
  const text = normalizeText(message).toLowerCase();
  if (!text) return false;

  return [
    /^read (the )?full stand(?:ard|ered|erd|erds|er|ers)s?\??$/,
    /^read (the )?stand(?:ard|ered|erd|erds|er|ers)s?\??$/,
    /^show (me )?(the )?full stand(?:ard|ered|erd|erds|er|ers)s?\??$/,
    /^show (me )?(the )?official stand(?:ard|ered|erd|erds|er|ers)s?\??$/,
    /^what is (the )?full stand(?:ard|ered|erd|erds|er|ers)s?\??$/,
    /^full stand(?:ard|ered|erd|erds|er|ers)s?\??$/,
    /^official stand(?:ard|ered|erd|erds|er|ers)s?\??$/,
    /^what does (the )?stand(?:ard|ered|erd|erds|er|ers)s? (actually )?say\??$/
  ].some((pattern) => pattern.test(text));
}

function isWhyThisMattersFollowUp(message) {
  const text = normalizeText(message).toLowerCase();
  if (!text) return false;

  return [
    /^what'?s the point\??$/,
    /^what is the point\??$/,
    /^why does (this|that|it) matter\??$/,
    /^why is (this|that|it) important\??$/,
    /^why should i care\??$/,
    /^what is this useful for\??$/,
    /^how is this useful\??$/
  ].some((pattern) => pattern.test(text));
}

function isInstructionalFollowUpPrompt(message) {
  const text = normalizeText(message);
  if (!text) return false;

  return isWhyThisMattersFollowUp(text) ||
    isFullStandardFollowUp(text) ||
    isStandardsFollowUp(text) ||
    /^\d+$/.test(text);
}

function answerStandardsFollowUp(message, contextQuestion, options = {}) {
  if (!isStandardsFollowUp(message)) return null;

  const previousQuestion = normalizeText(contextQuestion);
  const previousAnswer = normalizeText(options.contextAnswer || options.lastAnsweredAnswer || '');
  const contextText = normalizeText([previousQuestion, previousAnswer].filter(Boolean).join(' '));

  if (isFullStandardFollowUp(message)) {
    return answerFullStandardFollowUp(contextText, options);
  }

  if (!contextText) {
    return {
      handled: true,
      response: NO_CONTEXT_MESSAGE,
      matched: false,
      reason: 'no_context'
    };
  }

  const matcher = options.matcher || matchQuestionToStandards;
  const match = matcher(contextText, options.matcherOptions || {});
  const standards = Array.isArray(match?.standards) ? match.standards : [];
  const clarificationCandidates = getClarificationCandidates(match, contextText);

  if (clarificationCandidates.length > 1) {
    const choices = buildStandardsClarificationChoices(clarificationCandidates, options);

    if (choices.length > 1) {
      return {
        handled: true,
        response: formatStandardsClarificationPrompt(choices),
        matched: false,
        reason: 'multiple_standard_matches',
        match,
        pendingClarification: {
          id: 'standards_followup',
          kind: 'standards',
          invalidChoiceMessage: `Please type one of the choices listed, like ${formatChoiceList(choices)}.`,
          choices
        }
      };
    }
  }

  const contextStandard = findContextStandard(previousQuestion, previousAnswer, match, options);
  if (contextStandard) {
    const context = loadStudentContext(options.contextPath || DEFAULT_CONTEXT_PATH)[contextStandard.standardId] || {};
    return {
      handled: true,
      response: formatStandardsAnswer(contextStandard, context),
      matched: true,
      standardId: contextStandard.standardId,
      match,
      reason: 'context_standard'
    };
  }

  if (match?.confidence !== 'strong' || standards.length !== 1) {
    return {
      handled: true,
      response: NO_STRONG_MATCH_MESSAGE,
      matched: false,
      reason: 'no_strong_match',
      match
    };
  }

  const standardId = standards[0].standardId;
  const standard = findStandardById(standardId, options);

  if (!standard) {
    return {
      handled: true,
      response: NO_STRONG_MATCH_MESSAGE,
      matched: false,
      reason: 'missing_standard',
      match
    };
  }

  const context = loadStudentContext(options.contextPath || DEFAULT_CONTEXT_PATH)[standardId] || {};
  const response = formatStandardsAnswer(standard, context);

  return {
    handled: true,
    response,
    matched: true,
    standardId,
    match
  };
}

function answerFullStandardFollowUp(contextText, options = {}) {
  const selectedStandard = options.currentStandardId ? findStandardById(options.currentStandardId, options) : null;
  if (selectedStandard) {
    return {
      handled: true,
      response: formatFullStandardAnswer(selectedStandard),
      matched: true,
      standardId: selectedStandard.standardId,
      reason: 'selected_standard'
    };
  }

  if (!contextText) {
    return {
      handled: true,
      response: NO_FULL_STANDARD_CONTEXT_MESSAGE,
      matched: false,
      reason: 'no_context'
    };
  }

  const matcher = options.matcher || matchQuestionToStandards;
  const match = matcher(contextText, options.matcherOptions || {});
  const explicitContextId = getContextStandardId(contextText.toLowerCase());
  const explicitContextStandard = explicitContextId ? findStandardById(explicitContextId, options) : null;

  if (explicitContextStandard) {
    return {
      handled: true,
      response: formatFullStandardAnswer(explicitContextStandard),
      matched: true,
      standardId: explicitContextStandard.standardId,
      match,
      reason: 'context_standard'
    };
  }

  const clarificationCandidates = getClarificationCandidates(match, contextText);
  if (clarificationCandidates.length > 1) {
    const choices = buildStandardsClarificationChoices(clarificationCandidates, {
      ...options,
      fullStandard: true
    });

    if (choices.length > 1) {
      return {
        handled: true,
        response: formatFullStandardsClarificationPrompt(choices),
        matched: false,
        reason: 'multiple_standard_matches',
        match,
        pendingClarification: {
          id: 'standards_full_followup',
          kind: 'standards',
          invalidChoiceMessage: `Please type one of the choices listed, like ${formatChoiceList(choices)}.`,
          choices
        }
      };
    }
  }

  const contextStandard = findContextStandard('', contextText, match, options);
  if (contextStandard) {
    return {
      handled: true,
      response: formatFullStandardAnswer(contextStandard),
      matched: true,
      standardId: contextStandard.standardId,
      match,
      reason: 'context_standard'
    };
  }

  const standards = Array.isArray(match?.standards) ? match.standards : [];
  if (match?.confidence === 'strong' && standards.length === 1) {
    const standard = findStandardById(standards[0].standardId, options);
    if (standard) {
      return {
        handled: true,
        response: formatFullStandardAnswer(standard),
        matched: true,
        standardId: standard.standardId,
        match
      };
    }
  }

  return {
    handled: true,
    response: NO_STRONG_MATCH_MESSAGE,
    matched: false,
    reason: 'no_strong_match',
    match
  };
}

function findContextStandard(previousQuestion, previousAnswer, match, options = {}) {
  const contextText = normalizeText([previousQuestion, previousAnswer].filter(Boolean).join(' ')).toLowerCase();
  if (!contextText) return null;

  const rankedCandidate = getClarificationCandidates(match, contextText)[0];
  if (rankedCandidate?.standardId) {
    const standard = findStandardById(rankedCandidate.standardId, options);
    if (standard) return standard;
  }

  const fallbackId = getContextStandardId(contextText);
  return fallbackId ? findStandardById(fallbackId, options) : null;
}

function getContextStandardId(contextText) {
  if (/\b(force of gravity|gravity|weight|falling|falls?|fg|g\s*=|9\.8|newtons? second|f\s*=|force equals mass)\b/.test(contextText)) {
    return '9-12.PS2.A.1';
  }

  if (/\b(density|mass per volume|g\/ml|g\/cm|kg\/m|float|sink|physical propert(y|ies)|compare substances)\b/.test(contextText)) {
    return '9-12.PS1.A.3';
  }

  if (/\b(power|work\/time|work per time|energy per time|watt|watts|p\s*=|electrical power|voltage|current)\b/.test(contextText)) {
    return '9-12.PS3.A.1';
  }

  if (/\b(nacl|sodium chloride|table salt|ionic compound|hydrogen|element|periodic table|atoms?|molecule|chemical symbol|atomic)\b/.test(contextText)) {
    return '9-12.PS1.A.1';
  }

  return '';
}

function answerWhyThisMattersFollowUp(contextQuestion, options = {}) {
  const previousQuestion = normalizeText(contextQuestion);
  const previousAnswer = normalizeText(options.contextAnswer || options.lastAnsweredAnswer || '');
  const contextText = normalizeText([previousQuestion, previousAnswer].filter(Boolean).join(' '));

  if (!contextText) {
    return {
      handled: true,
      response: NO_WHY_CONTEXT_MESSAGE,
      matched: false,
      reason: 'no_context'
    };
  }

  const matcher = options.matcher || matchQuestionToStandards;
  const match = matcher(previousQuestion || contextText, options.matcherOptions || {});
  const candidate = getBestWhyThisMattersCandidate(match, contextText);

  if (candidate?.standardId) {
    const standard = findStandardById(candidate.standardId, options);
    if (standard) {
      return {
        handled: true,
        response: formatWhyThisMattersAnswer(standard),
        matched: true,
        standardId: standard.standardId,
        match
      };
    }
  }

  const categoryWhy = getWhyThisMattersForContext(contextText);
  if (categoryWhy) {
    return {
      handled: true,
      response: formatWhyThisMattersText(categoryWhy),
      matched: true,
      reason: 'category_context',
      match
    };
  }

  return {
    handled: true,
    response: NO_WHY_CONTEXT_MESSAGE,
    matched: false,
    reason: candidate?.standardId ? 'missing_standard' : 'no_useful_context',
    match
  };
}

function getBestWhyThisMattersCandidate(match, contextText = '') {
  const confidence = match?.confidence || 'none';
  const standards = Array.isArray(match?.standards) ? match.standards : [];
  const possibleStandards = Array.isArray(match?.possibleStandards) ? match.possibleStandards : [];

  if (standards.length === 1 && confidence === 'strong') return standards[0];

  const candidates = getClarificationCandidates(match, contextText);
  if (candidates.length > 0) return candidates[0];

  const hasScienceContext = Array.isArray(match?.matchedConcepts) && match.matchedConcepts.length > 0
    || Array.isArray(match?.units) && match.units.length > 0;

  if (['strong', 'medium'].includes(confidence) && standards.length > 0) {
    return rankStandardCandidates(standards, contextText)[0];
  }

  if ((confidence === 'weak' && (hasScienceContext || getStandardCategoryFromText(contextText))) || confidence === 'medium') {
    return rankStandardCandidates(possibleStandards, contextText)[0];
  }

  return null;
}

function getClarificationCandidates(match, contextText = '') {
  const confidence = match?.confidence || 'none';
  const hasScienceContext = Array.isArray(match?.matchedConcepts) && match.matchedConcepts.length > 0
    || Array.isArray(match?.units) && match.units.length > 0;

  if (!['strong', 'medium'].includes(confidence) && !(confidence === 'weak' && hasScienceContext)) {
    return [];
  }

  const standards = Array.isArray(match?.standards) ? match.standards : [];
  if (standards.length > 1) {
    return rankStandardCandidates(standards, contextText).slice(0, STANDARDS_CLARIFICATION_LIMIT);
  }

  const possibleStandards = Array.isArray(match?.possibleStandards) ? match.possibleStandards : [];
  if (standards.length === 0 && possibleStandards.length > 1) {
    return diversifyStandardCandidates(rankStandardCandidates(possibleStandards, contextText))
      .slice(0, STANDARDS_CLARIFICATION_LIMIT);
  }

  return [];
}

function rankStandardCandidates(matches, contextText = '') {
  return matches
    .map((match, index) => ({
      match,
      index,
      score: scoreStandardCategoryClues(match, contextText)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map((entry) => entry.match);
}

function scoreStandardCategoryClues(standardLike = {}, contextText = '') {
  const contextCategory = getStandardCategoryFromText(contextText);
  const standardCategory = getStandardCategory(standardLike);

  let score = 0;
  if (contextCategory && standardCategory === contextCategory) score += 20;

  const context = normalizeText(contextText).toLowerCase();
  const standardText = getStandardSearchText(standardLike);

  for (const [category, categoryData] of Object.entries(STANDARD_CATEGORY_CLUES)) {
    const contextHits = countKeywordHits(context, categoryData.keywords);
    const standardHits = countKeywordHits(standardText, categoryData.keywords);
    if (contextHits > 0 && standardHits > 0) {
      score += contextHits * standardHits;
      if (category === standardCategory) score += contextHits * 3;
    }
  }

  return score;
}

function diversifyStandardCandidates(matches) {
  const seen = new Set();
  const diverse = [];

  for (const match of matches) {
    const key = normalizeText(match.conceptTitle || match.unit || match.classroomArea || match.label || match.standardId);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    diverse.push(match);
  }

  if (diverse.length >= STANDARDS_CLARIFICATION_LIMIT) return diverse;

  for (const match of matches) {
    if (diverse.some((candidate) => candidate.standardId === match.standardId)) continue;
    diverse.push(match);
  }

  return diverse;
}

function buildStandardsClarificationChoices(matches, options = {}) {
  return matches
    .map((match, index) => {
      const standard = findStandardById(match.standardId, options);
      if (!standard) return null;

      const context = loadStudentContext(options.contextPath || DEFAULT_CONTEXT_PATH)[standard.standardId] || {};
      return {
        number: index + 1,
        label: formatStandardChoiceLabel(standard, match),
        standardId: standard.standardId,
        intent: 'standards_followup',
        answer: options.fullStandard ? formatFullStandardAnswer(standard) : formatStandardsAnswer(standard, context),
        notes: `Answered selected standards clarification choice ${index + 1} for ${standard.standardId}.`,
        toolsUsed: ['standards_followup_rules']
      };
    })
    .filter(Boolean);
}

function formatFullStandardsClarificationPrompt(choices) {
  return [
    'I found more than one possible standard. Type the number of the one you want me to read.',
    '',
    ...choices.map((choice) => `${choice.number}. ${choice.label}`),
    '',
    `Type ${formatChoiceList(choices)}.`
  ].join('\n');
}

function formatStandardsClarificationPrompt(choices) {
  return [
    'This could match more than one standard.',
    '',
    ...choices.map((choice) => `${choice.number}. ${choice.label}`),
    '',
    `Type ${formatChoiceList(choices)}.`
  ].join('\n');
}

function formatStandardChoiceLabel(standard, match = {}) {
  const label = getStudentFriendlyStandardChoiceLabel(standard, match);
  return `${label.topic} — ${label.clue}`;
}

function getStudentFriendlyStandardChoiceLabel(standard = {}, match = {}) {
  const category = getStandardCategory({ ...standard, ...match }) || getStandardCategory(standard) || getStandardCategory(match);
  const searchText = getStandardSearchText({ ...standard, ...match });
  const rules = STANDARD_CHOICE_LABEL_RULES[category] || [];
  const matchedRule = rules.find((rule) => rule.patterns.some((pattern) => searchText.includes(normalizeText(pattern).toLowerCase())));

  if (matchedRule) {
    return {
      topic: matchedRule.topic,
      clue: matchedRule.clue
    };
  }

  const categoryFallbacks = {
    forces: {
      topic: 'Forces and motion',
      clue: 'how forces change motion in real situations'
    },
    energy: {
      topic: 'Energy',
      clue: 'how motion, position, heat, and energy changes explain real events'
    },
    waves: {
      topic: 'Waves',
      clue: 'how sound, light, frequency, wavelength, and signals work'
    },
    matter: {
      topic: 'Matter and chemistry',
      clue: 'why materials behave differently, why substances react, and how atoms rearrange'
    },
    life: {
      topic: 'Life science',
      clue: 'how living things work, grow, pass on traits, get energy, and interact with the environment'
    },
    earthSpace: {
      topic: 'Earth and space',
      clue: 'how seasons, storms, satellites, climate, rocks, water, and Earth systems affect daily life'
    },
    engineering: {
      topic: 'Engineering design',
      clue: 'how people define problems, test ideas, and improve real solutions'
    }
  };

  if (categoryFallbacks[category]) return categoryFallbacks[category];

  return {
    topic: cleanStandardChoiceTopic(match.unit || match.label || standard.teacherShortName || standard.unit || standard.conceptTitle || 'Standard'),
    clue: 'what this standard is asking you to understand or explain'
  };
}

function cleanStandardChoiceTopic(value) {
  return cleanSentence(value)
    .replace(/\s+in\s+.+$/i, '')
    .replace(/\.$/, '') || 'Standard';
}

function formatChoiceList(choices) {
  const numbers = choices.map((choice) => choice.number);
  if (numbers.length <= 2) return numbers.join(' or ');

  return `${numbers.slice(0, -1).join(', ')}, or ${numbers[numbers.length - 1]}`;
}

function findStandardById(standardId, options = {}) {
  const bank = options.bank || loadMissouriStandardsBank(options.bankPath);
  const standards = Array.isArray(bank?.standards) ? bank.standards : [];
  return standards.find((standard) => standard.standardId === standardId) || null;
}

function loadStudentContext(contextPath = DEFAULT_CONTEXT_PATH) {
  try {
    if (!fs.existsSync(contextPath)) return {};
    const raw = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function formatStandardsAnswer(standard, context = {}) {
  const canStatement = cleanSentence(
    context.studentCanStatementOverride ||
    standard.studentCanStatement ||
    standard.studentFriendlyStandard ||
    `I can explain ${standard.conceptTitle || 'this science idea'}.`
  );
  const shortSummary = cleanSentence(
    context.shortSummary ||
    standard.teacherShortName ||
    standard.statement ||
    standard.conceptTitle ||
    'This standard connects to a science skill.'
  );
  const whyImportant = cleanSentence(
    getWhyThisMattersForStandard(standard) ||
    context.whyImportant ||
    GENERIC_WHY_THIS_MATTERS
  );

  return [
    'I can statement:',
    canStatement,
    '',
    'Standard code:',
    standard.standardId,
    '',
    'Short summary:',
    shortSummary,
    '',
    'Why this matters:',
    whyImportant,
    '',
    'Want the full standard? Ask: "Read the full standard."'
  ].join('\n');
}

function formatFullStandardAnswer(standard = {}) {
  const shortSummary = cleanSentence(
    standard.teacherShortName ||
    standard.statement ||
    standard.conceptTitle ||
    'This standard connects to a science skill.'
  );
  const officialWording = cleanSentence(
    standard.officialStandard ||
    standard.officialText ||
    standard.statement ||
    'Official wording is not available in the local standards bank.'
  );

  return [
    'Full standard',
    '',
    'Standard code:',
    standard.standardId || 'Unknown',
    '',
    'Short summary:',
    shortSummary,
    '',
    'Official wording:',
    officialWording
  ].join('\n');
}

function formatWhyThisMattersAnswer(standard = {}) {
  const whyImportant = cleanSentence(getWhyThisMattersForStandard(standard) || GENERIC_WHY_THIS_MATTERS);
  return formatWhyThisMattersText(whyImportant);
}

function formatWhyThisMattersText(whyImportant) {
  return [
    "What's the point?",
    '',
    cleanSentence(whyImportant)
  ].join('\n');
}

function getWhyThisMattersForStandard(standard = {}) {
  if (standard.standardId === '9-12.PS2.B.1') {
    return 'This matters because gravity affects real things like falling objects, weight, sports, ramps, cars, satellites, and why objects speed up as they fall.';
  }

  const category = getStandardCategory(standard);
  return category ? STANDARD_CATEGORY_CLUES[category].whyThisMatters : GENERIC_WHY_THIS_MATTERS;
}

function getWhyThisMattersForContext(text = '') {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return '';

  if (/\b(force of gravity|gravity|weight|falling|falls?|fg|g\s*=|9\.8)\b/.test(normalized)) {
    return 'This matters because gravity affects real things like falling objects, weight, sports, ramps, cars, satellites, and why objects speed up as they fall.';
  }

  if (/\b(power|work|energy per time|watt|watts|electricity|voltage|current)\b/.test(normalized)) {
    return 'This matters because power tells how quickly energy is used or transferred, which explains real things like engines, appliances, batteries, electricity bills, and how fast work gets done.';
  }

  if (/\b(density|mass per volume|volume|float|sink)\b/.test(normalized)) {
    return 'This matters because density and measurement explain real things like why objects float or sink, how materials are identified, and why the same size objects can have different masses.';
  }

  const category = getStandardCategoryFromText(normalized);
  return category ? STANDARD_CATEGORY_CLUES[category].whyThisMatters : '';
}

function getStandardCategory(standard = {}) {
  const id = normalizeText(standard.standardId).toUpperCase();
  const strandCode = normalizeText(standard.strandCode).toUpperCase();
  const domainCode = normalizeText(standard.domainCode).toUpperCase();

  if (id.includes('PS2') || strandCode === 'PS2') return 'forces';
  if (id.includes('PS3') || strandCode === 'PS3') return 'energy';
  if (id.includes('PS4') || strandCode === 'PS4') return 'waves';
  if (id.includes('PS1') || strandCode === 'PS1') return 'matter';
  if (id.includes('LS') || strandCode.startsWith('LS') || domainCode === 'LS') return 'life';
  if (id.includes('ESS') || strandCode.startsWith('ESS') || domainCode === 'ESS') return 'earthSpace';
  if (id.includes('ETS') || strandCode.startsWith('ETS') || domainCode === 'ETS') return 'engineering';

  return getStandardCategoryFromText(getStandardSearchText(standard));
}

function getStandardCategoryFromText(text = '') {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return '';

  let bestCategory = '';
  let bestScore = 0;

  for (const [category, categoryData] of Object.entries(STANDARD_CATEGORY_CLUES)) {
    const score = countKeywordHits(normalized, categoryData.keywords);
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestCategory;
}

function getStandardSearchText(standard = {}) {
  return normalizeText([
    standard.standardId,
    standard.strandCode,
    standard.strandTitle,
    standard.conceptTitle,
    standard.classroomArea,
    standard.unit,
    standard.label,
    standard.statement,
    standard.officialStandard,
    standard.teacherShortName,
    standard.studentFriendlyStandard,
    standard.reasonSummary,
    ...(Array.isArray(standard.keywords) ? standard.keywords : []),
    ...(Array.isArray(standard.questionTriggers) ? standard.questionTriggers : []),
    ...(Array.isArray(standard.relatedFormulas) ? standard.relatedFormulas : []),
    ...(Array.isArray(standard.linkedConcepts) ? standard.linkedConcepts : [])
  ].filter(Boolean).join(' ')).toLowerCase();
}

function countKeywordHits(text, keywords) {
  if (!text) return 0;

  return keywords.reduce((count, keyword) => {
    const normalizedKeyword = normalizeText(keyword).toLowerCase();
    if (!normalizedKeyword) return count;
    return hasKeyword(text, normalizedKeyword) ? count + 1 : count;
  }, 0);
}

function hasKeyword(text, keyword) {
  if (keyword.length <= 2 || /^[a-z0-9]+$/.test(keyword)) {
    return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(text);
  }

  return text.includes(keyword);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanSentence(value) {
  return normalizeText(value).replace(/\s+\[/, ' [');
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  NO_CONTEXT_MESSAGE,
  NO_FULL_STANDARD_CONTEXT_MESSAGE,
  NO_WHY_CONTEXT_MESSAGE,
  NO_STRONG_MATCH_MESSAGE,
  answerWhyThisMattersFollowUp,
  answerStandardsFollowUp,
  formatFullStandardAnswer,
  formatStandardsAnswer,
  formatWhyThisMattersAnswer,
  formatStandardsClarificationPrompt,
  getWhyThisMattersForStandard,
  isFullStandardFollowUp,
  isInstructionalFollowUpPrompt,
  isStandardsFollowUp,
  isWhyThisMattersFollowUp
};
