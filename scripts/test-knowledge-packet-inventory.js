const assert = require('node:assert/strict');

const { getUnitPacketInventory } = require('../lib/knowledge/unitPacketInventory');

const REQUIRED_IDS = [
  'unit1-measurement',
  'unit1-safety-equipment',
  'unit1-scientific-method',
  'unit1-graphing-data',
  'unit1-conversions-notation',
  'unit3-energy',
  'motion-force',
  'unit5-waves',
  'unit6-matter',
  'unit7-atomic-structure',
  'electricity-magnetism'
];
const SCHEMA_GAP_FIELDS = [
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
const GAP_STATUSES = new Set(['present', 'missing', 'unknown']);

function main() {
  const inventory = getUnitPacketInventory();
  assert.ok(Array.isArray(inventory), 'Inventory helper should return an array');
  assert.equal(inventory.length, REQUIRED_IDS.length, 'Inventory should report exactly the intentional built-in packet/module shapes');

  for (const item of inventory) {
    assert.ok(item.id || item.moduleName, 'Inventory item should include an id or module name');
    assert.ok(item.filePath, `${item.id || item.moduleName} should include a file path`);
    assert.equal(typeof item.exists, 'boolean', `${item.id} should report whether the file exists`);
    assert.ok(item.counts && typeof item.counts === 'object', `${item.id} should include counts`);
    assert.ok(item.presence && typeof item.presence === 'object', `${item.id} should include detected presence flags`);
    assert.ok(item.coverage && typeof item.coverage === 'object', `${item.id} should include detected test coverage`);
    assert.ok(Array.isArray(item.coverage.testFiles), `${item.id} coverage should include a testFiles array`);
    assert.ok(item.touchpoints && typeof item.touchpoints === 'object', `${item.id} should include detected code touchpoints`);
    assert.ok(Array.isArray(item.touchpoints.touchpointFiles), `${item.id} touchpoints should include a touchpointFiles array`);
    assert.ok(Array.isArray(item.notes), `${item.id} should include notes`);
    assert.ok(item.schemaGaps && typeof item.schemaGaps === 'object', `${item.id} should include schemaGaps`);
    assert.ok(Array.isArray(item.schemaGaps.missingFields), `${item.id} schemaGaps should include a missingFields array`);
    assert.ok(Array.isArray(item.schemaGaps.presentFields), `${item.id} schemaGaps should include a presentFields array`);
    assert.ok(Array.isArray(item.schemaGaps.migrationNotes), `${item.id} schemaGaps should include migrationNotes array`);
    for (const field of SCHEMA_GAP_FIELDS) {
      assert.ok(GAP_STATUSES.has(item.schemaGaps[field]), `${item.id} schemaGaps.${field} should be present, missing, or unknown`);
    }
  }

  const byId = new Map(inventory.map((item) => [item.id, item]));
  assert.equal(byId.has('approved-pack-schema'), false, 'Inventory should not count legacy approved-pack schema as curriculum packet completeness');
  for (const id of REQUIRED_IDS) {
    const item = byId.get(id);
    assert.ok(item, `${id} should be represented in packet inventory`);
    assert.equal(item.exists, true, `${id} inventory file should exist and load`);
  }

  assert.equal(byId.get('unit1-measurement').unit, 1, 'Unit 1 measurement should be identified as Unit 1');
  assert.equal(byId.get('unit3-energy').unit, 3, 'Unit 3 energy should be identified as Unit 3');
  assert.equal(byId.get('unit5-waves').unit, 5, 'Unit 5 waves should be identified as Unit 5');
  assert.equal(byId.get('unit6-matter').unit, 6, 'Unit 6 matter should be identified as Unit 6');
  assert.equal(byId.get('unit7-atomic-structure').unit, 7, 'Unit 7 atomic structure should be identified as Unit 7');
  assert.equal(byId.get('electricity-magnetism').unit, null, 'Electricity/magnetism should remain a cross-unit built-in packet module');
  assert.equal(byId.get('unit1-measurement').packetExport, 'UNIT1_MEASUREMENT_PACKET', 'Unit 1 measurement should prefer the packet export');
  assert.equal(byId.get('unit1-safety-equipment').packetExport, 'UNIT1_SAFETY_EQUIPMENT_PACKET', 'Unit 1 safety/equipment should prefer the packet export');
  assert.equal(byId.get('unit1-scientific-method').packetExport, 'UNIT1_SCIENTIFIC_METHOD_PACKET', 'Unit 1 scientific method should prefer the packet export');
  assert.equal(byId.get('unit3-energy').packetExport, 'UNIT3_ENERGY_PACKET', 'Unit 3 energy should prefer the packet export');
  assert.equal(byId.get('motion-force').packetExport, 'MOTION_FORCE_PACKET', 'Motion-force should prefer the packet export');
  assert.equal(byId.get('unit5-waves').packetExport, 'UNIT5_WAVES_PACKET', 'Unit 5 waves should prefer the packet export');
  assert.equal(byId.get('unit6-matter').packetExport, 'UNIT6_MATTER_PACKET', 'Unit 6 matter should prefer the packet export');
  assert.equal(byId.get('unit7-atomic-structure').packetExport, 'UNIT7_ATOMIC_STRUCTURE_PACKET', 'Unit 7 atomic structure should prefer the packet export');
  assert.equal(byId.get('electricity-magnetism').style, 'legacy built-in packet module', 'Electricity/magnetism should remain marked as a legacy built-in packet module');

  assert.ok(byId.get('motion-force').presence.vocabulary, 'Motion-force modular packet should expose vocabulary');
  assert.ok(byId.get('motion-force').presence.formulas, 'Motion-force modular packet should expose formulas');
  assert.ok(byId.get('motion-force').presence.smokeTests, 'Motion-force modular packet should expose smoke tests');
  assert.equal(byId.get('motion-force').schemaGaps.vocabulary, 'present', 'Motion-force schema gaps should show vocabulary present');
  assert.equal(byId.get('motion-force').schemaGaps.formulas, 'present', 'Motion-force schema gaps should show formulas present');
  assert.equal(byId.get('motion-force').schemaGaps.smokeTests, 'present', 'Motion-force schema gaps should show smoke tests present');
  assert.ok(byId.get('motion-force').coverage.testFiles.length > 0, 'Motion-force should still report related test files');
  assert.ok(
    byId.get('motion-force').touchpoints.routerReferences.length > 0 ||
      byId.get('motion-force').touchpoints.conceptTutorReferences.length > 0,
    'Motion-force should report router or Concept Tutor touchpoints'
  );
  assertUnit1SafetyEquipmentInventory(byId.get('unit1-safety-equipment'));
  assertUnit5WavesInventory(byId.get('unit5-waves'));
  assertUnit6MatterInventory(byId.get('unit6-matter'));
  assert.ok(byId.get('unit7-atomic-structure').presence.comparisons, 'Unit 7 should expose comparison metadata');
  assert.ok(byId.get('unit7-atomic-structure').presence.relationships, 'Unit 7 should expose relationship metadata');
  assert.ok(byId.get('unit7-atomic-structure').sourceMetadataPresent, 'Unit 7 should expose source metadata');
  assert.equal(byId.get('unit7-atomic-structure').schemaGaps.sourceMetadata, 'present', 'Unit 7 schema gaps should show source metadata present');
  assert.equal(byId.get('unit7-atomic-structure').schemaGaps.comparisons, 'present', 'Unit 7 schema gaps should show comparisons present');
  assert.equal(byId.get('unit7-atomic-structure').schemaGaps.relationships, 'present', 'Unit 7 schema gaps should show relationships present');
  assert.equal(byId.get('unit7-atomic-structure').schemaGaps.directKnowledgeMatcher, 'present', 'Unit 7 schema gaps should show direct matcher present');
  assert.ok(byId.get('unit7-atomic-structure').coverage.testFiles.length >= 4, 'Unit 7 should report multiple related test files');
  assert.ok(
    byId.get('unit7-atomic-structure').touchpoints.routerReferences.length > 0 ||
      byId.get('unit7-atomic-structure').touchpoints.directImportReferences.length > 0,
    'Unit 7 should report a router/direct knowledge touchpoint'
  );
  assert.ok(
    byId.get('unit1-conversions-notation').coverage.testFiles.some((filePath) => filePath.includes('unit1-conversions-notation')),
    'Unit 1 conversions/notation should report its focused regression test file'
  );
  assert.ok(
    byId.get('unit1-conversions-notation').coverage.uiTestsPresent,
    'Unit 1 conversions/notation should report related student tutor UI tests'
  );
  assert.ok(
    byId.get('unit1-conversions-notation').touchpoints.formulaReferences.length > 0 ||
      byId.get('unit1-conversions-notation').touchpoints.studentRouteReferences.length > 0,
    'Unit 1 conversions/notation should report formula or student tutor related touchpoints'
  );
  for (const id of ['unit3-energy', 'unit5-waves', 'unit6-matter']) {
    assert.equal(byId.get(id).schemaGaps.directKnowledgeMatcher, 'present', `${id} schema gaps should show direct matcher present`);
  }

  printSummary(inventory);
  console.log(`PASS knowledge packet inventory: ${inventory.length} packet/module shapes inspected`);
}

function assertUnit1SafetyEquipmentInventory(item) {
  assert.ok(item.presence.vocabulary, 'Unit 1 safety/equipment should expose vocabulary');
  assert.ok(item.presence.facts, 'Unit 1 safety/equipment should expose canonical facts');
  assert.ok(item.presence.relationships, 'Unit 1 safety/equipment should expose relationships');
  assert.ok(item.presence.examples, 'Unit 1 safety/equipment should expose natural examples');
  assert.ok(item.presence.smokeTests, 'Unit 1 safety/equipment should expose smoke tests');
  assert.ok(item.sourceMetadataPresent, 'Unit 1 safety/equipment should expose source metadata');
  assert.equal(item.schemaGaps.sourceMetadata, 'present', 'Unit 1 safety/equipment schema gaps should show source metadata present');
  assert.equal(item.schemaGaps.vocabulary, 'present', 'Unit 1 safety/equipment schema gaps should show vocabulary present');
  assert.equal(item.schemaGaps.facts, 'present', 'Unit 1 safety/equipment schema gaps should show facts present');
  assert.equal(item.schemaGaps.relationships, 'present', 'Unit 1 safety/equipment schema gaps should show relationships present');
  assert.equal(item.schemaGaps.examples, 'present', 'Unit 1 safety/equipment schema gaps should show examples present');
  assert.equal(item.schemaGaps.smokeTests, 'present', 'Unit 1 safety/equipment schema gaps should show smoke tests present');
  assert.deepEqual(
    item.schemaGaps.missingFields,
    ['comparisons', 'formulas'],
    'Unit 1 safety/equipment should only omit comparisons and formulas intentionally'
  );
}

function assertUnit5WavesInventory(item) {
  assert.equal(item.style, 'built-in curriculum packet', 'Unit 5 waves should be marked as a built-in curriculum packet');
  assert.ok(item.presence.vocabulary, 'Unit 5 waves should expose vocabulary');
  assert.ok(item.presence.facts, 'Unit 5 waves should expose canonical facts');
  assert.ok(item.presence.relationships, 'Unit 5 waves should expose natural relationships');
  assert.ok(item.presence.formulas, 'Unit 5 waves should expose wave formulas');
  assert.ok(item.presence.conceptTutors, 'Unit 5 waves should expose concept groups or tutor hooks');
  assert.ok(item.presence.examples, 'Unit 5 waves should expose existing examples');
  assert.ok(item.presence.smokeTests, 'Unit 5 waves should expose smoke tests');
  assert.ok(item.sourceMetadataPresent, 'Unit 5 waves should expose source metadata status');
  assert.equal(item.schemaGaps.sourceMetadata, 'present', 'Unit 5 waves schema gaps should show source metadata present');
  assert.equal(item.schemaGaps.vocabulary, 'present', 'Unit 5 waves schema gaps should show vocabulary present');
  assert.equal(item.schemaGaps.facts, 'present', 'Unit 5 waves schema gaps should show facts present');
  assert.equal(item.schemaGaps.relationships, 'present', 'Unit 5 waves schema gaps should show relationships present');
  assert.equal(item.schemaGaps.formulas, 'present', 'Unit 5 waves schema gaps should show formulas present');
  assert.equal(item.schemaGaps.conceptTutors, 'present', 'Unit 5 waves schema gaps should show concept tutors present');
  assert.equal(item.schemaGaps.examples, 'present', 'Unit 5 waves schema gaps should show examples present');
  assert.equal(item.schemaGaps.smokeTests, 'present', 'Unit 5 waves schema gaps should show smoke tests present');
  assert.deepEqual(
    item.schemaGaps.missingFields,
    ['comparisons'],
    'Unit 5 waves should only omit comparisons intentionally'
  );
}

function assertUnit6MatterInventory(item) {
  assert.equal(item.style, 'built-in curriculum packet', 'Unit 6 matter should be marked as a built-in curriculum packet');
  assert.ok(item.presence.vocabulary, 'Unit 6 matter should expose vocabulary');
  assert.ok(item.presence.facts, 'Unit 6 matter should expose canonical facts');
  assert.ok(item.presence.comparisons, 'Unit 6 matter should expose natural comparisons');
  assert.ok(item.presence.relationships, 'Unit 6 matter should expose natural relationships');
  assert.ok(item.presence.formulas, 'Unit 6 matter should expose density formulas');
  assert.ok(item.presence.conceptTutors, 'Unit 6 matter should expose concept groups or tutor hooks');
  assert.ok(item.presence.examples, 'Unit 6 matter should expose existing examples');
  assert.ok(item.presence.smokeTests, 'Unit 6 matter should expose smoke tests');
  assert.ok(item.sourceMetadataPresent, 'Unit 6 matter should expose source metadata status');
  assert.equal(item.schemaGaps.sourceMetadata, 'present', 'Unit 6 matter schema gaps should show source metadata present');
  assert.equal(item.schemaGaps.vocabulary, 'present', 'Unit 6 matter schema gaps should show vocabulary present');
  assert.equal(item.schemaGaps.facts, 'present', 'Unit 6 matter schema gaps should show facts present');
  assert.equal(item.schemaGaps.comparisons, 'present', 'Unit 6 matter schema gaps should show comparisons present');
  assert.equal(item.schemaGaps.relationships, 'present', 'Unit 6 matter schema gaps should show relationships present');
  assert.equal(item.schemaGaps.formulas, 'present', 'Unit 6 matter schema gaps should show formulas present');
  assert.equal(item.schemaGaps.conceptTutors, 'present', 'Unit 6 matter schema gaps should show concept tutors present');
  assert.equal(item.schemaGaps.examples, 'present', 'Unit 6 matter schema gaps should show examples present');
  assert.equal(item.schemaGaps.smokeTests, 'present', 'Unit 6 matter schema gaps should show smoke tests present');
  assert.deepEqual(
    item.schemaGaps.missingFields,
    [],
    'Unit 6 matter should expose the packet fields needed by inventory after normalization'
  );
}

function printSummary(inventory) {
  console.log('Knowledge packet inventory summary:');
  for (const item of inventory) {
    const counts = item.counts || {};
    const summary = [
      `facts=${counts.facts || 0}`,
      `vocab=${counts.vocabulary || 0}`,
      `comparisons=${counts.comparisons || 0}`,
      `relationships=${counts.relationships || 0}`,
      `formulas=${counts.formulas || 0}`,
      `concepts=${counts.conceptTutors || 0}`,
      `smoke=${counts.smokeTests || 0}`
    ].join(', ');
    const source = item.sourceMetadataPresent ? 'source=yes' : 'source=no';
    const matcher = item.directKnowledgeFunctionName ? `matcher=${item.directKnowledgeFunctionName}` : 'matcher=none';
    const coverage = summarizeCoverage(item.coverage);
    const touchpoints = summarizeTouchpoints(item.touchpoints);
    const gaps = summarizeSchemaGaps(item.schemaGaps);
    console.log(`- ${item.id}: ${item.style}; ${source}; ${matcher}; ${summary}; tests=${coverage}; touchpoints=${touchpoints}; schema=${gaps}`);
  }
}

function summarizeCoverage(coverage = {}) {
  const labels = [];
  if (coverage.directAnswerTestsPresent) labels.push('direct');
  if (coverage.formulaTutorTestsPresent) labels.push('formula');
  if (coverage.conceptTutorTestsPresent) labels.push('concept');
  if (coverage.wholeUnitSmokeTestsPresent) labels.push('whole-smoke');
  if (coverage.boundaryTestsPresent) labels.push('boundary');
  if (coverage.uiTestsPresent) labels.push('ui');
  if (coverage.representativeAuditPresent) labels.push('audit');
  labels.push(`files=${(coverage.testFiles || []).length}`);
  return labels.join('/');
}

function summarizeTouchpoints(touchpoints = {}) {
  const labels = [];
  if ((touchpoints.routerReferences || []).length > 0) labels.push(`router=${touchpoints.routerReferences.length}`);
  if ((touchpoints.studentRouteReferences || []).length > 0) labels.push(`student=${touchpoints.studentRouteReferences.length}`);
  if ((touchpoints.formulaReferences || []).length > 0) labels.push(`formula=${touchpoints.formulaReferences.length}`);
  if ((touchpoints.conceptTutorReferences || []).length > 0) labels.push(`concept=${touchpoints.conceptTutorReferences.length}`);
  if ((touchpoints.directImportReferences || []).length > 0) labels.push(`imports=${touchpoints.directImportReferences.length}`);
  labels.push(`files=${(touchpoints.touchpointFiles || []).length}`);
  return labels.join('/');
}

function summarizeSchemaGaps(schemaGaps = {}) {
  const presentCount = (schemaGaps.presentFields || []).length;
  const missingFields = schemaGaps.missingFields || [];
  const missing = missingFields.length > 0 ? missingFields.join('|') : 'none';
  return `present=${presentCount}/${SCHEMA_GAP_FIELDS.length}; missing=${missing}`;
}

main();
