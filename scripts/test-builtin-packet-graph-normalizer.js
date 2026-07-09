const assert = require('node:assert/strict');

const {
  getBuiltinPacketRegistry,
  loadBuiltinPacketForRegistryEntry
} = require('../lib/knowledge/builtinPacketRegistry');
const {
  getBuiltinPacketGraphReport,
  normalizeBuiltinPacketForGraph,
  normalizeBuiltinPacketsForGraph,
  normalizeComparisonEdges,
  normalizeConceptNodes,
  normalizeFactNodes,
  normalizeFormulaNodes,
  normalizeRelationshipEdges,
  normalizeVocabularyNodes
} = require('../lib/knowledge/builtinPacketGraphNormalizer');

const EXPECTED_REGISTRY_COUNT = 13;
const EXPECTED_NORMALIZED_PACKET_IDS = [
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
  'unit9-reactions'
];
const EXPECTED_SKIPPED_IDS = [
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
  const normalized = normalizeBuiltinPacketsForGraph();
  assert.equal(normalized.source, 'built-in curriculum packet', 'Normalizer should identify built-in curriculum as the source');
  assert.equal(normalized.purpose, 'graph-support', 'Normalizer should mark output as graph-support data');
  assert.equal(normalized.counts.registryEntries, EXPECTED_REGISTRY_COUNT, 'Normalizer should inspect the same 13 registry entries');
  assert.deepEqual(
    normalized.packets.map((packet) => packet.packetId),
    EXPECTED_NORMALIZED_PACKET_IDS,
    'Normalizer should only normalize packet-shaped built-in curriculum entries'
  );
  assert.deepEqual(
    normalized.skipped.map((entry) => entry.packetId),
    EXPECTED_SKIPPED_IDS,
    'Normalizer should skip legacy entries until their adapters exist'
  );
  assert.equal(normalized.counts.normalizedPackets, EXPECTED_NORMALIZED_PACKET_IDS.length, 'Normalizer should count normalized packet entries');
  assert.equal(normalized.counts.skippedLegacyEntries, EXPECTED_SKIPPED_IDS.length, 'Normalizer should count skipped legacy entries');
  assert.ok(normalized.counts.nodes > 0, 'Normalizer should produce graph-support nodes');
  assert.ok(normalized.counts.edges > 0, 'Normalizer should produce graph-support edges');
  assert.ok(normalized.counts.nodeTypes.vocabulary > 0, 'Normalizer should produce vocabulary nodes');
  assert.ok(normalized.counts.nodeTypes.concept > 0, 'Normalizer should produce concept nodes');
  assert.ok(normalized.counts.nodeTypes.fact > 0, 'Normalizer should produce fact nodes');
  assert.ok(normalized.counts.nodeTypes.formula > 0, 'Normalizer should produce formula nodes');
  assert.ok(normalized.counts.edgeTypes.relationship > 0, 'Normalizer should produce relationship edges');
  assert.ok(normalized.counts.edgeTypes.comparison > 0, 'Normalizer should produce comparison edges');

  for (const packet of normalized.packets) {
    assertPacketGraphShape(packet);
  }
  for (const skipped of normalized.skipped) {
    assert.equal(skipped.normalizationStatus, 'skipped', `${skipped.packetId} should be skipped, not normalized`);
    assert.equal(skipped.validationStatus, 'legacy-gap', `${skipped.packetId} should remain a schema legacy gap`);
  }

  assertUnit5Waves(normalized.packets.find((packet) => packet.packetId === 'unit5-waves'));
  assertUnit6Matter(normalized.packets.find((packet) => packet.packetId === 'unit6-matter'));
  assertUnit7AtomicStructure(normalized.packets.find((packet) => packet.packetId === 'unit7-atomic-structure'));
  assertUnit8Bonding(normalized.packets.find((packet) => packet.packetId === 'unit8-bonding'));
  assertUnit9Reactions(normalized.packets.find((packet) => packet.packetId === 'unit9-reactions'));
  assertMotionForce(normalized.packets.find((packet) => packet.packetId === 'motion-force'));
  assertIndividualNormalizers();
  assertReport(normalized);
  assertNoForbiddenPaths(normalized);

  printSummary(normalized);
  console.log(`PASS built-in packet graph normalizer: ${normalized.counts.normalizedPackets} packets normalized, ${normalized.counts.skippedLegacyEntries} legacy entries skipped`);
}

