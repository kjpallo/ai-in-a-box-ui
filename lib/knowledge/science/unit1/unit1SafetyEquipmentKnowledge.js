const { buildUnit1SafetyEquipmentPacket } = require('./unit1SafetyEquipmentPacketAdapter');

const UNIT = 'Unit 1';
const CHUNK = 'lab-safety-equipment';

const SAFETY_FACTS = [
  {
    id: 'unit1.safety.goggles',
    type: 'safety_equipment',
    canonicalTerm: 'safety goggles',
    aliases: ['goggles', 'safety glasses', 'eye protection'],
    typoAliases: ['safty goggles', 'saftey goggles', 'gogles'],
    studentWording: ['what are goggles for', 'why do we wear goggles', 'when should i wear goggles'],
    definition: 'Safety goggles protect your eyes.',
    use: 'Wear goggles when using chemicals, fire, glassware, or anything that could splash or break.',
    safetyRule: 'Keep goggles on during labs when the teacher requires eye protection.',
    sourceRefs: ['unit1.corpus.0009', 'unit1.corpus.0223'],
    related: ['chemicals', 'fire', 'glassware'],
    answerTemplate: 'Safety goggles protect your eyes when using chemicals, fire, glassware, or anything that could splash or break.'
  },
  {
    id: 'unit1.safety.apron',
    type: 'safety_equipment',
    canonicalTerm: 'lab apron',
    aliases: ['apron', 'aprons', 'lab coat'],
    typoAliases: ['lab aproon'],
    studentWording: ['what is a lab apron for', 'why wear an apron'],
    definition: 'A lab apron protects your clothing and skin during lab work.',
    use: 'Wear it when chemicals or messy lab materials could spill.',
    safetyRule: 'Use protective clothing when directed by the teacher.',
    sourceRefs: ['unit1.corpus.0010'],
    related: ['chemicals', 'spills'],
    answerTemplate: 'An apron protects your skin and clothes from spills and splashes during a lab.'
  },
  {
    id: 'unit1.safety.heat_resistant_gloves',
    type: 'safety_equipment',
    canonicalTerm: 'heat-resistant gloves',
    aliases: ['heat resistant gloves', 'heat gloves', 'hot gloves', 'thermal gloves'],
    typoAliases: [],
    studentWording: ['what are heat gloves for', 'why use heat resistant gloves'],
    definition: 'Heat-resistant gloves protect your hands from hot objects.',
    use: 'Use them when handling hot glassware or heated equipment.',
    safetyRule: 'Do not grab hot objects with bare hands.',
    sourceRefs: ['unit1.corpus.0006'],
    related: ['hot glass', 'hot plate', 'Bunsen burner'],
    answerTemplate: 'Heat-resistant gloves protect your hands from hot objects.'
  },
  {
    id: 'unit1.safety.read_lab_first',
    type: 'safety_rule',
    canonicalTerm: 'read the lab before starting',
    aliases: ['read the instructions', 'read the lab', 'read directions'],
    typoAliases: [],
    studentWording: ['what should i do before starting a lab', 'first thing before lab'],
    definition: 'Read the lab before starting so you understand what to do safely.',
    use: 'Read all steps, materials, and safety rules before doing anything.',
    safetyRule: 'Read the lab all the way through before doing anything else.',
    sourceRefs: ['unit1.corpus.0001', 'unit1.corpus.0191'],
    related: ['procedure', 'materials', 'safety rules'],
    answerTemplate: 'Read the lab first so you understand the steps, materials, and safety rules before doing anything.'
  },
  {
    id: 'unit1.safety.neat_lab_table',
    type: 'safety_rule',
    canonicalTerm: 'neat lab table',
    aliases: ['lab table neat', 'desk neat', 'organized lab table'],
    typoAliases: [],
    studentWording: ['why keep my lab table neat', 'why should my desk be organized in lab'],
    definition: 'A neat lab table lowers the chance of accidents.',
    use: 'Keep only needed materials on the table.',
    safetyRule: 'Keep the lab table or desk neat and organized.',
    sourceRefs: ['unit1.corpus.0002'],
    related: ['spills', 'broken equipment'],
    answerTemplate: 'A neat lab table helps prevent spills, broken equipment, and accidents.'
  },
  {
    id: 'unit1.safety.emergency_tell_teacher',
    type: 'safety_rule',
    canonicalTerm: 'tell the teacher in emergencies',
    aliases: ['emergency', 'accident', 'injury'],
    typoAliases: [],
    studentWording: ['what should i do in an emergency in lab', 'lab accident what should i do'],
    definition: 'In a lab emergency, tell the teacher right away.',
    use: 'Report emergencies immediately, even if they seem minor.',
    safetyRule: 'Tell the teacher immediately before doing anything else, unless the teacher’s safety procedure says otherwise.',
    sourceRefs: ['unit1.corpus.0003', 'unit1.corpus.0176'],
    related: ['chemical spill', 'fire', 'broken glass'],
    answerTemplate: 'Tell the teacher immediately before doing anything else, unless the teacher’s safety procedure says otherwise.'
  },
  {
    id: 'unit1.safety.ask_teacher',
    type: 'safety_rule',
    canonicalTerm: 'ask the teacher when unsure',
    aliases: ['ask the teacher', 'when in doubt', 'not sure what to do', 'unsure'],
    typoAliases: [],
    studentWording: ['what should i do if i am not sure in lab', 'when in doubt lab'],
    definition: 'If you are unsure in a lab, ask the teacher.',
    use: 'Ask before guessing, mixing, heating, or disposing of materials.',
    safetyRule: 'When in doubt, ask the teacher.',
    sourceRefs: ['unit1.corpus.0001'],
    related: ['procedure', 'chemicals'],
    answerTemplate: 'Ask the teacher before continuing.'
  },
  {
    id: 'unit1.safety.no_horseplay',
    type: 'safety_rule',
    canonicalTerm: 'no horseplay',
    aliases: ['no goofing around', 'horseplay', 'goof around', 'playing around'],
    typoAliases: [],
    studentWording: ['why should you not goof around in lab', 'why no horseplay in lab'],
    definition: 'Horseplay in lab is unsafe.',
    use: 'Take labs seriously and move carefully.',
    safetyRule: 'Do not goof around in lab.',
    sourceRefs: ['unit1.corpus.0001'],
    related: ['spills', 'broken glass', 'burns'],
    answerTemplate: 'Horseplay can cause spills, broken glass, burns, or other injuries.'
  },
  {
    id: 'unit1.safety.fire_extinguisher',
    type: 'safety_equipment',
    canonicalTerm: 'fire extinguisher',
    aliases: ['extinguisher'],
    typoAliases: ['fire extenguisher', 'fire extinguiser'],
    studentWording: ['what is a fire extinguisher used for', 'what does pass stand for'],
    definition: 'A fire extinguisher is used to put out certain fires.',
    use: 'Use only as directed by the teacher or safety procedure.',
    safetyRule: 'PASS means Pull, Aim, Squeeze, Sweep.',
    sourceRefs: ['unit1.corpus.0004', 'unit1.corpus.0192'],
    related: ['PASS', 'fire blanket'],
    answerTemplate: 'A fire extinguisher is used to put out certain fires. PASS stands for Pull, Aim, Squeeze, Sweep.'
  },
  {
    id: 'unit1.safety.fire_blanket',
    type: 'safety_equipment',
    canonicalTerm: 'fire blanket',
    aliases: ['blanket'],
    typoAliases: [],
    studentWording: ['what is a fire blanket used for', 'person on fire blanket'],
    definition: 'A fire blanket can smother flames.',
    use: 'It is best for a person whose clothing is on fire.',
    safetyRule: 'Use the class fire procedure and tell the teacher immediately.',
    sourceRefs: ['unit1.corpus.0001'],
    related: ['clothing fire', 'stop drop roll'],
    answerTemplate: 'A fire blanket can smother flames and is best for a person whose clothing is on fire.'
  },
  {
    id: 'unit1.safety.clothing_fire',
    type: 'safety_rule',
    canonicalTerm: 'clothing catches fire',
    aliases: ['clothes catch fire', 'clothing catches fire', 'person on fire'],
    typoAliases: [],
    studentWording: ['what should you do if someone clothes catch on fire', 'lab partner clothes on fire'],
    definition: 'Use the class safety procedure if clothing catches fire.',
    use: 'Stop, drop, and roll or use a fire blanket depending on the teacher’s procedure.',
    safetyRule: 'Tell the teacher immediately and follow the class fire procedure.',
    sourceRefs: ['unit1.corpus.0176'],
    related: ['fire blanket', 'teacher emergency'],
    answerTemplate: 'Use the class safety procedure, such as stop, drop, and roll or a fire blanket, and tell the teacher immediately.'
  },
  {
    id: 'unit1.safety.hair_clothing_jewelry',
    type: 'safety_rule',
    canonicalTerm: 'secure hair and clothing',
    aliases: ['tie back hair', 'loose clothing', 'loose jewelry', 'jewelry'],
    typoAliases: [],
    studentWording: ['why tie back long hair near flames', 'why no loose clothing in lab'],
    definition: 'Loose hair, clothing, or jewelry can create hazards in lab.',
    use: 'Tie back long hair and avoid loose clothing or jewelry.',
    safetyRule: 'Keep hair, clothing, and jewelry away from flames, chemicals, and equipment.',
    sourceRefs: ['unit1.corpus.0001'],
    related: ['fire', 'chemicals', 'equipment'],
    answerTemplate: 'Loose hair, clothing, or jewelry can catch fire, spill chemicals, or get caught on equipment.'
  },
  {
    id: 'unit1.safety.no_eating_drinking_tasting',
    type: 'safety_rule',
    canonicalTerm: 'no eating drinking or tasting chemicals',
    aliases: ['no eating', 'no drinking', 'do not taste chemicals', 'never taste chemicals'],
    typoAliases: [],
    studentWording: ['why no eating in lab', 'why should you never taste chemicals'],
    definition: 'Food, drinks, and chemicals do not belong in your mouth during lab.',
    use: 'Keep food and drinks out of lab and never taste chemicals.',
    safetyRule: 'Do not eat, drink, or taste chemicals in lab.',
    sourceRefs: ['unit1.corpus.0001'],
    related: ['chemicals', 'contamination'],
    answerTemplate: 'Food or drinks can become contaminated, and chemicals can be poisonous, irritating, or unsafe. Never taste chemicals.'
  },
  {
    id: 'unit1.safety.waft',
    type: 'safety_rule',
    canonicalTerm: 'waft',
    aliases: ['wafting', 'smell chemicals', 'smell a chemical'],
    typoAliases: ['waff', 'waffing'],
    studentWording: ['what does waft mean', 'why do you waft chemicals'],
    definition: 'Wafting means gently moving fumes toward your nose instead of smelling directly.',
    use: 'Use wafting when directed to smell a substance.',
    safetyRule: 'Waft instead of putting your nose directly over a chemical.',
    sourceRefs: ['unit1.corpus.0005'],
    related: ['chemical fumes', 'smell'],
    answerTemplate: 'Wafting means gently moving fumes toward your nose instead of smelling directly. It reduces how much chemical vapor you inhale.'
  },
  {
    id: 'unit1.safety.chemical_disposal',
    type: 'safety_rule',
    canonicalTerm: 'chemical disposal',
    aliases: ['pour chemicals down the sink', 'dispose chemicals', 'chemical disposal'],
    typoAliases: [],
    studentWording: ['can i pour chemicals down the sink', 'what do before pouring chemicals down sink'],
    definition: 'Chemical disposal depends on the chemical and class directions.',
    use: 'Ask before pouring chemicals down the sink.',
    safetyRule: 'Ask the teacher or follow disposal directions.',
    sourceRefs: ['unit1.corpus.0008'],
    related: ['chemicals', 'teacher directions'],
    answerTemplate: 'Ask the teacher or follow disposal directions before pouring chemicals down the sink.'
  },
  {
    id: 'unit1.safety.chemical_spill_exposure',
    type: 'safety_rule',
    canonicalTerm: 'chemical spill or exposure',
    aliases: ['chemical spill', 'spill a chemical', 'chemical on skin', 'chemical in eyes', 'eyewash', 'safety shower'],
    typoAliases: [],
    studentWording: ['what should i do if i spill a chemical', 'chemical gets on skin or eyes'],
    definition: 'Chemical spills and exposure should be reported immediately.',
    use: 'Tell the teacher and follow cleanup or eyewash/safety shower directions.',
    safetyRule: 'Tell the teacher immediately and use the eyewash or safety shower if directed.',
    sourceRefs: ['unit1.corpus.0003'],
    related: ['eyewash', 'safety shower', 'spill cleanup'],
    answerTemplate: 'Tell the teacher immediately and follow cleanup directions. If a chemical gets on your skin or in your eyes, tell the teacher and use the eyewash or safety shower if directed.'
  },
  {
    id: 'unit1.safety.hot_glass',
    type: 'safety_rule',
    canonicalTerm: 'hot glass',
    aliases: ['hot glass', 'hot glassware'],
    typoAliases: ['hot glas'],
    studentWording: ['why is hot glass dangerous', 'what should i do with hot glass'],
    definition: 'Hot glass can look like cold glass.',
    use: 'Handle recently heated glassware with proper safety equipment.',
    safetyRule: 'Treat hot glass carefully because it may not look hot.',
    sourceRefs: ['unit1.corpus.0006'],
    related: ['heat-resistant gloves', 'beaker tongs'],
    answerTemplate: 'Hot glass is dangerous because it looks like cold glass, so handle it carefully with safety equipment.'
  },
  {
    id: 'unit1.safety.broken_glass',
    type: 'safety_rule',
    canonicalTerm: 'broken glass',
    aliases: ['broken glass', 'shattered glass', 'test tube shatters'],
    typoAliases: [],
    studentWording: ['where does broken glass go', 'what should i do with broken glass'],
    definition: 'Broken glass must go in the proper broken-glass container.',
    use: 'Tell the teacher and do not put broken glass in regular trash.',
    safetyRule: 'Use a special broken-glass container, not the regular trash.',
    sourceRefs: ['unit1.corpus.0007', 'unit1.corpus.0193'],
    related: ['test tube', 'glassware'],
    answerTemplate: 'Tell the teacher right away. Do not pick up broken glass with your bare hands; use the cleanup method your teacher gives you.'
  },
  {
    id: 'unit1.safety.closed_toed_shoes',
    type: 'safety_rule',
    canonicalTerm: 'closed-toed shoes',
    aliases: ['closed toed shoes', 'closed-toed shoes', 'long pants'],
    typoAliases: [],
    studentWording: ['why wear closed toed shoes in lab'],
    definition: 'Closed-toed shoes protect your feet in lab.',
    use: 'Wear them to protect against spills, broken glass, and dropped equipment.',
    safetyRule: 'Wear closed-toed shoes when required for lab.',
    sourceRefs: ['unit1.corpus.0001'],
    related: ['spills', 'broken glass'],
    answerTemplate: 'Closed-toed shoes protect your feet from spills, broken glass, and dropped equipment.'
  }
].map((fact) => ({
  unit: UNIT,
  chunk: CHUNK,
  examples: [],
  nonExamples: [],
  commonMisconceptions: [],
  route: 'direct_answer',
  ...fact
}));

