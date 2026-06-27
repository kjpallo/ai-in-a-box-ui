const DEMO_SAME_OR_DIFFERENT_PATTERN = {
  id: 'demo.same-or-different',
  topic: 'same or different',
  originalQuestion: 'Is this all the same or different?',
  steps: [
    {
      id: 'same-or-different',
      type: 'choice',
      prompt: 'Is everything the same, or can you see different parts?',
      choices: [
        { number: 1, label: 'Everything is the same.', value: 'same', correct: true },
        { number: 2, label: 'I can see different parts.', value: 'different', correct: false }
      ],
      correctAnswer: 'same'
    }
  ],
  finalAnswer: 'This is the same throughout.'
};

const DEMO_CONCEPT_TUTOR_PATTERNS = [
  DEMO_SAME_OR_DIFFERENT_PATTERN
];

function detectNewtonsLawsConceptTutorAudit(message) {
  const text = normalizeNewtonsLawsAuditText(message);
  const result = {
    shouldStartConceptTutor: false,
    law: '',
    triggerGroup: '',
    blockedReason: ''
  };

  if (!text) return { ...result, blockedReason: 'empty_prompt' };
  if (isPureNewtonsLawsDefinitionQuestion(text)) {
    return { ...result, blockedReason: 'pure_definition_or_explanation' };
  }
  if (isNewtonsLawsFormulaCalculationPrompt(text)) {
    return { ...result, blockedReason: 'formula_or_calculation_prompt' };
  }
  if (!asksForNewtonLawIdentification(text)) {
    return { ...result, blockedReason: 'not_law_identification' };
  }

  const clue = detectNewtonsLawsAuditClue(text);
  if (!clue) return { ...result, blockedReason: 'missing_newton_law_clue' };

  return {
    shouldStartConceptTutor: true,
    law: clue.law,
    triggerGroup: clue.triggerGroup,
    blockedReason: ''
  };
}