function assertPacketGraphShape(packet) {
  assert.equal(packet.normalizationStatus, 'normalized', `${packet.packetId} should normalize successfully`);
  assert.equal(packet.validationStatus, 'valid', `${packet.packetId} should validate before graph normalization`);
  assert.equal(packet.ok, true, `${packet.packetId} should report ok`);
  assert.equal(packet.source, 'built-in curriculum packet', `${packet.packetId} should not masquerade as teacher-approved knowledge`);
  assert.equal(packet.purpose, 'graph-support', `${packet.packetId} should be marked graph-support only`);
  assert.ok(Array.isArray(packet.nodes), `${packet.packetId} should include nodes`);
  assert.ok(Array.isArray(packet.edges), `${packet.packetId} should include edges`);
  assert.ok(packet.nodeCounts && typeof packet.nodeCounts.total === 'number', `${packet.packetId} should include node counts`);
  assert.ok(packet.edgeCounts && typeof packet.edgeCounts.total === 'number', `${packet.packetId} should include edge counts`);

  const nodeIds = packet.nodes.map((node) => node.id);
  assert.equal(new Set(nodeIds).size, nodeIds.length, `${packet.packetId} node ids should be unique`);
  for (const node of packet.nodes) {
    assert.equal(node.packetId, packet.packetId, `${packet.packetId} node should preserve packetId`);
    assert.equal(node.source, 'built-in curriculum packet', `${packet.packetId} node should use built-in packet source`);
    assert.ok(['vocabulary', 'concept', 'fact', 'formula'].includes(node.type), `${packet.packetId} node should use a normalized type`);
    assert.ok(node.id.startsWith(`${packet.packetId}:${node.type}:`), `${packet.packetId} node id should be packet-scoped`);
    assert.ok(node.label, `${packet.packetId} node should include a label`);
    assert.ok(Array.isArray(node.aliases), `${packet.packetId} node should include aliases array`);
    assert.ok(Array.isArray(node.sourceRefs), `${packet.packetId} node should include sourceRefs array`);
  }

  const edgeIds = packet.edges.map((edge) => edge.id);
  assert.equal(new Set(edgeIds).size, edgeIds.length, `${packet.packetId} edge ids should be unique`);
  for (const edge of packet.edges) {
    assert.equal(edge.packetId, packet.packetId, `${packet.packetId} edge should preserve packetId`);
    assert.equal(edge.source, 'built-in curriculum packet', `${packet.packetId} edge should use built-in packet source`);
    assert.ok(['relationship', 'comparison'].includes(edge.type), `${packet.packetId} edge should use a normalized edge type`);
    assert.ok(edge.fromTerm, `${packet.packetId} edge should include fromTerm`);
    assert.ok(edge.toTerm, `${packet.packetId} edge should include toTerm`);
    assert.ok(edge.label, `${packet.packetId} edge should include a label`);
    assert.ok(Array.isArray(edge.sourceRefs), `${packet.packetId} edge should include sourceRefs array`);
  }
}