const EQUIPMENT_FACTS = [
  equipment('unit1.equipment.graduated_cylinder', 'graduated cylinder', ['grad cylinder'], ['graduated cylender'], 'A graduated cylinder measures liquid volume more precisely.', 'unit1.corpus.0012'),
  equipment('unit1.equipment.erlenmeyer_flask', 'Erlenmeyer flask', ['flask'], ['erlenmeyer'], 'An Erlenmeyer flask can hold, mix, and heat liquids.', 'unit1.corpus.0013'),
  equipment('unit1.equipment.test_tube_holder', 'test tube holder', [], ['testube holder'], 'A test tube holder holds a test tube, especially when heating it.', 'unit1.corpus.0014'),
  equipment('unit1.equipment.test_tube_rack', 'test tube rack', [], ['testube rack'], 'A test tube rack holds multiple test tubes upright.', 'unit1.corpus.0015'),
  equipment('unit1.equipment.test_tube', 'test tube', [], ['testube'], 'A test tube is used for small chemical reactions or holding small amounts of substances.', 'unit1.corpus.0193'),
  equipment('unit1.equipment.hot_plate', 'hot plate', [], [], 'A hot plate uses electricity to heat substances.', 'unit1.corpus.0016'),
  equipment('unit1.equipment.bunsen_burner', 'Bunsen burner', ['burner'], ['bunson burner'], 'A Bunsen burner uses a gas flame to heat substances.', 'unit1.corpus.0017'),
  equipment('unit1.equipment.ring_stand', 'ring stand', [], [], 'A ring stand supports equipment during heating or experiments.', 'unit1.corpus.0018'),
  equipment('unit1.equipment.iron_ring_wire_gauze', 'iron ring and wire gauze', ['iron ring', 'wire gauze'], [], 'An iron ring and wire gauze support containers above a flame or heat source.', 'unit1.corpus.0018'),
  equipment('unit1.equipment.digital_scale', 'digital scale', ['scale', 'balance'], [], 'A digital scale measures mass, often in grams.', 'unit1.corpus.0001'),
  equipment('unit1.equipment.meter_stick', 'meter stick', ['meterstick'], ['meter stik'], 'A meter stick measures length or distance.', 'unit1.corpus.0001'),
  equipment('unit1.equipment.thermometer', 'thermometer', [], ['thermomiter'], 'A thermometer measures temperature.', 'unit1.corpus.0001'),
  equipment('unit1.equipment.funnel', 'funnel', [], ['funel'], 'A funnel helps pour liquids or powders into a container without spilling.', 'unit1.corpus.0001'),
  equipment('unit1.equipment.beaker_tongs', 'beaker tongs', ['tongs'], [], 'Beaker tongs hold or move a hot beaker.', 'unit1.corpus.0019'),
  equipment('unit1.equipment.spatula', 'spatula', [], [], 'A spatula transfers solid chemicals.', 'unit1.corpus.0001'),
  equipment('unit1.equipment.pipette', 'pipette', [], ['pippette'], 'A pipette transfers small precise amounts of liquid.', 'unit1.corpus.0001'),
  equipment('unit1.equipment.dropper', 'dropper', [], [], 'A dropper transfers liquids drop by drop.', 'unit1.corpus.0001'),
  equipment('unit1.equipment.mortar_pestle', 'mortar and pestle', ['mortar', 'pestle'], [], 'A mortar and pestle grind solids into powder.', 'unit1.corpus.0020'),
  equipment('unit1.equipment.watch_glass', 'watch glass', [], [], 'A watch glass can cover a beaker or hold small samples.', 'unit1.corpus.0001'),
  equipment('unit1.equipment.beaker', 'beaker', [], ['beeker'], 'A beaker is used for holding, mixing, heating, and roughly measuring liquids or solids.', 'unit1.corpus.0011')
];

