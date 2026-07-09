const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

const BUILTIN_PACKET_REGISTRY = Object.freeze([
  {
    packetId: 'unit1-measurement',
    unit: 1,
    unitTitle: 'Science Practices',
    topic: 'Measurement/Data Quality',
    modulePath: 'lib/knowledge/science/unit1/unit1MeasurementKnowledge.js',
    moduleName: 'Unit 1 Measurement/Data Quality',
    packetExportName: 'UNIT1_MEASUREMENT_PACKET',
    matcherName: 'tryUnit1MeasurementKnowledge',
    factExportName: 'ALL_UNIT1_MEASUREMENT_FACTS',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: ['Normalized packet export for the built-in Unit 1 measurement/data quality curriculum.'],
    testPatterns: [/unit1-measurement/i, /unit1-representative-content-audit/i, /unit1-whole-unit-smoke/i],
    touchpointPatterns: [/Unit1Measurement|unit1Measurement|tryUnit1MeasurementKnowledge/i]
  },
  {
    packetId: 'unit1-safety-equipment',
    unit: 1,
    unitTitle: 'Science Practices',
    topic: 'Safety/Equipment',
    modulePath: 'lib/knowledge/science/unit1/unit1SafetyEquipmentKnowledge.js',
    moduleName: 'Unit 1 Safety/Equipment',
    packetExportName: 'UNIT1_SAFETY_EQUIPMENT_PACKET',
    matcherName: 'tryUnit1SafetyEquipmentKnowledge',
    factExportName: 'ALL_UNIT1_SAFETY_EQUIPMENT_FACTS',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: ['Normalized packet export for the built-in Unit 1 safety/equipment curriculum.'],
    testPatterns: [/unit1-safety-equipment/i, /unit1-representative-content-audit/i, /unit1-whole-unit-smoke/i],
    touchpointPatterns: [/Unit1SafetyEquipment|unit1SafetyEquipment|tryUnit1SafetyEquipmentKnowledge/i]
  },
  {
    packetId: 'unit1-scientific-method',
    unit: 1,
    unitTitle: 'Science Practices',
    topic: 'Scientific Method',
    modulePath: 'lib/knowledge/science/unit1/unit1ScientificMethodKnowledge.js',
    moduleName: 'Unit 1 Scientific Method',
    packetExportName: 'UNIT1_SCIENTIFIC_METHOD_PACKET',
    matcherName: 'tryUnit1ScientificMethodKnowledge',
    factExportName: 'ALL_UNIT1_SCIENTIFIC_METHOD_FACTS',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: ['Normalized packet export for the built-in Unit 1 scientific method curriculum.'],
    testPatterns: [
      /unit1-scientific-method/i,
      /concept-tutor-unit1-variables/i,
      /unit1-representative-content-audit/i,
      /unit1-whole-unit-smoke/i
    ],
    touchpointPatterns: [/Unit1ScientificMethod|unit1ScientificMethod|tryUnit1ScientificMethodKnowledge|scientific method|independent variable|dependent variable/i]
  },
  {
    packetId: 'unit1-graphing-data',
    unit: 1,
    unitTitle: 'Science Practices',
    topic: 'Graphing/Data',
    modulePath: 'lib/knowledge/science/unit1/unit1GraphingDataKnowledge.js',
    moduleName: 'Unit 1 Graphing/Data',
    packetExportName: 'UNIT1_GRAPHING_DATA_PACKET',
    matcherName: 'tryUnit1GraphingDataKnowledge',
    factExportName: 'ALL_UNIT1_GRAPHING_DATA_FACTS',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: ['Normalized packet export for the built-in Unit 1 graphing/data curriculum.'],
    testPatterns: [
      /unit1-graphing-data/i,
      /concept-tutor-unit1-graphing-axis/i,
      /unit1-representative-content-audit/i,
      /unit1-whole-unit-smoke/i
    ],
    touchpointPatterns: [/Unit1GraphingData|unit1GraphingData|tryUnit1GraphingDataKnowledge|graphing axis/i]
  },
  {
    packetId: 'unit1-conversions-notation',
    unit: 1,
    unitTitle: 'Science Practices',
    topic: 'Conversions/Notation',
    modulePath: 'lib/knowledge/science/unit1/unit1ConversionsNotationKnowledge.js',
    moduleName: 'Unit 1 Conversions/Notation',
    packetExportName: 'UNIT1_CONVERSIONS_NOTATION_PACKET',
    matcherName: 'tryUnit1ConversionsNotationKnowledge',
    factExportName: 'ALL_UNIT1_CONVERSIONS_NOTATION_FACTS',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: ['Normalized packet export for the built-in Unit 1 conversions/scientific notation curriculum.'],
    testPatterns: [
      /unit1-conversions-notation/i,
      /student-tutor-ui/i,
      /unit1-representative-content-audit/i,
      /unit1-whole-unit-smoke/i
    ],
    touchpointPatterns: [/Unit1Conversions|unit1Conversions|ConversionsNotation|conversionsNotation|tryUnit1ConversionsNotation|unit1_conversions/i]
  },
  {
    packetId: 'unit3-energy',
    unit: 3,
    unitTitle: 'Energy',
    topic: 'Energy',
    modulePath: 'lib/knowledge/physics/energy/unit3EnergyKnowledge.js',
    moduleName: 'Unit 3 Energy',
    packetExportName: 'UNIT3_ENERGY_PACKET',
    matcherName: 'tryUnit3EnergyKnowledge',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: ['Normalized packet export for the built-in Unit 3 energy curriculum.'],
    testPatterns: [/energy-unit3/i, /concept-tutor-energy/i, /concept-tutor-mechanical-energy/i],
    touchpointPatterns: [/Unit3Energy|unit3Energy|tryUnit3EnergyKnowledge|kinetic energy|potential energy|mechanical energy/i]
  },
  {
    packetId: 'motion-force',
    unit: null,
    unitTitle: 'Motion and Force',
    topic: 'Motion/Force',
    modulePath: 'lib/knowledge/physics/motion-force/index.js',
    moduleName: 'Motion/Force modular packet',
    packetExportName: 'MOTION_FORCE_PACKET',
    matcherName: 'tryMotionForceKnowledge',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: ['Packet adapter over the checked-in motion/force module data; direct matcher lives in motionForceKnowledge.js.'],
    testPatterns: [/motion-force/i, /motion-honors/i, /concept-tutor-(acceleration|balanced-forces|distance-displacement|newtons-laws|reference-point|speed-velocity)/i],
    touchpointPatterns: [/motion-force|MotionForce|motionForce|tryMotionForceKnowledge|newtons laws|balanced forces|reference point/i]
  },
  {
    packetId: 'unit5-waves',
    unit: 5,
    unitTitle: 'Waves',
    topic: 'Waves',
    modulePath: 'lib/knowledge/physics/waves/unit5WavesKnowledge.js',
    moduleName: 'Unit 5 Waves',
    packetExportName: 'UNIT5_WAVES_PACKET',
    matcherName: 'tryUnit5WavesKnowledge',
    factExportName: 'UNIT5_WAVE_FACTS',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: ['Normalized packet export for the built-in Unit 5 waves curriculum.'],
    testPatterns: [/waves-unit5/i, /concept-tutor-wave/i],
    touchpointPatterns: [/Unit5Waves|unit5Waves|tryUnit5WavesKnowledge|wave speed|wavelength|frequency/i]
  },
  {
    packetId: 'unit6-matter',
    unit: 6,
    unitTitle: 'Matter',
    topic: 'Matter',
    modulePath: 'lib/knowledge/physics/matter/unit6MatterKnowledge.js',
    moduleName: 'Unit 6 Matter',
    packetExportName: 'UNIT6_MATTER_PACKET',
    matcherName: 'tryUnit6MatterKnowledge',
    factExportName: 'UNIT6_MATTER_FACTS',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: ['Normalized packet export for the built-in Unit 6 matter curriculum.'],
    testPatterns: [/matter-unit6/i, /concept-tutor-(acids-bases|element-compound-mixture|mixtures|physical-chemical-change)/i],
    touchpointPatterns: [/Unit6Matter|unit6Matter|tryUnit6MatterKnowledge|mixture|compound|physical change|chemical change/i]
  },
  {
    packetId: 'unit7-atomic-structure',
    unit: 7,
    unitTitle: 'Atomic Structure',
    topic: 'Atomic Structure',
    modulePath: 'lib/knowledge/chemistry/atomicStructure/unit7AtomicStructureKnowledge.js',
    moduleName: 'Unit 7 Atomic Structure',
    packetExportName: 'UNIT7_ATOMIC_STRUCTURE_PACKET',
    matcherName: 'tryUnit7AtomicStructureKnowledge',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: ['Normalized packet export for the built-in Unit 7 atomic structure curriculum.'],
    testPatterns: [/unit7-atomic-structure/i],
    touchpointPatterns: [/Unit7AtomicStructure|unit7AtomicStructure|tryUnit7AtomicStructureKnowledge|AtomicStructure|atomicStructure/i]
  },
  {
    packetId: 'unit8-bonding',
    unit: 8,
    unitTitle: 'Bonding',
    topic: 'Bonding',
    modulePath: 'lib/knowledge/chemistry/bonding/unit8BondingKnowledge.js',
    moduleName: 'Unit 8 Bonding',
    packetExportName: 'UNIT8_BONDING_PACKET',
    matcherName: 'tryUnit8BondingKnowledge',
    factExportName: 'UNIT8_BONDING_FACTS',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: [
      'Normalized packet export for the built-in Bonding curriculum.',
      'Unit number inferred from source filename "8 Packet - Bonding Honors - Filled.pdf"; uploaded synthesis did not state the unit number inside the materials.'
    ],
    testPatterns: [/unit8-bonding/i],
    touchpointPatterns: [/Unit8Bonding|unit8Bonding|tryUnit8BondingKnowledge|octet rule|ionic bond|covalent bond|polyatomic ion/i]
  },
  {
    packetId: 'unit9-reactions',
    unit: 9,
    unitTitle: 'Unit 9 Reactions',
    topic: 'Reactions',
    modulePath: 'lib/knowledge/chemistry/reactions/unit9ReactionsKnowledge.js',
    moduleName: 'Unit 9 Reactions',
    packetExportName: 'UNIT9_REACTIONS_PACKET',
    matcherName: 'tryUnit9ReactionsKnowledge',
    factExportName: 'UNIT9_REACTIONS_FACTS',
    status: 'packet',
    kind: 'built-in curriculum packet',
    notes: [
      'Normalized packet export for the built-in Unit 9 Reactions curriculum.',
      'Built from the grounded Reactions synthesis supplied by the user; source filenames may include Honors, but the curriculum unit is named Unit 9 Reactions.'
    ],
    testPatterns: [/unit9-reactions/i],
    touchpointPatterns: [/Unit9Reactions|unit9Reactions|tryUnit9ReactionsKnowledge|chemical reaction|reaction rate|neutralization|nuclear chemistry|fission|fusion/i]
  },
  {
    packetId: 'electricity-magnetism',
    unit: null,
    unitTitle: 'Electricity and Magnetism',
    topic: 'Electricity/Magnetism',
    modulePath: 'lib/knowledge/electricity-magnetism/electricityMagnetismKnowledgePack.js',
    moduleName: 'Electricity/Magnetism knowledge pack',
    status: 'legacy',
    kind: 'legacy built-in packet module',
    notes: ['Legacy checked-in packet module remains active as built-in curriculum content until it is converted to the standard packet shape.'],
    testPatterns: [/electricity-unit4/i, /concept-tutor-(open-closed-circuits|series-parallel-circuits)/i],
    touchpointPatterns: [/electricityMagnetism|electricity-magnetism|open circuit|series circuit|parallel circuit|Ohm/i]
  }
].map((entry) => Object.freeze(entry)));