function assertUnit5Waves(packet) {
  assert.ok(packet, 'Unit 5 waves should be normalized');
  assert.ok(packet.nodeCounts.vocabulary > 0, 'Unit 5 waves should include vocabulary nodes');
  assert.ok(packet.nodeCounts.fact > 0, 'Unit 5 waves should include fact nodes');
  assert.ok(packet.nodeCounts.concept > 0, 'Unit 5 waves should include concept nodes');
  assert.ok(packet.nodeCounts.formula > 0, 'Unit 5 waves should include formula nodes');
  assert.ok(packet.edgeCounts.relationship > 0, 'Unit 5 waves should include relationship edges');

  const wavelength = packet.nodes.find((node) => node.id === 'unit5-waves:vocabulary:wavelength');
  assert.ok(wavelength, 'Unit 5 waves should normalize wavelength vocabulary to a stable graph-support node id');
  assert.equal(wavelength.unit, 'Unit 5', 'Unit 5 vocabulary node should keep formatted unit label');
  assert.ok(wavelength.aliases.includes('lambda'), 'Wavelength node should preserve aliases');

  const relationship = packet.edges.find((edge) =>
    edge.type === 'relationship' &&
    edge.fromTerm === 'wavelength' &&
    edge.toTerm === 'frequency'
  );
  assert.ok(relationship, 'Unit 5 waves should normalize wavelength/frequency relationship edges');
}

function assertUnit6Matter(packet) {
  assert.ok(packet, 'Unit 6 matter should be normalized');
  assert.ok(packet.nodeCounts.vocabulary > 0, 'Unit 6 matter should include vocabulary nodes');
  assert.ok(packet.nodeCounts.fact > 0, 'Unit 6 matter should include fact nodes');
  assert.ok(packet.nodeCounts.concept > 0, 'Unit 6 matter should include concept nodes');
  assert.ok(packet.nodeCounts.formula > 0, 'Unit 6 matter should include formula nodes');
  assert.ok(packet.edgeCounts.relationship > 0, 'Unit 6 matter should include relationship edges');
  assert.ok(packet.edgeCounts.comparison > 0, 'Unit 6 matter should include comparison edges');

  const density = packet.nodes.find((node) => node.id === 'unit6-matter:vocabulary:density');
  assert.ok(density, 'Unit 6 matter should normalize density vocabulary to a stable graph-support node id');
  assert.equal(density.unit, 'Unit 6', 'Unit 6 vocabulary node should keep formatted unit label');
  assert.ok(density.aliases.includes('D = m / V'), 'Density node should preserve formula alias');

  const changeComparison = packet.edges.find((edge) =>
    edge.type === 'comparison' &&
    edge.fromTerm === 'physical change' &&
    edge.toTerm === 'chemical change'
  );
  assert.ok(changeComparison, 'Unit 6 matter should normalize physical/chemical change comparison edges');
}

function assertUnit7AtomicStructure(packet) {
  assert.ok(packet, 'Unit 7 should be normalized');
  assert.ok(packet.nodeCounts.vocabulary > 0, 'Unit 7 should include vocabulary nodes');
  assert.ok(packet.nodeCounts.fact > 0, 'Unit 7 should include fact nodes');
  assert.ok(packet.nodeCounts.concept > 0, 'Unit 7 should include concept nodes');
  assert.ok(packet.nodeCounts.formula > 0, 'Unit 7 should include formula nodes');
  assert.ok(packet.edgeCounts.relationship > 0, 'Unit 7 should include relationship edges');
  assert.ok(packet.edgeCounts.comparison > 0, 'Unit 7 should include comparison edges');

  const electron = packet.nodes.find((node) => node.id === 'unit7-atomic-structure:vocabulary:electron');
  assert.ok(electron, 'Unit 7 should normalize electron vocabulary to a stable graph-support node id');
  assert.equal(electron.unit, 'Unit 7', 'Unit 7 vocabulary node should keep formatted unit label');
  assert.equal(electron.term, 'electron', 'Electron node should keep the packet term');
  assert.ok(electron.aliases.includes('e-'), 'Electron node should preserve aliases');

  const particleComparison = packet.edges.find((edge) =>
    edge.type === 'comparison' &&
    edge.fromTerm === 'proton' &&
    edge.toTerm === 'neutron'
  );
  assert.ok(particleComparison, 'Unit 7 should normalize comparison pairs into graph-support comparison edges');
  assert.equal(particleComparison.graphType, 'commonly_confused_with', 'Comparison edges should be graph-compatible support edges');
}

