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
  'unit7-atomic-structure'
];

function main() {
  const inventory = getUnitPacketInventory();
  assert.ok(Array.isArray(inventory), 'Inventory helper should return an array');
  assert.ok(inventory.length >= REQUIRED_IDS.length, 'Inventory should include known local knowledge packets');

  for (const item of inventory) {
    assert.ok(item.id || item.moduleName, 'Inventory item should include an id or module name');
    assert.ok(item.filePath, `${item.id || item.moduleName} should include a file path`);
    assert.equal(typeof item.exists, 'boolean', `${item.id} should report whether the file exists`);
    assert.ok(item.counts && typeof item.counts === 'object', `${item.id} should include counts`);
    assert.ok(item.presence && typeof item.presence === 'object', `${item.id} should include detected presence flags`);
    assert.ok(Array.isArray(item.notes), `${item.id} should include notes`);
  }

  const byId = new Map(inventory.map((item) => [item.id, item]));
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

  assert.ok(byId.get('motion-force').presence.vocabulary, 'Motion-force modular packet should expose vocabulary');
  assert.ok(byId.get('motion-force').presence.formulas, 'Motion-force modular packet should expose formulas');
  assert.ok(byId.get('motion-force').presence.smokeTests, 'Motion-force modular packet should expose smoke tests');
  assert.ok(byId.get('unit7-atomic-structure').presence.comparisons, 'Unit 7 should expose comparison metadata');
  assert.ok(byId.get('unit7-atomic-structure').presence.relationships, 'Unit 7 should expose relationship metadata');
  assert.ok(byId.get('unit7-atomic-structure').sourceMetadataPresent, 'Unit 7 should expose source metadata');

  printSummary(inventory);
  console.log(`PASS knowledge packet inventory: ${inventory.length} packet/module shapes inspected`);
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
    console.log(`- ${item.id}: ${item.style}; ${source}; ${matcher}; ${summary}`);
  }
}

main();
