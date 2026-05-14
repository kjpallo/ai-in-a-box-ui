const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getDraftPackReport,
  getTeacherContentDashboard,
  listApprovedPacksSummary,
  listDraftPacksForReview
} = require('../lib/uploads/teacherContentAdapter');

const projectRoot = path.join(__dirname, '..');
const tempRoot = path.join(projectRoot, 'tmp', 'test-teacher-content-adapter');
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
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'teacher-content-draft',
    vocabulary: [
      makeVocabularyItem('net-force', 'pending'),
      makeVocabularyItem('balanced-force', 'approved')
    ],
    concepts: [
      makeConceptItem('balanced-forces', 'rejected')
    ]
  }));
  writeKnowledgePack(draftPacksDir, makeInvalidPack('invalid-draft-pack'));
  writeKnowledgePack(approvedPacksDir, makePack({
    packId: 'teacher-content-approved',
    version: '1.0.0',
    vocabulary: [
      makeVocabularyItem('net-force', 'approved'),
      makeVocabularyItem('balanced-force', 'approved')
    ]
  }));
  writeKnowledgePack(approvedPacksDir, makeInvalidPack('invalid-approved-pack'));

  assertDashboardCounts();
  assertDraftReviewList();
  assertDraftPackReport();
  assertApprovedPackSummary();
  assertInvalidPacksAreErrors();
  assertRealApprovedPacksAreNotModified();
  assertNoRouterOrStudentModulesImported();
} finally {
  cleanupTempRoot();
}

console.log('Teacher content adapter tests passed.');

function assertDashboardCounts() {
  const dashboard = getTeacherContentDashboard({ draftPacksDir, approvedPacksDir, standardsBank });

  assert.equal(dashboard.draftPacks, 1);
  assert.equal(dashboard.approvedPacks, 1);
  assert.equal(dashboard.invalidDraftPacks, 1);
  assert.equal(dashboard.invalidApprovedPacks, 1);
  assert.equal(dashboard.totalPendingReviewItems, 1);
  assert.equal(dashboard.totalApprovedReviewItems, 5);
  assert.equal(dashboard.totalRejectedReviewItems, 1);
  assert.deepEqual(dashboard.availableTabs, [
    'upload',
    'standards',
    'draftPack',
    'reviewDraft',
    'importReport',
    'approvedPacks'
  ]);
  assert.equal(dashboard.errors.length, 2);
}

function assertDraftReviewList() {
  const result = listDraftPacksForReview({ draftPacksDir, standardsBank });

  assert.equal(result.draftPacks.length, 1);
  assert.equal(result.errors.length, 1);
  assert.deepEqual(result.draftPacks[0], {
    packId: 'teacher-content-draft',
    title: 'Teacher Content Pack',
    subject: 'Physical Science',
    gradeLevel: '8',
    version: '0.1.0-draft',
    itemCounts: {
      vocabulary: 2,
      concepts: 1,
      referenceFormulas: 1,
      problemBank: 1,
      standardsMap: 1,
      smokeTests: 1
    },
    reviewCounts: {
      pending: 1,
      approved: 5,
      rejected: 1
    },
    totalPending: 1,
    totalApproved: 5,
    totalRejected: 1,
    validationPassed: true,
    sourcePath: path.join(draftPacksDir, 'teacher-content-draft', 'knowledge_pack.json')
  });
}

function assertDraftPackReport() {
  const report = getDraftPackReport('teacher-content-draft', {
    draftPacksDir,
    approvedPacksDir,
    standardsBank,
    extraction: makeExtraction()
  });

  assert.equal(report.success, true, report.errors.join('\n'));
  assert.equal(report.sourceExtraction.fileName, 'teacher_force_notes.txt');
  assert.equal(report.draftPack.packId, 'teacher-content-draft');
  assert.equal(report.pendingReview.totalPending, 1);
  assert.equal(report.pendingReview.items.vocabulary[0].label, 'net-force');
  assert.equal(report.promotionReadiness.ready, false);
  assert.ok(report.promotionReadiness.blockedReasons.includes('pending items remain'));
  assert.ok(report.promotionReadiness.blockedReasons.includes('rejected items remain'));
  assert.deepEqual(report.indexPreview.vocabularyKeys, ['balanced-force']);
}

function assertApprovedPackSummary() {
  const result = listApprovedPacksSummary({ approvedPacksDir, standardsBank });

  assert.equal(result.approvedPacks.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.indexedCounts.vocabularyTerms, 2);
  assert.equal(result.indexedCounts.concepts, 1);
  assert.equal(result.indexedCounts.problemQuestions, 1);
  assert.equal(result.indexedCounts.standards, 1);
  assert.equal(result.searchableCounts.vocabularyTerms, 2);
  assert.equal(result.approvedPacks[0].packId, 'teacher-content-approved');
  assert.equal(result.approvedPacks[0].itemCounts.vocabulary, 2);
  assert.equal(result.approvedPacks[0].indexedCounts.vocabularyTerms, 2);
}

function assertInvalidPacksAreErrors() {
  const dashboard = getTeacherContentDashboard({ draftPacksDir, approvedPacksDir, standardsBank });
  const messages = dashboard.errors.flatMap((record) => record.errors);

  assert.ok(messages.some((message) => message.includes('packId')));
  assert.equal(dashboard.errors.filter((record) => record.kind === 'draft').length, 1);
  assert.equal(dashboard.errors.filter((record) => record.kind === 'approved').length, 1);
}

function assertRealApprovedPacksAreNotModified() {
  assert.deepEqual(
    snapshotFiles(realApprovedPacksDir),
    approvedPacksBefore,
    'real knowledge/approved-packs should not be modified'
  );
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

  assert.deepEqual(forbidden, [], `teacher adapter test should not import router/student modules: ${forbidden.join(', ')}`);
}

function writeKnowledgePack(rootDir, pack) {
  const packDir = path.join(rootDir, pack.packId || 'invalid-pack');
  const packPath = path.join(packDir, 'knowledge_pack.json');
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`);
  return packPath;
}

function makeInvalidPack(title) {
  return {
    title,
    version: '0.1.0-draft',
    subject: 'Physical Science',
    gradeLevel: '8'
  };
}

function makePack(overrides = {}) {
  return {
    packId: 'teacher-content-pack',
    title: 'Teacher Content Pack',
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
    fileName: 'teacher_force_notes.txt',
    extension: 'txt',
    text,
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
    ]
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