function assertUnit8Bonding(packet) {
  assert.ok(packet, 'Unit 8 bonding should be normalized');
  assert.ok(packet.nodeCounts.vocabulary > 0, 'Unit 8 bonding should include vocabulary nodes');
  assert.ok(packet.nodeCounts.fact > 0, 'Unit 8 bonding should include fact nodes');
  assert.ok(packet.nodeCounts.concept > 0, 'Unit 8 bonding should include concept nodes');
  assert.ok(packet.nodeCounts.formula > 0, 'Unit 8 bonding should include formula/rule nodes');
  assert.ok(packet.edgeCounts.relationship > 0, 'Unit 8 bonding should include relationship edges');
  assert.ok(packet.edgeCounts.comparison > 0, 'Unit 8 bonding should include comparison edges');

  const octetRule = packet.nodes.find((node) => node.id === 'unit8-bonding:vocabulary:octet-rule');
  assert.ok(octetRule, 'Unit 8 bonding should normalize octet rule vocabulary to a stable graph-support node id');
  assert.equal(octetRule.unit, 'Unit 8', 'Unit 8 vocabulary node should keep formatted unit label');
  assert.ok(octetRule.aliases.includes('rule of eight'), 'Octet rule node should preserve aliases');

  const bondComparison = packet.edges.find((edge) =>
    edge.type === 'comparison' &&
    edge.fromTerm === 'ionic bond' &&
    edge.toTerm === 'covalent bond'
  );
  assert.ok(bondComparison, 'Unit 8 bonding should normalize ionic/covalent comparison edges');
}

function assertUnit9Reactions(packet) {
  assert.ok(packet, 'Unit 9 reactions should be normalized');
  assert.ok(packet.nodeCounts.vocabulary > 0, 'Unit 9 reactions should include vocabulary nodes');
  assert.ok(packet.nodeCounts.fact > 0, 'Unit 9 reactions should include fact nodes');
  assert.ok(packet.nodeCounts.concept > 0, 'Unit 9 reactions should include concept nodes');
  assert.ok(packet.nodeCounts.formula > 0, 'Unit 9 reactions should include formula/rule nodes');
  assert.ok(packet.edgeCounts.relationship > 0, 'Unit 9 reactions should include relationship edges');
  assert.ok(packet.edgeCounts.comparison > 0, 'Unit 9 reactions should include comparison edges');

  const aqueous = packet.nodes.find((node) => node.id === 'unit9-reactions:vocabulary:aqueous');
  assert.ok(aqueous, 'Unit 9 reactions should normalize aqueous vocabulary to a stable graph-support node id');
  assert.equal(aqueous.unit, 'Unit 9', 'Unit 9 vocabulary node should keep formatted unit label');

  const fissionFusion = packet.edges.find((edge) =>
    edge.type === 'comparison' &&
    edge.fromTerm === 'nuclear fission' &&
    edge.toTerm === 'nuclear fusion'
  );
  assert.ok(fissionFusion, 'Unit 9 reactions should normalize fission/fusion comparison edges');
}

function assertMotionForce(packet) {
  assert.ok(packet, 'Motion-force should be normalized');
  assert.ok(packet.nodeCounts.vocabulary > 0, 'Motion-force should include vocabulary nodes');
  assert.ok(packet.nodeCounts.concept > 0, 'Motion-force should include concept nodes');
  assert.ok(packet.nodeCounts.formula > 0, 'Motion-force should include formula nodes');
  assert.equal(packet.nodeCounts.fact, 0, 'Motion-force should not invent fact nodes when the packet has no canonical facts');
  assert.equal(packet.edgeCounts.total, 0, 'Motion-force should not revive graph seed relationships through this normalizer');
}

