const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..', '..');
const TESTS_DIR = path.join(ROOT, 'scripts');
const TOUCHPOINT_FILES = [
  'lib/router/questionRouter.js',
  'routes/studentRoutes.js',
  'lib/formulas/scienceFormulaTools.js',
  'lib/formulas/registry.js',
  'lib/tutor/conceptTutor/conceptTutorPatterns.js',
  'lib/tutor/conceptTutor/conceptTutorEngine.js',
  'lib/formulas/unit1Conversions.js',
  'lib/formulas/atomicStructure.js',
  'lib/formulas/waves.js',
  'lib/formulas/basics.js',
  'lib/formulas/motion.js',
  'lib/formulas/acceleration.js',
  'lib/formulas/density.js'
];
const TARGET_SCHEMA_FIELDS = [
  'unitTitle',
  'sourceMetadata',
  'vocabulary',
  'facts',
  'comparisons',
  'relationships',
  'formulas',
  'conceptTutors',
  'examples',
  'smokeTests',
  'directKnowledgeMatcher',
  'testCoverage',
  'routerTouchpoints'
];

const PACKETS = [
  {
    id: 'unit1-measurement',
    unit: 1,
    unitTitle: 'Science Practices',
    moduleName: 'Unit 1 Measurement/Data Quality',
    filePath: 'lib/knowledge/science/unit1/unit1MeasurementKnowledge.js',
    style: 'built-in curriculum packet',
    packetExport: 'UNIT1_MEASUREMENT_PACKET',
    factExport: 'ALL_UNIT1_MEASUREMENT_FACTS',
    testPatterns: [/unit1-measurement/i, /unit1-representative-content-audit/i, /unit1-whole-unit-smoke/i],
    touchpointPatterns: [/Unit1Measurement|unit1Measurement|tryUnit1MeasurementKnowledge/i]
  },
  {
    id: 'unit1-safety-equipment',
    unit: 1,
    unitTitle: 'Science Practices',
    moduleName: 'Unit 1 Safety/Equipment',
    filePath: 'lib/knowledge/science/unit1/unit1SafetyEquipmentKnowledge.js',
    style: 'built-in curriculum packet',
    packetExport: 'UNIT1_SAFETY_EQUIPMENT_PACKET',
    factExport: 'ALL_UNIT1_SAFETY_EQUIPMENT_FACTS',
    testPatterns: [/unit1-safety-equipment/i, /unit1-representative-content-audit/i, /unit1-whole-unit-smoke/i],
    touchpointPatterns: [/Unit1SafetyEquipment|unit1SafetyEquipment|tryUnit1SafetyEquipmentKnowledge/i]
  },
  {
    id: 'unit1-scientific-method',
    unit: 1,
    unitTitle: 'Science Practices',
    moduleName: 'Unit 1 Scientific Method',
    filePath: 'lib/knowledge/science/unit1/unit1ScientificMethodKnowledge.js',
    style: 'built-in curriculum packet',
    packetExport: 'UNIT1_SCIENTIFIC_METHOD_PACKET',
    factExport: 'ALL_UNIT1_SCIENTIFIC_METHOD_FACTS',
    testPatterns: [
      /unit1-scientific-method/i,
      /concept-tutor-unit1-variables/i,
      /unit1-representative-content-audit/i,
      /unit1-whole-unit-smoke/i
    ],
    touchpointPatterns: [/Unit1ScientificMethod|unit1ScientificMethod|tryUnit1ScientificMethodKnowledge|scientific method|independent variable|dependent variable/i]
  },
  {
    id: 'unit1-graphing-data',
    unit: 1,
    unitTitle: 'Science Practices',
    moduleName: 'Unit 1 Graphing/Data',
    filePath: 'lib/knowledge/science/unit1/unit1GraphingDataKnowledge.js',
    style: 'built-in curriculum packet',
    packetExport: 'UNIT1_GRAPHING_DATA_PACKET',
    factExport: 'ALL_UNIT1_GRAPHING_DATA_FACTS',
    testPatterns: [
      /unit1-graphing-data/i,
      /concept-tutor-unit1-graphing-axis/i,
      /unit1-representative-content-audit/i,
      /unit1-whole-unit-smoke/i
    ],
    touchpointPatterns: [/Unit1GraphingData|unit1GraphingData|tryUnit1GraphingDataKnowledge|graphing axis/i]
  },
  {
    id: 'unit1-conversions-notation',
    unit: 1,
    unitTitle: 'Science Practices',
    moduleName: 'Unit 1 Conversions/Notation',
    filePath: 'lib/knowledge/science/unit1/unit1ConversionsNotationKnowledge.js',
    style: 'built-in curriculum packet',
    packetExport: 'UNIT1_CONVERSIONS_NOTATION_PACKET',
    factExport: 'ALL_UNIT1_CONVERSIONS_NOTATION_FACTS',
    testPatterns: [
      /unit1-conversions-notation/i,
      /student-tutor-ui/i,
      /unit1-representative-content-audit/i,
      /unit1-whole-unit-smoke/i
    ],
    touchpointPatterns: [/Unit1Conversions|unit1Conversions|ConversionsNotation|conversionsNotation|tryUnit1ConversionsNotation|unit1_conversions/i]
  },
  {
    id: 'unit3-energy',
    unit: 3,
    unitTitle: 'Energy',
    moduleName: 'Unit 3 Energy',
    filePath: 'lib/knowledge/physics/energy/unit3EnergyKnowledge.js',
    style: 'built-in curriculum packet',
    packetExport: 'UNIT3_ENERGY_PACKET',
    testPatterns: [/energy-unit3/i, /concept-tutor-energy/i, /concept-tutor-mechanical-energy/i],
    touchpointPatterns: [/Unit3Energy|unit3Energy|tryUnit3EnergyKnowledge|kinetic energy|potential energy|mechanical energy/i]
  },
  {
    id: 'motion-force',
    unit: null,
    unitTitle: 'Motion and Force',
    moduleName: 'Motion/Force modular packet',
    filePath: 'lib/knowledge/physics/motion-force/index.js',
    style: 'built-in curriculum packet',
    packetExport: 'MOTION_FORCE_PACKET',
    testPatterns: [/motion-force/i, /motion-honors/i, /concept-tutor-(acceleration|balanced-forces|distance-displacement|newtons-laws|reference-point|speed-velocity)/i],
    touchpointPatterns: [/motion-force|MotionForce|motionForce|tryMotionForceKnowledge|newtons laws|balanced forces|reference point/i]
  },
  {
    id: 'unit5-waves',
    unit: 5,
    unitTitle: 'Waves',
    moduleName: 'Unit 5 Waves',
    filePath: 'lib/knowledge/physics/waves/unit5WavesKnowledge.js',
    style: 'legacy built-in unit module',
    legacyBuiltInModule: true,
    testPatterns: [/waves-unit5/i, /concept-tutor-wave/i],
    touchpointPatterns: [/Unit5Waves|unit5Waves|tryUnit5WavesKnowledge|wave speed|wavelength|frequency/i]
  },
  {
    id: 'unit6-matter',
    unit: 6,
    unitTitle: 'Matter',
    moduleName: 'Unit 6 Matter',
    filePath: 'lib/knowledge/physics/matter/unit6MatterKnowledge.js',
    style: 'legacy built-in unit module',
    legacyBuiltInModule: true,
    testPatterns: [/matter-unit6/i, /concept-tutor-(acids-bases|element-compound-mixture|mixtures|physical-chemical-change)/i],
    touchpointPatterns: [/Unit6Matter|unit6Matter|tryUnit6MatterKnowledge|mixture|compound|physical change|chemical change/i]
  },
  {
    id: 'unit7-atomic-structure',
    unit: 7,
    unitTitle: 'Atomic Structure',
    moduleName: 'Unit 7 Atomic Structure',
    filePath: 'lib/knowledge/chemistry/atomicStructure/unit7AtomicStructureKnowledge.js',
    style: 'built-in curriculum packet',
    packetExport: 'UNIT7_ATOMIC_STRUCTURE_PACKET',
    testPatterns: [/unit7-atomic-structure/i],
    touchpointPatterns: [/Unit7AtomicStructure|unit7AtomicStructure|tryUnit7AtomicStructureKnowledge|AtomicStructure|atomicStructure/i]
  },
  {
    id: 'electricity-magnetism',
    unit: null,
    unitTitle: 'Electricity and Magnetism',
    moduleName: 'Electricity/Magnetism knowledge pack',
    filePath: 'lib/knowledge/electricity-magnetism/electricityMagnetismKnowledgePack.js',
    style: 'legacy built-in packet module',
    legacyBuiltInModule: true,
    testPatterns: [/electricity-unit4/i, /concept-tutor-(open-closed-circuits|series-parallel-circuits)/i],
    touchpointPatterns: [/electricityMagnetism|electricity-magnetism|open circuit|series circuit|parallel circuit|Ohm/i]
  }
];

