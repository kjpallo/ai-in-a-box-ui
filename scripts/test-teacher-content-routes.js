const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { registerTeacherContentRoutes } = require('../routes/teacherContentRoutes');
const { planTeacherContentImport } = require('../lib/uploads/planTeacherContentImport');

const projectRoot = path.join(__dirname, '..');
const tempRoot = path.join(projectRoot, 'tmp', 'test-teacher-content-routes');
const draftPacksDir = path.join(tempRoot, 'draft-packs');
const approvedPacksDir = path.join(tempRoot, 'approved-packs');
const deletedApprovedPacksDir = path.join(tempRoot, 'deleted-approved-packs');
const activationRegistryPath = path.join(approvedPacksDir, '_activation.json');
const uploadIncomingDir = path.join(tempRoot, 'uploads', 'incoming');
const uploadExtractedDir = path.join(tempRoot, 'uploads', 'extracted');
const rawModelResponsesDir = path.join(tempRoot, 'model-responses');
const standardsBanksDir = path.join(tempRoot, 'standards-banks');
const realApprovedPacksDir = path.join(projectRoot, 'knowledge', 'approved-packs');
const standardsBank = makeStandardsBank();
let mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());

cleanupTempRoot();
fs.mkdirSync(draftPacksDir, { recursive: true });
fs.mkdirSync(approvedPacksDir, { recursive: true });
fs.mkdirSync(deletedApprovedPacksDir, { recursive: true });
fs.mkdirSync(uploadIncomingDir, { recursive: true });
fs.mkdirSync(uploadExtractedDir, { recursive: true });
fs.mkdirSync(standardsBanksDir, { recursive: true });

const approvedPacksBefore = snapshotFiles(realApprovedPacksDir);
const routerStudentFilesBefore = snapshotRouterAndStudentFiles();

main().catch((error) => {
  console.error('Teacher content route tests failed.');
  console.error(error);
  cleanupTempRoot();
  process.exit(1);
});

async function main() {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-draft-pack',
    vocabulary: [
      makeVocabularyItem('net-force', 'pending'),
      makeVocabularyItem('balanced-force', 'approved')
    ],
    concepts: [
      makeConceptItem('balanced-forces', 'rejected')
    ]
  }));
  writeKnowledgePack(path.join(draftPacksDir, '_example'), makePack({
    packId: 'route-example-draft-pack',
    title: 'Route Example Draft Fixture'
  }));
  writeKnowledgePack(approvedPacksDir, makePack({
    packId: 'route-approved-pack',
    version: '1.0.0',
    vocabulary: [
      makeVocabularyItem('net-force', 'approved'),
      makeVocabularyItem('balanced-force', 'approved')
    ]
  }));
  writeKnowledgePack(path.join(approvedPacksDir, '_example'), makePack({
    packId: 'route-example-approved-pack',
    title: 'Route Example Approved Fixture',
    version: '1.0.0'
  }));
  writeStandardsBank(standardsBanksDir, standardsBank);
  const handlers = new Map();
  registerTeacherContentRoutes(createApp(handlers), {
    draftPacksDir,
    approvedPacksDir,
    deletedApprovedPacksDir,
    uploadIncomingDir,
    uploadExtractedDir,
    rawModelResponsesDir,
    standardsBanksDir,
    modelClient: async (request) => mockDraftModelClient(request),
    standardsBank
  });

  try {
    await assertDashboardEndpoint(handlers);
    await assertSuccessfulTxtUploadExtraction(handlers);
    await assertUnsupportedUploadExtensionFails(handlers);
    await assertUnsafeUploadFilenameIsSanitized(handlers);
    await assertDraftsEndpoint(handlers);
    await assertStandardsBankListEndpoint(handlers);
    await assertStandardsBankDetailEndpoint(handlers);
    await assertInvalidStandardsBankIdRejected(handlers);
    await assertDraftReportEndpoint(handlers);
    await assertDraftReportWithStandardsBankEndpoint(handlers);
    await assertMissingDraftReportStandardsBankEndpoint(handlers);
    await assertPrepareReviewEndpointSucceeds(handlers);
    await assertLargeFullImportRequiresConfirmation(handlers);
    await assertPreviewPrepareReviewDoesNotWriteDraft(handlers);
    await assertPreviewEmptyFirstPageReturnsTextPageRecovery(handlers);
    await assertUltraSafePreviewNormalizesConceptFields(handlers);
    await assertPreviewValidationFailureReturnsHttp200PartialPreview(handlers);
    await assertPartialPreviewReturnsSuccessfulItemsWithoutDraft(handlers);
    await assertPreviewPrepareReviewRequiresRange(handlers);
    await assertPrepareReviewNoUsablePreviewItemsReturnsStructuredRecoveryJson(handlers);
    await assertSelectedPageRangeImportWritesPartialDraft(handlers);
    assertAutoImportPlannerSmallFileSingleBatch();
    assertAutoImportPlannerMultiPageSequentialBatches();
    assertAutoImportPlannerVeryLargeDoesNotDropTextBearingPages();
    assertAutoImportPlannerNoTextManualReview();
    assertAutoImportPlannerLowMemorySaferDefault();
    assertAutoImportPlannerImageOnlyWarning();
    await assertUploadAndPrepareEndpointSucceeds(handlers);
    await assertUploadAndPreparePdfWithKnowledgeNameSucceeds(handlers);
    await assertUploadAndPrepareMissingFileFailsClearly(handlers);
    await assertUploadAndPrepareMissingKnowledgeNameFailsClearly(handlers);
    await assertUploadAndPrepareModelFailureReturnsClearJson(handlers);
    await assertUploadAndPrepareModelCrashShowsBatchSizeRecovery(handlers);
    await assertInvalidPrepareReviewUploadIdRejected(handlers);
    await assertMissingPrepareReviewExtractionFails(handlers);
    await assertPrepareReviewModelFailureDoesNotWriteDraft(handlers);
    await assertPromoteDraftEndpointSucceeds(handlers);
    await assertPromoteBlocksPendingItems(handlers);
    await assertPromoteExcludesRejectedItems(handlers);
    await assertPromoteExcludesRepairNeededItems(handlers);
    await assertPromoteBlocksInvalidFormulaSolverStatus(handlers);
    await assertPromoteStrictValidationBlocksInvalidApprovedOutput(handlers);
    await assertPromoteDoesNotOverwriteWithoutForce(handlers);
    await assertPromoteOverwritesWithForce(handlers);
    await assertInvalidPromotePathTraversalRejected(handlers);
    await assertApproveDraftItemEndpoint(handlers);
    await assertRejectDraftItemEndpoint(handlers);
    await assertEditDraftItemEndpoint(handlers);
    await assertDisallowedEditFails(handlers);
    await assertInvalidPatchPathTraversalRejected(handlers);
    await assertInvalidSectionRejected(handlers);
    await assertInvalidIndexRejected(handlers);
    await assertInvalidReviewStatusRejected(handlers);
    await assertSolverStatusEditRejected(handlers);
    await assertApprovedEndpoint(handlers);
    await assertApprovedActivationEndpointEnablesPack(handlers);
    await assertApprovedActivationEndpointDisablesPack(handlers);
    await assertInvalidApprovedActivationPathTraversalRejected(handlers);
    await assertMissingApprovedActivationPackRejected(handlers);
    await assertNonBooleanApprovedActivationRejected(handlers);
    await assertApprovedDeleteRequiresConfirmation(handlers);
    await assertInvalidApprovedDeletePathTraversalRejected(handlers);
    await assertMissingApprovedDeletePackRejected(handlers);
    await assertApprovedBulkDeleteArchivesSelectedPacksOnly(handlers);
    await assertApprovedBulkDeletePathTraversalRejectedBeforeMutation(handlers);
    await assertApprovedDeleteArchivesPackAndActivationOnly(handlers);
    await assertUploadHistoryEndpoint(handlers);
    await assertMissingDraftReportEndpoint(handlers);
    await assertPathTraversalRejected(handlers);
    assertRealApprovedPacksAreNotModified();
    assertNoRouterOrStudentModulesImported();
  } finally {
    cleanupTempRoot();
  }

  console.log('Teacher content route tests passed.');
}

async function assertDashboardEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/dashboard');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.draftPacks, 1);
  assert.deepEqual(response.body.data.availableTabs, [
    'upload',
    'standards',
    'draftPack',
    'reviewDraft',
    'importReport',
    'approvedPacks'
  ]);
}

async function assertDraftsEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/drafts');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.draftPacks.length, 1);
  assert.equal(response.body.data.draftPacks[0].packId, 'route-draft-pack');
  assert.equal(response.body.data.draftPacks.some((pack) => pack.packId === 'route-example-draft-pack'), false);
  assert.equal(response.body.data.draftPacks[0].totalPending, 1);
  assert.equal(response.body.data.draftPacks[0].totalRejected, 1);
}

async function assertDraftReportEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, {
    packId: 'route-draft-pack'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.draftPack.packId, 'route-draft-pack');
  assert.equal(response.body.data.pendingReview.totalPending, 1);
  assert.equal(response.body.data.promotionReadiness.ready, false);
  assert.ok(response.body.data.promotionReadiness.blockedReasons.includes('pending items remain'));
}

