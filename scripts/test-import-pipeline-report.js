const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildImportPipelineReport } = require('../lib/uploads/buildImportPipelineReport');
const { promoteDraftKnowledgePack } = require('../lib/knowledge/promoteDraftKnowledgePack');

const projectRoot = path.join(__dirname, '..');
const tempRoot = path.join(projectRoot, 'tmp', 'test-import-pipeline-report');
const draftPacksDir = path.join(tempRoot, 'draft-packs');
const approvedPacksDir = path.join(tempRoot, 'approved-packs');
const realApprovedPacksDir = path.join(projectRoot, 'knowledge', 'approved-packs');
const standardsBank = makeStandardsBank();

cleanupTempRoot();
fs.mkdirSync(draftPacksDir, { recursive: true });
fs.mkdirSync(approvedPacksDir, { recursive: true });

const approvedPacksBefore = snapshotFiles(realApprovedPacksDir);
const routerStudentFilesBefore = snapshotRouterAndStudentFiles();

try {
  assertPendingReviewAndCounts();
  assertReadyWhenAllReviewableItemsApproved();
  assertReferenceFormulasRemainReferenceOnly();
  assertIndexPreviewFromPromotedTempApprovedPack();
  assertRealApprovedPacksAreNotModified();
  assertNoRouterOrStudentModulesImported();
} finally {
  cleanupTempRoot();
}

console.log('Import pipeline report tests passed.');

function assertPendingReviewAndCounts() {
  writeDraftPack(makePack({
    packId: 'report-pending-pack',
    vocabulary: [
      makeVocabularyItem('net-force', 'pending'),
      makeVocabularyItem('balanced-force', 'approved')
    ],
    concepts: [
      makeConceptItem('balanced-forces', 'rejected')
    ]
  }));

  const report = buildImportPipelineReport({
    packId: 'report-pending-pack',
    draftPacksDir,
    standardsBank,
    extraction: makeExtraction()
  });

  assert.equal(report.success, true, report.errors.join('\n'));
  assert.equal(report.sourceExtraction.success, true);
  assert.equal(report.sourceExtraction.fileName, 'teacher_force_notes.txt');
  assert.equal(report.sourceExtraction.fileType, 'txt');
  assert.equal(report.sourceExtraction.characterCount, makeExtraction().text.length);
  assert.equal(report.draftPack.itemCounts.vocabulary, 2);
  assert.equal(report.draftPack.reviewCounts.pending, 1);
  assert.equal(report.draftPack.reviewCounts.approved, 5);
  assert.equal(report.draftPack.reviewCounts.rejected, 1);
  assert.equal(report.draftPack.reviewCountsBySection.vocabulary.pending, 1);
  assert.equal(report.draftPack.reviewCountsBySection.vocabulary.approved, 1);
  assert.equal(report.draftPack.reviewCountsBySection.concepts.rejected, 1);
  assert.equal(report.pendingReview.totalPending, 1);
  assert.deepEqual(report.pendingReview.items.vocabulary[0], {
    section: 'vocabulary',
    index: 0,
    label: 'net-force',
    confidence: 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Force is a push or pull.'
  });
  assert.equal(report.pendingReview.items.referenceFormulas.length, 0);
  assert.equal(report.promotionReadiness.ready, false);
  assert.ok(report.promotionReadiness.blockedReasons.includes('pending items remain'));
  assert.ok(report.promotionReadiness.blockedReasons.includes('rejected items remain'));
  assert.equal(report.standardsSummary.standardsMapCount, 1);
  assert.deepEqual(report.standardsSummary.standardIds, ['SAMPLE.PS.FORCES.1']);
  assert.deepEqual(report.standardsSummary.unknown, []);
}

function assertReadyWhenAllReviewableItemsApproved() {
  writeDraftPack(makePack({ packId: 'report-ready-pack' }));

  const report = buildImportPipelineReport({
    packId: 'report-ready-pack',
    draftPacksDir,
    standardsBank,
    extraction: makeExtraction()
  });

  assert.equal(report.draftPack.validationPassed, true, report.warnings.join('\n'));
  assert.equal(report.pendingReview.totalPending, 0);
  assert.equal(report.draftPack.reviewCounts.approved, 6);
  assert.equal(report.promotionReadiness.ready, true);
  assert.deepEqual(report.promotionReadiness.blockedReasons, []);
}

function assertReferenceFormulasRemainReferenceOnly() {
  writeDraftPack(makePack({
    packId: 'report-formula-pack',
    referenceFormulas: [
      {
        ...makeReferenceFormula('force-reference', 'approved'),
        solverStatus: 'science_formula_rules'
      }
    ]
  }));

  const report = buildImportPipelineReport({
    packId: 'report-formula-pack',
    draftPacksDir,
    standardsBank
  });

  assert.equal(report.draftPack.validationPassed, false);
  assert.equal(report.promotionReadiness.ready, false);
  assert.ok(report.promotionReadiness.blockedReasons.includes('validation failed'));
  assert.ok(report.promotionReadiness.blockedReasons.includes('formula solverStatus is not reference_only'));
}

