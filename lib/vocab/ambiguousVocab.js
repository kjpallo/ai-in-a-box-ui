const AMBIGUOUS_VOCAB = {
  friction: {
    clarification: [
      'Friction can mean more than one thing. Do you mean:',
      '1. Friction as a force that opposes motion',
      '2. Friction as a way to transfer electric charge, like rubbing a balloon on hair'
    ].join('\n'),
    forceAnswer: 'Friction is a force that resists motion when surfaces rub or slide against each other.',
    electricityAnswer: 'Friction transfers electric charge when two objects rub together. Electrons move from one object to another, which can leave one object negatively charged and the other positively charged.',
    forceContext: [
      'as a force',
      'friction force',
      'frictional force',
      'force of friction',
      'opposes motion',
      'oppose motion',
      'motion',
      'surface',
      'surfaces',
      'sliding',
      'rubbing surfaces',
      'kinetic friction',
      'static friction'
    ],
    electricityContext: [
      'electricity',
      'electric',
      'charge',
      'charging',
      'static electricity',
      'static charge',
      'transfer',
      'electrons',
      'balloon',
      'hair',
      'rubbing'
    ]
  }
};

function tryAmbiguousVocab(message) {
  const text = normalize(message);
  if (!text || !hasDefinitionIntent(text)) return null;
  if (!hasPhrase(text, 'friction') && !hasPhrase(text, 'charging by friction')) return null;
  if (hasPhrase(text, 'coefficient of friction')) return null;

  const entry = AMBIGUOUS_VOCAB.friction;

  if (hasAnyPhrase(text, entry.electricityContext)) {
    return {
      id: 'friction_electricity',
      kind: 'electricity_vocab',
      answer: entry.electricityAnswer
    };
  }

  if (hasAnyPhrase(text, entry.forceContext)) {
    return {
      id: 'friction_force',
      kind: 'physics_forces_vocab',
      answer: entry.forceAnswer
    };
  }

  return {
    id: 'friction',
    kind: 'ambiguous_vocab',
    answer: entry.clarification,
    pendingClarification: {
      id: 'ambiguous_vocab_friction',
      toolsUsed: ['ambiguous_vocab_rules'],
      invalidChoiceMessage: 'Please type 1 for friction as a force, or 2 for friction as a way to transfer electric charge.',
      choices: [
        {
          number: 1,
          label: 'Friction as a force that opposes motion',
          intent: 'definition',
          toolsUsed: ['ambiguous_vocab_rules'],
          notes: 'Answered ambiguous vocabulary choice: friction as force.',
          answer: entry.forceAnswer
        },
        {
          number: 2,
          label: 'Friction as a way to transfer electric charge',
          intent: 'definition',
          toolsUsed: ['ambiguous_vocab_rules'],
          notes: 'Answered ambiguous vocabulary choice: friction as electricity.',
          answer: entry.electricityAnswer
        }
      ]
    }
  };
}

function hasDefinitionIntent(text) {
  return /\b(?:what\s+is|what's|define|meaning\s+of|what\s+does|how\s+does|how\s+do)\b/.test(text);
}

function hasAnyPhrase(text, phrases) {
  return phrases.some((phrase) => hasPhrase(text, phrase));
}

function hasPhrase(text, phrase) {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9µμ.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  tryAmbiguousVocab
};