async function assertStandardsBankListEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/standards-banks');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.standardsBanks.length, 1);
  assert.deepEqual(response.body.data.standardsBanks[0], {
    standardsBankId: 'sample_physical_science_standards',
    title: 'Sample Physical Science Standards Bank',
    subject: 'Physical Science',
    gradeLevel: '8',
    jurisdiction: 'Local Sample',
    version: '0.1.0',
    standardsCount: 1,
    validationPassed: true,
    warnings: [],
    errors: []
  });
}

async function assertStandardsBankDetailEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/standards-banks/:standardsBankId', {}, {
    standardsBankId: 'sample_physical_science_standards'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.standardsBankId, 'sample_physical_science_standards');
  assert.equal(response.body.data.standardsCount, 1);
  assert.equal(response.body.data.standards[0].standardId, 'SAMPLE.PS.FORCES.1');
  assert.equal(response.body.data.standards[0].officialText, 'Describe how balanced and unbalanced forces affect motion.');
  assert.equal(response.body.data.standards[0].studentFriendlyText, 'I can explain how balanced and unbalanced forces change motion.');
}

async function assertInvalidStandardsBankIdRejected(handlers) {
  const response = await request(handlers, 'GET', '/standards-banks/:standardsBankId', {}, {
    standardsBankId: '../sample_physical_science_standards'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /standardsBankId/);
}

async function assertDraftReportWithStandardsBankEndpoint(handlers) {
  const draftBefore = snapshotFiles(draftPacksDir);
  const approvedBefore = snapshotFiles(approvedPacksDir);
  const standardsBefore = snapshotFiles(standardsBanksDir);
  const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, {
    packId: 'route-draft-pack'
  }, {
    standardsBankId: 'sample_physical_science_standards'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.selectedStandardsBank.standardsBankId, 'sample_physical_science_standards');
  assert.equal(response.body.data.standardsSummary.standardsBankLoaded, true);
  assert.equal(response.body.data.standardsSummary.standards[0].code, 'PS.FORCES.1');
  assert.equal(response.body.data.standardsSummary.standards[0].officialText, 'Describe how balanced and unbalanced forces affect motion.');
  assert.equal(response.body.data.standardsSummary.standards[0].studentFriendlyText, 'I can explain how balanced and unbalanced forces change motion.');
  assert.equal(response.body.data.standardsSummary.standards[0].strand, 'Physical Science');
  assert.equal(response.body.data.standardsSummary.standards[0].topic, 'Forces and Motion');
  assert.deepEqual(response.body.data.standardsSummary.standards[0].keywords, ['balanced forces']);
  assert.deepEqual(snapshotFiles(draftPacksDir), draftBefore, 'standards bank report selection should not modify drafts');
  assert.deepEqual(snapshotFiles(approvedPacksDir), approvedBefore, 'standards bank report selection should not modify approved packs');
  assert.deepEqual(snapshotFiles(standardsBanksDir), standardsBefore, 'standards bank report selection should not modify standards bank files');
}

async function assertMissingDraftReportStandardsBankEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, {
    packId: 'route-draft-pack'
  }, {
    standardsBankId: 'missing_standards_bank'
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('Standards bank not found')));
}

