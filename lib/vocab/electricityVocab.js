const electricityMagnetismKnowledgePack = require('../knowledge/electricity-magnetism/electricityMagnetismKnowledgePack');

const EXTRA_ALIASES = {
  em_vocab_023: ['potential difference'],
  em_vocab_027: ['ohm law', 'ohms law'],
  em_vocab_052: ['make an electromagnet', 'create an electromagnet'],
  em_concept_031: ['orsted observation', 'what did orsted observe', 'orsted electricity magnetism']
};

const ANSWER_OVERRIDES = {
  em_vocab_025: 'Resistance is the opposition to the flow of electric current. Resistance is measured in ohms. If voltage stays the same, more resistance means less current.',
  em_vocab_052: 'An electromagnet is a magnet made by electric current flowing through a coil of wire, often around metal. The current creates a magnetic field. You can make an electromagnet stronger by adding more wire loops or increasing current.',
  em_concept_013: 'In a series circuit, if one bulb burns out and opens the path, current stops and the other bulbs go out too. Series has one path, so current cannot go around the broken bulb.',
  em_concept_030: 'more loops and more current can make an electromagnet stronger. More loops strengthen the magnetic field. More current also strengthens the magnetic field. A good iron core can also help in many designs.'
};

const VOCAB = electricityMagnetismKnowledgePack.vocab
  .map((row) => ({
    id: row.id,
    term: row.term,
    names: unique([
      row.term,
      ...splitList(row.aliases),
      ...(EXTRA_ALIASES[row.id] || [])
    ]).filter((name) => !isBareSymbolAlias(name)),
    answer: ANSWER_OVERRIDES[row.id] || buildAnswer(row.answer_short, row.answer_extra)
  }))
  .sort((a, b) => longestName(b) - longestName(a));

const CONCEPTS = electricityMagnetismKnowledgePack.concepts
  .map((row) => ({
    id: row.id,
    names: unique([
      ...splitList(row.question_patterns),
      ...(EXTRA_ALIASES[row.id] || [])
    ]),
    answer: ANSWER_OVERRIDES[row.id] || buildAnswer(row.answer_short, row.answer_steps)
  }))
  .sort((a, b) => longestName(b) - longestName(a));

function tryElectricityVocab(message) {
  const text = normalize(message);
  if (!text || hasNumbers(text)) return null;
  if (/^\s*draw\b/.test(text)) return null;

  const concept = findConcept(text);
  if (concept) {
    return {
      id: concept.id,
      kind: 'electricity_concept',
      answer: concept.answer
    };
  }

  if (!hasDefinitionIntent(text)) return null;

  const term = findVocabTerm(text);
  if (!term) return null;

  return {
    id: term.id,
    kind: 'electricity_vocab',
    answer: term.answer
  };
}

function findConcept(text) {
  const directConcept = CONCEPTS.find((item) => item.names.some((name) => hasPhrase(text, name)));
  if (directConcept) return directConcept;

  if (hasPhrase(text, 'ammeter') && /\b(?:where|connect|place|go|series|parallel)\b/.test(text)) {
    return conceptById('em_concept_015');
  }
  if (hasPhrase(text, 'voltmeter') && /\b(?:where|connect|place|go|across|series|parallel|measure)\b/.test(text)) {
    return conceptById('em_concept_016');
  }
  if (hasPhrase(text, 'series circuit') && /\b(?:bulb|burn|burns|burned|out|break|breaks|light)\b/.test(text)) {
    return conceptById('em_concept_013');
  }
  if (hasPhrase(text, 'parallel circuit') && /\b(?:bulb|branch|burn|burns|burned|out|open|opens|light)\b/.test(text)) {
    return conceptById('em_concept_014');
  }
  if (hasPhrase(text, 'electromagnet') && /\b(?:stronger|strength|increase|strengthen)\b/.test(text)) {
    return conceptById('em_concept_030');
  }
  if (/\b(?:oersted|orsted)\b/.test(text) && /\b(?:observe|observed|show|discover|electricity|magnetism)\b/.test(text)) {
    return conceptById('em_concept_031');
  }
  if (hasPhrase(text, 'current') && hasPhrase(text, 'voltage') && /\b(?:relationship|affect|happens|double|increase)\b/.test(text)) {
    return conceptById('em_concept_010');
  }
  if (hasPhrase(text, 'current') && hasPhrase(text, 'resistance') && /\b(?:relationship|affect|happens|double|increase|decrease)\b/.test(text)) {
    return conceptById('em_concept_010');
  }

  return null;
}

function findVocabTerm(text) {
  let bestMatch = null;

  for (const term of VOCAB) {
    for (const name of term.names) {
      const normalizedName = normalize(name);
      if (!hasPhrase(text, normalizedName)) continue;
      if (!bestMatch || normalizedName.length > bestMatch.nameLength) {
        bestMatch = {
          term,
          nameLength: normalizedName.length
        };
      }
    }
  }

  return bestMatch ? bestMatch.term : null;
}

function conceptById(id) {
  return CONCEPTS.find((item) => item.id === id) || null;
}

function hasDefinitionIntent(text) {
  return /\b(?:what\s+is|what's|define|meaning\s+of|what\s+does|what\s+are|what\s+do|how\s+does|how\s+do|how\s+can|where\s+should)\b/.test(text);
}

function hasPhrase(text, phrase) {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function hasNumbers(text) {
  return /\d/.test(text);
}

function buildAnswer(shortAnswer, extraAnswer) {
  return [shortAnswer, extraAnswer]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
}

function longestName(item) {
  return Math.max(...item.names.map((name) => name.length));
}

function splitList(value) {
  return String(value || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isBareSymbolAlias(value) {
  return /^[a-z]$/i.test(String(value || '').trim());
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/ø/g, 'o')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9µμ.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  tryElectricityVocab
};
