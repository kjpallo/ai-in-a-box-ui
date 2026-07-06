const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..', '..');
const TESTS_DIR = path.join(ROOT, 'scripts');

const PACKETS = [
  {
    id: 'approved-pack-schema',
    unit: null,
    unitTitle: 'Approved Knowledge Pack Schema',
    moduleName: 'Approved knowledge pack schema',
    filePath: 'lib/knowledge/packSchema.js',
    style: 'approved-pack schema',
    testPatterns: [/knowledge-pack/i, /approved-knowledge-pack/i]
  },
  {
    id: 'unit1-measurement',
    unit: 1,
    unitTitle: 'Science Practices',
    moduleName: 'Unit 1 Measurement/Data Quality',
    filePath: 'lib/knowledge/science/unit1/unit1MeasurementKnowledge.js',
    style: 'monolith unit module',
    factExport: 'ALL_UNIT1_MEASUREMENT_FACTS',
    testPatterns: [/unit1-measurement/i, /unit1-representative-content-audit/i, /unit1-whole-unit-smoke/i]
  },
  {
    id: 'unit1-safety-equipment',
    unit: 1,
    unitTitle: 'Science Practices',
    moduleName: 'Unit 1 Safety/Equipment',
    filePath: 'lib/knowledge/science/unit1/unit1SafetyEquipmentKnowledge.js',
    style: 'monolith unit module',
    factExport: 'ALL_UNIT1_SAFETY_EQUIPMENT_FACTS',
    testPatterns: [/unit1-safety-equipment/i, /unit1-representative-content-audit/i, /unit1-whole-unit-smoke/i]
  },
  {
    id: 'unit1-scientific-method',
    unit: 1,
    unitTitle: 'Science Practices',
    moduleName: 'Unit 1 Scientific Method',
    filePath: 'lib/knowledge/science/unit1/unit1ScientificMethodKnowledge.js',
    style: 'monolith unit module',
    factExport: 'ALL_UNIT1_SCIENTIFIC_METHOD_FACTS',
    testPatterns: [
      /unit1-scientific-method/i,
      /concept-tutor-unit1-variables/i,
      /unit1-representative-content-audit/i,
      /unit1-whole-unit-smoke/i
    ]
  },
  {
    id: 'unit1-graphing-data',
    unit: 1,
    unitTitle: 'Science Practices',
    moduleName: 'Unit 1 Graphing/Data',
    filePath: 'lib/knowledge/science/unit1/unit1GraphingDataKnowledge.js',
    style: 'monolith unit module',
    factExport: 'ALL_UNIT1_GRAPHING_DATA_FACTS',
    testPatterns: [
      /unit1-graphing-data/i,
      /concept-tutor-unit1-graphing-axis/i,
      /unit1-representative-content-audit/i,
      /unit1-whole-unit-smoke/i
    ]
  },
  {
    id: 'unit1-conversions-notation',
    unit: 1,
    unitTitle: 'Science Practices',
    moduleName: 'Unit 1 Conversions/Notation',
    filePath: 'lib/knowledge/science/unit1/unit1ConversionsNotationKnowledge.js',
    style: 'monolith unit module',
    factExport: 'ALL_UNIT1_CONVERSIONS_NOTATION_FACTS',
    testPatterns: [
      /unit1-conversions-notation/i,
      /student-tutor-ui/i,
      /unit1-representative-content-audit/i,
      /unit1-whole-unit-smoke/i
    ]
  },
  {
    id: 'unit3-energy',
    unit: 3,
    unitTitle: 'Energy',
    moduleName: 'Unit 3 Energy',
    filePath: 'lib/knowledge/physics/energy/unit3EnergyKnowledge.js',
    style: 'monolith unit module',
    testPatterns: [/energy-unit3/i, /concept-tutor-energy/i, /concept-tutor-mechanical-energy/i]
  },
  {
    id: 'motion-force',
    unit: null,
    unitTitle: 'Motion and Force',
    moduleName: 'Motion/Force modular packet',
    filePath: 'lib/knowledge/physics/motion-force/index.js',
    style: 'modular motion-force style',
    testPatterns: [/motion-force/i, /motion-honors/i, /concept-tutor-(acceleration|balanced-forces|distance-displacement|newtons-laws|reference-point|speed-velocity)/i]
  },
  {
    id: 'unit5-waves',
    unit: 5,
    unitTitle: 'Waves',
    moduleName: 'Unit 5 Waves',
    filePath: 'lib/knowledge/physics/waves/unit5WavesKnowledge.js',
    style: 'monolith unit module',
    testPatterns: [/waves-unit5/i, /concept-tutor-wave/i]
  },
  {
    id: 'unit6-matter',
    unit: 6,
    unitTitle: 'Matter',
    moduleName: 'Unit 6 Matter',
    filePath: 'lib/knowledge/physics/matter/unit6MatterKnowledge.js',
    style: 'monolith unit module',
    testPatterns: [/matter-unit6/i, /concept-tutor-(acids-bases|element-compound-mixture|mixtures|physical-chemical-change)/i]
  },
  {
    id: 'unit7-atomic-structure',
    unit: 7,
    unitTitle: 'Atomic Structure',
    moduleName: 'Unit 7 Atomic Structure',
    filePath: 'lib/knowledge/chemistry/atomicStructure/unit7AtomicStructureKnowledge.js',
    style: 'Unit 7 source-pack style',
    testPatterns: [/unit7-atomic-structure/i]
  },
  {
    id: 'electricity-magnetism',
    unit: null,
    unitTitle: 'Electricity and Magnetism',
    moduleName: 'Electricity/Magnetism knowledge pack',
    filePath: 'lib/knowledge/electricity-magnetism/electricityMagnetismKnowledgePack.js',
    style: 'CSV-backed electricity/magnetism style',
    testPatterns: [/electricity-unit4/i, /concept-tutor-(open-closed-circuits|series-parallel-circuits)/i]
  }
];