async function assertPrepareReviewEndpointSucceeds(handlers) {
  const uploadId = 'prepare-review-upload';
  const extractionPath = path.join(uploadExtractedDir, `${uploadId}_extraction.json`);
  fs.writeFileSync(extractionPath, `${JSON.stringify(makeExtraction({
    uploadId,
    originalFileName: 'teacher_prepare_review_notes.txt'
  }), null, 2)}\n`);

  const draftFilesBefore = snapshotFiles(draftPacksDir);
  const approvedFilesBefore = snapshotFiles(realApprovedPacksDir);
  const calls = [];
  mockDraftModelClient = async (request) => {
    calls.push(request);
    return JSON.stringify(makeGeneratedPack({
      packId: 'prepared-review-draft',
      title: 'Model Title That Teacher Name Replaces'
    }));
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Teacher Prepared Forces',
    model: 'mock-local-model',
    timeoutMs: 1234,
    keepAlive: '4m',
    retryInvalidJson: true,
    importMode: 'full',
    confirmFullImport: true
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.packId, 'draft-full-import-teacher-prepared-forces-prepare-review-upload');
  assert.equal(response.body.data.title, 'Full Import: Teacher Prepared Forces');
  assert.equal(response.body.data.message, 'Review draft prepared.');
  assert.equal(response.body.data.sourceMatch.uploadedFileName, 'teacher_prepare_review_notes.txt');
  assert.equal(response.body.data.sourceMatch.draftPackId, response.body.data.packId);
  assert.equal(response.body.data.sourceMatch.draftTitle, 'Full Import: Teacher Prepared Forces');
  assert.deepEqual(response.body.data.sourceMatch.draftSourceFiles, ['teacher_prepare_review_notes.txt']);
  assert.equal(response.body.data.sourceMatch.extractionCharacterCount, 74);
  assert.equal(response.body.data.sourceMatch.chunkCount, 1);
  assert.equal(response.body.data.sourceMatch.status, 'matched');
  assert.equal(response.body.data.dashboard.draftPacks, 2);
  assert.ok(response.body.data.drafts.some((draft) => draft.packId === response.body.data.packId));
  assert.equal(response.body.data.draftReport.draftPack.packId, response.body.data.packId);
  assert.equal(response.body.data.draftReport.draftPack.importScope.scope, 'full_document');
  assert.equal(response.body.data.importScope.completePacketImported, true);
  assert.equal(response.body.data.draftReport.coverageReport.totalChunks, 1);
  assert.equal(response.body.data.draftReport.coverageReport.processedChunks, 1);
  assert.ok(response.body.data.timeline.some((event) => event.message === 'Building draft packet wrapper'));
  assert.ok(response.body.data.timeline.some((event) => event.message === 'Draft ready for review'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'mock-local-model');
  assert.equal(calls[0].timeoutMs, 1234);
  assert.equal(calls[0].keepAlive, '4m');

  const createdPath = path.join(draftPacksDir, response.body.data.packId, 'knowledge_pack.json');
  assert.equal(fs.existsSync(createdPath), true, 'Prepare Review should write only to the configured draft-packs dir.');
  const generated = JSON.parse(fs.readFileSync(createdPath, 'utf8'));
  assert.equal(generated.packId, response.body.data.packId);
  assert.equal(generated.title, 'Full Import: Teacher Prepared Forces');
  assert.equal(generated.metadata.importScope.scope, 'full_document');
  assert.equal(generated.vocabulary[0].reviewStatus, 'pending');
  assert.equal(generated.concepts[0].reviewStatus, 'pending');
  assert.equal(generated.problemBank[0].reviewStatus, 'pending');
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.equal(generated.referenceFormulas[0].reviewStatus, 'pending');

  const addedDraftFiles = Object.keys(snapshotFiles(draftPacksDir)).filter((filePath) => !draftFilesBefore[filePath]);
  assert.deepEqual(addedDraftFiles, [path.join(response.body.data.packId, 'knowledge_pack.json')]);
  assert.deepEqual(snapshotFiles(realApprovedPacksDir), approvedFilesBefore, 'Prepare Review should not modify real approved packs.');
}

async function assertLargeFullImportRequiresConfirmation(handlers) {
  const uploadId = 'large-confirm-required';
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeExtraction({
    uploadId,
    originalFileName: 'large_teacher_packet.txt',
    text: 'Large packet sentence. '.repeat(900),
    sections: [{
      title: 'Full Text',
      text: 'Large packet sentence. '.repeat(900),
      startLine: 1,
      endLine: 1
    }]
  }), null, 2)}\n`);
  let calls = 0;
  mockDraftModelClient = async () => {
    calls += 1;
    return JSON.stringify(makeGeneratedPack());
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Large Confirm Required',
    importMode: 'full'
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('requires typing CONFIRM')));
  assert.equal(response.body.importEstimate.isLarge, true);
  assert.equal(calls, 0, 'large full import should not call Gemma before confirmation.');

  const booleanOnlyResponse = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Large Confirm Required',
    importMode: 'full',
    confirmFullImport: true
  }, {
    uploadId
  });

  assert.equal(booleanOnlyResponse.statusCode, 409);
  assert.equal(calls, 0, 'large full import should require typed confirmation, not a boolean.');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertPreviewPrepareReviewDoesNotWriteDraft(handlers) {
  const uploadId = 'preview-only-upload';
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeLargePdfExtraction({
    uploadId,
    originalFileName: 'preview_teacher_packet.txt',
    pages: 5,
    charactersPerPage: 650
  }), null, 2)}\n`);
  let calls = 0;
  mockDraftModelClient = async () => {
    calls += 1;
    return JSON.stringify(makeGeneratedPack());
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Preview Only',
    knowledgeName: 'Preview Only',
    importMode: 'preview',
    previewOnly: true,
    importSelection: {
      pageStart: 1,
      pageEnd: 3
    }
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.preview, true);
  assert.deepEqual(response.body.data.importSelection.pages, [1, 2, 3]);
  assert.equal(response.body.data.inputSnapshot.modelSettings.temperature, 0);
  assert.ok(response.body.data.previewReport.processedChunkCount >= 1);
  assert.ok(calls >= 1, 'preview should call Gemma on the sample.');
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'preview should not write a final draft pack.');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertPreviewEmptyFirstPageReturnsTextPageRecovery(handlers) {
  const uploadId = 'preview-empty-first-page';
  const extraction = makeLargePdfExtraction({
    uploadId,
    originalFileName: 'preview_empty_first_page.pdf',
    pages: 4,
    charactersPerPage: 650
  });
  extraction.pages = extraction.pages.filter((page) => page.pageNumber !== 1);
  extraction.sections = extraction.sections.filter((section) => section.pageNumber !== 1);
  extraction.text = extraction.pages.map((page) => page.text).join('\n\n');
  extraction.metadata.characterCount = extraction.text.length;
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(extraction, null, 2)}\n`);
  let calls = 0;
  mockDraftModelClient = async () => {
    calls += 1;
    return JSON.stringify(makeGeneratedPack());
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Preview Empty First Page',
    knowledgeName: 'Preview Empty First Page',
    importMode: 'preview',
    previewOnly: true,
    previewMode: 'ultraSafe',
    importSelection: {
      pageStart: 1,
      pageEnd: 1
    }
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('The selected page exists, but no extractable text was found there.')));
  assert.ok(response.body.errors.some((error) => error.includes('Try page 2, the first page with extracted text.')));
  assert.equal(response.body.importEstimate.firstTextPage, 2);
  assert.deepEqual(response.body.importEstimate.textBearingPages, [2, 3, 4]);
  assert.equal(response.body.extractionCounts.firstTextPage, 2);
  assert.equal(calls, 0, 'empty selected text page should fail before calling Gemma.');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertUltraSafePreviewNormalizesConceptFields(handlers) {
  const uploadId = 'ultra-safe-normalized-preview-upload';
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeLargePdfExtraction({
    uploadId,
    originalFileName: 'ultra_safe_teacher_packet.txt',
    pages: 1,
    charactersPerPage: 950
  }), null, 2)}\n`);
  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack({
    packId: 'route-ultra-safe-normalized-preview',
    vocabulary: [],
    concepts: [
      {
        claim: 'Preview source supports this review concept',
        summary: 'Preview source supports this review concept.',
        aliases: [],
        keyIdeas: [],
        examples: [],
        nonExamples: [],
        commonMisconceptions: [],
        standards: [],
        reviewStatus: 'pending',
        confidence: 'low',
        sourceFile: 'ultra_safe_teacher_packet.txt',
        sourceLocation: 'Page 1',
        sourceTextSnippet: 'Preview source supports this review concept.'
      }
    ],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Ultra Safe Preview',
    knowledgeName: 'Ultra Safe Preview',
    importMode: 'preview',
    previewOnly: true,
    previewMode: 'ultraSafe',
    previewMaxCharacters: 1000,
    importSelection: {
      pageStart: 1,
      pageEnd: 1
    }
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.preview, true);
  assert.equal(response.body.data.previewReport.itemCounts.concepts, 1);
  assert.equal(response.body.data.previewReport.importNormalization.conceptIdsGenerated, 1);
  assert.equal(response.body.data.previewReport.importNormalization.conceptTitlesGenerated, 1);
  assert.ok(response.body.data.timeline.some((event) => event.type === 'normalization_complete'));
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'ultra-safe preview should not write a final draft pack.');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertPreviewValidationFailureReturnsHttp200PartialPreview(handlers) {
  const uploadId = 'salvage-preview-validation-upload';
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeLargePdfExtraction({
    uploadId,
    originalFileName: 'salvage_preview_teacher_packet.txt',
    pages: 1,
    charactersPerPage: 950
  }), null, 2)}\n`);
  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack({
    packId: 'route-salvage-preview-pack',
    vocabulary: [makeVocabularyItem('preview-valid', 'pending')],
    concepts: [],
    referenceFormulas: [
      {
        ...makeReferenceFormula('bad-formula', 'pending'),
        equation: ''
      }
    ],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Salvage Preview',
    knowledgeName: 'Salvage Preview',
    importMode: 'preview',
    previewOnly: true,
    previewMode: 'ultraSafe',
    previewMaxCharacters: 1000,
    importSelection: {
      pageStart: 1,
      pageEnd: 1
    }
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.preview, true);
  assert.equal(response.body.data.partialPreview, true);
  assert.equal(response.body.data.validationPassed, false);
  assert.equal(response.body.data.previewReport.partialPreview, true);
  assert.equal(response.body.data.previewReport.validationPassed, false);
  assert.equal(response.body.data.previewReport.pack.vocabulary.length, 1);
  assert.equal(response.body.data.previewReport.pack.referenceFormulas.length, 0);
  assert.ok(response.body.data.previewReport.invalidItems.some((entry) => entry.section === 'referenceFormulas'));
  assert.ok(response.body.data.previewReport.validationErrors.includes('referenceFormulas[0].equation must be a non-empty string.'));
  assert.ok(response.body.data.timeline.some((event) => event.type === 'preview_invalid_items_quarantined'));
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'salvaged preview should not write a final draft pack.');

  const selectedDraftFilesBefore = snapshotFiles(draftPacksDir);
  const selectedResponse = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Salvage Preview Selected',
    knowledgeName: 'Salvage Preview Selected',
    importMode: 'selected',
    importSelection: {
      pageStart: 1,
      pageEnd: 1
    }
  }, {
    uploadId
  });

  assert.equal(selectedResponse.statusCode, 400);
  assert.equal(selectedResponse.body.success, false);
  assert.ok(selectedResponse.body.errors.includes('referenceFormulas[0].equation must be a non-empty string.'));
  assert.deepEqual(snapshotFiles(draftPacksDir), selectedDraftFilesBefore, 'selected import should stay strict and never write quarantined preview items to a draft.');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertPartialPreviewReturnsSuccessfulItemsWithoutDraft(handlers) {
  const uploadId = 'partial-preview-upload';
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeLargePdfExtraction({
    uploadId,
    originalFileName: 'partial_preview_teacher_packet.txt',
    pages: 2,
    charactersPerPage: 900
  }), null, 2)}\n`);
  let calls = 0;
  mockDraftModelClient = async () => {
    calls += 1;
    if (calls > 1) {
      throw new Error('Ollama returned HTTP 500: {"error":"model runner has unexpectedly stopped, this may be due to resource limitations"}');
    }
    return JSON.stringify(makeGeneratedPack({
      packId: 'route-partial-preview-pack',
      vocabulary: [makeVocabularyItem('preview-ok', 'pending')],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }));
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Partial Preview',
    knowledgeName: 'Partial Preview',
    importMode: 'preview',
    previewOnly: true,
    previewMode: 'normal',
    previewMaxCharacters: 1000,
    importSelection: {
      pageStart: 1,
      pageEnd: 2
    }
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.preview, true);
  assert.equal(response.body.data.partialPreview, true);
  assert.equal(response.body.data.previewReport.partialPreview, true);
  assert.ok(response.body.data.previewReport.failedBatches.length >= 1);
  assert.ok(response.body.data.timeline.some((event) => event.type === 'partial_preview_ready'));
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'partial preview should not write a final draft pack.');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertPreviewPrepareReviewRequiresRange(handlers) {
  const uploadId = 'preview-missing-range';
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeExtraction({
    uploadId,
    originalFileName: 'preview_missing_range.txt'
  }), null, 2)}\n`);
  let calls = 0;
  mockDraftModelClient = async () => {
    calls += 1;
    return JSON.stringify(makeGeneratedPack());
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    knowledgeName: 'Preview Missing Range',
    importMode: 'preview',
    previewOnly: true
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('Preview prepare requires selected pages or chunks')));
  assert.equal(response.body.timeline[0].message, 'Full upload estimate ready');
  assert.equal(calls, 0, 'missing preview range should fail before calling Gemma.');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertPrepareReviewNoUsablePreviewItemsReturnsStructuredRecoveryJson(handlers) {
  const uploadId = 'no-usable-preview-items';
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeLargePdfExtraction({
    uploadId,
    originalFileName: 'Concept 1 Notes - Nature of Energy.pptx.pdf',
    pages: 12,
    charactersPerPage: 210
  }), null, 2)}\n`);
  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack({
    packId: 'route-no-usable-preview-pack',
    vocabulary: [],
    concepts: [],
    referenceFormulas: [
      {
        ...makeReferenceFormula('empty-equation', 'pending'),
        equation: ''
      }
    ],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    knowledgeName: 'No Usable Preview',
    importMode: 'preview',
    previewOnly: true,
    previewMode: 'ultraSafe',
    previewMaxCharacters: 1000,
    importSelection: {
      pageStart: 1,
      pageEnd: 1
    }
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, 'Gemma did not return any usable preview items from this range.');
  assert.equal(response.body.teacherFriendlyError, 'Gemma did not return any usable preview items from this range.');
  assert.equal(response.body.uploadId, uploadId);
  assert.equal(response.body.fileName, 'Concept 1 Notes - Nature of Energy.pptx.pdf');
  assert.equal(response.body.sourceType, 'pdf');
  assert.equal(response.body.selectedRange, 'Pages 1-1');
  assert.equal(response.body.extractionCounts.pageCount, 12);
  assert.equal(response.body.extractionCounts.chunkCount, 12);
  assert.ok(response.body.extractionCounts.characterCount > 2000);
  assert.ok(response.body.errors.includes('referenceFormulas[0].equation must be a non-empty string.'));
  assert.ok(Array.isArray(response.body.invalidItems));

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertSelectedPageRangeImportWritesPartialDraft(handlers) {
  const uploadId = 'selected-range-upload';
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeLargePdfExtraction({
    uploadId,
    originalFileName: 'selected_teacher_packet.pdf',
    pages: 6,
    charactersPerPage: 650
  }), null, 2)}\n`);
  const calls = [];
  mockDraftModelClient = async ({ prompt }) => {
    calls.push(prompt);
    assert.ok(!prompt.includes('Route synthetic page 1'), 'selected import should not send page 1');
    assert.ok(!prompt.includes('Route synthetic page 5'), 'selected import should not send page 5');
    return JSON.stringify(makeGeneratedPack({
      vocabulary: [{
        term: 'selected-page-two',
        aliases: [],
        studentDefinition: 'Selected page two definition.',
        teacherDefinition: 'Selected page two teacher definition.',
        misconception: '',
        standards: ['SAMPLE.PS.FORCES.1'],
        reviewStatus: 'pending',
        confidence: 'medium'
      }],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }));
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Selected Range',
    importMode: 'selected',
    importSelection: {
      pageStart: 2,
      pageEnd: 4
    }
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.selectedImport, true);
  assert.deepEqual(response.body.data.importSelection.pages, [2, 3, 4]);
  assert.equal(response.body.data.importScope.scope, 'selected_range');
  assert.equal(response.body.data.importScope.rangeLimited, true);
  assert.equal(response.body.data.importSelection.completePacketImported, false);
  assert.ok(response.body.data.selectedImportEstimate.characterCount < response.body.data.importEstimate.characterCount);
  assert.ok(response.body.data.timeline.some((event) => event.type === 'import_selection_ready'));
  assert.ok(calls.length >= 1, 'selected import should call Gemma for selected range.');

  const createdPath = path.join(draftPacksDir, response.body.data.packId, 'knowledge_pack.json');
  assert.equal(fs.existsSync(createdPath), true);
  const generated = JSON.parse(fs.readFileSync(createdPath, 'utf8'));
  assert.deepEqual(generated.metadata.partialImport.importedPages, [2, 3, 4]);
  assert.equal(generated.metadata.importScope.scope, 'selected_range');
  assert.equal(generated.metadata.importScope.warning, 'This draft covers only Pages 2-4. It does not mark the whole packet imported.');
  assert.equal(generated.metadata.partialImport.completePacketImported, false);
  assert.equal(generated.metadata.partialImport.originalPageCount, 6);
  assert.equal(generated.metadata.importCoverage.totalPages, 3);
  assert.equal(generated.vocabulary[0].reviewStatus, 'pending');
  assert.equal(generated.vocabulary[0].sourceLocation, 'Pages 2-4');

  const addedDraftFiles = Object.keys(snapshotFiles(draftPacksDir)).filter((filePath) => !draftFilesBefore[filePath]);
  assert.deepEqual(addedDraftFiles, [path.join(response.body.data.packId, 'knowledge_pack.json')]);

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

function assertAutoImportPlannerSmallFileSingleBatch() {
  const plan = planTeacherContentImport({
    extraction: makePlannerExtraction(['Balanced forces have zero net force.']),
    fileSizeBytes: 512,
    settings: { maxBatchCharacters: 2500, model: 'gemma4:e2b' },
    memory: makePlannerMemory(4096, 8192)
  });

  assert.equal(plan.mode, 'auto_full');
  assert.equal(plan.recommendedImportScope, 'full_document');
  assert.equal(plan.batchStrategy, 'single_batch');
  assert.equal(plan.batchCount, 1);
  assert.equal(plan.batches[0].pageNumbers[0], 1);
}

function assertAutoImportPlannerMultiPageSequentialBatches() {
  const plan = planTeacherContentImport({
    extraction: makePlannerExtraction([
      'A'.repeat(1600),
      'B'.repeat(1600),
      'C'.repeat(1600)
    ]),
    settings: { maxBatchCharacters: 2000 },
    memory: makePlannerMemory(4096, 8192)
  });

  assert.equal(plan.recommendedImportScope, 'full_document');
  assert.equal(plan.batchStrategy, 'sequential_batches');
  assert.ok(plan.batchCount >= 3);
  assert.deepEqual(plan.batches.flatMap((batch) => batch.pageNumbers), [1, 2, 3]);
}

function assertAutoImportPlannerVeryLargeDoesNotDropTextBearingPages() {
  const pages = Array.from({ length: 12 }, (_value, index) => `Page ${index + 1} ${'x'.repeat(900)}`);
  const plan = planTeacherContentImport({
    extraction: makePlannerExtraction(pages),
    settings: { maxBatchCharacters: 1200, veryLargeBatchLimit: 30 },
    memory: makePlannerMemory(4096, 8192)
  });

  assert.equal(plan.recommendedImportScope, 'full_document');
  assert.equal(plan.batchStrategy, 'sequential_batches');
  assert.deepEqual(plan.batches.flatMap((batch) => batch.pageNumbers), Array.from({ length: 12 }, (_value, index) => index + 1));
}

function assertAutoImportPlannerNoTextManualReview() {
  const plan = planTeacherContentImport({
    extraction: makePlannerExtraction(['', ''], { hasImagesOrMedia: true }),
    settings: { maxBatchCharacters: 1200 },
    memory: makePlannerMemory(4096, 8192)
  });

  assert.equal(plan.mode, 'manual_review_needed');
  assert.equal(plan.recommendedImportScope, 'preview_sample');
  assert.equal(plan.batchStrategy, 'manual');
  assert.ok(plan.warnings.some((warning) => /OCR\/vision is not part of this phase/i.test(warning)));
}

function assertAutoImportPlannerLowMemorySaferDefault() {
  const plan = planTeacherContentImport({
    extraction: makePlannerExtraction(['A'.repeat(1500), 'B'.repeat(1500)]),
    settings: { maxBatchCharacters: 1600 },
    memory: makePlannerMemory(512, 8192)
  });

  assert.equal(plan.mode, 'auto_preview_only');
  assert.equal(plan.recommendedImportScope, 'preview_sample');
  assert.equal(plan.batchStrategy, 'preview_then_continue');
  assert.equal(plan.batchCount, 1);
  assert.ok(plan.warnings.some((warning) => /Available memory is low/i.test(warning)));
}

function assertAutoImportPlannerImageOnlyWarning() {
  const plan = planTeacherContentImport({
    extraction: makePlannerExtraction(['', 'Slide text'], {
      slideCount: 2,
      pageCount: 2,
      hasImagesOrMedia: true
    }),
    settings: { maxBatchCharacters: 1200 },
    memory: makePlannerMemory(4096, 8192)
  });

  assert.equal(plan.recommendedImportScope, 'full_document');
  assert.ok(plan.warnings.some((warning) => /OCR\/vision is not part of this phase/i.test(warning)));
}

async function assertInvalidPrepareReviewUploadIdRejected(handlers) {
  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {}, {
    uploadId: '../prepare-review-upload'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /uploadId/);
}

async function assertMissingPrepareReviewExtractionFails(handlers) {
  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {}, {
    uploadId: 'missing-upload'
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('No extracted upload JSON')));
}

async function assertPrepareReviewModelFailureDoesNotWriteDraft(handlers) {
  const uploadId = 'prepare-review-invalid';
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeExtraction({
    uploadId,
    originalFileName: 'teacher_invalid_model_notes.txt'
  }), null, 2)}\n`);

  const draftFilesBefore = snapshotFiles(draftPacksDir);
  mockDraftModelClient = async () => '{"packId":"broken",';

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    retryInvalidJson: false,
    importMode: 'full',
    confirmFullImport: true
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('Model response was not valid JSON')));
  assert.ok(response.body.rawModelResponsePath, 'invalid model output should return the raw model response path when available');
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'invalid draft output should not write a draft pack');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertSuccessfulTxtUploadExtraction(handlers) {
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  const approvedFilesBefore = snapshotFiles(realApprovedPacksDir);
  const response = await requestMultipart(handlers, '/uploads/extract', {
    fileName: 'teacher_force_notes.txt',
    contentType: 'text/plain',
    content: 'Balanced forces have a net force of zero.\nUnbalanced forces change motion.\n'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.originalFileName, 'teacher_force_notes.txt');
  assert.equal(response.body.data.fileType, 'txt');
  assert.ok(response.body.data.characterCount > 20);
  assert.equal(response.body.data.sectionsCount, 1);
  assert.equal(response.body.data.tablesCount, 0);
  assert.ok(response.body.data.storedFileName.endsWith('.txt'));
  assert.ok(!response.body.data.storedFileName.includes('teacher_force_notes'));
  assert.ok(response.body.data.extractionJsonFileName.endsWith('_extraction.json'));

  const storedPath = path.join(uploadIncomingDir, response.body.data.storedFileName);
  const extractionPath = path.join(uploadExtractedDir, response.body.data.extractionJsonFileName);
  assert.equal(fs.existsSync(storedPath), true, 'Upload source should be stored safely.');
  assert.equal(fs.readFileSync(storedPath, 'utf8').includes('Balanced forces'), true);
  assert.equal(fs.existsSync(extractionPath), true, 'Extraction JSON should be created.');
  const extractionJson = JSON.parse(fs.readFileSync(extractionPath, 'utf8'));
  assert.equal(extractionJson.success, true);
  assert.equal(extractionJson.upload.originalFileName, 'teacher_force_notes.txt');
  assert.ok(extractionJson.text.includes('Unbalanced forces'));

  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'upload extraction should not create or modify draft packs');
  assert.deepEqual(snapshotFiles(realApprovedPacksDir), approvedFilesBefore, 'upload extraction should not modify real approved packs');
}

