const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { deleteApprovedKnowledgePack } = require('../lib/knowledge/deleteApprovedKnowledgePack');

const projectRoot = path.join(__dirname, '..');
const tempRoot = path.join(projectRoot, 'tmp', 'test-isolated-saved-knowledge-delete');
const draftPacksDir = path.join(tempRoot, 'knowledge', 'draft-packs');
const approvedPacksDir = path.join(tempRoot, 'knowledge', 'approved-packs');

main();

function main() {
  cleanup();
  fs.mkdirSync(draftPacksDir, { recursive: true });
  fs.mkdirSync(approvedPacksDir, { recursive: true });

  const packA = 'isolated-pack-a-draft-only';
  const packB = 'isolated-pack-b-approved-only';
  const packC = 'isolated-pack-c-both';
  const packSimilarKeep = 'isolated-pack-similar-keep';

  // 1) Draft-only pack A
  writePack(draftPacksDir, {
    packId: packA,
    title: 'Energy Unit 1'
  });

  // 2) Approved-only pack B
  writePack(approvedPacksDir, {
    packId: packB,
    title: 'Forces Unit 1'
  });

  // 3) Pack C in both roots
  writePack(draftPacksDir, {
    packId: packC,
    title: 'Motion Unit 1'
  });
  writePack(approvedPacksDir, {
    packId: packC,
    title: 'Motion Unit 1'
  });

  // 4) Similar-title, different packId (must survive)
  writePack(approvedPacksDir, {
    packId: packSimilarKeep,
    title: 'Forces Unit 1'
  });

  const sharedOptions = {
    draftPacksDir,
    approvedPacksDir,
    confirmed: true
  };

  // Delete A (draft-only)
  const deleteA = deleteApprovedKnowledgePack(packA, sharedOptions);
  assert.equal(deleteA.success, true);
  assert.ok(Array.isArray(deleteA.deleted));
  assert.ok(Array.isArray(deleteA.notFound));
  assert.ok(Array.isArray(deleteA.errors));
  assert.equal(existsPack(draftPacksDir, packA), false, 'A should be removed from draft-packs');
  assert.equal(existsPack(approvedPacksDir, packA), false, 'A should not exist in approved-packs');

  // Delete B (approved-only)
  const deleteB = deleteApprovedKnowledgePack(packB, sharedOptions);
  assert.equal(deleteB.success, true);
  assert.ok(Array.isArray(deleteB.deleted));
  assert.ok(Array.isArray(deleteB.notFound));
  assert.ok(Array.isArray(deleteB.errors));
  assert.equal(existsPack(approvedPacksDir, packB), false, 'B should be removed from approved-packs');
  assert.equal(existsPack(draftPacksDir, packB), false, 'B should not exist in draft-packs');

  // Delete C (exists in both)
  const deleteC = deleteApprovedKnowledgePack(packC, sharedOptions);
  assert.equal(deleteC.success, true);
  assert.ok(Array.isArray(deleteC.deleted));
  assert.ok(Array.isArray(deleteC.notFound));
  assert.ok(Array.isArray(deleteC.errors));
  assert.equal(existsPack(draftPacksDir, packC), false, 'C should be removed from draft-packs');
  assert.equal(existsPack(approvedPacksDir, packC), false, 'C should be removed from approved-packs');

  // Similar-title pack with different packId must remain
  assert.equal(existsPack(approvedPacksDir, packSimilarKeep), true, 'Similar-title different packId should remain');

  // Missing pack should return success:false + notFound
  const missing = deleteApprovedKnowledgePack('isolated-pack-missing', sharedOptions);
  assert.equal(missing.success, false);
  assert.ok(Array.isArray(missing.deleted));
  assert.ok(Array.isArray(missing.notFound));
  assert.ok(Array.isArray(missing.errors));
  assert.equal(missing.notFound.includes('isolated-pack-missing'), true);

  console.log('Isolated saved knowledge delete verification: PASS');
  console.log('Verified cases: draft-only, approved-only, both locations, similar-title safety, response shape.');

  cleanup();
}

function writePack(rootDir, pack) {
  const dir = path.join(rootDir, pack.packId);
  fs.mkdirSync(dir, { recursive: true });
  const data = {
    packId: pack.packId,
    title: pack.title,
    version: '1.0.0',
    subject: 'Science',
    gradeBand: '6-8',
    vocabulary: [],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  };
  fs.writeFileSync(path.join(dir, 'knowledge_pack.json'), `${JSON.stringify(data, null, 2)}\n`);
}

function existsPack(rootDir, packId) {
  return fs.existsSync(path.join(rootDir, packId, 'knowledge_pack.json'));
}

function cleanup() {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
