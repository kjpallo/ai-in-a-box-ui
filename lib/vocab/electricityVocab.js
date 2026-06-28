const electricityMagnetismKnowledgePack = require('../knowledge/electricity-magnetism/electricityMagnetismKnowledgePack');

const EXTRA_ALIASES = {
  em_vocab_023: ['potential difference'],
  em_vocab_027: ['ohm law', 'ohms law'],
  em_vocab_052: ['make an electromagnet', 'create an electromagnet'],
  em_concept_031: ['orsted observation', 'what did orsted observe', 'orsted electricity magnetism']
};

const ANSWER_OVERRIDES = {
  em_vocab_012: 'An electric field is the area around a charged object where it can exert force on other charges at a distance.',
  em_vocab_020: 'Induction is when a nearby charged object causes charges in another object to shift without touching it. It is charging from a distance.',
  em_vocab_021: 'Electric current is the flow of electric charge or electrons through a material or circuit. Current is measured in amperes, or amps.',
  em_vocab_025: 'Resistance is the opposition to the flow of electric current. Resistance is measured in ohms. If voltage stays the same, more resistance means less current.',
  em_vocab_029: 'A closed circuit has a complete connected path, so electric current can flow.',
  em_vocab_030: 'An open circuit has a break or incomplete path, so current cannot flow.',
  em_vocab_031: 'A battery converts chemical energy into electrical energy and creates the voltage difference that pushes charge through a circuit.',
  em_vocab_033: 'A switch opens or closes a circuit. An open switch breaks the path and stops current; a closed switch completes the path and lets current flow.',
  em_vocab_052: 'An electromagnet is a magnet made by electric current flowing through a coil of wire, often around metal. The current creates a magnetic field. You can make an electromagnet stronger by adding more wire loops or increasing current.',
  em_concept_008: 'Open circuit: the path is broken or incomplete, so current does not flow. Closed circuit: the path is complete, so current flows.',
  em_concept_009: 'A battery converts chemical energy into electrical energy and creates a voltage difference between its terminals. That voltage difference pushes charges through a closed circuit.',
  em_concept_012: 'Series circuits have one path, so the same current flows throughout and adding components increases total resistance. Parallel circuits have more than one path or branch, voltage is the same across branches, and current splits among the branches.',
  em_concept_013: 'In a series circuit, if one bulb burns out and opens the path, current stops and the other bulbs go out too. Series has one path, so current cannot go around the broken bulb.',
  em_concept_014: 'In a parallel circuit, current splits among separate branches. Voltage is the same across each branch, and if one branch opens, other branches can still work.',
  em_concept_022: 'Fuses and circuit breakers prevent overheating by opening or breaking the circuit when too much current flows. A fuse melts or a breaker trips, stopping current before wires overheat.',
  em_concept_028: 'Moving electric charge, or current, can produce a magnetic field around a wire. More current makes a stronger magnetic field.',
  em_concept_029: 'An electromagnet is a temporary magnet made by electric current flowing through a coil of wire, often wrapped around an iron or metal core.',
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
  if (shouldLeaveForMotionForceVocab(text)) return null;

  const directAnswer = answerDirectElectricityPrompt(text);
  if (directAnswer) return directAnswer;

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
  if (hasPhrase(text, 'open circuit')) {
    return vocabById('em_vocab_030');
  }
  if (hasPhrase(text, 'closed circuit')) {
    return vocabById('em_vocab_029');
  }
  if (hasPhrase(text, 'open switch')) {
    return localConcept('open_switch_no_current', 'An open switch means the circuit path is open, so current does not flow.');
  }
  if (hasPhrase(text, 'force or push') && hasPhrase(text, 'charges') && hasPhrase(text, 'circuit')) {
    return vocabById('em_vocab_023');
  }
  if (hasPhrase(text, 'two north magnetic poles') || hasPhrase(text, 'two north poles')) {
    return localConcept('like_magnetic_poles_repel', 'Two north magnetic poles repel each other. Like magnetic poles repel.');
  }
  if (hasPhrase(text, 'homes and schools') && hasPhrase(text, 'wired')) {
    return localConcept('homes_schools_parallel', 'Homes and schools are usually wired in parallel circuits, with separate branches or paths so devices can work independently.');
  }
  if (hasPhrase(text, 'homes and schools') && hasPhrase(text, 'parallel')) {
    return localConcept('homes_schools_parallel', 'Homes and schools use parallel circuits because separate branches or paths let devices work independently. If one device turns off, others can still work.');
  }
  if (hasPhrase(text, 'voltage across branches') && hasPhrase(text, 'parallel circuit')) {
    return localConcept('parallel_voltage_same_branches', 'In a parallel circuit, voltage is the same across each branch.');
  }
  if (hasPhrase(text, 'current in a parallel circuit')) {
    return localConcept('parallel_current_splits', 'In a parallel circuit, current splits among the branches or multiple paths.');
  }
  if (hasPhrase(text, 'current in a series circuit')) {
    return localConcept('series_current_same', 'In a series circuit, current is the same throughout because there is only one path.');
  }
  if (hasPhrase(text, 'add more lights in series')) {
    return conceptById('em_concept_020');
  }
  if (hasPhrase(text, 'holiday lights') && hasPhrase(text, 'series circuit')) {
    return localConcept('holiday_lights_series', 'Some holiday lights are examples of series circuits because there is one path. If one bulb burns out or opens the path, the other lights go out.');
  }
  if (hasPhrase(text, 'circuit symbol for a battery') || hasPhrase(text, 'symbol for battery')) {
    return localConcept('battery_symbol', 'The circuit symbol for a battery is long and short parallel lines.');
  }
  if (hasPhrase(text, 'what does a switch do') && hasPhrase(text, 'circuit')) {
    return vocabById('em_vocab_033');
  }
  if (hasPhrase(text, 'circuit symbols') && hasPhrase(text, 'battery') && hasPhrase(text, 'switch')) {
    return conceptById('em_concept_036');
  }
  if (hasPhrase(text, 'north poles') && hasPhrase(text, 'near each other')) {
    return localConcept('north_poles_repel', 'Two north poles repel each other because like magnetic poles repel.');
  }
  if ((hasPhrase(text, 'moving electric charge') || hasPhrase(text, 'current')) && hasPhrase(text, 'around a wire')) {
    return conceptById('em_concept_028');
  }
  if (hasPhrase(text, 'electromagnet weaker')) {
    return localConcept('weaken_electromagnet', 'To make an electromagnet weaker, use fewer loops or decrease the loops in the coil, and use less current or decrease the current.');
  }
  if (hasPhrase(text, 'fuses') && hasPhrase(text, 'circuit breakers')) {
    return conceptById('em_concept_022');
  }
  if (hasPhrase(text, 'series and parallel circuits') && hasAnyPhrase(text, ['differences', 'difference', 'compare', 'explain'])) {
    return conceptById('em_concept_012');
  }
  if (hasPhrase(text, 'field around a charged object') || hasPhrase(text, 'field around charged object')) {
    return vocabById('em_vocab_012');
  }
  if (hasPhrase(text, 'charging by induction') || (hasPhrase(text, 'induction') && hasPhrase(text, 'distance'))) {
    return vocabById('em_vocab_020');
  }
  if (hasPhrase(text, 'skin') && hasPhrase(text, 'conductor')) {
    return localConcept('skin_conductor', 'In this electricity test context, skin is treated as a conductor because it can conduct electric charge/current.');
  }

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

function answerDirectElectricityPrompt(text) {
  if (hasPhrase(text, 'friction in electricity') || (hasPhrase(text, 'friction') && hasPhrase(text, 'electricity'))) {
    return localVocab('electric_charge_friction', 'Friction transfers electric charge when two objects rub together. Rubbing can move electrons and build up static electricity.');
  }
  if (/\bthing\b.*\bslow\b.*\belectricity\b/.test(text) || /\bslow\b.*\b(?:electricity|curent|current)\b/.test(text)) {
    return localVocab('electric_current_resistance_cue', 'Electrical resistance slows or resists electric current. Resistance is measured in ohms.');
  }
  if (hasPhrase(text, 'law of conservation of charge') || hasPhrase(text, 'conservation of charge')) {
    return localVocab('conservation_of_charge', 'The law of conservation of charge says electric charge cannot be created and cannot be destroyed; it can only be transferred.');
  }
  if (asksOpenClosedCircuitDifference(text)) {
    return localConcept('open_closed_circuit_difference', 'Open circuit: the path is broken or incomplete, so current cannot flow. Closed circuit: the path is complete, so current can flow.');
  }
  if (hasPhrase(text, 'circuit symbols') && hasPhrase(text, 'battery') && hasPhrase(text, 'switch')) return conceptById('em_concept_036');
  if (hasPhrase(text, 'circuit symbol') && hasPhrase(text, 'battery')) {
    return localConcept('battery_symbol', 'The circuit symbol for a battery is long and short parallel lines.');
  }
  if (isAskingTerm(text, ['open circuit'])) return vocabById('em_vocab_030');
  if (isAskingTerm(text, ['closed circuit'])) return vocabById('em_vocab_029');
  if (isAskingTerm(text, ['voltage difference', 'voltage'])) return vocabById('em_vocab_023');
  if (isAskingTerm(text, ['battery'])) return vocabById('em_vocab_031');
  if (isAskingTerm(text, ['switch'])) return vocabById('em_vocab_033');
  if (isAskingTerm(text, ['resistor'])) return vocabById('em_vocab_035');
  if (isAskingTerm(text, ['light bulb', 'lamp', 'bulb'])) return vocabById('em_vocab_034');
  if (isAskingTerm(text, ['fuse', 'circuit breaker']) || (hasPhrase(text, 'fuses') && hasPhrase(text, 'circuit breakers'))) return conceptById('em_concept_022');
  if (isAskingTerm(text, ['electric current', 'current'])) return vocabById('em_vocab_021');
  if (isAskingTerm(text, ['resistance'])) return vocabById('em_vocab_025');
  if (isAskingTerm(text, ['conductor'])) return vocabById('em_vocab_014');
  if (isAskingTerm(text, ['insulator'])) return vocabById('em_vocab_015');
  if (isAskingTerm(text, ['electroscope'])) return vocabById('em_vocab_013');
  if (isAskingTerm(text, ['electric field'])) return vocabById('em_vocab_012');
  if (isAskingTerm(text, ['static electricity'])) return vocabById('em_vocab_011');
  if (isAskingTerm(text, ['conduction']) && hasAnyPhrase(text, ['electric charging', 'charge', 'charging'])) return vocabById('em_vocab_018');
  if (isAskingTerm(text, ['induction']) && hasAnyPhrase(text, ['charge', 'charging', 'distance'])) return vocabById('em_vocab_020');
  if (hasPhrase(text, 'in circuits') && hasPhrase(text, 'series mean')) return vocabById('em_vocab_038');
  if (hasPhrase(text, 'in circuits') && hasPhrase(text, 'parallel mean')) return vocabById('em_vocab_039');
  if (isAskingTerm(text, ['circuit'])) return vocabById('em_vocab_028');
  return null;
}

function isAskingTerm(text, terms) {
  if (!hasDefinitionIntent(text)) return false;
  return terms.some((term) => hasPhrase(text, term));
}

function asksOpenClosedCircuitDifference(text) {
  return /\bopen\b/.test(text) &&
    /\bclosed\b/.test(text) &&
    /\bcircuits?\b/.test(text) &&
    /\b(?:difference|different|vs|versus|compare|explain)\b/.test(text);
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

function vocabById(id) {
  const term = VOCAB.find((item) => item.id === id) || null;
  if (!term) return null;
  return {
    id: term.id,
    kind: 'electricity_vocab',
    answer: term.answer
  };
}

function localConcept(id, answer) {
  return { id, answer };
}

function localVocab(id, answer) {
  return { id, kind: 'electricity_vocab', answer };
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

function hasAnyPhrase(text, phrases) {
  return phrases.some((phrase) => hasPhrase(text, phrase));
}

function hasNumbers(text) {
  return /\d/.test(text);
}

function shouldLeaveForMotionForceVocab(text) {
  if (hasPhrase(text, 'air resistance')) return true;
  if (hasAnyPhrase(text, ['rolling friction', 'sliding friction', 'static friction'])) return true;
  if (hasPhrase(text, 'friction') && !hasAnyPhrase(text, [
    'electric charging',
    'static electricity',
    'static charge',
    'charge transfer',
    'charging by friction',
    'rubbing a balloon',
    'rubbing socks',
    'electricity'
  ])) {
    return true;
  }
  return false;
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
    .replace(/\blightening\b/g, 'lightning')
    .replace(/[^a-z0-9µμ.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  tryElectricityVocab
};
