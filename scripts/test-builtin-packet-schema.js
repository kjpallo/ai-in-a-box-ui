const assert = require('node:assert/strict');

const { getBuiltinPacketRegistry } = require('../lib/knowledge/builtinPacketRegistry');
const {
  getBuiltinPacketSchemaReport,
  validateBuiltinPacketEntry
} = require('../lib/knowledge/builtinPacketSchema');

const EXPECTED_PACKET_COUNT = 13;
const FORBIDDEN_PATH_PARTS = [
  'knowledge/approved-packs',
  'knowledge/deleted-approved-packs',
  'knowledge/draft-packs',
  'knowledge/uploads',
  'lib/uploads',
  'teacher-upload',
  'teacherContentApproval'
];

function main() {
  const registry = getBuiltinPacketRegistry();
  assert.equal(registry.length, EXPECTED_PACKET_COUNT, 'Registry should still contain exactly 13 built-in curriculum entries');

  const report = getBuiltinPacketSchemaReport();
  assert.equal(report.length, EXPECTED_PACKET_COUNT, 'Schema report should include every built-in curriculum registry entry');

  const byId = new Map(report.map((entry) => [entry.packetId, entry]));
  for (const registryEntry of registry) {
    const schemaEntry = byId.get(registryEntry.packetId);
    assert.ok(schemaEntry, `${registryEntry.packetId} should be represented in the schema report`);
    assert.equal(schemaEntry.status, registryEntry.status, `${registryEntry.packetId} should preserve registry status`);
    assert.equal(schemaEntry.kind, registryEntry.kind, `${registryEntry.packetId} should preserve registry kind`);
    assert.equal(schemaEntry.packetExportName, registryEntry.packetExportName || '', `${registryEntry.packetId} should report packet export name`);
  }

  for (const schemaEntry of report.filter((entry) => entry.isPacketShaped)) {
    assert.equal(schemaEntry.validationStatus, 'valid', `${schemaEntry.packetId} should validate as a packet-shaped built-in entry`);
    assert.equal(schemaEntry.ok, true, `${schemaEntry.packetId} should not be a hard schema failure`);
    assert.deepEqual(schemaEntry.requiredMissing, [], `${schemaEntry.packetId} should include all required packet-style fields`);
    assert.ok(Object.values(schemaEntry.bodyCounts).some((count) => count > 0), `${schemaEntry.packetId} should include body counts`);
  }

  for (const legacyId of ['electricity-magnetism']) {
    const legacy = byId.get(legacyId);
    assert.ok(legacy, `${legacyId} should be represented in the schema report`);
    assert.equal(legacy.isLegacy, true, `${legacyId} should be reported as legacy`);
    assert.equal(legacy.isPacketShaped, false, `${legacyId} should not be treated as packet-shaped yet`);
    assert.equal(legacy.validationStatus, 'legacy-gap', `${legacyId} should be a conversion gap, not a hard failure`);
    assert.equal(legacy.ok, true, `${legacyId} should not fail required packet validation while still legacy`);
    assert.deepEqual(legacy.requiredMissing, [], `${legacyId} should not receive packet required-field failures until converted`);
  }

  assertNoForbiddenPaths(report);
  assertUnit5Waves(byId.get('unit5-waves'));
  assertUnit6Matter(byId.get('unit6-matter'));
  assertUnit7AtomicStructure(byId.get('unit7-atomic-structure'));
  assertUnit8Bonding(byId.get('unit8-bonding'));
  assertUnit9Reactions(byId.get('unit9-reactions'));
  assertMotionForce(byId.get('motion-force'), registry.find((entry) => entry.packetId === 'motion-force'));

  printSchemaSummary(report);
  console.log(`PASS built-in packet schema: ${report.length} registry entries inspected`);
}

