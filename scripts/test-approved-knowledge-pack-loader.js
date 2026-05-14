const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildKnowledgePackIndex } = require('../lib/knowledge/buildKnowledgePackIndex');
const { loadApprovedKnowledgePacks } = require('../lib/knowledge/loadApprovedKnowledgePacks');

const projectRoot = path.join(__dirname, '..');
const exampleApprovedPacksDir = path.join(projectRoot, 'knowledge', 'approved-packs');

const loadedExample = loadApprovedKnowledgePacks({
  approvedPacksDir: exampleApprovedPacksDir
});
assert.equal(loadedExample.errors.length, 0, loadedExample.errors.map((error) => error.errors.join('\n')).join('\n'));
assert.ok(
  loadedExample.packs.some((record) => record.packId === 'sample-physical-science'),
  'example approved pack should load'
);

const exampleRecord = loadedExample.packs.find((record) => record.packId === 'sample-physical-science');
assert.equal(exampleRecord.title, 'Sample Physical Science Pack');
assert.equal(exampleRecord.version, '0.1.0');
assert.equal(exampleRecord.subject, 'Physical Science');
assert.equal(exampleRecord.gradeLevel, '8');
assert.ok(exampleRecord.sourcePath.endsWith(path.join('_example', 'knowledge_pack.json')));

const exampleIndex = buildKnowledgePackIndex(loadedExample.packs);
assert.equal(exampleIndex.vocabularyByTerm.velocity[0].packId, 'sample-physical-science');
assert.equal(exampleIndex.vocabularyByAlias['speed with direction'][0].type, 'vocabulary');
assert.equal(exampleIndex.conceptsByTitle['balanced and unbalanced forces'][0].type, 'concept');
assert.equal(exampleIndex.conceptsByAlias['force balance'][0].packTitle, 'Sample Physical Science Pack');
assert.equal(exampleIndex.problemBankByQuestion['a box is pushed with 6 n right and 6 n left. are the forces balanced?'][0].type, 'problem');
assert.equal(exampleIndex.standardsMapByStandardId['sample.ps.forces.1'][0].type, 'standardsMap');
assert.deepEqual(exampleIndex.vocabularyByTerm.velocity[0].standards, ['SAMPLE.PS.MOTION.1']);
assert.equal(exampleIndex.vocabularyByTerm.velocity[0].sourceTracking.sourceFile, 'sample_motion_notes.pdf');

const syntheticPack = makeMinimalPack({
  vocabulary: [
    {
      term: 'approved term',
      aliases: ['approved alias'],
      standards: ['SAMPLE.PS.FORCES.1'],
      reviewStatus: 'approved',
      confidence: 'high',
      sourceFile: 'source.pdf',
      sourceLocation: 'p. 1',
      sourceTextSnippet: 'Approved term.'
    },
    {
      term: 'pending term',
      aliases: ['pending alias'],
      standards: [],
      reviewStatus: 'pending',
      confidence: 'medium',
      sourceFile: 'source.pdf',
      sourceLocation: 'p. 2',
      sourceTextSnippet: 'Pending term.'
    },
    {
      term: 'rejected term',
      aliases: ['rejected alias'],
      standards: [],
      reviewStatus: 'rejected',
      confidence: 'low',
      sourceFile: 'source.pdf',
      sourceLocation: 'p. 3',
      sourceTextSnippet: 'Rejected term.'
    }
  ],
  concepts: [
    {
      conceptId: 'approved-concept',
      title: 'Approved Concept',
      aliases: ['approved concept alias'],
      keyIdeas: [],
      examples: [],
      nonExamples: [],
      commonMisconceptions: [],
      standards: ['SAMPLE.PS.FORCES.1'],
      reviewStatus: 'approved',
      confidence: 'high',
      sourceFile: 'source.pdf',
      sourceLocation: 'p. 4',
      sourceTextSnippet: 'Approved concept.'
    },
    {
      conceptId: 'pending-concept',
      title: 'Pending Concept',
      aliases: ['pending concept alias'],
      keyIdeas: [],
      examples: [],
      nonExamples: [],
      commonMisconceptions: [],
      standards: [],
      reviewStatus: 'pending',
      confidence: 'medium',
      sourceFile: 'source.pdf',
      sourceLocation: 'p. 5',
      sourceTextSnippet: 'Pending concept.'
    }
  ],
  standardsMap: [
    {
      standardId: 'SAMPLE.PS.FORCES.1',
      description: 'Describe forces.',
      reviewStatus: 'approved',
      confidence: 'high'
    },
    {
      standardId: 'SAMPLE.PS.PENDING.1',
      description: 'Pending standard.',
      reviewStatus: 'pending',
      confidence: 'medium'
    }
  ]
});

const syntheticIndex = buildKnowledgePackIndex([
  {
    pack: syntheticPack,
    packId: syntheticPack.packId,
    title: syntheticPack.title
  }
]);
assert.ok(syntheticIndex.vocabularyByTerm['approved term'], 'approved vocabulary term should be indexed');
assert.ok(syntheticIndex.vocabularyByAlias['approved alias'], 'approved vocabulary alias should be indexed');
assert.ok(syntheticIndex.conceptsByTitle['approved concept'], 'approved concept title should be indexed');
assert.ok(syntheticIndex.conceptsByAlias['approved concept alias'], 'approved concept alias should be indexed');
assert.equal(syntheticIndex.vocabularyByTerm['pending term'], undefined, 'pending vocabulary should be ignored');
assert.equal(syntheticIndex.vocabularyByAlias['rejected alias'], undefined, 'rejected vocabulary aliases should be ignored');
assert.equal(syntheticIndex.conceptsByTitle['pending concept'], undefined, 'pending concepts should be ignored');
assert.ok(syntheticIndex.standardsMapByStandardId['sample.ps.forces.1'], 'approved standardsMap entry should be indexed');
assert.equal(syntheticIndex.standardsMapByStandardId['sample.ps.pending.1'], undefined, 'pending standardsMap should be ignored');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'approved-pack-loader-'));
const validPackDir = path.join(tempRoot, 'valid-pack');
const invalidPackDir = path.join(tempRoot, 'invalid-pack');
const ignoredDir = path.join(tempRoot, 'ignored');
fs.mkdirSync(validPackDir, { recursive: true });
fs.mkdirSync(invalidPackDir, { recursive: true });
fs.mkdirSync(ignoredDir, { recursive: true });
fs.writeFileSync(path.join(validPackDir, 'knowledge_pack.json'), JSON.stringify(makeMinimalPack(), null, 2));
fs.writeFileSync(path.join(invalidPackDir, 'knowledge_pack.json'), JSON.stringify({ packId: '../not-safe' }, null, 2));
fs.writeFileSync(path.join(ignoredDir, 'notes.json'), JSON.stringify({ ignored: true }, null, 2));

const tempLoadResult = loadApprovedKnowledgePacks({ approvedPacksDir: tempRoot });
assert.equal(tempLoadResult.packs.length, 1, 'valid temp pack should load');
assert.equal(tempLoadResult.errors.length, 1, 'invalid temp pack should return validation errors');
assert.equal(tempLoadResult.errors[0].packId, '../not-safe');
assert.ok(
  tempLoadResult.errors[0].errors.some((error) => error.includes('safe for filenames')),
  'invalid temp pack should report validation errors'
);

function makeMinimalPack(overrides = {}) {
  return {
    packId: 'minimal-pack',
    title: 'Minimal Pack',
    version: '0.1.0',
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

console.log('Approved knowledge pack loader tests passed.');