function getBuiltinPacketRegistry() {
  return BUILTIN_PACKET_REGISTRY.map(copyRegistryEntry);
}

function getBuiltinPacketRegistryEntry(packetId) {
  const entry = BUILTIN_PACKET_REGISTRY.find((item) => item.packetId === packetId);
  return entry ? copyRegistryEntry(entry) : null;
}

function loadBuiltinPacketForRegistryEntry(entryOrPacketId) {
  const entry = typeof entryOrPacketId === 'string'
    ? getBuiltinPacketRegistryEntry(entryOrPacketId)
    : entryOrPacketId;

  if (!entry || !entry.modulePath) {
    throw new Error('A built-in packet registry entry with modulePath is required.');
  }

  const moduleExports = require(path.join(ROOT, entry.modulePath));
  const packet = entry.packetExportName ? moduleExports[entry.packetExportName] : null;
  return {
    entry: copyRegistryEntry(entry),
    moduleExports,
    packet
  };
}

function copyRegistryEntry(entry) {
  return {
    ...entry,
    notes: [...(entry.notes || [])],
    testPatterns: [...(entry.testPatterns || [])],
    touchpointPatterns: [...(entry.touchpointPatterns || [])]
  };
}

module.exports = {
  BUILTIN_PACKET_REGISTRY,
  getBuiltinPacketRegistry,
  getBuiltinPacketRegistryEntry,
  loadBuiltinPacketForRegistryEntry
};