async function assertUploadHistoryEndpoint(handlers) {
  const uploadId = 'history-upload';
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeExtraction({
    uploadId,
    originalFileName: 'history_packet.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    sections: [
      {
        label: 'Page 2',
        sourceLocation: 'Page 2',
        pageNumber: 2,
        text: 'History page with extractable science text.'
      }
    ],
    metadata: {
      detectedType: 'pdf',
      pageCount: 3,
      textBearingPages: [2],
      pagesWithText: [2],
      firstTextPage: 2,
      characterCount: 43
    }
  }), null, 2)}\n`);
  writeKnowledgePack(path.join(draftPacksDir, 'history-draft-pack'), makePack({
    packId: 'history-draft-pack',
    title: 'History Draft Pack',
    sourceFiles: [{
      fileName: 'history_packet.pdf',
      uploadId,
      fileType: 'pdf',
      reviewStatus: 'approved',
      confidence: 'high'
    }],
    metadata: {
      createdBy: 'test-suite',
      createdAt: '2026-05-18T12:00:00.000Z',
      sourceUpload: {
        uploadId,
        originalFileName: 'history_packet.pdf'
      }
    }
  }));
  writeKnowledgePack(path.join(approvedPacksDir, 'history-approved-pack'), makePack({
    packId: 'history-approved-pack',
    title: 'History Approved Pack',
    sourceFiles: [{
      fileName: 'history_packet.pdf',
      uploadId,
      fileType: 'pdf',
      reviewStatus: 'approved',
      confidence: 'high'
    }],
    metadata: {
      createdBy: 'test-suite',
      sourceUpload: {
        uploadId,
        originalFileName: 'history_packet.pdf'
      },
      createdAt: '2026-05-18T12:00:00.000Z',
      updatedAt: '2026-05-18T12:30:00.000Z'
    }
  }));

  const response = await request(handlers, 'GET', '/uploads/history');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  const source = response.body.data.uploadedSources.find((item) => item.uploadId === uploadId);
  assert.ok(source, 'uploaded source history should include extraction records');
  assert.equal(source.originalFileName, 'history_packet.pdf');
  assert.equal(source.fileType, 'pdf');
  assert.equal(source.extractedUnitCount, 3);
  assert.equal(source.textBearingUnitCount, 1);
  assert.equal(source.firstTextBearingUnit, 2);
  assert.equal(source.draftPackExists, true);
  assert.equal(source.approvedPackExists, true);
  assert.equal(source.draftPacks[0].packId, 'history-draft-pack');
  assert.equal(source.approvedPacks[0].packId, 'history-approved-pack');
  assert.ok(source.warnings.some((warning) => /image-only page\/slide.*OCR later/i.test(warning)));
}

async function assertUploadAndPrepareEndpointSucceeds(handlers) {
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  const approvedFilesBefore = snapshotFiles(realApprovedPacksDir);
  const calls = [];
  mockDraftModelClient = async (request) => {
    calls.push(request);
    return JSON.stringify(makeGeneratedPack({
      title: 'Model Title That Teacher Name Replaces',
      sourceFiles: [{
        fileName: 'teacher_one_button_notes.txt',
        fileType: 'txt',
        reviewStatus: 'approved',
        confidence: 'high'
      }]
    }));
  };

  const response = await requestMultipart(handlers, '/uploads/upload-and-prepare', {
    fileName: 'teacher_one_button_notes.txt',
    contentType: 'text/plain',
    content: 'Balanced forces have a net force of zero.\nUnbalanced forces change motion.\n',
    fields: {
      packName: 'One Button Teacher Draft'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.upload.originalFileName, 'teacher_one_button_notes.txt');
  assert.equal(response.body.data.requiresPreview, false);
  assert.equal(response.body.data.nextStep, 'generate_draft');
  assert.equal(response.body.data.importEstimate.fileName, 'teacher_one_button_notes.txt');
  assert.equal(response.body.data.importEstimate.estimatedGemmaBatches, 1);
  assert.equal(response.body.data.autoImportPlan.recommendedImportScope, 'full_document');
  assert.equal(response.body.data.autoImportPlan.batchStrategy, 'single_batch');
  assert.ok(Array.isArray(response.body.data.timeline));
  assert.ok(response.body.data.timeline.some((event) => event.message === 'Import estimate ready'));
  assert.ok(response.body.data.timeline.some((event) => event.message === 'Auto import plan ready'));
  assert.equal(calls.length, 0);
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'combined upload-and-prepare should not create the generated draft before preview/full confirmation.');
  assert.deepEqual(snapshotFiles(realApprovedPacksDir), approvedFilesBefore, 'combined upload-and-prepare should not modify real approved packs.');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertUploadAndPreparePdfWithKnowledgeNameSucceeds(handlers) {
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  const approvedFilesBefore = snapshotFiles(realApprovedPacksDir);
  const calls = [];
  mockDraftModelClient = async (request) => {
    calls.push(request);
    return JSON.stringify(makeGeneratedPack({
      title: 'Model Title That Teacher Name Replaces',
      sourceFiles: [{
        fileName: 'teacher_energy_packet.pdf',
        fileType: 'pdf',
        reviewStatus: 'approved',
        confidence: 'high'
      }]
    }));
  };

  const response = await requestMultipart(handlers, '/uploads/upload-and-prepare', {
    fileName: 'teacher_energy_packet.pdf',
    contentType: 'application/pdf',
    content: makeMinimalPdf('Energy is the ability to do work. Kinetic energy depends on mass and speed.'),
    fields: {
      knowledgeName: 'Energy'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.upload.originalFileName, 'teacher_energy_packet.pdf');
  assert.equal(response.body.data.upload.fileType, 'pdf');
  assert.equal(response.body.data.requiresPreview, false);
  assert.equal(response.body.data.nextStep, 'generate_draft');
  assert.equal(response.body.data.importEstimate.fileName, 'teacher_energy_packet.pdf');
  assert.equal(response.body.data.autoImportPlan.recommendedImportScope, 'full_document');
  assert.ok(response.body.data.timeline.some((event) => event.message === 'Extraction complete'));
  assert.ok(response.body.data.timeline.some((event) => event.message === 'Import estimate ready'));
  assert.equal(calls.length, 0);
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'combined upload-and-prepare should not create the generated PDF draft before preview/full confirmation.');
  assert.deepEqual(snapshotFiles(realApprovedPacksDir), approvedFilesBefore, 'combined PDF upload-and-prepare should not modify real approved packs.');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertUploadAndPrepareMissingFileFailsClearly(handlers) {
  const response = await requestMultipart(handlers, '/uploads/upload-and-prepare', {
    fields: {
      knowledgeName: 'Energy'
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, 'No file was received by the upload route.');
  assert.deepEqual(response.body.errors, ['No file was received by the upload route.']);
}

async function assertUploadAndPrepareMissingKnowledgeNameFailsClearly(handlers) {
  const incomingBefore = snapshotFiles(uploadIncomingDir);
  const extractedBefore = snapshotFiles(uploadExtractedDir);
  const response = await requestMultipart(handlers, '/uploads/upload-and-prepare', {
    fileName: 'teacher_missing_name.pdf',
    contentType: 'application/pdf',
    content: makeMinimalPdf('A PDF should not be stored when knowledge name is missing.')
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, 'Knowledge name is required.');
  assert.deepEqual(response.body.errors, ['Knowledge name is required.']);
  assert.deepEqual(snapshotFiles(uploadIncomingDir), incomingBefore, 'missing knowledge name should not store the upload');
  assert.deepEqual(snapshotFiles(uploadExtractedDir), extractedBefore, 'missing knowledge name should not extract the upload');
}

async function assertUploadAndPrepareModelFailureReturnsClearJson(handlers) {
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  const uploadId = 'prepare-model-failure';
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeExtraction({
    uploadId,
    originalFileName: 'teacher_model_failure_notes.txt'
  }), null, 2)}\n`);
  mockDraftModelClient = async () => '{"packId":"broken",';

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Energy Model Failure',
    retryInvalidJson: false,
    importMode: 'full',
    confirmFullImport: true
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('Model response was not valid JSON')));
  assert.ok(Array.isArray(response.body.timeline));
  assert.ok(response.body.timeline.some((event) => event.type === 'error' && event.message.includes('Model response was not valid JSON')));
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'model failure should not write a draft pack');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertUploadAndPrepareModelCrashShowsBatchSizeRecovery(handlers) {
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  const uploadId = 'prepare-model-crash';
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeExtraction({
    uploadId,
    originalFileName: 'teacher_model_crash_notes.txt',
    text: `${'Energy crash retry source sentence. '.repeat(260)}\n`,
    sections: [{
      title: 'Full Text',
      text: `${'Energy crash retry source sentence. '.repeat(260)}\n`,
      startLine: 1,
      endLine: 1
    }]
  }), null, 2)}\n`);
  mockDraftModelClient = async () => {
    throw new Error('Ollama returned HTTP 500: {"error":"model runner has unexpectedly stopped, this may be due to resource limitations"}');
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Energy Model Crash',
    importMode: 'full',
    confirmFullImport: true
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('batch may be too large')));
  assert.ok(response.body.errors.some((error) => error.includes('retried with smaller chunks')));
  assert.ok(Array.isArray(response.body.timeline));
  assert.ok(response.body.timeline.some((event) => event.type === 'batch_retry'));
  assert.ok(Array.isArray(response.body.failedBatches));
  assert.ok(response.body.failedBatches.length >= 1);
  assert.ok(response.body.coverageReport.warnings.some((warning) => warning.includes('Model draft failed for batch 1')));
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'model crash failure should not write a partial draft pack');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertUnsupportedUploadExtensionFails(handlers) {
  const incomingBefore = snapshotFiles(uploadIncomingDir);
  const extractedBefore = snapshotFiles(uploadExtractedDir);
  const response = await requestMultipart(handlers, '/uploads/extract', {
    fileName: 'slides.ppt',
    contentType: 'application/vnd.ms-powerpoint',
    content: 'Legacy PowerPoint is not supported in this phase.'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('Legacy .ppt uploads are not supported')));
  assert.ok(response.body.errors.some((error) => error.includes('save the presentation as .pptx or PDF')));
  assert.deepEqual(snapshotFiles(uploadIncomingDir), incomingBefore, 'unsupported source should not be stored');
  assert.deepEqual(snapshotFiles(uploadExtractedDir), extractedBefore, 'unsupported extraction JSON should not be created');
}

async function assertUnsafeUploadFilenameIsSanitized(handlers) {
  const response = await requestMultipart(handlers, '/uploads/extract', {
    fileName: '../unsafe/../../teacher path traversal.txt',
    contentType: 'text/plain',
    content: 'Path traversal names should be reduced to a harmless basename.\n'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.originalFileName, 'teacher path traversal.txt');
  assert.match(response.body.data.storedFileName, /^[a-f0-9-]+\.txt$/);
  assert.equal(path.dirname(path.join(uploadIncomingDir, response.body.data.storedFileName)), uploadIncomingDir);
}

async function assertApprovedEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/approved');

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.ok(response.body.data.approvedPacks.length >= 1);
  const approvedPack = response.body.data.approvedPacks.find((pack) => pack.packId === 'route-approved-pack');
  assert.equal(approvedPack.packId, 'route-approved-pack');
  assert.equal(approvedPack.status, 'Approved');
  assert.equal(approvedPack.validationStatus, 'Passed');
  assert.equal(approvedPack.sourceSummary, 'teacher_force_notes.txt');
  assert.deepEqual(approvedPack.sourceFileNames, ['teacher_force_notes.txt']);
  assert.equal(approvedPack.activationEnabled, false);
  assert.equal(approvedPack.activationStatus, 'disabled');
  assert.ok(response.body.data.indexedCounts.vocabularyTerms >= 1);
}

async function assertApprovedActivationEndpointEnablesPack(handlers) {
  const approvedBefore = snapshotKnowledgePackFiles(approvedPacksDir);
  const draftBefore = snapshotFiles(draftPacksDir);
  const response = await request(handlers, 'PATCH', '/approved/:packId/activation', {
    enabled: true
  }, {
    packId: 'route-approved-pack'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.packId, 'route-approved-pack');
  assert.equal(response.body.data.activationEnabled, true);
  assert.equal(response.body.data.activationStatus, 'enabled');
  assert.equal(response.body.data.message, 'Activation setting saved. This does not change student answers yet.');
  assert.equal(response.body.data.approved.activationEnabled, true);
  assert.equal(response.body.data.approvedSummary.approvedPacks.find((pack) => pack.packId === 'route-approved-pack').activationEnabled, true);
  assert.equal(fs.existsSync(activationRegistryPath), true, 'activation registry file should be written in the temp approved packs dir');
  assert.equal(JSON.parse(fs.readFileSync(activationRegistryPath, 'utf8')).packs['route-approved-pack'].enabled, true);
  assert.deepEqual(snapshotKnowledgePackFiles(approvedPacksDir), approvedBefore, 'activation should not modify approved knowledge_pack.json files');
  assert.deepEqual(snapshotFiles(draftPacksDir), draftBefore, 'activation should not modify draft packs');
}

async function assertApprovedActivationEndpointDisablesPack(handlers) {
  const response = await request(handlers, 'PATCH', '/approved/:packId/activation', {
    enabled: false
  }, {
    packId: 'route-approved-pack'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.activationEnabled, false);
  assert.equal(response.body.data.activationStatus, 'disabled');
  assert.equal(JSON.parse(fs.readFileSync(activationRegistryPath, 'utf8')).packs['route-approved-pack'].enabled, false);
}

async function assertInvalidApprovedActivationPathTraversalRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/approved/:packId/activation', {
    enabled: true
  }, {
    packId: '../route-approved-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /packId/);
}

async function assertMissingApprovedActivationPackRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/approved/:packId/activation', {
    enabled: true
  }, {
    packId: 'missing-approved-pack'
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /Approved pack not found/);
}

async function assertNonBooleanApprovedActivationRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/approved/:packId/activation', {
    enabled: 'true'
  }, {
    packId: 'route-approved-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /enabled must be a boolean/);
}

async function assertApprovedDeleteRequiresConfirmation(handlers) {
  const response = await request(handlers, 'DELETE', '/approved/:packId', {}, {
    packId: 'route-approved-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /confirmationText/);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-approved-pack', 'knowledge_pack.json')), true);
}

async function assertInvalidApprovedDeletePathTraversalRejected(handlers) {
  const response = await request(handlers, 'DELETE', '/approved/:packId', {
    confirmationText: 'DELETE'
  }, {
    packId: '../route-approved-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /packId/);
}

async function assertMissingApprovedDeletePackRejected(handlers) {
  const response = await request(handlers, 'DELETE', '/approved/:packId', {
    confirmationText: 'DELETE'
  }, {
    packId: 'missing-approved-pack'
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /Approved pack not found/);
}

async function assertApprovedDeleteArchivesPackAndActivationOnly(handlers) {
  const uploadedSourcePath = path.join(uploadIncomingDir, 'route-approved-source.pdf');
  fs.writeFileSync(uploadedSourcePath, 'uploaded source remains');
  const draftBefore = snapshotFiles(draftPacksDir);
  const uploadsBefore = snapshotFiles(path.join(tempRoot, 'uploads'));
  const response = await request(handlers, 'DELETE', '/approved/:packId', {
    confirmationText: 'DELETE'
  }, {
    packId: 'route-approved-pack'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.packId, 'route-approved-pack');
  assert.equal(response.body.data.removedActivation, true);
  assert.equal(response.body.data.sourceFilesPreserved, true);
  assert.equal(response.body.data.draftPacksPreserved, true);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-approved-pack', 'knowledge_pack.json')), false);
  assert.ok(response.body.data.archivedPath.startsWith(deletedApprovedPacksDir));
  assert.equal(fs.existsSync(path.join(response.body.data.archivedPath, 'knowledge_pack.json')), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(response.body.data.archivedPath, 'knowledge_pack.json'), 'utf8')).packId, 'route-approved-pack');
  assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(fs.readFileSync(activationRegistryPath, 'utf8')).packs, 'route-approved-pack'), false);
  assert.equal(response.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === 'route-approved-pack'), false);
  assert.deepEqual(snapshotFiles(draftPacksDir), draftBefore, 'delete should not remove or modify draft packs');
  assert.deepEqual(snapshotFiles(path.join(tempRoot, 'uploads')), uploadsBefore, 'delete should not remove uploaded source files');
}

async function assertApprovedBulkDeleteArchivesSelectedPacksOnly(handlers) {
  writeKnowledgePack(approvedPacksDir, makePack({
    packId: 'route-bulk-delete-pack-one',
    title: 'Route Bulk Delete Pack One',
    version: '1.0.0',
    vocabulary: [makeVocabularyItem('bulk-delete-one', 'approved')]
  }));
  writeKnowledgePack(approvedPacksDir, makePack({
    packId: 'route-bulk-delete-pack-two',
    title: 'Route Bulk Delete Pack Two',
    version: '1.0.0',
    vocabulary: [makeVocabularyItem('bulk-delete-two', 'approved')]
  }));
  writeKnowledgePack(approvedPacksDir, makePack({
    packId: 'route-bulk-keep-pack',
    title: 'Route Bulk Keep Pack',
    version: '1.0.0',
    vocabulary: [makeVocabularyItem('bulk-keep', 'approved')]
  }));
  fs.writeFileSync(activationRegistryPath, `${JSON.stringify({
    version: 1,
    packs: {
      'route-approved-pack': { enabled: false, updatedAt: '2026-01-01T00:00:00.000Z' },
      'route-bulk-delete-pack-one': { enabled: true, updatedAt: '2026-01-01T00:00:00.000Z' },
      'route-bulk-delete-pack-two': { enabled: true, updatedAt: '2026-01-01T00:00:00.000Z' },
      'route-bulk-keep-pack': { enabled: true, updatedAt: '2026-01-01T00:00:00.000Z' }
    }
  }, null, 2)}\n`);

  const uploadedSourcePath = path.join(uploadIncomingDir, 'route-bulk-delete-source.pdf');
  fs.writeFileSync(uploadedSourcePath, 'bulk delete uploaded source remains');
  const draftBefore = snapshotFiles(draftPacksDir);
  const uploadsBefore = snapshotFiles(path.join(tempRoot, 'uploads'));
  const nonSelectedBefore = readKnowledgePack(approvedPacksDir, 'route-bulk-keep-pack');
  const response = await request(handlers, 'DELETE', '/approved', {
    packIds: ['route-bulk-delete-pack-one', 'route-bulk-delete-pack-two'],
    confirmationText: 'DELETE'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.deletedCount, 2);
  assert.deepEqual(response.body.data.deletedPackIds, ['route-bulk-delete-pack-one', 'route-bulk-delete-pack-two']);
  assert.equal(response.body.data.sourceFilesPreserved, true);
  assert.equal(response.body.data.draftPacksPreserved, true);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-bulk-delete-pack-one', 'knowledge_pack.json')), false);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-bulk-delete-pack-two', 'knowledge_pack.json')), false);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-bulk-keep-pack', 'knowledge_pack.json')), true);
  assert.deepEqual(readKnowledgePack(approvedPacksDir, 'route-bulk-keep-pack'), nonSelectedBefore, 'non-selected approved pack should remain untouched');
  assert.equal(response.body.data.deletions.length, 2);
  response.body.data.deletions.forEach((deletion) => {
    assert.ok(deletion.archivedPath.startsWith(deletedApprovedPacksDir));
    assert.equal(fs.existsSync(path.join(deletion.archivedPath, 'knowledge_pack.json')), true);
  });
  const activationState = JSON.parse(fs.readFileSync(activationRegistryPath, 'utf8'));
  assert.equal(Object.prototype.hasOwnProperty.call(activationState.packs, 'route-bulk-delete-pack-one'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(activationState.packs, 'route-bulk-delete-pack-two'), false);
  assert.equal(activationState.packs['route-bulk-keep-pack'].enabled, true);
  assert.equal(response.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === 'route-bulk-delete-pack-one'), false);
  assert.equal(response.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === 'route-bulk-delete-pack-two'), false);
  assert.equal(response.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === 'route-bulk-keep-pack'), true);
  assert.deepEqual(snapshotFiles(draftPacksDir), draftBefore, 'bulk delete should not remove or modify draft packs');
  assert.deepEqual(snapshotFiles(path.join(tempRoot, 'uploads')), uploadsBefore, 'bulk delete should not remove uploaded source files');
}

async function assertApprovedBulkDeletePathTraversalRejectedBeforeMutation(handlers) {
  writeKnowledgePack(approvedPacksDir, makePack({
    packId: 'route-bulk-invalid-guard-pack',
    title: 'Route Bulk Invalid Guard Pack',
    version: '1.0.0',
    vocabulary: [makeVocabularyItem('bulk-invalid-guard', 'approved')]
  }));
  const approvedBefore = snapshotFiles(approvedPacksDir);
  const deletedBefore = snapshotFiles(deletedApprovedPacksDir);
  const draftBefore = snapshotFiles(draftPacksDir);
  const response = await request(handlers, 'DELETE', '/approved', {
    packIds: ['route-bulk-invalid-guard-pack', '../route-approved-pack'],
    confirmationText: 'DELETE'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /packIds/);
  assert.deepEqual(snapshotFiles(approvedPacksDir), approvedBefore, 'invalid bulk delete should not modify approved packs');
  assert.deepEqual(snapshotFiles(deletedApprovedPacksDir), deletedBefore, 'invalid bulk delete should not archive any packs');
  assert.deepEqual(snapshotFiles(draftPacksDir), draftBefore, 'invalid bulk delete should not modify draft packs');
}

async function assertPromoteDraftEndpointSucceeds(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-promote-ready-pack',
    title: 'Route Promote Ready Pack'
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-promote-ready-pack'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.packId, 'route-promote-ready-pack');
  assert.equal(response.body.data.message, 'Draft promoted to approved knowledge pack.');
  assert.equal(response.body.data.approved.packId, 'route-promote-ready-pack');
  assert.equal(response.body.data.dashboard.approvedPacks, 2);
  assert.ok(response.body.data.outputPath.startsWith(approvedPacksDir));
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-promote-ready-pack', 'knowledge_pack.json')), true);
}

async function assertPromoteBlocksPendingItems(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-promote-pending-pack',
    vocabulary: [makeVocabularyItem('pending-term', 'pending')]
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-promote-pending-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('pending teacher review')));
  assert.equal(response.body.promotionReadiness.ready, false);
  assert.ok(response.body.promotionReadiness.blockedReasons.includes('pending items remain'));
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-promote-pending-pack', 'knowledge_pack.json')), false);
}

async function assertPromoteExcludesRejectedItems(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-promote-rejected-pack',
    vocabulary: [makeVocabularyItem('approved-term', 'approved')],
    concepts: [makeConceptItem('rejected-concept', 'rejected')]
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-promote-rejected-pack'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  const promoted = readKnowledgePack(approvedPacksDir, 'route-promote-rejected-pack');
  assert.deepEqual(promoted.vocabulary.map((item) => item.term), ['approved-term']);
  assert.deepEqual(promoted.concepts, []);
  assert.equal(JSON.stringify(promoted).includes('rejected-concept'), false);
}

async function assertPromoteExcludesRepairNeededItems(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-promote-repair-needed-pack',
    vocabulary: [
      makeVocabularyItem('approved-term', 'approved'),
      {
        ...makeVocabularyItem('repair-needed-term', 'approved'),
        reviewStatus: 'repair_needed',
        studentDefinition: ''
      }
    ]
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-promote-repair-needed-pack'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  const promoted = readKnowledgePack(approvedPacksDir, 'route-promote-repair-needed-pack');
  assert.deepEqual(promoted.vocabulary.map((item) => item.term), ['approved-term']);
  assert.equal(JSON.stringify(promoted).includes('repair-needed-term'), false);
}

async function assertPromoteBlocksInvalidFormulaSolverStatus(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-promote-formula-pack',
    referenceFormulas: [
      {
        ...makeReferenceFormula('force-reference', 'approved'),
        solverStatus: 'science_formula_rules'
      }
    ]
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-promote-formula-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('solverStatus')));
  assert.ok(response.body.promotionReadiness.blockedReasons.includes('formula solverStatus is not reference_only'));
}

async function assertPromoteStrictValidationBlocksInvalidApprovedOutput(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-promote-invalid-approved-output-pack',
    vocabulary: [
      {
        ...makeVocabularyItem('unknown-standard-term', 'approved'),
        standards: ['SAMPLE.PS.UNKNOWN.1']
      }
    ]
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-promote-invalid-approved-output-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('unknown standard reference')));
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-promote-invalid-approved-output-pack', 'knowledge_pack.json')), false);
}

async function assertPromoteDoesNotOverwriteWithoutForce(handlers) {
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-approved-pack',
    title: 'Draft Copy Of Existing Approved Pack'
  }));
  const before = readKnowledgePack(approvedPacksDir, 'route-approved-pack');

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: 'route-approved-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.some((error) => error.includes('already exists')));
  assert.equal(readKnowledgePack(approvedPacksDir, 'route-approved-pack').title, before.title);
}

async function assertPromoteOverwritesWithForce(handlers) {
  const response = await request(handlers, 'POST', '/drafts/:packId/promote', { force: true }, {
    packId: 'route-approved-pack'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(readKnowledgePack(approvedPacksDir, 'route-approved-pack').title, 'Draft Copy Of Existing Approved Pack');
}

async function assertInvalidPromotePathTraversalRejected(handlers) {
  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {}, {
    packId: '../route-promote-ready-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /packId/);
}

async function assertApproveDraftItemEndpoint(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'approved'
  }, {
    packId: 'route-draft-pack',
    section: 'vocabulary',
    index: '0'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.update.after, 'approved');
  assert.equal(readKnowledgePack(draftPacksDir, 'route-draft-pack').vocabulary[0].reviewStatus, 'approved');
  assert.equal(response.body.data.report.draftPack.reviewCountsBySection.vocabulary.approved, 2);
}

async function assertRejectDraftItemEndpoint(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'rejected'
  }, {
    packId: 'route-draft-pack',
    section: 'concepts',
    index: '0'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(readKnowledgePack(draftPacksDir, 'route-draft-pack').concepts[0].reviewStatus, 'rejected');
}

async function assertEditDraftItemEndpoint(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index', {
    field: 'studentDefinition',
    value: 'Updated draft-only student definition.'
  }, {
    packId: 'route-draft-pack',
    section: 'vocabulary',
    index: '0'
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  const pack = readKnowledgePack(draftPacksDir, 'route-draft-pack');
  assert.equal(pack.vocabulary[0].studentDefinition, 'Updated draft-only student definition.');
  assert.equal(pack.vocabulary[0].sourceFile, 'teacher_force_notes.txt');
  assert.equal(response.body.data.report.draftPack.packId, 'route-draft-pack');
}

async function assertDisallowedEditFails(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index', {
    field: 'aliases',
    value: ['force']
  }, {
    packId: 'route-draft-pack',
    section: 'vocabulary',
    index: '0'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /not editable/);
}

async function assertInvalidPatchPathTraversalRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'approved'
  }, {
    packId: '../route-draft-pack',
    section: 'vocabulary',
    index: '0'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /packId/);
}

async function assertInvalidSectionRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'approved'
  }, {
    packId: 'route-draft-pack',
    section: 'router',
    index: '0'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /section/);
}

async function assertInvalidIndexRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'approved'
  }, {
    packId: 'route-draft-pack',
    section: 'vocabulary',
    index: '9'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /No item found/);
}

async function assertInvalidReviewStatusRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'promoted'
  }, {
    packId: 'route-draft-pack',
    section: 'vocabulary',
    index: '0'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /reviewStatus/);
}

async function assertSolverStatusEditRejected(handlers) {
  const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index', {
    field: 'solverStatus',
    value: 'ready'
  }, {
    packId: 'route-draft-pack',
    section: 'referenceFormulas',
    index: '0'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /not editable/);
  assert.equal(readKnowledgePack(draftPacksDir, 'route-draft-pack').referenceFormulas[0].solverStatus, 'reference_only');
}

async function assertMissingDraftReportEndpoint(handlers) {
  const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, {
    packId: 'missing-draft-pack'
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.success, false);
  assert.ok(response.body.errors.length > 0);
}

async function assertPathTraversalRejected(handlers) {
  const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, {
    packId: '../route-draft-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /packId/);
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

  assert.deepEqual(forbidden, [], `teacher content routes should not import router/student modules: ${forbidden.join(', ')}`);
}

function createApp(handlers) {
  return {
    get(route, handler) {
      handlers.set(`GET ${route}`, handler);
    },
    patch(route, handler) {
      handlers.set(`PATCH ${route}`, handler);
    },
    delete(route, handler) {
      handlers.set(`DELETE ${route}`, handler);
    },
    post(route, handler) {
      handlers.set(`POST ${route}`, handler);
    }
  };
}

async function request(handlers, method, route, body = {}, params = {}, query = {}) {
  const handler = handlers.get(`${method} ${route}`);
  assert.ok(handler, `Missing handler: ${method} ${route}`);

  const req = { body, params, query, headers: {} };
  const res = createResponse();
  await handler(req, res);
  return res;
}

async function requestMultipart(handlers, route, file) {
  const handler = handlers.get(`POST ${route}`);
  assert.ok(handler, `Missing handler: POST ${route}`);

  const boundary = `test-boundary-${Date.now()}`;
  const rawBody = makeMultipartBody(boundary, file);
  const req = {
    body: {},
    params: {},
    query: {},
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(rawBody.length)
    },
    rawBody
  };
  const res = createResponse();
  await handler(req, res);
  return res;
}

function makeMultipartBody(boundary, file) {
  const parts = [];

  if (file.fileName) {
    parts.push(
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="${file.fieldName || 'sourceFile'}"; filename="${file.fileName}"\r\n`),
      Buffer.from(`Content-Type: ${file.contentType || 'application/octet-stream'}\r\n\r\n`),
      Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content || '')),
      Buffer.from('\r\n')
    );
  }

  Object.entries(file.fields || {}).forEach(([name, value]) => {
    parts.push(
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`),
      Buffer.from(String(value)),
      Buffer.from('\r\n')
    );
  });

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(parts);
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function writeKnowledgePack(rootDir, pack) {
  const packDir = path.join(rootDir, pack.packId);
  const packPath = path.join(packDir, 'knowledge_pack.json');
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(packPath, `${JSON.stringify(pack, null, 2)}\n`);
  return packPath;
}

function writeStandardsBank(rootDir, bank) {
  const bankDir = path.join(rootDir, bank.standardsBankId);
  const bankPath = path.join(bankDir, 'standards_bank.json');
  fs.mkdirSync(bankDir, { recursive: true });
  fs.writeFileSync(bankPath, `${JSON.stringify(bank, null, 2)}\n`);
  return bankPath;
}

function readKnowledgePack(rootDir, packId) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, packId, 'knowledge_pack.json'), 'utf8'));
}

function makeExtraction(overrides = {}) {
  const uploadId = overrides.uploadId || 'prepare-review-upload';
  const originalFileName = overrides.originalFileName || 'teacher_prepare_review_notes.txt';
  const text = overrides.text || 'Balanced forces have a net force of zero. Unbalanced forces change motion.';
  return {
    success: true,
    fileName: originalFileName,
    extension: overrides.extension || '.txt',
    mimeGuess: overrides.mimeGuess || 'text/plain',
    text,
    sections: overrides.sections || [
      {
        title: 'Full Text',
        text,
        startLine: 1,
        endLine: 1
      }
    ],
    tables: [],
    warnings: [],
    errors: [],
    metadata: overrides.metadata || {
      detectedType: 'txt'
    },
    upload: {
      uploadId,
      originalFileName,
      storedFileName: `${uploadId}.txt`,
      extractionJsonFileName: `${uploadId}_extraction.json`
    }
  };
}

function makeLargePdfExtraction(overrides = {}) {
  const uploadId = overrides.uploadId || 'large-pdf-upload';
  const originalFileName = overrides.originalFileName || 'large_teacher_packet.pdf';
  const pageCount = Number(overrides.pages || 6);
  const charactersPerPage = Number(overrides.charactersPerPage || 650);
  const pages = Array.from({ length: pageCount }, (_unused, index) => {
    const pageNumber = index + 1;
    return {
      pageNumber,
      text: `Route synthetic page ${pageNumber}. ${'Selected import source sentence. '.repeat(Math.ceil(charactersPerPage / 34))}`.slice(0, charactersPerPage)
    };
  });
  const text = pages.map((page) => page.text).join('\n\n');
  return {
    ...makeExtraction({
      uploadId,
      originalFileName,
      text,
      sections: pages.map((page) => ({
        label: `Page ${page.pageNumber}`,
        sourceLocation: `Page ${page.pageNumber}`,
        pageNumber: page.pageNumber,
        text: page.text
      }))
    }),
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    pages,
    metadata: {
      detectedType: 'pdf',
      pageCount,
      characterCount: text.length
    },
    upload: {
      uploadId,
      originalFileName,
      storedFileName: `${uploadId}.pdf`,
      extractionJsonFileName: `${uploadId}_extraction.json`
    }
  };
}

function makeGeneratedPack(overrides = {}) {
  return makePack({
    packId: 'prepared-review-draft',
    title: 'Prepared Review Draft',
    sourceFiles: [
      {
        fileName: 'teacher_prepare_review_notes.txt',
        fileType: 'txt',
        reviewStatus: 'approved',
        confidence: 'high',
        notes: 'Model output is normalized back to pending.'
      }
    ],
    vocabulary: [makeVocabularyItem('net-force', 'approved')],
    concepts: [makeConceptItem('balanced-forces', 'approved')],
    referenceFormulas: [
      {
        ...makeReferenceFormula('force-reference', 'approved'),
        solverStatus: 'ready'
      }
    ],
    problemBank: [makeProblemItem('balanced-force-problem', 'approved')],
    standardsMap: [makeStandardsMapItem('SAMPLE.PS.FORCES.1', 'approved')],
    smokeTests: [makeSmokeTest('approved')],
    ...overrides
  });
}

function makeMinimalPdf(text) {
  const escapedText = String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = escapedText
    ? `BT\n/F1 12 Tf\n72 720 Td\n(${escapedText}) Tj\nET\n`
    : '';
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream\nendobj\n`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return pdf;
}

function makePack(overrides = {}) {
  return {
    packId: 'route-pack',
    title: 'Route Pack',
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

function makePlannerExtraction(pageTexts, metadata = {}) {
  const pages = pageTexts.map((text, index) => ({
    label: `Page ${index + 1}`,
    sourceLocation: `Page ${index + 1}`,
    pageNumber: index + 1,
    text
  }));
  const text = pages.map((page) => page.text).filter(Boolean).join('\n\n');
  return {
    success: true,
    text,
    pages,
    sections: pages,
    metadata: {
      pageCount: pages.length,
      ...metadata
    },
    upload: {
      originalFileName: 'planner-test.pdf'
    }
  };
}

function makePlannerMemory(availableMb, totalMb) {
  return {
    freeMemoryBytes: availableMb * 1024 * 1024,
    totalMemoryBytes: totalMb * 1024 * 1024
  };
}

function snapshotFiles(rootDir) {
  const snapshot = {};
  walkFiles(rootDir).forEach((filePath) => {
    snapshot[path.relative(rootDir, filePath)] = fs.readFileSync(filePath, 'utf8');
  });
  return snapshot;
}

function snapshotKnowledgePackFiles(rootDir) {
  const snapshot = {};
  walkFiles(rootDir).filter((filePath) => path.basename(filePath) === 'knowledge_pack.json').forEach((filePath) => {
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