function assertIndividualNormalizers() {
  const registry = getBuiltinPacketRegistry();
  const unit7Entry = registry.find((entry) => entry.packetId === 'unit7-atomic-structure');
  const unit7Packet = loadBuiltinPacketForRegistryEntry(unit7Entry).packet;
  const unit7Graph = normalizeBuiltinPacketForGraph(unit7Packet, unit7Entry);

  assert.equal(unit7Graph.packetId, 'unit7-atomic-structure', 'Single-packet normalizer should preserve packetId');
  assert.equal(unit7Graph.normalizationStatus, 'normalized', 'Single-packet normalizer should return normalized status');
  assert.equal(normalizeVocabularyNodes(unit7Packet, unit7Entry).length, unit7Packet.vocabulary.length, 'Vocabulary normalizer should mirror packet vocabulary count');
  assert.equal(normalizeConceptNodes(unit7Packet, unit7Entry).length, unit7Packet.concepts.length, 'Concept normalizer should mirror packet concept count');
  assert.equal(normalizeFactNodes(unit7Packet, unit7Entry).length, unit7Packet.canonicalFacts.length, 'Fact normalizer should mirror packet fact count');
  assert.equal(normalizeFormulaNodes(unit7Packet, unit7Entry).length, unit7Packet.referenceFormulas.length, 'Formula normalizer should mirror packet formula count');
  assert.equal(normalizeRelationshipEdges(unit7Packet, unit7Entry).length, unit7Packet.relationships.length, 'Relationship normalizer should mirror packet relationship count');
  assert.ok(normalizeComparisonEdges(unit7Packet, unit7Entry).length >= unit7Packet.comparisons.length, 'Comparison normalizer should emit one or more support edges for multi-term comparisons');
}

function assertReport(normalized) {
  const report = getBuiltinPacketGraphReport();
  assert.equal(report.length, EXPECTED_REGISTRY_COUNT, 'Graph report should include all registry entries');
  assert.deepEqual(
    report.map((entry) => entry.packetId),
    getBuiltinPacketRegistry().map((entry) => entry.packetId),
    'Graph report should preserve built-in packet registry order'
  );
  const byId = new Map(report.map((entry) => [entry.packetId, entry]));
  for (const packet of normalized.packets) {
    const reportEntry = byId.get(packet.packetId);
    assert.ok(reportEntry, `${packet.packetId} should appear in graph report`);
    assert.equal(reportEntry.normalizationStatus, 'normalized', `${packet.packetId} report should show normalized`);
    assert.deepEqual(reportEntry.nodeCounts, packet.nodeCounts, `${packet.packetId} report should preserve node counts`);
    assert.deepEqual(reportEntry.edgeCounts, packet.edgeCounts, `${packet.packetId} report should preserve edge counts`);
  }
  for (const skippedId of EXPECTED_SKIPPED_IDS) {
    const reportEntry = byId.get(skippedId);
    assert.ok(reportEntry, `${skippedId} should appear in graph report`);
    assert.equal(reportEntry.normalizationStatus, 'skipped', `${skippedId} report should show skipped`);
    assert.equal(reportEntry.validationStatus, 'legacy-gap', `${skippedId} report should preserve legacy-gap status`);
  }
}

function assertNoForbiddenPaths(value) {
  for (const text of collectStrings(value)) {
    const normalized = text.replace(/\\/g, '/');
    for (const forbidden of FORBIDDEN_PATH_PARTS) {
      assert.equal(
        normalized.includes(forbidden),
        false,
        `Graph normalizer should not reference forbidden teacher upload/approved/draft path: ${forbidden}`
      );
    }
  }
}

function printSummary(normalized) {
  console.log('Built-in packet graph normalizer summary:');
  for (const packet of normalized.packets) {
    console.log(`- ${packet.packetId}: nodes=${packet.nodeCounts.total} (vocab=${packet.nodeCounts.vocabulary}, concepts=${packet.nodeCounts.concept}, facts=${packet.nodeCounts.fact}, formulas=${packet.nodeCounts.formula}); edges=${packet.edgeCounts.total} (relationships=${packet.edgeCounts.relationship}, comparisons=${packet.edgeCounts.comparison})`);
  }
  for (const skipped of normalized.skipped) {
    console.log(`- ${skipped.packetId}: skipped (${skipped.validationStatus})`);
  }
}

function collectStrings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

main();