function assertUnit5Waves(unit5) {
  assert.ok(unit5, 'Unit 5 waves should appear in the schema report');
  assert.equal(unit5.isPacketShaped, true, 'Unit 5 waves should be packet-shaped');
  assert.equal(unit5.validationStatus, 'valid', 'Unit 5 waves should validate as packet-shaped');
  assert.ok(unit5.bodyCounts.facts > 0, 'Unit 5 waves should count canonical facts');
  assert.ok(unit5.bodyCounts.vocabulary > 0, 'Unit 5 waves should count vocabulary');
  assert.ok(unit5.bodyCounts.relationships > 0, 'Unit 5 waves should count relationships');
  assert.ok(unit5.bodyCounts.formulas > 0, 'Unit 5 waves should count formulas');
  assert.ok(unit5.bodyCounts.concepts > 0, 'Unit 5 waves should count concepts');
  assert.ok(unit5.bodyCounts.conceptTutorHooks > 0, 'Unit 5 waves should count concept tutor hooks');
  assert.ok(unit5.bodyCounts.formulaTutorHooks > 0, 'Unit 5 waves should count formula tutor hooks');
  assert.ok(unit5.bodyCounts.smokeTests > 0, 'Unit 5 waves should count smoke tests');
}

function assertUnit6Matter(unit6) {
  assert.ok(unit6, 'Unit 6 matter should appear in the schema report');
  assert.equal(unit6.isPacketShaped, true, 'Unit 6 matter should be packet-shaped');
  assert.equal(unit6.validationStatus, 'valid', 'Unit 6 matter should validate as packet-shaped');
  assert.ok(unit6.bodyCounts.facts > 0, 'Unit 6 matter should count canonical facts');
  assert.ok(unit6.bodyCounts.vocabulary > 0, 'Unit 6 matter should count vocabulary');
  assert.ok(unit6.bodyCounts.comparisons > 0, 'Unit 6 matter should count comparison metadata');
  assert.ok(unit6.bodyCounts.relationships > 0, 'Unit 6 matter should count relationships');
  assert.ok(unit6.bodyCounts.formulas > 0, 'Unit 6 matter should count density formulas');
  assert.ok(unit6.bodyCounts.concepts > 0, 'Unit 6 matter should count concepts');
  assert.ok(unit6.bodyCounts.conceptTutorHooks > 0, 'Unit 6 matter should count concept tutor hooks');
  assert.ok(unit6.bodyCounts.formulaTutorHooks > 0, 'Unit 6 matter should count formula tutor hooks');
  assert.ok(unit6.bodyCounts.smokeTests > 0, 'Unit 6 matter should count smoke tests');
}

function assertUnit7AtomicStructure(unit7) {
  assert.ok(unit7, 'Unit 7 should appear in the schema report');
  assert.equal(unit7.isPacketShaped, true, 'Unit 7 should be packet-shaped');
  assert.equal(unit7.validationStatus, 'valid', 'Unit 7 should validate as packet-shaped');
  assert.ok(unit7.bodyCounts.facts > 0, 'Unit 7 should count canonical facts');
  assert.ok(unit7.bodyCounts.vocabulary > 0, 'Unit 7 should count vocabulary');
  assert.ok(unit7.bodyCounts.comparisons > 0, 'Unit 7 should count comparisons');
  assert.ok(unit7.bodyCounts.relationships > 0, 'Unit 7 should count relationships');
  assert.ok(unit7.bodyCounts.formulas > 0, 'Unit 7 should count formulas');
  assert.ok(unit7.bodyCounts.concepts > 0, 'Unit 7 should count concepts');
}

function assertUnit8Bonding(unit8) {
  assert.ok(unit8, 'Unit 8 bonding should appear in the schema report');
  assert.equal(unit8.isPacketShaped, true, 'Unit 8 bonding should be packet-shaped');
  assert.equal(unit8.validationStatus, 'valid', 'Unit 8 bonding should validate as packet-shaped');
  assert.ok(unit8.bodyCounts.facts > 0, 'Unit 8 bonding should count canonical facts');
  assert.ok(unit8.bodyCounts.vocabulary > 0, 'Unit 8 bonding should count vocabulary');
  assert.ok(unit8.bodyCounts.comparisons > 0, 'Unit 8 bonding should count comparisons');
  assert.ok(unit8.bodyCounts.relationships > 0, 'Unit 8 bonding should count relationships');
  assert.ok(unit8.bodyCounts.formulas > 0, 'Unit 8 bonding should count formulas/rules');
  assert.ok(unit8.bodyCounts.concepts > 0, 'Unit 8 bonding should count concepts');
  assert.ok(unit8.bodyCounts.smokeTests > 0, 'Unit 8 bonding should count smoke tests');
}

