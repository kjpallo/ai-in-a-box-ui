const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadApprovedKnowledgePacks } = require('../lib/knowledge/loadApprovedKnowledgePacks');
const { loadDraftKnowledgePacks } = require('../lib/knowledge/loadDraftKnowledgePacks');

const projectRoot = path.join(__dirname, '..');
const exampleDraftPacksDir = path.join(projectRoot, 'knowledge', 'draft-packs');

const loadedExample = loadDraftKnowledgePacks({
  draftPacksDir: exampleDraftPacksDir
});
assert.equal(loadedExample.errors.length, 0, loadedExample.errors.map((error) => error.errors.join('\n')).join('\n'));
assert.ok(
  loadedExample.packs.some((record) => record.packId === 'draft-sample-physical-science'),
  'example draft pack should load'
);

const exampleRecord = loadedExample.packs.find((record) => record.packId === 'draft-sample-physical-science');
assert.equal(exampleRecord.title, 'Draft Sample Physical Science Pack');
assert.equal(exampleRecord.version, '0.1.0-draft');
assert.equal(exampleRecord.subject, 'Physical Science');
assert.equal(exampleRecord.gradeLevel, '8');
assert.ok(exampleRecord.sourcePath.endsWith(path.join('_example', 'knowledge_pack.json')));

const examplePack = exampleRecord.pack;
assert.ok(examplePack.vocabulary.some((item) => item.reviewStatus === 'pending'), 'pending vocabulary should be allowed');
assert.ok(examplePack.concepts.some((item) => item.reviewStatus === 'pending'), 'pending concepts should be allowed');
assert.ok(examplePack.problemBank.some((item) => item.reviewStatus === 'pending'), 'pending problemBank items should be allowed');
assert.ok(
  examplePack.referenceFormulas.every((item) => item.solverStatus === 'reference_only'),
  'draft reference formulas should be reference_only'
);

const approvedLoadResult = loadApprovedKnowledgePacks({
  approvedPacksDir: path.join(projectRoot, 'knowledge', 'approved-packs')
});
assert.equal(
  approvedLoadResult.packs.some((record) => record.packId === 'draft-sample-physical-science'),
  false,
  'draft packs should not be included by the approved-pack loader'
);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-pack-loader-'));
const validPackDir = path.join(tempRoot, 'valid-draft-pack');
const invalidPackDir = path.join(tempRoot, 'invalid-draft-pack');
const solverClaimDir = path.join(tempRoot, 'solver-claim-draft-pack');
fs.mkdirSync(validPackDir, { recursive: true });
fs.mkdirSync(invalidPackDir, { recursive: true });
fs.mkdirSync(solverClaimDir, { recursive: true });
fs.writeFileSync(path.join(validPackDir, 'knowledge_pack.json'), JSON.stringify(makeMinimalPack({
  vocabulary: [
    {
      term: 'pending term',
      aliases: [],
      standards: [],
      reviewStatus: 'pending',
      confidence: 'medium',
      sourceFile: 'draft.pdf',
      sourceLocation: 'p. 1',
      sourceTextSnippet: 'Pending term.'
    }
  ]
}), null, 2));
fs.writeFileSync(path.join(invalidPackDir, 'knowledge_pack.json'), JSON.stringify({ packId: '../not-safe' }, null, 2));
fs.writeFileSync(path.join(solverClaimDir, 'knowledge_pack.json'), JSON.stringify(makeMinimalPack({
  packId: 'solver-claim-draft-pack',
  referenceFormulas: [
    {
      formulaId: 'draft-force',
      title: 'Draft Force',
      equation: 'F = m * a',
      variables: [],
      solverStatus: 'science_formula_rules',
      reviewStatus: 'pending',
      confidence: 'medium',
      sourceFile: 'draft.pdf',
      sourceLocation: 'p. 2',
      sourceTextSnippet: 'Force equals mass times acceleration.'
    }
  ]
}), null, 2));

const tempLoadResult = loadDraftKnowledgePacks({ draftPacksDir: tempRoot });
assert.equal(tempLoadResult.packs.length, 1, 'valid temp draft pack should load');
assert.equal(tempLoadResult.errors.length, 2, 'invalid temp draft packs should return validation errors');
assert.ok(
  tempLoadResult.errors.some((errorRecord) => errorRecord.errors.some((error) => error.includes('safe for filenames'))),
  'invalid draft pack should report validation errors'
);
assert.ok(
  tempLoadResult.errors.some((errorRecord) => errorRecord.errors.some((error) => error.includes('cannot claim solver support'))),
  'draft formulas should not claim solver support'
);

function makeMinimalPack(overrides = {}) {
  return {
    packId: 'minimal-draft-pack',
    title: 'Minimal Draft Pack',
    version: '0.1.0-draft',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [],
    vocabulary: [],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: [],
    metadata: {},
    ...overrides
  };
}

console.log('Draft knowledge pack workspace tests passed.');