const ALL_FACTS = [...SAFETY_FACTS, ...EQUIPMENT_FACTS];

const UNIT1_SAFETY_EQUIPMENT_PACKET = buildUnit1SafetyEquipmentPacket({
  facts: ALL_FACTS,
  matcherName: 'tryUnit1SafetyEquipmentKnowledge'
});

function tryUnit1SafetyEquipmentKnowledge(message) {
  const text = normalize(message);
  if (!text) return null;
  if (looksLikeFormulaOrCalculationPrompt(text) || looksLikeNonLabWavePrompt(text)) return null;

  const fact = findMatchingFact(text);
  if (!fact) return null;

  return {
    type: fact.type === 'safety_rule' ? 'science_concept' : 'definition',
    confidence: 'strong',
    toolsUsed: ['unit1_safety_equipment_knowledge'],
    notes: `Answered Unit 1 Safety/Equipment fact: ${fact.id}.`,
    directAnswer: fact.answerTemplate,
    aiAllowed: false,
    knowledgeRefs: fact.sourceRefs
  };
}

function findMatchingFact(text) {
  const passFact = SAFETY_FACTS.find((fact) => fact.id === 'unit1.safety.fire_extinguisher');
  if (isPassFireExtinguisherQuestion(text)) return passFact;

  const clothesFireFact = factById('unit1.safety.clothing_fire');
  if (/(clothes|clothing|person|partner).{0,30}\b(catch|catches|caught|on)\b.{0,15}\bfire\b|\bfire\b.{0,20}\b(clothes|clothing)\b/.test(text)) return clothesFireFact;

  const spillFact = factById('unit1.safety.chemical_spill_exposure');
  if (/\b(spill|spilled|spills)\b/.test(text) && /\b(chemical|acid|base|solution|lab)\b/.test(text)) return spillFact;
  if (/\bchemical\b/.test(text) && /\b(skin|eyes?|eyewash|shower|exposure)\b/.test(text)) return spillFact;

  const noTasteFact = factById('unit1.safety.no_eating_drinking_tasting');
  if (/\b(taste|eat|drink|food)\b/.test(text) && /\b(lab|chemical|chemicals?)\b/.test(text)) return noTasteFact;

  const disposalFact = factById('unit1.safety.chemical_disposal');
  if (/\b(pour|dump|dispose|disposal)\b/.test(text) && /\b(chemical|chemicals?|sink)\b/.test(text)) return disposalFact;

  const brokenGlassFact = factById('unit1.safety.broken_glass');
  if (/\b(break|broke|broken|shattered)\b.{0,20}\bglass\b/.test(text) && /\b(lab|class|science|glass|teacher|what|should|do)\b/.test(text)) return brokenGlassFact;
  if (/\bglass\b.{0,20}\b(break|broke|broken|shattered)\b/.test(text) && /\b(lab|class|science|glass|teacher|what|should|do)\b/.test(text)) return brokenGlassFact;

  const hairFact = factById('unit1.safety.hair_clothing_jewelry');
  if (/\b(hair|loose clothing|jewelry|jewellery)\b/.test(text) && /\b(flame|fire|lab|chemical|equipment|tie|wear)\b/.test(text)) return hairFact;

  for (const fact of ALL_FACTS) {
    if (matchesFact(text, fact)) return fact;
  }
  return null;
}