function normalizeNewtonsLawsAuditText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\bf\s*=\s*m\s*[x*×]\s*a\b/g, 'force equals mass times acceleration')
    .replace(/\bf\s*=\s*ma\b/g, 'force equals mass times acceleration')
    .replace(/\b2nd\b/g, 'second')
    .replace(/\b1st\b/g, 'first')
    .replace(/\b3rd\b/g, 'third')
    .replace(/[?.!,;:"“”()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asksForNewtonLawIdentification(text) {
  return /\bwhich\s+(?:newtons?\s+)?law\b/.test(text) ||
    /\bwhat\s+(?:newtons?\s+)?law\b/.test(text) ||
    /\bnewtons?\s+law\s+is\b/.test(text) ||
    /\bwhich\s+law\s+(?:states|is|explains|shown)\b/.test(text);
}

function isPureNewtonsLawsDefinitionQuestion(text) {
  if (/^(?:what\s+is|whats|define|explain|describe)\s+(?:newtons?\s+)?(?:first|second|third)\s+law\b/.test(text)) return true;
  if (/^what\s+are\s+newtons?\s+laws?\b/.test(text)) return true;
  if (/^(?:what\s+is|whats|define|explain|describe)\s+inertia\b/.test(text)) return true;
  return false;
}

function isNewtonsLawsFormulaCalculationPrompt(text) {
  const hasForceMassAccelerationTerms = /\bforce\b/.test(text) &&
    /\bmass\b/.test(text) &&
    /\bacceleration\b/.test(text);
  const asksToCalculate = /\b(?:calculate|find|solve|determine|what\s+force|what\s+is\s+the\s+force|what\s+is\s+the\s+acceleration|what\s+is\s+the\s+mass|how\s+much\s+force)\b/.test(text);
  const hasNumber = /\d/.test(text);
  const hasFormulaUnit = /\b(?:kg|kilograms?|n|newtons?|m\/s|m\/s2|m\/s\^2|m\/s²)\b/.test(text);
  const hasDirectionalNetForce = /\bforce\b/.test(text) && /\b(?:left|right|up|down|north|south|east|west)\b/.test(text);

  return (asksToCalculate && (hasForceMassAccelerationTerms || hasFormulaUnit || hasDirectionalNetForce)) ||
    (hasNumber && hasFormulaUnit && (hasForceMassAccelerationTerms || hasDirectionalNetForce));
}

function detectNewtonsLawsAuditClue(text) {
  if (/\b(?:action\s+and\s+reaction|action\s+reaction|equal\s+and\s+opposite|pushes?\s+back|pushing\s+water\s+backward|pushes?\s+water\s+backward|moves?\s+forward|rocket|swimmer|two\s+objects?\s+(?:pushing|pulling))\b/.test(text)) {
    return { law: 'third', triggerGroup: '3rd Law / action-reaction' };
  }
  if (/\b(?:stays?\s+(?:still|at\s+rest)|keeps?\s+moving|stays?\s+in\s+motion|unless\s+acted\s+on|inertia|seatbelt|sudden\s+stop|until\s+kicked|until\s+pushed)\b/.test(text)) {
    return { law: 'first', triggerGroup: '1st Law / inertia' };
  }
  if (/\b(?:force\s+equals\s+mass\s+times\s+acceleration|force\s+mass\s+acceleration|more\s+force|greater\s+force|harder\s+makes?\s+it\s+accelerate|shopping\s+cart|more\s+mass|less\s+acceleration)\b/.test(text)) {
    return { law: 'second', triggerGroup: '2nd Law / F = ma' };
  }
  return null;
}

const MIXTURE_CLASSIFICATION_TRIGGER_WORDS = [
  'homogeneous',
  'homogenous',
  'homo',
  'heterogeneous',
  'heterogenous',
  'hetrogeneous',
  'hetrogenous',
  'hetero',
  'retro mixture'
];

const MIXTURE_EXAMPLES = [
  {
    patterns: [/\bsalt\s*water\b/, /\bsaltwater\b/],
    display: 'Salt water',
    classification: 'homogeneous',
    reason: 'it is the same throughout'
  },
  {
    patterns: [/\bkool\s*-?\s*aid\b/, /\bkoolaid\b/],
    display: 'Kool-Aid',
    classification: 'homogeneous',
    reason: 'it is the same throughout'
  },
  {
    patterns: [/\bair\b/],
    display: 'Air',
    classification: 'homogeneous',
    reason: 'it is the same throughout'
  },
  {
    patterns: [/\bvinegar\b/],
    display: 'Vinegar',
    classification: 'homogeneous',
    reason: 'it is the same throughout'
  },
  {
    patterns: [/\bcereal\s+(?:in|and|with)\s+milk\b/, /\bmilk\s+(?:and|with)\s+cereal\b/],
    display: 'Cereal in milk',
    classification: 'heterogeneous',
    reason: 'you can see different parts'
  },
  {
    patterns: [/\btrail\s+mix\b/],
    display: 'Trail mix',
    classification: 'heterogeneous',
    reason: 'you can see different parts'
  },
  {
    patterns: [/\b(?:olive\s+)?oil\s+(?:and|in|with)\s+water\b/, /\bwater\s+(?:and|with)\s+(?:olive\s+)?oil\b/],
    display: 'Oil and water',
    classification: 'heterogeneous',
    reason: 'you can see different parts'
  },
  {
    patterns: [/\bsand\s+(?:and|in|with)\s+water\b/, /\bwater\s+(?:and|with)\s+sand\b/],
    display: 'Sand and water',
    classification: 'heterogeneous',
    reason: 'you can see different parts'
  },
  {
    patterns: [/\bsalad\b(?!\s+dressing)/],
    display: 'Salad',
    classification: 'heterogeneous',
    reason: 'you can see different parts'
  }
];

function buildMixtureConceptTutorPattern(message) {
  const text = normalizeMixtureText(message);
  if (!shouldStartMixtureClassificationTutor(text)) return null;

  const knownExample = findKnownMixtureExample(text);
  const example = knownExample || buildUnknownMixtureExample(message);
  if (!example) return null;

  const sameFinalAnswer = `${example.display} is a homogeneous mixture because it is the same throughout.`;
  const differentFinalAnswer = `${example.display} is a heterogeneous mixture because you can see different parts.`;
  const knownClassification = example.classification || '';

  return {
    id: 'matter.mixtures.homogeneous-heterogeneous',
    topic: 'homogeneous and heterogeneous mixtures',
    originalQuestion: String(message || '').trim(),
    supportedExample: Boolean(knownExample),
    steps: [
      {
        id: 'same-or-different-throughout',
        type: 'choice',
        prompt: 'Is it the same throughout, or can you see different parts?',
        choices: [
          {
            number: 1,
            label: 'Same throughout',
            value: 'same',
            correct: knownClassification ? knownClassification === 'homogeneous' : true,
            finalAnswer: sameFinalAnswer
          },
          {
            number: 2,
            label: 'Different parts',
            value: 'different',
            correct: knownClassification ? knownClassification === 'heterogeneous' : true,
            finalAnswer: differentFinalAnswer
          }
        ],
        correctAnswer: knownClassification === 'heterogeneous' ? 'different' : 'same',
        hints: [
          'Think about whether the mixture looks uniform or whether separate parts stand out.',
          knownClassification === 'heterogeneous'
            ? 'Pick different parts when the pieces or layers are visible.'
            : 'Pick same throughout when the mixture looks uniform all the way through.'
        ]
      }
    ],
    finalAnswer: knownClassification === 'heterogeneous' ? differentFinalAnswer : sameFinalAnswer,
    finalExplanation: knownClassification === 'heterogeneous' ? differentFinalAnswer : sameFinalAnswer
  };
}

function shouldStartMixtureClassificationTutor(text) {
  if (!text || isPureMixtureDefinitionQuestion(text)) return false;
  if (!hasMixtureClassificationTrigger(text)) return false;
  if (/\b(?:quiz|test|practice)\s+me\b/.test(text)) return false;

  const hasKnownExample = Boolean(findKnownMixtureExample(text));
  const asksClassification = /\b(?:is|are|would|will|could|classify|type|kind)\b/.test(text) ||
    /\b(?:homo|hetero)\s+mixture\b/.test(text) ||
    /\bretro\s+mixture\b/.test(text);
  const hasSubjectBeforeClassification = /^(?:is|are|would|will|could)\s+.+?\s+(?:be\s+)?(?:a\s+|an\s+)?(?:homo|hetero|homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous|retro)\b/.test(text);
  const hasExampleSignal = hasKnownExample ||
    hasSubjectBeforeClassification ||
    /:\s*\S/.test(text) ||
    /\b(?:this|it|that|sample|substance|example|mixture)\b/.test(text);

  return asksClassification && hasExampleSignal;
}

function isPureMixtureDefinitionQuestion(text) {
  if (/^(?:define|definition of)\s+(?:a\s+)?(?:homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous|homo|hetero)(?:\s+mixtures?)?$/.test(text)) {
    return true;
  }
  if (/^what\s+does\s+(?:a\s+)?(?:homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous|homo|hetero)(?:\s+mixtures?)?\s+mean$/.test(text)) {
    return true;
  }
  if (/^what\s+(?:is|are)\s+(?:a\s+|an\s+)?(?:homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous)(?:\s+mixtures?)?$/.test(text)) {
    return true;
  }
  if (/\b(?:difference|different|vs|versus|compare)\b/.test(text) && hasHomogeneousTrigger(text) && hasHeterogeneousTrigger(text)) {
    return true;
  }
  if (/^(?:explain|describe|summarize)\b/.test(text) && hasHomogeneousTrigger(text) && hasHeterogeneousTrigger(text) && !/\b(?:is|are|would|classify)\b.+\b(?:homo|hetero|homogeneous|heterogeneous|homogenous|heterogenous|hetrogeneous|hetrogenous)\b/.test(text)) {
    return true;
  }
  return false;
}

function hasMixtureClassificationTrigger(text) {
  return hasHomogeneousTrigger(text) || hasHeterogeneousTrigger(text) || /\bretro\s+mixture\b/.test(text);
}

function hasHomogeneousTrigger(text) {
  return /\b(?:homogeneous|homogenous|homo)\b/.test(text);
}

function hasHeterogeneousTrigger(text) {
  return /\b(?:heterogeneous|heterogenous|hetrogeneous|hetrogenous|hetero)\b/.test(text);
}

function findKnownMixtureExample(text) {
  return MIXTURE_EXAMPLES.find((example) => example.patterns.some((pattern) => pattern.test(text))) || null;
}

function buildUnknownMixtureExample(message) {
  const raw = String(message || '').trim();
  const text = normalizeMixtureText(raw);

  const colonMatch = raw.match(/:\s*([^?!.]+)[?!.]*$/);
  if (colonMatch) return { display: titleCaseExample(colonMatch[1]) };

  const beforeIs = text.match(/^(?:is|are|would|will|could)\s+(.+?)\s+(?:a\s+|an\s+)?(?:homo|hetero|homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous|retro)\b/);
  if (beforeIs) return { display: titleCaseExample(beforeIs[1]) };

  const afterClassify = text.match(/\bclassify\s+(.+?)\s+(?:as\s+)?(?:homo|hetero|homogeneous|homogenous|heterogeneous|heterogenous|hetrogeneous|hetrogenous)\b/);
  if (afterClassify) return { display: titleCaseExample(afterClassify[1]) };

  if (/\b(?:this|it|that|sample|substance|example|mixture)\b/.test(text)) {
    return { display: 'This mixture' };
  }

  return null;
}

function titleCaseExample(value) {
  const cleaned = String(value || '')
    .replace(/\b(?:this|that|it|a|an|the|be|is|are|would|will|could|mixture)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'This mixture';

  return cleaned
    .split(/\s+/)
    .map((word) => {
      if (/^kool-?aid$/i.test(word)) return 'Kool-Aid';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function normalizeMixtureText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ELEMENT_EXAMPLES = [
  ...[
    'hydrogen',
    'helium',
    'carbon',
    'oxygen',
    'nitrogen',
    'gold',
    'silver',
    'copper',
    'iron',
    'aluminum',
    'sodium',
    'chlorine',
    'calcium',
    'potassium',
    'magnesium',
    'silicon',
    'sulfur',
    'phosphorus',
    'zinc',
    'nickel',
    'lead',
    'mercury'
  ].map((name) => ({
    patterns: [new RegExp(`\\b${name}\\b`)],
    display: titleCaseElementCompoundMixtureExample(name),
    classification: 'element',
    reason: 'it is made of one kind of atom'
  })),
  ...[
    ['au', 'Au'],
    ['ag', 'Ag'],
    ['fe', 'Fe'],
    ['cu', 'Cu'],
    ['al', 'Al'],
    ['na', 'Na'],
    ['cl', 'Cl'],
    ['ca', 'Ca'],
    ['mg', 'Mg'],
    ['zn', 'Zn'],
    ['he', 'He'],
    ['ne', 'Ne'],
    ['ar', 'Ar']
  ].map(([symbol, display]) => ({
    patterns: [new RegExp(`\\b${symbol}\\b`)],
    display,
    classification: 'element',
    reason: 'it is the chemical symbol for one kind of atom'
  }))
];

const COMPOUND_EXAMPLES = [
  {
    patterns: [/\bwater\b/, /\bh2o\b/],
    display: 'Water',
    classification: 'compound',
    reason: 'hydrogen and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bcarbon\s+dioxide\b/, /\bco2\b/],
    display: 'Carbon dioxide',
    classification: 'compound',
    reason: 'carbon and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bcarbon\s+monoxide\b/, /\bco\b/],
    display: 'Carbon monoxide',
    classification: 'compound',
    reason: 'carbon and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bsodium\s+chloride\b/, /\bnacl\b/, /\btable\s+salt\b/, /\bpure\s+salt\b/, /\bsalt\b/],
    display: 'Salt',
    classification: 'compound',
    reason: 'sodium and chlorine are chemically joined into one substance'
  },
  {
    patterns: [/\bcalcium\s+carbonate\b/, /\bcaco3\b/],
    display: 'Calcium carbonate',
    classification: 'compound',
    reason: 'its atoms are chemically joined into one substance'
  },
  {
    patterns: [/\bbaking\s+soda\b/, /\bsodium\s+bicarbonate\b/, /\bnahco3\b/],
    display: 'Baking soda',
    classification: 'compound',
    reason: 'its atoms are chemically joined into one substance'
  },
  {
    patterns: [/\bsugar\b/, /\bsucrose\b/, /\bc12h22o11\b/],
    display: 'Sugar',
    classification: 'compound',
    reason: 'carbon, hydrogen, and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bglucose\b/, /\bc6h12o6\b/],
    display: 'Glucose',
    classification: 'compound',
    reason: 'carbon, hydrogen, and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bmethane\b/, /\bch4\b/],
    display: 'Methane',
    classification: 'compound',
    reason: 'carbon and hydrogen are chemically joined into one substance'
  },
  {
    patterns: [/\bammonia\b/, /\bnh3\b/],
    display: 'Ammonia',
    classification: 'compound',
    reason: 'nitrogen and hydrogen are chemically joined into one substance'
  },
  {
    patterns: [/\bhydrochloric\s+acid\b/, /\bhcl\b/],
    display: 'Hydrochloric acid',
    classification: 'compound',
    reason: 'hydrogen and chlorine are chemically joined into one substance'
  },
  {
    patterns: [/\bacetic\s+acid\b/, /\bch3cooh\b/],
    display: 'Acetic acid',
    classification: 'compound',
    reason: 'its atoms are chemically joined into one substance'
  },
  {
    patterns: [/\bhydrogen\s+peroxide\b/, /\bh2o2\b/],
    display: 'Hydrogen peroxide',
    classification: 'compound',
    reason: 'hydrogen and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\brust\b/, /\biron\s+oxide\b/, /\bfe2o3\b/],
    display: 'Rust',
    classification: 'compound',
    reason: 'iron and oxygen are chemically joined into one substance'
  },
  {
    patterns: [/\bsilicon\s+dioxide\b/, /\bsio2\b/, /\bpure\s+sand\b/],
    display: 'Sand',
    classification: 'compound',
    reason: 'silicon and oxygen are chemically joined into one substance'
  }
];

const ELEMENT_COMPOUND_MIXTURE_MIXTURE_EXAMPLES = [
  {
    patterns: [/\bsalt\s*water\b/, /\bsaltwater\b/, /\bsea\s*water\b/, /\bseawater\b/],
    display: 'Salt water',
    classification: 'mixture',
    reason: 'salt and water are physically mixed together'
  },
  {
    patterns: [/\bair\b/],
    display: 'Air',
    classification: 'mixture',
    reason: 'different gases are physically mixed together'
  },
  {
    patterns: [/\bsalad\b/, /\btrail\s+mix\b/, /\bcereal\s+(?:in|and|with)\s+milk\b/, /\bmilk\s+(?:and|with)\s+cereal\b/],
    display: 'This sample',
    classification: 'mixture',
    reason: 'the parts are physically mixed together'
  },
  {
    patterns: [/\b(?:olive\s+)?oil\s+(?:and|in|with)\s+water\b/, /\bwater\s+(?:and|with)\s+(?:olive\s+)?oil\b/],
    display: 'Oil and water',
    classification: 'mixture',
    reason: 'oil and water are physically mixed together'
  },
  {
    patterns: [/\bsand\s+(?:and|in|with)\s+water\b/, /\bwater\s+(?:and|with)\s+sand\b/],
    display: 'Sand and water',
    classification: 'mixture',
    reason: 'sand and water are physically mixed together'
  },
  {
    patterns: [/\blemonade\b/, /\bkool\s*-?\s*aid\b/, /\bkoolaid\b/, /\bmilk\b/, /\bpaint\b/, /\bsoil\b/, /\bconcrete\b/],
    display: 'This product',
    classification: 'mixture',
    reason: 'its parts are physically mixed together'
  },
  {
    patterns: [/\bbrass\b/, /\bsteel\b/],
    display: 'This alloy',
    classification: 'mixture',
    reason: 'metals are physically mixed together'
  },
  {
    patterns: [/\bvinegar\b/, /\bbleach\b/, /(?<!\bbaking\s)\bsoda\b/, /\bpop\b/, /\borange\s+juice\b/, /\bcoffee\b/, /\btea\b/],
    display: 'This product',
    classification: 'mixture',
    reason: 'its ingredients are physically mixed together'
  },
  {
    patterns: [/\bshampoo\b/, /\bdish\s+soap\b/, /\blaundry\s+detergent\b/, /\bhand\s+sanitizer\b/, /\bgasoline\b/],
    display: 'This product',
    classification: 'mixture',
    reason: 'its ingredients are physically mixed together'
  }
];

function buildElementCompoundMixtureConceptTutorPattern(message) {
  const text = normalizeElementCompoundMixtureText(message);
  if (!shouldStartElementCompoundMixtureTutor(text)) return null;

  const knownExample = findKnownElementCompoundMixtureExample(text);
  const example = knownExample || buildUnknownElementCompoundMixtureExample(message);
  if (!example) return null;

  const elementFinalAnswer = `${example.display} is an element because ${example.reason || 'it is made of one kind of atom'}.`;
  const compoundFinalAnswer = `${example.display} is a compound because ${example.reason || 'the atoms are chemically joined into a new substance'}.`;
  const mixtureFinalAnswer = `${example.display} is a mixture because ${example.reason || 'the parts are physically mixed together'}.`;
  const unknownElementFinalAnswer = `${example.display} is an element because it is made of one kind of atom.`;
  const unknownCompoundFinalAnswer = `${example.display} is a compound because the atoms are chemically joined into a new substance.`;
  const unknownMixtureFinalAnswer = `${example.display} is a mixture because the parts are physically mixed together.`;
  const classification = example.classification || '';

  return {
    id: 'matter.element-compound-mixture',
    topic: 'elements, compounds, and mixtures',
    originalQuestion: String(message || '').trim(),
    supportedExample: Boolean(knownExample),
    steps: [
      {
        id: 'one-kind-of-atom',
        type: 'choice',
        prompt: 'Is it made of one kind of atom?',
        choices: [
          {
            number: 1,
            label: 'Yes',
            value: 'yes',
            correct: classification ? classification === 'element' : true,
            completeTutor: true,
            finalAnswer: classification === 'element' ? elementFinalAnswer : unknownElementFinalAnswer
          },
          {
            number: 2,
            label: 'No',
            value: 'no',
            correct: classification ? classification !== 'element' : true,
            nextStepId: 'chemically-joined-or-physically-mixed'
          }
        ],
        correctAnswer: classification === 'element' ? 'yes' : 'no',
        hints: [
          'An element has only one kind of atom.',
          classification === 'element'
            ? 'Choose yes when the sample is one element from the periodic table.'
            : 'Choose no when more than one kind of particle is involved.'
        ]
      },
      {
        id: 'chemically-joined-or-physically-mixed',
        type: 'choice',
        prompt: 'Are the parts chemically joined into a new substance, or physically mixed together?',
        choices: [
          {
            number: 1,
            label: 'Chemically joined into a new substance',
            value: 'chemically joined',
            correct: classification ? classification === 'compound' : true,
            finalAnswer: classification === 'compound' ? compoundFinalAnswer : unknownCompoundFinalAnswer
          },
          {
            number: 2,
            label: 'Physically mixed together',
            value: 'physically mixed',
            correct: classification ? classification === 'mixture' : true,
            finalAnswer: classification === 'mixture' ? mixtureFinalAnswer : unknownMixtureFinalAnswer
          }
        ],
        correctAnswer: classification === 'mixture' ? 'physically mixed' : 'chemically joined',
        hints: [
          'A compound has chemically joined atoms. A mixture has parts physically mixed together.',
          classification === 'mixture'
            ? 'Choose physically mixed together when the parts keep their own identities.'
            : 'Choose chemically joined when the atoms make one new substance.'
        ]
      }
    ],
    finalAnswer: classification === 'element'
      ? elementFinalAnswer
      : classification === 'mixture'
        ? mixtureFinalAnswer
        : compoundFinalAnswer,
    finalExplanation: classification === 'element'
      ? elementFinalAnswer
      : classification === 'mixture'
        ? mixtureFinalAnswer
        : compoundFinalAnswer
  };
}

function shouldStartElementCompoundMixtureTutor(text) {
  if (!text || isPureElementCompoundMixtureDefinitionQuestion(text)) return false;
  if (hasMixtureClassificationTrigger(text)) return false;
  if (/\b(?:quiz|test|practice)\s+me\b/.test(text)) return false;
  if (/^are\b/.test(text) && !hasElementCompoundMixtureChoicePhrase(text)) return false;
  if (!hasElementCompoundMixtureTrigger(text)) return false;

  const hasKnownExample = Boolean(findKnownElementCompoundMixtureExample(text));
  const asksClassification = /^(?:is|are|would|will|could|can)\b/.test(text) ||
    /\bclassify\b/.test(text) ||
    hasElementCompoundMixtureChoicePhrase(text);
  const hasExampleSignal = hasKnownExample ||
    /:\s*\S/.test(text) ||
    /\b(?:this|it|that|sample|substance|example|material|object|thing)\b/.test(text) ||
    /^(?:is|are|would|will|could|can)\s+.+?\s+(?:be\s+)?(?:an?\s+)?(?:element|compound|mixture)\b/.test(text) ||
    hasElementCompoundMixtureChoicePhrase(text);

  return asksClassification && hasExampleSignal;
}

function isPureElementCompoundMixtureDefinitionQuestion(text) {
  if (/^(?:define|definition of)\s+(?:an?\s+)?(?:element|compound|mixture)s?$/.test(text)) return true;
  if (/^what\s+does\s+(?:an?\s+)?(?:element|compound|mixture)s?\s+mean$/.test(text)) return true;
  if (/^what\s+(?:is|are)\s+(?:an?\s+)?(?:element|compound|mixture)s?$/.test(text)) return true;
  if (/\b(?:difference|different|vs|versus|compare)\b/.test(text) && /\belements?\b/.test(text) && /\bcompounds?\b/.test(text)) return true;
  if (/^(?:explain|describe|summarize)\b/.test(text) && /\belements?\b/.test(text) && /\bcompounds?\b/.test(text) && /\bmixtures?\b/.test(text)) return true;
  return false;
}

function hasElementCompoundMixtureTrigger(text) {
  return /\belements?\b|\bcompounds?\b|\bmixtures?\b/.test(text);
}

function hasElementCompoundMixtureChoicePhrase(text) {
  return /\b(?:element\s+or\s+compound|compound\s+or\s+mixture|element\s+compound\s+or\s+mixture|element\s+or\s+compound\s+or\s+mixture)\b/.test(text);
}

function findKnownElementCompoundMixtureExample(text) {
  const examples = [
    ...ELEMENT_COMPOUND_MIXTURE_MIXTURE_EXAMPLES,
    ...COMPOUND_EXAMPLES,
    ...ELEMENT_EXAMPLES
  ];
  const match = examples.find((example) => example.patterns.some((pattern) => pattern.test(text))) || null;
  if (!match) return null;
  return {
    ...match,
    display: refineKnownElementCompoundMixtureDisplay(match, text)
  };
}

function refineKnownElementCompoundMixtureDisplay(example, text) {
  const patternDisplay = [
    [/\btrail\s+mix\b/, 'Trail mix'],
    [/\bcereal\s+(?:in|and|with)\s+milk\b|\bmilk\s+(?:and|with)\s+cereal\b/, 'Cereal in milk'],
    [/\bsalad\b/, 'Salad'],
    [/\blemonade\b/, 'Lemonade'],
    [/\bkool\s*-?\s*aid\b|\bkoolaid\b/, 'Kool-Aid'],
    [/\bmilk\b/, 'Milk'],
    [/\bpaint\b/, 'Paint'],
    [/\bsoil\b/, 'Soil'],
    [/\bconcrete\b/, 'Concrete'],
    [/\bbrass\b/, 'Brass'],
    [/\bsteel\b/, 'Steel'],
    [/\bvinegar\b/, 'Vinegar'],
    [/\bbleach\b/, 'Bleach'],
    [/(?<!\bbaking\s)\bsoda\b|\bpop\b/, 'Soda'],
    [/\borange\s+juice\b/, 'Orange juice'],
    [/\bcoffee\b/, 'Coffee'],
    [/\btea\b/, 'Tea'],
    [/\bshampoo\b/, 'Shampoo'],
    [/\bdish\s+soap\b/, 'Dish soap'],
    [/\blaundry\s+detergent\b/, 'Laundry detergent'],
    [/\bhand\s+sanitizer\b/, 'Hand sanitizer'],
    [/\bgasoline\b/, 'Gasoline']
  ];
  const displayMatch = patternDisplay.find(([pattern]) => pattern.test(text));
  return displayMatch ? displayMatch[1] : example.display;
}

function buildUnknownElementCompoundMixtureExample(message) {
  const raw = String(message || '').trim();
  const text = normalizeElementCompoundMixtureText(raw);

  const colonMatch = raw.match(/:\s*([^?!.]+)[?!.]*$/);
  if (colonMatch) return { display: titleCaseElementCompoundMixtureExample(colonMatch[1]) };

  const beforeClassification = text.match(/^(?:is|are|would|will|could|can)\s+(.+?)\s+(?:be\s+)?(?:an?\s+)?(?:element|compound|mixture)\b/);
  if (beforeClassification) return { display: titleCaseElementCompoundMixtureExample(beforeClassification[1]) };

  const afterClassify = text.match(/\bclassify\s+(.+?)\s+(?:as\s+)?(?:an?\s+)?(?:element|compound|mixture)\b/);
  if (afterClassify) return { display: titleCaseElementCompoundMixtureExample(afterClassify[1]) };

  if (/\b(?:this|it|that|sample|substance|example|material|object|thing)\b/.test(text)) {
    return { display: 'This substance' };
  }

  if (/\b(?:element\s+or\s+compound|compound\s+or\s+mixture|element\s+compound\s+or\s+mixture|element\s+or\s+compound\s+or\s+mixture)\b/.test(text)) {
    return { display: 'This substance' };
  }

  return null;
}

function titleCaseElementCompoundMixtureExample(value) {
  const cleaned = String(value || '')
    .replace(/\b(?:this|that|it|a|an|the|be|is|are|would|will|could|can|element|compound|mixture|classify|as)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'This substance';

  return cleaned
    .split(/\s+/)
    .map((word) => {
      if (/^kool-?aid$/i.test(word)) return 'Kool-Aid';
      if (/^[A-Z][a-z]?$/.test(word)) return word;
      if (/^[A-Z][a-z]?[0-9]/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function normalizeElementCompoundMixtureText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[?.!,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  buildElementCompoundMixtureConceptTutorPattern,
  buildMixtureConceptTutorPattern,
  detectNewtonsLawsConceptTutorAudit,
  DEMO_CONCEPT_TUTOR_PATTERNS,
  DEMO_SAME_OR_DIFFERENT_PATTERN,
  MIXTURE_CLASSIFICATION_TRIGGER_WORDS
};
