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
  assertCoverageReportAndLowCoverageWarnings();
  assertCoverageReportIncludesFailedBatchWarnings();
  assertStandardsBankEnrichmentAndUnknowns();
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
  assert.equal(report.sourceExtraction.chunkCount, 1);
  assert.equal(report.coverageReport.totalChunks, 1);
  assert.equal(report.coverageReport.processedChunks, 1);
  assert.equal(report.coverageReport.itemCounts.vocabulary, 2);
  assert.equal(report.sourceMatch.status, 'matched');
  assert.equal(report.sourceMatch.uploadedFileName, 'teacher_force_notes.txt');
  assert.equal(report.sourceMatch.draftPackId, 'report-pending-pack');
  assert.equal(report.sourceMatch.draftTitle, 'Report Pack');
  assert.deepEqual(report.sourceMatch.draftSourceFiles, ['teacher_force_notes.txt']);
  assert.equal(report.sourceMatch.extractionCharacterCount, makeExtraction().text.length);
  assert.equal(report.sourceMatch.chunkCount, 1);
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
    reviewStatus: 'pending',
    confidence: 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Force is a push or pull.',
    editableFields: {
      studentDefinition: 'Net force is the total force on an object.',
      teacherDefinition: 'Net force is the vector sum of forces acting on an object.',
      misconception: 'Students may think balanced forces always mean no forces exist.'
    }
  });
  assert.equal(report.pendingReview.items.referenceFormulas.length, 0);
  assert.equal(report.promotionReadiness.ready, false);
  assert.ok(report.promotionReadiness.blockedReasons.includes('pending items remain'));
  assert.equal(report.promotionReadiness.blockedReasons.includes('rejected items remain'), false);
  assert.equal(report.standardsSummary.standardsMapCount, 1);
  assert.deepEqual(report.standardsSummary.standardIds, ['SAMPLE.PS.FORCES.1']);
  assert.deepEqual(report.standardsSummary.unknown, []);
  assert.equal(report.standardsSummary.standardsBankLoaded, true);
  assert.deepEqual(report.standardsSummary.standards[0], {
    standardId: 'SAMPLE.PS.FORCES.1',
    code: 'PS.FORCES.1',
    title: 'Balanced and Unbalanced Forces',
    description: 'Describe how balanced and unbalanced forces affect motion.',
    officialText: 'Describe how balanced and unbalanced forces affect motion.',
    studentFriendlyText: 'I can explain how balanced and unbalanced forces change motion.',
    strand: 'Physical Science',
    topic: 'Forces and Motion',
    keywords: ['balanced forces'],
    bankMatch: true,
    confidence: 'high',
    relatedVocabulary: ['net-force'],
    relatedConcepts: ['balanced-forces'],
    reviewStatus: 'approved',
    sourceFile: 'sample_standards_source.pdf',
    sourceLocation: 'p. 1'
  });

  const mismatch = buildImportPipelineReport({
    pack: makePack({
      packId: 'report-mismatch-pack',
      sourceFiles: [
        {
          fileName: 'sample_physical_science_fixture.txt',
          fileType: 'txt',
          reviewStatus: 'approved',
          confidence: 'high',
          notes: 'Synthetic mismatch fixture.'
        }
      ]
    }),
    standardsBank,
    extraction: makeExtraction()
  });
  assert.equal(mismatch.sourceMatch.status, 'mismatch');
  assert.match(mismatch.sourceMatch.warning, /do not appear to match/);
}