function getUnitPacketInventory() {
  const testFiles = listTestFiles();
  return PACKETS.map((packet) => buildInventoryItem(packet, testFiles));
}

function buildInventoryItem(config, testFiles = []) {
  const loaded = safeRequire(config.filePath);
  const exported = loaded.module || {};
  const packet = readPacketExport(exported, config);
  const sourcePack = readSourcePack(exported, packet);
  const facts = readCanonicalFacts(exported, packet, config);

  const counts = {
    vocabulary: countArray(packet && packet.vocabulary) || legacyCount(config, exported.vocabulary) || countArray(sourcePack && sourcePack.vocabulary) || legacyCount(config, exported.vocab),
    facts: countArray(facts),
    comparisons: countArray(packet && packet.comparisons) || legacyCount(config, exported.UNIT7_COMPARISON_PAIRS) || countArray(sourcePack && sourcePack.comparisonPairs),
    relationships: countArray(packet && packet.relationships) || legacyCount(config, exported.UNIT7_RELATIONSHIP_EDGES) || countArray(sourcePack && sourcePack.relationshipEdges),
    formulas: countFirstArray(packet && [packet.formulas, packet.referenceFormulas]) || legacyCount(config, exported.formulas) || countArray(sourcePack && sourcePack.formulasAndRules),
    conceptTutors: countFirstArray(packet && [packet.concepts, packet.conceptGroups, packet.conceptTutorHooks]) || legacyCount(config, exported.concepts) || countArray(sourcePack && sourcePack.conceptGroups),
    examples: countArray(packet && packet.examples) || countExamples(facts),
    smokeTests: countFirstArray(packet && [packet.smokeTests, packet.smokePrompts]) || legacyCount(config, exported.smokeTests)
  };
  const directKnowledgeFunctionName = findDirectKnowledgeFunctionName(exported, packet);
  const sourceMetadataPresent = hasSourceMetadata(exported, sourcePack, facts, packet);
  const coverage = detectTestCoverage(config, testFiles);
  const touchpoints = detectTouchpoints(config);
  const unitTitle = readUnitTitle(config, exported, sourcePack, packet);

  return {
    id: config.id,
    unit: config.unit,
    unitTitle,
    moduleName: config.moduleName,
    filePath: config.filePath,
    absolutePath: path.join(ROOT, config.filePath),
    exists: loaded.ok,
    loadError: loaded.error,
    directKnowledgeFunctionName,
    sourceMetadataPresent,
    counts,
    presence: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value > 0])),
    coverage,
    touchpoints,
    packetExport: config.packetExport || '',
    packetId: packet && (packet.packetId || packet.packId) ? String(packet.packetId || packet.packId) : '',
    schemaGaps: buildSchemaGaps({
      loaded,
      unitTitle,
      directKnowledgeFunctionName,
      sourceMetadataPresent,
      counts,
      coverage,
      touchpoints
    }),
    style: config.style,
    notes: buildNotes(config, exported, sourcePack, packet)
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