function looksLikeFormulaOrCalculationPrompt(text) {
  if (!/\d/.test(text)) return false;
  return /\b(calculate|find|solve|determine|density|mass|volume|speed|period|frequency|wavelength|velocity|current|voltage|resistance|power|work|energy|convert|conversion|scientific notation)\b/.test(text);
}

function looksLikeNonLabWavePrompt(text) {
  if (/\b(night vision|remote controls?|infrared|electromagnetic|radio wave|microwave|wave|waves)\b/.test(text)) {
    return !/\b(lab|safety|protect|eyes?|chemicals?|fire|glassware|splash|break|wear)\b/.test(text);
  }
  return false;
}

function isPassFireExtinguisherQuestion(text) {
  if (!/\bpass\b/.test(text)) return false;
  return /\bwhat\s+(?:does\s+)?pass\s+(?:stand\s+for|mean)\b/.test(text)
    || /\bwhat\s+is\s+pass\b/.test(text)
    || /\bpass\b.{0,30}\b(fire|extinguisher)\b/.test(text)
    || /\b(fire|extinguisher)\b.{0,30}\bpass\b/.test(text);
}

function matchesFact(text, fact) {
  const terms = [fact.canonicalTerm, ...(fact.aliases || []), ...(fact.typoAliases || [])]
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!terms.some((term) => hasTerm(text, term))) return false;

  if (fact.type === 'safety_rule') {
    return /\b(what|why|when|where|how|should|do|does|mean|stand|used|use|for|lab|safety|dangerous)\b/.test(text);
  }

  return /\b(what|why|when|where|how|used|use|for|does|mean|is|are|name|lab|equipment|measure|measures|heat|hold|holds|transfer|grind|protect)\b/.test(text);
}

