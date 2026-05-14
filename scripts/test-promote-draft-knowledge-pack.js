const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { promoteDraftKnowledgePack } = require('../lib/knowledge/promoteDraftKnowledgePack');

const projectRoot = path.join(__dirname, '..');
const tempRoot = path.join(projectRoot, 'tmp', 'test-promote-draft-pack');
const draftPacksDir = path.join(tempRoot, 'draft-packs');
const approvedPacksDir = path.join(tempRoot, 'approved-packs');
const standardsBank = makeStandardsBank();

cleanupTempRoot();
fs.mkdirSync(draftPacksDir, { recursive: true });
fs.mkdirSync(approvedPacksDir, { recursive: true });

try {
  assertBlocksPendingItems();
  assertBlocksRejectedItems();
  assertBlocksInvalidSolverStatus();
  assertBlocksInvalidStandardReferenceWithBank();
  assertPromotesApprovedOnlyPackToTempOutput();
  assertExistingApprovedPackRequiresForce();
  assertDraftPacksAreNotModified();
} finally {
  cleanupTempRoot();
}

console.log('Draft knowledge pack promotion tests passed.');

function assertBlocksPendingItems() {
  writeDraftPack(makePack({
    packId: 'pending-draft-pack',
    vocabulary: [
      {
        ...makeVocabularyItem('pending-term'),
        reviewStatus: 'pending'
      }
    ]
  }));

  const result = promoteDraftKnowledgePack('pending-draft-pack', {
    draftPacksDir,
    approvedPacksDir,
    standardsBank
  });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, true);
  assert.ok(result.errors.some((error) => error.includes('pending teacher review')));
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'pending-draft-pack', 'knowledge_pack.json')), false);
}

function assertBlocksRejectedItems() {
  writeDraftPack(makePack({
    packId: 'rejected-draft-pack',
    concepts: [
      {
        ...makeConceptItem('rejected-concept'),
        reviewStatus: 'rejected'
      }
    ]
  }));

  const result = promoteDraftKnowledgePack('rejected-draft-pack', {
    draftPacksDir,
    approvedPacksDir,
    standardsBank
  });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((error) => error.includes('has been rejected')));
}

function assertBlocksInvalidSolverStatus() {
  writeDraftPack(makePack({
    packId: 'solver-status-draft-pack',
    referenceFormulas: [
      {
        ...makeReferenceFormula('force-formula'),
        solverStatus: 'science_formula_rules'
      }
    ]
  }));

  const result = promoteDraftKnowledgePack('solver-status-draft-pack', {
    draftPacksDir,
    approvedPacksDir,
    standardsBank
  });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, false);
  assert.ok(result.errors.some((error) => error.includes('cannot claim solver support')));
}

function assertBlocksInvalidStandardReferenceWithBank() {
  writeDraftPack(makePack({
    packId: 'invalid-standard-draft-pack',
    problemBank: [
      {
        ...makeProblemItem('unknown-standard-problem'),
        standards: ['SAMPLE.PS.UNKNOWN.1']
      }
    ]
  }));

  const result = promoteDraftKnowledgePack('invalid-standard-draft-pack', {
    draftPacksDir,
    approvedPacksDir,
    standardsBank
  });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, false);
  assert.ok(result.errors.some((error) => error.includes('unknown standard reference')));
}