function getUnitPacketInventory() {
  const testFiles = listTestFiles();
  return PACKETS.map((packet) => buildInventoryItem(packet, testFiles));
}

function buildInventoryItem(config, testFiles = []) {
  const loaded = safeRequire(config.filePath);
  const exported = loaded.module || {};
  const sourcePack = exported.UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK || exported.sourcePack || null;
  const facts = arrayFromNamedExport(exported, config.factExport) ||
    exported.UNIT7_FACTS ||
    exported.facts ||
    exported.vocab ||
    null;

  const counts = {
    vocabulary: countArray(exported.vocabulary) || countArray(sourcePack && sourcePack.vocabulary) || countArray(exported.vocab),
    facts: countArray(facts),
    comparisons: countArray(exported.UNIT7_COMPARISON_PAIRS) || countArray(sourcePack && sourcePack.comparisonPairs),
    relationships: countArray(exported.UNIT7_RELATIONSHIP_EDGES) || countArray(sourcePack && sourcePack.relationshipEdges),
    formulas: countArray(exported.formulas) || countArray(sourcePack && sourcePack.formulasAndRules),
    conceptTutors: countArray(exported.concepts) || countArray(sourcePack && sourcePack.conceptGroups),
    examples: countExamples(facts),
    smokeTests: countArray(exported.smokeTests)
  };

  return {
    id: config.id,
    unit: config.unit,
    unitTitle: readUnitTitle(config, exported, sourcePack),
    moduleName: config.moduleName,
    filePath: config.filePath,
    absolutePath: path.join(ROOT, config.filePath),
    exists: loaded.ok,
    loadError: loaded.error,
    directKnowledgeFunctionName: findDirectKnowledgeFunctionName(exported),
    sourceMetadataPresent: hasSourceMetadata(exported, sourcePack, facts),
    counts,
    presence: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value > 0])),
    coverage: detectTestCoverage(config, testFiles),
    style: config.style,
    notes: buildNotes(config, exported, sourcePack)
  };
}