function assertCoverageReportAndLowCoverageWarnings() {
  writeDraftPack(makePack({
    packId: 'report-low-coverage-pack',
    vocabulary: [],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const report = buildImportPipelineReport({
    packId: 'report-low-coverage-pack',
    draftPacksDir,
    standardsBank,
    extraction: makeLowCoverageExtraction()
  });

  assert.equal(report.success, true, report.errors.join('\n'));
  assert.equal(report.coverageReport.totalPages, 4);
  assert.equal(report.coverageReport.totalChunks, 4);
  assert.equal(report.coverageReport.processedChunks, 4);
  assert.equal(report.coverageReport.chunksWithDraftItems, 0);
  assert.equal(report.coverageReport.chunksWithNoExtractedKnowledge, 4);
  assert.deepEqual(report.coverageReport.noKnowledgeChunks, ['Vocabulary', 'Concepts', 'Practice Problems', 'Reference Formulas']);
  assert.equal(report.coverageReport.itemCounts.problemBank, 0);
  assert.ok(report.coverageReport.sectionsDetected.includes('vocabulary'));
  assert.ok(report.coverageReport.sectionsDetected.includes('problemBank'));
  assert.ok(report.warnings.includes('Draft appears incomplete for the amount of extracted text.'));
  assert.ok(report.warnings.includes('Many chunks produced no items.'));
  assert.ok(report.warnings.includes('No vocabulary was found even though the source appears to contain vocabulary sections.'));
  assert.ok(report.warnings.includes('Equation-like source text was found but no reference formulas were drafted.'));
  assert.ok(report.warnings.includes('Practice/example question text was found but no problem bank items were drafted.'));
  assert.equal(report.promotionReadiness.ready, false);
  assert.ok(report.promotionReadiness.blockedReasons.includes('At least one approved draft item is required before promotion.'));
}

function assertCoverageReportIncludesFailedBatchWarnings() {
  writeDraftPack(makePack({
    packId: 'report-failed-batch-pack',
    metadata: {
      importCoverage: {
        failedBatches: [
          {
            batchIndex: 2,
            chunkLabels: ['Page 7 / Chunk 1'],
            pages: [7],
            characterCount: 2500,
            errors: ['Gemma crashed while reading batch 2 of 4.']
          }
        ]
      }
    }
  }));

  const report = buildImportPipelineReport({
    packId: 'report-failed-batch-pack',
    draftPacksDir,
    standardsBank,
    extraction: makeLowCoverageExtraction()
  });

  assert.equal(report.success, true, report.errors.join('\n'));
  assert.equal(report.coverageReport.failedBatches.length, 1);
  assert.equal(report.coverageReport.failedBatches[0].batchIndex, 2);
  assert.ok(report.warnings.some((warning) => warning.includes('Model draft failed for batch 2')));
  assert.ok(report.coverageReport.warnings.some((warning) => warning.includes('Page 7 / Chunk 1')));
}

function assertStandardsBankEnrichmentAndUnknowns() {
  writeDraftPack(makePack({
    packId: 'report-standards-detail-pack',
    vocabulary: [
      {
        ...makeVocabularyItem('net-force', 'approved'),
        standards: ['SAMPLE.PS.FORCES.1', 'SAMPLE.PS.UNKNOWN.1', 'SAMPLE.PS.NO_MAP.1']
      }
    ],
    concepts: [],
    problemBank: [],
    standardsMap: [
      makeStandardsMapItem('SAMPLE.PS.FORCES.1', 'approved'),
      makeStandardsMapItem('SAMPLE.PS.UNKNOWN.1', 'approved'),
      makeStandardsMapItem('SAMPLE.PS.MISSING.1', 'approved')
    ]
  }));

  const report = buildImportPipelineReport({
    packId: 'report-standards-detail-pack',
    draftPacksDir,
    standardsBank,
    standardsBankSummary: {
      standardsBankId: standardsBank.standardsBankId,
      title: standardsBank.title,
      subject: standardsBank.subject,
      gradeLevel: standardsBank.gradeLevel,
      jurisdiction: standardsBank.jurisdiction,
      version: standardsBank.version,
      standardsCount: standardsBank.standards.length,
      validationPassed: true,
      warnings: [],
      errors: []
    }
  });

  assert.equal(report.selectedStandardsBank.standardsBankId, 'sample_physical_science_standards');
  assert.deepEqual(report.standardsSummary.unknown, ['SAMPLE.PS.MISSING.1', 'SAMPLE.PS.NO_MAP.1', 'SAMPLE.PS.UNKNOWN.1']);
  assert.deepEqual(report.standardsSummary.missing, ['SAMPLE.PS.NO_MAP.1']);

  const known = report.standardsSummary.standards.find((standard) => standard.standardId === 'SAMPLE.PS.FORCES.1');
  assert.equal(known.code, 'PS.FORCES.1');
  assert.equal(known.officialText, 'Describe how balanced and unbalanced forces affect motion.');
  assert.equal(known.studentFriendlyText, 'I can explain how balanced and unbalanced forces change motion.');
  assert.equal(known.strand, 'Physical Science');
  assert.equal(known.topic, 'Forces and Motion');
  assert.deepEqual(known.keywords, ['balanced forces']);
  assert.equal(known.bankMatch, true);

  const unknown = report.standardsSummary.standards.find((standard) => standard.standardId === 'SAMPLE.PS.UNKNOWN.1');
  assert.equal(unknown.bankMatch, false);
  assert.equal(unknown.officialText, '');
  assert.equal(unknown.title, '');
  assert.deepEqual(unknown.relatedVocabulary, ['net-force']);
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
  assert.ok(report.promotionReadiness.blockedReasons.includes('formula solverStatus is not reference_only'));
  assert.ok(report.promotionReadiness.blockedReasons.some((reason) => reason.includes('solverStatus')));
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

function makeLowCoverageExtraction() {
  const sections = [
    {
      label: 'Vocabulary',
      pageNumber: 1,
      text: 'Vocabulary: Alpha means the first source-supported term. Beta is the second source-supported term. '.repeat(20)
    },
    {
      label: 'Concepts',
      pageNumber: 2,
      text: 'Concepts: a source-supported concept explanation appears here. '.repeat(20)
    },
    {
      label: 'Practice Problems',
      pageNumber: 3,
      text: 'Practice Problems: What happens when balanced forces act? Answer: motion does not change. '.repeat(20)
    },
    {
      label: 'Reference Formulas',
      pageNumber: 4,
      text: 'Reference Formulas: F = m * a where F is force, m is mass, and a is acceleration. '.repeat(20)
    }
  ];
  const text = sections.map((section) => section.text).join('\n\n');
  return {
    success: true,
    filePath: path.join(tempRoot, 'synthetic_packet.txt'),
    fileName: 'synthetic_packet.txt',
    extension: 'txt',
    mimeGuess: 'text/plain',
    text,
    sections,
    tables: [],
    metadata: {
      detectedType: 'txt',
      characterCount: text.length,
      pageCount: 4
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
