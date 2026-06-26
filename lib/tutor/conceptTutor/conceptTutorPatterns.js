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

module.exports = {
  buildMixtureConceptTutorPattern,
  DEMO_CONCEPT_TUTOR_PATTERNS,
  DEMO_SAME_OR_DIFFERENT_PATTERN,
  MIXTURE_CLASSIFICATION_TRIGGER_WORDS
};