function hasTerm(text, term) {
  if (!term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

function factById(id) {
  return ALL_FACTS.find((fact) => fact.id === id);
}

function equipment(id, canonicalTerm, aliases, typoAliases, answerTemplate, sourceRef) {
  return {
    id,
    unit: UNIT,
    chunk: CHUNK,
    type: 'equipment',
    canonicalTerm,
    aliases,
    typoAliases,
    studentWording: [`what is ${canonicalTerm} used for`, `what is a ${canonicalTerm}`],
    definition: answerTemplate,
    use: answerTemplate,
    examples: [],
    nonExamples: [],
    commonMisconceptions: [],
    safetyRule: '',
    sourceRefs: [sourceRef],
    related: [],
    route: 'direct_answer',
    answerTemplate
  };
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[-‐‑‒–—]/g, ' ')
    .replace(/\bsaftey\b/g, 'safety')
    .replace(/\bsafty\b/g, 'safety')
    .replace(/\bgogles\b/g, 'goggles')
    .replace(/\baproon\b/g, 'apron')
    .replace(/\bextenguisher\b/g, 'extinguisher')
    .replace(/\bextinguiser\b/g, 'extinguisher')
    .replace(/\bwaff(?:ing)?\b/g, 'wafting')
    .replace(/\bbunson\b/g, 'bunsen')
    .replace(/\bcylender\b/g, 'cylinder')
    .replace(/\bfunel\b/g, 'funnel')
    .replace(/\btestube\b/g, 'test tube')
    .replace(/\bglas\b/g, 'glass')
    .replace(/\bbeeker\b/g, 'beaker')
    .replace(/\bstik\b/g, 'stick')
    .replace(/\bthermomiter\b/g, 'thermometer')
    .replace(/\bpippette\b/g, 'pipette')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  ALL_UNIT1_SAFETY_EQUIPMENT_FACTS: ALL_FACTS,
  UNIT1_SAFETY_EQUIPMENT_PACKET,
  tryUnit1SafetyEquipmentKnowledge
};