function assertUnit9Reactions(unit9) {
  assert.ok(unit9, 'Unit 9 reactions should appear in the schema report');
  assert.equal(unit9.isPacketShaped, true, 'Unit 9 reactions should be packet-shaped');
  assert.equal(unit9.validationStatus, 'valid', 'Unit 9 reactions should validate as packet-shaped');
  assert.ok(unit9.bodyCounts.facts > 0, 'Unit 9 reactions should count canonical facts');
  assert.ok(unit9.bodyCounts.vocabulary > 0, 'Unit 9 reactions should count vocabulary');
  assert.ok(unit9.bodyCounts.comparisons > 0, 'Unit 9 reactions should count comparisons');
  assert.ok(unit9.bodyCounts.relationships > 0, 'Unit 9 reactions should count relationships');
  assert.ok(unit9.bodyCounts.formulas > 0, 'Unit 9 reactions should count formulas/rules');
  assert.ok(unit9.bodyCounts.concepts > 0, 'Unit 9 reactions should count concepts');
  assert.ok(unit9.bodyCounts.smokeTests > 0, 'Unit 9 reactions should count smoke tests');
}

function assertMotionForce(motionForce, registryEntry) {
  assert.ok(motionForce, 'Motion-force should appear in the schema report');
  assert.equal(motionForce.isPacketShaped, true, 'Motion-force should be packet-shaped');
  assert.equal(motionForce.validationStatus, 'valid', 'Motion-force should validate as packet-shaped');
  assert.equal(motionForce.bodyCounts.facts, 0, 'Motion-force should not need canonical facts to be packet-shaped');
  assert.ok(motionForce.bodyCounts.vocabulary > 0, 'Motion-force should count vocabulary');
  assert.ok(motionForce.bodyCounts.concepts > 0, 'Motion-force should count concepts');
  assert.ok(motionForce.bodyCounts.formulas > 0, 'Motion-force should count formulas');
  assert.ok(motionForce.bodyCounts.problems > 0, 'Motion-force should count problems');
  assert.ok(motionForce.bodyCounts.smokeTests > 0, 'Motion-force should count smoke tests');

  const directValidation = validateBuiltinPacketEntry(registryEntry);
  assert.equal(directValidation.validationStatus, 'valid', 'Direct motion-force entry validation should also pass');
  assert.deepEqual(directValidation.requiredMissing, [], 'Direct motion-force validation should have no required gaps');
}

function assertNoForbiddenPaths(report) {
  for (const value of collectStrings(report)) {
    const normalized = value.replace(/\\/g, '/');
    for (const forbidden of FORBIDDEN_PATH_PARTS) {
      assert.equal(
        normalized.includes(forbidden),
        false,
        `Schema report should not reference forbidden teacher upload/approved/draft path: ${forbidden}`
      );
    }
  }
}

function printSchemaSummary(report) {
  console.log('Built-in packet schema summary:');
  for (const entry of report) {
    const counts = entry.bodyCounts || {};
    const summary = [
      `facts=${counts.facts || 0}`,
      `vocab=${counts.vocabulary || 0}`,
      `concepts=${counts.concepts || 0}`,
      `formulas=${counts.formulas || 0}`,
      `relations=${counts.relationships || 0}`,
      `comparisons=${counts.comparisons || 0}`,
      `smoke=${counts.smokeTests || 0}`
    ].join(', ');
    const required = entry.requiredMissing.length > 0 ? entry.requiredMissing.join('|') : 'none';
    const recommended = entry.recommendedMissing.length > 0 ? entry.recommendedMissing.join('|') : 'none';
    console.log(`- ${entry.packetId}: ${entry.validationStatus}; ${entry.kind}; required=${required}; recommended=${recommended}; ${summary}`);
  }
}

function collectStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

main();
