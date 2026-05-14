const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  editDraftItemField,
  listReviewableDraftItems,
  updateDraftItemReviewStatus
} = require('../lib/knowledge/reviewDraftKnowledgePack');

const projectRoot = path.join(__dirname, '..');
const tempRoot = path.join(projectRoot, 'tmp', 'test-review-draft-pack');
const draftPacksDir = path.join(tempRoot, 'draft-packs');
const approvedPacksDir = path.join(tempRoot, 'approved-packs');

cleanupTempRoot();
fs.mkdirSync(draftPacksDir, { recursive: true });
fs.mkdirSync(approvedPacksDir, { recursive: true });

try {
  assertListsDraftItems();
  assertFiltersPendingStatus();
  assertApprovesVocabularyItem();
  assertRejectsConceptItem();
  assertEditsAllowedField();
  assertRefusesDisallowedField();
  assertRefusesInvalidSection();
  assertRefusesInvalidIndex();
  assertRefusesInvalidReviewStatus();
  assertPreservesReferenceFormulaSolverStatus();
  assertPreservesSourceTracking();
  assertValidationFailurePreventsSave();
  assertApprovedPacksAreNotModified();
} finally {
  cleanupTempRoot();
}

console.log('Draft knowledge pack review tests passed.');

function assertListsDraftItems() {
  writeDraftPack(makePack({ packId: 'list-draft-pack' }));

  const result = listReviewableDraftItems('list-draft-pack', { draftPacksDir });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.items.length, 6);
  assert.ok(result.items.some((item) => item.section === 'vocabulary' && item.term === 'net-force'));
  assert.ok(result.items.some((item) => item.section === 'referenceFormulas' && item.formula === 'net force = sum of forces'));
  assert.ok(result.items.some((item) => item.sourceFile === 'teacher_upload.pdf'));
}

function assertFiltersPendingStatus() {
  writeDraftPack(makePack({
    packId: 'pending-filter-draft-pack',
    vocabulary: [
      {
        ...makeVocabularyItem('net-force'),
        reviewStatus: 'approved'
      }
    ],
    concepts: [
      {
        ...makeConceptItem('balanced-forces'),
        reviewStatus: 'pending'
      }
    ]
  }));

  const result = listReviewableDraftItems('pending-filter-draft-pack', {
    draftPacksDir,
    status: 'pending'
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((item) => item.reviewStatus === 'pending'));
  assert.equal(result.items.some((item) => item.section === 'vocabulary'), false);
}

function assertApprovesVocabularyItem() {
  writeDraftPack(makePack({ packId: 'approve-vocab-draft-pack' }));

  const result = updateDraftItemReviewStatus('approve-vocab-draft-pack', 'vocabulary', 0, 'approved', { draftPacksDir });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.before, 'pending');
  assert.equal(result.after, 'approved');
  assert.equal(readDraftPack('approve-vocab-draft-pack').vocabulary[0].reviewStatus, 'approved');
}

function assertRejectsConceptItem() {
  writeDraftPack(makePack({ packId: 'reject-concept-draft-pack' }));

  const result = updateDraftItemReviewStatus('reject-concept-draft-pack', 'concepts', 0, 'rejected', { draftPacksDir });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.before, 'pending');
  assert.equal(result.after, 'rejected');
  assert.equal(readDraftPack('reject-concept-draft-pack').concepts[0].reviewStatus, 'rejected');
}

function assertEditsAllowedField() {
  writeDraftPack(makePack({ packId: 'edit-field-draft-pack' }));

  const result = editDraftItemField(
    'edit-field-draft-pack',
    'vocabulary',
    0,
    'studentDefinition',
    'A clearer student definition.',
    { draftPacksDir }
  );

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.changedField, 'studentDefinition');
  assert.equal(readDraftPack('edit-field-draft-pack').vocabulary[0].studentDefinition, 'A clearer student definition.');
}

function assertRefusesDisallowedField() {
  writeDraftPack(makePack({ packId: 'disallowed-field-draft-pack' }));
  const before = readDraftText('disallowed-field-draft-pack');

  const result = editDraftItemField('disallowed-field-draft-pack', 'referenceFormulas', 0, 'solverStatus', 'auto_solver', { draftPacksDir });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((error) => error.includes('not editable')));
  assert.equal(readDraftText('disallowed-field-draft-pack'), before);
}

function assertRefusesInvalidSection() {
  writeDraftPack(makePack({ packId: 'invalid-section-draft-pack' }));

  const result = updateDraftItemReviewStatus('invalid-section-draft-pack', 'router', 0, 'approved', { draftPacksDir });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((error) => error.includes('section must be one of')));
}

function assertRefusesInvalidIndex() {
  writeDraftPack(makePack({ packId: 'invalid-index-draft-pack' }));

  const result = updateDraftItemReviewStatus('invalid-index-draft-pack', 'vocabulary', 9, 'approved', { draftPacksDir });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((error) => error.includes('No item found at vocabulary[9]')));
}

