const assert = require('node:assert/strict');

const {
  getBuiltinPacketRegistry,
  getBuiltinPacketRegistryEntry,
  loadBuiltinPacketForRegistryEntry
} = require('../lib/knowledge/builtinPacketRegistry');

const EXPECTED_PACKET_IDS = [
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
  'unit8-bonding',
  'electricity-magnetism'
];
const KEY_PACKET_IDS = [
  'unit1-measurement',
  'unit3-energy',
  'motion-force',
  'unit5-waves',
  'unit6-matter',
  'unit7-atomic-structure',
  'unit8-bonding',
  'electricity-magnetism'
];
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
  assert.ok(Array.isArray(registry), 'Registry helper should return an array');
  assert.equal(registry.length, EXPECTED_PACKET_IDS.length, 'Registry should include exactly the intentional built-in packet/module shapes');
  assert.deepEqual(
    registry.map((entry) => entry.packetId),
    EXPECTED_PACKET_IDS,
    'Registry should keep the expected built-in curriculum packet/module order'
  );

  const ids = registry.map((entry) => entry.packetId);
  assert.equal(new Set(ids).size, ids.length, 'Registry packetId values should be unique');

  for (const entry of registry) {
    assertRegistryEntryShape(entry);
    assertNoForbiddenPaths(entry);
    assertPacketExportIsValidWhenPacketShaped(entry);
    assertLegacyEntriesAreExplicit(entry);
    assertMatcherResolvesWhenDeclared(entry);
  }
  assertPacketReadinessCheckpoint(registry);

  for (const packetId of KEY_PACKET_IDS) {
    const entry = getBuiltinPacketRegistryEntry(packetId);
    assert.ok(entry, `${packetId} should resolve from the built-in packet registry`);
    assert.equal(entry.packetId, packetId, `${packetId} should resolve to itself`);
    const loaded = loadBuiltinPacketForRegistryEntry(entry);
    assert.ok(loaded.moduleExports, `${packetId} registry entry should load its module`);
  }

  assert.equal(getBuiltinPacketRegistryEntry('approved-pack-schema'), null, 'Approved-pack schema should not be registered as built-in curriculum');
  assert.equal(getBuiltinPacketRegistryEntry('draft-pack'), null, 'Draft packs should not be registered as built-in curriculum');

  console.log(`PASS built-in packet registry: ${registry.length} entries inspected`);
}

function assertPacketReadinessCheckpoint(registry) {
  const packetEntries = registry.filter((entry) => entry.status === 'packet');
  const legacyEntries = registry.filter((entry) => entry.status === 'legacy');

  assert.equal(packetEntries.length, 11, 'Registry should currently have 11 packet-shaped built-in curriculum entries');
  assert.deepEqual(
    packetEntries.map((entry) => entry.packetId),
    EXPECTED_PACKET_IDS.filter((packetId) => packetId !== 'electricity-magnetism'),
    'Only electricity/magnetism should remain outside the packet-shaped built-in curriculum set'
  );
  assert.deepEqual(
    legacyEntries.map((entry) => entry.packetId),
    ['electricity-magnetism'],
    'Electricity/magnetism should be the only intentional legacy/support-only registry entry'
  );
}

function assertRegistryEntryShape(entry) {
  assert.equal(typeof entry.packetId, 'string', 'Registry entry should include packetId');
  assert.ok(entry.packetId.length > 0, `${entry.packetId} should have a non-empty packetId`);
  assert.ok(Object.prototype.hasOwnProperty.call(entry, 'unit'), `${entry.packetId} should include unit`);
  assert.equal(typeof entry.unitTitle, 'string', `${entry.packetId} should include unitTitle`);
  assert.equal(typeof entry.topic, 'string', `${entry.packetId} should include topic`);
  assert.equal(typeof entry.modulePath, 'string', `${entry.packetId} should include modulePath`);
  assert.ok(entry.modulePath.startsWith('lib/knowledge/'), `${entry.packetId} should point at checked-in built-in knowledge`);
  assert.ok(['packet', 'legacy'].includes(entry.status), `${entry.packetId} should have a known registry status`);
  assert.equal(typeof entry.kind, 'string', `${entry.packetId} should include kind`);
  assert.ok(Array.isArray(entry.notes), `${entry.packetId} should include notes`);
}

function assertNoForbiddenPaths(entry) {
  const searchableStrings = collectStrings(entry);
  for (const value of searchableStrings) {
    const normalized = value.replace(/\\/g, '/');
    for (const forbidden of FORBIDDEN_PATH_PARTS) {
      assert.equal(
        normalized.includes(forbidden),
        false,
        `${entry.packetId} should not reference forbidden teacher upload/approved/draft path: ${forbidden}`
      );
    }
  }
}

function assertPacketExportIsValidWhenPacketShaped(entry) {
  if (entry.status !== 'packet') return;
  assert.equal(typeof entry.packetExportName, 'string', `${entry.packetId} packet entry should include packetExportName`);
  assert.ok(entry.packetExportName.length > 0, `${entry.packetId} packet entry should have a non-empty packetExportName`);
  const loaded = loadBuiltinPacketForRegistryEntry(entry);
  assert.ok(loaded.packet && typeof loaded.packet === 'object', `${entry.packetId} should export ${entry.packetExportName}`);
  assert.equal(loaded.packet.packetId, entry.packetId, `${entry.packetId} packet export should declare the matching packetId`);
}

function assertLegacyEntriesAreExplicit(entry) {
  if (entry.status !== 'legacy') return;
  assert.match(entry.kind, /^legacy built-in /, `${entry.packetId} legacy entry should use a legacy built-in kind`);
  assert.ok(entry.notes.some((note) => /legacy/i.test(note)), `${entry.packetId} legacy entry should explain why it remains active`);
}

function assertMatcherResolvesWhenDeclared(entry) {
  if (!entry.matcherName) return;
  const loaded = loadBuiltinPacketForRegistryEntry(entry);
  const packet = loaded.packet || {};
  const packetMatcher = packet.directKnowledgeMatcher ||
    (packet.legacyExports && packet.legacyExports.matcher) ||
    '';
  assert.ok(
    typeof loaded.moduleExports[entry.matcherName] === 'function' || packetMatcher === entry.matcherName,
    `${entry.packetId} matcherName should resolve from the module or packet metadata`
  );
}

function collectStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') {
    if (value instanceof RegExp) return [value.source];
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

main();
