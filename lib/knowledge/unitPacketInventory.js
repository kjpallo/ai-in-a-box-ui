const path = require('node:path');
const fs = require('node:fs');
const { getBuiltinPacketRegistry } = require('./builtinPacketRegistry');

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

function getUnitPacketInventory() {
  const testFiles = listTestFiles();
  return getBuiltinPacketRegistry().map((packet) => buildInventoryItem(packet, testFiles));
}

function buildInventoryItem(config, testFiles = []) {
  const loaded = safeRequire(config.modulePath);
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
    id: config.packetId,
    unit: config.unit,
    unitTitle,
    moduleName: config.moduleName,
    filePath: config.modulePath,
    absolutePath: path.join(ROOT, config.modulePath),
    exists: loaded.ok,
    loadError: loaded.error,
    directKnowledgeFunctionName,
    sourceMetadataPresent,
    counts,
    presence: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value > 0])),
    coverage,
    touchpoints,
    packetExport: config.packetExportName || '',
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
    style: config.kind,
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
  if (!exported || !config.packetExportName) return null;
  const packet = exported[config.packetExportName];
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

  if (!isLegacyRegistryEntry(config)) return null;
  return arrayFromNamedExport(exported, config.factExportName) ||
    exported.UNIT7_FACTS ||
    exported.facts ||
    exported.vocab ||
    null;
}

function legacyCount(config, value) {
  return isLegacyRegistryEntry(config) ? countArray(value) : 0;
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
  const notes = [config.kind];
  for (const note of config.notes || []) notes.push(note);
  if (config.packetExportName) notes.push(`uses ${config.packetExportName}`);
  if (isLegacyRegistryEntry(config)) notes.push('uses legacy fallback for an old built-in module');
  if (sourcePack) notes.push('exports structured source metadata');
  if (findDirectKnowledgeFunctionName(exported, packet)) notes.push('exports direct knowledge matcher');
  if (Array.isArray((packet && packet.problemBank) || exported.problemBank)) notes.push('includes problem bank');
  if (Array.isArray((packet && packet.graphPatterns) || exported.graphPatterns)) notes.push('includes graph patterns');
  return notes;
}

function isLegacyRegistryEntry(config) {
  return config && config.status === 'legacy';
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
  const withoutExtension = config.modulePath.replace(/\.js$/, '');
  const basename = path.basename(withoutExtension);
  const relativeRequireSuffix = withoutExtension
    .replace(/^lib\//, '../')
    .replace(/^routes\//, '../routes/');
  return text.includes(config.modulePath) ||
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