function readPacketExport(exported, config) {
  if (!exported || !config.packetExport) return null;
  const packet = exported[config.packetExport];
  return packet && typeof packet === 'object' && !Array.isArray(packet) ? packet : null;
}

function readSourcePack(exported, packet) {
  return (packet && packet.sourcePack && typeof packet.sourcePack === 'object' && packet.sourcePack) ||
    exported.UNIT7_ATOMIC_STRUCTURE_SOURCE_PACK ||
    exported.sourcePack ||
    null;
}

function readCanonicalFacts(exported, packet, config) {
  if (packet) {
    return packet.canonicalFacts ||
      packet.facts ||
      null;
  }

  if (!config.legacyBuiltInModule) return null;
  return arrayFromNamedExport(exported, config.factExport) ||
    exported.UNIT7_FACTS ||
    exported.facts ||
    exported.vocab ||
    null;
}

function legacyCount(config, value) {
  return config.legacyBuiltInModule ? countArray(value) : 0;
}

function countFirstArray(values) {
  if (!Array.isArray(values)) return 0;
  const firstArray = values.find((value) => Array.isArray(value));
  return countArray(firstArray);
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

function readUnitTitle(config, exported, sourcePack, packet) {
  return String(
    (packet && packet.unitTitle) ||
    (exported.UNIT7_ATOMIC_STRUCTURE_METADATA && exported.UNIT7_ATOMIC_STRUCTURE_METADATA.unitTitle) ||
    (sourcePack && sourcePack.unitTitle) ||
    config.unitTitle ||
    ''
  );
}

function findDirectKnowledgeFunctionName(exported, packet) {
  return (packet && typeof packet.directKnowledgeMatcher === 'string' && packet.directKnowledgeMatcher) ||
    (packet && packet.legacyExports && typeof packet.legacyExports.matcher === 'string' && packet.legacyExports.matcher) ||
    Object.keys(exported || {}).find((key) => /^try[A-Z].*Knowledge$/.test(key)) ||
    '';
}

function hasSourceMetadata(exported, sourcePack, facts, packet) {
  if (packet && packet.sourceMetadata && typeof packet.sourceMetadata === 'object') return true;
  if (packet && countArray(packet.sourceFiles) > 0) return true;
  if (packet && packet.metadata && (packet.metadata.sourceBacked || countArray(packet.metadata.sourceReferences) > 0)) return true;
  if (sourcePack && countArray(sourcePack.sourceReferences) > 0) return true;
  if (exported.UNIT7_ATOMIC_STRUCTURE_METADATA && countArray(exported.UNIT7_ATOMIC_STRUCTURE_METADATA.sourceReferences) > 0) return true;
  if (Array.isArray(facts) && facts.some((item) => item && (countArray(item.sourceRefs) > 0 || item.sourcePages || item.source_ref || item.sourceFile))) return true;
  return false;
}

function buildNotes(config, exported, sourcePack, packet) {
  const notes = [config.style];
  if (config.packetExport) notes.push(`uses ${config.packetExport}`);
  if (config.legacyBuiltInModule) notes.push('uses legacy fallback for an old built-in module');
  if (sourcePack) notes.push('exports structured source metadata');
  if (findDirectKnowledgeFunctionName(exported, packet)) notes.push('exports direct knowledge matcher');
  if (Array.isArray((packet && packet.problemBank) || exported.problemBank)) notes.push('includes problem bank');
  if (Array.isArray((packet && packet.graphPatterns) || exported.graphPatterns)) notes.push('includes graph patterns');
  return notes;
}

function buildSchemaGaps(context) {
  const loaded = context.loaded || {};
  const counts = context.counts || {};
  const coverage = context.coverage || {};
  const touchpoints = context.touchpoints || {};
  const statuses = {
    unitTitle: statusFromEvidence(loaded.ok, Boolean(context.unitTitle)),
    sourceMetadata: statusFromEvidence(loaded.ok, Boolean(context.sourceMetadataPresent)),
    vocabulary: statusFromEvidence(loaded.ok, counts.vocabulary > 0),
    facts: statusFromEvidence(loaded.ok, counts.facts > 0),
    comparisons: statusFromEvidence(loaded.ok, counts.comparisons > 0),
    relationships: statusFromEvidence(loaded.ok, counts.relationships > 0),
    formulas: statusFromEvidence(loaded.ok, counts.formulas > 0),
    conceptTutors: statusFromEvidence(loaded.ok, counts.conceptTutors > 0),
    examples: statusFromEvidence(loaded.ok, counts.examples > 0),
    smokeTests: statusFromEvidence(loaded.ok, counts.smokeTests > 0),
    directKnowledgeMatcher: statusFromEvidence(loaded.ok, Boolean(context.directKnowledgeFunctionName)),
    testCoverage: statusFromEvidence(loaded.ok, countArray(coverage.testFiles) > 0),
    routerTouchpoints: statusFromEvidence(loaded.ok, countArray(touchpoints.touchpointFiles) > 0)
  };
  const presentFields = TARGET_SCHEMA_FIELDS.filter((field) => statuses[field] === 'present');
  const missingFields = TARGET_SCHEMA_FIELDS.filter((field) => statuses[field] === 'missing');

  return {
    ...statuses,
    missingFields,
    presentFields,
    migrationNotes: buildMigrationNotes(statuses, loaded)
  };
}

function statusFromEvidence(canInspect, evidencePresent) {
  if (!canInspect) return 'unknown';
  return evidencePresent ? 'present' : 'missing';
}

function buildMigrationNotes(statuses, loaded) {
  if (!loaded.ok) {
    return ['Module could not be loaded, so schema gaps are unknown until the load error is fixed.'];
  }

  const notes = [];
  const structuredContentFields = [
    'vocabulary',
    'facts',
    'comparisons',
    'relationships',
    'formulas',
    'conceptTutors',
    'examples'
  ].filter((field) => statuses[field] === 'missing');

  if (statuses.sourceMetadata === 'missing') {
    notes.push('Add source metadata or item-level source references during packet normalization.');
  }
  if (structuredContentFields.length > 0) {
    notes.push(`Add structured packet fields for: ${structuredContentFields.join(', ')}.`);
  }
  if (statuses.smokeTests === 'missing') {
    notes.push('Add packet-level smoke tests as a migration checklist item.');
  }
  if (statuses.directKnowledgeMatcher === 'missing') {
    notes.push('No direct knowledge matcher is exported from this packet module.');
  }
  if (statuses.testCoverage === 'missing') {
    notes.push('No related test files were detected by inventory patterns.');
  }
  if (statuses.routerTouchpoints === 'missing') {
    notes.push('No router, student route, formula, or Concept Tutor touchpoints were detected.');
  }
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

function detectTouchpoints(config) {
  const referenceFiles = TOUCHPOINT_FILES
    .map((filePath) => ({ filePath, text: readLocalFile(filePath) }))
    .filter((entry) => entry.text && matchesPacketTouchpoint(config, entry.text));

  const touchpointFiles = referenceFiles.map((entry) => entry.filePath);

  return {
    routerReferences: filterTouchpointFiles(touchpointFiles, (filePath) => filePath === 'lib/router/questionRouter.js'),
    studentRouteReferences: filterTouchpointFiles(touchpointFiles, (filePath) => filePath === 'routes/studentRoutes.js'),
    formulaReferences: filterTouchpointFiles(touchpointFiles, (filePath) => filePath.startsWith('lib/formulas/')),
    conceptTutorReferences: filterTouchpointFiles(touchpointFiles, (filePath) => filePath.startsWith('lib/tutor/conceptTutor/')),
    directImportReferences: referenceFiles
      .filter((entry) => hasDirectImportReference(config, entry.text))
      .map((entry) => entry.filePath),
    touchpointFiles
  };
}

function readLocalFile(filePath) {
  try {
    return fs.readFileSync(path.join(ROOT, filePath), 'utf8');
  } catch (_error) {
    return '';
  }
}

function matchesPacketTouchpoint(config, text) {
  return (config.touchpointPatterns || []).some((pattern) => pattern.test(text)) || hasDirectImportReference(config, text);
}

function hasDirectImportReference(config, text) {
  const withoutExtension = config.filePath.replace(/\.js$/, '');
  const basename = path.basename(withoutExtension);
  const relativeRequireSuffix = withoutExtension
    .replace(/^lib\//, '../')
    .replace(/^routes\//, '../routes/');
  return text.includes(config.filePath) ||
    text.includes(withoutExtension) ||
    (basename !== 'index' && text.includes(basename)) ||
    text.includes(relativeRequireSuffix);
}

function filterTouchpointFiles(filePaths, predicate) {
  return filePaths.filter(predicate);
}

module.exports = {
  getUnitPacketInventory
};