function safeRequire(filePath) {
  try {
    return {
      ok: true,
      module: require(path.join(ROOT, filePath)),
      error: ''
    };
  } catch (error) {
    return {
      ok: false,
      module: null,
      error: error && error.message ? error.message : String(error)
    };
  }
}

function arrayFromNamedExport(exported, name) {
  if (!name) return null;
  return Array.isArray(exported[name]) ? exported[name] : null;
}

function countArray(value) {
  return Array.isArray(value) ? value.length : 0;
}

function countExamples(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((total, item) => {
    if (!item || typeof item !== 'object') return total;
    return total + countArray(item.examples) + countArray(item.nonExamples);
  }, 0);
}

function readUnitTitle(config, exported, sourcePack) {
  return String(
    (exported.UNIT7_ATOMIC_STRUCTURE_METADATA && exported.UNIT7_ATOMIC_STRUCTURE_METADATA.unitTitle) ||
    (sourcePack && sourcePack.unitTitle) ||
    config.unitTitle ||
    ''
  );
}

function findDirectKnowledgeFunctionName(exported) {
  return Object.keys(exported || {}).find((key) => /^try[A-Z].*Knowledge$/.test(key)) || '';
}

function hasSourceMetadata(exported, sourcePack, facts) {
  if (sourcePack && countArray(sourcePack.sourceReferences) > 0) return true;
  if (exported.UNIT7_ATOMIC_STRUCTURE_METADATA && countArray(exported.UNIT7_ATOMIC_STRUCTURE_METADATA.sourceReferences) > 0) return true;
  if (Array.isArray(facts) && facts.some((item) => item && (countArray(item.sourceRefs) > 0 || item.sourcePages || item.source_ref || item.sourceFile))) return true;
  return false;
}

function buildNotes(config, exported, sourcePack) {
  const notes = [config.style];
  if (sourcePack) notes.push('exports structured source metadata');
  if (findDirectKnowledgeFunctionName(exported)) notes.push('exports direct knowledge matcher');
  if (Array.isArray(exported.problemBank)) notes.push('includes problem bank');
  if (Array.isArray(exported.graphPatterns)) notes.push('includes graph patterns');
  return notes;
}

function listTestFiles() {
  try {
    return fs.readdirSync(TESTS_DIR)
      .filter((name) => /^test-.*\.js$/.test(name))
      .map((name) => `scripts/${name}`)
      .sort();
  } catch (_error) {
    return [];
  }
}

function detectTestCoverage(config, allTestFiles) {
  const testFiles = allTestFiles.filter((filePath) => {
    const basename = path.basename(filePath);
    return (config.testPatterns || []).some((pattern) => pattern.test(basename));
  });

  return {
    directAnswerTestsPresent: hasMatchingTest(testFiles, /direct-answers|knowledge|regressions|representative-content-audit|whole-unit-smoke/i),
    formulaTutorTestsPresent: hasMatchingTest(testFiles, /formula|calculation-tutor|conversions-notation|student-tutor-ui/i),
    conceptTutorTestsPresent: hasMatchingTest(testFiles, /concept-tutor|concept/i),
    wholeUnitSmokeTestsPresent: hasMatchingTest(testFiles, /whole-unit-smoke/i),
    boundaryTestsPresent: hasMatchingTest(testFiles, /regressions|student-sessions|output-regressions|route|router/i),
    uiTestsPresent: hasMatchingTest(testFiles, /student-tutor-ui|questions-standards-ui|classroom-smoke|classroom-controls|live-activity-ui|teacher-content-ui/i),
    representativeAuditPresent: hasMatchingTest(testFiles, /representative-content-audit/i),
    testFiles
  };
}

function hasMatchingTest(testFiles, pattern) {
  return testFiles.some((filePath) => pattern.test(path.basename(filePath)));
}

module.exports = {
  getUnitPacketInventory
};