function assertIndexPreviewFromPromotedTempApprovedPack() {
  writeDraftPack(makePack({ packId: 'report-promoted-pack' }));

  const promotion = promoteDraftKnowledgePack('report-promoted-pack', {
    draftPacksDir,
    approvedPacksDir,
    standardsBank
  });
  assert.equal(promotion.success, true, promotion.errors.join('\n'));
  assert.ok(promotion.outputPath.startsWith(approvedPacksDir));

  const report = buildImportPipelineReport({
    packId: 'report-promoted-pack',
    draftPacksDir,
    approvedPacksDir,
    standardsBank
  });

  assert.deepEqual(report.indexPreview.vocabularyKeys, ['net-force']);
  assert.deepEqual(report.indexPreview.conceptKeys, ['balanced forces']);
  assert.deepEqual(report.indexPreview.problemQuestionKeys, [
    'a box has equal forces from both sides. what happens to its motion?'
  ]);
  assert.deepEqual(report.indexPreview.standardIds, ['sample.ps.forces.1']);
}

function assertRealApprovedPacksAreNotModified() {
  assert.deepEqual(
    snapshotFiles(realApprovedPacksDir),
    approvedPacksBefore,
    'real knowledge/approved-packs should not be modified'
  );
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
    packId: 'report-pack',
    title: 'Report Pack',
    version: '0.1.0-draft',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [
      {
        fileName: 'teacher_force_notes.txt',
        fileType: 'txt',
        reviewStatus: 'approved',
        confidence: 'high',
        notes: 'Teacher uploaded notes.'
      }
    ],
    vocabulary: [makeVocabularyItem('net-force', 'approved')],
    concepts: [makeConceptItem('balanced-forces', 'approved')],
    referenceFormulas: [makeReferenceFormula('force-reference', 'approved')],
    problemBank: [makeProblemItem('balanced-force-problem', 'approved')],
    standardsMap: [makeStandardsMapItem('SAMPLE.PS.FORCES.1', 'approved')],
    smokeTests: [makeSmokeTest('approved')],
    metadata: {
      createdBy: 'test-suite',
      createdAt: '2026-05-14T00:00:00.000Z'
    },
    ...overrides
  };
}

function makeVocabularyItem(term, reviewStatus) {
  return {
    term,
    aliases: [],
    studentDefinition: 'Net force is the total force on an object.',
    teacherDefinition: 'Net force is the vector sum of forces acting on an object.',
    misconception: 'Students may think balanced forces always mean no forces exist.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Force is a push or pull.'
  };
}

function makeConceptItem(conceptId, reviewStatus) {
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
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Balanced forces do not change motion.'
  };
}

function makeReferenceFormula(formulaId, reviewStatus) {
  return {
    formulaId,
    title: 'Net Force Reference',
    equation: 'net force = sum of forces',
    variables: [],
    solverStatus: 'reference_only',
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Net force is the sum of forces.'
  };
}

function makeProblemItem(problemId, reviewStatus) {
  return {
    problemId,
    question: 'A box has equal forces from both sides. What happens to its motion?',
    expectedAnswer: 'The balanced forces do not change its motion.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Balanced forces do not change motion.'
  };
}

function makeStandardsMapItem(standardId, reviewStatus) {
  return {
    standardId,
    description: 'Describe how balanced and unbalanced forces affect motion.',
    relatedVocabulary: ['net-force'],
    relatedConcepts: ['balanced-forces'],
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium'
  };
}

function makeSmokeTest(reviewStatus) {
  return {
    question: 'What do balanced forces do?',
    expectedAnswer: 'They do not change motion.',
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium'
  };
}

function makeExtraction() {
  const text = 'Force is a push or pull.\nBalanced forces do not change motion.';
  return {
    success: true,
    filePath: path.join(tempRoot, 'teacher_force_notes.txt'),
    fileName: 'teacher_force_notes.txt',
    extension: 'txt',
    mimeGuess: 'text/plain',
    text,
    sections: [
      {
        label: 'Full Text',
        text
      }
    ],
    tables: [],
    metadata: {
      detectedType: 'txt',
      characterCount: text.length
    },
    warnings: [],
    errors: []
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

function snapshotFiles(rootDir) {
  const snapshot = {};
  walkFiles(rootDir).forEach((filePath) => {
    snapshot[path.relative(rootDir, filePath)] = fs.readFileSync(filePath, 'utf8');
  });
  return snapshot;
}

function snapshotRouterAndStudentFiles() {
  const files = walkFiles(projectRoot).filter((filePath) => {
    const relativePath = path.relative(projectRoot, filePath);
    return relativePath.startsWith('lib/router/')
      || relativePath === 'lib/questionRouter.js'
      || relativePath.startsWith('routes/student')
      || relativePath === 'lib/server/questionAnswerService.js';
  });

  const snapshot = {};
  files.forEach((filePath) => {
    const stat = fs.statSync(filePath);
    snapshot[path.relative(projectRoot, filePath)] = {
      size: stat.size,
      mtimeMs: stat.mtimeMs
    };
  });
  return snapshot;
}

function assertNoRouterOrStudentModulesImported() {
  assert.deepEqual(
    snapshotRouterAndStudentFiles(),
    routerStudentFilesBefore,
    'router/student files should not be touched'
  );

  const importedPaths = Object.keys(require.cache).map((filePath) => path.relative(projectRoot, filePath));
  const forbidden = importedPaths.filter((filePath) => {
    return filePath.startsWith('lib/router/')
      || filePath === 'lib/questionRouter.js'
      || filePath.startsWith('routes/student')
      || filePath === 'lib/server/questionAnswerService.js';
  });

  assert.deepEqual(forbidden, [], `report test should not import router/student modules: ${forbidden.join(', ')}`);
}

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const results = [];
  fs.readdirSync(rootDir, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      results.push(entryPath);
    }
  });
  return results.sort();
}

function cleanupTempRoot() {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