function assertRefusesInvalidReviewStatus() {
  writeDraftPack(makePack({ packId: 'invalid-status-draft-pack' }));
  const before = readDraftText('invalid-status-draft-pack');

  const result = updateDraftItemReviewStatus('invalid-status-draft-pack', 'vocabulary', 0, 'teacher_maybe', { draftPacksDir });

  assert.equal(result.success, false);
  assert.ok(result.errors.some((error) => error.includes('reviewStatus must be one of')));
  assert.equal(readDraftText('invalid-status-draft-pack'), before);
}

function assertPreservesReferenceFormulaSolverStatus() {
  writeDraftPack(makePack({ packId: 'formula-solver-status-draft-pack' }));

  const result = editDraftItemField('formula-solver-status-draft-pack', 'referenceFormulas', 0, 'equation', 'net force = all pushes and pulls', { draftPacksDir });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(readDraftPack('formula-solver-status-draft-pack').referenceFormulas[0].solverStatus, 'reference_only');
}

function assertPreservesSourceTracking() {
  const pack = makePack({ packId: 'source-tracking-draft-pack' });
  writeDraftPack(pack);

  const result = editDraftItemField('source-tracking-draft-pack', 'problemBank', 0, 'expectedAnswer', 'Balanced forces do not change motion.', { draftPacksDir });

  assert.equal(result.success, true, result.errors.join('\n'));
  const edited = readDraftPack('source-tracking-draft-pack').problemBank[0];
  assert.equal(edited.sourceFile, pack.problemBank[0].sourceFile);
  assert.equal(edited.sourceLocation, pack.problemBank[0].sourceLocation);
  assert.equal(edited.sourceTextSnippet, pack.problemBank[0].sourceTextSnippet);
}

function assertValidationFailurePreventsSave() {
  writeDraftPack(makePack({ packId: 'validation-failure-draft-pack' }));
  const before = readDraftText('validation-failure-draft-pack');

  const result = editDraftItemField('validation-failure-draft-pack', 'standardsMap', 0, 'standardId', '', { draftPacksDir });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, false);
  assert.ok(result.errors.some((error) => error.includes('standardsMap[0].standardId')));
  assert.equal(readDraftText('validation-failure-draft-pack'), before);
}

function assertApprovedPacksAreNotModified() {
  const approvedPackPath = path.join(approvedPacksDir, 'review-draft-pack', 'knowledge_pack.json');
  fs.mkdirSync(path.dirname(approvedPackPath), { recursive: true });
  fs.writeFileSync(approvedPackPath, '{"approved":true}\n');
  const before = fs.readFileSync(approvedPackPath, 'utf8');

  writeDraftPack(makePack({ packId: 'approved-untouched-draft-pack' }));
  const result = updateDraftItemReviewStatus('approved-untouched-draft-pack', 'vocabulary', 0, 'approved', { draftPacksDir });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(fs.readFileSync(approvedPackPath, 'utf8'), before);
}

function writeDraftPack(pack) {
  const packDir = path.join(draftPacksDir, pack.packId);
  const packPath = path.join(packDir, 'knowledge_pack.json');
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`);
  return packPath;
}

function readDraftPack(packId) {
  return JSON.parse(readDraftText(packId));
}

function readDraftText(packId) {
  return fs.readFileSync(path.join(draftPacksDir, packId, 'knowledge_pack.json'), 'utf8');
}

function makePack(overrides = {}) {
  return {
    packId: 'review-draft-pack',
    title: 'Review Draft Pack',
    version: '0.1.0-draft',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [],
    vocabulary: [makeVocabularyItem('net-force')],
    concepts: [makeConceptItem('balanced-forces')],
    referenceFormulas: [makeReferenceFormula('force-reference')],
    problemBank: [makeProblemItem('balanced-force-problem')],
    standardsMap: [makeStandardsMapItem('SAMPLE.PS.FORCES.1')],
    smokeTests: [makeSmokeTest()],
    metadata: {
      createdBy: 'test-suite',
      createdAt: '2026-05-14T00:00:00.000Z'
    },
    ...overrides
  };
}

function makeVocabularyItem(term) {
  return {
    term,
    aliases: [],
    studentDefinition: 'Net force is the total force on an object.',
    teacherDefinition: 'Net force is the vector sum of forces acting on an object.',
    misconception: 'Students may think balanced forces always mean no forces exist.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus: 'pending',
    confidence: 'medium',
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
    studentExplanation: 'Balanced forces do not change motion.',
    keyIdeas: ['Balanced forces do not change motion.'],
    examples: ['Equal pushes from opposite sides.'],
    nonExamples: ['A stronger push from one side.'],
    commonMisconceptions: ['Balanced forces mean no forces exist.'],
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus: 'pending',
    confidence: 'medium',
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
    reviewStatus: 'pending',
    confidence: 'medium',
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
    reviewStatus: 'pending',
    confidence: 'medium',
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
    reviewStatus: 'pending',
    confidence: 'medium'
  };
}

function makeSmokeTest() {
  return {
    question: 'What do balanced forces do?',
    expectedAnswer: 'They do not change motion.',
    reviewStatus: 'pending',
    confidence: 'medium'
  };
}

function cleanupTempRoot() {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