function assertPromotesApprovedOnlyPackToTempOutput() {
  const pack = makePack({ packId: 'approved-only-draft-pack' });
  const sourcePath = writeDraftPack(pack);

  const result = promoteDraftKnowledgePack(sourcePath, {
    approvedPacksDir,
    standardsBank
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.validationPassed, true);
  assert.ok(result.outputPath.endsWith(path.join('approved-only-draft-pack', 'knowledge_pack.json')));

  const promotedPack = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.deepEqual(promotedPack.metadata, pack.metadata, 'metadata should be preserved');
  assert.deepEqual(promotedPack.vocabulary[0].sourceFile, pack.vocabulary[0].sourceFile, 'source tracking should be preserved');
}

function assertExistingApprovedPackRequiresForce() {
  const pack = makePack({ packId: 'overwrite-draft-pack' });
  writeDraftPack(pack);

  const firstResult = promoteDraftKnowledgePack('overwrite-draft-pack', {
    draftPacksDir,
    approvedPacksDir,
    standardsBank
  });
  assert.equal(firstResult.success, true, firstResult.errors.join('\n'));

  const existingPath = firstResult.outputPath;
  const existingJson = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  existingJson.title = 'Existing Approved Pack';
  fs.writeFileSync(existingPath, `${JSON.stringify(existingJson, null, 2)}\n`);

  const blockedResult = promoteDraftKnowledgePack('overwrite-draft-pack', {
    draftPacksDir,
    approvedPacksDir,
    standardsBank
  });
  assert.equal(blockedResult.success, false);
  assert.ok(blockedResult.errors.some((error) => error.includes('already exists')));
  assert.equal(JSON.parse(fs.readFileSync(existingPath, 'utf8')).title, 'Existing Approved Pack');

  const forcedResult = promoteDraftKnowledgePack('overwrite-draft-pack', {
    draftPacksDir,
    approvedPacksDir,
    standardsBank,
    force: true
  });
  assert.equal(forcedResult.success, true, forcedResult.errors.join('\n'));
  assert.equal(JSON.parse(fs.readFileSync(existingPath, 'utf8')).title, pack.title);
}

function assertDraftPacksAreNotModified() {
  const pack = makePack({ packId: 'draft-unchanged-pack' });
  const sourcePath = writeDraftPack(pack);
  const before = fs.readFileSync(sourcePath, 'utf8');

  const result = promoteDraftKnowledgePack('draft-unchanged-pack', {
    draftPacksDir,
    approvedPacksDir,
    standardsBank
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(fs.readFileSync(sourcePath, 'utf8'), before, 'draft pack file should not be modified');
}

function writeDraftPack(pack) {
  const packDir = path.join(draftPacksDir, pack.packId);
  const packPath = path.join(packDir, 'knowledge_pack.json');
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`);
  return packPath;
}

function makePack(overrides = {}) {
  return {
    packId: 'approved-draft-pack',
    title: 'Approved Draft Pack',
    version: '0.1.0-draft',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [],
    vocabulary: [makeVocabularyItem('net-force')],
    concepts: [makeConceptItem('balanced-forces')],
    referenceFormulas: [makeReferenceFormula('force-reference')],
    problemBank: [makeProblemItem('balanced-force-problem')],
    standardsMap: [makeStandardsMapItem('SAMPLE.PS.FORCES.1')],
    smokeTests: [],
    metadata: {
      createdBy: 'test-suite',
      createdAt: '2026-05-13T00:00:00.000Z',
      notes: 'Promotion test fixture.'
    },
    ...overrides
  };
}

function makeVocabularyItem(term) {
  return {
    term,
    aliases: [],
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus: 'approved',
    confidence: 'high',
    sourceFile: 'teacher_upload.pdf',
    sourceLocation: 'p. 1',
    sourceTextSnippet: 'Net force changes motion.'
  };
}

function makeConceptItem(conceptId) {
  return {
    conceptId,
    title: 'Balanced Forces',
    aliases: [],
    keyIdeas: ['Balanced forces do not change motion.'],
    examples: ['Equal pushes from opposite sides.'],
    nonExamples: ['A stronger push from one side.'],
    commonMisconceptions: ['Balanced forces mean no forces exist.'],
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus: 'approved',
    confidence: 'high',
    sourceFile: 'teacher_upload.pdf',
    sourceLocation: 'p. 2',
    sourceTextSnippet: 'Balanced forces do not change motion.'
  };
}

function makeReferenceFormula(formulaId) {
  return {
    formulaId,
    title: 'Net Force Reference',
    equation: 'net force = sum of forces',
    variables: [],
    solverStatus: 'reference_only',
    reviewStatus: 'approved',
    confidence: 'high',
    sourceFile: 'teacher_upload.pdf',
    sourceLocation: 'p. 3',
    sourceTextSnippet: 'Net force is the sum of forces.'
  };
}

function makeProblemItem(problemId) {
  return {
    problemId,
    question: 'A box has equal forces from both sides. What happens to its motion?',
    expectedAnswer: 'The balanced forces do not change its motion.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus: 'approved',
    confidence: 'high',
    sourceFile: 'teacher_upload.pdf',
    sourceLocation: 'p. 4',
    sourceTextSnippet: 'Balanced forces do not change motion.'
  };
}

function makeStandardsMapItem(standardId) {
  return {
    standardId,
    description: 'Describe how balanced and unbalanced forces affect motion.',
    relatedVocabulary: ['net-force'],
    relatedConcepts: ['balanced-forces'],
    reviewStatus: 'approved',
    confidence: 'high'
  };
}

function makeStandardsBank() {
  return {
    standardsBankId: 'sample_physical_science_standards',
    title: 'Sample Physical Science Standards Bank',
    version: '0.1.0',
    subject: 'Physical Science',
    gradeLevel: '8',
    jurisdiction: 'Local Sample',
    sourceFiles: [],
    standards: [
      {
        standardId: 'SAMPLE.PS.FORCES.1',
        code: 'PS.FORCES.1',
        title: 'Balanced and Unbalanced Forces',
        officialText: 'Describe how balanced and unbalanced forces affect motion.',
        studentFriendlyText: 'I can explain how balanced and unbalanced forces change motion.',
        strand: 'Physical Science',
        topic: 'Forces and Motion',
        keywords: ['balanced forces'],
        questionTriggers: ['net force'],
        prerequisiteStandards: [],
        relatedStandards: [],
        reviewStatus: 'approved',
        confidence: 'high',
        sourceFile: 'sample_standards_source.pdf',
        sourceLocation: 'p. 1',
        sourceTextSnippet: 'Describe how balanced and unbalanced forces affect motion.'
      }
    ],
    metadata: {}
  };
}

function cleanupTempRoot() {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
